/* global __BUILD_ID__ */
/**
 * Aviso «Hay una nueva versión» con el botón Actualizar.
 *
 * Cada compilación (deploy) genera /version.json con un identificador único, y ese mismo
 * identificador queda dentro del código de la app abierta (__BUILD_ID__). Aquí se compara
 * cada pocos minutos y al volver a la pestaña: si ya no coinciden, hay una versión nueva.
 * «Actualizar» recarga la página; «Después» lo vuelve a mostrar en 30 minutos, para no
 * interrumpir una consulta que se está escribiendo.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ID_ACTUAL = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
const CADA_MS = 3 * 60 * 1000;          // revisión periódica
const ENTRE_REVISIONES_MS = 15 * 1000;  // mínimo entre revisiones al volver a la pestaña
const POSPONER_MS = 30 * 60 * 1000;

export default function AvisoNuevaVersion() {
  const [hayNueva, setHayNueva] = useState(false);
  const [oculto, setOculto] = useState(false); // «Después»
  const ultima = useRef(0);

  const revisar = useCallback(async () => {
    if (ID_ACTUAL === "dev") return;                      // en desarrollo no hay versiones
    const ahora = Date.now();
    if (ahora - ultima.current < ENTRE_REVISIONES_MS) return;
    ultima.current = ahora;
    try {
      const r = await fetch(`/version.json?t=${ahora}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      if (j?.id && j.id !== ID_ACTUAL) setHayNueva(true);
    } catch { /* sin conexión o respuesta que no es la versión: se vuelve a intentar luego */ }
  }, []);

  useEffect(() => {
    const t0 = setTimeout(revisar, 20000);
    const iv = setInterval(revisar, CADA_MS);
    const alVolver = () => { if (document.visibilityState === "visible") revisar(); };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", revisar);
    return () => {
      clearTimeout(t0); clearInterval(iv);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", revisar);
    };
  }, [revisar]);

  // Al pasar el tiempo de «Después», el aviso vuelve a aparecer
  useEffect(() => {
    if (!oculto) return undefined;
    const t = setTimeout(() => setOculto(false), POSPONER_MS);
    return () => clearTimeout(t);
  }, [oculto]);

  if (!hayNueva || oculto) return null;

  const actualizar = () => {
    // El service worker no guarda pantallas en caché: recargar trae siempre lo último
    window.location.reload();
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="nv-titulo"
      style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(8,15,30,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "nvFondo .25s ease" }}>
      <style>{`
        @keyframes nvFondo { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nvTarjeta { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { .nv-tarjeta, .nv-fondo { animation: none !important } }
      `}</style>
      <div className="nv-tarjeta" style={{ width: "min(100%, 420px)", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(0,0,0,.35)", overflow: "hidden", animation: "nvTarjeta .3s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ background: "linear-gradient(135deg,#1a2744,#243b72)", color: "#fff", padding: "22px 22px 18px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,.14)", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>
            <i className="bi bi-arrow-repeat" />
          </div>
          <h5 id="nv-titulo" style={{ margin: 0, fontWeight: 800 }}>Hay una nueva versión</h5>
        </div>
        <div style={{ padding: "18px 22px 20px" }}>
          <p style={{ margin: "0 0 10px", color: "#374151", fontSize: "0.93rem" }}>
            Actualiza Medic-KG para tener las últimas mejoras y correcciones. Solo toma un momento.
          </p>
          <p style={{ margin: "0 0 16px", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 10px", fontSize: "0.8rem" }}>
            <i className="bi bi-exclamation-triangle me-1" />Si está escribiendo una consulta, guárdela antes de actualizar.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-outline-secondary" style={{ flex: "1 1 120px", fontWeight: 600 }} onClick={() => setOculto(true)}>
              Después
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: "2 1 160px", fontWeight: 700 }} onClick={actualizar} autoFocus>
              <i className="bi bi-arrow-clockwise me-1" />Actualizar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
