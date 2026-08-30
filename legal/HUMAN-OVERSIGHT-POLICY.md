# Human Oversight Policy — Isabella

> La supervisión humana es un control nativo (no un parche). Su implementación
> se encuentra en `src/lib/governance/human-approval.ts` (contrato
> `HumanApproval`) y su marco institucional en
> `governance/human-oversight/governance-board.md`.

## Niveles de supervisión
| Nivel | Regla | Código |
|-------|-------|--------|
| `H0` | Sin impacto: automatización permitida | `OVERSIGHT_ORDER.H0` |
| `H1` | Revisión posterior por muestreo | 1 |
| `H2` | Aprobación humana requerida (quedará `pending_human_approval`) | 2 |
| `H3` | Doble aprobación independiente | 3 |
| `H4` | Decisión humana exclusiva; bloqueado (403) | 4 |

## Requisitos de una aprobación válida
- Persona con **autoridad** (`reviewerSubject` + `reviewerRole`).
- **Motivo** obligatorio en aprobaciones.
- **Caducidad** (`expiresAt`): una aprobación vencida no cuenta.
- En `H3`: dos aprobadores **independientes** (no autoaprobación).

## Acciones de alto impacto
Son las que requieren `H2+` y, para decisión autónoma, `H4` (p. ej. despliegue
de modelos en producción, liquidaciones/payouts, cambio de política). Si se
intentan ejecutar sin aprobación, el approval gate responde
`202 pending_human_approval` o `403 blocked`.

## Registro
Toda decisión humana queda auditable en `governance/approvals/`.
