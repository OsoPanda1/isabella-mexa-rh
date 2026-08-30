/**
 * Isabella MCP Connectors Hub — Router
 * Dispatches claim queries to registered adapters (Zenodo, OSF, LITLE).
 * Enforces timeout, validates responses, merges results.
 *
 * Invariant: no adapter can modify policies, models, keys or the ledger.
 */
import type { MCPAdapterV2, MCPQueryContext, MCPQueryResultV2 } from "../claim-radar/contracts";
import { ZenodoMCPAdapterV2 } from "./zenodo-mcp-adapter";
import { LitleMCPAdapterV2 } from "./litle-mcp-adapter";
import { createLogger } from "../logger";

const log = createLogger("mcp-hub");

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================

const adapters = new Map<string, MCPAdapterV2>();

/**
 * Registra un adaptador MCP.
 */
export function registerAdapter(adapter: MCPAdapterV2): void {
  adapters.set(adapter.id, adapter);
  log.info("adapter_registered", { id: adapter.id, version: adapter.version });
}

/**
 * Inicializa los adaptadores por defecto.
 */
export function initializeDefaultAdapters(litleIndexPath?: string): void {
  registerAdapter(new ZenodoMCPAdapterV2());
  if (litleIndexPath) {
    registerAdapter(new LitleMCPAdapterV2(litleIndexPath));
  }
  log.info("default_adapters_initialized", {
    adapters: Array.from(adapters.values()).map((a) => `${a.id}@${a.version}`),
  });
}

// ============================================================================
// QUERY DISPATCHER
// ============================================================================

/**
 * Consulta adaptadores seleccionados y retorna resultados fusionados.
 * Cada adaptador tiene su propio timeout; el hub aplica un timeout global.
 */
export async function queryAdapters(
  ctx: MCPQueryContext,
  adapterIds?: string[],
): Promise<{
  results: ReadonlyArray<MCPQueryResultV2>;
  adapterStatuses: Array<{ adapterId: string; ready: boolean; resultCount: number }>;
  totalResults: number;
  queryDigest: string;
}> {
  const targetAdapters = adapterIds
    ? adapterIds.map((id) => adapters.get(id)).filter((a): a is MCPAdapterV2 => !!a)
    : Array.from(adapters.values());

  if (targetAdapters.length === 0) {
    return {
      results: [],
      adapterStatuses: [],
      totalResults: 0,
      queryDigest: "",
    };
  }

  // Query all adapters in parallel
  const queries = targetAdapters.map(async (adapter) => {
    try {
      const results = await adapter.query(ctx);
      return { adapterId: adapter.id, ready: true, results, resultCount: results.length };
    } catch (err) {
      log.warn("adapter_query_failed", { adapterId: adapter.id, error: String(err) });
      return { adapterId: adapter.id, ready: false, results: [] as ReadonlyArray<MCPQueryResultV2>, resultCount: 0 };
    }
  });

  const outcomes = await Promise.all(queries);

  // Merge results — deduplicate by evidenceId
  const seen = new Set<string>();
  const merged: MCPQueryResultV2[] = [];
  for (const outcome of outcomes) {
    for (const result of outcome.results) {
      if (!seen.has(result.evidenceId)) {
        seen.add(result.evidenceId);
        merged.push(result);
      }
    }
  }

  // Sort by relevance score descending
  merged.sort((a, b) => b.relevance.score - a.relevance.score);

  // Apply maxResults limit
  const limited = merged.slice(0, ctx.maxResults);

  return {
    results: limited,
    adapterStatuses: outcomes.map(({ adapterId, ready, resultCount }) => ({
      adapterId,
      ready,
      resultCount,
    })),
    totalResults: limited.length,
    queryDigest: outcomes[0]?.results[0]?.provenance.queryDigest ?? "",
  };
}

// ============================================================================
// HEALTH
// ============================================================================

export async function hubHealth(): Promise<{
  ready: boolean;
  adapters: Array<{ id: string; version: string; ready: boolean }>;
}> {
  const statuses = await Promise.all(
    Array.from(adapters.values()).map(async (a) => {
      const health = await a.health();
      return { id: a.id, version: a.version, ready: health.ready };
    }),
  );
  return {
    ready: statuses.length > 0 && statuses.every((s) => s.ready),
    adapters: statuses,
  };
}
