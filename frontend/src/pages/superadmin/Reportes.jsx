import { useEffect, useState, useMemo } from "react";
import api from "../../api/api";

/* ── Paleta (igual que las demás páginas super admin) ── */
const C = {
  bg:      "#0d1b2e",
  surface: "#112240",
  card:    "#162a45",
  border:  "rgba(255,255,255,0.07)",
  accent:  "#2196f3",
  accentD: "#1976d2",
  success: "#10b981",
  warning: "#f59e0b",
  danger:  "#ef4444",
  purple:  "#8b5cf6",
  text:    "#e2e8f0",
  muted:   "#94a3b8",
};

/* ── Umbrales para badge de riesgo de capacidad ── */
const UMBRAL_ALTO    = 500;   // pacientes
const UMBRAL_MEDIO   = 200;

function nivelCarga(totalPacientes) {
  if (totalPacientes >= UMBRAL_ALTO)  return { label: "Alta",  color: C.danger,  icon: "bi-exclamation-triangle-fill" };
  if (totalPacientes >= UMBRAL_MEDIO) return { label: "Media", color: C.warning, icon: "bi-dash-circle-fill" };
  return                                       { label: "Baja",  color: C.success, icon: "bi-check-circle-fill" };
}

function fmtFecha(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function diasRestantes(licFin) {
  if (!licFin) return null;
  const diff = Math.ceil((new Date(licFin) - new Date()) / 864e5);
  return diff;
}

/* ── Barra de progreso mini ── */
function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s" }} />
    </div>
  );
}

/* ── Sparkline SVG (gráfico de línea simple) ── */
function Sparkline({ data = [], color = C.accent, height = 32 }) {
  if (data.length < 2) return <span style={{ color: C.muted, fontSize: "0.7rem" }}>Sin datos</span>;
  const w = 100;
  const maxV = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - (v / maxV) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Tarjeta KPI global ── */
function KpiCard({ label, value, icon, color = C.accent, sub }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: "0.78rem" }}>
        <i className={icon} style={{ color }} />
        {label}
      </div>
      <div style={{ fontSize: "1.9rem", fontWeight: 700, color: C.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: C.muted }}>{sub}</div>}
    </div>
  );
}

export default function Reportes() {
  const [clinicas, setClinicas]     = useState([]);
  const [crecimiento, setCrecimiento] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [ordenBy, setOrdenBy]       = useState("total_pacientes");

  useEffect(() => {
    async function cargar() {
      try {
        const [r1, r2] = await Promise.all([
          api.get("/reportes/clinicas"),
          api.get("/reportes/crecimiento"),
        ]);
        setClinicas(r1.data.data || []);
        setCrecimiento(r2.data.data || []);
      } catch (e) {
        setError("No se pudo cargar el reporte.");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  /* ── Sparks por clínica (últimos 12 meses) ── */
  const sparklines = useMemo(() => {
    const mapa = {};
    crecimiento.forEach(({ clinica_id, mes, nuevos_pacientes }) => {
      if (!mapa[clinica_id]) mapa[clinica_id] = {};
      mapa[clinica_id][mes] = nuevos_pacientes;
    });
    // Generar arreglo ordenado por mes
    const meses = [...new Set(crecimiento.map(r => r.mes))].sort();
    const resultado = {};
    Object.entries(mapa).forEach(([id, data]) => {
      resultado[id] = meses.map(m => data[m] || 0);
    });
    return resultado;
  }, [crecimiento]);

  /* ── KPIs globales ── */
  const kpis = useMemo(() => {
    const total_clinicas   = clinicas.length;
    const total_pacientes  = clinicas.reduce((s, c) => s + (c.total_pacientes  || 0), 0);
    const total_citas      = clinicas.reduce((s, c) => s + (c.total_citas      || 0), 0);
    const total_consultas  = clinicas.reduce((s, c) => s + (c.total_consultas  || 0), 0);
    const activas          = clinicas.filter(c => c.activo).length;
    const hoy              = new Date();
    const licVencidas      = clinicas.filter(c => c.licencia_fin && new Date(c.licencia_fin) < hoy).length;
    return { total_clinicas, total_pacientes, total_citas, total_consultas, activas, licVencidas };
  }, [clinicas]);

  /* ── Máximos para barras relativas ── */
  const maxPacientes = useMemo(() => Math.max(...clinicas.map(c => c.total_pacientes || 0), 1), [clinicas]);

  /* ── Filtrado + ordenado ── */
  const lista = useMemo(() => {
    const q = search.toLowerCase();
    return clinicas
      .filter(c => !q || c.nombre.toLowerCase().includes(q) || (c.ciudad || "").toLowerCase().includes(q))
      .sort((a, b) => (b[ordenBy] || 0) - (a[ordenBy] || 0));
  }, [clinicas, search, ordenBy]);

  /* ── Top 5 de crecimiento este mes ── */
  const top5Mes = useMemo(() =>
    [...clinicas]
      .sort((a, b) => (b.pacientes_este_mes || 0) - (a.pacientes_este_mes || 0))
      .slice(0, 5)
  , [clinicas]);

  if (loading) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
      <i className="bi bi-arrow-repeat" style={{ marginRight: 8, animation: "spin 1s linear infinite" }} />
      Cargando reportes…
    </div>
  );

  if (error) return (
    <div style={{ padding: 32, color: C.danger }}><i className="bi bi-exclamation-triangle-fill" /> {error}</div>
  );

  return (
    <div style={{ padding: "28px 24px", color: C.text, minHeight: "100vh" }}>

      {/* ── Encabezado ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="bi bi-bar-chart-line-fill" style={{ color: C.accent }} />
          Reportes &amp; Analítica
        </h2>
        <p style={{ margin: "6px 0 0", color: C.muted, fontSize: "0.85rem" }}>
          Visión global de todas las clínicas — útil para decidir migraciones o escalado independiente.
        </p>
      </div>

      {/* ── KPIs globales ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 14, marginBottom: 28,
      }}>
        <KpiCard label="Clínicas activas"     value={kpis.activas}          icon="bi-building-check"        color={C.success} sub={`de ${kpis.total_clinicas} en total`} />
        <KpiCard label="Pacientes totales"    value={kpis.total_pacientes.toLocaleString("es")}   icon="bi-people-fill"           color={C.accent} />
        <KpiCard label="Citas registradas"    value={kpis.total_citas.toLocaleString("es")}       icon="bi-calendar-check-fill"   color={C.purple} />
        <KpiCard label="Consultas realizadas" value={kpis.total_consultas.toLocaleString("es")}   icon="bi-journal-medical"       color={C.warning} />
        <KpiCard label="Licencias vencidas"   value={kpis.licVencidas}       icon="bi-shield-exclamation"    color={C.danger}  sub="revisar renovación" />
      </div>

      {/* ── Dos columnas: Top crecimiento + Barra de ordenado ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>

        {/* Top 5 crecimiento este mes */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px" }}>
          <h4 style={{ margin: "0 0 14px", fontSize: "0.9rem", color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-trophy-fill" style={{ color: C.warning }} />
            Top 5 crecimiento — este mes
          </h4>
          {top5Mes.length === 0
            ? <p style={{ color: C.muted, fontSize: "0.8rem" }}>Sin datos este mes.</p>
            : top5Mes.map((c, i) => (
              <div key={c.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: "0.82rem", color: C.text }}>
                    <span style={{ color: C.muted, marginRight: 6 }}>#{i + 1}</span> {c.nombre}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: C.success }}>
                    +{c.pacientes_este_mes || 0}
                  </span>
                </div>
                <MiniBar value={c.pacientes_este_mes || 0} max={top5Mes[0]?.pacientes_este_mes || 1} color={C.success} />
              </div>
            ))
          }
        </div>

        {/* Carga por capacidad */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px" }}>
          <h4 style={{ margin: "0 0 14px", fontSize: "0.9rem", color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-speedometer2" style={{ color: C.accent }} />
            Nivel de carga por clínica
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Carga alta",  umbral: UMBRAL_ALTO,   color: C.danger },
              { label: "Carga media", umbral: UMBRAL_MEDIO,  color: C.warning },
              { label: "Carga baja",  umbral: 0,             color: C.success },
            ].map(({ label, umbral, color }) => {
              const cnt = clinicas.filter(c => {
                const n = nivelCarga(c.total_pacientes || 0);
                return n.color === color;
              }).length;
              return (
                <div key={label} style={{
                  background: `${color}18`, border: `1px solid ${color}44`,
                  borderRadius: 10, padding: "12px 14px", textAlign: "center",
                }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, color }}>{cnt}</div>
                  <div style={{ fontSize: "0.72rem", color: C.muted, marginTop: 2 }}>{label}</div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: "0.72rem", color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
            <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
            Umbral alto ≥ {UMBRAL_ALTO} pacientes · Medio ≥ {UMBRAL_MEDIO} · Bajo &lt; {UMBRAL_MEDIO}
          </p>
        </div>
      </div>

      {/* ── Tabla detallada ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px" }}>

        {/* Cabecera + filtros */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <h4 style={{ margin: 0, fontSize: "0.92rem", color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-table" style={{ color: C.accent }} />
            Detalle por clínica
          </h4>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar clínica o ciudad…"
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "6px 12px", color: C.text, fontSize: "0.82rem", outline: "none", width: 200,
              }}
            />
            <select
              value={ordenBy}
              onChange={e => setOrdenBy(e.target.value)}
              style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "6px 10px", color: C.text, fontSize: "0.82rem", outline: "none",
              }}
            >
              <option value="total_pacientes">↓ Pacientes</option>
              <option value="total_citas">↓ Citas</option>
              <option value="total_consultas">↓ Consultas</option>
              <option value="citas_este_mes">↓ Citas este mes</option>
              <option value="pacientes_este_mes">↓ Nuevos este mes</option>
              <option value="dias_en_plataforma">↓ Más antiguas</option>
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.muted, textAlign: "left" }}>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Clínica</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Tipo</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Ciudad</th>
                <th style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>Pacientes</th>
                <th style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>Nuevos / mes</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Usuarios</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Citas</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Consultas</th>
                <th style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>Tendencia 12m</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Licencia</th>
                <th style={{ padding: "8px 10px", fontWeight: 600 }}>Carga</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: "24px", textAlign: "center", color: C.muted }}>
                    No hay clínicas que coincidan.
                  </td>
                </tr>
              )}
              {lista.map(c => {
                const nivel   = nivelCarga(c.total_pacientes || 0);
                const dias    = diasRestantes(c.licencia_fin);
                const spark   = sparklines[c.id] || [];
                const licColor = dias === null ? C.muted : dias < 0 ? C.danger : dias < 15 ? C.warning : C.success;

                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Nombre */}
                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ fontWeight: 600, color: C.text }}>{c.nombre}</div>
                      <div style={{ color: C.muted, fontSize: "0.72rem" }}>/{c.slug}</div>
                    </td>

                    {/* Tipo */}
                    <td style={{ padding: "10px 10px", color: C.muted }}>{c.tipo_nombre || "—"}</td>

                    {/* Ciudad */}
                    <td style={{ padding: "10px 10px", color: C.muted }}>{c.ciudad || "—"}</td>

                    {/* Pacientes + barra */}
                    <td style={{ padding: "10px 10px", minWidth: 120 }}>
                      <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>
                        {(c.total_pacientes || 0).toLocaleString("es")}
                      </div>
                      <MiniBar value={c.total_pacientes || 0} max={maxPacientes} color={C.accent} />
                    </td>

                    {/* Nuevos este mes */}
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      <span style={{
                        background: `${C.success}22`, color: C.success,
                        borderRadius: 6, padding: "2px 8px", fontWeight: 600, fontSize: "0.8rem",
                      }}>
                        +{c.pacientes_este_mes || 0}
                      </span>
                    </td>

                    {/* Usuarios */}
                    <td style={{ padding: "10px 10px", textAlign: "center", color: C.text }}>
                      {c.total_usuarios || 0}
                    </td>

                    {/* Citas */}
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      <div style={{ color: C.text }}>{(c.total_citas || 0).toLocaleString("es")}</div>
                      <div style={{ color: C.muted, fontSize: "0.71rem" }}>{c.citas_este_mes || 0} este mes</div>
                    </td>

                    {/* Consultas */}
                    <td style={{ padding: "10px 10px", textAlign: "center", color: C.text }}>
                      {(c.total_consultas || 0).toLocaleString("es")}
                    </td>

                    {/* Sparkline */}
                    <td style={{ padding: "10px 10px", minWidth: 90 }}>
                      <Sparkline data={spark} color={C.purple} />
                    </td>

                    {/* Licencia */}
                    <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                      <div style={{ color: C.text, fontSize: "0.75rem", textTransform: "capitalize" }}>
                        {c.plan_tipo || "—"}
                      </div>
                      <div style={{ color: licColor, fontSize: "0.71rem" }}>
                        {dias === null
                          ? "Sin fecha"
                          : dias < 0
                            ? `Vencida hace ${Math.abs(dias)}d`
                            : `Vence en ${dias}d`}
                      </div>
                    </td>

                    {/* Nivel de carga */}
                    <td style={{ padding: "10px 10px" }}>
                      <span style={{
                        background: `${nivel.color}22`, color: nivel.color,
                        borderRadius: 6, padding: "3px 9px", fontSize: "0.75rem", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                      }}>
                        <i className={`bi ${nivel.icon}`} />
                        {nivel.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, color: C.muted, fontSize: "0.72rem", textAlign: "right" }}>
          {lista.length} clínica{lista.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Nota de migración ── */}
      <div style={{
        marginTop: 20, background: `${C.warning}15`, border: `1px solid ${C.warning}44`,
        borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <i className="bi bi-lightbulb-fill" style={{ color: C.warning, marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: "0.8rem", color: C.muted, lineHeight: 1.6 }}>
          <strong style={{ color: C.warning }}>Recomendación de escalado:</strong> Si una clínica supera los{" "}
          <strong>{UMBRAL_ALTO} pacientes</strong>, considera alojarla en una base de datos o instancia propia.
          El nivel de carga "Alta" es la señal principal. También evalúa el crecimiento mensual sostenido
          (sparkline tendencia al alza) y la cantidad de citas activas.
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #112240; }
      `}</style>
    </div>
  );
}
