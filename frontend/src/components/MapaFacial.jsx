import { ZONAS_CARA, ANCHO_CARA } from "../utils/esteticaCatalogos";

/**
 * Ilustración de la cara de frente con las zonas de tratamiento encima: se tocan
 * para marcarlas. La izquierda del dibujo es el lado DERECHO del paciente.
 * Ilustración: public/img/cara-estetica.webp (880×1168; se recorta abajo).
 */
const ALTO_VISTA = 1110;

export default function MapaFacial({ marcadas = [], onToggle, color = "#db2777", soloLectura = false, cantidades = {} }) {
  const activa = (id) => marcadas.includes(id);
  return (
    <div className="mapa-facial" style={{ maxWidth: 300, margin: "0 auto" }}>
      <style>{`
        .mapa-facial .zona ellipse { transition: fill-opacity .15s, stroke-opacity .15s; }
        .mapa-facial .zona.libre:hover ellipse { fill-opacity: .22; stroke-opacity: 1; }
      `}</style>
      <svg viewBox={`0 0 ${ANCHO_CARA} ${ALTO_VISTA}`} style={{ width: "100%", height: "auto", display: "block", borderRadius: 12, background: "#fff" }}
        role="group" aria-label="Zonas de la cara">
        <image href="/img/cara-estetica.webp" x="0" y="0" width={ANCHO_CARA} height="1168" preserveAspectRatio="xMidYMin meet" />
        {ZONAS_CARA.map((z) => {
          const on = activa(z.id);
          return (
            <g key={z.id} className={`zona ${on ? "" : "libre"}`}
              onClick={soloLectura ? undefined : () => onToggle?.(z.id)}
              style={{ cursor: soloLectura ? "default" : "pointer" }}
              role={soloLectura ? undefined : "button"}
              aria-pressed={soloLectura ? undefined : on}
              aria-label={z.label}>
              <title>{z.label}</title>
              {z.formas.map((f, i) => (
                <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry}
                  transform={f.rot ? `rotate(${f.rot} ${f.cx} ${f.cy})` : undefined}
                  fill={on ? color : "#475569"} fillOpacity={on ? 0.42 : 0.07}
                  stroke={on ? color : "#64748b"} strokeOpacity={on ? 1 : 0.55}
                  strokeWidth={on ? 5 : 3} strokeDasharray={on ? undefined : "10 7"} />
              ))}
              {on && cantidades[z.id] && z.formas.slice(0, 1).map((f) => (
                <g key="n" style={{ pointerEvents: "none" }}>
                  <rect x={f.cx - 36} y={f.cy - 24} width="72" height="48" rx="24" fill={color} />
                  <text x={f.cx} y={f.cy + 12} textAnchor="middle" fontSize="34" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
                    {cantidades[z.id]}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="d-flex justify-content-between text-muted" style={{ fontSize: "0.7rem", marginTop: 4 }}>
        <span>← Derecha del paciente</span><span>Izquierda →</span>
      </div>
    </div>
  );
}
