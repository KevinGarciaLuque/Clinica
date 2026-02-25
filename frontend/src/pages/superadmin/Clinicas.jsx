import { useEffect, useState, useCallback } from "react";
import api from "../../api/api";

const EMPTY_C = {
  nombre: "", slug: "", email: "", telefono: "", direccion: "", ciudad: "", pais: "PE", ruc: "",
};
const EMPTY_A = { admin_nombres: "", admin_apellidos: "", admin_email: "", admin_password: "" };

export default function Clinicas() {
  const [clinicas, setClinicas]   = useState([]);
  const [form, setForm]           = useState({ ...EMPTY_C, ...EMPTY_A });
  const [editId, setEditId]       = useState(null);
  const [busqueda, setBusqueda]   = useState("");
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState("");
  const [showModal, setShowModal] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.get("/clinicas");
      setClinicas(res.data.data);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setForm({ ...EMPTY_C, ...EMPTY_A }); setEditId(null); setError(""); setShowModal(true);
  };

  const abrirEditar = (c) => {
    setForm({ nombre: c.nombre, slug: c.slug, email: c.email||"",
              telefono: c.telefono||"", direccion: c.direccion||"",
              ciudad: c.ciudad||"", pais: c.pais||"PE", ruc: c.ruc||"",
              ...EMPTY_A });
    setEditId(c.id); setError(""); setShowModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault(); setError("");
    try {
      if (editId) {
        await api.put(`/clinicas/${editId}`, form);
      } else {
        await api.post("/clinicas", form);
      }
      setShowModal(false); cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const toggleActivo = async (c) => {
    try {
      if (c.activo) {
        await api.delete(`/clinicas/${c.id}`);
      } else {
        await api.put(`/clinicas/${c.id}`, { activo: 1 });
      }
      cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const filtradas = clinicas.filter((c) =>
    `${c.nombre} ${c.slug}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Gestión de Clínicas</h4>
          <small className="text-muted">Panel SUPER_ADMIN — todas las clínicas del sistema</small>
        </div>
        <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>+ Nueva clínica</button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="mb-3">
        <input className="form-control" placeholder="Buscar clínica..."
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {cargando ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : (
        <div className="row g-3">
          {filtradas.map((c) => (
            <div key={c.id} className="col-md-6 col-lg-4">
              <div className={`card h-100 ${c.activo ? "" : "opacity-50"}`}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h6 className="card-title mb-0">{c.nombre}</h6>
                    <span className={`badge ${c.activo ? "bg-success" : "bg-secondary"}`}>
                      {c.activo ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <p className="text-muted small mb-1">
                    <span className="badge bg-light text-dark border me-1">slug: {c.slug}</span>
                  </p>
                  {c.email    && <p className="small mb-1">✉ {c.email}</p>}
                  {c.telefono && <p className="small mb-1">📞 {c.telefono}</p>}
                  {c.ciudad   && <p className="small mb-1">📍 {c.ciudad}</p>}
                </div>
                <div className="card-footer d-flex gap-2">
                  <button className="btn btn-outline-primary btn-sm flex-fill"
                    onClick={() => abrirEditar(c)}>Editar</button>
                  <button className={`btn btn-sm flex-fill ${c.activo ? "btn-outline-warning" : "btn-outline-success"}`}
                    onClick={() => toggleActivo(c)}>
                    {c.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!filtradas.length && (
            <div className="col-12 text-center text-muted py-5">No hay clínicas registradas</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editId ? "Editar clínica" : "Nueva clínica"}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2">{error}</div>}
                  <h6 className="text-muted mb-3">Datos de la clínica</h6>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Nombre *</label>
                      <input className="form-control" value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">
                        Slug * <small className="text-muted">(clinica1 → clinica1.tudominio.com)</small>
                      </label>
                      <input className="form-control" value={form.slug} placeholder="clinica-ejemplo"
                        onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s/g,"-") })}
                        pattern="[a-z0-9\-]+" required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email</label>
                      <input className="form-control" type="email" value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Teléfono</label>
                      <input className="form-control" value={form.telefono}
                        onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Dirección</label>
                      <input className="form-control" value={form.direccion}
                        onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Ciudad</label>
                      <input className="form-control" value={form.ciudad}
                        onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">RUC / NIT</label>
                      <input className="form-control" value={form.ruc}
                        onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
                    </div>
                  </div>

                  {!editId && (
                    <>
                      <hr />
                      <h6 className="text-muted mb-3">Administrador inicial (opcional)</h6>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Nombres del admin</label>
                          <input className="form-control" value={form.admin_nombres}
                            onChange={(e) => setForm({ ...form, admin_nombres: e.target.value })} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Apellidos</label>
                          <input className="form-control" value={form.admin_apellidos}
                            onChange={(e) => setForm({ ...form, admin_apellidos: e.target.value })} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Email del admin</label>
                          <input className="form-control" type="email" value={form.admin_email}
                            onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Contraseña temporal</label>
                          <input className="form-control" type="password" value={form.admin_password}
                            onChange={(e) => setForm({ ...form, admin_password: e.target.value })} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
