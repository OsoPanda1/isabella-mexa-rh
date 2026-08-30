/* ==== Scopes — verificación granular de permisos de conector (CIX) ==== */
/**
 * Un conector solo puede ejecutar operaciones cuyo scope esté declarado en su
 * manifest y, además, hagapartido del request (otorgado por el principal
 * autenticado). Nunca "*": los scopes deben ser granulares.
 */
import type { ConnectorManifest } from "./connector-manifest";

export type ScopeSet = ReadonlySet<string>;

export function scopeSet(scopes: readonly string[]): ScopeSet {
  return new Set(scopes);
}

/**
 * El conector puede ejecutar `requiredScope` si:
 *  - el scope está en su manifest, y
 *  - el scope está entre los otorgados en la llamada.
 */
export function canCallScope(
  manifest: ConnectorManifest,
  granted: ScopeSet,
  requiredScope: string,
): boolean {
  return manifest.scopes.includes(requiredScope) && granted.has(requiredScope);
}
