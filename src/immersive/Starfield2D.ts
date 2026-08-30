/**
 * =============================================================================
 * STARFIELD 2D — CONSTELACIÓN DE FONDO EN CANVAS 2D
 * =============================================================================
 * Capa 2D ligera de estrellas con twinkle, dibujada fuera del loop WebGL.
 * Respeta el presupuesto adaptativo (count) y el estado de animación.
 * =============================================================================
 */

export interface Starfield2DOptions {
  count?: number;
  twinkle?: boolean;
}

interface Star2DState {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
  rate: number;
}

const DEFAULT_COUNT = 150;

export class Starfield2D {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly count: number;
  private readonly twinkle: boolean;

  private stars: Star2DState[] = [];
  private running = false;
  private disposed = false;
  private frameId: number | null = null;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement, options: Starfield2DOptions = {}) {
    this.canvas = canvas;
    this.count = options.count ?? DEFAULT_COUNT;
    this.twinkle = options.twinkle ?? true;
    this.ctx = canvas.getContext("2d");
    this.seedStars();
  }

  private seedStars(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(this.canvas.clientWidth || window.innerWidth, 1);
    const height = Math.max(this.canvas.clientHeight || window.innerHeight, 1);

    if (this.canvas.width !== Math.floor(width * dpr)) {
      this.canvas.width = Math.floor(width * dpr);
    }
    if (this.canvas.height !== Math.floor(height * dpr)) {
      this.canvas.height = Math.floor(height * dpr);
    }

    this.stars = [];
    for (let i = 0; i < this.count; i += 1) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        z: 0.2 + Math.random() * 0.8,
        size: 0.5 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
        rate: 1.2 + Math.random() * 3.2,
      });
    }
  }

  private draw(now: number): void {
    if (!this.ctx || this.disposed) return;

    const last = this.lastTime || now;
    const dt = (now - last) / 1000;
    this.lastTime = now;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const t = now / 1000;

    this.ctx.clearRect(0, 0, width, height);

    for (const s of this.stars) {
      const px = s.x * width;
      const py = s.y * height;

      if (this.twinkle) {
        const phase = s.phase + t * s.rate;
        const tw = 0.5 + 0.5 * Math.sin(phase);
        this.ctx.globalAlpha = (0.35 + 0.65 * s.z) * tw;
      } else {
        this.ctx.globalAlpha = 0.25 + 0.6 * s.z;
      }

      this.ctx.fillStyle = "#cdd6f4";
      this.ctx.beginPath();
      this.ctx.arc(px, py, s.size * s.z, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.globalAlpha = 1;

    // FPS-variable twinkle smoothing
    void dt;
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      if (!this.running || this.disposed) return;
      this.draw(now);
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.stars = [];
  }
}

export default Starfield2D;
