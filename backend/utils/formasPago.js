/**
 * Formas de pago de los planes Semestral y Anual. El plan es el compromiso
 * (6 o 12 meses); la forma de pago dice en cuántas partes se paga.
 *   contado    → un solo pago al inicio
 *   dos_pagos  → 2 pagos (semestral: hoy y a los 3 meses; anual: hoy y a los 6) — junto con
 *                contado, es lo que se ofrece hoy; las demás quedan para clínicas que ya las tienen
 *   trimestral → cada 3 meses
 *   bimestral  → cada 2 meses
 *   mensual    → cada mes
 * El recargo por pagar en partes (porcentaje sobre el precio del plan) se
 * configura en config_pagos (recargo_<forma>_pct); sin valor, no hay recargo.
 */
const FORMAS = {
  contado: { label: "Un solo pago", cada: null },
  // 2 pagos: semestral → hoy y a los 3 meses; anual → hoy y a los 6 meses
  dos_pagos: { label: "2 pagos", cada: null, partes: 2 },
  trimestral: { label: "Cada 3 meses", cada: 3 },
  bimestral: { label: "Cada 2 meses", cada: 2 },
  mensual: { label: "Mes a mes", cada: 1 },
};
const FORMAS_VALIDAS = Object.keys(FORMAS);
/** Las que se ofrecen hoy (las demás siguen funcionando para clínicas que ya las tienen). */
const FORMAS_OFRECIDAS = ["contado", "dos_pagos"];
const MESES_PLAN = { semestral: 6, anual: 12 };

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const formaValida = (f) => (FORMAS_VALIDAS.includes(f) ? f : null);

/** Número de pagos de un plan según la forma de pago. */
function numeroPagos(plan, forma) {
  const meses = MESES_PLAN[plan] || 0;
  if (!meses) return 0;
  if (FORMAS[forma]?.partes) return FORMAS[forma].partes;
  const cada = FORMAS[forma]?.cada;
  return cada ? Math.ceil(meses / cada) : 1;
}

/** Cada cuántos meses se paga (2 pagos de un semestral = cada 3 meses). */
function mesesPorPago(forma, mesesPlan) {
  const f = FORMAS[forma];
  if (!f) return null;
  if (f.partes) return Math.ceil(mesesPlan / f.partes);
  return f.cada;
}

/** Total del plan con el recargo de la forma de pago, y el monto de cada pago. */
function montoPorForma(precioPlan, plan, forma, config = {}) {
  const precio = Number(precioPlan);
  if (!(precio > 0)) return null;
  const f = formaValida(forma) || "contado";
  const pct = f === "contado" ? 0 : Number(config?.[`recargo_${f}_pct`]) || 0;
  const total = r2(precio * (1 + pct / 100));
  const pagos = numeroPagos(plan, f) || 1;
  return { forma: f, total, pagos, porPago: r2(total / pagos), recargoPct: pct };
}

/** Columnas de recargo en config_pagos (aditivas, opcionales). */
let recargosOk = false;
async function asegurarRecargos(pool) {
  if (recargosOk) return;
  const [cols] = await pool.query("SHOW COLUMNS FROM config_pagos");
  for (const f of ["dos_pagos", "trimestral", "bimestral", "mensual"]) {
    if (!cols.some((c) => c.Field === `recargo_${f}_pct`)) {
      await pool.query(`ALTER TABLE config_pagos ADD COLUMN recargo_${f}_pct DECIMAL(5,2) NULL`);
    }
  }
  recargosOk = true;
}

module.exports = { FORMAS, FORMAS_VALIDAS, FORMAS_OFRECIDAS, mesesPorPago, MESES_PLAN, formaValida, numeroPagos, montoPorForma, asegurarRecargos };
