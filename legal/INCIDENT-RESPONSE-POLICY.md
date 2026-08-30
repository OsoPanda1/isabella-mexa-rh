# Incident Response Policy — Isabella

## Severidades
| Severidad | Criterio | Tiempo de respuesta objetivo |
|-----------|----------|------------------------------|
| `SEV-1` | Exposición de secretos, bypass de auth, pérdida financiera | Inmediato |
| `SEV-2` | Fallo de aislamiento de tenants, integridad de ledger, corrupción | < 4 h |
| `SEV-3` | Degradación de servicio o error de política no crítico | < 24 h |
| `SEV-4` | Defecto visual o documental | < 1 semana |

Implementación del clasificador: `src/lib/governance/incident.ts`.

## Runbook (fase secuencial)
1. `detecting` — detectar y documentar.
2. `containing` — contener el impacto.
3. `preserving` — preservar evidencia (logs con checksum).
4. `revoking` — revocar credenciales/capas afectadas (kill switch).
5. `notifying` — notificar a afectados/reguladores según obligación.
6. `correcting` — corregir causa raíz.
7. `verifying` — verificar remediación.
8. `postmortem` — revisión y registro.

## Kill switch
Los incidentes SEV-1/SEV-2 pueden activar el kill switch; su resolución exige
aprobación humana (ver `HUMAN-OVERSIGHT-POLICY.md` y el módulo kill-switch).

## Notificación de brecha (GDPR)
Notificación a la autoridad en ≤ 72 h y a los afectados cuando exista alto
riesgo, conforme a la normativa aplicable.
