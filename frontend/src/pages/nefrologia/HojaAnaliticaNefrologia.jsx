import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../api/api";

const COLOR = "#0891b2";
const COLOR_D = "#0e7490";
const BG_LIGHT = "#ecfeff";
const BORDER = "#a5f3fc";

const CAMPOS_ENCABEZADO = [
  { key: "peso",     label: "Peso" },
  { key: "talla",    label: "Talla" },
  { key: "sc",       label: "SC" },
  { key: "dialisis", label: "Diálisis" },
  { key: "tr",       label: "TR" },
];

export default function HojaAnaliticaNefrologia() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pacienteId = searchParams.get("paciente_id");

  const [paciente, setPaciente] = useState(null);
  const [parametros, setParametros] = useState([]);
  const [columnas, setColumnas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [gestionOpen, setGestionOpen] = useState(false);
  const [nuevoParam, setNuevoParam] = useState({ categoria: "", nombre: "", unidad: "" });
  const [editParamId, setEditParamId] = useState(null);
  const [editParamValor, setEditParamValor] = useState({ categoria: "", nombre: "", unidad: "" });

  const [modalColumna, setModalColumna] = useState(null); // { id?, fecha, encabezado }

  // ── Buscador de paciente (cuando se entra sin paciente_id) ─────────────────
  const [buscarQ, setBuscarQ] = useState("");
  const [buscarResultados, setBuscarResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (pacienteId) return;
    const q = buscarQ.trim();
    if (q.length < 2) { setBuscarResultados([]); setBuscando(false); return; }
    setBuscando(true);
    const t = setTimeout(() => {
      api.get("/pacientes", { params: { q, limit: 10 } })
        .then(r => setBuscarResultados(r.data.data || []))
        .catch(() => setBuscarResultados([]))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [buscarQ, pacienteId]);

  const flash = useCallback((text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 2500);
  }, []);

  const cargar = useCallback(async () => {
    if (!pacienteId) return;
    setLoading(true);
    try {
      const [pacRes, paramRes, hojaRes] = await Promise.allSettled([
        api.get(`/pacientes/${pacienteId}`),
        api.get("/nefrologia/parametros"),
        api.get("/nefrologia/hoja-analitica", { params: { paciente_id: pacienteId } }),
      ]);
      if (pacRes.status === "fulfilled") setPaciente(pacRes.value.data.data || pacRes.value.data);
      if (paramRes.status === "fulfilled") setParametros(paramRes.value.data.data || []);
      if (hojaRes.status === "fulfilled") setColumnas(hojaRes.value.data.data || []);
    } catch {
      flash("No se pudo cargar la hoja analítica", "error");
    } finally {
      setLoading(false);
    }
  }, [pacienteId, flash]);

  useEffect(() => { cargar(); }, [cargar]);

  const categorias = useMemo(() => {
    const grupos = new Map();
    for (const p of parametros) {
      if (!grupos.has(p.categoria)) grupos.set(p.categoria, []);
      grupos.get(p.categoria).push(p);
    }
    return Array.from(grupos.entries());
  }, [parametros]);

  // ── Celdas de valores ──────────────────────────────────────────────────────
  const guardarValor = async (columna, parametroId, valor) => {
    const nuevosValores = { ...(columna.valores || {}), [parametroId]: valor };
    setColumnas(cols => cols.map(c => c.id === columna.id ? { ...c, valores: nuevosValores } : c));
    try {
      await api.put(`/nefrologia/hoja-analitica/${columna.id}`, { valores: nuevosValores });
    } catch {
      flash("No se pudo guardar el valor", "error");
    }
  };

  // ── Columnas (fechas) ───────────────────────────────────────────────────────
  const abrirNuevaColumna = () => {
    setModalColumna({ fecha: dayjs().format("YYYY-MM-DD"), encabezado: {} });
  };
  const abrirEditarColumna = (col) => {
    setModalColumna({ id: col.id, fecha: col.fecha?.split("T")[0], encabezado: col.encabezado || {} });
  };
  const guardarColumna = async () => {
    if (!modalColumna.fecha) return flash("La fecha es obligatoria", "error");
    try {
      if (modalColumna.id) {
        await api.put(`/nefrologia/hoja-analitica/${modalColumna.id}`, {
          fecha: modalColumna.fecha, encabezado: modalColumna.encabezado,
        });
      } else {
        await api.post("/nefrologia/hoja-analitica", {
          paciente_id: pacienteId, fecha: modalColumna.fecha, encabezado: modalColumna.encabezado, valores: {},
        });
      }
      setModalColumna(null);
      cargar();
      flash("Visita guardada");
    } catch {
      flash("No se pudo guardar la visita", "error");
    }
  };
  const eliminarColumna = async (col) => {
    if (!window.confirm(`¿Eliminar la columna del ${dayjs(col.fecha).format("DD/MM/YYYY")}? Se perderán todos sus valores.`)) return;
    try {
      await api.delete(`/nefrologia/hoja-analitica/${col.id}`);
      cargar();
      flash("Columna eliminada");
    } catch {
      flash("No se pudo eliminar", "error");
    }
  };

  // ── Catálogo de parámetros (dinámico) ───────────────────────────────────────
  const agregarParametro = async () => {
    if (!nuevoParam.nombre.trim()) return;
    try {
      await api.post("/nefrologia/parametros", nuevoParam);
      setNuevoParam({ categoria: nuevoParam.categoria, nombre: "", unidad: "" });
      cargar();
    } catch {
      flash("No se pudo agregar el parámetro", "error");
    }
  };
  const guardarEdicionParametro = async (id) => {
    try {
      await api.put(`/nefrologia/parametros/${id}`, editParamValor);
      setEditParamId(null);
      cargar();
    } catch {
      flash("No se pudo actualizar el parámetro", "error");
    }
  };
  const moverParametro = async (id, direccion) => {
    try {
      await api.put(`/nefrologia/parametros/${id}/mover`, { direccion });
      cargar();
    } catch {
      flash("No se pudo reordenar", "error");
    }
  };
  const eliminarParametro = async (id) => {
    if (!window.confirm("¿Quitar este parámetro de la hoja? No se borran los valores ya capturados.")) return;
    try {
      await api.delete(`/nefrologia/parametros/${id}`);
      cargar();
    } catch {
      flash("No se pudo eliminar", "error");
    }
  };

  if (!pacienteId) {
    return (
      <div style={{ padding: "clamp(16px, 4vw, 40px)", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 34 }}>🧪</div>
          <h4 style={{ color: COLOR_D, margin: "6px 0 2px" }}>Hoja Analítica — Nefrología</h4>
          <div style={{ color: "#64748b", fontSize: 14 }}>Busca un paciente para ver o registrar sus resultados de laboratorio</div>
        </div>

        <div style={{
          background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 1px 4px rgba(15,23,42,.06)",
        }}>
          <i className="bi bi-search" style={{ color: "#94a3b8" }} />
          <input
            autoFocus
            className="form-control border-0"
            style={{ boxShadow: "none", padding: 0, fontSize: 15 }}
            placeholder="Buscar por nombre, apellido o expediente…"
            value={buscarQ}
            onChange={e => setBuscarQ(e.target.value)}
          />
          {buscando && <span className="spinner-border spinner-border-sm text-secondary" />}
        </div>

        <div style={{ marginTop: 10 }}>
          {buscarQ.trim().length >= 2 && !buscando && buscarResultados.length === 0 && (
            <div className="text-center text-muted py-4" style={{ fontSize: 14 }}>
              No se encontraron pacientes con "{buscarQ.trim()}"
            </div>
          )}
          {buscarResultados.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/nefrologia/hoja-analitica?paciente_id=${p.id}`)}
              style={{
                background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10,
                padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center",
                gap: 12, cursor: "pointer", transition: "background .12s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.background = BG_LIGHT}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
            >
              <div style={{
                width: 38, height: 38, borderRadius: "50%", background: COLOR, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {p.nombres?.[0]}{p.apellidos?.[0]}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "#1e293b" }}>{p.nombres} {p.apellidos}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {p.expediente ? `Expediente ${p.expediente}` : p.dni ? `DNI ${p.dni}` : `ID ${p.id}`}
                  {p.fecha_nacimiento ? ` · ${dayjs().diff(dayjs(p.fecha_nacimiento), "year")} años` : ""}
                </div>
              </div>
              <i className="bi bi-chevron-right ms-auto" style={{ color: "#cbd5e1" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="hoja-nefro-page" style={{ padding: "clamp(10px, 2vw, 20px)", maxWidth: 1600, margin: "0 auto" }}>
      <style>{`
        .hoja-nefro-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .hoja-nefro-grid { grid-template-columns: 1fr; }
        }
        .hoja-nefro-card {
          background: #fff;
          border: 1px solid ${BORDER};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(15,23,42,.06);
          transition: box-shadow .15s ease, transform .15s ease;
        }
        .hoja-nefro-card:hover {
          box-shadow: 0 6px 18px rgba(8,145,178,.14);
          transform: translateY(-1px);
        }
        .hoja-nefro-card .card-head {
          background: linear-gradient(135deg, ${COLOR} 0%, ${COLOR_D} 100%);
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: .02em;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .hoja-nefro-card .card-head .count {
          font-weight: 500;
          font-size: 11px;
          opacity: .85;
          background: rgba(255,255,255,.18);
          border-radius: 999px;
          padding: 2px 8px;
        }
        .hoja-nefro-card table { margin-bottom: 0; font-size: 13px; }
        .hoja-nefro-card table thead th {
          background: #f8fafc;
          color: #475569;
          font-weight: 600;
          font-size: 11.5px;
          vertical-align: middle;
          border-bottom-width: 1px;
        }
        .hoja-nefro-card table tbody tr:nth-child(even) { background: #f9fdfe; }
        .hoja-nefro-card table tbody tr:hover { background: ${BG_LIGHT}; }
        .hoja-nefro-card table tbody td:first-child {
          color: #1e293b;
          font-weight: 500;
          white-space: nowrap;
        }
        .hoja-nefro-card table input.form-control:focus {
          background: ${BG_LIGHT} !important;
          box-shadow: none;
        }
        .hoja-nefro-card .col-actions {
          display: inline-flex;
          gap: 2px;
          opacity: .55;
          transition: opacity .15s ease;
        }
        .hoja-nefro-card th:hover .col-actions { opacity: 1; }
        @media (max-width: 640px) {
          .hoja-nefro-toolbar { flex-direction: column; align-items: stretch !important; }
          .hoja-nefro-toolbar > div { width: 100%; }
          .hoja-nefro-toolbar button { flex: 1; }
        }
      `}</style>

      {/* ── Encabezado ── */}
      <div className="hoja-nefro-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h4 style={{ color: COLOR_D, margin: 0, fontSize: "clamp(1.05rem, 2.5vw, 1.5rem)" }}>🧪 Hoja Analítica — Nefrología</h4>
          <div style={{ color: "#64748b", fontSize: 14 }}>
            {paciente ? `${paciente.nombres || ""} ${paciente.apellidos || ""}`.trim() : "Cargando paciente..."}
            {paciente?.expediente ? ` · Expediente ${paciente.expediente}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm" style={{ background: BG_LIGHT, border: `1px solid ${BORDER}`, color: COLOR_D }}
            onClick={() => setGestionOpen(v => !v)}>
            ⚙️ {gestionOpen ? "Cerrar gestión" : "Editar parámetros"}
          </button>
          <button className="btn btn-sm text-white" style={{ background: COLOR }} onClick={abrirNuevaColumna}>
            + Nueva fecha
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(-1)}>← Volver</button>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.type === "error" ? "alert-danger" : "alert-success"} py-2`} style={{ fontSize: 13 }}>
          {msg.text}
        </div>
      )}

      {/* ── Gestión dinámica de parámetros ── */}
      {gestionOpen && (
        <div className="card mb-3" style={{ borderColor: BORDER }}>
          <div className="card-body">
            <div className="fw-bold mb-2" style={{ color: COLOR_D }}>Parámetros de la hoja</div>
            <div className="hoja-nefro-grid" style={{ maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
              {categorias.map(([categoria, items]) => (
                <div key={categoria}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{categoria}</div>
                  {items.map((p, idx) => (
                    <div key={p.id} className="d-flex align-items-center gap-2 py-1 flex-wrap">
                      {editParamId === p.id ? (
                        <>
                          <input className="form-control form-control-sm" style={{ width: 120 }}
                            value={editParamValor.categoria}
                            onChange={e => setEditParamValor(v => ({ ...v, categoria: e.target.value }))} placeholder="Categoría" />
                          <input className="form-control form-control-sm" style={{ width: 140 }}
                            value={editParamValor.nombre}
                            onChange={e => setEditParamValor(v => ({ ...v, nombre: e.target.value }))} placeholder="Nombre" />
                          <input className="form-control form-control-sm" style={{ width: 70 }}
                            value={editParamValor.unidad || ""}
                            onChange={e => setEditParamValor(v => ({ ...v, unidad: e.target.value }))} placeholder="Unidad" />
                          <button className="btn btn-sm btn-success" onClick={() => guardarEdicionParametro(p.id)}>✓</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditParamId(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <span style={{ minWidth: 140, flex: 1 }}>{p.nombre}{p.unidad ? ` (${p.unidad})` : ""}</span>
                          <button className="btn btn-sm btn-light" disabled={idx === 0} onClick={() => moverParametro(p.id, "arriba")}>↑</button>
                          <button className="btn btn-sm btn-light" disabled={idx === items.length - 1} onClick={() => moverParametro(p.id, "abajo")}>↓</button>
                          <button className="btn btn-sm btn-light" onClick={() => { setEditParamId(p.id); setEditParamValor({ categoria: p.categoria, nombre: p.nombre, unidad: p.unidad || "" }); }}>✎</button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => eliminarParametro(p.id)}>🗑</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <hr />
            <div className="d-flex gap-2 align-items-end flex-wrap">
              <div>
                <label className="form-label" style={{ fontSize: 12 }}>Categoría</label>
                <input className="form-control form-control-sm" style={{ width: 160 }} list="categorias-existentes"
                  value={nuevoParam.categoria} onChange={e => setNuevoParam(v => ({ ...v, categoria: e.target.value }))} placeholder="Ej. Química Sanguínea" />
                <datalist id="categorias-existentes">
                  {categorias.map(([c]) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 12 }}>Nuevo parámetro</label>
                <input className="form-control form-control-sm" style={{ width: 200 }}
                  value={nuevoParam.nombre} onChange={e => setNuevoParam(v => ({ ...v, nombre: e.target.value }))} placeholder="Nombre del parámetro" />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 12 }}>Unidad (opcional)</label>
                <input className="form-control form-control-sm" style={{ width: 100 }}
                  value={nuevoParam.unidad} onChange={e => setNuevoParam(v => ({ ...v, unidad: e.target.value }))} placeholder="mg/dL" />
              </div>
              <button className="btn btn-sm text-white" style={{ background: COLOR }} onClick={agregarParametro}>+ Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Grid de categorías: 2 columnas en pantallas anchas, 1 en móvil ── */}
      {loading ? (
        <div className="text-center text-muted py-5">Cargando…</div>
      ) : columnas.length === 0 ? (
        <div className="text-center py-5 border rounded" style={{ borderColor: BORDER, background: "#fff" }}>
          <div className="text-muted mb-2">Todavía no hay visitas registradas.</div>
          <button className="btn btn-sm text-white" style={{ background: COLOR }} onClick={abrirNuevaColumna}>
            + Registrar primera visita
          </button>
        </div>
      ) : categorias.length === 0 ? (
        <div className="text-center py-5 border rounded text-muted" style={{ borderColor: BORDER, background: "#fff" }}>
          No hay parámetros configurados todavía. Usa "Editar parámetros" para agregarlos.
        </div>
      ) : (
        <div className="hoja-nefro-grid">
          {categorias.map(([categoria, items]) => (
            <div key={categoria} className="hoja-nefro-card">
              <div className="card-head">
                <span>{categoria}</span>
                <span className="count">{items.length}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table table-sm table-bordered mb-0">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 150 }}>Parámetro</th>
                      {columnas.map(col => (
                        <th key={col.id} style={{ minWidth: 100, textAlign: "center" }}>
                          <div className="d-flex flex-column align-items-center">
                            <span>{dayjs(col.fecha).format("DD/MM/YY")}</span>
                            <div className="col-actions">
                              <button className="btn btn-sm p-0 px-1" title="Editar visita" onClick={() => abrirEditarColumna(col)}>✎</button>
                              <button className="btn btn-sm p-0 px-1 text-danger" title="Eliminar columna" onClick={() => eliminarColumna(col)}>🗑</button>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(p => (
                      <tr key={p.id}>
                        <td>{p.nombre}{p.unidad ? <span className="text-muted"> ({p.unidad})</span> : ""}</td>
                        {columnas.map(col => (
                          <td key={col.id} style={{ padding: 2 }}>
                            <input
                              className="form-control form-control-sm text-center"
                              style={{ border: "none", background: "transparent" }}
                              defaultValue={(col.valores || {})[p.id] ?? ""}
                              onBlur={e => {
                                const val = e.target.value;
                                if (val !== ((col.valores || {})[p.id] ?? "")) guardarValor(col, p.id, val);
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: nueva/editar columna (visita) ── */}
      {modalColumna && (
        <div
          onClick={(e) => e.target === e.currentTarget && setModalColumna(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 10600,
            background: "rgba(15,23,42,.55)", backdropFilter: "blur(2px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, overflowY: "auto",
          }}
        >
          <div style={{
            background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440,
            boxShadow: "0 24px 60px rgba(0,0,0,.3)", overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", borderBottom: `1px solid ${BORDER}`,
            }}>
              <h6 className="mb-0" style={{ color: COLOR_D, fontWeight: 700 }}>
                {modalColumna.id ? "Editar visita" : "Nueva visita"}
              </h6>
              <button className="btn-close" onClick={() => setModalColumna(null)} />
            </div>
            <div style={{ padding: 18 }}>
              <label className="form-label">Fecha</label>
              <input type="date" className="form-control mb-3" value={modalColumna.fecha}
                onChange={e => setModalColumna(m => ({ ...m, fecha: e.target.value }))} />
              <div className="row g-2">
                {CAMPOS_ENCABEZADO.map(c => (
                  <div className="col-6" key={c.key}>
                    <label className="form-label" style={{ fontSize: 12 }}>{c.label}</label>
                    <input className="form-control form-control-sm"
                      value={modalColumna.encabezado?.[c.key] || ""}
                      onChange={e => setModalColumna(m => ({ ...m, encabezado: { ...m.encabezado, [c.key]: e.target.value } }))} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{
              display: "flex", justifyContent: "flex-end", gap: 8,
              padding: "12px 18px", borderTop: `1px solid ${BORDER}`, background: "#f8fafc",
            }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setModalColumna(null)}>Cancelar</button>
              <button className="btn btn-sm text-white" style={{ background: COLOR }} onClick={guardarColumna}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
