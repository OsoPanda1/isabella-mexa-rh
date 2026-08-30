/**
 * Isabella Subscription & Quota Engine
 * Operative freemium controls for C.R.O.W.N. inference, voice and visual services.
 *
 * State lives behind getSubscriptionStore(): SQLite on a single node,
 * memory where better-sqlite3 is unavailable. Quotas survive restarts.
 */
import { createHash } from "node:crypto";
import { getSubscriptionStore } from "./persistence/subscription-store";

export type IsabellaPlanId = "free" | "plus" | "premium" | "vip" | "enterprise" | "custom";
export type MeteredCapability = "chat" | "voice" | "image" | "tool" | "agent";

export interface IsabellaPlan {
  id: IsabellaPlanId;
  name: string;
  monthlyUsd: number | null;
  dailyMessages: number;
  dailyImages: number;
  dailyVoiceSeconds: number;
  maxAgentSessions: number;
  features: string[];
  stripePriceEnv?: string;
}

export interface UsageDecision {
  allowed: boolean;
  plan: IsabellaPlan;
  usage: UsageBucket;
  remaining: { messages: number; images: number; voiceSeconds: number; agentSessions: number };
  resetAt: string;
  upgradeRequired?: boolean;
  reason?: string;
}

export interface UsageBucket {
  userId: string;
  dayKey: string;
  messages: number;
  images: number;
  voiceSeconds: number;
  agentSessions: number;
  updatedAt: string;
}

export const ISABELLA_PLANS: IsabellaPlan[] = [
  {
    id: "free",
    name: "Isabella Free",
    monthlyUsd: 0,
    dailyMessages: 25,
    dailyImages: 3,
    dailyVoiceSeconds: 180,
    maxAgentSessions: 1,
    features: ["CROWN Gateway básico", "Memoria inmediata", "Voz Web Speech", "Trazabilidad ARGUS"],
  },
  {
    id: "plus",
    name: "Isabella Plus",
    monthlyUsd: 15,
    dailyMessages: 250,
    dailyImages: 40,
    dailyVoiceSeconds: 1800,
    maxAgentSessions: 3,
    stripePriceEnv: "STRIPE_PRICE_PLUS",
    features: ["Precio introductorio", "Gemini Flash federado", "Voice Studio ampliado", "Historial de sesión"],
  },
  {
    id: "premium",
    name: "Isabella Premium",
    monthlyUsd: 22.49,
    dailyMessages: 600,
    dailyImages: 100,
    dailyVoiceSeconds: 5400,
    maxAgentSessions: 8,
    stripePriceEnv: "STRIPE_PRICE_PREMIUM",
    features: ["Prioridad CROWN", "Imagen Flux/Imagen", "Memoria de proyecto", "Exportación de auditoría"],
  },
  {
    id: "vip",
    name: "Isabella VIP",
    monthlyUsd: 37.49,
    dailyMessages: 1500,
    dailyImages: 250,
    dailyVoiceSeconds: 14400,
    maxAgentSessions: 20,
    stripePriceEnv: "STRIPE_PRICE_VIP",
    features: ["Baja latencia", "Agentes programáticos", "Herramientas ORION", "Soporte prioritario"],
  },
  {
    id: "enterprise",
    name: "Isabella Enterprise",
    monthlyUsd: 112.5,
    dailyMessages: 10000,
    dailyImages: 1000,
    dailyVoiceSeconds: 86400,
    maxAgentSessions: 100,
    stripePriceEnv: "STRIPE_PRICE_ENTERPRISE",
    features: ["Tenant dedicado", "SLA comercial", "SSO/API keys", "Retención y auditoría avanzada"],
  },
  {
    id: "custom",
    name: "Isabella Custom Sovereign",
    monthlyUsd: null,
    dailyMessages: Number.MAX_SAFE_INTEGER,
    dailyImages: Number.MAX_SAFE_INTEGER,
    dailyVoiceSeconds: Number.MAX_SAFE_INTEGER,
    maxAgentSessions: Number.MAX_SAFE_INTEGER,
    features: ["Contrato a medida", "Despliegue soberano", "Modelos privados/locales", "Jurisdicción territorial"],
  },
];

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function resetAtIso(now = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toISOString();
}

export function stableUserId(raw?: string): string {
  const candidate = raw?.trim() || "anonymous";
  return createHash("sha256").update(candidate).digest("hex").slice(0, 20);
}

export function planById(planId?: string): IsabellaPlan {
  return ISABELLA_PLANS.find((plan) => plan.id === planId) || ISABELLA_PLANS[0];
}

export function setUserPlan(userId: string, planId: IsabellaPlanId): IsabellaPlan {
  const plan = planById(planId);
  getSubscriptionStore().savePlan(userId, plan.id);
  return plan;
}

export function getUserPlan(userId: string, explicitPlan?: string): IsabellaPlan {
  return planById(explicitPlan || getSubscriptionStore().getPlan(userId) || undefined);
}

export function getUsage(userId: string): UsageBucket {
  const dayKey = todayKey();
  const store = getSubscriptionStore();
  const current = store.getBucket(userId, dayKey);
  if (current) return current;
  const fresh: UsageBucket = { userId, dayKey, messages: 0, images: 0, voiceSeconds: 0, agentSessions: 0, updatedAt: new Date().toISOString() };
  store.saveBucket(fresh);
  return fresh;
}

export function evaluateUsage(userId: string, capability: MeteredCapability, amount = 1, explicitPlan?: string): UsageDecision {
  const plan = getUserPlan(userId, explicitPlan);
  const usage = getUsage(userId);
  const requested = Math.max(1, Math.ceil(amount));
  const next = { ...usage };

  if (capability === "chat" || capability === "tool") next.messages += requested;
  if (capability === "image") next.images += requested;
  if (capability === "voice") next.voiceSeconds += requested;
  if (capability === "agent") next.agentSessions += requested;

  const allowed =
    next.messages <= plan.dailyMessages &&
    next.images <= plan.dailyImages &&
    next.voiceSeconds <= plan.dailyVoiceSeconds &&
    next.agentSessions <= plan.maxAgentSessions;

  return {
    allowed,
    plan,
    usage,
    resetAt: resetAtIso(),
    remaining: {
      messages: Math.max(0, plan.dailyMessages - usage.messages),
      images: Math.max(0, plan.dailyImages - usage.images),
      voiceSeconds: Math.max(0, plan.dailyVoiceSeconds - usage.voiceSeconds),
      agentSessions: Math.max(0, plan.maxAgentSessions - usage.agentSessions),
    },
    upgradeRequired: !allowed,
    reason: allowed ? undefined : `Límite diario ${capability} alcanzado para el plan ${plan.name}.`,
  };
}

export function consumeUsage(userId: string, capability: MeteredCapability, amount = 1, explicitPlan?: string): UsageDecision {
  const decision = evaluateUsage(userId, capability, amount, explicitPlan);
  if (!decision.allowed) return decision;
  const usage = { ...decision.usage };
  const requested = Math.max(1, Math.ceil(amount));
  if (capability === "chat" || capability === "tool") usage.messages += requested;
  if (capability === "image") usage.images += requested;
  if (capability === "voice") usage.voiceSeconds += requested;
  if (capability === "agent") usage.agentSessions += requested;
  usage.updatedAt = new Date().toISOString();
  getSubscriptionStore().saveBucket(usage);
  return { ...decision, usage, remaining: {
    messages: Math.max(0, decision.plan.dailyMessages - usage.messages),
    images: Math.max(0, decision.plan.dailyImages - usage.images),
    voiceSeconds: Math.max(0, decision.plan.dailyVoiceSeconds - usage.voiceSeconds),
    agentSessions: Math.max(0, decision.plan.maxAgentSessions - usage.agentSessions),
  }};
}

export function buildCheckoutUrl(planId: IsabellaPlanId, userId: string): string {
  const plan = planById(planId);
  const baseUrl = process.env.BILLING_CHECKOUT_BASE_URL || process.env.PUBLIC_APP_URL || "http://localhost:3000";
  const priceEnv = plan.stripePriceEnv ? process.env[plan.stripePriceEnv] : undefined;
  // Stripe real: se redirige al endpoint de provider, que crea una Checkout
  // Session auténtica y devuelve su URL para completar el pago.
  if (process.env.STRIPE_SECRET_KEY) {
    const url = new URL("/api/v1/billing/checkout/provider", baseUrl);
    url.searchParams.set("plan", plan.id);
    url.searchParams.set("user", userId);
    if (priceEnv) url.searchParams.set("price", priceEnv);
    return url.toString();
  }
  // Stripe no configurado: contacto comercial (sin checkout simulado).
  return `${baseUrl.replace(/\/$/, "")}/billing/contact?plan=${encodeURIComponent(plan.id)}`;
}
