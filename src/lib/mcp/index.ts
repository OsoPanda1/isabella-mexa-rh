/* ==== MCP / External Integrations — gobernanza de conectores (CIX) ==== */
/**
 * Marco de gobernanza para integraciones externas (MCP, proveedores de
 * modelos, social, search, payments, voice, database, quantum). Cada conector
 * se matricula con un ConnectorManifest y pasa por validación de:
 *   manifest · OAuth policy · scopes · data classification · rate limit ·
 *   timeout · failure policy · circuit breaker · audit · revocación.
 */
export {
  ConnectorManifestSchema,
  FailurePolicySchema,
  NetworkModeSchema,
  validateManifest,
  manifestAllowsDataClass,
} from "./connector-manifest";
export type {
  ConnectorManifest,
  FailurePolicy,
  NetworkMode,
  RequiredScope,
} from "./connector-manifest";

export {
  credentialDigest,
  createCredential,
  rotateCredential,
  revokeCredential,
  credentialIsUsable,
} from "./oauth-policy";
export type { ConnectorCredential, MountCredentialInput } from "./oauth-policy";

export { canCallScope, scopeSet } from "./scopes";
export type { ScopeSet } from "./scopes";

export {
  registerConnector,
  mountConnectorCredential,
  rotateConnectorCredential,
  revokeConnector,
  listConnectors,
  authorizeConnectorCall,
  getAuditLog,
  resetConnectorRegistry,
} from "./registry";
export type { CallRequest, CallDecision, MCPDecisionCode, AuditEntry } from "./registry";
