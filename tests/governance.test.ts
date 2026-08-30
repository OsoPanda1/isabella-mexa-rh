/**
 * Tests: Governance runtime nativo (UNESCO / ONU / WEF referencias de diseño)
 *
 * Verifica que el registro de riesgos, el approval gate humano (H0-H4), la
 * metadata de provenance y el change/release gating funcionan de forma
 * nativa (no como parche de UI ni botón "Aceptar").
 */
import { describe, it, expect } from "vitest";
import {
  riskRegister,
  seedRiskRegister,
  riskLevel,
  tierForLikelihoodImpact,
  requiresHumanApproval,
  computeResidual,
} from "../src/lib/governance";
import { gateAction, humanApprovalGate, validateApproval, type HumanApproval } from "../src/lib/governance/human-approval";
import { buildProvenance, requireHumanReview } from "../src/lib/governance/provenance";
import { isReleaseReady, classifyIncident, INCIDENT_RUNBOOK } from "../src/lib/governance";

describe("risk register", () => {
  it("seeds AI-RISK-0001..0020 con clasificación", () => {
    seedRiskRegister();
    const risks = riskRegister.list();
    expect(risks.length).toBeGreaterThanOrEqual(20);
    expect(riskRegister.get("AI-RISK-0001")?.riskTier).toBe("PROHIBITED");
    expect(riskRegister.get("AI-RISK-0001")?.owner).toBeTruthy();
  });

  it("clasifica inherentReason por probabilidad×impacto", () => {
    expect(riskLevel("almost-certain", "critical")).toBe("critical");
    expect(tierForLikelihoodImpact("almost-certain", "critical")).toBe("CRITICAL");
    expect(riskLevel("rare", "low")).toBe("low");
  });

  it("el residual no baja sin evidencia técnica", () => {
    const r = computeResidual({
      riskId: "x", title: "t", system: "s", component: "c", owner: "o",
      riskTier: "HIGH", status: "open", likelihood: "probable", impact: "high",
      inherentRisk: "high", residualRisk: "high", humanRights: [], existingControls: [],
      mitigations: ["mit1"], acceptanceCriteria: [], evidenceRefs: [],
    });
    expect(r.residualRisk).toBe("high");
    expect(r.rationale).toContain("Sin evidencia");
  });

  it("requiere aprobación humana en HIGH+ y PROHIBITED", () => {
    const r = riskRegister.get("AI-RISK-0001")!;
    expect(requiresHumanApproval(r)).toBe(true);
  });
});

describe("human oversight / approval gate", () => {
  it("H0 permite, H4 bloquea decisión autónoma", () => {
    expect(gateAction({ requiredLevel: "H0", action: "a" }).status).toBe("allowed");
    expect(gateAction({ requiredLevel: "H4", action: "pay-out", scope: "admin" }).status).toBe("blocked");
  });

  it("H2 queda pendiente de aprobación humana", () => {
    const d = gateAction({ requiredLevel: "H2", action: "deploy-model", scope: "prod" });
    expect(d.status).toBe("pending_human_approval");
    expect(d.approval?.decisionId).toBeTruthy();
  });

  it("H3 requiere dos aprobadores independientes", () => {
    const approver1: HumanApproval = {
      approvalId: "a1", decisionId: "d1", reviewerSubject: "bob", reviewerRole: "admin",
      action: "deploy", scope: "prod", evidenceRefs: [], decision: "approve", reason: "ok",
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    expect(gateAction({ requiredLevel: "H3", action: "deploy", scope: "prod", approvals: [approver1] }).status).toBe("pending_human_approval");
    const approver2: HumanApproval = { ...approver1, approvalId: "a2", reviewerSubject: "carol" };
    expect(gateAction({ requiredLevel: "H3", action: "deploy", scope: "prod", approvals: [approver1, approver2] }).status).toBe("allowed");
  });

  it("valida que no haya autoaprobación ni aprobación sin motivo", () => {
    expect(validateApproval({ reviewerSubject: "", decision: "approve", reason: "x", expiresAt: new Date(Date.now() + 60000).toISOString() } as Partial<HumanApproval>, "H2")).toBeTruthy();
    expect(validateApproval({ reviewerSubject: "bob", decision: "approve", reason: "", expiresAt: new Date(Date.now() + 60000).toISOString() } as Partial<HumanApproval>, "H2")).toContain("motivo");
    expect(validateApproval({ reviewerSubject: "bob", decision: "approve", reason: "ok", expiresAt: new Date(Date.now() + 60000).toISOString() } as Partial<HumanApproval>, "H2")).toBeNull();
  });

  it("expone el middleware como función Express", () => {
    expect(typeof humanApprovalGate({ requiredLevel: "H2", action: "x" })).toBe("function");
  });
});

describe("provenance / transparencia", () => {
  it("adjunta metadata de procedencia a respuestas", () => {
    const p = buildProvenance({ modelId: "isabella-sovereign", dataOrigin: "live" });
    expect(p.provenance.modelId).toBe("isabella-sovereign");
    expect(p.provenance.policyVersion).toBeTruthy();
    expect(p.provenance.humanReview).toBe("not_required");
  });

  it("marca revisión humana obligatoria para alto riesgo", () => {
    expect(requireHumanReview(true)).toBe("pending");
    expect(requireHumanReview(false)).toBe("not_required");
  });
});

describe("incidents y release gating", () => {
  it("clasifica severidades SEV-1..SEV-4", () => {
    expect(classifyIncident("exposure of secret key in logs")).toBe("SEV-1");
    expect(classifyIncident("tenant isolation bypass")).toBe("SEV-2");
    expect(classifyIncident("timeout degradation")).toBe("SEV-3");
    expect(classifyIncident("visual typo")).toBe("SEV-4");
  });

  it("ejecuta el runbook en fase SECUENCIAL", () => {
    expect(INCIDENT_RUNBOOK[0]).toBe("detecting");
    expect(INCIDENT_RUNBOOK[INCIDENT_RUNBOOK.length - 1]).toBe("postmortem");
  });

  it("bloquea el despliegue sin owner/tests/rollback/aprobación", () => {
    const bad = isReleaseReady({ id: "cr", component: "model", changeType: "model", summary: "s", risk: "high", owner: "", tests: [], rollback: "none", approvals: [], createdAt: new Date().toISOString() });
    expect(bad.ok).toBe(false);
    expect(bad.blockers.length).toBeGreaterThanOrEqual(2);
    const good = isReleaseReady({ id: "cr", component: "model", changeType: "model", summary: "s", risk: "low", owner: "o", tests: ["t"], rollback: "available", approvals: ["a"], createdAt: new Date().toISOString() });
    expect(good.ok).toBe(true);
  });
});
