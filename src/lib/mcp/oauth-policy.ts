/* ==== OAuth / Credential Policy — matriculación, expiración y rotación (CIX) ==== */
/**
 * Un conector con `auth.oauth` exige un token matriculado a través de
 * `mountCredential`. El registry no interpreta el token; solo registra su
 * presencia, expiración y versionado para poder:
 *   - denegar llamadas con credencial ausente/expirada/revocada,
 *   - forzar rotación cuando el secreto rota (kind "rotated").
 * El token nunca se serializa al log ni al audit: solo se guarda un digest.
 */
import { createHash } from "node:crypto";
import type { ConnectorManifest } from "./connector-manifest";

export interface ConnectorCredential {
  readonly connectorId: string;
  readonly kind: "active" | "rotated" | "revoked" | "missing";
  readonly digest: string; // sha256 del secreto/token — nunca el secreto en claro
  readonly expiresAt: number | null;
  readonly rotatedAt: number | null;
  readonly revokedAt: number | null;
}

export interface MountCredentialInput {
  readonly connectorId: string;
  readonly token?: string;
  readonly expiresInMs?: number;
}

export function credentialDigest(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function createCredential(input: MountCredentialInput): ConnectorCredential {
  if (!input.token) {
    return {
      connectorId: input.connectorId,
      kind: "missing",
      digest: "",
      expiresAt: null,
      rotatedAt: null,
      revokedAt: null,
    };
  }
  return {
    connectorId: input.connectorId,
    kind: "active",
    digest: credentialDigest(input.token),
    expiresAt: input.expiresInMs ? Date.now() + input.expiresInMs : null,
    rotatedAt: null,
    revokedAt: null,
  };
}

export function rotateCredential(current: ConnectorCredential, newToken: string): ConnectorCredential {
  return {
    ...current,
    kind: "active",
    digest: credentialDigest(newToken),
    rotatedAt: Date.now(),
    revokedAt: null,
  };
}

export function revokeCredential(current: ConnectorCredential): ConnectorCredential {
  return {
    ...current,
    kind: "revoked",
    revokedAt: Date.now(),
  };
}

export function credentialIsUsable(credential: ConnectorCredential | undefined, manifest: ConnectorManifest): boolean {
  if (!manifest.auth.oauth) return true; // conector sin OAuth no exige token
  if (!credential) return false;
  if (credential.kind !== "active") return false;
  if (credential.expiresAt && credential.expiresAt < Date.now()) return false;
  return true;
}
