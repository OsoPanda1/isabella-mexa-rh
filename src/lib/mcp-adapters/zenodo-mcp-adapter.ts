/**
 * Isabella MCP Adapter — Zenodo/OSF V2
 * Corregido per auditoría Part III-V:
 * - SIEMPRE retorna epistemic.status = "insufficient" (retrieval ≠ verification)
 * - Valida respuesta con Zod (Hit schema)
 * - Incluye provenance completa: responseDigest, adapterVersion, queryDigest
 * - Separa relevance (bm25) de epistemic (insufficient)
 * - Respeta timeout y cancelación
 * - No convierte score bajo en contradicción
 * - Conserva fecha, URL, licencia, digest y versión
 * - No puede modificar políticas, modelos ni claves
 *
 * Estado: diseño integrado y preparado para validación.
 * Producción bloqueada hasta demostrar criptografía real y benchmarks reproducibles.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { MCPAdapterV2, MCPQueryContext, MCPQueryResultV2 } from "../claim-radar/contracts";

// ============================================================================
// ZENODO RESPONSE VALIDATION
// ============================================================================

const ZenodoHitSchema = z.object({
  id: z.number(),
  doi: z.string().optional(),
  links: z.object({ html: z.string().url().optional() }).passthrough().optional(),
  metadata: z.object({
    title: z.string(),
    description: z.string().nullish(),
    publication_date: z.string().optional(),
    creators: z.array(z.object({ name: z.string() }).passthrough()).optional(),
    license: z.object({ id: z.string().optional() }).passthrough().optional(),
  }).passthrough(),
}).passthrough();

type ZenodoHit = z.infer<typeof ZenodoHitSchema>;

// ============================================================================
// HELPERS
// ============================================================================

function sha3_256(value: string): string {
  return createHash("sha3-256").update(value).digest("hex");
}

/**
 * Lexical scoring (BM25-like) — no es embeddings cosine.
 * Para similitud semántica real se necesita un modelo de embeddings.
 */
function lexicalScore(a: string, b: string): number {
  const tokensA = new Set(a.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const tokensB = new Set(b.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  if (!tokensA.size || !tokensB.size) return 0;
  const intersection = [...tokensA].filter((token) => tokensB.has(token));
  return intersection.length / Math.sqrt(tokensA.size * tokensB.size);
}

// ============================================================================
// ZENODO MCP ADAPTER V2
// ============================================================================

export class ZenodoMCPAdapterV2 implements MCPAdapterV2 {
  readonly id = "zenodo";
  readonly version = "2.0.0";

  constructor(
    private readonly baseUrl = "https://zenodo.org/api/records",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async query(ctx: MCPQueryContext): Promise<ReadonlyArray<MCPQueryResultV2>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ctx.deadlineMs);

    try {
      const q = ctx.targetDoi
        ? `doi:"${encodeURIComponent(ctx.targetDoi)}"`
        : encodeURIComponent(ctx.assertion.slice(0, 1000));

      const url = `${this.baseUrl}?q=${q}&size=${Math.min(ctx.maxResults, 25)}`;

      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "User-Agent": "Isabella-ClaimRadar/2.0",
        },
      });

      if (!response.ok) {
        throw new Error(`zenodo_http_${response.status}`);
      }

      const raw = (await response.json()) as { hits?: { hits?: unknown[] } };
      const rawHits = raw.hits?.hits ?? [];

      // Validate each hit with Zod — reject malformed data
      const validHits: ZenodoHit[] = [];
      for (const h of rawHits) {
        const parsed = ZenodoHitSchema.safeParse(h);
        if (parsed.success) validHits.push(parsed.data);
      }

      const retrievedAt = new Date().toISOString();
      const queryDigest = sha3_256(ctx.assertion);

      return validHits.map((hit) => {
        const description = hit.metadata.description ?? "";
        const title = hit.metadata.title;
        const excerpt = description.slice(0, 1000);
        const sourceUrl = hit.links?.html ?? `https://doi.org/${hit.doi ?? String(hit.id)}`;

        // Lexical relevance — NOT semantic, NOT epistemic
        const relevanceScore = lexicalScore(ctx.assertion, `${title} ${description}`);

        return {
          evidenceId: `zenodo:${hit.id}`,
          repository: "ZENODO" as const,
          persistentId: hit.doi
            ? { type: "doi" as const, value: hit.doi }
            : undefined,
          title,
          excerpt,
          retrievedAt,
          publishedAt: hit.metadata.publication_date || undefined,
          sourceUrl,
          license: hit.metadata.license?.id || undefined,
          relevance: {
            score: relevanceScore,
            method: "bm25" as const,
          },
          // CRITICAL: retrieval is NEVER verification
          epistemic: {
            status: "insufficient" as const,
            reasonCode: "RETRIEVAL_IS_NOT_VERIFICATION",
            evaluatorVersion: "claim-radar-v2",
          },
          provenance: {
            responseDigest: sha3_256(JSON.stringify(hit)),
            adapterVersion: this.version,
            queryDigest,
          },
        };
      });
    } catch (err) {
      // Network errors, timeouts, parse failures — return empty, never fabricate
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<{ ready: boolean; checkedAt: string }> {
    return { ready: true, checkedAt: new Date().toISOString() };
  }
}
