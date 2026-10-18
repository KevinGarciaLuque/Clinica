import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import api from "../api/api";
import { hoyClinica } from "../utils/zonaClinica";

// Recordatorios de citas por WhatsApp "con un clic": se abre WhatsApp con el
// mensaje listo (incluye el enlace para confirmar o cancelar) y solo se envía.

const sumarDias = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(y, m - 1, d + n);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};
const horaCorta = (v) => {
  try { return new Date(v).toLocaleTimeString("es-HN", { hour: "numeric", minute: "2-digit" }); } catch { return ""; }
};

function Respuesta({ c }) {
  if (c.respuesta === "CONFIRMADA") return <span className="badge rounded-pill" style={{ background: "#dcfce7", color: "#166534" }}><i className="bi bi-check-circle-fill me-1" />Confirmó</span>;
  if (c.respuesta === "CANCELADA") return <span className="badge rounded-pill" style={{ background: "#fee2e2", color: "#991b1b" }}><i className="bi bi-x-circle-fill me-1" />Canceló</span>;
  if (c.enviado_en) return <span className="badge rounded-pill" style={{ background: "#f1f5f9", color: "#475569" }}><i className="bi bi-hourglass-split me-1" />Sin respuesta</span>;
  return null;
}

export default function RecordatoriosWhatsapp({ onCerrar }) {
  const hoy = hoyClinica();
  const [fecha, setFecha] = useState(() => sumarDias(hoy, 1));
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null); // cita con el mensaje desplegado

  const cargar = useCallback(() => {
    api.get("/recordatorios-whatsapp", { params: { fecha } })
      .then((r) => { setError(""); setDatos(r.data); })
      .catch((e) => { setDatos({ data: [] }); setError(e.response?.data?.msg || "No se pudieron cargar las citas."); });
  }, [fecha]);
  useEffect(() => { cargar(); }, [cargar]);
  const cambiarFecha = (f) => { if (f && f !== fecha) { setDatos(null); setFecha(f); } };

  // Al volver a la pestaña (después de enviar en WhatsApp) se actualizan las respuestas
  useEffect(() => {
    const f = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [cargar]);

  const lista = useMemo(() => datos?.data || [], [datos]);
  const pendientes = lista.filter((c) => c.whatsapp && !c.enviado_en && c.respuesta !== "CONFIRMADA" && c.respuesta !== "CANCELADA");
  const resumen = {
    total: lista.length,
    enviados: lista.filter((c) => c.enviado_en).length,
    confirmaron: lista.filter((c) => c.respuesta === "CONFIRMADA").length,
    sinTelefono: lista.filter((c) => !c.whatsapp).length,
  };

  const enviar = (c) => {
    // Se abre WhatsApp dentro del clic (si no, el navegador lo bloquea)
    window.open(c.whatsapp, "_blank", "noopener");
    setDatos((d) => ({ ...d, data: d.data.map((x) => (x.cita_id === c.cita_id ? { ...x, enviado_en: new Date().toISOString(), veces: (x.veces || 0) + 1 } : x)) }));
    api.post(`/recordatorios-whatsapp/${c.cita_id}/enviado`).catch(() => {});
  };

  const [copiado, setCopiado] = useState(null);
  const copiar = async (c) => {
    try {
      await navigator.clipboard.writeText(c.mensaje);
      setCopiado(c.cita_id);
      setTimeout(() => setCopiado(null), 2000);
    } catch { /* sin portapapeles */ }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div style={{ background: "#f8fafc", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "94vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden" }}>
        {/* Encabezado */}
        <div style={{ background: "linear-gradient(135deg, #075e54, #128c7e)", color: "#fff", padding: "14px 16px" }}>
          <div className="d-flex align-items-start gap-2">
            <i className="bi bi-whatsapp fs-4" />
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div className="fw-bold">Recordatorios por WhatsApp</div>
              <div style={{ fontSize: ".78rem", opacity: 0.85 }}>Toque «Enviar»: WhatsApp se abre con el mensaje listo y el enlace para confirmar o cancelar.</div>
            </div>
            <button type="button" className="btn-close btn-close-white" aria-label="Cerrar" onClick={onCerrar} />
          </div>
          <div className="d-flex flex-wrap gap-2 mt-3 align-items-center">
            {[[hoy, "Hoy"], [sumarDias(hoy, 1), "Mañana"], [sumarDias(hoy, 2), "Pasado mañana"]].map(([f, l]) => (
              <button key={f} type="button" onClick={() => cambiarFecha(f)} className="btn btn-sm"
                style={{ background: fecha === f ? "#fff" : "rgba(255,255,255,.15)", color: fecha === f ? "#075e54" : "#fff", fontWeight: 600, border: "none" }}>
                {l}
              </button>
            ))}
            <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={fecha} onChange={(e) => cambiarFecha(e.target.value)} />
          </div>
        </div>

        <div style={{ padding: "12px 14px", overflowY: "auto" }}>
          {error && <div className="alert alert-warning py-2 small">{error}</div>}
          {!datos ? (
            <div className="text-center py-5"><span className="spinner-border text-success" /></div>
          ) : (
            <>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <div className="small text-muted">
                  <span className="fw-semibold text-dark">{datos.dia ? datos.dia[0].toUpperCase() + datos.dia.slice(1) : ""}</span> · {resumen.total} {resumen.total === 1 ? "cita" : "citas"} · {resumen.enviados} enviados · {resumen.confirmaron} confirmaron
                </div>
                {pendientes.length > 0 && (
                  <button className="btn btn-success btn-sm fw-semibold" onClick={() => enviar(pendientes[0])}>
                    <i className="bi bi-send-fill me-1" />Enviar al siguiente ({pendientes.length} por enviar)
                  </button>
                )}
              </div>

              {lista.length === 0 && (
                <div className="text-center text-muted py-5"><i className="bi bi-calendar-x fs-2 d-block mb-1" />No hay citas pendientes para este día.</div>
              )}

              <div className="d-flex flex-column gap-2">
                {lista.map((c) => (
                  <div key={c.cita_id} className="bg-white rounded-3 p-2" style={{ border: "1px solid #e2e8f0" }}>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <div className="text-center" style={{ minWidth: 64 }}>
                        <div className="fw-bold" style={{ fontSize: ".9rem" }}>{c.hora}</div>
                      </div>
                      <div className="flex-grow-1" style={{ minWidth: 150 }}>
                        <Link to={`/pacientes/${c.paciente_id}/perfil`} onClick={onCerrar} className="fw-semibold text-decoration-none text-break">{c.paciente}</Link>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          {c.medico}{c.telefono ? ` · ${c.telefono}` : ""}
                        </div>
                        <div className="d-flex flex-wrap gap-1 mt-1 align-items-center">
                          <Respuesta c={c} />
                          {c.enviado_en && (
                            <span className="text-muted" style={{ fontSize: ".72rem" }}>
                              <i className="bi bi-check2-all me-1 text-success" />Enviado {horaCorta(c.enviado_en)}{c.veces > 1 ? ` (${c.veces} veces)` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="d-flex gap-1 ms-auto">
                        <button type="button" className="btn btn-sm btn-light" title="Ver mensaje" onClick={() => setAbierto(abierto === c.cita_id ? null : c.cita_id)}>
                          <i className={`bi ${abierto === c.cita_id ? "bi-chevron-up" : "bi-chat-text"}`} />
                        </button>
                        {c.whatsapp ? (
                          <button type="button" className={`btn btn-sm ${c.enviado_en ? "btn-outline-success" : "btn-success"}`} onClick={() => enviar(c)}>
                            <i className="bi bi-whatsapp me-1" />{c.enviado_en ? "Reenviar" : "Enviar"}
                          </button>
                        ) : (
                          <span className="badge text-bg-light border align-self-center" title="El paciente no tiene teléfono registrado">Sin teléfono</span>
                        )}
                      </div>
                    </div>
                    {abierto === c.cita_id && (
                      <div className="mt-2 p-2 rounded-3" style={{ background: "#e7f8ef", fontSize: ".8rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {c.mensaje}
                        <div className="text-end mt-1">
                          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => copiar(c)}><i className={`bi ${copiado === c.cita_id ? "bi-check2" : "bi-clipboard"} me-1`} />{copiado === c.cita_id ? "Copiado" : "Copiar"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {resumen.sinTelefono > 0 && (
                <div className="text-muted mt-2" style={{ fontSize: ".75rem" }}>
                  <i className="bi bi-info-circle me-1" />{resumen.sinTelefono} {resumen.sinTelefono === 1 ? "paciente no tiene" : "pacientes no tienen"} teléfono: agréguelo en su ficha para poder enviarle el recordatorio.
                </div>
              )}
              <div className="text-muted mt-1" style={{ fontSize: ".75rem" }}>
                <i className="bi bi-lightbulb me-1" />Cuando el paciente confirma o cancela desde el enlace, la cita se actualiza sola y aquí lo verá.
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
