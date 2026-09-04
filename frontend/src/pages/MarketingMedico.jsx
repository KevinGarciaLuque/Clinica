import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : "14,31,60";
}
function darken(hex, pct) {
  const num = parseInt((hex || "#0E1F3C").replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * pct));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(2.55 * pct));
  const b = Math.max(0, (num & 0xff) - Math.round(2.55 * pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
function mediaUrl(u) {
  if (!u) return "";
  return u.startsWith("http") || u.startsWith("data:") ? u : `${API_URL}${u}`;
}
function videoInfo(url) {
  if (!url) return null;
  let m;
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)))
    return { embed: `https://www.youtube.com/embed/${m[1]}?rel=0&autoplay=1`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)))
    return { embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, thumb: null };
  return { embed: url, thumb: null };
}

export default function MarketingMedico() {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState(null);
  const [data, setData] = useState({ posts: [], videos: [], planes: [] });
  const [videoActivo, setVideoActivo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/config-sistema`).then(r => r.json()).then(d => setCfg(d.data || {})).catch(() => setCfg({}));
    fetch(`${API_URL}/api/marketing-medico`).then(r => r.json()).then(d => setData(d.data || { posts: [], videos: [], planes: [] })).catch(() => {});
  }, []);

  if (!cfg) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0f172a" }}>
      <div style={{ width: 40, height: 40, border: "4px solid rgba(255,255,255,.15)", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const color    = cfg.landing_color_primario || cfg.color_primario || "#0E1F3C";
  const colorRgb = hexToRgb(color);
  const nombre   = cfg.nombre_sistema || "Medic-KG";
  const logoUrl  = cfg.logo_url ? mediaUrl(cfg.logo_url) : "/logo.png";
  const whatsapp = (cfg.marketing_whatsapp || cfg.landing_whatsapp || "").replace(/\D/g, "");

  const waLink = (texto) =>
    whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}` : "#";

  const { posts, videos, planes } = data;
  const hayContenido = posts.length || videos.length || planes.length;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #fff; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .mm-nav-link { background: none; border: none; color: rgba(255,255,255,.82); font-size: 14px; font-weight: 500; cursor: pointer; padding: 6px 12px; border-radius: 8px; transition: color .15s, background .15s; }
        .mm-nav-link:hover { color: #fff; background: rgba(255,255,255,.1); }
        .mm-btn { display: inline-flex; align-items: center; gap: 8px; background: ${color}; color: #fff; border: none; padding: 14px 30px; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; transition: transform .18s, box-shadow .18s; box-shadow: 0 8px 26px rgba(${colorRgb},.4); }
        .mm-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 34px rgba(${colorRgb},.5); }
        .mm-btn-ghost { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,.12); color: #fff; border: 1px solid rgba(255,255,255,.4); padding: 13px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; transition: background .18s; }
        .mm-btn-ghost:hover { background: rgba(255,255,255,.22); }
        .mm-card { transition: transform .2s, box-shadow .2s; }
        .mm-card:hover { transform: translateY(-5px); }
        .mm-post:hover { box-shadow: 0 20px 44px rgba(15,23,42,.16) !important; }
        .mm-video:hover .mm-play { transform: scale(1.12); }
        @media (max-width: 720px) {
          .mm-grid { grid-template-columns: 1fr !important; }
          .mm-hero h1 { font-size: 2rem !important; }
        }
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: `linear-gradient(90deg, ${color} 0%, ${darken(color, 25)} 100%)`,
        boxShadow: "0 2px 20px rgba(0,0,0,.25)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 60,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
          <img src={logoUrl} alt="logo" style={{ height: 54, objectFit: "contain" }} />
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: "-.3px" }}>{nombre}</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div className="d-none d-md-flex" style={{ gap: 4 }}>
            <button className="mm-nav-link" onClick={() => navigate("/")}>Inicio</button>
            <button className="mm-nav-link" onClick={() => navigate("/agenda-tu-consulta")}>Agenda tu consulta médica</button>
            <button className="mm-nav-link" onClick={() => navigate("/#planes")}>Planes del sistema</button>
          </div>
          <button onClick={() => navigate("/login")} style={{
            marginLeft: 12, background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.35)",
            color: "#fff", borderRadius: 10, padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            <i className="bi bi-box-arrow-in-right me-1" />Iniciar sesión
          </button>
          <button className="d-md-none" onClick={() => setMenuOpen(v => !v)} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", marginLeft: 8 }}>
            <i className={`bi ${menuOpen ? "bi-x-lg" : "bi-list"}`} />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div style={{ position: "fixed", top: 60, left: 0, right: 0, zIndex: 999, background: darken(color, 20), padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
          <button className="mm-nav-link" style={{ textAlign: "left", padding: "10px 16px" }} onClick={() => { setMenuOpen(false); navigate("/"); }}>Inicio</button>
          <button className="mm-nav-link" style={{ textAlign: "left", padding: "10px 16px" }} onClick={() => { setMenuOpen(false); navigate("/agenda-tu-consulta"); }}>Agenda tu consulta médica</button>
        </div>
      )}

      {/* HERO */}
      <section className="mm-hero" style={{
        background: `linear-gradient(135deg, ${color} 0%, ${darken(color, 30)} 100%)`,
        color: "#fff", padding: "140px 24px 96px", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -120, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />
        <div style={{ maxWidth: 780, margin: "0 auto", position: "relative" }}>
          <span style={{ display: "inline-block", padding: "7px 18px", borderRadius: 999, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.25)", fontSize: 13, fontWeight: 700, letterSpacing: ".5px", marginBottom: 22 }}>
            <i className="bi bi-megaphone-fill me-2" />{cfg.marketing_home_badge || "Marketing Médico"}
          </span>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 800, lineHeight: 1.15, marginBottom: 18 }}>
            {cfg.marketing_hero_titulo || "Marketing Médico"}
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,.82)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto 32px" }}>
            {cfg.marketing_hero_texto}
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a className="mm-btn" href={waLink(`Hola, me interesa el servicio de Marketing Médico.`)} target="_blank" rel="noreferrer" style={{ background: "#25d366", boxShadow: "0 8px 26px rgba(37,211,102,.45)" }}>
              <i className="bi bi-whatsapp" /> Hablar con un asesor
            </a>
            {planes.length > 0 && (
              <button className="mm-btn-ghost" onClick={() => document.getElementById("mm-planes")?.scrollIntoView({ behavior: "smooth" })}>
                Ver planes <i className="bi bi-arrow-down" />
              </button>
            )}
          </div>
        </div>
      </section>

      {!hayContenido && (
        <section style={{ padding: "90px 24px", textAlign: "center", color: "#64748b" }}>
          <i className="bi bi-megaphone" style={{ fontSize: 46, opacity: .3, display: "block", marginBottom: 14 }} />
          <p style={{ fontSize: 16 }}>Pronto publicaremos ejemplos, videos y planes de marketing médico.</p>
        </section>
      )}

      {/* POSTS / EJEMPLOS */}
      {posts.length > 0 && (
        <section style={{ background: "#f8fafc", padding: "84px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <Encabezado color={color} kicker="Portafolio" titulo="Ejemplos de contenido"
              texto="Publicaciones y piezas gráficas creadas para consultorios y clínicas reales." />
            <div className="mm-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 22 }}>
              {posts.map((p, i) => {
                const inner = (
                  <>
                    {p.media_url && (
                      <div style={{ aspectRatio: "4/3", overflow: "hidden", background: "#e2e8f0" }}>
                        <img src={mediaUrl(p.media_url)} alt={p.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                    <div style={{ padding: "18px 20px" }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>{p.titulo}</div>
                      {p.descripcion && <div style={{ fontSize: 13.5, color: "#64748b", lineHeight: 1.6 }}>{p.descripcion}</div>}
                      {p.enlace_url && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color }}>Ver caso <i className="bi bi-arrow-up-right" /></div>}
                    </div>
                  </>
                );
                const cardStyle = {
                  background: "#fff", borderRadius: 18, overflow: "hidden",
                  border: "1px solid #e8eef5", boxShadow: "0 6px 22px rgba(15,23,42,.06)",
                  animation: `fadeUp .5s ${i * 0.06}s ease both`, textDecoration: "none",
                  display: "block", color: "inherit",
                };
                return p.enlace_url
                  ? <a key={p.id} className="mm-card mm-post" href={p.enlace_url} target="_blank" rel="noreferrer" style={cardStyle}>{inner}</a>
                  : <div key={p.id} className="mm-card mm-post" style={cardStyle}>{inner}</div>;
              })}
            </div>
          </div>
        </section>
      )}

      {/* VIDEOS */}
      {videos.length > 0 && (
        <section style={{ background: "#fff", padding: "84px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <Encabezado color={color} kicker="Video" titulo="Videos de doctores"
              texto="Testimonios y piezas audiovisuales que transmiten cercanía y profesionalismo." />
            <div className="mm-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 22 }}>
              {videos.map((v, i) => {
                const info = videoInfo(v.media_url);
                return (
                  <div key={v.id} className="mm-card mm-video" onClick={() => info && setVideoActivo(info.embed)}
                    style={{
                      borderRadius: 18, overflow: "hidden", cursor: "pointer",
                      border: "1px solid #e8eef5", boxShadow: "0 6px 22px rgba(15,23,42,.06)",
                      animation: `fadeUp .5s ${i * 0.06}s ease both`,
                    }}>
                    <div style={{ position: "relative", aspectRatio: "16/9", background: `linear-gradient(135deg, ${color}, ${darken(color, 30)})` }}>
                      {info?.thumb && <img src={info.thumb} alt={v.titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      <div className="mm-play" style={{
                        position: "absolute", inset: 0, margin: "auto", width: 62, height: 62, borderRadius: "50%",
                        background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "transform .2s", boxShadow: "0 8px 24px rgba(0,0,0,.3)",
                      }}>
                        <i className="bi bi-play-fill" style={{ fontSize: 30, color, marginLeft: 3 }} />
                      </div>
                    </div>
                    <div style={{ padding: "16px 18px", background: "#fff" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{v.titulo}</div>
                      {v.descripcion && <div style={{ fontSize: 13, color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>{v.descripcion}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* PLANES */}
      {planes.length > 0 && (
        <section id="mm-planes" style={{ background: "#0f172a", padding: "90px 24px" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 50 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#7dd3fc", textTransform: "uppercase", letterSpacing: "1px" }}>Planes</span>
              <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.3rem)", fontWeight: 800, color: "#fff", marginTop: 8 }}>Planes de marketing médico</h2>
              <p style={{ fontSize: 15.5, color: "rgba(255,255,255,.6)", marginTop: 12, maxWidth: 540, margin: "12px auto 0" }}>
                Elige el nivel de acompañamiento que necesita tu consulta.
              </p>
            </div>
            <div className="mm-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, alignItems: "start" }}>
              {planes.map((pl, i) => (
                <div key={pl.id} style={{
                  background: pl.destacado ? `linear-gradient(180deg, ${color}, ${darken(color, 22)})` : "#1e293b",
                  border: pl.destacado ? "1px solid rgba(255,255,255,.25)" : "1px solid rgba(255,255,255,.08)",
                  borderRadius: 20, padding: "30px 26px", position: "relative",
                  boxShadow: pl.destacado ? "0 24px 54px rgba(0,0,0,.4)" : "0 10px 30px rgba(0,0,0,.25)",
                  animation: `fadeUp .5s ${i * 0.07}s ease both`,
                }}>
                  {pl.destacado && (
                    <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#fbbf24", color: "#0f172a", fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 999, letterSpacing: ".5px" }}>
                      RECOMENDADO
                    </span>
                  )}
                  <div style={{ fontWeight: 800, fontSize: 19, color: "#fff", marginBottom: 6 }}>{pl.titulo}</div>
                  {pl.descripcion && <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginBottom: 14, lineHeight: 1.55 }}>{pl.descripcion}</div>}
                  {pl.precio && <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 18 }}>{pl.precio}</div>}
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9, marginBottom: 24 }}>
                    {(pl.features || []).map((f, j) => (
                      <li key={j} style={{ display: "flex", gap: 9, fontSize: 13.5, color: "rgba(255,255,255,.9)", lineHeight: 1.5 }}>
                        <i className="bi bi-check-circle-fill" style={{ color: "#4ade80", flexShrink: 0, marginTop: 2 }} /> {f}
                      </li>
                    ))}
                  </ul>
                  <a className="mm-btn" href={waLink(`Hola, me interesa el plan de marketing médico "${pl.titulo}"${pl.precio ? ` (${pl.precio})` : ""}.`)}
                    target="_blank" rel="noreferrer"
                    style={{ width: "100%", justifyContent: "center", background: pl.destacado ? "#fff" : color, color: pl.destacado ? color : "#fff", boxShadow: "none" }}>
                    <i className="bi bi-whatsapp" /> Me interesa
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA final */}
      <section style={{ background: `linear-gradient(135deg, ${color}, ${darken(color, 28)})`, color: "#fff", padding: "72px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)", fontWeight: 800, marginBottom: 12 }}>¿Listo para dar el siguiente paso?</h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,.8)", marginBottom: 28, maxWidth: 520, margin: "0 auto 28px" }}>
          Cuéntanos sobre tu consulta y te armamos una propuesta a medida.
        </p>
        <a className="mm-btn" href={waLink("Hola, quiero información sobre Marketing Médico.")} target="_blank" rel="noreferrer"
          style={{ background: "#25d366", boxShadow: "0 8px 26px rgba(37,211,102,.45)" }}>
          <i className="bi bi-whatsapp" /> Escríbenos por WhatsApp
        </a>
      </section>

      <footer style={{ background: "#0f172a", padding: "26px 24px", textAlign: "center", color: "rgba(255,255,255,.5)", fontSize: 13 }}>
        {cfg.copyright_texto || `${nombre} · Todos los derechos reservados`}
      </footer>

      {/* MODAL DE VIDEO */}
      {videoActivo && (
        <div onClick={() => setVideoActivo(null)} style={{
          position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,.85)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "min(900px, 100%)", position: "relative" }}>
            <button onClick={() => setVideoActivo(null)} style={{
              position: "absolute", top: -44, right: 0, background: "none", border: "none",
              color: "#fff", fontSize: 26, cursor: "pointer",
            }}>
              <i className="bi bi-x-lg" />
            </button>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 14, overflow: "hidden", background: "#000" }}>
              <iframe src={videoActivo} title="Video" allow="autoplay; encrypted-media; fullscreen" allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Encabezado({ color, kicker, titulo, texto }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 44 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "1px" }}>{kicker}</span>
      <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", fontWeight: 800, color: "#0f172a", marginTop: 8 }}>{titulo}</h2>
      {texto && <p style={{ fontSize: 15.5, color: "#64748b", marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>{texto}</p>}
    </div>
  );
}
