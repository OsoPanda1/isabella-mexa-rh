/**
 * Tests: MCP Adapters (Zenodo V2, LITLE V2, Hub)
 */
import { describe, it, expect } from "vitest";
import { ZenodoMCPAdapterV2 } from "../src/lib/mcp-adapters/zenodo-mcp-adapter";
import { LitleMCPAdapterV2 } from "../src/lib/mcp-adapters/litle-mcp-adapter";
import type { MCPQueryContext } from "../src/lib/claim-radar/contracts";

function makeCtx(overrides: Partial<MCPQueryContext> = {}): MCPQueryContext {
  return {
    requestId: "00000000-0000-0000-0000-000000000001",
    assertionId: "00000000-0000-0000-0000-000000000002",
    assertion: "Quantum computing advances in 2025",
    maxResults: 5,
    deadlineMs: 5000,
    dataClass: "public",
    ...overrides,
  };
}

describe("ZenodoMCPAdapterV2", () => {
  it("always returns epistemic.status = insufficient (retrieval ≠ verification)", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        hits: {
          hits: [
            {
              id: 12345,
              doi: "10.1234/test",
              links: { html: "https://zenodo.org/record/12345" },
              metadata: {
                title: "Test Paper on Quantum Computing",
                description: "A test paper about quantum computing advances.",
                publication_date: "2025-01-15",
                creators: [{ name: "Test Author" }],
                license: { id: "cc-by-4.0" },
              },
            },
          ],
        },
      }),
    };
    const mockFetch = async () => mockResponse as any;
    const adapter = new ZenodoMCPAdapterV2("https://zenodo.org/api/records", mockFetch);

    const results = await adapter.query(makeCtx());
    expect(results.length).toBe(1);
    expect(results[0].epistemic.status).toBe("insufficient");
    expect(results[0].epistemic.reasonCode).toBe("RETRIEVAL_IS_NOT_VERIFICATION");
    expect(results[0].repository).toBe("ZENODO");
    expect(results[0].relevance.method).toBe("bm25");
    expect(results[0].provenance.adapterVersion).toBe("2.0.0");
  });

  it("returns empty on fetch failure", async () => {
    const failingFetch = async () => { throw new Error("network down"); };
    const adapter = new ZenodoMCPAdapterV2("https://zenodo.org/api/records", failingFetch as any);
    const results = await adapter.query(makeCtx());
    expect(results).toEqual([]);
  });

  it("returns empty on HTTP error", async () => {
    const errorFetch = async () => ({ ok: false, status: 503 });
    const adapter = new ZenodoMCPAdapterV2("https://zenodo.org/api/records", errorFetch as any);
    const results = await adapter.query(makeCtx());
    expect(results).toEqual([]);
  });

  it("filters malformed hits via Zod validation", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        hits: {
          hits: [
            { id: 999, metadata: {} },
            {
              id: 1000,
              links: { html: "https://zenodo.org/record/1000" },
              metadata: {
                title: "Valid Record",
                description: "Description",
              },
            },
          ],
        },
      }),
    };
    const mockFetch = async () => mockResponse as any;
    const adapter = new ZenodoMCPAdapterV2("https://zenodo.org/api/records", mockFetch);
    const results = await adapter.query(makeCtx());
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Valid Record");
  });

  it("health check returns ready", async () => {
    const adapter = new ZenodoMCPAdapterV2();
    const health = await adapter.health();
    expect(health.ready).toBe(true);
  });
});

describe("LitleMCPAdapterV2", () => {
  it("returns empty without embedding", async () => {
    const adapter = new LitleMCPAdapterV2("/nonexistent/path.json");
    const results = await adapter.query(makeCtx());
    expect(results).toEqual([]);
  });

  it("health returns false for nonexistent index", async () => {
    const adapter = new LitleMCPAdapterV2("/nonexistent/path.json");
    const health = await adapter.health();
    expect(health.ready).toBe(false);
  });
});
