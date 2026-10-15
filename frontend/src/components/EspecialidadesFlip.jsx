import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// Cuadrícula de especialidades con tarjetas que giran en 3D.
// - Al pasar el mouse (o al enfocarla con el teclado) la tarjeta gira y muestra la
//   descripción por detrás, con el color de la especialidad.
// - En pantallas táctiles gira al tocar y vuelve al tocar de nuevo. Además,
//   la primera vez que cada tarjeta aparece en pantalla da una vuelta sola
//   (muestra el reverso y regresa) para que se note que se puede girar.
// - Por detrás tiene un enlace "Ver qué incluye" que lleva a los planes.
// - Con prefers-reduced-motion cambia de cara sin animación.

const CSS = `
  .esp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
  .esp-card { display: block; width: 100%; height: 200px; padding: 0; border: none; background: none;
    cursor: pointer; perspective: 1000px; text-align: center; font: inherit; }
  .esp-card:focus-visible { outline: none; }
  .esp-card { -webkit-tap-highlight-color: transparent; }
  .esp-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d;
    transition: transform .65s cubic-bezier(.2,.8,.2,1); }
  @media (hover: hover) { .esp-card:hover .esp-inner { transform: rotateY(180deg); } }
  .esp-card.is-flipped .esp-inner, .esp-card:focus-visible .esp-inner,
  .esp-card:has(.esp-link:focus-visible) .esp-inner { transform: rotateY(180deg); }

  .esp-face { position: absolute; inset: 0; border-radius: 20px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 20px 18px;
    -webkit-backface-visibility: hidden; backface-visibility: hidden; }
  .esp-front { background: #fff; border: 1px solid color-mix(in srgb, var(--c) 22%, transparent);
    box-shadow: 0 6px 22px color-mix(in srgb, var(--c) 10%, transparent); transition: box-shadow .25s ease; }
  .esp-card:hover .esp-front { box-shadow: 0 14px 34px color-mix(in srgb, var(--c) 22%, transparent); }
  .esp-icon { width: 64px; height: 64px; border-radius: 20px; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--c) 12%, #fff); border: 1px solid color-mix(in srgb, var(--c) 25%, transparent);
    margin-bottom: 14px; }
  .esp-icon i { font-size: 28px; color: var(--c); }
  .esp-name { font-weight: 800; font-size: 15px; color: #0f172a; line-height: 1.3; }
  .esp-hint { margin-top: 10px; font-size: 11.5px; font-weight: 600; color: #94a3b8; display: inline-flex; align-items: center; gap: 5px; }

  .esp-back { transform: rotateY(180deg); color: #fff; overflow: hidden;
    background: var(--c);
    background: linear-gradient(150deg, var(--c) 0%, color-mix(in srgb, var(--c) 62%, #0f172a) 100%);
    box-shadow: 0 16px 36px color-mix(in srgb, var(--c) 35%, transparent); }
  .esp-back::before { content: ""; position: absolute; top: -40px; right: -40px; width: 130px; height: 130px;
    border-radius: 50%; background: rgba(255,255,255,.12); }
  .esp-back i.esp-bgicon { position: absolute; bottom: -14px; right: -6px; font-size: 84px; color: rgba(255,255,255,.12); }
  .esp-back-name { position: relative; font-weight: 800; font-size: 14.5px; margin-bottom: 8px; }
  .esp-back-desc { position: relative; font-size: 13px; line-height: 1.5; color: rgba(255,255,255,.92); }
  /* El enlace solo recibe clics cuando la tarjeta está girada, para que el
     primer toque en el celular voltee la tarjeta y no salte a otra sección */
  .esp-link { position: relative; margin-top: 12px; display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid rgba(255,255,255,.45); background: rgba(255,255,255,.16); color: #fff;
    font: inherit; font-size: 12.5px; font-weight: 700; padding: 6px 12px; border-radius: 999px;
    cursor: pointer; pointer-events: none; white-space: nowrap; transition: background .2s ease, transform .2s ease; }
  .esp-link i { transition: transform .2s ease; }
  .esp-link:hover { background: #fff; color: var(--c); }
  .esp-link:hover i { transform: translateX(3px); }
  .esp-link:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  @media (hover: hover) { .esp-card:hover .esp-link { pointer-events: auto; } }
  .esp-card.is-flipped .esp-link, .esp-card:focus-within .esp-link { pointer-events: auto; }

  @media (max-width: 640px) {
    .esp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .esp-card { height: 222px; }
    .esp-face { padding: 16px 10px; }
    .esp-icon { width: 54px; height: 54px; border-radius: 16px; margin-bottom: 10px; }
    .esp-icon i { font-size: 24px; }
    .esp-name { font-size: 14px; }
    .esp-back-desc { font-size: 12px; }
    .esp-link { margin-top: 10px; font-size: 11px; padding: 5px 8px; gap: 4px; }
  }
  /* Vuelta de demostración en pantallas táctiles: gira, muestra el reverso y regresa */
  @keyframes espPeek {
    0%       { transform: rotateY(0deg); }
    24%, 68% { transform: rotateY(180deg); }
    92%, 100% { transform: rotateY(0deg); }
  }
  .esp-card.is-peek .esp-inner { animation: espPeek 2.6s cubic-bezier(.2,.8,.2,1) var(--peek-delay, .35s) both; }
  @media (prefers-reduced-motion: reduce) {
    .esp-inner, .esp-front { transition: none; }
    .esp-card.is-peek .esp-inner { animation: none; }
  }
`;

function Tarjeta({ esp, index, onVerQueIncluye }) {
  const [volteada, setVolteada] = useState(false);
  const [peek, setPeek] = useState(false);
  const ref = useRef(null);

  // Solo en pantallas táctiles: la primera vez que la tarjeta entra en pantalla, da una vuelta sola
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    let tactil = false;
    try {
      tactil = window.matchMedia("(hover: none)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch { /* sin matchMedia: no se anima */ }
    if (!tactil) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setPeek(true); io.disconnect(); }
    }, { threshold: 0.7 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.035, 0.45), ease: "easeOut" }}
    >
      <div
        ref={ref}
        role="group"
        tabIndex={0}
        className={`esp-card${volteada ? " is-flipped" : ""}${peek ? " is-peek" : ""}`}
        // Las tarjetas de la columna derecha giran un poco después que las de la izquierda
        style={{ "--c": esp.color, "--peek-delay": `${0.35 + (index % 2) * 0.18}s` }}
        aria-label={esp.label}
        // En táctil, tocar voltea (y cancela la vuelta de demostración); con mouse ya gira al pasar por encima
        onPointerUp={e => { if (e.pointerType !== "mouse") { setPeek(false); setVolteada(v => !v); } }}
        onAnimationEnd={e => { if (e.animationName === "espPeek") setPeek(false); }}
      >
        <div className="esp-inner">
          <div className="esp-face esp-front" aria-hidden="true">
            <div className="esp-icon"><i className={`bi ${esp.icon}`} /></div>
            <div className="esp-name">{esp.label}</div>
            <div className="esp-hint"><i className="bi bi-arrow-repeat" />Ver más</div>
          </div>
          <div className="esp-face esp-back">
            <i className={`bi ${esp.icon} esp-bgicon`} aria-hidden="true" />
            <div className="esp-back-name">{esp.label}</div>
            <div className="esp-back-desc">{esp.desc}</div>
            {onVerQueIncluye && (
              <button type="button" className="esp-link"
                onPointerUp={e => e.stopPropagation()}
                onClick={onVerQueIncluye}>
                Ver qué incluye <i className="bi bi-arrow-right" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function EspecialidadesFlip({ items, onVerQueIncluye }) {
  return (
    <>
      <style>{CSS}</style>
      <div className="esp-grid">
        {items.map((esp, i) => <Tarjeta key={esp.label} esp={esp} index={i} onVerQueIncluye={onVerQueIncluye} />)}
      </div>
    </>
  );
}
