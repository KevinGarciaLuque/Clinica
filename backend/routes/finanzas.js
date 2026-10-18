/**
 * routes/finanzas.js — Gastos y ganancias de la clínica.
 *
 *  GET  /api/finanzas/categorias              → categorías de gasto (crea las básicas la primera vez)
 *  POST /api/finanzas/categorias              → nueva categoría
 *  PUT  /api/finanzas/categorias/:id          → renombrar / ocultar
 *  GET  /api/finanzas/gastos                  → lista con filtros (desde, hasta, categoria_id, q)
 *  POST /api/finanzas/gastos                  → registrar gasto
 *  PUT  /api/finanzas/gastos/:id              → editar gasto
 *  POST /api/finanzas/gastos/:id/anular       → anular (no se borra: queda el registro)
 *  GET  /api/finanzas/fijos-pendientes?mes=   → gastos fijos del mes anterior que aún no se registran
 *  POST /api/finanzas/copiar-fijos            → registrar esos gastos fijos en el mes
 *  GET  /api/finanzas/resumen?mes=YYYY-MM     → ingresos, gastos, ganancia, por categoría y últimos 6 meses
 *  GET  /api/finanzas/por-cobrar              → facturas pendientes con saldo y antigüedad
 *  GET  /api/finanzas/exportar?desde&hasta    → Excel (resumen, ingresos y gastos)
 *
 * Ingresos = pagos registrados en Facturación (lo que realmente entró), en hora de la clínica.
 */
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");
const { filtroSucursal, sucursalParaGuardar } = require("../utils/sucursales");
const { requireFinanzas } = require("../utils/permisoFinanzas");
const { zonaClinica, ahoraClinica, hoyClinica, localSql } = require("../utils/zonaHoraria");

const ROLES = ["ADMIN", "MEDICO", "PSICOLOGO", "SUPER_ADMIN"];
const METODOS = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CHEQUE", "OTRO"];

const CATEGORIAS_BASE = [
  ["Alquiler", "bi-house-door-fill", "#6366f1"],
  ["Sueldos y honorarios", "bi-people-fill", "#0ea5e9"],
  ["Insumos y medicamentos", "bi-capsule", "#10b981"],
  ["Servicios (luz, agua, internet)", "bi-lightning-charge-fill", "#f59e0b"],
  ["Equipo médico", "bi-heart-pulse-fill", "#ef4444"],
  ["Mantenimiento y limpieza", "bi-tools", "#64748b"],
  ["Publicidad", "bi-megaphone-fill", "#ec4899"],
  ["Impuestos y permisos", "bi-bank2", "#8b5cf6"],
  ["Papelería y oficina", "bi-paperclip", "#14b8a6"],
  ["Otros", "bi-three-dots", "#94a3b8"],
];
const COLORES = CATEGORIAS_BASE.map((c) => c[2]);

let tablasListas = false;
async function asegurarTablas() {
  if (tablasListas) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gastos_categorias (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id  INT UNSIGNED NOT NULL,
      nombre      VARCHAR(80) NOT NULL,
      icono       VARCHAR(40) NULL,
      color       VARCHAR(20) NULL,
      orden       INT NOT NULL DEFAULT 0,
      activo      TINYINT(1) NOT NULL DEFAULT 1,
      creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_gc_clinica (clinica_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gastos (
      id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id         INT UNSIGNED NOT NULL,
      categoria_id       INT UNSIGNED NULL,
      descripcion        VARCHAR(250) NOT NULL,
      monto              DECIMAL(12,2) NOT NULL,
      fecha              DATE NOT NULL,
      metodo             VARCHAR(20) NULL,
      proveedor          VARCHAR(150) NULL,
      comprobante        VARCHAR(80) NULL,
      fijo               TINYINT(1) NOT NULL DEFAULT 0,
      notas              VARCHAR(500) NULL,
      creado_por         INT UNSIGNED NULL,
      creado_en          DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en     DATETIME NULL,
      anulado            TINYINT(1) NOT NULL DEFAULT 0,
      anulado_por        INT UNSIGNED NULL,
      anulado_en         DATETIME NULL,
      motivo_anulacion   VARCHAR(250) NULL,
      sucursal_id        INT UNSIGNED NULL,
      INDEX idx_g_clinica_fecha (clinica_id, fecha),
      INDEX idx_g_categoria (categoria_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablasListas = true;
}

const VACIO = { sql: "", params: [] };
/** Filtros por la sucursal elegida arriba: facturas/pagos (f.) y gastos (g. / sin alias) */
async function filtrosSucursal(req) {
  return {
    f: await filtroSucursal(req, "f.sucursal_id"),
    g: await filtroSucursal(req, "g.sucursal_id"),
    gs: await filtroSucursal(req, "sucursal_id"),
  };
}
const SIN_FILTRO = { f: VACIO, g: VACIO, gs: VACIO };

const clinicaDe = (req) => req.tenant?.clinica_id || req.user?.clinica_id;
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const esMes = (s) => /^\d{4}-\d{2}$/.test(String(s || ""));
const num = (v) => Math.round(Number(v || 0) * 100) / 100;

/** Primer y último día de un mes "YYYY-MM" */
function rangoMes(mes) {
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}
function mesMas(mes, n) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function categoriasDe(clinicaId) {
  await asegurarTablas();
  let [rows] = await pool.query("SELECT id, nombre, icono, color, orden, activo FROM gastos_categorias WHERE clinica_id = ? ORDER BY orden, id", [clinicaId]);
  if (!rows.length) {
    await pool.query(
      "INSERT INTO gastos_categorias (clinica_id, nombre, icono, color, orden) VALUES ?",
      [CATEGORIAS_BASE.map(([n, i, c], k) => [clinicaId, n, i, c, (k + 1) * 10])]
    );
    [rows] = await pool.query("SELECT id, nombre, icono, color, orden, activo FROM gastos_categorias WHERE clinica_id = ? ORDER BY orden, id", [clinicaId]);
  }
  return rows;
}

/** Valida y limpia los datos de un gasto */
async function leerGasto(body, clinicaId) {
  const descripcion = String(body.descripcion || "").replace(/\s+/g, " ").trim();
  const monto = num(body.monto);
  const fecha = String(body.fecha || "");
  if (!descripcion) return { error: "Escriba en qué se gastó (descripción)." };
  if (descripcion.length > 250) return { error: "La descripción es muy larga (máximo 250 caracteres)." };
  if (!(monto > 0) || monto > 99999999) return { error: "El monto debe ser mayor que cero." };
  if (!esFecha(fecha)) return { error: "Fecha no válida." };
  let categoria_id = body.categoria_id ? Number(body.categoria_id) : null;
  if (categoria_id) {
    const [[c]] = await pool.query("SELECT id FROM gastos_categorias WHERE id = ? AND clinica_id = ?", [categoria_id, clinicaId]);
    if (!c) categoria_id = null;
  }
  const metodo = METODOS.includes(body.metodo) ? body.metodo : null;
  const corto = (v, n) => (String(v ?? "").trim().slice(0, n) || null);
  return {
    datos: {
      categoria_id, descripcion, monto, fecha, metodo,
      proveedor: corto(body.proveedor, 150), comprobante: corto(body.comprobante, 80),
      fijo: body.fijo ? 1 : 0, notas: corto(body.notas, 500),
    },
  };
}

const SELECT_GASTO = `
  SELECT g.id, g.categoria_id, g.descripcion, g.monto, DATE_FORMAT(g.fecha, '%Y-%m-%d') AS fecha, g.metodo,
         g.proveedor, g.comprobante, g.fijo, g.notas, g.anulado, g.motivo_anulacion, g.sucursal_id,
         c.nombre AS categoria, c.icono AS categoria_icono, c.color AS categoria_color,
         TRIM(CONCAT(COALESCE(u.nombres,''),' ',COALESCE(u.apellidos,''))) AS registrado_por
  FROM gastos g
  LEFT JOIN gastos_categorias c ON c.id = g.categoria_id
  LEFT JOIN usuarios u ON u.id = g.creado_por`;

const base = [auth(...ROLES), requireFinanzas()];

// ── Categorías ───────────────────────────────────────────────────────────────
router.get("/categorias", ...base, async (req, res) => {
  try {
    res.json({ ok: true, data: await categoriasDe(clinicaDe(req)) });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

router.post("/categorias", ...base, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    const nombre = String(req.body?.nombre || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!nombre) return res.status(400).json({ ok: false, msg: "Escriba el nombre de la categoría." });
    const actuales = await categoriasDe(clinicaId);
    const igual = actuales.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase());
    if (igual) {
      if (!igual.activo) await pool.query("UPDATE gastos_categorias SET activo = 1 WHERE id = ?", [igual.id]);
      return res.json({ ok: true, id: igual.id });
    }
    const orden = Math.max(0, ...actuales.map((c) => c.orden)) + 10;
    const [r] = await pool.query(
      "INSERT INTO gastos_categorias (clinica_id, nombre, icono, color, orden) VALUES (?,?,?,?,?)",
      [clinicaId, nombre, "bi-tag-fill", COLORES[actuales.length % COLORES.length], orden]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

router.put("/categorias/:id", ...base, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    const nombre = req.body?.nombre != null ? String(req.body.nombre).replace(/\s+/g, " ").trim().slice(0, 80) : null;
    if (nombre === "") return res.status(400).json({ ok: false, msg: "El nombre no puede quedar vacío." });
    const activo = req.body?.activo === undefined ? null : (req.body.activo ? 1 : 0);
    await pool.query(
      "UPDATE gastos_categorias SET nombre = COALESCE(?, nombre), activo = COALESCE(?, activo) WHERE id = ? AND clinica_id = ?",
      [nombre, activo, req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ── Gastos ───────────────────────────────────────────────────────────────────
router.get("/gastos", ...base, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await asegurarTablas();
    const { desde, hasta, categoria_id, q, incluir_anulados } = req.query;
    const where = ["g.clinica_id = ?"];
    const params = [clinicaId];
    if (esFecha(desde)) { where.push("g.fecha >= ?"); params.push(desde); }
    if (esFecha(hasta)) { where.push("g.fecha <= ?"); params.push(hasta); }
    if (categoria_id) { where.push("g.categoria_id = ?"); params.push(Number(categoria_id)); }
    if (q) { where.push("(g.descripcion LIKE ? OR g.proveedor LIKE ? OR g.comprobante LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (incluir_anulados !== "1") where.push("g.anulado = 0");
    const fs = await filtroSucursal(req, "g.sucursal_id");
    const [rows] = await pool.query(`${SELECT_GASTO} WHERE ${where.join(" AND ")}${fs.sql} ORDER BY g.fecha DESC, g.id DESC LIMIT 1000`, [...params, ...fs.params]);
    const total = rows.filter((r) => !r.anulado).reduce((s, r) => s + Number(r.monto), 0);
    res.json({ ok: true, data: rows, total: num(total) });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

router.post("/gastos", ...base, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await asegurarTablas();
    const { error, datos } = await leerGasto(req.body || {}, clinicaId);
    if (error) return res.status(400).json({ ok: false, msg: error });
    const [r] = await pool.query(
      `INSERT INTO gastos (clinica_id, categoria_id, descripcion, monto, fecha, metodo, proveedor, comprobante, fijo, notas, creado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [clinicaId, datos.categoria_id, datos.descripcion, datos.monto, datos.fecha, datos.metodo, datos.proveedor, datos.comprobante, datos.fijo, datos.notas, req.user.id]
    );
    const sucursalId = await sucursalParaGuardar(req, req.body?.sucursal_id);
    if (sucursalId) await pool.query("UPDATE gastos SET sucursal_id = ? WHERE id = ?", [sucursalId, r.insertId]);
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

router.put("/gastos/:id", ...base, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await asegurarTablas();
    const [[g]] = await pool.query("SELECT id, anulado FROM gastos WHERE id = ? AND clinica_id = ?", [req.params.id, clinicaId]);
    if (!g) return res.status(404).json({ ok: false, msg: "Gasto no encontrado." });
    if (g.anulado) return res.status(400).json({ ok: false, msg: "Este gasto está anulado y ya no se puede editar." });
    const { error, datos } = await leerGasto(req.body || {}, clinicaId);
    if (error) return res.status(400).json({ ok: false, msg: error });
    await pool.query(
      `UPDATE gastos SET categoria_id=?, descripcion=?, monto=?, fecha=?, metodo=?, proveedor=?, comprobante=?, fijo=?, notas=?, actualizado_en=NOW()
       WHERE id = ? AND clinica_id = ?`,
      [datos.categoria_id, datos.descripcion, datos.monto, datos.fecha, datos.metodo, datos.proveedor, datos.comprobante, datos.fijo, datos.notas, g.id, clinicaId]
    );
    if (req.body?.sucursal_id) {
      const sucursalId = await sucursalParaGuardar(req, req.body.sucursal_id);
      if (sucursalId) await pool.query("UPDATE gastos SET sucursal_id = ? WHERE id = ?", [sucursalId, g.id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

router.post("/gastos/:id/anular", ...base, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await asegurarTablas();
    const motivo = String(req.body?.motivo || "").trim().slice(0, 250) || null;
    const [r] = await pool.query(
      "UPDATE gastos SET anulado = 1, anulado_por = ?, anulado_en = NOW(), motivo_anulacion = ? WHERE id = ? AND clinica_id = ? AND anulado = 0",
      [req.user.id, motivo, req.params.id, clinicaId]
    );
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "Gasto no encontrado o ya anulado." });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ── Gastos fijos (alquiler, sueldos…): copiar los del mes anterior ───────────
async function fijosPendientes(clinicaId, mes, suc = SIN_FILTRO) {
  const anterior = rangoMes(mesMas(mes, -1));
  const actual = rangoMes(mes);
  const [previos] = await pool.query(
    `${SELECT_GASTO} WHERE g.clinica_id = ? AND g.fijo = 1 AND g.anulado = 0 AND g.fecha BETWEEN ? AND ?${suc.g.sql} ORDER BY g.fecha, g.id`,
    [clinicaId, anterior.desde, anterior.hasta, ...suc.g.params]
  );
  const [yaEste] = await pool.query(
    `SELECT categoria_id, descripcion, sucursal_id FROM gastos WHERE clinica_id = ? AND anulado = 0 AND fecha BETWEEN ? AND ?${suc.gs.sql}`,
    [clinicaId, actual.desde, actual.hasta, ...suc.gs.params]
  );
  const clave = (g) => `${g.categoria_id || 0}|${g.sucursal_id || 0}|${String(g.descripcion).toLowerCase().trim()}`;
  const hechos = new Set(yaEste.map(clave));
  const ultimoDia = Number(actual.hasta.slice(8, 10));
  return previos.filter((g) => !hechos.has(clave(g))).map((g) => ({
    ...g,
    fecha_nueva: `${mes}-${String(Math.min(Number(g.fecha.slice(8, 10)), ultimoDia)).padStart(2, "0")}`,
  }));
}

router.get("/fijos-pendientes", ...base, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await asegurarTablas();
    const mes = esMes(req.query.mes) ? req.query.mes : ahoraClinica(await zonaClinica(clinicaId)).format("YYYY-MM");
    res.json({ ok: true, mes, data: await fijosPendientes(clinicaId, mes, await filtrosSucursal(req)) });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

router.post("/copiar-fijos", ...base, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await asegurarTablas();
    const mes = String(req.body?.mes || "");
    if (!esMes(mes)) return res.status(400).json({ ok: false, msg: "Mes no válido." });
    const elegidos = new Set((req.body?.ids || []).map(Number));
    const pendientes = (await fijosPendientes(clinicaId, mes, await filtrosSucursal(req))).filter((g) => !elegidos.size || elegidos.has(g.id));
    for (const g of pendientes) {
      await pool.query(
        `INSERT INTO gastos (clinica_id, categoria_id, descripcion, monto, fecha, metodo, proveedor, comprobante, fijo, notas, creado_por, sucursal_id)
         VALUES (?,?,?,?,?,?,?,NULL,1,?,?,?)`,
        [clinicaId, g.categoria_id, g.descripcion, g.monto, g.fecha_nueva, g.metodo, g.proveedor, g.notas, req.user.id, g.sucursal_id || null]
      );
    }
    res.json({ ok: true, copiados: pendientes.length });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ── Resumen ──────────────────────────────────────────────────────────────────
async function ingresosEntre(clinicaId, tz, desde, hasta, suc = SIN_FILTRO) {
  const PL = localSql("p.registrado_en", tz);
  const [[t]] = await pool.query(
    `SELECT COALESCE(SUM(p.monto),0) AS total, COUNT(*) AS cantidad
     FROM pagos p LEFT JOIN facturas f ON f.id = p.factura_id
     WHERE p.clinica_id = ? AND (f.id IS NULL OR f.estado <> 'ANULADA') AND DATE(${PL}) BETWEEN ? AND ?${suc.f.sql}`,
    [clinicaId, desde, hasta, ...suc.f.params]
  );
  return { total: num(t.total), cantidad: Number(t.cantidad) };
}
async function gastosEntre(clinicaId, desde, hasta, suc = SIN_FILTRO) {
  const [[t]] = await pool.query(
    `SELECT COALESCE(SUM(monto),0) AS total, COUNT(*) AS cantidad FROM gastos WHERE clinica_id = ? AND anulado = 0 AND fecha BETWEEN ? AND ?${suc.gs.sql}`,
    [clinicaId, desde, hasta, ...suc.gs.params]
  );
  return { total: num(t.total), cantidad: Number(t.cantidad) };
}

router.get("/resumen", ...base, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await categoriasDe(clinicaId);
    const tz = await zonaClinica(clinicaId);
    const hoy = ahoraClinica(tz);
    const mes = esMes(req.query.mes) ? req.query.mes : hoy.format("YYYY-MM");
    const { desde, hasta } = rangoMes(mes);
    const ant = rangoMes(mesMas(mes, -1));
    const suc = await filtrosSucursal(req);

    const [ingresos, gastos, ingAnt, gasAnt] = await Promise.all([
      ingresosEntre(clinicaId, tz, desde, hasta, suc), gastosEntre(clinicaId, desde, hasta, suc),
      ingresosEntre(clinicaId, tz, ant.desde, ant.hasta, suc), gastosEntre(clinicaId, ant.desde, ant.hasta, suc),
    ]);

    const PL = localSql("p.registrado_en", tz);
    const [porMetodo] = await pool.query(
      `SELECT p.metodo, COALESCE(SUM(p.monto),0) AS total FROM pagos p LEFT JOIN facturas f ON f.id = p.factura_id
       WHERE p.clinica_id = ? AND (f.id IS NULL OR f.estado <> 'ANULADA') AND DATE(${PL}) BETWEEN ? AND ?${suc.f.sql}
       GROUP BY p.metodo ORDER BY total DESC`,
      [clinicaId, desde, hasta, ...suc.f.params]
    );
    const [porCategoria] = await pool.query(
      `SELECT c.id, COALESCE(c.nombre, 'Sin categoría') AS categoria, c.icono, c.color, SUM(g.monto) AS total, COUNT(*) AS cantidad
       FROM gastos g LEFT JOIN gastos_categorias c ON c.id = g.categoria_id
       WHERE g.clinica_id = ? AND g.anulado = 0 AND g.fecha BETWEEN ? AND ?${suc.g.sql}
       GROUP BY c.id, c.nombre, c.icono, c.color ORDER BY total DESC`,
      [clinicaId, desde, hasta, ...suc.g.params]
    );

    // Últimos 6 meses (terminando en el mes elegido)
    const primerMes = mesMas(mes, -5);
    const [ingMes] = await pool.query(
      `SELECT DATE_FORMAT(${PL}, '%Y-%m') AS mes, SUM(p.monto) AS total FROM pagos p LEFT JOIN facturas f ON f.id = p.factura_id
       WHERE p.clinica_id = ? AND (f.id IS NULL OR f.estado <> 'ANULADA') AND DATE(${PL}) BETWEEN ? AND ?${suc.f.sql}
       GROUP BY DATE_FORMAT(${PL}, '%Y-%m')`,
      [clinicaId, `${primerMes}-01`, hasta, ...suc.f.params]
    );
    const [gasMes] = await pool.query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, SUM(monto) AS total FROM gastos
       WHERE clinica_id = ? AND anulado = 0 AND fecha BETWEEN ? AND ?${suc.gs.sql} GROUP BY DATE_FORMAT(fecha, '%Y-%m')`,
      [clinicaId, `${primerMes}-01`, hasta, ...suc.gs.params]
    );
    const serie = [];
    for (let i = 0; i < 6; i++) {
      const m = mesMas(primerMes, i);
      const ing = num(ingMes.find((x) => x.mes === m)?.total);
      const gas = num(gasMes.find((x) => x.mes === m)?.total);
      serie.push({ mes: m, ingresos: ing, gastos: gas, ganancia: num(ing - gas) });
    }

    const porCobrar = await saldoPorCobrar(clinicaId, suc);

    res.json({
      ok: true,
      data: {
        mes, desde, hasta, hoy: hoyClinica(tz),
        ingresos: ingresos.total, pagos: ingresos.cantidad,
        gastos: gastos.total, cantidad_gastos: gastos.cantidad,
        ganancia: num(ingresos.total - gastos.total),
        margen: ingresos.total > 0 ? Math.round(((ingresos.total - gastos.total) / ingresos.total) * 1000) / 10 : null,
        anterior: { mes: mesMas(mes, -1), ingresos: ingAnt.total, gastos: gasAnt.total, ganancia: num(ingAnt.total - gasAnt.total) },
        por_metodo: porMetodo.map((x) => ({ metodo: x.metodo, total: num(x.total) })),
        por_categoria: porCategoria.map((x) => ({ ...x, total: num(x.total), cantidad: Number(x.cantidad) })),
        serie,
        por_cobrar: porCobrar,
      },
    });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ── Cuentas por cobrar ───────────────────────────────────────────────────────
const SQL_POR_COBRAR = (FL) => `
  SELECT f.id, f.numero, f.numero_completo, f.total, f.moneda,
         COALESCE((SELECT SUM(monto) FROM pagos WHERE factura_id = f.id), 0) AS pagado,
         DATE_FORMAT(${FL}, '%Y-%m-%d') AS fecha,
         p.id AS paciente_id, TRIM(CONCAT(p.nombres, ' ', p.apellidos)) AS paciente, p.telefono,
         TRIM(CONCAT(COALESCE(u.nombres,''), ' ', COALESCE(u.apellidos,''))) AS medico
  FROM facturas f
  LEFT JOIN pacientes p ON p.id = f.paciente_id
  LEFT JOIN usuarios u ON u.id = f.medico_id
  WHERE f.clinica_id = ? AND f.estado = 'PENDIENTE'`;

async function listaPorCobrar(clinicaId, suc = SIN_FILTRO) {
  const tz = await zonaClinica(clinicaId);
  const [rows] = await pool.query(`${SQL_POR_COBRAR(localSql("f.creado_en", tz))}${suc.f.sql} ORDER BY f.creado_en ASC`, [clinicaId, ...suc.f.params]);
  const hoy = hoyClinica(tz);
  const dias = (f) => Math.max(0, Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${f}T00:00:00Z`)) / 86400000));
  return rows
    .map((r) => ({ ...r, total: num(r.total), pagado: num(r.pagado), saldo: num(r.total - r.pagado), dias: dias(r.fecha) }))
    .filter((r) => r.saldo > 0);
}

async function saldoPorCobrar(clinicaId, suc = SIN_FILTRO) {
  const lista = await listaPorCobrar(clinicaId, suc);
  const tramo = (min, max) => num(lista.filter((r) => r.dias >= min && r.dias <= max).reduce((s, r) => s + r.saldo, 0));
  return {
    total: num(lista.reduce((s, r) => s + r.saldo, 0)),
    facturas: lista.length,
    tramos: { "0-30": tramo(0, 30), "31-60": tramo(31, 60), "61-90": tramo(61, 90), "90+": tramo(91, 1e9) },
  };
}

router.get("/por-cobrar", ...base, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    const suc = await filtrosSucursal(req);
    const lista = await listaPorCobrar(clinicaId, suc);
    res.json({ ok: true, data: lista, resumen: await saldoPorCobrar(clinicaId, suc) });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ── Exportar a Excel ─────────────────────────────────────────────────────────
router.get("/exportar", ...base, async (req, res) => {
  try {
    const ExcelJS = require("exceljs");
    const clinicaId = clinicaDe(req);
    await asegurarTablas();
    const tz = await zonaClinica(clinicaId);
    const hoy = ahoraClinica(tz);
    let { desde, hasta } = req.query;
    if (!esFecha(desde) || !esFecha(hasta)) ({ desde, hasta } = rangoMes(hoy.format("YYYY-MM")));

    const PL = localSql("p.registrado_en", tz);
    const suc = await filtrosSucursal(req);
    const [ingresos] = await pool.query(
      `SELECT DATE_FORMAT(${PL}, '%d/%m/%Y %H:%i') AS fecha, p.metodo, p.monto, p.referencia,
              COALESCE(f.numero_completo, f.numero, f.id) AS factura, TRIM(CONCAT(pa.nombres, ' ', pa.apellidos)) AS paciente
       FROM pagos p LEFT JOIN facturas f ON f.id = p.factura_id LEFT JOIN pacientes pa ON pa.id = f.paciente_id
       WHERE p.clinica_id = ? AND (f.id IS NULL OR f.estado <> 'ANULADA') AND DATE(${PL}) BETWEEN ? AND ?${suc.f.sql}
       ORDER BY p.registrado_en`,
      [clinicaId, desde, hasta, ...suc.f.params]
    );
    const [gastos] = await pool.query(
      `${SELECT_GASTO} WHERE g.clinica_id = ? AND g.anulado = 0 AND g.fecha BETWEEN ? AND ?${suc.g.sql} ORDER BY g.fecha, g.id`,
      [clinicaId, desde, hasta, ...suc.g.params]
    );
    const totalIng = num(ingresos.reduce((s, r) => s + Number(r.monto), 0));
    const totalGas = num(gastos.reduce((s, r) => s + Number(r.monto), 0));

    const wb = new ExcelJS.Workbook();
    wb.creator = "Medic-KG";
    const cab = (hoja) => {
      const r = hoja.getRow(1);
      r.font = { bold: true, color: { argb: "FFFFFFFF" } };
      r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A6E" } };
    };
    const fmtDinero = "#,##0.00";

    const res1 = wb.addWorksheet("Resumen");
    res1.columns = [{ header: "Concepto", key: "c", width: 34 }, { header: "Monto", key: "m", width: 18 }];
    cab(res1);
    const fd = (s) => s.split("-").reverse().join("/");
    res1.addRow({ c: `Período: ${fd(desde)} al ${fd(hasta)}` });
    res1.addRow({ c: "Ingresos (pagos recibidos)", m: totalIng });
    res1.addRow({ c: "Gastos", m: totalGas });
    const filaG = res1.addRow({ c: "Ganancia", m: num(totalIng - totalGas) });
    filaG.font = { bold: true };
    res1.addRow({});
    res1.addRow({ c: "Gastos por categoría" }).font = { bold: true };
    const porCat = {};
    for (const g of gastos) porCat[g.categoria || "Sin categoría"] = num((porCat[g.categoria || "Sin categoría"] || 0) + Number(g.monto));
    Object.entries(porCat).sort((a, b) => b[1] - a[1]).forEach(([c, m]) => res1.addRow({ c, m }));
    res1.getColumn(2).numFmt = fmtDinero;

    const h2 = wb.addWorksheet("Ingresos");
    h2.columns = [
      { header: "Fecha", key: "fecha", width: 18 }, { header: "Paciente", key: "paciente", width: 30 },
      { header: "Factura", key: "factura", width: 18 }, { header: "Método", key: "metodo", width: 15 },
      { header: "Referencia", key: "referencia", width: 18 }, { header: "Monto", key: "monto", width: 14 },
    ];
    cab(h2);
    ingresos.forEach((r) => h2.addRow({ ...r, monto: Number(r.monto) }));
    h2.addRow({ referencia: "TOTAL", monto: totalIng }).font = { bold: true };
    h2.getColumn("monto").numFmt = fmtDinero;

    const h3 = wb.addWorksheet("Gastos");
    h3.columns = [
      { header: "Fecha", key: "fecha", width: 12 }, { header: "Categoría", key: "categoria", width: 26 },
      { header: "Descripción", key: "descripcion", width: 36 }, { header: "Proveedor", key: "proveedor", width: 22 },
      { header: "Comprobante", key: "comprobante", width: 16 }, { header: "Método", key: "metodo", width: 15 },
      { header: "Fijo", key: "fijo", width: 7 }, { header: "Monto", key: "monto", width: 14 },
    ];
    cab(h3);
    gastos.forEach((g) => h3.addRow({ ...g, fecha: fd(g.fecha), fijo: g.fijo ? "Sí" : "", monto: Number(g.monto) }));
    h3.addRow({ metodo: "TOTAL", monto: totalGas }).font = { bold: true };
    h3.getColumn("monto").numFmt = fmtDinero;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="finanzas_${desde}_a_${hasta}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

module.exports = router;
