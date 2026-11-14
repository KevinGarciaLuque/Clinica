/**
 * Aviso de renovación del plan: cuando a la clínica le quedan 10, 5, 4, 3, 2 o 1 días
 * de contrato, el médico / administrador ve una ventana (una vez por cada uno de esos
 * días) con el botón «Solicitar renovación», que abre la solicitud al super admin.
 * Si ya la pidió, solo le recuerda que está en revisión.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import api from "../api/api";

const DIAS_AVISO = [10, 5, 4, 3, 2, 1];
const ROLES = ["ADMIN", "MEDICO", "PSICOLOGO"];
const PLAN_TEXTO = { semestral: "Semestral", anual: "Anual", trial: "Prueba" };

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export default function AvisoRenovacion() {
  const { user } = useAuth();
  const [lic, setLic] = useState(null);
  const [cerrado, setCerrado] = useState(null);
  const aplica = !!user && !user.super && !!user.clinica_id && ROLES.includes(user.tipo);
  const clave = lic ? `aviso_renovacion_${user?.clinica_id}_${String(lic.licencia_fin || "").slice(0, 10)}_${lic.dias_restantes}` : null;

  const cargar = useCallback(() => {
    if (!aplica) return;
    api.get("/clinicas/mi-licencia").then((r) => setLic(r.data.data || null)).catch(() => {});
  }, [aplica]);

  useEffect(() => {
    cargar();
    const iv = setInterval(cargar, 3 * 60 * 60 * 1000); // por si la sesión queda abierta varios días
    const alEnviar = () => setTimeout(cargar, 800);
    window.addEventListener("solicitudLicenciaEnviada", alEnviar);
    return () => { clearInterval(iv); window.removeEventListener("solicitudLicenciaEnviada", alEnviar); };
  }, [cargar]);

  // Se muestra una vez por cada día de aviso (10, 5, 4, 3, 2, 1)
  const toca = !!lic && lic.plan_tipo !== "trial" && !lic.vencida && DIAS_AVISO.includes(lic.dias_restantes);
  if (!toca || cerrado === clave || leer(clave)) return null;

  const cerrar = () => { guardar(clave, "1"); setCerrado(clave); };
  const solicitar = () => {
    cerrar();
    window.dispatchEvent(new CustomEvent("solicitarPlan", { detail: { renovacion: true } }));
  };
  const dias = lic.dias_restantes;
  const urgente = dias <= 3;
  const color = urgente ? "#dc2626" : "#d97706";
  const fecha = lic.licencia_fin
    ? new Date(lic.licencia_fin).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const pendiente = lic.solicitud_pendiente;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9990, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }} onClick={cerrar}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 430, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.35)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg, ${color}, ${urgente ? "#f87171" : "#fbbf24"})`, color: "#fff", padding: "22px 22px 18px", textAlign: "center", position: "relative" }}>
          <button type="button" className="btn-close btn-close-white" aria-label="Cerrar" onClick={cerrar} style={{ position: "absolute", top: 14, right: 14 }} />
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: "rgba(255,255,255,.22)", margin: "0 auto 10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            <span style={{ fontSize: "2.2rem", fontWeight: 900 }}>{dias}</span>
            <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>{dias === 1 ? "día" : "días"}</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>
            {dias === 1 ? "Su plan vence mañana" : `A su plan le quedan ${dias} días`}
          </div>
          {fecha && <div style={{ fontSize: "0.86rem", opacity: 0.95, marginTop: 2 }}>Vence el {fecha}</div>}
        </div>

        <div style={{ padding: 20 }}>
          {pendiente ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 14px", color: "#166534", fontSize: "0.9rem" }}>
              <i className="bi bi-check-circle-fill me-2" />
              Ya envió la solicitud de renovación <b>{PLAN_TEXTO[pendiente.plan_solicitado] || pendiente.plan_solicitado}</b>. El administrador la está revisando y le avisará cuando esté activa.
            </div>
          ) : (
            <p style={{ color: "#475569", fontSize: "0.92rem", marginBottom: 0 }}>
              Para seguir usando Medic-KG sin interrupciones, solicite la renovación ahora. Elija si la quiere <b>semestral</b> o <b>anual</b> y el administrador la activará.
            </p>
          )}
          <div className="d-flex gap-2 mt-3 flex-wrap">
            {!pendiente && (
              <button type="button" className="btn flex-grow-1 fw-bold" style={{ background: color, color: "#fff", borderRadius: 12, padding: "10px 14px" }} onClick={solicitar}>
                <i className="bi bi-arrow-repeat me-2" />Solicitar renovación
              </button>
            )}
            <button type="button" className="btn btn-light flex-grow-1" style={{ borderRadius: 12, padding: "10px 14px" }} onClick={cerrar}>
              {pendiente ? "Entendido" : "Recordarme después"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
