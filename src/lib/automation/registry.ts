/**
 * Isabella Automation Mesh — Registry
 * Mapa completo de todas las automatizaciones, sus archivos, dependencias
 * y descripciones humanas. Este es el "Atlas" que permite que la malla
 * entienda la complejidad sin que el humano tenga que hacerlo.
 */
import type { AutomationNode } from "./contracts";

/**
 * Atlas de automatizaciones: cada nodo sabe qué archivos lo componen,
 * de qué depende, quién depende de él, y cómo explicarlo a un humano.
 */
export const AUTOMATION_ATLAS: AutomationNode[] = [
  // ==========================================================================
  // CAPA 1: IDENTIDAD Y CONSENTIMIENTO
  // ==========================================================================
  {
    id: "A-identity",
    name: "Identity & Session",
    description: "WebAuthn, JWT HS256, sesiones de agente con TTL",
    category: "identity",
    complexity: "moderate",
    codeFiles: ["src/lib/auth.server.ts", "server.ts:479-551"],
    dependencies: [],
    dependents: ["B-consent", "C-policy", "F-quantum-gateway"],
    healthCheck: "POST /api/v1/auth/login returns 200 with valid JWT",
    repairProcedure: "Verify ISABELLA_AUTH_SECRET env var is set. Restart auth middleware. Check JWT expiry.",
    humanDescription: "La identidad y las sesiones de los usuarios. Si esto falla, nadie puede autenticarse.",
    developerGuide: "auth.server.ts maneja JWT HS256 con PBKDF2 para passwords. El dev fallback requiere ALLOW_DEV_AUTH_FALLBACK=true explícito.",
  },
  {
    id: "B-consent",
    name: "Consent Management",
    description: "Consentimiento del usuario para operaciones de riesgo",
    category: "consent",
    complexity: "simple",
    codeFiles: ["src/lib/isabella-crown.ts:109-116"],
    dependencies: ["A-identity"],
    dependents: ["C-policy"],
    healthCheck: "Consent flow returns authorization token for risky operations",
    repairProcedure: "Verify consent middleware is mounted. Check policy gate configuration.",
    humanDescription: "El sistema de permisos que pregunta al usuario antes de hacer cosas peligrosas.",
    developerGuide: "Define consentimiento como parte del pipeline cognitivo. Se evalúa antes de operaciones de riesgo medio/alto.",
  },
  {
    id: "C-policy",
    name: "ARGUS Policy Engine",
    description: "10 reglas de evaluación, Zero-Trust, scopes, roles",
    category: "policy",
    complexity: "complex",
    codeFiles: ["src/lib/quantum/policy-engine.ts", "src/domains/ai/infrastructure/policy-gate.ts"],
    dependencies: ["A-identity", "B-consent"],
    dependents: ["F-quantum-gateway", "H-scheduler", "O-cognitive"],
    healthCheck: "evaluateQuantumPolicy returns allow/deny/degraded for test request",
    repairProcedure: "Check policy rules in policy-engine.ts. Verify scopes are configured. Reset policy audit log if full.",
    humanDescription: "El guardián que decide qué está permitido y qué no. Evalúa cada operación antes de ejecutarla.",
    developerGuide: "policy-engine.ts tiene 10 reglas: tenant isolation, scopes, device check, wire limits, shot limits, mode compat, WebAuthn step-up, high-risk auth, secret validation. Audit log in-memory (1000 entries).",
  },
  {
    id: "D-intent",
    name: "Yun Orchestrator",
    description: "Planificación de intención cognitiva, routing de ejecución",
    category: "intent",
    complexity: "complex",
    codeFiles: ["src/lib/isabella-crown.ts", "src/domains/ai/application/handlers/processPerception.ts"],
    dependencies: ["C-policy"],
    dependents: ["O-cognitive", "F-quantum-gateway"],
    healthCheck: "processPerception returns structured response with tool calls",
    repairProcedure: "Verify CROWN gateway weights are configured. Check preset profiles. Restart cognitive pipeline.",
    humanDescription: "El cerebro que decide qué módulo usar para responder cada pregunta del usuario.",
    developerGuide: "El pipeline cognitivo de 6 pasos: Perceive → Remember → Policy Gate → Decide → Act → Audit → Trace. Los presets ajustan pesos de ISA/SOPHIA/ORION/ARGUS/CROWN.",
  },

  // ==========================================================================
  // CAPA 2: QUANTUM MESH
  // ==========================================================================
  {
    id: "E-device-registry",
    name: "Device Registry",
    description: "Registro de 7 proveedores cuánticos, smoke test, diagnósticos",
    category: "registry",
    complexity: "moderate",
    codeFiles: ["src/lib/quantum/device-registry.ts"],
    dependencies: [],
    dependents: ["F-quantum-gateway", "G-scheduler"],
    healthCheck: "getDeviceRegistry returns 7 devices with status",
    repairProcedure: "Run smoke test for each provider. Enable/disable based on results. Check env vars for remote providers.",
    humanDescription: "El registro de todos los dispositivos de computación cuántica disponibles.",
    developerGuide: "7 proveedores: local_simulator, lightning, qiskit, braket, rigetti, catalyst, remote_qpu. Smoke test verifica imports y versiones.",
  },
  {
    id: "F-quantum-gateway",
    name: "Quantum Gateway",
    description: "Entrada unificada a la malla cuántica, normalización de requests",
    category: "quantum",
    complexity: "complex",
    codeFiles: ["server.ts:executeQuantumMesh", "src/lib/quantum/orchestrator.ts"],
    dependencies: ["C-policy", "E-device-registry", "D-intent"],
    dependents: ["G-scheduler", "H-workers"],
    healthCheck: "POST /api/v1/quantum/execute returns valid response for test circuit",
    repairProcedure: "Verify orchestrator pipeline is wired. Check Zod contracts load. Restart quantum mesh.",
    humanDescription: "La puerta de entrada a toda la computación cuántica. Si esto falla, ningún trabajo cuántico se ejecuta.",
    developerGuide: "El gateway orquesta el pipeline de 13 pasos: validate → authorize → schedule → execute → sign → persist → replicate → reconcile.",
  },
  {
    id: "G-scheduler",
    name: "Quantum Scheduler",
    description: "Cola prioritaria (interactive/normal/batch), retry con backoff",
    category: "scheduler",
    complexity: "moderate",
    codeFiles: ["src/lib/quantum/scheduler.ts"],
    dependencies: ["F-quantum-gateway"],
    dependents: ["H-workers"],
    healthCheck: "Scheduler queue depth is within limits (< 64)",
    repairProcedure: "Purge expired jobs. Check queue limit config. Verify deadline enforcement.",
    humanDescription: "El planificador que decide qué trabajo se ejecuta primero y cuándo reintentar si falla.",
    developerGuide: "Cola FIFO por prioridad con límite de 64. Backoff progresivo: 30s × retryCount. Max 3 reintentos. Jobs expirados se purgan.",
  },
  {
    id: "H-workers",
    name: "Worker Manager",
    description: "6 pools de workers, heartbeat monitoring, reemplazo automático",
    category: "workers",
    complexity: "complex",
    codeFiles: ["src/lib/quantum/worker-manager.ts"],
    dependencies: ["G-scheduler", "E-device-registry"],
    dependents: ["I-pennylane", "J-qiskit", "K-braket", "L-rigetti", "M-catalyst", "N-lightning"],
    healthCheck: "Worker heartbeat check returns all workers alive (< 60s stale)",
    repairProcedure: "Kill hung workers (heartbeat > 60s). Spawn replacements. Check pool limits (min/max per pool).",
    humanDescription: "El gerente de los procesos que ejecutan los trabajos. Si un worker se congela, lo reemplaza automáticamente.",
    developerGuide: "6 pools: core, lightning, qiskit, braket, rigetti, catalyst. Cada uno tiene min/max instances, CPU/memory limits. Heartbeat check cada 60s.",
  },
  {
    id: "I-pennylane",
    name: "PennyLane Core",
    description: "Circuitos variacionales, simulación local, feature maps",
    category: "execution",
    complexity: "complex",
    codeFiles: ["src/lib/quantum-bridge.server.ts", "src/lib/quantum/core-registry.ts:28"],
    dependencies: ["H-workers"],
    dependents: [],
    healthCheck: "PennyLane bridge process responds to health check",
    repairProcedure: "Check Python PennyLane installation. Verify bridge script exists. Restart bridge process.",
    humanDescription: "El motor principal de computación cuántica. Simula circuitos cuando no hay hardware real.",
    developerGuide: "Spawns Python child process con policy evaluation, timeout con SIGKILL, stdout/stderr capture. Sin worker pool — un proceso por request.",
  },
  {
    id: "J-qiskit",
    name: "Qiskit Provider",
    description: "Backend IBM Qiskit, circuitos transpilados",
    category: "execution",
    complexity: "complex",
    codeFiles: ["src/lib/quantum/core-registry.ts:30"],
    dependencies: ["H-workers"],
    dependents: [],
    healthCheck: "Qiskit import check passes",
    repairProcedure: "Verify IBM_Q_CREDENTIALS env var. Check Qiskit version. Run smoke test.",
    humanDescription: "Conexión con los computadores cuánticos de IBM.",
    developerGuide: "Provider remoto que requiere credenciales IBM. Circuit breaker con 5 fallos consecutivos.",
  },
  {
    id: "K-braket",
    name: "Braket Provider",
    description: "AWS Braket, múltiples proveedores de hardware",
    category: "execution",
    complexity: "complex",
    codeFiles: ["src/lib/quantum/core-registry.ts:32"],
    dependencies: ["H-workers"],
    dependents: [],
    healthCheck: "Braket import check passes",
    repairProcedure: "Verify AWS_BRAKET_CREDENTIALS env var. Check AWS region. Run smoke test.",
    humanDescription: "Conexión con los computadores cuánticos de Amazon Web Services.",
    developerGuide: "Provider remoto AWS. Soporta IonQ, Rigetti, Oxford Quantum a través de Braket.",
  },
  {
    id: "L-rigetti",
    name: "Rigetti Provider",
    description: "Rigetti QCS, hardware nativo",
    category: "execution",
    complexity: "complex",
    codeFiles: ["src/lib/quantum/core-registry.ts:31"],
    dependencies: ["H-workers"],
    dependents: [],
    healthCheck: "Rigetti import check passes",
    repairProcedure: "Verify RIGETTI_CREDENTIALS env var. Check QCS access. Run smoke test.",
    humanDescription: "Conexión directa con los computadores cuánticos de Rigetti.",
    developerGuide: "Provider remoto Rigetti. Requiere QCS API access.",
  },
  {
    id: "M-catalyst",
    name: "Catalyst Compiler",
    description: "Compilación de programas permitidos, artifacts ejecutables",
    category: "execution",
    complexity: "complex",
    codeFiles: ["src/lib/quantum/core-registry.ts:33"],
    dependencies: ["H-workers"],
    dependents: [],
    healthCheck: "Catalyst compilation returns valid artifact",
    repairProcedure: "Check Catalyst version. Verify allowed programs list. Run test compilation.",
    humanDescription: "El compilador que convierte programas cuánticos en ejecutables.",
    developerGuide: "Compila programas a artifacts ejecutables. Lista de programas permitidos por policy.",
  },
  {
    id: "N-lightning",
    name: "Lightning HPC",
    description: "Aceleración de circuitos en hardware de alto rendimiento",
    category: "execution",
    complexity: "complex",
    codeFiles: ["src/lib/quantum/core-registry.ts:29"],
    dependencies: ["H-workers"],
    dependents: [],
    healthCheck: "Lightning HPC check passes",
    repairProcedure: "Check Lightning installation. Verify HPC access. Run benchmark test.",
    humanDescription: "Acelerador de alto rendimiento para circuitos grandes.",
    developerGuide: "Requiere scope quantum:lightning adicional. Para circuitos que necesitan más potencia que el simulador local.",
  },

  // ==========================================================================
  // CAPA 3: SEGURIDAD CRIPTOGRÁFICA
  // ==========================================================================
  {
    id: "O-pqc",
    name: "Post-Quantum Cryptography",
    description: "ML-KEM-768, ML-DSA-87, SLH-DSA-128s — CRYSTALS-LATAMV",
    category: "crypto",
    complexity: "critical",
    codeFiles: ["src/lib/postQuantumCrypto.ts"],
    dependencies: [],
    dependents: ["Q-bookpi", "R-hsm", "T-tee"],
    healthCheck: "generateMLKEMKeyPair returns valid key pair",
    repairProcedure: "Verify postQuantumCrypto.ts loads without errors. Check hex generation. Test sign/verify cycle.",
    humanDescription: "La criptografía que protege todo contra computadoras cuánticas futuras. Si esto falla, nada está firmado.",
    developerGuide: "ML-KEM-768 para key encapsulation, ML-DSA-87 para firmas lattice-based, SLH-DSA-128s para firmas hash-based. LITLE-32 gates evalúan 32 compuertas cuánticas. PROTOTYPE — no certificado para producción.",
  },
  {
    id: "P-litle32",
    name: "LITLE-32 Gates",
    description: "32-gate quantum attestation matrix",
    category: "crypto",
    complexity: "critical",
    codeFiles: ["src/lib/postQuantumCrypto.ts:122-144"],
    dependencies: ["O-pqc"],
    dependents: ["Q-bookpi"],
    healthCheck: "evaluateLitle32Gates returns 32 evaluations with fidelity > 0.999",
    repairProcedure: "Verify gate types: HADAMARD, CNOT, PAULI_Z, TOFFOLI, PHASE_SHIFT. Check fidelity calculations.",
    humanDescription: "Las 32 compuertas cuánticas que validan cada firma. Es el sello de autenticidad cuántica.",
    developerGuide: "Cada gate tiene gateIndex (1-32), gateType, qubitState (|ψ_i⟩), status (PASSED/ATTESTED), fidelity (0.9992+). Determinista basado en seed del payload.",
  },
  {
    id: "Q-bookpi",
    name: "BookPI Quantum Chain",
    description: "Cadena append-only con firma PQC dual y verificación de integridad",
    category: "blockchain",
    complexity: "complex",
    codeFiles: ["src/lib/quantum/bookpi-quantum.ts", "src/lib/bookpi.server.ts"],
    dependencies: ["O-pqc", "P-litle32"],
    dependents: ["T-tee", "W-federation"],
    healthCheck: "verifyChainIntegrity returns valid: true",
    repairProcedure: "Walk chain from genesis. Check each block's previousHash matches. Verify PQC dual signatures.",
    humanDescription: "La cadena de auditoría inmutable. Cada bloque está firmado con criptografía poscuántica dual.",
    developerGuide: "Append-only. Genesis hash: sha256('bookpi-genesis'). Cada bloque: sha256(prevHash:blockData). Firma dual: ML-DSA-87 + SLH-DSA-128s. Verificación O(n) — sin checkpointing.",
  },

  // ==========================================================================
  // CAPA 4: HARDWARE SECURITY
  // ==========================================================================
  {
    id: "R-hsm",
    name: "HSM Dual YubiHSM",
    description: "Failover automático, health check, circuit breaker",
    category: "hsm",
    complexity: "critical",
    codeFiles: ["src/lib/quantum/hsm-client.ts", "src/lib/hsmClient.ts", "src/lib/hsmFailoverMonitor.ts"],
    dependencies: ["O-pqc"],
    dependents: ["Q-bookpi", "T-tee"],
    healthCheck: "HSM primary and backup both respond to health check",
    repairProcedure: "Check HSM device connectivity. Verify failover counter. Reset circuit breaker if needed. Check env vars.",
    humanDescription: "Los módulos de seguridad físicos que firman las operaciones críticas. Si falla el primario, el backup toma control.",
    developerGuide: "Dual YubiHSM con failover. Per-device failure threshold (default 5). Fallback a software-emergency si ambos fallan. Health check cada 5s.",
  },
  {
    id: "S-tee",
    name: "TEE Attestation",
    description: "Trusted Execution Environment con firma dual",
    category: "tee",
    complexity: "complex",
    codeFiles: ["src/lib/quantum/tee-attestation.ts"],
    dependencies: ["O-pqc", "R-hsm"],
    dependents: ["Q-bookpi"],
    healthCheck: "generateAttestation returns valid attestation with nonce",
    repairProcedure: "Verify TEE platform identity. Check nonce generation. Validate signature chain.",
    humanDescription: "La verificación de que el código se ejecuta en un entorno seguro y no fue manipulado.",
    developerGuide: "Nonce-based verification, measurement digest checking, signature chain, expiration, platform identity. MOCK — no conectado a SGX/TrustZone/SEV real.",
  },

  // ==========================================================================
  // CAPA 5: AUDITORÍA Y TELEMETRÍA
  // ==========================================================================
  {
    id: "T-audit-tracer",
    name: "Audit Tracer",
    description: "Buffer de auditoría con SHA-256 checksums por evento",
    category: "audit",
    complexity: "simple",
    codeFiles: ["src/domains/ai/infrastructure/audit-tracer.ts"],
    dependencies: ["C-policy"],
    dependents: ["O-cognitive"],
    healthCheck: "auditTrace returns entry with checksum",
    repairProcedure: "Check buffer size (< 1000). Verify SHA-256 computation. Clear if full.",
    humanDescription: "El registro de cada acción que toma el sistema, con firma criptográfica.",
    developerGuide: "Buffer in-memory, max 1000 entries. Cada entry tiene SHA-256 checksum. No conectado a BookPI o PostgreSQL.",
  },
  {
    id: "U-event-bus",
    name: "Quantum Event Bus",
    description: "Eventos tipados con hash-chain entre los 24 núcleos",
    category: "telemetry",
    complexity: "moderate",
    codeFiles: ["src/lib/quantum/event-bus.ts"],
    dependencies: [],
    dependents: ["V-telemetry", "W-federation", "X-recovery"],
    healthCheck: "getEventBusMetrics returns totalEvents > 0",
    repairProcedure: "Check handler registration. Verify event hash chain. Clear log if > 5000 events.",
    humanDescription: "El sistema de comunicación interna entre todos los módulos. Cada evento está encadenado criptográficamente.",
    developerGuide: "13 tipos de eventos tipados. Hash-chain: each event includes previousEventHash. Max 5000 events in log. Handler errors silently caught.",
  },
  {
    id: "V-telemetry",
    name: "Telemetry & Observability",
    description: "Counters, histograms, spans distribuidos (OpenTelemetry-style)",
    category: "telemetry",
    complexity: "moderate",
    codeFiles: ["src/lib/quantum/telemetry.ts"],
    dependencies: ["U-event-bus"],
    dependents: [],
    healthCheck: "getTelemetrySnapshot returns counters and histograms",
    repairProcedure: "Check counter overflow. Verify span parent-child relationships. Export metrics if needed.",
    humanDescription: "Las métricas de rendimiento: cuántas solicitudes, cuánto tardan, cuántos errores hay.",
    developerGuide: "Counters: requests, jobs, restarts, denials, fallbacks. Histograms: request duration, queue wait. Spans con parent-child. Todo in-memory — no conectado a Prometheus/Grafana.",
  },

  // ==========================================================================
  // CAPA 6: PERSISTENCIA
  // ==========================================================================
  {
    id: "W-postgresql",
    name: "PostgreSQL + TimescaleDB",
    description: "Telemetría, métricas y logs sincrónicos (DB-1)",
    category: "persistence",
    complexity: "complex",
    codeFiles: ["src/data/"],
    dependencies: [],
    dependents: ["Y-federation", "X-recovery"],
    healthCheck: "PostgreSQL connection returns version",
    repairProcedure: "Check DATABASE_URL env var. Verify schema migrations. Run connection pool test.",
    humanDescription: "La base de datos principal que guarda todas las métricas y logs del sistema.",
    developerGuide: "DB-1 en la matriz políglota. TimescaleDB para time-series. Schemas definidos pero no conectados en runtime.",
  },
  {
    id: "X-backup",
    name: "Backup & Snapshot",
    description: "Snapshots verificados, copias de seguridad cifradas",
    category: "backup",
    complexity: "moderate",
    codeFiles: ["src/lib/quantum/core-registry.ts:40"],
    dependencies: ["W-postgresql"],
    dependents: ["X-recovery"],
    healthCheck: "Backup snapshot exists and is verified",
    repairProcedure: "Create new snapshot. Verify hash. Store in encrypted location.",
    humanDescription: "Las copias de seguridad que permiten recuperar el sistema si algo se pierde.",
    developerGuide: "Núcleo 21. Toma snapshots del estado del sistema y los verifica con hash.",
  },

  // ==========================================================================
  // CAPA 7: FEDERACIÓN Y RECUPERACIÓN
  // ==========================================================================
  {
    id: "Y-federation",
    name: "Heptafederado (7 Federations)",
    description: "Replicación autorizada con quórum 5/7",
    category: "federation",
    complexity: "critical",
    codeFiles: ["src/lib/quantum/core-registry.ts:42", "src/lib/quantum/bookpi-quantum.ts:158-170"],
    dependencies: ["Q-bookpi", "W-postgresql"],
    dependents: [],
    healthCheck: "Federation replication events are within acceptable lag",
    repairProcedure: "Check federation node connectivity. Verify quorum (5/7). Compare block hashes across nodes.",
    humanDescription: "Las 7 copias distribuidas del sistema que se mantienen sincronizadas. Si una falla, las otras 6 siguen funcionando.",
    developerGuide: "7 federaciones con afinidad por cabezas dodecaédricas. Quórum 5/7 para anclar. Replica solo eventos autorizados.",
  },
  {
    id: "Z-recovery",
    name: "Recovery & Self-Healing",
    description: "7 tipos de incidentes, planes tipificados, auto-recuperación",
    category: "recovery",
    complexity: "complex",
    codeFiles: ["src/lib/quantum/recovery.ts"],
    dependencies: ["U-event-bus", "R-hsm", "Q-bookpi"],
    dependents: [],
    healthCheck: "getRecoveryMetrics returns active incidents count",
    repairProcedure: "Check active incidents. Resolve resolved incidents. Verify recovery actions are documented.",
    humanDescription: "El sistema que se repara a sí mismo cuando algo falla. Detecta problemas y ejecuta planes de recuperación.",
    developerGuide: "7 tipos: pennylane_absent, worker_hung, remote_provider_down, hsm_unavailable, tee_unverifiable, bookpi_postgres_down, federation_node_micious. Actions son strings descriptivos — no implementados como código.",
  },

  // ==========================================================================
  // CAPA 8: COGNITIVO Y MULTIMODAL
  // ==========================================================================
  {
    id: "AA-cognitive",
    name: "Cognitive Pipeline",
    description: "6-step pipeline: Perceive → Remember → Policy → Decide → Act → Audit",
    category: "cognitive",
    complexity: "complex",
    codeFiles: ["src/domains/ai/application/handlers/processPerception.ts", "src/lib/isabella-crown.ts"],
    dependencies: ["D-intent", "C-policy", "T-audit-tracer"],
    dependents: ["AB-multimodal"],
    healthCheck: "processPerception returns structured response",
    repairProcedure: "Verify CROWN weights. Check preset configuration. Test policy gate. Restart cognitive pipeline.",
    humanDescription: "El cerebro que procesa cada mensaje del usuario a través de 5 módulos especializados.",
    developerGuide: "ISA (empatía) + SOPHIA (razonamiento) + ORION (creatividad) + ARGUS (seguridad) + CROWN_GATEWAY (routing). 6 presets: prime, empathic, strategic, sentinel, executor, synergistic.",
  },
  {
    id: "AB-multimodal",
    name: "Multimodal Generation",
    description: "Image (Gemini+Flux), Voice (TTS), Trailer (Canvas 60fps)",
    category: "multimodal",
    complexity: "complex",
    codeFiles: ["server.ts:700-868", "src/components/Studio/", "src/components/Welcome/"],
    dependencies: ["AA-cognitive"],
    dependents: [],
    healthCheck: "Image generation returns valid base64 or URL",
    repairProcedure: "Check GEMINI_API_KEY. Verify Pollinations API access. Test TTS fallback chain.",
    humanDescription: "La generación de imágenes, voz y video. Si Gemini no está, usa motores alternativos.",
    developerGuide: "Image: Gemini Flash Lite → Imagen 3.0 → Pollinations Flux. Voice: Gemini TTS → Web Speech API. Trailer: HTML5 Canvas 60fps + Web Audio.",
  },

  // ==========================================================================
  // CAPA 9: BILLING Y TERRITORIAL
  // ==========================================================================
  {
    id: "AC-billing",
    name: "Cattleya Finance",
    description: "Planes de suscripción, checkout, usage tracking",
    category: "billing",
    complexity: "moderate",
    codeFiles: ["src/lib/subscription.server.ts", "src/components/Billing/"],
    dependencies: ["A-identity"],
    dependents: [],
    healthCheck: "GET /api/v1/billing/plans returns plan list",
    repairProcedure: "Check STRIPE_PRICE_* env vars. Verify usage bucket TTL. Test checkout flow.",
    humanDescription: "El sistema de planes de pago que gestiona suscripciones y uso.",
    developerGuide: "4 planes: Plus, Premium, VIP, Enterprise. Usage buckets con TTL. Mock checkout para dev.",
  },
  {
    id: "AD-territorial",
    name: "Territorial Hub RDM",
    description: "Contexto de Real del Monte, capas culturales, patrimonio",
    category: "territorial",
    complexity: "simple",
    codeFiles: ["src/components/Hub/", "src/services/territoryContextService.ts"],
    dependencies: [],
    dependents: ["AA-cognitive"],
    healthCheck: "Territory context returns Real del Monte data",
    repairProcedure: "Check territory context service. Verify cultural layer data. Update if stale.",
    humanDescription: "El conocimiento territorial de Real del Monte, Hidalgo. Le da contexto cultural a Isabella.",
    developerGuide: "Capas culturales, patrimonio, contexto local. Inyectado al pipeline cognitivo para respuestas con arraigo.",
  },
];

/**
 * Mapa de acceso rápido por ID.
 */
const atlasMap = new Map<string, AutomationNode>(
  AUTOMATION_ATLAS.map((node) => [node.id, node]),
);

/**
 * Obtiene un nodo por ID.
 */
export function getAutomationNode(id: string): AutomationNode | undefined {
  return atlasMap.get(id);
}

/**
 * Obtiene todos los nodos de una categoría.
 */
export function getNodesByCategory(category: AutomationNode["category"]): AutomationNode[] {
  return AUTOMATION_ATLAS.filter((n) => n.category === category);
}

/**
 * Calcula la cadena de dependencias desde un nodo hacia atrás (qué necesita).
 */
export function getDependencyChain(nodeId: string, visited: Set<string> = new Set()): string[] {
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);
  const node = getAutomationNode(nodeId);
  if (!node) return [];
  const chain: string[] = [nodeId];
  for (const dep of node.dependencies) {
    chain.push(...getDependencyChain(dep, visited));
  }
  return [...new Set(chain)];
}

/**
 * Calcula qué nodos se ven afectados si un nodo falla (dependientes hacia adelante).
 */
export function getAffectedChain(nodeId: string, visited: Set<string> = new Set()): string[] {
  if (visited.has(nodeId)) return [];
  visited.add(nodeId);
  const node = getAutomationNode(nodeId);
  if (!node) return [];
  const chain: string[] = [nodeId];
  for (const dep of node.dependents) {
    chain.push(...getAffectedChain(dep, visited));
  }
  return [...new Set(chain)];
}

/**
 * Estadísticas del atlas.
 */
export function getAtlasStats() {
  const byCategory: Record<string, number> = {};
  const byComplexity: Record<string, number> = {};
  for (const node of AUTOMATION_ATLAS) {
    byCategory[node.category] = (byCategory[node.category] || 0) + 1;
    byComplexity[node.complexity] = (byComplexity[node.complexity] || 0) + 1;
  }
  return {
    totalNodes: AUTOMATION_ATLAS.length,
    byCategory,
    byComplexity,
    totalCodeFiles: new Set(AUTOMATION_ATLAS.flatMap((n) => n.codeFiles)).size,
  };
}
