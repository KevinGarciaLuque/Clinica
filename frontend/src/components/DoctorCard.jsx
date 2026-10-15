// Tarjeta de médico del directorio público. La usan "Agenda tu consulta"
// (DirectorioMedicos) y el carrusel de médicos de la landing.
import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : "33,54,101";
}

export default function DoctorCard({ medico, index, onSelect, fallbackColor, bandColor }) {
  const [fotoError, setFotoError] = useState(false);
  const color = (medico.color_primario || fallbackColor).trim();
  const colorRgb = hexToRgb(color);
  const foto = !fotoError && medico.foto_doctor
    ? (medico.foto_doctor.startsWith("http") ? medico.foto_doctor : `${API}${medico.foto_doctor}`)
    : null;
  // Con departamento: "Municipio, Departamento". Sin él, se mantiene "Ciudad, País".
  const ubicacion = [medico.municipio || medico.ciudad, medico.departamento || medico.pais].filter(Boolean).join(", ");

  return (
    <div
      className="dm-card"
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "30px 24px",
        border: "1px solid #eef1f6",
        boxShadow: "0 4px 20px rgba(15,23,42,.06)",
        textAlign: "center",
        cursor: "pointer",
        animation: `dmFadeUp .55s ${Math.min(index * 0.06, 0.6)}s ease both`,
        transition: "transform .2s, box-shadow .2s",
        position: "relative",
        overflow: "hidden",
      }}
      onClick={() => onSelect(medico.slug)}
    >
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 72,
          background: bandColor || "#eef2f7",
        }}
      />

      <div style={{
        width: 96, height: 96, borderRadius: "50%", margin: "0 auto 18px",
        border: `3px solid rgba(${colorRgb},.25)`,
        boxShadow: `0 8px 24px rgba(${colorRgb},.18)`,
        overflow: "hidden", position: "relative",
        background: `rgba(${colorRgb},.08)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto ? (
          <img
            src={foto} alt={medico.nombre_doctor}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setFotoError(true)}
          />
        ) : (
          <i className="bi bi-person-fill" style={{ fontSize: 44, color }} />
        )}
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-.2px" }}>
        {medico.nombre_doctor || "Médico disponible"}
      </h3>

      {medico.titulo_doctor && (
        <p style={{ fontSize: 13, fontWeight: 600, color, margin: "0 0 10px" }}>
          {medico.titulo_doctor}
        </p>
      )}

      {medico.descripcion && (
        <p style={{
          fontSize: 12.5, color: "#64748b", lineHeight: 1.6, margin: "0 0 16px",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          whiteSpace: "pre-line", textAlign: "left",
        }}>
          {medico.descripcion}
        </p>
      )}

      {ubicacion && (
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <i className="bi bi-geo-alt" />
          {ubicacion}
        </div>
      )}

      <div
        className="dm-card-btn"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: color, color: "#fff", borderRadius: 12,
          padding: "10px 20px", fontWeight: 700, fontSize: 13.5,
          boxShadow: `0 6px 18px rgba(${colorRgb},.3)`,
        }}
      >
        <i className="bi bi-calendar2-plus" />
        Agendar cita
      </div>
    </div>
  );
}
