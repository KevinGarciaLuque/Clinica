import { useEffect, useMemo, useState } from "react";
import DoctorCard from "./DoctorCard";

// Carrusel de médicos del directorio para la landing.
// Las mismas tarjetas de "Agenda tu consulta" cruzan todo el ancho de la
// pantalla de derecha a izquierda, sin fin. Se pausa al poner el mouse sobre
// una tarjeta (o al tocar en el celular). Con prefers-reduced-motion no se
// mueve solo y se desliza a mano.

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SEG_POR_TARJETA = 7;   // velocidad: segundos que tarda cada tarjeta en pasar
const MIN_TARJETAS = 8;      // se repiten los médicos hasta llenar el ancho

const CSS = `
  .dc-marquee { position: relative; overflow: hidden; padding: 14px 0 26px;
    -webkit-mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
            mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent); }
  .dc-track { display: flex; align-items: stretch; gap: 22px; width: max-content; padding: 0 11px;
    animation: dcScroll var(--dc-dur) linear infinite; }
  .dc-marquee:hover .dc-track, .dc-marquee.is-paused .dc-track { animation-play-state: paused; }
  @keyframes dcScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .dc-item { width: 290px; flex: 0 0 auto; display: flex; flex-direction: column; }
  .dc-item > .dm-card { flex: 1; transition: transform .25s ease, box-shadow .25s ease !important; }
  .dc-item > .dm-card:hover { transform: translateY(-6px); box-shadow: 0 20px 48px rgba(0,0,0,.14) !important; }
  @media (max-width: 640px) { .dc-item { width: 252px; } .dc-track { gap: 16px; } }
  @media (prefers-reduced-motion: reduce) {
    .dc-marquee { overflow-x: auto; -webkit-mask-image: none; mask-image: none; }
    .dc-track { animation: none; }
  }
`;

// Si no hay médicos en el directorio, la sección completa no se muestra.
export default function DoctoresCarrusel({ id, style, cardColor, bandColor, onSelect, encabezado, pie }) {
  const [medicos, setMedicos] = useState([]);
  const [tocando, setTocando] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/public/directorio`)
      .then(r => r.json())
      .then(d => { if (d.ok) setMedicos(d.data || []); })
      .catch(() => {});
  }, []);

  // Se repite la lista hasta tener suficientes tarjetas; luego se duplica
  // completa para que el ciclo vuelva al inicio sin salto visible.
  const llenas = useMemo(() => {
    if (!medicos.length) return [];
    const out = [];
    while (out.length < MIN_TARJETAS) out.push(...medicos);
    return out;
  }, [medicos]);

  if (!medicos.length) return null;
  const pista = [...llenas, ...llenas];

  return (
    <section id={id} style={style}>
      <style>{CSS}</style>
      {encabezado}
      <div
        className={`dc-marquee${tocando ? " is-paused" : ""}`}
        onTouchStart={() => setTocando(true)}
        onTouchEnd={() => setTocando(false)}
        onTouchCancel={() => setTocando(false)}
      >
        <div className="dc-track" style={{ "--dc-dur": `${llenas.length * SEG_POR_TARJETA}s` }}>
          {pista.map((m, i) => {
            const copia = i >= llenas.length;
            return (
              <div key={`${m.slug}-${i}`} className="dc-item" aria-hidden={copia || undefined}>
                <DoctorCard medico={m} index={0} fallbackColor={cardColor} bandColor={bandColor} onSelect={onSelect} />
              </div>
            );
          })}
        </div>
      </div>
      {pie}
    </section>
  );
}
