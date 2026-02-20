/**
 * Página de verificación de email
 * URL: /verificar-email?token=xxxxx
 *
 * Llama al backend al montar y muestra el resultado.
 */
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

export default function VerificarEmail() {
  const [params]  = useSearchParams();
  const token     = params.get("token") || "";

  const [estado,  setEstado]  = useState("cargando"); // cargando | ok | error
  const [msg,     setMsg]     = useState("");
  const [nombres, setNombres] = useState("");

  useEffect(() => {
    if (!token) {
      setEstado("error");
      setMsg("No se encontró el token de verificación en la URL.");
      return;
    }

    axios
      .get(`${BASE}/registro/verificar/${token}`)
      .then((res) => {
        setEstado("ok");
        setMsg(res.data.msg);
        setNombres(res.data.nombres || "");
      })
      .catch((err) => {
        setEstado("error");
        const d = err?.response?.data;
        setMsg(d?.msg || "Ocurrió un error al verificar el enlace.");
      });
  }, [token]);

  return (
    <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center"
         style={{ background: "#f1f5f9", padding: "2rem" }}>

      <div className="card border-0 shadow-sm rounded-4 p-5 text-center" style={{ maxWidth: 480, width: "100%" }}>

        {/* ── Cargando ── */}
        {estado === "cargando" && (
          <>
            <div className="spinner-border text-primary mb-4 mx-auto" style={{ width: 56, height: 56 }} />
            <h5 className="fw-bold text-dark">Verificando tu correo…</h5>
            <p className="text-muted">Por favor espera un momento.</p>
          </>
        )}

        {/* ── Éxito ── */}
        {estado === "ok" && (
          <>
            <div
              className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-4"
              style={{ width: 80, height: 80 }}
            >
              <i className="bi bi-patch-check-fill text-success" style={{ fontSize: "2.4rem" }} />
            </div>
            <h4 className="fw-bold text-dark mb-2">¡Cuenta verificada!</h4>
            {nombres && (
              <p className="text-muted mb-1">
                Hola <strong>{nombres}</strong>, tu correo fue confirmado correctamente.
              </p>
            )}
            <p className="text-muted mb-4">{msg}</p>
            <Link to="/login" className="btn btn-success px-5">
              <i className="bi bi-box-arrow-in-right me-2" />
              Iniciar sesión
            </Link>
          </>
        )}

        {/* ── Error ── */}
        {estado === "error" && (
          <>
            <div
              className="rounded-circle bg-danger bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-4"
              style={{ width: 80, height: 80 }}
            >
              <i className="bi bi-x-circle-fill text-danger" style={{ fontSize: "2.4rem" }} />
            </div>
            <h4 className="fw-bold text-dark mb-2">Enlace inválido</h4>
            <p className="text-muted mb-4">{msg}</p>

            <div className="d-flex flex-column gap-2">
              <Link to="/registro" className="btn btn-outline-primary">
                <i className="bi bi-person-plus me-1" />
                Volver a registrarse
              </Link>
              <Link to="/login" className="btn btn-link text-muted">
                Ya tengo cuenta — Iniciar sesión
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
