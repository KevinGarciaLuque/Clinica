/**
 * Panel SUPER_ADMIN — Solicitudes públicas de compra de plan
 * URL: /superadmin/solicitudes-plan
 */
import { useEffect, useState } from "react";
import api from "../../api/api";
import { MONEDAS } from "../../utils/monedas";
import { planCompletoLabel, precioClave } from "../../utils/planes";

const ROLES_USUARIO = [
  { id: "ADMIN",         label: "Administrador de la clínica" },
  { id: "MEDICO",        label: "Médico" },
  { id: "PSICOLOGO",     label: "Psicólogo/a" },
  { id: "ENFERMERA",     label: "Enfermero/a" },
  { id: "RECEPCIONISTA", label: "Recepcionista" },
];

export default function SolicitudesPlan() {
  const [estado, setEstado]         = useState("pendiente");
  const [solicitudes, setSolicitudes] = useState([]);
  const [tipos, setTipos]           = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [pagosCfg, setPagosCfg]     = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [modal, setModal]           = useState(null); // solicitud en aprobación
  const [form, setForm]             = useState({ slug: "", tipo_id: "", es_pediatrica: false, monto: "", moneda: "HNL", tipo_usuario: "ADMIN" });
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState("");

  const cargar = async () => {
    setCargando(true);
    try {
      const [rS, rT, rE] = await Promise.all([
        api.get(`/planes-publicos/solicitudes?estado=${estado}`),
        api.get("/clinicas/tipos"),
        api.get("/usuarios/especialidades"),
      ]);
      setSolicitudes(rS.data.data || []);
      setTipos(rT.data.data || []);
      setEspecialidades(rE.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [estado]);

  useEffect(() => {
    api.get("/config-sistema/pagos").then((r) => setPagosCfg(r.data.data)).catch(() => {});
  }, []);

  const abrirAprobar = (sol) => {
    setModal(sol);
    const precioSugerido = sol.plan_solicitado === "trial"
      ? ""
      : pagosCfg?.[precioClave(sol.nivel_plan, sol.plan_solicitado)] ?? "";
    setForm({
      slug: sol.nombre_clinica.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      tipo_id: "", es_pediatrica: false, monto: precioSugerido, moneda: pagosCfg?.moneda || "HNL",
      tipo_usuario: "ADMIN", especialidad_id: "",
    });
    setError("");
  };

  const aprobar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const { data } = await api.post(`/planes-publicos/solicitudes/${modal.id}/aprobar`, form);
      setModal(null);
      cargar();
      if (data?.emails_ok === false) {
        mostrarToast(false, "Clínica creada, pero falló el envío de correos. Usa \"Reenviar credenciales\".");
      } else {
        mostrarToast(true, "Clínica creada y credenciales enviadas por correo.");
      }
    } catch (err) {
      setError(err?.response?.data?.msg || "Error al aprobar la solicitud");
    } finally {
      setGuardando(false);
    }
  };

  const [toast, setToast] = useState(null); // { ok, text }
  const mostrarToast = (ok, text) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4000);
  };

  const [rechazarModal, setRechazarModal] = useState(null); // solicitud a rechazar
  const [motivoRechazo, setMotivoRechazo] = useState("No se pudo validar el comprobante");
  const [rechazando, setRechazando] = useState(false);

  const abrirRechazar = (sol) => {
    setRechazarModal(sol);
    setMotivoRechazo("No se pudo validar el comprobante");
  };

  const confirmarRechazo = async (e) => {
    e.preventDefault();
    setRechazando(true);
    try {
      await api.put(`/planes-publicos/solicitudes/${rechazarModal.id}/rechazar`, { motivo: motivoRechazo });
      setRechazarModal(null);
      cargar();
      mostrarToast(true, "Solicitud rechazada.");
    } catch (err) {
      mostrarToast(false, err?.response?.data?.msg || "Error al rechazar la solicitud");
    } finally {
      setRechazando(false);
    }
  };

  const [confirmReenvio, setConfirmReenvio] = useState(null); // solicitud a confirmar
  const [reenviando, setReenviando]         = useState(null); // id de la solicitud en proceso

  const confirmarReenvio = async () => {
    const sol = confirmReenvio;
    setConfirmReenvio(null);
    setReenviando(sol.id);
    try {
      await api.post(`/planes-publicos/solicitudes/${sol.id}/reenviar-credenciales`);
      mostrarToast(true, "Credenciales reenviadas correctamente.");
    } catch (err) {
      mostrarToast(false, err?.response?.data?.msg || "Error al reenviar las credenciales");
    } finally {
      setReenviando(null);
    }
  };

  const [confirmEliminar, setConfirmEliminar] = useState(null); // solicitud a confirmar
  const [eliminando, setEliminando]           = useState(false);

  const confirmarEliminar = async () => {
    setEliminando(true);
    try {
      await api.delete(`/planes-publicos/solicitudes/${confirmEliminar.id}`);
      setConfirmEliminar(null);
      cargar();
      mostrarToast(true, "Solicitud eliminada.");
    } catch (err) {
      mostrarToast(false, err?.response?.data?.msg || "Error al eliminar la solicitud");
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      {toast && (
        <div
          className={`alert py-2 px-3 shadow-sm ${toast.ok ? "alert-success" : "alert-danger"}`}
          style={{ position: "fixed", top: 20, right: 20, zIndex: 2000, minWidth: 280, borderRadius: 10 }}
        >
          <i className={`bi ${toast.ok ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"} me-2`} />
          {toast.text}
        </div>
      )}

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
              <div className="card h-100 border-0 shadow-sm rounded-4" style={{ position: "relative" }}>
                <button
                  className="btn btn-sm btn-light shadow-sm"
                  title="Eliminar solicitud"
                  onClick={() => setConfirmEliminar(sol)}
                  style={{ position: "absolute", top: 10, left: 10, zIndex: 2, borderRadius: 8, padding: "5px 9px" }}
                >
                  <i className="bi bi-trash text-danger" />
                </button>
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
                  <span className="badge bg-primary-subtle text-primary-emphasis">{planCompletoLabel(sol.nivel_plan, sol.plan_solicitado)}</span>
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
                      <button className="btn btn-outline-danger btn-sm flex-fill" onClick={() => abrirRechazar(sol)}>
                        <i className="bi bi-x-lg me-1" />Rechazar
                      </button>
                    </div>
                  )}
                  {sol.estado === "aprobada" && (
                    <button
                      className="btn btn-outline-primary btn-sm w-100 mt-3"
                      onClick={() => setConfirmReenvio(sol)}
                      disabled={reenviando === sol.id}
                    >
                      <i className="bi bi-envelope-arrow-up me-1" />
                      {reenviando === sol.id ? "Reenviando..." : "Reenviar credenciales"}
                    </button>
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
                      Plan solicitado: {planCompletoLabel(modal.nivel_plan, modal.plan_solicitado)}
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
                  <div className="row g-2 mb-3">
                    <div className={form.tipo_usuario === "MEDICO" ? "col-6" : "col-12"}>
                      <label className="form-label small fw-semibold">Rol del usuario a crear</label>
                      <select className="form-select" value={form.tipo_usuario}
                              onChange={(e) => setForm((f) => ({ ...f, tipo_usuario: e.target.value }))}>
                        {ROLES_USUARIO.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>
                    {form.tipo_usuario === "MEDICO" && (
                      <div className="col-6">
                        <label className="form-label small fw-semibold">Especialidad</label>
                        <select className="form-select" value={form.especialidad_id}
                                onChange={(e) => setForm((f) => ({ ...f, especialidad_id: e.target.value }))}>
                          <option value="">Sin especificar</option>
                          {especialidades.map((esp) => <option key={esp.id} value={esp.id}>{esp.nombre}</option>)}
                        </select>
                      </div>
                    )}
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

      {/* ── Modal: rechazar solicitud ── */}
      {rechazarModal && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setRechazarModal(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4">
              <form onSubmit={confirmarRechazo}>
                <div className="modal-header">
                  <h5 className="modal-title">Rechazar solicitud — {rechazarModal.nombre_clinica}</h5>
                  <button type="button" className="btn-close" onClick={() => setRechazarModal(null)} />
                </div>
                <div className="modal-body">
                  <label className="form-label small fw-semibold">Motivo del rechazo (se enviará al médico)</label>
                  <textarea
                    className="form-control" rows={3} value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    required
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setRechazarModal(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-danger" disabled={rechazando}>
                    {rechazando ? "Rechazando..." : "Rechazar solicitud"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: confirmar reenvío de credenciales ── */}
      {confirmReenvio && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setConfirmReenvio(null)}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-envelope-arrow-up me-2 text-primary" />Reenviar credenciales</h5>
                <button type="button" className="btn-close" onClick={() => setConfirmReenvio(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  Se generará una <strong>contraseña nueva</strong> (la anterior dejará de funcionar) y se enviará
                  por correo a <strong>{confirmReenvio.email}</strong>. ¿Continuar?
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmReenvio(null)}>Cancelar</button>
                <button type="button" className="btn btn-primary" onClick={confirmarReenvio}>
                  <i className="bi bi-send-fill me-1" />Sí, reenviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: confirmar eliminación ── */}
      {confirmEliminar && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setConfirmEliminar(null)}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-trash-fill me-2 text-danger" />Eliminar solicitud</h5>
                <button type="button" className="btn-close" onClick={() => setConfirmEliminar(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  ¿Eliminar la solicitud de <strong>{confirmEliminar.nombres} {confirmEliminar.apellidos}</strong> ({confirmEliminar.nombre_clinica})?
                  {confirmEliminar.estado === "aprobada" && (
                    <> La clínica y el usuario que ya se crearon <strong>no</strong> se eliminarán, solo este registro de la solicitud.</>
                  )}
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmEliminar(null)}>Cancelar</button>
                <button type="button" className="btn btn-danger" onClick={confirmarEliminar} disabled={eliminando}>
                  <i className="bi bi-trash me-1" />{eliminando ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
