import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, dayjsLocalizer, Views } from "react-big-calendar";
import { useAuth } from "../auth/AuthContext";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import api from "../api/api";

dayjs.locale("es");
const localizer = dayjsLocalizer(dayjs);
const DnDCalendar = withDragAndDrop(Calendar);

// ─── Helper edad ─────────────────────────────────────────────────────────────
function calcEdad(fechaNac) {
  if (!fechaNac) return null;
  const nac = dayjs(fechaNac);
  const años = dayjs().diff(nac, "year");
  if (años < 0) return null;
  if (años === 0) {
    const meses = dayjs().diff(nac, "month");
    return `${meses}m`;
  }
  return `${años}a`;
}

// ─── Chip de paciente con edad y ciudad ──────────────────────────────────────
function ChipPacienteCita({ apellidos, nombres, ciudad, departamento, fechaNac, tel, size = "md" }) {
  const edad = calcEdad(fechaNac);
  const isSm = size === "sm";
  const ubicacion = [departamento, ciudad].filter(Boolean).join(" · ");
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: isSm ? "0.82rem" : "0.9rem", color: "#111827", lineHeight: 1.2 }}>
        {nombres} {apellidos}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
        {edad && (
          <span style={{
            background: "rgba(124,58,237,.1)", color: "#6d28d9",
            borderRadius: 5, padding: "1px 6px", fontSize: "0.68rem", fontWeight: 700,
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            <i className="bi bi-person" style={{ fontSize: 9 }} />{edad}
          </span>
        )}
        {ubicacion && (
          <span style={{
            background: "rgba(14,165,233,.1)", color: "#0369a1",
            borderRadius: 5, padding: "1px 6px", fontSize: "0.68rem", fontWeight: 700,
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            <i className="bi bi-geo-alt" style={{ fontSize: 9 }} />{ubicacion}
          </span>
        )}
        {tel && !ubicacion && !edad && (
          <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{tel}</span>
        )}
      </div>
    </div>
  );
}

// ─── colores por estado ───────────────────────────────────────────────────────
const ESTADO_COLOR = {
  PENDIENTE:   { bg: "#fef9c3", fg: "#854d0e", dot: "#eab308" },
  CONFIRMADA:  { bg: "#dbeafe", fg: "#1e40af", dot: "#3b82f6" },
  EN_ESPERA:   { bg: "#ede9fe", fg: "#5b21b6", dot: "#8b5cf6" },
  EN_ATENCION: { bg: "#dcfce7", fg: "#166534", dot: "#22c55e" },
  COMPLETADA:  { bg: "#f1f5f9", fg: "#475569", dot: "#94a3b8" },
  CANCELADA:   { bg: "#fee2e2", fg: "#991b1b", dot: "#ef4444" },
  NO_ASISTIO:  { bg: "#ffedd5", fg: "#9a3412", dot: "#f97316" },
};

const ESTADOS = Object.keys(ESTADO_COLOR);

// ─── Tipos de consulta por tipo de clínica ───────────────────────────────────
const TIPOS_CONSULTA_BASE = ["PRIMERA_VEZ", "CONTROL", "EMERGENCIA", "TELECONSULTA"];

const TIPOS_CONSULTA_ESTETICA = [
  "Consulta dermatológica primera vez",
  "Consulta dermatológica control",
  "Consulta estética",
  "Consulta pediátrica dermatológica",
  "Consulta de urgencia dermatológica",
  "Consulta online",
  "Revisión postprocedimiento",
  "Retiro de puntos",
  "Curación postquirúrgica",
  "Evaluación preláser",
  "Evaluación postláser",
];

function getTiposConsulta(tipoClave) {
  return (tipoClave === "estetica" || tipoClave === "dermatologia")
    ? TIPOS_CONSULTA_ESTETICA
    : TIPOS_CONSULTA_BASE;
}

const MESSAGES = {
  today: "Hoy", previous: "Anterior", next: "Siguiente",
  month: "Mes", week: "Semana", day: "Día", agenda: "Agenda",
  date: "Fecha", time: "Hora", event: "Cita",
  noEventsInRange: "Sin citas en este rango.",
  showMore: (total) => `+${total} más`,
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
    title: `${c.paciente_nombres} ${c.paciente_apellidos}`,
    start: new Date(c.inicio),
    end:   new Date(c.fin),
    resource: c,
  }));
}

// ─── Componente personalizado para la vista Agenda ───────────────────────────
// Muestra el plan + estudios pendientes de la última consulta del paciente
function AgendaEventoPendientes({ event }) {
  const [pendientes, setPendientes] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    api.get(`/citas/${event.id}/pendientes`)
      .then(r => { if (activo) setPendientes(r.data.data); })
      .catch(() => {})
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [event.id]);

  const col = ESTADO_COLOR[event.resource?.estado] || { bg: "#0d6efd", fg: "#fff" };
  const hayPendientes = pendientes && (pendientes.plan || pendientes.estudios?.length > 0);
  const r = event.resource || {};
  const edad = calcEdad(r.paciente_fecha_nac);

  return (
    <div style={{ lineHeight: 1.4 }}>
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <span className="fw-semibold">{event.title}</span>
        {edad && (
          <span style={{
            background: "rgba(124,58,237,.1)", color: "#6d28d9",
            borderRadius: 5, padding: "1px 7px", fontSize: "0.7rem", fontWeight: 700,
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            <i className="bi bi-person" style={{ fontSize: 9 }} />{edad}
          </span>
        )}
        {(r.paciente_departamento || r.paciente_ciudad) && (
          <span style={{
            background: "rgba(14,165,233,.1)", color: "#0369a1",
            borderRadius: 5, padding: "1px 7px", fontSize: "0.7rem", fontWeight: 700,
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            <i className="bi bi-geo-alt" style={{ fontSize: 9 }} />
            {[r.paciente_departamento, r.paciente_ciudad].filter(Boolean).join(" · ")}
          </span>
        )}
        {!cargando && hayPendientes && (
          <span className="badge" style={{ background: "#e65c00", fontSize: "0.68rem", padding: "2px 6px" }}>
            <i className="bi bi-exclamation-circle me-1" />
            {pendientes.estudios.length > 0 && `${pendientes.estudios.length} estudio${pendientes.estudios.length > 1 ? "s" : ""}`}
            {pendientes.estudios.length > 0 && pendientes.plan && " · "}
            {pendientes.plan && "plan pendiente"}
          </span>
        )}
      </div>

      {hayPendientes && (
        <div className="mt-1 rounded" style={{
          background: "rgba(255,255,255,0.92)",
          border: "1px solid #f0c040",
          padding: "5px 8px",
          fontSize: "0.78rem",
          color: "#333",
          maxWidth: 500,
        }}>
          {pendientes.diagnostico_desc && (
            <div className="mb-1" style={{ color: "#555", fontSize: "0.74rem" }}>
              <i className="bi bi-clipboard2-pulse me-1 text-primary" />
              <strong>Dx anterior:</strong> {pendientes.diagnostico_desc}
            </div>
          )}
          {pendientes.plan && (
            <div className="mb-1">
              <i className="bi bi-journal-text me-1 text-success" />
              <strong>Plan médico:</strong> {pendientes.plan}
            </div>
          )}
          {pendientes.estudios?.length > 0 && (
            <div>
              <i className="bi bi-flask me-1 text-warning" />
              <strong>Estudios pendientes:</strong>
              <ul className="mb-0 mt-1 ps-3" style={{ fontSize: "0.75rem" }}>
                {pendientes.estudios.map(e => (
                  <li key={e.id}>
                    {e.urgente === 1 && <span className="text-danger fw-bold me-1">URGENTE</span>}
                    <span className="badge bg-secondary me-1" style={{ fontSize: "0.68rem" }}>{e.tipo}</span>
                    {e.descripcion}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pendientes.ultima_consulta && (
            <div className="mt-1" style={{ color: "#888", fontSize: "0.72rem" }}>
              <i className="bi bi-clock-history me-1" />
              Última consulta: {dayjs(pendientes.ultima_consulta).format("DD/MM/YYYY")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function dayPropGetter(date) {
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (!isToday) return {};
  return {
    style: {
      boxShadow: "inset 0 0 0 3px #0D1B2E",
      borderRadius: "4px",
    },
  };
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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [tipoClinica, setTipoClinica] = useState("");
  const [tiposCita, setTiposCita] = useState([]);
  const [activeTab, setActiveTab]   = useState(searchParams.get("tab") || "calendario");
  const [events,    setEvents]      = useState([]);
  const [medicos,   setMedicos]     = useState([]);
  const [filterMed, setFilterMed]   = useState("");
  const [filterMedText, setFilterMedText] = useState("");
  const [showMedList, setShowMedList] = useState(false);
  const [view,      setView]        = useState(searchParams.get("view") === "agenda" ? Views.AGENDA : Views.MONTH);
  const [date,      setDate]        = useState(new Date());
  const [loading,   setLoading]     = useState(false);
  const [showNew,   setShowNew]     = useState(false);
  const [slotInfo,  setSlotInfo]    = useState(null);
  const [showDet,   setShowDet]     = useState(false);
  const [selEvent,  setSelEvent]    = useState(null);
  const [sala,      setSala]        = useState([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showEdit,         setShowEdit]          = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [loadingReminderData, setLoadingReminderData] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [plantillasRecordatorio, setPlantillasRecordatorio] = useState([]);
  const [reminderForm, setReminderForm] = useState({ canal: "EMAIL", asunto: "", contenido: "" });
  const headerRef = useRef(null);

  // Sincronizar estado con cambios en la URL (cuando se navega desde el sidebar)
  useEffect(() => {
    const tab = searchParams.get("tab") || "calendario";
    const viewParam = searchParams.get("view");
    setActiveTab(tab);
    if (tab === "sala") return;
    setView(viewParam === "agenda" ? Views.AGENDA : Views.MONTH);
  }, [searchParams]);

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
    // Cargar catálogo de tipos de cita de esta clínica
    api.get("/catalogos-tipos-cita")
      .then(r => setTiposCita(r.data.data || []))
      .catch(() => {});
  }, [user?.clinica_id]);

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
    // Actualización optimista: mover el evento en el calendario de inmediato
    setEvents(prev => prev.map(e =>
      e.id === event.id
        ? { ...e, start, end, resource: { ...e.resource, inicio: start.toISOString(), fin: end.toISOString() } }
        : e
    ));
    api.put(`/citas/${event.id}`, {
      inicio: dayjs(start).format("YYYY-MM-DD HH:mm:ss"),
      fin:    dayjs(end).format("YYYY-MM-DD HH:mm:ss"),
    })
    .catch(err => {
      // Revertir si falla
      setEvents(prev => prev.map(e =>
        e.id === event.id ? { ...e, start: event.start, end: event.end } : e
      ));
      alert(err.response?.data?.msg || "Error al reprogramar");
    });
  };

  const onEventResize = ({ event, start, end }) => onEventDrop({ event, start, end });

  const onSelectSlot = (slot) => {
    setSlotInfo({ inicio: slot.start, fin: slot.end });
    setShowNew(true);
  };

  const onSelectEvent = (event) => {
    setSelEvent(event);
    setShowDet(true);
    setTimeout(() => headerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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

  const htmlATextoPlano = (html = "") => {
    const conSaltos = String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<li>/gi, "• ")
      .replace(/<\/li>/gi, "\n");
    const sinTags = conSaltos.replace(/<[^>]+>/g, "");
    return sinTags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const reemplazarVarsRecordatorio = (texto = "") => {
    const c = selEvent?.resource || {};
    const paciente = `${c.paciente_nombres || ""} ${c.paciente_apellidos || ""}`.trim();
    const medico = `${c.medico_nombres || ""} ${c.medico_apellidos || ""}`.trim();
    return String(texto || "")
      .replaceAll("{paciente}", paciente)
      .replaceAll("{clinica}", "Clínica")
      .replaceAll("{medico}", medico)
      .replaceAll("{fecha}", c.inicio ? dayjs(c.inicio).format("DD/MM/YYYY") : dayjs().format("DD/MM/YYYY"))
      .replaceAll("{hora}", c.inicio ? dayjs(c.inicio).format("HH:mm") : dayjs().format("HH:mm"));
  };

  const aplicarPlantillaCanal = (canal, plantillas = plantillasRecordatorio) => {
    const lista = (plantillas || []).filter((p) => p.tipo === canal && Number(p.activo) === 1);
    const plantilla = lista.find((p) => Number(p.es_predeterminada) === 1) || lista[0];
    const contenidoBase = plantilla?.contenido || "Hola {paciente}, este es un recordatorio de su clínica.";
    const contenidoLimpio = canal === "EMAIL" ? htmlATextoPlano(contenidoBase) : contenidoBase;
    setReminderForm({
      canal,
      asunto: canal === "EMAIL" ? reemplazarVarsRecordatorio(plantilla?.asunto || "Recordatorio de cita") : "",
      contenido: reemplazarVarsRecordatorio(contenidoLimpio),
    });
  };

  const abrirRecordatorio = async () => {
    if (!selEvent?.resource?.paciente_id) return;
    setShowReminder(true);
    setLoadingReminderData(true);
    try {
      const { data } = await api.get("/recordatorios/plantillas");
      const plantillas = data?.plantillas || [];
      setPlantillasRecordatorio(plantillas);
      aplicarPlantillaCanal("EMAIL", plantillas);
    } catch {
      setPlantillasRecordatorio([]);
      setReminderForm({
        canal: "EMAIL",
        asunto: "Recordatorio de cita",
        contenido: reemplazarVarsRecordatorio("Hola {paciente}, le recordamos su cita el {fecha} a las {hora} con {medico}."),
      });
    } finally {
      setLoadingReminderData(false);
    }
  };

  const enviarRecordatorioManual = async () => {
    const c = selEvent?.resource || {};
    if (!c.paciente_id) return alert("No se encontró paciente para esta cita");
    if (!reminderForm.contenido?.trim()) return alert("Escribe el contenido del recordatorio");
    setSendingReminder(true);
    try {
      await api.post("/recordatorios/enviar-manual", {
        paciente_id: c.paciente_id,
        canal: reminderForm.canal,
        asunto: reminderForm.asunto,
        contenido: reminderForm.contenido,
      });
      alert(`Recordatorio ${reminderForm.canal} enviado correctamente`);
      setShowReminder(false);
    } catch (err) {
      alert(err.response?.data?.error || "Error al enviar recordatorio");
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      <style>{`
        .event-hover:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          opacity: 0.95;
        }
        .rbc-time-slot:hover {
          background-color: rgba(59, 130, 246, 0.06) !important;
          cursor: pointer;
        }
        .rbc-month-view .rbc-day-bg:hover {
          background-color: rgba(59, 130, 246, 0.04) !important;
          cursor: pointer;
        }
        .rbc-month-row { min-height: 90px; }
        .rbc-event { padding: 1px 4px !important; font-size: 0.72rem !important; line-height: 1.3 !important; }
        .rbc-event-content { font-size: 0.72rem !important; }
        .rbc-toolbar button { font-size: 0.83rem !important; padding: 5px 13px !important; border-radius: 7px !important; }
        .rbc-toolbar button.rbc-active { background: #2563eb !important; color: #fff !important; border-color: #2563eb !important; }
      `}</style>

      {/* Header */}
      <div ref={headerRef} style={{
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
            <i className="bi bi-calendar-week-fill" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>
              {activeTab === "sala"
                ? "Sala de Espera"
                : view === Views.AGENDA
                ? "Agenda"
                : "Programar Citas"}
            </div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>
              {dayjs().format("dddd D [de] MMMM [de] YYYY")}
            </div>
          </div>
        </div>
        <button
          onClick={() => { setSlotInfo(null); setShowNew(true); }}
          style={{
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            border: "none", borderRadius: 8, color: "#fff",
            padding: "7px 18px", fontSize: "0.83rem", cursor: "pointer",
            fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 2px 8px rgba(59,130,246,.35)",
          }}>
          <i className="bi bi-plus-lg"></i> Nueva Cita
        </button>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* Tabs */}
        <div style={{
          background: "#fff", borderRadius: "12px 12px 0 0",
          borderBottom: "1px solid #e5e7eb", display: "flex", padding: "0 6px",
          boxShadow: "0 1px 4px rgba(0,0,0,.04)",
        }}>
          {[
            { id: "calendario", icon: "bi-calendar3",        label: "Calendario" },
            { id: "sala",       icon: "bi-person-lines-fill", label: "Sala de Espera" },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: "none", border: "none",
              borderBottom: activeTab === t.id ? "2.5px solid #3b82f6" : "2.5px solid transparent",
              color: activeTab === t.id ? "#2563eb" : "#6b7280",
              fontWeight: activeTab === t.id ? 700 : 500,
              padding: "12px 20px", fontSize: "0.87rem", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
            }}>
              <i className={`bi ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{
          background: "#fff", borderRadius: "0 0 12px 12px",
          boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: "16px 20px",
        }}>
          {activeTab === "calendario" && (
        <>
          <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
            <div className="position-relative" style={{ maxWidth: 300 }}>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted"></i></span>
                <input
                  className="form-control form-control-sm border-start-0"
                  placeholder="Buscar médico por nombre…"
                  value={filterMedText}
                  onChange={e => { setFilterMedText(e.target.value); setShowMedList(true); if (!e.target.value) { setFilterMed(""); } }}
                  onFocus={() => setShowMedList(true)}
                />
                {filterMed && (
                  <button className="btn btn-outline-secondary btn-sm border-start-0" type="button"
                    onClick={() => { setFilterMed(""); setFilterMedText(""); }}>
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
              {showMedList && filterMedText.length > 0 && (() => {
                const filtered = medicos.filter(m => {
                  const txt = filterMedText.toLowerCase();
                  return m.nombres?.toLowerCase().includes(txt) || m.apellidos?.toLowerCase().includes(txt) || m.especialidad?.toLowerCase().includes(txt);
                });
                return filtered.length > 0 ? (
                  <ul className="list-group position-absolute z-3 shadow" style={{ top: "100%", left: 0, right: 0, maxHeight: 200, overflowY: "auto" }}>
                    {filtered.map(m => (
                      <li key={m.id} className={`list-group-item list-group-item-action py-1 ${filterMed === String(m.id) ? "active" : ""}`}
                        style={{ cursor: "pointer", fontSize: "0.82rem" }}
                        onClick={() => { setFilterMed(String(m.id)); setFilterMedText(`Dr. ${m.nombres} ${m.apellidos}`); setShowMedList(false); }}>
                        <strong>Dr. {m.nombres} {m.apellidos}</strong>
                        {m.especialidad && <span className="text-muted ms-1">— {m.especialidad}</span>}
                      </li>
                    ))}
                  </ul>
                ) : null;
              })()}
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginLeft: "auto" }}>
              {ESTADOS.map(est => (
                <span key={est} style={{
                  background: ESTADO_COLOR[est].bg, color: ESTADO_COLOR[est].fg,
                  borderRadius: 20, padding: "3px 9px", fontSize: "0.69rem", fontWeight: 700,
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: ESTADO_COLOR[est].dot, display: "inline-block" }}></span>
                  {est}
                </span>
              ))}
            </div>
          </div>
          {loading && <div style={{ fontSize: "0.82rem", color: "#9ca3af", marginBottom: 8 }}>Cargando citas...</div>}
          <div style={{ height: "calc(100vh - 310px)", minHeight: 480 }}>
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
              dayPropGetter={dayPropGetter}
              popup
              popupOffset={{ x: 30, y: 20 }}
              messages={MESSAGES}
              formats={FORMATS}
              culture="es"
              step={15}
              timeslots={4}
              defaultView={Views.MONTH}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              components={{
                agenda: {
                  event: AgendaEventoPendientes,
                },
              }}
            />
          </div>
        </>
      )}

          {activeTab === "sala" && (
            <SalaEspera
              sala={sala}
              onEstadoChange={(id, estado) => {
                api.patch(`/citas/${id}/estado`, { estado })
                  .then(() => loadSalaEspera())
                  .catch(err => alert(err.response?.data?.msg || "Error"));
              }}
            />
          )}
        </div>
      </div>

      {showNew && (
        <ModalNuevaCita
          slotInfo={slotInfo}
          medicos={medicos}
          tipoClinica={tipoClinica}
          tiposCita={tiposCita}
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
          onEditar={() => { setShowDet(false); setShowEdit(true); }}
          onRecordatorio={abrirRecordatorio}
        />
      )}

      {showReminder && selEvent && (
        <ModalRecordatorioManual
          event={selEvent}
          form={reminderForm}
          loading={loadingReminderData}
          sending={sendingReminder}
          onClose={() => setShowReminder(false)}
          onCanalChange={(canal) => aplicarPlantillaCanal(canal)}
          onChange={(patch) => setReminderForm((prev) => ({ ...prev, ...patch }))}
          onSend={enviarRecordatorioManual}
        />
      )}

      {showEdit && selEvent && (
        <ModalEditarCita
          event={selEvent}
          medicos={medicos}
          tipoClinica={tipoClinica}
          tiposCita={tiposCita}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); loadCitas(); loadSalaEspera(); }}
        />
      )}

      {showConfirmDelete && selEvent && (
        <ModalConfirmDelete
          onConfirm={eliminarPermanente}
          onCancel={() => setShowConfirmDelete(false)}
          pacienteNombre={`${selEvent.resource.paciente_nombres} ${selEvent.resource.paciente_apellidos}`}
          fecha={dayjs(selEvent.resource.inicio).format("DD/MM/YYYY h:mm A")}
        />
      )}
    </div>
  );
}

// ─── Badge de estado ─────────────────────────────────────────────────────────
function EstadoBadgeCitas({ estado }) {
  const c = ESTADO_COLOR[estado] || { bg: "#f1f5f9", fg: "#475569", dot: "#94a3b8" };
  return (
    <span style={{
      background: c.bg, color: c.fg, borderRadius: 20,
      padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700,
      display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, display: "inline-block" }}></span>
      {estado.replace(/_/g, " ")}
    </span>
  );
}

// ─── Sala de Espera ───────────────────────────────────────────────────────────
function SalaEspera({ sala, onEstadoChange }) {
  const FLUJO = ["EN_ESPERA", "EN_ATENCION", "COMPLETADA"];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827" }}>
          Sala de Espera - {dayjs().format("dddd D [de] MMMM")}
        </span>
        {sala.length > 0 && (
          <span style={{ background: "#ede9fe", color: "#7c3aed", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
            {sala.length}
          </span>
        )}
      </div>

      {sala.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
          <i className="bi bi-person-check" style={{ fontSize: "2.8rem", opacity: .3 }}></i>
          <p style={{ marginTop: 10, fontSize: "0.88rem" }}>No hay pacientes en sala de espera.</p>
        </div>
      )}

      {sala.length > 0 && (
        <>
          <div style={{
            background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8,
            padding: "8px 14px", marginBottom: 16, fontSize: "0.79rem", color: "#0369a1",
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <i className="bi bi-info-circle"></i>
            Se muestran todas las citas de hoy excepto las CANCELADAS y NO_ASISTIO
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["#", "Paciente", "Medico", "Hora", "Estado", "Acciones"].map(h => (
                    <th key={h} style={{
                      padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700,
                      color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                      borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap", textAlign: "left",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sala.map((c, i) => (
                  <FilaSala key={c.id} c={c} i={i}
                    flujo={FLUJO} onEstadoChange={onEstadoChange} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FilaSala({ c, i, flujo, onEstadoChange }) {
  const [hover, setHover] = useState(false);
  const btnStyle = (color) => ({
    background: "transparent", border: `1px solid ${color}`,
    borderRadius: 7, color, padding: "3px 10px", fontSize: "0.72rem",
    cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
  });
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: "1px solid #f1f5f9",
        background: hover ? "#f8fafd" : "#fff",
        transition: "background .12s",
      }}>
      <td style={{ padding: "12px 14px", color: "#9ca3af", fontWeight: 700, fontSize: "0.82rem" }}>{i + 1}</td>
      <td style={{ padding: "12px 14px" }}>
        <ChipPacienteCita
          apellidos={c.paciente_apellidos}
          nombres={c.paciente_nombres}
          ciudad={c.paciente_ciudad}
          fechaNac={c.paciente_fecha_nac}
          tel={c.paciente_tel}
          size="sm"
        />
      </td>
      <td style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: "0.85rem", color: "#374151", fontWeight: 600 }}>Dr. {c.medico_apellidos}</div>
        <div style={{ fontSize: "0.74rem", color: "#9ca3af", marginTop: 2 }}>{c.especialidad}</div>
      </td>
      <td style={{ padding: "12px 14px", fontSize: "0.83rem", color: "#374151", whiteSpace: "nowrap" }}>
        {dayjs(c.inicio).format("h:mm A")} - {dayjs(c.fin).format("h:mm A")}
      </td>
      <td style={{ padding: "12px 14px" }}>
        <EstadoBadgeCitas estado={c.estado} />
      </td>
      <td style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {flujo.filter(e => e !== c.estado).map(e => (
            <button key={e} onClick={() => onEstadoChange(c.id, e)}
              style={btnStyle(ESTADO_COLOR[e]?.dot || "#6b7280")}>
              {e.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}

// ─── TimePicker 12h ──────────────────────────────────────────────────────────
// Recibe value en "HH:mm" (24h) y llama onChange con "HH:mm" (24h)
function TimePicker12h({ value, onChange, label, required }) {
  // Parsear value (HH:mm 24h) → partes 12h
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
      {label && <label className="form-label mb-1" style={{ fontSize: "0.78rem" }}>{label}</label>}
      <input
        type="time"
        className="form-control form-control-sm"
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

// ─── Modal Nueva Cita ─────────────────────────────────────────────────────────
function ModalNuevaCita({ slotInfo, medicos, tipoClinica, tiposCita = [], onClose, onCreated }) {
  const tiposConsulta = tiposCita.length > 0 ? tiposCita.map(t => t.nombre) : getTiposConsulta(tipoClinica);
  const [form, setForm] = useState({
    paciente_id: "", medico_id: "", inicio: "", fin: "",
    tipo_consulta: tiposConsulta[0], motivo: "", canal: "RECEPCION",
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
    setPacBusq(`${p.nombres} ${p.apellidos}`);
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
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: 480, margin: "1rem auto" }}>
        <div className="modal-content" style={{ fontSize: "0.85rem" }}>
          <div className="modal-header py-2 px-3">
            <h6 className="modal-title mb-0 fw-bold">
              <i className="bi bi-calendar-plus me-2 text-primary" />
              Nueva Cita
            </h6>
            <button className="btn-close btn-sm" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body px-3 py-2">
              {err && <div className="alert alert-danger py-1 px-2 mb-2" style={{ fontSize: "0.8rem" }}>{err}</div>}

              <div className="row g-2">
                {/* Paciente */}
                <div className="col-12 position-relative">
                  <label className="form-label mb-1">Paciente</label>
                  <input className="form-control form-control-sm" placeholder="Buscar por nombre o DNI…"
                    value={pacBusq}
                    onChange={e => { setPacBusq(e.target.value); setPacSel(null); setForm(f => ({ ...f, paciente_id: "" })); }} />
                  {pacList.length > 0 && (
                    <ul className="list-group position-absolute z-3 shadow-sm" style={{ top: "100%", left: 0, right: 0, maxHeight: 160, overflowY: "auto", fontSize: "0.8rem" }}>
                      {pacList.map(p => {
                        const edad = calcEdad(p.fecha_nacimiento);
                        return (
                          <li key={p.id} className="list-group-item list-group-item-action py-2 px-2" style={{ cursor: "pointer" }}
                            onClick={() => selPaciente(p)}>
                            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#111827" }}>
                              {p.nombres} {p.apellidos}
                            </div>
                            <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                              {p.dni && <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>DNI {p.dni}</span>}
                              {edad && (
                                <span style={{
                                  background: "rgba(124,58,237,.1)", color: "#6d28d9",
                                  borderRadius: 4, padding: "0 5px", fontSize: "0.68rem", fontWeight: 700,
                                }}>{edad}</span>
                              )}
                              {p.ciudad && (
                                <span style={{
                                  background: "rgba(14,165,233,.1)", color: "#0369a1",
                                  borderRadius: 4, padding: "0 5px", fontSize: "0.68rem", fontWeight: 700,
                                }}>
                                  <i className="bi bi-geo-alt" style={{ fontSize: 9 }} /> {p.ciudad}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {pacSel && (
                    <div style={{
                      marginTop: 6, padding: "6px 10px", borderRadius: 8,
                      background: "rgba(34,197,94,.07)", border: "1px solid rgba(34,197,94,.25)",
                    }}>
                      <ChipPacienteCita
                        apellidos={pacSel.apellidos}
                        nombres={pacSel.nombres}
                        ciudad={pacSel.ciudad}
                        fechaNac={pacSel.fecha_nacimiento}
                        tel={pacSel.telefono}
                        size="sm"
                      />
                    </div>
                  )}
                </div>

                {/* Médico + Fecha */}
                <div className="col-8">
                  <label className="form-label mb-1">Médico</label>
                  <select className="form-select form-select-sm" value={form.medico_id}
                    onChange={e => setForm(f => ({ ...f, medico_id: e.target.value }))}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>
                        Dr. {m.apellidos}{m.especialidad ? ` – ${m.especialidad}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label mb-1">Fecha</label>
                  <input type="date" className="form-control form-control-sm" value={fechaSel}
                    onChange={e => setFechaSel(e.target.value)} />
                </div>

                {/* Slots */}
                {slots.length > 0 && (
                  <div className="col-12">
                    <label className="form-label mb-1">Horarios disponibles</label>
                    <div className="d-flex flex-wrap gap-1">
                      {slots.map(s => (
                        <button key={s.inicio} type="button" style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                          className={`btn btn-sm ${slotSel === s.inicio ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => selSlot(s)}>
                          {dayjs(s.inicio).format("h:mm A")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {form.medico_id && fechaSel && slots.length === 0 && (
                  <div className="col-12">
                    <small className="text-muted">Sin horarios disponibles. Ingresa hora manualmente.</small>
                  </div>
                )}

                {/* Horas */}
                <div className="col-6 col-sm-6">
                  <TimePicker12h label="Hora inicio" value={horaInicio} onChange={setHoraInicio} required />
                </div>
                <div className="col-6 col-sm-6">
                  <TimePicker12h label="Hora fin" value={horaFin} onChange={setHoraFin} required />
                </div>

                {/* Tipo + Canal + Motivo */}
                <div className="col-4">
                  <label className="form-label mb-1">Tipo</label>
                  <select className="form-select form-select-sm" value={form.tipo_consulta}
                    onChange={e => setForm(f => ({ ...f, tipo_consulta: e.target.value }))}>
                    {tiposConsulta.map(t => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label mb-1">Canal</label>
                  <select className="form-select form-select-sm" value={form.canal}
                    onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}>
                    {["RECEPCION","APP","TELEFONO","WEB"].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label mb-1">Motivo</label>
                  <input className="form-control form-control-sm" value={form.motivo}
                    onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>
            </div>

            <div className="modal-footer py-2 px-3">
              <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
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
function ModalDetalle({ event, onClose, onEstado, onCancelar, onMostrarConfirmDelete, onEditar, onRecordatorio }) {
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
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Paciente</th>
                  <td>
                    <ChipPacienteCita
                      apellidos={c.paciente_apellidos}
                      nombres={c.paciente_nombres}
                      ciudad={c.paciente_ciudad}
                      departamento={c.paciente_departamento}
                      fechaNac={c.paciente_fecha_nac}
                      tel={c.paciente_tel}
                    />
                  </td>
                </tr>
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
            {c.estado === "PENDIENTE" && (
              <button className="btn btn-outline-primary btn-sm" onClick={onEditar}>
                <i className="bi bi-pencil me-1"></i>Editar
              </button>
            )}
            <button className="btn btn-outline-success btn-sm" onClick={onRecordatorio}>
              <i className="bi bi-bell me-1"></i>Recordatorio
            </button>
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

function ModalRecordatorioManual({ event, form, loading, sending, onClose, onCanalChange, onChange, onSend }) {
  const c = event.resource || {};
  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 1060 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-bell me-2"></i>Recordatorio manual
            </h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="mb-2" style={{ fontSize: "0.85rem", color: "#475569" }}>
              <strong>Paciente:</strong> {c.paciente_nombres} {c.paciente_apellidos}
            </div>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Canal</label>
                <select className="form-select" value={form.canal} onChange={(e) => onCanalChange(e.target.value)} disabled={loading || sending}>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
              </div>
              {form.canal === "EMAIL" && (
                <div className="col-md-8">
                  <label className="form-label">Asunto</label>
                  <input className="form-control" value={form.asunto} onChange={(e) => onChange({ asunto: e.target.value })} disabled={loading || sending} />
                </div>
              )}
              <div className="col-12">
                <label className="form-label">Mensaje</label>
                <textarea className="form-control" rows={8} value={form.contenido} onChange={(e) => onChange({ contenido: e.target.value })} disabled={loading || sending} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={sending}>Cancelar</button>
            <button className="btn btn-primary" onClick={onSend} disabled={loading || sending}>{sending ? "Enviando..." : "Enviar ahora"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Editar Cita ────────────────────────────────────────────────────────
function ModalEditarCita({ event, medicos, tipoClinica, tiposCita = [], onClose, onSaved }) {
  const tiposConsulta = tiposCita.length > 0 ? tiposCita.map(t => t.nombre) : getTiposConsulta(tipoClinica);
  const c = event.resource;
  const [form, setForm] = useState({
    medico_id:     String(c.medico_id),
    tipo_consulta: c.tipo_consulta,
    canal:         c.canal,
    motivo:        c.motivo || "",
  });
  const [fechaSel,   setFechaSel]   = useState(dayjs(c.inicio).format("YYYY-MM-DD"));
  const [horaInicio, setHoraInicio] = useState(dayjs(c.inicio).format("HH:mm"));
  const [horaFin,    setHoraFin]    = useState(dayjs(c.fin).format("HH:mm"));
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const inicio = dayjs(`${fechaSel} ${horaInicio}`);
    const fin    = dayjs(`${fechaSel} ${horaFin}`);
    if (fin.isBefore(inicio) || fin.isSame(inicio)) {
      setErr("La hora de fin debe ser posterior a la hora de inicio");
      return;
    }
    setSaving(true); setErr("");
    try {
      await api.put(`/citas/${c.id}`, {
        ...form,
        inicio: inicio.format("YYYY-MM-DD HH:mm:ss"),
        fin:    fin.format("YYYY-MM-DD HH:mm:ss"),
      });
      onSaved();
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
            <h5 className="modal-title">
              <i className="bi bi-pencil-square me-2"></i>Editar Cita
            </h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body row g-3">
              {err && <div className="col-12"><div className="alert alert-danger py-2">{err}</div></div>}

              <div className="col-12">
                <label className="form-label fw-semibold">Paciente</label>
                <div className="form-control" style={{ background: "#f8fafc", cursor: "default", minHeight: 60 }}>
                  <ChipPacienteCita
                    apellidos={c.paciente_apellidos}
                    nombres={c.paciente_nombres}
                    ciudad={c.paciente_ciudad}
                    departamento={c.paciente_departamento}
                    fechaNac={c.paciente_fecha_nac}
                    tel={c.paciente_tel}
                  />
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">Médico</label>
                <select className="form-select" value={form.medico_id}
                  onChange={e => setForm(f => ({ ...f, medico_id: e.target.value }))}>
                  {medicos.map(m => (
                    <option key={m.id} value={String(m.id)}>
                      Dr. {m.nombres} {m.apellidos}{m.especialidad ? ` – ${m.especialidad}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">Fecha</label>
                <input type="date" className="form-control" value={fechaSel}
                  onChange={e => setFechaSel(e.target.value)} required />
              </div>

              <div className="col-md-6">
                <TimePicker12h label="Hora inicio" value={horaInicio} onChange={setHoraInicio} required />
              </div>
              <div className="col-md-6">
                <TimePicker12h label="Hora fin" value={horaFin} onChange={setHoraFin} required />
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold">Tipo</label>
                <select className="form-select" value={form.tipo_consulta}
                  onChange={e => setForm(f => ({ ...f, tipo_consulta: e.target.value }))}>
                  {tiposConsulta.map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Canal</label>
                <select className="form-select" value={form.canal}
                  onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}>
                  {["RECEPCION","APP","TELEFONO","WEB"].map(ch => (
                    <option key={ch}>{ch}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Motivo</label>
                <input className="form-control" value={form.motivo}
                  onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                  placeholder="Opcional" />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
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
