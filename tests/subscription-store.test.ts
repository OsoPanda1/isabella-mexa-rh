/**
 * Tests: Native subscription persistence and money-flow safety
 *
 * The quota engine must keep its public semantics regardless of the
 * backend (SQLite vs memory), and consumption must persist so daily
 * quotas survive restarts instead of resetting on redeploy.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getSubscriptionStore, resetSubscriptionStore } from "../src/lib/persistence/subscription-store";
import { consumeUsage, evaluateUsage, getUserPlan, getUsage, setUserPlan } from "../src/lib/subscription.server";

beforeEach(() => {
  process.env.ISABELLA_PERSISTENCE = "memory";
  resetSubscriptionStore();
});

describe("subscription store semantics", () => {
  it("round-trips usage buckets", () => {
    const store = getSubscriptionStore();
    expect(store.getBucket("u1", "2026-08-23")).toBeNull();
    store.saveBucket({ userId: "u1", dayKey: "2026-08-23", messages: 3, images: 1, voiceSeconds: 40, agentSessions: 0, updatedAt: "t" });
    const bucket = store.getBucket("u1", "2026-08-23");
    expect(bucket?.messages).toBe(3);
    expect(bucket?.voiceSeconds).toBe(40);
  });

  it("isolates buckets per day", () => {
    const store = getSubscriptionStore();
    store.saveBucket({ userId: "u1", dayKey: "d1", messages: 2, images: 0, voiceSeconds: 0, agentSessions: 0, updatedAt: "t" });
    expect(store.getBucket("u1", "d2")).toBeNull();
  });

  it("round-trips plan assignments", () => {
    const store = getSubscriptionStore();
    expect(store.getPlan("u9")).toBeNull();
    store.savePlan("u9", "premium");
    expect(store.getPlan("u9")).toBe("premium");
    store.savePlan("u9", "plus");
    expect(store.getPlan("u9")).toBe("plus");
  });
});

describe("engine persists consumption", () => {
  it("consumeUsage changes survive re-reads", () => {
    const before = getUsage("persistence-user");
    expect(before.messages).toBe(0);
    consumeUsage("persistence-user", "chat", 2);
    expect(getUsage("persistence-user").messages).toBe(2);
    consumeUsage("persistence-user", "chat", 3);
    expect(getUsage("persistence-user").messages).toBe(5);
  });

  it("evaluateUsage never mutates stored state", () => {
    consumeUsage("eval-user", "chat", 2);
    evaluateUsage("eval-user", "chat", 1000);
    expect(getUsage("eval-user").messages).toBe(2);
  });

  it("plan upgrades apply immediately across reads", () => {
    expect(getUserPlan("upgrade-user").id).toBe("free");
    setUserPlan("upgrade-user", "vip");
    expect(getUserPlan("upgrade-user").id).toBe("vip");
  });

  it("quota exhaustion blocks with an upgrade signal", () => {
    const user = "quota-bound-user";
    let decision = consumeUsage(user, "chat", 30, "free");
    expect(decision.allowed).toBe(false);
    expect(decision.upgradeRequired).toBe(true);
    decision = consumeUsage(user, "chat", 25, "free");
    expect(decision.allowed).toBe(true);
    expect(getUsage(user).messages).toBe(25);
  });
});
