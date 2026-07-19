import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

const ESTADO_COLOR = {
  PENDIENTE: { bg: "#fff7e0", fg: "#92400e", border: "#fde68a" },
  PAGADA:    { bg: "#dcfce7", fg: "#166534", border: "#bbf7d0" },
  ANULADA:   { bg: "#fee2e2", fg: "#991b1b", border: "#fecaca" },
};

function fmtL(n) {
  return `L ${Number(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function emptyItem() { return { descripcion: "", cantidad: 1, precio_unit: "" }; }

async function abrirPdfFactura(facturaId) {
  const res = await api.get(`/facturacion/${facturaId}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  window.open(url, "_blank");
}

async function imprimirPdfFactura(facturaId) {
  const res = await api.get(`/facturacion/${facturaId}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.open(url, "_blank");
    }
    // Liberar recursos tras un margen para permitir el diálogo de impresión
    setTimeout(() => {
      URL.revokeObjectURL(url);
      iframe.remove();
    }, 60000);
  };
  document.body.appendChild(iframe);
}


function ModalNuevaFactura({ onClose, onCreated, prefill }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState([]);
  const [paciente, setPaciente] = useState(prefill?.paciente || null);
  const [tipoComprobante, setTipoComprobante] = useState(prefill?.tipo_comprobante || "RECIBO");
  const [items, setItems] = useState(
    prefill?.items?.length
      ? prefill.items.map(it => ({ descripcion: it.descripcion || "", cantidad: it.cantidad || 1, precio_unit: it.precio_unit ?? "" }))
      : [emptyItem()]
  );
  const [rtn, setRtn] = useState(prefill?.cliente?.rtn || "");
  const [nombreCliente, setNombreCliente] = useState(prefill?.cliente?.nombre || "");
  const [direccionCliente, setDireccionCliente] = useState(prefill?.cliente?.direccion || "");
  const [clienteTipo, setClienteTipo] = useState(prefill?.cliente?.tipo || "PACIENTE");
  const clienteParentesco = prefill?.cliente?.parentesco || "";
  const citaId = prefill?.cita_id || null;
  const medicoId = prefill?.medico_id || null;
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!q.trim() || paciente) { setResultados([]); return; }
    const t = setTimeout(() => {
      api.get("/pacientes", { params: { q } })
        .then(r => setResultados(r.data.data || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q, paciente]);

  const total = items.reduce((s, it) => s + (Number(it.cantidad || 0) * Number(it.precio_unit || 0)), 0);

  const guardar = async () => {
    setError("");
    if (!paciente) { setError("Selecciona un paciente"); return; }
    const validos = items.filter(it => it.descripcion.trim() && Number(it.precio_unit) > 0);
    if (validos.length === 0) { setError("Agrega al menos un ítem con precio"); return; }

    setGuardando(true);
    try {
      await api.post("/facturacion", {
        paciente_id: paciente.id,
        cita_id: citaId,
        medico_id: medicoId,
        tipo_comprobante: tipoComprobante,
        nombre_cliente: nombreCliente || null,
        rtn_cliente: rtn || null,
        direccion_cliente: direccionCliente || null,
        items: validos,
      });
      onCreated();
    } catch (e) {
      setError(e.response?.data?.msg || "Error al crear la factura");
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(640px, 100%)", maxHeight: "calc(100vh - 48px)", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)", margin: "auto" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h6 style={{ margin: 0, fontWeight: 700 }}>Nueva factura / recibo</h6>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          {error && (
            <div style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Paciente */}
          <label className="form-label small fw-semibold">Paciente *</label>
          {paciente ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{paciente.nombres} {paciente.apellidos}</span>
              <button onClick={() => { setPaciente(null); setQ(""); }} style={{ background: "none", border: "none", color: "#2563eb", fontSize: 12, cursor: "pointer" }}>Cambiar</button>
            </div>
          ) : (
            <div style={{ position: "relative", marginBottom: 14 }}>
              <input className="form-control form-control-sm" placeholder="Buscar por nombre, DNI o teléfono..."
                value={q} onChange={e => setQ(e.target.value)} />
              {resultados.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 10, maxHeight: 220, overflowY: "auto" }}>
                  {resultados.map(p => (
                    <div key={p.id} onClick={() => { setPaciente(p); setResultados([]); setClienteTipo("PACIENTE"); setNombreCliente(`${p.nombres} ${p.apellidos}`.trim()); setRtn(p.dni || ""); }}
                      style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f3f4f6" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                      onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                      <div style={{ fontWeight: 600 }}>{p.nombres} {p.apellidos}</div>
                      <div style={{ color: "#9ca3af", fontSize: 11 }}>DNI {p.dni || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Facturar a (cliente fiscal) */}
          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label className="form-label small fw-semibold" style={{ margin: 0 }}>Facturar a</label>
              {clienteTipo === "RESPONSABLE" && (
                <span style={{ background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>
                  <i className="bi bi-person-badge me-1" />Responsable{clienteParentesco ? ` (${clienteParentesco})` : ""}
                </span>
              )}
            </div>
            <div className="row g-2">
              <div className="col-md-7">
                <input className="form-control form-control-sm" placeholder="Nombre del cliente"
                  value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} />
              </div>
              <div className="col-md-5">
                <input className="form-control form-control-sm" placeholder="RTN / DNI"
                  value={rtn} onChange={e => setRtn(e.target.value)} />
              </div>
              <div className="col-12">
                <input className="form-control form-control-sm" placeholder="Dirección (opcional)"
                  value={direccionCliente} onChange={e => setDireccionCliente(e.target.value)} />
              </div>
            </div>
            {clienteTipo === "RESPONSABLE" && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
                <i className="bi bi-info-circle me-1" />Paciente menor de edad: la factura se emite a nombre del responsable, pero queda ligada al paciente.
              </div>
            )}
          </div>

          <div className="row g-2" style={{ marginBottom: 14 }}>
            <div className="col-md-12">
              <label className="form-label small fw-semibold">Tipo de comprobante</label>
              <select className="form-select form-select-sm" value={tipoComprobante} onChange={e => setTipoComprobante(e.target.value)}>
                <option value="RECIBO">Recibo interno</option>
                <option value="FACTURA">Factura (requiere CAI configurado)</option>
              </select>
            </div>
          </div>

          {/* Items */}
          <label className="form-label small fw-semibold">Ítems</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input className="form-control form-control-sm" placeholder="Descripción" style={{ flex: 3 }}
                  value={it.descripcion}
                  onChange={e => setItems(list => list.map((x, i) => i === idx ? { ...x, descripcion: e.target.value } : x))} />
                <input className="form-control form-control-sm" type="number" min="1" placeholder="Cant." style={{ flex: 1 }}
                  value={it.cantidad}
                  onChange={e => setItems(list => list.map((x, i) => i === idx ? { ...x, cantidad: e.target.value } : x))} />
                <input className="form-control form-control-sm" type="number" min="0" step="0.01" placeholder="Precio c/ISV" style={{ flex: 1.4 }}
                  value={it.precio_unit}
                  onChange={e => setItems(list => list.map((x, i) => i === idx ? { ...x, precio_unit: e.target.value } : x))} />
                <button onClick={() => setItems(list => list.filter((_, i) => i !== idx))} disabled={items.length === 1}
                  style={{ background: "none", border: "none", color: "#ef4444", cursor: items.length === 1 ? "default" : "pointer", opacity: items.length === 1 ? 0.3 : 1 }}>
                  <i className="bi bi-trash3" />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setItems(list => [...list, emptyItem()])}
            style={{ background: "none", border: "1px dashed #93c5fd", borderRadius: 8, color: "#2563eb", padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>
            <i className="bi bi-plus-circle me-1" /> Agregar ítem
          </button>

          <div style={{ textAlign: "right", fontSize: 16, fontWeight: 800, color: "#166ae8", marginBottom: 16 }}>
            Total (ISV incluido): {fmtL(total)}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {guardando ? "Guardando..." : "Crear"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModalDetalle({ facturaId, onClose, onChanged, esAdmin }) {
  const [factura, setFactura] = useState(null);
  const [cobros, setCobros] = useState([{ metodo: "EFECTIVO", monto: "", referencia: "" }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(() => {
    api.get(`/facturacion/${facturaId}`).then(r => setFactura(r.data.data)).catch(() => {});
  }, [facturaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const totalPagado = (factura?.pagos || []).reduce((s, p) => s + Number(p.monto), 0);
  const saldo = factura ? Number(factura.total) - totalPagado : 0;

  // ── Cálculo de pago mixto y cambio ──
  const totalIngresado = cobros.reduce((s, c) => s + (Number(c.monto) || 0), 0);
  const efectivoIngresado = cobros.filter(c => c.metodo === "EFECTIVO").reduce((s, c) => s + (Number(c.monto) || 0), 0);
  const totalAplicado = Math.min(totalIngresado, saldo);
  const cambio = Math.max(0, totalIngresado - saldo);
  // El cambio solo puede darse si hubo efectivo suficiente para cubrir el excedente
  const cambioReal = Math.min(cambio, efectivoIngresado);

  const setCobro = (idx, campo, valor) =>
    setCobros(list => list.map((c, i) => i === idx ? { ...c, [campo]: valor } : c));
  const agregarCobro = () => setCobros(list => [...list, { metodo: "TARJETA", monto: "", referencia: "" }]);
  const quitarCobro = (idx) => setCobros(list => list.filter((_, i) => i !== idx));
  const usarSaldoExacto = () => setCobros([{ metodo: "EFECTIVO", monto: saldo.toFixed(2), referencia: "" }]);

  const cobrar = async () => {
    setError("");
    if (totalIngresado <= 0) { setError("Ingresa al menos un monto"); return; }

    // Construir los pagos que realmente se aplican a la factura (sin contar el cambio).
    // Se aplican primero los métodos distintos de efectivo y el efectivo absorbe el excedente/cambio.
    let restante = saldo;
    const aplicados = [];
    for (const c of cobros.filter(x => x.metodo !== "EFECTIVO")) {
      const m = Number(c.monto) || 0;
      const aplicar = Math.min(m, restante);
      if (aplicar > 0) { aplicados.push({ metodo: c.metodo, monto: aplicar, referencia: c.referencia || null }); restante -= aplicar; }
    }
    const efectivoAplicar = Math.min(efectivoIngresado, restante);
    if (efectivoAplicar > 0) { aplicados.push({ metodo: "EFECTIVO", monto: efectivoAplicar, referencia: null }); }

    if (aplicados.length === 0) { setError("El monto no cubre nada del saldo"); return; }

    setGuardando(true);
    try {
      await api.post(`/facturacion/${facturaId}/cobrar`, { pagos: aplicados });
      setCobros([{ metodo: "EFECTIVO", monto: "", referencia: "" }]);
      cargar();
      onChanged();
    } catch (e) {
      setError(e.response?.data?.msg || "Error al registrar el cobro");
    } finally {
      setGuardando(false);
    }
  };

  const anular = async () => {
    if (!window.confirm("¿Anular esta factura? Esta acción no se puede deshacer.")) return;
    await api.post(`/facturacion/${facturaId}/anular`);
    cargar();
    onChanged();
  };

  const descargarPdf = () => abrirPdfFactura(facturaId);
  const imprimirRecibo = () => imprimirPdfFactura(facturaId);

  if (!factura) return null;
  const col = ESTADO_COLOR[factura.estado] || ESTADO_COLOR.PENDIENTE;

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(600px, 100%)", maxHeight: "calc(100vh - 48px)", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)", margin: "auto" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h6 style={{ margin: 0, fontWeight: 700 }}>{factura.numero_completo || factura.numero}</h6>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{factura.paciente_nombres} {factura.paciente_apellidos}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          <span style={{ background: col.bg, color: col.fg, border: `1px solid ${col.border}`, padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
            {factura.estado}
          </span>

          <table style={{ width: "100%", marginTop: 16, marginBottom: 10, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase" }}>
                <th style={{ textAlign: "left", padding: "6px 0" }}>Ítem</th>
                <th style={{ textAlign: "center" }}>Cant.</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(factura.items || []).map(it => (
                <tr key={it.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 0", fontSize: 13 }}>{it.descripcion}</td>
                  <td style={{ textAlign: "center", fontSize: 13 }}>{Number(it.cantidad)}</td>
                  <td style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>{fmtL(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ textAlign: "right", fontSize: 13, color: "#6b7280", lineHeight: 1.8 }}>
            <div>Subtotal: {fmtL(factura.subtotal)}</div>
            <div>ISV ({Number(factura.isv_porcentaje).toFixed(0)}%): {fmtL(factura.impuestos)}</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#166ae8" }}>Total: {fmtL(factura.total)}</div>
            <div>Pagado: {fmtL(totalPagado)}</div>
            <div style={{ fontWeight: 700, color: saldo > 0 ? "#dc2626" : "#16a34a" }}>Saldo: {fmtL(saldo)}</div>
          </div>

          {/* Historial de pagos */}
          {(factura.pagos || []).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Pagos registrados</div>
              {factura.pagos.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span>{dayjs(p.registrado_en).format("D/M/YYYY HH:mm")} — {p.metodo}</span>
                  <span style={{ fontWeight: 600 }}>{fmtL(p.monto)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Cobrar / Registrar pago (soporta pago mixto y cambio) */}
          {factura.estado === "PENDIENTE" && (
            <div style={{ marginTop: 18, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>
                  <i className="bi bi-cash-coin me-1" /> Cobrar
                </div>
                <button onClick={usarSaldoExacto} type="button"
                  style={{ background: "none", border: "1px solid #bbf7d0", borderRadius: 6, color: "#166534", fontSize: 11, fontWeight: 600, padding: "3px 10px", cursor: "pointer" }}>
                  Monto exacto ({fmtL(saldo)})
                </button>
              </div>
              {error && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{error}</div>}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cobros.map((c, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <select className="form-select form-select-sm" style={{ flex: 1.4 }}
                      value={c.metodo} onChange={e => setCobro(idx, "metodo", e.target.value)}>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TARJETA">Tarjeta</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="SEGURO">Seguro</option>
                      <option value="OTRO">Otro</option>
                    </select>
                    <input className="form-control form-control-sm" type="number" min="0" step="0.01" placeholder="Monto" style={{ flex: 1.2 }}
                      value={c.monto} onChange={e => setCobro(idx, "monto", e.target.value)} />
                    <input className="form-control form-control-sm" placeholder="Ref. (opcional)" style={{ flex: 1.4 }}
                      value={c.referencia} onChange={e => setCobro(idx, "referencia", e.target.value)} />
                    <button onClick={() => quitarCobro(idx)} disabled={cobros.length === 1} type="button"
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: cobros.length === 1 ? "default" : "pointer", opacity: cobros.length === 1 ? 0.3 : 1 }}>
                      <i className="bi bi-trash3" />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={agregarCobro} type="button"
                style={{ background: "none", border: "1px dashed #86efac", borderRadius: 8, color: "#166534", padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>
                <i className="bi bi-plus-circle me-1" /> Agregar método (pago mixto)
              </button>

              <div style={{ marginTop: 12, borderTop: "1px solid #bbf7d0", paddingTop: 10, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "#374151" }}>
                  <span>Saldo pendiente</span><span style={{ fontWeight: 700 }}>{fmtL(saldo)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "#374151" }}>
                  <span>Total ingresado</span><span style={{ fontWeight: 700 }}>{fmtL(totalIngresado)}</span>
                </div>
                {cambioReal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", marginTop: 6, background: "#dcfce7", borderRadius: 8, color: "#166534", fontWeight: 800, fontSize: 15 }}>
                    <span>Cambio a entregar</span><span>{fmtL(cambioReal)}</span>
                  </div>
                )}
                {totalIngresado > 0 && totalIngresado < saldo && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "#b45309", fontSize: 12 }}>
                    <span>Quedará pendiente</span><span style={{ fontWeight: 700 }}>{fmtL(saldo - totalIngresado)}</span>
                  </div>
                )}
              </div>

              <button onClick={cobrar} disabled={guardando}
                style={{ marginTop: 12, width: "100%", background: "#16a34a", border: "none", borderRadius: 8, color: "#fff", padding: "9px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {guardando ? "Procesando..." : `Cobrar ${fmtL(totalAplicado)}`}
              </button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <div>
              {esAdmin && factura.estado !== "ANULADA" && (
                <button onClick={anular} style={{ background: "none", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Anular
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={imprimirRecibo} style={{ background: "#0f766e", border: "none", borderRadius: 8, color: "#fff", padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <i className="bi bi-printer me-1" /> Imprimir
              </button>
              <button onClick={descargarPdf} style={{ background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <i className="bi bi-file-earmark-pdf me-1" /> Descargar PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Facturacion() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const esAdmin = user?.tipo === "ADMIN" || user?.tipo === "SUPER_ADMIN";

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [showNueva, setShowNueva] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const cargar = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filtroEstado) params.estado = filtroEstado;
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    api.get("/facturacion", { params })
      .then(r => setList(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtroEstado, desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div style={{ padding: isMobile ? "4px" : "0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <h5 style={{ fontWeight: 800, margin: 0, color: "#1e293b" }}>
            <i className="bi bi-receipt-cutoff me-2" style={{ color: "#166ae8" }} />
            Facturación
          </h5>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Recibos y facturas ligados a las consultas</span>
        </div>
        <button onClick={() => { setPrefill(null); setShowNueva(true); }}
          style={{ background: "#2563eb", border: "none", borderRadius: 10, color: "#fff", padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <i className="bi bi-plus-circle" /> Nueva factura
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {["", "PENDIENTE", "PAGADA", "ANULADA"].map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: filtroEstado === e ? "none" : "1px solid #e5e7eb",
              background: filtroEstado === e ? "#2563eb" : "#fff",
              color: filtroEstado === e ? "#fff" : "#6b7280",
            }}>
            {e || "Todas"}
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Desde</span>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta || undefined}
            style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#374151" }} />
          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Hasta</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde || undefined}
            style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#374151" }} />
          {(desde || hasta) && (
            <button onClick={() => { setDesde(""); setHasta(""); }}
              style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}><div className="spinner-border spinner-border-sm" /></div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
            <i className="bi bi-receipt" style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: 0.3 }} />
            No hay facturas registradas todavía.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Número", "Paciente", "Fecha", "Total", "Pagado", "Estado"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>{h}</th>
                  ))}
                  <th style={{ padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", textAlign: "right", borderBottom: "2px solid #e5e7eb" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map(f => {
                  const col = ESTADO_COLOR[f.estado] || ESTADO_COLOR.PENDIENTE;
                  return (
                    <tr key={f.id} onClick={() => setDetalleId(f.id)} style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "11px 14px", fontWeight: 700, fontSize: 13 }}>{f.numero_completo || f.numero}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13 }}>{f.paciente_nombres} {f.paciente_apellidos}</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "#6b7280" }}>{dayjs(f.creado_en).format("D/M/YYYY")}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700 }}>{fmtL(f.total)}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, color: "#16a34a" }}>{fmtL(f.total_pagado)}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ background: col.bg, color: col.fg, border: `1px solid ${col.border}`, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                          {f.estado}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button title="Imprimir" onClick={e => { e.stopPropagation(); imprimirPdfFactura(f.id); }}
                          style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, color: "#0f766e", padding: "5px 9px", fontSize: 13, cursor: "pointer", marginRight: 6 }}>
                          <i className="bi bi-printer" />
                        </button>
                        <button title="Descargar PDF" onClick={e => { e.stopPropagation(); abrirPdfFactura(f.id); }}
                          style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, color: "#2563eb", padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>
                          <i className="bi bi-file-earmark-pdf" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNueva && (
        <ModalNuevaFactura prefill={prefill} onClose={() => { setShowNueva(false); setPrefill(null); }} onCreated={() => { setShowNueva(false); setPrefill(null); cargar(); }} />
      )}
      {detalleId && (
        <ModalDetalle facturaId={detalleId} esAdmin={esAdmin} onClose={() => setDetalleId(null)} onChanged={cargar} />
      )}
    </div>
  );
}
