type LogLevel = "debug" | "info" | "warn" | "error";

function getRandomUUID(): string {
  if (typeof globalThis !== "undefined") {
    const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
    if (g.crypto && typeof g.crypto.randomUUID === "function") return g.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface LogEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  traceId?: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel = LEVEL_PRIORITY[(process.env.LOG_LEVEL as LogLevel) || "info"] ?? 1;

function emit(entry: LogEntry): void {
  if (LEVEL_PRIORITY[entry.level] < minLevel) return;
  const json = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(json);
  } else if (entry.level === "warn") {
    console.warn(json);
  } else {
    console.log(json);
  }
}

export function createLogger(scope: string, defaultMeta?: Record<string, unknown>) {
  return {
    debug(event: string, meta?: Record<string, unknown>) {
      emit({ level: "debug", event, timestamp: new Date().toISOString(), scope, ...defaultMeta, ...meta });
    },
    info(event: string, meta?: Record<string, unknown>) {
      emit({ level: "info", event, timestamp: new Date().toISOString(), scope, ...defaultMeta, ...meta });
    },
    warn(event: string, meta?: Record<string, unknown>) {
      emit({ level: "warn", event, timestamp: new Date().toISOString(), scope, ...defaultMeta, ...meta });
    },
    error(event: string, meta?: Record<string, unknown>) {
      emit({ level: "error", event, timestamp: new Date().toISOString(), scope, ...defaultMeta, ...meta });
    },
    child(extra: Record<string, unknown>) {
      return createLogger(scope, { ...defaultMeta, ...extra });
    },
  };
}

export function generateTraceId(): string {
  return `isabella-${getRandomUUID()}`;
}

export const logger = createLogger("isabella");
