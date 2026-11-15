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

// Formas de pago de los planes Semestral y Anual (el plan es el compromiso;
// la forma de pago dice en cuántas partes se paga).
export const FORMAS_PAGO = {
  contado:    { label: "Un solo pago",   cada: null, corto: "Pago único" },
  dos_pagos:  { label: "2 pagos",        cada: null, partes: 2, corto: "2 pagos" },
  trimestral: { label: "Cada 3 meses",   cada: 3,    corto: "Trimestral" },
  bimestral:  { label: "Cada 2 meses",   cada: 2,    corto: "Bimestral" },
  mensual:    { label: "Mes a mes",      cada: 1,    corto: "Mensual" },
};

// Las que se ofrecen hoy; las demás siguen funcionando para clínicas que ya las tienen.
export const FORMAS_OFRECIDAS = ["contado", "dos_pagos"];
export const formasOfrecidas = () => FORMAS_OFRECIDAS.map((k) => [k, FORMAS_PAGO[k]]);

/** Cada cuántos meses se paga (2 pagos de un semestral = cada 3 meses). */
export function mesesPorPago(duracion, forma) {
  const meses = duracion === "anual" ? 12 : 6;
  const f = FORMAS_PAGO[forma];
  if (!f) return null;
  return f.partes ? Math.ceil(meses / f.partes) : f.cada;
}

export function numeroPagos(duracion, forma) {
  const meses = duracion === "anual" ? 12 : duracion === "semestral" ? 6 : 0;
  if (!meses) return 0;
  if (FORMAS_PAGO[forma]?.partes) return FORMAS_PAGO[forma].partes;
  const cada = FORMAS_PAGO[forma]?.cada;
  return cada ? Math.ceil(meses / cada) : 1;
}

/** Total del plan con el recargo de la forma de pago y monto de cada pago. */
export function montoPorForma(precioPlan, duracion, forma, config = {}) {
  const precio = Number(precioPlan);
  if (!(precio > 0)) return null;
  const f = FORMAS_PAGO[forma] ? forma : "contado";
  const pct = f === "contado" ? 0 : Number(config?.[`recargo_${f}_pct`]) || 0;
  const total = Math.round(precio * (1 + pct / 100) * 100) / 100;
  const pagos = numeroPagos(duracion, f) || 1;
  return { forma: f, total, pagos, porPago: Math.round((total / pagos) * 100) / 100, recargoPct: pct };
}
