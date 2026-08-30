import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const baseDir = process.env.ISABELLA_DATA_DIR || join(process.cwd(), ".isabella-data");

// P0-02: almacenamiento TRANSIENTE (cache/local), NO system-of-record. El
// source of truth para estado critico (ledger, economy, wallet, billing,
// apiKeys, audit, memory) es PostgreSQL. Ver src/lib/persistence/authority.ts.
export const DURABLE_JSON_TIER = "transient" as const;

export function loadJsonArray<T>(name: string, fallback: T[] = []): T[] {
  const file = join(baseDir, `${name}.json`);
  if (!existsSync(file)) return [...fallback];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed as T[] : [...fallback];
  } catch {
    return [...fallback];
  }
}

export function saveJsonArray<T>(name: string, rows: T[]): void {
  const file = join(baseDir, `${name}.json`);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(rows, null, 2));
  renameSync(tmp, file);
}
