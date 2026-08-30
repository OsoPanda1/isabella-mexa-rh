/**
 * Isabella Automation Mesh — Contratos
 * Define los tipos para el sistema de automatizaciones auto-gestionadas.
 *
 * Filosofía: La complejidad es la misma, pero se ejecuta de forma elegante.
 * Cuando algo falla, el humano solo describe qué hacer → la malla reconecta todo.
 */
import { z } from "zod";

// ============================================================================
// AUTOMATION STATUS
// ============================================================================

export const AutomationStatusSchema = z.enum([
  "healthy",
  "degraded",
  "failing",
  "offline",
  "recovering",
  "unknown",
]);
export type AutomationStatus = z.infer<typeof AutomationStatusSchema>;

export const AutomationSeveritySchema = z.enum([
  "info",
  "warning",
  "critical",
  "catastrophic",
]);
export type AutomationSeverity = z.infer<typeof AutomationSeveritySchema>;

// ============================================================================
// AUTOMATION NODE — The fundamental unit
// ============================================================================

export const AutomationNodeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(512),
  category: z.enum([
    "identity",
    "consent",
    "policy",
    "intent",
    "quantum",
    "registry",
    "scheduler",
    "workers",
    "execution",
    "crypto",
    "hsm",
    "tee",
    "audit",
    "blockchain",
    "persistence",
    "backup",
    "telemetry",
    "federation",
    "recovery",
    "cognitive",
    "multimodal",
    "billing",
    "security",
    "territorial",
  ]),
  complexity: z.enum(["simple", "moderate", "complex", "critical"]),
  codeFiles: z.array(z.string()),
  dependencies: z.array(z.string()),
  dependents: z.array(z.string()),
  healthCheck: z.string().max(256),
  repairProcedure: z.string().max(1024),
  humanDescription: z.string().max(256),
  developerGuide: z.string().max(1024),
});
export type AutomationNode = z.infer<typeof AutomationNodeSchema>;

// ============================================================================
// FAILURE DETECTION
// ============================================================================

export const FailureEventSchema = z.object({
  failureId: z.string().uuid(),
  nodeId: z.string(),
  detectedAt: z.string().datetime(),
  severity: AutomationSeveritySchema,
  message: z.string().max(1024),
  symptoms: z.array(z.string().max(256)),
  affectedNodes: z.array(z.string()),
  rootCause: z.string().max(512).optional(),
  repairPlan: z.array(z.object({
    step: z.number().int().min(1),
    action: z.string().max(256),
    nodeId: z.string(),
    automated: z.boolean(),
    humanRequired: z.boolean(),
    humanInstruction: z.string().max(512).optional(),
  })),
  status: z.enum(["detected", "repairing", "repaired", "escalated", "abandoned"]),
  completedAt: z.string().datetime().optional(),
});
export type FailureEvent = z.infer<typeof FailureEventSchema>;

// ============================================================================
// HUMAN DESCRIPTION — Natural language input
// ============================================================================

export const HumanDescriptionSchema = z.object({
  rawText: z.string().min(1).max(2048),
  parsedIntent: z.enum([
    "report_failure",
    "request_status",
    "explain_module",
    "guide_repair",
    "list_dependencies",
    "onboard_developer",
  ]),
  matchedNodeIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  suggestedActions: z.array(z.string().max(256)),
});
export type HumanDescription = z.infer<typeof HumanDescriptionSchema>;

// ============================================================================
// REPAIR CHAIN — A + B + C + D + E alignment
// ============================================================================

export const RepairChainSchema = z.object({
  chainId: z.string().uuid(),
  trigger: z.string().max(512),
  nodes: z.array(z.object({
    nodeId: z.string(),
    order: z.number().int().min(1),
    action: z.string().max(256),
    status: z.enum(["pending", "executing", "success", "failed", "skipped"]),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    error: z.string().max(512).optional(),
  })),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  overallStatus: z.enum(["pending", "in_progress", "completed", "failed"]),
});
export type RepairChain = z.infer<typeof RepairChainSchema>;
