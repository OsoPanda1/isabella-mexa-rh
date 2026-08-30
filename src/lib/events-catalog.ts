/**
 * 15 canonical Atlas events as defined in the Manual de Ingeniería.
 * Schemas are Zod and exported as a single registry consumed by the
 * hardened EventBus (idempotency, DLQ, replay).
 */
import { z } from "zod";

const baseEnvelope = z.object({
  event_id: z.string().min(8),
  event_type: z.string(),
  trace_id: z.string().optional(),
  correlation_id: z.string().optional(),
  timestamp: z.string(),
  actor_id: z.string().optional(),
  federation_id: z.string().optional(),
  hash_before: z.string().nullable().optional(),
  hash_after: z.string().nullable().optional(),
  signature: z.string().optional(),
});

const identityLinked = baseEnvelope.extend({
  event_type: z.literal("identity.linked"),
  payload: z.object({
    atlas_identity_id: z.string(),
    provider: z.enum(["orcid", "github", "zenodo", "figshare", "openaire"]),
    external_id: z.string(),
  }),
});
const identityUnlinked = baseEnvelope.extend({
  event_type: z.literal("identity.unlinked"),
  payload: z.object({
    atlas_identity_id: z.string(),
    provider: z.string(),
    external_id: z.string(),
  }),
});
const documentsCreated = baseEnvelope.extend({
  event_type: z.literal("documents.created"),
  payload: z.object({
    document_uid: z.string(),
    federation_id: z.string(),
    namespace: z.string(),
    title: z.string(),
    created_by: z.string(),
    version: z.number().int().positive(),
    canonical_hash: z.string(),
  }),
});
const documentsVersioned = baseEnvelope.extend({
  event_type: z.literal("documents.versioned"),
  payload: z.object({
    document_uid: z.string(),
    previous_version: z.number().int().nonnegative(),
    new_version: z.number().int().positive(),
    canonical_hash_before: z.string().nullable(),
    canonical_hash_after: z.string(),
  }),
});
const documentsStateChanged = baseEnvelope.extend({
  event_type: z.literal("documents.state_changed"),
  payload: z.object({
    document_uid: z.string(),
    old_state: z.string(),
    new_state: z.string(),
    reason: z.string().optional(),
  }),
});
const publicationsRequested = baseEnvelope.extend({
  event_type: z.literal("publications.requested"),
  payload: z.object({
    document_uid: z.string(),
    providers: z.array(z.string()),
    requested_by: z.string(),
  }),
});
const publicationsDoiReserved = baseEnvelope.extend({
  event_type: z.literal("publications.doi_reserved"),
  payload: z.object({
    document_uid: z.string(),
    provider: z.literal("zenodo"),
    doi: z.string(),
    reservation_timestamp: z.string(),
  }),
});
const publicationsCompleted = baseEnvelope.extend({
  event_type: z.literal("publications.completed"),
  payload: z.object({
    document_uid: z.string(),
    results: z.array(
      z.object({
        provider: z.string(),
        status: z.string(),
        external_ref: z.string().optional(),
        doi: z.string().optional(),
      }),
    ),
  }),
});
const publicationsFailed = baseEnvelope.extend({
  event_type: z.literal("publications.failed"),
  payload: z.object({
    document_uid: z.string(),
    provider: z.string(),
    error_code: z.string(),
    error_message: z.string(),
    attempts: z.number().int(),
  }),
});
const federationsAnchored = baseEnvelope.extend({
  event_type: z.literal("federations.anchored"),
  payload: z.object({
    anchor_id: z.string(),
    document_uid: z.string(),
    merkle_root: z.string(),
    federations: z.array(
      z.object({
        federation_id: z.string(),
        hash: z.string(),
        signature: z.string(),
        timestamp: z.string(),
      }),
    ),
    quorum: z.object({ achieved: z.number(), required: z.number() }),
  }),
});
const federationsConsistency = baseEnvelope.extend({
  event_type: z.literal("federations.consistency_checked"),
  payload: z.object({
    anchor_id: z.string(),
    status: z.enum(["consistent", "divergent"]),
    mismatches: z.array(z.string()),
  }),
});
const securityPolicyViolated = baseEnvelope.extend({
  event_type: z.literal("security.policy_violated"),
  payload: z.object({
    policy_id: z.string(),
    actor_id: z.string().optional(),
    resource_type: z.string(),
    resource_id: z.string(),
    risk_level: z.enum(["low", "medium", "high", "critical"]),
    details: z.record(z.string(), z.any()),
  }),
});
const securityIncidentDetected = baseEnvelope.extend({
  event_type: z.literal("security.incident_detected"),
  payload: z.object({
    incident_id: z.string(),
    type: z.string(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    affected_identities: z.array(z.string()).default([]),
    affected_documents: z.array(z.string()).default([]),
    summary: z.string(),
  }),
});
const securityKeyRotated = baseEnvelope.extend({
  event_type: z.literal("security.key_rotated"),
  payload: z.object({
    key_id: z.string(),
    scope: z.string(),
    rotated_at: z.string(),
  }),
});
const backupsCompleted = baseEnvelope.extend({
  event_type: z.literal("backups.completed"),
  payload: z.object({
    backup_id: z.string(),
    target: z.string(),
    status: z.enum(["success", "failed"]),
    started_at: z.string(),
    completed_at: z.string(),
    size_bytes: z.number().int().nonnegative(),
  }),
});

export const EventSchemas = {
  "identity.linked": identityLinked,
  "identity.unlinked": identityUnlinked,
  "documents.created": documentsCreated,
  "documents.versioned": documentsVersioned,
  "documents.state_changed": documentsStateChanged,
  "publications.requested": publicationsRequested,
  "publications.doi_reserved": publicationsDoiReserved,
  "publications.completed": publicationsCompleted,
  "publications.failed": publicationsFailed,
  "federations.anchored": federationsAnchored,
  "federations.consistency_checked": federationsConsistency,
  "security.policy_violated": securityPolicyViolated,
  "security.incident_detected": securityIncidentDetected,
  "security.key_rotated": securityKeyRotated,
  "backups.completed": backupsCompleted,
} as const;

export type AtlasEventType = keyof typeof EventSchemas;
export type AtlasEvent = z.infer<(typeof EventSchemas)[AtlasEventType]>;

export const CANONICAL_EVENT_CATALOG: ReadonlyArray<{
  type: AtlasEventType;
  domain: string;
  description: string;
}> = [
  { type: "identity.linked", domain: "Identity", description: "Vinculación de identidad externa (ORCID/GitHub/Zenodo)" },
  { type: "identity.unlinked", domain: "Identity", description: "Desvinculación auditada de identidad externa" },
  { type: "documents.created", domain: "Documents", description: "Creación canónica de documento con hash SHA-3" },
  { type: "documents.versioned", domain: "Documents", description: "Nueva versión inmutable con cadena de hashes" },
  { type: "documents.state_changed", domain: "Documents", description: "Transición de estado validado/publicado/archivado" },
  { type: "publications.requested", domain: "Publications", description: "Solicitud de publicación a federados externos" },
  { type: "publications.doi_reserved", domain: "Publications", description: "Reserva de DOI en Zenodo" },
  { type: "publications.completed", domain: "Publications", description: "Publicación multi-proveedor completada" },
  { type: "publications.failed", domain: "Publications", description: "Falla de publicación con reintentos y backoff" },
  { type: "federations.anchored", domain: "Federation", description: "Anclaje multi-federación con quórum y Merkle root" },
  { type: "federations.consistency_checked", domain: "Federation", description: "Verificación anti-entropy entre 7 federaciones" },
  { type: "security.policy_violated", domain: "Security", description: "Decisión OPA con denegación auditada" },
  { type: "security.incident_detected", domain: "Security", description: "Incidente correlacionado por security-core" },
  { type: "security.key_rotated", domain: "Security", description: "Rotación de clave Ed25519/PQC" },
  { type: "backups.completed", domain: "Resilience", description: "Backup inmutable WORM completado" },
];