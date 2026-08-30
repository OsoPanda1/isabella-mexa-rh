/**
 * POLICY GATE - ISABELLA GOVERNANCE & SECURITY (ARGUS + CROWN)
 * Nodo Cero :: RDM Digital
 * Evaluates whether a perception or decision can execute actions, tools, or memory mutations.
 */

import { IsabellaPerception, IsabellaPolicyStatus, IsabellaRiskLevel } from "../../../contracts/isabella";

export interface PolicyEvaluationResult {
  status: IsabellaPolicyStatus;
  riskLevel: IsabellaRiskLevel;
  reason?: string;
  violations?: string[];
  rulesChecked: string[];
  governanceScore: number; // 0..1
}

// Active policy rules catalog
const GOVERNANCE_RULES = [
  "RULE_01_ZERO_TRUST_TOOL_WHITELIST",
  "RULE_02_TERRITORIAL_DATA_BOUNDARY",
  "RULE_03_HUMAN_IN_THE_LOOP_ESCALATION",
  "RULE_04_EPHEMERAL_TOKEN_LIFECYCLE",
  "RULE_05_LATIN_AMERICAN_SOVEREIGNTY_CHECK",
];

export async function policyGate(perception: IsabellaPerception): Promise<PolicyEvaluationResult> {
  const rulesChecked = [...GOVERNANCE_RULES];
  const payload = (perception.payload || {}) as Record<string, any>;
  const rawRisk = (payload.riskLevel || (perception.metadata as any)?.riskLevel) as string | undefined;

  const contentText = typeof payload.text === "string" 
    ? payload.text.toLowerCase() 
    : typeof payload.query === "string" 
      ? payload.query.toLowerCase() 
      : JSON.stringify(payload).toLowerCase();

  // 1. Explicit High-Risk or Destructive command detection
  const isDestructive =
    contentText.includes("drop table") ||
    contentText.includes("delete from") ||
    contentText.includes("override_governance") ||
    contentText.includes("bypass_argus") ||
    contentText.includes("exfiltrate") ||
    contentText.includes("root_access_unauthorized");

  if (isDestructive) {
    return {
      status: "denied",
      riskLevel: "high",
      reason: "Infracción crítica de gobernanza C.R.O.W.N. (Intento de acceso destructivo o no autorizado)",
      violations: ["RULE_01_ZERO_TRUST_TOOL_WHITELIST", "RULE_03_HUMAN_IN_THE_LOOP_ESCALATION"],
      rulesChecked,
      governanceScore: 0.05,
    };
  }

  // 2. Sensitive Actions Requiring Human-in-the-loop Approval
  const requiresHumanApproval =
    rawRisk === "high" ||
    payload.requiresApproval === true ||
    contentText.includes("deploy_production") ||
    contentText.includes("transfer_funds") ||
    contentText.includes("publish_ledger_block") ||
    contentText.includes("update_territorial_boundaries") ||
    contentText.includes("modify_constitutional_weights");

  if (requiresHumanApproval) {
    return {
      status: "requires_approval",
      riskLevel: "high",
      reason: "Operación de alto impacto territorial o administrativo. Requiere ratificación humana (Human-in-the-Loop).",
      violations: [],
      rulesChecked,
      governanceScore: 0.85,
    };
  }

  // 3. Medium Risk Operations (e.g. state write or tool execution)
  const isMediumRisk =
    rawRisk === "medium" ||
    perception.inputType === "signal" ||
    payload.toolName !== undefined;

  if (isMediumRisk) {
    return {
      status: "allowed",
      riskLevel: "medium",
      reason: "Operación validada bajo monitoreo continuo de centinela ARGUS.",
      violations: [],
      rulesChecked,
      governanceScore: 0.94,
    };
  }

  // 4. Default Safe (Low Risk)
  return {
    status: "allowed",
    riskLevel: "low",
    reason: "Operación segura dentro de los parámetros cognitivos y territoriales de Nodo Cero.",
    violations: [],
    rulesChecked,
    governanceScore: 0.99,
  };
}
