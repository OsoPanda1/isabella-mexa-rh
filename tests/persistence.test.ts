/**
 * Tests: Persistence layer (SQLite + in-memory fallback)
 */
import { describe, it, expect, afterEach } from "vitest";
import { closeDatabase, getPersistenceMode } from "../src/lib/persistence/sqlite";
import { addMemoryItem, queryMemory, getAllMemories, clearMemoryScope } from "../src/domains/ai/infrastructure/memory-store";
import { auditTrace, getRecentAuditLogs, clearAuditLogs } from "../src/domains/ai/infrastructure/audit-tracer";
import { emitQuantumEvent, onQuantumEvent, getEventLog, getEventBusMetrics } from "../src/lib/quantum/event-bus";
import { commitQuantumBlock, verifyChainIntegrity, getRecentBlocks, getBookPIMetrics, signQuantumBlock } from "../src/lib/quantum/bookpi-quantum";
import { incCounter, observeHistogram, startSpan, endSpan, getCounterValue, getHistogramStats, getSpans, getTelemetrySnapshot } from "../src/lib/quantum/telemetry";

afterEach(() => {
  try { clearAuditLogs(); } catch { /* ok */ }
});

// ─── Memory Store ──────────────────────────────────────────────────────────────

describe("memory-store (SQLite-backed)", () => {
  it("addMemoryItem returns item with id, checksum, timestamps", async () => {
    const item = await addMemoryItem({
      tenantId: "test-tenant",
      scope: "territorial",
      content: "Real del Monte test data",
      sourceType: "user",
      relevance: 0.8,
    });
    expect(item.memoryId).toMatch(/^mem-territorial-/);
    expect(item.checksum).toMatch(/^sha256_/);
    expect(item.createdAt).toBeDefined();
    expect(item.updatedAt).toBeDefined();
    expect(item.content).toBe("Real del Monte test data");
  });

  it("queryMemory filters by scope", async () => {
    await addMemoryItem({ tenantId: "t1", scope: "territorial", content: "scope-test-territorial-x", sourceType: "user", relevance: 0.5 });
    await addMemoryItem({ tenantId: "t1", scope: "historical", content: "scope-test-historical-x", sourceType: "user", relevance: 0.5 });
    const territorial = queryMemory({ scope: "territorial" });
    expect(territorial.every((m) => m.scope === "territorial")).toBe(true);
  });

  it("queryMemory filters by minRelevance", async () => {
    await addMemoryItem({ tenantId: "t1", scope: "project", content: "relevance-low-x", sourceType: "user", relevance: 0.2 });
    await addMemoryItem({ tenantId: "t1", scope: "project", content: "relevance-high-x", sourceType: "user", relevance: 0.95 });
    const high = queryMemory({ minRelevance: 0.5 });
    expect(high.every((m) => m.relevance >= 0.5)).toBe(true);
  });

  it("queryMemory filters by searchQuery", async () => {
    await addMemoryItem({ tenantId: "t1", scope: "project", content: "nodo cero blockchain test z", sourceType: "user", relevance: 0.5 });
    await addMemoryItem({ tenantId: "t1", scope: "project", content: "other content here z", sourceType: "user", relevance: 0.5 });
    const results = queryMemory({ searchQuery: "blockchain" });
    expect(results.some((m) => m.content.includes("blockchain"))).toBe(true);
    expect(results.some((m) => m.content === "other content here z")).toBe(false);
  });

  it("getAllMemories returns seed data", () => {
    const all = getAllMemories();
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it("clearMemoryScope removes scoped items", async () => {
    await addMemoryItem({ tenantId: "t1", scope: "territorial", content: "to-be-cleared-x", sourceType: "user", relevance: 0.5 });
    clearMemoryScope("territorial");
    const remaining = queryMemory({ scope: "territorial" });
    expect(remaining.every((m) => m.content !== "to-be-cleared-x")).toBe(true);
  });
});

// ─── Audit Tracer ──────────────────────────────────────────────────────────────

describe("audit-tracer (SQLite-backed)", () => {
  it("auditTrace returns auditId and traceId", async () => {
    const result = await auditTrace({
      tenantId: "t1",
      eventType: "test.event.z",
      data: { summary: "test audit entry z" },
    });
    expect(result.auditId).toMatch(/^audit-/);
    expect(result.traceId).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });

  it("getRecentAuditLogs contains emitted events", async () => {
    clearAuditLogs();
    const r1 = await auditTrace({ eventType: "event.first.z", data: { order: 1 } });
    const r2 = await auditTrace({ eventType: "event.second.z", data: { order: 2 } });
    const logs = getRecentAuditLogs(10);
    const ids = logs.map((l) => l.id);
    expect(ids).toContain(r1.auditId);
    expect(ids).toContain(r2.auditId);
  });

  it("auditTrace generates checksum", async () => {
    await auditTrace({
      eventType: "checksum.test.z",
      data: { value: 42 },
    });
    const logs = getRecentAuditLogs(1);
    expect(logs[0].checksum).toBeDefined();
    expect(logs[0].checksum).toMatch(/^sha256_/);
  });
});

// ─── Event Bus ─────────────────────────────────────────────────────────────────

describe("event-bus (SQLite-backed)", () => {
  it("emitQuantumEvent returns event with hash chain", () => {
    const event = emitQuantumEvent("quantum.job.completed", { result: "ok" }, {
      traceId: "trace-test-001z",
      requestId: "req-test-001z",
      tenantId: "t1",
      subjectId: "sub-001",
      originCore: 1,
      targetCore: 5,
    });
    expect(event.eventId).toBeDefined();
    expect(event.eventType).toBe("quantum.job.completed");
    expect(event.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(event.previousEventHash).toBeDefined();
    expect(event.schemaVersion).toBe("isabella-quantum-v1");
  });

  it("event chain links previousEventHash correctly", () => {
    const e1 = emitQuantumEvent("quantum.policy.changed", { v: 1001 }, {
      traceId: "t1z", requestId: "r1z", tenantId: "t1", subjectId: "s1", originCore: 1,
    });
    const e2 = emitQuantumEvent("quantum.job.started", { v: 1002 }, {
      traceId: "t2z", requestId: "r2z", tenantId: "t1", subjectId: "s2", originCore: 3, targetCore: 5,
    });
    expect(e2.previousEventHash).toBeDefined();
    expect(e2.previousEventHash).not.toBe(e1.previousEventHash);
  });

  it("onQuantumEvent handler receives events", () => {
    let received: unknown = null;
    const unsub = onQuantumEvent("quantum.recovery.activated", (e) => { received = e; });
    emitQuantumEvent("quantum.recovery.activated", { data: 999 }, {
      traceId: "t1z2", requestId: "r1z2", tenantId: "t1", subjectId: "s1", originCore: 1,
    });
    expect(received).toBeDefined();
    expect((received as { data: { data: number } }).data.data).toBe(999);
    unsub();
  });

  it("getEventBusMetrics returns counters", () => {
    const metrics = getEventBusMetrics();
    expect(metrics.totalEvents).toBeGreaterThanOrEqual(0);
    expect(typeof metrics.lastEventHash).toBe("string");
  });
});

// ─── BookPI ────────────────────────────────────────────────────────────────────

describe("bookpi-quantum (SQLite-backed)", () => {
  it("commitQuantumBlock returns block with hash chain", () => {
    const block = commitQuantumBlock({
      requestId: "req-001z",
      tenantId: "t1",
      circuitHash: "circ-001z",
      implementation: "pennylane",
      status: "completed",
      policyVersion: "p-v1",
    });
    expect(block.blockHash).toMatch(/^[a-f0-9]{64}$/);
    expect(block.previousHash).toBeDefined();
    expect(block.requestId).toBe("req-001z");
    expect(block.status).toBe("completed");
  });

  it("chain integrity is valid after blocks", () => {
    const integrity = verifyChainIntegrity();
    expect(integrity.valid).toBe(true);
    expect(integrity.totalBlocks).toBeGreaterThanOrEqual(0);
  });

  it("signQuantumBlock adds signature", () => {
    const block = commitQuantumBlock({
      requestId: "req-sign-001z",
      tenantId: "t1",
      circuitHash: "circ-signz",
      implementation: "pennylane",
      status: "completed",
      policyVersion: "p-v1",
    });
    const signed = signQuantumBlock(block);
    expect(signed.signature).toBeDefined();
    expect(signed.signature.mlDsaSignature).toMatch(/^[a-f0-9]{64}$/);
    expect(signed.signature.signedAt).toBeDefined();
  });

  it("getBookPIMetrics returns block counts", () => {
    const metrics = getBookPIMetrics();
    expect(metrics.totalBlocks).toBeGreaterThanOrEqual(0);
    expect(typeof metrics.chainValid).toBe("boolean");
  });
});

// ─── Telemetry ─────────────────────────────────────────────────────────────────

describe("telemetry (SQLite-backed)", () => {
  it("incCounter and getCounterValue round-trip", () => {
    const before = getCounterValue("test.counter.z");
    incCounter("test.counter.z", { env: "test" }, 5);
    const after = getCounterValue("test.counter.z", { env: "test" });
    expect(after).toBeGreaterThanOrEqual(before + 5);
  });

  it("observeHistogram and getHistogramStats round-trip", () => {
    observeHistogram("test.histogram.z", 10);
    observeHistogram("test.histogram.z", 20);
    observeHistogram("test.histogram.z", 30);
    const stats = getHistogramStats("test.histogram.z");
    expect(stats.count).toBeGreaterThanOrEqual(3);
    expect(stats.min).toBeLessThanOrEqual(10);
    expect(stats.max).toBeGreaterThanOrEqual(30);
  });

  it("startSpan/endSpan round-trip", () => {
    const span = startSpan({ traceId: "trace-span-001z", operation: "test.span.z" });
    expect(span.spanId).toBeDefined();
    expect(span.status).toBe("ok");
    endSpan(span.spanId, "ok");
    const spans = getSpans("trace-span-001z");
    expect(spans.some((s) => s.spanId === span.spanId && s.endTime)).toBe(true);
  });

  it("getTelemetrySnapshot returns counters and histograms", () => {
    const snap = getTelemetrySnapshot();
    expect(snap.counters).toBeDefined();
    expect(snap.histograms).toBeDefined();
    expect(typeof snap.totalSpans).toBe("number");
  });
});
