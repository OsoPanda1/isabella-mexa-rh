import { describe, expect, it } from "vitest";
import { verifyLedger } from "../src/lib/ledger/verify";
import type { LedgerBlock } from "../src/lib/ledger/contracts";

const H64 = (c: string): string => c.repeat(64);

function goodChain(n: number): LedgerBlock[] {
  const blocks: LedgerBlock[] = [];
  let prev = H64("0");
  const base = Date.parse("2026-08-23T16:55:00.000Z");
  for (let i = 0; i < n; i += 1) {
    const current = H64(String(i + 1));
    blocks.push({
      seq: i,
      timestamp: new Date(base + i * 1000).toISOString(),
      operation: i === 0 ? "SYSTEM_BOOT" : "MODEL_INVOCATION",
      previousHash: prev,
      payloadHash: H64("f"),
      currentHash: current,
      signerId: "node-1",
      algorithm: "SHA-256",
    });
    prev = current;
  }
  return blocks;
}

describe("verifyLedger", () => {
  it("valida una cadena bien formada", async () => {
    const res = await verifyLedger(goodChain(5));
    expect(res.valid).toBe(true);
    expect(res.state).toBe("verified");
    expect(res.checked).toBe(5);
  });

  it("rechaza ledger vacío", async () => {
    const res = await verifyLedger([]);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("EMPTY_LEDGER");
  });

  it("detecta enlace de cadena alterado", async () => {
    const blocks = goodChain(3);
    blocks[2].previousHash = H64("a");
    const res = await verifyLedger(blocks);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("CHAIN_LINK_INVALID");
    expect(res.invalidSeq).toBe(2);
  });

  it("detecta hash con formato inválido", async () => {
    const blocks = goodChain(2);
    blocks[1].currentHash = "xyz";
    const res = await verifyLedger(blocks);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("HASH_FORMAT_INVALID");
  });

  it("detecta secuencia no monotónica", async () => {
    const blocks = goodChain(3);
    blocks[2].seq = 0;
    const res = await verifyLedger(blocks);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("SEQUENCE_INVALID");
  });

  it("detecta génesis con prevHash incorrecto", async () => {
    const blocks = goodChain(2);
    blocks[0].previousHash = H64("9");
    const res = await verifyLedger(blocks);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("GENESIS_LINK_INVALID");
  });
});
