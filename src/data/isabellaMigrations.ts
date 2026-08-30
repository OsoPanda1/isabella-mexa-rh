/**
 * ISABELLA SQL MIGRATIONS (001_create_isabella_tables.sql)
 * Core Database Schema for Supabase / PostgreSQL
 * Nodo Cero :: RDM Digital
 */

export const ISABELLA_SQL_MIGRATION = `-- ====================================================================
-- MIGRATION: 001_create_isabella_tables.sql
-- Subsystem: Isabella Villaseñor AI Core Tables (Nodo Cero / RDM Digital)
-- Target: PostgreSQL 14+ / Supabase
-- ====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Sessions
CREATE TABLE IF NOT EXISTS isabella_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  session_key text,
  actor_id uuid,
  state jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_isabella_sessions_tenant ON isabella_sessions (tenant_id);

-- 2. Messages / Turns
CREATE TABLE IF NOT EXISTS isabella_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES isabella_sessions(id) ON DELETE CASCADE,
  actor_id uuid,
  role text, -- 'user' | 'system' | 'assistant' | 'tool'
  content jsonb,
  sequence_no integer,
  created_at timestamptz DEFAULT now(),
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_isabella_messages_session ON isabella_messages (session_id);

-- 3. Memory Items (Hierarchical: immediate | session | project | territorial | historical)
CREATE TABLE IF NOT EXISTS isabella_memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  memory_scope text, -- immediate | session | project | territorial | historical
  session_id uuid,
  content text,
  content_json jsonb,
  source_type text, -- user | system | event | summary
  relevance numeric DEFAULT 0,
  expires_at timestamptz,
  checksum text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_isabella_memory_scope ON isabella_memory_items (memory_scope);
CREATE INDEX IF NOT EXISTS idx_isabella_memory_relevance ON isabella_memory_items (relevance DESC);

-- 4. Decisions (Governed by C.R.O.W.N. / ARGUS Policy Gate)
CREATE TABLE IF NOT EXISTS isabella_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_key text,
  session_id uuid REFERENCES isabella_sessions(id),
  summary text,
  confidence numeric,
  risk_level text, -- low | medium | high
  policy_status text, -- allowed | denied | requires_approval
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_isabella_decisions_policy ON isabella_decisions (policy_status);

-- 5. Tool Catalog & Execution Logs
CREATE TABLE IF NOT EXISTS isabella_tools (
  name text PRIMARY KEY,
  description text,
  allowed boolean DEFAULT true,
  schema jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS isabella_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES isabella_decisions(id),
  tool_name text REFERENCES isabella_tools(name),
  arguments jsonb,
  result jsonb,
  status text, -- pending | running | success | error
  created_at timestamptz DEFAULT now(),
  finished_at timestamptz
);

-- 6. Policies and Human-in-the-loop Approvals
CREATE TABLE IF NOT EXISTS isabella_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text UNIQUE,
  description text,
  rules jsonb,
  version text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS isabella_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES isabella_decisions(id),
  approver_id uuid,
  status text, -- pending | approved | rejected
  comment text,
  created_at timestamptz DEFAULT now()
);

-- 7. Audit Logs & Cryptographic Trace Registry
CREATE TABLE IF NOT EXISTS isabella_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  session_id uuid,
  actor_id uuid,
  event_type text,
  payload jsonb,
  trace_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_isabella_audit_trace ON isabella_audit_logs (trace_id);
CREATE INDEX IF NOT EXISTS idx_isabella_audit_type ON isabella_audit_logs (event_type);

COMMIT;
`;

export interface SchemaTableInfo {
  name: string;
  purpose: string;
  columns: string[];
  scope: string;
}

export const SCHEMA_TABLES: SchemaTableInfo[] = [
  {
    name: "isabella_sessions",
    purpose: "Gestión del ciclo de vida de sesiones interactivas, estados y actores.",
    columns: ["id (uuid)", "tenant_id", "session_key", "actor_id", "state (jsonb)", "created_at", "updated_at"],
    scope: "Sesión & Conexión",
  },
  {
    name: "isabella_messages",
    purpose: "Registro secuencial de turnos de diálogo y mensajes con metadatos.",
    columns: ["id (uuid)", "session_id (fk)", "actor_id", "role", "content (jsonb)", "sequence_no", "metadata"],
    scope: "Conversación",
  },
  {
    name: "isabella_memory_items",
    purpose: "Memoria cognitiva jerárquica con 5 niveles de persistencia y checksums.",
    columns: ["id (uuid)", "tenant_id", "memory_scope", "content", "content_json", "relevance", "checksum"],
    scope: "Memoria Jerárquica",
  },
  {
    name: "isabella_decisions",
    purpose: "Registro inmutable de decisiones arbitradas con nivel de riesgo y veredicto de política.",
    columns: ["id (uuid)", "session_id (fk)", "summary", "confidence", "risk_level", "policy_status", "details"],
    scope: "Gobernanza C.R.O.W.N.",
  },
  {
    name: "isabella_tools & isabella_tool_calls",
    purpose: "Catálogo de herramientas autorizadas (Zero Trust) y auditoría de ejecuciones.",
    columns: ["name / tool_name", "schema", "arguments", "result", "status", "execution_time"],
    scope: "Herramientas & Sandbox",
  },
  {
    name: "isabella_policies & isabella_approvals",
    purpose: "Reglas de gobernanza y cola de aprobación humana para operaciones de alto riesgo.",
    columns: ["id", "policy_key", "rules (jsonb)", "decision_id (fk)", "approver_id", "status"],
    scope: "Seguridad & Human-in-the-loop",
  },
  {
    name: "isabella_audit_logs",
    purpose: "Libro de registro inmutable con trace IDs universales para trazabilidad.",
    columns: ["id (uuid)", "tenant_id", "session_id", "actor_id", "event_type", "payload", "trace_id"],
    scope: "Trazabilidad & Auditoría",
  },
];
