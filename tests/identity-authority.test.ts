import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { authenticate, verifyHs256Jwt } from "../src/lib/auth.server";
import { mintGuestSession } from "../src/lib/native-auth";

function makeHs256(payload: Record<string, unknown>, secret: string): string {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}

const FUTURE = Math.floor(Date.now() / 1000) + 3600;

describe("P0-01 authoritative identity (no client-supplied identity)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("guest session can never escalate beyond the allowlisted scopes", () => {
    const { principal } = mintGuestSession({
      sessionId: "sess-abc",
      requestedScopes: ["admin:keys", "keys:manage", "ledger:read", "system", "chat:read"],
      requestedPlan: "vip",
    });
    // Requested privileged scopes are dropped.
    expect(principal.scopes).not.toContain("admin:keys");
    expect(principal.scopes).not.toContain("keys:manage");
    expect(principal.scopes).not.toContain("ledger:read");
    // Only allowlisted scopes survive.
    expect(principal.scopes).toContain("chat:read");
    // Identity is always server-assigned, never from the client.
    expect(principal.sub).toBe("guest-sess-abc");
    expect(principal.tenantId).toBe("nodo-cero-rdm");
    expect(principal.roles).toEqual(["citizen"]);
    expect(principal.plan).toBe("free"); // "vip" not in GUEST_PLANS
  });

  it("external HS256 JWT is verified, not trusted blindly", () => {
    const secret = "external-secret";
    const good = makeHs256(
      { sub: "alice", tenantId: "nodo-cero-rdm", roles: ["citizen"], scopes: ["chat:read"], iss: "isabella-external", aud: "isabella-api", exp: FUTURE },
      secret,
    );
    const principal = verifyHs256Jwt(good, secret);
    expect(principal).not.toBeNull();
    expect(principal?.sub).toBe("alice");

    // Tampered payload with a different (wrong) signature is rejected.
    const forged = makeHs256(
      { sub: "admin-victim", tenantId: "other", roles: ["system"], scopes: ["*"], iss: "isabella-external", aud: "isabella-api", exp: FUTURE },
      "wrong-secret",
    );
    expect(verifyHs256Jwt(forged, secret)).toBeNull();

    // Valid structure but wrong audience/issuer is rejected.
    const badAud = makeHs256({ sub: "alice", aud: "evil", exp: FUTURE }, secret);
    expect(verifyHs256Jwt(badAud, secret)).toBeNull();
  });

  it("production rejects unauthenticated requests (no dev fallback)", () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = { headers: {} } as any;
    const res: any = { status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });
});
