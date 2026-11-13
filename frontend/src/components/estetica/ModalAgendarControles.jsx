import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import { nombreMedico } from "../../utils/medico";
import { hoyClinica } from "../../utils/zonaClinica";
import { FASES_CONTROL } from "../../utils/esteticaCatalogos";

/**
 * Agenda de una vez los controles después del procedimiento (Semana 1, 1 mes…)
 * como citas reales. Los recordatorios al paciente salen solos, como en
 * cualquier otra cita, según la configuración de recordatorios de la clínica.
 */
export default function ModalAgendarControles({ paciente, pacienteId, fases, procedimiento, onClose, onAgendado }) {
  const { user } = useAuth();
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState("");
  const [duracion, setDuracion] = useState(30);
  const [filas, setFilas] = useState(() => {
    const hoy = hoyClinica();
    return FASES_CONTROL.filter((f) => fases.includes(f.key)).map((f) => ({
      fase: f.key, label: f.label, incluir: true,
      fecha: dayjs(hoy).add(f.dias, "day").format("YYYY-MM-DD"), hora: "09:00", error: "",
    }));
  });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get("/usuarios/medicos").then((r) => {
      const l = r.data.data || [];
      setMedicos(l);
      const yo = l.find((m) => String(m.id) === String(user?.id || user?.uid));
      setMedicoId(String((yo || l[0])?.id || ""));
    }).catch(() => {});
  }, [user?.id, user?.uid]);

  const cambiar = (i, campo, v) => setFilas((l) => l.map((f, j) => (j === i ? { ...f, [campo]: v, error: "" } : f)));

  const agendar = async () => {
    if (!medicoId) return;
    setGuardando(true);
    const hechos = [];
    const siguen = [];
    for (const f of filas) {
      if (!f.incluir) continue;
      const inicio = dayjs(`${f.fecha} ${f.hora}`);
      try {
        const r = await api.post("/citas", {
          paciente_id: paciente?.id || pacienteId,
          medico_id: medicoId,
          inicio: inicio.format("YYYY-MM-DD HH:mm:ss"),
          fin: inicio.add(duracion, "minute").format("YYYY-MM-DD HH:mm:ss"),
          tipo_consulta: "Revisión postprocedimiento",
          motivo: `Control ${f.label}${procedimiento ? ` — ${procedimiento}` : ""}`,
          canal: "RECEPCION",
        });
        hechos.push({ fase: f.fase, label: f.label, fecha: f.fecha, hora: f.hora, cita_id: r.data.id || null });
      } catch (e) {
        siguen.push({ ...f, error: e.response?.status === 409 ? "Ese horario ya está ocupado: elija otra hora." : (e.response?.data?.msg || "No se pudo agendar.") });
      }
    }
    setGuardando(false);
    if (hechos.length) onAgendado?.(hechos);
    if (siguen.length) setFilas(siguen); // quedan solo los que no se pudieron, para corregirlos
    else onClose();
  };

  const inp = { width: "100%", padding: "7px 9px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.88rem" };
  const cuantos = filas.filter((f) => f.incluir).length;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1080, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "94vh", overflowY: "auto", padding: 18 }}>
        <div className="d-flex align-items-center mb-2">
          <h6 className="mb-0" style={{ fontWeight: 800, color: "#7c3aed" }}><i className="bi bi-calendar-plus me-2" />Agendar controles</h6>
          <button type="button" className="btn-close ms-auto" aria-label="Cerrar" onClick={onClose} />
        </div>
        <div className="text-muted mb-3" style={{ fontSize: "0.84rem" }}>
          Se crean las citas en la agenda. El paciente recibe el recordatorio como en cualquier otra cita.
        </div>
        <div className="d-flex gap-2 mb-3 flex-wrap">
          <div style={{ flex: "2 1 200px" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 700 }}>Médico</label>
            <select style={inp} value={medicoId} onChange={(e) => setMedicoId(e.target.value)}>
              {medicos.map((m) => <option key={m.id} value={m.id}>{nombreMedico(m) || `${m.nombres || ""} ${m.apellidos || ""}`}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 700 }}>Duración</label>
            <select style={inp} value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
              {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </div>
        </div>
        {filas.map((f, i) => (
          <div key={f.fase} className="mb-2" style={{ border: `1px solid ${f.error ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 10, padding: "8px 10px", opacity: f.incluir ? 1 : 0.55 }}>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <label className="d-flex align-items-center gap-2" style={{ fontWeight: 700, minWidth: 110, cursor: "pointer" }}>
                <input type="checkbox" className="form-check-input m-0" checked={f.incluir} onChange={(e) => cambiar(i, "incluir", e.target.checked)} />
                {f.label}
              </label>
              <input type="date" style={{ ...inp, width: 150 }} value={f.fecha} disabled={!f.incluir} onChange={(e) => cambiar(i, "fecha", e.target.value)} />
              <input type="time" style={{ ...inp, width: 110 }} value={f.hora} disabled={!f.incluir} onChange={(e) => cambiar(i, "hora", e.target.value)} />
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>{dayjs(f.fecha).isValid() ? new Date(`${f.fecha}T12:00:00`).toLocaleDateString("es", { weekday: "long" }) : ""}</span>
            </div>
            {f.error && <div style={{ color: "#b91c1c", fontSize: "0.78rem", marginTop: 4 }}><i className="bi bi-exclamation-circle me-1" />{f.error}</div>}
          </div>
        ))}
        <div className="d-flex mt-3">
          <button type="button" className="btn ms-auto" style={{ background: "#7c3aed", color: "#fff", fontWeight: 700 }}
            disabled={guardando || !cuantos || !medicoId} onClick={agendar}>
            {guardando ? "Agendando…" : `Agendar ${cuantos} cita${cuantos === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
