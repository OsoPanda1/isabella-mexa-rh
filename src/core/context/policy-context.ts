/* ==== Policy Decision Context — decisión de policy transitiva ==== */

import type { PdpDecision } from "../../lib/authz-runtime/client";

export interface PolicyDecisionContext {
  readonly allowed: boolean;
  readonly code: string;
  readonly reason: string;
  readonly principal?: string;
  readonly tenantId?: string;
  readonly requiredScope: string;
  readonly matchedScope?: string | null;
  readonly obligations: readonly string[];
  readonly policyVersion?: string;
  readonly expiresAt?: number;
  readonly decidedAt: number;
}

/**
 * Normaliza una decisión del PDP (o un fallo local fail-closed) en un contexto
 * inmutable para propagar de forma transitiva a capas posteriores (auditoría,
 * tool dispatch, outbox, etc.).
 */
export function createPolicyDecisionContext(
  decision: PdpDecision | null,
  requiredScope: string,
): PolicyDecisionContext {
  if (!decision) {
    return {
      allowed: false,
      code: "PDP_UNAVAILABLE",
      reason: "Policy Decision Point sin respuesta; fail-closed.",
      requiredScope,
      obligations: [],
      decidedAt: Date.now(),
    };
  }

  return {
    allowed: decision.status === "ALLOW" && decision.decision.allowed,
    code: decision.decision.code,
    reason: decision.decision.reason,
    principal: decision.decision.principal,
    tenantId: decision.decision.tenantId,
    requiredScope,
    matchedScope: decision.decision.matchedScope,
    obligations: Object.freeze(decision.decision.obligations ?? []),
    policyVersion: decision.decision.policyVersion,
    expiresAt: decision.decision.expiresAt,
    decidedAt: Date.now(),
  };
}

export function policyAllows(ctx: PolicyDecisionContext): boolean {
  return ctx.allowed;
}

export default createPolicyDecisionContext;
