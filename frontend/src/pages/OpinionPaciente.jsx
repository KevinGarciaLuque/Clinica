/**
 * Encuesta de opinión del paciente — /opinion/:token  (llega por correo)
 * ?e=1..5 preselecciona las estrellas tocadas en el correo.
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const ETIQUETAS = { 1: "Muy mala", 2: "Mala", 3: "Regular", 4: "Buena", 5: "Excelente" };

function Marco({ children }) {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: "linear-gradient(135deg,#fffbeb,#f1f5f9)", padding: "2rem 1rem" }}>
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5" style={{ maxWidth: 480, width: "100%" }}>{children}</div>
    </div>
  );
}

export default function OpinionPaciente() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [estrellas, setEstrellas] = useState(() => {
    const e = Number(params.get("e"));
    return e >= 1 && e <= 5 ? e : 0;
  });
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [mostrarNombre, setMostrarNombre] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    axios.get(`${API}/api/opiniones/token/${token}`)
      .then((r) => setD(r.data.data))
      .catch((e) => setError(e?.response?.data?.msg || "No se pudo cargar la encuesta."));
  }, [token]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!estrellas) return setAviso("Elige de 1 a 5 estrellas.");
    setEnviando(true); setAviso("");
    try {
      const r = await axios.post(`${API}/api/opiniones/token/${token}`, { estrellas, comentario, mostrar_nombre: mostrarNombre });
      setD(r.data.data);
    } catch (err) {
      setAviso(err?.response?.data?.msg || "No se pudo enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (error) {
    return <Marco><div className="text-center"><i className="bi bi-link-45deg" style={{ fontSize: 48, color: "#94a3b8" }} /><h5 className="fw-bold mt-2">Enlace no válido</h5><p className="text-muted mb-0">{error}</p></div></Marco>;
  }
  if (!d) return <Marco><div className="text-center text-muted py-4"><span className="spinner-border spinner-border-sm me-2" />Cargando…</div></Marco>;

  if (d.respondida) {
    return (
      <Marco>
        <div className="text-center">
          <div style={{ fontSize: 46 }}>🙏</div>
          <h5 className="fw-bold mt-2 mb-1">¡Gracias por tu opinión!</h5>
          <div style={{ color: "#f59e0b", fontSize: 24, letterSpacing: 2 }}>{"★".repeat(d.estrellas || 0)}<span style={{ color: "#e2e8f0" }}>{"★".repeat(5 - (d.estrellas || 0))}</span></div>
          <p className="text-muted mt-2" style={{ fontSize: "0.9rem" }}>Ayuda a otros pacientes y a {d.medico} a seguir mejorando.</p>
          {d.google_url && (
            <>
              <p className="mt-3 mb-2" style={{ fontSize: "0.92rem" }}>¿Nos ayudas con una reseña en Google? Solo toma un minuto.</p>
              <a href={d.google_url} target="_blank" rel="noopener noreferrer" className="btn fw-semibold"
                style={{ background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 18px" }}>
                <i className="bi bi-google me-2" style={{ color: "#4285F4" }} />Escribir reseña en Google
              </a>
            </>
          )}
        </div>
      </Marco>
    );
  }

  const activa = hover || estrellas;
  return (
    <Marco>
      <div className="text-center mb-3">
        {d.logo_url && <img src={d.logo_url} alt="" style={{ maxHeight: 44, maxWidth: 160, objectFit: "contain" }} />}
        <div className="text-muted mt-1" style={{ fontSize: 13 }}>{d.clinica}</div>
      </div>
      <h5 className="fw-bold text-center mb-1">Hola {d.paciente}, ¿cómo fue tu consulta?</h5>
      <p className="text-muted text-center mb-3" style={{ fontSize: "0.92rem" }}>con {d.medico}</p>

      <form onSubmit={enviar}>
        <div className="text-center mb-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} estrellas`} onClick={() => setEstrellas(n)} onMouseEnter={() => setHover(n)}
              style={{ background: "none", border: "none", fontSize: 40, lineHeight: 1, padding: "0 4px", cursor: "pointer", color: n <= activa ? "#f59e0b" : "#e2e8f0", transition: "transform .12s", transform: n === hover ? "scale(1.15)" : "none" }}>
              ★
            </button>
          ))}
        </div>
        <div className="text-center mb-3" style={{ minHeight: 20, fontSize: 14, fontWeight: 600, color: "#92400e" }}>{ETIQUETAS[activa] || ""}</div>

        <label className="form-label fw-semibold" style={{ fontSize: "0.88rem" }}>Cuéntanos más <span className="text-muted fw-normal">(opcional)</span></label>
        <textarea className="form-control mb-2" rows={4} maxLength={600} value={comentario} onChange={(e) => setComentario(e.target.value)}
          placeholder="¿Qué te gustó? ¿Qué podríamos mejorar?" style={{ borderRadius: 10 }} />
        <div className="form-check mb-3" style={{ fontSize: "0.86rem" }}>
          <input className="form-check-input" type="checkbox" id="mostrarNombre" checked={mostrarNombre} onChange={(e) => setMostrarNombre(e.target.checked)} />
          <label className="form-check-label" htmlFor="mostrarNombre">
            Mostrar mi nombre como <strong>{d.nombre_corto}</strong> (si no, aparece como “Paciente verificado”)
          </label>
        </div>
        {aviso && <div className="alert alert-warning py-2" style={{ fontSize: "0.85rem" }}>{aviso}</div>}
        <button className="btn w-100 fw-semibold" disabled={enviando || !estrellas} style={{ background: "#10b981", color: "#fff", borderRadius: 10, padding: 11 }}>
          {enviando ? <span className="spinner-border spinner-border-sm" /> : "Enviar mi opinión"}
        </button>
        <p className="text-muted text-center mt-3 mb-0" style={{ fontSize: "0.78rem" }}>
          Tus comentarios se publican solo si el médico los aprueba. Tus datos médicos nunca se muestran.
        </p>
      </form>
    </Marco>
  );
}
