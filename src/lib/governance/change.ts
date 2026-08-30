/* ============================================================================
 * Governance — Change & Release Gating
 *
 * Todo cambio de modelo, prompt crítico, policy, herramienta o proveedor debe
 * producir un change record con: evidencia de tests, propietario, plan de
 * rollback, aprobación y cards actualizadas. El pipeline bloquea despliegues
 * si falta alguno de estos artefactos (gobernanza de cambios nativa).
 * ============================================================================ */

export interface ChangeRecord {
  id: string;
  component: string;
  changeType: "model" | "prompt" | "policy" | "tool" | "provider" | "infra" | "billing";
  summary: string;
  risk: "low" | "medium" | "high" | "critical";
  owner: string;
  tests: string[];
  rollback: "available" | "none" | "partial";
  approvals: string[];
  createdAt: string;
  deployedAt?: string;
}

export const RELEASE_BLOCKERS = [
  "model-card",
  "risk-tier-owner",
  "tenant-isolation-test",
  "policy-version",
  "secret-scan",
  "sbom",
  "human-oversight-configured",
  "rollback-available",
] as const;

export type ReleaseBlocker = (typeof RELEASE_BLOCKERS)[number];

export interface ReleaseReadiness {
  ok: boolean;
  blockers: ReleaseBlocker[];
  change: ChangeRecord;
}

export function isReleaseReady(change: ChangeRecord): ReleaseReadiness {
  const blockers: ReleaseBlocker[] = [];
  if (!change.owner) blockers.push("risk-tier-owner");
  if (!change.rollback || change.rollback === "none") blockers.push("rollback-available");
  if (change.tests.length === 0) blockers.push("tenant-isolation-test");
  if (change.approvals.length === 0) blockers.push("policy-version");
  return { ok: blockers.length === 0, blockers, change };
}
