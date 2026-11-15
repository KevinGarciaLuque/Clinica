const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const ROLES           = ["SUPER_ADMIN","ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA"];
const ROLES_ESCRITURA = ["SUPER_ADMIN","ADMIN","MEDICO","ENFERMERA"];

// ─── Utilidad ─────────────────────────────────────────────────────────────────
async function ensureTablas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sesiones_educacion_diabetes (
      id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id            INT UNSIGNED NOT NULL,
      paciente_id           INT UNSIGNED NOT NULL,
      educador_id           INT UNSIGNED NOT NULL,
      fecha                 DATE NOT NULL,
      diagnostico           JSON,
      antecedentes          JSON,
      tratamiento_actual    JSON,
      monitoreo             JSON,
      alimentacion          JSON,
      actividad_fisica      JSON,
      educacion_previa      JSON,
      objetivos_paciente    TEXT,
      plan_educativo        JSON,
      evaluacion_educativa  JSON,
      secciones_completadas JSON,
      estado                ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
      firma_at              DATETIME,
      creado_en             DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sed_clinica  (clinica_id),
      INDEX idx_sed_paciente (paciente_id),
      INDEX idx_sed_educador (educador_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS informes_mcg (
      id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id     INT UNSIGNED NOT NULL,
      paciente_id    INT UNSIGNED NOT NULL,
      educador_id    INT UNSIGNED NOT NULL,
      fecha          DATE NOT NULL,
      encabezado     JSON,
      resumen        JSON,
      tiempo_rangos  JSON,
      interpretacion JSON,
      recomendaciones JSON,
      plan           JSON,
      profesional    JSON,
      secciones_completadas JSON,
      estado         ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
      firma_at       DATETIME,
      creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_imcg_clinica  (clinica_id),
      INDEX idx_imcg_paciente (paciente_id),
      INDEX idx_imcg_educador (educador_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
ensureTablas().catch(() => {});

const SECCIONES = [
  "diagnostico", "antecedentes", "tratamiento_actual", "monitoreo", "alimentacion",
  "actividad_fisica", "educacion_previa", "objetivos_paciente", "plan_educativo", "evaluacion_educativa",
];
const jsonOrNull = (v) => (v === undefined || v === null ? null : JSON.stringify(v));

// GET /api/educacion-diabetes/sesiones?paciente_id=&page=1&limit=20
// ═══════════ Derivaciones del médico al educador («Enviar a educación») ═══════════
const sse     = require("../utils/sseManager");
const webPush = require("../utils/webPush");
const TEMAS_TXT = {
  alimentacion: "Alimentación", conteo_cho: "Conteo de carbohidratos", ajuste_insulina: "Ajuste de insulina",
  hipoglucemia: "Hipoglucemia", ejercicio: "Ejercicio", cgm: "Uso del sensor (MCG)", glucometro: "Glucómetro",
  cuidado_pies: "Cuidado de pies", metas_glucosa: "Metas de glucosa", lectura_etiquetas: "Lectura de etiquetas",
  tecnica_insulina: "Técnica de insulina",
};
let derivacionesOk = false;
async function asegurarDerivaciones() {
  if (derivacionesOk) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS derivaciones_educacion (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id  INT UNSIGNED NOT NULL,
      paciente_id INT UNSIGNED NOT NULL,
      medico_id   INT UNSIGNED NULL,
      temas       JSON NULL,
      nota        VARCHAR(500) NULL,
      estado      ENUM('PENDIENTE','ATENDIDA') NOT NULL DEFAULT 'PENDIENTE',
      sesion_id   INT UNSIGNED NULL,
      creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
      atendida_en DATETIME NULL,
      INDEX idx_de_clinica (clinica_id, estado),
      INDEX idx_de_paciente (paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  derivacionesOk = true;
}
const temasTexto = (t) => { let l = t; if (typeof l === "string") { try { l = JSON.parse(l); } catch { l = []; } } return (Array.isArray(l) ? l : []).map((k) => TEMAS_TXT[k] || k); };

// POST /api/educacion-diabetes/derivaciones  { paciente_id, temas: [...], nota }
router.post("/derivaciones", auth("SUPER_ADMIN","ADMIN","MEDICO","ENFERMERA","PSICOLOGO"), async (req, res) => {
  try {
    await asegurarDerivaciones();
    const cid = req.user.clinica_id;
    const { paciente_id, temas, nota } = req.body || {};
    const [[p]] = await pool.query("SELECT id, nombres, apellidos FROM pacientes WHERE id=? AND clinica_id=?", [paciente_id, cid]);
    if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
    const lista = (Array.isArray(temas) ? temas : []).map(String).slice(0, 15);
    const [r] = await pool.query(
      "INSERT INTO derivaciones_educacion (clinica_id, paciente_id, medico_id, temas, nota) VALUES (?,?,?,?,?)",
      [cid, p.id, req.user.id, JSON.stringify(lista), nota ? String(nota).slice(0, 500) : null]);

    // Aviso al educador (o educadores) de la clínica
    let avisados = 0;
    try {
      const [col] = await pool.query("SHOW COLUMNS FROM usuarios LIKE 'funcion_clinica'");
      if (col.length) {
        const [eds] = await pool.query(
          "SELECT id FROM usuarios WHERE clinica_id=? AND activo=1 AND funcion_clinica='EDUCADOR_DIABETES' AND id<>?", [cid, req.user.id]);
        const [[m]] = await pool.query("SELECT nombres, apellidos FROM usuarios WHERE id=?", [req.user.id]);
        const quien = m ? `${m.nombres || ""} ${m.apellidos || ""}`.trim() : "El médico";
        const t = temasTexto(lista);
        const mensaje = `${quien} envió a ${p.nombres} ${p.apellidos} a educación${t.length ? `: ${t.join(", ")}` : ""}`.slice(0, 300);
        if (eds.length) {
          await pool.query(
            "INSERT INTO notificaciones_usuario (usuario_id, clinica_id, tipo, mensaje, paciente_id) VALUES ?",
            [eds.map((e) => [e.id, cid, "derivacion_educacion", mensaje, p.id])]).catch(() => {});
          eds.forEach((e) => sse.notifyUser(e.id, "notificacion_portal", { tipo: "derivacion_educacion", mensaje, paciente_id: p.id }));
          await webPush.sendToUsers(pool, eds.map((e) => e.id), {
            title: "Paciente enviado a educación", body: mensaje, tag: `derivacion_${r.insertId}`,
            data: { url: `/educacion/consulta?paciente_id=${p.id}` },
          }).catch(() => {});
          avisados = eds.length;
        }
      }
    } catch (e) { console.error("[derivacion aviso]", e.message); }
    res.status(201).json({ ok: true, id: r.insertId, avisados });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/educacion-diabetes/derivaciones?paciente_id=  |  ?estado=PENDIENTE
router.get("/derivaciones", auth(...ROLES, "PSICOLOGO"), async (req, res) => {
  try {
    await asegurarDerivaciones();
    const cid = req.user.clinica_id;
    const cond = ["d.clinica_id = ?"], val = [cid];
    if (req.query.paciente_id) { cond.push("d.paciente_id = ?"); val.push(req.query.paciente_id); }
    if (req.query.estado === "PENDIENTE") cond.push("d.estado = 'PENDIENTE'");
    const [rows] = await pool.query(
      `SELECT d.id, d.paciente_id, d.temas, d.nota, d.estado, d.creado_en, d.atendida_en,
              p.nombres, p.apellidos, p.dni, p.fecha_nacimiento,
              CONCAT(COALESCE(u.nombres,''),' ',COALESCE(u.apellidos,'')) AS medico
         FROM derivaciones_educacion d
         JOIN pacientes p ON p.id = d.paciente_id
         LEFT JOIN usuarios u ON u.id = d.medico_id
        WHERE ${cond.join(" AND ")}
        ORDER BY d.estado = 'PENDIENTE' DESC, d.creado_en DESC LIMIT 50`, val);
    res.json({ ok: true, data: rows.map((x) => ({ ...x, temas_texto: temasTexto(x.temas) })) });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/educacion-diabetes/derivaciones/:id/atender
router.put("/derivaciones/:id/atender", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    await asegurarDerivaciones();
    await pool.query("UPDATE derivaciones_educacion SET estado='ATENDIDA', atendida_en=NOW() WHERE id=? AND clinica_id=?", [req.params.id, req.user.clinica_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/educacion-diabetes/recientes → pacientes atendidos últimamente en Educación en Diabetes
router.get("/recientes", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [rows] = await pool.query(`
      SELECT p.id, p.nombres, p.apellidos, p.dni, p.fecha_nacimiento, p.sexo,
             MAX(x.fecha) AS ultima, SUM(x.tipo = 'ses') AS sesiones
        FROM (
          SELECT paciente_id, fecha, 'ses' AS tipo FROM sesiones_educacion_diabetes WHERE clinica_id = ?
          UNION ALL
          SELECT paciente_id, fecha, 'mcg' AS tipo FROM informes_mcg WHERE clinica_id = ?
        ) x
        JOIN pacientes p ON p.id = x.paciente_id AND p.clinica_id = ?
       GROUP BY p.id
       ORDER BY ultima DESC
       LIMIT 30`, [cid, cid, cid]);
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

router.get("/sesiones", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, page = 1, limit = 20 } = req.query;
    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await pool.query(`
      SELECT se.*, CONCAT(u.nombres,' ',u.apellidos) AS educador_nombre
      FROM sesiones_educacion_diabetes se
      LEFT JOIN usuarios u ON u.id = se.educador_id
      WHERE se.clinica_id = ? AND se.paciente_id = ?
      ORDER BY se.fecha DESC, se.id DESC
      LIMIT ? OFFSET ?
    `, [cid, paciente_id, Number(limit), offset]);

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM sesiones_educacion_diabetes WHERE clinica_id=? AND paciente_id=?",
      [cid, paciente_id]
    );
    res.json({ ok: true, data: rows, total });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/educacion-diabetes/sesiones/:id
router.get("/sesiones/:id", auth(...ROLES), async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT se.*, CONCAT(u.nombres,' ',u.apellidos) AS educador_nombre,
        CONCAT(p.nombres,' ',p.apellidos) AS paciente_nombre
      FROM sesiones_educacion_diabetes se
      LEFT JOIN usuarios u ON u.id = se.educador_id
      LEFT JOIN pacientes p ON p.id = se.paciente_id
      WHERE se.id = ? AND se.clinica_id = ?
    `, [req.params.id, req.user.clinica_id]);
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/educacion-diabetes/sesiones
router.post("/sesiones", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, fecha } = req.body;
    if (!paciente_id || !fecha) return res.status(400).json({ ok: false, msg: "paciente_id y fecha requeridos" });

    const secciones = SECCIONES.filter(k => req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== "");

    const [result] = await pool.query(`
      INSERT INTO sesiones_educacion_diabetes
        (clinica_id, paciente_id, educador_id, fecha,
         diagnostico, antecedentes, tratamiento_actual, monitoreo, alimentacion,
         actividad_fisica, educacion_previa, objetivos_paciente, plan_educativo,
         evaluacion_educativa, secciones_completadas)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      cid, paciente_id, req.user.id, fecha,
      jsonOrNull(req.body.diagnostico), jsonOrNull(req.body.antecedentes),
      jsonOrNull(req.body.tratamiento_actual), jsonOrNull(req.body.monitoreo),
      jsonOrNull(req.body.alimentacion), jsonOrNull(req.body.actividad_fisica),
      jsonOrNull(req.body.educacion_previa), req.body.objetivos_paciente || null,
      jsonOrNull(req.body.plan_educativo), jsonOrNull(req.body.evaluacion_educativa),
      JSON.stringify(secciones),
    ]);
    // Las derivaciones pendientes del médico para este paciente quedan atendidas con esta sesión
    await asegurarDerivaciones().catch(() => {});
    await pool.query(
      "UPDATE derivaciones_educacion SET estado='ATENDIDA', atendida_en=NOW(), sesion_id=? WHERE clinica_id=? AND paciente_id=? AND estado='PENDIENTE'",
      [result.insertId, cid, paciente_id]).catch(() => {});
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/educacion-diabetes/sesiones/:id
router.put("/sesiones/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id, estado FROM sesiones_educacion_diabetes WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (row.estado === "FIRMADA") return res.status(409).json({ ok: false, msg: "La sesión ya está firmada y no puede editarse" });

    const { fecha } = req.body;
    const secciones = SECCIONES.filter(k => req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== "");

    await pool.query(`
      UPDATE sesiones_educacion_diabetes SET
        fecha=?, diagnostico=?, antecedentes=?, tratamiento_actual=?, monitoreo=?,
        alimentacion=?, actividad_fisica=?, educacion_previa=?, objetivos_paciente=?,
        plan_educativo=?, evaluacion_educativa=?, secciones_completadas=?
      WHERE id=?
    `, [
      fecha || null,
      jsonOrNull(req.body.diagnostico), jsonOrNull(req.body.antecedentes),
      jsonOrNull(req.body.tratamiento_actual), jsonOrNull(req.body.monitoreo),
      jsonOrNull(req.body.alimentacion), jsonOrNull(req.body.actividad_fisica),
      jsonOrNull(req.body.educacion_previa), req.body.objetivos_paciente || null,
      jsonOrNull(req.body.plan_educativo), jsonOrNull(req.body.evaluacion_educativa),
      JSON.stringify(secciones),
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/educacion-diabetes/sesiones/:id/firmar
router.post("/sesiones/:id/firmar", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id FROM sesiones_educacion_diabetes WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    await pool.query(
      "UPDATE sesiones_educacion_diabetes SET estado='FIRMADA', firma_at=NOW() WHERE id=?",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// DELETE /api/educacion-diabetes/sesiones/:id  (solo BORRADOR)
router.delete("/sesiones/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT estado FROM sesiones_educacion_diabetes WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "No encontrada" });
    if (row.estado === "FIRMADA") return res.status(409).json({ ok: false, msg: "No se puede eliminar una sesión firmada" });
    await pool.query("DELETE FROM sesiones_educacion_diabetes WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INFORMES MCG — Informe de Monitoreo Continuo de Glucosa (documento imprimible)
// ═══════════════════════════════════════════════════════════════════════════════
const SECCIONES_MCG = [
  "encabezado", "resumen", "tiempo_rangos", "interpretacion", "recomendaciones", "plan", "profesional",
];

// GET /api/educacion-diabetes/informes-mcg?paciente_id=&page=1&limit=20
router.get("/informes-mcg", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, page = 1, limit = 20 } = req.query;
    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await pool.query(`
      SELECT im.*, CONCAT(u.nombres,' ',u.apellidos) AS educador_nombre
      FROM informes_mcg im
      LEFT JOIN usuarios u ON u.id = im.educador_id
      WHERE im.clinica_id = ? AND im.paciente_id = ?
      ORDER BY im.fecha DESC, im.id DESC
      LIMIT ? OFFSET ?
    `, [cid, paciente_id, Number(limit), offset]);

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM informes_mcg WHERE clinica_id=? AND paciente_id=?",
      [cid, paciente_id]
    );
    res.json({ ok: true, data: rows, total });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/educacion-diabetes/informes-mcg/:id
router.get("/informes-mcg/:id", auth(...ROLES), async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT im.*, CONCAT(u.nombres,' ',u.apellidos) AS educador_nombre,
        CONCAT(p.nombres,' ',p.apellidos) AS paciente_nombre
      FROM informes_mcg im
      LEFT JOIN usuarios u ON u.id = im.educador_id
      LEFT JOIN pacientes p ON p.id = im.paciente_id
      WHERE im.id = ? AND im.clinica_id = ?
    `, [req.params.id, req.user.clinica_id]);
    if (!row) return res.status(404).json({ ok: false, msg: "Informe no encontrado" });
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/educacion-diabetes/informes-mcg
router.post("/informes-mcg", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, fecha } = req.body;
    if (!paciente_id || !fecha) return res.status(400).json({ ok: false, msg: "paciente_id y fecha requeridos" });

    const secciones = SECCIONES_MCG.filter(k => req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== "");

    const [result] = await pool.query(`
      INSERT INTO informes_mcg
        (clinica_id, paciente_id, educador_id, fecha,
         encabezado, resumen, tiempo_rangos, interpretacion, recomendaciones, plan, profesional,
         secciones_completadas)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      cid, paciente_id, req.user.id, fecha,
      jsonOrNull(req.body.encabezado), jsonOrNull(req.body.resumen),
      jsonOrNull(req.body.tiempo_rangos), jsonOrNull(req.body.interpretacion),
      jsonOrNull(req.body.recomendaciones), jsonOrNull(req.body.plan),
      jsonOrNull(req.body.profesional),
      JSON.stringify(secciones),
    ]);
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/educacion-diabetes/informes-mcg/:id
router.put("/informes-mcg/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id, estado FROM informes_mcg WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Informe no encontrado" });
    if (row.estado === "FIRMADA") return res.status(409).json({ ok: false, msg: "El informe ya está firmado y no puede editarse" });

    const { fecha } = req.body;
    const secciones = SECCIONES_MCG.filter(k => req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== "");

    await pool.query(`
      UPDATE informes_mcg SET
        fecha=?, encabezado=?, resumen=?, tiempo_rangos=?, interpretacion=?,
        recomendaciones=?, plan=?, profesional=?, secciones_completadas=?
      WHERE id=?
    `, [
      fecha || null,
      jsonOrNull(req.body.encabezado), jsonOrNull(req.body.resumen),
      jsonOrNull(req.body.tiempo_rangos), jsonOrNull(req.body.interpretacion),
      jsonOrNull(req.body.recomendaciones), jsonOrNull(req.body.plan),
      jsonOrNull(req.body.profesional),
      JSON.stringify(secciones),
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/educacion-diabetes/informes-mcg/:id/firmar
router.post("/informes-mcg/:id/firmar", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT id FROM informes_mcg WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Informe no encontrado" });
    await pool.query(
      "UPDATE informes_mcg SET estado='FIRMADA', firma_at=NOW() WHERE id=?",
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// DELETE /api/educacion-diabetes/informes-mcg/:id  (solo BORRADOR)
router.delete("/informes-mcg/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT estado FROM informes_mcg WHERE id=? AND clinica_id=?",
      [req.params.id, req.user.clinica_id]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "No encontrado" });
    if (row.estado === "FIRMADA") return res.status(409).json({ ok: false, msg: "No se puede eliminar un informe firmado" });
    await pool.query("DELETE FROM informes_mcg WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

module.exports = router;
