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
  tablaOk = true;
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
  // Clínicas con cuota en la licencia actual pero sin montos en el historial
  const [cl] = await pool.query(
    `SELECT id AS clinica_id, plan_tipo, licencia_inicio AS inicio, licencia_fin AS fin,
            lic_monto_mensual AS monto_mensual, lic_moneda AS moneda, lic_dia_facturacion AS dia_facturacion
       FROM clinicas
      WHERE lic_monto_mensual IS NOT NULL AND lic_monto_mensual > 0 AND plan_tipo <> 'trial'
        AND licencia_inicio IS NOT NULL AND licencia_fin IS NOT NULL
        ${clinicaId ? "AND id = ?" : ""}`, clinicaId ? [clinicaId] : []).catch(() => [[]]);
  const conHistorial = new Set(filas.map((f) => f.clinica_id));
  cl.forEach((c) => { if (!conHistorial.has(c.clinica_id)) filas.push({ ...c, creado_en: null }); });

  const porClinica = new Map();
  for (const f of filas) {
    const ini = aFecha(f.inicio), fin = aFecha(f.fin);
    if (!ini || !fin || fin <= ini) continue;
    const dia = Math.min(28, Math.max(1, Number(f.dia_facturacion) || Number(ini.slice(8, 10))));
    const mapa = porClinica.get(f.clinica_id) || new Map();
    let [y, m] = ini.split("-").map(Number);
    // Primer cobro: el día de inicio (el mes de la contratación también se paga)
    for (let i = 0; i < 240; i++) {
      const fecha = i === 0 ? ini : diaDeCobro(y, m, dia);
      if (fecha >= fin) break;
      if (i === 0 || fecha > ini) {
        const periodo = fecha.slice(0, 7);
        // Si dos licencias cubren el mismo mes, cuenta la registrada después (corrección)
        mapa.set(periodo, { periodo, fecha_cobro: fecha, monto: r2(f.monto_mensual), moneda: f.moneda || "HNL", plan_tipo: f.plan_tipo });
      }
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    porClinica.set(f.clinica_id, mapa);
  }
  const res = new Map();
  porClinica.forEach((mapa, id) => res.set(id, [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo))));
  return res;
}

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
    const [extra] = await pool.query("SELECT id, lic_monto_mensual, lic_moneda, lic_dia_facturacion FROM clinicas").catch(() => [[]]);
    const extraPor = new Map(extra.map((e) => [e.id, e]));
    const calendario = await calendarioCuotas();
    const [pagos] = await pool.query(
      `SELECT id, clinica_id, fecha, monto, moneda, metodo, referencia, notas, periodo
         FROM pagos_licencia WHERE anulado = 0 ORDER BY fecha, id`);
    const pagosPor = new Map();
    pagos.forEach((p) => { const l = pagosPor.get(p.clinica_id) || []; l.push(p); pagosPor.set(p.clinica_id, l); });

    const totales = { cobrado_mes: {}, cobrado_anio: {}, cobrado_total: {}, por_cobrar: {}, atrasado: {}, mensual_esperado: {}, a_favor: {} };
    const filas = clinicas.map((c) => {
      const cuotas = calendario.get(c.id) || [];
      const pg = pagosPor.get(c.id) || [];
      const st = estadoClinica(cuotas, pg, hoy);
      const ex = extraPor.get(c.id) || {};
      const vigente = c.licencia_fin && aFecha(c.licencia_fin) >= hoy && c.plan_tipo !== "trial";
      const moneda = ex.lic_moneda || cuotas[cuotas.length - 1]?.moneda || "HNL";
      const cuota = vigente ? Number(ex.lic_monto_mensual || 0) : 0;
      if (cuota > 0 && c.activo) sumarPorMoneda(totales.mensual_esperado, moneda, cuota);
      if (st.saldo > 0) sumarPorMoneda(totales.por_cobrar, moneda, st.saldo);
      if (st.saldo < 0) sumarPorMoneda(totales.a_favor, moneda, -st.saldo);
      const deudaAtrasada = st.detalle.filter((d) => d.vencida && d.falta > 0 && sumarDias(d.fecha_cobro, DIAS_GRACIA) < hoy).reduce((s, d) => s + d.falta, 0);
      if (deudaAtrasada > 0) sumarPorMoneda(totales.atrasado, moneda, deudaAtrasada);
      const ultimo = pg[pg.length - 1] || null;
      return {
        id: c.id, nombre: c.nombre, slug: c.slug, email: c.email, telefono: c.telefono, activo: !!c.activo,
        plan_tipo: c.plan_tipo, licencia_inicio: aFecha(c.licencia_inicio), licencia_fin: aFecha(c.licencia_fin),
        vigente: !!vigente, cuota_mensual: cuota || (cuotas[cuotas.length - 1]?.monto ?? null), moneda,
        dia_facturacion: ex.lic_dia_facturacion || null,
        esperado: st.esperado, pagado: st.pagado, saldo: st.saldo, estado: st.estado,
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
    pagos.forEach((p) => {
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
    const recientes = [...pagos].reverse().slice(0, 12).map((p) => ({
      id: p.id, clinica_id: p.clinica_id, clinica: nombrePor.get(p.clinica_id) || "—", fecha: aFecha(p.fecha),
      monto: Number(p.monto), moneda: p.moneda, metodo: p.metodo, referencia: p.referencia,
    }));

    res.json({ ok: true, data: {
      hoy, dias_gracia: DIAS_GRACIA, totales, serie, proyeccion, clinicas: filas, pagos_recientes: recientes,
      conteo: {
        pagando: filas.filter((f) => f.vigente && f.cuota_mensual > 0 && f.activo).length,
        al_dia: filas.filter((f) => ["al_dia", "adelantado"].includes(f.estado)).length,
        pendientes: filas.filter((f) => f.estado === "pendiente").length,
        atrasadas: filas.filter((f) => f.estado === "atrasado").length,
        sin_cuota: filas.filter((f) => f.estado === "sin_cuota").length,
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
      `SELECT p.*, u.nombres AS registrado_por FROM pagos_licencia p LEFT JOIN usuarios u ON u.id = p.creado_por
        WHERE p.clinica_id = ? ORDER BY p.fecha DESC, p.id DESC`, [id]);
    const validos = pagos.filter((p) => !p.anulado).sort((a, b) => aFecha(a.fecha).localeCompare(aFecha(b.fecha)) || a.id - b.id);
    const st = estadoClinica(cuotas, validos);
    const [recibos] = await pool.query("SELECT id, numero, periodo, monto, estado FROM recibos_licencia WHERE clinica_id=?", [id]).catch(() => [[]]);
    const reciboPor = new Map(recibos.map((r) => [r.periodo, r]));
    res.json({ ok: true, data: {
      clinica: { ...c, licencia_inicio: aFecha(c.licencia_inicio), licencia_fin: aFecha(c.licencia_fin) },
      ...st,
      detalle: st.detalle.map((d) => ({ ...d, recibo: reciboPor.get(d.periodo) || null })).reverse(),
      pagos: pagos.map((p) => ({ ...p, fecha: aFecha(p.fecha), monto: Number(p.monto) })),
    } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Registrar un pago ───────────────────────────────────────
router.post("/pagos", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    const { clinica_id, fecha, monto, moneda, metodo, referencia, notas, periodo } = req.body || {};
    const m = Number(monto);
    if (!clinica_id || !(m > 0)) return res.status(400).json({ ok: false, msg: "Indique la clínica y un monto mayor a cero." });
    const [[c]] = await pool.query("SELECT id FROM clinicas WHERE id=?", [clinica_id]);
    if (!c) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });
    const f = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || "")) ? fecha : hoyTexto();
    const [r] = await pool.query(
      `INSERT INTO pagos_licencia (clinica_id, fecha, monto, moneda, metodo, referencia, notas, periodo, creado_por)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [clinica_id, f, r2(m), String(moneda || "HNL").slice(0, 8), METODOS.includes(metodo) ? metodo : "OTRO",
       referencia ? String(referencia).slice(0, 120) : null, notas ? String(notas).slice(0, 300) : null,
       /^\d{4}-\d{2}$/.test(String(periodo || "")) ? periodo : null, req.user.id]);
    res.json({ ok: true, data: { id: r.insertId } });
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

module.exports = router;
module.exports.METODOS = METODOS;
