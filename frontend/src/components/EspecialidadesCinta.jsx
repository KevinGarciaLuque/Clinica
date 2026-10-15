// Cinta de especialidades para fondos oscuros: chips con icono y nombre que
// circulan sin fin de derecha a izquierda. Se pausa al pasar el mouse.
// Con prefers-reduced-motion no se mueve solo y se desliza a mano.

const SEG_POR_CHIP = 2.6;

const CSS = `
  .ec-marquee { position: relative; overflow: hidden; padding: 6px 0;
    -webkit-mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
            mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent); }
  .ec-track { display: flex; gap: 10px; width: max-content; animation: ecScroll var(--ec-dur) linear infinite; }
  .ec-marquee:hover .ec-track { animation-play-state: paused; }
  @keyframes ecScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .ec-chip { display: inline-flex; align-items: center; gap: 9px; white-space: nowrap; padding: 9px 16px 9px 10px;
    border-radius: 999px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
    color: rgba(255,255,255,.88); font-size: 13.5px; font-weight: 600;
    transition: background .2s ease, border-color .2s ease, transform .2s ease; }
  .ec-chip:hover { background: color-mix(in srgb, var(--c) 18%, transparent); border-color: color-mix(in srgb, var(--c) 55%, transparent); transform: translateY(-2px); }
  .ec-ico { width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--c) 22%, transparent); color: var(--c); font-size: 14px; }
  @media (prefers-reduced-motion: reduce) {
    .ec-marquee { overflow-x: auto; -webkit-mask-image: none; mask-image: none; }
    .ec-track { animation: none; }
  }
`;

export default function EspecialidadesCinta({ items }) {
  if (!items?.length) return null;
  const pista = [...items, ...items];
  return (
    <div className="ec-marquee">
      <style>{CSS}</style>
      <div className="ec-track" style={{ "--ec-dur": `${items.length * SEG_POR_CHIP}s` }}>
        {pista.map((esp, i) => (
          <span key={`${esp.label}-${i}`} className="ec-chip" style={{ "--c": esp.color }} aria-hidden={i >= items.length || undefined}>
            <span className="ec-ico"><i className={`bi ${esp.icon}`} /></span>
            {esp.label}
          </span>
        ))}
      </div>
    </div>
  );
}
