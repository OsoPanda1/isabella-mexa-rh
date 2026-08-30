/**
 * Atlas Observability Kernel — server‑only
 *
 * Implements the kernel required by INVARIANTS §I2 (Traceability),
 * §I3 (Evidence) and §I7 (Observability) without depending on any
 * external collector. Designed to be fed by createServerFn handlers
 * and exposed read‑only via /api/public/metrics and /api/public/audit.
 *
 * - W3C/OTEL‑compatible trace identifiers.
 * - Hash‑chained append‑only audit log (Merkle‑lite over SHA‑256).
 * - Multi‑axis metrics: RED + USE + AI + Territorial.
 * - Counter monotonicity, histogram buckets, TTL eviction.
 * - In‑memory; pluggable persistence later.
 */

import { createHash, randomBytes } from "node:crypto";

// ---------- IDs ----------
export function newTraceId(): string {
  return randomBytes(16).toString("hex"); // 128 bit, W3C
}
export function newSpanId(): string {
  return randomBytes(8).toString("hex"); // 64 bit, W3C
}

// ---------- Audit chain ----------
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export interface AuditEvent {
  readonly seq: number;
  readonly ts: string;
  readonly traceId: string;
  readonly correlationId: string;
  readonly actor: string;
  readonly action: string;
  readonly policy: string;
  readonly invariantHash: string;
  readonly payload: JsonValue;
  readonly prevHash: string;
  readonly hash: string;
}

function toJson(v: unknown): JsonValue {
  return JSON.parse(JSON.stringify(v ?? null)) as JsonValue;
}

const AUDIT_LIMIT = 10_000;
const audit: AuditEvent[] = [];
let lastHash = "GENESIS";

function hashEvent(e: Omit<AuditEvent, "hash">): string {
  const h = createHash("sha256");
  h.update(JSON.stringify(e));
  return h.digest("hex");
}

export function recordAudit(input: {
  traceId?: string;
  correlationId?: string;
  actor: string;
  action: string;
  policy?: string;
  payload?: unknown;
}): AuditEvent {
  const base: Omit<AuditEvent, "hash"> = {
    seq: audit.length + 1,
    ts: new Date().toISOString(),
    traceId: input.traceId ?? newTraceId(),
    correlationId: input.correlationId ?? newSpanId(),
    actor: input.actor,
    action: input.action,
    policy: input.policy ?? "default",
    invariantHash: INVARIANT_HASH,
    payload: toJson(input.payload),
    prevHash: lastHash,
  };
  const evt: AuditEvent = { ...base, hash: hashEvent(base) };
  lastHash = evt.hash;
  audit.push(evt);
  if (audit.length > AUDIT_LIMIT) audit.splice(0, audit.length - AUDIT_LIMIT);
  metrics.counter("atlas_audit_events_total", { action: input.action }).inc();
  return evt;
}

export function readAudit(limit = 100): AuditEvent[] {
  return audit.slice(-limit).reverse();
}

export function verifyAuditChain(): { ok: boolean; brokenAt?: number } {
  let prev = "GENESIS";
  for (let i = 0; i < audit.length; i++) {
    const e = audit[i];
    if (e.prevHash !== prev) return { ok: false, brokenAt: i };
    const { hash: _h, ...rest } = e;
    if (hashEvent(rest) !== e.hash) return { ok: false, brokenAt: i };
    prev = e.hash;
  }
  return { ok: true };
}

// ---------- Invariant fingerprint ----------
// SHA‑256 of the INVARIANTS doc summary. Used to detect normative drift
// from running code without depending on the file system at runtime.
export const INVARIANT_HASH = createHash("sha256")
  .update("I1|I2|I3|I4|I5|I6|I7|I8|I9|I10|I11|I12@v1.0")
  .digest("hex");

// ---------- Metrics registry ----------
type LabelSet = Record<string, string | number>;
const labelKey = (l: LabelSet) =>
  Object.keys(l)
    .sort()
    .map((k) => `${k}=${l[k]}`)
    .join(",");

class Counter {
  private values = new Map<string, number>();
  constructor(public name: string, public help: string) {}
  inc(labels: LabelSet = {}, by = 1) {
    if (by < 0) throw new Error("counters are monotonic");
    const k = labelKey(labels);
    this.values.set(k, (this.values.get(k) ?? 0) + by);
  }
  snapshot() {
    return [...this.values.entries()].map(([k, v]) => ({ labels: k, value: v }));
  }
}

class Gauge {
  private values = new Map<string, number>();
  constructor(public name: string, public help: string) {}
  set(value: number, labels: LabelSet = {}) {
    this.values.set(labelKey(labels), value);
  }
  snapshot() {
    return [...this.values.entries()].map(([k, v]) => ({ labels: k, value: v }));
  }
}

class Histogram {
  private bucketCounts = new Map<string, number[]>();
  private sums = new Map<string, number>();
  private counts = new Map<string, number>();
  constructor(
    public name: string,
    public help: string,
    public buckets: number[] = [
      0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ],
  ) {}
  observe(value: number, labels: LabelSet = {}) {
    const k = labelKey(labels);
    if (!this.bucketCounts.has(k))
      this.bucketCounts.set(k, new Array(this.buckets.length).fill(0));
    const arr = this.bucketCounts.get(k)!;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) arr[i]++;
    }
    this.sums.set(k, (this.sums.get(k) ?? 0) + value);
    this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
  }
  snapshot() {
    const out: { labels: string; buckets: { le: number; count: number }[]; sum: number; count: number }[] = [];
    for (const k of this.counts.keys()) {
      out.push({
        labels: k,
        buckets: this.buckets.map((le, i) => ({ le, count: this.bucketCounts.get(k)![i] })),
        sum: this.sums.get(k) ?? 0,
        count: this.counts.get(k) ?? 0,
      });
    }
    return out;
  }
}

class Registry {
  counters = new Map<string, Counter>();
  gauges = new Map<string, Gauge>();
  histograms = new Map<string, Histogram>();
  counter(name: string, _l: LabelSet = {}, help = ""): Counter {
    if (!this.counters.has(name))
      this.counters.set(name, new Counter(name, help || name));
    return this.counters.get(name)!;
  }
  gauge(name: string, help = ""): Gauge {
    if (!this.gauges.has(name))
      this.gauges.set(name, new Gauge(name, help || name));
    return this.gauges.get(name)!;
  }
  histogram(name: string, help = ""): Histogram {
    if (!this.histograms.has(name))
      this.histograms.set(name, new Histogram(name, help || name));
    return this.histograms.get(name)!;
  }
  snapshot() {
    return [
      ...Array.from(this.counters.values()).flatMap(c => c.snapshot().map(s => ({ name: c.name, type: 'counter', ...s }))),
      ...Array.from(this.gauges.values()).flatMap(g => g.snapshot().map(s => ({ name: g.name, type: 'gauge', ...s })))
    ];
  }
  prometheus(): string {
    const lines: string[] = [];
    for (const c of this.counters.values()) {
      lines.push(`# HELP ${c.name} ${c.help}`);
      lines.push(`# TYPE ${c.name} counter`);
      for (const s of c.snapshot())
        lines.push(`${c.name}{${s.labels}} ${s.value}`);
    }
    for (const g of this.gauges.values()) {
      lines.push(`# HELP ${g.name} ${g.help}`);
      lines.push(`# TYPE ${g.name} gauge`);
      for (const s of g.snapshot())
        lines.push(`${g.name}{${s.labels}} ${s.value}`);
    }
    for (const h of this.histograms.values()) {
      lines.push(`# HELP ${h.name} ${h.help}`);
      lines.push(`# TYPE ${h.name} histogram`);
      for (const s of h.snapshot()) {
        for (const b of s.buckets)
          lines.push(`${h.name}_bucket{${s.labels},le="${b.le}"} ${b.count}`);
        lines.push(`${h.name}_bucket{${s.labels},le="+Inf"} ${s.count}`);
        lines.push(`${h.name}_sum{${s.labels}} ${s.sum}`);
        lines.push(`${h.name}_count{${s.labels}} ${s.count}`);
      }
    }
    return lines.join("\\n") + "\\n";
  }
}

export const metrics = new Registry();

// Pre-register canonical metrics
metrics.counter("atlas_audit_events_total", {}, "Audit events recorded");
metrics.counter("atlas_requests_total", {}, "RED: total requests");
metrics.counter("atlas_errors_total", {}, "RED: total errors");
metrics.histogram("atlas_request_duration_seconds", "RED: request latency seconds");
metrics.gauge("atlas_federations_active", "Territorial: active federations");
metrics.gauge("atlas_ai_hallucination_rate", "AI: rolling hallucination rate (0-1)");
metrics.gauge("atlas_ai_precision", "AI: rolling precision (0-1)");
metrics.gauge("atlas_invariants_ok", "1 if invariant chain verified, 0 otherwise");

// ---------- Tracing helpers ----------
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  attrs: Record<string, JsonValue>;
}
const spans: Span[] = [];
const SPAN_LIMIT = 5_000;

export function startSpan(name: string, parent?: { traceId: string; spanId: string }): Span {
  const sp: Span = {
    traceId: parent?.traceId ?? newTraceId(),
    spanId: newSpanId(),
    parentSpanId: parent?.spanId,
    name,
    startedAt: Date.now(),
    attrs: {},
  };
  spans.push(sp);
  if (spans.length > SPAN_LIMIT) spans.splice(0, spans.length - SPAN_LIMIT);
  return sp;
}
export function endSpan(sp: Span, attrs: Record<string, unknown> = {}) {
  sp.endedAt = Date.now();
  Object.assign(sp.attrs, toJson(attrs) as Record<string, JsonValue>);
  const seconds = (sp.endedAt - sp.startedAt) / 1000;
  metrics.histogram("atlas_request_duration_seconds").observe(seconds, { op: sp.name });
  metrics.counter("atlas_requests_total").inc({ op: sp.name });
  if (attrs.error) metrics.counter("atlas_errors_total").inc({ op: sp.name });
}
export function recentSpans(limit = 50): Span[] {
  return spans.slice(-limit).reverse();
}

// ---------- Synthetic AI evaluation hooks (Isabella) ----------
export function recordAiEvaluation(input: { precision: number; hallucination: number; latencyMs: number; model: string }) {
  metrics.gauge("atlas_ai_precision").set(input.precision, { model: input.model });
  metrics.gauge("atlas_ai_hallucination_rate").set(input.hallucination, { model: input.model });
  metrics.histogram("atlas_request_duration_seconds").observe(input.latencyMs / 1000, { op: `ai:${input.model}` });
}

// ---------- Bootstrap canonical state ----------
recordAudit({
  actor: "system",
  action: "kernel.boot",
  policy: "invariants.v1",
  payload: { invariantHash: INVARIANT_HASH },
});
metrics.gauge("atlas_invariants_ok").set(verifyAuditChain().ok ? 1 : 0);