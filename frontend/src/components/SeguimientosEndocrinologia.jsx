import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";
import MiniLineChart from "./charts/MiniLineChart";

const C = {
  orange:  "#ea580c",
  orangeL: "rgba(234,88,12,.08)",
  green:   "#10b981",
  amber:   "#f59e0b",
  red:     "#ef4444",
  muted:   "#64748b",
  border:  "#e5e7eb",
  text:    "#1e293b",
  bg:      "#f8fafc",
};

// Total de secciones evaluables en un seguimiento (ver SECCIONES_DEF en ConsultaEndocrinologia)
const TOTAL_SECCIONES = 9;
const colorCompletitud = pct => pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red;

const COLOR_HBA1C = v => v <= 7 ? C.green : v <= 9 ? C.amber : C.red;
const COLOR_TIR    = v => v >= 70 ? C.green : v >= 50 ? C.amber : C.red;
const COLOR_PAID5  = v => v <= 8 ? C.green : v <= 13 ? C.amber : C.red;

const METRICAS_EVOLUCION = [
  { key: "hba1c",  titulo: "HbA1c", unidad: "%", maximo: 14, color: COLOR_HBA1C,
    getter: s => s.control_metabolico?.hba1c },
  { key: "imc",    titulo: "IMC", unidad: "kg/m²", maximo: 45, color: () => C.orange,
    getter: s => s.antropometria?.imc },
  { key: "tir",    titulo: "TIR (Tiempo en Rango)", unidad: "%", maximo: 100, color: COLOR_TIR,
    getter: s => s.control_metabolico?.mcg?.tir || s.control_metabolico?.glucometro?.tir },
  { key: "pas",    titulo: "Presión Arterial Sistólica", unidad: "mmHg", maximo: 200, color: () => "#0284c7",
    getter: s => s.cardiovascular?.pa_sistolica },
  { key: "paid5",  titulo: "Escala PAID-5", unidad: "/20", maximo: 20, color: COLOR_PAID5,
    getter: s => s.psicosocial?.paid5_score },
];

function EvolucionSeguimientos({ seguimientos, pacienteId }) {
  const navigate = useNavigate();
  const series = METRICAS_EVOLUCION.map(m => {
    const puntos = seguimientos
      .map(s => ({ id: s.id, fecha: s.fecha, v: m.getter(s) }))
      .filter(p => p.v !== null && p.v !== undefined && p.v !== "" && !Number.isNaN(Number(p.v)))
      .map(p => ({ ...p, v: Number(p.v) }))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return { ...m, puntos };
  }).filter(m => m.puntos.length > 0);

  if (series.length === 0) return null;

  const irASeguimiento = (p) => navigate(`/endocrinologia/seguimiento?paciente_id=${pacienteId}&seguimiento_id=${p.id}`);

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, background: C.bg, display: "flex", alignItems: "center", gap: 10 }}>
        <i className="bi bi-graph-up-arrow" style={{ color: C.orange, fontSize: 16 }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Evolución</span>
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>pasa el mouse sobre un punto para ver el detalle, o haz clic para abrir ese seguimiento</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 1, background: C.border }}>
        {series.map(m => {
          const ultimo = m.puntos[m.puntos.length - 1];
          const col = m.color(ultimo.v);
          return (
            <div key={m.key} style={{ padding: "16px 20px", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{m.titulo}</span>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: `${col}20`, color: col }}>
                  {ultimo.v}{m.unidad}
                </span>
              </div>
              <MiniLineChart puntos={m.puntos} color={col} maximo={m.maximo} unidad={m.unidad} onPointClick={irASeguimiento} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tab "Seguimientos" del perfil del paciente — resumen, evolución y listado
// de visitas (la Historia Clínica inicial tiene su propio tab por separado).
export default function SeguimientosEndocrinologia({ pacienteId }) {
  const navigate = useNavigate();
  const [seguimientos, setSeguimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.get(`/endocrinologia/seguimientos?paciente_id=${pacienteId}&limit=50`);
      setSeguimientos(r.data.data || []);
    } catch (e) {
      setError(e.response?.data?.msg || "Error al cargar los seguimientos");
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const irConsulta = (seguimientoId = null) => {
    const url = `/endocrinologia/seguimiento?paciente_id=${pacienteId}${seguimientoId ? `&seguimiento_id=${seguimientoId}` : ""}`;
    navigate(url);
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTopColor: C.orange, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize: 14 }}>Cargando seguimientos...</span>
    </div>
  );

  if (error) return (
    <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 12, padding: "16px 20px", color: C.red, display: "flex", alignItems: "center", gap: 10 }}>
      <i className="bi bi-exclamation-triangle-fill" /> {error}
    </div>
  );

  const ultimoSeguimiento = seguimientos[0] || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${C.orange}, #9a3412)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-graph-up-arrow" style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Seguimientos — Diabetes Tipo 1</div>
            <div style={{ fontSize: 12, color: C.muted }}>{seguimientos.length} seguimiento{seguimientos.length !== 1 ? "s" : ""} registrado{seguimientos.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <button onClick={() => irConsulta()} style={{ background: `linear-gradient(135deg, ${C.orange}, #9a3412)`, border: "none", borderRadius: 10, padding: "10px 20px", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(234,88,12,.35)" }}>
          <i className="bi bi-plus-lg" /> Nuevo Seguimiento
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
        <div style={{ background: C.orangeL, border: `1px solid rgba(234,88,12,.2)`, borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Total seguimientos</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.orange, lineHeight: 1 }}>{seguimientos.length}</div>
        </div>
        <div style={{ background: "#f0fdf4", border: "1px solid rgba(16,185,129,.2)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Último seguimiento</div>
          {ultimoSeguimiento ? (
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{dayjs(ultimoSeguimiento.fecha).format("DD/MM/YYYY")}</div>
          ) : (
            <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>Sin seguimientos</div>
          )}
        </div>
      </div>

      <EvolucionSeguimientos seguimientos={seguimientos} pacienteId={pacienteId} />

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, background: C.bg, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="bi bi-journal-text" style={{ color: C.orange, fontSize: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Seguimientos</span>
        </div>

        {seguimientos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
            <i className="bi bi-droplet-half" style={{ fontSize: 36, display: "block", marginBottom: 10, opacity: .3 }} />
            <div style={{ fontSize: 14 }}>No hay seguimientos registrados</div>
            <button onClick={() => irConsulta()} style={{ marginTop: 14, background: C.orange, border: "none", borderRadius: 9, padding: "8px 20px", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              + Registrar primer seguimiento
            </button>
          </div>
        ) : (
          <div>
            {seguimientos.map((s, idx) => {
              const firmado = s.estado === "FIRMADA";
              const secciones = s.secciones_completadas || [];
              const pct = Math.round((secciones.length / TOTAL_SECCIONES) * 100);
              const colPct = colorCompletitud(pct);
              return (
                <div key={s.id} style={{ padding: "14px 20px", borderBottom: idx < seguimientos.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
                  onClick={() => irConsulta(s.id)}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: firmado ? C.orangeL : "rgba(245,158,11,.1)", border: `1px solid ${firmado ? "rgba(234,88,12,.25)" : "rgba(245,158,11,.3)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className="bi bi-calendar-check" style={{ color: firmado ? C.orange : C.amber, fontSize: 16 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{dayjs(s.fecha).format("DD/MM/YYYY")}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: firmado ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)", color: firmado ? C.green : C.amber, border: `1px solid ${firmado ? "rgba(16,185,129,.25)" : "rgba(245,158,11,.25)"}` }}>
                        <i className={`bi bi-${firmado ? "check-circle-fill" : "pencil"} me-1`} />
                        {firmado ? "Firmado" : "Borrador"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                        {secciones.length ? `${secciones.length} de ${TOTAL_SECCIONES} sección(es) evaluadas` : "Sin secciones registradas"}
                      </div>
                      {secciones.length > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "1px 8px", background: `${colPct}18`, color: colPct, border: `1px solid ${colPct}40`, flexShrink: 0 }}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button title="Ver / Editar" onClick={() => irConsulta(s.id)} style={{ width: 32, height: 32, border: `1px solid rgba(234,88,12,.25)`, borderRadius: 8, background: C.orangeL, color: C.orange, cursor: "pointer" }}>
                      <i className="bi bi-eye" />
                    </button>
                    <button title="Imprimir" onClick={() => window.open(`/endocrinologia/seguimiento?paciente_id=${pacienteId}&seguimiento_id=${s.id}&print=1`, "_blank")}
                      style={{ width: 32, height: 32, border: "1px solid rgba(16,185,129,.25)", borderRadius: 8, background: "rgba(16,185,129,.1)", color: C.green, cursor: "pointer" }}>
                      <i className="bi bi-printer" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
