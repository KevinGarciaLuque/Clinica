import { useState, useEffect } from "react";
import api from "../../api/api";

// ══════════════════════════════════════════════════════════════════════
// TAB: Antecedentes & Alergias
// ══════════════════════════════════════════════════════════════════════
const TIPOS_ANTECEDENTE = ["patologico","quirurgico","familiar","ginecobstetrico","habitos","otros"];
const SEVERIDAD_COLOR   = { LEVE: "success", MODERADA: "warning", SEVERA: "danger", MORTAL: "dark" };

export default function AntecedentesTab({ pacienteId, firmada }) {
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
