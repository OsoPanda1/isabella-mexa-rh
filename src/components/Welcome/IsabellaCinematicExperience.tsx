/**
 * =============================================================================
 * ISABELLA CINEMATIC EXPERIENCE — EXPERIENCIA DE ENTRADA UNIFICADA
 * =============================================================================
 * Unifica la bienvenida (welcome modal), la introducción cinematográfica y la
 * escena inmersiva en un único componente orquestado por useImmersiveScene.
 *
 * - Modo "cinematic": intro inmersiva a pantalla completa (WebGL + canvas 2D).
 * - Modo "welcome": modal con pestañas (génesis / manifiesto / capacidades /
 *   comenzar) y atajos de entrada.
 * - El audio SOLO arranca tras gesto del usuario (políticas de autoplay).
 * - Respeta prefers-reduced-motion.
 * - Toda telemetría es SIMULADA y se etiqueta como tal (honestidad de datos).
 * =============================================================================
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Brain, Cpu, Globe, Heart, Palette, Shield, Sparkles, Volume2, VolumeX, X, Zap, type LucideIcon } from "lucide-react";
import { useCrown } from "../../context/CrownContext";
import { soundManager } from "../../utils/soundEffects";
import { ISABELLA_MEDALLION_IMAGE } from "../../data/isabellaAvatar";
import { useImmersiveScene } from "../../immersive/useImmersiveScene";
import "../IsabellaCinematicTrailer.css";

export interface IsabellaCinematicExperienceProps {
  isOpen: boolean;
  onClose: () => void;
  onEnter?: () => void;
  enableCinematic?: boolean;
  enableAudio?: boolean;
  durationMs?: number;
}

type TabId = "genesis" | "manifesto" | "capabilities" | "starters";
type ViewId = "terminal" | "presence" | "image_studio";
const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "genesis", label: "Génesis", icon: Globe },
  { id: "manifesto", label: "Manifiesto", icon: Shield },
  { id: "capabilities", label: "Capacidades", icon: Cpu },
  { id: "starters", label: "Comenzar", icon: Sparkles },
];
const SCENES = [
  { id: "signal", at: 0, title: "Señal de enlace", text: "Iniciando vector de enlace de Nodo Cero..." },
  { id: "awakening", at: 4200, title: "Despertar", text: "Desplegando contexto, memoria y constelaciones." },
  { id: "identity", at: 10400, title: "Identidad", text: "Isabella Villaseñor — inteligencia aplicada." },
  { id: "manifesto", at: 17200, title: "Manifiesto", text: "La evidencia precede a la confianza." },
  { id: "arrival", at: 24200, title: "Llegada", text: "El núcleo está listo para recibirte." },
] as const;
const STARTERS: { id: string; title: string; description: string; prompt: string; icon: LucideIcon; view: ViewId; badge: string }[] = [
  { id: "init", title: "Iniciación soberana", description: "Conoce la arquitectura y el propósito de Isabella.", prompt: "Explícame la tesis de Isabella como infraestructura cognitiva territorial.", icon: Globe, view: "terminal", badge: "Recomendado" },
  { id: "visual", title: "Síntesis visual", description: "Explora una composición inspirada en Real del Monte.", prompt: "Genera una propuesta visual que fusione Real del Monte con una red cognitiva.", icon: Palette, view: "image_studio", badge: "ORION" },
  { id: "dialectic", title: "Diálogo dialéctico", description: "Examina tecnología, ética y libertad humana.", prompt: "¿Cómo conviven verificación, ética territorial y libertad humana?", icon: Brain, view: "terminal", badge: "SOPHIA" },
  { id: "voice", title: "Presencia sonora", description: "Inicia una experiencia narrativa con voz.", prompt: "Háblame sobre la memoria, la montaña y el futuro tecnológico.", icon: Volume2, view: "presence", badge: "Voz" },
];

function sceneAt(ms: number) { let current: (typeof SCENES)[number] = SCENES[0]; for (const scene of SCENES) { if (ms >= scene.at) current = scene; else break; } return current; }

export function IsabellaCinematicExperience({ isOpen, onClose, onEnter, enableCinematic = true, enableAudio = true, durationMs = 30000 }: IsabellaCinematicExperienceProps) {
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const canvas3DRef = useRef<HTMLCanvasElement | null>(null);
  const completedRef = useRef(false);
  const [cinematic, setCinematic] = useState(enableCinematic);
  const [tab, setTab] = useState<TabId>("genesis");
  const [audio, setAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const { sendMessage, setActiveView } = useCrown();
  const sceneRef = useImmersiveScene({ canvas2DRef, canvas3DRef, enabled: isOpen && cinematic, enableAudio, durationMs });

  useEffect(() => { const media = matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReducedMotion(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  useEffect(() => { if (!isOpen) return; const timer = window.setInterval(() => { const s = sceneRef.current?.getStatus(); if (s) setElapsed(s.elapsedMs); }, 120); return () => clearInterval(timer); }, [isOpen, sceneRef]);
  useEffect(() => { if (!cinematic || !isOpen || reducedMotion) return; if (elapsed >= durationMs && !completedRef.current) { completedRef.current = true; setCinematic(false); } }, [cinematic, durationMs, elapsed, isOpen, reducedMotion]);
  useEffect(() => () => { sceneRef.current?.dispose(); }, [sceneRef]);

  const close = useCallback(() => { sceneRef.current?.stop(); soundManager.playBeep(460, 0.03); onClose(); }, [onClose, sceneRef]);
  const enter = useCallback(() => { sceneRef.current?.stop(); onEnter?.(); if (!onEnter) onClose(); }, [onClose, onEnter, sceneRef]);
  const toggleAudio = useCallback(async () => { const scene = sceneRef.current; if (!scene || !enableAudio) return; if (audio) { scene.mute(); setAudio(false); } else { const ok = await scene.unlockAudio(); if (ok) { scene.unmute(); setAudio(true); } } }, [audio, enableAudio, sceneRef]);
  const starter = useCallback((item: (typeof STARTERS)[number]) => { setActiveView(item.view); close(); void sendMessage(item.prompt); }, [close, sendMessage, setActiveView]);
  useEffect(() => { if (!isOpen) return; const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); if (event.key === "Enter" && cinematic) setCinematic(false); if (event.key === " " && cinematic && !reducedMotion) { event.preventDefault(); const scene = sceneRef.current; if (scene?.getStatus().running) scene.pause(); else scene?.resume(); } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [cinematic, close, isOpen, reducedMotion, sceneRef]);
  if (!isOpen) return null;
  const current = sceneAt(elapsed); const progress = Math.min(100, elapsed / durationMs * 100);

  if (cinematic) return <main className="isabella-trailer" role="dialog" aria-modal="true" aria-label="Introducción cinematográfica de Isabella">
    <canvas ref={canvas2DRef} className="isabella-trailer__canvas isabella-trailer__canvas--2d" aria-hidden="true" />
    <canvas ref={canvas3DRef} className="isabella-trailer__canvas isabella-trailer__canvas--3d" aria-hidden="true" />
    <div className="isabella-trailer__hud" aria-hidden="true"><div className="isabella-trailer__reticle" /><div className="isabella-trailer__readout"><span>ISABELLA · NODO CERO</span><span>SCENE {current.id.toUpperCase()}</span><span>ORIGIN LOCAL PRESENTATION</span><span>TELEMETRY SIMULATED</span></div><span className="isabella-trailer__sim-badge">CINEMATIC SIMULATION</span></div>
    <header className="isabella-trailer__topbar"><span className="isabella-trailer__brand"><Shield size={16} /> Isabella Villaseñor AI</span><button className="isabella-trailer__icon-btn" onClick={close} aria-label="Cerrar introducción"><X size={18} /></button></header>
    <section className="isabella-trailer__hero"><p className="isabella-trailer__eyebrow">{current.title}</p><h1 className="isabella-trailer__title">Inteligencia soberana,<span> con propósito humano.</span></h1><p className="isabella-trailer__subtitle" aria-live="polite">{current.text}</p><div className="isabella-trailer__tags"><span>MEMORY</span><span>TERRITORY</span><span>VERIFICATION</span></div><button className="isabella-trailer__cta" onClick={() => setCinematic(false)}>Continuar</button></section>
    <footer className="isabella-trailer__footer"><div className="isabella-trailer__progress"><div className="isabella-trailer__progress-value" style={{ width: `${progress}%` }} /></div><div className="isabella-trailer__controls"><button className="isabella-trailer__btn" onClick={() => setCinematic(false)}>Omitir</button>{enableAudio && <button className="isabella-trailer__btn" onClick={() => void toggleAudio()} aria-pressed={audio}>{audio ? <Volume2 size={15} /> : <VolumeX size={15} />} {audio ? "Silenciar" : "Activar audio"}</button>}<button className="isabella-trailer__btn" onClick={enter}>Entrar</button></div></footer>
  </main>;

  return <div className="isabella-welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="isabella-welcome-title"><div className="isabella-welcome-modal"><header className="isabella-welcome-header"><div className="isabella-welcome-brand"><img src={ISABELLA_MEDALLION_IMAGE} alt="Isabella" className="isabella-welcome-avatar" /><div><h2 id="isabella-welcome-title">Isabella Villaseñor AI</h2><p>Nodo Cero · Infraestructura cognitiva territorial</p></div></div><button className="isabella-welcome-close" onClick={close} aria-label="Cerrar bienvenida"><X size={19} /></button></header><nav className="isabella-welcome-tabs" aria-label="Secciones"><button className="isabella-tab" onClick={() => setCinematic(true)}>Cinemática</button>{TABS.map(item => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? "isabella-tab isabella-tab--active" : "isabella-tab"} onClick={() => setTab(item.id)} aria-selected={tab === item.id}><Icon size={15} />{item.label}</button>; })}</nav><section className="isabella-welcome-content">{tab === "genesis" && <div className="isabella-section"><article className="isabella-feature-card"><Sparkles size={22} /><h3>Inteligencia con contexto</h3><p>Isabella conecta conocimiento, memoria, territorio y acción bajo controles explícitos.</p></article><div className="isabella-pillar-grid">{PILLAR_DATA.map(item => <React.Fragment key={item.title}><Pillar {...item} /></React.Fragment>)}</div></div>}{tab === "manifesto" && <article className="isabella-manifesto"><span>PRINCIPIOS DE ISABELLA</span><blockquote>La evidencia precede a la confianza.</blockquote><blockquote>La memoria permanece bajo control de quien la utiliza.</blockquote><blockquote>La automatización conserva límites, supervisión y reversibilidad.</blockquote></article>}{tab === "capabilities" && <div className="isabella-capability-grid"><Capability icon={Cpu} title="CROWN" text="Orquestación y decisión." /><Capability icon={Brain} title="SOPHIA" text="Evidencia y contradicciones." /><Capability icon={Heart} title="ISA" text="Interacción contextual." /><Capability icon={Zap} title="ORION" text="Creación multimodal." /><Capability icon={Shield} title="ARGUS" text="Seguridad y provenance." /></div>}{tab === "starters" && <div className="isabella-starter-grid">{STARTERS.map(item => <button className="isabella-starter" key={item.id} onClick={() => starter(item)}><item.icon size={18} /><small>{item.badge}</small><strong>{item.title}</strong><span>{item.description}</span><em>Comenzar <ArrowRight size={15} /></em></button>)}</div>}</section><footer className="isabella-welcome-footer"><span>Las capacidades no disponibles se muestran como simulación o degradación.</span><button className="isabella-enter-button" onClick={enter}>Entrar al ecosistema</button></footer></div></div>;
}

const PILLAR_DATA = [{ icon: Shield, title: "Gobernanza y privacidad", description: "Controles de acceso, separación de contexto y trazabilidad.", badge: "CROWN" }, { icon: Brain, title: "Rigor y evidencia", description: "Fuentes, limitaciones y contradicciones visibles.", badge: "SOPHIA" }, { icon: Heart, title: "Interacción humana", description: "Experiencia clara, cálida y accesible.", badge: "ISA" }, { icon: Zap, title: "Creación multimodal", description: "Texto, voz, imágenes y capacidades controladas.", badge: "ORION" }];
function Pillar({ icon: Icon, title, description, badge }: (typeof PILLAR_DATA)[number]) { return <article className="isabella-pillar"><Icon size={19} /><small>{badge}</small><h3>{title}</h3><p>{description}</p></article>; }
function Capability({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) { return <article className="isabella-capability"><Icon size={20} /><strong>{title}</strong><p>{text}</p></article>; }

export default IsabellaCinematicExperience;
