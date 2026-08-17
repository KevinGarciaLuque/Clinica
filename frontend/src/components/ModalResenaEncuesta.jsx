/**
 * Modal para responder una encuesta de reseña sin salir del sistema.
 * Se abre desde la campanita del navbar cuando el SUPER_ADMIN envía la
 * encuesta "por el sistema" (o "ambos").
 */
import { useState, useEffect } from "react";
import axios from "axios";
import FormularioResena from "./FormularioResena";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

export default function ModalResenaEncuesta({ token, onClose, onEnviada }) {
  const [cargando, setCargando] = useState(true);
  const [form, setForm]         = useState({ nombre_medico: "", especialidad: "", lugar: "" });
  const [estrellas, setEstrellas] = useState(0);
  const [opinion, setOpinion]     = useState("");
  const [enviando, setEnviando]   = useState(false);
  const [error, setError]         = useState("");
  const [enviado, setEnviado]     = useState(false);

  useEffect(() => {
    axios.get(`${BASE}/resenas/token/${token}`)
      .then((r) => {
        const d = r.data.data;
        setForm({ nombre_medico: d.nombre_medico || "", especialidad: d.especialidad || "", lugar: d.lugar || "" });
      })
      .catch(() => setError("No se pudo cargar la encuesta."))
      .finally(() => setCargando(false));
  }, [token]);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (!estrellas) { setError("Selecciona una calificación de estrellas."); return; }
    if (!opinion.trim()) { setError("Cuéntanos brevemente tu opinión."); return; }

    setEnviando(true);
    try {
      await axios.post(`${BASE}/resenas/token/${token}/responder`, { ...form, estrellas, opinion });
      setEnviado(true);
      onEnviada?.(token);
    } catch (err) {
      setError(err?.response?.data?.msg || "No se pudo enviar tu reseña. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,.55)", zIndex: 2100 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content rounded-4 overflow-hidden">
          <div style={{ background: "linear-gradient(135deg,#f59e0b,#f97316)", padding: "20px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>⭐</div>
            <h5 className="fw-bold text-white mb-0">¡Tu opinión nos importa!</h5>
          </div>
          <div className="p-4">
            {cargando ? (
              <div className="text-center py-4"><div className="spinner-border text-warning" /></div>
            ) : enviado ? (
              <div className="text-center py-2">
                <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "2.2rem" }} />
                <h5 className="fw-bold mt-3 mb-2">¡Gracias por tu reseña!</h5>
                <p className="text-muted mb-3">Un administrador la revisará antes de publicarla.</p>
                <button className="btn btn-primary px-4" onClick={onClose}>Cerrar</button>
              </div>
            ) : (
              <>
                <p className="text-muted mb-3">Cuéntanos cómo ha sido tu experiencia con el sistema. Toma menos de un minuto.</p>
                <FormularioResena
                  form={form} setForm={setForm}
                  estrellas={estrellas} setEstrellas={setEstrellas}
                  opinion={opinion} setOpinion={setOpinion}
                  error={error} enviando={enviando}
                  onSubmit={enviar}
                />
                <button type="button" className="btn btn-link text-muted w-100 mt-2" onClick={onClose}>
                  Cerrar y responder después
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
