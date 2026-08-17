// Niveles de plan (tier) y duraciones de pago, usados en la solicitud pública
// de plan y en el panel del SUPER_ADMIN.

export const NIVELES_PLAN = {
  basico:      { label: "Básico" },
  avanzado:    { label: "Avanzado" },
  empresarial: { label: "Empresarial" },
};

export const DURACION_LABEL = {
  trial:     "Prueba (14 días)",
  semestral: "Semestral",
  anual:     "Anual",
};

// Duraciones disponibles según el nivel elegido: el Básico admite prueba
// gratuita o pago directo; Avanzado/Empresarial solo se pagan por período.
export function duracionesDisponibles(nivel) {
  return nivel === "basico" ? ["trial", "semestral", "anual"] : ["semestral", "anual"];
}

export function precioClave(nivel, duracion) {
  return `precio_${nivel}_${duracion}`;
}

export function planCompletoLabel(nivel, duracion) {
  const n = NIVELES_PLAN[nivel]?.label || nivel;
  if (duracion === "trial") return `${n} — Prueba gratis`;
  return `${n} — ${DURACION_LABEL[duracion]}`;
}
