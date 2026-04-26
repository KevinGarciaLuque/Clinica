/**
 * MÓDULO 4 — Historia Clínica Electrónica (HCE) — SOAP
 * Incluye antecedentes, alergias asociadas al paciente
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

// ─── helpers ─────────────────────────────────────────────────────────────────
const clinicaOf = (req) =>
  req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORIAS CLÍNICAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/historias?paciente_id=&cita_id=&page=1
 * Lista de consultas del paciente (timeline)
 */
router.get("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const { paciente_id, cita_id, page = 1 } = req.query;
    const limit  = 20;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT h.id, h.cita_id, h.estado, h.creado_en,
             h.subjetivo, h.objetivo, h.diagnostico_cie, h.plan, h.examen_fisico,
             h.diagnosticos_secundarios,
             p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
             u.nombres AS med_nombres, u.apellidos AS med_apellidos, e.nombre AS especialidad
      FROM historias_clinicas h
      JOIN pacientes p ON p.id = h.paciente_id
      JOIN usuarios  u ON u.id = h.medico_id
      LEFT JOIN especialidades e ON e.id = u.especialidad_id
      WHERE h.clinica_id = ?`;
    const params = [cid];

    if (paciente_id) { sql += " AND h.paciente_id = ?"; params.push(paciente_id); }
    if (cita_id)     { sql += " AND h.cita_id = ?";     params.push(cita_id); }

    sql += " ORDER BY h.creado_en DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/historias/:id
 * Detalle completo de una historia (con prescripciones e items, y estudios)
 */
router.get("/:id", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { id } = req.params;

    const [[hist]] = await pool.query(
      `SELECT h.*, p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
              p.fecha_nacimiento, p.sexo, p.telefono AS pac_tel, p.email AS pac_email,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos, e.nombre AS especialidad
       FROM historias_clinicas h
       JOIN pacientes p ON p.id = h.paciente_id
       JOIN usuarios  u ON u.id = h.medico_id
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE h.id = ? AND h.clinica_id = ?`,
      [id, cid]
    );
    if (!hist) return res.status(404).json({ ok: false, msg: "No encontrado" });

    // prescripciones + items
    const [prescripciones] = await pool.query(
      `SELECT pr.*, GROUP_CONCAT(
         JSON_OBJECT(
           'id', pi.id,
           'medicamento_id', pi.medicamento_id,
           'medicamento_texto', COALESCE(m.nombre_generico, pi.medicamento_texto),
           'dosis', pi.dosis,
           'duracion', pi.duracion,
           'cantidad', pi.cantidad,
           'instrucciones', pi.instrucciones
         )
       ) AS items_json
       FROM prescripciones pr
       LEFT JOIN prescripcion_items pi ON pi.prescripcion_id = pr.id
       LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
       WHERE pr.historia_id = ? AND pr.clinica_id = ?
       GROUP BY pr.id`,
      [id, cid]
    );

    // estudios
    const [estudios] = await pool.query(
      `SELECT * FROM estudios_solicitudes
       WHERE historia_id = ? AND clinica_id = ?
       ORDER BY creado_en DESC`,
      [id, cid]
    );

    // parse items_json
    const presc = prescripciones.map(p => ({
      ...p,
      items: p.items_json
        ? p.items_json.split("},{").map((s, i, arr) => {
            try { return JSON.parse(i === 0 ? s + "}" : i === arr.length - 1 ? "{" + s : "{" + s + "}"); }
            catch { return {}; }
          })
        : [],
    }));

    res.json({ ok: true, data: { ...hist, prescripciones: presc, estudios } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/historias
 * Crear nueva historia/consulta
 */
router.post("/", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const {
      paciente_id, cita_id,
      subjetivo, objetivo, examen_fisico,
      diagnostico_cie, diagnosticos_secundarios, plan,
      estado = "BORRADOR",
    } = req.body;

    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const [r] = await pool.query(
      `INSERT INTO historias_clinicas
         (clinica_id, paciente_id, medico_id, cita_id,
          subjetivo, objetivo, examen_fisico,
          diagnostico_cie, diagnosticos_secundarios, plan, estado)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        cid, paciente_id, req.user.id, cita_id || null,
        subjetivo || null,
        objetivo ? JSON.stringify(objetivo) : null,
        examen_fisico || null,
        diagnostico_cie || null,
        diagnosticos_secundarios ? JSON.stringify(diagnosticos_secundarios) : null,
        plan || null,
        estado,
      ]
    );

    // Si hay cita_id, cambiar estado a EN_ATENCION
    if (cita_id) {
      await pool.query(
        "UPDATE citas SET estado='EN_ATENCION' WHERE id=? AND clinica_id=?",
        [cita_id, cid]
      );
    }

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * PUT /api/historias/:id
 * Actualizar historia (solo si BORRADOR)
 */
router.put("/:id", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { id } = req.params;

    const [[h]] = await pool.query(
      "SELECT estado, medico_id FROM historias_clinicas WHERE id=? AND clinica_id=?",
      [id, cid]
    );
    if (!h) return res.status(404).json({ ok: false, msg: "No encontrado" });
    if (h.estado === "FIRMADA") return res.status(400).json({ ok: false, msg: "No se puede editar una historia firmada" });
    if (!req.user.super && h.medico_id !== req.user.id) {
      return res.status(403).json({ ok: false, msg: "Solo el médico autor puede editar" });
    }

    const {
      subjetivo, objetivo, examen_fisico,
      diagnostico_cie, diagnosticos_secundarios, plan,
    } = req.body;

    await pool.query(
      `UPDATE historias_clinicas
       SET subjetivo=?, objetivo=?, examen_fisico=?,
           diagnostico_cie=?, diagnosticos_secundarios=?, plan=?
       WHERE id=? AND clinica_id=?`,
      [
        subjetivo || null,
        objetivo ? JSON.stringify(objetivo) : null,
        examen_fisico || null,
        diagnostico_cie || null,
        diagnosticos_secundarios ? JSON.stringify(diagnosticos_secundarios) : null,
        plan || null,
        id, cid,
      ]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/historias/:id/firmar
 * Firmar (finalizar) la historia clínica
 */
router.post("/:id/firmar", auth("MEDICO","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { id } = req.params;

    const [[h]] = await pool.query(
      "SELECT estado, medico_id, cita_id FROM historias_clinicas WHERE id=? AND clinica_id=?",
      [id, cid]
    );
    if (!h) return res.status(404).json({ ok: false, msg: "No encontrado" });
    if (h.estado === "FIRMADA") return res.status(400).json({ ok: false, msg: "Ya firmada" });

    await pool.query(
      "UPDATE historias_clinicas SET estado='FIRMADA' WHERE id=? AND clinica_id=?",
      [id, cid]
    );

    // Completar la cita automáticamente
    if (h.cita_id) {
      await pool.query(
        "UPDATE citas SET estado='COMPLETADA' WHERE id=? AND clinica_id=? AND estado NOT IN ('CANCELADA','COMPLETADA')",
        [h.cita_id, cid]
      );
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANTECEDENTES DEL PACIENTE
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/paciente/:paciente_id/antecedentes", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [rows] = await pool.query(
      "SELECT * FROM antecedentes_paciente WHERE clinica_id=? AND paciente_id=? AND activo=1 ORDER BY tipo, registrado_en DESC",
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/paciente/:paciente_id/antecedentes", auth("MEDICO","ENFERMERA","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { tipo, descripcion } = req.body;
    const [r] = await pool.query(
      "INSERT INTO antecedentes_paciente (clinica_id, paciente_id, tipo, descripcion) VALUES (?,?,?,?)",
      [cid, req.params.paciente_id, tipo, descripcion]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.put("/antecedente/:id", auth("MEDICO","ENFERMERA","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { descripcion } = req.body;
    await pool.query(
      "UPDATE antecedentes_paciente SET descripcion=? WHERE id=? AND clinica_id=?",
      [descripcion, req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.delete("/antecedente/:id", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    await pool.query(
      "UPDATE antecedentes_paciente SET activo=0 WHERE id=? AND clinica_id=?",
      [req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALERGIAS DEL PACIENTE
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/paciente/:paciente_id/alergias", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [rows] = await pool.query(
      "SELECT * FROM alergias_paciente WHERE clinica_id=? AND paciente_id=? AND activo=1",
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/paciente/:paciente_id/alergias", auth("MEDICO","ENFERMERA","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { agente, tipo, severidad, reaccion } = req.body;
    const [r] = await pool.query(
      "INSERT INTO alergias_paciente (clinica_id, paciente_id, agente, tipo, severidad, reaccion) VALUES (?,?,?,?,?,?)",
      [cid, req.params.paciente_id, agente, tipo || "MEDICAMENTO", severidad || "MODERADA", reaccion || null]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.delete("/alergia/:id", auth("MEDICO","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    await pool.query(
      "UPDATE alergias_paciente SET activo=0 WHERE id=? AND clinica_id=?",
      [req.params.id, cid]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESUMEN DEL PACIENTE — Nuevo vs. Subsecuente
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/historias/paciente/:paciente_id/resumen?exclude_id=
 * Devuelve si el paciente es nuevo o subsecuente, total de consultas
 * firmadas previas y el detalle de la última consulta.
 * exclude_id: historia_id actualmente abierta para no contarla como previa.
 */
router.get("/paciente/:paciente_id/resumen", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { paciente_id } = req.params;
    const { exclude_id } = req.query;

    let countSql = "SELECT COUNT(*) AS total FROM historias_clinicas WHERE paciente_id=? AND clinica_id=? AND estado='FIRMADA'";
    const countParams = [paciente_id, cid];
    if (exclude_id) { countSql += " AND id != ?"; countParams.push(exclude_id); }

    const [[{ total }]] = await pool.query(countSql, countParams);

    if (total === 0) {
      return res.json({ ok: true, data: { es_nuevo: true, total_consultas: 0, ultima_consulta: null } });
    }

    // Última consulta firmada (excluyendo la actual si se indicó)
    let ultSql = `
      SELECT h.id, h.creado_en, h.diagnostico_cie, h.diagnosticos_secundarios,
             h.plan, h.subjetivo, h.examen_fisico,
             u.nombres AS med_nombres, u.apellidos AS med_apellidos,
             COALESCE(e.nombre, u.especialidad) AS especialidad
      FROM historias_clinicas h
      JOIN usuarios u ON u.id = h.medico_id
      LEFT JOIN especialidades e ON e.id = u.especialidad_id
      WHERE h.paciente_id=? AND h.clinica_id=? AND h.estado='FIRMADA'`;
    const ultParams = [paciente_id, cid];
    if (exclude_id) { ultSql += " AND h.id != ?"; ultParams.push(exclude_id); }
    ultSql += " ORDER BY h.creado_en DESC LIMIT 1";

    const [[ult]] = await pool.query(ultSql, ultParams);
    if (!ult) return res.json({ ok: true, data: { es_nuevo: true, total_consultas: 0, ultima_consulta: null } });

    // Descripción del CIE-10 principal
    let dxDesc = "";
    if (ult.diagnostico_cie) {
      const [[cie]] = await pool.query(
        "SELECT descripcion FROM cie10 WHERE codigo=? LIMIT 1",
        [ult.diagnostico_cie]
      );
      dxDesc = cie?.descripcion || "";
    }

    // Medicamentos de esa consulta
    const [meds] = await pool.query(
      `SELECT COALESCE(m.nombre_generico, pi.medicamento_texto) AS nombre,
              pi.dosis, pi.duracion
       FROM prescripcion_items pi
       JOIN prescripciones pr ON pr.id = pi.prescripcion_id
       LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
       WHERE pr.historia_id=? AND pr.clinica_id=?
       LIMIT 8`,
      [ult.id, cid]
    );

    res.json({
      ok: true,
      data: {
        es_nuevo: false,
        total_consultas: total,
        ultima_consulta: {
          id:          ult.id,
          fecha:       ult.creado_en,
          medico:      `${ult.med_nombres} ${ult.med_apellidos}`,
          especialidad: ult.especialidad || "",
          diagnostico_cie:  ult.diagnostico_cie || "",
          diagnostico_desc: dxDesc,
          plan:        ult.plan || "",
          subjetivo:   ult.subjetivo || "",
          medicamentos: meds,
        },
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CIE-10 búsqueda rápida (autocompletar diagnóstico)
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/cie10/buscar", auth(), async (req, res) => {
  try {
    const { q = "" } = req.query;
    if (q.length < 2) return res.json({ ok: true, data: [] });
    const [rows] = await pool.query(
      `SELECT codigo, descripcion, categoria FROM cie10
       WHERE codigo LIKE ? OR descripcion LIKE ?
       ORDER BY CASE WHEN codigo LIKE ? THEN 0 ELSE 1 END, codigo
       LIMIT 20`,
      [`${q}%`, `%${q}%`, `${q}%`]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
