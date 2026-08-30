/**
 * ISABELLA VILLASEÑOR AI — GOVERNANCE BARREL EXPORT
 */
export { grantConsent, revokeConsent, hasActiveConsent, listConsents, checkConsent } from "./consent";
export type { ConsentRecord, ConsentDecision, ConsentScope } from "./consent";

export { classifyRisk } from "./safety";
export type { RiskClassification } from "./safety";

export { getRetentionPolicy, setRetentionPolicy, recordDataStorage, getExpiredRecords, deleteUserData, exportUserData, purgeExpiredData } from "./data-rights";
export type { DataRetentionPolicy, DataRetrievalRecord, DataCategory } from "./data-rights";

export { auditReceipt, getReceipts, getReceiptsByActor, verifyReceipt, getReceiptStats } from "./audit-receipt";
export type { AuditReceipt } from "./audit-receipt";
