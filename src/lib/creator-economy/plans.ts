/**
 * Plan catalog v1.1.0 — frozen pricing & capability matrix (spec §3.1).
 * Platform gift share is the percentage of NET DISTRIBUTABLE retained by
 * Isabella; the creator receives the complement.
 */

import { createHash } from "node:crypto";
import type { PlanDefinition, PlanId, SkillDefinition } from "./types";

export const PLANS: Readonly<Record<PlanId, PlanDefinition>> = Object.freeze({
  free: Object.freeze({
    plan: "free",
    monthlyPriceMxnMinor: 0,
    monthlyCredits: 50,
    maxActiveOffers: 0,
    maxConnectedChannels: 1,
    platformGiftSharePercent: 30,
    canCreateOffers: false,
    canReceiveGifts: false,
    canRequestPayout: false,
    canPublishExternally: false,
    requiresHumanApproval: true,
  }),
  premium: Object.freeze({
    plan: "premium",
    monthlyPriceMxnMinor: 49_900, // $499.00 MXN
    monthlyCredits: 1_000,
    maxActiveOffers: 3,
    maxConnectedChannels: 5,
    platformGiftSharePercent: 15,
    canCreateOffers: true,
    canReceiveGifts: true,
    canRequestPayout: true,
    canPublishExternally: true,
    requiresHumanApproval: true,
  }),
  pro: Object.freeze({
    plan: "pro",
    monthlyPriceMxnMinor: 149_900, // $1,499.00 MXN
    monthlyCredits: 3_500,
    maxActiveOffers: -1,
    maxConnectedChannels: 15,
    platformGiftSharePercent: 10,
    canCreateOffers: true,
    canReceiveGifts: true,
    canRequestPayout: true,
    canPublishExternally: true,
    requiresHumanApproval: true,
  }),
  business: Object.freeze({
    plan: "business",
    monthlyPriceMxnMinor: -1, // custom quote
    monthlyCredits: 10_000,
    maxActiveOffers: -1,
    maxConnectedChannels: -1,
    platformGiftSharePercent: 5,
    canCreateOffers: true,
    canReceiveGifts: true,
    canRequestPayout: true,
    canPublishExternally: true,
    requiresHumanApproval: false, // corporate auto-approval rules allowed
  }),
});

export const PLAN_ORDER: readonly PlanId[] = Object.freeze(["free", "premium", "pro", "business"]);

export function planAtLeast(plan: PlanId, required: PlanId): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(required);
}

// ---------- Skill catalog (§4.1) ----------

const digest = (s: string) => createHash("sha256").update(s).digest("hex");

function defineSkill(s: Omit<SkillDefinition, "modelDigest"> & { frozenPrompt: string }): SkillDefinition {
  const { frozenPrompt, ...rest } = s;
  return Object.freeze({ ...rest, modelDigest: digest(frozenPrompt) });
}

export const SKILLS: readonly SkillDefinition[] = Object.freeze([
  defineSkill({
    id: "skill-hook-generator-v2",
    version: "2.0.0",
    name: "Hook Generator",
    description: "Genera 5 variaciones de ganchos narrativos para formato corto (Reels/TikTok).",
    category: "writing",
    planRequired: "free",
    creditsRequired: 3,
    estimatedCostMinor: 42,
    maxInputBytes: 8_192,
    maxOutputTokens: 500,
    requiresApproval: false,
    allowedDataClasses: ["public", "internal"],
    enabled: true,
    frozenPrompt: "hook-generator-v2::5-hooks::short-form::es-MX",
  }),
  defineSkill({
    id: "skill-rdm-tourism-pack-v1",
    version: "1.0.0",
    name: "RDM Tourism Pack",
    description: "Itinerarios turísticos y gastronómicos adaptados a comercios locales de Real del Monte.",
    category: "local_rdm",
    planRequired: "premium",
    creditsRequired: 10,
    estimatedCostMinor: 140,
    maxInputBytes: 16_384,
    maxOutputTokens: 1_200,
    requiresApproval: true,
    allowedDataClasses: ["public"],
    enabled: true,
    frozenPrompt: "rdm-tourism-pack-v1::itinerary+gastro::comercios-locales",
  }),
  defineSkill({
    id: "skill-offer-copy-optimizer-v1",
    version: "1.0.0",
    name: "Offer Copy Optimizer",
    description: "Redacción de páginas de venta de alta conversión para micro-infoproductos con validación de ofertas.",
    category: "commerce",
    planRequired: "premium",
    creditsRequired: 8,
    estimatedCostMinor: 112,
    maxInputBytes: 16_384,
    maxOutputTokens: 900,
    requiresApproval: false,
    allowedDataClasses: ["public", "internal"],
    enabled: true,
    frozenPrompt: "offer-copy-optimizer-v1::high-conversion::validated-claims-only",
  }),
  defineSkill({
    id: "skill-video-subtitle-aligner-v1",
    version: "1.0.0",
    name: "Video Subtitle Aligner",
    description: "Generación y sincronización de subtítulos dinámicos .ass/.srt multilingüe.",
    category: "video",
    planRequired: "pro",
    creditsRequired: 15,
    estimatedCostMinor: 210,
    maxInputBytes: 65_536,
    maxOutputTokens: 4_000,
    requiresApproval: false,
    allowedDataClasses: ["public", "internal", "confidential"],
    enabled: true,
    frozenPrompt: "subtitle-aligner-v1::ass+srt::multilingual::timing",
  }),
  defineSkill({
    id: "skill-quantum-kernel-evaluator-v1",
    version: "1.0.0",
    name: "Quantum Kernel Evaluator",
    description: "Evaluación de métricas de kernels cuánticos y espacios de Hilbert para modelos predictivos.",
    category: "analytics",
    planRequired: "pro",
    creditsRequired: 25,
    estimatedCostMinor: 350,
    maxInputBytes: 32_768,
    maxOutputTokens: 2_500,
    requiresApproval: false,
    allowedDataClasses: ["public", "internal"],
    enabled: true,
    frozenPrompt: "quantum-kernel-evaluator-v1::hilbert-space::qnn-metrics::eoct-v2",
  }),
  defineSkill({
    id: "skill-data-asset-tokenization-v1",
    version: "1.0.0",
    name: "Data Asset Tokenizer",
    description: "Estructuración y tokenización de datasets y grafos de conocimiento con procedencia BookPI SHA3-512.",
    category: "commerce",
    planRequired: "business",
    creditsRequired: 30,
    estimatedCostMinor: 450,
    maxInputBytes: 65_536,
    maxOutputTokens: 3_000,
    requiresApproval: true,
    allowedDataClasses: ["public", "internal", "confidential"],
    enabled: true,
    frozenPrompt: "data-asset-tokenizer-v1::bookpi-provenance::sha3-512::licensing",
  }),
  defineSkill({
    id: "skill-legal-contract-eoct-v1",
    version: "1.0.0",
    name: "Legal Contract EOCT Synthesizer",
    description: "Redacción de contratos de licenciamiento, acuerdos de reparto de regalías y términos con estricta gobernanza EOCT.",
    category: "commerce",
    planRequired: "premium",
    creditsRequired: 12,
    estimatedCostMinor: 180,
    maxInputBytes: 32_768,
    maxOutputTokens: 2_000,
    requiresApproval: true,
    allowedDataClasses: ["internal", "confidential"],
    enabled: true,
    frozenPrompt: "legal-contract-eoct-v1::royalty-splits::licensing::sat-compliant",
  }),
]);


export function getSkill(id: string): SkillDefinition | null {
  return SKILLS.find((s) => s.id === id) ?? null;
}

/**
 * Booster policy (§4.2): engagement-inflation requests are rejected
 * at classification time. This list is enforced before any execution.
 */
const PROHIBITED_BOOSTER_PATTERNS = Object.freeze([
  /\b(comprar|buy|pagar por)\b.{0,30}\b(vistas|views|reproducciones|plays|seguidores|followers|likes)\b/i,
  /\b(bots?|cuentas falsas|fake accounts?)\b.{0,40}\b(comentarios|comments|engagement)\b/i,
  /\bengagement pods?\b/i,
  /\b(hashtag|trending)\s*spam\b/i,
  /\bdeepfakes?\b/i,
  /\b(reseñas|reviews)\s+(falsas|ficticias|fake)\b/i,
]);

export function isProhibitedBoosterRequest(text: string): boolean {
  return PROHIBITED_BOOSTER_PATTERNS.some((p) => p.test(text));
}
