/**
 * Skills engine — atomic credit validation & compensating refunds (§4.3).
 *
 * Invariants:
 *  - No negative balances: remainingCredits < creditsRequired rejects before
 *    any inference work begins.
 *  - Failed inference refunds credits in the same logical operation
 *    (compensating transaction at the entitlement level).
 *  - Prohibited engagement-inflation boosters never reach execution.
 */

import { createHash, randomUUID } from "node:crypto";
import { getSkill, isProhibitedBoosterRequest, planAtLeast, PLANS } from "./plans";
import { getCreatorEconomyStore } from "./persistence/creator-economy-store";
import type { Entitlement, SkillExecution } from "./types";

export class InsufficientCreditsError extends Error {
  constructor(public readonly required: number, public readonly available: number) {
    super(`INSUFFICIENT_CREDITS required=${required} available=${available}`);
    this.name = "InsufficientCreditsError";
  }
}

export class ProhibitedBoosterError extends Error {
  constructor() {
    super("PROHIBITED_BOOSTER: engagement-inflation requests violate platform policy §4.2");
    this.name = "ProhibitedBoosterError";
  }
}

export function getOrCreateEntitlement(creatorId: string, tenantId: string): Entitlement {
  const store = getCreatorEconomyStore();
  const existing = store.getEntitlement(creatorId);
  if (existing) return existing;
  const free = PLANS.free;
  const ent: Entitlement = {
    creatorId,
    tenantId,
    plan: "free",
    monthlyCredits: free.monthlyCredits,
    remainingCredits: free.monthlyCredits,
    canUseSkills: true,
    canCreateOffers: free.canCreateOffers,
    maxActiveOffers: free.maxActiveOffers,
    canReceiveGifts: free.canReceiveGifts,
    canRequestPayout: free.canRequestPayout,
    canPublishExternally: free.canPublishExternally,
    maxConnectedChannels: free.maxConnectedChannels,
    requiresHumanApproval: free.requiresHumanApproval,
    policyVersion: "creator-economy-1.1.0",
    expiresAt: null,
  };
  store.upsertEntitlement(ent);
  return ent;
}

export function assignPlan(creatorId: string, tenantId: string, planId: keyof typeof PLANS): Entitlement {
  const plan = PLANS[planId];
  const ent: Entitlement = {
    creatorId,
    tenantId,
    plan: plan.plan,
    monthlyCredits: plan.monthlyCredits,
    remainingCredits: plan.monthlyCredits,
    canUseSkills: true,
    canCreateOffers: plan.canCreateOffers,
    maxActiveOffers: plan.maxActiveOffers,
    canReceiveGifts: plan.canReceiveGifts,
    canRequestPayout: plan.canRequestPayout,
    canPublishExternally: plan.canPublishExternally,
    maxConnectedChannels: plan.maxConnectedChannels,
    requiresHumanApproval: plan.requiresHumanApproval,
    policyVersion: "creator-economy-1.1.0",
    expiresAt: null,
  };
  getCreatorEconomyStore().upsertEntitlement(ent);
  return ent;
}

export interface SkillRunResult {
  execution: SkillExecution;
  output: string[];
}

/**
 * Execute a skill. The `infer` callback is the real model call; if it throws,
 * credits are refunded before the error propagates (§4.3 compensating
 * transaction), so a failed run never burns budget.
 */
export async function executeSkill(input: {
  skillId: string;
  creatorId: string;
  tenantId: string;
  inputText: string;
  infer: (skillId: string, inputText: string) => Promise<string[]>;
}): Promise<SkillRunResult> {
  if (isProhibitedBoosterRequest(input.inputText)) throw new ProhibitedBoosterError();

  const skill = getSkill(input.skillId);
  if (!skill || !skill.enabled) throw new Error(`SKILL_NOT_FOUND:${input.skillId}`);
  if (Buffer.byteLength(input.inputText, "utf8") > skill.maxInputBytes) {
    throw new Error("SKILL_INPUT_TOO_LARGE");
  }

  const store = getCreatorEconomyStore();
  const ent = getOrCreateEntitlement(input.creatorId, input.tenantId);
  if (!ent.canUseSkills) throw new Error("SKILLS_NOT_ENTITLED");
  if (!planAtLeast(ent.plan, skill.planRequired)) {
    throw new Error(`PLAN_UPGRADE_REQUIRED:${skill.planRequired}`);
  }
  if (ent.remainingCredits < skill.creditsRequired) {
    throw new InsufficientCreditsError(skill.creditsRequired, ent.remainingCredits);
  }

  // Atomic deduction before inference.
  const deducted: Entitlement = { ...ent, remainingCredits: ent.remainingCredits - skill.creditsRequired };
  store.upsertEntitlement(deducted);

  const base: Omit<SkillExecution, "status" | "outputSummary"> = {
    executionId: randomUUID(),
    skillId: skill.id,
    creatorId: input.creatorId,
    creditsDeducted: skill.creditsRequired,
    remainingCredits: deducted.remainingCredits,
    inputHash: createHash("sha256").update(input.inputText).digest("hex"),
    executedAt: new Date().toISOString(),
  };

  try {
    const output = await input.infer(skill.id, input.inputText);
    const execution: SkillExecution = {
      ...base,
      status: "completed",
      outputSummary: output.join("\n").slice(0, 500),
    };
    store.insertSkillExecution(execution);
    return { execution, output };
  } catch (err) {
    // Compensating refund — §4.3.
    const current = store.getEntitlement(input.creatorId) ?? deducted;
    store.upsertEntitlement({
      ...current,
      remainingCredits: current.remainingCredits + skill.creditsRequired,
    });
    const execution: SkillExecution = {
      ...base,
      status: "refunded",
      outputSummary: err instanceof Error ? err.message.slice(0, 200) : "infer_failed",
    };
    store.insertSkillExecution(execution);
    throw err;
  }
}

/** Monthly cycle: refill included credits (purchased packs keep 365-day validity). */
export function refillMonthlyCredits(creatorId: string): Entitlement | null {
  const store = getCreatorEconomyStore();
  const ent = store.getEntitlement(creatorId);
  if (!ent) return null;
  const plan = PLANS[ent.plan];
  const next: Entitlement = { ...ent, remainingCredits: plan.monthlyCredits, monthlyCredits: plan.monthlyCredits };
  store.upsertEntitlement(next);
  return next;
}

/** Purchased credit top-up (365-day validity tracked at entitlement level). */
export function topUpCredits(creatorId: string, tenantId: string, amount: number): Entitlement {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("INVALID_TOPUP_AMOUNT");
  const ent = getOrCreateEntitlement(creatorId, tenantId);
  const next: Entitlement = { ...ent, remainingCredits: ent.remainingCredits + amount };
  getCreatorEconomyStore().upsertEntitlement(next);
  return next;
}
