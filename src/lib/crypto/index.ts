// ==== Isabella Crypto — superficie canónica (producción vs prototipo) ====
// Producción: cripto REAL (WebCrypto AES-GCM, SHA-256, WebAuthn).
// Prototipo: PQC / HSM-sim / TEE — SOLO laboratorio, bajo prototype-registry.
//
// Regla de arquitectura: el código de producción (server.ts, *.server.ts) NUNCA
// debe importar los módulos de prototipo directamente. Si se invocan fuera de
// FEATURE_LAB_MODE / VITE_FEATURE_LAB_MODE, cada operación de firma/clave/
// athestación lanza PROTOTYPE_NOT_AVAILABLE (ver src/lib/crypto/prototype-registry.ts).

export * as aes from "../cryptoAES";
export * as hash from "../cryptoHash";
export * as webauthn from "../webAuthn";

// Prototipo (gate fail-closed en cada operación de firma/clave/athestación).
export * as prototype from "../postQuantumCrypto";
export { hsmClient as prototypeHsmClient } from "../hsmClient";

export {
  assertPrototypeCrypto,
  isPrototypeCryptoAllowed,
  PROTOTYPE_CRYPTO_COMPONENTS,
} from "./prototype-registry";
