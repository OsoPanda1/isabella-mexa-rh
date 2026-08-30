/* ============================================================================
 * Governance — Transparency & Provenance
 *
 * Cada respuesta / decisión de Isabella debe exponer metadata de procedencia:
 * qué modelo, qué versión, qué política, origen de datos y si hubo revisión
 * humana. Esto implementa transparencia y trazabilidad (UNESCO/ONU) sin
 * afirmar "verificación" que no exista.
 * ============================================================================ */

export interface Provenance {
  provenance: {
    modelId: string;
    modelVersion: string;
    systemVersion: string;
    policyVersion: string;
    dataOrigin: "live" | "simulated" | "demo" | "local";
    humanReview: "not_required" | "pending" | "completed";
  };
}

const POLICY_VERSION = "2026.08.1";

export function buildProvenance(opts?: Partial<Provenance["provenance"]>): Provenance {
  return {
    provenance: {
      modelId: opts?.modelId ?? "isabella-sovereign",
      modelVersion: opts?.modelVersion ?? process.env.npm_package_version ?? "5.3.0",
      systemVersion: opts?.systemVersion ?? process.env.npm_package_version ?? "5.3.0",
      policyVersion: opts?.policyVersion ?? POLICY_VERSION,
      dataOrigin: opts?.dataOrigin ?? (process.env.NODE_ENV === "production" ? "live" : "local"),
      humanReview: opts?.humanReview ?? "not_required",
    },
  };
}

export function requireHumanReview(
  highRisk: boolean,
): Provenance["provenance"]["humanReview"] {
  if (!highRisk) return "not_required";
  return "pending";
}
