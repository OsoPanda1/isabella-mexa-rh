import { FEATURE_FLAGS, type FeatureFlagKey } from "../../config/feature-flags/catalog";

export function getSafeDefault(key: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[key]?.defaultValue ?? false;
}

export function getSafeDefaults(): Record<FeatureFlagKey, boolean> {
  return Object.fromEntries(
    Object.keys(FEATURE_FLAGS).map((key) => [
      key,
      getSafeDefault(key as FeatureFlagKey),
    ]),
  ) as Record<FeatureFlagKey, boolean>;
}
