# Modelo de Errores — API Isabella Villaseñor AI

> Versión: 1.0.0 · Última actualización: 2026-08-20
> Fuente de verdad: `src/lib/api-contracts.ts`, `src/lib/auth.server.ts`, `src/lib/opa.server.ts`

---

## 1. Error Envelope

Todas las respuestas exitosas y fallidas de la API siguen un envelope unificado:

```json
{
  "ok": true,
  "data": { "..." }
}
```

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción legible para humanos",
    "trace_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-08-20T14:30:00.000Z",
    "details": {}
  }
}
```

### Campos del error

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ok` | `boolean` | Siempre | `false` en respuestas de error |
| `error.code` | `string` | Siempre | Código de error en UPPER_SNAKE_CASE |
| `error.message` | `string` | Siempre | Descripción legible, sin sensibilidad operativa |
| `error.trace_id` | `string (uuid)` | Siempre | Identificador de trazabilidad para correlación con logs y auditoría |
| `error.timestamp` | `string (ISO 8601)` | Siempre | Timestamp del momento en que se generó el error |
| `error.details` | `object` | Opcional | Información adicional específica del error (validación, límites, etc.) |

### Helper de código

```typescript
// src/lib/api-contracts.ts
export function apiError(code: string, message: string, traceId?: string): ApiError {
  return { ok: false, error: { code, message, ...(traceId ? { traceId } : {}) } };
}
```

### Interfaces

```typescript
export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    traceId?: string;
  };
}

export type ApiResponse<T = unknown> = ApiOk<T> | ApiError;
```

---

## 2. Catálogo de Códigos de Error

### AUTHENTICATION_REQUIRED

| Campo | Valor |
|---|---|
| **HTTP Status** | `401 Unauthorized` |
| **Código** | `AUTHENTICATION_REQUIRED` |
| **Descripción** | La petición carece de un token de autenticación válido o el token proporcionado es inválido/expirado. |
| **Cuándo ocurre** | Header `Authorization` ausente, token malformado, firma HMAC inválida, o token expirado (`exp` < ahora). Verificado en `src/lib/auth.server.ts:66-67`. |
| **Resolución** | Emitir un nuevo token JWT HS256 a través del endpoint de autenticación. Verificar que `ISABELLA_AUTH_SECRET` esté configurado. En desarrollo, habilitar `ALLOW_DEV_AUTH_FALLBACK=true`. |

---

### AUTHORIZATION_DENIED

| Campo | Valor |
|---|---|
| **HTTP Status** | `403 Forbidden` |
| **Código** | `AUTHORIZATION_DENIED` |
| **Descripción** | El principal autenticado no posee el rol o scope requerido para la acción solicitada. |
| **Cuándo ocurre** | `requireRole()` (`auth.server.ts:82`) o `requireScope()` (`auth.server.ts:91`) evalúan que el principal no cumple el mínimo requerido. |
| **Resolución** | Verificar que el JWT contenga los scopes y roles necesarios. Si se requiere un scope adicional, solicitar re-emisión del token con la autorización adecuada. No confundir con `TENANT_MISMATCH`. |

---

### VALIDATION_ERROR

| Campo | Valor |
|---|---|
| **HTTP Status** | `400 Bad Request` |
| **Código** | `VALIDATION_ERROR` |
| **Descripción** | El cuerpo de la petición no pasa la validación del esquema Zod correspondiente. |
| **Cuándo ocurre** | `validateBody()` (`api-contracts.ts:106-113`) detecta que el body no cumple el contrato Zod. El mensaje incluye los paths y mensajes de error específicos. |
| **Resolución** | Revisar el esquema de contrato para el endpoint (ver `src/lib/api-contracts.ts`). Corregir los campos indicados en el mensaje de error. Ejemplo: `"text: Required; sessionId: Too small"` indica que falta `text` y `sessionId` es menor al mínimo. |

**Ejemplo de respuesta:**
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body: prompt: Required; sessionId: Too small: expected string with length >= 1"
  }
}
```

---

### TENANT_MISMATCH

| Campo | Valor |
|---|---|
| **HTTP Status** | `403 Forbidden` |
| **Código** | `TENANT_MISMATCH` |
| **Descripción** | El `tenantId` del principal no coincide con el `tenantId` del recurso o request. Aislamiento de tenants violado. |
| **Cuándo ocurre** | Evaluado en `policy-engine.ts:77-78` y en OPA para recursos con `federation_id`. Intento de acceder a memoria, documentos o trabajos de otro tenant. |
| **Resolución** | Verificar que el token JWT contenga el `tenantId` correcto para el recurso solicitado. Los tenants son estrictamente aislados — no existe bypass para esta regla. |

---

### RATE_LIMITED

| Campo | Valor |
|---|---|
| **HTTP Status** | `429 Too Many Requests` |
| **Código** | `RATE_LIMITED` |
| **Descripción** | El principal ha excedido la tasa de peticiones permitida para su plan o rol. |
| **Cuándo ocurre** | El rate limiter global detecta exceso de peticiones. Aplica por tenant y/o por principal. |
| **Resolución** | Esperar el tiempo indicado en el header `Retry-After` antes de reintentar. Considerar upgrade de plan si es necesario. No hay bypass para rate limiting. |

---

### TIMEOUT

| Campo | Valor |
|---|---|
| **HTTP Status** | `504 Gateway Timeout` |
| **Código** | `TIMEOUT` |
| **Descripción** | La operación excedió el tiempo máximo de ejecución permitido. |
| **Cuándo ocurre** | Inferencia, ejecución cuántica o llamada a provider remoto exceden el `deadlineMs` o `maxTimeoutMs` configurado. Los límites varían por rol (user: 15s, agent: 30s, operator: 60s). |
| **Resolución** | Revisar los parámetros de la operación (complejidad del circuito, tamaño del input). Reintentar con parámetros más conservadores. Si es persistente, verificar la disponibilidad del provider subyacente. |

---

### PROVIDER_UNAVAILABLE

| Campo | Valor |
|---|---|
| **HTTP Status** | `503 Service Unavailable` |
| **Código** | `PROVIDER_UNAVAILABLE` |
| **Descripción** | Un provider externo necesario para la operación no está disponible o sus credenciales son inválidas. |
| **Cuándo ocurre** | Provider remoto (Qiskit, Braket, Rigetti, Zenodo, OSF) no responde o falta un secreto configurado (`REMOTE_SECRET_MISSING`). Verificado en `policy-engine.ts:130-136`. |
| **Resolución** | Verificar la conectividad con el provider. Confirmar que los secretos de conexión están configurados en variables de entorno. Si el provider es un simulador local, verificar que el worker está activo. |

---

### INTERNAL_ERROR

| Campo | Valor |
|---|---|
| **HTTP Status** | `500 Internal Server Error` |
| **Código** | `INTERNAL_ERROR` |
| **Descripción** | Error interno no clasificado del servidor. No expone detalles de implementación. |
| **Cuándo ocurre** | Excepciones no capturadas, fallos de infraestructura (SQLite, EventBus, HSM), o condiciones inesperadas. |
| **Resolución** | Consultar logs del sistema usando el `trace_id` proporcionado. Si persiste, escalar al equipo de operaciones. No reintentar automáticamente — verificar estado del sistema primero. |

---

### KILL_SWITCH_ACTIVE

| Campo | Valor |
|---|---|
| **HTTP Status** | `503 Service Unavailable` |
| **Código** | `KILL_SWITCH_ACTIVE` |
| **Descripción** | El kill switch del sistema está activo. Todas las operaciones no esenciales están suspendidas. |
| **Cuándo ocurre** | El estado del kill switch (`src/lib/kill-switch/kill-switch.ts`) no es `normal`. El sistema está en cadena de contención: egress-frozen → quiesced → isolated → restoring → requires-approval. |
| **Resolución** | Solo un administrador con scope `kill-switch:resolve` puede reanudar el sistema después de completar los pasos de recuperación y aprobación humana. Verificar el estado con `getKillSwitchStatus()`. |

---

### EVIDENCE_INTEGRITY_VIOLATION

| Campo | Valor |
|---|---|
| **HTTP Status** | `500 Internal Server Error` |
| **Código** | `EVIDENCE_INTEGRITY_VIOLATION` |
| **Descripción** | La integridad criptográfica de una evidencia, evento de auditoría o bloque BookPI no puede verificarse. |
| **Cuándo ocurre** | Verificación de `eventDigest`, `responseDigest`, `previousEventDigest` o `circuitHash` falla. Detecta posible manipulación o corrupción de datos. Verificado en epistemic governance y claim radar (`epistemic-governance.ts:174`, `claim-radar.ts:213`). |
| **Resolución** | No reintentar la operación. Verificar integridad del almacenamiento subyacente. Revisar cadena de audit events para identificar dónde se rompió el encadenamiento. Escalar como incidente de seguridad. |

---

### TOOL_ESCALATION_BLOCKED

| Campo | Valor |
|---|---|
| **HTTP Status** | `403 Forbidden` |
| **Código** | `TOOL_ESCALATION_BLOCKED` |
| **Descripción** | Un agente intentó ejecutar una herramienta cuyo nivel de riesgo excede su autorización, o intentó auto-aprobar una herramienta que requiere aprobación humana. |
| **Cuándo ocurre** | El policy engine detecta que `requiresApproval: true` pero no hay `approvedBy` válido, o el `riskLevel` de la herramienta supera el umbral `maxRiskAllowedWithoutApproval` de la política activa. Verificado en claim-radar tool calls (`src/lib/claim-radar/contracts.ts:221-232`). |
| **Resolución** | Solicitar aprobación humana explícita para herramientas de alto riesgo. Un usuario con rol `operator` o superior debe aprobar vía el endpoint de aprobaciones. Nunca intentar escalar scopes de herramientas. |

---

## 3. Headers de respuesta

| Header | Cuándo | Descripción |
|---|---|---|
| `Retry-After` | `429` | Segundos a esperar antes de reintentar |
| `X-Trace-Id` | Todos los errores | UUID de trazabilidad (mismo que `error.trace_id`) |
| `X-Policy-Id` | Denegaciones OPA | Identificador de la política que denegó |

---

## 4. Ejemplo completo de flujo de error

**Petición fallida:**
```
POST /api/quantum/execute
Authorization: Bearer eyJhbG...
Content-Type: application/json

{ "provider": "qiskit.aer", "wires": 30 }
```

**Respuesta:**
```json
{
  "ok": false,
  "error": {
    "code": "AUTHORIZATION_DENIED",
    "message": "Missing required scope: quantum:qiskit",
    "trace_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "timestamp": "2026-08-20T14:32:15.000Z"
  }
}
```

**Pasos de resolución:**
1. Verificar el `trace_id` en los logs del sistema.
2. Identificar que el JWT no contiene `quantum:qiskit` en `scopes`.
3. Solicitar token actualizado con el scope requerido.
4. Reintentar con el token actualizado.

---

## 5. Notas de implementación

- **Trace ID**: Cada request genera un `trace_id` (UUID v4) que persiste durante toda la vida útil de la request a través de todos los módulos.
- **Mensajes**: Los mensajes de error son legibles pero no exponen detalles internos (stack traces, rutas de archivos, IPs).
- **Cadena de auditoría**: Las denegaciones de política publican `security.policy_violated` al EventBus con el `policy_id` específico.
- **Rate limiting**: Se aplica por tenant y por endpoint. Los headers `X-RateLimit-*` indican los límites en respuestas exitosas.
- **Desarrollo**: En modo dev (`ALLOW_DEV_AUTH_FALLBACK=true`), el principal tiene scopes `["*"]` y no se valida auth. Nunca usar en producción.
