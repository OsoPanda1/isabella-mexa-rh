import { describe, it, expect, beforeEach } from "vitest";
import { discoverOpportunities, scoreOpportunity } from "../src/domains/economy/opportunities/opportunity-engine";
import {
  createCreatorProfile,
  getCreatorProfile,
  recordTransaction,
  updateCreatorReputation,
} from "../src/domains/economy/creators/creator-profile";
import {
  createListing,
  getListing,
  recordUsage,
  searchListings,
} from "../src/domains/economy/marketplace/marketplace";
import {
  recordEconomicEvent,
  confirmEvent,
  settleEvent,
  getRevenueSummary,
} from "../src/domains/economy/revenue/revenue-ledger";
import {
  credit,
  debit,
  getBalance,
  getLedger,
  requestPayout,
} from "../src/domains/economy/wallet/wallet";
import {
  evaluatePolicy,
  getActiveRules,
  fileDispute,
  resolveDispute,
} from "../src/domains/economy/governance/economic-governance";
import { DEFAULT_REVENUE_SHARE } from "../src/domains/economy/types";

const TENANT = "test-tenant";
const USER = "user-001";

describe("Opportunity Engine", () => {
  it("discovers opportunities across all categories", () => {
    const opps = discoverOpportunities(USER, TENANT, ["photography", "video editing"]);
    expect(opps.length).toBeGreaterThan(0);
    for (const opp of opps) {
      expect(opp.id).toMatch(/^opp_/);
      expect(opp.overallScore).toBeGreaterThan(0);
      expect(opp.overallScore).toBeLessThanOrEqual(1);
    }
  });

  it("sorts by overall score descending", () => {
    const opps = discoverOpportunities(USER, TENANT, ["coding"]);
    for (let i = 1; i < opps.length; i++) {
      expect(opps[i - 1].overallScore).toBeGreaterThanOrEqual(opps[i].overallScore);
    }
  });

  it("filters by category", () => {
    const opps = discoverOpportunities(USER, TENANT, ["design"], ["create"]);
    for (const opp of opps) {
      expect(opp.category).toBe("create");
    }
  });

  it("scores an existing opportunity", () => {
    const opps = discoverOpportunities(USER, TENANT, ["writing"]);
    const scored = scoreOpportunity(opps[0]);
    expect(scored.evidenceScore).toBeGreaterThan(0);
    expect(scored.overallScore).toBeGreaterThan(0);
  });
});

describe("Creator Profile & Reputation", () => {
  it("creates a profile", () => {
    const profile = createCreatorProfile({
      principalId: USER,
      tenantId: TENANT,
      displayName: "Test Creator",
      capabilities: ["photography"],
      skills: ["editing"],
    });
    expect(profile.id).toMatch(/^creator_/);
    expect(profile.displayName).toBe("Test Creator");
  });

  it("returns existing profile on duplicate", () => {
    const p1 = createCreatorProfile({
      principalId: USER,
      tenantId: TENANT,
      displayName: "Test",
      capabilities: [],
      skills: [],
    });
    const p2 = createCreatorProfile({
      principalId: USER,
      tenantId: TENANT,
      displayName: "Test",
      capabilities: [],
      skills: [],
    });
    expect(p1.id).toBe(p2.id);
  });

  it("gets a profile", () => {
    const profile = getCreatorProfile(USER, TENANT);
    expect(profile).not.toBeNull();
    expect(profile!.principalId).toBe(USER);
  });

  it("records a transaction and updates reputation", () => {
    const rep = recordTransaction(USER, TENANT, 100);
    expect(rep).not.toBeNull();
    expect(rep!.totalTransactions).toBe(1);
    expect(rep!.totalRevenue).toBe(100);
  });

  it("updates reputation fields", () => {
    const rep = updateCreatorReputation(USER, TENANT, {
      quality: 0.9,
      reliability: 0.95,
      evidence: 0.85,
      security: 0.92,
      customerRetention: 0.88,
    });
    expect(rep).not.toBeNull();
    expect(rep!.globalScore).toBeGreaterThan(0);
  });
});

describe("Marketplace", () => {
  it("creates a listing", () => {
    const listing = createListing({
      tenantId: TENANT,
      creatorId: USER,
      assetType: "skill",
      name: "Photo Editing Skill",
      description: "Professional photo editing automation",
      price: 9.99,
    });
    expect(listing.id).toMatch(/^listing_/);
    expect(listing.status).toBe("active");
  });

  it("gets a listing", () => {
    const created = createListing({
      tenantId: TENANT,
      creatorId: USER,
      assetType: "agent",
      name: "Test Agent",
      description: "A test agent",
      price: 19.99,
    });
    const fetched = getListing(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Test Agent");
  });

  it("records usage", () => {
    const listing = createListing({
      tenantId: TENANT,
      creatorId: USER,
      assetType: "template",
      name: "Invoice Template",
      description: "Professional invoice",
      price: 4.99,
    });
    recordUsage(listing.id, 4.99);
    const updated = getListing(listing.id);
    expect(updated!.usageCount).toBe(1);
    expect(updated!.revenue).toBe(4.99);
  });

  it("searches listings", () => {
    const results = searchListings({ tenantId: TENANT, assetType: "skill" });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.assetType).toBe("skill");
    }
  });
});

describe("Revenue Ledger", () => {
  it("records an economic event", () => {
    const event = recordEconomicEvent({
      tenantId: TENANT,
      principalId: USER,
      source: "marketplace_sale",
      grossAmount: 49.99,
    });
    expect(event.eventId).toMatch(/^evt_/);
    expect(event.grossAmount).toBe(49.99);
    expect(event.digest).toBeTruthy();
    expect(event.status).toBe("pending");
  });

  it("splits revenue correctly", () => {
    const event = recordEconomicEvent({
      tenantId: TENANT,
      principalId: USER,
      source: "agent_execution",
      grossAmount: 100,
    });
    const total = event.platformShare + event.creatorShare + event.rewardShare + event.ecosystemShare;
    expect(Math.abs(total - 100)).toBeLessThan(0.02);
  });

  it("confirms and settles events", () => {
    const event = recordEconomicEvent({
      tenantId: TENANT,
      principalId: USER,
      source: "contribution_reward",
      grossAmount: 10,
    });
    confirmEvent(event.eventId);
    const confirmed = recordEconomicEvent({
      tenantId: TENANT,
      principalId: USER,
      source: "contribution_reward",
      grossAmount: 10,
    });
    settleEvent(confirmed.eventId);
  });

  it("generates revenue summary", () => {
    recordEconomicEvent({
      tenantId: TENANT,
      principalId: "summary-user",
      source: "marketplace_sale",
      grossAmount: 50,
    });
    recordEconomicEvent({
      tenantId: TENANT,
      principalId: "summary-user",
      source: "affiliate_commission",
      grossAmount: 30,
    });
    const summary = getRevenueSummary("summary-user");
    expect(summary.transactionCount).toBeGreaterThanOrEqual(2);
    expect(summary.totalGross).toBeGreaterThanOrEqual(80);
  });
});

describe("Wallet", () => {
  const WUSER = "wallet-user";

  it("credits balance", () => {
    const entry = credit(WUSER, TENANT, "evt-001", 100, "Marketplace sale");
    expect(entry.type).toBe("credit");
    expect(entry.balance).toBe(100);
  });

  it("gets balance", () => {
    const balance = getBalance(WUSER, TENANT);
    expect(balance.balance).toBeGreaterThanOrEqual(100);
  });

  it("debits balance", () => {
    const entry = debit(WUSER, TENANT, "evt-002", 30, "Payout");
    expect(entry).not.toBeNull();
    expect(entry!.type).toBe("debit");
  });

  it("rejects debit exceeding balance", () => {
    const entry = debit(WUSER, TENANT, "evt-003", 999999, "Oversized payout");
    expect(entry).toBeNull();
  });

  it("returns ledger", () => {
    const ledger = getLedger(WUSER, TENANT, 10);
    expect(ledger.length).toBeGreaterThan(0);
  });

  it("requests payout", () => {
    const payout = requestPayout(WUSER, TENANT, 50, "bank_transfer");
    expect(payout).not.toBeNull();
    expect(payout!.amount).toBe(50);
    expect(payout!.status).toBe("pending");
  });
});

describe("Economic Governance", () => {
  it("approves normal transaction", () => {
    const event = recordEconomicEvent({
      tenantId: TENANT,
      principalId: "gov-test",
      source: "marketplace_sale",
      grossAmount: 25,
    });
    const verdict = evaluatePolicy(event);
    expect(verdict.decision).toBe("approved");
  });

  it("blocks oversized transaction", () => {
    const event = recordEconomicEvent({
      tenantId: TENANT,
      principalId: "gov-test-2",
      source: "marketplace_sale",
      grossAmount: 999999,
      policyDecision: "approved",
    });
    const verdict = evaluatePolicy(event);
    expect(verdict.decision).toBe("blocked");
  });

  it("returns active rules", () => {
    const rules = getActiveRules();
    expect(rules.length).toBeGreaterThanOrEqual(4);
    for (const r of rules) {
      expect(r.id).toBeTruthy();
      expect(r.name).toBeTruthy();
    }
  });

  it("files and resolves disputes", () => {
    const dispute = fileDispute({
      eventId: "evt-test",
      principalId: "dispute-user",
      tenantId: TENANT,
      reason: "Incorrect amount charged",
    });
    expect(dispute.status).toBe("open");

    const resolved = resolveDispute(dispute.id, "Refund issued", "resolved");
    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe("resolved");
  });
});

describe("Revenue Share defaults", () => {
  it("splits sum to 1.0", () => {
    const sum =
      DEFAULT_REVENUE_SHARE.userId +
      DEFAULT_REVENUE_SHARE.platformShare +
      DEFAULT_REVENUE_SHARE.creatorShare +
      DEFAULT_REVENUE_SHARE.ecosystemShare;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it("user gets 50%", () => {
    expect(DEFAULT_REVENUE_SHARE.userId).toBe(0.5);
  });
});
