import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { construirItems } from "../utils/marketingItems";

// Carrusel de Marketing Médico para la landing:
// - Dos filas de imágenes y videos que circulan sin fin en sentidos opuestos.
// - Se pausa al pasar el mouse (o al tocar en el celular) y mientras hay una
//   pieza abierta.
// - Al hacer clic, la pieza se abre en grande: los videos se reproducen y las
//   imágenes se ven completas, con flechas, teclado y deslizamiento.
// - Con prefers-reduced-motion no se mueve solo: se desliza a mano.

const SEG_POR_PIEZA = 4.5;   // velocidad: segundos que tarda cada pieza en pasar
const MIN_POR_FILA = 8;      // se repiten las piezas hasta llenar la fila

const CSS = `
  .mkt-marquee { position: relative; overflow: hidden;
    -webkit-mask-image: linear-gradient(to right, transparent, #000 7%, #000 93%, transparent);
            mask-image: linear-gradient(to right, transparent, #000 7%, #000 93%, transparent); }
  .mkt-track { display: flex; gap: 12px; width: max-content; padding: 6px 0;
    animation: mktScroll var(--mkt-dur) linear infinite; }
  .mkt-track.mkt-rev { animation-direction: reverse; }
  .mkt-marquee:hover .mkt-track,
  .mkt-marquee:focus-within .mkt-track,
  .mkt-marquee.is-paused .mkt-track { animation-play-state: paused; }
  @keyframes mktScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

  .mkt-card { position: relative; flex: 0 0 auto; height: var(--mkt-h); border-radius: 14px; overflow: hidden;
    padding: 0; border: 1px solid rgba(255,255,255,.14); background: #0b1224; cursor: pointer;
    transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
  .mkt-card:hover, .mkt-card:focus-visible { transform: translateY(-4px) scale(1.04); z-index: 2;
    border-color: rgba(255,255,255,.55); box-shadow: 0 16px 34px rgba(0,0,0,.45); outline: none; }
  .mkt-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .mkt-card .mkt-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 10px 8px; text-align: left;
    color: #fff; font-size: 11.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    background: linear-gradient(transparent, rgba(2,6,23,.8)); opacity: 0; transform: translateY(6px);
    transition: opacity .25s ease, transform .25s ease; }
  .mkt-card:hover .mkt-cap, .mkt-card:focus-visible .mkt-cap { opacity: 1; transform: none; }
  .mkt-card .mkt-ico { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .mkt-card .mkt-ico span { width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,.94);
    display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(0,0,0,.4);
    transition: transform .25s ease; }
  .mkt-card:hover .mkt-ico span { transform: scale(1.12); }
  .mkt-card .mkt-zoom { opacity: 0; transition: opacity .25s ease; }
  .mkt-card:hover .mkt-zoom, .mkt-card:focus-visible .mkt-zoom { opacity: 1; }

  .mkt-glow { animation: mktGlow 4s ease-in-out infinite; }
  @keyframes mktGlow { 0%, 100% { opacity: .22; } 50% { opacity: .45; } }

  @media (max-width: 640px) { .mkt-track { gap: 10px; } }
  @media (prefers-reduced-motion: reduce) {
    .mkt-marquee { overflow-x: auto; -webkit-mask-image: none; mask-image: none; }
    .mkt-track { animation: none; }
    .mkt-card, .mkt-card .mkt-cap { transition: none; }
    .mkt-glow { animation: none; }
  }
`;

// Ancho de cada tarjeta según el formato, para una altura dada
function ancho(item, h) {
  if (item.tipo === "video") return item.vertical ? Math.round(h * 0.6) : Math.round(h * 16 / 9);
  return h;
}

// Repite la lista hasta tener suficientes piezas para llenar la fila
function rellenar(lista) {
  if (!lista.length) return [];
  const out = [];
  while (out.length < MIN_POR_FILA) out.push(...lista);
  return out;
}

function Fila({ items, reversa, alto, pausada, onOpen, color }) {
  const llenas = useMemo(() => rellenar(items), [items]);
  if (!llenas.length) return null;
  // La pista va duplicada: al llegar a -50% vuelve al inicio sin salto visible
  const pista = [...llenas, ...llenas];
  return (
    <div className={`mkt-marquee${pausada ? " is-paused" : ""}`}>
      <div className={`mkt-track${reversa ? " mkt-rev" : ""}`}
        style={{ "--mkt-dur": `${llenas.length * SEG_POR_PIEZA}s`, "--mkt-h": `${alto}px` }}>
        {pista.map((it, i) => {
          const copia = i >= llenas.length; // la segunda mitad es solo visual
          return (
            <button key={`${it.key}-${i}`} type="button" className="mkt-card"
              style={{ width: ancho(it, alto) }}
              onClick={() => onOpen(it.key)}
              tabIndex={copia ? -1 : 0} aria-hidden={copia || undefined}
              aria-label={`${it.tipo === "video" ? "Reproducir video" : "Ver publicación"}${it.titulo ? `: ${it.titulo}` : ""}`}>
              {it.img
                ? <img src={it.img} alt="" loading="lazy" draggable="false" />
                : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${color}, #0b1224)` }} />}
              {it.tipo === "video" ? (
                <div className="mkt-ico"><span><i className="bi bi-play-fill" style={{ fontSize: 22, color, marginLeft: 3 }} /></span></div>
              ) : (
                <div className="mkt-ico mkt-zoom"><span style={{ width: 36, height: 36 }}><i className="bi bi-arrows-fullscreen" style={{ fontSize: 13, color }} /></span></div>
              )}
              {it.titulo && <div className="mkt-cap">{it.titulo}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Visor({ items, index, onClose, onMove, onGallery }) {
  const item = items[index];
  const touch = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, onMove]);

  const flecha = (dir) => ({
    position: "absolute", top: "50%", [dir < 0 ? "left" : "right"]: 14, transform: "translateY(-50%)",
    width: 46, height: 46, borderRadius: "50%", border: "1px solid rgba(255,255,255,.25)",
    background: "rgba(15,23,42,.6)", color: "#fff", fontSize: 20, cursor: "pointer", zIndex: 2,
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)",
  });

  const esVideo = item.tipo === "video";
  const marco = esVideo
    ? (item.vertical
        ? { height: "min(76vh, 760px)", aspectRatio: "9 / 16", maxWidth: "92vw" }
        : { width: "min(92vw, 960px)", aspectRatio: "16 / 9", maxHeight: "76vh" })
    : null;

  return createPortal(
    <motion.div
      role="dialog" aria-modal="true" aria-label={item.titulo || (esVideo ? "Video" : "Publicación")}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) onMove(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(2,6,23,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 16px 24px" }}
    >
      <button type="button" aria-label="Cerrar" onClick={onClose}
        style={{ position: "absolute", top: 14, right: 16, width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.14)", color: "#fff", fontSize: 20, cursor: "pointer", zIndex: 2 }}>
        <i className="bi bi-x-lg" />
      </button>
      <div style={{ position: "absolute", top: 26, left: 20, color: "rgba(255,255,255,.7)", fontSize: 13, fontWeight: 600 }}>
        {index + 1} / {items.length}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={item.key}
          initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }}
          transition={{ duration: .2 }}
          onClick={e => e.stopPropagation()}
          style={{ display: "flex", justifyContent: "center" }}>
          {esVideo ? (
            <div style={{ ...marco, borderRadius: 14, overflow: "hidden", background: "#000", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
              <iframe src={item.embed} title={item.titulo || "Video"} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen
                style={{ width: "100%", height: "100%", border: 0, display: "block" }} />
            </div>
          ) : (
            <img src={item.img} alt={item.titulo || ""}
              style={{ maxWidth: "min(92vw, 900px)", maxHeight: "74vh", objectFit: "contain", borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,.5)" }} />
          )}
        </motion.div>
      </AnimatePresence>

      <div onClick={e => e.stopPropagation()} style={{ marginTop: 18, textAlign: "center", color: "#fff", maxWidth: 640 }}>
        {item.titulo && <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{item.titulo}</div>}
        <button type="button" onClick={onGallery}
          style={{ background: "#fff", color: "#0f172a", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Ver galería completa <i className="bi bi-arrow-right ms-1" />
        </button>
      </div>

      {items.length > 1 && (
        <>
          <button type="button" aria-label="Anterior" style={flecha(-1)} onClick={e => { e.stopPropagation(); onMove(-1); }}>
            <i className="bi bi-chevron-left" />
          </button>
          <button type="button" aria-label="Siguiente" style={flecha(1)} onClick={e => { e.stopPropagation(); onMove(1); }}>
            <i className="bi bi-chevron-right" />
          </button>
        </>
      )}
    </motion.div>,
    document.body
  );
}

export default function MarketingShowcase({ posts, videos, color, onGallery }) {
  const items = useMemo(() => construirItems(posts, videos), [posts, videos]);
  const [abierto, setAbierto] = useState(null); // índice dentro de items
  const [tocando, setTocando] = useState(false);
  const [alto, setAlto] = useState(150);

  // Altura de las tarjetas según el ancho de pantalla
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const set = () => setAlto(mq.matches ? 118 : 150);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  // Dos filas: la segunda empieza a la mitad de la lista para no repetir lo mismo arriba y abajo
  const [filaA, filaB] = useMemo(() => {
    if (items.length < 3) return [items, []];
    const mitad = Math.ceil(items.length / 2);
    return [items, [...items.slice(mitad), ...items.slice(0, mitad)]];
  }, [items]);

  const abrir = useCallback((key) => setAbierto(items.findIndex(i => i.key === key)), [items]);
  const mover = useCallback((d) => setAbierto(i => (i + d + items.length) % items.length), [items.length]);
  const cerrar = useCallback(() => setAbierto(null), []);

  if (!items.length) return null;
  const pausada = abierto !== null || tocando;

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <style>{CSS}</style>
      <div aria-hidden="true" className="mkt-glow" style={{
        position: "absolute", inset: -2, borderRadius: 26, pointerEvents: "none",
        background: "linear-gradient(120deg, rgba(56,189,248,.55), rgba(129,140,248,.35), rgba(236,72,153,.4))",
        filter: "blur(22px)",
      }} />
      <div
        onTouchStart={() => setTocando(true)}
        onTouchEnd={() => setTocando(false)}
        style={{
          position: "relative", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)",
          borderRadius: 24, padding: "14px 0 10px", boxShadow: "0 30px 70px rgba(0,0,0,.35)", backdropFilter: "blur(4px)",
        }}
      >
        <Fila items={filaA} alto={alto} pausada={pausada} onOpen={abrir} color={color} />
        <Fila items={filaB} alto={alto} pausada={pausada} onOpen={abrir} color={color} reversa />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 18px 2px" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>
            <i className="bi bi-collection-play me-2" />Ejemplos y videos reales
          </span>
          <button type="button" onClick={onGallery}
            style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
            Ver galería <i className="bi bi-arrow-right" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {abierto !== null && items[abierto] && (
          <Visor items={items} index={abierto} onClose={cerrar} onMove={mover} onGallery={onGallery} />
        )}
      </AnimatePresence>
    </div>
  );
}
