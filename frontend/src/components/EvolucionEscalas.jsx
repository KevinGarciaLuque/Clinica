/**
 * Mapa de calor de las escalas de cuidados paliativos de un paciente.
 *
 *  - «Tablero»: una fila por escala aplicada y una columna por fecha, cada celda con el color de su resultado.
 *  - «Detalle»: al elegir una escala, cada ítem (fila) por cada fecha (columna), para ver qué síntoma mejora o empeora.
 *
 * Recibe los registros ya cargados (`registros`) o, si solo se pasa `pacienteId`, los pide al servidor.
 * `datos` (opcional) es lo que se está llenando en la consulta actual y aparece como la columna «Hoy».
 */
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/api";
import {
  ESCALAS, ESCALA_POR_ID, calcular, colorItem, colorResultado, resumenCorto, textoSobre, puntosItem, COLORES, colorCalor,
} from "../utils/paliativosEscalas";

const coma = (x) => String(x).replace(".", ",");
const fechaCorta = (f) => (f === "hoy" ? "Hoy" : f.split("-").reverse().slice(0, 2).join("/"));
const fechaLarga = (f) => (f === "hoy" ? "Hoy (sin guardar)" : f.split("-").reverse().join("/"));

function Celda({ color, children, titulo, hoy }) {
  return (
    <td title={titulo} style={{ padding: 3, textAlign: "center", minWidth: 52 }}>
      <div style={{
        background: color || "#f3f4f6", color: color ? textoSobre(color) : "#9ca3af", borderRadius: 7, height: 34, minWidth: 44,
        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.82rem",
        outline: hoy ? "2px dashed #7E57C2" : "none", outlineOffset: 1,
      }}>{children ?? ""}</div>
    </td>
  );
}

export default function EvolucionEscalas({ registros, pacienteId, datos, historiaId }) {
  const [cargados, setCargados] = useState(null);
  const [elegida, setElegida] = useState(null);
  const tabla = useRef(null);

  useEffect(() => {
    if (registros || !pacienteId) return undefined;
    let vivo = true;
    api.get(`/paliativos/paciente/${pacienteId}/evolucion`).then((r) => { if (vivo) setCargados(r.data.data || []); }).catch(() => { if (vivo) setCargados([]); });
    return () => { vivo = false; };
  }, [registros, pacienteId]);

  const base = registros || cargados;

  // Registros por escala: lo guardado + lo que se está llenando hoy (reemplaza lo guardado de esta misma consulta)
  const porEscala = useMemo(() => {
    const m = {};
    const hayBorrador = (id) => datos && datos[id] && !calcular(ESCALA_POR_ID[id], datos[id].respuestas).vacio;
    for (const r of base || []) {
      if (!ESCALA_POR_ID[r.escala]) continue;
      if (datos && historiaId && r.historia_id === historiaId) continue; // lo de esta consulta lo muestra el borrador
      (m[r.escala] ||= []).push(r);
    }
    for (const e of ESCALAS) {
      if (!hayBorrador(e.id)) continue;
      const c = calcular(e, datos[e.id].respuestas);
      (m[e.id] ||= []).push({ escala: e.id, fecha: "hoy", respuestas: datos[e.id].respuestas, puntaje: c.puntaje, nivel_texto: resumenCorto(e, c), nivel_color: colorResultado(c), hoy: true });
    }
    return m;
  }, [base, datos, historiaId]);

  const ids = ESCALAS.filter((e) => e.tipo !== "guia" && porEscala[e.id]?.length).map((e) => e.id);
  const fechas = useMemo(() => {
    const s = new Set();
    ids.forEach((id) => porEscala[id].forEach((r) => s.add(r.fecha)));
    return [...s].sort((a, b) => (a === "hoy" ? 1 : b === "hoy" ? -1 : a.localeCompare(b)));
  }, [ids, porEscala]);

  if (base === null) return <div className="text-muted py-3">Cargando…</div>;
  if (!ids.length) {
    return (
      <div style={{ textAlign: "center", color: "#9ca3af", padding: 28 }}>
        <i className="bi bi-grid-3x3-gap" style={{ fontSize: "2rem" }} /><br />Todavía no hay escalas aplicadas a este paciente. Cuando guarde una consulta con escalas, aquí verá cómo evoluciona.
      </div>
    );
  }

  const imprimir = () => {
    const w = window.open("", "_blank");
    if (!w || !tabla.current) return;
    w.document.write(`<html><head><title>Evolución de escalas</title><style>
      body{font-family:Arial,sans-serif;padding:16px;color:#111} table{border-collapse:collapse} td,th{padding:3px;font-size:11px}
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>
      <h3>Evolución de escalas de cuidados paliativos</h3>${tabla.current.outerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  const esc = elegida ? ESCALA_POR_ID[elegida] : null;
  const registrosEsc = esc ? porEscala[esc.id] || [] : [];
  const cabecera = (lista) => (
    <tr>
      <th style={{ position: "sticky", left: 0, background: "#fff", minWidth: 150, textAlign: "left", fontSize: "0.78rem", padding: "4px 8px", zIndex: 2 }} />
      {lista.map((f) => <th key={f} style={{ fontSize: "0.72rem", textAlign: "center", color: f === "hoy" ? "#7E57C2" : "#4b5563", whiteSpace: "nowrap" }}>{fechaCorta(f)}</th>)}
    </tr>
  );
  const etiquetaFila = (t, sub) => (
    <td style={{ position: "sticky", left: 0, background: "#fff", padding: "3px 8px", fontSize: "0.8rem", fontWeight: 600, color: "#1f2937", maxWidth: 190, zIndex: 1 }}>
      {t}{sub ? <div style={{ fontSize: "0.68rem", fontWeight: 400, color: "#6b7280" }}>{sub}</div> : null}
    </td>
  );

  // Detalle de una escala: filas = ítems (o subescalas / el total), columnas = fechas
  let detalle = null;
  if (esc) {
    const cols = [...new Set(registrosEsc.map((r) => r.fecha))].sort((a, b) => (a === "hoy" ? 1 : b === "hoy" ? -1 : a.localeCompare(b)));
    const deFecha = (f) => registrosEsc.filter((r) => r.fecha === f).slice(-1)[0];
    const filas = [];
    if (esc.tipo === "nivel") {
      filas.push({ t: "Resultado", celda: (r) => ({ c: colorResultado(calcular(esc, r.respuestas)), v: coma(r.puntaje ?? ""), tt: resumenCorto(esc, calcular(esc, r.respuestas)) }) });
    } else if (esc.tipo === "items") {
      let g = null;
      for (const it of esc.items.filter((i) => !i.soloTxt)) {
        if (it.g && it.g !== g) { g = it.g; filas.push({ titulo: g }); }
        filas.push({
          t: it.t, sub: it.h && it.h.length < 40 ? it.h : null,
          celda: (r) => { const p = puntosItem(it, r.respuestas?.[it.id]); const val = it.op ? it.op[r.respuestas?.[it.id]]?.[1] : null;
            return { c: colorItem(esc, it, r.respuestas?.[it.id]), v: p === null ? "" : coma(it.sino !== undefined ? (r.respuestas[it.id] === 1 ? "Sí" : "No") : p), tt: val || it.t }; },
        });
      }
      for (const s of esc.subs || []) {
        filas.push({ t: s.t, fuerte: true, celda: (r) => { const c = calcular(esc, r.respuestas).subs.find((x) => x.id === s.id); return { c: c?.banda?.c, v: c?.puntaje === null || !c ? "" : coma(c.puntaje), tt: c?.banda?.t || "" }; } });
      }
      if (esc.total || esc.calc) {
        filas.push({ t: esc.total?.t || "Resultado", fuerte: true, celda: (r) => { const c = calcular(esc, r.respuestas); return { c: colorResultado(c), v: c.puntaje === null ? "" : coma(c.puntaje), tt: resumenCorto(esc, c) }; } });
      }
    }
    detalle = (
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setElegida(null)}><i className="bi bi-arrow-left me-1" />Tablero</button>
          <b style={{ color: "#1a2744" }}>{esc.nombre}</b><span style={{ color: "#6b7280", fontSize: "0.8rem" }}>{esc.sub}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table ref={tabla} style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>{cabecera(cols)}</thead>
            <tbody>
              {filas.map((f, i) => f.titulo ? (
                <tr key={i}><td colSpan={cols.length + 1} style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "#7E57C2", padding: "8px 8px 2px" }}>{f.titulo}</td></tr>
              ) : (
                <tr key={i}>
                  {etiquetaFila(f.t, f.sub)}
                  {cols.map((fe) => { const r = deFecha(fe); const x = r ? f.celda(r) : {}; return <Celda key={fe} color={x.c} titulo={x.tt} hoy={fe === "hoy"}>{x.v}</Celda>; })}
                </tr>
              ))}
              <tr>
                {etiquetaFila("Interpretación")}
                {cols.map((fe) => { const r = deFecha(fe); return <td key={fe} style={{ fontSize: "0.66rem", textAlign: "center", color: "#4b5563", padding: 3, maxWidth: 80 }}>{r?.nivel_texto || ""}</td>; })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <h6 style={{ margin: 0, fontWeight: 800, color: "#1a2744" }}><i className="bi bi-grid-3x3-gap-fill me-2" style={{ color: "#7E57C2" }} />Evolución de las escalas</h6>
          <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>Cada color es el resultado de esa escala en esa fecha. Toque una escala para ver cada ítem.</div>
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={imprimir}><i className="bi bi-printer me-1" />Imprimir</button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: "0.7rem", color: "#4b5563", marginBottom: 8, alignItems: "center" }}>
        {[["Mejor", colorCalor(0)], ["", colorCalor(0.25)], ["", colorCalor(0.5)], ["", colorCalor(0.75)], ["Peor", colorCalor(1)]].map(([t, c], i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 12, borderRadius: 3, background: c }} />{t}</span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 12, borderRadius: 3, background: COLORES.azul }} />Sedación</span>
      </div>
      {esc ? detalle : (
        <div style={{ overflowX: "auto" }}>
          <table ref={tabla} style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>{cabecera(fechas)}</thead>
            <tbody>
              {ids.map((id) => {
                const e = ESCALA_POR_ID[id];
                return (
                  <tr key={id} style={{ cursor: "pointer" }} onClick={() => setElegida(id)}>
                    {etiquetaFila(e.nombre, e.sub.length > 34 ? `${e.sub.slice(0, 32)}…` : e.sub)}
                    {fechas.map((f) => { const r = porEscala[id].filter((x) => x.fecha === f).slice(-1)[0];
                      return <Celda key={f} color={r?.nivel_color} titulo={r ? `${fechaLarga(f)} · ${r.nivel_texto || ""}` : ""} hoy={f === "hoy"}>{r ? (r.puntaje !== null && r.puntaje !== undefined ? coma(r.puntaje) : "●") : ""}</Celda>; })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Versión para el perfil del paciente: pide sus datos al servidor */
export function EvolucionEscalasPaciente({ pacienteId }) {
  return <EvolucionEscalas pacienteId={pacienteId} />;
}
