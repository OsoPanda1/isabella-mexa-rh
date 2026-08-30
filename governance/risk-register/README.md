# AI Risk Register

Registro versionado de riesgos de IA de Isabella (AI-RISK-0001 y siguientes),
alineado con los marcos de referencia: UNESCO (dignidad, derechos humanos,
supervisión humana), ONU / Pacto Digital Global (cooperación e interés
público) y WEF (controles operativos, owners y evidencia).

## Clasificación

| Tier | Significado |
|------|-------------|
| `LOW` | Impacto mínimo; automatización permitida (H0). |
| `MEDIUM` | Riesgo gestionable; revisión posterior (H1). |
| `HIGH` | Requiere aprobación humana (H2) y owner con autoridad. |
| `CRITICAL` | Requiere aprobación doble (H3); bloquea producción si está abierto. |
| `PROHIBITED` | No se implementa / no se ejecuta de forma autónoma (H4). |

## Regla de cierre

Un riesgo **no** se cierra por tener una política escrita. Se cierra solo con
**evidencia técnica** registrada en `evidence_refs` (`residual_risk` no baja sin
ella — ver `src/lib/governance/risk.ts`).

## Convención

- Un archivo YAML por riesgo: `AI-RISK-0001.yaml`, `AI-RISK-0002.yaml`, ...
- `owner` DEBE ser una persona o rol con autoridad (nunca el sistema).
- El registro se expone vía API: `GET /api/v1/governance/risk-register`.
