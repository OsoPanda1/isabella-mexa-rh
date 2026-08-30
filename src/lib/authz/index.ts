/**
 * Isabella Authorization Framework — Barrel
 * Punto de entrada único para el motor de autorización.
 * Evalúa decisiones de acceso: tenant match, scopes, riesgo, sesiones, assurance level.
 */

export {
  type AssuranceLevel,
  type DataClassification,
  type AuthorizationContext,
  type ResourceDescriptor,
  type ToolRegistration,
  createAuthorizationContext,
} from "./authorization-context";

export {
  type PolicyDecision,
  evaluateAccess,
  evaluateToolInvocation,
} from "./policy-engine";
