import * as THREE from "three";

// Suma luz al color sin tocar el canal alfa del canvas. El canvas es
// transparente sobre el fondo CSS: con AdditiveBlending normal el alfa se
// acumularía y taparía el degradado azul con negro.
export const LIGHT_BLENDING = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};
