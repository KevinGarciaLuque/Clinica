import { NavLink } from "react-router-dom";

const modules = [
  "Administración de clínica",
  "Registro de pacientes",
  "Agendamiento inteligente",
  "Historia clínica electrónica",
  "Prescripción digital",
  "Estudios y exámenes",
  "Visualizador de imágenes",
  "Facturación simplificada",
  "Comunicación paciente-médico",
  "Reportes estándar",
  "Copia de seguridad y seguridad",
];

export default function Sidebar() {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-section">
        <p className="sidebar-title">Navegación rápida</p>
        <nav className="sidebar-nav">
          <NavLink className="sidebar-link" to="/">
            Panel principal
          </NavLink>
          <NavLink className="sidebar-link" to="/pacientes">
            Pacientes
          </NavLink>
          <NavLink className="sidebar-link" to="/citas">
            Citas
          </NavLink>
          <NavLink className="sidebar-link" to="/chat-ia">
            Chat IA
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-section">
        <p className="sidebar-title">Ruta modular</p>
        <ul className="sidebar-list">
          {modules.map((module) => (
            <li key={module} className="sidebar-list-item">
              <span className="sidebar-dot" aria-hidden="true"></span>
              <span>{module}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
