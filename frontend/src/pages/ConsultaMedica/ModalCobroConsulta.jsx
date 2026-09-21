import { useState, useEffect } from "react";
import dayjs from "dayjs";
import api from "../../api/api";

export default function ModalCobroConsulta({ paciente, citaId, onOmitir, onListo, onFacturaFormal }) {
  const esMenor = paciente?.fecha_nacimiento
    ? dayjs().diff(dayjs(paciente.fecha_nacimiento), "year") < 18
    : false;

  const [servicios, setServicios] = useState([]);
  const [servicioId, setServicioId] = useState("");
  const [descripcion, setDescripcion] = useState("Consulta médica");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [procesando, setProcesando] = useState(null); // "cobrar" | "credito" | null
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null); // { numero, cobrado }

  useEffect(() => {
    api.get("/servicios").then(r => setServicios(r.data.data || [])).catch(() => {});
  }, []);

  const elegirServicio = (id) => {
    setServicioId(id);
    const s = servicios.find(x => String(x.id) === String(id));
    if (s) { setDescripcion(s.nombre); setMonto(String(s.precio)); }
  };

  const crearFactura = async () => {
    const pid = paciente?.id;
    const montoNum = Number(monto);
    const { data } = await api.post("/facturacion", {
      paciente_id: pid,
      cita_id: citaId || null,
      tipo_comprobante: "RECIBO",
      items: [{ descripcion: descripcion.trim() || "Consulta médica", cantidad: 1, precio_unit: montoNum }],
    });
    return data.id;
  };

  const cobrarAhora = async () => {
    setError("");
    const montoNum = Number(monto);
    if (!descripcion.trim()) { setError("Escribe una descripción."); return; }
    if (!Number.isFinite(montoNum) || montoNum <= 0) { setError("Ingresa un monto válido."); return; }
    setProcesando("cobrar");
    try {
      const facturaId = await crearFactura();
      const r = await api.post(`/facturacion/${facturaId}/pagos`, { metodo, monto: montoNum });
      setResultado({ cobrado: true, numero: `#${facturaId}`, total: r.data.total_pagado });
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo registrar el cobro.");
    } finally {
      setProcesando(null);
    }
  };

  const dejarACredito = async () => {
    setError("");
    const montoNum = Number(monto);
    if (!descripcion.trim()) { setError("Escribe una descripción."); return; }
    if (!Number.isFinite(montoNum) || montoNum <= 0) { setError("Ingresa un monto válido."); return; }
    setProcesando("credito");
    try {
      const facturaId = await crearFactura();
      setResultado({ cobrado: false, numero: `#${facturaId}` });
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo dejar el cargo pendiente.");
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10002,
      background: "rgba(15,23,42,.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16,
        boxShadow: "0 16px 48px rgba(0,0,0,.22)", overflow: "hidden",
      }}>
        {resultado ? (
          <div style={{ padding: "30px 26px", textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, margin: "0 auto 14px", borderRadius: "50%",
              background: resultado.cobrado ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#f59e0b,#d97706)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: resultado.cobrado ? "0 8px 22px rgba(34,197,94,.35)" : "0 8px 22px rgba(245,158,11,.35)",
            }}>
              <i className={`bi ${resultado.cobrado ? "bi-check-circle-fill" : "bi-hourglass-split"}`} style={{ color: "#fff", fontSize: "1.6rem" }} />
            </div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#1e293b", marginBottom: 6 }}>
              {resultado.cobrado ? "Cobrado" : "Cargo dejado pendiente"}
            </div>
            <div style={{ fontSize: "0.88rem", color: "#4b5563" }}>
              {resultado.cobrado
                ? <>Recibo <strong>{resultado.numero}</strong> registrado y pagado.</>
                : <>Recibo <strong>{resultado.numero}</strong> queda a cuenta del paciente — sumará a su estado de cuenta.</>}
            </div>
            <button onClick={onListo}
              style={{ marginTop: 18, padding: "9px 24px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>
              Continuar
            </button>
          </div>
        ) : (
          <>
            <div style={{ padding: "22px 22px 10px", textAlign: "center" }}>
              <div style={{
                width: 60, height: 60, margin: "0 auto 12px", borderRadius: "50%",
                background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 22px rgba(37,99,235,.35)",
              }}>
                <i className="bi bi-receipt" style={{ color: "#fff", fontSize: "1.4rem" }} />
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>
                Consulta firmada · ¿Cobrar?
              </div>
              <div style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                Consulta de <strong>{paciente?.nombres} {paciente?.apellidos}</strong>
              </div>
              {esMenor && (
                <div style={{
                  marginTop: 10, background: "#eff6ff", border: "1px solid #bfdbfe",
                  borderRadius: 8, padding: "7px 12px", fontSize: "0.78rem", color: "#1e40af", textAlign: "left",
                }}>
                  <i className="bi bi-info-circle me-1" />
                  Paciente menor de edad: el cargo queda a nombre del <strong>responsable</strong>.
                </div>
              )}
            </div>

            <div style={{ padding: "6px 22px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
              {servicios.length > 0 && (
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Servicio</label>
                  <select value={servicioId} onChange={e => elegirServicio(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.85rem" }}>
                    <option value="">— Monto libre —</option>
                    {servicios.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre} — {Number(s.precio).toFixed(2)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Descripción</label>
                  <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.85rem", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Monto</label>
                  <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.85rem", boxSizing: "border-box" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Método de pago (si cobras ahora)</label>
                <select value={metodo} onChange={e => setMetodo(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.85rem" }}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="SEGURO">Seguro</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: "7px 10px", fontSize: "0.8rem" }}>
                  {error}
                </div>
              )}
            </div>

            <div style={{ padding: "14px 22px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={dejarACredito} disabled={!!procesando}
                  style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid #fbbf24", background: "#fffbeb", color: "#92400e", cursor: procesando ? "wait" : "pointer", fontWeight: 700, fontSize: "0.82rem" }}>
                  <i className="bi bi-hourglass-split me-1" />
                  {procesando === "credito" ? "Guardando…" : "A cuenta del paciente"}
                </button>
                <button onClick={cobrarAhora} disabled={!!procesando}
                  style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", cursor: procesando ? "wait" : "pointer", fontWeight: 700, fontSize: "0.82rem" }}>
                  <i className="bi bi-cash-coin me-1" />
                  {procesando === "cobrar" ? "Cobrando…" : "Cobrar ahora"}
                </button>
              </div>
              <button onClick={onOmitir} disabled={!!procesando}
                style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>
                No cobrar este servicio
              </button>
              <button onClick={onFacturaFormal} disabled={!!procesando}
                style={{ background: "transparent", border: "none", color: "#64748b", fontSize: "0.76rem", cursor: "pointer", textDecoration: "underline", padding: "2px 0 8px" }}>
                Prefiero hacer una factura formal (con RTN/CAI) →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
