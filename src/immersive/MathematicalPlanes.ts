export type MathematicalPlane =
  | "cartesian_xz"
  | "cartesian_xy"
  | "spherical_near"
  | "spherical_mid"
  | "spherical_deep";

export interface GeneratedStar {
  x: number;
  y: number;
  z: number;
  size: number;
  twinkle: number;
  hueShift: number;
}

// Simple seeded pseudo-random for deterministic star placement
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPREAD_COS_NEAR = 320;
const SPREAD_COS_MID = 780;
const SPREAD_COS_DEEP = 1500;
const SPREAD_PLANAR = 960;

/**
 * Generate a single star position for the given mathematical plane variant.
 * Returns 3D coordinates in a scaled space suitable for THREE.OrthographicCamera frustums.
 */
export function generateStar(index: number, plane: MathematicalPlane): GeneratedStar {
  const rand = mulberry32(index * 2654435761 + plane.length * 97);
  const phi = rand() * Math.PI * 2;
  const theta = Math.acos(2 * rand() - 1);

  let radius: number;
  switch (plane) {
    case "spherical_near":
      radius = SPREAD_COS_NEAR * (0.55 + rand() * 0.45);
      break;
    case "spherical_mid":
      radius = SPREAD_COS_MID * (0.7 + rand() * 0.6);
      break;
    case "spherical_deep":
      radius = SPREAD_COS_DEEP * (0.8 + rand() * 0.55);
      break;
    case "cartesian_xz":
    case "cartesian_xy":
    default:
      radius = SPREAD_PLANAR * (0.45 + rand() * 0.9);
      break;
  }

  const x0 = radius * Math.sin(theta) * Math.cos(phi);
  const y0 = radius * Math.sin(theta) * Math.sin(phi);
  const z0 = radius * Math.cos(theta);

  let x: number;
  let y: number;
  let z: number;

  switch (plane) {
    case "cartesian_xz":
      x = (rand() - 0.5) * SPREAD_PLANAR * 2;
      y = (rand() - 0.5) * 80;
      z = (rand() - 0.5) * SPREAD_PLANAR * 2;
      break;
    case "cartesian_xy":
      x = (rand() - 0.5) * SPREAD_PLANAR * 2;
      y = (rand() - 0.5) * SPREAD_PLANAR * 2;
      z = (rand() - 0.5) * 120;
      break;
    case "spherical_near":
    case "spherical_mid":
    case "spherical_deep":
    default:
      x = x0;
      y = y0;
      z = z0;
      break;
  }

  return {
    x,
    y,
    z,
    size: 0.5 + rand() * 2.6,
    twinkle: 0.25 + rand() * 0.75,
    hueShift: -0.08 + rand() * 0.22,
  };
}

export const MATHEMATICAL_PLANES: MathematicalPlane[] = [
  "cartesian_xz",
  "cartesian_xy",
  "spherical_near",
  "spherical_mid",
  "spherical_deep",
];

export default {
  generateStar,
  MATHEMATICAL_PLANES,
};
