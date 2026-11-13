import { useEffect, useRef, useState } from "react";

/**
 * Tarjeta de los historiales (consultas y nutrición). Todas miden lo mismo; si el
 * contenido no cabe se desvanece abajo y aparece «Ver más» para desplegar solo esa.
 */
const ALTO = 250; // px del contenido con la tarjeta cerrada

export default function TarjetaHistorial({ color, icono, nombre, children, ancha }) {
  const [abierta, setAbierta] = useState(false);
  const [altoTotal, setAltoTotal] = useState(0); // alto real del contenido
  const sobra = altoTotal > ALTO + 4;
  const caja = useRef(null);

  // ¿El contenido es más alto que la tarjeta? (se vuelve a medir si cambia el ancho)
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setAltoTotal(el.firstElementChild?.scrollHeight || el.scrollHeight));
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="tarjeta-historial" style={{
      background: "#fff", border: "1px solid #e5e7eb", borderTop: `3px solid ${color}`, borderRadius: 10,
      padding: "12px 14px", gridColumn: ancha ? "1 / -1" : undefined, display: "flex", flexDirection: "column",
      alignSelf: "start",
    }}>
      <div className="d-flex align-items-center gap-2 mb-2" style={{ color, fontWeight: 800, fontSize: "0.78rem", letterSpacing: ".04em", textTransform: "uppercase" }}>
        <i className={`bi ${icono}`} />{nombre}
      </div>
      <div ref={caja} style={{
        position: "relative", overflow: "hidden",
        height: abierta && altoTotal ? altoTotal : ALTO,
        transition: "height .35s ease",
      }}>
        <div>{children}</div>
        {sobra && !abierta && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 48, background: "linear-gradient(rgba(255,255,255,0), #fff)", pointerEvents: "none" }} />
        )}
      </div>
      {/* El renglón del botón siempre ocupa su lugar: así todas las tarjetas miden igual */}
      <button type="button" onClick={() => setAbierta((a) => !a)}
        tabIndex={sobra ? 0 : -1} aria-hidden={sobra ? undefined : true}
        style={{
          visibility: sobra ? "visible" : "hidden", alignSelf: "flex-start", marginTop: 6, padding: 0,
          border: "none", background: "none", color, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
        }}>
        {abierta ? "Ver menos" : "Ver más"}
        <i className="bi bi-chevron-down ms-1" style={{ display: "inline-block", transition: "transform .3s", transform: abierta ? "rotate(180deg)" : "none" }} />
      </button>
    </div>
  );
}
