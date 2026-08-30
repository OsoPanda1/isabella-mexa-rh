/**
 * Isabella Quantum Mesh — Contratos Zod & Tipos TypeScript
 * Todos los contratos de la malla cuántica gobernada.
 * Regla de realidad: completed / degraded / rejected / failed — nunca etiquetar fallback como cuántico.
 */
import { z } from "zod";

// ============================================================================
// SCHEMAS ZOD
// ============================================================================

export const QuantumStatusSchema = z.enum(["completed", "degraded", "rejected", "failed"]);
export type QuantumStatus = z.infer<typeof QuantumStatusSchema>;

export const ExecutionModeSchema = z.enum(["analytic", "sampled"]);
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;

export const JobPrioritySchema = z.enum(["interactive", "normal", "batch"]);
export type JobPriority = z.infer<typeof JobPrioritySchema>;

export const DeviceTrustSchema = z.enum(["local", "remote-simulator", "qpu", "experimental"]);
export type DeviceTrust = z.infer<typeof DeviceTrustSchema>;

export const WorkerPoolSchema = z.enum(["core", "lightning", "qiskit", "braket", "rigetti", "catalyst"]);
export type WorkerPool = z.infer<typeof WorkerPoolSchema>;

// ---- Quantum Request ----

export const QuantumRequestSchema = z.object({
  schema: z.literal("isabella-quantum-v1"),
  requestId: z.string().uuid(),
  traceId: z.string().min(16).max(128),
  tenantId: z.string().min(1).max(128),
  subjectId: z.string().min(1).max(128),
  provider: z.string().min(1).max(96),
  repository: z.string().min(1).max(160),
  mode: ExecutionModeSchema,
  wires: z.number().int().min(1).max(24),
  shots: z.number().int().min(1).max(100_000).nullable(),
  features: z.array(z.number().finite()).max(32),
  weights: z.array(z.number().finite()).max(32),
  scopes: z.array(z.string().max(128)).max(64),
  policyVersion: z.string().min(1).max(128),
  metadata: z.record(z.string(), z.string().max(256)).default({}),
});
export type QuantumRequest = z.infer<typeof QuantumRequestSchema>;

// ---- Isabella Event ----

export const IsabellaEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1).max(256),
  schemaVersion: z.string().min(1).max(32),
  traceId: z.string().min(16).max(128),
  requestId: z.string().uuid(),
  tenantId: z.string().min(1).max(128),
  subjectId: z.string().min(1).max(128),
  originCore: z.number().int().min(1).max(24),
  targetCore: z.number().int().min(1).max(24).optional(),
  occurredAt: z.string().datetime(),
  policyVersion: z.string().min(1).max(128),
  payloadHash: z.string().min(64).max(128),
  previousEventHash: z.string().min(64).max(128).optional(),
  data: z.unknown(),
});
export type IsabellaEvent<T = unknown> = z.infer<typeof IsabellaEventSchema> & { data: T };

// ---- BookPI Quantum Block ----

export const BookPIBlockSchema = z.object({
  version: z.literal("bookpi-quantum-v1"),
  blockHash: z.string().min(64).max(128),
  previousHash: z.string().min(64).max(128),
  requestId: z.string().uuid(),
  tenantId: z.string().min(1).max(128),
  circuitHash: z.string().min(64).max(128),
  implementation: z.string().min(1).max(128),
  status: QuantumStatusSchema,
  policyVersion: z.string().min(1).max(128),
  signerKeyId: z.string().min(1).max(128),
  teeVerified: z.boolean(),
  createdAt: z.string().datetime(),
});
export type BookPIBlock = z.infer<typeof BookPIBlockSchema>;

// ---- Policy Decision ----

export const PolicyDecisionSchema = z.object({
  decision: z.enum(["allow", "deny", "degraded"]),
  reason: z.string().min(1).max(512),
  maxTimeoutMs: z.number().int().min(0),
  maxWires: z.number().int().min(0).max(24),
  maxShots: z.number().int().min(0).max(100_000),
  requiresApproval: z.boolean(),
});
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

// ---- Principal ----

export const PrincipalSchema = z.object({
  subjectId: z.string().min(1).max(128),
  tenantId: z.string().min(1).max(128),
  role: z.enum(["user", "agent", "operator", "service"]),
  scopes: z.array(z.string().max(128)),
  webauthnVerified: z.boolean(),
  riskLevel: z.enum(["low", "medium", "high"]),
});
export type Principal = z.infer<typeof PrincipalSchema>;

// ---- Device Capability ----

export const DeviceCapabilitySchema = z.object({
  provider: z.string().min(1).max(96),
  implementation: z.string().min(1).max(128),
  repository: z.string().min(1).max(160),
  requiredScopes: z.array(z.string().max(128)),
  trust: DeviceTrustSchema,
  remote: z.boolean(),
  supportsAnalytic: z.boolean(),
  supportsShots: z.boolean(),
  supportsGradients: z.boolean(),
  supportsCatalyst: z.boolean(),
  requiredSecrets: z.array(z.string().max(128)),
  enabled: z.boolean(),
  version: z.string().max(64).optional(),
  lastSmokeTest: z.string().datetime().optional(),
  smokeTestPassed: z.boolean().optional(),
});
export type DeviceCapability = z.infer<typeof DeviceCapabilitySchema>;

// ---- Quantum Job ----

export const QuantumJobSchema = z.object({
  jobId: z.string().uuid(),
  request: QuantumRequestSchema,
  priority: JobPrioritySchema,
  deadlineAt: z.number().int(),
  cost: z.number().min(0),
  enqueuedAt: z.number().int(),
  workerPool: WorkerPoolSchema.optional(),
  retryCount: z.number().int().min(0).max(3).default(0),
});
export type QuantumJob = z.infer<typeof QuantumJobSchema>;

// ---- Execution Result ----

export const QuantumExecutionResultSchema = z.object({
  requestId: z.string().uuid(),
  traceId: z.string(),
  status: QuantumStatusSchema,
  implementation: z.string(),
  provider: z.string(),
  mode: ExecutionModeSchema,
  wires: z.number().int(),
  gates: z.number().int().optional(),
  shots: z.number().int().nullable(),
  result: z.record(z.string(), z.unknown()),
  circuitHash: z.string(),
  latencyMs: z.number().int().min(0),
  teeVerified: z.boolean().default(false),
  hsmSigned: z.boolean().default(false),
  bookpiCommitted: z.boolean().default(false),
  policyVersion: z.string(),
  telemetryJson: z.record(z.string(), z.unknown()),
  completedAt: z.string().datetime(),
});
export type QuantumExecutionResult = z.infer<typeof QuantumExecutionResultSchema>;

// ---- Telemetry Spans ----

export const QuantumSpanSchema = z.object({
  spanId: z.string().uuid(),
  traceId: z.string(),
  parentSpanId: z.string().uuid().optional(),
  operation: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  durationMs: z.number().int().min(0).optional(),
  status: z.enum(["ok", "error", "degraded"]),
  attributes: z.record(z.string(), z.string().max(256)),
});
export type QuantumSpan = z.infer<typeof QuantumSpanSchema>;

// ---- Recovery Incident ----

export const RecoveryIncidentSchema = z.object({
  incidentId: z.string().uuid(),
  type: z.enum([
    "pennylane_absent",
    "worker_hung",
    "remote_provider_down",
    "hsm_unavailable",
    "tee_unverifiable",
    "bookpi_postgres_down",
    "federation_node_malicious",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  affectedComponent: z.string(),
  description: z.string(),
  actionsTaken: z.array(z.string()),
  rtoActual: z.number().int().optional(),
  rpoActual: z.number().int().optional(),
  resolvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type RecoveryIncident = z.infer<typeof RecoveryIncidentSchema>;

// ---- Event Types ----

export const QUANTUM_EVENT_TYPES = [
  "quantum.request.accepted",
  "quantum.request.rejected",
  "quantum.job.queued",
  "quantum.job.started",
  "quantum.job.completed",
  "quantum.job.degraded",
  "quantum.job.failed",
  "quantum.worker.replaced",
  "quantum.provider.unavailable",
  "quantum.policy.changed",
  "quantum.audit.committed",
  "quantum.federation.replicated",
  "quantum.recovery.activated",
] as const;

export type QuantumEventType = (typeof QUANTUM_EVENT_TYPES)[number];

// ---- Canonical Payload for PQC Signing ----

export interface QuantumCanonicalPayload {
  schema: "bookpi-quantum-v1";
  requestId: string;
  circuitHash: string;
  implementation: string;
  status: QuantumStatus;
  policyVersion: string;
  timestamp: string;
}
