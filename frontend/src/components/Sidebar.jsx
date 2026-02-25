import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const base = [
  { to: "/",          label: "Dashboard",        icon: "bi-speedometer2" },
  { to: "/pacientes", label: "Pacientes",         icon: "bi-people-fill" },
  { to: "/citas",     label: "Citas",             icon: "bi-calendar-check-fill" },
  { to: "/historia",  label: "Historia Clínica",  icon: "bi-journal-medical" },
  { to: "/chat-ia",   label: "Asistente IA",      icon: "bi-robot" },
];

const adminItems = [
  { to: "/admin/usuarios",  label: "Usuarios",        icon: "bi-person-badge-fill" },
  { to: "/admin/horarios",  label: "Horarios médicos", icon: "bi-clock-fill" },
  { to: "/admin/servicios", label: "Servicios",        icon: "bi-tag-fill" },
  { to: "/admin/config",    label: "Configuración",    icon: "bi-gear-fill" },
];

const superItems = [
  { to: "/superadmin/clinicas", label: "Clínicas", icon: "bi-building-fill" },
];

function getMenuSections(tipo) {
  if (tipo === "SUPER_ADMIN") return { super: superItems, main: base, admin: adminItems };
  if (tipo === "ADMIN")       return { super: [],          main: base, admin: adminItems };
  return                              { super: [],          main: base, admin: [] };
}

function SidebarSection({ title, items, collapsed, onNavigate }) {
  if (!items.length) return null;
  return (
    <div className="mb-1">
      {/* Título de sección: solo cuando expandido */}
      {!collapsed && (
        <div
          className="px-3 mb-1 text-uppercase fw-bold text-muted"
          style={{ fontSize: "0.6rem", letterSpacing: "0.1em", whiteSpace: "nowrap" }}
        >
          {title}
        </div>
      )}
      {collapsed && <div style={{ height: 8 }} />}

      <ul className="nav flex-column gap-1" style={{ padding: collapsed ? "0 8px" : "0 8px" }}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `nav-link d-flex align-items-center gap-2 rounded fw-medium ${
                  isActive ? "bg-primary bg-opacity-10 text-primary" : "text-secondary"
                }`
              }
              style={{
                fontSize: "0.875rem",
                padding: collapsed ? "10px 0" : "8px 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <i
                className={`bi ${item.icon}`}
                style={{ fontSize: "1.05rem", flexShrink: 0, width: collapsed ? "auto" : 18, textAlign: "center" }}
              />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar({ collapsed, onToggleCollapse, onNavigate }) {
  const { user } = useAuth();
  const { super: sItems, main, admin } = getMenuSections(user?.tipo);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Identity strip (fijo arriba, no hace scroll) ── */}
      <div
        style={{
          flexShrink: 0,
          borderBottom: "1px solid #dee2e6",
          padding: collapsed ? "12px 8px" : "12px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          overflow: "hidden",
        }}
      >
        <div
          className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold"
          style={{ width: 34, height: 34, fontSize: "0.8rem", flexShrink: 0 }}
          title={collapsed ? `${user?.nombres} ${user?.apellidos}` : undefined}
        >
          {user?.nombres?.[0]}{user?.apellidos?.[0]}
        </div>
        {!collapsed && (
          <div style={{ lineHeight: 1.25, minWidth: 0, overflow: "hidden" }}>
            <div
              className="fw-semibold text-dark text-truncate"
              style={{ fontSize: "0.8rem" }}
            >
              {user?.nombres} {user?.apellidos}
            </div>
            <span className="badge bg-secondary" style={{ fontSize: "0.6rem" }}>
              {user?.tipo}
            </span>
          </div>
        )}
      </div>

      {/* ── Menú (scrollable) ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 8 }}>
        <SidebarSection title="Super Admin"    items={sItems} collapsed={collapsed} onNavigate={onNavigate} />
        <SidebarSection title="Clínica"        items={main}   collapsed={collapsed} onNavigate={onNavigate} />
        <SidebarSection title="Administración" items={admin}  collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      {/* ── Botón colapsar (fijo abajo, solo desktop) ── */}
      <div
        className="d-none d-lg-flex"
        style={{
          flexShrink: 0,
          borderTop: "1px solid #dee2e6",
          padding: "8px",
          justifyContent: collapsed ? "center" : "flex-end",
        }}
      >
        <button
          onClick={onToggleCollapse}
          className="btn btn-sm btn-outline-secondary"
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          style={{ width: collapsed ? 40 : "auto", padding: "4px 10px" }}
        >
          <i className={`bi ${collapsed ? "bi-layout-sidebar" : "bi-layout-sidebar-reverse"}`} />
          {!collapsed && <span className="ms-1" style={{ fontSize: "0.75rem" }}>Colapsar</span>}
        </button>
      </div>
    </div>
  );
}

