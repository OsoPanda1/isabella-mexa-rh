/**
 * Isabella Claim Radar Engine
 * Evalúa afirmaciones contra evidencia de adaptadores MCP.
 * Separa relevancia de verificación epistémica.
 *
 * Regla fundamental: la recuperación NO es prueba.
 * Regla de alta criticidad: claims legales, médicos, financieros,
 * académicos o territoriales requieren fuente identificable y evidencia conservada.
 */
import { randomUUID } from "node:crypto";
import { queryAdapters } from "../mcp-adapters/mcp-hub";
import type {
  MCPQueryContext,
  MCPQueryResultV2,
  Claim,
  ClaimDomain,
  EvidenceStatus,
} from "./contracts";
import { createLogger } from "../logger";

const log = createLogger("claim-radar");

// ============================================================================
// HIGH-RISK DOMAINS (Section 11.2)
// ============================================================================

const HIGH_RISK_DOMAINS: ClaimDomain[] = [
  "academic",
  "territorial",
  "legal",
  "medical",
  "financial",
];

// ============================================================================
// CLAIM EVALUATOR
// ============================================================================

/**
 * Evalúa una afirmación contra evidencia de múltiples fuentes.
 *
 * Flujo:
 * 1. Consultar adaptadores MCP (Zenodo, LITLE, OSF)
 * 2. Separar resultados contradictorios vs compatibles
 * 3. Clasificar estado epistémico
 * 4. Generar caveat si la evidencia es indirecta
 * 5. Emitir nivel de evidencia: supported / uncertain / refuted / not-checked / not-applicable
 */
export async function evaluateClaim(params: {
  assertion: string;
  domain: ClaimDomain;
  source: string;
  sourceDoi?: string;
  sourceOrcid?: string;
  adapterIds?: string[];
  maxResults?: number;
  timeoutMs?: number;
}): Promise<Claim> {
  const {
    assertion,
    domain,
    source,
    sourceDoi,
    sourceOrcid,
    adapterIds,
    maxResults = 5,
    timeoutMs = 5000,
  } = params;

  const assertionId = randomUUID();

  // Build query context
  const ctx: MCPQueryContext = {
    requestId: randomUUID(),
    assertionId,
    assertion,
    targetDoi: sourceDoi,
    maxResults,
    deadlineMs: timeoutMs,
    dataClass: HIGH_RISK_DOMAINS.includes(domain) ? "internal" : "public",
  };

  log.info("claim_evaluation_started", {
    assertionId,
    domain,
    source: source.slice(0, 64),
    isHighRisk: HIGH_RISK_DOMAINS.includes(domain),
  });

  // Query adapters
  const { results, adapterStatuses, totalResults } = await queryAdapters(ctx, adapterIds);

  // Separate supporting vs contradictory
  // IMPORTANT: we NEVER declare "contradicts" based solely on low score
  // Contradiction requires explicit semantic comparison
  const supporting: MCPQueryResultV2[] = [];
  const contradictory: MCPQueryResultV2[] = [];

  for (const result of results) {
    if (result.epistemic.status === "contradicts") {
      contradictory.push(result);
    } else {
      supporting.push(result);
    }
  }

  // Determine overall evidence level
  let evidenceLevel: EvidenceStatus;
  let confidence: number;
  let reasonCode: string | undefined;
  let caveat: string | undefined;

  if (totalResults === 0) {
    evidenceLevel = "unavailable";
    confidence = 0;
    reasonCode = "NO_SOURCES_AVAILABLE";
    caveat = "No se pudieron consultar fuentes externas.";
  } else if (contradictory.length > 0) {
    evidenceLevel = "contradicts";
    confidence = 0.3;
    reasonCode = "EVIDENCE_CONTRADICTS_CLAIM";
    caveat = "Evidencia relevante contradice la afirmación bajo el mismo alcance.";
  } else if (supporting.length > 0) {
    // Supporting results exist, but retrieval ≠ verification
    const avgRelevance = supporting.reduce((sum, r) => sum + r.relevance.score, 0) / supporting.length;

    if (avgRelevance > 0.5) {
      evidenceLevel = "insufficient";
      confidence = Math.min(0.7, avgRelevance);
      reasonCode = "INDIRECT_EVIDENCE";
      caveat = "La fuente recuperada no verifica por sí sola la afirmación. Se requiere revisión manual para claims de alto riesgo.";
    } else {
      evidenceLevel = "insufficient";
      confidence = Math.min(0.4, avgRelevance);
      reasonCode = "LOW_RELEVANCE_RETRIEVAL";
      caveat = "Baja relevancia lexical. La verificación epistémica requiere comparación semántica y revisión humana.";
    }
  } else {
    evidenceLevel = "unavailable";
    confidence = 0;
    reasonCode = "RETRIEVAL_RETURNED_NOTHING_USEFUL";
  }

  // High-risk domain rules
  if (HIGH_RISK_DOMAINS.includes(domain)) {
    // For high-risk domains, retrieval is always insufficient — require manual review
    if (evidenceLevel !== "contradicts" && evidenceLevel !== "unavailable") {
      evidenceLevel = "insufficient";
      confidence = Math.min(confidence, 0.6);
    }
    caveat = caveat
      ? `${caveat} [Dominio de alto riesgo: ${domain}]`
      : `Dominio de alto riesgo (${domain}): la evidencia recuperada no constituye prueba definitiva.`;
  }

  const claim: Claim = {
    claimId: assertionId,
    assertion,
    domain,
    source,
    sourceDoi,
    sourceOrcid,
    evidenceLevel,
    confidence,
    supportingResults: supporting,
    contradictoryResults: contradictory,
    evaluatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 720 * 3600_000).toISOString(), // 30 days default
    ttlHours: 720,
    reasonCode,
    caveat,
  };

  log.info("claim_evaluation_completed", {
    assertionId,
    evidenceLevel,
    confidence,
    supportingCount: supporting.length,
    contradictoryCount: contradictory.length,
    adapterStatuses,
  });

  return claim;
}

/**
 * Formato epistemológico canónico (Section 11.3)
 */
export function toEpistemicFormat(claim: Claim) {
  return {
    claim: claim.assertion,
    status: claim.evidenceLevel,
    confidence: claim.confidence,
    evidence: [
      ...claim.supportingResults.map((r) => r.evidenceId),
      ...claim.contradictoryResults.map((r) => r.evidenceId),
    ],
    reasonCode: claim.reasonCode,
    caveat: claim.caveat,
  };
}

/**
 * Métricas del Claim Radar
 */
export function getClaimRadarMetrics() {
  return {
    highRiskDomains: HIGH_RISK_DOMAINS,
    rules: [
      "Retrieval is not verification",
      "Low score ≠ contradiction",
      "High-risk domains require manual review",
      "Evidence must preserve date and scope",
      "Contradictions must be exposed",
    ],
  };
}
