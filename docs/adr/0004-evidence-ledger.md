# ADR-0004: Evidence Ledger — Append-Only Hash-Chained Audit Trail

## Status: Accepted

## Date: 20 August 2026

## Context

The Isabella platform performs operations with regulatory and legal significance: IP registration via IMPI, contractual identity assertions (BookPI pattern), asset provenance in the marketplace, and agent actions that modify tenant state. These operations require a verifiable, tamper-evident audit trail that can withstand scrutiny from regulators, courts, and tenants. A simple event log is insufficient because entries can be reordered, inserted, or deleted without detection. The system currently runs on SQLite (WAL mode) and must remain functional offline or in degraded-network scenarios.

## Decision

Implement an **append-only, hash-chained ledger** following the BookPI (Blockchain-like Provenance Immutable) pattern.

### Record Structure

Each ledger entry contains:

| Field | Description |
|---|---|
| `sequenceNumber` | Monotonically increasing integer (1, 2, 3, …) |
| `previousHash` | SHA-256 hash of the canonical JSON of the preceding record (`"0"` for genesis) |
| `payloadHash` | SHA-256 hash of the canonical JSON of the operation's payload |
| `tenantId` | Tenant that owns this record (ADR-0003) |
| `timestamp` | ISO-8601 UTC timestamp, set at insertion time |
| `operation` | String identifier for the operation type (e.g., `agent.tool.execute`, `ip.registration.submit`, `identity.assert`) |
| `signerKeyId` | Identifier of the key that signed this record (user, API key, or agent delegation token) |
| `metadata` | Optional JSON object for additional context |

### Chain Integrity

- `currentHash = SHA-256(sequenceNumber || previousHash || payloadHash || tenantId || timestamp || operation || signerKeyId)`
- To verify the ledger: iterate from sequence 1, recompute each record's hash using the previous record's hash, and compare against the stored hash. Any modification to any record breaks the chain from that point forward.

### Persistence

- SQLite table `evidence_ledger` with WAL mode for concurrent read/write.
- The table is append-only at the application level: no `UPDATE` or `DELETE` operations are permitted. The database schema includes a CHECK constraint where SQLite supports it, and the application layer enforces this invariant.
- Periodic hash-chain snapshots (every 1,000 records) are written to a separate `ledger_checkpoints` table for fast verification without replaying the full chain.

### Verification API

- `GET /api/evidence/verify/:tenantId` — Returns chain integrity status (valid, broken at sequence N, total records).
- `GET /api/evidence/record/:sequenceNumber` — Returns a single record with its computed hash for spot-checking.

### Tenant Binding

Each record includes `tenantId` in both the payload and the hash input. This means the hash chain is per-tenant logically (records from different tenants are interleaved in the same table but each record's hash only references its own chain). Cross-tenant verification is not required — each tenant's sub-chain is independently verifiable.

## Consequences

- **Positive**: Cryptographic tamper evidence — any modification to a past record is detectable. Append-only design eliminates accidental or malicious overwrites. Verification is O(n) per tenant but checkpoint snapshots reduce cold-start verification cost.
- **Negative**: Append-only means errors in a record cannot be corrected; they must be compensated by a subsequent corrective entry. Storage grows without bound (mitigated by archival and checkpoint pruning).
- **Negative**: SHA-256 is not quantum-resistant; a future quantum adversary could forge pre-image attacks on the hash chain. The quantum provider boundary (ADR-0006) addresses this with planned migration to ML-DSA signatures once production-grade post-quantum providers are available.
- **Neutral**: The single-table design keeps SQLite simplicity; partitioning by tenant can be added later if the table exceeds practical SQLite limits (~140TB theoretical, but performance degrades well before).

## Alternatives Considered

| Alternative | Rejected Because |
|---|---|
| **Merkle tree (blockchain-style)** | Adds complexity (tree reconstruction, root verification) without proportional benefit at current scale; hash chain is sufficient for sequential verification. |
| **External notarization (e.g., blockchain anchoring)** | Introduces external dependency, network requirement, and cost; Isabella must function offline; hash anchoring can be added later without changing the ledger schema. |
| **Immutable database (e.g., CockroachDB)** | Vendor lock-in, operational cost, and network dependency incompatible with offline-first requirement. |
| **Signed log without chaining** | Individual signatures prevent forgery of individual records but do not detect record insertion, deletion, or reordering. Hash chaining detects all structural modifications. |
| **WORM storage (Write Once Read Many)** | Requires specific storage infrastructure (S3 Object Lock, Azure WORM); not available in SQLite; adds cloud dependency for offline-capable system. |
