/**
 * =============================================================================
 * ISABELLA VILLASEÑOR AI — CLIENT BOOT KERNEL
 * =============================================================================
 * Runtime entrypoint · Vite + React 19 + TypeScript
 *
 * Este archivo constituye el borde de arranque del cliente:
 *
 *  1. Establece la sesión de ejecución y trazabilidad técnica.
 *  2. Valida las precondiciones mínimas del entorno.
 *  3. Construye un canal de eventos sin datos privados.
 *  4. Instala protecciones para errores globales y recursos críticos.
 *  5. Inicializa React con callbacks de recuperación.
 *  6. Monta el App Shell en una frontera visual de continuidad.
 *  7. Registra el Service Worker únicamente en producción.
 *
 * INVARIANTE ABSOLUTA:
 * Este archivo JAMÁS registra ni transmite:
 * - prompts, mensajes, respuestas, memoria o archivos;
 * - tokens, cookies, headers, credenciales o información de sesión;
 * - audio, imágenes, documentos o coordenadas precisas;
 * - estado emocional, datos de salud, identidad o perfil económico.
 *
 * Las decisiones de negocio, autenticación, RLS, autorización, auditoría
 * permanente y telemetry server-side pertenecen al Isabella Gateway.
 * =============================================================================
 */

import * as React from "react";
import {
  StrictMode,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";

import App from "./App";
import "./index.css";
import { restoreAdvertisingConsent } from "./lib/analytics";
import { configureIsabellaFetch } from "./lib/secure-fetch";

/* =============================================================================
   01. BUILD CONSTANTS
   ============================================================================= */

const APPLICATION = "isabella-villaseñor-ai" as const;
const RUNTIME_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.0.0";
const IS_PRODUCTION = import.meta.env.PROD;
const IS_DEVELOPMENT = import.meta.env.DEV;
const ROOT_SELECTOR = "#root";
const BOOT_TIMEOUT_MS = 12_000;
const MAX_ERROR_MESSAGE_LENGTH = 360;
const MAX_COMPONENT_STACK_LENGTH = 2_500;

/* =============================================================================
   02. PRIMITIVES
   ============================================================================= */

type ISODateTime = string;
type RuntimeEventName =
  | "runtime_initialized"
  | "runtime_ready"
  | "runtime_degraded"
  | "runtime_error"
  | "react_error"
  | "resource_error"
  | "service_worker_registered"
  | "service_worker_failed"
  | "connectivity_changed";

type RuntimeSeverity = "info" | "warning" | "error" | "critical";

type SafeScalar = string | number | boolean | null;
type SafeAttributes = Readonly<Record<string, SafeScalar>>;

interface RuntimeEvent {
  readonly eventId: string;
  readonly type: RuntimeEventName;
  readonly severity: RuntimeSeverity;
  readonly occurredAt: ISODateTime;
  readonly application: typeof APPLICATION;
  readonly version: string;
  readonly environment: "development" | "production";
  readonly sessionId: string;
  readonly attributes: SafeAttributes;
}

interface ErrorDescriptor {
  readonly name: string;
  readonly message: string;
  readonly componentStack?: string;
}

interface RuntimeContext {
  readonly sessionId: string;
  readonly bootedAt: ISODateTime;
  readonly environment: "development" | "production";
  readonly version: string;
}

type BootPhase =
  | "cold"
  | "initializing"
  | "mounting"
  | "ready"
  | "degraded"
  | "failed";

/* =============================================================================
   03. IDENTIDAD DE EJECUCIÓN
   ============================================================================= */

function createRuntimeId(prefix: string): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.randomUUID) {
    return `${prefix}_${cryptoApi.randomUUID()}`;
  }

  /*
   * Fallback no criptográfico para navegadores antiguos.
   * Es un ID técnico efímero, no una clave, token ni identidad de usuario.
   */
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

const runtime: RuntimeContext = Object.freeze({
  sessionId: createRuntimeId("isabella_runtime"),
  bootedAt: new Date().toISOString(),
  environment: IS_PRODUCTION ? "production" : "development",
  version: RUNTIME_VERSION,
});

/* =============================================================================
   04. EVENT BUS TÉCNICO Y SEGURO
   =============================================================================
   Canal de señales del frontend.

   No hace fetch de forma automática:
   - evita bucles si la red o el gateway están degradados;
   - desacopla el boot del proveedor de observabilidad;
   - permite que un adaptador autenticado y validado escuche los eventos.
   ============================================================================= */

function emitRuntimeEvent(
  type: RuntimeEventName,
  severity: RuntimeSeverity,
  attributes: SafeAttributes = {}
): void {
  const event: RuntimeEvent = {
    eventId: createRuntimeId("evt"),
    type,
    severity,
    occurredAt: new Date().toISOString(),
    application: APPLICATION,
    version: runtime.version,
    environment: runtime.environment,
    sessionId: runtime.sessionId,
    attributes,
  };

  window.dispatchEvent(
    new CustomEvent<RuntimeEvent>("isabella:runtime-event", {
      detail: event,
    })
  );

  if (IS_DEVELOPMENT) {
    const writer =
      severity === "critical" || severity === "error"
        ? console.error
        : severity === "warning"
          ? console.warn
          : console.info;

    writer(`[ISABELLA · ${type}]`, event);
  }
}

/* =============================================================================
   05. PRIVACY SANITIZER
   ============================================================================= */

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Error técnico no identificable.");
}

function sanitizeText(value: string, maxLength: number): string {
  return value
    .replace(
      /(?:bearer\s+|token=|apikey=|api[_-]?key=|authorization:)\S+/gi,
      "[REDACTED]"
    )
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, "[REDACTED]")
    .slice(0, maxLength);
}

function describeError(
  error: unknown,
  errorInfo?: Pick<ErrorInfo, "componentStack">
): ErrorDescriptor {
  const normalized = normalizeError(error);

  return {
    name: sanitizeText(normalized.name || "Error", 80),
    message: sanitizeText(
      normalized.message || "Error técnico no identificado.",
      MAX_ERROR_MESSAGE_LENGTH
    ),
    componentStack: errorInfo?.componentStack
      ? sanitizeText(errorInfo.componentStack, MAX_COMPONENT_STACK_LENGTH)
      : undefined,
  };
}

function reportRuntimeError(
  source: "react" | "window" | "promise" | "resource" | "service_worker",
  error: unknown,
  errorInfo?: Pick<ErrorInfo, "componentStack">
): void {
  const descriptor = describeError(error, errorInfo);

  emitRuntimeEvent("runtime_error", "error", {
    source,
    error_name: descriptor.name,
    error_message: descriptor.message,
    has_component_stack: Boolean(descriptor.componentStack),
  });
}

/* =============================================================================
   06. BOOT STATE MACHINE
   ============================================================================= */

class BootController {
  private phase: BootPhase = "cold";

  public getPhase(): BootPhase {
    return this.phase;
  }

  public transition(next: BootPhase): void {
    const allowedTransitions: Readonly<Record<BootPhase, readonly BootPhase[]>> =
      {
        cold: ["initializing", "failed"],
        initializing: ["mounting", "degraded", "failed"],
        mounting: ["ready", "degraded", "failed"],
        ready: ["degraded"],
        degraded: ["ready", "failed"],
        failed: [],
      };

    if (!allowedTransitions[this.phase].includes(next)) {
      emitRuntimeEvent("runtime_error", "warning", {
        source: "boot_state_machine",
        current_phase: this.phase,
        attempted_phase: next,
      });
      return;
    }

    this.phase = next;
  }
}

const bootController = new BootController();

/* =============================================================================
   07. ENTORNO Y CAPACIDADES
   ============================================================================= */

interface RuntimeCapabilities {
  readonly online: boolean;
  readonly serviceWorkerSupported: boolean;
  readonly webCryptoSupported: boolean;
  readonly localStorageAvailable: boolean;
  readonly reducedMotionPreferred: boolean;
}

function canUseLocalStorage(): boolean {
  try {
    const probe = "__isabella_storage_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function detectRuntimeCapabilities(): RuntimeCapabilities {
  return Object.freeze({
    online: navigator.onLine,
    serviceWorkerSupported: "serviceWorker" in navigator,
    webCryptoSupported: Boolean(globalThis.crypto?.subtle),
    localStorageAvailable: canUseLocalStorage(),
    reducedMotionPreferred: window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches,
  });
}

/* =============================================================================
   08. FALLO VISUAL DE CONTINUIDAD
   ============================================================================= */

function renderBootFailure(
  rootElement: HTMLElement,
  reason: string,
  canRetry = true
): void {
  rootElement.replaceChildren();

  const container = document.createElement("main");
  container.id = "main-content";
  container.setAttribute("role", "alert");
  container.setAttribute("aria-live", "assertive");
  container.className = "boot-fallback";

  container.innerHTML = `
    <section class="boot-fallback__panel" aria-labelledby="boot-failure-title">
      <p class="boot-fallback__eyebrow">Isabella Villaseñor AI</p>
      <h1 id="boot-failure-title" class="boot-fallback__title">
        La interfaz requiere una restauración controlada
      </h1>
      <p class="boot-fallback__description">
        El núcleo de experiencia no pudo inicializarse por completo.
        No se ha transmitido contenido de tu conversación.
      </p>
      <p class="boot-fallback__reference">
        Referencia técnica: ${reason}
      </p>
      ${
        canRetry
          ? `<button id="isabella-boot-retry" class="boot-fallback__action" type="button">
               Restaurar sesión
             </button>`
          : ""
      }
    </section>
  `;

  rootElement.appendChild(container);

  document.getElementById("isabella-boot-retry")?.addEventListener("click", () => {
    window.location.reload();
  });
}

/* =============================================================================
   09. ROOT ERROR BOUNDARY
   ============================================================================= */

interface RootContinuityBoundaryProps {
  readonly children: ReactNode;
}

interface RootContinuityBoundaryState {
  readonly hasError: boolean;
  readonly incidentReference: string | null;
}

class RootContinuityBoundary extends React.Component<
  RootContinuityBoundaryProps,
  RootContinuityBoundaryState
> {
  declare readonly props: Readonly<RootContinuityBoundaryProps>;

  public state: RootContinuityBoundaryState = {
    hasError: false,
    incidentReference: null,
  };

  public static getDerivedStateFromError(): RootContinuityBoundaryState {
    return {
      hasError: true,
      incidentReference: createRuntimeId("ui_recovery"),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportRuntimeError("react", error, errorInfo);
  }

  private handleRecovery = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main
          id="main-content"
          className="boot-fallback"
          role="alert"
          aria-live="assertive"
        >
          <section
            className="boot-fallback__panel"
            aria-labelledby="continuity-title"
          >
            <p className="boot-fallback__eyebrow">
              Isabella Villaseñor AI · Continuidad protegida
            </p>

            <h1 id="continuity-title" className="boot-fallback__title">
              El entorno requiere una restauración
            </h1>

            <p className="boot-fallback__description">
              Se aisló un fallo de interfaz para proteger la continuidad de la
              sesión. Puedes restaurar el entorno de forma segura.
            </p>

            <p className="boot-fallback__reference">
              Referencia técnica: {this.state.incidentReference}
            </p>

            <button
              type="button"
              className="boot-fallback__action"
              onClick={this.handleRecovery}
            >
              Restaurar entorno
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

/* =============================================================================
   10. EVENTOS GLOBALES DEL NAVEGADOR
   ============================================================================= */

function installGlobalErrorGuards(): void {
  window.addEventListener("error", (event) => {
    /*
     * Un error de recurso (img, stylesheet, script) no siempre presenta
     * un Error utilizable. Sólo se reporta su tipo y etiqueta HTML.
     */
    if (event.target instanceof HTMLElement) {
      emitRuntimeEvent("resource_error", "warning", {
        resource_type: event.target.tagName.toLowerCase(),
      });
      return;
    }

    reportRuntimeError("window", event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportRuntimeError("promise", event.reason);
  });

  window.addEventListener("online", () => {
    emitRuntimeEvent("connectivity_changed", "info", {
      online: true,
    });
  });

  window.addEventListener("offline", () => {
    emitRuntimeEvent("connectivity_changed", "warning", {
      online: false,
    });
  });
}

/* =============================================================================
   11. SERVICE WORKER CONTROLADO
   =============================================================================
   Sólo en producción, y únicamente si existe /sw.js.

   Regla:
   - Nunca registrar un SW en dev: puede cachear bundles obsoletos.
   - Nunca bloquear el montaje de React esperando al SW.
   - El SW debe tener una estrategia explícita por rutas y versionado de cache.
   ============================================================================= */

async function registerServiceWorker(): Promise<void> {
  if (!IS_PRODUCTION || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    emitRuntimeEvent("service_worker_registered", "info", {
      scope: registration.scope,
      state: registration.active?.state ?? "installing",
    });

    registration.addEventListener("updatefound", () => {
      emitRuntimeEvent("service_worker_registered", "info", {
        scope: registration.scope,
        state: "update_available",
      });
    });
  } catch (error) {
    reportRuntimeError("service_worker", error);

    emitRuntimeEvent("service_worker_failed", "warning", {
      fallback: "network_only",
    });
  }
}

/* =============================================================================
   12. MOUNT ORCHESTRATOR
   ============================================================================= */

function mountApplication(rootElement: HTMLElement): Root {
  const root = createRoot(rootElement, {
    identifierPrefix: "isabella-",

    onCaughtError(error, errorInfo) {
      const descriptor = describeError(error, errorInfo);

      emitRuntimeEvent("react_error", "warning", {
        boundary: "caught",
        error_name: descriptor.name,
        error_message: descriptor.message,
      });
    },

    onUncaughtError(error, errorInfo) {
      const descriptor = describeError(error, errorInfo);

      emitRuntimeEvent("react_error", "critical", {
        boundary: "uncaught",
        error_name: descriptor.name,
        error_message: descriptor.message,
      });
    },

    onRecoverableError(error, errorInfo) {
      const descriptor = describeError(error, errorInfo);

      emitRuntimeEvent("react_error", "info", {
        boundary: "recoverable",
        error_name: descriptor.name,
        error_message: descriptor.message,
      });
    },
  });

  root.render(
    <StrictMode>
      <RootContinuityBoundary>
        <App />
      </RootContinuityBoundary>
    </StrictMode>
  );

  return root;
}

/* =============================================================================
   13. BOOT SEQUENCE
   ============================================================================= */

function boot(): void {
  bootController.transition("initializing");

  // Consent-gated analytics — no external script loads before consent
  restoreAdvertisingConsent();

  // Secure fetch — origin allowlist and prompt policy
  configureIsabellaFetch({
    apiOrigins: [window.location.origin],
    authMode: "memory",
    defaultTimeoutMs: 30_000,
    maxTimeoutMs: 55_000,
    maxBodyBytes: 1_048_576,
    reviewHighRisk: false,
  });

  const rootElement = document.querySelector<HTMLElement>(ROOT_SELECTOR);

  if (!rootElement) {
    bootController.transition("failed");

    throw new Error(
      `No se encontró el punto de montaje ${ROOT_SELECTOR} en index.html.`
    );
  }

  const capabilities = detectRuntimeCapabilities();

  emitRuntimeEvent("runtime_initialized", "info", {
    online: capabilities.online,
    service_worker_supported: capabilities.serviceWorkerSupported,
    web_crypto_supported: capabilities.webCryptoSupported,
    local_storage_available: capabilities.localStorageAvailable,
    reduced_motion: capabilities.reducedMotionPreferred,
  });

  /*
   * El cliente puede trabajar sin WebCrypto, storage o SW.
   * Se degrada, pero no se impide el acceso a la interfaz.
   */
  if (!capabilities.webCryptoSupported || !capabilities.localStorageAvailable) {
    bootController.transition("degraded");

    emitRuntimeEvent("runtime_degraded", "warning", {
      web_crypto_supported: capabilities.webCryptoSupported,
      local_storage_available: capabilities.localStorageAvailable,
    });
  }

  installGlobalErrorGuards();

  const bootWatchdog = window.setTimeout(() => {
    if (
      bootController.getPhase() === "initializing" ||
      bootController.getPhase() === "mounting"
    ) {
      bootController.transition("degraded");

      emitRuntimeEvent("runtime_degraded", "warning", {
        reason: "boot_watchdog_timeout",
        timeout_ms: BOOT_TIMEOUT_MS,
      });
    }
  }, BOOT_TIMEOUT_MS);

  try {
    bootController.transition("mounting");
    mountApplication(rootElement);

    window.clearTimeout(bootWatchdog);

    if (bootController.getPhase() !== "degraded") {
      bootController.transition("ready");
    }

    emitRuntimeEvent("runtime_ready", "info", {
      phase: bootController.getPhase(),
    });

    void registerServiceWorker();
  } catch (error) {
    window.clearTimeout(bootWatchdog);

    bootController.transition("failed");
    reportRuntimeError("react", error);

    renderBootFailure(
      rootElement,
      `BOOT_${createRuntimeId("failure").slice(-12).toUpperCase()}`
    );
  }
}

boot();
