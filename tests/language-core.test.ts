/**
 * Tests: Isabella Language Core
 *
 * The native semantic layer must be deterministic, bilingual, honest
 * about uncertainty, and conservative when polishing sovereign replies.
 */
import { describe, it, expect } from "vitest";
import { classifyIntent, buildLanguageDirectives, sophisticateReply } from "../src/lib/language/language-core";

describe("classifyIntent", () => {
  it("classifies Spanish greetings as empathic warm", () => {
    const profile = classifyIntent("¡Hola, buenas tardes!");
    expect(profile.intent).toBe("greeting");
    expect(profile.language).toBe("es");
    expect(profile.recommendedPreset).toBe("empathic");
    expect(profile.register).toBe("warm");
  });

  it("classifies security questions and routes to sentinel", () => {
    const profile = classifyIntent("¿Qué tan seguro es el sistema ante un ataque de prompt injection y XSS?");
    expect(profile.intent).toBe("security");
    expect(profile.recommendedPreset).toBe("sentinel");
    expect(profile.confidence).toBeGreaterThanOrEqual(0.35);
  });

  it("classifies billing in English and keeps language=en", () => {
    const profile = classifyIntent("How do I cancel my subscription and get an invoice?");
    expect(profile.intent).toBe("billing");
    expect(profile.language).toBe("en");
  });

  it("recognizes territorial grounding and extracts entities", () => {
    const profile = classifyIntent("¿Qué es Nodo Cero en Real del Monte, Hidalgo?");
    expect(profile.intent).toBe("territory");
    expect(profile.entities).toContain("nodo cero");
    expect(profile.entities).toContain("real del monte");
  });

  it("never fabricates: unknown input degrades to general with low confidence", () => {
    const profile = classifyIntent("zzzz qqq ppp");
    expect(profile.intent).toBe("general");
    expect(profile.confidence).toBeLessThan(0.6);
  });

  it("is deterministic for identical input", () => {
    expect(classifyIntent("hola")).toEqual(classifyIntent("hola"));
  });

  it("detects code tasks and routes to strategic", () => {
    const profile = classifyIntent("Corrige el bug en esta función de TypeScript");
    expect(profile.intent).toBe("code_task");
    expect(profile.recommendedPreset).toBe("strategic");
  });
});

describe("buildLanguageDirectives", () => {
  it("includes persona, intent, register and grounding contract", () => {
    const profile = classifyIntent("quién eres");
    const directives = buildLanguageDirectives(profile);
    expect(directives).toContain("Isabella Villaseñor AI");
    expect(directives).toContain("identity");
    expect(directives).toContain("never fabricate");
    expect(directives).toContain("español mexicano");
  });

  it("lists extracted entities when present", () => {
    const profile = classifyIntent("cuéntame del módulo ARGUS");
    const directives = buildLanguageDirectives(profile);
    expect(directives).toContain("argus");
  });
});

describe("sophisticateReply", () => {
  it("never alters code fences", () => {
    const profile = classifyIntent("hola");
    const code = "```ts\nconst importante = 'realmente';\n```";
    const out = sophisticateReply(`Esto es importante.\n\n${code}`, profile);
    expect(out).toContain("const importante = 'realmente';");
    expect(out).not.toContain("genuinamente = ");
  });

  it("refines Spanish prose lexicon", () => {
    const profile = classifyIntent("hola");
    const out = sophisticateReply("Esto es realmente importante.", profile);
    expect(out).toContain("genuinamente");
    expect(out).toContain("trascendente");
  });

  it("appends one dignified closing line", () => {
    const profile = classifyIntent("hola");
    const out = sophisticateReply("Aquí está la respuesta.", profile);
    const closings = ["¿Deseas profundizar", "Estoy a tu disposición", "¿Continuamos?"];
    expect(closings.some((c) => out.includes(c))).toBe(true);
  });

  it("does not double-close replies already ending in a question", () => {
    const profile = classifyIntent("hola");
    const out = sophisticateReply("¿Te gustó?", profile);
    expect(out.trimEnd().endsWith("?")).toBe(true);
    expect(out).not.toContain("¿Continuamos?");
  });
});
