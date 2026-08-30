import { z } from "zod";

/**
 * Zod Schema for strict payload validation (Hardening)
 * Prevents unauthorized data injection into the Cognitive / Gemini API layer.
 */
export const PerceptionSchema = z.object({
  sessionId: z.string().optional(),
  actorId: z.string().optional(),
  territoryId: z.string().optional(),
  inputType: z.enum(["chat", "event", "signal", "api", "ui"]).optional().default("chat"),
  text: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

/**
 * Zod Schema for Image Generation Validation
 */
export const ImageGenSchema = z.object({
  prompt: z.string().min(1).max(2000),
  style: z.string().optional().default("cyber_ethereal"),
  aspectRatio: z.string().optional().default("1:1")
});

/**
 * Zod Schema for Text-to-Speech Validation
 */
export const TTSSchema = z.object({
  text: z.string().min(1).max(5000),
  pitch: z.number().min(0.5).max(2.0).optional().default(1.05),
  rate: z.number().min(0.5).max(2.0).optional().default(1.0),
  timbre: z.enum(["calida", "directa", "cientifica"]).optional().default("calida")
});

/**
 * Zod Schema for General Cognitive Processing Validation
 */
export const CognitiveProcessSchema = z.object({
  input: z.string().min(1).max(50000),
  history: z.array(z.any()).optional().default([]),
  crownConfig: z.record(z.string(), z.any()).optional().default({}),
  activePreset: z.string().optional().default("prime")
});
