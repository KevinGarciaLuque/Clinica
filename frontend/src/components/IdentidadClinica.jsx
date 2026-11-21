/**
 * Identidad de la clínica a la vista: especialidad + nombre (por ejemplo «Cardiología · Clínica Kadie Paz»),
 * con el ícono y el color de su tipo de clínica.
 *
 *  - modo "pill":   etiqueta de dos líneas para la barra superior (pantallas anchas).
 *  - modo "franja": franja delgada bajo la barra superior (teléfono y tablet, donde no cabe la etiqueta).
 */
import { useAuth } from "../auth/AuthContext";

const COLOR_DEFECTO = "#60a5fa";
const hexValido = (c) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c : COLOR_DEFECTO);

/** Aclara el color hacia el blanco para que el texto se lea bien sobre el fondo oscuro de la barra */
const claro = (hex, t = 0.4) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

function Icono({ icono, color, tam }) {
  if (icono && /^bi-/.test(icono)) return <i className={`bi ${icono}`} style={{ color, fontSize: tam }} />;
  if (icono) return <span style={{ fontSize: tam }}>{icono}</span>; // algunos tipos traen un emoji
  return <i className="bi bi-hospital" style={{ color, fontSize: tam }} />;
}

export default function IdentidadClinica({ modo = "pill" }) {
  const { user, clinicaInfo } = useAuth();
  if (!clinicaInfo?.nombre || user?.super) return null;

  const tipo = clinicaInfo.tipo;
  const color = hexValido(tipo?.color);
  const texto = claro(color);
  const especialidad = tipo?.nombre ? `${tipo.nombre}${clinicaInfo.es_pediatrica ? " · Pediátrica" : ""}` : null;
  const titulo = [especialidad, clinicaInfo.nombre].filter(Boolean).join(" · ");

  if (modo === "franja") {
    return (
      <div title={titulo} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7, flexShrink: 0,
        padding: "4px 12px", background: "rgba(15,28,53,.96)", borderBottom: `2px solid ${color}55`,
        color: "#e2e8f0", fontSize: "0.74rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden",
      }}>
        <Icono icono={tipo?.icono} color={color} tam="0.85rem" />
        {especialidad && <span style={{ color: texto, fontWeight: 800 }}>{especialidad}</span>}
        {especialidad && <span style={{ opacity: 0.5 }}>·</span>}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{clinicaInfo.nombre}</span>
      </div>
    );
  }

  return (
    <div title={titulo} style={{
      display: "flex", alignItems: "center", gap: 9, maxWidth: 250, minWidth: 0, flexShrink: 1,
      padding: "4px 12px 4px 5px", borderRadius: 12, background: "rgba(255,255,255,.06)", border: `1px solid ${color}66`,
    }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}26` }}>
        <Icono icono={tipo?.icono} color={color} tam="0.95rem" />
      </span>
      <span style={{ minWidth: 0, lineHeight: 1.15 }}>
        {especialidad && (
          <span style={{ display: "block", color: texto, fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{especialidad}</span>
        )}
        <span style={{ display: "block", color: "#f1f5f9", fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{clinicaInfo.nombre}</span>
      </span>
    </div>
  );
}
