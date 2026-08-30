import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Volume2, VolumeX, Sparkles } from "lucide-react";
import { useCrown } from "../../context/CrownContext";
import { soundManager } from "../../utils/soundEffects";
import { getAudioContextConstructor } from "../../utils/audioContext";
import { ISABELLA_MEDALLION_IMAGE } from "../../data/isabellaAvatar";
import { ISABELLA_VERSION } from "../../lib/isabella-crown";

interface IsabellaCinematicTrailerProps {
  isOpen: boolean;
  onClose: () => void;
}

/*
 * ISABELLA — GÉNESIS SOBERANA & MOTOR CELESTIAL 2D/3D
 * Intro cinematográfica con starfield 3D hiperdimensional, constelaciones 2D,
 * astrolabio sagrado de Nodo Cero, audio generativo y letterbox de cine.
 */

const DURATION_MS = 30_000;

const SCENES = [
  { id: "signal", at: 0, label: "Señal" },
  { id: "awakening", at: 4_200, label: "Despertar" },
  { id: "identity", at: 10_400, label: "Identidad" },
  { id: "manifesto", at: 17_200, label: "Manifiesto" },
  { id: "arrival", at: 24_200, label: "Llegada" },
] as const;

type SceneId = (typeof SCENES)[number]["id"];

const VOICE_AT_MS = 10_800;

const MANIFESTO_LINES = [
  "La voz permanece en el borde.",
  "La memoria pertenece al territorio.",
  "La verificación es matemática.",
] as const;

// 3D Star in camera space (x, y, z)
interface Star3D {
  x: number;
  y: number;
  z: number;
  pz: number;
  size: number;
  color: string;
  twinkleSpeed: number;
  twinklePhase: number;
}

// 2D Background star (fixed celestial dome)
interface Star2D {
  x: number;
  y: number;
  baseRadius: number;
  color: string;
  twinkleSpeed: number;
  phase: number;
}

// Meteor / Shooting star
interface ShootingStar {
  x: number;
  y: number;
  dx: number;
  dy: number;
  length: number;
  speed: number;
  opacity: number;
  active: boolean;
  color: string;
}

const STAR_COLORS = [
  "rgba(255, 255, 255, 1)", // Diamond White
  "rgba(251, 191, 36, 1)",  // Golden Amber
  "rgba(96, 165, 250, 1)",  // Sapphire Blue
  "rgba(56, 189, 248, 1)",  // Electric Cyan
  "rgba(244, 244, 245, 1)", // Platinum Pearl
];

const create3DStars = (count = 320): Star3D[] =>
  Array.from({ length: count }, () => {
    const z = Math.random() * 1000 + 50;
    return {
      x: (Math.random() - 0.5) * 2000,
      y: (Math.random() - 0.5) * 2000,
      z,
      pz: z,
      size: Math.random() * 1.5 + 0.6,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      twinkleSpeed: Math.random() * 0.003 + 0.001,
      twinklePhase: Math.random() * Math.PI * 2,
    };
  });

const create2DStars = (count = 140): Star2D[] =>
  Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    baseRadius: Math.random() * 1.2 + 0.4,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    twinkleSpeed: Math.random() * 0.002 + 0.001,
    phase: Math.random() * Math.PI * 2,
  }));

const drawCelestialEngine = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  stars3D: Star3D[],
  stars2D: Star2D[],
  shootingStars: ShootingStar[],
  scene: SceneId,
) => {
  const centerX = width / 2;
  const centerY = height * 0.46;
  const fov = Math.min(width, height) * 0.85;

  ctx.clearRect(0, 0, width, height);

  // 1. Deep Space Cosmic Background
  const skyGradient = ctx.createRadialGradient(
    centerX,
    centerY,
    50,
    centerX,
    centerY,
    Math.max(width, height),
  );
  skyGradient.addColorStop(0, "#080d1a");
  skyGradient.addColorStop(0.35, "#04060c");
  skyGradient.addColorStop(0.75, "#020306");
  skyGradient.addColorStop(1, "#010102");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Cosmic Nebula Cloud Aurora
  const sceneBoost =
    scene === "awakening" ? 1.6 : scene === "identity" ? 2.0 : scene === "arrival" ? 1.8 : 1.0;

  const nebulaAura = ctx.createRadialGradient(
    centerX + Math.sin(time * 0.0003) * 60,
    centerY + Math.cos(time * 0.0004) * 40,
    10,
    centerX,
    centerY,
    Math.min(width, height) * 0.58,
  );
  nebulaAura.addColorStop(0, `rgba(224, 187, 93, ${0.08 * sceneBoost})`);
  nebulaAura.addColorStop(0.45, `rgba(56, 189, 248, ${0.05 * sceneBoost})`);
  nebulaAura.addColorStop(0.75, `rgba(99, 102, 241, ${0.03 * sceneBoost})`);
  nebulaAura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = nebulaAura;
  ctx.fillRect(0, 0, width, height);

  // 3. 2D Background Static Starfield
  for (let i = 0; i < stars2D.length; i++) {
    const s2 = stars2D[i];
    const sx = s2.x * width;
    const sy = s2.y * height;
    const twinkle = Math.sin(time * s2.twinkleSpeed + s2.phase);
    const alpha = Math.max(0.15, Math.min(0.85, 0.5 + twinkle * 0.35));
    const r = Math.max(0.3, s2.baseRadius * (0.8 + twinkle * 0.25));

    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = s2.color.replace(", 1)", `, ${alpha})`);
    ctx.fill();

    // Occasional subtle star bloom
    if (twinkle > 0.75) {
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = s2.color.replace(", 1)", `, ${alpha * 0.25})`);
      ctx.fill();
    }
  }

  // 4. 3D Warp & Deep-Space Starfield Engine
  const baseSpeed =
    scene === "signal"
      ? 1.2
      : scene === "awakening"
        ? 3.8
        : scene === "identity"
          ? 2.2
          : scene === "manifesto"
            ? 1.8
            : 4.5;

  const visiblePoints: { px: number; py: number; size: number; alpha: number }[] = [];

  for (let i = 0; i < stars3D.length; i++) {
    const star = stars3D[i];
    star.pz = star.z;
    star.z -= baseSpeed;

    if (star.z <= 10) {
      star.z = 1000;
      star.pz = 1000;
      star.x = (Math.random() - 0.5) * 2000;
      star.y = (Math.random() - 0.5) * 2000;
    }

    // 3D perspective projection
    const px = (star.x / star.z) * fov + centerX;
    const py = (star.y / star.z) * fov + centerY;
    const ppx = (star.x / star.pz) * fov + centerX;
    const ppy = (star.y / star.pz) * fov + centerY;

    if (px < -50 || px > width + 50 || py < -50 || py > height + 50) {
      continue;
    }

    // Depth opacity (fade in distance, brightest near camera)
    const depthFactor = 1 - star.z / 1000;
    const twinkle = 0.8 + 0.2 * Math.sin(time * star.twinkleSpeed + star.twinklePhase);
    const alpha = Math.max(0.1, Math.min(1.0, depthFactor * twinkle));
    const renderSize = Math.max(0.5, (star.size * (1 - star.z / 1100) * 2.2));

    // Warp streaks when speed is high
    if (baseSpeed > 2.5) {
      ctx.beginPath();
      ctx.moveTo(ppx, ppy);
      ctx.lineTo(px, py);
      ctx.strokeStyle = star.color.replace(", 1)", `, ${alpha * 0.75})`);
      ctx.lineWidth = renderSize * 0.8;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(px, py, renderSize, 0, Math.PI * 2);
    ctx.fillStyle = star.color.replace(", 1)", `, ${alpha})`);
    ctx.fill();

    // Glow aura for foreground 3D stars
    if (depthFactor > 0.6) {
      ctx.beginPath();
      ctx.arc(px, py, renderSize * 3, 0, Math.PI * 2);
      ctx.fillStyle = star.color.replace(", 1)", `, ${alpha * 0.2})`);
      ctx.fill();
    }

    if (depthFactor > 0.4 && visiblePoints.length < 50) {
      visiblePoints.push({ px, py, size: renderSize, alpha });
    }
  }

  // 5. Luminescent Constellation Lines
  ctx.lineWidth = 0.5;
  for (let i = 0; i < visiblePoints.length; i++) {
    for (let j = i + 1; j < visiblePoints.length; j++) {
      const p1 = visiblePoints[i];
      const p2 = visiblePoints[j];
      const dist = Math.hypot(p1.px - p2.px, p1.py - p2.py);
      if (dist < 110) {
        const lineAlpha = (1 - dist / 110) * 0.12 * Math.min(p1.alpha, p2.alpha);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.strokeStyle = `rgba(224, 187, 93, ${lineAlpha})`;
        ctx.stroke();
      }
    }
  }

  // 6. Shooting Stars / Comets
  shootingStars.forEach((star) => {
    if (!star.active) {
      if (Math.random() < 0.008) {
        star.active = true;
        star.x = Math.random() * width * 0.8;
        star.y = Math.random() * height * 0.4;
        star.dx = Math.random() * 4 + 6;
        star.dy = Math.random() * 2 + 3;
        star.length = Math.random() * 80 + 60;
        star.opacity = 0.8;
      }
      return;
    }

    star.x += star.dx;
    star.y += star.dy;
    star.opacity -= 0.015;

    if (star.opacity <= 0 || star.x > width || star.y > height) {
      star.active = false;
      return;
    }

    const tailX = star.x - (star.dx / 6) * star.length;
    const tailY = star.y - (star.dy / 6) * star.length;

    const grad = ctx.createLinearGradient(tailX, tailY, star.x, star.y);
    grad.addColorStop(0, "rgba(251, 191, 36, 0)");
    grad.addColorStop(0.7, `rgba(56, 189, 248, ${star.opacity * 0.6})`);
    grad.addColorStop(1, `rgba(255, 255, 255, ${star.opacity})`);

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(star.x, star.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.stroke();
  });

  // 7. Nodo Cero Sacred Astrolabe Orbit Rings
  ctx.save();
  ctx.translate(centerX, centerY);

  // Outer orbital ring with dashed degree ticks
  ctx.save();
  ctx.rotate(time * 0.00003 * sceneBoost);
  ctx.strokeStyle = "rgba(224, 187, 93, 0.22)";
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 12]);
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(width, height) * 0.26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Middle counter-rotating orbital ring
  ctx.save();
  ctx.rotate(-time * 0.00002 * sceneBoost);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.16)";
  ctx.lineWidth = 0.7;
  ctx.setLineDash([1, 18]);
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(width, height) * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Cardinal alignment indicators
  ctx.strokeStyle = "rgba(224, 187, 93, 0.18)";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(0, -Math.min(width, height) * 0.38);
  ctx.lineTo(0, Math.min(width, height) * 0.38);
  ctx.moveTo(-Math.min(width, height) * 0.38, 0);
  ctx.lineTo(Math.min(width, height) * 0.38, 0);
  ctx.stroke();

  ctx.restore();

  // 8. Territorial Mountain Horizon Waves (Real del Monte 2,700 msnm)
  ctx.save();
  ctx.lineWidth = 0.7;
  for (let index = 0; index < 3; index += 1) {
    const y = height * 0.73 + index * 30;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 22) {
      const wave =
        Math.sin(x * 0.0032 + time * 0.00014 + index * 1.6) * 10 +
        Math.cos(x * 0.006 + time * 0.00008) * 4;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.strokeStyle = `rgba(224, 187, 93, ${0.065 - index * 0.015})`;
    ctx.stroke();
  }
  ctx.restore();
};

interface PadNodes {
  context: AudioContext;
  oscillators: OscillatorNode[];
  gain: GainNode;
}

const startPad = (): PadNodes | null => {
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) return null;
  try {
    const context = new AudioContextCtor();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, context.currentTime);

    const voices: Array<{ freq: number; level: number }> = [
      { freq: 48, level: 0.5 },
      { freq: 72.17, level: 0.28 },
      { freq: 144.5, level: 0.12 },
    ];
    const oscillators = voices.map(({ freq, level }) => {
      const osc = context.createOscillator();
      const voiceGain = context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, context.currentTime);
      voiceGain.gain.setValueAtTime(level, context.currentTime);
      osc.connect(voiceGain).connect(filter);
      osc.start();
      return osc;
    });

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 2.4);
    filter.connect(gain).connect(context.destination);
    void context.resume().catch(() => undefined);
    return { context, oscillators, gain };
  } catch {
    return null;
  }
};

const playChime = (pad: PadNodes | null) => {
  if (!pad) return;
  try {
    const { context } = pad;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(587.33, context.currentTime); // D5
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 2.2);
    osc.connect(gain).connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 2.4);
  } catch {}
};

const stopPad = (pad: PadNodes | null) => {
  if (!pad) return;
  try {
    const now = pad.context.currentTime;
    pad.gain.gain.cancelScheduledValues(now);
    pad.gain.gain.setTargetAtTime(0.0001, now, 0.2);
    pad.oscillators.forEach((osc) => {
      try {
        osc.stop(now + 0.5);
        osc.disconnect();
      } catch {}
    });
    pad.gain.disconnect();
  } catch {
  } finally {
    void pad.context.close().catch(() => undefined);
  }
};

const GRAIN_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export const IsabellaCinematicTrailer: React.FC<IsabellaCinematicTrailerProps> = ({
  isOpen,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<PadNodes | null>(null);
  const spokenRef = useRef(false);
  const chimedRef = useRef(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioMuted, setAudioMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const { speakText } = useCrown();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const stopSound = useCallback(() => {
    stopPad(padRef.current);
    padRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    soundManager.playBeep(760, 0.04);
    stopSound();
    onClose();
  }, [onClose, stopSound]);

  const toggleAudio = useCallback(() => {
    setAudioMuted((muted) => {
      const next = !muted;
      if (next) {
        if (!padRef.current) padRef.current = startPad();
      } else {
        stopSound();
      }
      return next;
    });
  }, [stopSound]);

  // Animation & Timeline Motor
  useEffect(() => {
    if (!isOpen) {
      setElapsedMs(0);
      spokenRef.current = false;
      chimedRef.current = false;
      stopSound();
      setAudioMuted(true);
      return;
    }

    const startedAt = performance.now();
    let frameId = 0;
    let active = true;

    const tick = (now: number) => {
      if (!active) return;
      const elapsed = Math.min(now - startedAt, DURATION_MS);
      setElapsedMs(elapsed);

      if (elapsed >= VOICE_AT_MS && !spokenRef.current) {
        spokenRef.current = true;
        try {
          speakText(
            "Soy Isabella Villaseñor. Inteligencia soberana, con propósito humano.",
            { rate: 0.9 },
          );
        } catch {}
      }

      if (elapsed >= VOICE_AT_MS - 500 && !chimedRef.current) {
        chimedRef.current = true;
        if (!audioMuted) playChime(padRef.current);
      }

      if (elapsed >= DURATION_MS) {
        stopSound();
        onClose();
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [isOpen, onClose, speakText, stopSound, audioMuted]);

  // Current Scene
  const scene: SceneId = [...SCENES].reverse().find((s) => elapsedMs >= s.at)?.id ?? "signal";

  // Canvas Starfield Engine Loop
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let width = 0;
    let height = 0;

    const stars3D = create3DStars(320);
    const stars2D = create2DStars(140);
    const shootingStars: ShootingStar[] = Array.from({ length: 3 }, () => ({
      x: 0,
      y: 0,
      dx: 0,
      dy: 0,
      length: 0,
      speed: 0,
      opacity: 0,
      active: false,
      color: "#fbbf24",
    }));

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const render = (time: number) => {
      drawCelestialEngine(
        context,
        width,
        height,
        reducedMotion ? 0 : time,
        stars3D,
        stars2D,
        shootingStars,
        scene,
      );
      animationFrame = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [isOpen, reducedMotion, scene]);

  // Keybindings (Escape / Enter / Space to exit)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const progress = Math.min(100, (elapsedMs / DURATION_MS) * 100);
  const sceneIndex = SCENES.findIndex((s) => s.id === scene);
  const signalLineVisible = elapsedMs >= 700;
  const medallionVisible = elapsedMs >= SCENES[1].at + 500;
  const identityVisible = elapsedMs >= SCENES[2].at + 400;
  const manifestoVisible = elapsedMs >= SCENES[3].at;
  const arrivalVisible = elapsedMs >= SCENES[4].at;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-[#040507] font-sans text-[#fffefa]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="isabella-trailer-title"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

      {/* Grano de película */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: GRAIN_TEXTURE, backgroundSize: "220px 220px" }}
      />

      {/* Viñeta */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_52%,rgba(2,3,4,0.72)_100%)]"
      />

      {/* Letterbox cinematográfico */}
      <div
        aria-hidden="true"
        className={`absolute left-0 right-0 top-0 z-30 bg-black transition-all duration-[1600ms] ease-out ${
          elapsedMs >= 200 ? "h-[7vh]" : "h-0"
        }`}
      />
      <div
        aria-hidden="true"
        className={`absolute bottom-0 left-0 right-0 z-30 bg-black transition-all duration-[1600ms] ease-out ${
          elapsedMs >= 200 ? "h-[7vh]" : "h-0"
        }`}
      />

      {/* Controles */}
      <header className="absolute left-0 right-0 top-[7vh] z-40 flex items-center justify-between px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e0bb5d] shadow-[0_0_8px_rgba(224,187,93,0.8)]" aria-hidden="true" />
          <span className="text-[10px] font-medium uppercase tracking-[0.34em] text-[#bfb8ac] flex items-center gap-1.5">
            Génesis Soberana <Sparkles className="w-3 h-3 text-[#e0bb5d]" />
          </span>
        </div>
        <button
          type="button"
          onClick={toggleAudio}
          className="rounded-lg p-2 text-[#929da8] transition hover:bg-white/[0.05] hover:text-[#fffefa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e0bb5d] cursor-pointer"
          aria-label={audioMuted ? "Activar ambiente sonoro" : "Silenciar ambiente sonoro"}
          aria-pressed={!audioMuted}
        >
          {audioMuted ? (
            <VolumeX className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </header>

      {/* Escena 1 — Señal */}
      <div
        aria-hidden={scene !== "signal"}
        className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-[1200ms] ${
          scene === "signal" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="text-center">
          <div
            className={`mx-auto h-px bg-gradient-to-r from-transparent via-[#e0bb5d]/80 to-transparent transition-all duration-[2000ms] ease-out ${
              signalLineVisible ? "w-64 opacity-100 sm:w-96" : "w-0 opacity-0"
            }`}
          />
          <p
            className={`mt-6 text-[10px] font-medium uppercase tracking-[0.5em] text-[#929da8] transition-all delay-500 duration-[1400ms] ${
              signalLineVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            Real del Monte · Nodo Cero
          </p>
          <p
            className={`mt-3 font-mono text-[10px] tracking-[0.2em] text-[#e0bb5d]/80 transition-all delay-1000 duration-[1400ms] ${
              signalLineVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            20.1406° N · 98.6719° W · 2 700 msnm
          </p>
        </div>
      </div>

      {/* Escena 2 — Despertar */}
      <div
        aria-hidden={scene !== "awakening"}
        className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-[1400ms] ${
          scene === "awakening" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className={`transition-all duration-[1800ms] ease-out ${
            medallionVisible ? "scale-100 opacity-100" : "scale-90 opacity-0"
          }`}
        >
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(224,187,93,0.18),transparent_65%)] animate-pulse"
            />
            <div className="relative h-44 w-44 overflow-hidden rounded-full border-2 border-[#e0bb5d]/60 bg-[#0a0d13] p-1 shadow-[0_0_0_12px_rgba(224,187,93,0.06),0_28px_110px_rgba(0,0,0,0.8)] sm:h-56 sm:w-56">
              <img
                src={ISABELLA_MEDALLION_IMAGE}
                alt="Isabella Villaseñor Medallion"
                className="h-full w-full rounded-full object-cover object-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Escena 3 — Identidad */}
      <div
        aria-hidden={scene !== "identity"}
        className={`absolute inset-0 z-10 flex items-center justify-center px-6 text-center transition-opacity duration-[1400ms] ${
          scene === "identity" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className={`transition-all duration-[1600ms] ease-out ${
            identityVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.46em] text-[#e0bb5d]">
            Infraestructura cognitiva territorial
          </p>
          <h1
            id="isabella-trailer-title"
            className="mt-5 text-5xl font-semibold tracking-[-0.035em] text-[#fffefa] sm:text-7xl"
          >
            Isabella{" "}
            <span className="font-serif font-normal italic text-[#e0bb5d]">Villaseñor</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-[#d9d3c8] sm:text-base">
            Inteligencia soberana, con propósito humano.
          </p>
        </div>
      </div>

      {/* Escena 4 — Manifiesto */}
      <div
        aria-hidden={scene !== "manifesto"}
        className={`absolute inset-0 z-10 flex items-center justify-center px-6 transition-opacity duration-[1400ms] ${
          scene === "manifesto" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="space-y-6 text-center">
          {MANIFESTO_LINES.map((line, index) => {
            const lineVisible = elapsedMs >= SCENES[3].at + 500 + index * 1_600;
            return (
              <p
                key={line}
                className={`font-serif text-xl italic tracking-[-0.01em] text-[#e9e4da] transition-all duration-[1300ms] ease-out sm:text-2xl ${
                  manifestoVisible && lineVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-4 opacity-0"
                }`}
              >
                {line}
              </p>
            );
          })}
        </div>
      </div>

      {/* Escena 5 — Llegada */}
      <div
        aria-hidden={scene !== "arrival"}
        className={`absolute inset-0 z-10 flex items-center justify-center px-6 text-center transition-opacity duration-[1400ms] ${
          scene === "arrival" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className={`transition-all duration-[1600ms] ease-out ${
            arrivalVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#e0bb5d]">
            Sistema operativo · v{ISABELLA_VERSION}
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="group mt-8 inline-flex items-center gap-3 rounded-full border border-[#e0bb5d]/50 bg-[#e0bb5d]/[0.08] px-8 py-3.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#efd58a] transition-all duration-500 hover:border-[#e0bb5d] hover:bg-[#e0bb5d]/[0.16] hover:shadow-[0_0_44px_rgba(224,187,93,0.28)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e0bb5d] cursor-pointer"
          >
            Entrar al sistema
            <ChevronRight
              className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Progreso por escenas */}
      <footer className="absolute bottom-[7vh] left-0 right-0 z-40 px-6 pb-5 sm:px-10">
        <div className="mx-auto flex max-w-4xl items-center gap-6">
          <div className="flex items-center gap-2" aria-label={`Escena ${sceneIndex + 1} de ${SCENES.length}`}>
            {SCENES.map((s, index) => (
              <span
                key={s.id}
                title={s.label}
                className={`h-1 rounded-full transition-all duration-700 ${
                  index < sceneIndex
                    ? "w-6 bg-[#e0bb5d]/80"
                    : index === sceneIndex
                      ? "w-10 bg-[#e0bb5d] shadow-[0_0_8px_rgba(224,187,93,0.8)]"
                      : "w-6 bg-white/[0.14]"
                }`}
              />
            ))}
          </div>
          <div className="h-px flex-1 overflow-hidden bg-white/[0.08]">
            <div
              className="h-full bg-[#e0bb5d]/70 transition-[width] duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-[#929da8] transition hover:text-[#fffefa] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e0bb5d] cursor-pointer"
          >
            Omitir <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  );
};
