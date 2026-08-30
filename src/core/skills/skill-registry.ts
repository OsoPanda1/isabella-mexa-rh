/**
 * ================================================================
 * ISABELLA VILLASEÑOR AI — SKILL REGISTRY (Module 5)
 * Versioned skill registration, discovery, and execution.
 * Skills are declarative capabilities that extend the agent without
 * modifying the core orchestrator.
 * ================================================================
 */
import { randomUUID } from "node:crypto";

export type SkillStatus = "registered" | "active" | "disabled" | "error";
export type SkillTrigger = "manual" | "cron" | "event" | "webhook";

export interface SkillParameter {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "object";
  readonly required: boolean;
  readonly default?: unknown;
  readonly description?: string;
}

export interface Skill {
  readonly skillId: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly category: string;
  readonly trigger: SkillTrigger;
  readonly parameters: SkillParameter[];
  readonly prompt: string;
  readonly allowedTools: string[];
  readonly riskLevel: "low" | "medium" | "high";
  readonly requiresConsent: boolean;
  status: SkillStatus;
  readonly createdAt: string;
  updatedAt: string;
}

export interface SkillExecution {
  readonly executionId: string;
  readonly skillId: string;
  readonly tenantId: string;
  readonly triggeredBy: string;
  readonly input: Record<string, unknown>;
  readonly result?: unknown;
  readonly error?: string;
  status: "running" | "completed" | "failed";
  readonly startedAt: string;
  completedAt?: string;
}

/* =========================================================================
   SKILL STORE
   ========================================================================= */

const skills = new Map<string, Skill>();
const executions = new Map<string, SkillExecution[]>();
const MAX_SKILLS = 100;

export function registerSkill(params: {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  trigger: SkillTrigger;
  parameters: SkillParameter[];
  prompt: string;
  allowedTools?: string[];
  riskLevel?: "low" | "medium" | "high";
  requiresConsent?: boolean;
}): Skill {
  const existing = Array.from(skills.values()).find((s) => s.name === params.name);
  if (existing) {
    const updated: Skill = {
      ...existing,
      version: params.version,
      description: params.description,
      prompt: params.prompt,
      updatedAt: new Date().toISOString(),
    };
    skills.set(existing.skillId, updated);
    return updated;
  }

  const skill: Skill = {
    skillId: randomUUID(),
    name: params.name,
    version: params.version,
    description: params.description,
    author: params.author,
    category: params.category,
    trigger: params.trigger,
    parameters: params.parameters,
    prompt: params.prompt,
    allowedTools: params.allowedTools || [],
    riskLevel: params.riskLevel || "low",
    requiresConsent: params.requiresConsent ?? false,
    status: "registered",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  skills.set(skill.skillId, skill);
  if (skills.size > MAX_SKILLS) {
    const oldest = skills.keys().next().value;
    if (oldest) skills.delete(oldest);
  }
  return skill;
}

export function getSkill(skillId: string): Skill | undefined {
  return skills.get(skillId);
}

export function getSkillByName(name: string): Skill | undefined {
  return Array.from(skills.values()).find((s) => s.name === name);
}

export function listSkills(category?: string): Skill[] {
  const all = Array.from(skills.values());
  if (category) return all.filter((s) => s.category === category);
  return all;
}

export function enableSkill(skillId: string): boolean {
  const skill = skills.get(skillId);
  if (!skill) return false;
  skill.status = "active";
  skill.updatedAt = new Date().toISOString();
  return true;
}

export function disableSkill(skillId: string): boolean {
  const skill = skills.get(skillId);
  if (!skill) return false;
  skill.status = "disabled";
  skill.updatedAt = new Date().toISOString();
  return true;
}

export function executeSkill(
  skillId: string,
  tenantId: string,
  triggeredBy: string,
  input: Record<string, unknown>,
): SkillExecution {
  const exec: SkillExecution = {
    executionId: randomUUID(),
    skillId,
    tenantId,
    triggeredBy,
    input,
    status: "running",
    startedAt: new Date().toISOString(),
  };

  const existing = executions.get(skillId) || [];
  existing.push(exec);
  executions.set(skillId, existing);
  return exec;
}

export function completeSkillExecution(
  skillId: string,
  executionId: string,
  result?: unknown,
  error?: string,
): void {
  const execs = executions.get(skillId);
  if (!execs) return;
  const exec = execs.find((e) => e.executionId === executionId);
  if (!exec) return;
  (exec as { status: SkillExecution["status"] }).status = error ? "failed" : "completed";
  (exec as { result?: unknown }).result = result;
  (exec as { error?: string }).error = error;
  (exec as { completedAt?: string }).completedAt = new Date().toISOString();
}

export function getSkillExecutions(skillId: string, limit = 20): SkillExecution[] {
  return (executions.get(skillId) || []).slice(-limit);
}
