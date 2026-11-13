import { ZONAS_CARA } from "../utils/esteticaCatalogos";

/**
 * Dibujo de la cara de frente: se tocan las zonas para marcarlas.
 * La izquierda del dibujo es el lado DERECHO del paciente (como al mirarlo de frente).
 */

export default function MapaFacial({ marcadas = [], onToggle, color = "#db2777", soloLectura = false, cantidades = {} }) {
  const activa = (id) => marcadas.includes(id);
  return (
    <div style={{ maxWidth: 280, margin: "0 auto" }}>
      <svg viewBox="0 0 260 320" style={{ width: "100%", height: "auto", display: "block" }} role="group" aria-label="Zonas de la cara">
        {/* Cara */}
        <ellipse cx="130" cy="160" rx="92" ry="122" fill="#fdf2ec" stroke="#d6b4a0" strokeWidth="2" />
        <rect x="100" y="272" width="60" height="44" rx="8" fill="#fdf2ec" stroke="#d6b4a0" strokeWidth="2" />
        <ellipse cx="38" cy="160" rx="9" ry="20" fill="#fdf2ec" stroke="#d6b4a0" strokeWidth="2" />
        <ellipse cx="222" cy="160" rx="9" ry="20" fill="#fdf2ec" stroke="#d6b4a0" strokeWidth="2" />
        {/* Ojos y cejas (solo referencia) */}
        <path d="M76 108 Q96 98 114 106" stroke="#a78b7a" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M146 106 Q164 98 184 108" stroke="#a78b7a" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="96" cy="124" rx="15" ry="7" fill="#fff" stroke="#a78b7a" strokeWidth="1.5" />
        <ellipse cx="164" cy="124" rx="15" ry="7" fill="#fff" stroke="#a78b7a" strokeWidth="1.5" />
        <circle cx="96" cy="124" r="4" fill="#6b4f3f" />
        <circle cx="164" cy="124" r="4" fill="#6b4f3f" />

        {ZONAS_CARA.map((z) => (
          <g key={z.id}
            onClick={soloLectura ? undefined : () => onToggle?.(z.id)}
            style={{ cursor: soloLectura ? "default" : "pointer" }}
            role={soloLectura ? undefined : "button"}
            aria-pressed={soloLectura ? undefined : activa(z.id)}
            aria-label={z.label}>
            <title>{z.label}</title>
            {z.formas.map((f, i) => (
              <ellipse key={i} {...f}
                fill={activa(z.id) ? color : "#94a3b8"}
                fillOpacity={activa(z.id) ? 0.55 : 0.12}
                stroke={activa(z.id) ? color : "#94a3b8"}
                strokeOpacity={activa(z.id) ? 1 : 0.5}
                strokeWidth="1.5" strokeDasharray={activa(z.id) ? undefined : "3 2"} />
            ))}
            {activa(z.id) && cantidades[z.id] && (
              <text x={z.formas[0].cx} y={z.formas[0].cy + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff"
                style={{ paintOrder: "stroke", stroke: color, strokeWidth: 3, pointerEvents: "none" }}>
                {cantidades[z.id]}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="d-flex justify-content-between text-muted" style={{ fontSize: "0.7rem", marginTop: 2 }}>
        <span>← Derecha del paciente</span><span>Izquierda →</span>
      </div>
    </div>
  );
}
