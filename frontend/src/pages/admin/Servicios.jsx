import { useEffect, useState, useCallback } from "react";
import api from "../../api/api";

const CATEGORIAS = ["consulta", "procedimiento", "examen", "vacuna", "otro"];
const EMPTY = { nombre: "", descripcion: "", categoria: "consulta", precio: "", moneda: "PEN", duracion_min: 30 };

export default function Servicios() {
  const [servicios, setServicios] = useState([]);
  const [form, setForm]           = useState(EMPTY);
  const [editId, setEditId]       = useState(null);
  const [busqueda, setBusqueda]   = useState("");
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState("");
  const [showModal, setShowModal] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.get("/api/servicios?activo=all");
      setServicios(res.data.data);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setForm(EMPTY); setEditId(null); setError(""); setShowModal(true);
  };

  const abrirEditar = (s) => {
    setForm({
      nombre: s.nombre, descripcion: s.descripcion || "",
      categoria: s.categoria || "consulta", precio: s.precio,
      moneda: s.moneda, duracion_min: s.duracion_min,
    });
    setEditId(s.id); setError(""); setShowModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault(); setError("");
    try {
      if (editId) {
        await api.put(`/api/servicios/${editId}`, form);
      } else {
        await api.post("/api/servicios", form);
      }
      setShowModal(false); cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const toggleActivo = async (s) => {
    try {
      await api.put(`/api/servicios/${s.id}`, { activo: s.activo ? 0 : 1 });
      cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const filtrados = servicios.filter((s) =>
    `${s.nombre} ${s.categoria}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const formatPrecio = (p, m) =>
    Number(p).toLocaleString("es-PE", { style: "currency", currency: m || "PEN" });

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Catálogo de Servicios y Tarifas</h4>
        <button className="btn btn-primary btn-sm" onClick={abrirNuevo}>+ Nuevo servicio</button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="mb-3">
        <input className="form-control" placeholder="Buscar servicio..."
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {cargando ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-sm align-middle">
            <thead className="table-dark">
              <tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Duración</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtrados.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="fw-semibold">{s.nombre}</div>
                    {s.descripcion && <div className="text-muted small">{s.descripcion}</div>}
                  </td>
                  <td><span className="badge bg-light text-dark border">{s.categoria}</span></td>
                  <td className="fw-semibold text-success">{formatPrecio(s.precio, s.moneda)}</td>
                  <td>{s.duracion_min} min</td>
                  <td>
                    <span className={`badge ${s.activo ? "bg-success" : "bg-secondary"}`}>
                      {s.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-outline-primary btn-sm me-1" onClick={() => abrirEditar(s)}>Editar</button>
                    <button className={`btn btn-sm ${s.activo ? "btn-outline-warning" : "btn-outline-success"}`}
                      onClick={() => toggleActivo(s)}>
                      {s.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
              {!filtrados.length && (
                <tr><td colSpan={6} className="text-center text-muted py-4">Sin servicios registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editId ? "Editar servicio" : "Nuevo servicio"}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <form onSubmit={guardar}>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2">{error}</div>}
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Nombre *</label>
                      <input className="form-control" value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Descripción</label>
                      <textarea className="form-control" rows={2} value={form.descripcion}
                        onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Categoría</label>
                      <select className="form-select" value={form.categoria}
                        onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                        {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Duración (minutos)</label>
                      <input className="form-control" type="number" min={5} step={5}
                        value={form.duracion_min}
                        onChange={(e) => setForm({ ...form, duracion_min: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Precio *</label>
                      <input className="form-control" type="number" min={0} step={0.01}
                        value={form.precio}
                        onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Moneda</label>
                      <select className="form-select" value={form.moneda}
                        onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                        {["PEN","USD","EUR","COP","MXN"].map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
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
