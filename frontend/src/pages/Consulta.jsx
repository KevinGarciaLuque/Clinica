import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/es";
import api from "../api/api";

dayjs.locale("es");

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

// ═══════════════════════════════════════════════════════════════════════════════
export default function Consulta() {
  const [activeTab, setActiveTab] = useState("citas-hoy");
  const [citasHoy, setCitasHoy] = useState([]);
  const [salaEspera, setSalaEspera] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ── cargar citas del día ──────────────────────────────────────────────────────
  const loadCitasHoy = useCallback(() => {
    setLoading(true);
    const hoy = dayjs().format("YYYY-MM-DD");
    api.get("/citas", { params: { desde: hoy, hasta: hoy } })
      .then(r => setCitasHoy(r.data.data || []))
      .catch(() => setCitasHoy([]))
      .finally(() => setLoading(false));
  }, []);

  // ── cargar sala de espera ─────────────────────────────────────────────────────
  const loadSalaEspera = useCallback(() => {
    setLoading(true);
    api.get("/dashboard/sala-espera")
      .then(r => setSalaEspera(r.data.data || []))
      .catch(() => setSalaEspera([]))
      .finally(() => setLoading(false));
  }, []);

  // ── efectos ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "citas-hoy") {
      loadCitasHoy();
    } else if (activeTab === "sala-espera") {
      loadSalaEspera();
    }
  }, [activeTab, loadCitasHoy, loadSalaEspera]);

  // ── cambiar estado ────────────────────────────────────────────────────────────
  const cambiarEstado = (citaId, nuevoEstado) => {
    api.patch(`/citas/${citaId}/estado`, { estado: nuevoEstado })
      .then(() => {
        // Recargar ambas listas
        if (activeTab === "citas-hoy") loadCitasHoy();
        else loadSalaEspera();
      })
      .catch(err => alert(err.response?.data?.msg || "Error al cambiar estado"));
  };

  return (
    <div className="container-fluid py-3">
      <style>{`
        .consulta-table-hover tbody tr:hover {
          background-color: rgba(13, 110, 253, 0.05);
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        .btn-estado {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .btn-estado:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        }
        .btn-consulta-medica {
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(33, 150, 243, 0.3);
          transition: all 0.2s;
        }
        .btn-consulta-medica:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(33, 150, 243, 0.4);
        }
      `}</style>

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="mb-0 fw-bold">
          <i className="bi bi-clipboard2-pulse-fill text-primary me-2"></i>
          Agenda de Consulta
        </h4>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === "citas-hoy" ? "active" : ""}`}
            onClick={() => setActiveTab("citas-hoy")}
          >
            Calendario
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === "sala-espera" ? "active" : ""}`}
            onClick={() => setActiveTab("sala-espera")}
          >
            Sala de Espera
          </button>
        </li>
      </ul>

      {/* Contenido según pestaña */}
      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}

      {!loading && activeTab === "citas-hoy" && (
        <CitasDelDia 
          citas={citasHoy} 
          onEstadoChange={cambiarEstado}
          navigate={navigate}
        />
      )}

      {!loading && activeTab === "sala-espera" && (
        <SalaDeEspera 
          citas={salaEspera} 
          onEstadoChange={cambiarEstado}
          navigate={navigate}
        />
      )}
    </div>
  );
}

// ─── Tab 1: Citas del Día ─────────────────────────────────────────────────────
function CitasDelDia({ citas, onEstadoChange, navigate }) {
  const hoy = dayjs();
  
  return (
    <div>
      <h6 className="text-muted mb-3">
        Citas de hoy — {hoy.format("dddd D [de] MMMM")}
      </h6>
      
      {citas.length === 0 && (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          No hay citas programadas para hoy.
        </div>
      )}

      {citas.length > 0 && (
        <>
          <div className="alert alert-light border py-2 mb-3">
            <small className="text-muted">
              <i className="bi bi-info-circle me-1"></i>
              Se muestran todas las citas de hoy excepto las CANCELADAS y NO_ASISTIÓ
            </small>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle consulta-table-hover">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Paciente</th>
                  <th>DNI</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((cita, index) => (
                  <tr key={cita.id}>
                    <td className="text-muted fw-bold">{index + 1}</td>
                    <td>
                      <div className="fw-semibold">
                        {cita.paciente_apellidos}, {cita.paciente_nombres}
                      </div>
                      <small className="text-muted">
                        {dayjs(cita.inicio).format("h:mm A")} – {dayjs(cita.fin).format("h:mm A")}
                      </small>
                    </td>
                    <td className="text-nowrap">{cita.paciente_dni || "—"}</td>
                    <td className="text-nowrap">{cita.paciente_tel || "—"}</td>
                    <td>
                      <small>{cita.paciente_email || "—"}</small>
                    </td>
                    <td>
                      <span 
                        className="badge" 
                        style={{ 
                          backgroundColor: ESTADO_COLOR[cita.estado]?.bg || "#6c757d",
                          color: ESTADO_COLOR[cita.estado]?.fg || "#fff"
                        }}
                      >
                        {cita.estado}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        <button 
                          className="btn btn-primary btn-sm btn-consulta-medica"
                          onClick={() => navigate(`/consulta-medica?paciente_id=${cita.paciente_id}&cita_id=${cita.id}`)}
                          title="Abrir consulta médica"
                        >
                          <i className="bi bi-clipboard2-pulse me-1"></i>
                          Consulta
                        </button>
                        {cita.estado !== "EN_ESPERA" && (
                          <button 
                            className="btn btn-outline-primary btn-estado"
                            onClick={() => onEstadoChange(cita.id, "EN_ESPERA")}
                            title="Marcar como En Espera"
                          >
                            → EN ESPERA
                          </button>
                        )}
                        {cita.estado !== "EN_ATENCION" && (
                          <button 
                            className="btn btn-outline-success btn-estado"
                            onClick={() => onEstadoChange(cita.id, "EN_ATENCION")}
                            title="Marcar como En Atención"
                          >
                            → EN ATENCIÓN
                          </button>
                        )}
                        {cita.estado !== "COMPLETADA" && (
                          <button 
                            className="btn btn-outline-secondary btn-estado"
                            onClick={() => onEstadoChange(cita.id, "COMPLETADA")}
                            title="Marcar como Completada"
                          >
                            → COMPLETADA
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab 2: Sala de Espera ────────────────────────────────────────────────────
function SalaDeEspera({ citas, onEstadoChange, navigate }) {
  const hoy = dayjs();
  const FLUJO = ["EN_ESPERA", "EN_ATENCION", "COMPLETADA"];
  
  return (
    <div>
      <h6 className="text-muted mb-3">
        Citas de hoy — {hoy.format("dddd D [de] MMMM")}
      </h6>

      {citas.length === 0 && (
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle me-2"></i>
          No hay pacientes en sala de espera.
        </div>
      )}

      {citas.length > 0 && (
        <>
          <div className="alert alert-info py-2 mb-3">
            <small>
              <i className="bi bi-info-circle me-1"></i>
              Se muestran todas las citas de hoy excepto las CANCELADAS y NO_ASISTIÓ
            </small>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle consulta-table-hover">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Paciente</th>
                  <th>DNI</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((cita, index) => (
                  <tr key={cita.id}>
                    <td className="text-muted fw-bold">{index + 1}</td>
                    <td>
                      <div className="fw-semibold">
                        {cita.paciente_apellidos}, {cita.paciente_nombres}
                      </div>
                      <small className="text-muted">
                        {dayjs(cita.inicio).format("h:mm A")} – {dayjs(cita.fin).format("h:mm A")}
                      </small>
                    </td>
                    <td className="text-nowrap">{cita.paciente_dni || "—"}</td>
                    <td className="text-nowrap">{cita.paciente_tel || "—"}</td>
                    <td>
                      <small>{cita.paciente_email || "—"}</small>
                    </td>
                    <td>
                      <span 
                        className="badge"
                        style={{ 
                          backgroundColor: ESTADO_COLOR[cita.estado]?.bg || "#6c757d",
                          color: ESTADO_COLOR[cita.estado]?.fg || "#fff"
                        }}
                      >
                        {cita.estado}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        <button 
                          className="btn btn-primary btn-sm btn-consulta-medica"
                          onClick={() => navigate(`/consulta-medica?paciente_id=${cita.paciente_id}&cita_id=${cita.id}`)}
                          title="Abrir consulta médica"
                        >
                          <i className="bi bi-clipboard2-pulse me-1"></i>
                          Consulta
                        </button>
                        {FLUJO.filter(estado => estado !== cita.estado).map(estado => (
                          <button 
                            key={estado}
                            className="btn btn-outline-secondary btn-estado"
                            onClick={() => onEstadoChange(cita.id, estado)}
                          >
                            → {estado.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
