import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { VITALS_FIELDS } from "../pages/ConsultaMedica/helpers";
import TarjetaHistorial from "./TarjetaHistorial";
import { nombreZona, FASES_CONTROL } from "../utils/esteticaCatalogos";
import { DERMA_CAMPOS, valorDerma, leerJson, tieneDerma } from "../utils/impresionConsulta";

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
  estetica: { nombre: "Estética", color: "#db2777", icono: "bi-stars" },
  derma: { nombre: "Dermatología", color: "#0891b2", icono: "bi-bandaid" },
};
const VISITA_ESTETICA = { valoracion: "Valoración", procedimiento: "Día del procedimiento", seguimiento: "Control post-procedimiento" };

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
  if (h.estetica_tipo) s.push("estetica");
  if (Number(h.tiene_derma) === 1) s.push("derma");
  return s;
}

/** Contenido de la tarjeta de Estética según el tipo de visita */
function DetalleEstetica({ e }) {
  if (!e) return <div className="small text-muted">Cargando…</div>;
  const d = e.datos || {};
  const lista = (v) => (Array.isArray(v) && v.length ? v.join(", ") : null);
  const fecha = (v) => (v ? dayjs(String(v).slice(0, 10)).format("DD/MM/YYYY") : null);
  const sub = (t) => <div className="mt-2 mb-1" style={{ fontSize: "0.74rem", fontWeight: 800, color: "#9d174d", textTransform: "uppercase", letterSpacing: ".04em" }}>{t}</div>;
  return (
    <div>
      <span className="badge mb-2" style={{ background: "#fdf2f8", color: "#be185d", fontWeight: 700 }}>{VISITA_ESTETICA[e.tipo] || e.tipo}</span>
      {e.tipo === "procedimiento" && (() => {
        const zonas = Object.entries(d.zonas || {});
        const total = zonas.reduce((t, [, c]) => t + (parseFloat(c) || 0), 0);
        const productos = (d.productos || []).filter((p) => p && (p.producto || p.lote));
        return (
          <>
            <Fila label="Procedimiento" valor={d.nombre} />
            <Fila label="Anestesia" valor={d.anestesia} />
            <Fila label="Técnica" valor={d.tecnica} />
            {productos.length > 0 && <>{sub("Producto y lote")}{productos.map((p, i) => (
              <Fila key={i} label={p.producto || "Producto"} valor={[p.lote && `Lote ${p.lote}`, p.vence && `vence ${p.vence}`, p.cantidad && `${p.cantidad} ${d.unidad || ""}`].filter(Boolean).join(" · ")} />
            ))}</>}
            {(zonas.length > 0 || (d.zonas_cuerpo || []).length > 0) && <>{sub(`Zonas tratadas${total ? ` · total ${total} ${d.unidad || ""}` : ""}`)}
              {zonas.map(([z, c]) => <Fila key={z} label={nombreZona(z)} valor={c ? `${c} ${d.unidad || ""}` : "✓"} />)}
              <Fila label="Cuerpo" valor={lista(d.zonas_cuerpo)} />
            </>}
            <Fila label="Tolerancia" valor={d.tolerancia} />
            <Fila label="Complicaciones" valor={d.complicaciones} />
            {d.paquete?.nombre && <Fila label="Paquete" valor={`${d.paquete.nombre} (${d.paquete.sesiones} sesiones)`} />}
            {hay(d.indicaciones) && <>{sub("Indicaciones para la casa")}<Texto>{d.indicaciones}</Texto></>}
            {(d.controles_agendados || []).length > 0 && <>{sub("Controles agendados")}
              {d.controles_agendados.map((c) => <Fila key={`${c.fase}-${c.fecha}`} label={c.label} valor={`${fecha(c.fecha)}${c.hora ? ` ${c.hora}` : ""}`} />)}
            </>}
            <Fila label="Mantenimiento" valor={fecha(d.mantenimiento_fecha)} />
            {d.satisfaccion && <Fila label="Calificación del paciente" valor={`${"★".repeat(d.satisfaccion.estrellas)}${"☆".repeat(5 - d.satisfaccion.estrellas)}`} />}
          </>
        );
      })()}
      {e.tipo === "valoracion" && (
        <>
          <Fila label="Motivo" valor={d.motivo} />
          <Fila label="Expectativas" valor={d.expectativas} />
          <Fila label="Zonas" valor={lista([...(d.zonas || []).map(nombreZona), ...(d.zonas_cuerpo || [])])} />
          <Fila label="Contraindicaciones" valor={lista(d.contraindicaciones) || "Ninguna"} />
          <Fila label="Recomendado" valor={lista(d.sugeridos)} />
          <Fila label="Plan" valor={d.plan} />
          <Fila label="Observaciones" valor={d.observaciones} />
        </>
      )}
      {e.tipo === "seguimiento" && (
        <>
          <Fila label="Procedimiento" valor={d.procedimiento} />
          <Fila label="Momento" valor={FASES_CONTROL.find((f) => f.key === d.fase)?.label || d.fase} />
          <Fila label="Dolor" valor={hay(d.dolor_eva) ? `${d.dolor_eva}/10` : null} />
          <Fila label="Edema" valor={d.edema} />
          <Fila label="Cicatriz / piel" valor={d.cicatriz} />
          <Fila label="Resultado" valor={d.resultado} />
          <Fila label="Próximo control" valor={fecha(d.proxima_cita)} />
          <Fila label="Necesita retoque" valor={d.necesita_retoq ? "Sí" : null} />
          {hay(d.indicaciones) && <>{sub("Indicaciones")}<Texto>{d.indicaciones}</Texto></>}
        </>
      )}
    </div>
  );
}

function Tarjeta({ tipo, children, ancha }) {
  const s = SECCIONES[tipo];
  return <TarjetaHistorial color={s.color} icono={s.icono} nombre={s.nombre} ancha={ancha}>{children}</TarjetaHistorial>;
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
        .hc-fila { display: flex; align-items: center; }
        .hc-acciones { display: flex; gap: 6px; align-items: center; flex-shrink: 0; padding: 0 4px; }
        .hc-accion { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 6px 13px; font-size: .8rem; font-weight: 700;
          border: 1px solid transparent; cursor: pointer; transition: transform .15s, box-shadow .15s, background .15s; white-space: nowrap; }
        .hc-accion:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(15,23,42,.12); }
        .hc-accion:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
        .hc-principal { background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; }
        .hc-editar { background: #eef2ff; color: #4338ca; border-color: #c7d2fe; }
        .hc-imprimir { background: #f8fafc; color: #334155; border-color: #e2e8f0; }
        .hc-eco { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
        .hc-flecha { background: none; border: none; color: #64748b; padding: 12px 16px 12px 8px; align-self: stretch; cursor: pointer; }
        .hc-flecha:hover { color: #4338ca; }
        @media (max-width: 767px) {
          .hc-fila { flex-wrap: wrap; }
          .hc-fila .hc-cab { flex: 1 1 0; }
          .hc-acciones { order: 3; width: 100%; padding: 0 12px 12px; }
          .hc-accion { flex: 1 1 0; justify-content: center; padding: 7px 8px; }
        }
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
                <div className="hc-fila">
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
                            {SECCIONES[s].nombre}{s === "recetas" && Number(h.n_recetas) > 1 ? ` (${h.n_recetas})` : ""}{s === "estetica" && VISITA_ESTETICA[h.estetica_tipo] ? ` · ${VISITA_ESTETICA[h.estetica_tipo]}` : ""}
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
                  </button>
                  {/* Acciones: siempre visibles, aunque la consulta esté cerrada */}
                  <div className="hc-acciones">
                    <button type="button" className="hc-accion hc-principal" onClick={() => onAbrir(h)} title={firmada ? "Ver consulta completa" : "Continuar consulta"}>
                      <i className="bi bi-box-arrow-up-right" /><span>{firmada ? "Ver consulta" : "Continuar"}</span>
                    </button>
                    <button type="button" className="hc-accion hc-editar" onClick={() => onEditar(h)} title="Editar">
                      <i className="bi bi-pencil-square" /><span>Editar</span>
                    </button>
                    <button type="button" className="hc-accion hc-imprimir" onClick={() => onImprimir(h)} title="Imprimir">
                      <i className="bi bi-printer" /><span>Imprimir</span>
                    </button>
                    {Number(h.tiene_eco) === 1 && (
                      <button type="button" className="hc-accion hc-eco" onClick={() => onImprimirEco(h)} title="Imprimir ecocardiograma">
                        <i className="bi bi-heart-pulse" /><span>Eco</span>
                      </button>
                    )}
                  </div>
                  <button type="button" className="hc-flecha" onClick={() => alternar(h.id)} aria-label={abierta ? "Cerrar consulta" : "Abrir consulta"} aria-expanded={abierta}>
                    <i className="bi bi-chevron-down" style={{ transition: "transform .35s ease", transform: abierta ? "rotate(180deg)" : "none" }} />
                  </button>
                </div>

                <div className="hc-desplegable" style={{ gridTemplateRows: abierta ? "1fr" : "0fr", opacity: abierta ? 1 : 0 }} aria-hidden={!abierta}>
                  <div style={{ overflow: "hidden", minHeight: 0 }}>
                    {(abierta || montadas.has(h.id)) && (
                      <div style={{ padding: 16, borderTop: "1px solid #eef2ff" }}>
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
                          {secc.includes("derma") && (!det || tieneDerma(det.datos_derma)) && (
                            <Tarjeta tipo="derma">
                              {!det ? <div className="small text-muted">Cargando…</div> : DERMA_CAMPOS.map(([k, l]) => {
                                const v = leerJson(det.datos_derma)[k];
                                return <Fila key={k} label={l} valor={v === false || v === null || v === undefined || String(v).trim() === "" ? null : valorDerma(v)} />;
                              })}
                            </Tarjeta>
                          )}
                          {secc.includes("estetica") && (
                            <Tarjeta tipo="estetica" ancha><DetalleEstetica e={det ? det.estetica : null} /></Tarjeta>
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
