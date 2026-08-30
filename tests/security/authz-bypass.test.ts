/**
 * Tests: Authorization Bypass (policy engine invariants)
 */
import { describe, it, expect } from "vitest";
import { evaluateAccess, evaluateToolInvocation } from "../../src/lib/authz/policy-engine";
import {
  createAuthorizationContext,
  type AuthorizationContext,
  type ResourceDescriptor,
  type ToolRegistration,
} from "../../src/lib/authz/authorization-context";

const UNIQUE_PREFIX = "authz-bypass-xk9";

function tenantResource(tenantId: string, classification: ResourceDescriptor["classification"] = "public", scopes: string[] = ["read:public"]): ResourceDescriptor {
  return { tenantId, classification, requiredScopes: scopes };
}

function toolReg(overrides: Partial<ToolRegistration> = {}): ToolRegistration {
  return {
    name: "tool-default",
    requiredScopes: ["read:public"],
    tenantId: "tenant-iso-rdm",
    humanApprovalRequired: false,
    ...overrides,
  };
}

describe(`authorization-bypass · ${UNIQUE_PREFIX}`, () => {
  describe("tenant mismatch rejection", () => {
    it("rejects subject when tenantIds differ", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-01`,
        tenantId: "tenant-alpha",
      });
      const resource = tenantResource("tenant-beta");

      const result = evaluateAccess(ctx, resource);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("TENANT_MISMATCH");
    });

    it("rejects cross-tenant tool invocation", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-02`,
        tenantId: "tenant-alpha",
        scopes: ["read:public", "write:admin"],
      });
      const tool = toolReg({ tenantId: "tenant-beta", requiredScopes: ["read:public"] });

      const result = evaluateToolInvocation(ctx, tool);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("TOOL_TENANT_MISMATCH");
    });
  });

  describe("scope enforcement", () => {
    it("rejects subject with insufficient scopes", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-03`,
        scopes: ["read:public"],
      });
      const resource = tenantResource("tenant-iso-rdm", "public", ["read:public", "write:admin"]);

      const result = evaluateAccess(ctx, resource);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("MISSING_SCOPE:write:admin");
    });

    it("rejects tool caller missing required scope", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-04`,
        scopes: ["read:public"],
      });
      const tool = toolReg({ requiredScopes: ["read:public", "delete:governance"] });

      const result = evaluateToolInvocation(ctx, tool);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("MISSING_SCOPE:delete:governance");
    });
  });

  describe("risk threshold blocking", () => {
    it("blocks authorization when riskScore > 0.8", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-05`,
        riskScore: 0.85,
      });
      const resource = tenantResource("tenant-iso-rdm");

      const result = evaluateAccess(ctx, resource);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("RISK_THRESHOLD_EXCEEDED");
    });

    it("allows when riskScore is exactly 0.8", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-06`,
        riskScore: 0.8,
      });
      const resource = tenantResource("tenant-iso-rdm");

      const result = evaluateAccess(ctx, resource);
      expect(result.allowed).toBe(true);
    });

    it("blocks tool invocation when riskScore > 0.8", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-07`,
        riskScore: 0.91,
        scopes: ["read:public"],
      });
      const tool = toolReg({ requiredScopes: ["read:public"] });

      const result = evaluateToolInvocation(ctx, tool);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("RISK_THRESHOLD_EXCEEDED");
    });
  });

  describe("expired session rejection", () => {
    it("rejects subject with expired session", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-08`,
        sessionExpiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      const resource = tenantResource("tenant-iso-rdm");

      const result = evaluateAccess(ctx, resource);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("SESSION_EXPIRED");
    });

    it("rejects tool invocation with expired session", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-09`,
        sessionExpiresAt: new Date(Date.now() - 60000).toISOString(),
        scopes: ["read:public"],
      });
      const tool = toolReg({ requiredScopes: ["read:public"] });

      const result = evaluateToolInvocation(ctx, tool);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("SESSION_EXPIRED");
    });
  });

  describe("assurance level gating for restricted resources", () => {
    it("denies aal1 subject access to restricted resource", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-10`,
        assuranceLevel: "aal1",
        scopes: ["read:public", "write:admin"],
      });
      const resource = tenantResource("tenant-iso-rdm", "restricted", ["read:public"]);

      const result = evaluateAccess(ctx, resource);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("INSUFFICIENT_ASSURANCE");
    });

    it("denies aal0 subject access to restricted resource", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-11`,
        assuranceLevel: "aal0",
        scopes: ["read:public"],
      });
      const resource = tenantResource("tenant-iso-rdm", "restricted", ["read:public"]);

      const result = evaluateAccess(ctx, resource);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("INSUFFICIENT_ASSURANCE");
    });

    it("allows aal2 subject access to restricted resource", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-12`,
        assuranceLevel: "aal2",
        scopes: ["read:public"],
      });
      const resource = tenantResource("tenant-iso-rdm", "restricted", ["read:public"]);

      const result = evaluateAccess(ctx, resource);
      expect(result.allowed).toBe(true);
    });

    it("allows aal3 subject access to restricted resource", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-13`,
        assuranceLevel: "aal3",
        scopes: ["read:public"],
      });
      const resource = tenantResource("tenant-iso-rdm", "restricted", ["read:public"]);

      const result = evaluateAccess(ctx, resource);
      expect(result.allowed).toBe(true);
    });
  });

  describe("happy path — valid context passes", () => {
    it("allows a fully valid context", () => {
      const ctx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-14`,
        tenantId: "tenant-iso-rdm",
        scopes: ["read:public", "write:admin"],
        riskScore: 0.4,
        assuranceLevel: "aal2",
      });
      const resource = tenantResource("tenant-iso-rdm", "internal", ["read:public"]);

      const result = evaluateAccess(ctx, resource);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
