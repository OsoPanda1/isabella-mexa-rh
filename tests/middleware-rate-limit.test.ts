/**
 * Tests: rateLimit middleware — memory fallback path, 429 on exceeded limit
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../src/lib/auth.server", () => ({
  currentPrincipal: () => { throw new Error("no auth"); },
}));

vi.mock("../src/lib/subscription.server", () => ({
  buildCheckoutUrl: () => "https://checkout.example.com",
  consumeUsage: () => ({
    allowed: true,
    plan: { id: "free" },
    reason: null,
    resetAt: new Date().toISOString(),
    remaining: { messages: 10 },
    usage: {},
  }),
  stableUserId: (s: string) => s,
}));

const { rateLimit } = await import("../src/middleware/rateLimit");

function makeReqRes() {
  const req = {
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as Request;
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => { headers[k] = v; },
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return { req, res, headers };
}

describe("rateLimit middleware", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_PER_MINUTE = "5";
  });

  it("sets rate limit headers and calls next", async () => {
    const { req, res, headers } = makeReqRes();
    const next = vi.fn() as unknown as NextFunction;
    await rateLimit(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(headers["X-RateLimit-Remaining"]).toBeDefined();
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
  });

  it("returns 429 when limit exceeded", async () => {
    const { req, res } = makeReqRes();
    const next = vi.fn() as unknown as NextFunction;
    for (let i = 0; i < 6; i++) {
      await rateLimit(req, res, next);
    }
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
