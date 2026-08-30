/**
 * =============================================================================
 * DETECCIÓN DE CALIDAD ADAPTATIVA
 * =============================================================================
 * Perfil de calidad calculado una sola vez por instancia, según capacidades
 * del dispositivo (memoria, núcleos y prefers-reduced-motion). Evita
 * re-evaluar por frame y mantiene el presupuesto de GPU/CPU de la escena.
 * =============================================================================
 */

export type QualityLevel = "low" | "medium" | "high";

export interface QualityProfile {
  quality: QualityLevel;
  pixelRatio: number;
  starCount2D: number;
  starCount3D: number;
  enable4D: boolean;
  enableParallax: boolean;
}

export function detectQuality(): QualityProfile {
  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const memory = (
    navigator as Navigator & {
      deviceMemory?: number;
    }
  ).deviceMemory ?? 4;

  const cores = navigator.hardwareConcurrency ?? 4;

  if (reduced || memory <= 2 || cores <= 2) {
    return {
      quality: "low",
      pixelRatio: 1,
      starCount2D: 80,
      starCount3D: 250,
      enable4D: false,
      enableParallax: false,
    };
  }

  if (memory <= 4 || cores <= 4) {
    return {
      quality: "medium",
      pixelRatio: 1.25,
      starCount2D: 150,
      starCount3D: 600,
      enable4D: false,
      enableParallax: true,
    };
  }

  return {
    quality: "high",
    pixelRatio: 1.75,
    starCount2D: 250,
    starCount3D: 1200,
    enable4D: true,
    enableParallax: true,
  };
}

export default detectQuality;
