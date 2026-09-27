import { parsePiezas } from "./propuestasFirma.js";

const norm = (t) =>
  String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const dinero = (n) =>
  `L ${(Number(n) || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const subtotalFase = (fase, { soloPendientes = false } = {}) =>
  (fase.items || [])
    .filter((i) => !soloPendientes || !i.completado)
    .reduce((s, i) => s + (parseFloat(i.costo_estimado) || 0), 0);

export const totalPlan = (fases, opciones) => (fases || []).reduce((s, f) => s + subtotalFase(f, opciones), 0);

// Precio del catálogo de servicios de la clínica para un procedimiento (solo sugerencia, editable)
export function precioSugerido(procedimiento, servicios) {
  const n = norm(procedimiento);
  if (!n) return null;
  const activos = (servicios || []).filter((s) => s.activo === undefined || Number(s.activo) === 1 || s.activo === true);
  const hallado =
    activos.find((s) => norm(s.nombre) === n) ||
    activos.find((s) => {
      const sn = norm(s.nombre);
      return sn && (sn.includes(n) || n.includes(sn));
    });
  const precio = hallado ? Number(hallado.precio) : NaN;
  return Number.isFinite(precio) ? { precio, nombre: hallado.nombre } : null;
}

export function fechaVigencia(dias, desde = new Date()) {
  const d = new Date(desde);
  d.setDate(d.getDate() + (Number(dias) || 0));
  return d;
}

const comoLista = (v) => {
  if (Array.isArray(v)) return v;
  try { const x = JSON.parse(v || "[]"); return Array.isArray(x) ? x : []; } catch { return []; }
};

/**
 * Líneas propuestas para cobrar una sesión: una por procedimiento realizado.
 * Precio: costo del ítem del plan completado en esta sesión → precio del catálogo → vacío.
 * Solo se marcan por defecto las que tienen precio; el dentista revisa y edita todo.
 */
export function lineasCobro({ sesion, fases, servicios }) {
  const procs = comoLista(sesion?.procedimientos);
  const items = (fases || []).flatMap((f) => f.items || []).filter((i) => i.completado && i.sesion_id === sesion?.id);
  const usados = new Set();

  return procs.map((p, idx) => {
    const piezasP = parsePiezas(p.diente);
    const delPlan = items.find((it) => {
      if (usados.has(it.id) || norm(it.procedimiento) !== norm(p.procedimiento)) return false;
      const piezasI = parsePiezas(it.pieza);
      return (piezasP.length === 0 && piezasI.length === 0) || piezasP.some((x) => piezasI.includes(x));
    });
    if (delPlan) usados.add(delPlan.id);

    const sug = precioSugerido(p.procedimiento, servicios);
    const precio = delPlan && Number(delPlan.costo_estimado) > 0 ? Number(delPlan.costo_estimado) : sug ? sug.precio : "";
    const origen = delPlan && Number(delPlan.costo_estimado) > 0 ? "plan" : sug ? "catálogo" : "";
    const partes = [p.procedimiento];
    if (p.diente) partes.push(`pieza ${p.diente}`);
    if (p.superficie) partes.push(`(${p.superficie})`);
    return {
      key: p.id || idx,
      descripcion: partes.join(" · ").replace(" · (", " ("),
      precio: precio === "" ? "" : String(precio),
      origen,
      incluir: Number(precio) > 0,
    };
  });
}

/**
 * Próxima sesión sugerida: los primeros procedimientos pendientes de la fase más prioritaria
 * con trabajo por hacer. Es solo una sugerencia; el dentista decide.
 */
export function sugerirProximaSesion(fases) {
  for (const f of fases || []) {
    const pendientes = (f.items || []).filter((i) => !i.completado);
    if (!pendientes.length) continue;
    const lista = pendientes.slice(0, 3)
      .map((i) => `${i.procedimiento}${i.pieza ? ` (${String(i.pieza).trim()})` : ""}`).join(", ");
    const extra = pendientes.length > 3 ? ` y ${pendientes.length - 3} más` : "";
    return { texto: `${(f.nombre || "Plan").split(":")[0]}: ${lista}${extra}`, restantes: pendientes.length };
  }
  return null;
}
