/**
 * FASE 4 — Consulta SOAP (Historia Clínica Electrónica)
 * URL: /consulta?paciente_id=&cita_id=&historia_id=
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";

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
          setSoap({
            subjetivo: h.subjetivo || "",
            objetivo:  obj,
            examen_fisico: h.examen_fisico || "",
            plan:       h.plan || "",
            diagnostico_cie:  h.diagnostico_cie || "",
            diagnostico_desc: "",
            diagnosticos_secundarios: typeof h.diagnosticos_secundarios === "string"
              ? JSON.parse(h.diagnosticos_secundarios || "[]")
              : (h.diagnosticos_secundarios || []),
          });
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
            <a href={`/historia/${paciente.id}`} className="ms-auto btn btn-outline-primary btn-sm">
              Ver HCE completa
            </a>
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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: SOAP
// ══════════════════════════════════════════════════════════════════════
function SoapTab({ soap, setSoap, vitals, setVitals, firmada }) {
  const [cie10List, setCie10List] = useState([]);
  const cie10Ref = useRef(null);

  // ── Catálogo de diagnósticos ──
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

  // búsqueda CIE-10
  useEffect(() => {
    const q = soap.diagnostico_cie;
    if (!q || q.length < 2) { setCie10List([]); return; }
    const t = setTimeout(() => {
      api.get("/historias/cie10/buscar", { params: { q } })
        .then(r => setCie10List(r.data.data || []))
        .catch(() => setCie10List([]));
    }, 300);
    return () => clearTimeout(t);
  }, [soap.diagnostico_cie]);

  const selCie = (item) => {
    setSoap(s => ({ ...s, diagnostico_cie: item.codigo, diagnostico_desc: item.descripcion }));
    setCie10List([]);
  };

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
            <label className="form-label fw-semibold">
              S — Subjetivo <small className="text-muted fw-normal">(Síntomas referidos por el paciente)</small>
            </label>
            <textarea className="form-control" rows={3} value={soap.subjetivo}
              onChange={set("subjetivo")} readOnly={firmada}
              placeholder="Motivo de consulta, síntomas, evolución…" />
          </div>
        </div>
      </div>

      {/* Examen físico */}
      <div className="col-md-6">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <label className="form-label fw-semibold">
              O — Objetivo <small className="text-muted fw-normal">(Hallazgos al examen físico)</small>
            </label>
            <textarea className="form-control" rows={3} value={soap.examen_fisico}
              onChange={set("examen_fisico")} readOnly={firmada}
              placeholder="Examen físico, hallazgos relevantes…" />
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

            {/* Selector de catálogo de diagnósticos */}
            {!firmada && (
              <div className="position-relative mb-2">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-info bg-opacity-10 text-info border-0">
                    <i className="bi bi-journal-bookmark-fill"></i>
                  </span>
                  <input className="form-control" placeholder="Buscar en catálogo de diagnósticos…"
                    value={catDxQuery}
                    onChange={e => setCatDxQuery(e.target.value)}
                    onFocus={() => catDxList.length > 0 && setShowCatDx(true)} />
                </div>
                {showCatDx && catDxList.length > 0 && (
                  <ul className="list-group position-absolute z-3 shadow"
                    style={{ top: "100%", left: 0, right: 0, maxHeight: 180, overflowY: "auto" }}>
                    {catDxList.map(c => (
                      <li key={c.id} className="list-group-item list-group-item-action py-1"
                        style={{ cursor: "pointer", fontSize: "0.82rem" }}
                        onClick={() => selCatDx(c)}>
                        <i className="bi bi-lightning-fill text-warning me-1"></i>
                        <strong>{c.nombre}</strong> — <span className="text-muted">{c.codigo_cie}</span> {c.descripcion_cie}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="position-relative" ref={cie10Ref}>
              <div className="input-group input-group-sm">
                <input className="form-control" placeholder="Buscar por código o descripción…"
                  value={soap.diagnostico_cie} readOnly={firmada}
                  onChange={set("diagnostico_cie")} />
                {soap.diagnostico_desc && (
                  <span className="input-group-text text-success">{soap.diagnostico_desc}</span>
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
            {soap.diagnosticos_secundarios.map((dx, i) => (
              <div key={i} className="d-flex gap-2 mt-2">
                <input className="form-control form-control-sm" placeholder="Código CIE" style={{ maxWidth: 90 }}
                  value={dx.cie} readOnly={firmada}
                  onChange={e => setSoap(s => ({ ...s, diagnosticos_secundarios: s.diagnosticos_secundarios.map((d, j) => j === i ? { ...d, cie: e.target.value } : d) }))} />
                <input className="form-control form-control-sm" placeholder="Descripción"
                  value={dx.descripcion} readOnly={firmada}
                  onChange={e => setSoap(s => ({ ...s, diagnosticos_secundarios: s.diagnosticos_secundarios.map((d, j) => j === i ? { ...d, descripcion: e.target.value } : d) }))} />
                {!firmada && (
                  <button className="btn btn-outline-danger btn-sm" onClick={() => remDxSec(i)}>✕</button>
                )}
              </div>
            ))}
            {!firmada && (
              <button className="btn btn-link btn-sm mt-1 p-0" onClick={addDxSec}>+ Diagnóstico secundario</button>
            )}
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="col-md-6">
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <label className="form-label fw-semibold">
              P — Plan <small className="text-muted fw-normal">(Tratamiento, indicaciones, seguimiento)</small>
            </label>
            <textarea className="form-control" rows={4} value={soap.plan}
              onChange={set("plan")} readOnly={firmada}
              placeholder="Tratamiento indicado, próxima cita, derivaciones…" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: Prescripción
// ══════════════════════════════════════════════════════════════════════
function PrescripcionTab({ historiaId, pacienteId, citaId, firmada }) {
  const [list,      setList]      = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [items,     setItems]     = useState([newItem()]);
  const [notas,     setNotas]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [alertMsg,  setAlertMsg]  = useState(null);
  const [medSearch, setMedSearch] = useState([]);

  // Abre la receta en PDF en nueva pestaña
  const printRx = async (id) => {
    try {
      const res = await api.get(`/prescripciones/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (err) {
      window.alert("No se pudo generar el PDF: " + (err?.response?.data?.msg || err.message));
    }
  };

  function newItem() {
    return { medicamento_id: null, medicamento_texto: "", dosis: "", duracion: "", cantidad: "", instrucciones: "" };
  }

  useEffect(() => {
    if (!historiaId && !pacienteId) return;
    const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
    api.get("/prescripciones", { params })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  }, [historiaId, pacienteId]);

  const searchMed = (q, idx) => {
    if (q.length < 2) { setMedSearch([]); return; }
    api.get("/medicamentos", { params: { q } })
      .then(r => setMedSearch({ idx, list: r.data.data || [] }))
      .catch(() => {});
  };

  const selMed = (med, idx) => {
    setItems(prev => prev.map((it, i) => i === idx
      ? {
          ...it,
          medicamento_id: med.id,
          medicamento_texto: med.nombre_generico + (med.presentacion ? ` (${med.presentacion})` : ""),
          dosis: med.dosis_default || it.dosis,
          duracion: med.duracion_default || it.duracion,
          cantidad: med.cantidad_default || it.cantidad,
          instrucciones: med.instrucciones_default || it.instrucciones,
        }
      : it
    ));
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
        cita_id:     citaId || null,
        paciente_id: pacienteId,
        notas,
        items: items.filter(it => it.medicamento_texto || it.medicamento_id),
      });
      const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
      const r = await api.get("/prescripciones", { params });
      setList(r.data.data || []);
      setShowForm(false);
      setItems([newItem()]);
      setNotas("");
      setAlertMsg({ type: "success", msg: "Receta creada" });
    } catch (e) {
      setAlertMsg({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
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

      {/* Lista existente */}
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
              <button className="btn btn-outline-primary btn-sm" title="Ver/Imprimir PDF"
                onClick={() => printRx(p.id)}>
                <i className="bi bi-printer me-1"></i>Receta PDF
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Formulario nueva receta */}
      {showForm && (
        <div className="card border-primary shadow-sm mt-3">
          <div className="card-header fw-semibold">Nueva Receta</div>
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
                      onChange={e => { setItem(idx, "medicamento_texto", e.target.value); setItem(idx, "medicamento_id", null); searchMed(e.target.value, idx); }} />
                    {medSearch?.idx === idx && medSearch.list?.length > 0 && (
                      <ul className="list-group position-absolute z-3"
                        style={{ top: "100%", left: 0, right: 0, maxHeight: 150, overflowY: "auto" }}>
                        {medSearch.list.map(m => (
                          <li key={m.id} className="list-group-item list-group-item-action py-1"
                            style={{ cursor: "pointer", fontSize: "0.8rem" }}
                            onClick={() => selMed(m, idx)}>
                            {m.nombre_generico} {m.presentacion && `(${m.presentacion})`}
                            {(m.dosis_default || m.duracion_default) && (
                              <span className="text-success ms-2" style={{ fontSize: "0.7rem" }}>
                                <i className="bi bi-lightning-fill"></i> con defaults
                              </span>
                            )}
                          </li>
                        ))}
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
              onClick={() => setItems(prev => [...prev, newItem()])}>
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

