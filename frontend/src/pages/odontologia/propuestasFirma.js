import { TODAS_LAS_PIEZAS, CONDITIONS } from "./constantes_odontologia.js";

/**
 * Propuestas que se muestran al dentista ANTES de firmar una sesión.
 * Nada se aplica solo: cada propuesta llega a pantalla con su casilla y el dentista decide.
 * Reglas conservadoras: si no hay datos suficientes (pieza o superficie), no se propone.
 */

const norm = (t) =>
  String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// JSON con llaves ordenadas: sirve para saber si algo cambió sin falsos positivos por el orden
export const estable = (o) =>
  JSON.stringify(o, (k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.keys(v).sort().reduce((a, key) => { a[key] = v[key]; return a; }, {})
      : v);

const VALIDAS = new Set(TODAS_LAS_PIEZAS.map(String));

// "16", "16, 17" o "16-17" -> ["16","17"] (solo piezas FDI válidas: permanentes y temporales)
export function parsePiezas(texto) {
  const halladas = String(texto ?? "").match(/\b\d{2}\b/g) || [];
  return [...new Set(halladas.filter((n) => VALIDAS.has(n)))];
}

const SUPERFICIE_ABREV = { v: "V", p: "P/L", m: "M", d: "D", o: "O/I" };

// "MOD" -> m,o,d · "Oclusal" -> o · "V" -> v
export function parseSuperficies(texto) {
  const t = norm(texto);
  const out = new Set();
  if (/vestibular|labial|bucal/.test(t)) out.add("v");
  if (/palatin|lingual/.test(t)) out.add("p");
  if (/mesial/.test(t)) out.add("m");
  if (/distal/.test(t)) out.add("d");
  if (/oclusal|incisal/.test(t)) out.add("o");
  const letras = String(texto ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (letras && letras.length <= 5 && /^[VBLPMDOI]+$/.test(letras)) {
    for (const ch of letras) {
      if (ch === "V" || ch === "B") out.add("v");
      else if (ch === "L" || ch === "P") out.add("p");
      else if (ch === "M") out.add("m");
      else if (ch === "D") out.add("d");
      else out.add("o"); // O / I
    }
  }
  return [...out];
}

// Qué le pasa al odontograma según el procedimiento realizado
function reglaDe(procedimiento) {
  const t = norm(procedimiento);
  if (/extraccion/.test(t)) return { tipo: "ausente" };
  if (/implante oseointegrado/.test(t)) return { tipo: "condicion", condicion: "implante", sup: "todas" };
  if (/obturacion|incrustacion/.test(t)) return { tipo: "condicion", condicion: "obturacion", sup: "usuario" };
  if (/sellante/.test(t)) return { tipo: "condicion", condicion: "sellante", sup: "usuario_o_oclusal" };
  if (/corona/.test(t) && !/implante/.test(t)) return { tipo: "condicion", condicion: "corona", sup: "todas" };
  if (/conductos|retratamiento endodontico|pulpectomia/.test(t)) return { tipo: "condicion", condicion: "endodoncia", sup: "todas" };
  return null;
}

const describir = (diente, superficies) =>
  superficies.map((s) => `${CONDITIONS[diente?.[s] || "sano"]?.label || diente?.[s]} (${SUPERFICIE_ABREV[s]})`).join(", ");

/**
 * @param {{procedimientos:Array, fases:Array, odontograma:Object}} datos
 * @returns {{planMatches:Array, odoProps:Array}}
 */
export function proponerCambios({ procedimientos = [], fases = [], odontograma = {} }) {
  const planMatches = [];
  const usados = new Set();

  // 1) Ítems del plan que coinciden con lo realizado hoy (mismo procedimiento y misma pieza)
  for (const p of procedimientos) {
    const piezasP = parsePiezas(p.diente);
    let encontrado = false;
    for (const f of fases) {
      for (const it of f.items || []) {
        if (encontrado) break;
        if (it.completado || usados.has(it.id)) continue;
        if (norm(it.procedimiento) !== norm(p.procedimiento)) continue;
        const piezasI = parsePiezas(it.pieza);
        const coincide = (piezasP.length === 0 && piezasI.length === 0) || piezasP.some((x) => piezasI.includes(x));
        if (!coincide) continue;
        usados.add(it.id);
        encontrado = true;
        planMatches.push({
          key: `plan-${p.id}-${it.id}`, faseId: f.id, itemId: it.id, faseNombre: f.nombre || "",
          pieza: it.pieza || "", procedimiento: it.procedimiento, costo: it.costo_estimado, marcado: true,
        });
      }
    }
  }

  // 2) Cambios sugeridos al odontograma
  const odoProps = [];
  for (const p of procedimientos) {
    const regla = reglaDe(p.procedimiento);
    if (!regla) continue;
    let piezas = parsePiezas(p.diente);
    if (regla.tipo === "ausente" && !piezas.length && /tercer molar/.test(norm(p.procedimiento))) piezas = ["18", "28", "38", "48"];

    for (const pieza of piezas) {
      const actual = odontograma[pieza] || {};
      if (regla.tipo === "ausente") {
        if (actual.ausente) continue;
        odoProps.push({
          key: `odo-${p.id}-${pieza}-ausente`, pieza, tipo: "ausente", condicion: null, superficies: [],
          procedimiento: p.procedimiento, antes: "Presente", despues: "Ausente (extraída)", marcado: true,
        });
        continue;
      }
      let sup = regla.sup === "todas" ? ["v", "p", "m", "d", "o"] : parseSuperficies(p.superficie);
      if (regla.sup === "usuario_o_oclusal" && !sup.length) sup = ["o"];
      if (!sup.length) continue; // sin superficie no se adivina
      const cambian = sup.filter((s) => actual[s] !== regla.condicion);
      if (!cambian.length) continue;
      odoProps.push({
        key: `odo-${p.id}-${pieza}-${regla.condicion}`, pieza, tipo: "condicion", condicion: regla.condicion,
        superficies: cambian, procedimiento: p.procedimiento,
        antes: describir(actual, cambian),
        despues: `${CONDITIONS[regla.condicion].label} (${cambian.map((s) => SUPERFICIE_ABREV[s]).join(", ")})`,
        marcado: true,
      });
    }
  }
  return { planMatches, odoProps };
}
