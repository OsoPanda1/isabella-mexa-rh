/**
 * Tests: Epistemic Governance
 */
import { describe, it, expect } from "vitest";
import { classifyEpistemicStatus, getEpistemicRules } from "../src/lib/epistemic";

describe("epistemic-governance", () => {
  it("returns unavailable when no evidence", () => {
    const result = classifyEpistemicStatus({
      domain: "technical",
      evidenceCount: 0,
      contradictoryCount: 0,
      avgRelevance: 0,
      hasPrimarySource: false,
      hasDateAndScope: false,
    });
    expect(result.status).toBe("unavailable");
    expect(result.requiresManualReview).toBe(false);
  });

  it("returns insufficient for high-risk with low relevance", () => {
    const result = classifyEpistemicStatus({
      domain: "medical",
      evidenceCount: 5,
      contradictoryCount: 0,
      avgRelevance: 0.1,
      hasPrimarySource: true,
      hasDateAndScope: true,
    });
    expect(result.status).toBe("insufficient");
    expect(result.requiresManualReview).toBe(true);
    expect(result.domainRule).toContain("fuentes reguladas");
  });

  it("returns contextualizes for good non-high-risk evidence", () => {
    const result = classifyEpistemicStatus({
      domain: "technical",
      evidenceCount: 3,
      contradictoryCount: 0,
      avgRelevance: 0.8,
      hasPrimarySource: true,
      hasDateAndScope: true,
    });
    expect(result.status).toBe("contextualizes");
    expect(result.requiresManualReview).toBe(false);
  });

  it("always requires manual review for high-risk domains", () => {
    const result = classifyEpistemicStatus({
      domain: "legal",
      evidenceCount: 10,
      contradictoryCount: 0,
      avgRelevance: 0.9,
      hasPrimarySource: true,
      hasDateAndScope: true,
    });
    expect(result.requiresManualReview).toBe(true);
    expect(result.domainRule).toContain("normativa vigente");
  });

  it("getEpistemicRules returns all states", () => {
    const rules = getEpistemicRules();
    expect(rules.states.supported).toBeTruthy();
    expect(rules.states.uncertain).toBeTruthy();
    expect(rules.states.refuted).toBeTruthy();
    expect(rules.invariants).toContain("Retrieval is never proof");
    expect(rules.highRiskDomains).toContain("academic");
  });
});
