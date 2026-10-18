import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import api from "../api/api";
import { hoyClinica } from "../utils/zonaClinica";
import { cargarSucursales, getSucursalActiva } from "../utils/sucursalActiva";

// Finanzas: ingresos (pagos de Facturación), gastos de la clínica, ganancia y cuentas por cobrar.

const C_ING = "#2a78d6"; // ingresos (azul)
const C_GAS = "#eb6834"; // gastos (naranja)
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const METODOS = [["EFECTIVO", "Efectivo"], ["TARJETA", "Tarjeta"], ["TRANSFERENCIA", "Transferencia"], ["CHEQUE", "Cheque"], ["OTRO", "Otro"]];
const NOMBRE_METODO = { ...Object.fromEntries(METODOS), SEGURO: "Seguro" };

const fmtL = (n) => `L ${Number(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtCorto = (n) => {
  const v = Math.abs(Number(n || 0));
  const s = v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k` : String(Math.round(v));
  return `${n < 0 ? "-" : ""}L ${s}`;
};
const fechaTxt = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const nombreMes = (m, conAnio = true) => {
  const [y, mm] = m.split("-").map(Number);
  return `${MESES[mm - 1]}${conAnio ? ` ${y}` : ""}`;
};
const mesMas = (m, n) => {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(y, mm - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const rangoMes = (m) => {
  const [y, mm] = m.split("-").map(Number);
  return { desde: `${m}-01`, hasta: `${m}-${String(new Date(y, mm, 0).getDate()).padStart(2, "0")}` };
};

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const f = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return m;
}

const tarjeta = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(15,23,42,.06)", padding: "16px 18px" };

/** Variación contra el mes anterior: ▲ 12% / ▼ 5% (con texto, no solo color) */
function Variacion({ actual, anterior, bueno = "sube" }) {
  if (!anterior) return <span className="text-muted">Sin datos del mes anterior</span>;
  const pct = Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
  if (pct === 0) return <span className="text-muted">Igual que el mes anterior</span>;
  const sube = pct > 0;
  const favorable = bueno === "sube" ? sube : !sube;
  return (
    <span style={{ color: favorable ? "#15803d" : "#b91c1c" }}>
      <i className={`bi ${sube ? "bi-arrow-up-right" : "bi-arrow-down-right"} me-1`} />
      {sube ? "+" : ""}{pct}% vs. mes anterior
    </span>
  );
}

function Indicador({ titulo, valor, icono, tono, children }) {
  return (
    <div style={{ ...tarjeta, padding: "14px 16px", height: "100%" }}>
      <div className="d-flex align-items-center gap-2 mb-1" style={{ color: "#475569", fontSize: ".82rem", fontWeight: 600 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: tono.fondo, color: tono.color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <i className={`bi ${icono}`} />
        </span>
        {titulo}
      </div>
      <div style={{ fontSize: "clamp(1.02rem, 4.6vw, 1.45rem)", fontWeight: 800, color: "#0f172a", lineHeight: 1.2, whiteSpace: "nowrap" }}>{valor}</div>
      <div style={{ fontSize: ".76rem", marginTop: 4 }}>{children}</div>
    </div>
  );
}

function TooltipMes({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const ing = payload.find((p) => p.dataKey === "ingresos")?.value || 0;
  const gas = payload.find((p) => p.dataKey === "gastos")?.value || 0;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", boxShadow: "0 6px 20px rgba(15,23,42,.12)", fontSize: ".8rem" }}>
      <div className="fw-bold mb-1 text-capitalize">{label}</div>
      <div><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C_ING, marginRight: 6 }} />Ingresos: <strong>{fmtL(ing)}</strong></div>
      <div><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C_GAS, marginRight: 6 }} />Gastos: <strong>{fmtL(gas)}</strong></div>
      <div className="mt-1" style={{ color: "#334155" }}>Ganancia: <strong>{fmtL(ing - gas)}</strong></div>
    </div>
  );
}

// ── Formulario de gasto ──────────────────────────────────────────────────────
function ModalGasto({ inicial, categorias, onCerrar, onGuardado, onNuevaCategoria }) {
  const [f, setF] = useState(() => inicial || { descripcion: "", monto: "", fecha: hoyClinica(), categoria_id: "", metodo: "EFECTIVO", proveedor: "", comprobante: "", fijo: false, notas: "" });
  // Sucursal del gasto (solo clínicas con varias): la del gasto, la elegida arriba o la principal
  const [sucursales, setSucursales] = useState([]);
  useEffect(() => {
    cargarSucursales(api).then((d) => {
      if (!d.multiple) return;
      setSucursales(d.sucursales);
      setF((x) => (x.sucursal_id ? { ...x, sucursal_id: String(x.sucursal_id) }
        : { ...x, sucursal_id: String(getSucursalActiva() || d.sucursales.find((s) => s.es_principal)?.id || d.sucursales[0]?.id || "") }));
    });
  }, []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [nuevaCat, setNuevaCat] = useState(null);
  const cambiar = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError("");
    try {
      if (f.id) await api.put(`/finanzas/gastos/${f.id}`, f);
      else await api.post("/finanzas/gastos", f);
      onGuardado(f.id ? "Gasto actualizado." : "Gasto registrado.");
    } catch (err) {
      setError(err.response?.data?.msg || "No se pudo guardar el gasto.");
    } finally {
      setGuardando(false);
    }
  };

  const crearCategoria = async () => {
    if (!nuevaCat?.trim()) return;
    try {
      const id = await onNuevaCategoria(nuevaCat.trim());
      setF((x) => ({ ...x, categoria_id: String(id) }));
      setNuevaCat(null);
    } catch {
      setError("No se pudo crear la categoría.");
    }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <form onSubmit={guardar} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "94vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div className="d-flex align-items-center justify-content-between px-3 py-3" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div className="fw-bold"><i className="bi bi-wallet2 me-2" style={{ color: C_GAS }} />{f.id ? "Editar gasto" : "Nuevo gasto"}</div>
          <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCerrar} />
        </div>
        <div className="p-3">
          {error && <div className="alert alert-danger py-2 small">{error}</div>}
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label small fw-semibold mb-1">¿En qué se gastó? *</label>
              <input className="form-control" value={f.descripcion} onChange={cambiar("descripcion")} maxLength={250} placeholder="Ej. Alquiler del local, compra de guantes…" autoFocus required />
            </div>
            <div className="col-6">
              <label className="form-label small fw-semibold mb-1">Monto (L) *</label>
              <input className="form-control" type="number" inputMode="decimal" min="0.01" step="0.01" value={f.monto} onChange={cambiar("monto")} required />
            </div>
            <div className="col-6">
              <label className="form-label small fw-semibold mb-1">Fecha *</label>
              <input className="form-control" type="date" value={f.fecha} onChange={cambiar("fecha")} required />
            </div>
            <div className="col-12 col-sm-7">
              <label className="form-label small fw-semibold mb-1">Categoría</label>
              {nuevaCat === null ? (
                <div className="d-flex gap-1">
                  <select className="form-select" value={f.categoria_id || ""} onChange={cambiar("categoria_id")}>
                    <option value="">Sin categoría</option>
                    {categorias.filter((c) => c.activo || String(c.id) === String(f.categoria_id)).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <button type="button" className="btn btn-outline-secondary" title="Nueva categoría" onClick={() => setNuevaCat("")}><i className="bi bi-plus-lg" /></button>
                </div>
              ) : (
                <div className="d-flex gap-1">
                  <input className="form-control" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} placeholder="Nombre de la categoría" maxLength={80} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); crearCategoria(); } }} />
                  <button type="button" className="btn btn-primary" onClick={crearCategoria}>Agregar</button>
                  <button type="button" className="btn btn-light" onClick={() => setNuevaCat(null)}><i className="bi bi-x-lg" /></button>
                </div>
              )}
            </div>
            <div className="col-12 col-sm-5">
              <label className="form-label small fw-semibold mb-1">Forma de pago</label>
              <select className="form-select" value={f.metodo || ""} onChange={cambiar("metodo")}>
                {METODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {sucursales.length > 1 && (
              <div className="col-12">
                <label className="form-label small fw-semibold mb-1"><i className="bi bi-shop me-1" />Sucursal</label>
                <select className="form-select" value={f.sucursal_id || ""} onChange={cambiar("sucursal_id")}>
                  {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            )}
            <div className="col-7">
              <label className="form-label small fw-semibold mb-1">Proveedor</label>
              <input className="form-control" value={f.proveedor || ""} onChange={cambiar("proveedor")} maxLength={150} placeholder="Opcional" />
            </div>
            <div className="col-5">
              <label className="form-label small fw-semibold mb-1">N.º de factura</label>
              <input className="form-control" value={f.comprobante || ""} onChange={cambiar("comprobante")} maxLength={80} placeholder="Opcional" />
            </div>
            <div className="col-12">
              <label className="form-label small fw-semibold mb-1">Notas</label>
              <textarea className="form-control" rows={2} value={f.notas || ""} onChange={cambiar("notas")} maxLength={500} />
            </div>
            <div className="col-12">
              <div className="form-check p-2 ps-5 rounded-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <input className="form-check-input" type="checkbox" id="g-fijo" checked={!!f.fijo} onChange={cambiar("fijo")} />
                <label className="form-check-label small" htmlFor="g-fijo">
                  <strong>Gasto fijo</strong> — se repite cada mes (alquiler, sueldos, internet…). El próximo mes el sistema le ofrecerá registrarlo con un clic.
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="d-flex justify-content-end gap-2 px-3 py-3" style={{ borderTop: "1px solid #e2e8f0" }}>
          <button type="button" className="btn btn-light" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2 me-1" />}Guardar
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// ── Pestaña Resumen ──────────────────────────────────────────────────────────
function Resumen({ datos, isMobile, fijos, onRegistrarFijos, registrandoFijos, onIrPorCobrar }) {
  const serie = datos.serie.map((s) => ({ ...s, etiqueta: nombreMes(s.mes, false).slice(0, 3), nombre: nombreMes(s.mes) }));
  const maxCat = Math.max(1, ...datos.por_categoria.map((c) => c.total));
  const tonoGanancia = datos.ganancia >= 0 ? { color: "#15803d", fondo: "#dcfce7" } : { color: "#b91c1c", fondo: "#fee2e2" };

  return (
    <>
      {fijos.length > 0 && (
        <div className="alert d-flex flex-wrap align-items-center gap-2 py-2" style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 12 }}>
          <i className="bi bi-arrow-repeat fs-5" />
          <div className="flex-grow-1 small" style={{ minWidth: 200 }}>
            <strong>{fijos.length} {fijos.length === 1 ? "gasto fijo" : "gastos fijos"} del mes pasado</strong> aún sin registrar este mes:{" "}
            {fijos.slice(0, 3).map((g) => `${g.descripcion} (${fmtL(g.monto)})`).join(", ")}{fijos.length > 3 ? "…" : ""}
          </div>
          <button className="btn btn-sm btn-warning" onClick={onRegistrarFijos} disabled={registrandoFijos}>
            {registrandoFijos ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2-all me-1" />}Registrarlos
          </button>
        </div>
      )}

      <div className="row g-2 g-md-3 mb-3">
        <div className="col-6 col-lg-3">
          <Indicador titulo="Ingresos" valor={fmtL(datos.ingresos)} icono="bi-arrow-down-circle-fill" tono={{ color: C_ING, fondo: "#dbeafe" }}>
            <Variacion actual={datos.ingresos} anterior={datos.anterior.ingresos} />
          </Indicador>
        </div>
        <div className="col-6 col-lg-3">
          <Indicador titulo="Gastos" valor={fmtL(datos.gastos)} icono="bi-arrow-up-circle-fill" tono={{ color: C_GAS, fondo: "#ffedd5" }}>
            <Variacion actual={datos.gastos} anterior={datos.anterior.gastos} bueno="baja" />
          </Indicador>
        </div>
        <div className="col-6 col-lg-3">
          <Indicador titulo={datos.ganancia >= 0 ? "Ganancia" : "Pérdida"} valor={fmtL(Math.abs(datos.ganancia))} icono={datos.ganancia >= 0 ? "bi-graph-up-arrow" : "bi-graph-down-arrow"} tono={tonoGanancia}>
            <span className="text-muted">
              {datos.ganancia < 0 ? "Los gastos superaron a los ingresos" : datos.margen != null ? `Margen: ${datos.margen}% de los ingresos` : "Sin ingresos este mes"}
            </span>
          </Indicador>
        </div>
        <div className="col-6 col-lg-3">
          <button type="button" onClick={onIrPorCobrar} className="w-100 h-100 text-start border-0 p-0 bg-transparent">
            <Indicador titulo="Por cobrar" valor={fmtL(datos.por_cobrar.total)} icono="bi-hourglass-split" tono={{ color: "#a16207", fondo: "#fef9c3" }}>
              <span className="text-muted">{datos.por_cobrar.facturas} {datos.por_cobrar.facturas === 1 ? "factura pendiente" : "facturas pendientes"} · ver</span>
            </Indicador>
          </button>
        </div>
      </div>

      <div className="row g-2 g-md-3">
        <div className="col-12 col-lg-7">
          <div style={tarjeta}>
            <div className="fw-bold mb-1">Ingresos y gastos — últimos 6 meses</div>
            <div className="text-muted small mb-2">Toque una barra para ver el detalle del mes.</div>
            <div style={{ width: "100%", height: isMobile ? 220 : 260 }}>
              <ResponsiveContainer>
                <BarChart data={serie} margin={{ top: 8, right: 4, left: isMobile ? -14 : 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="etiqueta" tickLine={false} axisLine={{ stroke: "#e2e8f0" }} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis tickFormatter={fmtCorto} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={isMobile ? 56 : 64} />
                  <Tooltip content={<TooltipMes />} cursor={{ fill: "rgba(148,163,184,.12)" }} labelFormatter={(_, p) => p?.[0]?.payload?.nombre} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: "#334155" }}
                    payload={[{ value: "Ingresos", type: "square", color: C_ING, id: "ingresos" }, { value: "Gastos", type: "square", color: C_GAS, id: "gastos" }]} />
                  <Bar dataKey="ingresos" name="Ingresos" fill={C_ING} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="gastos" name="Gastos" fill={C_GAS} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div style={{ ...tarjeta, marginBottom: 12 }}>
            <div className="fw-bold mb-2">Gastos por categoría</div>
            {datos.por_categoria.length === 0 && <div className="text-muted small">No hay gastos registrados en {nombreMes(datos.mes)}.</div>}
            <div className="d-flex flex-column gap-2">
              {datos.por_categoria.map((c) => (
                <div key={c.id ?? "sin"} title={`${c.categoria}: ${fmtL(c.total)} (${c.cantidad} ${c.cantidad === 1 ? "gasto" : "gastos"})`}>
                  <div className="d-flex justify-content-between gap-2" style={{ fontSize: ".82rem" }}>
                    <span className="text-truncate" style={{ color: "#1e293b" }}><i className={`bi ${c.icono || "bi-tag"} me-1 text-muted`} />{c.categoria}</span>
                    <span className="fw-semibold text-nowrap" style={{ color: "#1e293b" }}>
                      {fmtL(c.total)} <span className="text-muted fw-normal">· {Math.round((c.total / Math.max(datos.gastos, 1)) * 100)}%</span>
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, marginTop: 3 }}>
                    <div style={{ width: `${Math.max(2, (c.total / maxCat) * 100)}%`, height: "100%", background: C_GAS, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={tarjeta}>
            <div className="fw-bold mb-2">Ingresos por forma de pago</div>
            {datos.por_metodo.length === 0 && <div className="text-muted small">No hay pagos registrados en {nombreMes(datos.mes)}.</div>}
            {datos.por_metodo.map((m) => (
              <div key={m.metodo} className="d-flex justify-content-between py-1" style={{ fontSize: ".85rem", borderBottom: "1px dashed #e2e8f0" }}>
                <span>{NOMBRE_METODO[m.metodo] || m.metodo}</span><strong>{fmtL(m.total)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="text-muted mt-3" style={{ fontSize: ".75rem" }}>
        <i className="bi bi-info-circle me-1" />
        Los ingresos son los pagos registrados en Facturación (lo que realmente entró), según la fecha de la clínica.
      </div>
    </>
  );
}

// ── Pestaña Gastos ───────────────────────────────────────────────────────────
function Gastos({ mes, categorias, isMobile, onEditar, onNuevo, recargarClave, onAviso }) {
  const [lista, setLista] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [verAnulados, setVerAnulados] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    const { desde, hasta } = rangoMes(mes);
    api.get("/finanzas/gastos", { params: { desde, hasta, q: q || undefined, categoria_id: cat || undefined, incluir_anulados: verAnulados ? 1 : undefined } })
      .then((r) => { setLista(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => setLista([]))
      .finally(() => setCargando(false));
  }, [mes, q, cat, verAnulados]);

  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar, recargarClave]);

  const anular = async (g) => {
    const motivo = window.prompt(`¿Anular el gasto «${g.descripcion}» por ${fmtL(g.monto)}?\n\nEscriba el motivo (opcional):`, "");
    if (motivo === null) return;
    try {
      await api.post(`/finanzas/gastos/${g.id}/anular`, { motivo });
      onAviso("Gasto anulado. Ya no cuenta en los totales.");
      cargar();
    } catch (e) {
      onAviso(e.response?.data?.msg || "No se pudo anular.", true);
    }
  };

  return (
    <div style={tarjeta}>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <div className="input-group input-group-sm" style={{ flex: "1 1 200px", maxWidth: 320 }}>
          <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
          <input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar gasto o proveedor" />
        </div>
        <select className="form-select form-select-sm" style={{ flex: "1 1 160px", maxWidth: 240 }} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div className="form-check form-switch small mb-0 ms-1">
          <input className="form-check-input" type="checkbox" id="g-anulados" checked={verAnulados} onChange={(e) => setVerAnulados(e.target.checked)} />
          <label className="form-check-label" htmlFor="g-anulados">Ver anulados</label>
        </div>
        <button className="btn btn-primary btn-sm ms-auto" onClick={onNuevo}><i className="bi bi-plus-lg me-1" />Nuevo gasto</button>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2 small">
        <span className="text-muted text-capitalize">{nombreMes(mes)} · {lista.filter((g) => !g.anulado).length} gastos</span>
        <span>Total: <strong>{fmtL(total)}</strong></span>
      </div>

      {cargando ? (
        <div className="text-center py-4"><span className="spinner-border text-primary" /></div>
      ) : lista.length === 0 ? (
        <div className="text-center text-muted py-4">
          <i className="bi bi-receipt fs-2 d-block mb-1" />
          No hay gastos en {nombreMes(mes)}. Registre el primero con «Nuevo gasto».
        </div>
      ) : isMobile ? (
        <div className="d-flex flex-column gap-2">
          {lista.map((g) => (
            <div key={g.id} className="p-2 rounded-3" style={{ border: "1px solid #e2e8f0", opacity: g.anulado ? 0.6 : 1 }}>
              <div className="d-flex justify-content-between gap-2">
                <div style={{ minWidth: 0 }}>
                  <div className="fw-semibold text-break" style={{ textDecoration: g.anulado ? "line-through" : "none" }}>{g.descripcion}</div>
                  <div className="text-muted" style={{ fontSize: ".76rem" }}>
                    {fechaTxt(g.fecha)} · {g.categoria || "Sin categoría"}{g.proveedor ? ` · ${g.proveedor}` : ""}
                    {g.fijo ? <span className="badge bg-light text-dark border ms-1">Fijo</span> : null}
                    {g.anulado ? <span className="badge bg-secondary ms-1">Anulado</span> : null}
                  </div>
                </div>
                <div className="fw-bold text-nowrap">{fmtL(g.monto)}</div>
              </div>
              {!g.anulado && (
                <div className="d-flex gap-2 mt-2">
                  <button className="btn btn-sm btn-outline-secondary flex-fill" onClick={() => onEditar(g)}><i className="bi bi-pencil me-1" />Editar</button>
                  <button className="btn btn-sm btn-outline-danger flex-fill" onClick={() => anular(g)}><i className="bi bi-x-circle me-1" />Anular</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: ".86rem" }}>
            <thead><tr className="text-muted"><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Pago</th><th className="text-end">Monto</th><th /></tr></thead>
            <tbody>
              {lista.map((g) => (
                <tr key={g.id} style={{ opacity: g.anulado ? 0.55 : 1 }}>
                  <td className="text-nowrap">{fechaTxt(g.fecha)}</td>
                  <td>
                    <div className="fw-semibold" style={{ textDecoration: g.anulado ? "line-through" : "none" }}>
                      {g.descripcion}
                      {g.fijo ? <span className="badge bg-light text-dark border ms-2 fw-normal">Fijo</span> : null}
                      {g.anulado ? <span className="badge bg-secondary ms-2 fw-normal">Anulado</span> : null}
                    </div>
                    <div className="text-muted" style={{ fontSize: ".76rem" }}>
                      {[g.proveedor, g.comprobante && `Fact. ${g.comprobante}`, g.anulado && g.motivo_anulacion && `Motivo: ${g.motivo_anulacion}`].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td>{g.categoria ? <><i className={`bi ${g.categoria_icono || "bi-tag"} me-1 text-muted`} />{g.categoria}</> : <span className="text-muted">Sin categoría</span>}</td>
                  <td>{NOMBRE_METODO[g.metodo] || "—"}</td>
                  <td className="text-end fw-semibold text-nowrap">{fmtL(g.monto)}</td>
                  <td className="text-end text-nowrap">
                    {!g.anulado && (
                      <>
                        <button className="btn btn-sm btn-link text-secondary" title="Editar" onClick={() => onEditar(g)}><i className="bi bi-pencil" /></button>
                        <button className="btn btn-sm btn-link text-danger" title="Anular" onClick={() => anular(g)}><i className="bi bi-x-circle" /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Pestaña Por cobrar ───────────────────────────────────────────────────────
const TRAMOS = [
  ["0-30", "Hasta 30 días", "#475569", "#f1f5f9", "bi-clock"],
  ["31-60", "31 a 60 días", "#a16207", "#fef9c3", "bi-exclamation-circle"],
  ["61-90", "61 a 90 días", "#c2410c", "#ffedd5", "bi-exclamation-triangle"],
  ["90+", "Más de 90 días", "#b91c1c", "#fee2e2", "bi-exclamation-octagon"],
];
const tramoDe = (d) => (d <= 30 ? TRAMOS[0] : d <= 60 ? TRAMOS[1] : d <= 90 ? TRAMOS[2] : TRAMOS[3]);
const telWhatsapp = (t) => {
  const d = String(t || "").replace(/\D/g, "");
  if (!d) return null;
  return d.length === 8 ? `504${d}` : d;
};

function PorCobrar({ isMobile }) {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    api.get("/finanzas/por-cobrar").then((r) => setDatos(r.data)).catch(() => setDatos({ data: [], resumen: null }));
  }, []);
  if (!datos) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;
  const r = datos.resumen;
  return (
    <>
      {r && (
        <div className="row g-2 mb-3">
          {TRAMOS.map(([k, label, color, , icono]) => (
            <div key={k} className="col-6 col-md-3">
              <div style={{ ...tarjeta, padding: "12px 14px", borderLeft: `4px solid ${color}` }}>
                <div style={{ fontSize: ".78rem", color, fontWeight: 600 }}><i className={`bi ${icono} me-1`} />{label}</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>{fmtL(r.tramos[k])}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={tarjeta}>
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
          <div className="fw-bold">Facturas pendientes de pago</div>
          {r && <div className="small">Total por cobrar: <strong>{fmtL(r.total)}</strong></div>}
        </div>
        {datos.data.length === 0 ? (
          <div className="text-center text-muted py-4"><i className="bi bi-emoji-smile fs-2 d-block mb-1" />No hay facturas pendientes. ¡Todo cobrado!</div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {datos.data.map((f) => {
              const [, label, color, fondo, icono] = tramoDe(f.dias);
              const wa = telWhatsapp(f.telefono);
              const msg = `Hola ${f.paciente?.split(" ")[0] || ""}, le escribimos de la clínica para recordarle que tiene un saldo pendiente de ${fmtL(f.saldo)}. ¡Gracias!`;
              return (
                <div key={f.id} className="d-flex flex-wrap align-items-center gap-2 p-2 rounded-3" style={{ border: "1px solid #e2e8f0" }}>
                  <div className="flex-grow-1" style={{ minWidth: isMobile ? "100%" : 220 }}>
                    <Link to={`/pacientes/${f.paciente_id}/perfil`} className="fw-semibold text-decoration-none text-break">{f.paciente || "Paciente"}</Link>
                    <div className="text-muted" style={{ fontSize: ".76rem" }}>
                      Factura {f.numero_completo || f.numero || f.id} · {fechaTxt(f.fecha)}{f.medico ? ` · ${f.medico}` : ""}
                    </div>
                  </div>
                  <span style={{ background: fondo, color, borderRadius: 999, padding: "2px 10px", fontSize: ".74rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                    <i className={`bi ${icono} me-1`} />{f.dias} días · {label}
                  </span>
                  <div className="text-end" style={{ minWidth: 120 }}>
                    <div className="fw-bold">{fmtL(f.saldo)}</div>
                    <div className="text-muted" style={{ fontSize: ".72rem" }}>de {fmtL(f.total)}{f.pagado > 0 ? ` · abonado ${fmtL(f.pagado)}` : ""}</div>
                  </div>
                  {wa && (
                    <a className="btn btn-sm btn-outline-success" target="_blank" rel="noreferrer" title="Recordar por WhatsApp"
                      href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`}>
                      <i className="bi bi-whatsapp" />{isMobile ? " Recordar" : ""}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="text-muted mt-2" style={{ fontSize: ".75rem" }}>Para registrar un pago, abra la factura en Facturación.</div>
      </div>
    </>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function Finanzas() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("resumen");
  const [mes, setMes] = useState(() => hoyClinica().slice(0, 7));
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [fijos, setFijos] = useState([]);
  const [registrandoFijos, setRegistrandoFijos] = useState(false);
  const [modal, setModal] = useState(null); // null | {} (nuevo) | gasto
  const [recargar, setRecargar] = useState(0);
  const [exportando, setExportando] = useState(false);
  const mesActual = hoyClinica().slice(0, 7);

  const cargarResumen = useCallback(() => {
    setError("");
    api.get("/finanzas/resumen", { params: { mes } })
      .then((r) => setDatos(r.data.data))
      .catch((e) => setError(e.response?.data?.msg || "No se pudo cargar el resumen."));
    api.get("/finanzas/fijos-pendientes", { params: { mes } }).then((r) => setFijos(r.data.data || [])).catch(() => setFijos([]));
  }, [mes]);

  useEffect(() => { cargarResumen(); }, [cargarResumen, recargar]);
  useEffect(() => { api.get("/finanzas/categorias").then((r) => setCategorias(r.data.data || [])).catch(() => {}); }, []);

  const timerAviso = useRef(null);
  const mostrarAviso = (texto, esError = false) => {
    setAviso({ texto, esError });
    clearTimeout(timerAviso.current);
    timerAviso.current = setTimeout(() => setAviso(null), 4000);
  };

  const nuevaCategoria = async (nombre) => {
    const r = await api.post("/finanzas/categorias", { nombre });
    const lista = await api.get("/finanzas/categorias");
    setCategorias(lista.data.data || []);
    return r.data.id;
  };

  const registrarFijos = async () => {
    setRegistrandoFijos(true);
    try {
      const r = await api.post("/finanzas/copiar-fijos", { mes });
      mostrarAviso(`Se registraron ${r.data.copiados} gastos fijos en ${nombreMes(mes)}.`);
      setRecargar((n) => n + 1);
    } catch (e) {
      mostrarAviso(e.response?.data?.msg || "No se pudieron registrar.", true);
    } finally {
      setRegistrandoFijos(false);
    }
  };

  const exportar = async () => {
    setExportando(true);
    try {
      const { desde, hasta } = rangoMes(mes);
      const r = await api.get("/finanzas/exportar", { params: { desde, hasta }, responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url; a.download = `finanzas_${mes}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      mostrarAviso("No se pudo descargar el Excel.", true);
    } finally {
      setExportando(false);
    }
  };

  const tabs = useMemo(() => [
    ["resumen", "Resumen", "bi-pie-chart-fill"],
    ["gastos", "Gastos", "bi-wallet2"],
    ["cobrar", "Por cobrar", "bi-hourglass-split"],
  ], []);

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      {/* Encabezado */}
      <div style={{ background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)", padding: isMobile ? "14px 14px 0" : "16px 24px 0", boxShadow: "0 2px 12px rgba(0,0,0,.18)" }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="bi bi-wallet2" style={{ color: "#fdba74" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Finanzas</div>
              <div style={{ color: "rgba(255,255,255,.55)", fontSize: ".74rem" }}>Ingresos, gastos y ganancia de la clínica</div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {tab !== "cobrar" && (
              <div className="d-flex align-items-center" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 10 }}>
                <button className="btn btn-sm text-white" title="Mes anterior" onClick={() => setMes((m) => mesMas(m, -1))}><i className="bi bi-chevron-left" /></button>
                <span className="text-white fw-semibold text-capitalize text-center" style={{ fontSize: ".85rem", minWidth: 120 }}>{nombreMes(mes)}</span>
                <button className="btn btn-sm text-white" title="Mes siguiente" disabled={mes >= mesActual} onClick={() => setMes((m) => mesMas(m, 1))}><i className="bi bi-chevron-right" /></button>
              </div>
            )}
            <button className="btn btn-sm" onClick={exportar} disabled={exportando}
              style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)", color: "#e2e8f0" }}>
              {exportando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-file-earmark-excel me-1" />}Excel
            </button>
            <button className="btn btn-sm btn-warning fw-semibold" onClick={() => setModal({})}><i className="bi bi-plus-lg me-1" />Gasto</button>
          </div>
        </div>
        <div className="d-flex gap-1 mt-3" style={{ overflowX: "auto", scrollbarWidth: "none" }}>
          {tabs.map(([k, l, i]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                border: "none", borderRadius: "10px 10px 0 0", padding: "8px 16px", fontSize: ".85rem", fontWeight: 600, whiteSpace: "nowrap",
                background: tab === k ? "#f0f2f5" : "rgba(255,255,255,.08)", color: tab === k ? "#1a2744" : "rgba(255,255,255,.75)",
              }}>
              <i className={`bi ${i} me-1`} />{l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: isMobile ? "14px 12px" : "20px 24px" }}>
        {aviso && (
          <div className={`alert ${aviso.esError ? "alert-danger" : "alert-success"} py-2 small d-flex align-items-center gap-2`}>
            <i className={`bi ${aviso.esError ? "bi-x-circle-fill" : "bi-check-circle-fill"}`} />{aviso.texto}
          </div>
        )}
        {error && <div className="alert alert-warning">{error}</div>}

        {tab === "resumen" && (datos ? (
          <Resumen datos={datos} isMobile={isMobile} fijos={fijos} onRegistrarFijos={registrarFijos} registrandoFijos={registrandoFijos} onIrPorCobrar={() => setTab("cobrar")} />
        ) : !error && <div className="text-center py-5"><span className="spinner-border text-primary" /></div>)}

        {tab === "gastos" && (
          <Gastos mes={mes} categorias={categorias} isMobile={isMobile} recargarClave={recargar}
            onNuevo={() => setModal({})} onEditar={(g) => setModal({ ...g, categoria_id: g.categoria_id ? String(g.categoria_id) : "", fijo: !!g.fijo })}
            onAviso={(t, e) => { mostrarAviso(t, e); setRecargar((n) => n + 1); }} />
        )}

        {tab === "cobrar" && <PorCobrar isMobile={isMobile} />}
      </div>

      {modal && (
        <ModalGasto
          inicial={modal.id ? modal : null}
          categorias={categorias}
          onCerrar={() => setModal(null)}
          onNuevaCategoria={nuevaCategoria}
          onGuardado={(t) => { setModal(null); mostrarAviso(t); setRecargar((n) => n + 1); }}
        />
      )}
    </div>
  );
}
