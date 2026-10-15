// /api/lista-espera — gestión de la lista de espera (personal de la clínica)
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");
const { asegurarTablas } = require("../utils/listaEspera");

const ROLES = ["ADMIN", "MEDICO", "PSICOLOGO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"];
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const clinicaDe = (req) => (req.user.super ? req.tenant?.clinica_id : req.user.clinica_id);

// GET /api/lista-espera  → activas + últimas 30 cerradas
router.get("/", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Selecciona una clínica" });
    await asegurarTablas();
    const columnas = `
      le.id, le.paciente_id, le.medico_id, le.nota, le.estado, le.cita_id,
      DATE_FORMAT(le.desde, '%Y-%m-%d') AS desde, DATE_FORMAT(le.hasta, '%Y-%m-%d') AS hasta,
      DATE_FORMAT(le.creado_en, '%Y-%m-%d %H:%i') AS creado_en,
      p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos, p.telefono AS paciente_telefono,
      (p.email IS NOT NULL AND p.email <> '') AS tiene_email,
      CONCAT(u.nombres, ' ', u.apellidos) AS medico,
      (SELECT COUNT(*) FROM lista_espera_ofertas o WHERE o.lista_espera_id = le.id AND o.estado <> 'ERROR') AS ofertas,
      (SELECT DATE_FORMAT(c.inicio, '%Y-%m-%d %H:%i') FROM citas c WHERE c.id = le.cita_id) AS cita_inicio`;
    const desde = `
      FROM lista_espera le
      JOIN pacientes p ON p.id = le.paciente_id
      LEFT JOIN usuarios u ON u.id = le.medico_id
      WHERE le.clinica_id = ?`;
    const [activas] = await pool.query(
      `SELECT ${columnas} ${desde} AND le.estado = 'ACTIVA' ORDER BY le.creado_en ASC`, [clinicaId]);
    const [cerradas] = await pool.query(
      `SELECT ${columnas} ${desde} AND le.estado <> 'ACTIVA' ORDER BY COALESCE(le.actualizado_en, le.creado_en) DESC LIMIT 30`,
      [clinicaId]);
    res.json({ ok: true, data: { activas, cerradas } });
  } catch (e) {
    console.error("[lista-espera] GET:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo cargar la lista de espera" });
  }
});

// POST /api/lista-espera  { paciente_id, medico_id|null, desde, hasta|null, nota }
router.post("/", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Selecciona una clínica" });
    const { paciente_id, medico_id, desde, hasta, nota } = req.body || {};
    if (!paciente_id || !FECHA_RE.test(desde || "") || (hasta && !FECHA_RE.test(hasta)))
      return res.status(400).json({ ok: false, msg: "Paciente y fecha de inicio son obligatorios" });
    if (hasta && hasta < desde)
      return res.status(400).json({ ok: false, msg: "La fecha final no puede ser anterior a la inicial" });

    await asegurarTablas();
    const [[pac]] = await pool.query("SELECT id FROM pacientes WHERE id=? AND clinica_id=?", [paciente_id, clinicaId]);
    if (!pac) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
    if (medico_id) {
      const [[med]] = await pool.query("SELECT id FROM usuarios WHERE id=? AND clinica_id=?", [medico_id, clinicaId]);
      if (!med) return res.status(404).json({ ok: false, msg: "Médico no encontrado" });
    }
    const [[dup]] = await pool.query(
      `SELECT id FROM lista_espera WHERE clinica_id=? AND paciente_id=? AND estado='ACTIVA'
         AND (medico_id <=> ?) LIMIT 1`,
      [clinicaId, paciente_id, medico_id || null]);
    if (dup) return res.status(409).json({ ok: false, msg: "Este paciente ya está en la lista de espera de ese médico" });

    const [r] = await pool.query(
      `INSERT INTO lista_espera (clinica_id, paciente_id, medico_id, desde, hasta, nota, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clinicaId, paciente_id, medico_id || null, desde, hasta || null,
       nota ? String(nota).trim().slice(0, 300) : null, req.user.id]);
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    console.error("[lista-espera] POST:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo agregar a la lista de espera" });
  }
});

// PATCH /api/lista-espera/:id  { estado: 'CANCELADA' | 'ACTIVA' }
router.patch("/:id", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    const { estado } = req.body || {};
    if (!["CANCELADA", "ACTIVA"].includes(estado))
      return res.status(400).json({ ok: false, msg: "Estado inválido" });
    await asegurarTablas();
    const [r] = await pool.query(
      `UPDATE lista_espera SET estado=?, actualizado_en=NOW()
       WHERE id=? AND clinica_id=? AND estado <> 'AGENDADA'`,
      [estado, req.params.id, clinicaId]);
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "No encontrado" });
    res.json({ ok: true });
  } catch (e) {
    console.error("[lista-espera] PATCH:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo actualizar" });
  }
});

module.exports = router;
