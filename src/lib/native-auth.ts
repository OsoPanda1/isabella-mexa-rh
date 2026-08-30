/**
 * ================================================================
 * ISABELLA VILLASEÑOR AI — NATIVE AUTH ENGINE
 * Self-contained authentication. Auto-generates secrets on first boot.
 * Zero external dependencies. No env vars required.
 * ================================================================
 */
import { createHmac, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, timingSafeEqual, verify } from "node:crypto";
import { nodeRequire } from "./node-require";

let cachedSecret: string | null = null;
let cachedEd25519KeyPair: { kid: string; privateKeyPem: string; publicKeyPem: string } | null = null;

function base64UrlEncode(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64url");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(
    normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "="),
    "base64"
  );
}

function safeJson<T>(buf: Buffer): T | null {
  try {
    return JSON.parse(buf.toString("utf8")) as T;
  } catch {
    return null;
  }
}

/* =========================================================================
   SECRET MANAGEMENT — auto-generate, persist, retrieve
   ========================================================================= */

function generateSecret(): string {
  return randomBytes(64).toString("hex");
}

function loadPersistedSecret(): string | null {
  try {
    const Database = nodeRequire("better-sqlite3") as any;
    const dbPath = process.env.ISABELLA_DB_PATH || "./data/isabella.db";
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS native_auth (
        id TEXT PRIMARY KEY DEFAULT 'master',
        secret TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        rotatedAt TEXT
      )
    `);
    const row = db.prepare("SELECT secret FROM native_auth WHERE id = 'master'").get() as
      | { secret: string }
      | undefined;
    if (row?.secret) {
      db.close();
      return row.secret;
    }
    const newSecret = generateSecret();
    db.prepare("INSERT INTO native_auth (id, secret, createdAt) VALUES ('master', ?, ?)").run(
      newSecret,
      new Date().toISOString()
    );
    db.close();
    return newSecret;
  } catch {
    return null;
  }
}

export function getNativeSecret(): string {
  if (cachedSecret) return cachedSecret;
  const persisted = loadPersistedSecret();
  cachedSecret = persisted || generateSecret();
  return cachedSecret;
}

/**
 * Devuelve el PEM de la clave pública Ed25519 del par de firma nativo.
 * Permite al PDP sidecar (authz-runtime) verificar los JWT de la app en modo
 * Ed25519 local sin depender de un IdP externo. En producción solo existe si
 * se proveyó NATIVE_JWT_ED25519_PUBLIC_KEY; en dev se materializa bajo demanda.
 */
export function getNativeEd25519PublicKeyPem(): string | null {
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  if (cachedEd25519KeyPair) return cachedEd25519KeyPair.publicKeyPem;
  if (isProduction) return null;
  try {
    return getNativeEd25519KeyPair().publicKeyPem;
  } catch {
    return null;
  }
}

/* =========================================================================
   JWT — sign & verify (HS256)
   ========================================================================= */

export interface NativePrincipal {
  sub: string;
  tenantId: string;
  roles: string[];
  plan?: string;
  scopes: string[];
  exp?: number;
  iss?: string;
  kind: "jwt" | "api-key";
  apiKeyId?: string;
}

export interface SignJwtOptions {
  sub: string;
  tenantId?: string;
  roles?: string[];
  plan?: string;
  scopes?: string[];
  expiresInSec?: number;
  iss?: string;
}

export const JWT_ISSUER = "isabella-native-auth";
const JWT_ALGORITHM = "EdDSA";
const MAX_JWT_LIFETIME_SEC = 24 * 60 * 60; // 24 hours absolute max
const DEFAULT_JWT_LIFETIME_SEC = 60 * 60; // 1 hour default


function getNativeEd25519KeyPair(): { kid: string; privateKeyPem: string; publicKeyPem: string } {
  if (cachedEd25519KeyPair) return cachedEd25519KeyPair;
  if (process.env.NATIVE_JWT_ED25519_PRIVATE_KEY && process.env.NATIVE_JWT_ED25519_PUBLIC_KEY) {
    cachedEd25519KeyPair = {
      kid: process.env.NATIVE_JWT_KID || "env-ed25519",
      privateKeyPem: process.env.NATIVE_JWT_ED25519_PRIVATE_KEY.replace(/\\n/g, "\n"),
      publicKeyPem: process.env.NATIVE_JWT_ED25519_PUBLIC_KEY.replace(/\\n/g, "\n"),
    };
    return cachedEd25519KeyPair;
  }
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  if (isProduction) {
    throw new Error("NATIVE_JWT_ED25519_PRIVATE_KEY and NATIVE_JWT_ED25519_PUBLIC_KEY are required in production/KMS-backed deployments");
  }
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  cachedEd25519KeyPair = {
    kid: `local-${new Date().toISOString().slice(0, 10)}`,
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
  return cachedEd25519KeyPair;
}

export function signNativeJwt(opts: SignJwtOptions): string {
  const keyPair = getNativeEd25519KeyPair();
  const now = Math.floor(Date.now() / 1000);
  const requestedLifetime = opts.expiresInSec ?? DEFAULT_JWT_LIFETIME_SEC;
  const expiresInSec = Math.min(requestedLifetime, MAX_JWT_LIFETIME_SEC);
  const jti = randomBytes(16).toString("hex");
  const payload = {
    sub: opts.sub,
    tenantId: opts.tenantId || "nodo-cero-rdm",
    roles: opts.roles || ["citizen"],
    plan: opts.plan,
    scopes: opts.scopes || ["chat:read"],
    iss: opts.iss || JWT_ISSUER,
    aud: "isabella-api",
    iat: now,
    nbf: now,
    exp: now + expiresInSec,
    jti,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: JWT_ALGORITHM, typ: "JWT", kid: keyPair.kid }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = sign(null, Buffer.from(`${header}.${body}`), createPrivateKey(keyPair.privateKeyPem)).toString("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyNativeJwt(token: string): NativePrincipal | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const header = safeJson<{ alg?: string; typ?: string; kid?: string }>(base64UrlDecode(encodedHeader));
  const actual = base64UrlDecode(encodedSignature);
  if (header?.alg === JWT_ALGORITHM) {
    const keyPair = getNativeEd25519KeyPair();
    if (!verify(null, Buffer.from(`${encodedHeader}.${encodedPayload}`), createPublicKey(keyPair.publicKeyPem), actual)) return null;
  } else if (header?.alg === "HS256" && process.env.ALLOW_LEGACY_HS256_JWT === "true") {
    const expected = createHmac("sha256", getNativeSecret()).update(`${encodedHeader}.${encodedPayload}`).digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  } else {
    return null;
  }

  const payload = safeJson<any>(base64UrlDecode(encodedPayload));
  if (!payload?.sub || typeof payload.sub !== "string") return null;
  if (payload.exp && Number(payload.exp) * 1000 <= Date.now()) return null;
  if (payload.iss && payload.iss !== JWT_ISSUER) return null;
  if (payload.aud && payload.aud !== "isabella-api") return null;

  const roleRank: Record<string, number> = {
    viewer: 0,
    citizen: 1,
    operator: 2,
    admin: 3,
    system: 4,
  };
  const roles = Array.isArray(payload.roles) ? payload.roles : [payload.role || "citizen"];

  return {
    sub: payload.sub,
    tenantId: String(payload.tenantId || "nodo-cero-rdm"),
    roles: roles.filter((r: string) => r in roleRank),
    plan: typeof payload.plan === "string" ? payload.plan : undefined,
    scopes: Array.isArray(payload.scopes) ? payload.scopes.map(String) : [],
    exp: payload.exp,
    iss: payload.iss,
    kind: "jwt",
  };
}

/* =========================================================================
   BOOTSTRAP — create default admin user + token on first run
   ========================================================================= */

export function bootstrapNativeAuth(): {
  userId: string;
  handle: string;
  token: string;
  isFirstBoot: boolean;
} {
  const userId = "native-admin";
  const handle = "admin";
  const token = signNativeJwt({
    sub: userId,
    tenantId: "nodo-cero-rdm",
    roles: ["admin"],
    plan: "guardian",
    scopes: ["chat:read", "chat:write", "models:read", "territory:read", "billing:read", "audit:read", "admin:keys"],
    expiresInSec: 8 * 60 * 60, // 8 hours max, not 1 year
    iss: "isabella-native-auth",
  });

  return { userId, handle, token, isFirstBoot: true };
}

/* =========================================================================
   GUEST SESSION — first-party anonymous session token for the web app
   ========================================================================= */

const GUEST_SCOPE_ALLOWLIST = [
  "chat:read",
  "chat:write",
  "models:read",
  "territory:read",
] as const;

export interface GuestSessionOptions {
  sessionId: string;
  requestedScopes?: unknown;
  requestedPlan?: unknown;
}

const GUEST_PLANS = new Set(["free", "explorer"]);

export function mintGuestSession(opts: GuestSessionOptions): {
  token: string;
  principal: NativePrincipal;
  expiresInSec: number;
} {
  const safeSessionId = /^[a-zA-Z0-9_-]{6,128}$/.test(opts.sessionId)
    ? opts.sessionId
    : randomBytes(16).toString("hex");
  const requested = Array.isArray(opts.requestedScopes) ? opts.requestedScopes.map(String) : [];
  const scopes = requested.length > 0
    ? requested.filter((s): s is (typeof GUEST_SCOPE_ALLOWLIST)[number] =>
        (GUEST_SCOPE_ALLOWLIST as readonly string[]).includes(s))
    : [...GUEST_SCOPE_ALLOWLIST];
  const plan = typeof opts.requestedPlan === "string" && GUEST_PLANS.has(opts.requestedPlan)
    ? opts.requestedPlan
    : "free";
  const expiresInSec = 12 * 60 * 60; // 12 hours

  const token = signNativeJwt({
    sub: `guest-${safeSessionId}`,
    tenantId: "nodo-cero-rdm",
    roles: ["citizen"],
    plan,
    scopes,
    expiresInSec,
    iss: "isabella-native-auth",
  });

  return {
    token,
    expiresInSec,
    principal: {
      sub: `guest-${safeSessionId}`,
      tenantId: "nodo-cero-rdm",
      roles: ["citizen"],
      plan,
      scopes,
      kind: "jwt",
    },
  };
}
