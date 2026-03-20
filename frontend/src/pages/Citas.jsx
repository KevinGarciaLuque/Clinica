import { useState, useEffect, useCallback } from "react";
import { Calendar, dayjsLocalizer, Views } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import api from "../api/api";

dayjs.locale("es");
const localizer = dayjsLocalizer(dayjs);
const DnDCalendar = withDragAndDrop(Calendar);

// ─── colores por estado ───────────────────────────────────────────────────────
const ESTADO_COLOR = {
  PENDIENTE:    { bg: "#ffc107", fg: "#000" },
  CONFIRMADA:   { bg: "#0d6efd", fg: "#fff" },
  EN_ESPERA:    { bg: "#6610f2", fg: "#fff" },
  EN_ATENCION:  { bg: "#198754", fg: "#fff" },
  COMPLETADA:   { bg: "#6c757d", fg: "#fff" },
  CANCELADA:    { bg: "#dc3545", fg: "#fff" },
  NO_ASISTIO:   { bg: "#fd7e14", fg: "#fff" },
};

const ESTADOS = Object.keys(ESTADO_COLOR);

const MESSAGES = {
  today: "Hoy", previous: "Anterior", next: "Siguiente",
  month: "Mes", week: "Semana", day: "Día", agenda: "Agenda",
  date: "Fecha", time: "Hora", event: "Cita",
  noEventsInRange: "Sin citas en este rango.",
};

const FORMATS = {
  timeGutterFormat: (date, culture, localizer) => localizer.format(date, "h A", culture),
  eventTimeRangeFormat: ({ start, end }, culture, localizer) => 
    `${localizer.format(start, "h:mm A", culture)} – ${localizer.format(end, "h:mm A", culture)}`,
  agendaTimeRangeFormat: ({ start, end }, culture, localizer) => 
    `${localizer.format(start, "h:mm A", culture)} – ${localizer.format(end, "h:mm A", culture)}`,
  dayHeaderFormat: (date, culture, localizer) => localizer.format(date, "dddd D [de] MMM", culture),
};

function buildEvents(citas) {
  return citas.map(c => ({
    id: c.id,
    title: `${c.paciente_apellidos}, ${c.paciente_nombres}`,
    start: new Date(c.inicio),
    end:   new Date(c.fin),
    resource: c,
  }));
}

function eventPropGetter(event) {
  const col = ESTADO_COLOR[event.resource?.estado] || { bg: "#0d6efd", fg: "#fff" };
  return { 
    style: { 
      backgroundColor: col.bg, 
      color: col.fg, 
      borderRadius: "4px", 
      border: "none", 
      fontSize: "0.78rem",
      cursor: "pointer",
      transition: "all 0.2s ease"
    },
    className: "event-hover" 
  };
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function Citas() {
  const [activeTab, setActiveTab]   = useState("calendario");
  const [events,    setEvents]      = useState([]);
  const [medicos,   setMedicos]     = useState([]);
  const [filterMed, setFilterMed]   = useState("");
  const [view,      setView]        = useState(Views.WEEK);
  const [date,      setDate]        = useState(new Date());
  const [loading,   setLoading]     = useState(false);
  const [showNew,   setShowNew]     = useState(false);
  const [slotInfo,  setSlotInfo]    = useState(null);
  const [showDet,   setShowDet]     = useState(false);
  const [selEvent,  setSelEvent]    = useState(null);
  const [sala,      setSala]        = useState([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    api.get("/usuarios/medicos")
      .then(r => setMedicos(r.data.data || []))
      .catch(() => {});
  }, []);

  const loadCitas = useCallback(({ start, end } = {}) => {
    setLoading(true);
    const desde = dayjs(start || dayjs(date).startOf("month")).format("YYYY-MM-DD");
    const hasta = dayjs(end   || dayjs(date).endOf("month")).format("YYYY-MM-DD");
    const params = { desde, hasta };
    if (filterMed) params.medico_id = filterMed;
    api.get("/citas", { params })
      .then(r => setEvents(buildEvents(r.data.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date, filterMed]);

  useEffect(() => { loadCitas(); }, [loadCitas]);

  const loadSalaEspera = useCallback(() => {
    api.get("/dashboard/sala-espera")
      .then(r => setSala(r.data.data || []))
      .catch(() => setSala([]));
  }, []);

  useEffect(() => {
    if (activeTab === "sala") {
      loadSalaEspera();
    }
  }, [activeTab, loadSalaEspera]);

  const onEventDrop = ({ event, start, end }) => {
    api.put(`/citas/${event.id}`, {
      inicio: dayjs(start).format("YYYY-MM-DD HH:mm:ss"),
      fin:    dayjs(end).format("YYYY-MM-DD HH:mm:ss"),
    })
    .then(() => setEvents(prev => prev.map(e => e.id === event.id ? { ...e, start, end } : e)))
    .catch(err => alert(err.response?.data?.msg || "Error al reprogramar"));
  };

  const onEventResize = ({ event, start, end }) => onEventDrop({ event, start, end });

  const onSelectSlot = (slot) => {
    setSlotInfo({ inicio: slot.start, fin: slot.end });
    setShowNew(true);
  };

  const onSelectEvent = (event) => {
    setSelEvent(event);
    setShowDet(true);
  };

  const cambiarEstado = (estado) => {
    api.patch(`/citas/${selEvent.id}/estado`, { estado })
      .then(() => {
        setEvents(prev => prev.map(e =>
          e.id === selEvent.id ? { ...e, resource: { ...e.resource, estado } } : e
        ));
        setSelEvent(s => ({ ...s, resource: { ...s.resource, estado } }));
        // Recargar sala de espera si estamos en esa tab
        loadSalaEspera();
      })
      .catch(err => alert(err.response?.data?.msg || "Error"));
  };

  const cancelarCita = () => {
    if (!confirm("¿Cancelar esta cita?")) return;
    api.delete(`/citas/${selEvent.id}`)
      .then(() => { 
        setEvents(prev => prev.filter(e => e.id !== selEvent.id)); 
        setShowDet(false);
        // Recargar sala de espera si estamos en esa tab
        loadSalaEspera();
      })
      .catch(err => alert(err.response?.data?.msg || "Error"));
  };

  const eliminarPermanente = () => {
    api.delete(`/citas/${selEvent.id}/permanente`)
      .then(() => { 
        setEvents(prev => prev.filter(e => e.id !== selEvent.id)); 
        setShowDet(false);
        setShowConfirmDelete(false);
        // Recargar sala de espera si estamos en esa tab
        loadSalaEspera();
      })
      .catch(err => alert(err.response?.data?.msg || "Error al eliminar"));
  };

  return (
    <div className="container-fluid py-3">
      <style>{`
        .event-hover:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          opacity: 0.95;
        }
        
        /* Hover en celdas del calendario */
        .rbc-time-slot:hover {
          background-color: rgba(13, 110, 253, 0.08) !important;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .rbc-day-slot:hover .rbc-time-slot {
          background-color: rgba(13, 110, 253, 0.05) !important;
        }
        
        .rbc-time-slot:hover::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 1px dashed rgba(13, 110, 253, 0.3);
          pointer-events: none;
        }
        
        /* Hover en vista de mes */
        .rbc-month-view .rbc-day-bg:hover {
          background-color: rgba(13, 110, 253, 0.05) !important;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .rbc-month-view .rbc-date-cell:hover {
          background-color: rgba(13, 110, 253, 0.1) !important;
          border-radius: 4px;
        }
      `}</style>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="mb-0 fw-bold">Agenda de Citas</h4>
        <button className="btn btn-primary btn-sm" onClick={() => { setSlotInfo(null); setShowNew(true); }}>
          + Nueva Cita
        </button>
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === "calendario" ? "active" : ""}`}
            onClick={() => setActiveTab("calendario")}>Calendario</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === "sala" ? "active" : ""}`}
            onClick={() => setActiveTab("sala")}>Sala de Espera</button>
        </li>
      </ul>

      {activeTab === "calendario" && (
        <>
          <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
            <select className="form-select form-select-sm" style={{ maxWidth: 240 }}
              value={filterMed} onChange={e => setFilterMed(e.target.value)}>
              <option value="">— Todos los médicos —</option>
              {medicos.map(m => (
                <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
              ))}
            </select>
            <div className="d-flex gap-1 flex-wrap ms-auto">
              {ESTADOS.map(est => (
                <span key={est} className="badge"
                  style={{ background: ESTADO_COLOR[est].bg, color: ESTADO_COLOR[est].fg, fontSize: "0.7rem" }}>
                  {est}
                </span>
              ))}
            </div>
          </div>
          {loading && <div className="text-muted small mb-2">Cargando citas…</div>}
          <div style={{ height: "calc(100vh - 270px)", minHeight: 500 }}>
            <DnDCalendar
              localizer={localizer}
              events={events}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              onRangeChange={range => {
                if (Array.isArray(range)) loadCitas({ start: range[0], end: range[range.length - 1] });
                else loadCitas({ start: range.start, end: range.end });
              }}
              selectable
              resizable
              onSelectSlot={onSelectSlot}
              onSelectEvent={onSelectEvent}
              onEventDrop={onEventDrop}
              onEventResize={onEventResize}
              eventPropGetter={eventPropGetter}
              messages={MESSAGES}
              formats={FORMATS}
              culture="es"
              step={15}
              timeslots={4}
              defaultView={Views.WEEK}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            />
          </div>
        </>
      )}

      {activeTab === "sala" && (
        <SalaEspera 
          sala={sala} 
          onEstadoChange={(id, estado) => {
            api.patch(`/citas/${id}/estado`, { estado })
              .then(() => {
                // Recargar para actualizar la lista en tiempo real
                loadSalaEspera();
              })
              .catch(err => alert(err.response?.data?.msg || "Error"));
          }}
        />
      )}

      {showNew && (
        <ModalNuevaCita
          slotInfo={slotInfo}
          medicos={medicos}
          onClose={() => setShowNew(false)}
          onCreated={() => { 
            setShowNew(false); 
            loadCitas();
            loadSalaEspera();
          }}
        />
      )}

      {showDet && selEvent && (
        <ModalDetalle
          event={selEvent}
          onClose={() => setShowDet(false)}
          onEstado={cambiarEstado}
          onCancelar={cancelarCita}
          onMostrarConfirmDelete={() => setShowConfirmDelete(true)}
        />
      )}

      {showConfirmDelete && selEvent && (
        <ModalConfirmDelete
          onConfirm={eliminarPermanente}
          onCancel={() => setShowConfirmDelete(false)}
          pacienteNombre={`${selEvent.resource.paciente_apellidos}, ${selEvent.resource.paciente_nombres}`}
          fecha={dayjs(selEvent.resource.inicio).format("DD/MM/YYYY h:mm A")}
        />
      )}
    </div>
  );
}

// ─── Sala de Espera ───────────────────────────────────────────────────────────
function SalaEspera({ sala, onEstadoChange }) {
  const FLUJO = ["EN_ESPERA", "EN_ATENCION", "COMPLETADA"];
  return (
    <div>
      <h6 className="text-muted mb-3">Citas de hoy — {dayjs().format("dddd D [de] MMMM")}</h6>
      {sala.length === 0 && <p className="text-muted">No hay citas para hoy.</p>}
      {sala.length > 0 && (
        <div className="alert alert-info py-2 mb-3">
          <small>
            <i className="bi bi-info-circle me-1"></i>
            Se muestran todas las citas de hoy excepto las CANCELADAS y NO_ASISTIÓ
          </small>
        </div>
      )}
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>#</th><th>Paciente</th><th>Médico</th><th>Hora</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sala.map((c, i) => (
              <tr key={c.id}>
                <td className="text-muted">{i + 1}</td>
                <td>{c.paciente_apellidos}, {c.paciente_nombres}<br/>
                  <small className="text-muted">{c.paciente_tel}</small></td>
                <td>Dr. {c.medico_apellidos}<br/>
                  <small className="text-muted">{c.especialidad}</small></td>
                <td className="text-nowrap">{dayjs(c.inicio).format("h:mm A")} – {dayjs(c.fin).format("h:mm A")}</td>
                <td>
                  <span className="badge"
                    style={{ background: ESTADO_COLOR[c.estado]?.bg, color: ESTADO_COLOR[c.estado]?.fg }}>
                    {c.estado}
                  </span>
                </td>
                <td>
                  {FLUJO.filter(e => e !== c.estado).map(e => (
                    <button key={e} className="btn btn-outline-secondary btn-sm me-1"
                      style={{ fontSize: "0.7rem" }} onClick={() => onEstadoChange(c.id, e)}>
                      → {e.replace("_", " ")}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Modal Nueva Cita ─────────────────────────────────────────────────────────
function ModalNuevaCita({ slotInfo, medicos, onClose, onCreated }) {
  const [form, setForm] = useState({
    paciente_id: "", medico_id: "", inicio: "", fin: "",
    tipo_consulta: "PRIMERA_VEZ", motivo: "", canal: "RECEPCION",
  });
  const [pacBusq,  setPacBusq]  = useState("");
  const [pacList,  setPacList]  = useState([]);
  const [pacSel,   setPacSel]   = useState(null);
  const [slots,    setSlots]    = useState([]);
  const [slotSel,  setSlotSel]  = useState("");
  const [fechaSel, setFechaSel] = useState(slotInfo ? dayjs(slotInfo.inicio).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"));
  const [horaInicio, setHoraInicio] = useState(slotInfo ? dayjs(slotInfo.inicio).format("HH:mm") : "");
  const [horaFin,    setHoraFin]    = useState(slotInfo ? dayjs(slotInfo.fin).format("HH:mm") : "");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  useEffect(() => {
    if (slotInfo) {
      const inicio = dayjs(slotInfo.inicio);
      const fin = dayjs(slotInfo.fin);
      setHoraInicio(inicio.format("HH:mm"));
      setHoraFin(fin.format("HH:mm"));
      setForm(f => ({
        ...f,
        inicio: inicio.format("YYYY-MM-DD HH:mm:ss"),
        fin:    fin.format("YYYY-MM-DD HH:mm:ss"),
      }));
    }
  }, [slotInfo]);

  // Actualizar form cuando cambian fecha/hora manualmente
  useEffect(() => {
    if (fechaSel && horaInicio && horaFin) {
      setForm(f => ({
        ...f,
        inicio: `${fechaSel} ${horaInicio}:00`,
        fin:    `${fechaSel} ${horaFin}:00`,
      }));
    }
  }, [fechaSel, horaInicio, horaFin]);

  useEffect(() => {
    if (pacBusq.length < 2) { setPacList([]); return; }
    const t = setTimeout(() => {
      api.get("/pacientes", { params: { q: pacBusq } })
        .then(r => setPacList(r.data.data || []))
        .catch(() => setPacList([]));
    }, 300);
    return () => clearTimeout(t);
  }, [pacBusq]);

  useEffect(() => {
    if (!form.medico_id || !fechaSel) { setSlots([]); return; }
    api.get("/citas/slots", { params: { medico_id: form.medico_id, fecha: fechaSel } })
      .then(r => setSlots(r.data.data || []))
      .catch(() => setSlots([]));
  }, [form.medico_id, fechaSel]);

  const selPaciente = (p) => {
    setPacSel(p);
    setPacBusq(`${p.apellidos}, ${p.nombres}`);
    setPacList([]);
    setForm(f => ({ ...f, paciente_id: p.id }));
  };

  const selSlot = (s) => {
    const inicio = dayjs(s.inicio);
    const fin = dayjs(s.fin);
    setSlotSel(s.inicio);
    setHoraInicio(inicio.format("HH:mm"));
    setHoraFin(fin.format("HH:mm"));
    setForm(f => ({ ...f, inicio: s.inicio, fin: s.fin }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.paciente_id) { setErr("Selecciona un paciente"); return; }
    if (!form.medico_id)   { setErr("Selecciona un médico");   return; }
    if (!fechaSel)         { setErr("Selecciona una fecha");   return; }
    if (!horaInicio)       { setErr("Ingresa hora de inicio"); return; }
    if (!horaFin)          { setErr("Ingresa hora de fin");    return; }
    
    // Validar que hora fin sea después de hora inicio
    const inicio = dayjs(`${fechaSel} ${horaInicio}`);
    const fin = dayjs(`${fechaSel} ${horaFin}`);
    if (fin.isBefore(inicio) || fin.isSame(inicio)) {
      setErr("La hora de fin debe ser posterior a la hora de inicio");
      return;
    }
    
    setSaving(true); setErr("");
    try {
      const payload = {
        ...form,
        inicio: inicio.format("YYYY-MM-DD HH:mm:ss"),
        fin:    fin.format("YYYY-MM-DD HH:mm:ss"),
      };
      await api.post("/citas", payload);
      onCreated();
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Nueva Cita</h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body row g-3">
              {err && <div className="col-12"><div className="alert alert-danger py-2">{err}</div></div>}

              <div className="col-12 position-relative">
                <label className="form-label fw-semibold">Paciente</label>
                <input className="form-control" placeholder="Buscar por nombre o DNI…"
                  value={pacBusq}
                  onChange={e => { setPacBusq(e.target.value); setPacSel(null); setForm(f => ({ ...f, paciente_id: "" })); }} />
                {pacList.length > 0 && (
                  <ul className="list-group position-absolute z-3" style={{ maxHeight: 200, overflowY: "auto", width: "calc(100% - 3rem)" }}>
                    {pacList.map(p => (
                      <li key={p.id} className="list-group-item list-group-item-action py-1" style={{ cursor: "pointer" }}
                        onClick={() => selPaciente(p)}>
                        {p.apellidos}, {p.nombres} — DNI {p.dni}
                      </li>
                    ))}
                  </ul>
                )}
                {pacSel && <small className="text-success">✓ {pacSel.nombres} {pacSel.apellidos}</small>}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">Médico</label>
                <select className="form-select" value={form.medico_id}
                  onChange={e => setForm(f => ({ ...f, medico_id: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {medicos.map(m => (
                    <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">Fecha</label>
                <input type="date" className="form-control" value={fechaSel}
                  onChange={e => setFechaSel(e.target.value)} />
              </div>

              {slots.length > 0 && (
                <div className="col-12">
                  <label className="form-label fw-semibold">Horarios disponibles (click para seleccionar)</label>
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
              {form.medico_id && fechaSel && slots.length === 0 && (
                <div className="col-12"><small className="text-muted">Sin horarios disponibles. Ingresa hora manualmente.</small></div>
              )}

              <div className="col-md-6">
                <label className="form-label fw-semibold">Hora inicio</label>
                <input 
                  type="time" 
                  className="form-control" 
                  value={horaInicio}
                  onChange={e => setHoraInicio(e.target.value)}
                  placeholder="HH:mm"
                  required
                />
                <small className="text-muted">Ejemplo: 2:30 PM = 14:30</small>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">Hora fin</label>
                <input 
                  type="time" 
                  className="form-control" 
                  value={horaFin}
                  onChange={e => setHoraFin(e.target.value)}
                  placeholder="HH:mm"
                  required
                />
                <small className="text-muted">Ejemplo: 3:00 PM = 15:00</small>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">Tipo</label>
                <select className="form-select" value={form.tipo_consulta}
                  onChange={e => setForm(f => ({ ...f, tipo_consulta: e.target.value }))}>
                  {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Canal</label>
                <select className="form-select" value={form.canal}
                  onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}>
                  {["RECEPCION","APP","TELEFONO","WEB"].map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Motivo</label>
                <input className="form-control" value={form.motivo}
                  onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando…" : "Crear Cita"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Detalle Cita ───────────────────────────────────────────────────────
function ModalDetalle({ event, onClose, onEstado, onCancelar, onMostrarConfirmDelete }) {
  const c = event.resource;
  const color = ESTADO_COLOR[c.estado] || { bg: "#6c757d", fg: "#fff" };
  const ACCIONES = {
    PENDIENTE:   ["CONFIRMADA","CANCELADA"],
    CONFIRMADA:  ["EN_ESPERA","CANCELADA"],
    EN_ESPERA:   ["EN_ATENCION","NO_ASISTIO"],
    EN_ATENCION: ["COMPLETADA"],
    COMPLETADA:  [],
    CANCELADA:   [],
    NO_ASISTIO:  [],
  };
  const acciones = ACCIONES[c.estado] || [];

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header" style={{ background: color.bg, color: color.fg }}>
            <h5 className="modal-title">Detalle de Cita</h5>
            <button className="btn-close"
              style={{ filter: color.fg === "#fff" ? "invert(1)" : "" }} onClick={onClose} />
          </div>
          <div className="modal-body">
            <table className="table table-sm table-borderless">
              <tbody>
                <tr><th>Paciente</th><td>{c.paciente_apellidos}, {c.paciente_nombres}</td></tr>
                <tr><th>Médico</th><td>Dr. {c.medico_apellidos} {c.medico_nombres}</td></tr>
                <tr><th>Inicio</th><td>{dayjs(c.inicio).format("DD/MM/YYYY h:mm A")}</td></tr>
                <tr><th>Fin</th><td>{dayjs(c.fin).format("h:mm A")}</td></tr>
                <tr><th>Tipo</th><td>{c.tipo_consulta}</td></tr>
                <tr><th>Canal</th><td>{c.canal}</td></tr>
                <tr><th>Motivo</th><td>{c.motivo || "—"}</td></tr>
                <tr>
                  <th>Estado</th>
                  <td><span className="badge" style={{ background: color.bg, color: color.fg }}>{c.estado}</span></td>
                </tr>
              </tbody>
            </table>
            {acciones.length > 0 && (
              <div className="mt-2">
                <small className="text-muted d-block mb-1">Cambiar estado:</small>
                <div className="d-flex gap-2 flex-wrap">
                  {acciones.map(est => (
                    <button key={est} className="btn btn-sm"
                      style={{ background: ESTADO_COLOR[est].bg, color: ESTADO_COLOR[est].fg }}
                      onClick={() => onEstado(est)}>
                      {est.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <div className="me-auto">
              <button className="btn btn-danger btn-sm" 
                onClick={onMostrarConfirmDelete}
                title="Eliminar registro permanentemente de la base de datos">
                <i className="bi bi-trash3"></i> Eliminar permanentemente
              </button>
            </div>
            {c.estado !== "CANCELADA" && c.estado !== "COMPLETADA" && (
              <button className="btn btn-outline-danger btn-sm" onClick={onCancelar}>Cancelar cita</button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Confirmación Eliminar ──────────────────────────────────────────────
function ModalConfirmDelete({ onConfirm, onCancel, pacienteNombre, fecha }) {
  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.7)", zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-danger">
          <div className="modal-header bg-danger text-white">
            <h5 className="modal-title">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              Confirmar Eliminación Permanente
            </h5>
            <button className="btn-close btn-close-white" onClick={onCancel} />
          </div>
          <div className="modal-body">
            <div className="alert alert-warning mb-3">
              <strong>⚠️ ADVERTENCIA:</strong> Esta acción eliminará permanentemente el registro de la base de datos y <strong>no se puede deshacer</strong>.
            </div>
            <p className="mb-2"><strong>Paciente:</strong> {pacienteNombre}</p>
            <p className="mb-3"><strong>Fecha:</strong> {fecha}</p>
            <p className="text-muted small mb-0">
              Si solo deseas cancelar la cita sin eliminar el registro, usa el botón "Cancelar cita" en su lugar.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancel}>
              <i className="bi bi-x-circle me-1"></i>
              No, volver
            </button>
            <button className="btn btn-danger" onClick={onConfirm}>
              <i className="bi bi-trash3-fill me-1"></i>
              Sí, eliminar permanentemente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
