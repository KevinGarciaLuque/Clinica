/**
 * Perfil completo de un paciente — edición + documentos
 * URL: /pacientes/:id/perfil
 */
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/api";

const TIPOS_DOC = [
  { value: "dni_frente",    label: "DNI frente"         },
  { value: "dni_reverso",   label: "DNI reverso"        },
  { value: "seguro",        label: "Tarjeta de seguro"  },
  { value: "consentimiento",label: "Consentimiento"     },
  { value: "laboratorio",   label: "Resultado laboratorio" },
  { value: "imagen",        label: "Imagen médica"      },
  { value: "otro",          label: "Otro"               },
];

const TIPO_ICON = {
  dni_frente: "bi-person-vcard",
  dni_reverso: "bi-person-vcard-fill",
  seguro: "bi-shield-plus",
  consentimiento: "bi-file-earmark-check",
  laboratorio: "bi-file-earmark-medical",
  imagen: "bi-file-image",
  otro: "bi-file-earmark",
};

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ════════════════════════════════════════════════════════
export default function PerfilPaciente() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const fileRef    = useRef();

  const [paciente,  setPaciente]  = useState(null);
  const [docs,      setDocs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg,       setMsg]       = useState({ tipo: "", texto: "" });

  // Edición
  const [editando,  setEditando]  = useState(false);
  const [form,      setForm]      = useState({});

  // Upload
  const [tipoDoc,   setTipoDoc]   = useState("otro");
  const [archivo,   setArchivo]   = useState(null);
  const [subiendo,  setSubiendo]  = useState(false);

  // ── Carga inicial ──────────────────────────────────
  useEffect(() => { cargarTodo(); }, [id]);

  const cargarTodo = async () => {
    setLoading(true);
    try {
      const [rPac, rDocs] = await Promise.all([
        api.get(`/pacientes/${id}`),
        api.get(`/pacientes/${id}/documentos`),
      ]);
      setPaciente(rPac.data.data);
      setForm(rPac.data.data);
      setDocs(rDocs.data.data || []);
    } catch {
      setMsg({ tipo: "danger", texto: "Error cargando datos del paciente" });
    } finally {
      setLoading(false);
    }
  };

  // ── Guardar edición ────────────────────────────────
  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      await api.put(`/pacientes/${id}`, form);
      setMsg({ tipo: "success", texto: "Datos actualizados correctamente" });
      setEditando(false);
      await cargarTodo();
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al guardar" });
    } finally {
      setGuardando(false);
    }
  };

  // ── Subir documento ────────────────────────────────
  const subirDoc = async () => {
    if (!archivo) return;
    setSubiendo(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("tipo", tipoDoc);
      await api.post(`/pacientes/${id}/documentos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg({ tipo: "success", texto: "Documento subido correctamente" });
      const r = await api.get(`/pacientes/${id}/documentos`);
      setDocs(r.data.data || []);
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al subir documento" });
    } finally {
      setSubiendo(false);
    }
  };

  // ── Eliminar documento ─────────────────────────────
  const eliminarDoc = async (docId) => {
    if (!window.confirm("¿Eliminar este documento?")) return;
    try {
      await api.delete(`/pacientes/${id}/documentos/${docId}`);
      setDocs(d => d.filter(doc => doc.id !== docId));
    } catch {
      setMsg({ tipo: "danger", texto: "Error al eliminar documento" });
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="alert alert-danger m-4">Paciente no encontrado.
        <Link to="/pacientes" className="ms-2">← Volver</Link>
      </div>
    );
  }

  const cambioForm = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div className="container-fluid py-2" style={{ maxWidth: 900 }}>
      {/* Breadcrumb */}
      <nav className="mb-3" aria-label="breadcrumb">
        <ol className="breadcrumb mb-0" style={{ fontSize: "0.85rem" }}>
          <li className="breadcrumb-item"><Link to="/pacientes">Pacientes</Link></li>
          <li className="breadcrumb-item active">{paciente.nombres} {paciente.apellidos}</li>
        </ol>
      </nav>

      {msg.texto && (
        <div className={`alert alert-${msg.tipo} d-flex align-items-center gap-2 py-2 mb-3`} role="alert">
          <i className={`bi ${msg.tipo === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`} />
          {msg.texto}
          <button className="btn-close ms-auto" onClick={() => setMsg({ tipo: "", texto: "" })} />
        </div>
      )}

      {/* Header del perfil */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4">
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
              style={{ width: 60, height: 60, fontSize: "1.4rem" }}
            >
              {paciente.nombres?.[0]}{paciente.apellidos?.[0]}
            </div>
            <div className="flex-grow-1">
              <h5 className="fw-bold mb-0">{paciente.nombres} {paciente.apellidos}</h5>
              <div className="d-flex flex-wrap gap-2 mt-1">
                {paciente.dni && <span className="badge bg-light text-dark border"><i className="bi bi-credit-card me-1" />{paciente.dni}</span>}
                {paciente.email && (
                  <span className={`badge ${paciente.email_verificado ? "bg-success" : "bg-warning text-dark"}`}>
                    <i className={`bi ${paciente.email_verificado ? "bi-patch-check-fill" : "bi-exclamation-triangle-fill"} me-1`} />
                    {paciente.email_verificado ? "Email verificado" : "Email sin verificar"}
                  </span>
                )}
                {paciente.grupo_sanguineo && (
                  <span className="badge bg-danger"><i className="bi bi-droplet-fill me-1" />{paciente.grupo_sanguineo}</span>
                )}
              </div>
            </div>
            <div className="d-flex gap-2">
              <Link to={`/historia/${id}`} className="btn btn-outline-primary btn-sm">
                <i className="bi bi-journal-medical me-1" />HCE
              </Link>
              <Link to={`/consulta?paciente_id=${id}`} className="btn btn-outline-success btn-sm">
                <i className="bi bi-plus-circle me-1" />Consulta
              </Link>
              <button
                className={`btn btn-sm ${editando ? "btn-outline-secondary" : "btn-outline-dark"}`}
                onClick={() => { setEditando(e => !e); setForm(paciente); }}
              >
                <i className={`bi ${editando ? "bi-x-lg" : "bi-pencil"} me-1`} />
                {editando ? "Cancelar" : "Editar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* ── Columna izquierda: datos ─────────────── */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-white border-0 pt-4 pb-0 px-4">
              <h6 className="fw-bold mb-0"><i className="bi bi-person-lines-fill me-2 text-primary" />Datos personales</h6>
            </div>
            <div className="card-body p-4">
              {editando ? (
                <form onSubmit={guardar}>
                  <div className="row g-2">
                    {[
                      { name: "nombres",     label: "Nombres",     req: true },
                      { name: "apellidos",   label: "Apellidos",   req: true },
                      { name: "dni",         label: "DNI" },
                      { name: "telefono",    label: "Teléfono" },
                      { name: "email",       label: "Email",       type: "email" },
                      { name: "fecha_nacimiento", label: "F. Nacimiento", type: "date" },
                    ].map(f => (
                      <div key={f.name} className="col-sm-6">
                        <label className="form-label fw-semibold" style={{ fontSize: "0.8rem" }}>{f.label}</label>
                        <input
                          className="form-control form-control-sm"
                          type={f.type || "text"}
                          name={f.name}
                          value={form[f.name] || ""}
                          onChange={cambioForm}
                          required={!!f.req}
                        />
                      </div>
                    ))}
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold" style={{ fontSize: "0.8rem" }}>Sexo</label>
                      <select className="form-select form-select-sm" name="sexo" value={form.sexo || ""} onChange={cambioForm}>
                        <option value="">—</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="O">Otro</option>
                      </select>
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold" style={{ fontSize: "0.8rem" }}>Grupo sanguíneo</label>
                      <select className="form-select form-select-sm" name="grupo_sanguineo" value={form.grupo_sanguineo || ""} onChange={cambioForm}>
                        <option value="">—</option>
                        {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold" style={{ fontSize: "0.8rem" }}>Dirección</label>
                      <input className="form-control form-control-sm" name="direccion" value={form.direccion || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold" style={{ fontSize: "0.8rem" }}>Ciudad</label>
                      <input className="form-control form-control-sm" name="ciudad" value={form.ciudad || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label fw-semibold" style={{ fontSize: "0.8rem" }}>País</label>
                      <input className="form-control form-control-sm" name="pais" value={form.pais || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold" style={{ fontSize: "0.8rem" }}>Notas internas</label>
                      <textarea className="form-control form-control-sm" name="notas" rows={3} value={form.notas || ""} onChange={cambioForm} />
                    </div>
                  </div>
                  <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-primary btn-sm" disabled={guardando}>
                      {guardando ? <><span className="spinner-border spinner-border-sm me-1" />Guardando</> : <><i className="bi bi-floppy me-1" />Guardar</>}
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="row mb-0" style={{ fontSize: "0.875rem" }}>
                  {[
                    ["Teléfono",      paciente.telefono],
                    ["Email",         paciente.email],
                    ["F. nacimiento", paciente.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toLocaleDateString("es-PE") : null],
                    ["Sexo",          paciente.sexo === "M" ? "Masculino" : paciente.sexo === "F" ? "Femenino" : paciente.sexo],
                    ["Dirección",     paciente.direccion],
                    ["Ciudad",        paciente.ciudad],
                    ["País",          paciente.pais],
                  ].map(([k, v]) => v ? (
                    <div className="col-12 d-flex gap-2 mb-1" key={k}>
                      <dt className="text-muted fw-normal mb-0" style={{ minWidth: 110 }}>{k}:</dt>
                      <dd className="mb-0 fw-semibold text-dark">{v}</dd>
                    </div>
                  ) : null)}
                  {paciente.notas && (
                    <div className="col-12 mt-2">
                      <span className="text-muted" style={{ fontSize: "0.78rem" }}>📝 Notas:</span>
                      <p className="mb-0 text-dark" style={{ fontSize: "0.85rem" }}>{paciente.notas}</p>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </div>
        </div>

        {/* ── Columna derecha: documentos ──────────── */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-white border-0 pt-4 pb-0 px-4">
              <h6 className="fw-bold mb-0"><i className="bi bi-paperclip me-2 text-primary" />Documentos adjuntos</h6>
            </div>
            <div className="card-body p-4">
              {/* Upload */}
              <div className="bg-light rounded-3 p-3 mb-3">
                <div className="fw-semibold small mb-2">Subir nuevo documento</div>
                <div className="d-flex gap-2 flex-wrap">
                  <select className="form-select form-select-sm" style={{ maxWidth: 180 }}
                    value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
                    {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="form-control form-control-sm"
                    style={{ maxWidth: 220 }}
                    onChange={e => setArchivo(e.target.files[0] || null)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={subirDoc}
                    disabled={!archivo || subiendo}
                  >
                    {subiendo
                      ? <span className="spinner-border spinner-border-sm" />
                      : <><i className="bi bi-cloud-upload me-1" />Subir</>}
                  </button>
                </div>
                {archivo && (
                  <div className="text-muted mt-1" style={{ fontSize: "0.75rem" }}>
                    <i className="bi bi-file-earmark me-1" />{archivo.name} ({formatBytes(archivo.size)})
                  </div>
                )}
              </div>

              {/* Lista */}
              {docs.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-folder2-open fs-2 d-block mb-2" />
                  Sin documentos adjuntos
                </div>
              ) : (
                <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                  {docs.map(doc => (
                    <li key={doc.id} className="border rounded-3 p-2 d-flex align-items-center gap-2">
                      <i className={`bi ${TIPO_ICON[doc.tipo] || "bi-file-earmark"} fs-4 text-primary`} style={{ width: 28 }} />
                      <div className="flex-grow-1 overflow-hidden">
                        <div className="fw-semibold text-truncate" style={{ fontSize: "0.82rem" }} title={doc.nombre_original}>
                          {doc.nombre_original}
                        </div>
                        <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                          {TIPOS_DOC.find(t => t.value === doc.tipo)?.label} · {formatBytes(doc.tamano_bytes)}
                        </div>
                      </div>
                      <div className="d-flex gap-1">
                        <a
                          href={`${(import.meta.env.VITE_API_URL || "http://localhost:5000")}/api/pacientes/${id}/documentos/${doc.id}/view`}
                          target="_blank" rel="noreferrer"
                          className="btn btn-outline-secondary btn-sm"
                          title="Ver / Descargar"
                        >
                          <i className="bi bi-eye" />
                        </a>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => eliminarDoc(doc.id)}
                          title="Eliminar"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
