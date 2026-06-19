import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const INACTIVITY_MS  = 15 * 60 * 1000; // 15 minutos sin actividad → mostrar modal
const COUNTDOWN_SECS = 60;              // segundos para responder antes de cerrar sesión

const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export default function InactivityGuard({ children }) {
  const { logout } = useAuth();
  const navigate   = useNavigate();
  const [show, setShow]         = useState(false);
  const [secs, setSecs]         = useState(COUNTDOWN_SECS);
  const timerRef    = useRef(null);
  const countRef    = useRef(null);

  const resetTimer = useCallback(() => {
    if (show) return; // no resetear mientras el modal esté visible
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShow(true);
      setSecs(COUNTDOWN_SECS);
    }, INACTIVITY_MS);
  }, [show]);

  // Arrancar listeners de actividad
  useEffect(() => {
    EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
      clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  // Countdown cuando el modal está visible
  useEffect(() => {
    if (!show) {
      clearInterval(countRef.current);
      return;
    }
    countRef.current = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          clearInterval(countRef.current);
          handleLogout();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(countRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const handleContinue = () => {
    setShow(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShow(true);
      setSecs(COUNTDOWN_SECS);
    }, INACTIVITY_MS);
  };

  const handleLogout = () => {
    setShow(false);
    clearTimeout(timerRef.current);
    clearInterval(countRef.current);
    logout();
    navigate("/login", { replace: true });
  };

  const pct = (secs / COUNTDOWN_SECS) * 100;
  const color = secs > 20 ? "#f59e0b" : "#ef4444";

  return (
    <>
      {children}

      {show && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(10,15,30,0.72)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "36px 40px",
            maxWidth: 420, width: "90%", textAlign: "center",
            boxShadow: "0 8px 48px rgba(0,0,0,0.3)",
          }}>
            {/* Ícono */}
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "#fef3c7", margin: "0 auto 20px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 30,
            }}>
              ⏱
            </div>

            <h5 style={{ fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>
              Sesión por inactividad
            </h5>
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 24 }}>
              No se detectó actividad en los últimos 15 minutos.<br />
              La sesión se cerrará automáticamente en:
            </p>

            {/* Countdown circular */}
            <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 24px" }}>
              <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.4rem", fontWeight: 700, color,
              }}>
                {secs}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={handleLogout}
                style={{
                  padding: "10px 22px", borderRadius: 8, border: "1px solid #e2e8f0",
                  background: "#f8fafc", color: "#64748b", fontWeight: 600,
                  cursor: "pointer", fontSize: "0.9rem",
                }}
              >
                Cerrar sesión
              </button>
              <button
                onClick={handleContinue}
                style={{
                  padding: "10px 22px", borderRadius: 8, border: "none",
                  background: "#1a2744", color: "#fff", fontWeight: 600,
                  cursor: "pointer", fontSize: "0.9rem",
                }}
              >
                Continuar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
