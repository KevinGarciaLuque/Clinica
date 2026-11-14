import { useEffect, useState } from "react";
import dayjs from "dayjs";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";
import { nombreMedico } from "../utils/medico";

const TIPOS_CONSULTA_BASE = ["PRIMERA_VEZ", "CONTROL", "EMERGENCIA", "TELECONSULTA"];
const TIPOS_CONSULTA_ESTETICA = [
  "Consulta dermatológica primera vez", "Consulta dermatológica control",
  "Consulta estética", "Consulta pediátrica dermatológica",
  "Consulta de urgencia dermatológica", "Consulta online",
  "Revisión postprocedimiento", "Retiro de puntos",
  "Curación postquirúrgica", "Evaluación preláser", "Evaluación postláser",
];

function getTiposConsulta(tipoClave) {
  return (tipoClave === "estetica" || tipoClave === "dermatologia")
    ? TIPOS_CONSULTA_ESTETICA
    : TIPOS_CONSULTA_BASE;
}

/**
 * Ventana «Nueva Consulta» cuando el paciente no tiene cita hoy: se registra una cita
 * para ahora (y se abre la consulta) o se programa para otra fecha.
 * contexto / motivoInicial / tipoSugerido: opcionales (ej. desde la pestaña Estética).
 */
export default function ModalConsultaSinCita({ paciente, onClose, onCreated, psicologia = false, contexto = "", motivoInicial = "", tipoSugerido = "" }) {
  const { user } = useAuth();
  const [modo, setModo]           = useState(null);
  const [medicos, setMedicos]     = useState([]);
  const [medicoId, setMedicoId]   = useState("");
  const [fechaSel, setFechaSel]   = useState(dayjs().format("YYYY-MM-DD"));
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin]     = useState("");
  const [slots, setSlots]         = useState([]);
  const [slotSel, setSlotSel]     = useState("");
  // tipoSugerido puede ser una lista: se usa el primero que exista en los tipos de la clínica
  const candidatos = [].concat(tipoSugerido || []);
  const [tipo, setTipo]           = useState(candidatos[0] || "PRIMERA_VEZ");
  const [motivo, setMotivo]       = useState(motivoInicial);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [tipoClinica, setTipoClinica] = useState("");
  const [tiposCita, setTiposCita] = useState([]);
  const tiposConsulta = tiposCita.length > 0 ? tiposCita.map(t => t.nombre) : getTiposConsulta(tipoClinica);

  useEffect(() => {
    api.get("/usuarios/medicos")
      .then(r => {
        const lista = r.data.data || [];
        setMedicos(lista);
        // Si quien abre la ventana es uno de los médicos, ya queda elegido
        const yo = lista.find(m => String(m.id) === String(user?.id ?? user?.uid));
        if (yo) setMedicoId(curr => curr || String(yo.id));
        else if (lista.length === 1) setMedicoId(curr => curr || String(lista[0].id));
      })
      .catch(() => {});
  }, [user?.id, user?.uid]);

  useEffect(() => {
    api.get("/clinicas")
      .then(r => {
        const lista = r.data.data || [];
        const clinica = Array.isArray(lista) ? lista[0] : null;
        setTipoClinica(clinica?.tipo_clave || "");
      })
      .catch(() => {});

    api.get("/catalogos-tipos-cita")
      .then(r => setTiposCita(r.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!tiposConsulta.includes(tipo)) {
      setTipo(candidatos.find(c => tiposConsulta.includes(c)) || tiposConsulta[0] || "PRIMERA_VEZ");
    }
  }, [tiposConsulta, tipo]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (psicologia) {
      // Crear cita automáticamente con el usuario logueado como psicólogo
      setSaving(true); setErr("");
      try {
        const inicio = dayjs().format("YYYY-MM-DD HH:mm:ss");
        const fin = dayjs().add(50, "minute").format("YYYY-MM-DD HH:mm:ss");
        const res = await api.post("/citas", {
          paciente_id: paciente.id,
          medico_id: user.id,
          inicio, fin,
          tipo_consulta: "PSICOLOGIA",
          motivo: "Sesión psicológica",
          canal: "RECEPCION",
        });
        await api.patch(`/citas/${res.data.id}/estado`, { estado: "EN_ATENCION" });
        onCreated(res.data.id, false); // false = "ahora", abrir sesión
      } catch (ex) {
        setErr(ex.response?.data?.msg || "Error al crear la sesión");
      } finally {
        setSaving(false);
      }
      return;
    }
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
      onCreated(res.data.id, false);
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  const agendarSeleccionado = async () => {
    if (!medicoId) { setErr(`Selecciona un${psicologia ? " psicólogo/a" : " médico"}`); return; }
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
      onCreated(res.data.id, true); // true = solo programar
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  const color = psicologia ? "#673ab7" : "#0d6efd";
  const iniciales = `${(paciente.nombres || "?")[0] || ""}${(paciente.apellidos || "")[0] || ""}`.toUpperCase();
  const nombreTipo = (t) => String(t).replace(/_/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase());
  const lbl = { fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: 4, display: "block" };
  const chip = (activo) => ({
    borderRadius: 999, padding: "5px 12px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
    border: `1px solid ${activo ? color : "#cbd5e1"}`, background: activo ? color : "#fff", color: activo ? "#fff" : "#334155",
  });
  const camposComunes = (
    <>
      <div className="mb-3">
        <label style={lbl}>{psicologia ? "Psicólogo/a" : "Médico"}</label>
        <select className="form-select" value={medicoId} onChange={e => setMedicoId(e.target.value)}>
          <option value="">— Selecciona —</option>
          {medicos.map(m => (
            <option key={m.id} value={m.id}>{nombreMedico(m, { conEspecialidad: true, titulo: !psicologia })}</option>
          ))}
        </select>
      </div>
      {!psicologia && (
        <div className="mb-3">
          <label style={lbl}>Tipo de consulta</label>
          {tiposConsulta.length <= 6 ? (
            <div className="d-flex flex-wrap gap-1">
              {tiposConsulta.map(t => <button key={t} type="button" style={chip(tipo === t)} onClick={() => setTipo(t)}>{nombreTipo(t)}</button>)}
            </div>
          ) : (
            <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
              {tiposConsulta.map(t => <option key={t} value={t}>{nombreTipo(t)}</option>)}
            </select>
          )}
        </div>
      )}
      <div className="mb-1">
        <label style={lbl}>Motivo <span className="text-muted fw-normal">(opcional)</span></label>
        <input className="form-control" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej.: control, dolor, revisión…" />
      </div>
    </>
  );

  return (
    <div className="modal show d-block" style={{ background: "rgba(15,23,42,.55)", zIndex: 9998 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: modo === "seleccionar" ? 580 : 500, margin: "12px auto", padding: "0 10px" }} onClick={e => e.stopPropagation()}>
        <div className="modal-content" style={{ borderRadius: 18, overflow: "hidden", border: "none", boxShadow: "0 24px 60px rgba(15,23,42,.35)" }}>
          {/* Encabezado con el paciente */}
          <div style={{ background: `linear-gradient(135deg, ${color}, ${psicologia ? "#9575cd" : "#3b82f6"})`, color: "#fff", padding: "16px 18px" }}>
            <div className="d-flex align-items-center gap-2">
              <i className={`bi ${psicologia ? "bi-activity" : "bi-clipboard2-pulse"}`} style={{ fontSize: "1.2rem" }} />
              <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>{psicologia ? "Nueva sesión psicológica" : "Nueva consulta"}</span>
              <button type="button" className="btn-close btn-close-white ms-auto" aria-label="Cerrar" onClick={onClose} />
            </div>
            <div className="d-flex align-items-center gap-2 mt-3">
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{iniciales}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{paciente.nombres} {paciente.apellidos}</div>
                <div style={{ fontSize: "0.8rem", opacity: 0.9 }}>
                  <i className="bi bi-calendar-x me-1" />No tiene {psicologia ? "sesión" : "cita"} para hoy
                  {contexto && <span style={{ marginLeft: 8, background: "rgba(255,255,255,.22)", borderRadius: 999, padding: "1px 8px", fontWeight: 700 }}>{contexto}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-body" style={{ padding: 18 }}>
            {err && <div className="alert alert-danger py-2 mb-3"><i className="bi bi-exclamation-circle me-2" />{err}</div>}

            {!modo && (
              <>
                <div className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>Para que la atención quede registrada en la agenda, elija una opción:</div>
                <div className="d-grid gap-2">
                  {[
                    { k: "ahora", icono: "bi-lightning-charge-fill", c: "#16a34a", t: psicologia ? "Iniciar sesión ahora" : "Atender ahora", d: `Se registra la cita de hoy a las ${dayjs().format("h:mm A")} y se abre la ${psicologia ? "sesión" : "consulta"}.` },
                    { k: "seleccionar", icono: "bi-calendar-plus", c: color, t: "Programar para otro momento", d: "Elija fecha y hora; queda en la agenda." },
                  ].map(o => (
                    <button key={o.k} type="button" disabled={saving}
                      onClick={() => (o.k === "ahora" && psicologia ? agendarAhora() : setModo(o.k))}
                      className="d-flex align-items-center gap-3 text-start w-100"
                      style={{ border: `1.5px solid ${o.c}33`, background: `${o.c}0a`, borderRadius: 14, padding: "14px 14px", cursor: "pointer" }}>
                      <span style={{ width: 44, height: 44, borderRadius: 12, background: o.c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", flexShrink: 0 }}>
                        {saving && o.k === "ahora" ? <span className="spinner-border spinner-border-sm" /> : <i className={`bi ${o.icono}`} />}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 800, color: "#0f172a" }}>{o.t}</span>
                        <span style={{ display: "block", fontSize: "0.8rem", color: "#64748b" }}>{o.d}</span>
                      </span>
                      <i className="bi bi-chevron-right ms-auto" style={{ color: "#94a3b8" }} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {modo === "ahora" && !psicologia && (
              <div>
                <div className="d-flex align-items-center gap-2 mb-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 10, padding: "8px 12px", fontSize: "0.85rem" }}>
                  <i className="bi bi-clock-fill" />Cita de hoy a las <strong>{dayjs().format("h:mm A")}</strong> · 30 minutos
                </div>
                {camposComunes}
              </div>
            )}

            {modo === "seleccionar" && (
              <div>
                <div className="mb-3">
                  <label style={lbl}>Fecha</label>
                  <input type="date" className="form-control" value={fechaSel} min={dayjs().format("YYYY-MM-DD")}
                    onChange={e => { setFechaSel(e.target.value); setSlotSel(""); }} />
                </div>
                {camposComunes}
                <div className="mt-3">
                  {slots.length > 0 && (
                    <div className="mb-2">
                      <label style={lbl}>Horarios disponibles</label>
                      <div className="d-flex flex-wrap gap-1">
                        {slots.map(s => (
                          <button key={s.inicio} type="button" style={chip(slotSel === s.inicio)} onClick={() => selSlot(s)}>
                            {dayjs(s.inicio).format("h:mm A")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {medicoId && fechaSel && slots.length === 0 && (
                    <small className="text-muted d-block mb-2">No hay horarios libres en la agenda: escriba la hora.</small>
                  )}
                  <div className="row g-2">
                    <div className="col-6">
                      <label style={lbl}>Desde</label>
                      <input type="time" className="form-control" value={horaInicio} onChange={e => { setHoraInicio(e.target.value); setSlotSel(""); }} />
                    </div>
                    <div className="col-6">
                      <label style={lbl}>Hasta</label>
                      <input type="time" className="form-control" value={horaFin} onChange={e => { setHoraFin(e.target.value); setSlotSel(""); }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ borderTop: "1px solid #f1f5f9", padding: "12px 18px", gap: 8 }}>
            {modo ? (
              <>
                <button className="btn btn-light me-auto" onClick={() => { setModo(null); setErr(""); }}>
                  <i className="bi bi-arrow-left me-1" />Volver
                </button>
                <button className="btn fw-bold px-4" disabled={saving}
                  style={{ background: modo === "ahora" ? "#16a34a" : color, color: "#fff", borderRadius: 10 }}
                  onClick={modo === "ahora" ? agendarAhora : agendarSeleccionado}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-2" />Creando…</>
                    : modo === "ahora" ? <><i className="bi bi-play-fill me-1" />Iniciar consulta</> : <><i className="bi bi-calendar-check me-1" />Agendar cita</>}
                </button>
              </>
            ) : (
              <button className="btn btn-light" onClick={onClose}>Cancelar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
