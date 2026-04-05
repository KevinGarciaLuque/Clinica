/**
 * EXPEDIENTE COMPLETO DEL PACIENTE - Con pestañas profesionales
 * 1. Datos Generales
 * 2. Historial Clínico  
 * 3. Exámenes / Documentos
 * 4. Curvas de Crecimiento OMS
 * 5. Eliminar Paciente
 */
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import CurvaCrecimiento from "../components/CurvaCrecimiento";
import AntecedentesClinico from "../components/AntecedentesClinico";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000");

const TIPOS_DOC = [
  { value: "laboratorio",   label: "Laboratorio", icon: "bi-file-earmark-medical" },
  { value: "imagen",        label: "Imagen médica", icon: "bi-file-image" },
  { value: "radiografia",   label: "Radiografía", icon: "bi-file-earmark-ruled" },
  { value: "receta",        label: "Receta", icon: "bi-prescription2" },
  { value: "consentimiento",label: "Consentimiento", icon: "bi-file-earmark-check" },
  { value: "otro",          label: "Otro", icon: "bi-file-earmark" },
];

export default function PerfilPaciente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef = useRef();
  const fotoInputRef = useRef();
  const fotoCameraRef = useRef();

  // Estados principales
  const [paciente, setPaciente] = useState(null);
  const [historias, setHistorias] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  
  // Pestaña activa
  const [tab, setTab] = useState(searchParams.get("tab") || "datos");
  
  // Edición datos generales
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [form, setForm] = useState({});
  
  // Upload documentos
  const [tipoDoc, setTipoDoc] = useState("laboratorio");
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  
  // Foto perfil
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  
  // Eliminación con doble confirmación
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);

  // Sub-pestaña dentro de Datos Generales
  const [subTabDatos, setSubTabDatos] = useState("paciente");

  // ══════════════════════════════════════════════════════════
  // CARGA INICIAL
  // ══════════════════════════════════════════════════════════
  useEffect(() => { cargarTodo(); }, [id]);

  const cargarTodo = async () => {
    setLoading(true);
    setMsg({ tipo: "", texto: "" });
    try {
      // Cargar paciente
      const resPac = await api.get(`/pacientes/${id}`);
      const dataPac = resPac.data.data;
      
      // Formatear fecha para el input tipo date (YYYY-MM-DD)
      if (dataPac.fecha_nacimiento) {
        dataPac.fecha_nacimiento = dataPac.fecha_nacimiento.split('T')[0];
      }
      
      setPaciente(dataPac);
      setForm(dataPac);
      
      // Cargar historias clínicas
      try {
        const resHist = await api.get(`/historias?paciente_id=${id}`);
        setHistorias(resHist.data.data || []);
      } catch (e) {
        console.log("No hay historias clínicas");
        setHistorias([]);
      }
      
      // Cargar documentos
      try {
        const resDocs = await api.get(`/pacientes/${id}/documentos`);
        setDocumentos(resDocs.data.data || []);
      } catch (e) {
        console.log("No hay documentos");
        setDocumentos([]);
      }
      
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error cargando paciente" });
    } finally {
      setLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  // PESTAÑA 1: DATOS GENERALES
  // ══════════════════════════════════════════════════════════
  const guardarDatos = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      await api.put(`/pacientes/${id}`, form);
      
      // Si hay foto nueva, subirla
      if (fotoFile) {
        const fd = new FormData();
        fd.append("foto", fotoFile);
        await api.post(`/pacientes/${id}/foto`, fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        setFotoFile(null);
        setFotoPreview(null);
      }
      
      setMsg({ tipo: "success", texto: "Datos actualizados correctamente" });
      setEditandoDatos(false);
      await cargarTodo();
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al guardar" });
    } finally {
      setGuardando(false);
    }
  };

  const cambioForm = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  // ══════════════════════════════════════════════════════════
  // PESTAÑA 3: SUBIR EXÁMENES / DOCUMENTOS
  // ══════════════════════════════════════════════════════════
  const subirDocumento = async () => {
    if (!archivo) return;
    setSubiendo(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("tipo", tipoDoc);
      await api.post(`/pacientes/${id}/documentos`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg({ tipo: "success", texto: "Documento subido correctamente" });
      await cargarTodo();
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al subir" });
    } finally {
      setSubiendo(false);
    }
  };

  const eliminarDocumento = async (docId) => {
    if (!window.confirm("¿Eliminar este documento?")) return;
    try {
      await api.delete(`/pacientes/${id}/documentos/${docId}`);
      setMsg({ tipo: "success", texto: "Documento eliminado" });
      setDocumentos(d => d.filter(doc => doc.id !== docId));
    } catch {
      setMsg({ tipo: "danger", texto: "Error al eliminar documento" });
    }
  };

  // ══════════════════════════════════════════════════════════
  // PESTAÑA 4: ELIMINAR PACIENTE (Doble confirmación)
  // ══════════════════════════════════════════════════════════
  const eliminarPaciente = async () => {
    const nombreCompleto = `${paciente.nombres} ${paciente.apellidos}`;
    if (textoConfirmacion !== nombreCompleto) {
      setMsg({ tipo: "danger", texto: "El nombre no coincide. Por favor verifica." });
      return;
    }
    
    setEliminando(true);
    try {
      await api.delete(`/pacientes/${id}`);
      setMsg({ tipo: "success", texto: "Paciente eliminado correctamente" });
      setTimeout(() => navigate("/pacientes"), 1500);
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al eliminar" });
      setEliminando(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 400 }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="alert alert-danger m-4">
        Paciente no encontrado. <Link to="/pacientes" className="alert-link">← Volver</Link>
      </div>
    );
  }

  const nombreCompleto = `${paciente.nombres} ${paciente.apellidos}`;

  return (
    <div className="container-fluid py-3" style={{ maxWidth: 1200 }}>
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item"><Link to="/pacientes">Pacientes</Link></li>
          <li className="breadcrumb-item active">{nombreCompleto}</li>
        </ol>
      </nav>

      {/* Mensaje */}
      {msg.texto && (
        <div className={`alert alert-${msg.tipo} alert-dismissible fade show`} role="alert">
          <i className={`bi ${msg.tipo === "success" ? "bi-check-circle" : "bi-exclamation-triangle"} me-2`} />
          {msg.texto}
          <button type="button" className="btn-close" onClick={() => setMsg({ tipo: "", texto: "" })} />
        </div>
      )}

      {/* Header del paciente */}
      <div className="card shadow-sm mb-4">
        <div className="card-body p-4">
          <div className="d-flex align-items-center gap-3">
            {/* Avatar */}
            <div style={{ width: 80, height: 80 }}>
              {paciente.foto_perfil ? (
                <img
                  src={`${API_BASE}/uploads/${paciente.foto_perfil}`}
                  alt="Foto"
                  className="rounded-circle border border-3 border-primary"
                  style={{ width: 80, height: 80, objectFit: "cover" }}
                />
              ) : (
                <div
                  className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold"
                  style={{ width: 80, height: 80, fontSize: "1.8rem" }}
                >
                  {paciente.nombres?.[0]}{paciente.apellidos?.[0]}
                </div>
              )}
            </div>

            {/* Info principal */}
            <div className="flex-grow-1">
              <h4 className="mb-1 fw-bold">{nombreCompleto}</h4>
              <div className="d-flex flex-wrap gap-2">
                {paciente.dni && (
                  <span className="badge bg-light text-dark border">
                    <i className="bi bi-credit-card me-1" />{paciente.dni}
                  </span>
                )}
                {paciente.edad && (
                  <span className="badge bg-light text-dark border">
                    <i className="bi bi-calendar3 me-1" />{paciente.edad} años
                  </span>
                )}
                {paciente.grupo_sanguineo && (
                  <span className="badge bg-danger">
                    <i className="bi bi-droplet-fill me-1" />{paciente.grupo_sanguineo}
                  </span>
                )}
                {paciente.telefono && (
                  <span className="badge bg-light text-dark border">
                    <i className="bi bi-telephone me-1" />{paciente.telefono}
                  </span>
                )}
              </div>
            </div>

            {/* Botones rápidos */}
            <div className="d-flex gap-2">
              <Link to={`/consulta?paciente_id=${id}`} className="btn btn-success">
                <i className="bi bi-plus-circle me-1" />Nueva Consulta
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* PESTAÑAS */}
      {/* ══════════════════════════════════════════════════════ */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${tab === "datos" ? "active" : ""}`}
            onClick={() => setTab("datos")}
          >
            <i className="bi bi-person-lines-fill me-2" />Datos Generales
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${tab === "historial" ? "active" : ""}`}
            onClick={() => setTab("historial")}
          >
            <i className="bi bi-journal-medical me-2" />Historial Clínico
            {historias.length > 0 && (
              <span className="badge bg-primary ms-2">{historias.length}</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${tab === "examenes" ? "active" : ""}`}
            onClick={() => setTab("examenes")}
          >
            <i className="bi bi-files me-2" />Exámenes
            {documentos.length > 0 && (
              <span className="badge bg-info ms-2">{documentos.length}</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${tab === "crecimiento" ? "active" : ""}`}
            onClick={() => setTab("crecimiento")}
          >
            <i className="bi bi-graph-up-arrow me-2" />Curvas de Crecimiento
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link text-danger ${tab === "eliminar" ? "active" : ""}`}
            onClick={() => setTab("eliminar")}
          >
            <i className="bi bi-trash me-2" />Eliminar Paciente
          </button>
        </li>
      </ul>

      {/* ══════════════════════════════════════════════════════ */}
      {/* CONTENIDO DE LAS PESTAÑAS */}
      {/* ══════════════════════════════════════════════════════ */}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 1: DATOS GENERALES */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "datos" && (
        <div className="card shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <i className="bi bi-person-badge me-2 text-primary" />Expediente del Paciente
            </h5>
            <button
              className={`btn btn-sm ${editandoDatos ? "btn-outline-secondary" : "btn-outline-primary"}`}
              onClick={() => {
                setEditandoDatos(!editandoDatos);
                if (!editandoDatos) setForm(paciente);
              }}
            >
              <i className={`bi ${editandoDatos ? "bi-x-lg" : "bi-pencil"} me-1`} />
              {editandoDatos ? "Cancelar" : "Editar"}
            </button>
          </div>

          {/* Sub-pestañas */}
          <div className="border-bottom bg-light">
            <div className="d-flex" style={{ overflowX: "auto" }}>
              {[
                { key: "paciente",    label: "Datos Personales",     icon: "bi-person-fill" },
                { key: "responsable", label: "Responsable / Tutor",  icon: "bi-people-fill" },
                { key: "seguro",      label: "Seguro Médico",        icon: "bi-shield-plus" },
                { key: "emergencia",  label: "Contacto Emergencia",  icon: "bi-telephone-forward" },
                { key: "notas",       label: "Notas",                icon: "bi-sticky" },
              ].map(st => (
                <button
                  key={st.key}
                  className="btn rounded-0 px-3 py-2 border-0"
                  onClick={() => setSubTabDatos(st.key)}
                  style={{
                    fontWeight: subTabDatos === st.key ? 600 : 400,
                    color: subTabDatos === st.key ? "#214a87" : "#6c757d",
                    borderBottom: subTabDatos === st.key ? "3px solid #214a87" : "3px solid transparent",
                    fontSize: "0.85rem",
                    whiteSpace: "nowrap",
                    background: "transparent",
                  }}
                >
                  <i className={`bi ${st.icon} me-1`} />{st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card-body p-4">
            {editandoDatos ? (
              <form onSubmit={guardarDatos}>

                {/* ── Sub-tab: Datos Personales ── */}
                {subTabDatos === "paciente" && (
                  <div className="row g-3">
                    {/* Foto de perfil */}
                    <div className="col-12">
                      <label className="form-label fw-semibold">Foto de perfil</label>
                      <div className="d-flex align-items-center gap-3">
                        {(fotoPreview || paciente.foto_perfil) && (
                          <img
                            src={fotoPreview || `${API_BASE}/uploads/${paciente.foto_perfil}`}
                            alt="Preview"
                            style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 12 }}
                          />
                        )}
                        <div>
                          <input type="file" ref={fotoInputRef} accept="image/*" onChange={handleFotoChange} style={{ display: "none" }} />
                          <input type="file" ref={fotoCameraRef} accept="image/*" capture="environment" onChange={handleFotoChange} style={{ display: "none" }} />
                          <div className="d-flex gap-2 flex-wrap">
                            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => fotoCameraRef.current?.click()}>
                              <i className="bi bi-camera me-1" />Tomar foto
                            </button>
                            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => fotoInputRef.current?.click()}>
                              <i className="bi bi-image me-1" />{fotoPreview ? "Cambiar foto" : "Subir desde galería"}
                            </button>
                          </div>
                          <small className="d-block text-muted mt-1">Puedes tomar una foto desde el celular o subir un archivo</small>
                        </div>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Nombres *</label>
                      <input className="form-control" name="nombres" value={form.nombres || ""} onChange={cambioForm} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Apellidos *</label>
                      <input className="form-control" name="apellidos" value={form.apellidos || ""} onChange={cambioForm} required />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">DNI / Identidad</label>
                      <input className="form-control" name="dni" value={form.dni || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Fecha de nacimiento</label>
                      <input className="form-control" type="date" name="fecha_nacimiento" value={form.fecha_nacimiento ? form.fecha_nacimiento.split("T")[0] : ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Sexo</label>
                      <select className="form-select" name="sexo" value={form.sexo || ""} onChange={cambioForm}>
                        <option value="">Seleccionar</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Grupo sanguíneo</label>
                      <select className="form-select" name="grupo_sanguineo" value={form.grupo_sanguineo || ""} onChange={cambioForm}>
                        <option value="">Seleccionar</option>
                        {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Estado Civil</label>
                      <select className="form-select" name="estado_civil" value={form.estado_civil || ""} onChange={cambioForm}>
                        <option value="">Seleccionar</option>
                        {["Soltero(a)","Casado(a)","Unión Libre","Divorciado(a)","Viudo(a)"].map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Ocupación</label>
                      <input className="form-control" name="ocupacion" value={form.ocupacion || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Escolaridad</label>
                      <select className="form-select" name="escolaridad" value={form.escolaridad || ""} onChange={cambioForm}>
                        <option value="">Seleccionar</option>
                        {["Ninguna","Primaria","Secundaria","Preparatoria","Técnico","Universidad","Posgrado"].map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Religión</label>
                      <input className="form-control" name="religion" value={form.religion || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Nacionalidad</label>
                      <input className="form-control" name="nacionalidad" value={form.nacionalidad || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Lugar de nacimiento</label>
                      <input className="form-control" name="lugar_nacimiento" value={form.lugar_nacimiento || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Teléfono</label>
                      <input className="form-control" name="telefono" value={form.telefono || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Email</label>
                      <input className="form-control" type="email" name="email" value={form.email || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Dirección</label>
                      <input className="form-control" name="direccion" value={form.direccion || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Ciudad</label>
                      <input className="form-control" name="ciudad" value={form.ciudad || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">País</label>
                      <input className="form-control" name="pais" value={form.pais || ""} onChange={cambioForm} />
                    </div>
                  </div>
                )}

                {/* ── Sub-tab: Responsable / Tutor ── */}
                {subTabDatos === "responsable" && (
                  <div>
                    <div className="alert alert-info py-2 mb-3">
                      <i className="bi bi-info-circle me-2" />
                      <small>Datos del padre, madre, tutor o representante legal del paciente (obligatorio para menores de edad).</small>
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Nombre completo del responsable</label>
                        <input className="form-control" name="responsable_nombre" value={form.responsable_nombre || ""} onChange={cambioForm} placeholder="Nombre y apellidos" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Parentesco</label>
                        <select className="form-select" name="responsable_parentesco" value={form.responsable_parentesco || ""} onChange={cambioForm}>
                          <option value="">Seleccionar</option>
                          {["Madre","Padre","Abuelo(a)","Tío(a)","Hermano(a)","Tutor Legal","Cónyuge","Otro"].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">DNI del responsable</label>
                        <input className="form-control" name="responsable_dni" value={form.responsable_dni || ""} onChange={cambioForm} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Teléfono</label>
                        <input className="form-control" name="responsable_telefono" value={form.responsable_telefono || ""} onChange={cambioForm} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Email</label>
                        <input className="form-control" type="email" name="responsable_email" value={form.responsable_email || ""} onChange={cambioForm} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Dirección</label>
                        <input className="form-control" name="responsable_direccion" value={form.responsable_direccion || ""} onChange={cambioForm} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Sub-tab: Seguro Médico ── */}
                {subTabDatos === "seguro" && (
                  <div>
                    <div className="alert alert-info py-2 mb-3">
                      <i className="bi bi-info-circle me-2" />
                      <small>Información del seguro médico o aseguradora del paciente.</small>
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Aseguradora</label>
                        <input className="form-control" name="aseguradora" value={form.aseguradora || ""} onChange={cambioForm} placeholder="Nombre de la aseguradora" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Número de póliza</label>
                        <input className="form-control" name="numero_poliza" value={form.numero_poliza || ""} onChange={cambioForm} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Tipo de seguro</label>
                        <select className="form-select" name="tipo_seguro" value={form.tipo_seguro || ""} onChange={cambioForm}>
                          <option value="">Seleccionar</option>
                          {["Público","Privado","Mixto","IHSS","Otro"].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Vigencia del seguro</label>
                        <input className="form-control" type="date" name="vigencia_seguro" value={form.vigencia_seguro ? form.vigencia_seguro.split("T")[0] : ""} onChange={cambioForm} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Sub-tab: Contacto de Emergencia ── */}
                {subTabDatos === "emergencia" && (
                  <div>
                    <div className="alert alert-warning py-2 mb-3">
                      <i className="bi bi-exclamation-triangle me-2" />
                      <small>Persona a contactar en caso de emergencia (diferente al responsable si es necesario).</small>
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Nombre completo</label>
                        <input className="form-control" name="contacto_emergencia_nombre" value={form.contacto_emergencia_nombre || ""} onChange={cambioForm} placeholder="Nombre de contacto de emergencia" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Teléfono de emergencia</label>
                        <input className="form-control" name="contacto_emergencia_telefono" value={form.contacto_emergencia_telefono || ""} onChange={cambioForm} placeholder="Número de teléfono" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Sub-tab: Notas ── */}
                {subTabDatos === "notas" && (
                  <div>
                    <label className="form-label fw-semibold">Notas / Observaciones generales</label>
                    <textarea className="form-control" name="notas" rows={5} value={form.notas || ""} onChange={cambioForm} placeholder="Notas internas sobre el paciente..." style={{ resize: "vertical" }} />
                  </div>
                )}

                {/* Botón guardar (siempre visible) */}
                <div className="mt-4 pt-3 border-top">
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    {guardando ? (
                      <><span className="spinner-border spinner-border-sm me-2" />Guardando...</>
                    ) : (
                      <><i className="bi bi-check-lg me-1" />Guardar cambios</>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* ── MODO LECTURA ── */
              <div>
                {/* Sub-tab: Datos Personales - lectura */}
                {subTabDatos === "paciente" && (
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="text-muted small">Nombres</label>
                      <p className="fw-semibold mb-0">{paciente.nombres}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Apellidos</label>
                      <p className="fw-semibold mb-0">{paciente.apellidos}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">DNI / Identidad</label>
                      <p className="fw-semibold mb-0">{paciente.dni || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Fecha de nacimiento</label>
                      <p className="fw-semibold mb-0">
                        {paciente.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Sexo</label>
                      <p className="fw-semibold mb-0">
                        {paciente.sexo === "M" ? "Masculino" : paciente.sexo === "F" ? "Femenino" : paciente.sexo || "—"}
                      </p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Grupo sanguíneo</label>
                      <p className="fw-semibold mb-0">{paciente.grupo_sanguineo || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Estado Civil</label>
                      <p className="fw-semibold mb-0">{paciente.estado_civil || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Ocupación</label>
                      <p className="fw-semibold mb-0">{paciente.ocupacion || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Escolaridad</label>
                      <p className="fw-semibold mb-0">{paciente.escolaridad || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Religión</label>
                      <p className="fw-semibold mb-0">{paciente.religion || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Nacionalidad</label>
                      <p className="fw-semibold mb-0">{paciente.nacionalidad || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Lugar de nacimiento</label>
                      <p className="fw-semibold mb-0">{paciente.lugar_nacimiento || "—"}</p>
                    </div>
                    <div className="col-md-6">
                      <label className="text-muted small">Teléfono</label>
                      <p className="fw-semibold mb-0">{paciente.telefono || "—"}</p>
                    </div>
                    <div className="col-md-6">
                      <label className="text-muted small">Email</label>
                      <p className="fw-semibold mb-0">{paciente.email || "—"}</p>
                    </div>
                    <div className="col-12">
                      <label className="text-muted small">Dirección</label>
                      <p className="fw-semibold mb-0">{paciente.direccion || "—"}</p>
                    </div>
                    <div className="col-md-6">
                      <label className="text-muted small">Ciudad</label>
                      <p className="fw-semibold mb-0">{paciente.ciudad || "—"}</p>
                    </div>
                    <div className="col-md-6">
                      <label className="text-muted small">País</label>
                      <p className="fw-semibold mb-0">{paciente.pais || "—"}</p>
                    </div>
                  </div>
                )}

                {/* Sub-tab: Responsable - lectura */}
                {subTabDatos === "responsable" && (
                  <div>
                    {!paciente.responsable_nombre ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-people" style={{ fontSize: "2.5rem" }} />
                        <p className="mt-2 mb-0">No se ha registrado un responsable</p>
                        <button className="btn btn-outline-primary btn-sm mt-2" onClick={() => { setEditandoDatos(true); setForm(paciente); }}>
                          <i className="bi bi-plus-lg me-1" />Agregar responsable
                        </button>
                      </div>
                    ) : (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="text-muted small">Nombre del responsable</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_nombre}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Parentesco</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_parentesco || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">DNI del responsable</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_dni || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Teléfono</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_telefono || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Email</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_email || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Dirección</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_direccion || "—"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab: Seguro - lectura */}
                {subTabDatos === "seguro" && (
                  <div>
                    {!paciente.aseguradora ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-shield-plus" style={{ fontSize: "2.5rem" }} />
                        <p className="mt-2 mb-0">No se ha registrado seguro médico</p>
                        <button className="btn btn-outline-primary btn-sm mt-2" onClick={() => { setEditandoDatos(true); setForm(paciente); }}>
                          <i className="bi bi-plus-lg me-1" />Agregar seguro
                        </button>
                      </div>
                    ) : (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="text-muted small">Aseguradora</label>
                          <p className="fw-semibold mb-0">{paciente.aseguradora}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Número de póliza</label>
                          <p className="fw-semibold mb-0">{paciente.numero_poliza || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Tipo de seguro</label>
                          <p className="fw-semibold mb-0">{paciente.tipo_seguro || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Vigencia</label>
                          <p className="fw-semibold mb-0">
                            {paciente.vigencia_seguro ? new Date(paciente.vigencia_seguro).toLocaleDateString() : "—"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab: Emergencia - lectura */}
                {subTabDatos === "emergencia" && (
                  <div>
                    {!paciente.contacto_emergencia_nombre ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-telephone-forward" style={{ fontSize: "2.5rem" }} />
                        <p className="mt-2 mb-0">No se ha registrado contacto de emergencia</p>
                        <button className="btn btn-outline-primary btn-sm mt-2" onClick={() => { setEditandoDatos(true); setForm(paciente); }}>
                          <i className="bi bi-plus-lg me-1" />Agregar contacto
                        </button>
                      </div>
                    ) : (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="text-muted small">Nombre</label>
                          <p className="fw-semibold mb-0">{paciente.contacto_emergencia_nombre}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Teléfono de emergencia</label>
                          <p className="fw-semibold mb-0">{paciente.contacto_emergencia_telefono || "—"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab: Notas - lectura */}
                {subTabDatos === "notas" && (
                  <div>
                    {!paciente.notas ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-sticky" style={{ fontSize: "2.5rem" }} />
                        <p className="mt-2 mb-0">No hay notas registradas</p>
                        <button className="btn btn-outline-primary btn-sm mt-2" onClick={() => { setEditandoDatos(true); setForm(paciente); }}>
                          <i className="bi bi-plus-lg me-1" />Agregar nota
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label className="text-muted small">Notas / Observaciones</label>
                        <div className="bg-light rounded p-3 mt-1" style={{ whiteSpace: "pre-wrap" }}>
                          {paciente.notas}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 2: HISTORIAL CLÍNICO */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "historial" && (
        <div>
          {/* Sección: Antecedentes del Paciente */}
          <div className="mb-4">
            <AntecedentesClinico pacienteId={id} sexo={paciente.sexo} />
          </div>

          {/* Sección: Consultas */}
          <div className="card shadow-sm">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-journal-medical me-2 text-success" />Consultas
              </h5>
              <Link to={`/consulta?paciente_id=${id}`} className="btn btn-sm btn-success">
                <i className="bi bi-plus-lg me-1" />Nueva Consulta
              </Link>
            </div>
            <div className="card-body">
              {historias.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-inbox" style={{ fontSize: "3rem", color: "#ccc" }} />
                  <p className="text-muted mt-3">No hay consultas registradas</p>
                  <Link to={`/consulta?paciente_id=${id}`} className="btn btn-primary">
                    <i className="bi bi-plus-circle me-1" />Crear primera consulta
                  </Link>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {historias.map((h) => (
                    <div key={h.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <h6 className="mb-1">
                            <i className="bi bi-calendar-check me-2 text-success" />
                            {new Date(h.creado_en).toLocaleDateString('es-ES', { 
                              year: 'numeric', month: 'long', day: 'numeric' 
                            })} - {new Date(h.creado_en).toLocaleTimeString('es-ES', { 
                              hour: '2-digit', minute: '2-digit' 
                            })}
                          </h6>
                          <p className="mb-1 text-muted small">
                            <strong>Médico:</strong> Dr(a). {h.med_nombres} {h.med_apellidos}
                          </p>
                          {h.diagnostico_cie && (
                            <p className="mb-1">
                              <span className="badge bg-info">{h.diagnostico_cie}</span>
                            </p>
                          )}
                          {h.subjetivo && (
                            <p className="mb-0 text-muted" style={{ fontSize: '0.9rem' }}>
                              {h.subjetivo.substring(0, 100)}...
                            </p>
                          )}
                        </div>
                        <Link to={`/consulta?historia_id=${h.id}`} className="btn btn-sm btn-outline-primary">
                          <i className="bi bi-eye me-1" />Ver
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 3: EXÁMENES / DOCUMENTOS */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "examenes" && (
        <div className="row g-4">
          {/* Subir nuevo documento */}
          <div className="col-md-4">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-primary text-white">
                <h6 className="mb-0">
                  <i className="bi bi-cloud-upload me-2" />Subir Examen
                </h6>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Tipo de documento</label>
                  <select 
                    className="form-select" 
                    value={tipoDoc} 
                    onChange={(e) => setTipoDoc(e.target.value)}
                  >
                    {TIPOS_DOC.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Seleccionar archivo</label>
                  <input
                    ref={fileRef}
                    type="file"
                    className="form-control"
                    accept="image/*,.pdf"
                    onChange={(e) => setArchivo(e.target.files[0])
                    }
                  />
                  <small className="text-muted">
                    Puedes tomar una foto desde el celular o subir PDF/imágenes
                  </small>
                </div>

                {archivo && (
                  <div className="alert alert-info py-2">
                    <i className="bi bi-file-earmark-check me-2" />
                    {archivo.name}
                  </div>
                )}

                <button
                  className="btn btn-primary w-100"
                  onClick={subirDocumento}
                  disabled={!archivo || subiendo}
                >
                  {subiendo ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Subiendo...</>
                  ) : (
                    <><i className="bi bi-upload me-1" />Subir documento</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Lista de documentos */}
          <div className="col-md-8">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h6 className="mb-0">
                  <i className="bi bi-files me-2 text-info" />Documentos subidos ({documentos.length})
                </h6>
              </div>
              <div className="card-body">
                {documentos.length === 0 ? (
                  <div className="text-center py-4">
                    <i className="bi bi-inbox" style={{ fontSize: "2.5rem", color: "#ccc" }} />
                    <p className="text-muted mt-2">No hay documentos subidos</p>
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {documentos.map((doc) => {
                      const tipoInfo = TIPOS_DOC.find(t => t.value === doc.tipo) || TIPOS_DOC[TIPOS_DOC.length - 1];
                      const esImagen = doc.url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                      return (
                        <div key={doc.id} className="list-group-item">
                          <div className="d-flex align-items-center gap-3">
                            <div className="flex-shrink-0">
                              <i className={`bi ${tipoInfo.icon} text-primary`} style={{ fontSize: "2rem" }} />
                            </div>
                            <div className="flex-grow-1">
                              <h6 className="mb-0">{tipoInfo.label}</h6>
                              <small className="text-muted">
                                {new Date(doc.subido_en).toLocaleDateString()}
                              </small>
                            </div>
                            <div className="d-flex gap-2">
                              {esImagen && (
                                <a
                                  href={`${API_BASE}/uploads/${doc.url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-sm btn-outline-secondary"
                                >
                                  <i className="bi bi-eye" />
                                </a>
                              )}
                              <a
                                href={`${API_BASE}/uploads/${doc.url}`}
                                download
                                className="btn btn-sm btn-outline-primary"
                              >
                                <i className="bi bi-download" />
                              </a>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => eliminarDocumento(doc.id)}
                              >
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 4: CURVAS DE CRECIMIENTO OMS */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "crecimiento" && (
        <div className="card shadow-sm">
          <div className="card-header" style={{ background: "linear-gradient(135deg, #214a87 0%, #176DC8 100%)" }}>
            <h5 className="mb-0 text-white">
              <i className="bi bi-graph-up-arrow me-2" />Curvas de Crecimiento — Estándares OMS
            </h5>
          </div>
          <div className="card-body p-4">
            <CurvaCrecimiento
              pacienteId={id}
              sexo={paciente.sexo}
              fechaNacimiento={paciente.fecha_nacimiento}
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 5: ELIMINAR PACIENTE (Doble confirmación) */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "eliminar" && (
        <div className="card shadow-sm border-danger">
          <div className="card-header bg-danger text-white">
            <h5 className="mb-0">
              <i className="bi bi-exclamation-triangle me-2" />Zona Peligrosa
            </h5>
          </div>
          <div className="card-body p-4">
            <div className="alert alert-danger">
              <h6 className="alert-heading">
                <i className="bi bi-shield-exclamation me-2" />¡Advertencia!
              </h6>
              <p className="mb-0">
                Esta acción es <strong>permanente e irreversible</strong>. Se eliminarán:
              </p>
              <ul className="mt-2 mb-0">
                <li>Todos los datos personales del paciente</li>
                <li>Historial clínico completo ({historias.length} consultas)</li>
                <li>Documentos y exámenes subidos ({documentos.length} archivos)</li>
                <li>Citas programadas y antecedentes médicos</li>
              </ul>
            </div>

            {!confirmarEliminar ? (
              <div className="text-center py-4">
                <button
                  className="btn btn-danger btn-lg"
                  onClick={() => setConfirmarEliminar(true)}
                >
                  <i className="bi bi-trash me-2" />Deseo eliminar este paciente
                </button>
              </div>
            ) : (
              <div>
                <h6 className="fw-bold mb-3">Confirmación requerida</h6>
                <p className="text-muted">
                  Para confirmar la eliminación, escribe el nombre completo del paciente:
                </p>
                <div className="bg-light p-3 rounded mb-3 text-center">
                  <code className="fs-5 fw-bold">{nombreCompleto}</code>
                </div>
                
                <input
                  type="text"
                  className="form-control form-control-lg mb-3"
                  placeholder="Escribe el nombre completo aquí"
                  value={textoConfirmacion}
                  onChange={(e) => setTextoConfirmacion(e.target.value)}
                />

                <div className="d-flex gap-2 justify-content-end">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setConfirmarEliminar(false);
                      setTextoConfirmacion("");
                    }}
                  >
                    <i className="bi bi-x-lg me-1" />Cancelar
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={eliminarPaciente}
                    disabled={textoConfirmacion !== nombreCompleto || eliminando}
                  >
                    {eliminando ? (
                      <><span className="spinner-border spinner-border-sm me-2" />Eliminando...</>
                    ) : (
                      <><i className="bi bi-trash me-1" />Confirmar eliminación</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
