import { useState, useRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import NavbarApp from "./NavbarApp";
import Sidebar from "./Sidebar";
import LicenciaVencidaModal from "./LicenciaVencidaModal";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed,  setCollapsed]  = useState(false);
  const mainRef = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [pathname]);

  const W = collapsed ? 64 : 240;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0d1b2e" }}>

      {/* Modal bloqueante de licencia vencida */}
      <LicenciaVencidaModal />

      {/* ── Navbar fija arriba ── */}
      <NavbarApp onMenuClick={() => setMobileOpen(o => !o)} />

      {/* ── Línea animada sobre el borde ── */}
      <div className="navline-bar" style={{
        height: 2,
        flexShrink: 0,
        marginLeft: W,
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(90deg, #1e40af, #3b82f6, #818cf8, #3b82f6, #1e40af)",
        boxShadow: "0 0 8px 1px rgba(96,165,250,.6), 0 0 20px 3px rgba(129,140,248,.3)",
        transition: "margin-left 0.25s ease",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: "35%", height: "100%",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,.95), transparent)",
          animation: "navline-shine 5s ease-in-out infinite",
        }} />
      </div>

      {/* ── Cuerpo debajo del navbar ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* Overlay móvil */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,.45)",
              zIndex: 1040,
            }}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          style={{
            width: W,
            minWidth: W,
            flexShrink: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "#0d1b2e",
            borderRight: "1px solid rgba(255,255,255,0.07)",
            transition: "width 0.25s ease, min-width 0.25s ease, transform 0.28s ease",
            overflow: "hidden",
            zIndex: 1045,
          }}
          className="sidebar-aside"
        >
          <Sidebar
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(c => !c)}
            onNavigate={() => setMobileOpen(false)}
          />
        </aside>

        {/* ── Botón flotante colapsar sidebar ── */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="d-none d-lg-flex"
          style={{
            position: "absolute",
            left: W - 14,
            top: collapsed ? 28 : 70,
            zIndex: 1050,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.15)",
            background: "#1a3356",
            color: "rgba(148,163,184,0.9)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
            transition: "left 0.25s ease, top 0.25s ease, background 0.15s, color 0.15s",
            padding: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#2196f3"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#2196f3"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#1a3356"; e.currentTarget.style.color = "rgba(148,163,184,0.9)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
        >
          <i
            className={`bi ${collapsed ? "bi-chevron-double-right" : "bi-chevron-double-left"}`}
            style={{ fontSize: "0.7rem" }}
          />
        </button>

        {/* Estilos responsivos */}
        <style>{`
          @media (max-width: 991.98px) {
            .sidebar-aside {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 240px !important;
              min-width: 240px !important;
              transform: ${mobileOpen ? "translateX(0)" : "translateX(-100%)"};
              box-shadow: ${mobileOpen ? "4px 0 24px rgba(0,0,0,.45)" : "none"};
            }
            .navline-bar {
              margin-left: 0 !important;
            }
          }
        `}</style>

        {/* ── Contenido principal ── */}
        <main
          ref={mainRef}
          className="flex-grow-1 p-3 p-md-4"
          style={{ overflowY: "auto", background: "#f1f5f9", minWidth: 0, height: "100%" }}
        >
          <div key={pathname} className="route-fade-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
