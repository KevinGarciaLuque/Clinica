/**
 * routes/horarios.js
 * Horarios semanales de los médicos por clínica
 * GET    /api/horarios?medico_id=     → horario del médico
 * POST   /api/horarios                → crear bloque horario
 * PUT    /api/horarios/:id            → editar bloque
 * DELETE /api/horarios/:id            → eliminar bloque
 */

const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

// GET /api/horarios?medico_id=
router.get("/", auth("SUPER_ADMIN","ADMIN","MEDICO","RECEPCIONISTA","ENFERMERA"), async (req, res) => {
  try {
    const clinicaId = req.user.super
      ? (req.query.clinica_id || req.tenant?.clinica_id)
      : req.user.clinica_id;

    const { medico_id } = req.query;
    let sql = `SELECT h.id, h.medico_id, h.dia_semana, h.hora_inicio, h.hora_fin,
                      h.slot_minutos, h.activo,
                      u.nombres, u.apellidos
               FROM horarios_medico h
               JOIN usuarios u ON u.id = h.medico_id
               WHERE h.clinica_id=?`;
    const params = [clinicaId];

    if (medico_id) { sql += " AND h.medico_id=?"; params.push(medico_id); }
    sql += " ORDER BY h.medico_id, h.dia_semana, h.hora_inicio";

    const [rows] = await pool.query(sql, params);
    // Añadir nombre del día
    const data = rows.map(r => ({ ...r, dia_nombre: DIAS[r.dia_semana] }));
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/horarios
router.post("/", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super
      ? (req.body.clinica_id || req.tenant?.clinica_id)
      : req.user.clinica_id;

    const { medico_id, dia_semana, hora_inicio, hora_fin, slot_minutos } = req.body;

    if (medico_id === undefined || dia_semana === undefined || !hora_inicio || !hora_fin) {
      return res.status(400).json({ ok: false, msg: "medico_id, dia_semana, hora_inicio, hora_fin son obligatorios" });
    }
    if (dia_semana < 0 || dia_semana > 6) {
      return res.status(400).json({ ok: false, msg: "dia_semana: 0=Lun, 1=Mar, ... 6=Dom" });
    }

    // Verificar que el médico pertenece a la clínica
    const [med] = await pool.query(
      "SELECT id FROM usuarios WHERE id=? AND clinica_id=? AND tipo='MEDICO'",
      [medico_id, clinicaId]
    );
    if (!med.length) return res.status(404).json({ ok: false, msg: "Médico no encontrado en esta clínica" });

    // Detectar solapamiento de horario
    const [solap] = await pool.query(
      `SELECT id FROM horarios_medico
       WHERE medico_id=? AND dia_semana=? AND activo=1
         AND NOT (hora_fin <= ? OR hora_inicio >= ?)
       LIMIT 1`,
      [medico_id, dia_semana, hora_inicio, hora_fin]
    );
    if (solap.length) {
      return res.status(409).json({ ok: false, msg: "El bloque horario se solapa con uno existente" });
    }

    const [r] = await pool.query(
      `INSERT INTO horarios_medico (clinica_id, medico_id, dia_semana, hora_inicio, hora_fin, slot_minutos)
       VALUES (?,?,?,?,?,?)`,
      [clinicaId, medico_id, dia_semana, hora_inicio, hora_fin, slot_minutos||30]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/horarios/:id
router.put("/:id", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? null : req.user.clinica_id;
    const { dia_semana, hora_inicio, hora_fin, slot_minutos, activo } = req.body;

    const sql = clinicaId
      ? `UPDATE horarios_medico SET
           dia_semana=COALESCE(?,dia_semana), hora_inicio=COALESCE(?,hora_inicio),
           hora_fin=COALESCE(?,hora_fin), slot_minutos=COALESCE(?,slot_minutos),
           activo=COALESCE(?,activo)
         WHERE id=? AND clinica_id=?`
      : `UPDATE horarios_medico SET
           dia_semana=COALESCE(?,dia_semana), hora_inicio=COALESCE(?,hora_inicio),
           hora_fin=COALESCE(?,hora_fin), slot_minutos=COALESCE(?,slot_minutos),
           activo=COALESCE(?,activo)
         WHERE id=?`;

    const params = [
      dia_semana !== undefined ? dia_semana : null,
      hora_inicio||null, hora_fin||null, slot_minutos||null,
      activo !== undefined ? activo : null,
      req.params.id,
      ...(clinicaId ? [clinicaId] : [])
    ];

    await pool.query(sql, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// DELETE /api/horarios/:id
router.delete("/:id", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? null : req.user.clinica_id;
    const sql = clinicaId
      ? "DELETE FROM horarios_medico WHERE id=? AND clinica_id=?"
      : "DELETE FROM horarios_medico WHERE id=?";
    const params = clinicaId ? [req.params.id, clinicaId] : [req.params.id];
    await pool.query(sql, params);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
