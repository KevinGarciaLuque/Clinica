import { useState, useEffect } from "react";
import dayjs from "dayjs";
import api from "../../api/api";
import ModalAgendarProximaCita from "./ModalAgendarProximaCita";

// ══════════════════════════════════════════════════════════════════════
// TAB: Dermatología — campos específicos de la especialidad
// ══════════════════════════════════════════════════════════════════════
const FOTOTIPOS_FITZPATRICK = [
  { val: "I",   label: "I — Siempre quema, nunca broncea (piel muy clara)" },
  { val: "II",  label: "II — Generalmente quema, poco broncea" },
  { val: "III", label: "III — A veces quema, broncea gradualmente" },
  { val: "IV",  label: "IV — Rara vez quema, broncea fácilmente (piel morena)" },
  { val: "V",   label: "V — Muy rara vez quema, broncea intensamente" },
  { val: "VI",  label: "VI — Nunca quema, pigmentación intensa" },
];

const EXPOSICION_SOLAR_OPTS = ["Mínima", "Moderada (1–2 h/día)", "Alta (>2 h/día)", "Ocupacional"];

function DermaFieldGroup({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #e5e7eb" }}>
        <i className={`bi ${icon}`} style={{ color: "#1d4ed8", fontSize: "1rem" }}></i>
        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function DermaField({ label, children }) {
  return (
    <div className="mb-3">
      <label className="form-label small mb-1" style={{ fontWeight: 600, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );
}

export default function DermaTab({ datosDerma, setDatosDerma, firmada, paciente, pacienteId }) {
  const set = (key, val) => setDatosDerma(prev => ({ ...prev, [key]: val }));
  const d = datosDerma;
  const [procCatalogo, setProcCatalogo] = useState([]);
  const [procPick, setProcPick] = useState("");
  const [showAgendarModal, setShowAgendarModal] = useState(false);

  useEffect(() => {
    api.get("/catalogos-procedimientos")
      .then(r => setProcCatalogo(r.data.data || []))
      .catch(() => setProcCatalogo([]));
  }, []);

  const inputStyle = { borderRadius: 7, fontSize: "0.85rem" };
  const textareaStyle = { borderRadius: 7, fontSize: "0.85rem", resize: "vertical" };
  const agregarProcedimientoPrevio = () => {
    const nombre = (procPick || "").trim();
    if (!nombre) return;
    const actual = (d.tratamientos_previos || "").trim();
    const next = actual ? `${actual}, ${nombre}` : nombre;
    set("tratamientos_previos", next);
    setProcPick("");
  };

  return (
    <div>
      {/* Banner informativo */}
      <div style={{ background: "linear-gradient(135deg, #f0f5ff, #e8f0fe)", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <i className="bi bi-bandaid-fill" style={{ color: "#1d4ed8", fontSize: "1.2rem" }}></i>
        <div>
          <span style={{ fontWeight: 700, color: "#1a2744", fontSize: "0.9rem" }}>Historia Clínica Dermatológica</span>
          <div style={{ fontSize: "0.75rem", color: "#2563eb", marginTop: 1 }}>Campos específicos para consultas de dermatología y estética. Se guardan junto con la historia SOAP al presionar Borrador o Firmar.</div>
        </div>
      </div>

      <div className="row g-0">
        <div className="col-md-6 pe-md-3">

          <DermaFieldGroup title="Datos clínicos" icon="bi-clipboard2-pulse">
            <DermaField label="Tiempo de evolución">
              <input className="form-control form-control-sm" style={inputStyle}
                placeholder="Ej: 3 semanas, 2 meses…"
                disabled={firmada}
                value={d.tiempo_evolucion || ""}
                onChange={e => set("tiempo_evolucion", e.target.value)} />
            </DermaField>
            <DermaField label="Localización anatómica">
              <input className="form-control form-control-sm" style={inputStyle}
                placeholder="Ej: cara, espalda, extremidades inferiores…"
                disabled={firmada}
                value={d.localizacion_anatomica || ""}
                onChange={e => set("localizacion_anatomica", e.target.value)} />
            </DermaField>
            <DermaField label="Tratamientos previos para este padecimiento">
              <textarea className="form-control form-control-sm" rows={2} style={textareaStyle}
                placeholder="Medicamentos, procedimientos, cremas utilizadas…"
                disabled={firmada}
                value={d.tratamientos_previos || ""}
                onChange={e => set("tratamientos_previos", e.target.value)} />
              <div className="d-flex gap-2 mt-2">
                <input
                  className="form-control form-control-sm"
                  style={inputStyle}
                  placeholder="Agregar desde catálogo de procedimientos…"
                  value={procPick}
                  onChange={(e) => setProcPick(e.target.value)}
                  list="derma-procedimientos-list"
                  disabled={firmada}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={agregarProcedimientoPrevio}
                  disabled={firmada || !procPick.trim()}
                >
                  Agregar
                </button>
              </div>
              <datalist id="derma-procedimientos-list">
                {procCatalogo.map((p) => (
                  <option key={p.id} value={p.nombre} />
                ))}
              </datalist>
            </DermaField>
          </DermaFieldGroup>

          <DermaFieldGroup title="Antecedentes dermatológicos" icon="bi-person-lines-fill">
            <DermaField label="Antecedentes dermatológicos personales">
              <textarea className="form-control form-control-sm" rows={2} style={textareaStyle}
                placeholder="Enfermedades de piel previas, psoriasis, eczema, acné severo…"
                disabled={firmada}
                value={d.antecedentes_derma_personales || ""}
                onChange={e => set("antecedentes_derma_personales", e.target.value)} />
            </DermaField>
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <label className="form-label small mb-0" style={{ fontWeight: 600, color: "#374151" }}>
                  Antecedentes familiares de cáncer de piel
                </label>
                <div className="d-flex gap-2">
                  {["Sí", "No", "Desconoce"].map(op => (
                    <label key={op} className="d-flex align-items-center gap-1" style={{ cursor: "pointer", fontSize: "0.82rem" }}>
                      <input type="radio" name="antecedentes_fam_cancer"
                        disabled={firmada}
                        checked={d.antecedentes_fam_cancer_piel === op}
                        onChange={() => set("antecedentes_fam_cancer_piel", op)} />
                      {op}
                    </label>
                  ))}
                </div>
              </div>
              {d.antecedentes_fam_cancer_piel === "Sí" && (
                <input className="form-control form-control-sm mt-1" style={inputStyle}
                  placeholder="Especificar tipo y parentesco…"
                  disabled={firmada}
                  value={d.antecedentes_fam_cancer_detalle || ""}
                  onChange={e => set("antecedentes_fam_cancer_detalle", e.target.value)} />
              )}
            </div>
          </DermaFieldGroup>

        </div>
        <div className="col-md-6 ps-md-3">

          <DermaFieldGroup title="Características del paciente" icon="bi-person-badge">
            <DermaField label="Fototipo de Fitzpatrick">
              <select className="form-select form-select-sm" style={inputStyle}
                disabled={firmada}
                value={d.fototipo_fitzpatrick || ""}
                onChange={e => set("fototipo_fitzpatrick", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {FOTOTIPOS_FITZPATRICK.map(f => (
                  <option key={f.val} value={f.val}>{f.label}</option>
                ))}
              </select>
            </DermaField>
            <DermaField label="Exposición solar habitual">
              <select className="form-select form-select-sm" style={inputStyle}
                disabled={firmada}
                value={d.exposicion_solar || ""}
                onChange={e => set("exposicion_solar", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {EXPOSICION_SOLAR_OPTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </DermaField>
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <label className="form-label small mb-0" style={{ fontWeight: 600, color: "#374151" }}>Usa protector solar</label>
                <div className="d-flex gap-2">
                  {["Sí", "No", "A veces"].map(op => (
                    <label key={op} className="d-flex align-items-center gap-1" style={{ cursor: "pointer", fontSize: "0.82rem" }}>
                      <input type="radio" name="usa_protector_solar"
                        disabled={firmada}
                        checked={d.usa_protector_solar === op}
                        onChange={() => set("usa_protector_solar", op)} />
                      {op}
                    </label>
                  ))}
                </div>
              </div>
              {d.usa_protector_solar === "Sí" && (
                <input className="form-control form-control-sm mt-1" style={inputStyle}
                  placeholder="FPS / frecuencia de aplicación…"
                  disabled={firmada}
                  value={d.protector_solar_detalle || ""}
                  onChange={e => set("protector_solar_detalle", e.target.value)} />
              )}
            </div>
            <DermaField label="Ocupación">
              <input className="form-control form-control-sm" style={inputStyle}
                placeholder="Ej: agricultora, maestra, oficinista…"
                disabled={firmada}
                value={d.ocupacion || ""}
                onChange={e => set("ocupacion", e.target.value)} />
            </DermaField>
          </DermaFieldGroup>

          <DermaFieldGroup title="Clínica y plan" icon="bi-journal-medical">
            <DermaField label="Diagnósticos diferenciales">
              <textarea className="form-control form-control-sm" rows={2} style={textareaStyle}
                placeholder="Listado de diagnósticos a descartar…"
                disabled={firmada}
                value={d.diagnosticos_diferenciales || ""}
                onChange={e => set("diagnosticos_diferenciales", e.target.value)} />
            </DermaField>
            <DermaField label="Indicaciones médicas / postprocedimiento">
              <textarea className="form-control form-control-sm" rows={3} style={textareaStyle}
                placeholder="Cuidados en casa, restricciones, signos de alarma…"
                disabled={firmada}
                value={d.indicaciones_medicas || ""}
                onChange={e => set("indicaciones_medicas", e.target.value)} />
            </DermaField>
            <DermaField label="Próxima cita sugerida">
              {d.proxima_cita ? (
                <div className="d-flex align-items-center gap-2 px-2 py-2 rounded border"
                  style={{ background: "rgba(26,39,68,0.06)", borderColor: "#bfdbfe" }}>
                  <i className="bi bi-calendar-check-fill" style={{ color: "#1a2744", flexShrink: 0 }}></i>
                  <span className="flex-grow-1 small fw-semibold" style={{ color: "#1a2744" }}>
                    {dayjs(d.proxima_cita).isValid()
                      ? dayjs(d.proxima_cita).format("dddd D [de] MMMM [de] YYYY [·] HH:mm")
                      : d.proxima_cita}
                  </span>
                  {!firmada && (
                    <button type="button" className="btn btn-link btn-sm p-0 text-danger lh-1"
                      title="Quitar cita"
                      onClick={() => set("proxima_cita", "")}>
                      <i className="bi bi-x-circle-fill"></i>
                    </button>
                  )}
                </div>
              ) : (
                <button type="button"
                  className="btn btn-sm w-100"
                  disabled={firmada}
                  style={{
                    borderRadius: 7, fontSize: "0.82rem", borderStyle: "dashed",
                    border: "1px dashed #243b72", color: "#1a2744",
                    background: "rgba(26,39,68,0.04)",
                  }}
                  onClick={() => setShowAgendarModal(true)}>
                  <i className="bi bi-calendar-plus me-2"></i>Ver disponibilidad y agendar…
                </button>
              )}
            </DermaField>
            {showAgendarModal && (
              <ModalAgendarProximaCita
                paciente={paciente}
                pacienteId={pacienteId}
                onClose={() => setShowAgendarModal(false)}
                onConfirm={(fechaHora) => {
                  set("proxima_cita", fechaHora);
                  setShowAgendarModal(false);
                }}
              />
            )}
          </DermaFieldGroup>

        </div>
      </div>

      {!firmada && (
        <div style={{ marginTop: 4, padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: "0.78rem", color: "#15803d", display: "flex", alignItems: "center", gap: 8 }}>
          <i className="bi bi-info-circle-fill"></i>
          Los campos de esta pestaña se guardan automáticamente junto con el SOAP al presionar <strong>Borrador</strong> o <strong>Firmar y Cerrar</strong>.
        </div>
      )}
    </div>
  );
}
