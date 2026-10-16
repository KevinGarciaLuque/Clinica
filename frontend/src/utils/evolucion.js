// Cálculos compartidos de la evolución del paciente (pantalla y resumen imprimible):
// clasificación de signos por rango de referencia, fechas y cambios de tratamiento.
import dayjs from "dayjs";

export const VERDE = { bg: "#dcfce7", fg: "#15803d" };
export const AMBAR = { bg: "#fef3c7", fg: "#b45309" };
export const NARANJA = { bg: "#ffedd5", fg: "#c2410c" };
export const ROJO = { bg: "#fee2e2", fg: "#b91c1c" };
export const GRIS = { bg: "#f1f5f9", fg: "#475569" };

// Clasificación de cada signo (para el color de la tarjeta)
export const estadoPresion = (s, d) => {
  if (s == null || d == null) return null;
  if (s >= 140 || d >= 90) return { ...ROJO, txt: "Alta" };
  if (s >= 130 || d >= 80) return { ...NARANJA, txt: "Alta etapa 1" };
  if (s >= 120) return { ...AMBAR, txt: "Elevada" };
  if (s < 90 || d < 60) return { ...AMBAR, txt: "Baja" };
  return { ...VERDE, txt: "Normal" };
};
export const estadoImc = (v) => v == null ? null
  : v < 18.5 ? { ...AMBAR, txt: "Bajo peso" } : v < 25 ? { ...VERDE, txt: "Normal" }
  : v < 30 ? { ...AMBAR, txt: "Sobrepeso" } : { ...ROJO, txt: "Obesidad" };
export const estadoFc = (v) => v == null ? null : v < 60 ? { ...AMBAR, txt: "Baja" } : v > 100 ? { ...AMBAR, txt: "Alta" } : { ...VERDE, txt: "Normal" };
export const estadoSpo2 = (v) => v == null ? null : v >= 95 ? { ...VERDE, txt: "Normal" } : v >= 90 ? { ...AMBAR, txt: "Baja" } : { ...ROJO, txt: "Muy baja" };
export const estadoTemp = (v) => v == null ? null : v > 38 ? { ...ROJO, txt: "Fiebre" } : v > 37.5 ? { ...AMBAR, txt: "Febrícula" } : v < 35.5 ? { ...AMBAR, txt: "Baja" } : { ...VERDE, txt: "Normal" };

export const OTROS = [
  { key: "fc",   label: "Pulso",       unidad: "lpm", color: "#e11d48", rango: [60, 100] },
  { key: "spo2", label: "Saturación",  unidad: "%",   color: "#0284c7", rango: [95, 100] },
  { key: "temp", label: "Temperatura", unidad: "°C",  color: "#ea580c", rango: [36, 37.5] },
  { key: "fr",   label: "Resp.",       unidad: "rpm", color: "#7c3aed", rango: [12, 20] },
];

export const fechaCorta = (f) => dayjs(f).format("DD/MM/YY");
export const haceCuanto = (f) => {
  const dias = dayjs().startOf("day").diff(dayjs(f), "day");
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 31) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  return meses < 12 ? `hace ${meses} ${meses === 1 ? "mes" : "meses"}` : `hace ${(dias / 365).toFixed(1).replace(".0", "")} años`;
};

// Último y penúltimo registro de un signo
export function ultimos(consultas, clave) {
  const con = consultas.filter((c) => c.vitales[clave] != null);
  return { ultimo: con[con.length - 1] || null, anterior: con[con.length - 2] || null };
}

export const NIVEL = {
  alto:  { bg: "#fef2f2", borde: "#fecaca", fg: "#b91c1c", icono: "bi-exclamation-octagon-fill" },
  medio: { bg: "#fffbeb", borde: "#fde68a", fg: "#92400e", icono: "bi-exclamation-triangle-fill" },
  bueno: { bg: "#f0fdf4", borde: "#bbf7d0", fg: "#15803d", icono: "bi-check-circle-fill" },
};

// Texto corto de un cambio de tratamiento (para la leyenda al pasar el mouse)
export function textoCambio(c) {
  const partes = [];
  if (c.inicia.length) partes.push(`${c.primera ? "Tratamiento" : "Nuevo"}: ${c.inicia.join(", ")}`);
  if (c.ajusta.length) partes.push(`Cambio de dosis: ${c.ajusta.map((a) => `${a.antes} → ${a.ahora}`).join(", ")}`);
  if (c.no_incluye.length) partes.push(`No incluido: ${c.no_incluye.join(", ")}`);
  return partes.join(" · ");
}

// Agrega a la serie las fechas de cambios de tratamiento (para poder marcarlas en el eje)
export function conFechas(serie, fechas) {
  const existentes = new Set(serie.map((x) => x.fecha));
  const extra = fechas.filter((f) => !existentes.has(f)).map((fecha) => ({ fecha }));
  return [...serie, ...extra].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}
