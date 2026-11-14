import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import api from "../../api/api";

// Super admin → Cobranza: cuánto le toca pagar a cada clínica, cuánto ha pagado,
// quién está atrasado y cuánto dinero se ha generado. Los pagos se registran aquí.

const C = {
  card: "#162a45", card2: "#1b3254", border: "rgba(255,255,255,0.08)", accent: "#2196f3",
  success: "#10b981", warning: "#f59e0b", danger: "#ef4444", text: "#e2e8f0", muted: "#94a3b8", violet: "#8b5cf6",
};
const SIMBOLO = { HNL: "L", USD: "$", EUR: "€", GTQ: "Q", MXN: "$", PEN: "S/" };
const dinero = (n, moneda = "HNL") => `${SIMBOLO[moneda] || moneda} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dineroCorto = (n, moneda = "HNL") => `${SIMBOLO[moneda] || moneda} ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
/** {HNL: 100, USD: 5} → "L 100.00 · $ 5.00" */
const porMoneda = (obj, corto = false) => {
  const e = Object.entries(obj || {}).filter(([, v]) => Number(v) !== 0);
  if (!e.length) return corto ? "L 0" : "L 0.00";
  return e.map(([m, v]) => (corto ? dineroCorto(v, m) : dinero(v, m))).join(" · ");
};
const fFecha = (t, conAnio = true) => {
  if (!t) return "—";
  const [y, m, d] = String(t).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-HN", { day: "numeric", month: "short", ...(conAnio ? { year: "numeric" } : {}) });
};
const fMes = (ym, largo = false) => {
  const [y, m] = ym.split("-").map(Number);
  const t = new Date(y, m - 1, 1).toLocaleDateString("es-HN", { month: largo ? "long" : "short", year: largo ? "numeric" : "2-digit" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const hoyTexto = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const ESTADOS = {
  atrasado: { label: "Atrasada", color: C.danger, icon: "bi-exclamation-octagon-fill" },
  pendiente: { label: "Por pagar", color: C.warning, icon: "bi-hourglass-split" },
  al_dia: { label: "Al día", color: C.success, icon: "bi-check-circle-fill" },
  adelantado: { label: "Adelantada", color: C.accent, icon: "bi-stars" },
  sin_cuota: { label: "Sin cuota", color: C.muted, icon: "bi-dash-circle" },
};
const ESTADO_CUOTA = {
  pagada: { label: "Pagada", color: C.success },
  parcial: { label: "Parcial", color: C.warning },
  pendiente: { label: "Por pagar", color: C.warning },
  atrasada: { label: "Atrasada", color: C.danger },
  programada: { label: "Próxima", color: C.muted },
};
const METODOS = [
  { k: "TRANSFERENCIA", t: "Transferencia", i: "bi-bank" },
  { k: "DEPOSITO", t: "Depósito", i: "bi-piggy-bank" },
  { k: "EFECTIVO", t: "Efectivo", i: "bi-cash" },
  { k: "TARJETA", t: "Tarjeta", i: "bi-credit-card" },
  { k: "OTRO", t: "Otro", i: "bi-three-dots" },
];
const PLAN = { trial: "Prueba", semestral: "Semestral", anual: "Anual" };

function Chip({ color, icon, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${color}1f`, color, border: `1px solid ${color}55`, borderRadius: 999, padding: "2px 9px", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {icon && <i className={`bi ${icon}`} />}{children}
    </span>
  );
}

function Kpi({ label, value, icon, color, sub }) {
  return (
    <div className="cb-kpi" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: "0.76rem", fontWeight: 600 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: `${color}22`, color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><i className={`bi ${icon}`} /></span>
        {label}
      </div>
      <div className="cb-val" style={{ fontSize: "1.35rem", fontWeight: 800, color: C.text, lineHeight: 1.2, marginTop: 8, overflowWrap: "anywhere" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Ventana({ titulo, icono, onCerrar, children, ancho = 560 }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1080, background: "rgba(2,8,23,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }} onClick={onCerrar}>
      <div style={{ background: "#10213a", border: `1px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: ancho, maxHeight: "92vh", overflowY: "auto", color: C.text, boxShadow: "0 24px 60px rgba(0,0,0,.5)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: "#10213a", zIndex: 1 }}>
          <i className={`bi ${icono}`} style={{ color: C.accent, fontSize: "1.1rem" }} />
          <strong style={{ fontSize: "1rem", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</strong>
          <button type="button" className="btn-close btn-close-white ms-auto" aria-label="Cerrar" onClick={onCerrar} />
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

const inp = { width: "100%", background: "#0b1a2e", border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, padding: "9px 12px", fontSize: "0.9rem" };
const lbl = { display: "block", fontSize: "0.76rem", fontWeight: 700, color: C.muted, marginBottom: 5 };

function ModalPago({ clinicas, inicial, onCerrar, onGuardado }) {
  const [clinicaId, setClinicaId] = useState(inicial?.id ? String(inicial.id) : "");
  const cl = clinicas.find((c) => String(c.id) === clinicaId);
  const sugerido = cl ? (cl.saldo > 0 ? cl.saldo : cl.cuota_mensual || "") : "";
  const [monto, setMonto] = useState(inicial ? String(sugerido || "") : "");
  const [fecha, setFecha] = useState(hoyTexto());
  const [metodo, setMetodo] = useState("TRANSFERENCIA");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const moneda = cl?.moneda || "HNL";

  const elegir = (id) => {
    setClinicaId(id);
    const c = clinicas.find((x) => String(x.id) === id);
    if (c) setMonto(String(c.saldo > 0 ? c.saldo : c.cuota_mensual || ""));
  };
  const guardar = async () => {
    setError("");
    if (!clinicaId) return setError("Elija la clínica.");
    if (!(Number(monto) > 0)) return setError("Escriba un monto mayor a cero.");
    setGuardando(true);
    try {
      await api.post("/cobranza/pagos", { clinica_id: Number(clinicaId), monto: Number(monto), fecha, metodo, referencia, notas, moneda });
      onGuardado(`Pago de ${dinero(monto, moneda)} registrado para ${cl?.nombre || "la clínica"}.`);
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo registrar el pago.");
      setGuardando(false);
    }
  };

  return (
    <Ventana titulo="Registrar pago" icono="bi-cash-coin" onCerrar={onCerrar} ancho={500}>
      <label style={lbl}>Clínica</label>
      <select style={inp} value={clinicaId} onChange={(e) => elegir(e.target.value)}>
        <option value="">— Elija la clínica —</option>
        {clinicas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.saldo > 0 ? ` · debe ${dinero(c.saldo, c.moneda)}` : ""}</option>)}
      </select>
      {cl && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: "0.8rem", color: C.muted }}>
          <span>Cuota: <b style={{ color: C.text }}>{cl.cuota_mensual ? dinero(cl.cuota_mensual, moneda) : "—"}</b></span>
          <span>· Saldo: <b style={{ color: cl.saldo > 0 ? C.warning : C.success }}>{cl.saldo > 0 ? dinero(cl.saldo, moneda) : cl.saldo < 0 ? `a favor ${dinero(-cl.saldo, moneda)}` : "al día"}</b></span>
        </div>
      )}
      <div className="row g-2 mt-1">
        <div className="col-7">
          <label style={lbl}>Monto ({SIMBOLO[moneda] || moneda})</label>
          <input style={{ ...inp, fontSize: "1.1rem", fontWeight: 800 }} type="number" min="0" step="0.01" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="col-5">
          <label style={lbl}>Fecha</label>
          <input style={inp} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>
      {cl?.cuota_mensual > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {[1, 2, 3, 6, 12].map((n) => (
            <button key={n} type="button" onClick={() => setMonto(String(Math.round(cl.cuota_mensual * n * 100) / 100))}
              style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 999, padding: "3px 10px", fontSize: "0.74rem", cursor: "pointer" }}>
              {n} {n === 1 ? "cuota" : "cuotas"}
            </button>
          ))}
          {cl.saldo > 0 && (
            <button type="button" onClick={() => setMonto(String(cl.saldo))}
              style={{ background: `${C.warning}22`, border: `1px solid ${C.warning}66`, color: C.warning, borderRadius: 999, padding: "3px 10px", fontSize: "0.74rem", fontWeight: 700, cursor: "pointer" }}>
              Todo lo que debe
            </button>
          )}
        </div>
      )}
      <label style={{ ...lbl, marginTop: 14 }}>¿Cómo pagó?</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {METODOS.map((m) => (
          <button key={m.k} type="button" onClick={() => setMetodo(m.k)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 10, padding: "7px 12px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
              background: metodo === m.k ? C.accent : "transparent", color: metodo === m.k ? "#fff" : C.muted, border: `1px solid ${metodo === m.k ? C.accent : C.border}` }}>
            <i className={`bi ${m.i}`} />{m.t}
          </button>
        ))}
      </div>
      <label style={{ ...lbl, marginTop: 14 }}>Referencia <span style={{ fontWeight: 400 }}>(opcional)</span></label>
      <input style={inp} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N.º de transferencia, banco…" />
      <label style={{ ...lbl, marginTop: 12 }}>Notas <span style={{ fontWeight: 400 }}>(opcional)</span></label>
      <input style={inp} value={notas} onChange={(e) => setNotas(e.target.value)} />
      {error && <div style={{ color: C.danger, fontSize: "0.85rem", marginTop: 10 }}><i className="bi bi-exclamation-circle me-1" />{error}</div>}
      <button type="button" disabled={guardando} onClick={guardar}
        style={{ width: "100%", marginTop: 16, background: `linear-gradient(135deg, ${C.success}, #059669)`, color: "#fff", border: "none", borderRadius: 12, padding: "11px", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer" }}>
        {guardando ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-check2-circle me-2" />}Registrar pago
      </button>
    </Ventana>
  );
}

function ModalCuenta({ clinica, onCerrar, onPagar, onCambio }) {
  const [d, setD] = useState(null);
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let vivo = true;
    api.get(`/cobranza/clinica/${clinica.id}`).then((r) => { if (vivo) setD(r.data.data); }).catch(() => { if (vivo) setD({ error: true }); });
    return () => { vivo = false; };
  }, [clinica.id, recarga]);
  const anular = async (p) => {
    if (!window.confirm(`¿Anular el pago de ${dinero(p.monto, p.moneda)} del ${fFecha(p.fecha)}? Dejará de contar en la cuenta.`)) return;
    await api.put(`/cobranza/pagos/${p.id}/anular`).catch(() => alert("No se pudo anular."));
    setRecarga((n) => n + 1); onCambio?.();
  };
  const moneda = clinica.moneda || "HNL";
  return (
    <Ventana titulo={`Estado de cuenta · ${clinica.nombre}`} icono="bi-journal-text" onCerrar={onCerrar} ancho={720}>
      {!d ? <div className="text-center py-4" style={{ color: C.muted }}><span className="spinner-border spinner-border-sm me-2" />Cargando…</div>
        : d.error ? <div style={{ color: C.danger }}>No se pudo cargar la cuenta.</div> : (
          <>
            <div className="cb-mini">
              <div><small>Le toca pagar (a hoy)</small><b>{dinero(d.esperado, moneda)}</b></div>
              <div><small>Ha pagado</small><b style={{ color: C.success }}>{dinero(d.pagado, moneda)}</b></div>
              <div><small>{d.saldo < 0 ? "Saldo a favor" : "Debe"}</small><b style={{ color: d.saldo > 0 ? C.warning : C.success }}>{dinero(Math.abs(d.saldo), moneda)}</b></div>
              <div><small>Contrato completo</small><b>{dinero(d.total_contrato, moneda)}</b></div>
            </div>
            <button type="button" onClick={() => onPagar(clinica)}
              style={{ width: "100%", margin: "12px 0 16px", background: `linear-gradient(135deg, ${C.success}, #059669)`, color: "#fff", border: "none", borderRadius: 12, padding: "10px", fontWeight: 800, cursor: "pointer" }}>
              <i className="bi bi-plus-circle me-2" />Registrar pago
            </button>

            <div style={{ fontWeight: 800, fontSize: "0.85rem", marginBottom: 8 }}><i className="bi bi-calendar3 me-2" style={{ color: C.accent }} />Cuotas</div>
            {d.detalle.length === 0 ? (
              <div style={{ color: C.muted, fontSize: "0.85rem" }}>Esta clínica no tiene cuota mensual en su licencia. Puede ponerla en Clínicas → Licencia.</div>
            ) : (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                {d.detalle.map((q) => {
                  const e = ESTADO_CUOTA[q.estado] || ESTADO_CUOTA.programada;
                  return (
                    <div key={q.periodo} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", fontSize: "0.85rem" }}>
                      <div style={{ minWidth: 120, flex: "1 1 120px" }}>
                        <div style={{ fontWeight: 700 }}>{fMes(q.periodo, true)}</div>
                        <div style={{ fontSize: "0.72rem", color: C.muted }}>Cobro: {fFecha(q.fecha_cobro)}{q.recibo ? ` · ${q.recibo.numero}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                        <div style={{ fontWeight: 700 }}>{dinero(q.monto, q.moneda)}</div>
                        {q.estado === "parcial" && <div style={{ fontSize: "0.72rem", color: C.warning }}>falta {dinero(q.falta, q.moneda)}</div>}
                      </div>
                      <Chip color={e.color}>{e.label}</Chip>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontWeight: 800, fontSize: "0.85rem", margin: "18px 0 8px" }}><i className="bi bi-cash-stack me-2" style={{ color: C.success }} />Pagos recibidos</div>
            {d.pagos.length === 0 ? <div style={{ color: C.muted, fontSize: "0.85rem" }}>Todavía no hay pagos registrados.</div> : (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                {d.pagos.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", fontSize: "0.85rem", opacity: p.anulado ? 0.5 : 1 }}>
                    <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                      <div style={{ fontWeight: 700, textDecoration: p.anulado ? "line-through" : "none" }}>{dinero(p.monto, p.moneda)}</div>
                      <div style={{ fontSize: "0.72rem", color: C.muted }}>
                        {fFecha(p.fecha)} · {(METODOS.find((m) => m.k === p.metodo) || {}).t || p.metodo}{p.referencia ? ` · ${p.referencia}` : ""}{p.notas ? ` · ${p.notas}` : ""}
                      </div>
                    </div>
                    {p.anulado ? <Chip color={C.muted}>Anulado</Chip> : (
                      <button type="button" onClick={() => anular(p)} style={{ background: "transparent", border: `1px solid ${C.danger}55`, color: C.danger, borderRadius: 8, padding: "3px 9px", fontSize: "0.74rem", cursor: "pointer" }}>
                        <i className="bi bi-x-circle me-1" />Anular
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
    </Ventana>
  );
}

export default function Cobranza() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [buscar, setBuscar] = useState("");
  const [pago, setPago] = useState(null);     // { clinica } | {}
  const [cuenta, setCuenta] = useState(null); // clinica
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    api.get("/cobranza/resumen").then((r) => { setD(r.data.data); setError(""); })
      .catch((e) => setError(e.response?.data?.msg || "No se pudo cargar la cobranza."));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const lista = useMemo(() => {
    if (!d) return [];
    const q = buscar.trim().toLowerCase();
    const orden = { atrasado: 0, pendiente: 1, al_dia: 2, adelantado: 3, sin_cuota: 4 };
    return d.clinicas
      .filter((c) => filtro === "todas" || (filtro === "al_dia" ? ["al_dia", "adelantado"].includes(c.estado) : c.estado === filtro))
      .filter((c) => !q || c.nombre.toLowerCase().includes(q))
      .sort((a, b) => (orden[a.estado] - orden[b.estado]) || (b.saldo - a.saldo) || a.nombre.localeCompare(b.nombre));
  }, [d, filtro, buscar]);

  const monedaPrincipal = useMemo(() => {
    if (!d) return "HNL";
    const cuenta = {};
    d.clinicas.forEach((c) => { cuenta[c.moneda] = (cuenta[c.moneda] || 0) + 1; });
    return Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0]?.[0] || "HNL";
  }, [d]);
  const grafica = useMemo(() => (d ? d.serie.map((s) => ({ mes: fMes(s.mes), Cobrado: s.cobrado[monedaPrincipal] || 0, "Le tocaba": s.esperado[monedaPrincipal] || 0 })) : []), [d, monedaPrincipal]);

  const guardado = (msg) => { setPago(null); setAviso(msg); cargar(); setTimeout(() => setAviso(""), 4000); };

  if (error) return <div className="p-4" style={{ color: C.danger }}><i className="bi bi-exclamation-triangle me-2" />{error}</div>;
  if (!d) return <div className="p-5 text-center" style={{ color: C.muted }}><span className="spinner-border spinner-border-sm me-2" />Cargando cobranza…</div>;

  const t = d.totales;
  const filtros = [
    { k: "todas", t: "Todas", n: d.clinicas.length, c: C.accent },
    { k: "atrasado", t: "Atrasadas", n: d.conteo.atrasadas, c: C.danger },
    { k: "pendiente", t: "Por pagar", n: d.conteo.pendientes, c: C.warning },
    { k: "al_dia", t: "Al día", n: d.conteo.al_dia, c: C.success },
    { k: "sin_cuota", t: "Sin cuota", n: d.conteo.sin_cuota, c: C.muted },
  ];

  return (
    <div className="cobranza" style={{ padding: "18px 16px 40px", color: C.text, maxWidth: 1400, margin: "0 auto" }}>
      <style>{`
        .cobranza .cb-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; }
        .cobranza .cb-kpi { background:${C.card}; border:1px solid ${C.border}; border-radius:14px; padding:14px 16px; min-width:0; }
        .cobranza .cb-panel { background:${C.card}; border:1px solid ${C.border}; border-radius:14px; padding:16px; min-width:0; }
        .cobranza .cb-dos { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr); gap:14px; }
        .cobranza .cb-fila { display:grid; grid-template-columns:minmax(0,2.2fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.1fr) auto; gap:10px; align-items:center; padding:12px 14px; border-bottom:1px solid ${C.border}; }
        .cobranza .cb-fila:hover { background:rgba(255,255,255,.03); }
        .cobranza .cb-cab { font-size:.7rem; font-weight:800; color:${C.muted}; text-transform:uppercase; letter-spacing:.05em; }
        .cobranza .cb-et { display:none; font-size:.68rem; color:${C.muted}; font-weight:700; text-transform:uppercase; }
        .cobranza .cb-btn { display:inline-flex; align-items:center; gap:5px; border-radius:9px; padding:6px 10px; font-size:.78rem; font-weight:700; cursor:pointer; white-space:nowrap; }
        .cb-mini { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
        .cb-mini > div { background:#0b1a2e; border:1px solid ${C.border}; border-radius:12px; padding:10px 12px; min-width:0; }
        .cb-mini small { display:block; color:${C.muted}; font-size:.7rem; font-weight:700; }
        .cb-mini b { display:block; font-size:1rem; margin-top:2px; overflow-wrap:anywhere; }
        @media (max-width: 991px) {
          .cobranza .cb-dos { grid-template-columns:minmax(0,1fr); }
          .cobranza .cb-cab { display:none; }
          .cobranza .cb-fila { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
          .cobranza .cb-fila > .cb-nombre, .cobranza .cb-fila > .cb-acc { grid-column:1 / -1; }
          .cobranza .cb-et { display:block; }
        }
        @media (max-width: 576px) {
          .cb-mini { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .cobranza .cb-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
          .cobranza .cb-kpi { padding:10px 11px; }
          .cobranza .cb-kpi .cb-val { font-size:1.02rem !important; }
          .cobranza .cb-kpis > .cb-kpi:last-child { grid-column:1 / -1; }
        }
      `}</style>

      {/* Encabezado */}
      <div className="cb-panel d-flex align-items-center gap-3 flex-wrap mb-3" style={{ background: "linear-gradient(135deg, #0f2a4a, #123a63)" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${C.success}, #059669)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>
          <i className="bi bi-cash-coin" />
        </div>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: "1.35rem", fontWeight: 800 }}>Cobranza</div>
          <div style={{ color: C.muted, fontSize: "0.85rem" }}>Cuánto le toca pagar a cada clínica, cuánto ha pagado y cuánto se ha generado</div>
        </div>
        <button type="button" className="cb-btn" onClick={() => setPago({})}
          style={{ background: `linear-gradient(135deg, ${C.success}, #059669)`, color: "#fff", border: "none", padding: "10px 16px", fontSize: "0.9rem" }}>
          <i className="bi bi-plus-circle" />Registrar pago
        </button>
      </div>

      {aviso && <div style={{ background: `${C.success}22`, border: `1px solid ${C.success}66`, color: "#6ee7b7", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: "0.88rem" }}><i className="bi bi-check-circle-fill me-2" />{aviso}</div>}

      {/* Indicadores */}
      <div className="cb-kpis mb-3">
        <Kpi label="Cobrado este mes" value={porMoneda(t.cobrado_mes)} icon="bi-calendar-check" color={C.success} sub={`Este año: ${porMoneda(t.cobrado_anio, true)}`} />
        <Kpi label="Generado en total" value={porMoneda(t.cobrado_total)} icon="bi-graph-up-arrow" color={C.violet} sub="Todos los pagos registrados" />
        <Kpi label="Por cobrar" value={porMoneda(t.por_cobrar)} icon="bi-hourglass-split" color={C.warning} sub={`${d.conteo.atrasadas + d.conteo.pendientes} clínica(s) con saldo`} />
        <Kpi label="Atrasado" value={porMoneda(t.atrasado)} icon="bi-exclamation-octagon" color={C.danger} sub={`Más de ${d.dias_gracia} días sin pagar`} />
        <Kpi label="Ingreso mensual" value={porMoneda(t.mensual_esperado)} icon="bi-arrow-repeat" color={C.accent}
          sub={`${d.conteo.pagando} clínica(s) con cuota · próximo mes ${porMoneda(d.proyeccion[0]?.esperado, true)}`} />
      </div>

      {/* Gráfica + próximos meses */}
      <div className="cb-dos mb-3">
        <div className="cb-panel">
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            <i className="bi bi-bar-chart-fill" style={{ color: C.accent }} />
            <strong style={{ fontSize: "0.92rem" }}>Últimos 12 meses</strong>
            <span style={{ color: C.muted, fontSize: "0.76rem" }}>(en {SIMBOLO[monedaPrincipal] || monedaPrincipal})</span>
          </div>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={grafica} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,.04)" }} contentStyle={{ background: "#0b1a2e", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }}
                  formatter={(v, n) => [dinero(v, monedaPrincipal), n]} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                <Bar dataKey="Le tocaba" fill="rgba(148,163,184,.35)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Cobrado" fill={C.success} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="cb-panel">
          <div className="d-flex align-items-center gap-2 mb-2"><i className="bi bi-calendar-range" style={{ color: C.violet }} /><strong style={{ fontSize: "0.92rem" }}>Lo que viene</strong></div>
          {d.proyeccion.map((p) => (
            <div key={p.mes} className="d-flex justify-content-between align-items-center" style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: "0.88rem" }}>
              <span>{fMes(p.mes, true)}</span><b>{porMoneda(p.esperado)}</b>
            </div>
          ))}
          <div className="d-flex align-items-center gap-2 mt-3 mb-2"><i className="bi bi-clock-history" style={{ color: C.success }} /><strong style={{ fontSize: "0.92rem" }}>Últimos pagos</strong></div>
          {d.pagos_recientes.length === 0 ? <div style={{ color: C.muted, fontSize: "0.84rem" }}>Aún no hay pagos registrados.</div>
            : d.pagos_recientes.slice(0, 6).map((p) => (
              <div key={p.id} className="d-flex justify-content-between gap-2" style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: "0.82rem" }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.clinica}<span style={{ color: C.muted }}> · {fFecha(p.fecha, false)}</span></span>
                <b style={{ color: C.success, whiteSpace: "nowrap" }}>{dinero(p.monto, p.moneda)}</b>
              </div>
            ))}
        </div>
      </div>

      {/* Clínicas */}
      <div className="cb-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="d-flex align-items-center gap-2 flex-wrap" style={{ padding: "14px 14px 10px" }}>
          <strong style={{ fontSize: "0.95rem", marginRight: 6 }}><i className="bi bi-buildings me-2" style={{ color: C.accent }} />Clínicas</strong>
          {filtros.map((f) => (
            <button key={f.k} type="button" onClick={() => setFiltro(f.k)} className="cb-btn"
              style={{ background: filtro === f.k ? `${f.c}26` : "transparent", border: `1px solid ${filtro === f.k ? f.c : C.border}`, color: filtro === f.k ? f.c : C.muted }}>
              {f.t}<span style={{ opacity: 0.8 }}>{f.n}</span>
            </button>
          ))}
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar clínica…" style={{ ...inp, maxWidth: 220, padding: "6px 10px", marginLeft: "auto" }} />
        </div>
        <div className="cb-fila cb-cab" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <span>Clínica</span><span>Cuota mensual</span><span>Le toca / pagó</span><span>Saldo</span><span>Próximo cobro</span><span />
        </div>
        {lista.length === 0 && <div style={{ padding: 24, textAlign: "center", color: C.muted }}>No hay clínicas en este filtro.</div>}
        {lista.map((c) => {
          const e = ESTADOS[c.estado] || ESTADOS.sin_cuota;
          return (
            <div key={c.id} className="cb-fila">
              <div className="cb-nombre" style={{ minWidth: 0 }}>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <button type="button" onClick={() => setCuenta(c)} style={{ background: "none", border: "none", padding: 0, color: C.text, fontWeight: 800, textAlign: "left", cursor: "pointer" }}>{c.nombre}</button>
                  <Chip color={e.color} icon={e.icon}>{e.label}</Chip>
                </div>
                <div style={{ fontSize: "0.74rem", color: C.muted, marginTop: 2 }}>
                  {PLAN[c.plan_tipo] || c.plan_tipo}{c.licencia_fin ? ` · ${c.vigente ? "vence" : "venció"} ${fFecha(c.licencia_fin)}` : ""}
                  {c.cuotas_atrasadas > 0 ? ` · ${c.cuotas_atrasadas} cuota(s) atrasada(s) desde ${fFecha(c.deuda_mas_antigua, false)}` : ""}
                </div>
              </div>
              <div><span className="cb-et">Cuota mensual</span><b style={{ fontSize: "0.9rem" }}>{c.cuota_mensual ? dinero(c.cuota_mensual, c.moneda) : "—"}</b></div>
              <div style={{ fontSize: "0.84rem" }}>
                <span className="cb-et">Le toca / pagó</span>
                {c.estado === "sin_cuota" ? <span style={{ color: C.muted }}>—</span> : (
                  <>
                    <div>{dinero(c.esperado, c.moneda)}</div>
                    <div style={{ color: C.success, fontSize: "0.76rem" }}>pagó {dinero(c.pagado, c.moneda)}</div>
                  </>
                )}
              </div>
              <div>
                <span className="cb-et">Saldo</span>
                <b style={{ color: c.saldo > 0 ? (c.estado === "atrasado" ? C.danger : C.warning) : c.saldo < 0 ? C.accent : C.success, fontSize: "0.95rem" }}>
                  {c.estado === "sin_cuota" ? "—" : c.saldo > 0 ? dinero(c.saldo, c.moneda) : c.saldo < 0 ? `+${dinero(-c.saldo, c.moneda)}` : "Al día"}
                </b>
                {c.saldo < 0 && <div style={{ fontSize: "0.7rem", color: C.muted }}>a favor</div>}
              </div>
              <div style={{ fontSize: "0.84rem" }}>
                <span className="cb-et">Próximo cobro</span>
                {c.proxima_cuota ? <><div>{fFecha(c.proxima_cuota.fecha)}</div><div style={{ color: C.muted, fontSize: "0.74rem" }}>{dinero(c.proxima_cuota.monto, c.proxima_cuota.moneda)}</div></>
                  : <span style={{ color: C.muted }}>{c.vigente || c.estado === "sin_cuota" ? "—" : "Contrato terminado"}</span>}
              </div>
              <div className="cb-acc d-flex gap-2 justify-content-end flex-wrap">
                <button type="button" className="cb-btn" onClick={() => setCuenta(c)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.text }}>
                  <i className="bi bi-journal-text" />Cuenta
                </button>
                <button type="button" className="cb-btn" onClick={() => setPago({ clinica: c })} style={{ background: `${C.success}22`, border: `1px solid ${C.success}66`, color: "#6ee7b7" }}>
                  <i className="bi bi-cash-coin" />Pago
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ color: C.muted, fontSize: "0.74rem", marginTop: 10 }}>
        <i className="bi bi-info-circle me-1" />Las cuotas salen de la licencia de cada clínica (monto mensual y día de cobro). Los pagos se aplican a la cuota más antigua. Una cuota se marca atrasada {d.dias_gracia} días después de su fecha de cobro.
      </div>

      {pago && <ModalPago clinicas={d.clinicas} inicial={pago.clinica} onCerrar={() => setPago(null)} onGuardado={guardado} />}
      {cuenta && <ModalCuenta clinica={cuenta} onCerrar={() => setCuenta(null)} onPagar={(c) => { setCuenta(null); setPago({ clinica: c }); }} onCambio={cargar} />}
    </div>
  );
}
