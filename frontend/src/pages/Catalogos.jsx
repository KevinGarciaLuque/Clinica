import { useState, useEffect, useRef, useCallback } from "react";
import api from "../api/api";

// ═════════════════════════════════════════════════════════════════════
// Página Catálogos: Diagnósticos + Medicamentos
// ═════════════════════════════════════════════════════════════════════
export default function Catalogos() {
  const [tab, setTab] = useState("medicamentos");

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      {/* ═══ HEADER ═══ */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "16px 24px 0",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-journal-bookmark-fill" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Catálogos</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>Medicamentos, Diagnósticos y Estudios</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { key: "medicamentos", label: "💊 Medicamentos" },
            { key: "diagnosticos", label: "🩺 Diagnósticos" },
            { key: "estudios",     label: "🧪 Estudios" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "7px 20px", fontSize: "0.82rem", fontWeight: 600,
                borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
                background: tab === t.key ? "#fff" : "rgba(255,255,255,.1)",
                color: tab === t.key ? "#1a2744" : "rgba(255,255,255,.75)",
                transition: "background .15s",
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {tab === "medicamentos" && <CatalogoMedicamentos />}
        {tab === "diagnosticos" && <CatalogoDiagnosticos />}
        {tab === "estudios" && <CatalogoEstudios />}
      </div>
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
  const [favSet, setFavSet] = useState(new Set());

  // Cargar IDs favoritos del médico
  useEffect(() => {
    api.get("/medicamentos/favoritos")
      .then(r => setFavSet(new Set(r.data.data || [])))
      .catch(() => {});
  }, []);

  const toggleFav = async (med, e) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/medicamentos/favoritos/${med.id}`);
      setFavSet(prev => {
        const next = new Set(prev);
        res.data.favorito ? next.add(med.id) : next.delete(med.id);
        return next;
      });
      // Reordenar lista localmente
      setList(prev => [...prev].sort((a, b) => {
        const fa = res.data.favorito && b.id === med.id ? 0 : (favSet.has(b.id) ? 1 : -1);
        return fa;
      }));
    } catch {}
  };

  function emptyMed() {
    return {
      nombre_generico: "", nombre_comercial: "", presentacion: "",
      via_administracion: "Oral", contraindicaciones: "",
      dosis_default: "", duracion_default: "", cantidad_default: "", instrucciones_default: "",
    };
  }

  const cargar = () => {
    api.get("/medicamentos", { params: { q, page: 1, limit: 500 } })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  };

  useEffect(() => { cargar(); }, [q]);

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
      {/* Alert */}
      {alert && (
        <div style={{
          marginBottom: 16, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: alert.t === "success" ? "#dcfce7" : "#fee2e2",
          color: alert.t === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${alert.t === "success" ? "#bbf7d0" : "#fecaca"}`,
        }}>
          <span>{alert.m}</span>
          <button onClick={() => setAlert(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}>×</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{
          flex: 1, maxWidth: 350, background: "#fff", borderRadius: 10, padding: "7px 12px",
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #e5e7eb",
        }}>
          <i className="bi bi-search" style={{ color: "#9ca3af", fontSize: "0.85rem" }}></i>
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Buscar medicamento…"
            style={{ border: "none", outline: "none", flex: 1, fontSize: "0.88rem", background: "transparent" }} />
        </div>
        <button onClick={abrirNuevo} style={{
          marginLeft: "auto", background: "#2563eb", border: "none", borderRadius: 8,
          color: "#fff", padding: "7px 16px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <i className="bi bi-plus-circle"></i> Nuevo Medicamento
        </button>
      </div>

      {/* Inline form panel */}
      {showForm && (
        <div style={{
          background: "#fff", border: "1px solid #bfdbfe", borderRadius: 12,
          marginBottom: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.07)",
        }}>
          <div style={{
            background: "#eff6ff", padding: "12px 20px", borderBottom: "1px solid #bfdbfe",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e40af" }}>
              <i className="bi bi-capsule me-2"></i>
              {editId ? "Editar Medicamento" : "Nuevo Medicamento"}
            </span>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280" }}>×</button>
          </div>
          <div className="row g-2" style={{ padding: "16px 20px" }}>
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
              <div style={{ borderTop: "1px solid #e5e7eb", margin: "4px 0 8px" }}></div>
              <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: 0, fontWeight: 600 }}>
                <i className="bi bi-lightning-fill text-warning me-1"></i>
                Valores por defecto para prescripción
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
            <div className="col-12" style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={guardar} disabled={saving} style={{ background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", padding: "7px 18px", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer" }}>
                {saving ? "Guardando…" : editId ? "Actualizar" : "Crear"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 16px", color: "#374151", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <div style={{ overflowY: "auto", maxHeight: 520 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 1 }}>
              <th style={{ width: 32, padding: "10px 8px", borderBottom: "2px solid #e5e7eb", background: "#f8fafc" }}></th>
              {["Medicamento", "Presentación", "Vía", "Dosis Default", "Duración", "Instrucciones", "Acciones"].map(h => (
                <th key={h} style={{
                  padding: "10px 12px", fontSize: "0.73rem", fontWeight: 700,
                  color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                  borderBottom: "2px solid #e5e7eb", textAlign: "left", whiteSpace: "nowrap",
                  background: "#f8fafc",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map(m => {
              const esFav = favSet.has(m.id);
              return (
              <tr key={m.id}
                style={{ borderBottom: "1px solid #f3f4f6", background: esFav ? "#fffbeb" : "transparent" }}
                onMouseEnter={e => { if (!esFav) e.currentTarget.style.background = "#fafafa"; }}
                onMouseLeave={e => { e.currentTarget.style.background = esFav ? "#fffbeb" : "transparent"; }}>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>
                  <button title={esFav ? "Quitar de favoritos" : "Marcar como favorito"}
                    onClick={(e) => toggleFav(m, e)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1 }}>
                    <i className={`bi bi-star${esFav ? "-fill" : ""}`} style={{ color: esFav ? "#f59e0b" : "#d1d5db" }}></i>
                  </button>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#111827" }}>
                    {esFav && <i className="bi bi-star-fill" style={{ color: "#f59e0b", fontSize: "0.65rem", marginRight: 4 }}></i>}
                    {m.nombre_generico}
                  </div>
                  {m.nombre_comercial && <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>{m.nombre_comercial}</div>}
                </td>
                <td style={{ padding: "10px 12px", fontSize: "0.83rem", color: "#374151" }}>{m.presentacion || "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: "0.83rem", color: "#374151" }}>{m.via_administracion || "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: "0.83rem", color: "#374151" }}>{m.dosis_default || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                <td style={{ padding: "10px 12px", fontSize: "0.83rem", color: "#374151" }}>{m.duracion_default || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                <td style={{ padding: "10px 12px", fontSize: "0.83rem", color: m.instrucciones_default ? "#374151" : "#d1d5db", maxWidth: 180 }}>{m.instrucciones_default || "—"}</td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => abrirEditar(m)} title="Editar"
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, color: "#2563eb", padding: "4px 8px", cursor: "pointer" }}>
                      <i className="bi bi-pencil" style={{ fontSize: "0.82rem" }}></i>
                    </button>
                    <button onClick={() => toggleActivo(m.id)} title="Desactivar"
                      style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 7, color: "#e11d48", padding: "4px 8px", cursor: "pointer" }}>
                      <i className="bi bi-trash3" style={{ fontSize: "0.82rem" }}></i>
                    </button>
                  </div>
                </td>
              </tr>
            );})}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: "0.9rem" }}>
                  <i className="bi bi-capsule" style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: 0.3 }}></i>
                  Sin medicamentos encontrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Tab: Catálogo de Diagnósticos
// ═════════════════════════════════════════════════════════════════════
// Colores y etiquetas por especialidad
const ESP_META = {
  PEDIATRIA:            { label: "Pediatría",            color: "#9C27B0", bg: "rgba(156,39,176,.12)",  border: "rgba(156,39,176,.3)"  },
  MEDICINA_GENERAL:     { label: "Medicina General",    color: "#2196f3", bg: "rgba(33,150,243,.12)",  border: "rgba(33,150,243,.3)"  },
  CARDIOLOGIA:          { label: "Cardiología",          color: "#f44336", bg: "rgba(244,67,54,.12)",   border: "rgba(244,67,54,.3)"   },
  NEUROLOGIA:           { label: "Neurología",           color: "#AB47BC", bg: "rgba(171,71,188,.12)",  border: "rgba(171,71,188,.3)"  },
  GINECOLOGIA:          { label: "Ginecología",          color: "#e91e63", bg: "rgba(233,30,99,.12)",   border: "rgba(233,30,99,.3)"   },
  DERMATOLOGIA:         { label: "Dermatología",         color: "#FF5722", bg: "rgba(255,87,34,.12)",   border: "rgba(255,87,34,.3)"   },
  OFTALMOLOGIA:         { label: "Oftalmología",         color: "#00BCD4", bg: "rgba(0,188,212,.12)",   border: "rgba(0,188,212,.3)"   },
  TRAUMATOLOGIA:        { label: "Traumatología",        color: "#607D8B", bg: "rgba(96,125,139,.12)",  border: "rgba(96,125,139,.3)"  },
  NUTRICION:            { label: "Nutrición",            color: "#4CAF50", bg: "rgba(76,175,80,.12)",   border: "rgba(76,175,80,.3)"   },
  PSICOLOGIA:           { label: "Psicología",           color: "#673AB7", bg: "rgba(103,58,183,.12)",  border: "rgba(103,58,183,.3)"  },
  ENDOCRINOLOGIA:       { label: "Endocrinología",       color: "#FF7043", bg: "rgba(255,112,67,.12)",  border: "rgba(255,112,67,.3)"  },
  GASTROENTEROLOGIA:    { label: "Gastroenterología",    color: "#8D6E63", bg: "rgba(141,110,99,.12)",  border: "rgba(141,110,99,.3)"  },
  INMUNOLOGIA:          { label: "Inmunología",          color: "#26C6DA", bg: "rgba(38,198,218,.12)",  border: "rgba(38,198,218,.3)"  },
  NEFROLOGIA:           { label: "Nefrología",           color: "#42A5F5", bg: "rgba(66,165,245,.12)",  border: "rgba(66,165,245,.3)"  },
  OTORRINOLARINGOLOGIA: { label: "Otorrinolaringología", color: "#26A69A", bg: "rgba(38,166,154,.12)",  border: "rgba(38,166,154,.3)"  },
  ODONTOLOGIA:          { label: "Odontología",          color: "#FF9800", bg: "rgba(255,152,0,.12)",   border: "rgba(255,152,0,.3)"   },
  FISIOTERAPIA:         { label: "Fisioterapia",         color: "#FF8F00", bg: "rgba(255,143,0,.12)",   border: "rgba(255,143,0,.3)"   },
};
const ESP_LABEL = (e) => ESP_META[e]?.label || e || "—";
const ESP_CHIP  = (e) => {
  const m = ESP_META[e];
  if (!m) return null;
  return (
    <span style={{
      background: m.bg, border: `1px solid ${m.border}`, color: m.color,
      borderRadius: 20, padding: "2px 9px", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
    }}>{m.label}</span>
  );
};

function CatalogoDiagnosticos() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [espFiltro, setEspFiltro] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyDx());
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [cie10List, setCie10List] = useState([]);
  const searchRef = useRef(null);

  function emptyDx() {
    return {
      nombre: "", especialidad: "", codigo_cie: "", descripcion_cie: "", diagnosticos_secundarios: [],
    };
  }

  const cargar = useCallback(() => {
    const params = { q };
    if (espFiltro) params.especialidad = espFiltro;
    api.get("/catalogos-diagnostico", { params })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  }, [q, espFiltro]);

  useEffect(() => { cargar(); }, [cargar]);

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
      especialidad: d.especialidad || "",
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
    if (!form.nombre || !form.codigo_cie) {
      setAlert({ t: "danger", m: "Nombre y código CIE son obligatorios" });
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
      {/* Alert */}
      {alert && (
        <div style={{
          marginBottom: 16, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: alert.t === "success" ? "#dcfce7" : "#fee2e2",
          color: alert.t === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${alert.t === "success" ? "#bbf7d0" : "#fecaca"}`,
        }}>
          <span>{alert.m}</span>
          <button onClick={() => setAlert(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}>×</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{
          flex: 1, maxWidth: 320, background: "#fff", borderRadius: 10, padding: "7px 12px",
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #e5e7eb",
        }}>
          <i className="bi bi-search" style={{ color: "#9ca3af", fontSize: "0.85rem" }}></i>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar diagnóstico…"
            style={{ border: "none", outline: "none", flex: 1, fontSize: "0.88rem", background: "transparent" }} />
        </div>
        {/* Filtro por especialidad */}
        <select value={espFiltro} onChange={e => setEspFiltro(e.target.value)} style={{
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          padding: "7px 12px", fontSize: "0.83rem", color: "#374151", cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,.06)", outline: "none",
        }}>
          <option value="">Todas las especialidades</option>
          {Object.entries(ESP_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={abrirNuevo} style={{
          marginLeft: "auto", background: "#2563eb", border: "none", borderRadius: 8,
          color: "#fff", padding: "7px 16px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <i className="bi bi-plus-circle"></i> Nuevo Diagnóstico
        </button>
      </div>

      {/* Inline form panel */}
      {showForm && (
        <div style={{
          background: "#fff", border: "1px solid #bfdbfe", borderRadius: 12,
          marginBottom: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.07)",
        }}>
          <div style={{
            background: "#eff6ff", padding: "12px 20px", borderBottom: "1px solid #bfdbfe",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e40af" }}>
              <i className="bi bi-clipboard2-pulse me-2"></i>
              {editId ? "Editar Diagnóstico" : "Nuevo Diagnóstico"}
            </span>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280" }}>×</button>
          </div>
          <div className="row g-2" style={{ padding: "16px 20px" }}>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Nombre del catálogo *</label>
              <input className="form-control form-control-sm" placeholder="Ej: Faringitis aguda"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Especialidad</label>
              <select className="form-select form-select-sm" value={form.especialidad}
                onChange={e => setForm(f => ({ ...f, especialidad: e.target.value }))}>
                <option value="">— Sin categoría —</option>
                {Object.entries(ESP_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4 position-relative" ref={searchRef}>
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
            <div className="col-12">
              <label className="form-label small fw-semibold">Descripción CIE *</label>
              <input className="form-control form-control-sm" placeholder="Se auto-llena al seleccionar código CIE, o escríbela manualmente"
                value={form.descripcion_cie}
                onChange={e => setForm(f => ({ ...f, descripcion_cie: e.target.value }))} />
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

            <div className="col-12" style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={guardar} disabled={saving} style={{ background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", padding: "7px 18px", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer" }}>
                {saving ? "Guardando…" : editId ? "Actualizar" : "Crear"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 16px", color: "#374151", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <div style={{ overflowY: "auto", maxHeight: 520 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", position: "sticky", top: 0, zIndex: 1 }}>
              {["Nombre", "Especialidad", "CIE-10", "Descripción", "Dx Secundarios", "Acciones"].map(h => (
                <th key={h} style={{
                  padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700,
                  color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                  borderBottom: "2px solid #e5e7eb", textAlign: "left", whiteSpace: "nowrap",
                  background: "#f8fafc",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map(d => {
              let sec = d.diagnosticos_secundarios;
              if (typeof sec === "string") { try { sec = JSON.parse(sec); } catch { sec = []; } }
              return (
                <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: "0.88rem", color: "#111827" }}>{d.nombre}</td>
                  <td style={{ padding: "11px 14px" }}>{ESP_CHIP(d.especialidad)}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ background: "#e0f2fe", color: "#0369a1", borderRadius: 20, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700 }}>{d.codigo_cie}</span>
                  </td>
                  <td style={{ padding: "11px 14px", fontSize: "0.83rem", color: "#374151" }}>{d.descripcion_cie}</td>
                  <td style={{ padding: "11px 14px" }}>
                    {(sec || []).length > 0
                      ? (sec || []).map((s, i) => (
                          <span key={i} style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "1px 7px", fontSize: "0.72rem", marginRight: 4 }}>
                            {s.cie}: {s.descripcion}
                          </span>
                        ))
                      : <span style={{ color: "#d1d5db" }}>—</span>
                    }
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => abrirEditar(d)} title="Editar"
                        style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, color: "#2563eb", padding: "4px 8px", cursor: "pointer" }}>
                        <i className="bi bi-pencil" style={{ fontSize: "0.82rem" }}></i>
                      </button>
                      <button onClick={() => toggleActivo(d.id)} title="Desactivar"
                        style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 7, color: "#e11d48", padding: "4px 8px", cursor: "pointer" }}>
                        <i className="bi bi-trash3" style={{ fontSize: "0.82rem" }}></i>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: "0.9rem" }}>
                  <i className="bi bi-clipboard2" style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: 0.3 }}></i>
                  Sin diagnósticos en catálogo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
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
      {/* Alert */}
      {alert && (
        <div style={{
          marginBottom: 16, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: alert.t === "success" ? "#dcfce7" : "#fee2e2",
          color: alert.t === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${alert.t === "success" ? "#bbf7d0" : "#fecaca"}`,
        }}>
          <span>{alert.m}</span>
          <button onClick={() => setAlert(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}>×</button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{
          flex: 1, maxWidth: 350, background: "#fff", borderRadius: 10, padding: "7px 12px",
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #e5e7eb",
        }}>
          <i className="bi bi-search" style={{ color: "#9ca3af", fontSize: "0.85rem" }}></i>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar estudio…"
            style={{ border: "none", outline: "none", flex: 1, fontSize: "0.88rem", background: "transparent" }} />
        </div>
        <select className="form-select form-select-sm" style={{ maxWidth: 180 }}
          value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={abrirNuevo} style={{
          marginLeft: "auto", background: "#2563eb", border: "none", borderRadius: 8,
          color: "#fff", padding: "7px 16px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <i className="bi bi-plus-circle"></i> Nuevo Estudio
        </button>
      </div>

      {/* Inline form panel */}
      {showForm && (
        <div style={{
          background: "#fff", border: "1px solid #bfdbfe", borderRadius: 12,
          marginBottom: 20, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.07)",
        }}>
          <div style={{
            background: "#eff6ff", padding: "12px 20px", borderBottom: "1px solid #bfdbfe",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e40af" }}>
              <i className="bi bi-file-earmark-medical me-2"></i>
              {editId ? "Editar Estudio" : "Nuevo Estudio"}
            </span>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6b7280" }}>×</button>
          </div>
          <div className="row g-2" style={{ padding: "16px 20px" }}>
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
            <div className="col-12" style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={guardar} disabled={saving} style={{ background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", padding: "7px 18px", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer" }}>
                {saving ? "Guardando…" : editId ? "Actualizar" : "Crear"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 16px", color: "#374151", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Nombre del Estudio", "Categoría", "Descripción", "Acciones"].map(h => (
                <th key={h} style={{
                  padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700,
                  color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                  borderBottom: "2px solid #e5e7eb", textAlign: "left", whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map(e => (
              <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                onMouseEnter={ev => ev.currentTarget.style.background = "#fafafa"}
                onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "11px 14px", fontWeight: 600, fontSize: "0.88rem", color: "#111827" }}>{e.nombre}</td>
                <td style={{ padding: "11px 14px" }}>
                  <span style={{
                    background: e.categoria === "LABORATORIO" ? "#eff6ff" : e.categoria === "IMAGENOLOGIA" ? "#e0f2fe" : "#f3f4f6",
                    color: e.categoria === "LABORATORIO" ? "#2563eb" : e.categoria === "IMAGENOLOGIA" ? "#0369a1" : "#6b7280",
                    border: `1px solid ${e.categoria === "LABORATORIO" ? "#bfdbfe" : e.categoria === "IMAGENOLOGIA" ? "#bae6fd" : "#e5e7eb"}`,
                    borderRadius: 20, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700,
                  }}>{e.categoria}</span>
                </td>
                <td style={{ padding: "11px 14px", fontSize: "0.83rem", color: e.descripcion ? "#374151" : "#d1d5db" }}>{e.descripcion || "—"}</td>
                <td style={{ padding: "11px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => abrirEditar(e)} title="Editar"
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, color: "#2563eb", padding: "4px 8px", cursor: "pointer" }}>
                      <i className="bi bi-pencil" style={{ fontSize: "0.82rem" }}></i>
                    </button>
                    <button onClick={() => toggleActivo(e.id)} title="Desactivar"
                      style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 7, color: "#e11d48", padding: "4px 8px", cursor: "pointer" }}>
                      <i className="bi bi-trash3" style={{ fontSize: "0.82rem" }}></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: "0.9rem" }}>
                  <i className="bi bi-file-earmark-medical" style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: 0.3 }}></i>
                  Sin estudios en catálogo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
