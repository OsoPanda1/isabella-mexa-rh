/* ==== Tenant Context — aislamiento por tenant transitivo ==== */

import { timingSafeEqual } from "node:crypto";

export interface TenantContext {
  readonly tenantId: string;
  readonly trusted: boolean;
}

const TENANT_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

export function sanitizeTenantId(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  return TENANT_ID_RE.test(trimmed) ? trimmed : "";
}

export function createTenantContext(tenantId: string): TenantContext {
  const normalized = sanitizeTenantId(tenantId);
  return {
    tenantId: normalized || "nodo-cero-rdm",
    trusted: Boolean(normalized),
  };
}

/**
 * Comparación segura de tenantId (tiempo constante) para evitar side channels
 * de timing en decisiones de aislamiento.
 */
export function tenantIdsEqual(a: string, b: string): boolean {
  const left = sanitizeTenantId(a);
  const right = sanitizeTenantId(b);
  if (!left || !right) return false;
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  return leftBuf.length === rightBuf.length && timingSafeEqual(leftBuf, rightBuf);
}

/**
 * Verifica que un recurso pertenezca al tenant autorizado. Devuelve false si
 * hay mismatch (o si alguno es inválido). Uso recomendado en la capa de datos
 * como invariante de aislamiento (ADR-0003).
 */
export function assertTenantMatch(principalTenant: string, resourceTenant: string): boolean {
  return tenantIdsEqual(principalTenant, resourceTenant);
}

export default createTenantContext;
