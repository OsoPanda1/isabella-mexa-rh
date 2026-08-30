/**
 * Isabella Auth Client — httpOnly cookie-based transport.
 *
 * JWT tokens are NEVER stored in localStorage. The server sets an
 * httpOnly cookie (`__Host-isa_session`) on mint. The browser attaches
 * it automatically on same-origin requests. A client-side cache keeps the
 * in-memory token only for non-cookie contexts (Web Workers, WebSockets).
 *
 * API keys still live in localStorage (explicit user action to create).
 */

const API_KEY_STORAGE = "isabella_api_key";
const SESSION_COOKIE = "__Host-isa_session";

let cachedToken: string | null = null;

function readSessionCookie(): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function readCookieExpiry(): number | null {
  const token = readSessionCookie();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return (payload.exp || 0) * 1000;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (cachedToken && cachedToken.length > 0) return cachedToken;
  const token = readSessionCookie();
  if (token && readCookieExpiry() !== null && Date.now() < (readCookieExpiry() ?? 0)) {
    cachedToken = token;
    return token;
  }
  cachedToken = null;
  return null;
}

export function storeToken(token: string): void {
  cachedToken = token;
}

export function clearToken(): void {
  cachedToken = null;
  try {
    document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  } catch { /* ignore */ }
}

export function getStoredApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function storeApiKey(key: string): void {
  try {
    localStorage.setItem(API_KEY_STORAGE, key);
  } catch { /* ignore */ }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE);
  } catch { /* ignore */ }
}

const GUEST_SESSION_KEY = "isabella_guest_session_id";

function guestSessionId(): string {
  try {
    let id = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `gs-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, "-");
      sessionStorage.setItem(GUEST_SESSION_KEY, id);
    }
    return id;
  } catch {
    return `gs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

let guestSessionPromise: Promise<string | null> | null = null;

async function mintGuestToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/v1/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId: guestSessionId() }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.ok && typeof data.token === "string") {
      storeToken(data.token);
      return data.token;
    }
  } catch { /* guest session unavailable */ }
  return null;
}

export async function ensureAuthToken(): Promise<string | null> {
  const existing = getStoredToken();
  if (existing) return existing;

  const apiKey = getStoredApiKey();
  if (apiKey) return null;

  if (!guestSessionPromise) {
    guestSessionPromise = mintGuestToken().finally(() => { guestSessionPromise = null; });
  }
  return guestSessionPromise;
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const apiKey = getStoredApiKey();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    return headers;
  }

  return headers;
}

export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  const apiKey = getStoredApiKey();
  if (apiKey) {
    headers.set("x-api-key", apiKey);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    clearToken();
    const newToken = await ensureAuthToken();
    if (newToken) {
      return fetch(url, { ...init, headers, credentials: "include" });
    }
  }

  return res;
}
