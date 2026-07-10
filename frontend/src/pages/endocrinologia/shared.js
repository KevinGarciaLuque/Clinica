// Constantes y utilidades compartidas entre ConsultaEndocrinologia (página completa)
// y los tabs de Historia Clínica / Seguimientos embebidos en el perfil del paciente.

export const ORANGE       = "#ea580c";
export const ORANGE_LIGHT = "rgba(234,88,12,.08)";

export const card = {
  background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
  boxShadow: "0 2px 8px rgba(0,0,0,.05)", padding: "16px 18px", marginBottom: 16,
};
export const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 9,
  border: "1px solid #d1d5db", fontSize: "0.88rem",
  outline: "none", background: "#fafafa", boxSizing: "border-box",
};
export const label = { fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
export const btn = (color = ORANGE, ghost = false) => ({
  background: ghost ? "transparent" : color,
  color: ghost ? color : "#fff",
  border: `1px solid ${color}`,
  borderRadius: 9, padding: "8px 16px",
  fontSize: "0.83rem", fontWeight: 600,
  cursor: "pointer", display: "inline-flex",
  alignItems: "center", gap: 6, whiteSpace: "nowrap",
});

export const CIRCUNSTANCIAS = [
  { v: "ASINTOMATICO", l: "Asintomático" },
  { v: "CETOACIDOSIS", l: "Cetoacidosis diabética" },
  { v: "HIPERGLUCEMIA_SINTOMATICA", l: "Hiperglucemia sintomática" },
  { v: "OTRO", l: "Otro" },
];

export const AUTOANTICUERPOS = [
  ["anti_gad", "Anti-GAD"], ["ia2", "IA-2"], ["znt8", "ZnT8"], ["ica", "ICA"], ["iaa", "IAA"],
];

export const ANTECEDENTES_PATOLOGICOS = [
  ["hipertension", "Hipertensión"], ["dislipidemia", "Dislipidemia"],
  ["enfermedad_cardiovascular", "Enfermedad cardiovascular"], ["enfermedades_autoinmunes", "Enfermedades autoinmunes"],
  ["cirugias_previas", "Cirugías previas"], ["alergias", "Alergias"],
  ["apnea_sueno", "Apnea obstructiva del sueño"], ["hospitalizaciones_recientes", "Hospitalizaciones recientes asociadas a diabetes"],
];

export const ANTECEDENTES_FAMILIARES = [
  ["dm1", "Diabetes Mellitus Tipo 1"], ["dm2", "Diabetes Mellitus Tipo 2"],
  ["hta", "Hipertensión arterial"], ["dislipidemia", "Dislipidemia"],
  ["cardiovasculares", "Enfermedades cardiovasculares"], ["autoinmunes", "Enfermedades autoinmunes"],
];

export const PARENTESCO_OPTIONS = [
  "Madre", "Padre", "Hermano", "Hermana",
  "Abuela materna", "Abuelo materno", "Abuela paterna", "Abuelo paterno",
  "Tío", "Tía", "Primo", "Prima", "Otro",
];

export const QUICK_PHRASES = {
  antecedentes_otros: ["Niega otros antecedentes", "Sin hospitalizaciones recientes", "Sin cirugías previas"],
  tabaquismo_comentario: ["Niega consumo"],
  alcohol_comentario: ["Niega consumo"],
  drogas_comentario: ["Niega consumo", "No aplica por la edad"],
};

export const emptyHistoria = {
  medico: "", medico_refiere: "",
  fecha_diagnostico: "", edad_diagnostico: "",
  circunstancias_diagnostico: { ASINTOMATICO: false, CETOACIDOSIS: false, HIPERGLUCEMIA_SINTOMATICA: false, OTRO: false },
  circunstancia_otro: "",
  autoanticuerpos: {
    na: false, no_realizados: false,
    anti_gad: { valor: false, comentario: "" }, ia2: { valor: false, comentario: "" }, znt8: { valor: false, comentario: "" },
    ica: { valor: false, comentario: "" }, iaa: { valor: false, comentario: "" },
    otro: { activo: false, nombre: "", resultado: "" },
  },
  tratamiento_inicial: { basal_bolo: false, bomba: false, otro: "" },
  antecedentes_patologicos_estado: "", antecedentes_patologicos: {}, antecedentes_otros: "",
  tabaquismo: "", tabaquismo_comentario: "", alcohol: "", alcohol_comentario: "", drogas: "", drogas_comentario: "",
  // antecedentes_familiares[slug] = { valor, familiares: [{ parentesco, parentesco_otro }] } — varios familiares por enfermedad
  antecedentes_familiares: {},
  gineco_obstetricos: {
    menarquia_presento: "", // "" | "SI" | "NO"
    menarquia_edad: "",
    gineco: { fum: "", ciclos: "", planificacion_cual: "" },
    obstetrico: { tiene_antecedentes: "", g: "", p: "", a: "", c: "", complicaciones_detalle: "" },
  },
};

export function deepMerge(base, extra) {
  if (!extra) return base;
  const out = { ...base };
  // Recorre la unión de claves (no solo las de `base`) para que los diccionarios dinámicos
  // (antecedentes_patologicos, antecedentes_familiares — que arrancan en {} en emptyHistoria)
  // sí incorporen los slugs guardados, que no existen en el shape por defecto.
  for (const k of new Set([...Object.keys(base), ...Object.keys(extra)])) {
    if (extra[k] === undefined) continue;
    const baseVal = base[k];
    out[k] = (typeof baseVal === "object" && baseVal !== null && !Array.isArray(baseVal))
      ? deepMerge(baseVal, extra[k]) : extra[k];
  }
  return out;
}
