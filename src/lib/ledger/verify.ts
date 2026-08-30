// ==== Isabella Ledger — verificador seguro de cadena ====
// Valida ESTRUCTURA y ENLACES de la cadena de bloques recibida de la API.
// NO declara "integridad criptográfica" sólo por formato hexadecimal: la
// recomputación de hashes y la validación de firma corresponden al backend con
// sus claves y algoritmos. Aquí solo se comprueba que el cliente no presente
// una cadena rota (hash alterado, secuencia, enlace o formato inválidos).

import type { IntegrityResult, LedgerBlock } from "./contracts";

const HEX_64 = /^[a-f0-9]{64}$/i;

function invalid(
  block: LedgerBlock,
  index: number,
  total: number,
  code: string,
): IntegrityResult {
  return {
    valid: false,
    state: "invalid",
    checked: index,
    total,
    invalidSeq: block.seq,
    code,
    message: `Anomalía en el bloque #${block.seq}.`,
  };
}

export async function verifyLedger(
  blocks: readonly LedgerBlock[],
  signal?: AbortSignal,
): Promise<IntegrityResult> {
  if (!blocks.length) {
    return {
      valid: false,
      state: "unverified",
      checked: 0,
      total: 0,
      code: "EMPTY_LEDGER",
      message: "No hay bloques verificables.",
    };
  }

  for (let i = 0; i < blocks.length; i += 1) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const block = blocks[i];

    if (!HEX_64.test(block.currentHash) || !HEX_64.test(block.payloadHash)) {
      return invalid(block, i, blocks.length, "HASH_FORMAT_INVALID");
    }

    if (i === 0 && block.previousHash !== "0".repeat(64)) {
      return invalid(block, i, blocks.length, "GENESIS_LINK_INVALID");
    }

    if (i > 0) {
      const previous = blocks[i - 1];
      if (block.seq !== previous.seq + 1) {
        return invalid(block, i, blocks.length, "SEQUENCE_INVALID");
      }
      if (block.previousHash.toLowerCase() !== previous.currentHash.toLowerCase()) {
        return invalid(block, i, blocks.length, "CHAIN_LINK_INVALID");
      }
    }

    if (!Number.isSafeInteger(block.seq) || block.seq < 0) {
      return invalid(block, i, blocks.length, "SEQUENCE_INVALID");
    }

    if (Number.isNaN(Date.parse(block.timestamp))) {
      return invalid(block, i, blocks.length, "TIMESTAMP_INVALID");
    }
  }

  return {
    valid: true,
    state: "verified",
    checked: blocks.length,
    total: blocks.length,
    code: "LEDGER_STRUCTURE_VALID",
    message: "La estructura de la cadena es válida.",
  };
}
