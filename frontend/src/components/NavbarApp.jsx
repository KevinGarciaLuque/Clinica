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
  const [showUserMenu, setShowUserMenu]   = useState(false);
  const userMenuRef                       = useRef(null);

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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
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
    <>
    <style>{`
      @keyframes navline-slide {
        0%   { background-position: -200% center; }
        100% { background-position: 300% center; }
      }
      @keyframes navline-shine {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
      }
      @keyframes licencia-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,.5); }
        50%       { box-shadow: 0 0 0 5px rgba(245,158,11,0); }
      }
    `}</style>
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
        <span className="navbar-brand mb-0 d-flex align-items-center gap-2" style={{ fontWeight: 700 }}>
          <div className="d-none d-sm-block" style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: "0.9rem", color: "#fff", fontWeight: 700, letterSpacing: "0.03em" }}>
              Sistema de Gestión Clínica
            </div>
          </div>
        </span>
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



        {/* User menu dropdown */}
        <div ref={userMenuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            style={{
              background: showUserMenu ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 10, padding: "4px 10px 4px 6px",
              display: "flex", alignItems: "center", gap: 8,
              cursor: "pointer", transition: "background .15s",
            }}
            onMouseEnter={e => { if (!showUserMenu) e.currentTarget.style.background = "rgba(255,255,255,.1)"; }}
            onMouseLeave={e => { if (!showUserMenu) e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              background: esAlerta && planBadge
                ? `linear-gradient(135deg, ${planBadge.color}, ${planBadge.color}bb)`
                : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", border: "2px solid rgba(255,255,255,.2)",
            }}>
              {user?.foto_url
                ? <img src={user.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.72rem" }}>{initials}</span>
              }
            </div>
            <div className="d-none d-md-block" style={{ lineHeight: 1.25, textAlign: "left" }}>
              <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                {user?.nombres} {user?.apellidos}
              </div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {user?.tipo}
              </div>
            </div>
            <i
              className="bi bi-chevron-down d-none d-md-inline"
              style={{
                color: "rgba(255,255,255,.35)", fontSize: 10,
                transform: showUserMenu ? "rotate(180deg)" : "none",
                transition: "transform .2s",
              }}
            />
          </button>

          {showUserMenu && (
            <div style={{
              position: "absolute", top: 46, right: 0, zIndex: 1200,
              background: "#1a2744", border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 14, width: 248, boxShadow: "0 16px 48px rgba(0,0,0,.55)",
              overflow: "hidden",
            }}>
              {/* Header con info del usuario */}
              <div style={{
                padding: "16px",
                background: "linear-gradient(135deg, #112240, #1a2744)",
                borderBottom: "1px solid rgba(255,255,255,.07)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: esAlerta && planBadge
                      ? `linear-gradient(135deg, ${planBadge.color}, ${planBadge.color}bb)`
                      : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden", border: "2px solid rgba(255,255,255,.2)",
                    boxShadow: "0 4px 12px rgba(0,0,0,.3)",
                  }}>
                    {user?.foto_url
                      ? <img src={user.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>{initials}</span>
                    }
                  </div>
                  <div>
                    <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "0.9rem" }}>
                      {user?.nombres} {user?.apellidos}
                    </div>
                    <div style={{ color: "rgba(255,255,255,.45)", fontSize: "0.72rem", marginTop: 1 }}>
                      {user?.email}
                    </div>
                    <span style={{
                      display: "inline-block", marginTop: 4,
                      fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.07em",
                      textTransform: "uppercase", padding: "2px 7px", borderRadius: 4,
                      background: "rgba(59,130,246,.2)", color: "#93c5fd",
                    }}>
                      {user?.tipo}
                    </span>
                  </div>
                </div>
              </div>

              {/* Opciones */}
              {/* Mi Perfil */}
              <button
                onClick={() => { navigate("/perfil"); setShowUserMenu(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 16px", background: "transparent",
                  border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: "0.84rem",
                  textAlign: "left",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <i className="bi bi-person-circle" style={{ fontSize: 15, color: "#64748b", width: 18, textAlign: "center" }} />
                Mi Perfil
              </button>

              {/* Badge de plan/licencia debajo de Mi Perfil */}
              {planBadge && (
                <div
                  title={`Plan ${planBadge.label}${diasRestantes !== null ? ` — ${diasRestantes} días restantes` : ""} · Click para solicitar plan`}
                  onClick={() => { window.dispatchEvent(new CustomEvent("solicitarPlan")); setShowUserMenu(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 16px",
                    background: planBadge.bg,
                    borderTop: `1px solid ${planBadge.border}`,
                    borderBottom: `1px solid ${planBadge.border}`,
                    animation: planBadge.pulse ? "licencia-pulse 2s infinite" : "none",
                    cursor: "pointer", userSelect: "none",
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  <i className={`bi ${planBadge.icon}`} style={{ fontSize: 15, color: planBadge.color, width: 18, textAlign: "center" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: planBadge.color, fontSize: "0.84rem", fontWeight: 700 }}>
                      Plan {planBadge.label}
                    </div>
                    {diasRestantes !== null && (
                      <div style={{ color: planBadge.color, opacity: 0.75, fontSize: "0.72rem" }}>
                        {diasRestantes} días restantes
                      </div>
                    )}
                  </div>
                  <i className="bi bi-arrow-right-circle" style={{ fontSize: 13, color: planBadge.color, opacity: 0.7 }} />
                </div>
              )}

              {/* Cambiar contraseña y Ayuda */}
              {[
                { icon: "bi-shield-lock",    label: "Cambiar contraseña",  action: () => { navigate("/cambiar-password"); setShowUserMenu(false); } },
                { icon: "bi-headset",        label: "Ayuda y soporte",     action: () => setShowUserMenu(false) },
              ].map(({ icon, label, action }) => (
                <button
                  key={label} onClick={action}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 16px", background: "transparent",
                    border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: "0.84rem",
                    textAlign: "left",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <i className={`bi ${icon}`} style={{ fontSize: 15, color: "#64748b", width: 18, textAlign: "center" }} />
                  {label}
                </button>
              ))}

              <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "4px 16px" }} />

              <button
                onClick={() => { salir(); setShowUserMenu(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 16px", marginBottom: 4, background: "transparent",
                  border: "none", cursor: "pointer", color: "#f87171", fontSize: "0.84rem",
                  textAlign: "left",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <i className="bi bi-box-arrow-right" style={{ fontSize: 15, width: 18, textAlign: "center" }} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
    </>
  );
}
