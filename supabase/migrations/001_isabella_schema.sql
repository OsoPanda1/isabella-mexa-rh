-- =============================================================
-- Isabella Villaseñor AI — Supabase Schema Migration
-- 7 tables matching src/lib/persistence/sqlite.ts
-- Execute via: supabase db push or psql -f migration.sql
-- =============================================================

-- 1. Memory items (isabella memory store)
CREATE TABLE IF NOT EXISTS memory_items (
  memoryId TEXT PRIMARY KEY,
  tenantId TEXT,
  sessionId TEXT,
  scope TEXT,
  content TEXT,
  contentJson TEXT,
  sourceType TEXT,
  relevance REAL,
  expiresAt TEXT,
  checksum TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_memory_items_tenant ON memory_items (tenantId);
CREATE INDEX IF NOT EXISTS idx_memory_items_scope ON memory_items (scope);
CREATE INDEX IF NOT EXISTS idx_memory_items_relevance ON memory_items (relevance DESC);

-- 2. Audit logs (audit-tracer)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenantId TEXT,
  sessionId TEXT,
  actorId TEXT,
  eventType TEXT,
  payload TEXT,
  traceId TEXT,
  checksum TEXT,
  createdAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs (tenantId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_eventType ON audit_logs (eventType);
CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs (createdAt DESC);

-- 3. Quantum events (event-bus, hash chain)
CREATE TABLE IF NOT EXISTS quantum_events (
  eventId TEXT PRIMARY KEY,
  eventType TEXT,
  schemaVersion TEXT,
  traceId TEXT,
  requestId TEXT,
  tenantId TEXT,
  subjectId TEXT,
  originCore INTEGER,
  targetCore INTEGER,
  occurredAt TEXT,
  policyVersion TEXT,
  payloadHash TEXT,
  previousEventHash TEXT,
  data TEXT
);

CREATE INDEX IF NOT EXISTS idx_quantum_events_type ON quantum_events (eventType);
CREATE INDEX IF NOT EXISTS idx_quantum_events_trace ON quantum_events (traceId);
CREATE INDEX IF NOT EXISTS idx_quantum_events_occurred ON quantum_events (occurredAt DESC);

-- 4. BookPI blocks (append-only audit chain)
CREATE TABLE IF NOT EXISTS bookpi_blocks (
  blockHash TEXT PRIMARY KEY,
  version TEXT,
  previousHash TEXT,
  requestId TEXT,
  tenantId TEXT,
  circuitHash TEXT,
  implementation TEXT,
  status TEXT,
  policyVersion TEXT,
  signerKeyId TEXT,
  teeVerified INTEGER,
  createdAt TEXT,
  blockData TEXT
);

CREATE INDEX IF NOT EXISTS idx_bookpi_blocks_tenant ON bookpi_blocks (tenantId);
CREATE INDEX IF NOT EXISTS idx_bookpi_blocks_status ON bookpi_blocks (status);
CREATE INDEX IF NOT EXISTS idx_bookpi_blocks_created ON bookpi_blocks (createdAt DESC);

-- 5. Telemetry counters
CREATE TABLE IF NOT EXISTS telemetry_counters (
  id SERIAL PRIMARY KEY,
  name TEXT,
  labels TEXT,
  value INTEGER,
  timestamp TEXT
);

CREATE INDEX IF NOT EXISTS idx_telem_counters_name ON telemetry_counters (name);

-- 6. Telemetry histograms
CREATE TABLE IF NOT EXISTS telemetry_histograms (
  id SERIAL PRIMARY KEY,
  name TEXT,
  value REAL,
  timestamp TEXT
);

CREATE INDEX IF NOT EXISTS idx_telem_histograms_name ON telemetry_histograms (name);

-- 7. Telemetry spans (distributed tracing)
CREATE TABLE IF NOT EXISTS telemetry_spans (
  spanId TEXT PRIMARY KEY,
  traceId TEXT,
  parentSpanId TEXT,
  operation TEXT,
  startTime TEXT,
  endTime TEXT,
  durationMs INTEGER,
  status TEXT,
  attributes TEXT
);

CREATE INDEX IF NOT EXISTS idx_telem_spans_trace ON telemetry_spans (traceId);
CREATE INDEX IF NOT EXISTS idx_telem_spans_operation ON telemetry_spans (operation);
CREATE INDEX IF NOT EXISTS idx_telem_spans_status ON telemetry_spans (status);
