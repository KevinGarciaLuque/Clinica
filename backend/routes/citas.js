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

    // Leer zona horaria de la clínica (o defecto: Honduras)
    const [[tzRow]] = await pool.query(
      "SELECT valor FROM clinica_config WHERE clinica_id=? AND clave='zona_horaria'",
      [clinicaId]
    );
    const tz = tzRow?.valor || "America/Tegucigalpa";

    // Determinar día de semana en la zona horaria de la clínica (sin depender del servidor)
    // Usamos T12:00:00Z para que noon-UTC sea siempre el mismo día en cualquier TZ de ±11h
    const nombreDia = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
      .format(new Date(fecha + "T12:00:00Z"));
    const WD_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const diaJS    = WD_MAP[nombreDia];           // 0=Dom, 1=Lun, ... 6=Sab
    const diaLunes = diaJS === 0 ? 6 : diaJS - 1; // 0=Lun, ..., 6=Dom

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

    // Formatea Date como ISO local (sin 'Z') para que el frontend lo trate como hora local
    const toLocalISO = d => {
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };

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
            inicio: toLocalISO(cursor),
            fin:    toLocalISO(slotFin),
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
router.get("/", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const { desde, hasta, medico_id, paciente_id, estado } = req.query;
    let sql = `SELECT c.id,
                      DATE_FORMAT(c.inicio, '%Y-%m-%dT%H:%i:%s') AS inicio,
                      DATE_FORMAT(c.fin,    '%Y-%m-%dT%H:%i:%s') AS fin,
                      c.estado, c.tipo_consulta, c.motivo, c.canal,
                      c.paciente_id, c.medico_id,
                      p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
                      p.telefono AS paciente_tel, p.dni AS paciente_dni, p.email AS paciente_email,
                      p.fecha_nacimiento AS paciente_fecha_nac,
                      p.ciudad AS paciente_ciudad,
                      p.departamento AS paciente_departamento,
                      p.foto_perfil AS paciente_foto_perfil,
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
router.patch("/:id/estado", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    let clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId && req.user.super) {
      const [[row]] = await pool.query("SELECT clinica_id FROM citas WHERE id=?", [req.params.id]);
      clinicaId = row?.clinica_id;
    }
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
router.put("/:id", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    let clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    // SUPER_ADMIN sin tenant: obtener clinica_id de la propia cita
    if (!clinicaId && req.user.super) {
      const [[row]] = await pool.query("SELECT clinica_id FROM citas WHERE id=?", [req.params.id]);
      clinicaId = row?.clinica_id;
    }
    const { inicio, fin, medico_id, tipo_consulta, motivo, canal, notas_internas } = req.body;

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
         canal=COALESCE(?,canal),
         notas_internas=COALESCE(?,notas_internas)
       WHERE id=? AND clinica_id=?`,
      [inicio||null, fin||null, medico_id||null,
       tipo_consulta||null, motivo||null, canal||null, notas_internas||null,
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
router.post("/", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
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
router.delete("/:id/permanente", auth("ADMIN","MEDICO","PSICOLOGO","SUPER_ADMIN"), async (req, res) => {
  try {
    let clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId && req.user.super) {
      const [[row]] = await pool.query("SELECT clinica_id FROM citas WHERE id=?", [req.params.id]);
      clinicaId = row?.clinica_id;
    }
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
router.delete("/:id", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    let clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId && req.user.super) {
      const [[row]] = await pool.query("SELECT clinica_id FROM citas WHERE id=?", [req.params.id]);
      clinicaId = row?.clinica_id;
    }
    await pool.query(
      "UPDATE citas SET estado='CANCELADA' WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/citas/:id/pendientes
// Devuelve el plan de la última consulta + estudios pendientes del paciente
// (para mostrar en la vista Agenda de la siguiente cita)
// ──────────────────────────────────────────────
router.get("/:id/pendientes", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    let clinicaId = req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;
    if (!clinicaId && req.user.super) {
      const [[row]] = await pool.query("SELECT clinica_id FROM citas WHERE id=?", [req.params.id]);
      clinicaId = row?.clinica_id;
    }

    // Obtener el paciente de esta cita
    const [[cita]] = await pool.query(
      "SELECT paciente_id FROM citas WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    if (!cita) return res.status(404).json({ ok: false, msg: "Cita no encontrada" });

    const pacienteId = cita.paciente_id;

    // Última historia clínica con plan/indicaciones
    const [[historia]] = await pool.query(
      `SELECT hc.id, hc.plan, hc.creado_en, hc.diagnostico_cie,
              d.descripcion AS diagnostico_desc
       FROM historias_clinicas hc
       LEFT JOIN cie10 d ON d.codigo = hc.diagnostico_cie
       WHERE hc.paciente_id = ? AND hc.clinica_id = ?
       ORDER BY hc.creado_en DESC LIMIT 1`,
      [pacienteId, clinicaId]
    );

    // Estudios pendientes (SOLICITADO) del paciente
    const [estudios] = await pool.query(
      `SELECT es.id, es.tipo, es.descripcion, es.urgente, es.creado_en
       FROM estudios_solicitudes es
       WHERE es.paciente_id = ? AND es.clinica_id = ? AND es.estado = 'SOLICITADO'
       ORDER BY es.urgente DESC, es.creado_en DESC`,
      [pacienteId, clinicaId]
    );

    const hayPendientes = (historia?.plan && historia.plan.trim()) || estudios.length > 0;

    res.json({
      ok: true,
      data: {
        plan:            historia?.plan?.trim() || null,
        diagnostico_cie: historia?.diagnostico_cie || null,
        diagnostico_desc: historia?.diagnostico_desc || null,
        ultima_consulta: historia?.creado_en || null,
        estudios,
        total: (historia?.plan?.trim() ? 1 : 0) + estudios.length,
        hay_pendientes: !!hayPendientes,
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;


