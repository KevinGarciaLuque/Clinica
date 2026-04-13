import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
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
  { to: "/catalogos",       label: "Catálogos",         icon: "bi-journal-bookmark-fill" },
  { to: "/admin/config",    label: "Configuración",     icon: "bi-gear-fill" },
];

const medicoItems = [
  { to: "/admin/horarios",  label: "Horarios médicos",  icon: "bi-clock-fill" },
  { to: "/admin/servicios", label: "Servicios",         icon: "bi-tag-fill" },
  { to: "/catalogos",       label: "Catálogos",         icon: "bi-journal-bookmark-fill" },
  { to: "/admin/config",    label: "Configuración",     icon: "bi-gear-fill" },
];

const superItems = [
  { to: "/superadmin/clinicas",  label: "Clínicas",       icon: "bi-building-fill" },
  { to: "/superadmin/reportes",  label: "Reportes",        icon: "bi-bar-chart-line-fill" },
  { to: "/superadmin/database",  label: "Base de Datos",  icon: "bi-database-fill-gear" },
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
  let mainItems = hasDynamic ? modulosToItems(modulos) : BASE_FALLBACK;

  // MEDICO y ADMIN siempre deben ver Consulta (puede no estar en caché)
  if ((tipo === "MEDICO" || tipo === "ADMIN") && !mainItems.some(m => m.to === "/consulta")) {
    const consulta = { to: "/consulta", label: "Consulta", icon: "bi-clipboard2-pulse-fill" };
    const citasIdx = mainItems.findIndex(m => m.to === "/citas");
    mainItems = citasIdx >= 0
      ? [...mainItems.slice(0, citasIdx + 1), consulta, ...mainItems.slice(citasIdx + 1)]
      : [...mainItems, consulta];
  }

  if (tipo === "SUPER_ADMIN") return { super: superItems, main: mainItems, admin: adminItems };
  if (tipo === "ADMIN")       return { super: [],          main: mainItems, admin: adminItems };
  if (tipo === "MEDICO")      return { super: [],          main: mainItems, admin: medicoItems };
  return                              { super: [],          main: mainItems, admin: [] };
}

/* ─── Sub-menú expandible para Citas ────────────────────────────── */
function CitasExpandable({ collapsed, onNavigate }) {
  const location = useLocation();
  const isActive = location.pathname === "/citas";
  const [open, setOpen] = useState(isActive);
  const activeSubTab = new URLSearchParams(location.search).get("tab") || "calendario";
  const activeView   = new URLSearchParams(location.search).get("view");

  // Al entrar a /citas desde otra ruta, abrir automáticamente
  useEffect(() => { if (isActive) setOpen(true); }, [isActive]);

  const subItems = [
    { to: "/citas",             label: "Programar",      icon: "bi-calendar-plus", key: "programar" },
    { to: "/citas?view=agenda", label: "Agenda",         icon: "bi-calendar3",     key: "agenda"    },
    { to: "/citas?tab=sala",    label: "Sala de Espera", icon: "bi-hospital",      key: "sala"      },
  ];

  const showSub = open && isActive && !collapsed;

  return (
    <li>
      {/* Item padre — navega al calendario mes, y si ya estamos toggle el sub-menú */}
      <NavLink
        to="/citas"
        end
        onClick={(e) => {
          if (isActive) { e.preventDefault(); setOpen(o => !o); }
          // Si no está activo: navega normalmente (NavLink), el useEffect abre el sub-menú
        }}
        title={collapsed ? "Citas" : undefined}
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
        <i className="bi bi-calendar-check-fill" style={{ fontSize: "1.05rem", flexShrink: 0, width: collapsed ? "auto" : 18, textAlign: "center" }} />
        {!collapsed && (
          <>
            <span style={{ fontWeight: 500, flex: 1 }}>Citas</span>
            {isActive && <i className={`bi bi-chevron-${open ? "down" : "right"}`} style={{ fontSize: "0.65rem", opacity: 0.6 }} />}
          </>
        )}
      </NavLink>

      {/* Sub-items */}
      {showSub && (
        <ul className="nav flex-column sidebar-submenu" style={{ padding: "2px 8px 4px 30px", gap: 1 }}>
          {subItems.map(sub => {
            const subIsActive =
              sub.key === "sala"     ? activeSubTab === "sala" :
              sub.key === "agenda"   ? activeView === "agenda" :
              sub.key === "programar"? activeSubTab !== "sala" && activeView !== "agenda" : false;
            return (
              <li key={sub.key}>
                <NavLink
                  to={sub.to}
                  onClick={onNavigate}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "5px 10px", fontSize: "0.79rem", borderRadius: 6,
                    textDecoration: "none",
                    fontWeight: subIsActive ? 600 : 400,
                    color: subIsActive ? "#fff" : "rgba(148,163,184,0.85)",
                    background: subIsActive ? "rgba(33,150,243,0.18)" : "transparent",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  <i className={`bi ${sub.icon}`} style={{ fontSize: "0.8rem", width: 14, textAlign: "center", color: subIsActive ? "#2196f3" : "inherit" }} />
                  {sub.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/* ─── Sub-menú expandible para Pacientes ────────────────────────── */
function PacientesExpandable({ collapsed, onNavigate }) {
  const location = useLocation();
  const isActive = location.pathname.startsWith("/pacientes") || location.pathname.startsWith("/historia") || location.pathname.startsWith("/estudios");
  const [open, setOpen] = useState(isActive);

  useEffect(() => { if (isActive) setOpen(true); }, [isActive]);

  const subItems = [
    { to: "/pacientes",          label: "Buscar",           icon: "bi-search",              key: "buscar"   },
    { to: "/pacientes?nuevo=true", label: "Registrar",      icon: "bi-person-plus-fill",    key: "nuevo"    },
    { to: "/historia",           label: "Historia Clínica", icon: "bi-journal-medical",     key: "historia" },
    { to: "/estudios",           label: "Estudios e Imágenes", icon: "bi-film",             key: "estudios" },
  ];

  const showSub = open && isActive && !collapsed;

  return (
    <li>
      <NavLink
        to="/pacientes"
        end
        onClick={(e) => {
          if (isActive) { e.preventDefault(); setOpen(o => !o); }
          // Si no está activo: navega normalmente (NavLink), el useEffect abre el sub-menú
        }}
        title={collapsed ? "Pacientes" : undefined}
        className={({ isActive: na }) =>
          `nav-link d-flex align-items-center gap-2 sidebar-link ${isActive ? "active" : ""}`
        }
        style={{
          fontSize: "0.84rem",
          padding: collapsed ? "9px 0" : "7px 11px",
          justifyContent: collapsed ? "center" : "flex-start",
          whiteSpace: "nowrap", overflow: "hidden", borderRadius: 8,
          transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
        }}
      >
        <i className="bi bi-people-fill" style={{ fontSize: "1.05rem", flexShrink: 0, width: collapsed ? "auto" : 18, textAlign: "center" }} />
        {!collapsed && (
          <>
            <span style={{ fontWeight: 500, flex: 1 }}>Pacientes</span>
            {isActive && <i className={`bi bi-chevron-${showSub ? "down" : "right"}`} style={{ fontSize: "0.65rem", opacity: 0.6 }} />}
          </>
        )}
      </NavLink>

      {showSub && (
        <ul className="nav flex-column sidebar-submenu" style={{ padding: "2px 8px 4px 30px", gap: 1 }}>
          {subItems.map(sub => {
            const subIsActive =
              sub.key === "buscar"   ? location.pathname === "/pacientes" && !new URLSearchParams(location.search).get("nuevo") :
              sub.key === "nuevo"    ? location.pathname === "/pacientes" && new URLSearchParams(location.search).get("nuevo") === "true" :
              sub.key === "historia" ? location.pathname.startsWith("/historia") :
              sub.key === "estudios" ? location.pathname.startsWith("/estudios") : false;
            return (
              <li key={sub.key}>
                <NavLink
                  to={sub.to}
                  onClick={onNavigate}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "5px 10px", fontSize: "0.79rem", borderRadius: 6,
                    textDecoration: "none",
                    fontWeight: subIsActive ? 600 : 400,
                    color: subIsActive ? "#fff" : "rgba(148,163,184,0.85)",
                    background: subIsActive ? "rgba(33,150,243,0.18)" : "transparent",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  <i className={`bi ${sub.icon}`} style={{ fontSize: "0.8rem", width: 14, textAlign: "center", color: subIsActive ? "#2196f3" : "inherit" }} />
                  {sub.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
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
        {items.filter(item => item.to !== "/historia" && item.to !== "/estudios").map((item) => (
          item.to === "/citas"
            ? <CitasExpandable key="/citas" collapsed={collapsed} onNavigate={onNavigate} />
            : item.to === "/pacientes"
            ? <PacientesExpandable key="/pacientes" collapsed={collapsed} onNavigate={onNavigate} />
            : (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end
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
          )
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
        .sidebar-link:hover:not(.active) {
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

        /* ── Sub-menú animación ── */
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sidebar-submenu {
          animation: slideDown 0.18s ease;
        }

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

