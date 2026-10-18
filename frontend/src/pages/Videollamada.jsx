import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import api from "../api/api";

// Sala de videoconsulta (Daily) a pantalla completa.
//  - /videollamada/:citaId → médico (con sesión), se abre en una ventana aparte
//  - /video/:token          → paciente, desde el enlace de su recordatorio ("Mi cita")

const API_PUBLICA = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api/videoconsultas/publico";

function Sala({ url, pase, titulo, subtitulo, alSalir }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#0b1220" }}>
      <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ background: "#0f1a2e", color: "#e2e8f0", borderBottom: "1px solid #1e2a44" }}>
        <i className="bi bi-camera-video-fill text-success" />
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-semibold text-truncate" style={{ fontSize: ".9rem" }}>{titulo}</div>
          {subtitulo && <div className="text-truncate" style={{ fontSize: ".72rem", color: "#94a3b8" }}>{subtitulo}</div>}
        </div>
        {alSalir}
      </div>
      <iframe
        title="Videoconsulta"
        src={`${url}?t=${encodeURIComponent(pase)}`}
        allow="camera; microphone; fullscreen; display-capture; autoplay; speaker-selection"
        style={{ flex: 1, width: "100%", border: 0 }}
      />
    </div>
  );
}

function Pantalla({ icono, titulo, texto, children, error }) {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0f1a2e,#1e3a5f)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="bg-white rounded-4 p-4 text-center shadow" style={{ maxWidth: 420, width: "100%" }}>
        <div className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle"
          style={{ width: 64, height: 64, background: error ? "#fee2e2" : "#dcfce7", color: error ? "#b91c1c" : "#15803d", fontSize: "1.8rem" }}>
          <i className={`bi ${icono}`} />
        </div>
        <h5 className="fw-bold mb-2">{titulo}</h5>
        {texto && <p className="text-muted mb-3" style={{ whiteSpace: "pre-line" }}>{texto}</p>}
        {children}
      </div>
    </div>
  );
}

// ── Médico ───────────────────────────────────────────────────────────────────
export function VideollamadaMedico() {
  const { citaId } = useParams();
  const [sala, setSala] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.post(`/videoconsultas/${citaId}/entrar`)
      .then((r) => setSala(r.data))
      .catch((e) => setError(e.response?.data?.msg || "No se pudo abrir la videollamada."));
  }, [citaId]);

  if (error) return <Pantalla error icono="bi-camera-video-off" titulo="No se pudo abrir la sala" texto={error}><button className="btn btn-outline-secondary" onClick={() => window.close()}>Cerrar</button></Pantalla>;
  if (!sala) return <Pantalla icono="bi-camera-video" titulo="Abriendo la sala…"><span className="spinner-border text-success" /></Pantalla>;
  const hora = sala.inicio ? new Date(sala.inicio.replace(" ", "T")).toLocaleTimeString("es-HN", { hour: "numeric", minute: "2-digit" }) : "";
  return (
    <Sala url={sala.url} pase={sala.pase} titulo={`Videoconsulta · ${sala.paciente}`} subtitulo={`${sala.clinica}${hora ? ` · ${hora}` : ""}`}
      alSalir={<button className="btn btn-sm btn-outline-light" onClick={() => window.close()}>Cerrar</button>} />
  );
}

// ── Paciente ─────────────────────────────────────────────────────────────────
export function VideollamadaPaciente() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [sala, setSala] = useState(null);
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    axios.get(`${API_PUBLICA}/${token}`)
      .then((r) => setInfo(r.data))
      .catch(() => setError("No se pudo cargar la videoconsulta."));
  }, [token]);

  const entrar = async () => {
    setEntrando(true); setError("");
    try {
      const r = await axios.post(`${API_PUBLICA}/${token}/entrar`);
      setSala(r.data);
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo entrar. Intente de nuevo.");
    } finally {
      setEntrando(false);
    }
  };

  if (sala) {
    return <Sala url={sala.url} pase={sala.pase} titulo={`Videoconsulta con ${sala.medico}`} subtitulo={sala.clinica}
      alSalir={<Link to={`/mi-cita/${token}`} className="btn btn-sm btn-outline-light">Salir</Link>} />;
  }
  if (!info) return <Pantalla icono="bi-camera-video" titulo="Cargando…"><span className="spinner-border text-success" /></Pantalla>;
  if (!info.es_video) return <Pantalla error icono="bi-camera-video-off" titulo="Esta cita no es una videoconsulta" texto="Si tiene dudas, comuníquese con la clínica." />;

  const abre = new Date(info.abre_en).toLocaleTimeString("es-HN", { hour: "numeric", minute: "2-digit" });
  return (
    <Pantalla icono="bi-camera-video-fill" titulo={`Hola ${info.paciente}`}
      texto={`Videoconsulta con ${info.medico}\n${info.clinica}`}>
      {error && <div className="alert alert-warning py-2 small">{error}</div>}
      {info.pasada ? (
        <div className="alert alert-secondary py-2 small mb-0">Esta videoconsulta ya terminó.</div>
      ) : info.estado === "CANCELADA" ? (
        <div className="alert alert-secondary py-2 small mb-0">Esta cita fue cancelada.</div>
      ) : (
        <>
          <button className="btn btn-success btn-lg w-100 fw-semibold" onClick={entrar} disabled={!info.abierta || entrando || !info.activa}>
            {entrando ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-camera-video-fill me-2" />}
            Entrar a la videoconsulta
          </button>
          {!info.abierta && <div className="small text-muted mt-2">La sala se abre a las <strong>{abre}</strong> (30 minutos antes de su cita).</div>}
          {!info.activa && <div className="small text-muted mt-2">La videoconsulta no está disponible en este momento. Comuníquese con la clínica.</div>}
          <div className="small text-muted mt-3 text-start">
            <i className="bi bi-info-circle me-1" />Al entrar, permita el uso de la cámara y el micrófono. Funciona desde el celular o la computadora, sin instalar nada.
          </div>
        </>
      )}
      <Link to={`/mi-cita/${token}`} className="d-block small mt-3">Ver mi cita</Link>
    </Pantalla>
  );
}
