import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import "dayjs/locale/es";
import api from "../api/api";

dayjs.locale("es");

export const TIPOS_AUSENCIA = {
  vacaciones:   { label: "Vacaciones",   color: "#2563eb", bg: "#dbeafe", icon: "bi-airplane-fill" },
  permiso:      { label: "Permiso",      color: "#d97706", bg: "#fef3c7", icon: "bi-person-walking" },
  incapacidad:  { label: "Incapacidad",  color: "#dc2626", bg: "#fee2e2", icon: "bi-bandaid-fill" },
  capacitacion: { label: "Capacitación", color: "#7c3aed", bg: "#ede9fe", icon: "bi-mortarboard-fill" },
  otro:         { label: "Otro",         color: "#475569", bg: "#e2e8f0", icon: "bi-three-dots" },
};

const FORM0 = { tipo: "vacaciones", fecha_inicio: "", fecha_fin: "", todo_el_dia: true, hora_inicio: "08:00", hora_fin: "12:00", motivo: "" };

export default function AusenciasMedico({ medicoId, medicoNombre }) {
  const [mes, setMes] = useState(dayjs().startOf("month"));
  const [ausencias, setAusencias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM0);
  const [guardando, setGuardando] = useState(false);
  const [conflictos, setConflictos] = useState(null); // null | [] | [citas]
  const [verConflictos, setVerConflictos] = useState(false);

  const cargar = useCallback(async () => {
    if (!medicoId) { setAusencias([]); return; }
    setCargando(true);
    try {
      const r = await api.get(`/ausencias?medico_id=${medicoId}`);
      setAusencias(r.data.data || []);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setCargando(false);
    }
  }, [medicoId]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Helpers de calendario ──────────────────────────────────────────
  const diasDelMes = () => {
    const inicioGrid = mes.startOf("month").startOf("week");
    const finGrid = mes.endOf("month").endOf("week");
    const dias = [];
    let d = inicioGrid;
    while (d.isBefore(finGrid) || d.isSame(finGrid, "day")) { dias.push(d); d = d.add(1, "day"); }
    return dias;
  };

  const ausenciasDeDia = (d) =>
    ausencias.filter(a => !d.isBefore(dayjs(a.fecha_inicio), "day") && !d.isAfter(dayjs(a.fecha_fin), "day"));

  // ── Modal ──────────────────────────────────────────────────────────
  const abrirNuevo = (fecha) => {
    setEditId(null);
    setForm({ ...FORM0, fecha_inicio: fecha, fecha_fin: fecha });
    setConflictos(null); setVerConflictos(false); setError("");
    setShowModal(true);
  };

  const abrirEditar = (a) => {
    setEditId(a.id);
    setForm({
      tipo: a.tipo,
      fecha_inicio: dayjs(a.fecha_inicio).format("YYYY-MM-DD"),
      fecha_fin: dayjs(a.fecha_fin).format("YYYY-MM-DD"),
      todo_el_dia: Number(a.todo_el_dia) === 1,
      hora_inicio: a.hora_inicio ? String(a.hora_inicio).slice(0, 5) : "08:00",
      hora_fin: a.hora_fin ? String(a.hora_fin).slice(0, 5) : "12:00",
      motivo: a.motivo || "",
    });
    setConflictos(null); setVerConflictos(false); setError("");
    setShowModal(true);
  };

  // Revisar conflictos cuando cambian fechas/horas
  useEffect(() => {
    if (!showModal || !medicoId || !form.fecha_inicio || !form.fecha_fin) { setConflictos(null); return; }
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          medico_id: medicoId, fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
        });
        if (!form.todo_el_dia) { params.set("hora_inicio", form.hora_inicio); params.set("hora_fin", form.hora_fin); }
        const r = await api.get(`/ausencias/conflictos?${params}`);
        setConflictos(r.data.data || []);
      } catch { setConflictos(null); }
    }, 350);
    return () => clearTimeout(t);
  }, [showModal, medicoId, form.fecha_inicio, form.fecha_fin, form.todo_el_dia, form.hora_inicio, form.hora_fin]);

  const guardar = async () => {
    if (!form.fecha_inicio || !form.fecha_fin) { setError("Indica las fechas"); return; }
    if (form.fecha_fin < form.fecha_inicio) { setError("La fecha fin no puede ser anterior a la de inicio"); return; }
    setGuardando(true); setError("");
    try {
      const payload = { ...form, medico_id: medicoId };
      if (editId) await api.put(`/ausencias/${editId}`, payload);
      else        await api.post("/ausencias", payload);
      setShowModal(false);
      cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (a) => {
    if (!window.confirm(`¿Eliminar la ausencia (${TIPOS_AUSENCIA[a.tipo]?.label}) del ${dayjs(a.fecha_inicio).format("D MMM")} al ${dayjs(a.fecha_fin).format("D MMM")}?`)) return;
    try { await api.delete(`/ausencias/${a.id}`); cargar(); }
    catch (e) { setError(e.response?.data?.msg || e.message); }
  };

  if (!medicoId) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
        <i className="bi bi-calendar-x" style={{ fontSize: "3rem", opacity: 0.3, display: "block", marginBottom: 12 }} />
        <p style={{ fontSize: "0.9rem", margin: 0 }}>Selecciona un médico para gestionar sus ausencias.</p>
      </div>
    );
  }

  const dias = diasDelMes();
  const futuras = [...ausencias]
    .filter(a => !dayjs(a.fecha_fin).isBefore(dayjs(), "day"))
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));

  return (
    <div>
      {error && (
        <div style={{ marginBottom: 14, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem", background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
          <i className="bi bi-x-circle-fill me-2" />{error}
        </div>
      )}

      {/* Calendario */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-sm btn-light border" onClick={() => setMes(m => m.subtract(1, "month"))}><i className="bi bi-chevron-left" /></button>
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "#1a2744", minWidth: 160, textAlign: "center", textTransform: "capitalize" }}>
              {mes.format("MMMM YYYY")}
            </span>
            <button className="btn btn-sm btn-light border" onClick={() => setMes(m => m.add(1, "month"))}><i className="bi bi-chevron-right" /></button>
            <button className="btn btn-sm btn-link" onClick={() => setMes(dayjs().startOf("month"))}>Hoy</button>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => abrirNuevo(dayjs().format("YYYY-MM-DD"))}>
            <i className="bi bi-plus-lg me-1" />Agregar ausencia
          </button>
        </div>

        {/* Encabezado días */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>{d}</div>
          ))}
        </div>
        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {dias.map((d, i) => {
            const otroMes = d.month() !== mes.month();
            const hoy = d.isSame(dayjs(), "day");
            const dayAus = ausenciasDeDia(d);
            const principal = dayAus[0] ? TIPOS_AUSENCIA[dayAus[0].tipo] : null;
            return (
              <div key={i}
                onClick={() => dayAus[0] ? abrirEditar(dayAus[0]) : abrirNuevo(d.format("YYYY-MM-DD"))}
                title={dayAus.map(a => `${TIPOS_AUSENCIA[a.tipo]?.label}${a.motivo ? " — " + a.motivo : ""}`).join("\n")}
                style={{
                  minHeight: 76, borderRadius: 8, padding: "5px 7px", cursor: "pointer",
                  border: hoy ? "2px solid #2563eb" : "1px solid #eef2f7",
                  background: principal ? principal.bg : (otroMes ? "#fafafa" : "#fff"),
                  opacity: otroMes ? 0.5 : 1, transition: "background .15s",
                }}>
                <div style={{ fontSize: "0.78rem", fontWeight: hoy ? 800 : 600, color: principal ? principal.color : "#374151" }}>
                  {d.date()}
                </div>
                {dayAus.slice(0, 2).map(a => {
                  const t = TIPOS_AUSENCIA[a.tipo];
                  return (
                    <div key={a.id} style={{ marginTop: 3, fontSize: "0.62rem", fontWeight: 700, color: t.color, display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <i className={`bi ${t.icon}`} style={{ fontSize: "0.6rem" }} />
                      {Number(a.todo_el_dia) === 1 ? t.label : `${String(a.hora_inicio).slice(0,5)}–${String(a.hora_fin).slice(0,5)}`}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Leyenda */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, fontSize: "0.72rem", color: "#6b7280" }}>
          {Object.entries(TIPOS_AUSENCIA).map(([k, t]) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: t.bg, border: `1px solid ${t.color}` }} /> {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Próximas ausencias */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1a2744", marginBottom: 12 }}>
          <i className="bi bi-calendar-event me-2" style={{ color: "#2563eb" }} />
          Próximas ausencias de {medicoNombre || "el médico"}
        </div>
        {cargando ? (
          <div className="text-muted small">Cargando…</div>
        ) : futuras.length === 0 ? (
          <div className="text-muted small">Sin ausencias registradas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {futuras.map(a => {
              const t = TIPOS_AUSENCIA[a.tipo];
              const mismoDia = a.fecha_inicio === a.fecha_fin;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid #eef2f7", background: t.bg + "55" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: t.bg, color: t.color, borderRadius: 6, padding: "3px 9px", fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                    <i className={`bi ${t.icon}`} />{t.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "#374151" }}>
                      {mismoDia
                        ? dayjs(a.fecha_inicio).format("dddd D [de] MMMM YYYY")
                        : `${dayjs(a.fecha_inicio).format("D MMM")} — ${dayjs(a.fecha_fin).format("D MMM YYYY")}`}
                      {Number(a.todo_el_dia) === 0 && <span style={{ color: "#6b7280", fontWeight: 500 }}> · {String(a.hora_inicio).slice(0,5)}–{String(a.hora_fin).slice(0,5)}</span>}
                    </div>
                    {a.motivo && <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{a.motivo}</div>}
                  </div>
                  <button className="btn btn-sm btn-light border" onClick={() => abrirEditar(a)}><i className="bi bi-pencil" /></button>
                  <button className="btn btn-sm btn-light border text-danger" onClick={() => eliminar(a)}><i className="bi bi-trash" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #eef2f7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.95rem" }}>{editId ? "Editar ausencia" : "Nueva ausencia"}</strong>
              <button className="btn btn-sm btn-light" onClick={() => setShowModal(false)}><i className="bi bi-x-lg" /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="form-label small fw-semibold mb-1">Tipo</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(TIPOS_AUSENCIA).map(([k, t]) => (
                    <button key={k} type="button" onClick={() => setForm(f => ({ ...f, tipo: k }))}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 7, padding: "5px 11px",
                        fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                        border: `1px solid ${form.tipo === k ? t.color : "#d1d5db"}`,
                        background: form.tipo === k ? t.bg : "#fff", color: form.tipo === k ? t.color : "#6b7280",
                      }}>
                      <i className={`bi ${t.icon}`} />{t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label small fw-semibold mb-1">Desde</label>
                  <input type="date" className="form-control form-control-sm" value={form.fecha_inicio}
                    onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value, fecha_fin: f.fecha_fin && f.fecha_fin >= e.target.value ? f.fecha_fin : e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label small fw-semibold mb-1">Hasta</label>
                  <input type="date" className="form-control form-control-sm" value={form.fecha_fin} min={form.fecha_inicio}
                    onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", cursor: "pointer" }}>
                <input type="checkbox" checked={form.todo_el_dia} onChange={e => setForm(f => ({ ...f, todo_el_dia: e.target.checked }))} />
                Todo el día
              </label>

              {!form.todo_el_dia && (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label small fw-semibold mb-1">Hora inicio</label>
                    <input type="time" className="form-control form-control-sm" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label small fw-semibold mb-1">Hora fin</label>
                    <input type="time" className="form-control form-control-sm" value={form.hora_fin} onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))} />
                  </div>
                </div>
              )}

              <div>
                <label className="form-label small fw-semibold mb-1">Motivo (opcional)</label>
                <input className="form-control form-control-sm" value={form.motivo} maxLength={255}
                  placeholder="Ej: Viaje familiar, cita médica…" onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
              </div>

              {conflictos && conflictos.length > 0 && (
                <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 12px", fontSize: "0.8rem", color: "#92400e" }}>
                  <div style={{ fontWeight: 700, cursor: "pointer" }} onClick={() => setVerConflictos(v => !v)}>
                    <i className="bi bi-exclamation-triangle-fill me-1" />
                    {conflictos.length} cita{conflictos.length !== 1 ? "s" : ""} ya agendada{conflictos.length !== 1 ? "s" : ""} en ese rango
                    <i className={`bi bi-chevron-${verConflictos ? "up" : "down"} ms-1`} />
                  </div>
                  {verConflictos && (
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      {conflictos.map(c => (
                        <li key={c.id}>
                          {dayjs(c.inicio).format("D MMM HH:mm")} — {c.pac_nombres} {c.pac_apellidos}
                          {c.pac_tel ? ` (${c.pac_tel})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ marginTop: 4, fontStyle: "italic" }}>Debes reprogramar o cancelar estas citas manualmente.</div>
                </div>
              )}

              {error && <div style={{ color: "#dc2626", fontSize: "0.82rem" }}><i className="bi bi-x-circle me-1" />{error}</div>}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #eef2f7", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-sm btn-light" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-sm btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando…" : editId ? "Guardar cambios" : "Registrar ausencia"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
