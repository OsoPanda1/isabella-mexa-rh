export type FeatureFlag =
  | "isabella.cognitive.v2"
  | "isabella.quantum.route"
  | "isabella.async.jobs"
  | "isabella.graph.memory"
  | "isabella.external.providers"
  | "isabella.strict.audit"
  | "isabella.degraded.mode";

export interface FlagContext {
  tenantId?: string;
  userId?: string;
  role?: string;
  environment: "development" | "staging" | "production";
  attributes?: Record<string, string | number | boolean>;
}

export interface FlagEvaluation {
  flag: FeatureFlag;
  enabled: boolean;
  reason: "global" | "environment" | "tenant" | "role" | "rollout" | "disabled";
}

type FlagRule = {
  enabled: boolean;
  environments?: readonly string[];
  tenants?: readonly string[];
  roles?: readonly string[];
  rollout?: number;
};

const FLAGS: Record<FeatureFlag, FlagRule> = {
  "isabella.cognitive.v2": {
    enabled: true,
  },
  "isabella.quantum.route": {
    enabled: false,
    environments: ["development", "staging"],
    rollout: 10,
  },
  "isabella.async.jobs": {
    enabled: true,
  },
  "isabella.graph.memory": {
    enabled: true,
  },
  "isabella.external.providers": {
    enabled: true,
    environments: ["development", "staging", "production"],
  },
  "isabella.strict.audit": {
    enabled: true,
    environments: ["staging", "production"],
  },
  "isabella.degraded.mode": {
    enabled: true,
  },
};

const stableBucket = (input: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 100;
};

export class FeatureFlagService {
  public isEnabled(flag: FeatureFlag, context: FlagContext): boolean {
    const rule = FLAGS[flag];
    if (!rule || !rule.enabled) return false;

    if (rule.environments && !rule.environments.includes(context.environment)) {
      return false;
    }

    if (rule.tenants && (!context.tenantId || !rule.tenants.includes(context.tenantId))) {
      return false;
    }

    if (rule.roles && (!context.role || !rule.roles.includes(context.role))) {
      return false;
    }

    if (rule.rollout === undefined) {
      return true;
    }

    const subject = context.tenantId ?? context.userId ?? "anonymous";
    return stableBucket(`${flag}:${subject}`) < rule.rollout;
  }

  public evaluate(flag: FeatureFlag, context: FlagContext): FlagEvaluation {
    const enabled = this.isEnabled(flag, context);
    return {
      flag,
      enabled,
      reason: enabled ? "global" : "disabled",
    };
  }

  public snapshot(context: FlagContext): Record<FeatureFlag, boolean> {
    return Object.fromEntries(
      Object.keys(FLAGS).map((flag) => [
        flag,
        this.isEnabled(flag as FeatureFlag, context),
      ]),
    ) as Record<FeatureFlag, boolean>;
  }
}

export const featureFlagService = new FeatureFlagService();
