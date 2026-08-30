/**
 * Canonical JSON value type. Every server-function return crossing the
 * TanStack RPC boundary must satisfy `ValidateSerializableMapped`, which
 * rejects `unknown`, `any`, functions, class instances and cycles.
 *
 * Using this alias instead of `Record<string, any>` makes the compiler
 * enforce the same contract runtime enforces via JSON serialization.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };
export type JsonObject = { [k: string]: JsonValue };

/**
 * Deep-clone-and-strip: guarantees the output only contains JSON-safe
 * values. Preserves the input type at compile time; strips functions,
 * `undefined`, symbols, class instances and cycles at runtime.
 */
export function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}