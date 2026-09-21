import { useState } from "react";
import dayjs from "dayjs";
import { prefijoDr, tituloMedicoActivo } from "../../utils/medico";

// ══════════════════════════════════════════════════════════════════════
// Tarjeta: Paciente Nuevo vs. Consulta Subsecuente
// ══════════════════════════════════════════════════════════════════════
export default function PacienteResumenCard({ resumen }) {
  const [expandido, setExpandido] = useState(false);
  const [indice, setIndice] = useState(0);
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);
  if (!resumen) return null;

  const { es_nuevo, total_consultas, consultas_previas } = resumen;
  const lista = consultas_previas || (resumen.ultima_consulta ? [resumen.ultima_consulta] : []);

  if (es_nuevo) {
    return (
      <div style={{
        background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
        border: "1px solid #86efac",
        borderRadius: 10,
        padding: "10px 16px",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 1px 4px rgba(34,197,94,.12)",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#22c55e", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: "0.9rem",
        }}>
          <i className="bi bi-stars"></i>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#15803d" }}>PACIENTE NUEVO</div>
          <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: 1 }}>
            Primera consulta registrada en esta clínica
          </div>
        </div>
      </div>
    );
  }

  const actual = lista[indice];
  const total  = lista.length;

  return (
    <div style={{
      background: expandido ? "#f8faff" : "#fff",
      border: "1px solid #bfdbfe",
      borderRadius: 10,
      marginBottom: 12,
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(59,130,246,.1)",
      transition: "background .2s",
    }}>
      {/* Cabecera siempre visible */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: "0.85rem",
        }}>
          <i className="bi bi-arrow-repeat"></i>
        </div>

        {/* Texto central — clickeable para expandir */}
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandido(e => !e)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1d4ed8" }}>
              CONSULTA SUBSECUENTE
            </span>
            <span style={{
              background: "#dbeafe", color: "#1e40af",
              borderRadius: 20, padding: "1px 9px",
              fontSize: "0.7rem", fontWeight: 700,
            }}>
              {total_consultas} {total_consultas === 1 ? "visita previa" : "visitas previas"}
            </span>
          </div>
          {actual && (
            <div style={{ fontSize: "0.73rem", color: "#6b7280", marginTop: 2 }}>
              Última visita: {dayjs(actual.fecha).format("DD/MM/YYYY")}
              {actual.diagnostico_cie && (
                <span style={{ marginLeft: 6, color: "#3b82f6" }}>
                  · {actual.diagnostico_cie}{actual.diagnostico_desc ? ` – ${actual.diagnostico_desc}` : ""}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controles carrusel */}
        {total > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => setIndice(i => Math.min(i + 1, total - 1))}
              disabled={indice >= total - 1}
              onMouseEnter={() => setHoverPrev(true)}
              onMouseLeave={() => setHoverPrev(false)}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                border: `1px solid ${indice >= total - 1 ? "#e2e8f0" : hoverPrev ? "#93c5fd" : "#bfdbfe"}`,
                background: indice >= total - 1 ? "#f1f5f9" : hoverPrev ? "#dbeafe" : "#eff6ff",
                color: indice >= total - 1 ? "#cbd5e1" : hoverPrev ? "#1d4ed8" : "#3b82f6",
                cursor: indice >= total - 1 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", flexShrink: 0,
                transform: hoverPrev && indice < total - 1 ? "scale(1.12)" : "scale(1)",
                transition: "all .15s",
                boxShadow: hoverPrev && indice < total - 1 ? "0 2px 8px rgba(59,130,246,.25)" : "none",
              }}
              title="Consulta anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <span style={{ fontSize: "0.72rem", color: "#6b7280", minWidth: 36, textAlign: "center" }}>
              {indice + 1} / {total}
            </span>
            <button
              onClick={() => setIndice(i => Math.max(i - 1, 0))}
              disabled={indice <= 0}
              onMouseEnter={() => setHoverNext(true)}
              onMouseLeave={() => setHoverNext(false)}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                border: `1px solid ${indice <= 0 ? "#e2e8f0" : hoverNext ? "#93c5fd" : "#bfdbfe"}`,
                background: indice <= 0 ? "#f1f5f9" : hoverNext ? "#dbeafe" : "#eff6ff",
                color: indice <= 0 ? "#cbd5e1" : hoverNext ? "#1d4ed8" : "#3b82f6",
                cursor: indice <= 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", flexShrink: 0,
                transform: hoverNext && indice > 0 ? "scale(1.12)" : "scale(1)",
                transition: "all .15s",
                boxShadow: hoverNext && indice > 0 ? "0 2px 8px rgba(59,130,246,.25)" : "none",
              }}
              title="Consulta siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        )}

        {/* Toggle expandir */}
        <div
          onClick={() => setExpandido(e => !e)}
          style={{ color: "#9ca3af", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
        >
          <span style={{ fontSize: "0.72rem" }}>{expandido ? "Cerrar" : "Ver detalle"}</span>
          <i className={`bi bi-chevron-${expandido ? "up" : "down"}`} style={{ fontSize: "0.72rem" }}></i>
        </div>
      </div>

      {/* Detalle expandible */}
      {expandido && actual && (
        <div style={{ borderTop: "1px solid #dbeafe", padding: "14px 16px", background: "#f8faff" }}>
          {/* Médico y fecha */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12, fontSize: "0.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i className="bi bi-calendar3" style={{ color: "#3b82f6" }}></i>
              <span style={{ color: "#374151" }}>
                <strong>Fecha:</strong> {dayjs(actual.fecha).format("DD [de] MMMM [de] YYYY")}
              </span>
            </div>
            {actual.medico && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <i className="bi bi-person-badge" style={{ color: "#3b82f6" }}></i>
                <span style={{ color: "#374151" }}>
                  <strong>Médico:</strong> {prefijoDr()}{actual.medico}
                  {tituloMedicoActivo() && actual.especialidad && <span style={{ color: "#9ca3af" }}> · {actual.especialidad}</span>}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {actual.subjetivo && (
              <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  <i className="bi bi-chat-square-text me-1 text-primary"></i>Motivo / Subjetivo
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151", lineHeight: 1.5 }}>{actual.subjetivo}</p>
              </div>
            )}
            {actual.diagnostico_cie && (
              <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  <i className="bi bi-clipboard2-pulse me-1 text-danger"></i>Diagnóstico
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 6, padding: "1px 7px", fontSize: "0.72rem", fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>
                    {actual.diagnostico_cie}
                  </span>
                  {actual.diagnostico_desc && (
                    <span style={{ fontSize: "0.82rem", color: "#374151", lineHeight: 1.4 }}>{actual.diagnostico_desc}</span>
                  )}
                </div>
              </div>
            )}
            {actual.plan && (
              <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e5e7eb", gridColumn: actual.subjetivo && actual.diagnostico_cie ? "1 / -1" : undefined }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  <i className="bi bi-list-check me-1 text-success"></i>Plan de tratamiento
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151", lineHeight: 1.5 }}>{actual.plan}</p>
              </div>
            )}
          </div>

          {actual.medicamentos?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                <i className="bi bi-capsule me-1 text-warning"></i>Medicamentos recetados
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {actual.medicamentos.map((m, i) => (
                  <div key={i} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "5px 10px", fontSize: "0.78rem", color: "#92400e" }}>
                    <strong>{m.nombre}</strong>
                    {m.dosis && <span style={{ color: "#b45309" }}> · {m.dosis}</span>}
                    {m.duracion && <span style={{ color: "#b45309" }}> · {m.duracion}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
