# Component Status Matrix — Isabella Villaseñor AI

**Fecha:** 20 agosto 2026 · **Metodología:** Auditoría de código + evidencia de implementación + pruebas automatizadas.

## Taxonomía de Madurez

| Estado | Definición | Requisito |
|---|---|---|
| **CONCEPTUAL** | Diseñado en docs/contratos; sin código | Arquitectura definida |
| **MOCK** | Stub con datos hardcodeados para desarrollo | Código existe, no es funcional |
| **SIMULATED** | Implementación deliberada con hash/Math.random(); no es seguridad real | Requiere FEATURE_LAB_MODE=true para activar |
| **INTEGRATED** | Código funcional con integración parcial; puede faltar persistencia o tests | Funciona en dev, sin verificación completa |
| **TESTED** | Implementación funcional con suite de pruebas automatizadas que validan comportamiento | Tests pasan en CI |
| **PRODUCTION** | Implementada, probada, con evidencia operacional y controls de seguridad verificados | Pruebas + auditoría + monitoreo |

---

## 1. Identidad y Seguridad

| Componente | Estado | Archivo | Evidencia |
|---|---|---|---|
| JWT HS256 Auth | **TESTED** | `src/lib/auth.server.ts` | 8 tests en `tests/auth.test.ts` |
| CORS Whitelist | **INTEGRATED** | `api/[...path].ts` | Configurable via CANONICAL_ORIGINS. Sin tests negativos de bypass. |
| Rate Limiting | **INTEGRATED** | `server.ts` | In-memory sliding window. Sin tests de rate limit. |
| Dev Auth Fallback | **TESTED** | `auth.server.ts` | Tests verifican que requiere ALLOW_DEV_AUTH_FALLBACK=true |
| AuthorizationContext | **TESTED** | `src/lib/authz/` | 14 tests en `tests/security/authz-bypass.test.ts` |
| Policy Engine | **TESTED** | `src/lib/authz/policy-engine.ts` | 14+8+9 tests cross-file (bypass, cross-tenant, escalation) |
| WebAuthn | **CONCEPTUAL** | — | Mencionado en roadmap; sin implementación. |
| mTLS | **CONCEPTUAL** | — | Diseñado en arquitectura; sin implementación. |

## 2. Criptografía

| Componente | Estado | Archivo | Evidencia |
|---|---|---|---|
| ML-KEM-768 (Kyber) | **SIMULATED** | `src/lib/postQuantumCrypto.ts` | Hash-based mock. REQUIERE `FEATURE_LAB_MODE=true`. |
| ML-DSA-87 (Dilithium) | **SIMULATED** | `src/lib/postQuantumCrypto.ts` | `hash(secret ‖ message)` — NO es firma válida. |
| SLH-DSA-128s (SPHINCS+) | **SIMULATED** | `src/lib/postQuantumCrypto.ts` | Deterministic hash. |
| LITLE-32 Gates | **SIMULATED** | `src/lib/postQuantumCrypto.ts` | 32 compuertas deterministas. |

**⚠ PROHIBIDO activar sin FEATURE_LAB_MODE=true. Producción requiere librería PQC auditada (liboqs, pqcrypto).**

## 3. Hardware Security

| Componente | Estado | Archivo | Evidencia |
|---|---|---|---|
| HSM Client (Node.js) | **SIMULATED** | `src/lib/quantum/hsm-client.ts` | SHA-256 simulated signing. Requiere `FEATURE_LAB_MODE=true`. |
| HSM Client (Browser) | **SIMULATED** | `src/lib/hsmClient.ts` | Dual YubiHSM simulator con `Math.random()`. |
| HSM Failover Monitor | **SIMULATED** | `src/lib/hsmFailoverMonitor.ts` | Monitoreo del HSM simulator. |
| TEE Attestation | **SIMULATED** | `src/lib/quantum/tee-attestation.ts` | SHA-256 chain mock. Requiere `FEATURE_LAB_MODE=true`. |

**⚠ HSM y TEE son simuladores. Ningún claim de "HSM-backed" es válido sin hardware real.**

## 4. Quantum Mesh

| Componente | Estado | Archivo | Evidencia |
|---|---|---|---|
| Device Registry | **TESTED** | `quantum/device-registry.ts` | Smoke test verifica imports. |
| Orchestrator | **INTEGRATED** | `quantum/orchestrator.ts` | Pipeline de 13 pasos. Sin tests de integración. |
| Scheduler | **INTEGRATED** | `quantum/scheduler.ts` | Cola FIFO, backoff. Sin tests. |
| Worker Manager | **INTEGRATED** | `quantum/worker-manager.ts` | 6 pools, heartbeat. Sin tests. |
| Event Bus | **TESTED** | `quantum/event-bus.ts` | SQLite-backed, hash chain. 3 tests en persistence.test.ts. |
| Telemetry | **TESTED** | `quantum/telemetry.ts` | SQLite-backed counters, histograms, spans. 4 tests. |
| Recovery | **INTEGRATED** | `quantum/recovery.ts` | 7 tipos de incidentes. Actions son strings descriptivos. |
| Policy Engine | **INTEGRATED** | `quantum/policy-engine.ts` | 10 reglas de evaluación. Sin tests específicos. |
| BookPI Chain | **TESTED** | `quantum/bookpi-quantum.ts` | SQLite-backed append-only. 4 tests de integridad. |
| Federation | **CONCEPTUAL** | — | Quórum 5/7 diseñado. Consenso real no implementado. |
| PennyLane Bridge | **EXTERNAL** | `quantum-bridge.server.ts` | Requiere Python + PennyLane instalado. |
| Qiskit | **EXTERNAL** | — | Requiere IBM_Q_CREDENTIALS. |
| Braket | **EXTERNAL** | — | Requiere AWS_BRAKET_CREDENTIALS. |

## 5. AI / Cognitive

| Componente | Estado | Archivo | Evidencia |
|---|---|---|---|
| Cognitive Pipeline | **INTEGRATED** | `processPerception.ts` | 6-step pipeline. Sin tests de integración. |
| Memory Store | **TESTED** | `memory-store.ts` | SQLite-backed con fallback. 6 tests en persistence.test.ts. |
| Audit Tracer | **TESTED** | `audit-tracer.ts` | SQLite-backed con fallback. 3 tests en persistence.test.ts. |
| Tools Catalog | **INTEGRATED** | `tools-catalog.ts` | Tool definitions con scopes. Sin tests de validación. |
| Image Generation | **EXTERNAL** | `server.ts` | Gemini → Imagen 3.0 → Pollinations. |
| Voice/TTS | **EXTERNAL** | `server.ts` | Gemini TTS → Web Speech API. |

## 6. Automation Mesh

| Componente | Estado | Archivo | Evidencia |
|---|---|---|---|
| Registry (30+ nodes) | **TESTED** | `automation/registry.ts` | 8 tests en automation.test.ts. |
| Self-Healing Engine | **TESTED** | `automation/mesh.ts` | Health checks, repair chains. Verificado por tests. |
| Human Interface | **TESTED** | `automation/human-interface.ts` | NLP parser, describeProblem. Verificado por tests. |

## 7. Claim Radar / MCP

| Componente | Estado | Archivo | Evidencia |
|---|---|---|---|
| MCP Contracts V2 | **TESTED** | `claim-radar/contracts.ts` | Zod schemas validados. |
| Zenodo Adapter V2 | **TESTED** | `mcp-adapters/zenodo-mcp-adapter.ts` | 7 tests con mocks. Retrieval ≠ verification enforced. |
| LITLE Adapter V2 | **TESTED** | `mcp-adapters/litle-mcp-adapter.ts` | Dense retrieval con validación de modelo. |
| MCP Hub | **TESTED** | `mcp-adapters/mcp-hub.ts` | Router con health checks. |
| Claim Radar Engine | **TESTED** | `claim-radar/claim-radar.ts` | 5 tests con high-risk rules. |
| Epistemic Governance | **TESTED** | `epistemic/epistemic-governance.ts` | 5 tests de clasificación. |
| Kill-Switch | **TESTED** | `kill-switch/kill-switch.ts` | 7 tests del flujo de 10 pasos. |

## 8. Persistencia

| Componente | Estado | Archivo | Evidencia |
|---|---|---|---|
| SQLite Layer | **TESTED** | `src/lib/persistence/sqlite.ts` | createRequire, WAL mode, 7 tablas. |
| In-Memory Fallback | **TESTED** | (todas las capas) | Graceful fallback cuando better-sqlite3 no disponible. |
| PostgreSQL/TimescaleDB | **CONCEPTUAL** | `src/data/` | Schemas definidos. Sin conexión en runtime. |
| Redis Cache | **CONCEPTUAL** | — | Mencionado; sin implementación. |

## 9. CI/CD

| Componente | Estado | Archivo | Evidencia |
|---|---|---|---|
| GitHub Actions CI | **TESTED** | `.github/workflows/ci.yml` | Typecheck + 94 tests + build. |
| Vitest Suite | **TESTED** | `tests/*.test.ts` | 94 tests en 11 archivos: auth, kill-switch, MCP, claim-radar, epistemic, automation, lab-mode, persistence (6), security (31). |
| Docker | **CONCEPTUAL** | — | Sin Dockerfile en repositorio. |
| Kubernetes | **CONCEPTUAL** | — | Sin manifests. |

## 10. Infraestructura

| Componente | Estado | Archivo | Evidencia |
|---|---|---|---|
| Vercel Deployment | **INTEGRATED** | `vercel.json` + `api/[...path].ts` | Serverless API + SPA. |
| Express Server | **INTEGRATED** | `server.ts` | Backend monolítico ~1700 líneas. |
| Vite SPA | **INTEGRATED** | `src/` | React 19 + Tailwind 4. |

## 11. Documentación Operativa

| Documento | Estado | Ubicación |
|---|---|---|
| OpenAPI Spec | **TESTED** | `docs/api/openapi.yaml` |
| Scopes Catalog | **TESTED** | `docs/api/scopes-catalog.md` |
| Error Model | **TESTED** | `docs/api/error-model.md` |
| Threat Model | **TESTED** | `docs/THREAT_MODEL.md` |
| Data Classification | **TESTED** | `docs/security/data-classification.md` |
| Key Management | **TESTED** | `docs/security/key-management.md` |
| SLO/SLI | **TESTED** | `docs/operations/slo-sli.md` |
| Runbooks | **TESTED** | `docs/operations/runbooks.md` |
| Backup/Restore | **TESTED** | `docs/operations/backup-restore.md` |
| ADR-0001 Package Manager | **TESTED** | `docs/adr/0001-package-manager.md` |
| ADR-0002 Auth Model | **TESTED** | `docs/adr/0002-auth-session-model.md` |
| ADR-0003 Tenant Isolation | **TESTED** | `docs/adr/0003-tenant-isolation.md` |
| ADR-0004 Evidence Ledger | **TESTED** | `docs/adr/0004-evidence-ledger.md` |
| ADR-0005 Agent Tool Policy | **TESTED** | `docs/adr/0005-agent-tool-policy.md` |
| ADR-0006 Quantum Boundary | **TESTED** | `docs/adr/0006-quantum-provider-boundary.md` |
| Target Architecture | **TESTED** | `docs/architecture/target-architecture.md` |
| Adapter Parity | **TESTED** | `docs/architecture/adapter-parity.md` |

---

## Resumen de Madurez

| Estado | Componentes | % |
|---|---|---|
| **CONCEPTUAL** | 7 | 13% |
| **MOCK** | 0 | 0% |
| **SIMULATED** | 6 | 11% |
| **INTEGRATED** | 14 | 26% |
| **TESTED** | 26 | 48% |
| **PRODUCTION** | 0 | 0% |
| **EXTERNAL** | 2 | 4% |

**Total: 53 componentes clasificados. Ninguno declarado como PRODUCTION sin evidencia verificada.**
