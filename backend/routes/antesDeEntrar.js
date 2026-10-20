/**
 * routes/antesDeEntrar.js — Resumen "Antes de entrar"  (/api/antes-de-entrar/:pacienteId)
 *
 * Todo lo que el médico debe saber del paciente en 5 segundos al abrir la consulta:
 * alergias, antecedentes, últimos signos vitales, medicamentos de la última receta,
 * estudios pendientes o con resultado, asistencia a citas, control pendiente y saldo.
 *
 * Solo lectura. Cada sección es independiente: si una falla (p. ej. una tabla que
 * esa clínica aún no tiene), se omite y el resto se muestra igual.
 */
const router = require("express").Router();
const dayjs  = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const ROLES = ["ADMIN", "MEDICO", "PSICOLOGO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"];
const clinicaDe = (req) => (req.user.super ? req.tenant?.clinica_id : req.user.clinica_id);

async function seccion(fn, porDefecto) {
  try { return await fn(); } catch (e) {
    if (e.code !== "ER_NO_SUCH_TABLE" && e.code !== "ER_BAD_FIELD_ERROR") console.error("[antes-de-entrar]", e.message);
    return porDefecto;
  }
}

function leerVitales(objetivo) {
  if (!objetivo) return null;
  let o = objetivo;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return null; } }
  if (!o || typeof o !== "object") return null;
  const v = {};
  for (const k of ["pa", "fc", "fr", "temp", "spo2", "peso", "talla"]) {
    if (o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== "") v[k] = String(o[k]).trim();
  }
  return Object.keys(v).length ? v : null;
}

router.get("/:pacienteId", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = clinicaDe(req);
    const pid = Number(req.params.pacienteId);
    const excluir = Number(req.query.excluir_historia) || 0; // la consulta que se está editando
    const [[p]] = await pool.query(
      `SELECT id, nombres, apellidos, fecha_nacimiento, sexo, grupo_sanguineo, telefono
       FROM pacientes WHERE id = ? AND clinica_id = ?`, [pid, clinicaId]);
    if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
    // citas.inicio es hora local de la clínica: "ahora" en su zona horaria
    const [[cl]] = await pool.query("SELECT COALESCE(timezone,'America/Tegucigalpa') AS tz FROM clinicas WHERE id=?", [clinicaId]);
    const ahora = dayjs().tz(cl?.tz || "America/Tegucigalpa");
    const ahoraTxt = ahora.format("YYYY-MM-DD HH:mm:ss");
    const haceUnAnio = ahora.subtract(12, "month").format("YYYY-MM-DD HH:mm:ss");

    const [alergias, antecedentes, vitales, medicamentos, estudios, asistencia, control, saldo] = await Promise.all([
      seccion(async () => (await pool.query(
        `SELECT agente, tipo, severidad, reaccion FROM alergias_paciente
         WHERE paciente_id = ? AND clinica_id = ? AND activo = 1
         ORDER BY FIELD(severidad,'MORTAL','SEVERA','MODERADA','LEVE'), agente LIMIT 12`, [pid, clinicaId]))[0], []),

      seccion(async () => (await pool.query(
        `SELECT tipo, descripcion FROM antecedentes_paciente
         WHERE paciente_id = ? AND clinica_id = ? AND activo = 1
         ORDER BY registrado_en DESC LIMIT 10`, [pid, clinicaId]))[0], []),

      // Últimas dos consultas con signos vitales (para ver si cambió el peso / la presión)
      seccion(async () => {
        const [rows] = await pool.query(
          `SELECT objetivo, DATE_FORMAT(creado_en,'%Y-%m-%d') AS fecha FROM historias_clinicas
           WHERE paciente_id = ? AND clinica_id = ? AND id <> ? AND objetivo IS NOT NULL
           ORDER BY creado_en DESC LIMIT 6`, [pid, clinicaId, excluir]);
        const conDatos = rows.map((r) => ({ fecha: r.fecha, ...leerVitales(r.objetivo) })).filter((r) => Object.keys(r).length > 1);
        return conDatos.length ? { ultimo: conDatos[0], anterior: conDatos[1] || null } : null;
      }, null),

      // Medicamentos de la última receta
      seccion(async () => {
        const [[rx]] = await pool.query(
          `SELECT id, DATE_FORMAT(creado_en,'%Y-%m-%d') AS fecha FROM prescripciones
           WHERE paciente_id = ? AND clinica_id = ? ORDER BY creado_en DESC LIMIT 1`, [pid, clinicaId]);
        if (!rx) return null;
        const [items] = await pool.query(
          `SELECT COALESCE(m.nombre_generico, pi.medicamento_texto) AS medicamento, pi.dosis, pi.duracion
           FROM prescripcion_items pi LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
           WHERE pi.prescripcion_id = ? LIMIT 10`, [rx.id]);
        return items.length ? { fecha: rx.fecha, items } : null;
      }, null),

      // Estudios solicitados: pendientes y con resultado ya cargado
      seccion(async () => {
        const [rows] = await pool.query(
          `SELECT es.id, es.tipo, es.descripcion, es.urgente, es.estado,
                  DATE_FORMAT(es.creado_en,'%Y-%m-%d') AS fecha,
                  (SELECT COUNT(*) FROM estudios_resultados r WHERE r.solicitud_id = es.id) AS resultados,
                  (SELECT SUM(r.anormal) FROM estudios_resultados r WHERE r.solicitud_id = es.id) AS anormales
           FROM estudios_solicitudes es
           WHERE es.paciente_id = ? AND es.clinica_id = ? AND es.estado <> 'CANCELADO'
             AND es.creado_en > NOW() - INTERVAL 6 MONTH
           ORDER BY es.creado_en DESC LIMIT 8`, [pid, clinicaId]);
        return rows.map((r) => ({ ...r, resultados: Number(r.resultados || 0), anormales: Number(r.anormales || 0), urgente: Boolean(r.urgente) }));
      }, []),

      // Asistencia en los últimos 12 meses (solo citas cuyo horario ya pasó)
      seccion(async () => {
        const [[a]] = await pool.query(
          `SELECT SUM(estado IN ('COMPLETADA','EN_ATENCION','EN_ESPERA')) AS asistio,
                  SUM(estado = 'NO_ASISTIO') AS falto,
                  SUM(estado = 'CANCELADA') AS cancelo
           FROM citas WHERE paciente_id = ? AND clinica_id = ?
             AND inicio > ? AND inicio < ?`, [pid, clinicaId, haceUnAnio, ahoraTxt]);
        return { asistio: Number(a.asistio || 0), falto: Number(a.falto || 0), cancelo: Number(a.cancelo || 0) };
      }, null),

      seccion(async () => {
        const [[c]] = await pool.query(
          `SELECT DATE_FORMAT(fecha_objetivo,'%Y-%m-%d') AS fecha, motivo, estado FROM controles_programados
           WHERE paciente_id = ? AND clinica_id = ? AND estado IN ('PENDIENTE','AVISADO')
           ORDER BY fecha_objetivo LIMIT 1`, [pid, clinicaId]);
        return c || null;
      }, null),

      seccion(async () => {
        const [[s]] = await pool.query(
          `SELECT COUNT(*) AS facturas, COALESCE(SUM(total),0) AS total, MAX(moneda) AS moneda
           FROM facturas WHERE paciente_id = ? AND clinica_id = ? AND estado = 'PENDIENTE'`, [pid, clinicaId]);
        return Number(s.facturas) ? { facturas: Number(s.facturas), total: Number(s.total), moneda: s.moneda || "L" } : null;
      }, null),
    ]);

    const edad = p.fecha_nacimiento ? dayjs().diff(dayjs(p.fecha_nacimiento), "year") : null;
    res.json({
      ok: true,
      data: {
        paciente: { nombres: p.nombres, apellidos: p.apellidos, edad, sexo: p.sexo, grupo_sanguineo: p.grupo_sanguineo, fecha_nacimiento: p.fecha_nacimiento ? dayjs(p.fecha_nacimiento).format("YYYY-MM-DD") : null },
        alergias, antecedentes, vitales, medicamentos, estudios, asistencia, control, saldo,
      },
    });
  } catch (e) {
    console.error("[antes-de-entrar]", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo cargar el resumen" });
  }
});

module.exports = router;
