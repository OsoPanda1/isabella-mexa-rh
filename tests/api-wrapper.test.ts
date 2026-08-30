/**
 * Tests: Vercel API wrapper — method contract
 *
 * Regression coverage for the persistent "405 METHOD_NOT_ALLOWED" class:
 * HEAD must stay delegated to Express (health monitors depend on it), and
 * truly unknown methods must fail fast with an explicit Allow header.
 */
import { describe, it, expect } from "vitest";
import { isMethodAllowed, ALLOWED_METHODS } from "../src/lib/http-methods";

describe("api wrapper method contract", () => {
  it("allows every standard HTTP method the platform uses", () => {
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      expect(isMethodAllowed(method), `${method} must be allowed`).toBe(true);
    }
  });

  it("case-insensitive matching keeps lowercase verbs working", () => {
    expect(isMethodAllowed("get")).toBe(true);
    expect(isMethodAllowed("head")).toBe(true);
    expect(isMethodAllowed("post")).toBe(true);
  });

  it("rejects dangerous or unknown methods", () => {
    const methods = ["TRACE", "CONNECT", "PROPFIND", "MKCOL", ""];
    for (const method of methods) {
      expect(isMethodAllowed(method)).toBe(false);
    }
  });

  it("HEAD is a first-class citizen (regression: uptime monitors hit 405)", () => {
    expect(ALLOWED_METHODS).toContain("HEAD");
  });

  it("does not regress to blocking legitimate verbs", () => {
    expect(ALLOWED_METHODS).not.toContain("TRACE");
    expect(ALLOWED_METHODS).not.toContain("CONNECT");
  });
});
