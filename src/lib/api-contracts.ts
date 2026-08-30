import { z } from "zod/v4";

// ─────────────────────────────────────────────────────────────
// STANDARDIZED RESPONSE ENVELOPE
// Every API endpoint returns this shape: { ok, data?, error? }
// ─────────────────────────────────────────────────────────────
export interface ApiOk<T = unknown> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  ok: false;
  error: { code: string; message: string; traceId?: string };
}

export type ApiResponse<T = unknown> = ApiOk<T> | ApiError;

export function apiOk<T>(data: T, meta?: Record<string, unknown>): ApiOk<T> {
  return { ok: true, data, ...(meta ? { meta } : {}) };
}

export function apiError(code: string, message: string, traceId?: string): ApiError {
  return { ok: false, error: { code, message, ...(traceId ? { traceId } : {}) } };
}

// ─────────────────────────────────────────────────────────────
// ZOD VALIDATION CONTRACTS FOR POST BODIES
// ─────────────────────────────────────────────────────────────

export const PerceptionInputSchema = z.object({
  sessionId: z.string().max(256).optional(),
  territoryId: z.string().max(128).optional(),
  inputType: z.enum(["chat", "event", "signal", "api", "ui"]).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  text: z.string().max(50000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().max(64).optional(),
});

export const CognitiveProcessSchema = z.object({
  input: z.string().min(1).max(50000),
  history: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).max(50).optional(),
  crownConfig: z.record(z.string(), z.number().min(0).max(1)).optional(),
  activePreset: z.enum(["prime", "empathic", "strategic", "sentinel", "executor", "synergistic"]).optional(),
  sessionId: z.string().max(256).optional(),
});

export const ImageGenSchema = z.object({
  prompt: z.string().min(1).max(10000),
  style: z.string().max(64).optional(),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3"]).optional(),
});

export const TTSSchema = z.object({
  text: z.string().min(1).max(4000),
  pitch: z.number().min(0.5).max(2.0).optional(),
  rate: z.number().min(0.5).max(2.0).optional(),
  timbre: z.string().max(32).optional(),
});

export const AgentLeaseSchema = z.object({
  leaseDurationMinutes: z.number().int().min(1).max(480).optional(),
  systemInstructions: z.string().max(10000).optional(),
  activePreset: z.string().max(64).optional(),
  primaryModel: z.string().max(128).optional(),
});

export const AgentChatSchema = z.object({
  sessionId: z.string().min(1).max(256),
  prompt: z.string().min(1).max(50000),
  contextPayload: z.record(z.string(), z.unknown()).optional(),
});

export const IdlenClickSchema = z.object({
  adId: z.string().min(1).max(256),
  publisherId: z.string().min(1).max(256),
  requestId: z.string().min(1).max(256),
});

export const CheckoutSchema = z.object({
  planId: z.string().max(64).optional(),
  plan: z.string().max(64).optional(),
});

export const QuantumExecuteSchema = z.object({
  provider: z.string().max(128).optional(),
  repository: z.string().max(256).optional(),
  mode: z.enum(["analytic", "sampled"]).optional(),
  wires: z.number().int().min(1).max(40).optional(),
  shots: z.number().int().min(1).max(100000).nullable().optional(),
  features: z.array(z.number()).max(100).optional(),
  weights: z.array(z.number()).max(100).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

// ─────────────────────────────────────────────────────────────
// VALIDATION HELPER — returns parsed body or sends 400
// ─────────────────────────────────────────────────────────────
import type { Request, Response } from "express";

export function validateBody<T>(schema: z.ZodType<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    res.status(400).json(apiError("VALIDATION_ERROR", `Invalid request body: ${issues}`));
    return null;
  }
  return result.data;
}
