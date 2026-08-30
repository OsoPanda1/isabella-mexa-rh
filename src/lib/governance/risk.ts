/* ============================================================================
 * Governance — AI Risk Register
 *
 * Clasificación de riesgos de Isabella en dos dimensiones independientes
 * (probabilidad / impacto) que producen un riesgo INHERENTE. Tras aplicar
 * mitigaciones y evidencia, se calcula el riesgo RESIDUAL. Nunca se cierra un
 * riesgo solo por tener una política escrita: debe existir evidencia técnica.
 *
 * Tiers: LOW · MEDIUM · HIGH · CRITICAL · PROHIBITED
 * Referencias de diseño: UNESCO (dignidad, derechos humanos, supervisión),
 * ONU / Global Digital Compact (cooperación, interés público), WEF
 * (controles operativos, owners, evidencia, escalamiento).
 * ============================================================================ */

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "PROHIBITED";
export type RiskLikelihood = "rare" | "possible" | "probable" | "almost-certain";
export type RiskImpact = "low" | "medium" | "high" | "critical";
export type RiskStatus = "open" | "mitigating" | "accepted" | "closed";

export interface RiskAssessment {
  riskId: string;
  title: string;
  system: string;
  component: string;
  owner: string;
  riskTier: RiskTier;
  status: RiskStatus;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  inherentRisk: "low" | "medium" | "high" | "critical";
  residualRisk: "low" | "medium" | "high" | "critical";
  humanRights: string[];
  existingControls: string[];
  mitigations: string[];
  acceptanceCriteria: string[];
  evidenceRefs: string[];
  prohibited?: boolean;
  requiresHumanApproval?: boolean;
}

export const RISK_TIER_ORDER: Record<RiskTier, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
  PROHIBITED: 5,
};

const LIKELIHOOD_WEIGHT: Record<RiskLikelihood, number> = {
  rare: 1,
  possible: 2,
  probable: 3,
  "almost-certain": 4,
};

const IMPACT_WEIGHT: Record<RiskImpact, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const SCORE_TO_LEVEL: Array<{ min: number; level: "low" | "medium" | "high" | "critical" }> = [
  { min: 13, level: "critical" },
  { min: 9, level: "high" },
  { min: 5, level: "medium" },
  { min: 0, level: "low" },
];

export function riskLevel(likelihood: RiskLikelihood, impact: RiskImpact): "low" | "medium" | "high" | "critical" {
  const score = LIKELIHOOD_WEIGHT[likelihood] * IMPACT_WEIGHT[impact];
  return SCORE_TO_LEVEL.find((entry) => score >= entry.min)!.level;
}

export function tierForLikelihoodImpact(likelihood: RiskLikelihood, impact: RiskImpact): RiskTier {
  const level = riskLevel(likelihood, impact);
  return level === "critical" ? "CRITICAL" : (level.toUpperCase() as RiskTier);
}

/**
 * Resuelve las variables de mitigación declaradas y el riesgo residual.
 * Devuelve una razón clara y el riesgo residual, sin afirmar cumplimiento
 * únicamente por la existencia de una política.
 */
export function computeResidual(a: RiskAssessment): Pick<RiskAssessment, "residualRisk"> & { rationale: string } {
  const inherent = a.inherentRisk;
  const activeMitigations = a.mitigations.length;
  const hasEvidence = a.evidenceRefs.length > 0;

  // Sin evidencia, el riesgo residual no puede bajar por debajo del inherente.
  if (!hasEvidence) {
    return { residualRisk: inherent, rationale: "Sin evidencia técnica, el riesgo residual no se reduce." };
  }

  // Cada mitigación con evidencia baja un nivel (máx. inherente -> medium).
  const reduction = Math.min(activeMitigations, 2);
  const order = ["low", "medium", "high", "critical"] as const;
  const inherentIdx = order.indexOf(inherent);
  const residualIdx = Math.max(0, inherentIdx - reduction);
  const residual = order[residualIdx];

  return {
    residualRisk: residual,
    rationale: `${activeMitigations} mitigación(es) con evidencia aplicadas; residual ${residual}.`,
  };
}

export function requiresHumanApproval(assessment: RiskAssessment): boolean {
  if (assessment.prohibited) return true;
  return RISK_TIER_ORDER[assessment.riskTier] >= RISK_TIER_ORDER.HIGH || assessment.requiresHumanApproval === true;
}

function isRiskTier(value: string): value is RiskTier {
  return value in RISK_TIER_ORDER;
}

/** Registro versionado en memoria; en producción se rehidrata desde YAML. */
export class RiskRegister {
  private risks = new Map<string, RiskAssessment>();

  register(input: Omit<RiskAssessment, "inherentRisk" | "residualRisk">): RiskAssessment {
    const inherent = riskLevel(input.likelihood, input.impact);
    const assessment: RiskAssessment = {
      ...input,
      inherentRisk: inherent,
      ...computeResidual({ ...(input as RiskAssessment), inherentRisk: inherent }),
    };
    this.risks.set(assessment.riskId, assessment);
    return assessment;
  }

  get(riskId: string): RiskAssessment | undefined {
    return this.risks.get(riskId);
  }

  list(): RiskAssessment[] {
    return [...this.risks.values()];
  }

  /** Riesgos que bloquean producción: HIGH/CRITICAL abiertos o cualquier PROHIBITED. */
  blockingForProduction(): RiskAssessment[] {
    return this.list().filter((r) => {
      if (r.prohibited) return true;
      if (r.status === "closed") return false;
      return RISK_TIER_ORDER[r.riskTier] >= RISK_TIER_ORDER.HIGH;
    });
  }

  fromCatalog(cat: string): number {
    if (isRiskTier(cat)) return RISK_TIER_ORDER[cat];
    return 0;
  }
}

export const riskRegister = new RiskRegister();
