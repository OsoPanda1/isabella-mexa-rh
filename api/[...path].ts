import type { VercelRequest, VercelResponse } from "@vercel/node";

import { applySecurityHeaders } from "../src/platform/http/gateway";

/*
 * ============================================================================
 * ISABELLA VILLASEÑOR AI — VERCEL SERVERLESS ENTRYPOINT
 * ============================================================================
 * Flujo único: este handler delega TODAS las peticiones al `app` de Express
 * definido en `server.ts` (el mismo runtime que `npm run dev` / `npm start`).
 * Así el despliegue en Vercel usa exactamente la misma superficie de API que
 * el auto-hospedaje, sin reimplementaciones divergentes.
 *
 * El `app` se importa de forma dinámica y cacheada para no arrastrar módulos
 * nativos (better-sqlite3, three) al arranque en frío de rutas que no los
 * requieren, y porque en Vercel `server.ts` NO llama a `app.listen`
 * (ver guarda `if (!process.env.VERCEL)` al final del archivo).
 * ============================================================================
 */

type ExpressHandler = (
  req: VercelRequest,
  res: VercelResponse,
  next: (err?: unknown) => void,
) => void;

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
  maxDuration: 55,
};

let cachedHandler: ExpressHandler | null = null;

async function getHandler(): Promise<ExpressHandler> {
  if (!cachedHandler) {
    const mod = await import("../server");
    cachedHandler = mod.app as unknown as ExpressHandler;
  }
  return cachedHandler;
}

const generateTraceId = (): string =>
  `isabella-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  applySecurityHeaders(res, generateTraceId());

  try {
    const handle = await getHandler();

    handle(req, res, (err?: unknown) => {
      if (err) {
        if (!res.headersSent) {
          res
            .status(500)
            .json({ ok: false, error: "internal_server_error" });
        } else {
          res.end();
        }
        return;
      }

      if (!res.headersSent && !res.writableEnded) {
        res.status(404).json({ ok: false, error: "not_found" });
      }
    });
  } catch {
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: "internal_server_error" });
    }
  }
}
