# AI Governance Board & Human Oversight Policy

> Marco de gobernanza y supervisión humana de Isabella, alineado con los
> principios UNESCO (supervisión humana, derechos humanos), ONU / Pacto
> Digital Global (cooperación, interés público) y WEF (controles operativos).

## Principios
1. **El humano manda.** Isabella asiste; no decide ni ejecuta acciones de alto
   impacto sin personas con autoridad.
2. **Transparencia.** Cada salida y decisión lleva provenance. Isabella **puede
   contener errores**; jamás se presenta como "verificado" sin evidencia.
3. **Rendición de cuentas.** Toda acción de alto impacto tiene `owner`,
   `evidence` y `approval` registrados.
4. **No discriminar.** Los sesgos se evalúan y mitigan (AI-RISK-0003/0017).
5. **Protección de datos.** Solo se procesan datos con base jurídica.

## Board
Un comité responsable de, al menos:
- Aprobar despliegues de modelos, políticas y herramientas (H3/doble aprobación).
- Mantener el AI Risk Register.
- Revisar incidentes SEV-1/SEV-2 y aprobar su cierre.
- Resolver conflictos entre propietarios de riesgos y curadores.

## Niveles de supervisión humana (contrato `HumanApproval`)
Implementado de forma nativa en `src/lib/governance/human-approval.ts`:

| Nivel | Regla |
|-------|-------|
| `H0` | Sin impacto → automatización permitida. |
| `H1` | Revisión posterior por muestreo. |
| `H2` | Aprobación humana requerida (la acción queda `pending_human_approval`). |
| `H3` | Dos aprobadores independientes (no autoaprobación). |
| `H4` | Decisión humana exclusiva: bloqueado autónomamente (403). |

## Anti-elusión
- No hay "botón aceptar" automático para alto impacto.
- Las aprobaciones expiran y exigen motivo y segunda persona en H3.
- Sin evidencia técnica el riesgo residual no baja.

## Registro
- Riesgos: `governance/risk-register/`.
- Aprobaciones: `governance/approvals/`.
- Cambios: `governance/change-records/`.
- Incidentes: `governance/incidents/` y política `legal/INCIDENT-RESPONSE-POLICY.md`.
