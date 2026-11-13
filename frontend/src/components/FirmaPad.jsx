import { useEffect, useRef, useState } from "react";

/**
 * Recuadro para firmar con el dedo (teléfono / tablet) o con el mouse.
 * onChange(dataUrl | null): PNG de la firma, o null si está vacío.
 */
export default function FirmaPad({ onChange, alto = 180 }) {
  const lienzo = useRef(null);
  const dibujando = useRef(false);
  const ultimo = useRef(null);
  const [vacio, setVacio] = useState(true);

  // Tamaño real del lienzo según el ancho en pantalla (nítido en pantallas de alta densidad)
  useEffect(() => {
    const c = lienzo.current;
    const ajustar = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (c.width === Math.round(r.width * dpr)) return;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(alto * dpr);
      const ctx = c.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.4; ctx.strokeStyle = "#111827";
      setVacio(true); onChange?.(null);
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [alto, onChange]);

  const punto = (e) => {
    const r = lienzo.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const empezar = (e) => {
    e.preventDefault();
    lienzo.current.setPointerCapture?.(e.pointerId);
    dibujando.current = true;
    ultimo.current = punto(e);
    const ctx = lienzo.current.getContext("2d");
    ctx.beginPath(); ctx.arc(ultimo.current.x, ultimo.current.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = "#111827"; ctx.fill();
  };
  const mover = (e) => {
    if (!dibujando.current) return;
    e.preventDefault();
    const p = punto(e);
    const ctx = lienzo.current.getContext("2d");
    ctx.beginPath(); ctx.moveTo(ultimo.current.x, ultimo.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ultimo.current = p;
  };
  const terminar = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    setVacio(false);
    onChange?.(lienzo.current.toDataURL("image/png"));
  };
  const borrar = () => {
    const c = lienzo.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setVacio(true); onChange?.(null);
  };

  return (
    <div>
      <div style={{ position: "relative", border: "2px dashed #cbd5e1", borderRadius: 12, background: "#fff" }}>
        <canvas ref={lienzo} aria-label="Recuadro para firmar"
          style={{ width: "100%", height: alto, display: "block", touchAction: "none", cursor: "crosshair", borderRadius: 10 }}
          onPointerDown={empezar} onPointerMove={mover} onPointerUp={terminar} onPointerLeave={terminar} onPointerCancel={terminar} />
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 34, borderTop: "1px solid #e5e7eb", pointerEvents: "none" }} />
        {vacio && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.9rem", pointerEvents: "none" }}>
            <i className="bi bi-pen me-2" />Firme aquí con el dedo
          </div>
        )}
      </div>
      <div className="d-flex justify-content-end mt-1">
        <button type="button" className="btn btn-sm btn-link text-muted p-0" onClick={borrar} disabled={vacio}>
          <i className="bi bi-eraser me-1" />Borrar y volver a firmar
        </button>
      </div>
    </div>
  );
}
