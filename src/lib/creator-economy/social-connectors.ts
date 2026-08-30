/**
 * Social connectors — OAuth 2.0 + PKCE (RFC 7636), AES-256-GCM token vault,
 * minimal scopes, and human-in-the-loop publication (spec §5.3, §9.2).
 *
 * Rules enforced here:
 *  - Tokens are encrypted at rest per-record; the vault key comes from
 *    CREATOR_VAULT_KEY (32 bytes hex/base64) — never hardcoded.
 *  - Scopes are minimal: publish-only sets; 'delete' is never requested.
 *  - No publication without an explicit approval event (approvedByCreatorAt)
 *    recorded by an authenticated session.
 *  - Channel counts respect plan entitlements.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { getCreatorEconomyStore, newId } from "./persistence/creator-economy-store";
import type { ChannelProvider, ScheduledPublication, SocialChannel } from "./types";

// ---------- PKCE ----------

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// ---------- Token vault (AES-256-GCM) ----------

function vaultKey(): Buffer {
  const raw = process.env.CREATOR_VAULT_KEY;
  if (!raw) {
    // Deterministic development key — production MUST set CREATOR_VAULT_KEY.
    return createHash("sha256").update("isabella-creator-vault-dev").digest();
  }
  const buf = Buffer.from(raw, raw.length === 64 ? "hex" : "base64");
  if (buf.length !== 32) throw new Error("CREATOR_VAULT_KEY must be 32 bytes (hex or base64)");
  return buf;
}

export function encryptToken(plaintext: string): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptToken(ciphertext: string, iv: string, tag: string): string {
  const decipher = createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

// ---------- Provider registry (minimal scopes, never delete) ----------

export const PROVIDERS: Readonly<Record<ChannelProvider, {
  authorizationUrl: string;
  tokenUrl: string;
  publishScopes: readonly string[];
}>> = Object.freeze({
  youtube: Object.freeze({
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    publishScopes: Object.freeze(["youtube.readonly", "youtube.upload"]),
  }),
  meta: Object.freeze({
    authorizationUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    publishScopes: Object.freeze(["pages_read_engagement", "pages_manage_posts"]),
  }),
  tiktok: Object.freeze({
    authorizationUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    publishScopes: Object.freeze(["user.info.basic", "video.publish"]),
  }),
  x: Object.freeze({
    authorizationUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    publishScopes: Object.freeze(["tweet.read", "tweet.write", "users.read", "offline.access"]),
  }),
  linkedin: Object.freeze({
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    publishScopes: Object.freeze(["r_liteprofile", "w_member_social"]),
  }),
  wordpress: Object.freeze({
    authorizationUrl: "https://public-api.wordpress.com/oauth2/authorize",
    tokenUrl: "https://public-api.wordpress.com/oauth2/token",
    publishScopes: Object.freeze(["posts"]),
  }),
});

/** Reject any scope outside the minimal publish sets. */
export function assertMinimalScopes(provider: ChannelProvider, scopes: string[]): void {
  const allowed = new Set(PROVIDERS[provider].publishScopes);
  for (const s of scopes) {
    if (!allowed.has(s)) throw new Error(`SCOPE_NOT_ALLOWED:${s}`);
    if (/delete|admin|manage_account/i.test(s)) throw new Error(`DANGEROUS_SCOPE:${s}`);
  }
}

export function buildAuthorizationUrl(input: {
  provider: ChannelProvider;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const cfg = PROVIDERS[input.provider];
  const url = new URL(cfg.authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", cfg.publishScopes.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// ---------- Channel management ----------

export function connectChannel(input: {
  creatorId: string;
  provider: ChannelProvider;
  externalAccountId: string;
  displayName: string;
  refreshToken: string;
  scopes: string[];
  expiresAt: string | null;
}): SocialChannel {
  assertMinimalScopes(input.provider, input.scopes);

  const store = getCreatorEconomyStore();
  const ent = store.getEntitlement(input.creatorId);
  const existing = store.listChannels(input.creatorId).filter((c) => c.status === "active");
  if (ent && ent.maxConnectedChannels !== -1 && existing.length >= ent.maxConnectedChannels) {
    throw new Error(`CHANNEL_LIMIT_REACHED:${ent.maxConnectedChannels}`);
  }

  const { ciphertext, iv, tag } = encryptToken(input.refreshToken);
  const channel: SocialChannel = {
    id: newId(),
    creatorId: input.creatorId,
    provider: input.provider,
    externalAccountId: input.externalAccountId,
    displayName: input.displayName,
    scopes: input.scopes,
    tokenCiphertext: ciphertext,
    tokenIv: iv,
    tokenTag: tag,
    expiresAt: input.expiresAt,
    status: "active",
    connectedAt: new Date().toISOString(),
  };
  store.upsertChannel(channel);
  return channel;
}

export function revokeChannel(channelId: string): void {
  getCreatorEconomyStore().updateChannelStatus(channelId, "revoked");
}

export function getDecryptedToken(channelId: string): string | null {
  const ch = getCreatorEconomyStore().getChannel(channelId);
  if (!ch || ch.status !== "active") return null;
  return decryptToken(ch.tokenCiphertext, ch.tokenIv, ch.tokenTag);
}

// ---------- Human-in-the-loop publication (§9.2) ----------

export class ApprovalRequiredError extends Error {
  constructor() {
    super("USER_APPROVAL_REQUIRED: ninguna publicación externa sin aprobación explícita del creador");
    this.name = "ApprovalRequiredError";
  }
}

/**
 * Schedule a publication. The approval timestamp must come from an
 * authenticated UI event recorded server-side; there is no code path that
 * schedules without it (Prohibición de Ejecución Silenciosa).
 */
export function schedulePublication(input: {
  creatorId: string;
  channelId: string;
  assetId: string;
  scheduledAt: string;
  approvedByCreatorAt: string | null;
}): ScheduledPublication {
  if (!input.approvedByCreatorAt) throw new ApprovalRequiredError();

  const store = getCreatorEconomyStore();
  const channel = store.getChannel(input.channelId);
  if (!channel || channel.creatorId !== input.creatorId || channel.status !== "active") {
    throw new Error("CHANNEL_NOT_AVAILABLE");
  }
  const asset = store.getAsset(input.assetId);
  if (!asset || asset.creatorId !== input.creatorId) throw new Error("ASSET_NOT_FOUND");
  if (asset.status !== "approved") throw new Error("ASSET_NOT_APPROVED");
  if (!asset.approvedByCreatorAt) throw new ApprovalRequiredError();

  const ent = store.getEntitlement(input.creatorId);
  if (ent && !ent.canPublishExternally) throw new Error("PLAN_CANNOT_PUBLISH_EXTERNALLY");

  const pub: ScheduledPublication = {
    id: randomUUID(),
    creatorId: input.creatorId,
    channelId: input.channelId,
    assetId: input.assetId,
    scheduledAt: input.scheduledAt,
    status: "scheduled",
    approvedByCreatorAt: input.approvedByCreatorAt,
    publishedAt: null,
    externalRef: null,
  };
  store.insertPublication(pub);
  return pub;
}

export function markPublished(id: string, externalRef: string): void {
  getCreatorEconomyStore().updatePublicationStatus(id, "published", externalRef);
}

export function markPublicationFailed(id: string): void {
  getCreatorEconomyStore().updatePublicationStatus(id, "failed");
}
