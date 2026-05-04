/**
 * Módulo Biopsias y Patología — Dermatología
 * /estetica/biopsias
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";

// ─── constantes ───────────────────────────────────────────────────────────────
const TIPOS_BIOPSIA = [
  { val: "punch",       label: "Punch",                  desc: "Cilindro de piel completo con troquelador" },
  { val: "shave",       label: "Shave / Rasurado",       desc: "Extirpación tangencial superficial" },
  { val: "incisional",  label: "Incisional",             desc: "Toma parcial de la lesión" },
  { val: "excisional",  label: "Excisional",             desc: "Extirpación completa de la lesión" },
  { val: "curetaje",    label: "Curetaje",               desc: "Raspado con cureta" },
  { val: "aspirado",    label: "Aspirado (PAAF)",        desc: "Punción aspiración con aguja fina" },
];

const RESULTADO_META = {
  benigno:           { label: "Benigno",              color: "#16a34a", bg: "#dcfce7", border: "#bbf7d0" },
  maligno:           { label: "Maligno",              color: "#dc2626", bg: "#fee2e2", border: "#fecaca" },
  atipia_leve:       { label: "Atipia leve",          color: "#d97706", bg: "#fef3c7", border: "#fde68a" },
  atipia_moderada:   { label: "Atipia moderada",      color: "#ea580c", bg: "#ffedd5", border: "#fed7aa" },
  atipia_severa:     { label: "Atipia severa",        color: "#9f1239", bg: "#ffe4e6", border: "#fecdd3" },
  pendiente:         { label: "Pendiente",            color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
  no_concluyente:    { label: "No concluyente",       color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
};

const MARGENES_META = {
  libres:         { label: "Libres",          color: "#16a34a" },
  comprometidos:  { label: "Comprometidos",   color: "#dc2626" },
  no_evaluables:  { label: "No evaluables",   color: "#d97706" },
  no_aplica:      { label: "No aplica",       color: "#6b7280" },
};

const ESTADO_META = {
  PENDIENTE:           { label: "Pendiente",           color: "#d97706", bg: "#fef3c7" },
  RESULTADO_RECIBIDO:  { label: "Resultado recibido",  color: "#2563eb", bg: "#eff6ff" },
  CERRADO:             { label: "Cerrado",             color: "#16a34a", bg: "#dcfce7" },
};

function ResultadoBadge({ val, meta }) {
  const m = meta[val] || { label: val, color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" };
  return (
    <span style={{
      background: m.bg, color: m.color,
      border: `1px solid ${m.border || m.color + "40"}`,
      borderRadius: 20, padding: "2px 10px",
      fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
    }}>{m.label}</span>
  );
}

function EstadoBadge({ estado }) {
  const m = ESTADO_META[estado] || ESTADO_META.PENDIENTE;
  return (
    <span style={{
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}40`,
      borderRadius: 20, padding: "2px 10px",
      fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap",
    }}>{m.label}</span>
  );
}

// ─── Búsqueda de paciente ─────────────────────────────────────────────────────
function BuscadorPaciente({ value, onChange, disabled }) {
  const [q, setQ] = useState(value?.nombres ? `${value.nombres} ${value.apellidos}` : "");
  const [resultados, setResultados] = useState([]);

  const buscar = async (texto) => {
    setQ(texto);
    if (texto.length < 2) { setResultados([]); return; }
    try {
      const r = await api.get("/pacientes", { params: { q: texto, limit: 8 } });
      setResultados(r.data.data || []);
    } catch { setResultados([]); }
  };

  const seleccionar = (p) => {
    setQ(`${p.nombres} ${p.apellidos}`);
    setResultados([]);
    onChange(p);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        className="form-control form-control-sm"
        placeholder="Buscar paciente por nombre o cédula…"
        value={q}
        disabled={disabled}
        onChange={e => buscar(e.target.value)}
        onBlur={() => setTimeout(() => setResultados([]), 200)}
        style={{ borderRadius: 7 }}
      />
      {resultados.length > 0 && (
        <ul className="list-group position-absolute z-3 shadow"
          style={{ top: "100%", left: 0, right: 0, maxHeight: 200, overflowY: "auto", borderRadius: 8 }}>
          {resultados.map(p => (
            <li key={p.id}
              className="list-group-item list-group-item-action py-2"
              style={{ cursor: "pointer", fontSize: "0.83rem" }}
              onMouseDown={() => seleccionar(p)}>
              <strong>{p.nombres} {p.apellidos}</strong>
              {p.cedula && <span className="text-muted ms-2 small">{p.cedula}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Formulario nueva / editar biopsia ────────────────────────────────────────
function FormBiopsia({ editData, onSaved, onCancel }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => editData ? {
    paciente: { id: editData.paciente_id, nombres: editData.pac_nombres, apellidos: editData.pac_apellidos },
    tipo_biopsia: editData.tipo_biopsia || "punch",
    sitio_anatomico: editData.sitio_anatomico || "",
    sospecha_clinica: editData.sospecha_clinica || "",
    diagnosticos_diferenciales: editData.diagnosticos_diferenciales || "",
    fecha_toma: editData.fecha_toma ? dayjs(editData.fecha_toma).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
    laboratorio: editData.laboratorio || "",
    observaciones: editData.observaciones || "",
  } : {
    paciente: null,
    tipo_biopsia: "punch",
    sitio_anatomico: "",
    sospecha_clinica: "",
    diagnosticos_diferenciales: "",
    fecha_toma: dayjs().format("YYYY-MM-DD"),
    laboratorio: "",
    observaciones: "",
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.paciente?.id) { setErr("Selecciona un paciente"); return; }
    if (!form.sitio_anatomico.trim()) { setErr("Sitio anatómico es obligatorio"); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        paciente_id: form.paciente.id,
        tipo_biopsia: form.tipo_biopsia,
        sitio_anatomico: form.sitio_anatomico,
        sospecha_clinica: form.sospecha_clinica || null,
        diagnosticos_diferenciales: form.diagnosticos_diferenciales || null,
        fecha_toma: form.fecha_toma || null,
        laboratorio: form.laboratorio || null,
        observaciones: form.observaciones || null,
      };
      if (editData) {
        await api.put(`/biopsias/${editData.id}`, payload);
      } else {
        await api.post("/biopsias", payload);
      }
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.msg || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const inputSt = { borderRadius: 7, fontSize: "0.85rem" };
  const textSt  = { borderRadius: 7, fontSize: "0.85rem", resize: "vertical" };

  return (
    <div style={{ background: "#fff", border: "1px solid #ddd6fe", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(124,58,237,.08)" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", padding: "12px 20px", borderBottom: "1px solid #ddd6fe", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i className="bi bi-eyedropper" style={{ color: "#7c3aed", fontSize: "1rem" }}></i>
          <span style={{ fontWeight: 700, color: "#5b21b6", fontSize: "0.92rem" }}>
            {editData ? "Editar Biopsia" : "Nueva Biopsia / Muestra"}
          </span>
        </div>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: "1.2rem" }}>×</button>
      </div>

      <div className="row g-3" style={{ padding: "18px 20px" }}>
        {/* Paciente */}
        <div className="col-12">
          <label className="form-label small fw-semibold mb-1">Paciente *</label>
          <BuscadorPaciente
            value={form.paciente}
            onChange={p => set("paciente", p)}
            disabled={!!editData}
          />
          {form.paciente && (
            <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}>
              <i className="bi bi-check-circle-fill"></i>
              Paciente seleccionado: {form.paciente.nombres} {form.paciente.apellidos}
            </div>
          )}
        </div>

        {/* Tipo + Fecha */}
        <div className="col-md-5">
          <label className="form-label small fw-semibold mb-1">Tipo de biopsia *</label>
          <select className="form-select form-select-sm" style={inputSt}
            value={form.tipo_biopsia} onChange={e => set("tipo_biopsia", e.target.value)}>
            {TIPOS_BIOPSIA.map(t => (
              <option key={t.val} value={t.val}>{t.label} — {t.desc}</option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label small fw-semibold mb-1">Fecha de toma</label>
          <input type="date" className="form-control form-control-sm" style={inputSt}
            value={form.fecha_toma} onChange={e => set("fecha_toma", e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label small fw-semibold mb-1">Laboratorio / Patólogo</label>
          <input className="form-control form-control-sm" style={inputSt}
            placeholder="Ej: Lab. Nacional, Dr. García…"
            value={form.laboratorio} onChange={e => set("laboratorio", e.target.value)} />
        </div>

        {/* Sitio anatómico */}
        <div className="col-md-6">
          <label className="form-label small fw-semibold mb-1">Sitio anatómico *</label>
          <input className="form-control form-control-sm" style={inputSt}
            placeholder="Ej: región malar derecha, espalda superior, antebrazo izquierdo…"
            value={form.sitio_anatomico} onChange={e => set("sitio_anatomico", e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label small fw-semibold mb-1">Sospecha clínica</label>
          <input className="form-control form-control-sm" style={inputSt}
            placeholder="Ej: Carcinoma basocelular, nevus atípico, melanoma…"
            value={form.sospecha_clinica} onChange={e => set("sospecha_clinica", e.target.value)} />
        </div>

        {/* Diagnósticos diferenciales */}
        <div className="col-12">
          <label className="form-label small fw-semibold mb-1">Diagnósticos diferenciales</label>
          <textarea className="form-control form-control-sm" rows={2} style={textSt}
            placeholder="Listado de diagnósticos a descartar…"
            value={form.diagnosticos_diferenciales} onChange={e => set("diagnosticos_diferenciales", e.target.value)} />
        </div>

        {/* Observaciones */}
        <div className="col-12">
          <label className="form-label small fw-semibold mb-1">Observaciones clínicas</label>
          <textarea className="form-control form-control-sm" rows={2} style={textSt}
            placeholder="Descripción macroscópica de la lesión, características especiales…"
            value={form.observaciones} onChange={e => set("observaciones", e.target.value)} />
        </div>

        {/* Error / botones */}
        {err && (
          <div className="col-12">
            <div style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", fontSize: "0.85rem" }}>
              <i className="bi bi-exclamation-triangle-fill me-2"></i>{err}
            </div>
          </div>
        )}
        <div className="col-12" style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving}
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none", borderRadius: 8, color: "#fff", padding: "7px 20px", fontSize: "0.84rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(124,58,237,.3)" }}>
            {saving ? "Guardando…" : editData ? "Actualizar" : "Registrar Biopsia"}
          </button>
          <button onClick={onCancel}
            style={{ background: "transparent", border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 16px", color: "#374151", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal cargar resultado ───────────────────────────────────────────────────
function ModalResultado({ biopsia, onClose, onSaved }) {
  const [form, setForm] = useState({
    resultado_texto: biopsia.resultado_texto || "",
    resultado_patologico: biopsia.resultado_patologico || "pendiente",
    margenes: biopsia.margenes || "no_aplica",
    conducta_posterior: biopsia.conducta_posterior || "",
    cerrar: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setSaving(true); setErr(null);
    try {
      await api.put(`/biopsias/${biopsia.id}/resultado`, form);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.msg || "Error al guardar resultado");
    } finally {
      setSaving(false);
    }
  };

  const textSt = { borderRadius: 7, fontSize: "0.85rem", resize: "vertical" };
  const selSt  = { borderRadius: 7, fontSize: "0.85rem" };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 9998 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 640 }}>
        <div className="modal-content" style={{ borderRadius: 14, overflow: "hidden", border: "none" }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg,#1a2744,#243b72)", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i className="bi bi-journal-medical" style={{ color: "#7dd3fc", fontSize: "1.2rem" }}></i>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Cargar Resultado Patológico</div>
                <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.75rem" }}>
                  {biopsia.pac_nombres} {biopsia.pac_apellidos} — {biopsia.sitio_anatomico}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 7, color: "#fff", padding: "4px 10px", cursor: "pointer", fontSize: "0.85rem" }}>✕</button>
          </div>

          <div className="row g-3" style={{ padding: "20px" }}>
            {/* Resultado diagnóstico */}
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Resultado patológico</label>
              <select className="form-select form-select-sm" style={selSt}
                value={form.resultado_patologico} onChange={e => set("resultado_patologico", e.target.value)}>
                {Object.entries(RESULTADO_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Márgenes quirúrgicos</label>
              <select className="form-select form-select-sm" style={selSt}
                value={form.margenes} onChange={e => set("margenes", e.target.value)}>
                {Object.entries(MARGENES_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Resultado texto completo */}
            <div className="col-12">
              <label className="form-label small fw-semibold mb-1">Informe histopatológico</label>
              <textarea className="form-control form-control-sm" rows={5} style={textSt}
                placeholder="Pegar o escribir el informe completo del laboratorio de patología…"
                value={form.resultado_texto} onChange={e => set("resultado_texto", e.target.value)} />
            </div>

            {/* Conducta posterior */}
            <div className="col-12">
              <label className="form-label small fw-semibold mb-1">Conducta posterior / Plan de manejo</label>
              <textarea className="form-control form-control-sm" rows={3} style={textSt}
                placeholder="Ej: Ampliación de márgenes, seguimiento en 3 meses, derivar a oncología…"
                value={form.conducta_posterior} onChange={e => set("conducta_posterior", e.target.value)} />
            </div>

            {/* Cerrar biopsia */}
            <div className="col-12">
              <label className="d-flex align-items-center gap-2" style={{ cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={form.cerrar} onChange={e => set("cerrar", e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#374151" }}>
                  Marcar como Cerrado (caso resuelto, no requiere más seguimiento)
                </span>
              </label>
            </div>

            {err && (
              <div className="col-12">
                <div style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", fontSize: "0.85rem" }}>
                  {err}
                </div>
              </div>
            )}

            <div className="col-12" style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSubmit} disabled={saving}
                style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 8, color: "#fff", padding: "7px 20px", fontSize: "0.84rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,.3)" }}>
                {saving ? "Guardando…" : "Guardar Resultado"}
              </button>
              <button onClick={onClose}
                style={{ background: "transparent", border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 16px", color: "#374151", fontSize: "0.84rem", fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel detalle biopsia ────────────────────────────────────────────────────
function PanelDetalle({ biopsia, onClose, onEdit, onResultado }) {
  const tipoMeta = TIPOS_BIOPSIA.find(t => t.val === biopsia.tipo_biopsia) || { label: biopsia.tipo_biopsia };

  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,.07)" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1a2744,#243b72)", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-eyedropper" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>
              {biopsia.pac_nombres} {biopsia.pac_apellidos}
            </div>
            <div style={{ color: "rgba(255,255,255,.55)", fontSize: "0.75rem" }}>
              {tipoMeta.label} · {biopsia.sitio_anatomico}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <EstadoBadge estado={biopsia.estado} />
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 7, color: "#fff", padding: "4px 10px", cursor: "pointer", marginLeft: 8 }}>✕</button>
        </div>
      </div>

      <div style={{ padding: "20px" }}>
        <div className="row g-3">
          {/* Info clínica */}
          <div className="col-md-6">
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 16px", border: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Datos de la toma</p>
              <div className="row g-2">
                <div className="col-6">
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Tipo</p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.85rem" }}>{tipoMeta.label}</p>
                </div>
                <div className="col-6">
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Fecha toma</p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.85rem" }}>
                    {biopsia.fecha_toma ? dayjs(biopsia.fecha_toma).format("DD/MM/YYYY") : "—"}
                  </p>
                </div>
                <div className="col-12">
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Sitio anatómico</p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.85rem" }}>{biopsia.sitio_anatomico}</p>
                </div>
                {biopsia.sospecha_clinica && (
                  <div className="col-12">
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Sospecha clínica</p>
                    <p style={{ margin: 0, fontSize: "0.85rem" }}>{biopsia.sospecha_clinica}</p>
                  </div>
                )}
                {biopsia.laboratorio && (
                  <div className="col-12">
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Laboratorio</p>
                    <p style={{ margin: 0, fontSize: "0.85rem" }}>{biopsia.laboratorio}</p>
                  </div>
                )}
                <div className="col-12">
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#9ca3af" }}>Médico</p>
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>Dr. {biopsia.med_apellidos}, {biopsia.med_nombres}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Diagnósticos diferenciales + observaciones */}
          <div className="col-md-6">
            {biopsia.diagnosticos_diferenciales && (
              <div style={{ background: "#f0f9ff", borderRadius: 10, padding: "14px 16px", border: "1px solid #bae6fd", marginBottom: 12 }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Diagnósticos diferenciales</p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#374151" }}>{biopsia.diagnosticos_diferenciales}</p>
              </div>
            )}
            {biopsia.observaciones && (
              <div style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 16px", border: "1px solid #e5e7eb" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Observaciones</p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#374151" }}>{biopsia.observaciones}</p>
              </div>
            )}
          </div>

          {/* Resultado patológico */}
          {biopsia.resultado_texto && (
            <div className="col-12">
              <div style={{ background: "#f5f3ff", borderRadius: 10, padding: "14px 16px", border: "1px solid #ddd6fe" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em" }}>Informe histopatológico</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <ResultadoBadge val={biopsia.resultado_patologico} meta={RESULTADO_META} />
                    <span style={{ color: MARGENES_META[biopsia.margenes]?.color || "#6b7280", fontSize: "0.72rem", fontWeight: 700, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "2px 10px" }}>
                      Márgenes: {MARGENES_META[biopsia.margenes]?.label || biopsia.margenes}
                    </span>
                  </div>
                </div>
                <pre style={{ margin: 0, fontSize: "0.82rem", color: "#374151", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{biopsia.resultado_texto}</pre>
                {biopsia.fecha_resultado && (
                  <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "#9ca3af" }}>
                    Resultado cargado: {dayjs(biopsia.fecha_resultado).format("DD/MM/YYYY HH:mm")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Conducta posterior */}
          {biopsia.conducta_posterior && (
            <div className="col-12">
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "14px 16px", border: "1px solid #bbf7d0" }}>
                <p style={{ margin: "0 0 6px", fontSize: "0.72rem", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Conducta posterior / Plan</p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#374151" }}>{biopsia.conducta_posterior}</p>
              </div>
            </div>
          )}
        </div>

        {/* Acciones */}
        {biopsia.estado !== "CERRADO" && (
          <div style={{ display: "flex", gap: 8, marginTop: 18, paddingTop: 14, borderTop: "1px solid #e5e7eb" }}>
            <button onClick={onResultado}
              style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 8, color: "#fff", padding: "7px 18px", fontSize: "0.83rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(37,99,235,.3)" }}>
              <i className="bi bi-journal-medical"></i> Cargar Resultado
            </button>
            <button onClick={onEdit}
              style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, color: "#2563eb", padding: "7px 16px", fontSize: "0.83rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <i className="bi bi-pencil"></i> Editar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function BiopsiaPatologia() {
  const [searchParams] = useSearchParams();
  const pacienteIdUrl  = searchParams.get("paciente_id");

  const [list,       setList]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [filtroEst,  setFiltroEst]  = useState("");
  const [filtroPac,  setFiltroPac]  = useState(pacienteIdUrl || "");
  const [filtroPacQ, setFiltroPacQ] = useState("");

  const [showForm,   setShowForm]   = useState(false);
  const [editData,   setEditData]   = useState(null);
  const [detalle,    setDetalle]    = useState(null);
  const [modalRes,   setModalRes]   = useState(null);
  const [alertMsg,   setAlertMsg]   = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (filtroEst) params.estado = filtroEst;
      if (filtroPac) params.paciente_id = filtroPac;
      const r = await api.get("/biopsias", { params });
      setList(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch { setList([]); }
    finally { setLoading(false); }
  }, [page, filtroEst, filtroPac]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirDetalle = async (id) => {
    try {
      const r = await api.get(`/biopsias/${id}`);
      setDetalle(r.data.data);
    } catch { setAlertMsg({ t: "danger", m: "No se pudo cargar el detalle" }); }
  };

  const onSaved = (msg = "Guardado correctamente") => {
    setShowForm(false);
    setEditData(null);
    setDetalle(null);
    setAlertMsg({ t: "success", m: msg });
    cargar();
  };

  // Stats rápidas
  const stats = {
    total:    list.length,
    pend:     list.filter(b => b.estado === "PENDIENTE").length,
    recibido: list.filter(b => b.estado === "RESULTADO_RECIBIDO").length,
    maligno:  list.filter(b => b.resultado_patologico === "maligno").length,
  };

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg,#1a2744 0%,#243b72 100%)", padding: "16px 24px", boxShadow: "0 2px 12px rgba(0,0,0,.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="bi bi-eyedropper" style={{ color: "#7dd3fc", fontSize: "1.1rem" }}></i>
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Biopsias y Patología</div>
              <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>Registro y seguimiento de muestras histopatológicas</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 8,
                color: "#fff", padding: "8px 16px", fontSize: "0.85rem", fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              }}>
              <i className="bi bi-arrow-left" /> Atrás
            </button>
            <button
              onClick={() => { setEditData(null); setShowForm(true); setDetalle(null); }}
              style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none", borderRadius: 8, color: "#fff", padding: "8px 18px", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 2px 10px rgba(124,58,237,.4)" }}>
            <i className="bi bi-plus-circle-fill"></i> Nueva Biopsia
          </button>
        </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          {[
            { label: "Total",          val: total,        icon: "bi-collection",         color: "#7dd3fc" },
            { label: "Pendientes",     val: stats.pend,   icon: "bi-hourglass-split",    color: "#fbbf24" },
            { label: "Con resultado",  val: stats.recibido, icon: "bi-file-earmark-check", color: "#34d399" },
            { label: "Malignos",       val: stats.maligno, icon: "bi-exclamation-triangle", color: "#f87171" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "8px 16px", minWidth: 100, textAlign: "center" }}>
              <i className={`bi ${s.icon}`} style={{ color: s.color, fontSize: "1.1rem" }}></i>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.1rem", lineHeight: 1.2, marginTop: 2 }}>{s.val}</div>
              <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.7rem" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* Alert */}
        {alertMsg && (
          <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem", display: "flex", justifyContent: "space-between", alignItems: "center",
            background: alertMsg.t === "success" ? "#dcfce7" : "#fee2e2",
            color: alertMsg.t === "success" ? "#166534" : "#991b1b",
            border: `1px solid ${alertMsg.t === "success" ? "#bbf7d0" : "#fecaca"}` }}>
            <span>{alertMsg.m}</span>
            <button onClick={() => setAlertMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}>×</button>
          </div>
        )}

        {/* Formulario nueva / editar */}
        {showForm && (
          <div style={{ marginBottom: 20 }}>
            <FormBiopsia
              editData={editData}
              onSaved={() => onSaved(editData ? "Biopsia actualizada" : "Biopsia registrada")}
              onCancel={() => { setShowForm(false); setEditData(null); }}
            />
          </div>
        )}

        {/* Detalle seleccionado */}
        {detalle && !showForm && (
          <div style={{ marginBottom: 20 }}>
            <PanelDetalle
              biopsia={detalle}
              onClose={() => setDetalle(null)}
              onEdit={() => { setEditData(detalle); setShowForm(true); setDetalle(null); }}
              onResultado={() => setModalRes(detalle)}
            />
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 320, background: "#fff", borderRadius: 10, padding: "7px 12px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #e5e7eb" }}>
            <i className="bi bi-search" style={{ color: "#9ca3af", fontSize: "0.85rem" }}></i>
            <input
              placeholder="Buscar paciente por nombre…"
              value={filtroPacQ}
              onChange={async (e) => {
                const v = e.target.value;
                setFiltroPacQ(v);
                if (!v) { setFiltroPac(""); return; }
                if (v.length < 2) return;
                try {
                  const r = await api.get("/pacientes", { params: { q: v, limit: 5 } });
                  // tomar primer resultado exacto
                  if (r.data.data?.length === 1) setFiltroPac(r.data.data[0].id);
                  else setFiltroPac("");
                } catch { setFiltroPac(""); }
              }}
              style={{ border: "none", outline: "none", flex: 1, fontSize: "0.88rem", background: "transparent" }}
            />
            {filtroPacQ && (
              <button onClick={() => { setFiltroPacQ(""); setFiltroPac(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}>
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>

          <select
            value={filtroEst}
            onChange={e => { setFiltroEst(e.target.value); setPage(1); }}
            style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "7px 12px", fontSize: "0.83rem", color: "#374151", outline: "none", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="RESULTADO_RECIBIDO">Resultado recibido</option>
            <option value="CERRADO">Cerrado</option>
          </select>
        </div>

        {/* Tabla */}
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
              <span className="spinner-border spinner-border-sm me-2"></span> Cargando biopsias…
            </div>
          ) : list.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 0", color: "#9ca3af" }}>
              <i className="bi bi-eyedropper" style={{ fontSize: "2.5rem", display: "block", marginBottom: 12, opacity: 0.25 }}></i>
              <p style={{ fontSize: "0.92rem" }}>No se encontraron biopsias registradas.</p>
              <button
                onClick={() => { setEditData(null); setShowForm(true); }}
                style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none", borderRadius: 8, color: "#fff", padding: "8px 20px", fontSize: "0.83rem", fontWeight: 700, cursor: "pointer", marginTop: 8, boxShadow: "0 2px 8px rgba(124,58,237,.3)" }}>
                <i className="bi bi-plus-circle me-2"></i>Registrar primera biopsia
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Paciente", "Tipo", "Sitio anatómico", "Fecha toma", "Sospecha clínica", "Resultado", "Márgenes", "Estado", "Acciones"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e5e7eb", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map(b => {
                    const tipoMeta = TIPOS_BIOPSIA.find(t => t.val === b.tipo_biopsia) || { label: b.tipo_biopsia };
                    return (
                      <tr key={b.id}
                        style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        onClick={() => abrirDetalle(b.id)}>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#111827" }}>{b.pac_nombres} {b.pac_apellidos}</div>
                          <div style={{ fontSize: "0.73rem", color: "#9ca3af" }}>Dr. {b.med_apellidos}</div>
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          <span style={{ background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
                            {tipoMeta.label}
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: "0.85rem", color: "#374151" }}>{b.sitio_anatomico}</td>
                        <td style={{ padding: "11px 14px", fontSize: "0.83rem", color: "#374151", whiteSpace: "nowrap" }}>
                          {b.fecha_toma ? dayjs(b.fecha_toma).format("DD/MM/YYYY") : <span style={{ color: "#d1d5db" }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: "0.82rem", color: "#374151", maxWidth: 180 }}>
                          {b.sospecha_clinica || <span style={{ color: "#d1d5db" }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          {b.resultado_patologico && b.resultado_patologico !== "pendiente"
                            ? <ResultadoBadge val={b.resultado_patologico} meta={RESULTADO_META} />
                            : <span style={{ color: "#d1d5db", fontSize: "0.8rem" }}>Sin resultado</span>}
                        </td>
                        <td style={{ padding: "11px 14px", fontSize: "0.82rem" }}>
                          {b.margenes && b.margenes !== "no_aplica"
                            ? <span style={{ color: MARGENES_META[b.margenes]?.color, fontWeight: 600, fontSize: "0.78rem" }}>{MARGENES_META[b.margenes]?.label}</span>
                            : <span style={{ color: "#d1d5db" }}>—</span>}
                        </td>
                        <td style={{ padding: "11px 14px" }}><EstadoBadge estado={b.estado} /></td>
                        <td style={{ padding: "11px 14px" }}>
                          <div style={{ display: "flex", gap: 5 }} onClick={e => e.stopPropagation()}>
                            {b.estado !== "CERRADO" && (
                              <button title="Cargar resultado"
                                onClick={async () => { const r = await api.get(`/biopsias/${b.id}`); setModalRes(r.data.data); }}
                                style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, color: "#2563eb", padding: "4px 8px", cursor: "pointer" }}>
                                <i className="bi bi-journal-medical" style={{ fontSize: "0.82rem" }}></i>
                              </button>
                            )}
                            <button title="Ver detalle"
                              onClick={() => abrirDetalle(b.id)}
                              style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 7, color: "#7c3aed", padding: "4px 8px", cursor: "pointer" }}>
                              <i className="bi bi-eye" style={{ fontSize: "0.82rem" }}></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Paginación */}
        {total > 30 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 14px", cursor: page === 1 ? "default" : "pointer", fontSize: "0.83rem", opacity: page === 1 ? 0.4 : 1 }}>
              ← Anterior
            </button>
            <span style={{ padding: "5px 14px", fontSize: "0.83rem", color: "#6b7280", fontWeight: 600 }}>
              Pág. {page} · {total} biopsias
            </span>
            <button disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)}
              style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 14px", cursor: page * 30 >= total ? "default" : "pointer", fontSize: "0.83rem", opacity: page * 30 >= total ? 0.4 : 1 }}>
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Modal resultado */}
      {modalRes && (
        <ModalResultado
          biopsia={modalRes}
          onClose={() => setModalRes(null)}
          onSaved={() => { onSaved("Resultado cargado correctamente"); setModalRes(null); }}
        />
      )}
    </div>
  );
}
