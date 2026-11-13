// Cálculos del módulo de Nutrición (todo en el navegador, sin depender del servidor).

export const ACTIVIDADES = [
  { clave: "sedentario", nombre: "Sedentario (poco o nada de ejercicio)", factor: 1.2 },
  { clave: "ligera", nombre: "Ligera (1–3 días por semana)", factor: 1.375 },
  { clave: "moderada", nombre: "Moderada (3–5 días por semana)", factor: 1.55 },
  { clave: "intensa", nombre: "Intensa (6–7 días por semana)", factor: 1.725 },
  { clave: "muy_intensa", nombre: "Muy intensa (atleta / trabajo físico)", factor: 1.9 },
];

export const AJUSTES = [
  { valor: -500, nombre: "Bajar de peso (−500 kcal)" },
  { valor: -250, nombre: "Bajar suave (−250 kcal)" },
  { valor: 0, nombre: "Mantener peso" },
  { valor: 250, nombre: "Subir suave (+250 kcal)" },
  { valor: 500, nombre: "Subir de peso (+500 kcal)" },
];

export const FORMULAS = [
  { clave: "mifflin", nombre: "Mifflin-St Jeor" },
  { clave: "harris", nombre: "Harris-Benedict (revisada)" },
  { clave: "manual", nombre: "Escribir las calorías a mano" },
];

export const num = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
export const redondear = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);

/** Gasto en reposo (kcal/día). sexo "M" o "F", peso kg, talla cm, edad años */
export function tasaMetabolica(formula, { sexo, peso, talla, edad }) {
  if (!peso || !talla || edad === null || edad === undefined) return null;
  const mujer = String(sexo || "").toUpperCase().startsWith("F");
  if (formula === "harris") {
    return mujer
      ? 447.593 + 9.247 * peso + 3.098 * talla - 4.33 * edad
      : 88.362 + 13.397 * peso + 4.799 * talla - 5.677 * edad;
  }
  if (formula === "mifflin") {
    return 10 * peso + 6.25 * talla - 5 * edad + (mujer ? -161 : 5);
  }
  return null;
}

/** Gramos de cada macronutriente para unas calorías y porcentajes */
export function macrosEnGramos(kcal, { cho_pct, pro_pct, gra_pct }) {
  if (!kcal) return { cho_g: null, pro_g: null, gra_g: null };
  return {
    cho_g: Math.round((kcal * (num(cho_pct) || 0)) / 100 / 4),
    pro_g: Math.round((kcal * (num(pro_pct) || 0)) / 100 / 4),
    gra_g: Math.round((kcal * (num(gra_pct) || 0)) / 100 / 9),
  };
}

/** Clasificación del IMC en adultos (OMS) */
export function clasificarIMC(imc) {
  if (!imc) return null;
  if (imc < 18.5) return { texto: "Bajo peso", color: "#0ea5e9" };
  if (imc < 25) return { texto: "Normal", color: "#16a34a" };
  if (imc < 30) return { texto: "Sobrepeso", color: "#f59e0b" };
  if (imc < 35) return { texto: "Obesidad grado I", color: "#f97316" };
  if (imc < 40) return { texto: "Obesidad grado II", color: "#ef4444" };
  return { texto: "Obesidad grado III", color: "#b91c1c" };
}

/** Riesgo por circunferencia de cintura (adultos) */
export function riesgoCintura(cintura, sexo) {
  if (!cintura) return null;
  const mujer = String(sexo || "").toUpperCase().startsWith("F");
  const [aumentado, alto] = mujer ? [80, 88] : [94, 102];
  if (cintura >= alto) return { texto: "Riesgo alto", color: "#ef4444" };
  if (cintura >= aumentado) return { texto: "Riesgo aumentado", color: "#f59e0b" };
  return { texto: "Sin riesgo", color: "#16a34a" };
}

/** Índice cintura/cadera y su riesgo */
export function riesgoICC(icc, sexo) {
  if (!icc) return null;
  const mujer = String(sexo || "").toUpperCase().startsWith("F");
  return icc > (mujer ? 0.85 : 0.9) ? { texto: "Riesgo", color: "#ef4444" } : { texto: "Normal", color: "#16a34a" };
}

// Durnin & Womersley (1974): densidad = c − m·log10(suma de 4 pliegues), por sexo y edad
const DW = {
  M: [[19, 1.162, 0.063], [29, 1.1631, 0.0632], [39, 1.1422, 0.0544], [49, 1.162, 0.07], [200, 1.1715, 0.0779]],
  F: [[19, 1.1549, 0.0678], [29, 1.1599, 0.0717], [39, 1.1423, 0.0632], [49, 1.1333, 0.0612], [200, 1.1339, 0.0645]],
};
/** % de grasa con 4 pliegues (bíceps, tríceps, subescapular, suprailíaco) + fórmula de Siri. Solo 17 años o más */
export function grasaPorPliegues({ bicipital, tricipital, subescapular, suprailiaco }, sexo, edad) {
  const vals = [bicipital, tricipital, subescapular, suprailiaco].map(num);
  if (vals.some((v) => !v) || edad === null || edad < 17) return null;
  const tabla = DW[String(sexo || "").toUpperCase().startsWith("F") ? "F" : "M"];
  const [, c, m] = tabla.find(([hasta]) => edad <= hasta);
  const densidad = c - m * Math.log10(vals.reduce((s, v) => s + v, 0));
  const pct = 495 / densidad - 450;
  return pct > 0 && pct < 70 ? redondear(pct, 1) : null;
}

/** Totales del plan (kcal y gramos) según las porciones de cada tiempo de comida */
export function totalesPlan(porciones, grupos, tiempos) {
  const t = { kcal: 0, cho: 0, pro: 0, gra: 0 };
  for (const g of grupos) {
    const n = tiempos.reduce((s, ti) => s + (num(porciones?.[ti.clave]?.[g.clave]) || 0), 0);
    t.kcal += n * g.kcal; t.cho += n * g.cho; t.pro += n * g.pro; t.gra += n * g.gra;
  }
  return { kcal: Math.round(t.kcal), cho: Math.round(t.cho), pro: Math.round(t.pro), gra: Math.round(t.gra) };
}

/** % de adecuación (aporte / objetivo) con color: verde 90–110 %, amarillo 80–120 %, rojo fuera */
export function adecuacion(aporte, objetivo) {
  if (!objetivo) return null;
  const pct = Math.round((aporte / objetivo) * 100);
  const color = pct >= 90 && pct <= 110 ? "#16a34a" : pct >= 80 && pct <= 120 ? "#f59e0b" : "#ef4444";
  return { pct, color };
}
