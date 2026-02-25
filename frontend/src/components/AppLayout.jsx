import { useState } from "react";
import { Outlet } from "react-router-dom";
import NavbarApp from "./NavbarApp";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [collapsed,   setCollapsed]   = useState(false);

  const W = collapsed ? 64 : 240;

  return (
    <div className="d-flex flex-column" style={{ minHeight: "100vh" }}>
      <NavbarApp onMenuClick={() => setMobileOpen(o => !o)} />

      <div className="d-flex flex-grow-1" style={{ overflow: "hidden" }}>

        {/* Overlay móvil */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1040 }}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          style={{
            width: W,
            minWidth: W,
            height: "calc(100vh - 56px)",
            position: "sticky",
            top: 56,
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            borderRight: "1px solid #dee2e6",
            transition: "width 0.25s ease, min-width 0.25s ease, transform 0.28s ease",
            overflow: "hidden",
            zIndex: 1045,
            flexShrink: 0,
          }}
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
            aside {
              position: fixed !important;
              top: 56px !important;
              left: 0 !important;
              width: 240px !important;
              min-width: 240px !important;
              transform: ${mobileOpen ? "translateX(0)" : "translateX(-100%)"};
              box-shadow: ${mobileOpen ? "4px 0 20px rgba(0,0,0,.18)" : "none"};
            }
          }
        `}</style>

        {/* Contenido principal */}
        <main
          className="flex-grow-1 p-3 p-md-4"
          style={{ overflowY: "auto", background: "#f1f5f9", minWidth: 0 }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
