import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api/api";
import { nombreMedico } from "../utils/medico";
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

const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function CalendarioPopup({ onClose }) {
  const [mes, setMes] = useState(dayjs().startOf("month"));
  const hoy = dayjs();

  const primerDia = mes.day() === 0 ? 6 : mes.day() - 1; // lunes=0
  const diasEnMes = mes.daysInMonth();
  const celdas = primerDia + diasEnMes;
  const totalFilas = Math.ceil(celdas / 7);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.18, type: "spring", stiffness: 300, damping: 24 }}
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        right: 0,
        zIndex: 9999,
        background: "linear-gradient(160deg, #1e2d50 0%, #243b72 100%)",
        border: "1px solid rgba(125,211,252,0.2)",
        borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        padding: "18px 20px",
        width: "min(280px, 90vw)",
        userSelect: "none",
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Cabecera mes */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button
          onClick={() => setMes(m => m.subtract(1, "month"))}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#7dd3fc", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <i className="bi bi-chevron-left" />
        </button>

        <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem", textTransform: "capitalize" }}>
          {mes.format("MMMM YYYY")}
        </span>

        <button
          onClick={() => setMes(m => m.add(1, "month"))}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#7dd3fc", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <i className="bi bi-chevron-right" />
        </button>
      </div>

      {/* Días de semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
        {DIAS_SEMANA.map(d => (
          <div key={d} style={{ textAlign: "center", color: "#7dd3fc", fontSize: "0.7rem", fontWeight: 700, padding: "4px 0" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Celdas días */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {Array.from({ length: totalFilas * 7 }).map((_, i) => {
          const dia = i - primerDia + 1;
          const valido = dia >= 1 && dia <= diasEnMes;
          const esHoy = valido && mes.year() === hoy.year() && mes.month() === hoy.month() && dia === hoy.date();
          const esFinde = valido && ((i % 7) === 5 || (i % 7) === 6);

          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                padding: "6px 2px",
                borderRadius: 8,
                fontSize: "0.82rem",
                fontWeight: esHoy ? 800 : 400,
                color: !valido ? "transparent" : esHoy ? "#1e2d50" : esFinde ? "#f87171" : "rgba(255,255,255,0.85)",
                background: esHoy ? "#7dd3fc" : "transparent",
                boxShadow: esHoy ? "0 2px 10px rgba(125,211,252,0.4)" : "none",
                transition: "background 0.15s",
                cursor: valido ? "default" : "default",
              }}
            >
              {valido ? dia : ""}
            </div>
          );
        })}
      </div>

      {/* Botón volver a hoy */}
      {!(mes.year() === hoy.year() && mes.month() === hoy.month()) && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            onClick={() => setMes(hoy.startOf("month"))}
            style={{ background: "rgba(125,211,252,0.15)", border: "1px solid rgba(125,211,252,0.3)", borderRadius: 8, color: "#7dd3fc", fontSize: "0.75rem", fontWeight: 600, padding: "5px 14px", cursor: "pointer" }}
          >
            Hoy
          </button>
        </div>
      )}
    </motion.div>
  );
}

function EventoFestivoBanner({ isMobile, evento }) {
  if (!evento) return null;
  const color = evento.color || "#1e40af";
  const largo = evento.nombre.length;
  const fontSizeNombre = largo > 26 ? (isMobile ? 13 : 19)
    : largo > 16 ? (isMobile ? 15 : 23)
    : (isMobile ? 17 : 27);
  // Evita que el navegador parta palabras justo después de un guion (ej. "Medic-KG")
  const nombreSinCortes = evento.nombre.replace(/-/g, "‑");

  return (
    <>
      <style>{`
        @keyframes evfest-float {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50%     { transform: translateY(-9px) rotate(5deg); }
        }
        @keyframes evfest-glow {
          0%,100% { opacity:0.35; transform: scale(1); }
          50%     { opacity:0.55; transform: scale(1.08); }
        }
      `}</style>

      {/* Tarjeta del evento — banda izquierda, elegante */}
      <div style={{
        position:'absolute', left: isMobile ? 10 : 24, top:'50%', transform:'translateY(-50%)',
        pointerEvents:'none', zIndex:0, textAlign:'left', lineHeight:1.2,
        userSelect:'none', maxWidth: isMobile ? 190 : 380,
        background: `linear-gradient(135deg, ${color}12, ${color}05)`,
        border: `1px solid ${color}22`,
        borderRadius: 14,
        padding: isMobile ? '8px 12px' : '10px 18px',
        backdropFilter: 'blur(2px)',
      }}>
        <div style={{
          display:'flex', alignItems:'center', gap: 6,
          fontSize: isMobile ? 8.5 : 10.5, fontWeight:800, color, letterSpacing:'0.16em',
          textTransform:'uppercase', opacity:0.7, marginBottom: 3,
        }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:color, display:'inline-block' }} />
          Evento especial
        </div>
        <div style={{
          fontSize: fontSizeNombre, fontWeight:800, letterSpacing:'-0.01em',
          background: `linear-gradient(135deg, ${color}, ${color}99)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text', overflowWrap: 'normal', wordBreak: 'keep-all',
          whiteSpace: 'pre-line',
        }}>
          {nombreSinCortes}
        </div>
      </div>

      {/* Emoji del evento — derecha, con halo suave y animación */}
      <div style={{
        position:'absolute', right: isMobile ? 14 : 34, top:'50%', transform:'translateY(-50%)',
        pointerEvents:'none', zIndex:0, userSelect:'none',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div style={{
          position:'absolute', width: isMobile ? 60 : 92, height: isMobile ? 60 : 92,
          borderRadius:'50%',
          background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
          animation:'evfest-glow 3.2s ease-in-out infinite',
        }} />
        <div style={{
          fontSize: isMobile ? 42 : 64, lineHeight:1, position:'relative',
          animation:'evfest-float 3.2s ease-in-out infinite',
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.12))',
        }}>
          {evento.emoji}
        </div>
      </div>
    </>
  );
}

// Versión compacta para móvil: en flujo normal (no absoluta) para que nunca
// se monte encima del saludo — en pantallas angostas no hay espacio para las
// bandas laterales de la versión de escritorio.
function EventoFestivoBannerMobile({ evento }) {
  if (!evento) return null;
  const color = evento.color || "#1e40af";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: `linear-gradient(135deg, ${color}12, ${color}05)`,
      border: `1px solid ${color}22`,
      borderRadius: 12, padding: "6px 14px",
      maxWidth: "100%",
    }}>
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{evento.emoji}</span>
      <div style={{ textAlign: "left", lineHeight: 1.15, minWidth: 0 }}>
        <div style={{
          fontSize: 8, fontWeight: 800, color, letterSpacing: "0.14em",
          textTransform: "uppercase", opacity: 0.7,
        }}>
          Evento especial
        </div>
        <div style={{
          fontSize: 13, fontWeight: 800, color,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {evento.nombre.replace(/\n/g, " ")}
        </div>
      </div>
    </div>
  );
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
  const [stats, setStats]     = useState(null);
  const [sala,  setSala]      = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventoFestivo, setEventoFestivo] = useState(null);
  const [calOpen, setCalOpen] = useState(false);
  const calRef                = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!calOpen) return;
    const cerrar = (e) => { if (calRef.current && !calRef.current.contains(e.target)) setCalOpen(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [calOpen]);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/stats", { params: { fecha: dayjs().format("YYYY-MM-DD") } }),
      api.get("/dashboard/sala-espera", { params: { fecha: dayjs().format("YYYY-MM-DD") } }),
    ])
    .then(([s, e]) => {
      setStats(s.data.data);
      setSala(e.data.data || []);
    })
    .catch(() => {})
    .finally(() => setLoading(false));

    api.get("/eventos-festivos/activo", { params: { fecha: dayjs().format("YYYY-MM-DD") } })
      .then(r => setEventoFestivo(r.data.data || null))
      .catch(() => setEventoFestivo(null));
  }, []);

  const hoy       = dayjs().format("dddd D [de] MMMM YYYY");
  const diaNombre  = dayjs().format("dddd");
  const diaNumero  = dayjs().format("D");
  const mesAnio    = dayjs().format("MMMM YYYY");

  const hora = dayjs().hour();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const emojiSaludo = hora < 12 ? "☀️" : hora < 19 ? "🌤️" : "🌙";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f0f2f5",
      padding: "0",
      margin: isMobile ? "-1rem" : "-1.5rem",
      width: isMobile ? "calc(100% + 2rem)" : "calc(100% + 3rem)"
    }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          style={{
            background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
            padding: isMobile ? "14px 16px" : "16px 24px",
            marginBottom: 0,
            boxShadow: "0 2px 12px rgba(0,0,0,.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <i className="bi bi-speedometer2" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: isMobile ? "1rem" : "1.05rem" }}>
                Dashboard
              </div>
            </div>
          </div>

          {/* Fecha grande lado derecho — visible en todos los tamaños */}
          <div ref={calRef} style={{ position: "relative" }}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              onClick={() => setCalOpen(o => !o)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 10 : 16,
                background: calOpen ? "rgba(125,211,252,0.12)" : "rgba(255,255,255,0.07)",
                border: `1px solid ${calOpen ? "rgba(125,211,252,0.4)" : "rgba(255,255,255,0.12)"}`,
                borderRadius: 14,
                padding: isMobile ? "7px 12px" : "10px 20px",
                backdropFilter: "blur(10px)",
                cursor: "pointer",
                transition: "background 0.2s, border 0.2s",
              }}
            >
              {/* Número del día */}
              <div style={{
                fontSize: isMobile ? "2rem" : "3rem",
                fontWeight: 800,
                color: "#7dd3fc",
                lineHeight: 1,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "-2px",
              }}>
                {diaNumero}
              </div>

              {/* Separador */}
              <div style={{ width: 1, height: isMobile ? 32 : 44, background: "rgba(255,255,255,0.18)" }} />

              {/* Día y mes */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: isMobile ? "0.8rem" : "0.95rem",
                  textTransform: "capitalize",
                  letterSpacing: "0.02em",
                }}>
                  {diaNombre}
                </span>
                <span style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: isMobile ? "0.68rem" : "0.78rem",
                  textTransform: "capitalize",
                  fontWeight: 500,
                }}>
                  {mesAnio}
                </span>
              </div>

              {/* Ícono calendario — solo desktop/tablet */}
              {!isMobile && (
                <i className="bi bi-calendar3" style={{ color: "rgba(125,211,252,0.6)", fontSize: "1rem", marginLeft: 4 }} />
              )}
            </motion.div>

            <AnimatePresence>
              {calOpen && <CalendarioPopup onClose={() => setCalOpen(false)} />}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Banner de bienvenida centrado */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, type: "spring", delay: 0.15 }}
          style={{
            background: "#fff",
            borderBottom: "1px solid #e9ecef",
            padding: isMobile ? "16px 16px" : "18px 32px",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: isMobile ? 10 : 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {!isMobile && <EventoFestivoBanner isMobile={isMobile} evento={eventoFestivo} />}
          {isMobile && <EventoFestivoBannerMobile evento={eventoFestivo} />}

          <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
            {/* Emoji saludo animado: flota + saluda continuamente */}
            <motion.div
              animate={{
                y: [0, -6, 0, -4, 0],
                rotate: [0, 0, 14, -10, 14, 0, 0],
                scale: [1, 1.08, 1, 1.05, 1],
              }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                repeatDelay: 2.5,
                ease: "easeInOut",
              }}
              style={{ display: "inline-block", fontSize: isMobile ? 30 : 38, marginBottom: 6, lineHeight: 1, cursor: "default" }}
            >
              {emojiSaludo}
            </motion.div>

            {/* Saludo principal */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: isMobile ? 4 : 8 }}>
              <span style={{ color: "#6b7280", fontSize: isMobile ? "0.95rem" : "1.1rem", fontWeight: 500 }}>
                {saludo},
              </span>
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
                style={{
                  color: "#1e293b",
                  fontSize: isMobile ? "1rem" : "1.18rem",
                  fontWeight: 800,
                  letterSpacing: "0.01em",
                }}
              >
                {user?.titulo ? `${user.titulo} ` : ""}{user?.nombres} {user?.apellidos}
              </motion.span>
            </div>

            {eventoFestivo?.mensaje && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                style={{
                  marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6,
                  background: `${eventoFestivo.color || "#1e40af"}14`,
                  border: `1px solid ${eventoFestivo.color || "#1e40af"}33`,
                  color: eventoFestivo.color || "#1e40af",
                  borderRadius: 20, padding: "4px 12px", fontSize: isMobile ? "0.7rem" : "0.76rem", fontWeight: 600,
                }}
              >
                {eventoFestivo.emoji} {eventoFestivo.mensaje}
              </motion.div>
            )}
          </div>
        </motion.div>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: "center",
              padding: "80px 20px",
              color: "#6b7280"
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
            {/* KPIs */}
            <div className={`row ${isMobile ? 'g-1 px-1' : 'g-3 px-3'}`} style={{ paddingTop: isMobile ? 8 : 20, marginBottom: isMobile ? 8 : 16 }}>
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
                  background: "#fff",
                  borderRadius: 12,
                  padding: isMobile ? "12px" : "20px",
                  marginBottom: isMobile ? 8 : 16,
                  boxShadow: "0 2px 8px rgba(0,0,0,.06)",
                  border: "1px solid #e5e7eb"
                }}
              >
                <h6 style={{ 
                  fontWeight: 700, 
                  marginBottom: isMobile ? 10 : 16,
                  fontSize: "0.9rem",
                  color: "#374151",
                  margin: "0 0 14px"
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
                  background: "#fff",
                  borderRadius: 12,
                  padding: isMobile ? "12px" : "20px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 2px 8px rgba(0,0,0,.06)",
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
                      fontWeight: 700, 
                      margin: 0,
                      fontSize: "0.92rem",
                      color: "#1e293b"
                    }}>
                      🏥 Sala de Espera — Hoy
                    </h6>
                    <Link 
                      to="/citas" 
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        padding: isMobile ? "5px 12px" : "6px 16px",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        display: "inline-block"
                      }}
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
                                    {c.paciente_nombres} {c.paciente_apellidos}
                                  </div>
                                  <div style={{ fontSize: isMobile ? "10px" : "12px", color: "#999" }}>{c.paciente_tel}</div>
                                </td>
                                {!isMobile && (
                                  <td style={{ 
                                    padding: "16px 12px",
                                    fontSize: "14px",
                                    color: "#666"
                                  }}>
                                    {nombreMedico(c)}
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
                  background: "#fff",
                  borderRadius: 12,
                  padding: isMobile ? "12px" : "20px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 2px 8px rgba(0,0,0,.06)",
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
                      fontWeight: 700, 
                      margin: 0,
                      fontSize: "0.92rem",
                      color: "#1e293b"
                    }}>
                      👤 Últimos Pacientes
                    </h6>
                    <Link 
                      to="/pacientes"
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        padding: isMobile ? "4px 10px" : "5px 14px",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        display: "inline-block"
                      }}
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
                                {p.nombres} {p.apellidos}
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
                className={`row ${isMobile ? 'g-1 px-1' : 'g-3 px-3'}`}
                style={{ marginTop: isMobile ? 8 : 16, paddingBottom: isMobile ? 8 : 24 }}
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
                          background: "#fff",
                          borderRadius: 12,
                          padding: isMobile ? "12px" : "16px",
                          textDecoration: "none",
                          border: "1px solid #e5e7eb",
                          boxShadow: "0 2px 8px rgba(0,0,0,.06)",
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

