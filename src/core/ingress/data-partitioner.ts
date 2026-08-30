/**
 * ================================================================
 * ISABELLA VILLASEÑOR AI — DATA PARTITIONER
 * Intelligent data routing across the 12-module mesh.
 * Categorizes incoming data, assigns priority, determines optimal
 * module distribution, prevents overload on any single module.
 * ================================================================
 */
import type { IngressRoute, IngressPriority } from "./ingress-distributor";
import { isModuleHealthy } from "./health-monitor";

/* =========================================================================
   TYPES
   ========================================================================= */

export interface PartitionResult {
  readonly routes: IngressRoute[];
  readonly priority: IngressPriority;
  readonly estimatedTokens: number;
  readonly category: string;
  readonly reasoning: string;
}

export interface ModuleLoad {
  readonly moduleId: IngressRoute;
  readonly activeItems: number;
  readonly avgProcessingMs: number;
  readonly loadPercent: number;
}

/* =========================================================================
   LOAD TRACKING
   ========================================================================= */

const moduleLoads = new Map<string, { active: number; totalMs: number; count: number }>();

function trackStart(moduleId: string): void {
  const load = moduleLoads.get(moduleId) || { active: 0, totalMs: 0, count: 0 };
  load.active++;
  moduleLoads.set(moduleId, load);
}

function trackEnd(moduleId: string, processingMs: number): void {
  const load = moduleLoads.get(moduleId);
  if (!load) return;
  load.active = Math.max(0, load.active - 1);
  load.totalMs += processingMs;
  load.count++;
  moduleLoads.set(moduleId, load);
}

/* =========================================================================
   DATA CLASSIFICATION
   ========================================================================= */

const HIGH_PRIORITY_PATTERNS = [
  /\b(emergencia|emergency|urgent|urgente|critical|crítico)\b/i,
  /\b(delete|eliminar|destroy|borrar)\b/i,
  /\b(pay|pagar|transfer|enviar dinero)\b/i,
];

const LOW_PRIORITY_PATTERNS = [
  /\b(heartbeat|ping|status|health)\b/i,
  /\b(log|telemetry|metric)\b/i,
  /\b(readonly|lectura|consulta)\b/i,
];

function classifyPriority(dataType: string, payload: Record<string, unknown>): IngressPriority {
  const combined = `${dataType} ${JSON.stringify(payload)}`;
  if (HIGH_PRIORITY_PATTERNS.some((p) => p.test(combined))) return "high";
  if (LOW_PRIORITY_PATTERNS.some((p) => p.test(combined))) return "low";
  return "medium";
}

function estimateTokens(payload: Record<string, unknown>): number {
  return Math.ceil(JSON.stringify(payload).length / 3.5);
}

/* =========================================================================
   ROUTE OPTIMIZATION
   ========================================================================= */

const CAPACITY_LIMITS: Record<string, number> = {
  orchestrator: 50,
  "prompt-builder": 100,
  "context-compressor": 80,
  planner: 40,
  "skill-registry": 60,
  "provider-registry": 30,
  "tool-dispatch": 50,
  gateway: 100,
  consent: 80,
  safety: 60,
  "data-rights": 40,
  "audit-receipt": 200,
  "bookpi-legacy": 30,
};

function getModuleLoad(moduleId: string): number {
  const load = moduleLoads.get(moduleId);
  if (!load) return 0;
  const limit = CAPACITY_LIMITS[moduleId] || 50;
  return (load.active / limit) * 100;
}

function optimizeRoutes(
  candidates: IngressRoute[],
  priority: IngressPriority,
): IngressRoute[] {
  if (priority === "critical") return candidates;

  return candidates.filter((route) => {
    if (!isModuleHealthy(route)) {
      return priority !== "low";
    }
    const load = getModuleLoad(route);
    if (load > 90 && priority !== "high") return false;
    return true;
  });
}

/* =========================================================================
   PUBLIC API
   ========================================================================= */

export function partitionData(params: {
  dataType: string;
  payload: Record<string, unknown>;
  availableRoutes?: IngressRoute[];
}): PartitionResult {
  const { dataType, payload, availableRoutes } = params;

  const defaultRoutes: IngressRoute[] = [
    "orchestrator", "audit-receipt", "bookpi-legacy",
  ];

  const routes = optimizeRoutes(availableRoutes || defaultRoutes, classifyPriority(dataType, payload));
  const priority = classifyPriority(dataType, payload);
  const tokens = estimateTokens(payload);

  let category = "general";
  if (dataType.startsWith("user.")) category = "user-interaction";
  else if (dataType.startsWith("tool.")) category = "tool-execution";
  else if (dataType.startsWith("memory.")) category = "memory-ops";
  else if (dataType.startsWith("plan.")) category = "planning";
  else if (dataType.startsWith("skill.")) category = "skill-ops";
  else if (dataType.startsWith("consent.")) category = "governance";
  else if (dataType.startsWith("safety.")) category = "security";
  else if (dataType.startsWith("data.")) category = "data-rights";
  else if (dataType.startsWith("audit.")) category = "compliance";
  else if (dataType.startsWith("system.")) category = "system";

  return {
    routes,
    priority,
    estimatedTokens: tokens,
    category,
    reasoning: `Classified as ${category} with ${priority} priority. ${routes.length} routes selected from ${availableRoutes?.length || "default"} candidates.`,
  };
}

export function getModuleLoadSnapshot(): ModuleLoad[] {
  const loads: ModuleLoad[] = [];
  for (const [id] of moduleLoads) {
    const load = moduleLoads.get(id)!;
    const limit = CAPACITY_LIMITS[id] || 50;
    loads.push({
      moduleId: id as IngressRoute,
      activeItems: load.active,
      avgProcessingMs: load.count > 0 ? Math.round(load.totalMs / load.count) : 0,
      loadPercent: Math.round((load.active / limit) * 100),
    });
  }
  return loads;
}

export function trackModuleProcessing<T>(moduleId: string, fn: () => T): T {
  trackStart(moduleId);
  const t0 = Date.now();
  try {
    const result = fn();
    trackEnd(moduleId, Date.now() - t0);
    return result;
  } catch (err) {
    trackEnd(moduleId, Date.now() - t0);
    throw err;
  }
}
