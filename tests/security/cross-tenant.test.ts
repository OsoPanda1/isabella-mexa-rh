/**
 * Tests: Cross-Tenant Isolation (memory, audit logs, agents, tools)
 */
import { describe, it, expect } from "vitest";
import { evaluateAccess, evaluateToolInvocation } from "../../src/lib/authz/policy-engine";
import {
  createAuthorizationContext,
  type AuthorizationContext,
  type ToolRegistration,
} from "../../src/lib/authz/authorization-context";
import { addMemoryItem, queryMemory, getAllMemories } from "../../src/domains/ai/infrastructure/memory-store";
import { auditTrace, getRecentAuditLogs, clearAuditLogs } from "../../src/domains/ai/infrastructure/audit-tracer";

const UNIQUE_PREFIX = "cross-tenant-m3p";
const TENANT_A = `${UNIQUE_PREFIX}-tenant-a`;
const TENANT_B = `${UNIQUE_PREFIX}-tenant-b`;

describe(`cross-tenant isolation · ${UNIQUE_PREFIX}`, () => {
  describe("memory items are tenant-scoped", () => {
    it("tenant A cannot read tenant B memory via policy engine", async () => {
      const secretItem = await addMemoryItem({
        tenantId: TENANT_B,
        scope: "territorial",
        content: `[${UNIQUE_PREFIX}] Secret data visible only to tenant B`,
        sourceType: "user",
        relevance: 0.95,
      });

      const allMemories = getAllMemories();
      const leaking = allMemories.filter(
        (m) => m.tenantId === TENANT_B && m.content.includes(UNIQUE_PREFIX),
      );
      expect(leaking.length).toBeGreaterThanOrEqual(1);

      const ctxA = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-a1`,
        tenantId: TENANT_A,
        scopes: ["read:public", "read:memory"],
      });

      const policyDecision = evaluateAccess(ctxA, {
        tenantId: TENANT_B,
        classification: "internal",
        requiredScopes: ["read:memory"],
      });

      expect(policyDecision.allowed).toBe(false);
      expect(policyDecision.violations).toContain("TENANT_MISMATCH");
    });

    it("tenant B's own subject can access its own memory via policy engine", async () => {
      const ctxB = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-b1`,
        tenantId: TENANT_B,
        scopes: ["read:public", "read:memory"],
      });

      const policyDecision = evaluateAccess(ctxB, {
        tenantId: TENANT_B,
        classification: "internal",
        requiredScopes: ["read:memory"],
      });

      expect(policyDecision.allowed).toBe(true);
    });
  });

  describe("audit logs are tenant-scoped", () => {
    it("tenant A cannot modify tenant B audit logs via policy engine", async () => {
      await auditTrace({
        tenantId: TENANT_B,
        eventType: `${UNIQUE_PREFIX}.audit.sensitive-operation`,
        data: { summary: `[${UNIQUE_PREFIX}] Sensitive ledger commit for tenant B` },
      });

      const ctxA = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-a2`,
        tenantId: TENANT_A,
        scopes: ["write:admin", "write:audit"],
      });

      const policyDecision = evaluateAccess(ctxA, {
        tenantId: TENANT_B,
        classification: "restricted",
        requiredScopes: ["write:audit"],
      });

      expect(policyDecision.allowed).toBe(false);
      expect(policyDecision.violations).toContain("TENANT_MISMATCH");
    });

    it("tenant B's own subject can write its own audit logs", async () => {
      const ctxB = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-subj-b2`,
        tenantId: TENANT_B,
        scopes: ["write:audit"],
      });

      const policyDecision = evaluateAccess(ctxB, {
        tenantId: TENANT_B,
        classification: "restricted",
        requiredScopes: ["write:audit"],
      });

      expect(policyDecision.allowed).toBe(true);
    });
  });

  describe("agent actions are scoped to agent tenant", () => {
    it("agent from tenant A cannot act on tenant B resources", () => {
      const agentCtx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-agent-a`,
        tenantId: TENANT_A,
        scopes: ["read:public", "write:admin"],
        riskScore: 0.3,
      });

      const resourceOnB = evaluateAccess(agentCtx, {
        tenantId: TENANT_B,
        classification: "internal",
        requiredScopes: ["read:public"],
      });

      expect(resourceOnB.allowed).toBe(false);
      expect(resourceOnB.violations).toContain("TENANT_MISMATCH");
    });

    it("agent from tenant B can act on its own resources", () => {
      const agentCtx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-agent-b`,
        tenantId: TENANT_B,
        scopes: ["read:public", "write:admin"],
        riskScore: 0.2,
      });

      const resourceOnB = evaluateAccess(agentCtx, {
        tenantId: TENANT_B,
        classification: "internal",
        requiredScopes: ["read:public"],
      });

      expect(resourceOnB.allowed).toBe(true);
    });
  });

  describe("tool invocations verify tenant match", () => {
    it("rejects tool invocation when caller and tool differ in tenant", () => {
      const callerCtx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-caller-a`,
        tenantId: TENANT_A,
        scopes: ["read:public", "write:admin"],
      });
      const toolForB: ToolRegistration = {
        name: `${UNIQUE_PREFIX}-tool-b`,
        requiredScopes: ["read:public"],
        tenantId: TENANT_B,
        humanApprovalRequired: false,
      };

      const result = evaluateToolInvocation(callerCtx, toolForB);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain("TOOL_TENANT_MISMATCH");
    });

    it("allows tool invocation when caller and tool share tenant", () => {
      const callerCtx = createAuthorizationContext({
        subjectId: `${UNIQUE_PREFIX}-caller-b`,
        tenantId: TENANT_B,
        scopes: ["read:public"],
      });
      const toolForB: ToolRegistration = {
        name: `${UNIQUE_PREFIX}-tool-b`,
        requiredScopes: ["read:public"],
        tenantId: TENANT_B,
        humanApprovalRequired: false,
      };

      const result = evaluateToolInvocation(callerCtx, toolForB);
      expect(result.allowed).toBe(true);
    });
  });
});
