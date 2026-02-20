import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

const ESTADO_COLOR = {
  PENDIENTE:    { bg: "#ffc107", fg: "#000" },
  CONFIRMADA:   { bg: "#0d6efd", fg: "#fff" },
  EN_ESPERA:    { bg: "#6610f2", fg: "#fff" },
  EN_ATENCION:  { bg: "#198754", fg: "#fff" },
  COMPLETADA:   { bg: "#6c757d", fg: "#fff" },
  CANCELADA:    { bg: "#dc3545", fg: "#fff" },
  NO_ASISTIO:   { bg: "#fd7e14", fg: "#fff" },
};

function KpiCard({ label, value, icon, color = "primary", sub }) {
  return (
    <div className="col-sm-6 col-xl-3">
      <div className={`card border-0 shadow-sm h-100`}>
        <div className="card-body d-flex align-items-center gap-3">
          <div className={`rounded-3 p-3 bg-${color} bg-opacity-10 text-${color} fs-4`}>
            {icon}
          </div>
          <div>
            <div className="fw-bold fs-4">{value ?? "—"}</div>
            <div className="text-muted small">{label}</div>
            {sub && <div className="text-muted" style={{ fontSize: "0.72rem" }}>{sub}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats]   = useState(null);
  const [sala,  setSala]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/stats"),
      api.get("/dashboard/sala-espera"),
    ])
    .then(([s, e]) => {
      setStats(s.data.data);
      setSala(e.data.data || []);
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const hoy = dayjs().format("dddd D [de] MMMM YYYY");

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="mb-0 fw-bold">Dashboard</h4>
          <small className="text-muted text-capitalize">{hoy}</small>
        </div>
        <div>
          <span className="text-muted">Bienvenido/a, </span>
          <strong>{user?.nombres} {user?.apellidos}</strong>
          <span className="badge bg-secondary ms-2">{user?.tipo}</span>
        </div>
      </div>

      {loading && (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border spinner-border-sm me-2" />Cargando datos…
        </div>
      )}

      {!loading && stats && (
        <>
          {/* KPIs */}
          <div className="row g-3 mb-4">
            <KpiCard label="Total Pacientes" value={stats.total_pacientes} icon="👥" color="primary" />
            <KpiCard label="Citas Hoy" value={stats.citas_hoy} icon="📅" color="success" />
            <KpiCard label="Esta Semana" value={stats.citas_semana} icon="📊" color="info" />
            <KpiCard label="Confirmadas Hoy"
              value={stats.estados_hoy?.find(e => e.estado === "CONFIRMADA")?.total ?? 0}
              icon="✅" color="warning" />
          </div>

          {/* Desglose estados hoy */}
          {stats.estados_hoy?.length > 0 && (
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-body">
                <h6 className="card-title fw-semibold mb-3">Estados de citas hoy</h6>
                <div className="d-flex flex-wrap gap-2">
                  {stats.estados_hoy.map(e => (
                    <span key={e.estado} className="badge px-3 py-2"
                      style={{ background: ESTADO_COLOR[e.estado]?.bg ?? "#6c757d",
                               color: ESTADO_COLOR[e.estado]?.fg ?? "#fff",
                               fontSize: "0.85rem" }}>
                      {e.estado}: {e.total}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="row g-3">
            {/* Sala de espera */}
            <div className="col-lg-8">
              <div className="card shadow-sm border-0 h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="card-title fw-semibold mb-0">Sala de Espera — Hoy</h6>
                    <Link to="/citas" className="btn btn-outline-primary btn-sm">Ver agenda</Link>
                  </div>
                  {sala.length === 0
                    ? <p className="text-muted">No hay citas pendientes para hoy.</p>
                    : (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Hora</th><th>Paciente</th><th>Médico</th><th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sala.map(c => (
                              <tr key={c.id}>
                                <td className="text-nowrap text-muted small">
                                  {dayjs(c.inicio).format("HH:mm")}
                                </td>
                                <td>
                                  <div className="fw-semibold small">{c.paciente_apellidos}, {c.paciente_nombres}</div>
                                  <div className="text-muted" style={{ fontSize: "0.72rem" }}>{c.paciente_tel}</div>
                                </td>
                                <td className="small">Dr. {c.medico_apellidos}</td>
                                <td>
                                  <span className="badge"
                                    style={{ background: ESTADO_COLOR[c.estado]?.bg, color: ESTADO_COLOR[c.estado]?.fg,
                                             fontSize: "0.7rem" }}>
                                    {c.estado}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </div>
              </div>
            </div>

            {/* Últimos pacientes */}
            <div className="col-lg-4">
              <div className="card shadow-sm border-0 h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="card-title fw-semibold mb-0">Últimos Pacientes</h6>
                    <Link to="/pacientes" className="btn btn-outline-secondary btn-sm">Ver todos</Link>
                  </div>
                  {(stats.ultimos_pacientes || []).length === 0
                    ? <p className="text-muted small">Sin pacientes registrados.</p>
                    : (
                      <ul className="list-unstyled mb-0">
                        {(stats.ultimos_pacientes || []).map(p => (
                          <li key={p.id} className="d-flex align-items-center gap-2 mb-2">
                            <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold"
                              style={{ width: 36, height: 36, fontSize: "0.85rem" }}>
                              {p.nombres?.[0]}{p.apellidos?.[0]}
                            </div>
                            <div>
                              <div className="small fw-semibold">{p.apellidos}, {p.nombres}</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem" }}>DNI {p.dni}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Accesos rápidos según rol */}
          {(user?.tipo === "ADMIN" || user?.tipo === "SUPER_ADMIN") && (
            <div className="row g-2 mt-3">
              {[
                { to: "/admin/usuarios",    label: "Usuarios",      icon: "👤" },
                { to: "/admin/servicios",   label: "Servicios",     icon: "🏷️" },
                { to: "/admin/horarios",    label: "Horarios",      icon: "🕐" },
                { to: "/admin/config",      label: "Configuración", icon: "⚙️" },
              ].map(l => (
                <div key={l.to} className="col-6 col-md-3">
                  <Link to={l.to} className="card shadow-sm border-0 text-decoration-none text-body h-100">
                    <div className="card-body text-center py-3">
                      <div className="fs-3 mb-1">{l.icon}</div>
                      <div className="small fw-semibold">{l.label}</div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

