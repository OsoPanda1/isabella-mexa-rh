import type { VercelRequest } from "@vercel/node";
import { GATEWAY_CONFIG } from "./config";
import { ALLOWED_METHODS, isMethodAllowed } from "../../lib/http-methods";
import { resolveAllowedOrigin } from "./cors-policy";

export class GatewayFirewallError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "GatewayFirewallError";
  }
}

const isStateChanging = (method: string): boolean =>
  ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());

export const validateRequestShape = (req: VercelRequest): void => {
  const urlLength = req.url?.length ?? 0;
  if (urlLength > GATEWAY_CONFIG.maxUrlLength) {
    throw new GatewayFirewallError(414, "URL_TOO_LONG", "La URL excede el límite permitido.");
  }

  const method = (req.method ?? "UNKNOWN").toUpperCase();
  if (!isMethodAllowed(method)) {
    throw new GatewayFirewallError(
      405,
      "METHOD_NOT_ALLOWED",
      `Método ${method} no permitido. Permitidos: ${ALLOWED_METHODS.join(", ")}`,
    );
  }

  if (isStateChanging(method) && GATEWAY_CONFIG.requireOriginForMutations) {
    const origin = resolveAllowedOrigin(req);
    if (!origin) {
      throw new GatewayFirewallError(
        403,
        "ORIGIN_REQUIRED",
        "Se requiere un origen válido y permitido para operaciones de mutación de estado.",
      );
    }
  }

  // Check content-length against maxBodyBytes if present
  const contentLength = Number(req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > GATEWAY_CONFIG.maxBodyBytes) {
    throw new GatewayFirewallError(
      413,
      "PAYLOAD_TOO_LARGE",
      "El cuerpo de la solicitud supera el límite máximo permitido.",
    );
  }
};
