/**
 * =============================================================================
 * ISABELLA CINEMATIC TRAILER — PUERTA DE ENTRADA CINEMATOGRÁFICA
 * =============================================================================
 * Componente de presentación inmersiva, accesible y de alto rendimiento.
 *
 * Principios (ver spec oficial):
 * - El canvas se dibuja con requestAnimationFrame; React NO se re-renderiza
 *   por frame (elapsed vive en un ref, no en estado).
 * - El audio SOLO arranca tras gesto del usuario (políticas de autoplay).
 * - Respeta prefers-reduced-motion: composición estática, sin shake/aberration.
 * - El CTA "Entrar al sistema" está SIEMPRE visible y accesible.
 * - Toda telemetría es SIMULADA y se etiqueta como tal (honestidad de datos).
 * - Limpieza total de AudioContext, rAF y listeners al desmontar.
 * =============================================================================
 */

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./IsabellaCinematicTrailer.css";

/* =============================================================================
 * ESCENA / DIRECTOR AVGL
 * ============================================================================= */

type SceneId =
  | "signal"
  | "awakening"
  | "identity"
  | "manifesto"
  | "arrival";

interface SceneCue {
  id: SceneId;
  at: number;
  duration: number;
  subtitle: string;
  camera: { zoom: number; shake: number; chromaticAberration: number };
  visual: {
    starSpeed: number;
    orbitalOpacity: number;
    hudOpacity: number;
    radialLight: number;
  };
  audio?: { enabled: boolean; intensity: number };
}

const SCENE_CUES: readonly SceneCue[] = [
  {
    id: "signal",
    at: 0,
    duration: 4200,
    subtitle: "Iniciando vector de enlace de Nodo Cero...",
    camera: { zoom: 1, shake: 0, chromaticAberration: 0 },
    visual: { starSpeed: 1.2, orbitalOpacity: 0.1, hudOpacity: 0.25, radialLight: 0.2 },
  },
  {
    id: "awakening",
    at: 4200,
    duration: 6200,
    subtitle: "Desplegando infraestructura cognitiva y constelaciones.",
    camera: { zoom: 1.18, shake: 0.18, chromaticAberration: 0.02 },
    visual: { starSpeed: 3.2, orbitalOpacity: 0.6, hudOpacity: 0.55, radialLight: 0.55 },
  },
  {
    id: "identity",
    at: 10400,
    duration: 6800,
    subtitle: "Isabella Villaseñor — identidad presentada.",
    camera: { zoom: 1.05, shake: 0.04, chromaticAberration: 0 },
    visual: { starSpeed: 1.4, orbitalOpacity: 0.85, hudOpacity: 0.7, radialLight: 0.8 },
  },
  {
    id: "manifesto",
    at: 17200,
    duration: 6800,
    subtitle: "La verificación es matemática. La memoria pertenece al territorio.",
    camera: { zoom: 1.12, shake: 0.08, chromaticAberration: 0.01 },
    visual: { starSpeed: 2, orbitalOpacity: 0.95, hudOpacity: 0.85, radialLight: 0.7 },
  },
  {
    id: "arrival",
    at: 24200,
    duration: 5800,
    subtitle: "El núcleo está listo para recibirte.",
    camera: { zoom: 1.35, shake: 0.22, chromaticAberration: 0.04 },
    visual: { starSpeed: 4.8, orbitalOpacity: 1, hudOpacity: 1, radialLight: 1 },
  },
];

const DURATION_MS = 30_000;

function resolveScene(elapsedMs: number): SceneId {
  let current: SceneId = "signal";
  for (const cue of SCENE_CUES) {
    if (elapsedMs >= cue.at) current = cue.id;
    else break;
  }
  return current;
}

function cueFor(elapsedMs: number): SceneCue {
  let active = SCENE_CUES[0];
  for (const cue of SCENE_CUES) {
    if (elapsedMs >= cue.at) active = cue;
    else break;
  }
  return active;
}

/* =============================================================================
 * MOTOR DE AUDIO (FFT reactiva) — creado SOLO tras gesto del usuario
 * ============================================================================= */

interface AudioEngine {
  context: AudioContext;
  analyser: AnalyserNode;
  gain: GainNode;
  freqData: Uint8Array;
  start: () => void;
  stop: () => void;
  getBands: () => { bass: number; mid: number; treble: number };
}

function createAudioEngine(): AudioEngine {
  const Ctor: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  const context = new Ctor();
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  const gain = context.createGain();
  gain.gain.value = 0.0001;

  analyser.connect(gain);
  gain.connect(context.destination);

  const freqData = new Uint8Array(analyser.frequencyBinCount);

  const makeOsc = (type: OscillatorType, freq: number, detune: number) => {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(analyser);
    return osc;
  };

  const drone = makeOsc("sine", 55, 0);
  const padA = makeOsc("triangle", 110, -4);
  const padB = makeOsc("triangle", 110, 6);

  return {
    context,
    analyser,
    gain,
    freqData,
    start() {
      void context.resume();
      drone.start();
      padA.start();
      padB.start();
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setTargetAtTime(0.18, context.currentTime, 0.6);
    },
    stop() {
      try {
        gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.2);
        drone.stop(context.currentTime + 0.4);
        padA.stop(context.currentTime + 0.4);
        padB.stop(context.currentTime + 0.4);
      } catch {
        /* ya detenido */
      }
    },
    getBands() {
      analyser.getByteFrequencyData(freqData);
      let bass = 0;
      let mid = 0;
      let treble = 0;
      for (let i = 0; i < 4; i += 1) bass += freqData[i];
      for (let i = 4; i < 32; i += 1) mid += freqData[i];
      for (let i = 32; i < 96; i += 1) treble += freqData[i];
      return {
        bass: bass / (4 * 255),
        mid: mid / (28 * 255),
        treble: treble / (64 * 255),
      };
    },
  };
}

/* =============================================================================
 * RENDER DEL CANVAS (estrellas + órbitas + luz radial)
 * ============================================================================= */

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
}

interface Planet {
  name: string;
  radius: number;
  angle: number;
  speed: number;
  inclination: number;
  color: string;
  size: number;
}

const PLANET_DEFS: ReadonlyArray<Omit<Planet, "angle">> = [
  { name: "Alpha Core", radius: 0.18, speed: 0.18, inclination: 0.62, color: "#8b5cf6", size: 14 },
  { name: "Node-Z", radius: 0.3, speed: 0.12, inclination: 0.5, color: "#06b6d4", size: 10 },
  { name: "Terran Shield", radius: 0.44, speed: 0.09, inclination: 0.7, color: "#10b981", size: 12 },
  { name: "Memory Field", radius: 0.58, speed: 0.07, inclination: 0.55, color: "#ec4899", size: 9 },
  { name: "Crown Relay", radius: 0.72, speed: 0.05, inclination: 0.66, color: "#f59e0b", size: 8 },
];

interface DrawState {
  dpr: number;
  width: number;
  height: number;
  stars: Star[];
  planets: Planet[];
}

function buildDrawState(width: number, height: number, dpr: number): DrawState {
  const starCount = Math.min(220, Math.floor((width * height) / 9000));
  const stars: Star[] = [];
  for (let i = 0; i < starCount; i += 1) {
    stars.push({
      x: Math.random(),
      y: Math.random(),
      z: 0.2 + Math.random() * 0.8,
      size: 0.4 + Math.random() * 1.4,
    });
  }
  const planets: Planet[] = PLANET_DEFS.map((def, idx) => ({
    ...def,
    angle: (idx / PLANET_DEFS.length) * Math.PI * 2,
  }));
  return { dpr, width, height, stars, planets };
}

function drawFrame(
  canvas: HTMLCanvasElement,
  state: DrawState,
  elapsedMs: number,
  cue: SceneCue,
  bands: { bass: number; mid: number; treble: number },
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = state;
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);

  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createRadialGradient(cx, cy, minDim * 0.05, cx, cy, minDim * 0.75);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(1, "#05070c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const starSpeed = cue.visual.starSpeed;
  ctx.save();
  for (const s of state.stars) {
    const px = s.x * width;
    const py = s.y * height;
    const tw = 0.6 + 0.4 * Math.sin(elapsedMs / 600 + s.x * 12);
    ctx.globalAlpha = (0.25 + 0.55 * s.z) * tw * cue.visual.hudOpacity;
    ctx.fillStyle = "#cdd6f4";
    ctx.beginPath();
    ctx.arc(px, py, s.size * s.z, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  void starSpeed;

  const radial = cue.visual.radialLight * (0.55 + bands.bass * 0.6);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.42);
  glow.addColorStop(0, `rgba(139,92,246,${0.22 * radial})`);
  glow.addColorStop(0.5, `rgba(6,182,212,${0.1 * radial})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(cx, cy);
  const zoom = cue.camera.zoom;
  ctx.scale(zoom, zoom);
  ctx.globalAlpha = cue.visual.orbitalOpacity;

  ctx.strokeStyle = "rgba(148,163,184,0.18)";
  ctx.lineWidth = 1;
  for (const p of state.planets) {
    ctx.beginPath();
    ctx.ellipse(0, 0, p.radius * minDim, p.radius * minDim * p.inclination, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const t = elapsedMs / 1000;
  for (const p of state.planets) {
    const a = p.angle + t * p.speed;
    const x = Math.cos(a) * p.radius * minDim;
    const y = Math.sin(a) * p.radius * minDim * p.inclination;
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12 + bands.mid * 18;
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = Math.min(1, cue.visual.orbitalOpacity + 0.1);
  ctx.strokeStyle = "rgba(236,72,153,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, minDim * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* =============================================================================
 * COMPONENTE
 * ============================================================================= */

export interface IsabellaCinematicTrailerProps {
  onComplete: () => void;
  enterLabel?: string;
}

function getPreferredReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function IsabellaCinematicTrailer({
  onComplete,
  enterLabel = "Entrar al sistema",
}: IsabellaCinematicTrailerProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef(0);
  const completedRef = useRef(false);
  const drawStateRef = useRef<DrawState | null>(null);

  const [sceneId, setSceneId] = useState<SceneId>("signal");
  const [paused, setPaused] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [reducedMotion] = useState<boolean>(getPreferredReducedMotion);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  const enableAudio = useCallback(async () => {
    if (!audioRef.current) {
      try {
        audioRef.current = createAudioEngine();
        audioRef.current.start();
        setAudioEnabled(true);
      } catch {
        setAudioEnabled(false);
      }
      return;
    }
    try {
      audioRef.current.start();
      setAudioEnabled(true);
    } catch {
      /* audio no disponible */
    }
  }, []);

  const disableAudio = useCallback(() => {
    audioRef.current?.stop();
    setAudioEnabled(false);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      pausedRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let resizeFrame = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (w === lastWidth && h === lastHeight) return;
      lastWidth = w;
      lastHeight = h;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      drawStateRef.current = buildDrawState(w, h, dpr);
    };
    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };
    resize();
    window.addEventListener("resize", scheduleResize, { passive: true });

    if (reducedMotion) {
      elapsedRef.current = DURATION_MS;
      setSceneId("arrival");
      if (drawStateRef.current) {
        drawFrame(canvas, drawStateRef.current, DURATION_MS, cueFor(DURATION_MS), { bass: 0, mid: 0, treble: 0 });
      }
      return () => {
        cancelAnimationFrame(resizeFrame);
        window.removeEventListener("resize", scheduleResize);
      };
    }

    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        elapsedRef.current = Math.min(DURATION_MS, elapsedRef.current + dt);
      }
      const activeCue = cueFor(elapsedRef.current);
      const bands = audioRef.current ? audioRef.current.getBands() : { bass: 0, mid: 0, treble: 0 };
      if (drawStateRef.current) {
        drawFrame(canvas, drawStateRef.current, elapsedRef.current, activeCue, bands);
      }
      if (elapsedRef.current >= DURATION_MS) {
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", scheduleResize);
    };
  }, [reducedMotion, finish]);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      setSceneId(resolveScene(elapsedRef.current));
    }, 120);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  useEffect(() => {
    return () => {
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, []);

  const cue = useMemo(() => cueFor(elapsedRef.current), [sceneId]);
  const telemetryMode = "simulated" as const;

  return (
    <main
      id="main-content"
      className="isabella-trailer"
      role="region"
      aria-label="Introducción cinematográfica de Isabella Villaseñor AI"
    >
      <canvas ref={canvasRef} className="isabella-trailer__canvas" aria-hidden="true" />

      <div
        className="isabella-trailer__hud"
        style={{ opacity: reducedMotion ? 1 : cue.visual.hudOpacity }}
        aria-hidden="true"
      >
        <div className="isabella-trailer__reticle" />
        <div className="isabella-trailer__readout">
          <span>HDG 027</span>
          <span>LAT 20.118N</span>
          <span>LON 98.672W</span>
          <span>ALT 2940m</span>
          <span>LINK LOCAL</span>
          <span>SIGNAL 98%</span>
          <span>SYSTEM NODO CERO</span>
          <span>SHIELD ARGUS</span>
        </div>
        <span className="isabella-trailer__sim-badge">
          {telemetryMode === "simulated" ? "SIMULATION MODE" : "LIVE TELEMETRY"}
        </span>
      </div>

      <div className="isabella-trailer__hero">
        <p className="isabella-trailer__eyebrow">ISABELLA VILLASEÑOR</p>
        <h1 className="isabella-trailer__title">Inteligencia soberana, con propósito humano.</h1>
        <p className="isabella-trailer__subtitle" aria-live="polite">
          {reducedMotion ? "El núcleo está listo para recibirte." : cue.subtitle}
        </p>
        <div className="isabella-trailer__tags" aria-hidden="true">
          <span>MEMORY</span>
          <span>TERRITORY</span>
          <span>VERIFICATION</span>
        </div>
        <button type="button" className="isabella-trailer__cta" onClick={finish}>
          {enterLabel}
        </button>
      </div>

      <div className="isabella-trailer__controls">
        <button type="button" className="isabella-trailer__btn" onClick={finish}>
          Omitir intro
        </button>
        {!reducedMotion && (
          <button type="button" className="isabella-trailer__btn" onClick={togglePause}>
            {paused ? "Reanudar" : "Pausar"}
          </button>
        )}
        <button
          type="button"
          className="isabella-trailer__btn"
          aria-pressed={audioEnabled}
          onClick={() => (audioEnabled ? disableAudio() : void enableAudio())}
        >
          {audioEnabled ? "Silenciar audio" : "Activar audio"}
        </button>
      </div>
    </main>
  );
}

export default IsabellaCinematicTrailer;
