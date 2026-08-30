/* ==== Tests W2 — MCP / External Integrations Governance (CIX) ==== */
import { describe, it, expect, beforeEach } from "vitest";
import {
  registerConnector,
  mountConnectorCredential,
  rotateConnectorCredential,
  revokeConnector,
  authorizeConnectorCall,
  listConnectors,
  getAuditLog,
  resetConnectorRegistry,
  validateManifest,
  manifestAllowsDataClass,
} from "../../src/lib/mcp/index";
import type { ConnectorManifest } from "../../src/lib/mcp/index";
import type { CallRequest } from "../../src/lib/mcp/index";
import type { DataClass } from "../../src/lib/claim-radar/contracts";

function makeManifest(overrides: Partial<ConnectorManifest> = {}): ConnectorManifest {
  return validateManifest({
    id: "stripe-mcp",
    name: "Stripe Connector",
    version: "1.0.0",
    kind: "payments",
    scopes: ["billing:read", "billing:write"],
    allowedDataClasses: ["public", "internal", "confidential"],
    network: { mode: "allowlist", hosts: ["api.stripe.com"] },
    failurePolicy: "quarantine",
    timeout: { connectMs: 1000, requestMs: 2000 },
    rateLimit: { windowMs: 1000, maxCalls: 5 },
    circuit: { threshold: 3, resetMs: 1000, halfOpenRequests: 1 },
    auth: { oauth: true },
    ...overrides,
  });
}

function call(
  overrides: Partial<CallRequest> = {},
): CallRequest {
  return {
    connectorId: "stripe-mcp",
    requiredScope: "billing:read",
    grantedScopes: new Set(["billing:read", "billing:write"]),
    dataClass: "internal",
    subject: "sub-1",
    tenantId: "tenant-a",
    requestId: "req-1",
    ...overrides,
  };
}

beforeEach(() => {
  resetConnectorRegistry();
});

describe("ConnectorManifest (CIX)", () => {
  it("registra y lista conectores con su estado", () => {
    registerConnector(makeManifest());
    const list = listConnectors();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("stripe-mcp");
    expect(list[0].circuit).toBe("CLOSED");
    expect(list[0].credential).toBe("unset");
  });

  it("rechaza manifests con scope wildcard (deben ser granulares)", () => {
    expect(() => validateManifest(makeManifest({ scopes: ["*"] }))).toThrow();
  });

  it("clasifica datos según allowlist del conector", () => {
    const m = makeManifest();
    expect(manifestAllowsDataClass(m, "confidential" as DataClass)).toBe(true);
    expect(manifestAllowsDataClass(m, "restricted" as DataClass)).toBe(false);
  });

  it("exige manifiesto registrado antes de autorizar", async () => {
    const out = await authorizeConnectorCall(call({ connectorId: "nope" }));
    expect(out.decision.allowed).toBe(false);
    expect(out.decision.code).toBe("CONNECTOR_NOT_FOUND");
  });
});

describe("OAuth policy + revocación (CIX)", () => {
  it("bloquea llamadas de conector OAuth sin credencial matriculada", async () => {
    registerConnector(makeManifest());
    const out = await authorizeConnectorCall(call());
    expect(out.decision.code).toBe("CREDENTIAL_INVALID");
    expect(out.decision.allowed).toBe(false);
  });

  it("permite cuando la credencial está montada y es usable", async () => {
    registerConnector(makeManifest());
    mountConnectorCredential({ connectorId: "stripe-mcp", token: "sk_test_abc", expiresInMs: 3600_000 });
    const out = await authorizeConnectorCall(call(), async () => "ok");
    expect(out.decision.allowed).toBe(true);
    expect(out.result).toBe("ok");
  });

  it("rota y revoca credenciales", async () => {
    registerConnector(makeManifest());
    mountConnectorCredential({ connectorId: "stripe-mcp", token: "old" });
    rotateConnectorCredential("stripe-mcp", "new");
    let out = await authorizeConnectorCall(call(), async () => "ok");
    expect(out.decision.allowed).toBe(true);

    revokeConnector("stripe-mcp");
    out = await authorizeConnectorCall(call(), async () => "ok");
    expect(out.decision.allowed).toBe(false);
    expect(out.decision.code).toBe("CONNECTOR_REVOKED");
  });
});

describe("Scopes (CIX)", () => {
  it("deniega scope no otorgado", async () => {
    registerConnector(makeManifest());
    mountConnectorCredential({ connectorId: "stripe-mcp", token: "t" });
    const out = await authorizeConnectorCall(call({ grantedScopes: new Set(["other:scope"]) }));
    expect(out.decision.code).toBe("SCOPE_DENIED");
  });
});

describe("Data classification (CIX)", () => {
  it("deniega dataClass no permitida por el conector", async () => {
    registerConnector(makeManifest());
    mountConnectorCredential({ connectorId: "stripe-mcp", token: "t" });
    const out = await authorizeConnectorCall(call({ dataClass: "restricted" as DataClass }));
    expect(out.decision.code).toBe("DATA_CLASS_DENIED");
  });
});

describe("Rate limit (CIX)", () => {
  it("agota el límite por ventana y devuelve RATE_LIMITED", async () => {
    registerConnector(makeManifest({ rateLimit: { windowMs: 1000, maxCalls: 2 } }));
    mountConnectorCredential({ connectorId: "stripe-mcp", token: "t" });
    expect((await authorizeConnectorCall(call(), async () => "ok")).decision.allowed).toBe(true);
    expect((await authorizeConnectorCall(call(), async () => "ok")).decision.allowed).toBe(true);
    const third = await authorizeConnectorCall(call(), async () => "ok");
    expect(third.decision.code).toBe("RATE_LIMITED");
  });
});

describe("Circuit breaker (CIX: CLOSED/OPEN/HALF_OPEN)", () => {
  it("abre el circuito tras el umbral de fallos (OPEN) y rechaza llamadas", async () => {
    registerConnector(makeManifest({ circuit: { threshold: 3, resetMs: 1000, halfOpenRequests: 1 } }));
    mountConnectorCredential({ connectorId: "stripe-mcp", token: "t" });
    for (let i = 0; i < 3; i++) {
      await authorizeConnectorCall(call(), async () => { throw new Error("boom"); });
    }
    const open = await authorizeConnectorCall(call(), async () => "ok");
    expect(open.decision.allowed).toBe(false);
    expect(open.decision.code).toBe("CIRCUIT_OPEN");
  });

  it("recupera a HALF_OPEN y CLOSED tras reset con una llamada exitosa", async () => {
    registerConnector(makeManifest({ circuit: { threshold: 2, resetMs: 1000, halfOpenRequests: 1 } }));
    mountConnectorCredential({ connectorId: "stripe-mcp", token: "t" });
    await authorizeConnectorCall(call(), async () => { throw new Error("x"); });
    await authorizeConnectorCall(call(), async () => { throw new Error("x"); });
    const blocked = await authorizeConnectorCall(call(), async () => "ok");
    expect(blocked.decision.code).toBe("CIRCUIT_OPEN");

    await new Promise((r) => setTimeout(r, 1050)); // supera resetMs → HALF_OPEN
    const probe = await authorizeConnectorCall(call(), async () => "recovered");
    expect(probe.decision.allowed).toBe(true);
    const next = await authorizeConnectorCall(call(), async () => "again");
    expect(next.decision.allowed).toBe(true);
    expect(listConnectors()[0].circuit).toBe("CLOSED");
  });
});

describe("Audit (CIX)", () => {
  it("audita cada llamada con decisión y latencia", async () => {
    registerConnector(makeManifest());
    mountConnectorCredential({ connectorId: "stripe-mcp", token: "t" });
    await authorizeConnectorCall(call(), async () => "ok");
    const denied = await authorizeConnectorCall(call({ requiredScope: "billing:delete" }));
    const audit = getAuditLog();
    expect(audit).toHaveLength(2);
    expect(audit[0].decision).toBe("ALLOWED");
    expect(audit[1].decision).toBe("SCOPE_DENIED");
    expect(audit[0].connectorId).toBe("stripe-mcp");
  });
});
