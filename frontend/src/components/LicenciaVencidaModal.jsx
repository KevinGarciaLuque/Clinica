/**
 * LicenciaVencidaModal.jsx
 * Modal bloqueante que se muestra cuando la licencia de la clínica ha vencido.
 * Solo para usuarios no-SUPER_ADMIN.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import api from "../api/api";

const C = {
  bg:      "#0d1b2e",
  surface: "#112240",
  border:  "rgba(255,255,255,0.07)",
  text:    "#e2e8f0",
  muted:   "#94a3b8",
  accent:  "#2196f3",
  warning: "#f59e0b",
  danger:  "#ef4444",
  success: "#10b981",
};

const PLANES_LABEL = {
  trial:     { label: "Prueba",    color: "#f59e0b", icon: "bi-clock-history" },
  semestral: { label: "Semestral", color: "#2196f3", icon: "bi-calendar2-check" },
  anual:     { label: "Anual",     color: "#10b981", icon: "bi-award-fill" },
};

const PLANES = [
  { key: "semestral", label: "Semestral", sub: "6 meses",  icon: "bi-calendar2-check", color: "#2196f3" },
  { key: "anual",     label: "Anual",     sub: "12 meses", icon: "bi-award-fill",       color: "#10b981", rec: true },
];

export default function LicenciaVencidaModal() {
  const { user, licenciaInfo, logout } = useAuth();
  const [visible, setVisible]           = useState(false);
  const [manualOpen, setManualOpen]     = useState(false);
  const [planSel, setPlanSel]           = useState("anual");
  const [mensaje, setMensaje]           = useState("");
  const [enviando, setEnviando]         = useState(false);
  const [enviado, setEnviado]           = useState(false);
  const [errorMsg, setErrorMsg]         = useState("");

  const esVencida = !!(user && !user.super && licenciaInfo?.vencida);

  useEffect(() => {
    if (esVencida) {
      setVisible(true);
      setManualOpen(false);
    } else if (!manualOpen) {
      setVisible(false);
    }
  }, [esVencida]); // eslint-disable-line

  useEffect(() => {
    const handlerVencida = () => setVisible(true);
    const handlerManual  = () => {
      if (!esVencida) {
        setManualOpen(true);
        setEnviado(false);
        setErrorMsg("");
        setMensaje("");
        setPlanSel("anual");
      }
      setVisible(true);
    };
    window.addEventListener("licenciaVencida", handlerVencida);
    window.addEventListener("solicitarPlan",   handlerManual);
    return () => {
      window.removeEventListener("licenciaVencida", handlerVencida);
      window.removeEventListener("solicitarPlan",   handlerManual);
    };
  }, [esVencida]); // eslint-disable-line

  const cerrarManual = () => { setVisible(false); setManualOpen(false); };

  if (!visible) return null;

  const fin = licenciaInfo?.licencia_fin ? new Date(licenciaInfo.licencia_fin) : null;
  const fechaVencimiento = fin
    ? fin.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })
    : "—";
  const planInfo = PLANES_LABEL[licenciaInfo?.plan_tipo] || PLANES_LABEL.trial;

  const handleEnviar = async () => {
    setEnviando(true);
    setErrorMsg("");
    try {
      await api.post("/clinicas/solicitar-licencia", {
        plan_solicitado: planSel,
        mensaje: mensaje.trim() || null,
      });
      setEnviado(true);
    } catch (e) {
      setErrorMsg(e.response?.data?.msg || "Error al enviar la solicitud");
    } finally {
      setEnviando(false);
    }
  };

  // colores del header según estado
  const hColor  = enviado ? C.success : manualOpen ? C.accent : C.danger;
  const hBorder = enviado ? "rgba(16,185,129,.4)" : manualOpen ? "rgba(33,150,243,.4)" : "rgba(239,68,68,.4)";
  const hBg     = enviado
    ? "linear-gradient(135deg, rgba(16,185,129,.15), rgba(16,185,129,.08))"
    : manualOpen
      ? "linear-gradient(135deg, rgba(33,150,243,.15), rgba(33,150,243,.08))"
      : "linear-gradient(135deg, rgba(239,68,68,.15), rgba(220,38,38,.08))";
  const hIcon   = enviado ? "bi-check-circle-fill" : manualOpen ? "bi-arrow-up-circle-fill" : "bi-lock-fill";
  const hTitle  = enviado ? "Solicitud Enviada" : manualOpen ? "Solicitar Plan" : "Licencia Vencida";
  const hSub    = enviado
    ? "El administrador fue notificado y revisará tu solicitud"
    : manualOpen
      ? "Elige el plan que deseas y envía tu solicitud al administrador"
      : "El acceso a tu clínica ha sido suspendido";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,.85)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={manualOpen && !esVencida ? cerrarManual : undefined}
    >
      <div
        style={{
          background: C.surface,
          border: `2px solid ${hBorder}`,
          borderRadius: 20, width: "100%", maxWidth: 500,
          boxShadow: `0 24px 80px ${enviado ? "rgba(16,185,129,.2)" : manualOpen ? "rgba(33,150,243,.2)" : "rgba(239,68,68,.25)"}`,
          overflow: "hidden", maxHeight: "95vh",
          display: "flex", flexDirection: "column",
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div style={{
          background: hBg,
          padding: "28px 32px 24px",
          textAlign: "center",
          borderBottom: `1px solid ${hBorder}`,
          position: "relative",
        }}>
          {/* Botón cerrar — solo en apertura manual */}
          {manualOpen && !esVencida && (
            <button
              onClick={cerrarManual}
              style={{
                position: "absolute", top: 12, right: 14,
                background: "rgba(255,255,255,.07)", border: "none",
                borderRadius: 8, width: 30, height: 30, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: C.muted, fontSize: 16,
              }}
            >
              <i className="bi bi-x" />
            </button>
          )}
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: "0 auto 16px",
            background: `${hColor}26`,
            border: `2px solid ${hBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className={`bi ${hIcon}`} style={{ fontSize: 30, color: hColor }} />
          </div>
          <h4 style={{ color: hColor, margin: 0, fontWeight: 700, fontSize: 20 }}>
            {hTitle}
          </h4>
          <p style={{ color: C.muted, margin: "8px 0 0", fontSize: 13 }}>
            {hSub}
          </p>
        </div>

        {/* Cuerpo + Footer — scrollable */}
        <div style={{ overflowY: "auto", flex: 1 }}>
        {/* Cuerpo */}
        <div style={{ padding: "24px 32px" }}>

          {/* Info del plan actual */}
          <div style={{
            background: manualOpen && !esVencida ? `${planInfo.color}10` : "rgba(239,68,68,.06)",
            border: `1px solid ${manualOpen && !esVencida ? `${planInfo.color}40` : "rgba(239,68,68,.2)"}`,
            borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: manualOpen && !esVencida ? 0 : 8 }}>
              <i className={`bi ${planInfo.icon}`} style={{ color: planInfo.color, fontSize: 16 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                Plan {planInfo.label}
              </span>
              {!manualOpen || esVencida ? (
                <span style={{
                  marginLeft: "auto", fontSize: 11, fontWeight: 700,
                  background: "rgba(239,68,68,.15)", color: C.danger,
                  border: "1px solid rgba(239,68,68,.3)", borderRadius: 6, padding: "2px 8px",
                }}>
                  VENCIDO
                </span>
              ) : (
                <span style={{
                  marginLeft: "auto", fontSize: 11, fontWeight: 700,
                  background: `${planInfo.color}20`, color: planInfo.color,
                  border: `1px solid ${planInfo.color}50`, borderRadius: 6, padding: "2px 8px",
                }}>
                  ACTIVO · {licenciaInfo?.dias_restantes ?? "—"}d
                </span>
              )}
            </div>
            {(!manualOpen || esVencida) && (
              <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
                <i className="bi bi-calendar-x me-2" style={{ color: C.danger }} />
                Venció el <strong style={{ color: C.text }}>{fechaVencimiento}</strong>
              </div>
            )}
          </div>

          {!enviado ? (
            <>
              {/* Selector de plan */}
              <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>
                ¿Qué plan deseas solicitar?
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {PLANES.map(p => (
                  <div
                    key={p.key}
                    onClick={() => setPlanSel(p.key)}
                    style={{
                      background: planSel === p.key ? `${p.color}20` : "rgba(255,255,255,.03)",
                      border: `2px solid ${planSel === p.key ? p.color : C.border}`,
                      borderRadius: 12, padding: "14px 10px", textAlign: "center",
                      cursor: "pointer", position: "relative",
                      transition: "border .15s, background .15s",
                    }}
                  >
                    {p.rec && (
                      <div style={{
                        position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)",
                        background: p.color, color: "#fff", fontSize: 9, fontWeight: 700,
                        borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap",
                      }}>
                        RECOMENDADO
                      </div>
                    )}
                    {planSel === p.key && (
                      <div style={{
                        position: "absolute", top: 6, right: 6,
                        width: 16, height: 16, borderRadius: "50%",
                        background: p.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <i className="bi bi-check" style={{ color: "#fff", fontSize: 10 }} />
                      </div>
                    )}
                    <i className={`bi ${p.icon}`} style={{ color: p.color, fontSize: 22, display: "block", marginBottom: 6 }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.sub}</div>
                  </div>
                ))}
              </div>

              {/* Mensaje opcional */}
              <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>
                Mensaje al administrador <span style={{ fontWeight: 400, textTransform: "none" }}>(opcional)</span>
              </p>
              <textarea
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                maxLength={400}
                rows={3}
                placeholder="Ej: Necesito activar el plan lo antes posible, ya pagué..."
                style={{
                  width: "100%", background: "rgba(255,255,255,.05)",
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  color: C.text, fontSize: 13, padding: "10px 12px",
                  resize: "none", outline: "none", fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ textAlign: "right", fontSize: 11, color: C.muted, marginBottom: 16 }}>
                {mensaje.length}/400
              </div>

              {errorMsg && (
                <div style={{
                  background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
                  borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.danger, marginBottom: 12,
                }}>
                  <i className="bi bi-exclamation-circle me-2" />
                  {errorMsg}
                </div>
              )}

              {/* Botón enviar */}
              <button
                onClick={handleEnviar}
                disabled={enviando}
                style={{
                  width: "100%", padding: "12px 0",
                  background: planSel === "anual"
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : "linear-gradient(135deg, #2196f3, #1565c0)",
                  border: "none", borderRadius: 12,
                  color: "#fff", fontSize: 14, fontWeight: 700, cursor: enviando ? "wait" : "pointer",
                  opacity: enviando ? .7 : 1, marginBottom: 10,
                }}
              >
                {enviando
                  ? <><span className="spinner-border spinner-border-sm me-2" />Enviando...</>
                  : <><i className="bi bi-send-fill me-2" />Solicitar plan {PLANES_LABEL[planSel]?.label}</>
                }
              </button>
            </>
          ) : (
            /* Estado éxito */
            <div style={{
              background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.25)",
              borderRadius: 12, padding: "18px 20px", textAlign: "center", marginBottom: 16,
            }}>
              <i className="bi bi-bell-fill" style={{ fontSize: 28, color: C.success, display: "block", marginBottom: 10 }} />
              <p style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>
                Plan <strong>{PLANES_LABEL[planSel]?.label}</strong> solicitado
              </p>
              <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                El administrador del sistema recibió tu solicitud y la activará a la brevedad.
                Cierra sesión e intenta ingresar nuevamente una vez te confirmen.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0 32px 24px", display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
          {manualOpen && !esVencida && (
            <button
              onClick={cerrarManual}
              style={{
                width: "100%", background: "transparent",
                border: `1px solid ${C.border}`, borderRadius: 10,
                padding: "10px 0", color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
            >
              <i className="bi bi-x-circle me-2" />
              Cerrar
            </button>
          )}
          <button
            onClick={logout}
            style={{
              width: "100%", background: "transparent",
              border: `1px solid ${C.border}`, borderRadius: 10,
              padding: "10px 0", color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.danger; e.currentTarget.style.color = C.danger; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
          >
            <i className="bi bi-box-arrow-right me-2" />
            Cerrar sesión
          </button>
        </div>
        </div>{/* fin scroll wrapper */}
      </div>
    </div>
  );
}

