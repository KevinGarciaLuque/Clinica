// Recordatorio de control:
//  - ModalProgramarControl: desde el detalle de una cita ("control en 1 mes…")
//  - ControlesPanel: pestaña "Controles" de Citas (quién debe volver y si ya agendó)
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import api from "../api/api";

const RAPIDOS = [
  { label: "1 semana", n: 1, u: "week" },
  { label: "2 semanas", n: 2, u: "week" },
  { label: "1 mes", n: 1, u: "month" },
  { label: "3 meses", n: 3, u: "month" },
  { label: "6 meses", n: 6, u: "month" },
  { label: "1 año", n: 1, u: "year" },
];

const ESTADO = {
  PENDIENTE: { label: "Programado", color: "#64748b", icon: "bi-clock" },
  AVISADO:   { label: "Avisado, sin cita", color: "#f59e0b", icon: "bi-envelope-check" },
  AGENDADO:  { label: "Agendó", color: "#10b981", icon: "bi-check-circle-fill" },
  CANCELADO: { label: "Cancelado", color: "#94a3b8", icon: "bi-x-circle" },
};

export function ModalProgramarControl({ cita, onClose, onGuardado }) {
  const base = dayjs(cita.inicio);
  const [fecha, setFecha] = useState(base.add(1, "month").format("YYYY-MM-DD"));
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async () => {
    setGuardando(true); setError("");
    try {
      await api.post("/controles", {
        paciente_id: cita.paciente_id, medico_id: cita.medico_id, cita_origen_id: cita.id,
        fecha_objetivo: fecha, motivo,
      });
      onGuardado?.();
    } catch (e) {
      setError(e?.response?.data?.msg || "No se pudo programar el control.");
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 22, width: "100%", maxWidth: 440, boxShadow: "0 20px 50px rgba(0,0,0,.25)" }}>
        <h6 style={{ fontWeight: 800, margin: "0 0 4px", color: "#0f172a" }}><i className="bi bi-arrow-repeat me-2" style={{ color: "#10b981" }} />Programar control</h6>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
          {cita.paciente_nombres} {cita.paciente_apellidos} recibirá un correo 7 días antes con el enlace para agendar.
        </div>

        <div className="d-flex flex-wrap gap-2 mb-3">
          {RAPIDOS.map((r) => {
            const f = base.add(r.n, r.u).format("YYYY-MM-DD");
            const activo = f === fecha;
            return (
              <button key={r.label} type="button" onClick={() => setFecha(f)} className="btn btn-sm"
                style={{ borderRadius: 999, fontWeight: 600, fontSize: 13, border: `1.5px solid ${activo ? "#10b981" : "#e2e8f0"}`, background: activo ? "#ecfdf5" : "#fff", color: activo ? "#047857" : "#475569" }}>
                {r.label}
              </button>
            );
          })}
        </div>

        <label className="form-label small fw-semibold mb-1">Fecha aproximada del control</label>
        <input type="date" className="form-control form-control-sm mb-3" value={fecha} min={dayjs().add(1, "day").format("YYYY-MM-DD")} onChange={(e) => setFecha(e.target.value)} />

        <label className="form-label small fw-semibold mb-1">Motivo <span className="text-muted fw-normal">(opcional, el paciente lo verá)</span></label>
        <input className="form-control form-control-sm mb-2" maxLength={200} placeholder="Ej. revisión de exámenes, control de presión" value={motivo} onChange={(e) => setMotivo(e.target.value)} />

        {!cita.paciente_email && (
          <div className="small text-warning-emphasis mb-2"><i className="bi bi-exclamation-triangle me-1" />Si el paciente no tiene correo, no recibirá el aviso: aparecerá en la pestaña Controles para llamarle.</div>
        )}
        {error && <div className="small text-danger mb-2">{error}</div>}

        <div className="d-flex gap-2 justify-content-end mt-3">
          <button className="btn btn-light btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-sm fw-semibold" disabled={guardando || !fecha} onClick={guardar} style={{ background: "#10b981", color: "#fff", borderRadius: 8 }}>
            {guardando ? <span className="spinner-border spinner-border-sm" /> : <>Programar para el {dayjs(fecha).format("DD/MM/YYYY")}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ControlesPanel() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("abiertos");

  const cargar = useCallback(() => {
    api.get("/controles").then((r) => { setRows(r.data.data); setError(""); })
      .catch((e) => setError(e?.response?.data?.msg || "No se pudieron cargar los controles."));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cancelar = async (id) => {
    try { await api.patch(`/controles/${id}`, { estado: "CANCELADO" }); cargar(); }
    catch (e) { setError(e?.response?.data?.msg || "No se pudo cancelar."); }
  };

  const hoy = dayjs().format("YYYY-MM-DD");
  const lista = (rows || []).filter((r) =>
    filtro === "abiertos" ? ["PENDIENTE", "AVISADO"].includes(r.estado)
      : filtro === "llamar" ? r.estado === "AVISADO" || (r.estado === "PENDIENTE" && (!r.tiene_email && r.fecha_objetivo <= dayjs().add(7, "day").format("YYYY-MM-DD")))
      : filtro === "agendados" ? r.estado === "AGENDADO" : true);
  const nLlamar = (rows || []).filter((r) => r.estado === "AVISADO" || (r.estado === "PENDIENTE" && !r.tiene_email && r.fecha_objetivo <= dayjs().add(7, "day").format("YYYY-MM-DD"))).length;

  return (
    <div>
      <style>{`
        @media (max-width: 767.98px) {
          .ctl-tabla thead { display: none; }
          .ctl-tabla, .ctl-tabla tbody, .ctl-tabla tr, .ctl-tabla td { display: block; width: 100%; }
          .ctl-tabla tr { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; position: relative; }
          .ctl-tabla td { border: none !important; padding: 2px 0 !important; text-align: left !important; }
          .ctl-tabla td.ctl-acc { position: absolute; top: 10px; right: 12px; width: auto; }
        }
      `}</style>
      <p className="text-muted mb-3" style={{ fontSize: "0.85rem", maxWidth: 620 }}>
        <i className="bi bi-arrow-repeat me-1" style={{ color: "#10b981" }} />
        Programa un control desde el detalle de cualquier cita. 7 días antes el paciente recibe un correo para agendar;
        si agenda, el control se marca solo. Los que no agendan aparecen en <strong>“Por llamar”</strong>.
      </p>

      <div className="d-flex gap-1 mb-3 flex-wrap">
        {[["abiertos", "Próximos"], ["llamar", `Por llamar (${nLlamar})`], ["agendados", "Agendaron"], ["todos", "Todos"]].map(([id, label]) => (
          <button key={id} onClick={() => setFiltro(id)} className="btn btn-sm"
            style={{ borderRadius: 999, fontSize: 12.5, fontWeight: 600, border: "1px solid #e5e7eb", background: filtro === id ? "#0f172a" : "#fff", color: filtro === id ? "#fff" : "#475569" }}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {!rows && !error && <div className="text-muted small py-3"><span className="spinner-border spinner-border-sm me-2" />Cargando…</div>}
      {rows && lista.length === 0 && (
        <div className="text-center text-muted py-4" style={{ fontSize: "0.88rem" }}>
          <i className="bi bi-calendar2-check d-block mb-2" style={{ fontSize: 28 }} />
          {filtro === "llamar" ? "Nadie pendiente de llamada. 🎉" : "No hay controles en esta vista."}
        </div>
      )}
      {lista.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle ctl-tabla" style={{ fontSize: "0.87rem" }}>
            <thead><tr className="text-muted small"><th>Paciente</th><th>Médico</th><th>Control</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {lista.map((r) => {
                const e = ESTADO[r.estado];
                const vencido = ["PENDIENTE", "AVISADO"].includes(r.estado) && r.fecha_objetivo < hoy;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="fw-semibold">{r.paciente_nombres} {r.paciente_apellidos}</div>
                      <div className="small">
                        {r.paciente_telefono ? <a href={`tel:${r.paciente_telefono}`}>{r.paciente_telefono}</a> : <span className="text-muted">Sin teléfono</span>}
                        {!r.tiene_email && <span className="text-danger ms-2"><i className="bi bi-envelope-slash" /> sin correo</span>}
                      </div>
                    </td>
                    <td className="small">{r.medico}</td>
                    <td className="small">
                      <span style={{ fontWeight: 600, color: vencido ? "#dc2626" : "#0f172a" }}>{dayjs(r.fecha_objetivo).format("DD/MM/YYYY")}</span>
                      {vencido && <span className="text-danger ms-1">(vencido)</span>}
                      {r.motivo && <div className="text-muted">{r.motivo}</div>}
                    </td>
                    <td className="small">
                      <span style={{ color: e.color, fontWeight: 700 }}><i className={`bi ${e.icon} me-1`} />{e.label}</span>
                      {r.estado === "AVISADO" && r.avisado_en && <div className="text-muted">Correo: {dayjs(r.avisado_en).format("DD/MM")}</div>}
                      {r.estado === "AGENDADO" && r.cita_inicio && <div className="text-muted">Cita: {dayjs(r.cita_inicio).format("DD/MM h:mm A")}</div>}
                    </td>
                    <td className="text-end ctl-acc">
                      {["PENDIENTE", "AVISADO"].includes(r.estado) && (
                        <button className="btn btn-link btn-sm text-danger p-0" onClick={() => cancelar(r.id)}>Quitar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
