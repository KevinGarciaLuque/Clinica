/**
 * Perfil público de un médico — /dr/:slug
 * Cada médico comparte su propio enlace y QR. Agendar abre el mismo flujo de
 * la página de la clínica, con el médico ya seleccionado.
 */
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import AgendarModal from "./AgendarModal";
import { registrarEvento } from "../utils/perfilEventos";
import OpinionesPublicas from "../components/OpinionesPublicas";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const DEFAULT_COLOR = "#213665";
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]; // dia_semana 0 = lunes

function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
function darken(hex, amount = 30) {
  const [r, g, b] = hexToRgb(hex).split(",").map(Number);
  const f = (v) => Math.max(0, Math.min(255, v - amount)).toString(16).padStart(2, "0");
  return `#${f(r)}${f(g)}${f(b)}`;
}
const resolverUrl = (url) => (!url ? null : url.startsWith("http") ? url : `${API}${url}`);

export default function PerfilMedicoPage() {
  const { slug } = useParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [showAgendar, setShowAgendar] = useState(false);
  const [fotoError, setFotoError] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/perfil-publico/medico/${slug}`)
      .then((r) => {
        const data = r.data.data;
        setD(data);
        registrarEvento({ medico_slug: slug }, "VISTA");
        axios.get(`${API}/api/public/clinica/${data.clinica.slug}/servicios`)
          .then((s) => setServicios(s.data.data || [])).catch(() => {});
      })
      .catch((e) => setError(e.response?.status === 404 ? "Perfil no encontrado" : "Error al cargar el perfil"));
  }, [slug]);

  useEffect(() => {
    if (d) document.title = `${d.nombre_mostrar} | Medic-KG`;
  }, [d]);

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f1f5f9", flexDirection: "column", gap: 16, padding: 16, textAlign: "center" }}>
        <i className="bi bi-person-x" style={{ fontSize: 56, color: "#94a3b8" }} />
        <p style={{ color: "#64748b", fontSize: 17, fontWeight: 500, margin: 0 }}>{error}</p>
        <Link to="/agenda-tu-consulta" style={{ fontSize: 14 }}>Buscar un médico</Link>
      </div>
    );
  }
  if (!d) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f1f5f9" }}>
        <span className="spinner-border" style={{ color: DEFAULT_COLOR }} />
      </div>
    );
  }

  const { perfil = {}, clinica } = d;
  const color = (perfil.perfil_color_primario || DEFAULT_COLOR).trim();
  const colorDark = darken(color, 30);
  const colorRgb = hexToRgb(color);
  const foto = fotoError ? null : resolverUrl(d.foto_url);
  const logo = resolverUrl(clinica.logo_url);
  const nombre = d.nombre_mostrar || `${d.nombres} ${d.apellidos}`;
  // Descripción del perfil de la clínica (clínicas de un solo médico): una idea por línea
  const descripcion = String(d.descripcion || "").split("\n").map((l) => l.trim().replace(/^[-•]\s*/, "")).filter(Boolean);
  const redes = [
    { key: "perfil_instagram", icon: "bi-instagram", href: (v) => (v.startsWith("http") ? v : `https://instagram.com/${v.replace("@", "")}`) },
    { key: "perfil_facebook", icon: "bi-facebook", href: (v) => (v.startsWith("http") ? v : `https://facebook.com/${v}`) },
    { key: "perfil_tiktok", icon: "bi-tiktok", href: (v) => (v.startsWith("http") ? v : `https://tiktok.com/@${v.replace("@", "")}`) },
  ].filter((r) => perfil[r.key]);
  const whatsapp = perfil.perfil_whatsapp ? perfil.perfil_whatsapp.replace(/\D/g, "") : null;
  const mensajeWa = encodeURIComponent(`Hola, quisiera información para una cita con ${nombre}.`);
  const pagina = { medico_slug: slug };

  return (
    <>
      <style>{`
        body { margin: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .pm-accion { transition: transform .18s, box-shadow .18s; }
        .pm-accion:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(${colorRgb},.18) !important; }
        .pm-agendar:hover { transform: translateY(-3px); box-shadow: 0 14px 36px rgba(${colorRgb},.5) !important; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column" }}>
        {/* Encabezado */}
        <div style={{ background: `linear-gradient(160deg, ${color} 0%, ${colorDark} 100%)`, padding: "44px 20px 76px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,.04)" }} />
          <div style={{ maxWidth: 440, margin: "0 auto", position: "relative", animation: "fadeUp .5s ease both" }}>
            {logo && <img src={logo} alt="" style={{ height: 34, objectFit: "contain", opacity: .9, marginBottom: 12 }} />}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ width: 116, height: 116, borderRadius: "50%", border: "4px solid rgba(255,255,255,.35)", boxShadow: "0 8px 32px rgba(0,0,0,.25)", overflow: "hidden", background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {foto
                  ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setFotoError(true)} />
                  : <i className="bi bi-person-fill" style={{ fontSize: 54, color: "rgba(255,255,255,.6)" }} />}
              </div>
            </div>
            <h1 style={{ color: "#fff", fontSize: 25, fontWeight: 800, margin: "0 0 6px" }}>{nombre}</h1>
            {d.especialidad && <p style={{ color: "rgba(255,255,255,.85)", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{d.especialidad}</p>}
            <p style={{ color: "rgba(255,255,255,.7)", fontSize: 13.5, margin: 0 }}>
              <i className="bi bi-hospital me-1" />{clinica.nombre}{clinica.ciudad ? ` · ${clinica.ciudad}` : ""}
            </p>
            {descripcion.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: descripcion.length > 1 ? "repeat(auto-fit, minmax(150px, 1fr))" : "1fr", gap: "6px 16px", maxWidth: 380, margin: "14px auto 0", textAlign: descripcion.length > 1 ? "left" : "center" }}>
                {descripcion.map((linea, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, color: "rgba(255,255,255,.8)", fontSize: 13.5, lineHeight: 1.5, justifyContent: descripcion.length > 1 ? "flex-start" : "center" }}>
                    {descripcion.length > 1 && <i className="bi bi-check-circle-fill" style={{ fontSize: 12, marginTop: 3, color: "rgba(255,255,255,.55)" }} />}
                    <span>{linea}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, maxWidth: 500, width: "100%", margin: "-32px auto 0", padding: "0 16px 40px", boxSizing: "border-box" }}>
          {perfil.perfil_agendar_activo !== "0" && (
            <button
              className="pm-agendar"
              onClick={() => { setShowAgendar(true); registrarEvento(pagina, "AGENDAR_CLIC"); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: color, color: "#fff", border: "none", borderRadius: 18, padding: "18px 24px", width: "100%", fontSize: 16, fontWeight: 800, boxShadow: `0 6px 24px rgba(${colorRgb},.35)`, cursor: "pointer", marginBottom: 14, transition: "transform .18s, box-shadow .18s", animation: "fadeUp .5s .08s ease both" }}>
              <i className="bi bi-calendar2-plus" style={{ fontSize: 20 }} />Agendar una cita
            </button>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22, animation: "fadeUp .5s .12s ease both" }}>
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}?text=${mensajeWa}`} target="_blank" rel="noopener noreferrer"
                onClick={() => registrarEvento(pagina, "WHATSAPP")} className="pm-accion"
                style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", borderRadius: 18, padding: "16px 20px", textDecoration: "none", color: "#1e293b", boxShadow: "0 4px 16px rgba(0,0,0,.08)", border: "1.5px solid rgba(37,211,102,.3)" }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#e8fdf0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className="bi bi-whatsapp" style={{ color: "#25D366", fontSize: 20 }} />
                </div>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>Escribir por WhatsApp</span>
                <i className="bi bi-chevron-right" style={{ color: "#94a3b8" }} />
              </a>
            )}
            {perfil.perfil_google_maps && (
              <a href={perfil.perfil_google_maps} target="_blank" rel="noopener noreferrer" className="pm-accion"
                style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", borderRadius: 18, padding: "16px 20px", textDecoration: "none", color: "#1e293b", boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: `rgba(${colorRgb},.1)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className="bi bi-geo-alt-fill" style={{ color, fontSize: 19 }} />
                </div>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 15 }}>Cómo llegar</span>
                  {clinica.direccion && <span style={{ fontSize: 12.5, color: "#64748b" }}>{clinica.direccion}</span>}
                </span>
                <i className="bi bi-chevron-right" style={{ color: "#94a3b8" }} />
              </a>
            )}
          </div>

          {d.dias_disponibles.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 18, padding: "18px 20px", boxShadow: "0 4px 16px rgba(0,0,0,.06)", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 10 }}>
                <i className="bi bi-clock me-2" style={{ color }} />Días de consulta
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DIAS.map((dia, i) => {
                  const activo = d.dias_disponibles.includes(i);
                  return (
                    <span key={dia} style={{ padding: "6px 10px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: activo ? `rgba(${colorRgb},.12)` : "#f1f5f9", color: activo ? color : "#cbd5e1" }}>
                      {dia}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <OpinionesPublicas medicoSlug={slug} />

          {redes.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "6px 0 10px" }}>
              {redes.map((r) => (
                <a key={r.key} href={r.href(perfil[r.key])} target="_blank" rel="noopener noreferrer" aria-label={r.key.replace("perfil_", "")}
                  style={{ width: 46, height: 46, borderRadius: "50%", background: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,.08)", display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: 19 }}>
                  <i className={`bi ${r.icon}`} />
                </a>
              ))}
            </div>
          )}

          {/* En clínicas de un solo médico las dos páginas son la misma: no se enlaza */}
          {clinica.slug && !d.unico && (
            <Link to={`/p/${clinica.slug}`} style={{ display: "block", textAlign: "center", fontSize: 13.5, color: "#64748b", marginTop: 10 }}>
              Ver la página de {clinica.nombre}
            </Link>
          )}
        </div>

        {showAgendar && clinica.slug && (
          <AgendarModal slug={clinica.slug} color={color} servicios={servicios} medicoFijo={d.medico_id}
            onClose={() => setShowAgendar(false)} onAgendado={() => registrarEvento(pagina, "CITA")} />
        )}

        <footer style={{ background: "#0f172a", color: "rgba(255,255,255,.45)", textAlign: "center", padding: "16px", fontSize: 12 }}>
          Perfil en <a href="/" style={{ color: "rgba(255,255,255,.75)", fontWeight: 600, textDecoration: "none" }}>Medic-KG</a> · © {new Date().getFullYear()}
        </footer>
      </div>
    </>
  );
}
