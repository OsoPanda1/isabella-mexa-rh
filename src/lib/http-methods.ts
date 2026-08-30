/**
 * HTTP method constants shared between the Vercel wrapper and tests.
 *
 * Extracted here to avoid importing server.ts (and its Express side-effects)
 * in test environments where Express Router pathRegexp is unavailable.
 */

export const ALLOWED_METHODS = Object.freeze([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const);

export const isMethodAllowed = (method: string): boolean =>
  (ALLOWED_METHODS as readonly string[]).includes(method.toUpperCase());
