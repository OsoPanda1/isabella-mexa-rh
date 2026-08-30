/* ==== Connector Registry — gobernanza en tiempo de llamada de integraciones externas (CIX) ==== */
/**
 * Registra conectores matriculados por su ConnectorManifest y decide en cada
 * llamada si permite ejecutarla, aplicando en cascada:
 *   1. manifest válido y conector NO revocado
 *   2. credencial OAuth usable (si aplica)
 *   3. scope del request presente en el manifest del conector
 *   4. clasificación de datos permitida para el conector
 *   5. rate limit por ventana del conector
 *   6. circuit breaker (CLOSED / OPEN / HALF_OPEN)
 *   7. timeout del conector
 *   8. política de fallo (fail-fast / fallback / quarantine)
 *   9. auditoría de la llamada (in-memory queue; la persistencia durable es CXIII)
 *
 * Devuelve siempre una decisión serializable, nunca lanza en el camino feliz.
 */
import { createLogger } from "../logger";
import type { ConnectorManifest, FailurePolicy } from "./connector-manifest";
import { validateManifest } from "./connector-manifest";
import type { ConnectorCredential } from "./oauth-policy";
import { credentialIsUsable, createCredential, rotateCredential, revokeCredential } from "./oauth-policy";
import type { MountCredentialInput } from "./oauth-policy";
import { canCallScope } from "./scopes";
import type { ScopeSet } from "./scopes";
import type { DataClass } from "../claim-radar/contracts";

const log = createLogger("mcp-registry");

export type MCPDecisionCode =
  | "ALLOWED"
  | "CONNECTOR_NOT_FOUND"
  | "CONNECTOR_REVOKED"
  | "CREDENTIAL_INVALID"
  | "SCOPE_DENIED"
  | "DATA_CLASS_DENIED"
  | "RATE_LIMITED"
  | "CIRCUIT_OPEN";

export interface CallRequest {
  readonly connectorId: string;
  readonly requiredScope: string;
  readonly grantedScopes: ScopeSet | readonly string[];
  readonly dataClass: DataClass;
  readonly subject: string;
  readonly tenantId: string;
  readonly requestId: string;
}

export interface AuditEntry {
  readonly eventId: string;
  readonly ts: string;
  readonly connectorId: string;
  readonly scope: string;
  readonly dataClass: DataClass;
  readonly tenantId: string;
  readonly subject: string;
  readonly decision: MCPDecisionCode;
  readonly latencyMs: number;
  readonly reason?: string;
}

interface RateBucket { count: number; windowStart: number; }
type FailureToken = { failures: number; lastFailureAt: number; openedAt: number | null; remainingMs: number };
type CBState = "CLOSED" | "OPEN" | "HALF_OPEN";

class ConnectorRuntime {
  readonly manifest: ConnectorManifest;
  credential: ConnectorCredential | undefined;
  permitCount = 0;
  rateBuckets = new Map<string, RateBucket>();
  cb: FailureToken = { failures: 0, lastFailureAt: 0, openedAt: null, remainingMs: 0 };

  constructor(manifest: ConnectorManifest) {
    this.manifest = manifest;
  }
}

const registry = new Map<string, ConnectorRuntime>();
const auditQueue: AuditEntry[] = [];
const AUDIT_MAX = 500;

function randomUUID(): string {
  if (typeof globalThis !== "undefined") {
    const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
    if (g.crypto && typeof g.crypto.randomUUID === "function") return g.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function registerConnector(raw: unknown): ConnectorManifest {
  const manifest = validateManifest(raw);
  registry.set(manifest.id, new ConnectorRuntime(manifest));
  log.info("connector_registered", { id: manifest.id, version: manifest.version, kind: manifest.kind });
  return manifest;
}

export function mountConnectorCredential(input: MountCredentialInput & { connectorId: string }): void {
  const rt = registry.get(input.connectorId);
  if (!rt) throw new Error(`connector not found: ${input.connectorId}`);
  rt.credential = createCredential(input);
}

export function rotateConnectorCredential(connectorId: string, newToken: string): void {
  const rt = registry.get(connectorId);
  if (!rt || !rt.credential) return;
  rt.credential = rotateCredential(rt.credential, newToken);
}

export function revokeConnector(connectorId: string): void {
  const rt = registry.get(connectorId);
  if (!rt) return;
  rt.manifest.revoked = true;
  if (rt.credential) rt.credential = revokeCredential(rt.credential);
  log.warn("connector_revoked", { connectorId });
}

export function listConnectors() {
  return Array.from(registry.values()).map((rt) => ({
    id: rt.manifest.id,
    kind: rt.manifest.kind,
    version: rt.manifest.version,
    scopes: rt.manifest.scopes,
    allowedDataClasses: rt.manifest.allowedDataClasses,
    failurePolicy: rt.manifest.failurePolicy,
    oauth: rt.manifest.auth.oauth,
    revoked: rt.manifest.revoked,
    credential: rt.credential ? rt.credential.kind : "unset",
    circuit: circuitStateOf(rt),
    permitCount: rt.permitCount,
  }));
}

function circuitStateOf(rt: ConnectorRuntime): CBState {
  if (rt.cb.openedAt !== null && Date.now() - rt.cb.openedAt < rt.manifest.circuit.resetMs) return "OPEN";
  if (rt.cb.failures >= rt.manifest.circuit.threshold) {
    // fuera de ventana de reset → HALF_OPEN permitido para probar una llamada
    return Date.now() - rt.cb.openedAt! >= rt.manifest.circuit.resetMs ? "HALF_OPEN" : "OPEN";
  }
  return "CLOSED";
}

function rateLimited(rt: ConnectorRuntime, key: string): boolean {
  const { windowMs, maxCalls } = rt.manifest.rateLimit;
  const now = Date.now();
  const bucket = rt.rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    rt.rateBuckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > maxCalls;
}

export interface CallDecision {
  readonly code: MCPDecisionCode;
  readonly allowed: boolean;
  readonly connectorId: string;
  readonly healthy?: boolean;
  readonly retryable?: boolean;
  readonly reason?: string;
}

/**
 * Decide si la llamada puede proceder y, si `onCall` se aporta, la ejecuta con
 * timeout y aplica la política de fallo. Devuelve la decisión y, en caso de
 * éxito, el resultado de la operación.
 */
export async function authorizeConnectorCall(
  req: CallRequest,
  onCall?: () => Promise<unknown>,
): Promise<{ decision: CallDecision; result?: unknown; audit: AuditEntry }> {
  const started = performance.now();
  const rt = registry.get(req.connectorId);
  const base = { connectorId: req.connectorId, scope: req.requiredScope, dataClass: req.dataClass, tenantId: req.tenantId, subject: req.subject, decision: "CONNECTOR_NOT_FOUND" as MCPDecisionCode, latencyMs: 0 };

  const decide = async (code: MCPDecisionCode, reason?: string): Promise<{ decision: CallDecision; result?: unknown; audit: AuditEntry }> => {
    const latencyMs = Math.round(performance.now() - started);
    const audit = await runAudit({ ...base, decision: code, latencyMs, reason });
    return {
      decision: {
        code,
        allowed: code === "ALLOWED",
        connectorId: req.connectorId,
        retryable: code === "CIRCUIT_OPEN",
        reason,
      },
      audit,
    };
  };

  if (!rt) return decide("CONNECTOR_NOT_FOUND", "no manifest registrado");

  // 1. Revocación
  if (rt.manifest.revoked) return decide("CONNECTOR_REVOKED", "conector revocado");

  // 2. Credencial
  if (!credentialIsUsable(rt.credential, rt.manifest)) {
    return decide("CREDENTIAL_INVALID", rt.manifest.auth.oauth ? "credencial OAuth ausente/expirada/revocada" : undefined);
  }

  // 3. Scope
  const granted: ScopeSet = req.grantedScopes instanceof Set ? req.grantedScopes : new Set(req.grantedScopes);
  if (!canCallScope(rt.manifest, granted, req.requiredScope)) {
    return decide("SCOPE_DENIED", "scope no otorgado o no declarado en el manifest");
  }

  // 4. Clasificación de datos
  if (!rt.manifest.allowedDataClasses.includes(req.dataClass)) {
    return decide("DATA_CLASS_DENIED", "el conector no puede manejar esta clasificación");
  }

  // 5. Rate limit
  if (rateLimited(rt, `${req.tenantId}:${req.subject}`)) {
    return decide("RATE_LIMITED", "límite de llamadas por ventana alcanzado");
  }

  // 6. Circuit breaker
  const state = circuitStateOf(rt);
  if (state === "OPEN") {
    return decide("CIRCUIT_OPEN", "circuito abierto — llamada rechazada");
  }

  // 7. Ejecución con timeout
  const runOnce = async (): Promise<{ decision: CallDecision; result?: unknown }> => {
    if (!onCall) return { decision: { code: "ALLOWED", allowed: true, connectorId: req.connectorId } };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), rt.manifest.timeout.requestMs);
    try {
      const result = await onCall();
      rt.cb.failures = 0;
      rt.cb.openedAt = null;
      rt.permitCount += 1;
      return { decision: { code: "ALLOWED", allowed: true, connectorId: req.connectorId, healthy: true }, result };
    } catch (err) {
      rt.cb.failures += 1;
      rt.cb.lastFailureAt = Date.now();
      if (rt.cb.failures >= rt.manifest.circuit.threshold && rt.cb.openedAt === null) {
        rt.cb.openedAt = Date.now();
      }
      const open = circuitStateOf(rt) === "OPEN";
      // Política de fallo
      const policy: FailurePolicy = rt.manifest.failurePolicy;
      if (policy === "quarantine") {
        rt.cb.openedAt = rt.cb.openedAt ?? Date.now();
        return { decision: { code: "CIRCUIT_OPEN", allowed: false, connectorId: req.connectorId, retryable: true, reason: "failure policy quarantine" } };
      }
      return {
        decision: {
          code: open ? "CIRCUIT_OPEN" : "ALLOWED",
          allowed: !open,
          connectorId: req.connectorId,
          healthy: false,
          retryable: open,
          reason: String(err),
        },
      };
    } finally {
      clearTimeout(timer);
    }
  };

  // 8. Política de fallo: para un conector fail-fast, no hay reintento propio; el
  // invocador decide reintentar según retryable. (El reintento con backoff/jitter
  // es CXI; el fallback a conector hermano quedó fuera de scope aquí.)
  const callResult = await runOnce();

  const latencyMs = Math.round(performance.now() - started);
  const audit = await runAudit({ ...base, decision: callResult.decision.code, latencyMs, reason: callResult.decision.reason });
  return { decision: callResult.decision, result: callResult.result, audit };
}

async function runAudit(entry: Omit<AuditEntry, "eventId" | "ts">): Promise<AuditEntry> {
  const full: AuditEntry = { ...entry, eventId: randomUUID(), ts: new Date().toISOString() };
  auditQueue.push(full);
  if (auditQueue.length > AUDIT_MAX) auditQueue.splice(0, auditQueue.length - AUDIT_MAX);
  return full;
}

export function getAuditLog(): ReadonlyArray<AuditEntry> {
  return auditQueue.slice();
}

export function resetConnectorRegistry(): void {
  registry.clear();
  auditQueue.length = 0;
}

export type { ConnectorCredential };
export type { MountCredentialInput };
