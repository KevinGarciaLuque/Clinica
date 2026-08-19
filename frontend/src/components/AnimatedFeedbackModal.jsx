import { createPortal } from "react-dom";
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimesCircle } from "react-icons/fa";

const THEME = {
  success: {
    icon: FaCheckCircle,
    iconColor: "#16a34a",
    border: "#dcfce7",
    title: "#166534",
    bg: "#f0fdf4",
    confirm: "btn-success",
  },
  warning: {
    icon: FaExclamationTriangle,
    iconColor: "#d97706",
    border: "#fde68a",
    title: "#92400e",
    bg: "#fffbeb",
    confirm: "btn-warning",
  },
  error: {
    icon: FaTimesCircle,
    iconColor: "#dc2626",
    border: "#fecaca",
    title: "#991b1b",
    bg: "#fef2f2",
    confirm: "btn-danger",
  },
  info: {
    icon: FaInfoCircle,
    iconColor: "#2563eb",
    border: "#bfdbfe",
    title: "#1d4ed8",
    bg: "#eff6ff",
    confirm: "btn-primary",
  },
};

export default function AnimatedFeedbackModal({
  open,
  type = "info",
  title = "Mensaje",
  message = "",
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  showCancel = false,
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null;
  const t = THEME[type] || THEME.info;
  const Icon = t.icon;

  return createPortal(
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 11000,
      background: "rgba(15,23,42,.58)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      backdropFilter: "blur(2px)",
    }}>
      <style>{`
        @keyframes afm-pop {
          0% { transform: scale(.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes afm-icon {
          0% { transform: scale(.65); opacity: 0; }
          75% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .afm-pop { animation: afm-pop .24s ease-out; }
        .afm-icon { animation: afm-icon .38s ease-out; }
      `}</style>

      <div className="afm-pop" style={{
        width: "100%",
        maxWidth: 460,
        background: "#fff",
        borderRadius: 14,
        border: `1px solid ${t.border}`,
        boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${t.border}`,
          background: t.bg,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div className="afm-icon">
            <Icon size={22} color={t.iconColor} />
          </div>
          <div style={{ fontWeight: 800, color: t.title, fontSize: "0.98rem" }}>{title}</div>
        </div>

        <div style={{ padding: "15px 16px", color: "#374151", fontSize: "0.92rem" }}>
          {message}
        </div>

        <div style={{ padding: "0 16px 14px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {showCancel && (
            <button className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={loading}>
              {cancelText}
            </button>
          )}
          <button className={`btn btn-sm ${t.confirm}`} onClick={onConfirm} disabled={loading}>
            {loading ? "Procesando..." : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

