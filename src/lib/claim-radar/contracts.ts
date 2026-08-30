/**
 * Isabella Claim Radar Engine — Contracts V2
 * Corregidos per auditoría Part III-V:
 * - MCPQueryContext con embedding, dataClass, deadlineMs
 * - MCPQueryResultV2 con relevance (method), epistemic (EvidenceStatus), provenance
 * - SovereignInferenceV1 request/response
 * - Tool calls con autorización verificable
 * - Audit events encadenados
 *
 * Estado: diseño integrado y preparado para validación.
 * Producción bloqueada hasta demostrar criptografía real, procedencia de artefactos,
 * pruebas de seguridad, benchmarks reproducibles, restauración y aprobación operativa.
 */
import { z } from "zod";

// ============================================================================
// EVIDENCE LEVELS (Section 11.1 — Epistemic Governance)
// ============================================================================

export const EvidenceStatusSchema = z.enum([
  "supports",       // exists sufficient compatible evidence
  "contradicts",    // relevant evidence contradicts under same scope
  "contextualizes", // evidence adds nuance without direct support/refute
  "insufficient",   // retrieval happened but does not constitute proof
  "unavailable",    // source could not be reached
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const DataClassSchema = z.enum(["public", "internal", "confidential", "restricted"]);
export type DataClass = z.infer<typeof DataClassSchema>;

export const ClaimDomainSchema = z.enum([
  "academic",
  "territorial",
  "medical",
  "legal",
  "financial",
  "technical",
  "cultural",
]);
export type ClaimDomain = z.infer<typeof ClaimDomainSchema>;

// ============================================================================
// MCP ADAPTER CONTRACTS V2 (Section 10.1 — Corrected)
// ============================================================================

export const MCPQueryContextSchema = z.object({
  requestId: z.string().uuid(),
  assertionId: z.string().uuid(),
  assertion: z.string().min(1).max(4096),
  targetDoi: z.string().max(256).optional(),
  maxResults: z.number().int().min(1).max(25).default(5),
  deadlineMs: z.number().int().min(1000).max(30000).default(5000),
  dataClass: DataClassSchema.default("public"),
  embedding: z.object({
    modelId: z.string().max(64),
    modelDigest: z.string().max(128),
    vector: z.array(z.number().finite()),
    normalized: z.boolean(),
  }).optional(),
}).refine(
  (data) => data.embedding ? data.embedding.vector.length > 0 : true,
  "Embedding vector must be non-empty when provided",
);
export type MCPQueryContext = z.infer<typeof MCPQueryContextSchema>;

export const MCPQueryResultV2Schema = z.object({
  evidenceId: z.string().max(128),
  repository: z.enum(["ZENODO", "OSF", "LITLE_LOCAL"]),
  persistentId: z.object({
    type: z.enum(["doi", "handle", "url"]),
    value: z.string().max(256),
  }).optional(),
  title: z.string().max(512),
  excerpt: z.string().max(1024),
  retrievedAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
  sourceUrl: z.string().max(512),
  license: z.string().max(128).optional(),
  relevance: z.object({
    score: z.number().min(0).max(1),
    method: z.enum(["bm25", "dense", "hybrid"]),
    modelDigest: z.string().max(128).optional(),
  }),
  epistemic: z.object({
    status: EvidenceStatusSchema,
    reasonCode: z.string().max(128),
    evaluatorVersion: z.string().max(32),
  }),
  provenance: z.object({
    responseDigest: z.string().max(128),
    adapterVersion: z.string().max(32),
    queryDigest: z.string().max(128),
  }),
});
export type MCPQueryResultV2 = z.infer<typeof MCPQueryResultV2Schema>;

/**
 * Interfaz canónica de adaptadores MCP.
 * Cada adaptador (Zenodo, OSF, LITLE) implementa esta interfaz.
 */
export interface MCPAdapterV2 {
  readonly id: string;
  readonly version: string;
  query(ctx: MCPQueryContext): Promise<ReadonlyArray<MCPQueryResultV2>>;
  health(): Promise<{ ready: boolean; checkedAt: string }>;
}

// ============================================================================
// CLAIM CONTRACTS (Section 11)
// ============================================================================

export const ClaimSchema = z.object({
  claimId: z.string().uuid(),
  assertion: z.string().min(1).max(4096),
  domain: ClaimDomainSchema,
  source: z.string().max(256),
  sourceDoi: z.string().max(256).optional(),
  sourceOrcid: z.string().max(64).optional(),
  evidenceLevel: EvidenceStatusSchema,
  confidence: z.number().min(0).max(1),
  supportingResults: z.array(MCPQueryResultV2Schema),
  contradictoryResults: z.array(MCPQueryResultV2Schema),
  evaluatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  ttlHours: z.number().int().min(1).max(8760).default(720),
  reasonCode: z.string().max(128).optional(),
  caveat: z.string().max(512).optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

// ============================================================================
// SOVEREIGN INFERENCE CONTRACTS V1 (Section 6)
// ============================================================================

export const SovereignInferenceRequestSchema = z.object({
  schema: z.literal("sovereign-inference-v1"),
  requestId: z.string().uuid(),
  tenantId: z.string().min(1).max(128),
  actor: z.object({
    subject: z.string().min(1).max(128),
    roles: z.array(z.string().max(64)),
    assurance: z.enum(["local", "mtls", "hardware-backed"]),
  }),
  input: z.object({
    text: z.string().min(1).max(32768),
    locale: z.string().min(2).max(10).default("es-MX"),
    dataClass: DataClassSchema,
    location: z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    }).optional(),
  }),
  policy: z.object({
    risk: z.enum(["low", "moderate", "high", "critical"]),
    allowEgress: z.boolean().default(false),
    allowedTools: z.array(z.string().max(64)).default([]),
    maxTokens: z.number().int().min(1).max(16384).default(4096),
    deadlineMs: z.number().int().min(1000).max(120000).default(30000),
  }),
  model: z.object({
    provider: z.enum(["local", "federated"]),
    name: z.string().min(1).max(128),
    digest: z.string().min(1).max(128),
  }),
  trace: z.object({
    correlationId: z.string().min(16).max(128),
    parentSpanId: z.string().max(128).optional(),
  }),
});
export type SovereignInferenceRequest = z.infer<typeof SovereignInferenceRequestSchema>;

export const SovereignInferenceResponseSchema = z.object({
  schema: z.literal("sovereign-inference-v1"),
  requestId: z.string().uuid(),
  status: z.enum(["completed", "refused", "degraded", "cancelled"]),
  answer: z.string().max(32768).optional(),
  claims: z.array(z.object({
    id: z.string().uuid(),
    text: z.string().max(2048),
    confidence: z.number().min(0).max(1),
    evidenceIds: z.array(z.string().max(128)),
    status: EvidenceStatusSchema,
  })),
  policyDecision: z.object({
    decision: z.enum(["allow", "deny", "degrade"]),
    ruleIds: z.array(z.string().max(128)),
    reasonCode: z.string().max(128),
  }),
  provenance: z.object({
    modelDigest: z.string().max(128),
    artifactRoot: z.string().max(256),
    eventIds: z.array(z.string().max(128)),
  }),
  signature: z.object({
    algorithm: z.string().max(64),
    keyId: z.string().max(128),
    value: z.string().max(1024),
  }),
});
export type SovereignInferenceResponse = z.infer<typeof SovereignInferenceResponseSchema>;

// ============================================================================
// TOOL CALL CONTRACTS (Section 8.3)
// ============================================================================

export const ToolCapabilitySchema = z.object({
  toolId: z.string().max(64),
  version: z.string().max(32),
  capabilities: z.array(z.string().max(128)),
  network: z.object({
    mode: z.enum(["deny-all", "allowlist", "open"]),
    hosts: z.array(z.string().max(256)).default([]),
  }),
  filesystem: z.enum(["none", "ephemeral", "read-only", "controlled"]),
  maxRuntimeMs: z.number().int().min(100).max(60000).default(3000),
  requiresHumanApproval: z.boolean().default(false),
});
export type ToolCapability = z.infer<typeof ToolCapabilitySchema>;

export const ToolCallSchema = z.object({
  toolCallId: z.string().uuid(),
  toolId: z.string().max(64),
  arguments: z.record(z.string(), z.unknown()),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  requiresApproval: z.boolean(),
  approvedBy: z.string().max(128).optional(),
  approvedAt: z.string().datetime().optional(),
  executedAt: z.string().datetime().optional(),
  result: z.string().max(4096).optional(),
  status: z.enum(["pending", "approved", "rejected", "executed", "failed"]),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

// ============================================================================
// AUDIT EVENT CONTRACTS (Section 14)
// ============================================================================

export const AuditEventSchema = z.object({
  eventVersion: z.literal(1),
  eventId: z.string().uuid(),
  previousEventDigest: z.string().max(128),
  requestDigest: z.string().max(128).optional(),
  policyDigest: z.string().max(128).optional(),
  modelDigest: z.string().max(128).optional(),
  eventType: z.enum([
    "inference.requested",
    "inference.completed",
    "inference.refused",
    "inference.degraded",
    "claim.evaluated",
    "claim.contradicted",
    "tool.approved",
    "tool.rejected",
    "tool.executed",
    "egress.blocked",
    "egress.allowed",
    "policy.violation",
    "killswitch.activated",
    "key.rotated",
    "release.signed",
    "bundle.installed",
    "rollback.executed",
  ]),
  traceId: z.string().min(16).max(128),
  requestId: z.string().uuid().optional(),
  tenantId: z.string().min(1).max(128),
  subjectId: z.string().min(1).max(128),
  nodeId: z.string().max(64).default("RDM-NODE-0"),
  toolCalls: z.array(z.string().max(64)).default([]),
  claimIds: z.array(z.string().max(128)).default([]),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  eventDigest: z.string().max(128),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================================================
// AIR-GAP BUNDLE MANIFEST (Section 16)
// ============================================================================

export const AirGapArtifactSchema = z.object({
  name: z.string().max(128),
  digest: z.string().max(128),
  type: z.enum(["oci-image", "model", "index", "policy", "sbom", "provenance", "migration", "rollback"]),
  size: z.number().int().min(0),
  path: z.string().max(256),
});
export type AirGapArtifact = z.infer<typeof AirGapArtifactSchema>;

export const AirGapManifestSchema = z.object({
  schemaVersion: z.literal(1),
  release: z.string().max(32),
  artifacts: z.array(AirGapArtifactSchema).min(1),
  sbomDigest: z.string().max(128),
  policyDigest: z.string().max(128),
  createdAt: z.string().datetime(),
  signingKeyId: z.string().max(128),
  trustRootDigest: z.string().max(128),
});
export type AirGapManifest = z.infer<typeof AirGapManifestSchema>;

// ============================================================================
// KILL-SWITCH STATE (Section 18.3)
// ============================================================================

export const KillSwitchStateSchema = z.enum([
  "normal",
  "egress-frozen",
  "quiesced",
  "isolated",
  "restoring",
  "requires-approval",
]);
export type KillSwitchState = z.infer<typeof KillSwitchStateSchema>;

export const KillSwitchEventSchema = z.object({
  eventId: z.string().uuid(),
  trigger: z.string().max(512),
  severity: z.enum(["SEV-1", "SEV-2", "SEV-3", "SEV-4"]),
  previousState: KillSwitchStateSchema,
  newState: KillSwitchStateSchema,
  actions: z.array(z.object({
    step: z.number().int().min(1),
    action: z.string().max(256),
    status: z.enum(["pending", "executing", "completed", "failed"]),
    timestamp: z.string().datetime().optional(),
    automated: z.boolean().default(true),
    humanRequired: z.boolean().default(false),
    humanInstruction: z.string().max(512).optional(),
  })),
  activatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  approvedBy: z.string().max(128).optional(),
});
export type KillSwitchEvent = z.infer<typeof KillSwitchEventSchema>;

// ============================================================================
// BENCHMARK CONTRACTS (Section 20)
// ============================================================================

export const BenchmarkResultSchema = z.object({
  scenario: z.string().max(128),
  commit: z.string().max(64),
  hardware: z.string().max(256),
  kernel: z.string().max(128),
  modelDigest: z.string().max(128),
  promptLength: z.number().int().min(0),
  tokenCount: z.number().int().min(0),
  concurrency: z.number().int().min(1),
  iterations: z.number().int().min(1),
  results: z.object({
    p50: z.number().min(0),
    p95: z.number().min(0),
    p99: z.number().min(0),
    mean: z.number().min(0),
    stddev: z.number().min(0),
    tokensPerSecond: z.number().min(0),
    peakMemoryMB: z.number().min(0),
    errorRate: z.number().min(0).max(1),
  }),
  rawResults: z.array(z.number().min(0)),
  measuredAt: z.string().datetime(),
});
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;
