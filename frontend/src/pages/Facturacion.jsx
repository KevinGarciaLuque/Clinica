import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import api from "../api/api";
import { prefijoDr } from "../utils/medico";
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

function emptyItem() { return { descripcion: "", cantidad: 1, precio_unit: "", descuento: "" }; }

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
  const limpiar = () => {
    URL.revokeObjectURL(url);
    iframe.remove();
  };
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      // Si el navegador soporta el evento, liberamos apenas se cierre el diálogo de impresión.
      iframe.contentWindow.onafterprint = limpiar;
      iframe.contentWindow.print();
    } catch {
      window.open(url, "_blank");
      limpiar();
      return;
    }
    // Respaldo por si el navegador no dispara "afterprint" (p. ej. se cancela sin imprimir)
    setTimeout(limpiar, 60000);
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
      ? prefill.items.map(it => ({ descripcion: it.descripcion || "", cantidad: it.cantidad || 1, precio_unit: it.precio_unit ?? "", descuento: it.descuento ?? "" }))
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

  const totalDescuentos = items.reduce((s, it) => s + Math.max(0, Number(it.descuento) || 0), 0);
  const total = items.reduce((s, it) => {
    const sub = Number(it.cantidad || 0) * Number(it.precio_unit || 0);
    const desc = Math.max(0, Number(it.descuento) || 0);
    return s + Math.max(0, sub - desc);
  }, 0);

  const guardar = async () => {
    setError("");
    if (!paciente) { setError("Selecciona un paciente"); return; }
    const validos = items.filter(it => it.descripcion.trim() && Number(it.precio_unit) > 0)
      .map(it => ({ ...it, descuento: Math.max(0, Number(it.descuento) || 0) }));
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "min(640px, 100%)", maxHeight: "calc(100vh - 48px)", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)", margin: "auto" }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <label className="form-label small fw-semibold">Ítems</label>
            <span style={{ fontSize: 10.5, color: "#9ca3af", display: "flex", gap: 10 }}>
              <span style={{ flex: 3 }} />
              <span style={{ flex: 1, textAlign: "center" }}>Cant.</span>
              <span style={{ flex: 1.4, textAlign: "center" }}>Precio c/ISV</span>
              <span style={{ flex: 1, textAlign: "center" }}>Desc. L</span>
            </span>
          </div>
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
                <input className="form-control form-control-sm" type="number" min="0" step="0.01" placeholder="Desc." style={{ flex: 1 }}
                  value={it.descuento}
                  onChange={e => setItems(list => list.map((x, i) => i === idx ? { ...x, descuento: e.target.value } : x))} />
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

          <div style={{ textAlign: "right", marginBottom: 16 }}>
            {totalDescuentos > 0 && (
              <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 2 }}>Descuento total: −{fmtL(totalDescuentos)}</div>
            )}
            <div style={{ fontSize: 16, fontWeight: 800, color: "#166ae8" }}>
              Total (ISV incluido): {fmtL(total)}
            </div>
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

function ModalConfigCai({ clinicaId, onClose, onSaved }) {
  const [form, setForm] = useState(null); // null = cargando
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });

  useEffect(() => {
    api.get(`/clinicas/${clinicaId}`)
      .then(r => {
        const cfgMap = {};
        (r.data.data?.config || []).forEach(c => { cfgMap[c.clave] = c.valor; });
        setForm({
          factura_rtn_clinica: cfgMap.factura_rtn_clinica || "",
          factura_cai: cfgMap.factura_cai || "",
          factura_establecimiento: cfgMap.factura_establecimiento || "001",
          factura_punto_emision: cfgMap.factura_punto_emision || "001",
          factura_tipo_documento: cfgMap.factura_tipo_documento || "01",
          factura_rango_inicio: cfgMap.factura_rango_inicio || "",
          factura_rango_fin: cfgMap.factura_rango_fin || "",
          factura_correlativo_actual: cfgMap.factura_correlativo_actual || "",
          factura_fecha_limite_emision: cfgMap.factura_fecha_limite_emision || "",
          factura_isv_porcentaje: cfgMap.factura_isv_porcentaje || "15",
        });
      })
      .catch(() => setForm({}));
  }, [clinicaId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async () => {
    setGuardando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const config = {};
      Object.entries(form).forEach(([k, v]) => { config[k] = v || ""; });
      await api.put(`/clinicas/${clinicaId}/config`, { config });
      setMsg({ tipo: "success", texto: "Configuración guardada correctamente" });
      onSaved?.();
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || "Error al guardar" });
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "min(680px, 100%)", maxHeight: "calc(100vh - 48px)", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)", margin: "auto" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h6 style={{ margin: 0, fontWeight: 700 }}><i className="bi bi-gear me-2" style={{ color: "#166ae8" }} />Configuración del CAI</h6>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          {!form ? (
            <div style={{ textAlign: "center", padding: 30 }}><div className="spinner-border spinner-border-sm" /></div>
          ) : (
            <>
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#92400e", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <i className="bi bi-info-circle-fill" style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                <span>
                  Estos datos vienen del <strong>CAI (Código de Autorización de Impresión)</strong> que la SAR te asignó.
                  Mientras no los completes, el sistema seguirá emitiendo <strong>recibos internos</strong> (sin numeración fiscal)
                  sin bloquear el resto de la clínica. Solo es obligatorio para emitir facturas formales.
                </span>
              </div>

              {msg.texto && (
                <div style={{
                  background: msg.tipo === "success" ? "#dcfce7" : "#fee2e2",
                  color: msg.tipo === "success" ? "#166534" : "#991b1b",
                  border: `1px solid ${msg.tipo === "success" ? "#bbf7d0" : "#fecaca"}`,
                  borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 13,
                }}>
                  {msg.texto}
                </div>
              )}

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">RTN de la clínica</label>
                  <input className="form-control form-control-sm" placeholder="0801-1990-123456"
                    value={form.factura_rtn_clinica} onChange={e => set("factura_rtn_clinica", e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">CAI</label>
                  <input className="form-control form-control-sm" placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX"
                    value={form.factura_cai} onChange={e => set("factura_cai", e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">Establecimiento</label>
                  <input className="form-control form-control-sm" placeholder="001"
                    value={form.factura_establecimiento} onChange={e => set("factura_establecimiento", e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">Punto de emisión</label>
                  <input className="form-control form-control-sm" placeholder="001"
                    value={form.factura_punto_emision} onChange={e => set("factura_punto_emision", e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">Tipo de documento</label>
                  <input className="form-control form-control-sm" placeholder="01"
                    value={form.factura_tipo_documento} onChange={e => set("factura_tipo_documento", e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">ISV (%)</label>
                  <input className="form-control form-control-sm" type="number" min="0" max="100" step="0.01"
                    value={form.factura_isv_porcentaje} onChange={e => set("factura_isv_porcentaje", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Rango autorizado — Inicio</label>
                  <input className="form-control form-control-sm" placeholder="00000001"
                    value={form.factura_rango_inicio} onChange={e => set("factura_rango_inicio", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Rango autorizado — Fin</label>
                  <input className="form-control form-control-sm" placeholder="00050000"
                    value={form.factura_rango_fin} onChange={e => set("factura_rango_fin", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Correlativo actual</label>
                  <input className="form-control form-control-sm" placeholder="Se autoincrementa con cada factura"
                    value={form.factura_correlativo_actual} onChange={e => set("factura_correlativo_actual", e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Fecha límite de emisión</label>
                  <input className="form-control form-control-sm" type="date"
                    value={form.factura_fecha_limite_emision} onChange={e => set("factura_fecha_limite_emision", e.target.value)} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                <button onClick={onClose} style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
                <button onClick={guardar} disabled={guardando}
                  style={{ background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </>
          )}
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

  const [pdfBusy, setPdfBusy] = useState(null); // "print" | "dl" | null
  const descargarPdf = async () => { setPdfBusy("dl"); try { await abrirPdfFactura(facturaId); } finally { setPdfBusy(null); } };
  const imprimirRecibo = async () => { setPdfBusy("print"); try { await imprimirPdfFactura(facturaId); } finally { setPdfBusy(null); } };

  if (!factura) return null;
  const col = ESTADO_COLOR[factura.estado] || ESTADO_COLOR.PENDIENTE;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "min(600px, 100%)", maxHeight: "calc(100vh - 48px)", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)", margin: "auto" }}>
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
                  <td style={{ padding: "8px 0", fontSize: 13 }}>
                    {it.descripcion}
                    {Number(it.descuento) > 0 && (
                      <span style={{ display: "block", fontSize: 11, color: "#dc2626" }}>Descuento: −{fmtL(it.descuento)}</span>
                    )}
                  </td>
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
              <button onClick={imprimirRecibo} disabled={!!pdfBusy} style={{ background: "#0f766e", border: "none", borderRadius: 8, color: "#fff", padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: pdfBusy ? "wait" : "pointer", opacity: pdfBusy === "print" ? .7 : 1 }}>
                {pdfBusy === "print" ? <span className="spinner-border spinner-border-sm me-1" style={{ width: 12, height: 12 }} /> : <i className="bi bi-printer me-1" />} Imprimir
              </button>
              <button onClick={descargarPdf} disabled={!!pdfBusy} style={{ background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: pdfBusy ? "wait" : "pointer", opacity: pdfBusy === "dl" ? .7 : 1 }}>
                {pdfBusy === "dl" ? <span className="spinner-border spinner-border-sm me-1" style={{ width: 12, height: 12 }} /> : <i className="bi bi-file-earmark-pdf me-1" />} Descargar PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { y: 14, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 120, damping: 15 } },
};

function KpiCard({ label, value, icon, gradient, sub, isMobile }) {
  return (
    <motion.div className="col-6 col-lg-3" variants={itemVariants}>
      <motion.div
        className="h-100"
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        style={{
          background: "#fff", borderRadius: isMobile ? 12 : 16,
          padding: isMobile ? 12 : 20, border: "1px solid #e5e7eb",
          boxShadow: "0 6px 20px rgba(0,0,0,0.05)", position: "relative", overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", top: -26, right: -26,
          width: isMobile ? 70 : 100, height: isMobile ? 70 : 100,
          background: gradient, borderRadius: "50%", opacity: 0.13, filter: "blur(36px)",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: isMobile ? 36 : 44, height: isMobile ? 36 : 44,
            borderRadius: isMobile ? 10 : 12, background: gradient,
            marginBottom: isMobile ? 8 : 12, color: "#fff", fontSize: isMobile ? 15 : 18,
            boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
          }}>
            <i className={`bi ${icon}`} />
          </div>
          <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.15 }}>
            {value ?? "—"}
          </div>
          <div style={{ fontSize: isMobile ? 10.5 : 12.5, color: "#6b7280", fontWeight: 600, marginTop: 3 }}>{label}</div>
          {sub && <div style={{ fontSize: isMobile ? 10 : 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Facturacion() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const esAdmin = user?.tipo === "ADMIN" || user?.tipo === "SUPER_ADMIN";
  const esRecepcionista = user?.tipo === "RECEPCIONISTA";
  const puedeConfigCai = ["ADMIN", "SUPER_ADMIN", "MEDICO", "PSICOLOGO"].includes(user?.tipo);

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [buscar, setBuscar] = useState("");
  const [showNueva, setShowNueva] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [serie, setSerie] = useState([]);
  const [caiStatus, setCaiStatus] = useState(null);
  const [porMedico, setPorMedico] = useState([]);
  const [exportando, setExportando] = useState(false);
  const [showConfigCai, setShowConfigCai] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pdfBusyId, setPdfBusyId] = useState(null); // `${accion}-${facturaId}` mientras se genera el PDF

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

  const cargarResumen = useCallback(() => {
    const params = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    Promise.all([
      api.get("/facturacion/kpis", { params }),
      api.get("/facturacion/serie", { params }),
    ])
      .then(([k, s]) => { setKpis(k.data.data); setSerie(s.data.data || []); })
      .catch(() => {});
  }, [desde, hasta]);

  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  const cargarCaiStatus = useCallback(() => {
    api.get("/facturacion/cai-status").then(r => setCaiStatus(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => { cargarCaiStatus(); }, [cargarCaiStatus]);

  useEffect(() => {
    if (!esAdmin) return;
    const params = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    api.get("/facturacion/por-medico", { params }).then(r => setPorMedico(r.data.data || [])).catch(() => {});
  }, [esAdmin, desde, hasta]);

  const exportar = async () => {
    setExportando(true);
    try {
      const params = {};
      if (filtroEstado) params.estado = filtroEstado;
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      const res = await api.get("/facturacion/exportar", { params, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `facturacion_${dayjs().format("YYYY-MM-DD")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("No se pudo generar el Excel");
    } finally {
      setExportando(false);
    }
  };

  // Si venimos desde "Consulta médica" con ?nueva=1&paciente_id=&cita_id=, precargamos
  // los datos del paciente/cita y abrimos el modal automáticamente.
  useEffect(() => {
    if (searchParams.get("nueva") !== "1") return;
    const pacienteId = searchParams.get("paciente_id");
    const citaId = searchParams.get("cita_id");
    const limpiarUrl = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("nueva"); next.delete("paciente_id"); next.delete("cita_id");
      setSearchParams(next, { replace: true });
    };
    if (!pacienteId) { limpiarUrl(); return; }
    api.get("/facturacion/prefill", { params: { paciente_id: pacienteId, cita_id: citaId || undefined } })
      .then(r => setPrefill(r.data.data))
      .catch(() => setPrefill(null))
      .finally(() => { setShowNueva(true); limpiarUrl(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listFiltrada = buscar.trim()
    ? list.filter(f => {
        const t = buscar.trim().toLowerCase();
        return (f.numero_completo || f.numero || "").toLowerCase().includes(t)
          || `${f.paciente_nombres} ${f.paciente_apellidos}`.toLowerCase().includes(t);
      })
    : list;

  const serieChart = serie.map(s => ({
    fecha: dayjs(s.fecha).format("D/M"),
    facturado: Number(s.facturado),
    cobrado: Number(s.cobrado),
  }));

  return (
    <div style={{
      minHeight: "100vh", background: "#f0f2f5",
      margin: isMobile ? "-1rem" : "-1.5rem",
      width: isMobile ? "calc(100% + 2rem)" : "calc(100% + 3rem)",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: isMobile ? "14px 16px" : "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, boxShadow: "0 2px 12px rgba(0,0,0,.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <i className="bi bi-receipt-cutoff" style={{ color: "#7dd3fc", fontSize: "1rem" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: isMobile ? "1rem" : "1.05rem" }}>Facturación</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>Recibos y facturas ligados a las consultas</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {puedeConfigCai && (
            <button onClick={() => setShowConfigCai(true)} title="Configuración del CAI"
              style={{
                background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 8, color: "#fff",
                width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem",
              }}>
              <i className="bi bi-gear-fill" />
            </button>
          )}
          <button onClick={exportar} disabled={exportando}
            style={{
              background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 8, color: "#fff",
              padding: "8px 16px", fontSize: "0.83rem", cursor: exportando ? "default" : "pointer",
              fontWeight: 700, display: "flex", alignItems: "center", gap: 6, opacity: exportando ? 0.7 : 1,
            }}>
            <i className="bi bi-file-earmark-spreadsheet" /> {exportando ? "Exportando…" : "Exportar"}
          </button>
          <button onClick={() => { setPrefill(null); setShowNueva(true); }}
            style={{
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              border: "none", borderRadius: 8, color: "#fff",
              padding: "8px 18px", fontSize: "0.83rem", cursor: "pointer",
              fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 2px 8px rgba(59,130,246,.35)",
            }}>
            <i className="bi bi-plus-lg" /> Nueva factura
          </button>
        </div>
      </div>

      <div style={{ padding: isMobile ? "16px 12px" : "20px 24px" }}>
        {/* Aviso de CAI por vencer / agotarse */}
        {caiStatus && (caiStatus.vencido || caiStatus.agotado || (caiStatus.dias_restantes !== null && caiStatus.dias_restantes <= 15) || caiStatus.folios_restantes <= 20) && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: (caiStatus.vencido || caiStatus.agotado) ? "#fee2e2" : "#fff7e0",
            border: `1px solid ${(caiStatus.vencido || caiStatus.agotado) ? "#fecaca" : "#fde68a"}`,
            color: (caiStatus.vencido || caiStatus.agotado) ? "#991b1b" : "#92400e",
            borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12.5,
          }}>
            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: 16 }} />
            <div>
              {caiStatus.vencido && <strong>El CAI vigente ya venció. </strong>}
              {!caiStatus.vencido && caiStatus.agotado && <strong>El rango de folios autorizado se agotó. </strong>}
              {!caiStatus.vencido && !caiStatus.agotado && caiStatus.dias_restantes !== null && caiStatus.dias_restantes <= 15 && (
                <strong>El CAI vence en {caiStatus.dias_restantes} día{caiStatus.dias_restantes === 1 ? "" : "s"}. </strong>
              )}
              {!caiStatus.vencido && !caiStatus.agotado && caiStatus.folios_restantes <= 20 && (
                <strong>Quedan solo {caiStatus.folios_restantes} folio{caiStatus.folios_restantes === 1 ? "" : "s"} autorizados. </strong>
              )}
              {puedeConfigCai ? (
                <>
                  Carga un nuevo CAI para no interrumpir la emisión de facturas —{" "}
                  <button onClick={() => setShowConfigCai(true)}
                    style={{ background: "none", border: "none", padding: 0, color: "inherit", textDecoration: "underline", fontWeight: 700, cursor: "pointer", fontSize: "inherit" }}>
                    configúralo aquí
                  </button>.
                </>
              ) : (
                "Avisa al administrador de la clínica para que cargue un nuevo CAI y no se interrumpa la emisión de facturas."
              )}
            </div>
          </div>
        )}

        {!esRecepcionista && (
          <>
            {/* KPIs */}
            <motion.div className={`row ${isMobile ? "g-1" : "g-3"}`} style={{ marginBottom: isMobile ? 10 : 16 }}
              variants={containerVariants} initial="hidden" animate="visible">
              <KpiCard label="Cobrado" value={kpis ? fmtL(kpis.cobrado) : "—"} icon="bi-cash-coin"
                gradient="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" isMobile={isMobile}
                sub={kpis ? `Hoy: ${fmtL(kpis.cobrado_hoy)}` : undefined} />
              <KpiCard label="Por cobrar" value={kpis ? fmtL(kpis.pendiente) : "—"} icon="bi-hourglass-split"
                gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" isMobile={isMobile}
                sub={kpis ? `${kpis.facturas_pendientes} factura${kpis.facturas_pendientes === 1 ? "" : "s"}` : undefined} />
              <KpiCard label="Facturas emitidas" value={kpis?.facturas_emitidas ?? "—"} icon="bi-receipt"
                gradient="linear-gradient(135deg, #4facfe 0%, #00c2fe 100%)" isMobile={isMobile} />
              <KpiCard label="Ticket promedio" value={kpis ? fmtL(kpis.ticket_promedio) : "—"} icon="bi-graph-up-arrow"
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" isMobile={isMobile} />
            </motion.div>

            {/* Gráfico de ingresos + desglose por médico */}
            <div className={`row ${isMobile ? "g-1" : "g-3"}`} style={{ marginBottom: isMobile ? 12 : 18 }}>
              <div className={esAdmin && porMedico.length > 0 ? "col-lg-8" : "col-12"}>
                <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 12 : 20, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)", height: "100%" }}>
                  <h6 style={{ fontWeight: 700, margin: "0 0 14px", fontSize: "0.92rem", color: "#1e293b" }}>
                    <i className="bi bi-bar-chart-line me-2" style={{ color: "#166ae8" }} />
                    Ingresos {desde || hasta ? "en el rango seleccionado" : "del mes"}
                  </h6>
                  {serieChart.length === 0 ? (
                    <p style={{ color: "#999", fontSize: 13, margin: 0 }}>Sin datos en este rango.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={serieChart} margin={{ top: 4, right: 16, left: -14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                        <Tooltip formatter={v => fmtL(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="facturado" name="Facturado" fill="#93c5fd" radius={[5, 5, 0, 0]} maxBarSize={40} />
                        <Line type="monotone" dataKey="cobrado" name="Cobrado" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {esAdmin && porMedico.length > 0 && (
                <div className="col-lg-4">
                  <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 12 : 20, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)", height: "100%" }}>
                    <h6 style={{ fontWeight: 700, margin: "0 0 14px", fontSize: "0.92rem", color: "#1e293b" }}>
                      <i className="bi bi-people me-2" style={{ color: "#166ae8" }} />
                      Cobrado por médico
                    </h6>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 240, overflowY: "auto" }}>
                      {porMedico.map(m => (
                        <div key={m.medico_id}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                            <span style={{ fontWeight: 600, color: "#374151" }}>{prefijoDr()}{m.nombres} {m.apellidos}</span>
                            <span style={{ fontWeight: 700, color: "#16a34a" }}>{fmtL(m.cobrado)}</span>
                          </div>
                          <div style={{ background: "#f1f5f9", borderRadius: 6, height: 6, overflow: "hidden" }}>
                            <div style={{
                              width: `${Math.min(100, (m.cobrado / Math.max(...porMedico.map(x => x.cobrado), 1)) * 100)}%`,
                              background: "linear-gradient(90deg, #4facfe, #16a34a)", height: "100%",
                            }} />
                          </div>
                          {m.pendiente > 0 && (
                            <div style={{ fontSize: 10.5, color: "#d97706", marginTop: 2 }}>Por cobrar: {fmtL(m.pendiente)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Filtros */}
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
          <div style={{ position: "relative", minWidth: 180 }}>
            <i className="bi bi-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 12 }} />
            <input placeholder="Buscar número o paciente…" value={buscar} onChange={e => setBuscar(e.target.value)}
              style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px 6px 28px", fontSize: 12, color: "#374151", width: "100%" }} />
          </div>
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

        {/* Tabla */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}><div className="spinner-border spinner-border-sm" /></div>
          ) : listFiltrada.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
              <i className="bi bi-receipt" style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: 0.3 }} />
              {list.length === 0 ? "No hay facturas registradas todavía." : "Ningún resultado para tu búsqueda."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Número", "Paciente", "Fecha", "Total", "Pagado", "Estado"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                    <th style={{ padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {listFiltrada.map(f => {
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
                          <button title="Imprimir" disabled={pdfBusyId === `print-${f.id}`}
                            onClick={async e => {
                              e.stopPropagation();
                              setPdfBusyId(`print-${f.id}`);
                              try { await imprimirPdfFactura(f.id); } finally { setPdfBusyId(null); }
                            }}
                            style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, color: "#0f766e", padding: "5px 9px", fontSize: 13, cursor: pdfBusyId === `print-${f.id}` ? "wait" : "pointer", marginRight: 6 }}>
                            {pdfBusyId === `print-${f.id}` ? <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }} /> : <i className="bi bi-printer" />}
                          </button>
                          <button title="Descargar PDF" disabled={pdfBusyId === `dl-${f.id}`}
                            onClick={async e => {
                              e.stopPropagation();
                              setPdfBusyId(`dl-${f.id}`);
                              try { await abrirPdfFactura(f.id); } finally { setPdfBusyId(null); }
                            }}
                            style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, color: "#2563eb", padding: "5px 9px", fontSize: 13, cursor: pdfBusyId === `dl-${f.id}` ? "wait" : "pointer" }}>
                            {pdfBusyId === `dl-${f.id}` ? <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }} /> : <i className="bi bi-file-earmark-pdf" />}
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
      </div>

      {showNueva && (
        <ModalNuevaFactura prefill={prefill} onClose={() => { setShowNueva(false); setPrefill(null); }}
          onCreated={() => { setShowNueva(false); setPrefill(null); cargar(); cargarResumen(); }} />
      )}
      {detalleId && (
        <ModalDetalle facturaId={detalleId} esAdmin={esAdmin} onClose={() => setDetalleId(null)}
          onChanged={() => { cargar(); cargarResumen(); }} />
      )}
      {showConfigCai && (
        <ModalConfigCai clinicaId={user?.clinica_id} onClose={() => setShowConfigCai(false)}
          onSaved={cargarCaiStatus} />
      )}
    </div>
  );
}
