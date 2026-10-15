import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { construirItems } from "../utils/marketingItems";

// Vitrina interactiva de Marketing Médico para la landing:
// - Rota sola entre videos y publicaciones (barras de progreso tipo "stories").
// - Se pausa al pasar el mouse, al reproducir un video o al abrir una imagen.
// - Los videos se reproducen ahí mismo; las publicaciones se abren a pantalla
//   completa con flechas, teclado y deslizamiento.
// - Inclinación 3D suave con el mouse (se desactiva con movimiento reducido).

const DURACION_MS = 5000;
const MAX_ITEMS = 8;
function Lightbox({ items, index, onClose, onMove, onGallery }) {
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
    position: "absolute", top: "50%", [dir < 0 ? "left" : "right"]: 16, transform: "translateY(-50%)",
    width: 48, height: 48, borderRadius: "50%", border: "1px solid rgba(255,255,255,.25)",
    background: "rgba(15,23,42,.55)", color: "#fff", fontSize: 20, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)",
  });

  return createPortal(
    <motion.div
      role="dialog" aria-modal="true" aria-label={item.titulo || "Publicación"}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) onMove(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(2,6,23,.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 16px 24px" }}
    >
      <button type="button" aria-label="Cerrar" onClick={onClose}
        style={{ position: "absolute", top: 14, right: 16, width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 20, cursor: "pointer" }}>
        <i className="bi bi-x-lg" />
      </button>
      <div style={{ position: "absolute", top: 24, left: 20, color: "rgba(255,255,255,.7)", fontSize: 13, fontWeight: 600 }}>
        {index + 1} / {items.length}
      </div>

      <AnimatePresence mode="wait">
        <motion.img
          key={item.key}
          src={item.img} alt={item.titulo || ""}
          initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }}
          transition={{ duration: .22 }}
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: "min(92vw, 900px)", maxHeight: "74vh", objectFit: "contain", borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}
        />
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
  const todos = useMemo(() => construirItems(posts, videos), [posts, videos]);
  const items = todos.slice(0, MAX_ITEMS);
  const extra = todos.length - items.length;
  const reduced = useReducedMotion();

  const [activo, setActivo] = useState(0);
  const [hover, setHover] = useState(false);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [lightbox, setLightbox] = useState(null); // índice dentro de las publicaciones
  const [visible, setVisible] = useState(true);
  const [ciclo, setCiclo] = useState(0); // reinicia la barra de progreso
  const rootRef = useRef(null);

  const item = items[activo] || items[0];
  const pausado = reduced || hover || reproduciendo || lightbox !== null || !visible || items.length < 2;

  const ir = useCallback((i) => {
    setReproduciendo(false);
    setActivo((i + items.length) % items.length);
    setCiclo(c => c + 1);
  }, [items.length]);

  // Rotación automática
  useEffect(() => {
    if (pausado) return;
    const t = setTimeout(() => ir(activo + 1), DURACION_MS);
    return () => clearTimeout(t);
  }, [pausado, activo, ciclo, ir]);

  // Pausar cuando la sección no está en pantalla
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Inclinación 3D con el mouse
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 150, damping: 18 });
  const sry = useSpring(ry, { stiffness: 150, damping: 18 });
  const onMove = (e) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 10);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };
  const onLeave = () => { setHover(false); rx.set(0); ry.set(0); };

  const pubs = useMemo(() => items.filter(i => i.tipo === "post"), [items]);
  const abrir = () => {
    if (!item) return;
    if (item.tipo === "video") setReproduciendo(true);
    else setLightbox(pubs.findIndex(p => p.key === item.key));
  };
  const moverLightbox = useCallback((d) => {
    setLightbox(i => (i + d + pubs.length) % pubs.length);
  }, [pubs.length]);
  const cerrarLightbox = useCallback(() => setLightbox(null), []);

  if (!item) return null;

  return (
    <div ref={rootRef} style={{ perspective: 1200, minWidth: 0 }}>
      <motion.div
        onMouseMove={onMove}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={onLeave}
        style={{
          rotateX: srx, rotateY: sry, transformStyle: "preserve-3d",
          background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)",
          borderRadius: 24, padding: 14, boxShadow: "0 30px 70px rgba(0,0,0,.35)", position: "relative",
        }}
      >
        {/* Brillo que respira detrás de la tarjeta */}
        <div aria-hidden="true" className="mkt-glow" style={{
          position: "absolute", inset: -2, borderRadius: 26, zIndex: -1, pointerEvents: "none",
          background: "linear-gradient(120deg, rgba(56,189,248,.55), rgba(129,140,248,.35), rgba(236,72,153,.4))",
          filter: "blur(22px)", opacity: .35,
        }} />

        {/* Barras de progreso */}
        {items.length > 1 && (
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {items.map((it, i) => (
              <button key={it.key} type="button" onClick={() => ir(i)} aria-label={`Ver pieza ${i + 1}`}
                style={{ flex: 1, height: 4, padding: 0, border: "none", borderRadius: 4, background: "rgba(255,255,255,.22)", overflow: "hidden", cursor: "pointer" }}>
                <span key={i === activo ? `a${ciclo}` : "i"} className={i === activo && !pausado ? "mkt-bar-run" : undefined}
                  style={{
                    display: "block", height: "100%", background: "#fff", borderRadius: 4,
                    width: i < activo ? "100%" : i === activo ? (pausado ? "100%" : undefined) : "0%",
                    opacity: i === activo && pausado ? .7 : 1,
                    animationDuration: `${DURACION_MS}ms`,
                  }} />
              </button>
            ))}
          </div>
        )}

        {/* Escenario principal */}
        <div
          role="button" tabIndex={0}
          aria-label={item.tipo === "video" ? `Reproducir video: ${item.titulo || ""}` : `Ver publicación: ${item.titulo || ""}`}
          onClick={reproduciendo ? undefined : abrir}
          onKeyDown={e => { if (!reproduciendo && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrir(); } }}
          style={{
            position: "relative", aspectRatio: "16/10", borderRadius: 16, overflow: "hidden",
            background: "#0b1224", cursor: reproduciendo ? "default" : "pointer", transform: "translateZ(30px)",
          }}
        >
          {reproduciendo && item.tipo === "video" ? (
            <iframe src={item.embed} title={item.titulo || "Video"} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
          ) : (
            <AnimatePresence initial={false}>
              <motion.div key={item.key}
                initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : .55, ease: [.16, 1, .3, 1] }}
                style={{ position: "absolute", inset: 0 }}>
                {/* Fondo desenfocado para que las publicaciones cuadradas no se recorten */}
                {item.img && <img src={item.img} alt="" aria-hidden="true"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(18px) brightness(.55)", transform: "scale(1.15)" }} />}
                {item.img && <img src={item.img} alt={item.titulo || ""}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: item.tipo === "video" && !item.vertical ? "cover" : "contain" }} />}
              </motion.div>
            </AnimatePresence>
          )}

          {!reproduciendo && (
            <>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 55%, rgba(2,6,23,.75))", pointerEvents: "none" }} />
              <div style={{ position: "absolute", top: 12, left: 12, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#fff", background: "rgba(15,23,42,.55)", border: "1px solid rgba(255,255,255,.2)", padding: "4px 10px", borderRadius: 999, backdropFilter: "blur(6px)" }}>
                <i className={`bi ${item.tipo === "video" ? "bi-play-btn-fill" : "bi-image"}`} />
                {item.tipo === "video" ? "Video" : "Publicación"}
              </div>
              {item.tipo === "video" ? (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <div className="mkt-play" style={{ width: 66, height: 66, borderRadius: "50%", background: "rgba(255,255,255,.95)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>
                    <i className="bi bi-play-fill" style={{ fontSize: 32, color, marginLeft: 4 }} />
                  </div>
                </div>
              ) : (
                <div style={{ position: "absolute", top: 12, right: 12, width: 34, height: 34, borderRadius: "50%", background: "rgba(15,23,42,.55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,.2)" }}>
                  <i className="bi bi-arrows-fullscreen" style={{ fontSize: 13 }} />
                </div>
              )}
              {item.titulo && (
                <div style={{ position: "absolute", left: 14, right: 14, bottom: 12, color: "#fff", fontWeight: 700, fontSize: 14.5, textShadow: "0 2px 10px rgba(0,0,0,.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.titulo}
                </div>
              )}
            </>
          )}
        </div>

        {/* Miniaturas */}
        {items.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", paddingBottom: 2, transform: "translateZ(18px)" }}>
            {items.map((it, i) => (
              <button key={it.key} type="button" onClick={() => ir(i)} aria-label={`Mostrar ${it.titulo || `pieza ${i + 1}`}`} aria-current={i === activo}
                className="mkt-thumb"
                style={{
                  position: "relative", flex: "0 0 auto", width: 62, height: 62, padding: 0, borderRadius: 10, overflow: "hidden", cursor: "pointer",
                  border: i === activo ? "2px solid #fff" : "2px solid transparent",
                  opacity: i === activo ? 1 : .6, background: "#0b1224", transition: "opacity .2s, transform .2s, border-color .2s",
                }}>
                {it.img && <img src={it.img} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                {it.tipo === "video" && <i className="bi bi-play-circle-fill" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, textShadow: "0 2px 6px rgba(0,0,0,.5)" }} />}
              </button>
            ))}
            {extra > 0 && (
              <button type="button" onClick={onGallery} className="mkt-thumb"
                style={{ flex: "0 0 auto", width: 62, height: 62, borderRadius: 10, border: "1px dashed rgba(255,255,255,.4)", background: "rgba(255,255,255,.06)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                +{extra}
              </button>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px 2px" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>
            <i className="bi bi-collection-play me-2" />Ejemplos y videos reales
          </span>
          <button type="button" onClick={onGallery}
            style={{ background: "none", border: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            Ver galería <i className="bi bi-arrow-right" />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {lightbox !== null && pubs[lightbox] && (
          <Lightbox items={pubs} index={lightbox} onClose={cerrarLightbox} onMove={moverLightbox} onGallery={onGallery} />
        )}
      </AnimatePresence>
    </div>
  );
}
