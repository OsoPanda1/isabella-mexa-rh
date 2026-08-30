/**
 * ============================================================================
 * ISABELLA PLATFORM HTTP GATEWAY CONFIGURATION
 * ============================================================================
 * Centralized, bounded, immutable runtime configuration for edge and serverless
 * request execution across Node.js, Vercel Functions, and standalone runtimes.
 * ============================================================================
 */

export interface GatewayConfig {
  readonly timeoutMs: number;
  readonly maxUrlLength: number;
  readonly maxBodyBytes: number;
  readonly maxTraceLength: number;
  readonly circuitThreshold: number;
  readonly circuitResetMs: number;
  readonly circuitHalfOpenRequests: number;
  readonly requireOriginForMutations: boolean;
  readonly allowedOrigins: readonly string[];
  readonly trustProxy: boolean;
}

const intEnv = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const boolEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

const normalizeOrigin = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
};

export const GATEWAY_CONFIG: Readonly<GatewayConfig> = Object.freeze({
  timeoutMs: intEnv(process.env.API_TIMEOUT_SECONDS, 45, 1, 55) * 1000,
  maxUrlLength: intEnv(process.env.API_MAX_URL_LENGTH, 4096, 256, 16_384),
  maxBodyBytes: intEnv(process.env.API_MAX_BODY_BYTES, 1_048_576, 16_384, 10_485_760),
  maxTraceLength: 128,
  circuitThreshold: intEnv(process.env.CIRCUIT_BREAKER_THRESHOLD, 5, 2, 50),
  circuitResetMs: intEnv(process.env.CIRCUIT_BREAKER_RESET_MS, 30_000, 5_000, 300_000),
  circuitHalfOpenRequests: intEnv(process.env.CIRCUIT_HALF_OPEN_REQUESTS, 1, 1, 10),
  requireOriginForMutations: boolEnv(process.env.REQUIRE_ORIGIN, false),
  allowedOrigins: Object.freeze(
    (process.env.CANONICAL_ORIGINS ?? "")
      .split(",")
      .map((origin) => normalizeOrigin(origin.trim()))
      .filter((origin): origin is string => Boolean(origin)),
  ),
  trustProxy: boolEnv(process.env.TRUST_PROXY, false),
});
