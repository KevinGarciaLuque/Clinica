/**
 * Formulario de reseña (estrellas + opinión + datos del médico).
 * Reutilizado por la página pública /resena/:token y por el modal
 * que se abre desde la campanita del navbar cuando el envío es "por el sistema".
 */
import { useState } from "react";

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

export default function FormularioResena({
  form, setForm, estrellas, setEstrellas, opinion, setOpinion,
  error, enviando, onSubmit, submitLabel = "Enviar mi reseña",
}) {
  const cambio = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-danger py-2">{error}</div>}

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
        {enviando ? "Enviando..." : submitLabel}
      </button>
    </form>
  );
}
