/**
 * Isabella Scope Authorization Runtime — TS client (PDP sidecar)
 *
 * Permite a server.ts consultar el runtime Python como Policy Decision Point
 * real para requireScope/requireRole. Fail-closed: si el PDP no está
 * configurado (ISABELLA_AUTHZ_RUNTIME_URL ausente) o es inalcanzable, el
 * middleware deniega (503) en lugar de abrir. El comportamiento previo del
 * proyecto no se rompe porque el middleware es un pas-through cuando la URL
 * no está definida.
 */

import type { NextFunction, Request, Response } from "express";

const PDP_URL = process.env.ISABELLA_AUTHZ_RUNTIME_URL;

export interface PdpRequest {
  requestId: string;
  traceId: string;
  accessToken: string;
  requiredScope: string;
  resourceTenant?: string | null;
  assurance?: string;
  environment?: string;
  stepUpVerified?: boolean;
  dualControlVerified?: boolean;
  clientIp?: string | null;
}

export interface PdpDecision {
  status: "ALLOW" | "DENY";
  decision: {
    allowed: boolean;
    code: string;
    reason: string;
    principal?: string;
    tenantId?: string;
    requiredScope?: string;
    matchedScope?: string | null;
    obligations?: string[];
    policyVersion?: string;
    expiresAt?: number;
  };
  error?: { code: string; retryable: boolean };
}

function parseCookie(header: unknown): Record<string, string> {
  if (typeof header !== "string") return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => {
        const [name, ...rest] = part.trim().split("=");
        return [name, decodeURIComponent(rest.join("="))];
      })
      .filter(([name]) => Boolean(name)),
  );
}

function extractAccessToken(req: Request): string | null {
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookies = parseCookie(req.headers.cookie);
  return cookies["__Host-isa_session"] || cookies["isa_session"] || null;
}

export async function authorizeWithPdp(req: PdpRequest, timeoutMs = 1500): Promise<PdpDecision> {
  if (!PDP_URL) throw new Error("pdp_not_configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${PDP_URL}/v1/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    return (await res.json()) as PdpDecision;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Middleware de autorización externalizada al PDP. Cuando
 * ISABELLA_AUTHZ_RUNTIME_URL no está definido, es un pass-through (conserva
 * el comportamiento actual). Cuando está definido, aplica la decisión del PDP
 * de forma fail-closed.
 */
export function pdpAuthorize(scope: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!PDP_URL) return next();
    const principal = req.principal;
    if (!principal) {
      res.status(401).json({ ok: false, error: "Authentication required." });
      return;
    }
    const token = extractAccessToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: "No access token for PDP." });
      return;
    }
    try {
      const decision = await authorizeWithPdp({
        requestId: `isabella-${Date.now()}`,
        traceId: (req.headers["x-trace-id"] as string) || `isabella-${Date.now()}`,
        accessToken: token,
        requiredScope: scope,
        resourceTenant: principal.tenantId,
        clientIp: req.ip ?? null,
      });
      if (decision.status === "ALLOW" && decision.decision.allowed) {
        next();
        return;
      }
      res.status(403).json({ ok: false, error: "PDP denial", code: decision.decision.code });
    } catch {
      // Fail-closed: PDP caído o.timeout => denegar.
      res.status(503).json({ ok: false, error: "PDP unavailable", code: "PDP_UNAVAILABLE" });
    }
  };
}
