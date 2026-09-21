import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";

// ══════════════════════════════════════════════════════════════════════
// TAB: Estudios
// ══════════════════════════════════════════════════════════════════════

export default function EstudiosTab({ historiaId, pacienteId, citaId, firmada, firmaDigitalUrl }) {
  const { tieneRecepcionista } = useAuth();
  const [list,     setList]     = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ tipo: "LABORATORIO", descripcion: "", urgente: false });
  const [saving,            setSaving]            = useState(false);
  const [alertEstudios,     setAlertEstudios]     = useState(null);
  const [showEstSuccess,    setShowEstSuccess]    = useState(false);

  useEffect(() => {
    if (!showEstSuccess) return;
    const onKey = (e) => { if (e.key === "Enter" || e.key === "Escape") setShowEstSuccess(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEstSuccess]);

  // ── Catálogo de estudios ──
  const [catEstQuery, setCatEstQuery] = useState("");
  const [catEstList, setCatEstList]   = useState([]);
  const [showCatEst, setShowCatEst]   = useState(false);

  useEffect(() => {
    if (!catEstQuery || catEstQuery.length < 2) { setCatEstList([]); return; }
    const t = setTimeout(() => {
      api.get("/catalogos-estudios", { params: { q: catEstQuery } })
        .then(r => { setCatEstList(r.data.data || []); setShowCatEst(true); })
        .catch(() => setCatEstList([]));
    }, 300);
    return () => clearTimeout(t);
  }, [catEstQuery]);

  const selCatEst = (cat) => {
    setForm(f => ({
      ...f,
      tipo: cat.categoria || "LABORATORIO",
      descripcion: f.descripcion
        ? f.descripcion + ", " + cat.nombre + (cat.descripcion ? ` (${cat.descripcion})` : "")
        : cat.nombre + (cat.descripcion ? ` (${cat.descripcion})` : ""),
    }));
    setCatEstQuery("");
    setCatEstList([]);
    setShowCatEst(false);
  };

  useEffect(() => {
    if (!historiaId && !pacienteId) return;
    const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
    api.get("/estudios", { params })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  }, [historiaId, pacienteId]);

  const handleSubmit = async () => {
    if (!form.descripcion) { setAlertEstudios({ type: "danger", msg: "Ingresa la descripción" }); return; }
    setSaving(true);
    try {
      await api.post("/estudios", {
        paciente_id: pacienteId,
        historia_id: historiaId || null,
        cita_id:     citaId || null,
        tipo:        form.tipo,
        descripcion: form.descripcion,
        urgente:     form.urgente ? 1 : 0,
        firma_digital_url: firmaDigitalUrl || null,
      });
      const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
      const r = await api.get("/estudios", { params });
      setList(r.data.data || []);
      setShowForm(false);
      setForm({ tipo: "LABORATORIO", descripcion: "", urgente: false });
      setShowEstSuccess(true);
    } catch (e) {
      setAlertEstudios({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Modal de éxito al crear solicitud de estudio */}
      {showEstSuccess && createPortal(
        <div
          onClick={() => setShowEstSuccess(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 20, padding: "40px 48px",
              textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              minWidth: 280,
              animation: "rxModalIn 0.3s cubic-bezier(.34,1.56,.64,1)",
            }}>
            <svg width="90" height="90" viewBox="0 0 90 90" style={{ display: "block", margin: "0 auto 18px" }}>
              <circle cx="45" cy="45" r="42"
                fill="#f0fdf4" stroke="#22c55e" strokeWidth="3"
                style={{ animation: "rxCirclePop 0.4s cubic-bezier(.34,1.56,.64,1) both" }} />
              <polyline points="24,47 38,61 66,31"
                fill="none" stroke="#22c55e" strokeWidth="5"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="80" strokeDashoffset="0"
                style={{ animation: "rxCheckDraw 0.45s ease 0.2s both" }} />
            </svg>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#111827", marginBottom: 6 }}>
              ¡Solicitud creada!
            </div>
            <div style={{ fontSize: "0.88rem", color: "#6b7280", marginBottom: 24 }}>
              El estudio fue registrado exitosamente.
            </div>
            <button
              onClick={() => setShowEstSuccess(false)}
              style={{
                background: "linear-gradient(135deg,#22c55e,#16a34a)", border: "none",
                borderRadius: 10, color: "#fff", padding: "10px 32px",
                fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 14px rgba(34,197,94,.35)",
              }}>
              Aceptar
            </button>
          </div>
        </div>,
        document.body
      )}

      {alertEstudios && (
        <div className={`alert alert-${alertEstudios.type} py-2 alert-dismissible mb-3`}>
          {alertEstudios.msg} <button className="btn-close" onClick={() => setAlertEstudios(null)} />
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Solicitudes de Estudios</h6>
        {!firmada && !showForm && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Nueva Solicitud</button>
        )}
      </div>

      {showForm && (
        <div className="card border-primary shadow-sm mb-3">
          <div className="card-header fw-semibold">Nueva Solicitud</div>
          <div className="card-body row g-2">
            {/* Buscador de catálogo de estudios */}
            <div className="col-12 position-relative">
              <label className="form-label small">
                <i className="bi bi-journal-bookmark-fill text-info me-1"></i>Buscar en catálogo de estudios
              </label>
              <input className="form-control form-control-sm" placeholder="Buscar estudio del catálogo…"
                value={catEstQuery}
                onChange={e => setCatEstQuery(e.target.value)}
                onFocus={() => catEstList.length > 0 && setShowCatEst(true)} />
              {showCatEst && catEstList.length > 0 && (
                <ul className="list-group position-absolute z-3 shadow"
                  style={{ top: "100%", left: 0, right: 0, maxHeight: 180, overflowY: "auto" }}>
                  {catEstList.map(c => (
                    <li key={c.id} className="list-group-item list-group-item-action py-1"
                      style={{ cursor: "pointer", fontSize: "0.82rem" }}
                      onClick={() => selCatEst(c)}>
                      <i className="bi bi-lightning-fill text-warning me-1"></i>
                      <strong>{c.nombre}</strong>
                      <span className={`badge ms-2 ${c.categoria === "LABORATORIO" ? "bg-primary" : c.categoria === "IMAGENOLOGIA" ? "bg-info text-dark" : "bg-secondary"}`} style={{ fontSize: "0.68rem" }}>
                        {c.categoria}
                      </span>
                      {c.descripcion && <span className="text-muted ms-1">— {c.descripcion}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="col-md-4">
              <label className="form-label small">Tipo</label>
              <select className="form-select form-select-sm"
                value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {["LABORATORIO","IMAGENOLOGIA","OTRO"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-md-8">
              <label className="form-label small">Descripción de estudios</label>
              <textarea className="form-control form-control-sm" rows={2}
                placeholder="Hemograma completo, glucosa, creatinina…"
                value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className="col-12">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="urgente-check"
                  checked={form.urgente} onChange={e => setForm(f => ({ ...f, urgente: e.target.checked }))} />
                <label className="form-check-label small" htmlFor="urgente-check">Urgente</label>
              </div>
            </div>
            <div className="col-12 d-flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
                {saving ? "Guardando…" : "Crear Solicitud"}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {list.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af" }}>
          <i className="bi bi-eyedropper" style={{ fontSize: "2.5rem", opacity: .3 }} />
          <p className="mt-2 small">Sin solicitudes para esta consulta.</p>
        </div>
      )}

      {list.map(s => (
        <div key={s.id} style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#0891b2,#0e7490)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="bi bi-eyedropper" style={{ color: "#fff", fontSize: "0.85rem" }} />
            </div>
            <div>
              <span className={`badge me-2 ${
                s.estado === "COMPLETADO" ? "bg-success" :
                s.estado === "CANCELADO"  ? "bg-secondary" :
                s.estado === "EN_PROCESO" ? "bg-info text-dark" :
                "bg-warning text-dark"
              }`} style={{ fontSize: "0.68rem" }}>{s.estado}</span>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.tipo}</span>
              {s.urgente === 1 && <span className="badge bg-danger ms-1" style={{ fontSize: "0.65rem" }}>URGENTE</span>}
              <div style={{ fontSize: "0.78rem", color: "#555", marginTop: 2 }}>{s.descripcion}</div>
              <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: 1 }}>{dayjs(s.creado_en).format("DD/MM/YYYY HH:mm")}</div>
            </div>
          </div>
          <div className="d-flex gap-1 flex-shrink-0">
            {s.estado === "SOLICITADO" && !firmada && (
              <button
                className="btn btn-outline-success btn-sm"
                style={{ fontSize: "0.75rem", borderRadius: 7 }}
                onClick={() => api.patch(`/estudios/${s.id}/estado`, { estado: "EN_PROCESO" })
                  .then(() => setList(prev => prev.map(x => x.id === s.id ? { ...x, estado: "EN_PROCESO" } : x)))}>
                <i className="bi bi-arrow-right me-1" />En Proceso
              </button>
            )}
            {tieneRecepcionista && (
              !s.enviado_recepcion_en ? (
                <button
                  className="btn btn-outline-primary btn-sm"
                  style={{ fontSize: "0.75rem", borderRadius: 7 }}
                  onClick={() => api.patch(`/estudios/${s.id}/enviar-recepcion`)
                    .then(() => setList(prev => prev.map(x => x.id === s.id ? { ...x, enviado_recepcion_en: new Date().toISOString() } : x)))}>
                  <i className="bi bi-send me-1" />Enviar a recepción
                </button>
              ) : (
                <span className="badge bg-light text-primary border border-primary-subtle d-flex align-items-center"
                  style={{ fontSize: "0.7rem" }}>
                  <i className="bi bi-check2-circle me-1"></i>Enviado
                </span>
              )
            )}
            <button
              style={{ background: "transparent", border: "1px solid #3b82f6", borderRadius: 7, color: "#3b82f6", padding: "4px 12px", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}
              onClick={async () => {
                try {
                  const r = await api.get(`/estudios/pdf?paciente_id=${pacienteId}${historiaId ? `&historia_id=${historiaId}` : ""}`, { responseType: "blob" });
                  window.open(URL.createObjectURL(new Blob([r.data], { type: "application/pdf" })), "_blank");
                } catch { alert("Error al generar PDF"); }
              }}>
              <i className="bi bi-printer me-1" />PDF
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
