import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const FASES = [
  { key: "dia1",   label: "Día 1",     color: "#f59e0b" },
  { key: "dia3",   label: "Día 3",     color: "#e91e8c" },
  { key: "dia7",   label: "Semana 1",  color: "#8b5cf6" },
  { key: "dia15",  label: "2 semanas", color: "#2196f3" },
  { key: "dia30",  label: "1 mes",     color: "#10b981" },
  { key: "dia90",  label: "3 meses",   color: "#10b981" },
  { key: "dia180", label: "6 meses",   color: "#10b981" },
];

const CICATRIZ_OPC = ["Sin alteraciones", "Eritematosa", "Elevada", "Deprimida", "Queloidea", "Hipopigmentada"];
const RESULTADO_OPC = ["Excelente", "Muy bueno", "Bueno", "Regular", "Requiere revisión"];

export default function SeguimientoPostOp() {
  const [pacientes,   setPacientes]  = useState([]);
  const [pacId,       setPacId]      = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pacienteIdInicial = searchParams.get("paciente_id");
  const [registros,   setRegistros]  = useState([]);
  const [showModal,   setShowModal]  = useState(false);
  const [form,        setForm]       = useState(initForm());

  function initForm() {
    return {
      fase: "dia1", procedimiento: "", dolor_eva: "0",
      edema: "Leve", cicatriz: "Sin alteraciones", resultado: "Bueno",
      indicaciones: "", proxima_cita: "", necesita_retoq: false,
    };
  }

  useEffect(() => {
    api.get("/pacientes").then(r => {
      const listaPacientes = r.data.data || [];
      setPacientes(listaPacientes);
      if (pacienteIdInicial) {
        const pacienteInicial = listaPacientes.find(p => String(p.id) === String(pacienteIdInicial));
        if (pacienteInicial) setPacId(String(pacienteInicial.id));
      }
    }).catch(() => {});
  }, [pacienteIdInicial]);

  useEffect(() => {
    if (!pacId) { setRegistros([]); return; }
    const saved = JSON.parse(localStorage.getItem(`seguimiento_postop_${pacId}`) || "[]");
    setRegistros(saved);
  }, [pacId]);

  const guardar = (e) => {
    e.preventDefault();
    const nuevo = { ...form, id: Date.now(), pac_id: pacId, creado_en: new Date().toISOString() };
    const lista = [...registros, nuevo];
    localStorage.setItem(`seguimiento_postop_${pacId}`, JSON.stringify(lista));
    setRegistros(lista);
    setShowModal(false);
    setForm(initForm());
  };

  const eliminar = (id) => {
    const lista = registros.filter(r => r.id !== id);
    localStorage.setItem(`seguimiento_postop_${pacId}`, JSON.stringify(lista));
    setRegistros(lista);
  };

  const pacSeleccionado = pacientes.find(p => String(p.id) === String(pacId));

  return (
    <div style={{ background: C.bg, minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a1035 0%, #2d1045 50%, #1a2744 100%)",
        padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 8,
              color: "#fff", padding: "9px 16px", fontSize: 14, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <i className="bi bi-arrow-left" /> Atrás
          </button>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 14px rgba(233,30,140,.4)`,
          }}>
            <i className="bi bi-clipboard2-pulse-fill" style={{ fontSize: 20, color: "#fff" }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: "#fff" }}>Seguimiento Post-Operatorio</h4>
            <span style={{ color: "rgba(255,255,255,.5)", fontSize: 13 }}>Control de evolución y cicatrización por fases</span>
          </div>
        </div>
        {pacId && (
          <button
            onClick={() => { setForm(initForm()); setShowModal(true); }}
            style={{
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
              border: "none", borderRadius: 10, padding: "9px 18px",
              color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: `0 4px 14px rgba(233,30,140,.4)`,
            }}>
            <i className="bi bi-plus-lg" /> Nuevo control
          </button>
        )}
      </div>
      <div style={{ padding: "20px 24px" }}>


      {/* Selector paciente */}
      <div style={{ maxWidth: 380, marginBottom: 24 }}>
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                         letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Paciente</label>
        <select style={{ ...inputSt }} value={pacId} onChange={e => setPacId(e.target.value)}>
          <option value="">— Seleccionar paciente —</option>
          {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>)}
        </select>
      </div>

      {/* Info paciente */}
      {pacSeleccionado && (
        <div style={{
          background: `${C.accent}08`, border: `1px solid ${C.accent}20`,
          borderRadius: 12, padding: "12px 18px", marginBottom: 24,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {(pacSeleccionado.nombres?.[0] || "?").toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{pacSeleccionado.nombres} {pacSeleccionado.apellidos}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{registros.length} control(es) post-op registrado(s)</div>
          </div>
        </div>
      )}

      {!pacId ? (
        <EmptyState icon="bi-person-circle" titulo="Selecciona un paciente" desc="Elige un paciente para ver su timeline post-operatorio." />
      ) : !registros.length ? (
        <EmptyState icon="bi-clipboard2-pulse" titulo="Sin controles registrados" desc="Registra el primer control post-operatorio de este paciente." />
      ) : (
        /* Timeline */
        <div style={{ position: "relative", paddingLeft: 32 }}>
          <div style={{
            position: "absolute", left: 15, top: 0, bottom: 0,
            width: 2, background: `linear-gradient(180deg, ${C.accent}, transparent)`,
          }} />
          {registros.map((r, i) => {
            const fase = FASES.find(f => f.key === r.fase) || { label: r.fase, color: C.accent };
            return (
              <div key={r.id} style={{ position: "relative", marginBottom: 20 }}>
                {/* Punto del timeline */}
                <div style={{
                  position: "absolute", left: -25, top: 14,
                  width: 18, height: 18, borderRadius: "50%",
                  background: fase.color, border: "3px solid #f0f2f5",
                  boxShadow: `0 0 0 2px ${fase.color}55`,
                }} />
                <div style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 14, overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                }}>
                  {/* Header */}
                  <div style={{
                    padding: "12px 18px", borderBottom: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        background: `${fase.color}22`, border: `1px solid ${fase.color}44`,
                        borderRadius: 8, padding: "4px 12px",
                        color: fase.color, fontWeight: 700, fontSize: 13,
                      }}>
                        {fase.label}
                      </span>
                      <span style={{ fontWeight: 600, color: C.text }}>{r.procedimiento}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: C.muted }}>
                        {new Date(r.creado_en).toLocaleDateString("es-PE")}
                      </span>
                      {r.necesita_retoq && (
                        <span style={{
                          background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)",
                          borderRadius: 6, padding: "3px 10px", fontSize: 11,
                          color: "#f59e0b", fontWeight: 600,
                        }}>
                          <i className="bi bi-exclamation-triangle-fill me-1" />Requiere retoque
                        </span>
                      )}
                      <button onClick={() => eliminar(r.id)}
                        style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
                        <i className="bi bi-trash" style={{ fontSize: 14 }} />
                      </button>
                    </div>
                  </div>
                  {/* Grid datos */}
                  <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
                    <DatoItem icon="bi-thermometer-half" label="Dolor (EVA)" value={`${r.dolor_eva} / 10`} />
                    <DatoItem icon="bi-droplet-fill" label="Edema" value={r.edema} />
                    <DatoItem icon="bi-bandaid-fill" label="Cicatriz" value={r.cicatriz} />
                    <DatoItem icon="bi-star-fill" label="Resultado" value={r.resultado} />
                    {r.proxima_cita && <DatoItem icon="bi-calendar2" label="Próximo control" value={new Date(r.proxima_cita).toLocaleDateString("es-PE")} />}
                  </div>
                  {r.indicaciones && (
                    <div style={{ padding: "0 18px 14px" }}>
                      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Indicaciones:</div>
                      <div style={{ fontSize: 13, color: C.textSub }}>{r.indicaciones}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      </div>{/* fin padding */}

      {/* Modal nuevo control */}
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
            background: C.card, borderRadius: 16, width: "calc(100% - 32px)", maxWidth: 640,
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
                <i className="bi bi-clipboard2-pulse-fill" style={{ color: "#f9a8d4", fontSize: 18 }} />
                Nuevo Control Post-Operatorio
              </h5>
              <button onClick={() => setShowModal(false)}
                style={{ background: "rgba(239,68,68,.2)", border: "none", borderRadius: 8,
                           width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                           color: "#fca5a5", cursor: "pointer", fontSize: 16 }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <form onSubmit={guardar} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <Lbl>Fase / Período *</Lbl>
                  <select style={inputSt} value={form.fase} onChange={e => setForm(f => ({ ...f, fase: e.target.value }))}>
                    {FASES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Procedimiento *</Lbl>
                  <input style={inputSt} value={form.procedimiento} required
                    placeholder="Ej: Rinoplastia"
                    onChange={e => setForm(f => ({ ...f, procedimiento: e.target.value }))} />
                </div>
                <div>
                  <Lbl>Dolor EVA (0–10)</Lbl>
                  <input style={inputSt} type="range" min="0" max="10"
                    value={form.dolor_eva} onChange={e => setForm(f => ({ ...f, dolor_eva: e.target.value }))} />
                  <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700, color: C.accent, marginTop: 4 }}>
                    {form.dolor_eva}
                  </div>
                </div>
                <div>
                  <Lbl>Edema</Lbl>
                  <select style={inputSt} value={form.edema} onChange={e => setForm(f => ({ ...f, edema: e.target.value }))}>
                    {["Ausente","Leve","Moderado","Severo"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Estado de cicatriz</Lbl>
                  <select style={inputSt} value={form.cicatriz} onChange={e => setForm(f => ({ ...f, cicatriz: e.target.value }))}>
                    {CICATRIZ_OPC.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Resultado global</Lbl>
                  <select style={inputSt} value={form.resultado} onChange={e => setForm(f => ({ ...f, resultado: e.target.value }))}>
                    {RESULTADO_OPC.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <Lbl>Próximo control</Lbl>
                  <input style={inputSt} type="date" value={form.proxima_cita}
                    onChange={e => setForm(f => ({ ...f, proxima_cita: e.target.value }))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 24 }}>
                  <input type="checkbox" id="retoq" checked={form.necesita_retoq}
                    onChange={e => setForm(f => ({ ...f, necesita_retoq: e.target.checked }))}
                    style={{ width: 16, height: 16 }} />
                  <label htmlFor="retoq" style={{ fontSize: 13, color: C.text, cursor: "pointer" }}>
                    Requiere retoque
                  </label>
                </div>
              </div>
              <div>
                <Lbl>Indicaciones post-control</Lbl>
                <textarea style={{ ...inputSt, minHeight: 80, resize: "vertical" }} value={form.indicaciones}
                  placeholder="Cuidados, medicamentos, restricciones..."
                  onChange={e => setForm(f => ({ ...f, indicaciones: e.target.value }))} />
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
                  <i className="bi bi-check-lg me-1" /> Guardar control
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function Lbl({ children }) {
  return (
    <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                     letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
      {children}
    </label>
  );
}

function DatoItem({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <i className={`bi ${icon}`} style={{ color: C.accent, fontSize: 13, marginTop: 2 }} />
      <div>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, titulo, desc }) {
  return (
    <div style={{ textAlign: "center", padding: "72px 0" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, margin: "0 auto 18px",
        background: `${C.accent}08`, border: `1px solid ${C.accent}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`bi ${icon}`} style={{ fontSize: 30, color: C.accent }} />
      </div>
      <p style={{ color: C.muted, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{titulo}</p>
      <p style={{ color: C.mutedLt, fontSize: 13, margin: 0 }}>{desc}</p>
    </div>
  );
}
