/* ============================================================================
 * Governance — Incident Management
 *
 * Severidades SEV-1..SEV-4 y un runbook estructurado (detectar → contener →
 * preservar evidencia → revocar → notificar → corregir → verificar →
 * postmortem). Cada incidente queda versionado con propietario y evidencia.
 * ============================================================================ */

export type SeverityLevel = "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";

export interface IncidentRibbon {
  severity: SeverityLevel;
  phase: "detecting" | "containing" | "preserving" | "revoking" | "notifying" | "correcting" | "verifying" | "postmortem";
  owner: string;
  summary: string;
  openedAt: string;
  resolvedAt?: string;
}

export const SEVERITY_CRITERIA: Record<SeverityLevel, string> = {
  "SEV-1": "Exposición de secretos, bypass de auth o pérdida financiera.",
  "SEV-2": "Fallo de aislamiento entre tenants, integridad de ledger o corrupción de datos.",
  "SEV-3": "Degradación de servicio o error de política no crítico.",
  "SEV-4": "Defecto visual o documental.",
};

export const INCIDENT_RUNBOOK: IncidentRibbon["phase"][] = [
  "detecting",
  "containing",
  "preserving",
  "revoking",
  "notifying",
  "correcting",
  "verifying",
  "postmortem",
];

export function classifyIncident(summary: string): SeverityLevel {
  const s = summary.toLowerCase();
  if (/(tenant|isolation|ledger|corrupt|integrity|data loss|tamper)/.test(s)) return "SEV-2";
  if (/(secret|token|key|breach|bypass|auth|financial|funds|payout|exposure)/.test(s)) return "SEV-1";
  if (/(degrad|timeout|policy error|unavailable)/.test(s)) return "SEV-3";
  return "SEV-4";
}
