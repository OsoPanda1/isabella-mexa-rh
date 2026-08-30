// ==== Isabella Crypto — registro de prototipos (separación producción) ====
// Lista canónica de componentes criptográficos PROTOTIPO y gate fail-closed.
// Ningún componente de esta lista debe usarse en producción. En producción
// (sin FEATURE_LAB_MODE / VITE_FEATURE_LAB_MODE), cualquier operación de
// firma/clave/athestación lanza PROTOTYPE_NOT_AVAILABLE. Esto impide presentar
// criptografía simulada como productiva (P0-05).
//
// Producción requiere componentes REALES y auditados:
//  - HSM/KMS real (PKCS#11, Cloud KMS, SoftHSM con claves no exportables).
//  - Atestación TEE real (SGX/SEV/TrustZone) verificada por un servicio
//    independiente del enclave.
//  - PQC auditado (p.ej. liboqs) con claves y parámetros validados.
//  - WebAuthn real (RP-ID/origin verificados, contador de clonación).

export const PROTOTYPE_CRYPTO_COMPONENTS = [
  "PQC-ML-KEM-768",
  "PQC-ML-DSA-87",
  "PQC-SLH-DSA-128s",
  "PQC-LITLE-32",
  "PQC-LEDGER-SIGN",
  "HSM_SIMULATOR",
  "TEE-ATTESTATION",
] as const;

export type PrototypeCryptoComponent = (typeof PROTOTYPE_CRYPTO_COMPONENTS)[number];

function labModeEnabled(): boolean {
  // Servidor / Node: flag explícito.
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (nodeEnv?.FEATURE_LAB_MODE === "true") return true;
  // Navegador (Vite): flag explícito únicamente. No se auto-habilita en DEV
  // para no presentar nunca cripto simulada como disponible por defecto.
  if (typeof import.meta !== "undefined") {
    const viteEnv = (import.meta as { env?: Record<string, string | boolean | undefined> }).env;
    if (viteEnv && viteEnv.VITE_FEATURE_LAB_MODE === "true") return true;
  }
  return false;
}

export function isPrototypeCryptoAllowed(): boolean {
  return labModeEnabled();
}

export function assertPrototypeCrypto(component: PrototypeCryptoComponent | string): void {
  if (!labModeEnabled()) {
    throw new Error(
      `PROTOTYPE_NOT_AVAILABLE: ${component} es un prototipo de laboratorio. ` +
        `No debe usarse en producción. Define FEATURE_LAB_MODE=true (servidor) o ` +
        `VITE_FEATURE_LAB_MODE=true (desarrollo) solo en entornos de laboratorio.`,
    );
  }
}
