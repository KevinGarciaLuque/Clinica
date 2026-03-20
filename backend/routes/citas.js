const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");

// ──────────────────────────────────────────────
// GET /api/citas/slots?medico_id=X&fecha=YYYY-MM-DD
// Slots libres de un médico en un día (usa horarios_medico)
// ──────────────────────────────────────────────
router.get("/slots", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const { medico_id, fecha } = req.query;
    if (!medico_id || !fecha) {
      return res.status(400).json({ ok: false, msg: "medico_id y fecha son obligatorios" });
    }

    const diaSemana = new Date(fecha).getDay();          // 0=Dom
    const diaLunes  = diaSemana === 0 ? 6 : diaSemana - 1; // 0=Lun

    const [horarios] = await pool.query(
      "SELECT hora_inicio, hora_fin, slot_minutos FROM horarios_medico WHERE medico_id=? AND clinica_id=? AND dia_semana=? AND activo=1",
      [medico_id, clinicaId, diaLunes]
    );
    if (!horarios.length) return res.json({ ok: true, data: [] });

    const [ocupadas] = await pool.query(
      `SELECT inicio, fin FROM citas
       WHERE clinica_id=? AND medico_id=? AND DATE(inicio)=?
         AND estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION')`,
      [clinicaId, medico_id, fecha]
    );

    const slots = [];
    for (const h of horarios) {
      let cursor = new Date(`${fecha}T${h.hora_inicio}`);
      const fin  = new Date(`${fecha}T${h.hora_fin}`);
      while (cursor < fin) {
        const slotFin = new Date(cursor.getTime() + h.slot_minutos * 60000);
        const ocup = ocupadas.some(
          c => new Date(c.inicio) < slotFin && new Date(c.fin) > cursor
        );
        if (!ocup) {
          slots.push({
            inicio: cursor.toISOString(),
            fin:    slotFin.toISOString(),
            label:  `${cursor.toTimeString().slice(0,5)} - ${slotFin.toTimeString().slice(0,5)}`,
          });
        }
        cursor = slotFin;
      }
    }
    res.json({ ok: true, data: slots });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/citas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&medico_id=
// ──────────────────────────────────────────────
router.get("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const { desde, hasta, medico_id, paciente_id, estado } = req.query;
    let sql = `SELECT c.id, c.inicio, c.fin, c.estado, c.tipo_consulta, c.motivo, c.canal,
                      c.paciente_id, c.medico_id,
                      p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos, p.telefono AS paciente_tel, p.dni AS paciente_dni, p.email AS paciente_email,
                      u.nombres AS medico_nombres, u.apellidos AS medico_apellidos,
                      e.nombre AS especialidad
               FROM citas c
               JOIN pacientes p ON p.id = c.paciente_id
               JOIN usuarios  u ON u.id = c.medico_id
               LEFT JOIN especialidades e ON e.id = u.especialidad_id
               WHERE c.clinica_id = ?`;
    const params = [clinicaId];

    if (desde)      { sql += " AND c.inicio >= ?";      params.push(desde); }
    if (hasta)      { sql += " AND c.inicio <= ?";      params.push(hasta + " 23:59:59"); }
    if (medico_id)  { sql += " AND c.medico_id = ?";   params.push(medico_id); }
    if (paciente_id){ sql += " AND c.paciente_id = ?"; params.push(paciente_id); }
    if (estado)     { sql += " AND c.estado = ?";      params.push(estado); }

    sql += " ORDER BY c.inicio ASC LIMIT 500";
    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
// PATCH /api/citas/:id/estado
// ──────────────────────────────────────────────
router.patch("/:id/estado", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    const { estado } = req.body;
    const estadosValidos = ["PENDIENTE","CONFIRMADA","EN_ESPERA","EN_ATENCION","COMPLETADA","CANCELADA","NO_ASISTIO"];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ ok: false, msg: "Estado inválido" });
    }
    await pool.query(
      "UPDATE citas SET estado=? WHERE id=? AND clinica_id=?",
      [estado, req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
// PUT /api/citas/:id   → reprogramar (drag & drop)
// ──────────────────────────────────────────────
router.put("/:id", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    const { inicio, fin, medico_id, tipo_consulta, motivo, notas_internas } = req.body;

    // Anti-solapamiento (excluye la cita actual)
    if (inicio && fin) {
      const mId = medico_id || (await pool.query(
        "SELECT medico_id FROM citas WHERE id=? AND clinica_id=?",
        [req.params.id, clinicaId]
      ))[0][0]?.medico_id;

      const [solap] = await pool.query(
        `SELECT id FROM citas
         WHERE clinica_id=? AND medico_id=? AND id!=?
           AND estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION')
           AND NOT (fin <= ? OR inicio >= ?)
         LIMIT 1`,
        [clinicaId, mId, req.params.id, inicio, fin]
      );
      if (solap.length) {
        return res.status(409).json({ ok: false, msg: "Horario no disponible (solapamiento)" });
      }
    }

    await pool.query(
      `UPDATE citas SET
         inicio=COALESCE(?,inicio), fin=COALESCE(?,fin),
         medico_id=COALESCE(?,medico_id),
         tipo_consulta=COALESCE(?,tipo_consulta),
         motivo=COALESCE(?,motivo),
         notas_internas=COALESCE(?,notas_internas)
       WHERE id=? AND clinica_id=?`,
      [inicio||null, fin||null, medico_id||null,
       tipo_consulta||null, motivo||null, notas_internas||null,
       req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/citas
// ──────────────────────────────────────────────
router.post("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const { paciente_id, medico_id, inicio, fin, tipo_consulta, motivo, canal, servicio_id } = req.body;

    if (!paciente_id || !medico_id || !inicio || !fin) {
      return res.status(400).json({ ok: false, msg: "paciente_id, medico_id, inicio, fin son obligatorios" });
    }

    // Validación: evitar solapamientos con citas activas
    const [solap] = await pool.query(
      `SELECT id FROM citas
       WHERE clinica_id=? AND medico_id=?
         AND estado IN ('PENDIENTE','CONFIRMADA','EN_ESPERA','EN_ATENCION')
         AND NOT (fin <= ? OR inicio >= ?)
       LIMIT 1`,
      [clinicaId, medico_id, inicio, fin]
    );
    if (solap.length > 0) {
      return res.status(409).json({ ok: false, msg: "Horario no disponible (solapamiento)" });
    }

    const [r] = await pool.query(
      `INSERT INTO citas (clinica_id, paciente_id, medico_id, inicio, fin, tipo_consulta, motivo, canal, servicio_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [clinicaId, paciente_id, medico_id, inicio, fin,
       tipo_consulta || "CONTROL", motivo || null, canal || "RECEPCION", servicio_id || null]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/citas/:id/permanente  → eliminar registro completo
// ⚠️ DEBE IR ANTES de /:id para que Express lo capture correctamente
// ──────────────────────────────────────────────
router.delete("/:id/permanente", auth("ADMIN","MEDICO","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    await pool.query(
      "DELETE FROM citas WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    res.json({ ok: true, msg: "Cita eliminada permanentemente" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/citas/:id  → cancelar
// ──────────────────────────────────────────────
router.delete("/:id", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    await pool.query(
      "UPDATE citas SET estado='CANCELADA' WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;


