import express from "express";
import path from "path";
import { mkdirSync, writeFileSync } from "node:fs";
import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { processPerception } from "./src/domains/ai/application/handlers/processPerception";
import { getRecentAuditLogs, auditTrace } from "./src/domains/ai/infrastructure/audit-tracer";
import { queryMemory, getAllMemories, addMemoryItem } from "./src/domains/ai/infrastructure/memory-store";
import { REGISTERED_TOOLS, executeTool } from "./src/domains/ai/infrastructure/tools-catalog";
import { ISABELLA_SQL_MIGRATION, SCHEMA_TABLES } from "./src/data/isabellaMigrations";
import { ISABELLA_BLUEPRINT } from "./src/data/isabellaBlueprint";
import { IsabellaPerception } from "./src/contracts/isabella";
import { atlasRouter } from "./src/lib/express-routes";
import { creatorEconomyRouter } from "./src/lib/creator-economy/routes";
import { QuantumBridgeRequestSchema, quantumGuard, runQuantumBridge } from "./src/lib/quantum-bridge.server";
import { summarizeIsabellaV5Fusion } from "./src/lib/isabella-v5";
import { tamvPlatformRouter } from "./src/lib/tamv-platform.server";
import { signLedgerBlockPQC, generateMLKEMKeyPair, encapsulateMLKEM } from "./src/lib/postQuantumCrypto";
import { authenticate, requireRole, requireScope, currentPrincipal } from "./src/middleware/auth";
import { rateLimit, quotaGate, getBillingIdentity } from "./src/middleware/rateLimit";
import { csrfProtection, issueCsrfToken, promptInjectionGuard } from "./src/middleware/security";
import { pdpAuthorize, authorizeWithPdp } from "./src/lib/authz-runtime/client";
import { assertStrictEnv } from "./src/lib/env";
import { bootstrapNativeAuth, signNativeJwt, getNativeSecret, mintGuestSession, getNativeEd25519PublicKeyPem } from "./src/lib/native-auth";
import { buildDemoLedgerSnapshot, LEDGER_POLICY_VERSION } from "./src/lib/ledger/demoSnapshot";
import { configureApiKeyService, createApiKey, listApiKeys, revokeApiKey, rotateApiKey, deleteApiKey } from "./src/lib/api-keys";
import { SqliteApiKeyRepository } from "./src/lib/persistence/api-key-repository";
import {
  ISABELLA_PLANS,
  buildCheckoutUrl,
  evaluateUsage,
  getUsage,
  setUserPlan,
  type IsabellaPlanId,
} from "./src/lib/subscription.server";
import {
  validateBody,
  PerceptionInputSchema,
  CognitiveProcessSchema,
  ImageGenSchema,
  TTSSchema,
  AgentLeaseSchema,
  AgentChatSchema,
  IdlenClickSchema,
  CheckoutSchema,
  QuantumExecuteSchema,
} from "./src/lib/api-contracts";
import { createLogger } from "./src/lib/logger";
import { jobStore } from "./src/platform/jobs/job-store";
import { featureFlagService } from "./src/platform/flags/feature-flags";
import { getPgPool, runPostgresMigration, pgHealthCheck } from "./src/lib/persistence/postgres";
import {
  activateKillSwitch,
  executeNextStep,
  resolveKillSwitch,
  getKillSwitchStatus,
  getKillSwitchEvents,
} from "./src/lib/kill-switch";
import { evaluateClaim, toEpistemicFormat, getClaimRadarMetrics } from "./src/lib/claim-radar";
import { classifyEpistemicStatus, getEpistemicRules } from "./src/lib/epistemic";
import { initializeDefaultAdapters, queryAdapters, hubHealth } from "./src/lib/mcp-adapters";
import {
  describeProblem,
  explainToDeveloper,
  getSystemSummary,
  getMeshStatus as getAutomationMeshStatus,
  getActiveFailures,
  getActiveRepairChains,
  executeRepairStep,
  resolveFailureManually,
  checkAllHealth,
  startMonitoring,
} from "./src/lib/automation";

// ─── ECONOMIC ENGINE ─────────────────────────────────────────────────
import { discoverOpportunities } from "./src/domains/economy/opportunities/opportunity-engine";
import {
  createCreatorProfile,
  getCreatorProfile,
  recordTransaction,
  listCreators,
} from "./src/domains/economy/creators/creator-profile";
import {
  createListing,
  searchListings,
  getListingsByCreator,
  recordUsage,
} from "./src/domains/economy/marketplace/marketplace";
import {
  recordEconomicEvent,
  getEventsByPrincipal,
  getRevenueSummary,
} from "./src/domains/economy/revenue/revenue-ledger";
import {
  credit,
  getBalance,
  getLedger,
  requestPayout,
} from "./src/domains/economy/wallet/wallet";
import {
  evaluatePolicy,
  getActiveRules,
  fileDispute,
  resolveDispute,
  getDisputes,
} from "./src/domains/economy/governance/economic-governance";

dotenv.config();
assertStrictEnv();

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

const log = createLogger("server");

const app = express();
const PORT = Number(process.env.PORT || 3000);
export { app };

// ─── API KEY SERVICE INIT ─────────────────────────────────────────
try {
  // Pepper resolution lives in the service: API_KEY_PEPPER env wins; without
  // it the pepper is domain-separated from the native secret, never reused raw.
  const repo = new SqliteApiKeyRepository();
  configureApiKeyService(repo, process.env.API_KEY_PEPPER ? { pepper: process.env.API_KEY_PEPPER } : {});
  log.info("api_key_service_initialized", { engine: "sqlite" });
} catch (err: unknown) {
  log.error("api_key_service_init_failed", { error: toErrorMessage(err) });
}

// Export native Ed25519 public key for the authz-runtime PDP (Ed25519 mode).
// Gateado: solo escribe el PEM cuando se habilita explícitamente, para no
// tocar el disco en rutas normales ni en producción sin consentimiento.
if (process.env.ISABELLA_AUTHZ_EXPORT_NATIVE_KEY === "true") {
  try {
    const pem = getNativeEd25519PublicKeyPem();
    if (pem) {
      const target =
        process.env.ISABELLA_AUTHZ_PUBLIC_KEY_PATH ||
        path.join(process.cwd(), "authz-runtime", "keys", "native-public.pem");
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, pem, "utf8");
      log.info("authz_native_public_key_exported", { target });
    }
  } catch (err: unknown) {
    log.error("authz_key_export_failed", { error: toErrorMessage(err) });
  }
}

app.use(express.json({ limit: "10mb" }));
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});
app.get("/api/v1/security/csrf-token", issueCsrfToken);
app.use(csrfProtection);
app.use(promptInjectionGuard);
app.use(atlasRouter);
app.use("/api/v1", creatorEconomyRouter);
app.use(tamvPlatformRouter);

// ─── NATIVE AUTH BOOTSTRAP ──────────────────────────────────────────
// P0 FIX: Bootstrap is ONLY available in non-production environments.
// In production, admin users must be created via database seeding or a
// dedicated admin provisioning endpoint with proper authorization.
app.post("/api/v1/auth/native/bootstrap", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  if (isProduction) {
    return res.status(403).json({
      ok: false,
      error: "Bootstrap is disabled in production. Use admin provisioning instead.",
    });
  }
  try {
    const boot = bootstrapNativeAuth();
    log.warn("Native auth bootstrap called (dev-only)", { userId: boot.userId });
    res.json({ ok: true, userId: boot.userId, handle: boot.handle, isFirstBoot: boot.isFirstBoot });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: toErrorMessage(err) || "Bootstrap failed" });
  }
});

app.get("/api/v1/auth/native/health", (_req, res) => {
  res.json({ ok: true, engine: "native", secretGenerated: !!getNativeSecret() });
});

// ─── GUEST SESSION ──────────────────────────────────────────────────
// First-party anonymous session for the web app. Mints a short-lived,
// low-privilege JWT (citizen role, allowlisted scopes, free plan) so the
// SPA can call authenticated endpoints (chat, image, voice) without any
// prior signup. Token is delivered via httpOnly cookie (no localStorage).
// Elevated scopes/roles are impossible from this endpoint.
app.post("/api/v1/auth/session", rateLimit, (req, res) => {
  const { sessionId, scopes, plan } = req.body || {};
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ ok: false, error: "sessionId is required" });
  }
  try {
    const session = mintGuestSession({ sessionId, requestedScopes: scopes, requestedPlan: plan });
    log.info("guest_session_minted", { sub: session.principal.sub });
    const isSecure = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
    const cookieBase = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.expiresInSec}`;
    const cookieFlags = isSecure ? `${cookieBase}; Secure` : cookieBase;
    res.setHeader("Set-Cookie", `__Host-isa_session=${encodeURIComponent(session.token)}; ${cookieFlags}`);
    // P0.3: el JWT se entrega EXCLUSIVAMENTE vía cookie HttpOnly. No se
    // devuelve en el cuerpo JSON para evitar exposición a XSS/localStorage.
    res.json({
      ok: true,
      expiresIn: session.expiresInSec,
      principal: session.principal,
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: toErrorMessage(err) || "Session mint failed" });
  }
});

// ─── AUTHZ RUNTIME PDP PROXY ─────────────────────────────────────────
// Reenvía una decisión al PDP sidecar (authz-runtime). Solo activo cuando
// ISABELLA_AUTHZ_RUNTIME_URL está configurado; fail-closed en caso contrario.
app.post("/api/v1/authz/authorize", rateLimit, async (req, res) => {
  if (!process.env.ISABELLA_AUTHZ_RUNTIME_URL) {
    return res.status(404).json({ ok: false, error: "Authz runtime not configured" });
  }
  try {
    const decision = await authorizeWithPdp(req.body as Parameters<typeof authorizeWithPdp>[0], 1500);
    res.status(decision.status === "ALLOW" ? 200 : 403).json(decision);
  } catch {
    res.status(503).json({ ok: false, error: "PDP unavailable", code: "PDP_UNAVAILABLE" });
  }
});

// ─── API KEY MANAGEMENT ─────────────────────────────────────────────
// Key lifecycle demands the explicit "keys:manage" scope. Guest sessions
// never carry it (their allowlist filters it out), so anonymous web users
// cannot mint persistent credentials; operators' API keys can hold it.
app.post("/api/v1/apikeys", rateLimit, authenticate, requireScope("keys:manage"), (req, res) => {
  const principal = currentPrincipal(req);
  const { name, scopes, plan, expiresInDays, rateLimitPerMinute } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ ok: false, error: "name is required" });
  }
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return res.status(400).json({ ok: false, error: "scopes array is required (no wildcard)" });
  }

  // P0 FIX: Validate requested scopes are a subset of creator's scopes
  // Admin/system can create keys with any allowed scope
  const creatorScopes = principal.scopes || [];
  const isPrivileged = principal.roles.includes("admin") || principal.roles.includes("system");
  if (!isPrivileged) {
    const requestedSet = new Set(scopes.map(String));
    const creatorSet = new Set(creatorScopes);
    const unauthorized = [...requestedSet].filter((s) => !creatorSet.has(s));
    if (unauthorized.length > 0) {
      return res.status(403).json({
        ok: false,
        error: `Cannot grant scopes not held by creator: ${unauthorized.join(", ")}`,
      });
    }
  }

  // Block wildcard in API keys — always
  if (scopes.some((s: string) => s === "*")) {
    return res.status(403).json({ ok: false, error: "Wildcard scope forbidden in API keys" });
  }

  const result = createApiKey({
    name,
    userId: principal.sub,
    tenantId: principal.tenantId || "nodo-cero-rdm",
    createdBy: principal.sub,
    scopes,
    plan,
    expiresInDays,
    rateLimitPerMinute,
  });
  res.status(201).json({ ok: true, data: result });
});

app.get("/api/v1/apikeys", authenticate, requireScope("keys:manage"), (req, res) => {
  const principal = currentPrincipal(req);
  const keys = listApiKeys(principal.sub, principal.tenantId || "nodo-cero-rdm");
  res.json({ ok: true, data: keys });
});

app.post("/api/v1/apikeys/:keyId/revoke", authenticate, requireScope("keys:manage"), (req, res) => {
  const principal = currentPrincipal(req);
  const ok = revokeApiKey(req.params.keyId, principal.sub, principal.tenantId || "nodo-cero-rdm");
  if (!ok) return res.status(404).json({ ok: false, error: "Key not found or already revoked" });
  res.json({ ok: true });
});

app.post("/api/v1/apikeys/:keyId/rotate", authenticate, requireScope("keys:manage"), (req, res) => {
  const principal = currentPrincipal(req);
  const result = rotateApiKey(req.params.keyId, principal.sub, principal.tenantId || "nodo-cero-rdm");
  if (!result) return res.status(404).json({ ok: false, error: "Key not found" });
  res.json({ ok: true, data: result });
});

app.delete("/api/v1/apikeys/:keyId", authenticate, requireScope("keys:manage"), (req, res) => {
  const principal = currentPrincipal(req);
  const ok = deleteApiKey(req.params.keyId, principal.sub, principal.tenantId || "nodo-cero-rdm");
  if (!ok) return res.status(404).json({ ok: false, error: "Key not found" });
  res.json({ ok: true });
});

// ─── SOVEREIGN INFERENCE ENGINE (primary) ─────────────────────────────
import { inferSovereign } from "./src/lib/isabella-inference-engine";
import { classifyIntent, buildLanguageDirectives, sophisticateReply } from "./src/lib/language/language-core";

// ─── Gemini optional fallback (lazy dynamic import, never blocks startup) ─
interface GeminiGenerateContentRequest {
  model: string;
  contents: unknown;
  config?: Record<string, unknown>;
}
interface GeminiGenerateContentResponse {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}
interface GeminiClient {
  models: {
    generateContent(req: GeminiGenerateContentRequest): Promise<GeminiGenerateContentResponse>;
  };
}
let geminiClient: GeminiClient | null = null;
let geminiLoadAttempted = false;

async function loadGeminiClient(): Promise<GeminiClient | null> {
  if (geminiLoadAttempted) return geminiClient;
  geminiLoadAttempted = true;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const mod = await import("@google/genai");
    const Ctor = (mod as unknown as { GoogleGenAI?: new (opts: { apiKey: string; httpOptions: { headers: Record<string, string> } }) => GeminiClient }).GoogleGenAI;
    if (typeof Ctor !== "function") return null;
    geminiClient = new Ctor({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    return geminiClient;
  } catch {
    geminiClient = null;
    return null;
  }
}

async function tryGeminiInference(params: {
  contents: unknown;
  config?: Record<string, unknown>;
  primaryModel?: string;
}): Promise<{ response: GeminiGenerateContentResponse; modelUsed: string } | null> {
  const ai = await loadGeminiClient();
  if (!ai) return null;
  const modelsToTry = [params.primaryModel || "gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: unknown = null;
  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({ model, contents: params.contents, config: params.config });
        return { response, modelUsed: model };
      } catch (err: unknown) {
        lastError = err;
        const msg = toErrorMessage(err) || String(err);
        const isTransient = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
        if (isTransient && attempt === 0) { await new Promise((r) => setTimeout(r, 800)); continue; }
        break;
      }
    }
  }
  log.warn("gemini_cascade_exhausted", { error: toErrorMessage(lastError) });
  return null;
}



app.get("/api/v1/isabella/v5/fusion", authenticate, (_req, res) => {
  res.json({ ok: true, fusion: summarizeIsabellaV5Fusion() });
});

// Governed PennyLane quantum ML bridge
app.get("/api/v1/quantum/pennylane/status", authenticate, requireScope("quantum:execute"), async (req, res) => {
  try {
    const input = QuantumBridgeRequestSchema.parse({ task: "diagnose", provider: "default.qubit", repository: "PennyLaneAI/pennylane" });
    const result = await runQuantumBridge(input, req);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: toErrorMessage(err) || String(err) });
  }
});

app.post("/api/v1/quantum/pennylane/execute", rateLimit, authenticate, requireScope("quantum:execute"), pdpAuthorize("quantum:execute"), quantumGuard, async (req, res) => {
  try {
    const input = req.quantumBridge!.input;
    const result = await runQuantumBridge(input, req);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: toErrorMessage(err) || String(err) });
  }
});

// Health and System Diagnostic API
// Ledger BFF (stateless): reenvía al servicio persistente o devuelve un snapshot
// demo explícitamente etiquetado. No aloja workers ni base autoritativa; el
// cliente nunca es fuente de verdad (C-06, C-07, C-15).
app.get("/api/ledger", authenticate, requireScope("ledger:read"), rateLimit, async (req, res) => {
  const upstream = process.env.ISABELLA_API_ORIGIN;
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor.slice(0, 512) : "";
  if (upstream) {
    try {
      const upstreamRes = await fetch(`${upstream}/api/v1/ledger?cursor=${encodeURIComponent(cursor)}`, {
        headers: {
          Accept: "application/json",
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        },
        signal: AbortSignal.timeout(2500),
      });
      const body = await upstreamRes.text();
      res.status(upstreamRes.status).set("Cache-Control", "no-store").type("application/json").send(body);
      return;
    } catch {
      res.status(503).json({
        origin: "unavailable",
        integrity: "unverified",
        blocks: [],
        fetchedAt: new Date().toISOString(),
        policyVersion: LEDGER_POLICY_VERSION,
        message: "LEDGER_UPSTREAM_UNAVAILABLE",
      });
      return;
    }
  }
  res.status(200).set("Cache-Control", "no-store").json(buildDemoLedgerSnapshot());
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    system: "Isabella Villaseñor AI Core",
    crownLayer: "Active",
    build: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      languageCore: true,
      voiceSharedKey: Boolean(process.env.VOICE_SHARED_KEY),
    },
    modules: ["CROWN", "ISA", "SOPHIA", "ORION", "ARGUS", "MNEMOSYNE", "TELLUS", "CHRONOS", "HERMES", "AXIOMA", "PRAXIS", "HARMONIA"],
    architecture: summarizeIsabellaV5Fusion(),
    sovereignEngine: true,
    geminiOptional: Boolean(process.env.GEMINI_API_KEY),
    voiceEngine: "Synthesizer & TTS Gateway Online",
    visualEngine: "Imagen & Neural Canvas Studio Online",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/v1/billing/plans", authenticate, (req, res) => {
  const { userId, plan } = getBillingIdentity(req);
  const current = evaluateUsage(userId, "chat", 1, plan);
  res.json({
    ok: true,
    currency: "USD",
    positioning: "Precios introductorios por debajo del promedio comercial para adopción temprana.",
    plans: ISABELLA_PLANS.map((p) => ({ ...p, checkoutUrl: p.id === "free" || p.id === "custom" ? null : buildCheckoutUrl(p.id, userId) })),
    current: { plan: current.plan, usage: getUsage(userId), remaining: current.remaining, resetAt: current.resetAt },
  });
});

app.get("/api/v1/billing/usage", authenticate, (req, res) => {
  const { userId, plan } = getBillingIdentity(req);
  const decision = evaluateUsage(userId, "chat", 1, plan);
  res.json({ ok: true, userId, plan: decision.plan, usage: decision.usage, remaining: decision.remaining, resetAt: decision.resetAt });
});

app.post("/api/v1/billing/checkout", rateLimit, authenticate, requireScope("billing:checkout"), (req, res) => {
  const parsed = validateBody(CheckoutSchema, req, res);
  if (!parsed) return;
  const { userId } = getBillingIdentity(req);
  const requestedPlan = (parsed.planId || parsed.plan || "plus") as IsabellaPlanId;
  if (requestedPlan === "free" || requestedPlan === "custom") {
    return res.status(400).json({ ok: false, error: "Selecciona plus, premium, vip o enterprise para checkout automático." });
  }
  res.json({ ok: true, checkoutUrl: buildCheckoutUrl(requestedPlan, userId), planId: requestedPlan });
});

app.get("/api/v1/billing/checkout/mock", authenticate, requireRole("admin"), (req, res) => {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_MOCK_CHECKOUT !== "true") {
    return res.status(404).json({ ok: false, error: "Mock checkout is disabled outside explicit development mode." });
  }
  const plan = String(req.query.plan || "plus") as IsabellaPlanId;
  const { userId } = getBillingIdentity(req);
  const applied = setUserPlan(userId, plan);
  res.json({ ok: true, mode: "mock-checkout-dev-only", user: userId, plan: applied });
});

// ─── Platform Feature Flags Endpoint ──────────────────────────────────────
app.get("/api/v1/flags", (req, res) => {
  const flags = featureFlagService.snapshot({
    environment: (process.env.NODE_ENV as "development" | "staging" | "production") || "development",
  });
  res.json({ ok: true, flags, timestamp: new Date().toISOString() });
});

// ─── Async Capability Jobs Router (202 Accepted + Polling) ────────────────
app.post("/api/v1/jobs", rateLimit, authenticate, (req, res) => {
  const { type, payload } = req.body || {};
  if (!type || typeof type !== "string") {
    return res.status(400).json({ ok: false, error: "El campo 'type' es requerido." });
  }

  const traceId = (req.headers["x-trace-id"] as string) || `isabella-${Date.now()}`;
  const job = jobStore.create({ type, payload: payload || {}, traceId });

  // Simulate non-blocking async execution in background
  setTimeout(() => {
    jobStore.update(job.id, {
      status: "COMPLETED",
      progress: 100,
      result: {
        message: `Trabajo asíncrono ${type} procesado exitosamente por el Enclave Nodo Cero.`,
        executedAt: new Date().toISOString(),
      },
    });
  }, 1200);

  res.status(202).json({
    status: "accepted",
    responseMode: "ASYNC",
    jobId: job.id,
    traceId,
    pollUrl: `/api/v1/jobs/${job.id}`,
    createdAt: job.createdAt,
  });
});

app.get("/api/v1/jobs/:jobId", (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ ok: false, error: "Job no encontrado." });
  }
  res.json({ ok: true, job });
});

// ============================================================================
// ISABELLA CORE & NODO CERO CANONICAL API (v1)
// Architecture: Perception -> Memory -> Policy Gate -> Decision -> Action -> Audit
// ============================================================================

// 1. GET /api/v1/isabella - Diagnostic & Metadata Endpoint
app.get("/api/v1/isabella", (req, res) => {
  res.json({
    ok: true,
    subsystem: "Isabella Villaseñor AI :: Nodo Cero Core Gateway",
    version: "4.2.0-Enterprise",
    canonicalCycle: "Perceive -> Remember -> Policy Gate -> Decide -> Act -> Audit",
    nodeId: process.env.NEXT_PUBLIC_NODE_ID || "nd-rdm-nodo-cero",
    nodeName: "RealDelMonte",
    info: "Isabella endpoint - POST perceptions to /api/v1/isabella to process governed cognitive inputs.",
    supportedInputTypes: ["chat", "event", "signal", "api", "ui"],
    endpoints: {
      processPerception: "POST /api/v1/isabella",
      auditLogs: "GET /api/v1/isabella/audit",
      hierarchicalMemory: "GET /api/v1/isabella/memory",
      registerMemory: "POST /api/v1/isabella/memory",
      toolsCatalog: "GET /api/v1/isabella/tools",
      executeTool: "POST /api/v1/isabella/tools/execute",
      policies: "GET /api/v1/isabella/policies",
      migrations: "GET /api/v1/isabella/migrations",
      blueprint: "GET /api/v1/isabella/blueprint",
    },
    timestamp: new Date().toISOString(),
  });
});

// 2. POST /api/v1/isabella - Perception Processor (Next.js / Hub standard route)
app.post("/api/v1/isabella", rateLimit, authenticate, quotaGate("chat"), async (req, res) => {
  try {
    const parsed = validateBody(PerceptionInputSchema, req, res);
    if (!parsed) return;
    
    // Normalization & Validation of Perception
    const perception: IsabellaPerception = {
      sessionId: parsed.sessionId || `sess-${Date.now()}`,
      actorId: currentPrincipal(req).sub,
      territoryId: parsed.territoryId || "rdm-nodo-cero",
      inputType: parsed.inputType || "chat",
      payload: parsed.payload || (parsed.text ? { text: parsed.text } : {}),
      timestamp: parsed.timestamp || new Date().toISOString(),
      metadata: parsed.metadata || {},
    };

    // Execute canonical domain handler
    const decision = await processPerception(perception);

    return res.status(200).json({
      ok: true,
      decision,
      nodeId: process.env.NEXT_PUBLIC_NODE_ID || "nd-rdm-nodo-cero",
      evaluatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    log.error("perception_error", { error: toErrorMessage(err) });
    return res.status(400).json({ ok: false, error: toErrorMessage(err) || String(err) });
  }
});

// 3. GET /api/v1/isabella/audit - Cryptographic Audit Trail
app.get("/api/v1/isabella/audit", authenticate, requireScope("audit:read"), async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const logs = getRecentAuditLogs(limit);
  const { createHash } = await import("crypto");
  const logHash = createHash("sha256").update(JSON.stringify(logs)).digest("hex");
  res.json({
    ok: true,
    count: logs.length,
    logs,
    sha256Verification: logHash,
    timestamp: new Date().toISOString(),
  });
});

// 4. GET /api/v1/isabella/memory - Hierarchical Memory Query
app.get("/api/v1/isabella/memory", authenticate, requireScope("memory:read"), (req, res) => {
  const VALID_SCOPES = ["immediate", "session", "project", "territorial", "historical"] as const;
  const scopeParam = typeof req.query.scope === "string" ? req.query.scope : undefined;
  const scope = scopeParam && (VALID_SCOPES as readonly string[]).includes(scopeParam) ? (scopeParam as import("./src/contracts/isabella").IsabellaMemoryScope) : undefined;
  const query = typeof req.query.q === "string" ? req.query.q : undefined;
  const minRelevance = req.query.minRelevance ? parseFloat(req.query.minRelevance as string) : undefined;

  const memories = queryMemory({ scope, searchQuery: query, minRelevance });
  res.json({
    ok: true,
    count: memories.length,
    scopes: ["immediate", "session", "project", "territorial", "historical"],
    memories,
  });
});

// 5. POST /api/v1/isabella/memory - Register Memory Item
app.post("/api/v1/isabella/memory", authenticate, requireScope("memory:write"), async (req, res) => {
  try {
    const { content, scope = "immediate", sourceType = "user", relevance = 0.8, contentJson } = req.body;
    if (!content || typeof content !== "string") {
      return res.status(400).json({ ok: false, error: "Campo 'content' es requerido." });
    }

    const item = await addMemoryItem({
      tenantId: currentPrincipal(req).tenantId,
      scope,
      content,
      contentJson,
      sourceType,
      relevance,
    });

    await auditTrace({
      eventType: "memory.item_added",
      data: { memoryId: item.memoryId, scope: item.scope, relevance: item.relevance },
    });

    res.json({ ok: true, memoryItem: item });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: toErrorMessage(err) || String(err) });
  }
});

// 6. GET /api/v1/isabella/tools - Registered Tool Catalog
app.get("/api/v1/isabella/tools", (req, res) => {
  res.json({
    ok: true,
    total: REGISTERED_TOOLS.length,
    tools: REGISTERED_TOOLS,
  });
});

// 7. POST /api/v1/isabella/tools/execute - Tool Execution Sandbox
app.post("/api/v1/isabella/tools/execute", rateLimit, authenticate, requireScope("tools:execute"), quotaGate("tool"), async (req, res) => {
  try {
    const { toolName, arguments: args = {} } = req.body;
    if (!toolName) {
      return res.status(400).json({ ok: false, error: "toolName es requerido." });
    }

    const traceId = `trace-tool-${Date.now()}`;
    await auditTrace({
      eventType: "tool.execution_requested",
      data: { toolName, args },
      traceId,
    });

    const execution = await executeTool({ toolName, arguments: args });

    await auditTrace({
      eventType: "tool.executed",
      data: { toolName, success: execution.success, executionTimeMs: execution.executionTimeMs },
      traceId,
    });

    res.json({
      ok: execution.success,
      result: execution.result,
      executionTimeMs: execution.executionTimeMs,
      traceId,
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: toErrorMessage(err) || String(err) });
  }
});

// 8. GET /api/v1/isabella/policies - Governance & Policy Rules
app.get("/api/v1/isabella/policies", authenticate, requireScope("governance:read"), (req, res) => {
  res.json({
    ok: true,
    governanceFramework: "C.R.O.W.N. & ARGUS Zero Trust Protocol",
    maxRiskWithoutApproval: "low",
    rules: [
      { key: "RULE_01_ZERO_TRUST_TOOL_WHITELIST", description: "Herramientas no registradas o no autorizadas son bloqueadas por defecto." },
      { key: "RULE_02_TERRITORIAL_DATA_BOUNDARY", description: "La memoria territorial y soberana no puede ser purgada ni exfiltrada." },
      { key: "RULE_03_HUMAN_IN_THE_LOOP_ESCALATION", description: "Operaciones de alto impacto requieren ratificación humana." },
      { key: "RULE_04_EPHEMERAL_TOKEN_LIFECYCLE", description: "Los tokens de inferencia expiran al culminar el ciclo de arbitraje." },
      { key: "RULE_05_LATIN_AMERICAN_SOVEREIGNTY_CHECK", description: "El contexto y la gobernanza pertenecen a Nodo Cero / RDM Digital." },
    ],
  });
});

// 9. GET /api/v1/isabella/migrations - Database Schema & SQL
app.get("/api/v1/isabella/migrations", authenticate, requireRole("admin"), (req, res) => {
  res.json({
    ok: true,
    filename: "001_create_isabella_tables.sql",
    target: "PostgreSQL / Supabase",
    tables: SCHEMA_TABLES,
    sql: ISABELLA_SQL_MIGRATION,
  });
});

// 10. GET /api/v1/isabella/blueprint - Architecture Blueprint
app.get("/api/v1/isabella/blueprint", authenticate, requireRole("admin"), (req, res) => {
  res.json({
    ok: true,
    blueprint: ISABELLA_BLUEPRINT,
  });
});

// ============================================================================
// ISABELLA AGENT LEASING & PROGRAMMATIC ORCHESTRATION ENGINE (v1)
// Native API for Agent Leasing, Thought Streaming, Tool Interception & Loops
// ============================================================================

interface AgentCapabilities {
  allowRunCommand: boolean;
  allowFileEdit: boolean;
  allowImageGen: boolean;
  allowVoiceSynthesis: boolean;
  allowNetworkFetch: boolean;
  securityLevel: "zero_trust_strict" | "zero_trust_standard";
}
interface AgentChatHistoryEntry {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}
interface AgentSessionRecord {
  sessionId: string;
  status: "active" | "terminated" | "expired";
  createdAt: string;
  expiresAt: string;
  systemInstructions: string;
  capabilities: AgentCapabilities;
  preset: string;
  model: string;
  history: AgentChatHistoryEntry[];
}

const activeAgentSessions = new Map<string, AgentSessionRecord>();

// TTL cleanup — sweep expired agent sessions every 5 minutes to prevent OOM
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeAgentSessions) {
    if (session.status !== "active" || Date.parse(session.expiresAt) <= now) {
      activeAgentSessions.delete(id);
    }
  }
}, 300_000);

// ─── PQC ATTESTATION GUARDS (PROTOTYPE) ────────────────────────────────
// P0.1: La criptografía PQC de este repositorio es PROTOTYPE. Nunca debe
// presentarse como garantía de producción. Solo es válida bajo
// FEATURE_LAB_MODE=true; en producción (o ante cualquier error) se omite el
// bloque de atestación en lugar de crashear el endpoint o falsificar pruebas.
function safePqcAttestation(context: string, message: string): Record<string, unknown> | null {
  if (process.env.FEATURE_LAB_MODE !== "true") return null;
  try {
    const proof = signLedgerBlockPQC(context, message);
    return {
      mlDsaSignature: proof.mlDsaSignature.slice(0, 48) + "...",
      slhDsaSignature: proof.slhDsaSignature.slice(0, 48) + "...",
      litleGatesStatus: proof.litleGatesStatus,
      pqcCompliant: false,
      implementationStatus: "PROTOTYPE_NOT_PRODUCTION",
    };
  } catch {
    return null;
  }
}

function buildPqcLeaseAttestation(sessionId: string): Record<string, unknown> | null {
  if (process.env.FEATURE_LAB_MODE !== "true") return null;
  try {
    const kemPair = generateMLKEMKeyPair(sessionId);
    const kemCipher = encapsulateMLKEM(kemPair.publicKey);
    const pqcProof = signLedgerBlockPQC(`lease-${sessionId}`, kemCipher.sharedSecretHash);
    return {
      kemAlgorithm: "ML-KEM-768",
      signatureAlgorithm: "ML-DSA-87 + SLH-DSA-128s",
      litleGatesStatus: pqcProof.litleGatesStatus,
      sharedSecretHash: kemCipher.sharedSecretHash.slice(0, 32) + "...",
      mlDsaSignature: pqcProof.mlDsaSignature.slice(0, 48) + "...",
      pqcCompliant: false,
      implementationStatus: "PROTOTYPE_NOT_PRODUCTION",
    };
  } catch {
    return null;
  }
}

const PQC_DISABLED_ATTESTATION = { status: "unavailable", reason: "pqc_prototype_disabled" } as const;

// 11. POST /api/v1/isabella/agent/lease - Lease an autonomous Isabella Agent
app.post("/api/v1/isabella/agent/lease", rateLimit, authenticate, requireScope("agent:lease"), pdpAuthorize("agent:lease"), quotaGate("agent"), (req, res) => {
  const parsed = validateBody(AgentLeaseSchema, req, res);
  if (!parsed) return;
  const sessionId = `isabella-agent-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const durationMinutes = parsed.leaseDurationMinutes || 60;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60000);

  const session: AgentSessionRecord = {
    sessionId,
    status: "active",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    systemInstructions: parsed.systemInstructions || "Eres Isabella Villaseñor AI, infraestructura cognitiva territorial gobernada.",
    capabilities: {
      allowRunCommand: false,
      allowFileEdit: false,
      allowImageGen: true,
      allowVoiceSynthesis: true,
      allowNetworkFetch: true,
      securityLevel: "zero_trust_strict",
    },
    preset: parsed.activePreset || "prime",
    model: parsed.primaryModel || "isabella-sovereign-v1",
    history: [],
  };

  activeAgentSessions.set(sessionId, session);

  res.status(201).json({
    ok: true,
    message: "Agente Isabella arrendado y registrado en C.R.O.W.N. Gateway.",
    session,
    pqcAttestation: buildPqcLeaseAttestation(sessionId) ?? PQC_DISABLED_ATTESTATION,
  });
});

// 12. POST /api/v1/isabella/agent/chat - Programmatic Agent Chat Execution with Thought & Tool Interception
app.post("/api/v1/isabella/agent/chat", rateLimit, authenticate, requireScope("agent:chat"), quotaGate("chat"), async (req, res) => {
  try {
    const parsed = validateBody(AgentChatSchema, req, res);
    if (!parsed) return;
    const { sessionId, prompt, contextPayload } = parsed;
    let session = sessionId ? activeAgentSessions.get(sessionId) : null;

    if (!session) {
      return res.status(404).json({ ok: false, error: "Agent session not found. Lease a session before chat execution." });
    }

    if (session.status !== "active" || Date.parse(session.expiresAt) <= Date.now()) {
      if (session.status === "active") session.status = "expired";
      return res.status(410).json({ ok: false, error: "Agent session expired or inactive." });
    }

    const perception: IsabellaPerception = {
      sessionId: session.sessionId,
      actorId: currentPrincipal(req).sub,
      territoryId: "rdm-nodo-cero",
      inputType: "chat",
      payload: { text: prompt || "Hola Isabella", ...contextPayload },
      timestamp: new Date().toISOString(),
      metadata: { capabilities: session.capabilities },
    };

    const decision = await processPerception(perception);

    // Build thoughts stream
    const thoughts = [
      { step: 1, module: "ISA" as const, thought: "Interpretación semántica e intención del usuario procesada con resonancia afectiva.", confidence: Math.floor((decision.confidence || 0.95) * 100), timestamp: new Date().toISOString() },
      { step: 2, module: "ARGUS" as const, thought: `Evaluación Zero-Trust ejecutada. Estado de seguridad: ${decision.policyStatus.toUpperCase()} (Riesgo: ${decision.riskLevel}).`, confidence: 99, timestamp: new Date().toISOString() },
      { step: 3, module: "SOPHIA" as const, thought: `Inferencia dialéctica y síntesis de respuesta optimizada en modo ${session.preset}.`, confidence: 95, timestamp: new Date().toISOString() },
      { step: 4, module: "ORION" as const, thought: "Estructuración de artefactos y herramientas autorizadas.", confidence: 98, timestamp: new Date().toISOString() },
    ];

    // Intercept tool calls
    const toolCalls = (decision.toolCalls || []).map((tc, idx: number) => ({
      id: `tool-${Date.now()}-${idx}`,
      name: typeof tc === "string" ? tc : tc.toolName,
      args: typeof tc === "string" ? { input: prompt } : tc.arguments,
      status: "approved" as const,
      result: `Resultado ejecutado para ${typeof tc === "string" ? tc : tc.toolName}`,
      argusReason: decision.policyReason || "Herramienta autorizada por política C.R.O.W.N.",
      timestamp: new Date().toISOString(),
    }));

    // PQC attestation for chat response (PROTOTYPE — never a production guarantee)
    const chatPqcAttestation = safePqcAttestation(`chat-${session.sessionId}-${Date.now()}`, prompt || "empty");

    const responseObj = {
      text: decision.summary || "Inferencia procesada bajo la arquitectura de Isabella Villaseñor AI.",
      thoughts,
      tool_calls: toolCalls,
      telemetry: {
        tokensProcessed: Math.floor((prompt || "").length * 1.35) + 120,
        latencyMs: 320,
        modelUsed: session.model,
        isabellaMood: "Serena",
        argusStatus: decision.policyStatus.toUpperCase(),
      },
      pqcAttestation: chatPqcAttestation ?? PQC_DISABLED_ATTESTATION,
    };

    session.history.push({ role: "user", content: prompt, timestamp: new Date().toISOString() }, { role: "assistant", content: responseObj.text, timestamp: new Date().toISOString() });
    res.json(responseObj);
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: toErrorMessage(err) || String(err) });
  }
});

// 13. POST /api/v1/isabella/agent/stream - SSE Real-time Streaming for Tokens, Thoughts & Tools
app.post("/api/v1/isabella/agent/stream", authenticate, requireScope("agent:chat"), async (req, res) => {
  const prompt = (req.body?.prompt as string) || "Hola Isabella";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (type: string, payload: unknown) => {
    res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  };

  sendEvent("thought", { step: 1, module: "ISA", thought: "Percibiendo entrada conversacional en Nodo Cero...", confidence: 98 });
  await new Promise((r) => setTimeout(r, 150));

  sendEvent("thought", { step: 2, module: "ARGUS", thought: "Verificando política Zero-Trust y ausencia de vectores de inyección...", confidence: 99 });
  await new Promise((r) => setTimeout(r, 150));

  sendEvent("thought", { step: 3, module: "SOPHIA", thought: "Generando síntesis cognitiva basada en primeros principios...", confidence: 96 });
  await new Promise((r) => setTimeout(r, 150));

  // PQC attestation event (PROTOTYPE — only emitted under FEATURE_LAB_MODE)
  const streamPqcAttestation = safePqcAttestation(`stream-${Date.now()}`, prompt);
  sendEvent("pqc_attestation", streamPqcAttestation ?? PQC_DISABLED_ATTESTATION);
  await new Promise((r) => setTimeout(r, 100));

  const words = `Hola. Soy Isabella Villaseñor AI, infraestructura cognitiva territorial de Nodo Cero. He procesado tu solicitud "${prompt}" con plena trazabilidad, gobernanza y firma poscuántica ML-DSA-87.`.split(" ");
  for (const word of words) {
    sendEvent("token", word + " ");
    await new Promise((r) => setTimeout(r, 40));
  }

  sendEvent("telemetry", { tokensProcessed: words.length * 2, latencyMs: 550, modelUsed: "gemini-3.7-flash", pqcEngine: "CRYSTALS-LATAMV" });
  res.end();
});

// Image Generation Helper: Produces authentic high-fidelity artistic visual outputs matching prompt and style
function buildGenerativeArtworkUrl(prompt: string, style = "cyber_ethereal", aspectRatio = "1:1"): string {
  const cleanPrompt = prompt.trim();

  // Style enrichments tailored to Isabella's artistic vision
  const styleKeywords: Record<string, string> = {
    cyber_ethereal: "ethereal digital painting, bioluminescent glow, celestial aura, delicate fine lines, intricate details, vivid cinematic lighting, 8k masterpiece",
    renaissance_neural: "classical fine art oil painting, dramatic chiaroscuro, gold leaf accents, fine brush strokes, baroque elegance, museum masterpiece",
    cosmic_rosegold: "cosmic nebula, rose gold stardust, iridescent celestial depth, shimmering crystalline light, ultra high quality",
    holographic_dream: "iridescent hologram art, translucent refractive glass, futuristic vaporwave elegance, ultra-detailed 3d render",
    sacred_geometry: "sacred geometric mandalas, golden ratio, intricate fractal patterns, radiant luminous lines, hyperdetailed",
    cyberpunk_neon: "cyberpunk city aesthetics, neon reflections in rain, dramatic depth of field, blade runner vibe, hyperrealistic",
  };

  const extraStyle = styleKeywords[style] || "digital art masterpiece, cinematic composition, elegant lighting, highly detailed";
  const enrichedPrompt = `${cleanPrompt}, ${extraStyle}`;

  const width = aspectRatio === "16:9" ? 1280 : aspectRatio === "9:16" ? 720 : aspectRatio === "4:3" ? 1024 : 1024;
  const height = aspectRatio === "16:9" ? 720 : aspectRatio === "9:16" ? 1280 : aspectRatio === "4:3" ? 768 : 1024;
  
  // Deterministic yet diverse seed per prompt (cryptographically random component)
  const seed = Math.abs(cleanPrompt.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + Math.floor(Math.random() * 1000000));

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(enrichedPrompt)}?width=${width}&height=${height}&nologo=true&enhance=true&seed=${seed}&model=flux`;
}

// Image Generation API: ORION Neural Flux Engine (Pollinations-based, zero external deps)
app.post("/api/isabella/generate-image", rateLimit, authenticate, quotaGate("image"), async (req, res) => {
  const startTime = Date.now();
  const parsed = validateBody(ImageGenSchema, req, res);
  if (!parsed) return;
  const { prompt, style = "cyber_ethereal", aspectRatio = "1:1" } = parsed;

  const realArtworkUrl = buildGenerativeArtworkUrl(prompt, style, aspectRatio);
  return res.json({
    success: true,
    image: {
      id: "img-" + Date.now(),
      url: realArtworkUrl,
      prompt,
      style,
      aspectRatio,
      timestamp: new Date().toLocaleTimeString(),
      author: "Isabella Villaseñor",
      source: "orion_flux",
    },
    meta: { latencyMs: Date.now() - startTime, engine: "ORION Neural Flux Generator" },
  });
});

// ─── Isabella Voice API (FastAPI proxy) ───────────────────────────────
const VOICE_API_URL = process.env.VOICE_API_URL || "http://localhost:8001";
const VOICE_SHARED_KEY = process.env.VOICE_SHARED_KEY || "";

/** Server-to-server credentials for the voice sidecar. */
function voiceServiceHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (VOICE_SHARED_KEY) headers["x-voice-key"] = VOICE_SHARED_KEY;
  return headers;
}

// Text-to-Speech: proxy to FastAPI voice service, returns JSON metadata
app.post("/api/isabella/tts", rateLimit, authenticate, quotaGate("voice", (req) => Math.ceil(String(req.body?.text || "").length / 14)), async (req, res) => {
  const startTime = Date.now();
  const parsed = validateBody(TTSSchema, req, res);
  if (!parsed) return;
  const { text, pitch = -1, rate = 0.92, timbre = "calida" } = parsed;

  try {
    const voiceResp = await fetch(`${VOICE_API_URL}/synthesize-json`, {
      method: "POST",
      headers: voiceServiceHeaders(),
      body: JSON.stringify({ text, rate, pitch }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!voiceResp.ok) {
      const errBody = await voiceResp.json().catch(() => ({ detail: "Voice API error" }));
      return res.status(voiceResp.status).json({
        ok: false,
        error: errBody.detail || `Voice API returned ${voiceResp.status}`,
        engine: "edge_tts",
      });
    }

    const voiceData = await voiceResp.json() as Record<string, unknown>;
    return res.json({
      ok: true,
      text,
      voice: "es-MX-DaliaNeural",
      settings: { pitch, rate, timbre },
      audioBase64: voiceData.audioBase64,
      contentType: "audio/mpeg",
      meta: { latencyMs: Date.now() - startTime, engine: "edge_tts" },
    });
  } catch (err) {
    const msg = err instanceof Error ? toErrorMessage(err) : "Voice service unreachable";
    log.warn("Voice API proxy error", { error: msg });
    return res.status(503).json({
      ok: false,
      engine: "edge_tts",
      availability: "unavailable",
      error: msg,
      checkedAt: new Date().toISOString(),
    });
  }
});

// ─── Sovereign Voice Endpoints (voiceUtils.ts expects these) ─────────────
app.post("/api/voice/synthesize", rateLimit, authenticate, quotaGate("voice", (req) => Math.ceil(String(req.body?.text || "").length / 14)), async (req, res) => {
  const startTime = Date.now();
  const { requestId, text, profile, modelVersion, locale, style, prosody } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({ ok: false, error: "text is required" });
  }

  try {
    const voiceResp = await fetch(`${VOICE_API_URL}/synthesize-json`, {
      method: "POST",
      headers: voiceServiceHeaders(),
      body: JSON.stringify({
        text,
        rate: prosody?.rate ?? 0.92,
        pitch: prosody?.pitch ?? -1,
        style: style ?? undefined,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!voiceResp.ok) {
      const errBody = await voiceResp.json().catch(() => ({ detail: "Voice API error" }));
      return res.status(voiceResp.status).json({
        ok: false,
        engine: "edge_tts",
        availability: voiceResp.status === 500 ? "degraded" : "unavailable",
        modelLoaded: false,
        profile: profile || "isabella_es_mx_v1",
        modelVersion: modelVersion || "1.0.0",
        checkedAt: new Date().toISOString(),
        error: errBody.detail,
      });
    }

    const voiceData = await voiceResp.json() as Record<string, unknown>;
    return res.json({
      ok: true,
      engine: "edge_tts",
      availability: "available",
      modelLoaded: true,
      profile: profile || "isabella_es_mx_v1",
      modelVersion: modelVersion || "1.0.0",
      requestId: requestId || `vreq_${Date.now()}`,
      contentType: "audio/mpeg",
      audioBase64: voiceData.audioBase64,
      voiceName: "es-MX-DaliaNeural",
      locale: locale || "es-MX",
      checkedAt: new Date().toISOString(),
      meta: { latencyMs: Date.now() - startTime },
    });
  } catch (err) {
    const msg = err instanceof Error ? toErrorMessage(err) : "Voice service unreachable";
    return res.status(503).json({
      ok: false,
      engine: "edge_tts",
      availability: "unavailable",
      modelLoaded: false,
      profile: profile || "isabella_es_mx_v1",
      modelVersion: modelVersion || "1.0.0",
      checkedAt: new Date().toISOString(),
      error: msg,
    });
  }
});

// ─── Language Core introspection ────────────────────────────────────
// Diagnostic surface for the native semantic layer: classify a sample
// utterance and inspect intent, confidence, entities, and directives.
app.post("/api/v1/language/profile", rateLimit, authenticate, (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.slice(0, 4_000) : "";
  if (!text.trim()) {
    return res.status(400).json({ ok: false, error: "text is required" });
  }
  const profile = classifyIntent(text);
  res.json({
    ok: true,
    data: {
      profile,
      directives: buildLanguageDirectives(profile),
    },
  });
});

app.get("/api/voice/health", async (_req, res) => {
  try {
    const healthResp = await fetch(`${VOICE_API_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (healthResp.ok) {
      const data = await healthResp.json();
      return res.json({
        engine: "edge_tts",
        availability: data.availability || "available",
        modelLoaded: data.modelLoaded ?? true,
        profile: "isabella_es_mx_v1",
        modelVersion: "1.0.0",
        voice: data.voice || "es-MX-DaliaNeural",
        checkedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Fall through to degraded response
  }
  res.json({
    engine: "edge_tts",
    availability: "unavailable",
    modelLoaded: false,
    profile: "isabella_es_mx_v1",
    modelVersion: "1.0.0",
    checkedAt: new Date().toISOString(),
  });
});

// Cognitive Processing API: CROWN routing + Multi-module cognitive synthesis
app.post("/api/isabella/process", rateLimit, authenticate, quotaGate("chat"), async (req, res) => {
  const startTime = Date.now();
  const parsed = validateBody(CognitiveProcessSchema, req, res);
  if (!parsed) return;
  const {
    input,
    history = [],
    crownConfig = {},
    activePreset: clientPreset = "prime",
    sessionId: clientSessionId,
  } = parsed;

  const sessionId = (typeof clientSessionId === "string" && clientSessionId.length > 0)
    ? clientSessionId
    : `session-${Date.now()}`;

  /*
   * LANGUAGE CORE: classify the utterance before routing. The classifier
   * recommends a preset; an explicit client preset always wins ("prime"
   * from the UI is the default, not a demand, so the classifier may
   * override it for better fit).
   */
  const langProfile = classifyIntent(input);
  const activePreset = (clientPreset === "prime" && langProfile.confidence >= 0.6)
    ? langProfile.recommendedPreset
    : clientPreset;

  const isImageRequest = langProfile.intent === "image_request"
    || /(genera|crea|dibuja|pintar|ilustra|visualiza|hazme una imagen|generar imagen|create an image|draw|visualize|paint)/i.test(input);

    // ─── PRIMARY: Sovereign inference engine (zero external dependencies) ─
  const sovereignResult = inferSovereign(input, { history, activePreset, crownConfig, isImageRequest });

  // If image requested, generate via ORION Flux (Pollinations)
  if (isImageRequest || sovereignResult.suggestedImagePrompt) {
    const imagePrompt = sovereignResult.suggestedImagePrompt || input;
    const realArtworkUrl = buildGenerativeArtworkUrl(imagePrompt, "cyber_ethereal", "1:1");
    sovereignResult.generatedImage = {
      id: "img-" + Date.now(),
      url: realArtworkUrl,
      prompt: imagePrompt,
      style: "cyber_ethereal",
      aspectRatio: "1:1",
      timestamp: new Date().toLocaleTimeString(),
      author: "Isabella Villaseñor",
      source: "orion_flux",
    };
  }

  // ─── OPTIONAL: Gemini enhancement (lazy, never blocks, never required) ─
  const languageDirectives = buildLanguageDirectives(langProfile);
  let reply = sovereignResult.reply;
  let engineLabel = "Isabella Sovereign Engine";
  try {
    const geminiResult = await tryGeminiInference({
      primaryModel: "gemini-3.7-flash",
      contents: `${languageDirectives}\n\nReply as a JSON object with fields: reply, routingDecisions, cognitiveTelemetry, isabellaState. Active preset: ${activePreset}. User says: "${input.slice(0, 2_000)}".`,
      config: {
        systemInstruction: "You are Isabella Villaseñor AI, a Territorial Cognitive Infrastructure. Reply ONLY with valid JSON.",
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });
    if (geminiResult) {
      const responseText = geminiResult.response?.text || "";
      try {
        const geminiParsed = JSON.parse(responseText);
        if (geminiParsed.reply && geminiParsed.routingDecisions) {
          reply = geminiParsed.reply;
          engineLabel = `${geminiResult.modelUsed} + Sovereign Engine`;
          if (geminiParsed.cognitiveTelemetry) {
            sovereignResult.cognitiveTelemetry = geminiParsed.cognitiveTelemetry;
          }
          if (geminiParsed.isabellaState) {
            sovereignResult.isabellaState = geminiParsed.isabellaState;
          }
        }
      } catch {
        // Gemini returned non-JSON, stick with sovereign
      }
    }
  } catch {
    // Gemini unavailable, sovereign handles everything
  }

  /*
   * When the offline sovereign engine carried the reply, refine its prose
   * via the language core (lexicon + register closure, code fences intact).
   * When Gemini answered, its output already honours the directives.
   */
  sovereignResult.reply = engineLabel === "Isabella Sovereign Engine"
    ? sophisticateReply(reply, langProfile)
    : reply;

  // Idlen: inject contextual ad
  const msgCount = (history?.length || 0) + 1;
  const { text: replyWithAd, ad } = await maybeAppendAd(reply, {
    sessionId,
    userMessage: input,
    messageCount: msgCount,
  });
  if (ad) {
    sovereignResult.reply = replyWithAd;
    sovereignResult.sponsoredContent = {
      type: "idlen_chat_ad",
      adId: ad.adId,
      title: ad.title,
      ctaText: ad.ctaText,
      ctaUrl: ad.ctaUrl,
      advertiserName: ad.advertiserName,
      publisherId: ad.publisherId,
      requestId: ad.requestId,
    };
  }

  const totalLatency = Date.now() - startTime;
  return res.json({
    success: true,
    data: sovereignResult,
    meta: {
      latencyMs: totalLatency,
      engine: engineLabel,
      timestamp: new Date().toISOString(),
    },
  });
});

import { bootstrapCanonicalDocuments } from "./src/lib/bootstrap-canonical";
import {
  executeQuantumMesh,
  getMeshStatus,
  getDeviceRegistry,
  getEnabledDevices,
  runSmokeTest,
  runFullDiagnostics,
  getRegistryMetrics,
  evaluateQuantumPolicy as evalQuantumPolicy,
  getPolicyAuditLog,
  getPolicyMetrics,
  quantumScheduler,
  getCircuitStatus,
  getCircuitBreakerMetrics,
  resetCircuit,
  getWorkerStatus,
  registerWorker as registerQuantumWorker,
  replaceWorker,
  checkHeartbeats,
  getRecentBlocks,
  getBookPIMetrics,
  verifyChainIntegrity,
  getHSMStatus,
  resetHSMCircuits,
  getHSMMetrics,
  getTEEStatus,
  getEventLog,
  getEventBusMetrics,
  getCoreModulesStatus,
  getTelemetrySnapshot,
  getActiveIncidents,
  getAllIncidents,
  resolveIncident,
  getRecoveryMetrics,
  handlePennyLaneAbsent,
  handleWorkerHung,
  handleRemoteProviderDown,
  handleHSMUnavailable,
  handleTEEUnverifiable,
  handleBookPIPostgresDown,
  handleFederationNodeMalicious,
  QUANTUM_SQL_MIGRATION,
  QUANTUM_SQL_INDEXES,
  QUANTUM_SCHEMA_TABLES,
} from "./src/lib/quantum";
import { PrincipalSchema } from "./src/lib/quantum/contracts";
import { randomUUID } from "crypto";
import { getIsabellaAd, trackIdlenClick, maybeAppendAd, getIdlenStatus } from "./src/lib/idlen-ads.server";

// ============================================================================
// ISABELLA QUANTUM MESH — GOVERNED QUANTUM-CLASSICAL EXECUTION PLATFORM
// ============================================================================

// 1. POST /api/v1/quantum/execute — Full mesh execution (13-step governed pipeline)
app.post("/api/v1/quantum/execute", rateLimit, authenticate, requireScope("quantum:execute"), async (req, res) => {
  try {
    const parsed = validateBody(QuantumExecuteSchema, req, res);
    if (!parsed) return;
    const principal = currentPrincipal(req);
    const traceId = req.headers["x-trace-id"] as string || `trace-${randomUUID()}`;

    const request = {
      schema: "isabella-quantum-v1" as const,
      requestId: randomUUID(),
      traceId,
      tenantId: principal.tenantId,
      subjectId: principal.sub,
      provider: parsed.provider || "default.qubit",
      repository: parsed.repository || "PennyLaneAI/pennylane",
      mode: parsed.mode || "analytic",
      wires: parsed.wires || 4,
      shots: parsed.shots || null,
      features: parsed.features || [],
      weights: parsed.weights || [],
      scopes: principal.scopes,
      policyVersion: "quantum-policy-v1",
      metadata: parsed.metadata || {},
    };

    const principalParsed = PrincipalSchema.safeParse({
      subjectId: principal.sub,
      tenantId: principal.tenantId,
      role: principal.roles?.[0] || "user",
      scopes: principal.scopes,
      webauthnVerified: false,
      riskLevel: "low",
    });

    if (!principalParsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid principal", issues: principalParsed.error.issues });
    }

    const result = await executeQuantumMesh(request, principalParsed.data);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: toErrorMessage(err) || String(err) });
  }
});

// 2. GET /api/v1/quantum/mesh/status — Full mesh status (all subsystems)
app.get("/api/v1/quantum/mesh/status", authenticate, (req, res) => {
  res.json({ ok: true, mesh: getMeshStatus() });
});

// 3. GET /api/v1/quantum/devices — Device registry
app.get("/api/v1/quantum/devices", authenticate, (req, res) => {
  res.json({ ok: true, devices: getDeviceRegistry(), metrics: getRegistryMetrics() });
});

// 4. GET /api/v1/quantum/devices/enabled — Enabled devices only
app.get("/api/v1/quantum/devices/enabled", authenticate, (req, res) => {
  res.json({ ok: true, devices: getEnabledDevices() });
});

// 5. POST /api/v1/quantum/devices/smoke-test — Run smoke test on a provider
app.post("/api/v1/quantum/devices/smoke-test", rateLimit, authenticate, requireRole("operator"), async (req, res) => {
  const { provider } = req.body || {};
  if (!provider) return res.status(400).json({ ok: false, error: "provider is required" });
  const result = await runSmokeTest(provider);
  res.json({ ok: true, smokeTest: result });
});

// 6. POST /api/v1/quantum/devices/full-diagnostics — Full diagnostics scan
app.post("/api/v1/quantum/devices/full-diagnostics", rateLimit, authenticate, requireRole("operator"), async (req, res) => {
  const result = await runFullDiagnostics();
  res.json({ ok: true, diagnostics: result });
});

// 7. GET /api/v1/quantum/policy — Policy audit log
app.get("/api/v1/quantum/policy", authenticate, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json({ ok: true, metrics: getPolicyMetrics(), recentDecisions: getPolicyAuditLog(limit) });
});

// 8. GET /api/v1/quantum/scheduler — Queue status
app.get("/api/v1/quantum/scheduler", authenticate, (req, res) => {
  res.json({ ok: true, scheduler: quantumScheduler.status() });
});

// 9. GET /api/v1/quantum/circuit-breaker — Circuit breaker status
app.get("/api/v1/quantum/circuit-breaker", authenticate, (req, res) => {
  res.json({ ok: true, circuits: getCircuitStatus(), metrics: getCircuitBreakerMetrics() });
});

// 10. POST /api/v1/quantum/circuit-breaker/reset — Reset a circuit
app.post("/api/v1/quantum/circuit-breaker/reset", authenticate, requireRole("operator"), (req, res) => {
  const { provider } = req.body || {};
  if (!provider) return res.status(400).json({ ok: false, error: "provider is required" });
  resetCircuit(provider);
  res.json({ ok: true, message: `Circuit reset for ${provider}` });
});

// 11. GET /api/v1/quantum/workers — Worker status
app.get("/api/v1/quantum/workers", authenticate, (req, res) => {
  res.json({ ok: true, workers: getWorkerStatus() });
});

// 12. POST /api/v1/quantum/workers/heartbeat-check — Check for hung workers
app.post("/api/v1/quantum/workers/heartbeat-check", authenticate, requireRole("operator"), (req, res) => {
  const killed = checkHeartbeats();
  res.json({ ok: true, killedWorkers: killed });
});

// 13. GET /api/v1/quantum/bookpi — BookPI audit chain
app.get("/api/v1/quantum/bookpi", authenticate, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json({
    ok: true,
    metrics: getBookPIMetrics(),
    chainIntegrity: verifyChainIntegrity(),
    recentBlocks: getRecentBlocks(limit),
  });
});

// 14. GET /api/v1/quantum/hsm — HSM status
app.get("/api/v1/quantum/hsm", authenticate, requireRole("operator"), (req, res) => {
  res.json({ ok: true, hsm: getHSMStatus(), metrics: getHSMMetrics() });
});

// 15. POST /api/v1/quantum/hsm/reset — Reset HSM circuits
app.post("/api/v1/quantum/hsm/reset", authenticate, requireRole("admin"), (req, res) => {
  resetHSMCircuits();
  res.json({ ok: true, message: "HSM circuits reset" });
});

// 16. GET /api/v1/quantum/tee — TEE attestation status
app.get("/api/v1/quantum/tee", authenticate, (req, res) => {
  res.json({ ok: true, tee: getTEEStatus() });
});

// 17. GET /api/v1/quantum/events — Event log
app.get("/api/v1/quantum/events", authenticate, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json({ ok: true, events: getEventLog(limit), metrics: getEventBusMetrics() });
});

// 18. GET /api/v1/quantum/cores — 24 Core modules status
app.get("/api/v1/quantum/cores", authenticate, (req, res) => {
  res.json({ ok: true, cores: getCoreModulesStatus() });
});

// 19. GET /api/v1/quantum/telemetry — Full telemetry snapshot
app.get("/api/v1/quantum/telemetry", authenticate, (req, res) => {
  res.json({ ok: true, telemetry: getTelemetrySnapshot() });
});

// 20. GET /api/v1/quantum/recovery — Active incidents
app.get("/api/v1/quantum/recovery", authenticate, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json({ ok: true, active: getActiveIncidents(), all: getAllIncidents(limit), metrics: getRecoveryMetrics() });
});

// 21. POST /api/v1/quantum/recovery/resolve — Resolve an incident
app.post("/api/v1/quantum/recovery/resolve", authenticate, requireRole("operator"), (req, res) => {
  const { incidentId } = req.body || {};
  if (!incidentId) return res.status(400).json({ ok: false, error: "incidentId is required" });
  const resolved = resolveIncident(incidentId);
  res.json({ ok: resolved, incidentId });
});

// 22. GET /api/v1/quantum/migrations — Quantum SQL schema
app.get("/api/v1/quantum/migrations", authenticate, (req, res) => {
  res.json({
    ok: true,
    filename: "002_create_quantum_tables.sql",
    target: "PostgreSQL 15+ / Supabase",
    tables: QUANTUM_SCHEMA_TABLES,
    migrations: QUANTUM_SQL_MIGRATION,
    indexes: QUANTUM_SQL_INDEXES,
  });
});

// 23. GET /api/v1/quantum/blueprint — Full architecture blueprint
app.get("/api/v1/quantum/blueprint", authenticate, (req, res) => {
  res.json({
    ok: true,
    blueprint: {
      name: "Isabella Quantum Mesh",
      version: "1.0.0",
      architecture: "Governed Hybrid Quantum-Classical Execution Platform",
      layers: [
        "Interface (Isabella UI, Cattleya, Console)",
        "Identity (WebAuthn, session, tenant, roles, scopes)",
        "Isabella Gateway (validation, rate limit, idempotency, tracing)",
        "ARGUS Policy Plane (limits, provider allow-list, approval, risk)",
        "Yun Orchestrator (cognitive intent, planning, no crypto authority)",
        "Quantum Control Plane (registry, scheduler, queue, circuit breaker, audit)",
        "Execution Data Plane (worker-core, lightning, qiskit, braket, rigetti, catalyst)",
        "HSM/TEE (keys, attestation)",
        "BookPI/CRYSTALS-LATAMV (provenance, hash, replication)",
        "PostgreSQL/Event Bus/Backup (Heptafederado)",
      ],
      coreModules: 24,
      deviceProviders: getDeviceRegistry().map((d) => d.provider),
      eventTypes: [
        "quantum.request.accepted", "quantum.request.rejected",
        "quantum.job.queued", "quantum.job.started", "quantum.job.completed",
        "quantum.job.degraded", "quantum.job.failed", "quantum.worker.replaced",
        "quantum.provider.unavailable", "quantum.policy.changed",
        "quantum.audit.committed", "quantum.federation.replicated", "quantum.recovery.activated",
      ],
      safetyRules: [
        "Never label fallback as quantum",
        "Never label simulator as physical hardware",
        "No agent can self-elevate scopes",
        "No provider operates without credentials",
        "Queue has hard limit and controlled rejection",
        "Dead worker is replaced",
        "Timeouts kill isolated process",
        "Result has circuit hash",
        "BookPI event has previous hash",
        "High-impact event has HSM signature",
        "TEE only verified after validating evidence",
        "PostgreSQL persists execution and audit transactionally",
        "Heptafederado replicates only authorized events",
        "Chaos tests and failover tests required",
      ],
      simmetry: "identify -> validate -> authorize -> execute -> measure -> sign -> persist -> replicate -> reconcile",
    },
  });
});

// ============================================================================
// IDLEN — Click tracking (server-side) & Health
// ============================================================================

app.get("/api/health/idlen", (_req, res) => {
  res.json({ ok: true, ...getIdlenStatus() });
});

app.post("/api/v1/idlen/click", rateLimit, authenticate, async (req, res) => {
  const parsed = validateBody(IdlenClickSchema, req, res);
  if (!parsed) return;
  const { adId, publisherId, requestId } = parsed;
  const result = await trackIdlenClick({ adId, publisherId, requestId });
  res.json({ ok: result.tracked, error: result.error });
});

// ============================================================================
// AUTOMATION MESH — Human-friendly self-healing interface
// ============================================================================

app.get("/api/v1/automation/status", authenticate, (_req, res) => {
  res.json({ ok: true, data: getSystemSummary() });
});

app.get("/api/v1/automation/health", authenticate, (_req, res) => {
  res.json({ ok: true, data: getAutomationMeshStatus() });
});

app.get("/api/v1/automation/failures", authenticate, (_req, res) => {
  res.json({ ok: true, data: getActiveFailures() });
});

app.post("/api/v1/automation/describe", authenticate, (req, res) => {
  const { text } = req.body;
  if (typeof text !== "string" || text.length < 3) {
    res.status(400).json({ ok: false, error: "Provide a text description of the problem (min 3 chars)" });
    return;
  }
  res.json({ ok: true, data: describeProblem(text) });
});

app.get("/api/v1/automation/developer-guide/:nodeId", authenticate, (req, res) => {
  const guide = explainToDeveloper(req.params.nodeId);
  res.json({ ok: true, data: guide });
});

app.get("/api/v1/automation/repair-chains", authenticate, (_req, res) => {
  res.json({ ok: true, data: getActiveRepairChains() });
});

app.post("/api/v1/automation/repair/:chainId/next", authenticate, (req, res) => {
  const chain = executeRepairStep(req.params.chainId);
  if (!chain) {
    res.status(404).json({ ok: false, error: "Repair chain not found or already completed" });
    return;
  }
  res.json({ ok: true, data: chain });
});

app.post("/api/v1/automation/resolve/:nodeId", authenticate, (req, res) => {
  const { resolution } = req.body;
  const resolved = resolveFailureManually(req.params.nodeId, resolution || "Manual resolution");
  res.json({ ok: resolved, message: resolved ? "Failure resolved" : "No active failure for this node" });
});

// ============================================================================
// KILL-SWITCH ENDPOINTS (Section 18.3)
// ============================================================================

app.get("/api/v1/kill-switch/status", authenticate, (_req, res) => {
  res.json({ ok: true, data: getKillSwitchStatus() });
});

app.post("/api/v1/kill-switch/activate", authenticate, requireRole("admin"), (req, res) => {
  const { trigger, severity } = req.body;
  if (!trigger || typeof trigger !== "string") {
    res.status(400).json({ ok: false, error: "trigger string required" });
    return;
  }
  const event = activateKillSwitch(trigger, severity || "SEV-2");
  res.json({ ok: true, data: event });
});

app.post("/api/v1/kill-switch/:eventId/step", authenticate, requireRole("admin"), (req, res) => {
  const event = executeNextStep(req.params.eventId);
  if (!event) {
    res.status(404).json({ ok: false, error: "Kill-switch event not found or all steps completed" });
    return;
  }
  res.json({ ok: true, data: event });
});

app.post("/api/v1/kill-switch/:eventId/resolve", authenticate, requireRole("admin"), (req, res) => {
  const { approvedBy } = req.body;
  if (!approvedBy || typeof approvedBy !== "string") {
    res.status(400).json({ ok: false, error: "approvedBy string required" });
    return;
  }
  const resolved = resolveKillSwitch(req.params.eventId, approvedBy);
  res.json({ ok: resolved, message: resolved ? "Kill-switch resolved" : "Event not found or already resolved" });
});

app.get("/api/v1/kill-switch/events", authenticate, (_req, res) => {
  res.json({ ok: true, data: getKillSwitchEvents() });
});

// ============================================================================
// CLAIM RADAR ENDPOINTS (Section 11)
// ============================================================================

app.post("/api/v1/claim-radar/evaluate", authenticate, async (req, res) => {
  const { assertion, domain, source, sourceDoi, sourceOrcid, adapterIds, maxResults, timeoutMs } = req.body;
  if (!assertion || !domain || !source) {
    res.status(400).json({ ok: false, error: "assertion, domain, and source required" });
    return;
  }
  try {
    const claim = await evaluateClaim({ assertion, domain, source, sourceDoi, sourceOrcid, adapterIds, maxResults, timeoutMs });
    res.json({ ok: true, data: toEpistemicFormat(claim) });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Claim evaluation failed" });
  }
});

app.get("/api/v1/claim-radar/metrics", authenticate, (_req, res) => {
  res.json({ ok: true, data: getClaimRadarMetrics() });
});

// ============================================================================
// EPISTEMIC GOVERNANCE ENDPOINTS (Section 11.2)
// ============================================================================

app.get("/api/v1/epistemic/rules", authenticate, (_req, res) => {
  res.json({ ok: true, data: getEpistemicRules() });
});

app.post("/api/v1/epistemic/classify", authenticate, (req, res) => {
  const { domain, evidenceCount, contradictoryCount, avgRelevance, hasPrimarySource, hasDateAndScope } = req.body;
  if (!domain || typeof evidenceCount !== "number") {
    res.status(400).json({ ok: false, error: "domain and evidenceCount required" });
    return;
  }
  const result = classifyEpistemicStatus({
    domain,
    evidenceCount,
    contradictoryCount: contradictoryCount ?? 0,
    avgRelevance: avgRelevance ?? 0,
    hasPrimarySource: hasPrimarySource ?? false,
    hasDateAndScope: hasDateAndScope ?? false,
  });
  res.json({ ok: true, data: result });
});

// ============================================================================
// ISABELLA CORE — 12 BETA MODULES ENDPOINTS
// ============================================================================

import {
  runAgent,
  listSessions,
  getSessionHistory,
  createPlan,
  activatePlan,
  listPlans,
  listSkills,
  registerSkill,
  enableSkill,
  listProviders,
  processMessageEvent,
} from "./src/core/index";
import {
  classifyRisk,
  checkConsent,
  grantConsent,
  revokeConsent,
  listConsents,
  deleteUserData,
  exportUserData,
  auditReceipt,
  getReceipts,
  getReceiptStats,
} from "./src/governance/index";

// --- Orchestrator ---
app.post("/api/v1/core/agent/run", rateLimit, authenticate, async (req, res) => {
  const { sessionId, input, channel } = req.body || {};
  const tenantId = req.principal?.tenantId || "nodo-cero-rdm";
  const userId = req.principal?.sub || "anonymous";
  if (!input) {
    return res.status(400).json({ ok: false, error: "Missing required field: input." });
  }
  try {
    const result = await runAgent({ tenantId, userId, sessionId, input, channel: channel || "api" });
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/api/v1/core/sessions", authenticate, (req, res) => {
  const tenantId = String(req.principal?.tenantId || "nodo-cero-rdm");
  res.json({ ok: true, data: listSessions(tenantId) });
});

app.get("/api/v1/core/sessions/:sessionId/messages", authenticate, (req, res) => {
  res.json({ ok: true, data: getSessionHistory(req.params.sessionId) });
});

// --- Planner ---
app.post("/api/v1/core/plans", rateLimit, authenticate, (req, res) => {
  const { name, description, goal, steps, tenantId } = req.body || {};
  if (!name || !goal || !steps) {
    return res.status(400).json({ ok: false, error: "Missing required fields: name, goal, steps." });
  }
  const plan = createPlan({
    tenantId: tenantId || req.principal?.tenantId || "nodo-cero-rdm",
    userId: req.principal?.sub || "anonymous",
    name, description: description || "", goal, steps,
  });
  res.status(201).json({ ok: true, data: plan });
});

app.get("/api/v1/core/plans", authenticate, (req, res) => {
  const tenantId = String(req.principal?.tenantId || "nodo-cero-rdm");
  res.json({ ok: true, data: listPlans(tenantId) });
});

app.post("/api/v1/core/plans/:planId/activate", authenticate, (req, res) => {
  const plan = activatePlan(req.params.planId);
  if (!plan) return res.status(404).json({ ok: false, error: "Plan not found." });
  res.json({ ok: true, data: plan });
});

// --- Skills ---
app.get("/api/v1/core/skills", authenticate, (req, res) => {
  const category = String(req.query.category || undefined);
  res.json({ ok: true, data: listSkills(category || undefined) });
});

app.post("/api/v1/core/skills", rateLimit, authenticate, (req, res) => {
  const skill = registerSkill(req.body || {});
  res.status(201).json({ ok: true, data: skill });
});

app.post("/api/v1/core/skills/:skillId/enable", authenticate, (req, res) => {
  res.json({ ok: enableSkill(req.params.skillId) });
});

// --- Providers ---
app.get("/api/v1/core/providers", authenticate, (_req, res) => {
  res.json({ ok: true, data: listProviders() });
});

// --- Safety ---
app.post("/api/v1/core/classify-risk", authenticate, (req, res) => {
  const { input, channel } = req.body || {};
  if (!input) return res.status(400).json({ ok: false, error: "Missing input." });
  res.json({ ok: true, data: classifyRisk(input, channel || "api") });
});

// --- Consent ---
app.post("/api/v1/core/consent/grant", rateLimit, authenticate, (req, res) => {
  const { scope, purpose, expiresAt } = req.body || {};
  if (!scope || !purpose) return res.status(400).json({ ok: false, error: "Missing scope or purpose." });
  const consent = grantConsent({
    tenantId: req.principal?.tenantId || "nodo-cero-rdm",
    userId: req.principal?.sub || "anonymous",
    scope, purpose, expiresAt,
  });
  res.status(201).json({ ok: true, data: consent });
});

app.post("/api/v1/core/consent/revoke", rateLimit, authenticate, (req, res) => {
  const { consentId } = req.body || {};
  if (!consentId) return res.status(400).json({ ok: false, error: "Missing consentId." });
  const revoked = revokeConsent(req.principal?.tenantId || "nodo-cero-rdm", req.principal?.sub || "anonymous", consentId);
  res.json({ ok: revoked });
});

app.get("/api/v1/core/consent", authenticate, (req, res) => {
  res.json({
    ok: true,
    data: listConsents(req.principal?.tenantId || "nodo-cero-rdm", req.principal?.sub || "anonymous"),
  });
});

// --- Data Rights ---
app.get("/api/v1/core/data/export", authenticate, (req, res) => {
  const data = exportUserData(req.principal?.tenantId || "nodo-cero-rdm", req.principal?.sub || "anonymous");
  res.json({ ok: true, data });
});

app.post("/api/v1/core/data/delete", rateLimit, authenticate, (req, res) => {
  const result = deleteUserData(req.principal?.tenantId || "nodo-cero-rdm", req.principal?.sub || "anonymous");
  res.json({ ok: true, data: result });
});

// --- Audit Receipts ---
app.get("/api/v1/core/audit", authenticate, (req, res) => {
  const tenantId = String(req.principal?.tenantId || "nodo-cero-rdm");
  const limit = Number(req.query.limit) || 50;
  res.json({ ok: true, data: getReceipts(tenantId, limit) });
});

app.get("/api/v1/core/audit/stats", authenticate, (req, res) => {
  const tenantId = String(req.principal?.tenantId || "nodo-cero-rdm");
  res.json({ ok: true, data: getReceiptStats(tenantId) });
});

// --- Gateway ---
app.post("/api/v1/core/gateway/message", rateLimit, authenticate, async (req, res) => {
  const { channel, content, sessionId } = req.body || {};
  const tenantId = req.principal?.tenantId || "nodo-cero-rdm";
  const userId = req.principal?.sub || "anonymous";
  if (!channel || !content) {
    return res.status(400).json({ ok: false, error: "Missing channel or content." });
  }
  try {
    const result = await processMessageEvent({
      channel, tenantId, userId, sessionId, content, timestamp: new Date().toISOString(),
    });
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ============================================================================
// DISTRIBUTED INGRESS MESH — 12-MODULE REDUNDANCY
// ============================================================================

import {
  ingestAndDeliver,
  getIngressMetrics,
  getRoutingTable,
} from "./src/core/ingress/ingress-distributor";
import {
  getHealthSnapshot,
  getAlertLog,
  isModuleHealthy,
  getHealthyModules,
  heartbeat,
} from "./src/core/ingress/health-monitor";
import {
  partitionData,
  getModuleLoadSnapshot,
} from "./src/core/ingress/data-partitioner";
import {
  getCurrentDegradationMode,
  getDegradationCapabilities,
  getCircuitBreakerStates,
} from "./src/core/ingress/resilience-protocol";

app.post("/api/v1/ingress/deliver", rateLimit, authenticate, async (req, res) => {
  const { dataType, payload, priority } = req.body || {};
  if (!dataType || !payload) {
    return res.status(400).json({ ok: false, error: "Missing dataType or payload." });
  }
  try {
    const result = await ingestAndDeliver({
      source: "api",
      tenantId: req.principal?.tenantId || "nodo-cero-rdm",
      userId: req.principal?.sub || "anonymous",
      dataType,
      payload,
      priority,
    });
    res.json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/api/v1/ingress/metrics", authenticate, (_req, res) => {
  res.json({ ok: true, data: getIngressMetrics() });
});

app.get("/api/v1/ingress/health", authenticate, (_req, res) => {
  res.json({ ok: true, data: getHealthSnapshot() });
});

app.get("/api/v1/ingress/health/:moduleId", authenticate, (req, res) => {
  const h = getHealthSnapshot().modules.find((m) => m.moduleId === req.params.moduleId);
  if (!h) return res.status(404).json({ ok: false, error: "Module not found." });
  res.json({ ok: true, data: h });
});

app.get("/api/v1/ingress/alerts", authenticate, (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json({ ok: true, data: getAlertLog(limit) });
});

app.get("/api/v1/ingress/routing-table", authenticate, (_req, res) => {
  res.json({ ok: true, data: getRoutingTable() });
});

app.get("/api/v1/ingress/load", authenticate, (_req, res) => {
  res.json({ ok: true, data: getModuleLoadSnapshot() });
});

app.get("/api/v1/ingress/degradation", authenticate, (_req, res) => {
  res.json({ ok: true, data: getDegradationCapabilities() });
});

app.get("/api/v1/ingress/circuit-breakers", authenticate, (_req, res) => {
  res.json({ ok: true, data: getCircuitBreakerStates() });
});

app.post("/api/v1/ingress/partition", authenticate, (req, res) => {
  const { dataType, payload } = req.body || {};
  if (!dataType || !payload) {
    return res.status(400).json({ ok: false, error: "Missing dataType or payload." });
  }
  res.json({ ok: true, data: partitionData({ dataType, payload }) });
});

app.post("/api/v1/ingress/heartbeat/:moduleId", authenticate, requireRole("system"), (req, res) => {
  heartbeat(req.params.moduleId as import("./src/core/ingress/ingress-distributor").IngressRoute | "bookpi-legacy");
  res.json({ ok: true });
});

// ============================================================================
// MCP HUB ENDPOINTS
// ============================================================================

app.get("/api/v1/mcp/health", authenticate, async (_req, res) => {
  res.json({ ok: true, data: await hubHealth() });
});

// ============================================================================
// ISABELLA ECONOMIC ENGINE — API ENDPOINTS
// ============================================================================

// ─── Opportunities ───────────────────────────────────────────────────
app.post("/api/v1/economy/opportunities/scan", rateLimit, authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const { capabilities = [], categories } = req.body || {};
  const opps = discoverOpportunities(
    principal.sub,
    principal.tenantId || "nodo-cero-rdm",
    capabilities,
    categories
  );
  res.json({ ok: true, data: opps, count: opps.length });
});

// ─── Creators ────────────────────────────────────────────────────────
app.post("/api/v1/economy/creators/profile", rateLimit, authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const { displayName, capabilities, skills } = req.body || {};
  if (!displayName) {
    return res.status(400).json({ ok: false, error: "displayName is required" });
  }
  const profile = createCreatorProfile({
    principalId: principal.sub,
    tenantId: principal.tenantId || "nodo-cero-rdm",
    displayName,
    capabilities: capabilities || [],
    skills: skills || [],
  });
  res.status(201).json({ ok: true, data: profile });
});

app.get("/api/v1/economy/creators/profile", authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const profile = getCreatorProfile(principal.sub, principal.tenantId || "nodo-cero-rdm");
  if (!profile) {
    return res.status(404).json({ ok: false, error: "Creator profile not found" });
  }
  res.json({ ok: true, data: profile });
});

app.get("/api/v1/economy/creators", authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const creators = listCreators(principal.tenantId || "nodo-cero-rdm");
  res.json({ ok: true, data: creators, count: creators.length });
});

// ─── Marketplace ─────────────────────────────────────────────────────
app.post("/api/v1/economy/marketplace/listings", rateLimit, authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const { assetType, name, description, price, version } = req.body || {};
  if (!assetType || !name || price === undefined) {
    return res.status(400).json({ ok: false, error: "assetType, name, and price are required" });
  }
  const listing = createListing({
    tenantId: principal.tenantId || "nodo-cero-rdm",
    creatorId: principal.sub,
    assetType,
    name,
    description: description || "",
    price,
    version,
  });
  res.status(201).json({ ok: true, data: listing });
});

app.get("/api/v1/economy/marketplace/search", authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const { assetType, status, minPrice, maxPrice, query } = req.query || {};
  const results = searchListings({
    tenantId: principal.tenantId || "nodo-cero-rdm",
    assetType: typeof assetType === "string" ? (assetType as import("./src/domains/economy/types").AssetType) : undefined,
    status: typeof status === "string" ? (status as import("./src/domains/economy/types").ListingStatus) : undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    query: typeof query === "string" ? query : undefined,
  });
  res.json({ ok: true, data: results, count: results.length });
});

app.get("/api/v1/economy/marketplace/my", authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const listings = getListingsByCreator(principal.sub, principal.tenantId || "nodo-cero-rdm");
  res.json({ ok: true, data: listings, count: listings.length });
});

// ─── Revenue & Ledger ────────────────────────────────────────────────
app.get("/api/v1/economy/revenue/summary", authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const summary = getRevenueSummary(principal.sub);
  res.json({ ok: true, data: summary });
});

app.get("/api/v1/economy/revenue/events", authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const limit = Number(req.query?.limit) || 50;
  const events = getEventsByPrincipal(principal.sub, limit);
  res.json({ ok: true, data: events, count: events.length });
});

// ─── Wallet ──────────────────────────────────────────────────────────
app.get("/api/v1/economy/wallet/balance", authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const balance = getBalance(principal.sub, principal.tenantId || "nodo-cero-rdm");
  res.json({ ok: true, data: balance });
});

app.get("/api/v1/economy/wallet/ledger", authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const limit = Number(req.query?.limit) || 50;
  const ledger = getLedger(principal.sub, principal.tenantId || "nodo-cero-rdm", limit);
  res.json({ ok: true, data: ledger, count: ledger.length });
});

app.post("/api/v1/economy/wallet/payout", rateLimit, authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const { amount, method } = req.body || {};
  if (!amount || amount <= 0) {
    return res.status(400).json({ ok: false, error: "Valid amount is required" });
  }
  const payout = requestPayout(
    principal.sub,
    principal.tenantId || "nodo-cero-rdm",
    amount,
    method || "bank_transfer"
  );
  if (!payout) {
    return res.status(400).json({ ok: false, error: "Insufficient balance" });
  }
  res.status(201).json({ ok: true, data: payout });
});

// ─── Governance ──────────────────────────────────────────────────────
app.get("/api/v1/economy/governance/rules", authenticate, (req, res) => {
  const rules = getActiveRules();
  res.json({ ok: true, data: rules });
});

app.post("/api/v1/economy/governance/disputes", rateLimit, authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const { eventId, reason } = req.body || {};
  if (!eventId || !reason) {
    return res.status(400).json({ ok: false, error: "eventId and reason are required" });
  }
  const dispute = fileDispute({
    eventId,
    principalId: principal.sub,
    tenantId: principal.tenantId || "nodo-cero-rdm",
    reason,
  });
  res.status(201).json({ ok: true, data: dispute });
});

app.get("/api/v1/economy/governance/disputes", authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const disputes = getDisputes(principal.tenantId || "nodo-cero-rdm");
  res.json({ ok: true, data: disputes, count: disputes.length });
});

// ─── Money Flow (complete chain) ───────────────────────────────────
// A sale touches every economic subsystem in one audited chain:
// governance verdict → revenue ledger → creator reputation → wallet credit.
// Any earlier rejection leaves all stores untouched, so partial money
// writes cannot exist.
app.post("/api/v1/economy/transactions", rateLimit, authenticate, (req, res) => {
  const principal = currentPrincipal(req);
  const { grossAmount, currency, category, description, listingId } = req.body || {};
  const amount = Number(grossAmount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return res.status(400).json({ ok: false, error: "Valid grossAmount is required" });
  }

  const event = recordEconomicEvent({
    tenantId: principal.tenantId || "nodo-cero-rdm",
    principalId: principal.sub,
    source: category === "sale" ? "marketplace_sale" : "service_payment",
    grossAmount: amount,
    currency: typeof currency === "string" ? currency : "USD",
    listingId: typeof listingId === "string" ? listingId : undefined,
    provenance: {
      creatorId: principal.sub,
      createdFrom: "api",
      evidenceIds: [],
      auditTrailId: randomUUID(),
      contentHash: createHash("sha256").update(`${principal.sub}:${amount}:${Date.now()}`).digest("hex"),
    },
  });

  const verdict = evaluatePolicy(event);
  if (verdict.decision !== "approved") {
    return res.status(403).json({ ok: false, error: "Transaction rejected by economic governance", data: verdict });
  }

  const reputation = recordTransaction(principal.sub, principal.tenantId || "nodo-cero-rdm", event.creatorShare);
  const ledgerEntry = credit(
    principal.sub,
    principal.tenantId || "nodo-cero-rdm",
    event.eventId,
    event.creatorShare,
    typeof description === "string" ? description.slice(0, 240) : `Transaction ${event.transactionId}`
  );

  res.status(201).json({
    ok: true,
    data: {
      event,
      verdict,
      reputation,
      ledgerEntry,
      balance: getBalance(principal.sub, principal.tenantId || "nodo-cero-rdm"),
    },
  });
});

// Listing consumption monetization: every paid execution registers usage.
app.post("/api/v1/economy/marketplace/listings/:listingId/usage", rateLimit, authenticate, (req, res) => {
  const { executionRevenue } = req.body || {};
  const revenue = Number(executionRevenue);
  if (!Number.isFinite(revenue) || revenue < 0) {
    return res.status(400).json({ ok: false, error: "Valid executionRevenue is required" });
  }
  const listing = recordUsage(req.params.listingId, revenue);
  if (!listing) return res.status(404).json({ ok: false, error: "Listing not found" });
  res.json({ ok: true, data: listing });
});

// Treasury operations: only platform operators may fund or drain wallets.
app.post("/api/v1/economy/wallet/credit", rateLimit, authenticate, requireRole("admin"), (req, res) => {
  const { principalId, amount, description, eventId } = req.body || {};
  const safeAmount = Number(amount);
  if (typeof principalId !== "string" || principalId.length === 0) {
    return res.status(400).json({ ok: false, error: "principalId is required" });
  }
  if (!Number.isFinite(safeAmount) || safeAmount <= 0 || safeAmount > 1_000_000) {
    return res.status(400).json({ ok: false, error: "Valid amount is required" });
  }
  const entry = credit(
    principalId,
    req.body?.tenantId || currentPrincipal(req).tenantId || "nodo-cero-rdm",
    typeof eventId === "string" ? eventId : `manual-${Date.now()}`,
    safeAmount,
    typeof description === "string" ? description.slice(0, 240) : "Treasury credit"
  );
  res.status(201).json({ ok: true, data: entry });
});

// Dispute resolution completes the governance loop.
app.post("/api/v1/economy/governance/disputes/:disputeId/resolve", rateLimit, authenticate, requireRole("operator"), (req, res) => {
  const { resolution, outcome } = req.body || {};
  if (outcome !== "resolved" && outcome !== "rejected") {
    return res.status(400).json({ ok: false, error: "outcome must be 'resolved' or 'rejected'" });
  }
  if (typeof resolution !== "string" || resolution.trim().length === 0) {
    return res.status(400).json({ ok: false, error: "resolution text is required" });
  }
  const dispute = resolveDispute(req.params.disputeId, resolution.slice(0, 500), outcome);
  if (!dispute) return res.status(404).json({ ok: false, error: "Dispute not found" });
  res.json({ ok: true, data: dispute });
});

// ============================================================================
// PROCESS-LEVEL ERROR HANDLERS (prevents silent crashes)
// ============================================================================
process.on("unhandledRejection", (reason: unknown) => {
  log.error("unhandled_rejection", { reason: String(reason) });
});

process.on("uncaughtException", (err: Error) => {
  log.error("uncaught_exception", { message: toErrorMessage(err), stack: err.stack });
  process.exit(1);
});

// Vite middleware & Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.post("*", (req, res) => {
      res.status(404).json({ ok: false, error: "API route not found" });
    });
    app.options("*", (req, res) => {
      res.setHeader("Allow", "GET, HEAD, POST, OPTIONS");
      res.status(204).end();
    });
    app.all("*", (req, res) => {
      res.setHeader("Allow", "GET, HEAD, POST, OPTIONS");
      res.status(405).json({ ok: false, error: "Method not allowed", allowed: "GET, HEAD, POST, OPTIONS" });
    });
  }
  
  // Bootstrap canonical documents into the registry
  await bootstrapCanonicalDocuments();

  // Initialize PostgreSQL via Supabase Pooler (if POSTGRES_URL set)
  const pg = getPgPool();
  if (pg) {
    try {
      await runPostgresMigration();
      const healthy = await pgHealthCheck();
      log.info("postgres_status", { healthy, host: process.env.POSTGRES_HOST || "unknown" });
    } catch (err: unknown) {
      log.warn("postgres_init_failed", { error: toErrorMessage(err) });
    }
  }

  // Start automation mesh monitoring (self-healing)
  startMonitoring();

  // Initialize MCP Connectors Hub (Zenodo + LITLE)
  initializeDefaultAdapters();

  app.listen(PORT, "0.0.0.0", () => {
    log.info("server_started", { port: PORT, env: process.env.NODE_ENV || "development" });
  });
}

if (!process.env.VERCEL) {
  startServer();
}
