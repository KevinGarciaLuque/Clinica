import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";
import MiniLineChart from "./charts/MiniLineChart";
import {
  calcularIndiceGlobal, coberturaPlan, ultimaSeccionConDatos, calcularAlertas, TEMAS_PLAN,
} from "../pages/educacion/shared";
import AlertasBanner from "../pages/educacion/AlertasBanner";

const C = {
  teal:  "#0d9488",
  tealL: "rgba(13,148,136,.08)",
  green: "#10b981",
  amber: "#f59e0b",
  red:   "#ef4444",
  muted: "#64748b",
  border:"#e5e7eb",
  text:  "#1e293b",
  bg:    "#f8fafc",
};

const TOTAL_SECCIONES = 10;
const colorCompletitud = pct => pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red;
const colorNivel = v => v >= 4 ? C.green : v >= 3 ? C.amber : C.red;

const METRICAS_EVOLUCION = [
  { key: "indice_global",      titulo: "Índice Global de Conocimiento", getter: s => calcularIndiceGlobal(s.evaluacion_educativa), destacado: true },
  { key: "nivel_diabetes",     titulo: "Conocimiento — Diabetes",     getter: s => s.evaluacion_educativa?.nivel_diabetes },
  { key: "nivel_alimentacion", titulo: "Conocimiento — Alimentación", getter: s => s.evaluacion_educativa?.nivel_alimentacion },
  { key: "nivel_insulina",     titulo: "Conocimiento — Insulina",     getter: s => s.evaluacion_educativa?.nivel_insulina },
  { key: "nivel_monitoreo",    titulo: "Conocimiento — Monitoreo",    getter: s => s.evaluacion_educativa?.nivel_monitoreo },
];

function EvolucionConocimiento({ sesiones, pacienteId }) {
  const navigate = useNavigate();
  const series = METRICAS_EVOLUCION.map(m => {
    const puntos = sesiones
      .map(s => ({ id: s.id, fecha: s.fecha, v: m.getter(s) }))
      .filter(p => p.v !== null && p.v !== undefined && p.v !== "" && !Number.isNaN(Number(p.v)))
      .map(p => ({ ...p, v: Number(p.v) }))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return { ...m, puntos };
  }).filter(m => m.puntos.length > 0);

  if (series.length === 0) return null;

  const irASesion = (p) => navigate(`/educacion/consulta?paciente_id=${pacienteId}&sesion_id=${p.id}`);

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, background: C.bg, display: "flex", alignItems: "center", gap: 10 }}>
        <i className="bi bi-graph-up-arrow" style={{ color: C.teal, fontSize: 16 }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Evolución del Conocimiento</span>
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>escala 1 (bajo) a 5 (alto)</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 1, background: C.border }}>
        {series.map(m => {
          const ultimo = m.puntos[m.puntos.length - 1];
          const col = colorNivel(ultimo.v);
          return (
            <div key={m.key} style={{ padding: "16px 20px", background: m.destacado ? C.tealL : "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{m.titulo}</span>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: `${col}20`, color: col }}>
                  {ultimo.v}/5
                </span>
              </div>
              <MiniLineChart puntos={m.puntos} color={col} maximo={5} unidad="/5" onPointClick={irASesion} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tab "Educación" del perfil del paciente — sesiones con la Educadora en Diabetes.
export default function EducacionDiabetesTab({ pacienteId }) {
  const navigate = useNavigate();
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.get(`/educacion-diabetes/sesiones?paciente_id=${pacienteId}&limit=50`);
      setSesiones(r.data.data || []);
    } catch (e) {
      setError(e.response?.data?.msg || "Error al cargar las sesiones de educación");
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const irConsulta = (sesionId = null) => {
    const url = `/educacion/consulta?paciente_id=${pacienteId}${sesionId ? `&sesion_id=${sesionId}` : ""}`;
    navigate(url);
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTopColor: C.teal, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize: 14 }}>Cargando sesiones de educación...</span>
    </div>
  );

  if (error) return (
    <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 12, padding: "16px 20px", color: C.red, display: "flex", alignItems: "center", gap: 10 }}>
      <i className="bi bi-exclamation-triangle-fill" /> {error}
    </div>
  );

  const ultima = sesiones[0] || null;
  const alertas = calcularAlertas({
    monitoreo: ultimaSeccionConDatos(sesiones, "monitoreo"),
    actividad_fisica: ultimaSeccionConDatos(sesiones, "actividad_fisica"),
    alimentacion: ultimaSeccionConDatos(sesiones, "alimentacion"),
    educacion_previa: ultimaSeccionConDatos(sesiones, "educacion_previa"),
  });
  const cubiertos = coberturaPlan(sesiones);
  const pendientes = TEMAS_PLAN.filter(([k]) => !cubiertos.has(k));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <AlertasBanner alertas={alertas} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${C.teal}, #115e59)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-mortarboard" style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Educación en Diabetes</div>
            <div style={{ fontSize: 12, color: C.muted }}>{sesiones.length} sesión{sesiones.length !== 1 ? "es" : ""} registrada{sesiones.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <button onClick={() => irConsulta()} style={{ background: `linear-gradient(135deg, ${C.teal}, #115e59)`, border: "none", borderRadius: 10, padding: "10px 20px", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(13,148,136,.35)" }}>
          <i className="bi bi-plus-lg" /> Nueva Sesión
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
        <div style={{ background: C.tealL, border: `1px solid rgba(13,148,136,.2)`, borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Total sesiones</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.teal, lineHeight: 1 }}>{sesiones.length}</div>
        </div>
        <div style={{ background: "#f0fdf4", border: "1px solid rgba(16,185,129,.2)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Última sesión</div>
          {ultima ? (
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{dayjs(ultima.fecha).format("DD/MM/YYYY")}</div>
          ) : (
            <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>Sin sesiones</div>
          )}
        </div>
        {sesiones.length > 0 && (
          <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 12, padding: "16px 18px" }}
            title={pendientes.length ? `Pendientes: ${pendientes.map(([, l]) => l).join(", ")}` : "Todos los temas cubiertos"}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Cobertura Plan Educativo</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{cubiertos.size} / {TEMAS_PLAN.length} temas</div>
            <div style={{ background: "rgba(245,158,11,.2)", borderRadius: 99, height: 6, overflow: "hidden", marginTop: 6 }}>
              <div style={{ height: "100%", borderRadius: 99, background: C.amber, width: `${(cubiertos.size / TEMAS_PLAN.length) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      <EvolucionConocimiento sesiones={sesiones} pacienteId={pacienteId} />

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, background: C.bg, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="bi bi-journal-text" style={{ color: C.teal, fontSize: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Sesiones</span>
        </div>

        {sesiones.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
            <i className="bi bi-mortarboard" style={{ fontSize: 36, display: "block", marginBottom: 10, opacity: .3 }} />
            <div style={{ fontSize: 14 }}>No hay sesiones registradas</div>
            <button onClick={() => irConsulta()} style={{ marginTop: 14, background: C.teal, border: "none", borderRadius: 9, padding: "8px 20px", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              + Registrar primera sesión
            </button>
          </div>
        ) : (
          <div>
            {sesiones.map((s, idx) => {
              const firmado = s.estado === "FIRMADA";
              const secciones = s.secciones_completadas || [];
              const pct = Math.round((secciones.length / TOTAL_SECCIONES) * 100);
              const colPct = colorCompletitud(pct);
              return (
                <div key={s.id} style={{ padding: "14px 20px", borderBottom: idx < sesiones.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
                  onClick={() => irConsulta(s.id)}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: firmado ? C.tealL : "rgba(245,158,11,.1)", border: `1px solid ${firmado ? "rgba(13,148,136,.25)" : "rgba(245,158,11,.3)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className="bi bi-calendar-check" style={{ color: firmado ? C.teal : C.amber, fontSize: 16 }} />
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
                    {s.educador_nombre && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}><i className="bi bi-person-fill me-1" />{s.educador_nombre}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button title="Ver / Editar" onClick={() => irConsulta(s.id)} style={{ width: 32, height: 32, border: `1px solid rgba(13,148,136,.25)`, borderRadius: 8, background: C.tealL, color: C.teal, cursor: "pointer" }}>
                      <i className="bi bi-eye" />
                    </button>
                    <button title="Imprimir" onClick={() => window.open(`/educacion/consulta?paciente_id=${pacienteId}&sesion_id=${s.id}&print=1`, "_blank")}
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
