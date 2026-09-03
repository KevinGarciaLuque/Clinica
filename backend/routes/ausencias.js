/**
 * routes/ausencias.js
 * Ausencias de médicos: vacaciones, permisos, incapacidades, capacitación.
 * Capa aparte de horarios_medico — solo resta disponibilidad en fechas concretas.
 *
 * GET    /api/ausencias?medico_id=&desde=&hasta=
 * GET    /api/ausencias/conflictos?medico_id=&fecha_inicio=&fecha_fin=&hora_inicio=&hora_fin=
 * POST   /api/ausencias
 * PUT    /api/ausencias/:id
 * DELETE /api/ausencias/:id
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const TIPOS = ["vacaciones", "permiso", "incapacidad", "capacitacion", "otro"];

const clinicaOf = (req) =>
  req.user.super ? (req.query.clinica_id || req.tenant?.clinica_id) : req.user.clinica_id;

// El MEDICO/PSICOLOGO solo administra las suyas; ADMIN/SUPER_ADMIN cualquiera de la clínica.
const puedeGestionar = (req, medicoId) =>
  ["ADMIN", "SUPER_ADMIN"].includes(req.user.tipo) || Number(medicoId) === Number(req.user.id);

let tablaLista = false;
async function ensureTabla() {
  if (tablaLista) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ausencias_medico (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      clinica_id INT NOT NULL,
      medico_id INT NOT NULL,
      tipo ENUM('vacaciones','permiso','incapacidad','capacitacion','otro') NOT NULL DEFAULT 'vacaciones',
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      todo_el_dia TINYINT(1) NOT NULL DEFAULT 1,
      hora_inicio TIME NULL,
      hora_fin TIME NULL,
      motivo VARCHAR(255) NULL,
      creado_por INT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_med_rango (clinica_id, medico_id, fecha_inicio, fecha_fin)
    ) ENGINE=InnoDB
  `);
  tablaLista = true;
}

// ── Listar ──────────────────────────────────────────────────────────────
router.get("/", auth("SUPER_ADMIN", "ADMIN", "MEDICO", "PSICOLOGO", "RECEPCIONISTA", "ENFERMERA"), async (req, res) => {
  try {
    await ensureTabla();
    const clinicaId = clinicaOf(req);
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const { medico_id, desde, hasta } = req.query;
    let sql = `SELECT a.*, u.nombres, u.apellidos
               FROM ausencias_medico a
               JOIN usuarios u ON u.id = a.medico_id
               WHERE a.clinica_id = ?`;
    const params = [clinicaId];
    if (medico_id) { sql += " AND a.medico_id = ?"; params.push(medico_id); }
    if (desde)     { sql += " AND a.fecha_fin >= ?"; params.push(desde); }
    if (hasta)     { sql += " AND a.fecha_inicio <= ?"; params.push(hasta); }
    sql += " ORDER BY a.fecha_inicio DESC";

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Citas en conflicto con un rango de ausencia (para avisar) ────────────
router.get("/conflictos", auth("SUPER_ADMIN", "ADMIN", "MEDICO", "PSICOLOGO"), async (req, res) => {
  try {
    const clinicaId = clinicaOf(req);
    const { medico_id, fecha_inicio, fecha_fin, hora_inicio, hora_fin } = req.query;
    if (!medico_id || !fecha_inicio || !fecha_fin)
      return res.status(400).json({ ok: false, msg: "medico_id, fecha_inicio y fecha_fin son obligatorios" });

    let sql = `SELECT c.id, c.inicio, c.fin, c.estado,
                      p.nombres AS pac_nombres, p.apellidos AS pac_apellidos, p.telefono AS pac_tel
               FROM citas c
               JOIN pacientes p ON p.id = c.paciente_id
               WHERE c.clinica_id = ? AND c.medico_id = ?
                 AND c.estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION')
                 AND DATE(c.inicio) BETWEEN ? AND ?`;
    const params = [clinicaId, medico_id, fecha_inicio, fecha_fin];
    if (hora_inicio && hora_fin) {
      sql += " AND TIME(c.inicio) < ? AND TIME(c.fin) > ?";
      params.push(hora_fin, hora_inicio);
    }
    sql += " ORDER BY c.inicio";
    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Crear ───────────────────────────────────────────────────────────────
router.post("/", auth("SUPER_ADMIN", "ADMIN", "MEDICO", "PSICOLOGO"), async (req, res) => {
  try {
    await ensureTabla();
    const clinicaId = clinicaOf(req);
    let { medico_id, tipo, fecha_inicio, fecha_fin, todo_el_dia, hora_inicio, hora_fin, motivo } = req.body;

    if (!["ADMIN", "SUPER_ADMIN"].includes(req.user.tipo)) medico_id = req.user.id;
    if (!medico_id || !fecha_inicio || !fecha_fin)
      return res.status(400).json({ ok: false, msg: "medico_id, fecha_inicio y fecha_fin son obligatorios" });
    if (!puedeGestionar(req, medico_id))
      return res.status(403).json({ ok: false, msg: "No puedes registrar ausencias de otro médico" });
    if (tipo && !TIPOS.includes(tipo))
      return res.status(400).json({ ok: false, msg: "tipo inválido" });
    if (fecha_fin < fecha_inicio)
      return res.status(400).json({ ok: false, msg: "La fecha fin no puede ser anterior a la de inicio" });

    const full = todo_el_dia === undefined ? 1 : (todo_el_dia ? 1 : 0);
    if (!full && (!hora_inicio || !hora_fin))
      return res.status(400).json({ ok: false, msg: "En ausencia parcial indica hora de inicio y fin" });

    const [r] = await pool.query(
      `INSERT INTO ausencias_medico
         (clinica_id, medico_id, tipo, fecha_inicio, fecha_fin, todo_el_dia, hora_inicio, hora_fin, motivo, creado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [clinicaId, medico_id, tipo || "vacaciones", fecha_inicio, fecha_fin, full,
       full ? null : hora_inicio, full ? null : hora_fin, motivo || null, req.user.id]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Editar ──────────────────────────────────────────────────────────────
router.put("/:id", auth("SUPER_ADMIN", "ADMIN", "MEDICO", "PSICOLOGO"), async (req, res) => {
  try {
    const clinicaId = clinicaOf(req);
    const [[a]] = await pool.query(
      "SELECT * FROM ausencias_medico WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    if (!a) return res.status(404).json({ ok: false, msg: "No encontrada" });
    if (!puedeGestionar(req, a.medico_id))
      return res.status(403).json({ ok: false, msg: "Sin permiso" });

    const { tipo, fecha_inicio, fecha_fin, todo_el_dia, hora_inicio, hora_fin, motivo } = req.body;
    if (tipo && !TIPOS.includes(tipo))
      return res.status(400).json({ ok: false, msg: "tipo inválido" });
    const full = todo_el_dia === undefined ? a.todo_el_dia : (todo_el_dia ? 1 : 0);

    await pool.query(
      `UPDATE ausencias_medico SET
         tipo=COALESCE(?,tipo), fecha_inicio=COALESCE(?,fecha_inicio), fecha_fin=COALESCE(?,fecha_fin),
         todo_el_dia=?, hora_inicio=?, hora_fin=?, motivo=?
       WHERE id=? AND clinica_id=?`,
      [tipo || null, fecha_inicio || null, fecha_fin || null, full,
       full ? null : (hora_inicio || a.hora_inicio),
       full ? null : (hora_fin || a.hora_fin),
       motivo !== undefined ? motivo : a.motivo,
       req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Eliminar ────────────────────────────────────────────────────────────
router.delete("/:id", auth("SUPER_ADMIN", "ADMIN", "MEDICO", "PSICOLOGO"), async (req, res) => {
  try {
    const clinicaId = clinicaOf(req);
    const [[a]] = await pool.query(
      "SELECT medico_id FROM ausencias_medico WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    if (!a) return res.status(404).json({ ok: false, msg: "No encontrada" });
    if (!puedeGestionar(req, a.medico_id))
      return res.status(403).json({ ok: false, msg: "Sin permiso" });
    await pool.query("DELETE FROM ausencias_medico WHERE id=? AND clinica_id=?", [req.params.id, clinicaId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
