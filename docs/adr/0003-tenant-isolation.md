# ADR-0003: Tenant Isolation Model

## Status: Accepted

## Date: 20 August 2026

## Context

Isabella is a multi-tenant platform. Each tenant's data, configurations, agent sessions, evidence records, and marketplace assets must be strictly isolated. A tenant's data must never leak to another tenant, whether through direct query, API access, agent tool invocation, or cache side-channel. The current persistence layer is SQLite (single-file, single-process), with a documented migration path to PostgreSQL for horizontal scaling. The authorization model (ADR-0002) ties every principal — user, API key, and agent delegation token — to a `tenantId`.

## Decision

**Every data access path includes `tenantId` as a first-class filter, enforced at the data layer.**

### Data Layer Enforcement

- All SQLite tables include a `tenantId TEXT NOT NULL` column (except the hash-chained evidence ledger, which includes `tenantId` as part of its signed payload — see ADR-0004).
- All queries are parameterized with `WHERE tenantId = ?` as an invariant. The data access layer (repository pattern in `lib/*/`) injects the tenant filter; no caller can omit it.
- Indexes: composite index `(tenantId, <primary-key>)` on all frequently queried tables.
- Future PostgreSQL migration: Row-Level Security (RLS) policies will enforce the same constraint at the database engine level as a defense-in-depth layer.

### Authorization Context

- Every request resolves an `AuthorizationContext`: `{ subjectId, tenantId, scopes, role }`.
- The policy engine compares `context.tenantId` against the resource's `tenantId`. A mismatch results in a `403 Forbidden` response regardless of the user's role or scopes.
- **Cross-tenant access is never permitted through the standard API**. Any mechanism that requires cross-tenant data aggregation (e.g., platform-wide analytics) operates on a separate, read-only, pre-aggregated data mart that never exposes raw tenant records.

### Agent Tool Isolation

- Agent delegation tokens (ADR-0002) embed `tenantId`. The tool policy engine (ADR-0005) verifies that every tool invocation's target resource belongs to the token's `tenantId`.
- Agents cannot access or reference resources outside their tenant boundary.

### Cryptographic Binding

- The evidence ledger (ADR-0004) includes `tenantId` in each signed record's payload. Verification of the chain also verifies tenant scope.

## Consequences

- **Positive**: Defense-in-depth isolation — even a bug in application logic cannot leak data if the data layer enforces the tenant filter. Consistent model across all access paths (API, agent, batch).
- **Negative**: Adding `tenantId` to every table and query increases schema complexity and migration overhead. Cross-tenant analytics require a separate data pipeline.
- **Negative**: SQLite's single-file model means all tenants share a physical file; a corrupted database affects all tenants. Mitigated by WAL mode, regular backups, and the planned PostgreSQL migration.
- **Neutral**: Tenant ID is a string (UUID) to support future multi-database sharding where the same logical tenant might span physical partitions.

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| **Database-per-tenant** | Operational complexity is prohibitive at current scale; SQLite cannot reasonably manage hundreds of files; connection overhead in serverless is high. |
| **Schema-per-tenant (Postgres schemas)** | Tightly couples to PostgreSQL; not applicable to SQLite; adds DDL migration complexity. |
| **Application-layer-only isolation (no WHERE clause enforcement)** | A single missed filter leaks data; no defense-in-depth; violates principle of least privilege at the data layer. |
| **Shared-nothing with physical partitioning** | Over-engineered for current scale; premature optimization before product-market fit is validated. |
