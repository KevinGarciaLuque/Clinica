import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import api from "../../api/api";

// Super admin → Almacenamiento: espacio usado por cada clínica, ampliar cuotas
// y atender las solicitudes de espacio que envían las clínicas.

const C = {
  card: "#162a45", border: "rgba(255,255,255,0.07)", accent: "#2196f3",
  success: "#10b981", warning: "#f59e0b", danger: "#ef4444", text: "#e2e8f0", muted: "#94a3b8",
};

const estadoDe = (c) => (c.lleno
  ? { label: "Lleno", color: C.danger, icon: "bi-x-octagon-fill" }
  : c.uso_pct >= 80
    ? { label: "Más de 80%", color: C.warning, icon: "bi-exclamation-triangle-fill" }
    : { label: "Normal", color: C.success, icon: "bi-check-circle-fill" });

const fmtFecha = (v) => { try { return new Date(v).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; } };

function Kpi({ label, value, icon, color, sub }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: "0.78rem" }}>
        <i className={`bi ${icon}`} style={{ color }} />{label}
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: C.text, lineHeight: 1.2, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Barra({ pct, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 7, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${Math.min(Math.max(pct, pct > 0 ? 2 : 0), 100)}%`, height: "100%", background: color, borderRadius: 4 }} />
    </div>
  );
}

function ModalCuota({ clinica, solicitud, onCerrar, onGuardado }) {
  const sugerida = solicitud?.gb_solicitados ? clinica.cuota_gb + solicitud.gb_solicitados : clinica.cuota_gb;
  const [gb, setGb] = useState(String(sugerida));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const usadoGb = clinica.espacio_kb / 1048576;
  const nuevoPct = Number(gb) > 0 ? (usadoGb / Number(gb)) * 100 : 0;

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError("");
    try {
      await api.put(`/superadmin/almacenamiento/${clinica.id}/cuota`, { gb: Number(gb), solicitud_id: solicitud?.id });
      onGuardado(`Espacio de ${clinica.nombre} actualizado a ${Number(gb)} GB.`);
    } catch (err) {
      setError(err.response?.data?.msg || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(2,6,23,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <form onSubmit={guardar} style={{ background: "#0f1f38", color: C.text, border: `1px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: 440, padding: 20 }}>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <div className="fw-bold"><i className="bi bi-hdd-stack me-2" style={{ color: C.accent }} />{solicitud ? "Aprobar solicitud de espacio" : "Cambiar espacio"}</div>
            <div style={{ color: C.muted, fontSize: ".82rem" }}>{clinica.nombre}</div>
          </div>
          <button type="button" className="btn-close btn-close-white" aria-label="Cerrar" onClick={onCerrar} />
        </div>
        {solicitud && (
          <div className="rounded-3 p-2 mb-3" style={{ background: "rgba(33,150,243,.12)", fontSize: ".82rem" }}>
            Pidió <strong>{solicitud.gb_solicitados ?? "?"} GB</strong> adicionales
            {solicitud.total_lps ? <> · total estimado <strong>L {solicitud.total_lps.toLocaleString("es-HN")}</strong></> : null}
            <div style={{ color: C.muted }}>Por {solicitud.usuario_nombre} · {fmtFecha(solicitud.creado_en)}</div>
          </div>
        )}
        <div style={{ fontSize: ".82rem", color: C.muted }}>Usa ahora {clinica.espacio_legible} de {clinica.cuota_legible} ({clinica.uso_pct}%)</div>
        <label className="form-label mt-3 mb-1 small fw-semibold">Nuevo espacio total (GB)</label>
        <input className="form-control" type="number" min="0.01" max="5000" step="0.01" value={gb} onChange={(e) => setGb(e.target.value)} required autoFocus />
        <div className="mt-1" style={{ fontSize: ".78rem", color: nuevoPct >= 100 ? C.danger : nuevoPct >= 80 ? C.warning : C.success }}>
          Con {Number(gb) || 0} GB quedaría al {nuevoPct.toFixed(1)}%.
        </div>
        {error && <div className="alert alert-danger py-2 small mt-2 mb-0">{error}</div>}
        {solicitud && <div className="mt-2" style={{ fontSize: ".75rem", color: C.muted }}>Al guardar, la solicitud se marca como atendida y la clínica recibe la respuesta.</div>}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-outline-light btn-sm" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
            {guardando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2 me-1" />}Guardar
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function Almacenamiento() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // { clinica, solicitud }
  const [aviso, setAviso] = useState("");
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(() => {
    api.get("/superadmin/almacenamiento")
      .then((r) => { setError(""); setDatos(r.data.data); })
      .catch((e) => setError(e.response?.data?.msg || "No se pudo cargar el almacenamiento."));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const lista = useMemo(() => {
    if (!datos) return [];
    const t = q.trim().toLowerCase();
    return datos.clinicas.filter((c) => {
      if (filtro === "80" && !(c.uso_pct >= 80)) return false;
      if (filtro === "llenas" && !c.lleno) return false;
      return !t || c.nombre.toLowerCase().includes(t);
    });
  }, [datos, filtro, q]);

  const exportar = async () => {
    setExportando(true);
    try {
      const r = await api.get("/superadmin/almacenamiento/exportar", { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url; a.download = "almacenamiento_clinicas.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setExportando(false);
    }
  };

  const t = datos?.totales;
  const pctGlobal = t && t.asignado_kb > 0 ? (t.usado_kb / t.asignado_kb) * 100 : 0;

  return (
    <div style={{ padding: "24px 20px", color: C.text, minHeight: "100vh" }}>
      <style>{`@media (max-width: 767.98px) { .alm-tabla thead { display: none; } .alm-tabla tr { display: block; padding: 10px 0; border-bottom: 1px solid ${C.border}; } .alm-tabla td { display: block; padding: 3px 0 !important; border: 0 !important; } }`}</style>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h2 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 700, color: C.accent, display: "flex", alignItems: "center", gap: 10 }}>
            <i className="bi bi-hdd-stack-fill" />Almacenamiento
          </h2>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: "0.85rem" }}>Espacio que usa cada clínica (documentos y fotos). Desde aquí puede ampliar su espacio.</p>
        </div>
        <button className="btn btn-sm btn-outline-primary" onClick={exportar} disabled={exportando || !datos}>
          {exportando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-file-earmark-excel me-1" />}Excel
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {aviso && <div className="alert alert-success py-2 d-flex justify-content-between"><span><i className="bi bi-check-circle-fill me-2" />{aviso}</span><button className="btn-close" onClick={() => setAviso("")} /></div>}
      {!datos && !error && <div className="text-center py-5"><span className="spinner-border text-primary" /></div>}

      {datos && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
            <Kpi label="Espacio usado" value={t.usado_legible} icon="bi-hdd-fill" color={C.accent} sub={`de ${t.asignado_legible} asignados (${pctGlobal.toFixed(1)}%)`} />
            <Kpi label="Clínicas" value={t.clinicas} icon="bi-building" color={C.accent} sub="con su espacio calculado" />
            <Kpi label="Más de 80%" value={t.sobre_80} icon="bi-exclamation-triangle-fill" color={C.warning} sub="por llenarse" />
            <Kpi label="Llenas" value={t.llenas} icon="bi-x-octagon-fill" color={C.danger} sub="no pueden subir archivos" />
          </div>

          {datos.solicitudes.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div className="fw-bold mb-2"><i className="bi bi-inbox-fill me-2" style={{ color: C.warning }} />Solicitudes de espacio pendientes ({datos.solicitudes.length})</div>
              <div className="d-flex flex-column gap-2">
                {datos.solicitudes.map((s) => {
                  const cl = datos.clinicas.find((c) => c.id === s.clinica_id);
                  return (
                    <div key={s.id} className="d-flex flex-wrap align-items-center gap-2 p-2 rounded-3" style={{ background: "rgba(255,255,255,.04)" }}>
                      <div className="flex-grow-1" style={{ minWidth: 200 }}>
                        <div className="fw-semibold">{s.clinica || `Clínica #${s.clinica_id}`}</div>
                        <div style={{ color: C.muted, fontSize: ".78rem" }}>
                          Pide {s.gb_solicitados ?? "?"} GB{s.total_lps ? ` · L ${s.total_lps.toLocaleString("es-HN")}` : ""} · {s.usuario_nombre} · {fmtFecha(s.creado_en)}
                          {cl ? ` · usa ${cl.espacio_legible} de ${cl.cuota_legible}` : ""}
                        </div>
                      </div>
                      {cl && <button className="btn btn-sm btn-success" onClick={() => setModal({ clinica: cl, solicitud: s })}><i className="bi bi-check2-circle me-1" />Aprobar</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
              <div className="d-flex gap-1 flex-wrap">
                {[["todas", "Todas"], ["80", "Más de 80%"], ["llenas", "Llenas"]].map(([k, l]) => (
                  <button key={k} className={`btn btn-sm ${filtro === k ? "btn-primary" : "btn-outline-light"}`} onClick={() => setFiltro(k)}>{l}</button>
                ))}
              </div>
              <input className="form-control form-control-sm ms-auto" style={{ maxWidth: 240 }} placeholder="Buscar clínica…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            {lista.length === 0 ? (
              <div className="text-center py-4" style={{ color: C.muted }}>No hay clínicas en este filtro.</div>
            ) : (
              <table className="w-100 alm-tabla" style={{ fontSize: ".85rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: C.muted, fontSize: ".75rem", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px" }}>Clínica</th>
                    <th style={{ padding: "6px 8px", minWidth: 220 }}>Uso</th>
                    <th style={{ padding: "6px 8px" }}>Archivos</th>
                    <th style={{ padding: "6px 8px" }}>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => {
                    const e = estadoDe(c);
                    return (
                      <tr key={c.id} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "10px 8px" }}>
                          <div className="fw-semibold">{c.nombre}</div>
                          {!c.activo && <div style={{ color: C.muted, fontSize: ".72rem" }}>Inactiva</div>}
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <div className="d-flex justify-content-between mb-1" style={{ fontSize: ".78rem" }}>
                            <span>{c.espacio_legible} de {c.cuota_legible}</span>
                            <strong>{c.uso_pct}%</strong>
                          </div>
                          <Barra pct={c.uso_pct} color={e.color} />
                        </td>
                        <td style={{ padding: "10px 8px", color: C.muted, fontSize: ".78rem" }}>
                          {c.documentos} documentos · {c.fotos} fotos
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <span style={{ color: e.color, fontWeight: 600, fontSize: ".8rem", whiteSpace: "nowrap" }}><i className={`bi ${e.icon} me-1`} />{e.label}</span>
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "right" }}>
                          <button className="btn btn-sm btn-outline-primary text-nowrap" onClick={() => setModal({ clinica: c })}>
                            <i className="bi bi-plus-circle me-1" />Ampliar espacio
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-2" style={{ color: C.muted, fontSize: ".75rem" }}>
            <i className="bi bi-info-circle me-1" />Los documentos se miden con su tamaño real; las fotos anteriores a este cambio, con un tamaño promedio.
          </div>
        </>
      )}

      {modal && (
        <ModalCuota clinica={modal.clinica} solicitud={modal.solicitud} onCerrar={() => setModal(null)}
          onGuardado={(m) => { setModal(null); setAviso(m); cargar(); }} />
      )}
    </div>
  );
}
