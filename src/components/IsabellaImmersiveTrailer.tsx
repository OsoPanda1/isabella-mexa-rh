/**
 * =============================================================================
 * ISABELLA IMMERSIVE TRAILER — INTRO CINEMATOGRÁFICA EVOLUCIONADA
 * =============================================================================
 * Puerta de entrada inmersiva basada en ImmersiveScene (WebGL 3D + canvas 2D
 * + audio posicional). Orquesta la escena mediante useImmersiveScene y expone
 * la experiencia sonora SOLO tras gesto explícito del usuario.
 *
 * Principios:
 * - Una única instancia del motor por montaje (ver useImmersiveScene).
 * - El audio se activa únicamente con el botón "Activar experiencia sonora".
 * - Respeta prefers-reduced-motion y gestión de contexto WebGL.
 * - El CTA "Entrar al sistema" está SIEMPRE visible y accesible.
 * =============================================================================
 */

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useImmersiveScene } from "../immersive/useImmersiveScene";
import "./IsabellaCinematicTrailer.css";

export interface IsabellaImmersiveTrailerProps {
  onComplete: () => void;
  enterLabel?: string;
}

type AudioLabel =
  | "disabled"
  | "locked"
  | "loading"
  | "ready"
  | "playing"
  | "error";

export function IsabellaImmersiveTrailer({
  onComplete,
  enterLabel = "Entrar al sistema",
}: IsabellaImmersiveTrailerProps): React.ReactElement {
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const canvas3DRef = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sceneRef = useImmersiveScene(
    canvas2DRef.current,
    canvas3DRef.current,
    mounted,
  );

  const [audioOn, setAudioOn] = useState(false);
  const [audioLabel, setAudioLabel] = useState<AudioLabel>("locked");

  const completedRef = useRef(false);

  const finish = React.useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

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
    const id = window.setInterval(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      setAudioLabel(scene.getStatus().audio);
    }, 400);
    return () => window.clearInterval(id);
  }, [sceneRef]);

  const toggleAudio = React.useCallback(async () => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (audioOn) {
      scene.pause();
      setAudioOn(false);
      return;
    }

    await scene.unlockAudio();
    scene.resume();
    setAudioOn(true);
  }, [audioOn, sceneRef]);

  const buttonLabel =
    audioLabel === "playing" || audioOn
      ? "Silenciar audio"
      : "Activar experiencia sonora";

  return (
    <main
      id="main-content"
      className="isabella-trailer"
      role="region"
      aria-label="Introducción cinematográfica de Isabella Villaseñor AI"
    >
      <canvas
        ref={canvas2DRef}
        className="isabella-trailer__canvas isabella-trailer__canvas--2d"
        aria-hidden="true"
      />
      <canvas
        ref={canvas3DRef}
        className="isabella-trailer__canvas isabella-trailer__canvas--3d"
        aria-hidden="true"
      />

      <div className="isabella-trailer__hud" aria-hidden="true">
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
        <span className="isabella-trailer__sim-badge">SIMULATION MODE</span>
      </div>

      <div className="isabella-trailer__hero">
        <p className="isabella-trailer__eyebrow">ISABELLA VILLASEÑOR</p>
        <h1 className="isabella-trailer__title">
          Inteligencia soberana, con propósito humano.
        </h1>
        <p className="isabella-trailer__subtitle" aria-live="polite">
          El núcleo está listo para recibirte.
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
        <button
          type="button"
          className="isabella-trailer__btn"
          aria-pressed={audioOn}
          onClick={() => void toggleAudio()}
        >
          {buttonLabel}
        </button>
      </div>
    </main>
  );
}

export default IsabellaImmersiveTrailer;
