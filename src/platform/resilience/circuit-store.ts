export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface DistributedCircuitRecord {
  key: string;
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  openedAt?: number;
  leaseId?: string;
  expiresAt: number;
}

export interface CircuitStore {
  get(key: string): Promise<DistributedCircuitRecord | null>;
  set(key: string, value: DistributedCircuitRecord, ttlSeconds: number): Promise<void>;
  acquireHalfOpenLease(key: string, leaseId: string, ttlSeconds: number): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export class MemoryCircuitStore implements CircuitStore {
  private readonly store = new Map<string, { record: DistributedCircuitRecord; expiresAt: number }>();
  private readonly leases = new Map<string, { leaseId: string; expiresAt: number }>();

  public async get(key: string): Promise<DistributedCircuitRecord | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.record;
  }

  public async set(key: string, value: DistributedCircuitRecord, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      record: value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public async acquireHalfOpenLease(key: string, leaseId: string, ttlSeconds: number): Promise<boolean> {
    const leaseKey = `${key}:lease`;
    const existing = this.leases.get(leaseKey);
    if (existing && Date.now() <= existing.expiresAt) {
      return false;
    }
    this.leases.set(leaseKey, {
      leaseId,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  public async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.leases.delete(`${key}:lease`);
  }
}

export const defaultCircuitStore: CircuitStore = new MemoryCircuitStore();
