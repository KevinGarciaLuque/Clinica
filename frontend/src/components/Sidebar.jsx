import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const base = [
  { to: "/",          label: "Dashboard",          icon: "bi-speedometer2" },
  { to: "/pacientes", label: "Pacientes",           icon: "bi-people-fill" },
  { to: "/citas",     label: "Citas",               icon: "bi-calendar-check-fill" },
  { to: "/historia",  label: "Historia Clínica",    icon: "bi-journal-medical" },
  { to: "/chat-ia",   label: "Asistente IA",        icon: "bi-robot" },
];

const adminItems = [
  { to: "/admin/usuarios",  label: "Usuarios",         icon: "bi-person-badge-fill" },
  { to: "/admin/horarios",  label: "Horarios médicos",  icon: "bi-clock-fill" },
  { to: "/admin/servicios", label: "Servicios",         icon: "bi-tag-fill" },
  { to: "/admin/config",    label: "Configuración",     icon: "bi-gear-fill" },
];

const superItems = [
  { to: "/superadmin/clinicas", label: "Clínicas", icon: "bi-building-fill" },
];

function getMenuSections(tipo) {
  if (tipo === "SUPER_ADMIN") return { super: superItems, main: base, admin: adminItems };
  if (tipo === "ADMIN")       return { super: [],          main: base, admin: adminItems };
  return                              { super: [],          main: base, admin: [] };
}

function SidebarSection({ title, items }) {
  if (!items.length) return null;
  return (
    <div className="mb-2">
      <div
        className="px-3 mb-1 text-uppercase fw-bold text-muted"
        style={{ fontSize: "0.65rem", letterSpacing: "0.1em" }}
      >
        {title}
      </div>
      <ul className="nav flex-column px-2 gap-1">
        {items.map((item) => (
          <li key={item.to} className="nav-item">
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-link d-flex align-items-center gap-2 py-2 px-2 rounded fw-medium ${
                  isActive
                    ? "bg-primary bg-opacity-10 text-primary"
                    : "text-secondary"
                }`
              }
              style={{ fontSize: "0.875rem" }}
            >
              <i className={`bi ${item.icon}`} style={{ fontSize: "1rem", width: 18, textAlign: "center" }} />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const { super: sItems, main, admin } = getMenuSections(user?.tipo);

  return (
    <>
      {/* Identity strip */}
      <div className="px-3 pb-3 mb-2 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
            style={{ width: 34, height: 34, fontSize: "0.8rem" }}
          >
            {user?.nombres?.[0]}{user?.apellidos?.[0]}
          </div>
          <div style={{ lineHeight: 1.25 }}>
            <div className="fw-semibold text-dark" style={{ fontSize: "0.8rem" }}>
              {user?.nombres} {user?.apellidos}
            </div>
            <span className="badge bg-secondary" style={{ fontSize: "0.6rem" }}>
              {user?.tipo}
            </span>
          </div>
        </div>
      </div>

      <SidebarSection title="Super Admin"     items={sItems} />
      <SidebarSection title="Clínica"         items={main}   />
      <SidebarSection title="Administración"  items={admin}  />
    </>
  );
}

