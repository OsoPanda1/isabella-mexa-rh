/**
 * PostgreSQL Persistence Layer — Isabella
 * Connects via Supabase Pooler (pg). Async-first.
 * Used by API routes and server.ts for durable persistence.
 * Falls back to null when POSTGRES_URL is not set.
 */
import { Pool, type PoolClient, type QueryResult } from "pg";

let pool: Pool | null = null;
let initAttempted = false;

export function getPgPool(): Pool | null {
  if (pool) return pool;
  if (initAttempted) return null;
  initAttempted = true;

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) return null;

  try {
    // P0 FIX: nunca desactivar la validación del certificado TLS del servidor.
    // `rejectUnauthorized: false` permitía MITM contra la base de datos. Se
    // mantiene una única válvula explícita (POSTGRES_SSL_REJECT_UNAUTHORIZED=false)
    // solo para entornos de desarrollo con certificados autofirmados.
    const rejectUnauthorized = process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== "false";
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: rejectUnauthorized ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
    });

    pool.on("error", (err) => {
      console.error("[PostgreSQL] Pool error:", err.message);
    });

    return pool;
  } catch (err) {
    console.error("[PostgreSQL] Init failed:", err);
    pool = null;
    return null;
  }
}

export async function pgQuery<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const p = getPgPool();
  if (!p) throw new Error("PostgreSQL unavailable");

  const result: QueryResult<T> = await p.query(text, params);
  return result.rows;
}

export async function pgExecute(
  text: string,
  params?: unknown[],
): Promise<{ rowCount: number }> {
  const p = getPgPool();
  if (!p) throw new Error("PostgreSQL unavailable");

  const result = await p.query(text, params);
  return { rowCount: result.rowCount ?? 0 };
}

export async function pgHealthCheck(): Promise<boolean> {
  const p = getPgPool();
  if (!p) return false;

  try {
    const client: PoolClient = await p.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch {
    return false;
  }
}

/**
 * Run the Isabella schema migration on PostgreSQL.
 * Idempotent (CREATE IF NOT EXISTS).
 */
export async function runPostgresMigration(): Promise<void> {
  const p = getPgPool();
  if (!p) return;

  const client = await p.connect();
  try {
    await client.query(`
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

      CREATE TABLE IF NOT EXISTS telemetry_counters (
        id SERIAL PRIMARY KEY,
        name TEXT,
        labels TEXT,
        value INTEGER,
        timestamp TEXT
      );

      CREATE TABLE IF NOT EXISTS telemetry_histograms (
        id SERIAL PRIMARY KEY,
        name TEXT,
        value REAL,
        timestamp TEXT
      );

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
    `);
    console.log("[PostgreSQL] Migration completed (7 tables)");
  } finally {
    client.release();
  }
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    initAttempted = false;
  }
}
