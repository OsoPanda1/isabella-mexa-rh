/**
 * Tests: Auth hardening — scope catalogue coverage and gates
 *
 * - Every scope a route demands via requireScope(...) must be mintable in
 *   API_KEY_SCOPES; otherwise the endpoint dies with a permanent 403 for
 *   API-key principals.
 * - Guest sessions must never carry administrative scopes.
 * - requireScope rejects missing and wildcard scopes deterministically.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { API_KEY_SCOPES } from "../src/lib/api-keys";
import { requireScope } from "../src/lib/auth.server";
import { mintGuestSession } from "../src/lib/native-auth";

const here = dirname(fileURLToPath(import.meta.url));

function scopesDemandedByRoutes(): string[] {
  const serverSource = readFileSync(resolve(here, "../server.ts"), "utf8");
  return [...new Set([...serverSource.matchAll(/requireScope\("([^"]+)"\)/g)].map((m) => m[1]))].sort();
}

describe("scope catalogue coverage", () => {
  it("every requireScope target in server.ts is mintable as an API key scope", () => {
    const demanded = scopesDemandedByRoutes();
    expect(demanded.length).toBeGreaterThan(0);
    const missing = demanded.filter((scope) => !(API_KEY_SCOPES as readonly string[]).includes(scope));
    expect(missing, `scopes missing from API_KEY_SCOPES: ${missing.join(", ")}`).toEqual([]);
  });

  it("catalogue forbids wildcards", () => {
    expect(API_KEY_SCOPES).not.toContain("*");
  });
});

describe("guest session confinement", () => {
  it("guest sessions never receive administrative scopes", () => {
    const session = mintGuestSession({
      sessionId: "guest-testing-scope",
      requestedScopes: ["keys:manage", "admin:keys", "chat:read", "chat:write"],
    });
    expect(session.principal.scopes).not.toContain("keys:manage");
    expect(session.principal.scopes).not.toContain("admin:keys");
    expect(session.principal.scopes).toEqual(expect.arrayContaining(["chat:read", "chat:write"]));
  });

  it("guest plan requests outside the allowlist degrade to free", () => {
    const session = mintGuestSession({ sessionId: "guest-plan-check", requestedPlan: "enterprise" });
    expect(session.principal.plan).toBe("free");
  });
});

describe("requireScope gate semantics", () => {
  const run = (scopes: string[], roles: string[], required: string) => {
    const req = { principal: { sub: "t", tenantId: "t", roles, scopes } } as never;
    const res = {
      statusCode: 200 as number,
      body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: unknown) { this.body = payload; return this; },
    };
    let nextCalled = false;
    requireScope(required)(req, res as never, () => { nextCalled = true; });
    return { statusCode: res.statusCode, nextCalled };
  };

  it("passes only when the scope is present", () => {
    expect(run(["billing:checkout"], ["citizen"], "billing:checkout").nextCalled).toBe(true);
    expect(run(["billing:read"], ["citizen"], "billing:checkout").statusCode).toBe(403);
  });

  it("wildcard scope alone is rejected for non-system roles", () => {
    const result = run(["*"], ["admin"], "billing:checkout");
    expect(result.statusCode).toBe(403);
    expect(result.nextCalled).toBe(false);
  });
});
