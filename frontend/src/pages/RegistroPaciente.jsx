/**
 * Portal público de auto-registro de pacientes
 * URL: /registro?clinica_id=1
 *
 * FLUJO A – Nuevo:       Datos → Foto → Documentos → Confirmación → (Agendar cita)
 * FLUJO B – Subsecuente: Verificar DNI → Agendar cita → Confirmación
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";

const BASE     = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

// ── Departamentos y municipios de Honduras ────────────
const HONDURAS_DATA = {
  "Atlántida":         ["Arizona","El Porvenir","Esparta","Jutiapa","La Ceiba","La Masica","San Francisco","Tela"],
  "Choluteca":         ["Apacilagua","Choluteca","Concepción de María","Duyure","El Corpus","El Triunfo","Marcovia","Morolica","Namasigüe","Orocuina","Pespire","San Antonio de Flores","San Isidro","San José","San Marcos de Colón","Santa Ana de Yusguare"],
  "Colón":             ["Balfate","Bonito Oriental","Iriona","Limón","Sabá","Santa Rosa de Aguán","Sonaguera","Tocoa","Trujillo"],
  "Comayagua":         ["Ajuterique","Comayagua","El Rosario","Esquías","Humuya","La Libertad","La Trinidad","Lamaní","Las Lajas","Lejamaní","Minas de Oro","Ojos de Agua","San Jerónimo","San José de Comayagua","San José del Potrero","San Luis","San Sebastián","Siguatepeque","Taulabé","Villa de San Antonio"],
  "Copán":             ["Cabañas","Concepción","Copán Ruinas","Corquín","Cucuyagua","Dolores","Dulce Nombre","El Paraíso","Florida","La Jigua","La Unión","Nueva Arcadia","San Agustín","San Antonio","San Jerónimo","San José","San Juan de Opoa","San Nicolás","San Pedro","Santa Rita","Santa Rosa de Copán","Trinidad de Copán","Veracruz"],
  "Cortés":            ["Choloma","La Lima","Omoa","Pimienta","Potrerillos","Puerto Cortés","San Antonio de Cortés","San Francisco de Yojoa","San Manuel","San Pedro Sula","Santa Cruz de Yojoa","Villanueva"],
  "El Paraíso":        ["Alauca","Danlí","El Paraíso","Güinope","Jacaleapa","Liure","Morocelí","Oropolí","Potrerillos","San Antonio de Flores","San Lucas","San Matías","Soledad","Teupasenti","Texiguat","Trojes","Vado Ancho","Yauyupe","Yuscarán"],
  "Francisco Morazán": ["Alubarén","Cedros","Curarén","El Porvenir","Guaimaca","La Libertad","La Venta","Lepaterique","Maraita","Marale","Nueva Armenia","Ojojona","Reitoca","Sabanagrande","San Antonio de Oriente","San Buenaventura","San Ignacio","San Juan de Flores","San Miguelito","Santa Ana","Santa Lucía","Talanga","Tatumbla","Tegucigalpa","Valle de Ángeles","Vallecillo","Villa de San Francisco"],
  "Gracias a Dios":    ["Ahuas","Brus Laguna","Juan Francisco Bulnes","Puerto Lempira","Villeda Morales","Wampusirpe"],
  "Intibucá":          ["Camasca","Colomoncagua","Concepción","Dolores","Intibucá","Jesús de Otoro","La Esperanza","Magdalena","Masaguara","San Antonio","San Francisco de Opalaca","San Isidro","San Juan","San Marcos de Sierra","San Miguel Guancapla","Santa Lucía","Yamaranguila"],
  "Islas de la Bahía": ["Guanaja","José Santos Guardiola","Roatán","Utila"],
  "La Paz":            ["Aguanqueterique","Cabañas","Cane","Chinacla","Guajiquiro","La Paz","Lauterique","Marcala","Mercedes de Oriente","Opatoro","San Antonio del Norte","San Juan","San Pedro de Tutule","Santa Ana","Santa Elena","Santa María","Santiago de Puringla","Yarula"],
  "Lempira":           ["Belén","Candelaria","Cololaca","Erandique","Gracias","Gualcince","Guarita","La Campa","La Iguala","La Unión","La Virtud","Las Flores","Lepaera","Mapulaca","Piraera","San Andrés","San Francisco","San Juan de Guarita","San Manuel Colohete","San Marcos de Caiquín","San Rafael","San Sebastián","Santa Cruz","Talgua","Tambla","Tomalá","Valladolid","Virginia"],
  "Ocotepeque":        ["Belén Gualcho","Concepción","Dolores Merendón","Fraternidad","La Encarnación","La Labor","Lucerna","Mercedes","Ocotepeque","San Fernando","San Francisco del Valle","San Jorge","San Marcos","Santa Fe","Sensenti","Sinuapa"],
  "Olancho":           ["Campamento","Catacamas","Concordia","Dulce Nombre de Culmí","El Rosario","Esquipulas del Norte","Gualaco","Guarizama","Guata","Jano","Juticalpa","La Unión","Mangulile","Manto","Patuca","Salama","San Esteban","San Francisco de Becerra","San Francisco de La Paz","Santa María del Real","Silca","Yocón"],
  "Santa Bárbara":     ["Arada","Atima","Azagualpa","Ceguaca","Chinda","Concepción del Norte","Concepción del Sur","El Níspero","Gualala","Ilama","Las Vegas","Macuelizo","Naranjito","Nuevo Celilac","Petoa","Protección","Quimistán","San Francisco de Ojuera","San José de Colinas","San Luis","San Marcos","San Nicolás","San Pedro Zacapa","San Vicente Centenario","Santa Bárbara","Santa Rita","Trinidad"],
  "Valle":             ["Alianza","Amapala","Aramecina","Caridad","Goascorán","Langue","Nacaome","San Francisco de Coray","San Lorenzo"],
  "Yoro":              ["Arenal","El Negrito","El Progreso","Jocón","Morazán","Olanchito","Santa Rita","Sulaco","Victoria","Yorito","Yoro"],
};

// ══════════════════════════════════════════════════════════════════════
// Sub-componente: Agendar cita (compartido por ambos flujos)
// ══════════════════════════════════════════════════════════════════════
function AgendarCita({ clinicaId, pacienteId, sessionToken, onDone }) {
  const [medicos,       setMedicos]       = useState([]);
  const [medicoId,      setMedicoId]      = useState("");
  const [fecha,         setFecha]         = useState("");
  const [slots,         setSlots]         = useState([]);
  const [slotSel,       setSlotSel]       = useState(null);
  const [motivo,        setMotivo]        = useState("");
  const [cargandoMed,   setCargandoMed]   = useState(true);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [agendando,     setAgendando]     = useState(false);
  const [error,         setError]         = useState("");

  useEffect(() => {
    fetch(`${BASE}/registro/doctores?clinica_id=${clinicaId}`)
      .then(r => r.json())
      .then(r => { if (r.ok) setMedicos(r.data); })
      .catch(() => {})
      .finally(() => setCargandoMed(false));
  }, [clinicaId]);

  useEffect(() => {
    if (!medicoId || !fecha) { setSlots([]); setSlotSel(null); return; }
    setCargandoSlots(true);
    setSlots([]);
    setSlotSel(null);
    fetch(`${BASE}/registro/slots?medico_id=${medicoId}&fecha=${fecha}&clinica_id=${clinicaId}`)
      .then(r => r.json())
      .then(r => { if (r.ok) setSlots(r.data); })
      .catch(() => {})
      .finally(() => setCargandoSlots(false));
  }, [medicoId, fecha, clinicaId]);

  const hoy = new Date().toISOString().slice(0, 10);

  const agendar = async () => {
    if (!slotSel) return;
    setAgendando(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/registro/cita`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { "x-session-token": sessionToken } : {}),
        },
        body: JSON.stringify({
          paciente_id: pacienteId,
          medico_id:   medicoId,
          inicio:      slotSel.inicio,
          fin:         slotSel.fin,
          motivo:      motivo || null,
          clinica_id:  clinicaId,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.msg);
      const medico = medicos.find(m => String(m.id) === String(medicoId));
      onDone({ citaId: data.id, slot: slotSel, medico });
    } catch (e) {
      setError(e.message || "Error al agendar. Intenta de nuevo.");
    } finally {
      setAgendando(false);
    }
  };

  return (
    <div>
      <div className="mb-3">
        <label className="form-label fw-semibold">
          <i className="bi bi-person-badge me-1 text-primary" />Médico
        </label>
        {cargandoMed ? (
          <div className="text-muted d-flex align-items-center gap-2 py-2">
            <span className="spinner-border spinner-border-sm" />Cargando médicos...
          </div>
        ) : medicos.length === 0 ? (
          <div className="alert alert-warning py-2 mb-0" style={{ fontSize: "0.875rem" }}>
            <i className="bi bi-exclamation-circle me-1" />No hay médicos disponibles actualmente.
          </div>
        ) : (
          <select
            className="form-select"
            value={medicoId}
            onChange={e => { setMedicoId(e.target.value); setFecha(""); setSlots([]); setSlotSel(null); }}
          >
            <option value="">— Seleccionar médico —</option>
            {medicos.map(m => (
              <option key={m.id} value={m.id}>
                {m.apellidos}, {m.nombres}{m.especialidad ? ` — ${m.especialidad}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {medicoId && (
        <div className="mb-3">
          <label className="form-label fw-semibold">
            <i className="bi bi-calendar3 me-1 text-primary" />Fecha de la cita
          </label>
          <input
            type="date"
            className="form-control"
            value={fecha}
            min={hoy}
            onChange={e => setFecha(e.target.value)}
          />
        </div>
      )}

      {medicoId && fecha && (
        <div className="mb-3">
          <label className="form-label fw-semibold">
            <i className="bi bi-clock me-1 text-primary" />Horario disponible
          </label>
          {cargandoSlots ? (
            <div className="text-muted d-flex align-items-center gap-2 py-2">
              <span className="spinner-border spinner-border-sm" />Cargando horarios...
            </div>
          ) : slots.length === 0 ? (
            <div className="alert alert-warning py-2 mb-0" style={{ fontSize: "0.875rem" }}>
              <i className="bi bi-calendar-x me-1" />No hay horarios disponibles para este día. Prueba con otra fecha.
            </div>
          ) : (
            <div className="d-flex flex-wrap gap-2 mt-1">
              {slots.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={`btn btn-sm ${slotSel === s ? "btn-primary" : "btn-outline-secondary"}`}
                  style={{ minWidth: 115 }}
                  onClick={() => setSlotSel(s === slotSel ? null : s)}
                >
                  <i className="bi bi-clock me-1" />{s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {slotSel && (
        <div className="mb-3">
          <label className="form-label fw-semibold">
            Motivo de consulta{" "}
            <span className="text-muted fw-normal">(opcional)</span>
          </label>
          <textarea
            className="form-control"
            rows={2}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ej. Consulta general, dolor de cabeza, revisión de rutina..."
          />
        </div>
      )}

      {error && (
        <div className="alert alert-danger py-2 d-flex align-items-center gap-2" style={{ fontSize: "0.875rem" }}>
          <i className="bi bi-exclamation-triangle-fill flex-shrink-0" />{error}
        </div>
      )}

      <div className="d-flex justify-content-end mt-4">
        <button
          className="btn btn-success px-4"
          onClick={agendar}
          disabled={!slotSel || agendando}
        >
          {agendando
            ? <><span className="spinner-border spinner-border-sm me-2" />Agendando...</>
            : <><i className="bi bi-calendar-check me-2" />Confirmar cita</>}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Sub-componente: Pantalla de cita confirmada
// ══════════════════════════════════════════════════════════════════════
function CitaConfirmada({ citaConf, email, subsecuente, pacienteId, clinicaId, sessionToken }) {
  const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";
  const { slot, medico } = citaConf;
  const fechaStr = slot?.inicio
    ? new Date(slot.inicio).toLocaleDateString("es-HN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : "";
  const horaStr = slot?.inicio
    ? new Date(slot.inicio).toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" })
    : "";

  const [showExamenes, setShowExamenes] = useState(false);
  const [examenes,     setExamenes]     = useState([]);
  const [cargandoExam, setCargandoExam] = useState(false);

  const verExamenes = async () => {
    setShowExamenes(true);
    if (examenes.length) return;
    setCargandoExam(true);
    try {
      const res = await fetch(`${BASE}/registro/estudios-pendientes`, {
        headers: sessionToken ? { "x-session-token": sessionToken } : {},
      });
      const data = await res.json();
      setExamenes(data.ok ? data.data : []);
    } catch { setExamenes([]); }
    finally { setCargandoExam(false); }
  };

  return (
    <div className="text-center py-2">
      <div
        className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-4"
        style={{ width: 80, height: 80 }}
      >
        <i className="bi bi-calendar-check-fill text-success" style={{ fontSize: "2.2rem" }} />
      </div>
      <h5 className="fw-bold text-success mb-2">¡Cita agendada exitosamente!</h5>
      <p className="text-muted mb-4">Tu cita ha sido registrada. Te esperamos puntualmente.</p>

      <div className="card bg-light border-0 rounded-4 p-4 text-start mb-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <i className="bi bi-person-badge-fill text-primary fs-4" />
          <div>
            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>MÉDICO</div>
            <div className="fw-semibold">
              {medico ? `${medico.apellidos}, ${medico.nombres}` : "—"}
              {medico?.especialidad
                ? <span className="text-muted fw-normal"> — {medico.especialidad}</span>
                : ""}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-3 mb-3">
          <i className="bi bi-calendar3 text-primary fs-4" />
          <div>
            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>FECHA</div>
            <div className="fw-semibold" style={{ textTransform: "capitalize" }}>{fechaStr}</div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-3">
          <i className="bi bi-clock-fill text-primary fs-4" />
          <div>
            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>HORA</div>
            <div className="fw-semibold">{horaStr}</div>
          </div>
        </div>
      </div>

      <div className="alert alert-info d-flex align-items-start gap-2 text-start mb-4" style={{ fontSize: "0.875rem" }}>
        <i className="bi bi-info-circle-fill mt-1 flex-shrink-0" />
        <div>
          Por favor llega <strong>10 minutos antes</strong> de tu cita.
          {email && <> El personal de la clínica tiene registrado el correo <strong>{email}</strong>.</>}
        </div>
      </div>
      {subsecuente && (
        <button
          className="btn btn-warning w-100 mb-2"
          onClick={verExamenes}
          style={{ fontWeight: 600 }}
        >
          <i className="bi bi-clipboard2-pulse-fill me-2" />
          Ver exámenes pendientes de cita anterior
        </button>
      )}

      {/* Modal exámenes pendientes */}
      {showExamenes && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999,
                   display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setShowExamenes(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520,
                     boxShadow: "0 8px 32px rgba(0,0,0,.2)", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #92400e 0%, #d97706 100%)",
                          padding: "14px 20px", display: "flex", alignItems: "center",
                          justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <i className="bi bi-clipboard2-pulse-fill" style={{ color: "#fef3c7" }} />
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>
                  Exámenes pendientes
                </span>
              </div>
              <button
                onClick={() => setShowExamenes(false)}
                style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 6,
                         color: "#fff", cursor: "pointer", padding: "2px 9px", fontSize: "1.1rem" }}
              >×</button>
            </div>
            {/* Body */}
            <div style={{ padding: "20px 24px", maxHeight: 360, overflowY: "auto" }}>
              {cargandoExam ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-warning" style={{ width: "1.4rem", height: "1.4rem" }} />
                  <div className="mt-2 text-muted" style={{ fontSize: "0.85rem" }}>Cargando...</div>
                </div>
              ) : examenes.length === 0 ? (
                <div className="text-center py-4">
                  <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "2.5rem" }} />
                  <p className="mt-2 text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                    No tienes exámenes pendientes. ¡Todo en orden!
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
                    El médico dejó los siguientes exámenes solicitados en tu cita anterior.
                    Por favor tráelos el día de tu cita.
                  </p>
                  {examenes.map((ex) => (
                    <div key={ex.id} style={{
                      background: ex.urgente ? "#fff7ed" : "#f9fafb",
                      border: `1px solid ${ex.urgente ? "#fdba74" : "#e5e7eb"}`,
                      borderRadius: 10, padding: "12px 14px", marginBottom: 10,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{
                          background: ex.tipo === "LABORATORIO" ? "#dbeafe" :
                                      ex.tipo === "IMAGENOLOGIA" ? "#ede9fe" : "#f3f4f6",
                          color: ex.tipo === "LABORATORIO" ? "#1d4ed8" :
                                 ex.tipo === "IMAGENOLOGIA" ? "#7c3aed" : "#374151",
                          borderRadius: 20, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700,
                        }}>{ex.tipo}</span>
                        {ex.urgente === 1 && (
                          <span style={{ background: "#fef2f2", color: "#dc2626",
                                         borderRadius: 20, padding: "2px 10px",
                                         fontSize: "0.7rem", fontWeight: 700 }}>
                            <i className="bi bi-exclamation-triangle-fill me-1" />URGENTE
                          </span>
                        )}
                        <span style={{ fontSize: "0.72rem", color: "#9ca3af", marginLeft: "auto" }}>
                          {new Date(ex.creado_en).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.87rem", color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>
                        {ex.descripcion || "Sin descripción"}
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 4, marginBottom: 0 }}>
                        Solicitado por: Dr(a). {ex.medico_apellidos}, {ex.medico_nombres}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding: "12px 24px 18px", borderTop: "1px solid #f3f4f6", textAlign: "right" }}>
              <button
                onClick={() => setShowExamenes(false)}
                style={{ background: "#f59e0b", border: "none", borderRadius: 8,
                         padding: "8px 22px", color: "#fff", fontWeight: 600,
                         fontSize: "0.87rem", cursor: "pointer" }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ProgressBar flujo Nuevo (pasos 0–3)
// ══════════════════════════════════════════════════════════════════════
function ProgressBarNuevo({ paso }) {
  const pasos = ["Datos personales", "Tu foto", "Documentos", "Confirmación"];
  return (
    <div className="d-flex align-items-center gap-0 mb-4">
      {pasos.map((label, i) => (
        <div key={i} className="d-flex align-items-center flex-grow-1">
          <div className="d-flex flex-column align-items-center" style={{ minWidth: 68 }}>
            <div
              className={`rounded-circle d-flex align-items-center justify-content-center fw-bold mb-1 ${
                i < paso  ? "bg-success text-white" :
                i === paso ? "bg-primary text-white" : "bg-light text-muted border"
              }`}
              style={{ width: 34, height: 34, fontSize: "0.85rem" }}
            >
              {i < paso ? <i className="bi bi-check-lg" /> : i + 1}
            </div>
            <span style={{ fontSize: "0.62rem", color: i === paso ? "#0d6efd" : "#94a3b8", textAlign: "center" }}>
              {label}
            </span>
          </div>
          {i < pasos.length - 1 && (
            <div className="flex-grow-1 mb-3" style={{ height: 2, background: i < paso ? "#198754" : "#e2e8f0" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ProgressBar flujo Subsecuente (pasos 0–2)
// ══════════════════════════════════════════════════════════════════════
function ProgressBarSub({ paso }) {
  const pasos = ["Verificar identidad", "Agendar cita", "Confirmación"];
  return (
    <div className="d-flex align-items-center gap-0 mb-4">
      {pasos.map((label, i) => (
        <div key={i} className="d-flex align-items-center flex-grow-1">
          <div className="d-flex flex-column align-items-center" style={{ minWidth: 80 }}>
            <div
              className={`rounded-circle d-flex align-items-center justify-content-center fw-bold mb-1 ${
                i < paso  ? "bg-success text-white" :
                i === paso ? "bg-success text-white" : "bg-light text-muted border"
              }`}
              style={{ width: 34, height: 34, fontSize: "0.85rem" }}
            >
              {i < paso ? <i className="bi bi-check-lg" /> : i + 1}
            </div>
            <span style={{ fontSize: "0.62rem", color: i === paso ? "#198754" : "#94a3b8", textAlign: "center" }}>
              {label}
            </span>
          </div>
          {i < pasos.length - 1 && (
            <div className="flex-grow-1 mb-3" style={{ height: 2, background: i < paso ? "#198754" : "#e2e8f0" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════════════════
export default function RegistroPaciente() {
  const [params]   = useSearchParams();
  const clinicaId  = params.get("clinica_id") || "";

  // ── Info de la clínica ────────────────────────────────
  const [clinicaInfo, setClinicaInfo] = useState(null);
  useEffect(() => {
    if (!clinicaId) return;
    fetch(`${BASE}/registro/info?clinica_id=${clinicaId}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setClinicaInfo(d); })
      .catch(() => {});
  }, [clinicaId]);

  // ── Navegación ────────────────────────────────────────
  const [tipo, setTipo] = useState(null); // null | "nuevo" | "subsecuente"
  const [paso, setPaso] = useState(0);

  // ── Estado general ────────────────────────────────────
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [pacienteId,   setPacienteId]   = useState(null);
  const [pacienteInfo, setPacienteInfo] = useState(null);
  const [citaConf,     setCitaConf]     = useState(null);
  const [sessionToken, setSessionToken] = useState(null);

  // ── Formulario (flujo nuevo) ──────────────────────────
  const [form, setForm] = useState({
    nombres: "", apellidos: "", dni: "",
    fecha_nacimiento: "", sexo: "",
    telefono: "", email: "",
    direccion: "", departamento: "", municipio: "", pais: "Honduras",
    grupo_sanguineo: "",
  });

  // ── Foto ──────────────────────────────────────────────
  const [camActiva,    setCamActiva]    = useState(false);
  const [camStream,    setCamStream]    = useState(null);
  const [fotoBlob,     setFotoBlob]     = useState(null);
  const [fotoPreview,  setFotoPreview]  = useState(null);
  const [fotoSubiendo, setFotoSubiendo] = useState(false);
  const videoRef  = useRef();
  const canvasRef = useRef();
  const fotoInput = useRef();

  // ── DNI (subsecuente) ─────────────────────────────────
  const [dniBuscar,   setDniBuscar]   = useState("");
  const [buscandoDni, setBuscandoDni] = useState(false);

  const DOCS_CHECKLIST = [
    { icon: "bi-person-vcard",  label: "DNI / Carnet de identidad (original + copia)" },
    { icon: "bi-shield-plus",   label: "Tarjeta de seguro médico (si aplica)" },
    { icon: "bi-file-earmark",  label: "Exámenes o resultados previos relevantes" },
    { icon: "bi-heart-pulse",   label: "Información sobre alergias o medicamentos actuales" },
  ];

  // ── Cámara ────────────────────────────────────────────
  const abrirCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setCamStream(stream);
      setCamActiva(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch {
      setError("No se pudo acceder a la cámara. Usa 'Subir imagen' en su lugar.");
    }
  };

  const cerrarCamara = useCallback(() => {
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    setCamStream(null);
    setCamActiva(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [camStream]);

  const tomarFoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      const file = new File([blob], "foto-perfil.jpg", { type: "image/jpeg" });
      setFotoBlob(file);
      setFotoPreview(URL.createObjectURL(blob));
      cerrarCamara();
    }, "image/jpeg", 0.9);
  };

  const seleccionarArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoBlob(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const subirFotoYAvanzar = async () => {
    if (!fotoBlob || !pacienteId) { setPaso(2); return; }
    setFotoSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("foto", fotoBlob);
      fd.append("clinica_id", clinicaId);
      await axios.post(`${BASE}/registro/${pacienteId}/foto`, fd, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(sessionToken ? { "x-session-token": sessionToken } : {}),
        },
      });
    } catch { /* no bloquear flujo */ }
    setFotoSubiendo(false);
    setPaso(2);
  };

  // ── Submit datos (nuevo) ──────────────────────────────
  const cambioForm = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleRegistro = async (e) => {
    e.preventDefault();
    if (!clinicaId) return setError("Falta el parámetro clinica_id en la URL");
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${BASE}/registro`, { ...form, clinica_id: clinicaId });
      setPacienteId(res.data.id);
      setSessionToken(res.data.session_token);
      setPacienteInfo({ nombres: form.nombres, apellidos: form.apellidos, email: form.email });
      setPaso(1);
    } catch (err) {
      setError(err?.response?.data?.msg || "Error al registrar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // ── Buscar por DNI (subsecuente) ──────────────────────
  const buscarPorDni = async (e) => {
    e.preventDefault();
    if (!dniBuscar.trim()) return;
    if (!clinicaId) return setError("Falta el parámetro clinica_id en la URL");
    setError("");
    setBuscandoDni(true);
    try {
      const res  = await fetch(`${BASE}/registro/buscar-dni?dni=${encodeURIComponent(dniBuscar.trim())}&clinica_id=${clinicaId}`);
      const data = await res.json();
      if (!data.ok || !data.encontrado) {
        setError("No encontramos un paciente con ese DNI. ¿Quizás eres nuevo?");
        return;
      }
      setPacienteId(data.paciente.id);
      setSessionToken(data.session_token);
      setPacienteInfo(data.paciente);
      setPaso(1);
    } catch {
      setError("Error al buscar. Intenta de nuevo.");
    } finally {
      setBuscandoDni(false);
    }
  };

  // ── Cita confirmada ───────────────────────────────────
  const handleCitaConfirmada = (citaData) => {
    setCitaConf(citaData);
    setPaso(tipo === "nuevo" ? 5 : 2);
  };

  const elegirTipo = (t) => {
    setTipo(t);
    setPaso(0);
    setError("");
    setCitaConf(null);
  };

  // ════════════════════════════════════════════════════════
  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: "#f1f5f9" }}>

      <nav className="navbar navbar-dark bg-dark px-4" style={{ height: 56 }}>
        <span className="navbar-brand mb-0 fw-bold">
          <i className="bi bi-hospital-fill text-primary me-2" />KG-Medic
        </span>
        {tipo && (
          <button
            className="btn btn-sm btn-outline-light"
            onClick={() => { setTipo(null); setPaso(0); setError(""); }}
          >
            <i className="bi bi-arrow-left me-1" />Volver al inicio
          </button>
        )}
      </nav>

      <div className="container py-5" style={{ maxWidth: tipo === null ? 820 : 640 }}>

        {/* ═══ PANTALLA INICIAL ═══════════════════════════ */}
        {tipo === null && (
          <div>
            <div className="text-center mb-5">
              {clinicaInfo ? (
                <>
                  <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: 72, height: 72 }}>
                    <i className="bi bi-hospital-fill text-primary" style={{ fontSize: "2rem" }} />
                  </div>
                  <h3 className="fw-bold text-dark mb-1">{clinicaInfo.nombre}</h3>
                  {clinicaInfo.medico && (
                    <p className="text-muted mb-1" style={{ fontSize: "1rem" }}>
                      {clinicaInfo.medico.especialidad
                        ? `${clinicaInfo.medico.apellidos.split(' ')[0]}, ${clinicaInfo.medico.especialidad}`
                        : `Dr(a). ${clinicaInfo.medico.nombres} ${clinicaInfo.medico.apellidos}`}
                    </p>
                  )}
                  <p className="text-muted" style={{ fontSize: "0.9rem" }}>¿Cómo podemos ayudarte hoy?</p>
                </>
              ) : (
                <>
                  <h3 className="fw-bold text-dark">Portal de pacientes</h3>
                  <p className="text-muted">¿Cómo podemos ayudarte hoy?</p>
                </>
              )}
            </div>
            <div className="row g-4 justify-content-center">
              <div className="col-md-6">
                <div
                  className="card border-0 shadow-sm rounded-4 p-4 h-100"
                  style={{ cursor: "pointer", transition: "box-shadow .2s, transform .2s" }}
                  onClick={() => elegirTipo("nuevo")}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(13,110,253,.18)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}
                >
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 60, height: 60 }}>
                      <i className="bi bi-person-plus-fill text-primary" style={{ fontSize: "1.7rem" }} />
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0">Crear nuevo expediente</h5>
                      <span className="text-muted" style={{ fontSize: "0.85rem" }}>Primera visita a la clínica</span>
                    </div>
                  </div>
                  <p className="text-muted mb-4" style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
                    Crea tu ficha médica en minutos y agenda tu primera cita de forma sencilla.
                  </p>
                  <button className="btn btn-primary w-100" tabIndex={-1}>
                    <i className="bi bi-person-plus me-2" />Crear mi ficha médica
                  </button>
                </div>
              </div>
              <div className="col-md-6">
                <div
                  className="card border-0 shadow-sm rounded-4 p-4 h-100"
                  style={{ cursor: "pointer", transition: "box-shadow .2s, transform .2s" }}
                  onClick={() => elegirTipo("subsecuente")}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(25,135,84,.18)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}
                >
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 60, height: 60 }}>
                      <i className="bi bi-person-check-fill text-success" style={{ fontSize: "1.7rem" }} />
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0">Ya tengo expediente</h5>
                      <span className="text-muted" style={{ fontSize: "0.85rem" }}>Paciente subsecuente</span>
                    </div>
                  </div>
                  <p className="text-muted mb-4" style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
                    Ingresa tu DNI para verificar tu identidad y agenda tu próxima cita al instante.
                  </p>
                  <button className="btn btn-success w-100" tabIndex={-1}>
                    <i className="bi bi-calendar-plus me-2" />Agendar mi cita
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ═══ FLUJO A — NUEVO ════════════════════════════ */}
        {tipo === "nuevo" && (
          <div>
            <div className="text-center mb-4">
              <h3 className="fw-bold text-dark">Registro de paciente nuevo</h3>
              <p className="text-muted">Completa el formulario para crear tu ficha médica</p>
            </div>
            <div className="card shadow-sm border-0 rounded-4 p-4 p-md-5">

              {paso <= 3 && <ProgressBarNuevo paso={paso} />}

              {paso === 4 && (
                <div className="text-center mb-4">
                  <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: 64, height: 64 }}>
                    <i className="bi bi-calendar-plus-fill text-primary" style={{ fontSize: "1.8rem" }} />
                  </div>
                  <h5 className="fw-bold mb-1">Agenda tu primera cita</h5>
                  <p className="text-muted" style={{ fontSize: "0.875rem" }}>Elige médico, fecha y horario de tu preferencia.</p>
                </div>
              )}

              {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2">
                  <i className="bi bi-exclamation-triangle-fill" />{error}
                </div>
              )}

              {/* Nuevo · Paso 0: Datos personales */}
              {paso === 0 && (
                <form onSubmit={handleRegistro}>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold">Nombres <span className="text-danger">*</span></label>
                      <input className="form-control" name="nombres" value={form.nombres} onChange={cambioForm} required placeholder="Ej. María Elena" />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold">Apellidos <span className="text-danger">*</span></label>
                      <input className="form-control" name="apellidos" value={form.apellidos} onChange={cambioForm} required placeholder="Ej. García López" />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold">DNI / Documento</label>
                      <input className="form-control" name="dni" value={form.dni} onChange={cambioForm} placeholder="Número de documento" />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold">Fecha de nacimiento</label>
                      <input className="form-control" type="date" name="fecha_nacimiento" value={form.fecha_nacimiento} onChange={cambioForm} />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold">Sexo</label>
                      <select className="form-select" name="sexo" value={form.sexo} onChange={cambioForm}>
                        <option value="">— Seleccionar —</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="O">Otro</option>
                      </select>
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold">Grupo sanguíneo</label>
                      <select className="form-select" name="grupo_sanguineo" value={form.grupo_sanguineo} onChange={cambioForm}>
                        <option value="">— Seleccionar —</option>
                        {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold">Teléfono</label>
                      <input className="form-control" name="telefono" value={form.telefono} onChange={cambioForm} placeholder="Ej. 9876-5432" />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold">Correo electrónico <span className="text-danger">*</span></label>
                      <input className="form-control" type="email" name="email" value={form.email} onChange={cambioForm} required placeholder="tu@email.com" />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold">Departamento</label>
                      <select className="form-select" name="departamento" value={form.departamento}
                        onChange={e => setForm(f => ({ ...f, departamento: e.target.value, municipio: "" }))}>
                        <option value="">— Seleccionar —</option>
                        {Object.keys(HONDURAS_DATA).sort().map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold">Municipio</label>
                      <select className="form-select" name="municipio" value={form.municipio} onChange={cambioForm} disabled={!form.departamento}>
                        <option value="">— Seleccionar —</option>
                        {(HONDURAS_DATA[form.departamento] || []).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Dirección</label>
                      <input className="form-control" name="direccion" value={form.direccion} onChange={cambioForm} placeholder="Calle, número, referencia" />
                    </div>
                  </div>
                  <div className="d-flex justify-content-end mt-4">
                    <button className="btn btn-primary px-4" disabled={loading}>
                      {loading ? <><span className="spinner-border spinner-border-sm me-2" />Guardando...</> : <>Siguiente <i className="bi bi-arrow-right ms-1" /></>}
                    </button>
                  </div>
                </form>
              )}

              {/* Nuevo · Paso 1: Foto */}
              {paso === 1 && (
                <div className="text-center">
                  <p className="text-muted mb-4">
                    <i className="bi bi-camera-fill me-1 text-primary" />
                    Toma o sube una foto tuya para que el personal pueda identificarte.
                    <span className="d-block mt-1" style={{ fontSize: "0.8rem" }}>Este paso es opcional.</span>
                  </p>
                  {fotoPreview && (
                    <img src={fotoPreview} alt="Tu foto" className="rounded-circle border border-3 border-primary mb-3"
                      style={{ width: 160, height: 160, objectFit: "cover" }} />
                  )}
                  {camActiva && (
                    <div className="mb-3">
                      <video ref={videoRef} autoPlay playsInline muted className="rounded-3 border w-100"
                        style={{ maxHeight: 280, background: "#000", objectFit: "cover" }} />
                      <canvas ref={canvasRef} className="d-none" />
                      <div className="d-flex gap-2 justify-content-center mt-2">
                        <button type="button" className="btn btn-success" onClick={tomarFoto}>
                          <i className="bi bi-camera me-1" />Capturar foto
                        </button>
                        <button type="button" className="btn btn-outline-secondary" onClick={cerrarCamara}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {!camActiva && <canvas ref={canvasRef} className="d-none" />}
                  {!camActiva && (
                    <div className="d-flex flex-column align-items-center gap-3 my-3">
                      <button type="button" className="btn btn-outline-primary px-4" onClick={abrirCamara}>
                        <i className="bi bi-camera me-2" />Usar cámara
                      </button>
                      <button type="button" className="btn btn-outline-secondary px-4" onClick={() => fotoInput.current?.click()}>
                        <i className="bi bi-image me-2" />Subir imagen
                      </button>
                      <input ref={fotoInput} type="file" accept="image/*" className="d-none" onChange={seleccionarArchivo} />
                    </div>
                  )}
                  <div className="d-flex justify-content-between mt-4">
                    <button type="button" className="btn btn-link text-muted" onClick={() => setPaso(2)}>Omitir este paso</button>
                    <button type="button" className="btn btn-primary px-4" onClick={subirFotoYAvanzar} disabled={fotoSubiendo}>
                      {fotoSubiendo ? <><span className="spinner-border spinner-border-sm me-2" />Subiendo...</> : <>Continuar <i className="bi bi-arrow-right ms-1" /></>}
                    </button>
                  </div>
                </div>
              )}

              {/* Nuevo · Paso 2: Documentos */}
              {paso === 2 && (
                <div>
                  <p className="text-muted mb-4">
                    <i className="bi bi-info-circle me-1 text-primary" />
                    El personal de la clínica cargará tus documentos en tu primera visita. Prepara lo siguiente:
                  </p>
                  <ul className="list-unstyled d-flex flex-column gap-3 mb-4">
                    {DOCS_CHECKLIST.map((item, i) => (
                      <li key={i} className="d-flex align-items-center gap-3 bg-light rounded-3 p-3">
                        <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40 }}>
                          <i className={`bi ${item.icon} text-primary`} />
                        </div>
                        <span style={{ fontSize: "0.9rem" }}>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="alert alert-info d-flex gap-2 align-items-start" style={{ fontSize: "0.85rem" }}>
                    <i className="bi bi-shield-check-fill mt-1 flex-shrink-0 text-info" />
                    <div>Tus documentos serán almacenados de forma <strong>segura y confidencial</strong>, accesible solo por personal médico autorizado.</div>
                  </div>
                  <div className="d-flex justify-content-end mt-2">
                    <button className="btn btn-primary px-4" onClick={() => setPaso(3)}>
                      Entendido — Continuar <i className="bi bi-arrow-right ms-1" />
                    </button>
                  </div>
                </div>
              )}

              {/* Nuevo · Paso 3: Confirmación registro */}
              {paso === 3 && (
                <div className="text-center py-2">
                  <div className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-4" style={{ width: 80, height: 80 }}>
                    <i className="bi bi-envelope-check-fill text-success" style={{ fontSize: "2.2rem" }} />
                  </div>
                  <h5 className="fw-bold text-dark mb-2">¡Registro recibido!</h5>
                  <p className="text-muted mb-4">
                    Te enviamos un correo a <strong>{form.email}</strong>. Haz clic en el enlace para <strong>verificar tu cuenta</strong>.
                  </p>
                  <div className="alert alert-info d-flex align-items-start gap-2 text-start mb-4" style={{ fontSize: "0.875rem" }}>
                    <i className="bi bi-lightbulb-fill mt-1 flex-shrink-0" />
                    <div>Si no encuentras el correo, revisa <strong>spam o promociones</strong>. El enlace expira en <strong>24 horas</strong>.</div>
                  </div>

                  {/* Opción agendar cita */}
                  <div className="card rounded-4 p-4 mb-3 text-start" style={{ border: "2px solid #0d6efd" }}>
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                        <i className="bi bi-calendar-plus-fill text-primary" style={{ fontSize: "1.4rem" }} />
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0">¿Deseas agendar una cita ahora?</h6>
                        <span className="text-muted" style={{ fontSize: "0.82rem" }}>Elige médico, fecha y horario — tarda menos de 1 minuto</span>
                      </div>
                    </div>
                    <button className="btn btn-primary w-100" onClick={() => { setError(""); setPaso(4); }}>
                      <i className="bi bi-calendar-plus me-2" />Sí, agendar mi cita
                    </button>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <button className="btn btn-link text-muted" style={{ fontSize: "0.875rem" }}
                      onClick={async () => {
                        try {
                          await axios.post(`${BASE}/registro/reenviar`, { email: form.email, clinica_id: clinicaId });
                          alert("Email reenviado correctamente");
                        } catch { /* ignorar */ }
                      }}>
                      <i className="bi bi-arrow-repeat me-1" />Reenviar verificación
                    </button>
                  </div>
                </div>
              )}

              {/* Nuevo · Paso 4: Agendar cita */}
              {paso === 4 && (
                <AgendarCita clinicaId={clinicaId} pacienteId={pacienteId} sessionToken={sessionToken} onDone={handleCitaConfirmada} />
              )}

              {/* Nuevo · Paso 5: Cita confirmada */}
              {paso === 5 && citaConf && (
                <CitaConfirmada citaConf={citaConf} email={pacienteInfo?.email || form.email} />
              )}

            </div>
          </div>
        )}

        {/* ═══ FLUJO B — SUBSECUENTE ══════════════════════ */}
        {tipo === "subsecuente" && (
          <div>
            <div className="text-center mb-4">
              <h3 className="fw-bold text-dark">Agendar cita</h3>
              <p className="text-muted">Paciente con expediente existente</p>
            </div>
            <div className="card shadow-sm border-0 rounded-4 p-4 p-md-5">
              <ProgressBarSub paso={paso} />

              {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 py-2">
                  <i className="bi bi-exclamation-triangle-fill" />{error}
                </div>
              )}

              {/* Sub · Paso 0: Verificar DNI */}
              {paso === 0 && (
                <div>
                  <div className="text-center mb-4">
                    <div className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: 64, height: 64 }}>
                      <i className="bi bi-person-badge-fill text-success" style={{ fontSize: "1.8rem" }} />
                    </div>
                    <h5 className="fw-bold mb-1">Verifica tu identidad</h5>
                    <p className="text-muted" style={{ fontSize: "0.875rem" }}>Ingresa tu número de DNI para encontrar tu expediente</p>
                  </div>
                  <form onSubmit={buscarPorDni}>
                    <div className="mb-4">
                      <label className="form-label fw-semibold">Número de DNI</label>
                      <input
                        className="form-control form-control-lg"
                        value={dniBuscar}
                        onChange={e => { setDniBuscar(e.target.value); setError(""); }}
                        required
                        placeholder="Ej. 0801-1990-01234"
                        autoFocus
                      />
                    </div>
                    <button className="btn btn-success w-100 py-2" disabled={buscandoDni}>
                      {buscandoDni
                        ? <><span className="spinner-border spinner-border-sm me-2" />Buscando...</>
                        : <><i className="bi bi-search me-2" />Verificar identidad</>}
                    </button>
                  </form>
                  <div className="text-center mt-4">
                    <span className="text-muted" style={{ fontSize: "0.875rem" }}>¿No tienes expediente? </span>
                    <button className="btn btn-link p-0 text-primary fw-semibold" style={{ fontSize: "0.875rem" }}
                      onClick={() => elegirTipo("nuevo")}>
                      Regístrate aquí
                    </button>
                  </div>
                </div>
              )}

              {/* Sub · Paso 1: Agendar cita */}
              {paso === 1 && pacienteInfo && (
                <div>
                  <div className="alert alert-success d-flex align-items-center gap-3 mb-4">
                    <i className="bi bi-person-check-fill fs-4 flex-shrink-0" />
                    <div>
                      <div className="fw-semibold">{pacienteInfo.nombres} {pacienteInfo.apellidos}</div>
                      <div style={{ fontSize: "0.85rem" }}>Identidad verificada — elige tu cita</div>
                    </div>
                  </div>
                  <AgendarCita clinicaId={clinicaId} pacienteId={pacienteId} sessionToken={sessionToken} onDone={handleCitaConfirmada} />
                </div>
              )}

              {/* Sub · Paso 2: Cita confirmada */}
              {paso === 2 && citaConf && (
                <CitaConfirmada citaConf={citaConf} email={pacienteInfo?.email} subsecuente pacienteId={pacienteId} clinicaId={clinicaId} sessionToken={sessionToken} />
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
