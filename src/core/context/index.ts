/* ==== Context Barrel — composición transitiva por request ==== */

import { createCorrelationContext, childCorrelationSpan } from "./correlation-context";
import type { CorrelationContext, CorrelationInput } from "./correlation-context";
import { createPrincipalContext } from "./principal-context";
import type { PrincipalContext } from "./principal-context";
import { createTenantContext, tenantIdsEqual, assertTenantMatch } from "./tenant-context";
import type { TenantContext } from "./tenant-context";
import { createPolicyDecisionContext } from "./policy-context";
import type { PolicyDecisionContext } from "./policy-context";
import type { PdpDecision } from "../../lib/authz-runtime/client";
import type { AuthenticatedPrincipal } from "../../lib/auth.server";

export interface RequestFlowContext {
  readonly correlation: CorrelationContext;
  readonly tenant: TenantContext;
  readonly principal?: PrincipalContext;
  readonly policy?: PolicyDecisionContext;
}

export type PolicyDecisionInput = PdpDecision;

export interface RequestFlowInput extends CorrelationInput {
  readonly principal?: AuthenticatedPrincipal;
  readonly policy?: PolicyDecisionInput | null;
  readonly requiredScope?: string;
}

/**
 * Compone el contexto completo de un request: correlación + tenant + principal
 * + decisión de policy. Transitivo por naturaleza: los hijos derivan del padre
 * sin re-autenticar.
 */
export function createRequestFlowContext(input: RequestFlowInput): RequestFlowContext {
  const correlation = createCorrelationContext(input);
  const tenant = input.principal
    ? createTenantContext(input.principal.tenantId)
    : createTenantContext("nodo-cero-rdm");

  const principal = input.principal
    ? createPrincipalContext(input.principal)
    : undefined;

  const policy =
    input.principal && input.policy !== undefined
      ? createPolicyDecisionContext(input.policy, input.requiredScope ?? "")
      : undefined;

  return { correlation, tenant, principal, policy };
}

export function deriveChildFlow(
  parent: RequestFlowContext,
  suffix = "",
): RequestFlowContext {
  return {
    correlation: childCorrelationSpan(parent.correlation, suffix),
    tenant: parent.tenant,
    principal: parent.principal,
    policy: parent.policy,
  };
}

export {
  createCorrelationContext,
  childCorrelationSpan,
  createPrincipalContext,
  createTenantContext,
  tenantIdsEqual,
  assertTenantMatch,
  createPolicyDecisionContext,
};

export type { CorrelationContext, CorrelationInput, PrincipalContext, TenantContext, PolicyDecisionContext };
