/**
 * PROCESS PERCEPTION - ISABELLA COGNITIVE APPLICATION HANDLER
 * Nodo Cero :: RDM Digital
 * Canonical cycle: Perceive -> Remember -> Policy Gate -> Decide -> Act -> Audit -> Trace
 */

import { IsabellaPerception, IsabellaDecision, IsabellaDecisionToolCall } from "../../../../contracts/isabella";
import { policyGate } from "../../infrastructure/policy-gate";
import { auditTrace } from "../../infrastructure/audit-tracer";
import { addMemoryItem, queryMemory } from "../../infrastructure/memory-store";
import { executeTool } from "../../infrastructure/tools-catalog";

export async function processPerception(perception: IsabellaPerception): Promise<IsabellaDecision> {
  const traceId = (perception.metadata as any)?.traceId || `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();

  // 1. Audit incoming perception event
  await auditTrace({
    tenantId: (perception.payload as any)?.tenantId || "nodo-cero-rdm",
    sessionId: perception.sessionId,
    actorId: perception.actorId || "usr-anon",
    eventType: "perception.received",
    data: {
      inputType: perception.inputType,
      payload: perception.payload,
      timestamp: perception.timestamp,
    },
    traceId,
  });

  // 2. Retrieve relevant memory context based on input
  const queryStr = typeof (perception.payload as any)?.text === "string" 
    ? (perception.payload as any).text 
    : typeof (perception.payload as any)?.query === "string"
      ? (perception.payload as any).query
      : "";
      
  const relevantMemories = queryStr ? queryMemory({ searchQuery: queryStr, minRelevance: 0.5 }) : [];

  // 3. Policy Gate Evaluation (ARGUS Sentinel)
  const policy = await policyGate(perception);

  // If policy denies execution
  if (policy.status === "denied") {
    const decision: IsabellaDecision = {
      decisionId: `dec-denied-${Date.now()}`,
      sessionId: perception.sessionId,
      summary: `[ACCESO DENEGADO POR POLÍTICA] ${policy.reason || "Violación de reglas de seguridad territorial."}`,
      confidence: 1.0,
      riskLevel: policy.riskLevel,
      policyStatus: "denied",
      policyReason: policy.reason,
      toolCalls: [],
      details: {
        violations: policy.violations,
        rulesChecked: policy.rulesChecked,
        governanceScore: policy.governanceScore,
        latencyMs: Date.now() - startTime,
      },
      createdAt: new Date().toISOString(),
      traceId,
    };

    await auditTrace({
      tenantId: (perception.payload as any)?.tenantId,
      sessionId: perception.sessionId,
      actorId: perception.actorId,
      eventType: "decision.denied",
      data: decision as any,
      traceId,
    });

    return decision;
  }

  // If policy requires human approval
  if (policy.status === "requires_approval") {
    const decision: IsabellaDecision = {
      decisionId: `dec-approval-${Date.now()}`,
      sessionId: perception.sessionId,
      summary: `[RATIFICACIÓN REQUERIDA] ${policy.reason || "Esta acción requiere autorización explícita de un operador de Nodo Cero."}`,
      confidence: 0.85,
      riskLevel: policy.riskLevel,
      policyStatus: "requires_approval",
      policyReason: policy.reason,
      toolCalls: [],
      details: {
        rulesChecked: policy.rulesChecked,
        governanceScore: policy.governanceScore,
        pendingApproval: true,
        latencyMs: Date.now() - startTime,
      },
      createdAt: new Date().toISOString(),
      traceId,
    };

    await auditTrace({
      tenantId: (perception.payload as any)?.tenantId,
      sessionId: perception.sessionId,
      actorId: perception.actorId,
      eventType: "decision.requires_approval",
      data: decision as any,
      traceId,
    });

    return decision;
  }

  // 4. Determine Tool Calls based on perception payload
  const payload = perception.payload || {};
  const requestedTool = (payload.toolName || (payload.toolCall as any)?.name) as string | undefined;
  const toolCalls: IsabellaDecisionToolCall[] = [];

  if (requestedTool) {
    const toolCallItem: IsabellaDecisionToolCall = {
      toolName: requestedTool,
      arguments: (payload.toolArgs || (payload.toolCall as any)?.args || {}) as Record<string, unknown>,
      status: "running",
    };

    // Execute tool
    const exec = await executeTool(toolCallItem);
    toolCallItem.status = exec.success ? "success" : "error";
    toolCallItem.executionResult = exec.result;
    toolCalls.push(toolCallItem);
  } else if (queryStr.toLowerCase().includes("territorio") || queryStr.toLowerCase().includes("real del monte") || queryStr.toLowerCase().includes("panteon") || queryStr.toLowerCase().includes("paste")) {
    const territoryTool: IsabellaDecisionToolCall = {
      toolName: "rdm_territory_query",
      arguments: { category: "patrimonio", query: queryStr },
      status: "running",
    };
    const exec = await executeTool(territoryTool);
    territoryTool.status = exec.success ? "success" : "error";
    territoryTool.executionResult = exec.result;
    toolCalls.push(territoryTool);
  }

  // 5. Generate summary response
  const summaryText = typeof payload.text === "string"
    ? `[C.R.O.W.N. Governed Decision] Procesamiento cognitivo ejecutado exitosamente para intención: "${payload.text.substring(0, 80)}..."`
    : `[C.R.O.W.N. Governed Decision] Percepción tipo [${perception.inputType}] procesada con éxito.`;

  const decision: IsabellaDecision = {
    decisionId: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sessionId: perception.sessionId,
    summary: summaryText,
    confidence: 0.98,
    riskLevel: policy.riskLevel,
    policyStatus: "allowed",
    policyReason: policy.reason,
    toolCalls,
    details: {
      governanceScore: policy.governanceScore,
      rulesChecked: policy.rulesChecked,
      relevantMemoriesCount: relevantMemories.length,
      latencyMs: Date.now() - startTime,
      nodoCeroValidated: true,
    },
    createdAt: new Date().toISOString(),
    traceId,
  };

  // 6. Record in immediate memory if text was provided
  if (queryStr && queryStr.length > 5) {
    await addMemoryItem({
      tenantId: "nodo-cero-rdm",
      sessionId: perception.sessionId,
      scope: "immediate",
      content: `Percepción [${perception.inputType}]: ${queryStr}`,
      sourceType: perception.inputType === "chat" ? "user" : "system",
      relevance: 0.9,
    });
  }

  // 7. Audit decision created
  await auditTrace({
    tenantId: (perception.payload as any)?.tenantId,
    sessionId: perception.sessionId,
    actorId: perception.actorId,
    eventType: "decision.created",
    data: {
      decisionId: decision.decisionId,
      policyStatus: decision.policyStatus,
      riskLevel: decision.riskLevel,
      toolCallsCount: toolCalls.length,
      latencyMs: Date.now() - startTime,
    },
    traceId,
  });

  return decision;
}
