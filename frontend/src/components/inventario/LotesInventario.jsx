import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/api";

/**
 * Lotes del inventario: lista por producto, aviso de vencimientos y
 * «¿a qué pacientes se les aplicó este lote?» (trazabilidad).
 */

const fechaCorta = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function EstadoVence({ dias, vence }) {
  if (!vence) return <span className="text-muted" style={{ fontSize: "0.78rem" }}>Sin fecha</span>;
  const d = Number(dias);
  const [bg, color, txt] = d < 0 ? ["#fee2e2", "#b91c1c", "Vencido"] : d <= 60 ? ["#fef3c7", "#b45309", `Vence en ${d} día${d === 1 ? "" : "s"}`] : ["#dcfce7", "#15803d", "Vigente"];
  return <span style={{ background: bg, color, borderRadius: 999, padding: "2px 9px", fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap" }}>{txt}</span>;
}

function Marco({ titulo, icono, onClose, children, ancho = 640 }) {
  return (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-scrollable" style={{ maxWidth: ancho }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: "#1a2744", color: "#fff" }}>
            <h5 className="modal-title" style={{ fontSize: "1rem" }}><i className={`bi ${icono} me-2`} />{titulo}</h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Lotes de un producto, con su vencimiento y a quién se aplicó cada uno */
export function ModalLotes({ item, onClose }) {
  const [lotes, setLotes] = useState(null);
  const [traza, setTraza] = useState(null); // lote abierto
  useEffect(() => {
    api.get(`/inventario/${item.id}/lotes`).then((r) => setLotes(r.data.data || [])).catch(() => setLotes([]));
  }, [item.id]);
  if (traza) return <ModalTrazabilidad loteInicial={traza} onClose={() => setTraza(null)} />;
  return (
    <Marco titulo={`Lotes — ${item.nombre}`} icono="bi-upc-scan" onClose={onClose}>
      {lotes === null ? <div className="text-center py-4"><span className="spinner-border spinner-border-sm" /></div>
        : lotes.length === 0 ? (
          <div className="text-muted text-center py-3" style={{ fontSize: "0.9rem" }}>
            Este producto no tiene lotes. Al registrar una <strong>Entrada</strong>, escriba el lote y su vencimiento.
          </div>
        ) : lotes.map((l) => (
          <div key={l.id} className="d-flex align-items-center gap-2 flex-wrap py-2" style={{ borderBottom: "1px solid #f1f5f9", opacity: Number(l.cantidad) > 0 ? 1 : 0.55 }}>
            <div style={{ flex: "1 1 160px", minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>Lote {l.lote}</div>
              <div className="text-muted" style={{ fontSize: "0.8rem" }}>Vence: {fechaCorta(l.vence)} · Quedan {Number(l.cantidad)} {item.unidad_medida}</div>
            </div>
            <EstadoVence dias={l.dias} vence={l.vence} />
            <button className="btn btn-sm btn-outline-primary" onClick={() => setTraza(l.lote)}>
              <i className="bi bi-people me-1" />¿A quién se aplicó?
            </button>
          </div>
        ))}
    </Marco>
  );
}

/** Buscar un lote y ver a qué pacientes se les aplicó (también lotes escritos a mano) */
export function ModalTrazabilidad({ loteInicial = "", onClose }) {
  const [lote, setLote] = useState(loteInicial);
  const [buscado, setBuscado] = useState(loteInicial);
  const [filas, setFilas] = useState(null);
  useEffect(() => {
    if (String(buscado).trim().length < 2) return undefined;
    let vivo = true;
    api.get("/inventario/lotes/trazabilidad", { params: { lote: buscado } })
      .then((r) => { if (vivo) setFilas(r.data.data || []); })
      .catch(() => { if (vivo) setFilas([]); });
    return () => { vivo = false; };
  }, [buscado]);
  const pacientes = new Set((filas || []).map((f) => f.paciente_id)).size;
  return (
    <Marco titulo="¿A quién se aplicó este lote?" icono="bi-search" onClose={onClose} ancho={720}>
      <form className="d-flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); setFilas(null); setBuscado(lote.trim()); }}>
        <input className="form-control" placeholder="Número de lote (ej.: C1234A)" value={lote} onChange={(e) => setLote(e.target.value)} autoFocus={!loteInicial} />
        <button className="btn btn-primary" disabled={lote.trim().length < 2}><i className="bi bi-search" /></button>
      </form>
      {String(buscado).trim().length < 2 ? (
        <div className="text-muted" style={{ fontSize: "0.88rem" }}>
          Útil si sale una alerta sanitaria de un producto: escriba el lote y verá los pacientes, la fecha y la cantidad aplicada.
        </div>
      ) : filas === null ? <div className="text-center py-3"><span className="spinner-border spinner-border-sm" /></div>
        : filas.length === 0 ? <div className="text-muted text-center py-3">No hay aplicaciones registradas con ese lote.</div>
        : (
          <>
            <div className="mb-2" style={{ fontWeight: 700 }}>{pacientes} paciente{pacientes === 1 ? "" : "s"} · {filas.length} aplicación{filas.length === 1 ? "" : "es"}</div>
            {filas.map((f) => (
              <div key={f.id} className="d-flex align-items-center gap-2 flex-wrap py-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <Link to={`/pacientes/${f.paciente_id}/perfil?tab=estetica`} style={{ fontWeight: 700 }}>{f.nombres} {f.apellidos}</Link>
                  <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                    {fechaCorta(f.fecha)} · {f.producto || "Producto"} · lote {f.lote}{Number(f.cantidad) ? ` · ${Number(f.cantidad)} ${f.unidad || ""}` : ""}
                  </div>
                </div>
                {f.telefono && (
                  <a className="btn btn-sm btn-outline-success" href={`tel:${String(f.telefono).replace(/[^\d+]/g, "")}`}>
                    <i className="bi bi-telephone me-1" />{f.telefono}
                  </a>
                )}
              </div>
            ))}
          </>
        )}
    </Marco>
  );
}

/** Aviso arriba del inventario: lotes vencidos o que vencen en 60 días */
export function AvisoVencimientos({ onVer }) {
  const [lotes, setLotes] = useState([]);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    api.get("/inventario/lotes/alertas").then((r) => setLotes(r.data.data || [])).catch(() => {});
  }, []);
  if (!lotes.length) return null;
  const vencidos = lotes.filter((l) => Number(l.dias) < 0).length;
  return (
    <div className="mb-3" style={{ background: vencidos ? "#fef2f2" : "#fffbeb", border: `1px solid ${vencidos ? "#fecaca" : "#fde68a"}`, borderRadius: 12, padding: "10px 14px" }}>
      <button type="button" className="d-flex align-items-center gap-2 w-100 p-0 border-0 bg-transparent text-start" onClick={() => setAbierto((a) => !a)}>
        <i className="bi bi-calendar-x" style={{ color: vencidos ? "#b91c1c" : "#b45309", fontSize: "1.1rem" }} />
        <span className="flex-grow-1" style={{ fontWeight: 700, color: "#1f2937", fontSize: "0.9rem" }}>
          {vencidos ? `${vencidos} lote${vencidos === 1 ? "" : "s"} vencido${vencidos === 1 ? "" : "s"}` : ""}
          {vencidos && lotes.length - vencidos ? " y " : ""}
          {lotes.length - vencidos ? `${lotes.length - vencidos} por vencer en los próximos 60 días` : ""}
        </span>
        <i className={`bi bi-chevron-${abierto ? "up" : "down"} text-muted`} />
      </button>
      {abierto && (
        <div className="mt-2">
          {lotes.map((l) => (
            <div key={l.id} className="d-flex align-items-center gap-2 flex-wrap py-1" style={{ fontSize: "0.85rem" }}>
              <span style={{ flex: "1 1 180px" }}><strong>{l.nombre}</strong> · lote {l.lote} · quedan {Number(l.cantidad)} {l.unidad_medida}</span>
              <span className="text-muted">{fechaCorta(l.vence)}</span>
              <EstadoVence dias={l.dias} vence={l.vence} />
              {onVer && <button className="btn btn-sm btn-link p-0" onClick={() => onVer(l.item_id)}>Ver</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
