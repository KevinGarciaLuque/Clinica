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

export const emptyHistoria = {
  medico: "",
  fecha_diagnostico: "", edad_diagnostico: "", circunstancia_diagnostico: "", circunstancia_otro: "",
  autoanticuerpos: { na: false, no_realizados: false, anti_gad: false, ia2: false, znt8: false, otro: "" },
  tratamiento_inicial: { basal_bolo: false, bomba: false, otro: "" },
  antecedentes_patologicos: {}, antecedentes_otros: "",
  tabaquismo: "", tabaquismo_comentario: "", alcohol: "", alcohol_comentario: "", drogas: "", drogas_comentario: "",
  antecedentes_familiares: {},
  gineco_obstetricos: { na: false, menarquia: "", fum: "", ciclos: "", g: "", p: "", a: "", c: "", complicaciones: "", complicaciones_detalle: "", planificacion: "", planificacion_cual: "" },
};

export function deepMerge(base, extra) {
  if (!extra) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(base)) {
    if (extra[k] !== undefined) {
      out[k] = (typeof base[k] === "object" && base[k] !== null && !Array.isArray(base[k]))
        ? deepMerge(base[k], extra[k]) : extra[k];
    }
  }
  return out;
}
