/**
 * =============================================================================
 * IMMERSIVE SCENE — ESCENA CINEMATOGRÁFICA ORQUESTADA
 * =============================================================================
 * Orquesta (no implementa) la lógica de la intro: ciclo de vida, render WebGL,
 * cámara, parallax, audio, calidad adaptativa, visibilidad, capa 2D y 3D, y
 * transiciones. Diseñada para compilar contra el repositorio real (Vite).
 *
 * Principios:
 * - Una sola instancia por canvas; el archivo orquesta, no implementa todo.
 * - AudioContext creado SOLO bajo gesto del usuario (unlockAudio()).
 * - Nodos de audio conectados una sola vez.
 * - redimensionado con ResizeObserver.
 * - Manejo de webglcontextlost / webglcontextrestored.
 * - Respeta prefers-reduced-motion.
 * - FPS adaptativo y límite de pixel ratio.
 * - Pausa reversible al cambiar de pestaña.
 * - dispose() idempotente.
 * =============================================================================
 */

import * as THREE from "three";
import { Starfield3D } from "./Starfield3D";
import { Starfield2D } from "./Starfield2D";
import { detectQuality } from "./quality";
import { TransitionController } from "./TransitionController";
import introAudioUrl from "../assets/images/intro-audio.mp3";

export interface ImmersiveSceneOptions {
  canvas2D: HTMLCanvasElement;
  canvas3D: HTMLCanvasElement;
  audioUrl?: string;
  enableAudio?: boolean;
  maxPixelRatio?: number;
  targetFps?: number;
  reducedMotion?: boolean;
}

export interface ImmersiveSceneStatus {
  running: boolean;
  audio: "disabled" | "locked" | "loading" | "ready" | "playing" | "error";
  quality: "low" | "medium" | "high";
  contextLost: boolean;
}

type AudioState = {
  context: AudioContext;
  source: THREE.PositionalAudio;
  analyser: AnalyserNode;
  output: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  echoFilter: BiquadFilterNode;
  frequencyData: Uint8Array;
  loaded: boolean;
  unlocked: boolean;
  disposed: boolean;
};

export class ImmersiveScene {
  readonly transition = new TransitionController();

  private readonly canvas2D: HTMLCanvasElement;
  private readonly canvas3D: HTMLCanvasElement;
  private readonly quality = detectQuality();
  private readonly reducedMotion: boolean;
  private readonly enableAudio: boolean;
  private readonly audioUrl: string;
  private readonly maxPixelRatio: number;
  private readonly targetFrameMs: number;

  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private atmosphere = new THREE.Group();
  private audioEmitter = new THREE.Group();

  private stars2D: Starfield2D;
  private stars3D: Starfield3D;
  private audio: AudioState | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private frameId: number | null = null;
  private running = false;
  private disposed = false;
  private contextLost = false;
  private lastFrameAt = 0;

  private elapsed = 0;
  private previousTimestamp = 0;

  private currentRotationX = 0;
  private currentRotationY = 0;
  private targetRotationX = 0;
  private targetRotationY = 0;

  private pointerX = 0;
  private pointerY = 0;

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.canAnimate()) return;

    const rect = this.canvas3D.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    this.pointerX = THREE.MathUtils.clamp(x * 2 - 1, -1, 1);
    this.pointerY = THREE.MathUtils.clamp(y * 2 - 1, -1, 1);

    this.targetRotationY = this.pointerX * 0.16;
    this.targetRotationX = -this.pointerY * 0.12;
  };

  private readonly onPointerLeave = () => {
    this.targetRotationX = 0;
    this.targetRotationY = 0;
  };

  private readonly onVisibilityChange = () => {
    if (document.hidden) {
      this.pause();
    } else if (!this.disposed) {
      this.resume();
    }
  };

  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
    this.stop();
  };

  private readonly onContextRestored = () => {
    if (this.disposed) return;

    this.contextLost = false;
    this.rebuildRendererState();
    this.resume();
  };

  constructor(options: ImmersiveSceneOptions) {
    this.canvas2D = options.canvas2D;
    this.canvas3D = options.canvas3D;
    this.enableAudio = options.enableAudio ?? true;
    this.audioUrl = options.audioUrl ?? introAudioUrl;
    this.maxPixelRatio = Math.min(
      options.maxPixelRatio ?? 1.75,
      2,
    );
    this.targetFrameMs = 1000 / (options.targetFps ?? 60);
    this.reducedMotion =
      options.reducedMotion ??
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    this.stars2D = new Starfield2D(this.canvas2D, {
      count: this.reducedMotion
        ? Math.floor(this.quality.starCount2D * 0.45)
        : this.quality.starCount2D,
      twinkle:
        !this.reducedMotion &&
        this.quality.quality !== "low",
    });

    this.renderer = this.createRenderer();
    this.camera = this.createCamera();
    this.scene = new THREE.Scene();

    this.scene.add(this.atmosphere);
    this.scene.add(this.audioEmitter);
    this.camera.add(new THREE.AudioListener());
    this.scene.fog =
      this.quality.quality === "low" || this.reducedMotion
        ? null
        : new THREE.FogExp2(0x02040a, 0.007);

    this.stars3D = new Starfield3D({
      count: this.reducedMotion
        ? Math.floor(this.quality.starCount3D * 0.45)
        : this.quality.starCount3D,
      motion: this.reducedMotion
        ? 0
        : this.quality.enable4D
          ? 1
          : 0,
      pointScale:
        this.quality.quality === "high"
          ? 220
          : 160,
    });

    this.atmosphere.add(this.stars3D.points);

    this.bindEvents();
    this.resize();
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas3D,
      alpha: true,
      antialias:
        this.quality.quality !== "low" &&
        !this.reducedMotion,
      powerPreference: "high-performance",
      depth: true,
      stencil: false,
      preserveDrawingBuffer: false,
    });

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        this.maxPixelRatio,
      ),
    );

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    renderer.domElement.addEventListener(
      "webglcontextlost",
      this.onContextLost,
      false,
    );

    renderer.domElement.addEventListener(
      "webglcontextrestored",
      this.onContextRestored,
      false,
    );

    return renderer;
  }

  private createCamera(): THREE.PerspectiveCamera {
    const width = Math.max(
      this.canvas3D.clientWidth,
      1,
    );

    const height = Math.max(
      this.canvas3D.clientHeight,
      1,
    );

    const camera = new THREE.PerspectiveCamera(
      54,
      width / height,
      0.1,
      250,
    );

    camera.position.set(0, 0, 42);
    return camera;
  }

  private bindEvents(): void {
    this.canvas3D.addEventListener(
      "pointermove",
      this.onPointerMove,
      { passive: true },
    );

    this.canvas3D.addEventListener(
      "pointerleave",
      this.onPointerLeave,
      { passive: true },
    );

    document.addEventListener(
      "visibilitychange",
      this.onVisibilityChange,
    );

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(
        () => this.resize(),
      );

      this.resizeObserver.observe(this.canvas3D);
    } else {
      window.addEventListener("resize", this.resize);
    }
  }

  private resize = (): void => {
    if (this.disposed) return;

    const width = Math.max(
      this.canvas3D.clientWidth || window.innerWidth,
      1,
    );

    const height = Math.max(
      this.canvas3D.clientHeight || window.innerHeight,
      1,
    );

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        this.maxPixelRatio,
      ),
    );

    this.renderer.setSize(
      width,
      height,
      false,
    );
  };

  private ensureAudio(): AudioState | null {
    if (!this.enableAudio || this.audio) {
      return this.audio;
    }

    const listener = this.camera.children.find(
      (child): child is THREE.AudioListener =>
        child instanceof THREE.AudioListener,
    );

    if (!listener) return null;

    const context = listener.context;
    const source = new THREE.PositionalAudio(listener);
    const output = context.createGain();
    const analyser = context.createAnalyser();
    const delay = context.createDelay(2);
    const feedback = context.createGain();
    const echoFilter = context.createBiquadFilter();

    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;

    delay.delayTime.value = 0.34;
    feedback.gain.value = 0.24;
    echoFilter.type = "lowpass";
    echoFilter.frequency.value = 1500;
    output.gain.value = 0.0001;

    source.setDistanceModel("exponential");
    source.setRefDistance(8);
    source.setMaxDistance(160);
    source.setRolloffFactor(1.1);

    if (source.panner) {
      source.panner.panningModel = "HRTF";
    }

    const sourceOutput = source.getOutput();

    sourceOutput.connect(analyser);
    sourceOutput.connect(output);
    output.connect(delay);
    delay.connect(echoFilter);
    echoFilter.connect(feedback);
    feedback.connect(delay);
    echoFilter.connect(context.destination);
    output.connect(context.destination);

    this.audioEmitter.add(source);

    this.audio = {
      context,
      source,
      analyser,
      output,
      delay,
      feedback,
      echoFilter,
      frequencyData: new Uint8Array(
        analyser.frequencyBinCount,
      ),
      loaded: false,
      unlocked: false,
      disposed: false,
    };

    void this.loadAudio(this.audio);
    return this.audio;
  }

  private async loadAudio(audio: AudioState): Promise<void> {
    try {
      const response = await fetch(this.audioUrl);

      if (!response.ok) {
        throw new Error("AUDIO_FETCH_FAILED");
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audio.context.decodeAudioData(
        arrayBuffer,
      );

      if (audio.disposed || this.disposed) return;

      audio.source.setBuffer(buffer);
      audio.source.setLoop(true);
      audio.source.setVolume(0.55);
      audio.loaded = true;

      if (
        this.running &&
        audio.unlocked &&
        !audio.source.isPlaying
      ) {
        audio.source.play();
      }
    } catch {
      audio.loaded = false;
    }
  }

  async unlockAudio(): Promise<boolean> {
    const audio = this.ensureAudio();

    if (!audio || audio.disposed) return false;

    try {
      await audio.context.resume();
      audio.unlocked = true;

      if (
        audio.loaded &&
        this.running &&
        !audio.source.isPlaying
      ) {
        audio.source.play();
      }

      return true;
    } catch {
      return false;
    }
  }

  private updateAudio(elapsed: number): void {
    const audio = this.audio;

    if (!audio || audio.disposed) return;

    audio.analyser.getByteFrequencyData(
      audio.frequencyData,
    );

    let bass = 0;

    for (let i = 0; i < 6; i += 1) {
      bass += audio.frequencyData[i] ?? 0;
    }

    bass /= 6 * 255;

    audio.output.gain.setTargetAtTime(
      0.035 + bass * 0.02,
      audio.context.currentTime,
      0.08,
    );

    this.audioEmitter.position.set(
      Math.sin(elapsed * 0.22) * 12,
      Math.cos(elapsed * 0.17) * 8,
      Math.sin(elapsed * 0.13) * 6 - 5,
    );
  }

  private updateCamera(delta: number, elapsed: number): void {
    const lambda = this.reducedMotion ? 8 : 4.8;

    this.currentRotationX = THREE.MathUtils.damp(
      this.currentRotationX,
      this.targetRotationX,
      lambda,
      delta,
    );

    this.currentRotationY = THREE.MathUtils.damp(
      this.currentRotationY,
      this.targetRotationY,
      lambda,
      delta,
    );

    this.atmosphere.rotation.x =
      this.currentRotationX;

    this.atmosphere.rotation.y =
      this.currentRotationY;

    if (this.reducedMotion) {
      this.camera.position.set(0, 0, 42);
    } else {
      this.camera.position.x =
        Math.sin(elapsed * 0.4) * 0.12 +
        this.pointerX * 0.55;

      this.camera.position.y =
        Math.cos(elapsed * 0.3) * 0.1 -
        this.pointerY * 0.55;

      this.camera.position.z =
        42 + Math.sin(elapsed * 0.2) * 0.18;
    }

    this.camera.lookAt(0, 0, 0);
  }

  private render = (timestamp: number): void => {
    if (!this.running || this.disposed) return;

    if (
      timestamp - this.lastFrameAt <
      this.targetFrameMs * 0.85
    ) {
      this.frameId = requestAnimationFrame(
        this.render,
      );
      return;
    }

    const delta = Math.min(
      (timestamp - this.previousTimestamp) / 1000 || 0,
      0.1,
    );

    this.previousTimestamp = timestamp;
    this.lastFrameAt = timestamp;
    this.elapsed += delta;

    this.stars3D.update(this.elapsed);
    this.updateCamera(delta, this.elapsed);
    this.updateAudio(this.elapsed);

    try {
      this.renderer.render(
        this.scene,
        this.camera,
      );
    } catch {
      this.stop();
      return;
    }

    this.frameId = requestAnimationFrame(
      this.render,
    );
  };

  start(): void {
    if (this.running || this.disposed) return;

    this.running = true;
    this.previousTimestamp = performance.now();
    this.lastFrameAt = 0;

    this.stars2D.start();
    this.ensureAudio();

    if (
      this.audio?.loaded &&
      this.audio.unlocked &&
      !this.audio.source.isPlaying
    ) {
      this.audio.source.play();
    }

    this.frameId = requestAnimationFrame(
      this.render,
    );
  }

  pause(): void {
    if (!this.running) return;

    this.running = false;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    this.stars2D.stop();

    if (this.audio?.source.isPlaying) {
      this.audio.source.pause();
    }
  }

  resume(): void {
    if (this.disposed || this.contextLost) return;
    this.start();
  }

  stop(): void {
    this.pause();
  }

  set3DOpacity(value: number): void {
    if (this.disposed) return;

    this.stars3D.setOpacity(
      THREE.MathUtils.clamp(value, 0, 1),
    );
  }

  getStatus(): ImmersiveSceneStatus {
    const audio = this.audio;

    return {
      running: this.running,
      audio: !this.enableAudio
        ? "disabled"
        : !audio
          ? "locked"
          : audio.loaded
            ? audio.source.isPlaying
              ? "playing"
              : "ready"
            : "loading",
      quality: this.quality.quality,
      contextLost: this.contextLost,
    };
  }

  private canAnimate(): boolean {
    return !this.disposed && !this.contextLost;
  }

  private rebuildRendererState(): void {
    this.resize();
    this.atmosphere.rotation.set(0, 0, 0);
    this.camera.position.set(0, 0, 42);
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.pause();
    this.transition.dispose();

    this.canvas3D.removeEventListener(
      "pointermove",
      this.onPointerMove,
    );

    this.canvas3D.removeEventListener(
      "pointerleave",
      this.onPointerLeave,
    );

    document.removeEventListener(
      "visibilitychange",
      this.onVisibilityChange,
    );

    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.resize);

    if (this.audio) {
      this.audio.disposed = true;

      if (this.audio.source.isPlaying) {
        this.audio.source.stop();
      }

      this.audio.source.disconnect();
      this.audio.output.disconnect();
      this.audio.delay.disconnect();
      this.audio.feedback.disconnect();
      this.audio.echoFilter.disconnect();

      void this.audio.context.close().catch(() => {
        // Context may already be closed.
      });

      this.audio = null;
    }

    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.onContextLost,
    );

    this.renderer.domElement.removeEventListener(
      "webglcontextrestored",
      this.onContextRestored,
    );

    this.stars2D.dispose();
    this.stars3D.dispose();

    this.scene.clear();
    this.camera.clear();
    this.renderer.dispose();
  }
}

export default ImmersiveScene;
