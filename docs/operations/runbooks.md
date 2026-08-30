# RUNBOOKS.md — Manuales operativos

**Estado:** diseno inicial. Cada runbook debe ser validado con ejercicio practico.
**Fecha:** 20 agosto 2026.

---

## Runbook 1: Tasa de error elevada (>1% en 5 minutos)

### Sintomas

- Dashboard muestra SLI error rate > 1% en ventana de 5 minutos.
- Alertas de HTTP 5xx incrementando.
- Usuarios reportan errores 500 o 502.
- Logs muestran stack traces o exceptions no manejadas.

### Deteccion

```bash
# Verificar error rate actual
grep -c " 5[0-9][0-9] " /var/log/isabella/access.log | tail -5
# Comparar con total de requests
wc -l /var/log/isabella/access.log
```

### Impacto

- **Severidad:** SEV-2 hasta confirmar causa raiz.
- **Alcance:** Todos los usuarios dependiendo del endpoint afectado.
- **Duracion estimada:** Variable segun causa.

### Pasos

1. **Identificar el endpoint afectado** (30 segundos):
   - Revisar logs de access recientes.
   - Filtrar por status code 5xx.
   - Verificar si es un endpoint especifico o generalizado.

2. **Determinar si es regresion reciente** (2 minutos):
   - Revisar ultimo deploy: `git log --oneline -5`.
   - Si hay deploy en ultimas 2 horas, considerar rollback inmediato.

3. **Rollback si es regresion** (5 minutos):
   ```bash
   git revert HEAD --no-edit
   npm run build
   # Deploy automatico o manual
   ```

4. **Si no es regresion, aislar causa** (10 minutos):
   - Verificar proveedores externos (Gemini, quantum).
   - Verificar conectividad de base de datos.
   - Verificar memoria disponible.

5. **Mitigar** (variacion):
   - Si es proveedor: activar fallback automatico o circuit breaker.
   - Si es DB: verificar conexiones, reiniciar pool si necesario.
   - Si es OOM: escalar o reiniciar proceso.

6. **Confirmar recuperacion** (5 minutos):
   - Verificar SLI vuelve a rango.
   - Confirmar en dashboard.

### Rollback

- `git revert HEAD --no-edit` + redeploy.
- Si falla el redeploy, restaurar desde ultima imagen conocida buena.

### Escalamiento

- Si no se resuelve en 15 minutos: escalar a Lead tecnico.
- Si afecta mas de 50% de requests: escalar a SEV-1.

---

## Runbook 2: Presion de memoria (>80% heap)

### Sintomas

- Alerta de uso de memoria > 80% del heap configurado.
- Tiempos de respuesta incrementando (GC频繁).
- Posible OOM kill en proceso.

### Deteccion

```bash
# Verificar uso de memoria del proceso Node.js
node -e "console.log(process.memoryUsage())"
# Verificar RSS
ps aux | grep node | awk '{print $6}'
# Verificar heap usado vs total
node -e "const v8=require('v8'); const h=v8.getHeapStatistics(); console.log(h.used_heap_size/h.heap_size_limit*100+'%')"
```

### Impacto

- **Severidad:** SEV-3 hasta que degradacion afecte SLO.
- **Alcance:** Todo el servicio, latencia incrementada.

### Pasos

1. **Verificar nivel exacto** (30 segundos):
   - Heap usado vs heap limit.
   - RSS vs memoria disponible del sistema.

2. **Identificar fuente de consumo** (5 minutos):
   ```bash
   # Heap snapshot si es produccion con --inspect
   # Verificar: audit log in-memory, memory store, event bus
   ```

3. **Acciones inmediatas** (5 minutos):
   - Si audit log excedio 1000 entradas: purgar entradas antiguas.
   - Si memory store esta creciendo: implementar eviction.
   - Si event bus acumulando: limpiar handlers no suscritos.

4. **Si persiste** (10 minutos):
   - Reiniciar proceso con memoria liberada.
   - Considerar escalado horizontal.

5. **Monitoreo post-accion** (30 minutos):
   - Verificar que memoria se mantiene estable.
   - Confirmar que GC no esta en ciclo.

### Rollback

- Reiniciar el proceso Node.js.
- Si es Vercel: el cold start resuelve temporalmente.

### Escalamiento

- Si llega a 90%: escalar a SEV-2.
- Si OOM kill ocurre: escalar a SEV-1.

---

## Runbook 3: Fallo de conexion a base de datos

### Sintomas

- Errores de conexion en logs (ECONNREFUSED, ETIMEDOUT).
- Queries retornando errores de tipo DB.
- Health check fallando.

### Deteccion

```bash
# Verificar SQLite
sqlite3 data/isabella.db "PRAGMA integrity_check;"
# Verificar si el archivo existe y es accesible
ls -la data/isabella.db
# Verificar conexiones activas (futuro PostgreSQL)
# pg_isready -h $DB_HOST -p $DB_PORT
```

### Impacto

- **Severidad:** SEV-2 si persistencia es necesaria para operacion.
- **Alcance:** Writes fallan; reads pueden servir cache si existe.

### Pasos

1. **Verificar tipo de fallo** (1 minuto):
   - Archivo corrupto? -> Paso 2.
   - Archivo inaccesible (permisos)? -> Paso 3.
   - Conexion rechazada (PostgreSQL)? -> Paso 4.

2. **Archivo corrupto** (10 minutos):
   ```bash
   sqlite3 data/isabella.db ".dump" > backup_dump.sql
   sqlite3 data/isabella.db "PRAGMA integrity_check;"
   # Si falla: restaurar desde backup
   cp data/isabella.db.backup data/isabella.db
   ```

3. **Permisos o filesystem** (5 minutos):
   ```bash
   ls -la data/
   chmod 600 data/isabella.db
   # Verificar disco disponible
   df -h data/
   ```

4. **PostgreSQL (futuro)** (10 minutos):
   ```bash
   pg_isready -h $DB_HOST -p $DB_PORT
   # Verificar pool de conexiones
   # Reiniciar si necesario
   ```

5. **Verificar recuperacion** (5 minutos):
   - Ejecutar query de prueba.
   - Confirmar en health check.

### Rollback

- Restaurar archivo SQLite desde backup verificado.
- Para PostgreSQL: failover a replica si existe.

### Escalamiento

- Si persiste > 10 minutos: SEV-2.
- Si datos perdidos: SEV-1.

---

## Runbook 4: Interrupcion de proveedor (Gemini, quantum)

### Sintomas

- Errores 503/502 de APIs externas.
- Timeouts en llamadas a Gemini o quantum providers.
- Circuit breaker activado (si implementado).

### Deteccion

```bash
# Verificar Gemini
curl -s -o /dev/null -w "%{http_code}" https://generativelanguage.googleapis.com/v1/models
# Verificar quantum providers
# Depende del proveedor especifico configurado
```

### Impacto

- **Severidad:** SEV-3 si hay fallback, SEV-2 si no.
- **Alcance:** Funciones dependientes de inferencia AI o quantum.

### Pasos

1. **Confirmar que no es nuestro lado** (2 minutos):
   - Verificar API keys no expiradas.
   - Verificar que el endpoint es correcto.
   - Probar con curl manual.

2. **Verificar estado del proveedor** (3 minutos):
   - Verificar status page del proveedor.
   - Verificar si otros usuarios reportan issues.

3. **Activar fallbacks** (5 minutos):
   - Gemini down -> usar modelo local si disponible.
   - Quantum down -> usar simulador o degradar funcionalidad.
   - Documentar degradation.

4. **Monitorear恢复** (continuo):
   - Reintentar cada 5 minutos con backoff.
   - Verificar cuando el proveedor se recupera.

### Rollback

- No aplica directamente (dependencia externa).
- Rollback es degradar funcionalidad graceful.

### Escalamiento

- Si > 30 minutos: escalar a Lead.
- Si > 2 horas: evaluar alternativas permanentes.

---

## Runbook 5: Activacion del kill-switch (recuperacion de 10 pasos)

### Sintomas

- Kill-switch activado manual o automaticamente.
- Estado del sistema: FROZEN o ISOLATED.
- Toda salida de red bloqueada.

### Deteccion

```bash
# Verificar estado del kill-switch
# via API: GET /api/atlas/getCockpitSnapshot
# campo: killSwitch.state
```

### Impacto

- **Severidad:** SEV-1 hasta completar los 10 pasos.
- **Alcance:** Todo el sistema operando en modo seguro o detenido.

### Pasos (flujo de 10 pasos)

1. **FREEZE_EGRESS** (automatico):
   - Confirmar que toda salida de red no esencial esta bloqueada.
   - Verificar que el bloqueo es efectivo: `curl` externo debe fallar.

2. **QUIESCE** (automatico):
   - Workloads activos pausados ordenadamente.
   - Verificar que no hay requests en proceso a mitad.

3. **SNAPSHOT_METADATA** (1 minuto):
   - Preservar metadatos forenses: logs, estado actual, traces.
   - Copiar a almacenamiento inmutable/offline.

4. **REVOKE_CAPABILITY** (5 minutos):
   - Revocar capability o release comprometida.
   - Rotar tokens si compromiso de autenticacion.
   - Verificar revocacion efectiva.

5. **ISOLATE_WORKLOAD** (2 minutos):
   - Aislar workload afectado del resto del sistema.
   - No aislar todo el nodo si solo un componente esta comprometido.

6. **VERIFY_TRUST_ROOT** (5 minutos):
   - Verificar trust root no esta comprometido.
   - Verificar bundle de release con trust root.
   - Si trust root comprometido: reinstalacion desde fuente segura.

7. **RESTORE_KNOWN_GOOD** (10 minutos):
   - Restaurar version conocida buena del codigo.
   - Verificar integridad del bundle restaurado.
   - Confirmar hash del artifact.

8. **HEALTH_CHECK** (5 minutos):
   - Ejecutar readiness checks completos.
   - Ejecutar pruebas sinteticas basicas.
   - Verificar conectividad a proveedores criticos.

9. **HUMAN_APPROVAL** (variable):
   - Esperar aprobacion explicita de operador autorizado.
   - Documentar: quien aprueba, cuando, por que.
   - **NUNCA** omitir este paso.

10. **RESUME** (5 minutos):
    - Reanudar trafico gradualmente (10%, 25%, 50%, 100%).
    - Monitorear en cada paso.
    - Si algun paso falla: volver a paso 8.

### Rollback

- Si paso 7-10 falla: volver a paso 5 (aislar) y repetir.
- Si paso 10 falla 3 veces: mantener aislar y escalar.

### Escalamiento

- Todo el proceso requiere aprobacion humana (paso 9).
- Si operador no disponible en 30 minutos: escalar a Lead + backup.

---

## Runbook 6: Rotacion de certificados/llaves

### Sintomas

- Certificado proximo a expirar (alerta预防).
- Llave comprometida (evidencia de uso no autorizado).
- Rotation schedule activado (automatico o manual).

### Deteccion

```bash
# Verificar expiracion de certificados
openssl x509 -enddate -noout -in /path/to/cert.pem
# Verificar JWT secret age
ls -la --time=ctime .env | grep JWT_SECRET
```

### Impacto

- **Severidad:** SEV-3 si es rotation预防, SEV-1 si es compromiso.
- **Alcance:** Autenticacion y/o cifrado.

### Pasos

1. **Identificar tipo de llave** (1 minuto):
   - JWT signing key
   - API HMAC key
   - TLS certificate
   - Envelope encryption key (futuro)

2. **Generar llave nueva** (5 minutos):
   ```bash
   # JWT: generar nuevo secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   # TLS: generar nuevo CSR
   openssl req -new -newkey rsa:2048 -nodes -keyout new.key -out new.csr
   ```

3. **Distribuir llave nueva** (5 minutos):
   - Actualizar variable de entorno (sin reiniciar).
   - Para JWT: configurarambas llaves (old + new) temporalmente.

4. **Validar transicion** (5 minutos):
   - Verificar que tokens firmados con llave antigua aun son validos
     (si se configuro ventana de gracia).
   - Verificar que tokens nuevos se firman con llave nueva.

5. **Revocar llave antigua** (despues de ventana de gracia):
   - Eliminar llave antigua del environment.
   - Verificar que solo la nueva esta activa.

6. **Documentar** (2 minutos):
   - Fecha de rotation.
   - Llave rotada (tipo, ID si aplica).
   - Operador responsable.

### Rollback

- Si la llave nueva falla: restaurar la anterior.
- Mantener backup de llaves anteriores por 30 dias (en vault, no en repo).

### Escalamiento

- Si rotation programada falla 2 veces: escalar a Lead.
- Si es compromiso: seguir Runbook 5 (kill-switch).

---

## Runbook 7: Respuesta a brecha de datos

### Sintomas

- Alerta de acceso no autorizado a datos CONFIDENTIAL o RESTRICTED.
- Egress no autorizado detectado.
- Patron de acceso anormal en logs.
- Reporte externo de datos expuestos.

### Deteccion

- Monitoreo de egress (si implementado).
- Logs de acceso anormales.
- Reporte externo (usuarios, investigadores de seguridad).

### Impacto

- **Severidad:** SEV-1 inmediata.
- **Alcance:** Variable - desde un tenant hasta todos.

### Pasos

1. **PRESERVAR evidencia** (inmediato, 0-5 minutos):
   - **NO** eliminar logs ni datos antes de preservar.
   - Capturar logs recientes a almacenamiento inmutable.
   - Capturar estado actual del sistema.
   - Documentar: cuando se detecto, que se detecto, evidencia inicial.

2. **CONTENER** (5 minutos):
   - Activar kill-switch si la brecha es activa.
   - Bloquear vector de acceso identificado.
   - Revocar credenciales comprometidas.
   - No presuponer alcance - asumir maximo.

3. **NOTIFICAR** (30 minutos):
   - Notificar a Lead tecnico.
   - Notificar a DPO (Data Protection Officer) si aplica.
   - Preparar notificacion a afectados (si requiere regulacion).

4. **ERADICAR** (variable):
   - Eliminar vector de acceso.
   - Limpiar datos comprometidos si es posible.
   - Verificar que no hay persistencia residual.

5. **RESTABLECER** (variable):
   - Restaurar desde backup verificado.
   - Verificar integridad post-restauracion.
   - Reanudar operaciones gradualmente.

6. **VERIFICAR** (post-restauracion):
   - Ejecutar todos los health checks.
   - Verificar SLOs vuelven a rango.
   - Auditar accesos post-restauracion.

7. **REVISAR** (post-incidente, 48 horas):
   - Documentar timeline completo.
   - Identificar causa raiz.
   - Evaluar impacto real vs estimado.
   - Proponer mejoras.

8. **MEJORAR** (post-review):
   - Implementar controles adicionales.
   - Actualizar este runbook si es necesario.
   - Compartir lessons learned.

### Rollback

- No aplica directamente - la brecha es el incidente.
- La restauracion es parte del paso 5.

### Escalamiento

- SEV-1 automatica desde el paso 1.
- Legal/compliance: notificar segun regulacion aplicable
  (GDPR: 72 horas, LFPDPPP: sin demora injustificada).

### Notas criticas

- **NUNCA** purgar datos antes de preservar evidencia forense.
- **NUNCA** hacer reboot automatico como primera respuesta.
- **NUNCA** asumir que el alcance es limitado sin evidencia.
- Claves nuevas solo despues de verificar trust root.
