# ATLAS HARDENING — Plan por fases (W0–W12)

> Fuente de requisitos: `actualizacion.txt` (backlog maestro, secciones I–CC,
> prioridades P0–P4, fases W0–W12). Este documento convierte ese manual en un
> roadmap ejecutable **por secciones**, sin intentar las ~200 capacidades de golpe.

## Estado global

| Rango | Descripción | Estado |
| ----- | ----------- | ------ |
| **INTRO** | Intro cinematográfica evolucionada (ImmersiveScene) | Implementada, **pendiente verificación tsc/build** (entorno bloqueado) |
| W0 | Purga de estado + secretos + CI gate | Implementada en archivos; pendiente `git rm --cached` + push del CI |
| W1 | Identity + Tenant + authz cero confianza | Implementada (contextos transitivos + tests); pendiente verificación |
| W2+ | Resto de fases del manual (I–CC) | Pendiente |

## FASE INTRO — Intro cinematográfica evolucionada

Motor AAA `ImmersiveScene` orquestando (no implementando) SceneLifecycle,
RendererController, CameraController, ParallaxController, AudioController,
QualityController, VisibilityController, Starfield2D/3D y TransitionController.

Archivos creados:

- `src/immersive/ImmersiveScene.ts` — orquestador (WebGL 3D + audio posicional).
- `src/immersive/Starfield2D.ts` — capa 2D de fondo con twinkle.
- `src/immersive/quality.ts` — `detectQuality()` adaptativo (low/medium/high).
- `src/immersive/TransitionController.ts` — fundidos discretos de capas.
- `src/immersive/useImmersiveScene.ts` — hook que crea/destruye UNA instancia.
- `src/components/IsabellaImmersiveTrailer.tsx` — componente de 2 canvas +
  botón "Activar experiencia sonora" (audio solo bajo gesto del usuario).
- `src/vite-env.d.ts` — declaración de módulo `*.mp3`.
- `src/components/IsabellaCinematicTrailer.css` — capas 2d/3d.

Integración: `src/App.tsx` usa ahora `IsabellaImmersiveTrailer` en el intro gate
(tanto `!introDone` como `cinematicIntroOpen`).

Nota de tuning visual (no bloqueante): el `Starfield3D` existente extiende los
planos matemáticos hasta ~2200 mientras `ImmersiveScene` usa `PerspectiveCamera`
con `far=250` y `z=42`; puede recortar las estrellas más lejanas. Ajustar el
presupuesto de cámara o los spreads al afinar la estética.

**Verificación obligatoria pendiente** (el entorno no pudo ejecutar procesos):
`corepack.cmd pnpm exec tsc --noEmit`, `npm run build`, `npm test`.

## W0 — Purga de estado, secretos y gate de CI

Hecho (edición de archivos):
- [x] Ampliado `.gitignore`: `.env` exacto, `.env.*` (sin `.env.example`),
      `*.db`, `*.db-shm`, `*.db-wal`, `/data/*.db*`, `dist/`,
      `.isabella-data/`, `.isabella-cache/`.
- [x] Neutralizado el `.env` placeholder generado por `prisma init`
      (contenía credenciales fake; ahora sin secretos; ignorado).
- [x] `prisma7.config.ts` alineado con `dotenv.config({ path: ".env.local" })`.
- [x] `DIRECT_URL` (Neon sin pooler) añadido a `.env.local`, `.env.example` y
      al grupo `neonPrimary` de `scripts/check-env.ts`.

Pendiente (ejecutar en el host con git operativo):
- [ ] `git rm --cached` de artefactos que hubieran quedado trackeados
      (`data/isabella.db*`, `.env` si existiera en el índice) y commit.
- [ ] Añadir `.github/workflows/ci.yml` con el gate `verify` (lint+test+build)
      + `check:env`.

## W1 — Identity, Tenant y autorización cero confianza

Implementado (contextos transitivos en `src/core/context/`):
- `correlation-context.ts` — CorrelationContext (requestId/traceId/spanId) con
  sanado de IDs entrantes y `childCorrelationSpan`.
- `principal-context.ts` — PrincipalContext derivado SÓLO de la identidad ya
  autenticada (`AuthenticatedPrincipal`); helpers `hasRole`/`hasScope`/
  `isSystemPrincipal`; kind jwt/api-key.
- `tenant-context.ts` — TenantContext + `assertTenantMatch`/`tenantIdsEqual`
  (comparación tiempo-constante) como invariante de aislamiento (ADR-0003).
- `policy-context.ts` — PolicyDecisionContext normalizado desde `PdpDecision`
  (fail-closed) para propagar decisiones de forma transitiva.
- `context/index.ts` — `createRequestFlowContext` compone correlación + tenant
  + principal + policy por request; `deriveChildFlow` para transitividad.
- Exportado desde `src/core/index.ts`.
- Tests: `tests/security/request-flow-context.test.ts`.

No se duplica `src/lib/authz/` (policy-engine/authorization-context): este
contexto describe el flujo/correlación del request; el motor evalúa políticas.

Pendiente:
- [ ] Integrar `createRequestFlowContext` en el gateway/middleware de auth
      (y propagar `tenantId` validado en consulting a capas posteriores).
- [ ] Reporte del PDP (`pdpAuthorize`) ya fail-closed; extender a tenancy de
      recursos en DAOs.

## W2–W12 (referencia al manual)

## W2 — MCP / External Integrations Governance (CIX)

Implementado en `src/lib/mcp/` (marco genérico de gobernanza de conectores):
- `connector-manifest.ts` — ConnectorManifest validado (identidad, kind, scopes
  granulares —rechaza "*"→, allowedDataClasses, contrato de red, failure policy,
  timeout, rate limit, umbral de circuito, auth OAuth, revoked).
- `oauth-policy.ts` — matriculación de credencial OAuth (solo digest, nunca el
  secreto), expiración, rotación y revocación.
- `scopes.ts` — verificación granular de scope (manifest ∪ scope otorgado en el
  request).
- `registry.ts` — decisión en cascada por llamada: revocación → credencial →
  scope → data classification → rate limit → circuit breaker (CLOSED/OPEN/
  HALF_OPEN) → timeout → failure policy (fail-fast/fallback/quarantine) →
  auditoría in-memory (persistencia durable en CXIII).
- `index.ts` — barril público.
- Tests: `tests/security/mcp-connector-governance.test.ts` (las 10 exigencias de
  la sección CIX del manual).

Pendiente:
- [ ] Cablear conectores reales (Stripe MCP, social, search, voice, DB, model
      provider) mediante este marco; registrarlos en `server.ts`.
- [ ] CX — aplicar `DistributedCircuitBreaker` de `src/platform/resilience` a
      cada categoría (model provider, database, quantum, social, payments,
      voice, search, MCP).
- [ ] CXI — helper de retries con backoff/jitter/deadline/idempotencia.

## W2–W12 (referencia al manual)

- **CIX** MCP: ConnectorManifest, OAuth, scopes, rate-limit, circuit breaker,
  audit, revocation.
- **CX** circuit breakers CLOSED/OPEN/HALF_OPEN; **CXI** retries
  (maxAttempts/backoff/jitter/deadline/idempotency/retryableErrors).
- **CXII** colas durables; **CXIII** outbox (transacción + tabla + worker +
  consumidor idempotente).
- **CVII** quantum security (worker aislado sin fs/network/secret/db directos);
  **CVIII** quantum claims (Experimental/Simulated/Hardware-backed/Verified/
  Production/Certified).
- **Braintrust** evals/datasets/scorers/README (`braintrust/`).
- **Prisma + Neon** autoritativo (schema Tenant/TenantUser/Character/
  IdempotencyKey/AuditEvent/Subscription; singleton `src/lib/prisma.server.ts`).
- **Stripe** solo por webhook verificado (firma + raw body + idempotencia por
  `event.id`).

## Operativa

- Avanzar por secciones/puntos, sin sobresaturar.
- Antes de commitear: `lint` (tsc --noEmit), `test`, `build`.
- La telemetría, ledger y claims simulados se etiquetan SIEMPRE como tales.
