import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : "59,130,246";
}

const FEATURES = [
  { icon: "bi-calendar2-check-fill", label: "Agenda de Citas",      desc: "Calendario completo con vista diaria, semanal y mensual." },
  { icon: "bi-people-fill",          label: "Gestión de Pacientes",  desc: "Expedientes digitales con historial, documentos y más." },
  { icon: "bi-file-medical-fill",    label: "Historia Clínica",      desc: "Registro clínico estructurado por especialidad." },
  { icon: "bi-capsule-pill",         label: "Prescripciones",        desc: "Recetas digitales con QR verificable." },
  { icon: "bi-graph-up-arrow",       label: "Reportes y Dashboard",  desc: "Estadísticas en tiempo real del desempeño de tu clínica." },
  { icon: "bi-bell-fill",            label: "Recordatorios",         desc: "Notificaciones automáticas por WhatsApp y correo." },
  { icon: "bi-shield-lock-fill",     label: "Seguridad",             desc: "Acceso por roles, cifrado y auditoría de sesiones." },
  { icon: "bi-phone-fill",           label: "Portal Público",        desc: "Página de citas online para tus pacientes." },
];

const ESPECIALIDADES = [
  { icon: "bi-heart-pulse-fill",       label: "Medicina General",        desc: "Consultas SOAP, signos vitales, diagnósticos CIE-10 y evolución clínica.",           color: "#3b82f6" },
  { icon: "bi-balloon-heart-fill",     label: "Pediatría",               desc: "Curva de crecimiento, carnet de vacunas y seguimiento desde el nacimiento.",          color: "#f59e0b" },
  { icon: "bi-emoji-smile-fill",       label: "Odontología",             desc: "Odontograma 2D/3D, historial dental por pieza y tratamientos detallados.",            color: "#06b6d4" },
  { icon: "bi-chat-heart-fill",        label: "Psicología",              desc: "Escalas psicológicas, análisis de bienestar y seguimiento terapéutico.",              color: "#8b5cf6" },
  { icon: "bi-stars",                  label: "Cirugía Estética",        desc: "Galería de resultados, presupuestos, consentimientos y seguimiento postoperatorio.",  color: "#ec4899" },
  { icon: "bi-gender-female",          label: "Ginecología",             desc: "Control prenatal, consultas ginecológicas y seguimiento obstétrico.",                 color: "#f43f5e" },
  { icon: "bi-heart-fill",             label: "Cardiología",             desc: "Historial cardiovascular, ECG adjunto y control de factores de riesgo.",              color: "#ef4444" },
  { icon: "bi-droplet-fill",           label: "Dermatología",            desc: "Registro de lesiones, seguimiento fotográfico y tratamientos dermatológicos.",        color: "#fb923c" },
  { icon: "bi-bandaid-fill",           label: "Traumatología",           desc: "Manejo de lesiones, imágenes adjuntas y seguimiento de recuperación.",                color: "#84cc16" },
  { icon: "bi-lightning-charge-fill",  label: "Neurología",              desc: "Evaluaciones neurológicas, escala de síntomas y seguimiento clínico.",               color: "#a855f7" },
  { icon: "bi-eye-fill",               label: "Oftalmología",            desc: "Agudeza visual, historial ocular y control de patologías refractivas.",              color: "#14b8a6" },
  { icon: "bi-ear-fill",               label: "Otorrinolaringología",    desc: "Evaluación auditiva, nasal y laríngea con historial completo.",                       color: "#f97316" },
  { icon: "bi-apple",                  label: "Nutrición",               desc: "Seguimiento nutricional, planes alimentarios y control de peso corporal.",           color: "#22c55e" },
  { icon: "bi-person-walking",         label: "Fisioterapia",            desc: "Plan de rehabilitación, sesiones de tratamiento y seguimiento funcional.",           color: "#0ea5e9" },
  { icon: "bi-clipboard2-pulse-fill",  label: "Medicina Interna",        desc: "Manejo integral del paciente adulto con múltiples patologías crónicas.",             color: "#6366f1" },
  { icon: "bi-flask-fill",             label: "Endocrinología",          desc: "Control hormonal, diabetes, tiroides y seguimiento metabólico.",                     color: "#d946ef" },
  { icon: "bi-activity",               label: "Gastroenterología",       desc: "Historial digestivo, adjuntos de endoscopía y seguimiento de patologías.",           color: "#78716c" },
  { icon: "bi-droplet-half",           label: "Urología",                desc: "Consultas urológicas, estudios adjuntos y manejo de patologías del tracto.",         color: "#2563eb" },
  { icon: "bi-bicycle",                label: "Medicina Deportiva",      desc: "Evaluación de rendimiento, lesiones deportivas y plan de retorno al deporte.",       color: "#10b981" },
  { icon: "bi-plus-circle-fill",       label: "Y más especialidades",    desc: "El sistema se adapta a cualquier área médica según las necesidades de tu clínica.",  color: "#64748b" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/config-sistema`)
      .then(r => r.json())
      .then(d => setCfg(d.data || {}))
      .catch(() => setCfg({}));
  }, []);

  if (!cfg) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0f172a" }}>
      <div style={{ width: 40, height: 40, border: "4px solid rgba(255,255,255,.15)", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (cfg.landing_activo === "0") return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f1f5f9", flexDirection: "column", gap: 12 }}>
      <i className="bi bi-tools" style={{ fontSize: 48, color: "#94a3b8" }} />
      <p style={{ color: "#64748b", fontWeight: 600 }}>Página en mantenimiento</p>
    </div>
  );

  const color    = cfg.landing_color_primario || cfg.color_primario || "#0E1F3C";
  const colorRgb = hexToRgb(color);
  const nombre   = cfg.nombre_sistema || "Medic-KG";
  const logoUrl  = cfg.logo_url
    ? (cfg.logo_url.startsWith("http") || cfg.logo_url.startsWith("data:")
        ? cfg.logo_url
        : `${API_URL}${cfg.logo_url}`)
    : "/logo.png";

  const parsePlanes = () => [
    {
      id: "trial",
      label: "Básico",
      badge: null,
      subtitulo: "Ideal para médico independiente o consultorio pequeño",
      precio: cfg.landing_plan_trial_precio || "Consultar",
      duracion: cfg.landing_plan_trial_duracion || "Semestral / Anual",
      features: tryParse(cfg.landing_plan_trial_features),
      icon: "bi-person-badge-fill",
      color: "#3b82f6",
      highlight: false,
    },
    {
      id: "semestral",
      label: "Avanzado",
      badge: "Popular",
      subtitulo: "Ideal para clínicas pequeñas con mayor flujo de pacientes",
      precio: cfg.landing_plan_semestral_precio || "Consultar",
      duracion: "Semestral / Anual",
      features: tryParse(cfg.landing_plan_semestral_features),
      icon: "bi-building-fill",
      color,
      highlight: true,
    },
    {
      id: "anual",
      label: "Empresarial",
      badge: "Completo",
      subtitulo: "Ideal para clínicas, centros médicos y consultorios multi-área",
      precio: cfg.landing_plan_anual_precio || "Consultar",
      duracion: "Semestral / Anual",
      features: tryParse(cfg.landing_plan_anual_features),
      icon: "bi-buildings-fill",
      color: "#10b981",
      highlight: false,
    },
  ];

  const whatsapp = cfg.landing_whatsapp?.replace(/\D/g, "");
  const planes   = parsePlanes();

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lp-btn-primary {
          background: ${color}; color: #fff; border: none;
          padding: 14px 32px; border-radius: 14px; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: transform .18s, box-shadow .18s;
          box-shadow: 0 6px 24px rgba(${colorRgb},.35);
        }
        .lp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(${colorRgb},.45); }
        .lp-btn-outline {
          background: transparent; color: ${color};
          border: 2px solid ${color}; padding: 13px 30px;
          border-radius: 14px; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: background .18s, color .18s;
        }
        .lp-btn-outline:hover { background: ${color}; color: #fff; }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 36px rgba(0,0,0,.1) !important; }
        .plan-card { transition: transform .2s, box-shadow .2s; }
        .plan-card:hover { transform: translateY(-6px); box-shadow: 0 20px 48px rgba(0,0,0,.12) !important; }
        .nav-link-lp { background: none; border: none; color: rgba(255,255,255,.8); font-size: 14px; font-weight: 500; cursor: pointer; padding: 6px 12px; border-radius: 8px; transition: color .15s, background .15s; }
        .nav-link-lp:hover { color: #fff; background: rgba(255,255,255,.1); }
        @media (max-width: 640px) {
          .hero-btns { flex-direction: column; }
          .planes-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @keyframes waPulse {
          0%   { box-shadow: 0 0 0 0 rgba(37,211,102,.6), 0 6px 24px rgba(37,211,102,.4); }
          60%  { box-shadow: 0 0 0 16px rgba(37,211,102,0), 0 6px 24px rgba(37,211,102,.4); }
          100% { box-shadow: 0 0 0 0 rgba(37,211,102,0), 0 6px 24px rgba(37,211,102,.4); }
        }
        @keyframes waRing {
          0%,100% { transform: rotate(0deg); }
          10%      { transform: rotate(-12deg); }
          20%      { transform: rotate(12deg); }
          30%      { transform: rotate(-10deg); }
          40%      { transform: rotate(10deg); }
          50%      { transform: rotate(-6deg); }
          60%      { transform: rotate(6deg); }
          70%      { transform: rotate(0deg); }
        }
        .wa-float-btn {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 9999;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          animation: waPulse 2.2s ease-in-out infinite;
          transition: transform .2s, width .3s, border-radius .3s, padding .3s;
          overflow: hidden;
        }
        .wa-float-btn i {
          font-size: 30px;
          color: #fff;
          animation: waRing 3.5s ease-in-out infinite;
          flex-shrink: 0;
        }
        .wa-float-label {
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          white-space: nowrap;
          max-width: 0;
          overflow: hidden;
          opacity: 0;
          transition: max-width .3s ease, opacity .25s ease, margin-left .3s ease;
          margin-left: 0;
        }
        .wa-float-btn:hover {
          width: auto;
          border-radius: 30px;
          padding: 0 20px;
          transform: translateY(-3px);
          animation: none;
          box-shadow: 0 10px 32px rgba(37,211,102,.5);
        }
        .wa-float-btn:hover .wa-float-label {
          max-width: 160px;
          opacity: 1;
          margin-left: 10px;
        }
        .wa-float-btn:hover i { animation: none; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: `linear-gradient(90deg, ${color} 0%, ${darken(color, 25)} 100%)`,
        boxShadow: "0 2px 20px rgba(0,0,0,.25)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 60,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logoUrl} alt="logo" style={{ height: 46, objectFit: "contain" }} />
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: "-.3px" }}>{nombre}</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div className="d-none d-md-flex" style={{ gap: 4 }}>
            <button className="nav-link-lp" onClick={() => navigate("/agenda-tu-consulta")}>Agenda tu consulta médica</button>
            <button className="nav-link-lp" onClick={() => scrollTo("caracteristicas")}>Características</button>
            <button className="nav-link-lp" onClick={() => scrollTo("especialidades")}>Especialidades</button>
            <button className="nav-link-lp" onClick={() => scrollTo("planes")}>Planes</button>
            <button className="nav-link-lp" onClick={() => scrollTo("nosotros")}>Nosotros</button>
            <button className="nav-link-lp" onClick={() => scrollTo("contacto")}>Contacto</button>
          </div>
          <button
            onClick={() => navigate("/login")}
            style={{
              marginLeft: 12,
              background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.35)",
              color: "#fff", borderRadius: 10, padding: "7px 18px",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              transition: "background .15s",
            }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,.28)"}
            onMouseOut={e  => e.currentTarget.style.background = "rgba(255,255,255,.18)"}
          >
            <i className="bi bi-box-arrow-in-right me-1" />Iniciar sesión
          </button>
          {/* Mobile menu button */}
          <button
            className="d-md-none"
            onClick={() => setMenuOpen(v => !v)}
            style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", marginLeft: 8 }}
          >
            <i className={`bi ${menuOpen ? "bi-x-lg" : "bi-list"}`} />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div style={{
          position: "fixed", top: 60, left: 0, right: 0, zIndex: 999,
          background: darken(color, 20), padding: 16,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <button className="nav-link-lp" style={{ textAlign: "left", padding: "10px 16px" }} onClick={() => { setMenuOpen(false); navigate("/agenda-tu-consulta"); }}>
            Agenda tu consulta médica
          </button>
          {["Características|caracteristicas","Especialidades|especialidades","Planes|planes","Nosotros|nosotros","Contacto|contacto"].map(item => {
            const [label, id] = item.split("|");
            return (
              <button key={id} className="nav-link-lp" style={{ textAlign: "left", padding: "10px 16px" }} onClick={() => scrollTo(id)}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100vh", paddingTop: 60,
        background: `linear-gradient(145deg, ${color} 0%, ${darken(color, 35)} 55%, #0f172a 100%)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "100px 24px 80px", position: "relative", overflow: "hidden",
      }}>
        {/* Decoración fondo */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 420, height: 420, borderRadius: "50%", background: "rgba(255,255,255,.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -100, left: -100, width: 340, height: 340, borderRadius: "50%", background: "rgba(255,255,255,.03)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 720, animation: "fadeUp .6s ease both", position: "relative" }}>
          <div style={{ marginBottom: 24 }}>
            <img src={logoUrl} alt="logo" style={{ height: 210, objectFit: "contain", filter: "drop-shadow(0 6px 24px rgba(0,0,0,.4))" }} />
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            borderRadius: 100, padding: "6px 16px", marginBottom: 20,
            color: "rgba(255,255,255,.9)", fontSize: 13, fontWeight: 600,
          }}>
            <i className="bi bi-stars" />
            Sistema de gestión clínica
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 20, letterSpacing: "-.5px" }}>
            {cfg.landing_tagline || nombre}
          </h1>
          {cfg.landing_descripcion && (
            <p style={{ fontSize: "clamp(1rem, 2vw, 1.2rem)", color: "rgba(255,255,255,.78)", lineHeight: 1.7, marginBottom: 36, maxWidth: 580, margin: "0 auto 36px" }}>
              {cfg.landing_descripcion}
            </p>
          )}
          <div className="hero-btns" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="lp-btn-primary" onClick={() => scrollTo("planes")}>
              <i className="bi bi-rocket-takeoff-fill me-2" />Ver planes
            </button>
            <button
              className="lp-btn-outline"
              onClick={() => navigate("/agenda-tu-consulta")}
              style={{ background: "rgba(255,255,255,.12)", border: "2px solid rgba(255,255,255,.4)", color: "#fff" }}
            >
              <i className="bi bi-calendar2-heart me-2" />Agenda tu consulta médica
            </button>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}?text=Hola, quiero información sobre ${nombre}`}
                target="_blank" rel="noopener noreferrer"
                className="lp-btn-outline"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(255,255,255,.12)", border: "2px solid rgba(255,255,255,.4)", color: "#fff" }}
              >
                <i className="bi bi-whatsapp" />Contáctanos
              </a>
            )}
          </div>
        </div>

        {/* Stats rápidos */}
        <div style={{
          marginTop: 64, display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center",
          animation: "fadeUp .6s .2s ease both",
        }}>
          {[
            { icon: "bi-building-check", val: "Multi-clínica", desc: "Soporte para varias sedes" },
            { icon: "bi-shield-check-fill", val: "Seguro", desc: "Datos cifrados y protegidos" },
            { icon: "bi-lightning-charge-fill", val: "Rápido", desc: "Acceso desde cualquier dispositivo" },
          ].map(s => (
            <div key={s.val} style={{ textAlign: "center", color: "rgba(255,255,255,.85)" }}>
              <i className={`bi ${s.icon}`} style={{ fontSize: 26, color: "rgba(255,255,255,.7)", display: "block", marginBottom: 6 }} />
              <div style={{ fontWeight: 800, fontSize: 15 }}>{s.val}</div>
              <div style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CARACTERÍSTICAS ── */}
      <section id="caracteristicas" style={{ background: "#f8fafc", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "1px" }}>
              ¿Qué incluye?
            </span>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, color: "#0f172a", marginTop: 8 }}>
              Todo lo que tu clínica necesita
            </h2>
          </div>
          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="feature-card"
                style={{
                  background: "#fff", borderRadius: 16, padding: "22px 20px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 2px 12px rgba(0,0,0,.05)",
                  transition: "transform .2s, box-shadow .2s",
                  animation: `fadeUp .5s ${i * 0.05}s ease both`,
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: 14,
                  background: `rgba(${colorRgb},.1)`, border: `1px solid rgba(${colorRgb},.2)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`bi ${f.icon}`} style={{ fontSize: 20, color }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 6 }}>{f.label}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ESPECIALIDADES ── */}
      <section id="especialidades" style={{ background: "#fff", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "1px" }}>
              Especialidades
            </span>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, color: "#0f172a", marginTop: 8 }}>
              Diseñado para cada área médica
            </h2>
            <p style={{ fontSize: 16, color: "#64748b", marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
              Un solo sistema para todas tus especialidades. Pediatría, adultos y más.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {ESPECIALIDADES.map((esp, i) => (
              <div
                key={i}
                style={{
                  background: "#fff",
                  borderRadius: 18,
                  padding: "26px 24px",
                  border: `1px solid ${esp.color}30`,
                  boxShadow: `0 4px 20px ${esp.color}12`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  transition: "transform .2s, box-shadow .2s",
                  animation: `fadeUp .5s ${i * 0.07}s ease both`,
                  cursor: "default",
                }}
                onMouseOver={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 12px 32px ${esp.color}22`; }}
                onMouseOut={e  => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = `0 4px 20px ${esp.color}12`; }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: `${esp.color}15`, border: `1px solid ${esp.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`bi ${esp.icon}`} style={{ fontSize: 22, color: esp.color }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 6 }}>{esp.label}</div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{esp.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" style={{ background: "#f8fafc", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "1px" }}>
              Precios
            </span>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, color: "#0f172a", marginTop: 8 }}>
              Planes para cada etapa
            </h2>
          </div>
          <div className="planes-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {planes.map(plan => (
              <div
                key={plan.id}
                className="plan-card"
                style={{
                  borderRadius: 20, padding: "32px 28px",
                  border: plan.highlight ? `2px solid ${plan.color}` : "1px solid #e2e8f0",
                  background: plan.highlight ? `linear-gradient(145deg, ${plan.color}08, #fff)` : "#fff",
                  boxShadow: plan.highlight ? `0 8px 40px rgba(${hexToRgb(plan.color)},.18)` : "0 2px 16px rgba(0,0,0,.06)",
                  position: "relative", overflow: "hidden",
                }}
              >
                {plan.badge && (
                  <div style={{
                    position: "absolute", top: 16, right: -28,
                    background: plan.color, color: "#fff",
                    fontSize: 11, fontWeight: 700, padding: "4px 36px",
                    transform: "rotate(45deg)", transformOrigin: "center",
                  }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{
                  width: 48, height: 48, borderRadius: 14, marginBottom: 18,
                  background: `${plan.color}18`, border: `1px solid ${plan.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`bi ${plan.icon}`} style={{ fontSize: 22, color: plan.color }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: plan.color, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>
                  Plan {plan.label}
                </div>
                <div style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
                  {plan.precio}
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8, marginTop: 4 }}>
                  {plan.duracion}
                </div>
                {plan.subtitulo && (
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 18, lineHeight: 1.5, background: `${plan.color}0d`, borderRadius: 8, padding: "6px 10px" }}>
                    {plan.subtitulo}
                  </div>
                )}
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#475569" }}>
                      <i className="bi bi-check-circle-fill" style={{ color: plan.color, fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                {whatsapp ? (
                  <a
                    href={`https://wa.me/${whatsapp}?text=Hola, me interesa el plan ${plan.label} de ${nombre}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "block", textAlign: "center", textDecoration: "none",
                      background: plan.highlight ? plan.color : "transparent",
                      color: plan.highlight ? "#fff" : plan.color,
                      border: `2px solid ${plan.color}`,
                      borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 14,
                      transition: "background .18s, color .18s",
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = plan.color; e.currentTarget.style.color = "#fff"; }}
                    onMouseOut={e  => { if (!plan.highlight) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = plan.color; } }}
                  >
                    <i className="bi bi-whatsapp me-2" />Solicitar plan
                  </a>
                ) : (
                  <button
                    onClick={() => navigate("/login")}
                    style={{
                      width: "100%", background: plan.highlight ? plan.color : "transparent",
                      color: plan.highlight ? "#fff" : plan.color,
                      border: `2px solid ${plan.color}`,
                      borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer",
                    }}
                  >
                    Comenzar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NOSOTROS ── */}
      <section id="nosotros" style={{ background: "#0f172a", padding: "96px 24px", position: "relative", overflow: "hidden" }}>
        {/* Decoración de fondo */}
        <div style={{ position: "absolute", top: -120, right: -120, width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: -80, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>

          {/* Encabezado */}
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: `${color}22`, border: `1px solid ${color}44`,
              borderRadius: 100, padding: "6px 18px", marginBottom: 20,
            }}>
              <i className="bi bi-building-fill-check" style={{ color, fontSize: 14 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "1.5px" }}>Sobre nosotros</span>
            </div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 20 }}>
              Tecnología al servicio<br />
              <span style={{ color }}>de la salud</span>
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,.65)", lineHeight: 1.8, maxWidth: 620, margin: "0 auto" }}>
              {cfg.landing_nosotros_texto ||
                `${nombre} nació con la misión de digitalizar y simplificar la gestión clínica. Creemos que los médicos deben enfocarse en sus pacientes, no en el papeleo.`}
            </p>
          </div>

          {/* Stats */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 1, background: "rgba(255,255,255,.06)", borderRadius: 20,
            border: "1px solid rgba(255,255,255,.08)", overflow: "hidden", marginBottom: 64,
          }}>
            {[
              { val: "5+",    label: "Especialidades médicas",  icon: "bi-heart-pulse-fill" },
              { val: "100%",  label: "En la nube",              icon: "bi-cloud-check-fill" },
              { val: "24/7",  label: "Acceso disponible",       icon: "bi-clock-fill" },
              { val: "Multi", label: "Clínica y sedes",         icon: "bi-building-fill" },
            ].map((s, i) => (
              <div key={i} style={{
                padding: "32px 24px", textAlign: "center",
                background: i % 2 === 0 ? "rgba(255,255,255,.03)" : "transparent",
                borderRight: i < 3 ? "1px solid rgba(255,255,255,.06)" : "none",
              }}>
                <i className={`bi ${s.icon}`} style={{ fontSize: 24, color, display: "block", marginBottom: 12 }} />
                <div style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginTop: 8, lineHeight: 1.4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Valores / pilares */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {[
              {
                icon: "bi-person-heart",
                title: "Centrado en el paciente",
                desc: "Cada funcionalidad está pensada para mejorar la experiencia del médico y del paciente.",
              },
              {
                icon: "bi-lock-fill",
                title: "Seguridad y privacidad",
                desc: "Datos cifrados, acceso por roles y auditoría de sesiones para proteger la información médica.",
              },
              {
                icon: "bi-lightning-charge-fill",
                title: "Fácil de usar",
                desc: "Interfaz intuitiva que no requiere capacitación extensa. Comienza a usarlo desde el primer día.",
              },
              {
                icon: "bi-headset",
                title: "Soporte dedicado",
                desc: "Acompañamiento en la configuración y soporte por WhatsApp para resolver cualquier duda.",
              },
            ].map((v, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 16, padding: "28px 24px",
                transition: "background .2s, border-color .2s",
                animation: `fadeUp .5s ${i * 0.08}s ease both`,
              }}
              onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,.08)"; e.currentTarget.style.borderColor = `${color}44`; }}
              onMouseOut={e  => { e.currentTarget.style.background = "rgba(255,255,255,.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.08)"; }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 12, marginBottom: 18,
                  background: `${color}20`, border: `1px solid ${color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`bi ${v.icon}`} style={{ fontSize: 20, color }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 10 }}>{v.title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", lineHeight: 1.7 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACTO ── */}
      <section id="contacto" style={{ background: "#f8fafc", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Encabezado */}
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: `${color}15`, border: `1px solid ${color}30`,
              borderRadius: 100, padding: "6px 18px", marginBottom: 16,
            }}>
              <i className="bi bi-envelope-heart-fill" style={{ color, fontSize: 13 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "1.5px" }}>Contacto</span>
            </div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>
              Estamos aquí para ayudarte
            </h2>
            <p style={{ fontSize: 16, color: "#64748b", maxWidth: 520, margin: "0 auto" }}>
              Escríbenos por WhatsApp o redes sociales. Te respondemos rápido y te ayudamos a configurar tu clínica.
            </p>
          </div>

          {/* Tarjetas de contacto principal */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginBottom: 40 }}>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}?text=Hola, quiero información sobre ${nombre}`}
                target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: "none" }}
              >
                <div style={{
                  background: "#fff", borderRadius: 20, padding: "28px 24px",
                  border: "1px solid #dcfce7", boxShadow: "0 4px 24px rgba(37,211,102,.1)",
                  display: "flex", alignItems: "center", gap: 18,
                  transition: "transform .2s, box-shadow .2s",
                }}
                onMouseOver={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(37,211,102,.18)"; }}
                onMouseOut={e  => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 24px rgba(37,211,102,.1)"; }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className="bi bi-whatsapp" style={{ fontSize: 26, color: "#fff" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>WhatsApp</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>Respuesta rápida</div>
                    <div style={{ fontSize: 13, color: "#25d366", fontWeight: 600, marginTop: 2 }}>{cfg.landing_whatsapp || "Contáctanos"}</div>
                  </div>
                  <i className="bi bi-arrow-right" style={{ marginLeft: "auto", color: "#25d366", fontSize: 18 }} />
                </div>
              </a>
            )}

            {cfg.landing_email_contacto && (
              <a href={`mailto:${cfg.landing_email_contacto}`} style={{ textDecoration: "none" }}>
                <div style={{
                  background: "#fff", borderRadius: 20, padding: "28px 24px",
                  border: "1px solid #fee2e2", boxShadow: "0 4px 24px rgba(239,68,68,.08)",
                  display: "flex", alignItems: "center", gap: 18,
                  transition: "transform .2s, box-shadow .2s",
                }}
                onMouseOver={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(239,68,68,.14)"; }}
                onMouseOut={e  => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 24px rgba(239,68,68,.08)"; }}
                >
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className="bi bi-envelope-fill" style={{ fontSize: 24, color: "#fff" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>Correo</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>Escríbenos por email</div>
                    <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, marginTop: 2 }}>{cfg.landing_email_contacto}</div>
                  </div>
                  <i className="bi bi-arrow-right" style={{ marginLeft: "auto", color: "#ef4444", fontSize: 18 }} />
                </div>
              </a>
            )}
          </div>

          {/* Redes sociales */}
          {(cfg.landing_instagram || cfg.landing_facebook || cfg.landing_tiktok) && (
            <div style={{
              background: "#fff", borderRadius: 24, padding: "32px 36px",
              border: "1px solid #e2e8f0", boxShadow: "0 2px 16px rgba(0,0,0,.05)",
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 20 }}>
                Síguenos en redes
              </p>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {cfg.landing_instagram && (
                  <a
                    href={cfg.landing_instagram.startsWith("http") ? cfg.landing_instagram : `https://instagram.com/${cfg.landing_instagram.replace("@","")}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 10,
                      background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
                      color: "#fff", borderRadius: 14, padding: "12px 20px",
                      fontWeight: 700, fontSize: 14, transition: "transform .18s, box-shadow .18s",
                      boxShadow: "0 4px 16px rgba(220,39,67,.25)",
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(220,39,67,.35)"; }}
                    onMouseOut={e  => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 16px rgba(220,39,67,.25)"; }}
                    >
                      <i className="bi bi-instagram" style={{ fontSize: 18 }} />
                      Instagram
                    </div>
                  </a>
                )}
                {cfg.landing_facebook && (
                  <a
                    href={cfg.landing_facebook.startsWith("http") ? cfg.landing_facebook : `https://facebook.com/${cfg.landing_facebook}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 10,
                      background: "#1877f2", color: "#fff", borderRadius: 14, padding: "12px 20px",
                      fontWeight: 700, fontSize: 14, transition: "transform .18s, box-shadow .18s",
                      boxShadow: "0 4px 16px rgba(24,119,242,.3)",
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(24,119,242,.4)"; }}
                    onMouseOut={e  => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 16px rgba(24,119,242,.3)"; }}
                    >
                      <i className="bi bi-facebook" style={{ fontSize: 18 }} />
                      Facebook
                    </div>
                  </a>
                )}
                {cfg.landing_tiktok && (
                  <a
                    href={cfg.landing_tiktok.startsWith("http") ? cfg.landing_tiktok : `https://tiktok.com/@${cfg.landing_tiktok.replace("@","")}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 10,
                      background: "#010101", color: "#fff", borderRadius: 14, padding: "12px 20px",
                      fontWeight: 700, fontSize: 14, transition: "transform .18s, box-shadow .18s",
                      boxShadow: "0 4px 16px rgba(0,0,0,.2)",
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.3)"; }}
                    onMouseOut={e  => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.2)"; }}
                    >
                      <i className="bi bi-tiktok" style={{ fontSize: 18 }} />
                      TikTok
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* CTA final */}
          <div style={{
            marginTop: 40, borderRadius: 24,
            background: `linear-gradient(135deg, ${color} 0%, ${darken(color, 28)} 100%)`,
            padding: "40px 36px", display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 20,
          }}>
            <div>
              <h3 style={{ color: "#fff", fontWeight: 900, fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)", margin: "0 0 8px" }}>
                ¿Listo para digitalizar tu clínica?
              </h3>
              <p style={{ color: "rgba(255,255,255,.75)", margin: 0, fontSize: 15 }}>
                Empieza hoy. Sin complicaciones, sin papeleo.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}?text=Hola, quiero comenzar con ${nombre}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "#25d366", color: "#fff", textDecoration: "none",
                    padding: "13px 24px", borderRadius: 12, fontWeight: 700, fontSize: 14,
                    boxShadow: "0 4px 16px rgba(0,0,0,.2)", transition: "transform .18s",
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseOut={e  => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <i className="bi bi-whatsapp" style={{ fontSize: 17 }} />Comenzar ahora
                </a>
              )}
              <button
                onClick={() => navigate("/login")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(255,255,255,.15)", border: "2px solid rgba(255,255,255,.4)",
                  color: "#fff", padding: "13px 24px", borderRadius: 12,
                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                  transition: "background .18s",
                }}
                onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,.25)"}
                onMouseOut={e  => e.currentTarget.style.background = "rgba(255,255,255,.15)"}
              >
                <i className="bi bi-box-arrow-in-right" style={{ fontSize: 16 }} />Iniciar sesión
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOTÓN FLOTANTE WHATSAPP ── */}
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}?text=Hola, quiero información sobre ${nombre}`}
          target="_blank"
          rel="noopener noreferrer"
          className="wa-float-btn"
          title="Escríbenos por WhatsApp"
        >
          <i className="bi bi-whatsapp" />
          <span className="wa-float-label">¡Escríbenos!</span>
        </a>
      )}

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0f172a", padding: "28px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
          <img src={logoUrl} alt="logo" style={{ height: 24, objectFit: "contain", opacity: .8 }} />
          <span style={{ color: "#475569", fontWeight: 700, fontSize: 15 }}>{nombre}</span>
        </div>
        <p style={{ color: "#334155", fontSize: 13, margin: 0 }}>
          {cfg.copyright_texto || `© ${new Date().getFullYear()} ${nombre} · Todos los derechos reservados`}
        </p>
      </footer>
    </>
  );
}

function tryParse(str) {
  try { return JSON.parse(str || "[]"); } catch { return []; }
}

function darken(hex, pct) {
  const num = parseInt(hex.replace("#",""), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * pct));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(2.55 * pct));
  const b = Math.max(0, (num & 0xff) - Math.round(2.55 * pct));
  return `#${((r<<16)|(g<<8)|b).toString(16).padStart(6,"0")}`;
}
