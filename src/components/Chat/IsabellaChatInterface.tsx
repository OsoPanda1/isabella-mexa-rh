import React, { useState, useRef, useEffect } from "react";
import { useCrown } from "../../context/CrownContext";
import { Send, Mic, Paperclip, Settings, Sparkles, Activity, Cpu, Network } from "lucide-react";
import { motion } from "motion/react";
import { soundManager } from "../../utils/soundEffects";

export const IsabellaChatInterface: React.FC = () => {
  const { state, messages, sendMessage, setActiveView } = useCrown();
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.autoScroll !== false && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, state.autoScroll, state.isProcessing]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || state.isProcessing) return;

    soundManager.playBeep(450, 0.04);
    await sendMessage(inputValue);
    setInputValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-145px)] min-h-[580px] max-h-[900px] rounded-3xl border border-slate-700/50 bg-[#02040A] shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden relative font-sans">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Sleek Enterprise Header */}
      <header className="flex items-center justify-between px-7 py-5 border-b border-slate-800/80 bg-[#050810]/95 backdrop-blur-xl relative z-10">
        <div className="flex items-center gap-4">
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-slate-700/80 shadow-[0_0_15px_rgba(58,134,255,0.2)]">
            <img
              src="/src/assets/images/isabella_sovereign_avatar_1786826317049.jpg"
              alt="Isabella"
              className="w-full h-full object-cover object-top"
            />
            <div
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#050810] ${
                state.isProcessing
                  ? "bg-blue-400 animate-pulse shadow-[0_0_10px_rgba(58,134,255,0.8)]"
                  : "bg-emerald-400"
              }`}
            />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#F8FAFC] flex items-center gap-2 tracking-wide">
              ISABELLA VILLASEÑOR
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            </h2>
            <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
              <Cpu className="w-3 h-3 text-slate-500" /> Motor Cognitivo • {state.activeHead || "Alpha Prime"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#0A192F]/50 p-1 rounded-2xl border border-slate-800/60">
          <button
            type="button"
            onClick={() => setActiveView("architecture")}
            className="p-2.5 text-slate-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-xl transition-all tooltip-trigger"
            title="Cockpit & Telemetría"
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveView("traceability")}
            className="p-2.5 text-slate-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-xl transition-all tooltip-trigger"
            title="Auditoría Zero-Trust & BookPI"
          >
            <Network className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-5 bg-slate-700/50 mx-1" />
          <button
            type="button"
            onClick={() => setActiveView("presence")}
            className="p-2.5 text-slate-400 hover:text-[#E2E8F0] hover:bg-slate-800/80 rounded-xl transition-all tooltip-trigger"
            title="Presencia y Configuración"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Chat Canvas */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-8 bg-transparent scroll-smooth relative z-10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-80 py-12">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#0A192F] to-[#112240] border border-blue-900/30 flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(58,134,255,0.15)] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
              <Network className="w-8 h-8 text-blue-400 relative z-10" />
            </motion.div>
            <h3 className="text-2xl font-semibold text-[#F8FAFC] mb-3 tracking-tight">
              Sistema Cognitivo Activo
            </h3>
            <p className="text-sm text-slate-400 max-w-md text-center leading-relaxed font-light">
              Canal soberano establecido. Cada interacción está gobernada por la arquitectura CROWN bajo políticas Zero-Trust y trazabilidad BookPI.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === "user" || msg.kind === "user_message";
            const isError =
              msg.role === "argus_alert" ||
              msg.severity === "high" ||
              msg.severity === "critical";

            return (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id || idx}
                className={`flex ${isUser ? "justify-end" : "justify-start"} group`}
              >
                <div
                  className={`flex gap-4 max-w-[85%] ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {!isUser && (
                    <div className="w-9 h-9 rounded-full border border-blue-900/50 shadow-[0_0_10px_rgba(58,134,255,0.1)] overflow-hidden shrink-0 mt-1">
                      <img
                        src="/src/assets/images/isabella_portrait_prime_1786743839065.jpg"
                        alt="Isabella"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div
                    className={`px-6 py-4 rounded-2xl text-[15px] leading-relaxed shadow-sm backdrop-blur-sm ${
                      isUser
                        ? "bg-gradient-to-br from-[#112240] to-[#0A192F] text-[#E2E8F0] rounded-tr-sm border border-blue-900/40"
                        : isError
                          ? "bg-rose-950/30 text-rose-200 rounded-tl-sm border border-rose-900/50"
                          : "bg-[#050810]/80 text-[#F8FAFC] rounded-tl-sm border border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.2)] font-light"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        {state.isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex gap-4 max-w-[85%] flex-row">
              <div className="w-9 h-9 rounded-full border border-blue-900/50 shadow-[0_0_10px_rgba(58,134,255,0.1)] overflow-hidden shrink-0 mt-1">
                <img
                  src="/src/assets/images/isabella_portrait_prime_1786743839065.jpg"
                  alt="Isabella"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="px-6 py-5 rounded-2xl rounded-tl-sm bg-[#050810]/80 border border-slate-800/80 flex items-center gap-2.5 shadow-sm backdrop-blur-sm">
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce shadow-[0_0_8px_rgba(58,134,255,0.8)]"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce shadow-[0_0_8px_rgba(58,134,255,0.8)]"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 bg-blue-500 rounded-full animate-bounce shadow-[0_0_8px_rgba(58,134,255,0.8)]"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Input Composer */}
      <div className="p-5 bg-gradient-to-t from-[#02040A] to-[#050810]/95 backdrop-blur-xl border-t border-slate-800/80 relative z-20">
        <form onSubmit={handleSend} className="relative max-w-4xl mx-auto flex items-center group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/10 to-blue-600/0 rounded-full blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <button
            type="button"
            className="absolute left-4 p-2 text-slate-500 hover:text-blue-400 transition-colors rounded-full z-10"
            title="Adjuntar archivo o contexto"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={state.isProcessing}
            placeholder={
              state.isProcessing
                ? "Isabella y CROWN sintetizando pensamiento..."
                : "Escribe a Isabella..."
            }
            className="w-full bg-[#0A192F]/60 text-[#F8FAFC] placeholder:text-slate-500 rounded-full pl-14 pr-32 py-4 focus:outline-none focus:ring-1 focus:ring-blue-500/50 border border-slate-700/60 transition-all shadow-inner text-[15px] relative z-0"
          />

          <div className="absolute right-2 flex items-center gap-1 z-10">
            <button
              type="button"
              className="p-3 text-slate-500 hover:text-blue-400 transition-colors rounded-full"
              title="Dictado por voz"
            >
              <Mic className="w-4.5 h-4.5" />
            </button>
            <button
              type="submit"
              disabled={!inputValue.trim() || state.isProcessing}
              className="p-3 bg-[#E2E8F0] text-[#02040A] rounded-full hover:bg-white hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] disabled:opacity-30 disabled:bg-slate-700 disabled:text-slate-400 transition-all cursor-pointer"
            >
              <Send className="w-4.5 h-4.5 ml-0.5" />
            </button>
          </div>
        </form>
        <div className="text-center mt-4">
          <span className="text-[10.5px] font-mono text-slate-500 tracking-wider uppercase">
            Arquitectura Soberana • Modo Zero-Trust • Trazabilidad CROWN
          </span>
        </div>
      </div>
    </div>
  );
};
