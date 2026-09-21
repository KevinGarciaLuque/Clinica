import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../api/api";

// ══════════════════════════════════════════════════════════════════════
// TAB: Documentos de la consulta
// ══════════════════════════════════════════════════════════════════════
const TIPOS_DOC = [
  { value: "imagen",       label: "Imagen / Foto" },
  { value: "laboratorio",  label: "Laboratorio" },
  { value: "radiografia",  label: "Radiografía" },
  { value: "resultado",    label: "Resultado" },
  { value: "receta",       label: "Receta externa" },
  { value: "consentimiento", label: "Consentimiento" },
  { value: "otro",         label: "Otro" },
];

export default function DocumentosTab({ historiaId, pacienteId, firmada, onAutoSave }) {
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tipo, setTipo]         = useState("imagen");
  const [alert, setAlert]       = useState(null);
  const [preview, setPreview]   = useState(null);
  const fileRef                 = useRef(null);
  const cameraRef               = useRef(null);

  const cargar = useCallback(() => {
    if (!pacienteId) return;
    const params = {};
    if (historiaId) params.historia_id = historiaId;
    api.get(`/pacientes/${pacienteId}/documentos`, { params })
      .then(r => setDocs(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pacienteId, historiaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const subirArchivo = async (file) => {
    if (!file) return;
    setUploading(true);
    setAlert(null);
    try {
      let hId = historiaId;
      if (!hId) {
        setAlert({ t: "warning", m: "Guardando consulta como borrador…" });
        hId = await onAutoSave();
        if (!hId) {
          setAlert({ t: "danger", m: "No se pudo guardar la consulta. Intenta de nuevo." });
          setUploading(false);
          return;
        }
        setAlert(null);
      }
      const fd = new FormData();
      fd.append("archivo", file);
      fd.append("tipo", tipo);
      fd.append("historia_id", hId);
      await api.post(`/pacientes/${pacienteId}/documentos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAlert({ t: "success", m: "Documento subido correctamente" });
      cargar();
    } catch (e) {
      setAlert({ t: "danger", m: e.response?.data?.msg || "Error al subir" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar este documento?")) return;
    try {
      await api.delete(`/pacientes/${pacienteId}/documentos/${id}`);
      setDocs(d => d.filter(x => x.id !== id));
    } catch { setAlert({ t: "danger", m: "Error al eliminar" }); }
  };

  const iconDoc = (mime) => {
    if (!mime) return "bi-file-earmark";
    if (mime.startsWith("image/")) return "bi-file-image";
    if (mime === "application/pdf") return "bi-file-earmark-pdf";
    return "bi-file-earmark";
  };

  const fmtSize = (b) => b ? (b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`) : "";

  return (
    <div>
      {alert && (
        <div style={{
          marginBottom: 14, padding: "9px 14px", borderRadius: 8, fontSize: "0.85rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: alert.t === "success" ? "#dcfce7" : alert.t === "warning" ? "#fef9c3" : "#fee2e2",
          color: alert.t === "success" ? "#166534" : alert.t === "warning" ? "#854d0e" : "#991b1b",
          border: `1px solid ${alert.t === "success" ? "#bbf7d0" : alert.t === "warning" ? "#fde68a" : "#fecaca"}`,
        }}>
          <span>{alert.m}</span>
          <button onClick={() => setAlert(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>
      )}

      {/* Upload panel */}
      {!firmada && (
        <div style={{
          background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 12,
          padding: "16px 20px", marginBottom: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#374151", marginBottom: 10 }}>
            <i className="bi bi-cloud-upload me-2 text-primary"></i>
            Agregar documento a esta consulta
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                style={{ border: "1px solid #d1d5db", borderRadius: 7, padding: "6px 10px", fontSize: "0.83rem" }}>
                {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {/* Archivo desde disco */}
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Archivo</label>
              <input ref={fileRef} type="file" accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={e => subirArchivo(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{
                  background: "#2563eb", border: "none", borderRadius: 8,
                  color: "#fff", padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <i className="bi bi-upload"></i> Subir archivo
              </button>
            </div>
            {/* Cámara (móvil) */}
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Cámara</label>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                style={{ display: "none" }}
                onChange={e => subirArchivo(e.target.files[0])} />
              <button onClick={() => cameraRef.current?.click()} disabled={uploading}
                style={{
                  background: "#0ea5e9", border: "none", borderRadius: 8,
                  color: "#fff", padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <i className="bi bi-camera"></i> Tomar foto
              </button>
            </div>
            {uploading && <span style={{ fontSize: "0.82rem", color: "#6b7280" }}>Subiendo…</span>}
          </div>
          {!historiaId && (
            <div style={{ marginTop: 8, fontSize: "0.78rem", color: "#9ca3af" }}>
              <i className="bi bi-info-circle me-1"></i>
              Al subir un archivo se guardará automáticamente como Borrador.
            </div>
          )}
        </div>
      )}

      {/* Lista de documentos */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>Cargando…</div>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
          <i className="bi bi-paperclip" style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: 0.3 }}></i>
          No hay documentos en esta consulta.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {docs.map(d => {
            const esImagen = d.mime_type?.startsWith("image/");
            return (
              <div key={d.id} style={{
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
                overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.05)",
              }}>
                {/* Preview */}
                <div onClick={() => setPreview(d)} style={{
                  height: 110, background: "#f1f5f9", display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", overflow: "hidden",
                }}>
                  {esImagen
                    ? <img src={d.ruta_archivo} alt={d.nombre_original}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <i className={`bi ${iconDoc(d.mime_type)}`}
                        style={{ fontSize: "2.5rem", color: "#94a3b8" }}></i>
                  }
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#111827", marginBottom: 2,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.nombre_original}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{fmtSize(d.tamano_bytes)}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <a href={d.ruta_archivo} target="_blank" rel="noreferrer" title="Abrir"
                        style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 5,
                          color: "#2563eb", padding: "2px 7px", fontSize: "0.72rem", textDecoration: "none" }}>
                        <i className="bi bi-box-arrow-up-right"></i>
                      </a>
                      {!firmada && (
                        <button onClick={() => eliminar(d.id)} title="Eliminar"
                          style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 5,
                            color: "#e11d48", padding: "2px 7px", fontSize: "0.72rem", cursor: "pointer" }}>
                          <i className="bi bi-trash3"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox imagen */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          {(() => {
            const token = localStorage.getItem("token") || "";
            const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
            const viewUrl = `${apiBase}/api/pacientes/${pacienteId}/documentos/${preview.id}/view?auth_token=${token}`;
            return preview.mime_type?.startsWith("image/")
              ? <img src={preview.ruta_archivo} alt={preview.nombre_original}
                  style={{ maxWidth: "90vw", maxHeight: "88vh", borderRadius: 8, boxShadow: "0 4px 32px rgba(0,0,0,.5)" }}
                  onClick={e => e.stopPropagation()} />
              : <a href={viewUrl} target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ background: "#fff", borderRadius: 12, padding: "32px 48px", fontSize: "1rem",
                    color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
                  <i className="bi bi-file-earmark-pdf me-2"></i>Abrir PDF
                </a>;
          })()}
          <button onClick={() => setPreview(null)} style={{
            position: "absolute", top: 16, right: 20, background: "rgba(255,255,255,.15)",
            border: "none", color: "#fff", fontSize: "1.6rem", cursor: "pointer", borderRadius: 6, lineHeight: 1,
          }}>×</button>
        </div>
      )}
    </div>
  );
}
