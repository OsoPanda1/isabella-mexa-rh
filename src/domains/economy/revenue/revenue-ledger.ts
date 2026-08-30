import { randomBytes, createHash } from "node:crypto";
import type { EconomicEvent, RevenueShare, TransactionSource, TransactionStatus, ProvenanceRecord } from "../types";
import { DEFAULT_REVENUE_SHARE } from "../types";

/* ========================================================================== *
 * Isabella Revenue Attribution & Ledger
 *
 * Records every economic event with full provenance, enforces revenue
 * splits, and provides settlement tracking.
 * ========================================================================== */

const events = new Map<string, EconomicEvent>();
const eventsByPrincipal = new Map<string, string[]>();
const eventsByTenant = new Map<string, string[]>();

function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function computeDigest(event: Omit<EconomicEvent, "digest">): string {
  const payload = `${event.eventId}:${event.transactionId}:${event.grossAmount}:${event.currency}:${event.status}:${event.timestamp}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function recordEconomicEvent(params: {
  tenantId: string;
  principalId: string;
  source: TransactionSource;
  grossAmount: number;
  currency?: string;
  share?: Partial<RevenueShare>;
  opportunityId?: string;
  assetId?: string;
  listingId?: string;
  provenance?: ProvenanceRecord;
  policyDecision?: "approved" | "flagged" | "blocked";
}): EconomicEvent {
  const share: RevenueShare = {
    userId: params.share?.userId ?? DEFAULT_REVENUE_SHARE.userId,
    platformShare: params.share?.platformShare ?? DEFAULT_REVENUE_SHARE.platformShare,
    creatorShare: params.share?.creatorShare ?? DEFAULT_REVENUE_SHARE.creatorShare,
    ecosystemShare: params.share?.ecosystemShare ?? DEFAULT_REVENUE_SHARE.ecosystemShare,
  };

  const total = share.platformShare + share.creatorShare + share.ecosystemShare + share.userId;
  const normalizer = total > 0 ? 1 / total : 0;

  const eventBase = {
    eventId: generateId("evt"),
    tenantId: params.tenantId,
    principalId: params.principalId,
    source: params.source,
    transactionId: generateId("txn"),
    grossAmount: params.grossAmount,
    platformShare: Math.round(params.grossAmount * share.platformShare * normalizer * 100) / 100,
    creatorShare: Math.round(params.grossAmount * share.creatorShare * normalizer * 100) / 100,
    rewardShare: Math.round(params.grossAmount * share.userId * normalizer * 100) / 100,
    ecosystemShare: Math.round(params.grossAmount * share.ecosystemShare * normalizer * 100) / 100,
    currency: params.currency || "USD",
    status: "pending" as TransactionStatus,
    timestamp: new Date().toISOString(),
    policyDecision: params.policyDecision || "approved" as const,
    provenance: params.provenance || {
      creatorId: params.principalId,
      createdFrom: "economic_engine",
      evidenceIds: [],
      auditTrailId: generateId("audit"),
      contentHash: "",
    },
    opportunityId: params.opportunityId,
    assetId: params.assetId,
    listingId: params.listingId,
  };

  const digest = computeDigest(eventBase);
  const event: EconomicEvent = { ...eventBase, digest };

  events.set(event.eventId, event);

  const principalEvents = eventsByPrincipal.get(params.principalId) || [];
  principalEvents.push(event.eventId);
  eventsByPrincipal.set(params.principalId, principalEvents);

  const tenantEvents = eventsByTenant.get(params.tenantId) || [];
  tenantEvents.push(event.eventId);
  eventsByTenant.set(params.tenantId, tenantEvents);

  return event;
}

export function confirmEvent(eventId: string): EconomicEvent | null {
  const event = events.get(eventId);
  if (!event) return null;
  event.status = "confirmed";
  return event;
}

export function settleEvent(eventId: string): EconomicEvent | null {
  const event = events.get(eventId);
  if (!event) return null;
  event.status = "settled";
  return event;
}

export function getEvent(eventId: string): EconomicEvent | null {
  return events.get(eventId) || null;
}

export function getEventsByPrincipal(principalId: string, limit = 50): EconomicEvent[] {
  const ids = eventsByPrincipal.get(principalId) || [];
  return ids
    .slice(-limit)
    .map((id) => events.get(id))
    .filter((e): e is EconomicEvent => !!e)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getEventsByTenant(tenantId: string, limit = 100): EconomicEvent[] {
  const ids = eventsByTenant.get(tenantId) || [];
  return ids
    .slice(-limit)
    .map((id) => events.get(id))
    .filter((e): e is EconomicEvent => !!e)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getRevenueSummary(principalId: string): {
  totalGross: number;
  totalPlatform: number;
  totalCreator: number;
  totalReward: number;
  totalEcosystem: number;
  transactionCount: number;
  bySource: Record<string, { count: number; gross: number }>;
} {
  const evts = getEventsByPrincipal(principalId, 10000);
  const summary = {
    totalGross: 0,
    totalPlatform: 0,
    totalCreator: 0,
    totalReward: 0,
    totalEcosystem: 0,
    transactionCount: evts.length,
    bySource: {} as Record<string, { count: number; gross: number }>,
  };
  for (const e of evts) {
    summary.totalGross += e.grossAmount;
    summary.totalPlatform += e.platformShare;
    summary.totalCreator += e.creatorShare;
    summary.totalReward += e.rewardShare;
    summary.totalEcosystem += e.ecosystemShare;
    const src = summary.bySource[e.source] || { count: 0, gross: 0 };
    src.count += 1;
    src.gross += e.grossAmount;
    summary.bySource[e.source] = src;
  }
  return summary;
}
