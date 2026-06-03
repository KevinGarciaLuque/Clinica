import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mammoth from "mammoth/mammoth.browser";

const STORAGE_KEY = "documentos_clinicos_archivos";

const CATEGORIAS = [
  { value: "formato", label: "Formato" },
  { value: "consentimiento", label: "Consentimiento" },
  { value: "constancia", label: "Constancia" },
  { value: "informe", label: "Informe" },
  { value: "otro", label: "Otro" },
];

const CATEGORIAS_CON_TODOS = [
  { value: "todos", label: "Todos" },
  ...CATEGORIAS,
];

const categoryLabel = (value) =>
  CATEGORIAS_CON_TODOS.find((cat) => cat.value === value)?.label || "Otro";

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
};

const extensionOf = (name = "") => {
  const ext = name.split(".").pop();
  return ext && ext !== name ? ext.toUpperCase() : "DOC";
};

const iconFor = (type = "", name = "") => {
  const lower = `${type} ${name}`.toLowerCase();
  if (lower.includes("pdf")) return "bi-file-earmark-pdf-fill";
  if (lower.includes("word") || lower.includes("doc")) return "bi-file-earmark-word-fill";
  if (lower.includes("excel") || lower.includes("sheet") || lower.includes("xls")) return "bi-file-earmark-excel-fill";
  if (lower.includes("image") || lower.includes("png") || lower.includes("jpg") || lower.includes("jpeg")) return "bi-file-earmark-image-fill";
  return "bi-file-earmark-arrow-down-fill";
};

const canPreview = (doc) => {
  const lower = `${doc?.tipo || ""} ${doc?.nombre || ""}`.toLowerCase();
  return lower.includes("pdf") || lower.includes("image") || lower.includes("png") || lower.includes("jpg") || lower.includes("jpeg") || lower.includes("txt") || lower.includes("text");
};

const isDocx = (doc) => (doc?.nombre || "").toLowerCase().endsWith(".docx");

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function DocumentosClinicos() {
  const fileInputRef = useRef(null);
  const [documentos, setDocumentos] = useState([]);
  const [uploadCategoria, setUploadCategoria] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [msg, setMsg] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [deleteDoc, setDeleteDoc] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setDocumentos(raw ? JSON.parse(raw) : []);
    } catch {
      setDocumentos([]);
    }
  }, []);

  useEffect(() => {
    const renderDocx = async () => {
      if (!previewDoc || !isDocx(previewDoc)) {
        setPreviewHtml("");
        setPreviewError("");
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);
      setPreviewError("");
      try {
        const arrayBuffer = await fetch(previewDoc.dataUrl).then((res) => res.arrayBuffer());
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setPreviewHtml(result.value || "<p>Documento sin contenido para mostrar.</p>");
      } catch {
        setPreviewError("No se pudo generar la vista previa del Word.");
        setPreviewHtml("");
      } finally {
        setPreviewLoading(false);
      }
    };

    renderDocx();
  }, [previewDoc]);

  const persist = (next) => {
    setDocumentos(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const flash = (texto) => {
    setMsg(texto);
    setTimeout(() => setMsg(""), 2200);
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      const nuevos = await Promise.all(files.map(async (file) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        nombre: file.name,
        categoria: uploadCategoria,
        tipo: file.type || "application/octet-stream",
        tamano: file.size,
        creadoEn: new Date().toISOString(),
        dataUrl: await fileToDataUrl(file),
      })));
      persist([...nuevos, ...documentos]);
      flash(`${nuevos.length} documento(s) guardado(s).`);
    } catch {
      flash("No se pudo guardar el documento.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const descargar = (doc) => {
    const a = document.createElement("a");
    a.href = doc.dataUrl;
    a.download = doc.nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const confirmarEliminar = () => {
    if (!deleteDoc) return;
    persist(documentos.filter((doc) => doc.id !== deleteDoc.id));
    setDeleteDoc(null);
    flash("Documento eliminado.");
  };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return documentos.filter((doc) => {
      const coincideTexto = !q || doc.nombre.toLowerCase().includes(q);
      const coincideCategoria = filtroCategoria === "todos" || doc.categoria === filtroCategoria;
      return coincideTexto && coincideCategoria;
    });
  }, [documentos, busqueda, filtroCategoria]);

  const totalMb = useMemo(
    () => formatBytes(documentos.reduce((acc, doc) => acc + Number(doc.tamano || 0), 0)),
    [documentos]
  );

  return (
    <div className="doc-clinicos-page">
      <style>{`
        .doc-clinicos-page {
          background: #eef3f9;
          min-height: 100vh;
          margin: -1.5rem;
          width: calc(100% + 3rem);
          padding: 20px 24px;
        }
        .doc-clinicos-header {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 16px;
        }
        .doc-clinicos-layout {
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr);
          gap: 16px;
        }
        .doc-clinicos-panel {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(15,23,42,.06);
          border: 1px solid #dbe4ef;
        }
        .doc-clinicos-uploader {
          padding: 16px;
          align-self: start;
        }
        .doc-clinicos-list-panel {
          overflow: hidden;
          min-width: 0;
        }
        .doc-clinicos-toolbar {
          padding: 14px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          gap: 10px;
          align-items: center;
          background: #f8fafc;
        }
        .doc-clinicos-search {
          position: relative;
          flex: 1;
          min-width: 180px;
        }
        .doc-clinicos-filter {
          max-width: 210px;
        }
        .doc-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          min-width: 0;
        }
        .doc-card-info {
          min-width: 0;
          flex: 1;
        }
        .doc-card-actions {
          display: flex;
          gap: 8px;
          flex: 0 0 auto;
        }
        .doc-preview-frame {
          width: 100%;
          height: min(520px, 70vh);
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
        }
        .doc-preview-body {
          background: #f8fafc;
          min-height: min(520px, 70vh);
        }
        @media (max-width: 1100px) {
          .doc-clinicos-layout {
            grid-template-columns: 280px minmax(0, 1fr);
          }
          .doc-card {
            align-items: flex-start;
          }
          .doc-card-actions {
            flex-direction: column;
          }
        }
        @media (max-width: 900px) {
          .doc-clinicos-page {
            padding: 16px;
          }
          .doc-clinicos-layout {
            grid-template-columns: 1fr;
          }
          .doc-clinicos-uploader {
            align-self: stretch;
          }
          .doc-clinicos-toolbar {
            flex-wrap: wrap;
          }
          .doc-clinicos-filter {
            max-width: none;
            width: 100%;
          }
        }
        @media (max-width: 640px) {
          .doc-clinicos-page {
            margin: -1rem;
            width: calc(100% + 2rem);
            padding: 12px;
          }
          .doc-clinicos-header {
            align-items: flex-start;
            gap: 10px;
          }
          .doc-clinicos-header-icon {
            width: 34px !important;
            height: 34px !important;
          }
          .doc-clinicos-toast {
            width: 100%;
            display: block;
            margin-top: 8px;
          }
          .doc-card {
            display: grid;
            grid-template-columns: 42px minmax(0, 1fr);
            align-items: start;
          }
          .doc-card-actions {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr 1fr 42px;
            width: 100%;
          }
          .doc-card-actions .btn {
            width: 100%;
            white-space: nowrap;
          }
          .doc-preview-body {
            padding: 10px !important;
          }
          .doc-preview-frame {
            height: 68vh;
          }
          .modal-dialog {
            margin: 10px;
          }
        }
      `}</style>

      <div className="doc-clinicos-header">
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "#0f3d7a", color: "#fff", display: "grid", placeItems: "center" }}>
          <i className="bi bi-folder2-open" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>Documentos Clinicos</div>
          <div style={{ fontSize: ".83rem", color: "#64748b" }}>Guarda archivos para descargarlos, modificarlos e imprimirlos fuera del sistema</div>
        </div>
        {msg && <span className="doc-clinicos-toast" style={{ fontSize: ".8rem", color: "#166534", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "6px 10px" }}>{msg}</span>}
      </div>

      <div className="doc-clinicos-layout">
        <div className="doc-clinicos-panel doc-clinicos-uploader">
          <div style={{ fontWeight: 700, marginBottom: 12, color: "#0f172a", fontSize: ".95rem" }}>Guardar documento</div>

          <label className="form-label" style={{ fontSize: ".8rem", fontWeight: 600 }}>Categoria</label>
          <select className="form-select mb-3" value={uploadCategoria} onChange={(e) => setUploadCategoria(e.target.value)}>
            {CATEGORIAS_CON_TODOS.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
          </select>

          <label htmlFor="documentos-clinicos-file" className="btn btn-primary w-100 mb-0">
            <i className="bi bi-upload me-1" />
            Subir documentos
          </label>
          <input
            id="documentos-clinicos-file"
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.heic,.txt,image/*,application/pdf"
            onChange={handleFiles}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />

          <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".82rem", color: "#475569", marginBottom: 6 }}>
              <span>Documentos</span>
              <strong>{documentos.length}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".82rem", color: "#475569" }}>
              <span>Almacenado</span>
              <strong>{totalMb}</strong>
            </div>
          </div>

          <small style={{ color: "#64748b", fontSize: ".74rem", display: "block", marginTop: 10 }}>
            Los archivos se guardan en este navegador. Para editar o imprimir, descargalos y abre el archivo en Word, Excel, PDF u otra app.
          </small>
        </div>

        <div className="doc-clinicos-panel doc-clinicos-list-panel">
          <div className="doc-clinicos-toolbar">
            <div className="doc-clinicos-search">
              <i className="bi bi-search" style={{ position: "absolute", left: 12, top: 9, color: "#64748b" }} />
              <input
                className="form-control"
                style={{ paddingLeft: 36 }}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar documento..."
              />
            </div>
            <select className="form-select doc-clinicos-filter" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              {CATEGORIAS_CON_TODOS.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
            </select>
          </div>

          <div style={{ padding: 14 }}>
            {filtrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "58px 16px", color: "#64748b" }}>
                <i className="bi bi-folder2-open" style={{ fontSize: 42, opacity: .35 }} />
                <div style={{ marginTop: 12, fontWeight: 700, color: "#334155" }}>Sin documentos guardados</div>
                <div style={{ fontSize: ".84rem" }}>Sube archivos para que el doctor pueda descargarlos cuando los necesite.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filtrados.map((doc) => (
                  <div key={doc.id} className="doc-card">
                    <div style={{ width: 42, height: 42, borderRadius: 8, background: "#eff6ff", color: "#1d4ed8", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <i className={`bi ${iconFor(doc.tipo, doc.nombre)}`} style={{ fontSize: 20 }} />
                    </div>
                    <div className="doc-card-info">
                      <div style={{ fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.nombre}</div>
                      <div style={{ fontSize: ".78rem", color: "#64748b", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span>{categoryLabel(doc.categoria)}</span>
                        <span>{extensionOf(doc.nombre)}</span>
                        <span>{formatBytes(doc.tamano)}</span>
                        <span>{new Date(doc.creadoEn).toLocaleDateString("es-HN")}</span>
                      </div>
                    </div>
                    <div className="doc-card-actions">
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPreviewDoc(doc)}>
                        <i className="bi bi-eye me-1" />
                        Vista previa
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => descargar(doc)}>
                        <i className="bi bi-download me-1" />
                        Descargar
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleteDoc(doc)} title="Eliminar">
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {previewDoc && createPortal(
        <div className="modal d-block" style={{ background: "rgba(15,23,42,.55)", zIndex: 9999, overflowY: "auto" }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content" style={{ border: "none", borderRadius: 12, overflow: "hidden" }}>
              <div className="modal-header" style={{ background: "#0f3d7a", color: "#fff" }}>
                <div>
                  <h5 className="modal-title mb-0">
                    <i className="bi bi-eye me-2" />
                    Vista previa
                  </h5>
                  <div style={{ fontSize: ".78rem", opacity: .8 }}>{previewDoc.nombre}</div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setPreviewDoc(null)} />
              </div>
              <div className="modal-body doc-preview-body">
                {isDocx(previewDoc) ? (
                  previewLoading ? (
                    <div style={{ display: "grid", placeItems: "center", minHeight: "min(500px, 68vh)", color: "#64748b" }}>
                      <div className="text-center">
                        <div className="spinner-border text-primary mb-3" />
                        <div style={{ fontWeight: 700, color: "#334155" }}>Generando vista previa</div>
                      </div>
                    </div>
                  ) : previewError ? (
                    <div style={{ display: "grid", placeItems: "center", minHeight: "min(500px, 68vh)", textAlign: "center", color: "#64748b" }}>
                      <div>
                        <i className="bi bi-file-earmark-word-fill" style={{ fontSize: 52, opacity: .45 }} />
                        <div style={{ marginTop: 12, fontWeight: 700, color: "#334155" }}>{previewError}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="doc-preview-frame" style={{ overflow: "auto", padding: 24 }}>
                      <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </div>
                  )
                ) : canPreview(previewDoc) ? (
                  previewDoc.tipo?.startsWith("image/") ? (
                    <div style={{ display: "grid", placeItems: "center", minHeight: "min(500px, 68vh)" }}>
                      <img src={previewDoc.dataUrl} alt={previewDoc.nombre} style={{ maxWidth: "100%", maxHeight: "68vh", objectFit: "contain", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }} />
                    </div>
                  ) : (
                    <iframe title={previewDoc.nombre} src={previewDoc.dataUrl} className="doc-preview-frame" />
                  )
                ) : (
                  <div style={{ display: "grid", placeItems: "center", minHeight: "min(500px, 68vh)", textAlign: "center", color: "#64748b" }}>
                    <div>
                      <i className={`bi ${iconFor(previewDoc.tipo, previewDoc.nombre)}`} style={{ fontSize: 52, opacity: .45 }} />
                      <div style={{ marginTop: 12, fontWeight: 700, color: "#334155" }}>Vista previa no disponible</div>
                      <div style={{ fontSize: ".88rem", marginTop: 4 }}>Este tipo de archivo se debe abrir en su aplicación correspondiente.</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ background: "#fff" }}>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setPreviewDoc(null)}>Cerrar</button>
                <button type="button" className="btn btn-primary" onClick={() => descargar(previewDoc)}>
                  <i className="bi bi-download me-1" />
                  Descargar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteDoc && createPortal(
        <div className="modal d-block" style={{ background: "rgba(15,23,42,.55)", zIndex: 9999, overflowY: "auto" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ border: "none", borderRadius: 12, overflow: "hidden" }}>
              <div className="modal-header" style={{ background: "#dc2626", color: "#fff" }}>
                <h5 className="modal-title mb-0">
                  <i className="bi bi-trash me-2" />
                  Eliminar documento
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setDeleteDoc(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-2">Esta acción eliminará el documento guardado.</p>
                <div style={{ padding: 10, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontWeight: 700, color: "#0f172a" }}>
                  {deleteDoc.nombre}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setDeleteDoc(null)}>Cancelar</button>
                <button type="button" className="btn btn-danger" onClick={confirmarEliminar}>
                  <i className="bi bi-trash me-1" />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
