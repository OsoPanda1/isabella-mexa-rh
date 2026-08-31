/**
 * =============================================================================
 * HOOK — CICLO DE VIDA DE ImmersiveScene EN REACT
 * =============================================================================
 * Crea y destruye una UNICA instancia por montaje/desmontaje. No recrea la
 * escena en cada render ni usa el tiempo transcurrido como dependencia.
 * Acepta refs a los canvas y una bandera `enabled`.
 * =============================================================================
 */

import { useEffect, useRef, type RefObject } from "react";
import { ImmersiveScene } from "./ImmersiveScene";

export interface UseImmersiveSceneOptions {
  canvas2DRef: RefObject<HTMLCanvasElement | null>;
  canvas3DRef: RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
  enableAudio?: boolean;
  durationMs?: number;
}

export function useImmersiveScene({
  canvas2DRef,
  canvas3DRef,
  enabled,
  enableAudio = true,
}: UseImmersiveSceneOptions) {
  const sceneRef = useRef<ImmersiveScene | null>(null);

  useEffect(() => {
    const canvas2D = canvas2DRef.current;
    const canvas3D = canvas3DRef.current;

    if (!enabled || !canvas2D || !canvas3D) {
      return;
    }

    const scene = new ImmersiveScene({
      canvas2D,
      canvas3D,
      enableAudio,
      maxPixelRatio: 1.75,
      targetFps: 60,
    });

    sceneRef.current = scene;
    scene.start();

    return () => {
      scene.dispose();

      if (sceneRef.current === scene) {
        sceneRef.current = null;
      }
    };
  }, [canvas2DRef, canvas3DRef, enabled, enableAudio]);

  return sceneRef;
}

export default useImmersiveScene;
