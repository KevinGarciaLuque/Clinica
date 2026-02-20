/**
 * FASE 4 — Historia Clínica Electrónica — Timeline del paciente
 * URL: /historia/:paciente_id
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";

const ESTADO_BADGE = { BORRADOR: "warning text-dark", FIRMADA: "success" };
const SEV_COLOR    = { LEVE: "success", MODERADA: "warning", SEVERA: "danger", MORTAL: "dark" };

export default function HistoriaClinica() {
  const { paciente_id } = useParams();
  const navigate        = useNavigate();

  const [paciente,     setPaciente]     = useState(null);
  const [historias,    setHistorias]    = useState([]);
  const [alergias,     setAlergias]     = useState([]);
  const [antecedentes, setAntecedentes] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");       // buscar paciente si no hay id en URL
  const [searchList,   setSearchList]   = useState([]);
  const [selPacId,     setSelPacId]     = useState(paciente_id || null);
  const [expandId,     setExpandId]     = useState(null);    // expanded historia
  const [detalle,      setDetalle]      = useState({});      // historia_id → full detail

  // ── cargar datos cuando se selecciona paciente ────────────────────────────
  useEffect(() => {
    if (!selPacId) { setLoading(false); return; }
    setLoading(true);

    Promise.all([
      api.get(`/pacientes/${selPacId}`),
      api.get(`/historias`, { params: { paciente_id: selPacId } }),
      api.get(`/historias/paciente/${selPacId}/alergias`),
      api.get(`/historias/paciente/${selPacId}/antecedentes`),
    ])
    .then(([p, h, al, ant]) => {
      setPaciente(p.data.data || null);
      setHistorias(h.data.data || []);
      setAlergias(al.data.data || []);
      setAntecedentes(ant.data.data || []);
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, [selPacId]);

  // ── búsqueda de paciente ──────────────────────────────────────────────────
  useEffect(() => {
    if (search.length < 2) { setSearchList([]); return; }
    const t = setTimeout(() => {
      api.get("/pacientes", { params: { q: search } })
        .then(r => setSearchList(r.data.data || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── expandir entrada → cargar detalle ────────────────────────────────────
  const toggleExpand = async (id) => {
    if (expandId === id) { setExpandId(null); return; }
    setExpandId(id);
    if (!detalle[id]) {
      try {
        const r = await api.get(`/historias/${id}`);
        setDetalle(d => ({ ...d, [id]: r.data.data }));
      } catch { /* silencio */ }
    }
  };

  // ── PDF de receta ─────────────────────────────────────────────────────────
  const printRx = async (id) => {
    try {
      const res = await api.get(`/prescripciones/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch {
      alert("No se pudo generar el PDF");
    }
  };

  // ── agrupar antecedentes por tipo ─────────────────────────────────────────
  const antByTipo = antecedentes.reduce((acc, a) => {
    acc[a.tipo] = acc[a.tipo] || [];
    acc[a.tipo].push(a);
    return acc;
  }, {});

  const edad = paciente?.fecha_nacimiento
    ? dayjs().diff(dayjs(paciente.fecha_nacimiento), "year") + " años"
    : "";

  return (
    <div className="container-fluid py-3" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="fw-bold mb-0">Historia Clínica Electrónica</h4>
        {selPacId && (
          <Link to={`/consulta?paciente_id=${selPacId}`} className="btn btn-primary btn-sm">
            + Nueva Consulta
          </Link>
        )}
      </div>

      {/* Búsqueda de paciente (si no viene de URL) */}
      {!paciente_id && (
        <div className="position-relative mb-4" style={{ maxWidth: 400 }}>
          <input className="form-control" placeholder="Buscar paciente por nombre o DNI…"
            value={search} onChange={e => { setSearch(e.target.value); setSelPacId(null); setPaciente(null); }} />
          {searchList.length > 0 && (
            <ul className="list-group position-absolute z-3"
              style={{ top: "100%", left: 0, right: 0, maxHeight: 200, overflowY: "auto" }}>
              {searchList.map(p => (
                <li key={p.id} className="list-group-item list-group-item-action py-1"
                  style={{ cursor: "pointer" }}
                  onClick={() => { setSelPacId(p.id); setSearch(`${p.apellidos}, ${p.nombres}`); setSearchList([]); }}>
                  {p.apellidos}, {p.nombres} — DNI {p.dni}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loading && (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border spinner-border-sm me-2" />Cargando…
        </div>
      )}

      {!loading && !paciente && selPacId && (
        <div className="alert alert-warning">Paciente no encontrado.</div>
      )}

      {!loading && !selPacId && !paciente_id && (
        <div className="text-muted text-center py-5">Busca un paciente para ver su historia clínica.</div>
      )}

      {paciente && (
        <>
          {/* Tarjeta del paciente */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <div className="row align-items-start">
                <div className="col-auto">
                  <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold"
                    style={{ width: 56, height: 56, fontSize: "1.3rem" }}>
                    {paciente.nombres?.[0]}{paciente.apellidos?.[0]}
                  </div>
                </div>
                <div className="col">
                  <h5 className="mb-1">{paciente.apellidos}, {paciente.nombres}</h5>
                  <div className="d-flex flex-wrap gap-3 text-muted small">
                    {paciente.dni && <span>DNI: {paciente.dni}</span>}
                    {paciente.fecha_nacimiento && <span>{dayjs(paciente.fecha_nacimiento).format("DD/MM/YYYY")} — {edad}</span>}
                    {paciente.sexo && <span>Sexo: {paciente.sexo}</span>}
                    {paciente.telefono && <span>📞 {paciente.telefono}</span>}
                    {paciente.email && <span>✉ {paciente.email}</span>}
                  </div>
                </div>
              </div>

              {/* Alergias */}
              {alergias.length > 0 && (
                <div className="mt-3 pt-3 border-top">
                  <div className="small fw-semibold text-danger mb-1">⚠ Alergias conocidas:</div>
                  <div className="d-flex flex-wrap gap-1">
                    {alergias.map(a => (
                      <span key={a.id} className={`badge bg-${SEV_COLOR[a.severidad] || "secondary"}`}>
                        {a.agente} — {a.severidad}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Antecedentes resumen */}
              {Object.keys(antByTipo).length > 0 && (
                <div className="mt-3 pt-3 border-top">
                  <div className="small fw-semibold text-muted mb-1">Antecedentes:</div>
                  <div className="row g-2">
                    {Object.entries(antByTipo).map(([tipo, items]) => (
                      <div key={tipo} className="col-md-4">
                        <div className="small text-uppercase text-muted mb-1">{tipo}</div>
                        {items.map(a => (
                          <div key={a.id} className="small text-body">• {a.descripcion}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline de consultas */}
          <h6 className="text-muted mb-3">Historial de Consultas ({historias.length})</h6>

          {historias.length === 0 && (
            <div className="text-center py-4 text-muted">
              No hay consultas registradas.
              <br />
              <Link to={`/consulta?paciente_id=${paciente.id}`} className="btn btn-outline-primary btn-sm mt-2">
                Abrir primera consulta
              </Link>
            </div>
          )}

          <div className="timeline">
            {historias.map((h, i) => {
              const det = detalle[h.id];
              const expanded = expandId === h.id;
              const vitals = h.objetivo
                ? (typeof h.objetivo === "string" ? JSON.parse(h.objetivo) : h.objetivo)
                : {};

              return (
                <div key={h.id} className="d-flex gap-3 mb-3">
                  {/* Línea de tiempo */}
                  <div className="d-flex flex-column align-items-center" style={{ minWidth: 24 }}>
                    <div className={`rounded-circle border border-2 ${h.estado === "FIRMADA" ? "border-success bg-success" : "border-warning bg-warning"}`}
                      style={{ width: 12, height: 12, marginTop: 6, flexShrink: 0 }} />
                    {i < historias.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: "#dee2e6", minHeight: 40 }} />
                    )}
                  </div>

                  {/* Tarjeta de consulta */}
                  <div className="card border-0 shadow-sm flex-grow-1 mb-2">
                    <div className="card-body py-2">
                      <div className="d-flex justify-content-between align-items-start flex-wrap gap-1">
                        <div>
                          <span className={`badge bg-${ESTADO_BADGE[h.estado]?.split(" ")[0]} ${ESTADO_BADGE[h.estado]?.split(" ")[1] || ""} me-2`}>
                            {h.estado}
                          </span>
                          <strong className="small">Dr. {h.med_apellidos}, {h.med_nombres}</strong>
                          {h.especialidad && <span className="text-muted small ms-1">({h.especialidad})</span>}
                        </div>
                        <small className="text-muted">{dayjs(h.creado_en).format("DD/MM/YYYY HH:mm")}</small>
                      </div>

                      {h.diagnostico_cie && (
                        <div className="small mt-1">
                          <span className="badge bg-light text-dark border me-1">CIE: {h.diagnostico_cie}</span>
                          {h.plan && <span className="text-muted">{h.plan.substring(0, 80)}{h.plan.length > 80 ? "…" : ""}</span>}
                        </div>
                      )}
                      {h.subjetivo && !h.diagnostico_cie && (
                        <div className="small text-muted mt-1">
                          {h.subjetivo.substring(0, 100)}{h.subjetivo.length > 100 ? "…" : ""}
                        </div>
                      )}

                      {/* Signos vitales resumidos */}
                      {(vitals.pa || vitals.fc || vitals.temp) && (
                        <div className="d-flex flex-wrap gap-2 mt-1">
                          {vitals.pa    && <small className="text-muted">P.A. {vitals.pa} mmHg</small>}
                          {vitals.fc    && <small className="text-muted">· FC {vitals.fc} bpm</small>}
                          {vitals.temp  && <small className="text-muted">· T {vitals.temp}°C</small>}
                          {vitals.peso  && <small className="text-muted">· Peso {vitals.peso} kg</small>}
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="d-flex gap-2 mt-2">
                        <button className="btn btn-outline-secondary btn-sm"
                          onClick={() => toggleExpand(h.id)}>
                          {expanded ? "Ocultar detalle" : "Ver detalle"}
                        </button>
                        {h.estado === "BORRADOR" && (
                          <Link to={`/consulta?historia_id=${h.id}`} className="btn btn-outline-primary btn-sm">
                            ✏ Editar
                          </Link>
                        )}
                        {h.estado === "FIRMADA" && (
                          <Link to={`/consulta?historia_id=${h.id}`} className="btn btn-link btn-sm p-0">
                            Ver completa
                          </Link>
                        )}
                      </div>

                      {/* Detalle expandido */}
                      {expanded && det && (
                        <div className="border-top mt-2 pt-2">
                          {/* Prescripciones */}
                          {det.prescripciones?.length > 0 && (
                            <div className="mb-2">
                              <div className="small fw-semibold mb-1">💊 Prescripción(es):</div>
                              {det.prescripciones.map(p => (
                                <div key={p.id} className="small text-muted ps-2 mb-1">
                                  <div className="d-flex align-items-center gap-2 mb-1">
                                    <span>Receta #{p.id}</span>
                                    <span className="badge bg-secondary">{p.estado}</span>
                                    <button className="btn btn-outline-primary btn-sm py-0 px-1"
                                      style={{ fontSize: "0.72rem" }}
                                      onClick={() => printRx(p.id)}>
                                      <i className="bi bi-printer me-1"></i>PDF
                                    </button>
                                  </div>
                                  {p.items?.filter(Boolean).map((it, i) => (
                                    <div key={i} className="ps-2">• {it.medicamento_nombre || it.medicamento_texto}{it.dosis ? ` — ${it.dosis}` : ""}</div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Estudios */}
                          {det.estudios?.length > 0 && (
                            <div className="mb-2">
                              <div className="small fw-semibold mb-1">🧪 Estudios solicitados:</div>
                              {det.estudios.map(s => (
                                <div key={s.id} className="small text-muted ps-2">
                                  [{s.tipo}] {s.descripcion} — {s.estado}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Plan completo */}
                          {det.plan && (
                            <div>
                              <div className="small fw-semibold mb-1">Plan:</div>
                              <div className="small text-muted" style={{ whiteSpace: "pre-wrap" }}>{det.plan}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {expanded && !det && (
                        <div className="mt-2 text-muted small">Cargando detalle…</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
