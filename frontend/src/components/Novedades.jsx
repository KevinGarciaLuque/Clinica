// ✨ Novedades: botón en la barra superior, panel lateral con las mejoras de la
// plataforma y ventana única al entrar cuando hay anuncios importantes.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useNovedades, marcarNovedadesVistas } from "../utils/novedades";

const CSS = `
  .nov-btn { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 999px;
    border: 1px solid rgba(250,204,21,.35); background: rgba(250,204,21,.08); color: #fde68a; font-weight: 700;
    font-size: 13px; cursor: pointer; position: relative; transition: background .2s, transform .2s; white-space: nowrap; }
  .nov-btn:hover { background: rgba(250,204,21,.16); transform: translateY(-1px); }
  .nov-dot { position: absolute; top: -3px; right: -3px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
    background: #ef4444; color: #fff; font-size: 10.5px; font-weight: 800; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 0 2px #0f2040; }
  .nov-btn .nov-txt { display: inline; }
  @media (max-width: 767.98px) { .nov-btn { padding: 0 10px; } .nov-btn .nov-txt { display: none; } }
  @keyframes novIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  @keyframes novFade { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
  .nov-panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(420px, 100vw); background: #fff; z-index: 2001;
    box-shadow: -12px 0 40px rgba(0,0,0,.25); display: flex; flex-direction: column; animation: novIn .25s ease; }
  .nov-item { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; gap: 12px; }
  .nov-ico { width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    background: #eef2ff; color: #4f46e5; font-size: 17px; }
`;

function Item({ n }) {
  return (
    <div className="nov-item" style={{ background: n.nueva ? "#fffbeb" : "#fff" }}>
      <div className="nov-ico"><i className={`bi ${n.icono || "bi-stars"}`} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{n.titulo}</span>
          {n.nueva && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#b45309", background: "#fef3c7", borderRadius: 999, padding: "1px 7px" }}>NUEVO</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "#94a3b8", margin: "1px 0 5px" }}>
          {n.version ? `v${n.version} · ` : ""}{dayjs(n.fecha).locale("es").format("D [de] MMMM YYYY")}
        </div>
        <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.5, whiteSpace: "pre-line" }}>{n.descripcion}</div>
        {n.imagen_url && <img src={n.imagen_url} alt="" style={{ width: "100%", borderRadius: 10, marginTop: 8, border: "1px solid #e2e8f0" }} />}
      </div>
    </div>
  );
}

function Panel({ d, onClose }) {
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 2000 }} />
      <aside className="nov-panel" role="dialog" aria-label="Novedades">
        <div style={{ padding: "16px 18px", background: "linear-gradient(135deg,#1a2744,#243b72)", color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>✨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Novedades de Medic-KG</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>Versión {d.version} · Seguimos mejorando para ti</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", color: "rgba(255,255,255,.8)", fontSize: 20, cursor: "pointer" }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {d.novedades.length === 0
            ? <div className="text-muted text-center p-4" style={{ fontSize: 14 }}>Pronto verás aquí las mejoras de la plataforma.</div>
            : d.novedades.map((n) => <Item key={n.id} n={n} />)}
        </div>
      </aside>
    </>,
    document.body
  );
}

function Anuncio({ d, ids, onClose, onVerTodo }) {
  const lista = d.novedades.filter((n) => ids.includes(n.id));
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 2002, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Lo nuevo" style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 480, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,.3)", animation: "novFade .3s ease" }}>
        <div style={{ padding: "22px 22px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>✨</div>
          <h5 style={{ fontWeight: 800, margin: "4px 0 2px", color: "#0f172a" }}>¡Hay novedades en Medic-KG!</h5>
          <div style={{ fontSize: 13, color: "#64748b" }}>Versión {d.version}</div>
        </div>
        <div style={{ overflowY: "auto" }}>{lista.map((n) => <Item key={n.id} n={{ ...n, nueva: false }} />)}</div>
        <div style={{ padding: 16, display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #f1f5f9" }}>
          <button className="btn btn-light btn-sm" onClick={onVerTodo}>Ver todas las novedades</button>
          <button className="btn btn-sm fw-semibold" onClick={onClose} style={{ background: "#1a2744", color: "#fff", borderRadius: 8, padding: "6px 18px" }}>¡Entendido!</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function NovedadesBoton() {
  const d = useNovedades();
  const [abierto, setAbierto] = useState(false);
  const [anuncioCerrado, setAnuncioCerrado] = useState(false);

  // La versión del menú lateral también abre el panel
  useEffect(() => {
    const abrir = () => setAbierto(true);
    window.addEventListener("abrir-novedades", abrir);
    return () => window.removeEventListener("abrir-novedades", abrir);
  }, []);

  if (!d) return null;
  const abrir = () => { setAbierto(true); marcarNovedadesVistas(); };
  const cerrarAnuncio = () => { setAnuncioCerrado(true); marcarNovedadesVistas(); };
  const mostrarAnuncio = !anuncioCerrado && !abierto && d.anuncio?.length > 0;

  return (
    <>
      <style>{CSS}</style>
      <button className="nov-btn" onClick={abrir} title="Novedades de la plataforma" aria-label={`Novedades${d.no_leidas ? `, ${d.no_leidas} sin ver` : ""}`}>
        <span>✨</span><span className="nov-txt">Novedades</span>
        {d.no_leidas > 0 && <span className="nov-dot">{d.no_leidas > 9 ? "9+" : d.no_leidas}</span>}
      </button>
      {abierto && <Panel d={d} onClose={() => { setAbierto(false); marcarNovedadesVistas(); }} />}
      {mostrarAnuncio && <Anuncio d={d} ids={d.anuncio} onClose={cerrarAnuncio} onVerTodo={() => { setAnuncioCerrado(true); abrir(); }} />}
    </>
  );
}
