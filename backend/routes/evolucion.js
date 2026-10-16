/**
 * routes/evolucion.js — Evolución del paciente  (/api/evolucion/:pacienteId)
 *
 * Reúne, consulta por consulta, los signos vitales registrados (presión, pulso,
 * frecuencia respiratoria, temperatura, saturación, peso, talla → IMC), el
 * diagnóstico y el médico, más un resumen de asistencia y los diagnósticos más
 * frecuentes. Lo usa la pestaña "Evolución" del expediente para las gráficas.
 *
 * Etapa 2: resultados de laboratorio agrupados por examen (para graficar su
 * evolución con el rango normal), cambios de tratamiento entre una receta y la
 * siguiente (inicia / suspende) y avisos automáticos ("presión alta en las
 * últimas 3 consultas", "glucosa fuera de rango en los 2 últimos resultados"…).
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

// Clave para agrupar exámenes escritos distinto: "Glucosa ", "GLUCOSA", "glucósa" → "glucosa"
const normal = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

// "180", "180 mg/dL", "6,5 %", "< 5" → número (o null si no es numérico, p. ej. "Negativo")
function valorNumerico(v) {
  const m = String(v ?? "").replace(/,(\d)/g, ".$1").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

async function laboratorios(pid, clinicaId) {
  const [rows] = await pool.query(
    `SELECT r.id, r.nombre_examen, r.valor_resultado, r.valor_referencia_min AS min, r.valor_referencia_max AS max,
            r.unidad, r.anormal, DATE_FORMAT(COALESCE(r.cargado_en, s.creado_en), '%Y-%m-%d') AS fecha
     FROM estudios_resultados r
     JOIN estudios_solicitudes s ON s.id = r.solicitud_id
     WHERE s.paciente_id = ? AND s.clinica_id = ? AND s.estado <> 'CANCELADO'
       AND r.nombre_examen IS NOT NULL AND r.nombre_examen <> ''
     ORDER BY COALESCE(r.cargado_en, s.creado_en) ASC, r.id ASC
     LIMIT 1000`, [pid, clinicaId]);
  const grupos = new Map();
  for (const r of rows) {
    const valor = valorNumerico(r.valor_resultado);
    if (valor == null) continue;                       // resultados de texto no se grafican
    const clave = normal(r.nombre_examen);
    if (!clave) continue;
    const min = r.min != null ? Number(r.min) : null;
    const max = r.max != null ? Number(r.max) : null;
    const fueraRango = (min != null && valor < min) || (max != null && valor > max);
    const g = grupos.get(clave) || { clave, nombre: String(r.nombre_examen).trim(), unidad: r.unidad || "", min: null, max: null, valores: [] };
    g.nombre = String(r.nombre_examen).trim();         // se muestra el nombre más reciente
    if (r.unidad) g.unidad = r.unidad;
    if (min != null) g.min = min;
    if (max != null) g.max = max;
    g.valores.push({ fecha: r.fecha, valor, anormal: Boolean(r.anormal) || fueraRango, texto: String(r.valor_resultado).trim() });
    grupos.set(clave, g);
  }
  // Primero los exámenes con más resultados (los que tiene sentido graficar)
  return [...grupos.values()].sort((a, b) => b.valores.length - a.valores.length || a.nombre.localeCompare(b.nombre)).slice(0, 30);
}

// Recetas → cambios de tratamiento entre una y la siguiente
async function cambiosTratamiento(pid, clinicaId) {
  const [rows] = await pool.query(
    `SELECT pr.id, DATE_FORMAT(pr.creado_en, '%Y-%m-%d') AS fecha,
            COALESCE(m.nombre_generico, pi.medicamento_texto) AS medicamento
     FROM prescripciones pr
     JOIN prescripcion_items pi ON pi.prescripcion_id = pr.id
     LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
     WHERE pr.paciente_id = ? AND pr.clinica_id = ? AND (pr.estado IS NULL OR pr.estado <> 'CANCELADA')
     ORDER BY pr.creado_en ASC, pr.id ASC, pi.id ASC
     LIMIT 2000`, [pid, clinicaId]);
  const recetas = [];
  for (const r of rows) {
    const nombre = String(r.medicamento || "").trim();
    if (!nombre) continue;
    let rx = recetas[recetas.length - 1];
    if (!rx || rx.id !== r.id) { rx = { id: r.id, fecha: r.fecha, meds: new Map() }; recetas.push(rx); }
    // "Losartán 50 mg (tabletas)" y "losartan" cuentan como el mismo medicamento
    const clave = normal(nombre.replace(/\(.*?\)/g, "")).split(" ").filter((w) => !/^\d/.test(w)).slice(0, 2).join(" ") || normal(nombre);
    if (!rx.meds.has(clave)) rx.meds.set(clave, nombre);
  }
  // inicia: medicamento nuevo · ajusta: mismo medicamento con otra dosis/presentación
  // no_incluye: venía en la receta anterior y no está en esta (puede ser una receta
  // aguda que no repite el tratamiento crónico, por eso no se afirma que se suspendió)
  const cambios = [];
  let previo = new Map();
  for (const rx of recetas) {
    const inicia = [...rx.meds.entries()].filter(([k]) => !previo.has(k)).map(([, n]) => n);
    const ajusta = [...rx.meds.entries()]
      .filter(([k, n]) => previo.has(k) && normal(previo.get(k)) !== normal(n))
      .map(([k, n]) => ({ antes: previo.get(k), ahora: n }));
    const noIncluye = [...previo.entries()].filter(([k]) => !rx.meds.has(k)).map(([, n]) => n);
    if (inicia.length || ajusta.length || noIncluye.length) {
      const ult = cambios[cambios.length - 1];
      if (ult && ult.fecha === rx.fecha) {           // varias recetas el mismo día → un solo cambio
        ult.inicia.push(...inicia); ult.ajusta.push(...ajusta);
        ult.no_incluye = ult.no_incluye.filter((n) => !inicia.includes(n));
      } else {
        cambios.push({ fecha: rx.fecha, inicia, ajusta, no_incluye: noIncluye, primera: previo.size === 0 });
      }
    }
    previo = rx.meds;
  }
  return cambios.slice(-20);
}

// Avisos automáticos para la toma de decisiones (orientativos)
function calcularAvisos({ consultas, labs, asistencia12, diagnosticos }) {
  const avisos = [];
  const conPa = consultas.filter((c) => c.vitales.sis != null && c.vitales.dia != null);
  const ult3 = conPa.slice(-3);
  if (ult3.length === 3 && ult3.every((c) => c.vitales.sis >= 140 || c.vitales.dia >= 90)) {
    avisos.push({ nivel: "alto", icono: "bi-heart-pulse-fill", texto: "Presión arterial alta (≥ 140/90) en las últimas 3 consultas." });
  } else if (ult3.length === 3 && ult3.every((c) => c.vitales.sis >= 130 || c.vitales.dia >= 80)) {
    avisos.push({ nivel: "medio", icono: "bi-heart-pulse", texto: "Presión por encima de la meta (130/80) en las últimas 3 consultas." });
  } else if (conPa.length >= 2) {
    const [a, b] = conPa.slice(-2);
    if ((a.vitales.sis >= 130 || a.vitales.dia >= 80) && b.vitales.sis < 130 && b.vitales.dia < 80) {
      avisos.push({ nivel: "bueno", icono: "bi-heart-pulse", texto: `Presión dentro de la meta en la última consulta (${b.vitales.sis}/${b.vitales.dia}).` });
    }
  }

  // Cambio de peso importante (≥ 5 % en 6 meses o menos)
  const conPeso = consultas.filter((c) => c.vitales.peso != null);
  if (conPeso.length >= 2) {
    const ultimo = conPeso[conPeso.length - 1];
    const desde = dayjs(ultimo.fecha).subtract(6, "month").format("YYYY-MM-DD");
    const base = conPeso.find((c) => c.fecha >= desde && c !== ultimo);
    if (base) {
      const dif = ultimo.vitales.peso - base.vitales.peso;
      const pct = (dif / base.vitales.peso) * 100;
      if (Math.abs(pct) >= 5) {
        const meses = Math.max(1, Math.round(dayjs(ultimo.fecha).diff(dayjs(base.fecha), "day") / 30));
        avisos.push({ nivel: "medio", icono: "bi-speedometer", texto: `${dif < 0 ? "Bajó" : "Subió"} ${Math.abs(Math.round(dif * 10) / 10)} kg (${Math.abs(Math.round(pct))} %) en ${meses} ${meses === 1 ? "mes" : "meses"}.` });
      }
    }
  }

  const ultSpo2 = [...consultas].reverse().find((c) => c.vitales.spo2 != null);
  if (ultSpo2 && ultSpo2.vitales.spo2 < 92) {
    avisos.push({ nivel: "alto", icono: "bi-lungs-fill", texto: `Saturación baja en la última toma (${ultSpo2.vitales.spo2} %).` });
  }

  // Laboratorios fuera de rango de forma repetida
  const conUnidad = (n, u) => `${n}${u ? ` ${u}` : ""}`;
  // Distancia al rango normal (0 = dentro): sirve para decir si "se acerca" al rango
  const distancia = (g, x) => (g.min != null && x < g.min ? g.min - x : g.max != null && x > g.max ? x - g.max : 0);
  for (const g of labs) {
    const v = g.valores;
    const ult = v[v.length - 1]; const ant = v[v.length - 2];
    if (ant && ult.anormal && ant.anormal) {
      const tieneRango = g.min != null || g.max != null;
      const acerca = tieneRango && distancia(g, ult.valor) < distancia(g, ant.valor);
      const aleja = tieneRango && distancia(g, ult.valor) > distancia(g, ant.valor);
      const tendencia = acerca ? "acercándose al rango normal" : aleja ? "alejándose del rango normal" : ult.valor === ant.valor ? "sin cambio" : ult.valor > ant.valor ? "subiendo" : "bajando";
      avisos.push({ nivel: aleja ? "alto" : "medio", icono: "bi-droplet-half", texto: `${g.nombre} fuera de rango en los 2 últimos resultados (${ant.valor} → ${conUnidad(ult.valor, g.unidad)}, ${tendencia}).` });
    } else if (ult?.anormal) {
      avisos.push({ nivel: "medio", icono: "bi-droplet-half", texto: `Último resultado de ${g.nombre} fuera de rango (${conUnidad(ult.valor, g.unidad)}).` });
    } else if (ant && !ult.anormal && ant.anormal) {
      avisos.push({ nivel: "bueno", icono: "bi-droplet-half", texto: `${g.nombre} volvió al rango normal (${conUnidad(ult.valor, g.unidad)}).` });
    }
  }

  // Paciente con diagnóstico repetido (crónico) sin control reciente
  const ultima = consultas[consultas.length - 1];
  const cronico = diagnosticos.find((x) => x.veces >= 2);
  if (ultima && cronico) {
    const meses = dayjs().diff(dayjs(ultima.fecha), "month");
    if (meses >= 6) avisos.push({ nivel: "medio", icono: "bi-calendar-x", texto: `Sin consulta hace ${meses} meses (diagnóstico frecuente: ${cronico.nombre}).` });
  }

  if (asistencia12?.falto >= 2) {
    avisos.push({ nivel: "medio", icono: "bi-calendar2-x", texto: `Faltó a ${asistencia12.falto} citas en los últimos 12 meses.` });
  }

  const orden = { alto: 0, medio: 1, bueno: 2 };
  return avisos.sort((a, b) => orden[a.nivel] - orden[b.nivel]).slice(0, 8);
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
    let asistencia12 = null;
    try {
      const [[cl]] = await pool.query("SELECT COALESCE(timezone,'America/Tegucigalpa') AS tz FROM clinicas WHERE id=?", [clinicaId]);
      const ahora = dayjs().tz(cl?.tz || "America/Tegucigalpa").format("YYYY-MM-DD HH:mm:ss");
      const [[a]] = await pool.query(
        `SELECT SUM(estado IN ('COMPLETADA','EN_ATENCION','EN_ESPERA')) AS asistio,
                SUM(estado = 'NO_ASISTIO') AS falto,
                SUM(estado = 'CANCELADA') AS cancelo
         FROM citas WHERE paciente_id = ? AND clinica_id = ? AND inicio < ?`, [pid, clinicaId, ahora]);
      asistencia = { asistio: Number(a.asistio || 0), falto: Number(a.falto || 0), cancelo: Number(a.cancelo || 0) };
      const haceUnAnio = dayjs().tz(cl?.tz || "America/Tegucigalpa").subtract(12, "month").format("YYYY-MM-DD HH:mm:ss");
      const [[a12]] = await pool.query(
        "SELECT SUM(estado = 'NO_ASISTIO') AS falto FROM citas WHERE paciente_id = ? AND clinica_id = ? AND inicio > ? AND inicio < ?",
        [pid, clinicaId, haceUnAnio, ahora]);
      asistencia12 = { falto: Number(a12.falto || 0) };
    } catch (e) {
      if (e.code !== "ER_NO_SUCH_TABLE" && e.code !== "ER_BAD_FIELD_ERROR") console.error("[evolucion] asistencia", e.message);
    }

    // Cada sección es independiente: si una tabla no existe en esta clínica, se omite
    const opcional = async (fn) => {
      try { return await fn(); } catch (e) {
        if (e.code !== "ER_NO_SUCH_TABLE" && e.code !== "ER_BAD_FIELD_ERROR") console.error("[evolucion]", e.message);
        return [];
      }
    };
    const labs = await opcional(() => laboratorios(pid, clinicaId));
    const tratamiento = await opcional(() => cambiosTratamiento(pid, clinicaId));
    const avisos = calcularAvisos({ consultas, labs, asistencia12, diagnosticos });

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
        laboratorios: labs,
        tratamiento,
        avisos,
      },
    });
  } catch (e) {
    console.error("[evolucion]", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo cargar la evolución del paciente" });
  }
});

module.exports = router;
