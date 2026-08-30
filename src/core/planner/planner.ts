/**
 * ================================================================
 * ISABELLA VILLASEÑOR AI — PLANNER (Module 4)
 * Plan creation, step management, recovery strategies.
 * ================================================================
 */
import { randomUUID } from "node:crypto";

export type PlanStatus = "draft" | "active" | "paused" | "completed" | "failed" | "recovery";
export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type RecoveryStrategy = "retry" | "skip" | "abort" | "fallback" | "human";

export interface PlanStep {
  readonly stepId: string;
  readonly name: string;
  readonly description: string;
  readonly action: string;
  readonly toolName?: string;
  readonly args?: Record<string, unknown>;
  status: StepStatus;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  maxRetries: number;
  recoveryStrategy: RecoveryStrategy;
}

export interface Plan {
  readonly planId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly name: string;
  readonly description: string;
  readonly goal: string;
  status: PlanStatus;
  steps: PlanStep[];
  readonly createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/* =========================================================================
   PLAN STORE
   ========================================================================= */

const plans = new Map<string, Plan>();
const MAX_PLANS = 200;

export function createPlan(params: {
  tenantId: string;
  userId: string;
  name: string;
  description: string;
  goal: string;
  steps: Array<{
    name: string;
    description: string;
    action: string;
    toolName?: string;
    args?: Record<string, unknown>;
    recoveryStrategy?: RecoveryStrategy;
    maxRetries?: number;
  }>;
}): Plan {
  const plan: Plan = {
    planId: randomUUID(),
    tenantId: params.tenantId,
    userId: params.userId,
    name: params.name,
    description: params.description,
    goal: params.goal,
    status: "draft",
    steps: params.steps.map((s, i) => ({
      stepId: `step-${i + 1}-${randomUUID().slice(0, 8)}`,
      name: s.name,
      description: s.description,
      action: s.action,
      toolName: s.toolName,
      args: s.args,
      status: "pending" as StepStatus,
      retryCount: 0,
      maxRetries: s.maxRetries ?? 3,
      recoveryStrategy: s.recoveryStrategy ?? "retry",
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  plans.set(plan.planId, plan);
  if (plans.size > MAX_PLANS) {
    const oldest = plans.keys().next().value;
    if (oldest) plans.delete(oldest);
  }
  return plan;
}

export function getPlan(planId: string): Plan | undefined {
  return plans.get(planId);
}

export function listPlans(tenantId: string): Plan[] {
  return Array.from(plans.values()).filter((p) => p.tenantId === tenantId);
}

export function activatePlan(planId: string): Plan | undefined {
  const plan = plans.get(planId);
  if (!plan) return undefined;
  plan.status = "active";
  plan.updatedAt = new Date().toISOString();
  return plan;
}

export function executePlanStep(
  planId: string,
  stepId: string,
  executor: (step: PlanStep) => Promise<unknown>,
): Promise<{ step: PlanStep; planStatus: PlanStatus } | undefined> {
  const plan = plans.get(planId);
  if (!plan) return Promise.resolve(undefined);

  const step = plan.steps.find((s) => s.stepId === stepId);
  if (!step) return Promise.resolve(undefined);

  step.status = "running";
  step.startedAt = new Date().toISOString();

  return executor(step)
    .then((result) => {
      step.status = "completed";
      step.result = result;
      step.completedAt = new Date().toISOString();

      const allDone = plan.steps.every((s) => s.status === "completed" || s.status === "skipped");
      if (allDone) {
        plan.status = "completed";
        plan.completedAt = new Date().toISOString();
      }

      plan.updatedAt = new Date().toISOString();
      return { step, planStatus: plan.status };
    })
    .catch((err) => {
      step.error = String(err);
      step.retryCount++;

      if (step.retryCount < step.maxRetries && step.recoveryStrategy === "retry") {
        step.status = "pending";
        plan.status = "recovery";
      } else if (step.recoveryStrategy === "skip") {
        step.status = "skipped";
      } else {
        step.status = "failed";
        plan.status = "failed";
      }

      plan.updatedAt = new Date().toISOString();
      return { step, planStatus: plan.status };
    });
}

export function deletePlan(planId: string): boolean {
  return plans.delete(planId);
}
