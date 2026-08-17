/**
 * Portal público de compra de plan
 * URL: /solicitar-plan?plan=anual
 *
 * Flujo en 3 pasos:
 *   1. Datos del médico/clínica y plan deseado (muestra el total a transferir)
 *   2. Datos de la cuenta bancaria para transferir
 *   3. Subir la captura de la transferencia
 */
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { SIMBOLO_MONEDA } from "../utils/monedas";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

const PLANES = {
  trial:     { label: "Prueba (14 días)" },
  semestral: { label: "Semestral" },
  anual:     { label: "Anual" },
};

const TOTAL_PASOS = 3;

function PasoIndicador({ paso }) {
  return (
    <div className="d-flex align-items-center gap-2 mb-4">
      {[1, 2, 3].map((n) => (
        <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= paso ? "#0d6efd" : "#e2e8f0" }} />
      ))}
    </div>
  );
}

function formatearMonto(monto, moneda) {
  if (monto == null) return null;
  const simbolo = SIMBOLO_MONEDA[moneda] || moneda;
  return `${simbolo} ${Number(monto).toFixed(2)}`;
}

export default function SolicitarPlan() {
  const [params] = useSearchParams();
  const planInicial = PLANES[params.get("plan")] ? params.get("plan") : "anual";

  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState({
    nombres: "", apellidos: "", email: "", telefono: "",
    nombre_clinica: "", plan_solicitado: planInicial, mensaje: "",
  });
  const [archivo, setArchivo]   = useState(null);
  const [preview, setPreview]   = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError]       = useState("");
  const [enviado, setEnviado]   = useState(false);
  const [pagos, setPagos]       = useState(null); // config de cuenta bancaria + precios

  useEffect(() => {
    axios.get(`${BASE}/config-sistema/pagos`)
      .then((r) => setPagos(r.data.data))
      .catch(() => setPagos({}));
  }, []);

  const cambio = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const seleccionarArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivo(file);
    setPreview(URL.createObjectURL(file));
  };

  const irAPaso2 = (e) => {
    e.preventDefault();
    setError("");
    if (!form.nombres || !form.apellidos || !form.email || !form.nombre_clinica) {
      setError("Completa todos los campos obligatorios.");
      return;
    }
    setPaso(2);
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    if (!archivo) { setError("Debes adjuntar la captura de la transferencia."); return; }

    setEnviando(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
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

  const montoPlan = pagos ? formatearMonto(pagos[`precio_${form.plan_solicitado}`], pagos.moneda) : null;

  if (enviado) {
    return (
      <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center" style={{ background: "#f1f5f9", padding: "2rem" }}>
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center" style={{ maxWidth: 480, width: "100%" }}>
          <div className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-4" style={{ width: 80, height: 80 }}>
            <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "2.4rem" }} />
          </div>
          <h4 className="fw-bold text-dark mb-2">¡Recibimos tu comprobante!</h4>
          <p className="text-muted mb-4">
            Te enviamos un correo de confirmación. Validaremos tu transferencia y te avisaremos
            por correo apenas tu plan quede activo.
          </p>
          <Link to="/" className="btn btn-primary px-5">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: "#f1f5f9", padding: "2rem" }}>
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5" style={{ maxWidth: 640, width: "100%" }}>
        <h4 className="fw-bold text-dark mb-1">Solicitar plan</h4>
        <p className="text-muted mb-3">Paso {paso} de {TOTAL_PASOS}</p>
        <PasoIndicador paso={paso} />

        {error && <div className="alert alert-danger py-2">{error}</div>}

        {/* ── Paso 1: datos ── */}
        {paso === 1 && (
          <form onSubmit={irAPaso2}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Nombres</label>
                <input className="form-control" name="nombres" value={form.nombres} onChange={cambio} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Apellidos</label>
                <input className="form-control" name="apellidos" value={form.apellidos} onChange={cambio} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Correo</label>
                <input type="email" className="form-control" name="email" value={form.email} onChange={cambio} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Teléfono</label>
                <input className="form-control" name="telefono" value={form.telefono} onChange={cambio} />
              </div>
              <div className="col-md-8">
                <label className="form-label small fw-semibold">Nombre de la clínica</label>
                <input className="form-control" name="nombre_clinica" value={form.nombre_clinica} onChange={cambio} required />
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Plan</label>
                <select className="form-select" name="plan_solicitado" value={form.plan_solicitado} onChange={cambio}>
                  {Object.entries(PLANES).map(([id, p]) => (
                    <option key={id} value={id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Mensaje (opcional)</label>
                <textarea className="form-control" name="mensaje" rows={2} value={form.mensaje} onChange={cambio} />
              </div>
            </div>

            {montoPlan && (
              <div className="d-flex justify-content-between align-items-center bg-primary bg-opacity-10 rounded-3 px-3 py-2 mt-3">
                <span className="small fw-semibold text-primary">Total a transferir</span>
                <span className="fw-bold text-primary fs-5">{montoPlan}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary w-100 mt-4">
              Continuar <i className="bi bi-arrow-right ms-1" />
            </button>
          </form>
        )}

        {/* ── Paso 2: datos bancarios ── */}
        {paso === 2 && (
          <div>
            <p className="text-muted">
              Transfiere{montoPlan ? <> <strong>{montoPlan}</strong></> : ""} correspondiente al plan{" "}
              <strong>{PLANES[form.plan_solicitado].label}</strong> a la siguiente cuenta:
            </p>
            <div className="bg-light rounded-3 p-3 mb-4">
              <div className="row row-cols-2 g-2 small">
                <div className="text-muted">Banco</div><div className="fw-semibold">{pagos?.banco || "—"}</div>
                <div className="text-muted">Titular</div><div className="fw-semibold">{pagos?.titular || "—"}</div>
                <div className="text-muted">Cuenta</div><div className="fw-semibold">{pagos?.numero_cuenta || "—"}</div>
                {pagos?.numero_cci && (<><div className="text-muted">CCI</div><div className="fw-semibold">{pagos.numero_cci}</div></>)}
                {montoPlan && (<><div className="text-muted">Monto</div><div className="fw-bold text-primary">{montoPlan}</div></>)}
              </div>
            </div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setPaso(1)}>
                <i className="bi bi-arrow-left me-1" />Atrás
              </button>
              <button type="button" className="btn btn-primary flex-fill" onClick={() => setPaso(3)}>
                Ya transferí, continuar <i className="bi bi-arrow-right ms-1" />
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: subir comprobante ── */}
        {paso === 3 && (
          <form onSubmit={enviar}>
            <label className="form-label small fw-semibold">Captura de la transferencia</label>
            <input type="file" accept="image/*,application/pdf" className="form-control" onChange={seleccionarArchivo} required />
            {preview && (
              <img src={preview} alt="Vista previa" className="img-fluid rounded-3 mt-2" style={{ maxHeight: 240 }} />
            )}

            <div className="d-flex gap-2 mt-4">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setPaso(2)} disabled={enviando}>
                <i className="bi bi-arrow-left me-1" />Atrás
              </button>
              <button type="submit" className="btn btn-primary flex-fill" disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
