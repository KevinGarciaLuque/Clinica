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

function SidebarSection({ title, items, collapsed, onNavigate, showDivider }) {
  if (!items.length) return null;
  return (
    <div>
      {showDivider && !collapsed && (
        <div style={{ margin: "4px 12px", borderTop: "1px solid #e9ecef" }} />
      )}
      {!collapsed && (
        <div
          style={{
            padding: "10px 14px 4px",
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#94a3b8",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      )}
      {collapsed && showDivider && (
        <div style={{ margin: "6px 10px", borderTop: "1px solid #e9ecef" }} />
      )}

      <ul className="nav flex-column" style={{ padding: "0 8px", gap: 2 }}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `nav-link d-flex align-items-center gap-2 rounded-3 fw-medium sidebar-link ${
                  isActive ? "active" : ""
                }`
              }
              style={{
                fontSize: "0.855rem",
                padding: collapsed ? "9px 0" : "7px 10px",
                justifyContent: collapsed ? "center" : "flex-start",
                whiteSpace: "nowrap",
                overflow: "hidden",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <i
                className={`bi ${item.icon}`}
                style={{ fontSize: "1rem", flexShrink: 0, width: collapsed ? "auto" : 18, textAlign: "center" }}
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
    <>
      <style>{`
        .sidebar-link { color: #4b5563; }
        .sidebar-link:hover { background: #f1f5f9 !important; color: #1e40af !important; }
        .sidebar-link.active { background: #eff6ff !important; color: #1d4ed8 !important; font-weight: 600; }
        .sidebar-link.active i { color: #2563eb; }
        .btn-collapse-sidebar {
          border: none;
          background: transparent;
          color: #64748b;
          border-radius: 8px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
          cursor: pointer;
          flex-shrink: 0;
        }
        .btn-collapse-sidebar:hover {
          background: #e2e8f0;
          color: #1e40af;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

        {/* ── Cabecera: avatar + nombre + botón colapsar ── */}
        {collapsed ? (
          /* Modo colapsado: botón arriba, avatar abajo — todo centrado */
          <div
            style={{
              flexShrink: 0,
              borderBottom: "1px solid #e9ecef",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "8px 0 10px",
            }}
          >
            <button
              onClick={onToggleCollapse}
              className="btn-collapse-sidebar d-none d-lg-flex"
              title="Expandir menú"
            >
              <i className="bi bi-chevron-double-right" style={{ fontSize: "0.82rem" }} />
            </button>
            <div
              className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold"
              style={{ width: 32, height: 32, fontSize: "0.75rem", flexShrink: 0, letterSpacing: 0.5 }}
              title={`${user?.nombres ?? ""} ${user?.apellidos ?? ""}`}
            >
              {user?.nombres?.[0]}{user?.apellidos?.[0]}
            </div>
          </div>
        ) : (
          /* Modo expandido: fila horizontal */
          <div
            style={{
              flexShrink: 0,
              borderBottom: "1px solid #e9ecef",
              padding: "10px 10px 10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 56,
              overflow: "hidden",
            }}
          >
            <div
              className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold"
              style={{ width: 34, height: 34, fontSize: "0.78rem", flexShrink: 0, letterSpacing: 0.5 }}
            >
              {user?.nombres?.[0]}{user?.apellidos?.[0]}
            </div>
            <div style={{ flex: 1, lineHeight: 1.3, minWidth: 0, overflow: "hidden" }}>
              <div className="fw-semibold text-dark text-truncate" style={{ fontSize: "0.8rem" }}>
                {user?.nombres} {user?.apellidos}
              </div>
              <span
                className="badge"
                style={{
                  fontSize: "0.58rem",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                {user?.tipo}
              </span>
            </div>
            <button
              onClick={onToggleCollapse}
              className="btn-collapse-sidebar d-none d-lg-flex"
              title="Colapsar menú"
            >
              <i className="bi bi-chevron-double-left" style={{ fontSize: "0.82rem" }} />
            </button>
          </div>
        )}

        {/* ── Menú (scrollable) ── */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingTop: 6, paddingBottom: 8 }}>
          <SidebarSection title="Super Admin"    items={sItems} collapsed={collapsed} onNavigate={onNavigate} showDivider={false} />
          <SidebarSection title="Clínica"        items={main}   collapsed={collapsed} onNavigate={onNavigate} showDivider={sItems.length > 0} />
          <SidebarSection title="Administración" items={admin}  collapsed={collapsed} onNavigate={onNavigate} showDivider={true} />
        </div>
      </div>
    </>
  );
}

