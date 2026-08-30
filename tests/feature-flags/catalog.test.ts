import { describe, it, expect } from "vitest";
import { FEATURE_FLAGS, FEATURE_FLAG_KEYS } from "../../src/config/feature-flags/catalog";
import { resolveFlag, assertFlagCanRunInEnvironment } from "../../src/lib/flags/evaluator";

describe("Isabella Feature Flags Governance", () => {
  it("usa defaults seguros si el proveedor falla", async () => {
    const result = await resolveFlag("isabella_ai_model_fallback", async () => {
      throw new Error("provider unavailable");
    });
    expect(result.value).toBe(true);
    expect(result.source).toBe("safe_default");
    expect(result.stale).toBe(true);
  });

  it("mantiene quantum desactivado por defecto en desarrollo seguro", () => {
    expect(FEATURE_FLAGS.isabella_quantum_route.defaultValue).toBe(false);
  });

  it("no permite flags fuera de entorno autorizado", () => {
    expect(() =>
      assertFlagCanRunInEnvironment("isabella_quantum_route", "production"),
    ).toThrow();
  });

  it("no expone secretos ni tokens en el catálogo público", () => {
    const serialized = JSON.stringify(FEATURE_FLAGS);
    expect(serialized).not.toMatch(/secret|token|password|api[_-]?key/i);
  });

  it("declara exactamente las claves gobernadas del catálogo", () => {
    expect(FEATURE_FLAG_KEYS).toContain("tamv_7_federations_routing");
    expect(FEATURE_FLAG_KEYS).toContain("isabella_ai_model_fallback");
    expect(FEATURE_FLAG_KEYS).toContain("isabella_conversational_canvas_v2");
    expect(FEATURE_FLAG_KEYS).toContain("isabella_strict_rate_limiting");
    expect(FEATURE_FLAG_KEYS).toContain("isabella_graph_memory");
    expect(FEATURE_FLAG_KEYS).toContain("isabella_quantum_route");
  });
});
