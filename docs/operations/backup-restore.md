# BACKUP_RESTORE.md — Procedimientos de backup y restauracion

**Estado:** diseno para implementacion.
**Fecha:** 20 agosto 2026.

## 1. Objetivos

| Metrica | Objetivo |
|---|---|
| **RTO** (Recovery Time Objective) | 4 horas |
| **RPO** (Recovery Point Objective) | 1 hora |
| **Retencion de backups** | 30 dias (diarios), 12 meses (mensuales) |
| **Verificacion** | Checksum + restore drill trimestral |

## 2. Inventario de datos

| Dato | Ubicacion actual | Persistencia | Prioridad backup |
|---|---|---|---|
| BookPI Ledger | In-memory + archivo | Volatil | **Critica** |
| Trust roots | Archivo en disco | Semi-persistente | **Critica** |
| Audit log | In-memory (max 1000) | Volatil | Alta |
| Memory store | In-memory | Volatil | Alta |
| SQLite database | `data/isabella.db` | Persistente (WAL) | **Critica** |
| Configuration | `.env`, env vars | Semi-persistente | Alta |
| Prompt templates | `data/prompt-templates/` | En repo | Media |
| Event bus history | In-memory | Volatil | Baja |
| Telemetry counters | In-memory | Volatil | Baja |

## 3. SQLite: Procedimientos

### 3.1 Backup con WAL checkpoint

```bash
# Paso 1: Forzar checkpoint WAL a archivo principal
sqlite3 data/isabella.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Paso 2: Verificar integridad antes de copiar
sqlite3 data/isabella.db "PRAGMA integrity_check;"
# Esperado: "ok"

# Paso 3: Copiar archivo con timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp data/isabella.db "backups/isabella_${TIMESTAMP}.db"

# Paso 4: Verificar copia
sqlite3 "backups/isabella_${TIMESTAMP}.db" "PRAGMA integrity_check;"
# Esperado: "ok"

# Paso 5: Calcular checksum
sha256sum "backups/isabella_${TIMESTAMP}.db" > "backups/isabella_${TIMESTAMP}.sha256"
```

### 3.2 Backup automatico (cron)

```bash
# /etc/cron.d/isabella-backup
# Ejecutar cada hora
0 * * * * root /opt/isabella/scripts/backup-sqlite.sh >> /var/log/isabella/backup.log 2>&1
```

### 3.3 Retencion

| Tipo | Cantidad | Ubicacion |
|---|---|---|
| Horario | 24 ultimos (1 dia) | `backups/` local |
| Diario | 30 ultimos | `backups/` local |
| Mensual | 12 meses | Almacenamiento offline/S3 |

### 3.4 Verificacion post-backup

```bash
# Verificar que el backup no esta corrupto
INTEGRITY=$(sqlite3 "backups/isabella_${TIMESTAMP}.db" "PRAGMA integrity_check;")
if [ "$INTEGRITY" != "ok" ]; then
  echo "ALERTA: Backup corrupto: isabella_${TIMESTAMP}.db"
  # Reintentar backup
fi
```

## 4. PostgreSQL (futuro): Procedimientos

### 4.1 Backup logico con pg_dump

```bash
# Full backup
pg_dump -h $DB_HOST -U $DB_USER -d isabella \
  -Fc -f "backups/isabella_${TIMESTAMP}.dump"

# Verificar
pg_restore -l "backups/isabella_${TIMESTAMP}.dump" > /dev/null
```

### 4.2 WAL archiving para PITR

```bash
# postgresql.conf
archive_mode = on
archive_command = 'cp %p /archive/wal/%f'
```

### 4.3 Restore Point-In-Time

```bash
# Restaurar hasta punto especifico
pg_restore -h $DB_HOST -U $DB_USER -d isabella \
  -c --data-only "backups/isabella_${TIMESTAMP}.dump"

# Aplicar WAL hasta timestamp
recovery_target_time = '2026-08-20 14:30:00'
```

### 4.4 Retencion PostgreSQL

| Tipo | Cantidad | Retencion |
|---|---|---|
| WAL archives | Continuous | 7 dias |
| Full backups | Diarios | 30 dias |
| Base backups | Semanales | 12 semanas |

## 5. Redis (futuro): Procedimientos

### 5.1 RDB snapshots

```bash
# redis.conf
save 900 1      # 1 key changed en 900s
save 300 10     # 10 keys changed en 300s
save 60 10000   # 10000 keys changed en 60s

# Backup manual
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb "backups/redis_${TIMESTAMP}.rdb"
```

### 5.2 AOF (Append Only File)

```bash
# redis.conf
appendonly yes
appendfsync everysec

# Backup AOF
redis-cli BGREWRITEAOF
cp /var/lib/redis/appendonly.aof "backups/redis_aof_${TIMESTAMP}.aof"
```

### 5.3 Restaurar Redis

```bash
# Detener Redis
redis-cli SHUTDOWN NOSAVE

# Copiar dump.rdb o appendonly.aof
cp backups/redis_${TIMESTAMP}.rdb /var/lib/redis/dump.rdb

# Reiniciar Redis
redis-server /etc/redis/redis.conf
```

## 6. Artifact storage (S3 versioning)

### 6.1 Configuracion S3

```json
{
  "Versioning": { "Status": "Enabled" },
  "LifecycleRules": [
    {
      "ID": "TransitionToIA",
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 90, "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 365 }
    }
  ]
}
```

### 6.2 Subida de backups

```bash
# Subir backup a S3 con versioning
aws s3 cp "backups/isabella_${TIMESTAMP}.db" \
  s3://isabella-backups/sqlite/ --storage-class STANDARD_IA

# Subir checksum
aws s3 cp "backups/isabella_${TIMESTAMP}.sha256" \
  s3://isabella-backups/sqlite/
```

### 6.3 Restaurar desde S3

```bash
aws s3 cp s3://isabella-backups/sqlite/isabella_${TIMESTAMP}.db .
aws s3 cp s3://isabella-backups/sqlite/isabella_${TIMESTAMP}.sha256 .

# Verificar checksum
sha256sum -c "isabella_${TIMESTAMP}.sha256"

# Verificar integridad
sqlite3 "isabella_${TIMESTAMP}.db" "PRAGMA integrity_check;"
```

## 7. Restore drill: Programa trimestral

### Programacion

| Trimestre | Fecha objetivo | Responsable |
|---|---|---|
| Q1 | Enero 15 | Operador + Lead |
| Q2 | Abril 15 | Operador + Lead |
| Q3 | Julio 15 | Operador + Lead |
| Q4 | Octubre 15 | Operador + Lead |

### Procedimiento de drill

1. **Preparacion** (30 minutos):
   - Seleccionar backup aleatorio del periodo.
   - Preparar entorno limpio (maquina o container fresh).
   - No usar el entorno de produccion.

2. **Restauracion** (2 horas):
   - Restaurar backup en entorno limpio.
   - Seguir Runbook de restauracion aplicable.
   - Medir tiempo real vs RTO objetivo (4 horas).

3. **Verificacion** (1 hora):
   - Checksum de todos los archivos restaurados.
   - `PRAGMA integrity_check` para SQLite.
   - Health checks completos.
   - Tests basicos de funcionalidad.

4. **Documentacion** (30 minutos):
   - Registrar: fecha, backup usado, tiempo real, errores encontrados.
   - Comparar con RPO objetivo (1 hora).
   - Documentar hallazgos.

### Criterio de exito

- Tiempo total < RTO (4 horas).
- Datos perdidos < RPO (1 hora).
- Todos los health checks pasan.
- Checksum verificado.

### Fallback del drill

- Si la restauracion falla: documentar el fallo, escalar, corregir.
- Un drill fallido no es un fallo del sistema - es un hallazgo valioso.

## 8. Procedimientos de emergencia

### 8.1 Backup de emergencia (sin cron)

```bash
# Si el backup automatico falla, ejecutar manualmente
/opt/isabella/scripts/backup-sqlite.sh --emergency
```

### 8.2 Restore sin backup reciente

```bash
# Si no hay backup < RPO:
# 1. Usar el backup mas reciente disponible
# 2. Documentar la brecha de datos potencial
# 3. Notificar a stakeholders
# 4. Investigar causa de fallo de backup
```

### 8.3 Backup mientras el sistema esta corriendo

```bash
# SQLite es seguro para backup concurrente con WAL mode
# No requiere LOCK ni STOP
sqlite3 data/isabella.db "PRAGMA wal_checkpoint(TRUNCATE);"
# La copia es consistente al momento del checkpoint
```

## 9. Monitoreo de backups

| Metrica | Alerta si |
|---|---|
| Ultimo backup exitoso | > 2 horas atras |
| Tamanio del backup | < 1KB (posible vacio) o > 10GB (posible crecimiento anomalo) |
| Checksum verification | Falla |
| Tiempo de backup | > 10 minutos |
| Espacio en disco | < 10GB disponibles |

## 10. Notas importantes

- **NUNCA** restaurar sobre produccion sin aprobacion.
- **NUNCA** asumir que un backup es valido sin verificar checksum.
- **SIEMPRE** probar restauracion antes de necesitarla.
- Los backups deben estar en al menos 2 ubicaciones geograficas.
- Separar credenciales de backup del sistema que se esta respaldando.
- Los backups de datos CONFIDENTIAL y RESTRICTED deben estar cifrados.
