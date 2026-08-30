import * as React from "react";
import type { ReactNode } from "react";

export interface StatsigProviderProps {
  userId?: string;
  children?: ReactNode;
}

/**
 * Stub provider — Statsig integration is optional for sovereign deployments.
 * Passes children through without side effects.
 */
export function StatsigProvider({ children }: StatsigProviderProps) {
  return <>{children}</>;
}

export default StatsigProvider;
