import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useConfigSistema } from "../context/ConfigSistemaContext";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

function darken(hex, pct) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * pct));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(2.55 * pct));
  const b = Math.max(0, (num & 0xff) - Math.round(2.55 * pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default function RestablecerContrasena() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const cfg = useConfigSistema();
  const color     = cfg.landing_color_primario || cfg.color_primario || "#0E1F3C";
  const colorDark = darken(color, 25);

  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [listo,     setListo]     = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!token) {
      setMsg("El enlace no es válido — falta el token.");
      return;
    }
    if (password.length < 6) {
      setMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== password2) {
      setMsg("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${BASE}/auth/reset-password`, { token, password_nuevo: password });
      setListo(true);
    } catch (err) {
      setMsg(err?.response?.data?.msg || "No se pudo restablecer la contraseña. El enlace pudo haber expirado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-bg {
          min-height: 100vh; width: 100%; display: flex; align-items: center;
          justify-content: flex-start; background-image: url('${cfg.fondoUrl}');
          background-size: cover; background-position: center; background-attachment: fixed;
          padding: 1.5rem 1.5rem 1.5rem 6vw;
        }
        .login-bg::before {
          content: ''; position: fixed; inset: 0;
          background: linear-gradient(135deg, ${color}b8 0%, ${colorDark}99 100%); z-index: 0;
        }
        .glass-card {
          position: relative; z-index: 1; width: 100%; max-width: 420px;
          background: rgba(255,255,255,0.10); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255,255,255,0.22); border-radius: 1.5rem; padding: 2.5rem 2rem;
          box-shadow: 0 8px 40px rgba(0,0,0,0.35); color: #fff;
        }
        .glass-card .form-control {
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25);
          color: #fff; border-radius: 0.6rem;
        }
        .glass-card .form-control::placeholder { color: rgba(255,255,255,0.5); }
        .glass-card .form-control:focus {
          background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.55);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.12); color: #fff;
        }
        .glass-card .form-label { color: rgba(255,255,255,0.85); font-size: 0.875rem; font-weight: 500; }
        .glass-card .input-group-text {
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25);
          color: rgba(255,255,255,0.7); cursor: pointer;
        }
        .btn-glass-primary {
          background: linear-gradient(135deg, ${color}, ${colorDark}); border: none; border-radius: 0.6rem;
          color: #fff; font-weight: 600; letter-spacing: 0.03em; padding: 0.65rem;
          transition: opacity .2s, transform .15s;
        }
        .btn-glass-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); color: #fff; }
        .btn-glass-primary:disabled { opacity: 0.6; color: #fff; }
        .btn-back-home {
          display: inline-flex; align-items: center; gap: 0.45rem; background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.28); border-radius: 2rem; color: rgba(255,255,255,0.85);
          font-size: 0.82rem; font-weight: 500; padding: 0.42rem 1rem; text-decoration: none;
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); cursor: pointer;
          position: absolute; top: 1.2rem; left: 50%; transform: translateX(-50%); white-space: nowrap; z-index: 2;
        }
        .btn-back-home:hover { background: rgba(255,255,255,0.20); border-color: rgba(255,255,255,0.55); color: #fff; }
      `}</style>

      <div className="login-bg">
        <button type="button" className="btn-back-home" onClick={() => navigate("/login")}>
          <i className="bi bi-arrow-left-circle" />
          Volver al login
        </button>

        <div className="glass-card">
          <div className="text-center mb-4">
            <div style={{ fontSize: "2.2rem", color }}>
              <i className="bi bi-shield-lock-fill" />
            </div>
            <h4 className="fw-bold mb-1">Nueva contraseña</h4>
            {!listo && (
              <p className="mb-0" style={{ color: "rgba(255,255,255,.6)", fontSize: ".85rem" }}>
                Escribe tu nueva contraseña para tu cuenta.
              </p>
            )}
          </div>

          {msg && (
            <div className="alert py-2 mb-3 text-center"
              style={{ background: "rgba(239,68,68,.25)", border: "1px solid rgba(239,68,68,.45)",
                       color: "#fca5a5", borderRadius: ".6rem", fontSize: ".875rem" }}>
              <i className="bi bi-exclamation-circle me-2" />{msg}
            </div>
          )}

          {listo ? (
            <>
              <div className="alert py-3 text-center mb-4"
                style={{ background: "rgba(34,197,94,.18)", border: "1px solid rgba(34,197,94,.4)",
                         color: "#bbf7d0", borderRadius: ".6rem", fontSize: ".875rem" }}>
                <i className="bi bi-check-circle-fill me-2" />
                Tu contraseña fue actualizada correctamente.
              </div>
              <button className="btn btn-glass-primary w-100" onClick={() => navigate("/login")}>
                <i className="bi bi-box-arrow-in-right me-2" />Ir a iniciar sesión
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label">Nueva contraseña</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock" /></span>
                  <input
                    className="form-control"
                    type={showPass ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    autoFocus
                  />
                  <span className="input-group-text" onClick={() => setShowPass(s => !s)}>
                    <i className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"}`} />
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label">Confirmar contraseña</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock-fill" /></span>
                  <input
                    className="form-control"
                    type={showPass ? "text" : "password"}
                    placeholder="Repite la contraseña"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button className="btn btn-glass-primary w-100" type="submit" disabled={loading}>
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-2" />Guardando...</>
                  : <><i className="bi bi-check2-circle me-2" />Restablecer contraseña</>
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
