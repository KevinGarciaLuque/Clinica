import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { detectCapabilities } from "./capabilities";
import "./MedicKGHero.css";

// La escena 3D (three + R3F + drei) va en su propio chunk: sólo se descarga
// si el dispositivo tiene WebGL.
const EmblemScene = lazy(() => import("./EmblemScene"));

// Si WebGL falla en tiempo de ejecución, se queda la versión estática.
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

// Fragmentos decorativos del fallback sin WebGL (posición en % del slot, giro, escala)
const CSS_SHARDS = [
  [-58, -34, 24, 1.0], [62, -40, -18, 0.8], [-70, 22, 60, 0.7], [72, 28, -48, 1.1],
  [-30, -66, 12, 0.6], [34, 66, 80, 0.7], [-44, 60, -30, 0.9], [48, -64, 40, 0.65],
  [-86, -6, 100, 0.55], [88, -4, -80, 0.6],
];

function Action({ action }) {
  const { label, icon, href, onClick, variant = "primary", external } = action;
  const cls = `mkg-hero__btn mkg-hero__btn--${variant}`;
  const content = (<>{icon && <i className={`bi ${icon}`} aria-hidden="true" />}<span>{label}</span></>);
  if (href) {
    return (
      <a className={cls} href={href} onClick={onClick}
         {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {content}
      </a>
    );
  }
  return <button type="button" className={cls} onClick={onClick}>{content}</button>;
}

/**
 * Hero premium de Medic-KG: emblema 3D con explosión de cristales e
 * interacción con el mouse. Reutilizable: todo el contenido llega por props.
 */
export default function MedicKGHero({
  logoSrc = "/hero/medickg-emblem.webp",
  fallbackSrc = "/hero/medickg-emblem-512.webp",
  logoAlt = "Medic-KG",
  eyebrow,
  titleLead = "Medic-KG:",
  titleAccent = "digitaliza tu clínica",
  subtitle = "Gestiona tus pacientes, citas y expedientes clínicos desde una sola plataforma",
  actions = [],
  features = [],
  topOffset = 60,
}) {
  const [caps] = useState(detectCapabilities);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(true);

  const rootRef = useRef(null);
  const slotRef = useRef(null);
  const touchTimer = useRef(0);
  const stage = useRef({
    layout: null,
    pointer: { x: 0, y: 0 },
    reduced: caps.reduced,
    finePointer: caps.finePointer,
    // Se activa al tocar el emblema en pantallas táctiles: mientras esté en true,
    // la escena usa stage.pointer (igual que con el mouse) en vez del movimiento ambiental.
    touchActive: false,
    invalidate: null,
  });

  const use3D = caps.webgl && !failed;
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => setFailed(true), []);
  const registerInvalidate = useCallback((fn) => { stage.current.invalidate = fn; }, []);

  // Medir el slot del emblema: la escena 3D se alinea exactamente sobre él
  useLayoutEffect(() => {
    const root = rootRef.current, slot = slotRef.current;
    if (!root || !slot) return;
    const measure = () => {
      const a = root.getBoundingClientRect();
      const b = slot.getBoundingClientRect();
      stage.current.layout = {
        cx: b.left - a.left + b.width / 2,
        cy: b.top - a.top + b.height / 2,
        d: b.width,
      };
      stage.current.invalidate?.();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(slot);
    return () => ro.disconnect();
  }, []);

  // Pausar el render cuando el hero no está en pantalla
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Puntero (sólo mouse/lápiz). Posición normalizada -1..1; la inercia la aplica la escena.
  useEffect(() => {
    if (caps.reduced || !caps.finePointer) return;
    const root = rootRef.current;
    let raf = 0;
    const onMove = (e) => {
      if (e.pointerType === "touch") return;
      stage.current.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      stage.current.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      // Fallback CSS sin WebGL: inclinación 2.5D con transición suave
      if (!use3D && root && !raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          root.style.setProperty("--mkg-tilt-x", stage.current.pointer.x.toFixed(3));
          root.style.setProperty("--mkg-tilt-y", stage.current.pointer.y.toFixed(3));
        });
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, [caps.reduced, caps.finePointer, use3D]);

  // Tocar el emblema en pantallas táctiles: misma reacción que el mouse (giro + luz
  // siguiendo el punto tocado), sostenida un momento y luego vuelve al movimiento ambiental.
  const onSlotTouch = useCallback((e) => {
    if (caps.reduced || e.pointerType !== "touch") return;
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    stage.current.pointer.x = x;
    stage.current.pointer.y = y;
    stage.current.touchActive = true;
    if (!use3D && rootRef.current) {
      rootRef.current.style.setProperty("--mkg-tilt-x", x.toFixed(3));
      rootRef.current.style.setProperty("--mkg-tilt-y", y.toFixed(3));
    }
    clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => { stage.current.touchActive = false; }, 2200);
  }, [caps.reduced, use3D]);

  useEffect(() => () => clearTimeout(touchTimer.current), []);

  // Entrada del texto con GSAP (se omite con prefers-reduced-motion)
  useLayoutEffect(() => {
    if (caps.reduced) return;
    const ctx = gsap.context(() => {
      gsap.from(".mkg-hero__eyebrow", { autoAlpha: 0, y: 14, duration: 0.8, ease: "power3.out", delay: 0.7 });
      gsap.from(".mkg-hero__word", { yPercent: 115, duration: 1, ease: "power4.out", stagger: 0.06, delay: 0.85 });
      gsap.from([".mkg-hero__subtitle", ".mkg-hero__actions > *", ".mkg-hero__features > *"], {
        autoAlpha: 0, y: 18, duration: 0.8, ease: "power3.out", stagger: 0.08, delay: 1.15,
      });
    }, rootRef);
    return () => ctx.revert();
  }, [caps.reduced]);

  const words = (text, accent) =>
    text.split(" ").map((w, i) => (
      <span className="mkg-hero__mask" key={`${w}-${i}`}>
        <span className={`mkg-hero__word${accent ? " mkg-hero__word--accent" : ""}`}>{w}</span>
      </span>
    ));

  const classes = [
    "mkg-hero",
    ready && use3D ? "is-ready" : "",
    !use3D ? "is-static" : "",
    caps.reduced ? "is-reduced" : "",
  ].filter(Boolean).join(" ");

  return (
    <section ref={rootRef} className={classes} style={{ "--mkg-top": `${topOffset}px` }} aria-labelledby="mkg-hero-title">
      <div className="mkg-hero__bg" aria-hidden="true" />

      {use3D && (
        <div className="mkg-hero__canvas-wrap" aria-hidden="true">
          <SceneBoundary onError={onError}>
            <Suspense fallback={null}>
              <EmblemScene stage={stage} tier={caps.tier} active={inView} logoSrc={logoSrc} onReady={onReady} registerInvalidate={registerInvalidate} />
            </Suspense>
          </SceneBoundary>
        </div>
      )}

      <div className="mkg-hero__stage">
        <div className="mkg-hero__slot" ref={slotRef} onPointerDown={onSlotTouch}>
          {!use3D && (
            <div className="mkg-hero__shards" aria-hidden="true">
              {CSS_SHARDS.map(([x, y, r, s], i) => (
                <span key={i} className="mkg-hero__cshard"
                      style={{ "--x": `${x}%`, "--y": `${y}%`, "--r": `${r}deg`, "--s": s, "--i": i }} />
              ))}
            </div>
          )}
          <img className="mkg-hero__fallback" src={fallbackSrc} alt={logoAlt} width="512" height="512" decoding="async" />
        </div>
      </div>

      <div className="mkg-hero__content">
        {eyebrow && (
          <div className="mkg-hero__eyebrow"><i className="bi bi-stars" aria-hidden="true" />{eyebrow}</div>
        )}
        <h1 id="mkg-hero-title" className="mkg-hero__title">
          {words(titleLead, false)}{words(titleAccent, true)}
        </h1>
        {subtitle && <p className="mkg-hero__subtitle">{subtitle}</p>}
        {actions.length > 0 && (
          <div className="mkg-hero__actions">
            {actions.map((a) => <Action key={a.label} action={a} />)}
          </div>
        )}
        {features.length > 0 && (
          <ul className="mkg-hero__features">
            {features.map((f) => (
              <li key={f.label} title={f.desc}>
                {f.icon && <i className={`bi ${f.icon}`} aria-hidden="true" />}
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
