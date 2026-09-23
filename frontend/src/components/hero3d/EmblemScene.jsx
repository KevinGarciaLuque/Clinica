import { Suspense, useLayoutEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import gsap from "gsap";
import Emblem from "./Emblem";
import CrystalShards from "./CrystalShards";
import Sparks from "./Sparks";
import EnergyWave from "./EnergyWave";
import { TIER_BUDGET } from "./capabilities";

// Límites de giro: suficientes para percibir volumen, nunca tanto como para
// perder la legibilidad del logo.
const YAW_MAX   = 0.52; // ~30°
const PITCH_MAX = 0.17; // ~10°
// Muelle amortiguado (inercia): rigidez y fricción
const SPRING_K = 38;
const SPRING_C = 9.5;

const FOV = 35;

function SceneContents({ stage, budget, logoSrc, onReady, registerInvalidate }) {
  const { invalidate } = useThree();
  const root = useRef();
  const emblem = useRef();
  const shardsGroup = useRef();
  const keyLight = useRef();
  const sheen = useRef();
  const wave = useRef();
  const sparks = useRef();

  const { reduced } = stage.current;

  // Estado mutable de animación (lo anima GSAP y lo lee el bucle de render)
  const animRef = useRef({
    boomAt: Infinity, boomPending: false, intro: 0, glow: 0, flash: 0, wave: 0, wave2: 0, rays: 0, recoil: 0,
    still: reduced,
  });
  // Estado del puntero con inercia
  const motionRef = useRef({ yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, px: 0, py: 0 });

  useLayoutEffect(() => {
    const anim = animRef.current;
    registerInvalidate?.(invalidate);
    if (reduced) {
      // Sin animación: composición final estática
      Object.assign(anim, { boomAt: -1000, intro: 1, glow: 1, rays: 1 });
      onReady?.();
      invalidate();
      return;
    }
    const tl = gsap.timeline({ delay: 0.2, onStart: () => onReady?.() });
    tl.to(anim, { intro: 1, duration: 1.2, ease: "power3.out" }, 0)
      .to(anim, { glow: 0.55, duration: 0.6, ease: "sine.out" }, 0.1)
      .to(anim, { flash: 1, duration: 0.08, ease: "none" }, 0.72)
      .add(() => { anim.boomPending = true; }, 0.75)
      .fromTo(anim, { wave: 0 }, { wave: 1, duration: 1.7, ease: "power2.out" }, 0.74)
      .fromTo(anim, { wave2: 0 }, { wave2: 1, duration: 2.2, ease: "power2.out" }, 0.92)
      .to(anim, { recoil: 1, duration: 0.12, ease: "power2.out" }, 0.75)
      .to(anim, { recoil: 0, duration: 1.2, ease: "elastic.out(1, 0.45)" }, 0.87)
      .to(anim, { flash: 0, duration: 0.8, ease: "power2.out" }, 0.8)
      .to(anim, { glow: 1, duration: 1.2, ease: "sine.inOut" }, 0.9)
      .to(anim, { rays: 1, duration: 2.2, ease: "sine.inOut" }, 1.1);
    return () => tl.kill();
  }, [reduced, invalidate, onReady, registerInvalidate]);

  useFrame((state, rawDt) => {
    const anim = animRef.current;
    const motion = motionRef.current;
    const dt = Math.min(rawDt, 1 / 30);
    const t = state.clock.elapsedTime;
    // La detonación se fija en el reloj de la escena en el primer frame tras pedirla
    if (anim.boomPending) { anim.boomAt = t; anim.boomPending = false; }
    const { size, viewport } = state;
    const L = stage.current.layout;

    // 1) Colocar y escalar el emblema sobre el "slot" medido en el DOM
    const ppu = size.height / viewport.height; // px por unidad en z=0
    const s = L && L.d ? (L.d / 2) / ppu : Math.min(viewport.height * 0.2, viewport.width * 0.28);
    const cx = L && L.d ? (L.cx - size.width / 2) / ppu : 0;
    const cy = L && L.d ? -(L.cy - size.height / 2) / ppu : 0;
    const r = root.current;
    r.position.set(cx, cy, 0);
    r.scale.setScalar(s);

    // 2) Objetivo de rotación: mouse/lápiz, o un toque reciente en el emblema (táctil),
    // o movimiento ambiental cuando no hay ninguna interacción
    let tx = 0, ty = 0;
    if (!reduced) {
      if (stage.current.finePointer || stage.current.touchActive) {
        tx = stage.current.pointer.x;
        ty = stage.current.pointer.y;
      } else {
        tx = Math.sin(t * 0.33) * 0.55 + Math.sin(t * 0.71) * 0.12;
        ty = Math.sin(t * 0.27) * 0.45;
      }
    }
    const targetYaw = tx * YAW_MAX;
    const targetPitch = ty * PITCH_MAX; // el emblema "mira" hacia el cursor

    // Muelle con inercia: al detenerse el cursor, el emblema se asienta y para
    motion.vYaw += (targetYaw - motion.yaw) * SPRING_K * dt;
    motion.vYaw *= Math.exp(-SPRING_C * dt);
    motion.yaw += motion.vYaw * dt;
    motion.vPitch += (targetPitch - motion.pitch) * SPRING_K * dt;
    motion.vPitch *= Math.exp(-SPRING_C * dt);
    motion.pitch += motion.vPitch * dt;

    const pl = 1 - Math.exp(-4 * dt);
    motion.px += (tx - motion.px) * pl;
    motion.py += (ty - motion.py) * pl;

    // 3) Emblema: rotación limitada, entrada, retroceso de la explosión y flotación
    const e = emblem.current;
    const bob = anim.still ? 0 : Math.sin(t * 0.9) * 0.025;
    e.rotation.set(motion.pitch + anim.recoil * 0.08, motion.yaw, 0);
    e.position.set(0, bob, -anim.recoil * 0.22);
    e.scale.setScalar(0.86 + 0.14 * anim.intro);

    // Los cristales acompañan el giro con menos amplitud (profundidad)
    shardsGroup.current.rotation.set(motion.pitch * 0.35, motion.yaw * 0.35, 0);

    // Luz principal sigue al puntero: los reflejos recorren metal y cristal
    keyLight.current.position.set(motion.px * 4 + 1.5, -motion.py * 3 + 2.5, 4);

    // 4) Uniforms de shaders
    if (sheen.current) {
      sheen.current.uniforms.uYaw.value = motion.yaw;
      sheen.current.uniforms.uPitch.value = motion.pitch;
    }
    if (wave.current) {
      const u = wave.current.uniforms;
      u.uTime.value = anim.still ? 0 : t;
      u.uWave.value = anim.wave;
      u.uWave2.value = anim.wave2;
      u.uGlow.value = anim.glow;
      u.uFlash.value = anim.flash;
      u.uRays.value = anim.rays;
    }
    if (sparks.current) {
      const u = sparks.current.uniforms;
      const K = size.height / (2 * Math.tan((FOV * Math.PI) / 360));
      u.uTime.value = anim.still ? 0 : t;
      u.uBoom.value = Number.isFinite(anim.boomAt) ? t - anim.boomAt : -1;
      u.uSize.value = s * K * viewport.dpr;
      u.uStill.value = anim.still ? 1 : 0;
      u.uParallax.value.set(-motion.px, motion.py);
    }
  });

  return (
    <>
      <ambientLight intensity={0.35} color="#9cc4ff" />
      <directionalLight ref={keyLight} intensity={2.2} color="#dbeaff" position={[2, 3, 4]} />
      <pointLight position={[0, 0, -2]} intensity={30} distance={10} color="#2f8bff" />

      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 4, 3]} scale={[10, 1, 1]} />
        <Lightformer form="ring" intensity={4} color="#3aa0ff" position={[-5, 0, 2]} scale={3} />
        <Lightformer form="rect" intensity={2.5} color="#1d6bff" position={[5, -1, 3]} scale={[1, 7, 1]} />
        <Lightformer form="circle" intensity={2} color="#9fd4ff" position={[0, 0, -6]} scale={5} />
      </Environment>

      <group ref={root}>
        <EnergyWave ref={wave} />
        <group ref={shardsGroup}>
          <CrystalShards count={budget.shards} iridescence={budget.iridescence} animRef={animRef} motionRef={motionRef} />
          <Sparks ref={sparks} count={budget.sparks} />
        </group>
        <Emblem ref={emblem} sheenRef={sheen} src={logoSrc} />
      </group>
    </>
  );
}

export default function EmblemScene({ stage, tier, active, logoSrc, onReady, registerInvalidate }) {
  const budget = TIER_BUDGET[tier] || TIER_BUDGET.mid;
  const dprMax = Math.min(window.devicePixelRatio || 1, budget.dpr);
  const [dpr, setDpr] = useState(dprMax);
  const reduced = stage.current.reduced;

  return (
    <Canvas
      className="mkg-hero__canvas"
      dpr={dpr}
      frameloop={reduced ? "demand" : active ? "always" : "never"}
      camera={{ fov: FOV, position: [0, 0, 7], near: 0.1, far: 60 }}
      gl={{ antialias: tier !== "low", alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      aria-hidden="true"
    >
      {!reduced && (
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setDpr((d) => Math.max(1, d - 0.5))}
          onIncline={() => setDpr((d) => Math.min(dprMax, d + 0.25))}
        />
      )}
      <Suspense fallback={null}>
        <SceneContents stage={stage} budget={budget} logoSrc={logoSrc} onReady={onReady} registerInvalidate={registerInvalidate} />
      </Suspense>
    </Canvas>
  );
}
