import { randomBytes } from "node:crypto";
import type { LedgerEntry, PayoutRequest, WalletSummary } from "../types";

/* ========================================================================== *
 * Isabella Wallet
 *
 * Per-user balance tracking, ledger, and payout management.
 * All mutations are append-only (ledger pattern).
 * ========================================================================== */

const wallets = new Map<string, { summary: WalletSummary; ledger: LedgerEntry[] }>();

// P0.2: idempotencia. Mapa eventId -> asiento ya aplicado para evitar
// doble-aplicación por reintentos del caller (doble crédito/débito).
const ledgerByEvent = new Map<string, LedgerEntry>();

// Registro de pagos con máquina de estados y reconciliación.
type StoredPayout = PayoutRequest & { updatedAt: string };
const payouts = new Map<string, StoredPayout>();

function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function getWalletKey(principalId: string, tenantId: string): string {
  return `${tenantId}:${principalId}`;
}

function getOrCreateWallet(principalId: string, tenantId: string) {
  const key = getWalletKey(principalId, tenantId);
  if (!wallets.has(key)) {
    wallets.set(key, {
      summary: {
        balance: 0,
        pendingSettlement: 0,
        totalEarned: 0,
        totalPaidOut: 0,
        currency: "USD",
        updatedAt: new Date().toISOString(),
      },
      ledger: [],
    });
  }
  return wallets.get(key)!;
}

export function credit(
  principalId: string,
  tenantId: string,
  eventId: string,
  amount: number,
  description: string
): LedgerEntry {
  // P0.2: idempotencia — si el eventId ya fue aplicado, devolvemos el asiento
  // original en lugar de volver a acreditar (protege contra reintentos).
  const already = ledgerByEvent.get(eventId);
  if (already) return already;

  const wallet = getOrCreateWallet(principalId, tenantId);
  wallet.summary.balance += amount;
  wallet.summary.totalEarned += amount;
  wallet.summary.updatedAt = new Date().toISOString();

  const entry: LedgerEntry = {
    id: generateId("le"),
    walletId: getWalletKey(principalId, tenantId),
    eventId,
    type: "credit",
    amount,
    currency: "USD",
    balance: wallet.summary.balance,
    description,
    timestamp: new Date().toISOString(),
  };
  wallet.ledger.push(entry);
  ledgerByEvent.set(eventId, entry);
  return entry;
}

export function debit(
  principalId: string,
  tenantId: string,
  eventId: string,
  amount: number,
  description: string
): LedgerEntry | null {
  // P0.2: idempotencia — si el eventId ya fue aplicado, devolvemos el asiento
  // original en lugar de volver a debitar.
  const already = ledgerByEvent.get(eventId);
  if (already) return already;

  const wallet = getOrCreateWallet(principalId, tenantId);
  if (wallet.summary.balance < amount) return null;

  wallet.summary.balance -= amount;
  wallet.summary.updatedAt = new Date().toISOString();

  const entry: LedgerEntry = {
    id: generateId("le"),
    walletId: getWalletKey(principalId, tenantId),
    eventId,
    type: "debit",
    amount,
    currency: "USD",
    balance: wallet.summary.balance,
    description,
    timestamp: new Date().toISOString(),
  };
  wallet.ledger.push(entry);
  ledgerByEvent.set(eventId, entry);
  return entry;
}

export function addPendingSettlement(
  principalId: string,
  tenantId: string,
  amount: number
): WalletSummary {
  const wallet = getOrCreateWallet(principalId, tenantId);
  wallet.summary.pendingSettlement += amount;
  wallet.summary.updatedAt = new Date().toISOString();
  return { ...wallet.summary };
}

export function settlePending(
  principalId: string,
  tenantId: string
): WalletSummary {
  const wallet = getOrCreateWallet(principalId, tenantId);
  const pending = wallet.summary.pendingSettlement;
  wallet.summary.balance += pending;
  wallet.summary.totalEarned += pending;
  wallet.summary.pendingSettlement = 0;
  wallet.summary.updatedAt = new Date().toISOString();
  return { ...wallet.summary };
}

export function getBalance(principalId: string, tenantId: string): WalletSummary {
  const wallet = getOrCreateWallet(principalId, tenantId);
  return { ...wallet.summary };
}

export function getLedger(
  principalId: string,
  tenantId: string,
  limit = 50
): LedgerEntry[] {
  const wallet = getOrCreateWallet(principalId, tenantId);
  return wallet.ledger.slice(-limit).reverse();
}

export type PayoutStatus = PayoutRequest["status"];

// Máquina de estados de pago (P0.2): pending -> processing ->
// completed | failed. El débito se aplica al solicitar; si el pago
// falla, los fondos se reconcilian (se acreditan de vuelta).
export function requestPayout(
  principalId: string,
  tenantId: string,
  amount: number,
  method: PayoutRequest["method"]
): PayoutRequest | null {
  const wallet = getOrCreateWallet(principalId, tenantId);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (wallet.summary.balance < amount) return null;

  wallet.summary.balance -= amount;
  wallet.summary.totalPaidOut += amount;
  wallet.summary.updatedAt = new Date().toISOString();

  const payout: StoredPayout = {
    id: generateId("payout"),
    walletId: getWalletKey(principalId, tenantId),
    principalId,
    amount,
    currency: "USD",
    method,
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };
  payouts.set(payout.id, payout);
  return payout;
}

export function getPayout(id: string): PayoutRequest | null {
  return payouts.get(id) ?? null;
}

// Transición a estado terminal "completed". Es idempotente.
export function completePayout(id: string): PayoutRequest | null {
  const payout = payouts.get(id);
  if (!payout) return null;
  if (payout.status === "completed") return payout;
  if (payout.status === "failed") return null;
  payout.status = "completed";
  payout.completedAt = new Date().toISOString();
  payout.updatedAt = payout.completedAt;
  return payout;
}

// P0.2: reconciliación. Si el pago falla, se devuelven los fondos al
// balance para no perder dinero del creador.
export function failPayout(id: string): PayoutRequest | null {
  const payout = payouts.get(id);
  if (!payout) return null;
  if (payout.status === "completed") return null;
  if (payout.status === "failed") return payout;

  const tenantId = payout.walletId.split(":")[0];
  const wallet = getOrCreateWallet(payout.principalId, tenantId);
  wallet.summary.balance += payout.amount;
  wallet.summary.totalPaidOut -= payout.amount;
  wallet.summary.updatedAt = new Date().toISOString();

  payout.status = "failed";
  payout.updatedAt = new Date().toISOString();
  return payout;
}

/**
 * Verifica el invariante de doble entrada (P0.2): el balance debe ser igual a
 * la suma de créditos menos débitos del ledger. Lanza si hay inconsistencia.
 * Devuelve true si el invariante se cumple.
 */
export function verifyLedgerIntegrity(principalId: string, tenantId: string): boolean {
  const wallet = getOrCreateWallet(principalId, tenantId);
  let computed = 0;
  for (const entry of wallet.ledger) {
    computed += entry.type === "credit" ? entry.amount : -entry.amount;
  }
  if (Math.abs(computed - wallet.summary.balance) > 1e-9) {
    throw new Error(
      `ledger_integrity_violation: computed=${computed} balance=${wallet.summary.balance}`,
    );
  }
  return true;
}
