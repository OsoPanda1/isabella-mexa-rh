export type FederationId =
  | "knowledge" | "identity" | "governance" | "economy" | "security" | "infrastructure" | "intelligence";

export interface Federation {
  id: FederationId;
  index: string;
  name: { es: string; en: string };
  domain: { es: string; en: string };
  essence: { es: string; en: string };
  color: string; // css var name
  glyph: string;
  modules: { code: string; name: { es: string; en: string }; role: { es: string; en: string } }[];
  protocols: { code: string; desc: { es: string; en: string } }[];
}

export const FEDERATIONS: Federation[] = [
  {
    id: "knowledge",
    index: "F-01",
    name: { es: "Federación de Conocimiento", en: "Federation of Knowledge" },
    domain: { es: "Memoria · contexto · estructura semántica", en: "Memory · context · semantic structure" },
    essence: {
      es: "Preserva la memoria, el contexto y la estructura semántica de la realidad como grafo civilizatorio.",
      en: "Preserves memory, context and semantic structure of reality as a civilizational graph."
    },
    color: "var(--fed-knowledge)",
    glyph: "◈",
    modules: [
      { code: "ATLAS-KERNEL", name: { es: "Atlas Kernel", en: "Atlas Kernel" }, role: { es: "Grafo civilizatorio · entities/relations", en: "Civilizational graph · entities/relations" } },
      { code: "EOCT", name: { es: "Event & Ontology Core Trace", en: "Event & Ontology Core Trace" }, role: { es: "Eventos y transiciones de estado", en: "Events and state transitions" } },
      { code: "BOOKPI", name: { es: "Bookpi", en: "Bookpi" }, role: { es: "Documentos, evidencias, versiones", en: "Documents, evidence, versions" } },
      { code: "GEMET", name: { es: "GEMET", en: "GEMET" }, role: { es: "Ontología base compartida", en: "Shared base ontology" } },
    ],
    protocols: [
      { code: "P-K01", desc: { es: "Toda entidad vive en un grafo", en: "Every entity lives in a graph" } },
      { code: "P-K02", desc: { es: "Toda relación es tipada y temporal", en: "Every relation is typed and temporal" } },
    ],
  },
  {
    id: "identity",
    index: "F-02",
    name: { es: "Federación de Identidad", en: "Federation of Identity" },
    domain: { es: "Entidades · roles · reputación · persistencia", en: "Entities · roles · reputation · persistence" },
    essence: {
      es: "Define entidades, roles, reputación y persistencia digital bajo soberanía.",
      en: "Defines entities, roles, reputation and digital persistence under sovereignty."
    },
    color: "var(--fed-identity)",
    glyph: "✦",
    modules: [
      { code: "SPIRE", name: { es: "SPIFFE/SPIRE", en: "SPIFFE/SPIRE" }, role: { es: "Identidades de servicios", en: "Service identities" } },
      { code: "ID-API", name: { es: "Identity API", en: "Identity API" }, role: { es: "RBAC + ABAC, Zero Trust", en: "RBAC + ABAC, Zero Trust" } },
    ],
    protocols: [
      { code: "P-I01", desc: { es: "Toda interacción es autenticada", en: "Every interaction is authenticated" } },
      { code: "P-I02", desc: { es: "Toda acción es verificable", en: "Every action is verifiable" } },
    ],
  },
  {
    id: "governance",
    index: "F-03",
    name: { es: "Federación de Gobernanza", en: "Federation of Governance" },
    domain: { es: "Reglas · decisiones · protocolos · legitimidad", en: "Rules · decisions · protocols · legitimacy" },
    essence: {
      es: "Establece reglas, decisiones, protocolos y legitimidad operativa del metasistema.",
      en: "Establishes rules, decisions, protocols and operational legitimacy of the metasystem."
    },
    color: "var(--fed-governance)",
    glyph: "⌘",
    modules: [
      { code: "KORIMA", name: { es: "KORIMA", en: "KORIMA" }, role: { es: "Protocolo de decisión colectiva", en: "Collective decision protocol" } },
      { code: "SDMD-7", name: { es: "SDMD-7", en: "SDMD-7" }, role: { es: "Marco doctrinal siete capas", en: "Seven-layer doctrinal frame" } },
      { code: "4L", name: { es: "4L", en: "4L" }, role: { es: "Legitimidad · Ley · Lógica · Linaje", en: "Legitimacy · Law · Logic · Lineage" } },
    ],
    protocols: [
      { code: "P-G01", desc: { es: "Toda lógica es versionable", en: "All logic is versionable" } },
    ],
  },
  {
    id: "economy",
    index: "F-04",
    name: { es: "Federación de Economía", en: "Federation of Economy" },
    domain: { es: "Valor · intercambio · incentivos · sostenibilidad", en: "Value · exchange · incentives · sustainability" },
    essence: {
      es: "Gestiona valor, intercambio, incentivos y sostenibilidad como economía programable.",
      en: "Manages value, exchange, incentives and sustainability as programmable economy."
    },
    color: "var(--fed-economy)",
    glyph: "◉",
    modules: [
      { code: "ECON-API", name: { es: "Economy API", en: "Economy API" }, role: { es: "Activos, contratos, monetización", en: "Assets, contracts, monetization" } },
    ],
    protocols: [
      { code: "P-E01", desc: { es: "Todo activo puede ser monetizado", en: "Every asset can be monetized" } },
    ],
  },
  {
    id: "security",
    index: "F-05",
    name: { es: "Federación de Seguridad", en: "Federation of Security" },
    domain: { es: "Vigilancia · defensa · integridad", en: "Surveillance · defense · integrity" },
    essence: {
      es: "Protege la integridad del sistema mediante vigilancia, defensa y control en tiempo real.",
      en: "Protects system integrity through real-time surveillance, defense and control."
    },
    color: "var(--fed-security)",
    glyph: "✕",
    modules: [
      { code: "ANUBIS", name: { es: "Anubis", en: "Anubis" }, role: { es: "Vigilancia y juicio operacional", en: "Surveillance and operational judgment" } },
      { code: "HORUS", name: { es: "Horus", en: "Horus" }, role: { es: "Radares y telemetría", en: "Radars and telemetry" } },
      { code: "MSR", name: { es: "MSR", en: "MSR" }, role: { es: "Anclas criptográficas de estado", en: "Cryptographic state anchors" } },
    ],
    protocols: [
      { code: "P-S01", desc: { es: "Todo dato crítico es cifrado y anclado", en: "All critical data is encrypted and anchored" } },
    ],
  },
  {
    id: "infrastructure",
    index: "F-06",
    name: { es: "Federación de Infraestructura", en: "Federation of Infrastructure" },
    domain: { es: "Despliegue · resiliencia · conectividad", en: "Deployment · resilience · connectivity" },
    essence: {
      es: "Soporta la operación técnica, despliegue, resiliencia y conectividad del metasistema.",
      en: "Sustains technical operation, deployment, resilience and connectivity of the metasystem."
    },
    color: "var(--fed-infra)",
    glyph: "◇",
    modules: [
      { code: "KERNEL-03", name: { es: "Kernel 03", en: "Kernel 03" }, role: { es: "Observabilidad · métricas · traces", en: "Observability · metrics · traces" } },
      { code: "KMS", name: { es: "KMS híbrido", en: "Hybrid KMS" }, role: { es: "Gestión de claves", en: "Key management" } },
    ],
    protocols: [
      { code: "P-X01", desc: { es: "Todo sistema es desacoplado", en: "Every system is decoupled" } },
    ],
  },
  {
    id: "intelligence",
    index: "F-07",
    name: { es: "Federación de Inteligencia Artificial", en: "Federation of Artificial Intelligence" },
    domain: { es: "Cognición · guardrails · ética", en: "Cognition · guardrails · ethics" },
    essence: {
      es: "Orquesta capacidades cognitivas bajo principios éticos y supervisión continua.",
      en: "Orchestrates cognitive capabilities under ethical principles and continuous oversight."
    },
    color: "var(--fed-ai)",
    glyph: "✺",
    modules: [
      { code: "ISABELLA", name: { es: "Isabella", en: "Isabella" }, role: { es: "Núcleo cognitivo asistido", en: "Assisted cognitive core" } },
      { code: "GUARDRAILS", name: { es: "Guardrails", en: "Guardrails" }, role: { es: "Contención y supervisión", en: "Containment and oversight" } },
    ],
    protocols: [
      { code: "P-A01", desc: { es: "La IA asiste, no gobierna sin supervisión", en: "AI assists, never governs without oversight" } },
    ],
  },
];

export const AXIOMS: { code: string; es: string; en: string }[] = [
  { code: "AX-01", es: "Todo es una entidad.", en: "Everything is an entity." },
  { code: "AX-02", es: "Toda entidad vive en un grafo.", en: "Every entity lives in a graph." },
  { code: "AX-03", es: "Todo cambio es un evento.", en: "Every change is an event." },
  { code: "AX-04", es: "Todo evento es trazable.", en: "Every event is traceable." },
  { code: "AX-05", es: "Toda acción es verificable.", en: "Every action is verifiable." },
  { code: "AX-06", es: "Todo dato crítico es cifrado y anclado.", en: "All critical data is encrypted and anchored." },
  { code: "AX-07", es: "Toda interacción es autenticada (Zero Trust).", en: "Every interaction is authenticated (Zero Trust)." },
  { code: "AX-08", es: "Todo sistema es desacoplado.", en: "Every system is decoupled." },
  { code: "AX-09", es: "Toda lógica es versionable.", en: "All logic is versionable." },
  { code: "AX-10", es: "Todo activo puede ser monetizado.", en: "Every asset can be monetized." },
];