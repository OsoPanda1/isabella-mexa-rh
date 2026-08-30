import type { VercelResponse } from "@vercel/node";
import type { FailureClass } from "./error-policy";

export type ResponseMode = "FAST" | "STANDARD" | "ASYNC" | "DEGRADED" | "REJECTED";

export interface IsabellaResponseMeta {
  readonly traceId: string;
  readonly requestId: string;
  readonly responseMode: ResponseMode;
  readonly failureClass: FailureClass;
  readonly retryable: boolean;
  readonly degraded: boolean;
  readonly latencyMs: number;
  readonly featureFlags?: Record<string, boolean>;
}

export const RESPONSE_BUDGETS = {
  fast: 800,
  standard: 4_000,
  extended: 12_000,
  asyncThreshold: 12_000,
} as const;

export const classifyResponseMode = (latencyMs: number, statusCode: number): ResponseMode => {
  if (statusCode >= 400) return "REJECTED";
  if (statusCode === 202) return "ASYNC";
  if (latencyMs <= RESPONSE_BUDGETS.fast) return "FAST";
  if (latencyMs <= RESPONSE_BUDGETS.standard) return "STANDARD";
  return "DEGRADED";
};

export const writeResponseMeta = (
  res: VercelResponse,
  params: {
    traceId: string;
    requestId: string;
    latencyMs: number;
    degraded?: boolean;
    featureFlags?: Record<string, boolean>;
  },
): void => {
  if (res.headersSent) return;

  const mode = classifyResponseMode(params.latencyMs, res.statusCode || 200);

  res.setHeader("X-Trace-ID", params.traceId);
  res.setHeader("X-Request-ID", params.requestId);
  res.setHeader("X-Response-Mode", mode);
  res.setHeader("X-Response-Time", `${params.latencyMs}ms`);

  if (params.degraded) {
    res.setHeader("X-Degraded-Mode", "true");
  }
};
