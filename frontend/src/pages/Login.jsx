import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setMsg(err?.response?.data?.msg || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 450 }}>
      <h3 className="mb-3">Iniciar sesión</h3>

      <div className="alert alert-info">
        Clínica ID: <b>{import.meta.env.VITE_CLINICA_ID}</b>
      </div>

      {msg && <div className="alert alert-danger">{msg}</div>}

      <form onSubmit={submit} className="card p-3 shadow-sm">
        <label className="form-label">Email</label>
        <input
          className="form-control mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />

        <label className="form-label">Contraseña</label>
        <input
          className="form-control mb-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />

        <button className="btn btn-dark" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
