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
import dayjs from "dayjs";
import api from "../api/api";

const API_BASE_PP = (import.meta.env.VITE_API_URL || "http://localhost:5000");
const ESTADO_BADGE_PP = { BORRADOR: "warning text-dark", FIRMADA: "success" };
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

  // Sub-pestañas dentro de Historial Clínico
  const [subTabHistorial, setSubTabHistorial] = useState("antecedentes");

  // Historial de consultas - filtros y expansión
  const [filtroDesde,  setFiltroDesde]  = useState("");
  const [filtroHasta,  setFiltroHasta]  = useState("");
  const [expandId,     setExpandId]     = useState(null);
  const [detalle,      setDetalle]      = useState({});
  const [alergiasPac,  setAlergiasPac]  = useState([]);
  const [showConsultaModal, setShowConsultaModal] = useState(false);
  const [consultaPaciente,  setConsultaPaciente]  = useState(null);

  // Modal confirmación eliminar documento
  const [docAEliminar, setDocAEliminar] = useState(null);
  const [docViewer, setDocViewer] = useState(null); // doc a visualizar en modal

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

      // Cargar alergias (para impresión de consulta)
      try {
        const resAl = await api.get(`/historias/paciente/${id}/alergias`);
        setAlergiasPac(resAl.data.data || []);
      } catch { setAlergiasPac([]); }
      
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

  // ── Expandir consulta → cargar detalle ──────────────────────────────────
  const toggleExpandPP = async (hId) => {
    if (expandId === hId) { setExpandId(null); return; }
    setExpandId(hId);
    if (!detalle[hId]) {
      try {
        const r = await api.get(`/historias/${hId}`);
        setDetalle(d => ({ ...d, [hId]: r.data.data }));
      } catch { /* silencio */ }
    }
  };

  // ── Imprimir consulta ─────────────────────────────────────────────────────
  const imprimirConsultaPP = async (h) => {
    let det = detalle[h.id];
    if (!det) {
      try {
        const r = await api.get(`/historias/${h.id}`);
        det = r.data.data;
        setDetalle(d => ({ ...d, [h.id]: det }));
      } catch {
        alert("No se pudo cargar el detalle de la consulta");
        return;
      }
    }
    const vitals = det.objetivo
      ? (typeof det.objetivo === "string" ? JSON.parse(det.objetivo) : det.objetivo)
      : {};
    const vitalesHtml = ["pa","fc","fr","temp","peso","talla","spo2"]
      .filter(k => vitals[k])
      .map(k => {
        const labels = { pa:"P.A.", fc:"F.C.", fr:"F.R.", temp:"Temp.", peso:"Peso", talla:"Talla", spo2:"SpO₂" };
        const units  = { pa:"mmHg", fc:"bpm", fr:"rpm", temp:"°C", peso:"kg", talla:"cm", spo2:"%" };
        return `<span class="vital">${labels[k]}: <strong>${vitals[k]}</strong> ${units[k]}</span>`;
      }).join("");
    const prescHtml = (det.prescripciones || []).map(p => `
      <div class="section">
        <div class="section-title">Receta #${p.id} — ${p.estado}</div>
        <ul>${(p.items || []).filter(Boolean).map(it =>
          `<li>${it.medicamento_nombre || it.medicamento_texto || ""}${it.dosis ? ` — ${it.dosis}` : ""}${it.duracion ? ` — ${it.duracion}` : ""}</li>`
        ).join("")}</ul>
      </div>`).join("");
    const estudiosHtml = (det.estudios || []).length > 0 ? `
      <div class="section">
        <div class="section-title">Estudios solicitados</div>
        <ul>${(det.estudios || []).map(s =>
          `<li>[${s.tipo}] ${s.descripcion} — ${s.estado}</li>`
        ).join("")}</ul>
      </div>` : "";
    const alergiasHtml = alergiasPac.length > 0
      ? `<div class="alergias">⚠ Alergias: ${alergiasPac.map(a => `${a.agente} (${a.severidad})`).join(" | ")}</div>`
      : "";
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Consulta — ${det.pac_apellidos}, ${det.pac_nombres} — ${dayjs(det.creado_en).format("DD/MM/YYYY")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #166ae8; padding-bottom: 12px; margin-bottom: 16px; }
    .header-left h1 { font-size: 18px; color: #166ae8; }
    .header-left p { font-size: 12px; color: #555; margin-top: 2px; }
    .header-right { text-align: right; font-size: 12px; color: #555; }
    .paciente { background: #f4f6fb; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; }
    .paciente h2 { font-size: 15px; margin-bottom: 4px; }
    .paciente .datos { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #555; }
    .alergias { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 12px; font-weight: bold; color: #856404; }
    .vitales { display: flex; flex-wrap: wrap; gap: 10px; background: #eef2ff; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; }
    .vital { font-size: 12px; color: #333; }
    .section { margin-bottom: 14px; }
    .section-title { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #166ae8; border-bottom: 1px solid #dde3f5; padding-bottom: 3px; margin-bottom: 6px; }
    .section p, .section pre { font-size: 13px; color: #333; white-space: pre-wrap; line-height: 1.5; }
    ul { padding-left: 20px; } ul li { margin-bottom: 3px; }
    .badge-cie { display: inline-block; background: #e9ecef; border: 1px solid #ced4da; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: bold; margin-right: 6px; }
    .firma { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ccc; display: flex; justify-content: flex-end; }
    .firma-box { text-align: center; }
    .firma-box .linea { width: 200px; border-top: 1px solid #333; margin: 0 auto 4px; }
    .firma-box p { font-size: 12px; color: #444; }
    @media print { body { padding: 12px 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Historia Clínica Electrónica</h1>
      <p>Dr. ${det.med_apellidos}, ${det.med_nombres}${det.especialidad ? ` — ${det.especialidad}` : ""}</p>
    </div>
    <div class="header-right">
      <p><strong>Fecha:</strong> ${dayjs(det.creado_en).format("DD/MM/YYYY HH:mm")}</p>
      <p><strong>Estado:</strong> ${det.estado}</p>
      <p><strong>Consulta #${det.id}</strong></p>
    </div>
  </div>
  <div class="paciente">
    <h2>${det.pac_apellidos}, ${det.pac_nombres}</h2>
    <div class="datos">
      ${det.fecha_nacimiento ? `<span>Nacimiento: ${dayjs(det.fecha_nacimiento).format("DD/MM/YYYY")}</span>` : ""}
      ${det.sexo ? `<span>Sexo: ${det.sexo}</span>` : ""}
      ${det.pac_tel ? `<span>Tel: ${det.pac_tel}</span>` : ""}
      ${det.pac_email ? `<span>Email: ${det.pac_email}</span>` : ""}
    </div>
  </div>
  ${alergiasHtml}
  ${vitalesHtml ? `<div class="vitales">${vitalesHtml}</div>` : ""}
  ${det.diagnostico_cie ? `<div class="section"><div class="section-title">Diagnóstico</div><p><span class="badge-cie">CIE: ${det.diagnostico_cie}</span>${det.diagnostico_desc || ""}</p></div>` : ""}
  ${det.subjetivo ? `<div class="section"><div class="section-title">Motivo / Anamnesis</div><p>${det.subjetivo}</p></div>` : ""}
  ${det.examen_fisico ? `<div class="section"><div class="section-title">Examen Físico</div><pre>${det.examen_fisico}</pre></div>` : ""}
  ${det.plan ? `<div class="section"><div class="section-title">Plan de tratamiento</div><pre>${det.plan}</pre></div>` : ""}
  ${prescHtml}${estudiosHtml}
  <div class="firma"><div class="firma-box"><div class="linea"></div><p>Dr. ${det.med_apellidos}, ${det.med_nombres}</p>${det.especialidad ? `<p>${det.especialidad}</p>` : ""}</div></div>
</body></html>`;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) { alert("El navegador bloqueó la ventana emergente. Permite popups para este sitio."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  // ── PDF de receta ─────────────────────────────────────────────────────────
  const printRxPP = async (rxId) => {
    try {
      const res = await api.get(`/prescripciones/${rxId}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch {
      alert("No se pudo generar el PDF");
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
    try {
      await api.delete(`/pacientes/${id}/documentos/${docId}`);
      setMsg({ tipo: "success", texto: "Documento eliminado" });
      setDocumentos(d => d.filter(doc => doc.id !== docId));
    } catch {
      setMsg({ tipo: "danger", texto: "Error al eliminar documento" });
    } finally {
      setDocAEliminar(null);
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
              <button
                className="btn btn-success"
                onClick={() => { setConsultaPaciente(paciente); setShowConsultaModal(true); }}
              >
                <i className="bi bi-plus-circle me-1" />Nueva Consulta
              </button>
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
          {/* Sub-pestañas */}
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button
                className={`nav-link ${subTabHistorial === "antecedentes" ? "active" : ""}`}
                onClick={() => setSubTabHistorial("antecedentes")}
              >
                <i className="bi bi-heart-pulse me-1" />
                Alergias y Antecedentes
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${subTabHistorial === "consultas" ? "active" : ""}`}
                onClick={() => setSubTabHistorial("consultas")}
              >
                <i className="bi bi-clock-history me-1" />
                Historial de Consultas
                <span className="badge bg-secondary ms-1" style={{ fontSize: "0.7rem" }}>{historias.length}</span>
              </button>
            </li>
          </ul>

          {/* Sub-tab: Alergias y Antecedentes */}
          {subTabHistorial === "antecedentes" && (
            <AntecedentesClinico pacienteId={id} sexo={paciente.sexo} />
          )}

          {/* Sub-tab: Historial de Consultas */}
          {subTabHistorial === "consultas" && (
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="mb-0">
                  <i className="bi bi-journal-medical me-2 text-success" />
                  Consultas
                  <span className="badge bg-secondary ms-2" style={{ fontSize: "0.75rem" }}>{historias.length}</span>
                </h5>
              </div>
              <div className="card-body">
                {/* Filtro por fecha */}
                <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                  <small className="text-muted fw-semibold">Filtrar por fecha:</small>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    style={{ width: 150 }}
                    value={filtroDesde}
                    onChange={e => setFiltroDesde(e.target.value)}
                  />
                  <span className="text-muted small">—</span>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    style={{ width: 150 }}
                    value={filtroHasta}
                    onChange={e => setFiltroHasta(e.target.value)}
                  />
                  {(filtroDesde || filtroHasta) && (
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => { setFiltroDesde(""); setFiltroHasta(""); }}
                    >
                      <i className="bi bi-x-lg me-1" />Limpiar
                    </button>
                  )}
                  {historias.length > 0 && (
                    <small className="text-muted ms-auto">
                      {(() => {
                        const n = historias.filter(h => {
                          const f = dayjs(h.creado_en);
                          if (filtroDesde && f.isBefore(dayjs(filtroDesde), "day")) return false;
                          if (filtroHasta && f.isAfter(dayjs(filtroHasta), "day")) return false;
                          return true;
                        }).length;
                        return `${n} de ${historias.length} consultas`;
                      })()}
                    </small>
                  )}
                </div>

                {historias.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-inbox" style={{ fontSize: "3rem", color: "#ccc" }} />
                    <p className="text-muted mt-3">No hay consultas registradas</p>
                    <button
                      className="btn btn-success"
                      onClick={() => { setConsultaPaciente(paciente); setShowConsultaModal(true); }}
                    >
                      <i className="bi bi-plus-circle me-1" />Nueva Consulta
                    </button>
                  </div>
                ) : (() => {
                  const filtradas = historias.filter(h => {
                    const f = dayjs(h.creado_en);
                    if (filtroDesde && f.isBefore(dayjs(filtroDesde), "day")) return false;
                    if (filtroHasta && f.isAfter(dayjs(filtroHasta), "day")) return false;
                    return true;
                  });
                  return (
                    <>
                      {historias.length > 0 && filtradas.length === 0 && (
                        <div className="alert alert-warning py-2">
                          <i className="bi bi-search me-2" />
                          No hay consultas en el rango de fechas seleccionado.
                        </div>
                      )}
                      <div className="timeline" style={{ maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
                        {filtradas.map((h, i) => {
                          const det = detalle[h.id];
                          const expanded = expandId === h.id;
                          const vitals = h.objetivo
                            ? (typeof h.objetivo === "string" ? JSON.parse(h.objetivo) : h.objetivo)
                            : {};
                          return (
                            <div key={h.id} className="d-flex gap-3 mb-3">
                              {/* Línea de tiempo */}
                              <div className="d-flex flex-column align-items-center" style={{ minWidth: 24 }}>
                                <div className={`rounded-circle border border-2 ${h.estado === "FIRMADA" ? "border-success bg-success" : "border-warning bg-warning"}`}
                                  style={{ width: 12, height: 12, marginTop: 6, flexShrink: 0 }} />
                                {i < filtradas.length - 1 && (
                                  <div style={{ width: 2, flex: 1, background: "#dee2e6", minHeight: 40 }} />
                                )}
                              </div>
                              {/* Tarjeta */}
                              <div className="card border-0 shadow-sm flex-grow-1 mb-2">
                                <div className="card-body py-2">
                                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-1">
                                    <div>
                                      <span className={`badge bg-${ESTADO_BADGE_PP[h.estado]?.split(" ")[0]} ${ESTADO_BADGE_PP[h.estado]?.split(" ")[1] || ""} me-2`}>
                                        {h.estado}
                                      </span>
                                      <strong className="small">Dr. {h.med_apellidos}, {h.med_nombres}</strong>
                                      {h.especialidad && <span className="text-muted small ms-1">({h.especialidad})</span>}
                                    </div>
                                    <small className="text-muted">{dayjs(h.creado_en).format("DD/MM/YYYY HH:mm")}</small>
                                  </div>
                                  {h.diagnostico_cie && (
                                    <div className="small mt-1">
                                      <span className="badge bg-light text-dark border me-1">CIE: {h.diagnostico_cie}</span>
                                      {h.plan && <span className="text-muted">{h.plan.substring(0, 80)}{h.plan.length > 80 ? "…" : ""}</span>}
                                    </div>
                                  )}
                                  {h.subjetivo && !h.diagnostico_cie && (
                                    <div className="small text-muted mt-1">
                                      {h.subjetivo.substring(0, 100)}{h.subjetivo.length > 100 ? "…" : ""}
                                    </div>
                                  )}
                                  {(vitals.pa || vitals.fc || vitals.temp) && (
                                    <div className="d-flex flex-wrap gap-2 mt-1">
                                      {vitals.pa   && <small className="text-muted">P.A. {vitals.pa} mmHg</small>}
                                      {vitals.fc   && <small className="text-muted">· FC {vitals.fc} bpm</small>}
                                      {vitals.temp && <small className="text-muted">· T {vitals.temp}°C</small>}
                                      {vitals.peso && <small className="text-muted">· Peso {vitals.peso} kg</small>}
                                    </div>
                                  )}
                                  {/* Acciones */}
                                  <div className="d-flex gap-2 mt-2 flex-wrap">
                                    <button className="btn btn-outline-secondary btn-sm"
                                      onClick={() => toggleExpandPP(h.id)}>
                                      {expanded ? "Ocultar detalle" : "Ver detalle"}
                                    </button>
                                    {h.estado === "BORRADOR" && (
                                      <Link to={`/consulta-medica?historia_id=${h.id}`} className="btn btn-outline-primary btn-sm">
                                        ✏ Editar
                                      </Link>
                                    )}
                                    {h.estado === "FIRMADA" && (
                                      <Link to={`/consulta-medica?historia_id=${h.id}`} className="btn btn-link btn-sm p-0">
                                        Ver completa
                                      </Link>
                                    )}
                                    <button
                                      className="btn btn-outline-secondary btn-sm ms-auto"
                                      title="Imprimir consulta"
                                      onClick={() => imprimirConsultaPP(h)}
                                    >
                                      <i className="bi bi-printer me-1" />Imprimir
                                    </button>
                                  </div>
                                  {/* Detalle expandido */}
                                  {expanded && det && (
                                    <div className="border-top mt-2 pt-2">
                                      {det.prescripciones?.length > 0 && (
                                        <div className="mb-2">
                                          <div className="small fw-semibold mb-1">💊 Prescripción(es):</div>
                                          {det.prescripciones.map(p => (
                                            <div key={p.id} className="small text-muted ps-2 mb-1">
                                              <div className="d-flex align-items-center gap-2 mb-1">
                                                <span>Receta #{p.id}</span>
                                                <span className="badge bg-secondary">{p.estado}</span>
                                                <button className="btn btn-outline-primary btn-sm py-0 px-1"
                                                  style={{ fontSize: "0.72rem" }}
                                                  onClick={() => printRxPP(p.id)}>
                                                  <i className="bi bi-printer me-1" />PDF
                                                </button>
                                              </div>
                                              {p.items?.filter(Boolean).map((it, idx) => (
                                                <div key={idx} className="ps-2">• {it.medicamento_nombre || it.medicamento_texto}{it.dosis ? ` — ${it.dosis}` : ""}</div>
                                              ))}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {det.estudios?.length > 0 && (
                                        <div className="mb-2">
                                          <div className="small fw-semibold mb-1">🧪 Estudios solicitados:</div>
                                          {det.estudios.map(s => (
                                            <div key={s.id} className="small text-muted ps-2">
                                              [{s.tipo}] {s.descripcion} — {s.estado}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {det.plan && (
                                        <div>
                                          <div className="small fw-semibold mb-1">Plan:</div>
                                          <div className="small text-muted" style={{ whiteSpace: "pre-wrap" }}>{det.plan}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {expanded && !det && (
                                    <div className="mt-2 text-muted small">Cargando detalle…</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
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
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f && f.size > 10 * 1024 * 1024) {
                        setMsg({ tipo: "danger", texto: "El archivo supera el límite de 10 MB" });
                        e.target.value = "";
                        setArchivo(null);
                        return;
                      }
                      setArchivo(f || null);
                    }}
                  />
                  <small className="text-muted">
                    Puedes tomar una foto desde el celular o subir PDF/imágenes (máx. 10 MB)
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
                      const esImagen = doc.ruta_archivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                      const esPdf = doc.ruta_archivo?.match(/\.pdf$/i);
                      const urlArchivo = `${API_BASE}/uploads/pacientes/${doc.ruta_archivo}`;
                      const peso = doc.tamano_bytes
                        ? doc.tamano_bytes >= 1024 * 1024
                          ? (doc.tamano_bytes / (1024 * 1024)).toFixed(1) + " MB"
                          : (doc.tamano_bytes / 1024).toFixed(0) + " KB"
                        : null;
                      return (
                        <div key={doc.id} className="list-group-item list-group-item-action" style={{ cursor: "pointer" }}
                          onClick={() => setDocViewer(doc)}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <div className="flex-shrink-0">
                              <i className={`bi ${tipoInfo.icon} text-primary`} style={{ fontSize: "2rem" }} />
                            </div>
                            <div className="flex-grow-1">
                              <h6 className="mb-0">{tipoInfo.label}</h6>
                              <small className="text-muted">
                                {new Date(doc.subido_en).toLocaleDateString()}
                              </small>
                              {esPdf && <small className="ms-2 badge bg-light text-dark border">PDF</small>}
                              {esImagen && <small className="ms-2 badge bg-light text-dark border">Imagen</small>}
                              {peso && <small className="ms-2 text-muted">{peso}</small>}
                            </div>
                            <div className="d-flex gap-2" onClick={e => e.stopPropagation()}>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                title="Ver documento"
                                onClick={(e) => { e.stopPropagation(); setDocViewer(doc); }}
                              >
                                <i className="bi bi-eye" />
                              </button>
                              <a
                                href={urlArchivo}
                                download
                                className="btn btn-sm btn-outline-primary"
                                title="Descargar"
                              >
                                <i className="bi bi-download" />
                              </a>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => setDocAEliminar(doc)}
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
      {/* Modal visor de documento */}
      {docViewer && (() => {
        const esImagen = docViewer.ruta_archivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        const esPdf    = docViewer.ruta_archivo?.match(/\.pdf$/i);
        const url      = `${API_BASE}/uploads/pacientes/${docViewer.ruta_archivo}`;
        const tipoInfo = TIPOS_DOC.find(t => t.value === docViewer.tipo) || TIPOS_DOC[TIPOS_DOC.length - 1];
        return (
          <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.75)" }} tabIndex="-1"
            onClick={() => setDocViewer(null)}
          >
            <div className="modal-dialog modal-xl modal-dialog-centered" onClick={e => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header d-flex justify-content-between align-items-center">
                  <h5 className="modal-title mb-0">
                    <i className={`bi ${tipoInfo.icon} me-2 text-primary`} />
                    {tipoInfo.label} &mdash; <small className="text-muted">{new Date(docViewer.subido_en).toLocaleDateString()}</small>
                  </h5>
                  <div className="d-flex gap-2 align-items-center ms-auto">
                    <a href={url} download className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-download me-1" />Descargar
                    </a>
                    <button type="button" className="btn-close" onClick={() => setDocViewer(null)} />
                  </div>
                </div>
                <div className="modal-body p-0" style={{ minHeight: 400 }}>
                  {esImagen && (
                    <div className="text-center p-3">
                      <img
                        src={url}
                        alt={tipoInfo.label}
                        style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 8 }}
                      />
                    </div>
                  )}
                  {esPdf && (
                    <iframe
                      src={url}
                      title={tipoInfo.label}
                      style={{ width: "100%", height: "75vh", border: "none" }}
                    />
                  )}
                  {!esImagen && !esPdf && (
                    <div className="text-center py-5">
                      <i className="bi bi-file-earmark" style={{ fontSize: "3rem", color: "#ccc" }} />
                      <p className="text-muted mt-2">Vista previa no disponible para este tipo de archivo.</p>
                      <a href={url} download className="btn btn-primary">
                        <i className="bi bi-download me-1" />Descargar archivo
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal confirmar eliminación de documento */}
      {docAEliminar && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title">
                  <i className="bi bi-trash text-danger me-2" />Eliminar documento
                </h5>
                <button type="button" className="btn-close" onClick={() => setDocAEliminar(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-1">¿Estás seguro de que deseas eliminar este documento?</p>
                <div className="bg-light rounded p-2 mt-2">
                  <small className="text-muted">Tipo: </small>
                  <span className="fw-semibold">{TIPOS_DOC.find(t => t.value === docAEliminar.tipo)?.label || docAEliminar.tipo}</span>
                  <br />
                  <small className="text-muted">Fecha: </small>
                  <span className="fw-semibold">{new Date(docAEliminar.subido_en).toLocaleDateString()}</span>
                </div>
                <p className="text-danger small mt-2 mb-0">Esta acción no se puede deshacer.</p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-outline-secondary" onClick={() => setDocAEliminar(null)}>
                  Cancelar
                </button>
                <button className="btn btn-danger" onClick={() => eliminarDocumento(docAEliminar.id)}>
                  <i className="bi bi-trash me-1" />Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConsultaModal && consultaPaciente && (
        <ModalConsultaSinCita
          paciente={consultaPaciente}
          onClose={() => { setShowConsultaModal(false); setConsultaPaciente(null); }}
          onCreated={(citaId) => {
            setShowConsultaModal(false);
            navigate(`/consulta-medica?paciente_id=${consultaPaciente.id}&cita_id=${citaId}`);
            setConsultaPaciente(null);
          }}
        />
      )}
    </div>
  );
}

// ── Modal: crear cita y lanzar consulta ──────────────────────────────────────
function ModalConsultaSinCita({ paciente, onClose, onCreated }) {
  const [modo, setModo] = useState(null);
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState("");
  const [fechaSel, setFechaSel] = useState(dayjs().format("YYYY-MM-DD"));
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotSel, setSlotSel] = useState("");
  const [tipo, setTipo] = useState("PRIMERA_VEZ");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/usuarios/medicos")
      .then(r => setMedicos(r.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!medicoId || !fechaSel) { setSlots([]); return; }
    api.get("/citas/slots", { params: { medico_id: medicoId, fecha: fechaSel } })
      .then(r => setSlots(r.data.data || []))
      .catch(() => setSlots([]));
  }, [medicoId, fechaSel]);

  const selSlot = (s) => {
    setSlotSel(s.inicio);
    setHoraInicio(dayjs(s.inicio).format("HH:mm"));
    setHoraFin(dayjs(s.fin).format("HH:mm"));
  };

  const agendarAhora = async () => {
    if (!medicoId) { setErr("Selecciona un médico"); return; }
    setSaving(true); setErr("");
    try {
      const inicio = dayjs().format("YYYY-MM-DD HH:mm:ss");
      const fin = dayjs().add(30, "minute").format("YYYY-MM-DD HH:mm:ss");
      const res = await api.post("/citas", {
        paciente_id: paciente.id, medico_id: medicoId,
        inicio, fin, tipo_consulta: tipo, motivo: motivo || null, canal: "RECEPCION",
      });
      await api.patch(`/citas/${res.data.id}/estado`, { estado: "EN_ATENCION" });
      onCreated(res.data.id);
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  const agendarSeleccionado = async () => {
    if (!medicoId) { setErr("Selecciona un médico"); return; }
    if (!horaInicio || !horaFin) { setErr("Ingresa hora de inicio y fin"); return; }
    const inicio = dayjs(`${fechaSel} ${horaInicio}`);
    const fin = dayjs(`${fechaSel} ${horaFin}`);
    if (fin.isBefore(inicio) || fin.isSame(inicio)) {
      setErr("La hora de fin debe ser posterior a la hora de inicio"); return;
    }
    setSaving(true); setErr("");
    try {
      const res = await api.post("/citas", {
        paciente_id: paciente.id, medico_id: medicoId,
        inicio: inicio.format("YYYY-MM-DD HH:mm:ss"),
        fin: fin.format("YYYY-MM-DD HH:mm:ss"),
        tipo_consulta: tipo, motivo: motivo || null, canal: "RECEPCION",
      });
      onCreated(res.data.id);
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 9998 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: modo === "seleccionar" ? 600 : 500 }}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: "#673ab7", color: "#fff" }}>
            <h5 className="modal-title">
              <i className="bi bi-clipboard2-pulse me-2"></i>Nueva Consulta
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="alert alert-warning py-2 mb-3">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>{paciente.apellidos}, {paciente.nombres}</strong> no tiene consulta agendada para hoy.
            </div>
            {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}

            {!modo && (
              <div className="text-center py-2">
                <p className="mb-3">¿Desea agendar una consulta?</p>
                <div className="d-flex justify-content-center gap-3">
                  <button className="btn btn-success px-4" onClick={() => setModo("ahora")}>
                    <i className="bi bi-clock-fill me-2"></i>Ahora
                  </button>
                  <button className="btn btn-primary px-4" onClick={() => setModo("seleccionar")}>
                    <i className="bi bi-calendar-event me-2"></i>Seleccionar
                  </button>
                </div>
              </div>
            )}

            {modo === "ahora" && (
              <div>
                <p className="text-muted small mb-2">
                  Se creará una cita para <strong>ahora ({dayjs().format("h:mm A")})</strong> con duración de 30 minutos.
                </p>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médico</label>
                  <select className="form-select" value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
                    ))}
                  </select>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                      {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Motivo</label>
                    <input className="form-control form-control-sm" value={motivo}
                      onChange={e => setMotivo(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              </div>
            )}

            {modo === "seleccionar" && (
              <div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médico</label>
                  <select className="form-select" value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Fecha</label>
                  <input type="date" className="form-control" value={fechaSel}
                    onChange={e => setFechaSel(e.target.value)} />
                </div>
                {slots.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Horarios disponibles</label>
                    <div className="d-flex flex-wrap gap-1">
                      {slots.map(s => (
                        <button key={s.inicio} type="button"
                          className={`btn btn-sm ${slotSel === s.inicio ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => selSlot(s)}>
                          {dayjs(s.inicio).format("h:mm A")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {medicoId && fechaSel && slots.length === 0 && (
                  <small className="text-muted d-block mb-2">Sin horarios disponibles. Ingresa hora manualmente.</small>
                )}
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Hora inicio</label>
                    <input type="time" className="form-control" value={horaInicio}
                      onChange={e => setHoraInicio(e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Hora fin</label>
                    <input type="time" className="form-control" value={horaFin}
                      onChange={e => setHoraFin(e.target.value)} />
                  </div>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                      {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Motivo</label>
                    <input className="form-control form-control-sm" value={motivo}
                      onChange={e => setMotivo(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              </div>
            )}
          </div>
          {modo && (
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => { setModo(null); setErr(""); }}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button
                className={`btn ${modo === "ahora" ? "btn-success" : "btn-primary"}`}
                disabled={saving}
                onClick={modo === "ahora" ? agendarAhora : agendarSeleccionado}>
                {saving ? "Creando…" : modo === "ahora" ? "Agendar y Consultar" : "Agendar Cita"}
              </button>
            </div>
          )}
          {!modo && (
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
