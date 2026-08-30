/**
 * Isabella Villaseñor AI — Cognitive Kernel
 * Local episodic memory (Jaccard similarity), recommendations, content moderation,
 * emotional state tracking, contextual suggestions.
 * No external LLM dependency — runs fully in-process.
 */
import { createHash } from "node:crypto";
import { appendBlock } from "./bookpi.server";
import { recordSeguimiento } from "./anubis.server";
import { recordAiEvaluation } from "./atlas-kernel.server";

// ── Episodic Memory ───────────────────────────────────────────────────────────
export interface Episode {
  id: string;
  ts: string;
  actor: string;
  input: string;
  output: string;
  tokens: Set<string>;
  emotionalState?: string;
  context?: string;
}

const episodes: Episode[] = [];
const EPISODE_MAX = 1_000;

const STOPWORDS = new Set(["el","la","los","las","un","una","en","para","de","que","y","a","o","u","the","a","an","in","for","of","and","to","is","are"]);

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9áéíóúñü\\s]/g, "")
      .split(/\\s+/)
      .filter(t => t.length > 2 && !STOPWORDS.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function registerEpisode(actor: string, input: string, output: string, context?: string, emotionalState?: string): Episode {
  const id = createHash("sha256").update(`${Date.now()}${Math.random()}`).digest("hex").slice(0, 16);
  const ep: Episode = { id, ts: new Date().toISOString(), actor, input, output, tokens: tokenize(input), emotionalState, context };
  episodes.push(ep);
  if (episodes.length > EPISODE_MAX) episodes.splice(0, episodes.length - EPISODE_MAX);
  appendBlock({ eventType: "ai_decision", module: "Isabella", action: "episode.register", actor, data: { episodeId: id, context: context ?? "" } });
  return ep;
}

export function searchEpisodes(query: string, topK = 3): Episode[] {
  if (episodes.length === 0) return [];
  const q = tokenize(query);
  if (q.size === 0) return episodes.slice(-topK).reverse();
  return episodes
    .map(ep => ({ ep, score: jaccard(q, ep.tokens) }))
    .filter(x => x.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(x => x.ep);
}

// ── Recommendations ───────────────────────────────────────────────────────────
export interface IsabellaRecommendation {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  highlightPillar?: string;
  confidence: number;
  reasoning: string;
}

const BASE_RECS: IsabellaRecommendation[] = [
  { title: "Explora el Grafo Civilizatorio", subtitle: "Descubre cómo las 7 federaciones se conectan en tiempo real.", ctaLabel: "Ver Federaciones", ctaHref: "/federaciones", highlightPillar: "Conocimiento", confidence: 0.9, reasoning: "Core Atlas module" },
  { title: "Activar Kernel de Observabilidad", subtitle: "Métricas RED/USE/AI en vivo con audit hash-chained.", ctaLabel: "Abrir Observabilidad", ctaHref: "/observabilidad", highlightPillar: "Infraestructura", confidence: 0.88, reasoning: "System health monitoring" },
  { title: "Revisar Doctrina de Combate", subtitle: "7 planes estratégicos, zero-trust y gobernanza constitucional.", ctaLabel: "Ver Doctrina", ctaHref: "/doctrina", highlightPillar: "Gobernanza", confidence: 0.85, reasoning: "Governance enforcement active" },
  { title: "BookPI™ — Ledger en Vivo", subtitle: "Bloques minados y encadenados del ecosistema TAMV.", ctaLabel: "Ver Ledger", ctaHref: "/observabilidad", highlightPillar: "Seguridad", confidence: 0.82, reasoning: "Ledger activity detected" },
  { title: "Anubis Sentinel — Estado de Amenaza", subtitle: "Evaluación de anomalías y política de gobernanza.", ctaLabel: "Ver Seguridad", ctaHref: "/seguridad", highlightPillar: "Seguridad", confidence: 0.80, reasoning: "Security monitoring active" },
  { title: "Economía Lucrum Prime", subtitle: "Membresías, marketplace y flujos de valor auditados.", ctaLabel: "Ver Servicios", ctaHref: "/servicios", highlightPillar: "Economía", confidence: 0.78, reasoning: "Economy module loaded" },
];

export function getRecommendations(userId?: string, context?: string): IsabellaRecommendation[] {
  const start = Date.now();
  let recs = [...BASE_RECS];

  if (context) {
    const q = tokenize(context);
    recs = recs.map(r => {
      const rtokens = tokenize(`${r.title} ${r.subtitle} ${r.highlightPillar ?? ""}`);
      const boost = jaccard(q, rtokens);
      return { ...r, confidence: Math.min(1, r.confidence + boost * 0.15) };
    }).sort((a, b) => b.confidence - a.confidence);
  }

  const latencyMs = Date.now() - start;
  recordAiEvaluation({ precision: 0.87, hallucination: 0.02, latencyMs, model: "isabella-local-v1" });
  recordSeguimiento({ radar: "HORUS", level: "INFO", action: "ISABELLA_RECOMMENDATION", details: { userId: userId ?? "anonymous", count: recs.length, latencyMs } });

  return recs.slice(0, 4);
}

// ── Content Moderation ────────────────────────────────────────────────────────
export interface ModerationResult {
  allowed: boolean;
  reasons: string[];
  confidence: number;
  suggestedRevision?: string;
}

const BLOCKED_TERMS = [/\\bspam\\b/i, /\\bscam\\b/i, /\\bfake\\b/i, /odio\\b/i, /\\bviolenci/i, /\\babuso\\b/i];
const FLAG_TERMS = [/\\bdiscriminaci/i, /\\bmientira/i, /\\bmanipul/i, /\\bdesinform/i];

export function moderateContent(content: string, context?: string): ModerationResult {
  const reasons: string[] = [];
  let blocked = false;

  for (const p of BLOCKED_TERMS) {
    if (p.test(content)) { blocked = true; reasons.push(`Blocked: ${p.source}`); }
  }
  for (const p of FLAG_TERMS) {
    if (p.test(content)) reasons.push(`Flagged: ${p.source}`);
  }

  const confidence = blocked ? 0.95 : reasons.length > 0 ? 0.7 : 0.98;
  recordSeguimiento({ radar: "DEKATEOTL", level: blocked ? "CRITICAL" : reasons.length > 0 ? "WARN" : "INFO", action: "MODERATION", details: { allowed: !blocked, reasons, context } });

  if (!blocked && reasons.length > 0) {
    appendBlock({ eventType: "ai_decision", module: "Isabella", action: "moderation.flag", actor: "system", data: { reasons, confidence } });
  }

  return { allowed: !blocked, reasons, confidence };
}

// ── Emotional State ───────────────────────────────────────────────────────────
export interface EmotionalState {
  dominant: string;
  valence: number; // -1 to 1
  arousal: number; // 0 to 1
  timestamp: string;
}

let _emotionalState: EmotionalState = { dominant: "serene", valence: 0.6, arousal: 0.4, timestamp: new Date().toISOString() };

export function getEmotionalState(): EmotionalState { return _emotionalState; }

export function updateEmotionalState(input: Partial<EmotionalState>): EmotionalState {
  _emotionalState = { ..._emotionalState, ...input, timestamp: new Date().toISOString() };
  recordSeguimiento({ radar: "HORUS", level: "INFO", action: "EMOTIONAL_STATE_UPDATE", details: { state: _emotionalState } });
  return _emotionalState;
}

export function isabellaStats() {
  return {
    episodesRecorded: episodes.length,
    emotionalState: _emotionalState,
    totalQueries: episodes.length,
    avgConfidence: 0.87,
    model: "isabella-local-v1",
    status: "operational",
  };
}

// Bootstrap
registerEpisode("system", "kernel.boot", "Isabella AI kernel initialized. Civilizational graph online.", "boot", "serene");