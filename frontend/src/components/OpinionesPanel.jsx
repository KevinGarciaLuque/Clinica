// Sección "Opiniones de pacientes" del Dashboard.
// ADMIN: activa el envío de encuestas y el enlace de reseñas de Google.
// Médico y ADMIN: ven las respuestas y deciden qué comentarios se publican.
import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import api from "../api/api";

const tarjeta = { background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };
const Estrellas = ({ n }) => (
  <span style={{ color: "#f59e0b", letterSpacing: 1 }}>{"★".repeat(n)}<span style={{ color: "#e2e8f0" }}>{"★".repeat(5 - n)}</span></span>
);

export default function OpinionesPanel({ isMobile }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState("pendientes"); // pendientes | publicadas | todas
  const [cfg, setCfg] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");

  const cargar = useCallback(() => {
    api.get("/opiniones/panel")
      .then((r) => { setD(r.data.data); setCfg({ activas: r.data.data.activas, google_url: r.data.data.google_url }); })
      .catch(() => setError(true));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (error || !d) return null; // la sección es un extra: si falla, el Dashboard sigue igual

  const publicar = async (id, publicada) => {
    setD((x) => ({ ...x, opiniones: x.opiniones.map((o) => (o.id === id ? { ...o, publicada } : o)) }));
    try { await api.patch(`/opiniones/${id}/publicar`, { publicada }); } catch { cargar(); }
  };

  const guardarConfig = async () => {
    setGuardando(true); setMsg("");
    try {
      await api.put("/opiniones/config", cfg);
      setMsg(cfg.activas ? "Listo: las encuestas se enviarán cada mañana a los pacientes atendidos el día anterior." : "Encuestas desactivadas.");
      cargar();
    } catch (e) {
      setMsg(e?.response?.data?.msg || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const total = d.opiniones.length;
  const promedio = total ? d.opiniones.reduce((a, o) => a + o.estrellas, 0) / total : null;
  const conComentario = d.opiniones.filter((o) => o.comentario);
  const pendientes = conComentario.filter((o) => !o.publicada);
  const lista = filtro === "pendientes" ? pendientes : filtro === "publicadas" ? conComentario.filter((o) => o.publicada) : d.opiniones;

  return (
    <div className={isMobile ? "px-1" : "px-3"} style={{ marginTop: isMobile ? 8 : 16 }}>
      <div style={{ ...tarjeta, padding: isMobile ? 14 : 20 }}>
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
          <div>
            <h6 className="mb-0" style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>
              <i className="bi bi-star-fill me-2" style={{ color: "#f59e0b" }} />Opiniones de pacientes
            </h6>
            <div style={{ fontSize: 12.5, color: "#64748b" }}>
              Solo opinan pacientes atendidos. Las estrellas siempre cuentan para el promedio; tú decides qué comentarios se publican.
            </div>
          </div>
          {total > 0 && (
            <div className="text-end">
              <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{promedio.toFixed(1)}</div>
              <div style={{ fontSize: 12 }}><Estrellas n={Math.round(promedio)} /> <span className="text-muted">({total})</span></div>
            </div>
          )}
        </div>

        {/* Configuración (solo administrador) */}
        {d.es_admin && cfg && (
          <div className="p-3 mb-3" style={{ background: "#f8fafc", borderRadius: 12 }}>
            <div className="form-check form-switch mb-2">
              <input className="form-check-input" type="checkbox" id="opActivas" checked={cfg.activas}
                onChange={(e) => setCfg({ ...cfg, activas: e.target.checked })} />
              <label className="form-check-label fw-semibold" htmlFor="opActivas" style={{ fontSize: 14 }}>
                Enviar encuesta por correo el día siguiente a cada consulta atendida
              </label>
            </div>
            <label className="form-label small fw-semibold mb-1">Enlace para reseñas de Google <span className="text-muted fw-normal">(opcional)</span></label>
            <input className="form-control form-control-sm mb-1" placeholder="https://g.page/r/…/review" value={cfg.google_url}
              onChange={(e) => setCfg({ ...cfg, google_url: e.target.value })} />
            <div className="text-muted mb-2" style={{ fontSize: 11.5 }}>
              A quien califique con 4 o 5 estrellas se le invita a dejar también una reseña en Google.
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button className="btn btn-sm fw-semibold" disabled={guardando} onClick={guardarConfig} style={{ background: "#2563eb", color: "#fff", borderRadius: 8 }}>
                {guardando ? <span className="spinner-border spinner-border-sm" /> : "Guardar"}
              </button>
              {msg && <span style={{ fontSize: 12.5, color: "#475569" }}>{msg}</span>}
            </div>
          </div>
        )}
        {!d.es_admin && !d.activas && total === 0 && (
          <div className="text-muted mb-3" style={{ fontSize: 13 }}>
            <i className="bi bi-info-circle me-1" />El administrador de la clínica puede activar el envío de encuestas desde su Dashboard.
          </div>
        )}

        {d.enviadas > 0 && (
          <div className="text-muted mb-2" style={{ fontSize: 12.5 }}>
            {d.enviadas} encuesta(s) enviada(s) · {d.respondidas} respondida(s)
            {d.enviadas ? ` (${Math.round((d.respondidas / d.enviadas) * 100)}%)` : ""}
          </div>
        )}

        {total > 0 && (
          <>
            <div className="d-flex gap-1 mb-2 flex-wrap">
              {[["pendientes", `Por revisar (${pendientes.length})`], ["publicadas", "Publicadas"], ["todas", "Todas"]].map(([id, label]) => (
                <button key={id} onClick={() => setFiltro(id)} className="btn btn-sm"
                  style={{ borderRadius: 999, fontSize: 12.5, fontWeight: 600, border: "1px solid #e5e7eb",
                    background: filtro === id ? "#0f172a" : "#fff", color: filtro === id ? "#fff" : "#475569" }}>
                  {label}
                </button>
              ))}
            </div>
            {lista.length === 0 ? (
              <div className="text-muted py-3 text-center" style={{ fontSize: 13 }}>
                {filtro === "pendientes" ? "No hay comentarios por revisar. 🎉" : "Nada por aquí todavía."}
              </div>
            ) : lista.slice(0, 30).map((o) => (
              <div key={o.id} className="d-flex gap-3 py-2" style={{ borderTop: "1px solid #f1f5f9" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="d-flex justify-content-between gap-2 flex-wrap">
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{o.paciente}</span>
                    <Estrellas n={o.estrellas} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
                    {dayjs(o.fecha).format("DD/MM/YYYY")}{d.es_admin ? ` · ${o.medico}` : ""} · se publicaría como “{o.autor_publico}”
                  </div>
                  {o.comentario
                    ? <p className="mb-1 mt-1" style={{ fontSize: 13.5, color: "#334155", fontStyle: "italic" }}>“{o.comentario}”</p>
                    : <p className="mb-1 mt-1 text-muted" style={{ fontSize: 12.5 }}>Solo calificó, sin comentario.</p>}
                </div>
                {o.comentario && (
                  <div className="d-flex align-items-start">
                    {o.publicada
                      ? <button className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 8, whiteSpace: "nowrap" }} onClick={() => publicar(o.id, false)}><i className="bi bi-eye-slash me-1" />Ocultar</button>
                      : <button className="btn btn-sm btn-success" style={{ borderRadius: 8, whiteSpace: "nowrap" }} onClick={() => publicar(o.id, true)}><i className="bi bi-check2 me-1" />Publicar</button>}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
