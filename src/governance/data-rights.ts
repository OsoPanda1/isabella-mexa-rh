/**
 * ================================================================
 * ISABELLA VILLASEÑOR AI — DATA RIGHTS (Module 11)
 * Data retention, portability, right to deletion, purpose limitation.
 * ================================================================
 */

export type DataCategory = "memory" | "audit" | "session" | "telemetry" | "consent" | "profile" | "generated";

export interface DataRetentionPolicy {
  readonly category: DataCategory;
  readonly maxAgeDays: number;
  readonly purpose: string;
  readonly requiresConsent: boolean;
  readonly deletableByUser: boolean;
  readonly exportable: boolean;
}

export interface DataRetrievalRecord {
  readonly recordId: string;
  readonly category: DataCategory;
  readonly tenantId: string;
  readonly userId: string;
  readonly purpose: string;
  readonly storedAt: string;
  readonly expiresAt: string;
  readonly size: number;
}

/* =========================================================================
   DEFAULT RETENTION POLICIES
   ========================================================================= */

const DEFAULT_POLICIES: DataRetentionPolicy[] = [
  { category: "memory", maxAgeDays: 365, purpose: "Conversational continuity", requiresConsent: true, deletableByUser: true, exportable: true },
  { category: "audit", maxAgeDays: 730, purpose: "Security and compliance", requiresConsent: false, deletableByUser: false, exportable: true },
  { category: "session", maxAgeDays: 30, purpose: "Session management", requiresConsent: false, deletableByUser: true, exportable: false },
  { category: "telemetry", maxAgeDays: 90, purpose: "Performance monitoring", requiresConsent: false, deletableByUser: false, exportable: false },
  { category: "consent", maxAgeDays: 1825, purpose: "Consent history", requiresConsent: false, deletableByUser: false, exportable: true },
  { category: "profile", maxAgeDays: 1825, purpose: "User identity", requiresConsent: true, deletableByUser: true, exportable: true },
  { category: "generated", maxAgeDays: 90, purpose: "AI-generated content", requiresConsent: true, deletableByUser: true, exportable: true },
];

const policies = new Map<DataCategory, DataRetentionPolicy>();
for (const p of DEFAULT_POLICIES) policies.set(p.category, p);

const retentionRecords: DataRetrievalRecord[] = [];
const MAX_RECORDS = 10_000;

export function getRetentionPolicy(category: DataCategory): DataRetentionPolicy | undefined {
  return policies.get(category);
}

export function setRetentionPolicy(policy: DataRetentionPolicy): void {
  policies.set(policy.category, policy);
}

export function recordDataStorage(params: {
  category: DataCategory;
  tenantId: string;
  userId: string;
  purpose: string;
  size: number;
}): DataRetrievalRecord {
  const policy = policies.get(params.category);
  const maxAge = policy?.maxAgeDays ?? 90;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + maxAge * 86_400_000).toISOString();

  const record: DataRetrievalRecord = {
    recordId: `data-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: params.category,
    tenantId: params.tenantId,
    userId: params.userId,
    purpose: params.purpose,
    storedAt: now,
    expiresAt: expires,
    size: params.size,
  };

  retentionRecords.push(record);
  if (retentionRecords.length > MAX_RECORDS) retentionRecords.splice(0, retentionRecords.length - MAX_RECORDS);
  return record;
}

export function getExpiredRecords(): DataRetrievalRecord[] {
  const now = new Date().toISOString();
  return retentionRecords.filter((r) => r.expiresAt < now);
}

export function deleteUserData(tenantId: string, userId: string): { deleted: number; categories: DataCategory[] } {
  const affected = new Set<DataCategory>();
  let deleted = 0;
  for (let i = retentionRecords.length - 1; i >= 0; i--) {
    const r = retentionRecords[i];
    if (r.tenantId === tenantId && r.userId === userId) {
      const policy = policies.get(r.category);
      if (policy?.deletableByUser) {
        retentionRecords.splice(i, 1);
        affected.add(r.category);
        deleted++;
      }
    }
  }
  return { deleted, categories: [...affected] };
}

export function exportUserData(tenantId: string, userId: string): DataRetrievalRecord[] {
  return retentionRecords.filter((r) => r.tenantId === tenantId && r.userId === userId);
}

export function purgeExpiredData(): number {
  const expired = getExpiredRecords();
  for (const rec of expired) {
    const idx = retentionRecords.indexOf(rec);
    if (idx >= 0) retentionRecords.splice(idx, 1);
  }
  return expired.length;
}
