/**
 * Panel SUPER_ADMIN — Reseñas de médicos clientes
 * URL: /superadmin/resenas
 */
import { useEffect, useState } from "react";
import api from "../../api/api";

export default function ResenasMedicos() {
  const [clinicas, setClinicas]     = useState([]);
  const [medicos, setMedicos]       = useState([]);
  const [clinicaId, setClinicaId]   = useState("");
  const [usuarioId, setUsuarioId]   = useState("");
  const [enviando, setEnviando]     = useState(false);
  const [msg, setMsg]               = useState(null);

  const [resenas, setResenas]       = useState([]);
  const [cargando, setCargando]     = useState(true);

  useEffect(() => {
    api.get("/clinicas").then((r) => setClinicas(r.data.data || [])).catch(() => {});
    cargarResenas();
  }, []);

  useEffect(() => {
    setUsuarioId("");
    if (!clinicaId) { setMedicos([]); return; }
    api.get(`/usuarios?clinica_id=${clinicaId}`).then((r) => setMedicos(r.data.data || [])).catch(() => setMedicos([]));
  }, [clinicaId]);

  const cargarResenas = () => {
    setCargando(true);
    api.get("/resenas").then((r) => setResenas(r.data.data || [])).catch(() => {}).finally(() => setCargando(false));
  };

  const enviarEncuesta = async (e) => {
    e.preventDefault();
    if (!usuarioId) return;
    setEnviando(true);
    setMsg(null);
    try {
      await api.post("/resenas/solicitar", { usuario_id: usuarioId });
      setMsg({ ok: true, text: "Encuesta enviada por correo." });
      setUsuarioId("");
      cargarResenas();
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.msg || "Error al enviar la encuesta" });
    } finally {
      setEnviando(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const toggleActivo = async (r) => {
    await api.put(`/resenas/${r.id}/activo`, { activo: !r.activo });
    cargarResenas();
  };

  const eliminar = async (r) => {
    if (!window.confirm("¿Eliminar esta reseña?")) return;
    await api.delete(`/resenas/${r.id}`);
    cargarResenas();
  };

  return (
    <div className="container-fluid py-4">
      <h4 className="fw-bold mb-3">Reseñas de médicos</h4>

      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body">
          <h6 className="fw-bold mb-3"><i className="bi bi-envelope-paper-heart-fill me-2 text-warning" />Enviar encuesta a un médico</h6>
          {msg && <div className={`alert py-2 small ${msg.ok ? "alert-success" : "alert-danger"}`}>{msg.text}</div>}
          <form onSubmit={enviarEncuesta} className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label small fw-semibold">Clínica</label>
              <select className="form-select" value={clinicaId} onChange={(e) => setClinicaId(e.target.value)} required>
                <option value="">Selecciona una clínica...</option>
                {clinicas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="col-md-5">
              <label className="form-label small fw-semibold">Médico</label>
              <select className="form-select" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} required disabled={!clinicaId}>
                <option value="">Selecciona un médico...</option>
                {medicos.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombres} {u.apellidos} — {u.tipo}{u.especialidad ? ` (${u.especialidad})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-warning w-100 fw-bold" disabled={enviando || !usuarioId}>
                {enviando ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <h6 className="fw-bold mb-3">Historial</h6>
      {cargando ? (
        <div className="text-muted">Cargando...</div>
      ) : !resenas.length ? (
        <div className="text-muted">Aún no has enviado ninguna encuesta.</div>
      ) : (
        <div className="row g-3">
          {resenas.map((r) => (
            <div className="col-md-6 col-lg-4" key={r.id}>
              <div className="card h-100 border-0 shadow-sm rounded-4">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <div className="fw-bold">{r.nombre_medico}</div>
                    <span className={`badge ${r.estado === "respondida" ? "bg-success" : "bg-secondary"}`}>
                      {r.estado === "respondida" ? "Respondida" : "Pendiente"}
                    </span>
                  </div>
                  <div className="text-muted small mb-2">
                    {r.especialidad || "—"} · {r.lugar || "—"} {r.clinica_nombre ? `· ${r.clinica_nombre}` : ""}
                  </div>
                  {r.estado === "respondida" && (
                    <>
                      <div className="mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <i key={i} className={`bi ${i < r.estrellas ? "bi-star-fill" : "bi-star"} text-warning`} />
                        ))}
                      </div>
                      <p className="small text-muted mb-2">"{r.opinion}"</p>
                    </>
                  )}
                  <div className="d-flex gap-2 mt-2">
                    {r.estado === "respondida" && (
                      <button className={`btn btn-sm flex-fill ${r.activo ? "btn-outline-secondary" : "btn-outline-success"}`} onClick={() => toggleActivo(r)}>
                        <i className={`bi ${r.activo ? "bi-eye-slash" : "bi-eye"} me-1`} />{r.activo ? "Ocultar de landing" : "Mostrar en landing"}
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-danger" onClick={() => eliminar(r)}>
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
