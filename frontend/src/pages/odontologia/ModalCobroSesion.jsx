import { useState } from "react";
import api from "../../api/api";
import { dinero } from "./presupuesto.js";

const lbl = { fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" };
const campo = { padding: "7px 9px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: "0.85rem", boxSizing: "border-box" };

/**
 * Cobro de una sesión odontológica con los procedimientos realizados como líneas editables.
 * Reutiliza /facturacion (recibo) y deja la sesión ligada a la factura para no cobrarla dos veces.
 */
export default function ModalCobroSesion({ paciente, sesion, citaId, lineasIniciales, onCerrar, onFacturaFormal }) {
  const [lineas, setLineas] = useState(lineasIniciales);
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [procesando, setProcesando] = useState(null); // "cobrar" | "credito" | null
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const cambiar = (key, patch) => setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const incluidas = lineas.filter((l) => l.incluir && Number(l.precio) > 0 && l.descripcion.trim());
  const total = incluidas.reduce((s, l) => s + Number(l.precio), 0);

  const crearFactura = async () => {
    const { data } = await api.post("/facturacion", {
      paciente_id: paciente.id,
      cita_id: citaId || null,
      tipo_comprobante: "RECIBO",
      items: incluidas.map((l) => ({ descripcion: l.descripcion.trim(), cantidad: 1, precio_unit: Number(l.precio) })),
    });
    // Deja constancia en la sesión (si falla, el cobro ya existe y se avisa)
    try { await api.post(`/odontologia/sesiones/${sesion.id}/factura`, { factura_id: data.id }); }
    catch { /* la factura ya se creó; solo falta el vínculo */ }
    return data.id;
  };

  const validar = () => {
    if (!incluidas.length) { setError("Marca al menos un procedimiento con precio mayor a cero."); return false; }
    setError("");
    return true;
  };

  const procesar = async (modo) => {
    if (!validar()) return;
    setProcesando(modo);
    try {
      const facturaId = await crearFactura();
      if (modo === "cobrar") await api.post(`/facturacion/${facturaId}/pagos`, { metodo, monto: total });
      setResultado({ cobrado: modo === "cobrar", numero: `#${facturaId}`, facturaId });
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo registrar el cobro.");
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Cobro de la sesión" style={{
      position: "fixed", inset: 0, zIndex: 10002, background: "rgba(15,23,42,.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 16px 48px rgba(0,0,0,.22)" }}>
        {resultado ? (
          <div style={{ padding: "30px 26px", textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, margin: "0 auto 14px", borderRadius: "50%",
              background: resultado.cobrado ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#f59e0b,#d97706)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className={`bi ${resultado.cobrado ? "bi-check-circle-fill" : "bi-hourglass-split"}`} style={{ color: "#fff", fontSize: "1.6rem" }} />
            </div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#1e293b", marginBottom: 6 }}>
              {resultado.cobrado ? "Cobrado" : "Cargo dejado pendiente"}
            </div>
            <div style={{ fontSize: "0.88rem", color: "#4b5563" }}>
              Recibo <strong>{resultado.numero}</strong> por <strong>{dinero(total)}</strong>
              {resultado.cobrado ? " registrado y pagado." : " a cuenta del paciente; suma a su estado de cuenta."}
            </div>
            <button onClick={() => onCerrar(resultado.facturaId)}
              style={{ marginTop: 18, padding: "9px 24px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.88rem" }}>
              Continuar
            </button>
          </div>
        ) : (
          <>
            <div style={{ padding: "22px 22px 8px" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#1e293b" }}>
                <i className="bi bi-receipt me-2" style={{ color: "#2563eb" }} />Sesión firmada · ¿Cobrar?
              </div>
              <div style={{ fontSize: "0.85rem", color: "#4b5563", marginTop: 2 }}>
                Atención de <strong>{paciente?.nombres} {paciente?.apellidos}</strong>. Revisa los precios antes de cobrar.
              </div>
            </div>

            <div style={{ padding: "8px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
              {lineas.length === 0 && (
                <div style={{ fontSize: "0.85rem", color: "#64748b", padding: "10px 0" }}>
                  La sesión no tiene procedimientos registrados. Puedes hacer una factura formal desde Facturación.
                </div>
              )}
              {lineas.map((l) => (
                <div key={l.key} style={{ display: "grid", gridTemplateColumns: "auto 1fr 110px", gap: 8, alignItems: "center", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 10, background: l.incluir ? "#fff" : "#f8fafc" }}>
                  <input type="checkbox" checked={l.incluir} onChange={(e) => cambiar(l.key, { incluir: e.target.checked })} aria-label="Incluir en el cobro" />
                  <div>
                    <input value={l.descripcion} onChange={(e) => cambiar(l.key, { descripcion: e.target.value })} style={{ ...campo, width: "100%" }} />
                    {l.origen && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Precio sugerido desde {l.origen}</div>}
                  </div>
                  <input type="number" min="0" step="0.01" value={l.precio} placeholder="Precio"
                    onChange={(e) => cambiar(l.key, { precio: e.target.value, incluir: Number(e.target.value) > 0 ? true : l.incluir })}
                    style={{ ...campo, textAlign: "right" }} />
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 4px", fontWeight: 800, color: "#0f172a" }}>
                <span>Total a cobrar</span><span style={{ fontSize: "1.15rem" }}>{dinero(total)}</span>
              </div>
              <div>
                <label style={lbl}>Método de pago (si cobras ahora)</label>
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)} style={{ ...campo, width: "100%" }}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="SEGURO">Seguro</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: "7px 10px", fontSize: "0.8rem" }}>{error}</div>
              )}
            </div>

            <div style={{ padding: "12px 22px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => procesar("credito")} disabled={!!procesando}
                  style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid #fbbf24", background: "#fffbeb", color: "#92400e", cursor: procesando ? "wait" : "pointer", fontWeight: 700, fontSize: "0.82rem" }}>
                  <i className="bi bi-hourglass-split me-1" />{procesando === "credito" ? "Guardando…" : "A cuenta del paciente"}
                </button>
                <button onClick={() => procesar("cobrar")} disabled={!!procesando}
                  style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", cursor: procesando ? "wait" : "pointer", fontWeight: 700, fontSize: "0.82rem" }}>
                  <i className="bi bi-cash-coin me-1" />{procesando === "cobrar" ? "Cobrando…" : "Cobrar ahora"}
                </button>
              </div>
              <button onClick={() => onCerrar(null)} disabled={!!procesando}
                style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>
                No cobrar ahora
              </button>
              <button onClick={onFacturaFormal} disabled={!!procesando}
                style={{ background: "transparent", border: "none", color: "#64748b", fontSize: "0.76rem", cursor: "pointer", textDecoration: "underline", padding: "2px 0 4px" }}>
                Prefiero hacer una factura formal (con RTN/CAI) →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
