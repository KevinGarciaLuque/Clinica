/**
 * routes/sucursales.js — Sucursales de la clínica.
 *
 *  GET  /api/sucursales                     → sucursales activas que puede elegir el usuario (selector de arriba)
 *  GET  /api/sucursales/admin               → todas (activas e inactivas) + usuarios con sus sucursales (ADMIN)
 *  POST /api/sucursales                     → crear sucursal (ADMIN)
 *  PUT  /api/sucursales/:id                 → editar / activar / desactivar (ADMIN)
 *  PUT  /api/sucursales/usuario/:usuarioId  → en qué sucursales trabaja un usuario (ADMIN)
 */
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");
const { asegurarSucursales, sucursalesDe, olvidar } = require("../utils/sucursales");

const clinicaDe = (req) => (req.user.super ? req.tenant?.clinica_id : req.user.clinica_id);
/**
 * Quién administra las sucursales: ADMIN, o el médico dueño
 * (clínica sin ADMIN activo, igual que en Finanzas).
 */
async function puedeAdministrar(req) {
  if (["ADMIN", "SUPER_ADMIN"].includes(req.user.tipo)) return true;
  if (!["MEDICO", "PSICOLOGO"].includes(req.user.tipo)) return false;
  const [[a]] = await pool.query(
    "SELECT COUNT(*) AS n FROM usuarios WHERE clinica_id = ? AND tipo = 'ADMIN' AND activo = 1",
    [req.user.clinica_id]
  );
  return Number(a?.n || 0) === 0;
}
const soloAdministra = async (req, res, next) => {
  try {
    if (await puedeAdministrar(req)) return next();
    res.status(403).json({ ok: false, msg: "Solo la administración de la clínica puede cambiar las sucursales." });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
};
const texto = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);

/** La sede principal se crea sola la primera vez (con los datos de la clínica) */
async function asegurarPrincipal(clinicaId) {
  await asegurarSucursales();
  const [[ya]] = await pool.query("SELECT id FROM sucursales WHERE clinica_id = ? AND es_principal = 1 LIMIT 1", [clinicaId]);
  if (ya) return ya.id;
  const [[c]] = await pool.query("SELECT direccion, telefono FROM clinicas WHERE id = ?", [clinicaId]);
  const [r] = await pool.query(
    "INSERT INTO sucursales (clinica_id, nombre, direccion, telefono, es_principal, orden) VALUES (?, 'Sede principal', ?, ?, 1, 0)",
    [clinicaId, c?.direccion || null, c?.telefono || null]
  );
  olvidar(clinicaId);
  return r.insertId;
}

router.get("/", auth(), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    if (!clinicaId) return res.json({ ok: true, data: { multiple: false, sucursales: [], puede_todas: true } });
    const lista = await sucursalesDe(clinicaId);
    const puede_administrar = await puedeAdministrar(req);
    if (lista.length < 2) return res.json({ ok: true, data: { multiple: false, sucursales: lista, puede_todas: true, puede_administrar } });

    let permitidas = lista;
    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.tipo)) {
      const [rows] = await pool.query("SELECT sucursal_id FROM usuario_sucursales WHERE usuario_id = ?", [req.user.id]);
      const ids = new Set(rows.map((r) => r.sucursal_id));
      const propias = lista.filter((s) => ids.has(s.id));
      if (propias.length) permitidas = propias;
    }
    res.json({
      ok: true,
      data: { multiple: true, sucursales: permitidas, puede_todas: permitidas.length > 1, puede_administrar },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.get("/admin", auth("ADMIN", "SUPER_ADMIN", "MEDICO", "PSICOLOGO"), soloAdministra, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Seleccione una clínica." });
    await asegurarPrincipal(clinicaId);
    const [sucursales] = await pool.query(
      `SELECT s.id, s.nombre, s.direccion, s.telefono, s.es_principal, s.activo,
              (SELECT COUNT(*) FROM usuario_sucursales us JOIN usuarios u ON u.id = us.usuario_id
                WHERE us.sucursal_id = s.id AND u.activo = 1) AS usuarios
       FROM sucursales s WHERE s.clinica_id = ? ORDER BY s.es_principal DESC, s.orden, s.id`,
      [clinicaId]
    );
    const [usuarios] = await pool.query(
      `SELECT id, nombres, apellidos, tipo FROM usuarios
       WHERE clinica_id = ? AND activo = 1 AND tipo <> 'SUPER_ADMIN' ORDER BY nombres, apellidos`,
      [clinicaId]
    );
    const [asig] = await pool.query(
      `SELECT us.usuario_id, us.sucursal_id FROM usuario_sucursales us
       JOIN sucursales s ON s.id = us.sucursal_id WHERE s.clinica_id = ?`,
      [clinicaId]
    );
    for (const u of usuarios) u.sucursales = asig.filter((a) => a.usuario_id === u.id).map((a) => a.sucursal_id);
    res.json({ ok: true, data: { sucursales, usuarios } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/", auth("ADMIN", "SUPER_ADMIN", "MEDICO", "PSICOLOGO"), soloAdministra, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Seleccione una clínica." });
    const nombre = texto(req.body?.nombre, 120);
    if (!nombre) return res.status(400).json({ ok: false, msg: "Escriba el nombre de la sucursal." });
    await asegurarPrincipal(clinicaId);
    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM sucursales WHERE clinica_id = ?", [clinicaId]);
    if (n >= 30) return res.status(400).json({ ok: false, msg: "Se alcanzó el máximo de sucursales." });
    const [r] = await pool.query(
      "INSERT INTO sucursales (clinica_id, nombre, direccion, telefono, orden) VALUES (?,?,?,?,?)",
      [clinicaId, nombre, texto(req.body.direccion, 255), texto(req.body.telefono, 40), n]
    );
    olvidar(clinicaId);
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.put("/:id(\\d+)", auth("ADMIN", "SUPER_ADMIN", "MEDICO", "PSICOLOGO"), soloAdministra, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await asegurarSucursales();
    const [[s]] = await pool.query("SELECT id, es_principal FROM sucursales WHERE id = ? AND clinica_id = ?", [req.params.id, clinicaId]);
    if (!s) return res.status(404).json({ ok: false, msg: "Sucursal no encontrada." });
    const b = req.body || {};
    if (b.nombre !== undefined && !texto(b.nombre, 120)) return res.status(400).json({ ok: false, msg: "Escriba el nombre de la sucursal." });
    if (b.activo !== undefined && !b.activo && s.es_principal) {
      return res.status(400).json({ ok: false, msg: "La sede principal no se puede desactivar." });
    }
    await pool.query(
      `UPDATE sucursales SET
         nombre = COALESCE(?, nombre),
         direccion = IF(?, ?, direccion),
         telefono = IF(?, ?, telefono),
         activo = COALESCE(?, activo)
       WHERE id = ? AND clinica_id = ?`,
      [
        b.nombre !== undefined ? texto(b.nombre, 120) : null,
        b.direccion !== undefined, texto(b.direccion, 255),
        b.telefono !== undefined, texto(b.telefono, 40),
        b.activo !== undefined ? (b.activo ? 1 : 0) : null,
        s.id, clinicaId,
      ]
    );
    olvidar(clinicaId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.put("/usuario/:usuarioId(\\d+)", auth("ADMIN", "SUPER_ADMIN", "MEDICO", "PSICOLOGO"), soloAdministra, async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await asegurarSucursales();
    const [[u]] = await pool.query("SELECT id FROM usuarios WHERE id = ? AND clinica_id = ?", [req.params.usuarioId, clinicaId]);
    if (!u) return res.status(404).json({ ok: false, msg: "Usuario no encontrado." });
    const pedidas = Array.isArray(req.body?.sucursales) ? req.body.sucursales.map(Number).filter(Boolean) : [];
    const [validas] = pedidas.length
      ? await pool.query("SELECT id FROM sucursales WHERE clinica_id = ? AND id IN (?)", [clinicaId, pedidas])
      : [[]];
    await pool.query(
      "DELETE us FROM usuario_sucursales us JOIN sucursales s ON s.id = us.sucursal_id WHERE us.usuario_id = ? AND s.clinica_id = ?",
      [u.id, clinicaId]
    );
    if (validas.length) {
      await pool.query("INSERT INTO usuario_sucursales (usuario_id, sucursal_id) VALUES ?", [validas.map((v) => [u.id, v.id])]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
