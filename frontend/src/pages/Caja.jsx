import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import api from "../api/api";

function fmtL(n) {
  return `L ${Number(n || 0).toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const METODO_LABEL = { EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", SEGURO: "Seguro", OTRO: "Otro" };
const METODO_ICON  = { EFECTIVO: "bi-cash", TARJETA: "bi-credit-card", TRANSFERENCIA: "bi-bank", SEGURO: "bi-shield-check", OTRO: "bi-three-dots" };

function KpiCard({ label, value, icon, gradient, sub }) {
  return (
    <div className="col-6 col-lg-3">
      <div style={{
        background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #e5e7eb",
        boxShadow: "0 6px 20px rgba(0,0,0,0.05)", position: "relative", overflow: "hidden", height: "100%",
      }}>
        <div style={{
          position: "absolute", top: -26, right: -26, width: 100, height: 100,
          background: gradient, borderRadius: "50%", opacity: 0.13, filter: "blur(36px)",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 44, height: 44, borderRadius: 12, background: gradient,
            marginBottom: 12, color: "#fff", fontSize: 18, boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
          }}>
            <i className={`bi ${icon}`} />
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1e293b" }}>{value}</div>
          <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>{label}</div>
          {sub && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function ModalAbrirCaja({ onClose, onAbierta }) {
  const [montoInicial, setMontoInicial] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrir = async () => {
    setError("");
    const monto = Number(montoInicial);
    if (!Number.isFinite(monto) || monto < 0) { setError("Ingresa un monto inicial válido"); return; }
    setGuardando(true);
    try {
      await api.post("/caja/abrir", { monto_inicial: monto, notas: notas || null });
      onAbierta();
    } catch (e) {
      setError(e.response?.data?.msg || "Error al abrir la caja");
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "min(440px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,.3)", margin: "auto" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h6 style={{ margin: 0, fontWeight: 700 }}>Abrir caja</h6>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Monto inicial en caja</label>
          <input type="number" min="0" step="0.01" autoFocus value={montoInicial}
            onChange={e => setMontoInicial(e.target.value)}
            placeholder="0.00"
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 15, marginBottom: 14 }} />
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, resize: "vertical" }} />
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={abrir} disabled={guardando} style={{ background: "#16a34a", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: guardando ? "wait" : "pointer" }}>
            {guardando ? "Abriendo..." : "Abrir caja"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModalCerrarCaja({ turno, onClose, onCerrada }) {
  const [montoContado, setMontoContado] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const contado = Number(montoContado);
  const hayMonto = montoContado !== "" && Number.isFinite(contado);
  const diferencia = hayMonto ? contado - turno.esperado_ahora : null;

  const cerrar = async () => {
    setError("");
    if (!hayMonto || contado < 0) { setError("Ingresa el monto contado"); return; }
    setGuardando(true);
    try {
      const r = await api.post(`/caja/${turno.id}/cerrar`, { monto_contado: contado, notas: notas || null });
      onCerrada(r.data.data);
    } catch (e) {
      setError(e.response?.data?.msg || "Error al cerrar la caja");
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "min(460px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,.3)", margin: "auto" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h6 style={{ margin: 0, fontWeight: 700 }}>Cerrar caja</h6>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#374151" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Monto inicial</span><strong>{fmtL(turno.monto_inicial)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Efectivo esperado ahora</span><strong>{fmtL(turno.esperado_ahora)}</strong>
            </div>
          </div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Efectivo contado físicamente</label>
          <input type="number" min="0" step="0.01" autoFocus value={montoContado}
            onChange={e => setMontoContado(e.target.value)}
            placeholder="0.00"
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 15, marginBottom: 10 }} />
          {hayMonto && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: diferencia >= 0 ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${diferencia >= 0 ? "#bbf7d0" : "#fecaca"}`,
              borderRadius: 8, padding: "8px 12px", marginBottom: 14,
            }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: diferencia >= 0 ? "#166534" : "#991b1b" }}>
                {diferencia === 0 ? "Cuadra exacto" : diferencia > 0 ? "Sobrante" : "Faltante"}
              </span>
              <span style={{ fontWeight: 800, color: diferencia >= 0 ? "#16a34a" : "#dc2626" }}>{fmtL(Math.abs(diferencia))}</span>
            </div>
          )}
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, resize: "vertical" }} />
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          <button onClick={cerrar} disabled={guardando} style={{ background: "#dc2626", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: guardando ? "wait" : "pointer" }}>
            {guardando ? "Cerrando..." : "Confirmar cierre"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModalDetalleTurno({ turnoId, onClose }) {
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    api.get(`/caja/${turnoId}`).then(r => setDetalle(r.data.data)).catch(() => {});
  }, [turnoId]);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "min(560px, 100%)", maxHeight: "calc(100vh - 48px)", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)", margin: "auto" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h6 style={{ margin: 0, fontWeight: 700 }}>Detalle del turno #{turnoId}</h6>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
        </div>
        {!detalle ? (
          <div style={{ textAlign: "center", padding: 40 }}><span className="spinner-border spinner-border-sm" /></div>
        ) : (
          <div style={{ padding: 22 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18, fontSize: 13 }}>
              <div><span style={{ color: "#6b7280" }}>Abrió:</span> {detalle.apertura_nombres} {detalle.apertura_apellidos}</div>
              <div><span style={{ color: "#6b7280" }}>Cerró:</span> {detalle.cierre_nombres ? `${detalle.cierre_nombres} ${detalle.cierre_apellidos}` : "—"}</div>
              <div><span style={{ color: "#6b7280" }}>Apertura:</span> {dayjs(detalle.abierto_en).format("D/M/YYYY h:mm A")}</div>
              <div><span style={{ color: "#6b7280" }}>Cierre:</span> {detalle.cerrado_en ? dayjs(detalle.cerrado_en).format("D/M/YYYY h:mm A") : "—"}</div>
              <div><span style={{ color: "#6b7280" }}>Inicial:</span> {fmtL(detalle.monto_inicial)}</div>
              <div><span style={{ color: "#6b7280" }}>Esperado:</span> {fmtL(detalle.monto_esperado)}</div>
              <div><span style={{ color: "#6b7280" }}>Contado:</span> {fmtL(detalle.monto_contado)}</div>
              <div>
                <span style={{ color: "#6b7280" }}>Diferencia:</span>{" "}
                <strong style={{ color: Number(detalle.diferencia) >= 0 ? "#16a34a" : "#dc2626" }}>{fmtL(detalle.diferencia)}</strong>
              </div>
            </div>

            <h6 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Desglose por método</h6>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
              {detalle.por_metodo.map(m => (
                <div key={m.metodo} style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", borderRadius: 8, padding: "7px 12px", fontSize: 13 }}>
                  <span><i className={`bi ${METODO_ICON[m.metodo] || "bi-cash"} me-2`} />{METODO_LABEL[m.metodo] || m.metodo} ({m.cantidad})</span>
                  <strong>{fmtL(m.total)}</strong>
                </div>
              ))}
            </div>

            <h6 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Pagos del turno ({detalle.pagos.length})</h6>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              {detalle.pagos.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 12.5 }}>
                  <span>{p.numero_completo || p.numero} — {p.pac_nombres} {p.pac_apellidos}</span>
                  <span style={{ fontWeight: 700 }}>{fmtL(p.monto)} <span style={{ color: "#9ca3af" }}>({METODO_LABEL[p.metodo]})</span></span>
                </div>
              ))}
              {!detalle.pagos.length && <div style={{ padding: 12, fontSize: 12.5, color: "#9ca3af" }}>Sin pagos registrados.</div>}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function Caja() {
  const [tab, setTab] = useState("actual");
  const [turno, setTurno] = useState(undefined); // undefined = cargando, null = sin turno
  const [showAbrir, setShowAbrir] = useState(false);
  const [showCerrar, setShowCerrar] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [detalleId, setDetalleId] = useState(null);

  const cargarActual = useCallback(() => {
    api.get("/caja/actual").then(r => setTurno(r.data.data)).catch(() => setTurno(null));
  }, []);

  const cargarHistorial = useCallback(() => {
    const params = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    api.get("/caja/historial", { params }).then(r => setHistorial(r.data.data || [])).catch(() => {});
  }, [desde, hasta]);

  useEffect(() => { cargarActual(); }, [cargarActual]);
  useEffect(() => { if (tab === "historial") cargarHistorial(); }, [tab, cargarHistorial]);

  const otrosMetodos = (turno?.por_metodo || []).filter(m => m.metodo !== "EFECTIVO");
  const efectivo = (turno?.por_metodo || []).find(m => m.metodo === "EFECTIVO");
  const totalPagos = (turno?.por_metodo || []).reduce((s, m) => s + Number(m.cantidad), 0);

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#16a34a,#15803d)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="bi bi-cash-stack" style={{ color: "#fff", fontSize: 20 }} />
        </div>
        <div>
          <h5 style={{ margin: 0, fontWeight: 700 }}>Caja</h5>
          <span style={{ fontSize: 13, color: "#64748b" }}>Apertura, arqueo y cierre de turno</span>
        </div>
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === "actual" ? "active" : ""}`} onClick={() => setTab("actual")} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            <i className="bi bi-wallet2 me-1" /> Turno actual
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "historial" ? "active" : ""}`} onClick={() => setTab("historial")} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            <i className="bi bi-clock-history me-1" /> Historial
          </button>
        </li>
      </ul>

      {tab === "actual" && (
        turno === undefined ? (
          <div className="text-center py-4"><span className="spinner-border spinner-border-sm" /></div>
        ) : turno === null ? (
          <div style={{ textAlign: "center", padding: "56px 16px", background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb" }}>
            <i className="bi bi-wallet2" style={{ fontSize: "2.4rem", color: "#cbd5e1" }} />
            <p style={{ color: "#6b7280", margin: "12px 0 18px" }}>No hay ningún turno de caja abierto.</p>
            <button onClick={() => setShowAbrir(true)} className="btn btn-success" style={{ borderRadius: 8, fontWeight: 600, padding: "8px 22px" }}>
              <i className="bi bi-plus-lg me-1" /> Abrir caja
            </button>
          </div>
        ) : (
          <>
            <div className="row g-3" style={{ marginBottom: 18 }}>
              <KpiCard label="Monto inicial" value={fmtL(turno.monto_inicial)} icon="bi-piggy-bank"
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" />
              <KpiCard label="Efectivo cobrado" value={fmtL(efectivo?.total || 0)} icon="bi-cash"
                gradient="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                sub={`Esperado ahora: ${fmtL(turno.esperado_ahora)}`} />
              <KpiCard label="Otros métodos" value={fmtL(otrosMetodos.reduce((s, m) => s + Number(m.total), 0))} icon="bi-credit-card"
                gradient="linear-gradient(135deg, #4facfe 0%, #00c2fe 100%)" />
              <KpiCard label="Pagos registrados" value={totalPagos} icon="bi-receipt"
                gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                sub={`Abierto: ${dayjs(turno.abierto_en).format("D/M h:mm A")}`} />
            </div>

            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: 20, marginBottom: 18 }}>
              <h6 style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 12 }}>Desglose por método de pago</h6>
              {(turno.por_metodo || []).length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Sin pagos registrados todavía en este turno.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {turno.por_metodo.map(m => (
                    <div key={m.metodo} style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", borderRadius: 8, padding: "9px 14px", fontSize: 13.5 }}>
                      <span><i className={`bi ${METODO_ICON[m.metodo] || "bi-cash"} me-2`} style={{ color: "#166ae8" }} />{METODO_LABEL[m.metodo] || m.metodo} <span style={{ color: "#9ca3af" }}>({m.cantidad})</span></span>
                      <strong>{fmtL(m.total)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => setShowCerrar(true)} className="btn btn-danger" style={{ borderRadius: 8, fontWeight: 600, padding: "9px 24px" }}>
              <i className="bi bi-lock-fill me-1" /> Cerrar caja
            </button>
          </>
        )
      )}

      {tab === "historial" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Desde</span>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta || undefined}
              style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 10px", fontSize: 12 }} />
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Hasta</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde || undefined}
              style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 10px", fontSize: 12 }} />
          </div>

          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
            {historial.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>Sin turnos cerrados todavía.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Apertura", "Cierre", "Abrió", "Cerró", "Inicial", "Esperado", "Contado", "Diferencia"].map(h => (
                        <th key={h} style={{ padding: "9px 12px", fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map(h => (
                      <tr key={h.id} onClick={() => setDetalleId(h.id)} style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px 12px", fontSize: 12.5 }}>{dayjs(h.abierto_en).format("D/M/YYYY h:mm A")}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12.5 }}>{dayjs(h.cerrado_en).format("D/M/YYYY h:mm A")}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12.5 }}>{h.apertura_nombres} {h.apertura_apellidos}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12.5 }}>{h.cierre_nombres ? `${h.cierre_nombres} ${h.cierre_apellidos}` : "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12.5 }}>{fmtL(h.monto_inicial)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12.5 }}>{fmtL(h.monto_esperado)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12.5 }}>{fmtL(h.monto_contado)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12.5, fontWeight: 700, color: Number(h.diferencia) >= 0 ? "#16a34a" : "#dc2626" }}>
                          {Number(h.diferencia) >= 0 ? "+" : ""}{fmtL(h.diferencia)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showAbrir && (
        <ModalAbrirCaja onClose={() => setShowAbrir(false)} onAbierta={() => { setShowAbrir(false); cargarActual(); }} />
      )}
      {showCerrar && turno && (
        <ModalCerrarCaja turno={turno} onClose={() => setShowCerrar(false)}
          onCerrada={() => { setShowCerrar(false); setTurno(null); cargarActual(); }} />
      )}
      {detalleId && (
        <ModalDetalleTurno turnoId={detalleId} onClose={() => setDetalleId(null)} />
      )}
    </div>
  );
}
