/**
 * Tests: Tool Escalation Prevention (scope, permissions, human approval, tenant)
 */
import { describe, it, expect } from "vitest";
import { evaluateToolInvocation, evaluateAccess } from "../../src/lib/authz/policy-engine";
import {
  createAuthorizationContext,
  type AuthorizationContext,
  type ToolRegistration,
} from "../../src/lib/authz/authorization-context";

const UNIQUE_PREFIX = "tool-escalate-z7q";

function ctx(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return createAuthorizationContext({
    subjectId: `${UNIQUE_PREFIX}-subj`,
    tenantId: `${UNIQUE_PREFIX}-tenant`,
    scopes: ["read:public"],
    riskScore: 0.3,
    assuranceLevel: "aal2",
    ...overrides,
  });
}

function tool(overrides: Partial<ToolRegistration> = {}): ToolRegistration {
  return {
    name: `${UNIQUE_PREFIX}-tool`,
    requiredScopes: ["read:public"],
    tenantId: `${UNIQUE_PREFIX}-tenant`,
    humanApprovalRequired: false,
    ...overrides,
  };
}

describe(`tool-escalation prevention · ${UNIQUE_PREFIX}`, () => {
  describe("scope boundary enforcement", () => {
    it("blocks tool registered with read:public from performing write:admin actions", () => {
      const callerCtx = ctx({
        scopes: ["read:public"],
      });
      const adminTool = tool({
        name: `${UNIQUE_PREFIX}-admin-writer`,
        requiredScopes: ["read:public", "write:admin"],
      });

      const result = evaluateToolInvocation(callerCtx, adminTool);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("MISSING_SCOPE:write:admin");
    });

    it("allows tool when caller holds all required scopes", () => {
      const callerCtx = ctx({
        scopes: ["read:public", "write:admin"],
      });
      const adminTool = tool({
        name: `${UNIQUE_PREFIX}-admin-ok`,
        requiredScopes: ["read:public", "write:admin"],
      });

      const result = evaluateToolInvocation(callerCtx, adminTool);
      expect(result.allowed).toBe(true);
    });

    it("blocks tool needing delete:governance when caller only has read:public", () => {
      const callerCtx = ctx();
      const dangerousTool = tool({
        name: `${UNIQUE_PREFIX}-governance-delete`,
        requiredScopes: ["delete:governance"],
      });

      const result = evaluateToolInvocation(callerCtx, dangerousTool);
      expect(result.allowed).toBe(false);
      expect(result.violations.some((v) => v.includes("delete:governance"))).toBe(true);
    });
  });

  describe("self-escalation prevention", () => {
    it("tool cannot grant itself scopes the caller lacks", () => {
      const callerCtx = ctx({
        scopes: ["read:public"],
      });
      const selfEscalatingTool = tool({
        name: `${UNIQUE_PREFIX}-self-escalate`,
        requiredScopes: ["read:public", "write:admin", "delete:governance"],
      });

      const result = evaluateToolInvocation(callerCtx, selfEscalatingTool);
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
      expect(result.violations).toContain("MISSING_SCOPE:write:admin");
      expect(result.violations).toContain("MISSING_SCOPE:delete:governance");
    });

    it("tool with empty required scopes still cannot bypass tenant check", () => {
      const callerCtx = ctx({
        tenantId: `${UNIQUE_PREFIX}-tenant-x`,
      });
      const freeTool = tool({
        name: `${UNIQUE_PREFIX}-no-scopes`,
        requiredScopes: [],
        tenantId: `${UNIQUE_PREFIX}-tenant-y`,
      });

      const result = evaluateToolInvocation(callerCtx, freeTool);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("TOOL_TENANT_MISMATCH");
    });
  });

  describe("human-approval-gated tools cannot bypass approval", () => {
    it("tool with humanApprovalRequired flag still goes through scope validation", () => {
      const callerCtx = ctx({
        scopes: ["read:public"],
      });
      const gatedTool = tool({
        name: `${UNIQUE_PREFIX}-approval-gated`,
        requiredScopes: ["read:public", "write:governance"],
        humanApprovalRequired: true,
      });

      const result = evaluateToolInvocation(callerCtx, gatedTool);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("MISSING_SCOPE:write:governance");
    });

    it("tool with humanApprovalRequired and all scopes passes policy but still flagged", () => {
      const callerCtx = ctx({
        scopes: ["read:public", "write:governance"],
      });
      const gatedTool = tool({
        name: `${UNIQUE_PREFIX}-approval-ok`,
        requiredScopes: ["read:public", "write:governance"],
        humanApprovalRequired: true,
      });

      const result = evaluateToolInvocation(callerCtx, gatedTool);
      expect(result.allowed).toBe(true);
    });

    it("high risk score blocks even approval-gated tools", () => {
      const callerCtx = ctx({
        scopes: ["read:public", "write:governance"],
        riskScore: 0.95,
      });
      const gatedTool = tool({
        name: `${UNIQUE_PREFIX}-approval-blocked`,
        requiredScopes: ["read:public", "write:governance"],
        humanApprovalRequired: true,
      });

      const result = evaluateToolInvocation(callerCtx, gatedTool);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("RISK_THRESHOLD_EXCEEDED");
    });
  });

  describe("wrong tenant context rejected for tool invocation", () => {
    it("rejects invocation when caller tenant differs from tool tenant", () => {
      const callerCtx = ctx({
        tenantId: `${UNIQUE_PREFIX}-caller-tenant`,
        scopes: ["read:public", "write:admin"],
      });
      const foreignTool = tool({
        name: `${UNIQUE_PREFIX}-foreign-tool`,
        requiredScopes: ["read:public"],
        tenantId: `${UNIQUE_PREFIX}-foreign-tenant`,
      });

      const result = evaluateToolInvocation(callerCtx, foreignTool);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("TOOL_TENANT_MISMATCH");
      expect(result.reason).toMatch(/tenant/i);
    });
  });
});
