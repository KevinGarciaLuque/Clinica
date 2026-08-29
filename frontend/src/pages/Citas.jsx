import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, dayjsLocalizer, Views } from "react-big-calendar";
import { useAuth } from "../auth/AuthContext";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import api from "../api/api";
import AnimatedFeedbackModal from "../components/AnimatedFeedbackModal";
import { tituloMedicoActivo, nombreMedico } from "../utils/medico";

dayjs.locale("es");
const localizer = dayjsLocalizer(dayjs);
const DnDCalendar = withDragAndDrop(Calendar);

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const fotoUrl = (foto) => {
  if (!foto) return null;
  if (foto.startsWith("http")) return foto;
  return `${API_BASE}/uploads/${foto.replace(/^\/?uploads\//, "")}`;
};

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
  PENDIENTE_APROBACION: { bg: "#fff7ed", fg: "#9a3412", dot: "#f97316" },
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
  return citas
    .filter(c => c.estado !== "CANCELADA" && c.estado !== "NO_ASISTIO")
    .map(c => ({
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

// ─── Contenido de evento para vistas Semana/Día: nombre en una línea con tooltip
function TimeGridEventContent({ event }) {
  return <span title={event.title}>{event.title}</span>;
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
      boxShadow: "inset 0 0 0 2px #2563eb",
      borderRadius: "4px",
    },
  };
}

function eventPropGetter(event) {
  const col = ESTADO_COLOR[event.resource?.estado] || { bg: "#0d6efd", fg: "#fff", dot: "#0d6efd" };
  return {
    style: {
      backgroundColor: col.bg,
      color: col.fg,
      borderRadius: "6px",
      border: "none",
      borderLeft: `3px solid ${col.dot}`,
      boxShadow: "0 1px 2px rgba(0,0,0,.08)",
      fontSize: "0.78rem",
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.15s ease"
    },
    className: "event-hover"
  };
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function Citas() {
  const navigate = useNavigate();
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
  const [feedbackModal, setFeedbackModal] = useState({
    open: false, type: "info", title: "", message: "", showCancel: false,
  });
  const headerRef = useRef(null);

  const showFeedback = useCallback((cfg) => {
    setFeedbackModal({
      open: true,
      type: cfg.type || "info",
      title: cfg.title || "Mensaje",
      message: cfg.message || "",
      confirmText: cfg.confirmText || "Aceptar",
      cancelText: cfg.cancelText || "Cancelar",
      showCancel: !!cfg.showCancel,
      onConfirm: cfg.onConfirm,
      onCancel: cfg.onCancel,
    });
  }, []);

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

  // Refrescar cuando el doctor aprueba o rechaza una cita desde la campana de notificaciones
  useEffect(() => {
    const handler = () => loadCitas();
    window.addEventListener("cita-portal-accionada", handler);
    return () => window.removeEventListener("cita-portal-accionada", handler);
  }, [loadCitas]);

  const loadSalaEspera = useCallback(() => {
    api.get("/dashboard/sala-espera", { params: { fecha: dayjs().format("YYYY-MM-DD") } })
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
      showFeedback({ type: "error", title: "No se pudo reprogramar", message: err.response?.data?.msg || "Error al reprogramar" });
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

  const verHistoriaClinica = () => {
    const pacienteId = selEvent?.resource?.paciente_id;
    if (!pacienteId) return;
    setShowDet(false);
    navigate(`/pacientes/${pacienteId}/perfil?tab=historial`);
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
      .catch(err => showFeedback({ type: "error", title: "No se pudo cambiar estado", message: err.response?.data?.msg || "Error" }));
  };

  const cancelarCita = () => {
    showFeedback({
      type: "warning",
      title: "Cancelar cita",
      message: "¿Seguro que deseas cancelar esta cita?",
      showCancel: true,
      confirmText: "Sí, cancelar",
      onConfirm: async () => {
        setFeedbackModal((m) => ({ ...m, open: false }));
        try {
          await api.delete(`/citas/${selEvent.id}`);
          setEvents(prev => prev.filter(e => e.id !== selEvent.id));
          setShowDet(false);
          loadSalaEspera();
        } catch (err) {
          showFeedback({ type: "error", title: "No se pudo cancelar", message: err.response?.data?.msg || "Error" });
        }
      },
      onCancel: () => setFeedbackModal((m) => ({ ...m, open: false })),
    });
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
      .catch(err => showFeedback({ type: "error", title: "No se pudo eliminar", message: err.response?.data?.msg || "Error al eliminar" }));
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
    const medico = nombreMedico(c) || `${c.medico_nombres || ""} ${c.medico_apellidos || ""}`.trim();
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
    if (!c.paciente_id) {
      showFeedback({ type: "warning", title: "Paciente no disponible", message: "No se encontró paciente para esta cita" });
      return;
    }
    if (!reminderForm.contenido?.trim()) {
      showFeedback({ type: "warning", title: "Falta contenido", message: "Escribe el contenido del recordatorio" });
      return;
    }
    setSendingReminder(true);
    try {
      await api.post("/recordatorios/enviar-manual", {
        paciente_id: c.paciente_id,
        canal: reminderForm.canal,
        asunto: reminderForm.asunto,
        contenido: reminderForm.contenido,
      });
      setShowReminder(false);
      showFeedback({
        type: "success",
        title: "Recordatorio enviado",
        message: `Recordatorio ${reminderForm.canal} enviado correctamente`,
      });
    } catch (err) {
      showFeedback({ type: "error", title: "Error al enviar recordatorio", message: err.response?.data?.error || "Error al enviar recordatorio" });
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      <style>{`
        .event-hover:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(0,0,0,0.18) !important;
          opacity: 0.97;
          z-index: 5;
        }

        /* ── Contenedor general del calendario ─────────────────────── */
        .rbc-calendar { font-family: inherit; }
        .rbc-month-view, .rbc-time-view {
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          overflow-y: auto;
        }
        .rbc-off-range-bg { background: #f8fafc !important; }
        .rbc-today { background-color: rgba(37, 99, 235, 0.05) !important; }

        /* ── Encabezados de día ─────────────────────────────────────── */
        .rbc-header {
          padding: 10px 6px !important;
          font-weight: 700 !important;
          font-size: 0.78rem !important;
          color: #334155 !important;
          background: #f8fafc !important;
          border-bottom: 1px solid #e2e8f0 !important;
          text-transform: capitalize;
        }
        .rbc-time-header-content, .rbc-time-content, .rbc-month-row, .rbc-day-bg {
          border-color: #e2e8f0 !important;
        }
        .rbc-time-gutter .rbc-timeslot-group,
        .rbc-time-gutter .rbc-time-slot {
          font-size: 0.72rem !important;
          color: #64748b !important;
        }
        .rbc-current-time-indicator {
          background-color: #ef4444 !important;
          height: 2px !important;
        }

        /* ── Interacción sobre celdas vacías ────────────────────────── */
        .rbc-time-slot:hover {
          background-color: rgba(59, 130, 246, 0.06) !important;
          cursor: pointer;
        }
        .rbc-month-view .rbc-day-bg:hover {
          background-color: rgba(59, 130, 246, 0.04) !important;
          cursor: pointer;
        }
        .rbc-month-row { min-height: 90px; }

        /* ── Eventos: vista Mes (compactos, muchos por celda) ───────── */
        .rbc-month-view .rbc-event {
          padding: 2px 6px !important;
          font-size: 0.72rem !important;
          line-height: 1.3 !important;
        }
        .rbc-month-view .rbc-event-content { font-size: 0.72rem !important; }
        .rbc-row-segment { padding: 1px 2px; }

        /* ── Eventos: vistas Semana / Día (más espacio, deben leerse bien) */
        .rbc-time-view .rbc-timeslot-group { min-height: 64px !important; }
        .rbc-time-view .rbc-event {
          padding: 3px 7px !important;
          line-height: 1.3 !important;
          box-shadow: 0 1px 3px rgba(0,0,0,.12) !important;
          overflow: hidden !important;
        }
        .rbc-time-view .rbc-event-label {
          font-size: 0.7rem !important;
          font-weight: 700 !important;
          opacity: 0.85;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .rbc-time-view .rbc-event-content {
          font-size: 0.8rem !important;
          font-weight: 700 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .rbc-day-slot .rbc-events-container { margin-right: 4px; }

        /* ── Vista Agenda ────────────────────────────────────────────── */
        .rbc-agenda-view table.rbc-agenda-table { font-size: 0.85rem; }
        .rbc-agenda-view table.rbc-agenda-table thead > tr > th {
          background: #f8fafc; color: #334155; font-weight: 700;
          padding: 8px 10px !important; border-bottom: 1px solid #e2e8f0 !important;
          text-transform: capitalize;
        }
        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
          padding: 8px 10px !important; border-color: #f1f5f9 !important;
        }

        /* ── Barra de herramientas (Hoy/Anterior/Siguiente/Mes/Semana...) */
        .rbc-toolbar { margin-bottom: 14px !important; }
        .rbc-toolbar-label {
          font-weight: 700 !important;
          font-size: 0.98rem !important;
          color: #1e293b !important;
          text-transform: capitalize;
        }
        .rbc-toolbar button {
          font-size: 0.83rem !important;
          padding: 5px 13px !important;
          border-radius: 7px !important;
          border-color: #e2e8f0 !important;
          color: #334155 !important;
          transition: all .15s ease;
        }
        .rbc-toolbar button:hover {
          background: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
        }
        .rbc-toolbar button.rbc-active {
          background: #2563eb !important;
          color: #fff !important;
          border-color: #2563eb !important;
          box-shadow: 0 1px 4px rgba(37,99,235,.35) !important;
        }
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
                        onClick={() => { setFilterMed(String(m.id)); setFilterMedText(nombreMedico(m)); setShowMedList(false); }}>
                        <strong>{nombreMedico(m)}</strong>
                        {tituloMedicoActivo() && m.especialidad && <span className="text-muted ms-1">— {m.especialidad}</span>}
                      </li>
                    ))}
                  </ul>
                ) : null;
              })()}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto", alignItems: "center" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4, marginRight: 2 }}>
                Estados
              </span>
              {ESTADOS.map(est => (
                <span key={est} style={{
                  background: ESTADO_COLOR[est].bg, color: ESTADO_COLOR[est].fg,
                  borderRadius: 20, padding: "3px 10px", fontSize: "0.69rem", fontWeight: 700,
                  display: "inline-flex", alignItems: "center", gap: 5,
                  border: `1px solid ${ESTADO_COLOR[est].dot}33`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: ESTADO_COLOR[est].dot, display: "inline-block" }}></span>
                  {est}
                </span>
              ))}
            </div>
          </div>
          {loading && <div style={{ fontSize: "0.82rem", color: "#9ca3af", marginBottom: 8 }}>Cargando citas...</div>}
          <div style={{
            height: "calc(100vh - 310px)", minHeight: 650,
            background: "#fff", borderRadius: 10,
          }}>
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
                week: { event: TimeGridEventContent },
                day:  { event: TimeGridEventContent },
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
          onVerHistoria={verHistoriaClinica}
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

      <AnimatedFeedbackModal
        open={feedbackModal.open}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        confirmText={feedbackModal.confirmText}
        cancelText={feedbackModal.cancelText}
        showCancel={feedbackModal.showCancel}
        onConfirm={feedbackModal.onConfirm || (() => setFeedbackModal((m) => ({ ...m, open: false })))}
        onCancel={feedbackModal.onCancel || (() => setFeedbackModal((m) => ({ ...m, open: false })))}
      />
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
        <div style={{ fontSize: "0.85rem", color: "#374151", fontWeight: 600 }}>{nombreMedico(c)}</div>
        {tituloMedicoActivo() && <div style={{ fontSize: "0.74rem", color: "#9ca3af", marginTop: 2 }}>{c.especialidad}</div>}
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

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 1055,
      background: "rgba(15,23,42,.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 500, background: "#fff",
        borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        maxHeight: "calc(100vh - 40px)",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #213564 0%, #1a2744 100%)",
          padding: "14px 18px", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="bi bi-calendar-plus" style={{ color: "#93c5fd", fontSize: "1.1rem" }}></i>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Nueva Cita</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1, fontSize: "0.85rem" }}>
            {err && <div className="alert alert-danger py-1 px-2 mb-3" style={{ fontSize: "0.8rem", borderRadius: 8 }}><i className="bi bi-exclamation-triangle me-1"></i>{err}</div>}

            <div className="row g-2">
              {/* Paciente */}
              <div className="col-12 position-relative">
                <label className="form-label fw-semibold small mb-1">Paciente</label>
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
                <label className="form-label fw-semibold small mb-1">Médico</label>
                <select className="form-select form-select-sm" value={form.medico_id}
                  onChange={e => setForm(f => ({ ...f, medico_id: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {medicos.map(m => (
                    <option key={m.id} value={m.id}>
                      {nombreMedico(m, { conEspecialidad: true })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-4">
                <label className="form-label fw-semibold small mb-1">Fecha</label>
                <input type="date" className="form-control form-control-sm" value={fechaSel}
                  onChange={e => setFechaSel(e.target.value)} />
              </div>

              {/* Slots */}
              {slots.length > 0 && (
                <div className="col-12">
                  <label className="form-label fw-semibold small mb-1">Horarios disponibles</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {slots.map(s => {
                      const isSel = slotSel === s.inicio;
                      return (
                        <button key={s.inicio} type="button"
                          onClick={() => selSlot(s)}
                          style={{
                            padding: "4px 11px", borderRadius: 8, fontSize: "0.75rem",
                            fontWeight: isSel ? 700 : 500, cursor: "pointer",
                            border: `1.5px solid ${isSel ? "#213564" : "#d1d5db"}`,
                            background: isSel ? "#dbeafe" : "#f9fafb",
                            color: isSel ? "#213564" : "#374151",
                            transition: "all .12s",
                          }}>
                          {dayjs(s.inicio).format("h:mm A")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {form.medico_id && fechaSel && slots.length === 0 && (
                <div className="col-12">
                  <small className="text-muted"><i className="bi bi-calendar-x me-1"></i>Sin horarios disponibles. Ingresa hora manualmente.</small>
                </div>
              )}

              {/* Horas */}
              <div className="col-6">
                <TimePicker12h label="Hora inicio" value={horaInicio} onChange={setHoraInicio} required />
              </div>
              <div className="col-6">
                <TimePicker12h label="Hora fin" value={horaFin} onChange={setHoraFin} required />
              </div>

              {/* Tipo + Canal + Motivo */}
              <div className="col-4">
                <label className="form-label fw-semibold small mb-1">Tipo</label>
                <select className="form-select form-select-sm" value={form.tipo_consulta}
                  onChange={e => setForm(f => ({ ...f, tipo_consulta: e.target.value }))}>
                  {tiposConsulta.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-4">
                <label className="form-label fw-semibold small mb-1">Canal</label>
                <select className="form-select form-select-sm" value={form.canal}
                  onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}>
                  {["RECEPCION","APP","TELEFONO","WEB"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-4">
                <label className="form-label fw-semibold small mb-1">Motivo</label>
                <input className="form-control form-control-sm" value={form.motivo}
                  onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-sm" disabled={saving}
              style={{ background: "linear-gradient(135deg, #213564, #1a2744)", color: "#fff", border: "none", fontWeight: 600, borderRadius: 8, padding: "6px 20px" }}>
              <i className="bi bi-calendar-check me-1"></i>{saving ? "Guardando…" : "Crear Cita"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal Detalle Cita ───────────────────────────────────────────────────────
function ModalDetalle({ event, onClose, onEstado, onCancelar, onMostrarConfirmDelete, onEditar, onRecordatorio, onVerHistoria }) {
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
  const [fotoOpen, setFotoOpen] = useState(false);
  const foto = fotoUrl(c.paciente_foto_perfil);

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(10,18,35,.72)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <style>{`
        .dcm-wrap {
          width: 100%; max-width: 560px;
          border-radius: 18px; overflow: hidden;
          box-shadow: 0 32px 72px rgba(0,0,0,.5);
          background: #fff;
          display: flex; flex-direction: column;
          max-height: calc(100vh - 40px);
          animation: dcm-in .18s ease;
        }
        @keyframes dcm-in {
          from { opacity: 0; transform: translateY(12px) scale(.97); }
          to   { opacity: 1; transform: none; }
        }
        .dcm-header {
          background: linear-gradient(135deg, #162236 0%, #1e3a60 100%);
          padding: 20px 22px 18px;
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          flex-shrink: 0;
        }
        .dcm-header-sup {
          font-size: 10px; font-weight: 700; letter-spacing: 1.4px;
          text-transform: uppercase; color: rgba(255,255,255,.45); margin-bottom: 4px;
        }
        .dcm-patient-name {
          font-size: 17px; font-weight: 700; color: #fff; line-height: 1.25;
          margin-bottom: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .dcm-header-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .dcm-estado-pill {
          font-size: 10px; font-weight: 800; letter-spacing: .7px;
          padding: 3px 11px; border-radius: 20px; display: inline-block;
        }
        .dcm-chip {
          font-size: 11px; color: rgba(255,255,255,.65);
          background: rgba(255,255,255,.1); border-radius: 20px;
          padding: 3px 10px; display: flex; align-items: center; gap: 4px;
        }
        .dcm-close {
          background: rgba(255,255,255,.1); border: none; color: #fff;
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; transition: background .15s; font-size: 13px;
          margin-top: 2px;
        }
        .dcm-close:hover { background: rgba(255,255,255,.22); }
        .dcm-body { padding: 18px 22px; overflow-y: auto; flex: 1; }
        .dcm-section-label {
          font-size: 9px; font-weight: 800; letter-spacing: 1.2px;
          text-transform: uppercase; color: #94a3b8; margin-bottom: 10px;
        }
        .dcm-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;
        }
        .dcm-card {
          background: #f8fafc; border-radius: 10px; padding: 9px 12px;
          border: 1px solid #e2e8f0;
        }
        .dcm-card.full { grid-column: 1 / -1; }
        .dcm-card-label {
          font-size: 9px; font-weight: 700; letter-spacing: .9px;
          text-transform: uppercase; color: #94a3b8; margin-bottom: 2px;
          display: flex; align-items: center; gap: 4px;
        }
        .dcm-card-val { font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1.3; }
        .dcm-card-sub { font-size: 11px; color: #64748b; margin-top: 1px; }
        .dcm-card-val.muted { color: #94a3b8; font-weight: 400; font-style: italic; }
        .dcm-patient-card {
          background: linear-gradient(135deg, #f0f5ff, #f8faff);
          border-radius: 11px; padding: 10px 14px;
          border: 1px solid #dbeafe; margin-bottom: 14px;
        }
        .dcm-patient-chips { display: flex; gap: 5px; flex-wrap: wrap; }
        .dcm-p-chip {
          font-size: 10px; font-weight: 600; padding: 1px 8px;
          border-radius: 20px; display: flex; align-items: center; gap: 3px;
        }
        .dcm-p-chip.age { background: #e0e7ff; color: #3730a3; }
        .dcm-p-chip.loc { background: #dcfce7; color: #166534; }
        .dcm-estado-box {
          background: #f0f9ff; border: 1px solid #bae6fd;
          border-radius: 11px; padding: 11px 14px; margin-bottom: 4px;
        }
        .dcm-estado-box-label {
          font-size: 9px; font-weight: 800; letter-spacing: 1px;
          text-transform: uppercase; color: #0369a1; margin-bottom: 8px;
          display: flex; align-items: center; gap: 5px;
        }
        .dcm-estado-btns { display: flex; gap: 6px; flex-wrap: wrap; }
        .dcm-est-btn {
          font-size: 11px; font-weight: 700; letter-spacing: .4px;
          padding: 5px 14px; border-radius: 20px; border: none;
          cursor: pointer; transition: opacity .15s, transform .1s;
        }
        .dcm-est-btn:hover { opacity: .82; transform: translateY(-1px); }
        .dcm-footer {
          padding: 11px 22px 14px; border-top: 1px solid #e2e8f0;
          display: flex; gap: 7px; align-items: center; flex-wrap: wrap;
          background: #f8fafc; flex-shrink: 0;
        }
        .dcm-footer-danger-row { display: contents; }
        .dcm-footer-right { display: flex; gap: 7px; flex: 1; justify-content: flex-end; flex-wrap: wrap; }
        .dcm-btn {
          font-size: 12px; font-weight: 600; padding: 7px 13px;
          border-radius: 8px; border: none; cursor: pointer;
          display: flex; align-items: center; gap: 5px;
          transition: all .15s; white-space: nowrap; line-height: 1;
        }
        .dcm-btn:hover { transform: translateY(-1px); }
        .dcm-btn-icon {
          font-size: 12px; font-weight: 600; padding: 7px 10px;
          border-radius: 8px; border: none; cursor: pointer;
          display: flex; align-items: center; gap: 4px;
          transition: all .15s; white-space: nowrap;
        }
        .dcm-btn-icon:hover { transform: translateY(-1px); }
        .dcm-danger-icon { background: #fff0f0; color: #dc2626; border: 1px solid #fecaca; }
        .dcm-danger-icon:hover { background: #fee2e2; }
        .dcm-cancel-btn { background: #fff8f0; color: #c2410c; border: 1px solid #fed7aa; }
        .dcm-cancel-btn:hover { background: #ffedd5; }
        .dcm-ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
        .dcm-ghost:hover { background: #f1f5f9; }
        .dcm-primary { background: #1e40af; color: #fff; }
        .dcm-primary:hover { background: #1d3fa3; }
        .dcm-dark { background: #1e293b; color: #fff; }
        .dcm-dark:hover { background: #0f172a; }
        @media (max-width: 600px) {
          .dcm-card.full { grid-column: 1 / -1; }
          .dcm-header { padding: 16px 16px 14px; }
          .dcm-body { padding: 14px 16px; }
          .dcm-patient-name { font-size: 15px; }
          .dcm-footer {
            padding: 10px 16px 14px;
            flex-direction: column;
            gap: 8px;
          }
          .dcm-footer-danger-row {
            display: flex;
            gap: 8px;
            width: 100%;
          }
          .dcm-footer-danger-row .dcm-btn-icon {
            flex: 1;
            justify-content: center;
          }
          .dcm-footer-right {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            width: 100%;
          }
          .dcm-footer-right .dcm-btn { justify-content: center; }
          .dcm-footer-right .dcm-dark { grid-column: 1 / -1; }
        }
      `}</style>

      <div className="dcm-wrap">
        {/* Lightbox foto paciente */}
        {fotoOpen && foto && createPortal(
          <div onClick={() => setFotoOpen(false)} style={{
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 10000,
            background: "rgba(0,0,0,.85)", display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "zoom-out",
          }}>
            <button onClick={() => setFotoOpen(false)} style={{
              position: "absolute", top: 20, right: 20,
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,.15)", border: "2px solid rgba(255,255,255,.3)",
              color: "#fff", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(4px)", transition: "background .15s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.28)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.15)"}
            >
              <i className="bi bi-x-lg"></i>
            </button>
            <img src={foto} alt="Foto paciente"
              style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,.6)", objectFit: "contain" }} />
          </div>,
          document.body
        )}

        {/* Header */}
        <div className="dcm-header">
          {/* Avatar con foto — clickeable */}
          <button
            onClick={() => foto && setFotoOpen(true)}
            title={foto ? "Ver foto del paciente" : "Sin foto registrada"}
            style={{
              width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
              border: foto ? "2px solid rgba(255,255,255,.4)" : "2px dashed rgba(255,255,255,.2)",
              background: foto ? "transparent" : "linear-gradient(135deg,#2563eb,#1d4ed8)",
              backgroundImage: foto ? `url(${foto})` : "none",
              backgroundSize: "cover", backgroundPosition: "center",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 18, fontWeight: 700,
              cursor: foto ? "zoom-in" : "default",
              padding: 0, overflow: "hidden",
              transition: "border-color .2s, transform .15s",
            }}
            onMouseEnter={e => { if (foto) e.currentTarget.style.transform = "scale(1.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            {!foto && (c.paciente_apellidos || "?")[0].toUpperCase()}
          </button>

          <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
            <div className="dcm-header-sup">Detalle de Cita</div>
            <div className="dcm-patient-name">
              {c.paciente_apellidos} {c.paciente_nombres}
            </div>
            <div className="dcm-header-chips">
              <span className="dcm-estado-pill" style={{ background: color.bg, color: color.fg }}>
                {c.estado.replace(/_/g, " ")}
              </span>
              {c.paciente_ciudad && (
                <span className="dcm-chip">
                  <i className="bi bi-geo-alt-fill"></i>{c.paciente_ciudad}
                </span>
              )}
              <span className="dcm-chip">
                <i className="bi bi-calendar2"></i>{dayjs(c.inicio).format("DD/MM/YYYY")}
              </span>
            </div>
          </div>
          <button className="dcm-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div className="dcm-body">
          {/* Info rápida del paciente — sin repetir el nombre */}
          <div className="dcm-patient-card">
            <div className="dcm-patient-chips" style={{ margin: 0 }}>
              {c.paciente_fecha_nac && (
                <span className="dcm-p-chip age">
                  <i className="bi bi-person"></i>
                  {dayjs().diff(dayjs(c.paciente_fecha_nac), "year")} años
                </span>
              )}
              {(c.paciente_ciudad || c.paciente_departamento) && (
                <span className="dcm-p-chip loc">
                  <i className="bi bi-geo-alt"></i>
                  {[c.paciente_ciudad, c.paciente_departamento].filter(Boolean).join(", ")}
                </span>
              )}
              {c.paciente_tel && (
                <span className="dcm-p-chip" style={{ background: "#f0fdf4", color: "#166534" }}>
                  <i className="bi bi-telephone"></i>{c.paciente_tel}
                </span>
              )}
              {!foto && (
                <span className="dcm-p-chip" style={{ background: "#fef9c3", color: "#854d0e" }}>
                  <i className="bi bi-camera"></i> Sin foto
                </span>
              )}
            </div>
          </div>

          {/* Info grid */}
          <div className="dcm-section-label">Información de la cita</div>
          <div className="dcm-grid">
            <div className="dcm-card">
              <div className="dcm-card-label"><i className="bi bi-calendar-event"></i> Inicio</div>
              <div className="dcm-card-val">{dayjs(c.inicio).format("DD/MM/YYYY")}</div>
              <div className="dcm-card-sub">{dayjs(c.inicio).format("h:mm A")}</div>
            </div>
            <div className="dcm-card">
              <div className="dcm-card-label"><i className="bi bi-clock"></i> Fin</div>
              <div className="dcm-card-val">{dayjs(c.fin).format("h:mm A")}</div>
            </div>
            <div className="dcm-card">
              <div className="dcm-card-label"><i className="bi bi-clipboard2-pulse"></i> Tipo</div>
              <div className="dcm-card-val">{c.tipo_consulta}</div>
            </div>
            <div className="dcm-card">
              <div className="dcm-card-label"><i className="bi bi-send"></i> Canal</div>
              <div className="dcm-card-val">{c.canal}</div>
            </div>
            <div className="dcm-card full">
              <div className="dcm-card-label"><i className="bi bi-person-badge"></i> Médico</div>
              <div className="dcm-card-val">{nombreMedico(c)}</div>
            </div>
            <div className="dcm-card full">
              <div className="dcm-card-label"><i className="bi bi-chat-text"></i> Motivo</div>
              <div className={`dcm-card-val${!c.motivo ? " muted" : ""}`}>
                {c.motivo || "Sin motivo registrado"}
              </div>
            </div>
          </div>

          {/* Cambiar estado */}
          {acciones.length > 0 && (
            <div className="dcm-estado-box">
              <div className="dcm-estado-box-label">
                <i className="bi bi-arrow-repeat"></i> Cambiar estado
              </div>
              <div className="dcm-estado-btns">
                {acciones.map(est => (
                  <button key={est} className="dcm-est-btn"
                    style={{ background: ESTADO_COLOR[est].bg, color: ESTADO_COLOR[est].fg }}
                    onClick={() => onEstado(est)}>
                    {est.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dcm-footer">
          {/* Fila peligrosa: trash + cancelar juntos */}
          <div className="dcm-footer-danger-row">
            <button className="dcm-btn-icon dcm-danger-icon" onClick={onMostrarConfirmDelete} title="Eliminar permanentemente">
              <i className="bi bi-trash3"></i>
            </button>
            {c.estado !== "CANCELADA" && c.estado !== "COMPLETADA" && (
              <button className="dcm-btn-icon dcm-cancel-btn" onClick={onCancelar}>
                <i className="bi bi-x-circle"></i> Cancelar
              </button>
            )}
          </div>

          {/* Acciones principales — derecha en desktop, grid en móvil */}
          <div className="dcm-footer-right">
            <button className="dcm-btn dcm-ghost" onClick={onRecordatorio}>
              <i className="bi bi-bell"></i> Recordatorio
            </button>
            <button className="dcm-btn dcm-ghost" onClick={onVerHistoria}>
              <i className="bi bi-journal-medical"></i> Historia
            </button>
            {c.estado === "PENDIENTE" && (
              <button className="dcm-btn dcm-primary" onClick={onEditar}>
                <i className="bi bi-pencil"></i> Editar
              </button>
            )}
            <button className="dcm-btn dcm-dark" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModalRecordatorioManual({ event, form, loading, sending, onClose, onCanalChange, onChange, onSend }) {
  const c = event.resource || {};
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 10002,
      background: "rgba(15,23,42,.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 620, background: "#fff",
        borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        maxHeight: "calc(100vh - 40px)",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #213564 0%, #1a2744 100%)",
          padding: "14px 18px", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="bi bi-bell-fill" style={{ color: "#93c5fd", fontSize: "1.1rem" }}></i>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Recordatorio manual</div>
              <div style={{ color: "rgba(255,255,255,.65)", fontSize: "0.75rem" }}>
                {c.paciente_nombres} {c.paciente_apellidos}
              </div>
            </div>
          </div>
          <button onClick={onClose} disabled={sending}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold small">Canal</label>
              <select className="form-select form-select-sm" value={form.canal}
                onChange={(e) => onCanalChange(e.target.value)} disabled={loading || sending}>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>
            {form.canal === "EMAIL" && (
              <div className="col-md-8">
                <label className="form-label fw-semibold small">Asunto</label>
                <input className="form-control form-control-sm" value={form.asunto}
                  onChange={(e) => onChange({ asunto: e.target.value })} disabled={loading || sending} />
              </div>
            )}
            <div className="col-12">
              <label className="form-label fw-semibold small">Mensaje</label>
              <textarea className="form-control form-control-sm" rows={8} value={form.contenido}
                onChange={(e) => onChange({ contenido: e.target.value })} disabled={loading || sending} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={sending}>Cancelar</button>
          <button className="btn btn-sm" onClick={onSend} disabled={loading || sending}
            style={{ background: "linear-gradient(135deg, #213564, #1a2744)", color: "#fff", border: "none", fontWeight: 600, borderRadius: 8, padding: "6px 20px" }}>
            <i className="bi bi-send me-1"></i>{sending ? "Enviando…" : "Enviar ahora"}
          </button>
        </div>
      </div>
    </div>,
    document.body
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

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 10002,
      background: "rgba(15,23,42,.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 580, background: "#fff",
        borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        maxHeight: "calc(100vh - 40px)",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #213564 0%, #1a2744 100%)",
          padding: "14px 18px", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="bi bi-pencil-square" style={{ color: "#93c5fd", fontSize: "1.1rem" }}></i>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Editar Cita</div>
              <div style={{ color: "rgba(255,255,255,.65)", fontSize: "0.75rem" }}>
                {c.paciente_nombres} {c.paciente_apellidos}
              </div>
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
            {err && <div className="alert alert-danger py-2 mb-3" style={{ borderRadius: 8, fontSize: "0.85rem" }}><i className="bi bi-exclamation-triangle me-1"></i>{err}</div>}

            <div className="row g-3">
              <div className="col-12">
                <label className="form-label fw-semibold small">Paciente</label>
                <div style={{ padding: "8px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e5e7eb" }}>
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
                <label className="form-label fw-semibold small">Médico</label>
                <select className="form-select form-select-sm" value={form.medico_id}
                  onChange={e => setForm(f => ({ ...f, medico_id: e.target.value }))}>
                  {medicos.map(m => (
                    <option key={m.id} value={String(m.id)}>
                      {nombreMedico(m, { conEspecialidad: true })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold small">Fecha</label>
                <input type="date" className="form-control form-control-sm" value={fechaSel}
                  onChange={e => setFechaSel(e.target.value)} required />
              </div>

              <div className="col-md-6">
                <TimePicker12h label="Hora inicio" value={horaInicio} onChange={setHoraInicio} required />
              </div>
              <div className="col-md-6">
                <TimePicker12h label="Hora fin" value={horaFin} onChange={setHoraFin} required />
              </div>

              <div className="col-md-4">
                <label className="form-label fw-semibold small">Tipo</label>
                <select className="form-select form-select-sm" value={form.tipo_consulta}
                  onChange={e => setForm(f => ({ ...f, tipo_consulta: e.target.value }))}>
                  {tiposConsulta.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold small">Canal</label>
                <select className="form-select form-select-sm" value={form.canal}
                  onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}>
                  {["RECEPCION","APP","TELEFONO","WEB"].map(ch => <option key={ch}>{ch}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold small">Motivo</label>
                <input className="form-control form-control-sm" value={form.motivo}
                  onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                  placeholder="Opcional" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-sm" disabled={saving}
              style={{ background: "linear-gradient(135deg, #213564, #1a2744)", color: "#fff", border: "none", fontWeight: 600, borderRadius: 8, padding: "6px 20px" }}>
              <i className="bi bi-floppy me-1"></i>{saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal Confirmación Eliminar ──────────────────────────────────────────────
function ModalConfirmDelete({ onConfirm, onCancel, pacienteNombre, fecha }) {
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 10001,
      background: "rgba(15,23,42,.65)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 460, background: "#fff",
        borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,.3)",
        overflow: "hidden",
      }}>
        {/* Header danger */}
        <div style={{
          background: "linear-gradient(135deg, #b91c1c, #dc2626)",
          padding: "14px 18px", display: "flex", alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="bi bi-exclamation-triangle-fill" style={{ color: "#fecaca", fontSize: "1.1rem" }}></i>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Confirmar eliminación permanente</div>
          </div>
          <button onClick={onCancel}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px" }}>
          <div className="alert alert-warning py-2 mb-3" style={{ borderRadius: 8, fontSize: "0.85rem" }}>
            <strong>⚠️ ADVERTENCIA:</strong> Esta acción eliminará permanentemente el registro de la base de datos y <strong>no se puede deshacer</strong>.
          </div>
          <p className="mb-2" style={{ fontSize: "0.9rem" }}><strong>Paciente:</strong> {pacienteNombre}</p>
          <p className="mb-3" style={{ fontSize: "0.9rem" }}><strong>Fecha:</strong> {fecha}</p>
          <p className="text-muted mb-0" style={{ fontSize: "0.82rem" }}>
            Si solo deseas cancelar la cita sin eliminar el registro, usa el botón "Cancelar cita" en su lugar.
          </p>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={onCancel}>
            <i className="bi bi-x-circle me-1"></i>No, volver
          </button>
          <button className="btn btn-sm btn-danger" onClick={onConfirm}
            style={{ fontWeight: 600, borderRadius: 8, padding: "6px 18px" }}>
            <i className="bi bi-trash3-fill me-1"></i>Sí, eliminar permanentemente
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
