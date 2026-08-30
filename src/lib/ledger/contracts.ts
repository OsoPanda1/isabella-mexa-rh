// ==== Isabella Ledger — contratos de datos (endurecidos) ====
// Tipos canónicos del ledger. Cerrados a propósito (sin `additionalProperties`)
// para que el cliente nunca sea fuente de verdad: solo presenta DTOs de API.

export type DataOrigin = "live" | "demo" | "cached" | "unavailable";
export type IntegrityState = "verified" | "invalid" | "unverified" | "stale";

export interface LedgerBlock {
  seq: number;
  timestamp: string;
  operation: string;
  previousHash: string;
  payloadHash: string;
  currentHash: string;
  signerId: string;
  algorithm: "SHA-256" | "SHA3-512";
  signature?: string;
  keyId?: string;
}

export interface LedgerSnapshot {
  origin: DataOrigin;
  integrity: IntegrityState;
  blocks: LedgerBlock[];
  nextCursor?: string;
  fetchedAt: string;
  policyVersion: string;
  chainDigest?: string;
}

export interface IntegrityResult {
  valid: boolean;
  state: IntegrityState;
  checked: number;
  total: number;
  invalidSeq?: number;
  code: string;
  message: string;
}
