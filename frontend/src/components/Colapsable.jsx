/**
 * Colapsable — contenedor de acordeón con animación suave (alto + desvanecido).
 *
 * Uso: <Colapsable abierto={abierto}>…contenido…</Colapsable>
 * El contenido queda montado: no se pierde lo escrito ni se vuelve a cargar al abrir.
 * Anima con grid-template-rows (0fr → 1fr), que funciona con cualquier alto sin medirlo.
 * Cerrado, el contenido se oculta del teclado y de los lectores de pantalla.
 * Respeta «reducir movimiento» del sistema. Para el icono de la flecha usar <FlechaGiro />.
 */
const MS = 280;

export default function Colapsable({ abierto, children, duracion = MS }) {
  return (
    <div
      className="colapsable"
      aria-hidden={!abierto}
      style={{
        display: "grid",
        gridTemplateRows: abierto ? "1fr" : "0fr",
        opacity: abierto ? 1 : 0,
        visibility: abierto ? "visible" : "hidden",
        transition: `grid-template-rows ${duracion}ms cubic-bezier(.4,0,.2,1), opacity ${duracion}ms ease, visibility 0s linear ${abierto ? 0 : duracion}ms`,
      }}
    >
      <style>{"@media (prefers-reduced-motion: reduce){.colapsable,.flecha-giro{transition:none!important}}"}</style>
      <div style={{ minHeight: 0, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

/** Flecha (chevron) que gira suavemente al abrir/cerrar en lugar de cambiar de icono */
export function FlechaGiro({ abierto, style }) {
  return (
    <i
      className="bi bi-chevron-down flecha-giro"
      style={{ display: "inline-block", transition: `transform ${MS}ms cubic-bezier(.4,0,.2,1)`, transform: abierto ? "rotate(180deg)" : "none", ...style }}
    />
  );
}
