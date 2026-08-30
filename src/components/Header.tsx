import React from "react";
import { useCrown, PRESET_PROFILES } from "../context/CrownContext";
import {
  Terminal as TerminalIcon,
  Heart,
  Cpu,
  Activity,
  Wallet,
  Server,
  Shield,
  Cloud,
  Lock,
  Volume2,
  VolumeX,
  Keyboard,
  Play,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { soundManager } from "../utils/soundEffects";
import { CrownSystemState, PresetProfileId } from "../types";
import { ISABELLA_AVATAR_PRIMARY } from "../data/isabellaAvatar";

type NavItem = {
  view: CrownSystemState["activeView"];
  label: string;
  icon: LucideIcon;
  title: string;
  desktopOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { view: "terminal", label: "Terminal", icon: TerminalIcon, title: "Terminal interactiva (Alt+1)" },
  { view: "presence", label: "Presencia", icon: Heart, title: "Presencia y avatar de Isabella (Alt+2)" },
  { view: "architecture", label: "Arquitectura", icon: Cpu, title: "Arquitectura cognitiva (Alt+5)" },
  { view: "presentation", label: "Dossier", icon: Activity, title: "Presentación y auditoría (Alt+7)", desktopOnly: true },
  { view: "cattleya_finance", label: "Cattleya", icon: Wallet, title: "Cattleya Finance Hub", desktopOnly: true },
  { view: "quantum_mesh", label: "Quantum", icon: Server, title: "Isabella Quantum Mesh", desktopOnly: true },
  { view: "hub", label: "Hub RDM", icon: Server, title: "Nodo Cero Hub & API (Alt+8)", desktopOnly: true },
];

const NAV_BUTTON_BASE =
  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium tracking-[0.03em] transition-all duration-200 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0bb5d]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040507]";
const NAV_BUTTON_ACTIVE =
  "bg-white/[0.08] text-[#fffefa] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_12px_rgba(224,187,93,0.15)] scale-[1.02]";
const NAV_BUTTON_IDLE = "text-[#929da8] hover:text-[#e9e4da] hover:bg-white/[0.03] hover:scale-[1.01] active:scale-[0.98]";

const ICON_BUTTON_BASE =
  "flex h-8 w-8 items-center justify-center rounded-full text-[#929da8] transition-all duration-200 hover:bg-white/[0.06] hover:text-[#e9e4da] hover:scale-[1.05] active:scale-[0.95] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0bb5d]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040507]";

export const Header: React.FC = () => {
  const {
    state,
    setActiveView,
    setPreset,
    toggleSpeechSynthesis,
    openWelcomeModal,
    openShortcutsModal,
    openSecurityModal,
    toggleInferenceMode,
    dismissInferenceNotification,
  } = useCrown();

  const {
    activeView,
    activePreset,
    speechSynthesisEnabled,
    isSpeaking,
    inferenceMode,
    lastInferenceTransition,
  } = state;

  const handleTabClick = (view: CrownSystemState["activeView"]) => {
    soundManager.playBeep(700, 0.03);
    setActiveView(view);
  };

  return (
    <header className="app-header frame-platinum">
      {/* Sovereignty transition notice */}
      {lastInferenceTransition && (
        <div className="flex w-full items-center justify-between border-b border-[#f2ba57]/10 bg-[#f2ba57]/[0.05] px-4 py-2 text-xs text-[#d9d3c8] animate-fade-in">
          <div className="flex max-w-4xl items-center gap-2 truncate">
            <Shield className="h-3.5 w-3.5 shrink-0 text-[#f2ba57]" />
            <span className="truncate">
              {lastInferenceTransition.reason} —{" "}
              {lastInferenceTransition.toMode === "local_sovereign" ? "Enclave Nodo Cero" : "Gateway Federado"}
            </span>
          </div>
          <button
            type="button"
            onClick={dismissInferenceNotification}
            className="p-1 text-[#929da8] transition-colors hover:text-[#fffefa]"
            title="Cerrar notificación"
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-[4.25rem] items-center justify-between gap-6">
          {/* Identity */}
          <button
            type="button"
            className="group flex shrink-0 cursor-pointer items-center gap-3.5 text-left"
            onClick={() => handleTabClick("presence")}
            aria-label="Ir a Presencia Isabella"
          >
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-1.5 rounded-full bg-[radial-gradient(circle,rgba(224,187,93,0.16),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] transition-colors duration-500 group-hover:border-[#e0bb5d]/40">
                <img
                  src={ISABELLA_AVATAR_PRIMARY}
                  alt="Isabella Villaseñor AI"
                  className="h-full w-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              </div>
              {isSpeaking && (
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e0bb5d] opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#e0bb5d]" />
                </span>
              )}
            </div>
            <div>
              <span className="block text-sm font-semibold tracking-[-0.01em] text-[#f5f2eb] transition-colors duration-500 group-hover:text-[#efd58a]">
                Isabella <span className="font-serif font-normal italic">Villaseñor</span>
              </span>
              <p className="hidden items-center gap-1.5 text-[10px] tracking-[0.1em] text-[#6f7b87] md:flex">
                <span className="h-1 w-1 rounded-full bg-[#55d79a]" aria-hidden="true" />
                Nodo Cero · Real del Monte
              </p>
            </div>
          </button>

          {/* Primary navigation */}
          <nav
            className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-white/[0.05] bg-white/[0.02] px-1.5 py-1.5"
            aria-label="Navegación principal"
          >
            <button
              type="button"
              onClick={() => {
                soundManager.playBeep(900, 0.04);
                openWelcomeModal();
              }}
              className={`${NAV_BUTTON_BASE} text-[#e0bb5d]/90 hover:text-[#efd58a]`}
              title="Presentación de Isabella Villaseñor AI"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Intro</span>
            </button>

            <span className="mx-1.5 h-3.5 w-px bg-white/[0.06]" aria-hidden="true" />

            {NAV_ITEMS.map(({ view, label, icon: Icon, title, desktopOnly }) => (
              <button
                key={view}
                type="button"
                onClick={() => handleTabClick(view)}
                className={`${NAV_BUTTON_BASE} ${activeView === view ? NAV_BUTTON_ACTIVE : NAV_BUTTON_IDLE} ${desktopOnly ? "hidden lg:flex" : ""}`}
                title={title}
                aria-current={activeView === view ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Quick controls */}
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={openSecurityModal}
              className={`${ICON_BUTTON_BASE} hidden sm:flex`}
              title="Gobernanza y políticas Zero-Trust"
              aria-label="Gobernanza y seguridad"
            >
              <Shield className="h-4 w-4 text-[#55d79a]" />
            </button>

            <button
              type="button"
              onClick={() => toggleInferenceMode()}
              className={ICON_BUTTON_BASE}
              title={`Modo actual: ${inferenceMode === "local_sovereign" ? "Nodo Cero Local Soberano" : "Inferencia Cloud Federada"}. Clic para conmutar.`}
              aria-label="Conmutar modo de inferencia"
            >
              {inferenceMode === "local_sovereign" ? (
                <Lock className="h-4 w-4 text-[#e0bb5d]" />
              ) : (
                <Cloud className="h-4 w-4 text-[#78b7ff]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playBeep(880, 0.03);
                openShortcutsModal();
              }}
              className={`${ICON_BUTTON_BASE} hidden md:flex`}
              title="Atajos de teclado (Ctrl+/ o ?)"
              aria-label="Atajos de teclado"
            >
              <Keyboard className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleSpeechSynthesis}
              className={ICON_BUTTON_BASE}
              title={speechSynthesisEnabled ? "Voz activa" : "Voz silenciada"}
              aria-label={speechSynthesisEnabled ? "Silenciar voz" : "Activar voz"}
            >
              {speechSynthesisEnabled ? (
                <Volume2 className="h-4 w-4 text-[#e0bb5d]" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playBeep(800, 0.04);
                openWelcomeModal();
              }}
              className={`${ICON_BUTTON_BASE} hidden sm:flex`}
              title="Conoce a Isabella"
              aria-label="Conoce a Isabella"
            >
              <Sparkles className="h-4 w-4" />
            </button>

            <span className="mx-2 hidden h-3.5 w-px bg-white/[0.06] lg:block" aria-hidden="true" />

            <select
              value={activePreset}
              onChange={(e) => setPreset(e.target.value as PresetProfileId)}
              className="hidden h-8 cursor-pointer rounded-full border border-white/[0.06] bg-transparent px-3 text-[11px] font-medium text-[#d9d3c8] transition-colors hover:border-white/[0.14] focus:outline-none lg:block"
              aria-label="Perfil activo"
            >
              {Object.values(PRESET_PROFILES).map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0a0d13] text-[#e9e4da]">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

    </header>
  );
};
