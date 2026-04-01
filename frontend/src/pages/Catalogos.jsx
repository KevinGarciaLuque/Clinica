import { useState, useEffect, useRef } from "react";
import api from "../api/api";

// ═════════════════════════════════════════════════════════════════════
// Página Catálogos: Diagnósticos + Medicamentos
// ═════════════════════════════════════════════════════════════════════
export default function Catalogos() {
  const [tab, setTab] = useState("medicamentos");

  return (
    <div className="container-fluid py-3">
      <h4 className="fw-bold mb-3">
        <i className="bi bi-journal-bookmark-fill text-primary me-2"></i>
        Catálogos
      </h4>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === "medicamentos" ? "active" : ""}`}
            onClick={() => setTab("medicamentos")}>
            💊 Medicamentos
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "diagnosticos" ? "active" : ""}`}
            onClick={() => setTab("diagnosticos")}>
            🩺 Diagnósticos
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "estudios" ? "active" : ""}`}
            onClick={() => setTab("estudios")}>
            🧪 Estudios
          </button>
        </li>
      </ul>

      {tab === "medicamentos" && <CatalogoMedicamentos />}
      {tab === "diagnosticos" && <CatalogoDiagnosticos />}
      {tab === "estudios" && <CatalogoEstudios />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Tab: Catálogo de Medicamentos
// ═════════════════════════════════════════════════════════════════════
function CatalogoMedicamentos() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyMed());
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [page, setPage] = useState(1);

  function emptyMed() {
    return {
      nombre_generico: "", nombre_comercial: "", presentacion: "",
      via_administracion: "Oral", contraindicaciones: "",
      dosis_default: "", duracion_default: "", cantidad_default: "", instrucciones_default: "",
    };
  }

  const cargar = () => {
    api.get("/medicamentos", { params: { q, page } })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  };

  useEffect(() => { cargar(); }, [q, page]);

  const abrirNuevo = () => {
    setForm(emptyMed());
    setEditId(null);
    setShowForm(true);
    setAlert(null);
  };

  const abrirEditar = (m) => {
    setForm({
      nombre_generico: m.nombre_generico || "",
      nombre_comercial: m.nombre_comercial || "",
      presentacion: m.presentacion || "",
      via_administracion: m.via_administracion || "Oral",
      contraindicaciones: m.contraindicaciones || "",
      dosis_default: m.dosis_default || "",
      duracion_default: m.duracion_default || "",
      cantidad_default: m.cantidad_default || "",
      instrucciones_default: m.instrucciones_default || "",
    });
    setEditId(m.id);
    setShowForm(true);
    setAlert(null);
  };

  const guardar = async () => {
    if (!form.nombre_generico) { setAlert({ t: "danger", m: "Nombre genérico es obligatorio" }); return; }
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/medicamentos/${editId}`, form);
        setAlert({ t: "success", m: "Medicamento actualizado" });
      } else {
        await api.post("/medicamentos", form);
        setAlert({ t: "success", m: "Medicamento creado" });
      }
      setShowForm(false);
      cargar();
    } catch (e) {
      setAlert({ t: "danger", m: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (id) => {
    await api.delete(`/medicamentos/${id}`);
    cargar();
  };

  return (
    <div>
      {alert && (
        <div className={`alert alert-${alert.t} py-2 alert-dismissible`}>
          {alert.m} <button className="btn-close" onClick={() => setAlert(null)} />
        </div>
      )}

      <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
        <div className="position-relative" style={{ flex: 1, maxWidth: 350 }}>
          <i className="bi bi-search position-absolute" style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input className="form-control form-control-sm ps-5" placeholder="Buscar medicamento…"
            value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        </div>
        <button className="btn btn-primary btn-sm ms-auto" onClick={abrirNuevo}>
          <i className="bi bi-plus-circle me-1"></i>Nuevo Medicamento
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="card border-primary shadow-sm mb-3">
          <div className="card-header bg-primary bg-opacity-10 fw-semibold d-flex justify-content-between">
            <span>{editId ? "Editar Medicamento" : "Nuevo Medicamento"}</span>
            <button className="btn-close" onClick={() => setShowForm(false)} />
          </div>
          <div className="card-body row g-2">
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Nombre Genérico *</label>
              <input className="form-control form-control-sm" value={form.nombre_generico}
                onChange={e => setForm(f => ({ ...f, nombre_generico: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Nombre Comercial</label>
              <input className="form-control form-control-sm" value={form.nombre_comercial}
                onChange={e => setForm(f => ({ ...f, nombre_comercial: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Presentación</label>
              <input className="form-control form-control-sm" placeholder="Tableta 500mg"
                value={form.presentacion}
                onChange={e => setForm(f => ({ ...f, presentacion: e.target.value }))} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Vía Administración</label>
              <select className="form-select form-select-sm" value={form.via_administracion}
                onChange={e => setForm(f => ({ ...f, via_administracion: e.target.value }))}>
                {["Oral", "IV", "IM", "IV / IM", "Tópico", "Inhalado", "Subcutáneo", "Rectal", "Oftálmico", "Ótico", "Nasal"].map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="col-md-9">
              <label className="form-label small fw-semibold">Contraindicaciones</label>
              <input className="form-control form-control-sm" value={form.contraindicaciones}
                onChange={e => setForm(f => ({ ...f, contraindicaciones: e.target.value }))} />
            </div>

            <div className="col-12">
              <hr className="my-2" />
              <p className="text-muted small mb-2 fw-semibold">
                <i className="bi bi-lightning-fill text-warning me-1"></i>
                Valores por defecto para prescripción (se auto-llenan al seleccionar este medicamento)
              </p>
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Dosis</label>
              <input className="form-control form-control-sm" placeholder="500mg c/8h"
                value={form.dosis_default}
                onChange={e => setForm(f => ({ ...f, dosis_default: e.target.value }))} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Duración</label>
              <input className="form-control form-control-sm" placeholder="7 días"
                value={form.duracion_default}
                onChange={e => setForm(f => ({ ...f, duracion_default: e.target.value }))} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Cantidad</label>
              <input className="form-control form-control-sm" placeholder="21 tabletas"
                value={form.cantidad_default}
                onChange={e => setForm(f => ({ ...f, cantidad_default: e.target.value }))} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Instrucciones</label>
              <input className="form-control form-control-sm" placeholder="Tomar con alimentos"
                value={form.instrucciones_default}
                onChange={e => setForm(f => ({ ...f, instrucciones_default: e.target.value }))} />
            </div>

            <div className="col-12 d-flex gap-2 mt-2">
              <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
                {saving ? "Guardando…" : editId ? "Actualizar" : "Crear"}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de medicamentos */}
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Medicamento</th>
              <th>Presentación</th>
              <th>Vía</th>
              <th>Dosis Default</th>
              <th>Duración</th>
              <th>Cantidad</th>
              <th>Instrucciones</th>
              <th style={{ width: 120 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map(m => (
              <tr key={m.id}>
                <td>
                  <div className="fw-semibold">{m.nombre_generico}</div>
                  {m.nombre_comercial && <small className="text-muted">{m.nombre_comercial}</small>}
                </td>
                <td><small>{m.presentacion || "—"}</small></td>
                <td><small>{m.via_administracion || "—"}</small></td>
                <td><small>{m.dosis_default || <span className="text-muted">—</span>}</small></td>
                <td><small>{m.duracion_default || <span className="text-muted">—</span>}</small></td>
                <td><small>{m.cantidad_default || <span className="text-muted">—</span>}</small></td>
                <td><small>{m.instrucciones_default || <span className="text-muted">—</span>}</small></td>
                <td>
                  <div className="d-flex gap-1">
                    <button className="btn btn-outline-primary btn-sm" title="Editar"
                      onClick={() => abrirEditar(m)}>
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button className="btn btn-outline-danger btn-sm" title="Desactivar"
                      onClick={() => toggleActivo(m.id)}>
                      <i className="bi bi-trash3"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted py-4">Sin medicamentos encontrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="d-flex gap-2">
        {page > 1 && (
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setPage(p => p - 1)}>← Anterior</button>
        )}
        {list.length === 30 && (
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setPage(p => p + 1)}>Siguiente →</button>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Tab: Catálogo de Diagnósticos
// ═════════════════════════════════════════════════════════════════════
function CatalogoDiagnosticos() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyDx());
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [cie10List, setCie10List] = useState([]);
  const searchRef = useRef(null);

  function emptyDx() {
    return {
      nombre: "", codigo_cie: "", descripcion_cie: "", diagnosticos_secundarios: [],
    };
  }

  const cargar = () => {
    api.get("/catalogos-diagnostico", { params: { q } })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  };

  useEffect(() => { cargar(); }, [q]);

  // Búsqueda CIE-10
  useEffect(() => {
    const val = form.codigo_cie;
    if (!val || val.length < 2) { setCie10List([]); return; }
    const t = setTimeout(() => {
      api.get("/historias/cie10/buscar", { params: { q: val } })
        .then(r => setCie10List(r.data.data || []))
        .catch(() => setCie10List([]));
    }, 300);
    return () => clearTimeout(t);
  }, [form.codigo_cie]);

  const selCie = (item) => {
    setForm(f => ({ ...f, codigo_cie: item.codigo, descripcion_cie: item.descripcion }));
    setCie10List([]);
  };

  const abrirNuevo = () => {
    setForm(emptyDx());
    setEditId(null);
    setShowForm(true);
    setAlert(null);
  };

  const abrirEditar = (d) => {
    let secArr = d.diagnosticos_secundarios;
    if (typeof secArr === "string") {
      try { secArr = JSON.parse(secArr); } catch { secArr = []; }
    }
    setForm({
      nombre: d.nombre || "",
      codigo_cie: d.codigo_cie || "",
      descripcion_cie: d.descripcion_cie || "",
      diagnosticos_secundarios: secArr || [],
    });
    setEditId(d.id);
    setShowForm(true);
    setAlert(null);
  };

  const addDxSec = () => {
    setForm(f => ({
      ...f,
      diagnosticos_secundarios: [...f.diagnosticos_secundarios, { cie: "", descripcion: "" }],
    }));
  };

  const remDxSec = (i) => {
    setForm(f => ({
      ...f,
      diagnosticos_secundarios: f.diagnosticos_secundarios.filter((_, idx) => idx !== i),
    }));
  };

  const guardar = async () => {
    if (!form.nombre || !form.codigo_cie || !form.descripcion_cie) {
      setAlert({ t: "danger", m: "Nombre, código CIE y descripción son obligatorios" });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/catalogos-diagnostico/${editId}`, form);
        setAlert({ t: "success", m: "Diagnóstico actualizado" });
      } else {
        await api.post("/catalogos-diagnostico", form);
        setAlert({ t: "success", m: "Diagnóstico creado" });
      }
      setShowForm(false);
      cargar();
    } catch (e) {
      setAlert({ t: "danger", m: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (id) => {
    await api.delete(`/catalogos-diagnostico/${id}`);
    cargar();
  };

  return (
    <div>
      {alert && (
        <div className={`alert alert-${alert.t} py-2 alert-dismissible`}>
          {alert.m} <button className="btn-close" onClick={() => setAlert(null)} />
        </div>
      )}

      <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
        <div className="position-relative" style={{ flex: 1, maxWidth: 350 }}>
          <i className="bi bi-search position-absolute" style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input className="form-control form-control-sm ps-5" placeholder="Buscar diagnóstico…"
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm ms-auto" onClick={abrirNuevo}>
          <i className="bi bi-plus-circle me-1"></i>Nuevo Diagnóstico
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card border-primary shadow-sm mb-3">
          <div className="card-header bg-primary bg-opacity-10 fw-semibold d-flex justify-content-between">
            <span>{editId ? "Editar Diagnóstico" : "Nuevo Diagnóstico"}</span>
            <button className="btn-close" onClick={() => setShowForm(false)} />
          </div>
          <div className="card-body row g-2">
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Nombre del catálogo *</label>
              <input className="form-control form-control-sm" placeholder="Ej: Faringitis aguda"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="col-md-6 position-relative" ref={searchRef}>
              <label className="form-label small fw-semibold">Código CIE-10 *</label>
              <div className="input-group input-group-sm">
                <input className="form-control" placeholder="Buscar código o descripción…"
                  value={form.codigo_cie}
                  onChange={e => setForm(f => ({ ...f, codigo_cie: e.target.value, descripcion_cie: "" }))} />
                {form.descripcion_cie && (
                  <span className="input-group-text text-success" style={{ fontSize: "0.78rem" }}>
                    {form.descripcion_cie}
                  </span>
                )}
              </div>
              {cie10List.length > 0 && (
                <ul className="list-group position-absolute z-3"
                  style={{ top: "100%", left: 0, right: 0, maxHeight: 200, overflowY: "auto" }}>
                  {cie10List.map(c => (
                    <li key={c.codigo} className="list-group-item list-group-item-action py-1"
                      style={{ cursor: "pointer", fontSize: "0.82rem" }}
                      onClick={() => selCie(c)}>
                      <strong>{c.codigo}</strong> — {c.descripcion}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Diagnósticos secundarios */}
            <div className="col-12">
              <label className="form-label small fw-semibold">Diagnósticos Secundarios</label>
              {form.diagnosticos_secundarios.map((dx, i) => (
                <div key={i} className="d-flex gap-2 mb-2">
                  <input className="form-control form-control-sm" placeholder="Código CIE" style={{ maxWidth: 120 }}
                    value={dx.cie}
                    onChange={e => setForm(f => ({
                      ...f,
                      diagnosticos_secundarios: f.diagnosticos_secundarios.map((d, j) =>
                        j === i ? { ...d, cie: e.target.value } : d
                      ),
                    }))} />
                  <input className="form-control form-control-sm" placeholder="Descripción"
                    value={dx.descripcion}
                    onChange={e => setForm(f => ({
                      ...f,
                      diagnosticos_secundarios: f.diagnosticos_secundarios.map((d, j) =>
                        j === i ? { ...d, descripcion: e.target.value } : d
                      ),
                    }))} />
                  <button className="btn btn-outline-danger btn-sm" onClick={() => remDxSec(i)}>✕</button>
                </div>
              ))}
              <button className="btn btn-link btn-sm p-0" onClick={addDxSec}>+ Diagnóstico secundario</button>
            </div>

            <div className="col-12 d-flex gap-2 mt-2">
              <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
                {saving ? "Guardando…" : editId ? "Actualizar" : "Crear"}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Nombre</th>
              <th>CIE-10</th>
              <th>Descripción</th>
              <th>Dx Secundarios</th>
              <th style={{ width: 120 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map(d => {
              let sec = d.diagnosticos_secundarios;
              if (typeof sec === "string") { try { sec = JSON.parse(sec); } catch { sec = []; } }
              return (
                <tr key={d.id}>
                  <td className="fw-semibold">{d.nombre}</td>
                  <td><span className="badge bg-info text-dark">{d.codigo_cie}</span></td>
                  <td><small>{d.descripcion_cie}</small></td>
                  <td>
                    {(sec || []).length > 0
                      ? (sec || []).map((s, i) => (
                          <span key={i} className="badge bg-light text-dark border me-1" style={{ fontSize: "0.72rem" }}>
                            {s.cie}: {s.descripcion}
                          </span>
                        ))
                      : <span className="text-muted">—</span>
                    }
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <button className="btn btn-outline-primary btn-sm" title="Editar"
                        onClick={() => abrirEditar(d)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-outline-danger btn-sm" title="Desactivar"
                        onClick={() => toggleActivo(d.id)}>
                        <i className="bi bi-trash3"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">Sin diagnósticos en catálogo.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Tab: Catálogo de Estudios / Exámenes
// ═════════════════════════════════════════════════════════════════════
const CATEGORIAS = ["LABORATORIO", "IMAGENOLOGIA", "OTRO"];

function CatalogoEstudios() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [catFiltro, setCatFiltro] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyEst());
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  function emptyEst() {
    return { nombre: "", categoria: "LABORATORIO", descripcion: "" };
  }

  const cargar = () => {
    const params = { q };
    if (catFiltro) params.categoria = catFiltro;
    api.get("/catalogos-estudios", { params })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  };

  useEffect(() => { cargar(); }, [q, catFiltro]);

  const abrirNuevo = () => {
    setForm(emptyEst());
    setEditId(null);
    setShowForm(true);
    setAlert(null);
  };

  const abrirEditar = (e) => {
    setForm({
      nombre: e.nombre || "",
      categoria: e.categoria || "LABORATORIO",
      descripcion: e.descripcion || "",
    });
    setEditId(e.id);
    setShowForm(true);
    setAlert(null);
  };

  const guardar = async () => {
    if (!form.nombre) { setAlert({ t: "danger", m: "El nombre es obligatorio" }); return; }
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/catalogos-estudios/${editId}`, form);
        setAlert({ t: "success", m: "Estudio actualizado" });
      } else {
        await api.post("/catalogos-estudios", form);
        setAlert({ t: "success", m: "Estudio creado" });
      }
      setShowForm(false);
      cargar();
    } catch (e) {
      setAlert({ t: "danger", m: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (id) => {
    await api.delete(`/catalogos-estudios/${id}`);
    cargar();
  };

  const catBadge = (cat) => {
    if (cat === "LABORATORIO") return "bg-primary";
    if (cat === "IMAGENOLOGIA") return "bg-info text-dark";
    return "bg-secondary";
  };

  return (
    <div>
      {alert && (
        <div className={`alert alert-${alert.t} py-2 alert-dismissible`}>
          {alert.m} <button className="btn-close" onClick={() => setAlert(null)} />
        </div>
      )}

      <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
        <div className="position-relative" style={{ flex: 1, maxWidth: 350 }}>
          <i className="bi bi-search position-absolute" style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input className="form-control form-control-sm ps-5" placeholder="Buscar estudio…"
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="form-select form-select-sm" style={{ maxWidth: 180 }}
          value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn btn-primary btn-sm ms-auto" onClick={abrirNuevo}>
          <i className="bi bi-plus-circle me-1"></i>Nuevo Estudio
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card border-primary shadow-sm mb-3">
          <div className="card-header bg-primary bg-opacity-10 fw-semibold d-flex justify-content-between">
            <span>{editId ? "Editar Estudio" : "Nuevo Estudio"}</span>
            <button className="btn-close" onClick={() => setShowForm(false)} />
          </div>
          <div className="card-body row g-2">
            <div className="col-md-5">
              <label className="form-label small fw-semibold">Nombre del estudio *</label>
              <input className="form-control form-control-sm"
                placeholder="Ej: Hemograma completo, Radiografía de tórax…"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Categoría</label>
              <select className="form-select form-select-sm" value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Descripción / Indicaciones</label>
              <input className="form-control form-control-sm"
                placeholder="Indicaciones por defecto…"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className="col-12 d-flex gap-2 mt-2">
              <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
                {saving ? "Guardando…" : editId ? "Actualizar" : "Crear"}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Nombre del Estudio</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th style={{ width: 120 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map(e => (
              <tr key={e.id}>
                <td className="fw-semibold">{e.nombre}</td>
                <td><span className={`badge ${catBadge(e.categoria)}`}>{e.categoria}</span></td>
                <td><small>{e.descripcion || <span className="text-muted">—</span>}</small></td>
                <td>
                  <div className="d-flex gap-1">
                    <button className="btn btn-outline-primary btn-sm" title="Editar"
                      onClick={() => abrirEditar(e)}>
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button className="btn btn-outline-danger btn-sm" title="Desactivar"
                      onClick={() => toggleActivo(e.id)}>
                      <i className="bi bi-trash3"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted py-4">Sin estudios en catálogo.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
