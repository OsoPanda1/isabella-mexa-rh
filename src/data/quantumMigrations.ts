/**
 * Isabella Quantum Mesh — PostgreSQL Schema (Nucleo 20)
 * Esquema SQL para Supabase / PostgreSQL.
 */

export const QUANTUM_SQL_MIGRATION = [
  `CREATE TABLE IF NOT EXISTS quantum_execution (
    request_id UUID PRIMARY KEY,
    trace_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    repository TEXT NOT NULL,
    implementation TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('analytic', 'sampled')),
    status TEXT NOT NULL CHECK (status IN ('completed', 'degraded', 'rejected', 'failed')),
    wires INT NOT NULL CHECK (wires BETWEEN 1 AND 24),
    gates INT,
    shots INT,
    features JSONB DEFAULT '[]'::jsonb,
    weights JSONB DEFAULT '[]'::jsonb,
    circuit_hash CHAR(64) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    policy_version TEXT NOT NULL,
    policy_decision TEXT NOT NULL,
    result_json JSONB,
    telemetry_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    worker_id TEXT,
    pool TEXT,
    tee_verified BOOLEAN NOT NULL DEFAULT false,
    hsm_signed BOOLEAN NOT NULL DEFAULT false,
    bookpi_committed BOOLEAN NOT NULL DEFAULT false,
    latency_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS bookpi_quantum_block (
    block_hash CHAR(64) PRIMARY KEY,
    previous_hash CHAR(64) NOT NULL,
    request_id UUID NOT NULL,
    tenant_id TEXT NOT NULL,
    circuit_hash CHAR(64) NOT NULL,
    implementation TEXT NOT NULL,
    status TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    signer_key_id TEXT NOT NULL,
    tee_verified BOOLEAN NOT NULL DEFAULT false,
    ml_dsa_signature TEXT,
    slh_dsa_signature TEXT,
    litle_gates_status TEXT,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS quantum_recovery_incident (
    incident_id UUID PRIMARY KEY,
    type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_component TEXT NOT NULL,
    description TEXT NOT NULL,
    actions_taken JSONB NOT NULL DEFAULT '[]'::jsonb,
    rto_actual INT,
    rpo_actual INT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS quantum_telemetry_span (
    span_id UUID PRIMARY KEY,
    trace_id TEXT NOT NULL,
    parent_span_id UUID,
    operation TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_ms INT,
    status TEXT NOT NULL CHECK (status IN ('ok', 'error', 'degraded')),
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS quantum_policy_decision (
    id SERIAL PRIMARY KEY,
    trace_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny', 'degraded')),
    reason TEXT NOT NULL,
    provider TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    role TEXT NOT NULL,
    wires INT,
    shots INT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

export const QUANTUM_SQL_INDEXES = [
  `CREATE INDEX IF NOT EXISTS quantum_execution_tenant_idx ON quantum_execution(tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS quantum_execution_circuit_idx ON quantum_execution(circuit_hash)`,
  `CREATE INDEX IF NOT EXISTS quantum_execution_status_idx ON quantum_execution(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS quantum_execution_provider_idx ON quantum_execution(provider, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS bookpi_quantum_block_request_idx ON bookpi_quantum_block(request_id)`,
  `CREATE INDEX IF NOT EXISTS bookpi_quantum_block_tenant_idx ON bookpi_quantum_block(tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS bookpi_quantum_block_previous_idx ON bookpi_quantum_block(previous_hash)`,
  `CREATE INDEX IF NOT EXISTS quantum_recovery_incident_type_idx ON quantum_recovery_incident(type, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS quantum_telemetry_span_trace_idx ON quantum_telemetry_span(trace_id, start_time DESC)`,
  `CREATE INDEX IF NOT EXISTS quantum_telemetry_span_operation_idx ON quantum_telemetry_span(operation, start_time DESC)`,
  `CREATE INDEX IF NOT EXISTS quantum_policy_decision_trace_idx ON quantum_policy_decision(trace_id)`,
  `CREATE INDEX IF NOT EXISTS quantum_policy_decision_tenant_idx ON quantum_policy_decision(tenant_id, timestamp DESC)`,
];

export const QUANTUM_SCHEMA_TABLES = [
  "quantum_execution",
  "bookpi_quantum_block",
  "quantum_recovery_incident",
  "quantum_telemetry_span",
  "quantum_policy_decision",
];
