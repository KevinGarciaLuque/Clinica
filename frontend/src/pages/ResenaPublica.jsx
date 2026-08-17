/**
 * Encuesta pública de reseña para médicos
 * URL: /resena/:token
 */
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

function Estrellas({ valor, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className={`bi ${(hover || valor) >= n ? "bi-star-fill" : "bi-star"}`}
          style={{ fontSize: 38, color: "#f59e0b", cursor: "pointer", transition: "transform .1s" }}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onMouseDown={(e) => { e.currentTarget.style.transform = "scale(1.15)"; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          onClick={() => onChange(n)}
        />
      ))}
    </div>
  );
}

export default function ResenaPublica() {
  const { token } = useParams();
  const [estado, setEstado] = useState("cargando"); // cargando | form | ya_respondida | error | enviado
  const [msg, setMsg]       = useState("");
  const [form, setForm]     = useState({ nombre_medico: "", especialidad: "", lugar: "" });
  const [estrellas, setEstrellas] = useState(0);
  const [opinion, setOpinion]     = useState("");
  const [enviando, setEnviando]   = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    axios.get(`${BASE}/resenas/token/${token}`)
      .then((r) => {
        const d = r.data.data;
        if (d.estado === "respondida") {
          setEstado("ya_respondida");
          return;
        }
        setForm({ nombre_medico: d.nombre_medico || "", especialidad: d.especialidad || "", lugar: d.lugar || "" });
        setEstado("form");
      })
      .catch((err) => {
        setMsg(err?.response?.data?.msg || "Enlace inválido o expirado");
        setEstado("error");
      });
  }, [token]);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (!estrellas) { setError("Selecciona una calificación de estrellas."); return; }
    if (!opinion.trim()) { setError("Cuéntanos brevemente tu opinión."); return; }

    setEnviando(true);
    try {
      await axios.post(`${BASE}/resenas/token/${token}/responder`, { ...form, estrellas, opinion });
      setEstado("enviado");
    } catch (err) {
      setError(err?.response?.data?.msg || "No se pudo enviar tu reseña. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const cambio = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const Card = ({ children }) => (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: "linear-gradient(135deg,#fffbeb,#f1f5f9)", padding: "2rem" }}>
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5" style={{ maxWidth: 560, width: "100%" }}>
        {children}
      </div>
    </div>
  );

  if (estado === "cargando") {
    return (
      <Card>
        <div className="text-center py-4">
          <div className="spinner-border text-warning" />
        </div>
      </Card>
    );
  }

  if (estado === "error") {
    return (
      <Card>
        <div className="text-center">
          <i className="bi bi-x-circle-fill text-danger" style={{ fontSize: "2.4rem" }} />
          <h4 className="fw-bold mt-3 mb-2">Enlace inválido</h4>
          <p className="text-muted mb-4">{msg}</p>
          <Link to="/" className="btn btn-primary px-5">Volver al inicio</Link>
        </div>
      </Card>
    );
  }

  if (estado === "ya_respondida") {
    return (
      <Card>
        <div className="text-center">
          <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "2.4rem" }} />
          <h4 className="fw-bold mt-3 mb-2">Ya enviaste tu reseña</h4>
          <p className="text-muted mb-4">¡Gracias por compartir tu experiencia con nosotros!</p>
          <Link to="/" className="btn btn-primary px-5">Volver al inicio</Link>
        </div>
      </Card>
    );
  }

  if (estado === "enviado") {
    return (
      <Card>
        <div className="text-center">
          <div className="rounded-circle bg-warning bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-4" style={{ width: 80, height: 80 }}>
            <i className="bi bi-star-fill text-warning" style={{ fontSize: "2.4rem" }} />
          </div>
          <h4 className="fw-bold mb-2">¡Gracias por tu reseña!</h4>
          <p className="text-muted mb-4">Tu opinión ya fue publicada en nuestra página de inicio.</p>
          <Link to="/" className="btn btn-primary px-5">Ver página de inicio</Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h4 className="fw-bold text-dark mb-1">Hola, {form.nombre_medico.split(" ")[0] || "doctor/a"} 👋</h4>
      <p className="text-muted mb-4">Cuéntanos cómo ha sido tu experiencia con el sistema. Toma menos de un minuto.</p>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <form onSubmit={enviar}>
        <div className="mb-4 text-center">
          <label className="form-label small fw-semibold d-block">Tu calificación</label>
          <Estrellas valor={estrellas} onChange={setEstrellas} />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-semibold">Tu opinión</label>
          <textarea
            className="form-control" rows={4} value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            placeholder="¿Qué es lo que más te ha gustado del sistema?"
            maxLength={600}
            required
          />
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Nombre</label>
            <input className="form-control" name="nombre_medico" value={form.nombre_medico} onChange={cambio} />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Especialidad</label>
            <input className="form-control" name="especialidad" value={form.especialidad} onChange={cambio} placeholder="Ej: Pediatría" />
          </div>
          <div className="col-12">
            <label className="form-label small fw-semibold">Lugar</label>
            <input className="form-control" name="lugar" value={form.lugar} onChange={cambio} placeholder="Ciudad, país" />
          </div>
        </div>

        <button type="submit" className="btn btn-warning w-100 fw-bold" disabled={enviando} style={{ color: "#78350f" }}>
          {enviando ? "Enviando..." : "Enviar mi reseña"}
        </button>
      </form>
    </Card>
  );
}
