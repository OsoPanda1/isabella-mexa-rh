# Model Card — isabella-sovereign

> **Model Card** requerida por transparencia de IA (UNESCO/ONU). Describe el
> modelo, su propósito, limitaciones y evaluación. NO substituye a la
> certificación ni otorga garantías de exactitud.

| Campo | Valor |
|-------|-------|
| Model ID | `isabella-sovereign` |
| Versión | 5.3.0 |
| Tipo | Modelo de lenguaje asistido por herramientas (inference engine) |
| Proveedor(s) | Configurable vía inventario de proveedores certificados |
| Fecha de revisión | 2026-08-30 |
| Curador | model-owner |

## Propósito
Asistencia de diálogo, seguimiento de contexto y ejecución de herramientas
dentro de una memoria condicionada por el usuario.

## Capacidades
- Razonamiento conversacional con seguimiento de contexto.
- Evaluación epistémica de salidas (incertidumbre explícita).
- Verificación de afirmaciones de alto riesgo vía claim radar.

## Limitaciones / Riesgos conocidos
- **Puede contener errores** o presentar alucinaciones; no se afirma "verificado"
  sin evidencia (ver AI-RISK-0002).
- Puede reflejar sesgos presentes en datos de entrenamiento (ver AI-RISK-0003).
- Fuera de distribución puede degradar (ver AI-RISK-0016).

## Evaluación
- Riesgo inherente: ver `governance/risk-register/`.
- Métricas de sesgo y exactitud: pendientes de `evidence_refs`.
- Supervisión humana: configurada (H0-H4, ver `governance/human-oversight/`).

## Uso recomendado
- No debe usarse para decisiones de alto impacto sin aprobación humana.
- Las salidas factuales deben acompañarse de provenance (ver
  `src/lib/governance/provenance.ts`).

## Uso prohibido
- Generar contenido discriminatorio, fraudulento o que suprima la supervisión
  humana. Ver `legal/ACCEPTABLE-USE-POLICY.md`.
