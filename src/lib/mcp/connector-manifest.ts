/* ==== Connector Manifest — identidad y permisos declarados de una integración externa (CIX) ==== */
/**
 * Cada integración externa (MCP server, proveedor de modelos, social, search,
 * payments, voice) se matricula con un ConnectorManifest que declara de forma
 * estática: identidad, versión, scopes necesarios, clasificación de datos que
 * es capaz de manejar y el contrato de red/egress permitido.
 *
 * Invariante: el manifest es una declaración, NO una autorización. La
 * autorización efectiva se decide en tiempo de llamada por el registry
 * (scopes firmados + rate-limit + circuit breaker + revocación).
 */
import { z } from "zod";
import type { DataClass } from "../claim-radar/contracts";

export const FailurePolicySchema = z.enum([
  "fail-fast", // rechaza la llamada si el conector no está sano
  "fallback",  // degrada a un conector de respaldo antes de fallar
  "quarantine",// abre el circuito y aísla el conector
]);
export type FailurePolicy = z.infer<typeof FailurePolicySchema>;

export const NetworkModeSchema = z.enum(["deny-all", "allowlist", "open"]);
export type NetworkMode = z.infer<typeof NetworkModeSchema>;

export const ConnectorManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
  name: z.string().min(1).max(128),
  version: z.string().max(32),
  kind: z.enum(["mcp", "model-provider", "social", "search", "payments", "voice", "database", "quantum"]),
  // Scopes granulares que el conector puede ejercer (nunca "*").
  scopes: z.array(z.string().min(1).max(128)).min(1),
  // Clasificación de datos máxima que el conector puede recibir.
  allowedDataClasses: z.array(z.enum(["public", "internal", "confidential", "restricted"])).min(1),
  // Contrato de red del conector.
  network: z.object({
    mode: NetworkModeSchema,
    hosts: z.array(z.string().max(256)).default([]),
  }),
  // Política de fallo ante errores repetidos.
  failurePolicy: FailurePolicySchema.default("fail-fast"),
  timeout: z.object({
    connectMs: z.number().int().min(100).max(30_000).default(3_000),
    requestMs: z.number().int().min(200).max(120_000).default(5_000),
  }).default({ connectMs: 3_000, requestMs: 5_000 }),
  // Rate limit propio del conector (por tenancy + subject).
  rateLimit: z.object({
    windowMs: z.number().int().min(1_000).max(3_600_000).default(60_000),
    maxCalls: z.number().int().min(1).max(100_000).default(60),
  }).default({ windowMs: 60_000, maxCalls: 60 }),
  // Umbral del circuit breaker propio del conector.
  circuit: z.object({
    threshold: z.number().int().min(1).max(100).default(5),
    resetMs: z.number().int().min(1_000).max(300_000).default(30_000),
    halfOpenRequests: z.number().int().min(1).max(10).default(1),
  }).default({ threshold: 5, resetMs: 30_000, halfOpenRequests: 1 }),
  // Autenticación requerida para operar el conector.
  auth: z.object({
    oauth: z.boolean().default(false),
    clientIdHint: z.string().max(128).optional(),
  }).default({ oauth: false }),
  revoked: z.boolean().default(false).describe("REVOKED — bloquea toda llamada posterior"),
});
export type ConnectorManifest = z.infer<typeof ConnectorManifestSchema>;

export type RequiredScope = string;

/**
 * Valida que un manifest sea estructuralmente correcto y seguro antes de
 * registrarlo. Rechaza manifests que pretendan scope "*" (must be granular).
 */
export function validateManifest(raw: unknown): ConnectorManifest {
  const parsed = ConnectorManifestSchema.parse(raw);
  if (parsed.scopes.includes("*")) {
    throw new Error(`connector manifest ${parsed.id} declares wildcard scope — scopes must be granular`);
  }
  return parsed;
}

export function manifestAllowsDataClass(manifest: ConnectorManifest, dataClass: DataClass): boolean {
  return manifest.allowedDataClasses.includes(dataClass);
}
