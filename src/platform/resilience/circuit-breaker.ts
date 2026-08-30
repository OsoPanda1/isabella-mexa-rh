import { CircuitStore, defaultCircuitStore, DistributedCircuitRecord } from "./circuit-store";

export class DistributedCircuitBreaker {
  public constructor(
    private readonly service: string,
    private readonly store: CircuitStore = defaultCircuitStore,
    private readonly threshold = 5,
    private readonly resetMs = 30_000,
  ) {}

  private key(): string {
    return `isabella:circuit:${this.service}`;
  }

  public async beforeRequest(): Promise<void> {
    const record = await this.store.get(this.key());
    if (!record || record.state === "CLOSED") {
      return;
    }

    if (record.state === "OPEN") {
      const elapsed = Date.now() - (record.openedAt ?? 0);
      if (elapsed < this.resetMs) {
        const error = new Error("SERVICE_TEMPORARILY_UNAVAILABLE");
        (error as any).status = 503;
        (error as any).code = "SERVICE_TEMPORARILY_UNAVAILABLE";
        throw error;
      }

      const leaseId = crypto.randomUUID();
      const acquired = await this.store.acquireHalfOpenLease(this.key(), leaseId, 15);
      if (!acquired) {
        const error = new Error("CIRCUIT_HALF_OPEN_BUSY");
        (error as any).status = 503;
        (error as any).code = "CIRCUIT_HALF_OPEN_BUSY";
        throw error;
      }

      await this.store.set(
        this.key(),
        {
          ...record,
          state: "HALF_OPEN",
          leaseId,
          expiresAt: Date.now() + 15_000,
        },
        60,
      );
      return;
    }

    if (record.state === "HALF_OPEN") {
      const error = new Error("CIRCUIT_HALF_OPEN_BUSY");
      (error as any).status = 503;
      (error as any).code = "CIRCUIT_HALF_OPEN_BUSY";
      throw error;
    }
  }

  public async recordSuccess(): Promise<void> {
    await this.store.set(
      this.key(),
      {
        key: this.key(),
        state: "CLOSED",
        failures: 0,
        lastFailureAt: 0,
        expiresAt: Date.now() + 300_000,
      },
      300,
    );
  }

  public async recordFailure(): Promise<void> {
    const current = await this.store.get(this.key());
    const failures = (current?.failures ?? 0) + 1;
    const shouldOpen = failures >= this.threshold;

    await this.store.set(
      this.key(),
      {
        key: this.key(),
        state: shouldOpen ? "OPEN" : "CLOSED",
        failures,
        lastFailureAt: Date.now(),
        openedAt: shouldOpen ? Date.now() : current?.openedAt,
        expiresAt: Date.now() + 300_000,
      },
      300,
    );
  }
}
