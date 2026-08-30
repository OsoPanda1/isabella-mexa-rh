/**
 * ISABELLA VILLASEÑOR AI - COGNITIVE & ARCHITECTURAL CONTRACTS
 * Nodo Cero :: RDM Digital :: C.R.O.W.N. Orchestration Layer
 */

export type IsabellaInputType = "chat" | "event" | "signal" | "api" | "ui";

export type IsabellaMemoryScope =
  | "immediate"
  | "session"
  | "project"
  | "territorial"
  | "historical";

export type IsabellaRiskLevel = "low" | "medium" | "high";

export type IsabellaPolicyStatus = "allowed" | "denied" | "requires_approval";

export type IsabellaSourceType = "user" | "system" | "event" | "summary";

export interface IsabellaPerception {
  sessionId?: string;
  actorId?: string;
  territoryId?: string;
  inputType: IsabellaInputType;
  payload: Record<string, unknown>;
  timestamp: string; // ISO
  metadata?: Record<string, unknown>;
}

export interface IsabellaDecisionToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
  executionResult?: Record<string, unknown>;
  status?: "pending" | "running" | "success" | "error";
}

export interface IsabellaDecision {
  decisionId: string;
  sessionId?: string;
  summary: string;
  confidence: number; // 0..1
  riskLevel: IsabellaRiskLevel;
  policyStatus: IsabellaPolicyStatus;
  policyReason?: string;
  toolCalls?: IsabellaDecisionToolCall[];
  details?: Record<string, unknown>;
  createdAt?: string;
  traceId?: string;
}

export interface IsabellaMemoryItem {
  memoryId: string;
  tenantId?: string;
  sessionId?: string;
  scope: IsabellaMemoryScope;
  content: string;
  contentJson?: Record<string, unknown>;
  sourceType: IsabellaSourceType;
  relevance: number;
  expiresAt?: string;
  checksum: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IsabellaSession {
  id: string;
  tenantId?: string;
  sessionKey: string;
  actorId?: string;
  state: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IsabellaTool {
  name: string;
  description: string;
  allowed: boolean;
  category: "territory" | "cognition" | "security" | "synthesis" | "governance";
  schema: Record<string, unknown>;
  riskRating: IsabellaRiskLevel;
  createdAt: string;
}

export interface IsabellaPolicy {
  id: string;
  policyKey: string;
  description: string;
  rules: {
    maxRiskAllowedWithoutApproval: IsabellaRiskLevel;
    requireZeroTrust: boolean;
    territoryEnforcement: boolean;
    allowedScopes: IsabellaMemoryScope[];
  };
  version: string;
  createdAt: string;
}

export interface IsabellaApproval {
  id: string;
  decisionId: string;
  approverId?: string;
  status: "pending" | "approved" | "rejected";
  comment?: string;
  createdAt: string;
}

export interface IsabellaAuditLog {
  id: string;
  tenantId?: string;
  sessionId?: string;
  actorId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  traceId: string;
  checksum?: string;
  createdAt: string;
}
