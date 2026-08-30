# RELEASE_PROCESS.md — Isabella Villaseñor AI

## Proceso de release

### Pre-release

1. **Código**
   - Todos los tests pasan (`npm test`)
   - Linting limpio (`npm run lint`)
   - Build de producción exitoso (`npm run build`)
   - Sin vulnerabilidades en dependencies

2. **Seguridad**
   - Auditoría de dependencias
   - Verificación de firmas PQC (cuando producción)
   - Revisión de permisos de herramientas

3. **Firma del bundle**
   - SBOM generado y firmado
   - Digests de artefactos verificados
   - Manifest de air-gap creado

4. **Aprobación**
   - Owner operativo aprueba release
   - Rollback plan documentado
   - RTO/RPO verificados

### Deploy

```bash
# Local
./scripts/deploy-local.sh

# Producción
vercel deploy --prod
```

### Post-release

1. **Canary (24-72h)**
   - Monitoreo activo
   - Métricas de error rate
   - Comparación con baseline

2. **Full rollout**
   - Si canary es estable
   - Rollback plan activado

### Rollback

1. Seleccionar release anterior firmada
2. Verificar compatibilidad
3. Ejecutar rollback con aprobación
4. Ejecutar health checks post-rollback
5. Documentar incidente
