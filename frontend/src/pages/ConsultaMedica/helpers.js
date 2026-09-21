// ─── helpers compartidos por los tabs de Consulta Médica ──────────────────
export const VITALS_FIELDS = [
  { key: "pa",    label: "P.A.",   placeholder: "Ej: 120/80", unit: "mmHg" },
  { key: "fc",    label: "F.C.",   placeholder: "Ej: 72",     unit: "bpm"  },
  { key: "fr",    label: "F.R.",   placeholder: "Ej: 16",     unit: "rpm"  },
  { key: "temp",  label: "Temp.",  placeholder: "Ej: 36.5",   unit: "°C"   },
  { key: "peso",  label: "Peso",   placeholder: "Ej: 70",     unit: "kg"   },
  { key: "talla", label: "Talla",  placeholder: "Ej: 170",    unit: "cm"   },
  { key: "spo2",  label: "SpO₂",   placeholder: "Ej: 98",     unit: "%"    },
  { key: "imc",   label: "IMC",    placeholder: "Auto",       unit: "kg/m²", readOnly: true },
  { key: "sc",    label: "S.C.",   placeholder: "Auto",       unit: "m²",   readOnly: true },
  { key: "pc",    label: "Per. Cefálico", placeholder: "Ej: 45", unit: "cm", pediatricOnly: true },
];

export function calcIMC(peso, talla) {
  const p = parseFloat(peso), t = parseFloat(talla);
  if (!p || !t) return "";
  return (p / ((t / 100) ** 2)).toFixed(1);
}

// Superficie corporal — fórmula de Mosteller: √(talla_cm × peso_kg / 3600)
export function calcSC(peso, talla) {
  const p = parseFloat(peso), t = parseFloat(talla);
  if (!p || !t) return "";
  return Math.sqrt((t * p) / 3600).toFixed(2);
}

// ─── helper datos_derma ─────────────────────────────────────────────────────
export function parseDerma(raw) {
  if (!raw) return {};
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { return {}; }
}
