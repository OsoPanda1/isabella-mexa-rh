// ==== Isabella Ledger — snapshot de demostración (solo backend/local) ====
// Genera una cadena con hash chain REAL (sha256 de Node) para que la UI pueda
// validar estructura en modo demo. Se etiqueta `origin: "demo"` y NO debe
// presentarse como datos de producción. En producción el BFF reenvía al
// servicio persistente y este módulo no se usa.

import { createHash } from "node:crypto";
import type { LedgerBlock, LedgerSnapshot } from "./contracts";

export const LEDGER_POLICY_VERSION = "2.0.0";

const DEMO_OPERATIONS = [
  "MODEL_INVOCATION",
  "REVENUE_SPLIT_SETTLE",
  "DATA_RIGHTS_EXPORT",
  "MEMORY_LINK_COMMIT",
] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildDemoLedgerSnapshot(count = 12): LedgerSnapshot {
  const blocks: LedgerBlock[] = [];
  let previousHash = "0".repeat(64);
  const base = Date.parse("2026-08-23T16:55:00.000Z");

  for (let i = 0; i < count; i += 1) {
    const seq = i;
    const timestamp = new Date(base + i * 240_000).toISOString();
    const operation = i === 0 ? "SYSTEM_BOOT" : DEMO_OPERATIONS[(i - 1) % DEMO_OPERATIONS.length];
    const signerId = i === 0 ? "crown-genesis" : `node-${(i % 3) + 1}`;
    const payloadHash = sha256(`${operation}|${seq}|${signerId}`);
    const currentHash = sha256(
      `${previousHash}|${seq}|${timestamp}|${operation}|${signerId}|${payloadHash}`,
    );
    blocks.push({
      seq,
      timestamp,
      operation,
      previousHash,
      payloadHash,
      currentHash,
      signerId,
      algorithm: "SHA-256",
    });
    previousHash = currentHash;
  }

  return {
    origin: "demo",
    integrity: "unverified",
    blocks,
    fetchedAt: new Date().toISOString(),
    policyVersion: LEDGER_POLICY_VERSION,
    chainDigest: previousHash,
  };
}
