import { createHmac, randomUUID, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { appendBlock } from "./bookpi.server";
import { authenticate, currentPrincipal, type IsabellaRole } from "./auth.server";
import { recordAudit } from "./atlas-kernel.server";
import { summarizeIsabellaV5Fusion } from "./isabella-v5";

export type Visibility = "public" | "followers" | "members" | "private";
export type MembershipTier = "free" | "creator" | "guardian" | "institutional";
export type ProtocolState = "draft" | "reviewing" | "approved" | "running" | "paused" | "completed" | "rejected";
export type ThreatLevel = "green" | "yellow" | "orange" | "red";

export interface TamvUser {
  id: string;
  handle: string;
  displayName: string;
  roles: IsabellaRole[];
  membership: MembershipTier;
  createdAt: string;
  flags: { verifiedHuman: boolean; guardianEligible: boolean; institutional: boolean };
}

export interface TamvProfile {
  userId: string;
  handle: string;
  bio: string;
  links: string[];
  gallery: string[];
  timeline: string[];
  presence: "offline" | "available" | "creating" | "streaming" | "in-dreamspace";
  updatedAt: string;
}

export interface SocialPost {
  id: string;
  authorId: string;
  body: string;
  media: { kind: "image" | "audio" | "video" | "model3d"; url: string; alt?: string }[];
  visibility: Visibility;
  likes: number;
  comments: { id: string; authorId: string; body: string; createdAt: string }[];
  createdAt: string;
}

export interface DreamSpace {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  visibility: Visibility;
  xrScene: { renderer: "declarative-xr"; worldAnchor: string; guardianOverlay: boolean; physics: "pbr-hdri" };
  participants: string[];
  createdAt: string;
}

export interface StreamRoom {
  id: string;
  hostId: string;
  title: string;
  mode: "live" | "scheduled" | "ended";
  signaling: { protocol: "webrtc"; roomKey: string; recordingAllowed: boolean };
  createdAt: string;
}

export interface CivilizationalProtocol {
  id: string;
  name: string;
  objective: string;
  state: ProtocolState;
  threatLevel: ThreatLevel;
  guardianSignals: string[];
  xrProjectionId?: string;
  auditIds: string[];
  createdAt: string;
}

const users = new Map<string, TamvUser>();
const profiles = new Map<string, TamvProfile>();
const credentials = new Map<string, { userId: string; salt: string; hash: string }>();
const posts = new Map<string, SocialPost>();
const dreamspaces = new Map<string, DreamSpace>();
const streams = new Map<string, StreamRoom>();
const protocols = new Map<string, CivilizationalProtocol>();
const internalLedger: { id: string; userId: string; amount: number; reason: string; createdAt: string }[] = [];

const HandleSchema = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/);
const PasswordSchema = z.string().min(10).max(256);
const VisibilitySchema = z.enum(["public", "followers", "members", "private"]);

function now() { return new Date().toISOString(); }
function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex") };
}
function verifyPassword(password: string, salt: string, expectedHex: string) {
  const actual = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function audit(actor: string, action: string, payload: Record<string, unknown>) {
  const event = recordAudit({ actor, action, policy: "tamv.platform.v1", payload });
  const block = appendBlock({ eventType: "user_action", module: "TAMVPlatform", action, actor, data: { ...payload, auditHash: event.hash } });
  return { auditId: event.hash, blockCid: block.cid };
}
function principalUserId(req: Parameters<typeof currentPrincipal>[0]) {
  const principal = currentPrincipal(req);
  return principal.sub === "anonymous" ? "dev-local" : principal.sub;
}
function ensureProfile(user: TamvUser) {
  if (!profiles.has(user.handle)) {
    profiles.set(user.handle, {
      userId: user.id,
      handle: user.handle,
      bio: "Ciudadano/a fundador/a de TAMV MD-X4 e Isabella v5.",
      links: [],
      gallery: [],
      timeline: [],
      presence: "available",
      updatedAt: now(),
    });
  }
  return profiles.get(user.handle)!;
}
function seedDevUser() {
  if (users.has("dev-local")) return;
  const user: TamvUser = {
    id: "dev-local",
    handle: "nodo-cero",
    displayName: "Nodo Cero RDM",
    roles: ["admin"],
    membership: "guardian",
    createdAt: now(),
    flags: { verifiedHuman: true, guardianEligible: true, institutional: false },
  };
  users.set(user.id, user);
  ensureProfile(user);
  const defaultPassword = "isabella-dev-2026";
  const secret = hashPassword(defaultPassword);
  credentials.set("nodo-cero", { userId: user.id, ...secret });
}
seedDevUser();

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export const tamvPlatformRouter = Router();

tamvPlatformRouter.post("/api/v1/auth/signup", (req, res) => {
  const parsed = z.object({ handle: HandleSchema, displayName: z.string().trim().min(1).max(80), password: PasswordSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid signup payload", issues: parsed.error.issues });
  const handle = parsed.data.handle.toLowerCase();
  if ([...users.values()].some((u) => u.handle === handle)) return res.status(409).json({ ok: false, error: "Handle already registered" });
  const user: TamvUser = { id: randomUUID(), handle, displayName: parsed.data.displayName, roles: ["citizen"], membership: "free", createdAt: now(), flags: { verifiedHuman: false, guardianEligible: false, institutional: false } };
  const secret = hashPassword(parsed.data.password);
  users.set(user.id, user);
  credentials.set(handle, { userId: user.id, ...secret });
  ensureProfile(user);
  const proof = audit(user.id, "auth.signup", { handle, membership: user.membership });
  res.status(201).json({ ok: true, user, profile: profiles.get(handle), proof, tokenMode: "external-jwt-required-for-production" });
});

tamvPlatformRouter.post("/api/v1/auth/login", (req, res) => {
  const parsed = z.object({ handle: HandleSchema, password: PasswordSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid login payload", issues: parsed.error.issues });
  const cred = credentials.get(parsed.data.handle.toLowerCase());
  if (!cred || !verifyPassword(parsed.data.password, cred.salt, cred.hash)) return res.status(401).json({ ok: false, error: "Invalid credentials" });
  const user = users.get(cred.userId)!;
  const proof = audit(user.id, "auth.login", { handle: user.handle });
  const secret = process.env.ISABELLA_AUTH_SECRET || "isabella-dev-secret-change-in-production";
  const token = signJwt({ sub: user.id, tenantId: "nodo-cero-rdm", roles: user.roles, plan: user.membership, scopes: ["*"], iss: "isabella-auth", exp: Math.floor(Date.now() / 1000) + 86400 }, secret);
  res.json({ ok: true, user, proof, token });
});

tamvPlatformRouter.post("/api/v1/auth/refresh", authenticate, (req, res) => {
  const id = principalUserId(req);
  const user = users.get(id);
  if (!user) return res.status(401).json({ ok: false, error: "Unknown principal" });
  const secret = process.env.ISABELLA_AUTH_SECRET || "isabella-dev-secret-change-in-production";
  const token = signJwt({ sub: user.id, tenantId: "nodo-cero-rdm", roles: user.roles, plan: user.membership, scopes: ["*"], iss: "isabella-auth", exp: Math.floor(Date.now() / 1000) + 86400 }, secret);
  res.json({ ok: true, token });
});

tamvPlatformRouter.post("/api/v1/auth/logout", authenticate, (req, res) => {
  const actor = principalUserId(req);
  res.json({ ok: true, proof: audit(actor, "auth.logout", { actor }) });
});

tamvPlatformRouter.get("/api/v1/users/me", authenticate, (req, res) => {
  const id = principalUserId(req);
  const user = users.get(id) || users.get("dev-local")!;
  res.json({ ok: true, user, profile: ensureProfile(user) });
});

tamvPlatformRouter.get("/api/v1/profiles/:handle", (req, res) => {
  const profile = profiles.get(String(req.params.handle).toLowerCase());
  if (!profile) return res.status(404).json({ ok: false, error: "Profile not found" });
  const timeline = profile.timeline.map((id) => posts.get(id)).filter(Boolean);
  res.json({ ok: true, profile, timeline });
});

tamvPlatformRouter.put("/api/v1/profiles/me", authenticate, (req, res) => {
  const user = users.get(principalUserId(req)) || users.get("dev-local")!;
  const parsed = z.object({ bio: z.string().max(280).optional(), links: z.array(z.string().url()).max(8).optional(), gallery: z.array(z.string().url()).max(24).optional(), presence: z.enum(["offline", "available", "creating", "streaming", "in-dreamspace"]).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid profile payload", issues: parsed.error.issues });
  const profile = { ...ensureProfile(user), ...parsed.data, updatedAt: now() };
  profiles.set(user.handle, profile);
  res.json({ ok: true, profile, proof: audit(user.id, "profile.update", { handle: user.handle }) });
});

tamvPlatformRouter.post("/api/v1/social/posts", authenticate, (req, res) => {
  const parsed = z.object({ body: z.string().trim().min(1).max(4000), visibility: VisibilitySchema.default("public"), media: z.array(z.object({ kind: z.enum(["image", "audio", "video", "model3d"]), url: z.string().url(), alt: z.string().max(180).optional() })).max(8).default([]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid post payload", issues: parsed.error.issues });
  const authorId = principalUserId(req);
  const post: SocialPost = { id: randomUUID(), authorId, body: parsed.data.body, media: parsed.data.media, visibility: parsed.data.visibility, likes: 0, comments: [], createdAt: now() };
  posts.set(post.id, post);
  const user = users.get(authorId);
  if (user) ensureProfile(user).timeline.unshift(post.id);
  res.status(201).json({ ok: true, post, proof: audit(authorId, "social.post.create", { postId: post.id, visibility: post.visibility }) });
});

tamvPlatformRouter.get("/api/v1/social/feed", (_req, res) => {
  res.json({ ok: true, posts: [...posts.values()].filter((p) => p.visibility === "public").slice(-50).reverse() });
});

tamvPlatformRouter.post("/api/v1/xr/dreamspaces", authenticate, (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(3).max(80), description: z.string().max(500).default(""), visibility: VisibilitySchema.default("members"), worldAnchor: z.string().max(120).default("real-del-monte-node-zero") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid DreamSpace payload", issues: parsed.error.issues });
  const ownerId = principalUserId(req);
  const space: DreamSpace = { id: randomUUID(), ownerId, name: parsed.data.name, description: parsed.data.description, visibility: parsed.data.visibility, xrScene: { renderer: "declarative-xr", worldAnchor: parsed.data.worldAnchor, guardianOverlay: true, physics: "pbr-hdri" }, participants: [ownerId], createdAt: now() };
  dreamspaces.set(space.id, space);
  res.status(201).json({ ok: true, dreamspace: space, proof: audit(ownerId, "xr.dreamspace.create", { dreamspaceId: space.id }) });
});

tamvPlatformRouter.post("/api/v1/streams", authenticate, (req, res) => {
  const parsed = z.object({ title: z.string().trim().min(3).max(120), mode: z.enum(["live", "scheduled"]).default("live"), recordingAllowed: z.boolean().default(false) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid stream payload", issues: parsed.error.issues });
  const hostId = principalUserId(req);
  const room: StreamRoom = { id: randomUUID(), hostId, title: parsed.data.title, mode: parsed.data.mode, signaling: { protocol: "webrtc", roomKey: randomUUID(), recordingAllowed: parsed.data.recordingAllowed }, createdAt: now() };
  streams.set(room.id, room);
  res.status(201).json({ ok: true, stream: room, proof: audit(hostId, "stream.room.create", { roomId: room.id, mode: room.mode }) });
});

tamvPlatformRouter.post("/api/v1/protocols", authenticate, (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(3).max(100), objective: z.string().trim().min(10).max(1000), xrProjectionId: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid protocol payload", issues: parsed.error.issues });
  const actor = principalUserId(req);
  const protocol: CivilizationalProtocol = { id: randomUUID(), name: parsed.data.name, objective: parsed.data.objective, state: "reviewing", threatLevel: "green", guardianSignals: ["EOCT_PRECHECK_REQUIRED", "BOOKPI_TRACE_ENABLED", "XR_VISUALIZATION_READY"], xrProjectionId: parsed.data.xrProjectionId, auditIds: [], createdAt: now() };
  const proof = audit(actor, "protocol.create", { protocolId: protocol.id, state: protocol.state, fusion: summarizeIsabellaV5Fusion().version });
  protocol.auditIds.push(proof.auditId);
  protocols.set(protocol.id, protocol);
  res.status(201).json({ ok: true, protocol, proof });
});

tamvPlatformRouter.get("/api/v1/protocols", (_req, res) => {
  res.json({ ok: true, protocols: [...protocols.values()].slice(-100).reverse() });
});

tamvPlatformRouter.post("/api/v1/economy/credits", authenticate, (req, res) => {
  const parsed = z.object({ amount: z.number().int().min(1).max(10_000), reason: z.string().trim().min(3).max(160) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid credit payload", issues: parsed.error.issues });
  const userId = principalUserId(req);
  const entry = { id: randomUUID(), userId, amount: parsed.data.amount, reason: parsed.data.reason, createdAt: now() };
  internalLedger.push(entry);
  const proof = audit(userId, "economy.credits.record", entry);
  appendBlock({ eventType: "economic_transaction", module: "TAMVEconomy", action: "credits.record", actor: userId, data: entry });
  res.status(201).json({ ok: true, entry, balance: internalLedger.filter((e) => e.userId === userId).reduce((s, e) => s + e.amount, 0), proof });
});
