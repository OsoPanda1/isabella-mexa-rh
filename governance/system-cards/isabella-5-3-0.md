# System Card — Isabella 5.3.0

> **System Card**: describe el sistema completo (no solo el modelo): componentes,
> flujos de datos, controles de seguridad/gobernanza y supervisión humana.

## Arquitectura
- **Frontend:** React 19 + Vite (Vercel).
- **Backend:** Express (serverless vía `api/[...path].ts`).
- **Persistencia:** Neon (Postgres), Supabase (identidad/estado), Redis
  (rate-limit distribuido).
- **Billing:** Stripe (pagos reales; sin mock).
- **Governance:** `src/lib/governance/` (runtime) + `governance/` (artefactos).

## Flujos de datos
1. Solicitud de usuario → autenticación → autorización por rol.
2. Gobernanza: provenance + approval gate en rutas de alto impacto.
3. Inferencia → evaluación epistémica → respuesta con metadata de provenance.
4. Billing: checkout Stripe → webhook verificado → aplicación de plan.

## Controles de seguridad
- Secretos solo en `.env.local` (nunca en el repo).
- Aislamiento de tenants (`tenant-isolation`) con tests (AI-RISK-0001).
- Kill switch con pasos secuenciales y aprobación (SEV-1/SEV-2).
- Ledger con checksum y verificación.
- Redis real distribuido; fallback a Upstash/memoria solo fuera de producción.

## Supervisión humana (H0-H4)
| Nivel | Definición | Ejemplo |
|-------|-----------|---------|
| H0 | Sin impacto: automatización | resúmenes |
| H1 | Revisión posterior por muestreo | moderación |
| H2 | Aprobación humana requerida | despliegue de política |
| H3 | Doble aprobación independiente | deploy productivo crítico |
| H4 | Decisión humana exclusiva | liquidaciones/payouts |

Ver `src/lib/governance/human-approval.ts` y `governance/human-oversight/`.

## Cambios y despliegue
Cambios de modelo/policy/tool exigen change record y readiness:
ver `src/lib/governance/change.ts` y `governance/change-records/`.
