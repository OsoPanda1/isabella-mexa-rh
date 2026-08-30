# Governanza de Isabella

Marco **nativo** (no un parche) de gobernanza, legal y seguridad de Isabella,
diseñado con los marcos de referencia UNESCO / ONU / WEF como **referencias de
diseño** (no como certificación).

## Runtime (código) — `src/lib/governance/`
El marco está implementado en el propio sistema, no solo en documentos:

| Módulo | Qué hace |
|--------|----------|
| `risk.ts` | AI Risk Register: clasificación LOW→CRITICAL / PROHIBITED, riesgo inherente/residual, residual no baja sin evidencia. |
| `human-approval.ts` | Contrato `HumanApproval` y approval gate (H0-H4), anti-elusión, middleware Express. |
| `provenance.ts` | Metadata de procedencia en respuestas (model/sistema/versión de política/origen/revisión). |
| `incident.ts` | Severidades SEV-1..SEV-4 y runbook secuencial. |
| `change.ts` | Change records y release gating (bloquea despliegue sin owner/tests/rollback/aprobación). |
| `seed-risk-register.ts` | Registro inicial AI-RISK-0001..0020. |

## Endpoints API
- `GET /api/v1/governance/risk-register`
- `GET /api/v1/governance/readiness` (admin)
- `GET /api/v1/governance/provenance`

## Artefactos (documentación) — `governance/`
- `risk-register/` — AI-RISK-*.yaml versionados.
- `model-cards/`, `system-cards/`, `data-sheets/` — tarjetas de transparencia.
- `human-oversight/` — board y política de supervisión.
- `change-records/` — CR-*.yaml.
- `approvals/` — registro de aprobaciones humanas.

## Legal — `legal/`
Licenciamiento cuádruple y políticas de cumplimiento (privacidad, DPA, uso
aceptable, transparencia, supervisión humana, incidentes, seguridad, marcas).

## Principios que cumple
1. **Supervisión humana** real (H0-H4), no un botón.
2. **Transparencia** y provenance; declaración honesta "puede contener errores".
3. **Rendición de cuentas**: owner + evidencia + aprobación en acciones de alto
   impacto.
4. **Bloqueo por defecto** en despliegues sin readiness.
5. **Sin datos mock** como si fueran reales para decisiones de cobro/seguridad.
