#!/usr/bin/env node

/**
 * CHECK ENV — Valida el entorno contra el contrato de Isabella-Mexa.
 *
 * Compara .env.local con .env.example y verifica que las variables
 * requeridas en producción estén definidas. Exit code 1 si falta una clave
 * requerida.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url);

const REQUIRED_IN_PRODUCTION = {
  core: ["VITE_PUBLIC_APP_URL"],
  auth: ["ISABELLA_AUTH_SECRET", "API_KEY_PEPPER"],
  cors: ["CANONICAL_ORIGINS"],
  events: ["ATLAS_EVENT_SIGNING_KEY"],
  supabase: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
};

const RECOMMENDED = {
  rateLimit: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  voice: ["VOICE_API_URL"],
};

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(filePath)) return out;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    out[key] = value;
  }
  return out;
}

function exists(p: string): boolean {
  return existsSync(new URL(p, root).pathname.replace(/^\/([A-Z]:)/, "$1"));
}

const envPath = join(process.cwd(), ".env.local");
const examplePath = join(process.cwd(), ".env.example");

if (!existsSync(envPath)) {
  console.log("[CHECK-ENV] .env.local no encontrado. Copia .env.example → .env.local y completa los valores.");
  process.exit(1);
}

const local = parseEnvFile(envPath);
const example = parseEnvFile(examplePath);
const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

const missing: string[] = [];
const recommended: string[] = [];

if (isProduction) {
  for (const [group, keys] of Object.entries(REQUIRED_IN_PRODUCTION)) {
    const absent = keys.filter((k) => !local[k]);
    if (absent.length) missing.push(`${group}: ${absent.join(", ")}`);
  }
  for (const [group, keys] of Object.entries(RECOMMENDED)) {
    const absent = keys.filter((k) => !local[k]);
    if (absent.length) recommended.push(`${group}: ${absent.join(", ")}`);
  }
}

const configured = Object.keys(local).filter((k) => local[k]).length;
console.log(`[CHECK-ENV] .env.local: ${configured} variables configuradas`);

if (missing.length) {
  console.error(`[ERROR] Faltan claves REQUERIDAS en producción:\n  ${missing.join("\n  ")}`);
} else if (isProduction) {
  console.log("[OK] Todas las claves requeridas en producción presentes");
} else {
  console.log("[OK] Modo desarrollo — claves requeridas omitidas");
}

if (recommended.length) {
  console.warn(`[WARN] Claves recomendadas faltantes:\n  ${recommended.join("\n  ")}`);
}

const undocumented = Object.keys(local).filter((k) => !(k in example));
if (undocumented.length) {
  console.warn(`[WARN] Variables no documentadas en .env.example:\n  ${undocumented.join(", ")}`);
}

process.exit(missing.length ? 1 : 0);
