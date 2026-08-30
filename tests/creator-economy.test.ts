/**
 * Creator Economy v1.1.0 — full module test suite.
 * Covers: store roundtrip, ledger balance invariants, SAT tax engine,
 * revenue split (worked example §6.3), skill credits atomicity & refund,
 * marketplace offers, gifts, payout gating, social channels HITL.
 */
import { beforeEach, describe, expect, it } from "vitest";

process.env.ISABELLA_PERSISTENCE = "memory";

import {
  resetCreatorEconomyStore,
  getCreatorEconomyStore,
} from "../src/lib/creator-economy/persistence/creator-economy-store";
import {
  calculateSatDeductions,
  isRfcFormatValid,
  isClabeValid,
  extractVatFromGross,
} from "../src/lib/creator-economy/tax-engine";
import { computeRevenueSplit, splitToLedgerLines, quoteStripeFee } from "../src/lib/creator-economy/revenue";
import { postTransaction, reverseTransaction, auditLedger, UnbalancedTransactionError } from "../src/lib/creator-economy/ledger";
import {
  executeSkill,
  assignPlan,
  getOrCreateEntitlement,
  refillMonthlyCredits,
  topUpCredits,
  InsufficientCreditsError,
  ProhibitedBoosterError,
} from "../src/lib/creator-economy/skills-engine";
import { isProhibitedBoosterRequest, SKILLS } from "../src/lib/creator-economy/plans";
import {
  requestPayout,
  markPayoutPaid,
  getAvailableBalanceMinor,
  maturePendingBalances,
  PayoutGateError,
} from "../src/lib/creator-economy/payouts";
import {
  purchaseGift,
  purchaseOffer,
  createOffer,
  activateOffer,
  submitKyc,
  evaluateGiftVelocity,
} from "../src/lib/creator-economy/economy-service";
import {
  generatePkcePair,
  encryptToken,
  decryptToken,
  connectChannel,
  schedulePublication,
  ApprovalRequiredError,
} from "../src/lib/creator-economy/social-connectors";
import type { ContentAsset } from "../src/lib/creator-economy/types";

const CREATOR = "creator-001";
const TENANT = "tenant-rdm";

const seedKycFull = () =>
  submitKyc({
    creatorId: CREATOR,
    rfc: "CATA850101ABC",
    clabe: "032180000118359719",
    taxResidencyCountry: "MX",
    eFirmaValid: true,
    proofOfAddressVerified: true,
    clabeHolderNameMatch: true,
  });

const seedPremium = () => assignPlan(CREATOR, TENANT, "premium");

beforeEach(() => {
  resetCreatorEconomyStore();
});

// ---------------- Store ----------------

describe("creator-economy store", () => {
  it("round-trips entitlements and KYC", () => {
    const ent = getOrCreateEntitlement(CREATOR, TENANT);
    expect(ent.plan).toBe("free");
    expect(ent.remainingCredits).toBe(50);

    const kyc = seedKycFull();
    expect(kyc.level).toBe("level_2_full");
    expect(getCreatorEconomyStore().getKyc(CREATOR)?.bankAccountVerified).toBe(true);
  });

  it("in-memory mode reports mode", () => {
    expect(getCreatorEconomyStore().mode).toBe("in-memory");
  });
});

// ---------------- Tax engine ----------------

describe("SAT tax engine 2026", () => {
  it("extracts IVA from gross correctly (16%)", () => {
    expect(extractVatFromGross(10_000)).toBe(1_379); // $100.00 → $13.79
  });

  it("applies 2.1% ISR + 50% IVA withholding with valid RFC", () => {
    const c = calculateSatDeductions({
      grossAmountMinor: 10_000,
      currency: "MXN",
      rfc: "CATA850101ABC",
      rfcValidated: true,
      eFirmaValid: true,
      taxResidencyCountry: "MX",
    });
    expect(c.vatAmountMinor).toBe(1_379);
    expect(c.taxableBaseMinor).toBe(8_621);
    expect(c.appliedIsrRatePercent).toBe(2.1);
    expect(c.isrWithheldMinor).toBe(181); // 8621 * 0.021 = 181.04 → 181
    expect(c.vatWithheldMinor).toBe(690); // 1379 * 0.5 = 689.5 → 690 (half-up)
    expect(c.netPayableToCreatorMinor).toBe(10_000 - 181 - 690);
  });

  it("applies 20% ISR + 100% IVA withholding without RFC", () => {
    const c = calculateSatDeductions({
      grossAmountMinor: 10_000,
      currency: "MXN",
      rfc: null,
      rfcValidated: false,
      eFirmaValid: false,
      taxResidencyCountry: "MX",
    });
    expect(c.appliedIsrRatePercent).toBe(20.0);
    expect(c.isrWithheldMinor).toBe(1_724); // 8621 * 0.20
    expect(c.vatWithheldMinor).toBe(1_379); // full IVA
  });

  it("validates RFC format", () => {
    expect(isRfcFormatValid("CATA850101ABC")).toBe(true);
    expect(isRfcFormatValid("bad")).toBe(false);
  });

  it("validates CLABE check digit", () => {
    expect(isClabeValid("032180000118359719")).toBe(true);
    expect(isClabeValid("032180000118359710")).toBe(false);
    expect(isClabeValid("123")).toBe(false);
  });
});

// ---------------- Revenue split ----------------

describe("revenue split — worked example §6.3", () => {
  it("reproduces the $100 MXN gift Premium case exactly", () => {
    const split = computeRevenueSplit({
      grossAmountMinor: 10_000,
      currency: "MXN",
      plan: "premium",
    });
    expect(split.vatAmountMinor).toBe(1_379);
    expect(split.taxableBaseMinor).toBe(8_621);
    expect(split.processorFeeMinor).toBe(766); // 660 + 106 IVA
    expect(split.chargebackReserveMinor).toBe(431);
    expect(split.netDistributableMinor).toBe(8_621 - 766 - 431);
    expect(split.creatorShareMinor).toBe(6_310); // 85%
    expect(split.platformShareMinor).toBe(split.netDistributableMinor - 6_310); // 15%
  });

  it("ledger lines from a split balance exactly (final-price invariant: gross includes IVA)", () => {
    // $116.00 MXN gross → base 10000, IVA 1600 (coherent with §10.2)
    for (const plan of ["free", "premium", "pro", "business"] as const) {
      const split = computeRevenueSplit({ grossAmountMinor: 11_600, currency: "MXN", plan });
      const lines = splitToLedgerLines(split);
      const diff = lines.reduce(
        (acc, l) => acc + (l.direction === "debit" ? l.amountMinor : -l.amountMinor),
        0,
      );
      expect(diff).toBe(0);
    }
  });

  it("stripe fee quote includes IVA on the commission", () => {
    const q = quoteStripeFee(10_000);
    expect(q.feeMinor).toBe(766);
  });

  it("app-store channel adds 30% third-party fee", () => {
    const web = computeRevenueSplit({ grossAmountMinor: 10_000, currency: "MXN", plan: "premium" });
    const app = computeRevenueSplit({ grossAmountMinor: 10_000, currency: "MXN", plan: "premium", thirdPartyFeeMinor: 3_000 });
    expect(app.netDistributableMinor).toBe(web.netDistributableMinor - 3_000);
  });
});

// ---------------- Ledger ----------------

describe("double-entry ledger", () => {
  it("posts a balanced transaction and verifies zero diff", () => {
    const posted = postTransaction({
      tenantId: TENANT,
      kind: "gift",
      idempotencyKey: "tx-1",
      currency: "MXN",
      lines: [
        { account: "customer_cash_clearing", direction: "debit", amountMinor: 1_000 },
        { account: "creator_payable_pending", direction: "credit", amountMinor: 850 },
        { account: "platform_revenue_gross", direction: "credit", amountMinor: 150 },
      ],
    });
    expect(posted.alreadyExisted).toBe(false);
    expect(getCreatorEconomyStore().verifyLedgerBalance(posted.transaction.id)).toBe(0);
  });

  it("rejects an unbalanced transaction before writing", () => {
    expect(() =>
      postTransaction({
        tenantId: TENANT,
        kind: "gift",
        idempotencyKey: "tx-bad",
        currency: "MXN",
        lines: [
          { account: "customer_cash_clearing", direction: "debit", amountMinor: 1_000 },
          { account: "platform_revenue_gross", direction: "credit", amountMinor: 900 },
        ],
      }),
    ).toThrow(UnbalancedTransactionError);
    expect(auditLedger().balanced).toBe(true);
  });

  it("is idempotent by key — replay does not duplicate entries", () => {
    const input = {
      tenantId: TENANT,
      kind: "gift" as const,
      idempotencyKey: "tx-idem",
      currency: "MXN" as const,
      lines: [
        { account: "customer_cash_clearing" as const, direction: "debit" as const, amountMinor: 500 },
        { account: "creator_payable_pending" as const, direction: "credit" as const, amountMinor: 500 },
      ],
    };
    const first = postTransaction(input);
    const second = postTransaction(input);
    expect(first.alreadyExisted).toBe(false);
    expect(second.alreadyExisted).toBe(true);
    expect(getCreatorEconomyStore().getEntriesByTransaction(first.transaction.id)).toHaveLength(2);
  });

  it("reversal compensates every entry and keeps the ledger balanced", () => {
    const original = postTransaction({
      tenantId: TENANT,
      kind: "gift",
      idempotencyKey: "tx-rev-src",
      currency: "MXN",
      lines: [
        { account: "customer_cash_clearing", direction: "debit", amountMinor: 700 },
        { account: "creator_payable_pending", direction: "credit", amountMinor: 700 },
      ],
    });
    const reversal = reverseTransaction({
      originalTransactionId: original.transaction.id,
      tenantId: TENANT,
      idempotencyKey: "tx-rev-1",
      currency: "MXN",
      reason: "chargeback",
    });
    expect(getCreatorEconomyStore().verifyLedgerBalance(reversal.transaction.id)).toBe(0);
    expect(getCreatorEconomyStore().getAccountBalance(TENANT, "customer_cash_clearing")).toBe(0);
    expect(auditLedger().balanced).toBe(true);
  });
});

// ---------------- Skills & credits ----------------

describe("skills engine — atomic credits", () => {
  it("deducts credits atomically and records the execution", async () => {
    const result = await executeSkill({
      skillId: "skill-hook-generator-v2",
      creatorId: CREATOR,
      tenantId: TENANT,
      inputText: "Historia minera de Real del Monte",
      infer: async () => ["hook-1", "hook-2"],
    });
    expect(result.execution.creditsDeducted).toBe(3);
    expect(result.execution.remainingCredits).toBe(47);
    expect(result.execution.status).toBe("completed");
    expect(result.output).toHaveLength(2);
  });

  it("rejects when credits are insufficient — no execution recorded", async () => {
    const ent = getOrCreateEntitlement(CREATOR, TENANT);
    getCreatorEconomyStore().upsertEntitlement({ ...ent, remainingCredits: 2 });
    await expect(
      executeSkill({
        skillId: "skill-hook-generator-v2",
        creatorId: CREATOR,
        tenantId: TENANT,
        inputText: "tema",
        infer: async () => ["x"],
      }),
    ).rejects.toThrow(InsufficientCreditsError);
    expect(getCreatorEconomyStore().listSkillExecutions(CREATOR)).toHaveLength(0);
  });

  it("refunds credits on inference failure (compensating transaction)", async () => {
    await expect(
      executeSkill({
        skillId: "skill-hook-generator-v2",
        creatorId: CREATOR,
        tenantId: TENANT,
        inputText: "tema",
        infer: async () => {
          throw new Error("llm_timeout");
        },
      }),
    ).rejects.toThrow("llm_timeout");
    const ent = getCreatorEconomyStore().getEntitlement(CREATOR);
    expect(ent?.remainingCredits).toBe(50); // fully refunded
    const execs = getCreatorEconomyStore().listSkillExecutions(CREATOR);
    expect(execs[0].status).toBe("refunded");
  });

  it("enforces plan gating — free cannot run premium skills", async () => {
    await expect(
      executeSkill({
        skillId: "skill-rdm-tourism-pack-v1",
        creatorId: CREATOR,
        tenantId: TENANT,
        inputText: "tour",
        infer: async () => ["x"],
      }),
    ).rejects.toThrow(/PLAN_UPGRADE_REQUIRED/);
  });

  it("rejects prohibited engagement-inflation boosters", async () => {
    expect(isProhibitedBoosterRequest("quiero comprar 10000 vistas para mi video")).toBe(true);
    expect(isProhibitedBoosterRequest("mejora mi gancho de apertura")).toBe(false);
    await expect(
      executeSkill({
        skillId: "skill-hook-generator-v2",
        creatorId: CREATOR,
        tenantId: TENANT,
        inputText: "comprar followers y bots para comentarios",
        infer: async () => ["x"],
      }),
    ).rejects.toThrow(ProhibitedBoosterError);
  });

  it("monthly refill restores plan credits; top-up adds purchased credits", () => {
    seedPremium();
    const topped = topUpCredits(CREATOR, TENANT, 200);
    expect(topped.remainingCredits).toBe(1_200);
    getCreatorEconomyStore().upsertEntitlement({ ...topped, remainingCredits: 10 });
    const refilled = refillMonthlyCredits(CREATOR);
    expect(refilled?.remainingCredits).toBe(1_000);
  });

  it("skill catalog has frozen model digests", () => {
    for (const s of SKILLS) {
      expect(s.modelDigest).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

// ---------------- Marketplace & gifts ----------------

describe("marketplace & gifts", () => {
  it("free plan cannot create offers; premium can up to 3 active", () => {
    expect(() =>
      createOffer({ creatorId: CREATOR, tenantId: TENANT, type: "service", title: "X", description: "", priceAmountMinor: 100, currency: "MXN" }),
    ).toThrow(/PLAN_CANNOT_CREATE_OFFERS/);

    seedPremium();
    const offer = createOffer({ creatorId: CREATOR, tenantId: TENANT, type: "digital_product", title: "Guía RDM", description: "PDF", priceAmountMinor: 15_000, currency: "MXN" });
    expect(offer.status).toBe("draft");
    const active = activateOffer(offer.id, CREATOR);
    expect(active.status).toBe("active");
  });

  it("sponsorship offers require disclosure (FTC/PROFECO)", () => {
    seedPremium();
    const offer = createOffer({ creatorId: CREATOR, tenantId: TENANT, type: "sponsorship", title: "Patrocinio", description: "", priceAmountMinor: 100_000, currency: "MXN", sponsorshipDisclosed: false });
    expect(() => activateOffer(offer.id, CREATOR)).toThrow(/SPONSORSHIP_DISCLOSURE_REQUIRED/);
  });

  it("gift purchase posts balanced ledger and returns split", () => {
    seedPremium();
    const result = purchaseGift({
      giftId: "gift-paste-dorado",
      creatorId: CREATOR,
      tenantId: TENANT,
      buyerId: "fan-1",
      idempotencyKey: "gift-purchase-1",
    });
    expect(result.split.grossAmountMinor).toBe(5_000);
    expect(getCreatorEconomyStore().verifyLedgerBalance(result.transactionId)).toBe(0);
    expect(result.buyerMessage).toContain("IVA incluido");
  });

  it("offer sale increments evidence.sales and posts ledger", () => {
    seedPremium();
    const draft = createOffer({ creatorId: CREATOR, tenantId: TENANT, type: "experience_rdm", title: "Tour mina", description: "", priceAmountMinor: 45_000, currency: "MXN" });
    const offer = activateOffer(draft.id, CREATOR);
    const result = purchaseOffer({ offerId: offer.id, buyerId: "tourist-1", idempotencyKey: "sale-1" });
    expect(getCreatorEconomyStore().verifyLedgerBalance(result.transactionId)).toBe(0);
    expect(getCreatorEconomyStore().getOffer(offer.id)?.evidence.sales).toBe(1);
  });

  it("velocity spike triggers RISK_HOLD_EVENT", () => {
    const hold = evaluateGiftVelocity(500_000, 80_000);
    expect(hold?.kind).toBe("RISK_HOLD_EVENT");
    expect(evaluateGiftVelocity(100_000, 80_000)).toBeNull();
  });
});

// ---------------- Payouts ----------------

describe("payout engine", () => {
  const fundAvailable = (amountMinor: number) => {
    postTransaction({
      tenantId: TENANT,
      kind: "gift",
      idempotencyKey: `fund-${amountMinor}-${Math.random()}`,
      currency: "MXN",
      lines: [
        { account: "customer_cash_clearing", direction: "debit", amountMinor },
        { account: "creator_payable_available", direction: "credit", amountMinor },
      ],
    });
  };

  it("gates payout without KYS level 2", () => {
    seedPremium();
    fundAvailable(200_000);
    expect(() =>
      requestPayout({ creatorId: CREATOR, tenantId: TENANT, amountMinor: 150_000, currency: "MXN", idempotencyKey: "p1", bankAccountMasked: "CLABE••••" }),
    ).toThrow(PayoutGateError);
  });

  it("enforces the $1,000 MXN threshold", () => {
    seedPremium();
    seedKycFull();
    fundAvailable(200_000);
    expect(() =>
      requestPayout({ creatorId: CREATOR, tenantId: TENANT, amountMinor: 50_000, currency: "MXN", idempotencyKey: "p2", bankAccountMasked: "CLABE••••" }),
    ).toThrow(/Umbral mínimo/);
  });

  it("successful payout moves available → clearing and is idempotent", () => {
    seedPremium();
    seedKycFull();
    fundAvailable(200_000);
    const { payout, alreadyExisted } = requestPayout({
      creatorId: CREATOR, tenantId: TENANT, amountMinor: 150_000, currency: "MXN", idempotencyKey: "p3", bankAccountMasked: "CLABE••••9719",
    });
    expect(alreadyExisted).toBe(false);
    expect(payout.netPayoutMinor).toBe(150_000);
    expect(getAvailableBalanceMinor(TENANT)).toBe(50_000);

    const replay = requestPayout({
      creatorId: CREATOR, tenantId: TENANT, amountMinor: 150_000, currency: "MXN", idempotencyKey: "p3", bankAccountMasked: "CLABE••••9719",
    });
    expect(replay.alreadyExisted).toBe(true);
    expect(replay.payout.id).toBe(payout.id);
    expect(getAvailableBalanceMinor(TENANT)).toBe(50_000); // no double-spend

    markPayoutPaid(payout.id, "SPEI-REF-001");
    expect(getCreatorEconomyStore().listPayouts(CREATOR)[0].status).toBe("paid");
    expect(auditLedger().balanced).toBe(true);
  });

  it("maturation moves pending → available with balanced entry", () => {
    postTransaction({
      tenantId: TENANT,
      kind: "gift",
      idempotencyKey: "pend-1",
      currency: "MXN",
      lines: [
        { account: "customer_cash_clearing", direction: "debit", amountMinor: 90_000 },
        { account: "creator_payable_pending", direction: "credit", amountMinor: 90_000 },
      ],
    });
    maturePendingBalances({ tenantId: TENANT, currency: "MXN", amountMinor: 90_000, idempotencyKey: "mature-1" });
    expect(getAvailableBalanceMinor(TENANT)).toBe(90_000);
  });
});

// ---------------- Social connectors & HITL ----------------

describe("social connectors & human-in-the-loop", () => {
  it("PKCE pair is RFC 7636-shaped", () => {
    const { verifier, challenge } = generatePkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("token vault round-trips with AES-256-GCM", () => {
    const { ciphertext, iv, tag } = encryptToken("refresh-token-secret");
    expect(ciphertext).not.toContain("refresh-token-secret");
    expect(decryptToken(ciphertext, iv, tag)).toBe("refresh-token-secret");
  });

  it("rejects out-of-policy scopes", () => {
    seedPremium();
    expect(() =>
      connectChannel({ creatorId: CREATOR, provider: "youtube", externalAccountId: "yt-1", displayName: "YT", refreshToken: "tok", scopes: ["delete.videos"], expiresAt: null }),
    ).toThrow(/SCOPE_NOT_ALLOWED|DANGEROUS_SCOPE/);
  });

  const seedApprovedAsset = (): ContentAsset => {
    const asset: ContentAsset = {
      id: "asset-1",
      creatorId: CREATOR,
      format: "post",
      contentUri: "s3://bucket/post-1",
      status: "approved",
      provenance: { generatedBy: "hybrid", transformations: ["qa"], createdAt: new Date().toISOString() },
      hashSHA256: "ab".repeat(32),
      approvedByCreatorAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getCreatorEconomyStore().insertAsset(asset);
    return asset;
  };

  it("publication without approval is impossible (silent execution ban)", () => {
    seedPremium();
    seedApprovedAsset();
    const channel = connectChannel({ creatorId: CREATOR, provider: "x", externalAccountId: "x-1", displayName: "X", refreshToken: "tok", scopes: ["tweet.read", "tweet.write"], expiresAt: null });
    expect(() =>
      schedulePublication({ creatorId: CREATOR, channelId: channel.id, assetId: "asset-1", scheduledAt: new Date().toISOString(), approvedByCreatorAt: null }),
    ).toThrow(ApprovalRequiredError);
  });

  it("approved publication schedules successfully", () => {
    seedPremium();
    seedApprovedAsset();
    const channel = connectChannel({ creatorId: CREATOR, provider: "x", externalAccountId: "x-1", displayName: "X", refreshToken: "tok", scopes: ["tweet.read", "tweet.write"], expiresAt: null });
    const pub = schedulePublication({
      creatorId: CREATOR,
      channelId: channel.id,
      assetId: "asset-1",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
      approvedByCreatorAt: new Date().toISOString(),
    });
    expect(pub.status).toBe("scheduled");
    expect(pub.approvedByCreatorAt).toBeTruthy();
  });

  it("channel limit respects plan entitlement", () => {
    assignPlan(CREATOR, TENANT, "free"); // max 1 channel
    connectChannel({ creatorId: CREATOR, provider: "x", externalAccountId: "x-1", displayName: "X", refreshToken: "t", scopes: ["tweet.read"], expiresAt: null });
    expect(() =>
      connectChannel({ creatorId: CREATOR, provider: "x", externalAccountId: "x-2", displayName: "X2", refreshToken: "t", scopes: ["tweet.read"], expiresAt: null }),
    ).toThrow(/CHANNEL_LIMIT_REACHED/);
  });
});
