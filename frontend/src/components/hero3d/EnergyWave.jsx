import { forwardRef, useMemo } from "react";
import { LIGHT_BLENDING } from "./blending";

// Plano detrás del emblema: halo azul permanente, rayos de luz cinematográficos
// muy tenues, destello inicial y dos ondas de energía expansivas (la detonación).

const SIZE = 16;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uWave;
  uniform float uWave2;
  uniform float uGlow;
  uniform float uFlash;
  uniform float uRays;

  float ring(float r, float R, float w) { return exp(-pow((r - R) / w, 2.0)); }

  void main() {
    vec2 p = (vUv - 0.5) * ${SIZE.toFixed(1)};
    float r = length(p);
    vec3 blue = vec3(0.10, 0.48, 1.0);
    vec3 ice  = vec3(0.72, 0.9, 1.0);

    float w1 = ring(r, mix(0.95, 7.5, uWave),  mix(0.05, 0.9, uWave))  * pow(1.0 - uWave, 1.4)  * step(0.001, uWave);
    float w2 = ring(r, mix(0.95, 6.5, uWave2), mix(0.04, 0.7, uWave2)) * pow(1.0 - uWave2, 1.6) * step(0.001, uWave2);

    float halo  = exp(-max(r - 0.95, 0.0) * 1.9) * uGlow * (0.92 + 0.08 * sin(uTime * 1.2));
    float flash = exp(-r * r * 0.3) * uFlash;

    float ang  = atan(p.y, p.x);
    float rays = pow(abs(sin(ang * 7.0 + uTime * 0.04)), 60.0)
               + pow(abs(sin(ang * 11.0 - uTime * 0.03 + 1.3)), 90.0) * 0.7;
    rays *= exp(-max(r - 1.0, 0.0) * 0.45) * smoothstep(0.9, 1.4, r) * uRays;

    vec3 col = blue * (halo * 0.55 + rays * 0.16)
             + mix(blue, ice, 0.6) * w1 * 1.5
             + blue * w2 * 0.9
             + ice * flash * 1.4;
    col *= smoothstep(8.0, 5.0, r);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const EnergyWave = forwardRef(function EnergyWave(_, ref) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uWave: { value: 0 }, uWave2: { value: 0 },
    uGlow: { value: 0 }, uFlash: { value: 0 }, uRays: { value: 0 },
  }), []);
  return (
    <mesh position-z={-0.35} renderOrder={-1}>
      <planeGeometry args={[SIZE, SIZE]} />
      <shaderMaterial
        ref={ref}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        {...LIGHT_BLENDING}
        toneMapped={false}
      />
    </mesh>
  );
});

export default EnergyWave;
