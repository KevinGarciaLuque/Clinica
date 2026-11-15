/**
 * Formas de pago de los planes Semestral y Anual. El plan es el compromiso
 * (6 o 12 meses); la forma de pago dice en cuántas partes se paga.
 *   contado    → un solo pago al inicio
 *   trimestral → cada 3 meses
 *   bimestral  → cada 2 meses
 *   mensual    → cada mes
 * El recargo por pagar en partes (porcentaje sobre el precio del plan) se
 * configura en config_pagos (recargo_<forma>_pct); sin valor, no hay recargo.
 */
const FORMAS = {
  contado: { label: "Un solo pago", cada: null },
  trimestral: { label: "Cada 3 meses", cada: 3 },
  bimestral: { label: "Cada 2 meses", cada: 2 },
  mensual: { label: "Mes a mes", cada: 1 },
};
const FORMAS_VALIDAS = Object.keys(FORMAS);
const MESES_PLAN = { semestral: 6, anual: 12 };

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const formaValida = (f) => (FORMAS_VALIDAS.includes(f) ? f : null);

/** Número de pagos de un plan según la forma de pago. */
function numeroPagos(plan, forma) {
  const meses = MESES_PLAN[plan] || 0;
  if (!meses) return 0;
  const cada = FORMAS[forma]?.cada;
  return cada ? Math.ceil(meses / cada) : 1;
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
  for (const f of ["trimestral", "bimestral", "mensual"]) {
    if (!cols.some((c) => c.Field === `recargo_${f}_pct`)) {
      await pool.query(`ALTER TABLE config_pagos ADD COLUMN recargo_${f}_pct DECIMAL(5,2) NULL`);
    }
  }
  recargosOk = true;
}

module.exports = { FORMAS, FORMAS_VALIDAS, MESES_PLAN, formaValida, numeroPagos, montoPorForma, asegurarRecargos };
