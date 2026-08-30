/* ==== Principal Context — identidad autenticada transitiva ==== */

import type { AuthenticatedPrincipal } from "../../lib/auth.server";

export type PrincipalKind = "jwt" | "api-key" | "system";

export interface PrincipalContext {
  readonly sub: string;
  readonly tenantId: string;
  readonly roles: readonly string[];
  readonly scopes: readonly string[];
  readonly kind: PrincipalKind;
  readonly apiKeyId?: string;
}

/**
 * Deriva un PrincipalContext SOLO desde una identidad ya autenticada
 * (AuthenticatedPrincipal). No acepta identidad desde inputs de cara al
 * usuario: el principal establecido por el middleware de autenticación es la
 * única fuente de confianza.
 */
export function createPrincipalContext(principal: AuthenticatedPrincipal): PrincipalContext {
  return {
    sub: principal.sub,
    tenantId: principal.tenantId,
    roles: Object.freeze([...principal.roles]),
    scopes: Object.freeze([...principal.scopes]),
    kind: principal.kind ?? (principal.apiKeyId ? "api-key" : "jwt"),
    apiKeyId: principal.apiKeyId,
  };
}

export function isSystemPrincipal(ctx: PrincipalContext): boolean {
  return ctx.roles.includes("system");
}

export function hasRole(ctx: PrincipalContext, role: string): boolean {
  return ctx.roles.includes(role);
}

export function hasAnyRole(ctx: PrincipalContext, roles: readonly string[]): boolean {
  return roles.some((role) => ctx.roles.includes(role));
}

export function hasScope(ctx: PrincipalContext, scope: string): boolean {
  // Wildcard "*" solo para rol system (misma regla que auth.server).
  if (ctx.scopes.includes("*")) return isSystemPrincipal(ctx);
  return ctx.scopes.includes(scope);
}

export default createPrincipalContext;
