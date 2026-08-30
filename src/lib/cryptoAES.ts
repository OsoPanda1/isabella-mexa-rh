import { hsmClient } from "./hsmClient";

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  timestamp: number;
  hsmKeyId?: string;
  teeAttestation?: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function generateAESKeyFromHSM(label = `cattleya_${Date.now()}`): Promise<{ keyId: number; key: CryptoKey }> {
  await hsmClient.connect();
  const hsmKey = await hsmClient.generateAESKey(label);
  const derivedSecret = await hsmClient.deriveKey(hsmKey.id, "aes-256-gcm-cattleya");
  const bytes = Uint8Array.from(derivedSecret.match(/.{1,2}/g) || [], (byte) => Number.parseInt(byte, 16)).slice(0, 32);
  const key = await crypto.subtle.importKey("raw", bytes, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { keyId: hsmKey.id, key };
}

export async function encryptAES256GCM(data: string, key: CryptoKey, hsmKeyId?: number): Promise<EncryptedData> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(data));
  const encrypted = new Uint8Array(encryptedBuffer);
  const ciphertext = encrypted.slice(0, -16);
  const authTag = encrypted.slice(-16);
  return { ciphertext: bytesToBase64(ciphertext), iv: bytesToBase64(iv), authTag: bytesToBase64(authTag), timestamp: Date.now(), hsmKeyId: hsmKeyId?.toString() };
}

export async function decryptAES256GCM(ciphertext: string, iv: string, authTag: string, key: CryptoKey): Promise<string> {
  const cipherBytes = base64ToBytes(ciphertext);
  const tagBytes = base64ToBytes(authTag);
  const sealed = new Uint8Array(cipherBytes.length + tagBytes.length);
  sealed.set(cipherBytes);
  sealed.set(tagBytes, cipherBytes.length);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, key, sealed);
  return new TextDecoder().decode(decrypted);
}

export async function generateTEEAttestation(challenge: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tee:${challenge}`));
  const proof = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `TEE_SGX_SIM_${proof.slice(0, 32)}_${Date.now()}`;
}
