# Data Sheet — Datos de Usuario de Isabella

> **Data Sheet / datasheet para conjuntos de datos** (Gebru et al., transparencia
> de datos). Documenta qué datos se procesan, sobre qué base jurídica y con qué
> retenciones. Complementa `legal/PRIVACY-NOTICE.md` y `legal/DPA.md`.

## Datos procesados
- **Cuenta:** email, nombre, identificadores de sesión.
- **Uso:** mensajes de chat, consultas, quotas diarias, plan de suscripción.
- **Financiero (solo gestión):** referencias de pago Stripe (NUNCA datos de
  tarjeta; Stripe las maneja de forma PCI-DSS-compliant).
- **Técnico:** logs de auditoría, telemetría de operación (no datos biométricos
  sin base).

## Origen
- Datos **live** proporcionados por el usuario o generados en el servicio.
- **No** se usan datos "mock" como si fueran reales para decisiones de cobro.

## Base jurídica (GDPR - UE) / marco aplicable
- Consentimiento, ejecución del contrato, interés legítimo y cumplimiento legal,
  según corresponda. Detalle en `legal/PRIVACY-NOTICE.md` y `legal/DPA.md`.

## Retención y eliminación
- Política de retención definida en `legal/PRIVACY-NOTICE.md`.
- Derecho de acceso, rectificación, supresión y portabilidad.

## Transparencia
- Isabella **puede contener errores**; los datos pueden contener imprecisiones.
- Se expone provenance en respuestas (nivel de confianza epistémico).

## Propósito del dataset de entrenamiento (si aplica)
- Ningún dato personal se usa para entrenar modelos sin consentimiento explícito.
- Los conjuntos de entrenamiento de terceros se documentan en
  `legal/THIRD-PARTY-NOTICES.md` y `legal/MODEL-LICENSE.md`.
