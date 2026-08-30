import type { IncomingHttpHeaders } from "node:http";

export interface IsabellaFlagContext {
  readonly userId: string;
  readonly tenantId?: string;
  readonly role?: string;
  readonly environment: "development" | "preview" | "staging" | "production";
  readonly federations?: string[];
}

function safeIdentifier(value: string | string[] | undefined, fallback: string): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return fallback;
  return /^[a-zA-Z0-9._:@-]{1,128}$/.test(candidate) ? candidate : fallback;
}

export function getFlagContext(headers: IncomingHttpHeaders): IsabellaFlagContext {
  const userId = safeIdentifier(headers["x-user-id"], "anonymous");
  const tenantId = safeIdentifier(headers["x-tenant-id"], "nodo-cero-rdm");
  const role = safeIdentifier(headers["x-user-role"], "member");

  const envRaw = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
  const environment =
    envRaw === "production"
      ? "production"
      : envRaw === "preview"
        ? "preview"
        : envRaw === "staging"
          ? "staging"
          : "development";

  return {
    userId,
    tenantId,
    role,
    environment,
  };
}
