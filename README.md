# Isabella Villaseñor AI — Nodo Cero

> **Infraestructura Cognitiva Territorial Soberana** · Real del Monte, Hidalgo, México
> **Autor & Arquitecto:** Edwin Oswaldo Castillo Trejo (*Anubis Villaseñor*) · ORCID [0009-0008-5050-1539](https://orcid.org/0009-0008-5050-1539)
> **Versión:** `v5.4.1` · **Estado:** `Endurecida (0 vulns pnpm) · lint limpio · 303 tests · build OK`

---

## Estado de honestidad (léase primero)

Este repositorio es una **plataforma cognitiva soberana en construcción**. Para
evitar el "engaño visual" que prohíbe la propia especificación del proyecto,
este README separa explícitamente lo **real/verificado** de lo **simulado/demo**:

| Capacidad | Estado | Notas |
|---|---|---|
| Runtime frontend (Vite + React 19) | **Real** | SPA compilada con `vite build`. |
| Servidor Express / API Vercel | **Real** | `server.ts` + `api/[...path].ts`. |
| Autorización externalizada (PDP `authz-runtime`) | **Real** | Sidecar Python fail-closed; ver abajo. |
| Motor cognitivo Alpha/Beta (`dual-kernel`) | **Real** | Pipeline local soberano de razonamiento; ver sección "Motor cognitivo". |
| Metadatos de sesión / contexto de request transitivo | **Real** | `src/core/context/*` W1, tenancy con comparación tiempo-constante (ADR-0003). |
| Economía / Wallet | **Prototipo** | En memoria; idempotente por `eventId`, invariante de doble entrada. Sin dinero real. |
| Ledger / BookPI (bloques, hashes) | **SIMULADO** | `src/components/Traceability/*` renderizan conjuntos de demostración etiquetados `DEMO`. No hay servicio durable de ledger cableado en este repo. |
| Heatmap de actividad | **SIMULADO** | `src/components/Dashboard/ActivityHeatmap.tsx` usa datos de ejemplo. |
| Sesión de agente (`isabella-agent-sdk`) | **SIMULADO** | `mockSession` como fallback cuando no hay sesión real. |
| Atestación TEE / HSM | **SIMULADO** | `automation/mesh.ts`, `automation/registry.ts` indican `MOCK — no conectado a SGX/TrustZone/SEV real`. |
| Criptografía Post-Quantum (ML-KEM/ML-DSA) | **Lab-only** | Requiere `FEATURE_LAB_MODE=true`; en producción se omite, no se falsifica. |
| Telemetría cinemática de la experiencia | **SIMULADA y etiquetada** | El banner `SIMULATION MODE` se declara de forma explícita por diseño. |
| Intro inmersiva (WebGL 3D + canvas 2D + audio) | **Real** | `ImmersiveScene` + calidad adaptativa (low/medium/high); audio posicional solo tras gesto del usuario. |

> Ningún dato se presenta en la UI como "verificado"/"immutable"/"live" sin una
> verificación real. Los hashes `sha256` de ledger y el estado de enclave
> `cryptographicEnclave` se muestran como `—` / `unavailable` en estado local
> hasta que exista una fuente real.

---

## Endurecimiento reciente (v5.4.1 — esta revisión)

### Seguridad de dependencias (18 vulns → 0)

Se detectaron **18 vulnerabilidades de producción** (`pnpm audit --prod`) con
6 high, 10 moderate y 2 low, introducidas de forma transitiva por
`@google/genai → @modelcontextprotocol/sdk` (hono, ajv/fast-uri, express), por
`prisma` (ajv/fast-uri, deepmerge-ts) y por `@vercel/analytics · speed-insights`
(next → postcss → nanoid), entre otras.

**Causa raíz de la demora:** en **pnpm v10/v11 los `overrides` se declaran en
`pnpm-workspace.yaml`**, no en `package.json`. Los `overrides` puestos solo en
`package.json` se ignoran silenciosamente (por eso `pnpm install` decía
"Already up to date"). Se movieron los overrides a `pnpm-workspace.yaml`,
se regeneró el `pnpm-lock.yaml` y el audit quedó en **0 vulnerabilidades**.

Overrides aplicados (en `pnpm-workspace.yaml`):
`undici ^7.14.0`, `ajv ^8.18.0`, `uuid ^11.1.1`, `path-to-regexp ^6.3.0`,
`fast-uri ^3.1.5`, `ip-address ^10.3.1`, `nanoid ^3.3.18`,
`deepmerge-ts ^8.0.0`, `hono >=4.12.34`, `@hono/node-server ^1.19.15`,
`body-parser ^2.3.0`.

Resultado: **`pnpm audit --prod` → "No known vulnerabilities found"**.

### Nuevo componente unificado: `IsabellaCinematicExperience`

Se reemplazaron **cuatro** componentes de entrada superpuestos por **uno
solo**:
- ✅ **`src/components/Welcome/IsabellaCinematicExperience.tsx`** (nuevo) —
  unifica el protocolo de entrada: *welcome* (pestañas Genesis / Manifiesto /
  Capacidades / Iniciadores), *cinematic*, *immersive* (hook `useImmersiveScene`
  sobre WebGL + audio) y *onboarding* en un único flujo controlado desde
  `App.tsx`.
- 🗑️ **Eliminados** (obsoletos): `Welcome/IsabellaCinematicTrailer.tsx`,
  `Welcome/IsabellaWelcomeModal.tsx`, `IsabellaCinematicTrailer.tsx`,
  `IsabellaImmersiveTrailer.tsx`, `IsabellaOnboardingFlow.tsx`.

### Refuerzo del hook de escena (`ImmersiveScene` / `useImmersiveScene`)

- `ImmersiveScene` ahora expone `mute()` / `unmute()` y el getter `elapsedMs`;
  `getStatus()` devuelve también `muted`.
- `useImmersiveScene` adopta la firma declarativa por objeto
  `{ canvas2DRef, canvas3DRef, enabled, enableAudio, durationMs }` con
  `RefObject<HTMLCanvasElement | null>`, `maxPixelRatio: 1.75` y
  `targetFps: 60`.

### Verificación completa verde

- `tsc --noEmit` (lint) — 0 errores.
- `pnpm test` — **303 tests** (31 archivos), todas verdes.
- `pnpm run build` — Vite + esbuild OK (warnings `import.meta` en formato CJS
  preexistentes, no bloqueantes).
- `pnpm audit --prod` — 0 vulnerabilidades.

---

## Motor cognitivo Alpha/Beta (dual-kernel)

Isabella responde **sin depender de un proveedor externo obligatorio** (raíz:
`GEMINI_API_KEY` no configurada): el razonamiento se ejecuta en el **Dual
Hexagonal Kernel** local (`ISABELLA-DHK-V1.0`), soberano y gobernado.

```
intención → Alpha (comprende, investiga, propone) → propuesta → Beta (autentica, gobierna, ejecuta, verifica) → respuesta
```

- **Alpha** (`src/lib/cognition/alpha/`): `perception`, `context`, `memory`,
  `research`, `hypothesis`, `proposal`.
- **Beta** (`src/lib/cognition/beta/`): `identity`, `classification`, `risk`,
  `policy`, `capability`, `verification`.
- **Coordinador** (`src/lib/cognition/dual-kernel.ts` + `index.ts`): orquesta el
  pipeline con contratos tipados (`contracts.ts`), evidencia, provenance,
  decisión CROWN (`CrownDecision`) y telemetría.
- Provider `isabella-cognition` + fallback enriquecido en
  `src/lib/isabella-inference-engine.ts`.
- Tests: `tests/cognition/dual-kernel.test.ts` (23 tests).

El motor **no** dependía de Gemini para responder: sus contratos contemplan
modos `deliberate` / `quick` y estados de operación auditables. Gemini (cuando
se configura) refina, pero el núcleo cognitivo funciona en local.

---

## Qué es

Isabella Villaseñor AI es un sistema operativo cognitivo gobernado y una
plataforma agéntica descentralizada con cinco módulos cognitivos
(**ISA**, **SOPHIA**, **ORION**, **ARGUS**, **CROWN_GATEWAY**) orquestados por
la capa C.R.O.W.N., con supervisión Zero-Trust y un portal de entrada
cinemático unificado (`IsabellaCinematicExperience`).

---

## Arquitectura (real)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Cliente SPA (Vite + React 19 + TypeScript strict)                    │
│  • src/main.tsx · index.html                                           │
│  • Estado central: src/context/CrownContext.tsx                       │
│  • Portal de entrada unificado: IsabellaCinematicExperience.tsx        │
│    (ImmersiveScene: WebGL 3D + capa 2D + audio + welcome + onboarding) │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  HTTP / JSONL
┌───────────────────────────▼──────────────────────────────────────────┐
│  Gateway (Express en server.ts · serverless en api/[...path].ts)        │
│  • Firewall de peticiones, rate limiting, tipado                       │
│  • Módulos: ISA / SOPHIA / ORION / ARGUS / CROWN                       │
│  • Contexto de request transitivo: src/core/context/* (W1)             │
│  • Motor cognitivo dual Alpha/Beta: src/lib/cognition/*                │
│  • Persistencia: store-authority (Postgres > SQLite > memoria/JSON)    │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  autorización externalizada (fail-closed)
┌───────────────────────────▼──────────────────────────────────────────┐
│  PDP sidecar — authz-runtime/  (Python, OpenFGA-style catalog)         │
│  • isabella_runtime.py · catalog.json · requirements.txt              │
│  • cliente TS: src/lib/authz-runtime/client.ts                        │
│  • Se activa con ISABELLA_AUTHZ_RUNTIME_URL; si no está, pass-through. │
└──────────────────────────────────────────────────────────────────────┘
```

### Despliegue

- **Vercel (producción):** `vercel.json` usa `framework: vite`,
  `outputDirectory: dist`, `installCommand: pnpm install`, y reenvía `/api/*`
  al handler serverless `api/[...path].ts`. El handler importa el servidor
  Express de forma **dinámica y cacheada** para no arrastrar módulos nativos
  (`better-sqlite3`, `three`) al arranque en frío de rutas de salud/stream.
- **Auto-hospedaje:** `pnpm install && pnpm run build && pnpm run start`
  (Express en `dist/server.cjs`).

---

## Autorización externalizada (PDP)

`authz-runtime/` es un Policy Decision Point desacoplado. Corrige un bypass
ABAC crítico: el nivel de aseguramiento (`aal`), el step-up y el control dual
se derivan **exclusivamente de claims verificados** en la solicitud, nunca del
cuerpo enviado por el cliente (fail-closed). `server.ts` aplica
`pdpAuthorize("agent:lease")` y `pdpAuthorize("quantum:execute")`; un proxy
`POST /api/v1/authz/authorize` expone la decisión al cliente.

La clave pública Ed25519 nativa se exporta (bajo
`ISABELLA_AUTHZ_EXPORT_NATIVE_KEY`) para que el PDP valide la procedencia.

---

## Gestor de paquetes y scripts

> El proyecto usa **pnpm** como gestor canónico de dependencias
> (`pnpm-lock.yaml`). **Importante:** los `overrides` residen en
> `pnpm-workspace.yaml` (pnpm v10/11), no en `package.json`.

```bash
pnpm install --frozen-lockfile   # instalación determinista contra pnpm-lock.yaml
pnpm run dev            # servidor Express en desarrollo (tsx server.ts)
pnpm run build          # vite build + esbuild server.ts -> dist/server.cjs
pnpm run start          # node dist/server.cjs
pnpm run lint           # tsc --noEmit (type-check, 0 errores esperados)
pnpm test               # vitest run
pnpm run verify         # lint && test && build
pnpm run check:env      # valida el entorno contra el contrato
pnpm run smoke          # smoke test (scripts/smoke.mjs)
pnpm audit --prod       # auditoría de seguridad de producción (0 vulns esperado)
```

> Nota: `pnpm run quality` **no** existe en este repo. Usa `pnpm run verify`.
> El lint es `tsc --noEmit` (no hay ESLint configurado).

---

## Variables de entorno (`.env.example`)

- `ISABELLA_AUTHZ_RUNTIME_URL` — URL del PDP sidecar. Si está ausente, la
  autorización hace pass-through (no bloquea) para no romper el comportamiento.
- `ISABELLA_AUTHZ_EXPORT_NATIVE_KEY` — si `true`, `server.ts` imprime la clave
  pública Ed25519 nativa para que el PDP la configure.
- `DATABASE_URL` — Postgres (preferido por SSOT). Si falta, SQLite/local.
- `FEATURE_LAB_MODE` — habilita PQC experimental (no para producción).
- `SESSION_SECRET` / secretos de firma — ver `src/lib/env.ts` (placeholders
  como `changeme`/`dev-secret` son rechazados en validación).
- `GEMINI_API_KEY` — **opcional.** Gemini refina la salida del motor
  cognitivo local; no es requisito para que Isabella responda (el Dual Kernel
  Alpha/Beta funciona en local).

---

## Inventario de datos simulados pendientes de cablear a fuentes reales

Para cumplir "datos reales totales" falta cablear servicios backend que en
este repo no existen aún. Ubicaciones exactas:

- `src/components/Ledger/IsabellaLedgerConsole.tsx` — ledger en modo demo con `origin:"demo"` etiquetado y verificador estructural (`verifyLedger`).
- `src/components/Traceability/BookPITab.tsx` — `MOCK_BLOCKS`.
- `src/components/Dashboard/ActivityHeatmap.tsx` — `mockData`.
- `src/lib/isabella-agent-sdk.ts` — `mockSession`.
- `src/lib/automation/mesh.ts`, `src/lib/automation/registry.ts` — atestación TEE mock.
- `src/lib/isabella-crown.ts` — firmas PQC stub.

Cada uno debe sustituirse por un fetch a su endpoint real (ledger service,
metrics service, session service) o, mientras tanto, etiquetarse
explícitamente como `DEMO` en la UI.

---

## CI/CD y supply-chain (GitHub Actions)

El repositorio cuenta con pipelines en `.github/workflows/`:

- `security.yml` — análisis de secretos, SCA y auditoría de dependencias.
- `ci-cosign.yml` — build de imagen y firma con cosign (supply-chain).
- `production-readiness.yml` — chequeo de criterios de salida a producción.
- `dependabot-auto-merge.yml` — auto-merge de parches de Dependabot.

El módulo JDR tiene su propio pipeline en
`jdr-generator/.github/workflows/ci.yml` (compila, prueba, valida Flyway,
quality y genera SBOM/Trivy).

---

## Madurez para producción (estimación real)

Cifras estimadas por revisión de código y verificación local (no son SLOs
medidos). Peso por criticidad.

| Dimensión | % | Peso |
|---|---|---|
| Compilación y tipado (`tsc` 0 errores, `vite build` OK) | 95 | 10% |
| Pruebas automatizadas (303 frontend + 5 JDR, todas verdes) | 84 | 12% |
| Seguridad de dependencias (`pnpm audit` 0 vulns; Maven pendiente de scan) | 91 | 12% |
| AuthN/AuthZ Zero-Trust (PDP externo, ABAC, tenant, contexto transitivo W1, gobernanza MCP CIX, kill-switch) | 89 | 14% |
| Honestidad de datos (etiquetas DEMO, sin falsificar "verificado") | 92 | 10% |
| Resiliencia/runtime (rate-limit, cold-start, circuit-breaker, intro adaptativa) | 84 | 10% |
| Persistencia durable (ledger SIMULADO; JDR no cableado al FE) | 55 | 12% |
| Observabilidad (actuator JDR, telemetría FE limitada) | 65 | 6% |
| CI/CD y coherencia Vercel/Docker | 88 | 8% |
| Gestión de secretos (validación env; sin KMS integrado) | 70 | 6% |

- **Índice de Madurez para Producción (funcional/operativo): ~81%**
- **Índice de Listo-para-Desplegar (build/CI/deploy): ~87%**

Lo que falta para superar 95%:
1. Cablear el ledger/BookPI a una fuente durable real (o al módulo JDR) y
   eliminar los `MOCK_*` del frontend.
2. Configurar JWT/JWKS reales y el PDP sidecar en producción (fail-closed ya
   implementado).
3. Escaneo de dependencias Maven (Dependabot/`mvn dependency:check`) y firma de
   imagen JDR antes del release.
4. Pruebas E2E y de carga en CI; backup/restore y rollback por digest.
5. KMS/Vault para secretos y atestación TEE real (hoy `MOCK`).

---

## Módulo JDR (Java 17 / Spring Boot)

> **Estado:** `mvn -B verify` ✅ (compila + 5 tests). No es producción solo por
> compilar — ver criterios de salida.

`jdr-generator/` es un servicio hermano de persistencia y dominio endurecido
(deny-by-default, tenant derivado del JWT, scopes granulares, idempotencia,
optimistic locking, auditoría durable, outbox transaccional, rate limiting).
Ver `jdr-generator/README` y `docs/threat-model.md`.

Verificación local (requiere JDK 17 + Maven):
```bash
cd jdr-generator/api
mvn -B verify
```

---

## Deslinde de responsabilidad (resumen)

El proyecto se entrega "tal cual" (AS-IS), sin garantías. Ninguna salida de
Isabella constituye asesoría legal, médica o financiera certificada. El usuario
asume la responsabilidad sobre los datos aportados, las transacciones y el
cumplimiento fiscal (SAT) de sus ingresos en la economía de creadores. La
marca y la arquitectura C.R.O.W.N. prohíben su uso en sistemas engañosos no
autorizados.

---

<div align="center">
  <p><strong>Isabella Villaseñor AI · Nodo Cero</strong></p>
  <p><em>Real del Monte, Hidalgo, México · Infraestructura Cognitiva Soberana</em></p>
</div>
