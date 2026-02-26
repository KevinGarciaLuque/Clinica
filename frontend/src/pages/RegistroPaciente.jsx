/**
 * Portal público de auto-registro de pacientes
 * URL: /registro?clinica_id=1
 *
 * Paso 1 → Datos personales
 * Paso 2 → Subida de documentos (opcional)
 * Paso 3 → Confirmación (email de verificación enviado)
 */
import { useState, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";

const BASE     = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

// ── helpers ──────────────────────────────────────────────
function ProgressBar({ paso }) {
  const pasos = ["Datos personales", "Tu foto", "Documentos", "Confirmación"];
  return (
    <div className="d-flex align-items-center gap-0 mb-4">
      {pasos.map((label, i) => (
        <div key={i} className="d-flex align-items-center flex-grow-1">
          <div className="d-flex flex-column align-items-center" style={{ minWidth: 80 }}>
            <div
              className={`rounded-circle d-flex align-items-center justify-content-center fw-bold mb-1 ${
                i < paso  ? "bg-success text-white" :
                i === paso ? "bg-primary text-white" : "bg-light text-muted border"
              }`}
              style={{ width: 36, height: 36, fontSize: "0.85rem" }}
            >
              {i < paso ? <i className="bi bi-check-lg" /> : i + 1}
            </div>
            <span style={{ fontSize: "0.7rem", color: i === paso ? "#0d6efd" : "#94a3b8" }}>
              {label}
            </span>
          </div>
          {i < pasos.length - 1 && (
            <div className="flex-grow-1 mb-3" style={{ height: 2, background: i < paso ? "#198754" : "#e2e8f0" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
export default function RegistroPaciente() {
  const [params] = useSearchParams();
  const clinicaId = params.get("clinica_id") || "";

  const [paso,    setPaso]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [pacienteId, setPacienteId] = useState(null);

  // ── Foto (paso 1) ────────────────────────────────
  const [camActiva,    setCamActiva]    = useState(false);
  const [camStream,    setCamStream]    = useState(null);
  const [fotoBlob,     setFotoBlob]     = useState(null);
  const [fotoPreview,  setFotoPreview]  = useState(null);
  const [fotoSubiendo, setFotoSubiendo] = useState(false);
  const videoRef   = useRef();
  const canvasRef  = useRef();
  const fotoInput  = useRef();

  const abrirCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setCamStream(stream);
      setCamActiva(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch {
      setError("No se pudo acceder a la cámara. Usa 'Seleccionar imagen' en su lugar.");
    }
  };

  const cerrarCamara = useCallback(() => {
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    setCamStream(null);
    setCamActiva(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [camStream]);

  const tomarFoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      const file = new File([blob], "foto-perfil.jpg", { type: "image/jpeg" });
      setFotoBlob(file);
      setFotoPreview(URL.createObjectURL(blob));
      cerrarCamara();
    }, "image/jpeg", 0.9);
  };

  const seleccionarArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoBlob(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const subirFotoYAvanzar = async () => {
    if (!fotoBlob || !pacienteId) { setPaso(2); return; }
    setFotoSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("foto", fotoBlob);
      fd.append("clinica_id", clinicaId);
      await axios.post(`${BASE}/registro/${pacienteId}/foto`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch { /* no bloquear el flujo si falla la foto */ }
    setFotoSubiendo(false);
    setPaso(2);
  };

  // ── Paso 1: datos personales ─────────────────────────
  const [form, setForm] = useState({
    nombres: "", apellidos: "", dni: "",
    fecha_nacimiento: "", sexo: "",
    telefono: "", email: "",
    direccion: "", ciudad: "", pais: "Perú",
    grupo_sanguineo: "",
  });

  // ── Paso 2: documentos ───────────────────────────────
  // Checklist informativa — los docs los sube el personal desde PerfilPaciente
  const DOCS_CHECKLIST = [
    { icon: "bi-person-vcard",   label: "DNI / Carnet de identidad (original + copia)" },
    { icon: "bi-shield-plus",    label: "Tarjeta de seguro médico (si aplica)" },
    { icon: "bi-file-earmark",   label: "Exámenes o resultados previos relevantes" },
    { icon: "bi-heart-pulse",    label: "Información sobre alergias o medicamentos actuales" },
  ];

  const cambioForm = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));  const handlePaso1 = async (e) => {
    e.preventDefault();
    if (!clinicaId) return setError("Falta el parámetro clinica_id en la URL");
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${BASE}/registro`, { ...form, clinica_id: clinicaId });
      setPacienteId(res.data.id);
      setPaso(1);
    } catch (err) {
      setError(err?.response?.data?.msg || "Error al registrar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // ── PASO 2 y 3: Avanzar confirmación ────────────────────
  const avanzarConfirmacion = () => setPaso(3);

  // ════════════════ RENDER ════════════════════════════
  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: "#f1f5f9" }}>
      {/* Header */}
      <nav className="navbar navbar-dark bg-dark px-4" style={{ height: 56 }}>
        <span className="navbar-brand mb-0 fw-bold">
          <i className="bi bi-hospital-fill text-primary me-2" />
          Multi-Clínica
        </span>
        <Link to="/login" className="btn btn-outline-light btn-sm">
          <i className="bi bi-box-arrow-in-right me-1" />
          Acceder
        </Link>
      </nav>

      <div className="container py-5" style={{ maxWidth: 640 }}>
        <div className="text-center mb-4">
          <h3 className="fw-bold text-dark">Registro de paciente</h3>
          <p className="text-muted">Completa el formulario para crear tu ficha médica</p>
        </div>

        <div className="card shadow-sm border-0 rounded-4 p-4 p-md-5">
          <ProgressBar paso={paso} />

          {error && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2" role="alert">
              <i className="bi bi-exclamation-triangle-fill" />
              {error}
            </div>
          )}

          {/* ─── PASO 0: Datos personales ─────────────── */}
          {paso === 0 && (
            <form onSubmit={handlePaso1}>
              <div className="row g-3">
                <div className="col-sm-6">
                  <label className="form-label fw-semibold">Nombres <span className="text-danger">*</span></label>
                  <input className="form-control" name="nombres" value={form.nombres}
                    onChange={cambioForm} required placeholder="Ej. María Elena" />
                </div>
                <div className="col-sm-6">
                  <label className="form-label fw-semibold">Apellidos <span className="text-danger">*</span></label>
                  <input className="form-control" name="apellidos" value={form.apellidos}
                    onChange={cambioForm} required placeholder="Ej. García López" />
                </div>
                <div className="col-sm-6">
                  <label className="form-label fw-semibold">DNI / Documento</label>
                  <input className="form-control" name="dni" value={form.dni}
                    onChange={cambioForm} placeholder="Número de documento" />
                </div>
                <div className="col-sm-6">
                  <label className="form-label fw-semibold">Fecha de nacimiento</label>
                  <input className="form-control" type="date" name="fecha_nacimiento"
                    value={form.fecha_nacimiento} onChange={cambioForm} />
                </div>
                <div className="col-sm-6">
                  <label className="form-label fw-semibold">Sexo</label>
                  <select className="form-select" name="sexo" value={form.sexo} onChange={cambioForm}>
                    <option value="">— Seleccionar —</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </select>
                </div>
                <div className="col-sm-6">
                  <label className="form-label fw-semibold">Grupo sanguíneo</label>
                  <select className="form-select" name="grupo_sanguineo" value={form.grupo_sanguineo} onChange={cambioForm}>
                    <option value="">— Seleccionar —</option>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="col-sm-6">
                  <label className="form-label fw-semibold">Teléfono</label>
                  <input className="form-control" name="telefono" value={form.telefono}
                    onChange={cambioForm} placeholder="Ej. 987654321" />
                </div>
                <div className="col-sm-6">
                  <label className="form-label fw-semibold">Correo electrónico <span className="text-danger">*</span></label>
                  <input className="form-control" type="email" name="email" value={form.email}
                    onChange={cambioForm} required placeholder="tu@email.com" />
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold">Dirección</label>
                  <input className="form-control" name="direccion" value={form.direccion}
                    onChange={cambioForm} placeholder="Calle, número, referencia" />
                </div>
                <div className="col-sm-6">
                  <label className="form-label fw-semibold">Ciudad</label>
                  <input className="form-control" name="ciudad" value={form.ciudad}
                    onChange={cambioForm} placeholder="Ej. Lima" />
                </div>
                <div className="col-sm-6">
                  <label className="form-label fw-semibold">País</label>
                  <input className="form-control" name="pais" value={form.pais} onChange={cambioForm} />
                </div>
              </div>

              <div className="d-flex justify-content-end mt-4">
                <button className="btn btn-primary px-4" disabled={loading}>
                  {loading ? <><span className="spinner-border spinner-border-sm me-2" />Guardando...</> : <>Siguiente <i className="bi bi-arrow-right ms-1" /></>}
                </button>
              </div>
            </form>
          )}

          {/* ─── PASO 1: Foto ─────────────────────────── */}
          {paso === 1 && (
            <div className="text-center">
              <p className="text-muted mb-4">
                <i className="bi bi-camera-fill me-1 text-primary" />
                Toma o sube una foto tuya para que el personal pueda identificarte rápidamente.
                <span className="text-muted" style={{ fontSize: "0.8rem", display: "block" }}>Este paso es opcional, puedes omitirlo.</span>
              </p>

              {/* Preview */}
              {fotoPreview && (
                <div className="mb-3">
                  <img
                    src={fotoPreview}
                    alt="Tu foto"
                    className="rounded-circle border border-3 border-primary"
                    style={{ width: 160, height: 160, objectFit: "cover" }}
                  />
                </div>
              )}

              {/* Cámara en vivo */}
              {camActiva && (
                <div className="mb-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="rounded-3 border w-100"
                    style={{ maxHeight: 280, background: "#000", objectFit: "cover" }}
                  />
                  <canvas ref={canvasRef} className="d-none" />
                  <div className="d-flex gap-2 justify-content-center mt-2">
                    <button type="button" className="btn btn-success" onClick={tomarFoto}>
                      <i className="bi bi-camera me-1" />Capturar foto
                    </button>
                    <button type="button" className="btn btn-outline-secondary" onClick={cerrarCamara}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {!camActiva && <canvas ref={canvasRef} className="d-none" />}

              {/* Botones cuando cámara no está activa */}
              {!camActiva && (
                <div className="d-flex flex-column align-items-center gap-3 my-3">
                  <button type="button" className="btn btn-outline-primary px-4" onClick={abrirCamara}>
                    <i className="bi bi-camera me-2" />Usar cámara
                  </button>
                  <button type="button" className="btn btn-outline-secondary px-4" onClick={() => fotoInput.current?.click()}>
                    <i className="bi bi-image me-2" />Subir imagen
                  </button>
                  <input ref={fotoInput} type="file" accept="image/*" className="d-none" onChange={seleccionarArchivo} />
                </div>
              )}

              <div className="d-flex justify-content-between mt-4">
                <button type="button" className="btn btn-link text-muted" onClick={() => setPaso(2)}>
                  Omitir este paso
                </button>
                <button
                  type="button"
                  className="btn btn-primary px-4"
                  onClick={subirFotoYAvanzar}
                  disabled={fotoSubiendo}
                >
                  {fotoSubiendo
                    ? <><span className="spinner-border spinner-border-sm me-2" />Subiendo...</>
                    : <>Continuar <i className="bi bi-arrow-right ms-1" /></>}
                </button>
              </div>
            </div>
          )}

          {/* ─── PASO 2: Documentos ─────────────────────── */}
          {paso === 2 && (
            <div>
              <p className="text-muted mb-4">
                <i className="bi bi-info-circle me-1 text-primary" />
                El personal de la clínica cargará tus documentos durante tu primera visita.
                Prepara los siguientes documentos:
              </p>

              <ul className="list-unstyled d-flex flex-column gap-3 mb-4">
                {DOCS_CHECKLIST.map((item, i) => (
                  <li key={i} className="d-flex align-items-center gap-3 bg-light rounded-3 p-3">
                    <div
                      className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: 40, height: 40 }}
                    >
                      <i className={`bi ${item.icon} text-primary`} />
                    </div>
                    <span style={{ fontSize: "0.9rem" }}>{item.label}</span>
                  </li>
                ))}
              </ul>

              <div className="alert alert-info d-flex gap-2 align-items-start" style={{ fontSize: "0.85rem" }}>
                <i className="bi bi-shield-check-fill mt-1 flex-shrink-0 text-info" />
                <div>
                  Tus documentos serán almacenados de forma <strong>segura y confidencial</strong>,
                  y sólo accederá el personal médico autorizado de la clínica.
                </div>
              </div>

              <div className="d-flex justify-content-end mt-2">
                <button className="btn btn-primary px-4" onClick={avanzarConfirmacion}>
                  Entendido — Continuar <i className="bi bi-arrow-right ms-1" />
                </button>
              </div>
            </div>
          )}

          {/* ─── PASO 3: Confirmación ───────────────────── */}
          {paso === 3 && (
            <div className="text-center py-3">
              <div
                className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-4"
                style={{ width: 80, height: 80 }}
              >
                <i className="bi bi-envelope-check-fill text-success" style={{ fontSize: "2.2rem" }} />
              </div>
              <h5 className="fw-bold text-dark mb-2">¡Registro recibido!</h5>
              <p className="text-muted mb-4">
                Te enviamos un correo a <strong>{form.email}</strong>.
                Haz clic en el enlace para <strong>verificar tu cuenta</strong> y activar tu ficha.
              </p>
              <div className="alert alert-info d-flex align-items-start gap-2 text-start" style={{ fontSize: "0.875rem" }}>
                <i className="bi bi-lightbulb-fill mt-1 flex-shrink-0" />
                <div>
                  Si no encuentras el correo, revisa la carpeta de <strong>spam o promociones</strong>.
                  El enlace de verificación expira en <strong>24 horas</strong>.
                </div>
              </div>

              <div className="d-flex flex-column gap-2 mt-3">
                <Link to="/login" className="btn btn-primary">
                  <i className="bi bi-box-arrow-in-right me-2" />
                  Ir al portal de pacientes
                </Link>
                <button
                  className="btn btn-link text-muted"
                  onClick={async () => {
                    try {
                      await axios.post(`${BASE}/registro/reenviar`, { email: form.email, clinica_id: clinicaId });
                      alert("Email reenviado correctamente");
                    } catch {}
                  }}
                >
                  <i className="bi bi-arrow-repeat me-1" />
                  Reenviar email de verificación
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-muted mt-4" style={{ fontSize: "0.78rem" }}>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-primary">Inicia sesión aquí</Link>
        </p>
      </div>
    </div>
  );
}
