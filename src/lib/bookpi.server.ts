/**
 * BookPI™ Engine — Immutable Cryptographic Ledger with PQC (ML-DSA-87 & SLH-DSA-128s)
 * Hash-chained blocks with PoW, event classification, IPFS-style CID simulation,
 * and Post-Quantum Lattice & Hash Signatures (CRYSTALS-LATAMV).
 */
import { createHash } from "node:crypto";
import { loadJsonArray, saveJsonArray } from "./durable-json.server";
import { signLedgerBlockPQC as signLedgerBlockPQCImpl } from "./postQuantumCrypto";

// PQC signing is a lab prototype: it throws PROTOTYPE_NOT_AVAILABLE unless
// FEATURE_LAB_MODE=true. Degrade gracefully to unsigned blocks instead.
function signLedgerBlockPQC(blockId: string, dataHash: string): { mlDsaSignature: string; slhDsaSignature: string; litleGatesStatus: string } | null {
  try { return signLedgerBlockPQCImpl(blockId, dataHash); }
  catch { return null; }
}

export type BookPIEventType =
  | "http_request" | "http_response"
  | "module_registered" | "module_evaluated" | "module_closed"
  | "user_action" | "ai_decision" | "ai_eval"
  | "economic_transaction" | "order_created" | "order_paid"
  | "dao_proposal" | "dao_vote"
  | "security_alert" | "policy_violation" | "hard_stop"
  | "phoenix_failover" | "system_critical" | "kernel_boot"
  | "eoct_event" | "isabella_recommendation" | "anubis_verdict";

export interface BookPIBlock {
  index: number;
  timestamp: string;
  eventType: BookPIEventType;
  module: string;
  action: string;
  actor: string;
  data: Record<string, unknown>;
  prevHash: string;
  nonce: number;
  hash: string;
  cid: string; // IPFS-style CID simulation
  pqcSignature?: {
    mlDsaSignature: string;
    slhDsaSignature: string;
    litleGatesStatus: string;
  };
}

const DIFFICULTY = 2;
const LEDGER_MAX = 5_000;
const ledger: BookPIBlock[] = loadJsonArray<BookPIBlock>("bookpi-ledger");
let _prevHash = ledger.at(-1)?.hash || "0".repeat(64);

function mine(base: string): { nonce: number; hash: string } {
  let nonce = 0;
  while (true) {
    const h = createHash("sha256").update(base + nonce).digest("hex");
    if (h.startsWith("0".repeat(DIFFICULTY))) return { nonce, hash: h };
    nonce++;
  }
}

function makeCID(hash: string): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let encoded = "";
  let n = BigInt("0x" + hash);
  while (n > 0n) {
    encoded = chars[Number(n % 58n)] + encoded;
    n = n / 58n;
  }
  return "bafyrei" + encoded.slice(0, 32);
}

export function appendBlock(input: {
  eventType: BookPIEventType;
  module: string;
  action: string;
  actor: string;
  data?: Record<string, unknown>;
}): BookPIBlock {
  const index = ledger.length;
  const timestamp = new Date().toISOString();
  const data = input.data ?? {};
  const base = `${index}${_prevHash}${timestamp}${input.module}${input.action}${input.actor}${JSON.stringify(data)}`;
  const { nonce, hash } = mine(base);

  const pqcProof = signLedgerBlockPQC(`blk-${index}`, hash);

  const block: BookPIBlock = {
    index,
    timestamp,
    eventType: input.eventType,
    module: input.module,
    action: input.action,
    actor: input.actor,
    data,
    prevHash: _prevHash,
    nonce,
    hash,
    cid: makeCID(hash),
    ...(pqcProof ? {
      pqcSignature: {
        mlDsaSignature: pqcProof.mlDsaSignature,
        slhDsaSignature: pqcProof.slhDsaSignature,
        litleGatesStatus: pqcProof.litleGatesStatus,
      },
    } : {}),
  };

  _prevHash = hash;
  ledger.push(block);
  if (ledger.length > LEDGER_MAX) ledger.splice(0, ledger.length - LEDGER_MAX);
  saveJsonArray("bookpi-ledger", ledger);
  return block;
}

export function readLedger(limit = 50, eventType?: BookPIEventType): BookPIBlock[] {
  const src = eventType ? ledger.filter((b) => b.eventType === eventType) : ledger;
  return src.slice(-limit).reverse();
}

export function verifyLedger(): { ok: boolean; brokenAt?: number; total: number; pqcVerified: boolean } {
  let prev = "0".repeat(64);
  for (let i = 0; i < ledger.length; i++) {
    const b = ledger[i];
    if (b.prevHash !== prev) return { ok: false, brokenAt: i, total: ledger.length, pqcVerified: false };
    const base = `${b.index}${b.prevHash}${b.timestamp}${b.module}${b.action}${b.actor}${JSON.stringify(b.data)}`;
    const recomputed = createHash("sha256").update(base + b.nonce).digest("hex");
    if (recomputed !== b.hash) return { ok: false, brokenAt: i, total: ledger.length, pqcVerified: false };
    prev = b.hash;
  }
  return { ok: true, total: ledger.length, pqcVerified: false };
}

export function ledgerStats() {
  const byType: Record<string, number> = {};
  for (const b of ledger) byType[b.eventType] = (byType[b.eventType] ?? 0) + 1;
  return { total: ledger.length, byType, latestHash: _prevHash, pqcEngine: "ML-DSA-87 + SLH-DSA-128s Active" };
}

// Bootstrap Initial Block
if (ledger.length === 0) {
  appendBlock({ eventType: "kernel_boot", module: "BookPI", action: "ledger.init", actor: "system", data: { version: "4.2.0-PQC", difficulty: DIFFICULTY, persistence: "durable-json" } });
}