/**
 * ISABELLA VILLASEÑOR AI — INGRESS MESH BARREL EXPORT
 */
export { ingestPacket, deliverPacket, ingestAndDeliver, getIngressMetrics, getRoutingTable, shutdownIngress } from "./ingress-distributor";
export type { IngressPacket, IngressResult, IngressMetrics, IngressRoute, IngressPriority } from "./ingress-distributor";

export { heartbeat, recordFailure, getHealthSnapshot, getModuleHealth, getAlertLog, isModuleHealthy, getHealthyModules } from "./health-monitor";
export type { ModuleHealth, HealthSnapshot, AlertEvent, AlertLevel } from "./health-monitor";

export { partitionData, getModuleLoadSnapshot, trackModuleProcessing } from "./data-partitioner";
export type { PartitionResult, ModuleLoad } from "./data-partitioner";

export { resolveWithFallback, executeWithFallback, getCurrentDegradationMode, getDegradationCapabilities, getCircuitBreakerStates, recordCircuitSuccess, recordCircuitFailure, isCircuitOpen } from "./resilience-protocol";
export type { CircuitBreakerState, FallbackChain, DegradationMode } from "./resilience-protocol";
