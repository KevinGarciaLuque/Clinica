import { useEffect, useState, useCallback } from "react";
import api from "../../api/api";

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
  const [cargando, setCargando]     = useState(false);
  const [error, setError]           = useState("");
  const [showModal, setShowModal]   = useState(false);

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
    setForm({ ...EMPTY, medico_id: medicoSel, dia_semana: diaIdx });
    setError("");
    setShowModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault(); setError("");
    try {
      await api.post("/horarios", form);
      setShowModal(false);
      cargarHorarios(medicoSel);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este bloque horario?")) return;
    try {
      await api.delete(`/horarios/${id}`);
      cargarHorarios(medicoSel);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  // Agrupar horarios por día
  const porDia = DIAS.map((dia, idx) => ({
    dia,
    idx,
    bloques: horarios.filter((h) => h.dia_semana === idx),
  }));

  return (
    <div>
      <style>{`
        .dia-card:hover {
          box-shadow: 0 4px 16px rgba(33,150,243,0.18) !important;
          transform: translateY(-2px);
        }
      `}</style>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Horarios de Médicos</h4>
        <button className="btn btn-primary btn-sm" onClick={abrirNuevo} disabled={!medicoSel}>
          + Agregar bloque
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {/* Selector de médico */}
      <div className="card mb-4">
        <div className="card-body">
          <label className="form-label fw-semibold">Seleccionar médico</label>
          <select className="form-select" value={medicoSel}
            onChange={(e) => setMedicoSel(e.target.value)}>
            <option value="">— Elige un médico —</option>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                Dr(a). {m.apellidos}, {m.nombres} — {m.especialidad || "Sin especialidad"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {cargando ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : medicoSel ? (
        <div className="row g-3">
          {porDia.map(({ dia, idx, bloques }) => (
            <div key={idx} className="col-md-6 col-lg-4">
              <div
                className={`card h-100 dia-card ${bloques.length ? "border-primary" : "border"}`}
                onClick={() => abrirNuevo(idx)}
                style={{ cursor: "pointer", transition: "box-shadow 0.18s, transform 0.18s" }}
              >
                <div className={`card-header d-flex justify-content-between align-items-center ${bloques.length ? "bg-primary text-white" : "bg-light"}`}>
                  <span className="fw-semibold">{dia}</span>
                  <div className="d-flex align-items-center gap-2">
                    <span className={`badge ${bloques.length ? "bg-white text-primary" : "bg-secondary bg-opacity-25 text-secondary"}`}>
                      {bloques.length > 0 ? `${bloques.length} bloque${bloques.length > 1 ? "s" : ""}` : "Libre"}
                    </span>
                    <span
                      className={`badge rounded-circle d-flex align-items-center justify-content-center ${bloques.length ? "bg-white text-primary" : "bg-primary text-white"}`}
                      style={{ width: 22, height: 22, fontSize: "1rem", lineHeight: 1 }}
                      title="Agregar bloque"
                    >+</span>
                  </div>
                </div>
                <div className="card-body p-2">
                  {bloques.length === 0 ? (
                    <p className="text-muted small mb-0 text-center py-3">
                      <i className="bi bi-plus-circle me-1"></i>Click para agregar horario
                    </p>
                  ) : (
                    bloques.map((b) => (
                      <div key={b.id} className="d-flex justify-content-between align-items-center border rounded p-2 mb-1">
                        <div>
                          <span className="fw-semibold">{to12h(b.hora_inicio)} - {to12h(b.hora_fin)}</span>
                          <span className="text-muted small ms-2">({b.slot_minutos} min/turno)</span>
                        </div>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={(e) => { e.stopPropagation(); eliminar(b.id); }}
                        >✕</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted py-5">
          <p>Selecciona un médico para ver y configurar su horario.</p>
        </div>
      )}

      {showModal && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Nuevo bloque horario</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2">{error}</div>}
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Médico</label>
                      <select className="form-select" value={form.medico_id}
                        onChange={(e) => setForm({ ...form, medico_id: e.target.value })}>
                        <option value="">— Elige —</option>
                        {medicos.map((m) => (
                          <option key={m.id} value={m.id}>Dr(a). {m.apellidos}, {m.nombres}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Día de la semana</label>
                      <select className="form-select" value={form.dia_semana}
                        onChange={(e) => setForm({ ...form, dia_semana: Number(e.target.value) })}>
                        {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <TimePicker12h label="Hora inicio" value={form.hora_inicio}
                        onChange={(v) => setForm({ ...form, hora_inicio: v })} required />
                    </div>
                    <div className="col-md-6">
                      <TimePicker12h label="Hora fin" value={form.hora_fin}
                        onChange={(v) => setForm({ ...form, hora_fin: v })} required />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Duración de cada turno</label>
                      <select className="form-select" value={form.slot_minutos}
                        onChange={(e) => setForm({ ...form, slot_minutos: Number(e.target.value) })}>
                        {SLOTS.map((s) => <option key={s} value={s}>{s} minutos</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
