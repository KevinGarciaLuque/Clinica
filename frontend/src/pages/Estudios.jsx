/**
 * ESTUDIOS E IMÁGENES
 * Gestión de solicitudes de estudios clínicos, resultados y visualización de imágenes médicas
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";
import { nombreMedico } from "../utils/medico";

const TIPOS_ESTUDIO = [
  { value: "LABORATORIO", label: "Laboratorio" },
  { value: "RADIOLOGIA", label: "Radiología" },
  { value: "ECOGRAFIA", label: "Ecografía" },
  { value: "TAC", label: "Tomografía (TAC)" },
  { value: "RESONANCIA", label: "Resonancia Magnética (RM)" },
  { value: "ENDOSCOPIA", label: "Endoscopía" },
  { value: "CARDIOLOGIA", label: "Cardiología" },
  { value: "OTROS", label: "Otros" },
];

const ESTADOS = [
  { value: "SOLICITADO",  label: "Solicitado",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.35)" },
  { value: "EN_PROCESO",  label: "En Proceso",  color: "#0ea5e9", bg: "rgba(14,165,233,0.12)",   border: "rgba(14,165,233,0.35)" },
  { value: "COMPLETADO",  label: "Completado",  color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.35)" },
  { value: "CANCELADO",   label: "Cancelado",   color: "#6b7280", bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.35)" },
];

const C = {
  bg: "#f0f2f5", surface: "#ffffff",
  border: "rgba(0,0,0,0.08)", accent: "#166ae8",
  text: "#1a1a1a", muted: "#6c757d",
};

export default function Estudios() {
  const navigate    = useNavigate();
  const detailRef   = useRef(null);

  const [estudios,        setEstudios]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [filtroTipo,      setFiltroTipo]      = useState("");
  const [filtroEstado,    setFiltroEstado]    = useState("");
  const [busqueda,        setBusqueda]        = useState("");
  const [selectedEstudio, setSelectedEstudio] = useState(null);
  const [hoveredRow,      setHoveredRow]      = useState(null);

  useEffect(() => { loadEstudios(); }, [filtroTipo, filtroEstado]);

  const loadEstudios = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filtroTipo)   params.tipo   = filtroTipo;
      if (filtroEstado) params.estado = filtroEstado;
      const res = await api.get("/estudios", { params });
      setEstudios(res.data.data || []);
    } catch (error) {
      console.error("Error al cargar estudios:", error);
    } finally {
      setLoading(false);
    }
  };

  const estudiosFiltrados = estudios.filter(e => {
    if (!busqueda) return true;
    const texto = busqueda.toLowerCase();
    return (
      e.paciente_nombres?.toLowerCase().includes(texto) ||
      e.paciente_apellidos?.toLowerCase().includes(texto) ||
      e.descripcion?.toLowerCase().includes(texto) ||
      e.tipo?.toLowerCase().includes(texto)
    );
  });

  const getEstadoMeta = (estado) =>
    ESTADOS.find(e => e.value === estado) || ESTADOS[3];

  const handleVerDetalle = (estudio) => {
    setSelectedEstudio(estudio);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      await api.put(`/estudios/${id}`, { estado: nuevoEstado });
      loadEstudios();
      if (selectedEstudio?.id === id) {
        setSelectedEstudio({ ...selectedEstudio, estado: nuevoEstado });
      }
    } catch {
      alert("Error al actualizar estado");
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "16px 24px",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="bi bi-flask" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Estudios e Imágenes</div>
          <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>Gestión de solicitudes de estudios clínicos y resultados</div>
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1100 }}>

        {/* ── Panel de detalle (se muestra al hacer clic en Ver) ──────── */}
        {selectedEstudio && (
          <div ref={detailRef}>
            {/* Botón volver */}
            <button
              onClick={() => setSelectedEstudio(null)}
              style={{
                background: "rgba(22,106,232,0.1)", border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "8px 16px", color: C.accent,
                fontWeight: 600, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
              }}
            >
              <i className="bi bi-arrow-left" /> Volver a la lista
            </button>

            {/* Tarjeta encabezado del estudio */}
            <div style={{
              background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12,
              padding: "16px 20px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)",
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: "1.2rem", flexShrink: 0,
              }}>
                {selectedEstudio.paciente_nombres?.[0]}{selectedEstudio.paciente_apellidos?.[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 4 }}>
                  {selectedEstudio.paciente_nombres} {selectedEstudio.paciente_apellidos}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", color: "#6b7280", fontSize: "0.82rem" }}>
                  <span>Médico: {nombreMedico(selectedEstudio)}</span>
                  <span>Fecha: {dayjs(selectedEstudio.fecha_solicitud || selectedEstudio.creado_en).format("DD/MM/YYYY HH:mm")}</span>
                  <span>Estudio #<strong>{selectedEstudio.id}</strong></span>
                </div>
              </div>
              {/* Badge tipo */}
              <span style={{
                background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.35)",
                borderRadius: 6, padding: "4px 12px", fontSize: "0.78rem", fontWeight: 700,
                color: "#0ea5e9", textTransform: "uppercase", flexShrink: 0,
              }}>
                {selectedEstudio.tipo}
              </span>
            </div>

            {/* Contenido del detalle */}
            <div style={{
              background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12,
              padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)", marginBottom: 20,
            }}>
              {/* Estado */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: ".05em", color: C.muted, marginBottom: 8,
                }}>Estado del estudio</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ESTADOS.map(e => (
                    <button
                      key={e.value}
                      onClick={() => handleCambiarEstado(selectedEstudio.id, e.value)}
                      style={{
                        background: selectedEstudio.estado === e.value ? e.bg : "transparent",
                        border: `1px solid ${selectedEstudio.estado === e.value ? e.border : C.border}`,
                        borderRadius: 8, padding: "6px 14px", fontSize: "0.8rem",
                        fontWeight: selectedEstudio.estado === e.value ? 700 : 500,
                        color: selectedEstudio.estado === e.value ? e.color : C.muted,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div style={{ marginBottom: selectedEstudio.resultado ? 20 : 0 }}>
                <div style={{
                  fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: ".05em", color: "#166ae8",
                  borderBottom: "1px solid #dde3f5", paddingBottom: 4, marginBottom: 10,
                }}>Descripción / Indicaciones</div>
                <div style={{
                  background: "#f8faff", border: "1px solid #e5e7eb", borderRadius: 8,
                  padding: "12px 16px", fontSize: "0.88rem", color: "#374151",
                  whiteSpace: "pre-wrap", lineHeight: 1.6,
                }}>
                  {selectedEstudio.descripcion || "Sin descripción"}
                </div>
              </div>

              {/* Resultado */}
              {selectedEstudio.resultado && (
                <div style={{ marginTop: 20 }}>
                  <div style={{
                    fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: ".05em", color: "#10b981",
                    borderBottom: "1px solid #d1fae5", paddingBottom: 4, marginBottom: 10,
                  }}>Resultado</div>
                  <div style={{
                    background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)",
                    borderRadius: 8, padding: "12px 16px", fontSize: "0.88rem", color: "#374151",
                    whiteSpace: "pre-wrap", lineHeight: 1.6,
                  }}>
                    {selectedEstudio.resultado}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Filtros ─────────────────────────────────────────────────── */}
        <div style={{
          background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12,
          padding: "16px 20px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)",
        }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
              <i className="bi bi-search" style={{
                position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
                color: C.muted, fontSize: 14, pointerEvents: "none",
              }} />
              <input
                type="text"
                style={{
                  background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8,
                  color: C.text, padding: "8px 12px 8px 34px", width: "100%", fontSize: 14,
                  outline: "none",
                }}
                placeholder="Buscar por paciente o descripción..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                onFocus={e => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = "0 0 0 3px rgba(22,106,232,0.1)"; }}
                onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <select
              style={{
                background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, padding: "8px 12px", fontSize: 14, outline: "none",
                flex: "0 0 180px",
              }}
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {TIPOS_ESTUDIO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select
              style={{
                background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, padding: "8px 12px", fontSize: 14, outline: "none",
                flex: "0 0 170px",
              }}
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            {(busqueda || filtroTipo || filtroEstado) && (
              <button
                onClick={() => { setFiltroTipo(""); setFiltroEstado(""); setBusqueda(""); }}
                style={{
                  background: "#f1f5f9", border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: "8px 14px", fontSize: "0.82rem", cursor: "pointer", color: "#374151",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <i className="bi bi-x-circle" /> Limpiar
              </button>
            )}
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: C.muted }}>
              {estudiosFiltrados.length} estudio{estudiosFiltrados.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* ── Tabla de estudios ────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280" }}>
            <div className="spinner-border spinner-border-sm me-2" /> Cargando…
          </div>
        ) : estudiosFiltrados.length === 0 ? (
          <div style={{
            background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12,
            padding: "60px 24px", textAlign: "center", color: C.muted,
            boxShadow: "0 2px 8px rgba(0,0,0,.06)",
          }}>
            <i className="bi bi-inbox" style={{ fontSize: "3rem", opacity: 0.25, display: "block", marginBottom: 12 }} />
            No se encontraron estudios con los filtros aplicados
          </div>
        ) : (
          <div style={{
            background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12,
            overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.06)",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "linear-gradient(135deg, #214a87 0%, #176DC8 100%)" }}>
                    {["Fecha Solicitud", "Paciente", "Tipo", "Descripción", "Estado", "Médico Solicitante", ""].map(col => (
                      <th key={col} style={{
                        padding: "12px 16px", textAlign: col === "" ? "right" : "left",
                        fontSize: 12, fontWeight: 700, color: "#fff",
                        textTransform: "uppercase", letterSpacing: ".05em",
                      }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {estudiosFiltrados.map(estudio => {
                    const meta = getEstadoMeta(estudio.estado);
                    const isSelected = selectedEstudio?.id === estudio.id;
                    return (
                      <tr
                        key={estudio.id}
                        onMouseEnter={() => setHoveredRow(estudio.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{
                          borderBottom: `1px solid ${C.border}`,
                          background: isSelected
                            ? "rgba(22,106,232,0.05)"
                            : hoveredRow === estudio.id
                            ? "rgba(13,110,253,0.03)"
                            : "transparent",
                          transition: "background 0.15s",
                        }}
                      >
                        <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>
                          {dayjs(estudio.fecha_solicitud || estudio.creado_en).format("DD/MM/YYYY")}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: "50%",
                              background: "rgba(22,106,232,0.1)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: C.accent, fontWeight: 700, fontSize: 12, flexShrink: 0,
                            }}>
                              {estudio.paciente_nombres?.[0]}{estudio.paciente_apellidos?.[0]}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>
                              {estudio.paciente_nombres} {estudio.paciente_apellidos}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.3)",
                            borderRadius: 5, padding: "3px 9px", fontSize: "0.75rem", fontWeight: 700,
                            color: "#0ea5e9",
                          }}>{estudio.tipo}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151", maxWidth: 240 }}>
                          {estudio.descripcion?.substring(0, 60)}{estudio.descripcion?.length > 60 ? "…" : ""}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            background: meta.bg, border: `1px solid ${meta.border}`,
                            borderRadius: 5, padding: "3px 9px", fontSize: "0.75rem", fontWeight: 700,
                            color: meta.color,
                          }}>{estudio.estado}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>
                          {nombreMedico(estudio)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <button
                            onClick={() => handleVerDetalle(estudio)}
                            style={{
                              background: isSelected ? C.accent : "#eff6ff",
                              border: `1px solid ${isSelected ? C.accent : "#bfdbfe"}`,
                              borderRadius: 7, padding: "5px 14px",
                              fontSize: "0.78rem", fontWeight: 600,
                              color: isSelected ? "#fff" : C.accent,
                              cursor: "pointer", transition: "all 0.15s",
                              display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                            }}
                          >
                            <i className={`bi bi-${isSelected ? "check2" : "eye"}`} />
                            {isSelected ? "Viendo" : "Ver"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
