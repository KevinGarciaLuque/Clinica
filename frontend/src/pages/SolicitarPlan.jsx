/**
 * Portal público de compra de plan
 * URL: /solicitar-plan?nivel=avanzado
 *
 * Flujo en 3 pasos:
 *   1. Datos del médico/clínica, nivel de plan y duración (muestra el total a transferir)
 *   2. Datos de la cuenta bancaria para transferir
 *   3. Subir la captura de la transferencia
 */
import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { SIMBOLO_MONEDA } from "../utils/monedas";
import { NIVELES_PLAN, DURACION_LABEL, duracionesDisponibles, precioClave } from "../utils/planes";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

const PASOS = [
  { n: 1, label: "Tus datos",     icon: "bi-person-vcard" },
  { n: 2, label: "Transferencia", icon: "bi-bank" },
  { n: 3, label: "Comprobante",   icon: "bi-cloud-arrow-up" },
];

function formatearMonto(monto, moneda) {
  if (monto == null) return null;
  const simbolo = SIMBOLO_MONEDA[moneda] || moneda;
  return `${simbolo} ${Number(monto).toFixed(2)}`;
}

function Stepper({ paso }) {
  return (
    <div className="sp-stepper">
      {PASOS.map((p, i) => {
        const estado = p.n < paso ? "done" : p.n === paso ? "active" : "todo";
        return (
          <div key={p.n} className="sp-step" data-estado={estado}>
            {i > 0 && <span className="sp-step-line" data-estado={p.n <= paso ? "done" : "todo"} />}
            <div className="sp-step-dot">
              {estado === "done" ? <i className="bi bi-check-lg" /> : <i className={`bi ${p.icon}`} />}
            </div>
            <span className="sp-step-label">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function SolicitarPlan() {
  const [params] = useSearchParams();
  const nivelInicial = NIVELES_PLAN[params.get("nivel")] ? params.get("nivel") : "avanzado";
  const planInicial = duracionesDisponibles(nivelInicial).includes(params.get("plan"))
    ? params.get("plan")
    : "semestral";

  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState({
    nombres: "", apellidos: "", email: "", telefono: "",
    nombre_clinica: "", nivel_plan: nivelInicial, plan_solicitado: planInicial, mensaje: "",
  });
  const [archivo, setArchivo]   = useState(null);
  const [preview, setPreview]   = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [error, setError]       = useState("");
  const [enviado, setEnviado]   = useState(false);
  const [pagos, setPagos]       = useState(null); // solo precios + moneda
  const [token, setToken]       = useState(null); // token de la solicitud (paso 1)
  const [banco, setBanco]       = useState(null); // datos bancarios (se piden en el paso 1)

  useEffect(() => {
    axios.get(`${BASE}/config-sistema/pagos`)
      .then((r) => setPagos(r.data.data))
      .catch(() => setPagos({}));
  }, []);

  // Esta página no debe indexarse (muestra datos bancarios tras el paso 1).
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const duraciones = useMemo(() => duracionesDisponibles(form.nivel_plan), [form.nivel_plan]);

  // Si cambia el nivel y la duración actual ya no aplica (ej: trial en Avanzado), ajustar
  useEffect(() => {
    if (!duraciones.includes(form.plan_solicitado)) {
      setForm((f) => ({ ...f, plan_solicitado: duraciones[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nivel_plan]);

  const cambio = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const seleccionarArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivo(file);
    setPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
  };

  const irAPaso2 = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.nombres || !form.apellidos || !form.email || !form.nombre_clinica) {
      setError("Completa todos los campos obligatorios.");
      return;
    }
    // Si ya se registró antes (volvió atrás y sigue), no se vuelve a crear.
    if (token && banco) { setPaso(2); return; }

    setIniciando(true);
    try {
      const { data } = await axios.post(`${BASE}/planes-publicos/iniciar`, form);
      setToken(data.token);
      setBanco(data.datos_bancarios);
      setPaso(2);
    } catch (err) {
      setError(err?.response?.data?.msg || "No se pudo continuar. Intenta de nuevo.");
    } finally {
      setIniciando(false);
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (!archivo) { setError("Debes adjuntar la captura de la transferencia."); return; }

    setEnviando(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (token) fd.append("token", token);
      fd.append("comprobante", archivo);
      await axios.post(`${BASE}/planes-publicos/solicitar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEnviado(true);
    } catch (err) {
      setError(err?.response?.data?.msg || "No se pudo enviar tu solicitud. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const esGratis = form.plan_solicitado === "trial";
  const montoPlan = esGratis
    ? null
    : (pagos ? formatearMonto(pagos[precioClave(form.nivel_plan, form.plan_solicitado)], pagos.moneda) : null);
  const planLabel = `${NIVELES_PLAN[form.nivel_plan].label} · ${DURACION_LABEL[form.plan_solicitado]}`;

  const styles = (
    <style>{`
      .sp-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center;
        padding: 40px 20px; background:
          radial-gradient(1100px 500px at 15% -10%, rgba(13,110,253,.10), transparent 60%),
          radial-gradient(900px 500px at 110% 10%, rgba(14,31,60,.10), transparent 55%),
          #f4f6fb;
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
      .sp-shell { width: 100%; max-width: 940px; }
      .sp-back { display: inline-flex; align-items: center; gap: 6px; color: #64748b;
        text-decoration: none; font-size: 13.5px; font-weight: 600; margin-bottom: 14px;
        transition: color .15s; }
      .sp-back:hover { color: #0f172a; }
      .sp-card { display: grid; grid-template-columns: 320px 1fr; background: #fff;
        border-radius: 24px; overflow: hidden;
        box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 30px 60px -24px rgba(15,23,42,.22);
        border: 1px solid #eef1f6; }
      @media (max-width: 760px) { .sp-card { grid-template-columns: 1fr; } }

      /* ── Panel izquierdo (resumen) ── */
      .sp-aside { position: relative; padding: 34px 30px; color: #e2e8f0; overflow: hidden;
        background: linear-gradient(160deg, #14294a 0%, #0e1f3c 55%, #0b1730 100%); }
      .sp-aside::after { content: ""; position: absolute; width: 260px; height: 260px;
        border-radius: 50%; right: -120px; top: -110px; background: rgba(255,255,255,.05); }
      .sp-aside::before { content: ""; position: absolute; width: 200px; height: 200px;
        border-radius: 50%; left: -90px; bottom: -100px; background: rgba(13,110,253,.14); }
      .sp-brand { position: relative; font-weight: 800; font-size: 15px; letter-spacing: .3px;
        display: flex; align-items: center; gap: 8px; }
      .sp-brand i { color: #4c9bff; }
      .sp-aside h1 { position: relative; font-size: 22px; font-weight: 800; color: #fff;
        margin: 26px 0 6px; line-height: 1.25; }
      .sp-aside .sp-sub { position: relative; font-size: 13px; color: rgba(226,232,240,.7);
        line-height: 1.6; }
      .sp-plan-box { position: relative; margin-top: 22px; padding: 16px 18px; border-radius: 16px;
        background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
        backdrop-filter: blur(4px); }
      .sp-plan-box .k { font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
        color: rgba(226,232,240,.55); }
      .sp-plan-box .plan { font-size: 15px; font-weight: 700; color: #fff; margin-top: 3px; }
      .sp-plan-box .price { font-size: 26px; font-weight: 900; color: #fff; margin-top: 12px;
        line-height: 1; }
      .sp-plan-box .price small { font-size: 13px; font-weight: 600; color: rgba(226,232,240,.6); }
      .sp-perks { position: relative; margin: 24px 0 0; padding: 0; list-style: none;
        display: flex; flex-direction: column; gap: 11px; }
      .sp-perks li { display: flex; align-items: flex-start; gap: 9px; font-size: 12.7px;
        color: rgba(226,232,240,.82); line-height: 1.45; }
      .sp-perks i { color: #4c9bff; font-size: 14px; margin-top: 1px; flex-shrink: 0; }

      /* ── Panel derecho (formulario) ── */
      .sp-main { padding: 36px 38px 34px; }
      @media (max-width: 760px) { .sp-main { padding: 28px 22px; } }
      .sp-main h2 { font-size: 19px; font-weight: 800; color: #0f172a; margin: 0 0 22px; }

      .sp-stepper { display: flex; margin-bottom: 28px; }
      .sp-step { position: relative; flex: 1; display: flex; flex-direction: column;
        align-items: center; gap: 8px; }
      .sp-step-line { position: absolute; height: 2px; top: 17px; right: 50%; width: 100%;
        transform: translateX(-18px); z-index: 0; }
      .sp-step-line[data-estado="done"] { background: #0d6efd; }
      .sp-step-line[data-estado="todo"] { background: #e2e8f0; }
      .sp-step-dot { position: relative; z-index: 1; width: 36px; height: 36px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center; font-size: 15px;
        background: #fff; border: 2px solid #e2e8f0; color: #94a3b8;
        transition: all .25s ease; }
      .sp-step[data-estado="active"] .sp-step-dot { border-color: #0d6efd; color: #0d6efd;
        box-shadow: 0 0 0 5px rgba(13,110,253,.12); }
      .sp-step[data-estado="done"] .sp-step-dot { background: #0d6efd; border-color: #0d6efd;
        color: #fff; }
      .sp-step-label { font-size: 11.5px; font-weight: 600; color: #94a3b8; text-align: center; }
      .sp-step[data-estado="active"] .sp-step-label,
      .sp-step[data-estado="done"] .sp-step-label { color: #0f172a; }

      .sp-label { display: block; font-size: 12px; font-weight: 700; color: #475569;
        margin-bottom: 6px; letter-spacing: .1px; }
      .sp-input, .sp-select, .sp-textarea { width: 100%; border: 1.5px solid #e3e8ef;
        border-radius: 11px; padding: 11px 13px; font-size: 14px; color: #0f172a;
        background: #fff; transition: border-color .15s, box-shadow .15s; outline: none;
        font-family: inherit; }
      .sp-input:focus, .sp-select:focus, .sp-textarea:focus { border-color: #0d6efd;
        box-shadow: 0 0 0 4px rgba(13,110,253,.12); }
      .sp-input::placeholder, .sp-textarea::placeholder { color: #cbd5e1; }
      .sp-select { appearance: none; -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394a3b8' d='M6 8 0 2l1.4-1.4L6 5.2 10.6.6 12 2z'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 14px center; padding-right: 34px; }
      .sp-textarea { resize: vertical; min-height: 76px; }

      .sp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; }
      .sp-grid .sp-full { grid-column: 1 / -1; }
      @media (max-width: 520px) { .sp-grid { grid-template-columns: 1fr; } }

      .sp-total { display: flex; justify-content: space-between; align-items: center;
        margin-top: 22px; padding: 14px 18px; border-radius: 14px;
        background: linear-gradient(120deg, rgba(13,110,253,.09), rgba(13,110,253,.04));
        border: 1px solid rgba(13,110,253,.16); }
      .sp-total .k { font-size: 12.5px; font-weight: 700; color: #1d4ed8;
        text-transform: uppercase; letter-spacing: .5px; }
      .sp-total .v { font-size: 21px; font-weight: 900; color: #1d4ed8; }

      .sp-bank { border: 1px solid #e3e8ef; border-radius: 16px; overflow: hidden; margin-top: 6px; }
      .sp-bank-row { display: flex; justify-content: space-between; gap: 16px;
        padding: 12px 16px; font-size: 13.5px; }
      .sp-bank-row + .sp-bank-row { border-top: 1px solid #f1f5f9; }
      .sp-bank-row .k { color: #94a3b8; }
      .sp-bank-row .v { font-weight: 700; color: #0f172a; text-align: right; }
      .sp-bank-row.total { background: #f8fafc; }
      .sp-bank-row.total .v { color: #1d4ed8; }

      .sp-drop { border: 2px dashed #cbd5e1; border-radius: 16px; padding: 30px 20px;
        text-align: center; cursor: pointer; transition: border-color .15s, background .15s;
        background: #f8fafc; }
      .sp-drop:hover { border-color: #0d6efd; background: #f0f6ff; }
      .sp-drop i { font-size: 30px; color: #0d6efd; }
      .sp-drop .t { font-weight: 700; color: #0f172a; margin-top: 8px; font-size: 14px; }
      .sp-drop .s { font-size: 12px; color: #94a3b8; margin-top: 2px; }
      .sp-drop input { display: none; }
      .sp-file-chip { display: flex; align-items: center; gap: 10px; margin-top: 12px;
        padding: 10px 14px; border-radius: 12px; background: #ecfdf5; border: 1px solid #a7f3d0;
        font-size: 13px; color: #065f46; font-weight: 600; }

      .sp-actions { display: flex; gap: 10px; margin-top: 26px; }
      .sp-btn { border: none; border-radius: 12px; padding: 12px 22px; font-size: 14px;
        font-weight: 700; cursor: pointer; display: inline-flex; align-items: center;
        justify-content: center; gap: 8px; transition: transform .15s, box-shadow .15s, background .15s;
        font-family: inherit; }
      .sp-btn-primary { flex: 1; background: linear-gradient(135deg, #0d6efd, #0b5ed7); color: #fff;
        box-shadow: 0 8px 20px -6px rgba(13,110,253,.5); }
      .sp-btn-primary:hover:not(:disabled) { transform: translateY(-1px);
        box-shadow: 0 12px 26px -6px rgba(13,110,253,.55); }
      .sp-btn-primary:disabled { opacity: .6; cursor: wait; }
      .sp-btn-ghost { background: #fff; border: 1.5px solid #e3e8ef; color: #475569; }
      .sp-btn-ghost:hover { border-color: #cbd5e1; color: #0f172a; }

      .sp-alert { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
        border-radius: 12px; padding: 10px 14px; font-size: 13px; margin-bottom: 18px;
        display: flex; align-items: center; gap: 8px; }

      .sp-note { font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 18px; }
      .sp-note strong { color: #0f172a; }
    `}</style>
  );

  if (enviado) {
    return (
      <div className="sp-wrap">
        {styles}
        <div className="sp-shell" style={{ maxWidth: 460 }}>
          <div className="sp-card" style={{ gridTemplateColumns: "1fr", textAlign: "center" }}>
            <div className="sp-main" style={{ padding: "44px 34px" }}>
              <div style={{
                width: 78, height: 78, borderRadius: "50%", margin: "0 auto 22px",
                background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-check-circle-fill" style={{ fontSize: 38, color: "#10b981" }} />
              </div>
              <h2 style={{ marginBottom: 10 }}>¡Recibimos tu comprobante!</h2>
              <p className="sp-note" style={{ marginBottom: 24 }}>
                Te enviamos un correo de confirmación. Validaremos tu transferencia y te avisaremos
                apenas tu plan quede activo.
              </p>
              <Link to="/" className="sp-btn sp-btn-primary" style={{ textDecoration: "none", display: "inline-flex" }}>
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-wrap">
      {styles}
      <div className="sp-shell">
        <Link to="/" className="sp-back">
          <i className="bi bi-arrow-left" />Volver al inicio
        </Link>

        <div className="sp-card">
          {/* ── Resumen ── */}
          <aside className="sp-aside">
            <div className="sp-brand"><i className="bi bi-heart-pulse-fill" />Medic-KG</div>
            <h1>Solicita tu plan<br />en 3 pasos</h1>
            <p className="sp-sub">
              Completa tus datos, realiza la transferencia y súbenos el comprobante.
              Activamos tu clínica apenas validamos el pago.
            </p>

            <div className="sp-plan-box">
              <div className="k">Plan seleccionado</div>
              <div className="plan">{planLabel}</div>
              <div className="price">
                {esGratis ? "Gratis" : (montoPlan || "—")}
                {!esGratis && <small> / período</small>}
              </div>
            </div>

            <ul className="sp-perks">
              <li><i className="bi bi-lightning-charge-fill" />Activación en menos de 24 horas hábiles</li>
              <li><i className="bi bi-headset" />Acompañamiento en la puesta en marcha</li>
              <li><i className="bi bi-shield-lock-fill" />Tus datos y los de tus pacientes protegidos</li>
              <li><i className="bi bi-receipt" />Contrato y recibo mensual claros</li>
            </ul>
          </aside>

          {/* ── Formulario ── */}
          <div className="sp-main">
            <h2>Solicitar plan</h2>
            <Stepper paso={paso} />

            {error && (
              <div className="sp-alert">
                <i className="bi bi-exclamation-triangle-fill" />{error}
              </div>
            )}

            {/* Paso 1 */}
            {paso === 1 && (
              <form onSubmit={irAPaso2}>
                <div className="sp-grid">
                  <div>
                    <label className="sp-label">Nombres</label>
                    <input className="sp-input" name="nombres" value={form.nombres} onChange={cambio} placeholder="Tu nombre" required />
                  </div>
                  <div>
                    <label className="sp-label">Apellidos</label>
                    <input className="sp-input" name="apellidos" value={form.apellidos} onChange={cambio} placeholder="Tus apellidos" required />
                  </div>
                  <div>
                    <label className="sp-label">Correo</label>
                    <input type="email" className="sp-input" name="email" value={form.email} onChange={cambio} placeholder="correo@ejemplo.com" required />
                  </div>
                  <div>
                    <label className="sp-label">Teléfono</label>
                    <input className="sp-input" name="telefono" value={form.telefono} onChange={cambio} placeholder="Opcional" />
                  </div>
                  <div className="sp-full">
                    <label className="sp-label">Nombre de la clínica</label>
                    <input className="sp-input" name="nombre_clinica" value={form.nombre_clinica} onChange={cambio} placeholder="Cómo se llama tu clínica o consultorio" required />
                  </div>
                  <div>
                    <label className="sp-label">Plan</label>
                    <select className="sp-select" name="nivel_plan" value={form.nivel_plan} onChange={cambio}>
                      {Object.entries(NIVELES_PLAN).map(([id, p]) => (
                        <option key={id} value={id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sp-label">Duración</label>
                    <select className="sp-select" name="plan_solicitado" value={form.plan_solicitado} onChange={cambio}>
                      {duraciones.map((d) => (
                        <option key={d} value={d}>{DURACION_LABEL[d]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sp-full">
                    <label className="sp-label">Mensaje <span style={{ color: "#94a3b8", fontWeight: 500 }}>(opcional)</span></label>
                    <textarea className="sp-textarea" name="mensaje" rows={2} value={form.mensaje} onChange={cambio} placeholder="¿Algo que quieras contarnos?" />
                  </div>
                </div>

                <div className="sp-total">
                  <span className="k">Total a transferir</span>
                  <span className="v">{esGratis ? "Gratis" : (montoPlan || "—")}</span>
                </div>

                <div className="sp-actions">
                  <button type="submit" className="sp-btn sp-btn-primary" disabled={iniciando}>
                    {iniciando ? "Un momento…" : <>Continuar <i className="bi bi-arrow-right" /></>}
                  </button>
                </div>
              </form>
            )}

            {/* Paso 2 */}
            {paso === 2 && (
              <div>
                <p className="sp-note">
                  Transfiere {esGratis ? "" : montoPlan ? <strong>{montoPlan}</strong> : ""} del plan{" "}
                  <strong>{planLabel}</strong> a la siguiente cuenta:
                </p>
                <div className="sp-bank">
                  <div className="sp-bank-row"><span className="k">Banco</span><span className="v">{banco?.banco || "—"}</span></div>
                  <div className="sp-bank-row"><span className="k">Titular</span><span className="v">{banco?.titular || "—"}</span></div>
                  <div className="sp-bank-row"><span className="k">Cuenta</span><span className="v">{banco?.numero_cuenta || "—"}</span></div>
                  {banco?.numero_cci && (
                    <div className="sp-bank-row"><span className="k">CCI</span><span className="v">{banco.numero_cci}</span></div>
                  )}
                  <div className="sp-bank-row total"><span className="k">Monto</span><span className="v">{esGratis ? "Gratis" : (montoPlan || "—")}</span></div>
                </div>

                <div className="sp-actions">
                  <button type="button" className="sp-btn sp-btn-ghost" onClick={() => setPaso(1)}>
                    <i className="bi bi-arrow-left" />Atrás
                  </button>
                  <button type="button" className="sp-btn sp-btn-primary" onClick={() => setPaso(3)}>
                    Ya transferí <i className="bi bi-arrow-right" />
                  </button>
                </div>
              </div>
            )}

            {/* Paso 3 */}
            {paso === 3 && (
              <form onSubmit={enviar}>
                <p className="sp-note">
                  Sube la captura o el PDF de la transferencia por <strong>{esGratis ? "—" : (montoPlan || "—")}</strong>.
                </p>
                <label className="sp-drop">
                  <i className="bi bi-cloud-arrow-up-fill" />
                  <div className="t">{archivo ? "Cambiar archivo" : "Selecciona tu comprobante"}</div>
                  <div className="s">Imagen o PDF · máx. 5 MB</div>
                  <input type="file" accept="image/*,application/pdf" onChange={seleccionarArchivo} required />
                </label>

                {archivo && (
                  <div className="sp-file-chip">
                    <i className="bi bi-file-earmark-check-fill" />
                    {archivo.name}
                  </div>
                )}
                {preview && (
                  <img src={preview} alt="Vista previa" style={{ width: "100%", borderRadius: 14, marginTop: 12, maxHeight: 240, objectFit: "contain", border: "1px solid #e3e8ef" }} />
                )}

                <div className="sp-actions">
                  <button type="button" className="sp-btn sp-btn-ghost" onClick={() => setPaso(2)} disabled={enviando}>
                    <i className="bi bi-arrow-left" />Atrás
                  </button>
                  <button type="submit" className="sp-btn sp-btn-primary" disabled={enviando}>
                    {enviando ? "Enviando…" : <>Enviar solicitud <i className="bi bi-send" /></>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
