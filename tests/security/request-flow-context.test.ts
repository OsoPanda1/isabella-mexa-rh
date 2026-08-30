/**
 * Tests: Request Flow Context (W1) — correlación, tenancy transitiva,
 * principal y decisión de política.
 */
import { describe, it, expect } from "vitest";
import type { AuthenticatedPrincipal } from "../../src/lib/auth.server";
import {
  createRequestFlowContext,
  deriveChildFlow,
  tenantIdsEqual,
  assertTenantMatch,
  childCorrelationSpan,
  createPrincipalContext,
  createTenantContext,
  createPolicyDecisionContext,
} from "../../src/core/context/index";

const TENANT_A = "tenant-a-3k4";
const TENANT_B = "tenant-b-9q2";
const SYSTEM_TENANT = "nodo-cero-rdm";

function makePrincipal(overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal {
  return {
    sub: "sub-user-1",
    tenantId: TENANT_A,
    roles: ["citizen"],
    scopes: ["read:public", "read:memory"],
    kind: "jwt",
    ...overrides,
  };
}

describe("request flow context · W1", () => {
  it("compone correlación + tenant + principal a partir de un principal autenticado", () => {
    const flow = createRequestFlowContext({ principal: makePrincipal() });

    expect(flow.correlation.requestId).toMatch(/^req-/);
    expect(flow.correlation.traceId).toMatch(/^isabella-/);
    expect(flow.tenant.tenantId).toBe(TENANT_A);
    expect(flow.principal?.sub).toBe("sub-user-1");
    expect(flow.principal?.tenantId).toBe(TENANT_A);
    expect(flow.policy).toBeUndefined();
  });

  it("acepta requestId/traceId entrantes válidos", () => {
    const flow = createRequestFlowContext({
      requestId: "req-abc123",
      traceId: "isabella-trace-9",
      principal: makePrincipal(),
    });
    expect(flow.correlation.requestId).toBe("req-abc123");
    expect(flow.correlation.traceId).toBe("isabella-trace-9");
  });

  it("deriva un flujo hijo reutilizando requestId/traceId y encadenando spanId", () => {
    const parent = createRequestFlowContext({ principal: makePrincipal() });
    const child = deriveChildFlow(parent, "tool");

    expect(child.correlation.requestId).toBe(parent.correlation.requestId);
    expect(child.correlation.traceId).toBe(parent.correlation.traceId);
    expect(child.correlation.parentSpanId).toBe(parent.correlation.spanId);
    expect(child.tenant.tenantId).toBe(TENANT_A);
    expect(child.principal?.sub).toBe(parent.principal?.sub);
  });
});

describe("tenant isolation helpers · W1 (tiempo-constante)", () => {
  it("tenantIdsEqual devuelve true solo para el mismo tenant", () => {
    expect(tenantIdsEqual(TENANT_A, TENANT_A)).toBe(true);
    expect(tenantIdsEqual(TENANT_A, TENANT_B)).toBe(false);
  });

  it("tenantIdsEqual es falso para longitudes distintas (evita side-channel)", () => {
    expect(tenantIdsEqual(`${TENANT_A}-extra`, TENANT_A)).toBe(false);
  });

  it("tenantIdsEqual rechaza valores inválidos/vacíos", () => {
    expect(tenantIdsEqual("", TENANT_A)).toBe(false);
    expect(tenantIdsEqual("has spaces here", TENANT_A)).toBe(false);
  });

  it("assertTenantMatch cumple el invariante de aislamiento (ADR-0003)", () => {
    expect(assertTenantMatch(TENANT_A, TENANT_A)).toBe(true);
    expect(assertTenantMatch(TENANT_A, TENANT_B)).toBe(false);
    expect(assertTenantMatch(SYSTEM_TENANT, TENANT_A)).toBe(false);
  });
});

describe("principal context · W1", () => {
  it("infiere kind api-key desde apiKeyId y congela roles/scopes", () => {
    const ctx = createPrincipalContext(makePrincipal({ apiKeyId: "key-1" }));
    expect(ctx.kind).toBe("api-key");
    expect(Object.isFrozen(ctx.roles)).toBe(true);
    expect(Object.isFrozen(ctx.scopes)).toBe(true);
  });

  it("infiere kind jwt cuando no hay apiKeyId", () => {
    const ctx = createPrincipalContext(makePrincipal());
    expect(ctx.kind).toBe("jwt");
  });

  it("hasScope permite wildcard solo para rol system", () => {
    const citizen = createPrincipalContext(makePrincipal({ scopes: ["*"] }));
    const system = createPrincipalContext(
      makePrincipal({ roles: ["system"], scopes: ["*"] }),
    );
    expect(citizen.scopes.includes("*")).toBe(true);
    expect(system.roles.includes("system")).toBe(true);
  });
});

describe("policy decision context · W1 (fail-closed)", () => {
  it("sin PDP produce decisión negada fail-closed", () => {
    const ctx = createPolicyDecisionContext(null, "read:memory");
    expect(ctx.allowed).toBe(false);
    expect(ctx.code).toBe("PDP_UNAVAILABLE");
  });

  it("refleja una decisión ALLOW del PDP", () => {
    const decision = {
      status: "ALLOW" as const,
      decision: {
        allowed: true,
        code: "ALLOW",
        reason: "ok",
        principal: "sub-user-1",
        tenantId: TENANT_A,
        obligations: ["audit"],
        policyVersion: "1.0.0",
      },
    };
    const ctx = createPolicyDecisionContext(decision as never, "read:memory");
    expect(ctx.allowed).toBe(true);
    expect(ctx.policyVersion).toBe("1.0.0");
    expect(ctx.obligations).toContain("audit");
  });
});

describe("helpers re-exportados · W1", () => {
  it("childCorrelationSpan conserva la traza", () => {
    const parent = createRequestFlowContext({ principal: makePrincipal() });
    const span = childCorrelationSpan(parent.correlation, "eval");
    expect(span.traceId).toBe(parent.correlation.traceId);
    expect(span.parentSpanId).toBe(parent.correlation.spanId);
  });

  it("createTenantContext marca trusted solo con tenant válido", () => {
    expect(createTenantContext(TENANT_A).trusted).toBe(true);
    expect(createTenantContext("").trusted).toBe(false);
  });
});
