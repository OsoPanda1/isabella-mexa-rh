import * as THREE from "three";
import { generateStar, type MathematicalPlane } from "./MathematicalPlanes";
import { starVertexShader, starFragmentShader } from "./StarfieldShaders";

export interface Starfield3DOptions {
  count?: number;
  motion?: number;
  pointScale?: number;
}

export class Starfield3D {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  readonly geometry: THREE.BufferGeometry;

  private motion = 1;

  constructor(options: Starfield3DOptions = {}) {
    const count = options.count ?? 4000;
    this.motion = options.motion ?? 1;

    const planes: MathematicalPlane[] = [
      "cartesian_xz",
      "cartesian_xy",
      "spherical_near",
      "spherical_mid",
      "spherical_deep",
    ];

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const phases = new Float32Array(count);
    const frequencies = new Float32Array(count);
    const amplitudes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const plane = planes[i % planes.length];
      const star = generateStar(i, plane);

      positions[i * 3] = star.x;
      positions[i * 3 + 1] = star.y;
      positions[i * 3 + 2] = star.z;

      colors[i * 3] = Math.min(1, 0.88 + star.hueShift);
      colors[i * 3 + 1] = Math.min(1, 0.84 + star.hueShift * 0.5);
      colors[i * 3 + 2] = Math.max(0, 0.72 - star.hueShift);

      sizes[i] = star.size;
      alphas[i] = star.twinkle;
      phases[i] = star.twinkle * 100;
      frequencies[i] = star.size;
      amplitudes[i] = star.size * 0.4;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    this.geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    this.geometry.setAttribute("aFrequency", new THREE.BufferAttribute(frequencies, 1));
    this.geometry.setAttribute("aAmplitude", new THREE.BufferAttribute(amplitudes, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMotion: { value: this.motion },
        uPointScale: { value: options.pointScale ?? 220 },
      },
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  update(timeSeconds: number) {
    this.material.uniforms.uTime.value = timeSeconds;
  }

  setMotion(value: number) {
    this.motion = Math.max(0, Math.min(1, value));
    this.material.uniforms.uMotion.value = this.motion;
  }

  setOpacity(value: number) {
    this.material.opacity = Math.max(0, Math.min(1, value));
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
