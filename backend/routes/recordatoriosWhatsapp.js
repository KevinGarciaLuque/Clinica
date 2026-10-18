/**
 * routes/recordatoriosWhatsapp.js — Recordatorios de citas por WhatsApp "con un clic".
 *
 * No usa ninguna cuenta de WhatsApp Business: arma el mensaje (con el enlace para
 * confirmar o cancelar la cita) y el número del paciente; recepción toca el botón,
 * se abre WhatsApp con el mensaje listo y solo presiona Enviar.
 *
 *  GET  /api/recordatorios-whatsapp?fecha=YYYY-MM-DD   → citas del día (por defecto mañana)
 *  POST /api/recordatorios-whatsapp/:citaId/enviado    → marca el recordatorio como enviado
 */
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");
const { zonaClinica, ahoraClinica } = require("../utils/zonaHoraria");
const { tituloMedico } = require("../utils/tituloMedico");
const { enlaceCita, asegurarTabla: asegurarEnlaces } = require("../utils/citaEnlace");

const ROLES = ["ADMIN", "MEDICO", "PSICOLOGO", "RECEPCIONISTA", "ENFERMERA", "SUPER_ADMIN"];
const ESTADOS_ACTIVOS = ["PENDIENTE", "CONFIRMADA", "PENDIENTE_APROBACION"];

const CODIGO_PAIS = {
  HN: "504", GT: "502", SV: "503", NI: "505", CR: "506", PA: "507", MX: "52", US: "1", DO: "1",
  CO: "57", PE: "51", EC: "593", BO: "591", CL: "56", AR: "54", VE: "58", ES: "34", PY: "595", UY: "598",
};

// Número en formato internacional (solo dígitos) para wa.me
function telefonoWhatsapp(tel, pais) {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  const cod = CODIGO_PAIS[String(pais || "HN").toUpperCase()] || "504";
  if (String(tel).trim().startsWith("+")) return d;
  if (d.startsWith(cod) && d.length > cod.length + 6) return d;
  return cod + d;
}

const MENSAJE_BASE =
  "Hola {nombre} 👋\n\nLe recordamos su cita en *{clinica}* con {medico}:\n📅 {fecha}\n🕐 {hora}\n\n" +
  "Por favor confirme o cancele aquí 👉 {enlace_cita}\n\n¡Le esperamos!";

let tablaLista = false;
async function asegurarTabla() {
  if (tablaLista) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_recordatorios_manuales (
      cita_id     INT UNSIGNED NOT NULL PRIMARY KEY,
      clinica_id  INT UNSIGNED NOT NULL,
      usuario_id  INT UNSIGNED NULL,
      veces       INT NOT NULL DEFAULT 1,
      enviado_en  DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_wrm_clinica (clinica_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablaLista = true;
}

const clinicaDe = (req) => req.tenant?.clinica_id || req.user?.clinica_id;

/** Plantilla de WhatsApp de la clínica (Recordatorios → Plantillas), si tiene una activa */
async function plantillaClinica(clinicaId) {
  try {
    const [[p]] = await pool.query(
      `SELECT contenido FROM plantillas_recordatorio
       WHERE clinica_id = ? AND tipo = 'WHATSAPP' AND activo = 1
       ORDER BY es_predeterminada DESC, horas_antes DESC LIMIT 1`,
      [clinicaId]
    );
    return p?.contenido || null;
  } catch { return null; } // la clínica no tiene el módulo de recordatorios
}

function rellenar(texto, v) {
  let t = String(texto || "");
  for (const [k, val] of Object.entries(v)) t = t.split(`{${k}}`).join(val ?? "");
  // Si la plantilla de la clínica no traía el enlace, se agrega al final
  if (v.enlace_cita && !t.includes(v.enlace_cita)) t += `\n\nConfirme o cancele su cita aquí 👉 ${v.enlace_cita}`;
  return t;
}

router.get("/", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Seleccione una clínica." });
    await asegurarTabla();
    await asegurarEnlaces();
    const tz = await zonaClinica(clinicaId);
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || "")
      ? req.query.fecha
      : ahoraClinica(tz).add(1, "day").format("YYYY-MM-DD");

    const [[clinica]] = await pool.query("SELECT nombre, pais FROM clinicas WHERE id = ?", [clinicaId]);
    const [citas] = await pool.query(
      `SELECT c.id, c.estado, DATE_FORMAT(c.inicio, '%Y-%m-%d %H:%i') AS inicio, c.tipo_consulta,
              p.id AS paciente_id, p.nombres, p.apellidos, p.telefono,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos, u.sexo AS med_sexo, u.tipo AS med_tipo,
              e.accion AS respuesta, DATE_FORMAT(e.accion_en, '%Y-%m-%d %H:%i') AS respuesta_en,
              w.enviado_en, w.veces
       FROM citas c
       JOIN pacientes p ON p.id = c.paciente_id
       JOIN usuarios u ON u.id = c.medico_id
       LEFT JOIN cita_enlaces e ON e.cita_id = c.id
       LEFT JOIN whatsapp_recordatorios_manuales w ON w.cita_id = c.id
       WHERE c.clinica_id = ? AND DATE(c.inicio) = ? AND c.estado IN (?)
       ORDER BY c.inicio ASC`,
      [clinicaId, fecha, ESTADOS_ACTIVOS]
    );

    const plantilla = (await plantillaClinica(clinicaId)) || MENSAJE_BASE;
    const dia = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

    const data = [];
    for (const c of citas) {
      const [h, m] = c.inicio.slice(11, 16).split(":").map(Number);
      const hora = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
      const medico = `${tituloMedico(c.med_sexo, { tipo: c.med_tipo })}${c.med_nombres} ${c.med_apellidos}`.trim();
      const enlace = await enlaceCita(c.id);
      const nombre = String(c.nombres || "").split(" ")[0];
      const mensaje = rellenar(plantilla, {
        nombre, paciente: `${c.nombres} ${c.apellidos}`.trim(), clinica: clinica?.nombre || "la clínica",
        medico, fecha: dia, hora, enlace_cita: enlace || "",
      });
      const tel = telefonoWhatsapp(c.telefono, clinica?.pais);
      data.push({
        cita_id: c.id, inicio: c.inicio, hora, estado: c.estado, tipo_consulta: c.tipo_consulta,
        paciente_id: c.paciente_id, paciente: `${c.nombres} ${c.apellidos}`.trim(), telefono: c.telefono || null,
        medico, respuesta: c.estado === "CONFIRMADA" && !c.respuesta ? "CONFIRMADA" : c.respuesta || null,
        respuesta_en: c.respuesta_en, enviado_en: c.enviado_en || null, veces: c.veces || 0,
        whatsapp: tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}` : null,
        mensaje,
      });
    }
    res.json({ ok: true, fecha, dia, data });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/:citaId/enviado", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    await asegurarTabla();
    const [[c]] = await pool.query("SELECT id FROM citas WHERE id = ? AND clinica_id = ?", [req.params.citaId, clinicaId]);
    if (!c) return res.status(404).json({ ok: false, msg: "Cita no encontrada." });
    await pool.query(
      `INSERT INTO whatsapp_recordatorios_manuales (cita_id, clinica_id, usuario_id) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE veces = veces + 1, enviado_en = CURRENT_TIMESTAMP, usuario_id = VALUES(usuario_id)`,
      [c.id, clinicaId, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
