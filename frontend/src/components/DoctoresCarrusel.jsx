import { useEffect, useMemo, useState } from "react";
import DoctorCard from "./DoctorCard";

// Carrusel de médicos del directorio para la landing.
// Entre cada médico pasa una burbuja redonda con un mensaje corto, para que la
// fila respire y no se vea cargada.
// Las mismas tarjetas de "Agenda tu consulta" cruzan todo el ancho de la
// pantalla de derecha a izquierda, sin fin. Se pausa al poner el mouse sobre
// una tarjeta (o al tocar en el celular). Con prefers-reduced-motion no se
// mueve solo y se desliza a mano.

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SEG_POR_TARJETA = 7;   // velocidad: segundos que tarda cada tarjeta en pasar
const MIN_TARJETAS = 8;      // se repiten los médicos hasta llenar el ancho
const SEG_POR_BURBUJA = 4;   // las burbujas son más angostas: pasan más rápido

// Mensajes de las burbujas (se van turnando)
const MENSAJES = [
  { icono: "bi-award-fill",        titulo: "Los mejores especialistas", texto: "en un solo lugar" },
  { icono: "bi-calendar2-check",   titulo: "Agenda en línea",           texto: "las 24 horas, todos los días" },
  { icono: "bi-telephone-x",       titulo: "Sin llamadas",              texto: "ni largas esperas" },
  { icono: "bi-whatsapp",          titulo: "Te recordamos tu cita",     texto: "por WhatsApp y correo" },
  { icono: "bi-shield-lock-fill",  titulo: "Tu información",            texto: "segura y privada" },
  { icono: "bi-people-fill",       titulo: "Atención para",             texto: "toda la familia" },
];

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
  .dc-burbuja { flex: 0 0 auto; align-self: center; width: 190px; height: 190px; border-radius: 50%;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    text-align: center; padding: 22px; color: #fff; position: relative;
    background-image: linear-gradient(135deg, rgba(255,255,255,.16), rgba(0,0,0,.14));
    box-shadow: 0 14px 34px rgba(15,23,42,.16); animation: dcFlota 5s ease-in-out infinite; }
  .dc-burbuja::after { content: ""; position: absolute; inset: -9px; border-radius: 50%;
    border: 2px dashed currentColor; opacity: .18; }
  .dc-burbuja i { font-size: 30px; line-height: 1; margin-bottom: 6px; opacity: .95; }
  .dc-burbuja strong { font-size: 15.5px; font-weight: 800; line-height: 1.2; letter-spacing: -.2px; }
  .dc-burbuja span { font-size: 12.5px; line-height: 1.3; opacity: .88; }
  @keyframes dcFlota { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  @media (max-width: 640px) { .dc-item { width: 252px; } .dc-track { gap: 16px; }
    .dc-burbuja { width: 150px; height: 150px; padding: 16px; }
    .dc-burbuja i { font-size: 24px; } .dc-burbuja strong { font-size: 13.5px; } .dc-burbuja span { font-size: 11px; } }
  @media (prefers-reduced-motion: reduce) {
    .dc-marquee { overflow-x: auto; -webkit-mask-image: none; mask-image: none; }
    .dc-track, .dc-burbuja { animation: none; }
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
        <div className="dc-track" style={{ "--dc-dur": `${llenas.length * (SEG_POR_TARJETA + SEG_POR_BURBUJA)}s` }}>
          {pista.flatMap((m, i) => {
            const copia = i >= llenas.length;
            const msg = MENSAJES[(i % llenas.length) % MENSAJES.length];
            // Se alternan dos tonos: el color de las tarjetas y un verde azulado
            const fondo = i % 2 ? "#0d9488" : cardColor;
            return [
              <div key={`${m.slug}-${i}`} className="dc-item" aria-hidden={copia || undefined}>
                <DoctorCard medico={m} index={0} fallbackColor={cardColor} bandColor={bandColor} onSelect={onSelect} />
              </div>,
              <div key={`msg-${i}`} className="dc-burbuja"
                style={{ backgroundColor: fondo, animationDelay: `${-(i % 3) * 1.6}s` }} aria-hidden={copia || undefined}>
                <i className={`bi ${msg.icono}`} />
                <strong>{msg.titulo}</strong>
                <span>{msg.texto}</span>
              </div>,
            ];
          })}
        </div>
      </div>
      {pie}
    </section>
  );
}
