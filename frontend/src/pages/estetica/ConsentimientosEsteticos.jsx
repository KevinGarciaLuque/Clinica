import { useEffect, useState } from "react";
import api from "../../api/api";

const C = {
  bg: "#f0f2f5", surface: "#f8fafc", card: "#ffffff",
  border: "#e5e7eb", accent: "#e91e8c", accentD: "#c2185b",
  text: "#111827", textSub: "#374151", muted: "#6b7280",
  mutedLt: "#9ca3af", inputBg: "#ffffff", success: "#10b981",
};

const inputSt = {
  background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", width: "100%", fontSize: 14, outline: "none",
};

const PLANTILLAS = [
  {
    id: 1, procedimiento: "Rinoplastia",
    contenido: `Yo, el/la abajo firmante, paciente de la clínica, declaro que he sido informado/a de manera clara y comprensible sobre el procedimiento de RINOPLASTIA, incluyendo sus beneficios, riesgos, complicaciones posibles, alternativas terapéuticas y el proceso de recuperación esperado. Autorizo al equipo médico a realizar dicho procedimiento y cualquier medida que sea necesaria durante su ejecución para garantizar mi seguridad.`,
    riesgos: ["Hematoma postoperatorio","Infección de la herida","Asimetría residual","Alteraciones en la respiración","Cicatrices visibles"],
  },
  {
    id: 2, procedimiento: "Abdominoplastia",
    contenido: `Yo, el/la abajo firmante, paciente de la clínica, declaro que he sido informado/a sobre el procedimiento de ABDOMINOPLASTIA (plastia abdominal), sus riesgos inherentes, cuidados postoperatorios y resultados esperados. Doy mi consentimiento libre y voluntario para la realización de dicho procedimiento.`,
    riesgos: ["Trombosis venosa profunda","Seromas","Necrosis cutánea","Cicatriz prominente","Cambios en la sensibilidad"],
  },
  {
    id: 3, procedimiento: "Liposucción",
    contenido: `Yo, el/la abajo firmante, paciente de la clínica, declaro haber recibido información completa sobre el procedimiento de LIPOSUCCIÓN, sus beneficios, limitaciones, riesgos y proceso de recuperación. Consiento voluntariamente la realización del procedimiento.`,
    riesgos: ["Irregularidades en el contorno","Hematomas","Cambios en la sensibilidad","Infección","Resultados asimétricos"],
  },
  {
    id: 4, procedimiento: "Aumento mamario",
    contenido: `Yo, el/la abajo firmante, paciente de la clínica, declaro que he sido informada sobre el procedimiento de MAMOPLASTIA DE AUMENTO (implantes mamarios), sus riesgos específicos, la vida útil de los implantes, y la necesidad de controles periódicos. Otorgo mi consentimiento libre e informado.`,
    riesgos: ["Contractura capsular","Rotura del implante","Cambios en la sensibilidad del pezón","Asimetría","Interferencia con mamografías"],
  },
  {
    id: 5, procedimiento: "Bichectomía",
    contenido: `Yo, el/la abajo firmante, paciente de la clínica, declaro que he sido informado/a sobre la BICHECTOMÍA (extirpación de las bolsas de Bichat), sus resultados esperados y posibles riesgos. Consiento voluntariamente la realización de dicha intervención.`,
    riesgos: ["Asimetría facial","Paresia del nervio facial","Infección intraoral","Cicatriz intraoral","Resultado excesivo"],
  },
];

export default function ConsentimientosEsteticos() {
  const [pacientes,      setPacientes]      = useState([]);
  const [consentimientos, setConsentimientos] = useState([]);
  const [showModal,      setShowModal]      = useState(false);
  const [plantillaSelec, setPlantillaSelec] = useState(null);
  const [form,           setForm]           = useState({ paciente_id: "", plantilla_id: "", notas: "" });

  useEffect(() => {
    api.get("/pacientes").then(r => setPacientes(r.data.data || [])).catch(() => {});
    const saved = JSON.parse(localStorage.getItem("consentimientos_est") || "[]");
    setConsentimientos(saved);
  }, []);

  const selecPlantilla = (id) => {
    const p = PLANTILLAS.find(p => p.id === Number(id));
    setPlantillaSelec(p || null);
    setForm(f => ({ ...f, plantilla_id: id }));
  };

  const guardar = (e) => {
    e.preventDefault();
    const pac = pacientes.find(p => String(p.id) === String(form.paciente_id));
    const nuevo = {
      id: Date.now(), ...form,
      procedimiento: plantillaSelec?.procedimiento || "—",
      paciente_nombre: pac ? `${pac.nombres} ${pac.apellidos}` : "—",
      firmado: false,
      creado_en: new Date().toISOString(),
    };
    const lista = [...consentimientos, nuevo];
    localStorage.setItem("consentimientos_est", JSON.stringify(lista));
    setConsentimientos(lista);
    setShowModal(false);
    setForm({ paciente_id: "", plantilla_id: "", notas: "" });
    setPlantillaSelec(null);
  };

  const toggleFirma = (id) => {
    const lista = consentimientos.map(c =>
      c.id === id ? { ...c, firmado: !c.firmado, firmado_en: !c.firmado ? new Date().toISOString() : null } : c
    );
    localStorage.setItem("consentimientos_est", JSON.stringify(lista));
    setConsentimientos(lista);
  };

  const eliminar = (id) => {
    const lista = consentimientos.filter(c => c.id !== id);
    localStorage.setItem("consentimientos_est", JSON.stringify(lista));
    setConsentimientos(lista);
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a1035 0%, #2d1045 50%, #1a2744 100%)",
        padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 14px rgba(233,30,140,.4)`,
          }}>
            <i className="bi bi-file-earmark-check-fill" style={{ fontSize: 20, color: "#fff" }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: "#fff" }}>Consentimientos Estéticos</h4>
            <span style={{ color: "rgba(255,255,255,.5)", fontSize: 13 }}>
              Consentimientos informados por procedimiento — {PLANTILLAS.length} plantillas disponibles
            </span>
          </div>
        </div>
        <button
          onClick={() => { setShowModal(true); setPlantillaSelec(null); setForm({ paciente_id: "", plantilla_id: "", notas: "" }); }}
          style={{
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            border: "none", borderRadius: 10, padding: "9px 18px",
            color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: `0 4px 14px rgba(233,30,140,.4)`,
          }}
        >
          <i className="bi bi-plus-lg" /> Nuevo consentimiento
        </button>
      </div>
      <div style={{ padding: "20px 24px" }}>

      {/* Plantillas disponibles */}
      <div style={{ marginBottom: 28 }}>
        <h6 style={{ color: C.muted, fontWeight: 700, fontSize: 12, textTransform: "uppercase",
                      letterSpacing: ".08em", marginBottom: 12 }}>Plantillas de procedimientos</h6>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {PLANTILLAS.map(p => (
            <div key={p.id} style={{color: C.muted,
              background: `${C.accent}10`, border: `1px solid ${C.accent}30`,
              borderRadius: 10, padding: "8px 14px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="bi bi-file-earmark-text" style={{ color: C.accent, fontSize: 14 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>{p.procedimiento}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de consentimientos emitidos */}
      <h6 style={{ color: C.muted, fontWeight: 700, fontSize: 12, textTransform: "uppercase",
                    letterSpacing: ".08em", marginBottom: 12 }}>
        Consentimientos emitidos ({consentimientos.length})
      </h6>

      {!consentimientos.length ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{
            width: 68, height: 68, borderRadius: 18, margin: "0 auto 16px",
            background: `${C.accent}08`, border: `1px solid ${C.accent}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-file-earmark-check" style={{ fontSize: 28, color: C.accent }} />
          </div>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>No hay consentimientos emitidos aún</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {consentimientos.map(c => (
            <div key={c.id} style={{
              background: C.card, border: `1px solid ${c.firmado ? "rgba(16,185,129,.3)" : C.border}`,
              borderRadius: 12, padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
              boxShadow: "0 1px 4px rgba(0,0,0,.06)",
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                background: c.firmado ? "rgba(16,185,129,.15)" : `${C.accent}15`,
                border: `1px solid ${c.firmado ? "rgba(16,185,129,.3)" : `${C.accent}30`}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className={`bi bi-file-earmark-${c.firmado ? "check-fill" : "text"}`}
                   style={{ fontSize: 18, color: c.firmado ? "#10b981" : C.accent }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{c.procedimiento}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  <i className="bi bi-person me-1" />{c.paciente_nombre}
                  <span style={{ margin: "0 8px", opacity: .4 }}>·</span>
                  <i className="bi bi-calendar2 me-1" />{new Date(c.creado_en).toLocaleDateString("es-PE")}
                  {c.firmado && c.firmado_en && (
                    <>
                      <span style={{ margin: "0 8px", opacity: .4 }}>·</span>
                      <i className="bi bi-pen-fill me-1" style={{ color: "#10b981" }} />
                      <span style={{ color: "#10b981" }}>Firmado el {new Date(c.firmado_en).toLocaleDateString("es-PE")}</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => toggleFirma(c.id)}
                  style={{
                    background: c.firmado ? "rgba(245,158,11,.1)" : "rgba(16,185,129,.1)",
                    border: `1px solid ${c.firmado ? "rgba(245,158,11,.25)" : "rgba(16,185,129,.25)"}`,
                    borderRadius: 8, padding: "6px 14px",
                    color: c.firmado ? "#f59e0b" : "#10b981",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                  <i className={`bi bi-${c.firmado ? "x-circle" : "pen-fill"} me-1`} />
                  {c.firmado ? "Anular firma" : "Marcar firmado"}
                </button>
                <button onClick={() => eliminar(c.id)}
                  style={{ background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.2)",
                             borderRadius: 8, padding: "6px 12px", color: "#f87171",
                             fontSize: 12, cursor: "pointer" }}>
                  <i className="bi bi-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      </div>{/* fin padding */}

      {/* Modal nuevo consentimiento */}
      {showModal && (
        <>
          <div style={{
            position: "fixed", inset: 0, zIndex: 1049,
            background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
          }} onClick={() => setShowModal(false)} />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            zIndex: 1050,
            background: C.card, borderRadius: 16, width: "calc(100% - 32px)", maxWidth: 660,
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,.2)",
            border: `1px solid ${C.border}`,
          }}>
            <div style={{
              background: "linear-gradient(135deg, #1a1035 0%, #2d1045 50%, #1a2744 100%)",
              padding: "18px 22px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderRadius: "16px 16px 0 0",
            }}>
              <h5 style={{ margin: 0, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
                <i className="bi bi-file-earmark-check-fill" style={{ color: "#f9a8d4", fontSize: 18 }} />
                Nuevo Consentimiento Informado
              </h5>
              <button onClick={() => setShowModal(false)}
                style={{ background: "rgba(239,68,68,.2)", border: "none", borderRadius: 8,
                           width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                           color: "#fca5a5", cursor: "pointer", fontSize: 16 }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <form onSubmit={guardar} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                                   letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Paciente *</label>
                  <select style={inputSt} value={form.paciente_id}
                    onChange={e => setForm(f => ({ ...f, paciente_id: e.target.value }))} required>
                    <option value="">— Seleccionar —</option>
                    {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                                   letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Procedimiento *</label>
                  <select style={inputSt} value={form.plantilla_id}
                    onChange={e => selecPlantilla(e.target.value)} required>
                    <option value="">— Seleccionar plantilla —</option>
                    {PLANTILLAS.map(p => <option key={p.id} value={p.id}>{p.procedimiento}</option>)}
                  </select>
                </div>
              </div>

              {plantillaSelec && (
                <div>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                                   letterSpacing: ".05em", display: "block", marginBottom: 8 }}>
                    Texto del consentimiento
                  </label>
                  <div style={{
                    background: `${C.accent}08`, border: `1px solid ${C.accent}25`,
                    borderRadius: 10, padding: "14px 16px", fontSize: 13,
                    color: C.textSub, lineHeight: 1.7, marginBottom: 12,
                  }}>
                    {plantillaSelec.contenido}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>
                      Riesgos informados:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {plantillaSelec.riesgos.map((r, i) => (
                        <li key={i} style={{ fontSize: 13, color: C.muted, marginBottom: 3 }}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                                 letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
                  Notas adicionales
                </label>
                <textarea style={{ ...inputSt, minHeight: 70, resize: "vertical" }} value={form.notas}
                  placeholder="Consideraciones especiales del paciente..."
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 9,
                             padding: "10px 22px", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                  Cancelar
                </button>
                <button type="submit"
                  style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                             border: "none", borderRadius: 9, padding: "10px 26px",
                             color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
                             boxShadow: `0 4px 14px rgba(233,30,140,.35)` }}>
                  <i className="bi bi-check-lg me-1" /> Emitir consentimiento
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
