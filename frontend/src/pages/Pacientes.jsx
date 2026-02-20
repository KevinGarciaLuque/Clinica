import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

const FORM_VACIO = {
  nombres: "", apellidos: "", dni: "",
  fecha_nacimiento: "", sexo: "",
  telefono: "", email: "",
  direccion: "", ciudad: "",
  grupo_sanguineo: "",
};

export default function Pacientes() {
  const { user }  = useAuth();
  const [q,      setQ]      = useState("");
  const [lista,  setLista]  = useState([]);
  const [msg,    setMsg]    = useState({ tipo: "", texto: "" });
  const [form,   setForm]   = useState(FORM_VACIO);
  const [showForm, setShowForm] = useState(false);

  const cargar = async () => {
    setMsg({ tipo: "", texto: "" });
    const res = await api.get("/pacientes", { params: { q } });
    setLista(res.data.data || []);
  };

  useEffect(() => { cargar(); }, []);  // eslint-disable-line

  const crear = async (e) => {
    e.preventDefault();
    setMsg({ tipo: "", texto: "" });
    try {
      await api.post("/pacientes", form);
      setForm(FORM_VACIO);
      setShowForm(false);
      await cargar();
      setMsg({ tipo: "success", texto: "Paciente creado correctamente" });
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error creando paciente" });
    }
  };

  const cambioForm = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-0"><i className="bi bi-people-fill me-2 text-primary" />Pacientes</h4>
          <p className="text-muted mb-0" style={{ fontSize: "0.875rem" }}>{lista.length} registros cargados</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => window.open(`/registro?clinica_id=${user?.clinica_id || ""}`, "_blank")}
            title="Portal self-service de registro para el paciente"
          >
            <i className="bi bi-box-arrow-up-right me-1" />Link de registro
          </button>
          <button
            className={`btn btn-sm ${showForm ? "btn-outline-secondary" : "btn-primary"}`}
            onClick={() => setShowForm(f => !f)}
          >
            <i className={`bi ${showForm ? "bi-x-lg" : "bi-person-plus-fill"} me-1`} />
            {showForm ? "Cancelar" : "Nuevo paciente"}
          </button>
        </div>
      </div>

      {msg.texto && (
        <div className={`alert alert-${msg.tipo} d-flex align-items-center gap-2 py-2 mb-3`} role="alert">
          <i className={`bi ${msg.tipo === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`} />
          {msg.texto}
          <button className="btn-close ms-auto btn-sm" onClick={() => setMsg({ tipo: "", texto: "" })} />
        </div>
      )}

      {/* Formulario nuevo paciente colapsable */}
      {showForm && (
        <div className="card border-0 shadow-sm rounded-4 mb-4">
          <div className="card-header bg-white border-0 pt-4 px-4 pb-0">
            <h6 className="fw-bold mb-0"><i className="bi bi-person-plus me-2 text-primary" />Nuevo paciente</h6>
          </div>
          <div className="card-body p-4">
            <form onSubmit={crear}>
              <div className="row g-3">
                <div className="col-sm-6">
                  <label className="form-label fw-semibold small">Nombres <span className="text-danger">*</span></label>
                  <input className="form-control" name="nombres" value={form.nombres} onChange={cambioForm} required />
                </div>
                <div className="col-sm-6">
                  <label className="form-label fw-semibold small">Apellidos <span className="text-danger">*</span></label>
                  <input className="form-control" name="apellidos" value={form.apellidos} onChange={cambioForm} required />
                </div>
                <div className="col-sm-4">
                  <label className="form-label fw-semibold small">DNI</label>
                  <input className="form-control" name="dni" value={form.dni} onChange={cambioForm} />
                </div>
                <div className="col-sm-4">
                  <label className="form-label fw-semibold small">Fecha de nacimiento</label>
                  <input className="form-control" type="date" name="fecha_nacimiento" value={form.fecha_nacimiento} onChange={cambioForm} />
                </div>
                <div className="col-sm-4">
                  <label className="form-label fw-semibold small">Sexo</label>
                  <select className="form-select" name="sexo" value={form.sexo} onChange={cambioForm}>
                    <option value="">â€”</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </select>
                </div>
                <div className="col-sm-4">
                  <label className="form-label fw-semibold small">Grupo sanguÃ­neo</label>
                  <select className="form-select" name="grupo_sanguineo" value={form.grupo_sanguineo} onChange={cambioForm}>
                    <option value="">â€”</option>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="col-sm-4">
                  <label className="form-label fw-semibold small">TelÃ©fono</label>
                  <input className="form-control" name="telefono" value={form.telefono} onChange={cambioForm} />
                </div>
                <div className="col-sm-4">
                  <label className="form-label fw-semibold small">Email</label>
                  <input className="form-control" type="email" name="email" value={form.email} onChange={cambioForm} />
                </div>
                <div className="col-sm-8">
                  <label className="form-label fw-semibold small">DirecciÃ³n</label>
                  <input className="form-control" name="direccion" value={form.direccion} onChange={cambioForm} />
                </div>
                <div className="col-sm-4">
                  <label className="form-label fw-semibold small">Ciudad</label>
                  <input className="form-control" name="ciudad" value={form.ciudad} onChange={cambioForm} />
                </div>
              </div>
              <div className="d-flex justify-content-end mt-3">
                <button className="btn btn-primary">
                  <i className="bi bi-floppy me-1" />Guardar paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BÃºsqueda + tabla */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <div className="d-flex gap-2 mb-3">
            <input
              className="form-control"
              placeholder="Buscar por nombre, DNI, telÃ©fono o email..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && cargar()}
            />
            <button className="btn btn-outline-dark px-3" onClick={cargar}>
              <i className="bi bi-search" />
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Paciente</th>
                  <th>DNI</th>
                  <th>TelÃ©fono</th>
                  <th>Email</th>
                  <th className="text-center">Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                          style={{ width: 34, height: 34, fontSize: "0.78rem" }}
                        >
                          {p.nombres?.[0]}{p.apellidos?.[0]}
                        </div>
                        <div>
                          <div className="fw-semibold">{p.nombres} {p.apellidos}</div>
                          {p.fecha_nacimiento && (
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                              {new Date(p.fecha_nacimiento).toLocaleDateString("es-PE")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-muted small">{p.dni || "â€”"}</td>
                    <td className="text-muted small">{p.telefono || "â€”"}</td>
                    <td className="text-muted small">{p.email || "â€”"}</td>
                    <td className="text-center">
                      {p.activo
                        ? <span className="badge bg-success-subtle text-success border border-success-subtle">Activo</span>
                        : <span className="badge bg-secondary-subtle text-secondary border">Inactivo</span>}
                    </td>
                    <td className="text-nowrap">
                      <Link to={`/pacientes/${p.id}/perfil`} className="btn btn-outline-secondary btn-sm me-1" title="Ver perfil y documentos">
                        <i className="bi bi-person-badge me-1" />Perfil
                      </Link>
                      <Link to={`/historia/${p.id}`} className="btn btn-outline-primary btn-sm me-1" title="Historia ClÃ­nica">
                        <i className="bi bi-journal-medical me-1" />HCE
                      </Link>
                      <Link to={`/consulta?paciente_id=${p.id}`} className="btn btn-outline-success btn-sm" title="Nueva consulta">
                        <i className="bi bi-plus-circle me-1" />Consulta
                      </Link>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-5">
                      <i className="bi bi-people fs-2 d-block mb-2 text-muted opacity-50" />
                      Sin resultados. Usa el buscador o crea un nuevo paciente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
