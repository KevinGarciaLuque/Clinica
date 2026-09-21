const router      = require("express").Router();
const pool        = require("../db");
const auth        = require("../middlewares/auth");
const upload      = require("../middlewares/upload");
const cloudinary  = require("../utils/cloudinary");
const streamifier = require("streamifier");
const fs          = require("fs");
const path        = require("path");
const ExcelJS     = require("exceljs");
const archiver    = require("archiver");
const { requireModulo } = require("../middlewares/moduloPermiso");

const PACIENTE_EXPORT_COLUMNS = [
  { header: "ID",                     key: "id",                            width: 8  },
  { header: "Nombres",                key: "nombres",                       width: 22 },
  { header: "Apellidos",              key: "apellidos",                     width: 22 },
  { header: "DNI",                    key: "dni",                           width: 16 },
  { header: "Fecha de nacimiento",    key: "fecha_nacimiento",              width: 18 },
  { header: "Edad",                   key: "edad",                          width: 8  },
  { header: "Sexo",                   key: "sexo",                          width: 8  },
  { header: "Teléfono",               key: "telefono",                      width: 16 },
  { header: "Email",                  key: "email",                         width: 26 },
  { header: "Dirección",              key: "direccion",                     width: 30 },
  { header: "Ciudad",                 key: "ciudad",                        width: 18 },
  { header: "Departamento",           key: "departamento",                  width: 18 },
  { header: "País",                   key: "pais",                          width: 14 },
  { header: "Grupo sanguíneo",        key: "grupo_sanguineo",               width: 10 },
  { header: "Contacto emergencia",    key: "contacto_emergencia_nombre",    width: 22 },
  { header: "Tel. emergencia",        key: "contacto_emergencia_telefono",  width: 16 },
  { header: "Notas",                  key: "notas",                         width: 40 },
  { header: "Antecedentes",           key: "antecedentes",                  width: 45 },
  { header: "Alergias",               key: "alergias",                      width: 35 },
  { header: "Consultas",              key: "consultas",                     width: 45 },
  { header: "Subjetivo",              key: "subjetivo",                     width: 45 },
  { header: "Objetivo (signos vitales)", key: "objetivo",                   width: 40 },
  { header: "Examen físico",          key: "examen_fisico",                 width: 40 },
  { header: "Diagnóstico",            key: "diagnostico",                   width: 45 },
  { header: "Plan",                   key: "plan",                          width: 45 },
  { header: "Recetas",                key: "recetas",                       width: 50 },
  { header: "Estudios",               key: "estudios",                      width: 50 },
  { header: "Activo",                 key: "activo",                        width: 8  },
  { header: "Registrado el",          key: "creado_en",                     width: 18 },
];

function buildPacientesWorkbook(pacientes) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pacientes");
  sheet.columns = PACIENTE_EXPORT_COLUMNS;
  sheet.getRow(1).font = { bold: true };
  for (const p of pacientes) {
    const row = sheet.addRow({
      ...p,
      fecha_nacimiento: p.fecha_nacimiento ? new Date(p.fecha_nacimiento).toISOString().slice(0, 10) : "",
      creado_en: p.creado_en ? new Date(p.creado_en).toISOString().slice(0, 10) : "",
      activo: p.activo ? "Sí" : "No",
    });
    row.alignment = { wrapText: true, vertical: "top" };
  }
  return workbook;
}

function formatObjetivo(json) {
  if (!json) return "";
  const o = typeof json === "string" ? JSON.parse(json) : json;
  const partes = [];
  if (o.pa)    partes.push(`PA: ${o.pa}`);
  if (o.fc)    partes.push(`FC: ${o.fc}`);
  if (o.fr)    partes.push(`FR: ${o.fr}`);
  if (o.temp)  partes.push(`Temp: ${o.temp}`);
  if (o.peso)  partes.push(`Peso: ${o.peso}`);
  if (o.talla) partes.push(`Talla: ${o.talla}`);
  if (o.spo2)  partes.push(`SpO2: ${o.spo2}`);
  return partes.join(" | ");
}

function formatDiagnostico(h) {
  const partes = [];
  if (h.diagnostico_cie) {
    partes.push(`${h.diagnostico_cie}${h.diagnostico_desc ? " - " + h.diagnostico_desc : ""}`);
  }
  if (h.diagnosticos_secundarios) {
    const sec = typeof h.diagnosticos_secundarios === "string"
      ? JSON.parse(h.diagnosticos_secundarios)
      : h.diagnosticos_secundarios;
    if (Array.isArray(sec) && sec.length) {
      partes.push(...sec.map(s => `${s.cie || ""}${s.descripcion ? " - " + s.descripcion : ""}`.trim()).filter(Boolean));
    }
  }
  return partes.join("; ");
}

const fechaCorta = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";

/** Reúne consultas, SOAP, recetas, estudios y antecedentes de un paciente en texto plano para el Excel. */
async function getResumenClinico(pacienteId) {
  const [citas] = await pool.query(
    "SELECT inicio, tipo_consulta, motivo, estado FROM citas WHERE paciente_id = ? ORDER BY inicio",
    [pacienteId]
  );
  const [historias] = await pool.query(
    `SELECT h.creado_en, h.subjetivo, h.objetivo, h.examen_fisico, h.diagnostico_cie,
            c.descripcion AS diagnostico_desc, h.diagnosticos_secundarios, h.plan
     FROM historias_clinicas h
     LEFT JOIN cie10 c ON c.codigo = h.diagnostico_cie
     WHERE h.paciente_id = ? ORDER BY h.creado_en`,
    [pacienteId]
  );
  const [recetaItems] = await pool.query(
    `SELECT p.creado_en, m.nombre_generico, pi.medicamento_texto, pi.dosis, pi.duracion, pi.cantidad, pi.instrucciones
     FROM prescripciones p
     JOIN prescripcion_items pi ON pi.prescripcion_id = p.id
     LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
     WHERE p.paciente_id = ? ORDER BY p.creado_en`,
    [pacienteId]
  );
  const [estudios] = await pool.query(
    `SELECT es.creado_en, es.tipo, es.descripcion, es.estado,
            GROUP_CONCAT(CONCAT(er.nombre_examen, IF(er.valor_resultado IS NOT NULL, CONCAT(': ', er.valor_resultado, IFNULL(CONCAT(' ', er.unidad), '')), '')) SEPARATOR ' | ') AS resultados
     FROM estudios_solicitudes es
     LEFT JOIN estudios_resultados er ON er.solicitud_id = es.id
     WHERE es.paciente_id = ?
     GROUP BY es.id
     ORDER BY es.creado_en`,
    [pacienteId]
  );
  const [antecedentes] = await pool.query(
    "SELECT tipo, descripcion FROM antecedentes_paciente WHERE paciente_id = ? AND activo = 1 ORDER BY registrado_en",
    [pacienteId]
  );
  const [alergias] = await pool.query(
    "SELECT agente, tipo, severidad, reaccion FROM alergias_paciente WHERE paciente_id = ? AND activo = 1",
    [pacienteId]
  );

  return {
    consultas: citas
      .map(c => `${fechaCorta(c.inicio)} (${c.tipo_consulta || "-"}, ${c.estado}): ${c.motivo || ""}`.trim())
      .join("\n"),
    subjetivo: historias.filter(h => h.subjetivo).map(h => `${fechaCorta(h.creado_en)}: ${h.subjetivo}`).join("\n\n"),
    objetivo: historias.filter(h => h.objetivo).map(h => `${fechaCorta(h.creado_en)}: ${formatObjetivo(h.objetivo)}`).join("\n"),
    examen_fisico: historias.filter(h => h.examen_fisico).map(h => `${fechaCorta(h.creado_en)}: ${h.examen_fisico}`).join("\n\n"),
    diagnostico: historias.filter(h => h.diagnostico_cie).map(h => `${fechaCorta(h.creado_en)}: ${formatDiagnostico(h)}`).join("\n"),
    plan: historias.filter(h => h.plan).map(h => `${fechaCorta(h.creado_en)}: ${h.plan}`).join("\n\n"),
    recetas: recetaItems
      .map(r => `${fechaCorta(r.creado_en)}: ${r.medicamento_texto || r.nombre_generico || "Medicamento"} — ${r.dosis || ""} ${r.duracion || ""}${r.instrucciones ? ` (${r.instrucciones})` : ""}`.trim())
      .join("\n"),
    estudios: estudios
      .map(e => `${fechaCorta(e.creado_en)} [${e.tipo}] ${e.descripcion || ""} (${e.estado})${e.resultados ? `: ${e.resultados}` : ""}`.trim())
      .join("\n"),
    antecedentes: antecedentes.map(a => `${a.tipo}: ${a.descripcion}`).join("; "),
    alergias: alergias.map(a => `${a.agente} (${a.tipo}, ${a.severidad})${a.reaccion ? ` - ${a.reaccion}` : ""}`).join("; "),
  };
}

// Formatea un resumen clínico ya agrupado por paciente (usado por el batch de abajo).
function formatResumenClinico({ citas = [], historias = [], recetaItems = [], estudios = [], antecedentes = [], alergias = [] }) {
  return {
    consultas: citas
      .map(c => `${fechaCorta(c.inicio)} (${c.tipo_consulta || "-"}, ${c.estado}): ${c.motivo || ""}`.trim())
      .join("\n"),
    subjetivo: historias.filter(h => h.subjetivo).map(h => `${fechaCorta(h.creado_en)}: ${h.subjetivo}`).join("\n\n"),
    objetivo: historias.filter(h => h.objetivo).map(h => `${fechaCorta(h.creado_en)}: ${formatObjetivo(h.objetivo)}`).join("\n"),
    examen_fisico: historias.filter(h => h.examen_fisico).map(h => `${fechaCorta(h.creado_en)}: ${h.examen_fisico}`).join("\n\n"),
    diagnostico: historias.filter(h => h.diagnostico_cie).map(h => `${fechaCorta(h.creado_en)}: ${formatDiagnostico(h)}`).join("\n"),
    plan: historias.filter(h => h.plan).map(h => `${fechaCorta(h.creado_en)}: ${h.plan}`).join("\n\n"),
    recetas: recetaItems
      .map(r => `${fechaCorta(r.creado_en)}: ${r.medicamento_texto || r.nombre_generico || "Medicamento"} — ${r.dosis || ""} ${r.duracion || ""}${r.instrucciones ? ` (${r.instrucciones})` : ""}`.trim())
      .join("\n"),
    estudios: estudios
      .map(e => `${fechaCorta(e.creado_en)} [${e.tipo}] ${e.descripcion || ""} (${e.estado})${e.resultados ? `: ${e.resultados}` : ""}`.trim())
      .join("\n"),
    antecedentes: antecedentes.map(a => `${a.tipo}: ${a.descripcion}`).join("; "),
    alergias: alergias.map(a => `${a.agente} (${a.tipo}, ${a.severidad})${a.reaccion ? ` - ${a.reaccion}` : ""}`).join("; "),
  };
}

/**
 * Igual que getResumenClinico pero para MUCHOS pacientes a la vez: 6 queries
 * totales (con WHERE paciente_id IN (...)) en vez de 6 por paciente. Evita el
 * N+1 que colgaba la exportación a Excel en clínicas con cientos de pacientes.
 */
async function getResumenClinicoBatch(pacienteIds) {
  const resultado = new Map();
  if (!pacienteIds.length) return resultado;

  const grupos = { citas: {}, historias: {}, recetaItems: {}, estudios: {}, antecedentes: {}, alergias: {} };
  for (const id of pacienteIds) {
    for (const k of Object.keys(grupos)) grupos[k][id] = [];
  }

  const [citas] = await pool.query(
    "SELECT paciente_id, inicio, tipo_consulta, motivo, estado FROM citas WHERE paciente_id IN (?) ORDER BY inicio",
    [pacienteIds]
  );
  citas.forEach(r => grupos.citas[r.paciente_id]?.push(r));

  const [historias] = await pool.query(
    `SELECT h.paciente_id, h.creado_en, h.subjetivo, h.objetivo, h.examen_fisico, h.diagnostico_cie,
            c.descripcion AS diagnostico_desc, h.diagnosticos_secundarios, h.plan
     FROM historias_clinicas h
     LEFT JOIN cie10 c ON c.codigo = h.diagnostico_cie
     WHERE h.paciente_id IN (?) ORDER BY h.creado_en`,
    [pacienteIds]
  );
  historias.forEach(r => grupos.historias[r.paciente_id]?.push(r));

  const [recetaItems] = await pool.query(
    `SELECT p.paciente_id, p.creado_en, m.nombre_generico, pi.medicamento_texto, pi.dosis, pi.duracion, pi.cantidad, pi.instrucciones
     FROM prescripciones p
     JOIN prescripcion_items pi ON pi.prescripcion_id = p.id
     LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
     WHERE p.paciente_id IN (?) ORDER BY p.creado_en`,
    [pacienteIds]
  );
  recetaItems.forEach(r => grupos.recetaItems[r.paciente_id]?.push(r));

  const [estudios] = await pool.query(
    `SELECT es.paciente_id, es.creado_en, es.tipo, es.descripcion, es.estado,
            GROUP_CONCAT(CONCAT(er.nombre_examen, IF(er.valor_resultado IS NOT NULL, CONCAT(': ', er.valor_resultado, IFNULL(CONCAT(' ', er.unidad), '')), '')) SEPARATOR ' | ') AS resultados
     FROM estudios_solicitudes es
     LEFT JOIN estudios_resultados er ON er.solicitud_id = es.id
     WHERE es.paciente_id IN (?)
     GROUP BY es.id
     ORDER BY es.creado_en`,
    [pacienteIds]
  );
  estudios.forEach(r => grupos.estudios[r.paciente_id]?.push(r));

  const [antecedentes] = await pool.query(
    "SELECT paciente_id, tipo, descripcion FROM antecedentes_paciente WHERE paciente_id IN (?) AND activo = 1 ORDER BY registrado_en",
    [pacienteIds]
  );
  antecedentes.forEach(r => grupos.antecedentes[r.paciente_id]?.push(r));

  const [alergias] = await pool.query(
    "SELECT paciente_id, agente, tipo, severidad, reaccion FROM alergias_paciente WHERE paciente_id IN (?) AND activo = 1",
    [pacienteIds]
  );
  alergias.forEach(r => grupos.alergias[r.paciente_id]?.push(r));

  for (const id of pacienteIds) {
    resultado.set(id, formatResumenClinico({
      citas: grupos.citas[id], historias: grupos.historias[id], recetaItems: grupos.recetaItems[id],
      estudios: grupos.estudios[id], antecedentes: grupos.antecedentes[id], alergias: grupos.alergias[id],
    }));
  }
  return resultado;
}

// GET /api/pacientes
router.get("/", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;

    // Listar pacientes exige una clínica seleccionada, incluso para SUPER_ADMIN:
    // sin este filtro se mezclarían pacientes de todas las clínicas en una sola
    // lista (datos clínicos de terceros que el super admin no necesita ver).
    if (!clinicaId) {
      return res.status(400).json({ ok: false, msg: "Selecciona una clínica para ver sus pacientes" });
    }

    const q = (req.query.q || "").trim().slice(0, 100);
    let whereSql = "WHERE clinica_id=? ";
    const whereParams = [clinicaId];

    if (q) {
      whereSql += "AND (nombres LIKE ? OR apellidos LIKE ? OR dni LIKE ? OR telefono LIKE ?) ";
      whereParams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    // Paginación real: solo se activa si el cliente manda ?page=. Sin ese
    // parámetro se mantiene el comportamiento anterior (top 200 por id) para
    // no romper a los consumidores que solo quieren una lista corta (selects
    // de "elegir paciente" en Historia Clínica, Estética, etc.).
    const pageParam = parseInt(req.query.page, 10);
    const isPaginado = Number.isInteger(pageParam) && pageParam > 0;
    const perPage = 30;

    if (isPaginado) {
      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM pacientes ${whereSql}`,
        whereParams
      );
      const pages = Math.max(1, Math.ceil(total / perPage));
      const page = Math.min(pageParam, pages);
      const offset = (page - 1) * perPage;

      const [rows] = await pool.query(
        `SELECT id, nombres, apellidos, dni, telefono, email, fecha_nacimiento, direccion, ciudad, departamento, foto_perfil, activo, creado_en, clinica_id, TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad
         FROM pacientes ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...whereParams, perPage, offset]
      );
      return res.json({ ok: true, data: rows, total, page, pages, per_page: perPage });
    }

    const [rows] = await pool.query(
      `SELECT id, nombres, apellidos, dni, telefono, email, fecha_nacimiento, direccion, ciudad, departamento, foto_perfil, activo, creado_en, clinica_id, TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad
       FROM pacientes ${whereSql} ORDER BY id DESC LIMIT 200`,
      whereParams
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/pacientes/export/excel
router.get("/export/excel", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), requireModulo("exportar_pacientes"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;

    // Igual que en el listado: exportar exige clínica seleccionada, incluso
    // para SUPER_ADMIN. Sin esto se podía descargar en un solo Excel el
    // historial clínico resumido de pacientes de TODAS las clínicas.
    if (!clinicaId) {
      return res.status(400).json({ ok: false, msg: "Selecciona una clínica para exportar sus pacientes" });
    }

    let sql =
      "SELECT id, nombres, apellidos, dni, fecha_nacimiento, TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad, sexo, telefono, email, direccion, ciudad, departamento, pais, grupo_sanguineo, contacto_emergencia_nombre, contacto_emergencia_telefono, notas, activo, creado_en FROM pacientes WHERE clinica_id=? ";
    const params = [clinicaId];
    sql += "ORDER BY apellidos, nombres";

    const [pacientes] = await pool.query(sql, params);
    const resumenes = await getResumenClinicoBatch(pacientes.map(p => p.id));
    for (const p of pacientes) {
      Object.assign(p, resumenes.get(p.id));
    }
    const workbook = buildPacientesWorkbook(pacientes);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="pacientes_clinica_${clinicaId}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("[GET /pacientes/export/excel] ERROR:", e.message, e.stack);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

async function getPacienteEscoped(pacienteId, req) {
  const clinicaId = req.tenant?.clinica_id;
  const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";
  const query = isSuperAdmin
    ? "SELECT * FROM pacientes WHERE id = ?"
    : "SELECT * FROM pacientes WHERE id = ? AND clinica_id = ?";
  const params = isSuperAdmin ? [pacienteId] : [pacienteId, clinicaId];
  const [[p]] = await pool.query(query, params);
  return p || null;
}

function safeFileName(name, fallback) {
  const base = (name || fallback || "archivo").toString().trim();
  return base.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || fallback;
}

// GET /api/pacientes/:id/export/excel
router.get("/:id/export/excel", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), requireModulo("exportar_pacientes"), async (req, res) => {
  try {
    const paciente = await getPacienteEscoped(req.params.id, req);
    if (!paciente) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    const [[edadRow]] = await pool.query(
      "SELECT TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad FROM pacientes WHERE id = ?",
      [paciente.id]
    );
    const resumen = await getResumenClinico(paciente.id);
    const workbook = buildPacientesWorkbook([{ ...paciente, edad: edadRow?.edad ?? "", ...resumen }]);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="paciente_${safeFileName(paciente.nombres + "_" + paciente.apellidos, paciente.id)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(`[GET /pacientes/${req.params.id}/export/excel] ERROR:`, e.message, e.stack);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/** Agrega el excel + adjuntos (documentos/estudios/imágenes) de un paciente al archive, bajo folderPrefix (si se da). */
async function appendPacienteToArchive(archive, paciente, folderPrefix = "") {
  const [[edadRow]] = await pool.query(
    "SELECT TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad FROM pacientes WHERE id = ?",
    [paciente.id]
  );
  const [documentos] = await pool.query(
    "SELECT tipo, nombre, url FROM paciente_documentos WHERE paciente_id = ?",
    [paciente.id]
  );
  const [estudios] = await pool.query(
    `SELECT er.nombre_examen, er.archivo_url
     FROM estudios_resultados er
     JOIN estudios_solicitudes es ON es.id = er.solicitud_id
     WHERE es.paciente_id = ? AND er.archivo_url IS NOT NULL`,
    [paciente.id]
  );
  const [imagenes] = await pool.query(
    "SELECT nombre, tipo, url FROM imagenes_medicas WHERE paciente_id = ?",
    [paciente.id]
  );

  const resumen = await getResumenClinico(paciente.id);
  const workbook = buildPacientesWorkbook([{ ...paciente, edad: edadRow?.edad ?? "", ...resumen }]);
  const excelBuffer = await workbook.xlsx.writeBuffer();
  archive.append(Buffer.from(excelBuffer), { name: `${folderPrefix}paciente.xlsx` });

  const adjuntos = [
    ...documentos.map((d, i) => ({ url: d.url, name: safeFileName(d.nombre || d.tipo, `documento_${i + 1}`), folder: "documentos" })),
    ...estudios.map((e, i) => ({ url: e.archivo_url, name: safeFileName(e.nombre_examen, `estudio_${i + 1}`), folder: "estudios" })),
    ...imagenes.map((im, i) => ({ url: im.url, name: safeFileName(im.nombre, `imagen_${i + 1}`), folder: "imagenes" })),
  ].filter(a => a.url);

  for (const adjunto of adjuntos) {
    try {
      const resp = await fetch(adjunto.url);
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      const ext = path.extname(new URL(adjunto.url).pathname) || "";
      const name = adjunto.name.endsWith(ext) || !ext ? adjunto.name : `${adjunto.name}${ext}`;
      archive.append(buf, { name: `${folderPrefix}${adjunto.folder}/${name}` });
    } catch (fetchErr) {
      console.warn(`[export/zip] no se pudo descargar ${adjunto.url}:`, fetchErr.message);
    }
  }
}

// GET /api/pacientes/:id/export/zip
router.get("/:id/export/zip", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), requireModulo("exportar_pacientes"), async (req, res) => {
  try {
    const paciente = await getPacienteEscoped(req.params.id, req);
    if (!paciente) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    const archiveFolder = safeFileName(`${paciente.nombres}_${paciente.apellidos}`, paciente.id);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="paciente_${archiveFolder}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error(`[GET /pacientes/${req.params.id}/export/zip] archive error:`, err.message);
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    archive.pipe(res);

    await appendPacienteToArchive(archive, paciente);
    await archive.finalize();
  } catch (e) {
    console.error(`[GET /pacientes/${req.params.id}/export/zip] ERROR:`, e.message, e.stack);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: e.message });
    else res.end();
  }
});

// GET /api/pacientes/export/zip-todos
router.get("/export/zip-todos", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), requireModulo("exportar_pacientes"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;

    // Igual que el listado y el export a Excel: exige clínica seleccionada,
    // incluso para SUPER_ADMIN. Sin esto se podía descargar en un solo ZIP
    // el expediente completo (documentos, fotos) de pacientes de TODAS las clínicas.
    if (!clinicaId) {
      return res.status(400).json({ ok: false, msg: "Selecciona una clínica para exportar sus pacientes" });
    }

    const [pacientes] = await pool.query(
      "SELECT * FROM pacientes WHERE clinica_id = ? ORDER BY apellidos, nombres",
      [clinicaId]
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="pacientes_clinica_${clinicaId}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("[GET /pacientes/export/zip-todos] archive error:", err.message);
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    archive.pipe(res);

    for (const paciente of pacientes) {
      const folderName = safeFileName(`${paciente.id}_${paciente.nombres}_${paciente.apellidos}`, `paciente_${paciente.id}`);
      await appendPacienteToArchive(archive, paciente, `${folderName}/`);
    }

    await archive.finalize();
  } catch (e) {
    console.error("[GET /pacientes/export/zip-todos] ERROR:", e.message, e.stack);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: e.message });
    else res.end();
  }
});

// GET /api/pacientes/:id
router.get("/:id", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

    
    // SUPER_ADMIN puede ver todos los pacientes, otros solo de su clínica
    let query, params;
    if (isSuperAdmin) {
      query = "SELECT p.*, TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) AS edad FROM pacientes p WHERE p.id = ?";
      params = [req.params.id];
    } else {
      query = "SELECT p.*, TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) AS edad FROM pacientes p WHERE p.id = ? AND p.clinica_id = ?";
      params = [req.params.id, clinicaId];
    }

    const [[p]] = await pool.query(query, params);

    if (!p) {
      return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
    }
    res.json({ ok: true, data: p });
  } catch (e) {
    console.error(`[GET /pacientes/${req.params.id}] ERROR:`, e.message, e.stack);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/pacientes
router.post("/", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const { nombres, apellidos, dni, telefono, email, fecha_nacimiento, sexo, direccion } = req.body;

    if (!nombres || !apellidos) {
      return res.status(400).json({ ok: false, msg: "nombres y apellidos son obligatorios" });
    }
    if (nombres.length > 150 || apellidos.length > 150) {
      return res.status(400).json({ ok: false, msg: "Nombres o apellidos demasiado largos (máx. 150 caracteres)" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, msg: "Formato de email inválido" });
    }
    if (fecha_nacimiento) {
      const nac = new Date(fecha_nacimiento);
      const ahora = new Date();
      if (isNaN(nac.getTime()) || nac > ahora || nac.getFullYear() < 1900) {
        return res.status(400).json({ ok: false, msg: "Fecha de nacimiento inválida" });
      }
    }

    // Formatear fecha si viene en formato ISO
    let fechaFormateada = fecha_nacimiento;
    if (fecha_nacimiento && fecha_nacimiento.includes('T')) {
      fechaFormateada = fecha_nacimiento.split('T')[0];
    }

    const {
      ciudad, departamento, pais, grupo_sanguineo, notas,
      estado_civil, ocupacion, escolaridad, religion, lugar_nacimiento, nacionalidad,
    } = req.body;

    const [r] = await pool.query(
      `INSERT INTO pacientes
         (clinica_id, nombres, apellidos, dni, telefono, email, fecha_nacimiento, sexo,
          direccion, ciudad, departamento, pais, grupo_sanguineo, notas,
          estado_civil, ocupacion, escolaridad, religion, lugar_nacimiento, nacionalidad)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clinicaId, nombres, apellidos,
        dni || null, telefono || null, email || null,
        fechaFormateada || null, sexo || null,
        direccion || null,
        ciudad || null,
        departamento || null,
        pais   || null,
        grupo_sanguineo || null,
        notas  || null,
        estado_civil || null,
        ocupacion || null,
        escolaridad || null,
        religion || null,
        lugar_nacimiento || null,
        nacionalidad || null,
      ]
    );

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /api/pacientes/:id ────────────────────────────────
router.put("/:id", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const { id }    = req.params;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

    const {
      nombres, apellidos, dni, telefono, email,
      fecha_nacimiento, sexo, direccion, ciudad, departamento, pais,
      grupo_sanguineo, notas, activo,
      // Responsable / tutor
      responsable_nombre, responsable_parentesco, responsable_telefono,
      responsable_email, responsable_dni, responsable_direccion,
      // Aseguradora
      aseguradora, numero_poliza, tipo_seguro, vigencia_seguro,
      // Datos complementarios
      estado_civil, ocupacion, escolaridad, religion,
      lugar_nacimiento, nacionalidad,
      // Contacto emergencia (ya existía en schema)
      contacto_emergencia_nombre, contacto_emergencia_telefono,
    } = req.body;

    // Formatear fecha si viene en formato ISO
    let fechaFormateada = fecha_nacimiento;
    if (fecha_nacimiento && fecha_nacimiento.includes('T')) {
      fechaFormateada = fecha_nacimiento.split('T')[0];
    }
    let vigenciaFormateada = vigencia_seguro;
    if (vigencia_seguro && vigencia_seguro.includes('T')) {
      vigenciaFormateada = vigencia_seguro.split('T')[0];
    }

    // Verificar que el paciente existe (SUPER_ADMIN puede editar cualquiera)
    let queryExists, paramsExists;
    if (isSuperAdmin) {
      queryExists = "SELECT id, clinica_id FROM pacientes WHERE id=?";
      paramsExists = [id];
    } else {
      queryExists = "SELECT id, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
      paramsExists = [id, clinicaId];
    }
    
    const [[exists]] = await pool.query(queryExists, paramsExists);
    if (!exists) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    // Actualizar (usando el clinica_id del paciente para SUPER_ADMIN)
    const clinicaIdFinal = isSuperAdmin ? exists.clinica_id : clinicaId;

    // Helper: convierte "" a null para campos opcionales, pero permite "0"
    const v = (val) => (val === undefined ? undefined : (val === "" ? null : val));

    await pool.query(
      `UPDATE pacientes SET
         nombres=?,        apellidos=?,
         dni=?,            telefono=?,     email=?,
         fecha_nacimiento=?,              sexo=?,
         direccion=?,      ciudad=?,       departamento=?,  pais=?,
         grupo_sanguineo=?,               notas=?,
         responsable_nombre=?,            responsable_parentesco=?,
         responsable_telefono=?,          responsable_email=?,
         responsable_dni=?,               responsable_direccion=?,
         aseguradora=?,                   numero_poliza=?,
         tipo_seguro=?,                   vigencia_seguro=?,
         estado_civil=?,   ocupacion=?,   escolaridad=?,
         religion=?,       lugar_nacimiento=?,  nacionalidad=?,
         contacto_emergencia_nombre=?,    contacto_emergencia_telefono=?
       WHERE id=? AND clinica_id=?`,
      [
        nombres||null, apellidos||null,
        v(dni), v(telefono), v(email),
        fechaFormateada||null, v(sexo),
        v(direccion), v(ciudad), v(departamento), v(pais),
        v(grupo_sanguineo), v(notas),
        v(responsable_nombre), v(responsable_parentesco),
        v(responsable_telefono), v(responsable_email),
        v(responsable_dni), v(responsable_direccion),
        v(aseguradora), v(numero_poliza),
        v(tipo_seguro), vigenciaFormateada||null,
        v(estado_civil), v(ocupacion), v(escolaridad),
        v(religion), v(lugar_nacimiento), v(nacionalidad),
        v(contacto_emergencia_nombre), v(contacto_emergencia_telefono),
        id, clinicaIdFinal,
      ]
    );

    const [[updated]] = await pool.query("SELECT * FROM pacientes WHERE id=?", [id]);
    res.json({ ok: true, paciente: updated });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /api/pacientes/:id/foto ─────────────────────────
router.post(
  "/:id/foto",
  auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
  upload.single("foto"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió archivo" });
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ ok: false, msg: "El archivo excede el tamaño máximo permitido (5 MB)" });
      }

      const clinicaId    = req.tenant?.clinica_id;
      const { id }       = req.params;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

      // Verificar que el paciente existe
      let query, params;
      if (isSuperAdmin) {
        query  = "SELECT id, foto_perfil, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=?";
        params = [id];
      } else {
        query  = "SELECT id, foto_perfil, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
        params = [id, clinicaId];
      }
      const [[p]] = await pool.query(query, params);
      if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

      const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;

      const isCloudinaryConfigured = !!(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);

      if (isCloudinaryConfigured) {
        // Eliminar foto anterior de Cloudinary si existe
        if (p.foto_cloudinary_id) {
          try { await cloudinary.uploader.destroy(p.foto_cloudinary_id); } catch (err) {
            console.error("[foto/upload] No se pudo eliminar foto anterior de Cloudinary:", err.message);
          }
        }

        // Subir nueva foto a Cloudinary desde el buffer en memoria
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: `clinica/pacientes/${clinicaIdFinal}/perfil`, resource_type: "image" },
            (err, result) => (err ? reject(err) : resolve(result))
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

        await pool.query(
          "UPDATE pacientes SET foto_perfil=?, foto_cloudinary_id=? WHERE id=? AND clinica_id=?",
          [uploadResult.secure_url, uploadResult.public_id, id, clinicaIdFinal]
        );

        return res.json({ ok: true, foto_perfil: uploadResult.secure_url });
      }

      // ── Fallback: guardar en disco local ──────────────────────────────────
      const ext      = path.extname(req.file.originalname).toLowerCase() || ".jpg";
      const filename = `paciente-${id}-${Date.now()}${ext}`;
      const uploadsDir = path.join(__dirname, "../uploads/pacientes");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      const urlPath = `pacientes/${filename}`;

      // Eliminar foto local anterior si existe
      if (p.foto_perfil && !p.foto_perfil.startsWith("http")) {
        const oldFile = path.join(__dirname, "../uploads", p.foto_perfil);
        if (fs.existsSync(oldFile)) try { fs.unlinkSync(oldFile); } catch { /* ignorar */ }
      }

      await pool.query(
        "UPDATE pacientes SET foto_perfil=?, foto_cloudinary_id=NULL WHERE id=? AND clinica_id=?",
        [urlPath, id, clinicaIdFinal]
      );

      res.json({ ok: true, foto_perfil: urlPath });
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// ── DELETE /api/pacientes/:id/foto ───────────────────────
router.delete(
  "/:id/foto",
  auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
  async (req, res) => {
    try {
      const clinicaId    = req.tenant?.clinica_id;
      const { id }       = req.params;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

      let query, params;
      if (isSuperAdmin) {
        query  = "SELECT id, foto_perfil, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=?";
        params = [id];
      } else {
        query  = "SELECT id, foto_perfil, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
        params = [id, clinicaId];
      }
      const [[p]] = await pool.query(query, params);
      if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

      if (p.foto_cloudinary_id) {
        try { await cloudinary.uploader.destroy(p.foto_cloudinary_id); } catch { /* ignorar */ }
      }

      const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;
      await pool.query(
        "UPDATE pacientes SET foto_perfil=NULL, foto_cloudinary_id=NULL WHERE id=? AND clinica_id=?",
        [id, clinicaIdFinal]
      );

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// ── DELETE /api/pacientes/:id ─────────────────────────────
router.delete(
  "/:id",
  auth("ADMIN","MEDICO","PSICOLOGO","SUPER_ADMIN"),
  async (req, res) => {
    try {
      const clinicaId    = req.tenant?.clinica_id;
      const { id }       = req.params;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

      let query, params;
      if (isSuperAdmin) {
        query  = "SELECT id, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=?";
        params = [id];
      } else {
        query  = "SELECT id, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
        params = [id, clinicaId];
      }
      const [[p]] = await pool.query(query, params);
      if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

      // Eliminar foto de Cloudinary si existe
      if (p.foto_cloudinary_id) {
        try { await cloudinary.uploader.destroy(p.foto_cloudinary_id); } catch { /* ignorar */ }
      }

      const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;
      await pool.query(
        "DELETE FROM pacientes WHERE id=? AND clinica_id=?",
        [id, clinicaIdFinal]
      );

      res.json({ ok: true, msg: "Paciente eliminado correctamente" });
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

module.exports = router;
