import { useEffect, useState, useCallback } from "react";
import api from "../../api/api";

const TIPOS = ["ADMIN", "MEDICO", "ENFERMERA", "RECEPCIONISTA"];
const EMPTY = {
  nombres: "", apellidos: "", email: "", password: "",
  tipo: "RECEPCIONISTA", especialidad_id: "", telefono: "",
  numero_colegiatura: "", activo: 1,
};

export default function Usuarios() {
  const [usuarios, setUsuarios]       = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [form, setForm]               = useState(EMPTY);
  const [editId, setEditId]           = useState(null);
  const [busqueda, setBusqueda]       = useState("");
  const [cargando, setCargando]       = useState(false);
  const [error, setError]             = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [resetPass, setResetPass]     = useState({ id: null, pass: "" });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [uRes, eRes] = await Promise.all([
        api.get("/api/usuarios"),
        api.get("/api/usuarios/especialidades"),
      ]);
      setUsuarios(uRes.data.data);
      setEspecialidades(eRes.data.data);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setForm(EMPTY);
    setEditId(null);
    setError("");
    setShowModal(true);
  };

  const abrirEditar = (u) => {
    setForm({
      nombres: u.nombres, apellidos: u.apellidos, email: u.email,
      password: "", tipo: u.tipo,
      especialidad_id: u.especialidad_id || "",
      telefono: u.telefono || "", numero_colegiatura: u.numero_colegiatura || "",
      activo: u.activo,
    });
    setEditId(u.id);
    setError("");
    setShowModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.especialidad_id) delete payload.especialidad_id;

      if (editId) {
        await api.put(`/api/usuarios/${editId}`, payload);
      } else {
        await api.post("/api/usuarios", payload);
      }
      setShowModal(false);
      cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const toggleActivo = async (u) => {
    try {
      await api.put(`/api/usuarios/${u.id}`, { activo: u.activo ? 0 : 1 });
      cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const guardarResetPass = async () => {
    setError("");
    try {
      await api.post(`/api/usuarios/${resetPass.id}/reset-password`, {
        nueva_password: resetPass.pass,
      });
      setResetPass({ id: null, pass: "" });
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const filtrados = usuarios.filter((u) =>
    `${u.nombres} ${u.apellidos} ${u.email}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const tipoBadge = (tipo) => {
    const map = { SUPER_ADMIN: "danger", ADMIN: "warning", MEDICO: "primary", ENFERMERA: "info", RECEPCIONISTA: "secondary" };
    return map[tipo] || "secondary";
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Gestión de Usuarios</h4>
        <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>
          + Nuevo usuario
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="mb-3">
        <input
          className="form-control"
          placeholder="Buscar por nombre o email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {cargando ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-sm align-middle">
            <thead className="table-dark">
              <tr>
                <th>Nombre</th><th>Email</th><th>Tipo</th>
                <th>Especialidad</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.id}>
                  <td>{u.apellidos}, {u.nombres}</td>
                  <td className="text-muted small">{u.email}</td>
                  <td><span className={`badge bg-${tipoBadge(u.tipo)}`}>{u.tipo}</span></td>
                  <td className="small">{u.especialidad || "—"}</td>
                  <td>
                    <span className={`badge ${u.activo ? "bg-success" : "bg-secondary"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-outline-primary btn-sm me-1" onClick={() => abrirEditar(u)}>Editar</button>
                    <button className={`btn btn-sm me-1 ${u.activo ? "btn-outline-warning" : "btn-outline-success"}`}
                      onClick={() => toggleActivo(u)}>
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button className="btn btn-outline-secondary btn-sm"
                      onClick={() => setResetPass({ id: u.id, pass: "" })}>
                      Contraseña
                    </button>
                  </td>
                </tr>
              ))}
              {!filtrados.length && (
                <tr><td colSpan={6} className="text-center text-muted py-4">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal nuevo/editar ── */}
      {showModal && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editId ? "Editar usuario" : "Nuevo usuario"}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2">{error}</div>}
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Nombres *</label>
                      <input className="form-control" value={form.nombres}
                        onChange={(e) => setForm({ ...form, nombres: e.target.value })} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Apellidos *</label>
                      <input className="form-control" value={form.apellidos}
                        onChange={(e) => setForm({ ...form, apellidos: e.target.value })} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email *</label>
                      <input className="form-control" type="email" value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    {!editId && (
                      <div className="col-md-6">
                        <label className="form-label">Contraseña *</label>
                        <input className="form-control" type="password" value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editId} />
                      </div>
                    )}
                    <div className="col-md-6">
                      <label className="form-label">Tipo *</label>
                      <select className="form-select" value={form.tipo}
                        onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                        {TIPOS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    {form.tipo === "MEDICO" && (
                      <div className="col-md-6">
                        <label className="form-label">Especialidad</label>
                        <select className="form-select" value={form.especialidad_id}
                          onChange={(e) => setForm({ ...form, especialidad_id: e.target.value })}>
                          <option value="">— Sin especialidad —</option>
                          {especialidades.map((e) => (
                            <option key={e.id} value={e.id}>{e.nombre}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="col-md-6">
                      <label className="form-label">Teléfono</label>
                      <input className="form-control" value={form.telefono}
                        onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                    </div>
                    {form.tipo === "MEDICO" && (
                      <div className="col-md-6">
                        <label className="form-label">Nº Colegiatura</label>
                        <input className="form-control" value={form.numero_colegiatura}
                          onChange={(e) => setForm({ ...form, numero_colegiatura: e.target.value })} />
                      </div>
                    )}
                    {editId && (
                      <div className="col-md-6 d-flex align-items-end">
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" id="activo"
                            checked={!!form.activo}
                            onChange={(e) => setForm({ ...form, activo: e.target.checked ? 1 : 0 })} />
                          <label className="form-check-label" htmlFor="activo">Activo</label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal reset contraseña ── */}
      {resetPass.id && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Resetear contraseña</h5>
                <button className="btn-close" onClick={() => setResetPass({ id: null, pass: "" })} />
              </div>
              <div className="modal-body">
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <label className="form-label">Nueva contraseña (mín. 8 caracteres)</label>
                <input className="form-control" type="password"
                  value={resetPass.pass}
                  onChange={(e) => setResetPass({ ...resetPass, pass: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setResetPass({ id: null, pass: "" })}>
                  Cancelar
                </button>
                <button className="btn btn-warning" onClick={guardarResetPass}
                  disabled={resetPass.pass.length < 8}>
                  Cambiar contraseña
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
