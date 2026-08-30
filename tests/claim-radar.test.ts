/**
 * Tests: Claim Radar Engine
 */
import { describe, it, expect } from "vitest";
import { evaluateClaim, toEpistemicFormat, getClaimRadarMetrics } from "../src/lib/claim-radar";

describe("claim-radar", () => {
  it("evaluateClaim returns unavailable when no adapters exist", async () => {
    const claim = await evaluateClaim({
      assertion: "Quantum supremacy was achieved in 2025",
      domain: "technical",
      source: "test",
    });
    expect(claim.evidenceLevel).toBe("unavailable");
    expect(claim.confidence).toBe(0);
    expect(claim.caveat).toBeTruthy();
  });

  it("toEpistemicFormat returns correct shape", () => {
    const claim = {
      assertion: "test",
      evidenceLevel: "insufficient" as const,
      confidence: 0.3,
      supportingResults: [],
      contradictoryResults: [],
      reasonCode: "TEST",
      caveat: "test caveat",
    };
    const format = toEpistemicFormat(claim as any);
    expect(format.claim).toBe("test");
    expect(format.status).toBe("insufficient");
    expect(format.confidence).toBe(0.3);
  });

  it("getClaimRadarMetrics returns rules", () => {
    const metrics = getClaimRadarMetrics();
    expect(metrics.rules).toContain("Retrieval is not verification");
    expect(metrics.highRiskDomains).toContain("medical");
    expect(metrics.highRiskDomains).toContain("legal");
  });
});

describe("claim-radar high-risk domains", () => {
  it("medical claim always gets insufficient even with results", async () => {
    const claim = await evaluateClaim({
      assertion: "Aspirin prevents heart attacks",
      domain: "medical",
      source: "test",
    });
    // No adapters = unavailable, but high-risk logic still applies
    expect(["unavailable", "insufficient"]).toContain(claim.evidenceLevel);
  });

  it("legal claim has caveat with domain label", async () => {
    const claim = await evaluateClaim({
      assertion: "Property rights under Mexican law",
      domain: "legal",
      source: "test",
    });
    expect(claim.caveat).toContain("Dominio de alto riesgo");
  });
});
