import type { NextFunction, Request, Response } from "express";
import { buildCheckoutUrl, consumeUsage, stableUserId, type MeteredCapability, type UsageDecision } from "../lib/subscription.server";
import { currentPrincipal } from "../lib/auth.server";

declare module "express-serve-static-core" {
  interface Request {
    isabellaBilling?: { userId: string; decision: UsageDecision };
  }
}

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 120;
const MEMORY_BUCKETS = new Map<string, Bucket>();
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_ENABLED = Boolean(UPSTASH_URL && UPSTASH_TOKEN);
const REQUIRE_DISTRIBUTED_RATE_LIMIT = process.env.REQUIRE_DISTRIBUTED_RATE_LIMIT === "true";

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of MEMORY_BUCKETS) {
    if (bucket.resetAt < now) MEMORY_BUCKETS.delete(key);
  }
}, 120_000).unref?.();

function clientKey(req: Request): string {
  const principal = (() => {
    try {
      return currentPrincipal(req);
    } catch {
      return null;
    }
  })();
  const tenant = principal?.tenantId || "anonymous";
  const subject = principal?.sub || String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0].trim();
  return `rl:${tenant}:${subject}`;
}

async function redisIncrement(key: string): Promise<Bucket | null> {
  if (!REDIS_ENABLED) return null;
  const encoded = encodeURIComponent(key);
  const auth = { Authorization: `Bearer ${UPSTASH_TOKEN}` };
  const incrResponse = await fetch(`${UPSTASH_URL}/incr/${encoded}`, { headers: auth });
  if (!incrResponse.ok) throw new Error("Redis rate-limit backend unavailable");
  const incr = (await incrResponse.json()) as { result?: number };
  if (incr.result === 1) {
    await fetch(`${UPSTASH_URL}/expire/${encoded}/${Math.ceil(WINDOW_MS / 1000)}`, { headers: auth });
  }
  const ttlResponse = await fetch(`${UPSTASH_URL}/ttl/${encoded}`, { headers: auth });
  const ttl = ttlResponse.ok ? ((await ttlResponse.json()) as { result?: number }).result : Math.ceil(WINDOW_MS / 1000);
  return { count: incr.result ?? 1, resetAt: Date.now() + Math.max(1, ttl ?? 60) * 1000 };
}

function memoryIncrement(key: string): Bucket {
  const now = Date.now();
  const bucket = MEMORY_BUCKETS.get(key) || { count: 0, resetAt: now + WINDOW_MS };
  if (bucket.resetAt < now) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }
  bucket.count += 1;
  MEMORY_BUCKETS.set(key, bucket);
  return bucket;
}

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  const parsedLimit = Number(process.env.RATE_LIMIT_PER_MINUTE || DEFAULT_LIMIT);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;
  let bucket: Bucket;
  try {
    const key = clientKey(req);
    const redisBucket = await redisIncrement(key);
    if (!redisBucket && REQUIRE_DISTRIBUTED_RATE_LIMIT) {
      res.setHeader("X-RateLimit-Backend", "redis-required");
      return res.status(503).json({ ok: false, error: { code: "RATE_LIMIT_BACKEND_REQUIRED", message: "Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed rate limiting." } });
    }
    bucket = redisBucket ?? memoryIncrement(key);
  } catch {
    if (REQUIRE_DISTRIBUTED_RATE_LIMIT) {
      res.setHeader("X-RateLimit-Backend", "redis-unavailable");
      return res.status(503).json({ ok: false, error: { code: "RATE_LIMIT_BACKEND_UNAVAILABLE", message: "Distributed rate limiting is required and currently unavailable." } });
    }
    bucket = memoryIncrement(clientKey(req));
    res.setHeader("X-RateLimit-Backend", "memory-fallback");
  }
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
  res.setHeader("X-RateLimit-Reset", new Date(bucket.resetAt).toISOString());
  if (bucket.count > limit) {
    return res.status(429).json({ ok: false, error: { code: "RATE_LIMITED", message: "Rate limit ARGUS activado. Intenta nuevamente en menos de un minuto." } });
  }
  return next();
}

export function getBillingIdentity(req: Request): { userId: string; plan?: string } {
  const principal = currentPrincipal(req);
  return { userId: stableUserId(`${principal.tenantId}:${principal.sub}`), plan: principal.plan };
}

export function quotaGate(capability: MeteredCapability, amountFactory?: (req: Request) => number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { userId, plan } = getBillingIdentity(req);
    const amount = amountFactory ? amountFactory(req) : 1;
    const decision = consumeUsage(userId, capability, amount, plan);
    res.setHeader("X-Isabella-Plan", decision.plan.id);
    res.setHeader("X-Isabella-Usage-Reset", decision.resetAt);
    res.setHeader("X-Isabella-Remaining-Messages", String(decision.remaining.messages));
    if (!decision.allowed) {
      return res.status(402).json({ ok: false, error: { code: "QUOTA_EXCEEDED", message: decision.reason }, upgradeRequired: true, plan: decision.plan, usage: decision.usage, remaining: decision.remaining, resetAt: decision.resetAt, checkout: buildCheckoutUrl("plus", userId) });
    }
    req.isabellaBilling = { userId, decision };
    return next();
  };
}
