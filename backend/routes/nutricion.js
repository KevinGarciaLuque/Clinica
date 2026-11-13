/**
 * routes/nutricion.js — Módulo de Nutrición dentro de la consulta.
 *
 * Cada consulta (historia clínica) puede tener su hoja de nutrición:
 * evaluación, medidas del cuerpo, cálculo de calorías y plan de alimentación.
 *
 *  GET  /api/nutricion/equivalentes                 → grupos de alimentos, tiempos de comida y días
 *  GET  /api/nutricion/historia/:hid                → hoja de nutrición de una consulta
 *  PUT  /api/nutricion/historia/:hid                → guardar (crea o actualiza) la hoja de esa consulta
 *  GET  /api/nutricion/paciente/:pid/anterior       → datos de consultas anteriores para continuar (?excluir=hid)
 *  GET  /api/nutricion/paciente/:pid/evolucion      → medidas de todas sus consultas (gráficas)
 *  GET  /api/nutricion/historia/:hid/pdf            → PDF del plan de alimentación para el paciente
 *  GET/POST/DELETE /api/nutricion/plantillas        → planes reutilizables de la clínica
 */
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");
const { GRUPOS, TIEMPOS, DIAS } = require("../data/nutricionEquivalentes");
const { zonaClinica, localSql } = require("../utils/zonaHoraria");

const ROLES = ["ADMIN", "MEDICO", "ENFERMERA", "SUPER_ADMIN"];

// Medidas que se guardan en columnas (para poder graficar la evolución)
const MEDIDAS = [
  "peso", "talla", "imc", "cintura", "cadera", "icc", "brazo", "muslo", "pantorrilla",
  "pct_grasa", "masa_muscular", "agua_pct", "grasa_visceral", "peso_meta",
];

let tablasListas = false;
async function asegurarTablas() {
  if (tablasListas) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nutricion_consultas (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id      INT UNSIGNED NOT NULL,
      paciente_id     INT UNSIGNED NOT NULL,
      historia_id     INT UNSIGNED NULL,
      cita_id         INT UNSIGNED NULL,
      fecha           DATE NOT NULL,
      evaluacion      LONGTEXT NULL,
      pliegues        LONGTEXT NULL,
      requerimiento   LONGTEXT NULL,
      plan            LONGTEXT NULL,
      peso            DECIMAL(6,2) NULL,
      talla           DECIMAL(6,2) NULL,
      imc             DECIMAL(5,2) NULL,
      cintura         DECIMAL(6,2) NULL,
      cadera          DECIMAL(6,2) NULL,
      icc             DECIMAL(5,3) NULL,
      brazo           DECIMAL(6,2) NULL,
      muslo           DECIMAL(6,2) NULL,
      pantorrilla     DECIMAL(6,2) NULL,
      pct_grasa       DECIMAL(5,2) NULL,
      masa_muscular   DECIMAL(6,2) NULL,
      agua_pct        DECIMAL(5,2) NULL,
      grasa_visceral  DECIMAL(5,2) NULL,
      peso_meta       DECIMAL(6,2) NULL,
      creado_por      INT UNSIGNED NULL,
      creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en  DATETIME NULL,
      UNIQUE KEY uq_nutri_historia (historia_id),
      INDEX idx_nutri_paciente (clinica_id, paciente_id, fecha)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nutricion_plantillas (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id    INT UNSIGNED NOT NULL,
      nombre        VARCHAR(120) NOT NULL,
      descripcion   VARCHAR(255) NULL,
      requerimiento LONGTEXT NULL,
      plan          LONGTEXT NULL,
      activo        TINYINT(1) NOT NULL DEFAULT 1,
      creado_por    INT UNSIGNED NULL,
      creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_nplant_clinica (clinica_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  // Peso que el paciente anota en su casa desde el portal (uno por día)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nutricion_peso_casa (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id  INT UNSIGNED NOT NULL,
      paciente_id INT UNSIGNED NOT NULL,
      fecha       DATE NOT NULL,
      peso        DECIMAL(6,2) NOT NULL,
      creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_peso_casa (paciente_id, fecha),
      INDEX idx_peso_casa_clinica (clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablasListas = true;
}

const clinicaDe = (req) => (req.user.super ? req.tenant?.clinica_id : req.user.clinica_id);
const json = (v) => { if (!v) return null; try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; } };
const numero = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n : null;
};
const textoJson = (v, max = 200000) => {
  if (v === null || v === undefined) return null;
  const t = JSON.stringify(v);
  return t.length > max ? null : t;
};

function formatear(r) {
  if (!r) return null;
  const out = {
    id: r.id, paciente_id: r.paciente_id, historia_id: r.historia_id, cita_id: r.cita_id,
    fecha: r.fecha_txt || r.fecha,
    evaluacion: json(r.evaluacion) || {},
    pliegues: json(r.pliegues) || {},
    requerimiento: json(r.requerimiento) || {},
    plan: json(r.plan) || {},
    medidas: {},
  };
  for (const m of MEDIDAS) if (r[m] !== null && r[m] !== undefined) out.medidas[m] = Number(r[m]);
  return out;
}

const SELECT = `SELECT n.*, DATE_FORMAT(n.fecha, '%Y-%m-%d') AS fecha_txt FROM nutricion_consultas n`;

/** La historia existe, es de esta clínica y de ese paciente */
async function historiaDeClinica(hid, clinicaId) {
  // Fecha de la consulta en la hora de la clínica (creado_en se guarda en la hora del servidor)
  const fechaLocal = localSql("creado_en", await zonaClinica(clinicaId));
  const [[h]] = await pool.query(
    `SELECT id, paciente_id, cita_id, clinica_id, DATE_FORMAT(${fechaLocal}, '%Y-%m-%d') AS fecha
     FROM historias_clinicas WHERE id = ? AND clinica_id = ?`,
    [hid, clinicaId]
  );
  return h || null;
}

router.get("/equivalentes", auth(...ROLES, "RECEPCIONISTA"), (req, res) => {
  res.json({ ok: true, data: { grupos: GRUPOS, tiempos: TIEMPOS, dias: DIAS } });
});

router.get("/historia/:hid(\\d+)", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTablas();
    const [[r]] = await pool.query(`${SELECT} WHERE n.historia_id = ? AND n.clinica_id = ?`, [req.params.hid, clinicaDe(req)]);
    res.json({ ok: true, data: formatear(r) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.put("/historia/:hid(\\d+)", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTablas();
    const clinicaId = clinicaDe(req);
    const h = await historiaDeClinica(req.params.hid, clinicaId);
    if (!h) return res.status(404).json({ ok: false, msg: "Consulta no encontrada." });

    const b = req.body || {};
    const medidas = b.medidas || {};
    const valores = MEDIDAS.map((m) => numero(medidas[m]));
    const campos = {
      evaluacion: textoJson(b.evaluacion || {}),
      pliegues: textoJson(b.pliegues || {}),
      requerimiento: textoJson(b.requerimiento || {}),
      plan: textoJson(b.plan || {}),
    };
    if (Object.values(campos).some((v) => v === null)) {
      return res.status(400).json({ ok: false, msg: "La hoja de nutrición es demasiado grande." });
    }

    const [[ya]] = await pool.query("SELECT id FROM nutricion_consultas WHERE historia_id = ?", [h.id]);
    if (ya) {
      await pool.query(
        `UPDATE nutricion_consultas SET evaluacion=?, pliegues=?, requerimiento=?, plan=?,
           ${MEDIDAS.map((m) => `${m}=?`).join(", ")}, actualizado_en=NOW()
         WHERE id=?`,
        [campos.evaluacion, campos.pliegues, campos.requerimiento, campos.plan, ...valores, ya.id]
      );
    } else {
      await pool.query(
        `INSERT INTO nutricion_consultas
           (clinica_id, paciente_id, historia_id, cita_id, fecha, evaluacion, pliegues, requerimiento, plan, ${MEDIDAS.join(", ")}, creado_por)
         VALUES (?,?,?,?,?,?,?,?,?, ${MEDIDAS.map(() => "?").join(", ")}, ?)`,
        [clinicaId, h.paciente_id, h.id, h.cita_id || null, h.fecha, campos.evaluacion, campos.pliegues,
         campos.requerimiento, campos.plan, ...valores, req.user.id]
      );
    }
    const [[r]] = await pool.query(`${SELECT} WHERE n.historia_id = ?`, [h.id]);
    res.json({ ok: true, data: formatear(r) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * Datos de consultas anteriores para continuar en una nueva:
 *  - medidas de la última consulta (para comparar),
 *  - la última evaluación y el último plan que tengan contenido (para copiarlos).
 */
router.get("/paciente/:pid(\\d+)/anterior", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTablas();
    const excluir = Number(req.query.excluir) || 0;
    const base = `${SELECT} WHERE n.paciente_id = ? AND n.clinica_id = ? AND (n.historia_id IS NULL OR n.historia_id <> ?)`;
    const params = [req.params.pid, clinicaDe(req), excluir];
    const orden = " ORDER BY n.fecha DESC, n.id DESC LIMIT 1";
    const [[ultima]] = await pool.query(base + orden, params);
    const [[conEval]] = await pool.query(`${base} AND n.evaluacion IS NOT NULL AND n.evaluacion NOT IN ('{}', '')${orden}`, params);
    const [[conPlan]] = await pool.query(`${base} AND n.plan IS NOT NULL AND n.plan NOT IN ('{}', '')${orden}`, params);
    const u = formatear(ultima), e = formatear(conEval), p = formatear(conPlan);
    res.json({
      ok: true,
      data: {
        ultima: u ? { fecha: u.fecha, medidas: u.medidas, pliegues: u.pliegues } : null,
        evaluacion: e ? { fecha: e.fecha, datos: e.evaluacion } : null,
        plan: p ? { fecha: p.fecha, plan: p.plan, requerimiento: p.requerimiento } : null,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.get("/paciente/:pid(\\d+)/evolucion", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTablas();
    const [rows] = await pool.query(
      `SELECT id, historia_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, ${MEDIDAS.join(", ")}
       FROM nutricion_consultas WHERE paciente_id = ? AND clinica_id = ?
       ORDER BY fecha ASC, id ASC LIMIT 500`,
      [req.params.pid, clinicaDe(req)]
    );
    const data = rows.map((r) => {
      const o = { id: r.id, historia_id: r.historia_id, fecha: r.fecha };
      for (const m of MEDIDAS) o[m] = r[m] === null ? null : Number(r[m]);
      return o;
    });
    const [casa] = await pool.query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, peso FROM nutricion_peso_casa
       WHERE paciente_id = ? AND clinica_id = ? ORDER BY fecha ASC LIMIT 500`,
      [req.params.pid, clinicaDe(req)]
    );
    res.json({ ok: true, data, casa: casa.map((c) => ({ fecha: c.fecha, peso: Number(c.peso) })) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Plantillas de planes ───────────────────────────────────────────────────
router.get("/plantillas", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTablas();
    const [rows] = await pool.query(
      "SELECT id, nombre, descripcion, requerimiento, plan FROM nutricion_plantillas WHERE clinica_id = ? AND activo = 1 ORDER BY nombre",
      [clinicaDe(req)]
    );
    res.json({ ok: true, data: rows.map((r) => ({ ...r, requerimiento: json(r.requerimiento) || {}, plan: json(r.plan) || {} })) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/plantillas", auth("ADMIN", "MEDICO", "SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTablas();
    const nombre = String(req.body?.nombre || "").trim().slice(0, 120);
    if (!nombre) return res.status(400).json({ ok: false, msg: "Escriba un nombre para la plantilla." });
    const requerimiento = textoJson(req.body.requerimiento || {});
    const plan = textoJson(req.body.plan || {});
    if (requerimiento === null || plan === null) return res.status(400).json({ ok: false, msg: "La plantilla es demasiado grande." });
    const [r] = await pool.query(
      "INSERT INTO nutricion_plantillas (clinica_id, nombre, descripcion, requerimiento, plan, creado_por) VALUES (?,?,?,?,?,?)",
      [clinicaDe(req), nombre, String(req.body.descripcion || "").trim().slice(0, 255) || null, requerimiento, plan, req.user.id]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.delete("/plantillas/:id(\\d+)", auth("ADMIN", "MEDICO", "SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTablas();
    await pool.query("UPDATE nutricion_plantillas SET activo = 0 WHERE id = ? AND clinica_id = ?", [req.params.id, clinicaDe(req)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PDF del plan de alimentación ───────────────────────────────────────────
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString("es-HN", { maximumFractionDigits: d, minimumFractionDigits: d }) : "—");

function totalesPlan(porciones) {
  const t = { kcal: 0, cho: 0, pro: 0, gra: 0 };
  for (const g of GRUPOS) {
    const n = TIEMPOS.reduce((s, ti) => s + (Number(porciones?.[ti.clave]?.[g.clave]) || 0), 0);
    t.kcal += n * g.kcal; t.cho += n * g.cho; t.pro += n * g.pro; t.gra += n * g.gra;
  }
  return t;
}

function htmlPlan({ clinica, logo, paciente, medico, fecha, req, plan, medidas }) {
  const porciones = plan.porciones || {};
  const tiemposUsados = TIEMPOS.filter((t) => GRUPOS.some((g) => Number(porciones?.[t.clave]?.[g.clave]) > 0));
  const gruposUsados = GRUPOS.filter((g) => TIEMPOS.some((t) => Number(porciones?.[t.clave]?.[g.clave]) > 0));
  const tot = totalesPlan(porciones);
  const menu = plan.menu || {};
  const diasMenu = DIAS.filter((d) => TIEMPOS.some((t) => String(menu?.[d]?.[t.clave] || "").trim()));
  const celda = (v) => (Number(v) > 0 ? fmt(v, Number(v) % 1 ? 1 : 0) : "");

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  * { box-sizing: border-box; } body { font-family: "Segoe UI", Arial, sans-serif; color: #1f2937; margin: 0; font-size: 11.5px; }
  .pag { padding: 28px 34px; }
  .cab { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #16a34a; padding-bottom: 12px; margin-bottom: 14px; }
  .cab img { max-height: 54px; max-width: 140px; object-fit: contain; }
  .cab h1 { font-size: 19px; margin: 0; color: #14532d; } .cab .sub { color: #4b5563; font-size: 11px; }
  .cab .der { margin-left: auto; text-align: right; font-size: 11px; color: #374151; }
  .datos { display: flex; flex-wrap: wrap; gap: 6px 22px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; }
  .datos b { color: #14532d; }
  h2 { font-size: 13.5px; color: #14532d; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: .4px; }
  .kpis { display: flex; gap: 10px; } .kpi { flex: 1; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px; text-align: center; }
  .kpi .v { font-size: 17px; font-weight: 800; color: #111827; } .kpi .l { font-size: 10px; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #e5e7eb; padding: 6px 7px; text-align: center; }
  th { background: #f9fafb; font-size: 10.5px; color: #374151; } td.g { text-align: left; font-weight: 600; }
  .punto { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .eq { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; }
  .eq div { border-left: 3px solid #d1d5db; padding: 2px 0 2px 8px; } .eq b { display: block; margin-bottom: 2px; }
  .eq span { color: #4b5563; font-size: 10.5px; }
  .menu td { text-align: left; vertical-align: top; font-size: 10.5px; } .menu th { width: 20%; }
  .rec { white-space: pre-line; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; background: #fafafa; }
  .pie { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; color: #6b7280; font-size: 10px; }
  .salto { page-break-inside: avoid; }
  </style></head><body><div class="pag">
  <div class="cab">
    ${logo ? `<img src="${esc(logo)}" alt="logo"/>` : ""}
    <div><h1>Plan de alimentación</h1><div class="sub">${esc(clinica.nombre || "")}${clinica.telefono ? ` · Tel. ${esc(clinica.telefono)}` : ""}</div></div>
    <div class="der">${esc(medico || "")}<br/>${esc(fecha)}</div>
  </div>
  <div class="datos">
    <span><b>Paciente:</b> ${esc(paciente)}</span>
    ${medidas.peso ? `<span><b>Peso actual:</b> ${fmt(medidas.peso, 1)} kg</span>` : ""}
    ${medidas.peso_meta ? `<span><b>Peso meta:</b> ${fmt(medidas.peso_meta, 1)} kg</span>` : ""}
    ${plan.agua_vasos ? `<span><b>Agua:</b> ${esc(plan.agua_vasos)} vasos al día</span>` : ""}
  </div>
  ${req.kcal_objetivo ? `<div class="kpis salto">
    <div class="kpi"><div class="v">${fmt(req.kcal_objetivo)}</div><div class="l">kcal al día</div></div>
    <div class="kpi"><div class="v">${fmt(req.cho_g)} g</div><div class="l">Carbohidratos (${fmt(req.cho_pct)}%)</div></div>
    <div class="kpi"><div class="v">${fmt(req.pro_g)} g</div><div class="l">Proteínas (${fmt(req.pro_pct)}%)</div></div>
    <div class="kpi"><div class="v">${fmt(req.gra_g)} g</div><div class="l">Grasas (${fmt(req.gra_pct)}%)</div></div>
  </div>` : ""}
  ${gruposUsados.length ? `<h2>Porciones por tiempo de comida</h2>
  <table class="salto"><thead><tr><th style="text-align:left">Grupo</th>${tiemposUsados.map((t) => `<th>${esc(t.nombre)}</th>`).join("")}<th>Total</th></tr></thead>
  <tbody>${gruposUsados.map((g) => {
    const total = TIEMPOS.reduce((s, t) => s + (Number(porciones?.[t.clave]?.[g.clave]) || 0), 0);
    return `<tr><td class="g"><span class="punto" style="background:${g.color}"></span>${esc(g.nombre)}</td>${tiemposUsados.map((t) => `<td>${celda(porciones?.[t.clave]?.[g.clave])}</td>`).join("")}<td><b>${celda(total)}</b></td></tr>`;
  }).join("")}</tbody></table>
  <div style="font-size:10px;color:#6b7280;margin-top:4px">Aporte aproximado del plan: ${fmt(tot.kcal)} kcal · ${fmt(tot.cho)} g carbohidratos · ${fmt(tot.pro)} g proteínas · ${fmt(tot.gra)} g grasas.</div>
  <h2>¿Qué es una porción?</h2>
  <div class="eq salto">${gruposUsados.map((g) => `<div style="border-color:${g.color}"><b>${esc(g.nombre)}</b><span>${g.ejemplos.map(esc).join(" · ")}</span></div>`).join("")}</div>` : ""}
  ${diasMenu.length ? `<h2>Menú de ejemplo</h2>
  <table class="menu"><thead><tr><th>Día</th>${TIEMPOS.map((t) => `<th>${esc(t.nombre)}</th>`).join("")}</tr></thead>
  <tbody>${diasMenu.map((d) => `<tr class="salto"><td class="g">${esc(d)}</td>${TIEMPOS.map((t) => `<td>${esc(menu?.[d]?.[t.clave] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>` : ""}
  ${String(plan.recomendaciones || "").trim() ? `<h2>Recomendaciones</h2><div class="rec salto">${esc(plan.recomendaciones)}</div>` : ""}
  <div class="pie"><span>Este plan es personal. Consulte a su nutricionista antes de hacer cambios.</span><span>Medic-KG</span></div>
  </div></body></html>`;
}

router.get("/historia/:hid(\\d+)/pdf", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTablas();
    const clinicaId = clinicaDe(req);
    const [[r]] = await pool.query(`${SELECT} WHERE n.historia_id = ? AND n.clinica_id = ?`, [req.params.hid, clinicaId]);
    if (!r) return res.status(404).json({ ok: false, msg: "Guarde primero la hoja de nutrición de esta consulta." });
    const n = formatear(r);
    const [[clinica]] = await pool.query("SELECT nombre, telefono, logo_url FROM clinicas WHERE id = ?", [clinicaId]);
    const [[pac]] = await pool.query("SELECT nombres, apellidos FROM pacientes WHERE id = ?", [r.paciente_id]);
    const [[med]] = await pool.query(
      `SELECT u.* FROM historias_clinicas h JOIN usuarios u ON u.id = h.medico_id WHERE h.id = ?`, // u.* : nombre_display puede no existir aún
      [r.historia_id]
    ).catch(() => [[null]]);
    let medico = "";
    if (med) {
      const { tituloMedico } = require("../utils/tituloMedico");
      medico = med.nombre_display || `${tituloMedico(med.sexo, { tipo: med.tipo })}${med.nombres} ${med.apellidos}`.trim();
    }
    let logo = clinica?.logo_url || null;
    if (logo && !/^https?:\/\//.test(logo)) logo = `${req.protocol}://${req.get("host")}${logo.startsWith("/") ? "" : "/"}${logo}`;
    const [a, m, d] = String(n.fecha).split("-");
    const html = htmlPlan({
      clinica: clinica || {}, logo, medico,
      paciente: `${pac?.nombres || ""} ${pac?.apellidos || ""}`.trim(),
      fecha: `${d}/${m}/${a}`, req: n.requerimiento || {}, plan: n.plan || {}, medidas: n.medidas || {},
    });
    const { generarPdfDesdeHtml } = require("../utils/pdfFromHtml");
    const pdf = await generarPdfDesdeHtml(html, { paper_size: "LETTER", orientacion: "portrait" });
    const nombre = `plan_alimentacion_${String(pac?.nombres || "paciente").split(" ")[0]}`.normalize("NFD").replace(/[^a-zA-Z0-9_]/g, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${nombre}.pdf"`);
    res.send(pdf);
  } catch (e) {
    console.error("[nutricion] pdf:", e.message);
    if (!res.headersSent) res.status(500).json({ ok: false, msg: "No se pudo generar el PDF." });
  }
});

module.exports = router;
module.exports.htmlPlan = htmlPlan;
module.exports.formatear = formatear;
module.exports.SELECT = SELECT;
module.exports.asegurarTablas = asegurarTablas;
