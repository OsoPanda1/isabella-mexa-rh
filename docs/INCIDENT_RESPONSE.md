# INCIDENT_RESPONSE.md — Isabella Villaseñor AI

## Severidades

| Nivel | Ejemplo | Acción |
|---|---|---|
| **SEV-1** | Clave comprometida, exfiltración | Aislamiento inmediato y revocación |
| **SEV-2** | Egress no autorizado, modelo adulterado | Congelar release y canary |
| **SEV-3** | Degradación, timeout, error de evidencia | Ticket y mitigación |
| **SEV-4** | Defecto documental | Corregir en siguiente release |

## Flujo de respuesta

```
DETECT -> CLASSIFY -> PRESERVE -> CONTAIN -> REVOKE
       -> ERADICATE -> RESTORE -> VERIFY -> REVIEW -> IMPROVE
```

## Kill-switch

El kill-switch de Isabella implementa un flujo de 10 pasos:

1. FREEZE_EGRESS — Bloquear toda salida de red no esencial
2. QUIESCE — Pausar workloads activos de forma ordenada
3. SNAPSHOT_METADATA — Preservar metadatos forenses
4. REVOKE_CAPABILITY — Revocar capability o release comprometida
5. ISOLATE_WORKLOAD — Aislar el workload afectado
6. VERIFY_TRUST_ROOT — Verificar trust root
7. RESTORE_KNOWN_GOOD — Restaurar versión conocida buena
8. HEALTH_CHECK — Ejecutar readiness y pruebas sintéticas
9. HUMAN_APPROVAL — Esperar aprobación para reanudar
10. RESUME — Reanudar tráfico gradualmente

## Reglas

- No purgar datos antes de preservar metadatos forenses mínimos
- No hacer reboot automático como primera respuesta
- El aislamiento afecta al workload comprometido, no necesariamente a todo el nodo
- Claves nuevas solo después de verificar trust root y bundle
- Toda recuperación tiene RTO/RPO, dueño operativo y prueba trimestral
