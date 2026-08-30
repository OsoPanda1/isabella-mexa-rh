/**
 * ================================================================
 * ISABELLA VILLASEÑOR AI — RUNTIME PROVIDER REGISTRY (Module 6)
 * LLM provider abstraction. Resolves which provider/model to use.
 * Sovereign engine is primary. Gemini is optional lazy fallback.
 * ================================================================
 */

import { inferSovereign } from "../../lib/isabella-inference-engine";

export interface InferenceRequest {
  readonly systemPrompt: string;
  readonly messages: Array<{ role: string; content: string }>;
  readonly tools?: string[];
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface InferenceResult {
  readonly text: string;
  readonly tokensUsed: number;
  readonly model: string;
  readonly provider: string;
  readonly toolCalls?: Array<{
    readonly name: string;
    readonly arguments: Record<string, unknown>;
  }>;
}

export interface RuntimeProvider {
  readonly name: string;
  readonly model: string;
  readonly contextWindowLimit: number;
  readonly supportsTools: boolean;
  readonly requiresApiKey: boolean;
  infer(req: InferenceRequest): Promise<InferenceResult>;
}

/* =========================================================================
   BUILT-IN PROVIDERS — Sovereign first, Gemini optional
   ========================================================================= */

class SovereignIsabellaProvider implements RuntimeProvider {
  readonly name = "isabella-sovereign";
  readonly model = "isabella-sovereign-v1";
  readonly contextWindowLimit = 32_000;
  readonly supportsTools = false;
  readonly requiresApiKey = false;

  async infer(req: InferenceRequest): Promise<InferenceResult> {
    const lastUser = req.messages.filter((m) => m.role === "user").pop();
    const input = lastUser?.content || "";

    const result = inferSovereign(input, {
      history: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const estimatedTokens = Math.ceil(
      (req.systemPrompt.length +
        req.messages.reduce((s, m) => s + m.content.length, 0) +
        result.reply.length) /
        3.5
    );

    return {
      text: result.reply,
      tokensUsed: Math.ceil(estimatedTokens),
      model: this.model,
      provider: this.name,
    };
  }
}

class GeminiProvider implements RuntimeProvider {
  readonly name = "gemini";
  readonly model = "gemini-3.7-flash";
  readonly contextWindowLimit = 1_000_000;
  readonly supportsTools = true;
  readonly requiresApiKey = true;

  async infer(req: InferenceRequest): Promise<InferenceResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        text: "Gemini no disponible (API key no configurada). Operando con motor soberano.",
        tokensUsed: 0,
        model: this.model,
        provider: this.name,
      };
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const genai = new GoogleGenAI({ apiKey });
      const contents = req.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const response = await genai.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: req.systemPrompt,
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxTokens ?? 4096,
        },
      });

      const text = response.text || "";
      const estimatedTokens = Math.ceil(
        (req.systemPrompt.length +
          req.messages.reduce((s, m) => s + m.content.length, 0) +
          text.length) /
          3.5
      );

      return {
        text,
        tokensUsed: Math.ceil(estimatedTokens),
        model: this.model,
        provider: this.name,
      };
    } catch {
      return {
        text: "Error en la inferencia con Gemini. Operando con motor soberano.",
        tokensUsed: 0,
        model: this.model,
        provider: this.name,
      };
    }
  }
}

/* =========================================================================
   PROVIDER REGISTRY — Sovereign is default
   ========================================================================= */

const providers: RuntimeProvider[] = [
  new SovereignIsabellaProvider(),
  new GeminiProvider(),
];

export function registerProvider(provider: RuntimeProvider): void {
  const idx = providers.findIndex((p) => p.name === provider.name);
  if (idx >= 0) providers[idx] = provider;
  else providers.unshift(provider);
}

export function resolveRuntimeProvider(preferred?: string): RuntimeProvider {
  if (preferred) {
    const match = providers.find((p) => p.name === preferred);
    if (match) return match;
  }

  // Sovereign is always first choice — no API key needed
  const sovereign = providers.find((p) => p.name === "isabella-sovereign");
  if (sovereign) return sovereign;

  // Gemini only if API key is present
  if (process.env.GEMINI_API_KEY) {
    const gemini = providers.find((p) => p.name === "gemini");
    if (gemini) return gemini;
  }

  // Ultimate fallback
  return providers[0];
}

export function listProviders(): Array<{ name: string; model: string; available: boolean }> {
  return providers.map((p) => ({
    name: p.name,
    model: p.model,
    available: p.name === "isabella-sovereign" || (p.requiresApiKey ? !!process.env.GEMINI_API_KEY : true),
  }));
}
