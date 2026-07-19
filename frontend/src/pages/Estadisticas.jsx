import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

const CANAL_LABEL = {
  RECEPCION: "Recepción",
  PORTAL:    "Portal del paciente",
  IA:        "Asistente IA",
  TELEFONO:  "Teléfono",
};
const CANAL_COLOR = {
  RECEPCION: "#667eea",
  PORTAL:    "#10b981",
  IA:        "#f59e0b",
  TELEFONO:  "#f5576c",
};

function fmtMoneda(n) {
  return `L ${Number(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 110, damping: 14 } },
};

function KpiCard({ label, value, icon, gradient, sub, delay = 0, isMobile }) {
  return (
    <motion.div
      className="col-6 col-lg-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, type: "spring", stiffness: 110 }}
    >
      <motion.div
        className="h-100"
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        style={{
          background: "#fff", borderRadius: isMobile ? 12 : 20,
          padding: isMobile ? 12 : 24, border: "1px solid #e5e7eb",
          boxShadow: "0 8px 32px rgba(0,0,0,0.06)", position: "relative", overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", top: -30, right: -30,
          width: isMobile ? 80 : 120, height: isMobile ? 80 : 120,
          background: gradient, borderRadius: "50%", opacity: 0.12, filter: "blur(40px)",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: isMobile ? 40 : 52, height: isMobile ? 40 : 52,
            borderRadius: isMobile ? 12 : 16, background: gradient,
            marginBottom: isMobile ? 10 : 14, fontSize: isMobile ? 18 : 22,
            boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
          }}>
            {icon}
          </div>
          <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
            {value ?? "—"}
          </div>
          <div style={{ fontSize: isMobile ? 11 : 13, color: "#666", fontWeight: 500 }}>{label}</div>
          {sub && <div style={{ fontSize: isMobile ? 10 : 11, color: "#999", marginTop: 2 }}>{sub}</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Estadisticas() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const esAdmin = user?.tipo === "ADMIN" || user?.tipo === "SUPER_ADMIN";

  const [mes, setMes]           = useState(dayjs().startOf("month"));
  const [resumen, setResumen]   = useState(null);
  const [serie, setSerie]       = useState([]);
  const [porMedico, setPorMedico] = useState([]);
  const [loading, setLoading]   = useState(true);

  const desde = mes.startOf("month").format("YYYY-MM-DD");
  const hasta = mes.endOf("month").format("YYYY-MM-DD");

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { desde, hasta };
    const requests = [
      api.get("/estadisticas/resumen", { params }),
      api.get("/estadisticas/serie-citas", { params }),
    ];
    if (esAdmin) requests.push(api.get("/estadisticas/por-medico", { params }));

    Promise.all(requests)
      .then(([r, s, m]) => {
        setResumen(r.data.data);
        setSerie(s.data.data || []);
        if (m) setPorMedico(m.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [desde, hasta, esAdmin]);

  useEffect(() => { cargar(); }, [cargar]);

  const canalMap = Object.fromEntries((resumen?.citas_por_canal || []).map(c => [c.canal, c.total]));
  const canceladas = Object.fromEntries((resumen?.citas_canceladas || []).map(c => [c.estado, c.total]));
  const serieChart = serie.map(s => ({
    fecha: dayjs(s.fecha).format("D/M"),
    total: s.total,
    completadas: s.completadas,
  }));

  return (
    <div style={{
      minHeight: "100vh", background: "#f0f2f5",
      margin: isMobile ? "-1rem" : "-1.5rem",
      width: isMobile ? "calc(100% + 2rem)" : "calc(100% + 3rem)",
    }}>
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        style={{
          background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
          padding: isMobile ? "14px 16px" : "16px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, boxShadow: "0 2px 12px rgba(0,0,0,.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <i className="bi bi-graph-up-arrow" style={{ color: "#7dd3fc", fontSize: "1rem" }} />
          </div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: isMobile ? "1rem" : "1.05rem" }}>
            Estadísticas
          </div>
        </div>

        {/* Selector de mes */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setMes(m => m.subtract(1, "month"))}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#7dd3fc" }}
          >
            <i className="bi bi-chevron-left" />
          </button>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem", textTransform: "capitalize", minWidth: 130, textAlign: "center" }}>
            {mes.format("MMMM YYYY")}
          </span>
          <button
            onClick={() => setMes(m => m.add(1, "month"))}
            disabled={mes.isSame(dayjs(), "month")}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: mes.isSame(dayjs(), "month") ? "default" : "pointer", color: mes.isSame(dayjs(), "month") ? "rgba(125,211,252,0.3)" : "#7dd3fc" }}
          >
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      </motion.div>

      {loading && (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#6b7280" }}>
          <div className="spinner-border" style={{ width: "3rem", height: "3rem" }} />
          <p style={{ marginTop: 16 }}>Cargando estadísticas…</p>
        </div>
      )}

      {!loading && resumen && (
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          {/* KPIs */}
          <div className={`row ${isMobile ? "g-1 px-1" : "g-3 px-3"}`} style={{ paddingTop: isMobile ? 12 : 20, marginBottom: isMobile ? 8 : 16 }}>
            <KpiCard label="Consultas atendidas" value={resumen.consultas_atendidas} icon="🩺"
              gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" isMobile={isMobile} delay={0} />
            <KpiCard label="Pacientes nuevos" value={resumen.pacientes_nuevos} icon="🆕"
              gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" isMobile={isMobile} delay={0.05} />
            <KpiCard label="Citas agendadas" value={resumen.citas_agendadas} icon="📅"
              gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" isMobile={isMobile} delay={0.1} />
            <KpiCard label="Canceladas / No asistió"
              value={(canceladas.CANCELADA || 0) + (canceladas.NO_ASISTIO || 0)} icon="⚠️"
              gradient="linear-gradient(135deg, #fd7e14 0%, #e86000 100%)" isMobile={isMobile} delay={0.15} />
          </div>

          {/* Ingresos — solo ADMIN/SUPER_ADMIN */}
          {resumen.ingresos && (
            <div className={`row ${isMobile ? "g-1 px-1" : "g-3 px-3"}`} style={{ marginBottom: isMobile ? 8 : 16 }}>
              <KpiCard label="Ingresos cobrados" value={fmtMoneda(resumen.ingresos.pagado)} icon="💰"
                gradient="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" isMobile={isMobile} delay={0.2} />
              <KpiCard label="Por cobrar" value={fmtMoneda(resumen.ingresos.pendiente)} icon="⏳"
                gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" isMobile={isMobile} delay={0.25} />
            </div>
          )}

          <div className={`row ${isMobile ? "g-1 px-1" : "g-3 px-3"}`}>
            {/* Gráfico de citas por día */}
            <motion.div className="col-lg-8" variants={itemVariants}>
              <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 12 : 20, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)", height: "100%" }}>
                <h6 style={{ fontWeight: 700, margin: "0 0 14px", fontSize: "0.92rem", color: "#1e293b" }}>
                  📈 Citas por día
                </h6>
                {serieChart.length === 0 ? (
                  <p style={{ color: "#999", fontSize: 13 }}>Sin datos en este rango.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={serieChart} margin={{ top: 4, right: 16, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="total" name="Citas agendadas" fill="#667eea" radius={[5, 5, 0, 0]} maxBarSize={40} />
                      <Line type="monotone" dataKey="completadas" name="Completadas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            {/* Citas por canal */}
            <motion.div className="col-lg-4" variants={itemVariants}>
              <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 12 : 20, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)", height: "100%" }}>
                <h6 style={{ fontWeight: 700, margin: "0 0 14px", fontSize: "0.92rem", color: "#1e293b" }}>
                  📊 Citas por canal
                </h6>
                {Object.keys(canalMap).length === 0 ? (
                  <p style={{ color: "#999", fontSize: 13 }}>Sin datos en este rango.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {Object.entries(canalMap).map(([canal, total]) => {
                      const totalTodos = Object.values(canalMap).reduce((a, b) => a + b, 0) || 1;
                      const pct = Math.round((total / totalTodos) * 100);
                      return (
                        <div key={canal}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: "#374151" }}>{CANAL_LABEL[canal] || canal}</span>
                            <span style={{ color: "#6b7280" }}>{total} ({pct}%)</span>
                          </div>
                          <div style={{ background: "#f3f4f6", borderRadius: 6, height: 8, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: CANAL_COLOR[canal] || "#9ca3af", borderRadius: 6 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Ranking por médico — solo ADMIN/SUPER_ADMIN */}
          {esAdmin && (
            <motion.div variants={itemVariants} className={isMobile ? "mx-1" : "mx-3"} style={{ marginTop: isMobile ? 8 : 16, paddingBottom: isMobile ? 8 : 24 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 12 : 20, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
                <h6 style={{ fontWeight: 700, margin: "0 0 14px", fontSize: "0.92rem", color: "#1e293b" }}>
                  👨‍⚕️ Ranking por médico
                </h6>
                {porMedico.length === 0 ? (
                  <p style={{ color: "#999", fontSize: 13 }}>Sin datos en este rango.</p>
                ) : (
                  <div className="table-responsive">
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "#666", fontSize: 12, fontWeight: 600 }}>
                          <th style={{ padding: "8px 12px", textAlign: "left" }}>Médico</th>
                          <th style={{ padding: "8px 12px", textAlign: "center" }}>Citas totales</th>
                          <th style={{ padding: "8px 12px", textAlign: "center" }}>Atendidas</th>
                          <th style={{ padding: "8px 12px", textAlign: "center" }}>Canceladas/No asistió</th>
                        </tr>
                      </thead>
                      <tbody>
                        {porMedico.map(m => (
                          <tr key={m.medico_id} style={{ borderTop: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1a1a1a", fontSize: 13 }}>
                              Dr. {m.nombres} {m.apellidos}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13 }}>{m.citas_totales}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, color: "#10b981", fontWeight: 700 }}>{m.consultas_atendidas}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, color: "#ef4444" }}>{m.canceladas_no_asistio}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
