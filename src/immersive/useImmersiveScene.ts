/**
 * =============================================================================
 * HOOK — CICLO DE VIDA DE ImmersiveScene EN REACT
 * =============================================================================
 * Crea y destruye una UNICA instancia por montaje/desmontaje. No recrea la
 * escena en cada render ni usa el tiempo transcurrido como dependencia.
 * =============================================================================
 */

import { useEffect, useRef } from "react";
import { ImmersiveScene } from "./ImmersiveScene";

export function useImmersiveScene(
  canvas2D: HTMLCanvasElement | null,
  canvas3D: HTMLCanvasElement | null,
  enabled: boolean,
) {
  const sceneRef = useRef<ImmersiveScene | null>(null);

  useEffect(() => {
    if (!enabled || !canvas2D || !canvas3D) {
      return;
    }

    const scene = new ImmersiveScene({
      canvas2D,
      canvas3D,
      enableAudio: true,
    });

    sceneRef.current = scene;
    scene.start();

    return () => {
      scene.dispose();

      if (sceneRef.current === scene) {
        sceneRef.current = null;
      }
    };
  }, [canvas2D, canvas3D, enabled]);

  return sceneRef;
}

export default useImmersiveScene;
