/**
 * Isabella Villaseñor AI — Puente de Enlace y Flujo de Aprendizaje Cuántico
 * (client-safe dataset; sin dependencias de runtime servidor)
 *
 * Fuentes públicas absorbidas como corpus de aprendizaje del skill #70
 * `quantum_adapter` y del skill #68 `github_sync_bridge`.
 */

export type QuantumSourceKind =
  | "framework"
  | "textbook"
  | "simulator"
  | "domain"
  | "tooling";

export interface QuantumSource {
  id: string;
  repo: string;
  url: string;
  kind: QuantumSourceKind;
  language: string;
  topics: string[];
  absorbs: string;
  /** Nodo cognitivo responsable de la ingesta */
  owner: "SOPHIA" | "ORION" | "ARGUS" | "CROWN" | "ISA";
  /** Relevancia curricular 0..1 */
  relevance: number;
}

export const QUANTUM_SOURCES: QuantumSource[] = [
  {
    id: "pennylane",
    repo: "PennyLaneAI/pennylane",
    url: "https://github.com/PennyLaneAI/pennylane.git",
    kind: "framework",
    language: "Python",
    topics: ["quantum-machine-learning", "autodiff", "variational-circuits", "qml"],
    absorbs:
      "Gradientes paramétricos, plantillas variacionales y contratos QNode → base del wrapper QNN/VQE de Isabella.",
    owner: "SOPHIA",
    relevance: 1.0,
  },
  {
    id: "quantumcomputingbook",
    repo: "JackHidary/quantumcomputingbook",
    url: "https://github.com/JackHidary/quantumcomputingbook",
    kind: "textbook",
    language: "Jupyter Notebook",
    topics: ["quantum-computing", "quantum-information", "qiskit", "quantum-supremacy"],
    absorbs:
      "Currículo aplicado (Cirq/Qiskit): superposición, entrelazamiento, Grover, Shor, QAOA y VQE con notebooks ejecutables.",
    owner: "SOPHIA",
    relevance: 0.96,
  },
  {
    id: "qulacs",
    repo: "qulacs/qulacs",
    url: "https://github.com/qulacs/qulacs",
    kind: "simulator",
    language: "C++",
    topics: ["quantum-circuit-simulator", "nisq", "variational"],
    absorbs:
      "Kernel de simulación de alto rendimiento: referencia de complejidad y límites de qubits del Quantum Adapter.",
    owner: "ORION",
    relevance: 0.82,
  },
  {
    id: "qiskit-finance",
    repo: "qiskit-community/qiskit-finance",
    url: "https://github.com/qiskit-community/qiskit-finance",
    kind: "domain",
    language: "Python",
    topics: ["quantum-finance", "portfolio-optimization", "risk"],
    absorbs:
      "Modelos de riesgo y optimización de portafolio → alimenta Lucrum Prime (economía soberana).",
    owner: "CROWN",
    relevance: 0.74,
  },
  {
    id: "qiskit-optimization",
    repo: "qiskit-community/qiskit-optimization",
    url: "https://github.com/qiskit-community/qiskit-optimization",
    kind: "domain",
    language: "Python",
    topics: ["qaoa", "quadratic-programs", "combinatorial"],
    absorbs:
      "QUBO/QAOA para ruteo territorial y asignación de recursos del Gemelo Digital de Real del Monte.",
    owner: "ORION",
    relevance: 0.71,
  },
  {
    id: "quantum-core",
    repo: "quantum-elixir/quantum-core",
    url: "https://github.com/quantum-elixir/quantum-core",
    kind: "tooling",
    language: "Elixir",
    topics: ["cron", "scheduler"],
    absorbs:
      "Semántica cron tolerante a fallos → planificador de ciclos de aprendizaje nocturnos del Meta Learner.",
    owner: "ARGUS",
    relevance: 0.42,
  },
  {
    id: "quantum-tauri",
    repo: "atilafassina/quantum",
    url: "https://github.com/atilafassina/quantum",
    kind: "tooling",
    language: "TypeScript",
    topics: ["tauri", "solidstart", "mobile"],
    absorbs:
      "Empaquetado híbrido escritorio/móvil → referencia para la Terminal CROWN air-gapped.",
    owner: "ORION",
    relevance: 0.35,
  },
];

/** Repos homónimos descartados por ARGUS (ruido léxico "Quantumult"). */
export const QUANTUM_REJECTED = [
  "Hedilict/QuantumultX",
  "sve1r/Rules-For-Quantumult-X",
  "89996462/Quantumult-X",
  "photonmang/quantumultX",
] as const;

export interface QuantumLesson {
  id: string;
  stage: number;
  title: string;
  source: string;
  outcome: string;
  skills: string[];
  weightDelta: { sophia?: number; orion?: number; argus?: number };
}

/** Flujo de aprendizaje determinista en 6 etapas (currículo cuántico). */
export const QUANTUM_CURRICULUM: QuantumLesson[] = [
  {
    id: "QL-01",
    stage: 1,
    title: "Fundamentos: qubits, superposición y medición",
    source: "quantumcomputingbook",
    outcome: "Isabella modela estados |ψ⟩ y colapso probabilístico en su razonamiento SOPHIA.",
    skills: ["quantum_adapter", "ai_02_reasoning"],
    weightDelta: { sophia: 0.02 },
  },
  {
    id: "QL-02",
    stage: 2,
    title: "Circuitos y compuertas universales",
    source: "qulacs",
    outcome: "Estimación de costo de simulación y límites NISQ antes de ejecutar un plan.",
    skills: ["quantum_adapter", "reasoner_planner"],
    weightDelta: { orion: 0.02 },
  },
  {
    id: "QL-03",
    stage: 3,
    title: "Circuitos variacionales y gradientes (QNode)",
    source: "pennylane",
    outcome: "Wrapper QNN/VQE diferenciable expuesto como tool soberana.",
    skills: ["quantum_adapter", "meta_learner"],
    weightDelta: { sophia: 0.03, orion: 0.01 },
  },
  {
    id: "QL-04",
    stage: 4,
    title: "Algoritmos: Grover, Shor, QAOA",
    source: "quantumcomputingbook",
    outcome: "Reconoce cuándo un problema admite ventaja cuántica y cuándo no (anti-hype).",
    skills: ["ai_03_critique", "epistemic_confidence"],
    weightDelta: { sophia: 0.02, argus: 0.01 },
  },
  {
    id: "QL-05",
    stage: 5,
    title: "Optimización combinatoria QUBO territorial",
    source: "qiskit-optimization",
    outcome: "Ruteo y asignación sobre el Gemelo Digital de Real del Monte.",
    skills: ["rdm_territory_query", "tool_orchestrator"],
    weightDelta: { orion: 0.03 },
  },
  {
    id: "QL-06",
    stage: 6,
    title: "Post-cuántico y soberanía criptográfica",
    source: "pennylane",
    outcome: "Justifica Dilithium-5 y refuerza el sellado PQC de cada AuditBundle.",
    skills: ["useBookPI", "ethical_firewall", "id_nvida"],
    weightDelta: { argus: 0.03 },
  },
];

export const QUANTUM_BRIDGE_POLICY = {
  mode: "read-only-mirror",
  license_check: "CC/Apache/MIT/BSD verificado antes de ingesta",
  sanitization: "notebooks → texto plano, sin ejecución de código remoto",
  argus_rule: "RULE_01_ZERO_TRUST_TOOL_WHITELIST",
  provenance: "cada lección genera un bloque BookPI con el CID del corpus",
} as const;