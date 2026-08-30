/* ==== Declaración consolidada de tipos Express ==== */

import type { Request } from "express";
import type { UsageDecision } from "../lib/subscription.server";
import type { QuantumBridgeRequest, QuantumPolicyVerdict } from "../lib/quantum-bridge.server";

declare global {
  namespace Express {
    interface Request {
      /** Quantum Bridge: solicitud y política evaluada */
      quantumBridge?: {
        input: QuantumBridgeRequest;
        policy: QuantumPolicyVerdict;
      };
      /** Isabella Billing: identidad de usuario y decisión de uso */
      isabellaBilling?: {
        userId: string;
        decision: UsageDecision;
      };
    }
  }
}

export {};
