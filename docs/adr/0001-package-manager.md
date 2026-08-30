# ADR-0001: npm como gestor único de dependencias

**Política de reproducibilidad, supply chain y compatibilidad nativa**  
**Estado:** Accepted  
**Fecha original:** 20 de agosto de 2026  
**Versión revisada:** 1.1.0  
**Propietario:** Core Architecture / Platform Engineering  
**Ámbito:** Monorepo y servicios de Isabella Villaseñor AI  
**Política:** GOV-PKG-V1  
**Enforcement:** CI blocking + guardrails locales + verificación de plataforma  

---

## 1. 📌 Decisión
El proyecto adopta **npm** como único package manager soportado, con:

- `package-lock.json` como lockfile canónico  
- `npm ci` como mecanismo obligatorio para instalaciones reproducibles en CI y producción  

**Se prohíbe mantener o introducir en el repositorio:**
- `bun.lock`  
- `bun.lockb`  
- `yarn.lock`  
- `pnpm-lock.yaml`  

La decisión es válida mientras el runtime objetivo sea Node.js y el despliegue principal continúe utilizando una cadena de build compatible con npm, especialmente Vercel.  
Esta ADR no afirma que npm sea universalmente superior; establece una única ruta operativa para eliminar divergencia de toolchains.

---

## 2. 📚 Contexto
El repositorio tenía simultáneamente `package-lock.json` y `bun.lock`.  
Esto permitía que desarrolladores, CI y Vercel instalaran grafos de dependencias diferentes.  

La divergencia era especialmente sensible debido a:
- Next.js App Router  
- React  
- TypeScript  
- Vitest  
- `better-sqlite3` y sus bindings nativos  
- Build serverless y Node.js  
- Caches de instalación diferentes  
- Scripts de lifecycle  

Un lockfile no es solo un archivo de conveniencia: representa decisiones de resolución, integridad y metadatos de instalación.  
Dos lockfiles pueden apuntar a versiones distintas, peers distintos, tarballs distintos o scripts diferentes.

---

## 3. 🚨 Problema que se resuelve

### 3.1 Dependency drift
Diferentes gestores pueden interpretar peers, overrides, workspaces y lifecycle scripts de forma distinta.  
El efecto práctico: **“el mismo commit” no necesariamente produce el mismo árbol** si cada entorno usa otra herramienta.

### 3.2 Native modules
`better-sqlite3` contiene componentes nativos.  
La estabilidad requiere que el binario corresponda a:
- Sistema operativo  
- Arquitectura  
- Versión ABI de Node.js  
- Método de instalación del entorno destino  

La política no promete compilación universal: exige probarla en la misma matriz de runtime que se usa en producción.

### 3.3 CI y cache
Caches de npm, Bun, pnpm o Yarn no deben compartir claves ni rutas.  
Un cache incorrecto puede restaurar artefactos incompatibles y ocultar errores de instalación limpia.

### 3.4 Gobernanza
La elección explícita reduce decisiones locales ambiguas y hace que una desviación sea detectable automáticamente.

---

## 4. 🎯 Drivers de decisión
- Reproducibilidad entre workstation, CI, staging y producción  
- Compatibilidad con Node.js y Vercel  
- Compatibilidad comprobable con módulos nativos  
- Menor número de rutas de soporte  
- Auditoría de dependencias y SBOM  
- Instalaciones inmutables mediante `npm ci`  
- Rollback operativo claro  
- Migración sencilla para el equipo existente  

---

## 5. 📐 Alcance técnico

**Aplica a:**
- Aplicaciones Next.js  
- Servicios Node.js  
- Packages internos TypeScript  
- Tests Vitest  
- Workers y funciones serverless  
- Dockerfiles y builds reproducibles  
- GitHub Actions  
- Vercel  
- Entornos locales documentados  

**No aplica a:**
- Toolchains Rust, Go o Python (requieren sus propias ADR y lockfiles)  
- Imágenes de contenedor (digest y SBOM independientes)  
- Gestores de paquetes del sistema operativo  

---

## 6. ⚖️ Política obligatoria

| Código       | Norma                                                                 |
|--------------|----------------------------------------------------------------------|
| **POL-PKG-01** | Lockfile canónico: `package-lock.json` es la única fuente de resolución versionada |
| **POL-PKG-02** | Instalación CI/producción: `npm ci` obligatorio, prohibido `npm install` en CI |
| **POL-PKG-03** | Versiones fijadas: Node.js y npm en `package.json.engines`, `.nvmrc`, Docker y Vercel |
| **POL-PKG-04** | Lifecycle scripts: revisión obligatoria como código de supply chain |
| **POL-PKG-05** | Native build: módulos nativos probados en matriz real de OS/arquitectura |
| **POL-PKG-06** | Overrides: documentados con motivo, riesgo y pruebas |
| **POL-PKG-07** | No fallback: prohibido cambiar automáticamente a Bun/pnpm/Yarn |
| **POL-PKG-08** | Red de instalación: registry confiable, lockfile, integridad y provenance |

---

## 7. 🛠️ Configuración canónica

### 7.1 package.json
```json
{
  "name": "isabella-core",
  "private": true,
  "packageManager": "npm@11.6.0",
  "engines": {
    "node": ">=22.0.0 <23.0.0",
    "npm": ">=11.0.0 <12.0.0"
  },
  "scripts": {
    "preinstall": "node ./scripts/enforce-package-manager.cjs",
    "install:clean": "npm ci",
    "build": "next build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "audit:deps": "npm audit --audit-level=high",
    "verify:package-policy": "node ./scripts/verify-package-policy.cjs"
  }
}
