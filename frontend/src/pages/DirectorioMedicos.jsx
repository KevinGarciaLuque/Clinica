import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

const DEFAULT_CFG = {
  directorio_color_primario: "#213665",
  directorio_color_tarjetas: "#213665",
  directorio_badge_texto:    "Directorio médico",
  directorio_titulo:         "Agenda tu consulta médica",
  directorio_subtitulo:      "Los mejores médicos y especialistas los encuentras aquí. Compara perfiles y agenda tu cita en línea, sin llamadas ni esperas.",
  directorio_badge1_texto:   "Especialistas verificados",
  directorio_badge2_texto:   "Confirmación al instante",
  directorio_badge3_texto:   "Tus datos siempre protegidos",
  directorio_cta_badge:      "Para médicos y especialistas",
  directorio_cta_titulo:     "Haz crecer tu consulta con nosotros",
  directorio_cta_texto:      "Súmate a nuestro directorio y deja que nuevos pacientes te encuentren, agenden y confirmen citas en línea, sin esfuerzo adicional para tu clínica.",
  directorio_cta_boton:      "Quiero unirme",
};

function darken(hex, pct) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * pct));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(2.55 * pct));
  const b = Math.max(0, (num & 0xff) - Math.round(2.55 * pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : "33,54,101";
}

function DoctorCard({ medico, index, onSelect, fallbackColor }) {
  const [fotoError, setFotoError] = useState(false);
  const color = (medico.color_primario || fallbackColor).trim();
  const colorRgb = hexToRgb(color);
  const foto = !fotoError && medico.foto_doctor
    ? (medico.foto_doctor.startsWith("http") ? medico.foto_doctor : `${API}${medico.foto_doctor}`)
    : null;

  return (
    <div
      className="dm-card"
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "30px 24px",
        border: "1px solid #eef1f6",
        boxShadow: "0 4px 20px rgba(15,23,42,.06)",
        textAlign: "center",
        cursor: "pointer",
        animation: `dmFadeUp .55s ${Math.min(index * 0.06, 0.6)}s ease both`,
        transition: "transform .25s ease, box-shadow .25s ease, border-color .25s ease",
        position: "relative",
        overflow: "hidden",
      }}
      onClick={() => onSelect(medico.slug)}
    >
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 64,
          background: `linear-gradient(160deg, ${color}, ${darken(color, 25)})`,
          opacity: 0.08,
        }}
      />

      <div style={{
        width: 96, height: 96, borderRadius: "50%", margin: "0 auto 18px",
        border: `3px solid rgba(${colorRgb},.25)`,
        boxShadow: `0 8px 24px rgba(${colorRgb},.18)`,
        overflow: "hidden", position: "relative",
        background: `rgba(${colorRgb},.08)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {foto ? (
          <img
            src={foto} alt={medico.nombre_doctor}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setFotoError(true)}
          />
        ) : (
          <i className="bi bi-person-fill" style={{ fontSize: 44, color }} />
        )}
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-.2px" }}>
        {medico.nombre_doctor || "Médico disponible"}
      </h3>

      {medico.titulo_doctor && (
        <p style={{ fontSize: 13, fontWeight: 600, color, margin: "0 0 10px" }}>
          {medico.titulo_doctor}
        </p>
      )}

      {medico.descripcion && (
        <p style={{
          fontSize: 12.5, color: "#64748b", lineHeight: 1.6, margin: "0 0 16px",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          whiteSpace: "pre-line", textAlign: "left",
        }}>
          {medico.descripcion}
        </p>
      )}

      {(medico.ciudad || medico.pais) && (
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <i className="bi bi-geo-alt" />
          {medico.ciudad}{medico.ciudad && medico.pais ? ", " : ""}{medico.pais}
        </div>
      )}

      <div
        className="dm-card-btn"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: color, color: "#fff", borderRadius: 12,
          padding: "10px 20px", fontWeight: 700, fontSize: 13.5,
          boxShadow: `0 6px 18px rgba(${colorRgb},.3)`,
        }}
      >
        <i className="bi bi-calendar2-plus" />
        Agendar cita
      </div>
    </div>
  );
}

export default function DirectorioMedicos() {
  const navigate = useNavigate();
  const [medicos, setMedicos] = useState(null);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [cfg, setCfg] = useState(DEFAULT_CFG);

  const COLOR = (cfg.directorio_color_primario || DEFAULT_CFG.directorio_color_primario).trim();
  const CARD_COLOR = (cfg.directorio_color_tarjetas || DEFAULT_CFG.directorio_color_tarjetas).trim();

  useEffect(() => {
    fetch(`${API}/api/public/directorio`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setError(d.msg || "No pudimos cargar el directorio."); return; }
        setMedicos(d.data || []);
      })
      .catch(() => setError("No pudimos cargar el directorio. Intenta de nuevo más tarde."));

    fetch(`${API}/api/config-sistema`)
      .then(r => r.json())
      .then(d => { if (d.ok) setCfg(c => ({ ...c, ...d.data })); })
      .catch(() => {});
  }, []);

  const filtrados = useMemo(() => {
    if (!medicos) return [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return medicos;
    return medicos.filter(m =>
      (m.nombre_doctor || "").toLowerCase().includes(q) ||
      (m.titulo_doctor || "").toLowerCase().includes(q) ||
      (m.ciudad || "").toLowerCase().includes(q)
    );
  }, [medicos, busqueda]);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
        @keyframes dmFadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dmSpin { to { transform: rotate(360deg); } }
        @keyframes dmFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-14px); }
        }
        .dm-card:hover {
          transform: translateY(-8px) scale(1.035);
          box-shadow: 0 20px 46px rgba(15,23,42,.14) !important;
          border-color: rgba(33,54,101,.18) !important;
        }
        .dm-card:hover .dm-card-btn { filter: brightness(1.08); }
        .dm-search:focus { outline: none; box-shadow: 0 0 0 4px rgba(33,54,101,.12); border-color: ${COLOR} !important; }
        .dm-back:hover { background: rgba(255,255,255,.16) !important; }
        @media (max-width: 640px) {
          .dm-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f4f6fb" }}>

        {/* HERO */}
        <section style={{
          background: `linear-gradient(150deg, ${COLOR} 0%, ${darken(COLOR, 30)} 60%, #0b1530 100%)`,
          padding: "56px 24px 110px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -100, right: -100, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,255,255,.04)", animation: "dmFloat 9s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: -80, left: -80, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,.05)", animation: "dmFloat 11s ease-in-out infinite reverse" }} />

          <button
            className="dm-back"
            onClick={() => navigate("/")}
            style={{
              position: "absolute", top: 24, left: 24,
              background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.25)",
              color: "#fff", borderRadius: 10, padding: "8px 16px",
              fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background .15s",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="bi bi-arrow-left" /> Inicio
          </button>

          <div style={{ maxWidth: 640, margin: "0 auto", position: "relative", animation: "dmFadeUp .6s ease both" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)",
              borderRadius: 100, padding: "6px 16px", marginBottom: 18,
              color: "rgba(255,255,255,.9)", fontSize: 13, fontWeight: 600,
            }}>
              <i className="bi bi-calendar2-heart" />
              {cfg.directorio_badge_texto}
            </div>
            <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 900, color: "#fff", margin: "0 0 14px", letterSpacing: "-.4px" }}>
              {cfg.directorio_titulo}
            </h1>
            <p style={{ fontSize: 15.5, color: "rgba(255,255,255,.75)", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
              {cfg.directorio_subtitulo}
            </p>

            {/* Franja de confianza */}
            <div style={{
              display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 28px",
              marginTop: 28, animation: "dmFadeUp .6s .15s ease both",
            }}>
              {[
                { icon: "bi-patch-check-fill", label: cfg.directorio_badge1_texto },
                { icon: "bi-lightning-charge-fill", label: cfg.directorio_badge2_texto },
                { icon: "bi-shield-lock-fill", label: cfg.directorio_badge3_texto },
              ].filter(item => item.label).map(item => (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  color: "rgba(255,255,255,.78)", fontSize: 12.5, fontWeight: 600,
                }}>
                  <i className={`bi ${item.icon}`} style={{ color: "rgba(255,255,255,.85)" }} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CONTENIDO */}
        <section style={{ maxWidth: 1100, margin: "-64px auto 0", padding: "0 20px 80px", position: "relative" }}>

          {/* Buscador */}
          <div style={{
            background: "#fff", borderRadius: 18, padding: "10px 18px",
            boxShadow: "0 10px 40px rgba(15,23,42,.12)", marginBottom: 40,
            display: "flex", alignItems: "center", gap: 10,
            animation: "dmFadeUp .5s .1s ease both",
          }}>
            <i className="bi bi-search" style={{ color: "#94a3b8", fontSize: 16 }} />
            <input
              className="dm-search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, especialidad o ciudad..."
              style={{ flex: 1, border: "none", padding: "10px 0", fontSize: 14.5, background: "transparent" }}
            />
          </div>

          {/* Loading */}
          {medicos === null && !error && (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <div style={{
                width: 44, height: 44, border: "4px solid #e2e8f0",
                borderTop: `4px solid ${COLOR}`, borderRadius: "50%",
                animation: "dmSpin .7s linear infinite",
              }} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
              <i className="bi bi-wifi-off" style={{ fontSize: 40, color: "#cbd5e1", display: "block", marginBottom: 12 }} />
              {error}
            </div>
          )}

          {/* Vacío */}
          {medicos && medicos.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
              <i className="bi bi-emoji-neutral" style={{ fontSize: 40, color: "#cbd5e1", display: "block", marginBottom: 12 }} />
              Por el momento no hay médicos disponibles en el directorio.
            </div>
          )}

          {/* Sin resultados de búsqueda */}
          {medicos && medicos.length > 0 && filtrados.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
              <i className="bi bi-search" style={{ fontSize: 36, color: "#cbd5e1", display: "block", marginBottom: 12 }} />
              No encontramos médicos que coincidan con "{busqueda}".
            </div>
          )}

          {/* Grid de cards */}
          {filtrados.length > 0 && (
            <div className="dm-grid" style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 22,
            }}>
              {filtrados.map((m, i) => (
                <DoctorCard key={m.slug} medico={m} index={i} fallbackColor={CARD_COLOR} onSelect={(slug) => navigate(`/p/${slug}`)} />
              ))}
            </div>
          )}

          {/* CTA para médicos */}
          <div
            className="dm-cta-medicos"
            style={{
              marginTop: 64,
              background: `linear-gradient(135deg, ${COLOR} 0%, ${darken(COLOR, 30)} 100%)`,
              borderRadius: 24,
              padding: "44px 32px",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              animation: "dmFadeUp .5s .1s ease both",
            }}
          >
            <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />
            <div style={{ position: "absolute", bottom: -70, left: -50, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.04)" }} />

            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)",
              borderRadius: 100, padding: "6px 16px", marginBottom: 16,
              color: "rgba(255,255,255,.9)", fontSize: 12.5, fontWeight: 600, position: "relative",
            }}>
              <i className="bi bi-stethoscope" />
              {cfg.directorio_cta_badge}
            </div>

            <h2 style={{ fontSize: "clamp(1.3rem, 3vw, 1.7rem)", fontWeight: 800, color: "#fff", margin: "0 0 10px", position: "relative" }}>
              {cfg.directorio_cta_titulo}
            </h2>
            <p style={{
              fontSize: 14.5, color: "rgba(255,255,255,.75)", lineHeight: 1.7,
              maxWidth: 480, margin: "0 auto 26px", position: "relative",
            }}>
              {cfg.directorio_cta_texto}
            </p>

            <button
              onClick={() => navigate("/")}
              style={{
                position: "relative",
                background: "#fff", color: COLOR, border: "none", borderRadius: 12,
                padding: "12px 26px", fontSize: 14, fontWeight: 700, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 8,
                boxShadow: "0 10px 30px rgba(0,0,0,.25)",
                transition: "transform .2s ease, box-shadow .2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {cfg.directorio_cta_boton} <i className="bi bi-arrow-right" />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
