import * as React from "react";
import {
  lazy,
  Suspense,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CrownProvider, useCrown } from "./context/CrownContext";
import { StatsigProvider } from "./lib/statsig/statsig-provider";
import { Header } from "./components/Header";
import { GlobalFooter } from "./components/Footer/GlobalFooter";
import { ShortcutToast } from "./components/Shortcuts/ShortcutToast";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { IsabellaCinematicTrailer } from "./components/IsabellaCinematicTrailer";

/*
 * ============================================================================
 * ISABELLA VILLASEÑOR AI — APPLICATION SHELL
 * ============================================================================
 * Principios:
 * - El App Shell sólo orquesta: no contiene lógica de dominio.
 * - Cada vista pesada se carga bajo demanda.
 * - Toda vista tiene estado de carga y frontera de error.
 * - La telemetría sólo usa metadata permitida; nunca contenido de conversación.
 * - Fondos y diseño viven en index.css: App.tsx no mezcla estilos inline.
 * ============================================================================
 */

type ActiveView =
  | "terminal"
  | "presence"
  | "traceability"
  | "image_studio"
  | "voice_studio"
  | "architecture"
  | "synapse"
  | "telemetry"
  | "presentation"
  | "hub"
  | "codex"
  | "cattleya_finance"
  | "quantum_mesh"
  | "atlas_language"
  | "quantum_mesh_page"
  | "ledger_page"
  | "eoct_page"
  | "cognitive_telemetry"
  | "prompt_guide";

type ViewDefinition = {
  id: ActiveView;
  label: string;
  description: string;
  component: ComponentType;
};

/*
 * Lazy imports:
 * Cada módulo complejo deja de pesar sobre el primer render.
 * Para mantener esta convención, cada archivo de vista debe exportar default.
 */
const IsabellaTerminal = lazyNamed(
  () => import("./components/Terminal/IsabellaTerminal"),
  "IsabellaTerminal"
);

const IsabellaPresenceView = lazyNamed(
  () => import("./components/Presence/IsabellaPresenceView"),
  "IsabellaPresenceView"
);

const TraceabilityDashboard = lazyNamed(
  () => import("./components/Traceability/TraceabilityDashboard"),
  "TraceabilityDashboard"
);

const ImageStudioView = lazyNamed(
  () => import("./components/Studio/ImageStudioView"),
  "ImageStudioView"
);

const VoiceStudioView = lazyNamed(
  () => import("./components/Studio/VoiceStudioView"),
  "VoiceStudioView"
);

const Cockpit = lazyNamed(
  () => import("./components/Dashboard/Cockpit"),
  "Cockpit"
);

const SynapticFlowDiagram = lazyNamed(
  () => import("./components/Dashboard/SynapticFlowDiagram"),
  "SynapticFlowDiagram"
);

const PresentationView = lazyNamed(
  () => import("./components/Presentation/PresentationView"),
  "PresentationView"
);

const IsabellaHubView = lazyNamed(
  () => import("./components/Hub/IsabellaHubView"),
  "IsabellaHubView"
);

const CodexView = lazyNamed(
  () => import("./components/Codex/CodexView"),
  "CodexView"
);

const CattleyaFinanceView = lazyNamed(
  () => import("./components/Dashboard/CattleyaFinanceView"),
  "CattleyaFinanceView"
);

const QuantumMeshDashboard = lazy(
  () => import("./components/Quantum/QuantumMeshDashboard")
);

/*
 * Los modales no bloquean el primer bundle.
 * Se importan al abrirse, no antes.
 */
const IsabellaWelcomeModal = lazyNamed(
  () => import("./components/Welcome/IsabellaWelcomeModal"),
  "IsabellaWelcomeModal"
);

// (IsabellaOnboardingFlow se mantiene como componente opcional; el intro gate usa IsabellaCinematicTrailer)
const AtlasLanguagePage = lazyNamed(() => import("./components/Pages/AtlasLanguagePage"), "AtlasLanguagePage");
const QuantumMeshPage = lazyNamed(() => import("./components/Pages/QuantumMeshPage"), "QuantumMeshPage");
const LedgerPage = lazyNamed(() => import("./components/Pages/LedgerPage"), "LedgerPage");
const EoctPage = lazyNamed(() => import("./components/Pages/EoctPage"), "EoctPage");
const SidebarNav = lazyNamed(() => import("./components/Sidebar/SidebarNav"), "SidebarNav");

const KeyboardShortcutsModal = lazyNamed(
  () => import("./components/Shortcuts/KeyboardShortcutsModal"),
  "KeyboardShortcutsModal"
);

const SecurityGovernanceModal = lazyNamed(
  () => import("./components/Security/SecurityGovernanceModal"),
  "SecurityGovernanceModal"
);

/*
 * Adaptador para módulos sin export default.
 *
 * Ejemplo si Cockpit tuviera:
 * export const Cockpit = () => ...
 *
 * Sustituye el import por:
 * const Cockpit = lazyNamed(
 *   () => import("./components/Dashboard/Cockpit"),
 *   "Cockpit"
 * );
 */
function lazyNamed<T extends Record<string, ComponentType<any>>>(
  importer: () => Promise<T>,
  exportName: keyof T
) {
  return lazy(async () => {
    const module = await importer();
    return { default: module[exportName] as ComponentType };
  });
}

/*
 * ============================================================================
 * ERROR BOUNDARY
 * ============================================================================
 * Una vista no puede derribar toda Isabella.
 * Si un dashboard o módulo externo falla, la shell permanece navegable.
 */

type ViewErrorBoundaryProps = {
  viewLabel: string;
  children: ReactNode;
};

type ViewErrorBoundaryState = {
  hasError: boolean;
};

class ViewErrorBoundary extends React.Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  declare readonly props: Readonly<ViewErrorBoundaryProps>;
  declare setState: React.Component<ViewErrorBoundaryProps, ViewErrorBoundaryState>["setState"];

  public state: ViewErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): ViewErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    window.dispatchEvent(
      new CustomEvent("isabella:view-error", {
        detail: {
          view: this.props.viewLabel,
          message: error.message,
          componentStack: info.componentStack,
        },
      })
    );
  }

  public componentDidUpdate(previousProps: ViewErrorBoundaryProps) {
    if (
      previousProps.viewLabel !== this.props.viewLabel &&
      this.state.hasError
    ) {
      this.setState({ hasError: false });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <section
          className="empty-state"
          role="alert"
          aria-labelledby="view-error-title"
        >
          <div className="max-w-md">
            <p className="identity-mark">Continuidad operativa</p>

            <h1 id="view-error-title" className="title-section mt-3">
              Este módulo no pudo inicializarse
            </h1>

            <p className="text-muted mt-2 text-sm leading-6">
              La arquitectura principal permanece disponible. Puedes intentar
              cargar de nuevo este espacio sin perder la navegación.
            </p>

            <button
              type="button"
              className="btn btn-secondary mt-5"
              onClick={this.handleRetry}
            >
              Reintentar módulo
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

/*
 * ============================================================================
 * LOADING STATE
 * ============================================================================
 */

function ViewLoadingState({ label }: { label: string }) {
  return (
    <section
      className="surface overflow-hidden"
      aria-busy="true"
      aria-live="polite"
      aria-label={`Cargando ${label}`}
    >
      <div className="panel-header">
        <div className="min-w-0 space-y-3">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-7 w-64 max-w-full" />
        </div>

        <div className="skeleton h-8 w-20 rounded-full" />
      </div>

      <div className="space-y-4 p-5">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-[88%]" />
        <div className="skeleton h-4 w-[67%]" />

        <div className="grid gap-4 pt-4 sm:grid-cols-3">
          <div className="skeleton h-28" />
          <div className="skeleton h-28" />
          <div className="skeleton h-28" />
        </div>
      </div>
    </section>
  );
}

/*
 * ============================================================================
 * UNIFIED VIEW REGISTRY
 * ============================================================================
 * Este registro es la única fuente de verdad entre estado y composición.
 * Ya no hay una cascada de 13 ifs en JSX.
 */

const VIEW_REGISTRY: Record<ActiveView, ViewDefinition> = {
  terminal: {
    id: "terminal",
    label: "Conversación con Isabella",
    description: "Espacio de inteligencia contextual y asistencia soberana.",
    component: IsabellaTerminal,
  },

  presence: {
    id: "presence",
    label: "Presencia Isabella",
    description: "Interfaz de presencia, identidad y vínculo contextual.",
    component: IsabellaPresenceView,
  },

  traceability: {
    id: "traceability",
    label: "Trazabilidad",
    description: "Evidencia, auditoría y continuidad de decisiones.",
    component: TraceabilityDashboard,
  },

  image_studio: {
    id: "image_studio",
    label: "Estudio de imagen",
    description: "Producción visual con control creativo y trazabilidad.",
    component: ImageStudioView,
  },

  voice_studio: {
    id: "voice_studio",
    label: "Estudio de voz",
    description: "Síntesis, dirección y producción vocal.",
    component: VoiceStudioView,
  },

  architecture: {
    id: "architecture",
    label: "Arquitectura CROWN",
    description: "Operación, capacidad y salud del sistema cognitivo.",
    component: Cockpit,
  },

  synapse: {
    id: "synapse",
    label: "Flujo sináptico",
    description: "Relación entre contexto, razonamiento y ejecución.",
    component: SynapticFlowDiagram,
  },

  telemetry: {
    id: "telemetry",
    label: "Telemetría",
    description: "Indicadores operativos de la infraestructura cognitiva.",
    component: Cockpit,
  },

  presentation: {
    id: "presentation",
    label: "Presentación",
    description: "Narrativa institucional de Isabella Villaseñor AI.",
    component: PresentationView,
  },

  hub: {
    id: "hub",
    label: "Hub Isabella",
    description: "Acceso central a capacidades, espacios y flujos activos.",
    component: IsabellaHubView,
  },

  codex: {
    id: "codex",
    label: "Codex",
    description: "Marco documental, principios y conocimiento operativo.",
    component: CodexView,
  },

  cattleya_finance: {
    id: "cattleya_finance",
    label: "Cattleya Finance",
    description: "Visibilidad financiera, sostenibilidad y operación.",
    component: CattleyaFinanceView,
  },

  quantum_mesh: {
    id: "quantum_mesh",
    label: "Quantum Mesh",
    description: "Estado de red, continuidad y coordinación distribuida.",
    component: QuantumMeshDashboard,
  },

  atlas_language: {
    id: "atlas_language",
    label: "Lenguaje Atlas",
    description: "7 primitivas del lenguaje civilizatorio Atlas.",
    component: AtlasLanguagePage,
  },

  quantum_mesh_page: {
    id: "quantum_mesh_page",
    label: "Quantum Mesh Dashboard",
    description: "Orquestador cuántico 24-core en tiempo real.",
    component: QuantumMeshPage,
  },

  ledger_page: {
    id: "ledger_page",
    label: "BookPI Ledger",
    description: "Explorador de la cadena de bloques inmutable.",
    component: LedgerPage,
  },

  eoct_page: {
    id: "eoct_page",
    label: "EOCT Federación",
    description: "Grafo de federaciones y eventos EOCT en vivo.",
    component: EoctPage,
  },

  cognitive_telemetry: {
    id: "cognitive_telemetry",
    label: "Telemetría Cognitiva",
    description: "Monitoreo en vivo de los 5 módulos cognitivos CROWN.",
    component: lazyNamed(
      () => import("./components/Pages/CognitiveTelemetryPage"),
      "CognitiveTelemetryPage"
    ),
  },

  prompt_guide: {
    id: "prompt_guide",
    label: "Guía de Prompts",
    description: "Terminal cognitiva y catálogo de interacciones soberanas.",
    component: IsabellaTerminal,
  },
};

/*
 * ============================================================================
 * ADVERTISING-SAFE TELEMETRY
 * ============================================================================
 * No se transmite:
 * - prompt, respuesta, memoria, archivo, imagen o audio
 * - identificadores personales
 * - emoción, salud, ingresos o información de perfil sensible
 *
 * Sí se transmite:
 * - vista activa y tipo de superficie
 * - datos técnicos estrictamente necesarios para campañas autorizadas
 */

function trackSafePageView(activeView: ActiveView) {
  if (typeof window === "undefined") return;

  const ads = window.isabellaAds;

  if (ads?.consent === "granted") {
    ads.track("PageView", {
      view: activeView,
      navigation: "application-state",
    });

    return;
  }

  /*
   * Compatibilidad temporal:
   * Si mantienes otro sistema de telemetría institucional, con consentimiento
   * propio, conéctalo aquí. No envíes datos de chat.
   */
  if (typeof window.idlen === "function") {
    try {
      window.idlen("track", "PageView", {
        view: activeView,
        navigation: "application-state",
      });
    } catch {
      /* La experiencia principal no depende de un proveedor publicitario. */
    }
  }
}

/*
 * ============================================================================
 * MAIN CONTENT
 * ============================================================================
 */

function MainContent() {
  useGlobalShortcuts();

  const {
    state,
    isWelcomeOpen,
    closeWelcomeModal,
    isShortcutsOpen,
    closeShortcutsModal,
    lastShortcutTriggered,
    clearShortcutFeedback,
    cinematicIntroOpen,
    closeCinematicIntro,
  } = useCrown();

  const [introDone, setIntroDone] = useState(() => {
    try {
      return localStorage.getItem("isabella_intro_done") === "1";
    } catch {
      return false;
    }
  });

  const activeView = state.activeView as ActiveView;

  // Safety: if onboarding is still showing after 60s, force-complete it
  useEffect(() => {
    if (introDone) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem("isabella_intro_done", "1"); } catch { /* ignore */ }
      setIntroDone(true);
    }, 60_000);
    return () => clearTimeout(timer);
  }, [introDone]);

  const view = useMemo(
    () => VIEW_REGISTRY[activeView] ?? VIEW_REGISTRY.terminal,
    [activeView]
  );

  const ActiveViewComponent = view.component;

  useEffect(() => {
    document.title = `${view.label} — Isabella Villaseñor AI`;

    trackSafePageView(view.id);

    window.dispatchEvent(
      new CustomEvent("isabella:view-changed", {
        detail: {
          id: view.id,
          label: view.label,
        },
      })
    );
  }, [view.id, view.label]);

  const completeIntro = () => {
    try { localStorage.setItem("isabella_intro_done", "1"); } catch { /* ignore */ }
    setIntroDone(true);
  };

  if (!introDone) {
    return <IsabellaCinematicTrailer onComplete={completeIntro} />;
  }

  if (cinematicIntroOpen) {
    return <IsabellaCinematicTrailer onComplete={closeCinematicIntro} />;
  }

  return (
    <>
      <main
        id="main-content"
        className="app-main"
        tabIndex={-1}
        aria-labelledby="view-title"
      >
        <div className="page-container">
          {/*
           * Presencia y Terminal llevan su propio héroe; la cabecera genérica
           * solo se muestra en vistas sin identidad propia para evitar ruido.
           */}
          {view.id === "presence" || view.id === "terminal" ? (
            <h1 id="view-title" className="sr-only">
              {view.label}
            </h1>
          ) : (
            <header className="mb-6">
              <p className="identity-mark">Isabella Villaseñor AI</p>

              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 id="view-title" className="title-page">
                    {view.label}
                  </h1>

                  <p className="text-muted mt-2 max-w-2xl text-sm leading-6">
                    {view.description}
                  </p>
                </div>

                <span className="badge badge-success">
                  <span className="status-dot" aria-hidden="true" />
                  Sistema disponible
                </span>
              </div>

              <div className="divider-platinum mt-6" />
            </header>
          )}

          <ViewErrorBoundary viewLabel={view.label}>
            <Suspense fallback={<ViewLoadingState label={view.label} />}>
              {/*
               * La key por vista reactiva la entrada cinematográfica
               * (index.css §08C) sin interferir con la navegación interna.
               */}
              <div key={view.id} className="view-enter">
                {view.id === "synapse" ? (
                  <div className="space-y-6">
                    <ActiveViewComponent />
                    <Suspense fallback={<ViewLoadingState label="Cockpit" />}>
                      <Cockpit />
                    </Suspense>
                  </div>
                ) : (
                  <ActiveViewComponent />
                )}
              </div>
            </Suspense>
          </ViewErrorBoundary>
        </div>
      </main>

      <Suspense fallback={null}>
        {isWelcomeOpen ? (
          <IsabellaWelcomeModal
            {...{ isOpen: isWelcomeOpen, onClose: closeWelcomeModal } as any}
          />
        ) : null}

        {isShortcutsOpen ? (
          <KeyboardShortcutsModal
            {...{ isOpen: isShortcutsOpen, onClose: closeShortcutsModal } as any}
          />
        ) : null}

        <SecurityGovernanceModal />
      </Suspense>

      <ShortcutToast
        message={lastShortcutTriggered}
        onDismiss={clearShortcutFeedback}
      />
    </>
  );
}

/*
 * ============================================================================
 * APP ROOT
 * ============================================================================
 */

function getOrCreateVisitorId(): string {
  try {
    const key = "isab_statsig_vid";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID?.() ?? `vis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return "visitor-anonymous";
  }
}

export default function App() {
  const [visitorId] = useState(getOrCreateVisitorId);

  return (
    <StatsigProvider userId={visitorId}>
      <CrownProvider>
        <div className="app-shell">
          <Header />
          <div className="app-layout">
            <Suspense fallback={null}>
              <SidebarNav />
            </Suspense>
            <MainContent />
            <GlobalFooter />
          </div>
        </div>
      </CrownProvider>
    </StatsigProvider>
  );
}
