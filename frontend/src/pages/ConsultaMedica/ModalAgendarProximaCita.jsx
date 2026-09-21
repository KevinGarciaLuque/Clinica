import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { nombreMedico } from "../../utils/medico";

// ─── Modal Agendar Próxima Cita (desde tab Derma) ────────────────────────────
export default function ModalAgendarProximaCita({ paciente, pacienteId, onClose, onConfirm }) {
  const [medicos,     setMedicos]     = useState([]);
  const [medicoId,    setMedicoId]    = useState("");
  const [fechaSel,    setFechaSel]    = useState(dayjs().add(1, "week").format("YYYY-MM-DD"));
  const [slots,       setSlots]       = useState([]);
  const [slotSel,     setSlotSel]     = useState(null);
  const [horaInicio,  setHoraInicio]  = useState("");
  const [horaFin,     setHoraFin]     = useState("");
  const [tipo,        setTipo]        = useState("CONTROL");
  const [motivo,      setMotivo]      = useState("");
  const [loadSlots,   setLoadSlots]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState("");

  useEffect(() => {
    api.get("/usuarios/medicos")
      .then(r => setMedicos(r.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!medicoId || !fechaSel) { setSlots([]); return; }
    setLoadSlots(true);
    api.get("/citas/slots", { params: { medico_id: medicoId, fecha: fechaSel } })
      .then(r => setSlots(r.data.data || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadSlots(false));
  }, [medicoId, fechaSel]);

  const selSlot = (s) => {
    setSlotSel(s);
    setHoraInicio(dayjs(s.inicio).format("HH:mm"));
    setHoraFin(dayjs(s.fin).format("HH:mm"));
  };

  const handleConfirm = async () => {
    if (!medicoId) { setErr("Selecciona un médico"); return; }
    if (!horaInicio || !horaFin) { setErr("Selecciona un horario"); return; }
    const inicio = dayjs(`${fechaSel} ${horaInicio}`);
    const fin    = dayjs(`${fechaSel} ${horaFin}`);
    if (fin.isBefore(inicio) || fin.isSame(inicio)) {
      setErr("La hora de fin debe ser posterior a la de inicio"); return;
    }
    setSaving(true); setErr("");
    try {
      await api.post("/citas", {
        paciente_id:   paciente?.id || pacienteId,
        medico_id:     medicoId,
        inicio:        inicio.format("YYYY-MM-DD HH:mm:ss"),
        fin:           fin.format("YYYY-MM-DD HH:mm:ss"),
        tipo_consulta: tipo,
        motivo:        motivo || null,
        canal:         "RECEPCION",
      });
      onConfirm(inicio.format("YYYY-MM-DD HH:mm"));
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al agendar la cita");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 10500,
      background: "rgba(15,23,42,.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 560, background: "#fff",
        borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
          padding: "14px 18px", display: "flex", alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="bi bi-calendar-plus" style={{ color: "rgba(255,255,255,.8)", fontSize: "1.1rem" }}></i>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Agendar próxima cita</div>
              {paciente && (
                <div style={{ color: "rgba(255,255,255,.65)", fontSize: "0.75rem" }}>
                  {paciente.nombres} {paciente.apellidos}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px" }}>
          {err && (
            <div className="alert alert-danger py-2 mb-3" style={{ borderRadius: 8, fontSize: "0.85rem" }}>
              <i className="bi bi-exclamation-triangle me-2"></i>{err}
            </div>
          )}

          {/* Médico */}
          <div className="mb-3">
            <label className="form-label fw-semibold small">Médico</label>
            <select className="form-select form-select-sm" value={medicoId} onChange={e => { setMedicoId(e.target.value); setSlotSel(null); setHoraInicio(""); setHoraFin(""); }}>
              <option value="">— Seleccionar médico —</option>
              {medicos.map(m => (
                <option key={m.id} value={m.id}>{nombreMedico(m, { conEspecialidad: true, sep: "·" })}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold small">Fecha</label>
              <input type="date" className="form-control form-control-sm"
                min={dayjs().add(1, "day").format("YYYY-MM-DD")}
                value={fechaSel}
                onChange={e => { setFechaSel(e.target.value); setSlotSel(null); setHoraInicio(""); setHoraFin(""); }} />
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Tipo de consulta</label>
              <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                {["CONTROL","PRIMERA_VEZ","EMERGENCIA","TELECONSULTA"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Slots disponibles */}
          {medicoId && (
            <div className="mb-3">
              <label className="form-label fw-semibold small d-flex align-items-center gap-2">
                Horarios disponibles
                {loadSlots && <span className="spinner-border spinner-border-sm text-secondary" style={{ width: "0.75rem", height: "0.75rem" }}></span>}
              </label>
              {!loadSlots && slots.length === 0 && (
                <div className="text-muted small" style={{ padding: "8px 0" }}>
                  <i className="bi bi-calendar-x me-1"></i>Sin horarios disponibles para esta fecha. Prueba otro día.
                </div>
              )}
              {slots.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {slots.map((s, i) => {
                    const isSel = slotSel?.inicio === s.inicio;
                    return (
                      <button key={i} type="button"
                        onClick={() => selSlot(s)}
                        style={{
                          padding: "5px 12px", borderRadius: 8, fontSize: "0.78rem",
                          fontWeight: isSel ? 700 : 500, cursor: "pointer",
                          border: `1.5px solid ${isSel ? "#1d4ed8" : "#d1d5db"}`,
                          background: isSel ? "#dbeafe" : "#f9fafb",
                          color: isSel ? "#1a2744" : "#374151",
                          transition: "all .12s",
                        }}>
                        {dayjs(s.inicio).format("HH:mm")} – {dayjs(s.fin).format("HH:mm")}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Hora manual (si no hay slots o quiere personalizar) */}
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold small">Hora inicio</label>
              <input type="time" className="form-control form-control-sm"
                value={horaInicio} onChange={e => { setHoraInicio(e.target.value); setSlotSel(null); }} />
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Hora fin</label>
              <input type="time" className="form-control form-control-sm"
                value={horaFin} onChange={e => { setHoraFin(e.target.value); setSlotSel(null); }} />
            </div>
          </div>

          {/* Motivo */}
          <div className="mb-1">
            <label className="form-label fw-semibold small">Motivo (opcional)</label>
            <input className="form-control form-control-sm" value={motivo}
              onChange={e => setMotivo(e.target.value)} placeholder="Control, revisión, seguimiento…" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn btn-sm"
            disabled={saving || !medicoId || !horaInicio || !horaFin}
            onClick={handleConfirm}
            style={{
              background: "linear-gradient(135deg, #213564, #1a2744)",
              color: "#fff", border: "none", fontWeight: 600, borderRadius: 8,
              padding: "6px 20px",
            }}>
            <i className="bi bi-calendar-check me-1"></i>
            {saving ? "Agendando…" : "Confirmar cita"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
