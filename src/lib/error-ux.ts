/**
 * Isabella Villaseñor AI — Error-to-Experience mapping
 *
 * Converts raw HTTP statuses and transport failures into dignified,
 * user-facing Spanish messages and retry semantics. The terminal never
 * exposes bare status codes to people; it degrades with grace instead.
 */

export type ErrorUxDecision = Readonly<{
  /** Human message without machine noise. */
  message: string;
  /** Whether a single automatic retry is worthwhile. */
  retryable: boolean;
  /** Delay before the automatic retry, in milliseconds. */
  retryDelayMs: number;
}>;

const STATUS_MESSAGES: Readonly<Record<number, string>> = Object.freeze({
  400: "La solicitud está incompleta. Reescribe tu instrucción e inténtalo de nuevo.",
  401: "Tu sesión expiró. Isabella renueva el enlace y continúa.",
  403: "Este espacio requiere credenciales distintas. Verifica tu acceso.",
  405: "El canal cognitivo no reconoce esta operación en el despliegue actual.",
  408: "El canal tardó demasiado en responder. Reintento recomendado.",
  413: "La instrucción supera el tamaño permitido. Divídela en partes.",
  414: "La dirección de la solicitud es demasiado larga para el nodo.",
  429: "El nodo está saturado. Isabella aplica una pausa breve y continúa.",
  500: "El núcleo cognitivo reporta una falla interna. El respaldo autónomo toma el control.",
  502: "El puente hacia el núcleo no responde. Isabella reintenta el enlace.",
  503: "El servicio cognitivo está en mantenimiento temporal. Reintentando con paciencia.",
  504: "El núcleo excedió el tiempo de respuesta. El circuito de defensa se activó.",
});

/** Failures that deserve one automatic retry with jittered backoff. */
const RETRYABLE_STATUSES = new Set([401, 403, 408, 425, 429, 500, 502, 503, 504]);

export function classifyHttpError(status: number): ErrorUxDecision {
  const message =
    STATUS_MESSAGES[status] ??
    (status >= 500
      ? "Fallo del lado del núcleo. Isabella protege la conversación y reintenta."
      : status >= 400
        ? "La solicitud no pudo completarse. Ajusta tu instrucción y reintenta."
        : "Respuesta inesperada del canal cognitivo.");

  return Object.freeze({
    message,
    retryable: RETRYABLE_STATUSES.has(status),
    retryDelayMs: status === 429 ? 2_500 : 1_200,
  });
}

export function classifyTransportError(): ErrorUxDecision {
  return Object.freeze({
    message: "El transporte hacia el nodo se interrumpió. Verifica tu conexión.",
    retryable: true,
    retryDelayMs: 1_500,
  });
}

export function extractHttpStatus(err: unknown): number | null {
  if (err instanceof Error) {
    const match = /HTTP (\d{3})/.exec(err.message);
    if (match) return Number(match[1]);
  }
  return null;
}

export function resolveErrorUx(err: unknown): ErrorUxDecision {
  const status = extractHttpStatus(err);
  if (status !== null) return classifyHttpError(status);
  return classifyTransportError();
}
