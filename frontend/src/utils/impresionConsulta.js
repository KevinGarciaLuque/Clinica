// Secciones de Estética y Dermatología para el historial y la hoja impresa de la consulta.
import { nombreZona, FASES_CONTROL } from "./esteticaCatalogos";

/** Campos de la pestaña Dermatología (DermaTab), en orden */
export const DERMA_CAMPOS = [
  ["tiempo_evolucion", "Tiempo de evolución"],
  ["localizacion_anatomica", "Localización anatómica"],
  ["tratamientos_previos", "Tratamientos previos"],
  ["antecedentes_derma_personales", "Antecedentes dermatológicos"],
  ["antecedentes_fam_cancer_piel", "Antecedente familiar de cáncer de piel"],
  ["antecedentes_fam_cancer_detalle", "Detalle (cáncer de piel familiar)"],
  ["fototipo_fitzpatrick", "Fototipo de Fitzpatrick"],
  ["exposicion_solar", "Exposición solar"],
  ["usa_protector_solar", "Usa protector solar"],
  ["protector_solar_detalle", "Protector solar (detalle)"],
  ["ocupacion", "Ocupación"],
  ["diagnosticos_diferenciales", "Diagnósticos diferenciales"],
  ["indicaciones_medicas", "Indicaciones médicas"],
  ["proxima_cita", "Próxima cita sugerida"],
];

const hay = (v) => v !== null && v !== undefined && v !== false && String(v).trim() !== "";
export const valorDerma = (v) => (v === true ? "Sí" : Array.isArray(v) ? v.join(", ") : String(v));
export const leerJson = (v) => { if (!v) return {}; try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return {}; } };
export const tieneDerma = (d) => DERMA_CAMPOS.some(([k]) => hay(leerJson(d)[k]));

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fecha = (v) => { const t = String(v || "").slice(0, 10); if (!t) return ""; const [y, m, d] = t.split("-"); return `${d}/${m}/${y}`; };
const fila = (k, v) => (hay(v) ? `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>` : "");
const tabla = (filas) => (filas.trim() ? `<table class="tabla-datos">${filas}</table>` : "");
const ESTILO = `<style>.tabla-datos{width:100%;border-collapse:collapse;margin:4px 0 8px}.tabla-datos td{border-bottom:1px solid #eef0f6;padding:4px 6px;font-size:12.5px;vertical-align:top}.tabla-datos td.k{color:#555;width:38%}.sub{font-weight:700;font-size:11px;color:#9d174d;margin-top:6px;text-transform:uppercase}</style>`;

/** Hoja impresa: sección de Dermatología */
export function htmlDerma(datos) {
  const d = leerJson(datos);
  const filas = DERMA_CAMPOS.map(([k, l]) => (hay(d[k]) ? fila(l, valorDerma(d[k])) : "")).join("");
  return filas ? `${ESTILO}<div class="section"><div class="section-title">Dermatología</div>${tabla(filas)}</div>` : "";
}

const VISITA = { valoracion: "Valoración", procedimiento: "Día del procedimiento", seguimiento: "Control post-procedimiento" };

/** Hoja impresa: sección de Estética ({ tipo, datos } de /historias/:id) */
export function htmlEstetica(e) {
  if (!e?.tipo) return "";
  const d = e.datos || {};
  const lista = (v) => (Array.isArray(v) && v.length ? v.join(", ") : "");
  let cuerpo = "";
  if (e.tipo === "procedimiento") {
    const zonas = Object.entries(d.zonas || {});
    const total = zonas.reduce((t, [, c]) => t + (parseFloat(c) || 0), 0);
    const prods = (d.productos || []).filter((p) => p && (p.producto || p.lote));
    cuerpo = tabla(fila("Procedimiento", d.nombre) + fila("Anestesia", d.anestesia) + fila("Técnica", d.tecnica)
      + fila("Tolerancia", d.tolerancia) + fila("Complicaciones", d.complicaciones)
      + (d.paquete?.nombre ? fila("Paquete", `${d.paquete.nombre} (${d.paquete.sesiones} sesiones)`) : ""));
    if (prods.length) cuerpo += `<div class="sub">Producto y lote</div>` + tabla(prods.map((p) => fila(p.producto || "Producto",
      [p.lote && `Lote ${p.lote}`, p.vence && `vence ${p.vence}`, p.cantidad && `${p.cantidad} ${d.unidad || ""}`].filter(Boolean).join(" · "))).join(""));
    if (zonas.length || (d.zonas_cuerpo || []).length) cuerpo += `<div class="sub">Zonas tratadas${total ? ` · total ${total} ${esc(d.unidad || "")}` : ""}</div>`
      + tabla(zonas.map(([z, c]) => fila(nombreZona(z), c ? `${c} ${d.unidad || ""}` : "✓")).join("") + fila("Cuerpo", lista(d.zonas_cuerpo)));
    if (hay(d.indicaciones)) cuerpo += `<div class="sub">Indicaciones para la casa</div><pre>${esc(d.indicaciones)}</pre>`;
    if ((d.controles_agendados || []).length) cuerpo += `<div class="sub">Controles agendados</div>` + tabla(d.controles_agendados.map((c) => fila(c.label, `${fecha(c.fecha)}${c.hora ? ` ${c.hora}` : ""}`)).join(""));
    if (d.mantenimiento_fecha) cuerpo += tabla(fila("Mantenimiento sugerido", fecha(d.mantenimiento_fecha)));
  } else if (e.tipo === "valoracion") {
    cuerpo = tabla(fila("Motivo", d.motivo) + fila("Expectativas", d.expectativas)
      + fila("Zonas", lista([...(d.zonas || []).map(nombreZona), ...(d.zonas_cuerpo || [])]))
      + fila("Contraindicaciones", lista(d.contraindicaciones) || "Ninguna") + fila("Recomendado", lista(d.sugeridos))
      + fila("Plan", d.plan) + fila("Observaciones", d.observaciones));
  } else if (e.tipo === "seguimiento") {
    cuerpo = tabla(fila("Procedimiento", d.procedimiento) + fila("Momento", FASES_CONTROL.find((f) => f.key === d.fase)?.label || d.fase)
      + fila("Dolor", hay(d.dolor_eva) ? `${d.dolor_eva}/10` : "") + fila("Edema", d.edema) + fila("Cicatriz / piel", d.cicatriz)
      + fila("Resultado", d.resultado) + fila("Próximo control", fecha(d.proxima_cita)) + fila("Necesita retoque", d.necesita_retoq ? "Sí" : ""));
    if (hay(d.indicaciones)) cuerpo += `<div class="sub">Indicaciones</div><pre>${esc(d.indicaciones)}</pre>`;
  }
  return cuerpo ? `${ESTILO}<div class="section"><div class="section-title">Estética — ${VISITA[e.tipo] || e.tipo}</div>${cuerpo}</div>` : "";
}
