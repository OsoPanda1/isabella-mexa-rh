import type { RequestHandler } from "express";
import { getSafeDefaults } from "./safe-defaults";
import { isabellaFlags } from "../../../flags";

export interface IsabellaFlagLocals {
  flags: Record<string, boolean>;
  stale: boolean;
}

export const loadFeatureFlags = (): RequestHandler => async (_req, res, next) => {
  const defaults = getSafeDefaults();
  try {
    const [
      federationsRouting,
      aiModelFallback,
      conversationalCanvasV2,
      strictRateLimiting,
      graphMemory,
      quantumRoute,
    ] = await Promise.all([
      isabellaFlags.federationsRouting(),
      isabellaFlags.aiModelFallback(),
      isabellaFlags.conversationalCanvasV2(),
      isabellaFlags.strictRateLimiting(),
      isabellaFlags.graphMemory(),
      isabellaFlags.quantumRoute(),
    ]);

    res.locals.featureFlags = {
      flags: {
        tamv_7_federations_routing: federationsRouting,
        isabella_ai_model_fallback: aiModelFallback,
        isabella_conversational_canvas_v2: conversationalCanvasV2,
        isabella_strict_rate_limiting: strictRateLimiting,
        isabella_graph_memory: graphMemory,
        isabella_quantum_route: quantumRoute,
      },
      stale: false,
    } satisfies IsabellaFlagLocals;
    next();
  } catch {
    res.locals.featureFlags = {
      flags: defaults,
      stale: true,
    } satisfies IsabellaFlagLocals;
    next();
  }
};

export const requireFeature = (key: string): RequestHandler => (req, res, next) => {
  const state = res.locals.featureFlags as IsabellaFlagLocals | undefined;
  const enabled = Boolean(state?.flags?.[key]);
  if (!enabled) {
    res.status(404).json({
      error: {
        code: "FEATURE_NOT_AVAILABLE",
        trace_id: (req as any).traceId || "trace-unknown",
        feature: key,
        stale: state?.stale ?? true,
      },
    });
    return;
  }
  next();
};

export const requireOperationalFeature = (key: string): RequestHandler => (req, res, next) => {
  const state = res.locals.featureFlags as IsabellaFlagLocals | undefined;
  const enabled = Boolean(state?.flags?.[key]);
  if (!enabled) {
    res.status(503).json({
      error: {
        code: "CAPABILITY_TEMPORARILY_DISABLED",
        trace_id: (req as any).traceId || "trace-unknown",
        feature: key,
        retryable: true,
        stale: state?.stale ?? true,
      },
    });
    return;
  }
  next();
};
