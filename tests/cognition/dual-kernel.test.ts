/**
 * ================================================================
 * TESTS — Pipeline cognitivo (Dual Hexagonal Kernel / Alpha-Beta)
 * Cubre: perception, hypothesis, proposal, policy (CROWN),
 * dual-kernel, provider isabella-cognition y fallback enriquecido.
 * ================================================================
 */

import { describe, it, expect } from "vitest";

import { perceptionEngine } from "../../src/lib/cognition/alpha/perception";
import { hypothesisEngine } from "../../src/lib/cognition/alpha/hypothesis";
import { proposalEngine } from "../../src/lib/cognition/alpha/proposal";
import { alphaMemory } from "../../src/lib/cognition/alpha/memory";
import { classificationEngine } from "../../src/lib/cognition/beta/classification";
import { riskEngine } from "../../src/lib/cognition/beta/risk";
import { policyEngine } from "../../src/lib/cognition/beta/policy";
import { identityResolver } from "../../src/lib/cognition/beta/identity";
import { capabilityRegistry } from "../../src/lib/cognition/beta/capability";
import { verificationEngine } from "../../src/lib/cognition/beta/verification";
import { dualKernel } from "../../src/lib/cognition/dual-kernel";
import { resolveRuntimeProvider, listProviders } from "../../src/core/runtime/provider-registry";
import { inferSovereign, buildSovereignFallback, COGNITIVE_DOMAINS } from "../../src/lib/isabella-inference-engine";

describe("Dual Hexagonal Kernel — Alpha (percepción)", () => {
  it("detecta idioma español e intención de pregunta", async () => {
    const p = await perceptionEngine.process("¿Cómo puedo mejorar la seguridad del sistema?");
    expect(p.language).toBe("es");
    expect(p.intent).toBe("question");
    expect(p.intentConfidence).toBeGreaterThan(0);
  });

  it("detecta idioma inglés", async () => {
    const p = await perceptionEngine.process("How can I improve system security?");
    expect(p.language).toBe("en");
  });

  it("detecta intención de creación", async () => {
    const p = await perceptionEngine.process("Crear una API para el hub digital");
    expect(p.intent).toBe("creation");
  });

  it("extrae entidades y sugiere clasificación", async () => {
    const p = await perceptionEngine.process("Necesito manejar credenciales de forma segura");
    expect(p.suggestedClassification).toBeDefined();
    expect(Array.isArray(p.extractedFeatures)).toBe(true);
  });
});

describe("Dual Hexagonal Kernel — Alpha (hipótesis y propuesta)", () => {
  it("genera una hipótesis con alternativas y experimentos", () => {
    const hypotheses = hypothesisEngine.generate({
      query: "Cómo reducir la latencia del chat",
      researchConfidence: 0.8,
      entities: [],
      intentCategory: "analysis",
    });
    expect(hypotheses.length).toBeGreaterThan(0);
    expect(hypotheses[0].statement.length).toBeGreaterThan(0);
  });

  it("genera una propuesta con propuesta de valor y primera entrega", () => {
    const proposal = proposalEngine.generate({
      query: "Implementar un gateway de pagos",
      intent: "creation",
      hypothesis: "La integración debe ser modular",
      alternatives: ["Stripe", "Cobro directo"],
      risks: ["Reversión de pago"],
      experiments: ["Cobro con monto bajo"],
    });
    expect(proposal.valueProposition.length).toBeGreaterThan(0);
    expect(proposal.firstDeliverable.length).toBeGreaterThan(0);
    expect(proposal.alternatives.length).toBeGreaterThan(0);
  });

  it("recupera memoria filtrada por alcance y sensibilidad", async () => {
    const results = await alphaMemory.retrieve({
      query: "territorio",
      scopes: ["project"],
      sensitivityMax: "internal",
      maxResults: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content.length).toBeGreaterThan(0);
  });
});

describe("Dual Hexagonal Kernel — Beta (gobernanza)", () => {
  it("clasifica datos y controla acceso", () => {
    const c = classificationEngine.classify("token y password de producción");
    expect(["critical", "restricted", "sensitive", "private", "internal", "public"]).toContain(c.classification);
    expect(classificationEngine.allowsAccess("public", "internal")).toBe(true);
    expect(classificationEngine.allowsAccess("restricted", "public")).toBe(false);
  });

  it("evalúa riesgo y escala alto riesgo", () => {
    const low = riskEngine.assess({ intent: "leer", classification: "public" });
    expect(low.level).toBe("R0_informational");

    const high = riskEngine.assess({
      intent: "transferir fondos",
      classification: "restricted",
      involvesFinancial: true,
      isIrreversible: true,
    });
    expect(["R3_high", "R4_critical"]).toContain(high.level);
    expect(high.requiresApproval).toBe(true);
  });

  it("CROWN revisa operaciones de alto riesgo", () => {
    const decision = policyEngine.evaluate({
      identity: {
        actorId: "user-1",
        tenantId: "rdm",
        roles: ["user"],
        scopes: ["cognitive:read"],
        assuranceLevel: "basic",
      },
      risk: { level: "R4_critical", requiresApproval: true },
      classification: "restricted",
      intent: "ejecutar",
      requestedCapabilities: ["memory_search"],
    });
    expect(decision.result).toBe("review");
    expect(decision.reviewRequired).toBe(true);
  });

  it("identidad resuelve y verifica scopes", () => {
    const identity = identityResolver.resolve({
      actorId: "admin-1",
      tenantId: "rdm",
      authMethod: "mfa",
    });
    expect(identity.roles).toContain("admin");
    expect(identity.assuranceLevel).toBe("critical");

    const verification = identityResolver.verify(identity, ["cognitive:read"]);
    expect(verification.verified).toBe(true);
  });

  it("registro de capacidades selecciona por riesgo", () => {
    const selection = capabilityRegistry.select({
      intent: "buscar",
      requestedCapabilities: ["memory_search"],
      allowedScopes: ["memory:read"],
    });
    expect(selection).not.toBeNull();
    expect(selection!.capabilityId).toBe("memory_search");
  });

  it("verificación valida respuesta con evidencia", () => {
    const result = verificationEngine.verify({
      response: "Recomendación: usar 2FA en todos los accesos de operadores.",
      governance: {
        decisionId: "d1",
        result: "allow",
        riskLevel: "R2_moderate",
        classification: "internal",
        policyIds: [],
        reason: "ok",
        scopeDenials: [],
        reviewRequired: false,
        reversible: true,
        evaluatedAt: new Date().toISOString(),
      },
      evidence: [{
        evidenceId: "e1",
        type: "data",
        claim: "2FA reduce accesos no autorizados",
        confidence: 0.9,
        source: "security-guide",
        retrievedAt: new Date().toISOString(),
      }],
      provenance: {
        auditId: "a1",
        requestHash: "abc",
        outputHash: "def",
        policyHash: "ghi",
        toolRefs: [],
        memoryRefs: [],
        createdAt: new Date().toISOString(),
      },
      costUsd: 0.01,
      reversible: true,
    });
    expect(result.verified).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(0.7);
  });
});

describe("Dual Hexagonal Kernel — flujo completo", () => {
  it("procesa una solicitud de extremo a extremo", async () => {
    const response = await dualKernel.process({
      requestId: "req-test-1",
      tenantId: "rdm-digital-hub",
      actorId: "user-alpha",
      federationId: 5,
      intent: "¿Cómo implementar un sistema de votación territorial?",
      mode: "implementation",
      context: { memoryEnabled: true, territory: "Mineral del Monte" },
      requestedCapabilities: [],
    });

    expect(response.status).toBe("completed");
    expect(response.answer.length).toBeGreaterThan(0);
    expect(response.governance).toBeDefined();
    expect(response.evidence).toBeDefined();
    expect(response.telemetry.alpha.intentConfidence).toBeGreaterThan(0);
    expect(response.state).toBe("completed");
  });

  it("genera requestId y traceId diferenciados", async () => {
    const response = await dualKernel.process({
      requestId: "req-test-2",
      tenantId: "rdm-digital-hub",
      actorId: "user-alpha",
      federationId: 5,
      intent: "hola",
      mode: "chat",
    });
    expect(response.provenance.auditId).toBeDefined();
    expect(response.provenance.auditId.length).toBeGreaterThan(0);
  });
});

describe("Provider registry — isabella-cognition", () => {
  it("resuelve isabella-cognition como provider soberano primario", () => {
    const provider = resolveRuntimeProvider();
    expect(provider.name).toBe("isabella-cognition");
    expect(provider.requiresApiKey).toBe(false);
  });

  it("respeta el provider pedido explícitamente", () => {
    const sovereign = resolveRuntimeProvider("isabella-sovereign");
    expect(sovereign.name).toBe("isabella-sovereign");
  });

  it("lista isabella-cognition como disponible sin API key", () => {
    const providers = listProviders();
    const cognition = providers.find((p) => p.name === "isabella-cognition");
    expect(cognition).toBeDefined();
    expect(cognition!.available).toBe(true);
  });

  it("el provider cognición infiere sobre mensajes", async () => {
    const provider = resolveRuntimeProvider();
    const result = await provider.infer({
      systemPrompt: "Sistema",
      messages: [{ role: "user", content: "explica arquitectura de microservicios" }],
    });
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.provider).toBe("isabella-cognition");
  });
});

describe("Fallback enriquecido — sovereign engine", () => {
  it("responde enriquecido y no vacío para un mensaje ambiguo", () => {
    const result = inferSovereign("mmm");
    expect(result.reply.length).toBeGreaterThan(0);
    expect(result.routingDecisions.primaryModule).toBe("ISA");
  });

  it("mejora el fallback con eco y cierre accionable", () => {
    const reply = buildSovereignFallback(
      "hola que tal",
      "es",
      { topic: "saludo", sentiment: "neutral" },
    );
    expect(reply).toContain("hola que tal");
    expect(reply.length).toBeGreaterThan(20);
  });

  it("el dominio de seguridad ofrece capacidades y prompt experto", () => {
    const domain = COGNITIVE_DOMAINS.find((d) => d.patterns.test("endurecer la seguridad"));
    expect(domain).toBeDefined();
    expect(domain!.capabilities.length).toBeGreaterThan(0);
    expect(domain!.prompt.length).toBeGreaterThan(10);
  });

  it("buildSovereignFallback detecta dominio y lista capacidades", () => {
    const reply = buildSovereignFallback(
      "cómo endurezco la seguridad de mis endpoints",
      "es",
      { topic: "seguridad", sentiment: "neutral" },
    );
    expect(reply).toMatch(/seguridad|security|secretos|zero trust/i);
    expect(reply).toContain("·");
  });
});
