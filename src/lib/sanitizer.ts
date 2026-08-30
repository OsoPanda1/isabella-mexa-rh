import type { VercelRequest } from "@vercel/node";
import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error" | "debug";

const SENSITIVE_PATTERNS = [
  /authorization\s*[:=]\s*[^\s,}]+/gi,
  /bearer\s+[a-z0-9._~+/=-]+/gi,
  /(token|secret|password|api[_-]?key|cookie|session)\s*[:=]\s*[^\s,}]+/gi,
];

export const sanitizeString = (input: unknown, maxLength = 500): string => {
  if (typeof input !== "string") return "";
  let clean = input.replace(/[\r\n\t\x00-\x1F\x7F]/g, " ");
  for (const pattern of SENSITIVE_PATTERNS) {
    clean = clean.replace(pattern, "[redacted]");
  }
  return clean.trim().slice(0, maxLength);
};

export const sanitizePath = (rawUrl: string | undefined): string => {
  if (!rawUrl) return "/";
  try {
    const parsed = new URL(rawUrl, "https://internal.local");
    return parsed.pathname
      .replace(/\0/g, "")
      .replace(/\/{2,}/g, "/")
      .replace(/\.\./g, "")
      .slice(0, 512) || "/";
  } catch {
    return "/invalid-path";
  }
};

export const extractTraceId = (req: VercelRequest): string => {
  const raw = req.headers["x-trace-id"];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate === "string" && /^[a-zA-Z0-9._:-]{1,128}$/.test(candidate)) {
    return candidate;
  }
  return `isabella-${randomUUID()}`;
};

export const logEvent = (
  event: string,
  data: Record<string, unknown> = {},
  level: LogLevel = "info",
): void => {
  const sanitizedData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      typeof v === "string" ? sanitizeString(v) : v,
    ]),
  );

  const payload = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitizedData,
  });

  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
};
