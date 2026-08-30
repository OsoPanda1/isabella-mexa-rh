/**
 * Isabella Epistemic Governance Module
 * Implementa las reglas de gobernanza epistemológica (Section 11):
 * - Estados de claim: supported, uncertain, refuted, not-checked, not-applicable
 * - Regla de alta criticidad para claims legales, médicos, etc.
 * - Formato de respuesta epistemológica
 * - Regla: retrieval ≠ proof
 */
import type { ClaimDomain, EvidenceStatus } from "../claim-radar/contracts";

// ============================================================================
// HIGH-RISK DOMAIN RULES (Section 11.2)
// ============================================================================

const HIGH_RISK_DOMAINS: ClaimDomain[] = [
  "academic",
  "territorial",
  "legal",
  "medical",
  "financial",
];

const DOMAIN_RULES: Record<ClaimDomain, string> = {
  academic: "Requiere DOI, ORCID del autor, y revisión por pares. La recuperación de Zenodo no constituye verificación.",
  territorial: "Requiere fuente primaria documentada. Los datos territoriales deben conservar fecha y alcance.",
  medical: "Nunca presentar como consejo médico. Requiere evidencia de fuentes reguladas.",
  legal: "Nunca presentar como asesoría legal. Requiere normativa vigente y jurisdicción.",
  financial: "Requiere fuente regulada y fecha de vigencia. No constituye asesoría financiera.",
  technical: "Requiere especificación técnica, referencia o estándar.",
  cultural: "Requiere fuente primaria o etnográfica documentada.",
};

// ============================================================================
// EPISTEMIC CLASSIFIER
// ============================================================================

/**
 * Clasifica el estado epistémico de un claim basándose en evidencia y dominio.
 * Aplica reglas de alta criticidad automáticamente.
 */
export function classifyEpistemicStatus(params: {
  domain: ClaimDomain;
  evidenceCount: number;
  contradictoryCount: number;
  avgRelevance: number;
  hasPrimarySource: boolean;
  hasDateAndScope: boolean;
}): {
  status: EvidenceStatus;
  reasonCode: string;
  requiresManualReview: boolean;
  domainRule: string;
} {
  const { domain, evidenceCount, contradictoryCount, avgRelevance, hasPrimarySource, hasDateAndScope } = params;

  const isHighRisk = HIGH_RISK_DOMAINS.includes(domain);
  const domainRule = DOMAIN_RULES[domain];

  // No evidence at all
  if (evidenceCount === 0) {
    return {
      status: "unavailable",
      reasonCode: "NO_EVIDENCE_AVAILABLE",
      requiresManualReview: false,
      domainRule,
    };
  }

  // Contradictory evidence exists
  if (contradictoryCount > 0) {
    return {
      status: "contradicts",
      reasonCode: "CONTRADICTORY_EVIDENCE_FOUND",
      requiresManualReview: true,
      domainRule,
    };
  }

  // High-risk domain always requires manual review for any positive match
  if (isHighRisk) {
    if (!hasPrimarySource || !hasDateAndScope) {
      return {
        status: "insufficient" as const,
        reasonCode: "HIGH_RISK_MISSING_PRIMARY_SOURCE",
        requiresManualReview: true,
        domainRule,
      };
    }

    // Even with primary source, retrieval is not proof
    if (avgRelevance < 0.3) {
      return {
        status: "insufficient" as const,
        reasonCode: "HIGH_RISK_LOW_RELEVANCE",
        requiresManualReview: true,
        domainRule,
      };
    }

    return {
      status: "insufficient" as const,
      reasonCode: "HIGH_RISK_REQUIRES_MANUAL_REVIEW",
      requiresManualReview: true,
      domainRule,
    };
  }

  // Non-high-risk domains
  if (avgRelevance > 0.6 && evidenceCount >= 2) {
    return {
      status: "contextualizes" as const,
      reasonCode: "MODERATE_RELEVANCE_MULTIPLE_SOURCES",
      requiresManualReview: false,
      domainRule,
    };
  }

  if (avgRelevance > 0.3) {
    return {
      status: "insufficient" as const,
      reasonCode: "LOW_RELEVANCE_SINGLE_SOURCE",
      requiresManualReview: true,
      domainRule,
    };
  }

  return {
    status: "insufficient",
    reasonCode: "RETRIEVAL_NOT_VERIFICATION",
    requiresManualReview: false,
    domainRule,
  };
}

/**
 * Genera el formato epistemológico canónico (Section 11.3)
 */
export function toEpistemicResponse(params: {
  claim: string;
  status: EvidenceStatus;
  confidence: number;
  evidenceIds: string[];
  reasonCode: string;
  caveat?: string;
}) {
  return {
    claim: params.claim,
    status: params.status,
    confidence: params.confidence,
    evidence: params.evidenceIds,
    reasonCode: params.reasonCode,
    caveat: params.caveat ?? "La fuente recuperada no verifica por sí sola la afirmación.",
  };
}

/**
 * Reglas de gobernanza epistemológica
 */
export function getEpistemicRules() {
  return {
    states: {
      supported: "Existe evidencia suficiente y compatible.",
      uncertain: "Evidencia incompleta, ambigua o indirecta.",
      refuted: "Evidencia relevante contradice el claim bajo el mismo alcance.",
      "not-checked": "No se ejecutó verificación.",
      "not-applicable": "No requiere evidencia externa.",
    },
    highRiskDomains: HIGH_RISK_DOMAINS,
    domainRules: DOMAIN_RULES,
    invariants: [
      "Retrieval is never proof",
      "Low score never implies contradiction",
      "High-risk claims always require manual review",
      "Evidence must preserve date and scope",
      "Contradictions must be explicitly exposed",
      "Uncertainty must be visible, never hidden as confidence",
    ],
  };
}
