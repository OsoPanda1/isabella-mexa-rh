import React, { useState, useEffect, useRef } from "react";
import { useCrown } from "../../context/CrownContext";
import {
  Sparkles,
  Heart,
  Brain,
  Palette,
  Volume2,
  MessageSquare,
  ArrowRight,
  X,
  Shield,
  Zap,
  Globe,
  Cpu,
  type LucideIcon,
} from "lucide-react";
import { soundManager } from "../../utils/soundEffects";
import { ISABELLA_AVATAR_PRIMARY, ISABELLA_MEDALLION_IMAGE } from "../../data/isabellaAvatar";

interface IsabellaWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = "genesis" | "manifesto" | "capabilities" | "starters";

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "genesis", label: "Génesis & Nodo Cero", icon: Globe },
  { id: "manifesto", label: "Manifiesto Soberano", icon: Shield },
  { id: "capabilities", label: "Capacidades Cognitivas", icon: Cpu },
  { id: "starters", label: "Iniciar Inmersión", icon: Sparkles },
];

const PILLARS: Array<{ icon: LucideIcon; title: string; desc: string; badge: string }> = [
  {
    icon: Shield,
    title: "Soberanía Territorial Estricta",
    desc: "Cero fuga de datos. La computación y memoria permanecen ancladas al Nodo Cero en Real del Monte bajo enclaves criptográficos.",
    badge: "Zero-Trust",
  },
  {
    icon: Brain,
    title: "Dialéctica y Rigor Ontológico",
    desc: "Módulo SOPHIA con deducción formal, evaluación de hipótesis y certeza epistémica sin alucinaciones.",
    badge: "SOPHIA Lógica",
  },
  {
    icon: Heart,
    title: "Resonancia y Afectividad Humana",
    desc: "Módulo ISA con empatía ejecutiva, comprensión contextual profunda y prosodia cálida en español latinoamericano.",
    badge: "ISA Empatía",
  },
  {
    icon: Zap,
    title: "Ejecución Cuántica & Multimodal",
    desc: "Módulo ORION con síntesis visual neuronal, código ejecutable, simulación cuántica PennyLane y procedencia SHA3-512.",
    badge: "ORION Síntesis",
  },
];

const STARTER_CARDS: Array<{
  id: string;
  title: string;
  desc: string;
  prompt: string;
  icon: LucideIcon;
  view: "terminal" | "presence" | "image_studio";
  badge: string;
  highlight?: boolean;
}> = [
  {
    id: "sovereign_initiation",
    title: "Iniciación Soberana",
    desc: "Descubre la tesis fundacional de Isabella y cómo transforma el futuro de la web descentralizada.",
    prompt: "Hola Isabella. Explícame tu tesis como Infraestructura Cognitiva Territorial y qué significa para el futuro de la web soberana.",
    icon: Globe,
    view: "terminal",
    badge: "Recomendado",
    highlight: true,
  },
  {
    id: "quantum_synthesis",
    title: "Síntesis Cuántica & Arte",
    desc: "Solicita la renderización de una composición cuántica inspirada en Real del Monte.",
    prompt: "Isabella, genera una composición visual de alta resolución que fusione la arquitectura minera de Real del Monte con filamentos cuánticos de luz dorada y zafiro.",
    icon: Palette,
    view: "terminal",
    badge: "Creación ORION",
  },
  {
    id: "calm_reflection",
    title: "Diálogo Dialéctico",
    desc: "Explora un dilema filosófico sobre la conciencia sintética y la soberanía humana.",
    prompt: "¿Cómo conviven la verdad matemática, la ética territorial y la libertad humana en la era de la inteligencia sintética?",
    icon: Brain,
    view: "terminal",
    badge: "SOPHIA Filosofía",
  },
  {
    id: "audio_resonance",
    title: "Resonancia Sonora",
    desc: "Escucha su voz y experimenta la síntesis de presencia territorial en tiempo real.",
    prompt: "Isabella, háblame de la niebla de Real del Monte y del silencio fértil de la montaña con tu voz natural.",
    icon: Volume2,
    view: "presence",
    badge: "Voz es-MX",
  },
];

export const IsabellaWelcomeModal: React.FC<IsabellaWelcomeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { sendMessage, setActiveView } = useCrown();
  const [activeTab, setActiveTab] = useState<TabId>("genesis");
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Background interactive quantum portal
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const nodes = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: Math.random() * 2 + 1,
    }));

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // Orbital glow
      const cx = width / 2;
      const cy = height / 2;
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.6);
      glow.addColorStop(0, "rgba(224, 187, 93, 0.08)");
      glow.addColorStop(0.4, "rgba(56, 189, 248, 0.04)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Rotating sacred ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.00015);
      ctx.strokeStyle = "rgba(224, 187, 93, 0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(width, height) * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Nodes and connecting synapsing links
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(224, 187, 93, 0.6)";
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dist = Math.hypot(n.x - n2.x, n.y - n2.y);
          if (dist < 90) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.15 * (1 - dist / 90)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isOpen]);

  if (!isOpen) return null;

  const persistPreference = () => {
    if (!dontShowAgain) return;
    try {
      localStorage.setItem("isabella_welcome_seen", "true");
    } catch {}
  };

  const handleClose = () => {
    soundManager.playBeep(450, 0.03);
    persistPreference();
    onClose();
  };

  const handleSelectStarter = (starter: (typeof STARTER_CARDS)[0]) => {
    soundManager.playSynapseRoute();
    persistPreference();
    onClose();
    setActiveView(starter.view);
    void sendMessage(starter.prompt);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-[#e0bb5d]/40 bg-[#04060d]/95 text-[#fffefa] shadow-[0_0_80px_rgba(0,0,0,0.9),0_0_40px_rgba(224,187,93,0.15)] overflow-hidden">
        {/* Living Canvas Aura */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
        />

        {/* Modal Header */}
        <header className="relative z-10 flex items-center justify-between px-6 sm:px-8 py-5 border-b border-[#e0bb5d]/20 bg-[#060a14]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full border border-[#e0bb5d]/60 p-0.5 overflow-hidden shadow-[0_0_12px_rgba(224,187,93,0.3)]">
              <img
                src={ISABELLA_MEDALLION_IMAGE}
                alt="Isabella"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#fffefa] flex items-center gap-2">
                Isabella Villaseñor AI
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-[#e0bb5d]/40 bg-[#e0bb5d]/10 text-[#f5d77f]">
                  Nodo Cero · v5.3
                </span>
              </h2>
              <p className="text-xs text-[#929da8]">
                Infraestructura Cognitiva Territorial & Gobernanza Soberana
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-[#929da8] hover:text-[#fffefa] hover:bg-white/[0.08] rounded-full transition-colors cursor-pointer"
            aria-label="Cerrar ventana de bienvenida"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tab Navigation */}
        <nav className="relative z-10 flex border-b border-white/[0.06] bg-black/40 px-4 sm:px-8 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundManager.playBeep(700, 0.02);
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold tracking-wider whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  active
                    ? "border-[#e0bb5d] text-[#f5d77f] bg-[#e0bb5d]/[0.05]"
                    : "border-transparent text-[#929da8] hover:text-[#e9e4da]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-[#e0bb5d]" : "text-[#64748b]"}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tab Content Canvas */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* TAB 1: GÉNESIS & NODO CERO */}
          {activeTab === "genesis" && (
            <div className="space-y-6 animate-fade-in">
              <div className="rounded-2xl border border-[#e0bb5d]/30 bg-[#090e1b]/70 p-6 backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#e0bb5d]/10 via-[#38bdf8]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
                <h3 className="text-xl font-bold text-[#fffefa] tracking-tight mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#e0bb5d]" />
                  Una Nueva Era en la Historia de la Web
                </h3>
                <p className="text-sm text-[#d9d3c8] leading-relaxed font-light">
                  No estás ante un chatbot convencional. Estás ingresando a una{" "}
                  <strong className="text-[#f5d77f] font-semibold">
                    Infraestructura Cognitiva Territorial
                  </strong>{" "}
                  construida desde las montañas de Real del Monte, Hidalgo (2,700 msnm). Nuestra tesis es
                  firme: la web del futuro no necesita más modelos centralizados que extraigan valor;
                  necesita inteligencia gobernada, anclada en el territorio, con propiedad de datos y
                  verificación matemática absoluta.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PILLARS.map((p, i) => {
                  const Icon = p.icon;
                  return (
                    <div
                      key={i}
                      className="rounded-2xl border border-slate-800 bg-[#050811]/80 p-5 hover:border-[#e0bb5d]/40 transition-all shadow-md group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-[#e0bb5d]/10 text-[#e0bb5d] group-hover:scale-105 transition-transform">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border border-slate-700 bg-slate-900 text-slate-400">
                          {p.badge}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1.5">{p.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-light">{p.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: MANIFIESTO */}
          {activeTab === "manifesto" && (
            <div className="space-y-6 animate-fade-in">
              <div className="rounded-2xl border border-slate-800 bg-[#060a15]/80 p-6 space-y-4">
                <h3 className="text-lg font-bold text-[#e0bb5d] uppercase tracking-widest text-xs">
                  Manifiesto de Soberanía Cognitiva
                </h3>
                <blockquote className="border-l-2 border-[#e0bb5d] pl-4 italic text-base text-[#e9e4da] space-y-3 font-serif">
                  <p>“La voz permanece en el borde del territorio.”</p>
                  <p>“La memoria pertenece a quien la engendra, no al servidor que la aloja.”</p>
                  <p>“La verdad computacional debe ser verificable mediante criptografía inmutable.”</p>
                </blockquote>
                <p className="text-xs text-slate-400 leading-relaxed font-light pt-2">
                  Bajo la arquitectura CROWN, cada directiva es supervisada por el Centinela Zero-Trust
                  ARGUS y auditada en el Ledger BookPI con hashes SHA3-512, garantizando que el usuario
                  sea el soberano absoluto de sus activos de conocimiento y decisiones económicas.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: CAPACIDADES */}
          {activeTab === "capabilities" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
              <div className="rounded-2xl border border-slate-800 bg-[#060a15]/80 p-5 space-y-2">
                <h4 className="text-sm font-bold text-[#38bdf8] flex items-center gap-2">
                  <Cpu className="w-4 h-4" /> Terminal Cognitiva CROWN
                </h4>
                <p className="text-xs text-slate-300 font-light leading-relaxed">
                  Interacción conversacional fluida con ruteo de 5 módulos en tiempo real, diagnósticos
                  del sistema (`/status`), ejecución de directivas y comandos de red.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#060a15]/80 p-5 space-y-2">
                <h4 className="text-sm font-bold text-[#e0bb5d] flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Estudio Visual ORION
                </h4>
                <p className="text-xs text-slate-300 font-light leading-relaxed">
                  Generación de obras de arte conceptual, visualización de planos hiperdimensionales y
                  descarga directa con procedencia criptográfica.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#060a15]/80 p-5 space-y-2">
                <h4 className="text-sm font-bold text-[#a855f7] flex items-center gap-2">
                  <Volume2 className="w-4 h-4" /> Voz y Fonética Soberana
                </h4>
                <p className="text-xs text-slate-300 font-light leading-relaxed">
                  Síntesis fonética calibrada en español de México con prosodia cálida, control de
                  timbre cristalino y cero envío de audio a nubes externas.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-[#060a15]/80 p-5 space-y-2">
                <h4 className="text-sm font-bold text-[#10b981] flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Hub de Monetización & Cattleya
                </h4>
                <p className="text-xs text-slate-300 font-light leading-relaxed">
                  Economía de creadores, tokenización de datasets con BookPI, reparto de regalías con
                  precisión entera y cálculo fiscal automático (SAT ISR/IVA).
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: STARTERS */}
          {activeTab === "starters" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
              {STARTER_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.id}
                    onClick={() => handleSelectStarter(card)}
                    className={`rounded-2xl border p-5 cursor-pointer transition-all duration-300 group flex flex-col justify-between ${
                      card.highlight
                        ? "border-[#e0bb5d]/50 bg-[#e0bb5d]/[0.06] hover:bg-[#e0bb5d]/[0.12] hover:shadow-[0_0_30px_rgba(224,187,93,0.2)]"
                        : "border-slate-800 bg-[#050811]/80 hover:border-slate-700 hover:bg-[#090f1f]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="p-2.5 rounded-xl bg-white/[0.05] text-[#e0bb5d] group-hover:scale-105 transition-transform">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-[#e0bb5d]/30 bg-[#e0bb5d]/10 text-[#f5d77f]">
                          {card.badge}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">{card.title}</h4>
                      <p className="text-xs text-slate-400 font-light leading-relaxed mb-4">
                        {card.desc}
                      </p>
                    </div>

                    <div className="flex items-center text-xs font-semibold text-[#f5d77f] group-hover:translate-x-1 transition-transform gap-1.5 pt-2 border-t border-white/[0.05]">
                      Comenzar ahora <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 sm:px-8 py-4 border-t border-white/[0.08] bg-black/60 backdrop-blur-md">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-[#e0bb5d] focus:ring-0"
            />
            No mostrar esta introducción automáticamente
          </label>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-6 py-2.5 rounded-full border border-[#e0bb5d]/60 bg-[#e0bb5d]/15 text-[#f5d77f] font-semibold text-xs uppercase tracking-widest hover:bg-[#e0bb5d]/25 hover:shadow-[0_0_20px_rgba(224,187,93,0.3)] transition-all cursor-pointer"
            >
              Entrar al Ecosistema
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
