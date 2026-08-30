# Blueprint Técnico: TAMV DM-X4™ + CATTLEYA™

## 1. Arquitectura de Despliegue
CATTLEYA™ es un microservicio integrado en la red de ISABELLA AI™, diseñado para emitir tarjetas virtuales y gestionar valor computacional.

### 1.1 Topología de Red
- **API Gateway:** Enruta peticiones a `/api/v1/cattleya`
- **Core TAMV:** Evalúa el estado emocional antes de aprobar transacciones.
- **Base de Datos:** PostgreSQL con tablas de `virtual_cards` y `card_transactions`.
- **Integración Pasarela:** Stripe Issuing / Proveedores financieros locales.

## 2. Flujo de Transacción Simbiótica
1. El usuario solicita emisión de tarjeta o pago.
2. ARGUS evalúa políticas de seguridad (KYC / AML).
3. SOPHIA e ISA evalúan el Vector de Auto-Percepción (SPV).
4. Si se aprueba, CATTLEYA™ ejecuta la API de Stripe Issuing.
5. El registro se guarda en la Memoria Episódica Afectiva (MEA) con firma SHA-256.

## 3. Modelo de Datos Financiero
### Tarjetas Virtuales (`virtual_cards`)
- `id`: UUID
- `user_id`: UUID
- `stripe_card_id`: String
- `spending_limit_daily`: Integer (Céntimos)
- `status`: 'active' | 'frozen'

### Transacciones (`card_transactions`)
- `id`: UUID
- `card_id`: UUID
- `amount`: Integer
- `emotion_context_id`: UUID (Referencia a estado afectivo)
- `crypto_hash`: String (SHA-256)

## 4. Orquestación y Seguridad
- **Cifrado en reposo:** AES-256-GCM.
- **Cifrado en tránsito:** mTLS, HTTPS.
- **Contenedores:** Kubernetes, Helm charts configurables.
