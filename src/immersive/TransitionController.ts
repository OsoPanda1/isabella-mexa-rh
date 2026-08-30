/**
 * =============================================================================
 * TRANSITION CONTROLLER — ORQUESTA FUNDIDOS DE CAPAS
 * =============================================================================
 * Encargado de interpolaciones discretas (fade in/out) entre capas visuales.
 * Se mantiene desacoplado del bucle de render: aplica alphas por animación
 * con requestAnimationFrame y cancela la animación previa al iniciar una nueva.
 * =============================================================================
 */

type Easing = (t: number) => number;

const EASE_IN_OUT: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface ActiveTransition {
  from: number;
  to: number;
  startTime: number;
  durationMs: number;
  ease: Easing;
  apply: (value: number) => void;
}

export class TransitionController {
  private current: ActiveTransition | null = null;
  private frameId: number | null = null;

  private readonly nextFrame = (now: number) => {
    if (!this.current) {
      this.frameId = null;
      return;
    }

    const { from, to, startTime, durationMs, ease, apply } = this.current;
    const progress = Math.min(1, (now - startTime) / Math.max(1, durationMs));
    const value = from + (to - from) * ease(progress);
    apply(value);

    if (progress >= 1) {
      this.current = null;
      this.frameId = null;
      return;
    }

    this.frameId = requestAnimationFrame(this.nextFrame);
  };

  to(
    target: number,
    durationMs: number,
    apply?: (value: number) => void,
    fromOverride?: number,
    ease: Easing = EASE_IN_OUT,
  ): void {
    this.cancelCurrent();

    const from = fromOverride ?? (this.current?.to ?? target);

    this.current = {
      from,
      to: target,
      startTime: performance.now(),
      durationMs: Math.max(0, durationMs),
      ease,
      apply: apply ?? ((value: number) => void value),
    };

    this.frameId = requestAnimationFrame(this.nextFrame);
  }

  fadeIn(durationMs: number, apply: (value: number) => void): void {
    this.to(1, durationMs, apply);
  }

  fadeOut(durationMs: number, apply: (value: number) => void): void {
    this.to(0, durationMs, apply);
  }

  isActive(): boolean {
    return this.current !== null;
  }

  cancelCurrent(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.current = null;
  }

  dispose(): void {
    this.cancelCurrent();
  }
}

export default TransitionController;
