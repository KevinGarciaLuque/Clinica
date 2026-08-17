/**
 * Panel SUPER_ADMIN — Solicitudes públicas de compra de plan
 * URL: /superadmin/solicitudes-plan
 */
import { useEffect, useState } from "react";
import api from "../../api/api";
import { MONEDAS } from "../../utils/monedas";

const PLAN_LABEL = { trial: "Prueba (14 días)", semestral: "Semestral", anual: "Anual" };

export default function SolicitudesPlan() {
  const [estado, setEstado]         = useState("pendiente");
  const [solicitudes, setSolicitudes] = useState([]);
  const [tipos, setTipos]           = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [modal, setModal]           = useState(null); // solicitud en aprobación
  const [form, setForm]             = useState({ slug: "", tipo_id: "", es_pediatrica: false, monto: "", moneda: "HNL" });
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState("");

  const cargar = async () => {
    setCargando(true);
    try {
      const [rS, rT] = await Promise.all([
        api.get(`/planes-publicos/solicitudes?estado=${estado}`),
        api.get("/clinicas/tipos"),
      ]);
      setSolicitudes(rS.data.data || []);
      setTipos(rT.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [estado]);

  const abrirAprobar = (sol) => {
    setModal(sol);
    setForm({
      slug: sol.nombre_clinica.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      tipo_id: "", es_pediatrica: false, monto: "", moneda: "HNL",
    });
    setError("");
  };

  const aprobar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      await api.post(`/planes-publicos/solicitudes/${modal.id}/aprobar`, form);
      setModal(null);
      cargar();
    } catch (err) {
      setError(err?.response?.data?.msg || "Error al aprobar la solicitud");
    } finally {
      setGuardando(false);
    }
  };

  const rechazar = async (sol) => {
    const motivo = window.prompt("Motivo del rechazo (se enviará al médico):", "No se pudo validar el comprobante");
    if (motivo === null) return;
    try {
      await api.put(`/planes-publicos/solicitudes/${sol.id}/rechazar`, { motivo });
      cargar();
    } catch (err) {
      alert(err?.response?.data?.msg || "Error al rechazar la solicitud");
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">Solicitudes de plan</h4>
        <select className="form-select w-auto" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="todas">Historial completo</option>
        </select>
      </div>

      {cargando ? (
        <div className="text-muted">Cargando...</div>
      ) : !solicitudes.length ? (
        <div className="text-muted">No hay solicitudes {estado === "todas" ? "" : `en estado "${estado}"`}.</div>
      ) : (
        <div className="row g-3">
          {solicitudes.map((sol) => (
            <div className="col-md-6 col-lg-4" key={sol.id}>
              <div className="card h-100 border-0 shadow-sm rounded-4">
                <a href={sol.comprobante_url} target="_blank" rel="noopener noreferrer" style={{ position: "relative" }}>
                  <img src={sol.comprobante_url} alt="Comprobante" className="card-img-top" style={{ maxHeight: 220, objectFit: "cover" }} />
                  {estado === "todas" && (
                    <span className={`badge position-absolute top-0 end-0 m-2 ${
                      sol.estado === "pendiente" ? "bg-warning text-dark" : sol.estado === "aprobada" ? "bg-success" : "bg-danger"
                    }`}>
                      {sol.estado}
                    </span>
                  )}
                </a>
                <div className="card-body">
                  <div className="fw-bold">{sol.nombres} {sol.apellidos}</div>
                  <div className="text-muted small mb-1">{sol.email} · {sol.telefono || "sin teléfono"}</div>
                  <div className="small mb-2"><strong>Clínica:</strong> {sol.nombre_clinica}</div>
                  <span className="badge bg-primary-subtle text-primary-emphasis">{PLAN_LABEL[sol.plan_solicitado]}</span>
                  {sol.monto != null && (
                    <span className="badge bg-success-subtle text-success-emphasis ms-1">{sol.moneda} {Number(sol.monto).toFixed(2)}</span>
                  )}
                  {sol.mensaje && <p className="small text-muted mt-2 mb-2">"{sol.mensaje}"</p>}
                  <div className="small text-muted">{new Date(sol.creado_en).toLocaleString("es-HN")}</div>

                  {sol.estado === "pendiente" && (
                    <div className="d-flex gap-2 mt-3">
                      <button className="btn btn-success btn-sm flex-fill" onClick={() => abrirAprobar(sol)}>
                        <i className="bi bi-check-lg me-1" />Aprobar
                      </button>
                      <button className="btn btn-outline-danger btn-sm flex-fill" onClick={() => rechazar(sol)}>
                        <i className="bi bi-x-lg me-1" />Rechazar
                      </button>
                    </div>
                  )}
                  {sol.estado === "rechazada" && sol.motivo_rechazo && (
                    <div className="alert alert-danger small mt-2 mb-0 py-1">{sol.motivo_rechazo}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setModal(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4">
              <form onSubmit={aprobar}>
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title mb-1">Aprobar solicitud — {modal.nombre_clinica}</h5>
                    <span className="badge bg-primary-subtle text-primary-emphasis">
                      Plan solicitado: {PLAN_LABEL[modal.plan_solicitado]}
                    </span>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setModal(null)} />
                </div>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2">{error}</div>}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Slug de la clínica</label>
                    <input className="form-control" value={form.slug}
                           onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Tipo de clínica</label>
                    <select className="form-select" value={form.tipo_id}
                            onChange={(e) => setForm((f) => ({ ...f, tipo_id: e.target.value }))}>
                      <option value="">Sin especificar</option>
                      {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-check mb-3">
                    <input type="checkbox" className="form-check-input" id="esPed" checked={form.es_pediatrica}
                           onChange={(e) => setForm((f) => ({ ...f, es_pediatrica: e.target.checked }))} />
                    <label className="form-check-label small" htmlFor="esPed">Clínica pediátrica</label>
                  </div>
                  <div className="row g-2">
                    <div className="col-8">
                      <label className="form-label small fw-semibold">Monto cobrado (para el recibo)</label>
                      <input type="number" step="0.01" className="form-control" value={form.monto}
                             onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))} />
                    </div>
                    <div className="col-4">
                      <label className="form-label small fw-semibold">Moneda</label>
                      <select className="form-select" value={form.moneda}
                              onChange={(e) => setForm((f) => ({ ...f, moneda: e.target.value }))}>
                        {MONEDAS.map((m) => (
                          <option key={m.code} value={m.code}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setModal(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-success" disabled={guardando}>
                    {guardando ? "Creando..." : "Aprobar y crear clínica"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
