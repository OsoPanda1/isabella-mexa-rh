export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface IsabellaJob<TPayload = unknown, TResult = unknown> {
  readonly id: string;
  readonly type: string;
  readonly status: JobStatus;
  readonly payload: TPayload;
  readonly result?: TResult;
  readonly error?: string;
  readonly progress?: number; // 0..100
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly traceId: string;
}

export interface CreateJobDto {
  readonly type: string;
  readonly payload: unknown;
  readonly traceId: string;
}

export class JobStore {
  private readonly jobs = new Map<string, IsabellaJob>();

  public create(dto: CreateJobDto): IsabellaJob {
    const job: IsabellaJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: dto.type,
      status: "PENDING",
      payload: dto.payload,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      traceId: dto.traceId,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  public get(id: string): IsabellaJob | null {
    return this.jobs.get(id) ?? null;
  }

  public update(
    id: string,
    updates: Partial<Omit<IsabellaJob, "id" | "type" | "createdAt" | "traceId">>,
  ): IsabellaJob | null {
    const existing = this.jobs.get(id);
    if (!existing) return null;

    const updated: IsabellaJob = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      ...(updates.status === "COMPLETED" || updates.status === "FAILED"
        ? { completedAt: new Date().toISOString() }
        : {}),
    };

    this.jobs.set(id, updated);
    return updated;
  }
}

export const jobStore = new JobStore();
