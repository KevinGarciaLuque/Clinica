import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import api from "../../api/api";
import { FORMAS_PAGO, numeroPagos, formasOfrecidas, mesesPorPago } from "../../utils/planes";

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
  prueba: { label: "En prueba", color: C.violet, icon: "bi-hourglass" },
  prueba_vencida: { label: "Prueba vencida", color: "#64748b", icon: "bi-hourglass-bottom" },
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

/** Achica fotos grandes del comprobante antes de subirlas. */
async function achicar(archivo, max = 1800) {
  if (!archivo?.type?.startsWith("image/") || archivo.type === "image/gif") return archivo;
  try {
    const bmp = await createImageBitmap(archivo);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && archivo.size < 2 * 1024 * 1024) return archivo;
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], (archivo.name || "comprobante").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : archivo;
  } catch { return archivo; }
}

/** Abre un archivo protegido (recibo / comprobante) en otra pestaña. */
async function abrirArchivo(url) {
  const ventana = window.open("", "_blank");
  try {
    const r = await api.get(url, { responseType: "blob" });
    const tipo = r.headers?.["content-type"] || r.data.type || "";
    if (tipo.includes("text/html")) {
      const html = await r.data.text();
      if (ventana) { ventana.document.open(); ventana.document.write(html); ventana.document.close(); setTimeout(() => ventana.print(), 400); }
      return;
    }
    const href = URL.createObjectURL(r.data);
    if (ventana) ventana.location.href = href; else window.location.href = href;
  } catch {
    ventana?.close();
    alert("No se pudo abrir el archivo.");
  }
}

function ModalPago({ clinicas, inicial, onCerrar, onGuardado }) {
  const [clinicaId, setClinicaId] = useState(inicial?.id ? String(inicial.id) : "");
  const cl = clinicas.find((c) => String(c.id) === clinicaId);
  const sugerido = cl ? (cl.saldo > 0 ? cl.saldo : cl.cuota_mensual || "") : "";
  const [tipo, setTipo] = useState("pago");
  const [monto, setMonto] = useState(inicial ? String(sugerido || "") : "");
  const [fecha, setFecha] = useState(hoyTexto());
  const [metodo, setMetodo] = useState("TRANSFERENCIA");
  const [referencia, setReferencia] = useState("");
  const [notas, setNotas] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [enviarRecibo, setEnviarRecibo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const moneda = cl?.moneda || "HNL";
  const esDescuento = tipo === "descuento";

  const elegir = (id) => {
    setClinicaId(id);
    const c = clinicas.find((x) => String(x.id) === id);
    if (c) setMonto(String(c.saldo > 0 ? c.saldo : c.cuota_mensual || ""));
  };
  const guardar = async () => {
    setError("");
    if (!clinicaId) return setError("Elija la clínica.");
    if (!(Number(monto) > 0)) return setError("Escriba un monto mayor a cero.");
    if (esDescuento && !notas.trim()) return setError("Escriba el motivo del descuento o ajuste.");
    setGuardando(true);
    try {
      const fd = new FormData();
      Object.entries({ clinica_id: clinicaId, monto, fecha, metodo, referencia, notas, moneda, tipo, enviar_recibo: !esDescuento && enviarRecibo && cl?.email ? "1" : "0" })
        .forEach(([k, v]) => fd.append(k, v ?? ""));
      if (archivo && !esDescuento) fd.append("comprobante", await achicar(archivo));
      const r = await api.post("/cobranza/pagos", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const rec = r.data.data?.recibo;
      onGuardado(`${esDescuento ? "Descuento" : `Pago ${r.data.data?.numero || ""}`} de ${dinero(monto, moneda)} registrado para ${cl?.nombre || "la clínica"}.`
        + (rec ? (rec.enviado ? ` Recibo enviado a ${rec.correo}.` : ` (No se pudo enviar el recibo: ${rec.error})`) : ""));
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo registrar.");
      setGuardando(false);
    }
  };

  return (
    <Ventana titulo={esDescuento ? "Registrar descuento o ajuste" : "Registrar pago"} icono={esDescuento ? "bi-percent" : "bi-cash-coin"} onCerrar={onCerrar} ancho={520}>
      <div className="d-grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
        {[{ k: "pago", t: "Pago recibido", i: "bi-cash-coin", c: C.success }, { k: "descuento", t: "Descuento / ajuste", i: "bi-percent", c: C.violet }].map((o) => (
          <button key={o.k} type="button" onClick={() => setTipo(o.k)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, padding: "9px 8px", fontWeight: 800, fontSize: "0.86rem", cursor: "pointer",
              background: tipo === o.k ? `${o.c}26` : "transparent", border: `1px solid ${tipo === o.k ? o.c : C.border}`, color: tipo === o.k ? o.c : C.muted }}>
            <i className={`bi ${o.i}`} />{o.t}
          </button>
        ))}
      </div>
      {esDescuento && <div style={{ fontSize: "0.78rem", color: C.muted, marginTop: -6, marginBottom: 10 }}>Baja la deuda de la clínica (mes gratis, promoción, corrección) pero <b>no cuenta como dinero cobrado</b>.</div>}

      <label style={lbl}>Clínica</label>
      <select style={inp} value={clinicaId} onChange={(e) => elegir(e.target.value)}>
        <option value="">— Elija la clínica —</option>
        {clinicas.filter((c) => !c.en_prueba || c.saldo > 0).map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.saldo > 0 ? ` · debe ${dinero(c.saldo, c.moneda)}` : ""}</option>)}
      </select>
      {cl && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: "0.8rem", color: C.muted }}>
          <span>Cuota: <b style={{ color: C.text }}>{cl.cuota_mensual ? (cl.forma_pago === "contado" ? `${dinero(cl.cuota_mensual * cl.meses_plan, moneda)} por el plan` : `${dinero(cl.cuota_mensual, moneda)}/mes`) : "—"}</b></span>
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
      {cl?.cuota_mensual > 0 && !esDescuento && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {(cl.forma_pago === "contado" ? [cl.meses_plan] : [1, 2, 3, 6, 12]).map((n) => (
            <button key={n} type="button" onClick={() => setMonto(String(Math.round(cl.cuota_mensual * n * 100) / 100))}
              style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 999, padding: "3px 10px", fontSize: "0.74rem", cursor: "pointer" }}>
              {cl.forma_pago === "contado" ? "Plan completo" : `${n} ${n === 1 ? "cuota" : "cuotas"}`}
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
      {!esDescuento && (
        <>
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
          <label style={{ ...lbl, marginTop: 12 }}>Comprobante <span style={{ fontWeight: 400 }}>(foto o PDF, opcional)</span></label>
          <label style={{ ...inp, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderStyle: "dashed", color: archivo ? C.text : C.muted }}>
            <i className={`bi ${archivo ? "bi-file-earmark-check-fill" : "bi-paperclip"}`} style={{ color: archivo ? C.success : C.muted }} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{archivo ? archivo.name : "Adjuntar comprobante de la transferencia"}</span>
            <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
          </label>
        </>
      )}
      <label style={{ ...lbl, marginTop: 12 }}>{esDescuento ? "Motivo" : "Notas"} {!esDescuento && <span style={{ fontWeight: 400 }}>(opcional)</span>}</label>
      <input style={inp} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={esDescuento ? "Ej.: mes gratis por referido" : ""} />
      {!esDescuento && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: "0.84rem", color: cl?.email ? C.text : C.muted, cursor: cl?.email ? "pointer" : "default" }}>
          <input type="checkbox" checked={enviarRecibo && !!cl?.email} disabled={!cl?.email} onChange={(e) => setEnviarRecibo(e.target.checked)} />
          {cl?.email ? <>Enviar el recibo por correo a <b>{cl.email}</b></> : "La clínica no tiene correo para enviarle el recibo"}
        </label>
      )}
      {error && <div style={{ color: C.danger, fontSize: "0.85rem", marginTop: 10 }}><i className="bi bi-exclamation-circle me-1" />{error}</div>}
      <button type="button" disabled={guardando} onClick={guardar}
        style={{ width: "100%", marginTop: 16, background: esDescuento ? `linear-gradient(135deg, ${C.violet}, #6d28d9)` : `linear-gradient(135deg, ${C.success}, #059669)`, color: "#fff", border: "none", borderRadius: 12, padding: "11px", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer" }}>
        {guardando ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-check2-circle me-2" />}{esDescuento ? "Registrar descuento" : "Registrar pago"}
      </button>
    </Ventana>
  );
}

const NIVELES = [{ k: "basico", t: "Básico" }, { k: "avanzado", t: "Avanzado" }, { k: "empresarial", t: "Empresarial" }];

function ModalCuota({ clinica, lista, onCerrar, onGuardado }) {
  const plan = ["semestral", "anual"].includes(clinica.plan_tipo) ? clinica.plan_tipo : "semestral";
  const meses = plan === "anual" ? 12 : 6;
  const cuotaNivel = (n) => { const t = lista?.precios?.[`${n}_${plan}`]; return t ? Math.round((t / meses) * 100) / 100 : null; };
  const [nivel, setNivel] = useState(clinica.nivel || (clinica.cuota_estimada ? "basico" : ""));
  const [monto, setMonto] = useState(String(clinica.cuota_mensual || cuotaNivel(clinica.nivel || "basico") || ""));
  const [dia, setDia] = useState(String(clinica.dia_facturacion || Number(String(clinica.licencia_inicio || "").slice(8, 10)) || 1));
  const [forma, setForma] = useState(clinica.forma_pago || "contado");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const moneda = clinica.cuota_estimada ? (lista?.moneda || "HNL") : (clinica.moneda || lista?.moneda || "HNL");
  const elegirNivel = (n) => { setNivel(n); const c = cuotaNivel(n); if (c) setMonto(String(c)); };
  const guardar = async () => {
    setError("");
    if (!(Number(monto) > 0)) return setError("Escriba la cuota mensual.");
    setGuardando(true);
    try {
      await api.put(`/cobranza/clinica/${clinica.id}/cuota`, { monto_mensual: Number(monto), moneda, dia_facturacion: Number(dia), nivel: nivel || null, forma_pago: forma });
      onGuardado(`Cuota de ${clinica.nombre} guardada: ${dinero(monto, moneda)} al mes.`);
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo guardar.");
      setGuardando(false);
    }
  };
  return (
    <Ventana titulo={`Cuota mensual · ${clinica.nombre}`} icono="bi-sliders" onCerrar={onCerrar} ancho={480}>
      <div style={{ color: C.muted, fontSize: "0.84rem", marginBottom: 12 }}>
        Plan <b style={{ color: C.text }}>{PLAN[plan]}</b>{clinica.licencia_inicio ? ` · del ${fFecha(clinica.licencia_inicio)} al ${fFecha(clinica.licencia_fin)}` : ""}. Elija su nivel según la lista de precios o escriba el monto acordado.
      </div>
      <label style={lbl}>Nivel del plan</label>
      <div className="d-grid gap-2" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        {NIVELES.map((n) => {
          const c = cuotaNivel(n.k);
          const activo = nivel === n.k;
          return (
            <button key={n.k} type="button" onClick={() => elegirNivel(n.k)} disabled={!c}
              style={{ borderRadius: 12, padding: "9px 6px", cursor: c ? "pointer" : "not-allowed", textAlign: "center", opacity: c ? 1 : 0.5,
                background: activo ? `${C.accent}26` : "transparent", border: `1px solid ${activo ? C.accent : C.border}`, color: C.text }}>
              <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>{n.t}</div>
              <div style={{ fontSize: "0.72rem", color: C.muted }}>{c ? `${dinero(c, lista.moneda)}/mes` : "sin precio"}</div>
            </button>
          );
        })}
      </div>
      <label style={{ ...lbl, marginTop: 14 }}>¿Cómo paga?</label>
      <div className="d-grid gap-2" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
        {formasOfrecidas().map(([k, f]) => {
          const n = numeroPagos(plan, k);
          return { k, t: f.label, d: n > 1 ? `${n} pagos${Number(monto) > 0 ? ` de ${dinero((Number(monto) * meses) / n, moneda)}` : ""}` : `Todo al inicio (${meses} meses)` };
        }).map((o) => (
          <button key={o.k} type="button" onClick={() => setForma(o.k)}
            style={{ borderRadius: 12, padding: "9px 8px", cursor: "pointer", textAlign: "center", background: forma === o.k ? `${C.success}22` : "transparent", border: `1px solid ${forma === o.k ? C.success : C.border}`, color: C.text }}>
            <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>{o.t}</div>
            <div style={{ fontSize: "0.72rem", color: C.muted }}>{o.d}</div>
          </button>
        ))}
      </div>
      <div className="row g-2 mt-2">
        <div className={forma !== "contado" ? "col-7" : "col-12"}>
          <label style={lbl}>Cuota mensual ({SIMBOLO[moneda] || moneda})</label>
          <input style={{ ...inp, fontWeight: 800, fontSize: "1.05rem" }} type="number" min="0" step="0.01" inputMode="decimal" value={monto}
            onChange={(e) => { setMonto(e.target.value); }} />
        </div>
        {forma !== "contado" && (
          <div className="col-5">
            <label style={lbl}>Día de cobro</label>
            <input style={inp} type="number" min="1" max="28" value={dia} onChange={(e) => setDia(e.target.value)} />
          </div>
        )}
      </div>
      {Number(monto) > 0 && (
        <div style={{ color: C.muted, fontSize: "0.8rem", marginTop: 8 }}>
          {forma === "contado"
            ? <>Se cobra <b style={{ color: C.text }}>un solo pago de {dinero(Number(monto) * meses, moneda)}</b> el {fFecha(clinica.licencia_inicio)} por los {meses} meses.</>
            : <>Total del plan: <b style={{ color: C.text }}>{dinero(Number(monto) * meses, moneda)}</b> en {numeroPagos(plan, forma)} pagos de {dinero((Number(monto) * meses) / numeroPagos(plan, forma), moneda)} ({FORMAS_PAGO[forma]?.label.toLowerCase()}).</>}
        </div>
      )}
      {error && <div style={{ color: C.danger, fontSize: "0.85rem", marginTop: 10 }}><i className="bi bi-exclamation-circle me-1" />{error}</div>}
      <button type="button" disabled={guardando} onClick={guardar}
        style={{ width: "100%", marginTop: 16, background: `linear-gradient(135deg, ${C.accent}, #1565c0)`, color: "#fff", border: "none", borderRadius: 12, padding: "11px", fontWeight: 800, cursor: "pointer" }}>
        {guardando ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-check2-circle me-2" />}Guardar cuota
      </button>
    </Ventana>
  );
}

/** Confirmar la cuota de varias clínicas a la vez (mismo plan y mismo precio). */
function ModalVarias({ clinicas, lista, onCerrar, onGuardado }) {
  const candidatas = clinicas.filter((c) => ["semestral", "anual"].includes(c.plan_tipo) && c.cuota_fuente !== "licencia");
  const [plan, setPlan] = useState(candidatas.some((c) => c.plan_tipo === "semestral") ? "semestral" : "anual");
  const delPlan = candidatas.filter((c) => c.plan_tipo === plan);
  const meses = plan === "anual" ? 12 : 6;
  const precioNivel = (n) => lista?.precios?.[`${n}_${plan}`] || null;
  const [nivel, setNivel] = useState("");
  const [total, setTotal] = useState("");
  const [forma, setForma] = useState("contado");
  const [marcadas, setMarcadas] = useState(() => new Set(candidatas.filter((c) => c.cuota_fuente === "sin_nivel").map((c) => c.id)));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const moneda = lista?.moneda || "HNL";
  const elegidas = delPlan.filter((c) => marcadas.has(c.id));
  const cambiarPlan = (p) => { setPlan(p); setNivel(""); setTotal(""); };
  const elegirNivel = (n) => { setNivel(n); const t = precioNivel(n); if (t) setTotal(String(t)); };
  const marcar = (id) => setMarcadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const guardar = async () => {
    setError("");
    if (!(Number(total) > 0)) return setError(`Escriba el precio del plan ${PLAN[plan].toLowerCase()}.`);
    if (!elegidas.length) return setError("Marque al menos una clínica.");
    setGuardando(true);
    let ok = 0;
    for (const c of elegidas) {
      try {
        await api.put(`/cobranza/clinica/${c.id}/cuota`, { monto_mensual: Math.round((Number(total) / meses) * 100) / 100, moneda, nivel: nivel || null, forma_pago: forma });
        ok += 1;
      } catch { /* sigue con las demás */ }
    }
    onGuardado(`Cuota confirmada en ${ok} de ${elegidas.length} clínica(s): ${dinero(total, moneda)} por plan ${PLAN[plan].toLowerCase()}.`);
  };
  return (
    <Ventana titulo="Confirmar cuotas de varias clínicas" icono="bi-ui-checks" onCerrar={onCerrar} ancho={560}>
      <label style={lbl}>Tipo de plan</label>
      <div className="d-grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
        {["semestral", "anual"].map((p) => (
          <button key={p} type="button" onClick={() => cambiarPlan(p)}
            style={{ borderRadius: 12, padding: "9px 8px", cursor: "pointer", fontWeight: 800, background: plan === p ? `${C.accent}26` : "transparent", border: `1px solid ${plan === p ? C.accent : C.border}`, color: C.text }}>
            {PLAN[p]} <span style={{ color: C.muted, fontWeight: 600 }}>({candidatas.filter((c) => c.plan_tipo === p).length})</span>
          </button>
        ))}
      </div>
      <label style={lbl}>Nivel <span style={{ fontWeight: 400 }}>(opcional, llena el precio de la lista)</span></label>
      <div className="d-flex gap-2 flex-wrap mb-2">
        {NIVELES.map((n) => {
          const t = precioNivel(n.k);
          return (
            <button key={n.k} type="button" disabled={!t} onClick={() => elegirNivel(n.k)}
              style={{ borderRadius: 10, padding: "6px 10px", fontSize: "0.8rem", fontWeight: 700, cursor: t ? "pointer" : "not-allowed", opacity: t ? 1 : 0.5,
                background: nivel === n.k ? `${C.accent}26` : "transparent", border: `1px solid ${nivel === n.k ? C.accent : C.border}`, color: C.text }}>
              {n.t}{t ? ` · ${dineroCorto(t, moneda)}` : ""}
            </button>
          );
        })}
      </div>
      <div className="row g-2">
        <div className="col-7">
          <label style={lbl}>Precio del plan {PLAN[plan].toLowerCase()} ({SIMBOLO[moneda] || moneda})</label>
          <input style={{ ...inp, fontWeight: 800, fontSize: "1.05rem" }} type="number" min="0" step="0.01" inputMode="decimal" value={total}
            onChange={(e) => { setTotal(e.target.value); setNivel(""); }} placeholder={plan === "semestral" ? "Ej.: 4200" : "Ej.: 8400"} />
          {Number(total) > 0 && <div style={{ fontSize: "0.74rem", color: C.muted, marginTop: 4 }}>= {dinero(Number(total) / meses, moneda)} al mes</div>}
        </div>
        <div className="col-5">
          <label style={lbl}>¿Cómo pagan?</label>
          <select style={inp} value={forma} onChange={(e) => setForma(e.target.value)}>
            {formasOfrecidas().map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </select>
        </div>
      </div>
      <div className="d-flex align-items-center mt-3 mb-2">
        <label style={{ ...lbl, marginBottom: 0 }}>Clínicas con plan {PLAN[plan].toLowerCase()} ({elegidas.length} marcadas)</label>
        <button type="button" onClick={() => setMarcadas((s) => { const n = new Set(s); const todas = delPlan.every((c) => n.has(c.id)); delPlan.forEach((c) => (todas ? n.delete(c.id) : n.add(c.id))); return n; })}
          style={{ marginLeft: "auto", background: "none", border: "none", color: C.accent, fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}>
          {delPlan.every((c) => marcadas.has(c.id)) ? "Quitar todas" : "Marcar todas"}
        </button>
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, maxHeight: 260, overflowY: "auto" }}>
        {delPlan.length === 0 && <div style={{ padding: 14, color: C.muted, fontSize: "0.84rem" }}>No hay clínicas {PLAN[plan].toLowerCase()}es por confirmar.</div>}
        {delPlan.map((c) => (
          <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", fontSize: "0.86rem" }}>
            <input type="checkbox" checked={marcadas.has(c.id)} onChange={() => marcar(c.id)} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{c.nombre}</b>
              <span style={{ display: "block", fontSize: "0.72rem", color: C.muted }}>
                {fFecha(c.licencia_inicio)} → {fFecha(c.licencia_fin)} · {c.cuota_fuente === "sin_nivel" ? "nivel sin registrar" : `ahora ${dinero((c.cuota_mensual || 0) * (c.meses_plan || meses), c.moneda)}`}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error && <div style={{ color: C.danger, fontSize: "0.85rem", marginTop: 10 }}><i className="bi bi-exclamation-circle me-1" />{error}</div>}
      <button type="button" disabled={guardando} onClick={guardar}
        style={{ width: "100%", marginTop: 14, background: `linear-gradient(135deg, ${C.accent}, #1565c0)`, color: "#fff", border: "none", borderRadius: 12, padding: "11px", fontWeight: 800, cursor: "pointer" }}>
        {guardando ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-check2-all me-2" />}Confirmar {elegidas.length} clínica(s)
      </button>
    </Ventana>
  );
}

function ModalCuenta({ clinica, onCerrar, onPagar, onCambio }) {
  const [d, setD] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState("");
  useEffect(() => {
    let vivo = true;
    api.get(`/cobranza/clinica/${clinica.id}`).then((r) => { if (vivo) setD(r.data.data); }).catch(() => { if (vivo) setD({ error: true }); });
    return () => { vivo = false; };
  }, [clinica.id, recarga]);
  const accion = async (clave, fn, ok) => {
    setOcupado(clave); setMsg("");
    try { await fn(); setMsg(ok); } catch (e) { setMsg(`⚠ ${e.response?.data?.msg || "No se pudo completar."}`); }
    setOcupado("");
  };
  const anular = async (p) => {
    if (!window.confirm(`¿Anular ${p.tipo === "descuento" ? "el descuento" : `el pago ${p.numero}`} de ${dinero(p.monto, p.moneda)}? Dejará de contar en la cuenta.`)) return;
    await api.put(`/cobranza/pagos/${p.id}/anular`).catch(() => alert("No se pudo anular."));
    setRecarga((n) => n + 1); onCambio?.();
  };
  const moneda = clinica.moneda || "HNL";
  const tel = String(d?.clinica?.telefono || clinica.telefono || "").replace(/\D/g, "");
  const btnMini = (color) => ({ background: "transparent", border: `1px solid ${color}55`, color, borderRadius: 8, padding: "3px 9px", fontSize: "0.74rem", cursor: "pointer", whiteSpace: "nowrap" });

  return (
    <Ventana titulo={`Estado de cuenta · ${clinica.nombre}`} icono="bi-journal-text" onCerrar={onCerrar} ancho={760}>
      {!d ? <div className="text-center py-4" style={{ color: C.muted }}><span className="spinner-border spinner-border-sm me-2" />Cargando…</div>
        : d.error ? <div style={{ color: C.danger }}>No se pudo cargar la cuenta.</div> : (
          <>
            {/* Contacto y plan */}
            <div className="d-flex flex-wrap gap-2 align-items-center mb-3" style={{ fontSize: "0.82rem", color: C.muted }}>
              <Chip color={C.accent} icon="bi-award">{PLAN[d.clinica.plan_tipo] || d.clinica.plan_tipo}{clinica.forma_pago ? ` · ${(FORMAS_PAGO[clinica.forma_pago]?.label || "").toLowerCase()}` : ""}</Chip>
              {d.clinica.licencia_inicio && <span><i className="bi bi-calendar-range me-1" />{fFecha(d.clinica.licencia_inicio)} → {fFecha(d.clinica.licencia_fin)}</span>}
              {d.clinica.email && <a href={`mailto:${d.clinica.email}`} style={{ color: C.muted }}><i className="bi bi-envelope me-1" />{d.clinica.email}</a>}
              {tel && <a href={`https://wa.me/${tel.length === 8 ? `504${tel}` : tel}`} target="_blank" rel="noreferrer" style={{ color: "#25d366" }}><i className="bi bi-whatsapp me-1" />{d.clinica.telefono}</a>}
            </div>

            <div className="cb-mini">
              <div><small>Le toca pagar (a hoy)</small><b>{dinero(d.esperado, moneda)}</b></div>
              <div><small>Ha pagado</small><b style={{ color: C.success }}>{dinero(d.pagado, moneda)}</b>{d.descuentos > 0 && <small style={{ color: C.violet }}>+ {dinero(d.descuentos, moneda)} en descuentos</small>}</div>
              <div><small>{d.saldo < 0 ? "Saldo a favor" : "Debe"}</small><b style={{ color: d.saldo > 0 ? C.warning : C.success }}>{d.saldo === 0 ? "Al día" : dinero(Math.abs(d.saldo), moneda)}</b></div>
              <div><small>Contrato completo</small><b>{dinero(d.total_contrato, moneda)}</b></div>
            </div>
            <div className="d-flex gap-2 flex-wrap" style={{ margin: "12px 0 6px" }}>
              <button type="button" onClick={() => onPagar(clinica)}
                style={{ flex: "1 1 200px", background: `linear-gradient(135deg, ${C.success}, #059669)`, color: "#fff", border: "none", borderRadius: 12, padding: "10px", fontWeight: 800, cursor: "pointer" }}>
                <i className="bi bi-plus-circle me-2" />Registrar pago
              </button>
              {d.saldo > 0 && (
                <button type="button" disabled={!!ocupado || !d.clinica.email} title={d.clinica.email ? "" : "La clínica no tiene correo"}
                  onClick={() => accion("rec", () => api.post(`/cobranza/clinica/${clinica.id}/recordatorio`), `Recordatorio de cobro enviado a ${d.clinica.email}.`)}
                  style={{ flex: "1 1 200px", background: "transparent", color: C.warning, border: `1px solid ${C.warning}77`, borderRadius: 12, padding: "10px", fontWeight: 800, cursor: "pointer" }}>
                  {ocupado === "rec" ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-bell me-2" />}Enviar recordatorio de pago
                </button>
              )}
            </div>
            {msg && <div style={{ fontSize: "0.84rem", color: msg.startsWith("⚠") ? C.danger : "#6ee7b7", marginBottom: 8 }}>{msg}</div>}

            <div style={{ fontWeight: 800, fontSize: "0.85rem", margin: "14px 0 8px" }}><i className="bi bi-calendar3 me-2" style={{ color: C.accent }} />Cargos</div>
            {d.detalle.length === 0 ? (
              <div style={{ color: C.muted, fontSize: "0.85rem" }}>Esta clínica no tiene cuota. Defínala con «Definir cuota» en la lista.</div>
            ) : (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                {d.detalle.map((q) => {
                  const e = ESTADO_CUOTA[q.estado] || ESTADO_CUOTA.programada;
                  return (
                    <div key={q.periodo} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", fontSize: "0.85rem" }}>
                      <div style={{ minWidth: 120, flex: "1 1 120px" }}>
                        <div style={{ fontWeight: 700 }}>{q.unico ? `Plan ${PLAN[q.plan_tipo] || ""} · pago único` : q.bloque ? `Pago ${q.bloque.n} de ${q.bloque.de}` : fMes(q.periodo, true)}</div>
                        <div style={{ fontSize: "0.72rem", color: C.muted }}>
                          {q.unico ? `Del ${fFecha(q.fecha_cobro)} al ${fFecha(q.hasta)} (${q.meses} meses)` : q.bloque ? `Cobro: ${fFecha(q.fecha_cobro)} · cubre ${q.bloque.meses} meses (hasta ${fFecha(q.hasta)})` : `Cobro: ${fFecha(q.fecha_cobro)}`}{q.recibo ? ` · ${q.recibo.numero}` : ""}{q.estimada ? " · estimada" : ""}
                        </div>
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

            <div style={{ fontWeight: 800, fontSize: "0.85rem", margin: "18px 0 8px" }}><i className="bi bi-cash-stack me-2" style={{ color: C.success }} />Pagos y ajustes</div>
            {d.pagos.length === 0 ? <div style={{ color: C.muted, fontSize: "0.85rem" }}>Todavía no hay pagos registrados.</div> : (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                {d.pagos.map((p) => {
                  const desc = p.tipo === "descuento";
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", fontSize: "0.85rem", opacity: p.anulado ? 0.5 : 1 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${desc ? C.violet : C.success}22`, color: desc ? C.violet : C.success }}>
                        <i className={`bi ${desc ? "bi-percent" : "bi-cash-coin"}`} />
                      </span>
                      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                        <div style={{ fontWeight: 800, textDecoration: p.anulado ? "line-through" : "none" }}>
                          {dinero(p.monto, p.moneda)} <span style={{ fontWeight: 600, color: p.implicito ? C.accent : C.muted, fontSize: "0.74rem" }}>{desc ? "Descuento" : p.implicito ? "Pagado al activar el plan" : p.numero}</span>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: C.muted }}>
                          {fFecha(p.fecha)}{p.implicito ? " · el plan está activo; no hay un pago registrado" : <>{!desc ? ` · ${(METODOS.find((m) => m.k === p.metodo) || {}).t || p.metodo}` : ""}{p.referencia ? ` · ${p.referencia}` : ""}{p.notas ? ` · ${p.notas}` : ""}</>}
                          {p.recibo_enviado_en ? " · recibo enviado" : ""}{p.registrado_por ? ` · por ${p.registrado_por}` : ""}
                        </div>
                      </div>
                      {p.implicito ? (
                        <button type="button" style={btnMini(C.success)} onClick={() => onPagar(clinica)} title="Registre el pago real (con su fecha y comprobante); este automático desaparece.">
                          <i className="bi bi-pencil-square me-1" />Registrar pago real
                        </button>
                      ) : p.anulado ? <Chip color={C.muted}>Anulado</Chip> : (
                        <div className="d-flex gap-1 flex-wrap">
                          {!desc && <button type="button" style={btnMini(C.accent)} onClick={() => abrirArchivo(`/cobranza/pagos/${p.id}/recibo`)}><i className="bi bi-receipt me-1" />Recibo</button>}
                          {!desc && d.clinica.email && (
                            <button type="button" style={btnMini(C.success)} disabled={!!ocupado}
                              onClick={() => accion(`env${p.id}`, async () => { await api.post(`/cobranza/pagos/${p.id}/enviar-recibo`); setRecarga((n) => n + 1); }, `Recibo ${p.numero} enviado a ${d.clinica.email}.`)}>
                              {ocupado === `env${p.id}` ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-send me-1" />Enviar</>}
                            </button>
                          )}
                          {p.tiene_comprobante && <button type="button" style={btnMini(C.warning)} onClick={() => abrirArchivo(`/cobranza/pagos/${p.id}/comprobante`)}><i className="bi bi-paperclip me-1" />Comprobante</button>}
                          <button type="button" style={btnMini(C.danger)} onClick={() => anular(p)}><i className="bi bi-x-circle me-1" />Anular</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
    </Ventana>
  );
}

/** Descarga un CSV que abre bien en Excel (con BOM para los acentos). */
function descargarCsv(nombre, filas) {
  const celda = (v) => { const t = v == null ? "" : String(v); return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
}

export default function Cobranza() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [buscar, setBuscar] = useState("");
  const [pago, setPago] = useState(null);     // { clinica } | {}
  const [cuenta, setCuenta] = useState(null); // clinica
  const [cuota, setCuota] = useState(null);   // clinica
  const [varias, setVarias] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    api.get("/cobranza/resumen").then((r) => { setD(r.data.data); setError(""); })
      .catch((e) => setError(e.response?.data?.msg || "No se pudo cargar la cobranza."));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const lista = useMemo(() => {
    if (!d) return [];
    const q = buscar.trim().toLowerCase();
    const orden = { atrasado: 0, pendiente: 1, al_dia: 2, adelantado: 3, prueba: 4, sin_cuota: 5, prueba_vencida: 6 };
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

  const [exportando, setExportando] = useState(false);
  const [verExport, setVerExport] = useState(false);
  const ESTADO_TXT = { atrasado: "Atrasada", pendiente: "Por pagar", al_dia: "Al día", adelantado: "Adelantada", sin_cuota: "Sin cuota", prueba: "En prueba", prueba_vencida: "Prueba vencida" };
  const exportarClinicas = () => {
    setVerExport(false);
    descargarCsv(`cobranza-clinicas-${hoyTexto()}.csv`, [
      ["Clínica", "Estado", "Plan", "Forma de pago", "Cuota mensual", "Total del plan", "Moneda", "Inicio", "Vence", "Le toca a hoy", "Pagado", "Descuentos", "Saldo", "Próximo cobro", "Último pago", "Correo", "Teléfono"],
      ...d.clinicas.map((c) => [c.nombre, ESTADO_TXT[c.estado] || c.estado, PLAN[c.plan_tipo] || c.plan_tipo, FORMAS_PAGO[c.forma_pago]?.label || "",
        c.cuota_mensual ?? "", c.cuota_mensual && c.meses_plan ? Math.round(c.cuota_mensual * c.meses_plan * 100) / 100 : "", c.moneda, c.licencia_inicio || "", c.licencia_fin || "",
        c.esperado, c.pagado, c.descuentos || 0, c.saldo, c.proxima_cuota?.fecha || "", c.ultimo_pago?.fecha || "", c.email || "", c.telefono || ""]),
    ]);
  };
  const exportarPagos = async () => {
    setVerExport(false); setExportando(true);
    try {
      const r = await api.get("/cobranza/pagos");
      descargarCsv(`cobranza-pagos-${hoyTexto()}.csv`, [
        ["Número", "Fecha", "Clínica", "RTN", "Tipo", "Monto", "Moneda", "Método", "Referencia", "Notas", "Anulado"],
        ...r.data.data.map((p) => [p.numero, p.fecha, p.clinica, p.ruc || "", p.tipo === "descuento" ? "Descuento" : "Pago", p.monto, p.moneda,
          p.tipo === "descuento" ? "" : (METODOS.find((m) => m.k === p.metodo) || {}).t || p.metodo || "", p.referencia || "", p.notas || "", p.anulado ? "Sí" : ""]),
      ]);
    } catch { alert("No se pudo exportar."); }
    setExportando(false);
  };

  const guardado = (msg) => { setPago(null); setCuota(null); setVarias(false); setAviso(msg); cargar(); setTimeout(() => setAviso(""), 4000); };

  if (error) return <div className="p-4" style={{ color: C.danger }}><i className="bi bi-exclamation-triangle me-2" />{error}</div>;
  if (!d) return <div className="p-5 text-center" style={{ color: C.muted }}><span className="spinner-border spinner-border-sm me-2" />Cargando cobranza…</div>;

  const t = d.totales;
  const filtros = [
    { k: "todas", t: "Todas", n: d.clinicas.length, c: C.accent },
    { k: "atrasado", t: "Atrasadas", n: d.conteo.atrasadas, c: C.danger },
    { k: "pendiente", t: "Por pagar", n: d.conteo.pendientes, c: C.warning },
    { k: "al_dia", t: "Al día", n: d.conteo.al_dia, c: C.success },
    { k: "prueba", t: "En prueba", n: d.conteo.prueba || 0, c: C.violet },
    { k: "prueba_vencida", t: "Prueba vencida", n: d.conteo.prueba_vencida || 0, c: "#64748b" },
    { k: "sin_cuota", t: "Sin cuota", n: d.conteo.sin_cuota, c: C.muted },
  ];

  return (
    <div className="cobranza" style={{ padding: "18px 16px 40px", color: C.text, maxWidth: 1400, margin: "0 auto" }}>
      <style>{`
        .cobranza .cb-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; }
        .cobranza .cb-kpi { background:${C.card}; border:1px solid ${C.border}; border-radius:14px; padding:14px 16px; min-width:0; }
        .cobranza .cb-panel { background:${C.card}; border:1px solid ${C.border}; border-radius:14px; padding:16px; min-width:0; }
        .cobranza .cb-dos { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr); gap:14px; }
        .cobranza .cb-fila { display:grid; grid-template-columns:minmax(0,2.1fr) minmax(150px,1.2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) auto; gap:10px; align-items:center; padding:12px 14px; border-bottom:1px solid ${C.border}; }
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
        <div className="d-flex gap-2 flex-wrap" style={{ position: "relative" }}>
          <button type="button" className="cb-btn" onClick={() => setVerExport((v) => !v)} disabled={exportando}
            style={{ background: "rgba(255,255,255,.06)", color: C.text, border: `1px solid ${C.border}`, padding: "10px 14px", fontSize: "0.88rem" }}>
            {exportando ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-file-earmark-spreadsheet" />}Exportar<i className="bi bi-chevron-down" style={{ fontSize: "0.7rem" }} />
          </button>
          {verExport && (
            <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 20, background: "#0b1a2e", border: `1px solid ${C.border}`, borderRadius: 12, padding: 6, minWidth: 220, boxShadow: "0 12px 30px rgba(0,0,0,.4)" }}>
              {[{ t: "Estado de las clínicas", i: "bi-buildings", f: exportarClinicas }, { t: "Todos los pagos", i: "bi-cash-stack", f: exportarPagos }].map((o) => (
                <button key={o.t} type="button" onClick={o.f} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: C.text, padding: "8px 10px", borderRadius: 8, fontSize: "0.86rem", cursor: "pointer", textAlign: "left" }}>
                  <i className={`bi ${o.i}`} style={{ color: C.success }} />{o.t} <span style={{ color: C.muted, fontSize: "0.72rem", marginLeft: "auto" }}>Excel</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" className="cb-btn" onClick={() => setPago({})}
            style={{ background: `linear-gradient(135deg, ${C.success}, #059669)`, color: "#fff", border: "none", padding: "10px 16px", fontSize: "0.9rem" }}>
            <i className="bi bi-plus-circle" />Registrar pago
          </button>
        </div>
      </div>

      {aviso && <div style={{ background: "#dcfce7", border: "1px solid #86efac", color: "#166534", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: "0.88rem" }}><i className="bi bi-check-circle-fill me-2" />{aviso}</div>}

      {d.clinicas.some((c) => c.cuota_estimada) && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: "0.86rem" }}>
          <i className="bi bi-magic me-2" />
          {d.clinicas.filter((c) => c.cuota_estimada).length} clínica(s) con plan semestral o anual no tienen registrado cuánto pagan (se calcularon con el precio Básico de la lista).
          <button type="button" onClick={() => setVarias(true)} style={{ marginLeft: 8, background: "#92400e", color: "#fff", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>
            <i className="bi bi-ui-checks me-1" />Confirmar varias a la vez
          </button>
        </div>
      )}
      {!d.clinicas.some((c) => c.cuota_estimada) && d.clinicas.some((c) => ["semestral", "anual"].includes(c.plan_tipo) && !c.cuota_mensual) && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: "0.86rem" }}>
          <i className="bi bi-info-circle me-2" />Hay clínicas con plan semestral o anual sin cuota. Ponga los precios en Página Pública → Precios para calcularlas solas, o use «Definir cuota» en cada una.
        </div>
      )}

      {/* Indicadores */}
      <div className="cb-kpis mb-3">
        <Kpi label="Cobrado este mes" value={porMoneda(t.cobrado_mes)} icon="bi-calendar-check" color={C.success} sub={`Este año: ${porMoneda(t.cobrado_anio, true)}`} />
        <Kpi label="Generado en total" value={porMoneda(t.cobrado_total)} icon="bi-graph-up-arrow" color={C.violet}
          sub={d.activados_sin_pago ? `Incluye ${d.activados_sin_pago} plan(es) activo(s) sin pago registrado` : "Todos los pagos registrados"} />
        <Kpi label="Por cobrar" value={porMoneda(t.por_cobrar)} icon="bi-hourglass-split" color={C.warning} sub={`${d.conteo.atrasadas + d.conteo.pendientes} clínica(s) con saldo`} />
        <Kpi label="Atrasado" value={porMoneda(t.atrasado)} icon="bi-exclamation-octagon" color={C.danger} sub={`Más de ${d.dias_gracia} días sin pagar`} />
        <Kpi label="Ingreso mensual" value={porMoneda(t.mensual_esperado)} icon="bi-arrow-repeat" color={C.accent}
          sub={`${d.conteo.pagando} clínica(s) con cuota · próximo mes ${porMoneda(d.proyeccion[0]?.esperado, true)}`} />
        <Kpi label="En prueba" value={`${d.conteo.prueba || 0} clínica${d.conteo.prueba === 1 ? "" : "s"}`} icon="bi-hourglass" color={C.violet}
          sub={`${d.conteo.prueba_vencida || 0} con la prueba vencida`} />
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
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.clinica}<span style={{ color: C.muted }}> · {fFecha(p.fecha, false)}{p.implicito ? " · al activar" : ""}</span></span>
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
          <span>Clínica</span><span>Cuota</span><span>Le toca / pagó</span><span>Saldo</span><span>Próximo cobro</span><span />
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
                  {PLAN[c.plan_tipo] || c.plan_tipo}{c.licencia_fin ? ` · ${c.licencia_fin >= d.hoy ? "vence" : "venció"} ${fFecha(c.licencia_fin)}` : ""}
                  {c.cuotas_atrasadas > 0 ? ` · ${c.cuotas_atrasadas} cuota(s) atrasada(s) desde ${fFecha(c.deuda_mas_antigua, false)}` : ""}
                </div>
              </div>
              <div>
                <span className="cb-et">Cuota</span>
                {c.forma_pago === "contado" && c.cuota_mensual > 0 ? (
                  <>
                    <b style={{ fontSize: "0.9rem" }}>{dinero(c.cuota_mensual * c.meses_plan, c.moneda)}</b>
                    <div style={{ fontSize: "0.72rem", color: C.muted }}>pago único · {dinero(c.cuota_mensual, c.moneda)}/mes</div>
                  </>
                ) : ["dos_pagos", "trimestral", "bimestral"].includes(c.forma_pago) && c.cuota_mensual > 0 ? (
                  <>
                    <b style={{ fontSize: "0.9rem" }}>{dinero(c.cuota_mensual * mesesPorPago(c.plan_tipo, c.forma_pago), c.moneda)}</b>
                    <div style={{ fontSize: "0.72rem", color: C.muted }}>{FORMAS_PAGO[c.forma_pago].label.toLowerCase()} · {numeroPagos(c.plan_tipo, c.forma_pago)} pagos</div>
                  </>
                ) : c.en_prueba ? (
                  <span style={{ color: C.violet, fontSize: "0.82rem", fontWeight: 700 }}>
                    {c.dias_restantes > 0 ? `Prueba · ${c.dias_restantes} día${c.dias_restantes === 1 ? "" : "s"}` : "Prueba terminada"}
                  </span>
                ) : <b style={{ fontSize: "0.9rem" }}>{c.cuota_mensual ? dinero(c.cuota_mensual, c.moneda) : "—"}</b>}
                {c.cuota_fuente && c.cuota_fuente !== "licencia" && (() => {
                  const nv = NIVELES.find((n) => n.k === c.nivel)?.t || "Básico";
                  const f = {
                    confirmado: { col: C.success, ic: "bi-check-circle", t: `Plan ${nv}` },
                    solicitud_monto: { col: C.accent, ic: "bi-file-earmark-check", t: `${nv} · monto aprobado` },
                    solicitud: { col: C.accent, ic: "bi-file-earmark-check", t: `Plan ${nv} · su solicitud` },
                    historial: { col: C.accent, ic: "bi-clock-history", t: `Plan ${nv} · su licencia` },
                    sin_nivel: { col: C.warning, ic: "bi-question-circle", t: "Nivel sin registrar · Básico" },
                  }[c.cuota_fuente];
                  return f ? (
                    <div style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%", color: f.col, background: `${f.col}1f`, border: `1px solid ${f.col}55`, borderRadius: 8, padding: "2px 7px", fontSize: "0.7rem", fontWeight: 700, lineHeight: 1.25 }}>
                      <i className={`bi ${f.ic}`} /><span style={{ minWidth: 0 }}>{f.t}</span>
                    </div>
                  ) : null;
                })()}
                {["semestral", "anual"].includes(c.plan_tipo) && ((c.cuota_fuente && !["licencia", "confirmado"].includes(c.cuota_fuente)) || !c.cuota_mensual) && (
                  <button type="button" onClick={() => setCuota(c)} style={{ display: "block", background: "none", border: "none", padding: 0, marginTop: 3, color: C.accent, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer" }}>
                    <i className="bi bi-pencil-square me-1" />{c.cuota_mensual ? "Confirmar cuota" : "Definir cuota"}
                  </button>
                )}
                {["licencia", "confirmado"].includes(c.cuota_fuente) && c.cuota_mensual > 0 && (
                  <button type="button" onClick={() => setCuota(c)} style={{ display: "block", background: "none", border: "none", padding: 0, marginTop: 2, color: C.muted, fontSize: "0.7rem", cursor: "pointer" }}>
                    Cambiar
                  </button>
                )}
              </div>
              <div style={{ fontSize: "0.84rem" }}>
                <span className="cb-et">Le toca / pagó</span>
                {c.estado === "sin_cuota" || (c.en_prueba && !c.esperado) ? <span style={{ color: C.muted }}>—</span> : (
                  <>
                    <div>{dinero(c.esperado, c.moneda)}</div>
                    <div style={{ color: C.success, fontSize: "0.76rem" }}>pagó {dinero(c.pagado, c.moneda)}</div>
                    {c.descuentos > 0 && <div style={{ color: C.violet, fontSize: "0.72rem" }}>descuentos {dinero(c.descuentos, c.moneda)}</div>}
                  </>
                )}
              </div>
              <div>
                <span className="cb-et">Saldo</span>
                <b style={{ color: c.saldo > 0 ? (c.estado === "atrasado" ? C.danger : C.warning) : c.saldo < 0 ? C.accent : C.success, fontSize: "0.95rem" }}>
                  {c.estado === "sin_cuota" || (c.en_prueba && !c.saldo) ? "—" : c.saldo > 0 ? dinero(c.saldo, c.moneda) : c.saldo < 0 ? `+${dinero(-c.saldo, c.moneda)}` : "Al día"}
                </b>
                {c.saldo < 0 && <div style={{ fontSize: "0.7rem", color: C.muted }}>a favor</div>}
              </div>
              <div style={{ fontSize: "0.84rem" }}>
                <span className="cb-et">Próximo cobro</span>
                {c.proxima_cuota ? <><div>{fFecha(c.proxima_cuota.fecha)}</div><div style={{ color: C.muted, fontSize: "0.74rem" }}>{dinero(c.proxima_cuota.monto, c.proxima_cuota.moneda)}</div></>
                  : c.vigente && c.forma_pago === "contado"
                    ? <><div>Renovación</div><div style={{ color: C.muted, fontSize: "0.74rem" }}>{fFecha(c.licencia_fin)}</div></>
                    : c.en_prueba ? <><div style={{ color: C.violet }}>Fin de prueba</div><div style={{ color: C.muted, fontSize: "0.74rem" }}>{fFecha(c.licencia_fin)}</div></>
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
        <i className="bi bi-info-circle me-1" />Las cuotas salen de la licencia de cada clínica (monto mensual y día de cobro). Los pagos se aplican a la cuota más antigua. Una cuota se marca atrasada {d.dias_gracia} días después de su fecha de cobro. Un plan de pago único que está activo se da por pagado («Pagado al activar el plan») hasta que registre el pago real.
      </div>

      {pago && <ModalPago clinicas={d.clinicas} inicial={pago.clinica} onCerrar={() => setPago(null)} onGuardado={guardado} />}
      {varias && <ModalVarias clinicas={d.clinicas} lista={d.lista_precios} onCerrar={() => setVarias(false)} onGuardado={guardado} />}
      {cuota && <ModalCuota clinica={cuota} lista={d.lista_precios} onCerrar={() => setCuota(null)} onGuardado={guardado} />}
      {cuenta && <ModalCuenta clinica={cuenta} onCerrar={() => setCuenta(null)} onPagar={(c) => { setCuenta(null); setPago({ clinica: c }); }} onCambio={cargar} />}
    </div>
  );
}
