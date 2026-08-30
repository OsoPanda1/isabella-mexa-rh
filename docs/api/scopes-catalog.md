# Catálogo de Scopes — Isabella Villaseñor AI v2

> Versión: 2.0.0 · Última actualización: 2026-08-23
> Motor: `scripts/authz/isabella_scope_engine_v2.py`
> Catálogo: `scripts/authz/isabella_scopes_catalog_v2.json`
> Pruebas: `scripts/authz/test_isabella_scope_engine_v2.py` (15 tests)

---

## Modelo de Autorización

La autorización en Isabella **nunca depende de un solo scope**. La decisión es la intersección de:

```
identidad + tenant + scope + rol + assurance + sesión + step-up + recurso + presupuesto + política
```

**Propiedades de seguridad:**
- **Deny by default** — toda request es denegada a menos que TODOS los checks pasen
- **Wildcard restringido** — `*` solo funciona para principals con rol `system`
- **Sin elevación** — un principal nunca puede ampliar sus propios scopes
- **Aislamiento de tenant** — `principal.tenantId == resource.tenantId` para scopes tenant-bound
- **Fail-closed** — ante ambigüedad, denegar
- **Replay protection** — jti consumido una sola vez dentro de su ventana de validez
- **Auditoría tamper-evident** — cada decisión genera un evento con SHA3-512 digest

### Pipeline de Autorización

```
JWT / Principal
      │
      ▼
┌───────────────────┐
│ Token Validation   │  iss / aud / iat / exp / jti / tenantId
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Replay Protection  │  jti + exp + ReplayStore (SET NX + TTL en producción)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Scope Resolution   │  exact match — wildcard solo para system
└─────────┬─────────┘
          │
     denied → AUDIT → DENY
          │
          ▼
┌───────────────────┐
│ Role Evaluation    │  rank: citizen(1) → agent(2) → operator(3) → admin(4) → governance_admin(5) → system(6)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Assurance Check    │  local(1) ≤ mTLS(2) ≤ hardware-backed(3)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Tenant Binding     │  principal.tenantId == resource.tenantId
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Step-Up            │  WebAuthn / HSM / TEE
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Dual Control       │  dos aprobaciones independientes requeridas
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ AUTHORIZATION      │  ALLOW / DENY + obligations + audit event
│    DECISION        │
└───────────────────┘
```

---

## Niveles de Garantía (Assurance)

| Nivel | Rango | Descripción |
|---|---|---|
| `local` | 1 | JWT estándar sobre HTTPS. Suficiente para lecturas y writes de bajo riesgo dentro de un tenant. |
| `mtls` | 2 | Mutual TLS con certificado de cliente. Requerido para llamadas cross-service, configuración de providers y operaciones de riesgo medio. |
| `hardware-backed` | 3 | Identidad respaldada por hardware via WebAuthn, HSM o TEE. Requerido para cambios de política, kill-switch, gestión de claves y toda operación crítica. |

---

## Roles

| Rol | Rango | Descripción |
|---|---|---|
| `citizen` | 1 | Usuario final. Acceso de lectura a datos de su tenant. |
| `agent` | 2 | Agente automatizado con acceso de escritura acotado. |
| `operator` | 3 | Operador de sistema. Puede gestionar tools, quantum jobs y automatización. |
| `admin` | 4 | Acceso administrativo. No puede cambiar política ni gestionar secretos. |
| `governance_admin` | 5 | Autoridad de política y gobernanza. Requiere step-up hardware-backed. |
| `system` | 6 | Principal automatizado del sistema. Único rol que puede usar wildcard `*`. |

---

## Catálogo de Scopes

### Memory

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `memory:read` | citizen | local | sí | no | no | low |
| `memory:write` | citizen | local | sí | no | no | medium |
| `memory:admin` | operator | mTLS | sí | no | no | high |

### Audit

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `audit:read` | citizen | local | sí | no | no | low |
| `audit:write` | system | local | sí | no | no | medium |

### Tools

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `tools:execute` | operator | local | sí | no | no | medium |
| `tools:admin` | admin | hardware-backed | sí | sí | no | critical |

### Quantum

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `quantum:execute` | operator | mTLS | sí | no | no | medium |
| `quantum:submit` | operator | mTLS | sí | no | no | medium |
| `quantum:status` | citizen | local | sí | no | no | low |
| `quantum:admin` | governance_admin | hardware-backed | sí | sí | sí | critical |
| `quantum:registry` | operator | mTLS | sí | no | no | medium |
| `quantum:schedule` | operator | mTLS | sí | no | no | medium |
| `quantum:supervise` | operator | mTLS | sí | no | no | medium |
| `quantum:qiskit` | operator | mTLS | sí | no | no | medium |
| `quantum:lightning` | operator | mTLS | sí | no | no | medium |
| `quantum:braket` | operator | mTLS | sí | sí | no | high |
| `quantum:rigetti` | operator | mTLS | sí | sí | no | high |
| `quantum:catalyst` | operator | mTLS | sí | no | no | medium |
| `quantum:gpu` | operator | mTLS | sí | no | no | medium |
| `quantum:remote` | operator | mTLS | sí | sí | no | high |

### Crypto / HSM / TEE

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `crypto:sign` | operator | hardware-backed | sí | no | no | high |
| `hsm:sign` | governance_admin | hardware-backed | sí | sí | no | critical |
| `tee:verify` | operator | hardware-backed | sí | no | no | high |

### Identity / Consent

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `identity:read` | citizen | local | sí | no | no | low |
| `consent:write` | citizen | local | sí | no | no | medium |

### Orchestration / Agent

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `orchestration:plan` | operator | local | sí | no | no | medium |
| `agent:lease` | operator | local | sí | no | no | medium |
| `agent:chat` | citizen | local | sí | no | no | medium |

### Chat / Models / Territory

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `chat:read` | citizen | local | sí | no | no | low |
| `chat:write` | citizen | local | sí | no | no | medium |
| `models:read` | citizen | local | sí | no | no | low |
| `territory:read` | citizen | local | sí | no | no | low |

### Billing / Economy

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `billing:read` | citizen | local | sí | no | no | low |
| `billing:checkout` | citizen | mTLS | sí | sí | no | high |
| `economy:purchase` | citizen | mTLS | sí | sí | no | high |

### DAO / Registry / Governance

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `dao:vote` | citizen | local | sí | no | no | medium |
| `dao:write` | operator | mTLS | sí | no | no | high |
| `registry:write` | operator | mTLS | sí | no | no | high |
| `governance:read` | citizen | local | sí | no | no | low |

### Claims / Automation

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `claim:evaluate` | operator | local | sí | no | no | medium |
| `claim:admin` | admin | mTLS | sí | no | no | high |
| `automation:read` | citizen | local | sí | no | no | low |
| `automation:execute` | operator | mTLS | sí | no | no | high |

### Events / Ledger / Policy / Storage / Federation / Recovery

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `events:write` | agent | local | sí | no | no | medium |
| `ledger:read` | citizen | local | sí | no | no | low |
| `policy:evaluate` | operator | mTLS | sí | no | no | medium |
| `storage:write` | system | mTLS | sí | no | no | high |
| `backup:write` | system | mTLS | sí | no | no | high |
| `telemetry:write` | system | local | no | no | no | low |
| `federation:replicate` | system | mTLS | no | no | no | high |
| `recovery:activate` | operator | hardware-backed | no | sí | sí | critical |

### Emergency

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `kill-switch:activate` | system | hardware-backed | no | sí | sí | critical |
| `kill-switch:resolve` | admin | hardware-backed | no | sí | sí | critical |

### Admin

| Scope | Rol mín. | Garantía | Tenant-bound | Step-up | Dual-control | Riesgo |
|---|---|---|---|---|---|---|
| `admin:policy` | governance_admin | hardware-backed | sí | sí | sí | critical |
| `admin:tenant` | admin | hardware-backed | no | sí | no | high |
| `admin:secrets` | governance_admin | hardware-backed | sí | sí | sí | critical |
| `admin:keys` | admin | hardware-backed | sí | no | no | critical |

---

## Reglas de Seguridad

### Wildcard `*`

- Solo un principal con rol `system` en ambiente `production` puede usar `*`
- Un `admin` ordinario recibe `WILDCARD_DENIED`
- Un `governance_admin` recibe `WILDCARD_DENIED`
- Esto previene la escalada de privilegios via scope wildcard

### Tenant Binding

- Para scopes con `tenantBound: true`, `resource.tenantId` debe coincidir con `principal.tenantId`
- Cross-tenant produce `TENANT_BOUNDARY_VIOLATION`
- Esto es la capa de aplicación; la barrera definitiva es PostgreSQL RLS / Supabase RLS

### Replay Protection

- Cada JWT debe tener un `jti` único
- El `jti` se consume una sola vez durante la ventana `[iat, exp]`
- En despliegue horizontal: usar Redis SET NX + TTL, o DynamoDB, o similar

### Step-Up

- Operaciones críticas requieren re-autenticación: WebAuthn, HSM PIN, o TEE attestation
- Aplica a: `tools:admin`, `quantum:braket`, `quantum:rigetti`, `quantum:remote`, `quantum:admin`, `billing:checkout`, `economy:purchase`, `hsm:sign`, `kill-switch:*`, `admin:policy`, `admin:tenant`, `admin:secrets`, `recovery:activate`

### Dual Control

- Dos aprobaciones independientes requeridas para las operaciones más críticas
- Aplica a: `quantum:admin`, `kill-switch:activate`, `kill-switch:resolve`, `admin:policy`, `admin:secrets`, `recovery:activate`

---

## Uso del Motor

### CLI (stdin/stdout JSON)

```bash
echo '{"claims":{"sub":"u1","tenantId":"t1","scopes":["memory:read"],"roles":["citizen"],"iat":1700000000,"exp":1700003600,"jti":"j1","iss":"https://auth.isabella.ai","aud":"isabella-api"},"requiredScope":"memory:read","resourceTenant":"t1"}' \
  | python3 scripts/authz/isabella_scope_engine_v2.py scripts/authz/isabella_scopes_catalog_v2.json
```

### Python API

```python
import json
from isabella_scope_engine_v2 import ScopeAuthorizer

catalog = json.load(open("isabella_scopes_catalog_v2.json"))
auth = ScopeAuthorizer(catalog)

decision = auth.authorize(
    claims={"sub": "u1", "tenantId": "t1", "scopes": ["memory:read"], "roles": ["citizen"],
            "iat": 1700000000, "exp": 1700003600, "jti": "j1",
            "iss": "https://auth.isabella.ai", "aud": "isabella-api"},
    required_scope="memory:read",
    resource_tenant="t1"
)
print(decision.allowed)  # True
```

---

## Arquitectura de Producción Recomendada

```
                   ┌──────────────────────┐
                   │      API Gateway     │
                   └──────────┬───────────┘
                              │
                   JWT / mTLS / WebAuthn
                              │
                              ▼
                   ┌──────────────────────┐
                   │ Identity Verifier    │
                   │ JWKS / issuer/aud    │
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │ Policy Enforcement   │
                   │ Point                │
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │ Policy Decision      │
                   │ Point / OPA          │
                   └──────────┬───────────┘
                              │
             ┌────────────────┼─────────────────┐
             ▼                ▼                 ▝
          Memory           Tools            Quantum
             │                │                 │
             └────────────────┼─────────────────┘
                              ▼
                   ┌──────────────────────┐
                   │ Audit / Event Bus    │
                   └──────────┬───────────┘
                              ▼
                   ┌──────────────────────┐
                   │ Immutable Ledger     │
                   └──────────────────────┘
```

### Separación estricta de responsabilidades

| Componente | Responsabilidad |
|---|---|
| **JWT** | Identidad y atributos transportados |
| **Scope Engine / OPA** | Decisión de autorización |
| **HSM / WebAuthn / mTLS** | Assurance (garantía de identidad) |
| **RLS / DB** | Última barrera de aislamiento de datos |
| **Sandbox** | Aislamiento de ejecución |
| **Audit Ledger** | Evidencia posterior y tamper-evident |

### Componentes futuros

| Componente | Función |
|---|---|
| `isabella-identity-verifier` | Verificación de JWT / JWKS / mTLS certificates |
| `isabella-scope-authorizer` | Este motor (v2) |
| `isabella-policy-decision-point` | Evaluación de políticas OPA |
| `isabella-audit-ledger` | Registro inmutable de decisiones |
| `isabella-capability-broker` | Emisión de capacidades efímeras para LLM/tools |

### Capability Broker (modelo futuro)

```
LLM → "quiero ejecutar X"
  → Intent
    → Policy Engine (identity + scope + role + tenant + assurance + risk + evidence + budget + consent + state)
      → Capability Broker
        → Ephemeral Capability (limitada en tiempo, alcance y permisos)
          → Sandbox
            → Tool / Quantum / Memory / Federation
              → Result (provenance + digest + policy decision + audit event)
```

---

## Notas de Implementación

- **RLS como segunda barrera**: La autorización de aplicación nunca debe ser la única barrera de aislamiento. PostgreSQL RLS / Supabase RLS debe reforzar el tenant binding a nivel de datos.
- **Replay store distribuido**: En producción horizontal, el ReplayStore debe usar Redis `SET NX EX` o DynamoDB `PutItem` con条件 de no-existencia.
- **Audit integrity**: Cada evento de autorización incluye `eventDigest` (SHA3-512) para verificación de integridad. Encadenar con `previousEventDigest` para tamper-evidence.
- **Naming**: Los scopes usan formato `domain:action` (ej. `memory:read`). No confundir con scopes de consentimiento (`data`, `money`, `identity`, etc.) ni con scopes de memoria jerárquica (`immediate`, `session`, `project`, etc.), que viven en sistemas separados.
