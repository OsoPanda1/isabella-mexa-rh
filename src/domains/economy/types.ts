/**
 * Isabella Economic Engine — Core Domain Types
 *
 * EconomicEvent is the atomic unit of the Isabella economy.
 * Every transaction, opportunity, creation, and settlement produces one.
 */

/* ========================================================================== *
 * Opportunity types
 * ========================================================================== */

export type OpportunityCategory = "create" | "sell" | "recommend" | "serve" | "build";

export type AssetType =
  | "agent"
  | "skill"
  | "knowledge_pack"
  | "template"
  | "workflow"
  | "dataset"
  | "prompt"
  | "digital_product"
  | "service"
  | "course"
  | "ebook";

export interface Opportunity {
  id: string;
  tenantId: string;
  principalId: string;
  category: OpportunityCategory;
  title: string;
  description: string;
  estimatedRevenueMin: number;
  estimatedRevenueMax: number;
  currency: string;
  difficulty: "low" | "medium" | "high";
  timeToMarketDays: number;
  competitionLevel: "low" | "medium" | "high";
  requiredCapital: number;
  riskLevel: "low" | "medium" | "high";
  evidenceScore: number;
  overallScore: number;
  status: "discovered" | "evaluated" | "accepted" | "in_progress" | "completed" | "abandoned";
  createdAt: string;
  updatedAt: string;
}

/* ========================================================================== *
 * Creator types
 * ========================================================================== */

export interface CreatorProfile {
  id: string;
  tenantId: string;
  principalId: string;
  displayName: string;
  capabilities: string[];
  skills: string[];
  assets: string[];
  certifications: string[];
  reputation: CreatorReputation;
  wallet: WalletSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorReputation {
  quality: number;
  reliability: number;
  evidence: number;
  security: number;
  customerRetention: number;
  disputeRate: number;
  globalScore: number;
  totalTransactions: number;
  totalRevenue: number;
  updatedAt: string;
}

/* ========================================================================== *
 * Marketplace types
 * ========================================================================== */

export type ListingStatus = "draft" | "active" | "paused" | "revoked" | "sold_out";

export interface MarketplaceListing {
  id: string;
  tenantId: string;
  creatorId: string;
  assetType: AssetType;
  name: string;
  description: string;
  version: string;
  price: number;
  currency: string;
  status: ListingStatus;
  qualityScore: number;
  securityScore: number;
  evidenceScore: number;
  usageCount: number;
  revenue: number;
  provenance: ProvenanceRecord;
  createdAt: string;
  updatedAt: string;
}

export interface ProvenanceRecord {
  creatorId: string;
  createdFrom: string;
  evidenceIds: string[];
  auditTrailId: string;
  contentHash: string;
}

/* ========================================================================== *
 * Revenue types
 * ========================================================================== */

export interface RevenueShare {
  userId: number;
  platformShare: number;
  creatorShare: number;
  ecosystemShare: number;
}

export const DEFAULT_REVENUE_SHARE: RevenueShare = {
  userId: 0.50,
  platformShare: 0.35,
  creatorShare: 0.10,
  ecosystemShare: 0.05,
};

export type TransactionSource =
  | "marketplace_sale"
  | "agent_execution"
  | "affiliate_commission"
  | "contribution_reward"
  | "referral_reward"
  | "service_payment"
  | "settlement"
  | "payout";

export type TransactionStatus = "pending" | "confirmed" | "settled" | "disputed" | "refunded";

/* ========================================================================== *
 * Economic Event (the core ledger entry)
 * ========================================================================== */

export interface EconomicEvent {
  eventId: string;
  tenantId: string;
  principalId: string;
  source: TransactionSource;
  opportunityId?: string;
  assetId?: string;
  listingId?: string;
  transactionId: string;
  grossAmount: number;
  platformShare: number;
  creatorShare: number;
  rewardShare: number;
  ecosystemShare: number;
  currency: string;
  status: TransactionStatus;
  timestamp: string;
  policyDecision: "approved" | "flagged" | "blocked";
  provenance: ProvenanceRecord;
  digest: string;
}

/* ========================================================================== *
 * Wallet types
 * ========================================================================== */

export interface WalletSummary {
  balance: number;
  pendingSettlement: number;
  totalEarned: number;
  totalPaidOut: number;
  currency: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  walletId: string;
  eventId: string;
  type: "credit" | "debit";
  amount: number;
  currency: string;
  balance: number;
  description: string;
  timestamp: string;
}

export interface PayoutRequest {
  id: string;
  walletId: string;
  principalId: string;
  amount: number;
  currency: string;
  method: "bank_transfer" | "crypto" | "platform_credit";
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  completedAt: string | null;
}

/* ========================================================================== *
 * Economic Radar
 * ========================================================================== */

export interface RadarScan {
  id: string;
  principalId: string;
  tenantId: string;
  capabilities: string[];
  opportunities: Opportunity[];
  scannedAt: string;
}

/* ========================================================================== *
 * Economic Passport
 * ========================================================================== */

export interface EconomicPassport {
  principalId: string;
  displayName: string;
  capabilities: string[];
  skills: string[];
  assets: string[];
  agents: MarketplaceListing[];
  products: MarketplaceListing[];
  revenue: WalletSummary;
  reputation: CreatorReputation;
  certifications: string[];
  transactions: number;
  memberSince: string;
}
