/**
 * ============================================================================
 * ISABELLA PLATFORM — GOVERNED FEATURE FLAGS CATALOGUE
 * ============================================================================
 * Source of truth for all feature gates, experiments, and operational flags.
 * Every flag is declared, typed, risk-assessed, and bounded by expiry and
 * environment restrictions.
 * ============================================================================
 */

export type FeatureFlagKey =
  | "tamv_7_federations_routing"
  | "isabella_ai_model_fallback"
  | "isabella_conversational_canvas_v2"
  | "isabella_strict_rate_limiting"
  | "isabella_graph_memory"
  | "isabella_quantum_route";

export type FeatureFlagType = "release" | "experiment" | "operational" | "kill_switch";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface FeatureFlagDefinition {
  readonly key: FeatureFlagKey;
  readonly type: FeatureFlagType;
  readonly risk: RiskLevel;
  readonly description: string;
  readonly owner: string;
  readonly defaultValue: boolean;
  readonly productionValue: boolean;
  readonly expiresAt: string;
  readonly requiresAudit: boolean;
  readonly requiresApproval: boolean;
  readonly allowedEnvironments: readonly string[];
}

export const FEATURE_FLAGS: Readonly<Record<FeatureFlagKey, FeatureFlagDefinition>> =
  Object.freeze({
    tamv_7_federations_routing: {
      key: "tamv_7_federations_routing",
      type: "release",
      risk: "high",
      description: "Enrutamiento progresivo entre las siete federaciones TAMV.",
      owner: "architecture-board",
      defaultValue: false,
      productionValue: false,
      expiresAt: "2027-02-28T00:00:00.000Z",
      requiresAudit: true,
      requiresApproval: true,
      allowedEnvironments: ["development", "preview", "staging"],
    },
    isabella_ai_model_fallback: {
      key: "isabella_ai_model_fallback",
      type: "operational",
      risk: "critical",
      description: "Permite conmutar a un modelo secundario ante timeout o error.",
      owner: "platform-reliability",
      defaultValue: true,
      productionValue: true,
      expiresAt: "2027-12-31T00:00:00.000Z",
      requiresAudit: true,
      requiresApproval: true,
      allowedEnvironments: ["development", "preview", "staging", "production"],
    },
    isabella_conversational_canvas_v2: {
      key: "isabella_conversational_canvas_v2",
      type: "experiment",
      risk: "medium",
      description: "Nueva versión del canvas conversacional y terminal inmersiva.",
      owner: "product-platform",
      defaultValue: false,
      productionValue: false,
      expiresAt: "2026-12-31T00:00:00.000Z",
      requiresAudit: true,
      requiresApproval: true,
      allowedEnvironments: ["development", "preview", "staging", "production"],
    },
    isabella_strict_rate_limiting: {
      key: "isabella_strict_rate_limiting",
      type: "kill_switch",
      risk: "critical",
      description: "Activa límites estrictos ante abuso o ataque distribuido.",
      owner: "security",
      defaultValue: false,
      productionValue: false,
      expiresAt: "2027-12-31T00:00:00.000Z",
      requiresAudit: true,
      requiresApproval: false,
      allowedEnvironments: ["development", "preview", "staging", "production"],
    },
    isabella_graph_memory: {
      key: "isabella_graph_memory",
      type: "release",
      risk: "high",
      description: "Activa memoria organizacional basada en Knowledge Graph.",
      owner: "cognitive-platform",
      defaultValue: false,
      productionValue: false,
      expiresAt: "2027-06-30T00:00:00.000Z",
      requiresAudit: true,
      requiresApproval: true,
      allowedEnvironments: ["development", "preview", "staging"],
    },
    isabella_quantum_route: {
      key: "isabella_quantum_route",
      type: "operational",
      risk: "critical",
      description: "Permite seleccionar una ruta cuántica experimental sobre QPU/Simulador.",
      owner: "quantum-platform",
      defaultValue: false,
      productionValue: false,
      expiresAt: "2026-12-31T00:00:00.000Z",
      requiresAudit: true,
      requiresApproval: true,
      allowedEnvironments: ["development", "preview", "staging"],
    },
  });

export const FEATURE_FLAG_KEYS = Object.freeze(
  Object.keys(FEATURE_FLAGS) as FeatureFlagKey[],
);
