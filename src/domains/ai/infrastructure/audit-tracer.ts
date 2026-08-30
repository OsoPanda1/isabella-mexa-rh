/**
 * AUDIT TRACER - ISABELLA INFRASTRUCTURE LAYER
 * Nodo Cero :: RDM Digital
 * Registers structured audit events, trace IDs, and cryptographic verification logs.
 */

import { createHash } from "node:crypto";
import { IsabellaAuditLog } from "../../../contracts/isabella";
import { getDatabase } from "../../../lib/persistence/sqlite";

const auditBuffer: IsabellaAuditLog[] = [];
const MAX_BUFFER_SIZE = 1000;

let sqliteAvailable: boolean | null = null;

function isSqliteAvailable(): boolean {
  if (sqliteAvailable !== null) return sqliteAvailable;
  try {
    getDatabase();
    sqliteAvailable = true;
  } catch {
    sqliteAvailable = false;
  }
  return sqliteAvailable;
}

export interface AuditTraceParams {
  tenantId?: string;
  sessionId?: string;
  actorId?: string;
  eventType: string;
  data: Record<string, unknown>;
  traceId?: string;
}

export async function auditTrace(payload: AuditTraceParams): Promise<{
  auditId: string;
  traceId: string;
  timestamp: string;
}> {
  const traceId = payload.traceId || `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const auditId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const checksum = `sha256_${createHash("sha256").update(JSON.stringify(payload.data || {})).digest("hex")}`;

  const entry: IsabellaAuditLog = {
    id: auditId,
    tenantId: payload.tenantId || "nodo-cero-rdm",
    sessionId: payload.sessionId,
    actorId: payload.actorId || "usr-system",
    eventType: payload.eventType,
    payload: payload.data,
    traceId,
    checksum,
    createdAt: now,
  };

  if (isSqliteAvailable()) {
    try {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO audit_logs (id, tenantId, sessionId, actorId, eventType, payload, traceId, checksum, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        entry.id,
        entry.tenantId ?? null,
        entry.sessionId ?? null,
        entry.actorId ?? null,
        entry.eventType,
        JSON.stringify(entry.payload),
        entry.traceId,
        entry.checksum ?? null,
        entry.createdAt
      );
      import("./../../../lib/persistence/postgres").then(({ pgExecute }) =>
        pgExecute(
          `INSERT INTO audit_logs (id, tenantId, sessionId, actorId, eventType, payload, traceId, checksum, createdAt)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO NOTHING`,
          [entry.id, entry.tenantId ?? null, entry.sessionId ?? null, entry.actorId ?? null,
           entry.eventType, JSON.stringify(entry.payload), entry.traceId, entry.checksum ?? null, entry.createdAt]
        ).catch(() => {})
      ).catch(() => {});
    } catch {
      insertIntoBuffer(entry);
    }
  } else {
    insertIntoBuffer(entry);
  }

  if (typeof console !== "undefined") {
    console.log(`[Isabella.Audit::${entry.eventType}]`, {
      auditId,
      traceId,
      actor: entry.actorId,
      summary: (payload.data as any)?.summary || (payload.data as any)?.inputType || "Event",
    });
  }

  return { auditId, traceId, timestamp: now };
}

export function getRecentAuditLogs(limit = 50): IsabellaAuditLog[] {
  if (isSqliteAvailable()) {
    try {
      const db = getDatabase();
      const rows = db.prepare(
        `SELECT id, tenantId, sessionId, actorId, eventType, payload, traceId, checksum, createdAt
         FROM audit_logs ORDER BY createdAt DESC LIMIT ?`
      ).all(limit) as Array<{
        id: string;
        tenantId: string | null;
        sessionId: string | null;
        actorId: string | null;
        eventType: string;
        payload: string;
        traceId: string;
        checksum: string | null;
        createdAt: string;
      }>;
      return rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId ?? undefined,
        sessionId: row.sessionId ?? undefined,
        actorId: row.actorId ?? undefined,
        eventType: row.eventType,
        payload: JSON.parse(row.payload) as Record<string, unknown>,
        traceId: row.traceId,
        checksum: row.checksum ?? undefined,
        createdAt: row.createdAt,
      }));
    } catch {
      return [...auditBuffer.slice(0, limit)];
    }
  }
  return [...auditBuffer.slice(0, limit)];
}

export function clearAuditLogs(): void {
  if (isSqliteAvailable()) {
    try {
      const db = getDatabase();
      db.prepare(`DELETE FROM audit_logs`).run();
    } catch {
      auditBuffer.length = 0;
    }
  } else {
    auditBuffer.length = 0;
  }
}

function insertIntoBuffer(entry: IsabellaAuditLog): void {
  auditBuffer.unshift(entry);
  if (auditBuffer.length > MAX_BUFFER_SIZE) {
    auditBuffer.pop();
  }
}
