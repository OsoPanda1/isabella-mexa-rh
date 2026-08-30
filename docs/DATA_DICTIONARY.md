# DATA_DICTIONARY.md — Isabella Villaseñor AI

## Modelos de datos principales

### Claim (EvidenceStatus)

| Campo | Tipo | Descripción |
|---|---|---|
| claimId | UUID | Identificador único del claim |
| assertion | string(4096) | Texto de la afirmación |
| domain | ClaimDomain | Dominio: academic, territorial, medical, legal, financial, technical, cultural |
| source | string(256) | Fuente primaria |
| sourceDoi | string(256)? | DOI si existe |
| sourceOrcid | string(64)? | ORCID del autor |
| evidenceLevel | EvidenceStatus | supports, contradicts, contextualizes, insufficient, unavailable |
| confidence | number[0,1] | Nivel de confianza |
| supportingResults | MCPQueryResultV2[] | Resultados que apoyan |
| contradictoryResults | MCPQueryResultV2[] | Resultados que contradicen |
| evaluatedAt | datetime | Fecha de evaluación |
| ttlHours | number | Tiempo de vida (horas) |
| reasonCode | string? | Código de razón |
| caveat | string? | Advertencia epistemológica |

### MCPQueryResultV2

| Campo | Tipo | Descripción |
|---|---|---|
| evidenceId | string | ID único del resultado |
| repository | ZENODO/OSF/LITLE_LOCAL | Repositorio de origen |
| persistentId | {type, value}? | DOI/Handle/URL |
| title | string | Título del documento |
| excerpt | string(1024) | Fragmento del contenido |
| retrievedAt | datetime | Timestamp de recuperación |
| sourceUrl | string | URL de origen |
| license | string? | Licencia del documento |
| relevance | {score, method, modelDigest?} | Relevancia (bm25/dense/hybrid) |
| epistemic | {status, reasonCode, evaluatorVersion} | Estado epistémico |
| provenance | {responseDigest, adapterVersion, queryDigest} | Cadena de procedencia |

### KillSwitchEvent

| Campo | Tipo | Descripción |
|---|---|---|
| eventId | UUID | Identificador del evento |
| trigger | string(512) | Descripción del trigger |
| severity | SEV-1/2/3/4 | Severidad |
| previousState | KillSwitchState | Estado anterior |
| newState | KillSwitchState | Estado nuevo |
| actions | Action[] | Pasos del kill-switch |
| activatedAt | datetime | Timestamp de activación |
| resolvedAt | datetime? | Timestamp de resolución |
| approvedBy | string? | Aprobador |

### SovereignInferenceRequest

| Campo | Tipo | Descripción |
|---|---|---|
| schema | literal("sovereign-inference-v1") | Schema version |
| requestId | UUID | ID de la request |
| tenantId | string | Tenant ID |
| actor | {subject, roles, assurance} | Actor que solicita |
| input | {text, locale, dataClass, location?} | Input del usuario |
| policy | {risk, allowEgress, allowedTools, maxTokens, deadlineMs} | Política aplicable |
| model | {provider, name, digest} | Modelo a usar |
| trace | {correlationId, parentSpanId?} | Trazabilidad |

### AuditEvent

| Campo | Tipo | Descripción |
|---|---|---|
| eventVersion | literal(1) | Versión del schema |
| eventId | UUID | ID del evento |
| previousEventDigest | string | Hash del evento anterior |
| eventType | string | Tipo de evento |
| traceId | string | ID de traza |
| tenantId | string | Tenant |
| subjectId | string | Sujeto |
| nodeId | string | Nodo (default: RDM-NODE-0) |
| data | Record | Datos del evento |
| createdAt | datetime | Timestamp |
| eventDigest | string | Hash de integridad |

### AirGapManifest

| Campo | Tipo | Descripción |
|---|---|---|
| schemaVersion | literal(1) | Versión del schema |
| release | string(32) | Versión del release |
| artifacts | AirGapArtifact[] | Lista de artefactos |
| sbomDigest | string | Digest del SBOM |
| policyDigest | string | Digest de políticas |
| createdAt | datetime | Fecha de creación |
| signingKeyId | string | ID de la clave de firma |
| trustRootDigest | string | Digest del trust root |
