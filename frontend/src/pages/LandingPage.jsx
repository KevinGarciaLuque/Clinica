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

export default function LandingPage() {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/config-sistema`)
      .then(r => r.json())
      .then(d => setCfg(d.config || {}))
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
  const logoUrl  = cfg.logo_url ? (cfg.logo_url.startsWith("http") ? cfg.logo_url : `${API_URL}${cfg.logo_url}`) : null;

  const parsePlanes = () => [
    {
      id: "trial",
      label: "Trial",
      badge: null,
      precio: cfg.landing_plan_trial_precio || "Gratis",
      duracion: cfg.landing_plan_trial_duracion || "30 días",
      features: tryParse(cfg.landing_plan_trial_features),
      icon: "bi-clock-history",
      color: "#f59e0b",
      highlight: false,
    },
    {
      id: "semestral",
      label: "Semestral",
      badge: "Popular",
      precio: cfg.landing_plan_semestral_precio || "Consultar",
      duracion: "6 meses",
      features: tryParse(cfg.landing_plan_semestral_features),
      icon: "bi-calendar2-check",
      color,
      highlight: true,
    },
    {
      id: "anual",
      label: "Anual",
      badge: "Mejor valor",
      precio: cfg.landing_plan_anual_precio || "Consultar",
      duracion: "12 meses",
      features: tryParse(cfg.landing_plan_anual_features),
      icon: "bi-award-fill",
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
          {logoUrl
            ? <img src={logoUrl} alt="logo" style={{ height: 32, objectFit: "contain" }} />
            : <i className="bi bi-hospital-fill" style={{ color: "#fff", fontSize: 22 }} />}
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: "-.3px" }}>{nombre}</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div className="d-none d-md-flex" style={{ gap: 4 }}>
            <button className="nav-link-lp" onClick={() => scrollTo("caracteristicas")}>Características</button>
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
          {["Características|caracteristicas","Planes|planes","Nosotros|nosotros","Contacto|contacto"].map(item => {
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
          {logoUrl && (
            <div style={{ marginBottom: 20 }}>
              <img src={logoUrl} alt="logo" style={{ height: 60, objectFit: "contain", filter: "drop-shadow(0 4px 16px rgba(0,0,0,.3))" }} />
            </div>
          )}
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
            <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "1px" }}>
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

      {/* ── PLANES ── */}
      <section id="planes" style={{ background: "#fff", padding: "80px 24px" }}>
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
                  {plan.label}
                </div>
                <div style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
                  {plan.precio}
                </div>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 22, marginTop: 4 }}>
                  {plan.duracion}
                </div>
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
      {cfg.landing_nosotros_texto && (
        <section id="nosotros" style={{ background: "#f8fafc", padding: "80px 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "1px" }}>
              Sobre nosotros
            </span>
            <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, color: "#0f172a", margin: "12px 0 24px" }}>
              ¿Quiénes somos?
            </h2>
            <p style={{ fontSize: 17, color: "#475569", lineHeight: 1.8 }}>
              {cfg.landing_nosotros_texto}
            </p>
          </div>
        </section>
      )}

      {/* ── CONTACTO ── */}
      <section id="contacto" style={{ background: `linear-gradient(135deg, ${color} 0%, ${darken(color, 30)} 100%)`, padding: "80px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, color: "#fff", marginBottom: 14 }}>
            ¿Listo para empezar?
          </h2>
          <p style={{ color: "rgba(255,255,255,.78)", fontSize: 16, marginBottom: 36 }}>
            Contáctanos y te ayudaremos a configurar tu clínica en minutos.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  background: "#25d366", color: "#fff", textDecoration: "none",
                  padding: "14px 28px", borderRadius: 14, fontWeight: 700, fontSize: 15,
                  boxShadow: "0 6px 20px rgba(0,0,0,.2)", transition: "transform .18s",
                }}
                onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseOut={e  => e.currentTarget.style.transform = "translateY(0)"}
              >
                <i className="bi bi-whatsapp" style={{ fontSize: 20 }} />WhatsApp
              </a>
            )}
            {cfg.landing_email_contacto && (
              <a
                href={`mailto:${cfg.landing_email_contacto}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  background: "rgba(255,255,255,.15)", border: "2px solid rgba(255,255,255,.4)",
                  color: "#fff", textDecoration: "none",
                  padding: "14px 28px", borderRadius: 14, fontWeight: 700, fontSize: 15,
                  transition: "background .18s",
                }}
                onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,.25)"}
                onMouseOut={e  => e.currentTarget.style.background = "rgba(255,255,255,.15)"}
              >
                <i className="bi bi-envelope-fill" style={{ fontSize: 18 }} />{cfg.landing_email_contacto}
              </a>
            )}
          </div>

          {/* Redes sociales */}
          {(cfg.landing_instagram || cfg.landing_facebook || cfg.landing_tiktok) && (
            <div style={{ marginTop: 40, display: "flex", gap: 16, justifyContent: "center" }}>
              {cfg.landing_instagram && (
                <a href={cfg.landing_instagram.startsWith("http") ? cfg.landing_instagram : `https://instagram.com/${cfg.landing_instagram.replace("@","")}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, textDecoration: "none", transition: "background .15s" }}
                  onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,.28)"}
                  onMouseOut={e  => e.currentTarget.style.background = "rgba(255,255,255,.15)"}
                >
                  <i className="bi bi-instagram" />
                </a>
              )}
              {cfg.landing_facebook && (
                <a href={cfg.landing_facebook.startsWith("http") ? cfg.landing_facebook : `https://facebook.com/${cfg.landing_facebook}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, textDecoration: "none", transition: "background .15s" }}
                  onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,.28)"}
                  onMouseOut={e  => e.currentTarget.style.background = "rgba(255,255,255,.15)"}
                >
                  <i className="bi bi-facebook" />
                </a>
              )}
              {cfg.landing_tiktok && (
                <a href={cfg.landing_tiktok.startsWith("http") ? cfg.landing_tiktok : `https://tiktok.com/@${cfg.landing_tiktok.replace("@","")}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, textDecoration: "none", transition: "background .15s" }}
                  onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,.28)"}
                  onMouseOut={e  => e.currentTarget.style.background = "rgba(255,255,255,.15)"}
                >
                  <i className="bi bi-tiktok" />
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0f172a", padding: "28px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
          {logoUrl
            ? <img src={logoUrl} alt="logo" style={{ height: 24, objectFit: "contain", opacity: .8 }} />
            : <i className="bi bi-hospital-fill" style={{ color: "#475569", fontSize: 18 }} />}
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
