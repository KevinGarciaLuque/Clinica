import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { useConfigSistema } from "../context/ConfigSistemaContext";
import api from "../api/api";
import ModalAyudaSoporte from "./ModalAyudaSoporte";
import { playNotificationSound } from "../utils/notificationSound";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
};

const ROLE_COLOR = {
  SUPER_ADMIN:   "danger",
  ADMIN:         "warning",
  MEDICO:        "success",
  ENFERMERA:     "info",
  RECEPCIONISTA: "secondary",
};

const PLAN_BADGE = {
  trial:     { label: "Versión Prueba", color: "#f59e0b", bg: "rgba(245,158,11,.15)", border: "rgba(245,158,11,.4)", icon: "bi-clock-history", pulse: true },
  semestral: { label: "Semestral",      color: "#2196f3", bg: "rgba(33,150,243,.15)", border: "rgba(33,150,243,.4)", icon: "bi-calendar2-check", pulse: false },
  anual:     { label: "Anual",          color: "#10b981", bg: "rgba(16,185,129,.15)", border: "rgba(16,185,129,.4)", icon: "bi-award-fill",      pulse: false },
};

export default function NavbarApp({ onMenuClick }) {
  const { user, logout, licenciaInfo } = useAuth();
  const navigate = useNavigate();
  const cfg = useConfigSistema();

  const salir = () => { logout(); navigate("/login"); };
  const initials = `${user?.nombres?.[0] ?? ""}${user?.apellidos?.[0] ?? ""}`;

  // Mostrar badge de plan solo para usuarios de clínica (no SUPER_ADMIN)
  const planBadge = !user?.super && licenciaInfo ? PLAN_BADGE[licenciaInfo.plan_tipo] : null;
  const diasRestantes = licenciaInfo?.dias_restantes ?? null;
  const esAlerta = licenciaInfo?.plan_tipo === "trial" || (diasRestantes !== null && diasRestantes <= 30);

  // ── Notificaciones de solicitudes de licencia (solo SUPER_ADMIN) ──
  const [solicitudes, setSolicitudes]     = useState([]);
  const [reportes, setReportes]           = useState([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const dropdownRef                       = useRef(null);
  const [showUserMenu, setShowUserMenu]   = useState(false);
  const userMenuRef                       = useRef(null);
  const [showAyuda, setShowAyuda]             = useState(false);
  const [misRespuestas, setMisRespuestas]     = useState([]);
  const [notifsPortal, setNotifsPortal]       = useState([]);
  const [showRespuestasDD, setShowRespuestasDD] = useState(false);
  const respuestasRef                         = useRef(null);

  // ── Cumpleañeros (usuarios regulares no-super) ──────────────────
  const [cumpleaneros, setCumpleaneros]         = useState([]);
  const [showCumpleDD, setShowCumpleDD]         = useState(false);
  const cumpleRef                               = useRef(null);

  // ── Banner de activación de notificaciones push ─────────────────
  const [pushPermission, setPushPermission]     = useState("default"); // default | granted | denied | unsupported
  const [pushSubscribed, setPushSubscribed]     = useState(false);
  const [activandoPush, setActivandoPush]       = useState(false);
  const [pushError, setPushError]               = useState("");
  const [pushBannerDismissed, setPushBannerDismissed] = useState(
    () => sessionStorage.getItem("push_banner_dismissed") === "1"
  );
  const [modalFelicitar, setModalFelicitar]     = useState(null);

  // ── Respuestas a reportes de soporte (usuarios regulares) ──
  useEffect(() => {
    if (user?.super) return;
    // Carga inicial
    Promise.all([
      api.get("/soporte/mis-respuestas"),
      api.get("/soporte/notificaciones-portal"),
    ])
      .then(([respSoporte, respPortal]) => {
        setMisRespuestas(respSoporte.data.data || []);
        setNotifsPortal(respPortal.data.data || []);
      })
      .catch(() => {});

    // SSE — notificaciones en tiempo real
    let esRef = null;
    let cancelled = false;

    const connectSSE = async () => {
      try {
        const { data } = await api.post("/soporte/stream-token");
        if (cancelled) return;
        const es = new EventSource(`${API_URL}/api/soporte/stream?sse_token=${data.token}`);
        esRef = es;
        es.addEventListener("respuesta_reporte", (e) => {
          const d = JSON.parse(e.data);
          setMisRespuestas(prev => {
            if (prev.find(r => r.id === d.id)) return prev;
            playNotificationSound();
            return [d, ...prev];
          });
        });
        es.addEventListener("notificacion_portal", (e) => {
          const d = JSON.parse(e.data);
          setNotifsPortal(prev => {
            playNotificationSound();
            return [{
              id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              tipo: d.tipo,
              mensaje: d.mensaje,
              paciente_id: d.paciente_id || null,
              cita_id: d.cita_id || null,
              creado_en: new Date().toISOString(),
              _live: true,
            }, ...prev];
          });
        });
        // Al expirar el token (401) el browser cierra la conexión; reconectar con nuevo token
        es.onerror = () => {
          es.close();
          if (!cancelled) setTimeout(connectSSE, 5000);
        };
      } catch { /* sin conectividad — el polling de fallback sigue activo */ }
    };

    connectSSE();

    // Fallback polling cada 60s (por si SSE falla)
    // También reproduce sonido si aparecen respuestas nuevas
    const iv = setInterval(() => {
      Promise.all([
        api.get("/soporte/mis-respuestas"),
        api.get("/soporte/notificaciones-portal"),
      ])
        .then(([respSoporte, respPortal]) => {
          const nuevasSoporte = respSoporte.data.data || [];
          const nuevasPortal = respPortal.data.data || [];
          setMisRespuestas(prev => {
            if (nuevasSoporte.length > prev.length) playNotificationSound();
            return nuevasSoporte;
          });
          setNotifsPortal(prev => {
            if (nuevasPortal.length > prev.length) playNotificationSound();
            return nuevasPortal;
          });
        })
        .catch(() => {});
    }, 60000);

    return () => { cancelled = true; esRef?.close(); clearInterval(iv); };
  }, [user]);

  const [accionandoNotif, setAccionandoNotif] = useState(null);

  const accionarCitaPortal = async (notifId, accion) => {
    setAccionandoNotif(notifId);
    try {
      await api.put(`/soporte/notificaciones-portal/${notifId}/${accion}-cita`);
      setNotifsPortal(prev => prev.filter(n => n.id !== notifId));
      if (notifsPortal.length <= 1 && misRespuestas.length === 0) setShowRespuestasDD(false);
      window.dispatchEvent(new CustomEvent("cita-portal-accionada"));
    } catch {
    } finally {
      setAccionandoNotif(null);
    }
  };

  const marcarRespuestaLeida = async (id) => {
    try {
      await api.put(`/soporte/mis-respuestas/${id}/leer`);
      setMisRespuestas(prev => prev.filter(r => r.id !== id));
    } catch {}
  };

  const marcarNotifPortalLeida = async (id) => {
    if (String(id).startsWith("live-")) {
      setNotifsPortal(prev => prev.filter(n => n.id !== id));
      return;
    }
    try {
      await api.put(`/soporte/notificaciones-portal/${id}/leer`);
      setNotifsPortal(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  useEffect(() => {
    if (!user?.super) return;
    const fetchTodo = () => {
      api.get("/clinicas/solicitudes-licencia")
        .then(r => setSolicitudes(r.data.data || []))
        .catch(() => {});
      api.get("/soporte/reportes")
        .then(r => setReportes(r.data.data || []))
        .catch(() => {});
    };
    fetchTodo();

    // SSE — notificaciones en tiempo real para SUPER_ADMIN
    let esRef2 = null;
    let cancelled2 = false;

    const connectSSE2 = async () => {
      try {
        const { data } = await api.post("/soporte/stream-token");
        if (cancelled2) return;
        const es = new EventSource(`${API_URL}/api/soporte/stream?sse_token=${data.token}`);
        esRef2 = es;
        es.addEventListener("nuevo_reporte", () => {
          api.get("/soporte/reportes")
            .then(r => {
              setReportes(prev => {
                const nuevos = r.data.data || [];
                if (nuevos.length > prev.length) playNotificationSound();
                return nuevos;
              });
            })
            .catch(() => {});
        });
        es.onerror = () => {
          es.close();
          if (!cancelled2) setTimeout(connectSSE2, 5000);
        };
      } catch { /* sin conectividad */ }
    };

    connectSSE2();

    // Fallback polling cada 30s
    const iv = setInterval(fetchTodo, 30000);
    return () => { cancelled2 = true; esRef2?.close(); clearInterval(iv); };
  }, [user]);

  const withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Tiempo agotado (${label})`)), ms)),
    ]);

  const activarNotificaciones = async ({ silent = false } = {}) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushPermission("unsupported");
      return false;
    }
    if (!silent) setPushError("");
    try {
      // Preparamos todo ANTES de pedir permiso: en Safari/iOS, si pasa mucho tiempo (varios
      // await con red de por medio) entre conceder el permiso y llamar a subscribe(), el propio
      // subscribe() se queda colgado sin resolver ni rechazar nunca. Por eso dejamos listos el
      // service worker activo y la llave del servidor de antemano, y llamamos a requestPermission
      // + subscribe() casi de corrido.
      await withTimeout(navigator.serviceWorker.register("/sw.js"), 8000, "registrar service worker");
      const reg = await withTimeout(navigator.serviceWorker.ready, 10000, "activar service worker");
      const keyResp = await withTimeout(api.get("/soporte/push/public-key"), 8000, "obtener llave del servidor");
      const publicKey = keyResp.data?.publicKey;
      if (!publicKey) {
        if (!silent) setPushError("El servidor no tiene configuradas las notificaciones push todavía.");
        return false;
      }

      const perm = silent ? Notification.permission : await Notification.requestPermission();
      setPushPermission(perm);
      if (perm !== "granted") return false;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await withTimeout(
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          }),
          10000,
          "suscribir el dispositivo"
        );
      }
      if (!sub) return false;
      await withTimeout(api.post("/soporte/push/subscribe", { subscription: sub.toJSON() }), 8000, "guardar suscripción");
      setPushSubscribed(true);
      return true;
    } catch (e) {
      if (!silent) setPushError(e?.message || "No se pudo activar las notificaciones. Intenta de nuevo.");
      return false;
    }
  };

  useEffect(() => {
    if (!user || user.super) return;
    if (!("Notification" in window)) { setPushPermission("unsupported"); return; }

    setPushPermission(Notification.permission);
    // Si ya lo había aceptado antes, re-suscribimos en silencio (sin volver a pedir permiso).
    if (Notification.permission === "granted") {
      activarNotificaciones({ silent: true });
    }
  }, [user]);

  // ── Limpiar el badge del ícono al abrir la app (ya viste las notificaciones) ──
  useEffect(() => {
    if (!user) return;
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration("/sw.js")
        .then((reg) => reg?.active?.postMessage({ type: "RESET_BADGE" }))
        .catch(() => {});
    }
  }, [user]);

  // ── Cargar cumpleañeros del día (usuarios regulares) ───────────
  useEffect(() => {
    if (user?.super) return;
    const fetchCumple = () => {
      api.get("/cumpleanos", { params: { dias: 0 } })
        .then(r => setCumpleaneros(r.data.data || []))
        .catch(() => {});
    };
    fetchCumple();
    const iv = setInterval(fetchCumple, 3600000); // recargar cada hora
    return () => clearInterval(iv);
  }, [user]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (respuestasRef.current && !respuestasRef.current.contains(e.target)) {
        setShowRespuestasDD(false);
      }
      if (cumpleRef.current && !cumpleRef.current.contains(e.target)) {
        setShowCumpleDD(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const clickActivarPush = async () => {
    setActivandoPush(true);
    try {
      await activarNotificaciones({ silent: false });
    } finally {
      setActivandoPush(false);
    }
  };

  const descartarBannerPush = () => {
    sessionStorage.setItem("push_banner_dismissed", "1");
    setPushBannerDismissed(true);
  };

  const mostrarBannerPush =
    !!user && !user.super &&
    !pushBannerDismissed &&
    pushPermission !== "unsupported" &&
    !(pushPermission === "granted" && pushSubscribed);

  const atenderSolicitud = async (solicitudId, clinicaId) => {
    try {
      await api.put(`/clinicas/solicitudes-licencia/${solicitudId}/atender`);
      setSolicitudes(prev => prev.filter(s => s.id !== solicitudId));
      navigate(`/superadmin/clinicas`);
      setShowDropdown(false);
    } catch {}
  };

  const atenderReporte = async (reporteId) => {
    try {
      await api.put(`/soporte/reportes/${reporteId}/atender`);
      setReportes(prev => prev.filter(r => r.id !== reporteId));
    } catch {}
  };

  return (
    <>
    <style>{`
      @keyframes licencia-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,.5); }
        50%       { box-shadow: 0 0 0 5px rgba(245,158,11,0); }
      }
      @keyframes navbar-logo-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,.3); }
        50%       { box-shadow: 0 0 12px 3px rgba(59,130,246,.15); }
      }
      @keyframes brand-float {
        0%, 100% { transform: translateY(0px); }
        50%       { transform: translateY(-3px); }
      }
      @keyframes brand-shine {
        0%   { background-position: -250% center; }
        100% { background-position: 250% center; }
      }
    `}</style>
    <nav
      className="navbar navbar-dark px-3"
      style={{
        height: 60,
        minHeight: 60,
        position: "relative",
        display: "flex",
        alignItems: "center",
        background: "linear-gradient(90deg, #0d1b2e 0%, #0f2040 50%, #0d1b2e 100%)",
        borderBottom: "1px solid rgba(59,130,246,.18)",
        boxShadow: "0 2px 20px rgba(0,0,0,.45)",
      }}
    >
      {/* Izquierda: brand centrado dentro del ancho del sidebar (240px) */}
      <div style={{
        width: 240, minWidth: 240, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        {/* Hamburguesa solo en móvil, a la izquierda */}
        <button
          className="btn btn-sm d-lg-none border-0"
          onClick={onMenuClick}
          aria-label="Menú"
          style={{
            color: "rgba(255,255,255,.7)",
            background: "rgba(255,255,255,.06)",
            borderRadius: 8,
            width: 34, height: 34,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginRight: 4,
          }}
        >
          <i className="bi bi-list" style={{ fontSize: 18 }} />
        </button>

        {/* Ícono / Logo */}
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: cfg.logoUrl ? "transparent" : "linear-gradient(135deg, #1d4ed8, #3b82f6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          boxShadow: "0 0 0 1px rgba(59,130,246,.35), 0 4px 12px rgba(29,78,216,.4)",
          animation: "navbar-logo-glow 4s ease-in-out infinite",
        }}>
          {cfg.logoUrl
            ? <img src={cfg.logoUrl} alt={cfg.nombre_sistema}
                   style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : <i className={`bi ${cfg.icono_bootstrap}-fill`} style={{ color: "#fff", fontSize: 22 }} />
          }
        </div>

        {/* Texto de marca */}
        <div style={{ lineHeight: 1.2, textAlign: "left" }}>
          <div style={{ fontSize: "1rem", fontWeight: 800, letterSpacing: "0.04em" }}>
            <BrandName name={cfg.nombre_sistema} c1={cfg.color_nombre1} c2={cfg.color_nombre2} />
          </div>
          <div style={{
            fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(147,197,253,.6)",
          }}>
            {cfg.subtitulo}
          </div>
        </div>
      </div>

      {/* Derecha: notificaciones + usuario */}
      <div className="d-flex align-items-center gap-2 gap-md-3" style={{ marginLeft: "auto" }}>

        {/* 🔔 Notificaciones — solo SUPER_ADMIN */}
        {user?.super && (
          <div ref={dropdownRef} style={{ position: "relative" }}>
            {/* Botón campana — total = licencias + reportes */}
            {(() => {
              const total = solicitudes.length + reportes.length;
              return (
                <button
                  onClick={() => setShowDropdown(v => !v)}
                  title={total ? `${total} notificación(es) pendiente(s)` : "Sin notificaciones"}
                  style={{
                    background: total ? "rgba(245,158,11,.15)" : "rgba(255,255,255,.07)",
                    border: `1px solid ${total ? "rgba(245,158,11,.4)" : "rgba(255,255,255,.12)"}`,
                    borderRadius: 10, width: 36, height: 36,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", position: "relative", flexShrink: 0,
                  }}
                >
                  <i
                    className={`bi ${total ? "bi-bell-fill" : "bi-bell"}`}
                    style={{ color: total ? "#f59e0b" : "rgba(255,255,255,.6)", fontSize: 15 }}
                  />
                  {total > 0 && (
                    <span style={{
                      position: "absolute", top: -5, right: -5,
                      background: "#ef4444", color: "#fff",
                      fontSize: 10, fontWeight: 700, borderRadius: "50%",
                      width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                      border: "2px solid #1a1a2e",
                    }}>
                      {total > 9 ? "9+" : total}
                    </span>
                  )}
                </button>
              );
            })()}

            {/* Dropdown */}
            {showDropdown && (
              <div style={{
                position: "absolute", top: 44, right: 0, zIndex: 1200,
                background: "#112240", border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 14, width: 340, boxShadow: "0 16px 48px rgba(0,0,0,.6)",
                overflow: "hidden", maxHeight: 520, display: "flex", flexDirection: "column",
              }}>
                {/* Header */}
                <div style={{
                  padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.07)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  flexShrink: 0,
                }}>
                  <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13 }}>
                    <i className="bi bi-bell-fill me-2" style={{ color: "#f59e0b" }} />
                    Notificaciones
                  </span>
                  <span style={{
                    background: (solicitudes.length + reportes.length) ? "rgba(245,158,11,.2)" : "rgba(255,255,255,.05)",
                    color: (solicitudes.length + reportes.length) ? "#f59e0b" : "#94a3b8",
                    fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px",
                  }}>
                    {solicitudes.length + reportes.length} pendiente{(solicitudes.length + reportes.length) !== 1 ? "s" : ""}
                  </span>
                </div>

                <div style={{ overflowY: "auto", flex: 1 }}>

                  {/* ── Sección: Solicitudes de licencia ── */}
                  {solicitudes.length > 0 && (
                    <>
                      <div style={{ padding: "8px 16px 4px", fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        <i className="bi bi-key-fill me-1" /> Licencias
                      </div>
                      {solicitudes.map(s => {
                        const PLAN_COLOR = { trial: "#f59e0b", semestral: "#2196f3", anual: "#10b981" };
                        const color = PLAN_COLOR[s.plan_solicitado] || "#94a3b8";
                        const fecha = new Date(s.creado_en).toLocaleDateString("es-HN", { day: "2-digit", month: "short" });
                        return (
                          <div key={s.id} style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                                background: `${color}20`, border: `1px solid ${color}50`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                <i className="bi bi-building" style={{ color, fontSize: 13 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{s.clinica_nombre}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                                  Plan <span style={{ color, fontWeight: 700 }}>{s.plan_solicitado}</span> · {fecha}
                                </div>
                                <button onClick={() => atenderSolicitud(s.id, s.clinica_id)} style={{
                                  marginTop: 5, background: `${color}20`, border: `1px solid ${color}50`,
                                  borderRadius: 6, padding: "3px 9px", color, fontSize: 10, fontWeight: 700, cursor: "pointer",
                                }}>
                                  <i className="bi bi-key-fill me-1" />Gestionar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* ── Sección: Reportes de soporte ── */}
                  {reportes.length > 0 && (
                    <>
                      <div style={{ padding: "8px 16px 4px", fontSize: 11, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        <i className="bi bi-bug-fill me-1" /> Problemas reportados
                      </div>
                      {reportes.map(r => {
                        const fecha = new Date(r.creado_en).toLocaleDateString("es-HN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
                        return (
                          <div key={r.id} style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                                background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                <i className="bi bi-bug-fill" style={{ color: "#f87171", fontSize: 13 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {r.asunto}
                                </div>
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                                  {r.usuario_nombre}{r.clinica_nombre ? ` · ${r.clinica_nombre}` : ""} · {fecha}
                                </div>
                                <div style={{
                                  marginTop: 4, fontSize: 11, color: "rgba(255,255,255,.35)",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>
                                  {r.descripcion}
                                </div>
                                <button onClick={() => atenderReporte(r.id)} style={{
                                  marginTop: 5, background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)",
                                  borderRadius: 6, padding: "3px 9px", color: "#f87171", fontSize: 10, fontWeight: 700, cursor: "pointer",
                                }}>
                                  <i className="bi bi-check-lg me-1" />Marcar atendido
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Sin notificaciones */}
                  {solicitudes.length === 0 && reportes.length === 0 && (
                    <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                      <i className="bi bi-check-circle" style={{ fontSize: 22, display: "block", marginBottom: 8, color: "#10b981" }} />
                      Sin notificaciones pendientes
                    </div>
                  )}
                </div>

                {/* Footer: ver historial completo */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", padding: "10px 14px", flexShrink: 0 }}>
                  <button
                    onClick={() => { navigate("/superadmin/soporte"); setShowDropdown(false); }}
                    style={{
                      width: "100%", padding: "8px 12px",
                      background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)",
                      borderRadius: 8, color: "#f87171", fontSize: "0.78rem", fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <i className="bi bi-bug-fill" style={{ fontSize: 12 }} />
                    Ver historial completo de reportes
                    <i className="bi bi-arrow-right" style={{ fontSize: 11, marginLeft: "auto" }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}



        {/* 🔔 Campana respuestas — solo usuarios regulares */}
        {!user?.super && (
          <div ref={respuestasRef} style={{ position: "relative" }}>
            {(() => {
              const totalNotifs = misRespuestas.length + notifsPortal.length;
              return (
            <button
              onClick={() => setShowRespuestasDD(v => !v)}
              title={totalNotifs ? `${totalNotifs} notificación(es) pendiente(s)` : "Sin notificaciones"}
              style={{
                background: totalNotifs ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.07)",
                border: `1px solid ${totalNotifs ? "rgba(16,185,129,.4)" : "rgba(255,255,255,.12)"}`,
                borderRadius: 10, width: 36, height: 36,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative", flexShrink: 0,
              }}
            >
              <i
                className={`bi ${totalNotifs ? "bi-bell-fill" : "bi-bell"}`}
                style={{ color: totalNotifs ? "#10b981" : "rgba(255,255,255,.6)", fontSize: 15 }}
              />
              {totalNotifs > 0 && (
                <span style={{
                  position: "absolute", top: -5, right: -5,
                  background: "#10b981", color: "#fff",
                  fontSize: 10, fontWeight: 700, borderRadius: "50%",
                  width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid #1a1a2e",
                }}>
                  {totalNotifs > 9 ? "9+" : totalNotifs}
                </span>
              )}
            </button>
              );
            })()}

            {showRespuestasDD && (
              <div style={{
                position: "absolute", top: 44, right: 0, zIndex: 1200,
                background: "#112240", border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 14, width: 320, boxShadow: "0 16px 48px rgba(0,0,0,.6)",
                overflow: "hidden",
              }}>
                {/* Header */}
                <div style={{
                  padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.07)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13 }}>
                    <i className="bi bi-bell-fill me-2" style={{ color: "#10b981" }} />
                    Notificaciones
                  </span>
                  <span style={{
                    background: "rgba(16,185,129,.2)", color: "#10b981",
                    fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px",
                  }}>
                    {misRespuestas.length + notifsPortal.length} pendiente{(misRespuestas.length + notifsPortal.length) !== 1 ? "s" : ""}
                  </span>
                </div>

                {notifsPortal.length > 0 && (
                  <>
                    <div style={{ padding: "8px 16px 4px", fontSize: 11, fontWeight: 700, color: "#7dd3fc", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      <i className="bi bi-link-45deg me-1" /> Portal público
                    </div>
                    {notifsPortal.map((n) => {
                      const esSolicitud = n.tipo === "CITA_SOLICITUD_PORTAL";
                      const cargando    = accionandoNotif === n.id;
                      return (
                        <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                              background: esSolicitud ? "rgba(251,191,36,.15)" : "rgba(125,211,252,.15)",
                              border: `1px solid ${esSolicitud ? "rgba(251,191,36,.35)" : "rgba(125,211,252,.3)"}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <i
                                className={`bi ${esSolicitud ? "bi-calendar2-plus-fill" : n.tipo === "CITA_AGENDADA_PORTAL" ? "bi-calendar-check-fill" : "bi-person-plus-fill"}`}
                                style={{ color: esSolicitud ? "#fbbf24" : "#7dd3fc", fontSize: 14 }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 3, lineHeight: 1.4 }}>
                                {n.mensaje}
                              </div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginBottom: 8 }}>
                                {new Date(n.creado_en).toLocaleString("es-HN")}
                              </div>
                              {esSolicitud ? (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    disabled={cargando}
                                    onClick={() => accionarCitaPortal(n.id, "aprobar")}
                                    style={{
                                      background: cargando ? "rgba(16,185,129,.08)" : "rgba(16,185,129,.2)",
                                      border: "1px solid rgba(16,185,129,.5)",
                                      borderRadius: 6, padding: "4px 11px", color: "#10b981",
                                      fontSize: 11, fontWeight: 700, cursor: cargando ? "not-allowed" : "pointer",
                                      display: "flex", alignItems: "center", gap: 4,
                                    }}
                                  >
                                    {cargando ? <i className="bi bi-hourglass-split" /> : <i className="bi bi-check-lg" />}
                                    Aceptar
                                  </button>
                                  <button
                                    disabled={cargando}
                                    onClick={() => accionarCitaPortal(n.id, "rechazar")}
                                    style={{
                                      background: cargando ? "rgba(239,68,68,.05)" : "rgba(239,68,68,.15)",
                                      border: "1px solid rgba(239,68,68,.4)",
                                      borderRadius: 6, padding: "4px 11px", color: "#f87171",
                                      fontSize: 11, fontWeight: 700, cursor: cargando ? "not-allowed" : "pointer",
                                      display: "flex", alignItems: "center", gap: 4,
                                    }}
                                  >
                                    <i className="bi bi-x-lg" />
                                    Rechazar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { marcarNotifPortalLeida(n.id); if ((misRespuestas.length + notifsPortal.length) <= 1) setShowRespuestasDD(false); }}
                                  style={{
                                    background: "rgba(125,211,252,.15)", border: "1px solid rgba(125,211,252,.3)",
                                    borderRadius: 6, padding: "4px 10px", color: "#7dd3fc",
                                    fontSize: 10, fontWeight: 700, cursor: "pointer",
                                  }}
                                >
                                  <i className="bi bi-check-lg me-1" />Entendido
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {misRespuestas.length > 0 && (
                  <>
                    <div style={{ padding: "8px 16px 4px", fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      <i className="bi bi-reply-fill me-1" /> Soporte
                    </div>
                    {misRespuestas.map(r => (
                      <div key={r.id} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                            background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.3)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <i className="bi bi-reply-fill" style={{ color: "#10b981", fontSize: 14 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.asunto}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", lineHeight: 1.5, marginBottom: 7 }}>
                              {r.respuesta}
                            </div>
                            <button
                              onClick={() => { marcarRespuestaLeida(r.id); if ((misRespuestas.length + notifsPortal.length) <= 1) setShowRespuestasDD(false); }}
                              style={{
                                background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.3)",
                                borderRadius: 6, padding: "4px 10px", color: "#10b981",
                                fontSize: 10, fontWeight: 700, cursor: "pointer",
                              }}
                            >
                              <i className="bi bi-check-lg me-1" />Entendido
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {misRespuestas.length === 0 && notifsPortal.length === 0 ? (
                  <div style={{ padding: "28px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                    <i className="bi bi-check-circle" style={{ fontSize: 22, display: "block", marginBottom: 8, color: "#10b981" }} />
                    Sin notificaciones pendientes
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* 🎂 Campana cumpleañeros — solo usuarios regulares */}
        {!user?.super && cumpleaneros.length > 0 && (
          <div ref={cumpleRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowCumpleDD(v => !v)}
              title={`${cumpleaneros.length} paciente${cumpleaneros.length !== 1 ? "s" : ""} de cumpleaños hoy`}
              style={{
                background: "rgba(124,58,237,.2)",
                border: "1px solid rgba(124,58,237,.5)",
                borderRadius: 10, width: 36, height: 36,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative", flexShrink: 0,
                animation: "cumple-pulse 2s infinite",
              }}
            >
              <style>{`
                @keyframes cumple-pulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,.5); }
                  50%       { box-shadow: 0 0 0 6px rgba(124,58,237,0); }
                }
              `}</style>
              <span style={{ fontSize: 16 }}>🎂</span>
              <span style={{
                position: "absolute", top: -5, right: -5,
                background: "#7c3aed", color: "#fff",
                fontSize: 10, fontWeight: 700, borderRadius: "50%",
                width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #1a1a2e",
              }}>
                {cumpleaneros.length > 9 ? "9+" : cumpleaneros.length}
              </span>
            </button>

            {/* Dropdown cumpleañeros */}
            {showCumpleDD && (
              <div style={{
                position: "absolute", top: 44, right: 0, zIndex: 1200,
                background: "#112240", border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 14, width: 320, boxShadow: "0 16px 48px rgba(0,0,0,.6)",
                overflow: "hidden",
              }}>
                {/* Header */}
                <div style={{
                  padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.07)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13 }}>
                    🎂 Cumpleañeros de hoy
                  </span>
                  <span style={{
                    background: "rgba(124,58,237,.25)", color: "#c084fc",
                    fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px",
                  }}>
                    {cumpleaneros.length} hoy
                  </span>
                </div>

                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {cumpleaneros.map(p => (
                    <div key={p.id} style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(124,58,237,.25)", border: "1px solid rgba(124,58,237,.4)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#c084fc", fontWeight: 700, fontSize: 13,
                          overflow: "hidden",
                        }}>
                          {p.foto_perfil
                            ? <img src={p.foto_perfil.startsWith("http") ? p.foto_perfil : `${API_URL}/uploads/${p.foto_perfil}`}
                                   alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : `${p.nombres?.[0]}${p.apellidos?.[0]}`
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0",
                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.nombres} {p.apellidos}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                            🎂 Cumple {p.edad} años hoy
                          </div>
                        </div>
                        <button
                          onClick={() => { setModalFelicitar(p); setShowCumpleDD(false); }}
                          style={{
                            background: "rgba(124,58,237,.2)", border: "1px solid rgba(124,58,237,.4)",
                            borderRadius: 7, padding: "5px 10px",
                            color: "#c084fc", fontSize: 10, fontWeight: 700, cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <i className="bi bi-send-fill me-1" />Felicitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", padding: "10px 14px" }}>
                  <button
                    onClick={() => { navigate("/cumpleaneros"); setShowCumpleDD(false); }}
                    style={{
                      width: "100%", padding: "8px 12px",
                      background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.3)",
                      borderRadius: 8, color: "#c084fc", fontSize: "0.78rem", fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <i className="bi bi-cake2-fill" style={{ fontSize: 12 }} />
                    Ver todos los cumpleañeros
                    <i className="bi bi-arrow-right" style={{ fontSize: 11, marginLeft: "auto" }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* User menu dropdown */}
        <div ref={userMenuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            style={{
              background: showUserMenu
                ? "rgba(59,130,246,.15)"
                : "rgba(255,255,255,.05)",
              border: `1px solid ${showUserMenu ? "rgba(59,130,246,.35)" : "rgba(255,255,255,.1)"}`,
              borderRadius: 12, padding: "4px 10px 4px 5px",
              display: "flex", alignItems: "center", gap: 9,
              cursor: "pointer", transition: "all .15s ease",
            }}
            onMouseEnter={e => {
              if (!showUserMenu) {
                e.currentTarget.style.background = "rgba(59,130,246,.1)";
                e.currentTarget.style.borderColor = "rgba(59,130,246,.25)";
              }
            }}
            onMouseLeave={e => {
              if (!showUserMenu) {
                e.currentTarget.style.background = "rgba(255,255,255,.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,.1)";
              }
            }}
          >
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: esAlerta && planBadge
                  ? `linear-gradient(135deg, ${planBadge.color}, ${planBadge.color}bb)`
                  : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", border: "2px solid rgba(255,255,255,.2)",
              }}>
                {user?.foto_url
                  ? <img src={user.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.72rem" }}>{initials}</span>
                }
              </div>
            </div>
            <div className="d-none d-md-block" style={{ lineHeight: 1.25, textAlign: "left" }}>
              <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                {user?.nombres} {user?.apellidos}
              </div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {user?.tipo}
              </div>
            </div>
            <i
              className="bi bi-chevron-down d-none d-md-inline"
              style={{
                color: "rgba(255,255,255,.35)", fontSize: 10,
                transform: showUserMenu ? "rotate(180deg)" : "none",
                transition: "transform .2s",
              }}
            />
          </button>

          {showUserMenu && (
            <div style={{
              position: "absolute", top: 50, right: 0, zIndex: 1200,
              background: "#0f1f3d",
              border: "1px solid rgba(59,130,246,.18)",
              borderRadius: 16, width: 260,
              boxShadow: "0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(59,130,246,.08)",
              overflow: "hidden",
            }}>
              {/* Header con info del usuario */}
              <div style={{
                padding: "18px 16px",
                background: "linear-gradient(135deg, #0d1b2e 0%, #112240 60%, #0f2040 100%)",
                borderBottom: "1px solid rgba(59,130,246,.12)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: esAlerta && planBadge
                      ? `linear-gradient(135deg, ${planBadge.color}, ${planBadge.color}bb)`
                      : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden", border: "2px solid rgba(255,255,255,.2)",
                    boxShadow: "0 4px 12px rgba(0,0,0,.3)",
                  }}>
                    {user?.foto_url
                      ? <img src={user.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>{initials}</span>
                    }
                  </div>
                  <div>
                    <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "0.9rem" }}>
                      {user?.nombres} {user?.apellidos}
                    </div>
                    <div style={{ color: "rgba(255,255,255,.45)", fontSize: "0.72rem", marginTop: 1 }}>
                      {user?.email}
                    </div>
                    <span style={{
                      display: "inline-block", marginTop: 4,
                      fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.07em",
                      textTransform: "uppercase", padding: "2px 7px", borderRadius: 4,
                      background: "rgba(59,130,246,.2)", color: "#93c5fd",
                    }}>
                      {user?.tipo}
                    </span>
                  </div>
                </div>
              </div>

              {/* Opciones */}

              {/* Mi Perfil */}
              <button
                onClick={() => { navigate("/perfil"); setShowUserMenu(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 16px", background: "transparent",
                  border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: "0.84rem",
                  textAlign: "left",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <i className="bi bi-person-circle" style={{ fontSize: 15, color: "#64748b", width: 18, textAlign: "center" }} />
                Mi Perfil
              </button>

              {/* Badge de plan/licencia debajo de Mi Perfil */}
              {planBadge && (
                <div
                  title={`Plan ${planBadge.label}${diasRestantes !== null ? ` — ${diasRestantes} días restantes` : ""} · Click para solicitar plan`}
                  onClick={() => { window.dispatchEvent(new CustomEvent("solicitarPlan")); setShowUserMenu(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 16px",
                    background: planBadge.bg,
                    borderTop: `1px solid ${planBadge.border}`,
                    borderBottom: `1px solid ${planBadge.border}`,
                    animation: planBadge.pulse ? "licencia-pulse 2s infinite" : "none",
                    cursor: "pointer", userSelect: "none",
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  <i className={`bi ${planBadge.icon}`} style={{ fontSize: 15, color: planBadge.color, width: 18, textAlign: "center" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: planBadge.color, fontSize: "0.84rem", fontWeight: 700 }}>
                      Plan {planBadge.label}
                    </div>
                    {diasRestantes !== null && (
                      <div style={{ color: planBadge.color, opacity: 0.75, fontSize: "0.72rem" }}>
                        {diasRestantes} días restantes
                      </div>
                    )}
                  </div>
                  <i className="bi bi-arrow-right-circle" style={{ fontSize: 13, color: planBadge.color, opacity: 0.7 }} />
                </div>
              )}

              {/* Ayuda y Soporte */}
              <button
                onClick={() => { setShowUserMenu(false); setShowAyuda(true); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 16px", background: "transparent",
                  border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: "0.84rem",
                  textAlign: "left",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <i className="bi bi-headset" style={{ fontSize: 15, color: "#64748b", width: 18, textAlign: "center" }} />
                Ayuda y soporte
              </button>

              <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "4px 16px" }} />

              <button
                onClick={() => { salir(); setShowUserMenu(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 16px", marginBottom: 4, background: "transparent",
                  border: "none", cursor: "pointer", color: "#f87171", fontSize: "0.84rem",
                  textAlign: "left",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <i className="bi bi-box-arrow-right" style={{ fontSize: 15, width: 18, textAlign: "center" }} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>

    {mostrarBannerPush && (
      <div
        style={{
          background: pushPermission === "denied" ? "rgba(239,68,68,.12)" : "rgba(33,150,243,.12)",
          borderBottom: `1px solid ${pushPermission === "denied" ? "rgba(239,68,68,.35)" : "rgba(33,150,243,.35)"}`,
          padding: "10px 16px",
          display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 10,
        }}
      >
        <i
          className={`bi ${pushPermission === "denied" ? "bi-bell-slash-fill" : "bi-bell-fill"}`}
          style={{ color: pushPermission === "denied" ? "#ef4444" : "#2196f3", fontSize: 16 }}
        />
        <span style={{ fontSize: 13.5, color: "#e2e8f0" }}>
          {pushPermission === "denied"
            ? "Bloqueaste las notificaciones para esta app. Actívalas desde los ajustes del sitio en Chrome (candado 🔒 junto a la URL → Notificaciones → Permitir) para recibir avisos aunque la app esté cerrada."
            : "Activa las notificaciones para recibir avisos importantes en tu celular aunque la app esté cerrada o hayas cerrado sesión."}
          {pushError && (
            <span style={{ display: "block", color: "#fca5a5", fontSize: 12, marginTop: 2 }}>
              {pushError}
            </span>
          )}
        </span>
        {pushPermission !== "denied" && (
          <button
            onClick={clickActivarPush}
            disabled={activandoPush}
            style={{
              background: "#2196f3", border: "none", borderRadius: 8,
              color: "#fff", fontWeight: 600, fontSize: 13,
              padding: "6px 14px", cursor: activandoPush ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {activandoPush ? "Activando..." : pushError ? "Reintentar" : "Activar notificaciones"}
          </button>
        )}
        <button
          onClick={descartarBannerPush}
          title="Ahora no"
          style={{
            background: "transparent", border: "none", color: "#94a3b8",
            fontSize: 13, cursor: "pointer", flexShrink: 0,
          }}
        >
          Ahora no
        </button>
      </div>
    )}

    <ModalAyudaSoporte open={showAyuda} onClose={() => setShowAyuda(false)} />

    {/* 🎂 Modal de felicitación de cumpleaños */}
    {modalFelicitar && (
      <ModalFelicitarNavbar
        paciente={modalFelicitar}
        onClose={() => setModalFelicitar(null)}
      />
    )}
    </>
  );
}

/* ── Nombre de marca bicolor con destello para navbar oscuro ── */
function BrandName({ name = "", c1 = "#ffffff", c2 = "#2D6BE8" }) {
  const idx = name.indexOf("-");
  const c2Style = {
    background: `linear-gradient(90deg, ${c2} 20%, #ffffff 45%, #e0f0ff 50%, #ffffff 55%, ${c2} 80%)`,
    backgroundSize: "250% auto",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    animation: "brand-shine 7s linear infinite",
    filter: "brightness(1.9)",
    display: "inline-block",
  };
  if (idx === -1) return <span style={c2Style}>{name}</span>;
  return (
    <>
      <span style={{ color: c1 }}>{name.slice(0, idx + 1)}</span>
      <span style={c2Style}>{name.slice(idx + 1)}</span>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Modal de felicitación (mini, integrado en Navbar)                        */
/* ──────────────────────────────────────────────────────────────────────── */
function ModalFelicitarNavbar({ paciente, onClose }) {
  const nombre = `${paciente.nombres} ${paciente.apellidos}`;
  const [canales, setCanales] = useState({
    email:    !!(paciente.email),
    whatsapp: !!(paciente.telefono),
  });
  const [mensaje, setMensaje] = useState(
    `¡Hola ${paciente.nombres}! 🎂\n\nEn el día de tu cumpleaños, todo el equipo de nuestra clínica te desea un maravilloso día lleno de salud, alegría y momentos especiales.\n\n¡Que cumplas muchos más años! 🎉\n\nCon cariño,\nEl equipo de tu clínica`
  );
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const toggleCanal = (c) => setCanales(prev => ({ ...prev, [c]: !prev[c] }));

  const enviar = async () => {
    const seleccionados = Object.entries(canales).filter(([,v]) => v).map(([k]) => k);
    if (!seleccionados.length) return;
    setEnviando(true);
    try {
      const res = await api.post("/cumpleanos/felicitar", {
        paciente_id: paciente.id,
        canales: seleccionados,
        mensaje,
      });
      setResultado(res.data.resultados || {});
    } catch (e) {
      setResultado({ _error: e.response?.data?.msg || e.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
        boxShadow: "0 24px 60px rgba(0,0,0,.3)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#1a2744,#3b1d8a)",
          padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>
              🎂 ¡Felicitar a {nombre}!
            </div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.78rem", marginTop: 2 }}>
              Cumple {paciente.edad} años hoy
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)",
            borderRadius: "50%", width: 30, height: 30, cursor: "pointer",
            color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        <div style={{ padding: "18px 20px" }}>
          {/* Canales */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              onClick={() => toggleCanal("email")}
              disabled={!paciente.email}
              style={{
                flex: 1, padding: "8px 10px", borderRadius: 9,
                cursor: paciente.email ? "pointer" : "not-allowed",
                background: canales.email ? "rgba(37,99,235,.1)" : "#f9fafb",
                border: canales.email ? "2px solid #2563eb" : "2px solid #e5e7eb",
                display: "flex", alignItems: "center", gap: 6,
                opacity: paciente.email ? 1 : 0.4,
              }}
            >
              <i className="bi bi-envelope-fill" style={{ color: canales.email ? "#2563eb" : "#9ca3af", fontSize: 14 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: canales.email ? "#2563eb" : "#6b7280" }}>
                Email
              </span>
            </button>
            <button
              onClick={() => toggleCanal("whatsapp")}
              disabled={!paciente.telefono}
              style={{
                flex: 1, padding: "8px 10px", borderRadius: 9,
                cursor: paciente.telefono ? "pointer" : "not-allowed",
                background: canales.whatsapp ? "rgba(37,211,102,.1)" : "#f9fafb",
                border: canales.whatsapp ? "2px solid #25d366" : "2px solid #e5e7eb",
                display: "flex", alignItems: "center", gap: 6,
                opacity: paciente.telefono ? 1 : 0.4,
              }}
            >
              <i className="bi bi-whatsapp" style={{ color: canales.whatsapp ? "#25d366" : "#9ca3af", fontSize: 14 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: canales.whatsapp ? "#25d366" : "#6b7280" }}>
                WhatsApp
              </span>
            </button>
          </div>

          {/* Mensaje */}
          <textarea
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            rows={5}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 12.5,
              border: "1px solid #e5e7eb", color: "#374151", resize: "vertical",
              outline: "none", lineHeight: 1.6, fontFamily: "inherit", marginBottom: 14,
            }}
          />

          {/* Resultado */}
          {resultado && (
            <div style={{ marginBottom: 12 }}>
              {Object.entries(resultado).map(([canal, r]) => (
                canal === "_error" ? (
                  <div key="err" style={{
                    background: "#fee2e2", borderRadius: 8, padding: "8px 12px",
                    fontSize: 12, color: "#991b1b", marginBottom: 6,
                  }}>
                    <i className="bi bi-x-circle-fill me-2" />Error: {r}
                  </div>
                ) : (
                  <div key={canal} style={{
                    background: r.ok ? "#dcfce7" : "#fee2e2",
                    borderRadius: 8, padding: "8px 12px", fontSize: 12,
                    color: r.ok ? "#166534" : "#991b1b", marginBottom: 6,
                    display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  }}>
                    <i className={`bi ${r.ok ? "bi-check-circle-fill" : "bi-x-circle-fill"}`} />
                    <strong style={{ textTransform: "capitalize" }}>{canal}</strong>: {r.msg}
                    {r.fallback && r.link && (
                      <a href={r.link} target="_blank" rel="noreferrer" style={{
                        marginLeft: "auto", background: "#25d366", color: "#fff",
                        borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700,
                        textDecoration: "none",
                      }}>
                        <i className="bi bi-whatsapp me-1" />Abrir
                      </a>
                    )}
                  </div>
                )
              ))}
            </div>
          )}

          {/* Botones */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{
              background: "transparent", border: "1px solid #d1d5db",
              borderRadius: 8, padding: "8px 18px", color: "#374151",
              cursor: "pointer", fontWeight: 600, fontSize: "0.83rem",
            }}>
              {resultado ? "Cerrar" : "Cancelar"}
            </button>
            {!resultado && (
              <button
                onClick={enviar}
                disabled={enviando || (!canales.email && !canales.whatsapp)}
                style={{
                  background: "linear-gradient(135deg,#7c3aed,#db2777)",
                  border: "none", borderRadius: 8, padding: "8px 20px",
                  color: "#fff", fontWeight: 700, fontSize: "0.83rem",
                  cursor: enviando ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                  opacity: (!canales.email && !canales.whatsapp) ? 0.5 : 1,
                }}
              >
                {enviando
                  ? <><i className="bi bi-hourglass-split" /> Enviando...</>
                  : <><i className="bi bi-send-fill" /> Enviar</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
