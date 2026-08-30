/**
 * Isabella Creator Economy v1.1.0 — Domain types.
 *
 * Money is always represented as integer minor units (centavos MXN / cents
 * USD). No floats ever cross a financial boundary. All timestamps are
 * ISO-8601 UTC. Every mutation is idempotent via caller-provided keys.
 */

export type PlanId = "free" | "premium" | "pro" | "business";
export type KycLevel = "none" | "level_1_basic" | "level_2_full" | "level_3_enhanced";
export type Currency = "MXN" | "USD";

export type AssetFormat = "post" | "video" | "audio" | "image" | "guide" | "newsletter";
export type AssetStatus = "draft" | "review" | "approved" | "scheduled" | "published" | "archived";
export type OfferType = "service" | "digital_product" | "membership" | "experience_rdm" | "sponsorship";
export type OfferStatus = "hypothesis" | "draft" | "active" | "paused" | "archived";
export type SkillCategory = "writing" | "video" | "audio" | "visual" | "analytics" | "commerce" | "local_rdm";

export type AccountType =
  | "customer_cash_clearing"
  | "creator_payable_pending"
  | "creator_payable_available"
  | "platform_revenue_gross"
  | "tax_vat_payable"
  | "tax_isr_withheld_payable"
  | "tax_vat_withheld_payable"
  | "chargeback_reserve_held"
  | "payment_processor_expense";

export type LedgerDirection = "debit" | "credit";
export type PayoutStatus = "requested" | "approved" | "processing" | "paid" | "failed" | "reversed";
export type TransactionKind = "gift" | "offer_sale" | "membership" | "credit_purchase" | "payout" | "reversal";
export type ChannelProvider = "youtube" | "meta" | "tiktok" | "x" | "linkedin" | "wordpress";

// ---------- Plans / Entitlements ----------

export interface PlanDefinition {
  plan: PlanId;
  monthlyPriceMxnMinor: number;
  monthlyCredits: number;
  maxActiveOffers: number; // -1 = unlimited
  maxConnectedChannels: number; // -1 = unlimited
  platformGiftSharePercent: number; // platform cut of net distributable (30/15/10/5)
  canCreateOffers: boolean;
  canReceiveGifts: boolean;
  canRequestPayout: boolean;
  canPublishExternally: boolean;
  requiresHumanApproval: boolean;
}

export interface KycVerificationStatus {
  creatorId: string;
  level: KycLevel;
  rfcSubmitted: boolean;
  rfcValidated: boolean;
  eFirmaValid: boolean;
  bankAccountVerified: boolean;
  clabeHolderNameMatch: boolean;
  proofOfAddressVerified: boolean;
  taxResidencyCountry: string; // ISO 3166-1 alpha-2
  updatedAt: string;
}

export interface Entitlement {
  creatorId: string;
  tenantId: string;
  plan: PlanId;
  monthlyCredits: number;
  remainingCredits: number;
  canUseSkills: boolean;
  canCreateOffers: boolean;
  maxActiveOffers: number;
  canReceiveGifts: boolean;
  canRequestPayout: boolean;
  canPublishExternally: boolean;
  maxConnectedChannels: number;
  requiresHumanApproval: boolean;
  policyVersion: string;
  expiresAt: string | null;
}

export interface CreatorProfile {
  id: string;
  tenantId: string;
  displayName: string;
  skills: string[];
  interests: string[];
  audienceSegments: string[];
  availabilityMinutesPerWeek: number;
  privacyPreferences: {
    showFace: boolean;
    allowVoice: boolean;
    allowLocation: boolean;
    allowExternalPublishing: boolean;
  };
  objectives: Array<"income" | "community" | "portfolio" | "local_impact">;
  onboardingStatus: "incomplete" | "complete" | "review";
  createdAt: string;
  updatedAt: string;
}

// ---------- Skills / Credits ----------

export interface SkillDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  category: SkillCategory;
  planRequired: PlanId;
  creditsRequired: number;
  estimatedCostMinor: number;
  maxInputBytes: number;
  maxOutputTokens: number;
  requiresApproval: boolean;
  allowedDataClasses: Array<"public" | "internal" | "confidential">;
  modelDigest: string;
  enabled: boolean;
}

export interface SkillExecution {
  executionId: string;
  skillId: string;
  creatorId: string;
  creditsDeducted: number;
  remainingCredits: number;
  status: "completed" | "refunded" | "failed";
  inputHash: string;
  outputSummary: string;
  executedAt: string;
}

// ---------- Content Assets ----------

export interface ContentAsset {
  id: string;
  creatorId: string;
  sourceAssetId?: string;
  format: AssetFormat;
  contentUri: string;
  status: AssetStatus;
  provenance: {
    generatedBy: "user" | "isabella" | "hybrid";
    modelDigest?: string;
    sourcePromptHash?: string;
    transformations: string[];
    createdAt: string;
  };
  hashSHA256: string;
  approvedByCreatorAt: string | null; // human-in-the-loop event
  createdAt: string;
  updatedAt: string;
}

// ---------- Marketplace / Gifts ----------

export interface MonetizationOffer {
  id: string;
  creatorId: string;
  tenantId: string;
  type: OfferType;
  title: string;
  description: string;
  price: { amountMinor: number; currency: Currency };
  status: OfferStatus;
  evidence: { interviews: number; leads: number; preorders: number; sales: number };
  sponsorshipDisclosed: boolean; // FTC / PROFECO #PublicidadPagada
  createdAt: string;
}

export interface GiftDefinition {
  id: string;
  name: string;
  iconUrl: string;
  priceMinor: number;
  currency: Currency;
  creatorSharePercent: number;
  dailyPurchaseLimit: number;
  enabled: boolean;
}

// ---------- Ledger ----------

export interface LedgerEntry {
  id: string;
  transactionId: string;
  tenantId: string;
  account: AccountType;
  direction: LedgerDirection;
  amountMinor: number;
  currency: Currency;
  status: "posted" | "reversed";
  memo: string;
  createdAt: string;
}

export interface LedgerTransaction {
  id: string;
  tenantId: string;
  kind: TransactionKind;
  idempotencyKey: string;
  createdAt: string;
}

// ---------- Tax ----------

export interface TaxDeductionCalculation {
  grossAmountMinor: number;
  vatAmountMinor: number;
  taxableBaseMinor: number;
  isrWithheldMinor: number;
  vatWithheldMinor: number;
  netPayableToCreatorMinor: number;
  rfcUsed: string | null;
  appliedIsrRatePercent: number;
  appliedVatRatePercent: number;
}

// ---------- Revenue split ----------

export interface RevenueSplit {
  grossAmountMinor: number;
  vatAmountMinor: number;
  taxableBaseMinor: number;
  processorFeeMinor: number; // incluye IVA de la comisión
  thirdPartyFeeMinor: number;
  chargebackReserveMinor: number;
  netDistributableMinor: number;
  creatorShareMinor: number;
  platformShareMinor: number;
}

// ---------- Payouts ----------

export interface PayoutRequest {
  id: string;
  creatorId: string;
  currency: Currency;
  requestedMinor: number;
  feeMinor: number;
  taxWithheldMinor: number;
  netPayoutMinor: number;
  status: PayoutStatus;
  idempotencyKey: string;
  requestedAt: string;
  processedAt: string | null;
  bankAccountMasked: string;
  disbursementReference: string | null;
}

// ---------- Social channels ----------

export interface SocialChannel {
  id: string;
  creatorId: string;
  provider: ChannelProvider;
  externalAccountId: string;
  displayName: string;
  scopes: string[];
  tokenCiphertext: string; // AES-256-GCM, refresh token at rest
  tokenIv: string;
  tokenTag: string;
  expiresAt: string | null;
  status: "active" | "expired" | "revoked";
  connectedAt: string;
}

export interface ScheduledPublication {
  id: string;
  creatorId: string;
  channelId: string;
  assetId: string;
  scheduledAt: string;
  status: "scheduled" | "published" | "failed" | "cancelled";
  approvedByCreatorAt: string; // never null — HITL invariant
  publishedAt: string | null;
  externalRef: string | null;
}
