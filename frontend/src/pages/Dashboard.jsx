import { useAuth } from "../auth/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="container py-4">
      <h4 className="mb-2">Dashboard</h4>
      <p className="text-muted">
        Bienvenido/a: <b>{user?.nombres} {user?.apellidos}</b>
      </p>

      <div className="row g-3">
        <div className="col-md-4">
          <div className="card p-3 shadow-sm">
            <div className="fw-bold">Pacientes</div>
            <div className="text-muted">Registro y búsqueda</div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card p-3 shadow-sm">
            <div className="fw-bold">Citas</div>
            <div className="text-muted">Agendar sin solapamientos</div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card p-3 shadow-sm">
            <div className="fw-bold">Chat IA</div>
            <div className="text-muted">Asistente (placeholder)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
