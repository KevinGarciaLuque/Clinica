// Constantes y utilidades del "Informe de Monitoreo Continuo de Glucosa" (AGP).
// Documento imprimible dentro del módulo "Educación en Diabetes".

// Filas de la tabla "Tiempo en Rangos (TIR)" — 5 niveles, formato de la hoja oficial.
export const RANGOS_MCG = [
  { key: "tir",      label: "Tiempo en rango (TIR)",        sub: "Rango objetivo", rango: "70 – 180",  color: "#16a34a" },
  { key: "tar",      label: "Tiempo por encima del rango (TAR)", sub: "Alto",      rango: "181 – 250", color: "#f59e0b" },
  { key: "tar_alto", label: "Tiempo muy por encima (TAR alto)",  sub: "Muy alto",  rango: "> 250",     color: "#dc2626" },
  { key: "tbr",      label: "Tiempo por debajo del rango (TBR)", sub: "Bajo",      rango: "54 – 69",   color: "#2563eb" },
  { key: "tbr_bajo", label: "Tiempo muy por debajo (TBR bajo)",  sub: "Muy bajo",  rango: "< 54",      color: "#7c3aed" },
];

// Sección 3 — Interpretación clínica (5 cajas de texto libre).
export const CAMPOS_INTERPRETACION = [
  ["hiperglucemia",      "Patrones de hiperglucemia", "bi-graph-up-arrow"],
  ["hipoglucemias",      "Hipoglucemias",             "bi-arrow-down"],
  ["variabilidad",       "Variabilidad glucémica",    "bi-activity"],
  ["horarios_riesgo",    "Horarios de mayor riesgo",  "bi-clock"],
  ["patrones_nocturnos", "Patrones nocturnos",        "bi-moon-stars"],
];

// Sección 4 — Recomendaciones educativas (6 cajas de texto libre, una idea por línea).
export const CAMPOS_RECOMENDACIONES = [
  ["alimentacion",            "Alimentación",                          "bi-apple"],
  ["actividad_fisica",        "Actividad física",                      "bi-bicycle"],
  ["tratamiento_insulina",    "Tratamiento / Insulina",                "bi-capsule"],
  ["prevencion_hipoglucemia", "Prevención y manejo de hipoglucemia",   "bi-droplet"],
  ["uso_sensor",              "Uso correcto del sensor",               "bi-cpu"],
  ["automonitoreo",           "Automonitoreo cuando corresponda",      "bi-clipboard-data"],
];

const rangosVacios = () =>
  RANGOS_MCG.reduce((acc, r) => { acc[r.key] = { pct: "", tiempo: "" }; return acc; }, {});

const desdePares = (pares) =>
  pares.reduce((acc, [k]) => { acc[k] = ""; return acc; }, {});

export const emptyInforme = {
  encabezado: { id_expediente: "", dispositivo_sensor: "", fecha_inicio: "", fecha_fin: "", dias_analizados: "" },
  resumen: { dias_uso_sensor: "", pct_datos_disponibles: "", glucosa_promedio: "", gmi: "", cv: "", desviacion_estandar: "" },
  tiempo_rangos: rangosVacios(),
  interpretacion: desdePares(CAMPOS_INTERPRETACION),
  recomendaciones: desdePares(CAMPOS_RECOMENDACIONES),
  plan: { objetivos_acordados: "", proxima_revision: "", observaciones: "" },
  profesional: { nombre: "", profesion_cargo: "", numero_colegiacion: "" },
};

// Suma de porcentajes de los 5 rangos — para el badge "TOTAL" de la tabla.
export function sumaPorcentajes(tr) {
  return RANGOS_MCG.reduce((a, r) => a + (Number(tr?.[r.key]?.pct) || 0), 0);
}

// Convierte un textarea multilínea en viñetas para la impresión.
export const aLineas = (txt) =>
  String(txt || "").split("\n").map(l => l.trim()).filter(Boolean);
