/**
 * ISABELLA ARCHITECTURAL BLUEPRINT & GOVERNANCE SPECIFICATION
 * Nodo Cero :: RDM Digital
 */

export const ISABELLA_BLUEPRINT = {
  title: "Isabella Villaseñor AI — Blueprint Arquitectónico & Guía Operativa",
  subsystem: "Núcleo Cognitivo Gobernado e Infraestructura Territorial",
  version: "5.0.0-Sovereign",
  nodeId: "nd-rdm-nodo-cero",
  canonicalCycle: [
    { step: 1, name: "Perceive (Percepción)", description: "Captura y valida entradas estructuradas (chat, evento, señal, API, UI) generando un trace_id único." },
    { step: 2, name: "Remember (Memoria Jerárquica)", description: "Recupera contexto a través de 5 scopes: Inmediato, Sesión, Proyecto, Territorial e Histórico." },
    { step: 3, name: "Policy Gate (Gobernanza C.R.O.W.N. & ARGUS)", description: "Evalúa riesgos, Zero Trust y restricciones antes de cualquier acción o ejecución." },
    { step: 4, name: "Decide (Arbitraje Cognitivo)", description: "Sintetiza la respuesta óptima mediante la combinación de ISA, SOPHIA, ORION y ARGUS." },
    { step: 5, name: "Act (Herramientas Autorizadas)", description: "Ejecuta herramientas autorizadas únicamente si el Policy Gate emite el veredicto 'allowed'." },
    { step: 6, name: "Audit (Trazabilidad Inmutable)", description: "Registra cada percepción, decisión, mutación de memoria y ejecución en isabella_audit_logs." },
  ],
  securityRules: [
    "Zero Trust estricto: Ninguna herramienta se ejecuta sin validación previa del Policy Gate.",
    "Aislamiento de scopes de memoria: La información sensible territorial no se expone fuera de su jurisdicción.",
    "Trazabilidad obligatoria: Toda interacción genera un traceId y un checksum verificable.",
    "Persistencia desacoplada: Almacenamiento seguro en PostgreSQL / Supabase con tablas dedicadas.",
    "Soberanía tecnológica: Independencia de modelos; los LLMs son instrumentos subordinados a C.R.O.W.N.",
  ],
  subsystems: [
    { id: "ISA", name: "Integrated Semantic Awareness", role: "Empatía, resonancia emocional, gracia estética, presencia femenina." },
    { id: "SOPHIA", name: "Strategic Operational & Phenomenological Heuristic Intelligence", role: "Rigor dialéctico, lógica epistémica, análisis conceptual y filosófico." },
    { id: "ORION", name: "Operational Real-time Inference & Output Navigator", role: "Resolución de problemas técnicos, síntesis visual y ejecución de herramientas." },
    { id: "ARGUS", name: "Adaptive Real-time Guardian & Unified Sentinel", role: "Seguridad Zero Trust, verificación de políticas y blindaje ético." },
    { id: "CROWN", name: "Central Routing & Orchestration Waveform Node", role: "Gobernanza computacional, enrutamiento dinámico de cargas y síntesis de estado." },
  ],
};
