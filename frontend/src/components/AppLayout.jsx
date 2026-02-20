import { Outlet } from "react-router-dom";
import NavbarApp from "./NavbarApp";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="d-flex flex-column" style={{ minHeight: "100vh" }}>
      <NavbarApp />
      <div className="d-flex flex-grow-1" style={{ overflow: "hidden" }}>
        {/* Sidebar */}
        <aside
          className="bg-white border-end d-flex flex-column py-3"
          style={{
            width: 240,
            minWidth: 240,
            height: "calc(100vh - 56px)",
            position: "sticky",
            top: 56,
            overflowY: "auto",
          }}
        >
          <Sidebar />
        </aside>

        {/* Main content */}
        <main
          className="flex-grow-1 p-4"
          style={{ overflowY: "auto", background: "#f1f5f9" }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
