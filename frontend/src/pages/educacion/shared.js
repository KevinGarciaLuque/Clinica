// Constantes y utilidades del módulo "Educación en Diabetes".
export { card, inputStyle, label, btn, deepMerge } from "../endocrinologia/shared";

export const TEAL       = "#0d9488";
export const TEAL_LIGHT = "rgba(13,148,136,.08)";

export const TIPOS_DM = [
  { v: "DM1", l: "DM1" },
  { v: "DM2", l: "DM2" },
  { v: "GESTACIONAL", l: "Diabetes gestacional" },
  { v: "OTRO", l: "Otro" },
];

export const COMORBILIDADES = [
  ["hta", "HTA"], ["dislipidemia", "Dislipidemia"], ["obesidad", "Obesidad"],
  ["erc", "ERC"], ["ecv", "ECV"], ["hipotiroidismo", "Hipotiroidismo"],
];

export const COMPLICACIONES = [
  ["retinopatia", "Retinopatía"], ["neuropatia", "Neuropatía"],
  ["nefropatia", "Nefropatía"], ["pie_diabetico", "Pie diabético"], ["ninguna", "Ninguna"],
];

export const ESQUEMAS = [
  { v: "BASAL", l: "Basal" }, { v: "BASAL_BOLO", l: "Basal-bolo" },
  { v: "MEZCLAS", l: "Mezclas" }, { v: "BOMBA", l: "Bomba" },
];

export const CONOCE_ITEMS = [
  ["hipoglucemia", "Hipoglucemia"], ["hiperglucemia", "Hiperglucemia"], ["tecnica", "Técnica de aplicación"],
  ["rotacion", "Rotación de sitios"], ["conteo_cho", "Conteo de CHO"], ["correccion", "Corrección"],
  ["dias_enfermedad", "Días de enfermedad"], ["cuidado_pies", "Cuidado de pies"],
];

export const TEMAS_PLAN = [
  ["alimentacion", "Alimentación"], ["conteo_cho", "Conteo CHO"], ["ajuste_insulina", "Ajuste de insulina"],
  ["hipoglucemia", "Hipoglucemia"], ["ejercicio", "Ejercicio"], ["cgm", "CGM"],
  ["glucometro", "Glucómetro"], ["cuidado_pies", "Cuidado de pies"], ["metas_glucosa", "Metas de glucosa"],
];

export const BARRERAS = [
  ["economicas", "Económicas"], ["olvido", "Olvido"], ["miedo", "Miedo"],
  ["baja_alfabetizacion", "Baja alfabetización"], ["falta_apoyo", "Falta de apoyo"],
];

export const SECCIONES_DEF = [
  { key: "diagnostico",          titulo: "Diagnóstico",                        icon: "bi-clipboard2-pulse" },
  { key: "antecedentes",         titulo: "Antecedentes Relevantes",            icon: "bi-heart-pulse" },
  { key: "tratamiento_actual",   titulo: "Tratamiento Actual",                 icon: "bi-capsule" },
  { key: "monitoreo",            titulo: "Monitoreo de Glucosa",               icon: "bi-droplet-half" },
  { key: "alimentacion",         titulo: "Alimentación",                       icon: "bi-egg-fried" },
  { key: "actividad_fisica",     titulo: "Actividad Física",                   icon: "bi-bicycle" },
  { key: "educacion_previa",     titulo: "Educación en Diabetes (previa)",     icon: "bi-mortarboard" },
  { key: "objetivos_paciente",   titulo: "Objetivos del Paciente",             icon: "bi-bullseye" },
  { key: "plan_educativo",       titulo: "Plan Educativo",                     icon: "bi-clipboard2-check" },
  { key: "evaluacion_educativa", titulo: "Evaluación Educativa",               icon: "bi-graph-up" },
];

// ── Automatizaciones ─────────────────────────────────────────────────────────

// Índice global de conocimiento: promedio de los 4 niveles evaluados (1-5)
export function calcularIndiceGlobal(ev) {
  if (!ev) return null;
  const vals = [ev.nivel_diabetes, ev.nivel_alimentacion, ev.nivel_insulina, ev.nivel_monitoreo]
    .map(Number).filter(v => Number.isFinite(v) && v > 0);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

// Temas del plan educativo cubiertos en ALGUNA sesión (histórico acumulado)
export function coberturaPlan(sesiones) {
  const cubiertos = new Set();
  (sesiones || []).forEach(s => {
    const temas = s.plan_educativo?.temas || {};
    Object.entries(temas).forEach(([k, v]) => { if (v) cubiertos.add(k); });
  });
  return cubiertos;
}

// Del listado de sesiones (ya ordenado por fecha DESC), la sección más reciente
// que sí tiene datos — útil para evaluar alertas con la información más actual.
export function ultimaSeccionConDatos(sesiones, key) {
  for (const s of sesiones || []) if (s[key]) return s[key];
  return null;
}

// Alertas de seguridad / prioridad a partir de los datos capturados
export function calcularAlertas({ monitoreo, actividad_fisica, alimentacion, educacion_previa } = {}) {
  const alertas = [];
  if (monitoreo?.hipoglucemias === "SI" && monitoreo?.reconoce_sintomas === "NO") {
    alertas.push({ nivel: "alto", texto: "Presenta hipoglucemias y no reconoce los síntomas — riesgo de seguridad." });
  }
  if (educacion_previa?.ha_recibido === "NO") {
    alertas.push({ nivel: "medio", texto: "No ha recibido educación en diabetes previamente." });
  }
  if (actividad_fisica?.no_realiza) {
    alertas.push({ nivel: "bajo", texto: "No realiza actividad física." });
  }
  if (alimentacion?.bebidas_azucaradas && !alimentacion?.conteo_carbohidratos) {
    alertas.push({ nivel: "medio", texto: "Consume bebidas azucaradas y no realiza conteo de carbohidratos." });
  }
  return alertas;
}

export const ALERTA_COLOR = { alto: "#ef4444", medio: "#f59e0b", bajo: "#0284c7" };
export const ALERTA_ICONO = { alto: "bi-exclamation-triangle-fill", medio: "bi-exclamation-circle-fill", bajo: "bi-info-circle-fill" };

export const emptySesion = {
  diagnostico: { tipo_dm: "", tipo_dm_otro: "", anio_diagnostico: "", motivo_consulta: "", medico_tratante: "" },
  antecedentes: {
    comorbilidades: { hta: false, dislipidemia: false, obesidad: false, erc: false, ecv: false, hipotiroidismo: false, otra: false, otra_texto: "" },
    complicaciones: { retinopatia: false, neuropatia: false, nefropatia: false, pie_diabetico: false, ninguna: false },
  },
  tratamiento_actual: { medicamentos: "", insulina_basal: "", insulina_rapida: "", esquema: "" },
  monitoreo: { metodo: { glucometro: false, cgm: false }, frecuencia: "", ayunas: "", antes_comidas: "", despues_comidas: "", hipoglucemias: "", reconoce_sintomas: "" },
  alimentacion: { quien_prepara: "", comidas_dia: "", bebidas_azucaradas: false, conteo_carbohidratos: false, horario_regular: false },
  actividad_fisica: { no_realiza: false, tipo: "", frecuencia: "" },
  educacion_previa: { ha_recibido: "", conoce: { hipoglucemia: false, hiperglucemia: false, tecnica: false, rotacion: false, conteo_cho: false, correccion: false, dias_enfermedad: false, cuidado_pies: false } },
  objetivos_paciente: "",
  plan_educativo: {
    temas: { alimentacion: false, conteo_cho: false, ajuste_insulina: false, hipoglucemia: false, ejercicio: false, cgm: false, glucometro: false, cuidado_pies: false, metas_glucosa: false },
    proxima_cita: "", observaciones: "",
  },
  evaluacion_educativa: {
    nivel_diabetes: "", nivel_alimentacion: "", nivel_insulina: "", nivel_monitoreo: "",
    barreras: { economicas: false, olvido: false, miedo: false, baja_alfabetizacion: false, falta_apoyo: false, otra: false, otra_texto: "" },
  },
};
