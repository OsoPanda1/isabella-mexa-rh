import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Volume2, VolumeX, Sparkles, Compass, ShieldCheck } from "lucide-react";
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
 * ISABELLA — GÉNESIS SOBERANA & MOTOR CELESTIAL 2D/3D (EDICIÓN MAESTRA VISUAL)
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
  skyGradient.addColorStop(0, "#0a0f1d");
  skyGradient.addColorStop(0.35, "#04060c");
  skyGradient.addColorStop(0.75, "#020306");
  skyGradient.addColorStop(1, "#010102");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Cosmic Nebula Cloud Aurora con resplandor dorado multicapa
  const sceneBoost =
    scene === "awakening" ? 1.6 : scene === "identity" ? 2.0 : scene === "arrival" ? 1.8 : 1.0;

  const nebulaAura = ctx.createRadialGradient(
    centerX + Math.sin(time * 0.0003) * 60,
    centerY + Math.cos(time * 0.0004) * 40,
    10,
    centerX,
    centerY,
    Math.min(width, height) * 0.62,
  );
  nebulaAura.addColorStop(0, `rgba(224, 187, 93, ${0.12 * sceneBoost})`);
  nebulaAura.addColorStop(0.3, `rgba(217, 119, 6, ${0.05 * sceneBoost})`);
  nebulaAura.addColorStop(0.6, `rgba(56, 189, 248, ${0.05 * sceneBoost})`);
  nebulaAura.addColorStop(0.85, `rgba(99, 102, 241, ${0.03 * sceneBoost})`);
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

    // Subtle star bloom
    if (twinkle > 0.75) {
      ctx.beginPath();
      ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2);
      ctx.fillStyle = s2.color.replace(", 1)", `, ${alpha * 0.3})`);
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

    const px = (star.x / star.z) * fov + centerX;
    const py = (star.y / star.z) * fov + centerY;
    const ppx = (star.x / star.pz) * fov + centerX;
    const ppy = (star.y / star.pz) * fov + centerY;

    if (px < -50 || px > width + 50 || py < -50 || py > height + 50) {
      continue;
    }

    const depthFactor = 1 - star.z / 1000;
    const twinkle = 0.8 + 0.2 * Math.sin(time * star.twinkleSpeed + star.twinklePhase);
    const alpha = Math.max(0.1, Math.min(1.0, depthFactor * twinkle));
    const renderSize = Math.max(0.5, star.size * (1 - star.z / 1100) * 2.2);

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

    if (depthFactor > 0.6) {
      ctx.beginPath();
      ctx.arc(px, py, renderSize * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = star.color.replace(", 1)", `, ${alpha * 0.22})`);
      ctx.fill();
    }

    if (depthFactor > 0.4 && visiblePoints.length < 50) {
      visiblePoints.push({ px, py, size: renderSize, alpha });
    }
  }

  // 5. Luminescent Constellation Lines
  ctx.lineWidth = 0.6;
  for (let i = 0; i < visiblePoints.length; i++) {
    for (let j = i + 1; j < visiblePoints.length; j++) {
      const p1 = visiblePoints[i];
      const p2 = visiblePoints[j];
      const dist = Math.hypot(p1.px - p2.px, p1.py - p2.py);
      if (dist < 110) {
        const lineAlpha = (1 - dist / 110) * 0.16 * Math.min(p1.alpha, p2.alpha);
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
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.stroke();
  });

  // 7. Nodo Cero Sacred Astrolabe Orbit Rings (Glow Mejorado)
  ctx.save();
  ctx.translate(centerX, centerY);

  // Anillo orbital exterior brillante
  ctx.save();
  ctx.rotate(time * 0.00003 * sceneBoost);
  ctx.strokeStyle = "rgba(224, 187, 93, 0.28)";
  ctx.lineWidth = 0.9;
  ctx.setLineDash([3, 12]);
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(width, height) * 0.26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Anillo intermedio azul cian en contra-rotación
  ctx.save();
  ctx.rotate(-time * 0.00002 * sceneBoost);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.22)";
  ctx.lineWidth = 0.8;
  ctx.setLineDash([1, 18]);
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(width, height) * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Indicadores cardinales sagrados
  ctx.strokeStyle = "rgba(224, 187, 93, 0.24)";
  ctx.lineWidth = 0.6;
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
  ctx.lineWidth = 0.8;
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
    ctx.strokeStyle = `rgba(224, 187, 93, ${0.08 - index * 0.018})`;
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
      className="fixed inset-0 z-[100] overflow-hidden bg-[#040507] font-sans text-[#fffefa] select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="isabella-trailer-title"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

      {/* Grano de película hiperrealista */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: GRAIN_TEXTURE, backgroundSize: "220px 220px" }}
      />

      {/* Viñeta dramática de cine */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(2,3,5,0.85)_100%)]"
      />

      {/* Letterbox cinematográfico estilizado con destello áureo superior */}
      <div
        aria-hidden="true"
        className={`absolute left-0 right-0 top-0 z-30 bg-black border-b border-[#e0bb5d]/20 transition-all duration-[1600ms] ease-out ${
          elapsedMs >= 200 ? "h-[7vh]" : "h-0"
        }`}
      />
      <div
        aria-hidden="true"
        className={`absolute bottom-0 left-0 right-0 z-30 bg-black border-t border-[#e0bb5d]/20 transition-all duration-[1600ms] ease-out ${
          elapsedMs >= 200 ? "h-[7vh]" : "h-0"
        }`}
      />

      {/* Controles de cabecera en cristal ultra-pulido */}
      <header className="absolute left-0 right-0 top-[7vh] z-40 flex items-center justify-between px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3 backdrop-blur-md bg-black/40 px-4 py-1.5 rounded-full border border-white/10 shadow-[0_0_15px_rgba(224,187,93,0.15)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e0bb5d] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#e0bb5d]"></span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[#e0bb5d] flex items-center gap-2 drop-shadow-[0_0_8px_rgba(224,187,93,0.5)]">
            Génesis Soberana <Sparkles className="w-3 h-3 text-[#e0bb5d] animate-pulse" />
          </span>
        </div>
        
        <button
          type="button"
          onClick={toggleAudio}
          className="group rounded-full p-2.5 text-[#929da8] backdrop-blur-md bg-black/40 border border-white/10 shadow-lg transition-all duration-300 hover:bg-white/10 hover:text-[#fffefa] hover:border-[#e0bb5d]/50 hover:shadow-[0_0_20px_rgba(224,187,93,0.3)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e0bb5d] cursor-pointer"
          aria-label={audioMuted ? "Activar ambiente sonoro" : "Silenciar ambiente sonoro"}
          aria-pressed={!audioMuted}
        >
          {audioMuted ? (
            <VolumeX className="h-4 w-4 transition-transform group-hover:scale-110" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4 text-[#e0bb5d] transition-transform group-hover:scale-110" aria-hidden="true" />
          )}
        </button>
      </header>

      {/* Escena 1 — Señal (Geolocalización Sagrada) */}
      <div
        aria-hidden={scene !== "signal"}
        className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-[1200ms] ${
          scene === "signal" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="text-center px-4">
          <div
            className={`mx-auto h-[1px] bg-gradient-to-r from-transparent via-[#e0bb5d] to-transparent transition-all duration-[2000ms] ease-out shadow-[0_0_12px_rgba(224,187,93,0.8)] ${
              signalLineVisible ? "w-64 opacity-100 sm:w-96" : "w-0 opacity-0"
            }`}
          />
          <div className="flex items-center justify-center gap-2 mt-6">
            <Compass className="w-3.5 h-3.5 text-[#e0bb5d]/90 animate-spin-slow" />
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.55em] text-[#d9d3c8] transition-all delay-500 duration-[1400ms] drop-shadow-md ${
                signalLineVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              }`}
            >
              Real del Monte · Nodo Cero
            </p>
          </div>
          <p
            className={`mt-3 font-mono text-[11px] tracking-[0.25em] text-[#e0bb5d] transition-all delay-1000 duration-[1400ms] drop-shadow-[0_0_8px_rgba(224,187,93,0.4)] ${
              signalLineVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            20.1406° N · 98.6719° W · 2 700 msnm
          </p>
        </div>
      </div>

      {/* Escena 2 — Despertar (Medallón Holográfico Avanzado) */}
      <div
        aria-hidden={scene !== "awakening"}
        className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-[1400ms] ${
          scene === "awakening" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`transition-all duration-[1800ms] ease-out ${
            medallionVisible ? "scale-100 opacity-100" : "scale-90 opacity-0"
          }`}
        >
          <div className="relative group">
            {/* Halo de luz radial multicapa */}
            <div
              aria-hidden="true"
              className="absolute -inset-12 rounded-full bg-[radial-gradient(circle,rgba(224,187,93,0.28),transparent_70%)] animate-pulse blur-xl"
            />
            
            {/* Anillos concéntricos giratorios */}
            <div className="absolute -inset-4 rounded-full border border-[#e0bb5d]/40 animate-spin-slow border-dashed" />
            <div className="absolute -inset-8 rounded-full border border-cyan-400/20 animate-spin-reverse" />

            <div className="relative h-48 w-48 overflow-hidden rounded-full border-2 border-[#e0bb5d] bg-[#0a0d13] p-1.5 shadow-[0_0_50px_rgba(224,187,93,0.35),0_0_0_12px_rgba(224,187,93,0.08)] sm:h-64 sm:w-64">
              <img
                src={ISABELLA_MEDALLION_IMAGE}
                alt="Isabella Villaseñor Medallion"
                className="h-full w-full rounded-full object-cover object-center filter brightness-105 contrast-105"
              />
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#040507]/40 via-transparent to-[#e0bb5d]/20 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Escena 3 — Identidad (Tipografía Dorada Magnífica) */}
      <div
        aria-hidden={scene !== "identity"}
        className={`absolute inset-0 z-10 flex items-center justify-center px-6 text-center transition-opacity duration-[1400ms] ${
          scene === "identity" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`transition-all duration-[1600ms] ease-out ${
            identityVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-[#e0bb5d]/30 bg-[#e0bb5d]/10 backdrop-blur-sm mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-[#e0bb5d]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.48em] text-[#e0bb5d]">
              Infraestructura cognitiva territorial
            </p>
          </div>

          <h1
            id="isabella-trailer-title"
            className="mt-3 text-5xl font-extrabold tracking-[-0.04em] text-[#fffefa] sm:text-7xl lg:text-8xl drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
          >
            Isabella{" "}
            <span className="font-serif font-normal italic bg-gradient-to-r from-[#ffe59d] via-[#e0bb5d] to-[#b38a2e] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(224,187,93,0.4)]">
              Villaseñor
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-[#e4dec8] sm:text-lg font-light tracking-wide drop-shadow">
            Inteligencia soberana, con propósito humano.
          </p>
        </div>
      </div>

      {/* Escena 4 — Manifiesto (Prosa Sagrada Poética) */}
      <div
        aria-hidden={scene !== "manifesto"}
        className={`absolute inset-0 z-10 flex items-center justify-center px-6 transition-opacity duration-[1400ms] ${
          scene === "manifesto" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="space-y-8 text-center max-w-2xl">
          {MANIFESTO_LINES.map((line, index) => {
            const lineVisible = elapsedMs >= SCENES[3].at + 500 + index * 1_600;
            return (
              <p
                key={line}
                className={`font-serif text-2xl italic tracking-tight text-[#f4efe6] transition-all duration-[1300ms] ease-out sm:text-3xl lg:text-4xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] ${
                  manifestoVisible && lineVisible
                    ? "translate-y-0 opacity-100 scale-100"
                    : "translate-y-6 opacity-0 scale-95"
                }`}
              >
                "{line}"
              </p>
            );
          })}
        </div>
      </div>

      {/* Escena 5 — Llegada (Botonera CTA Interactiva de Lujo) */}
      <div
        aria-hidden={scene !== "arrival"}
        className={`absolute inset-0 z-10 flex items-center justify-center px-6 text-center transition-opacity duration-[1400ms] ${
          scene === "arrival" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`transition-all duration-[1600ms] ease-out ${
            arrivalVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <div className="inline-block rounded-full bg-[#e0bb5d]/10 px-4 py-1 border border-[#e0bb5d]/30 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-[#e0bb5d] font-semibold">
              Sistema operativo · v{ISABELLA_VERSION}
            </p>
          </div>
          
          <div className="mt-8">
            <button
              type="button"
              onClick={handleClose}
              className="group relative inline-flex items-center gap-4 overflow-hidden rounded-full border border-[#e0bb5d]/60 bg-gradient-to-r from-[#e0bb5d]/20 via-[#e0bb5d]/10 to-transparent px-10 py-4 text-[11px] font-bold uppercase tracking-[0.35em] text-[#fffefa] transition-all duration-500 hover:border-[#e0bb5d] hover:bg-[#e0bb5d] hover:text-[#040507] hover:shadow-[0_0_50px_rgba(224,187,93,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0bb5d] cursor-pointer"
            >
              <span className="relative z-10">Entrar al sistema</span>
              <ChevronRight
                className="relative z-10 h-4 w-4 transition-transform duration-500 group-hover:translate-x-1.5"
                aria-hidden="true"
              />
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </button>
          </div>
        </div>
      </div>

      {/* Progreso por escenas & Barra inferior de cine */}
      <footer className="absolute bottom-[7vh] left-0 right-0 z-40 px-6 pb-5 sm:px-10">
        <div className="mx-auto flex max-w-4xl items-center gap-6 backdrop-blur-md bg-black/30 p-3 rounded-2xl border border-white/5 shadow-2xl">
          <div className="flex items-center gap-2.5" aria-label={`Escena ${sceneIndex + 1} de ${SCENES.length}`}>
            {SCENES.map((s, index) => (
              <span
                key={s.id}
                title={s.label}
                className={`h-1.5 rounded-full transition-all duration-700 ${
                  index < sceneIndex
                    ? "w-6 bg-[#e0bb5d]/80"
                    : index === sceneIndex
                      ? "w-10 bg-[#e0bb5d] shadow-[0_0_12px_rgba(224,187,93,0.9)]"
                      : "w-6 bg-white/[0.14]"
                }`}
              />
            ))}
          </div>

          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full bg-gradient-to-r from-[#e0bb5d]/60 to-[#e0bb5d] shadow-[0_0_10px_rgba(224,187,93,0.7)] transition-[width] duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="group inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[#bfb8ac] transition hover:text-[#e0bb5d] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e0bb5d] cursor-pointer"
          >
            Omitir <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  );
};
