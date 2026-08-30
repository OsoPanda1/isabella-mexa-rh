import * as React from "react";
import { useEffect } from "react";

export interface IsabellaOnboardingFlowProps {
  mode?: "unified" | "compact" | "legacy";
  onComplete?: () => void;
  skipDelayMs?: number;
}

export function IsabellaOnboardingFlow({
  onComplete,
  skipDelayMs = 800,
}: IsabellaOnboardingFlowProps) {
  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), skipDelayMs);
    return () => clearTimeout(t);
  }, [onComplete, skipDelayMs]);

  return (
    <div className="min-h-dvh w-full flex items-center justify-center app-shell">
      <div className="surface-raised frame-isabella max-w-md w-full mx-6 animate-in fade-in duration-700">
        <div className="panel-header">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Bienvenida al Nodo Cero
          </h2>
          <p className="text-sm text-slate-400">
            Iniciando infraestructura cognitiva territorial…
          </p>
        </div>
        <div className="panel-content">
          <div className="h-2 w-full bg-slate-800/60 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-gradient-to-r from-[#e0bb5d] via-[#f2ba57] to-[#c98e7a] animate-[gradient-aurora_2.2s_ease_infinite]" />
          </div>
        </div>
        <div className="panel-footer text-[11px] font-mono text-slate-500">
          Isabella v5.3 · Enterprise Cognitive Design System
        </div>
      </div>
    </div>
  );
}

export default IsabellaOnboardingFlow;
