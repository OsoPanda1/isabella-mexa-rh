import type { VercelRequest, VercelResponse } from "@vercel/node";

export interface ApiConfig {
  origins: string[];
}

const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "X-DNS-Prefetch-Control": "off",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
});

export const applySecurityHeaders = (res: VercelResponse, traceId: string): void => {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(header, value);
  }
  res.setHeader("X-Trace-ID", traceId);
};

export const resolveAllowedOrigin = (req: VercelRequest, config: ApiConfig): string | null => {
  const raw = req.headers.origin;
  const origin = Array.isArray(raw) ? raw[0] : raw;
  if (!origin) return null;
  return config.origins.includes(origin) ? origin : null;
};

export const handleCorsAndPreflight = (
  req: VercelRequest,
  res: VercelResponse,
  config: ApiConfig,
): boolean => {
  const allowedOrigin = resolveAllowedOrigin(req, config);

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  if (req.method !== "OPTIONS") return false;

  if (!allowedOrigin && config.origins.length > 0) {
    res.status(403).json({ error: { code: "CORS_ORIGIN_DENIED" } });
    return true;
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-ID, X-CSRF-Token");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
  return true;
};
