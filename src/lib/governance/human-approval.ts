/* ============================================================================
 * Governance — Human Oversight & Approval Gate
 *
 * La supervisión humana NO es un botón "Aceptar". Requiere una persona con
 * autoridad, información suficiente, capacidad de intervenir y revertir, y
 * un registro auditable de la decisión.
 *
 * Niveles:
 *   H0 — sin impacto:          automatización permitida
 *   H1 — revisión posterior:   revisión por muestreo
 *   H2 — aprobación humana:    no ejecutar hasta aprobación
 *   H3 — doble aprobación:     dos personas independientes
 *   H4 — decisión humana exclusiva: Isabella solo asiste; no decide ni ejecuta
 *
 * Referencias de diseño: UNESCO (supervisión humana), WEF (controles
 * operativos y accountability).
 * ============================================================================ */
import type { NextFunction, Request, Response } from "express";

export type HumanOversightLevel = "H0" | "H1" | "H2" | "H3" | "H4";

export interface HumanApproval {
  approvalId: string;
  decisionId: string;
  reviewerSubject: string;
  reviewerRole: string;
  action: string;
  scope: string;
  evidenceRefs: string[];
  decision: "approve" | "reject" | "request_changes";
  reason: string;
  createdAt: string;
  expiresAt: string;
  secondReviewerId?: string;
  secondReviewerRole?: string;
}

export const OVERSIGHT_ORDER: Record<HumanOversightLevel, number> = {
  H0: 0,
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Valida el contrato de aprobación (reglas anti-elusión). */
export function validateApproval(input: Partial<HumanApproval>, requiredLevel: HumanOversightLevel): string | null {
  if (!input.reviewerSubject) return "Falta reviewerSubject (no se permite autoaprobación anónima).";
  if (input.decision === "approve" && !input.reason?.trim()) return "Una aprobación sin motivo no es válida.";
  if (input.expiresAt && new Date(input.expiresAt).getTime() < Date.now()) return "La aprobación ha expirado.";
  if (input.decision !== "approve" && input.decision !== "reject" && input.decision !== "request_changes") {
    return "Decisión inválida.";
  }
  if (requiredLevel === "H3" && (!input.secondReviewerId || input.secondReviewerId === input.reviewerSubject)) {
    return "H3 requiere un segundo aprobador independiente.";
  }
  return null;
}

/**
 * Decide si una acción requiere aprobación humana. En H2+ la acción queda en
 * estado "pending_human_approval" y NO se ejecuta en el acto.
 */
export function gateAction(options: {
  requiredLevel: HumanOversightLevel;
  action: string;
  scope: string;
  evidenceRefs?: string[];
  approvals?: HumanApproval[];
}): { status: "allowed" | "blocked" | "pending_human_approval"; reason?: string; approval?: Partial<HumanApproval> } {
  const need = OVERSIGHT_ORDER[options.requiredLevel];
  if (need <= OVERSIGHT_ORDER.H0) {
    return { status: "allowed" };
  }
  if (need <= OVERSIGHT_ORDER.H1) {
    return { status: "allowed", reason: "H1: revisión posterior por muestreo." };
  }

  const validApprovals = (options.approvals ?? []).filter((a) => {
    if (new Date(a.expiresAt).getTime() < Date.now()) return false;
    return true;
  });

  const approvedCount = validApprovals.filter((a) => a.decision === "approve").length;
  const required = need === OVERSIGHT_ORDER.H3 ? 2 : 1;

  if (approvedCount >= required) {
    return { status: "allowed", reason: `${options.requiredLevel}: aprobación humana registrada.` };
  }

  if (need === OVERSIGHT_ORDER.H4) {
    return {
      status: "blocked",
      reason: `${options.requiredLevel}: decisión humana exclusiva; Isabella no ejecuta de forma autónoma.`,
      approval: {
        decisionId: newId("dec"),
        action: options.action,
        scope: options.scope,
        evidenceRefs: options.evidenceRefs ?? [],
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      } as HumanApproval,
    };
  }

  return {
    status: "pending_human_approval",
    reason: `${options.requiredLevel}: se requiere ${required} aprobación(es) humana(s) independiente(s).`,
    approval: {
      decisionId: newId("dec"),
      action: options.action,
      scope: options.scope,
      evidenceRefs: options.evidenceRefs ?? [],
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    } as HumanApproval,
  };
}

/**
 * Middleware de Express: bloquea (403/402) acciones que requieren aprobación
 * humana si se intentan ejecutar de forma autónoma.
 */
export function humanApprovalGate(options: { requiredLevel: HumanOversightLevel; action: string }) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const decision = gateAction({
      requiredLevel: options.requiredLevel,
      action: options.action,
      scope: "self",
    });
    if (decision.status === "allowed") {
      res.setHeader("X-Human-Oversight", options.requiredLevel);
      return next();
    }
    res.setHeader("X-Human-Oversight", options.requiredLevel);
    return res.status(decision.status === "blocked" ? 403 : 202).json({
      ok: false,
      status: decision.status,
      action: options.action,
      humanOversight: options.requiredLevel,
      error: { code: "HUMAN_APPROVAL_REQUIRED", message: decision.reason },
      approval: decision.approval,
    });
  };
}
