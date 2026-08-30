import React from "react";
import { Loader2, Activity } from "lucide-react";

export const SuspenseFallback: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-[#020409] animate-fade-in relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-radial from-amber-500/5 via-transparent to-transparent opacity-50" />
      
      {/* Container */}
      <div className="relative z-10 flex flex-col items-center gap-6 p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl shadow-2xl max-w-sm w-full mx-4">
        
        {/* Core Animated Spinner */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-amber-500/20 scale-125 animate-ping opacity-20" />
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
        </div>

        {/* Text Area */}
        <div className="text-center space-y-2">
          <h3 className="text-sm font-bold text-slate-100 tracking-wider flex items-center justify-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            INICIALIZANDO MÓDULO
          </h3>
          <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">
            Isabella AI :: Cargando vista...
          </p>
        </div>

        {/* Loading Progress Bar Mock */}
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 via-sky-400 to-amber-300 w-1/2 animate-slide-right rounded-full" />
        </div>
      </div>
    </div>
  );
};
