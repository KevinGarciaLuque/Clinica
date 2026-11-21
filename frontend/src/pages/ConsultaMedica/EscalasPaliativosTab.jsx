/**
 * Pestaña «Escalas» de la consulta (clínicas de cuidados paliativos).
 *
 * Pensada para que la doctora llene todo con toques: cada respuesta es un botón con el color del
 * mapa de calor, el puntaje y la interpretación se calculan solos y se ven en una barra fija.
 * Las escalas están definidas en utils/paliativosEscalas.js.
 */
import { useMemo, useState } from "react";
import EvolucionEscalas from "../../components/EvolucionEscalas";
import {
  ESCALAS, ESCALA_POR_ID, GRUPOS, calcular, resumenCorto, colorResultado, colorItem, textoSobre,
} from "../../utils/paliativosEscalas";

const RAPIDAS = ESCALAS.filter((e) => e.rapida).map((e) => e.id);
const fechaCorta = (f) => (f ? f.split("-").reverse().slice(0, 2).join("/") : "");
const coma = (x) => String(x).replace(".", ",");

function Insignia({ color, children, grande, style }) {
  return (
    <span style={{
      background: color || "#e5e7eb", color: color ? textoSobre(color) : "#374151", borderRadius: 999,
      padding: grande ? "6px 14px" : "2px 9px", fontSize: grande ? "1.05rem" : "0.72rem", fontWeight: 700, whiteSpace: "nowrap", ...style,
    }}>{children}</span>
  );
}

// ── Una pregunta (ítem) de una escala ──────────────────────────────────────────
function FilaItem({ esc, it, valor, onChange, txt, onTxt, bloqueada }) {
  const lab = it.lab || esc.lab;
  const etiqueta = it.r && valor !== undefined && lab ? lab[valor - 0] : null;
  const caja = { borderWidth: "1.5px", borderStyle: "solid", borderRadius: 8, cursor: bloqueada ? "default" : "pointer", fontWeight: 700, transition: "all .12s" };

  let control = null;
  if (it.r) {
    const valores = Array.from({ length: it.r[1] - it.r[0] + 1 }, (_, i) => it.r[0] + i);
    control = (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {valores.map((v) => {
          const col = colorItem(esc, it, v), sel = valor === v;
          return (
            <button key={v} type="button" disabled={bloqueada} onClick={() => onChange(sel ? undefined : v)} title={lab?.[v] || ""}
              style={{ ...caja, minWidth: 38, height: 38, borderColor: col, background: sel ? col : `${col}2e`, color: sel ? textoSobre(col) : "#374151", boxShadow: sel ? `0 0 0 2px #fff, 0 0 0 4px ${col}` : "none" }}>
              {v}
            </button>
          );
        })}
      </div>
    );
  } else if (it.op) {
    control = (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {it.op.map((o, idx) => {
          const col = colorItem(esc, it, idx), sel = valor === idx;
          return (
            <button key={idx} type="button" disabled={bloqueada} onClick={() => onChange(sel ? undefined : idx)}
              style={{ ...caja, display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "7px 10px", borderColor: col, background: sel ? col : `${col}26`, color: sel ? textoSobre(col) : "#1f2937", fontWeight: sel ? 700 : 500 }}>
              <span style={{ minWidth: 26, fontWeight: 800 }}>{coma(o[0])}</span><span style={{ fontSize: "0.85rem" }}>{o[1]}</span>
            </button>
          );
        })}
      </div>
    );
  } else if (it.sino !== undefined) {
    const sl = it.sl || ["Sí", "No"];
    control = (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[[1, sl[0]], [0, sl[1]]].map(([v, t]) => {
          const col = colorItem(esc, it, v), sel = valor === v;
          return (
            <button key={v} type="button" disabled={bloqueada} onClick={() => onChange(sel ? undefined : v)}
              style={{ ...caja, padding: "7px 14px", borderColor: col, background: sel ? col : `${col}26`, color: sel ? textoSobre(col) : "#1f2937" }}>{t}</button>
          );
        })}
      </div>
    );
  } else if (it.num || it.desliz) {
    const [a, b] = it.num || it.desliz;
    const fuera = valor !== undefined && (valor < a || valor > b);
    const col = valor !== undefined && !fuera ? colorItem(esc, it, valor) : null;
    control = (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {it.desliz && (
          <input type="range" min={a} max={b} step={1} value={valor ?? a} disabled={bloqueada} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: "1 1 160px", accentColor: col || "#9ca3af" }} />
        )}
        <input type="number" inputMode="decimal" min={a} max={b} step="any" value={valor ?? ""} disabled={bloqueada}
          onChange={(e) => { const t = e.target.value; onChange(t === "" ? undefined : Number(t)); }}
          className="form-control form-control-sm" style={{ width: 96, borderColor: fuera ? "#E53935" : col || undefined, fontWeight: 700 }} />
        <span style={{ fontSize: "0.78rem", color: fuera ? "#E53935" : "#6b7280" }}>{fuera ? `Debe estar entre ${a} y ${b}` : `${a} a ${b}${it.unidad ? ` ${it.unidad}` : ""}`}</span>
        {col && <span style={{ width: 22, height: 22, borderRadius: 6, background: col }} />}
      </div>
    );
  }

  return (
    <div data-escala-item="1" style={{ padding: "10px 0", borderBottom: "1px solid #eef0f3" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1f2937" }}>{it.t}</div>
          {it.h && <div style={{ fontSize: "0.76rem", color: "#6b7280" }}>{it.h}</div>}
        </div>
        {etiqueta ? <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#4b5563" }}>{etiqueta}</span> : null}
      </div>
      {it.soloTxt ? (
        <textarea className="form-control form-control-sm" rows={2} value={valor || ""} disabled={bloqueada} onChange={(e) => onChange(e.target.value || undefined)} placeholder="Escriba aquí…" />
      ) : (
        <>
          {control}
          {it.txt && (
            <input className="form-control form-control-sm mt-2" placeholder="¿Cuál?" value={txt || ""} disabled={bloqueada} onChange={(e) => onTxt(e.target.value)} style={{ maxWidth: 320 }} />
          )}
        </>
      )}
      {it.alerta && valor > 0 && <div className="alert alert-warning py-1 px-2 mt-2 mb-0" style={{ fontSize: "0.8rem" }}><i className="bi bi-exclamation-triangle-fill me-1" />{it.alerta}</div>}
    </div>
  );
}

// ── Escala de un solo nivel (PPS, ECOG, Ramsay…) ───────────────────────────────
function Niveles({ esc, valor, onChange, bloqueada }) {
  const porcentaje = ["pps", "karnofsky", "lansky"].includes(esc.id);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {esc.niveles.map((n) => {
        const col = calcular(esc, { nivel: n[0] }).banda.c;
        const sel = String(valor) === String(n[0]);
        return (
          <button key={String(n[0])} type="button" disabled={bloqueada} onClick={() => onChange(sel ? undefined : n[0])}
            style={{ display: "flex", alignItems: "stretch", gap: 0, textAlign: "left", padding: 0, borderRadius: 10, overflow: "hidden", cursor: bloqueada ? "default" : "pointer", background: sel ? `${col}26` : "#f8fafc", border: sel ? `2px solid ${col}` : "2px solid #eef0f3" }}>
            <span style={{ background: col, color: textoSobre(col), minWidth: 58, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1rem", padding: "8px 4px" }}>
              {coma(n[0])}{porcentaje ? "%" : ""}
            </span>
            <span style={{ padding: "8px 12px", fontSize: "0.85rem", color: "#1f2937", flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{n[1]}</span>
              {n[2] ? <span style={{ display: "block", fontSize: "0.76rem", color: "#6b7280" }}>{n[2]}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Pantalla de una escala ─────────────────────────────────────────────────────
function PantallaEscala({ esc, datos, setDatos, bloqueada, previo, siguiente, onVolver, onSiguiente }) {
  const d = datos[esc.id] || { respuestas: {}, notas: "" };
  const resp = d.respuestas || {};
  const calc = calcular(esc, resp);

  const guardar = (nuevo) => setDatos((prev) => ({ ...prev, [esc.id]: { respuestas: {}, notas: "", ...(prev[esc.id] || {}), ...nuevo } }));
  const setResp = (clave, valor) => {
    const r = { ...resp };
    if (valor === undefined || valor === "") delete r[clave]; else r[clave] = valor;
    guardar({ respuestas: r });
  };
  const limpiar = () => setDatos((prev) => { const n = { ...prev }; delete n[esc.id]; return n; });
  const copiarAnterior = () => guardar({ respuestas: { ...(previo?.respuestas || {}) } });

  const items = esc.items || [];
  const color = colorResultado(calc);
  return (
    <div>
      <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={onVolver}><i className="bi bi-arrow-left me-1" />Todas las escalas</button>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h5 style={{ margin: 0, fontWeight: 800, color: "#1a2744" }}>{esc.nombre}{esc.pediatrica && <Insignia color="#7E57C2" style={{ marginLeft: 8, verticalAlign: "middle" }}>Pediátrica</Insignia>}</h5>
          <div style={{ fontSize: "0.82rem", color: "#6b7280" }}>{esc.sub}</div>
        </div>
        {previo && !bloqueada && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={copiarAnterior}><i className="bi bi-files me-1" />Copiar respuestas del {fechaCorta(previo.fecha)}</button>
        )}
      </div>
      <p style={{ fontSize: "0.85rem", color: "#4b5563", margin: "8px 0 4px" }}>{esc.desc}</p>
      {previo && (
        <div style={{ fontSize: "0.8rem", marginBottom: 6 }}>
          Anterior ({fechaCorta(previo.fecha)}): <Insignia color={previo.nivel_color}>{previo.nivel_texto || "sin resultado"}</Insignia>
        </div>
      )}

      <div style={{ marginTop: 6 }}>
        {esc.tipo === "nivel" ? (
          <Niveles esc={esc} valor={resp.nivel} onChange={(v) => setResp("nivel", v)} bloqueada={bloqueada} />
        ) : esc.tipo === "guia" ? (
          items.map((it) => <FilaItem key={it.id} esc={esc} it={{ ...it, soloTxt: true }} valor={resp[it.id]} onChange={(v) => setResp(it.id, v)} bloqueada={bloqueada} />)
        ) : (
          items.map((it, i) => (
            <div key={it.id}>
              {it.g && it.g !== items[i - 1]?.g && <div style={{ marginTop: 14, fontSize: "0.74rem", fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: "#7E57C2" }}>{it.g}</div>}
              <FilaItem esc={esc} it={it} valor={resp[it.id]} onChange={(v) => setResp(it.id, v)} txt={resp[`${it.id}_txt`]} onTxt={(v) => setResp(`${it.id}_txt`, v)} bloqueada={bloqueada} />
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6b7280" }}>Observaciones de esta escala (opcional)</label>
        <textarea className="form-control form-control-sm" rows={2} value={d.notas || ""} disabled={bloqueada} onChange={(e) => guardar({ notas: e.target.value })} />
      </div>
      <p style={{ fontSize: "0.78rem", color: "#6b7280", margin: "12px 0 4px" }}><i className="bi bi-info-circle me-1" /><b>Interpretación:</b> {esc.nota} <span style={{ opacity: 0.8 }}>({esc.ref}). Los puntos de corte pueden variar según la población y la versión validada; no sustituye el juicio clínico.</span></p>

      {/* Barra fija con el resultado */}
      <div data-escala-barra="1" style={{ position: "sticky", bottom: 0, marginTop: 12, background: "#fff", borderTop: `4px solid ${color || "#e5e7eb"}`, boxShadow: "0 -6px 16px rgba(0,0,0,.07)", borderRadius: "10px 10px 0 0", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", zIndex: 5 }}>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          {calc.vacio ? <span style={{ color: "#9ca3af", fontSize: "0.86rem" }}>Responda para ver el resultado</span> : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {calc.puntaje !== null && <Insignia grande color={color}>{coma(calc.puntaje)}{calc.max && esc.tipo !== "nivel" ? <span style={{ fontWeight: 500, opacity: 0.85 }}> / {coma(calc.max)}</span> : null}</Insignia>}
              {calc.banda?.t && <span style={{ fontWeight: 700, color: "#1f2937", fontSize: "0.95rem" }}>{calc.banda.t}</span>}
              {calc.subs.filter((s) => s.puntaje !== null).map((s) => (
                <span key={s.id} style={{ fontSize: "0.8rem" }}>{s.t}: <Insignia color={s.banda?.c}>{coma(s.puntaje)}{s.banda?.t ? ` · ${s.banda.t}` : ""}</Insignia></span>
              ))}
              {calc.puntaje === null && !calc.banda && !calc.subs.length && <span style={{ fontSize: "0.86rem", color: "#4b5563" }}>{calc.respondidos} de {calc.total} respondidos</span>}
            </div>
          )}
          {!calc.vacio && esc.tipo === "items" && !calc.completo && <div style={{ fontSize: "0.72rem", color: "#b45309" }}>Faltan ítems por responder: el resultado es parcial.</div>}
        </div>
        {!bloqueada && !calc.vacio && <button type="button" className="btn btn-sm btn-outline-danger" onClick={limpiar}>Limpiar</button>}
        <button type="button" className="btn btn-sm btn-primary" onClick={siguiente ? onSiguiente : onVolver} style={{ fontWeight: 700 }}>
          {siguiente ? <>Listo · siguiente: {ESCALA_POR_ID[siguiente].nombre} <i className="bi bi-arrow-right" /></> : <><i className="bi bi-check2 me-1" />Listo</>}
        </button>
      </div>
    </div>
  );
}

// ── Pestaña completa ───────────────────────────────────────────────────────────
export default function EscalasPaliativosTab({ datos, setDatos, firmada, historial, historiaId }) {
  const [vista, setVista] = useState("inicio"); // inicio | escala | evolucion
  const [grupo, setGrupo] = useState("rapida");
  const [abierta, setAbierta] = useState(null);
  const [cola, setCola] = useState([]);
  const [q, setQ] = useState("");

  // Última vez que se aplicó cada escala en otras consultas del paciente
  const previos = useMemo(() => {
    const m = {};
    for (const r of historial || []) if (!historiaId || r.historia_id !== historiaId) m[r.escala] = r;
    return m;
  }, [historial, historiaId]);

  const aplicadas = useMemo(
    () => ESCALAS.filter((e) => datos[e.id] && !calcular(e, datos[e.id].respuestas).vacio).map((e) => e.id),
    [datos],
  );

  const abrir = (id, lista = []) => { setAbierta(id); setCola(lista); setVista("escala"); window.scrollTo?.({ top: 0 }); };
  const idxCola = cola.indexOf(abierta);
  const siguiente = idxCola >= 0 && idxCola < cola.length - 1 ? cola[idxCola + 1] : null;

  if (vista === "escala" && abierta) {
    return (
      <PantallaEscala
        esc={ESCALA_POR_ID[abierta]} datos={datos} setDatos={setDatos} bloqueada={firmada} previo={previos[abierta]}
        siguiente={siguiente} onVolver={() => setVista("inicio")} onSiguiente={() => abrir(siguiente, cola)}
      />
    );
  }

  if (vista === "evolucion") {
    return (
      <div>
        <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={() => setVista("inicio")}><i className="bi bi-arrow-left me-1" />Volver a las escalas</button>
        <EvolucionEscalas registros={historial || []} datos={datos} historiaId={historiaId} />
      </div>
    );
  }

  const termino = q.trim().toLowerCase();
  const lista = ESCALAS.filter((e) => {
    if (termino) return `${e.nombre} ${e.sub} ${e.desc}`.toLowerCase().includes(termino);
    if (grupo === "rapida") return e.rapida;
    if (grupo === "hoy") return aplicadas.includes(e.id);
    return e.grupo === grupo;
  });
  const chip = (id, texto, icono, cuenta) => (
    <button key={id} type="button" onClick={() => { setGrupo(id); setQ(""); }}
      style={{ flexShrink: 0, border: "none", borderRadius: 999, padding: "6px 13px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", background: grupo === id && !termino ? "#7E57C2" : "#eef0f6", color: grupo === id && !termino ? "#fff" : "#374151" }}>
      <i className={`bi ${icono} me-1`} />{texto}{cuenta ? ` (${cuenta})` : ""}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <h5 style={{ margin: 0, fontWeight: 800, color: "#1a2744" }}><i className="bi bi-activity me-2" style={{ color: "#7E57C2" }} />Escalas de cuidados paliativos</h5>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Toque una escala y marque las respuestas: el puntaje y el color se calculan solos. Se guardan con la consulta.</div>
        </div>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setVista("evolucion")} style={{ fontWeight: 700 }}>
          <i className="bi bi-grid-3x3-gap-fill me-1" />Evolución (mapa de calor)
        </button>
      </div>

      <button type="button" disabled={firmada} onClick={() => abrir(RAPIDAS[0], RAPIDAS)}
        style={{ width: "100%", border: "none", borderRadius: 12, padding: "12px 14px", marginBottom: 12, cursor: firmada ? "default" : "pointer", background: "linear-gradient(135deg,#7E57C2,#5E35B1)", color: "#fff", textAlign: "left", display: "flex", alignItems: "center", gap: 12, opacity: firmada ? 0.6 : 1 }}>
        <i className="bi bi-lightning-charge-fill" style={{ fontSize: "1.6rem" }} />
        <span><b style={{ fontSize: "1rem" }}>Valoración rápida</b><br /><span style={{ fontSize: "0.8rem", opacity: 0.9 }}>{RAPIDAS.map((id) => ESCALA_POR_ID[id].nombre).join(" → ")}</span></span>
        <i className="bi bi-chevron-right ms-auto" />
      </button>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}>
        {chip("rapida", "Más usadas", "bi-star-fill")}
        {chip("hoy", "Aplicadas hoy", "bi-check2-circle", aplicadas.length)}
        {GRUPOS.map((g) => chip(g.id, g.nombre, g.icono))}
      </div>
      <input className="form-control form-control-sm mb-3" placeholder="Buscar escala (ESAS, Zarit, dolor, delirium…)" value={q} onChange={(e) => setQ(e.target.value)} />

      {lista.length === 0 ? (
        <div style={{ color: "#9ca3af", textAlign: "center", padding: 24, fontSize: "0.9rem" }}>{grupo === "hoy" && !termino ? "Todavía no ha aplicado escalas en esta consulta." : "No hay escalas que coincidan."}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
          {lista.map((e) => {
            const hoy = datos[e.id] ? calcular(e, datos[e.id].respuestas) : null;
            const aplicadaHoy = hoy && !hoy.vacio;
            const prev = previos[e.id];
            const col = aplicadaHoy ? colorResultado(hoy) : null;
            return (
              <button key={e.id} type="button" onClick={() => abrir(e.id)}
                style={{ textAlign: "left", borderTop: "1.5px solid #e5e7eb", borderRight: "1.5px solid #e5e7eb", borderBottom: "1.5px solid #e5e7eb", borderLeft: `6px solid ${col || "#d1d5db"}`, borderRadius: 12, background: "#fff", padding: "10px 12px", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <b style={{ color: "#1a2744", fontSize: "0.95rem" }}>{e.nombre}</b>
                  {e.pediatrica && <i className="bi bi-balloon-heart" style={{ color: "#7E57C2" }} title="Pediátrica" />}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.25, minHeight: 28 }}>{e.sub}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", fontSize: "0.72rem" }}>
                  {aplicadaHoy ? <><span style={{ color: "#4b5563", fontWeight: 700 }}>Hoy</span><Insignia color={col}>{resumenCorto(e, hoy) || "anotada"}</Insignia></>
                    : <span style={{ color: "#9ca3af" }}>Sin aplicar hoy</span>}
                  {prev && <span style={{ color: "#6b7280" }}>· Anterior {fechaCorta(prev.fecha)}: <Insignia color={prev.nivel_color}>{prev.nivel_texto || "—"}</Insignia></span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
