import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import AgendarModal from "./AgendarModal";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const DEFAULT_COLOR = "#213665";

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function darken(hex, amount = 20) {
  let r = parseInt(hex.slice(1, 3), 16) - amount;
  let g = parseInt(hex.slice(3, 5), 16) - amount;
  let b = parseInt(hex.slice(5, 7), 16) - amount;
  r = Math.max(0, r).toString(16).padStart(2, "0");
  g = Math.max(0, g).toString(16).padStart(2, "0");
  b = Math.max(0, b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

export default function PublicClinicaPage() {
  const { slug } = useParams();
  const [clinica, setClinica] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [fotoError, setFotoError] = useState(false);
  const [showAgendar, setShowAgendar] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [resCli, resSrv] = await Promise.all([
          axios.get(`${API}/api/public/clinica/${slug}`),
          axios.get(`${API}/api/public/clinica/${slug}/servicios`),
        ]);
        setClinica(resCli.data.data);
        setServicios(resSrv.data.data || []);
      } catch (e) {
        setError(e.response?.status === 404 ? "Página no encontrada" : "Error al cargar la página");
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [slug]);

  if (cargando) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f1f5f9" }}>
        <div style={{
          width: 44, height: 44,
          border: `4px solid #e2e8f0`,
          borderTop: `4px solid ${DEFAULT_COLOR}`,
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !clinica) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f1f5f9", flexDirection: "column", gap: 16 }}>
        <i className="bi bi-hospital" style={{ fontSize: 56, color: "#94a3b8" }} />
        <p style={{ color: "#64748b", fontSize: 17, fontWeight: 500 }}>{error || "Página no encontrada"}</p>
      </div>
    );
  }

  const { perfil = {} } = clinica;
  const color     = (perfil.perfil_color_primario || DEFAULT_COLOR).trim();
  const colorDark = darken(color, 30);
  const colorRgb  = hexToRgb(color);

  const resolveUrl = (url) => {
    if (!url) return null;
    return url.startsWith("http") ? url : `${API}${url}`;
  };

  const fotoDr = fotoError ? null : resolveUrl(perfil.perfil_foto_doctor);
  const logo   = resolveUrl(clinica.logo_url);

  const descripcionLineas = (perfil.perfil_descripcion || "")
    .split("\n")
    .map(l => l.trim().replace(/^[-•]\s*/, ""))
    .filter(Boolean);

  const redes = [
    { key: "perfil_instagram", icon: "bi-instagram",  label: "Instagram",  href: v => v.startsWith("http") ? v : `https://instagram.com/${v.replace("@","")}` },
    { key: "perfil_tiktok",    icon: "bi-tiktok",     label: "TikTok",     href: v => v.startsWith("http") ? v : `https://tiktok.com/@${v.replace("@","")}` },
    { key: "perfil_facebook",  icon: "bi-facebook",   label: "Facebook",   href: v => v.startsWith("http") ? v : `https://facebook.com/${v}` },
    { key: "perfil_whatsapp",  icon: "bi-whatsapp",   label: "WhatsApp",   href: v => `https://wa.me/${v.replace(/\D/g,"")}` },
  ].filter(r => perfil[r.key]);

  const currentYear = new Date().getFullYear();

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pub-btn-agendar { position: relative; overflow: hidden; }
        .pub-btn-agendar::after { content:""; position:absolute; inset:0; background:rgba(255,255,255,0); transition: background .2s; }
        .pub-btn-agendar:hover::after { background:rgba(255,255,255,.12); }
        .pub-btn-agendar:hover { transform: translateY(-3px); box-shadow: 0 14px 36px rgba(${colorRgb},.5) !important; }
        .pub-btn-agendar:active { transform: translateY(0px); box-shadow: 0 4px 16px rgba(${colorRgb},.3) !important; }
        .pub-btn-accion:hover  { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(${colorRgb},.18) !important; }
        .pub-servicio:hover    { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,.1) !important; }
        .pub-red:hover         { transform: scale(1.12); }
        body { margin: 0; }
        @media (max-width: 360px) {
          .pub-desc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column" }}>

        {/* ── HERO ── */}
        <div style={{
          background: `linear-gradient(160deg, ${color} 0%, ${colorDark} 100%)`,
          padding: "52px 24px 80px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Círculos decorativos de fondo */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,.04)" }} />
          <div style={{ position: "absolute", bottom: -40, left: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />

          <div style={{ maxWidth: 440, margin: "0 auto", position: "relative", animation: "fadeUp .5s ease both" }}>
            {/* Logo pequeño */}
            {logo && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                <img src={logo} alt="logo" style={{ height: 36, objectFit: "contain", opacity: .85 }} />
              </div>
            )}

            {/* Avatar */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              <div style={{
                width: 110, height: 110, borderRadius: "50%",
                border: "4px solid rgba(255,255,255,.35)",
                boxShadow: "0 8px 32px rgba(0,0,0,.25)",
                overflow: "hidden",
                background: "rgba(255,255,255,.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {fotoDr ? (
                  <img
                    src={fotoDr}
                    alt="doctor"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={() => setFotoError(true)}
                  />
                ) : (
                  <i className="bi bi-person-fill" style={{ fontSize: 52, color: "rgba(255,255,255,.6)" }} />
                )}
              </div>
            </div>

            <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-.3px" }}>
              {perfil.perfil_nombre_doctor || clinica.nombre}
            </h1>

            {perfil.perfil_titulo_doctor && (
              <p style={{ color: "rgba(255,255,255,.8)", fontSize: 14, fontWeight: 500, margin: "0 0 12px", letterSpacing: ".2px" }}>
                {perfil.perfil_titulo_doctor}
              </p>
            )}

            {descripcionLineas.length > 1 ? (
              <div className="pub-desc-grid" style={{
                display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 16px",
                maxWidth: 380, margin: "0 auto", textAlign: "left",
              }}>
                {descripcionLineas.map((linea, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, color: "rgba(255,255,255,.78)", fontSize: 13.5, lineHeight: 1.5 }}>
                    <i className="bi bi-check-circle-fill" style={{ fontSize: 12, marginTop: 3, flexShrink: 0, color: "rgba(255,255,255,.55)" }} />
                    <span>{linea}</span>
                  </div>
                ))}
              </div>
            ) : descripcionLineas.length === 1 && (
              <p style={{ color: "rgba(255,255,255,.72)", fontSize: 14, margin: 0, lineHeight: 1.65, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                {descripcionLineas[0]}
              </p>
            )}
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, maxWidth: 500, width: "100%", margin: "-32px auto 0", padding: "0 16px 40px", boxSizing: "border-box" }}>

          {/* Botón principal: Agendar Cita */}
          {perfil.perfil_agendar_activo !== "0" && (
            <button
              onClick={() => setShowAgendar(true)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: color, color: "#fff", border: "none", borderRadius: 18,
                padding: "18px 24px", width: "100%", fontSize: 16, fontWeight: 800,
                boxShadow: `0 6px 24px rgba(${colorRgb},.35)`,
                cursor: "pointer", marginBottom: 14,
                animation: "fadeUp .5s .08s ease both",
                transition: "transform .18s, box-shadow .18s",
              }}
              className="pub-btn-agendar"
            >
              <i className="bi bi-calendar2-plus" style={{ fontSize: 20 }} />
              Agendar una Cita
            </button>
          )}

          {/* Botones de acción */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28, animation: "fadeUp .5s .1s ease both" }}>
            {perfil.perfil_whatsapp && (
              <a
                href={`https://wa.me/${perfil.perfil_whatsapp.replace(/\D/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="pub-btn-accion"
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "#fff", borderRadius: 18,
                  padding: "17px 22px",
                  textDecoration: "none", color: "#1e293b",
                  boxShadow: "0 4px 16px rgba(0,0,0,.08)",
                  border: "1.5px solid rgba(37,211,102,.3)",
                  transition: "transform .18s, box-shadow .18s",
                }}
              >
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#e8fdf0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className="bi bi-whatsapp" style={{ color: "#25D366", fontSize: 20 }} />
                </div>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>Escríbenos por WhatsApp</span>
                <i className="bi bi-chevron-right" style={{ color: "#94a3b8" }} />
              </a>
            )}

            {perfil.perfil_google_maps && (
              <a
                href={perfil.perfil_google_maps}
                target="_blank" rel="noopener noreferrer"
                className="pub-btn-accion"
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "#fff", borderRadius: 18,
                  padding: "17px 22px",
                  textDecoration: "none", color: "#1e293b",
                  boxShadow: "0 4px 16px rgba(0,0,0,.08)",
                  border: "1.5px solid rgba(66,133,244,.3)",
                  transition: "transform .18s, box-shadow .18s",
                }}
              >
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className="bi bi-geo-alt-fill" style={{ color: "#4285F4", fontSize: 20 }} />
                </div>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>Encuéntranos en Google</span>
                <i className="bi bi-chevron-right" style={{ color: "#94a3b8" }} />
              </a>
            )}
          </div>

          {/* Servicios */}
          {servicios.length > 0 && (
            <div style={{ marginBottom: 24, animation: "fadeUp .5s .22s ease both" }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 10, textAlign: "center" }}>
                Servicios
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
                {servicios.map(s => (
                  <span
                    key={s.id}
                    title={s.descripcion || ""}
                    className="pub-servicio"
                    style={{
                      background: "#fff", border: `1.5px solid rgba(${colorRgb},.25)`, borderRadius: 20,
                      padding: "7px 16px", fontSize: 13, fontWeight: 700, color,
                      boxShadow: "0 2px 10px rgba(0,0,0,.05)", transition: "transform .18s, box-shadow .18s",
                    }}
                  >
                    {s.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Redes sociales */}
          {redes.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 20, animation: "fadeUp .5s .3s ease both" }}>
              {redes.map((r) => (
                <a
                  key={r.key}
                  href={r.href(perfil[r.key])}
                  target="_blank" rel="noopener noreferrer"
                  className="pub-red"
                  title={r.label}
                  style={{
                    width: 50, height: 50, borderRadius: "50%",
                    background: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 12px rgba(0,0,0,.1)",
                    textDecoration: "none",
                    transition: "transform .18s",
                    fontSize: 21,
                    color: "#334155",
                  }}
                >
                  <i className={`bi ${r.icon}`} />
                </a>
              ))}
            </div>
          )}

          {/* Info contacto */}
          {(clinica.ciudad || clinica.telefono) && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16, animation: "fadeUp .5s .35s ease both" }}>
              {clinica.ciudad && (
                <span style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                  <i className="bi bi-geo-alt" />
                  {clinica.ciudad}{clinica.pais ? `, ${clinica.pais}` : ""}
                </span>
              )}
              {clinica.telefono && (
                <span style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                  <i className="bi bi-telephone" />
                  {clinica.telefono}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── MODAL AGENDAR ── */}
        {showAgendar && (
          <AgendarModal
            slug={slug}
            color={color}
            servicios={servicios}
            onClose={() => setShowAgendar(false)}
          />
        )}

        {/* ── FOOTER ── */}
        <footer style={{
          background: "#0f172a",
          color: "rgba(255,255,255,.45)",
          textAlign: "center",
          padding: "18px 16px",
          fontSize: 12,
          letterSpacing: ".2px",
        }}>
          <div style={{ marginBottom: 3, fontWeight: 600, color: "rgba(255,255,255,.65)" }}>
            Medic-KG
          </div>
          <div>
            Desarrollado por <span style={{ color: "rgba(255,255,255,.7)", fontWeight: 600 }}>Kevin García</span>
            {" · "}© {currentYear} Todos los derechos reservados
          </div>
        </footer>

      </div>
    </>
  );
}
