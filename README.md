# Isabella Villaseñor AI — Nodo Cero

> **Infraestructura Cognitiva Territorial Soberana** · Real del Monte, Hidalgo, México
> **Autor & Arquitecto:** Edwin Oswaldo Castillo Trejo (*Anubis Villaseñor*) · ORCID [0009-0008-5050-1539](https://orcid.org/0009-0008-5050-1539)
> **Versión:** `v5.4.0` · **Estado:** `Endurecida (0 vulns pnpm) · JDR verde · 267 tests · ~80% prod`

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
| Métricas de módulos cognitivos | **Parcial** | Alimentadas por `/api/quantum/mesh-status` cuando existe; en su defecto valores semilla locales. |
| Ledger / BookPI (bloques, hashes) | **SIMULADO** | `src/components/Traceability/*` y `src/components/Admin/LedgerInspector.tsx` renderizan conjuntos de demostración. No hay servicio durable de ledger cableado en este repo. |
| Heatmap de actividad | **SIMULADO** | `src/components/Dashboard/ActivityHeatmap.tsx` usa datos de ejemplo. |
| Sesión de agente (`isabella-agent-sdk`) | **SIMULADO** | `mockSession` como fallback cuando no hay sesión real. |
| Atestación TEE / HSM | **SIMULADO** | `automation/mesh.ts`, `automation/registry.ts` indican `MOCK — no conectado a SGX/TrustZone/SEV real`. |
| Criptografía Post-Quantum (ML-KEM/ML-DSA) | **Lab-only** | Requiere `FEATURE_LAB_MODE=true`; en producción se omite, no se falsifica. |
| Telemetría cinemática del trailer | **SIMULADA y etiquetada** | `IsabellaCinematicTrailer` declara `SIMULATION MODE` y `telemetry: SIMULATED` por diseño. |
| Intro inmersiva (WebGL 3D + canvas 2D + audio) | **Real** | `ImmersiveScene` + calidad adaptativa (low/medium/high) por capacidad del dispositivo; audio posicional solo tras gesto del usuario. |
| Contexto de request transitivo (correlación/tenant/principal/policy) | **Real** | `src/core/context/*` W1, tenancy con comparación tiempo-constante (ADR-0003). |
| Economía / Wallet | **Prototipo** | En memoria; idempotente por `eventId`, invariante de doble entrada, máquina de estados de pago. Sin dinero real. |

> Ningún dato se presenta en la UI como "verificado"/"immutable"/"live" sin una
> verificación real. Los hashes `sha256` de ledger y el estado de enclave
> `cryptographicEnclave` se muestran como `—` / `unavailable` en estado local
> hasta que exista una fuente real.

---

## Endurecimiento reciente (esta revisión)

- **Seguridad de dependencias (npm):** se añadieron `overrides` en
  `package.json` para cerrar las alertas de Dependabot de severidad alta:
  - `uuid = "^11.1.1"` → cierra **CVE-2026-41907** (escritura fuera de rango en
    `uuid` v3/v5/v6), introducida de forma transitiva por `statsig-node-lite`.
  - `path-to-regexp = "^6.3.0"` → cierra **CVE-2024-45296** (ReDoS por
    backtracking en rutas), presente de forma transitiva en `@vercel/node`.
  Tras tirar estos cambios ejecuta `pnpm install` para regenerar
  `pnpm-lock.yaml`. Resultado actual: **`pnpm audit` → 0 vulnerabilidades**.
- **Latencia (near-zero):** el ticker de *uptime* global ya no usa `setState`;
  pasó a un `useRef` + `setInterval`, de modo que el contexto de Crown ya no
  re-renderiza toda la app cada segundo. `systemUptimeSeconds` se expone vía
  `uptimeRef.current` solo en `executeCommand`.
- **Código muerto:** se eliminó el `lazy`-import de `IsabellaOnboardingFlow` en
  `App.tsx` (definido pero nunca renderizado). El intro gate usa
  `IsabellaCinematicTrailer`.
- **Etiquetado DEMO:** `LedgerInspector`, `BookPITab`, `ActivityHeatmap` y
  `Admin/LedgerInspector` ahora muestran un banner `DEMO` explícito sobre datos
  de demostración.
- **Coherencia Vercel:** `api/[...path].ts` delega 100% de las peticiones al
  `app` Express de `server.ts`; `vite.config.ts` define `VITE_PUBLIC_APP_URL`
  por defecto a `""`; `vercel.json` usa `maxDuration: 55`.
- **Módulo JDR (Java/Spring Boot):** `mvn -B verify` compila y pasa sus
  pruebas (5 tests: idempotencia y contexto de tenant). El servicio queda
  *verde* localmente; ver sección "Módulo JDR" para criterios de salida a
  producción.
- **Corrección de build en Vercel (migración a pnpm):** el despliegue fallaba
  en `npm ci` con `lock file's framer-motion@12.43.0 does not satisfy
  framer-motion@13.1.1` porque `package-lock.json` quedó desincronizado con
  `package.json` (que pide `framer-motion@^13.1.1`). Se resolvió usando el
  gestor correcto del proyecto (**pnpm**, cuyo `pnpm-lock.yaml` ya resolvía
  `framer-motion@13.1.1`): `vercel.json` ahora usa `installCommand: pnpm install`,
  se eliminó el `package-lock.json`, y `Dockerfile`, GitHub Actions y scripts
  se migraron a pnpm (`--frozen-lockfile`). Ver
  `docs/adr/0001-package-manager.md` (v2.0.0).

> **Para verificar antes de desplegar (en tu máquina, el agente no corre
> node/tsc/vite):** `pnpm install && pnpm run verify` (lint + tests + build +
> `pnpm audit` en 0 vulns). El módulo JDR se verifica aparte con
> `cd jdr-generator/api && mvn -B verify` (5 tests). Luego `git push origin main`.

---

## Endurecimiento actual (v5.4.0)

- **Intro cinematográfica evolucionada:** nuevo motor `ImmersiveScene` (WebGL
  3D + capa 2D twinkle + audio posicional) con calidad adaptativa
  (`detectQuality`: low/medium/high según devicePixelRatio y GPU), pausa por
  tab oculta, recuperación de pérdida de contexto WebGL y respeto a
  `prefers-reduced-motion`. Se integra en `App.tsx` vía `IsabellaImmersiveTrailer`
  en ambos gates de entrada; el trailer clásico queda como fallback.
- **W0 — Higiene de entorno y CI:** `.gitignore` ampliado (`.env*`, `*.db*`,
  `dist/`, `.isabella-*`); `.env` raíz neutralizado (ignorado); `prisma7.config.ts`
  apunta a `.env.local`; `DIRECT_URL` añadido al contrato de entorno
  (`check-env.ts` · `.env.example`); nuevo workflow
  `.github/workflows/ci.yml` con jobs `verify` (check:env+lint+test+build) y
  `hygiene` (veta `.env`/`*.db*` trackeados).
- **W1 — Contexto de request cero confianza (transitivo):** en
  `src/core/context/`, nuevos `correlation-context`, `principal-context`,
  `tenant-context` (comparación de tenant **tiempo-constante**) y
  `policy-context` (fail-closed), compuestos por `createRequestFlowContext`.
  Los hijos derivan del padre (`deriveChildFlow`) sin re-autenticar. Se
  complementa con, y no duplica, `src/lib/authz/` (motor PDP). Tests en
  `tests/security/request-flow-context.test.ts`.
- **Despliegue de dependencias:** `pnpm approve-builds` para scripts nativos
  (better-sqlite3, prisma, esbuild); `pnpm-workspace.yaml` excluye `tsx`/`zod`
  de la política de `minimumReleaseAge` (dependencias legítimas ya fijadas en
  el lockfile).

> **Hoja de ruta de endurecimiento** (W0–W12) en
> `docs/roadmap/ATLAS_HARDENING.md`: CIX (MCP), circuit breakers, retries,
> colas durables, outbox, quantum, Braintrust y Stripe por webhook verificado.

---

## Qué es

Isabella Villaseñor AI es un sistema operativo cognitivo gobernado y una
plataforma agéntica descentralizada con cinco módulos cognitivos
(**ISA**, **SOPHIA**, **ORION**, **ARGUS**, **CROWN_GATEWAY**) orquestados por
la capa C.R.O.W.N., con supervisión Zero-Trust y un portal de entrada
cinemático (`IsabellaCinematicTrailer`).

---

## Arquitectura (real)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Cliente SPA (Vite + React 19 + TypeScript strict)                    │
│  • src/main.tsx · index.html                                           │
│  • Estado central: src/context/CrownContext.tsx                       │
│  • Intro inmersiva: src/components/IsabellaImmersiveTrailer.tsx       │
│    (ImmersiveScene: WebGL 3D + capa 2D + audio)                       │
│  • Portal cinemático (fallback): IsabellaCinematicTrailer.tsx         │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  HTTP / JSONL
┌───────────────────────────▼──────────────────────────────────────────┐
│  Gateway (Express en server.ts · serverless en api/[...path].ts)        │
│  • Firewall de peticiones, rate limiting, tipado                       │
│  • Módulos: ISA / SOPHIA / ORION / ARGUS / CROWN                       │
│  • Contexto de request transitivo: src/core/context/* (W1)             │
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

## Mejoras operacionales aplicadas en esta revisión

- **Eliminación de datos engañosos:** se removió el hash `sha256` de cadena
  vacía (`e3b0c442…`) presentado como digest inmutable del ledger, el estado
  `cryptographicEnclave: "verified"` (ahora `unavailable` en local) y los
  porcentajes `99.98%` / `99.85%` hardcodeados en `argus-scan` y en el motor
  de inferencia (reemplazados por autoevaluación local honesta).
- **Resiliencia Vercel:** import dinámico/cacheado del servidor Express en el
  handler serverless.
- **Portal cinemático:** `IsabellaCinematicTrailer` como compuerta de entrada,
  con `prefers-reduced-motion`, CTA siempre visible y telemetría etiquetada
  como `SIMULATED`.
- **Endurecimiento previo (P0):** entrega de JWT solo en cookie HttpOnly;
  wallet idempotente; TLS a Postgres con `rejectUnauthorized`; SSOT en
  `store-authority.ts`; PDP ABAC fail-closed.

---

## Gestor de paquetes y scripts

> El proyecto usa **pnpm** como gestor canónico de dependencias
> (`pnpm-lock.yaml`). La versión queda fijada por `packageManager` en
> `package.json`. Ver `docs/adr/0001-package-manager.md` (v2.0.0).

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
```

> Nota: `pnpm run quality` **no** existe en este repo. Usa `pnpm run verify`.
> (El `AGENTS.md` del workspace padre describe un stack Next.js distinto; este
> repositorio es Vite + Express y sus scripts son los de arriba.)

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

---

## Inventario de datos simulados pendientes de cablear a fuentes reales

Para cumplir "datos reales totales" falta cablear servicios backend que en
este repo no existen aún. Ubicaciones exactas:

- `src/components/Ledger/IsabellaLedgerConsole.tsx` — ledger en modo demo con `origin:"demo"` etiquetado y verificador estructural (`verifyLedger`). `src/components/Traceability/LedgerInspector.tsx` y `src/components/Admin/LedgerInspector.tsx` re-exportan el mismo componente.
- `src/components/Traceability/BookPITab.tsx` — `MOCK_BLOCKS`
- `src/components/Admin/LedgerInspector.tsx` — re-exporta `IsabellaLedgerConsole` (ledger demo etiquetado; ya sin `MOCK_LEDGER`)
- `src/components/Dashboard/ActivityHeatmap.tsx` — `mockData`
- `src/lib/isabella-agent-sdk.ts` — `mockSession`
- `src/lib/automation/mesh.ts`, `src/lib/automation/registry.ts` — atestación TEE mock
- `src/lib/isabella-crown.ts` — firmas PQC stub

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
| Pruebas automatizadas (267 frontend + 5 JDR, todas verdes) | 80 | 12% |
| Seguridad de dependencias (npm audit 0; Maven pendiente de scan) | 88 | 12% |
| AuthN/AuthZ Zero-Trust (PDP externo, ABAC, tenant, contexto transitivo W1, kill-switch) | 88 | 14% |
| Honestidad de datos (etiquetas DEMO, sin falsificar "verificado") | 92 | 10% |
| Resiliencia/runtime (rate-limit, cold-start, circuit-breaker, intro adaptativa) | 84 | 10% |
| Persistencia durable (ledger SIMULADO; JDR no cableado al FE) | 55 | 12% |
| Observabilidad (actuator JDR, telemetría FE limitada) | 65 | 6% |
| CI/CD y coherencia Vercel/Docker | 88 | 8% |
| Gestión de secretos (validación env; sin KMS integrado) | 70 | 6% |

- **Índice de Madurez para Producción (funcional/operativo): ~80%**
- **Índice de Listo-para-Desplegar (build/CI/deploy): ~86%**

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

## Módulo JDR (Java 17 / Spring Boot 3.3.5)

> **Estado:** `mvn -B verify` ✅ (compila + 5 tests). No es producción solo por
> compilar — ver criterios de salida abajo.

`jdr-generator/` es un servicio hermano de persistencia y dominio endurecido,
integrado según `Isabella_JDR_propuesta_tecnica_final_produccion.md`. Isabella
conserva la autoridad de identidad, autorización, tenant, RBAC/ABAC, memoria,
provenance, auditoría y gobernanza cuántica; JDR aporta persistencia, personajes,
reglas y trabajos cuánticos.

Principios aplicados: **deny-by-default**, tenant derivado del JWT verificado,
scopes granulares, idempotencia en mutaciones, optimistic locking (`@Version`),
auditoría durable, outbox transaccional, rate limiting y despliegue inmutable.

Estructura:
```
jdr-generator/
├── api/                 # Maven module (pom.xml, Dockerfile, src/...)
├── openapi/             # isabella-jdr-v1.yaml (contrato)
├── deploy/              # docker-compose.local.yml, k8s/, secrets.example.yaml
├── .github/workflows/   # ci.yml (compile, test, Flyway, quality, Trivy, SBOM, firma)
└── docs/threat-model.md
```

Endpoints (todos tras WAF/API Gateway + Isabella Authorization):
`GET/POST /api/v1/characters`, `GET/PATCH/DELETE /api/v1/characters/{id}`,
`GET/POST /api/v1/memory-links`, `GET /api/v1/rules`,
`POST /api/v1/quantum/jobs`, `GET /api/v1/quantum/jobs/{jobId}`,
`GET /api/v1/audit/events`, `/actuator/health`, `/actuator/prometheus`.

Verificación local (requiere JDK 17 + Maven):
```bash
cd jdr-generator/api
mvn -B verify                 # compila, pruebas, Flyway validate, quality (-Pci)
docker compose -f ../deploy/docker-compose.local.yml up -d mysql
mvn -B spring-boot:run        # levanta el servicio (perfil local)
```
`No es producción solo por compilar`: se requieren JWT/JWKS reales,隔离 multi-tenant,
pruebas de concurrencia/rate-limit, backup/restore, escaneo de imagen y rollback
por digest antes del release (ver `docs/threat-model.md` y criterios de salida).

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
