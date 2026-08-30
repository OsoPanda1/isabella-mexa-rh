/**
 * ================================================================
 * ISABELLA VILLASEÑOR AI — AUDIT RECEIPT (Module 12)
 * Every action generates an auditable receipt with hash, timestamp.
 * ================================================================
 */
import { createHash, randomUUID } from "node:crypto";

export interface AuditReceipt {
  readonly receiptId: string;
  readonly action: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly sessionId?: string;
  readonly riskLevel: string;
  readonly consentRequired: boolean;
  readonly consentGranted: boolean;
  readonly toolName?: string;
  readonly success?: boolean;
  readonly executionMs?: number;
  readonly inputLength?: number;
  readonly hash: string;
  readonly timestamp: string;
}

const receiptLog: AuditReceipt[] = [];
const MAX_RECEIPTS = 10_000;

export function auditReceipt(params: {
  action: string;
  actor: string;
  tenantId: string;
  sessionId?: string;
  riskLevel: string;
  consentRequired?: boolean;
  consentGranted?: boolean;
  toolName?: string;
  success?: boolean;
  executionMs?: number;
  inputLength?: number;
}): AuditReceipt {
  const timestamp = new Date().toISOString();

  const receipt: AuditReceipt = {
    receiptId: randomUUID(),
    action: params.action,
    actor: params.actor,
    tenantId: params.tenantId,
    sessionId: params.sessionId,
    riskLevel: params.riskLevel,
    consentRequired: params.consentRequired ?? false,
    consentGranted: params.consentGranted ?? true,
    toolName: params.toolName,
    success: params.success,
    executionMs: params.executionMs,
    inputLength: params.inputLength,
    hash: "",
    timestamp,
  };

  const hashInput = `${receipt.action}:${receipt.actor}:${receipt.tenantId}:${receipt.riskLevel}:${receipt.timestamp}`;
  (receipt as { hash: string }).hash = createHash("sha256").update(hashInput).digest("hex");

  receiptLog.push(receipt);
  if (receiptLog.length > MAX_RECEIPTS) receiptLog.splice(0, receiptLog.length - MAX_RECEIPTS);

  return receipt;
}

export function getReceipts(tenantId: string, limit = 50): AuditReceipt[] {
  return receiptLog.filter((r) => r.tenantId === tenantId).slice(-limit);
}

export function getReceiptsByActor(actor: string, limit = 50): AuditReceipt[] {
  return receiptLog.filter((r) => r.actor === actor).slice(-limit);
}

export function verifyReceipt(receipt: AuditReceipt): boolean {
  const hashInput = `${receipt.action}:${receipt.actor}:${receipt.tenantId}:${receipt.riskLevel}:${receipt.timestamp}`;
  const expected = createHash("sha256").update(hashInput).digest("hex");
  return receipt.hash === expected;
}

export function getReceiptStats(tenantId: string): {
  total: number;
  byRisk: Record<string, number>;
  byAction: Record<string, number>;
  consentRequired: number;
  consentDenied: number;
} {
  const filtered = receiptLog.filter((r) => r.tenantId === tenantId);
  const byRisk: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  let consentRequired = 0;
  let consentDenied = 0;

  for (const r of filtered) {
    byRisk[r.riskLevel] = (byRisk[r.riskLevel] || 0) + 1;
    byAction[r.action] = (byAction[r.action] || 0) + 1;
    if (r.consentRequired) consentRequired++;
    if (r.consentRequired && !r.consentGranted) consentDenied++;
  }

  return { total: filtered.length, byRisk, byAction, consentRequired, consentDenied };
}
