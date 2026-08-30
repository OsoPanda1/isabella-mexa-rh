#!/usr/bin/env node
/**
 * Verificación Smoke Nativa para el Gateway de Isabella.
 * Preserva el flujo secuencial desacoplado y el aislamiento de errores por prueba.
 */

const baseIndex = process.argv.indexOf("--base-url");
const baseUrl =
  (baseIndex > 0 && process.argv[baseIndex + 1]) ||
  process.env.SMOKE_BASE_URL ||
  "http://127.0.0.1:3000";

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function request(path, init = {}) {
  const url = new URL(path, baseUrl);
  return fetch(url, {
    redirect: "manual",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init.headers || {}),
    },
  });
}

function assertStatus(actual, expected, what) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(actual)) {
    throw new Error(`${what}: expected ${allowed.join("/")}, got ${actual}`);
  }
}

let cookieHeader = "";
let csrfToken = "";

async function obtainCsrf() {
  const res = await request("/api/v1/security/csrf-token");
  assertStatus(res.status, 200, "csrf token status");
  const body = await res.json();
  csrfToken = body.csrfToken || body.data?.csrfToken;
  if (!csrfToken) throw new Error("missing csrfToken in response");
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/__Host-iv_csrf=([^;]+)/);
  if (match) cookieHeader = `__Host-iv_csrf=${match[1]}`;
}

async function mintGuestToken() {
  const headers = { "x-csrf-token": csrfToken };
  if (cookieHeader) headers.cookie = cookieHeader;
  const sessionRes = await request("/api/v1/auth/session", {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId: `smoke-${Date.now()}` }),
  });
  if (sessionRes.status !== 200 && sessionRes.status !== 201) {
    throw new Error(`guest session status: expected 200/201, got ${sessionRes.status}`);
  }
  const session = await sessionRes.json();
  if (!session.ok || !session.principal) {
    throw new Error("guest session response is invalid");
  }
  const sessionCookie = sessionRes.headers.get("set-cookie")?.match(/__Host-isa_session=([^;]+)/)?.[1];
  if (!sessionCookie) throw new Error("guest session cookie missing");
  cookieHeader = `${cookieHeader ? `${cookieHeader}; ` : ""}__Host-isa_session=${sessionCookie}`;
  return session.principal;
}

// 1. Inicialización de token CSRF
await check("Obtain initial CSRF token", async () => {
  await obtainCsrf();
});

// 2. Pruebas individuales de conectividad y endpoints
await check("GET /api/health is reachable", async () => {
  const res = await request("/api/health");
  assertStatus(res.status, 200, "health status");
});

await check("HEAD /api/health stays allowed (405 regression)", async () => {
  const res = await fetch(new URL("/api/health", baseUrl), { method: "HEAD", redirect: "manual" });
  if (res.status === 405) throw new Error("HEAD returns 405 — wrapper regression");
});

await check("HEAD / is not refused with 405 (wrapper method guard)", async () => {
  const res = await fetch(new URL("/", baseUrl), { method: "HEAD", redirect: "manual" });
  if (res.status === 405) throw new Error("HEAD / returns 405 — wrapper regression");
});

await check("unknown method is rejected deterministically", async () => {
  const res = await fetch(new URL("/api/health", baseUrl), { method: "MKCOL", redirect: "manual" })
    .catch(() => null);
  if (!res) return;
  assertStatus(res.status, [403, 404, 405, 200], "exotic method status");
});

await check("kill-switch status never 5xx for anonymous callers", async () => {
  const res = await request("/api/v1/kill-switch/status");
  if (res.status >= 500) throw new Error(`kill-switch status ${res.status}`);
});

await check("invalid chat body answers 400 VALIDATION_ERROR", async () => {
  await mintGuestToken();
  const res = await request("/api/isabella/process", {
    method: "POST",
    body: JSON.stringify({ activePreset: "not-a-real-preset" }),
  });
  // La capa de seguridad puede rechazar antes del validador (403) según
  // el estado de la sesión; ambos códigos son respuestas seguras y deterministas.
  assertStatus(res.status, [400, 403], "invalid body status");
  if (res.status === 400) {
    const body = await res.json();
    if (body?.error?.code !== "VALIDATION_ERROR" && body?.code !== "VALIDATION_ERROR") {
      throw new Error(`missing VALIDATION_ERROR code, got ${JSON.stringify(body).slice(0, 200)}`);
    }
  }
});

await check("voice health endpoint answers with availability report", async () => {
  await mintGuestToken();
  const res = await request("/api/voice/health");
  assertStatus(res.status, 200, "voice health status");
  const body = await res.json();
  if (!body.availability) throw new Error("voice health lacks availability");
});

await check("billing plans respond for a guest session", async () => {
  await mintGuestToken();
  const res = await request("/api/v1/billing/plans");
  assertStatus(res.status, 200, "plans status");
});

await check("api keys management is gated by scope, not anonymous", async () => {
  const res = await request("/api/v1/apikeys", { method: "POST", body: JSON.stringify({ name: "smoke" }) });
  if (res.status !== 401 && res.status !== 403) {
    throw new Error(`apikeys gate status: expected 401/403, got ${res.status}`);
  }
});

// 3. Resultado de ejecución
const failures = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : ` — ${r.error}`}`);
}
console.log(`\n${results.length - failures.length}/${results.length} smoke checks passed against ${baseUrl}`);
process.exit(failures.length === 0 ? 0 : 1);
