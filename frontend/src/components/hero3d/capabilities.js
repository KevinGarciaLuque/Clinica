// Detección de capacidades del dispositivo para el hero 3D.
// Se ejecuta una sola vez al montar: decide si hay WebGL, si el usuario pidió
// menos movimiento, si hay un puntero fino (mouse) y qué presupuesto de
// partículas puede sostener el equipo.

const mm = (q) => {
  try { return window.matchMedia(q).matches; } catch { return false; }
};

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    // Liberar el contexto de prueba para no ocupar uno de los pocos que permite el navegador
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export const TIER_BUDGET = {
  high: { shards: 170, sparks: 900, dpr: 2,   iridescence: true  },
  mid:  { shards: 100, sparks: 480, dpr: 2,   iridescence: false },
  low:  { shards: 55,  sparks: 220, dpr: 1.5, iridescence: false },
};

export function detectCapabilities() {
  if (typeof window === "undefined") {
    return { webgl: false, reduced: true, finePointer: false, tier: "low" };
  }
  const reduced     = mm("(prefers-reduced-motion: reduce)");
  const finePointer = mm("(hover: hover) and (pointer: fine)");
  const webgl       = hasWebGL();

  const cores    = navigator.hardwareConcurrency || 4;
  const memory   = navigator.deviceMemory || 4;
  const saveData = !!navigator.connection?.saveData;
  const small    = Math.min(window.innerWidth, window.innerHeight) < 600;

  let tier = "high";
  if (saveData || cores <= 2 || memory <= 2) tier = "low";
  else if (cores <= 4 || !finePointer || small) tier = "mid";

  return { webgl, reduced, finePointer, tier };
}
