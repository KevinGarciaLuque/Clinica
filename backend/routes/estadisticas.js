/**
 * routes/estadisticas.js
 * Módulo de reportería — KPIs operativos del mes/rango seleccionado.
 * GET /api/estadisticas/resumen      → KPIs (pacientes nuevos, consultas, canal, ingresos)
 * GET /api/estadisticas/serie-citas  → conteo diario de citas para gráfico
 * GET /api/estadisticas/por-medico   → ranking de consultas por médico (solo ADMIN/SUPER_ADMIN)
 * GET /api/estadisticas/asistencia   → asistencia, ausencias, confirmaciones y lista de espera
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const dayjs  = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const { zonaClinica, ahoraClinica, localSql } = require("../utils/zonaHoraria");

// Mes actual según la hora de la clínica (no la del servidor, que está en UTC)
function rangoFechas(req, tz) {
  const hoy = ahoraClinica(tz);
  const inicioMes = hoy.startOf("month").format("YYYY-MM-DD");
  const finMes     = hoy.endOf("month").format("YYYY-MM-DD");
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || "") ? req.query.desde : inicioMes;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta || "") ? req.query.hasta : finMes;
  return { desde, hasta };
}

// GET /api/estadisticas/resumen
router.get("/resumen", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const esMedico  = req.user.tipo === "MEDICO";
    const tz = await zonaClinica(clinicaId);
    const { desde, hasta } = rangoFechas(req, tz);

    const filtroMedico = esMedico ? " AND medico_id = ? " : "";
    const paramsMedico = esMedico ? [req.user.id] : [];

    const [
      [consultasAtendidas],
      [pacientesNuevos],
      [citasAgendadas],
      [citasPorCanal],
      [citasCanceladas],
      [ingresos],
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total FROM citas
         WHERE clinica_id=? AND estado='COMPLETADA' AND DATE(inicio) BETWEEN ? AND ? ${filtroMedico}`,
        [clinicaId, desde, hasta, ...paramsMedico]
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM pacientes WHERE clinica_id=? AND DATE(${localSql("creado_en", tz)}) BETWEEN ? AND ?`,
        [clinicaId, desde, hasta]
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM citas
         WHERE clinica_id=? AND DATE(${localSql("creado_en", tz)}) BETWEEN ? AND ? ${filtroMedico}`,
        [clinicaId, desde, hasta, ...paramsMedico]
      ),
      pool.query(
        `SELECT canal, COUNT(*) AS total FROM citas
         WHERE clinica_id=? AND DATE(${localSql("creado_en", tz)}) BETWEEN ? AND ? ${filtroMedico}
         GROUP BY canal`,
        [clinicaId, desde, hasta, ...paramsMedico]
      ),
      pool.query(
        `SELECT estado, COUNT(*) AS total FROM citas
         WHERE clinica_id=? AND estado IN ('CANCELADA','NO_ASISTIO') AND DATE(inicio) BETWEEN ? AND ? ${filtroMedico}
         GROUP BY estado`,
        [clinicaId, desde, hasta, ...paramsMedico]
      ),
      // Ingresos: solo visible para ADMIN/SUPER_ADMIN (privacidad financiera de cada médico)
      esMedico
        ? Promise.resolve([[{ total_pagado: 0, total_pendiente: 0 }]])
        : pool.query(
            `SELECT
               COALESCE(SUM(CASE WHEN estado='PAGADA' THEN total ELSE 0 END), 0) AS total_pagado,
               COALESCE(SUM(CASE WHEN estado='PENDIENTE' THEN total ELSE 0 END), 0) AS total_pendiente
             FROM facturas
             WHERE clinica_id=? AND estado != 'ANULADA' AND DATE(${localSql("creado_en", tz)}) BETWEEN ? AND ?`,
            [clinicaId, desde, hasta]
          ),
    ]);

    res.json({
      ok: true,
      data: {
        rango: { desde, hasta },
        consultas_atendidas: consultasAtendidas[0].total,
        pacientes_nuevos:    pacientesNuevos[0].total,
        citas_agendadas:     citasAgendadas[0].total,
        citas_por_canal:     citasPorCanal,
        citas_canceladas:    citasCanceladas,
        ingresos: esMedico ? null : {
          pagado:    Number(ingresos[0].total_pagado),
          pendiente: Number(ingresos[0].total_pendiente),
        },
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/estadisticas/serie-citas
router.get("/serie-citas", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const esMedico  = req.user.tipo === "MEDICO";
    const tz = await zonaClinica(clinicaId);
    const { desde, hasta } = rangoFechas(req, tz);
    const filtroMedico = esMedico ? " AND medico_id = ? " : "";
    const paramsMedico = esMedico ? [req.user.id] : [];

    const [rows] = await pool.query(
      `SELECT DATE(inicio) AS fecha, COUNT(*) AS total,
              SUM(CASE WHEN estado='COMPLETADA' THEN 1 ELSE 0 END) AS completadas
       FROM citas
       WHERE clinica_id=? AND DATE(inicio) BETWEEN ? AND ? ${filtroMedico}
       GROUP BY DATE(inicio)
       ORDER BY fecha ASC`,
      [clinicaId, desde, hasta, ...paramsMedico]
    );

    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/estadisticas/por-medico  (solo ADMIN/SUPER_ADMIN)
router.get("/por-medico", auth("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const tz = await zonaClinica(clinicaId);
    const { desde, hasta } = rangoFechas(req, tz);

    const [rows] = await pool.query(
      `SELECT u.id AS medico_id, u.nombres, u.apellidos, u.sexo,
              COUNT(*) AS citas_totales,
              SUM(CASE WHEN c.estado='COMPLETADA' THEN 1 ELSE 0 END) AS consultas_atendidas,
              SUM(CASE WHEN c.estado IN ('CANCELADA','NO_ASISTIO') THEN 1 ELSE 0 END) AS canceladas_no_asistio
       FROM citas c
       JOIN usuarios u ON u.id = c.medico_id
       WHERE c.clinica_id=? AND DATE(c.inicio) BETWEEN ? AND ?
       GROUP BY u.id, u.nombres, u.apellidos, u.sexo
       ORDER BY consultas_atendidas DESC`,
      [clinicaId, desde, hasta]
    );

    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/estadisticas/asistencia?desde&hasta
// Solo lectura. Cuenta citas cuyo horario ya pasó (en la hora local de la clínica).
// El médico ve solo sus citas; ADMIN/RECEPCIONISTA ven toda la clínica.
const ASISTIO = "('COMPLETADA','EN_ATENCION','EN_ESPERA')";
router.get("/asistencia", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const esMedico  = req.user.tipo === "MEDICO";
    const tz = await zonaClinica(clinicaId);
    const { desde, hasta } = rangoFechas(req, tz);
    const fm = esMedico ? " AND c.medico_id = ? " : "";
    const pm = esMedico ? [req.user.id] : [];

    const [[cl]] = await pool.query("SELECT COALESCE(timezone,'America/Tegucigalpa') AS tz FROM clinicas WHERE id=?", [clinicaId]);
    const ahora = dayjs().tz(cl?.tz || "America/Tegucigalpa").format("YYYY-MM-DD HH:mm:ss");
    const finRango = `${hasta} 23:59:59`;
    const corte = finRango < ahora ? finRango : ahora;

    // Tablas creadas por las funciones nuevas: si aún no existen, los conteos son 0
    const [tablas] = await pool.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('cita_enlaces')`);
    const hayEnlaces = tablas.length > 0;

    // Asistencia: solo citas cuyo horario ya pasó. Cancelaciones: todo el mes
    // (una cancelación se conoce aunque la cita sea más adelante).
    const conteos = `
      COUNT(*) AS total,
      SUM(c.inicio <= ? AND c.estado IN ${ASISTIO}) AS asistieron,
      SUM(c.inicio <= ? AND c.estado = 'NO_ASISTIO') AS no_asistio,
      SUM(c.estado = 'CANCELADA') AS canceladas,
      SUM(c.inicio <= ? AND c.estado IN ('PENDIENTE','CONFIRMADA')) AS sin_marcar`;
    const base = `FROM citas c WHERE c.clinica_id = ? AND c.estado <> 'PENDIENTE_APROBACION'
                  AND c.inicio >= ? AND c.inicio <= ? ${fm}`;
    const params = [corte, corte, corte, clinicaId, `${desde} 00:00:00`, finRango, ...pm];

    const [
      [[totales]],
      [porMedico],
      [[enlaces]],
      [[recordatorios]],
      [[listaEspera]],
      [tendencia],
      [ausentes],
    ] = await Promise.all([
      pool.query(`SELECT ${conteos} ${base}`, params),
      pool.query(
        `SELECT c.medico_id, u.nombres, u.apellidos, u.sexo, ${conteos}
         FROM citas c JOIN usuarios u ON u.id = c.medico_id
         WHERE c.clinica_id = ? AND c.estado <> 'PENDIENTE_APROBACION'
           AND c.inicio >= ? AND c.inicio <= ? ${fm}
         GROUP BY c.medico_id, u.nombres, u.apellidos, u.sexo
         ORDER BY total DESC`, params),
      hayEnlaces
        ? pool.query(
            `SELECT SUM(e.accion = 'CONFIRMADA') AS confirmadas, SUM(e.accion = 'CANCELADA') AS canceladas
             FROM cita_enlaces e JOIN citas c ON c.id = e.cita_id
             WHERE c.clinica_id = ? AND c.inicio BETWEEN ? AND ? ${fm}`,
            [clinicaId, `${desde} 00:00:00`, finRango, ...pm])
        : Promise.resolve([[{ confirmadas: 0, canceladas: 0 }]]),
      pool.query(
        `SELECT COUNT(*) AS enviados, COUNT(DISTINCT h.cita_id) AS citas
         FROM historial_recordatorios h JOIN citas c ON c.id = h.cita_id
         WHERE h.clinica_id = ? AND h.estado = 'ENVIADO' AND c.inicio BETWEEN ? AND ? ${fm}`,
        [clinicaId, `${desde} 00:00:00`, finRango, ...pm]),
      pool.query(
        `SELECT COUNT(*) AS recuperadas FROM citas c
         WHERE c.clinica_id = ? AND c.canal = 'LISTA_ESPERA' AND c.inicio BETWEEN ? AND ? ${fm}`,
        [clinicaId, `${desde} 00:00:00`, finRango, ...pm]),
      // Últimos 6 meses hasta el mes consultado
      pool.query(
        `SELECT DATE_FORMAT(c.inicio, '%Y-%m') AS mes,
                SUM(c.estado IN ${ASISTIO}) AS asistieron,
                SUM(c.estado = 'NO_ASISTIO') AS no_asistio,
                SUM(c.estado = 'CANCELADA') AS canceladas
         FROM citas c
         WHERE c.clinica_id = ? AND c.estado <> 'PENDIENTE_APROBACION'
           AND c.inicio >= ? AND c.inicio <= ? ${fm}
         GROUP BY mes ORDER BY mes`,
        [clinicaId, dayjs(desde).subtract(5, "month").startOf("month").format("YYYY-MM-DD 00:00:00"), corte, ...pm]),
      // Pacientes que más faltan (últimos 6 meses)
      pool.query(
        `SELECT p.id, p.nombres, p.apellidos, p.telefono,
                SUM(c.estado = 'NO_ASISTIO') AS ausencias, COUNT(*) AS citas,
                DATE_FORMAT(MAX(CASE WHEN c.estado = 'NO_ASISTIO' THEN c.inicio END), '%Y-%m-%d') AS ultima
         FROM citas c JOIN pacientes p ON p.id = c.paciente_id
         WHERE c.clinica_id = ? AND c.estado <> 'PENDIENTE_APROBACION'
           AND c.inicio >= ? AND c.inicio <= ? ${fm}
         GROUP BY p.id, p.nombres, p.apellidos, p.telefono
         HAVING ausencias >= 2
         ORDER BY ausencias DESC, ultima DESC
         LIMIT 10`,
        [clinicaId, dayjs(desde).subtract(5, "month").startOf("month").format("YYYY-MM-DD 00:00:00"), corte, ...pm]),
    ]);

    // SUM() devuelve texto/NULL en MySQL: solo esas columnas se pasan a número
    const NUMERICAS = new Set(["total", "asistieron", "no_asistio", "canceladas", "sin_marcar", "confirmadas",
      "enviados", "citas", "recuperadas", "ausencias"]);
    const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, NUMERICAS.has(k) ? Number(v || 0) : v]));
    res.json({
      ok: true,
      data: {
        rango: { desde, hasta },
        totales: num(totales),
        por_medico: porMedico.map(num),
        enlaces: num(enlaces || {}),
        recordatorios: num(recordatorios),
        lista_espera: num(listaEspera),
        tendencia: tendencia.map(num),
        ausentes: ausentes.map(num),
      },
    });
  } catch (e) {
    console.error("[estadisticas/asistencia]", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo calcular la asistencia" });
  }
});

module.exports = router;
