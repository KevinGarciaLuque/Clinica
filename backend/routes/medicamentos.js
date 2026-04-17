/**
 * Catálogo de Medicamentos (compartido, sin clinica_id — o por clinica si se prefiere)
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

/**
 * GET /api/medicamentos/favoritos
 * Lista los IDs de medicamentos favoritos del médico autenticado
 */
router.get("/favoritos", auth(), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT medicamento_id FROM medicamentos_favoritos WHERE medico_id = ?",
      [req.user.id]
    );
    res.json({ ok: true, data: rows.map(r => r.medicamento_id) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/medicamentos/favoritos/:id
 * Toggle favorito: si ya existe lo elimina, si no existe lo crea
 */
router.post("/favoritos/:id", auth(), async (req, res) => {
  try {
    const medId = req.params.id;
    const [[existing]] = await pool.query(
      "SELECT id FROM medicamentos_favoritos WHERE medico_id = ? AND medicamento_id = ?",
      [req.user.id, medId]
    );
    if (existing) {
      await pool.query(
        "DELETE FROM medicamentos_favoritos WHERE medico_id = ? AND medicamento_id = ?",
        [req.user.id, medId]
      );
      res.json({ ok: true, favorito: false });
    } else {
      await pool.query(
        "INSERT INTO medicamentos_favoritos (medico_id, medicamento_id) VALUES (?, ?)",
        [req.user.id, medId]
      );
      res.json({ ok: true, favorito: true });
    }
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/medicamentos?q=&page=1
 * Búsqueda de medicamentos — los favoritos del médico aparecen primero
 */
router.get("/", auth(), async (req, res) => {
  try {
    const { q = "", page = 1 } = req.query;
    const limit  = 30;
    const offset = (page - 1) * limit;

    // Columna calculada: 1 si es favorito del médico, 0 si no
    let sql = `
      SELECT m.*,
        CASE WHEN mf.id IS NOT NULL THEN 1 ELSE 0 END AS es_favorito
      FROM medicamentos m
      LEFT JOIN medicamentos_favoritos mf
        ON mf.medicamento_id = m.id AND mf.medico_id = ?
      WHERE m.activo = 1
    `;
    const params = [req.user.id];

    if (q.length >= 2) {
      sql += " AND (m.nombre_generico LIKE ? OR m.nombre_comercial LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += " ORDER BY es_favorito DESC, m.nombre_generico ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/medicamentos/:id
 */
router.get("/:id", auth(), async (req, res) => {
  try {
    const [[m]] = await pool.query("SELECT * FROM medicamentos WHERE id = ?", [req.params.id]);
    if (!m) return res.status(404).json({ ok: false, msg: "No encontrado" });
    res.json({ ok: true, data: m });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/medicamentos
 */
router.post("/", auth("ADMIN","SUPER_ADMIN","MEDICO"), async (req, res) => {
  try {
    const {
      nombre_generico, nombre_comercial,
      presentacion, via_administracion, contraindicaciones,
      dosis_default, duracion_default, cantidad_default, instrucciones_default,
    } = req.body;

    if (!nombre_generico) return res.status(400).json({ ok: false, msg: "nombre_generico requerido" });

    const [r] = await pool.query(
      `INSERT INTO medicamentos
         (nombre_generico, nombre_comercial, presentacion, via_administracion, contraindicaciones,
          dosis_default, duracion_default, cantidad_default, instrucciones_default)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [nombre_generico, nombre_comercial || null, presentacion || null, via_administracion || null, contraindicaciones || null,
       dosis_default || null, duracion_default || null, cantidad_default || null, instrucciones_default || null]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * PUT /api/medicamentos/:id
 */
router.put("/:id", auth("ADMIN","SUPER_ADMIN","MEDICO"), async (req, res) => {
  try {
    const {
      nombre_generico, nombre_comercial,
      presentacion, via_administracion, contraindicaciones,
      dosis_default, duracion_default, cantidad_default, instrucciones_default,
    } = req.body;

    await pool.query(
      `UPDATE medicamentos
       SET nombre_generico=?, nombre_comercial=?,
           presentacion=?, via_administracion=?, contraindicaciones=?,
           dosis_default=?, duracion_default=?, cantidad_default=?, instrucciones_default=?
       WHERE id=?`,
      [nombre_generico, nombre_comercial || null, presentacion || null, via_administracion || null, contraindicaciones || null,
       dosis_default || null, duracion_default || null, cantidad_default || null, instrucciones_default || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * DELETE /api/medicamentos/:id  — toggle activo
 */
router.delete("/:id", auth("ADMIN","SUPER_ADMIN","MEDICO"), async (req, res) => {
  try {
    await pool.query(
      "UPDATE medicamentos SET activo = NOT activo WHERE id = ?",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
