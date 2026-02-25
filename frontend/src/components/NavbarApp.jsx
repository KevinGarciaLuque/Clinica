import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const ROLE_COLOR = {
  SUPER_ADMIN:   "danger",
  ADMIN:         "warning",
  MEDICO:        "success",
  ENFERMERA:     "info",
  RECEPCIONISTA: "secondary",
};

export default function NavbarApp({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const salir = () => { logout(); navigate("/login"); };

  const initials = `${user?.nombres?.[0] ?? ""}${user?.apellidos?.[0] ?? ""}`;

  return (
    <nav
      className="navbar navbar-dark bg-dark px-3 d-flex align-items-center justify-content-between"
      style={{ height: 56, minHeight: 56 }}
    >
      {/* Brand + hamburguesa */}
      <div className="d-flex align-items-center gap-2">
        {/* Botón hamburguesa solo en móvil */}
        <button
          className="btn btn-outline-secondary btn-sm d-lg-none border-0 text-white"
          onClick={onMenuClick}
          aria-label="Menú"
        >
          <i className="bi bi-list fs-5" />
        </button>
        <span className="navbar-brand mb-0 fw-bold d-flex align-items-center gap-2">
          <i className="bi bi-hospital-fill text-primary fs-5" />
          <span className="d-none d-sm-inline">Multi-Clínica</span>
        </span>
      </div>

      {/* Right side: user + logout */}
      <div className="d-flex align-items-center gap-2 gap-md-3">
        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
            style={{ width: 32, height: 32, fontSize: "0.75rem" }}
          >
            {initials}
          </div>
          <div className="d-none d-md-block" style={{ lineHeight: 1.2 }}>
            <div className="text-white fw-semibold" style={{ fontSize: "0.82rem" }}>
              {user?.nombres} {user?.apellidos}
            </div>
            <span
              className={`badge bg-${ROLE_COLOR[user?.tipo] ?? "secondary"}`}
              style={{ fontSize: "0.6rem" }}
            >
              {user?.tipo}
            </span>
          </div>
        </div>
        <button className="btn btn-outline-light btn-sm" onClick={salir}>
          <i className="bi bi-box-arrow-right me-1 d-none d-sm-inline" />
          <i className="bi bi-box-arrow-right d-sm-none" />
          <span className="d-none d-sm-inline">Salir</span>
        </button>
      </div>
    </nav>
  );
}
