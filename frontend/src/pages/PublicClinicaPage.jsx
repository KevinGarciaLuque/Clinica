import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function PublicClinicaPage() {
  const { slug } = useParams();
  const [clinica, setClinica] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

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
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (error || !clinica) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.errorBox}>
          <i className="bi bi-exclamation-circle" style={{ fontSize: 48, color: "#d63384", marginBottom: 16 }} />
          <p style={{ color: "#555", fontSize: 18 }}>{error || "Página no encontrada"}</p>
        </div>
      </div>
    );
  }

  const { perfil = {} } = clinica;
  const logo = clinica.logo_url
    ? clinica.logo_url.startsWith("http") ? clinica.logo_url : `${API}${clinica.logo_url}`
    : null;
  const fotoDr = perfil.perfil_foto_doctor
    ? perfil.perfil_foto_doctor.startsWith("http") ? perfil.perfil_foto_doctor : `${API}${perfil.perfil_foto_doctor}`
    : logo;

  const redesSociales = [
    { key: "perfil_instagram",   icon: "bi-instagram",  label: "Instagram",  color: "#E1306C", bg: "#fce4ec" },
    { key: "perfil_tiktok",      icon: "bi-tiktok",     label: "TikTok",     color: "#000000", bg: "#f5f5f5" },
    { key: "perfil_facebook",    icon: "bi-facebook",   label: "Facebook",   color: "#1877F2", bg: "#e3f2fd" },
    { key: "perfil_whatsapp",    icon: "bi-whatsapp",   label: "WhatsApp",   color: "#25D366", bg: "#e8f5e9" },
  ].filter(r => perfil[r.key]);

  return (
    <div style={styles.page}>
      {/* Fondo superior con gradiente */}
      <div style={styles.hero}>
        <div style={styles.heroContent}>
          {/* Logo / Foto */}
          <div style={styles.avatarWrap}>
            {fotoDr ? (
              <img src={fotoDr} alt={clinica.nombre} style={styles.avatar} />
            ) : (
              <div style={styles.avatarPlaceholder}>
                <i className="bi bi-hospital" style={{ fontSize: 36, color: "#9c27b0" }} />
              </div>
            )}
          </div>

          {/* Nombre y título */}
          <h1 style={styles.nombreDoctor}>
            {perfil.perfil_nombre_doctor || clinica.nombre}
          </h1>
          {perfil.perfil_titulo_doctor && (
            <p style={styles.tituloDoctor}>{perfil.perfil_titulo_doctor}</p>
          )}
          {perfil.perfil_descripcion && (
            <p style={styles.descripcion}>{perfil.perfil_descripcion}</p>
          )}
        </div>
      </div>

      {/* Contenido principal */}
      <div style={styles.body}>

        {/* Botones de acción */}
        <div style={styles.accionesWrap}>
          {perfil.perfil_whatsapp && (
            <a
              href={`https://wa.me/${perfil.perfil_whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.botonAccion, borderColor: "#25D366" }}
            >
              <i className="bi bi-whatsapp" style={{ color: "#25D366", fontSize: 22 }} />
              <span style={styles.botonLabel}>Escríbenos por WhatsApp</span>
              <i className="bi bi-chevron-right" style={styles.chevron} />
            </a>
          )}
          {perfil.perfil_google_maps && (
            <a
              href={perfil.perfil_google_maps}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.botonAccion, borderColor: "#4285F4" }}
            >
              <i className="bi bi-geo-alt-fill" style={{ color: "#4285F4", fontSize: 22 }} />
              <span style={styles.botonLabel}>Encuéntranos en Google</span>
              <i className="bi bi-chevron-right" style={styles.chevron} />
            </a>
          )}
        </div>

        {/* Servicios */}
        {servicios.length > 0 && (
          <div style={styles.serviciosSection}>
            <h2 style={styles.sectionTitle}>Nuestros Servicios</h2>
            <div style={styles.serviciosList}>
              {servicios.map((s) => (
                <div key={s.id} style={styles.servicioCard}>
                  <div style={styles.servicioInfo}>
                    <h3 style={styles.servicioNombre}>{s.nombre}</h3>
                    {s.descripcion && (
                      <p style={styles.servicioDesc}>{s.descripcion}</p>
                    )}
                  </div>
                  <i className="bi bi-chevron-right" style={{ color: "#9e9e9e", flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Redes sociales */}
        {redesSociales.length > 0 && (
          <div style={styles.redesWrap}>
            {redesSociales.map((r) => (
              <a
                key={r.key}
                href={perfil[r.key].startsWith("http") ? perfil[r.key] : `https://${perfil[r.key]}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...styles.redBoton, background: r.bg }}
                title={r.label}
              >
                <i className={`bi ${r.icon}`} style={{ color: r.color, fontSize: 22 }} />
              </a>
            ))}
          </div>
        )}

        {/* Info de contacto */}
        {(clinica.ciudad || clinica.telefono) && (
          <div style={styles.contactoInfo}>
            {clinica.ciudad && (
              <span style={styles.contactoItem}>
                <i className="bi bi-geo-alt" style={{ marginRight: 4 }} />
                {clinica.ciudad}{clinica.pais ? `, ${clinica.pais}` : ""}
              </span>
            )}
            {clinica.telefono && (
              <span style={styles.contactoItem}>
                <i className="bi bi-telephone" style={{ marginRight: 4 }} />
                {clinica.telefono}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const PURPLE = "#7c3aed";
const PURPLE_DARK = "#5b21b6";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f5f5",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#f5f5f5",
  },
  spinner: {
    width: 40,
    height: 40,
    border: `4px solid #e0d7f7`,
    borderTop: `4px solid ${PURPLE}`,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: 32,
  },
  hero: {
    background: `linear-gradient(145deg, ${PURPLE} 0%, ${PURPLE_DARK} 100%)`,
    padding: "40px 24px 60px",
    textAlign: "center",
  },
  heroContent: {
    maxWidth: 480,
    margin: "0 auto",
  },
  avatarWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: "50%",
    objectFit: "cover",
    border: "4px solid rgba(255,255,255,0.5)",
    background: "#fff",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "4px solid rgba(255,255,255,0.5)",
  },
  nombreDoctor: {
    color: "#fff",
    fontSize: 24,
    fontWeight: 700,
    margin: "0 0 6px",
    lineHeight: 1.2,
  },
  tituloDoctor: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    margin: "0 0 10px",
    lineHeight: 1.5,
  },
  descripcion: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    margin: 0,
    lineHeight: 1.6,
  },
  body: {
    maxWidth: 480,
    margin: "-24px auto 0",
    padding: "0 16px 40px",
    position: "relative",
  },
  accionesWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 24,
  },
  botonAccion: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "#fff",
    border: "2px solid #eee",
    borderRadius: 16,
    padding: "16px 20px",
    textDecoration: "none",
    color: "#333",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  botonLabel: {
    flex: 1,
    fontWeight: 600,
    fontSize: 15,
    color: "#333",
  },
  chevron: {
    color: "#bbb",
  },
  serviciosSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#333",
    margin: "0 0 12px",
  },
  serviciosList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  servicioCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#fff",
    borderRadius: 14,
    padding: "16px 18px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    cursor: "default",
  },
  servicioInfo: {
    flex: 1,
  },
  servicioNombre: {
    fontSize: 15,
    fontWeight: 600,
    color: "#222",
    margin: "0 0 4px",
    lineHeight: 1.3,
  },
  servicioDesc: {
    fontSize: 13,
    color: "#666",
    margin: 0,
    lineHeight: 1.5,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  redesWrap: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    marginBottom: 24,
  },
  redBoton: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    textDecoration: "none",
    transition: "transform 0.15s",
  },
  contactoInfo: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  contactoItem: {
    fontSize: 13,
    color: "#888",
    display: "flex",
    alignItems: "center",
  },
};
