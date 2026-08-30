import type { VercelResponse } from "@vercel/node";
import type { RequestContext } from "./request-context";

export type FailureClass =
  | "NONE"
  | "CLIENT"
  | "AUTH"
  | "POLICY"
  | "RATE_LIMIT"
  | "UPSTREAM"
  | "TIMEOUT"
  | "CIRCUIT_OPEN"
  | "INTERNAL";

export interface IsabellaErrorBody {
  error: {
    code: string;
    message: string;
    trace_id: string;
    retryable: boolean;
    failure_class: FailureClass;
  };
}

export interface NormalizedGatewayError {
  status: number;
  code: string;
  message: string;
  retryable: boolean;
  failureClass: FailureClass;
}

export const normalizeGatewayError = (
  error: unknown,
  fallbackStatus = 500,
): NormalizedGatewayError => {
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    const status =
      typeof err.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : fallbackStatus;
    const code = typeof err.code === "string" ? err.code : "INTERNAL_ERROR";
    const message =
      typeof err.message === "string" && err.message.length > 0
        ? err.message
        : "Error interno del gateway de Isabella.";

    let failureClass: FailureClass = "INTERNAL";
    let retryable = false;

    if (status === 401 || status === 403) {
      failureClass = "AUTH";
    } else if (status === 429) {
      failureClass = "RATE_LIMIT";
      retryable = true;
    } else if (status === 504 || code === "REQUEST_TIMEOUT") {
      failureClass = "TIMEOUT";
      retryable = true;
    } else if (status === 503 || code === "SERVICE_TEMPORARILY_UNAVAILABLE") {
      failureClass = "CIRCUIT_OPEN";
      retryable = true;
    } else if (status >= 400 && status < 500) {
      failureClass = "CLIENT";
    } else if (status >= 502 && status <= 504) {
      failureClass = "UPSTREAM";
      retryable = true;
    }

    return { status, code, message, retryable, failureClass };
  }

  return {
    status: fallbackStatus,
    code: "INTERNAL_ERROR",
    message: "Ocurrió un error inesperado al procesar la solicitud.",
    retryable: false,
    failureClass: "INTERNAL",
  };
};

export const writeGatewayError = (
  res: VercelResponse,
  error: unknown,
  context: RequestContext,
): void => {
  if (res.headersSent || res.writableEnded) return;

  const normalized = normalizeGatewayError(error);

  const body: IsabellaErrorBody = {
    error: {
      code: normalized.code,
      message: normalized.status >= 500 ? "No se pudo completar la operación." : normalized.message,
      trace_id: context.traceId,
      retryable: normalized.retryable,
      failure_class: normalized.failureClass,
    },
  };

  res.status(normalized.status).json(body);
};
