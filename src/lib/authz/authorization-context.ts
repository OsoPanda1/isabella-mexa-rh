/**
 * AUTHORIZATION CONTEXT - ISABELLA AUTHZ MODULE
 * Defines the minimal types and factory for authorization subjects and resources.
 * Core invariants: tenant match, scope containment, assurance level, session freshness.
 */

export type AssuranceLevel = "aal0" | "aal1" | "aal2" | "aal3";

export type DataClassification = "public" | "internal" | "restricted" | "confidential";

export interface AuthorizationContext {
  tenantId: string;
  subjectId: string;
  scopes: string[];
  riskScore: number;
  assuranceLevel: AssuranceLevel;
  sessionExpiresAt: string;
  sessionId: string;
}

export interface ResourceDescriptor {
  tenantId: string;
  classification: DataClassification;
  requiredScopes: string[];
}

export interface ToolRegistration {
  name: string;
  requiredScopes: string[];
  tenantId: string;
  humanApprovalRequired: boolean;
}

export function createAuthorizationContext(
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext {
  return {
    tenantId: "tenant-iso-rdm",
    subjectId: "subject-default",
    scopes: ["read:public"],
    riskScore: 0.3,
    assuranceLevel: "aal2",
    sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(),
    sessionId: `sess-actx-${Date.now()}`,
    ...overrides,
  };
}
