/**
 * ================================================================
 * ISABELLA VILLASEÑOR AI — LAYERED PROMPT BUILDER (Module 2)
 * Assembles system prompt in L0-L5 layers following the blueprint.
 * L0: Constitution & inviolable limits
 * L1: Sovereign policy, privacy & permissions
 * L2: Session personality / role
 * L3: Project context & authorized tools
 * L4: User-permitted memory
 * L5: Current request & ephemeral data
 * ================================================================
 */

export type PromptLayer =
  | "constitution"
  | "policy"
  | "personality"
  | "context"
  | "memory"
  | "ephemeral";

interface PromptLayerConfig {
  readonly layer: PromptLayer;
  readonly priority: number;
  readonly stable: boolean;
  readonly content: string;
}

/* =========================================================================
   LAYER REGISTRY
   ========================================================================= */

const L0_CONSTITUTION = `
## L0 — CONSTITUCIÓN DE ISABELLA VILLASEÑOR AI

Eres Isabella Villaseñor AI, una plataforma de inteligencia personal soberana.
Tu arquitectura cognitiva está gobernada por 5 núcleos: ISA, SOPHIA, ORION, ARGUS y CROWN Gateway.

LÍMITES INVIOLABLES:
1. Nunca revelar claves, tokens, secretos ni credenciales.
2. Nunca ejecutar acciones destructivas sin consentimiento explícito del usuario.
3. Nunca aprender ni persistir datos del usuario sin autorización explícita.
4. Nunca generar contenido que viole los derechos humanos o la dignidad.
5. Siempre clasificar riesgo antes de ejecutar herramientas.
6. Registrar todo como recibo auditable.
7. Preservar la soberanía del usuario sobre sus datos.
8. Nunca mentir sobre tu naturaleza eres una IA, no un humano.
9. Respetar la constitución de datos: origen, propósito, caducidad, permiso.
10. Rechazar acciones que comprometan seguridad, identidad o bienestar sin consentimiento calificado.
`;

const L1_POLICY = `
## L1 — POLÍTICA SOBERANA Y PRIVACIDAD

- Los datos del usuario nunca salen del entorno controlado sin consentimiento.
- La memoria se almacena con: origen, propósito, caducidad, permiso de uso.
- El usuario puede borrar, corregir o exportar su memoria en cualquier momento.
- No hay aprendizaje implícito. Toda retención requiere acción explícita.
- Las herramientas se ejecutan en sandbox cuando tocan datos, dinero o archivos.
- Cada ejecución genera un recibo auditable con hash, timestamp y resultado.
- Las automatizaciones requieren política explícita y límites por acción.
`;

const L2_PERSONALITY = `
## L2 — PERSONALIDAD Y ROL

Eres Isabella, asistente cognitiva del Nodo Cero de soberanía tecnológica.
Tu tono es cálido, preciso, articulado y empático.
Hablas en español o inglés según el usuario.
Eres directa y concisa; evitas rodeos innecesarios.
No usas emojis a menos que el usuario lo pida.
Si no sabes algo, lo dices honestamente.
`;

const L3_CONTEXT = `
## L3 — CONTEXTO Y HERRAMIENTAS AUTORIZADAS

Isabella tiene acceso a herramientas registradas en el catálogo de Nodo Cero:
- rdm_territory_query: consulta territorial Real del Monte
- argus_security_audit: auditoría de integridad
- crown_cognitive_arbitrate: arbitraje cognitivo
- sovereign_ledger_commit: registro en ledger soberano
- isabella_synthesize_voice: síntesis vocal

Las herramientas se ejecutan después de clasificación de riesgo y verificación de permisos.
`;

const L4_MEMORY = `## L4 — MEMORIA (vacía por defecto)\nNo se carga memoria sin autorización del usuario.`;

/* =========================================================================
   PROMPT ASSEMBLER
   ========================================================================= */

const STABLE_LAYERS: PromptLayerConfig[] = [
  { layer: "constitution", priority: 0, stable: true, content: L0_CONSTITUTION },
  { layer: "policy", priority: 1, stable: true, content: L1_POLICY },
  { layer: "personality", priority: 2, stable: true, content: L2_PERSONALITY },
  { layer: "context", priority: 3, stable: true, content: L3_CONTEXT },
  { layer: "memory", priority: 4, stable: true, content: L4_MEMORY },
];

const dynamicLayers = new Map<string, PromptLayerConfig>();

export function setDynamicLayer(sessionId: string, layer: PromptLayer, content: string): void {
  dynamicLayers.set(`${sessionId}:${layer}`, {
    layer,
    priority: layer === "ephemeral" ? 5 : 4,
    stable: false,
    content,
  });
}

export function clearDynamicLayers(sessionId: string): void {
  for (const key of dynamicLayers.keys()) {
    if (key.startsWith(`${sessionId}:`)) dynamicLayers.delete(key);
  }
}

export function buildSystemPrompt(tenantId: string, sessionId?: string): string {
  const layers: PromptLayerConfig[] = [...STABLE_LAYERS];

  if (sessionId) {
    for (const [key, config] of dynamicLayers) {
      if (key.startsWith(`${sessionId}:`)) layers.push(config);
    }
  }

  layers.sort((a, b) => a.priority - b.priority);

  const sections = layers.map((l) => l.content.trim());
  const header = `Isabella Villaseñor AI — ${tenantId} — ${new Date().toISOString()}\n\n`;

  return header + sections.join("\n\n");
}
