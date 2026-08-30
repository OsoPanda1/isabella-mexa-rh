import React from "react";

interface DemoDataNoticeProps {
  label?: string;
  note?: string;
}

export const DemoDataNotice: React.FC<DemoDataNoticeProps> = ({
  label = "DEMO",
  note = "Datos de demostración. No representan un libro real verificado en producción.",
}) => (
  <div className="flex items-center gap-2 px-3 py-1.5 mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-mono">
    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 font-bold">{label}</span>
    <span>{note}</span>
  </div>
);
