import { FEATURE_FLAGS, type FeatureFlagKey } from "../../config/feature-flags/catalog";
import { getSafeDefault } from "./safe-defaults";

export interface FlagResolution {
  readonly key: FeatureFlagKey;
  readonly value: boolean;
  readonly source: "statsig" | "safe_default" | "override";
  readonly stale: boolean;
  readonly evaluatedAt: string;
}

export async function resolveFlag(
  key: FeatureFlagKey,
  reader: () => Promise<boolean>,
): Promise<FlagResolution> {
  try {
    const value = await reader();
    return {
      key,
      value,
      source: "statsig",
      stale: false,
      evaluatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      key,
      value: getSafeDefault(key),
      source: "safe_default",
      stale: true,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export function assertFlagCanRunInEnvironment(
  key: FeatureFlagKey,
  environment: string,
): void {
  const definition = FEATURE_FLAGS[key];
  if (!definition) {
    throw new Error(`FLAG_NOT_FOUND:${key}`);
  }
  if (!definition.allowedEnvironments.includes(environment)) {
    throw new Error(`FLAG_ENVIRONMENT_DENIED:${key}:${environment}`);
  }
}
