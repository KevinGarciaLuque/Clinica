/**
 * Catálogos de Diagnóstico frecuentes (plantillas SOAP)
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

/**
 * GET /api/catalogos-diagnostico?q=&especialidad=
 */
router.get("/", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    const { q = "", especialidad = "" } = req.query;

    let sql = `SELECT * FROM catalogos_diagnostico WHERE activo = 1 AND (clinica_id = ? OR clinica_id IS NULL)`;
    const params = [clinicaId];

    if (especialidad) {
      sql += " AND especialidad = ?";
      params.push(especialidad);
    }

    if (q.length >= 2) {
      sql += " AND (nombre LIKE ? OR codigo_cie LIKE ? OR descripcion_cie LIKE ?)";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += " ORDER BY especialidad ASC, nombre ASC LIMIT 200";
    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/catalogos-diagnostico/:id
 */
router.get("/:id", auth(), async (req, res) => {
  try {
    const [[row]] = await pool.query("SELECT * FROM catalogos_diagnostico WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ ok: false, msg: "No encontrado" });
    res.json({ ok: true, data: row });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/catalogos-diagnostico
 */
router.post("/", auth("ADMIN","SUPER_ADMIN","MEDICO"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    const { nombre, especialidad, codigo_cie, descripcion_cie, diagnosticos_secundarios } = req.body;

    if (!nombre || !codigo_cie) {
      return res.status(400).json({ ok: false, msg: "nombre y codigo_cie son requeridos" });
    }

    const [r] = await pool.query(
      `INSERT INTO catalogos_diagnostico
         (clinica_id, medico_id, nombre, especialidad, codigo_cie, descripcion_cie, diagnosticos_secundarios)
       VALUES (?,?,?,?,?,?,?)`,
      [clinicaId, req.user.id, nombre, especialidad || null, codigo_cie, descripcion_cie,
       diagnosticos_secundarios ? JSON.stringify(diagnosticos_secundarios) : null]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * PUT /api/catalogos-diagnostico/:id
 */
router.put("/:id", auth("ADMIN","SUPER_ADMIN","MEDICO"), async (req, res) => {
  try {
    const { nombre, especialidad, codigo_cie, descripcion_cie, diagnosticos_secundarios } = req.body;

    await pool.query(
      `UPDATE catalogos_diagnostico
       SET nombre=?, especialidad=?, codigo_cie=?, descripcion_cie=?, diagnosticos_secundarios=?
       WHERE id=?`,
      [nombre, especialidad || null, codigo_cie, descripcion_cie,
       diagnosticos_secundarios ? JSON.stringify(diagnosticos_secundarios) : null,
       req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * DELETE /api/catalogos-diagnostico/:id — toggle activo
 */
router.delete("/:id", auth("ADMIN","SUPER_ADMIN","MEDICO"), async (req, res) => {
  try {
    await pool.query(
      "UPDATE catalogos_diagnostico SET activo = NOT activo WHERE id = ?",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
