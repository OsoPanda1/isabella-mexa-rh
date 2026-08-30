import type { EconomicEvent } from "../types";

/* ========================================================================== *
 * Isabella Economic Governance
 *
 * Fraud detection, economic policy enforcement, and dispute resolution.
 * Fail-closed: any event flagged by governance is blocked by default.
 * ========================================================================== */

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  evaluate: (event: EconomicEvent) => PolicyVerdict;
}

export type PolicyVerdict = {
  decision: "approved";
  reason?: string;
} | {
  decision: "flagged" | "blocked";
  reason: string;
  ruleId: string;
};

export interface Dispute {
  id: string;
  eventId: string;
  principalId: string;
  tenantId: string;
  reason: string;
  status: "open" | "investigating" | "resolved" | "rejected";
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

/* ---- Built-in policy rules ---- */

const MAX_SINGLE_TRANSACTION = 10000;
const MAX_DAILY_VOLUME = 50000;
const MAX_VELOCITY_PER_HOUR = 20;

const dailyVolumes = new Map<string, { date: string; total: number; count: number }>();
const hourlyCounts = new Map<string, { hour: string; count: number }>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentHour(): string {
  return new Date().toISOString().slice(0, 13);
}

const rules: PolicyRule[] = [
  {
    id: "POL-001",
    name: "max_single_transaction",
    description: "Blocks individual transactions exceeding the maximum amount",
    enabled: true,
    evaluate: (event) => {
      if (event.grossAmount > MAX_SINGLE_TRANSACTION) {
        return {
          decision: "blocked",
          reason: `Transaction amount $${event.grossAmount} exceeds maximum $${MAX_SINGLE_TRANSACTION}`,
          ruleId: "POL-001",
        };
      }
      return { decision: "approved" };
    },
  },
  {
    id: "POL-002",
    name: "daily_volume_limit",
    description: "Flags when daily cumulative volume exceeds threshold",
    enabled: true,
    evaluate: (event) => {
      const key = `${event.tenantId}:${event.principalId}`;
      const today = todayKey();
      const entry = dailyVolumes.get(key);
      if (!entry || entry.date !== today) {
        dailyVolumes.set(key, { date: today, total: event.grossAmount, count: 1 });
        return { decision: "approved" };
      }
      entry.total += event.grossAmount;
      entry.count += 1;
      if (entry.total > MAX_DAILY_VOLUME) {
        return {
          decision: "flagged",
          reason: `Daily volume $${entry.total.toFixed(2)} exceeds threshold $${MAX_DAILY_VOLUME}`,
          ruleId: "POL-002",
        };
      }
      return { decision: "approved" };
    },
  },
  {
    id: "POL-003",
    name: "velocity_check",
    description: "Flags excessive transaction velocity per hour",
    enabled: true,
    evaluate: (event) => {
      const key = `${event.tenantId}:${event.principalId}`;
      const hour = currentHour();
      const entry = hourlyCounts.get(key);
      if (!entry || entry.hour !== hour) {
        hourlyCounts.set(key, { hour, count: 1 });
        return { decision: "approved" };
      }
      entry.count += 1;
      if (entry.count > MAX_VELOCITY_PER_HOUR) {
        return {
          decision: "flagged",
          reason: `Transaction velocity ${entry.count}/hour exceeds limit ${MAX_VELOCITY_PER_HOUR}`,
          ruleId: "POL-003",
        };
      }
      return { decision: "approved" };
    },
  },
  {
    id: "POL-004",
    name: "blocked_source_check",
    description: "Blocks events from blocked sources",
    enabled: true,
    evaluate: (event) => {
      if (event.policyDecision === "blocked") {
        return {
          decision: "blocked",
          reason: "Event was pre-blocked by upstream policy",
          ruleId: "POL-004",
        };
      }
      return { decision: "approved" };
    },
  },
];

export function evaluatePolicy(event: EconomicEvent): PolicyVerdict {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const verdict = rule.evaluate(event);
    if (verdict.decision !== "approved") {
      return verdict;
    }
  }
  return { decision: "approved" };
}

export function getActiveRules(): Array<{ id: string; name: string; description: string; enabled: boolean }> {
  return rules.map((r) => ({ id: r.id, name: r.name, description: r.description, enabled: r.enabled }));
}

const disputes = new Map<string, Dispute>();

export function fileDispute(params: {
  eventId: string;
  principalId: string;
  tenantId: string;
  reason: string;
}): Dispute {
  const id = `disp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dispute: Dispute = {
    id,
    ...params,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  disputes.set(id, dispute);
  return dispute;
}

export function resolveDispute(
  disputeId: string,
  resolution: string,
  outcome: "resolved" | "rejected"
): Dispute | null {
  const dispute = disputes.get(disputeId);
  if (!dispute) return null;
  dispute.status = outcome;
  dispute.resolution = resolution;
  dispute.resolvedAt = new Date().toISOString();
  return dispute;
}

export function getDisputes(tenantId?: string): Dispute[] {
  return Array.from(disputes.values()).filter(
    (d) => !tenantId || d.tenantId === tenantId
  );
}
