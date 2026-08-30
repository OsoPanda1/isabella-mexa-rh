# AGENTS.md — isabella-mexa

Convenciones para agentes de IA que trabajan en **isabella-mexa**
(RDM Digital Hub — Nodo Cero · Real del Monte, Hidalgo, México).

> **Este repositorio NO es Next.js.** Es **Vite 6 + React 19 + TypeScript
> (strict) + Tailwind 4 + Express**. El despliegue en Vercel sirve la SPA
> desde `dist/` y las API vía el handler serverless `api/[...path].ts`, que
> delega al `app` de Express definido en `server.ts` (mismo flujo que
> `npm run dev` / `npm start`). No usar dependencias ni convenciones de Next.js.

## Stack

- **Frontend:** Vite 6 + React 19 + TypeScript strict + Tailwind 4.
- **Backend:** Express en `server.ts` (exporta `app`). Puertos: `npm run dev`
  (tsx) y `npm run start` (dist/server.cjs).
- **Serverless (Vercel):** `api/[...path].ts` importa dinámicamente `server.ts`
  y reenvía todas las peticiones al `app` Express.
- **Autorización externalizada:** PDP sidecar en `authz-runtime/` (Python).
  Cliente TS en `src/lib/authz-runtime/client.ts` (`pdpAuthorize`, fail-closed).
- **Tests:** Vitest. **Contratos:** zod. **Cripto:** `src/lib/postQuantumCrypto.ts`
  (lab-only, requiere `FEATURE_LAB_MODE=true`).

## Comandos de verificación (obligatorios antes de terminar una tarea)

```bash
npx tsc --noEmit      # tipos (equivalente a npm run lint)
npm run lint          # tsc --noEmit
npm test              # vitest run
npm run verify        # lint && test && build
npm run check:env     # valida el entorno contra el contrato
npm run smoke         # smoke test (scripts/smoke.mjs)
npm run build         # vite build + esbuild server.ts -> dist/server.cjs
```

> **No existen** en este repo: `npm run quality`, `npm run audit`,
> `npm run check:contracts`, `npm run typecheck`, ni ESLint configurado.
> El "lint" es `tsc --noEmit`. Usa `npm run verify` para la cadena completa.

## Reglas de código

- Comentarios y nombres de archivo en español; identificadores y código en
  inglés. Archivos en kebab-case.
- **Prohibido** `as never` y `require()` dinámico (rompe el flujo serverless).
- Cabecera de módulo con el bloque `/* ==== */` existente.
- El núcleo transversal vive en `src/lib/` y `src/platform/`; la trust canónica
  en `src/lib/native-auth.ts`.
- La autorización externa (PDP) usa `pdpAuthorize(...)` de
  `src/lib/authz-runtime/client.ts` (fail-closed cuando el PDP no está
  configurado, para no romper el comportamiento actual).
- Las rutas API se definen en `server.ts` (Express) y se sirven en Vercel vía
  `api/[...path].ts`. No duplicar lógica de autorización.
- Variables de entorno: documentarlas en `src/lib/env.ts` (validación con
  `assertStrictEnv`) y en `.env.example`.
- No regenerar secretos, no commitear `.env.local`, no añadir dependencias sin
  justificación.
- Honestidad de datos: ningún valor se presenta en la UI como "verificado" /
  "immutable" / "live" sin una verificación real. Lo simulado se etiqueta como
  `SIMULATED` / `DEMO` / `local`.

## Estructura

- `src/lib/` — núcleo transversal (auth, env, api-contracts, persistence,
  creator-economy, automation, quantum, isabella-*).
- `src/platform/` — `http/gateway`, `resilience/circuit-breaker`, `flags`,
  `jobs`.
- `src/middleware/` — `auth`, `rateLimit`, `security`.
- `src/domains/` — dominios (`ai`, `economy`, ...).
- `src/context/CrownContext.tsx` — estado central del frontend.
- `server.ts` — app Express (exporta `app`); `api/[...path].ts` lo usa en Vercel.
- `authz-runtime/` — Policy Decision Point sidecar (Python).
- `scripts/` — `verify-package-policy.cjs`, `check-env.ts`, `smoke.mjs`.
- `tests/` — pruebas de Vitest.

## Trabajo con dominio de Isabella

- Razonamiento / inferencia → `src/lib/isabella-inference-engine.ts`.
- Firma post-quántica → `src/lib/postQuantumCrypto.ts` (lab-only).
- Exposición → `server.ts` (rutas Express) y el handler `api/[...path].ts`.
- El dead-man-switch y el gateway CROWN son soberanos: no añadir egress
  obligatorio.
