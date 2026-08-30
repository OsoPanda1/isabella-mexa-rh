import type { VercelRequest } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

export interface RequestContext {
  readonly requestId: string;
  readonly traceId: string;
  readonly method: string;
  readonly path: string;
  readonly startedAt: number;
  elapsed(): number;
}

const validId = (value: string | null): value is string =>
  Boolean(value && /^[a-zA-Z0-9._:-]{1,128}$/.test(value));

export const createRequestContext = (req: VercelRequest): RequestContext => {
  const traceHeader = req.headers["x-trace-id"];
  const requestHeader = req.headers["x-request-id"];
  const traceValue = Array.isArray(traceHeader) ? traceHeader[0] : traceHeader;
  const requestValue = Array.isArray(requestHeader) ? requestHeader[0] : requestHeader;

  const traceId = validId(traceValue ?? null) ? traceValue : `isabella-${randomUUID()}`;
  const requestId = validId(requestValue ?? null) ? requestValue : `req-${randomUUID()}`;
  const startedAt = performance.now();

  return {
    requestId,
    traceId,
    method: (req.method ?? "UNKNOWN").toUpperCase(),
    path: req.url?.split("?")[0] ?? "/",
    startedAt,
    elapsed: () => Math.round(performance.now() - startedAt),
  };
};
