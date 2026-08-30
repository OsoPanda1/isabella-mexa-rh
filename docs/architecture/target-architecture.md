# TARGET_ARCHITECTURE.md — Arquitectura Objetivo

**Estado:** diseño para migración desde monolito Express.
**Fecha:** 20 agosto 2026.

## 1. Visión general

El sistema actual es un monolito backend (~1700 líneas en `server.ts`) con Express como
runtime HTTP y un Vercel adapter que delega a Express. La arquitectura objetivo separa
responsabilidades en un monorepo con **4 apps** y **10 packages**, donde el dominio core
no tiene dependencias de infraestructura.

## 2. Estructura del monorepo

```
isabella-mexa/
├── apps/
│   ├── web/                  # React 19 SPA (Vite) — cliente
│   ├── api-express/          # Express 4 local server (dev + Docker)
│   ├── api-vercel/           # Vercel serverless adapter
│   └── worker/               # Background jobs (scheduler, recovery, telemetry)
│
├── packages/
│   ├── contracts/            # Contratos Zod, schemas de eventos, DTOs
│   ├── domain/               # Core domain: claim-radar, epistemic, kill-switch, memory, trust
│   ├── application/          # Use cases: processPerception, orchestration, moderation
│   ├── authz/                # JWT verification, RBAC, scope enforcement
│   ├── evidence/             # MCP hub, provenance ledger, BookPI chain
│   ├── memory/               # Memory store interfaces + adapters
│   ├── agent-runtime/        # Cognitive pipeline, tool catalog, policy gate
│   ├── integrations/         # Gemini, quantum providers, PennyLane, OPA
│   ├── observability/        # Telemetry, audit tracer, event bus
│   └── config/               # Environment contract, feature flags
```

## 3. Capas y dependencias

```
+-----------------------------------------------------------+
|  apps/ (web, api-express, api-vercel, worker)              |
|  Capa de presentacion y adaptacion HTTP/CLI                |
+-------------------------------+---------------------------+
                                | importa solo:
                                |   @isabella/config
                                |   @isabella/authz
                                |   @isabella/application
                                |   @isabella/observability
+-------------------------------v---------------------------+
|  packages/application   Use cases y orquestacion          |
|  packages/authz         Verificacion JWT, RBAC, scopes   |
|  packages/observability Telemetry, audit, event bus       |
+-------------------------------+---------------------------+
|  packages/domain          Core puro (zero-imports)        |
|  packages/contracts       Schemas Zod, tipos              |
|  packages/evidence        Ledger, MCP, provenance         |
|  packages/memory          Store interfaces + adapters     |
|  packages/agent-runtime   Pipeline, tools, policy gate    |
+-------------------------------+---------------------------+
|  packages/integrations    Adapters a proveedores externos |
|  packages/config          Env contract, feature flags     |
+-----------------------------------------------------------+
```

### Regla de flechas de dependencia

- `apps/` -> `packages/application`, `packages/authz`, `packages/config`, `packages/observability`
- `packages/application` -> `packages/domain`, `packages/contracts`, `packages/evidence`, `packages/memory`, `packages/agent-runtime`
- `packages/domain` -> `packages/contracts` **UNICO**
- **NUNCA** `packages/domain` -> Express, Vercel, LLM SDKs, Redis, Quantum SDKs

## 4. Tabla de prohibiciones en packages/core

| Package | PROHIBIDO importar |
|---|---|
| `packages/domain` | Express, Vercel, `@google/generative-ai`, `ioredis`, `@qiskit/*`, `@pennylane/*`, `node:child_process` |
| `packages/contracts` | Todo lo anterior + `packages/domain` (dependencia circular) |
| `packages/evidence` | Express, Vercel (puede importar `packages/domain`) |
| `packages/memory` | Express, Vercel, LLM SDKs |

El paquete `packages/integrations` es el **unico** que contacta servicios externos.
`packages/domain` define **ports** (interfaces) que `packages/integrations` implementa.

## 5. Patron de adaptadores (Port/Adapter)

```typescript
// packages/domain/ports/memory-store.ts
export interface MemoryStore {
  recall(query: string, limit: number): Promise<MemoryEntry[]>;
  persist(entry: MemoryEntry): Promise<void>;
}

// packages/integrations/memory/sqlite-adapter.ts
import type { MemoryStore } from '@isabella/domain/ports/memory-store';
export class SqliteMemoryAdapter implements MemoryStore {
  async recall(query: string, limit: number) { /* SQLite impl */ }
  async persist(entry: MemoryEntry) { /* SQLite impl */ }
}

// packages/integrations/memory/redis-adapter.ts (futuro)
export class RedisMemoryAdapter implements MemoryStore {
  async recall(query: string, limit: number) { /* Redis impl */ }
  async persist(entry: MemoryEntry) { /* Redis impl */ }
}
```

### Puertos definidos

| Port | Ubicacion | Implementaciones actuales | Futuras |
|---|---|---|---|
| `MemoryStore` | `domain/ports/memory-store.ts` | SqliteAdapter | RedisAdapter |
| `LedgerStore` | `domain/ports/ledger-store.ts` | InMemoryAdapter | PostgresAdapter |
| `EventPublisher` | `domain/ports/event-publisher.ts` | InMemoryBus | RedisStreamsAdapter |
| `EvidenceProvider` | `domain/ports/evidence-provider.ts` | ZenodoMCPAdapter, LITLEAdapter | CrossRefAdapter |
| `PolicyEngine` | `domain/ports/policy-engine.ts` | OPAAdapter | RegoNativeAdapter |
| `CryptoSigner` | `domain/ports/crypto-signer.ts` | HSMSimulatorAdapter | HSMRealAdapter |
| `ModelProvider` | `domain/ports/model-provider.ts` | GeminiAdapter | OpenAIAdapter |
| `PersistenceAdapter` | `domain/ports/persistence.ts` | SqliteAdapter | PostgresAdapter |

## 6. Diagrama de dependencias completo

```
                   +----------+
                   |   web    | (React 19 SPA)
                   +----+-----+
                        | HTTP fetch
                        v
         +---------------------------+
         |     api-vercel            | Vercel Serverless
         |  (delegates -> Express)   |
         +------------+--------------+
                      |
    +-----------------v------------------+
    |       api-express                  | Express 4 local
    |   middleware -> authz -> routes    |
    +-----------------+------------------+
                      |
    +-----------------v------------------+
    |     application layer              |
    |  processPerception, moderate,      |
    |  orchestrate, recommend            |
    +--+-------+--------+-------+-------+
       |       |        |       |
  +----+--+ +--+----+ +-+----+ ++----------+
  |domain | |eviden | |memory| |agent-runtim|
  |(core) | |ce     | |      | |e           |
  +---+---+ +--+----+ +--+---+ ++-----+-----+
      |       |        |       |
  +---v-------v--------v-------v----------+
  |         integrations (adapters)       |
  |  SQLite | Gemini | Quantum | OPA      |
  +---------------------------------------+
```

## 7. Ruta de migracion actual -> objetivo

### Fase 1: Extraccion de contratos (semanas 1-2)

| Accion | Archivos afectados | Riesgo |
|---|---|---|
| Extraer schemas Zod a `packages/contracts` | `src/contracts/*.ts`, `claim-radar/contracts.ts` | Bajo - refactor puro |
| Definir ports en `packages/domain` | Nuevo `packages/domain/ports/` | Bajo - interfaces |
| Migrar tipos compartidos | `src/types.ts` | Bajo |

### Fase 2: Desacoplamiento del dominio (semanas 3-5)

| Accion | Archivos afectados | Riesgo |
|---|---|---|
| Mover claim-radar, epistemic, kill-switch a `packages/domain` | `src/lib/claim-radar/`, `epistemic/`, `kill-switch/` | Medio - imports |
| Mover memory-store, audit-tracer a `packages/evidence` | `src/domains/ai/infrastructure/` | Medio |
| Mover processPerception a `packages/application` | `src/domains/ai/application/` | Medio |
| Verificar zero-import de infraestructura | `packages/domain` | Critico |

### Fase 3: Adapters y observabilidad (semanas 6-8)

| Accion | Archivos afectados | Riesgo |
|---|---|---|
| Crear `packages/integrations` con adapters SQLite, Gemini | `src/lib/persistence/`, `gemini-validator.ts` | Medio |
| Crear `packages/authz` desde `auth.server.ts` | `src/lib/auth.server.ts` | Medio |
| Crear `packages/observability` desde telemetry, audit | `src/lib/quantum/telemetry.ts`, `auditLog.ts` | Bajo |
| Crear `packages/config` con env contract | Nuevo | Bajo |

### Fase 4: Apps y eliminacion de monolito (semanas 9-12)

| Accion | Archivos afectados | Riesgo |
|---|---|---|
| Migrar `server.ts` -> `apps/api-express` | `server.ts` (~1700 lineas) | Alto |
| Migrar `api/[...path].ts` -> `apps/api-vercel` | `api/[...path].ts` | Alto |
| Migrar `src/` -> `apps/web` | SPA completa | Medio |
| Crear `apps/worker` para scheduler, recovery | `quantum/scheduler.ts`, `recovery.ts` | Medio |
| Eliminar `server.ts` monolitico | `server.ts` | Critico |

### Fase 5: Validacion y corte (semanas 13-16)

| Accion | Archivos afectados | Riesgo |
|---|---|---|
| Tests de contrato en ambos adapters | `tests/` | Critico |
| Verificar parity Express vs Vercel | Parity tests | Critico |
| Auditoria de imports prohibidos | CI gate | Critico |
| Rollback plan documentado | Docs | Medio |

## 8. Estimaciones de timeline

| Fase | Duracion | Dependencias | Equipo minimo |
|---|---|---|---|
| Fase 1: Contratos | 2 semanas | Ninguna | 1 dev |
| Fase 2: Dominio | 3 semanas | Fase 1 | 1-2 devs |
| Fase 3: Adapters | 3 semanas | Fase 2 | 1-2 devs |
| Fase 4: Apps | 4 semanas | Fase 3 | 2 devs |
| Fase 5: Validacion | 4 semanas | Fase 4 | 2 devs + QA |
| **Total** | **~16 semanas** | | |

### Hitos

| Semana | Hito | Criterio de aceptacion |
|---|---|---|
| 2 | Contratos extraidos | `packages/contracts` compila sin errores, 0 imports de infra |
| 5 | Dominio desacoplado | `packages/domain` compila, zero-imports audit pasa |
| 8 | Adapters funcionales | SQLite + Gemini adapter pasan tests de contrato |
| 12 | Apps separadas | Express y Vercel sirven desde packages, sin monolito |
| 16 | Corte validado | Parity tests pasan, CI gate de imports activo |

## 9. Criterios de salida de cada fase

1. **Fase 1:** `tsc --noEmit` pasa en `packages/contracts` y `packages/domain`.
2. **Fase 2:** Todos los tests existentes pasan re-mapeados a packages.
3. **Fase 3:** Al menos 1 adapter por port tiene implementacion funcional.
4. **Fase 4:** `npm run build` produce artefactos para las 4 apps.
5. **Fase 5:** CI bloquea merges si detecta imports prohibidos en packages/core.

## 10. Nota sobre rollback

Cada fase es reversible. Si la Fase N falla, se revierte el merge de esa fase sin
afectar las fases anteriores. El monolito `server.ts` se mantiene como fallback
hasta que la Fase 5 validacion completa permita el corte.
