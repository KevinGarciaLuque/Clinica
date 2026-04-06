import { useState, useEffect } from "react";
import { Container, Row, Col, Card, Tab, Tabs, Button, Form, Alert, Badge, Table, Modal } from "react-bootstrap";
import api from "../api/api";

const Recordatorios = () => {
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
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <h3>
            <i className="bi bi-bell-fill me-2" style={{ color: "#2196f3" }}></i>
            Recordatorios
          </h3>
          <p className="text-muted">Configura recordatorios automáticos por Email, WhatsApp y SMS</p>
        </Col>
      </Row>

      {mensaje.texto && (
        <Alert variant={mensaje.tipo} onClose={() => setMensaje({ tipo: "", texto: "" })} dismissible>
          {mensaje.texto}
        </Alert>
      )}

      {/* ═══ ESTADÍSTICAS ═══ */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <h4>{estadisticas.total || 0}</h4>
              <small className="text-muted">Total enviados (30 días)</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-success">
            <Card.Body>
              <h4 className="text-success">{estadisticas.enviados || 0}</h4>
              <small className="text-muted">Exitosos</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-danger">
            <Card.Body>
              <h4 className="text-danger">{estadisticas.fallidos || 0}</h4>
              <small className="text-muted">Fallidos</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-info">
            <Card.Body>
              <div className="small">
                <div>📧 Emails: {estadisticas.emails || 0}</div>
                <div>📱 SMS: {estadisticas.sms || 0}</div>
                <div>💬 WhatsApp: {estadisticas.whatsapp || 0}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ═══ TABS ═══ */}
      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
        {/* ─── TAB: Email/SMTP ─── */}
        <Tab eventKey="config-email" title="📧 Email / SMTP">
          <Card>
            <Card.Body>
              <h5 className="mb-3">Configuración de Email (SMTP)</h5>
              <Form onSubmit={guardarSMTP}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
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
                      <Form.Label>Puerto</Form.Label>
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
                      <Form.Label>Tipo de conexión</Form.Label>
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
                      <Form.Label>
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
                      <Form.Label>
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
                      <Form.Label>
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
                      <Form.Label>Nombre del remitente</Form.Label>
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

                <div className="d-flex gap-2">
                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? "Guardando..." : "Guardar configuración"}
                  </Button>
                  <Button variant="outline-secondary" onClick={probarSMTP} disabled={loading || !smtpConfig.id}>
                    Enviar prueba
                  </Button>
                </div>
              </Form>

              <hr className="my-4" />

              <Alert variant="info">
                <strong>💡 Instrucciones rápidas:</strong>
                <ul className="mb-0 mt-2">
                  <li>
                    <strong>Gmail:</strong> usa <code>smtp.gmail.com</code>, puerto 587, y una{" "}
                    <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noreferrer">
                      contraseña de aplicación
                    </a>
                  </li>
                  <li>
                    <strong>Outlook/Hotmail:</strong> <code>smtp-mail.outlook.com</code>, puerto 587
                  </li>
                  <li>
                    <strong>Office 365:</strong> <code>smtp.office365.com</code>, puerto 587
                  </li>
                </ul>
              </Alert>
            </Card.Body>
          </Card>
        </Tab>

        {/* ─── TAB: SMS ─── */}
        <Tab eventKey="config-sms" title="📱 SMS">
          <Card>
            <Card.Body>
              <h5 className="mb-3">Configuración de SMS (Twilio)</h5>

              <Alert variant="warning">
                <strong>ℹ️ Requiere cuenta de Twilio</strong>
                <p className="mb-0">
                  Para enviar SMS, necesitas una cuenta en{" "}
                  <a href="https://www.twilio.com" target="_blank" rel="noreferrer">
                    Twilio
                  </a>
                  . Obtén tus credenciales en el dashboard de Twilio.
                </p>
              </Alert>

              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  guardarMensajeria("TWILIO_SMS", smsConfig);
                }}
              >
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Account SID</Form.Label>
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
                      <Form.Label>Auth Token</Form.Label>
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
                      <Form.Label>Número de Twilio (remitente)</Form.Label>
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

                <div className="d-flex gap-2">
                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? "Guardando..." : "Guardar configuración"}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={() => probarMensajeria("TWILIO_SMS", smsConfig)}
                    disabled={loading || !smsConfig.account_sid}
                  >
                    Enviar prueba
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Tab>

        {/* ─── TAB: WhatsApp ─── */}
        <Tab eventKey="config-whatsapp" title="💬 WhatsApp">
          <Card>
            <Card.Body>
              <h5 className="mb-3">Configuración de WhatsApp (Twilio)</h5>

              <Alert variant="warning">
                <strong>ℹ️ Requiere Twilio WhatsApp Business API</strong>
                <p className="mb-0">
                  Necesitas habilitar WhatsApp en tu cuenta de Twilio. Consulta la{" "}
                  <a href="https://www.twilio.com/whatsapp" target="_blank" rel="noreferrer">
                    documentación de Twilio WhatsApp
                  </a>
                  .
                </p>
              </Alert>

              <Form
                onSubmit={(e) => {
                  e.preventDefault();
                  guardarMensajeria("TWILIO_WHATSAPP", whatsappConfig);
                }}
              >
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Account SID</Form.Label>
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
                      <Form.Label>Auth Token</Form.Label>
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
                      <Form.Label>Número de WhatsApp (remitente)</Form.Label>
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

                <div className="d-flex gap-2">
                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? "Guardando..." : "Guardar configuración"}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={() => probarMensajeria("TWILIO_WHATSAPP", whatsappConfig)}
                    disabled={loading || !whatsappConfig.account_sid}
                  >
                    Enviar prueba
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Tab>

        {/* ─── TAB: Plantillas ─── */}
        <Tab eventKey="plantillas" title="📝 Plantillas">
          <Card>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Plantillas de Recordatorio</h5>
                <div className="d-flex gap-2">
                  <Button variant="outline-primary" size="sm" onClick={crearPlantillasPredeterminadas}>
                    Crear plantillas predeterminadas
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setShowModalPlantilla(true)}>
                    <i className="bi bi-plus-lg me-1"></i>
                    Nueva plantilla
                  </Button>
                </div>
              </div>

              <Alert variant="info">
                <strong>Variables disponibles:</strong>
                <code>{"{paciente}"}</code>, <code>{"{medico}"}</code>, <code>{"{fecha}"}</code>,{" "}
                <code>{"{hora}"}</code>, <code>{"{clinica}"}</code>
              </Alert>

              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Nombre</th>
                    <th>Horas antes</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {plantillas.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        No hay plantillas. Crea plantillas predeterminadas para empezar.
                      </td>
                    </tr>
                  )}
                  {plantillas.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.tipo === "EMAIL" && "📧 Email"}
                        {p.tipo === "SMS" && "📱 SMS"}
                        {p.tipo === "WHATSAPP" && "💬 WhatsApp"}
                      </td>
                      <td>
                        {p.nombre} {p.es_predeterminada === 1 && <Badge bg="secondary">Predeterminada</Badge>}
                      </td>
                      <td>{p.horas_antes}h</td>
                      <td>
                        <Badge bg={p.activo === 1 ? "success" : "secondary"}>
                          {p.activo === 1 ? "Activa" : "Inactiva"}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => {
                            setPlantillaEdit(p);
                            setShowModalPlantilla(true);
                          }}
                        >
                          Editar
                        </Button>
                        {" "}
                        <Button variant="outline-danger" size="sm" onClick={() => eliminarPlantilla(p.id)}>
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        {/* ─── TAB: Config Automática ─── */}
        <Tab eventKey="automatico" title="⚙️ Automático">
          <Card>
            <Card.Body>
              <h5 className="mb-3">Configuración de Envío Automático</h5>

              <Alert variant="info">
                Activa los recordatorios que deseas enviar automáticamente antes de cada cita. El sistema verifica las
                citas programadas y envía los recordatorios en los horarios configurados.
              </Alert>

              <Form>
                <Row>
                  <Col md={4}>
                    <h6>📧 Email</h6>
                    <Form.Check
                      type="checkbox"
                      label="Activar recordatorios por email"
                      checked={configAutomatico.email_activo === 1}
                      onChange={(e) =>
                        setConfigAutomatico({ ...configAutomatico, email_activo: e.target.checked ? 1 : 0 })
                      }
                      className="mb-2"
                    />
                    {configAutomatico.email_activo === 1 && (
                      <div className="ms-3">
                        <Form.Check
                          type="checkbox"
                          label="48 horas antes"
                          checked={configAutomatico.email_48h === 1}
                          onChange={(e) =>
                            setConfigAutomatico({ ...configAutomatico, email_48h: e.target.checked ? 1 : 0 })
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          label="24 horas antes"
                          checked={configAutomatico.email_24h === 1}
                          onChange={(e) =>
                            setConfigAutomatico({ ...configAutomatico, email_24h: e.target.checked ? 1 : 0 })
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          label="2 horas antes"
                          checked={configAutomatico.email_2h === 1}
                          onChange={(e) =>
                            setConfigAutomatico({ ...configAutomatico, email_2h: e.target.checked ? 1 : 0 })
                          }
                        />
                      </div>
                    )}
                  </Col>

                  <Col md={4}>
                    <h6>📱 SMS</h6>
                    <Form.Check
                      type="checkbox"
                      label="Activar recordatorios por SMS"
                      checked={configAutomatico.sms_activo === 1}
                      onChange={(e) =>
                        setConfigAutomatico({ ...configAutomatico, sms_activo: e.target.checked ? 1 : 0 })
                      }
                      className="mb-2"
                    />
                    {configAutomatico.sms_activo === 1 && (
                      <div className="ms-3">
                        <Form.Check
                          type="checkbox"
                          label="48 horas antes"
                          checked={configAutomatico.sms_48h === 1}
                          onChange={(e) =>
                            setConfigAutomatico({ ...configAutomatico, sms_48h: e.target.checked ? 1 : 0 })
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          label="24 horas antes"
                          checked={configAutomatico.sms_24h === 1}
                          onChange={(e) =>
                            setConfigAutomatico({ ...configAutomatico, sms_24h: e.target.checked ? 1 : 0 })
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          label="2 horas antes"
                          checked={configAutomatico.sms_2h === 1}
                          onChange={(e) =>
                            setConfigAutomatico({ ...configAutomatico, sms_2h: e.target.checked ? 1 : 0 })
                          }
                        />
                      </div>
                    )}
                  </Col>

                  <Col md={4}>
                    <h6>💬 WhatsApp</h6>
                    <Form.Check
                      type="checkbox"
                      label="Activar recordatorios por WhatsApp"
                      checked={configAutomatico.whatsapp_activo === 1}
                      onChange={(e) =>
                        setConfigAutomatico({ ...configAutomatico, whatsapp_activo: e.target.checked ? 1 : 0 })
                      }
                      className="mb-2"
                    />
                    {configAutomatico.whatsapp_activo === 1 && (
                      <div className="ms-3">
                        <Form.Check
                          type="checkbox"
                          label="48 horas antes"
                          checked={configAutomatico.whatsapp_48h === 1}
                          onChange={(e) =>
                            setConfigAutomatico({ ...configAutomatico, whatsapp_48h: e.target.checked ? 1 : 0 })
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          label="24 horas antes"
                          checked={configAutomatico.whatsapp_24h === 1}
                          onChange={(e) =>
                            setConfigAutomatico({ ...configAutomatico, whatsapp_24h: e.target.checked ? 1 : 0 })
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          label="2 horas antes"
                          checked={configAutomatico.whatsapp_2h === 1}
                          onChange={(e) =>
                            setConfigAutomatico({ ...configAutomatico, whatsapp_2h: e.target.checked ? 1 : 0 })
                          }
                        />
                      </div>
                    )}
                  </Col>
                </Row>

                <hr className="my-4" />

                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Hora de ejecución diaria</Form.Label>
                      <Form.Control
                        type="time"
                        value={configAutomatico.hora_ejecucion_diaria}
                        onChange={(e) =>
                          setConfigAutomatico({ ...configAutomatico, hora_ejecucion_diaria: e.target.value })
                        }
                      />
                      <Form.Text className="text-muted">
                        El sistema verifica recordatorios cada hora. Esta preferencia se guarda como referencia.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <Button variant="primary" onClick={guardarConfigAutomatico} disabled={loading}>
                  {loading ? "Guardando..." : "Guardar configuración"}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Tab>

        {/* ─── TAB: Historial ─── */}
        <Tab eventKey="historial" title="📊 Historial">
          <Card>
            <Card.Body>
              <h5 className="mb-3">Historial de Recordatorios (últimos 50)</h5>

              <div style={{ maxHeight: "450px", overflowY: "auto" }}>
              <Table responsive hover size="sm" className="mb-0">
                <thead className="sticky-top table-light">
                  <tr>
                    <th>Fecha</th>
                    <th>Paciente</th>
                    <th>Tipo</th>
                    <th>Destinatario</th>
                    <th>Estado</th>
                    <th>Cita</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        No hay historial de recordatorios
                      </td>
                    </tr>
                  )}
                  {historial.map((h) => (
                    <tr key={h.id}>
                      <td className="small">{new Date(h.creado_en).toLocaleString()}</td>
                      <td>
                        {h.paciente_nombres} {h.paciente_apellidos}
                      </td>
                      <td>
                        {h.tipo === "EMAIL" && "📧"}
                        {h.tipo === "SMS" && "📱"}
                        {h.tipo === "WHATSAPP" && "💬"} {h.tipo}
                      </td>
                      <td className="small">{h.destinatario}</td>
                      <td>
                        <Badge bg={h.estado === "ENVIADO" ? "success" : h.estado === "FALLIDO" ? "danger" : "warning"}>
                          {h.estado}
                        </Badge>
                      </td>
                      <td className="small">{h.cita_fecha ? new Date(h.cita_fecha).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              </div>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
      <ModalPlantilla
        show={showModalPlantilla}
        onHide={() => {
          setShowModalPlantilla(false);
          setPlantillaEdit(null);
        }}
        plantilla={plantillaEdit}
        onSave={guardarPlantilla}
      />
    </Container>
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
