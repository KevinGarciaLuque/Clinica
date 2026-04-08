import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import api from "../api/api";

const ROLE_COLOR = {
  SUPER_ADMIN:   "danger",
  ADMIN:         "warning",
  MEDICO:        "success",
  ENFERMERA:     "info",
  RECEPCIONISTA: "secondary",
};

const PLAN_BADGE = {
  trial:     { label: "Versión Prueba", color: "#f59e0b", bg: "rgba(245,158,11,.15)", border: "rgba(245,158,11,.4)", icon: "bi-clock-history", pulse: true },
  semestral: { label: "Semestral",      color: "#2196f3", bg: "rgba(33,150,243,.15)", border: "rgba(33,150,243,.4)", icon: "bi-calendar2-check", pulse: false },
  anual:     { label: "Anual",          color: "#10b981", bg: "rgba(16,185,129,.15)", border: "rgba(16,185,129,.4)", icon: "bi-award-fill",      pulse: false },
};

export default function NavbarApp({ onMenuClick }) {
  const { user, logout, licenciaInfo } = useAuth();
  const navigate = useNavigate();

  const salir = () => { logout(); navigate("/login"); };
  const initials = `${user?.nombres?.[0] ?? ""}${user?.apellidos?.[0] ?? ""}`;

  // Mostrar badge de plan solo para usuarios de clínica (no SUPER_ADMIN)
  const planBadge = !user?.super && licenciaInfo ? PLAN_BADGE[licenciaInfo.plan_tipo] : null;
  const diasRestantes = licenciaInfo?.dias_restantes ?? null;
  const esAlerta = licenciaInfo?.plan_tipo === "trial" || (diasRestantes !== null && diasRestantes <= 30);

  // ── Notificaciones de solicitudes de licencia (solo SUPER_ADMIN) ──
  const [solicitudes, setSolicitudes]     = useState([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const dropdownRef                       = useRef(null);

  useEffect(() => {
    if (!user?.super) return;
    const fetchSolicitudes = () => {
      api.get("/clinicas/solicitudes-licencia")
        .then(r => setSolicitudes(r.data.data || []))
        .catch(() => {});
    };
    fetchSolicitudes();
    const interval = setInterval(fetchSolicitudes, 30000); // polling cada 30s
    return () => clearInterval(interval);
  }, [user]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const atenderSolicitud = async (solicitudId, clinicaId) => {
    try {
      await api.put(`/clinicas/solicitudes-licencia/${solicitudId}/atender`);
      setSolicitudes(prev => prev.filter(s => s.id !== solicitudId));
      navigate(`/superadmin/clinicas`);
      setShowDropdown(false);
    } catch {}
  };

  return (
    <nav
      className="navbar navbar-dark bg-dark px-3 d-flex align-items-center justify-content-between"
      style={{ height: 56, minHeight: 56 }}
    >
      {/* Brand + hamburguesa */}
      <div className="d-flex align-items-center gap-2">
        {/* Botón hamburguesa solo en móvil */}
        <button
          className="btn btn-outline-secondary btn-sm d-lg-none border-0 text-white"
          onClick={onMenuClick}
          aria-label="Menú"
        >
          <i className="bi bi-list fs-5" />
        </button>
        <span className="navbar-brand mb-0 fw-bold d-flex align-items-center gap-2">
          <i className="bi bi-hospital-fill text-primary fs-5" />
          <span style={{ fontSize: "0.95rem" }}>
            {user?.clinica_nombre || "Multi-Clínica"}
          </span>
        </span>
        {user?.clinica_nombre && (
          <span 
            className="d-none d-md-inline badge text-white-50 fw-normal" 
            style={{ 
              fontSize: "0.65rem", 
              background: "rgba(255,255,255,0.1)",
              letterSpacing: "0.03em"
            }}
          >
            Multi-Clínica
          </span>
        )}
      </div>

      {/* Right side: user + logout */}
      <div className="d-flex align-items-center gap-2 gap-md-3">

        {/* 🔔 Notificaciones solicitudes licencia — solo SUPER_ADMIN */}
        {user?.super && (
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowDropdown(v => !v)}
              title={solicitudes.length ? `${solicitudes.length} solicitud(es) pendiente(s)` : "Sin solicitudes"}
              style={{
                background: solicitudes.length ? "rgba(245,158,11,.15)" : "rgba(255,255,255,.07)",
                border: `1px solid ${solicitudes.length ? "rgba(245,158,11,.4)" : "rgba(255,255,255,.12)"}`,
                borderRadius: 10, width: 36, height: 36,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative", flexShrink: 0,
              }}
            >
              <i
                className={`bi ${solicitudes.length ? "bi-bell-fill" : "bi-bell"}`}
                style={{ color: solicitudes.length ? "#f59e0b" : "rgba(255,255,255,.6)", fontSize: 15 }}
              />
              {solicitudes.length > 0 && (
                <span style={{
                  position: "absolute", top: -5, right: -5,
                  background: "#ef4444", color: "#fff",
                  fontSize: 10, fontWeight: 700, borderRadius: "50%",
                  width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid #1a1a2e",
                }}>
                  {solicitudes.length > 9 ? "9+" : solicitudes.length}
                </span>
              )}
            </button>

            {/* Dropdown de solicitudes */}
            {showDropdown && (
              <div style={{
                position: "absolute", top: 44, right: 0, zIndex: 1200,
                background: "#112240", border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 14, width: 320, boxShadow: "0 16px 48px rgba(0,0,0,.6)",
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.07)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13 }}>
                    <i className="bi bi-bell-fill me-2" style={{ color: "#f59e0b" }} />
                    Solicitudes de Licencia
                  </span>
                  <span style={{
                    background: solicitudes.length ? "rgba(245,158,11,.2)" : "rgba(255,255,255,.05)",
                    color: solicitudes.length ? "#f59e0b" : "#94a3b8",
                    fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px",
                  }}>
                    {solicitudes.length} pendiente{solicitudes.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {solicitudes.length === 0 ? (
                  <div style={{ padding: "20px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                    <i className="bi bi-check-circle" style={{ fontSize: 22, display: "block", marginBottom: 8, color: "#10b981" }} />
                    Sin solicitudes pendientes
                  </div>
                ) : (
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    {solicitudes.map(s => {
                      const PLAN_COLOR = { trial: "#f59e0b", semestral: "#2196f3", anual: "#10b981" };
                      const color = PLAN_COLOR[s.plan_solicitado] || "#94a3b8";
                      const fecha = new Date(s.creado_en).toLocaleDateString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
                      return (
                        <div key={s.id} style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid rgba(255,255,255,.05)",
                        }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                              background: `${color}20`, border: `1px solid ${color}50`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <i className="bi bi-building" style={{ color, fontSize: 14 }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>
                                {s.clinica_nombre}
                              </div>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                                Solicita plan{" "}
                                <span style={{ color, fontWeight: 700 }}>
                                  {s.plan_solicitado.charAt(0).toUpperCase() + s.plan_solicitado.slice(1)}
                                </span>
                                {" · "}{fecha}
                              </div>
                              {s.mensaje && (
                                <div style={{
                                  background: "rgba(255,255,255,.04)", borderRadius: 6,
                                  padding: "5px 8px", fontSize: 11, color: "#94a3b8",
                                  fontStyle: "italic", marginBottom: 6,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  "{s.mensaje}"
                                </div>
                              )}
                              <button
                                onClick={() => atenderSolicitud(s.id, s.clinica_id)}
                                style={{
                                  background: `${color}20`, border: `1px solid ${color}50`,
                                  borderRadius: 7, padding: "4px 10px",
                                  color, fontSize: 11, fontWeight: 700, cursor: "pointer",
                                }}
                              >
                                <i className="bi bi-key-fill me-1" />
                                Gestionar licencia
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Badge de plan/licencia (solo clínicas, no SUPER_ADMIN) */}
        {planBadge && (
          <>
            <style>{`
              @keyframes licencia-pulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,.5); }
                50%       { box-shadow: 0 0 0 5px rgba(245,158,11,0); }
              }
            `}</style>
            <div
              title={`Plan ${planBadge.label}${diasRestantes !== null ? ` — ${diasRestantes} días restantes` : ""} · Click para solicitar plan`}
              onClick={() => window.dispatchEvent(new CustomEvent("solicitarPlan"))}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: planBadge.bg,
                border: `1px solid ${planBadge.border}`,
                borderRadius: 8,
                padding: "4px 10px",
                animation: planBadge.pulse ? "licencia-pulse 2s infinite" : "none",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <i className={`bi ${planBadge.icon}`} style={{ color: planBadge.color, fontSize: 13 }} />
              <span
                className="d-none d-sm-inline"
                style={{ color: planBadge.color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
              >
                {planBadge.label}
                {diasRestantes !== null && (
                  <span style={{ opacity: .8, marginLeft: 4 }}>· {diasRestantes}d</span>
                )}
              </span>
            </div>
          </>
        )}

        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
            style={{
              width: 32, height: 32, fontSize: "0.75rem",
              background: esAlerta && planBadge
                ? `linear-gradient(135deg, ${planBadge.color}, ${planBadge.color}bb)`
                : "#0d6efd",
            }}
          >
            {initials}
          </div>
          <div className="d-none d-md-block" style={{ lineHeight: 1.2 }}>
            <div className="text-white fw-semibold" style={{ fontSize: "0.82rem" }}>
              {user?.nombres} {user?.apellidos}
            </div>
            <span
              className={`badge bg-${ROLE_COLOR[user?.tipo] ?? "secondary"}`}
              style={{ fontSize: "0.6rem" }}
            >
              {user?.tipo}
            </span>
          </div>
        </div>
        <button className="btn btn-outline-light btn-sm" onClick={salir}>
          <i className="bi bi-box-arrow-right me-1 d-none d-sm-inline" />
          <i className="bi bi-box-arrow-right d-sm-none" />
          <span className="d-none d-sm-inline">Salir</span>
        </button>
      </div>
    </nav>
  );
}
