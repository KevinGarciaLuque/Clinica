import { useEffect, useState } from "react";
import dayjs from "dayjs";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

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

export default function ModalConsultaSinCita({ paciente, onClose, onCreated, psicologia = false }) {
  const { user } = useAuth();
  const [modo, setModo]           = useState(null);
  const [medicos, setMedicos]     = useState([]);
  const [medicoId, setMedicoId]   = useState("");
  const [fechaSel, setFechaSel]   = useState(dayjs().format("YYYY-MM-DD"));
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin]     = useState("");
  const [slots, setSlots]         = useState([]);
  const [slotSel, setSlotSel]     = useState("");
  const [tipo, setTipo]           = useState("PRIMERA_VEZ");
  const [motivo, setMotivo]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");
  const [tipoClinica, setTipoClinica] = useState("");
  const [tiposCita, setTiposCita] = useState([]);
  const tiposConsulta = tiposCita.length > 0 ? tiposCita.map(t => t.nombre) : getTiposConsulta(tipoClinica);

  useEffect(() => {
    api.get("/usuarios/medicos")
      .then(r => setMedicos(r.data.data || []))
      .catch(() => {});
  }, []);

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
      setTipo(tiposConsulta[0] || "PRIMERA_VEZ");
    }
  }, [tiposConsulta, tipo]);

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

  const headerColor = psicologia ? "#673ab7" : "#0d6efd";

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 9998 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: modo === "seleccionar" ? 600 : 500 }}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: headerColor, color: "#fff" }}>
            <h5 className="modal-title">
              <i className={`bi ${psicologia ? "bi-activity" : "bi-clipboard2-pulse"} me-2`}></i>
              {psicologia ? "Nueva Sesión Psicológica" : "Nueva Consulta"}
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="alert alert-warning py-2 mb-3">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>{paciente.nombres} {paciente.apellidos}</strong> no tiene {psicologia ? "sesión" : "consulta"} agendada para hoy.
            </div>

            {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}

            {!modo && (
              <div className="text-center py-2">
                <p className="mb-3">¿Desea {psicologia ? "iniciar una sesión" : "agendar una consulta"}?</p>
                <div className="d-flex justify-content-center gap-3">
                  <button className="btn btn-success px-4" onClick={() => psicologia ? agendarAhora() : setModo("ahora")}>
                    <i className="bi bi-clock-fill me-2"></i>Ahora
                  </button>
                  <button className="btn btn-primary px-4" onClick={() => setModo("seleccionar")}>
                    <i className="bi bi-calendar-event me-2"></i>Programar
                  </button>
                </div>
              </div>
            )}

            {modo === "ahora" && !psicologia && (
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
                      {tiposConsulta.map(t => <option key={t}>{t}</option>)}
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
                  <label className="form-label fw-semibold">{psicologia ? "Psicólogo/a" : "Médico"}</label>
                  <select className="form-select" value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>{psicologia ? "" : "Dr. "}{m.nombres} {m.apellidos}{m.especialidad ? ` – ${m.especialidad}` : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Fecha</label>
                  <input type="date" className="form-control" value={fechaSel}
                    onChange={e => setFechaSel(e.target.value)} />
                </div>
                {slots.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Horarios disponibles</label>
                    <div className="d-flex flex-wrap gap-1">
                      {slots.map(s => (
                        <button key={s.inicio} type="button"
                          className={`btn btn-sm ${slotSel === s.inicio ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => selSlot(s)}>
                          {dayjs(s.inicio).format("h:mm A")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {medicoId && fechaSel && slots.length === 0 && (
                  <small className="text-muted d-block mb-2">Sin horarios disponibles. Ingresa hora manualmente.</small>
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
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                      {tiposConsulta.map(t => <option key={t}>{t}</option>)}
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
              <button className="btn btn-outline-secondary" onClick={() => { setModo(null); setErr(""); }}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button
                className={`btn ${modo === "ahora" ? "btn-success" : "btn-primary"}`}
                disabled={saving}
                onClick={modo === "ahora" ? agendarAhora : agendarSeleccionado}>
                {saving ? "Creando…" : modo === "ahora" ? "Agendar y Consultar" : "Agendar Cita"}
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
