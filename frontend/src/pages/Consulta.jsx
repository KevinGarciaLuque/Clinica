import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/es";
import api from "../api/api";

dayjs.locale("es");

const ESTADO_COLOR = {
  PENDIENTE:   { bg: "#fef9c3", fg: "#854d0e",  dot: "#eab308" },
  CONFIRMADA:  { bg: "#dbeafe", fg: "#1e40af",  dot: "#3b82f6" },
  EN_ESPERA:   { bg: "#ede9fe", fg: "#5b21b6",  dot: "#8b5cf6" },
  EN_ATENCION: { bg: "#dcfce7", fg: "#166534",  dot: "#22c55e" },
  COMPLETADA:  { bg: "#f1f5f9", fg: "#475569",  dot: "#94a3b8" },
  CANCELADA:   { bg: "#fee2e2", fg: "#991b1b",  dot: "#ef4444" },
  NO_ASISTIO:  { bg: "#ffedd5", fg: "#9a3412",  dot: "#f97316" },
};

export default function Consulta() {
  const [activeTab, setActiveTab] = useState("citas-hoy");
  const [citasHoy, setCitasHoy] = useState([]);
  const [salaEspera, setSalaEspera] = useState([]);
  const [tieneRecepcionista, setTieneRecepcionista] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadCitasHoy = useCallback(() => {
    setLoading(true);
    const hoy = dayjs().format("YYYY-MM-DD");
    api.get("/citas", { params: { desde: hoy, hasta: hoy } })
      .then(r => {
        // Solo consultas ya iniciadas o finalizadas por el médico — mientras el
        // paciente solo está agendado/en espera, vive en la pestaña Sala de Espera.
        const iniciadas = (r.data.data || [])
          .filter(c => c.estado === "EN_ATENCION" || c.estado === "COMPLETADA")
          .sort((a, b) => {
            if (a.estado !== b.estado) return a.estado === "EN_ATENCION" ? -1 : 1;
            return new Date(a.inicio) - new Date(b.inicio);
          });
        setCitasHoy(iniciadas);
      })
      .catch(() => setCitasHoy([]))
      .finally(() => setLoading(false));
  }, []);

  const loadSalaEspera = useCallback(() => {
    setLoading(true);
    api.get("/dashboard/sala-espera", { params: { fecha: dayjs().format("YYYY-MM-DD") } })
      .then(r => {
        // Si la clínica tiene recepcionista, solo se muestran los pacientes que
        // recepción ya admitió (EN_ESPERA/EN_ATENCION). Sin recepcionista, el
        // médico ve directamente a todos los citados del día que aún no atendió.
        const conRecepcionista = !!r.data.tiene_recepcionista;
        setTieneRecepcionista(conRecepcionista);
        const activos = (r.data.data || [])
          .filter(c => conRecepcionista
            ? (c.estado === "EN_ESPERA" || c.estado === "EN_ATENCION")
            : c.estado !== "COMPLETADA")
          .sort((a, b) => {
            // EN_ATENCION primero (el médico ya está con ese paciente)
            if (a.estado !== b.estado) return a.estado === "EN_ATENCION" ? -1 : 1;
            // luego por hora de cita, el que lleva más tiempo esperando primero
            return new Date(a.inicio) - new Date(b.inicio);
          });
        setSalaEspera(activos);
      })
      .catch(() => setSalaEspera([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "citas-hoy") loadCitasHoy();
    else if (activeTab === "sala-espera") loadSalaEspera();
  }, [activeTab, loadCitasHoy, loadSalaEspera]);

  const cambiarEstado = (citaId, nuevoEstado) => {
    api.patch(`/citas/${citaId}/estado`, { estado: nuevoEstado })
      .then(() => {
        if (activeTab === "citas-hoy") loadCitasHoy();
        else loadSalaEspera();
      })
      .catch(err => alert(err.response?.data?.msg || "Error al cambiar estado"));
  };

  const TABS = [
    { id: "citas-hoy",   icon: "bi-clipboard2-pulse", label: "Consultas de hoy" },
    { id: "sala-espera", icon: "bi-person-lines-fill", label: "Sala de Espera" },
  ];

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
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
            <i className="bi bi-clipboard2-pulse-fill" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Consulta Médica</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>
              {dayjs().format("dddd D [de] MMMM [de] YYYY")}
            </div>
          </div>
        </div>
        <button
          onClick={() => activeTab === "citas-hoy" ? loadCitasHoy() : loadSalaEspera()}
          style={{
            background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)",
            borderRadius: 8, color: "#e2e8f0", padding: "6px 14px",
            fontSize: "0.8rem", cursor: "pointer", fontWeight: 500,
            display: "flex", alignItems: "center", gap: 6,
          }}>
          <i className="bi bi-arrow-clockwise"></i> Actualizar
        </button>
      </div>

      <div style={{ padding: "20px 24px" }}>
        <div style={{
          background: "#fff", borderRadius: "12px 12px 0 0",
          borderBottom: "1px solid #e5e7eb", display: "flex", padding: "0 6px",
          boxShadow: "0 1px 4px rgba(0,0,0,.04)",
        }}>
          {TABS.map(t => (
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

        <div style={{
          background: "#fff", borderRadius: "0 0 12px 12px",
          boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: "20px", minHeight: 300,
        }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
              <div className="spinner-border text-primary" role="status" style={{ width: "1.5rem", height: "1.5rem" }}></div>
              <div style={{ marginTop: 10, fontSize: "0.85rem" }}>Cargando...</div>
            </div>
          )}
          {!loading && activeTab === "citas-hoy" && (
            <CitasDelDia citas={citasHoy} onEstadoChange={cambiarEstado} navigate={navigate} />
          )}
          {!loading && activeTab === "sala-espera" && (
            <SalaDeEspera citas={salaEspera} onEstadoChange={cambiarEstado} navigate={navigate} tieneRecepcionista={tieneRecepcionista} />
          )}
        </div>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }) {
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

function CitasDelDia({ citas, onEstadoChange, navigate }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827" }}>
            Citas de hoy - {dayjs().format("dddd D [de] MMMM")}
          </span>
          {citas.length > 0 && (
            <span style={{ background: "#eff6ff", color: "#3b82f6", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
              {citas.length}
            </span>
          )}
        </div>
      </div>

      {citas.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
          <i className="bi bi-calendar2-x" style={{ fontSize: "2.8rem", opacity: .3 }}></i>
          <p style={{ marginTop: 10, fontSize: "0.88rem" }}>Ninguna consulta iniciada todavía hoy.</p>
        </div>
      )}

      {citas.length > 0 && (
        <>
          <div style={{
            background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8,
            padding: "8px 14px", marginBottom: 16, fontSize: "0.79rem", color: "#0369a1",
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <i className="bi bi-info-circle"></i>
            Pacientes cuya consulta ya inició o finalizó hoy. Los que solo están agendados o en espera aparecen en Sala de Espera.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["#", "Paciente", "DNI", "Telefono", "Email", "Estado", "Acciones"].map(h => (
                    <th key={h} style={{
                      padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700,
                      color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                      borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap", textAlign: "left",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {citas.map((cita, idx) => (
                  <FilaCita key={cita.id} cita={cita} idx={idx} onEstadoChange={onEstadoChange} navigate={navigate} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SalaDeEspera({ citas, onEstadoChange, navigate, tieneRecepcionista }) {
  const FLUJO = ["EN_ESPERA", "EN_ATENCION", "COMPLETADA"];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827" }}>
          Sala de Espera - {dayjs().format("dddd D [de] MMMM")}
        </span>
        {citas.length > 0 && (
          <span style={{ background: "#ede9fe", color: "#7c3aed", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
            {citas.length}
          </span>
        )}
      </div>

      {citas.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
          <i className="bi bi-person-check" style={{ fontSize: "2.8rem", opacity: .3 }}></i>
          <p style={{ marginTop: 10, fontSize: "0.88rem" }}>No hay pacientes en sala de espera.</p>
        </div>
      )}

      {citas.length > 0 && (
        <>
          <div style={{
            background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8,
            padding: "8px 14px", marginBottom: 16, fontSize: "0.79rem", color: "#0369a1",
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <i className="bi bi-info-circle"></i>
            {tieneRecepcionista
              ? "Solo pacientes admitidos por recepción (en espera o en atención). Los ya atendidos aparecen en Consultas de hoy."
              : "Todos los pacientes citados hoy que aún no han sido atendidos. Al darles consulta pasan a Consultas de hoy."}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["#", "Paciente", "DNI", "Telefono", "Email", "Estado", "Acciones"].map(h => (
                    <th key={h} style={{
                      padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700,
                      color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                      borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap", textAlign: "left",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {citas.map((cita, idx) => (
                  <FilaCita key={cita.id} cita={cita} idx={idx}
                    onEstadoChange={onEstadoChange} navigate={navigate}
                    estadosDisponibles={FLUJO.filter(e => e !== cita.estado)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FilaCita({ cita, idx, onEstadoChange, navigate, estadosDisponibles }) {
  const [hover, setHover] = useState(false);

  const btnEstadoStyle = (color) => ({
    background: "transparent",
    border: `1px solid ${color}`,
    borderRadius: 7, color,
    padding: "3px 10px", fontSize: "0.72rem",
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
      <td style={{ padding: "12px 14px", color: "#9ca3af", fontWeight: 700, fontSize: "0.82rem" }}>{idx + 1}</td>
      <td style={{ padding: "12px 14px" }}>
        <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#111827" }}>
          {cita.paciente_nombres} {cita.paciente_apellidos}
        </div>
        <div style={{ fontSize: "0.74rem", color: "#9ca3af", marginTop: 2 }}>
          {dayjs(cita.inicio).format("h:mm A")} - {dayjs(cita.fin).format("h:mm A")}
        </div>
      </td>
      <td style={{ padding: "12px 14px", fontSize: "0.83rem", color: "#374151", whiteSpace: "nowrap" }}>
        {cita.paciente_dni || <span style={{ color: "#d1d5db" }}>-</span>}
      </td>
      <td style={{ padding: "12px 14px", fontSize: "0.83rem", color: "#374151", whiteSpace: "nowrap" }}>
        {cita.paciente_tel || <span style={{ color: "#d1d5db" }}>-</span>}
      </td>
      <td style={{ padding: "12px 14px", fontSize: "0.8rem", color: "#6b7280" }}>
        {cita.paciente_email || <span style={{ color: "#d1d5db" }}>-</span>}
      </td>
      <td style={{ padding: "12px 14px" }}>
        <EstadoBadge estado={cita.estado} />
      </td>
      <td style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => {
              // Marcar EN_ATENCION al entrar a la consulta para que el paciente
              // pase de la sala de espera al listado de Consultas de hoy de inmediato.
              if (cita.estado !== "EN_ATENCION" && cita.estado !== "COMPLETADA") {
                onEstadoChange(cita.id, "EN_ATENCION");
              }
              navigate(`/consulta-medica?paciente_id=${cita.paciente_id}&cita_id=${cita.id}`);
            }}
            style={{
              background: "linear-gradient(135deg,#3b82f6,#2563eb)", border: "none",
              borderRadius: 7, color: "#fff", padding: "5px 12px",
              fontSize: "0.76rem", cursor: "pointer", fontWeight: 700,
              display: "flex", alignItems: "center", gap: 5,
              boxShadow: "0 2px 6px rgba(59,130,246,.3)",
            }}>
            <i className="bi bi-clipboard2-pulse"></i> Consulta
          </button>

          {estadosDisponibles ? (
            estadosDisponibles.map(estado => (
              <button key={estado} onClick={() => onEstadoChange(cita.id, estado)}
                style={btnEstadoStyle(ESTADO_COLOR[estado]?.dot || "#6b7280")}>
                {estado.replace(/_/g, " ")}
              </button>
            ))
          ) : (
            <>
              {cita.estado !== "EN_ESPERA" && (
                <button onClick={() => onEstadoChange(cita.id, "EN_ESPERA")}
                  style={btnEstadoStyle(ESTADO_COLOR.EN_ESPERA.dot)}>
                  EN ESPERA
                </button>
              )}
              {cita.estado !== "EN_ATENCION" && (
                <button onClick={() => onEstadoChange(cita.id, "EN_ATENCION")}
                  style={btnEstadoStyle(ESTADO_COLOR.EN_ATENCION.dot)}>
                  EN ATENCION
                </button>
              )}
              {cita.estado !== "COMPLETADA" && (
                <button onClick={() => onEstadoChange(cita.id, "COMPLETADA")}
                  style={btnEstadoStyle(ESTADO_COLOR.COMPLETADA.dot)}>
                  COMPLETADA
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
