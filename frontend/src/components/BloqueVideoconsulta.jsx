import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";
import { abrirVideollamada, videoActiva } from "../utils/videollamada";

const PUEDE_ATENDER = ["ADMIN", "MEDICO", "PSICOLOGO", "SUPER_ADMIN"];

/**
 * Bloque de videoconsulta dentro del detalle de una cita: iniciar la llamada,
 * o convertir/quitar la cita como videoconsulta.
 */
export default function BloqueVideoconsulta({ cita, onCambio }) {
  const { user } = useAuth();
  const [esVideo, setEsVideo] = useState(!!cita.es_video);
  const [guardando, setGuardando] = useState(false);
  const [activo, setActivo] = useState(false);
  useEffect(() => { videoActiva(api).then(setActivo); }, []);
  const activa = !["CANCELADA", "COMPLETADA", "NO_ASISTIO"].includes(cita.estado);

  const cambiar = async (activo) => {
    if (!activo && !window.confirm("¿Quitar la videoconsulta? La cita quedará como presencial.")) return;
    setGuardando(true);
    try {
      await api.post(`/videoconsultas/${cita.id}`, { activo });
      setEsVideo(activo);
      cita.es_video = activo ? 1 : 0;
      onCambio?.(activo);
    } catch {
      alert("No se pudo cambiar. Intente de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  if (!esVideo) {
    if (!activa || !activo) return null; // sin la videollamada activada no se ofrece
    return (
      <button type="button" className="btn btn-link btn-sm text-decoration-none px-0 mb-2" disabled={guardando} onClick={() => cambiar(true)}>
        <i className="bi bi-camera-video me-1" />Convertir en videoconsulta
      </button>
    );
  }

  return (
    <div className="d-flex flex-wrap align-items-center gap-2 p-2 mb-2 rounded-3" style={{ background: "#ecfdf5", border: "1px solid #86efac" }}>
      <i className="bi bi-camera-video-fill text-success fs-5" />
      <div className="flex-grow-1 small" style={{ minWidth: 160 }}>
        <strong>Videoconsulta</strong>
        <span className="d-block text-muted">El paciente entra desde el enlace de su recordatorio.</span>
      </div>
      {activa && PUEDE_ATENDER.includes(user?.tipo) && (
        <button type="button" className="btn btn-success btn-sm fw-semibold" onClick={() => abrirVideollamada(cita.id)}>
          <i className="bi bi-camera-video-fill me-1" />Iniciar videollamada
        </button>
      )}
      {activa && (
        <button type="button" className="btn btn-link btn-sm text-danger text-decoration-none" disabled={guardando} onClick={() => cambiar(false)}>
          Quitar
        </button>
      )}
    </div>
  );
}
