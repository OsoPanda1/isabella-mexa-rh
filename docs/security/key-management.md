# KEY_MANAGEMENT.md — Ciclo de vida de llaves criptograficas

**Estado:** diseno con estado actual y objetivo documentado.
**Fecha:** 20 agosto 2026.

## 1. Tipos de llave

### 1.1 JWT Signing Key

| Campo | Valor |
|---|---|
| **Algoritmo** | HMAC-SHA256 (HS256) |
| **Uso** | Firmar y verificar tokens JWT de autenticacion |
| **Ubicacion actual** | `JWT_SECRET` en `.env` / environment variable |
| **Tamano** | 64 bytes (512 bits) minimos |

### 1.2 API HMAC Key

| Campo | Valor |
|---|---|
| **Algoritmo** | HMAC-SHA256 |
| **Uso** | Autenticacion de webhooks y API-to-API |
| **Ubicacion actual** | `API_HMAC_SECRET` en environment variable |
| **Tamano** | 32 bytes (256 bits) minimos |

### 1.3 Envelope Encryption Keys (futuro)

| Campo | Valor |
|---|---|
| **Algoritmo** | AES-256-GCM (DEK) + RSA-4096 o ECDSA P-384 (KEK) |
| **Uso** | Cifrado de datos CONFIDENTIAL y RESTRICTED |
| **Ubicacion actual** | No implementado |
| **Arquitectura** | DEK cifra datos, KEK cifra DEK, DEK destruido despues de uso |

### 1.4 PQC Signing Keys (prototipo)

| Campo | Valor |
|---|---|
| **Algoritmo** | ML-DSA-87 (Dilithium), SLH-DSA-128s (SPHINCS+) |
| **Uso** | Firma de bundles, evidencia, provenance |
| **Ubicacion actual** | Prototipo simulado en `postQuantumCrypto.ts` |
| **Estado** | **PROHIBIDO en produccion** - requiere libreria PQC auditada |

### 1.5 TLS Certificates

| Campo | Valor |
|---|---|
| **Algoritmo** | ECDSA P-256 o RSA-2048+ |
| **Uso** | TLS para conexiones HTTPS y mTLS |
| **Ubicacion actual** | Gestionado por Vercel (auto), manual para Express |

## 2. Ciclo de vida

### 2.1 Generacion

```
+------------------+     +------------------+     +------------------+
| Generacion segura| --> | Validacion       | --> | Registro         |
| (crypto.random)  |     | (tamano, entropia|     | (key ID, fecha,  |
|                  |     |  algoritmo)      |     |  owner, uso)     |
+------------------+     +------------------+     +------------------+
```

**Reglas de generacion:**

| Regla | Detalle |
|---|---|
| Fuente de entropia | `crypto.randomBytes()` de Node.js (CSPRNG) |
| Tamano minimo | HMAC: 32 bytes, RSA: 2048 bits, ECDSA: 256 bits |
| Generacion unica | Nunca reutilizar una llave para propositos diferentes |
| Sin hardcode | Nunca generar llaves en codigo fuente |
| Versionado | Cada llave recibe un ID unico (`kid`) |

### 2.2 Almacenamiento

| Tipo | Estado actual | Estado objetivo |
|---|---|---|
| JWT Secret | Env var (`JWT_SECRET`) | Vault/KMS con access logging |
| HMAC Key | Env var | Vault/KMS con access logging |
| Envelope DEK | N/A | Memoria del servicio, nunca persistido |
| Envelope KEK | N/A | HSM o KMS cloud |
| PQC Keys | Simuladas | HSM con soporte PQC |
| TLS | Vercel auto-managed | HSM o certificate manager |

**Prohibiciones de almacenamiento:**

1. **NUNCA** en codigo fuente (ni hardcoded, ni en comentarios).
2. **NUNCA** en repositorio de git (ni commits, ni PRs).
3. **NUNCA** en logs de aplicacion.
4. **NUNCA** en mensajes de error o panic.
5. **NUNCA** en variables de entorno en archivos versionados.
6. **NUNCA** en dumps de memoria o core dumps.
7. **NUNCA** en el mismo sistema que los datos que cifran (si es envelope encryption).

### 2.3 Rotacion

| Tipo de llave | Frecuencia actual | Frecuencia objetivo | Metodo |
|---|---|---|---|
| JWT Secret | Manual, sin schedule | **90 dias** automatico | Dual-key: old + new durante transicion |
| API HMAC | Manual, sin schedule | **90 dias** automatico | Dual-key durante transicion |
| Envelope KEK | N/A | **365 dias** automatico | Re-encryption de DEKs con KEK nuevo |
| Envelope DEK | N/A | **Por operacion** | Nuevo DEK por cada operacion de cifrado |
| TLS cert | Auto (Vercel) | Auto (Vercel) + manual check | Auto-renew + monitoreo |
| PQC signing | N/A | **180 dias** | Dual-key con ventana de gracia |

**Proceso de rotacion JWT:**

```
1. Generar nuevo JWT_SECRET con crypto.randomBytes(64)
2. Registrar nuevo secret en KMS/vault con nuevo kid
3. Configurar app para acceptar AMBOS (old + new)
   - Verificacion: probar con ambos secrets
4. Esperar ventana de gracia (72 horas minimo)
   - Todos los tokens existentes usan old
   - Tokens nuevos usan new
5. Revocar old secret despues de ventana de gracia
6. Verificar que solo new esta activo
7. Documentar: fecha, kid old, kid new, operador
```

### 2.4 Revocacion

| Escenario | Accion | Urgencia |
|---|---|---|
| Llave comprometida | Revocacion inmediata, kill-switch si necesario | SEV-1 |
| Llave expirada | Revocar + generar nueva | SEV-2 |
| Rotation programada | Revocar old despues de ventana de gracia | SEV-4 |
| Compromiso de tenant | Revocar llaves de ese tenant especifico | SEV-2 |

**Revocacion de JWT:**

```
1. Revocar secret en KMS/vault
2. Si hay refresh tokens: invalidar todos
3. Si hay session tokens: esperar expiracion o forzar re-login
4. Notificar a usuarios afectados
5. Registrar en audit log inmutable
```

### 2.5 Destruccion

| Paso | Metodo | Verificacion |
|---|---|---|
| 1. Marcar como destruible | Flag en KMS | Registro en audit log |
| 2. Sobreescribir en disco | `crypto.randomBytes()` sobre el sector | Hash verification |
| 3. Eliminar de KMS | Delete key (soft delete + purge) | Confirmacion de KMS |
| 4. Eliminar backups | Sobreescribir todos los backups que contengan la llave | Lista de backups verificada |
| 5. Registrar destruccion | Evento inmutable en audit log | Hash chain intacto |

## 3. Estado actual vs objetivo

### Estado actual

| Aspecto | Estado | Riesgo |
|---|---|---|
| JWT Secret en env var | Funcional para dev, **inseguro para produccion** | Alto |
| Sin key rotation | Tokens validos indefinidamente | Alto |
| Sin envelope encryption | Datos sin cifrar en reposo | Critico |
| PQC simulado | Prototipo, no funciona | Alto (si se usa) |
| Sin access logging | No se sabe quien accedio a que llave | Medio |
| Sin HSM | Llaves en software | Alto |
| Sin versionado de llaves | No hay `kid` formal | Medio |

### Estado objetivo

| Aspecto | Objetivo | Timeline |
|---|---|---|
| JWT Secret en KMS | Vault/HSM con access logging | Fase 3 (semanas 6-8) |
| Automatic key rotation | 90 dias JWT/HMAC, 365 dias KEK | Fase 4 (semanas 9-12) |
| Envelope encryption | DEK por operacion, KEK en HSM | Post-migracion |
| PQC con libreria real | liboqs o pqcrypto | Post-prototipo |
| Access logging completo | Todo acceso a llaves registrado | Fase 3 |
| HSM-backed keys | Hardware security module | Post-migracion |
| Key versioning formal | `kid` en todos los tokens | Fase 3 |

## 4. Prohibiciones (resumen)

| # | Prohibicion | Consecuencia de violacion |
|---|---|---|
| 1 | No almacenar llaves en codigo fuente | SEV-1 - kill-switch |
| 2 | No committear llaves en git | SEV-1 - rotar + git filter-branch |
| 3 | No usar la misma llave para propósitos diferentes | SEV-2 - rotar inmediatamente |
| 4 | No usar la misma llave en múltiples tenants | SEV-1 - rotar + notificar tenants |
| 5 | No loguear llaves (ni parciales, ni hashes de uso) | SEV-2 - corregir + purge logs |
| 6 | No compartir llaves entre entornos (dev/staging/prod) | SEV-2 - generar llaves separadas |
| 7 | No usar llaves mock en produccion | SEV-1 - activar solo con FEATURE_LAB_MODE |
| 8 | No rotar sin ventana de gracia | SEV-2 - puede causar outage de auth |

## 5. Multi-tenancy y llaves

| Regla | Detalle |
|---|---|
| Separacion | Cada tenant puede tener llaves propias (futuro) |
| Herencia | Si no tiene llaves propias, usa las del sistema |
| Aislamiento | Llave de tenant A nunca se usa para tenant B |
| Rotacion | Rotar llave de un tenant no afecta a otros |
| Auditoria | Cada operacion de llave registra tenant ID |

## 6. Monitoreo de llaves

| Metrica | Alerta si |
|---|---|
| Edad de la llave | > periodo de rotation |
| Uso de la llave | Patron anomalo (horarios, volumen) |
| Intentos de acceso fallidos | > 5 en 5 minutos |
| Llave en repo publico | Inmediato - SEV-1 |
| Dual-key window expirada | Old secret sin revocar > 30 dias |

## 7. Compliance y regulacion

| Regulacion | Requisito de llaves | Cumplimiento |
|---|---|---|
| OWASP Top 10 | A02:2021 - Cryptographic Failures | Rotation + minimum key sizes |
| NIST SP 800-57 | Key management lifecycle | Generacion, rotation, destruccion |
| FIPS 140-2 | HSM-backed keys para datos sensibles | Objetivo post-migracion |
| LFPDPPP (Mexico) | Proteccion de PII con cifrado | Envelope encryption para PII |
| GDPR Art. 32 | Encryption of personal data | Cifrado en reposo y transito |

## 8. Notas de implementacion

- El `JWT_SECRET` actual se genera al inicio de la aplicacion y se mantiene en memoria.
- No hay mecanismo de rotacion sin downtime actualmente.
- La migracion a KMS/vault requiere cambio en `auth.server.ts` y `server.ts`.
- Los prototipos PQC (`postQuantumCrypto.ts`) deben permanecer detras de
  `FEATURE_LAB_MODE=true` hasta tener libreria auditada.
- Envelope encryption es un post-migracion - primero resolver la base
  (KMS, key versioning, rotation automatica).
