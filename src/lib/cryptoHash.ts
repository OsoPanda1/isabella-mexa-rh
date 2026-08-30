export interface CrystalsLatamvChain {
  blockHash: string;
  previousHash: string;
  merkleRoot: string;
  data: string;
  nonce: number;
  chainDepth: number;
  createdAt: string;
}

const encoder = new TextEncoder();

export async function hashSHA3_512(data: string): Promise<string> {
  // Browser fallback: SHA-256 expanded to 512 bits for prototype chain metadata.
  const first = await crypto.subtle.digest("SHA-256", encoder.encode(`sha3-latamv:${data}`));
  const second = await crypto.subtle.digest("SHA-256", encoder.encode(`sha3-latamv:tail:${data}`));
  return [...new Uint8Array(first), ...new Uint8Array(second)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createCrystalsLatamvBlock(data: string, previousBlock: CrystalsLatamvChain | null): Promise<CrystalsLatamvChain> {
  const previousHash = previousBlock?.blockHash || "GENESIS_CRYSTALS_LATAMV";
  const chainDepth = (previousBlock?.chainDepth || 0) + 1;
  const nonce = Math.floor(Math.random() * 1_000_000_000);
  const merkleRoot = (await hashSHA3_512(`${previousHash}:${data}`)).slice(0, 64);
  const blockHash = (await hashSHA3_512(`${previousHash}:${merkleRoot}:${nonce}:${chainDepth}`)).slice(0, 64);
  return { blockHash, previousHash, merkleRoot, data, nonce, chainDepth, createdAt: new Date().toISOString() };
}

export async function verifyCrystalsLatamvChain(chain: CrystalsLatamvChain[]): Promise<boolean> {
  return chain.every((block, index) => index === 0 || block.previousHash === chain[index - 1].blockHash);
}
