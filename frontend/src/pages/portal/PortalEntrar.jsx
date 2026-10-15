// /portal/entrar/:token — canjea el enlace del correo por una sesión del portal
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { portalApi, guardarSesion } from "./portalApi";

export default function PortalEntrar() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const enviado = useRef(false); // el enlace es de un solo uso: evita el doble envío de StrictMode

  useEffect(() => {
    if (enviado.current) return;
    enviado.current = true;
    portalApi.entrar(token)
      .then((r) => { guardarSesion(r.data.token); navigate("/portal", { replace: true }); })
      .catch((e) => setError(e?.response?.data?.msg || "No se pudo iniciar sesión."));
  }, [token, navigate]);

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: "linear-gradient(135deg,#ecfdf5,#eff6ff)", padding: "2rem 1rem" }}>
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 text-center" style={{ maxWidth: 440, width: "100%" }}>
        {error ? (
          <>
            <i className="bi bi-link-45deg" style={{ fontSize: 48, color: "#94a3b8" }} />
            <h5 className="fw-bold mt-2">No pudimos abrir tu portal</h5>
            <p className="text-muted">{error}</p>
            <Link to="/portal" className="btn fw-semibold" style={{ background: "#10b981", color: "#fff", borderRadius: 10 }}>Pedir un enlace nuevo</Link>
          </>
        ) : (
          <div className="text-muted py-3"><span className="spinner-border spinner-border-sm me-2" />Entrando a tu portal…</div>
        )}
      </div>
    </div>
  );
}
