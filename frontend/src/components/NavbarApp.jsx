import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function NavbarApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const salir = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <Link className="navbar-brand" to="/">
          MULTI-CLÍNICA
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#nav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="nav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/pacientes">Pacientes</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/citas">Citas</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/chat-ia">Chat IA</Link>
            </li>
          </ul>

          <div className="d-flex align-items-center gap-2">
            <span className="text-white small">
              {user?.nombres} {user?.apellidos} ({user?.tipo})
            </span>
            <button className="btn btn-outline-light btn-sm" onClick={salir}>
              Salir
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
