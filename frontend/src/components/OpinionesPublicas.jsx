// Resumen de opiniones verificadas para las páginas públicas (/dr/:slug y /p/:slug):
// promedio, barras de 5★ a 1★ y los comentarios que el médico aprobó.
import { useEffect, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const AVATAR = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

const Estrellas = ({ n, size = 14 }) => (
  <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: 1 }} aria-label={`${n} de 5 estrellas`}>
    {"★".repeat(n)}<span style={{ color: "#e2e8f0" }}>{"★".repeat(5 - n)}</span>
  </span>
);

const iniciales = (t) => String(t || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "P";

export default function OpinionesPublicas({ medicoSlug, clinicaSlug }) {
  const [d, setD] = useState(null);
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    const params = medicoSlug ? { medico_slug: medicoSlug } : { clinica_slug: clinicaSlug };
    axios.get(`${API}/api/opiniones/publicas`, { params }).then((r) => setD(r.data.data)).catch(() => {});
  }, [medicoSlug, clinicaSlug]);

  if (!d || !d.total) return null; // sin calificaciones todavía: no se muestra la sección
  const max = Math.max(...Object.values(d.distribucion), 1);
  const lista = verTodas ? d.opiniones : d.opiniones.slice(0, 3);

  return (
    <div style={{ background: "#fff", borderRadius: 18, padding: "18px 20px", boxShadow: "0 4px 16px rgba(0,0,0,.06)", marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b", marginBottom: 12 }}>
        <i className="bi bi-star-fill me-2" style={{ color: "#f59e0b" }} />Opiniones de pacientes
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", paddingBottom: 14, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ textAlign: "center", minWidth: 92 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{d.promedio.toFixed(1)}</div>
          <Estrellas n={Math.round(d.promedio)} size={16} />
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{d.total} {d.total === 1 ? "calificación" : "calificaciones"}</div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b", marginBottom: 3 }}>
              <span style={{ width: 22 }}>{n}★</span>
              <div style={{ flex: 1, height: 7, background: "#f1f5f9", borderRadius: 6 }}>
                <div style={{ width: `${(d.distribucion[n] / max) * 100}%`, height: "100%", background: n >= 4 ? "#10b981" : n === 3 ? "#f59e0b" : "#ef4444", borderRadius: 6 }} />
              </div>
              <span style={{ width: 22, textAlign: "right" }}>{d.distribucion[n]}</span>
            </div>
          ))}
        </div>
      </div>

      {lista.map((o, i) => (
        <div key={i} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: i < lista.length - 1 ? "1px solid #f1f5f9" : "none" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: AVATAR[i % AVATAR.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            {o.autor === "Paciente verificado" ? <i className="bi bi-patch-check-fill" /> : iniciales(o.autor)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{o.autor}</span>
                <span style={{ fontSize: 11.5, color: "#10b981", marginLeft: 6 }}><i className="bi bi-patch-check-fill" /> Verificado</span>
              </div>
              <Estrellas n={o.estrellas} />
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{dayjs(o.fecha).format("DD/MM/YYYY")}{o.medico ? ` · ${o.medico}` : ""}</div>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#334155", fontStyle: "italic", lineHeight: 1.5 }}>“{o.comentario}”</p>
          </div>
        </div>
      ))}

      {d.opiniones.length > 3 && (
        <button onClick={() => setVerTodas((v) => !v)} style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 600, fontSize: 13.5, padding: "6px 0 0", cursor: "pointer" }}>
          {verTodas ? "Ver menos" : `Ver todas (${d.opiniones.length})`}
        </button>
      )}
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8 }}>
        Solo pueden opinar pacientes que fueron atendidos. El promedio incluye todas las calificaciones.
      </div>
    </div>
  );
}
