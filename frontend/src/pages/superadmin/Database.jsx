import { useState, useEffect, useRef } from "react";
import api from "../../api/api";

/* ── Paleta compartida ── */
const C = {
  accent:  "#2196f3",
  accentH: "#1565c0",
  success: "#10b981",
  danger:  "#ef4444",
  warn:    "#f59e0b",
  bg:      "#f1f5f9",
  card:    "#ffffff",
  dark:    "#0d1b2e",
};

/* ── Helpers ── */
function fmtSize(kb) {
  if (kb === null || kb === undefined) return "—";
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function StatusBadge({ status }) {
  const map = {
    success: { bg: "#ecfdf5", color: C.success, icon: "bi-check-circle-fill", label: "Correcto" },
    error:   { bg: "#fef2f2", color: C.danger,  icon: "bi-x-circle-fill",     label: "Error" },
    loading: { bg: "#eff6ff", color: C.accent,  icon: "bi-hourglass-split",   label: "Procesando…" },
  };
  const s = map[status] ?? map.loading;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: s.bg, color: s.color,
      fontSize: "0.78rem", fontWeight: 600,
    }}>
      <i className={`bi ${s.icon}`} />
      {s.label}
    </span>
  );
}

export default function Database() {
  const [info,        setInfo]        = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [errInfo,     setErrInfo]     = useState(null);

  const [exporting,   setExporting]   = useState(false);
  const [exportErr,   setExportErr]   = useState(null);

  const [importFile,  setImportFile]  = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [importMsg,   setImportMsg]   = useState(null); // { type, text }
  const [dragOver,    setDragOver]    = useState(false);
  const fileRef = useRef();

  const [confirmOpen, setConfirmOpen] = useState(false);

  // Switch tablas
  const [showTables, setShowTables] = useState(false);

  // Vaciar BD
  const [truncateOpen,   setTruncateOpen]   = useState(false);
  const [truncateConfirm,setTruncateConfirm] = useState("");
  const [truncating,     setTruncating]     = useState(false);
  const [truncateMsg,    setTruncateMsg]    = useState(null); // { type, text }

  /* ── Cargar info ── */
  const loadInfo = async () => {
    setLoadingInfo(true);
    setErrInfo(null);
    try {
      const { data } = await api.get("/database/info");
      setInfo(data.data);
    } catch (e) {
      setErrInfo(e.response?.data?.msg || "No se pudo obtener la información de la base de datos.");
    } finally {
      setLoadingInfo(false);
    }
  };

  useEffect(() => { loadInfo(); }, []);

  /* ── Exportar ── */
  const handleExport = async () => {
    setExporting(true);
    setExportErr(null);
    try {
      const resp = await api.get("/database/export", { responseType: "blob" });
      const disposition = resp.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fname = match ? match[1] : `backup_${Date.now()}.sql`;
      const url = URL.createObjectURL(new Blob([resp.data], { type: "application/sql" }));
      const a = document.createElement("a");
      a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportErr(e.response?.data?.msg || "Error al exportar la base de datos.");
    } finally {
      setExporting(false);
    }
  };

  /* ── Importar ── */
  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportMsg(null);
    const form = new FormData();
    form.append("sql_file", importFile);
    try {
      const { data } = await api.post("/database/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportMsg({ type: "success", text: data.msg || "Importación completada." });
      setImportFile(null);
      loadInfo(); // refrescar estadísticas
    } catch (e) {
      setImportMsg({ type: "error", text: e.response?.data?.msg || "Error en la importación." });
    } finally {
      setImporting(false);
      setConfirmOpen(false);
    }
  };

  /* ── Drag & Drop ── */
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".sql")) { setImportFile(file); setImportMsg(null); }
  };

  /* ── Vaciar BD ── */
  const handleTruncate = async () => {
    if (truncateConfirm !== "VACIAR") return;
    setTruncating(true);
    setTruncateMsg(null);
    try {
      const { data } = await api.post("/database/truncate");
      setTruncateMsg({ type: "success", text: data.msg });
      setTruncateOpen(false);
      setTruncateConfirm("");
      loadInfo();
    } catch (e) {
      setTruncateMsg({ type: "error", text: e.response?.data?.msg || "Error al vaciar la base de datos." });
      setTruncateOpen(false);
    } finally {
      setTruncating(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* ════════ HEADER ════════ */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-1" style={{ color: C.dark }}>
            <i className="bi bi-database-fill-gear me-2" style={{ color: C.accent }} />
            Gestión de Base de Datos
          </h4>
          <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
            Exporta e importa el esquema completo de la base de datos en formato SQL.
          </p>
        </div>
        <button
          className="btn btn-sm"
          onClick={loadInfo}
          disabled={loadingInfo}
          style={{ background: "#eff6ff", color: C.accent, border: `1px solid #bfdbfe`, fontWeight: 600, fontSize: "0.8rem" }}
        >
          <i className={`bi ${loadingInfo ? "bi-arrow-clockwise spin" : "bi-arrow-clockwise"} me-1`} />
          Actualizar
        </button>
      </div>

      <style>{`
        .spin { animation: spin 0.9s linear infinite; display:inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .db-stat-card { background:#fff; border-radius:12px; border:1px solid #e2e8f0; padding:18px 20px; }
        .db-table-row:hover { background:#f8fafc; }
        .drop-zone { border: 2px dashed #bfdbfe; border-radius:12px; padding:32px 20px;
          text-align:center; cursor:pointer; transition:background 0.15s, border-color 0.15s; }
        .drop-zone.over { border-color: ${C.accent}; background: #eff6ff; }
        .drop-zone:hover { border-color: ${C.accent}; background: #f8faff; }
        .progress-bar-anim { width:100%; height:6px; border-radius:3px; overflow:hidden; background:#e2e8f0; margin-top:14px; }
        .progress-bar-inner { height:100%; background: linear-gradient(90deg,${C.accent},#60a5fa,${C.accent});
          background-size:200% 100%; animation:progress-slide 1.4s linear infinite; width:60%; border-radius:3px; }
        @keyframes progress-slide { 0%{background-position:0%} 100%{background-position:200%} }
      `}</style>

      {/* ════════ STATS ════════ */}
      {loadingInfo && (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-hourglass-split me-2 spin" style={{ color: C.accent }} />
          Cargando información de la base de datos…
        </div>
      )}

      {errInfo && (
        <div className="alert d-flex align-items-center gap-2" style={{ background:"#fef2f2", border:`1px solid #fecaca`, color:C.danger, borderRadius:10 }}>
          <i className="bi bi-exclamation-triangle-fill" />
          <span style={{ fontSize:"0.87rem" }}>{errInfo}</span>
        </div>
      )}

      {info && !loadingInfo && (
        <>
          {/* Cards de resumen */}
          <div className="row g-3 mb-4">
            {[
              { icon:"bi-hdd-fill",        label:"Base de datos",    value: info.database,           color: C.accent  },
              { icon:"bi-server",          label:"MySQL",            value: info.mysql_version,      color:"#7c3aed"  },
              { icon:"bi-table",           label:"Tablas",           value: info.tables.length,      color: C.success },
              { icon:"bi-device-hdd-fill", label:"Tamaño total",     value: fmtSize(info.total_size_kb), color: C.warn },
            ].map((s) => (
              <div key={s.label} className="col-6 col-md-3">
                <div className="db-stat-card d-flex align-items-center gap-3">
                  <div style={{
                    width:44, height:44, borderRadius:10,
                    background:`${s.color}18`,
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                  }}>
                    <i className={`bi ${s.icon}`} style={{ color:s.color, fontSize:"1.25rem" }} />
                  </div>
                  <div>
                    <div style={{ fontSize:"0.68rem", color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize:"1rem", fontWeight:700, color:C.dark }}>
                      {s.value}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tabla de tablas con switch */}
          <div className="db-stat-card mb-4">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-list-ul" style={{ color:C.accent, fontSize:"1.1rem" }} />
                <h6 className="mb-0 fw-bold" style={{ color:C.dark }}>Tablas de la base de datos</h6>
                <span style={{ fontSize:"0.72rem", color:"#94a3b8", fontWeight:500 }}>
                  ({info.tables.length} tablas)
                </span>
              </div>
              {/* Toggle switch */}
              <label style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", userSelect:"none" }}>
                <span style={{ fontSize:"0.75rem", color:"#64748b", fontWeight:500 }}>
                  {showTables ? "Ocultar" : "Ver tablas"}
                </span>
                <div
                  onClick={() => setShowTables(v => !v)}
                  style={{
                    width:40, height:22, borderRadius:11,
                    background: showTables ? C.accent : "#cbd5e1",
                    position:"relative", transition:"background 0.2s", cursor:"pointer",
                    flexShrink:0,
                  }}
                >
                  <div style={{
                    position:"absolute", top:2,
                    left: showTables ? 20 : 2,
                    width:18, height:18, borderRadius:"50%",
                    background:"#fff",
                    boxShadow:"0 1px 4px rgba(0,0,0,0.18)",
                    transition:"left 0.2s",
                  }} />
                </div>
              </label>
            </div>

            {showTables && (
              <div style={{ marginTop:14, overflowX:"auto" }}>
                <table className="table table-sm mb-0" style={{ fontSize:"0.83rem", minWidth:480 }}>
                  <thead>
                    <tr style={{ borderBottom:`2px solid #e2e8f0` }}>
                      <th style={{ color:"#64748b", fontWeight:600, paddingBottom:8 }}>#</th>
                      <th style={{ color:"#64748b", fontWeight:600 }}>Tabla</th>
                      <th style={{ color:"#64748b", fontWeight:600 }} className="text-end">Filas aprox.</th>
                      <th style={{ color:"#64748b", fontWeight:600 }} className="text-end">Tamaño</th>
                      <th style={{ color:"#64748b", fontWeight:600 }} className="text-end d-none d-md-table-cell">Creada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.tables.map((t, i) => (
                      <tr key={t.name} className="db-table-row" style={{ borderBottom:"1px solid #f1f5f9" }}>
                        <td style={{ color:"#94a3b8", paddingTop:8 }}>{i + 1}</td>
                        <td style={{ fontWeight:600, color:C.dark, paddingTop:8 }}>
                          <i className="bi bi-table me-1" style={{ color:C.accent, fontSize:"0.75rem" }} />
                          {t.name}
                        </td>
                        <td className="text-end" style={{ paddingTop:8 }}>{Number(t.rows_approx ?? 0).toLocaleString()}</td>
                        <td className="text-end" style={{ paddingTop:8 }}>{fmtSize(t.size_kb)}</td>
                        <td className="text-end d-none d-md-table-cell" style={{ paddingTop:8, color:"#94a3b8" }}>
                          {t.created_at ? new Date(t.created_at).toLocaleDateString("es-PE") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════ EXPORT / IMPORT / VACIAR ════════ */}
      <div className="row g-4">

        {/* ── Exportar ── */}
        <div className="col-md-6">
          <div className="db-stat-card h-100">
            <div className="d-flex align-items-center gap-2 mb-1">
              <div style={{ width:38, height:38, borderRadius:9, background:`${C.accent}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <i className="bi bi-cloud-download-fill" style={{ color:C.accent, fontSize:"1.1rem" }} />
              </div>
              <div>
                <h6 className="mb-0 fw-bold" style={{ color:C.dark }}>Exportar base de datos</h6>
                <p className="mb-0 text-muted" style={{ fontSize:"0.73rem" }}>Descarga un volcado completo en .sql</p>
              </div>
            </div>

            <hr style={{ borderColor:"#f1f5f9", margin:"14px 0" }} />

            <ul style={{ paddingLeft:16, color:"#64748b", fontSize:"0.8rem", margin:"0 0 16px" }}>
              <li>Incluye estructura, datos, triggers y routines</li>
              <li>Compatible con MySQL 5.7+</li>
              <li>Nombre con timestamp para versionado</li>
            </ul>

            {exportErr && (
              <div className="alert py-2" style={{ background:"#fef2f2", border:`1px solid #fecaca`, color:C.danger, fontSize:"0.82rem", borderRadius:8 }}>
                <i className="bi bi-exclamation-triangle-fill me-1" /> {exportErr}
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn w-100 d-flex align-items-center justify-content-center gap-2"
              style={{
                background: exporting ? "#e2e8f0" : `linear-gradient(135deg,${C.accent},${C.accentH})`,
                color: exporting ? "#94a3b8" : "#fff",
                border: "none",
                borderRadius: 9,
                fontWeight: 700,
                fontSize: "0.88rem",
                padding: "10px 0",
                transition: "opacity 0.15s",
              }}
            >
              {exporting
                ? <><i className="bi bi-hourglass-split spin" /> Generando backup…</>
                : <><i className="bi bi-download" /> Descargar .sql</>
              }
            </button>

            {exporting && <div className="progress-bar-anim"><div className="progress-bar-inner" /></div>}
          </div>
        </div>

        {/* ── Importar ── */}
        <div className="col-md-6">
          <div className="db-stat-card h-100">
            <div className="d-flex align-items-center gap-2 mb-1">
              <div style={{ width:38, height:38, borderRadius:9, background:`${C.danger}15`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <i className="bi bi-cloud-upload-fill" style={{ color:C.danger, fontSize:"1.1rem" }} />
              </div>
              <div>
                <h6 className="mb-0 fw-bold" style={{ color:C.dark }}>Importar base de datos</h6>
                <p className="mb-0 text-muted" style={{ fontSize:"0.73rem" }}>Carga un archivo .sql sobre la BD actual</p>
              </div>
            </div>

            <hr style={{ borderColor:"#f1f5f9", margin:"14px 0" }} />

            {/* Zona drag & drop */}
            <div
              className={`drop-zone${dragOver ? " over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".sql"
                style={{ display:"none" }}
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) { setImportFile(f); setImportMsg(null); }
                  e.target.value = "";
                }}
              />
              {importFile ? (
                <>
                  <i className="bi bi-file-earmark-code-fill mb-2" style={{ fontSize:"2rem", color:C.accent }} />
                  <div style={{ fontWeight:600, color:C.dark, fontSize:"0.85rem" }}>{importFile.name}</div>
                  <div style={{ color:"#94a3b8", fontSize:"0.75rem" }}>
                    {(importFile.size / 1024).toFixed(1)} KB
                  </div>
                  <button
                    className="btn btn-sm mt-2"
                    style={{ fontSize:"0.72rem", background:"#f1f5f9", color:"#64748b", border:"none" }}
                    onClick={(e) => { e.stopPropagation(); setImportFile(null); setImportMsg(null); }}
                  >
                    <i className="bi bi-x me-1" />Quitar
                  </button>
                </>
              ) : (
                <>
                  <i className="bi bi-cloud-arrow-up mb-2" style={{ fontSize:"2rem", color:"#94a3b8" }} />
                  <div style={{ color:"#64748b", fontSize:"0.83rem", fontWeight:600 }}>
                    Arrastra un archivo .sql aquí
                  </div>
                  <div style={{ color:"#94a3b8", fontSize:"0.75rem", marginTop:2 }}>
                    o haz clic para seleccionar
                  </div>
                </>
              )}
            </div>

            {/* Alerta resultado */}
            {importMsg && (
              <div
                className="d-flex align-items-center gap-2 mt-3 p-2 rounded-3"
                style={{
                  background: importMsg.type === "success" ? "#ecfdf5" : "#fef2f2",
                  border: `1px solid ${importMsg.type === "success" ? "#6ee7b7" : "#fecaca"}`,
                  color: importMsg.type === "success" ? C.success : C.danger,
                  fontSize:"0.82rem",
                }}
              >
                <i className={`bi ${importMsg.type === "success" ? "bi-check-circle-fill" : "bi-x-circle-fill"}`} />
                {importMsg.text}
              </div>
            )}

            {importing && <div className="progress-bar-anim"><div className="progress-bar-inner" /></div>}

            <button
              onClick={() => importFile && setConfirmOpen(true)}
              disabled={!importFile || importing}
              className="btn w-100 d-flex align-items-center justify-content-center gap-2 mt-3"
              style={{
                background: !importFile || importing ? "#e2e8f0" : `linear-gradient(135deg,${C.danger},#b91c1c)`,
                color: !importFile || importing ? "#94a3b8" : "#fff",
                border: "none",
                borderRadius: 9,
                fontWeight: 700,
                fontSize: "0.88rem",
                padding: "10px 0",
              }}
            >
              {importing
                ? <><i className="bi bi-hourglass-split spin" /> Importando…</>
                : <><i className="bi bi-upload" /> Importar .sql</>
              }
            </button>
          </div>
        </div>

      </div>

      {/* ════════ VACIAR BASE DE DATOS ════════ */}
      <div className="mt-4">
        <div className="db-stat-card" style={{ border:`1.5px solid #fee2e2` }}>
          <div className="d-flex align-items-start gap-3 flex-wrap">
            <div style={{ width:44, height:44, borderRadius:10, background:"#fef2f2", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <i className="bi bi-fire" style={{ color:C.danger, fontSize:"1.35rem" }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <h6 className="fw-bold mb-1" style={{ color:C.dark }}>Zona de peligro — Vaciar base de datos</h6>
              <p className="mb-2" style={{ fontSize:"0.82rem", color:"#64748b" }}>
                Elimina <strong>todos los datos</strong> de pacientes, citas, historias, medicamentos y más.
                Los usuarios <span style={{ color:C.danger, fontWeight:700 }}>ADMIN</span> y{" "}
                <span style={{ color:"#7c3aed", fontWeight:700 }}>SUPER_ADMIN</span> se conservan.
              </p>
              {truncateMsg && (
                <div className="d-flex align-items-center gap-2 mb-2 p-2 rounded-3" style={{
                  background: truncateMsg.type === "success" ? "#ecfdf5" : "#fef2f2",
                  border: `1px solid ${truncateMsg.type === "success" ? "#6ee7b7" : "#fecaca"}`,
                  color: truncateMsg.type === "success" ? C.success : C.danger,
                  fontSize:"0.82rem"
                }}>
                  <i className={`bi ${truncateMsg.type === "success" ? "bi-check-circle-fill" : "bi-x-circle-fill"}`} />
                  {truncateMsg.text}
                </div>
              )}
            </div>
            <button
              onClick={() => { setTruncateOpen(true); setTruncateConfirm(""); setTruncateMsg(null); }}
              className="btn d-flex align-items-center gap-2"
              style={{
                background:"#fef2f2", color:C.danger,
                border:`1.5px solid #fecaca`,
                borderRadius:9, fontWeight:700, fontSize:"0.85rem",
                whiteSpace:"nowrap", flexShrink:0,
              }}
            >
              <i className="bi bi-trash3-fill" />
              Vaciar datos
            </button>
          </div>
        </div>
      </div>

      {/* ════════ MODAL CONFIRMACIÓN IMPORTAR ════════ */}
      {confirmOpen && (
        <div
          style={{
            position:"fixed", inset:0, zIndex:9999,
            background:"rgba(0,0,0,0.55)",
            display:"flex", alignItems:"center", justifyContent:"center",
            padding:"0 16px",
          }}
        >
          <div style={{
            background:"#fff", borderRadius:16, maxWidth:440, width:"100%",
            padding:"28px 28px 22px", boxShadow:"0 20px 60px rgba(0,0,0,0.22)",
          }}>
            <div className="d-flex align-items-center gap-3 mb-3">
              <div style={{ width:46, height:46, borderRadius:12, background:`${C.danger}15`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <i className="bi bi-exclamation-triangle-fill" style={{ color:C.danger, fontSize:"1.4rem" }} />
              </div>
              <div>
                <h5 className="mb-0 fw-bold" style={{ color:C.dark }}>¿Confirmar importación?</h5>
                <p className="mb-0 text-muted" style={{ fontSize:"0.8rem" }}>Esta acción sobrescribirá datos existentes</p>
              </div>
            </div>
            <div style={{
              background:"#fef2f2", border:`1px solid #fecaca`,
              borderRadius:10, padding:"12px 14px",
              fontSize:"0.82rem", color:"#7f1d1d", marginBottom:20,
            }}>
              <i className="bi bi-shield-fill-exclamation me-2" />
              <strong>Advertencia:</strong> Los datos actuales serán reemplazados por los del archivo
              <strong> {importFile?.name}</strong>. Asegúrate de tener un backup antes de continuar.
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="btn"
                style={{ background:"#f1f5f9", color:"#64748b", border:"none", fontWeight:600, borderRadius:8, fontSize:"0.85rem" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                className="btn"
                style={{ background:`linear-gradient(135deg,${C.danger},#b91c1c)`, color:"#fff", border:"none", fontWeight:700, borderRadius:8, fontSize:"0.85rem" }}
              >
                <i className="bi bi-upload me-1" />
                Sí, importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL CONFIRMAR VACIAR ════════ */}
      {truncateOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:"0 16px" }}>
          <div style={{ background:"#fff", borderRadius:16, maxWidth:460, width:"100%", padding:"28px 28px 22px", boxShadow:"0 20px 60px rgba(0,0,0,0.28)" }}>
            {/* Cabecera */}
            <div className="d-flex align-items-center gap-3 mb-3">
              <div style={{ width:50, height:50, borderRadius:13, background:"#fef2f2", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <i className="bi bi-fire" style={{ color:C.danger, fontSize:"1.6rem" }} />
              </div>
              <div>
                <h5 className="mb-0 fw-bold" style={{ color:C.dark }}>¿Vaciar base de datos?</h5>
                <p className="mb-0 text-muted" style={{ fontSize:"0.8rem" }}>Esta acción es <strong>irreversible</strong></p>
              </div>
            </div>

            {/* Advertencia */}
            <div style={{ background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:10, padding:"12px 14px", fontSize:"0.82rem", color:"#7f1d1d", marginBottom:18 }}>
              <div className="d-flex align-items-center gap-2 mb-1 fw-bold">
                <i className="bi bi-shield-fill-exclamation" /> Se eliminarán permanentemente:
              </div>
              <ul style={{ paddingLeft:18, marginBottom:0, marginTop:4 }}>
                <li>Pacientes, citas y horarios</li>
                <li>Historias clínicas, prescripciones y estudios</li>
                <li>Documentos, servicios y configuraciones</li>
              </ul>
              <div className="mt-2" style={{ color:C.success, fontWeight:600 }}>
                <i className="bi bi-check-circle-fill me-1" />
                Se conservarán: usuarios ADMIN y SUPER_ADMIN
              </div>
            </div>

            {/* Input de confirmación */}
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:"0.82rem", fontWeight:600, color:"#374151", display:"block", marginBottom:6 }}>
                Escribe <strong style={{ color:C.danger }}>VACIAR</strong> para confirmar:
              </label>
              <input
                type="text"
                value={truncateConfirm}
                onChange={e => setTruncateConfirm(e.target.value)}
                placeholder="VACIAR"
                autoFocus
                style={{
                  width:"100%", padding:"9px 12px", borderRadius:8,
                  border: `2px solid ${truncateConfirm === "VACIAR" ? C.danger : "#e2e8f0"}`,
                  outline:"none", fontSize:"0.9rem", fontWeight:600,
                  color: truncateConfirm === "VACIAR" ? C.danger : "#374151",
                  transition:"border-color 0.15s",
                }}
              />
            </div>

            <div className="d-flex gap-2 justify-content-end">
              <button
                onClick={() => { setTruncateOpen(false); setTruncateConfirm(""); }}
                className="btn"
                style={{ background:"#f1f5f9", color:"#64748b", border:"none", fontWeight:600, borderRadius:8, fontSize:"0.85rem" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleTruncate}
                disabled={truncateConfirm !== "VACIAR" || truncating}
                className="btn d-flex align-items-center gap-2"
                style={{
                  background: truncateConfirm === "VACIAR" && !truncating
                    ? `linear-gradient(135deg,${C.danger},#b91c1c)`
                    : "#e2e8f0",
                  color: truncateConfirm === "VACIAR" && !truncating ? "#fff" : "#94a3b8",
                  border:"none", fontWeight:700, borderRadius:8, fontSize:"0.85rem",
                  transition:"background 0.15s",
                }}
              >
                {truncating
                  ? <><i className="bi bi-hourglass-split spin" /> Vaciando…</>
                  : <><i className="bi bi-trash3-fill" /> Confirmar vaciado</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
