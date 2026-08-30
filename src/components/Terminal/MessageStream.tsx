import React, { useState, useRef, useEffect } from "react";
import { TerminalMessage, CognitiveModuleId } from "../../types";
import { useCrown } from "../../context/CrownContext";
import {
  Brain,
  Shield,
  Heart,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
  Volume2,
  Copy,
  Check,
  Sparkles,
  Terminal as TerminalIcon,
  Cpu,
  Layers,
  Maximize2,
  Palette,
} from "lucide-react";
import { soundManager } from "../../utils/soundEffects";
import { authFetch } from "../../lib/auth-client";

interface MessageStreamProps {
  messages: TerminalMessage[];
}

export const MessageStream: React.FC<MessageStreamProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { speakText, state, setActiveView } = useCrown();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state.isProcessing]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    soundManager.playBeep(980, 0.03);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleTrace = (id: string) => {
    soundManager.playBeep(600, 0.03);
    setExpandedTraceId((prev) => (prev === id ? null : id));
  };

  const getModuleBadge = (moduleId?: CognitiveModuleId) => {
    switch (moduleId) {
      case "ISA":
        return { label: "ISA Resonancia", color: "bg-rose-500/10 text-rose-300 border-rose-500/30", icon: Heart };
      case "SOPHIA":
        return { label: "SOPHIA Mente", color: "bg-sky-500/10 text-sky-300 border-sky-500/30", icon: Brain };
      case "ORION":
        return { label: "ORION Síntesis", color: "bg-amber-500/10 text-amber-300 border-amber-500/30", icon: Zap };
      case "ARGUS":
        return { label: "ARGUS Centinela", color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", icon: Shield };
      case "CROWN_GATEWAY":
      default:
        return { label: "CROWN Gateway", color: "bg-blue-500/10 text-blue-300 border-blue-500/30", icon: Layers };
    }
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
      {messages.map((msg) => {
        if (msg.role === "system") {
          return (
            <div
              key={msg.id}
              className="rounded-2xl border border-slate-800/80 bg-[#070F1E]/80 p-3.5 font-mono text-xs text-slate-300 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 pb-1.5 text-[11px] text-sky-400 font-semibold border-b border-slate-800/80">
                <TerminalIcon className="w-3.5 h-3.5" />
                <span>REGISTRO DEL SISTEMA CROWN :: {msg.timestamp}</span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-300 font-mono text-[11px]">
                {msg.content}
              </pre>
            </div>
          );
        }

        if (msg.role === "argus_alert") {
          return (
            <div
              key={msg.id}
              className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4 font-mono text-xs text-emerald-200 backdrop-blur-sm shadow-lg shadow-emerald-950/30"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-900/50">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>AUDITORÍA ARGUS SENTINEL :: {msg.timestamp}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                  INTEGRIDAD VERIFICADA
                </span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap leading-relaxed text-emerald-100 font-mono text-[11px]">
                {msg.content}
              </pre>
            </div>
          );
        }

        if (msg.role === "user") {
          return (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[85%] md:max-w-[75%] rounded-3xl rounded-tr-sm bg-[#0B1D33] border border-[#1E3B5E] p-4 text-[#F8FAFC] shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between gap-3 pb-1.5 text-[11px] font-mono text-sky-300/80 border-b border-[#1E3B5E]">
                  <span className="font-semibold text-sky-300">OPERADOR / USUARIO</span>
                  <span className="text-slate-400">{msg.timestamp}</span>
                </div>
                <p className="mt-2 font-mono text-sm leading-relaxed whitespace-pre-wrap text-[#F8FAFC]">
                  {msg.content}
                </p>
              </div>
            </div>
          );
        }

        // Isabella Villaseñor AI response
        const badge = getModuleBadge(msg.routingDecision?.primaryModule);
        const BadgeIcon = badge.icon;
        const isExpanded = expandedTraceId === msg.id;

        return (
          <div key={msg.id} className="flex justify-start">
            <div className="w-full max-w-[95%] md:max-w-[90%] rounded-3xl rounded-tl-sm bg-[#060D1A]/95 border border-slate-800/90 p-4 sm:p-5 text-[#F8FAFC] shadow-xl backdrop-blur-xl transition-all duration-200 hover:border-sky-500/40">
              {/* Header metadata bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  {/* Portrait Avatar of Isabella */}
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-amber-400 p-0.5 shadow-md shadow-blue-900/30">
                    <div className="flex items-center justify-center w-full h-full rounded-2xl bg-[#030712] overflow-hidden">
                      <img
                        src="/src/assets/images/isabella_portrait_prime_1786743839065.jpg"
                        alt="Isabella"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm sm:text-base text-[#F8FAFC]">
                        Isabella Villaseñor
                      </span>
                      {msg.routingDecision && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono border font-medium ${badge.color}`}
                        >
                          <BadgeIcon className="w-2.5 h-2.5" />
                          {badge.label}
                        </span>
                      )}
                    </div>
                    {msg.isabellaState && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span className="text-amber-300 font-medium">{msg.isabellaState.mood}</span>
                        <span>•</span>
                        <span>Elegancia: {((msg.isabellaState.feminineEleganceIndex || 0.99) * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  {msg.latencyMs && (
                    <span className="px-2 py-0.5 rounded-md bg-[#081220] border border-slate-800 text-slate-300 text-[10px]">
                      {msg.latencyMs}ms
                    </span>
                  )}
                  {msg.engine && (
                    <span className="hidden sm:inline px-2 py-0.5 rounded-md bg-[#0B1A2E] border border-sky-900/40 text-sky-300 text-[10px]">
                      {msg.engine}
                    </span>
                  )}
                  <span className="text-slate-400">{msg.timestamp}</span>
                </div>
              </div>

              {/* Main Response Content */}
              <div className="mt-3.5 text-sm sm:text-base leading-relaxed text-[#F1F5F9] whitespace-pre-wrap font-sans selection:bg-blue-600 selection:text-white">
                {msg.content}
              </div>

              {/* Render Generated Artwork Attachment if present */}
              {msg.generatedImage && (
                <div className="mt-4 rounded-2xl overflow-hidden border border-slate-800 bg-[#081220] shadow-2xl max-w-lg">
                  <div className="relative aspect-square w-full bg-[#030712]">
                    <img
                      src={msg.generatedImage.url}
                      alt={msg.generatedImage.prompt}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#030712]/80 border border-sky-500/40 text-sky-300 text-[10px] font-mono backdrop-blur-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{msg.generatedImage.style || "ORION Canvas"}</span>
                    </div>
                  </div>
                  <div className="p-3.5 space-y-2">
                    <p className="text-xs font-mono text-slate-300 italic">
                      "{msg.generatedImage.prompt}"
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveView("image_studio")}
                        className="flex items-center gap-1 text-xs font-mono text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                      >
                        <Palette className="w-3.5 h-3.5" />
                        <span>Abrir en Estudio Visual</span>
                      </button>
                      <span className="text-[10px] font-mono text-slate-400">
                        {msg.generatedImage.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Idlen Sponsored Content Card */}
              {msg.sponsoredContent && msg.sponsoredContent.type === "idlen_chat_ad" && (
                <div className="mt-4 pt-3 border-t border-slate-800/60">
                  <a
                    href={msg.sponsoredContent.ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      const sc = msg.sponsoredContent!;
                      // Client-side: pixel click tracking
                      if (typeof window !== "undefined" && typeof window.idlen === "function") {
                        try { window.idlen("click", sc.adId); } catch { /* pixel not loaded */ }
                      }
                      // Server-side: reliable click tracking via Idlen SDK
                      authFetch("/api/v1/idlen/click", {
                        method: "POST",
                        body: JSON.stringify({
                          adId: sc.adId,
                          publisherId: sc.publisherId,
                          requestId: sc.requestId,
                        }),
                      }).catch(() => { /* non-blocking */ });
                    }}
                    className="group block rounded-2xl border border-slate-800/80 bg-[#081220]/80 hover:bg-[#0B1A2E] p-4 transition-all duration-200 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-950/20"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/80 font-semibold">
                        Recomendación patrocinada
                      </span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-[10px] text-slate-500">{msg.sponsoredContent.advertiserName}</span>
                    </div>
                    <p className="text-sm font-sans text-[#F1F5F9] mb-3 leading-relaxed">
                      {msg.sponsoredContent.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-mono font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">
                      <span>{msg.sponsoredContent.ctaText}</span>
                      <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </div>
                  </a>
                </div>
              )}

              {/* Cognitive Telemetry & Routing Accordion */}
              {msg.cognitiveTelemetry && (
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => toggleTrace(msg.id)}
                    className="flex items-center justify-between w-full px-3.5 py-2 rounded-xl bg-[#081220] hover:bg-[#0B1A2E] border border-slate-800 text-[11px] font-mono text-sky-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-sky-400" />
                      <span className="font-semibold tracking-wider">
                        TRAZA COGNITIVA CROWN & TELEMETRÍA MODULAR
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <span>{isExpanded ? "Ocultar" : "Expandir flujo"}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-2.5 rounded-2xl bg-[#070F1E] border border-slate-800 p-4 space-y-3 font-mono text-xs text-slate-300 animate-in fade-in duration-150">
                      {/* Rationale */}
                      {msg.routingDecision?.routingRationale && (
                        <div className="rounded-xl bg-[#0A182B] border border-sky-800/30 p-2.5 text-[11px] text-sky-200">
                          <span className="font-bold text-sky-300">Orquestación CROWN: </span>
                          {msg.routingDecision.routingRationale}
                        </div>
                      )}

                      {/* Modular Cognitive Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* ARGUS Sentinel */}
                        <div className="rounded-xl bg-[#081220] border border-emerald-500/30 p-3 space-y-1">
                          <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px]">
                            <span className="flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5 text-emerald-400" /> ARGUS Sentinel
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300">
                              {msg.cognitiveTelemetry.argusSafety.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            {msg.cognitiveTelemetry.argusSafety.guardrailCheck}
                          </p>
                          <div className="text-[10px] text-slate-400">
                            Integridad: {(msg.cognitiveTelemetry.argusSafety.integrityScore * 100).toFixed(1)}%
                          </div>
                        </div>

                        {/* ISA Resonance */}
                        <div className="rounded-xl bg-[#081220] border border-rose-500/30 p-3 space-y-1">
                          <div className="flex items-center justify-between text-rose-300 font-bold text-[11px]">
                            <span className="flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 text-rose-400" /> ISA Resonancia
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300">
                              {msg.cognitiveTelemetry.isaResonance.emotionalTone}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            {msg.cognitiveTelemetry.isaResonance.coreFocus}
                          </p>
                          <div className="text-[10px] text-slate-400">
                            Valencia empática: {(msg.cognitiveTelemetry.isaResonance.empathyValence * 100).toFixed(0)}%
                          </div>
                        </div>

                        {/* SOPHIA Mind */}
                        <div className="rounded-xl bg-[#081220] border border-sky-500/30 p-3 space-y-1">
                          <div className="flex items-center justify-between text-sky-300 font-bold text-[11px]">
                            <span className="flex items-center gap-1">
                              <Brain className="w-3.5 h-3.5 text-sky-400" /> SOPHIA Dialéctica
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300">
                              Profundidad: {msg.cognitiveTelemetry.sophiaReasoning.logicDepth}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            {msg.cognitiveTelemetry.sophiaReasoning.heuristicInsight}
                          </p>
                          <div className="text-[10px] text-slate-400">
                            Certeza epistémica: {(msg.cognitiveTelemetry.sophiaReasoning.epistemicCertainty * 100).toFixed(1)}%
                          </div>
                        </div>

                        {/* ORION Engine */}
                        <div className="rounded-xl bg-[#081220] border border-amber-500/30 p-3 space-y-1">
                          <div className="flex items-center justify-between text-amber-300 font-bold text-[11px]">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 text-amber-400" /> ORION Síntesis
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300">
                              {msg.cognitiveTelemetry.orionExecution.actionType}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            Uso: {msg.cognitiveTelemetry.orionExecution.resourceUtilization}
                          </p>
                          {msg.cognitiveTelemetry.orionExecution.executionSteps && (
                            <div className="text-[10px] text-slate-400 flex flex-wrap gap-1">
                              {msg.cognitiveTelemetry.orionExecution.executionSteps.map((step, idx) => (
                                <span key={idx} className="bg-[#030712] px-1.5 py-0.5 rounded border border-slate-800">
                                  {step}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Weight Bars */}
                      {msg.routingDecision?.moduleWeights && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400">
                            DISTRIBUCIÓN DE ANCHO DE BANDA COGNITIVO (CROWN LAYER):
                          </span>
                          <div className="grid grid-cols-5 gap-1.5 text-[10px]">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-rose-400">ISA: {Math.round(msg.routingDecision.moduleWeights.isa * 100)}%</span>
                              <div className="w-full bg-[#030712] h-1.5 rounded-full overflow-hidden">
                                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${msg.routingDecision.moduleWeights.isa * 100}%` }} />
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sky-400">SOPHIA: {Math.round(msg.routingDecision.moduleWeights.sophia * 100)}%</span>
                              <div className="w-full bg-[#030712] h-1.5 rounded-full overflow-hidden">
                                <div className="bg-sky-500 h-full rounded-full" style={{ width: `${msg.routingDecision.moduleWeights.sophia * 100}%` }} />
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-amber-400">ORION: {Math.round(msg.routingDecision.moduleWeights.orion * 100)}%</span>
                              <div className="w-full bg-[#030712] h-1.5 rounded-full overflow-hidden">
                                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${msg.routingDecision.moduleWeights.orion * 100}%` }} />
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-emerald-400">ARGUS: {Math.round(msg.routingDecision.moduleWeights.argus * 100)}%</span>
                              <div className="w-full bg-[#030712] h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${msg.routingDecision.moduleWeights.argus * 100}%` }} />
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-blue-400">CROWN: {Math.round(msg.routingDecision.moduleWeights.crown * 100)}%</span>
                              <div className="w-full bg-[#030712] h-1.5 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${msg.routingDecision.moduleWeights.crown * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom interaction controls */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => speakText(msg.content)}
                    className="flex items-center gap-1 hover:text-amber-300 transition-colors cursor-pointer"
                    title="Escuchar respuesta de Isabella con su voz"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Escuchar Voz</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="flex items-center gap-1 hover:text-sky-300 transition-colors cursor-pointer"
                    title="Copiar texto"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[10px] text-slate-400">
                  Isabella Villaseñor • CROWN Enterprise
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Loading state indicator */}
      {state.isProcessing && (
        <div className="flex justify-start animate-in fade-in duration-200">
          <div className="rounded-3xl rounded-tl-sm bg-[#060D1A]/95 border border-sky-500/40 p-4 text-slate-200 shadow-xl backdrop-blur-xl max-w-[85%]">
            <div className="flex items-center gap-2.5 text-xs font-mono text-sky-300">
              <div className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
              </div>
              <span className="font-bold tracking-wider">
                [CROWN ROUTING] Isabella sintetizando a través de ISA, SOPHIA, ORION & ARGUS...
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <span className="text-rose-400 animate-pulse font-semibold">ISA (Empatía)</span>
              <span>↔</span>
              <span className="text-sky-400 animate-pulse font-semibold">SOPHIA (Dialéctica)</span>
              <span>↔</span>
              <span className="text-blue-400 animate-pulse font-semibold">CROWN (Router)</span>
              <span>↔</span>
              <span className="text-amber-400 animate-pulse font-semibold">ORION (Canvas)</span>
              <span>↔</span>
              <span className="text-emerald-400 animate-pulse font-semibold">ARGUS (Escudo)</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
