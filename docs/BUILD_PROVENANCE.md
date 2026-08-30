# BUILD_PROVENANCE.md — Isabella Villaseñor AI

## Build reproducibility

```bash
# Instalar dependencias exactas
npm ci

# Typecheck
npx tsc --noEmit

# Tests
npm test

# Build frontend + server
npm run build
# Equivalente a:
#   vite build
#   esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs
```

## Artefactos producidos

| Artefacto | Path | Descripción |
|---|---|---|
| SPA frontend | `dist/index.html` + `dist/assets/` | React/Vite bundle para estáticos |
| Server bundle | `dist/server.cjs` | Express server bundled con esbuild |
| Source map | `dist/server.cjs.map` | Para debugging en dev |

## SBOM

El SBOM debe generarse con `npm audit --json` o herramienta equivalente (syft, cdxgen).

Campos requeridos:
- Paquete: isabella-mexa
- Versión: ver `package.json`
- Licencias de dependencias: npm audit
- Digests: SHA-256 de cada artefacto

## Firmas de build

Cada release debe incluir:
1. Digest SHA-256 de `dist/server.cjs`
2. Digest SHA-256 de `dist/assets/index-*.js`
3. Digest SHA-256 de `dist/assets/index-*.css`
4. Commit SHA exacto
5. Timestamp ISO 8601
6. Node.js version used
7. npm version used

## Integridad del bundle

```bash
# Verificar digests
sha256sum dist/server.cjs
sha256sum dist/assets/index-*.js
```

## Cadena de confianza

```
git commit SHA
  → npm ci (package-lock.json)
    → vite build (dist/assets/)
    → esbuild (dist/server.cjs)
      → vercel deploy (production)
```

## Rotación de dependencias

- Revisar `npm audit` semanalmente
- Actualizar dependencias con `npm update`
- Verificar breaking changes antes de merge
- Nunca hacer deploy con vulnerabilidades high/critical sin mitigación documentada
