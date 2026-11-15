/**
 * routes/cobranza.js — Cobranza de licencias (solo SUPER_ADMIN). Montado en /api/cobranza
 *
 * Cuánto le toca pagar a cada clínica y cuánto se ha cobrado:
 *  - Las cuotas se calculan con el historial de licencias (monto mensual, inicio, fin y día
 *    de facturación): una cuota por cada mes de contrato cuya fecha de cobro ya llegó.
 *    Si dos registros cubren el mismo mes (una corrección), cuenta el más reciente.
 *  - Los pagos se registran aquí (tabla pagos_licencia) y se aplican a las cuotas
 *    más antiguas primero.
 *  - Saldo = cuotas vencidas − pagado (negativo = saldo a favor).
 */
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");
const { uploadComprobante } = require("../middlewares/upload");
const { enviarEmail } = require("../utils/mailer");
const { FORMAS, formaValida, asegurarRecargos } = require("../utils/formasPago");

const DIAS_GRACIA = 10; // después de esto la cuota se considera atrasada
const METODOS = ["TRANSFERENCIA", "DEPOSITO", "EFECTIVO", "TARJETA", "OTRO"];

let tablaOk = false;
async function asegurarTabla() {
  if (tablaOk) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pagos_licencia (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id  INT UNSIGNED NOT NULL,
      recibo_id   INT UNSIGNED NULL,
      periodo     CHAR(7)      NULL COMMENT 'YYYY-MM al que se quiso aplicar (informativo)',
      fecha       DATE         NOT NULL,
      monto       DECIMAL(12,2) NOT NULL,
      moneda      VARCHAR(8)   NOT NULL DEFAULT 'HNL',
      metodo      VARCHAR(30)  NULL,
      referencia  VARCHAR(120) NULL,
      notas       VARCHAR(300) NULL,
      anulado     TINYINT(1)   NOT NULL DEFAULT 0,
      anulado_en  DATETIME     NULL,
      creado_por  INT UNSIGNED NULL,
      creado_en   DATETIME     DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pl_clinica (clinica_id, fecha),
      INDEX idx_pl_fecha (fecha),
      FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Nivel del plan de la clínica (básico / avanzado / empresarial), opcional
  const [col] = await pool.query("SHOW COLUMNS FROM clinicas LIKE 'lic_nivel'");
  if (!col.length) await pool.query("ALTER TABLE clinicas ADD COLUMN lic_nivel VARCHAR(20) NULL");
  // Forma de pago: 'contado' (un solo pago por todo el plan) o 'mensual'
  const [colF] = await pool.query("SHOW COLUMNS FROM clinicas LIKE 'lic_forma_pago'");
  if (!colF.length) await pool.query("ALTER TABLE clinicas ADD COLUMN lic_forma_pago VARCHAR(12) NULL");
  // Columnas opcionales de pagos: tipo (pago / descuento), comprobante y envío del recibo
  const [colsP] = await pool.query("SHOW COLUMNS FROM pagos_licencia");
  const tiene = (c) => colsP.some((x) => x.Field === c);
  if (!tiene("tipo")) await pool.query("ALTER TABLE pagos_licencia ADD COLUMN tipo VARCHAR(12) NULL");
  if (!tiene("comprobante")) await pool.query("ALTER TABLE pagos_licencia ADD COLUMN comprobante LONGBLOB NULL");
  if (!tiene("comprobante_tipo")) await pool.query("ALTER TABLE pagos_licencia ADD COLUMN comprobante_tipo VARCHAR(60) NULL");
  if (!tiene("comprobante_nombre")) await pool.query("ALTER TABLE pagos_licencia ADD COLUMN comprobante_nombre VARCHAR(160) NULL");
  if (!tiene("recibo_enviado_en")) await pool.query("ALTER TABLE pagos_licencia ADD COLUMN recibo_enviado_en DATETIME NULL");
  if (!tiene("comprobante_url")) await pool.query("ALTER TABLE pagos_licencia ADD COLUMN comprobante_url VARCHAR(500) NULL");
  tablaOk = true;
}

const NIVELES = ["basico", "avanzado", "empresarial"];
/** Lista de precios (Página Pública → precios): total por periodo según nivel y plan. */
async function listaPrecios() {
  await asegurarRecargos(pool).catch(() => {});
  const [[row]] = await pool.query("SELECT * FROM config_pagos WHERE id=1 LIMIT 1").catch(() => [[null]]);
  const moneda = row?.moneda || "HNL";
  const recargos = {};
  for (const f of ["trimestral", "bimestral", "mensual"]) recargos[f] = Number(row?.[`recargo_${f}_pct`]) || 0;
  const precios = {};
  for (const n of NIVELES) {
    for (const plan of ["semestral", "anual"]) {
      const v = row?.[`precio_${n}_${plan}`] ?? (n === "basico" ? row?.[`precio_${plan}`] : null);
      precios[`${n}_${plan}`] = v != null && Number(v) > 0 ? Number(v) : null;
    }
  }
  return { moneda, precios, recargos };
}
/**
 * Plan real de cada clínica (nivel y, si se sabe, monto acordado), buscando en:
 *  1) el nivel confirmado en Cobranza (clinicas.lic_nivel),
 *  2) la solicitud de plan desde la página pública con la que se creó la clínica
 *     (nivel elegido y monto aprobado),
 *  3) el historial de licencias («Plan Avanzado — Semestral» en las notas).
 * Devuelve Map clinica_id → { nivel, fuente, monto_total, plan }
 */
async function planesDetectados() {
  const res = new Map();
  const ETQ = { "básico": "basico", basico: "basico", avanzado: "avanzado", empresarial: "empresarial" };
  const [h] = await pool.query(
    "SELECT clinica_id, plan_tipo, notas FROM licencias_historial WHERE notas IS NOT NULL ORDER BY creado_en, id").catch(() => [[]]);
  h.forEach((x) => {
    const m = String(x.notas).match(/Plan\s+(B[áa]sico|Avanzado|Empresarial)/i);
    if (m) res.set(x.clinica_id, { nivel: ETQ[m[1].toLowerCase()], fuente: "historial", monto_total: null, plan: x.plan_tipo });
  });
  const [sp] = await pool.query(
    `SELECT clinica_id, nivel_plan, plan_solicitado, monto, moneda FROM solicitudes_plan_publico
      WHERE clinica_id IS NOT NULL AND estado='aprobada' ORDER BY atendida_en, id`).catch(() => [[]]);
  sp.forEach((x) => res.set(x.clinica_id, {
    nivel: NIVELES.includes(x.nivel_plan) ? x.nivel_plan : "basico", fuente: "solicitud",
    monto_total: Number(x.monto) > 0 ? Number(x.monto) : null, moneda: x.moneda || null, plan: x.plan_solicitado,
  }));
  const [cl] = await pool.query("SELECT id, lic_nivel FROM clinicas WHERE lic_nivel IS NOT NULL").catch(() => [[]]);
  cl.forEach((x) => { if (NIVELES.includes(x.lic_nivel)) res.set(x.id, { ...(res.get(x.id) || {}), nivel: x.lic_nivel, fuente: "confirmado", monto_total: null }); });
  return res;
}

/** Cuota de una clínica sin monto en su licencia: con su plan real (o Básico si no se sabe). */
function cuotaPorPlan(lista, c, det) {
  const meses = c.plan_tipo === "anual" ? 12 : 6;
  // El monto aprobado en su solicitud vale si es del mismo tipo de plan que tiene ahora
  if (det?.monto_total && det.plan === c.plan_tipo) {
    return { monto: r2(det.monto_total / meses), moneda: det.moneda || lista.moneda, nivel: det.nivel, fuente: "solicitud_monto" };
  }
  const nivel = det?.nivel || "basico";
  const base = cuotaDeLista(lista, c.plan_tipo, nivel);
  const forma = formaDe(c);
  const m = base ? r2(base * (1 + (forma === "contado" ? 0 : (lista.recargos?.[forma] || 0)) / 100)) : null;
  return m ? { monto: m, moneda: lista.moneda, nivel, fuente: det?.nivel ? det.fuente : "sin_nivel" } : null;
}

/** Forma de pago de la licencia actual: la guardada; si no hay, las estimadas por lista
 *  se toman de contado (la lista de precios es por todo el plan) y las demás, mensual. */
function formaDe(c) {
  if (formaValida(c.forma_pago)) return c.forma_pago;
  return Number(c.monto_mensual) > 0 ? "mensual" : "contado";
}

/** Cuota mensual sugerida por la lista de precios para un plan y nivel. */
function cuotaDeLista(lista, plan, nivel) {
  const total = lista.precios[`${NIVELES.includes(nivel) ? nivel : "basico"}_${plan}`];
  if (!total) return null;
  return r2(total / (plan === "anual" ? 12 : 6));
}

// ── Fechas (texto YYYY-MM-DD para no depender de zonas horarias) ──
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aFecha = (v) => {
  if (!v) return null;
  if (v instanceof Date) return ymd(v);
  return String(v).slice(0, 10);
};
const hoyTexto = () => ymd(new Date());
const sumarDias = (txt, n) => { const d = new Date(`${txt}T12:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
const diaDeCobro = (y, m, dia) => { // m: 1..12; el día se ajusta al último del mes
  const ultimo = new Date(y, m, 0).getDate();
  return `${y}-${pad(m)}-${pad(Math.min(dia, ultimo))}`;
};
/** Meses entre dos fechas YYYY-MM-DD, redondeado (30 jul → 30 ene = 6). */
function mesesDelPeriodo(ini, fin) {
  const [a, b, c] = ini.split("-").map(Number), [x, y, z] = fin.split("-").map(Number);
  let meses = (x - a) * 12 + (y - b);
  if (z - c >= 15) meses += 1;
  else if (c - z > 15) meses -= 1;
  return Math.max(1, meses);
}
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

async function columnasHistorial() {
  const [cols] = await pool.query("SHOW COLUMNS FROM licencias_historial");
  return new Set(cols.map((c) => c.Field));
}

/**
 * Calendario de cuotas de cada clínica a partir de licencias_historial
 * (o, si no hay montos ahí, de la licencia actual de la clínica).
 * Devuelve Map clinica_id → [{ periodo, fecha_cobro, monto, moneda, plan_tipo }]
 */
async function calendarioCuotas(clinicaId = null) {
  const cols = await columnasHistorial();
  const filas = [];
  if (cols.has("monto_mensual")) {
    const [h] = await pool.query(
      `SELECT id, clinica_id, plan_tipo, inicio, fin, monto_mensual, moneda, dia_facturacion, creado_en
         FROM licencias_historial
        WHERE monto_mensual IS NOT NULL AND monto_mensual > 0 AND plan_tipo <> 'trial'
          ${clinicaId ? "AND clinica_id = ?" : ""}
        ORDER BY creado_en, id`, clinicaId ? [clinicaId] : []);
    filas.push(...h);
  }
  // Licencia actual de cada clínica (semestral / anual). Si no tiene monto mensual,
  // la cuota se estima con la lista de precios (nivel guardado o Básico).
  const lista = await listaPrecios();
  const detectados = await planesDetectados();
  const [cl] = await pool.query(
    `SELECT id AS clinica_id, plan_tipo, licencia_inicio AS inicio, licencia_fin AS fin,
            lic_monto_mensual AS monto_mensual, lic_moneda AS moneda, lic_dia_facturacion AS dia_facturacion, lic_nivel AS nivel,
            lic_forma_pago AS forma_pago
       FROM clinicas
      WHERE plan_tipo IN ('semestral','anual') AND licencia_inicio IS NOT NULL AND licencia_fin IS NOT NULL
        ${clinicaId ? "AND id = ?" : ""}`, clinicaId ? [clinicaId] : []).catch(() => [[]]);
  const estimadas = [], actuales = [];
  cl.forEach((c) => {
    if (Number(c.monto_mensual) > 0) actuales.push({ ...c, forma_pago: formaDe(c), creado_en: null });
    else {
      const q = cuotaPorPlan(lista, c, detectados.get(c.clinica_id));
      if (q) estimadas.push({ ...c, forma_pago: formaDe(c), monto_mensual: q.monto, moneda: q.moneda, estimada: q.fuente === "sin_nivel", creado_en: null });
    }
  });
  // Si el plan actual se paga de una sola vez, el historial mensual de ese mismo periodo no cuenta
  const contado = new Map([...actuales, ...estimadas].filter((c) => c.forma_pago !== "mensual").map((c) => [c.clinica_id, c]));
  for (let i = filas.length - 1; i >= 0; i--) {
    const c = contado.get(filas[i].clinica_id);
    if (c && aFecha(filas[i].inicio) < aFecha(c.fin) && aFecha(filas[i].fin) > aFecha(c.inicio)) filas.splice(i, 1);
  }
  // Orden de prioridad (lo último gana en el mismo mes): estimada < historial < licencia actual
  filas.unshift(...estimadas);
  filas.push(...actuales);

  const porClinica = new Map();
  for (const f of filas) {
    const ini = aFecha(f.inicio), fin = aFecha(f.fin);
    if (!ini || !fin || fin <= ini) continue;
    const dia = Math.min(28, Math.max(1, Number(f.dia_facturacion) || Number(ini.slice(8, 10))));
    const mapa = porClinica.get(f.clinica_id) || new Map();
    let [y, m] = ini.split("-").map(Number);
    // Número de cuotas = meses del periodo (redondeado): un semestral son 6 y un anual 12,
    // aunque el día de cobro se ajuste (máx. 28) o el periodo empiece a fin de mes.
    const nCuotas = mesesDelPeriodo(ini, fin);
    // Primer cobro: el día de inicio (el mes de la contratación también se paga)
    for (let i = 0; i < nCuotas; i++) {
      const fecha = i === 0 ? ini : diaDeCobro(y, m, dia);
      if (i === 0 || fecha > ini) {
        const periodo = fecha.slice(0, 7);
        // Si dos licencias cubren el mismo mes, cuenta la registrada después (corrección)
        mapa.set(periodo, { periodo, fecha_cobro: fecha, monto: r2(f.monto_mensual), moneda: f.moneda || "HNL", plan_tipo: f.plan_tipo, ...(f.estimada ? { estimada: true } : {}) });
      }
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    // Cada 2 o 3 meses: las cuotas mensuales del periodo se juntan en pagos de N meses
    const cada = FORMAS[f.forma_pago]?.cada;
    if (cada && cada > 1) {
      const mensuales = [...mapa.values()].filter((q) => q.fecha_cobro >= ini && q.fecha_cobro < fin && !q.unico && !q.bloque)
        .sort((a, b) => a.fecha_cobro.localeCompare(b.fecha_cobro));
      mensuales.forEach((q) => mapa.delete(q.periodo));
      const grupos = [];
      for (let k = 0; k < mensuales.length; k += cada) grupos.push(mensuales.slice(k, k + cada));
      grupos.forEach((g, k) => {
        const hasta = grupos[k + 1]?.[0]?.fecha_cobro || fin;
        mapa.set(g[0].periodo, { periodo: g[0].periodo, fecha_cobro: g[0].fecha_cobro, monto: r2(g.reduce((a, q) => a + q.monto, 0)),
          moneda: g[0].moneda, plan_tipo: f.plan_tipo, bloque: { n: k + 1, de: grupos.length, meses: g.length }, hasta,
          ...(f.estimada ? { estimada: true } : {}) });
      });
    }
    // Un solo pago por todo el plan: un único cargo el día de inicio
    if (f.forma_pago === "contado") {
      const mensuales = [...mapa.values()].filter((q) => q.fecha_cobro >= ini && q.fecha_cobro < fin && !q.unico);
      mensuales.forEach((q) => mapa.delete(q.periodo));
      const meses = Math.max(1, mensuales.length);
      mapa.set(ini.slice(0, 7), { periodo: ini.slice(0, 7), fecha_cobro: ini, monto: r2(f.monto_mensual * meses), moneda: f.moneda || "HNL",
        plan_tipo: f.plan_tipo, unico: true, meses, hasta: fin, ...(f.estimada ? { estimada: true } : {}) });
    }
    porClinica.set(f.clinica_id, mapa);
  }
  const res = new Map();
  porClinica.forEach((mapa, id) => res.set(id, [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo))));
  return res;
}

/**
 * Un plan de pago único que está vigente se da por pagado: el plan se activa cuando la
 * clínica ya pagó. Si no hay un pago registrado que lo cubra, se agrega un pago
 * automático («Pagado al activar el plan») por lo que falte, con la fecha de inicio.
 * Cuando se registra el pago real, el automático deja de agregarse.
 */
function pagosImplicitos(clinicaId, cuotas, pagos, hoy = hoyTexto()) {
  const res = [];
  for (const q of cuotas) {
    if (!q.unico || q.fecha_cobro > hoy || !(q.hasta > hoy)) continue;
    const desde = sumarDias(q.fecha_cobro, -60);
    const cubierto = pagos.filter((p) => { const f = aFecha(p.fecha); return f >= desde && f < q.hasta; })
      .reduce((a, p) => a + Number(p.monto), 0);
    const falta = r2(q.monto - cubierto);
    if (falta > 0) {
      res.push({ id: `auto-${clinicaId}-${q.periodo}`, clinica_id: clinicaId, fecha: q.fecha_cobro, monto: falta, moneda: q.moneda,
        metodo: "OTRO", tipo: "pago", implicito: true, notas: "Pagado al activar el plan (sin pago registrado)" });
    }
  }
  return res;
}
const ordenarPagos = (l) => l.sort((a, b) => aFecha(a.fecha).localeCompare(aFecha(b.fecha)) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

/** Aplica los pagos (más antiguos primero) a las cuotas y calcula el estado de la clínica. */
function estadoClinica(cuotas, pagos, hoy = hoyTexto()) {
  let disponible = r2(pagos.reduce((s, p) => s + Number(p.monto), 0));
  const pagadoTotal = disponible;
  const detalle = cuotas.map((c) => {
    const aplicado = r2(Math.min(disponible, c.monto));
    disponible = r2(disponible - aplicado);
    const vencida = c.fecha_cobro <= hoy;
    const atrasada = vencida && aplicado < c.monto && sumarDias(c.fecha_cobro, DIAS_GRACIA) < hoy;
    const estado = aplicado >= c.monto ? "pagada" : aplicado > 0 ? "parcial" : !vencida ? "programada" : atrasada ? "atrasada" : "pendiente";
    return { ...c, pagado: aplicado, falta: r2(c.monto - aplicado), vencida, estado };
  });
  const vencidas = detalle.filter((c) => c.vencida);
  const esperado = r2(vencidas.reduce((s, c) => s + c.monto, 0));
  const saldo = r2(esperado - pagadoTotal);
  const atrasadas = detalle.filter((c) => c.estado === "atrasada" || (c.estado === "parcial" && c.vencida && sumarDias(c.fecha_cobro, DIAS_GRACIA) < hoy));
  const pendientes = detalle.filter((c) => c.vencida && c.falta > 0);
  const proxima = detalle.find((c) => !c.vencida) || null;
  let estado = "sin_cuota";
  if (cuotas.length) {
    if (atrasadas.length) estado = "atrasado";
    else if (pendientes.length) estado = "pendiente";
    else if (saldo < 0) estado = "adelantado";
    else estado = "al_dia";
  }
  return {
    detalle, esperado, pagado: pagadoTotal, saldo, estado,
    cuotas_pendientes: pendientes.length, cuotas_atrasadas: atrasadas.length,
    deuda_mas_antigua: pendientes[0]?.fecha_cobro || null,
    proxima_cuota: proxima ? { fecha: proxima.fecha_cobro, monto: proxima.monto, moneda: proxima.moneda } : null,
    total_contrato: r2(cuotas.reduce((s, c) => s + c.monto, 0)),
  };
}

const sumarPorMoneda = (obj, moneda, monto) => { obj[moneda] = r2((obj[moneda] || 0) + Number(monto || 0)); };

// ── Resumen general ──────────────────────────────────────────
router.get("/resumen", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    const hoy = hoyTexto();
    const mesActual = hoy.slice(0, 7);
    const anio = hoy.slice(0, 4);

    const [clinicas] = await pool.query(
      `SELECT id, nombre, slug, email, telefono, activo, plan_tipo, licencia_inicio, licencia_fin
         FROM clinicas ORDER BY nombre`);
    const [extra] = await pool.query("SELECT id, lic_monto_mensual, lic_moneda, lic_dia_facturacion, lic_nivel, lic_forma_pago FROM clinicas").catch(() => [[]]);
    const lista = await listaPrecios();
    const detectados = await planesDetectados();
    const extraPor = new Map(extra.map((e) => [e.id, e]));
    const calendario = await calendarioCuotas();
    const [pagos] = await pool.query(
      `SELECT id, clinica_id, fecha, monto, moneda, metodo, referencia, notas, periodo, tipo
         FROM pagos_licencia WHERE anulado = 0 ORDER BY fecha, id`);
    const esIngreso = (p) => p.tipo !== "descuento";
    const pagosPor = new Map();
    pagos.forEach((p) => { const l = pagosPor.get(p.clinica_id) || []; l.push(p); pagosPor.set(p.clinica_id, l); });
    // Planes de pago único vigentes sin pago registrado: se dan por pagados
    let activadosSinPago = 0;
    clinicas.forEach((c) => {
      const auto = pagosImplicitos(c.id, calendario.get(c.id) || [], pagosPor.get(c.id) || [], hoy);
      if (!auto.length) return;
      activadosSinPago += 1;
      pagos.push(...auto);
      pagosPor.set(c.id, ordenarPagos([...(pagosPor.get(c.id) || []), ...auto]));
    });
    ordenarPagos(pagos);

    const totales = { cobrado_mes: {}, cobrado_anio: {}, cobrado_total: {}, por_cobrar: {}, atrasado: {}, mensual_esperado: {}, a_favor: {} };
    const filas = clinicas.map((c) => {
      const cuotas = calendario.get(c.id) || [];
      const pg = pagosPor.get(c.id) || [];
      const st = estadoClinica(cuotas, pg, hoy);
      const ex = extraPor.get(c.id) || {};
      const vigente = c.licencia_fin && aFecha(c.licencia_fin) >= hoy && c.plan_tipo !== "trial";
      const porLista = !(Number(ex.lic_monto_mensual) > 0) && ["semestral", "anual"].includes(c.plan_tipo);
      const q = porLista ? cuotaPorPlan(lista, c, detectados.get(c.id)) : null;
      const estimada = porLista && q?.fuente === "sin_nivel";
      const cuotaLista = q?.monto || null;
      const moneda = (porLista ? q?.moneda || lista.moneda : ex.lic_moneda) || cuotas[cuotas.length - 1]?.moneda || "HNL";
      const cuota = vigente ? Number((porLista ? cuotaLista : ex.lic_monto_mensual) || 0) : 0;
      const det = detectados.get(c.id);
      if (cuota > 0 && c.activo) sumarPorMoneda(totales.mensual_esperado, moneda, cuota);
      if (st.saldo > 0) sumarPorMoneda(totales.por_cobrar, moneda, st.saldo);
      if (st.saldo < 0) sumarPorMoneda(totales.a_favor, moneda, -st.saldo);
      const deudaAtrasada = st.detalle.filter((d) => d.vencida && d.falta > 0 && sumarDias(d.fecha_cobro, DIAS_GRACIA) < hoy).reduce((s, d) => s + d.falta, 0);
      if (deudaAtrasada > 0) sumarPorMoneda(totales.atrasado, moneda, deudaAtrasada);
      const ultimo = pg.filter(esIngreso).pop() || null;
      if (c.plan_tipo === "trial" && st.estado === "sin_cuota") st.estado = vigente || (c.licencia_fin && aFecha(c.licencia_fin) >= hoy) ? "prueba" : "prueba_vencida";
      return {
        id: c.id, nombre: c.nombre, slug: c.slug, email: c.email, telefono: c.telefono, activo: !!c.activo,
        plan_tipo: c.plan_tipo, licencia_inicio: aFecha(c.licencia_inicio), licencia_fin: aFecha(c.licencia_fin),
        vigente: !!vigente, cuota_mensual: cuota || (cuotas[cuotas.length - 1]?.monto ?? null), moneda,
        dia_facturacion: ex.lic_dia_facturacion || null,
        nivel: ex.lic_nivel || q?.nivel || det?.nivel || null, cuota_estimada: estimada && !!cuotaLista,
        cuota_fuente: porLista ? (q?.fuente || null) : "licencia",
        forma_pago: ["semestral", "anual"].includes(c.plan_tipo) ? formaDe({ forma_pago: ex.lic_forma_pago, monto_mensual: ex.lic_monto_mensual }) : null,
        meses_plan: c.plan_tipo === "anual" ? 12 : c.plan_tipo === "semestral" ? 6 : null,
        en_prueba: c.plan_tipo === "trial",
        dias_restantes: c.licencia_fin ? Math.ceil((new Date(`${aFecha(c.licencia_fin)}T12:00:00`) - new Date(`${hoy}T12:00:00`)) / 86400000) : null,
        esperado: st.esperado, saldo: st.saldo, estado: st.estado,
        descuentos: r2(pg.filter((x) => !esIngreso(x)).reduce((a, x) => a + Number(x.monto), 0)),
        pagado: r2(pg.filter(esIngreso).reduce((a, x) => a + Number(x.monto), 0)),
        cuotas_pendientes: st.cuotas_pendientes, cuotas_atrasadas: st.cuotas_atrasadas,
        deuda_mas_antigua: st.deuda_mas_antigua, proxima_cuota: st.proxima_cuota, total_contrato: st.total_contrato,
        ultimo_pago: ultimo ? { fecha: aFecha(ultimo.fecha), monto: Number(ultimo.monto), moneda: ultimo.moneda } : null,
      };
    });

    // Cobrado por mes (últimos 12) y esperado por mes, por moneda
    const meses = [];
    { const d = new Date(`${mesActual}-15T12:00:00`); d.setMonth(d.getMonth() - 11);
      for (let i = 0; i < 12; i++) { meses.push(ymd(d).slice(0, 7)); d.setMonth(d.getMonth() + 1); } }
    const serie = meses.map((mes) => ({ mes, cobrado: {}, esperado: {} }));
    const idx = new Map(meses.map((m, i) => [m, i]));
    pagos.filter(esIngreso).forEach((p) => {
      const f = aFecha(p.fecha), mes = f.slice(0, 7);
      sumarPorMoneda(totales.cobrado_total, p.moneda, p.monto);
      if (f.slice(0, 4) === anio) sumarPorMoneda(totales.cobrado_anio, p.moneda, p.monto);
      if (mes === mesActual) sumarPorMoneda(totales.cobrado_mes, p.moneda, p.monto);
      if (idx.has(mes)) sumarPorMoneda(serie[idx.get(mes)].cobrado, p.moneda, p.monto);
    });
    const proyeccion = [];
    { const d = new Date(`${mesActual}-15T12:00:00`);
      for (let i = 1; i <= 3; i++) { d.setMonth(d.getMonth() + 1); proyeccion.push({ mes: ymd(d).slice(0, 7), esperado: {} }); } }
    const idxP = new Map(proyeccion.map((p, i) => [p.mes, i]));
    calendario.forEach((cuotas) => cuotas.forEach((c) => {
      if (idx.has(c.periodo)) sumarPorMoneda(serie[idx.get(c.periodo)].esperado, c.moneda, c.monto);
      if (idxP.has(c.periodo)) sumarPorMoneda(proyeccion[idxP.get(c.periodo)].esperado, c.moneda, c.monto);
    }));

    const nombrePor = new Map(clinicas.map((c) => [c.id, c.nombre]));
    const recientes = [...pagos].filter(esIngreso).reverse().slice(0, 12).map((p) => ({
      id: p.id, clinica_id: p.clinica_id, clinica: nombrePor.get(p.clinica_id) || "—", fecha: aFecha(p.fecha),
      monto: Number(p.monto), moneda: p.moneda, metodo: p.metodo, referencia: p.referencia, implicito: !!p.implicito,
    }));

    res.json({ ok: true, data: {
      hoy, dias_gracia: DIAS_GRACIA, lista_precios: lista, activados_sin_pago: activadosSinPago, totales, serie, proyeccion, clinicas: filas, pagos_recientes: recientes,
      conteo: {
        pagando: filas.filter((f) => f.vigente && f.cuota_mensual > 0 && f.activo).length,
        al_dia: filas.filter((f) => ["al_dia", "adelantado"].includes(f.estado)).length,
        pendientes: filas.filter((f) => f.estado === "pendiente").length,
        atrasadas: filas.filter((f) => f.estado === "atrasado").length,
        sin_cuota: filas.filter((f) => f.estado === "sin_cuota").length,
        prueba: filas.filter((f) => f.estado === "prueba").length,
        prueba_vencida: filas.filter((f) => f.estado === "prueba_vencida").length,
      },
    } });
  } catch (e) {
    console.error("[cobranza resumen]", e);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Estado de cuenta de una clínica ─────────────────────────
router.get("/clinica/:id", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    const id = Number(req.params.id);
    const [[c]] = await pool.query("SELECT id, nombre, email, telefono, plan_tipo, licencia_inicio, licencia_fin FROM clinicas WHERE id=?", [id]);
    if (!c) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });
    const cuotas = (await calendarioCuotas(id)).get(id) || [];
    const [pagos] = await pool.query(
      `SELECT p.id, p.clinica_id, p.fecha, p.monto, p.moneda, p.metodo, p.referencia, p.notas, p.periodo, p.tipo,
              p.anulado, p.anulado_en, p.creado_en, p.recibo_enviado_en, p.comprobante_nombre,
              (p.comprobante IS NOT NULL OR p.comprobante_url IS NOT NULL) AS tiene_comprobante, u.nombres AS registrado_por
         FROM pagos_licencia p LEFT JOIN usuarios u ON u.id = p.creado_por
        WHERE p.clinica_id = ? ORDER BY p.fecha DESC, p.id DESC`, [id]);
    const reales = ordenarPagos(pagos.filter((p) => !p.anulado));
    const auto = pagosImplicitos(id, cuotas, reales);
    const validos = ordenarPagos([...reales, ...auto]);
    const st = estadoClinica(cuotas, validos);
    const [recibos] = await pool.query("SELECT id, numero, periodo, monto, estado FROM recibos_licencia WHERE clinica_id=?", [id]).catch(() => [[]]);
    const reciboPor = new Map(recibos.map((r) => [r.periodo, r]));
    res.json({ ok: true, data: {
      clinica: { ...c, licencia_inicio: aFecha(c.licencia_inicio), licencia_fin: aFecha(c.licencia_fin) },
      ...st,
      pagado: r2(validos.filter((p) => p.tipo !== "descuento").reduce((a, p) => a + Number(p.monto), 0)),
      descuentos: r2(validos.filter((p) => p.tipo === "descuento").reduce((a, p) => a + Number(p.monto), 0)),
      detalle: st.detalle.map((d) => ({ ...d, recibo: reciboPor.get(d.periodo) || null })).reverse(),
      pagos: [
        ...auto.map((p) => ({ ...p, numero: "Automático" })),
        ...pagos.map((p) => ({ ...p, numero: numeroPago(p.id), fecha: aFecha(p.fecha), monto: Number(p.monto), tiene_comprobante: !!p.tiene_comprobante })),
      ],
    } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Confirmar / ajustar la cuota mensual de una clínica ─────
router.put("/clinica/:id/cuota", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    const id = Number(req.params.id);
    const { monto_mensual, moneda, dia_facturacion, nivel, forma_pago } = req.body || {};
    const m = Number(monto_mensual);
    if (!(m > 0)) return res.status(400).json({ ok: false, msg: "Escriba una cuota mensual mayor a cero." });
    const [[c]] = await pool.query("SELECT id, licencia_inicio FROM clinicas WHERE id=?", [id]);
    if (!c) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });
    const diaInicio = c.licencia_inicio ? Number(aFecha(c.licencia_inicio).slice(8, 10)) : 1;
    const dia = Math.min(28, Math.max(1, Number(dia_facturacion) || diaInicio));
    await pool.query(
      "UPDATE clinicas SET lic_monto_mensual=?, lic_moneda=?, lic_dia_facturacion=?, lic_nivel=?, lic_forma_pago=? WHERE id=?",
      [r2(m), String(moneda || "HNL").slice(0, 8), dia, NIVELES.includes(nivel) ? nivel : null,
       formaValida(forma_pago) || "mensual", id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Registrar un pago ───────────────────────────────────────
router.post("/pagos", auth("SUPER_ADMIN"), (req, res, next) => {
  uploadComprobante.single("comprobante")(req, res, (err) => (err ? res.status(400).json({ ok: false, msg: err.message }) : next()));
}, async (req, res) => {
  try {
    await asegurarTabla();
    const { clinica_id, fecha, monto, moneda, metodo, referencia, notas, periodo } = req.body || {};
    const tipo = req.body?.tipo === "descuento" ? "descuento" : "pago";
    const m = Number(monto);
    if (!clinica_id || !(m > 0)) return res.status(400).json({ ok: false, msg: "Indique la clínica y un monto mayor a cero." });
    const [[c]] = await pool.query("SELECT id FROM clinicas WHERE id=?", [clinica_id]);
    if (!c) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });
    const f = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || "")) ? fecha : hoyTexto();
    const archivo = req.file || null;
    const [r] = await pool.query(
      `INSERT INTO pagos_licencia (clinica_id, fecha, monto, moneda, metodo, referencia, notas, periodo, creado_por,
                                   tipo, comprobante, comprobante_tipo, comprobante_nombre)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [clinica_id, f, r2(m), String(moneda || "HNL").slice(0, 8), tipo === "descuento" ? "AJUSTE" : (METODOS.includes(metodo) ? metodo : "OTRO"),
       referencia ? String(referencia).slice(0, 120) : null, notas ? String(notas).slice(0, 300) : null,
       /^\d{4}-\d{2}$/.test(String(periodo || "")) ? periodo : null, req.user.id,
       tipo, archivo ? archivo.buffer : null, archivo ? archivo.mimetype : null, archivo ? String(archivo.originalname || "comprobante").slice(0, 160) : null]);
    let recibo = null;
    if (tipo === "pago" && String(req.body?.enviar_recibo) === "1") {
      recibo = await enviarReciboPago(r.insertId).catch((e) => ({ enviado: false, error: e.message }));
    }
    res.json({ ok: true, data: { id: r.insertId, numero: numeroPago(r.insertId), recibo } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Anular un pago (queda en el historial, no cuenta) ───────
router.put("/pagos/:id/anular", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    await pool.query("UPDATE pagos_licencia SET anulado=1, anulado_en=NOW() WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ═══════════════ Recibo de pago, comprobante, recordatorio y exportación ═══════════════
const numeroPago = (id) => `PAG-${String(id).padStart(6, "0")}`;
const SIMB = { HNL: "L", USD: "$", EUR: "€" };
const money = (n, m = "HNL") => `${SIMB[m] || m} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fLarga = (t) => { const [y, mm, d] = aFecha(t).split("-").map(Number); return new Date(y, mm - 1, d).toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" }); };
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const METODO_TXT = { TRANSFERENCIA: "Transferencia bancaria", DEPOSITO: "Depósito bancario", EFECTIVO: "Efectivo", TARJETA: "Tarjeta", OTRO: "Otro", AJUSTE: "Ajuste" };
const PLAN_TXT = { semestral: "Semestral", anual: "Anual", trial: "Prueba" };

async function datosRecibo(pagoId) {
  const [[p]] = await pool.query("SELECT * FROM pagos_licencia WHERE id=?", [pagoId]);
  if (!p) throw new Error("Pago no encontrado");
  const [[c]] = await pool.query("SELECT id, nombre, email, telefono, direccion, ciudad, ruc, plan_tipo, licencia_inicio, licencia_fin FROM clinicas WHERE id=?", [p.clinica_id]);
  // Saldo de la clínica después de este pago
  const cuotas = (await calendarioCuotas(p.clinica_id)).get(p.clinica_id) || [];
  const [pagos] = await pool.query("SELECT monto FROM pagos_licencia WHERE clinica_id=? AND anulado=0 AND (fecha < ? OR (fecha = ? AND id <= ?))",
    [p.clinica_id, aFecha(p.fecha), aFecha(p.fecha), p.id]);
  const st = estadoClinica(cuotas, pagos, aFecha(p.fecha));
  return { p, c, saldo: st.saldo };
}

function htmlReciboPago({ p, c, saldo }) {
  const anulado = !!p.anulado;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /><style>
    body { font-family:'Segoe UI',Arial,sans-serif; margin:0; padding:34px 36px; color:#1e293b; font-size:13px; }
    .card { max-width:560px; margin:auto; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; position:relative; }
    .top { background:linear-gradient(135deg,#059669,#10b981); color:#fff; padding:22px 26px; display:flex; justify-content:space-between; align-items:flex-start; }
    .brand { font-size:18px; font-weight:800; } .brand small { display:block; font-size:9px; letter-spacing:.1em; text-transform:uppercase; opacity:.85; }
    .no { text-align:right; font-size:12px; } .no b { display:block; font-size:15px; }
    .body { padding:22px 26px 24px; }
    h2 { font-size:12px; margin:0 0 10px; letter-spacing:.06em; text-transform:uppercase; color:#64748b; }
    table { width:100%; border-collapse:collapse; } td { padding:7px 0; border-bottom:1px solid #eef2f7; font-size:12.5px; } td.k { color:#64748b; width:40%; }
    .total { margin-top:16px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; }
    .total .lbl { font-size:12px; color:#047857; text-transform:uppercase; letter-spacing:.05em; font-weight:700; } .total .val { font-size:22px; font-weight:800; color:#047857; }
    .saldo { margin-top:10px; font-size:12px; color:#475569; text-align:right; }
    .firma { margin-top:34px; display:flex; justify-content:flex-end; } .firma div { border-top:1px solid #94a3b8; width:200px; text-align:center; padding-top:6px; font-size:11px; color:#64748b; }
    .fine { margin-top:18px; font-size:9.5px; color:#94a3b8; line-height:1.5; text-align:center; }
    .sello { position:absolute; top:42%; left:50%; transform:translate(-50%,-50%) rotate(-18deg); font-size:54px; font-weight:900; color:rgba(220,38,38,.22); border:6px solid rgba(220,38,38,.22); padding:4px 18px; border-radius:12px; }
  </style></head><body><div class="card">
    ${anulado ? '<div class="sello">ANULADO</div>' : ""}
    <div class="top"><div class="brand">Medic-KG<small>Sistema de Gestión Clínica</small></div>
      <div class="no">RECIBO DE PAGO<b>${numeroPago(p.id)}</b>${fLarga(p.fecha)}</div></div>
    <div class="body">
      <h2>Recibimos de</h2>
      <table>
        <tr><td class="k">Clínica</td><td><b>${esc(c?.nombre)}</b></td></tr>
        ${c?.ruc ? `<tr><td class="k">RTN</td><td>${esc(c.ruc)}</td></tr>` : ""}
        ${c?.direccion || c?.ciudad ? `<tr><td class="k">Dirección</td><td>${esc([c.direccion, c.ciudad].filter(Boolean).join(", "))}</td></tr>` : ""}
        <tr><td class="k">Concepto</td><td>Pago del servicio Medic-KG${c?.plan_tipo && c.plan_tipo !== "trial" ? ` — plan ${PLAN_TXT[c.plan_tipo]}${c.licencia_inicio ? ` (${fLarga(aFecha(c.licencia_inicio))} al ${fLarga(aFecha(c.licencia_fin))})` : ""}` : ""}</td></tr>
        <tr><td class="k">Forma de pago</td><td>${METODO_TXT[p.metodo] || esc(p.metodo)}</td></tr>
        ${p.referencia ? `<tr><td class="k">Referencia</td><td>${esc(p.referencia)}</td></tr>` : ""}
        ${p.notas ? `<tr><td class="k">Notas</td><td>${esc(p.notas)}</td></tr>` : ""}
      </table>
      <div class="total"><span class="lbl">Monto recibido</span><span class="val">${money(p.monto, p.moneda)}</span></div>
      <div class="saldo">${saldo > 0 ? `Saldo pendiente después de este pago: <b>${money(saldo, p.moneda)}</b>` : saldo < 0 ? `Saldo a favor: <b>${money(-saldo, p.moneda)}</b>` : "<b>Cuenta al día.</b> ¡Gracias por su pago!"}</div>
      <div class="firma"><div>Medic-KG · medickg.com</div></div>
      <div class="fine">Este recibo confirma el pago recibido por el servicio de software Medic-KG. Consérvelo para sus registros.</div>
    </div></div></body></html>`;
}

async function pdfReciboPago(pagoId) {
  const datos = await datosRecibo(pagoId);
  const html = htmlReciboPago(datos);
  let pdf = null;
  try {
    const { generarPdfDesdeHtml } = require("../utils/pdfFromHtml");
    pdf = await generarPdfDesdeHtml(html, { paper_size: "HALF_LETTER", orientacion: "portrait" });
  } catch (e) { console.error("[recibo pago pdf]", e.message); }
  return { ...datos, html, pdf };
}

async function enviarReciboPago(pagoId) {
  const { p, c, pdf } = await pdfReciboPago(pagoId);
  if (!c?.email) return { enviado: false, error: "La clínica no tiene correo." };
  await enviarEmail({
    to: c.email,
    subject: `Recibo de pago ${numeroPago(p.id)} — Medic-KG`,
    html: `<p>Hola, equipo de <b>${esc(c.nombre)}</b>:</p><p>Recibimos su pago de <b>${money(p.monto, p.moneda)}</b> el ${fLarga(p.fecha)}. Adjuntamos su recibo ${numeroPago(p.id)}.</p><p>¡Gracias por confiar en Medic-KG!</p>`,
    attachments: pdf ? [{ filename: `recibo-${numeroPago(p.id)}.pdf`, content: pdf, contentType: "application/pdf" }] : [],
  });
  await pool.query("UPDATE pagos_licencia SET recibo_enviado_en=NOW() WHERE id=?", [p.id]);
  return { enviado: true, correo: c.email };
}

router.get("/pagos/:id/recibo", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    const { p, html, pdf } = await pdfReciboPago(req.params.id);
    if (req.query.formato === "html" || !pdf) return res.type("html").send(html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="recibo-${numeroPago(p.id)}.pdf"`);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/pagos/:id/enviar-recibo", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    const r = await enviarReciboPago(req.params.id);
    if (!r.enviado) return res.status(400).json({ ok: false, msg: r.error });
    res.json({ ok: true, data: r });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.get("/pagos/:id/comprobante", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    const [[p]] = await pool.query("SELECT comprobante, comprobante_tipo, comprobante_nombre, comprobante_url FROM pagos_licencia WHERE id=?", [req.params.id]);
    if (!p?.comprobante && p?.comprobante_url) return res.json({ ok: true, url: p.comprobante_url });
    if (!p?.comprobante) return res.status(404).json({ ok: false, msg: "Este pago no tiene comprobante." });
    res.setHeader("Content-Type", p.comprobante_tipo || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${String(p.comprobante_nombre || "comprobante").replace(/"/g, "")}"`);
    res.send(p.comprobante);
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// Recordatorio de cobro por correo a la clínica (saldo, cuotas pendientes y datos para pagar)
router.post("/clinica/:id/recordatorio", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    const id = Number(req.params.id);
    const [[c]] = await pool.query("SELECT id, nombre, email FROM clinicas WHERE id=?", [id]);
    if (!c) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });
    if (!c.email) return res.status(400).json({ ok: false, msg: "La clínica no tiene correo registrado." });
    const cuotas = (await calendarioCuotas(id)).get(id) || [];
    const [pagos] = await pool.query("SELECT id, fecha, monto FROM pagos_licencia WHERE clinica_id=? AND anulado=0 ORDER BY fecha, id", [id]);
    const st = estadoClinica(cuotas, ordenarPagos([...pagos, ...pagosImplicitos(id, cuotas, pagos)]));
    if (!(st.saldo > 0)) return res.status(400).json({ ok: false, msg: "Esta clínica no tiene saldo pendiente." });
    const [[banco]] = await pool.query("SELECT banco, titular, numero_cuenta FROM config_pagos WHERE id=1").catch(() => [[null]]);
    const pend = st.detalle.filter((q) => q.vencida && q.falta > 0);
    const filas = pend.map((q) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${q.unico ? `Plan ${PLAN_TXT[q.plan_tipo] || ""} (pago único)` : fLarga(q.fecha_cobro)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${money(q.falta, q.moneda)}</td></tr>`).join("");
    const moneda = pend[0]?.moneda || "HNL";
    await enviarEmail({
      to: c.email,
      subject: `Recordatorio de pago — Medic-KG (${money(st.saldo, moneda)})`,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;color:#1e293b">
        <p>Hola, equipo de <b>${esc(c.nombre)}</b>:</p>
        <p>Le recordamos que tiene un saldo pendiente de <b>${money(st.saldo, moneda)}</b> por el servicio de Medic-KG.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin:10px 0">${filas}
          <tr><td style="padding:8px 10px;font-weight:700">Total</td><td style="padding:8px 10px;text-align:right;font-weight:700">${money(st.saldo, moneda)}</td></tr></table>
        ${banco?.banco || banco?.numero_cuenta ? `<p style="background:#f1f5f9;border-radius:8px;padding:10px 14px">Puede pagar por transferencia o depósito:<br><b>${esc(banco.banco || "")}</b>${banco.titular ? ` · ${esc(banco.titular)}` : ""}<br>Cuenta: <b>${esc(banco.numero_cuenta || "")}</b></p>` : ""}
        <p>Si ya realizó el pago, puede ignorar este mensaje. ¡Gracias!</p>
        <p style="color:#64748b;font-size:12px">Medic-KG · medickg.com</p></div>`,
    });
    res.json({ ok: true, data: { correo: c.email, saldo: st.saldo } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// Lista de pagos para exportar (rango de fechas opcional)
router.get("/pagos", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    const { desde, hasta } = req.query;
    const cond = [], val = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(desde || ""))) { cond.push("p.fecha >= ?"); val.push(desde); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(hasta || ""))) { cond.push("p.fecha <= ?"); val.push(hasta); }
    const [rows] = await pool.query(
      `SELECT p.id, p.fecha, p.monto, p.moneda, p.metodo, p.referencia, p.notas, p.tipo, p.anulado, c.nombre AS clinica, c.ruc
         FROM pagos_licencia p JOIN clinicas c ON c.id = p.clinica_id
        ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""} ORDER BY p.fecha DESC, p.id DESC`, val);
    res.json({ ok: true, data: rows.map((x) => ({ ...x, numero: numeroPago(x.id), fecha: aFecha(x.fecha), monto: Number(x.monto) })) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/** Estado de cuenta de una clínica (lo usa el aviso de pago de la propia clínica). */
async function estadoCuentaClinica(id) {
  await asegurarTabla();
  const cuotas = (await calendarioCuotas(id)).get(id) || [];
  const [pagos] = await pool.query("SELECT id, fecha, monto FROM pagos_licencia WHERE clinica_id=? AND anulado=0 ORDER BY fecha, id", [id]);
  const st = estadoClinica(cuotas, ordenarPagos([...pagos, ...pagosImplicitos(id, cuotas, pagos)]));
  return { ...st, cuotas };
}

/** Registra un pago (lo usa la aprobación de una solicitud de plan con su comprobante). */
async function registrarPago({ clinicaId, fecha, monto, moneda = "HNL", metodo = "TRANSFERENCIA", referencia = null, notas = null, creadoPor = null, comprobanteUrl = null }) {
  await asegurarTabla();
  const [r] = await pool.query(
    `INSERT INTO pagos_licencia (clinica_id, fecha, monto, moneda, metodo, referencia, notas, creado_por, tipo, comprobante_url) VALUES (?,?,?,?,?,?,?,?, 'pago', ?)`,
    [clinicaId, fecha || hoyTexto(), r2(monto), moneda, metodo, referencia, notas, creadoPor, comprobanteUrl]);
  return r.insertId;
}

module.exports = router;
module.exports.estadoCuentaClinica = estadoCuentaClinica;
module.exports.registrarPago = registrarPago;
module.exports.asegurarTabla = asegurarTabla;
module.exports.METODOS = METODOS;
