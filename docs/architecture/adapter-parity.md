# ADAPTER_PARITY.md — Paridad de Adaptadores

**Estado:** diseno y estrategia de verificacion.
**Fecha:** 20 agosto 2026.

## 1. Objetivo

Verificar que `server.ts` (Express local) y `api/[...path].ts` (Vercel serverless)
producen **comportamiento identico** para las mismas entradas, bajo las mismas
condiciones de politica y configuracion.

## 2. Arquitectura actual

### Express local (`server.ts`)

- Runtime Node.js persistente en memoria.
- Instancia unica de Express con middleware chain completa.
- In-memory state: rate limiter, telemetry counters, audit log, memory store.
- Recurring tasks: scheduler, recovery, heartbeat del worker pool.

### Vercel serverless (`api/[...path].ts`)

- Runtime Edge/Node.js efimero (maxDuration: 30s).
- Delega al Express app via `vercel-node-server` o `@vercel/node`.
- Cada invocacion es cold start o warm start.
- Sin estado persistente entre invocaciones.

```
Request
  |
  v
api/[...path].ts (Vercel handler)
  |
  | adapta req/res
  v
Express app (mismo set de routes)
  |
  v
Response
```

## 3. Puntos de paridad verificada

| Area | Express | Vercel | Paridad |
|---|---|---|---|
| Rutas API | `atlasRouter` en `express-routes.ts` | Misma instancia Express | OK |
| Auth middleware | `authenticate`, `requireRole`, `requireScope` | Misma funcion via import | OK |
| CORS | `cors({ origin })` | Headers en `vercel.json` | **Divergente** |
| Rate limiting | In-memory sliding window | **No persistente** | **Divergente** |
| Body parsing | `express.json()` | Vercel auto-parses | OK |
| Response headers | Seteados en Express | `vercel.json` headers | Parcial |
| Error handling | try/catch + res.status() | Misma via Express | OK |

## 4. Puntos de divergencia conocidos

### 4.1 Streaming (CRITICO)

| Con | Impacto | Severidad |
|---|---|---|
| Gemini streaming responses | Express soporta `res.write()` continuo; Vercel tiene timeout de 30s | Alta |
| Image generation polling | Express puede mantener polling loop; Vercel no | Alta |

**Remediacion:** Implementar SSE adapter que funcione en ambos runtimes.
Usar `ReadableStream` nativo en vez de `res.write()` de Express.

### 4.2 Estado en memoria

| Con | Impacto | Severidad |
|---|---|---|
| Rate limiter counters | Resetean en cada cold start de Vercel | Media |
| Telemetry metrics | No acumulativas en serverless | Media |
| Memory store | Se pierde entre invocaciones | Alta |
| Audit log (in-memory) | Se fragmenta por instancia | Media |

**Remediacion:** Migrar rate limiter a Redis (produccion). Memory store a SQLite/Postgres.
Telemetry via servicio externo (OpenTelemetry exporter).

### 4.3 Tareas recurrentes (cron/scheduler)

| Con | Impacto | Severidad |
|---|---|---|
| `setInterval` scheduler | No funciona en Vercel serverless | Alta |
| Worker pool heartbeat | No persistente entre invocaciones | Alta |
| Recovery checks | No ejecutan automaticamente | Alta |

**Remediacion:** Migrar a `apps/worker` como proceso separado. En Vercel, usar
Vercel Cron Jobs o separar a servicio externo.

### 4.4 Conectividad de proveedores

| Con | Impacto | Severidad |
|---|---|---|
| Gemini API calls | Funcionan en ambos (latency variable) | Baja |
| Quantum providers | Funcionan en ambos (cold start penalty) | Media |
| OPA sidecar | Requiere red local; no disponible en Vercel | Alta |
| SQLite | Filesystem local; no persiste en Vercel | Critico |

**Remediacion:** SQLite -> Postgres para Vercel. OPA -> libreria OPA embedded.
Quantum providers -> considerar redeploy en Express para latencia.

## 5. Estrategia de testing de paridad

### 5.1 Contract tests compartidos

```typescript
// tests/adapter-parity.test.ts

describe('Paridad Express vs Vercel', () => {
  const expressClient = createExpressTestClient(expressApp);
  const vercelClient = createVercelTestClient(vercelHandler);

  const endpoints = [
    { method: 'GET', path: '/api/atlas/getCockpitSnapshot' },
    { method: 'POST', path: '/api/atlas/evalAnubisPolicy', body: {...} },
    { method: 'GET', path: '/api/atlas/getEconomySnapshot' },
    // ... todos los endpoints
  ];

  for (const ep of endpoints) {
    it(`${ep.method} ${ep.path} produce respuesta identica`, async () => {
      const expressRes = await expressClient.request(ep);
      const vercelRes = await vercelClient.request(ep);

      expect(vercelRes.status).toBe(expressRes.status);
      expect(vercelRes.body).toEqual(expressRes.body);
      // Headers ignorados: Date, X-Request-Id
    });
  }
});
```

### 5.2 Contract tests por dominio

| Dominio | Tests existentes | Paridad requerida |
|---|---|---|
| Auth | `tests/auth.test.ts` | Headers, status codes, payload |
| Kill-switch | `tests/kill-switch.test.ts` | Estado transiciones |
| MCP | `tests/mcp-adapters.test.ts` | Health checks, queries |
| Claim Radar | `tests/claim-radar.test.ts` | Evaluacion de claims |
| Epistemic | `tests/epistemic.test.ts` | Clasificacion y reglas |
| Automation | `tests/automation.test.ts` | Registry, mesh |

### 5.3 Ejecucion

```bash
# Run parity tests against Express
EXPRESS_PORT=4000 npm run test:parity:express

# Run same tests against Vercel handler
VERCEL_HANDLER=1 npm run test:parity:vercel

# CI: ambos en cadena
npm run test:parity
```

## 6. Criterios de paridad

1. **Status codes:** Identicos para la misma entrada.
2. **Response bodies:** JSON identico (ignorando campos temporales).
3. **Headers de seguridad:** Mismos headers de proteccion (CSP, X-Frame-Options).
4. **Error responses:** Mismo formato de error, mismo status code.
5. **Auth behavior:** Mismos rechazos, mismos scoping.

## 7. Criterios de divergencia aceptable

Algunas diferencias son inevitables y aceptables:

- **Timing:** Vercel cold start puede ser mas lento (aceptable si < 5s).
- **Rate limiting:** Se acepta reset en cold start mientras exista backend Redis.
- **Memory state:** Se acepta no-persistencia en Vercel si el dominio lo soporta.
- **Streaming:** Se acepta comportamiento diferente si el client handlea ambos.

## 8. Plan de remediacion por prioridad

| Prioridad | Divergencia | Remediacion | Timeline |
|---|---|---|---|
| P0 | SQLite en Vercel | Migrar a Postgres serverless | Fase 4 |
| P0 | Streaming responses | SSE adapter universal | Fase 4 |
| P1 | Rate limiter | Redis-backed rate limiter | Fase 3 |
| P1 | Scheduler/cron | Worker separado | Fase 4 |
| P2 | Telemetry | OpenTelemetry exporter | Fase 3 |
| P2 | OPA sidecar | Embedded OPA | Fase 3 |
| P3 | Cold start penalty | Keep-warm pings | Post-migracion |

## 9. Monitoreo continuo

Despues de la migracion, monitorear:

- **Error rate delta:** Express vs Vercel no debe diferir mas de 0.05%.
- **Latency delta:** P50 Vercel no debe exceder 2x P50 Express.
- **Feature coverage:** Cada endpoint nuevo debe tener parity test.
- **CI gate:** Merge bloqueado si parity test falla.

## 10. Escalamiento

Si la paridad no puede mantenerse (ej. dependencias de filesystem persistente),
la decision correcta es **asignar el dominio afectado a Express unicamente**
y documentar la restriccion, en vez de simular comportamiento incorrecto en Vercel.
