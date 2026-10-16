/**
 * routes/evolucion.js — Evolución del paciente  (/api/evolucion/:pacienteId)
 *
 * Reúne, consulta por consulta, los signos vitales registrados (presión, pulso,
 * frecuencia respiratoria, temperatura, saturación, peso, talla → IMC), el
 * diagnóstico y el médico, más un resumen de asistencia y los diagnósticos más
 * frecuentes. Lo usa la pestaña "Evolución" del expediente para las gráficas.
 *
 * Solo lectura: no crea tablas ni modifica datos.
 */
const router = require("express").Router();
const dayjs  = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const { tituloMedico } = require("../utils/tituloMedico");

const ROLES = ["ADMIN", "MEDICO", "PSICOLOGO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"];
const clinicaDe = (req) => (req.user.super ? req.tenant?.clinica_id : req.user.clinica_id);

// "120/80", "120 / 80", "120-80" → { sis: 120, dia: 80 }
function leerPresion(v) {
  const m = String(v || "").match(/(\d{2,3})\s*[/\\-]\s*(\d{2,3})/);
  if (!m) return null;
  const sis = Number(m[1]); const dia = Number(m[2]);
  if (sis < 50 || sis > 260 || dia < 30 || dia > 160) return null;
  return { sis, dia };
}

// Número dentro de un rango razonable (descarta errores de digitación)
function numero(v, min, max) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function leerObjetivo(objetivo) {
  if (!objetivo) return {};
  if (typeof objetivo === "object") return objetivo;
  try { const o = JSON.parse(objetivo); return o && typeof o === "object" ? o : {}; } catch { return {}; }
}

async function consultasDelPaciente(pid, clinicaId) {
  const sql = (conDisplay) => `
    SELECT h.id, h.estado, h.diagnostico_cie, h.diagnostico_desc, h.objetivo,
           DATE_FORMAT(h.creado_en, '%Y-%m-%d') AS fecha,
           u.nombres AS med_nombres, u.apellidos AS med_apellidos, u.sexo AS med_sexo, u.tipo AS med_tipo
           ${conDisplay ? ", u.nombre_display AS med_nombre_display" : ""}
    FROM historias_clinicas h
    LEFT JOIN usuarios u ON u.id = h.medico_id
    WHERE h.paciente_id = ? AND h.clinica_id = ?
    ORDER BY h.creado_en ASC, h.id ASC
    LIMIT 300`;
  try {
    return (await pool.query(sql(true), [pid, clinicaId]))[0];
  } catch (e) {
    if (e.code !== "ER_BAD_FIELD_ERROR") throw e;
    return (await pool.query(sql(false), [pid, clinicaId]))[0];   // sin columna nombre_display
  }
}

router.get("/:pacienteId", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    const pid = Number(req.params.pacienteId);
    const [[p]] = await pool.query(
      "SELECT id, fecha_nacimiento, sexo FROM pacientes WHERE id = ? AND clinica_id = ?", [pid, clinicaId]);
    if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    const filas = await consultasDelPaciente(pid, clinicaId);

    // Consultas con sus signos (la talla se arrastra de la última conocida para calcular el IMC)
    let tallaConocida = null;
    const consultas = filas.map((h) => {
      const o = leerObjetivo(h.objetivo);
      const pa = leerPresion(o.pa);
      const talla = numero(o.talla, 40, 230);
      if (talla) tallaConocida = talla;
      const peso = numero(o.peso, 1, 400);
      const tallaImc = talla || tallaConocida;
      const imc = peso && tallaImc && tallaImc >= 100 ? Math.round((peso / ((tallaImc / 100) ** 2)) * 10) / 10 : null;
      const medico = String(h.med_nombre_display || "").trim() ||
        (h.med_nombres ? `${tituloMedico(h.med_sexo, { tipo: h.med_tipo, desconocido: "Dr. " })}${h.med_nombres} ${h.med_apellidos || ""}`.trim() : "");
      return {
        id: h.id,
        fecha: h.fecha,
        estado: h.estado,
        diagnostico_cie: h.diagnostico_cie || null,
        diagnostico: h.diagnostico_desc || null,
        medico,
        vitales: {
          sis: pa?.sis ?? null,
          dia: pa?.dia ?? null,
          fc: numero(o.fc, 20, 250),
          fr: numero(o.fr, 4, 80),
          temp: numero(o.temp, 30, 45),
          spo2: numero(o.spo2, 50, 100),
          peso,
          talla,
          imc,
        },
      };
    });

    // Diagnósticos más frecuentes
    const conteo = new Map();
    for (const c of consultas) {
      const nombre = (c.diagnostico || c.diagnostico_cie || "").trim();
      if (!nombre) continue;
      const clave = (c.diagnostico_cie || nombre).toUpperCase();
      const prev = conteo.get(clave) || { cie: c.diagnostico_cie, nombre, veces: 0, ultima: c.fecha };
      prev.veces += 1; prev.ultima = c.fecha; prev.nombre = nombre;
      conteo.set(clave, prev);
    }
    const diagnosticos = [...conteo.values()].sort((a, b) => b.veces - a.veces || (a.ultima < b.ultima ? 1 : -1)).slice(0, 6);

    // Asistencia a citas (todas las citas cuyo horario ya pasó; citas.inicio es hora local)
    let asistencia = null;
    try {
      const [[cl]] = await pool.query("SELECT COALESCE(timezone,'America/Tegucigalpa') AS tz FROM clinicas WHERE id=?", [clinicaId]);
      const ahora = dayjs().tz(cl?.tz || "America/Tegucigalpa").format("YYYY-MM-DD HH:mm:ss");
      const [[a]] = await pool.query(
        `SELECT SUM(estado IN ('COMPLETADA','EN_ATENCION','EN_ESPERA')) AS asistio,
                SUM(estado = 'NO_ASISTIO') AS falto,
                SUM(estado = 'CANCELADA') AS cancelo
         FROM citas WHERE paciente_id = ? AND clinica_id = ? AND inicio < ?`, [pid, clinicaId, ahora]);
      asistencia = { asistio: Number(a.asistio || 0), falto: Number(a.falto || 0), cancelo: Number(a.cancelo || 0) };
    } catch (e) {
      if (e.code !== "ER_NO_SUCH_TABLE" && e.code !== "ER_BAD_FIELD_ERROR") console.error("[evolucion] asistencia", e.message);
    }

    res.json({
      ok: true,
      data: {
        paciente: {
          edad: p.fecha_nacimiento ? dayjs().diff(dayjs(p.fecha_nacimiento), "year") : null,
          sexo: p.sexo,
        },
        consultas,
        diagnosticos,
        asistencia,
      },
    });
  } catch (e) {
    console.error("[evolucion]", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo cargar la evolución del paciente" });
  }
});

module.exports = router;
