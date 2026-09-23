import { forwardRef, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { LIGHT_BLENDING } from "./blending";

// Emblema Medic-KG en 2.5D.
// El logo original (PNG) se usa tal cual como cara frontal con toneMapped=false,
// así sus colores y tipografía no se alteran. La profundidad la aportan capas
// reales: canto metálico, bisel, tapa trasera y un brillo especular que se
// desplaza con la rotación. La rotación está limitada desde la escena, de modo
// que nunca se ve el reverso ni se pierde legibilidad (no hay giro de 360°).

export const EMBLEM_THICKNESS = 0.16;

function configureTexture(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
}

const sheenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sheenFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uYaw;
  uniform float uPitch;
  uniform float uIntensity;
  void main() {
    vec2 p = vUv - 0.5;
    float d = dot(p, normalize(vec2(1.0, 0.62)));
    float off = -uYaw * 0.95 + uPitch * 0.6 - 0.2;
    float band  = exp(-pow((d - off) * 6.5, 2.0));
    float band2 = exp(-pow((d - off - 0.17) * 20.0, 2.0)) * 0.55;
    float edge  = smoothstep(0.5, 0.42, length(p));
    gl_FragColor = vec4(vec3(0.78, 0.9, 1.0), (band + band2) * uIntensity * edge);
  }
`;

const Emblem = forwardRef(function Emblem({ src, sheenRef }, ref) {
  const tex = useTexture(src, configureTexture);

  const sheenUniforms = useMemo(() => ({
    uYaw: { value: 0 }, uPitch: { value: 0 }, uIntensity: { value: 0.14 },
  }), []);

  const T = EMBLEM_THICKNESS;

  return (
    <group ref={ref}>
      {/* Tapa trasera */}
      <mesh position-z={-T / 2} rotation-y={Math.PI}>
        <circleGeometry args={[1, 96]} />
        <meshStandardMaterial color="#0a1b3d" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Canto metálico (cilindro abierto orientado al eje Z) */}
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[1, 1, T, 128, 1, true]} />
        <meshStandardMaterial color="#c9d6e8" metalness={1} roughness={0.28} envMapIntensity={2.6} />
      </mesh>

      {/* Bisel frontal: aro plateado que atrapa los reflejos */}
      <mesh position-z={T / 2}>
        <torusGeometry args={[1, 0.02, 16, 160]} />
        <meshStandardMaterial color="#eef4fb" metalness={1} roughness={0.12} envMapIntensity={2} />
      </mesh>

      {/* Base azul marino bajo el logo (cubre la transparencia del borde del PNG) */}
      <mesh position-z={T / 2 + 0.001}>
        <circleGeometry args={[0.995, 96]} />
        <meshBasicMaterial color="#0b1d40" toneMapped={false} />
      </mesh>

      {/* Logo original, sin modificar */}
      <mesh position-z={T / 2 + 0.003}>
        <circleGeometry args={[0.995, 128]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>

      {/* Brillo especular sutil que se mueve con la rotación */}
      <mesh position-z={T / 2 + 0.005}>
        <circleGeometry args={[0.99, 96]} />
        <shaderMaterial
          ref={sheenRef}
          vertexShader={sheenVertex}
          fragmentShader={sheenFragment}
          uniforms={sheenUniforms}
          transparent
          depthWrite={false}
          {...LIGHT_BLENDING}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
});

export default Emblem;
