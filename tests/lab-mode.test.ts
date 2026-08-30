/**
 * Tests: Lab Mode gate (PQC/HSM/TEE prototype isolation)
 */
import { describe, it, expect } from "vitest";
import { LAB_MODE, requireLabMode } from "../src/lib/lab-mode";

describe("lab-mode", () => {
  it("LAB_MODE is false by default in test environment", () => {
    expect(LAB_MODE).toBe(false);
  });

  it("requireLabMode throws when LAB_MODE is false", () => {
    expect(() => requireLabMode("TEST")).toThrow("PROTOTYPE_NOT_AVAILABLE");
    expect(() => requireLabMode("TEST")).toThrow("TEST");
  });
});
