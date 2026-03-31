import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

// Hook para detectar tamaño de pantalla
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return isMobile;
}

const ESTADO_COLOR = {
  PENDIENTE:    { bg: "linear-gradient(135deg, #ffc107 0%, #ff9800 100%)", fg: "#000", shadow: "rgba(255, 193, 7, 0.3)" },
  CONFIRMADA:   { bg: "linear-gradient(135deg, #0d6efd 0%, #0056b3 100%)", fg: "#fff", shadow: "rgba(13, 110, 253, 0.3)" },
  EN_ESPERA:    { bg: "linear-gradient(135deg, #6610f2 0%, #520dc2 100%)", fg: "#fff", shadow: "rgba(102, 16, 242, 0.3)" },
  EN_ATENCION:  { bg: "linear-gradient(135deg, #198754 0%, #146c43 100%)", fg: "#fff", shadow: "rgba(25, 135, 84, 0.3)" },
  COMPLETADA:   { bg: "linear-gradient(135deg, #6c757d 0%, #495057 100%)", fg: "#fff", shadow: "rgba(108, 117, 125, 0.3)" },
  CANCELADA:    { bg: "linear-gradient(135deg, #dc3545 0%, #bb2d3b 100%)", fg: "#fff", shadow: "rgba(220, 53, 69, 0.3)" },
  NO_ASISTIO:   { bg: "linear-gradient(135deg, #fd7e14 0%, #e86000 100%)", fg: "#fff", shadow: "rgba(253, 126, 20, 0.3)" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 12
    }
  }
};

function KpiCard({ label, value, icon, gradient, sub, delay = 0, isMobile, to, navigate }) {
  return (
    <motion.div 
      className="col-6 col-lg-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, type: "spring", stiffness: 100 }}
    >
      <motion.div 
        className="h-100"
        whileHover={{ y: -5, transition: { duration: 0.2 } }}
        onClick={() => to && navigate(to)}
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)",
          backdropFilter: "blur(10px)",
          borderRadius: isMobile ? "12px" : "20px",
          padding: isMobile ? "12px" : "24px",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: isMobile ? 80 : 120,
          height: isMobile ? 80 : 120,
          background: gradient,
          borderRadius: "50%",
          opacity: 0.1,
          filter: "blur(40px)"
        }} />
        
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: isMobile ? 44 : 56,
            height: isMobile ? 44 : 56,
            borderRadius: isMobile ? "12px" : "16px",
            background: gradient,
            marginBottom: isMobile ? "12px" : "16px",
            fontSize: isMobile ? "20px" : "24px",
            boxShadow: "0 8px 16px rgba(0,0,0,0.1)"
          }}>
            {icon}
          </div>
          
          <div style={{ 
            fontSize: isMobile ? "24px" : "32px", 
            fontWeight: "700", 
            color: "#1a1a1a",
            marginBottom: "4px",
            fontFamily: "'Inter', sans-serif"
          }}>
            {value ?? "—"}
          </div>
          
          <div style={{ 
            fontSize: isMobile ? "12px" : "14px", 
            color: "#666",
            fontWeight: "500",
            marginBottom: sub ? "4px" : "0"
          }}>
            {label}
          </div>
          
          {sub && (
            <div style={{ 
              fontSize: isMobile ? "10px" : "11px", 
              color: "#999",
              fontWeight: "400"
            }}>
              {sub}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats]   = useState(null);
  const [sala,  setSala]    = useState([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/stats"),
      api.get("/dashboard/sala-espera"),
    ])
    .then(([s, e]) => {
      setStats(s.data.data);
      setSala(e.data.data || []);
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const hoy = dayjs().format("dddd D [de] MMMM YYYY");

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #506adb 0%, #20244c 100%)",
      padding: "0",
      margin: isMobile ? "-1rem" : "-1.5rem",
      width: isMobile ? "calc(100% + 2rem)" : "calc(100% + 3rem)"
    }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header con glassmorphism */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(20px)",
            borderRadius: "0",
            padding: isMobile ? "16px 12px" : "28px 32px",
            marginBottom: isMobile ? "8px" : "16px",
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px"
          }}
        >
          <div>
            <h2 style={{ 
              margin: 0, 
              fontWeight: "800", 
              fontSize: isMobile ? "22px" : "32px",
              color: "#fff",
              textShadow: "0 2px 10px rgba(0,0,0,0.1)",
              fontFamily: "'Inter', sans-serif"
            }}>
              ✨ Dashboard
            </h2>
            <p style={{ 
              margin: "4px 0 0", 
              color: "rgba(255,255,255,0.9)",
              textTransform: "capitalize",
              fontSize: isMobile ? "11px" : "14px",
              fontWeight: "500"
            }}>
              {hoy}
            </p>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.2)",
            borderRadius: isMobile ? "12px" : "16px",
            padding: isMobile ? "8px 12px" : "12px 20px",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.3)",
            width: isMobile ? "100%" : "auto"
          }}>
            <span style={{ 
              color: "rgba(255,255,255,0.9)", 
              fontSize: isMobile ? "11px" : "14px",
              fontWeight: "500"
            }}>
              Bienvenido/a,{" "}
            </span>
            <strong style={{ color: "#fff", fontSize: isMobile ? "12px" : "15px" }}>
              {user?.nombres} {user?.apellidos}
            </strong>
            <span style={{
              marginLeft: isMobile ? "6px" : "10px",
              background: "linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.2))",
              padding: isMobile ? "2px 8px" : "4px 12px",
              borderRadius: isMobile ? "6px" : "8px",
              fontSize: isMobile ? "10px" : "12px",
              color: "#fff",
              fontWeight: "600",
              display: "inline-block"
            }}>
              {user?.tipo}
            </span>
          </div>
        </motion.div>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: "center",
              padding: "80px 20px",
              color: "#fff"
            }}
          >
            <div className="spinner-border spinner-border-lg" style={{ width: "3rem", height: "3rem" }} />
            <p style={{ marginTop: "16px", fontSize: "16px", fontWeight: "500" }}>
              Cargando datos…
            </p>
          </motion.div>
        )}

        {!loading && stats && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* KPIs con gradientes */}
            <div className={`row ${isMobile ? 'g-1 px-1' : 'g-3 px-3'} mb-3`}>
              <KpiCard 
                label="Total Pacientes" 
                value={stats.total_pacientes} 
                icon="👥" 
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                delay={0}
                isMobile={isMobile}
                to="/pacientes"
                navigate={navigate}
              />
              <KpiCard 
                label="Citas Hoy" 
                value={stats.citas_hoy} 
                icon="📅" 
                gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                delay={0.1}
                isMobile={isMobile}
                to="/citas"
                navigate={navigate}
              />
              <KpiCard 
                label="Esta Semana" 
                value={stats.citas_semana} 
                icon="📊" 
                gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
                delay={0.2}
                isMobile={isMobile}
                to="/citas"
                navigate={navigate}
              />
              <KpiCard 
                label="Confirmadas Hoy"
                value={stats.estados_hoy?.find(e => e.estado === "CONFIRMADA")?.total ?? 0}
                icon="✅" 
                gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
                delay={0.3}
                isMobile={isMobile}
                to="/citas"
                navigate={navigate}
              />
            </div>

            {/* Desglose estados hoy */}
            {stats.estados_hoy?.length > 0 && (
              <motion.div
                variants={itemVariants}
                className={isMobile ? "mx-1" : "mx-3"}
                style={{
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(10px)",
                  borderRadius: "12px",
                  padding: isMobile ? "12px" : "20px",
                  marginBottom: isMobile ? "8px" : "16px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.08)"
                }}
              >
                <h6 style={{ 
                  fontWeight: "700", 
                  marginBottom: isMobile ? "12px" : "20px",
                  fontSize: isMobile ? "15px" : "18px",
                  color: "#1a1a1a"
                }}>
                  Estados de citas hoy
                </h6>
                <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? "6px" : "12px" }}>
                  {stats.estados_hoy.map((e, idx) => (
                    <motion.span
                      key={e.estado}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.5 + idx * 0.1, type: "spring", stiffness: 200 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      style={{
                        background: ESTADO_COLOR[e.estado]?.bg,
                        color: ESTADO_COLOR[e.estado]?.fg,
                        padding: isMobile ? "6px 12px" : "10px 20px",
                        borderRadius: isMobile ? "8px" : "12px",
                        fontSize: isMobile ? "11px" : "14px",
                        fontWeight: "600",
                        boxShadow: `0 4px 12px ${ESTADO_COLOR[e.estado]?.shadow}`,
                        cursor: "pointer"
                      }}
>
                      {e.estado}: {e.total}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}

            <div className={`row ${isMobile ? 'g-1 px-1' : 'g-3 px-3'}`}>
              {/* Sala de espera */}
              <motion.div 
                className="col-lg-8"
                variants={itemVariants}
              >
                <div style={{
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(10px)",
                  borderRadius: isMobile ? "12px" : "20px",
                  padding: isMobile ? "12px" : "20px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                  height: "100%"
                }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    marginBottom: isMobile ? "12px" : "20px",
                    flexWrap: isMobile ? "wrap" : "nowrap",
                    gap: isMobile ? "8px" : "0"
                  }}>
                    <h6 style={{ 
                      fontWeight: "700", 
                      margin: 0,
                      fontSize: isMobile ? "15px" : "18px",
                      color: "#1a1a1a"
                    }}>
                      🏥 Sala de Espera — Hoy
                    </h6>
                    <Link 
                      to="/citas" 
                      style={{
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        color: "#fff",
                        padding: isMobile ? "6px 12px" : "8px 20px",
                        borderRadius: isMobile ? "10px" : "12px",
                        textDecoration: "none",
                        fontSize: isMobile ? "11px" : "14px",
                        fontWeight: "600",
                        boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                        transition: "transform 0.2s",
                        display: "inline-block"
                      }}
                      onMouseEnter={(e) => e.target.style.transform = "translateY(-2px)"}
                      onMouseLeave={(e) => e.target.style.transform = "translateY(0)"}
                    >
                      Ver agenda
                    </Link>
                  </div>
                  {sala.length === 0
                    ? <p style={{ color: "#999", fontSize: isMobile ? "12px" : "14px" }}>No hay citas pendientes para hoy.</p>
                    : (
                      <div className="table-responsive">
                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: isMobile ? "0 4px" : "0 8px" }}>
                          <thead>
                            <tr style={{ color: "#666", fontSize: isMobile ? "11px" : "13px", fontWeight: "600" }}>
                              <th style={{ padding: isMobile ? "6px 8px" : "8px 12px", textAlign: "left" }}>Hora</th>
                              <th style={{ padding: isMobile ? "6px 8px" : "8px 12px", textAlign: "left" }}>Paciente</th>
                              {!isMobile && <th style={{ padding: "8px 12px", textAlign: "left" }}>Médico</th>}
                              <th style={{ padding: isMobile ? "6px 8px" : "8px 12px", textAlign: "left" }}>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sala.map((c, idx) => (
                              <motion.tr
                                key={c.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                style={{
                                  background: "rgba(102, 126, 234, 0.05)",
                                  borderRadius: isMobile ? "8px" : "12px"
                                }}
                              >
                                <td style={{ 
                                  padding: isMobile ? "12px 8px" : "16px 12px", 
                                  color: "#666",
                                  fontSize: isMobile ? "11px" : "13px",
                                  fontWeight: "600",
                                  borderTopLeftRadius: isMobile ? "8px" : "12px",
                                  borderBottomLeftRadius: isMobile ? "8px" : "12px"
                                }}>
                                  {dayjs(c.inicio).format("HH:mm")}
                                </td>
                                <td style={{ padding: isMobile ? "12px 8px" : "16px 12px" }}>
                                  <div style={{ fontWeight: "600", fontSize: isMobile ? "12px" : "14px", color: "#1a1a1a" }}>
                                    {c.paciente_apellidos}, {c.paciente_nombres}
                                  </div>
                                  <div style={{ fontSize: isMobile ? "10px" : "12px", color: "#999" }}>{c.paciente_tel}</div>
                                </td>
                                {!isMobile && (
                                  <td style={{ 
                                    padding: "16px 12px",
                                    fontSize: "14px",
                                    color: "#666"
                                  }}>
                                    Dr. {c.medico_apellidos}
                                  </td>
                                )}
                                <td style={{ 
                                  padding: isMobile ? "12px 8px" : "16px 12px",
                                  borderTopRightRadius: isMobile ? "8px" : "12px",
                                  borderBottomRightRadius: isMobile ? "8px" : "12px"
                                }}>
                                  <span style={{
                                    background: ESTADO_COLOR[c.estado]?.bg,
                                    color: ESTADO_COLOR[c.estado]?.fg,
                                    padding: isMobile ? "4px 8px" : "6px 14px",
                                    borderRadius: isMobile ? "6px" : "8px",
                                    fontSize: isMobile ? "9px" : "11px",
                                    fontWeight: "700",
                                    display: "inline-block",
                                    boxShadow: `0 2px 8px ${ESTADO_COLOR[c.estado]?.shadow}`
                                  }}>
                                    {c.estado}
                                  </span>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </div>
              </motion.div>

              {/* Últimos pacientes */}
              <motion.div 
                className="col-lg-4"
                variants={itemVariants}
              >
                <div style={{
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(10px)",
                  borderRadius: "12px",
                  padding: isMobile ? "12px" : "20px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                  height: "100%"
                }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    marginBottom: isMobile ? "12px" : "20px",
                    flexWrap: isMobile ? "wrap" : "nowrap",
                    gap: isMobile ? "8px" : "0"
                  }}>
                    <h6 style={{ 
                      fontWeight: "700", 
                      margin: 0,
                      fontSize: isMobile ? "15px" : "18px",
                      color: "#1a1a1a"
                    }}>
                      👤 Últimos Pacientes
                    </h6>
                    <Link 
                      to="/pacientes"
                      style={{
                        background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                        color: "#fff",
                        padding: isMobile ? "4px 10px" : "6px 16px",
                        borderRadius: isMobile ? "8px" : "10px",
                        textDecoration: "none",
                        fontSize: isMobile ? "10px" : "12px",
                        fontWeight: "600",
                        boxShadow: "0 4px 12px rgba(240, 147, 251, 0.4)",
                        transition: "transform 0.2s",
                        display: "inline-block"
                      }}
                      onMouseEnter={(e) => e.target.style.transform = "translateY(-2px)"}
                      onMouseLeave={(e) => e.target.style.transform = "translateY(0)"}
                    >
                      Ver todos
                    </Link>
                  </div>
                  {(stats.ultimos_pacientes || []).length === 0
                    ? <p style={{ color: "#999", fontSize: isMobile ? "12px" : "14px" }}>Sin pacientes registrados.</p>
                    : (
                      <div>
                        {(stats.ultimos_pacientes || []).map((p, idx) => (
                          <motion.div
                            key={p.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ x: 5 }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: isMobile ? "8px" : "12px",
                              padding: isMobile ? "8px" : "12px",
                              borderRadius: isMobile ? "10px" : "12px",
                              marginBottom: isMobile ? "6px" : "8px",
                              background: "rgba(102, 126, 234, 0.05)",
                              cursor: "pointer",
                              transition: "background 0.2s"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(102, 126, 234, 0.1)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(102, 126, 234, 0.05)"}
                          >
                            <div style={{
                              width: isMobile ? "36px" : "44px",
                              height: isMobile ? "36px" : "44px",
                              borderRadius: isMobile ? "10px" : "12px",
                              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontWeight: "700",
                              fontSize: isMobile ? "13px" : "16px",
                              flexShrink: 0,
                              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)"
                            }}>
                              {p.nombres?.[0]}{p.apellidos?.[0]}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontSize: isMobile ? "12px" : "14px", 
                                fontWeight: "600",
                                color: "#1a1a1a"
                              }}>
                                {p.apellidos}, {p.nombres}
                              </div>
                              <div style={{ 
                                fontSize: isMobile ? "10px" : "12px", 
                                color: "#999"
                              }}>
                                DNI {p.dni}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )
                  }
                </div>
              </motion.div>
            </div>

            {/* Accesos rápidos según rol */}
            {(user?.tipo === "ADMIN" || user?.tipo === "SUPER_ADMIN") && (
              <motion.div
                variants={itemVariants}
                className={`row ${isMobile ? 'g-1 px-1' : 'g-3 px-3'} mt-3`}
              >
                {[
                  { to: "/admin/usuarios", label: "Usuarios", icon: "👤", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
                  { to: "/admin/servicios", label: "Servicios", icon: "🏷️", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
                  { to: "/admin/horarios", label: "Horarios", icon: "🕐", gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
                  { to: "/admin/config", label: "Configuración", icon: "⚙️", gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
                ].map((l, idx) => (
                  <div key={l.to} className="col-6 col-md-3">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 1 + idx * 0.1 }}
                      whileHover={{ y: -8, transition: { duration: 0.2 } }}
                    >
                      <Link 
                        to={l.to} 
                        style={{
                          display: "block",
                          background: "rgba(255,255,255,0.95)",
                          backdropFilter: "blur(10px)",
                          borderRadius: "12px",
                          padding: isMobile ? "12px" : "16px",
                          textDecoration: "none",
                          border: "1px solid rgba(255,255,255,0.3)",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                          textAlign: "center",
                          position: "relative",
                          overflow: "hidden"
                        }}
                      >
                        <div style={{
                          position: "absolute",
                          top: -20,
                          right: -20,
                          width: isMobile ? 60 : 70,
                          height: isMobile ? 60 : 70,
                          background: l.gradient,
                          borderRadius: "50%",
                          opacity: 0.1,
                          filter: "blur(30px)"
                        }} />
                        <div style={{ 
                          fontSize: isMobile ? "24px" : "32px", 
                          marginBottom: isMobile ? "8px" : "12px",
                          position: "relative",
                          zIndex: 1
                        }}>
                          {l.icon}
                        </div>
                        <div style={{ 
                          fontSize: isMobile ? "12px" : "14px", 
                          fontWeight: "600",
                          color: "#1a1a1a",
                          position: "relative",
                          zIndex: 1
                        }}>
                          {l.label}
                        </div>
                      </Link>
                    </motion.div>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

