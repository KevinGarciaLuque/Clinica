import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ESTADO_CFG = {
  pendiente:  { label: "Pendiente",  color: "#f59e0b", bg: "rgba(245,158,11,.15)", border: "rgba(245,158,11,.3)",  icon: "bi-clock-fill" },
  en_proceso: { label: "En proceso", color: "#3b82f6", bg: "rgba(59,130,246,.15)", border: "rgba(59,130,246,.3)",  icon: "bi-arrow-repeat" },
  atendido:   { label: "Atendido",   color: "#10b981", bg: "rgba(16,185,129,.15)", border: "rgba(16,185,129,.3)",  icon: "bi-check-circle-fill" },
};

export default function SoporteHistorial() {
  const navigate = useNavigate();
  const [reportes, setReportes]       = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [filtro, setFiltro]           = useState("todos");
  const [busqueda, setBusqueda]       = useState("");
  const [expandido, setExpandido]     = useState(null);
  const [respuesta, setRespuesta]     = useState("");
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [guardando, setGuardando]     = useState(false);
  const [guardadoOk, setGuardadoOk]   = useState(null);
  const [errorMsg, setErrorMsg]       = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const cargar = async (silencioso = false) => {
    try {
      if (!silencioso) setCargando(true);
      setErrorMsg("");
      const r = await api.get("/soporte/reportes/historial");
      if (r.data.ok) {
        setReportes(r.data.data || []);
        setUltimaActualizacion(new Date());
      } else {
        setErrorMsg(r.data.msg || "Error al cargar reportes");
      }
    } catch (e) {
      setErrorMsg(e?.response?.data?.msg || e.message || "Error de conexión");
    } finally {
      setCargando(false);
    }
  };

  // Carga inicial + SSE en tiempo real + polling cada 15s como fallback
  useEffect(() => {
    cargar();

    // SSE
    let esRef = null;
    let cancelled = false;

    const connectSSE = async () => {
      try {
        const { data } = await api.post("/soporte/stream-token");
        if (cancelled) return;
        const es = new EventSource(`${API_URL}/api/soporte/stream?sse_token=${data.token}`);
        esRef = es;
        es.addEventListener("nuevo_reporte", () => cargar(true));
        es.onerror = () => {
          es.close();
          if (!cancelled) setTimeout(connectSSE, 5000);
        };
      } catch { /* sin conectividad */ }
    };

    connectSSE();

    const iv = setInterval(() => cargar(true), 15000);
    return () => { cancelled = true; esRef?.close(); clearInterval(iv); };
  }, []);

  const filtrados = reportes.filter(r => {
    if (filtro !== "todos" && r.estado !== filtro) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        r.asunto.toLowerCase().includes(q) ||
        r.usuario_nombre.toLowerCase().includes(q) ||
        (r.clinica_nombre || "").toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total:      reportes.length,
    pendiente:  reportes.filter(r => r.estado === "pendiente").length,
    en_proceso: reportes.filter(r => r.estado === "en_proceso").length,
    atendido:   reportes.filter(r => r.estado === "atendido").length,
  };

  const abrirCard = (r) => {
    if (expandido === r.id) {
      setExpandido(null); setRespuesta(""); setNuevoEstado("");
    } else {
      setExpandido(r.id);
      setRespuesta(r.respuesta || "");
      setNuevoEstado(r.estado);
    }
  };

  const guardar = async (id) => {
    if (!nuevoEstado) return;
    setGuardando(true);
    try {
      await api.put(`/soporte/reportes/${id}/estado`, { estado: nuevoEstado, respuesta });
      setGuardadoOk(id);
      setTimeout(() => setGuardadoOk(null), 2500);
      await cargar();
      setExpandido(null); setRespuesta(""); setNuevoEstado("");
    } catch {}
    finally { setGuardando(false); }
  };

  return (
    <div style={{ padding: "24px", minHeight: "100vh", background: "#0d1b2a", color: "#f1f5f9" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg, #ef4444, #dc2626)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 20px rgba(239,68,68,.35)", flexShrink: 0,
          }}>
            <i className="bi bi-bug-fill" style={{ color: "#fff", fontSize: 22 }} />
          </div>
          <div>
            <h4 style={{ color: "#f1f5f9", fontWeight: 800, margin: 0, fontSize: "1.2rem" }}>
              Reportes de Soporte
            </h4>
            <div style={{ color: "rgba(255,255,255,.35)", fontSize: "0.78rem", marginTop: 2 }}>
              Historial completo de problemas reportados por los usuarios
            </div>
          </div>
        </div>
        <button
          onClick={() => cargar()}
          style={{
            padding: "9px 18px", background: "rgba(255,255,255,.07)",
            border: "1px solid rgba(255,255,255,.12)", borderRadius: 10,
            color: "rgba(255,255,255,.6)", fontSize: "0.82rem", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 7, fontWeight: 600,
          }}
        >
          <i className="bi bi-arrow-clockwise" /> Actualizar
        </button>
      </div>

      {/* Error */}
      {errorMsg && (
        <div style={{
          background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          color: "#f87171", fontSize: "0.83rem", display: "flex", alignItems: "center", gap: 10,
        }}>
          <i className="bi bi-exclamation-triangle-fill" style={{ flexShrink: 0 }} />
          <span><strong>Error al cargar:</strong> {errorMsg}</span>
        </div>
      )}

      {/* Última actualización */}
      {ultimaActualizacion && (
        <div style={{ marginBottom: 16, color: "rgba(255,255,255,.2)", fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 5 }}>
          <i className="bi bi-arrow-repeat" style={{ fontSize: 10 }} />
          Actualizado {ultimaActualizacion.toLocaleTimeString("es-HN")} · se refresca cada 15s automáticamente
        </div>
      )}

      {/* ── Stats KPI ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { key: "total",      label: "Total",      val: stats.total,      color: "#94a3b8", bg: "rgba(148,163,184,.1)",  icon: "bi-collection-fill" },
          { key: "pendiente",  label: "Pendientes", val: stats.pendiente,  color: "#f59e0b", bg: "rgba(245,158,11,.1)",   icon: "bi-clock-fill" },
          { key: "en_proceso", label: "En proceso", val: stats.en_proceso, color: "#3b82f6", bg: "rgba(59,130,246,.1)",   icon: "bi-arrow-repeat" },
          { key: "atendido",   label: "Atendidos",  val: stats.atendido,   color: "#10b981", bg: "rgba(16,185,129,.1)",   icon: "bi-check-circle-fill" },
        ].map(s => (
          <div
            key={s.key}
            onClick={() => setFiltro(s.key)}
            style={{
              background: filtro === s.key ? s.bg : "#1e293b",
              border: `1px solid ${filtro === s.key ? s.color + "55" : "rgba(255,255,255,.07)"}`,
              borderRadius: 14, padding: "16px 18px",
              display: "flex", alignItems: "center", gap: 14,
              cursor: "pointer", transition: "all .2s",
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: s.bg, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className={`bi ${s.icon}`} style={{ color: s.color, fontSize: 18 }} />
            </div>
            <div>
              <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: "1.5rem", lineHeight: 1 }}>{s.val}</div>
              <div style={{ color: "rgba(255,255,255,.35)", fontSize: "0.72rem", marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filtros + búsqueda ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { key: "todos",      label: "Todos" },
            { key: "pendiente",  label: "Pendientes" },
            { key: "en_proceso", label: "En proceso" },
            { key: "atendido",   label: "Atendidos" },
          ].map(f => {
            const active = filtro === f.key;
            const cfg = ESTADO_CFG[f.key];
            return (
              <button key={f.key} onClick={() => setFiltro(f.key)} style={{
                padding: "7px 16px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700,
                background: active ? (cfg?.bg || "rgba(37,99,235,.2)") : "rgba(255,255,255,.05)",
                border: active ? `1px solid ${cfg?.border || "rgba(37,99,235,.4)"}` : "1px solid rgba(255,255,255,.1)",
                color: active ? (cfg?.color || "#93c5fd") : "rgba(255,255,255,.45)",
                cursor: "pointer", transition: "all .15s", display: "flex", alignItems: "center", gap: 6,
              }}>
                {cfg && <i className={`bi ${cfg.icon}`} style={{ fontSize: 11 }} />}
                {f.label}
                {f.key !== "todos" && stats[f.key] > 0 && (
                  <span style={{
                    background: "rgba(255,255,255,.12)", borderRadius: 5,
                    padding: "1px 6px", fontSize: "0.7rem",
                  }}>{stats[f.key]}</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <i className="bi bi-search" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.25)", fontSize: 13 }} />
          <input
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por asunto, usuario o clínica..."
            style={{
              width: "100%", padding: "9px 12px 9px 34px", boxSizing: "border-box",
              background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 10, color: "#f1f5f9", fontSize: "0.82rem", outline: "none",
            }}
          />
        </div>
      </div>

      {/* ── Lista de reportes ── */}
      {cargando ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,.3)" }}>
          <i className="bi bi-arrow-repeat" style={{ fontSize: 32, display: "block", marginBottom: 12, animation: "spin .8s linear infinite" }} />
          Cargando reportes...
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(255,255,255,.3)" }}>
          <i className="bi bi-inbox" style={{ fontSize: 38, display: "block", marginBottom: 12 }} />
          {busqueda ? "Sin resultados para la búsqueda" : `No hay reportes ${filtro !== "todos" ? `con estado "${ESTADO_CFG[filtro]?.label}"` : ""}`}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtrados.map(r => {
            const cfg = ESTADO_CFG[r.estado] || ESTADO_CFG.pendiente;
            const abierto = expandido === r.id;
            const fecha = new Date(r.creado_en).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

            return (
              <div key={r.id} style={{
                background: "#1a2744",
                border: `1px solid ${abierto ? cfg.border : "rgba(255,255,255,.07)"}`,
                borderRadius: 16, overflow: "hidden", transition: "border .2s",
              }}>
                {/* Cabecera clickable */}
                <div
                  onClick={() => abrirCard(r)}
                  style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14 }}
                >
                  {/* Badge estado */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <i className={`bi ${cfg.icon}`} style={{ color: cfg.color, fontSize: 16 }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Asunto + badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "0.92rem" }}>{r.asunto}</span>
                      <span style={{
                        background: cfg.bg, border: `1px solid ${cfg.border}`,
                        color: cfg.color, fontSize: "0.62rem", fontWeight: 800,
                        padding: "2px 8px", borderRadius: 5, textTransform: "uppercase", letterSpacing: "0.07em",
                      }}>{cfg.label}</span>
                      {guardadoOk === r.id && (
                        <span style={{ color: "#10b981", fontSize: "0.72rem", fontWeight: 700 }}>
                          <i className="bi bi-check-lg me-1" />Guardado
                        </span>
                      )}
                    </div>
                    {/* Metadatos */}
                    <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.76rem", display: "flex", gap: 14, flexWrap: "wrap" }}>
                      <span><i className="bi bi-person me-1" />{r.usuario_nombre}</span>
                      {r.clinica_nombre && <span><i className="bi bi-building me-1" />{r.clinica_nombre}</span>}
                      <span><i className="bi bi-calendar3 me-1" />{fecha}</span>
                      <span><i className="bi bi-hash me-1" />#{r.id}</span>
                    </div>
                    {/* Descripción preview */}
                    <div style={{ color: "rgba(255,255,255,.25)", fontSize: "0.76rem", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.descripcion}
                    </div>
                    {/* Si tiene respuesta */}
                    {r.respuesta && (
                      <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6, color: "#10b981", fontSize: "0.72rem" }}>
                        <i className="bi bi-reply-fill" />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.respuesta}
                        </span>
                      </div>
                    )}
                  </div>

                  <i className={`bi bi-chevron-${abierto ? "up" : "down"}`} style={{ color: "rgba(255,255,255,.2)", fontSize: 13, flexShrink: 0, marginTop: 4 }} />
                </div>

                {/* Panel expandido */}
                {abierto && (
                  <div style={{ padding: "0 20px 22px", borderTop: "1px solid rgba(255,255,255,.07)" }}>
                    {/* Descripción completa */}
                    <div style={{ marginTop: 18, marginBottom: 16 }}>
                      <div style={{ color: "rgba(255,255,255,.3)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
                        Descripción del problema
                      </div>
                      <div style={{
                        background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
                        borderRadius: 10, padding: "13px 15px",
                        color: "rgba(255,255,255,.65)", fontSize: "0.83rem", lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                      }}>
                        {r.descripcion}
                      </div>
                    </div>

                    {/* Info de contacto */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                      <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "6px 12px", fontSize: "0.74rem", color: "rgba(255,255,255,.4)", display: "flex", alignItems: "center", gap: 6 }}>
                        <i className="bi bi-envelope" style={{ color: "#60a5fa" }} />{r.usuario_email}
                      </div>
                    </div>

                    {/* ── Cambiar estado ── */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: "rgba(255,255,255,.3)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                        Cambiar estado
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {Object.entries(ESTADO_CFG).map(([key, c]) => {
                          const activo = nuevoEstado === key;
                          return (
                            <button key={key} onClick={() => setNuevoEstado(key)} style={{
                              padding: "8px 16px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700,
                              background: activo ? c.bg : "rgba(255,255,255,.05)",
                              border: activo ? `1px solid ${c.border}` : "1px solid rgba(255,255,255,.1)",
                              color: activo ? c.color : "rgba(255,255,255,.4)",
                              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all .15s",
                            }}>
                              <i className={`bi ${c.icon}`} style={{ fontSize: 12 }} />
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Respuesta al usuario ── */}
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ color: "rgba(255,255,255,.3)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
                        Respuesta al usuario{" "}
                        <span style={{ color: "#10b981", fontWeight: 400, textTransform: "none", fontSize: "0.7rem" }}>
                          — El usuario recibirá una notificación en su cuenta
                        </span>
                      </div>
                      <textarea
                        value={respuesta}
                        onChange={e => setRespuesta(e.target.value)}
                        rows={3}
                        placeholder="Escribe una respuesta clara para el usuario. Ej: 'El problema fue resuelto actualizando los permisos del módulo...'"
                        style={{
                          width: "100%", padding: "11px 13px", resize: "vertical",
                          background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
                          borderRadius: 10, color: "#f1f5f9", fontSize: "0.83rem",
                          outline: "none", lineHeight: 1.6, boxSizing: "border-box", fontFamily: "inherit",
                        }}
                        onFocus={e => e.target.style.borderColor = "rgba(37,99,235,.5)"}
                        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,.1)"}
                      />
                    </div>

                    {/* Botón guardar */}
                    <button
                      onClick={() => guardar(r.id)}
                      disabled={guardando}
                      style={{
                        padding: "11px 28px",
                        background: guardando ? "rgba(37,99,235,.4)" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                        border: "none", borderRadius: 12, color: "#fff",
                        fontWeight: 700, fontSize: "0.87rem", cursor: guardando ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: 8,
                        boxShadow: "0 4px 16px rgba(37,99,235,.3)",
                      }}
                    >
                      {guardando
                        ? <><i className="bi bi-arrow-repeat" style={{ animation: "spin .8s linear infinite" }} /> Guardando...</>
                        : <><i className="bi bi-check-lg" /> Guardar cambios y notificar</>
                      }
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: #1a2744; }
      `}</style>
    </div>
  );
}
