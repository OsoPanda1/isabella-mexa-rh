/**
 * SidebarNav — retractable left sidebar with accordion sections.
 * Groups: Funciones, Skills, Chats, Monetización, Ajustes.
 * Collapsed state shows icons only; expanded shows labels.
 * Every action dispatches through CrownContext so state stays consistent.
 */
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Zap,
  LayoutGrid,
  MessageSquare,
  Coins,
  Settings,
  Terminal,
  Image as ImageIcon,
  Volume2,
  Box,
  Activity,
  Sparkles,
  Monitor,
  CreditCard,
  BookOpen,
  Network,
  Database,
  Globe,
  Layers,
} from "lucide-react";
import { useCrown } from "../../context/CrownContext";
import { soundManager } from "../../utils/soundEffects";

interface SectionDef {
  id: string;
  label: string;
  icon: typeof LayoutGrid;
  items: Array<{
    id: string;
    label: string;
    icon: typeof Zap;
    action: () => void;
    badge?: string;
  }>;
}

export function SidebarNav() {
  const {
    state,
    setActiveView,
    openWelcomeModal,
    openSecurityModal,
    openShortcutsModal,
    toggleSound,
    toggleSpeechSynthesis,
    clearMessages,
    setPreset,
  } = useCrown();

  const [collapsed, setCollapsed] = useState(false);
  const [openSection, setOpenSection] = useState<string>("functions");

  const toggleSection = (id: string) => {
    setOpenSection((s) => (s === id ? "" : id));
    soundManager.playBeep(880, 0.03, "sine", 0.015);
  };

  const sections: SectionDef[] = [
    {
      id: "functions",
      label: "Funciones",
      icon: LayoutGrid,
      items: [
        { id: "terminal", label: "Terminal CROWN", icon: Terminal, action: () => setActiveView("terminal") },
        { id: "presence", label: "Presencia Isabella", icon: Sparkles, action: () => setActiveView("presence") },
        { id: "traceability", label: "Trazabilidad & Auditoría", icon: Activity, action: () => setActiveView("traceability") },
        { id: "architecture", label: "Arquitectura Modular", icon: Box, action: () => setActiveView("architecture") },
        { id: "synapse", label: "Sinapsis & Red", icon: Network, action: () => setActiveView("synapse") },
        { id: "telemetry", label: "Telemetría", icon: Monitor, action: () => setActiveView("telemetry") },
        { id: "image_studio", label: "Estudio de Imagen", icon: ImageIcon, action: () => setActiveView("image_studio") },
        { id: "voice_studio", label: "Estudio de Voz", icon: Volume2, action: () => setActiveView("voice_studio") },
        { id: "presentation", label: "Presentación", icon: Layers, action: () => setActiveView("presentation") },
      ],
    },
    {
      id: "skills",
      label: "Skills",
      icon: Zap,
      items: [
        { id: "skill_hook", label: "Hook Generator", icon: Sparkles, action: () => setActiveView("terminal") },
        { id: "skill_rdm", label: "RDM Tourism Pack", icon: Globe, action: () => setActiveView("terminal") },
        { id: "skill_copy", label: "Offer Copy Optimizer", icon: MessageSquare, action: () => setActiveView("terminal") },
        { id: "skill_video", label: "Video Subtitle Aligner", icon: Monitor, action: () => setActiveView("terminal") },
        { id: "skill_quantum", label: "Quantum Mesh", icon: Box, action: () => setActiveView("quantum_mesh"), badge: "exp" },
        { id: "skill_language", label: "Lenguaje Atlas", icon: BookOpen, action: () => setActiveView("atlas_language") },
        { id: "skill_ledger", label: "BookPI Ledger", icon: Database, action: () => setActiveView("ledger_page") },
        { id: "skill_eoct", label: "EOCT Federación", icon: Network, action: () => setActiveView("eoct_page") },
      ],
    },
    {
      id: "chats",
      label: "Chats",
      icon: MessageSquare,
      items: [
        { id: "chat_main", label: "Conversación principal", icon: MessageSquare, action: () => setActiveView("terminal") },
        { id: "chat_clear", label: "Limpiar conversación", icon: ChevronDown, action: () => clearMessages() },
        { id: "chat_shortcuts", label: "Atajos de teclado", icon: Zap, action: () => openShortcutsModal() },
      ],
    },
    {
      id: "monetization",
      label: "Monetización",
      icon: Coins,
      items: [
        { id: "mon_plans", label: "Suscripciones", icon: CreditCard, action: () => setActiveView("cattleya_finance") },
        { id: "mon_wallet", label: "Wallet Digital", icon: CreditCard, action: () => setActiveView("cattleya_finance"), badge: "new" },
        { id: "mon_market", label: "Marketplace", icon: LayoutGrid, action: () => setActiveView("cattleya_finance") },
        { id: "mon_gifts", label: "Regalos Digitales", icon: Sparkles, action: () => setActiveView("cattleya_finance") },
      ],
    },
    {
      id: "settings",
      label: "Ajustes",
      icon: Settings,
      items: [
        { id: "set_welcome", label: "Intro", icon: BookOpen, action: () => openWelcomeModal() },
        { id: "set_security", label: "Gobernanza & Seguridad", icon: Database, action: () => openSecurityModal() },
        { id: "set_sound", label: `Sonido: ${state.soundEnabled ? "on" : "off"}`, icon: Volume2, action: () => toggleSound() },
        { id: "set_voice", label: `Voz: ${state.speechSynthesisEnabled ? "on" : "off"}`, icon: Volume2, action: () => toggleSpeechSynthesis() },
        { id: "set_preset", label: `Perfil: ${state.activePreset}`, icon: Layers, action: () => setPreset(state.activePreset === "prime" ? "sentinel" : "prime") },
      ],
    },
  ];

  return (
    <aside
      className="app-sidebar frame-sapphire"
      aria-label="Navegación lateral"
      data-collapsed={collapsed ? "true" : "false"}
    >
      {/* Toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="mt-3 mb-2 self-end mx-2 flex h-7 w-7 items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/60 text-slate-400 transition-all duration-200 hover:text-slate-200 hover:border-slate-600/80 hover:bg-slate-800/60 hover:shadow-[0_0_8px_rgba(56,189,248,0.2)] active:scale-95"
        aria-label={collapsed ? "Expandir sidebar" : "Retraer sidebar"}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" role="navigation">
        {sections.map((section) => {
          const SectionIcon = section.icon;
          const open = openSection === section.id;
          return (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => toggleSection(section.id)}
                className="nav-section-header"
                aria-expanded={open}
                aria-controls={`section-${section.id}`}
              >
                <SectionIcon size={14} className="shrink-0 text-cyan-400" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{section.label}</span>
                    {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </>
                )}
              </button>

              <div
                id={`section-${section.id}`}
                className={`overflow-hidden transition-all duration-200 ${open && !collapsed ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
              >
                <div className="ml-1 space-y-0.5 border-l border-slate-800/60 pl-2">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActiveView = item.id === state.activeView;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.action();
                          soundManager.playBeep(880, 0.03, "sine", 0.015);
                        }}
                        className={`nav-item ${isActiveView ? "nav-item--active" : ""}`}
                      >
                        <ItemIcon size={11} className="shrink-0 text-amber-400/70" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="chip chip--gold">{item.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="sidebar-footer">
          <p className="font-mono text-[9px] text-slate-500">
            isabella · atlas · v5.3
          </p>
        </div>
      )}
    </aside>
  );
}
