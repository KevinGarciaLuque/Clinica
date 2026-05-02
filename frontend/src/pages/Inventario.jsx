import { useState, useEffect, useCallback } from "react";
import api from "../api/api";

/* ─── Colores ─────────────────────────────────────────────────────── */
const C = {
  accent:   "#2196f3",
  success:  "#22c55e",
  warning:  "#f59e0b",
  danger:   "#ef4444",
  muted:    "#6b7280",
  border:   "rgba(0,0,0,0.09)",
  bg:       "#f0f2f5",
  card:     "#ffffff",
};

const CATEGORIAS_DEFAULT = [
  "Medicamento", "Insumo quirúrgico", "Material de curación",
  "Equipo / dispositivo", "Producto cosmético", "Limpieza y asepsia", "Otro",
];

const UNIDADES = ["unidad", "caja", "frasco", "ampolla", "rollo", "litro", "gramo", "paquete"];

/* ─── Badge de stock ──────────────────────────────────────────────── */
function StockBadge({ actual, minimo }) {
  const n = Number(actual);
  const m = Number(minimo);
  const color = n === 0 ? C.danger : n <= m ? C.warning : C.success;
  const label = n === 0 ? "Sin stock" : n <= m ? "Stock bajo" : "OK";
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}55`,
      borderRadius: 20, padding: "2px 9px", fontSize: "0.72rem", fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      {n} <span style={{ opacity: 0.7, fontWeight: 400 }}>({label})</span>
    </span>
  );
}

/* ─── Modal ítem ──────────────────────────────────────────────────── */
function ModalItem({ item, onClose, onSaved }) {
  const isNew = !item?.id;
  const [form, setForm] = useState({
    nombre:        item?.nombre        || "",
    descripcion:   item?.descripcion   || "",
    categoria:     item?.categoria     || "",
    unidad_medida: item?.unidad_medida || "unidad",
    stock_actual:  item?.stock_actual  || 0,
    stock_minimo:  item?.stock_minimo  || 0,
    precio_costo:  item?.precio_costo  || "",
    proveedor:     item?.proveedor     || "",
    codigo:        item?.codigo        || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const guardar = async () => {
    if (!form.nombre.trim()) { setErr("El nombre es obligatorio"); return; }
    setSaving(true); setErr("");
    try {
      if (isNew) {
        await api.post("/inventario", form);
      } else {
        await api.put(`/inventario/${item.id}`, form);
      }
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.msg || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: "#1a2744", color: "#fff" }}>
            <h5 className="modal-title">
              <i className={`bi ${isNew ? "bi-plus-circle" : "bi-pencil"} me-2`} />
              {isNew ? "Nuevo ítem" : "Editar ítem"}
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">
            {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}
            <div className="row g-3">
              <div className="col-12 col-md-8">
                <label className="form-label fw-semibold">Nombre *</label>
                <input className="form-control" value={form.nombre} onChange={set("nombre")} placeholder="Ej. Guantes de látex talla M" />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label fw-semibold">Código / SKU</label>
                <input className="form-control" value={form.codigo} onChange={set("codigo")} placeholder="Ej. GLT-M-001" />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Descripción</label>
                <textarea className="form-control" rows={2} value={form.descripcion} onChange={set("descripcion")} />
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label fw-semibold">Categoría</label>
                <input className="form-control" list="cats-list" value={form.categoria} onChange={set("categoria")} placeholder="Seleccionar o escribir" />
                <datalist id="cats-list">
                  {CATEGORIAS_DEFAULT.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label fw-semibold">Unidad de medida</label>
                <select className="form-select" value={form.unidad_medida} onChange={set("unidad_medida")}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-4">
                <label className="form-label fw-semibold">Precio costo</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.precio_costo} onChange={set("precio_costo")} placeholder="0.00" />
              </div>
              {isNew && (
                <div className="col-6 col-md-4">
                  <label className="form-label fw-semibold">Stock inicial</label>
                  <input className="form-control" type="number" min="0" step="0.01" value={form.stock_actual} onChange={set("stock_actual")} />
                </div>
              )}
              <div className="col-6 col-md-4">
                <label className="form-label fw-semibold">Stock mínimo</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.stock_minimo} onChange={set("stock_minimo")} />
              </div>
              <div className="col-12 col-md-8">
                <label className="form-label fw-semibold">Proveedor</label>
                <input className="form-control" value={form.proveedor} onChange={set("proveedor")} placeholder="Nombre del proveedor" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
              {saving ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2 me-1" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal movimiento ────────────────────────────────────────────── */
function ModalMovimiento({ item, onClose, onSaved }) {
  const [tipo,      setTipo]      = useState("ENTRADA");
  const [cantidad,  setCantidad]  = useState("");
  const [motivo,    setMotivo]    = useState("");
  const [referencia,setReferencia]= useState("");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  const TIPOS = [
    { v: "ENTRADA",  label: "Entrada",  icon: "bi-arrow-down-circle-fill",  color: C.success },
    { v: "SALIDA",   label: "Salida",   icon: "bi-arrow-up-circle-fill",    color: C.danger  },
    { v: "AJUSTE",   label: "Ajuste",   icon: "bi-sliders",                 color: C.warning },
  ];

  const guardar = async () => {
    if (!cantidad || Number(cantidad) <= 0) { setErr("Ingresa una cantidad válida"); return; }
    setSaving(true); setErr("");
    try {
      await api.post(`/inventario/${item.id}/movimiento`, { tipo, cantidad: Number(cantidad), motivo, referencia });
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.msg || "Error al registrar movimiento");
    } finally {
      setSaving(false);
    }
  };

  const sel = TIPOS.find(t => t.v === tipo);

  return (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: "#1a2744", color: "#fff" }}>
            <h5 className="modal-title">
              <i className="bi bi-arrow-left-right me-2" />
              Registrar movimiento — {item.nombre}
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">
            {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}
            <p className="text-muted small mb-3">
              Stock actual: <strong>{item.stock_actual} {item.unidad_medida}</strong>
            </p>
            <div className="d-flex gap-2 mb-3">
              {TIPOS.map(t => (
                <button
                  key={t.v}
                  className="btn btn-sm flex-fill"
                  style={{
                    background: tipo === t.v ? t.color + "22" : "#f8f9fa",
                    border: `2px solid ${tipo === t.v ? t.color : C.border}`,
                    color: tipo === t.v ? t.color : "#555",
                    fontWeight: 600,
                  }}
                  onClick={() => setTipo(t.v)}
                >
                  <i className={`bi ${t.icon} me-1`} />{t.label}
                </button>
              ))}
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">
                {tipo === "AJUSTE" ? "Nuevo stock total" : "Cantidad"}
              </label>
              <input
                className="form-control"
                type="number" min="0.01" step="0.01"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                placeholder={tipo === "AJUSTE" ? "Ej. 50" : "Ej. 10"}
                autoFocus
              />
              {tipo === "AJUSTE" && (
                <div className="form-text" style={{ color: sel.color }}>
                  El stock se ajustará al valor indicado, sin importar el stock actual.
                </div>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Motivo</label>
              <input className="form-control" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. Compra, Uso en procedimiento, Vencimiento..." />
            </div>
            <div>
              <label className="form-label fw-semibold">Referencia (factura, orden, etc.)</label>
              <input className="form-control" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={guardar} disabled={saving}>
              {saving ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2 me-1" />}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal historial ─────────────────────────────────────────────── */
function ModalHistorial({ item, onClose }) {
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/inventario/${item.id}/movimientos`)
      .then(r => setMovs(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [item.id]);

  const colorTipo = { ENTRADA: C.success, SALIDA: C.danger, AJUSTE: C.warning };
  const iconTipo  = { ENTRADA: "bi-arrow-down-circle-fill", SALIDA: "bi-arrow-up-circle-fill", AJUSTE: "bi-sliders" };

  return (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: "#1a2744", color: "#fff" }}>
            <h5 className="modal-title">
              <i className="bi bi-clock-history me-2" />
              Historial — {item.nombre}
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body p-0">
            {loading ? (
              <div className="text-center py-4"><span className="spinner-border text-primary" /></div>
            ) : movs.length === 0 ? (
              <div className="text-center py-4 text-muted">Sin movimientos registrados</div>
            ) : (
              <table className="table table-sm table-hover mb-0">
                <thead style={{ background: "#f8f9fa" }}>
                  <tr>
                    <th>Fecha</th><th>Tipo</th><th>Cantidad</th>
                    <th>Stock antes → después</th><th>Motivo</th><th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movs.map(m => (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                        {new Date(m.creado_en).toLocaleString("es")}
                      </td>
                      <td>
                        <span style={{ color: colorTipo[m.tipo], fontWeight: 600, fontSize: "0.8rem" }}>
                          <i className={`bi ${iconTipo[m.tipo]} me-1`} />{m.tipo}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{m.cantidad}</td>
                      <td style={{ fontSize: "0.8rem" }}>{m.stock_antes} → <strong>{m.stock_despues}</strong></td>
                      <td style={{ fontSize: "0.8rem" }}>{m.motivo || "—"}</td>
                      <td style={{ fontSize: "0.8rem" }}>{m.usu_nombres} {m.usu_apellidos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Página principal
═══════════════════════════════════════════════════════════════════ */
export default function Inventario() {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [q,          setQ]          = useState("");
  const [catFilter,  setCatFilter]  = useState("");
  const [bajoStock,  setBajoStock]  = useState(false);
  const [categorias, setCategorias] = useState([]);

  const [modalItem,  setModalItem]  = useState(null); // null | {} | item
  const [modalMov,   setModalMov]   = useState(null); // item | null
  const [modalHist,  setModalHist]  = useState(null); // item | null
  const [confirmDel, setConfirmDel] = useState(null); // item | null
  const [deleting,   setDeleting]   = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = {};
    if (q.trim())      params.q = q.trim();
    if (catFilter)     params.categoria = catFilter;
    if (bajoStock)     params.bajo_stock = "1";
    Promise.all([
      api.get("/inventario", { params }),
      api.get("/inventario/categorias"),
    ])
      .then(([r1, r2]) => {
        setItems(r1.data.data || []);
        setCategorias(r2.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q, catFilter, bajoStock]);

  useEffect(() => {
    const t = setTimeout(cargar, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [cargar, q]);

  const eliminar = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await api.delete(`/inventario/${confirmDel.id}`);
      setConfirmDel(null);
      cargar();
    } catch (e) {
      alert(e.response?.data?.msg || "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const bajoStockCount = items.filter(i => Number(i.stock_actual) <= Number(i.stock_minimo)).length;

  return (
    <>
      <style>{`
        .inv-root { background: ${C.bg}; min-height: 100vh; margin: -1.5rem; width: calc(100% + 3rem); }
        .inv-header { background: linear-gradient(135deg, #1a2744 0%, #243b72 100%); padding: 20px 24px; color: #fff; }
        .inv-body { padding: 20px 24px; }
        .inv-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.06); border: 1px solid ${C.border}; }
        .inv-row { border-bottom: 1px solid ${C.border}; transition: background .12s; }
        .inv-row:last-child { border-bottom: none; }
        .inv-row:hover { background: #f8faff; }
        @media (max-width: 600px) { .inv-body { padding: 12px; } }
      `}</style>

      <div className="inv-root">
        {/* Header */}
        <div className="inv-header">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h4 className="mb-0 fw-bold">
                <i className="bi bi-boxes me-2" />
                Inventario
              </h4>
              <p className="mb-0 opacity-75" style={{ fontSize: "0.84rem" }}>
                Control de stock de insumos y materiales
              </p>
            </div>
            <button
              className="btn btn-sm"
              style={{ background: C.accent, color: "#fff", fontWeight: 600 }}
              onClick={() => setModalItem({})}
            >
              <i className="bi bi-plus-lg me-1" />
              Nuevo ítem
            </button>
          </div>

          {/* Stats rápidas */}
          <div className="d-flex gap-3 mt-3 flex-wrap">
            {[
              { label: "Total ítems", value: items.length,    icon: "bi-box-seam",         bg: "#2196f322" },
              { label: "Bajo stock",  value: bajoStockCount,  icon: "bi-exclamation-triangle-fill", bg: "#f59e0b22", color: C.warning },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg || "rgba(255,255,255,.1)", borderRadius: 10, padding: "8px 16px", minWidth: 110 }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: s.color || "#fff" }}>
                  <i className={`bi ${s.icon} me-1`} style={{ fontSize: "1rem" }} />
                  {s.value}
                </div>
                <div style={{ fontSize: "0.73rem", opacity: 0.8 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="inv-body">
          {/* Filtros */}
          <div className="d-flex gap-2 flex-wrap mb-3">
            <input
              className="form-control form-control-sm"
              style={{ maxWidth: 260 }}
              placeholder="Buscar por nombre o código..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 200 }}
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              className="btn btn-sm"
              style={{
                background: bajoStock ? C.warning + "22" : "#f8f9fa",
                border: `1px solid ${bajoStock ? C.warning : C.border}`,
                color: bajoStock ? C.warning : "#555",
                fontWeight: 600,
              }}
              onClick={() => setBajoStock(b => !b)}
            >
              <i className="bi bi-exclamation-triangle me-1" />
              Bajo stock
            </button>
          </div>

          {/* Tabla */}
          <div className="inv-card">
            {loading ? (
              <div className="text-center py-5"><span className="spinner-border text-primary" /></div>
            ) : items.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-boxes" style={{ fontSize: "2.5rem", opacity: 0.3 }} />
                <p className="mt-2 mb-0">No hay ítems{q || catFilter || bajoStock ? " con esos filtros" : ""}.</p>
                {!q && !catFilter && !bajoStock && (
                  <button className="btn btn-sm btn-primary mt-3" onClick={() => setModalItem({})}>
                    <i className="bi bi-plus-lg me-1" />Agregar primer ítem
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="d-none d-md-block">
                  <table className="table table-sm mb-0">
                    <thead style={{ background: "#f8f9fa" }}>
                      <tr>
                        <th>Nombre</th>
                        <th>Categoría</th>
                        <th>Stock</th>
                        <th>Unidad</th>
                        <th>Proveedor</th>
                        <th style={{ textAlign: "right" }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(it => (
                        <tr key={it.id} className="inv-row">
                          <td>
                            <div style={{ fontWeight: 500 }}>{it.nombre}</div>
                            {it.codigo && <div style={{ fontSize: "0.75rem", color: C.muted }}>{it.codigo}</div>}
                          </td>
                          <td style={{ fontSize: "0.82rem" }}>{it.categoria || <span className="text-muted">—</span>}</td>
                          <td><StockBadge actual={it.stock_actual} minimo={it.stock_minimo} /></td>
                          <td style={{ fontSize: "0.82rem" }}>{it.unidad_medida}</td>
                          <td style={{ fontSize: "0.82rem" }}>{it.proveedor || <span className="text-muted">—</span>}</td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button className="btn btn-xs btn-outline-success me-1" title="Entrada/Salida" onClick={() => setModalMov(it)}>
                              <i className="bi bi-arrow-left-right" />
                            </button>
                            <button className="btn btn-xs btn-outline-secondary me-1" title="Historial" onClick={() => setModalHist(it)}>
                              <i className="bi bi-clock-history" />
                            </button>
                            <button className="btn btn-xs btn-outline-primary me-1" title="Editar" onClick={() => setModalItem(it)}>
                              <i className="bi bi-pencil" />
                            </button>
                            <button className="btn btn-xs btn-outline-danger" title="Eliminar" onClick={() => setConfirmDel(it)}>
                              <i className="bi bi-trash" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="d-md-none">
                  {items.map(it => (
                    <div key={it.id} className="inv-row p-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div style={{ fontWeight: 600 }}>{it.nombre}</div>
                          {it.codigo && <div style={{ fontSize: "0.75rem", color: C.muted }}>{it.codigo}</div>}
                          {it.categoria && <div style={{ fontSize: "0.78rem", color: C.muted }}>{it.categoria}</div>}
                        </div>
                        <StockBadge actual={it.stock_actual} minimo={it.stock_minimo} />
                      </div>
                      <div className="d-flex gap-1 mt-2">
                        <button className="btn btn-xs btn-outline-success flex-fill" onClick={() => setModalMov(it)}>
                          <i className="bi bi-arrow-left-right me-1" />Mover
                        </button>
                        <button className="btn btn-xs btn-outline-secondary flex-fill" onClick={() => setModalHist(it)}>
                          <i className="bi bi-clock-history me-1" />Historial
                        </button>
                        <button className="btn btn-xs btn-outline-primary" onClick={() => setModalItem(it)}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button className="btn btn-xs btn-outline-danger" onClick={() => setConfirmDel(it)}>
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      {modalItem !== null && (
        <ModalItem
          item={modalItem?.id ? modalItem : null}
          onClose={() => setModalItem(null)}
          onSaved={() => { setModalItem(null); cargar(); }}
        />
      )}
      {modalMov && (
        <ModalMovimiento
          item={modalMov}
          onClose={() => setModalMov(null)}
          onSaved={() => { setModalMov(null); cargar(); }}
        />
      )}
      {modalHist && (
        <ModalHistorial item={modalHist} onClose={() => setModalHist(null)} />
      )}

      {/* Confirmar eliminar */}
      {confirmDel && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.45)" }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-body text-center py-4">
                <i className="bi bi-exclamation-triangle-fill text-danger" style={{ fontSize: "2rem" }} />
                <p className="mt-2 mb-1 fw-semibold">¿Eliminar «{confirmDel.nombre}»?</p>
                <p className="text-muted small mb-3">Se eliminarán también todos sus movimientos.</p>
                <div className="d-flex gap-2 justify-content-center">
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDel(null)}>Cancelar</button>
                  <button className="btn btn-danger btn-sm" onClick={eliminar} disabled={deleting}>
                    {deleting ? <span className="spinner-border spinner-border-sm" /> : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
