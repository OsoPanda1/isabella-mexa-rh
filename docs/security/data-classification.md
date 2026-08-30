# DATA_CLASSIFICATION.md — Esquema de clasificacion de datos

**Estado:** diseno para implementacion.
**Fecha:** 20 agosto 2026.

## 1. Principios

1. **Clasificar antes de almacenar.** Todo dato nuevo recibe una clasificacion antes de persistirse.
2. **Descender, nunca ascender.** Un dato RESTRICTED no puede degradarse a CONFIDENTIAL sin validacion.
3. **Herencia.** Si un container tiene datos de distintas clases, se trata como la mas restrictiva.
4. **Auditable.** Toda decision de clasificacion queda registrada en el audit log.
5. **Default deny.** Sin clasificacion explicita, el dato se asume CONFIDENTIAL.

## 2. Niveles de clasificacion

### PUBLIC

| Campo | Valor |
|---|---|
| **Descripcion** | Datos destinados a ser publicos. Sin restriccion de acceso. |
| **Riesgo si se filtra** | Ninguno - esta diseñado para difusion |
| **Ejemplos** | Datos territoriales abiertos, documentacion publica, manifiesto legal, plantillas de prompt publicas |

**Requisitos de almacenamiento:**

| Requisito | Valor |
|---|---|
| Cifrado en reposo | No requerido |
| Cifrado en transito | Recomendado (HTTPS) |
| Control de acceso | Sin restriccion |
| Retencion | Sin limite - puede ser permanente |
| Borrado | Bajo demanda, sin verificacion adicional |
| Backup | Necesario para disponibilidad |
| Auditoria | Log basico de accesos |

**Ejemplos de datos:**
- `docs/PRESENTACION_INSTITUCIONAL_CATTLEYA.md`
- `docs/MANIFIESTO_LEGAL_CATTLEYA.md`
- `data/prompt-templates/` (publicos)
- `README.md`

### INTERNAL

| Campo | Valor |
|---|---|
| **Descripcion** | Datos internos del sistema. No sensibles pero no para difusion publica. |
| **Riesgo si se filtra** | Bajo - puede revelar arquitectura o metricas internas |
| **Ejemplos** | Telemetry del sistema, metricas agregadas, logs de operacion, configuracion no secreta |

**Requisitos de almacenamiento:**

| Requisito | Valor |
|---|---|
| Cifrado en reposo | Recomendado |
| Cifrado en transito | Requerido (HTTPS/mTLS) |
| Control de acceso | Roles internos (operator, admin) |
| Retencion | 90 dias para logs, 12 meses para metricas |
| Borrado | Con verificacion de eliminacion |
| Backup | Requerido |
| Auditoria | Log de accesos con timestamps |

**Ejemplos de datos:**
- Metricas de telemetry (`metrics.snapshot()`)
- Logs de operacion (`auditLog`)
- Eventos del event bus
- Health check results
- Configuracion de features flags
- Estado del worker pool
- `COMPONENT_STATUS.md`

### CONFIDENTIAL

| Campo | Valor |
|---|---|
| **Descripcion** | Datos sensibles del usuario y del sistema. Acceso restringido. |
| **Riesgo si se filtra** | Alto - violacion de privacidad, dano reputacional |
| **Ejemplos** | Conversaciones de usuario, entradas de memoria, logs de auditoria detallados, claims evaluados |

**Requisitos de almacenamiento:**

| Requisito | Valor |
|---|---|
| Cifrado en reposo | **Requerido** (AES-256-GCM o equivalente) |
| Cifrado en transito | **Requerido** (TLS 1.3) |
| Control de acceso | RBAC estricto, scope-based, por tenant |
| Retencion | 30 dias por defecto, configurable por tenant |
| Borrado | Con verificacion criptografica de eliminacion |
| Backup | Requerido, cifrado, con access log |
| Auditoria | Log completo con actor, accion, timestamp, resultado |

**Ejemplos de datos:**
- Entradas de memory store (conversaciones, contexto)
- Claims evaluados y su evidencia
- Documentos registrados en document-registry
- Resultados de moderacion de contenido
- Estados emocionales del usuario
- Respuestas de Isabella (generadas)
- `SovereignInferenceRequest` (input del usuario)
- `AuditEvent` (detalles)

**Controles adicionales:**
- Datos CONFIDENTIAL de un tenant no son accesibles por otro tenant.
- Queries sobre datos CONFIDENTIAL requieren scope explícito.
- Redaccion automatica en logs (no loguear contenido de conversaciones).
- Anonimizacion para metricas agregadas.

### RESTRICTED

| Campo | Valor |
|---|---|
| **Descripcion** | Datos criticos de seguridad. Acceso minimo absoluto. |
| **Riesgo si se filtra** | Critico - compromiso del sistema, robo de identidad, daño legal |
| **Ejemplos** | Secretos, llaves JWT, tokens HMAC, PII, credenciales, trust roots |

**Requisitos de almacenamiento:**

| Requisito | Valor |
|---|---|
| Cifrado en reposo | **Requerido** (envelope encryption con DEK/KEK) |
| Cifrado en transito | **Requerido** (TLS 1.3, mTLS preferido) |
| Control de acceso | Solo servicios autorizados, no accionable por humanos |
| Retencion | Minima necesaria, con auto-destruccion |
| Borrado | **Requerido** con verificacion criptografica |
| Backup | Cifrado separado, access log critico |
| Auditoria | Log inmutable con alertas en tiempo real |

**Ejemplos de datos:**
- `JWT_SECRET` (environment variable)
- API HMAC keys
- Claves de cifrado (DEK, KEK)
- Trust roots y claves de firma
- Claves privadas PQC (futuro)
- Credenciales de proveedores (Gemini API key, etc.)
- Tokens de acceso a servicios externos
- PII de usuarios (si se almacena)

**Controles adicionales:**
- **NUNCA** en repositorio de codigo.
- **NUNCA** en logs, mensajes de error, panic messages.
- **NUNCA** en variables de entorno hardcodeadas (usar vault/KMS).
- Acceso solo via programacion (no accionable por humanos en produccion).
- Keys versionadas con IDs unicos.
- Rotacion automatica programada.

## 3. Matriz de control por clase

| Control | PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED |
|---|---|---|---|---|
| Cifrado reposo | No | Recomendado | Si (AES-256) | Si (envelope) |
| Cifrado transito | HTTPS | TLS 1.3 | TLS 1.3 | TLS 1.3 + mTLS |
| Autenticacion | No | Basica | JWT + scope | JWT + scope + mTLS |
| Autorizacion | Sin restriccion | Roles internos | RBAC por tenant | Minimo absoluto |
| Audit logging | Basico | Con timestamps | Completo | Inmutable + alertas |
| Backup cifrado | No | Recomendado | Si | Si (separado) |
| Retencion | Sin limite | 90d-12m | 30d configurable | Minima |
| Borrado verificado | No | Si | Si (criptografico) | Si (criptografico) |
| Redaccion logs | No | No | Si | Si + ofuscacion |
| Rate limiting | Publico | Interno | Por tenant | Por servicio |

## 4. Clasificacion de componentes

| Componente | Clase de datos manejados | Justificacion |
|---|---|---|
| BookPI Ledger | CONFIDENTIAL | Contiene evidencia de claims y provenance |
| Trust roots | RESTRICTED | Compromiso = compromiso del sistema |
| Memory store | CONFIDENTIAL | Contiene conversaciones y contexto de usuario |
| Audit log | CONFIDENTIAL/INTERNAL | Detalles son CONFIDENTIAL, agregados son INTERNAL |
| JWT verification | RESTRICTED | Maneja tokens y secretos de firma |
| Rate limiter | INTERNAL | Contadores anonimos |
| Event bus | INTERNAL/CONFIDENTIAL | Eventos agregados son INTERNAL, detallados son CONFIDENTIAL |
| Telemetry | INTERNAL | Metricas anonimizadas |
| Prompt templates | PUBLIC/INTERNAL | Publicos si son difundibles, INTERNAL si contienen strategia |
| Model config | INTERNAL | No contiene secretos, pero revela estrategia |
| Kill-switch state | INTERNAL | Estado operativo del sistema |

## 5. Flujo de clasificacion

```
Dato nuevo
  |
  v
+------------------+
| Clasificacion    | --> BUSINESS OWNER clasifica
| inicial          |
+--------+---------+
         |
         v
+------------------+
| Validacion de    | --> Verificar controles minimos
| controles        |
+--------+---------+
         |
    OK?  |
  SI  NO |
   |   | |
   |   | +--> RECHAZAR hasta implementar controles
   |   |
   v   v
+------------------+
| Persistir con    | --> Tag de clasificacion en metadata
| metadata         |
+--------+---------+
         |
         v
+------------------+
| Monitoreo        | --> Verificar controles durante vida del dato
| continuo         |
+------------------+
```

## 6. Reglas de descenso de clasificacion

| De | A | Condicion |
|---|---|---|
| RESTRICTED | CONFIDENTIAL | Solo si dato no es secret/credential, con aprobacion |
| CONFIDENTIAL | INTERNAL | Solo si dato anonimizado, sin PII, con aprobacion |
| INTERNAL | PUBLIC | Solo si dato no contiene info interna, con aprobacion |
| Cualquier | Eliminado | Con verificacion de borrado |

**NUNCA** ascender de PUBLIC a CONFIDENTIAL sin crear una nueva entrada.

## 7. Incumplimiento de clasificacion

| Nivel | Ejemplo | Consecuencia |
|---|---|---|
| Leve | INTERNAL en log sin timestamp | Corregir en siguiente release |
| Moderado | CONFIDENTIAL sin cifrado en reposo | Corregir inmediatemento, post-mortem |
| Grave | CONFIDENTIAL accesible por otro tenant | Aislamiento, rotacion, notificacion |
| Critico | RESTRICTED en repositorio publico | Kill-switch, revocacion, notificacion legal |

## 8. Notas de implementacion actual

| Clase | Estado actual | Gap |
|---|---|---|
| PUBLIC | Manejado correctamente | Ninguno |
| INTERNAL | Parcialmente clasificado | Falta tagging formal |
| CONFIDENTIAL | Sin cifrado en reposo (SQLite sin encriptar) | **Critico** |
| RESTRICTED | JWT_SECRET en .env | Sin envelope encryption, sin rotation |

**Acciones prioritarias:**
1. Cifrar SQLite (o migrar a Postgres con TDE) para CONFIDENTIAL.
2. Implementar envelope encryption para RESTRICTED.
3. Agregar metadata de clasificacion a todos los schemas de datos.
4. Implementar redaccion automatica en logs.
