import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { VITALS_FIELDS } from "../pages/ConsultaMedica/helpers";

/**
 * Historial de consultas del paciente con el mismo diseño del Historial de Nutrición:
 * línea de tiempo con la fecha, etiquetas de lo que se hizo, resumen y, al abrir,
 * tarjetas con todo lo de esa consulta (signos, subjetivo, examen, diagnóstico,
 * plan, recetas, estudios y documentos).
 */

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MESES_LARGO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const SECCIONES = {
  vitales: { nombre: "Signos vitales", color: "#ef4444", icono: "bi-heart-pulse" },
  subjetivo: { nombre: "Subjetivo", color: "#3b82f6", icono: "bi-chat-left-text" },
  examen: { nombre: "Examen físico", color: "#16a34a", icono: "bi-person-check" },
  diagnostico: { nombre: "Diagnóstico", color: "#f59e0b", icono: "bi-clipboard2-pulse" },
  plan: { nombre: "Plan", color: "#a855f7", icono: "bi-list-check" },
  recetas: { nombre: "Receta", color: "#ec4899", icono: "bi-capsule" },
  estudios: { nombre: "Estudios", color: "#0ea5e9", icono: "bi-eyedropper" },
  documentos: { nombre: "Documentos", color: "#64748b", icono: "bi-paperclip" },
  eco: { nombre: "Ecocardiograma", color: "#dc2626", icono: "bi-heart-pulse-fill" },
};

const hay = (v) => v !== null && v !== undefined && String(v).trim() !== "";
const json = (v, def) => { if (!v) return def; try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return def; } };
const fechaLarga = (f) => { const d = dayjs(f); return `${d.date()} de ${MESES_LARGO[d.month()]} de ${d.year()}`; };

function seccionesDe(h, docs) {
  const v = json(h.objetivo, {});
  const s = [];
  if (VITALS_FIELDS.some((f) => hay(v[f.key]))) s.push("vitales");
  if (hay(h.subjetivo)) s.push("subjetivo");
  if (hay(h.examen_fisico)) s.push("examen");
  if (hay(h.diagnostico_cie) || json(h.diagnosticos_secundarios, []).length) s.push("diagnostico");
  if (hay(h.plan)) s.push("plan");
  if (Number(h.n_recetas) > 0) s.push("recetas");
  if (Number(h.n_estudios) > 0) s.push("estudios");
  if (docs?.length) s.push("documentos");
  if (Number(h.tiene_eco) === 1) s.push("eco");
  return s;
}

function Tarjeta({ tipo, children, ancha }) {
  const s = SECCIONES[tipo];
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: `3px solid ${s.color}`, borderRadius: 10, padding: "12px 14px", gridColumn: ancha ? "1 / -1" : undefined }}>
      <div className="d-flex align-items-center gap-2 mb-2" style={{ color: s.color, fontWeight: 800, fontSize: "0.78rem", letterSpacing: ".04em", textTransform: "uppercase" }}>
        <i className={`bi ${s.icono}`} />{s.nombre}
      </div>
      {children}
    </div>
  );
}

function Fila({ label, valor }) {
  if (!hay(valor)) return null;
  return (
    <div className="d-flex justify-content-between gap-3 py-1" style={{ borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem" }}>
      <span style={{ color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span className="text-end" style={{ fontWeight: 700, color: "#0f172a", minWidth: 0, overflowWrap: "anywhere" }}>{valor}</span>
    </div>
  );
}

const Texto = ({ children }) => <div style={{ fontSize: "0.86rem", whiteSpace: "pre-wrap", color: "#0f172a" }}>{children}</div>;

export default function HistorialConsultas({
  historias, docsPorHistoria = {}, detalle = {}, onCargarDetalle, nombreMedico, especialidadDe,
  onAbrir, onEditar, onImprimir, onImprimirEco, onPdfReceta, enlaceDocumento, tiposDoc = [], vacio,
}) {
  const [abiertas, setAbiertas] = useState(null); // null = solo la más reciente
  const [montadas, setMontadas] = useState(() => new Set());
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const lista = useMemo(() => historias.filter((h) => {
    const f = dayjs(h.creado_en).format("YYYY-MM-DD");
    return (!desde || f >= desde) && (!hasta || f <= hasta);
  }), [historias, desde, hasta]);

  // La consulta más reciente se muestra abierta: se piden sus recetas y estudios
  const primera = lista[0]?.id;
  useEffect(() => {
    if (abiertas === null && primera && !detalle[primera]) onCargarDetalle?.(primera);
  }, [abiertas, primera, detalle, onCargarDetalle]);

  if (!historias.length) return vacio;

  const abiertasSet = abiertas ?? new Set(lista.length ? [lista[0].id] : []);
  const todasAbiertas = lista.length > 0 && lista.every((h) => abiertasSet.has(h.id));
  const abrirVarias = (ids) => ids.forEach((id) => { if (!detalle[id]) onCargarDetalle?.(id); });

  const alternar = (id) => {
    const n = new Set(abiertasSet);
    if (n.has(id)) n.delete(id); else { n.add(id); abrirVarias([id]); }
    setMontadas((m) => new Set([...m, ...abiertasSet, id]));
    setAbiertas(n);
  };
  const expandirTodo = () => {
    const ids = lista.map((h) => h.id);
    setMontadas(new Set(ids));
    if (!todasAbiertas) abrirVarias(ids);
    setAbiertas(todasAbiertas ? new Set() : new Set(ids));
  };

  return (
    <div>
      <style>{`
        .hc-desplegable { display: grid; transition: grid-template-rows .35s ease, opacity .3s ease; }
        @media (prefers-reduced-motion: reduce) { .hc-desplegable { transition: none; } }
        .hc-cab:hover { background: #fafbff; }
      `}</style>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div style={{ fontSize: "0.92rem" }}>
          <b>{lista.length} {lista.length === 1 ? "consulta" : "consultas"}</b>
          {lista.length > 0 && <span className="text-muted"> · de {fechaLarga(lista[lista.length - 1].creado_en)} a {fechaLarga(lista[0].creado_en)}</span>}
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 ms-auto">
          <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
          <span className="text-muted">—</span>
          <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
          {(desde || hasta) && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setDesde(""); setHasta(""); }}>
              <i className="bi bi-x-lg me-1" />Limpiar
            </button>
          )}
          <button type="button" className="btn btn-sm btn-link fw-semibold text-decoration-none" onClick={expandirTodo}>
            {todasAbiertas ? "Contraer todo" : "Expandir todo"}
          </button>
        </div>
      </div>

      <div style={{ position: "relative", paddingLeft: 22 }}>
        <div style={{ position: "absolute", left: 6, top: 8, bottom: 8, width: 2, background: "#e0e7ff" }} />
        {lista.map((h) => {
          const abierta = abiertasSet.has(h.id);
          const fecha = dayjs(h.creado_en);
          const vit = json(h.objetivo, {});
          const docs = docsPorHistoria[h.id] || [];
          const secc = seccionesDe(h, docs);
          const det = detalle[h.id];
          const firmada = h.estado === "FIRMADA";
          const resumenVit = [
            hay(vit.pa) && `PA ${vit.pa}`, hay(vit.fc) && `FC ${vit.fc} bpm`, hay(vit.temp) && `T ${vit.temp}°C`,
            hay(vit.peso) && `${vit.peso} kg`, hay(vit.imc) && `IMC ${vit.imc}`,
          ].filter(Boolean);
          const dxDesc = h.diagnostico_desc || det?.diagnostico_desc;
          const resumenTexto = hay(h.diagnostico_cie) ? null : hay(h.subjetivo) ? h.subjetivo : null;
          const especialidad = especialidadDe?.(h);

          return (
            <div key={h.id} style={{ position: "relative", marginBottom: 12 }}>
              <span style={{
                position: "absolute", left: -21, top: 22, width: 12, height: 12, borderRadius: "50%",
                background: abierta ? (firmada ? "#16a34a" : "#f59e0b") : "#fff", border: `2px solid ${firmada ? "#16a34a" : "#f59e0b"}`,
              }} />
              <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${abierta ? "#a5b4fc" : "#e5e7eb"}`, boxShadow: "0 1px 4px rgba(0,0,0,.05)", overflow: "hidden" }}>
                <div className="d-flex align-items-stretch">
                  <button type="button" onClick={() => alternar(h.id)} className="hc-cab flex-grow-1 text-start d-flex align-items-center gap-3"
                    style={{ background: "none", border: "none", padding: "12px 16px", cursor: "pointer", minWidth: 0 }}>
                    <div className="text-center" style={{ minWidth: 52 }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1, color: "#0f172a" }}>{fecha.format("DD")}</div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6366f1" }}>{MESES[fecha.month()]} {fecha.year()}</div>
                      <div style={{ fontSize: "0.66rem", color: "#94a3b8" }}>{fecha.format("h:mm A")}</div>
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="d-flex flex-wrap gap-1 align-items-center">
                        <span className={`badge ${firmada ? "bg-success" : "bg-warning text-dark"}`} style={{ fontSize: "0.66rem" }}>{firmada ? "FIRMADA" : "BORRADOR"}</span>
                        {h.firma_digital_url && <span className="badge" style={{ background: "#1a2744", fontSize: "0.62rem" }}>✍ FIRMA DIGITAL</span>}
                        {secc.map((s) => (
                          <span key={s} style={{ fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "1px 9px", background: `${SECCIONES[s].color}1f`, color: SECCIONES[s].color }}>
                            {SECCIONES[s].nombre}{s === "recetas" && Number(h.n_recetas) > 1 ? ` (${h.n_recetas})` : ""}
                          </span>
                        ))}
                      </div>
                      {hay(h.diagnostico_cie) && (
                        <div className="mt-1 text-truncate" style={{ fontSize: "0.84rem", color: "#334155" }}>
                          <span className="badge bg-light text-dark border me-1">{h.diagnostico_cie}</span>{dxDesc}
                        </div>
                      )}
                      {resumenTexto && <div className="mt-1 text-truncate" style={{ fontSize: "0.82rem", color: "#475569" }}>{resumenTexto}</div>}
                      {resumenVit.length > 0 && <div style={{ fontSize: "0.8rem", color: "#475569" }}>{resumenVit.join(" · ")}</div>}
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{nombreMedico(h)}{especialidad ? ` (${especialidad})` : ""}</div>
                    </div>
                    <i className="bi bi-chevron-down" style={{ color: "#64748b", transition: "transform .35s ease", transform: abierta ? "rotate(180deg)" : "none" }} />
                  </button>
                </div>

                <div className="hc-desplegable" style={{ gridTemplateRows: abierta ? "1fr" : "0fr", opacity: abierta ? 1 : 0 }} aria-hidden={!abierta}>
                  <div style={{ overflow: "hidden", minHeight: 0 }}>
                    {(abierta || montadas.has(h.id)) && (
                      <div style={{ padding: 16, borderTop: "1px solid #eef2ff" }}>
                        <div className="d-flex flex-wrap gap-2 mb-3">
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onAbrir(h)}>
                            <i className="bi bi-box-arrow-up-right me-1" />{firmada ? "Ver consulta completa" : "Continuar consulta"}
                          </button>
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onEditar(h)}>
                            <i className="bi bi-pencil-square me-1" />Editar
                          </button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onImprimir(h)}>
                            <i className="bi bi-printer me-1" />Imprimir
                          </button>
                          {Number(h.tiene_eco) === 1 && (
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onImprimirEco(h)}>
                              <i className="bi bi-heart-pulse me-1" />Imprimir eco
                            </button>
                          )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
                          {secc.includes("vitales") && (
                            <Tarjeta tipo="vitales">
                              {VITALS_FIELDS.map((f) => <Fila key={f.key} label={f.label} valor={hay(vit[f.key]) ? `${vit[f.key]} ${f.unit}` : null} />)}
                            </Tarjeta>
                          )}
                          {secc.includes("diagnostico") && (
                            <Tarjeta tipo="diagnostico">
                              {hay(h.diagnostico_cie) && (
                                <div style={{ fontSize: "0.86rem" }}>
                                  <span className="badge bg-warning-subtle text-warning-emphasis me-1">{h.diagnostico_cie}</span>
                                  <b>{dxDesc}</b>
                                </div>
                              )}
                              {json(h.diagnosticos_secundarios, []).map((d, i) => (
                                <div key={i} className="mt-1" style={{ fontSize: "0.82rem", color: "#475569" }}>
                                  <span className="badge bg-light text-dark border me-1">{d.codigo || d.cie || ""}</span>{d.descripcion || d.desc || ""}
                                </div>
                              ))}
                            </Tarjeta>
                          )}
                          {secc.includes("subjetivo") && <Tarjeta tipo="subjetivo"><Texto>{h.subjetivo}</Texto></Tarjeta>}
                          {secc.includes("examen") && <Tarjeta tipo="examen"><Texto>{h.examen_fisico}</Texto></Tarjeta>}
                          {secc.includes("plan") && <Tarjeta tipo="plan"><Texto>{h.plan}</Texto></Tarjeta>}
                          {secc.includes("recetas") && (
                            <Tarjeta tipo="recetas">
                              {!det ? <div className="small text-muted">Cargando…</div> : det.prescripciones?.map((p) => (
                                <div key={p.id} className="mb-2" style={{ fontSize: "0.84rem" }}>
                                  <div className="d-flex align-items-center gap-2 mb-1">
                                    <b>Receta #{p.id}</b>
                                    <button type="button" className="btn btn-outline-primary btn-sm py-0 px-2 ms-auto" style={{ fontSize: "0.72rem" }} onClick={() => onPdfReceta(p.id)}>
                                      <i className="bi bi-file-earmark-pdf me-1" />PDF
                                    </button>
                                  </div>
                                  {p.items?.filter((it) => it && (it.medicamento_texto || it.medicamento_nombre)).map((it, i) => (
                                    <div key={i} style={{ color: "#475569" }}>• <b style={{ color: "#0f172a" }}>{it.medicamento_nombre || it.medicamento_texto}</b>{it.dosis ? ` — ${it.dosis}` : ""}{it.duracion ? `, ${it.duracion}` : ""}</div>
                                  ))}
                                </div>
                              ))}
                            </Tarjeta>
                          )}
                          {secc.includes("estudios") && (
                            <Tarjeta tipo="estudios">
                              {!det ? <div className="small text-muted">Cargando…</div> : det.estudios?.map((s) => (
                                <div key={s.id} className="py-1" style={{ fontSize: "0.84rem", borderBottom: "1px solid #f1f5f9" }}>
                                  <b>{s.descripcion || s.tipo}</b>
                                  <span className="text-muted"> · {s.tipo}{s.estado ? ` · ${s.estado}` : ""}</span>
                                </div>
                              ))}
                            </Tarjeta>
                          )}
                          {secc.includes("documentos") && (
                            <Tarjeta tipo="documentos">
                              {docs.map((d) => {
                                const t = tiposDoc.find((x) => x.value === d.tipo);
                                return (
                                  <a key={d.id} href={enlaceDocumento(d)} target="_blank" rel="noreferrer" className="d-flex align-items-center gap-2 py-1 text-decoration-none" style={{ fontSize: "0.84rem", borderBottom: "1px solid #f1f5f9" }}>
                                    <i className={`bi ${t?.icon || "bi-file-earmark"}`} />
                                    <span className="text-muted">{t?.label || "Documento"}:</span>
                                    <span className="text-truncate">{d.nombre}</span>
                                  </a>
                                );
                              })}
                            </Tarjeta>
                          )}
                          {!secc.length && <div className="text-muted small">Esta consulta no tiene datos registrados todavía.</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!lista.length && <div className="text-muted small py-3">No hay consultas en esas fechas.</div>}
      </div>
    </div>
  );
}
