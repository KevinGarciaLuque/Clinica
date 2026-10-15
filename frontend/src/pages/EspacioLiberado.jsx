/**
 * Página pública: espacio liberado para un paciente en lista de espera.
 * URL: /espacio/:token  (llega por correo)
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

// "2026-10-20 15:30:00" es hora local de la clínica: se muestra tal cual
function formatear(inicio) {
  const [f, h] = String(inicio).split(" ");
  const [y, m, d] = f.split("-").map(Number);
  const [hh, mm] = h.split(":").map(Number);
  const fecha = new Date(y, m - 1, d).toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hora = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "a. m." : "p. m."}`;
  return { fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1), hora };
}

const MENSAJES = {
  TUYO:      { icon: "bi-check-circle-fill", color: "#10b981", titulo: "¡El espacio es tuyo!", texto: "Tu cita quedó confirmada. Te esperamos; llega 10 minutos antes." },
  TOMADO:    { icon: "bi-hourglass-bottom",  color: "#f59e0b", titulo: "Este espacio ya fue tomado", texto: "Otra persona de la lista lo aceptó primero. Sigues en la lista de espera y te avisaremos del próximo espacio." },
  RECHAZADA: { icon: "bi-info-circle-fill",  color: "#64748b", titulo: "Gracias por avisarnos", texto: "Sigues en la lista de espera y te avisaremos del próximo espacio." },
  VENCIDO:   { icon: "bi-clock-history",     color: "#64748b", titulo: "Este espacio ya pasó", texto: "Sigues en la lista de espera y te avisaremos del próximo espacio." },
  CERRADA:   { icon: "bi-info-circle-fill",  color: "#64748b", titulo: "Ya no estás en la lista de espera", texto: "Si necesitas una cita, comunícate con la clínica." },
};

function Marco({ children }) {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: "linear-gradient(135deg,#ecfdf5,#eff6ff)", padding: "2rem 1rem" }}>
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5" style={{ maxWidth: 480, width: "100%" }}>{children}</div>
    </div>
  );
}

export default function EspacioLiberado() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(null);

  useEffect(() => {
    axios.get(`${BASE}/espacio/${token}`)
      .then((r) => setD(r.data.data))
      .catch((e) => setError(e?.response?.data?.msg || "No se pudo cargar el espacio."));
  }, [token]);

  const responder = async (accion) => {
    setEnviando(accion); setError("");
    try {
      const r = await axios.post(`${BASE}/espacio/${token}/${accion}`);
      setD(r.data.data);
    } catch (e) {
      setError(e?.response?.data?.msg || "No se pudo completar. Intenta de nuevo.");
    } finally {
      setEnviando(null);
    }
  };

  if (!d) {
    return (
      <Marco>
        {error
          ? <div className="text-center"><i className="bi bi-link-45deg" style={{ fontSize: 48, color: "#94a3b8" }} /><h5 className="fw-bold mt-2">Enlace no válido</h5><p className="text-muted mb-0">{error}</p></div>
          : <div className="text-center text-muted py-4"><span className="spinner-border spinner-border-sm me-2" />Cargando…</div>}
      </Marco>
    );
  }

  const { fecha, hora } = formatear(d.inicio);
  const m = MENSAJES[d.situacion];

  return (
    <Marco>
      <div className="text-center mb-4">
        {d.logo_url
          ? <img src={d.logo_url} alt="" style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain" }} />
          : <i className="bi bi-hospital" style={{ fontSize: 40, color: "#10b981" }} />}
        <div className="fw-bold mt-2" style={{ color: "#0f172a" }}>{d.clinica}</div>
      </div>

      <h5 className="fw-bold mb-1" style={{ color: "#0f172a" }}>
        {d.situacion === "DISPONIBLE" ? `¡Se liberó un espacio${d.paciente ? `, ${d.paciente}` : ""}!` : `Hola${d.paciente ? `, ${d.paciente}` : ""}`}
      </h5>
      <p className="text-muted mb-3" style={{ fontSize: "0.92rem" }}>
        {d.situacion === "DISPONIBLE" ? "Estabas en la lista de espera y este horario quedó disponible:" : "Espacio ofrecido:"}
      </p>

      <div className="rounded-3 p-3 mb-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.93rem" }}>
        <div className="mb-2"><i className="bi bi-calendar-event me-2 text-primary" />{fecha}</div>
        <div className="mb-2"><i className="bi bi-clock me-2 text-primary" />{hora}</div>
        <div><i className="bi bi-person-badge me-2 text-primary" />{d.medico}</div>
      </div>

      {error && <div className="alert alert-warning py-2" style={{ fontSize: "0.85rem" }}>{error}</div>}

      {d.situacion === "DISPONIBLE" ? (
        <>
          <button className="btn w-100 mb-2 fw-semibold" disabled={!!enviando} onClick={() => responder("aceptar")}
            style={{ background: "#10b981", color: "#fff", borderRadius: 10, padding: 11 }}>
            {enviando === "aceptar" ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-check-lg me-1" />Quiero este espacio</>}
          </button>
          <button className="btn btn-light w-100" disabled={!!enviando} onClick={() => responder("rechazar")} style={{ borderRadius: 10 }}>
            {enviando === "rechazar" ? <span className="spinner-border spinner-border-sm" /> : "No me sirve este horario"}
          </button>
          <p className="text-muted mt-3 mb-0" style={{ fontSize: "0.8rem" }}>Se ofreció a varias personas de la lista: el primero que acepta se queda con el espacio.</p>
        </>
      ) : m && (
        <div className="d-flex gap-2 align-items-start">
          <i className={`bi ${m.icon}`} style={{ color: m.color, fontSize: 22 }} />
          <div>
            <div className="fw-bold" style={{ color: m.color }}>{m.titulo}</div>
            <div className="text-muted" style={{ fontSize: "0.88rem" }}>
              {m.texto}
              {d.clinica_telefono && d.situacion === "CERRADA" && <> Teléfono: <a href={`tel:${d.clinica_telefono}`}>{d.clinica_telefono}</a></>}
            </div>
          </div>
        </div>
      )}
    </Marco>
  );
}
