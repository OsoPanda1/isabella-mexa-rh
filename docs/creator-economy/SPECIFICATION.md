# Isabella Creator Economy — Especificación Técnica, Operativa y Legal

**Módulo:** `isabella-creator-economy` · **Versión:** 1.1.0
**Estado:** Implementación de referencia para producción y auditoría
**Moneda base:** MXN (soporte USD) · **Regla de oro:** ningún flujo financiero llega a producción sin superar los gates de auditoría contable, cumplimiento fiscal, ciberseguridad Zero-Trust e invariantes de supervisión humana.

---

## 1. Paradigma de flujo

```
USUARIO ──► ISABELLA COACH ──► ISABELLA STUDIO ──► APROBACIÓN HUMANA ──► DISTRIBUCIÓN
                                                                            │
OFERTA COMERCIAL ──► REGALO / VENTA / SUSCRIPCIÓN ──► LEDGER ──► RETENCIÓN/PAYOUT
```

Implementación nativa dentro del monolito Express existente (`server.ts`),
con persistencia SQLite (WAL) y degradación a memoria — sin servicios
externos obligatorios.

### Anti-patrones prohibidos (§1.3)

- **Venta de engagement artificial**: bloqueada técnica y
  determinísticamente en `plans.ts :: isProhibitedBoosterRequest` antes de
  cualquier ejecución de skill (vistas compradas, bots, engagement pods,
  hashtag spam, deepfakes, reseñas ficticias).
- **Promesa de rendimiento financiero**: la plataforma es productividad y
  comercio, no inversión.
- **Autonomía de publicación desatendida**: `social-connectors.ts ::
  schedulePublication` lanza `ApprovalRequiredError` sin sello
  `approvedByCreatorAt` — no existe ruta de ejecución silenciosa.
- **Extracción no autorizada de datos**: memorias y métricas emocionales
  jamás alimentan segmentación externa.

## 2. Mapa de módulos implementados

| Archivo | Responsabilidad |
|---|---|
| `src/lib/creator-economy/types.ts` | Contratos de dominio; dinero siempre en enteros (minor units) |
| `plans.ts` | Matriz de planes Free/Premium/Pro/Business; catálogo de skills con `modelDigest` SHA-256 congelado; política de boosters §4.2 |
| `tax-engine.ts` | SAT 2026: ISR 2.1%/20%, IVA retenido 50%/100%, validación RFC y CLABE (dígito verificador ponderado 3-7-1), metadata CFDI 4.0 |
| `revenue.ts` | Split exacto §6.3, comisión Stripe MX (3.6% + $3.00 + IVA de comisión), reserva contracargo 5%, asientos balanceados §7.3 |
| `ledger.ts` | Doble entrada append-only; `UnbalancedTransactionError` antes de escribir; reversión compensatoria; idempotencia |
| `skills-engine.ts` | Deducción atómica de créditos, reembolso compensatorio en falla de inferencia, gating por plan, refill mensual y top-up (vigencia 365d) |
| `payouts.ts` | Umbral $1,000 MXN / $50 USD, KYS level_2_full obligatorio, maduración T+90, idempotencia de solicitud |
| `economy-service.ts` | Regalos (catálogo RDM), ofertas marketplace (evidence, disclosure FTC), anti-fraude RISK_HOLD (spike 5×) |
| `social-connectors.ts` | OAuth2+PKCE (RFC 7636), token vault AES-256-GCM por registro, scopes mínimos, HITL estricto |
| `persistence/creator-economy-store.ts` | SQLite WAL / memoria; ledger append-only por construcción |
| `routes.ts` | Router Express `/api/v1/*` con `authenticate` + `requireScope` + SoD |

## 3. Planes y entitlements (§3.1)

| Dimensión | Free | Premium | Pro | Business |
|---|---|---|---|---|
| Cuota mensual | $0 | $499 | $1,499 | Custom |
| Créditos IA | 50 | 1,000 | 3,500 | 10,000+ |
| Canales sociales | 1 | 5 | 15 | ∞ |
| Ofertas activas | 0 | 3 | ∞ | ∞ + POS/ERP |
| Retención plataforma (regalos) | 30% | 15% | 10% | 5% |
| Payout | No | Sí (KYS) | Sí (KYS) | Prioritario |
| Aprobación humana | Siempre | Siempre | Reglas auto | Reglas corp. |

**Segregación de funciones (SoD §3.3):** el creador solicita payouts;
`POST /api/v1/payouts/:id/mark-paid` exige rol `operator` — un creador jamás
aprueba su propio payout. Ajustes contables manuales requieren firma dual
Finance + Compliance (Runbook R-02).

## 4. Elegibilidad de monetización (KYC/KYS §1.4)

Gate acumulativo implementado en `economy-service.ts :: submitKyc` y
`payouts.ts :: requestPayout`:

1. Identidad (INE/Pasaporte + comprobante < 3 meses) → `level_2_full`
2. RFC con homoclave (formato validado), e.firma, CFDI 4.0; W-8BEN/W-9 internacional
3. CLABE de 18 dígitos con dígito verificador válido, a nombre del titular
4. Antigüedad 14 días + cero violaciones activas

## 5. Motor tributario SAT 2026 (§8.1)

| Situación | ISR | IVA retenido |
|---|---|---|
| RFC validado + e.firma | 2.1% sobre base | 50% del IVA (8% del total) |
| Sin RFC / inválido | 20% sobre base | 100% del IVA (16% del total) |

Todos los cálculos en enteros con redondeo half-up por paso; sin flotantes
acumulados. Ejemplo verificado en tests: regalo $100.00 MXN → IVA $13.79,
base $86.21, ISR $1.81, IVA retenido $6.90.

## 6. Split de ingresos (§6.3) — ejemplo verificado

$$I_{neto} = M_{bruto} - T_{IVA} - C_{procesamiento} - C_{terceros} - R_{reserva}$$
$$P_{creador} = I_{neto} \times S_{plan} / 100$$

Regalo $100.00 MXN vía web, plan Premium (test
`reproduces the $100 MXN gift Premium case exactly`):

| Partida | MXN |
|---|---|
| IVA incluido | $13.79 |
| Base gravable | $86.21 |
| Comisión Stripe (3.6% + $3.00 + IVA comisión) | $7.66 |
| Reserva contracargo 5% | $4.31 |
| Neto distribuible | $74.24 |
| **Creador (85%)** | **$63.10** |
| Plataforma (15%) | $11.14 |

## 7. Ledger doble entrada append-only (§7)

- Nunca UPDATE/DELETE: correcciones = transacciones compensatorias
  (`reverseTransaction`).
- `postTransaction` verifica Σdébitos = Σcréditos **antes** de escribir; un
  asiento descuadrado jamás toca el store (`FATAL_UNBALANCED_ENTRY`).
- Idempotencia por `idempotencyKey` — reintentos no duplican asientos.
- `auditLedger()` lista transacciones descuadradas (métrica
  `ledger_unbalanced_events_total`).

### Asiento de venta (verificado en tests)

```
DÉBITO  customer_cash_clearing   neto_liquidado   (cash que entra)
DÉBITO  payment_processor_expense fee_pasarela    (gasto)
CRÉDITO customer_cash_clearing   fee_pasarela     (retenido en origen)
CRÉDITO tax_vat_payable          IVA
CRÉDITO chargeback_reserve_held  reserva 5%
CRÉDITO creator_payable_pending  share creador
CRÉDITO platform_revenue_gross   share plataforma
```

Con terceros (app store): líneas adicionales gasto/clearing por `C_terceros`.

## 8. Payouts (§8.3)

- Umbral: $1,000.00 MXN / $50.00 USD de saldo liberado
- Ciclo: corte día 25 → auditoría 26–28 → dispersión SPEI días hábiles 1–3
- Reserva contracargo madura T+90 (`maturePendingBalances`)
- Solicitud idempotente: mismo `idempotencyKey` devuelve el payout original
  sin doble dispersión (test `is idempotent`).

## 9. Seguridad IA / MCP (§9)

- **El LLM nunca mueve dinero**: no existe tool `execute_payout` en el
  contexto del modelo; los pagos son rutas Express con auth + scope + rol.
- **Zero Trust Input**: contenido externo clasificado como no confiable
  (prompt-injection guard global en `server.ts`).
- **Human-in-the-loop (Art. 14 AI Act / LFPDPPP)**: publicación externa y
  acciones comerciales requieren evento `USER_APPROVAL` autenticado.
- **Token vault**: refresh tokens cifrados AES-256-GCM por registro;
  `CREATOR_VAULT_KEY` (32 bytes hex/base64) requerido en producción.

## 10. Cumplimiento comercial (§10)

- **PROFECO**: precios finales con IVA desglosado antes del pago
  (`buyerMessage` incluye "IVA incluido").
- **FTC**: ofertas tipo `sponsorship` no se activan sin
  `sponsorshipDisclosed: true` (#PublicidadPagada).
- **Sin dark patterns**: cancelación y precios claros por contrato de API.
- **Anti-fraude §10.3**: spike de velocidad 5× dispara `RISK_HOLD_EVENT`;
  notificación inmediata, 10 días hábiles de aclaración, dictamen de
  Compliance en 15 días.

## 11. API REST (`/api/v1`)

| Endpoint | Auth | Scope |
|---|---|---|
| `GET /creator/profile` | ✓ | — |
| `POST /creator/plan` | operator | — |
| `POST /creator/kyc` | ✓ | `creator:kyc` |
| `GET /creator/fiscal-summary` | ✓ | — |
| `GET /skills` | público | — |
| `POST /skills/:id/execute` | ✓ | `skills:execute` |
| `GET /marketplace/offers` | público | — |
| `POST /marketplace/offers` | ✓ | `marketplace:create` |
| `POST /marketplace/offers/:id/activate` | ✓ | `marketplace:create` |
| `POST /marketplace/offers/:id/purchase` | ✓ | `marketplace:purchase` |
| `GET /gifts` | público | — |
| `POST /gifts/:id/purchase` | ✓ | `gifts:purchase` |
| `POST /payouts/request` | ✓ | `payouts:request` |
| `POST /payouts/:id/mark-paid` | operator | — (SoD) |
| `GET /channels` | ✓ | — |
| `GET /channels/:provider/authorize` | ✓ | — (PKCE) |
| `POST /channels` | ✓ | `channels:connect` |
| `DELETE /channels/:id` | ✓ (owner) | — |
| `POST /publications` | ✓ | `channels:publish` |
| `GET /ledger/audit` | operator | — |

## 12. Runbooks

### R-01 Dispersión mensual de payouts
1. Conciliación Stripe/SPEI en SUCCESS; `GET /api/v1/ledger/audit` → `balanced: true`
2. Congelar saldos al corte (día 25, 23:59 UTC)
3. Calcular retenciones SAT del periodo (tax-engine)
4. Construir batch idempotente (`buildPayoutBatch`)
5. Dispersar SPEI firmado (KMS) y `markPayoutPaid` con referencia

### R-02 Inconsistencia financiera
1. `ledger_unbalanced_events_total > 0` → circuit breaker congela payouts y regalos
2. Localizar `transaction_id` en logs (`FATAL_UNBALANCED_ENTRY`)
3. Cuentas involucradas → `HELD_FOR_REVIEW`
4. Asiento compensatorio manual con firma dual Finance + Compliance
5. Reiniciar y desactivar circuit breaker

### R-03 Congelamiento RISK_HOLD
1. Notificar al creador (dashboard + correo)
2. Ventana de aclaración: 10 días hábiles
3. Dictamen Compliance ≤ 15 días: liberar o reembolsar a compradores

## 13. Métricas Prometheus (referencia)

```
isabella_active_creators{plan="premium"} gauge
isabella_ledger_balance_check_status gauge        # 1 = cuadrado
isabella_ledger_unbalanced_events_total counter
isabella_payout_processing_seconds histogram
isabella_skill_executions_total{skill,status} counter
isabella_risk_hold_events_total counter
```

## 14. Criterios de aceptación (§14) — estado de implementación

- [x] Premium desbloquea funcionalidades sin promesas engañosas
- [x] Skills descuentan créditos atómicamente y validan presupuesto antes de inferir
- [x] Reembolso compensatorio de créditos en falla de inferencia
- [x] Boosters de inflado artificial rechazados antes de ejecución
- [x] Publicación externa exige firma de aprobación del creador
- [x] Ledger mantiene balance cero bajo transacciones concurrentes (idempotencia + pre-validación)
- [x] Motor tributario SAT 2026 (ISR 2.1/20%, IVA 50/100%)
- [x] Tools financieras fuera del contexto LLM (aislamiento MCP)

**Firma de arquitectura:** Edwin Oswaldo Castillo Trejo (Anubis Villaseñor) — Ecosistema TAMV / RDM Digital Hub
**Implementación:** OpenHands (agente) — commit en rama `evolution/auth-voice-language-hardening`.
