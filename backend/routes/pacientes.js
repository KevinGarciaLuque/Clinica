const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");

// GET /api/pacientes
router.get("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const q = (req.query.q || "").trim();
    let sql =
      "SELECT id, nombres, apellidos, dni, telefono, email, activo, creado_en FROM pacientes WHERE clinica_id=? ";
    const params = [clinicaId];

    if (q) {
      sql += " AND (nombres LIKE ? OR apellidos LIKE ? OR dni LIKE ? OR telefono LIKE ?) ";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += " ORDER BY id DESC LIMIT 200";

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/pacientes/:id
router.get("/:id", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const [[p]] = await pool.query(
      "SELECT * FROM pacientes WHERE id = ? AND clinica_id = ?",
      [req.params.id, clinicaId]
    );
    if (!p) return res.status(404).json({ ok: false, msg: "No encontrado" });
    res.json({ ok: true, data: p });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/pacientes
router.post("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const { nombres, apellidos, dni, telefono, email, fecha_nacimiento, sexo, direccion } = req.body;

    if (!nombres || !apellidos) {
      return res.status(400).json({ ok: false, msg: "nombres y apellidos son obligatorios" });
    }

    const [r] = await pool.query(
      `INSERT INTO pacientes
         (clinica_id, nombres, apellidos, dni, telefono, email, fecha_nacimiento, sexo,
          direccion, ciudad, pais, grupo_sanguineo, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clinicaId, nombres, apellidos,
        dni || null, telefono || null, email || null,
        fecha_nacimiento || null, sexo || null,
        direccion || null,
        req.body.ciudad || null,
        req.body.pais   || null,
        req.body.grupo_sanguineo || null,
        req.body.notas  || null,
      ]
    );

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /api/pacientes/:id ────────────────────────────────
router.put("/:id", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const { id }    = req.params;

    const {
      nombres, apellidos, dni, telefono, email,
      fecha_nacimiento, sexo, direccion, ciudad, pais,
      grupo_sanguineo, notas, activo,
    } = req.body;

    const [[exists]] = await pool.query(
      "SELECT id FROM pacientes WHERE id=? AND clinica_id=?",
      [id, clinicaId]
    );
    if (!exists) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    await pool.query(
      `UPDATE pacientes SET
         nombres=COALESCE(?,nombres), apellidos=COALESCE(?,apellidos),
         dni=COALESCE(?,dni), telefono=COALESCE(?,telefono), email=COALESCE(?,email),
         fecha_nacimiento=COALESCE(?,fecha_nacimiento), sexo=COALESCE(?,sexo),
         direccion=COALESCE(?,direccion), ciudad=COALESCE(?,ciudad), pais=COALESCE(?,pais),
         grupo_sanguineo=COALESCE(?,grupo_sanguineo), notas=COALESCE(?,notas),
         activo=COALESCE(?,activo)
       WHERE id=? AND clinica_id=?`,
      [
        nombres||null, apellidos||null,
        dni||null, telefono||null, email||null,
        fecha_nacimiento||null, sexo||null,
        direccion||null, ciudad||null, pais||null,
        grupo_sanguineo||null, notas||null,
        activo ?? null,
        id, clinicaId,
      ]
    );

    res.json({ ok: true, msg: "Paciente actualizado" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
