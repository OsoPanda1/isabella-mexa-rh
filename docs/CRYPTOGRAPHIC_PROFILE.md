# CRYPTOGRAPHIC_PROFILE.md — Isabella Villaseñor AI

**Estado:** prototipo experimental. No declarar como producción.

## Algoritmos implementados

### CRYSTALS-LATAMV (src/lib/postQuantumCrypto.ts)

| Algoritmo | Estándar NIST | Uso | Tamaño clave | Estado |
|---|---|---|---|---|
| ML-KEM-768 | FIPS 203 | Encapsulamiento de claves | 1,184 bytes | Prototipo |
| ML-DSA-87 | FIPS 204 | Firmas digitales lattice-based | 2,592 / 4,896 / 4,627 bytes | Prototipo |
| SLH-DSA-128s | FIPS 205 | Firmas hash-based (reserva) | Variable | Prototipo |

### LITLE-32

32-gate quantum attestation matrix (HADAMARD, CNOT, PAULI_Z, TOFFOLI, PHASE_SHIFT).

### BookPI

Cadena append-only con hash SHA-256 y firma dual PQC.

## Prohibiciones explícitas

1. **No usar `hash(secret || message)` como firma.** No existe relación criptográfica válida.
2. **No etiquetar un hash como ML-DSA.** SHA3-512 no es una firma.
3. **No usar claves mock en producción.**
4. **No guardar claves en `.env`, imágenes, logs o repositorios.**
5. **No afirmar verificación si no se verificó el digest exacto.**
6. **ML-KEM es encapsulación de claves, no firma.**
7. **SHAKE256 es función hash, no sustituye autenticación.**

## Pruebas requeridas antes de producción

- KATs oficiales de FIPS 203/204/205
- Interoperabilidad con otra implementación
- Mensaje modificado → rechazo
- Clave pública modificada → rechazo
- Firma truncada, extendida, bytes aleatorios → rechazo
- Rotación y revocación de claves
- Arranque con trust root incorrecto → rechazo
- Bundle firmado con artefacto sustituido → rechazo
- Comparación en tiempo constante

## Claves privadas

- Se almacenan en KMS, Vault o HSM
- Nunca en código, logs, panic messages o dumps
- Trust roots requieren rotación, revocación, quorum y registro
- Key IDs versionados

## Nota sobre el estado actual

Los módulos `postQuantumCrypto.ts`, `hsmClient.ts` y `tee-attestation.ts` son prototipos que modelan los contratos de los estándares NIST. No implementan criptografía real certificada. Para producción se requiere integración con librerías PQC auditadas (liboqs, pqcrypto, etc.).

## Separación producción / prototipo (P0-05)

Los prototipos NUNCA se presentan como producción. Un gate fail-closed
(`src/lib/crypto/prototype-registry.ts`; y `src/lib/lab-mode.ts` para PQC/TEE)
lanza `PROTOTYPE_NOT_AVAILABLE` en cualquier operación de firma/clave/athestación
cuando NO está habilitado el modo laboratorio:

- Servidor: `FEATURE_LAB_MODE=true`.
- Navegador (Vite): `VITE_FEATURE_LAB_MODE=true` (NO se auto-habilita en DEV).

Componentes bajo el gate: PQC (ML-KEM / ML-DSA / SLH-DSA / LITLE / ledger-sign),
`hsmClient` (simulador YubiHSM) y `tee-attestation` (athestación simulada).

Consecuencia verificable: `cryptoAES.generateAESKeyFromHSM` y
`hsmClient.signWithHSMKey` devuelven error en producción; la UI de finanzas
(`CattleyaFinanceView`) degrada a `hsm_unavailable` en lugar de falsear una
firma HSM. La superficie canónica es `src/lib/crypto/index.ts`: producción
(`aes` / `hash` / `webauthn`) frente a `prototype` (PQC / HSM-sim).

Lo que producción REQUIERE (no simulado):

- HSM/KMS real (PKCS#11, Cloud KMS, SoftHSM con claves no exportables) con
  failover y auditoría de uso de claves.
- Atestación TEE real (SGX / SEV / TrustZone) verificada por un servicio
  independiente del enclave, con raíz de confianza y caducidad.
- PQC de librería auditada (p.ej. liboqs) con KATs de FIPS 203/204/205.
