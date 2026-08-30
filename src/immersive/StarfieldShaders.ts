/**
 * Starfield3D shader pair — sovereign, non-copyrightable mathematical shaders.
 * Produces additive, twinkling point-sprites with platinum-gold hue shift.
 */

export const starVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aTwinkle;
  attribute float aHue;

  uniform float uPointScale;
  uniform float uTime;
  uniform float uMotion;

  varying float vTwinkle;
  varying float vHue;
  varying float vDepth;

  void main() {
    vec3 p = position;

    // Gentle parallax drift (sovereign motion, no external data dependencies)
    p.x += sin(uTime * 0.05 + position.y * 0.004) * 1.6 * uMotion;
    p.y += cos(uTime * 0.04 + position.z * 0.003) * 1.2 * uMotion;
    p.z += sin(uTime * 0.03 + position.x * 0.005) * 1.0 * uMotion;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    // Perspective-correct point sprite sizing
    gl_PointSize = aSize * uPointScale * (1.0 / max(0.4, -mv.z));

    vTwinkle = aTwinkle;
    vHue = aHue;
    vDepth = clamp(1.0 - (-mv.z) / 2200.0, 0.0, 1.0);
  }
`;

export const starFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uStarColor;

  varying float vTwinkle;
  varying float vHue;
  varying float vDepth;

  // Hue-shift helper (low-cost) — keeps fragment shader sovereign
  vec3 hueShift(vec3 c, float h) {
    float k = 0.6;
    float t = h * 6.28318530718;
    vec3 m = vec3(
      cos(t),
      cos(t - 2.09439510239),
      cos(t + 2.09439510239)
    );
    return mix(c, m * 0.5 + 0.5, k * clamp(vHue * 3.0, 0.0, 1.0) * 0.35);
  }

  void main() {
    vec2 uv = gl_PointCoord.xy - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float core = smoothstep(0.5, 0.0, d);
    float falloff = pow(core, 2.2);

    float tw = 0.55 + 0.45 * sin(uTime * (1.4 + vTwinkle * 3.2));
    float alpha = falloff * tw * (0.45 + 0.55 * vDepth);

    // Colour: base platinum with occasional gold hue-shift on deep stars
    vec3 col = mix(uStarColor, vec3(1.0, 0.88, 0.62), smoothstep(0.08, 0.22, vHue) * (1.0 - vDepth) * 0.72);
    col = hueShift(col, vHue);

    // Additive bloom core (keeps alpha under 1.0 but feels brighter)
    col += vec3(1.0, 0.96, 0.86) * pow(core, 7.0) * 0.35 * tw;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

export default {
  starVertexShader,
  starFragmentShader,
};
