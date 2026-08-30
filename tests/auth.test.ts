/**
 * Tests: Auth module (JWT HS256, roles, scopes)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyHs256Jwt,
  requireRole,
  requireScope,
  currentPrincipal,
  type AuthenticatedPrincipal,
} from "../src/lib/auth.server";
import { signNativeJwt, verifyNativeJwt } from "../src/lib/native-auth";

function makeToken(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

describe("auth.server", () => {
  const SECRET = "test-secret-key-for-auth";

  describe("verifyHs256Jwt", () => {
    it("returns principal for valid token", () => {
      const token = makeToken({ sub: "user-1", roles: ["admin"], tenantId: "t1" }, SECRET);
      const principal = verifyHs256Jwt(token, SECRET);
      expect(principal).not.toBeNull();
      expect(principal!.sub).toBe("user-1");
      expect(principal!.roles).toContain("admin");
      expect(principal!.tenantId).toBe("t1");
    });

    it("rejects token with wrong secret", () => {
      const token = makeToken({ sub: "user-1", roles: ["viewer"] }, SECRET);
      const principal = verifyHs256Jwt(token, "wrong-secret");
      expect(principal).toBeNull();
    });

    it("rejects expired token", () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const token = makeToken({ sub: "user-1", exp: pastExp }, SECRET);
      const principal = verifyHs256Jwt(token, SECRET);
      expect(principal).toBeNull();
    });

    it("rejects token without sub", () => {
      const token = makeToken({ roles: ["admin"] }, SECRET);
      const principal = verifyHs256Jwt(token, SECRET);
      expect(principal).toBeNull();
    });

    it("rejects non-HS256 algorithm", () => {
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const body = Buffer.from(JSON.stringify({ sub: "user-1" })).toString("base64url");
      const sig = Buffer.from("fake-sig").toString("base64url");
      const principal = verifyHs256Jwt(`${header}.${body}.${sig}`, SECRET);
      expect(principal).toBeNull();
    });

    it("rejects malformed token", () => {
      expect(verifyHs256Jwt("not-a-jwt", SECRET)).toBeNull();
      expect(verifyHs256Jwt("a.b", SECRET)).toBeNull();
    });

    it("defaults roles to citizen if missing", () => {
      const token = makeToken({ sub: "user-1" }, SECRET);
      const principal = verifyHs256Jwt(token, SECRET);
      expect(principal!.roles).toEqual(["citizen"]);
    });
  });

  describe("currentPrincipal", () => {
    it("returns anonymous if no principal set", () => {
      const req = { principal: undefined } as any;
      const p = currentPrincipal(req);
      expect(p.sub).toBe("anonymous");
      expect(p.roles).toEqual(["viewer"]);
    });
  });
});


describe("native-auth EdDSA", () => {
  it("signs and verifies native JWTs with Ed25519", () => {
    const token = signNativeJwt({ sub: "user-ed", roles: ["citizen"], scopes: ["chat:read"] });
    const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
    expect(header.alg).toBe("EdDSA");
    const principal = verifyNativeJwt(token);
    expect(principal?.sub).toBe("user-ed");
    expect(principal?.kind).toBe("jwt");
  });
});
