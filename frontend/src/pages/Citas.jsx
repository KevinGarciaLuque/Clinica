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
  return { style: { backgroundColor: col.bg, color: col.fg, borderRadius: "4px", border: "none", fontSize: "0.78rem" } };
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

  useEffect(() => {
    if (activeTab !== "sala") return;
    api.get("/dashboard/sala-espera")
      .then(r => setSala(r.data.data || []))
      .catch(() => setSala([]));
  }, [activeTab]);

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
      })
      .catch(err => alert(err.response?.data?.msg || "Error"));
  };

  const cancelarCita = () => {
    if (!confirm("¿Cancelar esta cita?")) return;
    api.delete(`/citas/${selEvent.id}`)
      .then(() => { setEvents(prev => prev.filter(e => e.id !== selEvent.id)); setShowDet(false); })
      .catch(err => alert(err.response?.data?.msg || "Error"));
  };

  return (
    <div className="container-fluid py-3">
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
        <SalaEspera sala={sala} onEstadoChange={(id, estado) => {
          api.patch(`/citas/${id}/estado`, { estado })
            .then(() => setSala(prev => prev.map(c => c.id === id ? { ...c, estado } : c)))
            .catch(err => alert(err.response?.data?.msg || "Error"));
        }} />
      )}

      {showNew && (
        <ModalNuevaCita
          slotInfo={slotInfo}
          medicos={medicos}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); loadCitas(); }}
        />
      )}

      {showDet && selEvent && (
        <ModalDetalle
          event={selEvent}
          onClose={() => setShowDet(false)}
          onEstado={cambiarEstado}
          onCancelar={cancelarCita}
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
                <td className="text-nowrap">{dayjs(c.inicio).format("HH:mm")} – {dayjs(c.fin).format("HH:mm")}</td>
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
    tipo_consulta: "CONSULTA", motivo: "", canal: "RECEPCION",
  });
  const [pacBusq,  setPacBusq]  = useState("");
  const [pacList,  setPacList]  = useState([]);
  const [pacSel,   setPacSel]   = useState(null);
  const [slots,    setSlots]    = useState([]);
  const [slotSel,  setSlotSel]  = useState("");
  const [fechaSel, setFechaSel] = useState(slotInfo ? dayjs(slotInfo.inicio).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"));
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  useEffect(() => {
    if (slotInfo) {
      setForm(f => ({
        ...f,
        inicio: dayjs(slotInfo.inicio).format("YYYY-MM-DD HH:mm:ss"),
        fin:    dayjs(slotInfo.fin).format("YYYY-MM-DD HH:mm:ss"),
      }));
    }
  }, [slotInfo]);

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
    setSlotSel(s.inicio);
    setForm(f => ({ ...f, inicio: s.inicio, fin: s.fin }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.paciente_id) { setErr("Selecciona un paciente"); return; }
    if (!form.medico_id)   { setErr("Selecciona un médico");   return; }
    if (!form.inicio)      { setErr("Selecciona un horario");  return; }
    setSaving(true); setErr("");
    try {
      await api.post("/citas", form);
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
                  <label className="form-label fw-semibold">Horario disponible</label>
                  <div className="d-flex flex-wrap gap-1">
                    {slots.map(s => (
                      <button key={s.inicio} type="button"
                        className={`btn btn-sm ${slotSel === s.inicio ? "btn-primary" : "btn-outline-primary"}`}
                        onClick={() => selSlot(s)}>
                        {dayjs(s.inicio).format("HH:mm")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {form.medico_id && fechaSel && slots.length === 0 && (
                <div className="col-12"><small className="text-muted">Sin horarios disponibles para ese día.</small></div>
              )}

              <div className="col-md-4">
                <label className="form-label fw-semibold">Tipo</label>
                <select className="form-select" value={form.tipo_consulta}
                  onChange={e => setForm(f => ({ ...f, tipo_consulta: e.target.value }))}>
                  {["CONSULTA","CONTROL","URGENCIA","CIRUGIA","PROCEDIMIENTO","TELEMEDICINA"].map(t => (
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
function ModalDetalle({ event, onClose, onEstado, onCancelar }) {
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
                <tr><th>Inicio</th><td>{dayjs(c.inicio).format("DD/MM/YYYY HH:mm")}</td></tr>
                <tr><th>Fin</th><td>{dayjs(c.fin).format("HH:mm")}</td></tr>
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
