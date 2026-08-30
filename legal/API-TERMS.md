# API Terms — Isabella

## Alcance
Estos términos rigen el uso de la API pública de Isabella (`/api/v1/*`) y sus
planes de suscripción.

## Uso
- Autenticación obligatoria; límites de uso según plan y rate-limit distribuido.
- El acceso se puede revocar ante abuso (ver `ACCEPTABLE-USE-POLICY.md`).

## Facturación
- Planes cobrados vía Stripe (ver `src/lib/billing/stripe.ts`). Precios
  públicos (más abajo). Sin datos "mock" para decisiones de cobro.
- Fallos de pago pueden conllevar la degradación o suspensión del servicio.

## Precios (USD / mes)
| Plan | Precio |
|------|--------|
| Plus | $15.00 |
| Premium | $22.49 |
| VIP | $37.49 |
| Enterprise | $112.50 |

(25% bajo el promedio de mercado; definidos en `src/lib/billing/stripe.ts`.)

## Disponibilidad (SLA)
No se garantiza una disponibilidad específica por defecto; los planes
Enterprise pueden tener SLA propio según contrato.

## Cambios
Los términos pueden cambiar con aviso razonable; el uso continuado implica
aceptación.

## Sin garantía de exactitud
La API entrega salidas de IA que **pueden contener errores**. Ver
`AI-TRANSPARENCY-NOTICE.md`.
