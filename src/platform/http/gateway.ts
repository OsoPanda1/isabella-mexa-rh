import type { VercelResponse } from "@vercel/node";
import { GATEWAY_CONFIG } from "./config";
import type { RequestContext } from "./request-context";
import { writeGatewayError } from "./error-policy";

export * from "./config";
export * from "./request-context";
export * from "./request-firewall";
export * from "./cors-policy";
export * from "./error-policy";
export * from "./response-policy";

const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "X-DNS-Prefetch-Control": "off",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https: wss:; frame-ancestors 'none';",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
});

export const applySecurityHeaders = (res: VercelResponse, traceId: string): void => {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(header, value);
  }
  res.setHeader("X-Trace-ID", traceId);
};

export interface GatewayTimeoutHandle {
  dispose(): void;
}

export const createGatewayTimeout = (
  res: VercelResponse,
  context: RequestContext,
  timeoutMs = GATEWAY_CONFIG.timeoutMs,
): GatewayTimeoutHandle => {
  const timer = setTimeout(() => {
    if (res.headersSent || res.writableEnded) return;

    writeGatewayError(
      res,
      {
        status: 504,
        code: "GATEWAY_TIMEOUT",
        message: `La solicitud excedió el tiempo límite del gateway (${timeoutMs / 1000}s).`,
      },
      context,
    );
  }, timeoutMs);

  return {
    dispose: () => clearTimeout(timer),
  };
};
