import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [msg,      setMsg]      = useState("");
  const [loading,  setLoading]  = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setMsg(err?.response?.data?.msg || "Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-bg {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          background-image: url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1920&q=80');
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
          padding: 1.5rem 1.5rem 1.5rem 6vw;
        }
        .login-bg::before {
          content: '';
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, rgba(10,30,60,0.72) 0%, rgba(0,80,100,0.60) 100%);
          z-index: 0;
        }
        .glass-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: rgba(255,255,255,0.10);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 1.5rem;
          padding: 2.5rem 2rem;
          box-shadow: 0 8px 40px rgba(0,0,0,0.35);
          color: #fff;
        }
        .glass-card .form-control {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.25);
          color: #fff;
          border-radius: 0.6rem;
        }
        .glass-card .form-control::placeholder { color: rgba(255,255,255,0.5); }
        .glass-card .form-control:focus {
          background: rgba(255,255,255,0.18);
          border-color: rgba(255,255,255,0.55);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.12);
          color: #fff;
        }
        .glass-card .form-label { color: rgba(255,255,255,0.85); font-size: 0.875rem; font-weight: 500; }
        .glass-card .input-group-text {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.25);
          color: rgba(255,255,255,0.7);
          cursor: pointer;
        }
        .btn-glass-primary {
          background: linear-gradient(135deg, #0ea5e9, #0369a1);
          border: none;
          border-radius: 0.6rem;
          color: #fff;
          font-weight: 600;
          letter-spacing: 0.03em;
          padding: 0.65rem;
          transition: opacity .2s, transform .15s;
        }
        .btn-glass-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); color: #fff; }
        .btn-glass-primary:disabled { opacity: 0.6; color: #fff; }
        .login-logo { font-size: 2.2rem; color: #38bdf8; }
        .divider-line {
          border-top: 1px solid rgba(255,255,255,0.15);
          margin: 1.5rem 0;
        }
      `}</style>

      <div className="login-bg">
        <div className="glass-card">

          {/* Logo / encabezado */}
          <div className="text-center mb-4">
            <div className="login-logo mb-2">
              <i className="bi bi-hospital" />
            </div>
            <h4 className="fw-bold mb-0" style={{ letterSpacing: ".02em" }}>Multi-Clínica</h4>
            <p className="mb-0" style={{ color: "rgba(255,255,255,.55)", fontSize: ".85rem" }}>
              Sistema de gestión clínica
            </p>
          </div>

          <hr className="divider-line" />

          {msg && (
            <div className="alert py-2 mb-3 text-center"
              style={{ background: "rgba(239,68,68,.25)", border: "1px solid rgba(239,68,68,.45)",
                       color: "#fca5a5", borderRadius: ".6rem", fontSize: ".875rem" }}>
              <i className="bi bi-exclamation-circle me-2" />{msg}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="form-label">Correo electrónico</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-envelope" /></span>
                <input
                  className="form-control"
                  type="email"
                  placeholder="usuario@clinica.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label">Contraseña</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-lock" /></span>
                <input
                  className="form-control"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <span className="input-group-text" onClick={() => setShowPass(s => !s)}>
                  <i className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"}`} />
                </span>
              </div>
            </div>

            <button className="btn btn-glass-primary w-100" type="submit" disabled={loading}>
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2" />Verificando...</>
                : <><i className="bi bi-box-arrow-in-right me-2" />Iniciar sesión</>
              }
            </button>
          </form>

          <p className="text-center mt-4 mb-0" style={{ color: "rgba(255,255,255,.35)", fontSize: ".75rem" }}>
            © {new Date().getFullYear()} Multi-Clínica · Todos los derechos reservados <br /> Kevin Garcia
          </p>
        </div>
      </div>
    </>
  );
}
