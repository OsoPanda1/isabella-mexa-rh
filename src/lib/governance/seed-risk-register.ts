/* ============================================================================
 * Governance — Seed AI Risk Register
 *
 * Registro versionado de riesgos iniciales de Isabella (AI-RISK-0001 a
 * AI-RISK-0020). Se carga en el runtime para consulta por API y para que el
 * change-gating pueda consultar tiers/owners. Los owners reales y la evidencia
 * se completan en los artefactos YAML (governance/risk-register/).
 * ============================================================================ */
import { riskRegister, type RiskLikelihood, type RiskImpact } from "./risk";

export { riskRegister };

type Seed = {
  riskId: string;
  title: string;
  component: string;
  owner: string;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  humanRights: string[];
  existingControls: string[];
  mitigations: string[];
  prohibited?: boolean;
};

const SEED: Seed[] = [
  { riskId: "AI-RISK-0001", title: "Fuga de datos entre tenants", component: "memory-retrieval", owner: "security-owner", likelihood: "possible", impact: "critical", humanRights: ["privacy"], existingControls: ["tenant-isolation"], mitigations: ["backend-tenant-derivation"], prohibited: true },
  { riskId: "AI-RISK-0002", title: "Alucinación presentada como hecho verificado", component: "inference", owner: "model-owner", likelihood: "probable", impact: "high", humanRights: ["information"], existingControls: ["epistemic"], mitigations: ["claim-radar"] },
  { riskId: "AI-RISK-0003", title: "Sesgo en clasificación o recomendación", component: "classification", owner: "model-owner", likelihood: "possible", impact: "high", humanRights: ["non-discrimination"], existingControls: [], mitigations: ["bias-eval"] },
  { riskId: "AI-RISK-0004", title: "Decisión automática sin revisión humana", component: "orchestration", owner: "privacy-owner", likelihood: "possible", impact: "high", humanRights: ["due-process"], existingControls: ["human-oversight"], mitigations: ["approval-gate"], prohibited: true },
  { riskId: "AI-RISK-0005", title: "Prompt injection en herramientas", component: "tools", owner: "security-owner", likelihood: "probable", impact: "high", humanRights: ["security"], existingControls: ["prompt-injection-guard"], mitigations: ["input-sanitization"] },
  { riskId: "AI-RISK-0006", title: "Ejecución de herramienta no autorizada", component: "tools-catalog", owner: "security-owner", likelihood: "possible", impact: "high", humanRights: ["security"], existingControls: ["scope"], mitigations: ["tool-allowlist"] },
  { riskId: "AI-RISK-0007", title: "Compromiso de proveedor externo", component: "providers", owner: "platform-owner", likelihood: "rare", impact: "high", humanRights: ["privacy"], existingControls: ["inventory"], mitigations: ["third-party-governance"] },
  { riskId: "AI-RISK-0008", title: "Pérdida o corrupción de memoria", component: "memory-store", owner: "data-steward", likelihood: "rare", impact: "medium", humanRights: ["privacy"], existingControls: ["postgres"], mitigations: ["backup-restore"] },
  { riskId: "AI-RISK-0009", title: "Ledger presentado como inmutable sin verificación", component: "ledger", owner: "audit-owner", likelihood: "possible", impact: "critical", humanRights: ["integrity"], existingControls: ["checksum"], mitigations: ["verify"] },
  { riskId: "AI-RISK-0010", title: "Exposición de secretos en logs o frontend", component: "logging", owner: "security-owner", likelihood: "possible", impact: "critical", humanRights: ["privacy"], existingControls: ["secret-scan"], mitigations: ["redaction"], prohibited: true },
  { riskId: "AI-RISK-0011", title: "Uso de datos sin base jurídica", component: "data", owner: "legal-counsel", likelihood: "possible", impact: "high", humanRights: ["privacy"], existingControls: [], mitigations: ["dpa"] },
  { riskId: "AI-RISK-0012", title: "Abuso del kill switch", component: "kill-switch", owner: "security-owner", likelihood: "rare", impact: "critical", humanRights: ["security"], existingControls: ["approval"], mitigations: ["h3-approval"], prohibited: true },
  { riskId: "AI-RISK-0013", title: "Prueba ZK falsa o no confirmada", component: "crypto", owner: "crypto-owner", likelihood: "rare", impact: "high", humanRights: ["integrity"], existingControls: [], mitigations: ["verify"] },
  { riskId: "AI-RISK-0014", title: "Coste excesivo por quantum/tool jobs", component: "jobs", owner: "platform-owner", likelihood: "rare", impact: "medium", humanRights: [], existingControls: ["budget"], mitigations: ["quotas"] },
  { riskId: "AI-RISK-0015", title: "Fallo de disponibilidad o dependencia externa", component: "infra", owner: "platform-owner", likelihood: "possible", impact: "medium", humanRights: [], existingControls: ["circuit-breaker"], mitigations: ["redundancy"] },
  { riskId: "AI-RISK-0016", title: "Modelo fuera de distribución", component: "model", owner: "model-owner", likelihood: "rare", impact: "medium", humanRights: [], existingControls: [], mitigations: ["drift"] },
  { riskId: "AI-RISK-0017", title: "Salida discriminatoria", component: "inference", owner: "model-owner", likelihood: "possible", impact: "high", humanRights: ["non-discrimination"], existingControls: [], mitigations: ["bias-eval"], prohibited: true },
  { riskId: "AI-RISK-0018", title: "Fallo de supervisión humana", component: "oversight", owner: "privacy-owner", likelihood: "possible", impact: "high", humanRights: ["due-process"], existingControls: ["human-oversight"], mitigations: ["approval-gate"] },
  { riskId: "AI-RISK-0019", title: "Dependencia vulnerable o paquete malicioso", component: "deps", owner: "security-owner", likelihood: "possible", impact: "medium", humanRights: ["security"], existingControls: ["audit"], mitigations: ["dependency-pinning"] },
  { riskId: "AI-RISK-0020", title: "Confusión entre simulación y estado real", component: "ui", owner: "data-steward", likelihood: "probable", impact: "high", humanRights: ["transparency"], existingControls: ["labeling"], mitigations: ["provenance"] },
];

let seeded = false;

export function seedRiskRegister(): void {
  if (seeded) return;
  for (const seed of SEED) {
    riskRegister.register({
      ...seed,
      system: "Isabella",
      riskTier: seed.prohibited ? "PROHIBITED" : "MEDIUM",
      status: "open",
      evidenceRefs: [],
      acceptanceCriteria: [],
    });
  }
  seeded = true;
}
