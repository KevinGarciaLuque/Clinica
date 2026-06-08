import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";

/* ── Mini gráfico SVG de línea ────────────────────────────────────────── */
function LineChart({ puntos, color, label, maximo = 27 }) {
  if (!puntos || puntos.length === 0) return null;
  const W = 340, H = 100, PAD = { t: 10, r: 10, b: 30, l: 36 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const xs = puntos.map((_, i) => PAD.l + (puntos.length === 1 ? iW / 2 : (i / (puntos.length - 1)) * iW));
  const ys = puntos.map(p => PAD.t + iH - (p.v / maximo) * iH);

  const path = puntos.length === 1
    ? ""
    : `M ${xs.map((x, i) => `${x},${ys[i]}`).join(" L ")}`;

  const area = puntos.length > 1
    ? `M ${xs[0]},${PAD.t + iH} L ${xs.map((x, i) => `${x},${ys[i]}`).join(" L ")} L ${xs[xs.length - 1]},${PAD.t + iH} Z`
    : "";

  const niveles = maximo === 27
    ? [{ v: 4, l: "4" }, { v: 9, l: "9" }, { v: 14, l: "14" }, { v: 19, l: "19" }]
    : [{ v: 4, l: "4" }, { v: 9, l: "9" }, { v: 14, l: "14" }];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      <defs>
        <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Líneas de referencia */}
      {niveles.map(n => {
        const y = PAD.t + iH - (n.v / maximo) * iH;
        return (
          <g key={n.v}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
              stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,3" />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end"
              fontSize="9" fill="#94a3b8">{n.l}</text>
          </g>
        );
      })}
      {/* Eje X — fechas */}
      {puntos.map((p, i) => (
        <text key={i} x={xs[i]} y={H - 6} textAnchor="middle"
          fontSize="9" fill="#94a3b8">
          {dayjs(p.fecha).format("DD/MM")}
        </text>
      ))}
      {/* Área rellena */}
      {area && <path d={area} fill={`url(#grad-${label})`} />}
      {/* Línea */}
      {path && <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {/* Puntos */}
      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r="5" fill="#fff" stroke={color} strokeWidth="2.5" />
          <text x={xs[i]} y={ys[i] - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
            {p.v}
          </text>
        </g>
      ))}
    </svg>
  );
}

const C = {
  purple:    "#673AB7",
  purpleL:   "#EDE7F6",
  purpleB:   "rgba(103,58,183,.12)",
  green:     "#10b981",
  amber:     "#f59e0b",
  red:       "#ef4444",
  muted:     "#64748b",
  border:    "#e5e7eb",
  text:      "#1e293b",
  bg:        "#f8fafc",
};

const PHQ9_COLOR  = (p) => p <= 4 ? C.green : p <= 9 ? C.amber : C.red;
const GAD7_COLOR  = (p) => p <= 4 ? C.green : p <= 9 ? C.amber : C.red;
const SCALE_COLOR = (tipo, p) => tipo === "PHQ9" ? PHQ9_COLOR(p) : GAD7_COLOR(p);

export default function HistorialPsicologico({ pacienteId }) {
  const navigate   = useNavigate();
  const [resumen,  setResumen]  = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rRes, rSes] = await Promise.all([
        api.get(`/psicologia/resumen/${pacienteId}`),
        api.get(`/psicologia/sesiones?paciente_id=${pacienteId}&limit=50`),
      ]);
      setResumen(rRes.data.data);
      setSesiones(rSes.data.data || []);
    } catch (e) {
      setError(e.response?.data?.msg || "Error al cargar historial psicológico");
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => { cargar(); }, [cargar]);

  const irConsulta = (sesionId = null) => {
    const url = `/psicologia/consulta?paciente_id=${pacienteId}${sesionId ? `&sesion_id=${sesionId}` : ""}`;
    navigate(url);
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
      <div style={{
        width: 36, height: 36, border: `3px solid ${C.border}`,
        borderTopColor: C.purple, borderRadius: "50%",
        animation: "spin .8s linear infinite", margin: "0 auto 12px",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize: 14 }}>Cargando historial psicológico...</span>
    </div>
  );

  if (error) return (
    <div style={{
      background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)",
      borderRadius: 12, padding: "16px 20px", color: C.red,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <i className="bi bi-exclamation-triangle-fill" /> {error}
    </div>
  );

  const { total_sesiones = 0, ultima_sesion, plan, escalas = [] } = resumen || {};
  const ultimaEscalas = {};
  for (const e of escalas) {
    if (!ultimaEscalas[e.tipo_escala]) ultimaEscalas[e.tipo_escala] = e;
  }

  // Puntos ordenados cronológicamente para cada escala
  const puntosEscala = (tipo) =>
    [...escalas]
      .filter(e => e.tipo_escala === tipo)
      .sort((a, b) => new Date(a.aplicado_en) - new Date(b.aplicado_en))
      .map(e => ({ v: e.puntaje_total, fecha: e.aplicado_en, label: e.interpretacion }));

  const phq9pts = puntosEscala("PHQ9");
  const gad7pts = puntosEscala("GAD7");
  const hayGraficos = phq9pts.length > 0 || gad7pts.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header con botón Nueva Sesión ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.purple}, #512DA8)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-activity" style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Historia Psicológica</div>
            <div style={{ fontSize: 12, color: C.muted }}>{total_sesiones} sesión{total_sesiones !== 1 ? "es" : ""} registrada{total_sesiones !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <button
          onClick={() => irConsulta()}
          style={{
            background: `linear-gradient(135deg, ${C.purple}, #512DA8)`,
            border: "none", borderRadius: 10, padding: "10px 20px",
            color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 14px rgba(103,58,183,.35)",
          }}
        >
          <i className="bi bi-plus-lg" />
          Nueva Sesión
        </button>
      </div>

      {/* ── Tarjetas de resumen ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>

        {/* Total sesiones */}
        <div style={{
          background: C.purpleB, border: `1px solid rgba(103,58,183,.2)`,
          borderRadius: 12, padding: "16px 18px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
            Total sesiones
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.purple, lineHeight: 1 }}>{total_sesiones}</div>
        </div>

        {/* Última sesión */}
        <div style={{
          background: "#f0fdf4", border: "1px solid rgba(16,185,129,.2)",
          borderRadius: 12, padding: "16px 18px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
            Última sesión
          </div>
          {ultima_sesion ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                Sesión #{ultima_sesion.numero_sesion}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {dayjs(ultima_sesion.creado_en).format("DD/MM/YYYY")}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>Sin sesiones</div>
          )}
        </div>

        {/* Plan terapéutico */}
        {plan && (
          <div style={{
            background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)",
            borderRadius: 12, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
              Plan terapéutico
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              {plan.enfoque || "Sin enfoque definido"}
            </div>
            {/* Barra de progreso */}
            <div style={{ background: "rgba(245,158,11,.2)", borderRadius: 99, height: 6, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                background: `linear-gradient(90deg, ${C.amber}, #d97706)`,
                width: `${plan.progreso_general || 0}%`,
                transition: "width .5s",
              }} />
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{plan.progreso_general || 0}% progreso</div>
          </div>
        )}

        {/* Escalas últimas */}
        {Object.entries(ultimaEscalas).map(([tipo, escala]) => (
          <div key={tipo} style={{
            background: `rgba(${SCALE_COLOR(tipo, escala.puntaje_total) === C.green ? "16,185,129" : SCALE_COLOR(tipo, escala.puntaje_total) === C.amber ? "245,158,11" : "239,68,68"},.08)`,
            border: `1px solid ${SCALE_COLOR(tipo, escala.puntaje_total)}40`,
            borderRadius: 12, padding: "16px 18px",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: SCALE_COLOR(tipo, escala.puntaje_total), textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
              {tipo === "PHQ9" ? "PHQ-9 Depresión" : "GAD-7 Ansiedad"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: SCALE_COLOR(tipo, escala.puntaje_total), lineHeight: 1 }}>
              {escala.puntaje_total}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{escala.interpretacion}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {dayjs(escala.aplicado_en).format("DD/MM/YYYY")}
            </div>
          </div>
        ))}
      </div>

      {/* ── Gráficos de evolución ── */}
      {hayGraficos && (
        <div style={{
          background: "#fff", border: `1px solid ${C.border}`,
          borderRadius: 14, overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,.05)",
        }}>
          <div style={{
            padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
            background: C.bg, display: "flex", alignItems: "center", gap: 10,
          }}>
            <i className="bi bi-graph-up-arrow" style={{ color: C.purple, fontSize: 16 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Evolución de Escalas</span>
            <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>seguimiento por sesión</span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: phq9pts.length > 0 && gad7pts.length > 0 ? "1fr 1fr" : "1fr",
            gap: 0,
          }}>
            {phq9pts.length > 0 && (
              <div style={{
                padding: "16px 20px",
                borderRight: gad7pts.length > 0 ? `1px solid ${C.border}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>PHQ-9</span>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>Depresión</span>
                  </div>
                  {phq9pts.length > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px",
                      background: `${PHQ9_COLOR(phq9pts[phq9pts.length - 1].v)}20`,
                      color: PHQ9_COLOR(phq9pts[phq9pts.length - 1].v),
                    }}>
                      Actual: {phq9pts[phq9pts.length - 1].v} — {phq9pts[phq9pts.length - 1].label}
                    </span>
                  )}
                </div>
                <LineChart puntos={phq9pts} color={C.amber} label="phq9" maximo={27} />
              </div>
            )}
            {gad7pts.length > 0 && (
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>GAD-7</span>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>Ansiedad</span>
                  </div>
                  {gad7pts.length > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px",
                      background: `${GAD7_COLOR(gad7pts[gad7pts.length - 1].v)}20`,
                      color: GAD7_COLOR(gad7pts[gad7pts.length - 1].v),
                    }}>
                      Actual: {gad7pts[gad7pts.length - 1].v} — {gad7pts[gad7pts.length - 1].label}
                    </span>
                  )}
                </div>
                <LineChart puntos={gad7pts} color={C.purple} label="gad7" maximo={21} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Lista de sesiones ── */}
      <div style={{
        background: "#fff", border: `1px solid ${C.border}`,
        borderRadius: 14, overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,.05)",
      }}>
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
          background: C.bg, display: "flex", alignItems: "center", gap: 10,
        }}>
          <i className="bi bi-journal-text" style={{ color: C.purple, fontSize: 16 }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Sesiones</span>
        </div>

        {sesiones.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
            <i className="bi bi-activity" style={{ fontSize: 36, display: "block", marginBottom: 10, opacity: .3 }} />
            <div style={{ fontSize: 14 }}>No hay sesiones registradas</div>
            <button
              onClick={() => irConsulta()}
              style={{
                marginTop: 14, background: C.purple, border: "none",
                borderRadius: 9, padding: "8px 20px", color: "#fff",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}
            >
              + Registrar primera sesión
            </button>
          </div>
        ) : (
          <div>
            {sesiones.map((s, idx) => {
              const firmada = s.estado === "FIRMADA";
              return (
                <div
                  key={s.id}
                  style={{
                    padding: "14px 20px",
                    borderBottom: idx < sesiones.length - 1 ? `1px solid ${C.border}` : "none",
                    display: "flex", alignItems: "center", gap: 14,
                    cursor: "pointer", transition: "background .15s",
                  }}
                  onClick={() => irConsulta(s.id)}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.bg}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  {/* Número de sesión */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: firmada ? C.purpleB : "rgba(245,158,11,.1)",
                    border: `1px solid ${firmada ? "rgba(103,58,183,.25)" : "rgba(245,158,11,.3)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column",
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: firmada ? C.purple : C.amber, lineHeight: 1 }}>
                      #{s.numero_sesion}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>
                        Sesión {s.numero_sesion}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px",
                        background: firmada ? "rgba(16,185,129,.1)" : "rgba(245,158,11,.1)",
                        color: firmada ? C.green : C.amber,
                        border: `1px solid ${firmada ? "rgba(16,185,129,.25)" : "rgba(245,158,11,.25)"}`,
                      }}>
                        <i className={`bi bi-${firmada ? "check-circle-fill" : "pencil"} me-1`} />
                        {firmada ? "Firmada" : "Borrador"}
                      </span>
                      {s.modalidad && (
                        <span style={{
                          fontSize: 11, borderRadius: 6, padding: "2px 8px",
                          background: C.purpleB, color: C.purple,
                          border: "1px solid rgba(103,58,183,.2)",
                        }}>
                          {s.modalidad}
                        </span>
                      )}
                    </div>
                    {s.motivo_consulta && (
                      <div style={{
                        fontSize: 12, color: C.muted,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        maxWidth: 400,
                      }}>
                        {s.motivo_consulta}
                      </div>
                    )}
                    {s.psicologo_nombre && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        <i className="bi bi-person-fill me-1" />{s.psicologo_nombre}
                      </div>
                    )}
                  </div>

                  {/* Fecha */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {dayjs(s.creado_en).format("DD/MM/YYYY")}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {dayjs(s.creado_en).format("HH:mm")}
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div
                    style={{ display: "flex", gap: 6, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Ver */}
                    <button
                      title="Ver sesión"
                      onClick={() => irConsulta(s.id)}
                      style={{
                        width: 32, height: 32, border: "1px solid rgba(103,58,183,.25)",
                        borderRadius: 8, background: C.purpleB, color: C.purple,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, transition: "all .15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.purple; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = C.purpleB; e.currentTarget.style.color = C.purple; }}
                    >
                      <i className="bi bi-eye" />
                    </button>

                    {/* Editar (solo si no está firmada) */}
                    {!firmada && (
                      <button
                        title="Editar sesión"
                        onClick={() => irConsulta(s.id)}
                        style={{
                          width: 32, height: 32, border: "1px solid rgba(245,158,11,.3)",
                          borderRadius: 8, background: "rgba(245,158,11,.1)", color: C.amber,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, transition: "all .15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.amber; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,.1)"; e.currentTarget.style.color = C.amber; }}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                    )}

                    {/* Imprimir */}
                    <button
                      title="Imprimir sesión"
                      onClick={() => {
                        const url = `/psicologia/consulta?paciente_id=${pacienteId}&sesion_id=${s.id}&print=1`;
                        window.open(url, "_blank");
                      }}
                      style={{
                        width: 32, height: 32, border: "1px solid rgba(16,185,129,.25)",
                        borderRadius: 8, background: "rgba(16,185,129,.1)", color: C.green,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, transition: "all .15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.green; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,.1)"; e.currentTarget.style.color = C.green; }}
                    >
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
