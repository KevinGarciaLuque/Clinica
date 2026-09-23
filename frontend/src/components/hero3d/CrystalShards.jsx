import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "./random";

// Fragmentos de cristal translúcido con InstancedMesh (1 draw call por variante).
// Cinemática por instancia calculada en CPU: salen desde detrás del canto del
// emblema, se expanden con desaceleración exponencial y quedan suspendidos
// flotando. El parallax depende de la profundidad final de cada fragmento.

function buildShardGeometry(rand, sides) {
  const r = (a, b) => a + rand() * (b - a);
  const top = new THREE.Vector3(r(-0.1, 0.1), 1, r(-0.05, 0.05));
  const bot = new THREE.Vector3(r(-0.18, 0.18), -r(0.45, 0.9), r(-0.05, 0.05));
  const ring = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2 + r(-0.35, 0.35);
    const rad = r(0.2, 0.42);
    ring.push(new THREE.Vector3(Math.cos(a) * rad, r(-0.18, 0.22), Math.sin(a) * rad * 0.45));
  }
  const pos = [];
  for (let k = 0; k < sides; k++) {
    const a = ring[k], b = ring[(k + 1) % sides];
    pos.push(top.x, top.y, top.z, a.x, a.y, a.z, b.x, b.y, b.z);
    pos.push(bot.x, bot.y, bot.z, b.x, b.y, b.z, a.x, a.y, a.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function createCrystalMaterial(iridescence) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    metalness: 0.05,
    roughness: 0.06,
    transparent: true,
    opacity: 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.6,
    flatShading: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    iridescence: iridescence ? 0.65 : 0,
    iridescenceIOR: 1.35,
  });
  // Borde tipo Fresnel: los cantos del cristal brillan en azul eléctrico
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float mkgFres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.2);
         totalEmissiveRadiance += vec3(0.22, 0.58, 1.0) * mkgFres * 1.35;`
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
         gl_FragColor.a = clamp(gl_FragColor.a + mkgFres * 0.55, 0.0, 1.0);`
      );
  };
  return mat;
}

const PALETTE = ["#ffffff", "#d6ebff", "#a9d4ff", "#7fbfff"].map((c) => new THREE.Color(c));

function buildInstances(count, seed) {
  const rand = mulberry32(seed);
  const r = (a, b) => a + rand() * (b - a);
  const d = {
    start: new Float32Array(count * 3),
    end:   new Float32Array(count * 3),
    rot:   new Float32Array(count * 3),
    spin:  new Float32Array(count * 3),
    scale: new Float32Array(count * 3),
    delay: new Float32Array(count),
    k:     new Float32Array(count),
    phase: new Float32Array(count),
    par:   new Float32Array(count),
    color: [],
  };
  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2;
    const dz    = r(-0.6, 0.32);
    const dist  = 1.4 + Math.pow(rand(), 1.5) * 3.1;
    const rxy   = Math.max(dist * Math.sqrt(1 - dz * dz), 1.32);
    const ex = Math.cos(theta) * rxy * 1.3;
    const ey = Math.sin(theta) * rxy * (Math.sin(theta) < 0 ? 0.78 : 0.9);
    const ez = dz * dist;
    d.end.set([ex, ey, ez], i * 3);
    d.start.set([Math.cos(theta) * 0.82, Math.sin(theta) * 0.82, -0.25], i * 3);
    d.rot.set([r(0, 6.28), r(0, 6.28), r(0, 6.28)], i * 3);
    d.spin.set([r(-1, 1), r(-1, 1), r(-1, 1)], i * 3);
    const long = 0.06 + Math.pow(rand(), 2.4) * 0.24;
    const w = r(0.7, 1.25);
    d.scale.set([long * w, long, long * w], i * 3);
    d.delay[i] = rand() * 0.1 + (dist - 1.4) * 0.018;
    d.k[i]     = r(2.1, 3.9);
    d.phase[i] = rand() * 100;
    d.par[i]   = 0.05 + THREE.MathUtils.clamp((ez + 2) / 3.4, 0, 1) * 0.32;
    d.color.push(PALETTE[Math.floor(rand() * PALETTE.length)]);
  }
  return d;
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();

function ShardLayer({ count, seed, sides, material, animRef, motionRef }) {
  const mesh = useRef();
  const geometry = useMemo(() => buildShardGeometry(mulberry32(seed * 7 + 1), sides), [seed, sides]);
  const data = useMemo(() => buildInstances(count, seed), [count, seed]);

  useLayoutEffect(() => {
    const m = mesh.current;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < count; i++) {
      m.setMatrixAt(i, _m);
      m.setColorAt(i, data.color[i]);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count, data]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const anim = animRef.current, motion = motionRef.current;
    const t  = state.clock.elapsedTime;
    const tb = t - anim.boomAt;
    const px = motion.px, py = motion.py;
    const { start, end, rot, spin, scale, delay, k, phase, par } = data;

    for (let i = 0; i < count; i++) {
      const local = tb - delay[i];
      if (!(local > 0)) { _m.makeScale(0, 0, 0); m.setMatrixAt(i, _m); continue; }
      const i3 = i * 3;
      const e  = 1 - Math.exp(-k[i] * local);
      const ph = phase[i];
      const fl = anim.still ? 0 : e;
      _p.set(
        start[i3]     + (end[i3]     - start[i3])     * e + Math.cos(t * 0.37 + ph) * 0.045 * fl - px * par[i],
        start[i3 + 1] + (end[i3 + 1] - start[i3 + 1]) * e + Math.sin(t * 0.52 + ph) * 0.06  * fl + py * par[i],
        start[i3 + 2] + (end[i3 + 2] - start[i3 + 2]) * e
      );
      // Giro rápido al salir que decae a una deriva lenta
      const burst = anim.still ? 1.6 : ((1 - Math.exp(-2.4 * local)) / 2.4) * 5 + t * 0.07;
      _e.set(rot[i3] + spin[i3] * burst, rot[i3 + 1] + spin[i3 + 1] * burst, rot[i3 + 2] + spin[i3 + 2] * burst);
      _q.setFromEuler(_e);
      const g = 0.25 + 0.75 * Math.min(1, e * 1.6);
      _s.set(scale[i3] * g, scale[i3 + 1] * g, scale[i3 + 2] * g);
      _m.compose(_p, _q, _s);
      m.setMatrixAt(i, _m);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />;
}

export default function CrystalShards({ count, iridescence, animRef, motionRef }) {
  const material = useMemo(() => createCrystalMaterial(iridescence), [iridescence]);
  useLayoutEffect(() => () => material.dispose(), [material]);
  const a = Math.ceil(count * 0.6);
  return (
    <group>
      <ShardLayer count={a}         seed={11} sides={4} material={material} animRef={animRef} motionRef={motionRef} />
      <ShardLayer count={count - a} seed={29} sides={5} material={material} animRef={animRef} motionRef={motionRef} />
    </group>
  );
}
