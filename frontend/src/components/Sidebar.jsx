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
  { to: "/dashboard", label: "Dashboard",        icon: "bi-speedometer2" },
  { to: "/pacientes", label: "Pacientes",         icon: "bi-people-fill" },
  { to: "/citas",     label: "Citas",             icon: "bi-calendar-check-fill" },
  { to: "/historia",  label: "Historia Clínica",  icon: "bi-journal-medical" },
  { to: "/chat-ia",   label: "Asistente IA",      icon: "bi-robot" },
];

const adminItems = [
  { to: "/admin/usuarios",   label: "Usuarios",          icon: "bi-person-badge-fill" },
  { to: "/admin/horarios",   label: "Horarios médicos",   icon: "bi-clock-fill" },
  { to: "/admin/servicios",  label: "Servicios",          icon: "bi-tag-fill" },
  { to: "/admin/plantillas", label: "Plantillas",         icon: "bi-file-earmark-text-fill" },
  { to: "/documentos-clinicos", label: "Documentos Clínicos", icon: "bi-file-earmark-richtext-fill" },
  { to: "/catalogos",        label: "Catálogos",          icon: "bi-journal-bookmark-fill" },
  { to: "/admin/config",     label: "Configuración",      icon: "bi-gear-fill" },
];

const medicoItems = [
  { to: "/admin/horarios",   label: "Horarios médicos",   icon: "bi-clock-fill" },
  { to: "/admin/servicios",  label: "Servicios",          icon: "bi-tag-fill" },
  { to: "/admin/plantillas", label: "Plantillas",         icon: "bi-file-earmark-text-fill" },
  { to: "/documentos-clinicos", label: "Documentos Clínicos", icon: "bi-file-earmark-richtext-fill" },
  { to: "/catalogos",        label: "Catálogos",          icon: "bi-journal-bookmark-fill" },
  { to: "/admin/config",     label: "Configuración",      icon: "bi-gear-fill" },
];

const superItems = [
  { to: "/superadmin/clinicas",        label: "Clínicas",        icon: "bi-building-fill" },
  { to: "/superadmin/reportes",        label: "Reportes",         icon: "bi-bar-chart-line-fill" },
  { to: "/superadmin/database",        label: "Base de Datos",   icon: "bi-database-fill-gear" },
  { to: "/superadmin/personalizacion", label: "Personalización", icon: "bi-palette-fill" },
  { to: "/superadmin/landing",         label: "Página Pública",  icon: "bi-globe2" },
];

/** Renderiza ícono: Bootstrap Icons (bi-*) o emoji/texto */
function SidebarIcon({ icon, style }) {
  if (!icon) return null;
  if (icon.startsWith("bi-")) return <i className={`bi ${icon}`} style={style} />;
  return <span style={{ lineHeight: 1, flexShrink: 0, ...style }}>{icon}</span>;
}

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

  // Clínica solo psicológica: ocultar Estudios e Imágenes
  const tienePsico       = mainItems.some(m => m.to === "/psicologia/consulta");
  const tieneOdonto      = mainItems.some(m => m.to === "/odontologia/consulta");
  const tieneConsulta    = mainItems.some(m => m.to === "/consulta");
  if (tienePsico && !tieneConsulta) {
    mainItems = mainItems.filter(m => m.to !== "/estudios");
  }
  // Clínica dental: ocultar "Consulta" genérica (la reemplaza "Consulta Odontológica")
  if (tieneOdonto && tieneConsulta) {
    mainItems = mainItems.filter(m => m.to !== "/consulta");
  }

  // MEDICO y ADMIN siempre deben ver Consulta (excepto en clínicas exclusivamente de psicología)
  if ((tipo === "MEDICO" || tipo === "ADMIN") && !tienePsico && !mainItems.some(m => m.to === "/consulta")) {
    const consulta = { to: "/consulta", label: "Consulta", icon: "bi-clipboard2-pulse-fill" };
    const citasIdx = mainItems.findIndex(m => m.to === "/citas");
    mainItems = citasIdx >= 0
      ? [...mainItems.slice(0, citasIdx + 1), consulta, ...mainItems.slice(citasIdx + 1)]
      : [...mainItems, consulta];
  }

  // Cumpleañeros — siempre visible para todos los roles (después de Vacunas)
  if (!mainItems.some(m => m.to === "/cumpleaneros")) {
    const cumple = { to: "/cumpleaneros", label: "Cumpleañeros", icon: "bi-cake2-fill" };
    const vacIdx = mainItems.findIndex(m => m.to === "/vacunas");
    if (vacIdx >= 0) {
      mainItems = [...mainItems.slice(0, vacIdx + 1), cumple, ...mainItems.slice(vacIdx + 1)];
    } else {
      // Si no hay vacunas, ponerlo después de pacientes
      const pacIdx = mainItems.findIndex(m => m.to === "/pacientes");
      mainItems = pacIdx >= 0
        ? [...mainItems.slice(0, pacIdx + 1), cumple, ...mainItems.slice(pacIdx + 1)]
        : [...mainItems, cumple];
    }
  }

  if (tipo === "SUPER_ADMIN") return { super: superItems, main: mainItems, admin: adminItems };
  if (tipo === "ADMIN")       return { super: [],          main: mainItems, admin: adminItems };
  if (tipo === "MEDICO")      return { super: [],          main: mainItems, admin: medicoItems };
  return                              { super: [],          main: mainItems, admin: [] };
}

/* ─── Rutas estéticas que se anidan bajo Consulta ───────────────── */
const ESTETICA_ROUTES = [
  "/estetica/ficha",
  "/estetica/galeria",
  "/estetica/presupuestos",
  "/estetica/consentimientos",
  "/estetica/seguimiento",
  "/estetica/biopsias",
];

/* ─── Sub-menú expandible para Consulta (clínicas estética/derm.) ── */
function ConsultaExpandable({ collapsed, onNavigate, esteticaItems }) {
  const location = useLocation();
  const isActive =
    location.pathname === "/consulta" ||
    location.pathname.startsWith("/estetica/");
  const [open, setOpen] = useState(isActive);

  useEffect(() => { if (isActive) setOpen(true); }, [isActive]);

  const showSub = open && isActive && !collapsed;

  return (
    <li>
      <NavLink
        to="/consulta"
        end
        onClick={(e) => {
          if (isActive) { e.preventDefault(); setOpen(o => !o); }
        }}
        title={collapsed ? "Consulta" : undefined}
        className={`nav-link d-flex align-items-center gap-2 sidebar-link ${
          isActive && !showSub ? "active" : isActive && showSub ? "sidebar-link-open" : ""
        }`}
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
          className="bi bi-clipboard2-pulse-fill"
          style={{ fontSize: "1.05rem", flexShrink: 0, width: collapsed ? "auto" : 18, textAlign: "center" }}
        />
        {!collapsed && (
          <>
            <span style={{ fontWeight: 500, flex: 1 }}>Consulta</span>
            {isActive && (
              <i
                className={`bi bi-chevron-${open ? "down" : "right"}`}
                style={{ fontSize: "0.65rem", opacity: 0.6 }}
              />
            )}
          </>
        )}
      </NavLink>

      {showSub && (
        <ul className="nav flex-column sidebar-submenu" style={{ padding: "2px 8px 4px 30px", gap: 1 }}>
          {/* Ítem fijo: Consulta Médica */}
          {(() => {
            const subIsActive = location.pathname === "/consulta";
            return (
              <li key="/consulta-item">
                <NavLink
                  to="/consulta"
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
                  <i
                    className="bi bi-clipboard2-pulse"
                    style={{ fontSize: "0.8rem", width: 14, textAlign: "center", color: subIsActive ? "#2196f3" : "inherit" }}
                  />
                  Consulta Médica
                </NavLink>
              </li>
            );
          })()}
          {/* Separador */}
          <li><div style={{ margin: "4px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" }} /></li>
          {esteticaItems.map(sub => {
            const subIsActive = location.pathname === sub.to;
            return (
              <li key={sub.to}>
                <NavLink
                  to={sub.to}
                  onClick={onNavigate}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "5px 10px", fontSize: "0.79rem", borderRadius: 6,
                    textDecoration: "none",
                    fontWeight: subIsActive ? 600 : 400,
                    color: subIsActive ? "#fff" : "rgba(148,163,184,0.85)",
                    background: subIsActive ? "rgba(233,30,140,0.18)" : "transparent",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  <SidebarIcon icon={sub.icon} style={{ fontSize: "0.8rem", width: 14, textAlign: "center", color: subIsActive ? "#e91e8c" : "inherit" }} />
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
        className={`nav-link d-flex align-items-center gap-2 sidebar-link ${isActive && !showSub ? "active" : isActive && showSub ? "sidebar-link-open" : ""}`}
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
                  <SidebarIcon icon={sub.icon} style={{ fontSize: "0.8rem", width: 14, textAlign: "center", color: subIsActive ? "#2196f3" : "inherit" }} />
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
function PacientesExpandable({ collapsed, onNavigate, allItems = [] }) {
  const location = useLocation();
  const isActive = location.pathname.startsWith("/pacientes") || location.pathname.startsWith("/historia") || location.pathname.startsWith("/estudios");
  const [open, setOpen] = useState(isActive);

  useEffect(() => { if (isActive) setOpen(true); }, [isActive]);

  const hasHistoria = allItems.some(m => m.to === "/historia");
  const hasEstudios = allItems.some(m => m.to === "/estudios");

  const subItems = [
    { to: "/pacientes",            label: "Buscar",              icon: "bi-search",           key: "buscar"   },
    { to: "/pacientes?nuevo=true", label: "Registrar",           icon: "bi-person-plus-fill", key: "nuevo"    },
    ...(hasHistoria ? [{ to: "/historia", label: "Historia Clínica",     icon: "bi-journal-medical", key: "historia" }] : []),
    ...(hasEstudios ? [{ to: "/estudios", label: "Estudios e Imágenes",  icon: "bi-film",            key: "estudios" }] : []),
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
        className={`nav-link d-flex align-items-center gap-2 sidebar-link ${isActive && !showSub ? "active" : isActive && showSub ? "sidebar-link-open" : ""}`}
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
                  <SidebarIcon icon={sub.icon} style={{ fontSize: "0.8rem", width: 14, textAlign: "center", color: subIsActive ? "#2196f3" : "inherit" }} />
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

  // Items estéticos se mostrarán como sub-menú de Consulta, no como top-level
  const esteticaItems = items.filter(item => ESTETICA_ROUTES.includes(item.to));

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
        {items
          .filter(item =>
            item.to !== "/historia" &&
            item.to !== "/estudios" &&
            !ESTETICA_ROUTES.includes(item.to)
          )
          .map((item) => (
          item.to === "/citas"
            ? <CitasExpandable key="/citas" collapsed={collapsed} onNavigate={onNavigate} />
            : item.to === "/pacientes"
            ? <PacientesExpandable key="/pacientes" collapsed={collapsed} onNavigate={onNavigate} allItems={items} />
            : item.to === "/consulta" && esteticaItems.length > 0
            ? <ConsultaExpandable key="/consulta" collapsed={collapsed} onNavigate={onNavigate} esteticaItems={esteticaItems} />
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
              <SidebarIcon icon={item.icon} style={{
                fontSize: "1.05rem",
                flexShrink: 0,
                width: collapsed ? "auto" : 18,
                textAlign: "center",
              }} />
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
  const initials = `${user?.nombres?.[0] ?? ""}${user?.apellidos?.[0] ?? ""}`;
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
        /* Padre expandido con sub-menú abierto: sutil, sin fondo fuerte */
        .sidebar-link-open {
          color: #fff !important;
          font-weight: 600;
          box-shadow: inset 3px 0 0 ${C.accent};
        }
        .sidebar-link-open i { color: ${C.accent}; }

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

        {/* ════════════ CABECERA USUARIO ════════════ */}
        <div style={{
          flexShrink: 0,
          padding: collapsed ? "10px 0 10px" : "12px 12px 14px",
          borderBottom: `1px solid ${C.divider}`,
          position: "relative",
          display: "flex",
          flexDirection: collapsed ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {!collapsed && (
            <>
              {/* Foto grande centrada */}
              <div style={{
                width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                border: "3px solid rgba(255,255,255,.18)",
                boxShadow: "0 4px 16px rgba(0,0,0,.5)",
                alignSelf: "center",
              }}>
                {user?.foto_url
                  ? <img src={user.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ color: "#fff", fontWeight: 700, fontSize: "1.5rem" }}>{initials}</span>
                }
              </div>
              {/* Nombre y rol debajo */}
              <div style={{ textAlign: "center", marginTop: 10, width: "100%" }}>
                <div style={{
                  color: "#fff", fontSize: "0.85rem", fontWeight: 700,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  padding: "0 8px",
                }}>
                  {user?.nombres} {user?.apellidos}
                </div>
                <div style={{
                  color: C.textMuted, fontSize: "0.68rem", marginTop: 2,
                  letterSpacing: "0.04em",
                }}>
                  {user?.tipo ?? "Usuario"}
                </div>
              </div>
              {/* Línea divisora decorativa */}
              <div style={{
                width: 40, height: 2, borderRadius: 2, marginTop: 12,
                background: "linear-gradient(90deg, transparent, #3b82f6, transparent)",
                alignSelf: "center",
              }} />
            </>
          )}

          {collapsed && (
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", border: "2px solid rgba(255,255,255,.15)",
              boxShadow: "0 2px 8px rgba(0,0,0,.4)",
            }}>
              {user?.foto_url
                ? <img src={user.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.78rem" }}>{initials}</span>
              }
            </div>
          )}


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
              Medic-KG v1.0 · 2026
            </span>
          </div>
        )}
      </div>
    </>
  );
}

