import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPrototypeCrypto, isPrototypeCryptoAllowed } from "../src/lib/crypto/prototype-registry";
import { requireLabMode } from "../src/lib/lab-mode";
import { hsmClient } from "../src/lib/hsmClient";
import { signLedgerBlockPQC } from "../src/lib/postQuantumCrypto";

describe("P0-05 isolation of prototype cryptography from production", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fail-closed by default: no prototype component is reachable in production", () => {
    expect(isPrototypeCryptoAllowed()).toBe(false);
    expect(() => assertPrototypeCrypto("HSM_SIMULATOR")).toThrow(/PROTOTYPE_NOT_AVAILABLE/);
    expect(() => requireLabMode("PQC-LEDGER-SIGN")).toThrow(/PROTOTYPE_NOT_AVAILABLE/);
  });

  it("HSM simulator signing/key operations are unreachable in production", async () => {
    await expect(hsmClient.signWithHSMKey(1, "tx")).rejects.toThrow(/PROTOTYPE_NOT_AVAILABLE/);
    await expect(hsmClient.generateAESKey("cattleya_finance")).rejects.toThrow(/PROTOTYPE_NOT_AVAILABLE/);
  });

  it("PQC ledger signing is unreachable in production", () => {
    expect(() => signLedgerBlockPQC("block-1", "deadbeef")).toThrow(/PROTOTYPE_NOT_AVAILABLE/);
  });

  it("opens ONLY with an explicit lab flag (server side)", () => {
    vi.stubEnv("FEATURE_LAB_MODE", "true");
    expect(isPrototypeCryptoAllowed()).toBe(true);
    expect(() => assertPrototypeCrypto("HSM_SIMULATOR")).not.toThrow();
  });

  it("HSM simulator responds when the lab flag is set", async () => {
    vi.stubEnv("FEATURE_LAB_MODE", "true");
    await expect(hsmClient.signWithHSMKey(1, "tx")).resolves.toContain("hsm_");
  });
});
