import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const RED_BUTTONS = [
  { key: "landing_instagram", label: "Instagram", icon: "bi-instagram",
    bg: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
    url: v => v.startsWith("http") ? v : `https://instagram.com/${v.replace("@", "")}` },
  { key: "landing_facebook", label: "Facebook", icon: "bi-facebook",
    bg: "#1877f2",
    url: v => v.startsWith("http") ? v : `https://facebook.com/${v}` },
  { key: "landing_tiktok", label: "TikTok", icon: "bi-tiktok",
    bg: "#010101",
    url: v => v.startsWith("http") ? v : `https://tiktok.com/@${v.replace("@", "")}` },
  { key: "landing_youtube", label: "YouTube", icon: "bi-youtube",
    bg: "#ff0000",
    url: v => v.startsWith("http") ? v : `https://youtube.com/${v}` },
  { key: "landing_linkedin", label: "LinkedIn", icon: "bi-linkedin",
    bg: "#0a66c2",
    url: v => v.startsWith("http") ? v : `https://linkedin.com/${v}` },
];

export default function LinksPage() {
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    document.title = "Mi Link";
    fetch(`${API_URL}/api/config-sistema`)
      .then(r => r.json())
      .then(r => setCfg(r.data || {}))
      .catch(() => setCfg({}));
  }, []);

  if (!cfg) {
    return <div style={{ minHeight: "100vh", background: "#0E1F3C" }} />;
  }

  const nombre  = cfg.links_nombre || cfg.nombre_sistema || "Medic-KG";
  const bio     = cfg.links_bio || "";
  const foto    = cfg.links_foto_url
    ? (cfg.links_foto_url.startsWith("data:") || cfg.links_foto_url.startsWith("http")
        ? cfg.links_foto_url
        : `${API_URL}${cfg.links_foto_url}`)
    : null;
  const whatsapp = cfg.landing_whatsapp?.replace(/\D/g, "");

  const redes = RED_BUTTONS.filter(r => cfg[r.key]);

  return (
    <div className="links-page" style={{
      minHeight: "100dvh",
      background: "linear-gradient(160deg, #0E1F3C 0%, #1a2f5c 55%, #3b2a6e 100%)",
      display: "flex", justifyContent: "center",
      overflowY: "auto", boxSizing: "border-box",
      padding: "clamp(20px, 6vh, 48px) 16px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div className="links-card" style={{
        width: "100%", maxWidth: 380, margin: "auto",
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 28,
        padding: "clamp(24px, 5vw, 36px) clamp(18px, 5vw, 28px)",
        boxShadow: "0 20px 60px rgba(0,0,0,.4)",
        textAlign: "center",
        boxSizing: "border-box",
      }}>
        <div style={{
          width: "clamp(80px, 20vw, 104px)", height: "clamp(80px, 20vw, 104px)",
          borderRadius: "50%", margin: "0 auto clamp(12px, 3vw, 18px)",
          position: "relative", padding: 4,
        }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "conic-gradient(from 0deg, transparent 0%, transparent 78%, #60a5fa 92%, #fff 97%, transparent 100%)",
            animation: "linksRingSpin 2.6s linear infinite",
          }} />
          <div style={{
            position: "absolute", inset: 4, borderRadius: "50%",
            background: foto ? `url(${foto}) center/cover no-repeat` : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "3px solid rgba(14,31,60,0.9)",
            fontSize: "clamp(26px, 6vw, 34px)", fontWeight: 800, color: "#fff",
          }}>
            {!foto && nombre.charAt(0).toUpperCase()}
          </div>
        </div>
        <style>{`
          @keyframes linksRingSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @media (max-height: 700px) {
            .links-page { align-items: flex-start; }
          }
        `}</style>

        <h1 style={{ color: "#fff", fontSize: "clamp(18px, 5vw, 22px)", fontWeight: 800, margin: "0 0 6px" }}>{nombre}</h1>
        {bio && (
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "clamp(12px, 3.4vw, 14px)", margin: "0 0 clamp(18px, 4vw, 28px)", lineHeight: 1.5 }}>
            {bio}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(8px, 2vw, 12px)", marginTop: bio ? 0 : "clamp(18px, 4vw, 28px)" }}>
          {redes.map(r => (
            <a
              key={r.key}
              href={r.url(cfg[r.key])}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: r.bg, color: "#fff", textDecoration: "none",
                borderRadius: 16, padding: "clamp(11px, 3vw, 14px) 20px", fontWeight: 700, fontSize: "clamp(13px, 3.6vw, 15px)",
                transition: "transform .15s, box-shadow .15s",
                boxShadow: "0 4px 14px rgba(0,0,0,.25)",
              }}
              onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1.015)"; }}
              onMouseOut={e  => { e.currentTarget.style.transform = "translateY(0) scale(1)"; }}
            >
              <i className={`bi ${r.icon}`} style={{ fontSize: 18 }} />
              {r.label}
            </a>
          ))}

          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=Hola, quiero comenzar con ${nombre}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff", textDecoration: "none",
                borderRadius: 16, padding: "clamp(11px, 3vw, 14px) 20px", fontWeight: 800, fontSize: "clamp(13px, 3.6vw, 15px)",
                marginTop: 8,
                boxShadow: "0 6px 18px rgba(34,197,94,.35)",
                transition: "transform .15s, box-shadow .15s",
              }}
              onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1.015)"; }}
              onMouseOut={e  => { e.currentTarget.style.transform = "translateY(0) scale(1)"; }}
            >
              <i className="bi bi-whatsapp" style={{ fontSize: 18 }} />
              Comenzar ahora
            </a>
          )}
        </div>

        {redes.length === 0 && !whatsapp && (
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 10 }}>
            Aún no hay enlaces configurados.
          </p>
        )}

        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: "clamp(18px, 4vw, 30px)", marginBottom: 0 }}>
          {cfg.nombre_sistema || "Medic-KG"}
        </p>
      </div>
    </div>
  );
}
