/**
 * Página pública "Mi cita": el paciente llega desde el enlace del recordatorio
 * y confirma o cancela su cita sin iniciar sesión.
 * URL: /mi-cita/:token
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

const ESTADOS = {
  PENDIENTE:   { label: "Pendiente de confirmar", color: "#f59e0b", icon: "bi-hourglass-split" },
  CONFIRMADA:  { label: "Confirmada",             color: "#10b981", icon: "bi-check-circle-fill" },
  CANCELADA:   { label: "Cancelada",              color: "#ef4444", icon: "bi-x-circle-fill" },
  EN_ESPERA:   { label: "En sala de espera",      color: "#3b82f6", icon: "bi-people-fill" },
  EN_ATENCION: { label: "En atención",            color: "#3b82f6", icon: "bi-heart-pulse-fill" },
  COMPLETADA:  { label: "Atendida",               color: "#64748b", icon: "bi-clipboard2-check-fill" },
  NO_ASISTIO:  { label: "No asistió",             color: "#64748b", icon: "bi-calendar-x" },
};

// "2026-10-20 15:30:00" es hora local de la clínica: se muestra tal cual, sin convertir zona
function formatear(inicio) {
  const [f, h] = String(inicio).split(" ");
  const [y, m, d] = f.split("-").map(Number);
  const [hh, mm] = h.split(":").map(Number);
  const fecha = new Date(y, m - 1, d).toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hora = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "a. m." : "p. m."}`;
  return { fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1), hora };
}

function Marco({ children }) {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: "linear-gradient(135deg,#ecfdf5,#eff6ff)", padding: "2rem 1rem" }}>
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5" style={{ maxWidth: 480, width: "100%" }}>
        {children}
      </div>
    </div>
  );
}

export default function MiCita() {
  const { token } = useParams();
  const [cita, setCita] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [accion, setAccion] = useState(null);       // "confirmar" | "cancelar" mientras se envía
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  useEffect(() => {
    axios.get(`${BASE}/cita-publica/${token}`)
      .then((r) => setCita(r.data.data))
      .catch((e) => setError(e?.response?.data?.msg || "No se pudo cargar la cita."));
  }, [token]);

  const ejecutar = async (tipo) => {
    setAccion(tipo); setAviso("");
    try {
      const r = await axios.post(`${BASE}/cita-publica/${token}/${tipo}`);
      setCita(r.data.data);
      setConfirmarCancelar(false);
    } catch (e) {
      if (e?.response?.data?.data) setCita(e.response.data.data);
      setAviso(e?.response?.data?.msg || "No se pudo completar la acción. Intenta de nuevo.");
    } finally {
      setAccion(null);
    }
  };

  if (error) {
    return (
      <Marco>
        <div className="text-center">
          <i className="bi bi-link-45deg" style={{ fontSize: 48, color: "#94a3b8" }} />
          <h5 className="fw-bold mt-2">Enlace no válido</h5>
          <p className="text-muted mb-0">{error} Si necesitas ayuda, comunícate con tu clínica.</p>
        </div>
      </Marco>
    );
  }
  if (!cita) {
    return <Marco><div className="text-center text-muted py-4"><span className="spinner-border spinner-border-sm me-2" />Cargando tu cita…</div></Marco>;
  }

  const est = ESTADOS[cita.estado] || { label: cita.estado, color: "#64748b", icon: "bi-info-circle" };
  const { fecha, hora } = formatear(cita.inicio);

  return (
    <Marco>
      <div className="text-center mb-4">
        {cita.logo_url
          ? <img src={cita.logo_url} alt="" style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain" }} />
          : <i className="bi bi-hospital" style={{ fontSize: 40, color: "#10b981" }} />}
        <div className="fw-bold mt-2" style={{ color: "#0f172a" }}>{cita.clinica}</div>
      </div>

      <h5 className="fw-bold mb-1" style={{ color: "#0f172a" }}>Hola{cita.paciente ? `, ${cita.paciente}` : ""} 👋</h5>
      <p className="text-muted mb-3" style={{ fontSize: "0.92rem" }}>Estos son los datos de tu cita:</p>

      <div className="rounded-3 p-3 mb-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.93rem" }}>
        <div className="mb-2"><i className="bi bi-calendar-event me-2 text-primary" />{fecha}</div>
        <div className="mb-2"><i className="bi bi-clock me-2 text-primary" />{hora}</div>
        <div><i className="bi bi-person-badge me-2 text-primary" />{cita.medico}</div>
      </div>

      <div className="d-flex align-items-center gap-2 mb-4" style={{ color: est.color, fontWeight: 600 }}>
        <i className={`bi ${est.icon}`} /> {est.label}
      </div>

      {aviso && <div className="alert alert-warning py-2" style={{ fontSize: "0.85rem" }}>{aviso}</div>}

      {cita.puede_confirmar && !confirmarCancelar && (
        <button className="btn w-100 mb-2 fw-semibold" disabled={!!accion}
          style={{ background: "#10b981", color: "#fff", borderRadius: 10, padding: "11px" }}
          onClick={() => ejecutar("confirmar")}>
          {accion === "confirmar" ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check-lg me-1" />Sí, asistiré</>}
        </button>
      )}

      {cita.puede_cancelar && !confirmarCancelar && (
        <button className="btn btn-outline-danger w-100 fw-semibold" disabled={!!accion}
          style={{ borderRadius: 10, padding: "10px" }} onClick={() => setConfirmarCancelar(true)}>
          No podré asistir, cancelar cita
        </button>
      )}

      {confirmarCancelar && (
        <div className="rounded-3 p-3" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          <p className="mb-3" style={{ fontSize: "0.9rem", color: "#7f1d1d" }}>
            ¿Seguro que deseas cancelar tu cita? El espacio quedará libre para otro paciente.
          </p>
          <div className="d-flex gap-2">
            <button className="btn btn-light flex-fill" disabled={!!accion} onClick={() => setConfirmarCancelar(false)}>Volver</button>
            <button className="btn btn-danger flex-fill fw-semibold" disabled={!!accion} onClick={() => ejecutar("cancelar")}>
              {accion === "cancelar" ? <span className="spinner-border spinner-border-sm" /> : "Sí, cancelar"}
            </button>
          </div>
        </div>
      )}

      {cita.estado === "CONFIRMADA" && (
        <p className="text-muted mt-3 mb-0" style={{ fontSize: "0.85rem" }}>¡Gracias! Te esperamos. Te recomendamos llegar 10 minutos antes.</p>
      )}
      {cita.estado === "CANCELADA" && (
        <p className="text-muted mt-3 mb-0" style={{ fontSize: "0.85rem" }}>
          Tu cita quedó cancelada. Si deseas una nueva fecha, comunícate con la clínica
          {cita.clinica_telefono ? <> al <a href={`tel:${cita.clinica_telefono}`}>{cita.clinica_telefono}</a></> : null}.
        </p>
      )}
      {!cita.puede_cancelar && !["CONFIRMADA", "CANCELADA"].includes(cita.estado) && (
        <p className="text-muted mt-3 mb-0" style={{ fontSize: "0.85rem" }}>Esta cita ya no se puede modificar desde aquí.</p>
      )}
    </Marco>
  );
}
