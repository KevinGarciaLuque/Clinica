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

let historiasColsCache;
const getHistoriasCols = async () => {
  if (historiasColsCache) return historiasColsCache;
  const [cols] = await pool.query("SHOW COLUMNS FROM historias_clinicas");
  historiasColsCache = new Set(cols.map(c => c.Field));
  return historiasColsCache;
};

// Devuelve el código CIE-10 solo si existe en la tabla `cie10` (para respetar la FK).
// Si el código está vacío o no existe (ej. diagnóstico libre o de catálogo no seedeado), devuelve null.
const cieValido = async (codigo) => {
  const c = (codigo || "").trim();
  if (!c) return null;
  const [rows] = await pool.query("SELECT codigo FROM cie10 WHERE codigo=? LIMIT 1", [c]);
  return rows.length ? c : null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORIAS CLÍNICAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/historias?paciente_id=&cita_id=&page=1
 * Lista de consultas del paciente (timeline)
 */
router.get("/", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });
    const cols = await getHistoriasCols();

    const { paciente_id, cita_id, page = 1 } = req.query;
    const limit  = 20;
    const offset = (page - 1) * limit;

    const selectExtras = [
      !cols.has("firma_digital_url") ? "NULL AS firma_digital_url" : null,
      !cols.has("colegiatura_firmante") ? "NULL AS colegiatura_firmante" : null,
    ].filter(Boolean).join(", ");

    let sql = `
      SELECT h.id, h.cita_id, h.estado, h.creado_en,
             h.subjetivo, h.objetivo, h.diagnostico_cie, h.plan, h.examen_fisico,
             h.diagnosticos_secundarios${selectExtras ? `, ${selectExtras}` : ""},
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
router.get("/:id", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { id } = req.params;
    const cols = await getHistoriasCols();

    const selectExtras = [
      !cols.has("firma_digital_url") ? "NULL AS firma_digital_url" : null,
      !cols.has("colegiatura_firmante") ? "NULL AS colegiatura_firmante" : null,
    ].filter(Boolean).join(", ");

    const [[hist]] = await pool.query(
      `SELECT h.*${selectExtras ? `, ${selectExtras}` : ""}, h.datos_derma,
              p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
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
      diagnostico_cie, diagnostico_desc, diagnosticos_secundarios, plan,
      estado = "BORRADOR",
      datos_derma,
    } = req.body;

    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const cieCod = await cieValido(diagnostico_cie);

    const insertCols = await getHistoriasCols();
    const hasDxDescCol = insertCols.has("diagnostico_desc");

    const insertFields = hasDxDescCol
      ? "(clinica_id, paciente_id, medico_id, cita_id, subjetivo, objetivo, examen_fisico, diagnostico_cie, diagnostico_desc, diagnosticos_secundarios, plan, estado, datos_derma)"
      : "(clinica_id, paciente_id, medico_id, cita_id, subjetivo, objetivo, examen_fisico, diagnostico_cie, diagnosticos_secundarios, plan, estado, datos_derma)";
    const insertVals = hasDxDescCol
      ? [cid, paciente_id, req.user.id, cita_id || null, subjetivo || null, objetivo ? JSON.stringify(objetivo) : null, examen_fisico || null, cieCod, diagnostico_desc || null, diagnosticos_secundarios ? JSON.stringify(diagnosticos_secundarios) : null, plan || null, estado, datos_derma ? JSON.stringify(datos_derma) : null]
      : [cid, paciente_id, req.user.id, cita_id || null, subjetivo || null, objetivo ? JSON.stringify(objetivo) : null, examen_fisico || null, cieCod, diagnosticos_secundarios ? JSON.stringify(diagnosticos_secundarios) : null, plan || null, estado, datos_derma ? JSON.stringify(datos_derma) : null];
    const placeholders = insertVals.map(() => "?").join(",");

    const [r] = await pool.query(
      `INSERT INTO historias_clinicas ${insertFields} VALUES (${placeholders})`,
      insertVals
    );

    // Si hay cita_id, cambiar estado a EN_ATENCION
    if (cita_id) {
      await pool.query(
        "UPDATE citas SET estado='EN_ATENCION' WHERE id=? AND clinica_id=?",
        [cita_id, cid]
      );
    }

    // Linkear estudios guardados antes de crear la historia (historia_id = NULL)
    await pool.query(
      `UPDATE estudios_solicitudes
       SET historia_id = ?
       WHERE clinica_id = ? AND paciente_id = ? AND historia_id IS NULL`,
      [r.insertId, cid, paciente_id]
    );

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
    const permitirEdicionFirmada = String(req.query.editar || "") === "1";

    const [[h]] = await pool.query(
      "SELECT estado, medico_id FROM historias_clinicas WHERE id=? AND clinica_id=?",
      [id, cid]
    );
    if (!h) return res.status(404).json({ ok: false, msg: "No encontrado" });
    if (h.estado === "FIRMADA" && !permitirEdicionFirmada) {
      return res.status(400).json({ ok: false, msg: "No se puede editar una historia firmada" });
    }
    if (!req.user.super && h.medico_id !== req.user.id) {
      return res.status(403).json({ ok: false, msg: "Solo el médico autor puede editar" });
    }

    const {
      subjetivo, objetivo, examen_fisico,
      diagnostico_cie, diagnostico_desc, diagnosticos_secundarios, plan,
      datos_derma,
    } = req.body;

    const updateCols = await getHistoriasCols();
    const hasDxDescUpd = updateCols.has("diagnostico_desc");

    const cieCodUpd = await cieValido(diagnostico_cie);

    const updateSql = hasDxDescUpd
      ? `UPDATE historias_clinicas SET subjetivo=?, objetivo=?, examen_fisico=?, diagnostico_cie=?, diagnostico_desc=?, diagnosticos_secundarios=?, plan=?, datos_derma=? WHERE id=? AND clinica_id=?`
      : `UPDATE historias_clinicas SET subjetivo=?, objetivo=?, examen_fisico=?, diagnostico_cie=?, diagnosticos_secundarios=?, plan=?, datos_derma=? WHERE id=? AND clinica_id=?`;
    const updateVals = hasDxDescUpd
      ? [subjetivo || null, objetivo ? JSON.stringify(objetivo) : null, examen_fisico || null, cieCodUpd, diagnostico_desc || null, diagnosticos_secundarios ? JSON.stringify(diagnosticos_secundarios) : null, plan || null, datos_derma ? JSON.stringify(datos_derma) : null, id, cid]
      : [subjetivo || null, objetivo ? JSON.stringify(objetivo) : null, examen_fisico || null, cieCodUpd, diagnosticos_secundarios ? JSON.stringify(diagnosticos_secundarios) : null, plan || null, datos_derma ? JSON.stringify(datos_derma) : null, id, cid];

    await pool.query(updateSql, updateVals);

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
    const { firma_digital_url, colegiatura_firmante } = req.body || {};
    const cols = await getHistoriasCols();

    const [[h]] = await pool.query(
      "SELECT estado, medico_id, cita_id, paciente_id FROM historias_clinicas WHERE id=? AND clinica_id=?",
      [id, cid]
    );
    if (!h) return res.status(404).json({ ok: false, msg: "No encontrado" });
    const yaFirmada = h.estado === "FIRMADA";

    if (!yaFirmada) {
      const updates = ["estado='FIRMADA'"];
      const params = [];
      if (cols.has("firma_digital_url")) {
        updates.push("firma_digital_url = COALESCE(?, firma_digital_url)");
        params.push(firma_digital_url || null);
      }
      if (cols.has("colegiatura_firmante")) {
        updates.push("colegiatura_firmante = COALESCE(?, colegiatura_firmante)");
        params.push(colegiatura_firmante || null);
      }
      params.push(id, cid);
      await pool.query(
        `UPDATE historias_clinicas
         SET ${updates.join(", ")}
         WHERE id=? AND clinica_id=?`,
        params
      );
    }

    // Completar la cita automáticamente
    if (h.cita_id) {
      await pool.query(
        "UPDATE citas SET estado='COMPLETADA' WHERE id=? AND clinica_id=? AND estado NOT IN ('CANCELADA','COMPLETADA')",
        [h.cita_id, cid]
      );
    }

    // Nota: la factura/recibo ya NO se genera automáticamente al firmar.
    // Ahora el médico decide si generarla mediante el modal "¿Generar factura?"
    // que abre el flujo de facturación precargado (con cliente=responsable si es menor).

    res.json({ ok: true, msg: yaFirmada ? "Ya firmada (cita sincronizada)" : "Historia firmada" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANTECEDENTES DEL PACIENTE
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/paciente/:paciente_id/antecedentes", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
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

router.get("/paciente/:paciente_id/alergias", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
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
router.get("/paciente/:paciente_id/resumen", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
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

    const cols = await getHistoriasCols();
    const hasDxDesc = cols.has("diagnostico_desc");

    // Todas las consultas firmadas previas (excluyendo la actual)
    let listSql = `
      SELECT h.id, h.creado_en, h.diagnostico_cie,
             ${hasDxDesc ? "h.diagnostico_desc," : "NULL AS diagnostico_desc,"}
             h.plan, h.subjetivo,
             u.nombres AS med_nombres, u.apellidos AS med_apellidos,
             e.nombre AS especialidad,
             c.descripcion AS cie_desc
      FROM historias_clinicas h
      JOIN usuarios u ON u.id = h.medico_id
      LEFT JOIN especialidades e ON e.id = u.especialidad_id
      LEFT JOIN cie10 c ON c.codigo = h.diagnostico_cie
      WHERE h.paciente_id=? AND h.clinica_id=? AND h.estado='FIRMADA'`;
    const listParams = [paciente_id, cid];
    if (exclude_id) { listSql += " AND h.id != ?"; listParams.push(exclude_id); }
    listSql += " ORDER BY h.creado_en DESC LIMIT 20";

    const [rows] = await pool.query(listSql, listParams);
    if (!rows.length) return res.json({ ok: true, data: { es_nuevo: true, total_consultas: 0, consultas_previas: [] } });

    // Medicamentos de todas esas consultas en una sola query
    const ids = rows.map(r => r.id);
    const [allMeds] = await pool.query(
      `SELECT pr.historia_id,
              COALESCE(m.nombre_generico, pi.medicamento_texto) AS nombre,
              pi.dosis, pi.duracion
       FROM prescripcion_items pi
       JOIN prescripciones pr ON pr.id = pi.prescripcion_id
       LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
       WHERE pr.historia_id IN (?) AND pr.clinica_id=?`,
      [ids, cid]
    );
    const medsByHistoria = {};
    for (const med of allMeds) {
      if (!medsByHistoria[med.historia_id]) medsByHistoria[med.historia_id] = [];
      if (medsByHistoria[med.historia_id].length < 8)
        medsByHistoria[med.historia_id].push({ nombre: med.nombre, dosis: med.dosis, duracion: med.duracion });
    }

    const consultas_previas = rows.map(r => ({
      id:               r.id,
      fecha:            r.creado_en,
      medico:           `${r.med_nombres} ${r.med_apellidos}`,
      especialidad:     r.especialidad || "",
      diagnostico_cie:  r.diagnostico_cie || "",
      diagnostico_desc: r.cie_desc || r.diagnostico_desc || "",
      plan:             r.plan || "",
      subjetivo:        r.subjetivo || "",
      medicamentos:     medsByHistoria[r.id] || [],
    }));

    res.json({
      ok: true,
      data: {
        es_nuevo: false,
        total_consultas: total,
        ultima_consulta: consultas_previas[0],
        consultas_previas,
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
