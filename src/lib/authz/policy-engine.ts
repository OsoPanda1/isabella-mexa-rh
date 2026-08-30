/**
 * POLICY ENGINE - ISABELLA AUTHZ MODULE
 * Evaluates authorization decisions enforcing tenant isolation, scope checks,
 * risk thresholds, session freshness, and assurance-level gating.
 * Fail-closed: any missing invariant returns denied.
 */

import type {
  AuthorizationContext,
  ResourceDescriptor,
  ToolRegistration,
} from "./authorization-context";

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  violations: string[];
}

const RISK_THRESHOLD = 0.8;

const ASSURANCE_RANK: Record<string, number> = {
  aal0: 0,
  aal1: 1,
  aal2: 2,
  aal3: 3,
};

const MIN_ASSURANCE_FOR_RESTRICTED = "aal2";

export function evaluateAccess(
  ctx: AuthorizationContext,
  resource: ResourceDescriptor,
): PolicyDecision {
  const violations: string[] = [];

  if (ctx.tenantId !== resource.tenantId) {
    violations.push("TENANT_MISMATCH");
    return {
      allowed: false,
      reason: "Subject tenant does not match resource tenant",
      violations,
    };
  }

  if (new Date(ctx.sessionExpiresAt).getTime() < Date.now()) {
    violations.push("SESSION_EXPIRED");
    return {
      allowed: false,
      reason: "Session has expired",
      violations,
    };
  }

  if (ctx.riskScore > RISK_THRESHOLD) {
    violations.push("RISK_THRESHOLD_EXCEEDED");
    return {
      allowed: false,
      reason: `Risk score ${ctx.riskScore} exceeds threshold ${RISK_THRESHOLD}`,
      violations,
    };
  }

  for (const required of resource.requiredScopes) {
    if (!ctx.scopes.includes(required)) {
      violations.push(`MISSING_SCOPE:${required}`);
    }
  }
  if (violations.length > 0) {
    return {
      allowed: false,
      reason: "Insufficient scopes for resource",
      violations,
    };
  }

  if (resource.classification === "restricted") {
    const ctxRank = ASSURANCE_RANK[ctx.assuranceLevel] ?? 0;
    const minRank = ASSURANCE_RANK[MIN_ASSURANCE_FOR_RESTRICTED] ?? 2;
    if (ctxRank < minRank) {
      violations.push("INSUFFICIENT_ASSURANCE");
      return {
        allowed: false,
        reason: `Assurance level ${ctx.assuranceLevel} insufficient for restricted resource`,
        violations,
      };
    }
  }

  return {
    allowed: true,
    reason: "All policy checks passed",
    violations: [],
  };
}

export function evaluateToolInvocation(
  callerCtx: AuthorizationContext,
  tool: ToolRegistration,
): PolicyDecision {
  const violations: string[] = [];

  if (callerCtx.tenantId !== tool.tenantId) {
    violations.push("TOOL_TENANT_MISMATCH");
    return {
      allowed: false,
      reason: "Caller tenant does not match tool registration tenant",
      violations,
    };
  }

  if (new Date(callerCtx.sessionExpiresAt).getTime() < Date.now()) {
    violations.push("SESSION_EXPIRED");
    return {
      allowed: false,
      reason: "Session has expired",
      violations,
    };
  }

  if (callerCtx.riskScore > RISK_THRESHOLD) {
    violations.push("RISK_THRESHOLD_EXCEEDED");
    return {
      allowed: false,
      reason: `Risk score ${callerCtx.riskScore} exceeds threshold`,
      violations,
    };
  }

  for (const scope of tool.requiredScopes) {
    if (!callerCtx.scopes.includes(scope)) {
      violations.push(`MISSING_SCOPE:${scope}`);
    }
  }
  if (violations.length > 0) {
    return {
      allowed: false,
      reason: "Caller lacks required scopes for tool",
      violations,
    };
  }

  return {
    allowed: true,
    reason: "Tool invocation approved",
    violations: [],
  };
}
