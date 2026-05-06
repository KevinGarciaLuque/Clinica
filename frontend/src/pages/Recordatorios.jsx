import { useState, useEffect } from "react";
import { Row, Col, Form, Modal, Button } from "react-bootstrap";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

const TABS_CONFIG = [
  { id: "config-email",    icon: "bi-envelope-fill",  label: "Email / SMTP" },
  { id: "config-sms",      icon: "bi-phone-fill",      label: "SMS" },
  { id: "config-whatsapp", icon: "bi-whatsapp",        label: "WhatsApp" },
  { id: "plantillas",      icon: "bi-file-text-fill",  label: "Plantillas" },
  { id: "automatico",      icon: "bi-gear-fill",       label: "Automático" },
  { id: "historial",       icon: "bi-bar-chart-fill",  label: "Historial" },
];

const Recordatorios = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("config-email");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  // Estados para configuración SMTP
  const [smtpConfig, setSmtpConfig] = useState({
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_pass: "",
    smtp_secure: 0,
    from_email: "",
    from_name: "",
    activo: 1,
  });

  // Estados para configuración de mensajería (Twilio)
  const [smsConfig, setSmsConfig] = useState({
    account_sid: "",
    auth_token: "",
    from_number: "",
    activo: 1,
  });

  const [whatsappConfig, setWhatsappConfig] = useState({
    account_sid: "",
    auth_token: "",
    from_number: "",
    activo: 1,
  });

  // Estados para plantillas
  const [plantillas, setPlantillas] = useState([]);
  const [showModalPlantilla, setShowModalPlantilla] = useState(false);
  const [plantillaEdit, setPlantillaEdit] = useState(null);

  // Estado para configuración automática
  const [configAutomatico, setConfigAutomatico] = useState({
    email_activo: 0,
    email_48h: 0,
    email_24h: 1,
    email_2h: 0,
    sms_activo: 0,
    sms_48h: 0,
    sms_24h: 0,
    sms_2h: 0,
    whatsapp_activo: 0,
    whatsapp_48h: 0,
    whatsapp_24h: 0,
    whatsapp_2h: 0,
    hora_ejecucion_diaria: "08:00:00",
  });

  // Historial y estadísticas
  const [historial, setHistorial] = useState([]);
  const [estadisticas, setEstadisticas] = useState({});

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      await Promise.all([
        cargarSMTPConfig(),
        cargarEmailClinicaDefault(),
        cargarMensajeriaConfig(),
        cargarPlantillas(),
        cargarConfigAutomatico(),
        cargarHistorial(),
        cargarEstadisticas(),
      ]);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };

  const cargarEmailClinicaDefault = async () => {
    try {
      const clinicaId = user?.clinica_id;
      if (!clinicaId) return;
      const { data } = await api.get(`/clinicas/${clinicaId}`);
      const emailClinica = data?.data?.email || "";
      const nombreClinica = data?.data?.nombre || "";
      if (!emailClinica) return;
      setSmtpConfig((prev) => {
        // No sobrescribir si ya hay configuración SMTP cargada o escrita por usuario
        if (prev.from_email) return prev;
        return {
          ...prev,
          from_email: emailClinica,
          from_name: prev.from_name || nombreClinica || prev.from_name,
        };
      });
    } catch (error) {
      console.error("Error cargando email de clínica:", error);
    }
  };

  const cargarSMTPConfig = async () => {
    try {
      const { data } = await api.get("/recordatorios/config/smtp");
      if (data.config) {
        setSmtpConfig((prev) => ({
          ...data.config,
          smtp_pass: prev.smtp_pass || "", // Conservar contraseña si el usuario ya la escribió
        }));
      }
    } catch (error) {
      console.error("Error cargando config SMTP:", error);
    }
  };

  const cargarMensajeriaConfig = async () => {
    try {
      const { data } = await api.get("/recordatorios/config/mensajeria");
      const configs = data.configs || [];

      const sms = configs.find((c) => c.servicio === "TWILIO_SMS");
      const whatsapp = configs.find((c) => c.servicio === "TWILIO_WHATSAPP");

      if (sms) setSmsConfig({ ...sms, auth_token: "" });
      if (whatsapp) setWhatsappConfig({ ...whatsapp, auth_token: "" });
    } catch (error) {
      console.error("Error cargando config mensajería:", error);
    }
  };

  const cargarPlantillas = async () => {
    try {
      const { data } = await api.get("/recordatorios/plantillas");
      setPlantillas(data.plantillas || []);
    } catch (error) {
      console.error("Error cargando plantillas:", error);
    }
  };

  const cargarConfigAutomatico = async () => {
    try {
      const { data } = await api.get("/recordatorios/config/automatico");
      if (data.config) {
        // Normalizar hora de "HH:MM:SS" a "HH:MM" para el input type="time"
        const hora = (data.config.hora_ejecucion_diaria || "08:00:00").slice(0, 5);
        setConfigAutomatico({ ...data.config, hora_ejecucion_diaria: hora });
      }
    } catch (error) {
      console.error("Error cargando config automático:", error);
    }
  };

  const cargarHistorial = async () => {
    try {
      const { data } = await api.get("/recordatorios/historial?limit=50");
      setHistorial(data.historial || []);
    } catch (error) {
      console.error("Error cargando historial:", error);
    }
  };

  const cargarEstadisticas = async () => {
    try {
      const { data } = await api.get("/recordatorios/estadisticas");
      setEstadisticas(data.estadisticas || {});
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // GUARDAR CONFIGURACIONES
  // ═════════════════════════════════════════════════════════════

  const guardarSMTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/recordatorios/config/smtp", smtpConfig);
      setMensaje({ tipo: "success", texto: "Configuración SMTP guardada correctamente" });
      await cargarSMTPConfig();
    } catch (error) {
      setMensaje({ tipo: "danger", texto: error.response?.data?.error || "Error al guardar" });
    } finally {
      setLoading(false);
    }
  };

  const probarSMTP = async () => {
    const email = prompt("Ingresa el email de prueba:");
    if (!email) return;

    setLoading(true);
    try {
      await api.post("/recordatorios/config/smtp/test", { email_destino: email });
      setMensaje({ tipo: "success", texto: "¡Email de prueba enviado! Revisa tu bandeja." });
    } catch (error) {
      setMensaje({ tipo: "danger", texto: error.response?.data?.error || "Error al enviar email" });
    } finally {
      setLoading(false);
    }
  };

  const guardarMensajeria = async (servicio, config) => {
    setLoading(true);
    try {
      await api.post("/recordatorios/config/mensajeria", { servicio, ...config });
      setMensaje({ tipo: "success", texto: `Configuración de ${servicio} guardada` });
      await cargarMensajeriaConfig();
    } catch (error) {
      setMensaje({ tipo: "danger", texto: error.response?.data?.error || "Error al guardar" });
    } finally {
      setLoading(false);
    }
  };

  const probarMensajeria = async (servicio, config) => {
    const telefono = prompt("Ingresa el número de prueba (con código de país, ej: +51987654321):");
    if (!telefono) return;

    setLoading(true);
    try {
      await api.post("/recordatorios/config/mensajeria/test", {
        servicio,
        telefono_destino: telefono,
      });
      setMensaje({ tipo: "success", texto: `Mensaje de prueba enviado a ${telefono}` });
    } catch (error) {
      setMensaje({ tipo: "danger", texto: error.response?.data?.error || "Error al enviar" });
    } finally {
      setLoading(false);
    }
  };

  const guardarConfigAutomatico = async () => {
    setLoading(true);
    try {
      await api.put("/recordatorios/config/automatico", configAutomatico);
      setMensaje({ tipo: "success", texto: "Configuración automática guardada" });
    } catch (error) {
      setMensaje({ tipo: "danger", texto: "Error al guardar configuración" });
    } finally {
      setLoading(false);
    }
  };

  const crearPlantillasPredeterminadas = async () => {
    setLoading(true);
    try {
      await api.post("/recordatorios/plantillas/crear-predeterminadas");
      setMensaje({ tipo: "success", texto: "Plantillas predeterminadas creadas" });
      await cargarPlantillas();
    } catch (error) {
      setMensaje({ tipo: "danger", texto: "Error al crear plantillas" });
    } finally {
      setLoading(false);
    }
  };

  const guardarPlantilla = async (plantilla) => {
    setLoading(true);
    try {
      if (plantilla.id) {
        await api.put(`/recordatorios/plantillas/${plantilla.id}`, plantilla);
      } else {
        await api.post("/recordatorios/plantillas", plantilla);
      }
      setMensaje({ tipo: "success", texto: "Plantilla guardada" });
      setShowModalPlantilla(false);
      setPlantillaEdit(null);
      await cargarPlantillas();
    } catch (error) {
      setMensaje({ tipo: "danger", texto: "Error al guardar plantilla" });
    } finally {
      setLoading(false);
    }
  };

  const eliminarPlantilla = async (id) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;

    try {
      await api.delete(`/recordatorios/plantillas/${id}`);
      setMensaje({ tipo: "success", texto: "Plantilla eliminada" });
      await cargarPlantillas();
    } catch (error) {
      setMensaje({ tipo: "danger", texto: "Error al eliminar" });
    }
  };

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-bell-fill" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Recordatorios</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>
              Configura recordatorios automáticos por Email, WhatsApp y SMS
            </div>
          </div>
        </div>
        <button
          onClick={cargarDatos}
          disabled={loading}
          style={{
            background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)",
            borderRadius: 8, color: "#e2e8f0", padding: "6px 14px",
            fontSize: "0.8rem", cursor: "pointer", fontWeight: 500,
            display: "flex", alignItems: "center", gap: 6, opacity: loading ? 0.7 : 1,
          }}>
          <i className="bi bi-arrow-clockwise"></i> Actualizar
        </button>
      </div>

      <div style={{ padding: "20px 24px" }}>

        {/* ═══ ALERTA ═══ */}
        {mensaje.texto && (
          <div style={{
            marginBottom: 16, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: mensaje.tipo === "success" ? "#dcfce7" : "#fee2e2",
            color: mensaje.tipo === "success" ? "#166534" : "#991b1b",
            border: `1px solid ${mensaje.tipo === "success" ? "#bbf7d0" : "#fecaca"}`,
          }}>
            <span>
              <i className={`bi ${mensaje.tipo === "success" ? "bi-check-circle-fill" : "bi-x-circle-fill"} me-2`}></i>
              {mensaje.texto}
            </span>
            <button
              onClick={() => setMensaje({ tipo: "", texto: "" })}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit", padding: "0 4px" }}
            >×</button>
          </div>
        )}

        {/* ═══ ESTADÍSTICAS ═══ */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", flex: "1 1 180px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #6366f1" }}>
            <div style={{ fontSize: "1.7rem", fontWeight: 700, color: "#111827" }}>{estadisticas.total || 0}</div>
            <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 2 }}>Total enviados (30 días)</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", flex: "1 1 180px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #22c55e" }}>
            <div style={{ fontSize: "1.7rem", fontWeight: 700, color: "#16a34a" }}>{estadisticas.enviados || 0}</div>
            <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 2 }}>Exitosos</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", flex: "1 1 180px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #ef4444" }}>
            <div style={{ fontSize: "1.7rem", fontWeight: 700, color: "#dc2626" }}>{estadisticas.fallidos || 0}</div>
            <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 2 }}>Fallidos</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 24px", flex: "1 1 200px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: "3px solid #0ea5e9" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.83rem" }}>
                <i className="bi bi-envelope-fill" style={{ color: "#3b82f6", width: 16 }}></i>
                <span style={{ color: "#374151" }}>Emails:</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>{estadisticas.emails || 0}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.83rem" }}>
                <i className="bi bi-phone-fill" style={{ color: "#8b5cf6", width: 16 }}></i>
                <span style={{ color: "#374151" }}>SMS:</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>{estadisticas.sms || 0}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.83rem" }}>
                <i className="bi bi-whatsapp" style={{ color: "#22c55e", width: 16 }}></i>
                <span style={{ color: "#374151" }}>WhatsApp:</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>{estadisticas.whatsapp || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ TABS ═══ */}
        <div style={{
          background: "#fff", borderRadius: "12px 12px 0 0",
          borderBottom: "1px solid #e5e7eb", display: "flex", padding: "0 6px",
          boxShadow: "0 1px 4px rgba(0,0,0,.04)", overflowX: "auto",
        }}>
          {TABS_CONFIG.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: "none", border: "none",
              borderBottom: activeTab === t.id ? "2.5px solid #3b82f6" : "2.5px solid transparent",
              color: activeTab === t.id ? "#2563eb" : "#6b7280",
              fontWeight: activeTab === t.id ? 700 : 500,
              padding: "12px 18px", fontSize: "0.85rem", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
              transition: "color .15s",
            }}>
              <i className={`bi ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* ═══ CONTENIDO ═══ */}
        <div style={{
          background: "#fff", borderRadius: "0 0 12px 12px",
          boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: "28px",
        }}>

          {/* ─── TAB: Email / SMTP ─── */}
          {activeTab === "config-email" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h5 style={{ fontWeight: 700, color: "#111827", fontSize: "1rem", margin: 0 }}>
                  <i className="bi bi-envelope-fill me-2" style={{ color: "#3b82f6" }}></i>
                  Configuración de Email (SMTP)
                </h5>
              </div>
              <Form onSubmit={guardarSMTP}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>
                        Servidor SMTP <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="smtp.gmail.com"
                        value={smtpConfig.smtp_host}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Puerto</Form.Label>
                      <Form.Control
                        type="number"
                        value={smtpConfig.smtp_port}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: parseInt(e.target.value) })}
                        required
                      />
                      <Form.Text className="text-muted">587 (TLS) o 465 (SSL)</Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Tipo de conexión</Form.Label>
                      <Form.Select
                        value={smtpConfig.smtp_secure}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_secure: parseInt(e.target.value) })}
                      >
                        <option value={0}>TLS (587)</option>
                        <option value={1}>SSL (465)</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>
                        Usuario SMTP <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="tu-email@gmail.com"
                        value={smtpConfig.smtp_user}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>
                        Contraseña SMTP <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="password"
                        placeholder={smtpConfig.id ? "Dejar vacío para mantener la actual" : "Contraseña o App Password"}
                        value={smtpConfig.smtp_pass}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_pass: e.target.value })}
                        required={!smtpConfig.id}
                      />
                      <Form.Text className="text-muted">
                        {smtpConfig.id && !smtpConfig.smtp_pass
                          ? "✅ Contraseña guardada — déjala vacía para no cambiarla"
                          : <>Para Gmail, usa una{" "}<a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">contraseña de aplicación</a></>
                        }
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>
                        Email del remitente <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="clinica@ejemplo.com"
                        value={smtpConfig.from_email}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Nombre del remitente</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Mi Clínica"
                        value={smtpConfig.from_name}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Check
                  type="checkbox"
                  label="Activar envío de emails"
                  checked={smtpConfig.activo === 1}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, activo: e.target.checked ? 1 : 0 })}
                  className="mb-3"
                />
                <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                  <button type="submit" disabled={loading} style={{
                    background: "#2563eb", color: "#fff", border: "none",
                    borderRadius: 8, padding: "8px 20px", fontWeight: 600,
                    fontSize: "0.87rem", cursor: "pointer", opacity: loading ? 0.7 : 1,
                  }}>
                    {loading ? "Guardando..." : "Guardar configuración"}
                  </button>
                  <button type="button" onClick={probarSMTP} disabled={loading || !smtpConfig.id} style={{
                    background: "transparent", color: "#374151",
                    border: "1px solid #d1d5db", borderRadius: 8,
                    padding: "8px 20px", fontWeight: 600, fontSize: "0.87rem",
                    cursor: loading || !smtpConfig.id ? "not-allowed" : "pointer",
                    opacity: loading || !smtpConfig.id ? 0.5 : 1,
                  }}>
                    Enviar prueba
                  </button>
                </div>
              </Form>
              <hr style={{ borderColor: "#e5e7eb", margin: "0 0 20px" }} />
              <div style={{
                background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10,
                padding: "14px 18px", fontSize: "0.84rem", color: "#1e40af",
              }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  <i className="bi bi-lightbulb-fill me-2" style={{ color: "#f59e0b" }}></i>
                  Instrucciones rápidas:
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                  <li><strong>Gmail:</strong> usa <code>smtp.gmail.com</code>, puerto 587, y una{" "}
                    <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noreferrer">contraseña de aplicación</a>
                  </li>
                  <li><strong>Outlook/Hotmail:</strong> <code>smtp-mail.outlook.com</code>, puerto 587</li>
                  <li><strong>Office 365:</strong> <code>smtp.office365.com</code>, puerto 587</li>
                </ul>
              </div>
            </div>
          )}

          {/* ─── TAB: SMS ─── */}
          {activeTab === "config-sms" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h5 style={{ fontWeight: 700, color: "#111827", fontSize: "1rem", margin: 0 }}>
                  <i className="bi bi-phone-fill me-2" style={{ color: "#8b5cf6" }}></i>
                  Configuración de SMS (Twilio)
                </h5>
              </div>
              <div style={{
                background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
                padding: "12px 16px", fontSize: "0.84rem", color: "#92400e", marginBottom: 20,
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <i className="bi bi-info-circle-fill" style={{ color: "#f59e0b", marginTop: 1 }}></i>
                <div>
                  <strong>Requiere cuenta de Twilio.</strong> Para enviar SMS, necesitas una cuenta en{" "}
                  <a href="https://www.twilio.com" target="_blank" rel="noreferrer" style={{ color: "#b45309" }}>Twilio</a>.
                  Obtén tus credenciales en el dashboard de Twilio.
                </div>
              </div>
              <Form onSubmit={(e) => { e.preventDefault(); guardarMensajeria("TWILIO_SMS", smsConfig); }}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Account SID</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxx"
                        value={smsConfig.account_sid}
                        onChange={(e) => setSmsConfig({ ...smsConfig, account_sid: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Auth Token</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="Tu token de autenticación"
                        value={smsConfig.auth_token}
                        onChange={(e) => setSmsConfig({ ...smsConfig, auth_token: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Número de Twilio (remitente)</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="+15551234567"
                        value={smsConfig.from_number}
                        onChange={(e) => setSmsConfig({ ...smsConfig, from_number: e.target.value })}
                      />
                      <Form.Text className="text-muted">Incluye el código de país (ej: +1, +51)</Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Check
                  type="checkbox"
                  label="Activar envío de SMS"
                  checked={smsConfig.activo === 1}
                  onChange={(e) => setSmsConfig({ ...smsConfig, activo: e.target.checked ? 1 : 0 })}
                  className="mb-3"
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" disabled={loading} style={{
                    background: "#2563eb", color: "#fff", border: "none",
                    borderRadius: 8, padding: "8px 20px", fontWeight: 600,
                    fontSize: "0.87rem", cursor: "pointer", opacity: loading ? 0.7 : 1,
                  }}>
                    {loading ? "Guardando..." : "Guardar configuración"}
                  </button>
                  <button type="button" onClick={() => probarMensajeria("TWILIO_SMS", smsConfig)} disabled={loading || !smsConfig.account_sid} style={{
                    background: "transparent", color: "#374151",
                    border: "1px solid #d1d5db", borderRadius: 8,
                    padding: "8px 20px", fontWeight: 600, fontSize: "0.87rem",
                    cursor: loading || !smsConfig.account_sid ? "not-allowed" : "pointer",
                    opacity: loading || !smsConfig.account_sid ? 0.5 : 1,
                  }}>
                    Enviar prueba
                  </button>
                </div>
              </Form>
            </div>
          )}

          {/* ─── TAB: WhatsApp ─── */}
          {activeTab === "config-whatsapp" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h5 style={{ fontWeight: 700, color: "#111827", fontSize: "1rem", margin: 0 }}>
                  <i className="bi bi-whatsapp me-2" style={{ color: "#22c55e" }}></i>
                  Configuración de WhatsApp (Twilio)
                </h5>
              </div>
              <div style={{
                background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
                padding: "12px 16px", fontSize: "0.84rem", color: "#92400e", marginBottom: 20,
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <i className="bi bi-info-circle-fill" style={{ color: "#f59e0b", marginTop: 1 }}></i>
                <div>
                  <strong>Requiere Twilio WhatsApp Business API.</strong> Necesitas habilitar WhatsApp en tu cuenta de Twilio. Consulta la{" "}
                  <a href="https://www.twilio.com/whatsapp" target="_blank" rel="noreferrer" style={{ color: "#b45309" }}>documentación de Twilio WhatsApp</a>.
                </div>
              </div>
              <Form onSubmit={(e) => { e.preventDefault(); guardarMensajeria("TWILIO_WHATSAPP", whatsappConfig); }}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Account SID</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxx"
                        value={whatsappConfig.account_sid}
                        onChange={(e) => setWhatsappConfig({ ...whatsappConfig, account_sid: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Auth Token</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="Tu token de autenticación"
                        value={whatsappConfig.auth_token}
                        onChange={(e) => setWhatsappConfig({ ...whatsappConfig, auth_token: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Número de WhatsApp (remitente)</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="+14155238886"
                        value={whatsappConfig.from_number}
                        onChange={(e) => setWhatsappConfig({ ...whatsappConfig, from_number: e.target.value })}
                      />
                      <Form.Text className="text-muted">Número de sandbox o producción de Twilio</Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Check
                  type="checkbox"
                  label="Activar envío de WhatsApp"
                  checked={whatsappConfig.activo === 1}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, activo: e.target.checked ? 1 : 0 })}
                  className="mb-3"
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" disabled={loading} style={{
                    background: "#2563eb", color: "#fff", border: "none",
                    borderRadius: 8, padding: "8px 20px", fontWeight: 600,
                    fontSize: "0.87rem", cursor: "pointer", opacity: loading ? 0.7 : 1,
                  }}>
                    {loading ? "Guardando..." : "Guardar configuración"}
                  </button>
                  <button type="button" onClick={() => probarMensajeria("TWILIO_WHATSAPP", whatsappConfig)} disabled={loading || !whatsappConfig.account_sid} style={{
                    background: "transparent", color: "#374151",
                    border: "1px solid #d1d5db", borderRadius: 8,
                    padding: "8px 20px", fontWeight: 600, fontSize: "0.87rem",
                    cursor: loading || !whatsappConfig.account_sid ? "not-allowed" : "pointer",
                    opacity: loading || !whatsappConfig.account_sid ? 0.5 : 1,
                  }}>
                    Enviar prueba
                  </button>
                </div>
              </Form>
            </div>
          )}

          {/* ─── TAB: Plantillas ─── */}
          {activeTab === "plantillas" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h5 style={{ fontWeight: 700, color: "#111827", fontSize: "1rem", margin: 0 }}>
                  <i className="bi bi-file-text-fill me-2" style={{ color: "#f59e0b" }}></i>
                  Plantillas de Recordatorio
                </h5>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={crearPlantillasPredeterminadas} style={{
                    background: "transparent", color: "#3b82f6", border: "1px solid #3b82f6",
                    borderRadius: 8, padding: "6px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                  }}>
                    Crear plantillas predeterminadas
                  </button>
                  <button onClick={() => { setPlantillaEdit(null); setShowModalPlantilla(true); }} style={{
                    background: "#2563eb", color: "#fff", border: "none",
                    borderRadius: 8, padding: "6px 14px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <i className="bi bi-plus-lg"></i> Nueva plantilla
                  </button>
                </div>
              </div>
              <div style={{
                background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8,
                padding: "10px 14px", marginBottom: 16, fontSize: "0.82rem", color: "#1e40af",
              }}>
                <strong>Variables disponibles:</strong>{" "}
                <code>{"{paciente}"}</code>, <code>{"{medico}"}</code>, <code>{"{fecha}"}</code>,{" "}
                <code>{"{hora}"}</code>, <code>{"{clinica}"}</code>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Tipo", "Nombre", "Horas antes", "Estado", "Acciones"].map(h => (
                        <th key={h} style={{
                          padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700,
                          color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                          borderBottom: "2px solid #e5e7eb", textAlign: "left",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plantillas.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af", fontSize: "0.87rem" }}>
                          <i className="bi bi-file-earmark-x" style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: 0.4 }}></i>
                          No hay plantillas. Crea plantillas predeterminadas para empezar.
                        </td>
                      </tr>
                    )}
                    {plantillas.map((p) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 14px", fontSize: "0.85rem" }}>
                          {p.tipo === "EMAIL" && <span style={{ color: "#3b82f6" }}><i className="bi bi-envelope-fill me-1"></i>Email</span>}
                          {p.tipo === "SMS" && <span style={{ color: "#8b5cf6" }}><i className="bi bi-phone-fill me-1"></i>SMS</span>}
                          {p.tipo === "WHATSAPP" && <span style={{ color: "#22c55e" }}><i className="bi bi-whatsapp me-1"></i>WhatsApp</span>}
                        </td>
                        <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: "0.87rem", color: "#111827" }}>
                          {p.nombre}{" "}
                          {p.es_predeterminada === 1 && (
                            <span style={{ background: "#f1f5f9", color: "#64748b", fontSize: "0.7rem", borderRadius: 4, padding: "2px 6px", fontWeight: 500 }}>Predeterminada</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: "0.85rem", color: "#374151" }}>{p.horas_antes}h</td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            background: p.activo === 1 ? "#dcfce7" : "#f1f5f9",
                            color: p.activo === 1 ? "#166534" : "#64748b",
                            borderRadius: 20, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 700,
                          }}>
                            {p.activo === 1 ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => { setPlantillaEdit(p); setShowModalPlantilla(true); }} style={{
                              background: "transparent", border: "1px solid #3b82f6", color: "#3b82f6",
                              borderRadius: 6, padding: "3px 10px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                            }}>Editar</button>
                            <button onClick={() => eliminarPlantilla(p.id)} style={{
                              background: "transparent", border: "1px solid #ef4444", color: "#ef4444",
                              borderRadius: 6, padding: "3px 10px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                            }}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB: Automático ─── */}
          {activeTab === "automatico" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h5 style={{ fontWeight: 700, color: "#111827", fontSize: "1rem", margin: 0 }}>
                  <i className="bi bi-gear-fill me-2" style={{ color: "#6366f1" }}></i>
                  Configuración de Envío Automático
                </h5>
              </div>
              <div style={{
                background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8,
                padding: "10px 14px", marginBottom: 20, fontSize: "0.84rem", color: "#1e40af",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <i className="bi bi-info-circle-fill"></i>
                Activa los recordatorios que deseas enviar automáticamente antes de cada cita.
              </div>
              <Form>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
                  {/* Email */}
                  <div style={{ flex: "1 1 200px", background: "#f8fafc", borderRadius: 10, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <i className="bi bi-envelope-fill" style={{ color: "#3b82f6" }}></i>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>Email</span>
                    </div>
                    <Form.Check type="checkbox" label="Activar recordatorios por email"
                      checked={configAutomatico.email_activo === 1}
                      onChange={(e) => setConfigAutomatico({ ...configAutomatico, email_activo: e.target.checked ? 1 : 0 })}
                      className="mb-2" />
                    {configAutomatico.email_activo === 1 && (
                      <div style={{ marginLeft: 12, marginTop: 8 }}>
                        <Form.Check type="checkbox" label="48 horas antes"
                          checked={configAutomatico.email_48h === 1}
                          onChange={(e) => setConfigAutomatico({ ...configAutomatico, email_48h: e.target.checked ? 1 : 0 })} />
                        <Form.Check type="checkbox" label="24 horas antes"
                          checked={configAutomatico.email_24h === 1}
                          onChange={(e) => setConfigAutomatico({ ...configAutomatico, email_24h: e.target.checked ? 1 : 0 })} />
                        <Form.Check type="checkbox" label="2 horas antes"
                          checked={configAutomatico.email_2h === 1}
                          onChange={(e) => setConfigAutomatico({ ...configAutomatico, email_2h: e.target.checked ? 1 : 0 })} />
                      </div>
                    )}
                  </div>
                  {/* SMS */}
                  <div style={{ flex: "1 1 200px", background: "#f8fafc", borderRadius: 10, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <i className="bi bi-phone-fill" style={{ color: "#8b5cf6" }}></i>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>SMS</span>
                    </div>
                    <Form.Check type="checkbox" label="Activar recordatorios por SMS"
                      checked={configAutomatico.sms_activo === 1}
                      onChange={(e) => setConfigAutomatico({ ...configAutomatico, sms_activo: e.target.checked ? 1 : 0 })}
                      className="mb-2" />
                    {configAutomatico.sms_activo === 1 && (
                      <div style={{ marginLeft: 12, marginTop: 8 }}>
                        <Form.Check type="checkbox" label="48 horas antes"
                          checked={configAutomatico.sms_48h === 1}
                          onChange={(e) => setConfigAutomatico({ ...configAutomatico, sms_48h: e.target.checked ? 1 : 0 })} />
                        <Form.Check type="checkbox" label="24 horas antes"
                          checked={configAutomatico.sms_24h === 1}
                          onChange={(e) => setConfigAutomatico({ ...configAutomatico, sms_24h: e.target.checked ? 1 : 0 })} />
                        <Form.Check type="checkbox" label="2 horas antes"
                          checked={configAutomatico.sms_2h === 1}
                          onChange={(e) => setConfigAutomatico({ ...configAutomatico, sms_2h: e.target.checked ? 1 : 0 })} />
                      </div>
                    )}
                  </div>
                  {/* WhatsApp */}
                  <div style={{ flex: "1 1 200px", background: "#f8fafc", borderRadius: 10, padding: "16px 20px", border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <i className="bi bi-whatsapp" style={{ color: "#22c55e" }}></i>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>WhatsApp</span>
                    </div>
                    <Form.Check type="checkbox" label="Activar recordatorios por WhatsApp"
                      checked={configAutomatico.whatsapp_activo === 1}
                      onChange={(e) => setConfigAutomatico({ ...configAutomatico, whatsapp_activo: e.target.checked ? 1 : 0 })}
                      className="mb-2" />
                    {configAutomatico.whatsapp_activo === 1 && (
                      <div style={{ marginLeft: 12, marginTop: 8 }}>
                        <Form.Check type="checkbox" label="48 horas antes"
                          checked={configAutomatico.whatsapp_48h === 1}
                          onChange={(e) => setConfigAutomatico({ ...configAutomatico, whatsapp_48h: e.target.checked ? 1 : 0 })} />
                        <Form.Check type="checkbox" label="24 horas antes"
                          checked={configAutomatico.whatsapp_24h === 1}
                          onChange={(e) => setConfigAutomatico({ ...configAutomatico, whatsapp_24h: e.target.checked ? 1 : 0 })} />
                        <Form.Check type="checkbox" label="2 horas antes"
                          checked={configAutomatico.whatsapp_2h === 1}
                          onChange={(e) => setConfigAutomatico({ ...configAutomatico, whatsapp_2h: e.target.checked ? 1 : 0 })} />
                      </div>
                    )}
                  </div>
                </div>
                <hr style={{ borderColor: "#e5e7eb" }} />
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Hora de ejecución diaria</Form.Label>
                      <Form.Control
                        type="time"
                        value={configAutomatico.hora_ejecucion_diaria}
                        onChange={(e) => setConfigAutomatico({ ...configAutomatico, hora_ejecucion_diaria: e.target.value })}
                      />
                      <Form.Text className="text-muted">
                        El sistema verifica recordatorios cada hora. Esta preferencia se guarda como referencia.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                <button type="button" onClick={guardarConfigAutomatico} disabled={loading} style={{
                  background: "#2563eb", color: "#fff", border: "none",
                  borderRadius: 8, padding: "8px 20px", fontWeight: 600,
                  fontSize: "0.87rem", cursor: "pointer", opacity: loading ? 0.7 : 1,
                }}>
                  {loading ? "Guardando..." : "Guardar configuración"}
                </button>
              </Form>
            </div>
          )}

          {/* ─── TAB: Historial ─── */}
          {activeTab === "historial" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h5 style={{ fontWeight: 700, color: "#111827", fontSize: "1rem", margin: 0 }}>
                  <i className="bi bi-bar-chart-fill me-2" style={{ color: "#0ea5e9" }}></i>
                  Historial de Recordatorios (últimos 50)
                </h5>
              </div>
              <div style={{ maxHeight: 450, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                      {["Fecha", "Paciente", "Tipo", "Destinatario", "Estado", "Cita"].map(h => (
                        <th key={h} style={{
                          padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700,
                          color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                          borderBottom: "2px solid #e5e7eb", textAlign: "left", whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historial.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af", fontSize: "0.87rem" }}>
                          <i className="bi bi-clock-history" style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: 0.4 }}></i>
                          No hay historial de recordatorios
                        </td>
                      </tr>
                    )}
                    {historial.map((h, idx) => (
                      <tr key={h.id} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "10px 14px", fontSize: "0.78rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {new Date(h.creado_en).toLocaleString()}
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: "0.85rem", color: "#111827" }}>
                          {h.paciente_nombres} {h.paciente_apellidos}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "0.82rem" }}>
                          {h.tipo === "EMAIL" && <span style={{ color: "#3b82f6" }}><i className="bi bi-envelope-fill me-1"></i>Email</span>}
                          {h.tipo === "SMS" && <span style={{ color: "#8b5cf6" }}><i className="bi bi-phone-fill me-1"></i>SMS</span>}
                          {h.tipo === "WHATSAPP" && <span style={{ color: "#22c55e" }}><i className="bi bi-whatsapp me-1"></i>WhatsApp</span>}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "0.78rem", color: "#374151" }}>{h.destinatario}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{
                            background: h.estado === "ENVIADO" ? "#dcfce7" : h.estado === "FALLIDO" ? "#fee2e2" : "#fef9c3",
                            color: h.estado === "ENVIADO" ? "#166534" : h.estado === "FALLIDO" ? "#991b1b" : "#854d0e",
                            borderRadius: 20, padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap",
                          }}>
                            {h.estado}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "0.78rem", color: "#6b7280" }}>
                          {h.cita_fecha ? new Date(h.cita_fecha).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      <ModalPlantilla
        show={showModalPlantilla}
        onHide={() => {
          setShowModalPlantilla(false);
          setPlantillaEdit(null);
        }}
        plantilla={plantillaEdit}
        onSave={guardarPlantilla}
      />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// MODAL PLANTILLA
// ═════════════════════════════════════════════════════════════

const ModalPlantilla = ({ show, onHide, plantilla, onSave }) => {
  const [form, setForm] = useState({
    tipo: "EMAIL",
    nombre: "",
    horas_antes: 24,
    asunto: "",
    contenido: "",
    activo: 1,
    es_predeterminada: 0,
  });

  useEffect(() => {
    if (plantilla) {
      setForm(plantilla);
    } else {
      setForm({
        tipo: "EMAIL",
        nombre: "",
        horas_antes: 24,
        asunto: "",
        contenido: "",
        activo: 1,
        es_predeterminada: 0,
      });
    }
  }, [plantilla, show]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{plantilla ? "Editar Plantilla" : "Nueva Plantilla"}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Tipo de recordatorio</Form.Label>
                <Form.Select
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  disabled={!!plantilla}
                >
                  <option value="EMAIL">📧 Email</option>
                  <option value="SMS">📱 SMS</option>
                  <option value="WHATSAPP">💬 WhatsApp</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Horas antes de la cita</Form.Label>
                <Form.Select
                  value={form.horas_antes}
                  onChange={(e) => setForm({ ...form, horas_antes: parseInt(e.target.value) })}
                >
                  <option value={2}>2 horas antes</option>
                  <option value={24}>24 horas antes (1 día)</option>
                  <option value={48}>48 horas antes (2 días)</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Nombre de la plantilla</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ej: Recordatorio 24h Email"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </Form.Group>

          {form.tipo === "EMAIL" && (
            <Form.Group className="mb-3">
              <Form.Label>Asunto del email</Form.Label>
              <Form.Control
                type="text"
                placeholder="Recordatorio: Cita médica - {clinica}"
                value={form.asunto}
                onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                required
              />
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Contenido del mensaje</Form.Label>
            <Form.Control
              as="textarea"
              rows={8}
              placeholder={
                form.tipo === "EMAIL"
                  ? "<p>Hola {paciente},</p><p>Tu cita es el {fecha} a las {hora} con Dr/a {medico}.</p>"
                  : "Hola {paciente}, recordatorio de cita el {fecha} a las {hora} con {medico}."
              }
              value={form.contenido}
              onChange={(e) => setForm({ ...form, contenido: e.target.value })}
              required
            />
            <Form.Text className="text-muted">
              Variables: <code>{"{paciente}"}</code>, <code>{"{medico}"}</code>, <code>{"{fecha}"}</code>,{" "}
              <code>{"{hora}"}</code>, <code>{"{clinica}"}</code>
            </Form.Text>
          </Form.Group>

          <Form.Check
            type="checkbox"
            label="Plantilla activa"
            checked={form.activo === 1}
            onChange={(e) => setForm({ ...form, activo: e.target.checked ? 1 : 0 })}
            className="mb-2"
          />

          <Form.Check
            type="checkbox"
            label="Marcar como predeterminada"
            checked={form.es_predeterminada === 1}
            onChange={(e) => setForm({ ...form, es_predeterminada: e.target.checked ? 1 : 0 })}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit">
            Guardar
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default Recordatorios;
