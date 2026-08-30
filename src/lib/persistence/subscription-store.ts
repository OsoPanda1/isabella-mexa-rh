/**
 * Native persistence for subscription quota and plan assignments.
 *
 * Single-node deployments keep billing state in SQLite (WAL); throwaway
 * environments degrade to memory without changing the engine semantics.
 * The store only persists shaped records — plans resolve from the static
 * catalog, usage resets daily by key structure.
 */

import { nodeRequire } from "../node-require";
import type BetterSqlite3 from "better-sqlite3";
import type { IsabellaPlanId, UsageBucket } from "../subscription.server";

type SqliteDatabase = BetterSqlite3.Database;

export interface SubscriptionStore {
  getBucket(userId: string, dayKey: string): UsageBucket | null;
  saveBucket(bucket: UsageBucket): void;
  getPlan(userId: string): IsabellaPlanId | null;
  savePlan(userId: string, planId: IsabellaPlanId): void;
  readonly mode: "sqlite" | "in-memory";
}

const PLANS: readonly IsabellaPlanId[] = [
  "free",
  "plus",
  "premium",
  "vip",
  "enterprise",
  "custom",
];

const isPlanId = (value: unknown): value is IsabellaPlanId =>
  typeof value === "string" && (PLANS as readonly string[]).includes(value);

class InMemorySubscriptionStore implements SubscriptionStore {
  readonly mode = "in-memory" as const;
  private buckets = new Map<string, UsageBucket>();
  private plans = new Map<string, IsabellaPlanId>();

  getBucket(userId: string, dayKey: string): UsageBucket | null {
    return this.buckets.get(`${userId}:${dayKey}`) ?? null;
  }

  saveBucket(bucket: UsageBucket): void {
    this.buckets.set(`${bucket.userId}:${bucket.dayKey}`, { ...bucket });
  }

  getPlan(userId: string): IsabellaPlanId | null {
    return this.plans.get(userId) ?? null;
  }

  savePlan(userId: string, planId: IsabellaPlanId): void {
    this.plans.set(userId, planId);
  }
}

interface BucketRow {
  userId: string;
  dayKey: string;
  messages: number;
  images: number;
  voiceSeconds: number;
  agentSessions: number;
  updatedAt: string;
}

class SqliteSubscriptionStore implements SubscriptionStore {
  readonly mode = "sqlite" as const;
  private db: SqliteDatabase;

  constructor(dbPath?: string) {
    const BetterSqlite3Ctor = nodeRequire("better-sqlite3") as new (
      filename: string,
    ) => SqliteDatabase;
    this.db = new BetterSqlite3Ctor(
      dbPath || process.env.ISABELLA_DB_PATH || "./data/isabella.db",
    );
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscription_usage (
        userId TEXT NOT NULL,
        dayKey TEXT NOT NULL,
        messages INTEGER NOT NULL DEFAULT 0,
        images INTEGER NOT NULL DEFAULT 0,
        voiceSeconds INTEGER NOT NULL DEFAULT 0,
        agentSessions INTEGER NOT NULL DEFAULT 0,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (userId, dayKey)
      );

      CREATE TABLE IF NOT EXISTS subscription_plans (
        userId TEXT PRIMARY KEY,
        planId TEXT NOT NULL DEFAULT 'free',
        updatedAt TEXT NOT NULL
      );
    `);
  }

  getBucket(userId: string, dayKey: string): UsageBucket | null {
    const row = this.db
      .prepare<[string, string], BucketRow>(
        "SELECT userId, dayKey, messages, images, voiceSeconds, agentSessions, updatedAt FROM subscription_usage WHERE userId = ? AND dayKey = ?",
      )
      .get(userId, dayKey);
    return row ? { ...row } : null;
  }

  saveBucket(bucket: UsageBucket): void {
    this.db
      .prepare(
        `INSERT INTO subscription_usage (userId, dayKey, messages, images, voiceSeconds, agentSessions, updatedAt)
         VALUES (@userId, @dayKey, @messages, @images, @voiceSeconds, @agentSessions, @updatedAt)
         ON CONFLICT (userId, dayKey) DO UPDATE SET
           messages = excluded.messages,
           images = excluded.images,
           voiceSeconds = excluded.voiceSeconds,
           agentSessions = excluded.agentSessions,
           updatedAt = excluded.updatedAt`,
      )
      .run({
        userId: bucket.userId,
        dayKey: bucket.dayKey,
        messages: bucket.messages,
        images: bucket.images,
        voiceSeconds: bucket.voiceSeconds,
        agentSessions: bucket.agentSessions,
        updatedAt: bucket.updatedAt,
      });
  }

  getPlan(userId: string): IsabellaPlanId | null {
    const row = this.db
      .prepare<[string], { planId: string }>(
        "SELECT planId FROM subscription_plans WHERE userId = ?",
      )
      .get(userId);
    return row && isPlanId(row.planId) ? row.planId : null;
  }

  savePlan(userId: string, planId: IsabellaPlanId): void {
    this.db
      .prepare(
        `INSERT INTO subscription_plans (userId, planId, updatedAt)
         VALUES (?, ?, ?)
         ON CONFLICT (userId) DO UPDATE SET planId = excluded.planId, updatedAt = excluded.updatedAt`,
      )
      .run(userId, planId, new Date().toISOString());
  }
}

let activeStore: SubscriptionStore | null = null;

export function getSubscriptionStore(): SubscriptionStore {
  if (activeStore) return activeStore;
  if (process.env.ISABELLA_PERSISTENCE === "memory") {
    activeStore = new InMemorySubscriptionStore();
    return activeStore;
  }
  try {
    activeStore = new SqliteSubscriptionStore();
  } catch {
    activeStore = new InMemorySubscriptionStore();
  }
  return activeStore;
}

/** Test hook: reset the singleton so scenarios can isolate stores. */
export function resetSubscriptionStore(): void {
  activeStore = null;
}
