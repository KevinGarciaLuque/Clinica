import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import api from "../api/api";
import { tituloMedicoActivo } from "../utils/medico";

const TABS = [
  { id: "citas",      label: "Citas de hoy",       icon: "bi-calendar2-check-fill" },
  { id: "finalizada", label: "Consulta finalizada", icon: "bi-check2-circle" },
];

const ESTADO_CITA = {
  PENDIENTE:   { label: "Pendiente",  color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: "bi-hourglass-split" },
  CONFIRMADA:  { label: "Confirmada", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: "bi-calendar2-check" },
  EN_ESPERA:   { label: "En espera",  color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", icon: "bi-people-fill" },
  EN_ATENCION: { label: "En consulta",color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", icon: "bi-heart-pulse-fill" },
  COMPLETADA:  { label: "Atendido",   color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", icon: "bi-check2-circle" },
};

// Columna de la derecha: qué mostrar/hacer según el estado de la cita
function AccionCita({ cita, admitiendo, onAdmitir }) {
  const est = ESTADO_CITA[cita.estado] || { label: cita.estado, color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", icon: "bi-question-circle" };

  if (cita.estado === "PENDIENTE" || cita.estado === "CONFIRMADA") {
    return (
      <button
        className="btn btn-success btn-sm"
        disabled={admitiendo === cita.id}
        style={{ fontSize: "0.75rem", borderRadius: 7, fontWeight: 700 }}
        onClick={() => onAdmitir(cita.id)}
      >
        <i className="bi bi-box-arrow-in-right me-1" />
        {admitiendo === cita.id ? "Admitiendo..." : "Admitir"}
      </button>
    );
  }

  if (cita.estado === "EN_ATENCION") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: est.bg, color: est.color, border: `1px solid ${est.border}`,
        borderRadius: 20, padding: "5px 12px", fontSize: "0.75rem", fontWeight: 700,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: est.color, animation: "recepcion-pulse 1.4s ease-in-out infinite" }} />
        Con el médico
      </span>
    );
  }

  if (cita.estado === "COMPLETADA") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: est.bg, color: est.color, border: `1px solid ${est.border}`,
        borderRadius: 20, padding: "5px 12px", fontSize: "0.75rem", fontWeight: 600,
      }}>
        <i className="bi bi-check2-circle" />
        Consulta finalizada
      </span>
    );
  }

  // EN_ESPERA u otro estado no accionable desde aquí
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: est.bg, color: est.color, border: `1px solid ${est.border}`,
      borderRadius: 20, padding: "5px 12px", fontSize: "0.75rem", fontWeight: 700,
    }}>
      <i className="bi bi-hourglass-split" />
      En sala de espera
    </span>
  );
}

async function imprimirPdf(url) {
  try {
    const r = await api.get(url, { responseType: "blob" });
    window.open(URL.createObjectURL(new Blob([r.data], { type: "application/pdf" })), "_blank");
  } catch {
    alert("Error al generar PDF");
  }
}

function BotonPdf({ url }) {
  return (
    <button
      className="btn btn-outline-primary btn-sm"
      style={{ fontSize: "0.75rem", borderRadius: 7 }}
      onClick={() => imprimirPdf(url)}
    >
      <i className="bi bi-printer me-1" />PDF
    </button>
  );
}

// Cajita de una receta o estudio ligado a una cita, dentro de la fila del paciente
function EnvioInline({ envio, aceptando, onAceptar }) {
  const esReceta = envio.tipo === "receta";
  const key = `${esReceta ? "r" : "e"}${envio.id}`;
  const bg = esReceta ? "#eff6ff" : "#ecfeff";
  const border = esReceta ? "#bfdbfe" : "#a5f3fc";
  const color = esReceta ? "#1e40af" : "#0e7490";
  const icon = esReceta ? "bi-capsule-pill" : "bi-eyedropper";
  const titulo = esReceta ? `Receta · ${envio.total_items} medicamento(s)` : `Estudio · ${envio.tipo_estudio}`;
  const url = esReceta ? `/prescripciones/${envio.id}/pdf` : `/estudios/pdf?estudio_id=${envio.id}`;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "6px 10px" }}>
      <span style={{ fontSize: "0.78rem", color, fontWeight: 600 }}>
        <i className={`bi ${icon} me-2`} />{titulo}
        {envio.urgente === 1 && <span className="badge bg-danger ms-2" style={{ fontSize: "0.6rem" }}>URGENTE</span>}
      </span>
      <div className="d-flex align-items-center gap-1">
        <BotonPdf url={url} />
        {envio.recibido ? (
          <span className="badge bg-success" style={{ fontSize: "0.7rem" }}><i className="bi bi-check2-circle me-1" />Recibida</span>
        ) : (
          <button
            className="btn btn-success btn-sm"
            disabled={aceptando === key}
            style={{ fontSize: "0.75rem", borderRadius: 7 }}
            onClick={() => onAceptar(envio)}
          >
            <i className="bi bi-check-lg me-1" />
            {aceptando === key ? "Aceptando..." : "Aceptar"}
          </button>
        )}
      </div>
    </div>
  );
}

// Fila de un paciente/cita, con sus recetas/estudios ligados (si tiene)
function FilaCita({ cita, envios, admitiendo, onAdmitir, aceptando, onAceptar }) {
  const est = ESTADO_CITA[cita.estado] || { label: cita.estado, color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", icon: "bi-question-circle" };
  const atendido = cita.estado === "COMPLETADA";
  const hayEnvios = envios.length > 0;

  return (
    <div style={{
      background: atendido ? "#fafafa" : "#f8fafc",
      borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 16px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#3b82f6,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className="bi bi-person-fill" style={{ color: "#fff", fontSize: "0.9rem" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: "0.85rem" }}>
              {cita.paciente_nombres} {cita.paciente_apellidos}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: est.bg, color: est.color, border: `1px solid ${est.border}`,
                borderRadius: 20, padding: "2px 9px", fontSize: "0.68rem", fontWeight: 700,
              }}>
                <i className={`bi ${est.icon}`} style={{ fontSize: "0.7rem" }} />
                {est.label}
              </span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#334155" }}>
              {tituloMedicoActivo() ? "Dr(a). " : ""}{cita.medico_nombres} {cita.medico_apellidos}{tituloMedicoActivo() && cita.especialidad ? ` · ${cita.especialidad}` : ""}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 1 }}>
              {dayjs(cita.inicio).format("h:mm A")} · {cita.paciente_tel || "sin teléfono"}
            </div>
          </div>
        </div>
        <AccionCita cita={cita} admitiendo={admitiendo} onAdmitir={onAdmitir} />
      </div>

      {hayEnvios && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e2e8f0", display: "flex", flexDirection: "column", gap: 6 }}>
          {envios.map(envio => (
            <EnvioInline key={`${envio.tipo}${envio.id}`} envio={envio} aceptando={aceptando} onAceptar={onAceptar} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Recepcion() {
  const [tab, setTab] = useState("citas");
  const [citasHoy, setCitasHoy]     = useState([]);
  const [admitiendo, setAdmitiendo] = useState(null);
  const [pendientes, setPendientes] = useState({ recetas: [], estudios: [] });
  const [historial, setHistorial]   = useState({ recetas: [], estudios: [] });
  const [cargando, setCargando]     = useState(false);
  const [aceptando, setAceptando]   = useState(null);

  const cargarCitasHoy = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get("/dashboard/sala-espera", { params: { fecha: dayjs().format("YYYY-MM-DD") } });
      setCitasHoy(r.data.data || []);
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, []);

  const admitirCita = async (id) => {
    setAdmitiendo(id);
    try {
      await api.patch(`/citas/${id}/estado`, { estado: "EN_ESPERA" });
      setCitasHoy(prev => prev.map(c => c.id === id ? { ...c, estado: "EN_ESPERA" } : c));
    } catch { /* noop */ }
    finally { setAdmitiendo(null); }
  };

  // Pendientes e historial se cargan siempre en segundo plano (no solo al
  // entrar a su pestaña) para poder cruzarlos con la cita del paciente.
  const cargarPendientes = useCallback(async () => {
    try {
      const r = await api.get("/recepcion/pendientes");
      setPendientes(r.data.data || { recetas: [], estudios: [] });
    } catch { /* noop */ }
  }, []);

  const cargarHistorial = useCallback(async () => {
    try {
      const r = await api.get("/recepcion/historial");
      setHistorial(r.data.data || { recetas: [], estudios: [] });
    } catch { /* noop */ }
  }, []);

  useEffect(() => { cargarCitasHoy(); }, [cargarCitasHoy]);
  useEffect(() => { cargarPendientes(); }, [cargarPendientes]);
  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  // Refresco en tiempo real: NavbarApp dispara este evento al recibir por SSE
  // una notificación de receta/estudio enviado a recepción.
  useEffect(() => {
    const onNuevoEnvio = () => cargarPendientes();
    window.addEventListener("recepcion:nuevo-envio", onNuevoEnvio);
    return () => window.removeEventListener("recepcion:nuevo-envio", onNuevoEnvio);
  }, [cargarPendientes]);

  const aceptarEnvio = async (envio) => {
    const esReceta = envio.tipo === "receta";
    const key = `${esReceta ? "r" : "e"}${envio.id}`;
    setAceptando(key);
    try {
      await api.put(`/recepcion/${esReceta ? "recetas" : "estudios"}/${envio.id}/aceptar`);
      setPendientes(prev => ({
        ...prev,
        [esReceta ? "recetas" : "estudios"]: prev[esReceta ? "recetas" : "estudios"].filter(x => x.id !== envio.id),
      }));
      cargarHistorial();
    } catch { /* noop */ }
    finally { setAceptando(null); }
  };

  // Junta pendientes (sin aceptar) + historial (ya recibidos) en un solo
  // formato uniforme, para mostrarlos dentro de la fila de cada cita.
  const enviosPorCita = (citaId) => {
    const recetas = [
      ...pendientes.recetas.filter(r => r.cita_id === citaId).map(r => ({ ...r, tipo: "receta", recibido: false })),
      ...historial.recetas.filter(r => r.cita_id === citaId).map(r => ({ ...r, tipo: "receta", recibido: true })),
    ];
    const estudios = [
      ...pendientes.estudios.filter(s => s.cita_id === citaId).map(s => ({ ...s, tipo: "estudio", tipo_estudio: s.tipo, recibido: false })),
      ...historial.estudios.filter(s => s.cita_id === citaId).map(s => ({ ...s, tipo: "estudio", tipo_estudio: s.tipo, recibido: true })),
    ];
    return [...recetas, ...estudios];
  };

  const citasActivas    = citasHoy.filter(c => c.estado !== "COMPLETADA");
  const citasFinalizada = citasHoy.filter(c => c.estado === "COMPLETADA");
  const porAdmitir = citasActivas.filter(c => c.estado === "PENDIENTE" || c.estado === "CONFIRMADA").length;
  const totalPendientes = pendientes.recetas.length + pendientes.estudios.length;

  return (
    <div style={{ padding: "4px 0" }}>
      <style>{`
        @keyframes recepcion-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#3b82f6,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="bi bi-inbox-fill" style={{ color: "#fff", fontSize: 20 }} />
        </div>
        <div>
          <h5 style={{ margin: 0, fontWeight: 700 }}>Recepción</h5>
          <span style={{ fontSize: 13, color: "#64748b" }}>Admisión de pacientes, recetas y estudios enviados desde consulta</span>
        </div>
      </div>

      <ul className="nav nav-tabs mb-3">
        {TABS.map(t => (
          <li className="nav-item" key={t.id}>
            <button
              className={`nav-link ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              style={{ fontSize: "0.85rem", fontWeight: 600 }}
            >
              <i className={`bi ${t.icon} me-1`} />
              {t.label}
              {t.id === "citas" && porAdmitir > 0 && (
                <span className="badge bg-warning text-dark ms-2">{porAdmitir}</span>
              )}
              {t.id === "finalizada" && totalPendientes > 0 && (
                <span className="badge bg-danger ms-2">{totalPendientes}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {cargando && (
        <div className="text-center py-4">
          <span className="spinner-border spinner-border-sm" /> Cargando...
        </div>
      )}

      {!cargando && tab === "citas" && (
        <>
          {citasActivas.length === 0 && (
            <p className="text-muted small mb-3">No hay pacientes pendientes de llegar o en sala de espera.</p>
          )}
          {citasActivas.map(c => (
            <FilaCita
              key={c.id}
              cita={c}
              envios={enviosPorCita(c.id)}
              admitiendo={admitiendo}
              onAdmitir={admitirCita}
              aceptando={aceptando}
              onAceptar={aceptarEnvio}
            />
          ))}
        </>
      )}

      {!cargando && tab === "finalizada" && (
        <>
          {citasFinalizada.length === 0 && (
            <p className="text-muted small mb-3">Ningún paciente atendido todavía hoy.</p>
          )}
          {citasFinalizada.map(c => (
            <FilaCita
              key={c.id}
              cita={c}
              envios={enviosPorCita(c.id)}
              admitiendo={admitiendo}
              onAdmitir={admitirCita}
              aceptando={aceptando}
              onAceptar={aceptarEnvio}
            />
          ))}
        </>
      )}
    </div>
  );
}
