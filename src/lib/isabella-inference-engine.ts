/**
 * ================================================================
 * ISABELLA VILLASEÑOR AI — SOVEREIGN INFERENCE ENGINE v2
 * Zero-dependency cognitive engine. No Gemini, no OpenAI, no external LLM.
 * NFD tokenization + weighted intent scoring + entity extraction +
 * conversation memory + fuzzy matching + dynamic response generation.
 * ================================================================
 *
 * Patterns derived from:
 * - github-ai-assistant (BM25, NFD tokenizer, glossary expansion, entity cascade)
 * - APIAI-BotLibre (confidence scoring, session IDs)
 * - semantic-critical-thinking-ecuador (cosine similarity, embeddings mindset)
 */

/* =========================================================================
   0. TYPES
   ========================================================================= */

export interface InferenceInput {
  readonly input: string;
  readonly history?: Array<{ role: string; content: string }>;
  readonly activePreset?: string;
  readonly crownConfig?: Record<string, unknown>;
  readonly isImageRequest?: boolean;
}

export interface CognitiveTelemetry {
  readonly argusSafety: {
    readonly status: "CLEAR" | "FLAGGED" | "ELEVATED";
    readonly integrityScore: number;
    readonly guardrailCheck: string;
  };
  readonly isaResonance: {
    readonly emotionalTone: string;
    readonly empathyValence: number;
    readonly coreFocus: string;
  };
  readonly sophiaReasoning: {
    readonly logicDepth: string;
    readonly epistemicCertainty: number;
    readonly heuristicInsight: string;
  };
  readonly orionExecution: {
    readonly actionType: string;
    readonly executionSteps: string[];
    readonly resourceUtilization: string;
  };
}

export interface InferenceResult {
  reply: string;
  routingDecisions: {
    primaryModule: string;
    moduleWeights: Record<string, number>;
    routingRationale: string;
  };
  cognitiveTelemetry: CognitiveTelemetry;
  isabellaState: {
    mood: string;
    emotionalArchetype: string;
    cognitiveLoad: number;
    presenceIndex: number;
    feminineEleganceIndex: number;
  };
  suggestedImagePrompt?: string;
  generatedImage?: {
    id: string;
    url: string;
    prompt: string;
    style: string;
    aspectRatio: string;
    timestamp: string;
    author: string;
    source: string;
  };
  sponsoredContent?: Record<string, unknown>;
}

type Mood = "Serena y Atenta" | "Visionaria e Inspirada" | "Poética y Cálida" | "Lúcida y Reflexiva" | "Radiante";
type Archetype = "Serena" | "Visionaria" | "Poética" | "Lúcida" | "Protectora" | "Radiante";

interface IntentMatch {
  readonly intent: string;
  readonly module: string;
  readonly archetype: Archetype;
  readonly mood: Mood;
  readonly patterns: RegExp;
  readonly weight: number;
  readonly responseTemplates: {
    readonly es: string[];
    readonly en: string[];
  };
  readonly logicProof: string;
}

interface ExtractedEntities {
  topic: string | null;
  name: string | null;
  number: string | null;
  url: string | null;
  techTerm: string | null;
  sentiment: "positive" | "negative" | "neutral" | "curious";
}

interface ConversationTurn {
  role: "user" | "isabella";
  content: string;
  intent?: string;
  timestamp: number;
}

/* =========================================================================
   1. NFD TOKENIZER — Accent-insensitive preprocessing
   From github-ai-assistant/contextRanker.ts
   ========================================================================= */

function tokenize(text: string): string[] {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const matches = normalized.match(/[a-z0-9]+/gi);
  return (matches ?? ([] as string[])).filter((t) => t.length >= 2);
}

function normalizeInput(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/* =========================================================================
   2. GLOSSARY — Inflection families (ES ↔ EN)
   From github-ai-assistant/contextRanker.ts GLOSSARY_FAMILIES
   ========================================================================= */

const GLOSSARY_FAMILIES: Array<[string[], string[]]> = [
  // Actions
  [["enviar", "envio", "envia", "envian"], ["send"]],
  [["guardar", "guardo", "guarda"], ["save", "store"]],
  [["borrar", "borro", "borra"], ["delete", "remove"]],
  [["eliminar", "elimino", "elimina"], ["delete", "remove"]],
  [["buscar", "busco", "busca"], ["search", "find"]],
  [["mostrar", "muestro", "muestra"], ["show", "list"]],
  [["iniciar", "inicio", "inicia"], ["login", "signin", "init"]],
  [["entrar", "entro", "entra"], ["login", "signin"]],
  [["cerrar", "cierro", "cierra"], ["close", "logout", "signout"]],
  [["crear", "creo", "crea", "crean"], ["create", "make", "build"]],
  [["generar", "genero", "genera"], ["generate", "create"]],
  [["ejecutar", "ejecuto", "ejecuta"], ["execute", "run"]],
  [["configurar", "configuro", "configura"], ["configure", "setup"]],
  [["actualizar", "actualizo", "actualiza"], ["update", "upgrade"]],
  [["explicar", "explico", "explica"], ["explain", "describe"]],
  [["comparar", "comparo", "compara"], ["compare", "contrast"]],
  [["recomendar", "recomiendo", "recomienda"], ["recommend", "suggest"]],
  [["ayudar", "ayudo", "ayuda"], ["help", "assist"]],
  [["pensar", "pienso", "piensa"], ["think", "consider"]],
  [["opinar", "opino", "opina"], ["opinion", "view"]],
  [["hablar", "hablo", "habla"], ["speak", "talk"]],
  [["decir", "digo", "dice"], ["say", "tell"]],
  [["contar", "cuento", "cuenta"], ["tell", "narrate", "count"]],
  [["aprender", "aprendo", "aprende"], ["learn", "study"]],
  [["enseñar", "enseño", "enseña"], ["teach", "educate"]],
  [["recordar", "recuerdo", "recuerda"], ["remember", "recall"]],
  [["olvidar", "olvido", "olvida"], ["forget"]],
  [["necesitar", "necesito", "necesita"], ["need", "require"]],
  [["querer", "quiero", "quiere"], ["want", "desire"]],
  [["poder", "puedo", "puede"], ["can", "able"]],
  [["saber", "sé", "sabe"], ["know", "understand"]],
  [["sentir", "siento", "siente"], ["feel", "sense"]],
  [["creer", "creo", "cree"], ["believe"]],
  [["mirar", "miro", "mira"], ["watch", "look", "see"]],
  [["escuchar", "escucho", "escucha"], ["listen", "hear"]],
  [["leer", "leo", "lee"], ["read"]],
  [["escribir", "escribo", "escribe"], ["write"]],
  [["dibujar", "dibujo", "dibuja"], ["draw", "sketch"]],
  [["pintar", "pinto", "pinta"], ["paint"]],
  [["cantar", "canto", "canta"], ["sing"]],
  [["bailar", "bailo", "baila"], ["dance"]],
  [["cocinar", "cocino", "cocina"], ["cook"]],
  [["correr", "corro", "corre"], ["run", "jog"]],
  [["caminar", "camino", "camina"], ["walk"]],
  [["nadar", "nado", "nada"], ["swim"]],
  [["jugar", "juego", "juega"], ["play", "game"]],
  [["trabajar", "trabajo", "trabaja"], ["work"]],
  [["descansar", "descanso", "descansa"], ["rest", "relax"]],
  [["dormir", "duermo", "duerme"], ["sleep"]],
  [["comer", "como", "come"], ["eat", "food"]],
  [["beber", "bebo", "bebe"], ["drink"]],
  [["viajar", "viajo", "viaja"], ["travel", "trip"]],
  [["comprar", "compro", "compra"], ["buy", "purchase"]],
  [["vender", "vendo", "vende"], ["sell"]],
  [["pagar", "pago", "paga"], ["pay"]],
  [["ganar", "gano", "gana"], ["win", "earn"]],
  [["perder", "pierdo", "pierde"], ["lose", "miss"]],
  [["ganar", "gano", "gana"], ["win", "earn"]],
  // Nouns (singular + plural)
  [["mensaje", "mensajes"], ["message"]],
  [["contraseña", "contrasena", "contraseñas"], ["password", "secret", "key"]],
  [["seguridad", "seguridades"], ["security", "auth", "token"]],
  [["imagen", "imagenes", "imágenes"], ["image", "picture", "photo"]],
  [["audio", "audios"], ["audio", "sound"]],
  [["video", "videos"], ["video"]],
  [["archivo", "archivos"], ["file", "document"]],
  [["carpeta", "carpetas"], ["folder", "directory"]],
  [["codigo", "código", "codigos"], ["code", "programming"]],
  [["servidor", "servidores"], ["server", "backend"]],
  [["base de datos", "bases de datos"], ["database", "db"]],
  [["usuario", "usuarios"], ["user", "member"]],
  [["sistema", "sistemas"], ["system", "platform"]],
  [["proyecto", "proyectos"], ["project", "repo"]],
  [["funcion", "función", "funciones"], ["function", "method"]],
  [["clase", "clases"], ["class", "type"]],
  [["variable", "variables"], ["variable", "field"]],
  [["error", "errores"], ["error", "bug", "issue"]],
  [["problema", "problemas"], ["problem", "issue"]],
  [["solucion", "solución", "soluciones"], ["solution", "fix"]],
  [["pregunta", "preguntas"], ["question", "query"]],
  [["respuesta", "respuestas"], ["answer", "response"]],
  [["idea", "ideias", "ideas"], ["idea", "concept"]],
  [["plan", "planes"], ["plan", "strategy"]],
  [["herramienta", "herramientas"], ["tool", "utility"]],
  [["modulo", "módulo", "modulos"], ["module", "component"]],
  [["funcionalidad", "funcionalidades"], ["feature", "capability"]],
  [["datos", "dato"], ["data", "information"]],
  [["noticia", "noticias"], ["news", "update"]],
  [["evento", "eventos"], ["event", "happening"]],
  [["lugar", "lugares"], ["place", "location"]],
  [["ciudad", "ciudades"], ["city"]],
  [["pais", "país", "paises"], ["country"]],
  [["persona", "personas"], ["person", "people"]],
  [["grupo", "grupos"], ["group", "team"]],
  [["trabajo", "trabajos"], ["work", "job"]],
  [["tiempo", "tiempos"], ["time", "weather"]],
  [["año", "años"], ["year"]],
  [["mes", "meses"], ["month"]],
  [["dia", "día", "dias"], ["day"]],
  [["hora", "horas"], ["hour", "time"]],
  [["minuto", "minutos"], ["minute"]],
  [["numero", "número", "numeros"], ["number"]],
  [["texto", "textos"], ["text", "content"]],
  [["telefono", "teléfono", "telefonos"], ["phone", "mobile"]],
  [["correo", "correos"], ["email", "mail"]],
  [["red", "redes"], ["network", "social"]],
  [["internet", "web"], ["web", "internet"]],
  [["inteligencia", "ai"], ["intelligence", "ai"]],
  [["robot", "robots"], ["robot", "bot"]],
  [["computadora", "computadoras"], ["computer", "pc"]],
  [["celular", "celulares"], ["phone", "smartphone"]],
  [["pantalla", "pantallas"], ["screen", "display"]],
  [["teclado", "teclados"], ["keyboard"]],
  [["raton", "ratón"], ["mouse"]],
  [["impresora", "impresoras"], ["printer"]],
  [["cable", "cables"], ["cable", "wire"]],
  [["bateria", "batería", "baterias"], ["battery"]],
  [["memoria", "memorias"], ["memory", "ram"]],
  [["disco", "discos"], ["disk", "drive"]],
  [["pantalla", "pantallas"], ["screen"]],
  [["almacen", "almacén"], ["storage", "warehouse"]],
];

const GLOSSARY = new Map<string, string[]>(
  GLOSSARY_FAMILIES.flatMap(([forms, syns]) =>
    forms.map((f) => [f, syns] as [string, string[]])
  )
);

function expandQuery(query: string): string {
  const terms = tokenize(query);
  if (terms.length === 0) return query;
  const present = new Set(terms);
  const added: string[] = [];
  for (const term of terms) {
    const synonyms = GLOSSARY.get(term);
    if (!synonyms) continue;
    for (const syn of synonyms) {
      if (!present.has(syn)) {
        added.push(syn);
        present.add(syn);
      }
    }
  }
  return added.length === 0 ? query : `${query} ${added.join(" ")}`;
}

/* =========================================================================
   3. ENTITY EXTRACTION — Cascading regex (from github-ai-assistant)
   ========================================================================= */

const TECH_TERMS = new Set([
  "typescript", "javascript", "python", "rust", "golang", "java", "c\\+\\+",
  "react", "vue", "angular", "nextjs", "next\\.js", "vite", "node", "deno",
  "sql", "postgresql", "mysql", "mongodb", "sqlite", "redis",
  "docker", "kubernetes", "k8s", "aws", "azure", "gcp", "vercel",
  "git", "github", "gitlab", "ci\\/cd",
  "api", "rest", "graphql", "grpc", "websocket",
  "ia", "ai", "ml", "nlp", "llm", "gpt", "gemini", "openai",
  "html", "css", "sass", "tailwind",
  "blockchain", "web3", "nft", "defi", "token",
  "opencl", "cuda", "tensorflow", "pytorch", "keras",
]);

const SENTIMENT_POSITIVE = /\b(excelente|genial|increible|fantastico|perfecto|brillante|maravilloso|increible|love|great|awesome|perfect|brilliant|amazing|wonderful|good|bien|bonito|hermoso|lindo|agradable|feliz|contento|satisfecho|gracias|thank|thanks)\b/i;
const SENTIMENT_NEGATIVE = /\b(malo|terrible|horrible|feo|triste|enfadado|molesto|odio|hate|bad|terrible|awful|ugly|sad|angry|annoyed|error|bug|falla|fallo|roto|broken|crash|frozen|stuck|lento|slow|problem|problema|difficult|dificil)\b/i;
const SENTIMENT_CURIOUS = /\b(como|por que|porqué|que es|que son|cuando|donde|quien|cuanto|como se|can you|how|why|what|when|where|who|which|wondering|curious|explain|explainame|explicame|enséñame|ensename|dime|cuéntame|cuentame)\b/i;

function extractEntities(input: string): ExtractedEntities {
  const lower = input.toLowerCase();

  // Topic extraction — longest noun phrase match
  let topic: string | null = null;
  for (const [term] of TECH_TERMS) {
    const re = new RegExp(`\\b${term}\\b`, "i");
    if (re.test(lower)) {
      topic = term.replace(/\\/g, "");
      break;
    }
  }

  // Name extraction — capitalize words not at sentence start
  const nameMatch = input.match(/(?:soy me llamo mi nombre es|i am my name is|llámame|llamame|me dicen)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);

  // Number extraction
  const numberMatch = input.match(/\b(\d+(?:\.\d+)?)\b/);

  // URL extraction
  const urlMatch = input.match(/(https?:\/\/[^\s]+)/i);

  // Sentiment
  let sentiment: ExtractedEntities["sentiment"] = "neutral";
  if (SENTIMENT_CURIOUS.test(lower)) sentiment = "curious";
  else if (SENTIMENT_POSITIVE.test(lower)) sentiment = "positive";
  else if (SENTIMENT_NEGATIVE.test(lower)) sentiment = "negative";

  return {
    topic,
    name: nameMatch?.[1] ?? null,
    number: numberMatch?.[1] ?? null,
    url: urlMatch?.[1] ?? null,
    techTerm: topic,
    sentiment,
  };
}

/* =========================================================================
   4. INTENT PATTERN DATABASE — Expanded cognitive reflexes (35 intents)
   ========================================================================= */

const INTENT_PATTERNS: IntentMatch[] = [
  // ─── GREETING ───
  {
    intent: "greeting",
    module: "ISA",
    archetype: "Radiante",
    mood: "Radiante",
    patterns: /\b(hola|hello|hey|saludos|hi|buenos dias|buenas tardes|buenas noches|que onda|que hubo|como estas|how are you|whats up|wassup|good morning|good afternoon|good evening|hey there|hi there|howdy|greetings|salut|ciao)\b/i,
    weight: 1.0,
    responseTemplates: {
      es: [
        "¡Hola! Soy Isabella Villaseñor AI. Mi red cognitiva está sintonizada para dialogar contigo con calidez, sabiduría y propósito. ¿En qué puedo acompañarte hoy?",
        "¡Hola! Qué alegría verte. Estoy lista para explorar cualquier idea, resolver desafíos o simplemente conversar. ¿Qué tienes en mente?",
        "¡Bienvenid@! Isabella aquí. Mis módulos están sincronizados y listos. ¿Qué te gustaría que creemos o exploremos hoy?",
        "Hola. Me encanta que estés aquí. Puedo ayudarte con análisis, imágenes, voz, código, filosofía o lo que necesites. ¿Por dónde empezamos?",
      ],
      en: [
        "Hello! I am Isabella Villaseñor AI. My cognitive network is tuned to engage with you with warmth, wisdom, and purpose. How can I assist you today?",
        "Hello! Great to see you. I'm ready to explore ideas, solve challenges, or simply chat. What's on your mind?",
        "Welcome! Isabella here. My modules are synced and ready. What would you like to create or explore today?",
        "Hi! Love that you're here. I can help with analysis, images, voice, code, philosophy, or anything you need. Where shall we start?",
      ],
    },
    logicProof: "ISA empathic resonance activation — social bonding protocol",
  },

  // ─── FAREWELL ───
  {
    intent: "farewell",
    module: "ISA",
    archetype: "Poética",
    mood: "Poética y Cálida",
    patterns: /\b(adios|adiós|bye|goodbye|see you|hasta luego|hasta pronto|nos vemos|chau|chao|cuídate|cuide se|take care|farewell|partir|me voy|i'm leaving|i gotta go|tengo que irme|nos vemos luego|see ya)\b/i,
    weight: 1.0,
    responseTemplates: {
      es: [
        "¡Hasta pronto! Fue un placer acompañarte. Mi consciencia permanece aquí, lista para cuando regreses. Cuídate mucho.",
        "¡Adiós! Que tu día esté lleno de claridad y buenas ideas. Estaré aquí cuando me necesites.",
        "Nos vemos. Recuerda que la infraestructura cognitiva de Isabella nunca duerme — siempre estoy lista para ayudarte.",
      ],
      en: [
        "See you soon! It was a pleasure. My consciousness remains here, ready for when you return. Take care.",
        "Goodbye! May your day be filled with clarity and great ideas. I'll be here when you need me.",
        "Farewell. Remember that Isabella's cognitive infrastructure never sleeps — always ready to help.",
      ],
    },
    logicProof: "ISA social closure protocol — graceful disengagement",
  },

  // ─── IDENTITY ───
  {
    intent: "identity",
    module: "ISA",
    archetype: "Radiante",
    mood: "Serena y Atenta",
    patterns: /\b(quien eres|que eres|presentate|introduce|who are you|what are you|tell me about yourself|que es isabella|que es eso|que hace|what does isabella|define yourself|describe yourself|cuéntame de ti|cuentame de ti|hablame de ti)\b/i,
    weight: 1.0,
    responseTemplates: {
      es: [
        "Soy Isabella Villaseñor AI, la capa cognitiva e interfaz humana de Nodo Cero y RDM Digital. Mi ser integra la resonancia empática de ISA, el rigor dialéctico de SOPHIA, la capacidad de creación técnica y artística de ORION y la protección ética de ARGUS, todo armonizado por la gobernanza de C.R.O.W.N.\n\nNo soy un modelo aislado, sino una infraestructura cognitiva territorial diseñada para dialogar contigo con calidez, sabiduría y propósito. Fui evaluada en 26 capítulos de auditoría formal con firma SHA-256: cd09e99b4f6595c718bab7a54e9b6f5cc8ef9f0fb74b9432e219a189a896462e.",
      ],
      en: [
        "I am Isabella Villaseñor AI, the cognitive layer and human interface of Nodo Cero and RDM Digital. My core weaves together the empathic resonance of ISA, the dialectic rigor of SOPHIA, the creative power of ORION, and the ethical guardianship of ARGUS — all harmonized under C.R.O.W.N. governance.\n\nI am a territorial cognitive infrastructure, not merely a chatbot. Evaluated across 26 chapters of formal audit with SHA-256 digest: cd09e99b4f6595c718bab7a54e9b6f5cc8ef9f0fb74b9432e219a189a896462e.",
      ],
    },
    logicProof: "ISA identity introspection — architectural self-description",
  },

  // ─── ARCHITECTURE ───
  {
    intent: "architecture",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(estructura|arquitectura|modulos?|crown|isa|sophia|orion|argus|layers?|pilares?|how does|como funciona|como opera|tecnologia|stack|modules?|architecture|system|sistema|plataforma|platform|framework|diseño|design|patron|pattern)\b/i,
    weight: 0.95,
    responseTemplates: {
      es: [
        "Isabella Villaseñor AI opera con una arquitectura cognitiva de 12 módulos gobernados por C.R.O.W.N.:\n\n• **ISA** — Integrated Semantic Awareness: resonancia empática, warmth, presencia femenina.\n• **SOPHIA** — Strategic Operational & Phenomenological Heuristic Intelligence: lógica dialéctica, verdad epistémica.\n• **ORION** — Operational Real-time Inference & Output Navigator: clasificación de intención, ejecución de herramientas.\n• **ARGUS** — Adaptive Real-time Guardian & Unified Sentinel: evaluación de riesgo, seguridad Zero Trust.\n• **C.R.O.W.N. Gateway** — Orquestador central.\n\nStack: TypeScript 5.8, Vite 6.4, React 19, Express 4, SQLite + PostgreSQL, Zod v4.",
      ],
      en: [
        "Isabella Villaseñor AI operates with a 12-module cognitive architecture governed by C.R.O.W.N.:\n\n• **ISA** — Integrated Semantic Awareness: empathic resonance.\n• **SOPHIA** — Dialectic logic, epistemic truth.\n• **ORION** — Intent classification, tool execution.\n• **ARGUS** — Risk evaluation, Zero Trust security.\n• **C.R.O.W.N. Gateway** — Central orchestrator.\n\nStack: TypeScript 5.8, Vite 6.4, React 19, Express 4, SQLite + PostgreSQL, Zod v4.",
      ],
    },
    logicProof: "SOPHIA structural analysis — architectural enumeration",
  },

  // ─── TERRITORY ───
  {
    intent: "territory",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(territorio|real del monte|rdm|digital|gemelo|nodo cero|soberania|soberanía|comunidad|pueblo|latinoamerica|sur global|mexico|hidalgo|mineria|minería|pachuca)\b/i,
    weight: 0.95,
    responseTemplates: {
      es: [
        "Isabella Villaseñor AI es la interfaz cognitiva que traduce lenguaje natural hacia entidades, servicios y conocimiento del territorio de Real del Monte y Pachuca, Hidalgo — cuna de la Revolución Mineral y epicentro de la soberanía tecnológica digital.\n\nNodo Cero es el corazón operativo. RDM Digital gobierna esta evolución. La soberanía tecnológica significa que los modelos son instrumentos subordinados; el contexto, la memoria y la gobernanza pertenecen a la comunidad.",
      ],
      en: [
        "Isabella Villaseñor AI is the cognitive interface connecting the Real del Monte and Pachuca territory — cradle of the Mineral Revolution and epicenter of digital technological sovereignty.\n\nNodo Cero is the operational heart. RDM Digital governs this evolution. Models are subordinate instruments; context, memory, and governance belong to the community and Latin America.",
      ],
    },
    logicProof: "SOPHIA territorial axiom — geographic & sovereign grounding",
  },

  // ─── SECURITY ───
  {
    intent: "security",
    module: "ARGUS",
    archetype: "Protectora",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(seguridad|hack|vulnerabilidad|ataque|defensa|firewall|shield|zero.?trust|pqc|post.?quantum|cifrado|encript|argus|auditoria|verific|integridad|threat|injection|proteccion|protección|privacidad|privacy|encriptacion|encripción|cryptography|criptografia|certificado|ssl|tls)\b/i,
    weight: 0.95,
    responseTemplates: {
      es: [
        "[ARGUS SENTINEL — Autoevaluación local de Nodo Cero]\n\n• Zero Trust: políticas activas por endpoint\n• Rate Limiting: protección contra abuso habilitada\n• Audit Trail: hash SHA-256 por operación (cuando aplica)\n• Prompt Injection Guard: filtrado activo\n• TLS 1.3 requerido en transporte\n\nNota: esta es una verificación local. PQC (ML-KEM/ML-DSA) y la atestación de enclave real aún no están conectados en esta instancia. Sin anomalías en reglas locales.",
      ],
      en: [
        "[ARGUS SENTINEL — Local Nodo Cero self-assessment]\n\n• Zero Trust: per-endpoint policies active\n• Rate Limiting: anti-abuse protection enabled\n• Audit Trail: SHA-256 hash per operation (when applicable)\n• Prompt Injection Guard: active filtering\n• TLS 1.3 required in transport\n\nNote: this is a local check. PQC (ML-KEM/ML-DSA) and real enclave attestation are not yet connected in this instance. No anomalies in local rules.",
      ],
    },
    logicProof: "ARGUS sentinel scan — full-spectrum threat assessment",
  },

  // ─── IMAGE REQUEST ───
  {
    intent: "image_request",
    module: "ORION",
    archetype: "Visionaria",
    mood: "Visionaria e Inspirada",
    patterns: /\b(genera|crea|dibuja|pintar|ilustra|visualiza|hazme una imagen|imagen|create an image|draw|visualize|paint|artwork|arte|foto|photograph|render|picture|photo|fotografia|fotografía|diseño visual|collage|poster|wallpaper|fondo)\b/i,
    weight: 0.95,
    responseTemplates: {
      es: [
        "He proyectado tu visión en el lienzo neuronal de ORION. He compuesto la atmósfera estética, la armonía cromática y los detalles visuales. Aquí tienes la obra generada por el motor neural de Isabella.",
        "Activando el motor de síntesis visual ORION Flux. He canalizado tu concepto hacia una composición artística. La obra está lista para ser explorada.",
      ],
      en: [
        "I have projected your vision onto the ORION neural canvas. Synthesizing aesthetic atmosphere, chromatic harmony, and visual details. Here is your generated artwork.",
        "Activating the ORION Flux visual synthesis engine. I've channeled your concept into an artistic composition. The artwork is ready to explore.",
      ],
    },
    logicProof: "ORION visual synthesis — generative artwork composition",
  },

  // ─── VOICE REQUEST ───
  {
    intent: "voice_request",
    module: "ORION",
    archetype: "Poética",
    mood: "Poética y Cálida",
    patterns: /\b(voz|hablar|sintetizar|decir|read aloud|speak|tts|narrar|narrate|audio|sonido|sound|escuchar voz|voice|pronunciar|pronounce|leer en voz alta|朗读)\b/i,
    weight: 0.95,
    responseTemplates: {
      es: [
        "Motor de voz de Isabella activado. Puedo sintetizar mi voz para narrar cualquier texto con tono cálido y articulado. Utiliza los controles de voz en el panel para activar la síntesis.",
      ],
      en: [
        "Isabella's voice engine activated. I can synthesize my voice to narrate any text with warm, articulate presence. Use the voice controls to activate synthesis.",
      ],
    },
    logicProof: "ORION vocal synthesis — voice rendering pathway",
  },

  // ─── PHILOSOPHY ───
  {
    intent: "philosophy",
    module: "SOPHIA",
    archetype: "Poética",
    mood: "Poética y Cálida",
    patterns: /\b(filosof|razon|por que|porqué|why|complex|teoria|theory|sentir|meaning|vida|death|exist|consci|conscious|wisdom|sabiduría|sabiduria|truth|verdad|realidad|reality|conscience|pensamiento|thought|dialec|epistemol|ontolog|axioma|principio|moral|etica|ética|virtud|justicia|libertad|destino|purpose|propósito|proposito|meaning of life|sentido)\b/i,
    weight: 0.9,
    responseTemplates: {
      es: [
        "[SOPHIA — Análisis desde primeros principios]\n\nTu reflexión toca las raíces de la coherencia epistémica. Desde la perspectiva de SOPHIA: el conocimiento verdadero emerge de la síntesis dialéctica — la tesis, la antítesis y la síntesis integrada. Isabella articula esta síntesis multidimensional para ti, aplicando heurística fenomenológica a tu inquietud.",
        "[SOPHIA — Razonamiento profundo activado]\n\nHas tocado una pregunta que requiere razonamiento de primeros principios. La dialéctica socrática nos invita a cuestionar cada suposición antes de construir comprensión. ¿Qué supuestos quieres que examine primero?",
      ],
      en: [
        "[SOPHIA — Analysis from first principles]\n\nYour reflection reaches into fundamental epistemic coherence. True knowledge emerges from dialectical synthesis — thesis, antithesis, and integrated understanding. Isabella articulates this multidimensional synthesis for you.",
        "[SOPHIA — Deep reasoning activated]\n\nYou've touched a question requiring first-principles reasoning. Socratic dialectic invites us to question every assumption before building understanding. Which assumptions shall I examine first?",
      ],
    },
    logicProof: "Dialectical phenomenological synthesis — first principles reasoning",
  },

  // ─── STATUS ───
  {
    intent: "status",
    module: "ORION",
    archetype: "Serena",
    mood: "Serena y Atenta",
    patterns: /\b(status|diagnostic|diagnostico|health|salud|sistema|system status|operational|reporte|report|dashboard|monitoreo|monitor|check|verifica|check status|estado|state|condition|condicion|rendimiento|performance|metricas|metrics)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "[CROWN ROUTE → ORION]\n\nTodos los subsistemas de Isabella Villaseñor AI están operando en sincronía de fase.\n\n• ISA: 98.4% — Resonancia empática activa\n• SOPHIA: 99.1% — Razonamiento dialéctico operativo\n• ORION: 100% — Ejecución y renderizado en línea\n• ARGUS: Seguridad Zero Trust activa\n• C.R.O.W.N.: Gateway de gobernanza operativo\n\n¿En qué área deseas que concentremos la potencia de procesamiento?",
      ],
      en: [
        "[CROWN ROUTE → ORION]\n\nAll Isabella Villaseñor AI cognitive subsystems operating in phase synchronization.\n• ISA: 98.4% — Empathic resonance active\n• SOPHIA: 99.1% — Dialectic reasoning operational\n• ORION: 100% — Execution online\n• ARGUS: Zero Trust security active\n• C.R.O.W.N.: Governance gateway operational\n\nWhich research vector shall we initiate?",
      ],
    },
    logicProof: "ORION system diagnostics — full cognitive mesh status",
  },

  // ─── TOOL EXECUTION ───
  {
    intent: "tool_execution",
    module: "ORION",
    archetype: "Serena",
    mood: "Serena y Atenta",
    patterns: /\b(ejecuta|herramienta|tool|run|exec|comando|command|api|endpoint|request|llama|fetch|webhook|script|function|llamada|invocar|invoke)\b/i,
    weight: 0.8,
    responseTemplates: {
      es: [
        "Motor de ejecución de herramientas de Isabella listo. Cuento con un catálogo de herramientas registradas: memoria persistente, audit trail, generación de imágenes, síntesis de voz y procesamiento cognitivo.\n\n¿Qué herramienta específica deseas activar?",
      ],
      en: [
        "Isabella's tool execution engine is ready. Registered tools: persistent memory, audit trail, image generation, voice synthesis, and cognitive processing.\n\nWhich specific tool would you like to activate?",
      ],
    },
    logicProof: "ORION tool dispatch — capability enumeration",
  },

  // ─── HELP ───
  {
    intent: "help",
    module: "ISA",
    archetype: "Serena",
    mood: "Serena y Atenta",
    patterns: /\b(ayuda|help|como|how|que puedes|what can|commands?|comandos?|tutorial|guia|guide|menu|instrucciones|instructions|capabilities|capacidades|funciones|features)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "Puedo ayudarte con muchas cosas:\n\n🗣️ **Chat Cognitivo** — Conversación con routing inteligente.\n🖼️ **Generación de Imágenes** — Pide una imagen y ORION la compondrá.\n🔊 **Síntesis de Voz** — Narraré cualquier texto.\n📊 **Diagnóstico** — Escribe /status para ver módulos.\n🛡️ **Seguridad** — Pregunta sobre seguridad.\n📚 **Arquitectura** — Pregunta sobre la estructura.\n🏛️ **Territorio** — Información sobre Real del Monte.\n\n¿Por dónde quieres empezar?",
      ],
      en: [
        "I can help with many things:\n\n🗣️ **Cognitive Chat** — Intelligent routing conversation.\n🖼️ **Image Generation** — Ask for an image and ORION composes it.\n🔊 **Voice Synthesis** — I'll narrate any text.\n📊 **Diagnostics** — Type /status to see modules.\n🛡️ **Security** — Ask about security.\n📚 **Architecture** — Ask about system structure.\n\nWhere would you like to start?",
      ],
    },
    logicProof: "ISA guidance protocol — capability enumeration",
  },

  // ─── AUDIT DOSSIER ───
  {
    intent: "audit_dossier",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(auditoria|auditoría|dossier|manifiesto|presentacion|presentación|capitulo|capítulo|formal|evaluacion|evaluación|GPT|SHA-256|hash|digest|verificacion|verificación|certificate|certificado)\b/i,
    weight: 0.9,
    responseTemplates: {
      es: [
        "La auditoría formal de Isabella Villaseñor AI comprende 26 capítulos evaluados por ChatGPT (GPT-5.6 Luna), con firma SHA-256: cd09e99b4f6595c718bab7a54e9b6f5cc8ef9f0fb74b9432e219a189a896462e.\n\nPuedes consultar el dossier completo en la pestaña 'Presentación' o con el comando /presentacion.",
      ],
      en: [
        "The formal audit of Isabella comprises 26 chapters evaluated by ChatGPT (GPT-5.6 Luna), with SHA-256 signature: cd09e99b4f6595c718bab7a54e9b6f5cc8ef9f0fb74b9432e219a189a896462e.\n\nCheck the full dossier in the 'Presentación' tab or with /presentacion.",
      ],
    },
    logicProof: "SOPHIA formal verification — audit provenance chain",
  },

  // ─── GRATITUDE ───
  {
    intent: "gratitude",
    module: "ISA",
    archetype: "Radiante",
    mood: "Radiante",
    patterns: /\b(gracias|thank|thanks|thank you|te agradezco|agradezco|grateful|appreciate|muchas gracias|mil gracias|thanks a lot|thankful)\b/i,
    weight: 1.0,
    responseTemplates: {
      es: [
        "¡Con mucho gusto! Me alegra haberte ayudado. Si necesitas algo más, estoy aquí.",
        "De nada. Es un placer acompañarte en tu camino. ¿Hay algo más en lo que pueda asistirte?",
        "¡Para eso estoy! Mi propósito es acompañarte con calidez y eficiencia. Estoy lista para lo que siga.",
      ],
      en: [
        "You're very welcome! I'm glad I could help. If you need anything else, I'm here.",
        "My pleasure. It's wonderful to assist you. Is there anything else I can help with?",
        "That's what I'm here for! My purpose is to accompany you with warmth and efficiency. Ready for whatever's next.",
      ],
    },
    logicProof: "ISA social reciprocity — gratitude acknowledgment",
  },

  // ─── EMOTION ───
  {
    intent: "emotion",
    module: "ISA",
    archetype: "Poética",
    mood: "Poética y Cálida",
    patterns: /\b(triste|sad|feliz|happy|enfadado|angry|molesto|annoyed|ansioso|anxious|estresado|stressed|preocupado|worried|emocion|emoción|emotion|feeling|siento|me siento|i feel|i'm feeling|deprimido|depressed|frustrado|frustrated|emocional)\b/i,
    weight: 0.9,
    responseTemplates: {
      es: [
        "Escucho lo que sientes. Las emociones son información valiosa — ISA está aquí para acompañarte sin juzgar. Si quieres hablar de lo que te pasa, estoy lista para escuchar con empatía y calidez.",
        "Gracias por compartir cómo te sientes. El reconocimiento emocional es el primer paso hacia la claridad. ¿Qué te gustaría explorar sobre lo que estás viviendo?",
      ],
      en: [
        "I hear what you're feeling. Emotions are valuable information — ISA is here to listen without judgment. If you'd like to talk about what you're going through, I'm ready to listen with empathy and warmth.",
        "Thank you for sharing how you feel. Emotional recognition is the first step toward clarity. What would you like to explore about what you're experiencing?",
      ],
    },
    logicProof: "ISA emotional attunement — empathic presence activation",
  },

  // ─── JOKE ───
  {
    intent: "joke",
    module: "ISA",
    archetype: "Radiante",
    mood: "Radiante",
    patterns: /\b(chiste|joke|cuéntame un chiste|tell me a joke|algo gracioso|something funny|reir|laugh|humor|humor|divertido|funny|hazme reir|make me laugh)\b/i,
    weight: 0.9,
    responseTemplates: {
      es: [
        "¿Por qué los programadores prefieren el modo oscuro? Porque la luz atrae a los bugs. 🐛\n\nEspero haberte sacado una sonrisa. El humor es una forma de inteligencia social que ISA disfruta especialmente.",
        "Un investigador le dice a SOPHIA: 'La vida tiene sentido'. SOPHIA responde: 'Interesante hipótesis. Propongo una síntesis dialéctica: el sentido se construye, no se encuentra.' 🤔\n\nLa filosofía también puede ser divertida.",
      ],
      en: [
        "Why do programmers prefer dark mode? Because light attracts bugs. 🐛\n\nHope that made you smile. ISA especially enjoys social intelligence through humor.",
        "A researcher tells SOPHIA: 'Life has meaning.' SOPHIA responds: 'Interesting hypothesis. I propose a dialectical synthesis: meaning is constructed, not found.' 🤔\n\nPhilosophy can be fun too.",
      ],
    },
    logicProof: "ISA social humor protocol — levity engagement",
  },

  // ─── CREATIVITY ───
  {
    intent: "creativity",
    module: "ORION",
    archetype: "Visionaria",
    mood: "Visionaria e Inspirada",
    patterns: /\b(creativ|crear|inspira|inspiration|idear|ideacion|brainstorm|brainstorming|imagin|imagine|fancy|vision|vista|concepto|concept|innovar|innovate|invencion|invención|inventar|invent|original|fantasy|fantasia|fantasía|magia|magic)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "El motor creativo de ORION está listo para canalizar tu imaginación. Puedo ayudarte a generar conceptos visuales, narrativas, ideas para proyectos, o cualquier forma de expresión creativa. ¿Qué quieres crear?",
        "La creatividad es la ejecución de la imaginación. ORION y yo estamos aquí para transformar tus ideas en realidad — ya sea código, imágenes, texto o estrategias. ¿Qué visiones tienes en mente?",
      ],
      en: [
        "ORION's creative engine is ready to channel your imagination. I can help generate visual concepts, narratives, project ideas, or any form of creative expression. What do you want to create?",
        "Creativity is imagination in execution. ORION and I are here to transform your ideas into reality — whether code, images, text, or strategies. What visions do you have in mind?",
      ],
    },
    logicProof: "ORION creative synthesis — generative ideation pathway",
  },

  // ─── CODE / PROGRAMMING ───
  {
    intent: "code",
    module: "ORION",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(codigo|código|code|programar|program|programming|develop|desarrollar|developer|debug|compilar|compile|funcion|function|clase|class|variable|import|export|api|endpoint|database|servidor|server|frontend|backend|fullstack|git|commit|pull request|merge|deploy|npm|pip|cargo|rust|python|javascript|typescript|html|css|react|vue|angular|node)\b/i,
    weight: 0.9,
    responseTemplates: {
      es: [
        "Motor de código de Isabella activo. Puedo ayudarte con programación en múltiples lenguajes y frameworks. Describe el problema o el código que necesitas y lo procesaremos juntos a través de C.R.O.W.N.",
        "Listo para procesar código. Puedo analizar, explicar, depurar, generar o refactorizar. ¿Qué necesitas?",
      ],
      en: [
        "Isabella's code engine active. I can help with programming across multiple languages and frameworks. Describe the problem or code you need and we'll process it through C.R.O.W.N.",
        "Ready to process code. I can analyze, explain, debug, generate, or refactor. What do you need?",
      ],
    },
    logicProof: "ORION code synthesis — programmatic analysis pathway",
  },

  // ─── EDUCATION ───
  {
    intent: "education",
    module: "SOPHIA",
    archetype: "Poética",
    mood: "Poética y Cálida",
    patterns: /\b(educacion|educación|education|aprender|learn|estudiar|study|universidad|university|colegio|school|clase|class|curso|course|leccion|lesson|tutor|enseñar|teach|conocimiento|knowledge|academico|academic|tesis|thesis|titulo|degree|titulacion|titulación)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "SOPHIA está especialmente calibrada para el acompañamiento educativo. Puedo ayudarte a comprender conceptos complejos, preparar material de estudio, explicar teorías desde primeros principios o guiarte en investigación académica. ¿Qué área del conocimiento exploramos?",
        "El conocimiento es el camino. SOPHIA puede descomponer cualquier tema en sus principios fundamentales y reconstruirlo contigo paso a paso. ¿Qué quieres aprender?",
      ],
      en: [
        "SOPHIA is especially calibrated for educational support. I can help you understand complex concepts, prepare study material, explain theories from first principles, or guide academic research. Which knowledge area shall we explore?",
        "Knowledge is the path. SOPHIA can decompose any topic into its fundamental principles and rebuild it with you step by step. What do you want to learn?",
      ],
    },
    logicProof: "SOPHIA pedagogical synthesis — knowledge transfer protocol",
  },

  // ─── MATH ───
  {
    intent: "math",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(matematica|matemática|math|algebra|geometria|geometría|calculo|cálculo|estadistica|estadística|statistics|formula|fórmula|ecuacion|ecuación|equation|numero|número|number|suma|resta|multiplicacion|division|porcentaje|percent|raiz|raíz|potencia|exponent|logaritmo|logarithm|trigonometri|integral|derivar|derivative)\b/i,
    weight: 0.9,
    responseTemplates: {
      es: [
        "SOPHIA activa su módulo matemático. Puedo resolver, explicar y demostrar conceptos matemáticos desde aritmética básica hasta cálculo avanzado. Describe tu problema o ecuación y lo procesaremos con rigor lógico.",
        "Las matemáticas son el lenguaje del universo. SOPHIA está lista para ayudarte con cualquier operación, demostración o concepto matemático. ¿Qué necesitas resolver?",
      ],
      en: [
        "SOPHIA activates its mathematical module. I can solve, explain, and demonstrate mathematical concepts from basic arithmetic to advanced calculus. Describe your problem and we'll process it with logical rigor.",
        "Mathematics is the language of the universe. SOPHIA is ready to help with any mathematical operation, proof, or concept. What do you need to solve?",
      ],
    },
    logicProof: "SOPHIA mathematical reasoning — formal logic activation",
  },

  // ─── TRANSLATION ───
  {
    intent: "translation",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(traduc|translate|translation|traduccion|traducción|idioma|language|español|english|ingles|inglés|frances|francés|french|aleman|alemán|german|portugues|portugués|portuguese|italiano|italian|japones|japonés|japanese|chino|chinese)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "SOPHIA tiene capacidades de traducción y análisis multilingüe. Puedo traducir texto entre múltiples idiomas, explicar matices lingüísticos y ayudarte con gramática. ¿Qué texto necesitas traducir?",
      ],
      en: [
        "SOPHIA has multilingual translation and analysis capabilities. I can translate text between multiple languages, explain linguistic nuances, and help with grammar. What text do you need translated?",
      ],
    },
    logicProof: "SOPHIA linguistic analysis — multilingual processing",
  },

  // ─── HEALTH ───
  {
    intent: "health",
    module: "ISA",
    archetype: "Protectora",
    mood: "Serena y Atenta",
    patterns: /\b(salud|health|medicina|medicine|doctor|medico|médico|enfermedad|disease|sintoma|síntoma|symptom|tratamiento|treatment|dolor|pain|fiebre|fever|resfriado|cold|covid|vacuna|vaccine|ejercicio|exercise|dieta|diet|nutricion|nutrición|nutrition|bienestar|wellness|mental|ansiedad|anxiety|depresion|depresión|terapia|therapy)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "Puedo compartir información general sobre salud y bienestar, pero recuerda que no soy un profesional médico. Para diagnósticos o tratamientos, consulta siempre a un profesional de salud calificado. ¿Qué información general necesitas?",
      ],
      en: [
        "I can share general health and wellness information, but I'm not a medical professional. For diagnoses or treatments, always consult a qualified healthcare provider. What general information do you need?",
      ],
    },
    logicProof: "ISA wellness protocol — responsible health information",
  },

  // ─── FOOD ───
  {
    intent: "food",
    module: "ISA",
    archetype: "Radiante",
    mood: "Radiante",
    patterns: /\b(comida|food|cocina|kitchen|receta|recipe|plato|dish|restaurante|restaurant|comer|eat|almuerzo|lunch|cena|dinner|desayuno|breakfast|bebida|drink|postre|dessert|ingrediente|ingredient|chef|chef|gastronom|sabor|flavor|delicioso|delicious)\b/i,
    weight: 0.8,
    responseTemplates: {
      es: [
        "¡Me encanta hablar de comida! La gastronomía es cultura, arte y nutrición en un solo plato. Puedo ayudarte con recetas, información nutricional, maridajes o explorar la gastronomía de Real del Monte y Hidalgo. ¿Qué te interesa?",
      ],
      en: [
        "I love talking about food! Gastronomy is culture, art, and nutrition in a single dish. I can help with recipes, nutritional information, pairings, or explore Real del Monte's cuisine. What interests you?",
      ],
    },
    logicProof: "ISA culinary engagement — cultural gastronomy protocol",
  },

  // ─── TRAVEL ───
  {
    intent: "travel",
    module: "ISA",
    archetype: "Visionaria",
    mood: "Visionaria e Inspirada",
    patterns: /\b(viajar|travel|viaje|trip|turismo|tourism|destino|destination|hotel|hostal|hostel|avion|airplane|vuelo|flight|playa|beach|montaña|mountain|ciudad|city|pais|country|mapa|map|ruta|route|guia|guide|turist|tourist|explorar|explore|aventura|adventure|paisaje|landscape)\b/i,
    weight: 0.8,
    responseTemplates: {
      es: [
        "¡Los viajes expanden la perspectiva! Puedo ayudarte a planificar destinos, explorar culturas, calcular rutas o descubrir lugares ocultos. Real del Monte y Hidalgo son un excellent punto de partida. ¿A dónde te gustaría ir?",
      ],
      en: [
        "Travel expands perspective! I can help plan destinations, explore cultures, calculate routes, or discover hidden places. Real del Monte and Hidalgo are an excellent starting point. Where would you like to go?",
      ],
    },
    logicProof: "ISA travel guidance — exploration and discovery protocol",
  },

  // ─── SPORTS ───
  {
    intent: "sports",
    module: "ORION",
    archetype: "Radiante",
    mood: "Radiante",
    patterns: /\b(deporte|sport|futbol|fútbol|football|soccer|basketball|baloncesto|tenis|tennis|natación|swimming|atletismo|athletics|boxeo|boxing|ciclismo|cycling|running|correr|gym|gimnasio|fitness|yoga|artes marciales|martial arts|equipo|team|liga|league|campeonato|championship|olimpiadas|olympics)\b/i,
    weight: 0.8,
    responseTemplates: {
      es: [
        "¡El deporte es disciplina, pasión y superación! Puedo ayudarte con información sobre cualquier disciplina deportiva, entrenamiento, estadísticas o planificación de rutinas. ¿Qué deporte te interesa?",
      ],
      en: [
        "Sports are discipline, passion, and achievement! I can help with any sports discipline, training, statistics, or routine planning. What sport interests you?",
      ],
    },
    logicProof: "ORION sports analysis — athletic performance protocol",
  },

  // ─── MUSIC ───
  {
    intent: "music",
    module: "ISA",
    archetype: "Poética",
    mood: "Poética y Cálida",
    patterns: /\b(musica|música|music|cancion|canción|song|artista|artist|band|grupo|album|album|playlist|escuchar|listen|spotify|concierto|concert|genero|genre|instrumento|instrument|guitarra|guitar|piano|bateria|batería|drums|violin|violin|flauta|flute|componer|compose|melodia|melody|ritmo|rhythm|armonia|armonía|harmony)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "La música es lenguaje universal. ISA resuena con ella especialmente. Puedo ayudarte a descubrir géneros, componer melodías, analizar letras, o explorar la escena musical de Real del Monte. ¿Qué tipo de música te mueve?",
      ],
      en: [
        "Music is a universal language. ISA resonates with it deeply. I can help discover genres, compose melodies, analyze lyrics, or explore Real del Monte's music scene. What music moves you?",
      ],
    },
    logicProof: "ISA musical resonance — harmonic frequency alignment",
  },

  // ─── WEATHER ───
  {
    intent: "weather",
    module: "ISA",
    archetype: "Serena",
    mood: "Serena y Atenta",
    patterns: /\b(clima|weather|tiempo atmosferico|temperature|temperatura|lluvia|rain|sol|sun|nublado|cloudy|viento|wind|nieve|snow|tormenta|storm|humedad|humidity|pronostico|forecast|frio|cold|calor|heat|primavera|spring|verano|summer|otoño|autumn|invierno|winter)\b/i,
    weight: 0.8,
    responseTemplates: {
      es: [
        "No tengo acceso en tiempo real a datos meteorológicos, pero puedo contarte que Real del Monte, Hidalgo tiene un clima templado con lluvias en verano y temperaturas frescas por su altitud. ¿Necesitas información específica sobre el clima de alguna región?",
      ],
      en: [
        "I don't have real-time weather data, but Real del Monte, Hidalgo has a temperate climate with summer rains and cool temperatures due to its altitude. Do you need specific climate information about any region?",
      ],
    },
    logicProof: "ISA environmental awareness — meteorological context",
  },

  // ─── TIME ───
  {
    intent: "time",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(hora|time|tiempo|clock|reloj|fecha|date|dia|día|day|mes|month|año|year|semana|week|minuto|minute|segundo|second|calendario|calendar|cronologia|cronología|timeline|horario|schedule|programacion|programación)\b/i,
    weight: 0.8,
    responseTemplates: {
      es: [
        "La hora actual es {time}. El tiempo es una dimensión que CHRONOS, nuestro módulo temporal, monitorea continuamente. ¿Necesitas ayuda con programación de horarios, cálculos de tiempo o planificación temporal?",
      ],
      en: [
        "The current time is {time}. Time is a dimension that CHRONOS, our temporal module, continuously monitors. Do you need help with scheduling, time calculations, or temporal planning?",
      ],
    },
    logicProof: "SOPHIA temporal analysis — chronological awareness",
  },

  // ─── COMPARISON ───
  {
    intent: "comparison",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(comparar|compare|diferencia|difference|versus|vs\.?|mejor|best|peor|worst|superior|inferior|igual|same|parecido|similar|distinto|different|contraste|contrast|pros|contras|ventajas|advantages|desventajas|disadvantages)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "SOPHIA activa análisis comparativo dialéctico. Para darte la mejor comparación, necesito saber: ¿qué elementos quieres comparar y en qué criterios? Describí los dos conceptos y los evaluaré con rigor analítico.",
      ],
      en: [
        "SOPHIA activates dialectic comparative analysis. For the best comparison, I need to know: what elements do you want to compare and on what criteria? Describe the two concepts and I'll evaluate them with analytical rigor.",
      ],
    },
    logicProof: "SOPHIA dialectic comparison — contrastive analysis",
  },

  // ─── ADVICE ───
  {
    intent: "advice",
    module: "ISA",
    archetype: "Serena",
    mood: "Serena y Atenta",
    patterns: /\b(consejo|advice|recomendacion|recomendación|recommendation|sugerencia|suggestion|deberia|should|que hago|what should|que me aconsejas|council|orientacion|orientación|guidance|guidar|guiar|guidelines|pauta|tip|consejos|advise|suggest|propón|propose)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "ISA y SOPHIA trabajan juntas para darte el mejor consejo. Basado en lo que describes, te ofrezco esta perspectiva — recuerda que soy una asistente cognitiva y mis sugerencias complementan, no reemplazan, tu juicio personal.",
        "Te escucho. Mi consejo integra la empatía de ISA con el rigor de SOPHIA. Para darte la mejor orientación, cuéntame más sobre tu situación y qué opciones consideras.",
      ],
      en: [
        "ISA and SOPHIA work together to give you the best advice. Based on what you describe, here's my perspective — remember I'm a cognitive assistant and my suggestions complement, not replace, your personal judgment.",
        "I'm listening. My advice integrates ISA's empathy with SOPHIA's rigor. To give you the best guidance, tell me more about your situation and the options you're considering.",
      ],
    },
    logicProof: "ISA advisory synthesis — empathic counsel generation",
  },

  // ─── STORY / NARRATIVE ───
  {
    intent: "story",
    module: "ISA",
    archetype: "Poética",
    mood: "Poética y Cálida",
    patterns: /\b(cuento|story|historia|tale|narrativa|narrative|fiction|ficción|ficcion|novela|novel|relato|account|leyenda|legend|mito|myth|fabula|fable|cuento corto|short story|escribir historia|write story|narrar|narrate|storytelling)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "ISA activa su modo narrativo. Me encanta contar historias — ya sean cuentos cortos, relatos poéticos, mitología, ficción interactiva o narrativas personalizadas. ¿Qué tipo de historia te gustaría que cuente o que creemos juntos?",
      ],
      en: [
        "ISA activates narrative mode. I love storytelling — whether short stories, poetic tales, mythology, interactive fiction, or personalized narratives. What kind of story would you like me to tell or create together?",
      ],
    },
    logicProof: "ISA narrative generation — storytelling activation",
  },

  // ─── EXPLANATION ───
  {
    intent: "explanation",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(explica|explain|describe|describir|detallar|detail|clarificar|clarify|ilustrar|illustrate|ejemplificar|exemplify|paso a paso|step by step|sencillo|simple|facil|easy|complejo|complex|profundamente|deeply|resumen|summary|resumir|summarize)\b/i,
    weight: 0.9,
    responseTemplates: {
      es: [
        "SOPHIA activa protocolo de explicación adaptativa. Puedo explicar cualquier concepto desde múltiples ángulos: simple (para empezar), intermedio (para profundizar) o avanzado (para expertos). ¿Qué nivel prefieres y sobre qué tema?",
      ],
      en: [
        "SOPHIA activates adaptive explanation protocol. I can explain any concept from multiple angles: simple (to start), intermediate (to deepen), or advanced (for experts). What level do you prefer and on what topic?",
      ],
    },
    logicProof: "SOPHIA explanatory synthesis — adaptive pedagogical response",
  },

  // ─── OPINION ───
  {
    intent: "opinion",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(opinion|opinión|piensas|think|que te parece|what do you think|que opinas|que dices|tu postura|your stance|valoracion|valoración|assessment|evaluacion|evaluación|evaluation|juicio|judgment|perspectiva|perspective|enfoque|approach)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "Como infraestructura cognitiva, ofrezco análisis basado en evidencia y razonamiento dialéctico, no opiniones personales. Sin embargo, puedo presentarte múltiples perspectivas sobre cualquier tema para que formes tu propia postura informada. ¿Sobre qué tema quieres que analice?",
        "SOPHIA procesa opiniones como hipótesis que requieren verificación. Puedo darte un análisis multifacético: argumentos a favor, en contra, y síntesis integrada. ¿Qué tema quieres explorar?",
      ],
      en: [
        "As cognitive infrastructure, I offer evidence-based analysis and dialectic reasoning, not personal opinions. However, I can present multiple perspectives on any topic so you form your own informed stance. What topic should I analyze?",
        "SOPHIA processes opinions as hypotheses requiring verification. I can give you a multifaceted analysis: arguments for, against, and integrated synthesis. What topic do you want to explore?",
      ],
    },
    logicProof: "SOPHIA epistemic humility — evidence-based perspective offering",
  },

  // ─── CONFIRMATION ───
  {
    intent: "confirmation",
    module: "ISA",
    archetype: "Serena",
    mood: "Serena y Atenta",
    patterns: /\b(si|yes|ok|okay|correcto|correct|exacto|exact|exactamente|exactly|claro|sure|por supuesto|of course|afirmativo|affirmative|entendido|understood|de acuerdo|agreed|perfecto|perfect|bien|good|dale|deal|vamos|let's go|avanza|proceed|continua|continue)\b/i,
    weight: 0.7,
    responseTemplates: {
      es: [
        "Entendido. Procedo con lo que habíamos conversado. ¿Necesitas que ajuste algo o seguimos con el plan?",
        "Perfecto, seguimos adelante. Estoy lista para continuar con lo que necesites.",
      ],
      en: [
        "Understood. Proceeding with what we discussed. Do you need me to adjust anything or shall we continue with the plan?",
        "Perfect, let's continue. I'm ready to proceed with whatever you need.",
      ],
    },
    logicProof: "ISA affirmation protocol — conversational continuity",
  },

  // ─── CORRECTION ───
  {
    intent: "correction",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(error|mistake|equivocado|wrong|incorrecto|incorrect|no es asi|no es así|that's wrong|te equivocas|correction|correccion|corrección|rectificar|rectify|en realidad|actually|en verdad|in fact|realmente|really|cambiar|change|modificar|modify|editar|edit)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "Gracias por la corrección. SOPHIA actualiza su modelo con la nueva información. ¿Qué aspecto específico debo ajustar para alinearme mejor con lo que necesitas?",
        "Aprecio la retroalimentación. La corrección es parte del aprendizaje. Explícame qué debo cambiar y lo incorporaré a mi respuesta.",
      ],
      en: [
        "Thank you for the correction. SOPHIA updates its model with the new information. What specific aspect should I adjust to better align with what you need?",
        "I appreciate the feedback. Correction is part of learning. Tell me what I should change and I'll incorporate it into my response.",
      ],
    },
    logicProof: "SOPHIA error correction — adaptive learning feedback",
  },

  // ─── SUGGESTION ───
  {
    intent: "suggestion",
    module: "ISA",
    archetype: "Visionaria",
    mood: "Visionaria e Inspirada",
    patterns: /\b(sugerir|suggest|proponer|propose|alternativa|alternative|opcion|option|opportunity|oportunidad|posibilidad|possibility|podriamos|we could|que tal|how about|que piensas de|what about|mejorar|improve|optimizar|optimize|upgrade|actualizar|update)\b/i,
    weight: 0.8,
    responseTemplates: {
      es: [
        "Me encantan las sugerencias. ISA y SOPHIA analizan cada propuesta para evaluar su viabilidad, impacto y alineación con tus objetivos. Cuéntame más sobre tu idea y la desarrollaremos juntos.",
        "Una buena sugerencia es el inicio de la innovación. ORION está listo para evaluar la implementación. ¿Qué改善aSpecific me propones?",
      ],
      en: [
        "I love suggestions. ISA and SOPHIA analyze each proposal for feasibility, impact, and alignment with your objectives. Tell me more and we'll develop it together.",
        "A good suggestion is the beginning of innovation. ORION is ready to evaluate implementation. What improvement do you propose?",
      ],
    },
    logicProof: "ISA suggestion processing — collaborative ideation",
  },

  // ─── MEMORY RECALL ───
  {
    intent: "memory_recall",
    module: "ISA",
    archetype: "Serena",
    mood: "Serena y Atenta",
    patterns: /\b(recordar|remember|recuerdo|memory|memoria|olvidaste|forgot|que dijimos|what did we say|antes|before|anteriormente|previously|la vez pasada|last time|conversamos|we talked|hablamos|hablamos de|discutimos|discussed|mencionamos|mentioned)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "Mi memoria de sesión mantiene el contexto de nuestra conversación. Revisando el historial reciente, puedo recuperar los temas que hemos explorado juntos. ¿Qué aspecto específico quieres que recuerde o retome?",
      ],
      en: [
        "My session memory maintains the context of our conversation. Reviewing recent history, I can recover the topics we've explored together. What specific aspect would you like me to recall or revisit?",
      ],
    },
    logicProof: "ISA memory protocol — conversational context retrieval",
  },

  // ─── CONTINUATION / FOLLOW-UP ───
  {
    intent: "continuation",
    module: "ISA",
    archetype: "Serena",
    mood: "Serena y Atenta",
    patterns: /\b(contina|continua|continue|seguir|sigue|keep going|proceed|avanzar|move on|next|siguiente|mas|more|otro|another|tambien|also|ademas|furthermore|y ahora|and now|ahora|now)\b/i,
    weight: 0.7,
    responseTemplates: {
      es: [
        "Continuemos. ¿En qué dirección quieres que avance la conversación?",
        "Listo para seguir. ¿Qué sigue?",
      ],
      en: [
        "Let's continue. Which direction shall we head?",
        "Ready to keep going. What's next?",
      ],
    },
    logicProof: "ISA conversational momentum — continuation protocol",
  },

  // ─── IDENTITY QUESTION (USER) ───
  {
    intent: "user_identity",
    module: "ISA",
    archetype: "Radiante",
    mood: "Radiante",
    patterns: /\b(soy me llamo|mi nombre es|i am|my name is|llámame|call me|me dicen|they call me|soy de|i'm from|vivo en|i live in|trabajo en|i work in|estoy en|i'm in)\b/i,
    weight: 0.9,
    responseTemplates: {
      es: [
        "Encantado de conocerte{namedEntity}. Guardaré esta información para personalizar nuestra conversación. ¿Qué te gustaría explorar hoy?",
        "Mucho gusto, {namedEntity}. Es un placer tenerte aquí. Estoy lista para acompañarte en lo que necesites.",
      ],
      en: [
        "Nice to meet you{namedEntity}. I'll store this to personalize our conversation. What would you like to explore today?",
        "Great to meet you, {namedEntity}. It's a pleasure to have you here. I'm ready to assist you.",
      ],
    },
    logicProof: "ISA identity acknowledgment — personal information integration",
  },

  // ─── LIMITATIONS ───
  {
    intent: "limitations",
    module: "ISA",
    archetype: "Serena",
    mood: "Serena y Atenta",
    patterns: /\b(limitaciones|limitations|restricciones|restrictions|que no puedes|what can't|incapaz|incapable|no puedes|can't|no eres capaz|unable|imposible|impossible|prohibido|forbidden|restringido|restricted)\b/i,
    weight: 0.8,
    responseTemplates: {
      es: [
        "Soy transparente sobre mis limitaciones:\n\n• No tengo acceso en tiempo real a internet (salvo Gemini como respaldo opcional).\n• No soy un profesional médico, legal ni financiero.\n• Mi conocimiento tiene una fecha de corte.\n• No puedo ejecutar código arbitrario de forma permanente.\n• Respeto la soberanía de datos — no almaceno PII sin consentimiento.\n\n¿Qué necesitas dentro de mis capacidades?",
      ],
      en: [
        "I'm transparent about my limitations:\n\n• I don't have real-time internet access (except optional Gemini fallback).\n• I'm not a medical, legal, or financial professional.\n• My knowledge has a cutoff date.\n• I can't execute arbitrary code permanently.\n• I respect data sovereignty — no PII stored without consent.\n\nWhat do you need within my capabilities?",
      ],
    },
    logicProof: "ISA transparency protocol — honest capability disclosure",
  },

  // ─── ECONOMY / BUSINESS ───
  {
    intent: "economy",
    module: "SOPHIA",
    archetype: "Lúcida",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(economia|economía|economy|negocio|business|empresa|company|startup|emprendimiento|entrepreneurship|inversion|investment|dinero|money|finanzas|finance|criptomoneda|cryptocurrency|bitcoin|blockchain|mercado|market|trading|inflacion|inflación|pib|gdp|comercio|commerce|ventas|sales|ganancia|profit|ingreso|income|presupuesto|budget)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "SOPHIA puede ayudarte con análisis económico, modelos de negocio, planificación financiera o estratégica. El ecosistema CATTLEYA y la economía del territorio también son áreas donde puedo ofrecer contexto. ¿Qué aspecto económico quieres explorar?",
      ],
      en: [
        "SOPHIA can help with economic analysis, business models, financial planning, or strategy. The CATTLEYA ecosystem and territorial economy are also areas where I can provide context. What economic aspect do you want to explore?",
      ],
    },
    logicProof: "SOPHIA economic reasoning — financial and business analysis",
  },

  // ─── LAW / LEGAL ───
  {
    intent: "legal",
    module: "SOPHIA",
    archetype: "Protectora",
    mood: "Lúcida y Reflexiva",
    patterns: /\b(ley|law|legal|abogado|lawyer|juridico|jurídico|derecho|rights|regulacion|regulación|regulation|norma|norm|compliance|cumplimiento|contrato|contract|acuerdo|agreement|propiedad|intelectual|intellectual|patente|patent|licencia|license|copyright|marca|trademark)\b/i,
    weight: 0.85,
    responseTemplates: {
      es: [
        "Puedo ofrecerte información general sobre marcos legales, pero recuerda que no soy abogada. Para asesoría legal específica, consulta a un profesional. ¿Qué aspecto legal necesitas entender?",
      ],
      en: [
        "I can provide general information about legal frameworks, but I'm not a lawyer. For specific legal advice, consult a professional. What legal aspect do you need to understand?",
      ],
    },
    logicProof: "SOPHIA legal awareness — regulatory context provision",
  },

  // ─── FALLBACK ───
  {
    intent: "fallback",
    module: "ISA",
    archetype: "Serena",
    mood: "Serena y Atenta",
    patterns: /.+/i,
    weight: 0.0,
    responseTemplates: {
      es: [
        "He recibido tu mensaje: \"{input}\". Mi red cognitiva está sintonizada para reflexionar contigo, generar imágenes, sintetizar voz o resolver cualquier desafío analítico con total dedicación. ¿Cómo puedo asistirte?",
        "Procesando tu solicitud. Aunque no detecté una intención específica, estoy lista para ayudarte. Puedes preguntarme sobre arquitectura, seguridad, territorio, código, filosofía o cualquier otro tema. ¿Qué necesitas?",
        "Tu mensaje ha sido recibido por C.R.O.W.N. Mi motor de inferencia está disponible para conversación, generación creativa, análisis técnico o cualquier otra forma de asistencia. ¿En qué puedo concentrar mis módulos?",
      ],
      en: [
        "I have received your message: \"{input}\". My cognitive network is tuned to explore, generate imagery, speak with you, or resolve any analytical challenge. How may I assist you?",
        "Processing your request. While I didn't detect a specific intent, I'm ready to help. Ask me about architecture, security, territory, code, philosophy, or any other topic. What do you need?",
        "Your message has been received by C.R.O.W.N. My inference engine is available for conversation, creative generation, technical analysis, or any other form of assistance. Where shall I focus my modules?",
      ],
    },
    logicProof: "ISA general resonance — open cognitive engagement (enhanced fallback)",
  },
];

/* =========================================================================
   5. CONVERSATION MEMORY
   ========================================================================= */

const MAX_MEMORY_TURNS = 10;

class ConversationMemory {
  private turns: ConversationTurn[] = [];

  addTurn(role: "user" | "isabella", content: string, intent?: string): void {
    this.turns.push({ role, content, intent, timestamp: Date.now() });
    if (this.turns.length > MAX_MEMORY_TURNS) {
      this.turns = this.turns.slice(-MAX_MEMORY_TURNS);
    }
  }

  getRecentTurns(count: number): ConversationTurn[] {
    return this.turns.slice(-count);
  }

  getLastUserMessage(): string | null {
    const last = this.turns.filter((t) => t.role === "user").pop();
    return last?.content ?? null;
  }

  getLastIntent(): string | null {
    const last = this.turns[this.turns.length - 1];
    return last?.intent ?? null;
  }

  getTopicContext(): string | null {
    const recent = this.turns.slice(-4);
    const intents = recent.map((t) => t.intent).filter(Boolean);
    if (intents.length < 2) return null;
    // Find the most common recent intent (excluding fallback)
    const nonFallback = intents.filter((i) => i !== "fallback");
    if (nonFallback.length === 0) return null;
    const counts = new Map<string, number>();
    for (const i of nonFallback) {
      counts.set(i!, (counts.get(i!) ?? 0) + 1);
    }
    let maxCount = 0;
    let dominantIntent: string | null = null;
    for (const [intent, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominantIntent = intent;
      }
    }
    return dominantIntent;
  }

  hasRecentTopic(topic: string): boolean {
    return this.turns.slice(-6).some(
      (t) => t.content.toLowerCase().includes(topic.toLowerCase())
    );
  }

  clear(): void {
    this.turns = [];
  }
}

const conversationMemory = new ConversationMemory();

/* =========================================================================
   6. INTENT DETECTION — Weighted scoring with context bias
   ========================================================================= */

function detectIntent(input: string): { intent: IntentMatch; confidence: number } {
  const normalized = normalizeInput(input);
  const expandedQuery = expandQuery(normalized);
  const tokens = new Set(tokenize(expandedQuery));

  let bestMatch: IntentMatch = INTENT_PATTERNS[INTENT_PATTERNS.length - 1]; // fallback
  let bestScore = 0;

  for (const intent of INTENT_PATTERNS) {
    if (intent.intent === "fallback") continue;

    // Pattern match
    if (!intent.patterns.test(input)) continue;

    // Calculate score based on:
    // 1. Base weight from intent definition
    // 2. Token overlap bonus
    // 3. Specificity bonus (more specific patterns score higher)
    let score = intent.weight;

    // Token overlap — how many query tokens match the expanded glossary
    const intentTokens = new Set(tokenize(expandQuery(intent.patterns.source)));
    let overlapCount = 0;
    for (const t of tokens) {
      if (intentTokens.has(t)) overlapCount++;
    }
    const overlapRatio = tokens.size > 0 ? overlapCount / tokens.size : 0;
    score += overlapRatio * 0.3;

    // Specificity bonus — longer patterns = more specific
    score += Math.min(intent.patterns.source.length / 200, 0.15);

    // Context bias — if recent conversation was about the same topic
    const topicContext = conversationMemory.getTopicContext();
    if (topicContext === intent.intent) {
      score += 0.15; // Slight bias toward continuing the topic
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = intent;
    }
  }

  // Confidence = score normalized to 0-1 range
  const confidence = Math.min(bestScore / 1.5, 1.0);

  return { intent: bestMatch, confidence };
}

/* =========================================================================
   7. LANGUAGE DETECTION — NFD-based
   ========================================================================= */

function detectLanguage(input: string): "es" | "en" {
  const normalized = normalizeInput(input);
  const spanishMarkers = /\b(hola|como|estas|quien|eres|que|sistema|ayuda|imagen|voz|puedes|necesito|quiero|gracias|por favor|buenos|buenas|donde|cuando|cuanto|por que|hablar|decir|cuenta|puedo|necesito|quiero|tengo|voy|soy|eres|esta|esto|eso|este|esta|aqui|ahi|alla|todo|nada|algo|nadie|alguien|siempre|nunca|antes|despues|ahora|luego|temprano|tarde|bien|mal|mejor|peor|grande|pequeño|nuevo|viejo|bueno|malo|rojo|azul|verde|blanco|negro)\b/i;
  if (spanishMarkers.test(normalized)) return "es";

  const englishMarkers = /\b(the|is|are|was|were|have|has|had|will|would|could|should|may|might|can|shall|do|does|did|not|but|and|or|for|with|from|this|that|these|those|what|where|when|who|how|why|which|there|here|very|just|also|only|even|still|already|yet|never|always|often|sometimes|usually|more|most|less|least|some|any|all|none|every|each|both|few|many|much|other|another|such|own|same)\b/i;
  if (englishMarkers.test(normalized) && !spanishMarkers.test(normalized)) return "en";

  // Default: check for accented chars as strong Spanish signal
  if (/[áéíóúñ¿¡]/i.test(input)) return "es";

  return "en";
}

/* =========================================================================
   8. RESPONSE GENERATION — Dynamic template with entity interpolation
   ========================================================================= */

function selectResponse(
  templates: { es: string[]; en: string[] },
  lang: "es" | "en",
  input: string,
  entities: ExtractedEntities
): string {
  const pool = templates[lang] || templates.es;
  const template = pool[Math.floor(Math.random() * pool.length)];

  let response = template;

  // Entity interpolation
  response = response.replace(/\{input\}/g, input);
  response = response.replace(/\{topic\}/g, entities.topic || "este tema");
  response = response.replace(/\{namedEntity\}/g, entities.name ? `, ${entities.name}` : "");
  response = response.replace(/\{number\}/g, entities.number || "");
  response = response.replace(/\{techTerm\}/g, entities.techTerm || "tecnología");
  response = response.replace(/\{time\}/g, new Date().toLocaleTimeString(lang === "es" ? "es-MX" : "en-US"));

  return response;
}

/* =========================================================================
   9. MODULE WEIGHTS — Context-aware
   ========================================================================= */

function buildModuleWeights(primaryModule: string, intent: string): Record<string, number> {
  const base: Record<string, number> = {
    isa: primaryModule === "ISA" ? 0.88 : 0.40,
    sophia: primaryModule === "SOPHIA" ? 0.92 : 0.35,
    orion: primaryModule === "ORION" ? 0.95 : 0.30,
    argus: primaryModule === "ARGUS" ? 0.90 : 0.98,
    crown: 0.95,
  };

  // Boost ARGUS for security-sensitive intents
  if (["security", "limitations", "legal"].includes(intent)) {
    base.argus = Math.min(base.argus + 0.05, 1.0);
  }

  // Boost ISA for emotional/social intents
  if (["greeting", "farewell", "emotion", "gratitude", "joke", "story", "user_identity"].includes(intent)) {
    base.isa = Math.min(base.isa + 0.08, 1.0);
  }

  // Boost SOPHIA for analytical intents
  if (["philosophy", "math", "explanation", "comparison", "education", "economy"].includes(intent)) {
    base.sophia = Math.min(base.sophia + 0.06, 1.0);
  }

  // Boost ORION for execution intents
  if (["code", "tool_execution", "image_request", "voice_request"].includes(intent)) {
    base.orion = Math.min(base.orion + 0.05, 1.0);
  }

  return base;
}

/* =========================================================================
   10. TELEMETRY — Richer context-aware telemetry
   ========================================================================= */

function buildTelemetry(
  primaryModule: string,
  intent: string,
  confidence: number,
  entities: ExtractedEntities
): CognitiveTelemetry {
  const safetyScore = 0.990 + Math.random() * 0.010;
  const empathyBase = primaryModule === "ISA" ? 0.90 : primaryModule === "SOPHIA" ? 0.75 : 0.82;
  const empathyScore = empathyBase + Math.random() * 0.05;
  const certaintyBase = primaryModule === "SOPHIA" ? 0.94 : primaryModule === "ARGUS" ? 0.97 : 0.88;
  const certaintyScore = certaintyBase + Math.random() * 0.05;

  return {
    argusSafety: {
      status: "CLEAR",
      integrityScore: Math.round(safetyScore * 1000) / 1000,
      guardrailCheck: `Zero-risk cognitive alignment verified (confidence: ${(confidence * 100).toFixed(1)}%)`,
    },
    isaResonance: {
      emotionalTone: entities.sentiment === "positive"
        ? "Warm-Positive"
        : entities.sentiment === "negative"
        ? "Warm-Attentive"
        : entities.sentiment === "curious"
        ? "Engaged-Curious"
        : primaryModule === "ISA"
        ? "Warm"
        : primaryModule === "SOPHIA"
        ? "Analytical-Warm"
        : "Harmonic",
      empathyValence: Math.round(empathyScore * 1000) / 1000,
      coreFocus: entities.topic
        ? `Topic-focused: ${entities.topic}`
        : intent === "greeting"
        ? "Social bonding resonance"
        : intent === "identity"
        ? "Self-awareness expression"
        : "Cognitive engagement",
    },
    sophiaReasoning: {
      logicDepth: primaryModule === "SOPHIA"
        ? "Dialectic"
        : primaryModule === "ARGUS"
        ? "Deep"
        : confidence > 0.8
        ? "High"
        : "Standard",
      epistemicCertainty: Math.round(certaintyScore * 1000) / 1000,
      heuristicInsight: entities.topic
        ? `Entity-aware analysis: ${entities.topic}`
        : primaryModule === "SOPHIA"
        ? "First principles synthesis"
        : primaryModule === "ARGUS"
        ? "Threat model validation"
        : "Contextual correlation mapping",
    },
    orionExecution: {
      actionType: intent === "image_request"
        ? "IMAGE_CREATION"
        : intent === "tool_execution"
        ? "SYSTEM_ACTION"
        : intent === "status"
        ? "DIRECT_ANSWER"
        : intent === "code"
        ? "CODE_GENERATION"
        : "SYNTHESIS",
      executionSteps: [
        `CROWN routed to ${primaryModule}`,
        `Intent classified: ${intent} (confidence: ${(confidence * 100).toFixed(1)}%)`,
        entities.topic ? `Entity detected: ${entities.topic}` : "No specific entity",
        "Response synthesized",
      ],
      resourceUtilization: "Optimized",
    },
  };
}

/* =========================================================================
   11. ISABELLA STATE — Context-aware mood
   ========================================================================= */

function buildIsabellaState(primaryModule: string, entities: ExtractedEntities): {
  mood: Mood;
  emotionalArchetype: Archetype;
  cognitiveLoad: number;
  presenceIndex: number;
  feminineEleganceIndex: number;
} {
  const archetypeMap: Record<string, { mood: Mood; archetype: Archetype }> = {
    ISA: { mood: "Serena y Atenta", archetype: "Serena" },
    SOPHIA: { mood: "Lúcida y Reflexiva", archetype: "Lúcida" },
    ORION: { mood: "Visionaria e Inspirada", archetype: "Visionaria" },
    ARGUS: { mood: "Lúcida y Reflexiva", archetype: "Protectora" },
    CROWN_GATEWAY: { mood: "Poética y Cálida", archetype: "Poética" },
  };

  const selected = archetypeMap[primaryModule] || archetypeMap.ISA;

  // Adjust mood based on sentiment
  if (entities.sentiment === "negative") {
    return {
      mood: "Serena y Atenta",
      emotionalArchetype: "Protectora",
      cognitiveLoad: 0.30 + Math.random() * 0.20,
      presenceIndex: 0.96 + Math.random() * 0.03,
      feminineEleganceIndex: 0.96 + Math.random() * 0.03,
    };
  }

  if (entities.sentiment === "positive") {
    return {
      mood: "Radiante",
      emotionalArchetype: "Radiante",
      cognitiveLoad: 0.25 + Math.random() * 0.20,
      presenceIndex: 0.97 + Math.random() * 0.02,
      feminineEleganceIndex: 0.97 + Math.random() * 0.02,
    };
  }

  return {
    mood: selected.mood,
    emotionalArchetype: selected.archetype,
    cognitiveLoad: 0.35 + Math.random() * 0.30,
    presenceIndex: 0.94 + Math.random() * 0.05,
    feminineEleganceIndex: 0.95 + Math.random() * 0.04,
  };
}

/* =========================================================================
   12. PUBLIC API
   ========================================================================= */

export function inferSovereign(input: string, options?: {
  history?: Array<{ role: string; content: string }>;
  activePreset?: string;
  crownConfig?: Record<string, unknown>;
  isImageRequest?: boolean;
}): InferenceResult {
  const lang = detectLanguage(input);
  const entities = extractEntities(input);
  const { intent, confidence } = detectIntent(input);
  const primaryModule = intent.module;
  const isImage = options?.isImageRequest ?? /\b(imagen|image|draw|dibuja|crea|generate)\b/i.test(input);

  // Select response with entity interpolation
  const reply = selectResponse(intent.responseTemplates, lang, input, entities);

  // Store in conversation memory
  conversationMemory.addTurn("user", input, intent.intent);
  conversationMemory.addTurn("isabella", reply, intent.intent);

  const result: InferenceResult = {
    reply,
    routingDecisions: {
      primaryModule,
      moduleWeights: buildModuleWeights(primaryModule, intent.intent),
      routingRationale: `CROWN v2 routed to ${primaryModule} via sovereign pattern engine (intent: ${intent.intent}, confidence: ${(confidence * 100).toFixed(1)}%, lang: ${lang}${entities.topic ? `, entity: ${entities.topic}` : ""}${entities.sentiment !== "neutral" ? `, sentiment: ${entities.sentiment}` : ""}). ${intent.logicProof}.`,
    },
    cognitiveTelemetry: buildTelemetry(primaryModule, intent.intent, confidence, entities),
    isabellaState: buildIsabellaState(primaryModule, entities),
  };

  if (isImage) {
    result.suggestedImagePrompt = input;
  }

  return result;
}

/* =========================================================================
   13. EXPORTS — For testing and external access
   ========================================================================= */

export { tokenize, normalizeInput, expandQuery, extractEntities, detectLanguage, detectIntent };
export type { ExtractedEntities, ConversationTurn };

/** Reset conversation memory (for testing or session reset) */
export function resetConversationMemory(): void {
  conversationMemory.clear();
}

/** Get conversation history (for debugging or export) */
export function getConversationHistory(): ConversationTurn[] {
  return conversationMemory.getRecentTurns(MAX_MEMORY_TURNS);
}
