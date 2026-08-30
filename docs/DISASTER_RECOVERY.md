# DISASTER_RECOVERY.md — Isabella Villaseñor AI

## Objetivos

Cada servicio define RTO y RPO. RAID no sustituye backup.

| Componente | RTO | RPO | Backup Strategy |
|---|---|---|---|
| Ledger (BookPI) | 5 min | 0 (append-only) | Cifrado + offline |
| Trust roots | 15 min | 0 (inmutables) | Múltiples copias |
| Configuration | 30 min | 1 hora | Git + cifrado |
| Indexes (LITLE) | 30 min | 24 horas | Snapshot + digest |
| Models | 2 horas | release | Bundle firmado |

## Backups

- Backup cifrado y versionado
- Copia offline o inmutable
- Separación de credenciales
- Prueba de restauración trimestral
- Verificación de digest tras restaurar
- Registro de operador, fecha y resultado

## Rollback

1. Release anterior firmada disponible
2. Migraciones reversibles o snapshot
3. Imagen y modelo compatibles
4. Ventana de cambio definida
5. Criterios automáticos de abortar

## Restore drill

Ejecutar trimestralmente:
1. Restaurar desde backup en hardware limpio
2. Verificar integridad de hashes
3. Ejecutar health checks
4. Medir tiempo real vs RTO objetivo
5. Documentar resultado
