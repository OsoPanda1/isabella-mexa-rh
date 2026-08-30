# ADR-0001: pnpm como gestor canónico de dependencias

**Política de reproducibilidad, supply chain y compatibilidad nativa**
**Estado:** Superseded — fue: Superseded (1.1.0, votación en curso)
**Fecha original:** 20 de agosto de 2026
**Fecha de superación:** 29 de agosto de 2026 (migración a pnpm por fallo de build en Vercel)
**Versión revisada:** 2.0.0
**Propietario:** Core Architecture / Platform Engineering
**Ámbito:** Isabella Villaseñor AI (Vite + React 19 + Express)
**Política:** GOV-PKG-V1 · v2
**Enforcement:** CI blocking + guardrails locales + verificación de plataforma

---

## 1. 📌 Decisión

El proyecto adopta **pnpm** como único package manager soportado, con:

- `pnpm-lock.yaml` como lockfile canónico
- `pnpm install --frozen-lockfile` como mecanismo obligatorio para instalaciones reproducibles en CI, Docker y producción

**Se prohíbe mantener o introducir en el repositorio:**
- `package-lock.json`
- `package-lock.json5`
- `yarn.lock`
- `bun.lock` / `bun.lockb`

La versión de pnpm queda fijada en `package.json` (`packageManager`) y en `pnpm/action-setup` de los pipelines. La versión de Node.js se fija en `package.json.engines`.

Esta ADR sustituye a las versiones 1.x, que establecían **npm** como gestor único. La migración fue motivada por un fallo de build reproducible: `package.json` declaraba `framer-motion@^13.1.1` pero el lockfile npm (`package-lock.json`) seguía resuelto a `framer-motion@12.43.0`, y `vercel.json` forzaba `npm ci`, causando el error `lock file's framer-motion@12.43.0 does not satisfy framer-motion@13.1.1`.

---

## 2. 📚 Contexto

El repositorio mantuvo durante un tiempo **dos lockfiles en desincronía**:

- `pnpm-lock.yaml` — correcto y actualizado: `framer-motion@13.1.1` resuelve para el proyecto y `framer-motion@12.43.0` queda solo como dependencia transitiva de `motion@12.43.0`.
- `package-lock.json` (npm) — desincronizado: `node_modules/framer-motion` anclado a `12.43.0`.

El despliegue en **Vercel** usaba `installCommand: npm ci` (forzado en `vercel.json`). Como el lock npm estaba desincronizado con `package.json`, `npm ci` abortaba con error **EUSAGE**. El `pnpm-lock.yaml` (correcto) se ignoraba por completo.

### Causa raíz

Al actualizar `framer-motion` a `^13.1.1` en `package.json`, no se regeneró el `package-lock.json`. Aunque `pnpm-lock.yaml` se mantenía al día (el desarrollador trabajaba con pnpm), el build de Vercel quedaba amarrado a npm por config, por lo que fallaba.

### Por qué pnpm y no seguir con npm

- El `pnpm-lock.yaml` ya era la fuente de verdad actualizada del proyecto.
- pnpm permite versiones duplicadas de un paquete en el grafo (aquí `framer-motion@13.1.1` para el proyecto y `framer-motion@12.43.0` anidada bajo `motion`), que es exactamente la topología que el grafo necesita; npm colisionaba en la raíz de `node_modules`.
- `pnpm-workspace.yaml` y el campo `allowScripts` (específico de pnpm) ya estaban presentes en el repo.
- Instalaciones deterministas y más rápidas por el *content-addressable store*.

---

## 3. 🚨 Problema que se resuelve

### 3.1 Desincronización de lockfiles (dependency drift)
Tener `package-lock.json` y `pnpm-lock.yaml` a la vez, con el build amarrado a uno de ellos, produjo un estado en el que **el mismo commit no instalaba el mismo árbol** según la herramienta. `npm ci` fallaba; `pnpm install --frozen-lockfile` era correcto.

### 3.2 Versiones duplicadas en el grafo
El paquete `motion@12.23.24+` declara `framer-motion@^12.43.0` como dependencia, mientras el proyecto quiere `framer-motion@^13.1.1`. pnpm resuelve esta topología anidando la versión transitiva. La resolución con npm en la raíz de `node_modules` era la fuente del conflicto.

### 3.3 Gobernanza
Una única ruta operativa (pnpm) elimina la divergencia de toolchains y hace detectable cualquier desviación de forma automática en CI.

---

## 4. 🎯 Drivers de decisión

- Reproducibilidad entre workstation, CI, staging y producción
- Compatibilidad con Node.js 22 y Vercel
- Instalaciones inmutables mediante `pnpm install --frozen-lockfile`
- Resolución correcta de dependencias con versiones duplicadas (framer-motion / motion)
- Menor número de rutas de soporte
- Auditoría de dependencias y SBOM (`pnpm audit`)
- Rollback operativo claro

---

## 5. 📐 Alcance técnico

**Aplica a:**
- SPA Vite + React 19
- Servidores Express / serverless (Vercel `api/[...path].ts`)
- Tests Vitest
- Dockerfiles y builds reproducibles
- GitHub Actions
- Vercel (`installCommand: pnpm install`)
- Entornos locales documentados

**No aplica a:**
- Toolchains Rust, Go o Python (requieren sus propias ADR y lockfiles)
- Imágenes de contenedor (digest y SBOM independientes)
- Gestores de paquetes del sistema operativo

---

## 6. ⚖️ Política obligatoria

| Código       | Norma                                                                 |
|--------------|----------------------------------------------------------------------|
| **POL-PKG-01** | Lockfile canónico: `pnpm-lock.yaml` es la única fuente de resolución versionada |
| **POL-PKG-02** | Instalación CI/producción: `pnpm install --frozen-lockfile` obligatorio; prohibido el uso de `package-lock.json` / `npm ci` |
| **POL-PKG-03** | Versiones fijadas: `packageManager` en `package.json`, `engines.node`, Docker y Vercel |
| **POL-PKG-04** | Lifecycle scripts: revisión obligatoria como código de supply chain; uso de `allowScripts` (campo pnpm) para los que son seguros |
| **POL-PKG-05** | Native build: módulos nativos (`better-sqlite3`) probados en matriz real de OS/arquitectura |
| **POL-PKG-06** | Overrides: documentados con motivo, riesgo y pruebas |
| **POL-PKG-07** | No fallback: prohibido reintroducir `package-lock.json`, `yarn.lock`, `bun.lock` o cambiar automáticamente de gestor |
| **POL-PKG-08** | Red de instalación: registry confiable, lockfile, integridad y provenance |

---

## 7. 🛠️ Configuración canónica

### 7.1 package.json
```json
{
  "name": "isabella-mexa",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.0.0",
  "engines": {
    "node": ">=22.0.0 <23.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs"
  }
}
```

### 7.2 vercel.json
```json
{
  "buildCommand": "npm run build",
  "installCommand": "pnpm install"
}
```

> Nota: `buildCommand` puede seguir usando `npm run build` si así se prefiere; los binarios se resuelven desde `node_modules/.bin`. Para máxima coherencia se recomienda `pnpm run build`.

---

## 8. 🗺️ Migración aplicada (28–29 ago 2026)

- `vercel.json`: `installCommand` → `pnpm install`.
- Eliminado `package-lock.json` (lock npm desincronizado).
- `Dockerfile`: `COPY package.json pnpm-lock.yaml ./` + `pnpm install --frozen-lockfile`.
- GitHub Actions (`security.yml`, `production-readiness.yml`, `ci-cosign.yml`): `pnpm/action-setup` + cache `pnpm` + `pnpm install --frozen-lockfile`; reemplazado el inexistente `npm run typecheck` por `pnpm run lint`.
- `package.json`: añadido `packageManager: pnpm@10.0.0`; `engines.npm` → `engines.pnpm`; scripts `verify` y `audit:deps` migrados a pnpm.

> Nota: los scripts `verify:package-policy` y `scripts/enforce-package-manager.cjs` referenciados en versiones anteriores no existen en este repositorio actual; no constituyen un gate operativo.

---

## 9. ✅ Criterios de aceptación

- `pnpm install --frozen-lockfile` es exitoso en CI y en un build limpio.
- `vercel build` desplega sin el error EUSAGE de sincronización de lockfile.
- `pnpm run lint` (tsc --noEmit), `pnpm test` y `pnpm run build` pasan.
- No existe `package-lock.json` en el tree de `main`.
