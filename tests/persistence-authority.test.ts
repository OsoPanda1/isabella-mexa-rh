import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAuthoritativeBackend, getStoreTier, isPostgresConfigured } from "../src/lib/persistence/authority";

describe("P0-02 system-of-record authority boundary", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("clasifica estado critico como authoritative y cache como transient", () => {
    expect(getStoreTier("ledger")).toBe("authoritative");
    expect(getStoreTier("economy")).toBe("authoritative");
    expect(getStoreTier("wallet")).toBe("authoritative");
    expect(getStoreTier("billing")).toBe("authoritative");
    expect(getStoreTier("apiKeys")).toBe("authoritative");
    expect(getStoreTier("audit")).toBe("authoritative");
    expect(getStoreTier("memory")).toBe("authoritative");
    expect(getStoreTier("sessions")).toBe("transient");
    expect(getStoreTier("durableJson")).toBe("transient");
    expect(getStoreTier("featureFlags")).toBe("transient");
  });

  it("detecta la configuracion de PostgreSQL via POSTGRES_URL", () => {
    expect(isPostgresConfigured()).toBe(false);
    vi.stubEnv("POSTGRES_URL", "postgres://user:pass@host:5432/db");
    expect(isPostgresConfigured()).toBe(true);
  });

  it("rechaza usar almacen transitorio como fuente de verdad para estado critico sin PG", () => {
    expect(() => assertAuthoritativeBackend("ledger")).toThrow(/SYSTEM_OF_RECORD_MISSING/);
    expect(() => assertAuthoritativeBackend("economy")).toThrow(/SYSTEM_OF_RECORD_MISSING/);
  });

  it("permite operaciones authoritative cuando PostgreSQL esta configurado", () => {
    vi.stubEnv("POSTGRES_URL", "postgres://user:pass@host:5432/db");
    expect(() => assertAuthoritativeBackend("ledger")).not.toThrow();
    expect(() => assertAuthoritativeBackend("economy")).not.toThrow();
  });
});
