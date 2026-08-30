/**
 * Resolución tipada del constructor de AudioContext, incluyendo el prefijo
 * legacy webkit sin recurrir a `any`.
 */
export function getAudioContextConstructor(): (typeof AudioContext) | null {
  if (typeof window === "undefined") return null;
  if (typeof window.AudioContext === "function") return window.AudioContext;
  const win = window as Window & { webkitAudioContext?: typeof AudioContext };
  return win.webkitAudioContext ?? null;
}
