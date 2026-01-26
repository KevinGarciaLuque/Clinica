const router = require("express").Router();
const pool = require("../db");

// POST /api/citas
router.post("/", async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const { paciente_id, medico_id, inicio, fin, tipo_consulta, motivo, canal } = req.body;

    if (!paciente_id || !medico_id || !inicio || !fin) {
      return res.status(400).json({ ok: false, msg: "paciente_id, medico_id, inicio, fin son obligatorios" });
    }

    // Validación: evitar solapamientos con citas activas
    const [solap] = await pool.query(
      `SELECT id FROM citas
       WHERE clinica_id=?
         AND medico_id=?
         AND estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION')
         AND NOT (fin <= ? OR inicio >= ?)
       LIMIT 1`,
      [clinicaId, medico_id, inicio, fin]
    );

    if (solap.length > 0) {
      return res.status(409).json({ ok: false, msg: "Horario no disponible (solapamiento)" });
    }

    const [r] = await pool.query(
      `INSERT INTO citas (clinica_id, paciente_id, medico_id, inicio, fin, tipo_consulta, motivo, canal)
       VALUES (?,?,?,?,?,?,?,?)`,
      [clinicaId, paciente_id, medico_id, inicio, fin, tipo_consulta || "CONTROL", motivo || null, canal || "RECEPCION"]
    );

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;

