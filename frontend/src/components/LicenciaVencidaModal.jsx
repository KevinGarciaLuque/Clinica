/**
 * LicenciaVencidaModal.jsx
 * Modal bloqueante que se muestra cuando la licencia de la clínica ha vencido.
 * Solo para usuarios no-SUPER_ADMIN.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const C = {
  bg:      "#0d1b2e",
  surface: "#112240",
  border:  "rgba(255,255,255,0.07)",
  text:    "#e2e8f0",
  muted:   "#94a3b8",
  accent:  "#2196f3",
  warning: "#f59e0b",
  danger:  "#ef4444",
};

const PLANES_LABEL = {
  trial:     { label: "Prueba",   color: "#f59e0b", icon: "bi-clock-history" },
  semestral: { label: "Semestral", color: "#2196f3", icon: "bi-calendar2-check" },
  anual:     { label: "Anual",    color: "#10b981", icon: "bi-award-fill" },
};

export default function LicenciaVencidaModal() {
  const { user, licenciaInfo, logout } = useAuth();
  const [visible, setVisible] = useState(false);

  // Mostrar si la licencia está vencida y no es SUPER_ADMIN
  useEffect(() => {
    if (user && !user.super && licenciaInfo?.vencida) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [user, licenciaInfo]);

  // También escuchar el evento 402 del interceptor de axios
  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener("licenciaVencida", handler);
    return () => window.removeEventListener("licenciaVencida", handler);
  }, []);

  if (!visible) return null;

  const fin    = licenciaInfo?.licencia_fin ? new Date(licenciaInfo.licencia_fin) : null;
  const fechaVencimiento = fin
    ? fin.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  const planInfo = PLANES_LABEL[licenciaInfo?.plan_tipo] || PLANES_LABEL.trial;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: C.surface,
        border: "2px solid rgba(239,68,68,.4)",
        borderRadius: 20, width: "100%", maxWidth: 480,
        boxShadow: "0 24px 80px rgba(239,68,68,.25)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, rgba(239,68,68,.15), rgba(220,38,38,.08))",
          padding: "28px 32px 24px",
          textAlign: "center",
          borderBottom: `1px solid rgba(239,68,68,.2)`,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: "0 auto 16px",
            background: "rgba(239,68,68,.15)", border: "2px solid rgba(239,68,68,.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-lock-fill" style={{ fontSize: 30, color: C.danger }} />
          </div>
          <h4 style={{ color: C.danger, margin: 0, fontWeight: 700, fontSize: 20 }}>
            Licencia Vencida
          </h4>
          <p style={{ color: C.muted, margin: "8px 0 0", fontSize: 13 }}>
            El acceso a tu clínica ha sido suspendido
          </p>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: "24px 32px" }}>
          {/* Info del plan */}
          <div style={{
            background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)",
            borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <i className={`bi ${planInfo.icon}`} style={{ color: planInfo.color, fontSize: 16 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                Plan {planInfo.label}
              </span>
              <span style={{
                marginLeft: "auto", fontSize: 11, fontWeight: 700,
                background: "rgba(239,68,68,.15)", color: C.danger,
                border: "1px solid rgba(239,68,68,.3)",
                borderRadius: 6, padding: "2px 8px",
              }}>
                VENCIDO
              </span>
            </div>
            <div style={{ fontSize: 13, color: C.muted }}>
              <i className="bi bi-calendar-x me-2" style={{ color: C.danger }} />
              Venció el <strong style={{ color: C.text }}>{fechaVencimiento}</strong>
            </div>
          </div>

          {/* Mensaje */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              Tu período de uso ha finalizado. Para continuar usando el sistema,
              contacta al <strong style={{ color: C.text }}>administrador del sistema</strong> para
              renovar o actualizar tu licencia.
            </p>
          </div>

          {/* Planes disponibles */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24,
          }}>
            {[
              { key: "trial",     label: "Prueba",    sub: "14 días",  icon: "bi-clock-history",  color: "#f59e0b" },
              { key: "semestral", label: "Semestral", sub: "6 meses",  icon: "bi-calendar2-check", color: "#2196f3" },
              { key: "anual",     label: "Anual",     sub: "12 meses", icon: "bi-award-fill",      color: "#10b981", rec: true },
            ].map(p => (
              <div key={p.key} style={{
                background: p.rec ? `${p.color}15` : "rgba(255,255,255,.03)",
                border: `1px solid ${p.rec ? `${p.color}40` : C.border}`,
                borderRadius: 10, padding: "10px 8px", textAlign: "center",
                position: "relative",
              }}>
                {p.rec && (
                  <div style={{
                    position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
                    background: p.color, color: "#fff", fontSize: 9, fontWeight: 700,
                    borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap",
                  }}>
                    RECOMENDADO
                  </div>
                )}
                <i className={`bi ${p.icon}`} style={{ color: p.color, fontSize: 18, display: "block", marginBottom: 4 }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p.label}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{p.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 32px 24px",
          display: "flex", flexDirection: "column", gap: 10,
          borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{
            background: "rgba(33,150,243,.08)", border: "1px solid rgba(33,150,243,.2)",
            borderRadius: 10, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.muted,
          }}>
            <i className="bi bi-info-circle-fill" style={{ color: C.accent, flexShrink: 0 }} />
            Contacta al administrador del sistema para renovar tu licencia.
          </div>
          <button
            onClick={logout}
            style={{
              background: "transparent", border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "10px 0",
              color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
              width: "100%", transition: "border .2s, color .2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.danger; e.currentTarget.style.color = C.danger; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
          >
            <i className="bi bi-box-arrow-right me-2" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
