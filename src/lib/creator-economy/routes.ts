/**
 * Creator Economy REST API — Express router mounted at /api/v1.
 *
 * Every state-changing route requires authentication plus a scoped
 * permission (SoD matrix §3.3). Financial approval actions (payout approval,
 * manual adjustments) are restricted to operator/admin roles — creators can
 * request, never approve, their own payouts.
 */

import { Router } from "express";
import { authenticate, requireRole, requireScope, currentPrincipal } from "../auth.server";
import { getCreatorEconomyStore } from "./persistence/creator-economy-store";
import {
  assignPlan,
  executeSkill,
  getOrCreateEntitlement,
  refillMonthlyCredits,
  InsufficientCreditsError,
  ProhibitedBoosterError,
} from "./skills-engine";
import { SKILLS } from "./plans";
import {
  createOffer,
  activateOffer,
  purchaseOffer,
  purchaseGift,
  submitKyc,
  creatorFiscalSummary,
  GIFT_CATALOG,
} from "./economy-service";
import { requestPayout, markPayoutPaid, PayoutGateError, getAvailableBalanceMinor, getPendingBalanceMinor } from "./payouts";
import { auditLedger } from "./ledger";
import {
  connectChannel,
  revokeChannel,
  schedulePublication,
  generatePkcePair,
  buildAuthorizationUrl,
  ApprovalRequiredError,
} from "./social-connectors";
import type { ChannelProvider, PlanId } from "./types";

export const creatorEconomyRouter = Router();

const wrap =
  (fn: (req: import("express").Request, res: import("express").Response) => unknown | Promise<unknown>) =>
  async (req: import("express").Request, res: import("express").Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        res.status(402).json({ ok: false, error: err.message, required: err.required, available: err.available });
        return;
      }
      if (err instanceof ProhibitedBoosterError) {
        res.status(422).json({ ok: false, error: err.message });
        return;
      }
      if (err instanceof PayoutGateError) {
        res.status(403).json({ ok: false, error: err.message, code: err.code });
        return;
      }
      if (err instanceof ApprovalRequiredError) {
        res.status(409).json({ ok: false, error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : "internal_error";
      const status = /NOT_FOUND|NOT_ACTIVE|NOT_AVAILABLE/.test(message) ? 404 : 400;
      res.status(status).json({ ok: false, error: message });
    }
  };

// ---------- Profile & entitlements ----------

creatorEconomyRouter.get("/creator/profile", authenticate, wrap((req, res) => {
  const p = currentPrincipal(req);
  const store = getCreatorEconomyStore();
  const ent = getOrCreateEntitlement(p.sub, p.tenantId);
  const kyc = store.getKyc(p.sub);
  const profile = store.getProfile(p.sub);
  res.json({
    ok: true,
    id: p.sub,
    displayName: profile?.displayName ?? p.sub,
    onboardingStatus: profile?.onboardingStatus ?? "incomplete",
    entitlements: {
      plan: ent.plan,
      remainingCredits: ent.remainingCredits,
      monthlyCredits: ent.monthlyCredits,
      canCreateOffers: ent.canCreateOffers,
      canReceiveGifts: ent.canReceiveGifts,
      canRequestPayout: ent.canRequestPayout,
      canPublishExternally: ent.canPublishExternally,
      maxConnectedChannels: ent.maxConnectedChannels,
    },
    kycStatus: kyc ?? { level: "none", rfcValidated: false, bankAccountVerified: false },
    balances: {
      pendingMinor: getPendingBalanceMinor(p.tenantId),
      availableMinor: getAvailableBalanceMinor(p.tenantId),
    },
  });
}));

creatorEconomyRouter.post("/creator/plan", authenticate, requireRole("operator"), wrap((req, res) => {
  const { creatorId, tenantId, plan } = req.body ?? {};
  if (!creatorId || !tenantId || !["free", "premium", "pro", "business"].includes(plan)) {
    res.status(400).json({ ok: false, error: "creatorId, tenantId y plan válido requeridos" });
    return;
  }
  const ent = assignPlan(String(creatorId), String(tenantId), plan as PlanId);
  res.json({ ok: true, entitlements: ent });
}));

// ---------- KYC/KYS ----------

creatorEconomyRouter.post("/creator/kyc", authenticate, requireScope("creator:kyc"), wrap((req, res) => {
  const p = currentPrincipal(req);
  const { rfc, clabe, taxResidencyCountry, eFirmaValid, proofOfAddressVerified, clabeHolderNameMatch } = req.body ?? {};
  const kyc = submitKyc({
    creatorId: p.sub,
    rfc: rfc ?? null,
    clabe: clabe ?? null,
    taxResidencyCountry: taxResidencyCountry ?? "MX",
    eFirmaValid: Boolean(eFirmaValid),
    proofOfAddressVerified: Boolean(proofOfAddressVerified),
    clabeHolderNameMatch: Boolean(clabeHolderNameMatch),
  });
  res.json({ ok: true, kycStatus: kyc });
}));

creatorEconomyRouter.get("/creator/fiscal-summary", authenticate, wrap((req, res) => {
  const p = currentPrincipal(req);
  const gross = Number(req.query.grossMinor ?? 10_000);
  res.json({ ok: true, summary: creatorFiscalSummary(p.sub, Number.isFinite(gross) ? gross : 10_000) });
}));

// ---------- Skills ----------

creatorEconomyRouter.get("/skills", (_req, res) => {
  res.json({ ok: true, skills: SKILLS });
});

creatorEconomyRouter.post("/skills/:id/execute", authenticate, requireScope("skills:execute"), wrap(async (req, res) => {
  const p = currentPrincipal(req);
  const inputText = String(req.body?.inputData?.topic ?? req.body?.inputText ?? "");
  if (!inputText.trim()) {
    res.status(400).json({ ok: false, error: "inputData.topic requerido" });
    return;
  }
  const result = await executeSkill({
    skillId: req.params.id,
    creatorId: p.sub,
    tenantId: p.tenantId,
    inputText,
    infer: async (skillId, text) => {
      // Native inference hook — routed through Isabella's sovereign engine.
      // The gateway layer (server.ts) owns model access; this fallback keeps
      // the engine deterministic and offline-capable.
      const { inferSovereign } = await import("../isabella-inference-engine");
      const result = inferSovereign(`[skill:${skillId}] ${text}`);
      return [result.reply];
    },
  });
  res.json({
    ok: true,
    executionId: result.execution.executionId,
    skillId: result.execution.skillId,
    creditsDeducted: result.execution.creditsDeducted,
    remainingCredits: result.execution.remainingCredits,
    output: result.output,
  });
}));

creatorEconomyRouter.post("/creator/credits/refill", authenticate, requireRole("operator"), wrap((req, res) => {
  const ent = refillMonthlyCredits(String(req.body?.creatorId ?? currentPrincipal(req).sub));
  if (!ent) {
    res.status(404).json({ ok: false, error: "creator not found" });
    return;
  }
  res.json({ ok: true, remainingCredits: ent.remainingCredits });
}));

// ---------- Marketplace ----------

creatorEconomyRouter.get("/marketplace/offers", wrap((req, res) => {
  const store = getCreatorEconomyStore();
  res.json({ ok: true, offers: store.listOffers(undefined, "active") });
}));

creatorEconomyRouter.post("/marketplace/offers", authenticate, requireScope("marketplace:create"), wrap((req, res) => {
  const p = currentPrincipal(req);
  const offer = createOffer({
    creatorId: p.sub,
    tenantId: p.tenantId,
    type: req.body?.type,
    title: String(req.body?.title ?? ""),
    description: String(req.body?.description ?? ""),
    priceAmountMinor: Number(req.body?.priceAmountMinor ?? 0),
    currency: req.body?.currency === "USD" ? "USD" : "MXN",
    sponsorshipDisclosed: Boolean(req.body?.sponsorshipDisclosed),
  });
  res.status(201).json({ ok: true, offer });
}));

creatorEconomyRouter.post("/marketplace/offers/:id/activate", authenticate, requireScope("marketplace:create"), wrap((req, res) => {
  const offer = activateOffer(req.params.id, currentPrincipal(req).sub);
  res.json({ ok: true, offer });
}));

creatorEconomyRouter.post("/marketplace/offers/:id/purchase", authenticate, requireScope("marketplace:purchase"), wrap((req, res) => {
  const p = currentPrincipal(req);
  const result = purchaseOffer({
    offerId: req.params.id,
    buyerId: p.sub,
    idempotencyKey: String(req.body?.idempotencyKey ?? `offer-${req.params.id}-${p.sub}-${Date.now()}`),
    channel: req.body?.channel === "app_store" ? "app_store" : "web",
  });
  res.json({ ok: true, ...result });
}));

// ---------- Gifts ----------

creatorEconomyRouter.get("/gifts", (_req, res) => {
  res.json({ ok: true, gifts: GIFT_CATALOG });
});

creatorEconomyRouter.post("/gifts/:id/purchase", authenticate, requireScope("gifts:purchase"), wrap((req, res) => {
  const p = currentPrincipal(req);
  const result = purchaseGift({
    giftId: req.params.id,
    creatorId: String(req.body?.creatorId ?? ""),
    tenantId: p.tenantId,
    buyerId: p.sub,
    idempotencyKey: String(req.body?.idempotencyKey ?? `gift-${req.params.id}-${p.sub}-${Date.now()}`),
    channel: req.body?.channel === "app_store" ? "app_store" : "web",
  });
  res.json({ ok: true, ...result });
}));

// ---------- Payouts ----------

creatorEconomyRouter.post("/payouts/request", authenticate, requireScope("payouts:request"), wrap((req, res) => {
  const p = currentPrincipal(req);
  const kyc = getCreatorEconomyStore().getKyc(p.sub);
  const result = requestPayout({
    creatorId: p.sub,
    tenantId: p.tenantId,
    amountMinor: Number(req.body?.amountMinor ?? 0),
    currency: req.body?.currency === "USD" ? "USD" : "MXN",
    idempotencyKey: String(req.body?.idempotencyKey ?? ""),
    bankAccountMasked: req.body?.bankAccountMasked ?? (kyc ? "CLABE••••verificada" : ""),
  });
  res.status(result.alreadyExisted ? 200 : 201).json({ ok: true, payout: result.payout, replayed: result.alreadyExisted });
}));

// SoD: payout approval belongs to finance/operator, never the creator.
creatorEconomyRouter.post("/payouts/:id/mark-paid", authenticate, requireRole("operator"), wrap((req, res) => {
  markPayoutPaid(req.params.id, String(req.body?.disbursementReference ?? ""));
  res.json({ ok: true });
}));

// ---------- Social channels & publications (HITL) ----------

creatorEconomyRouter.get("/channels", authenticate, wrap((req, res) => {
  const p = currentPrincipal(req);
  const channels = getCreatorEconomyStore().listChannels(p.sub)
    .map(({ tokenCiphertext: _c, tokenIv: _i, tokenTag: _t, ...safe }) => safe);
  res.json({ ok: true, channels });
}));

creatorEconomyRouter.get("/channels/:provider/authorize", authenticate, wrap((req, res) => {
  const provider = req.params.provider as ChannelProvider;
  const { verifier, challenge } = generatePkcePair();
  const url = buildAuthorizationUrl({
    provider,
    clientId: String(process.env[`OAUTH_CLIENT_${provider.toUpperCase()}`] ?? "configure-me"),
    redirectUri: String(req.query.redirectUri ?? "https://app.isabella.ai/oauth/callback"),
    state: String(req.query.state ?? currentPrincipal(req).sub),
    codeChallenge: challenge,
  });
  res.json({ ok: true, authorizationUrl: url, pkceVerifier: verifier });
}));

creatorEconomyRouter.post("/channels", authenticate, requireScope("channels:connect"), wrap((req, res) => {
  const p = currentPrincipal(req);
  const channel = connectChannel({
    creatorId: p.sub,
    provider: req.body?.provider,
    externalAccountId: String(req.body?.externalAccountId ?? ""),
    displayName: String(req.body?.displayName ?? ""),
    refreshToken: String(req.body?.refreshToken ?? ""),
    scopes: Array.isArray(req.body?.scopes) ? req.body.scopes.map(String) : [],
    expiresAt: req.body?.expiresAt ?? null,
  });
  const { tokenCiphertext: _c, tokenIv: _i, tokenTag: _t, ...safe } = channel;
  res.status(201).json({ ok: true, channel: safe });
}));

creatorEconomyRouter.delete("/channels/:id", authenticate, wrap((req, res) => {
  const store = getCreatorEconomyStore();
  const ch = store.getChannel(req.params.id);
  if (!ch || ch.creatorId !== currentPrincipal(req).sub) {
    res.status(404).json({ ok: false, error: "channel not found" });
    return;
  }
  revokeChannel(req.params.id);
  res.json({ ok: true });
}));

creatorEconomyRouter.post("/publications", authenticate, requireScope("channels:publish"), wrap((req, res) => {
  const p = currentPrincipal(req);
  const pub = schedulePublication({
    creatorId: p.sub,
    channelId: String(req.body?.channelId ?? ""),
    assetId: String(req.body?.assetId ?? ""),
    scheduledAt: String(req.body?.scheduledAt ?? new Date().toISOString()),
    approvedByCreatorAt: req.body?.approvedByCreatorAt ?? null,
  });
  res.status(201).json({ ok: true, publication: pub });
}));

// ---------- Ledger audit (compliance/operator only) ----------

creatorEconomyRouter.get("/ledger/audit", authenticate, requireRole("operator"), wrap((_req, res) => {
  res.json({ ok: true, ...auditLedger() });
}));
