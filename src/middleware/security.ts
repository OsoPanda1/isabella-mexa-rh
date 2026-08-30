import type { NextFunction, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const CSRF_COOKIE = "__Host-iv_csrf";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /reveal\s+(the\s+)?(system|developer)\s+prompt/i,
  /system\s*:\s*you\s+are/i,
  /developer\s*message\s*:/i,
  /<\/?(script|iframe|object|embed)\b/i,
];

const MutatingRequestSchema = z.object({
  body: z.unknown(),
  method: z.string().min(1),
  path: z.string().min(1),
});

function parseCookies(header: unknown): Record<string, string> {
  if (typeof header !== "string") return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const [name, ...rest] = part.trim().split("=");
      return [name, decodeURIComponent(rest.join("="))];
    }).filter(([name]) => Boolean(name)),
  );
}

function constantTimeTextEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function issueCsrfToken(_req: Request, res: Response) {
  const token = randomBytes(32).toString("base64url");
  res.setHeader(
    "Set-Cookie",
    `${CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=7200`,
  );
  return res.json({ ok: true, csrfToken: token, expiresInSec: 7200 });
}

// Bootstrap endpoints that issue the first Bearer credential: they are the
// entry point of the auth flow, so a CSRF cookie cannot exist yet. They mint
// low-privilege guest tokens only; no cookie-backed state is mutated.
const CSRF_EXEMPT_PATHS = new Set(["/api/v1/auth/session", "/api/v1/auth/native/bootstrap"]);

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (String(req.headers.authorization || "").startsWith("Bearer ")) return next();
  if (req.headers["x-api-key"]) return next();
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = String(req.headers[CSRF_HEADER] || "");
  if (!cookieToken || !headerToken || !constantTimeTextEqual(cookieToken, headerToken)) {
    return res.status(403).json({ ok: false, error: "CSRF token missing or invalid." });
  }
  return next();
}

function inspectPromptPayload(value: unknown, path = "$", findings: string[] = []): string[] {
  if (typeof value === "string") {
    const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 20_000);
    if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))) findings.push(path);
    return findings;
  }
  if (Array.isArray(value)) {
    value.slice(0, 200).forEach((item, i) => inspectPromptPayload(item, `${path}[${i}]`, findings));
    return findings;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 200)) {
      inspectPromptPayload(child, `${path}.${key}`, findings);
    }
  }
  return findings;
}

export function promptInjectionGuard(req: Request, res: Response, next: NextFunction) {
  const parsed = MutatingRequestSchema.safeParse({ body: req.body, method: req.method, path: req.path });
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Malformed request envelope." });
  if (SAFE_METHODS.has(req.method)) return next();
  const findings = inspectPromptPayload(req.body);
  if (findings.length > 0) {
    return res.status(400).json({ ok: false, error: "Potential prompt injection content rejected.", fields: findings });
  }
  return next();
}
