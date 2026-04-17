import { useEffect, useState } from "react";
import api from "../api/api";

const C = {
  bg:      "#0d1b2e",
  surface: "#112240",
  card:    "#162a45",
  border:  "rgba(255,255,255,0.07)",
  accent:  "#2196f3",
  success: "#10b981",
  warning: "#f59e0b",
  danger:  "#ef4444",
  text:    "#e2e8f0",
  muted:   "#94a3b8",
};

/* ── helpers ── */
const fmt = (n) => Number(n).toLocaleString("es");

function formatBytes(kb) {
  if (!kb || kb === 0) return "0 KB";
  if (kb < 1024)       return `${kb.toFixed(0)} KB`;
  if (kb < 1048576)    return `${(kb / 1024).toFixed(2)} MB`;
  return                      `${(kb / 1048576).toFixed(2)} GB`;
}

function nivelAlmacenamiento(kb) {
  if (kb < 50 * 1024)   return { label: "Bajo",    color: C.success, pct: Math.min((kb / (50*1024)) * 33, 33) };
  if (kb < 200 * 1024)  return { label: "Moderado", color: C.warning, pct: Math.min(33 + ((kb - 50*1024) / (150*1024)) * 34, 67) };
  return                       { label: "Alto",     color: C.danger,  pct: Math.min(67 + ((kb - 200*1024) / (300*1024)) * 33, 100) };
}

/* ── Tarjeta de stat ── */
function StatCard({ icon, label, value, color = C.accent, sub }) {
  return (
    <div style={{
      background: `${color}10`,
      border: `1px solid ${color}30`,
      borderRadius: 12,
      padding: "16px 18px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: `${color}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`bi ${icon}`} style={{ fontSize: 18, color }} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{fmt(value)}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: `${color}99`, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Barra de desglose ── */
function BarraDesglose({ label, icon, cantidad, kb, colorBar }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
      <i className={`bi ${icon}`} style={{ color: colorBar, fontSize: 14, width: 18, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: C.text }}>{label}</span>
          <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>
            {fmt(cantidad)} arch. · {formatBytes(kb)}
          </span>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,.07)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: kb > 0 ? "100%" : "0%",
            background: `linear-gradient(90deg, ${colorBar}, ${colorBar}88)`,
            borderRadius: 3,
          }} />
        </div>
      </div>
    </div>
  );
}

export default function ClinicaDetallesModal({ clinicaId, clinicaNombre, onClose }) {
  const [data, setData]       = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!clinicaId) return;
    setCargando(true);
    setError("");
    api.get(`/clinicas/${clinicaId}/detalles`)
      .then((r) => setData(r.data.data))
      .catch((e) => setError(e.response?.data?.msg || e.message))
      .finally(() => setCargando(false));
  }, [clinicaId]);

  const nivel = data ? nivelAlmacenamiento(data.almacenamiento.espacio_kb) : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,.72)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        width: "100%", maxWidth: 720,
        maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 32px 100px rgba(0,0,0,.6)",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: "20px 28px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 14,
          background: "linear-gradient(135deg, #0f2a50 0%, #1a3a5c 100%)",
          flexShrink: 0,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #2196f3, #1976d2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(33,150,243,.4)",
          }}>
            <i className="bi bi-bar-chart-fill" style={{ color: "#fff", fontSize: 19 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h5 style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 16 }}>
              Detalles de uso
            </h5>
            <span style={{
              fontSize: 13, color: C.muted,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              display: "block",
            }}>
              {clinicaNombre}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.06)", border: `1px solid ${C.border}`,
              borderRadius: 8, width: 34, height: 34,
              color: C.muted, cursor: "pointer", fontSize: 15,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* ── Cuerpo ── */}
        <div style={{ overflowY: "auto", flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Estado de carga */}
          {cargando && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{
                width: 40, height: 40, border: `3px solid ${C.border}`,
                borderTopColor: C.accent, borderRadius: "50%",
                animation: "spin .8s linear infinite", margin: "0 auto 14px",
              }} />
              <span style={{ color: C.muted, fontSize: 14 }}>Cargando estadísticas...</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {error && (
            <div style={{
              background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
              borderRadius: 10, padding: "12px 16px", color: "#f87171",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="bi bi-exclamation-triangle-fill" />
              {error}
            </div>
          )}

          {data && !cargando && (
            <>
              {/* ── Grid de conteos ── */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase",
                               letterSpacing: ".06em", marginBottom: 12 }}>
                  <i className="bi bi-grid-fill me-2" style={{ color: C.accent }} />
                  Actividad registrada
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
                  <StatCard icon="bi-people-fill"       label="Pacientes"        value={data.conteos.total_pacientes}   color={C.accent} />
                  <StatCard icon="bi-calendar2-check-fill" label="Citas totales"  value={data.conteos.total_citas}        color="#8b5cf6" />
                  <StatCard icon="bi-person-badge-fill"  label="Staff activo"     value={data.conteos.total_usuarios}    color={C.success} />
                  <StatCard icon="bi-images"             label="Fotos galería"    value={data.conteos.fotos_galeria}     color="#f59e0b"
                    sub="antes/después" />
                  <StatCard icon="bi-person-circle"      label="Fotos pacientes"  value={data.conteos.fotos_perfil_pacientes} color="#06b6d4"
                    sub="perfil Cloudinary" />
                  <StatCard icon="bi-file-earmark-fill"  label="Documentos"       value={data.conteos.total_documentos}  color="#ec4899" />
                </div>
              </div>

              {/* ── Almacenamiento en nube ── */}
              <div style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: "20px 22px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <i className="bi bi-cloud-fill" style={{ color: nivel.color, fontSize: 18 }} />
                    <span style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>Almacenamiento en nube</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: nivel.color, lineHeight: 1.1 }}>
                      {data.almacenamiento.espacio_legible}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>estimado · {fmt(data.conteos.total_archivos_nube)} archivos</div>
                  </div>
                </div>

                {/* Barra de nivel */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>Uso estimado</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: nivel.color,
                      background: `${nivel.color}15`, border: `1px solid ${nivel.color}35`,
                      borderRadius: 20, padding: "2px 9px",
                    }}>
                      {nivel.label}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "rgba(255,255,255,.07)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${nivel.pct}%`,
                      background: `linear-gradient(90deg, ${nivel.color}, ${nivel.color}88)`,
                      borderRadius: 6, transition: "width .6s ease",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: C.muted }}>0 KB</span>
                    <span style={{ fontSize: 10, color: C.muted }}>~500 MB referencia</span>
                  </div>
                </div>

                {/* Desglose por tipo */}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, textTransform: "uppercase",
                                 letterSpacing: ".05em", fontWeight: 600 }}>
                    Desglose por tipo
                  </div>
                  <BarraDesglose
                    icon="bi-images" label="Galería Antes/Después"
                    cantidad={data.almacenamiento.desglose.galeria_fotos.cantidad}
                    kb={data.almacenamiento.desglose.galeria_fotos.kb}
                    colorBar="#f59e0b"
                  />
                  <BarraDesglose
                    icon="bi-person-circle" label="Fotos de perfil (pacientes)"
                    cantidad={data.almacenamiento.desglose.perfil_pacientes.cantidad}
                    kb={data.almacenamiento.desglose.perfil_pacientes.kb}
                    colorBar="#06b6d4"
                  />
                  <BarraDesglose
                    icon="bi-person-badge" label="Fotos de perfil (staff)"
                    cantidad={data.almacenamiento.desglose.perfil_usuarios.cantidad}
                    kb={data.almacenamiento.desglose.perfil_usuarios.kb}
                    colorBar="#8b5cf6"
                  />
                  <BarraDesglose
                    icon="bi-file-earmark-medical" label="Documentos adjuntos"
                    cantidad={data.almacenamiento.desglose.documentos.cantidad}
                    kb={data.almacenamiento.desglose.documentos.kb}
                    colorBar="#ec4899"
                  />
                </div>
              </div>

              {/* ── Info de actividad y sugerencia ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Última cita */}
                <div style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: "16px 18px",
                }}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase",
                                 letterSpacing: ".05em", fontWeight: 600, marginBottom: 8 }}>
                    <i className="bi bi-clock-history me-2" style={{ color: C.accent }} />
                    Última cita
                  </div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>
                    {data.ultima_cita
                      ? new Date(data.ultima_cita).toLocaleDateString("es-PE", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "Sin citas registradas"}
                  </div>
                </div>

                {/* Registro */}
                <div style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: "16px 18px",
                }}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase",
                                 letterSpacing: ".05em", fontWeight: 600, marginBottom: 8 }}>
                    <i className="bi bi-calendar3 me-2" style={{ color: C.success }} />
                    Registrada el
                  </div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>
                    {data.clinica.creado_en
                      ? new Date(data.clinica.creado_en).toLocaleDateString("es-PE", {
                          day: "2-digit", month: "long", year: "numeric",
                        })
                      : "—"}
                  </div>
                </div>
              </div>

              {/* ── Top usuarios activos ── */}
              {data.top_usuarios.length > 0 && (
                <div style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: "16px 18px",
                }}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase",
                                 letterSpacing: ".05em", fontWeight: 600, marginBottom: 12 }}>
                    <i className="bi bi-person-lines-fill me-2" style={{ color: "#8b5cf6" }} />
                    Staff · últimos accesos
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.top_usuarios.map((u, i) => {
                      const ROLE_C = {
                        ADMIN: C.accent, MEDICO: C.success,
                        ENFERMERA: "#f59e0b", RECEPCIONISTA: "#06b6d4",
                      };
                      const col = ROLE_C[u.tipo] || C.muted;
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "6px 10px", borderRadius: 8,
                          background: "rgba(255,255,255,.03)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 7,
                              background: `${col}20`, border: `1px solid ${col}35`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700, color: col,
                            }}>
                              {u.nombres[0]}{u.apellidos[0]}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
                                {u.nombres} {u.apellidos}
                              </div>
                              <div style={{ fontSize: 11, color: col }}>{u.tipo}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: C.muted }}>
                            {u.ultimo_acceso
                              ? new Date(u.ultimo_acceso).toLocaleDateString("es-PE", {
                                  day: "2-digit", month: "short", year: "numeric",
                                })
                              : "Nunca"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Nota de estimación ── */}
              <div style={{
                background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.2)",
                borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "flex-start", gap: 8,
              }}>
                <i className="bi bi-info-circle-fill" style={{ color: "#f59e0b", fontSize: 14, marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.5 }}>
                  El espacio estimado se calcula con pesos promedio por tipo de archivo (galería ~900 KB,
                  fotos de perfil ~350 KB, documentos ~400 KB). Para ver el consumo real visita el panel
                  de Cloudinary de la cuenta correspondiente.
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "14px 28px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "flex-end",
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.06)", border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "8px 24px",
              color: C.muted, fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,.1)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,.06)"}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
