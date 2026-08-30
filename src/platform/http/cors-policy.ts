import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GATEWAY_CONFIG } from "./config";

export const resolveAllowedOrigin = (req: VercelRequest): string | null => {
  const raw = req.headers.origin;
  const origin = Array.isArray(raw) ? raw[0] : raw;
  if (!origin) return null;
  if (GATEWAY_CONFIG.allowedOrigins.length === 0) return origin;
  return GATEWAY_CONFIG.allowedOrigins.includes(origin) ? origin : null;
};

export const applyCorsPolicy = (req: VercelRequest, res: VercelResponse): boolean => {
  const origin = resolveAllowedOrigin(req);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  if (req.method !== "OPTIONS") return false;

  if (!origin && GATEWAY_CONFIG.allowedOrigins.length > 0) {
    res.status(403).json({ error: { code: "CORS_ORIGIN_DENIED" } });
    return true;
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Trace-ID, X-Request-ID, X-CSRF-Token, x-api-key",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
  return true;
};
