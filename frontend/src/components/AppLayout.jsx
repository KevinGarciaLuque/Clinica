import { useState } from "react";
import { Outlet } from "react-router-dom";
import NavbarApp from "./NavbarApp";
import Sidebar from "./Sidebar";
import LicenciaVencidaModal from "./LicenciaVencidaModal";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed,  setCollapsed]  = useState(false);

  const W = collapsed ? 64 : 240;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Modal bloqueante de licencia vencida */}
      <LicenciaVencidaModal />

      {/* ── Navbar fija arriba ── */}
      <NavbarApp onMenuClick={() => setMobileOpen(o => !o)} />

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
          }
        `}</style>

        {/* ── Contenido principal ── */}
        <main
          className="flex-grow-1 p-3 p-md-4"
          style={{ overflowY: "auto", background: "#f1f5f9", minWidth: 0, height: "100%" }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
