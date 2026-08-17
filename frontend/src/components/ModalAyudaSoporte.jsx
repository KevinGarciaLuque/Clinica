import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api/api";

const FAQS = [
  {
    q: "¿Cómo agrego un nuevo paciente?",
    a: "Ve a la sección Pacientes en el menú lateral y haz clic en el botón \"Nuevo Paciente\".",
  },
  {
    q: "¿Cómo programo una cita?",
    a: "Accede a Citas → Nueva cita. Selecciona el paciente, médico, fecha y hora disponible.",
  },
  {
    q: "¿Cómo cambio mi contraseña?",
    a: "En Mi Perfil encontrarás la sección \"Cambiar contraseña\" al final de la página.",
  },
  {
    q: "¿Cómo actualizo mi foto de perfil?",
    a: "Desde Mi Perfil puedes subir o cambiar tu foto haciendo clic en la imagen del avatar.",
  },
  {
    q: "¿Qué hago si olvidé mi contraseña?",
    a: "En la pantalla de inicio de sesión haz clic en \"¿Olvidaste tu contraseña?\" y sigue los pasos.",
  },
];

export default function ModalAyudaSoporte({ open, onClose }) {
  const [faqAbierta, setFaqAbierta] = useState(null);
  const [tab, setTab] = useState("contacto"); // "contacto" | "faq" | "reporte"

  // Estado del formulario de reporte
  const [asunto, setAsunto]         = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando]     = useState(false);
  const [enviado, setEnviado]       = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  const handleReportar = async (e) => {
    e.preventDefault();
    if (!asunto.trim() || !descripcion.trim()) return;
    setEnviando(true); setErrorEnvio("");
    try {
      await api.post("/soporte/reportar", { asunto: asunto.trim(), descripcion: descripcion.trim() });
      setEnviado(true);
      setAsunto(""); setDescripcion("");
    } catch (err) {
      setErrorEnvio(err.response?.data?.msg || "Error al enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (!open) return null;

  const content = (
    <>
    <style>{`
      @media (max-width: 500px) {
        .ayuda-modal-wrapper {
          top: auto !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          transform: none !important;
          width: 100% !important;
        }
        .ayuda-modal-box {
          border-radius: 20px 20px 0 0 !important;
          max-height: 88vh !important;
        }
        .ayuda-modal-header { padding: 16px 16px 0 !important; }
        .ayuda-modal-body   { padding: 14px !important; }
        .ayuda-modal-footer { padding: 10px 14px !important; }
        .ayuda-tab-btn {
          padding: 8px 10px !important;
          flex: 1 !important;
          justify-content: center !important;
        }
        .ayuda-tab-label { display: none !important; }
      }
    `}</style>
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 2000,
              background: "rgba(0,0,0,.6)",
              backdropFilter: "blur(4px)",
            }}
          />

          {/* Modal — wrapper fijo para centrado, motion.div solo anima */}
          <div className="ayuda-modal-wrapper" style={{
            position: "fixed", zIndex: 2001,
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(520px, calc(100vw - 32px))",
          }}>
          <motion.div
            key="modal"
            className="ayuda-modal-box"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            style={{
              maxHeight: "90vh",
              background: "#0f1e38",
              borderRadius: 20,
              boxShadow: "0 32px 80px rgba(0,0,0,.7)",
              border: "1px solid rgba(255,255,255,.08)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* ── Header ── */}
            <div className="ayuda-modal-header" style={{
              background: "linear-gradient(135deg, #1a2f5a 0%, #0f1e38 100%)",
              padding: "24px 24px 0",
              borderBottom: "1px solid rgba(255,255,255,.06)",
            }}>
              {/* Título */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 14,
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 20px rgba(37,99,235,.4)",
                    flexShrink: 0,
                  }}>
                    <i className="bi bi-headset" style={{ color: "#fff", fontSize: 22 }} />
                  </div>
                  <div>
                    <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: "1.05rem" }}>
                      Ayuda y Soporte
                    </div>
                    <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.75rem", marginTop: 2 }}>
                      Estamos aquí para ayudarte
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
                    borderRadius: 10, width: 34, height: 34,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "rgba(255,255,255,.5)", flexShrink: 0,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.12)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.06)"}
                >
                  <i className="bi bi-x-lg" style={{ fontSize: 13 }} />
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { key: "contacto", label: "Contacto",            icon: "bi-chat-dots" },
                  { key: "reporte",  label: "Reportar problema",   icon: "bi-bug" },
                  { key: "faq",      label: "Preguntas frecuentes", icon: "bi-question-circle" },
                ].map(t => (
                  <button
                    key={t.key}
                    className="ayuda-tab-btn"
                    onClick={() => setTab(t.key)}
                    style={{
                      background: tab === t.key ? "rgba(37,99,235,.2)" : "transparent",
                      border: tab === t.key ? "1px solid rgba(37,99,235,.4)" : "1px solid transparent",
                      borderRadius: "10px 10px 0 0",
                      padding: "8px 16px",
                      color: tab === t.key ? "#93c5fd" : "rgba(255,255,255,.4)",
                      fontSize: "0.8rem", fontWeight: tab === t.key ? 700 : 500,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      transition: "all .15s",
                    }}
                    title={t.label}
                  >
                    <i className={`bi ${t.icon}`} />
                    <span className="ayuda-tab-label">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Contenido scrollable ── */}
            <div className="ayuda-modal-body" style={{ overflowY: "auto", flex: 1, padding: 24 }}>

              {/* TAB CONTACTO */}
              {tab === "contacto" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Tarjeta del desarrollador */}
                  <div style={{
                    background: "linear-gradient(135deg, rgba(37,99,235,.12) 0%, rgba(29,78,216,.06) 100%)",
                    border: "1px solid rgba(37,99,235,.25)",
                    borderRadius: 16, padding: "20px",
                    marginBottom: 20,
                    display: "flex", alignItems: "center", gap: 16,
                  }}>
                    <div style={{
                      width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 24, boxShadow: "0 8px 20px rgba(37,99,235,.35)",
                      border: "2px solid rgba(255,255,255,.15)",
                    }}>
                      👨‍💻
                    </div>
                    <div>
                      <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "0.95rem" }}>
                        Kevin García
                      </div>
                      <div style={{ color: "rgba(255,255,255,.45)", fontSize: "0.78rem", marginTop: 2 }}>
                        Desarrollador · Medic-KG v1.0
                      </div>
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {["React", "Node.js", "MySQL"].map(tag => (
                          <span key={tag} style={{
                            background: "rgba(99,179,237,.12)", border: "1px solid rgba(99,179,237,.25)",
                            color: "#90cdf4", fontSize: "0.62rem", fontWeight: 700,
                            padding: "2px 8px", borderRadius: 5, letterSpacing: "0.05em",
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Canales de contacto */}
                  <p style={{ color: "rgba(255,255,255,.35)", fontSize: "0.75rem", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Canales de contacto
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* WhatsApp */}
                    <a
                      href="https://wa.me/50496065564?text=Hola%20Kevin%2C%20necesito%20soporte%20con%20Multi-Cl%C3%ADnica"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: "none" }}
                    >
                      <div
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          background: "rgba(37,211,102,.08)", border: "1px solid rgba(37,211,102,.22)",
                          borderRadius: 14, padding: "14px 16px",
                          cursor: "pointer", transition: "all .15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,211,102,.15)"; e.currentTarget.style.borderColor = "rgba(37,211,102,.4)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(37,211,102,.08)"; e.currentTarget.style.borderColor = "rgba(37,211,102,.22)"; }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                          background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 4px 12px rgba(37,211,102,.35)",
                        }}>
                          <i className="bi bi-whatsapp" style={{ color: "#fff", fontSize: 20 }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "0.88rem" }}>WhatsApp</div>
                          <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.75rem", marginTop: 1 }}>+504 9606-5564 · Respuesta rápida</div>
                        </div>
                        <i className="bi bi-box-arrow-up-right" style={{ color: "rgba(37,211,102,.6)", fontSize: 13 }} />
                      </div>
                    </a>

                    {/* Email */}
                    <a
                      href="mailto:kevinxgt90@gmail.com?subject=Soporte%20Multi-Cl%C3%ADnica"
                      style={{ textDecoration: "none" }}
                    >
                      <div
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          background: "rgba(59,130,246,.08)", border: "1px solid rgba(59,130,246,.22)",
                          borderRadius: 14, padding: "14px 16px",
                          cursor: "pointer", transition: "all .15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,.15)"; e.currentTarget.style.borderColor = "rgba(59,130,246,.4)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(59,130,246,.08)"; e.currentTarget.style.borderColor = "rgba(59,130,246,.22)"; }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 4px 12px rgba(59,130,246,.35)",
                        }}>
                          <i className="bi bi-envelope-fill" style={{ color: "#fff", fontSize: 18 }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "0.88rem" }}>Correo electrónico</div>
                          <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.75rem", marginTop: 1 }}>kevinxgt90@gmail.com</div>
                        </div>
                        <i className="bi bi-box-arrow-up-right" style={{ color: "rgba(59,130,246,.6)", fontSize: 13 }} />
                      </div>
                    </a>
                  </div>

                  {/* Aviso de horario */}
                  <div style={{
                    marginTop: 20,
                    background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.2)",
                    borderRadius: 12, padding: "12px 14px",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <i className="bi bi-clock" style={{ color: "#f59e0b", fontSize: 15, flexShrink: 0 }} />
                    <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.76rem", lineHeight: 1.5 }}>
                      Horario de atención: <strong style={{ color: "rgba(255,255,255,.7)" }}>Lunes a Viernes · 8:00 AM – 6:00 PM</strong>
                      <br />Tiempo de respuesta estimado: menos de 24 horas
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB REPORTE */}
              {tab === "reporte" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {enviado ? (
                    <div style={{
                      textAlign: "center", padding: "32px 16px",
                    }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                        background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <i className="bi bi-check-lg" style={{ color: "#10b981", fontSize: 28 }} />
                      </div>
                      <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "1rem", marginBottom: 8 }}>
                        ¡Reporte enviado!
                      </div>
                      <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.82rem", marginBottom: 24 }}>
                        Kevin revisará tu reporte y recibirás respuesta pronto.
                      </div>
                      <button
                        onClick={() => setEnviado(false)}
                        style={{
                          background: "rgba(37,99,235,.2)", border: "1px solid rgba(37,99,235,.4)",
                          borderRadius: 10, padding: "8px 20px", color: "#93c5fd",
                          fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        Enviar otro reporte
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleReportar}>
                      <p style={{ color: "rgba(255,255,255,.35)", fontSize: "0.75rem", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Reportar un problema
                      </p>

                      {/* Asunto */}
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ color: "rgba(255,255,255,.5)", fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: 6 }}>
                          Tipo de problema <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={asunto}
                          onChange={e => setAsunto(e.target.value)}
                          required
                          style={{
                            width: "100%", padding: "10px 12px",
                            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
                            borderRadius: 10, color: asunto ? "#f1f5f9" : "rgba(255,255,255,.3)",
                            fontSize: "0.84rem", outline: "none", cursor: "pointer",
                          }}
                          onFocus={e => e.target.style.borderColor = "rgba(37,99,235,.5)"}
                          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,.1)"}
                        >
                          <option value="" disabled style={{ background: "#1a2744" }}>Selecciona el tipo...</option>
                          <option value="Error en el sistema" style={{ background: "#1a2744" }}>Error en el sistema</option>
                          <option value="Problema con pacientes" style={{ background: "#1a2744" }}>Problema con pacientes</option>
                          <option value="Problema con citas" style={{ background: "#1a2744" }}>Problema con citas</option>
                          <option value="Problema con consultas" style={{ background: "#1a2744" }}>Problema con consultas</option>
                          <option value="Problema con recetas" style={{ background: "#1a2744" }}>Problema con recetas</option>
                          <option value="Problema de acceso / permisos" style={{ background: "#1a2744" }}>Problema de acceso / permisos</option>
                          <option value="Lentitud o rendimiento" style={{ background: "#1a2744" }}>Lentitud o rendimiento</option>
                          <option value="Sugerencia de mejora" style={{ background: "#1a2744" }}>Sugerencia de mejora</option>
                          <option value="Otro" style={{ background: "#1a2744" }}>Otro</option>
                        </select>
                      </div>

                      {/* Descripción */}
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ color: "rgba(255,255,255,.5)", fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: 6 }}>
                          Descripción detallada <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <textarea
                          value={descripcion}
                          onChange={e => setDescripcion(e.target.value)}
                          required
                          maxLength={2000}
                          rows={5}
                          placeholder="Describe el problema con el mayor detalle posible: qué hiciste, qué esperabas que pasara y qué ocurrió..."
                          style={{
                            width: "100%", padding: "10px 12px", resize: "vertical",
                            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
                            borderRadius: 10, color: "#f1f5f9", fontSize: "0.82rem",
                            outline: "none", lineHeight: 1.6, boxSizing: "border-box",
                            fontFamily: "inherit",
                          }}
                          onFocus={e => e.target.style.borderColor = "rgba(37,99,235,.5)"}
                          onBlur={e => e.target.style.borderColor = "rgba(255,255,255,.1)"}
                        />
                        <div style={{ textAlign: "right", color: "rgba(255,255,255,.25)", fontSize: "0.7rem", marginTop: 4 }}>
                          {descripcion.length}/2000
                        </div>
                      </div>

                      {errorEnvio && (
                        <div style={{
                          background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
                          borderRadius: 10, padding: "10px 14px", marginBottom: 14,
                          color: "#fca5a5", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 8,
                        }}>
                          <i className="bi bi-exclamation-triangle-fill" style={{ flexShrink: 0 }} />
                          {errorEnvio}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={enviando || !asunto || !descripcion.trim()}
                        style={{
                          width: "100%", padding: "11px 0",
                          background: enviando || !asunto || !descripcion.trim()
                            ? "rgba(37,99,235,.3)"
                            : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                          border: "none", borderRadius: 12,
                          color: "#fff", fontWeight: 700, fontSize: "0.88rem",
                          cursor: enviando || !asunto || !descripcion.trim() ? "not-allowed" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          boxShadow: "0 4px 16px rgba(37,99,235,.3)",
                          transition: "opacity .15s",
                        }}
                      >
                        {enviando
                          ? <><i className="bi bi-arrow-repeat" style={{ animation: "spin .8s linear infinite" }} /> Enviando...</>
                          : <><i className="bi bi-send-fill" /> Enviar reporte</>
                        }
                      </button>
                    </form>
                  )}
                </motion.div>
              )}

              {/* TAB FAQ */}
              {tab === "faq" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <p style={{ color: "rgba(255,255,255,.35)", fontSize: "0.75rem", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Preguntas frecuentes
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {FAQS.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          background: faqAbierta === i ? "rgba(37,99,235,.1)" : "rgba(255,255,255,.04)",
                          border: `1px solid ${faqAbierta === i ? "rgba(37,99,235,.3)" : "rgba(255,255,255,.08)"}`,
                          borderRadius: 12, overflow: "hidden",
                          transition: "all .2s",
                        }}
                      >
                        <button
                          onClick={() => setFaqAbierta(faqAbierta === i ? null : i)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                            gap: 10, padding: "13px 16px",
                            background: "transparent", border: "none", cursor: "pointer",
                            color: faqAbierta === i ? "#93c5fd" : "#e2e8f0",
                            fontSize: "0.85rem", fontWeight: 600, textAlign: "left",
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <i className="bi bi-question-circle-fill" style={{ color: faqAbierta === i ? "#3b82f6" : "#475569", fontSize: 14, flexShrink: 0 }} />
                            {item.q}
                          </span>
                          <i
                            className="bi bi-chevron-down"
                            style={{
                              fontSize: 12, flexShrink: 0, color: "rgba(255,255,255,.3)",
                              transform: faqAbierta === i ? "rotate(180deg)" : "none",
                              transition: "transform .2s",
                            }}
                          />
                        </button>
                        <AnimatePresence>
                          {faqAbierta === i && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ overflow: "hidden" }}
                            >
                              <div style={{
                                padding: "0 16px 14px 40px",
                                color: "rgba(255,255,255,.5)", fontSize: "0.82rem", lineHeight: 1.6,
                              }}>
                                {item.a}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>

                  {/* CTA si no encontró respuesta */}
                  <div style={{
                    marginTop: 18, textAlign: "center",
                    color: "rgba(255,255,255,.3)", fontSize: "0.78rem",
                  }}>
                    ¿No encontraste respuesta?{" "}
                    <button
                      onClick={() => setTab("contacto")}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#60a5fa", fontWeight: 700, fontSize: "0.78rem",
                        textDecoration: "underline", padding: 0,
                      }}
                    >
                      Contáctame directamente
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="ayuda-modal-footer" style={{
              padding: "14px 24px",
              borderTop: "1px solid rgba(255,255,255,.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(0,0,0,.15)",
            }}>
              <div style={{ color: "rgba(255,255,255,.2)", fontSize: "0.72rem" }}>
                Medic-KG v1.0 · 2026 · Kevin García
              </div>
              <button
                onClick={onClose}
                style={{
                  background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 8, padding: "6px 16px", color: "rgba(255,255,255,.5)",
                  fontSize: "0.8rem", cursor: "pointer", fontWeight: 600,
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.12)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.07)"}
              >
                Cerrar
              </button>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
    </>
  );

  return createPortal(content, document.body);
}
