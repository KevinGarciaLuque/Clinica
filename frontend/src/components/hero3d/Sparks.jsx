import { forwardRef, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { LIGHT_BLENDING } from "./blending";
import { mulberry32 } from "./random";

// Partículas brillantes + destellos en estrella. Toda la animación vive en el
// shader (GPU): el CPU sólo actualiza 5 uniforms por frame, así que escala a
// cientos de puntos sin coste apreciable. Un solo draw call.

const vertexShader = /* glsl */ `
  attribute vec3 aDir;
  attribute float aDist;
  attribute float aSeed;
  attribute float aSize;
  attribute float aStar;
  uniform float uTime;
  uniform float uBoom;
  uniform float uSize;
  uniform float uStill;
  uniform vec2 uParallax;
  varying float vAlpha;
  varying float vStar;
  varying float vHot;

  void main() {
    float t = max(uBoom, 0.0);
    float k = 1.0 - exp(-t * (1.5 + aSeed * 2.6));
    vec3 pos = vec3(aDir.xy * 0.85, -0.2) + aDir * aDist * k;
    pos.x *= 1.3;
    pos.y *= pos.y < 0.0 ? 0.8 : 0.9;
    float drift = (1.0 - uStill) * k;
    pos += vec3(
      sin(uTime * 0.31 + aSeed * 40.0),
      cos(uTime * 0.27 + aSeed * 23.0),
      sin(uTime * 0.20 + aSeed * 11.0)
    ) * 0.08 * drift;
    float depth = clamp((pos.z + 2.5) / 5.0, 0.0, 1.0);
    pos.xy += uParallax * (0.04 + depth * 0.45);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float alive = step(0.0, uBoom);
    float burst = exp(-t * 2.2) * (1.0 - uStill);
    float tw = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed * 3.0) + aSeed * 60.0);
    tw = mix(tw, 0.8, uStill);
    if (aStar > 0.5) {
      float glint = pow(max(sin(uTime * (0.35 + aSeed * 0.5) + aSeed * 90.0), 0.0), 18.0);
      glint = mix(glint, 0.35, uStill);
      vAlpha = alive * max(glint, burst * 1.2);
    } else {
      vAlpha = alive * tw * (0.55 + burst * 1.6);
    }
    vStar = aStar;
    vHot = burst;
    gl_PointSize = aSize * uSize * (1.0 + burst * 1.2) / -mv.z * alive;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vStar;
  varying float vHot;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d2 = dot(p, p);
    float glow = exp(-d2 * 22.0);
    float core = exp(-d2 * 160.0);
    float a;
    if (vStar > 0.5) {
      float cr = exp(-abs(p.x) * 70.0) * exp(-abs(p.y) * 4.5)
               + exp(-abs(p.y) * 70.0) * exp(-abs(p.x) * 4.5);
      a = cr + glow * 0.35 + core;
    } else {
      a = glow * 0.55 + core;
    }
    vec3 col = mix(uColor, vec3(1.0), clamp(core + vHot * 0.5, 0.0, 1.0));
    float alpha = a * vAlpha;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

function buildSparks(count, seed) {
  const rand = mulberry32(seed);
  const dir = new Float32Array(count * 3);
  const dist = new Float32Array(count);
  const s = new Float32Array(count);
  const size = new Float32Array(count);
  const star = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const th = rand() * Math.PI * 2;
    const dz = -0.7 + rand() * 1.3;
    const rr = Math.sqrt(1 - dz * dz);
    dir.set([Math.cos(th) * rr, Math.sin(th) * rr, dz], i * 3);
    dist[i] = 0.6 + Math.pow(rand(), 1.3) * 5.0;
    s[i] = rand();
    const isStar = rand() < 0.035;
    star[i] = isStar ? 1 : 0;
    size[i] = isStar ? 0.45 + rand() * 0.4 : 0.05 + Math.pow(rand(), 2) * 0.12;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
  g.setAttribute("aDist", new THREE.BufferAttribute(dist, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(s, 1));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  g.setAttribute("aStar", new THREE.BufferAttribute(star, 1));
  return g;
}

const Sparks = forwardRef(function Sparks({ count }, ref) {
  const geometry = useMemo(() => buildSparks(count, 7), [count]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBoom: { value: -1 },
    uSize: { value: 100 },
    uStill: { value: 0 },
    uParallax: { value: new THREE.Vector2() },
    uColor: { value: new THREE.Color("#4aa8ff") },
  }), []);

  return (
    <points geometry={geometry} frustumCulled={false}>
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
    </points>
  );
});

export default Sparks;
