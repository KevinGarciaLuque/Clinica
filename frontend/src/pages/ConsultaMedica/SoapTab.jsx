import { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import { VITALS_FIELDS } from "./helpers";

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
    const sep = value.trimEnd().endsWith(".") || value.trimEnd().endsWith(",") ? " " : ". ";
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
  const [q, setQ]         = useState("");
  const [list, setList]   = useState([]);
  const [openUp, setOpenUp] = useState(false);
  const ref               = useRef(null);
  const inputRef          = useRef(null);

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

  const checkDirection = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setOpenUp(window.innerHeight - rect.bottom < 280);
    }
  };

  const sel = (item) => {
    onChange(item.codigo, item.descripcion);
    setQ("");
    setList([]);
  };

  const selLibre = () => {
    const texto = q.trim();
    if (!texto) return;
    onChange("", texto);
    setQ("");
    setList([]);
  };

  // Chip cuando ya hay un diagnóstico seleccionado (con o sin código CIE)
  if (value || desc) {
    const esLibre = !value;
    return (
      <div className="d-flex align-items-center gap-2 px-2 py-2 rounded border"
        style={{ background: esLibre ? "rgba(107,114,128,0.07)" : "rgba(25,135,84,0.07)", minHeight: 36 }}>
        {esLibre
          ? <i className="bi bi-pencil-square" style={{ color: "#6b7280", fontSize: "0.85rem", flexShrink: 0 }}></i>
          : <span className="badge bg-success" style={{ fontFamily: "monospace", fontSize: "0.78rem", letterSpacing: "0.04em" }}>{value}</span>
        }
        <span className="flex-grow-1 small fw-semibold" style={{ color: esLibre ? "#374151" : "#198754" }}>
          {desc || "…"}
        </span>
        {!readOnly && (
          <button type="button" className="btn btn-link btn-sm p-0 text-danger lh-1" title="Cambiar diagnóstico"
            onClick={onClear}>
            <i className="bi bi-x-circle-fill"></i>
          </button>
        )}
      </div>
    );
  }

  const dropPos = openUp ? { bottom: "calc(100% + 2px)" } : { top: "calc(100% + 2px)" };

  // Campo de búsqueda cuando no hay nada seleccionado
  return (
    <div className="position-relative" ref={ref}>
      <div className="input-group input-group-sm">
        <span className="input-group-text text-muted border-end-0 bg-white">
          <i className="bi bi-search" style={{ fontSize: "0.75rem" }}></i>
        </span>
        <input ref={inputRef} className="form-control border-start-0" placeholder={placeholder}
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={checkDirection}
          autoComplete="off" />
      </div>
      {q.length >= 2 && (
        <ul className="list-group position-absolute z-3 shadow"
          style={{ ...dropPos, left: 0, right: 0, minWidth: 340, maxHeight: 260, overflowY: "auto" }}>
          {list.map(c => (
            <li key={c.codigo} className="list-group-item list-group-item-action px-2 py-1"
              style={{ cursor: "pointer" }}
              onMouseDown={() => sel(c)}>
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold flex-shrink-0" style={{ fontFamily: "monospace", color: "#0d6efd", fontSize: "0.78rem" }}>{c.codigo}</span>
                {c.categoria && (
                  <span className="badge text-bg-light border flex-shrink-0" style={{ fontSize: "0.63rem" }}>
                    {c.categoria}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#1e293b", lineHeight: 1.3, marginTop: 1 }}>{c.descripcion}</div>
            </li>
          ))}
          <li className="list-group-item list-group-item-action py-1 px-2"
            style={{ cursor: "pointer", fontSize: "0.81rem", borderTop: list.length ? "1px solid #e5e7eb" : undefined, background: "#fafafa" }}
            onMouseDown={selLibre}>
            <i className="bi bi-pencil-square me-2 text-secondary"></i>
            <span className="text-secondary">Guardar como diagnóstico libre: </span>
            <span className="fw-semibold text-dark">"{q.trim()}"</span>
          </li>
        </ul>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: SOAP
// ══════════════════════════════════════════════════════════════════════
export default function SoapTab({ soap, setSoap, vitals, setVitals, firmada, paciente, registrarCurva, setRegistrarCurva }) {
  const { user } = useAuth();
  const especialidad = user?.especialidad || "Medicina General";
  const cie10Ref = useRef(null);

  // ── Catálogo de diagnósticos frecuentes ──
  const [catDxQuery, setCatDxQuery]   = useState("");
  const [allCatDx,  setAllCatDx]     = useState([]);
  const [showCatDx, setShowCatDx]    = useState(false);
  const [catDxOpenUp, setCatDxOpenUp] = useState(false);
  const catDxRef                      = useRef(null);
  const catDxInputRef                 = useRef(null);

  const checkCatDxDirection = () => {
    if (catDxInputRef.current) {
      const rect = catDxInputRef.current.getBoundingClientRect();
      setCatDxOpenUp(window.innerHeight - rect.bottom < 280);
    }
  };

  // Carga toda la lista al montar (sin query = devuelve hasta 200)
  useEffect(() => {
    api.get("/catalogos-diagnostico")
      .then(r => setAllCatDx(r.data.data || []))
      .catch(() => {});
  }, []);

  // Filtrado client-side
  const catDxList = catDxQuery.length >= 1
    ? allCatDx.filter(c =>
        c.nombre?.toLowerCase().includes(catDxQuery.toLowerCase()) ||
        c.codigo_cie?.toLowerCase().includes(catDxQuery.toLowerCase()) ||
        c.descripcion_cie?.toLowerCase().includes(catDxQuery.toLowerCase())
      )
    : allCatDx;

  // Cerrar al clic fuera
  useEffect(() => {
    const fn = (e) => { if (catDxRef.current && !catDxRef.current.contains(e.target)) setShowCatDx(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const selCatDx = (cat) => {
    let secArr = [];
    try {
      secArr = typeof cat.diagnosticos_secundarios === "string"
        ? JSON.parse(cat.diagnosticos_secundarios || "[]")
        : (cat.diagnosticos_secundarios || []);
    } catch { secArr = []; }
    setSoap(s => ({
      ...s,
      diagnostico_cie:  cat.codigo_cie  || "",
      diagnostico_desc: cat.descripcion_cie || cat.nombre || "",
      diagnosticos_secundarios: secArr,
    }));
    setCatDxQuery("");
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

  // Mostrar switch solo para pacientes pediátricos (< 19 años)
  const esPediatrico = paciente?.fecha_nacimiento
    ? dayjs().diff(dayjs(paciente.fecha_nacimiento), "year") < 19
    : false;

  return (
    <div className="row g-3">
      <style>{`
        .vital-input::placeholder {
          color: #b8c1cc !important;
          opacity: 1 !important;
        }
        .vital-input.vital-empty {
          color: #8b95a1 !important;
          font-style: italic;
        }
        .curva-switch-track {
          transition: background 0.22s;
        }
        .curva-switch-thumb {
          transition: left 0.22s cubic-bezier(.4,0,.2,1);
        }
      `}</style>
      {/* Signos vitales */}
      <div className="col-12">
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#ef4444,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="bi bi-heart-pulse-fill" style={{ color: "#fff", fontSize: "0.75rem" }}></i>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>Signos Vitales</span>
            {/* Switch curva de crecimiento — solo pacientes < 19 años */}
            {esPediatrico && !firmada && (
              <div className="d-flex align-items-center gap-2 ms-auto">
                <i className="bi bi-graph-up-arrow" style={{ color: registrarCurva ? "#16a34a" : "#9ca3af", fontSize: "0.82rem" }}></i>
                <span style={{ fontSize: "0.75rem", color: registrarCurva ? "#15803d" : "#6b7280", fontWeight: registrarCurva ? 600 : 400, whiteSpace: "nowrap" }}>
                  Registrar curva de crecimiento
                </span>
                <button
                  type="button"
                  title={registrarCurva ? "Desactivar registro en curva de crecimiento" : "Activar registro en curva de crecimiento"}
                  onClick={() => setRegistrarCurva(v => !v)}
                  className="curva-switch-track"
                  style={{
                    width: 44, height: 26, borderRadius: 13, flexShrink: 0,
                    background: registrarCurva ? "#22c55e" : "#d1d5db",
                    border: "none", padding: 0, cursor: "pointer",
                    position: "relative", boxShadow: "inset 0 1px 3px rgba(0,0,0,.15)",
                  }}
                >
                  <div
                    className="curva-switch-thumb"
                    style={{
                      width: 20, height: 20, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: registrarCurva ? 21 : 3,
                      boxShadow: "0 1px 4px rgba(0,0,0,.28)",
                    }}
                  />
                </button>
              </div>
            )}
          </div>
          <div className="row g-2">
            {VITALS_FIELDS.filter(f => !f.pediatricOnly || esPediatrico).map(f => (
              <div key={f.key} className="col-6 col-md-3">
                <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "0.68rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    {f.label} <span style={{ color: "#9ca3af" }}>{f.unit}</span>
                  </div>
                  <input
                    className={`form-control form-control-sm border-0 p-0 vital-input ${vitals[f.key] ? "" : "vital-empty"}`}
                    style={{
                      background: "transparent",
                      fontWeight: vitals[f.key] ? 600 : 500,
                      fontSize: "0.9rem",
                      color: vitals[f.key] ? "#111827" : "#9ca3af",
                    }}
                    placeholder={f.placeholder}
                    value={vitals[f.key] || ""}
                    autoComplete="off"
                    readOnly={f.readOnly || firmada}
                    onChange={f.readOnly ? undefined : e => setVitals(v => ({ ...v, [f.key]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subjetivo */}
      <div className="col-md-6">
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontWeight: 800, color: "#3b82f6", fontSize: "0.75rem" }}>S</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e3a5f" }}>Subjetivo</span>
            <small style={{ color: "#9ca3af", fontSize: "0.72rem" }}>Síntomas referidos por el paciente</small>
          </div>
          <SoapTextareaIA
            campo="subjetivo" rows={4}
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

      {/* Examen físico */}
      <div className="col-md-6">
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontWeight: 800, color: "#22c55e", fontSize: "0.75rem" }}>O</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e3a5f" }}>Objetivo</span>
            <small style={{ color: "#9ca3af", fontSize: "0.72rem" }}>Hallazgos al examen físico</small>
          </div>
          <SoapTextareaIA
            campo="objetivo" rows={4}
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

      {/* Diagnóstico */}
      <div className="col-md-6">
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontWeight: 800, color: "#d97706", fontSize: "0.75rem" }}>A</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e3a5f" }}>Diagnóstico</span>
            <small style={{ color: "#9ca3af", fontSize: "0.72rem" }}>CIE-10</small>
          </div>

          {/* Catálogo de diagnósticos frecuentes del médico */}
          {!firmada && (
            <div className="position-relative mb-2" ref={catDxRef}>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-warning bg-opacity-10 text-warning border-end-0">
                  <i className="bi bi-lightning-fill"></i>
                </span>
                <input ref={catDxInputRef} className="form-control border-start-0"
                  placeholder={allCatDx.length > 0 ? `Mis diagnósticos (${allCatDx.length})…` : "Mis diagnósticos frecuentes…"}
                  value={catDxQuery}
                  onChange={e => { setCatDxQuery(e.target.value); setShowCatDx(true); }}
                  onFocus={() => { checkCatDxDirection(); setShowCatDx(true); }} />
              </div>
              {showCatDx && catDxList.length > 0 && (
                <ul className="list-group position-absolute z-3 shadow"
                  style={{ ...(catDxOpenUp ? { bottom: "calc(100% + 2px)" } : { top: "calc(100% + 2px)" }), left: 0, right: 0, minWidth: 340, maxHeight: 260, overflowY: "auto" }}>
                  {catDxList.map(c => (
                    <li key={c.id} className="list-group-item list-group-item-action px-2 py-1"
                      style={{ cursor: "pointer" }}
                      onMouseDown={() => selCatDx(c)}>
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-lightning-fill text-warning flex-shrink-0" style={{ fontSize: "0.75rem" }}></i>
                        <strong style={{ fontSize: "0.82rem" }}>{c.nombre}</strong>
                        {c.codigo_cie && <span className="badge text-bg-light border flex-shrink-0" style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>{c.codigo_cie}</span>}
                      </div>
                      {c.descripcion_cie && <div className="text-muted" style={{ fontSize: "0.77rem", lineHeight: 1.3, marginTop: 1, paddingLeft: 18 }}>{c.descripcion_cie}</div>}
                    </li>
                  ))}
                </ul>
              )}
              {showCatDx && catDxList.length === 0 && catDxQuery.length >= 1 && (
                <div className="position-absolute z-3 bg-white border rounded shadow px-3 py-2 text-muted small"
                  style={{ ...(catDxOpenUp ? { bottom: "calc(100% + 2px)" } : { top: "calc(100% + 2px)" }), left: 0, right: 0 }}>
                  Sin resultados para "{catDxQuery}"
                </div>
              )}
            </div>
          )}

          {/* Diagnóstico principal */}
          <CieBuscador
            value={soap.diagnostico_cie}
            desc={soap.diagnostico_desc}
            readOnly={firmada}
            onChange={(code, desc) => setSoap(s => ({ ...s, diagnostico_cie: code, diagnostico_desc: desc }))}
            onClear={() => setSoap(s => ({ ...s, diagnostico_cie: "", diagnostico_desc: "" }))}
          />

          {/* Diagnósticos secundarios */}
          {soap.diagnosticos_secundarios.length > 0 && (
            <p className="text-muted small mb-1 mt-3" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Secundarios
            </p>
          )}
          {soap.diagnosticos_secundarios.map((dx, i) => (
            <div key={i} className="d-flex gap-2 align-items-center mt-1">
              <div className="flex-grow-1">
                <CieBuscador
                  value={dx.cie} desc={dx.descripcion}
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

      {/* Plan */}
      <div className="col-md-6">
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontWeight: 800, color: "#8b5cf6", fontSize: "0.75rem" }}>P</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e3a5f" }}>Plan</span>
            <small style={{ color: "#9ca3af", fontSize: "0.72rem" }}>Tratamiento, indicaciones, seguimiento</small>
          </div>
          <SoapTextareaIA
            campo="plan" rows={5}
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
  );
}
