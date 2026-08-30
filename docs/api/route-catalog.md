# Catálogo de Rutas API — Isabella Villaseñor AI v5.0.0

> Generado automáticamente desde `server.ts` (2026-08-23). Complementa `docs/api/openapi.yaml` (OpenAPI 3.1, parcial).

## Salud y diagnóstico

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | — | Estado general del servidor |
| GET | `/api/health/idlen` | — | Estado del módulo Idlen |
| GET | `/api/voice/health` | — | Estado del motor TTS soberano |
| GET | `/api/v1/auth/native/health` | — | Estado del auth nativo |
| GET | `/api/v1/mcp/health` | — | Estado de adaptadores MCP |

## Autenticación y claves

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/v1/auth/session` | — | Crear sesión JWT |
| POST | `/api/v1/auth/native/bootstrap` | — | Bootstrap de identidad nativa |
| GET | `/api/v1/apikeys` | ✓ | Listar API keys del principal |
| POST | `/api/v1/apikeys` | ✓ | Crear API key |
| POST | `/api/v1/apikeys/:keyId/revoke` | ✓ | Revocar API key |
| POST | `/api/v1/apikeys/:keyId/rotate` | ✓ | Rotar API key |
| DELETE | `/api/v1/apikeys/:keyId` | ✓ | Eliminar API key |

## Isabella — núcleo cognitivo

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/isabella` | ✓ | Estado del núcleo |
| POST | `/api/v1/isabella` | ✓ | Interacción principal (chat) |
| GET | `/api/v1/isabella/blueprint` | ✓ | Blueprint del sistema |
| GET | `/api/v1/isabella/memory` | ✓ | Consultar memoria (scope: immediate/session/project/territorial/historical) |
| POST | `/api/v1/isabella/memory` | ✓ | Escribir en memoria |
| GET | `/api/v1/isabella/policies` | ✓ | Políticas activas |
| GET | `/api/v1/isabella/tools` | ✓ | Herramientas disponibles |
| POST | `/api/v1/isabella/tools/execute` | ✓ | Ejecutar herramienta |
| GET | `/api/v1/isabella/audit` | ✓ | Registro de auditoría |
| GET | `/api/v1/isabella/migrations` | ✓ | Migraciones aplicadas |
| GET | `/api/v1/isabella/v5/fusion` | ✓ | Estado de fusión v5 |
| POST | `/api/v1/isabella/agent/chat` | ✓ | Chat con agente |
| POST | `/api/v1/isabella/agent/lease` | ✓ | Arrendar sesión de agente |
| POST | `/api/v1/isabella/agent/stream` | ✓ | Stream de agente (SSE) |

## Voz

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/voice/synthesize` | — | Síntesis de voz soberana |
| POST | `/api/isabella/tts` | — | TTS legacy |
| POST | `/api/isabella/process` | — | Procesamiento de texto |
| POST | `/api/isabella/generate-image` | — | Generación de imagen |

## Quantum bridge

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/quantum/blueprint` | ✓ | Blueprint cuántico |
| GET | `/api/v1/quantum/bookpi` | ✓ | Estado BookPi |
| GET | `/api/v1/quantum/circuit-breaker` | ✓ | Estado circuit breaker |
| POST | `/api/v1/quantum/circuit-breaker/reset` | ✓ | Reset circuit breaker |
| GET | `/api/v1/quantum/cores` | ✓ | Núcleos disponibles |
| GET | `/api/v1/quantum/devices` | ✓ | Dispositivos registrados |
| GET | `/api/v1/quantum/devices/enabled` | ✓ | Dispositivos habilitados |
| POST | `/api/v1/quantum/devices/full-diagnostics` | ✓ | Diagnóstico completo |
| POST | `/api/v1/quantum/devices/smoke-test` | ✓ | Smoke test |
| GET | `/api/v1/quantum/events` | ✓ | Eventos cuánticos |
| POST | `/api/v1/quantum/execute` | ✓ | Ejecutar circuito |
| GET | `/api/v1/quantum/hsm` | ✓ | Estado HSM |
| POST | `/api/v1/quantum/hsm/reset` | ✓ | Reset HSM |
| GET | `/api/v1/quantum/mesh/status` | ✓ | Estado de malla |
| GET | `/api/v1/quantum/migrations` | ✓ | Migraciones cuánticas |
| GET | `/api/v1/quantum/pennylane/status` | ✓ | Estado PennyLane |
| POST | `/api/v1/quantum/pennylane/execute` | ✓ | Ejecutar PennyLane |
| GET | `/api/v1/quantum/policy` | ✓ | Política cuántica |
| GET | `/api/v1/quantum/recovery` | ✓ | Estado de recuperación |
| POST | `/api/v1/quantum/recovery/resolve` | ✓ | Resolver recuperación |
| GET | `/api/v1/quantum/scheduler` | ✓ | Estado del scheduler |
| GET | `/api/v1/quantum/tee` | ✓ | Estado TEE |
| GET | `/api/v1/quantum/telemetry` | ✓ | Telemetría cuántica |
| GET | `/api/v1/quantum/workers` | ✓ | Workers activos |
| POST | `/api/v1/quantum/workers/heartbeat-check` | ✓ | Heartbeat de workers |

## Ingress — distribución de tráfico

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/ingress/alerts` | ✓ | Alertas activas |
| GET | `/api/v1/ingress/circuit-breakers` | ✓ | Circuit breakers |
| GET | `/api/v1/ingress/degradation` | ✓ | Estado de degradación |
| GET | `/api/v1/ingress/health` | ✓ | Salud global |
| GET | `/api/v1/ingress/health/:moduleId` | ✓ | Salud por módulo |
| GET | `/api/v1/ingress/load` | ✓ | Carga actual |
| GET | `/api/v1/ingress/metrics` | ✓ | Métricas |
| GET | `/api/v1/ingress/routing-table` | ✓ | Tabla de enrutamiento |
| POST | `/api/v1/ingress/deliver` | ✓ | Entregar mensaje |
| POST | `/api/v1/ingress/heartbeat/:moduleId` | ✓ (system) | Heartbeat de módulo |
| POST | `/api/v1/ingress/partition` | ✓ | Particionar datos |

## Core — gateway, planes, skills, consentimiento

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/core/audit` | ✓ | Auditoría core |
| GET | `/api/v1/core/audit/stats` | ✓ | Estadísticas de auditoría |
| GET | `/api/v1/core/consent` | ✓ | Consentimientos activos |
| POST | `/api/v1/core/consent/grant` | ✓ | Otorgar consentimiento |
| POST | `/api/v1/core/consent/revoke` | ✓ | Revocar consentimiento |
| GET | `/api/v1/core/data/export` | ✓ | Exportar datos |
| POST | `/api/v1/core/data/delete` | ✓ | Eliminar datos |
| POST | `/api/v1/core/gateway/message` | ✓ | Mensaje al gateway |
| GET | `/api/v1/core/plans` | ✓ | Planes disponibles |
| POST | `/api/v1/core/plans` | ✓ | Crear plan |
| POST | `/api/v1/core/plans/:planId/activate` | ✓ | Activar plan |
| GET | `/api/v1/core/providers` | ✓ | Proveedores registrados |
| GET | `/api/v1/core/sessions` | ✓ | Sesiones activas |
| GET | `/api/v1/core/sessions/:sessionId/messages` | ✓ | Mensajes de sesión |
| GET | `/api/v1/core/skills` | ✓ | Skills disponibles |
| POST | `/api/v1/core/skills` | ✓ | Registrar skill |
| POST | `/api/v1/core/skills/:skillId/enable` | ✓ | Habilitar skill |
| POST | `/api/v1/core/agent/run` | ✓ | Ejecutar agente |
| POST | `/api/v1/core/classify-risk` | ✓ | Clasificar riesgo |

## Economía — marketplace, wallet, creadores, gobernanza

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/economy/creators` | ✓ | Listar creadores |
| GET | `/api/v1/economy/creators/profile` | ✓ | Perfil de creador |
| POST | `/api/v1/economy/creators/profile` | ✓ | Crear/actualizar perfil |
| GET | `/api/v1/economy/governance/disputes` | ✓ | Disputas abiertas |
| POST | `/api/v1/economy/governance/disputes` | ✓ | Crear disputa |
| GET | `/api/v1/economy/governance/rules` | ✓ | Reglas de gobernanza |
| GET | `/api/v1/economy/marketplace/my` | ✓ | Mis listados |
| GET | `/api/v1/economy/marketplace/search` | ✓ | Buscar listados |
| POST | `/api/v1/economy/marketplace/listings` | ✓ | Crear listado |
| GET | `/api/v1/economy/revenue/events` | ✓ | Eventos de ingresos |
| GET | `/api/v1/economy/revenue/summary` | ✓ | Resumen de ingresos |
| GET | `/api/v1/economy/wallet/balance` | ✓ | Balance de wallet |
| GET | `/api/v1/economy/wallet/ledger` | ✓ | Ledger de wallet |
| POST | `/api/v1/economy/wallet/payout` | ✓ | Solicitar payout |
| POST | `/api/v1/economy/opportunities/scan` | ✓ | Escanear oportunidades |

## Billing

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/billing/plans` | — | Planes de suscripción |
| GET | `/api/v1/billing/usage` | ✓ | Uso actual |
| POST | `/api/v1/billing/checkout` | ✓ | Crear checkout |
| GET | `/api/v1/billing/checkout/mock` | — | Checkout mock (dev) |

## Epistemic — clasificación y reglas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/epistemic/rules` | ✓ | Reglas epistémicas |
| POST | `/api/v1/epistemic/classify` | ✓ | Clasificar contenido |

## Claim radar

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/claim-radar/metrics` | ✓ | Métricas de radar |
| POST | `/api/v1/claim-radar/evaluate` | ✓ | Evaluar claim |

## Kill switch

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/kill-switch/events` | ✓ | Eventos de kill switch |
| GET | `/api/v1/kill-switch/status` | ✓ | Estado actual |
| POST | `/api/v1/kill-switch/activate` | ✓ | Activar kill switch |
| POST | `/api/v1/kill-switch/:eventId/resolve` | ✓ | Resolver evento |
| POST | `/api/v1/kill-switch/:eventId/step` | ✓ | Paso de resolución |

## Automatización

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/v1/automation/status` | ✓ | Estado de automatización |
| GET | `/api/v1/automation/health` | ✓ | Salud de automatización |
| GET | `/api/v1/automation/failures` | ✓ | Fallos registrados |
| GET | `/api/v1/automation/repair-chains` | ✓ | Cadenas de reparación |
| GET | `/api/v1/automation/developer-guide/:nodeId` | ✓ | Guía de desarrollador |
| POST | `/api/v1/automation/describe` | ✓ | Describir nodo |
| POST | `/api/v1/automation/repair/:chainId/next` | ✓ | Siguiente paso de reparación |
| POST | `/api/v1/automation/resolve/:nodeId` | ✓ | Resolver nodo |

## Idlen — publicidad contextual

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/v1/idlen/click` | ✓ | Registrar click de anuncio |

## Fallback

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `*` | — | Servir SPA (Vite build) |
| POST | `*` | — | 404 JSON para rutas no definidas |
