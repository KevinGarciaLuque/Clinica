import { useEffect, useState, useCallback } from "react";
import api from "../../api/api";
import { tituloMedicoActivo, nombreMedico } from "../../utils/medico";
import AusenciasMedico from "../../components/AusenciasMedico";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const SLOTS = [15, 20, 30, 45, 60];
const EMPTY = { medico_id: "", dia_semana: 0, hora_inicio: "08:00", hora_fin: "13:00", slot_minutos: 30 };

/** Convierte "HH:mm" o "HH:mm:ss" → "h:mm AM/PM" */
function to12h(time) {
  if (!time) return "";
  const [hh, mm] = time.split(":");
  const h24 = parseInt(hh, 10);
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${mm} ${ampm}`;
}

/** Normaliza "HH:mm:ss" → "HH:mm" para el TimePicker */
function toHHmm(time) {
  if (!time) return "";
  return String(time).slice(0, 5);
}

/** TimePicker 12h — recibe y emite "HH:mm" (24h) */
function TimePicker12h({ value, onChange, label, required }) {
  const parse = (v) => {
    if (!v) return { h: "", m: "00", ampm: "AM" };
    const [hh, mm] = v.split(":");
    const h24 = parseInt(hh, 10);
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    return { h: String(h12), m: mm || "00", ampm };
  };
  const { h, m, ampm } = parse(value);

  const emit = (nh, nm, na) => {
    if (!nh) return;
    let h24 = parseInt(nh, 10);
    if (na === "AM" && h24 === 12) h24 = 0;
    if (na === "PM" && h24 !== 12) h24 += 12;
    onChange(`${String(h24).padStart(2, "0")}:${nm}`);
  };

  const HORAS = ["1","2","3","4","5","6","7","8","9","10","11","12"];
  const MINS  = ["00","05","10","15","20","25","30","35","40","45","50","55"];

  return (
    <div>
      {label && <label className="form-label">{label}</label>}
      <div className="input-group">
        <select className="form-select" style={{ maxWidth: 70 }} value={h}
          onChange={e => emit(e.target.value, m, ampm)} required={required}>
          <option value="">--</option>
          {HORAS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 70 }} value={m}
          onChange={e => emit(h, e.target.value, ampm)}>
          {MINS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select className="form-select" style={{ maxWidth: 72 }} value={ampm}
          onChange={e => emit(h, m, e.target.value)}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {value && <small className="text-muted">{h}:{m} {ampm}</small>}
    </div>
  );
}

export default function Horarios() {
  const [medicos, setMedicos]       = useState([]);
  const [horarios, setHorarios]     = useState([]);
  const [medicoSel, setMedicoSel]   = useState("");
  const [form, setForm]             = useState(EMPTY);
  const [editandoId, setEditandoId] = useState(null);
  const [cargando, setCargando]     = useState(false);
  const [error, setError]           = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [vista, setVista]           = useState("semanal"); // "semanal" | "ausencias"

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const mRes = await api.get("/usuarios/medicos");
      setMedicos(mRes.data.data);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarHorarios = useCallback(async (medicoId) => {
    if (!medicoId) { setHorarios([]); return; }
    setCargando(true);
    try {
      const res = await api.get(`/horarios?medico_id=${medicoId}`);
      setHorarios(res.data.data);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => { cargarHorarios(medicoSel); }, [medicoSel, cargarHorarios]);

  const abrirNuevo = (diaIdx = 0) => {
    setEditandoId(null);
    setForm({ ...EMPTY, medico_id: medicoSel, dia_semana: diaIdx });
    setError("");
    setShowModal(true);
  };

  const abrirEditar = (e, bloque) => {
    e.stopPropagation();
    setEditandoId(bloque.id);
    setForm({
      medico_id: bloque.medico_id,
      dia_semana: Number(bloque.dia_semana),
      hora_inicio: toHHmm(bloque.hora_inicio),
      hora_fin: toHHmm(bloque.hora_fin),
      slot_minutos: bloque.slot_minutos,
    });
    setError("");
    setShowModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault(); setError("");
    try {
      if (editandoId) {
        await api.put(`/horarios/${editandoId}`, form);
      } else {
        await api.post("/horarios", form);
      }
      setShowModal(false);
      setEditandoId(null);
      cargarHorarios(medicoSel);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditandoId(null);
    setError("");
  };

  const eliminar = async (e, id) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar este bloque horario?")) return;
    try {
      await api.delete(`/horarios/${id}`);
      cargarHorarios(medicoSel);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const porDia = DIAS.map((dia, idx) => ({
    dia,
    idx,
    bloques: horarios.filter((h) => Number(h.dia_semana) === idx),
  }));

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-clock-fill" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Horarios de Médicos</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>
              Configura los bloques horarios por médico
            </div>
          </div>
        </div>
        {vista === "semanal" && (
          <button
            onClick={() => abrirNuevo()}
            disabled={!medicoSel}
            style={{
              background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)",
              borderRadius: 8, color: "#e2e8f0", padding: "6px 14px",
              fontSize: "0.8rem", cursor: medicoSel ? "pointer" : "not-allowed",
              fontWeight: 500, display: "flex", alignItems: "center", gap: 6,
              opacity: medicoSel ? 1 : 0.5,
            }}>
            <i className="bi bi-plus-lg"></i> Agregar bloque
          </button>
        )}
      </div>

      <div style={{ padding: "20px 24px" }}>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 16, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca",
          }}>
            <span><i className="bi bi-x-circle-fill me-2"></i>{error}</span>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}>×</button>
          </div>
        )}

        {/* Selector de médico */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: "20px 24px",
          boxShadow: "0 2px 8px rgba(0,0,0,.06)", marginBottom: 20,
        }}>
          <label style={{ fontWeight: 700, fontSize: "0.87rem", color: "#374151", display: "block", marginBottom: 8 }}>
            <i className="bi bi-person-badge-fill me-2" style={{ color: "#2563eb" }}></i>
            Seleccionar médico
          </label>
          <select
            value={medicoSel}
            onChange={(e) => setMedicoSel(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 8,
              border: "1px solid #e5e7eb", fontSize: "0.9rem",
              background: "#fff", color: "#111827", outline: "none",
            }}
          >
            <option value="">— Elige un médico —</option>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {nombreMedico(m)}{tituloMedicoActivo() ? ` — ${m.especialidad || "Sin especialidad"}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Pestañas */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          {[
            { k: "semanal",   label: "Horario semanal",     icon: "bi-calendar2-week" },
            { k: "ausencias", label: "Ausencias y permisos", icon: "bi-calendar-x" },
          ].map(t => {
            const on = vista === t.k;
            return (
              <button key={t.k} onClick={() => setVista(t.k)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  background: on ? "#2563eb" : "#fff", color: on ? "#fff" : "#475569",
                  border: `1px solid ${on ? "#2563eb" : "#e5e7eb"}`,
                  borderRadius: 10, padding: "8px 16px", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
                }}>
                <i className={`bi ${t.icon}`} />{t.label}
              </button>
            );
          })}
        </div>

        {/* ═══ AUSENCIAS ═══ */}
        {vista === "ausencias" && (
          <AusenciasMedico
            medicoId={medicoSel}
            medicoNombre={(() => { const m = medicos.find(x => String(x.id) === String(medicoSel)); return m ? nombreMedico(m) : ""; })()}
          />
        )}

        {/* ═══ HORARIO SEMANAL ═══ */}
        {vista === "semanal" && (cargando ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
            <div className="spinner-border text-primary" role="status" style={{ width: "1.5rem", height: "1.5rem" }}></div>
            <div style={{ marginTop: 10, fontSize: "0.85rem" }}>Cargando...</div>
          </div>
        ) : !medicoSel ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
            <i className="bi bi-calendar2-week" style={{ fontSize: "3rem", opacity: 0.3, display: "block", marginBottom: 12 }}></i>
            <p style={{ fontSize: "0.9rem", margin: 0 }}>Selecciona un médico para ver y configurar su horario.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {porDia.map(({ dia, idx, bloques }) => (
              <div
                key={idx}
                onClick={() => abrirNuevo(idx)}
                style={{
                  background: "#fff", borderRadius: 12, overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                  border: bloques.length ? "1px solid #bfdbfe" : "1px solid #e5e7eb",
                  cursor: "pointer", transition: "box-shadow .15s, transform .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(37,99,235,.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Card header */}
                <div style={{
                  background: bloques.length ? "linear-gradient(135deg, #1a2744 0%, #243b72 100%)" : "#f8fafc",
                  padding: "10px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: bloques.length ? "none" : "1px solid #e5e7eb",
                }}>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", color: bloques.length ? "#fff" : "#374151" }}>
                    {dia}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      background: bloques.length ? "rgba(255,255,255,.2)" : "#e5e7eb",
                      color: bloques.length ? "#e2e8f0" : "#6b7280",
                      borderRadius: 20, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700,
                    }}>
                      {bloques.length > 0 ? `${bloques.length} bloque${bloques.length > 1 ? "s" : ""}` : "Libre"}
                    </span>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: bloques.length ? "rgba(255,255,255,.2)" : "#2563eb",
                      color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1rem", fontWeight: 700,
                    }}>+</span>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: "10px 12px" }}>
                  {bloques.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "0.82rem", margin: "12px 0", padding: "8px 0" }}>
                      <i className="bi bi-plus-circle me-1"></i>Click para agregar horario
                    </p>
                  ) : (
                    bloques.map((b) => (
                      <div key={b.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: "#eff6ff", border: "1px solid #bfdbfe",
                        borderRadius: 8, padding: "8px 10px", marginBottom: 6,
                      }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e40af" }}>
                            {to12h(b.hora_inicio)} – {to12h(b.hora_fin)}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#6b7280", marginLeft: 8 }}>
                            ({b.slot_minutos} min/turno)
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button
                            onClick={(e) => abrirEditar(e, b)}
                            title="Editar"
                            style={{
                              background: "transparent", border: "1px solid #2563eb",
                              borderRadius: 6, color: "#2563eb",
                              padding: "2px 8px", fontSize: "0.78rem", cursor: "pointer",
                            }}>
                            <i className="bi bi-pencil-fill"></i>
                          </button>
                          <button
                            onClick={(e) => eliminar(e, b.id)}
                            title="Eliminar"
                            style={{
                              background: "transparent", border: "1px solid #ef4444",
                              borderRadius: 6, color: "#ef4444",
                              padding: "2px 8px", fontSize: "0.78rem", cursor: "pointer", fontWeight: 700,
                            }}>✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ═══ MODAL ═══ */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,.2)", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{
              background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
              padding: "14px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <i className={`bi ${editandoId ? "bi-pencil-fill" : "bi-clock-fill"}`} style={{ color: "#7dd3fc" }}></i>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>
                  {editandoId ? "Editar bloque horario" : "Nuevo bloque horario"}
                </span>
              </div>
              <button onClick={cerrarModal} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", padding: "2px 8px", fontSize: "1rem" }}>×</button>
            </div>
            {/* Modal body */}
            <form onSubmit={guardar}>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {error && (
                  <div style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", fontSize: "0.84rem" }}>
                    {error}
                  </div>
                )}
                <div>
                  <label style={{ fontWeight: 600, fontSize: "0.83rem", color: "#374151", display: "block", marginBottom: 6 }}>Médico</label>
                  <select
                    value={form.medico_id}
                    onChange={(e) => setForm({ ...form, medico_id: e.target.value })}
                    disabled={!!editandoId}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: "0.87rem", background: editandoId ? "#f9fafb" : "#fff" }}
                  >
                    <option value="">— Elige —</option>
                    {medicos.map((m) => (
                      <option key={m.id} value={m.id}>{nombreMedico(m)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: "0.83rem", color: "#374151", display: "block", marginBottom: 6 }}>Día de la semana</label>
                  <select
                    value={form.dia_semana}
                    onChange={(e) => setForm({ ...form, dia_semana: Number(e.target.value) })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: "0.87rem" }}
                  >
                    {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <TimePicker12h label="Hora inicio" value={form.hora_inicio}
                    onChange={(v) => setForm({ ...form, hora_inicio: v })} required />
                  <TimePicker12h label="Hora fin" value={form.hora_fin}
                    onChange={(v) => setForm({ ...form, hora_fin: v })} required />
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: "0.83rem", color: "#374151", display: "block", marginBottom: 6 }}>Duración de cada turno</label>
                  <select
                    value={form.slot_minutos}
                    onChange={(e) => setForm({ ...form, slot_minutos: Number(e.target.value) })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: "0.87rem" }}
                  >
                    {SLOTS.map((s) => <option key={s} value={s}>{s} minutos</option>)}
                  </select>
                </div>
              </div>
              {/* Modal footer */}
              <div style={{ padding: "12px 24px 20px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={cerrarModal} style={{
                  background: "transparent", border: "1px solid #d1d5db", borderRadius: 8,
                  padding: "8px 20px", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: "0.87rem",
                }}>Cancelar</button>
                <button type="submit" style={{
                  background: editandoId ? "#059669" : "#2563eb", border: "none", borderRadius: 8,
                  padding: "8px 22px", color: "#fff", fontWeight: 600, fontSize: "0.87rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                }}>
                  <i className={`bi ${editandoId ? "bi-check-circle-fill" : "bi-check-lg"}`}></i>
                  {editandoId ? "Guardar cambios" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
