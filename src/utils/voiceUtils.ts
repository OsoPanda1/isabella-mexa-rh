/**
 * =============================================================================
 * ISABELLA VILLASEÑOR — SOVEREIGN VOICE UTILITIES
 * =============================================================================
 *
 * Principio operativo:
 *   Isabella no depende de ElevenLabs, OpenAI, Google, Azure ni de un TTS SaaS.
 *
 * Ruta canónica:
 *   UI -> /api/voice/synthesize -> Isabella Gateway -> isabella-tts local
 *      -> modelo soberano "isabella_es_mx_v1" -> audio temporal -> UI
 *
 * Este módulo:
 * - Construye solicitudes hacia TU propio gateway.
 * - Reproduce el audio generado por TU motor local.
 * - Cancela de forma segura cualquier reproducción anterior.
 * - Tiene una sola voz local del navegador como continuidad técnica.
 * - Persiste sólo un fingerprint técnico de esa voz local.
 *
 * Este módulo NO:
 * - Entrena modelos ni clona voces.
 * - Importa ni expone el MP3 privado de referencia.
 * - Incluye una API key, endpoint de terceros o providerVoiceId.
 * - Envía datos a servicios externos.
 *
 * El audio fuente y los pesos del modelo deben vivir fuera de Git:
 *   private-assets/isabellaOficial-voz.mp3
 *   services/isabella-tts/models/isabella_es_mx_v1/
 * =============================================================================
 */

import { authFetch } from "../lib/auth-client";

/* =============================================================================
   01. IDENTIDAD CANÓNICA
   ============================================================================= */

export const ISABELLA_VOICE_PROFILE = "isabella_es_mx_v1" as const;
export const ISABELLA_VOICE_MODEL_VERSION = "1.0.0" as const;
export const ISABELLA_VOICE_LOCALE = "es-MX" as const;

export type IsabellaVoiceProfile = typeof ISABELLA_VOICE_PROFILE;
export type IsabellaVoiceModelVersion =
  typeof ISABELLA_VOICE_MODEL_VERSION;
export type IsabellaVoiceLocale = "es-MX" | "es-ES" | "en-US";

export type IsabellaVoiceStyle =
  | "natural"
  | "serene"
  | "poetic"
  | "lucid"
  | "protective"
  | "radiant";

export type IsabellaVoiceEngine =
  | "sovereign_local_tts"
  | "browser_continuity"
  | "silent";

export type VoiceAvailability =
  | "available"
  | "degraded"
  | "unavailable";

export interface IsabellaVoiceIdentity {
  readonly profile: IsabellaVoiceProfile;
  readonly modelVersion: IsabellaVoiceModelVersion;
  readonly displayName: "Isabella Villaseñor";
  readonly canonicalLocale: typeof ISABELLA_VOICE_LOCALE;
  readonly localModelAlias: "isabella-v1";
  readonly defaultStyle: "natural";
  readonly maximumTextLength: number;
  readonly browserContinuityProsody: Readonly<{
    rate: number;
    pitch: number;
    volume: number;
  }>;
}

export const ISABELLA_VOICE: IsabellaVoiceIdentity = Object.freeze({
  profile: ISABELLA_VOICE_PROFILE,
  modelVersion: ISABELLA_VOICE_MODEL_VERSION,
  displayName: "Isabella Villaseñor",
  canonicalLocale: ISABELLA_VOICE_LOCALE,
  localModelAlias: "isabella-v1",
  defaultStyle: "natural",
  maximumTextLength: 4_000,

  /*
   * Estos valores se aplican sólo a la voz de continuidad del navegador.
   * La voz oficial debe conservar su prosodia dentro del modelo TTS local.
   */
  browserContinuityProsody: {
    rate: 0.96,
    pitch: 1,
    volume: 1,
  },
});

/* =============================================================================
   02. CONTRATO CON TU GATEWAY
   ============================================================================= */

export interface SovereignVoiceSynthesisRequest {
  readonly requestId: string;
  readonly text: string;
  readonly profile: IsabellaVoiceProfile;
  readonly modelVersion: IsabellaVoiceModelVersion;
  readonly locale: IsabellaVoiceLocale;
  readonly style: IsabellaVoiceStyle;
  readonly prosody?: Readonly<{
    rate?: number;
    volume?: number;
  }>;
}

export interface SovereignVoiceSynthesisResponse {
  readonly requestId: string;
  readonly engine: "sovereign_local_tts";
  readonly profile: IsabellaVoiceProfile;
  readonly modelVersion: IsabellaVoiceModelVersion;
  readonly locale: IsabellaVoiceLocale;
  readonly audioUrl: string;
  readonly contentType: "audio/wav" | "audio/mpeg" | "audio/ogg";
  readonly durationMs?: number;
  readonly createdAt: string;
}

export interface SovereignVoiceHealth {
  readonly engine: "sovereign_local_tts";
  readonly availability: VoiceAvailability;
  readonly modelLoaded: boolean;
  readonly profile: IsabellaVoiceProfile;
  readonly modelVersion: IsabellaVoiceModelVersion;
  readonly checkedAt: string;
}

/* =============================================================================
   03. OPCIONES Y RESULTADOS
   ============================================================================= */

export interface SpeakAsIsabellaOptions {
  readonly style?: IsabellaVoiceStyle;
  readonly locale?: IsabellaVoiceLocale;
  readonly rate?: number;
  readonly volume?: number;
  readonly signal?: AbortSignal;

  /**
   * Si false, un error del motor local se propaga y no usa Web Speech API.
   * Útil en rutas donde la identidad vocal debe ser estrictamente canónica.
   */
  readonly allowBrowserContinuity?: boolean;

  /**
   * Hook de UI/telemetría local. Nunca recibe el texto ni el audio.
   */
  readonly onEngineResolved?: (engine: IsabellaVoiceEngine) => void;
}

export interface SpeakAsIsabellaResult {
  readonly engine: IsabellaVoiceEngine;
  readonly requestId: string;
  readonly audioUrl?: string;
  readonly fallbackReason?: string;
}

export interface VoicePlaybackHandle {
  readonly stop: () => void;
  readonly pause: () => void;
  readonly resume: () => Promise<void>;
  readonly engine: "sovereign_local_tts";
}

/* =============================================================================
   04. API PÚBLICA PRINCIPAL
   ============================================================================= */

/**
 * Sintetiza y reproduce texto con la voz oficial de Isabella.
 *
 * Primero usa tu API local:
 *   POST /api/voice/synthesize
 *
 * Si no está disponible y allowBrowserContinuity !== false:
 *   usa una única voz local persistida como continuidad técnica.
 */
export async function speakAsIsabella(
  text: string,
  options: SpeakAsIsabellaOptions = {}
): Promise<SpeakAsIsabellaResult> {
  const request = createSovereignVoiceRequest(text, options);

  try {
    const response = await requestSovereignVoiceAudio(request, options.signal);

    await playSovereignAudio(response.audioUrl, options.signal);

    options.onEngineResolved?.("sovereign_local_tts");

    return {
      engine: "sovereign_local_tts",
      requestId: request.requestId,
      audioUrl: response.audioUrl,
    };
  } catch (error) {
    if (isAbortError(error) || options.allowBrowserContinuity === false) {
      throw error;
    }

    const fallback = await speakWithBrowserContinuity(
      request.text,
      options.locale
    );

    options.onEngineResolved?.(fallback.engine);

    return {
      requestId: request.requestId,
      ...fallback,
    };
  }
}

/**
 * Detiene tanto audio generado por el motor soberano como voz de navegador.
 */
export function stopIsabellaVoice(): void {
  stopActiveSovereignAudio();

  if (
    typeof window !== "undefined" &&
    "speechSynthesis" in window
  ) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Pausa sólo el audio oficial generado por tu motor local.
 */
export function pauseIsabellaVoice(): void {
  activeSovereignAudio?.pause();
}

/**
 * Reanuda sólo el audio oficial generado por tu motor local.
 */
export async function resumeIsabellaVoice(): Promise<void> {
  if (!activeSovereignAudio) return;

  await activeSovereignAudio.play();
}

/**
 * Consulta la disponibilidad de tu motor local.
 *
 * El endpoint no debe exponer rutas internas, secretos, modelo base,
 * ubicación del servidor, ni información de usuarios.
 */
export async function getSovereignVoiceHealth(
  signal?: AbortSignal
): Promise<SovereignVoiceHealth> {
  const response = await fetch("/api/voice/health", {
    method: "GET",
    credentials: "same-origin",
    signal,
    headers: {
      "x-isabella-voice-profile": ISABELLA_VOICE.profile,
    },
  });

  if (!response.ok) {
    throw new Error(`ISABELLA_VOICE_HEALTH_${response.status}`);
  }

  const payload = (await response.json()) as SovereignVoiceHealth;

  if (
    payload.engine !== "sovereign_local_tts" ||
    payload.profile !== ISABELLA_VOICE.profile ||
    payload.modelVersion !== ISABELLA_VOICE.modelVersion
  ) {
    throw new Error("ISABELLA_VOICE_HEALTH_INVALID_RESPONSE");
  }

  return payload;
}

/* =============================================================================
   05. CONSTRUCCIÓN DE SOLICITUDES
   ============================================================================= */

export function createSovereignVoiceRequest(
  text: string,
  options: Partial<{
    requestId: string;
    locale: IsabellaVoiceLocale;
    style: IsabellaVoiceStyle;
    rate: number;
    volume: number;
  }> = {}
): SovereignVoiceSynthesisRequest {
  const normalizedText = normalizeVoiceText(text);

  if (!normalizedText) {
    throw new Error("ISABELLA_VOICE_EMPTY_TEXT");
  }

  return {
    requestId: options.requestId ?? createVoiceRequestId(),
    text: normalizedText,
    profile: ISABELLA_VOICE.profile,
    modelVersion: ISABELLA_VOICE.modelVersion,
    locale: options.locale ?? ISABELLA_VOICE.canonicalLocale,
    style: options.style ?? ISABELLA_VOICE.defaultStyle,
    prosody: {
      rate: clamp(options.rate ?? 1, 0.85, 1.15),
      volume: clamp(options.volume ?? 1, 0, 1),
    },
  };
}

/**
 * Normaliza únicamente espacios y tamaño.
 * No modifica semántica, no registra contenido ni aplica filtros de negocio.
 */
export function normalizeVoiceText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ISABELLA_VOICE.maximumTextLength);
}

/* =============================================================================
   06. CLIENTE DEL MOTOR SOBERANO
   ============================================================================= */

async function requestSovereignVoiceAudio(
  request: SovereignVoiceSynthesisRequest,
  signal?: AbortSignal
): Promise<SovereignVoiceSynthesisResponse> {
  /*
   * authFetch attaches the guest Bearer token or the operator's API key and
   * renews the session once on 401. Plain fetch left the gateway endpoint
   * unreachable in production and silently degraded every request to the
   * browser voice.
   */
  const response = await authFetch("/api/voice/synthesize", {
    method: "POST",
    credentials: "same-origin",
    signal,
    headers: {
      "x-isabella-voice-profile": request.profile,
      "x-isabella-voice-version": request.modelVersion,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`ISABELLA_LOCAL_TTS_${response.status}`);
  }

  const payload = (await response.json()) as SovereignVoiceSynthesisResponse;

  validateSovereignVoiceResponse(payload, request);

  return payload;
}

function validateSovereignVoiceResponse(
  payload: SovereignVoiceSynthesisResponse,
  request: SovereignVoiceSynthesisRequest
): void {
  const isValid =
    payload.engine === "sovereign_local_tts" &&
    payload.requestId === request.requestId &&
    payload.profile === request.profile &&
    payload.modelVersion === request.modelVersion &&
    payload.locale === request.locale &&
    typeof payload.audioUrl === "string" &&
    payload.audioUrl.length > 0 &&
    isAllowedAudioContentType(payload.contentType);

  if (!isValid) {
    throw new Error("ISABELLA_LOCAL_TTS_INVALID_RESPONSE");
  }
}

function isAllowedAudioContentType(
  contentType: string
): contentType is SovereignVoiceSynthesisResponse["contentType"] {
  return (
    contentType === "audio/wav" ||
    contentType === "audio/mpeg" ||
    contentType === "audio/ogg"
  );
}

/* =============================================================================
   07. REPRODUCCIÓN DE AUDIO SOBERANO
   ============================================================================= */

let activeSovereignAudio: HTMLAudioElement | null = null;

export async function playSovereignAudio(
  audioUrl: string,
  signal?: AbortSignal
): Promise<VoicePlaybackHandle> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    throw new Error("ISABELLA_AUDIO_PLAYBACK_UNSUPPORTED");
  }

  stopIsabellaVoice();

  const audio = new Audio(audioUrl);
  audio.preload = "auto";
  activeSovereignAudio = audio;

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const onEnded = () => finish(resolve);

    const onError = () =>
      finish(() =>
        reject(new Error("ISABELLA_SOVEREIGN_AUDIO_PLAYBACK_FAILED"))
      );

    const onAbort = () => {
      audio.pause();
      audio.currentTime = 0;

      finish(() =>
        reject(new DOMException("Voice playback aborted.", "AbortError"))
      );
    };

    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });

    audio.play().catch((error: unknown) => {
      finish(() =>
        reject(
          error instanceof Error
            ? error
            : new Error("ISABELLA_AUDIO_PLAYBACK_REJECTED")
        )
      );
    });
  });

  return {
    engine: "sovereign_local_tts",
    stop: stopIsabellaVoice,
    pause: pauseIsabellaVoice,
    resume: resumeIsabellaVoice,
  };
}

function stopActiveSovereignAudio(): void {
  if (!activeSovereignAudio) return;

  activeSovereignAudio.pause();
  activeSovereignAudio.currentTime = 0;
  activeSovereignAudio.src = "";
  activeSovereignAudio.load();
  activeSovereignAudio = null;
}

/* =============================================================================
   08. CONTINGENCIA DEL NAVEGADOR
   =============================================================================
   Esta ruta NO es la identidad oficial de Isabella.

   Se usa sólo cuando tu motor local está temporalmente inaccesible:
   - una sola voz es elegida;
   - su fingerprint se persiste por navegador;
   - no hay rotación de voces por mensaje;
   - no intenta "fabricar" género mediante pitch.
   ============================================================================= */

const BROWSER_VOICE_STORAGE_KEY =
  "isabella.browser-continuity-voice.v1";

interface BrowserVoiceFingerprint {
  readonly name: string;
  readonly lang: string;
  readonly voiceURI: string;
}

type BrowserVoiceFallbackResult =
  | {
      readonly engine: "browser_continuity";
      readonly fallbackReason?: undefined;
    }
  | {
      readonly engine: "silent";
      readonly fallbackReason:
        | "BROWSER_SPEECH_UNSUPPORTED"
        | "NO_BROWSER_VOICES"
        | "NO_COMPATIBLE_BROWSER_VOICE";
    };

/*
 * Esta lista es estrictamente una heurística de continuidad para dispositivos
 * que expongan nombres conocidos. La voz oficial nunca depende de ella.
 */
const PREFERRED_LOCAL_VOICE_HINTS = [
  "dalia",
  "paloma",
  "elvira",
  "elena",
  "laura",
  "sabrina",
  "alba",
  "salome",
  "ximena",
  "paulina",
  "monica",
  "lucia",
  "soledad",
  "francisca",
  "helena",
  "carmen",
  "conchita",
  "penelope",
  "sabina",
  "samantha",
  "victoria",
  "zira",
  "hazel",
  "aria",
  "jenny",
] as const;

const EXCLUDED_LOCAL_VOICE_HINTS = [
  "jorge",
  "diego",
  "pablo",
  "carlos",
  "miguel",
  "raul",
  "enrique",
  "alvaro",
  "mateo",
  "manuel",
  "david",
  "antonio",
  "juan",
  "fernando",
  "pedro",
  "javier",
  "rodrigo",
  "luis",
  "sergio",
  "alejandro",
  "alberto",
  "hugo",
  "daniel",
  "mario",
  "marcos",
  "santiago",
  "victor",
  "fred",
  "bruce",
  "ralph",
  "tom",
  "george",
  "john",
  "mark",
  "paul",
  "michael",
] as const;

async function speakWithBrowserContinuity(
  text: string,
  locale: IsabellaVoiceLocale | undefined
): Promise<BrowserVoiceFallbackResult> {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return {
      engine: "silent",
      fallbackReason: "BROWSER_SPEECH_UNSUPPORTED",
    };
  }

  const voices = await getBrowserVoices();

  if (voices.length === 0) {
    return {
      engine: "silent",
      fallbackReason: "NO_BROWSER_VOICES",
    };
  }

  const voice = resolveStableBrowserVoice(voices);

  if (!voice) {
    return {
      engine: "silent",
      fallbackReason: "NO_COMPATIBLE_BROWSER_VOICE",
    };
  }

  stopIsabellaVoice();

  const utterance = new SpeechSynthesisUtterance(normalizeVoiceText(text));

  utterance.voice = voice;
  utterance.lang = locale ?? ISABELLA_VOICE.canonicalLocale;
  utterance.rate = ISABELLA_VOICE.browserContinuityProsody.rate;
  utterance.pitch = ISABELLA_VOICE.browserContinuityProsody.pitch;
  utterance.volume = ISABELLA_VOICE.browserContinuityProsody.volume;

  window.speechSynthesis.speak(utterance);

  return { engine: "browser_continuity" };
}

/**
 * Obtiene voces incluso cuando el navegador las carga después de iniciar.
 */
export async function getBrowserVoices(
  timeoutMs = 2_500
): Promise<readonly SpeechSynthesisVoice[]> {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    return [];
  }

  const synthesis = window.speechSynthesis;
  const immediatelyAvailable = synthesis.getVoices();

  if (immediatelyAvailable.length > 0) {
    return immediatelyAvailable;
  }

  return new Promise((resolve) => {
    let completed = false;

    const finish = () => {
      if (completed) return;

      completed = true;
      synthesis.removeEventListener("voiceschanged", onVoicesChanged);
      window.clearTimeout(timeoutId);

      resolve(synthesis.getVoices());
    };

    const onVoicesChanged = () => finish();
    const timeoutId = window.setTimeout(finish, timeoutMs);

    synthesis.addEventListener("voiceschanged", onVoicesChanged, {
      once: true,
    });
  });
}

/**
 * Retorna siempre la misma voz en un navegador mientras continúe instalada.
 */
export function resolveStableBrowserVoice(
  voices: readonly SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;

  const persistedFingerprint = readBrowserVoiceFingerprint();

  if (persistedFingerprint) {
    const restoredVoice = voices.find(
      (voice) =>
        voice.name === persistedFingerprint.name &&
        voice.lang === persistedFingerprint.lang &&
        voice.voiceURI === persistedFingerprint.voiceURI
    );

    if (restoredVoice) {
      return restoredVoice;
    }
  }

  const selectedVoice = voices
    .map((voice) => ({
      voice,
      score: scoreBrowserVoice(voice),
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((left, right) => right.score - left.score)
    .at(0)?.voice;

  if (selectedVoice) {
    persistBrowserVoiceFingerprint(selectedVoice);
  }

  return selectedVoice;
}

function scoreBrowserVoice(voice: SpeechSynthesisVoice): number {
  const descriptor = normalizeDescriptor(
    `${voice.name} ${voice.voiceURI}`
  );
  const language = voice.lang.toLowerCase();

  if (containsAnyHint(descriptor, EXCLUDED_LOCAL_VOICE_HINTS)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (language === "es-mx") score += 1_000;
  else if (language === "es-es") score += 850;
  else if (language.startsWith("es")) score += 700;
  else if (language.startsWith("en")) score += 100;
  else return Number.NEGATIVE_INFINITY;

  if (containsAnyHint(descriptor, PREFERRED_LOCAL_VOICE_HINTS)) {
    score += 250;
  }

  if (/natural|neural|enhanced|online|premium/.test(descriptor)) {
    score += 120;
  }

  if (voice.localService) score += 40;
  if (voice.default) score += 10;

  return score;
}

export function resetBrowserContinuityVoice(): void {
  try {
    window.localStorage.removeItem(BROWSER_VOICE_STORAGE_KEY);
  } catch {
    // El almacenamiento puede estar bloqueado; no afecta el runtime.
  }
}

function readBrowserVoiceFingerprint(): BrowserVoiceFingerprint | null {
  try {
    const raw = window.localStorage.getItem(BROWSER_VOICE_STORAGE_KEY);

    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("name" in parsed) ||
      !("lang" in parsed) ||
      !("voiceURI" in parsed)
    ) {
      return null;
    }

    const value = parsed as Record<string, unknown>;

    if (
      typeof value.name !== "string" ||
      typeof value.lang !== "string" ||
      typeof value.voiceURI !== "string"
    ) {
      return null;
    }

    return {
      name: value.name,
      lang: value.lang,
      voiceURI: value.voiceURI,
    };
  } catch {
    return null;
  }
}

function persistBrowserVoiceFingerprint(
  voice: SpeechSynthesisVoice
): void {
  try {
    const fingerprint: BrowserVoiceFingerprint = {
      name: voice.name,
      lang: voice.lang,
      voiceURI: voice.voiceURI,
    };

    window.localStorage.setItem(
      BROWSER_VOICE_STORAGE_KEY,
      JSON.stringify(fingerprint)
    );
  } catch {
    // Modo privado o storage bloqueado: se conserva la voz sólo en memoria.
  }
}

/* =============================================================================
   09. UTILIDADES INTERNAS
   ============================================================================= */

function normalizeDescriptor(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function containsAnyHint(
  normalizedValue: string,
  hints: readonly string[]
): boolean {
  return hints.some((hint) =>
    normalizedValue.includes(normalizeDescriptor(hint))
  );
}

function createVoiceRequestId(): string {
  if (globalThis.crypto?.randomUUID) {
    return `iv_voice_${globalThis.crypto.randomUUID()}`;
  }

  return `iv_voice_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

/* =============================================================================
   10. FEMALE VOICE HELPERS (used by CrownContext + VoiceStudioView)
   ============================================================================= */

const FEMALE_VOICE_HINTS = [
  ...PREFERRED_LOCAL_VOICE_HINTS,
  "mónica", "gabriela", "claudia", "patricia", "rosa", "maria", "ana",
  "clara", "sofia", "valeria", "camila", "isabella", "fernanda", "diana",
  "beatriz", "reina", "princesa", "google", "karen", "sabina",
  "daniela", "alejandra", "greta", "helena", "norma",
] as const;

export function isStrictlyFemaleVoice(voice: SpeechSynthesisVoice): boolean {
  const descriptor = normalizeDescriptor(`${voice.name} ${voice.voiceURI}`);
  if (containsAnyHint(descriptor, EXCLUDED_LOCAL_VOICE_HINTS)) return false;
  if (containsAnyHint(descriptor, FEMALE_VOICE_HINTS)) return true;
  const lang = voice.lang.toLowerCase();
  if (lang === "es-mx" || lang === "es-es" || lang.startsWith("es")) return true;
  return false;
}

export function getAvailableFemaleVoices(
  voices: readonly SpeechSynthesisVoice[]
): SpeechSynthesisVoice[] {
  return voices.filter(isStrictlyFemaleVoice);
}

export function selectBestFemaleVoice(
  voices: readonly SpeechSynthesisVoice[],
  preferredName?: string
): { voice: SpeechSynthesisVoice | null; pitchMultiplier: number } {
  if (voices.length === 0) return { voice: null, pitchMultiplier: 1 };

  if (preferredName) {
    const exact = voices.find(
      (v) => v.name === preferredName && isStrictlyFemaleVoice(v)
    );
    if (exact) return { voice: exact, pitchMultiplier: 1 };
  }

  const female = getAvailableFemaleVoices(voices);
  if (female.length === 0) return { voice: null, pitchMultiplier: 1 };

  const scored = female
    .map((v) => ({ voice: v, score: scoreBrowserVoice(v) }))
    .filter((c) => Number.isFinite(c.score))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return { voice: null, pitchMultiplier: 1 };

  const descriptor = normalizeDescriptor(best.voice.name);
  const pitchMultiplier =
    /deep|low|bass/.test(descriptor) ? 1.15 :
    /high|soprano/.test(descriptor) ? 0.9 :
    1.0;

  return { voice: best.voice, pitchMultiplier };
}
