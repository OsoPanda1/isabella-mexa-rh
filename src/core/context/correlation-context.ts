/* ==== Correlation Context — traza transitiva por request ==== */

import { randomUUID } from "node:crypto";

export interface CorrelationContext {
  readonly requestId: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly startedAt: number;
}

const VALID_ID = /^[a-zA-Z0-9._:-]{1,128}$/;

export function sanitizeCorrelationId(value: string | null | undefined): string {
  return value && VALID_ID.test(value) ? value : "";
}

export interface CorrelationInput {
  requestId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
  parentSpanId?: string | null;
}

/**
 * Crea un contexto de correlación. Nunca confía en identificadores entrantes
 * sin validar; genera UUIDs cuando el valor entrante es inválido/ausente.
 */
export function createCorrelationContext(input: CorrelationInput = {}): CorrelationContext {
  const requestId = sanitizeCorrelationId(input.requestId) || `req-${randomUUID()}`;
  const traceId = sanitizeCorrelationId(input.traceId) || `isabella-${randomUUID()}`;
  const spanId = sanitizeCorrelationId(input.spanId) || `span-${randomUUID()}`;
  const parentSpanId = sanitizeCorrelationId(input.parentSpanId) || undefined;

  return {
    requestId,
    traceId,
    spanId,
    parentSpanId,
    startedAt: Date.now(),
  };
}

export function childCorrelationSpan(parent: CorrelationContext, suffix = ""): CorrelationContext {
  return createCorrelationContext({
    requestId: parent.requestId,
    traceId: parent.traceId,
    spanId: `span-${randomUUID()}${suffix ? `-${sanitizeCorrelationId(suffix)}` : ""}`,
    parentSpanId: parent.spanId,
  });
}

export default createCorrelationContext;
