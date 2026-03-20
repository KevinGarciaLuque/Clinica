import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/* ─── Paleta ─────────────────────────────────────────────────────── */
const C = {
  bg:          "#0d1b2e",
  bgLight:     "#112240",
  divider:     "rgba(255,255,255,0.07)",
  textMuted:   "rgba(148,163,184,0.75)",
  textNormal:  "rgba(203,213,225,0.9)",
  textActive:  "#ffffff",
  accent:      "#2196f3",
  accentGlow:  "rgba(33,150,243,0.18)",
  accentBadge: "rgba(33,150,243,0.25)",
  hover:       "rgba(255,255,255,0.06)",
  avatarBg:    "linear-gradient(135deg,#2196f3,#0d47a1)",
};

/* ─── Módulos base de reserva (si aún no se cargaron del API) ─────── */
const BASE_FALLBACK = [
  { to: "/",          label: "Dashboard",        icon: "bi-speedometer2" },
  { to: "/pacientes", label: "Pacientes",         icon: "bi-people-fill" },
  { to: "/citas",     label: "Citas",             icon: "bi-calendar-check-fill" },
  { to: "/historia",  label: "Historia Clínica",  icon: "bi-journal-medical" },
  { to: "/chat-ia",   label: "Asistente IA",      icon: "bi-robot" },
];

const adminItems = [
  { to: "/admin/usuarios",  label: "Usuarios",         icon: "bi-person-badge-fill" },
  { to: "/admin/horarios",  label: "Horarios médicos",  icon: "bi-clock-fill" },
  { to: "/admin/servicios", label: "Servicios",         icon: "bi-tag-fill" },
  { to: "/admin/config",    label: "Configuración",     icon: "bi-gear-fill" },
];

const medicoItems = [
  { to: "/admin/config",    label: "Configuración",     icon: "bi-gear-fill" },
];

const superItems = [
  { to: "/superadmin/clinicas",  label: "Clínicas",         icon: "bi-building-fill" },
  { to: "/superadmin/database",  label: "Base de Datos",    icon: "bi-database-fill-gear" },
];

/** Convierte respuesta del API de módulos a items del sidebar */
function modulosToItems(modulos) {
  return modulos.map(m => ({
    to:    m.ruta,
    label: m.nombre,
    icon:  m.icono,
  }));
}

function getMenuSections(tipo, modulos) {
  const hasDynamic = modulos && modulos.length > 0;
  const mainItems  = hasDynamic ? modulosToItems(modulos) : BASE_FALLBACK;

  if (tipo === "SUPER_ADMIN") return { super: superItems, main: mainItems, admin: adminItems };
  if (tipo === "ADMIN")       return { super: [],          main: mainItems, admin: adminItems };
  if (tipo === "MEDICO")      return { super: [],          main: mainItems, admin: medicoItems };
  return                              { super: [],          main: mainItems, admin: [] };
}

/* ─── Sección de menú ────────────────────────────────────────────── */
function SidebarSection({ title, items, collapsed, onNavigate, showDivider }) {
  if (!items.length) return null;
  return (
    <div>
      {showDivider && (
        <div style={{ margin: "6px 14px", borderTop: `1px solid ${C.divider}` }} />
      )}
      {!collapsed && (
        <div style={{
          padding: "8px 16px 3px",
          fontSize: "0.575rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: C.textMuted,
          whiteSpace: "nowrap",
        }}>
          {title}
        </div>
      )}

      <ul className="nav flex-column" style={{ padding: "0 8px", gap: 1 }}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `nav-link d-flex align-items-center gap-2 sidebar-link ${isActive ? "active" : ""}`
              }
              style={{
                fontSize: "0.84rem",
                padding: collapsed ? "9px 0" : "7px 11px",
                justifyContent: collapsed ? "center" : "flex-start",
                whiteSpace: "nowrap",
                overflow: "hidden",
                borderRadius: 8,
                transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
              }}
            >
              <i
                className={`bi ${item.icon}`}
                style={{
                  fontSize: "1.05rem",
                  flexShrink: 0,
                  width: collapsed ? "auto" : 18,
                  textAlign: "center",
                }}
              />
              {!collapsed && <span style={{ fontWeight: 500 }}>{item.label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Sidebar principal ──────────────────────────────────────────── */
export default function Sidebar({ collapsed, onToggleCollapse, onNavigate }) {
  const { user, modulos } = useAuth();
  const { super: sItems, main, admin } = getMenuSections(user?.tipo, modulos);

  return (
    <>
      <style>{`
        /* ── Links ── */
        .sidebar-link { color: ${C.textNormal}; }
        .sidebar-link:hover {
          background: ${C.hover} !important;
          color: #fff !important;
        }
        .sidebar-link.active {
          background: ${C.accentGlow} !important;
          color: ${C.textActive} !important;
          box-shadow: inset 3px 0 0 ${C.accent};
          font-weight: 600;
        }
        .sidebar-link.active i { color: ${C.accent}; }

        /* ── Scrollbar ── */
        .sidebar-scroll::-webkit-scrollbar { width: 4px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 4px;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.22);
        }

        /* ── Botón colapsar ── */
        .btn-collapse-sidebar {
          border: none;
          background: rgba(255,255,255,0.06);
          color: ${C.textMuted};
          border-radius: 8px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
          cursor: pointer;
          flex-shrink: 0;
        }
        .btn-collapse-sidebar:hover {
          background: ${C.accentGlow};
          color: ${C.accent};
        }

        /* ── Logo pill ── */
        .sidebar-logo-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px 4px 4px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
        }
      `}</style>

      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: C.bg,
      }}>

        {/* ════════════ CABECERA LOGO ════════════ */}
        <div style={{
          flexShrink: 0,
          padding: collapsed ? "14px 0 12px" : "14px 12px 12px",
          borderBottom: `1px solid ${C.divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
        }}>
          {!collapsed && (
            <div className="sidebar-logo-pill">
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: C.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <i className="bi bi-hospital-fill" style={{ color: "#fff", fontSize: "0.85rem" }} />
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ color: "#fff", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.01em" }}>
                  Multi-Clínica
                </div>
                <div style={{ color: C.textMuted, fontSize: "0.58rem", letterSpacing: "0.04em" }}>
                  Sistema de Gestión
                </div>
              </div>
            </div>
          )}

          {collapsed && (
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: C.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <i className="bi bi-hospital-fill" style={{ color: "#fff", fontSize: "1rem" }} />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="btn-collapse-sidebar d-none d-lg-flex"
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <i
              className={`bi ${collapsed ? "bi-chevron-double-right" : "bi-chevron-double-left"}`}
              style={{ fontSize: "0.75rem" }}
            />
          </button>
        </div>

        {/* ════════════ MENÚ (scrollable) ════════════ */}
        <div
          className="sidebar-scroll"
          style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 6, paddingBottom: 10 }}
        >
          <SidebarSection title="Super Admin"    items={sItems} collapsed={collapsed} onNavigate={onNavigate} showDivider={false} />
          <SidebarSection title="Clínica"        items={main}   collapsed={collapsed} onNavigate={onNavigate} showDivider={sItems.length > 0} />
          <SidebarSection title="Administración" items={admin}  collapsed={collapsed} onNavigate={onNavigate} showDivider={true} />
        </div>

        {/* ════════════ PIE ════════════ */}
        {!collapsed && (
          <div style={{
            flexShrink: 0,
            padding: "8px 14px",
            borderTop: `1px solid ${C.divider}`,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <i className="bi bi-shield-fill-check" style={{ color: C.accent, fontSize: "0.75rem" }} />
            <span style={{ color: C.textMuted, fontSize: "0.62rem", letterSpacing: "0.02em" }}>
              Multi-Clínica v1.0 · 2026
            </span>
          </div>
        )}
      </div>
    </>
  );
}

