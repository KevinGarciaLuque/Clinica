import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import { nombreMedico } from "../../utils/medico";

// ══════════════════════════════════════════════════════════════════════
// TAB: Prescripción (con sub-tabs)
// ══════════════════════════════════════════════════════════════════════
export default function PrescripcionTab({ historiaId, pacienteId, citaId, firmada, diagnosticoCie, diagnosticoDesc, firmaDigitalUrl }) {
  const [subTab, setSubTab] = useState("receta");
  const [pendingSugItems, setPendingSugItems] = useState([]);

  const handleAgregar = (newItems) => {
    setPendingSugItems(newItems);
    setSubTab("receta");
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb", background: "#f8fafc" }}>
        {[
          { id: "receta",    icon: "bi-prescription2",      label: "Nueva Receta",       color: "#3b82f6" },
          { id: "historial", icon: "bi-clock-history",      label: "Historial",          color: "#8b5cf6" },
          { id: "sugeridas", icon: "bi-stars",               label: "Sugeridas CIE-10",  color: "#f59e0b" },
          { id: "favoritas", icon: "bi-bookmark-heart-fill", label: "Mis Favoritas",     color: "#ef4444" },
        ].map((t, i) => (
          <button key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              flex: 1, padding: "10px 6px",
              background: subTab === t.id ? "#fff" : "transparent",
              border: "none",
              borderRight: i < 3 ? "1px solid #e5e7eb" : "none",
              borderBottom: subTab === t.id ? `2.5px solid ${t.color}` : "none",
              color: subTab === t.id ? t.color : "#6b7280",
              fontWeight: subTab === t.id ? 700 : 500,
              fontSize: "0.78rem",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              transition: "all .15s",
            }}>
            <i className={`bi ${t.icon}`}></i>
            <span className="d-none d-sm-inline">{t.label}</span>
          </button>
        ))}
      </div>

      {subTab === "receta"    && <SubRecetaActual historiaId={historiaId} pacienteId={pacienteId} citaId={citaId} firmada={firmada} pendingSugItems={pendingSugItems} onClearPending={() => setPendingSugItems([])} firmaDigitalUrl={firmaDigitalUrl} />}
      {subTab === "historial" && <SubHistorialPaciente pacienteId={pacienteId} />}
      {subTab === "sugeridas" && <SubSugeridadCie diagnosticoCie={diagnosticoCie} diagnosticoDesc={diagnosticoDesc} onAgregar={handleAgregar} />}
      {subTab === "favoritas" && <SubFavoritas firmada={firmada} />}
    </div>
  );
}

// ── Sub-tab: Receta de esta consulta ──────────────────────────────────────────
function SubRecetaActual({ historiaId, pacienteId, citaId, firmada, pendingSugItems = [], onClearPending, firmaDigitalUrl }) {
  const { tieneRecepcionista } = useAuth();
  const [list,      setList]      = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [rxMenu,    setRxMenu]    = useState(null); // id de receta con menú de tamaño abierto
  const [items,     setItems]     = useState([newRxItem()]);
  const [notas,     setNotas]     = useState("");

  useEffect(() => {
    if (!pendingSugItems.length) return;
    setItems(pendingSugItems);
    setShowForm(true);
    onClearPending?.();
  }, [pendingSugItems]); // eslint-disable-line react-hooks/exhaustive-deps
  const [saving,         setSaving]         = useState(false);
  const [savingFav,      setSavingFav]      = useState(false);
  const [alertMsg,       setAlertMsg]       = useState(null);
  const [showRxSuccess,  setShowRxSuccess]  = useState(false);

  useEffect(() => {
    if (!showRxSuccess) return;
    const onKey = (e) => { if (e.key === "Enter" || e.key === "Escape") setShowRxSuccess(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showRxSuccess]);
  const [medSearch, setMedSearch] = useState(null);
  const [showSaveFav, setShowSaveFav] = useState(false);
  const [favNombre, setFavNombre] = useState("");
  const [medFavSet, setMedFavSet] = useState(new Set());
  const [medFavList, setMedFavList] = useState([]); // top favoritos para mostrar sin escribir

  function newRxItem() {
    return { medicamento_id: null, medicamento_texto: "", dosis: "", duracion: "", cantidad: "", instrucciones: "" };
  }

  // Cargar favoritos del médico al montar
  useEffect(() => {
    api.get("/medicamentos/favoritos")
      .then(r => {
        const ids = r.data.data || [];
        setMedFavSet(new Set(ids));
        if (ids.length > 0) {
          // Buscar datos completos de los primeros 8 favoritos
          api.get("/medicamentos", { params: { q: "" } })
            .then(r2 => setMedFavList((r2.data.data || []).filter(m => ids.includes(m.id)).slice(0, 8)))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const printRx = async (id, formato) => {
    setRxMenu(null);
    try {
      const qs = formato ? `?formato=${formato}` : "";
      const res = await api.get(`/prescripciones/${id}/pdf${qs}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (err) {
      window.alert("No se pudo generar el PDF: " + (err?.response?.data?.msg || err.message));
    }
  };

  useEffect(() => {
    if (!historiaId && !pacienteId) return;
    const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
    api.get("/prescripciones", { params })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  }, [historiaId, pacienteId]);

  const searchMed = (q, idx) => {
    if (q.length < 2) {
      // Mostrar favoritos cuando el campo está vacío o con 1 caracter
      if (medFavList.length > 0) {
        setMedSearch({ idx, list: medFavList, soloFavoritos: true });
      } else {
        setMedSearch(null);
      }
      return;
    }
    api.get("/medicamentos", { params: { q } })
      .then(r => setMedSearch({ idx, list: r.data.data || [] }))
      .catch(() => {});
  };

  const selMed = (med, idx) => {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      medicamento_id: med.id,
      medicamento_texto: med.nombre_generico + (med.presentacion ? ` (${med.presentacion})` : ""),
      dosis: med.dosis_default || it.dosis,
      duracion: med.duracion_default || it.duracion,
      cantidad: med.cantidad_default || it.cantidad,
      instrucciones: med.instrucciones_default || it.instrucciones,
    } : it));
    setMedSearch(null);
  };

  const setItem = (idx, field, val) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const handleSubmit = async () => {
    if (!pacienteId) { setAlertMsg({ type: "danger", msg: "Falta paciente_id" }); return; }
    setSaving(true);
    try {
      await api.post("/prescripciones", {
        historia_id: historiaId || null,
        cita_id: citaId || null,
        paciente_id: pacienteId,
        notas,
        firma_digital_url: firmaDigitalUrl || null,
        items: items.filter(it => it.medicamento_texto || it.medicamento_id),
      });
      const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
      const r = await api.get("/prescripciones", { params });
      setList(r.data.data || []);
      setShowForm(false);
      setItems([newRxItem()]);
      setNotas("");
      setShowRxSuccess(true);
    } catch (e) {
      setAlertMsg({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFavorita = async () => {
    if (!favNombre.trim()) return;
    setSavingFav(true);
    try {
      await api.post("/prescripciones/favoritas", {
        nombre: favNombre.trim(),
        notas,
        items: items.filter(it => it.medicamento_texto || it.medicamento_id),
      });
      setShowSaveFav(false);
      setFavNombre("");
      setAlertMsg({ type: "success", msg: "Guardada en Mis Favoritas ⭐" });
    } catch (e) {
      setAlertMsg({ type: "danger", msg: "No se pudo guardar como favorita" });
    } finally {
      setSavingFav(false);
    }
  };

  return (
    <div>
      {/* Modal de éxito al crear receta */}
      {showRxSuccess && createPortal(
        <div
          onClick={() => setShowRxSuccess(false)}
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
            <style>{`
              @keyframes rxModalIn {
                from { opacity: 0; transform: scale(0.7); }
                to   { opacity: 1; transform: scale(1); }
              }
              @keyframes rxCheckDraw {
                from { stroke-dashoffset: 80; }
                to   { stroke-dashoffset: 0; }
              }
              @keyframes rxCirclePop {
                0%   { transform: scale(0); opacity: 0; }
                60%  { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
            `}</style>
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
              ¡Receta creada!
            </div>
            <div style={{ fontSize: "0.88rem", color: "#6b7280", marginBottom: 24 }}>
              La receta fue guardada exitosamente.
            </div>
            <button
              onClick={() => setShowRxSuccess(false)}
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

      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} py-2 alert-dismissible mb-3`} style={{ borderRadius: 10 }}>
          {alertMsg.msg} <button className="btn-close" onClick={() => setAlertMsg(null)} />
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827" }}>Recetas de esta consulta</span>
          {list.length > 0 && <span className="ms-2 badge" style={{ background: "#eff6ff", color: "#3b82f6", fontSize: "0.72rem" }}>{list.length}</span>}
        </div>
        {!firmada && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              background: "linear-gradient(135deg,#3b82f6,#2563eb)", border: "none",
              borderRadius: 8, color: "#fff", padding: "6px 16px", fontSize: "0.82rem",
              cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 2px 8px rgba(59,130,246,.3)",
            }}>
            <i className="bi bi-plus-lg"></i> Nueva Receta
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ border: "1px solid #bfdbfe", borderRadius: 12, marginBottom: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(59,130,246,.1)" }}>
          <div style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i className="bi bi-prescription2" style={{ color: "#3b82f6" }}></i>
              <span style={{ fontWeight: 700, color: "#1e40af", fontSize: "0.9rem" }}>Nueva Receta</span>
            </div>
            <button
              title="Guardar como favorita"
              onClick={() => setShowSaveFav(s => !s)}
              style={{
                background: showSaveFav ? "#fef3c7" : "transparent", border: "1px solid #fbbf24",
                borderRadius: 7, color: "#d97706", padding: "4px 12px",
                fontSize: "0.75rem", cursor: "pointer", fontWeight: 600,
              }}>
              <i className="bi bi-bookmark-heart me-1"></i>Guardar favorita
            </button>
          </div>

          {showSaveFav && (
            <div style={{ borderBottom: "1px solid #e5e7eb", padding: "10px 18px", background: "#fffbeb", display: "flex", gap: 8, alignItems: "center" }}>
              <input className="form-control form-control-sm" placeholder="Nombre de la favorita (ej: IRA en adultos)"
                value={favNombre} onChange={e => setFavNombre(e.target.value)} style={{ maxWidth: 320, borderRadius: 7 }} />
              <button
                onClick={handleSaveFavorita} disabled={savingFav}
                style={{ background: "#f59e0b", border: "none", borderRadius: 7, color: "#fff", padding: "5px 14px", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                {savingFav ? "Guardando…" : "⭐ Guardar"}
              </button>
            </div>
          )}

          <div style={{ padding: "18px" }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px", marginBottom: 12, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Medicamento {idx + 1}
                  </span>
                  {item.medicamento_id && (
                    <span style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, color: "#16a34a", fontSize: "0.67rem", fontWeight: 600, padding: "2px 8px" }}>
                      <i className="bi bi-lightning-fill me-1"></i>Auto-llenado
                    </span>
                  )}
                </div>
                <div className="row g-2">
                  <div className="col-12 position-relative">
                    <label className="form-label small mb-1" style={{ color: "#374151", fontWeight: 600 }}>Medicamento</label>
                    <input className="form-control form-control-sm" placeholder="Buscar o escribir…"
                      style={{ borderRadius: 7 }}
                      value={item.medicamento_texto}
                      onFocus={() => { if (!item.medicamento_texto) searchMed("", idx); }}
                      onChange={e => { setItem(idx, "medicamento_texto", e.target.value); setItem(idx, "medicamento_id", null); searchMed(e.target.value, idx); }}
                      onBlur={() => setTimeout(() => setMedSearch(null), 200)} />
                    {medSearch?.idx === idx && medSearch.list?.length > 0 && (
                      <ul className="list-group position-absolute z-3 shadow"
                        style={{ top: "100%", left: 0, right: 0, maxHeight: 200, overflowY: "auto", borderRadius: 8 }}>
                        {medSearch.soloFavoritos && (
                          <li className="list-group-item py-1 px-2" style={{ background: "#fffbeb", fontSize: "0.72rem", color: "#d97706", fontWeight: 700, pointerEvents: "none" }}>
                            <i className="bi bi-star-fill me-1"></i>Mis medicamentos favoritos
                          </li>
                        )}
                        {medSearch.list.map(m => {
                          const esFav = medFavSet.has(m.id) || m.es_favorito === 1;
                          return (
                            <li key={m.id} className="list-group-item list-group-item-action py-1"
                              style={{ cursor: "pointer", fontSize: "0.8rem" }}
                              onClick={() => selMed(m, idx)}>
                              {esFav && <i className="bi bi-star-fill text-warning me-1" style={{ fontSize: "0.7rem" }}></i>}
                              <strong>{m.nombre_generico}</strong>
                              {m.presentacion && <span className="text-muted ms-1">({m.presentacion})</span>}
                              {(m.dosis_default || m.duracion_default) && (
                                <span className="text-success ms-2" style={{ fontSize: "0.7rem" }}>
                                  <i className="bi bi-lightning-fill"></i> con defaults
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1" style={{ fontWeight: 600, color: "#374151" }}>Dosis</label>
                    <input className="form-control form-control-sm" placeholder="500mg c/8h" style={{ borderRadius: 7 }}
                      value={item.dosis} onChange={e => setItem(idx, "dosis", e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1" style={{ fontWeight: 600, color: "#374151" }}>Duración</label>
                    <input className="form-control form-control-sm" placeholder="7 días" style={{ borderRadius: 7 }}
                      value={item.duracion} onChange={e => setItem(idx, "duracion", e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1" style={{ fontWeight: 600, color: "#374151" }}>Cantidad</label>
                    <input className="form-control form-control-sm" placeholder="21 tabletas" style={{ borderRadius: 7 }}
                      value={item.cantidad} onChange={e => setItem(idx, "cantidad", e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1" style={{ fontWeight: 600, color: "#374151" }}>Instrucciones</label>
                    <input className="form-control form-control-sm" placeholder="Tomar con alimentos…" style={{ borderRadius: 7 }}
                      value={item.instrucciones} onChange={e => setItem(idx, "instrucciones", e.target.value)} />
                  </div>
                </div>
                {items.length > 1 && (
                  <button
                    onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                    style={{ position: "absolute", top: 8, right: 8, background: "#fee2e2", border: "none", borderRadius: 6, color: "#dc2626", width: 24, height: 24, fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ✕
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => setItems(prev => [...prev, { medicamento_id: null, medicamento_texto: "", dosis: "", duracion: "", cantidad: "", instrucciones: "" }])}
              style={{ background: "#eff6ff", border: "1px dashed #93c5fd", borderRadius: 8, color: "#3b82f6", padding: "7px 16px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}>
              <i className="bi bi-plus-lg me-1"></i>Agregar medicamento
            </button>

            <div className="mt-3">
              <label className="form-label small" style={{ fontWeight: 600, color: "#374151" }}>Notas adicionales</label>
              <textarea className="form-control form-control-sm" rows={2} style={{ borderRadius: 7 }}
                value={notas} onChange={e => setNotas(e.target.value)} />
            </div>

            <div className="d-flex gap-2 mt-3">
              <button
                onClick={handleSubmit} disabled={saving}
                style={{
                  background: "linear-gradient(135deg,#3b82f6,#2563eb)", border: "none",
                  borderRadius: 8, color: "#fff", padding: "7px 20px", fontSize: "0.83rem",
                  cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 8px rgba(59,130,246,.35)",
                }}>
                {saving ? "Guardando…" : "Crear Receta"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b", padding: "7px 16px", fontSize: "0.83rem", cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {list.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af" }}>
          <i className="bi bi-prescription2" style={{ fontSize: "2.5rem", opacity: .3 }}></i>
          <p className="mt-2 small">Sin recetas para esta consulta.</p>
        </div>
      )}

      {list.map(p => (
        <div key={p.id} style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#3b82f6,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="bi bi-capsule-pill" style={{ color: "#fff", fontSize: "0.85rem" }}></i>
            </div>
            <div>
              <span className={`badge me-2 ${p.estado === "ENTREGADA" ? "bg-success" : p.estado === "CANCELADA" ? "bg-secondary" : "bg-warning text-dark"}`} style={{ fontSize: "0.68rem" }}>{p.estado}</span>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{p.total_items} medicamento(s)</span>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 1 }}>{dayjs(p.creado_en).format("DD/MM/YYYY HH:mm")}</div>
            </div>
          </div>
          <div className="d-flex gap-1">
            {p.estado === "ACTIVA" && !firmada && (
              <button className="btn btn-outline-success btn-sm"
                style={{ fontSize: "0.75rem", borderRadius: 7 }}
                onClick={() => api.patch(`/prescripciones/${p.id}/estado`, { estado: "ENTREGADA" })
                  .then(() => setList(prev => prev.map(x => x.id === p.id ? { ...x, estado: "ENTREGADA" } : x)))}>
                <i className="bi bi-check-lg me-1"></i>Entregar
              </button>
            )}
            {tieneRecepcionista && (
              !p.enviado_recepcion_en ? (
                <button className="btn btn-outline-primary btn-sm"
                  style={{ fontSize: "0.75rem", borderRadius: 7 }}
                  onClick={() => api.patch(`/prescripciones/${p.id}/enviar-recepcion`)
                    .then(() => setList(prev => prev.map(x => x.id === p.id ? { ...x, enviado_recepcion_en: new Date().toISOString() } : x)))}>
                  <i className="bi bi-send me-1"></i>Enviar a recepción
                </button>
              ) : (
                <span className="badge bg-light text-primary border border-primary-subtle d-flex align-items-center"
                  style={{ fontSize: "0.7rem" }}>
                  <i className="bi bi-check2-circle me-1"></i>Enviado
                </span>
              )
            )}
            <div style={{ position: "relative", display: "flex" }}>
              <button
                onClick={() => printRx(p.id)}
                title="Imprimir con el formato configurado"
                style={{
                  background: "transparent", border: "1px solid #3b82f6",
                  borderRight: "none", borderRadius: "7px 0 0 7px", color: "#3b82f6",
                  padding: "4px 10px", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600,
                }}>
                <i className="bi bi-printer me-1"></i>PDF
              </button>
              <button
                onClick={() => setRxMenu(rxMenu === p.id ? null : p.id)}
                title="Elegir tamaño"
                style={{
                  background: rxMenu === p.id ? "#eff6ff" : "transparent",
                  border: "1px solid #3b82f6", borderRadius: "0 7px 7px 0",
                  color: "#3b82f6", padding: "4px 7px", fontSize: "0.7rem", cursor: "pointer",
                }}>
                <i className="bi bi-caret-down-fill"></i>
              </button>
              {rxMenu === p.id && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 20,
                  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
                  boxShadow: "0 6px 18px rgba(0,0,0,.12)", overflow: "hidden", minWidth: 190,
                }}>
                  <button onClick={() => printRx(p.id, "media_carta")}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: "0.78rem", cursor: "pointer", color: "#374151" }}>
                    <i className="bi bi-file-earmark me-2"></i>Media carta (compacta)
                  </button>
                  <button onClick={() => printRx(p.id, "carta_completa")}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 12px", fontSize: "0.78rem", cursor: "pointer", color: "#374151", borderTop: "1px solid #f1f5f9" }}>
                    <i className="bi bi-file-earmark-text me-2"></i>Carta completa
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-tab: Historial completo del paciente ──────────────────────────────────
function SubHistorialPaciente({ pacienteId }) {
  const [historial, setHistorial] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState(null);

  useEffect(() => {
    if (!pacienteId) return;
    setLoading(true);
    api.get(`/prescripciones/historial-paciente/${pacienteId}`)
      .then(r => setHistorial(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pacienteId]);

  if (loading) return <div className="text-center py-4"><span className="spinner-border spinner-border-sm"></span> Cargando historial…</div>;
  if (!historial.length) return <p className="text-muted py-3">Sin recetas previas para este paciente.</p>;

  return (
    <div>
      <p className="text-muted small mb-3">{historial.length} receta(s) encontradas</p>
      {historial.map(rx => (
        <div key={rx.id} className="card border-0 shadow-sm mb-2">
          <div className="card-body py-2"
            style={{ cursor: "pointer" }}
            onClick={() => setExpanded(expanded === rx.id ? null : rx.id)}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className={`badge me-2 bg-${rx.estado === "ENTREGADA" ? "success" : rx.estado === "CANCELADA" ? "secondary" : "warning text-dark"}`}>
                  {rx.estado}
                </span>
                <strong className="small">{rx.total_items} medicamento(s)</strong>
                {rx.diagnostico_cie && (
                  <span className="badge text-bg-light border ms-2" style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>
                    {rx.diagnostico_cie}
                  </span>
                )}
              </div>
              <div className="text-end">
                <div className="small text-muted">{dayjs(rx.creado_en).format("DD/MM/YYYY")}</div>
                <div style={{ fontSize: "0.75rem", color: "#888" }}>
                  {nombreMedico(rx)}
                </div>
              </div>
            </div>
            {expanded === rx.id && rx.items?.length > 0 && (
              <div className="mt-2 pt-2 border-top">
                {rx.items.map((it, i) => (
                  <div key={i} className="d-flex align-items-start gap-2 mb-1">
                    <i className="bi bi-capsule text-primary mt-1" style={{ fontSize: "0.75rem" }}></i>
                    <div style={{ fontSize: "0.82rem" }}>
                      <strong>{it.nombre}</strong>
                      {it.presentacion && <span className="text-muted ms-1">({it.presentacion})</span>}
                      {it.dosis && <span className="ms-2 badge text-bg-light border">{it.dosis}</span>}
                      {it.duracion && <span className="ms-1 text-muted">· {it.duracion}</span>}
                      {it.instrucciones && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{it.instrucciones}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-tab: Sugerencias por CIE-10 ──────────────────────────────────────────
function SubSugeridadCie({ diagnosticoCie, diagnosticoDesc, onAgregar }) {
  const [sugeridas, setSugeridas] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [agregados, setAgregados] = useState(new Set());

  useEffect(() => {
    if (!diagnosticoCie) { setSugeridas([]); return; }
    setLoading(true);
    api.get("/prescripciones/sugerencias-cie10", { params: { codigo: diagnosticoCie } })
      .then(r => setSugeridas(r.data.data || []))
      .catch(() => setSugeridas([]))
      .finally(() => setLoading(false));
  }, [diagnosticoCie]);

  if (!diagnosticoCie) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="bi bi-search" style={{ fontSize: "2rem", opacity: 0.4 }}></i>
        <p className="mt-2">Selecciona un diagnóstico CIE-10 en la pestaña SOAP para ver sugerencias.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <span className="badge bg-primary" style={{ fontFamily: "monospace" }}>{diagnosticoCie}</span>
        <span className="small fw-semibold">{diagnosticoDesc}</span>
      </div>

      {loading && <div className="text-muted"><span className="spinner-border spinner-border-sm me-2"></span>Buscando medicamentos…</div>}

      {!loading && sugeridas.length === 0 && (
        <p className="text-muted">No hay sugerencias específicas para este diagnóstico. Usa el catálogo de medicamentos en la receta.</p>
      )}

      {sugeridas.length > 0 && (
        <p className="text-muted small mb-2">{sugeridas.length} medicamento(s) frecuente(s) para este diagnóstico:</p>
      )}

      {sugeridas.map(med => (
        <div key={med.id} className={`card border-0 shadow-sm mb-2 ${agregados.has(med.id) ? "border-success" : ""}`}
          style={{ borderLeft: agregados.has(med.id) ? "3px solid #198754" : "3px solid #dee2e6" }}>
          <div className="card-body py-2 px-3">
            <div className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1">
                <div className="fw-semibold small">{med.nombre_generico}</div>
                {med.nombre_comercial && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{med.nombre_comercial}</div>}
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {med.presentacion && <span className="badge text-bg-light border" style={{ fontSize: "0.7rem" }}>{med.presentacion}</span>}
                  {med.dosis_default && <span className="badge text-bg-info bg-opacity-10 text-info border" style={{ fontSize: "0.7rem" }}>{med.dosis_default}</span>}
                  {med.duracion_default && <span className="badge text-bg-secondary bg-opacity-10 border" style={{ fontSize: "0.7rem" }}>{med.duracion_default}</span>}
                </div>
                {med.instrucciones_default && (
                  <div className="text-muted mt-1" style={{ fontSize: "0.74rem" }}>{med.instrucciones_default}</div>
                )}
              </div>
              {!agregados.has(med.id) ? (
                <button className="btn btn-outline-primary btn-sm ms-2 text-nowrap"
                  style={{ flexShrink: 0 }}
                  onClick={() => {
                    setAgregados(prev => new Set(prev).add(med.id));
                    onAgregar([{
                      medicamento_id:    med.id,
                      medicamento_texto: med.nombre_generico + (med.presentacion ? ` (${med.presentacion})` : ""),
                      dosis:             med.dosis_default        || "",
                      duracion:          med.duracion_default     || "",
                      cantidad:          med.cantidad_default     || "",
                      instrucciones:     med.instrucciones_default || "",
                    }]);
                  }}>
                  <i className="bi bi-plus-circle me-1"></i>Agregar a receta
                </button>
              ) : (
                <span className="badge bg-success ms-2" style={{ padding: "6px 10px" }}>
                  <i className="bi bi-check-lg me-1"></i>Seleccionado
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-tab: Recetas favoritas del médico ─────────────────────────────────────
function SubFavoritas({ firmada }) {
  const [favoritas, setFavoritas] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [expandedFav, setExpandedFav] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  const cargar = () => {
    setLoading(true);
    api.get("/prescripciones/favoritas")
      .then(r => setFavoritas(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const eliminar = async (id) => {
    try {
      await api.delete(`/prescripciones/favoritas/${id}`);
      setFavoritas(prev => prev.filter(f => f.id !== id));
    } catch {
      setAlertMsg({ type: "danger", msg: "No se pudo eliminar" });
    }
  };

  if (loading) return <div className="text-center py-4"><span className="spinner-border spinner-border-sm"></span></div>;

  return (
    <div>
      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} py-2 alert-dismissible mb-3`}>
          {alertMsg.msg} <button className="btn-close" onClick={() => setAlertMsg(null)} />
        </div>
      )}

      {favoritas.length === 0 && (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-bookmark-heart" style={{ fontSize: "2.5rem", opacity: 0.3 }}></i>
          <p className="mt-2 small">No tienes recetas favoritas guardadas.<br/>Crea una receta y usa el botón <strong>"Guardar como favorita"</strong>.</p>
        </div>
      )}

      {favoritas.map(fav => (
        <div key={fav.id} className="card border-0 shadow-sm mb-2">
          <div className="card-body py-2 px-3">
            <div className="d-flex justify-content-between align-items-center"
              style={{ cursor: "pointer" }}
              onClick={() => setExpandedFav(expandedFav === fav.id ? null : fav.id)}>
              <div>
                <i className="bi bi-bookmark-heart-fill text-warning me-2"></i>
                <strong className="small">{fav.nombre}</strong>
                <span className="badge text-bg-light border ms-2" style={{ fontSize: "0.7rem" }}>
                  {fav.items?.length || 0} med.
                </span>
              </div>
              <div className="d-flex gap-1 align-items-center">
                <small className="text-muted me-2">{dayjs(fav.creado_en).format("DD/MM/YY")}</small>
                {!firmada && (
                  <button className="btn btn-sm btn-outline-secondary py-0 px-2"
                    style={{ fontSize: "0.72rem" }}
                    title="Usar esta receta en la consulta actual"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Mensaje orientativo — el usuario la ve y la recrea manualmente o con el buscador
                      setAlertMsg({ type: "info", msg: `Ve a "Nueva Receta" y usa el buscador para agregar los medicamentos de "${fav.nombre}".` });
                      setExpandedFav(fav.id);
                    }}>
                    <i className="bi bi-clipboard-plus me-1"></i>Usar
                  </button>
                )}
                <button className="btn btn-sm btn-outline-danger py-0 px-2"
                  style={{ fontSize: "0.72rem" }}
                  onClick={(e) => { e.stopPropagation(); eliminar(fav.id); }}>
                  <i className="bi bi-trash3"></i>
                </button>
              </div>
            </div>
            {expandedFav === fav.id && fav.items?.length > 0 && (
              <div className="mt-2 pt-2 border-top">
                {fav.notas && <p className="text-muted small mb-2 fst-italic">"{fav.notas}"</p>}
                {fav.items.map((it, i) => (
                  <div key={i} className="d-flex align-items-start gap-2 mb-1">
                    <i className="bi bi-capsule text-warning mt-1" style={{ fontSize: "0.75rem" }}></i>
                    <div style={{ fontSize: "0.82rem" }}>
                      <strong>{it.medicamento_texto}</strong>
                      {it.dosis && <span className="ms-2 badge text-bg-light border">{it.dosis}</span>}
                      {it.duracion && <span className="ms-1 text-muted">· {it.duracion}</span>}
                      {it.cantidad && <span className="ms-1 text-muted">· {it.cantidad}</span>}
                      {it.instrucciones && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{it.instrucciones}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
