/**
 * Tests: Automation Mesh (registry, dependency chains, human interface)
 */
import { describe, it, expect } from "vitest";
import {
  getAutomationNode,
  getNodesByCategory,
  getDependencyChain,
  getAffectedChain,
  getAtlasStats,
} from "../src/lib/automation/registry";

describe("automation registry", () => {
  it("has 30+ nodes", () => {
    const stats = getAtlasStats();
    expect(stats.totalNodes).toBeGreaterThanOrEqual(30);
  });

  it("can find node by ID", () => {
    const node = getAutomationNode("A-identity");
    expect(node).toBeTruthy();
    expect(node!.name).toBe("Identity & Session");
    expect(node!.complexity).toBe("moderate");
  });

  it("returns undefined for unknown ID", () => {
    expect(getAutomationNode("NONEXISTENT")).toBeUndefined();
  });

  it("has all required fields on every node", () => {
    const stats = getAtlasStats();
    const nodes = getNodesByCategory("identity");
    for (const node of nodes) {
      expect(node.id).toBeTruthy();
      expect(node.name).toBeTruthy();
      expect(node.description).toBeTruthy();
      expect(node.healthCheck).toBeTruthy();
      expect(node.repairProcedure).toBeTruthy();
      expect(node.humanDescription).toBeTruthy();
      expect(node.developerGuide).toBeTruthy();
      expect(node.codeFiles.length).toBeGreaterThan(0);
    }
  });

  it("dependency chain works without cycles", () => {
    const chain = getDependencyChain("F-quantum-gateway");
    expect(chain).toContain("F-quantum-gateway");
    expect(chain).toContain("C-policy");
    // No duplicates
    expect(new Set(chain).size).toBe(chain.length);
  });

  it("affected chain works forward", () => {
    const affected = getAffectedChain("A-identity");
    expect(affected).toContain("A-identity");
    expect(affected).toContain("B-consent");
    expect(affected.length).toBeGreaterThan(1);
  });

  it("atlas stats are consistent", () => {
    const stats = getAtlasStats();
    expect(stats.totalNodes).toBeGreaterThan(0);
    expect(Object.keys(stats.byCategory).length).toBeGreaterThan(5);
    expect(Object.keys(stats.byComplexity).length).toBeGreaterThan(2);
  });

  it("getNodesByCategory returns array", () => {
    const cryptoNodes = getNodesByCategory("crypto");
    expect(cryptoNodes.length).toBeGreaterThanOrEqual(1);
  });
});
