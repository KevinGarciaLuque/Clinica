import { useCallback, useEffect, useState } from "react";
import api from "../api/api";
import { olvidarSucursales } from "../utils/sucursalActiva";

const VACIO = { nombre: "", direccion: "", telefono: "" };
const ROL = { ADMIN: "Administración", MEDICO: "Médico", PSICOLOGO: "Psicólogo", RECEPCIONISTA: "Recepción", ENFERMERA: "Enfermería" };

/**
 * Configuración → Sucursales: crear y editar los locales de la clínica y elegir
 * en cuáles trabaja cada usuario.
 */
export default function SucursalesConfig() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [nueva, setNueva] = useState(VACIO);
  const [editando, setEditando] = useState(null); // { id, nombre, direccion, telefono }
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get("/sucursales/admin");
      setDatos(r.data.data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudieron cargar las sucursales.");
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const avisar = (texto) => {
    setAviso(texto);
    olvidarSucursales();
    setTimeout(() => setAviso(""), 4000);
  };

  const accion = async (fn, texto) => {
    setOcupado(true);
    setError("");
    try {
      await fn();
      await cargar();
      if (texto) avisar(texto);
      return true;
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo guardar. Intente de nuevo.");
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const crear = async (e) => {
    e.preventDefault();
    if (!nueva.nombre.trim()) return;
    const ok = await accion(() => api.post("/sucursales", nueva), "Sucursal creada. Recargue la página para verla en el selector de arriba.");
    if (ok) setNueva(VACIO);
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    const { id, ...campos } = editando;
    const ok = await accion(() => api.put(`/sucursales/${id}`, campos), "Cambios guardados.");
    if (ok) setEditando(null);
  };

  const cambiarActiva = (s) => accion(
    () => api.put(`/sucursales/${s.id}`, { activo: !s.activo }),
    s.activo ? "Sucursal desactivada. Sus citas y cobros anteriores se conservan." : "Sucursal activada."
  );

  const cambiarUsuario = (u, sucursalId) => {
    const set = new Set(u.sucursales);
    if (set.has(sucursalId)) set.delete(sucursalId); else set.add(sucursalId);
    accion(() => api.put(`/sucursales/usuario/${u.id}`, { sucursales: [...set] }));
  };

  if (error && !datos) return <div className="alert alert-danger mb-0">{error}</div>;
  if (!datos) return <div className="text-center py-4"><div className="spinner-border" /></div>;

  const activas = datos.sucursales.filter((s) => s.activo);

  return (
    <div>
      <div className="d-flex gap-2 align-items-start mb-3 p-3" style={{ background: "#f5f9ff", border: "1px solid #dbe6ff", borderRadius: 12 }}>
        <i className="bi bi-shop fs-4" style={{ color: "#2a78d6" }} />
        <div className="small" style={{ color: "#334155" }}>
          <strong>¿Su clínica tiene varios locales?</strong> Agregue cada sucursal aquí. Con dos o más, arriba aparece
          un selector para trabajar en una sucursal o ver todas. La agenda, la sala de espera, la caja, la facturación
          y las finanzas se separan por sucursal. <strong>Los pacientes y sus expedientes se comparten</strong> entre todas.
          Todo lo registrado antes queda en la <strong>sede principal</strong>.
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {aviso && <div className="alert alert-success py-2 small"><i className="bi bi-check-circle-fill me-1" />{aviso}</div>}

      <h6 className="fw-bold mb-2">Sucursales</h6>
      <div className="row g-2 mb-3">
        {datos.sucursales.map((s) => (
          <div className="col-12 col-md-6" key={s.id}>
            <div className="h-100 p-3" style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: s.activo ? "#fff" : "#f8fafc", opacity: s.activo ? 1 : 0.75 }}>
              {editando?.id === s.id ? (
                <form onSubmit={guardarEdicion}>
                  <input className="form-control form-control-sm mb-2" value={editando.nombre} maxLength={120} required
                    onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} placeholder="Nombre" />
                  <input className="form-control form-control-sm mb-2" value={editando.direccion || ""} maxLength={255}
                    onChange={(e) => setEditando({ ...editando, direccion: e.target.value })} placeholder="Dirección" />
                  <input className="form-control form-control-sm mb-2" value={editando.telefono || ""} maxLength={40}
                    onChange={(e) => setEditando({ ...editando, telefono: e.target.value })} placeholder="Teléfono" />
                  <div className="d-flex gap-2">
                    <button className="btn btn-primary btn-sm" disabled={ocupado}>Guardar</button>
                    <button type="button" className="btn btn-light btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="d-flex align-items-start gap-2">
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="fw-semibold text-break">
                        {s.nombre}{" "}
                        {!!s.es_principal && <span className="badge bg-primary-subtle text-primary-emphasis ms-1">Principal</span>}
                        {!s.activo && <span className="badge bg-secondary ms-1">Inactiva</span>}
                      </div>
                      {s.direccion && <div className="small text-muted text-break"><i className="bi bi-geo-alt me-1" />{s.direccion}</div>}
                      {s.telefono && <div className="small text-muted"><i className="bi bi-telephone me-1" />{s.telefono}</div>}
                      <div className="small text-muted mt-1"><i className="bi bi-people me-1" />{s.usuarios} usuario(s) asignado(s)</div>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    <button className="btn btn-outline-secondary btn-sm" disabled={ocupado}
                      onClick={() => setEditando({ id: s.id, nombre: s.nombre, direccion: s.direccion, telefono: s.telefono })}>
                      <i className="bi bi-pencil me-1" />Editar
                    </button>
                    {!s.es_principal && (
                      <button className={`btn btn-sm ${s.activo ? "btn-outline-danger" : "btn-outline-success"}`} disabled={ocupado} onClick={() => cambiarActiva(s)}>
                        {s.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={crear} className="p-3 mb-4" style={{ border: "1px dashed #93c5fd", borderRadius: 12 }}>
        <div className="fw-semibold mb-2"><i className="bi bi-plus-circle me-1" />Agregar sucursal</div>
        <div className="row g-2">
          <div className="col-12 col-md-4">
            <input className="form-control form-control-sm" placeholder="Nombre (ej. Sucursal Centro) *" maxLength={120} required
              value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
          </div>
          <div className="col-12 col-md-4">
            <input className="form-control form-control-sm" placeholder="Dirección" maxLength={255}
              value={nueva.direccion} onChange={(e) => setNueva({ ...nueva, direccion: e.target.value })} />
          </div>
          <div className="col-8 col-md-2">
            <input className="form-control form-control-sm" placeholder="Teléfono" maxLength={40}
              value={nueva.telefono} onChange={(e) => setNueva({ ...nueva, telefono: e.target.value })} />
          </div>
          <div className="col-4 col-md-2 d-grid">
            <button className="btn btn-primary btn-sm" disabled={ocupado || !nueva.nombre.trim()}>Agregar</button>
          </div>
        </div>
      </form>

      {activas.length >= 2 && (
        <>
          <h6 className="fw-bold mb-1">¿En qué sucursal trabaja cada persona?</h6>
          <p className="small text-muted mb-2">
            Marque las sucursales de cada persona. Así solo verá la agenda, la caja y los cobros de esas sucursales.
            Si no marca ninguna, puede trabajar en todas. La administración siempre ve todas.
          </p>
          <div className="d-flex flex-column gap-2">
            {datos.usuarios.map((u) => (
              <div key={u.id} className="p-2 px-3" style={{ border: "1px solid #e2e8f0", borderRadius: 10 }}>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="me-auto" style={{ minWidth: 0 }}>
                    <span className="fw-semibold">{u.nombres} {u.apellidos}</span>{" "}
                    <span className="small text-muted">· {ROL[u.tipo] || u.tipo}</span>
                  </div>
                  {u.tipo === "ADMIN" ? (
                    <span className="small text-muted">Ve todas las sucursales</span>
                  ) : (
                    <div className="d-flex flex-wrap gap-3">
                      {activas.map((s) => (
                        <label key={s.id} className="form-check-label small d-flex align-items-center gap-1" style={{ cursor: "pointer" }}>
                          <input type="checkbox" className="form-check-input m-0" disabled={ocupado}
                            checked={u.sucursales.includes(s.id)} onChange={() => cambiarUsuario(u, s.id)} />
                          {s.nombre}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {u.tipo !== "ADMIN" && !u.sucursales.some((id) => activas.some((s) => s.id === id)) && (
                  <div className="small text-success mt-1"><i className="bi bi-check2-all me-1" />Trabaja en todas las sucursales</div>
                )}
              </div>
            ))}
          </div>
          <p className="small text-muted mt-3 mb-0">
            <i className="bi bi-clock me-1" />Para indicar qué días atiende cada médico en cada sucursal, vaya a
            <strong> Horarios médicos</strong> y elija la sucursal en cada bloque.
          </p>
        </>
      )}
    </div>
  );
}
