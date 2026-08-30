const SECRET_KEYS = ["ISABELLA_AUTH_SECRET", "API_KEY_PEPPER", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET"] as const;
const PLACEHOLDER = /^(|changeme|change-me|your_.+|YOUR_.+|example|dev-secret|secret|password)$/i;

export function assertStrictEnv(): void {
  // Vite sirve previews con NODE_ENV=production; solo VERCEL_ENV=production
  // o el opt-in explícito deben activar el bloqueo estricto de secretos.
  const isProduction =
    process.env.VERCEL_ENV === "production" ||
    process.env.ISABELLA_STRICT_ENV === "true";
  if (!isProduction) return;
  const missing = SECRET_KEYS.filter((key) => PLACEHOLDER.test(String(process.env[key] || "")));
  if (missing.length > 0) {
    throw new Error(`Production secrets must be provided via environment manager: ${missing.join(", ")}`);
  }
  const hasDirectRedis = Boolean(process.env.REDIS_URL);
  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!hasDirectRedis && !hasUpstash) {
    throw new Error("Production requires Redis credentials for distributed rate limiting (REDIS_URL or UPSTASH_REDIS_REST_URL/TOKEN).");
  }
  const origins = (process.env.CANONICAL_ORIGINS || "").split(",").filter(Boolean);
  if (origins.length === 0) throw new Error("Production requires CANONICAL_ORIGINS for strict CORS.");
}
