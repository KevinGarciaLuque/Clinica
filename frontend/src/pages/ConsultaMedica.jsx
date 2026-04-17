/**
 * FASE 4 — Consulta SOAP (Historia Clínica Electrónica)
 * URL: /consulta?paciente_id=&cita_id=&historia_id=
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

// ─── helpers ──────────────────────────────────────────────────────────────────
const VITALS_FIELDS = [
  { key: "pa",    label: "P.A.",   placeholder: "120/80",  unit: "mmHg" },
  { key: "fc",    label: "F.C.",   placeholder: "72",      unit: "bpm"  },
  { key: "fr",    label: "F.R.",   placeholder: "16",      unit: "rpm"  },
  { key: "temp",  label: "Temp.",  placeholder: "36.5",    unit: "°C"   },
  { key: "peso",  label: "Peso",   placeholder: "70",      unit: "kg"   },
  { key: "talla", label: "Talla",  placeholder: "170",     unit: "cm"   },
  { key: "spo2",  label: "SpO₂",  placeholder: "98",      unit: "%"    },
  { key: "imc",   label: "IMC",   placeholder: "—",       unit: "kg/m²", readOnly: true },
];

function calcIMC(peso, talla) {
  const p = parseFloat(peso), t = parseFloat(talla);
  if (!p || !t) return "";
  return (p / ((t / 100) ** 2)).toFixed(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function Consulta() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const pacId      = params.get("paciente_id");
  const citaId     = params.get("cita_id");
  const historiaId = params.get("historia_id");

  const [tab,       setTab]       = useState("soap");
  const [historia,  setHistoria]  = useState(null);   // loaded historia object
  const [hid,       setHid]       = useState(historiaId || null); // historia id (created or loaded)
  const [paciente,  setPaciente]  = useState(null);
  const [firmada,   setFirmada]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [alertMsg,  setAlertMsg]  = useState(null);   // { type, msg }
  const [showConsultaModal,  setShowConsultaModal]  = useState(false);
  const [consultaPaciente,   setConsultaPaciente]   = useState(null);

  // SOAP fields
  const [soap, setSoap] = useState({
    subjetivo: "", objetivo: {}, examen_fisico: "", plan: "",
    diagnostico_cie: "", diagnostico_desc: "",
    diagnosticos_secundarios: [],
  });
  const [vitals, setVitals] = useState({});

  // ── carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    // cargar historia existente
    if (hid) {
      api.get(`/historias/${hid}`)
        .then(r => {
          const h = r.data.data;
          setHistoria(h);
          setFirmada(h.estado === "FIRMADA");
          setPaciente({ id: h.paciente_id, nombres: h.pac_nombres, apellidos: h.pac_apellidos, fecha_nacimiento: h.fecha_nacimiento });
          const obj = typeof h.objetivo === "string" ? JSON.parse(h.objetivo || "{}") : (h.objetivo || {});
          setVitals(obj);
          const secDx = typeof h.diagnosticos_secundarios === "string"
            ? JSON.parse(h.diagnosticos_secundarios || "[]")
            : (h.diagnosticos_secundarios || []);
          setSoap(s => ({
            ...s,
            subjetivo: h.subjetivo || "",
            objetivo:  obj,
            examen_fisico: h.examen_fisico || "",
            plan:       h.plan || "",
            diagnostico_cie:  h.diagnostico_cie || "",
            diagnostico_desc: "",
            diagnosticos_secundarios: secDx,
          }));
          // recuperar la descripción del código CIE-10 guardado
          if (h.diagnostico_cie) {
            api.get("/historias/cie10/buscar", { params: { q: h.diagnostico_cie } })
              .then(r => {
                const found = r.data.data?.find(x => x.codigo === h.diagnostico_cie);
                if (found) setSoap(s => ({ ...s, diagnostico_desc: found.descripcion }));
              }).catch(() => {});
          }
        })
        .catch(() => setAlertMsg({ type: "danger", msg: "No se pudo cargar la historia" }));
    }

    // cargar paciente si no viene de historia
    if (pacId && !hid) {
      api.get(`/pacientes/${pacId}`)
        .then(r => { if (r.data.data) setPaciente(r.data.data); })
        .catch(() => {});
    }
  }, [hid, pacId]);

  // ── imc automático ───────────────────────────────────────────────────────────
  useEffect(() => {
    setVitals(v => ({ ...v, imc: calcIMC(v.peso, v.talla) }));
  }, [vitals.peso, vitals.talla]);

  // ── guardar borrador ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async (sign = false) => {
    setSaving(true);
    setAlertMsg(null);
    try {
      const payload = {
        paciente_id: paciente?.id || pacId,
        cita_id:     citaId || null,
        subjetivo:   soap.subjetivo,
        objetivo:    { ...vitals, imc: undefined },
        examen_fisico: soap.examen_fisico,
        diagnostico_cie: soap.diagnostico_cie || null,
        diagnosticos_secundarios: soap.diagnosticos_secundarios,
        plan:        soap.plan,
        estado:      sign ? "FIRMADA" : "BORRADOR",
      };

      if (hid) {
        await api.put(`/historias/${hid}`, payload);
        if (sign) {
          await api.post(`/historias/${hid}/firmar`);
          setFirmada(true);
          setAlertMsg({ type: "success", msg: "Historia firmada y cita marcada como COMPLETADA." });
        } else {
          setAlertMsg({ type: "success", msg: "Guardado como borrador." });
        }
      } else {
        const r = await api.post("/historias", payload);
        setHid(r.data.id);
        if (sign) {
          await api.post(`/historias/${r.data.id}/firmar`);
          setFirmada(true);
          setAlertMsg({ type: "success", msg: "Historia firmada." });
        } else {
          setAlertMsg({ type: "success", msg: "Historia creada." });
        }
      }
    } catch (e) {
      setAlertMsg({ type: "danger", msg: e.response?.data?.msg || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  }, [soap, vitals, hid, paciente, pacId, citaId]);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const edad = paciente?.fecha_nacimiento
    ? dayjs().diff(dayjs(paciente.fecha_nacimiento), "year") + " años"
    : "";

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex align-items-start justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <button className="btn btn-link p-0 text-muted me-2" onClick={() => navigate(-1)}>← Volver</button>
          <h5 className="d-inline mb-0 fw-bold">
            Consulta Médica
            {firmada && <span className="badge bg-success ms-2">FIRMADA</span>}
            {!firmada && hid && <span className="badge bg-warning text-dark ms-2">BORRADOR</span>}
          </h5>
        </div>
        {!firmada && (
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => handleSave(false)} disabled={saving}>
              {saving ? "Guardando…" : "Guardar Borrador"}
            </button>
            <button className="btn btn-success btn-sm" onClick={() => handleSave(true)} disabled={saving}>
              ✓ Firmar y Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Paciente banner */}
      {paciente && (
        <div className="alert alert-light border py-2 mb-3 d-flex align-items-center gap-3">
          <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold"
            style={{ width: 44, height: 44, flexShrink: 0 }}>
            {paciente.nombres?.[0]}{paciente.apellidos?.[0]}
          </div>
          <div>
            <div className="fw-semibold">{paciente.apellidos}, {paciente.nombres}</div>
            <small className="text-muted">{edad}{edad ? " · " : ""}{paciente.fecha_nacimiento ? dayjs(paciente.fecha_nacimiento).format("DD/MM/YYYY") : ""}</small>
          </div>
          {paciente && (
            <button
              className="ms-auto btn btn-success btn-sm"
              onClick={() => { setConsultaPaciente(paciente); setShowConsultaModal(true); }}
            >
              <i className="bi bi-plus-lg me-1" />Nueva Consulta
            </button>
          )}
        </div>
      )}

      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} py-2 alert-dismissible`}>
          {alertMsg.msg}
          <button className="btn-close" onClick={() => setAlertMsg(null)} />
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        {[
          { id: "soap",        label: "📋 SOAP" },
          { id: "rx",          label: "💊 Prescripción" },
          { id: "estudios",    label: "🧪 Estudios" },
          { id: "antecedentes",label: "📁 Antecedentes" },
        ].map(t => (
          <li key={t.id} className="nav-item">
            <button className={`nav-link ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {/* ── SOAP ── */}
      {tab === "soap" && (
        <SoapTab
          soap={soap} setSoap={setSoap}
          vitals={vitals} setVitals={setVitals}
          firmada={firmada}
        />
      )}

      {/* ── Prescripción ── */}
      {tab === "rx" && (
        <PrescripcionTab
          historiaId={hid}
          pacienteId={paciente?.id || pacId}
          citaId={citaId}
          firmada={firmada}
          diagnosticoCie={soap.diagnostico_cie}
          diagnosticoDesc={soap.diagnostico_desc}
        />
      )}

      {/* ── Estudios ── */}
      {tab === "estudios" && (
        <EstudiosTab
          historiaId={hid}
          pacienteId={paciente?.id || pacId}
          firmada={firmada}
        />
      )}

      {/* ── Antecedentes ── */}
      {tab === "antecedentes" && (
        <AntecedentesTab
          pacienteId={paciente?.id || pacId}
          firmada={firmada}
        />
      )}

      {/* Modal consulta sin cita agendada */}
      {showConsultaModal && consultaPaciente && (
        <ModalConsultaSinCita
          paciente={consultaPaciente}
          onClose={() => { setShowConsultaModal(false); setConsultaPaciente(null); }}
          onCreated={(citaId) => {
            setShowConsultaModal(false);
            navigate(`/consulta-medica?paciente_id=${consultaPaciente.id}&cita_id=${citaId}`);
            setConsultaPaciente(null);
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Textarea con predicción de texto IA por especialidad
// ══════════════════════════════════════════════════════════════════════
function SoapTextareaIA({ label, sublabel, value, onChange, readOnly, rows = 3, placeholder, campo, especialidad, diagnosticoCie, diagnosticoDesc }) {
  const [sugerencia, setSugerencia] = useState("");
  const [cargando,   setCargando]   = useState(false);
  const taRef = useRef(null);

  // Limpiar sugerencia al cambiar diagnóstico o campo
  useEffect(() => { setSugerencia(""); }, [diagnosticoCie, campo]);

  useEffect(() => {
    if (!value || value.trim().length < 10 || readOnly) { setSugerencia(""); return; }
    setCargando(true);
    setSugerencia("");
    const t = setTimeout(() => {
      api.post("/ia/soap-sugerencia", {
        campo,
        texto:           value,
        especialidad:    especialidad || "Medicina General",
        diagnostico_cie: diagnosticoCie || "",
        diagnostico_desc: diagnosticoDesc || "",
      })
        .then(r => { if (r.data.sugerencia) setSugerencia(r.data.sugerencia); })
        .catch(() => {})
        .finally(() => setCargando(false));
    }, 750);
    return () => { clearTimeout(t); setCargando(false); };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const aceptar = () => {
    const sep = value.trimEnd().endsWith(".") || value.trimEnd().endsWith(",") ? " " : " ";
    onChange({ target: { value: value.trimEnd() + sep + sugerencia } });
    setSugerencia("");
    taRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Tab" && sugerencia) { e.preventDefault(); aceptar(); }
    if (e.key === "Escape")             { setSugerencia(""); }
  };

  return (
    <div>
      {label && (
        <label className="form-label fw-semibold">
          {label} {sublabel && <small className="text-muted fw-normal">{sublabel}</small>}
        </label>
      )}
      <textarea
        ref={taRef}
        className="form-control"
        rows={rows}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
      />
      {/* Indicador de carga */}
      {cargando && !readOnly && (
        <div className="d-flex align-items-center gap-1 mt-1" style={{ minHeight: 20 }}>
          <span className="spinner-border spinner-border-sm text-info"
            style={{ width: "0.55rem", height: "0.55rem", borderWidth: "0.1em" }}></span>
          <span className="text-muted" style={{ fontSize: "0.68rem" }}>IA pensando…</span>
        </div>
      )}
      {/* Sugerencia */}
      {sugerencia && !cargando && !readOnly && (
        <div className="d-flex align-items-start gap-2 mt-1 px-2 py-1 rounded"
          style={{ background: "rgba(13,110,253,0.05)", border: "1px dashed #93c5fd" }}>
          <i className="bi bi-stars text-primary" style={{ fontSize: "0.75rem", marginTop: 2 }}></i>
          <span className="flex-grow-1 text-secondary" style={{ fontSize: "0.8rem", lineHeight: 1.45 }}>
            {sugerencia}
          </span>
          <button type="button"
            className="btn btn-sm py-0 px-2 text-nowrap"
            style={{ fontSize: "0.68rem", background: "#dbeafe", border: "none", color: "#1d4ed8" }}
            onClick={aceptar}
            title="Tab para aceptar">
            Tab ↵
          </button>
          <button type="button"
            className="btn btn-link btn-sm p-0 text-muted lh-1"
            style={{ fontSize: "0.75rem" }}
            onClick={() => setSugerencia("")}
            title="Descartar sugerencia">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Componente reutilizable: buscador CIE-10 con chip al seleccionar
// ══════════════════════════════════════════════════════════════════════
function CieBuscador({ value, desc, onChange, onClear, readOnly, placeholder = "Buscar código o descripción…" }) {
  const [q, setQ]       = useState("");
  const [list, setList] = useState([]);
  const ref             = useRef(null);

  // cerrar dropdown al clic fuera
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setList([]); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (!q || q.length < 2) { setList([]); return; }
    const t = setTimeout(() => {
      api.get("/historias/cie10/buscar", { params: { q } })
        .then(r => setList(r.data.data || []))
        .catch(() => setList([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const sel = (item) => {
    onChange(item.codigo, item.descripcion);
    setQ("");
    setList([]);
  };

  // Chip cuando ya hay un diagnóstico seleccionado
  if (value) {
    return (
      <div className="d-flex align-items-center gap-2 px-2 py-2 rounded border"
        style={{ background: "rgba(25,135,84,0.07)", minHeight: 36 }}>
        <span className="badge bg-success" style={{ fontFamily: "monospace", fontSize: "0.78rem", letterSpacing: "0.04em" }}>
          {value}
        </span>
        <span className="flex-grow-1 small fw-semibold text-success">{desc || "…"}</span>
        {!readOnly && (
          <button type="button" className="btn btn-link btn-sm p-0 text-danger lh-1" title="Cambiar diagnóstico"
            onClick={onClear}>
            <i className="bi bi-x-circle-fill"></i>
          </button>
        )}
      </div>
    );
  }

  // Campo de búsqueda cuando no hay nada seleccionado
  return (
    <div className="position-relative" ref={ref}>
      <div className="input-group input-group-sm">
        <span className="input-group-text text-muted border-end-0 bg-white">
          <i className="bi bi-search" style={{ fontSize: "0.75rem" }}></i>
        </span>
        <input className="form-control border-start-0" placeholder={placeholder}
          value={q} onChange={e => setQ(e.target.value)}
          autoComplete="off" />
      </div>
      {list.length > 0 && (
        <ul className="list-group position-absolute z-3 shadow"
          style={{ top: "100%", left: 0, right: 0, maxHeight: 230, overflowY: "auto" }}>
          {list.map(c => (
            <li key={c.codigo} className="list-group-item list-group-item-action py-1 px-2"
              style={{ cursor: "pointer", fontSize: "0.81rem" }}
              onMouseDown={() => sel(c)}>
              <span className="me-2 fw-bold" style={{ fontFamily: "monospace", color: "#0d6efd" }}>{c.codigo}</span>
              <span>{c.descripcion}</span>
              {c.categoria && (
                <span className="badge ms-2 text-bg-light border" style={{ fontSize: "0.66rem" }}>
                  {c.categoria}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: SOAP
// ══════════════════════════════════════════════════════════════════════
function SoapTab({ soap, setSoap, vitals, setVitals, firmada }) {
  const { user } = useAuth();
  const especialidad = user?.especialidad || "Medicina General";
  const cie10Ref = useRef(null);

  // ── Catálogo de diagnósticos frecuentes ──
  const [catDxQuery, setCatDxQuery] = useState("");
  const [catDxList, setCatDxList]   = useState([]);
  const [showCatDx, setShowCatDx]   = useState(false);

  useEffect(() => {
    if (!catDxQuery || catDxQuery.length < 2) { setCatDxList([]); return; }
    const t = setTimeout(() => {
      api.get("/catalogos-diagnostico", { params: { q: catDxQuery } })
        .then(r => { setCatDxList(r.data.data || []); setShowCatDx(true); })
        .catch(() => setCatDxList([]));
    }, 300);
    return () => clearTimeout(t);
  }, [catDxQuery]);

  const selCatDx = (cat) => {
    let secArr = [];
    try {
      secArr = typeof cat.diagnosticos_secundarios === "string"
        ? JSON.parse(cat.diagnosticos_secundarios || "[]")
        : (cat.diagnosticos_secundarios || []);
    } catch { secArr = []; }
    setSoap(s => ({
      ...s,
      diagnostico_cie: cat.codigo_cie,
      diagnostico_desc: cat.descripcion_cie,
      diagnosticos_secundarios: secArr,
    }));
    setCatDxQuery("");
    setCatDxList([]);
    setShowCatDx(false);
  };

  const set = (field) => (e) =>
    setSoap(s => ({ ...s, [field]: e.target.value }));

  const addDxSec = () => {
    setSoap(s => ({
      ...s,
      diagnosticos_secundarios: [...s.diagnosticos_secundarios, { cie: "", descripcion: "" }],
    }));
  };

  const remDxSec = (i) => {
    setSoap(s => ({
      ...s,
      diagnosticos_secundarios: s.diagnosticos_secundarios.filter((_, idx) => idx !== i),
    }));
  };

  return (
    <div className="row g-3">
      {/* Signos vitales */}
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <h6 className="fw-semibold mb-3">Signos Vitales</h6>
            <div className="row g-2">
              {VITALS_FIELDS.map(f => (
                <div key={f.key} className="col-6 col-md-3">
                  <label className="form-label small mb-1">{f.label} <span className="text-muted">{f.unit}</span></label>
                  <input
                    className="form-control form-control-sm"
                    placeholder={f.placeholder}
                    value={vitals[f.key] || ""}
                    readOnly={f.readOnly || firmada}
                    onChange={f.readOnly ? undefined : e => setVitals(v => ({ ...v, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Subjetivo */}
      <div className="col-md-6">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <SoapTextareaIA
              label="S — Subjetivo"
              sublabel="(Síntomas referidos por el paciente)"
              campo="subjetivo"
              rows={3}
              value={soap.subjetivo}
              onChange={e => setSoap(s => ({ ...s, subjetivo: e.target.value }))}
              readOnly={firmada}
              placeholder="Motivo de consulta, síntomas, evolución…"
              especialidad={especialidad}
              diagnosticoCie={soap.diagnostico_cie}
              diagnosticoDesc={soap.diagnostico_desc}
            />
          </div>
        </div>
      </div>

      {/* Examen físico */}
      <div className="col-md-6">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <SoapTextareaIA
              label="O — Objetivo"
              sublabel="(Hallazgos al examen físico)"
              campo="objetivo"
              rows={3}
              value={soap.examen_fisico}
              onChange={e => setSoap(s => ({ ...s, examen_fisico: e.target.value }))}
              readOnly={firmada}
              placeholder="Examen físico, hallazgos relevantes…"
              especialidad={especialidad}
              diagnosticoCie={soap.diagnostico_cie}
              diagnosticoDesc={soap.diagnostico_desc}
            />
          </div>
        </div>
      </div>

      {/* Diagnóstico */}
      <div className="col-md-6">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <label className="form-label fw-semibold">
              A — Diagnóstico <small className="text-muted fw-normal">(CIE-10)</small>
            </label>

            {/* Catálogo de diagnósticos frecuentes del médico */}
            {!firmada && (
              <div className="position-relative mb-2">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-warning bg-opacity-10 text-warning border-end-0">
                    <i className="bi bi-lightning-fill"></i>
                  </span>
                  <input className="form-control border-start-0" placeholder="Mis diagnósticos frecuentes…"
                    value={catDxQuery}
                    onChange={e => setCatDxQuery(e.target.value)}
                    onFocus={() => catDxList.length > 0 && setShowCatDx(true)} />
                </div>
                {showCatDx && catDxList.length > 0 && (
                  <ul className="list-group position-absolute z-3 shadow"
                    style={{ top: "100%", left: 0, right: 0, maxHeight: 180, overflowY: "auto" }}>
                    {catDxList.map(c => (
                      <li key={c.id} className="list-group-item list-group-item-action py-1 px-2"
                        style={{ cursor: "pointer", fontSize: "0.82rem" }}
                        onMouseDown={() => selCatDx(c)}>
                        <i className="bi bi-lightning-fill text-warning me-1"></i>
                        <strong>{c.nombre}</strong>
                        {c.codigo_cie && <span className="ms-1 badge text-bg-light border" style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>{c.codigo_cie}</span>}
                        {c.descripcion_cie && <span className="text-muted ms-1">{c.descripcion_cie}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Diagnóstico principal — chip cuando está seleccionado, buscador cuando no */}
            <CieBuscador
              value={soap.diagnostico_cie}
              desc={soap.diagnostico_desc}
              readOnly={firmada}
              onChange={(code, desc) => setSoap(s => ({ ...s, diagnostico_cie: code, diagnostico_desc: desc }))}
              onClear={() => setSoap(s => ({ ...s, diagnostico_cie: "", diagnostico_desc: "" }))}
            />

            {/* Diagnósticos secundarios */}
            {soap.diagnosticos_secundarios.length > 0 && (
              <p className="text-muted small mb-1 mt-3" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Secundarios
              </p>
            )}
            {soap.diagnosticos_secundarios.map((dx, i) => (
              <div key={i} className="d-flex gap-2 align-items-center mt-1">
                <div className="flex-grow-1">
                  <CieBuscador
                    value={dx.cie}
                    desc={dx.descripcion}
                    readOnly={firmada}
                    placeholder={`Secundario ${i + 1}…`}
                    onChange={(code, desc) => setSoap(s => ({
                      ...s,
                      diagnosticos_secundarios: s.diagnosticos_secundarios.map((d, j) =>
                        j === i ? { cie: code, descripcion: desc } : d
                      ),
                    }))}
                    onClear={() => setSoap(s => ({
                      ...s,
                      diagnosticos_secundarios: s.diagnosticos_secundarios.map((d, j) =>
                        j === i ? { cie: "", descripcion: "" } : d
                      ),
                    }))}
                  />
                </div>
                {!firmada && (
                  <button className="btn btn-outline-danger btn-sm" style={{ flexShrink: 0 }}
                    onClick={() => remDxSec(i)}>✕</button>
                )}
              </div>
            ))}
            {!firmada && (
              <button className="btn btn-link btn-sm mt-2 p-0 text-decoration-none" onClick={addDxSec}>
                <i className="bi bi-plus-circle me-1"></i>+ Diagnóstico secundario
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="col-md-6">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <SoapTextareaIA
              label="P — Plan"
              sublabel="(Tratamiento, indicaciones, seguimiento)"
              campo="plan"
              rows={4}
              value={soap.plan}
              onChange={e => setSoap(s => ({ ...s, plan: e.target.value }))}
              readOnly={firmada}
              placeholder="Tratamiento indicado, próxima cita, derivaciones…"
              especialidad={especialidad}
              diagnosticoCie={soap.diagnostico_cie}
              diagnosticoDesc={soap.diagnostico_desc}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: Prescripción (con sub-tabs)
// ══════════════════════════════════════════════════════════════════════
function PrescripcionTab({ historiaId, pacienteId, citaId, firmada, diagnosticoCie, diagnosticoDesc }) {
  const [subTab, setSubTab] = useState("receta");

  return (
    <div>
      {/* Sub-tabs */}
      <ul className="nav nav-pills nav-fill mb-3" style={{ background: "#f8f9fa", borderRadius: 8, padding: "4px" }}>
        {[
          { id: "receta",     icon: "bi-prescription2",         label: "Nueva Receta" },
          { id: "historial",  icon: "bi-clock-history",         label: "Historial" },
          { id: "sugeridas",  icon: "bi-stars",                  label: "Sugeridas por CIE-10" },
          { id: "favoritas",  icon: "bi-bookmark-heart-fill",    label: "Mis Favoritas" },
        ].map(t => (
          <li key={t.id} className="nav-item">
            <button
              className={`nav-link py-1 px-2 ${subTab === t.id ? "active" : "text-muted"}`}
              style={{ fontSize: "0.82rem" }}
              onClick={() => setSubTab(t.id)}
            >
              <i className={`bi ${t.icon} me-1`}></i>{t.label}
            </button>
          </li>
        ))}
      </ul>

      {subTab === "receta"    && <SubRecetaActual historiaId={historiaId} pacienteId={pacienteId} citaId={citaId} firmada={firmada} />}
      {subTab === "historial" && <SubHistorialPaciente pacienteId={pacienteId} />}
      {subTab === "sugeridas" && <SubSugeridadCie diagnosticoCie={diagnosticoCie} diagnosticoDesc={diagnosticoDesc} onAgregar={(items) => setSubTab("receta")} />}
      {subTab === "favoritas" && <SubFavoritas firmada={firmada} />}
    </div>
  );
}

// ── Sub-tab: Receta de esta consulta ──────────────────────────────────────────
function SubRecetaActual({ historiaId, pacienteId, citaId, firmada }) {
  const [list,      setList]      = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [items,     setItems]     = useState([newRxItem()]);
  const [notas,     setNotas]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [savingFav, setSavingFav] = useState(false);
  const [alertMsg,  setAlertMsg]  = useState(null);
  const [medSearch, setMedSearch] = useState([]);
  const [showSaveFav, setShowSaveFav] = useState(false);
  const [favNombre, setFavNombre] = useState("");
  const [medFavSet, setMedFavSet] = useState(new Set());
  const [medFavList, setMedFavList] = useState([]); // top favoritos para mostrar sin escribir

  function newRxItem() {
    return { medicamento_id: null, medicamento_texto: "", dosis: "", duracion: "", cantidad: "", instrucciones: "" };
  }

  // Cargar favoritos del médico al montar
  useEffect(() => {
    api.get("/medicamentos/favoritos")
      .then(r => {
        const ids = r.data.data || [];
        setMedFavSet(new Set(ids));
        if (ids.length > 0) {
          // Buscar datos completos de los primeros 8 favoritos
          api.get("/medicamentos", { params: { q: "" } })
            .then(r2 => setMedFavList((r2.data.data || []).filter(m => ids.includes(m.id)).slice(0, 8)))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const printRx = async (id) => {
    try {
      const res = await api.get(`/prescripciones/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (err) {
      window.alert("No se pudo generar el PDF: " + (err?.response?.data?.msg || err.message));
    }
  };

  useEffect(() => {
    if (!historiaId && !pacienteId) return;
    const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
    api.get("/prescripciones", { params })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  }, [historiaId, pacienteId]);

  const searchMed = (q, idx) => {
    if (q.length < 2) {
      // Mostrar favoritos cuando el campo está vacío o con 1 caracter
      if (medFavList.length > 0) {
        setMedSearch({ idx, list: medFavList, soloFavoritos: true });
      } else {
        setMedSearch([]);
      }
      return;
    }
    api.get("/medicamentos", { params: { q } })
      .then(r => setMedSearch({ idx, list: r.data.data || [] }))
      .catch(() => {});
  };

  const selMed = (med, idx) => {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      medicamento_id: med.id,
      medicamento_texto: med.nombre_generico + (med.presentacion ? ` (${med.presentacion})` : ""),
      dosis: med.dosis_default || it.dosis,
      duracion: med.duracion_default || it.duracion,
      cantidad: med.cantidad_default || it.cantidad,
      instrucciones: med.instrucciones_default || it.instrucciones,
    } : it));
    setMedSearch([]);
  };

  const setItem = (idx, field, val) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const handleSubmit = async () => {
    if (!pacienteId) { setAlertMsg({ type: "danger", msg: "Falta paciente_id" }); return; }
    setSaving(true);
    try {
      await api.post("/prescripciones", {
        historia_id: historiaId || null,
        cita_id: citaId || null,
        paciente_id: pacienteId,
        notas,
        items: items.filter(it => it.medicamento_texto || it.medicamento_id),
      });
      const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
      const r = await api.get("/prescripciones", { params });
      setList(r.data.data || []);
      setShowForm(false);
      setItems([newRxItem()]);
      setNotas("");
      setAlertMsg({ type: "success", msg: "Receta creada" });
    } catch (e) {
      setAlertMsg({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFavorita = async () => {
    if (!favNombre.trim()) return;
    setSavingFav(true);
    try {
      await api.post("/prescripciones/favoritas", {
        nombre: favNombre.trim(),
        notas,
        items: items.filter(it => it.medicamento_texto || it.medicamento_id),
      });
      setShowSaveFav(false);
      setFavNombre("");
      setAlertMsg({ type: "success", msg: "Guardada en Mis Favoritas ⭐" });
    } catch (e) {
      setAlertMsg({ type: "danger", msg: "No se pudo guardar como favorita" });
    } finally {
      setSavingFav(false);
    }
  };

  return (
    <div>
      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} py-2 alert-dismissible mb-3`}>
          {alertMsg.msg} <button className="btn-close" onClick={() => setAlertMsg(null)} />
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Recetas de esta consulta</h6>
        {!firmada && !showForm && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Nueva Receta</button>
        )}
      </div>

      {list.length === 0 && !showForm && <p className="text-muted">Sin recetas aún.</p>}
      {list.map(p => (
        <div key={p.id} className="card border-0 shadow-sm mb-2">
          <div className="card-body py-2 d-flex align-items-center justify-content-between">
            <div>
              <span className="badge bg-secondary me-2">{p.estado}</span>
              <strong>{p.total_items} medicamento(s)</strong>
              <small className="text-muted ms-2">{dayjs(p.creado_en).format("DD/MM/YYYY HH:mm")}</small>
            </div>
            <div className="d-flex gap-1">
              {p.estado === "ACTIVA" && !firmada && (
                <button className="btn btn-outline-success btn-sm"
                  onClick={() => api.patch(`/prescripciones/${p.id}/estado`, { estado: "ENTREGADA" })
                    .then(() => setList(prev => prev.map(x => x.id === p.id ? { ...x, estado: "ENTREGADA" } : x)))}>
                  Marcar entregada
                </button>
              )}
              <button className="btn btn-outline-primary btn-sm" onClick={() => printRx(p.id)}>
                <i className="bi bi-printer me-1"></i>Receta PDF
              </button>
            </div>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="card border-primary shadow-sm mt-3">
          <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
            <span>Nueva Receta</span>
            <button className="btn btn-outline-warning btn-sm"
              title="Guardar como favorita"
              onClick={() => setShowSaveFav(s => !s)}>
              <i className="bi bi-bookmark-heart me-1"></i>Guardar como favorita
            </button>
          </div>
          {showSaveFav && (
            <div className="border-bottom px-3 py-2 d-flex gap-2 align-items-center" style={{ background: "#fffbeb" }}>
              <input className="form-control form-control-sm" placeholder="Nombre de la favorita (ej: IRA en adultos)"
                value={favNombre} onChange={e => setFavNombre(e.target.value)} style={{ maxWidth: 300 }} />
              <button className="btn btn-warning btn-sm text-nowrap" onClick={handleSaveFavorita} disabled={savingFav}>
                {savingFav ? "Guardando…" : "⭐ Guardar"}
              </button>
            </div>
          )}
          <div className="card-body">
            {items.map((item, idx) => (
              <div key={idx} className="border rounded p-2 mb-2 position-relative">
                <div className="fw-semibold small mb-2 text-muted d-flex justify-content-between align-items-center">
                  <span>Medicamento {idx + 1}</span>
                  {item.medicamento_id && (
                    <span className="badge bg-success bg-opacity-10 text-success" style={{ fontSize: "0.7rem" }}>
                      <i className="bi bi-lightning-fill me-1"></i>Auto-llenado desde catálogo
                    </span>
                  )}
                </div>
                <div className="row g-2">
                  <div className="col-12 position-relative">
                    <label className="form-label small mb-1">Medicamento</label>
                    <input className="form-control form-control-sm" placeholder="Buscar o escribir…"
                      value={item.medicamento_texto}
                      onFocus={() => { if (!item.medicamento_texto) searchMed("", idx); }}
                      onChange={e => { setItem(idx, "medicamento_texto", e.target.value); setItem(idx, "medicamento_id", null); searchMed(e.target.value, idx); }}
                      onBlur={() => setTimeout(() => setMedSearch([]), 200)} />
                    {medSearch?.idx === idx && medSearch.list?.length > 0 && (
                      <ul className="list-group position-absolute z-3 shadow"
                        style={{ top: "100%", left: 0, right: 0, maxHeight: 200, overflowY: "auto" }}>
                        {medSearch.soloFavoritos && (
                          <li className="list-group-item py-1 px-2 bg-warning bg-opacity-10 text-warning fw-semibold"
                            style={{ fontSize: "0.72rem", pointerEvents: "none" }}>
                            <i className="bi bi-star-fill me-1"></i>Mis medicamentos favoritos
                          </li>
                        )}
                        {medSearch.list.map(m => {
                          const esFav = medFavSet.has(m.id) || m.es_favorito === 1;
                          return (
                          <li key={m.id} className="list-group-item list-group-item-action py-1"
                            style={{ cursor: "pointer", fontSize: "0.8rem" }}
                            onClick={() => selMed(m, idx)}>
                            {esFav && <i className="bi bi-star-fill text-warning me-1" style={{ fontSize: "0.7rem" }}></i>}
                            <strong>{m.nombre_generico}</strong>
                            {m.presentacion && <span className="text-muted ms-1">({m.presentacion})</span>}
                            {(m.dosis_default || m.duracion_default) && (
                              <span className="text-success ms-2" style={{ fontSize: "0.7rem" }}>
                                <i className="bi bi-lightning-fill"></i> con defaults
                              </span>
                            )}
                          </li>
                        );})}
                      </ul>
                    )}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1">Dosis</label>
                    <input className="form-control form-control-sm" placeholder="500mg c/8h"
                      value={item.dosis} onChange={e => setItem(idx, "dosis", e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1">Duración</label>
                    <input className="form-control form-control-sm" placeholder="7 días"
                      value={item.duracion} onChange={e => setItem(idx, "duracion", e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1">Cantidad</label>
                    <input className="form-control form-control-sm" placeholder="21 tabletas"
                      value={item.cantidad} onChange={e => setItem(idx, "cantidad", e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1">Instrucciones</label>
                    <input className="form-control form-control-sm" placeholder="Tomar con alimentos…"
                      value={item.instrucciones} onChange={e => setItem(idx, "instrucciones", e.target.value)} />
                  </div>
                </div>
                {items.length > 1 && (
                  <button className="btn btn-outline-danger btn-sm position-absolute top-0 end-0 m-1"
                    onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>✕</button>
                )}
              </div>
            ))}
            <button className="btn btn-outline-primary btn-sm me-2"
              onClick={() => setItems(prev => [...prev, { medicamento_id: null, medicamento_texto: "", dosis: "", duracion: "", cantidad: "", instrucciones: "" }])}>
              + Agregar medicamento
            </button>
            <div className="mt-3">
              <label className="form-label small">Notas adicionales</label>
              <textarea className="form-control form-control-sm" rows={2}
                value={notas} onChange={e => setNotas(e.target.value)} />
            </div>
            <div className="d-flex gap-2 mt-3">
              <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
                {saving ? "Guardando…" : "Crear Receta"}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-tab: Historial completo del paciente ──────────────────────────────────
function SubHistorialPaciente({ pacienteId }) {
  const [historial, setHistorial] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState(null);

  useEffect(() => {
    if (!pacienteId) return;
    setLoading(true);
    api.get(`/prescripciones/historial-paciente/${pacienteId}`)
      .then(r => setHistorial(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pacienteId]);

  if (loading) return <div className="text-center py-4"><span className="spinner-border spinner-border-sm"></span> Cargando historial…</div>;
  if (!historial.length) return <p className="text-muted py-3">Sin recetas previas para este paciente.</p>;

  return (
    <div>
      <p className="text-muted small mb-3">{historial.length} receta(s) encontradas</p>
      {historial.map(rx => (
        <div key={rx.id} className="card border-0 shadow-sm mb-2">
          <div className="card-body py-2"
            style={{ cursor: "pointer" }}
            onClick={() => setExpanded(expanded === rx.id ? null : rx.id)}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className={`badge me-2 bg-${rx.estado === "ENTREGADA" ? "success" : rx.estado === "CANCELADA" ? "secondary" : "warning text-dark"}`}>
                  {rx.estado}
                </span>
                <strong className="small">{rx.total_items} medicamento(s)</strong>
                {rx.diagnostico_cie && (
                  <span className="badge text-bg-light border ms-2" style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>
                    {rx.diagnostico_cie}
                  </span>
                )}
              </div>
              <div className="text-end">
                <div className="small text-muted">{dayjs(rx.creado_en).format("DD/MM/YYYY")}</div>
                <div style={{ fontSize: "0.75rem", color: "#888" }}>
                  Dr. {rx.med_apellidos}, {rx.med_nombres}
                </div>
              </div>
            </div>
            {expanded === rx.id && rx.items?.length > 0 && (
              <div className="mt-2 pt-2 border-top">
                {rx.items.map((it, i) => (
                  <div key={i} className="d-flex align-items-start gap-2 mb-1">
                    <i className="bi bi-capsule text-primary mt-1" style={{ fontSize: "0.75rem" }}></i>
                    <div style={{ fontSize: "0.82rem" }}>
                      <strong>{it.nombre}</strong>
                      {it.presentacion && <span className="text-muted ms-1">({it.presentacion})</span>}
                      {it.dosis && <span className="ms-2 badge text-bg-light border">{it.dosis}</span>}
                      {it.duracion && <span className="ms-1 text-muted">· {it.duracion}</span>}
                      {it.instrucciones && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{it.instrucciones}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-tab: Sugerencias por CIE-10 ──────────────────────────────────────────
function SubSugeridadCie({ diagnosticoCie, diagnosticoDesc }) {
  const [sugeridas, setSugeridas] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [agregados, setAgregados] = useState(new Set());
  const [alertMsg,  setAlertMsg]  = useState(null);

  useEffect(() => {
    if (!diagnosticoCie) { setSugeridas([]); return; }
    setLoading(true);
    api.get("/prescripciones/sugerencias-cie10", { params: { codigo: diagnosticoCie } })
      .then(r => setSugeridas(r.data.data || []))
      .catch(() => setSugeridas([]))
      .finally(() => setLoading(false));
  }, [diagnosticoCie]);

  if (!diagnosticoCie) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="bi bi-search" style={{ fontSize: "2rem", opacity: 0.4 }}></i>
        <p className="mt-2">Selecciona un diagnóstico CIE-10 en la pestaña SOAP para ver sugerencias.</p>
      </div>
    );
  }

  return (
    <div>
      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} py-2 alert-dismissible mb-3`}>
          {alertMsg.msg} <button className="btn-close" onClick={() => setAlertMsg(null)} />
        </div>
      )}

      <div className="d-flex align-items-center gap-2 mb-3">
        <span className="badge bg-primary" style={{ fontFamily: "monospace" }}>{diagnosticoCie}</span>
        <span className="small fw-semibold">{diagnosticoDesc}</span>
      </div>

      {loading && <div className="text-muted"><span className="spinner-border spinner-border-sm me-2"></span>Buscando medicamentos…</div>}

      {!loading && sugeridas.length === 0 && (
        <p className="text-muted">No hay sugerencias específicas para este diagnóstico. Usa el catálogo de medicamentos en la receta.</p>
      )}

      {sugeridas.length > 0 && (
        <p className="text-muted small mb-2">{sugeridas.length} medicamento(s) frecuente(s) para este diagnóstico:</p>
      )}

      {sugeridas.map(med => (
        <div key={med.id} className={`card border-0 shadow-sm mb-2 ${agregados.has(med.id) ? "border-success" : ""}`}
          style={{ borderLeft: agregados.has(med.id) ? "3px solid #198754" : "3px solid #dee2e6" }}>
          <div className="card-body py-2 px-3">
            <div className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1">
                <div className="fw-semibold small">{med.nombre_generico}</div>
                {med.nombre_comercial && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{med.nombre_comercial}</div>}
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {med.presentacion && <span className="badge text-bg-light border" style={{ fontSize: "0.7rem" }}>{med.presentacion}</span>}
                  {med.dosis_default && <span className="badge text-bg-info bg-opacity-10 text-info border" style={{ fontSize: "0.7rem" }}>{med.dosis_default}</span>}
                  {med.duracion_default && <span className="badge text-bg-secondary bg-opacity-10 border" style={{ fontSize: "0.7rem" }}>{med.duracion_default}</span>}
                </div>
                {med.instrucciones_default && (
                  <div className="text-muted mt-1" style={{ fontSize: "0.74rem" }}>{med.instrucciones_default}</div>
                )}
              </div>
              {!agregados.has(med.id) ? (
                <button className="btn btn-outline-primary btn-sm ms-2 text-nowrap"
                  style={{ flexShrink: 0 }}
                  onClick={async () => {
                    // Copiar al portapapeles como favorita no, mas bien ir a crear receta
                    try {
                      // Agregar directo como item en una nueva receta usando el endpoint de prescripción
                      // Guardamos como "seleccionado" para feedback visual
                      setAgregados(prev => new Set(prev).add(med.id));
                      setAlertMsg({ type: "success", msg: `✓ ${med.nombre_generico} — Ve a "Nueva Receta" y búscalo en el catálogo, ya tiene dosis pre-llenada.` });
                    } catch {}
                  }}>
                  <i className="bi bi-plus-circle me-1"></i>Seleccionar
                </button>
              ) : (
                <span className="badge bg-success ms-2" style={{ padding: "6px 10px" }}>
                  <i className="bi bi-check-lg me-1"></i>Seleccionado
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-tab: Recetas favoritas del médico ─────────────────────────────────────
function SubFavoritas({ firmada }) {
  const [favoritas, setFavoritas] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [expandedFav, setExpandedFav] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  const cargar = () => {
    setLoading(true);
    api.get("/prescripciones/favoritas")
      .then(r => setFavoritas(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const eliminar = async (id) => {
    try {
      await api.delete(`/prescripciones/favoritas/${id}`);
      setFavoritas(prev => prev.filter(f => f.id !== id));
    } catch {
      setAlertMsg({ type: "danger", msg: "No se pudo eliminar" });
    }
  };

  if (loading) return <div className="text-center py-4"><span className="spinner-border spinner-border-sm"></span></div>;

  return (
    <div>
      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} py-2 alert-dismissible mb-3`}>
          {alertMsg.msg} <button className="btn-close" onClick={() => setAlertMsg(null)} />
        </div>
      )}

      {favoritas.length === 0 && (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-bookmark-heart" style={{ fontSize: "2.5rem", opacity: 0.3 }}></i>
          <p className="mt-2 small">No tienes recetas favoritas guardadas.<br/>Crea una receta y usa el botón <strong>"Guardar como favorita"</strong>.</p>
        </div>
      )}

      {favoritas.map(fav => (
        <div key={fav.id} className="card border-0 shadow-sm mb-2">
          <div className="card-body py-2 px-3">
            <div className="d-flex justify-content-between align-items-center"
              style={{ cursor: "pointer" }}
              onClick={() => setExpandedFav(expandedFav === fav.id ? null : fav.id)}>
              <div>
                <i className="bi bi-bookmark-heart-fill text-warning me-2"></i>
                <strong className="small">{fav.nombre}</strong>
                <span className="badge text-bg-light border ms-2" style={{ fontSize: "0.7rem" }}>
                  {fav.items?.length || 0} med.
                </span>
              </div>
              <div className="d-flex gap-1 align-items-center">
                <small className="text-muted me-2">{dayjs(fav.creado_en).format("DD/MM/YY")}</small>
                {!firmada && (
                  <button className="btn btn-sm btn-outline-secondary py-0 px-2"
                    style={{ fontSize: "0.72rem" }}
                    title="Usar esta receta en la consulta actual"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Mensaje orientativo — el usuario la ve y la recrea manualmente o con el buscador
                      setAlertMsg({ type: "info", msg: `Ve a "Nueva Receta" y usa el buscador para agregar los medicamentos de "${fav.nombre}".` });
                      setExpandedFav(fav.id);
                    }}>
                    <i className="bi bi-clipboard-plus me-1"></i>Usar
                  </button>
                )}
                <button className="btn btn-sm btn-outline-danger py-0 px-2"
                  style={{ fontSize: "0.72rem" }}
                  onClick={(e) => { e.stopPropagation(); eliminar(fav.id); }}>
                  <i className="bi bi-trash3"></i>
                </button>
              </div>
            </div>
            {expandedFav === fav.id && fav.items?.length > 0 && (
              <div className="mt-2 pt-2 border-top">
                {fav.notas && <p className="text-muted small mb-2 fst-italic">"{fav.notas}"</p>}
                {fav.items.map((it, i) => (
                  <div key={i} className="d-flex align-items-start gap-2 mb-1">
                    <i className="bi bi-capsule text-warning mt-1" style={{ fontSize: "0.75rem" }}></i>
                    <div style={{ fontSize: "0.82rem" }}>
                      <strong>{it.medicamento_texto}</strong>
                      {it.dosis && <span className="ms-2 badge text-bg-light border">{it.dosis}</span>}
                      {it.duracion && <span className="ms-1 text-muted">· {it.duracion}</span>}
                      {it.cantidad && <span className="ms-1 text-muted">· {it.cantidad}</span>}
                      {it.instrucciones && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{it.instrucciones}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: Estudios
// ══════════════════════════════════════════════════════════════════════
const ESTADO_BADGE = {
  SOLICITADO:  "warning",
  EN_PROCESO:  "info",
  COMPLETADO:  "success",
  CANCELADO:   "secondary",
};

function EstudiosTab({ historiaId, pacienteId, firmada }) {
  const [list,     setList]     = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ tipo: "LABORATORIO", descripcion: "", urgente: false });
  const [saving,   setSaving]   = useState(false);
  const [alertEstudios, setAlertEstudios] = useState(null);

  // ── Catálogo de estudios ──
  const [catEstQuery, setCatEstQuery] = useState("");
  const [catEstList, setCatEstList]   = useState([]);
  const [showCatEst, setShowCatEst]   = useState(false);

  useEffect(() => {
    if (!catEstQuery || catEstQuery.length < 2) { setCatEstList([]); return; }
    const t = setTimeout(() => {
      api.get("/catalogos-estudios", { params: { q: catEstQuery } })
        .then(r => { setCatEstList(r.data.data || []); setShowCatEst(true); })
        .catch(() => setCatEstList([]));
    }, 300);
    return () => clearTimeout(t);
  }, [catEstQuery]);

  const selCatEst = (cat) => {
    setForm(f => ({
      ...f,
      tipo: cat.categoria || "LABORATORIO",
      descripcion: f.descripcion
        ? f.descripcion + ", " + cat.nombre + (cat.descripcion ? ` (${cat.descripcion})` : "")
        : cat.nombre + (cat.descripcion ? ` (${cat.descripcion})` : ""),
    }));
    setCatEstQuery("");
    setCatEstList([]);
    setShowCatEst(false);
  };

  useEffect(() => {
    if (!historiaId && !pacienteId) return;
    const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
    api.get("/estudios", { params })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  }, [historiaId, pacienteId]);

  const handleSubmit = async () => {
    if (!form.descripcion) { setAlertEstudios({ type: "danger", msg: "Ingresa la descripción" }); return; }
    setSaving(true);
    try {
      await api.post("/estudios", {
        paciente_id: pacienteId,
        historia_id: historiaId || null,
        tipo:        form.tipo,
        descripcion: form.descripcion,
        urgente:     form.urgente ? 1 : 0,
      });
      const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
      const r = await api.get("/estudios", { params });
      setList(r.data.data || []);
      setShowForm(false);
      setForm({ tipo: "LABORATORIO", descripcion: "", urgente: false });
      setAlertEstudios({ type: "success", msg: "Solicitud creada" });
    } catch (e) {
      setAlertEstudios({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {alertEstudios && (
        <div className={`alert alert-${alertEstudios.type} py-2 alert-dismissible mb-3`}>
          {alertEstudios.msg} <button className="btn-close" onClick={() => setAlertEstudios(null)} />
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Solicitudes de Estudios</h6>
        {!firmada && !showForm && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Nueva Solicitud</button>
        )}
      </div>

      {list.length === 0 && !showForm && <p className="text-muted">Sin solicitudes.</p>}
      {list.map(s => (
        <div key={s.id} className="card border-0 shadow-sm mb-2">
          <div className="card-body py-2">
            <div className="d-flex justify-content-between">
              <div>
                <span className={`badge bg-${ESTADO_BADGE[s.estado]} me-2`}>{s.estado}</span>
                <span className="badge bg-light text-dark border me-2">{s.tipo}</span>
                {s.urgente === 1 && <span className="badge bg-danger">URGENTE</span>}
              </div>
              <small className="text-muted">{dayjs(s.creado_en).format("DD/MM/YYYY")}</small>
            </div>
            <p className="mb-0 mt-1 small">{s.descripcion}</p>
            {s.estado === "SOLICITADO" && !firmada && (
              <button className="btn btn-outline-secondary btn-sm mt-1"
                onClick={() => api.patch(`/estudios/${s.id}/estado`, { estado: "EN_PROCESO" })
                  .then(() => setList(prev => prev.map(x => x.id === s.id ? { ...x, estado: "EN_PROCESO" } : x)))}>
                → En Proceso
              </button>
            )}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="card border-primary shadow-sm mt-3">
          <div className="card-header fw-semibold">Nueva Solicitud</div>
          <div className="card-body row g-2">
            {/* Buscador de catálogo de estudios */}
            <div className="col-12 position-relative">
              <label className="form-label small">
                <i className="bi bi-journal-bookmark-fill text-info me-1"></i>Buscar en catálogo de estudios
              </label>
              <input className="form-control form-control-sm" placeholder="Buscar estudio del catálogo…"
                value={catEstQuery}
                onChange={e => setCatEstQuery(e.target.value)}
                onFocus={() => catEstList.length > 0 && setShowCatEst(true)} />
              {showCatEst && catEstList.length > 0 && (
                <ul className="list-group position-absolute z-3 shadow"
                  style={{ top: "100%", left: 0, right: 0, maxHeight: 180, overflowY: "auto" }}>
                  {catEstList.map(c => (
                    <li key={c.id} className="list-group-item list-group-item-action py-1"
                      style={{ cursor: "pointer", fontSize: "0.82rem" }}
                      onClick={() => selCatEst(c)}>
                      <i className="bi bi-lightning-fill text-warning me-1"></i>
                      <strong>{c.nombre}</strong>
                      <span className={`badge ms-2 ${c.categoria === "LABORATORIO" ? "bg-primary" : c.categoria === "IMAGENOLOGIA" ? "bg-info text-dark" : "bg-secondary"}`} style={{ fontSize: "0.68rem" }}>
                        {c.categoria}
                      </span>
                      {c.descripcion && <span className="text-muted ms-1">— {c.descripcion}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="col-md-4">
              <label className="form-label small">Tipo</label>
              <select className="form-select form-select-sm"
                value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {["LABORATORIO","IMAGENOLOGIA","OTRO"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-md-8">
              <label className="form-label small">Descripción de estudios</label>
              <textarea className="form-control form-control-sm" rows={2}
                placeholder="Hemograma completo, glucosa, creatinina…"
                value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className="col-12">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="urgente-check"
                  checked={form.urgente} onChange={e => setForm(f => ({ ...f, urgente: e.target.checked }))} />
                <label className="form-check-label small" htmlFor="urgente-check">Urgente</label>
              </div>
            </div>
            <div className="col-12 d-flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
                {saving ? "Guardando…" : "Crear Solicitud"}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: Antecedentes & Alergias
// ══════════════════════════════════════════════════════════════════════
const TIPOS_ANTECEDENTE = ["patologico","quirurgico","familiar","ginecobstetrico","habitos","otros"];
const SEVERIDAD_COLOR   = { LEVE: "success", MODERADA: "warning", SEVERA: "danger", MORTAL: "dark" };

function AntecedentesTab({ pacienteId, firmada }) {
  const [antecedentes, setAntecedentes] = useState([]);
  const [alergias,     setAlergias]     = useState([]);
  const [showAnt,      setShowAnt]      = useState(false);
  const [showAler,     setShowAler]     = useState(false);
  const [formAnt,      setFormAnt]      = useState({ tipo: "patologico", descripcion: "" });
  const [formAler,     setFormAler]     = useState({ agente: "", tipo: "MEDICAMENTO", severidad: "MODERADA", reaccion: "" });
  const [saving,       setSaving]       = useState(false);
  const [alertAntecedentes, setAlertAntecedentes] = useState(null);

  useEffect(() => {
    if (!pacienteId) return;
    Promise.all([
      api.get(`/historias/paciente/${pacienteId}/antecedentes`),
      api.get(`/historias/paciente/${pacienteId}/alergias`),
    ]).then(([a, al]) => {
      setAntecedentes(a.data.data || []);
      setAlergias(al.data.data || []);
    }).catch(() => {});
  }, [pacienteId]);

  const saveAntecedente = async () => {
    if (!formAnt.descripcion) return;
    setSaving(true);
    try {
      await api.post(`/historias/paciente/${pacienteId}/antecedentes`, formAnt);
      const r = await api.get(`/historias/paciente/${pacienteId}/antecedentes`);
      setAntecedentes(r.data.data || []);
      setShowAnt(false);
      setFormAnt({ tipo: "patologico", descripcion: "" });
    } catch (e) {
      setAlertAntecedentes({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  const saveAlergia = async () => {
    if (!formAler.agente) return;
    setSaving(true);
    try {
      await api.post(`/historias/paciente/${pacienteId}/alergias`, formAler);
      const r = await api.get(`/historias/paciente/${pacienteId}/alergias`);
      setAlergias(r.data.data || []);
      setShowAler(false);
      setFormAler({ agente: "", tipo: "MEDICAMENTO", severidad: "MODERADA", reaccion: "" });
    } catch (e) {
      setAlertAntecedentes({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  // agrupar antecedentes por tipo
  const byTipo = TIPOS_ANTECEDENTE.reduce((acc, t) => {
    acc[t] = antecedentes.filter(a => a.tipo === t);
    return acc;
  }, {});

  return (
    <div className="row g-3">
      {alertAntecedentes && (
        <div className="col-12">
          <div className={`alert alert-${alertAntecedentes.type} py-2`}>{alertAntecedentes.msg}</div>
        </div>
      )}

      {/* Alergias */}
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">Alergias Conocidas</h6>
              {!firmada && (
                <button className="btn btn-outline-danger btn-sm" onClick={() => setShowAler(!showAler)}>
                  + Alergia
                </button>
              )}
            </div>

            {alergias.length === 0 && <p className="text-muted small mb-0">Sin alergias registradas.</p>}
            <div className="d-flex flex-wrap gap-2">
              {alergias.map(a => (
                <span key={a.id} className={`badge bg-${SEVERIDAD_COLOR[a.severidad] || "secondary"}`}>
                  ⚠ {a.agente} ({a.tipo}) — {a.severidad}
                </span>
              ))}
            </div>

            {showAler && (
              <div className="row g-2 mt-2 border-top pt-2">
                <div className="col-md-4">
                  <input className="form-control form-control-sm" placeholder="Agente (ej: Penicilina)"
                    value={formAler.agente} onChange={e => setFormAler(f => ({ ...f, agente: e.target.value }))} />
                </div>
                <div className="col-md-3">
                  <select className="form-select form-select-sm"
                    value={formAler.tipo} onChange={e => setFormAler(f => ({ ...f, tipo: e.target.value }))}>
                    {["MEDICAMENTO","ALIMENTO","AMBIENTAL","OTRO"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <select className="form-select form-select-sm"
                    value={formAler.severidad} onChange={e => setFormAler(f => ({ ...f, severidad: e.target.value }))}>
                    {["LEVE","MODERADA","SEVERA","MORTAL"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <button className="btn btn-danger btn-sm w-100" onClick={saveAlergia} disabled={saving}>
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Antecedentes */}
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Antecedentes</h6>
              {!firmada && (
                <button className="btn btn-outline-primary btn-sm" onClick={() => setShowAnt(!showAnt)}>
                  + Antecedente
                </button>
              )}
            </div>

            {TIPOS_ANTECEDENTE.map(tipo => (
              byTipo[tipo]?.length > 0 && (
                <div key={tipo} className="mb-3">
                  <div className="text-muted small fw-semibold text-uppercase mb-1">{tipo.replace("_", " ")}</div>
                  {byTipo[tipo].map(a => (
                    <div key={a.id} className="d-flex align-items-start gap-2 mb-1">
                      <span className="text-muted">•</span>
                      <span className="small">{a.descripcion}</span>
                    </div>
                  ))}
                </div>
              )
            ))}

            {antecedentes.length === 0 && !showAnt && (
              <p className="text-muted small">Sin antecedentes registrados.</p>
            )}

            {showAnt && (
              <div className="row g-2 border-top pt-2">
                <div className="col-md-4">
                  <select className="form-select form-select-sm"
                    value={formAnt.tipo} onChange={e => setFormAnt(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS_ANTECEDENTE.map(t => (
                      <option key={t} value={t}>{t.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <input className="form-control form-control-sm" placeholder="Descripción"
                    value={formAnt.descripcion} onChange={e => setFormAnt(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
                <div className="col-md-2">
                  <button className="btn btn-primary btn-sm w-100" onClick={saveAntecedente} disabled={saving}>
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Modal Nueva Consulta Sin Cita ────────────────────────────────────────────
function ModalConsultaSinCita({ paciente, onClose, onCreated }) {
  const [modo, setModo] = useState(null);
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState("");
  const [fechaSel, setFechaSel] = useState(dayjs().format("YYYY-MM-DD"));
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotSel, setSlotSel] = useState("");
  const [tipo, setTipo] = useState("PRIMERA_VEZ");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/usuarios/medicos")
      .then(r => setMedicos(r.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!medicoId || !fechaSel) { setSlots([]); return; }
    api.get("/citas/slots", { params: { medico_id: medicoId, fecha: fechaSel } })
      .then(r => setSlots(r.data.data || []))
      .catch(() => setSlots([]));
  }, [medicoId, fechaSel]);

  const selSlot = (s) => {
    setSlotSel(s.inicio);
    setHoraInicio(dayjs(s.inicio).format("HH:mm"));
    setHoraFin(dayjs(s.fin).format("HH:mm"));
  };

  const agendarAhora = async () => {
    if (!medicoId) { setErr("Selecciona un médico"); return; }
    setSaving(true); setErr("");
    try {
      const inicio = dayjs().format("YYYY-MM-DD HH:mm:ss");
      const fin = dayjs().add(30, "minute").format("YYYY-MM-DD HH:mm:ss");
      const res = await api.post("/citas", {
        paciente_id: paciente.id, medico_id: medicoId,
        inicio, fin, tipo_consulta: tipo, motivo: motivo || null, canal: "RECEPCION",
      });
      await api.patch(`/citas/${res.data.id}/estado`, { estado: "EN_ATENCION" });
      onCreated(res.data.id);
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  const agendarSeleccionado = async () => {
    if (!medicoId) { setErr("Selecciona un médico"); return; }
    if (!horaInicio || !horaFin) { setErr("Ingresa hora de inicio y fin"); return; }
    const inicio = dayjs(`${fechaSel} ${horaInicio}`);
    const fin = dayjs(`${fechaSel} ${horaFin}`);
    if (fin.isBefore(inicio) || fin.isSame(inicio)) {
      setErr("La hora de fin debe ser posterior a la hora de inicio"); return;
    }
    setSaving(true); setErr("");
    try {
      const res = await api.post("/citas", {
        paciente_id: paciente.id, medico_id: medicoId,
        inicio: inicio.format("YYYY-MM-DD HH:mm:ss"),
        fin: fin.format("YYYY-MM-DD HH:mm:ss"),
        tipo_consulta: tipo, motivo: motivo || null, canal: "RECEPCION",
      });
      onCreated(res.data.id);
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 9998 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: modo === "seleccionar" ? 600 : 500 }}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: "#673ab7", color: "#fff" }}>
            <h5 className="modal-title">
              <i className="bi bi-clipboard2-pulse me-2"></i>Nueva Consulta
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="alert alert-warning py-2 mb-3">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>{paciente.apellidos}, {paciente.nombres}</strong> no tiene consulta agendada para hoy.
            </div>
            {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}

            {!modo && (
              <div className="text-center py-2">
                <p className="mb-3">¿Desea agendar una consulta?</p>
                <div className="d-flex justify-content-center gap-3">
                  <button className="btn btn-success px-4" onClick={() => setModo("ahora")}>
                    <i className="bi bi-clock-fill me-2"></i>Ahora
                  </button>
                  <button className="btn btn-primary px-4" onClick={() => setModo("seleccionar")}>
                    <i className="bi bi-calendar-event me-2"></i>Seleccionar
                  </button>
                </div>
              </div>
            )}

            {modo === "ahora" && (
              <div>
                <p className="text-muted small mb-2">
                  Se creará una cita para <strong>ahora ({dayjs().format("h:mm A")})</strong> con duración de 30 minutos.
                </p>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médico</label>
                  <select className="form-select" value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
                    ))}
                  </select>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                      {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Motivo</label>
                    <input className="form-control form-control-sm" value={motivo}
                      onChange={e => setMotivo(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              </div>
            )}

            {modo === "seleccionar" && (
              <div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médico</label>
                  <select className="form-select" value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
                    ))}
                  </select>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha</label>
                    <input type="date" className="form-control" value={fechaSel}
                      onChange={e => setFechaSel(e.target.value)} />
                  </div>
                </div>
                {slots.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Horarios disponibles</label>
                    <div className="d-flex flex-wrap gap-2">
                      {slots.map((s, i) => (
                        <button key={i}
                          className={`btn btn-sm ${slotSel === s.inicio ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => selSlot(s)}>
                          {dayjs(s.inicio).format("HH:mm")} – {dayjs(s.fin).format("HH:mm")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Hora inicio</label>
                    <input type="time" className="form-control" value={horaInicio}
                      onChange={e => setHoraInicio(e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Hora fin</label>
                    <input type="time" className="form-control" value={horaFin}
                      onChange={e => setHoraFin(e.target.value)} />
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                      {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Motivo</label>
                    <input className="form-control form-control-sm" value={motivo}
                      onChange={e => setMotivo(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              </div>
            )}
          </div>
          {modo && (
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModo(null)}>Atrás</button>
              <button className="btn btn-success" disabled={saving}
                onClick={modo === "ahora" ? agendarAhora : agendarSeleccionado}>
                {saving ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          )}
          {!modo && (
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

