/**
 * Creator Economy service — orchestrates gifts, offers, revenue split and
 * ledger posting (spec §6, §7, §10.3). Every financial flow is idempotent,
 * balanced, and gated by entitlements/KYS.
 */

import { createHash, randomUUID } from "node:crypto";
import { getCreatorEconomyStore } from "./persistence/creator-economy-store";
import { computeRevenueSplit, splitToLedgerLines } from "./revenue";
import { calculateSatDeductions, isRfcFormatValid, isClabeValid } from "./tax-engine";
import { postTransaction } from "./ledger";
import { PLANS } from "./plans";
import type {
  Currency,
  GiftDefinition,
  KycVerificationStatus,
  MonetizationOffer,
  RevenueSplit,
} from "./types";
import type { AccountType, LedgerDirection } from "./types";

// ---------- Gift catalog (seeded, §6.2) ----------

export const GIFT_CATALOG: readonly GiftDefinition[] = Object.freeze([
  Object.freeze({ id: "gift-paste-dorado", name: "Paste Dorado", iconUrl: "/gifts/paste.svg", priceMinor: 5_000, currency: "MXN", creatorSharePercent: 85, dailyPurchaseLimit: 50, enabled: true }),
  Object.freeze({ id: "gift-reloj-monumental", name: "Reloj Monumental", iconUrl: "/gifts/reloj.svg", priceMinor: 10_000, currency: "MXN", creatorSharePercent: 85, dailyPurchaseLimit: 25, enabled: true }),
  Object.freeze({ id: "gift-mina-de-plata", name: "Mina de Plata", iconUrl: "/gifts/mina.svg", priceMinor: 50_000, currency: "MXN", creatorSharePercent: 85, dailyPurchaseLimit: 5, enabled: true }),
]);

export function getGift(id: string): GiftDefinition | null {
  return GIFT_CATALOG.find((g) => g.id === id && g.enabled) ?? null;
}

// ---------- Anti-fraud velocity (§10.3 RISK_HOLD) ----------

const VELOCITY_SPIKE_FACTOR = 5; // 500% spike triggers review

export interface RiskHoldEvent {
  kind: "RISK_HOLD_EVENT";
  creatorId: string;
  reason: string;
  dailyGiftMinor: number;
  baselineMinor: number;
  detectedAt: string;
}

export function evaluateGiftVelocity(dailyGiftMinor: number, baselineMinor: number): RiskHoldEvent | null {
  if (baselineMinor > 0 && dailyGiftMinor > baselineMinor * VELOCITY_SPIKE_FACTOR) {
    return {
      kind: "RISK_HOLD_EVENT",
      creatorId: "",
      reason: "VELOCITY_SPIKE_5X",
      dailyGiftMinor,
      baselineMinor,
      detectedAt: new Date().toISOString(),
    };
  }
  return null;
}

// ---------- Gifts ----------

export interface GiftPurchaseResult {
  transactionId: string;
  split: RevenueSplit;
  buyerMessage: string;
}

export function purchaseGift(input: {
  giftId: string;
  creatorId: string;
  tenantId: string;
  buyerId: string;
  idempotencyKey: string;
  channel?: "web" | "app_store";
}): GiftPurchaseResult {
  const store = getCreatorEconomyStore();
  const gift = getGift(input.giftId);
  if (!gift) throw new Error(`GIFT_NOT_FOUND:${input.giftId}`);

  const ent = store.getEntitlement(input.creatorId);
  if (!ent || !ent.canReceiveGifts) throw new Error("CREATOR_CANNOT_RECEIVE_GIFTS");

  const appStoreFee = input.channel === "app_store"
    ? Math.floor((gift.priceMinor * 30) / 100)
    : 0;

  const split = computeRevenueSplit({
    grossAmountMinor: gift.priceMinor,
    currency: gift.currency,
    plan: ent.plan,
    thirdPartyFeeMinor: appStoreFee,
  });

  const posted = postTransaction({
    tenantId: input.tenantId,
    kind: "gift",
    idempotencyKey: input.idempotencyKey,
    currency: gift.currency,
    lines: splitToLedgerLines(split).map((l) => ({
      account: l.account as AccountType,
      direction: l.direction as LedgerDirection,
      amountMinor: l.amountMinor,
      memo: `gift:${gift.id}→${input.creatorId}`,
    })),
  });

  return {
    transactionId: posted.transaction.id,
    split,
    buyerMessage: `Gracias por apoyar con ${gift.name}. Total: $${(gift.priceMinor / 100).toFixed(2)} ${gift.currency} (IVA incluido).`,
  };
}

// ---------- Marketplace offers ----------

export function createOffer(input: {
  creatorId: string;
  tenantId: string;
  type: MonetizationOffer["type"];
  title: string;
  description: string;
  priceAmountMinor: number;
  currency: Currency;
  sponsorshipDisclosed?: boolean;
}): MonetizationOffer {
  const store = getCreatorEconomyStore();
  const ent = store.getEntitlement(input.creatorId);
  if (!ent || !ent.canCreateOffers) throw new Error("PLAN_CANNOT_CREATE_OFFERS");

  const active = store.listOffers(input.creatorId, "active").length;
  if (ent.maxActiveOffers !== -1 && active >= ent.maxActiveOffers) {
    throw new Error(`OFFER_LIMIT_REACHED:${ent.maxActiveOffers}`);
  }
  if (!Number.isInteger(input.priceAmountMinor) || input.priceAmountMinor < 0) {
    throw new Error("INVALID_PRICE");
  }
  if (!input.title.trim()) throw new Error("TITLE_REQUIRED");

  const offer: MonetizationOffer = {
    id: randomUUID(),
    creatorId: input.creatorId,
    tenantId: input.tenantId,
    type: input.type,
    title: input.title.trim(),
    description: input.description,
    price: { amountMinor: input.priceAmountMinor, currency: input.currency },
    status: "draft",
    evidence: { interviews: 0, leads: 0, preorders: 0, sales: 0 },
    sponsorshipDisclosed: input.sponsorshipDisclosed ?? false,
    createdAt: new Date().toISOString(),
  };
  store.upsertOffer(offer);
  return offer;
}

export function activateOffer(offerId: string, creatorId: string): MonetizationOffer {
  const store = getCreatorEconomyStore();
  const offer = store.getOffer(offerId);
  if (!offer || offer.creatorId !== creatorId) throw new Error("OFFER_NOT_FOUND");
  if (offer.type === "sponsorship" && !offer.sponsorshipDisclosed) {
    throw new Error("SPONSORSHIP_DISCLOSURE_REQUIRED"); // FTC / PROFECO §10.2
  }
  const next: MonetizationOffer = { ...offer, status: "active" };
  store.upsertOffer(next);
  return next;
}

/** Record an offer sale with full split + ledger. */
export function purchaseOffer(input: {
  offerId: string;
  buyerId: string;
  idempotencyKey: string;
  channel?: "web" | "app_store";
}): GiftPurchaseResult {
  const store = getCreatorEconomyStore();
  const offer = store.getOffer(input.offerId);
  if (!offer || offer.status !== "active") throw new Error("OFFER_NOT_ACTIVE");

  const ent = store.getEntitlement(offer.creatorId);
  const plan = ent?.plan ?? "free";
  void PLANS[plan];

  const appStoreFee = input.channel === "app_store"
    ? Math.floor((offer.price.amountMinor * 30) / 100)
    : 0;

  const split = computeRevenueSplit({
    grossAmountMinor: offer.price.amountMinor,
    currency: offer.price.currency,
    plan,
    thirdPartyFeeMinor: appStoreFee,
  });

  const posted = postTransaction({
    tenantId: offer.tenantId,
    kind: "offer_sale",
    idempotencyKey: input.idempotencyKey,
    currency: offer.price.currency,
    lines: splitToLedgerLines(split).map((l) => ({
      account: l.account as AccountType,
      direction: l.direction as LedgerDirection,
      amountMinor: l.amountMinor,
      memo: `offer:${offer.id}→${offer.creatorId}`,
    })),
  });

  const next: MonetizationOffer = {
    ...offer,
    evidence: { ...offer.evidence, sales: offer.evidence.sales + 1 },
  };
  store.upsertOffer(next);

  return {
    transactionId: posted.transaction.id,
    split,
    buyerMessage: `Compra confirmada: ${offer.title}. Total $${(offer.price.amountMinor / 100).toFixed(2)} ${offer.price.currency} (desglose fiscal disponible en tu recibo).`,
  };
}

// ---------- KYC/KYS onboarding ----------

export function submitKyc(input: {
  creatorId: string;
  rfc: string | null;
  clabe: string | null;
  taxResidencyCountry: string;
  eFirmaValid?: boolean;
  proofOfAddressVerified?: boolean;
  clabeHolderNameMatch?: boolean;
}): KycVerificationStatus {
  const store = getCreatorEconomyStore();

  const rfcOk = input.rfc ? isRfcFormatValid(input.rfc) : false;
  const clabeOk = input.clabe ? isClabeValid(input.clabe) : false;

  const kyc: KycVerificationStatus = {
    creatorId: input.creatorId,
    level: rfcOk && clabeOk && (input.eFirmaValid ?? false) ? "level_2_full" : rfcOk ? "level_1_basic" : "none",
    rfcSubmitted: Boolean(input.rfc),
    rfcValidated: rfcOk,
    eFirmaValid: input.eFirmaValid ?? false,
    bankAccountVerified: clabeOk,
    clabeHolderNameMatch: input.clabeHolderNameMatch ?? false,
    proofOfAddressVerified: input.proofOfAddressVerified ?? false,
    taxResidencyCountry: input.taxResidencyCountry,
    updatedAt: new Date().toISOString(),
  };
  store.upsertKyc(kyc);
  return kyc;
}

/** Fiscal summary for the creator dashboard — full SAT deduction breakdown. */
export function creatorFiscalSummary(creatorId: string, grossMinor: number) {
  const kyc = getCreatorEconomyStore().getKyc(creatorId);
  return calculateSatDeductions({
    grossAmountMinor: grossMinor,
    currency: "MXN",
    rfc: kyc?.rfcValidated ? "RFC_ON_FILE" : null,
    rfcValidated: kyc?.rfcValidated ?? false,
    eFirmaValid: kyc?.eFirmaValid ?? false,
    taxResidencyCountry: kyc?.taxResidencyCountry ?? "MX",
  });
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
