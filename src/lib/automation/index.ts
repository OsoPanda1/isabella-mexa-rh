/**
 * Isabella Automation Mesh — Barrel
 * Exporta todo el sistema de automatizaciones auto-gestionadas.
 *
 * Uso:
 *   import { describeProblem, explainToDeveloper, getSystemSummary } from "@/lib/automation";
 */
export { AUTOMATION_ATLAS, getAutomationNode, getNodesByCategory, getDependencyChain, getAffectedChain, getAtlasStats } from "./registry";
export { checkNodeHealth, checkAllHealth, startMonitoring, stopMonitoring, detectAndHeal, createRepairChain, executeRepairStep, getMeshStatus, getActiveFailures, getActiveRepairChains, resolveFailureManually } from "./mesh";
export { parseHumanDescription, describeProblem, explainToDeveloper, getSystemSummary } from "./human-interface";
export type { AutomationNode, AutomationStatus, AutomationSeverity, FailureEvent, HumanDescription, RepairChain } from "./contracts";
