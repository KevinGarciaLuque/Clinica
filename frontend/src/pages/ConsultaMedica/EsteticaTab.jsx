import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MapaFacial from "../../components/MapaFacial";
import { listarEstetica, crearEstetica } from "../../utils/esteticaDatos";
import { imprimirHtml } from "../../utils/descargarPdf";
import {
  PLANTILLAS_CONSENTIMIENTO, FASES_CONTROL, EDEMA_OPC, CICATRIZ_OPC, RESULTADO_OPC,
  PROCEDIMIENTOS_COMUNES, UNIDADES, ANESTESIA_OPC, CONTRAINDICACIONES, ZONAS_CUERPO, nombreZona,
} from "../../utils/esteticaCatalogos";

/**
 * Pestaña «Estética» de la consulta. El médico elige el tipo de visita y ve solo
 * lo que corresponde: valoración, día del procedimiento o control. Se guarda junto
 * con la consulta (Consulta.jsx → PUT /estetica-datos/historia/:hid).
 *
 * datos = { tipo_visita, valoracion: {}, procedimiento: {}, seguimiento: {} }
 */

const ROSA = "#db2777";
const VISITAS = [
  { id: "valoracion",    icono: "bi-search-heart",  label: "Valoración",           ayuda: "Primera vez o evaluar un nuevo tratamiento" },
  { id: "procedimiento", icono: "bi-magic",         label: "Día del procedimiento", ayuda: "Lo que se aplicó: producto, lote, zonas" },
  { id: "seguimiento",   icono: "bi-heart-pulse",   label: "Control",              ayuda: "Revisión después del procedimiento" },
];

const inp = { width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.88rem", background: "#fff" };
const Lbl = ({ children }) => <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: 4 }}>{children}</label>;
const Seccion = ({ titulo, icono, children, color = ROSA, extra }) => (
  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: `3px solid ${color}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
    <div className="d-flex align-items-center gap-2 mb-3 flex-wrap" style={{ color, fontWeight: 800, fontSize: "0.78rem", letterSpacing: ".04em", textTransform: "uppercase" }}>
      <i className={`bi ${icono}`} />{titulo}{extra && <span className="ms-auto" style={{ textTransform: "none", letterSpacing: 0 }}>{extra}</span>}
    </div>
    {children}
  </div>
);
const Chip = ({ activo, onClick, children, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    style={{ border: `1px solid ${activo ? ROSA : "#d1d5db"}`, background: activo ? "#fdf2f8" : "#fff", color: activo ? ROSA : "#374151",
      borderRadius: 999, padding: "4px 11px", fontSize: "0.8rem", fontWeight: activo ? 700 : 500, cursor: disabled ? "default" : "pointer" }}>
    {activo && <i className="bi bi-check2 me-1" />}{children}
  </button>
);
const fechaCorta = (v) => (v ? new Date(String(v).length <= 10 ? `${v}T12:00:00` : v).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "—");
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const unidadDe = (nombre) => PROCEDIMIENTOS_COMUNES.find((p) => p.nombre === nombre)?.unidad;

export default function EsteticaTab({ datos, setDatos, firmada, paciente, pacienteId, historiaId }) {
  const [previos, setPrevios] = useState({ cargado: false, ficha: null, ultimoProc: null, firmados: [], consentimientos: [] });
  const [modal, setModal] = useState(null); // "presupuesto" | "consentimiento"
  const tipo = datos.tipo_visita || "";
  const val = datos.valoracion || {};
  const proc = datos.procedimiento || {};
  const seg = datos.seguimiento || {};

  const set = (seccion, campo, valor) => setDatos((d) => ({ ...d, [seccion]: { ...(d[seccion] || {}), [campo]: valor } }));
  const toggleLista = (seccion, campo, item) => setDatos((d) => {
    const lista = d[seccion]?.[campo] || [];
    return { ...d, [seccion]: { ...(d[seccion] || {}), [campo]: lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item] } };
  });

  // Lo que ya se sabe del paciente: ficha, último procedimiento y consentimientos
  useEffect(() => {
    if (!pacienteId) return undefined;
    let vivo = true;
    listarEstetica(undefined, pacienteId).then((l) => {
      if (!vivo) return;
      const otros = l.filter((r) => String(r.historia_id || "") !== String(historiaId || "-"));
      const consentimientos = l.filter((r) => r._tipo === "consentimiento");
      setPrevios({
        cargado: true,
        ficha: l.find((r) => r._tipo === "ficha") || null,
        ultimoProc: otros.find((r) => r._tipo === "procedimiento") || null,
        consentimientos,
        firmados: consentimientos.filter((c) => c.firmado),
      });
    }).catch(() => vivo && setPrevios((p) => ({ ...p, cargado: true })));
    return () => { vivo = false; };
  }, [pacienteId, historiaId, modal]);

  const elegirVisita = (id) => setDatos((d) => {
    const nuevo = { ...d, tipo_visita: id };
    // El control se llena con el último procedimiento
    if (id === "seguimiento" && !d.seguimiento?.procedimiento && previos.ultimoProc) {
      nuevo.seguimiento = { fase: "dia7", edema: "Leve", cicatriz: "Sin alteraciones", resultado: "Bueno", dolor_eva: "0", ...(d.seguimiento || {}), procedimiento: previos.ultimoProc.nombre || "" };
    }
    if (id === "seguimiento" && !nuevo.seguimiento) nuevo.seguimiento = { fase: "dia7", edema: "Leve", cicatriz: "Sin alteraciones", resultado: "Bueno", dolor_eva: "0" };
    if (id === "procedimiento" && !d.procedimiento) nuevo.procedimiento = { anestesia: "Tópica (crema)", productos: [{}], zonas: {}, tolerancia: "Buena" };
    return nuevo;
  });

  const repetirAnterior = () => {
    const u = previos.ultimoProc;
    if (!u) return;
    setDatos((d) => ({
      ...d,
      procedimiento: {
        ...(d.procedimiento || {}),
        nombre: u.nombre, unidad: u.unidad, tecnica: u.tecnica, anestesia: u.anestesia,
        zonas: { ...(u.zonas || {}) }, zonas_cuerpo: [...(u.zonas_cuerpo || [])],
        // El lote cambia en cada aplicación: se copia el producto, no el lote
        productos: (u.productos || []).map((p) => ({ producto: p.producto, cantidad: p.cantidad })),
      },
    }));
  };

  const firmadoPara = (nombre) => {
    const n = String(nombre || "").toLowerCase();
    if (!n) return true;
    const sin = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\bbotox\b/g, "toxina botulinica");
    return previos.firmados.some((c) => { const a = sin(c.procedimiento), b = sin(nombre); return a && (a.includes(b) || b.includes(a)); });
  };

  const imprimir = () => imprimirHtml(htmlRegistro({ proc, paciente }));
  const ficha = previos.ficha;
  const alertasFicha = ficha ? [
    ficha.alergias_anestesia && `Alergia a anestesia: ${ficha.alergias_anestesia}`,
    ficha.alergias_medicamentos && `Alergia a medicamentos: ${ficha.alergias_medicamentos}`,
    ficha.alergias_latex && "Alergia al látex",
    ficha.cicatrizacion && ficha.cicatrizacion !== "Normal" && `Cicatrización: ${ficha.cicatrizacion}`,
    ficha.fumador && "Fumador(a)",
    ficha.contraindicaciones && `Contraindicaciones: ${ficha.contraindicaciones}`,
  ].filter(Boolean) : [];

  return (
    <div className="estetica-tab">
      <style>{`
        .estetica-tab .et-visitas { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
        .estetica-tab .et-dos { display:grid; grid-template-columns:minmax(0,300px) minmax(0,1fr); gap:16px; align-items:start; }
        .estetica-tab .et-campos { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        .estetica-tab .et-prod { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,.8fr) 34px; gap:6px; align-items:center; }
        @media (max-width: 767px) {
          .estetica-tab .et-visitas { grid-template-columns:minmax(0,1fr); gap:6px; }
          .estetica-tab .et-dos, .estetica-tab .et-campos { grid-template-columns:minmax(0,1fr); }
          .estetica-tab .et-prod { grid-template-columns:minmax(0,1fr) minmax(0,1fr); padding-bottom:8px; border-bottom:1px dashed #e5e7eb; }
          .estetica-tab .et-prod .et-prod-prod { grid-column: 1 / -1; }
          .estetica-tab .et-prod button { justify-self:start; }
        }
      `}</style>

      {/* Datos importantes de la ficha y accesos */}
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        {previos.cargado && !ficha && (
          <Link to={`/estetica/ficha?paciente_id=${pacienteId}`} target="_blank" className="badge text-decoration-none" style={{ background: "#f3f4f6", color: "#374151", fontWeight: 600, padding: "6px 10px" }}>
            <i className="bi bi-clipboard2-pulse me-1" />Sin ficha estética — crearla
          </Link>
        )}
        {ficha && (
          <span className="badge" style={{ background: "#fdf2f8", color: ROSA, fontWeight: 600, padding: "6px 10px" }}>
            <i className="bi bi-person-badge me-1" />Fototipo {ficha.fototipo || "—"} · piel {String(ficha.piel_tipo || "—").toLowerCase()}
          </span>
        )}
        {alertasFicha.map((a) => (
          <span key={a} className="badge" style={{ background: "#fef2f2", color: "#b91c1c", fontWeight: 700, padding: "6px 10px", whiteSpace: "normal", textAlign: "left" }}>
            <i className="bi bi-exclamation-triangle-fill me-1" />{a}
          </span>
        ))}
        <div className="ms-auto d-flex gap-2 flex-wrap">
          <Link to={`/estetica/galeria?paciente_id=${pacienteId}`} target="_blank" className="btn btn-sm btn-outline-secondary"><i className="bi bi-camera me-1" />Fotos</Link>
          {!firmada && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setModal("presupuesto")}><i className="bi bi-receipt me-1" />Presupuesto</button>}
          {!firmada && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setModal("consentimiento")}><i className="bi bi-pen me-1" />Consentimiento</button>}
        </div>
      </div>

      {/* Tipo de visita */}
      <div className="et-visitas mb-3">
        {VISITAS.map((v) => {
          const activo = tipo === v.id;
          return (
            <button key={v.id} type="button" disabled={firmada} onClick={() => elegirVisita(v.id)}
              style={{ textAlign: "left", border: `2px solid ${activo ? ROSA : "#e5e7eb"}`, background: activo ? "#fdf2f8" : "#fff", borderRadius: 12, padding: "10px 12px", cursor: firmada ? "default" : "pointer" }}>
              <div style={{ fontWeight: 800, color: activo ? ROSA : "#111827", fontSize: "0.92rem" }}><i className={`bi ${v.icono} me-2`} />{v.label}</div>
              <div className="text-muted" style={{ fontSize: "0.76rem" }}>{v.ayuda}</div>
            </button>
          );
        })}
      </div>

      {!tipo && (
        <div className="text-center text-muted py-4" style={{ border: "1px dashed #e5e7eb", borderRadius: 12, fontSize: "0.9rem" }}>
          Elija el tipo de visita para ver los campos que corresponden.
        </div>
      )}

      {/* ── VALORACIÓN ── */}
      {tipo === "valoracion" && (
        <>
          <Seccion titulo="Motivo y expectativas" icono="bi-chat-heart">
            <div className="et-campos">
              <div><Lbl>¿Qué le gustaría mejorar?</Lbl>
                <textarea rows={3} style={inp} disabled={firmada} value={val.motivo || ""} onChange={(e) => set("valoracion", "motivo", e.target.value)} placeholder="En palabras del paciente" /></div>
              <div><Lbl>Expectativas</Lbl>
                <textarea rows={3} style={inp} disabled={firmada} value={val.expectativas || ""} onChange={(e) => set("valoracion", "expectativas", e.target.value)} placeholder="Qué resultado espera, para cuándo" /></div>
            </div>
          </Seccion>
          <Seccion titulo="Zonas a tratar" icono="bi-bullseye">
            <div className="et-dos">
              <MapaFacial marcadas={val.zonas || []} onToggle={(z) => toggleLista("valoracion", "zonas", z)} soloLectura={firmada} />
              <div>
                <Lbl>Cuerpo</Lbl>
                <div className="d-flex flex-wrap gap-1 mb-3">
                  {ZONAS_CUERPO.map((z) => <Chip key={z} disabled={firmada} activo={(val.zonas_cuerpo || []).includes(z)} onClick={() => toggleLista("valoracion", "zonas_cuerpo", z)}>{z}</Chip>)}
                </div>
                <Lbl>Marcadas</Lbl>
                <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                  {[...(val.zonas || []).map(nombreZona), ...(val.zonas_cuerpo || [])].join(", ") || "Toque las zonas en el dibujo o en la lista."}
                </div>
              </div>
            </div>
          </Seccion>
          <Seccion titulo="Contraindicaciones" icono="bi-shield-exclamation" color="#dc2626">
            <div className="d-flex flex-wrap gap-1">
              {CONTRAINDICACIONES.map((c) => <Chip key={c} disabled={firmada} activo={(val.contraindicaciones || []).includes(c)} onClick={() => toggleLista("valoracion", "contraindicaciones", c)}>{c}</Chip>)}
            </div>
            {(val.contraindicaciones || []).length === 0 && <div className="text-muted mt-2" style={{ fontSize: "0.8rem" }}>Ninguna marcada.</div>}
          </Seccion>
          <Seccion titulo="Plan sugerido" icono="bi-list-check" color="#8b5cf6">
            <Lbl>Procedimientos recomendados</Lbl>
            <div className="d-flex flex-wrap gap-1 mb-3">
              {PROCEDIMIENTOS_COMUNES.map((p) => <Chip key={p.nombre} disabled={firmada} activo={(val.sugeridos || []).includes(p.nombre)} onClick={() => toggleLista("valoracion", "sugeridos", p.nombre)}>{p.nombre}</Chip>)}
            </div>
            <div className="et-campos">
              <div><Lbl>Sesiones / plan</Lbl>
                <textarea rows={2} style={inp} disabled={firmada} value={val.plan || ""} onChange={(e) => set("valoracion", "plan", e.target.value)} placeholder="Ej.: 1 sesión, retoque a las 2 semanas" /></div>
              <div><Lbl>Observaciones</Lbl>
                <textarea rows={2} style={inp} disabled={firmada} value={val.observaciones || ""} onChange={(e) => set("valoracion", "observaciones", e.target.value)} /></div>
            </div>
            {!firmada && (val.sugeridos || []).length > 0 && (
              <button type="button" className="btn btn-sm mt-3" style={{ background: ROSA, color: "#fff", fontWeight: 700 }} onClick={() => setModal("presupuesto")}>
                <i className="bi bi-receipt me-1" />Hacer presupuesto con esto
              </button>
            )}
          </Seccion>
        </>
      )}

      {/* ── DÍA DEL PROCEDIMIENTO ── */}
      {tipo === "procedimiento" && (
        <>
          {previos.ultimoProc && !firmada && (
            <div className="d-flex align-items-center gap-2 flex-wrap mb-3" style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "8px 12px", fontSize: "0.85rem" }}>
              <i className="bi bi-arrow-repeat" style={{ color: "#7c3aed" }} />
              <span className="flex-grow-1">
                Última vez ({fechaCorta(previos.ultimoProc._creado_en)}): <strong>{previos.ultimoProc.nombre || "procedimiento"}</strong>
                {Object.keys(previos.ultimoProc.zonas || {}).length > 0 && ` · ${Object.entries(previos.ultimoProc.zonas).map(([z, c]) => `${nombreZona(z)}${c ? ` ${c}${previos.ultimoProc.unidad || ""}` : ""}`).join(", ")}`}
              </span>
              <button type="button" className="btn btn-sm" style={{ background: "#7c3aed", color: "#fff", fontWeight: 700 }} onClick={repetirAnterior}>Repetir lo de la última vez</button>
            </div>
          )}
          <Seccion titulo="Procedimiento" icono="bi-magic" extra={!firmada && proc.nombre && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={imprimir}><i className="bi bi-printer me-1" />Imprimir registro</button>
          )}>
            <div className="et-campos">
              <div><Lbl>Procedimiento</Lbl>
                <input list="et-procs" style={inp} disabled={firmada} value={proc.nombre || ""} placeholder="Escriba o elija"
                  onChange={(e) => { const n = e.target.value; setDatos((d) => ({ ...d, procedimiento: { ...(d.procedimiento || {}), nombre: n, unidad: d.procedimiento?.unidad || unidadDe(n) || "" } })); }} />
                <datalist id="et-procs">{PROCEDIMIENTOS_COMUNES.map((p) => <option key={p.nombre} value={p.nombre} />)}</datalist>
                {proc.nombre && previos.cargado && !firmadoPara(proc.nombre) && (
                  <div className="mt-1" style={{ color: "#b91c1c", fontSize: "0.78rem", fontWeight: 600 }}>
                    <i className="bi bi-exclamation-triangle-fill me-1" />No hay consentimiento firmado para este procedimiento.
                    {!firmada && <button type="button" className="btn btn-link btn-sm p-0 ms-1" style={{ color: "#b91c1c", fontWeight: 700, fontSize: "0.78rem", verticalAlign: "baseline" }} onClick={() => setModal("consentimiento")}>Hacerlo ahora</button>}
                  </div>
                )}
              </div>
              <div className="d-flex gap-2">
                <div style={{ flex: 1 }}><Lbl>Anestesia</Lbl>
                  <select style={inp} disabled={firmada} value={proc.anestesia || ""} onChange={(e) => set("procedimiento", "anestesia", e.target.value)}>
                    <option value="">—</option>{ANESTESIA_OPC.map((a) => <option key={a}>{a}</option>)}
                  </select></div>
                <div style={{ width: 110 }}><Lbl>Unidad</Lbl>
                  <select style={inp} disabled={firmada} value={proc.unidad || ""} onChange={(e) => set("procedimiento", "unidad", e.target.value)}>
                    <option value="">—</option>{UNIDADES.map((u) => <option key={u}>{u}</option>)}
                  </select></div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}><Lbl>Técnica</Lbl>
                <textarea rows={2} style={inp} disabled={firmada} value={proc.tecnica || ""} onChange={(e) => set("procedimiento", "tecnica", e.target.value)} placeholder="Ej.: aguja 30G, puntos de inyección, cánula 25G, plano…" /></div>
            </div>
          </Seccion>

          <Seccion titulo="Producto y lote" icono="bi-box-seam" color="#0ea5e9">
            <div className="et-prod mb-1 d-none d-md-grid" style={{ fontSize: "0.74rem", fontWeight: 700, color: "#6b7280" }}>
              <span>Producto / marca</span><span>Lote</span><span>Vence</span><span>Cantidad</span><span />
            </div>
            {(proc.productos || [{}]).map((p, i) => {
              const cambiar = (campo, v) => setDatos((d) => {
                const lista = [...(d.procedimiento?.productos || [{}])];
                lista[i] = { ...lista[i], [campo]: v };
                return { ...d, procedimiento: { ...(d.procedimiento || {}), productos: lista } };
              });
              return (
                <div key={i} className="et-prod mb-2">
                  <input className="et-prod-prod" style={inp} disabled={firmada} placeholder="Producto / marca" value={p.producto || ""} onChange={(e) => cambiar("producto", e.target.value)} />
                  <input style={inp} disabled={firmada} placeholder="Lote" value={p.lote || ""} onChange={(e) => cambiar("lote", e.target.value)} />
                  <input style={inp} disabled={firmada} type="month" title="Vencimiento" value={p.vence || ""} onChange={(e) => cambiar("vence", e.target.value)} />
                  <input style={inp} disabled={firmada} placeholder={proc.unidad || "Cant."} inputMode="decimal" value={p.cantidad || ""} onChange={(e) => cambiar("cantidad", e.target.value)} />
                  {!firmada ? (
                    <button type="button" className="btn btn-sm btn-light" title="Quitar" onClick={() => setDatos((d) => ({ ...d, procedimiento: { ...(d.procedimiento || {}), productos: (d.procedimiento?.productos || []).filter((_, j) => j !== i) } }))}>
                      <i className="bi bi-x-lg" />
                    </button>
                  ) : <span />}
                </div>
              );
            })}
            {!firmada && (
              <button type="button" className="btn btn-sm btn-link p-0" style={{ color: "#0ea5e9", fontWeight: 700 }}
                onClick={() => setDatos((d) => ({ ...d, procedimiento: { ...(d.procedimiento || {}), productos: [...(d.procedimiento?.productos || [{}]), {}] } }))}>
                <i className="bi bi-plus-circle me-1" />Agregar otro producto
              </button>
            )}
          </Seccion>

          <Seccion titulo="Zonas tratadas" icono="bi-bullseye" extra={(() => {
            const total = Object.values(proc.zonas || {}).reduce((s, c) => s + (parseFloat(c) || 0), 0);
            return total ? <strong style={{ color: ROSA }}>Total: {total} {proc.unidad || ""}</strong> : null;
          })()}>
            <div className="et-dos">
              <MapaFacial marcadas={Object.keys(proc.zonas || {})} cantidades={proc.zonas || {}} soloLectura={firmada}
                onToggle={(z) => setDatos((d) => {
                  const zonas = { ...(d.procedimiento?.zonas || {}) };
                  if (z in zonas) delete zonas[z]; else zonas[z] = "";
                  return { ...d, procedimiento: { ...(d.procedimiento || {}), zonas } };
                })} />
              <div>
                {Object.keys(proc.zonas || {}).length === 0 && <div className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>Toque las zonas en el dibujo y anote cuánto se aplicó en cada una.</div>}
                {Object.entries(proc.zonas || {}).map(([z, c]) => (
                  <div key={z} className="d-flex align-items-center gap-2 mb-2">
                    <span style={{ flex: 1, fontSize: "0.86rem", fontWeight: 600 }}>{nombreZona(z)}</span>
                    <input style={{ ...inp, width: 90 }} disabled={firmada} inputMode="decimal" placeholder="Cant." value={c}
                      onChange={(e) => setDatos((d) => ({ ...d, procedimiento: { ...(d.procedimiento || {}), zonas: { ...(d.procedimiento?.zonas || {}), [z]: e.target.value } } }))} />
                    <span className="text-muted" style={{ width: 52, fontSize: "0.8rem" }}>{proc.unidad || ""}</span>
                  </div>
                ))}
                <Lbl>Cuerpo</Lbl>
                <div className="d-flex flex-wrap gap-1">
                  {ZONAS_CUERPO.map((z) => <Chip key={z} disabled={firmada} activo={(proc.zonas_cuerpo || []).includes(z)} onClick={() => toggleLista("procedimiento", "zonas_cuerpo", z)}>{z}</Chip>)}
                </div>
              </div>
            </div>
          </Seccion>

          <Seccion titulo="Cierre" icono="bi-clipboard-check" color="#16a34a">
            <div className="et-campos">
              <div><Lbl>Tolerancia</Lbl>
                <div className="d-flex gap-1 flex-wrap">
                  {["Buena", "Regular", "Mala"].map((t) => <Chip key={t} disabled={firmada} activo={proc.tolerancia === t} onClick={() => set("procedimiento", "tolerancia", t)}>{t}</Chip>)}
                </div></div>
              <div><Lbl>Primer control</Lbl>
                <select style={inp} disabled={firmada} value={proc.proximo_control || ""} onChange={(e) => set("procedimiento", "proximo_control", e.target.value)}>
                  <option value="">—</option>{FASES_CONTROL.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select></div>
              <div><Lbl>Complicaciones inmediatas</Lbl>
                <textarea rows={2} style={inp} disabled={firmada} value={proc.complicaciones || ""} onChange={(e) => set("procedimiento", "complicaciones", e.target.value)} placeholder="Ninguna" /></div>
              <div><Lbl>Indicaciones para la casa</Lbl>
                <textarea rows={2} style={inp} disabled={firmada} value={proc.indicaciones || ""} onChange={(e) => set("procedimiento", "indicaciones", e.target.value)} placeholder="Ej.: no acostarse 4 h, no masajear, no ejercicio 24 h" /></div>
            </div>
          </Seccion>
        </>
      )}

      {/* ── CONTROL ── */}
      {tipo === "seguimiento" && (
        <Seccion titulo="Control post-procedimiento" icono="bi-heart-pulse" color="#8b5cf6">
          <div className="et-campos">
            <div><Lbl>Procedimiento que se controla</Lbl>
              <input style={inp} disabled={firmada} value={seg.procedimiento || ""} onChange={(e) => set("seguimiento", "procedimiento", e.target.value)} /></div>
            <div><Lbl>Momento del control</Lbl>
              <div className="d-flex flex-wrap gap-1">
                {FASES_CONTROL.map((f) => <Chip key={f.key} disabled={firmada} activo={seg.fase === f.key} onClick={() => set("seguimiento", "fase", f.key)}>{f.label}</Chip>)}
              </div></div>
            <div><Lbl>Dolor (0 a 10): <strong style={{ color: ROSA }}>{seg.dolor_eva || 0}</strong></Lbl>
              <input type="range" min="0" max="10" className="form-range" disabled={firmada} value={seg.dolor_eva || 0} onChange={(e) => set("seguimiento", "dolor_eva", e.target.value)} /></div>
            <div><Lbl>Edema</Lbl>
              <div className="d-flex flex-wrap gap-1">{EDEMA_OPC.map((o) => <Chip key={o} disabled={firmada} activo={seg.edema === o} onClick={() => set("seguimiento", "edema", o)}>{o}</Chip>)}</div></div>
            <div><Lbl>Cicatriz / piel</Lbl>
              <select style={inp} disabled={firmada} value={seg.cicatriz || ""} onChange={(e) => set("seguimiento", "cicatriz", e.target.value)}>
                {CICATRIZ_OPC.map((o) => <option key={o}>{o}</option>)}
              </select></div>
            <div><Lbl>Resultado</Lbl>
              <div className="d-flex flex-wrap gap-1">{RESULTADO_OPC.map((o) => <Chip key={o} disabled={firmada} activo={seg.resultado === o} onClick={() => set("seguimiento", "resultado", o)}>{o}</Chip>)}</div></div>
            <div><Lbl>Indicaciones</Lbl>
              <textarea rows={2} style={inp} disabled={firmada} value={seg.indicaciones || ""} onChange={(e) => set("seguimiento", "indicaciones", e.target.value)} /></div>
            <div><Lbl>Próximo control</Lbl>
              <input type="date" style={inp} disabled={firmada} value={seg.proxima_cita || ""} onChange={(e) => set("seguimiento", "proxima_cita", e.target.value)} />
              <label className="d-flex align-items-center gap-2 mt-2" style={{ fontSize: "0.85rem", cursor: "pointer" }}>
                <input type="checkbox" disabled={firmada} checked={!!seg.necesita_retoq} onChange={(e) => set("seguimiento", "necesita_retoq", e.target.checked)} />
                Necesita retoque
              </label></div>
          </div>
        </Seccion>
      )}

      {!firmada && tipo && (
        <div className="text-muted" style={{ fontSize: "0.78rem" }}>
          <i className="bi bi-info-circle me-1" />Se guarda junto con la consulta (botón Guardar). También aparece en la pestaña Estética del perfil del paciente.
        </div>
      )}

      {modal === "presupuesto" && (
        <ModalPresupuesto paciente={paciente} pacienteId={pacienteId} sugeridos={tipo === "procedimiento" && proc.nombre ? [proc.nombre] : (val.sugeridos || [])} onClose={() => setModal(null)} />
      )}
      {modal === "consentimiento" && (
        <ModalConsentimiento paciente={paciente} pacienteId={pacienteId} procedimiento={tipo === "procedimiento" ? proc.nombre : (val.sugeridos || [])[0]} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function Modal({ titulo, icono, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 1060, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div className="d-flex align-items-center mb-3">
          <h6 className="mb-0" style={{ fontWeight: 800, color: ROSA }}><i className={`bi ${icono} me-2`} />{titulo}</h6>
          <button type="button" className="btn-close ms-auto" aria-label="Cerrar" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

const nombrePac = (p) => [p?.nombres, p?.apellidos].filter(Boolean).join(" ") || "—";

function ModalPresupuesto({ paciente, pacienteId, sugeridos, onClose }) {
  const [items, setItems] = useState(() => (sugeridos.length ? sugeridos : [""]).map((n) => ({ nombre: n, precio: "" })));
  const [validez, setValidez] = useState("30");
  const [obs, setObs] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);
  const total = items.reduce((s, i) => s + (parseFloat(i.precio) || 0), 0);
  const guardar = async () => {
    setGuardando(true);
    try {
      await crearEstetica("presupuesto", pacienteId, {
        paciente_id: String(pacienteId), titulo: items.map((i) => i.nombre).filter(Boolean).join(" + "),
        procedimientos: items.filter((i) => i.nombre), observaciones: obs, validez_dias: validez, estado: "BORRADOR",
        paciente_nombre: nombrePac(paciente), total, creado_en: new Date().toISOString(),
      });
      setListo(true);
    } catch (e) { alert(e.response?.data?.msg || "No se pudo guardar el presupuesto."); }
    setGuardando(false);
  };
  return (
    <Modal titulo="Nuevo presupuesto" icono="bi-receipt" onClose={onClose}>
      {listo ? (
        <div className="text-center py-3">
          <i className="bi bi-check-circle-fill" style={{ fontSize: "2.2rem", color: "#16a34a" }} />
          <div className="fw-bold mt-2">Presupuesto guardado</div>
          <div className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>Puede enviarlo o cambiar su estado en Presupuestos.</div>
          <div className="d-flex gap-2 justify-content-center">
            <Link to="/estetica/presupuestos" target="_blank" className="btn btn-sm btn-outline-secondary">Abrir Presupuestos</Link>
            <button type="button" className="btn btn-sm" style={{ background: ROSA, color: "#fff" }} onClick={onClose}>Volver a la consulta</button>
          </div>
        </div>
      ) : (
        <>
          {items.map((it, i) => (
            <div key={i} className="d-flex gap-2 mb-2">
              <input list="et-procs-modal" style={{ ...inp, flex: 2 }} placeholder="Procedimiento" value={it.nombre}
                onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
              <input style={{ ...inp, flex: 1 }} placeholder="Precio" inputMode="decimal" value={it.precio}
                onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)))} />
              <button type="button" className="btn btn-sm btn-light" onClick={() => setItems((l) => l.filter((_, j) => j !== i))}><i className="bi bi-x-lg" /></button>
            </div>
          ))}
          <datalist id="et-procs-modal">{PROCEDIMIENTOS_COMUNES.map((p) => <option key={p.nombre} value={p.nombre} />)}</datalist>
          <button type="button" className="btn btn-sm btn-link p-0 mb-3" style={{ color: ROSA, fontWeight: 700 }} onClick={() => setItems((l) => [...l, { nombre: "", precio: "" }])}>
            <i className="bi bi-plus-circle me-1" />Agregar procedimiento
          </button>
          <div className="d-flex gap-2 mb-2">
            <div style={{ width: 130 }}><Lbl>Válido por (días)</Lbl><input style={inp} inputMode="numeric" value={validez} onChange={(e) => setValidez(e.target.value)} /></div>
            <div style={{ flex: 1 }}><Lbl>Observaciones</Lbl><input style={inp} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          </div>
          <div className="d-flex align-items-center mt-3">
            <strong>Total: {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
            <button type="button" className="btn ms-auto" style={{ background: ROSA, color: "#fff", fontWeight: 700 }}
              disabled={guardando || !items.some((i) => i.nombre)} onClick={guardar}>
              {guardando ? "Guardando…" : "Guardar presupuesto"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ModalConsentimiento({ paciente, pacienteId, procedimiento, onClose }) {
  const sugerida = PLANTILLAS_CONSENTIMIENTO.find((p) => procedimiento && String(procedimiento).toLowerCase().includes(p.procedimiento.toLowerCase().slice(0, 6)));
  const [plantillaId, setPlantillaId] = useState(sugerida ? String(sugerida.id) : "");
  const [otro, setOtro] = useState(sugerida ? "" : (procedimiento || ""));
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);
  const plantilla = PLANTILLAS_CONSENTIMIENTO.find((p) => String(p.id) === plantillaId);
  const nombre = plantilla?.procedimiento || otro;
  const contenido = plantilla?.contenido
    || `Yo, el/la abajo firmante, paciente de la clínica, declaro que he sido informado/a de manera clara y comprensible sobre el procedimiento de ${String(nombre || "").toUpperCase()}, sus beneficios, riesgos, posibles complicaciones, alternativas y cuidados posteriores. He podido hacer preguntas y doy mi consentimiento libre y voluntario para su realización.`;
  const guardar = async () => {
    setGuardando(true);
    try {
      await crearEstetica("consentimiento", pacienteId, {
        paciente_id: String(pacienteId), plantilla_id: plantillaId, notas,
        procedimiento: nombre, contenido, riesgos: plantilla?.riesgos || [],
        paciente_nombre: nombrePac(paciente), firmado: false, creado_en: new Date().toISOString(),
      });
      setListo(true);
    } catch (e) { alert(e.response?.data?.msg || "No se pudo guardar el consentimiento."); }
    setGuardando(false);
  };
  return (
    <Modal titulo="Consentimiento informado" icono="bi-pen" onClose={onClose}>
      {listo ? (
        <div className="text-center py-3">
          <i className="bi bi-check-circle-fill" style={{ fontSize: "2.2rem", color: "#16a34a" }} />
          <div className="fw-bold mt-2">Consentimiento creado</div>
          <div className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>Imprímalo y márquelo como firmado en Consentimientos.</div>
          <div className="d-flex gap-2 justify-content-center">
            <Link to={`/estetica/consentimientos?paciente_id=${pacienteId}`} target="_blank" className="btn btn-sm btn-outline-secondary">Abrir Consentimientos</Link>
            <button type="button" className="btn btn-sm" style={{ background: ROSA, color: "#fff" }} onClick={onClose}>Volver a la consulta</button>
          </div>
        </div>
      ) : (
        <>
          <Lbl>Plantilla</Lbl>
          <select style={inp} className="mb-2" value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
            <option value="">Otro procedimiento (texto general)</option>
            {PLANTILLAS_CONSENTIMIENTO.map((p) => <option key={p.id} value={p.id}>{p.procedimiento}</option>)}
          </select>
          {!plantilla && (<><Lbl>Procedimiento</Lbl><input style={inp} className="mb-2" value={otro} onChange={(e) => setOtro(e.target.value)} placeholder="Ej.: Toxina botulínica" /></>)}
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, fontSize: "0.82rem", maxHeight: 180, overflowY: "auto" }} className="mb-2">
            {contenido}
            {plantilla?.riesgos?.length > 0 && <div className="mt-2"><strong>Riesgos:</strong> {plantilla.riesgos.join(", ")}.</div>}
          </div>
          <Lbl>Notas</Lbl>
          <input style={inp} value={notas} onChange={(e) => setNotas(e.target.value)} />
          <div className="d-flex mt-3">
            <button type="button" className="btn ms-auto" style={{ background: ROSA, color: "#fff", fontWeight: 700 }} disabled={guardando || !nombre} onClick={guardar}>
              {guardando ? "Guardando…" : "Crear consentimiento"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Hoja imprimible del procedimiento (para el expediente físico). */
function htmlRegistro({ proc, paciente }) {
  const zonas = Object.entries(proc.zonas || {});
  const total = zonas.reduce((s, [, c]) => s + (parseFloat(c) || 0), 0);
  const fila = (k, v) => (v ? `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>` : "");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Registro de procedimiento</title>
  <style>body{font-family:Arial,sans-serif;color:#111;padding:24px;font-size:13px}h1{font-size:18px;color:${ROSA};margin:0 0 4px}
  table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{background:#fdf2f8;width:32%}
  .f{margin-top:60px;display:flex;justify-content:space-between}.f div{border-top:1px solid #333;width:42%;text-align:center;padding-top:4px}</style></head><body>
  <h1>Registro de procedimiento estético</h1>
  <div>Paciente: <strong>${esc(nombrePac(paciente))}</strong> · Fecha: ${esc(new Date().toLocaleDateString("es"))}</div>
  <table>${fila("Procedimiento", proc.nombre)}${fila("Anestesia", proc.anestesia)}${fila("Técnica", proc.tecnica)}${fila("Tolerancia", proc.tolerancia)}${fila("Complicaciones", proc.complicaciones)}${fila("Indicaciones", proc.indicaciones)}</table>
  ${(proc.productos || []).some((p) => p.producto || p.lote) ? `<table><tr><th>Producto</th><th>Lote</th><th>Vence</th><th>Cantidad</th></tr>${(proc.productos || []).filter((p) => p.producto || p.lote).map((p) => `<tr><td>${esc(p.producto)}</td><td>${esc(p.lote)}</td><td>${esc(p.vence)}</td><td>${esc(p.cantidad)} ${esc(proc.unidad || "")}</td></tr>`).join("")}</table>` : ""}
  ${zonas.length || (proc.zonas_cuerpo || []).length ? `<table><tr><th>Zona</th><th>Cantidad</th></tr>${zonas.map(([z, c]) => `<tr><td>${esc(nombreZona(z))}</td><td>${esc(c)} ${esc(proc.unidad || "")}</td></tr>`).join("")}${(proc.zonas_cuerpo || []).map((z) => `<tr><td>${esc(z)}</td><td></td></tr>`).join("")}${total ? `<tr><th>Total</th><th>${total} ${esc(proc.unidad || "")}</th></tr>` : ""}</table>` : ""}
  <div class="f"><div>Firma del médico</div><div>Firma del paciente</div></div>
  </body></html>`;
}
