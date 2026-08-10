import { useEffect, useState, useRef, useCallback } from "react";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const ROLES_GOOGLE_CALENDAR = ["MEDICO", "PSICOLOGO", "ADMIN", "SUPER_ADMIN"];

export default function PerfilUsuario() {
  const { user, updateUser } = useAuth();
  const [googleStatus, setGoogleStatus] = useState({ conectado: false, google_email: null });
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [form, setForm] = useState({
    nombres: "", apellidos: "", telefono: "", foto_url: "",
    numero_colegiatura: "",
  });
  const [pwForm, setPwForm]       = useState({ password_actual: "", password_nuevo: "", confirmar: "" });
  const [tab, setTab]             = useState("info");
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto]   = useState(false);
  const [subiendoFirma, setSubiendoFirma] = useState(false);
  const [firmaUrl, setFirmaUrl]   = useState("");
  const [firmaMode, setFirmaMode] = useState("upload");
  const [dibujando, setDibujando] = useState(false);
  const [msg, setMsg]             = useState({ tipo: "", texto: "" });
  const [previsualizacion, setPrevisualizacion] = useState("");
  const [isMobile, setIsMobile]   = useState(window.innerWidth < 640);

  const inputFileRef = useRef(null);
  const firmaFileRef = useRef(null);
  const canvasRef    = useRef(null);
  const lastPos      = useRef(null);
  const inicializado = useRef(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (user && !inicializado.current) {
      inicializado.current = true;
      setForm({
        nombres:            user.nombres            || "",
        apellidos:          user.apellidos          || "",
        telefono:           user.telefono           || "",
        foto_url:           user.foto_url           || "",
        numero_colegiatura: user.numero_colegiatura || "",
      });
      setPrevisualizacion(user.foto_url || "");
      setFirmaUrl(user.firma_url || "");
    }
  }, [user]);

  const puedeUsarGoogleCalendar = ROLES_GOOGLE_CALENDAR.includes(user?.tipo);

  const cargarGoogleStatus = useCallback(async () => {
    try {
      const res = await api.get("/google/status");
      setGoogleStatus(res.data);
    } catch { /* ignorar */ }
  }, []);

  useEffect(() => {
    if (!puedeUsarGoogleCalendar) return;
    cargarGoogleStatus();

    const params = new URLSearchParams(window.location.search);
    const resultado = params.get("google");
    if (resultado === "ok") {
      showMsg("success", "Tu cuenta de Google fue conectada correctamente");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (resultado === "error") {
      showMsg("danger", "No se pudo conectar tu cuenta de Google. Intenta de nuevo.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeUsarGoogleCalendar]);

  const conectarGoogle = () => {
    const token = localStorage.getItem("token");
    window.location.href = `${API_URL}/api/google/connect?auth_token=${token}`;
  };

  const desconectarGoogle = async () => {
    setCargandoGoogle(true);
    try {
      await api.delete("/google/disconnect");
      setGoogleStatus({ conectado: false, google_email: null });
      showMsg("success", "Tu cuenta de Google fue desconectada");
    } catch (err) {
      showMsg("danger", err.response?.data?.msg || "Error al desconectar Google Calendar");
    } finally {
      setCargandoGoogle(false);
    }
  };

  const initials = `${user?.nombres?.[0] ?? ""}${user?.apellidos?.[0] ?? ""}`;

  const showMsg = (tipo, texto) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg({ tipo: "", texto: "" }), 4000);
  };

  const guardarInfo = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.put("/auth/me", {
        nombres:            form.nombres,
        apellidos:          form.apellidos,
        telefono:           form.telefono,
        foto_url:           form.foto_url,
        numero_colegiatura: form.numero_colegiatura || null,
      });
      updateUser({
        nombres:            form.nombres,
        apellidos:          form.apellidos,
        telefono:           form.telefono,
        foto_url:           form.foto_url,
        numero_colegiatura: form.numero_colegiatura || null,
      });
      showMsg("success", "Perfil actualizado correctamente");
    } catch (err) {
      showMsg("danger", err.response?.data?.msg || err.message);
    } finally {
      setGuardando(false);
    }
  };

  const guardarPassword = async (e) => {
    e.preventDefault();
    if (pwForm.password_nuevo !== pwForm.confirmar)
      return showMsg("danger", "Las contraseñas nuevas no coinciden");
    if (pwForm.password_nuevo.length < 6)
      return showMsg("danger", "La contraseña debe tener al menos 6 caracteres");
    setGuardando(true);
    try {
      await api.put("/auth/me", {
        password_actual: pwForm.password_actual,
        password_nuevo:  pwForm.password_nuevo,
      });
      setPwForm({ password_actual: "", password_nuevo: "", confirmar: "" });
      showMsg("success", "Contraseña cambiada correctamente");
    } catch (err) {
      showMsg("danger", err.response?.data?.msg || err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleFotoUrl = (url) => {
    setForm(f => ({ ...f, foto_url: url }));
    setPrevisualizacion(url);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrevisualizacion(URL.createObjectURL(file));
    setSubiendoFoto(true);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const res = await api.post("/auth/me/foto", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const fotoUrl = res.data.foto_url;
      setForm(f => ({ ...f, foto_url: fotoUrl }));
      setPrevisualizacion(fotoUrl);
      updateUser({ foto_url: fotoUrl });
      showMsg("success", "Foto actualizada correctamente");
    } catch (err) {
      setPrevisualizacion(user?.foto_url || "");
      showMsg("danger", err.response?.data?.msg || "Error al subir la foto");
    } finally {
      setSubiendoFoto(false);
      e.target.value = "";
    }
  };

  // ── Canvas de firma ───────────────────────────────────────────────────────
  const getCanvasPos = (canvas, e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  };

  const iniciarDibujo = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    lastPos.current = getCanvasPos(canvas, e);
    setDibujando(true);
  }, []);

  const dibujar = useCallback((e) => {
    if (!dibujando) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pos = getCanvasPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a2744";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  }, [dibujando]);

  const terminarDibujo = useCallback(() => setDibujando(false), []);

  const limpiarCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const guardarFirmaCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setSubiendoFirma(true);
      try {
        const fd = new FormData();
        fd.append("firma", blob, "firma.png");
        const res = await api.post("/auth/me/firma", fd, { headers: { "Content-Type": "multipart/form-data" } });
        setFirmaUrl(res.data.firma_url);
        updateUser({ firma_url: res.data.firma_url });
        showMsg("success", "Firma guardada correctamente");
        setFirmaMode("upload");
      } catch (err) {
        showMsg("danger", err.response?.data?.msg || "Error al guardar la firma");
      } finally {
        setSubiendoFirma(false);
      }
    }, "image/png");
  }, [updateUser]);

  const handleFirmaFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoFirma(true);
    try {
      const fd = new FormData();
      fd.append("firma", file);
      const res = await api.post("/auth/me/firma", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setFirmaUrl(res.data.firma_url);
      updateUser({ firma_url: res.data.firma_url });
      showMsg("success", "Firma cargada correctamente");
    } catch (err) {
      showMsg("danger", err.response?.data?.msg || "Error al subir la firma");
    } finally {
      setSubiendoFirma(false);
      e.target.value = "";
    }
  };

  const eliminarFirma = async () => {
    try {
      await api.put("/auth/me", { firma_url: "" });
      setFirmaUrl("");
      updateUser({ firma_url: "" });
      showMsg("success", "Firma eliminada");
    } catch { /* ignorar */ }
  };

  const TABS = [
    { k: "info",     label: "Información personal", icon: "bi-person-fill" },
    { k: "firma",    label: "Firma Digital",         icon: "bi-pen-fill" },
    { k: "password", label: "Contraseña",            icon: "bi-shield-lock-fill" },
    ...(puedeUsarGoogleCalendar
      ? [{ k: "google", label: "Google Calendar", icon: "bi-calendar-event-fill" }]
      : []),
  ];

  // ── estilos reutilizables ──────────────────────────────────────────────────
  const cardSt = {
    background: "#fff", borderRadius: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,.06)",
  };
  const labelSt = { fontSize: "0.83rem", color: "#374151", fontWeight: 600, display: "block", marginBottom: 4 };
  const inputSt = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1px solid #d1d5db", fontSize: "0.9rem",
    outline: "none", color: "#1e293b", background: "#fff",
  };

  return (
    <div style={{ margin: "-1.5rem", width: "calc(100% + 3rem)", background: "#f0f2f5", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: isMobile ? "16px 16px 0" : "24px 32px 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isMobile ? 14 : 20 }}>
          <div style={{
            width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: 12, flexShrink: 0,
            background: "rgba(255,255,255,.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-person-badge-fill" style={{ color: "#fff", fontSize: isMobile ? "1rem" : "1.3rem" }} />
          </div>
          <div>
            <h4 style={{ color: "#fff", margin: 0, fontWeight: 700, fontSize: isMobile ? "1rem" : "1.2rem" }}>
              Mi Perfil
            </h4>
            {!isMobile && (
              <div style={{ color: "rgba(255,255,255,.55)", fontSize: "0.78rem", marginTop: 2 }}>
                Actualiza tu información personal y contraseña
              </div>
            )}
          </div>
        </div>

        {/* Tabs — scrollables en móvil */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              padding: isMobile ? "7px 12px" : "8px 18px",
              border: "none", cursor: "pointer",
              fontSize: isMobile ? "0.75rem" : "0.83rem",
              fontWeight: tab === t.k ? 700 : 500,
              borderRadius: "8px 8px 0 0",
              background: tab === t.k ? "#fff" : "rgba(255,255,255,.1)",
              color: tab === t.k ? "#1a2744" : "rgba(255,255,255,.75)",
              display: "flex", alignItems: "center", gap: isMobile ? 5 : 7,
              transition: "background .15s, color .15s",
              whiteSpace: "nowrap", flexShrink: 0,
            }}>
              <i className={`bi ${t.icon}`} style={{ fontSize: isMobile ? "0.75rem" : "0.85rem" }} />
              {isMobile ? (t.k === "info" ? "Perfil" : t.k === "firma" ? "Firma" : t.k === "google" ? "Google" : "Clave") : t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{ padding: isMobile ? "14px 12px" : "24px" }}>

        {/* Alerta */}
        {msg.texto && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 14, fontSize: "0.85rem",
            background: msg.tipo === "success" ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)",
            border: `1px solid ${msg.tipo === "success" ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)"}`,
            color: msg.tipo === "success" ? "#065f46" : "#991b1b",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <i className={`bi ${msg.tipo === "success" ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />
            {msg.texto}
          </div>
        )}

        {/* ════════════════════════ TAB: INFO ════════════════════════ */}
        {tab === "info" && (
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 14 : 20,
            alignItems: "flex-start",
          }}>

            {/* Tarjeta avatar */}
            <div style={{
              ...cardSt,
              padding: isMobile ? "16px" : "24px",
              width: isMobile ? "100%" : 220,
              display: "flex", flexDirection: isMobile ? "row" : "column",
              alignItems: "center", gap: isMobile ? 14 : 14,
            }}>
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                  width: isMobile ? 80 : 100, height: isMobile ? 80 : 100,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", border: "3px solid #e2e8f0",
                  boxShadow: "0 4px 16px rgba(0,0,0,.12)",
                }}>
                  {subiendoFoto && (
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: "50%",
                      background: "rgba(0,0,0,.5)", display: "flex",
                      alignItems: "center", justifyContent: "center", zIndex: 2,
                    }}>
                      <div className="spinner-border spinner-border-sm text-white" />
                    </div>
                  )}
                  {previsualizacion
                    ? <img src={previsualizacion} alt="Avatar"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={() => setPrevisualizacion("")} />
                    : <span style={{ color: "#fff", fontWeight: 700, fontSize: isMobile ? "1.5rem" : "2rem" }}>{initials}</span>
                  }
                </div>
              </div>

              {/* Nombre + botones */}
              <div style={{ flex: 1, width: isMobile ? "auto" : "100%" }}>
                {!isMobile && (
                  <>
                    <div style={{ textAlign: "center", marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.93rem", color: "#1e293b" }}>
                        {form.nombres || user?.nombres} {form.apellidos || user?.apellidos}
                      </div>
                      <span style={{
                        display: "inline-block", marginTop: 4,
                        background: "#eff6ff", color: "#1d4ed8",
                        fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.07em",
                        textTransform: "uppercase", padding: "2px 8px", borderRadius: 5,
                      }}>
                        {user?.tipo}
                      </span>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4 }}>{user?.email}</div>
                    </div>
                  </>
                )}
                {isMobile && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>
                      {form.nombres || user?.nombres} {form.apellidos || user?.apellidos}
                    </div>
                    <span style={{
                      display: "inline-block", marginTop: 3,
                      background: "#eff6ff", color: "#1d4ed8",
                      fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.07em",
                      textTransform: "uppercase", padding: "2px 7px", borderRadius: 5,
                    }}>
                      {user?.tipo}
                    </span>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 3 }}>{user?.email}</div>
                  </div>
                )}

                {/* Botones de foto */}
                <input ref={inputFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 7, marginTop: isMobile ? 10 : 0, flexWrap: "wrap" }}>
                  <button type="button" disabled={subiendoFoto}
                    onClick={() => { if (inputFileRef.current) { inputFileRef.current.removeAttribute("capture"); inputFileRef.current.click(); } }}
                    style={{ flex: isMobile ? 1 : undefined, padding: "7px 0", borderRadius: 8, cursor: "pointer", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: "0.77rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <i className="bi bi-image" /> {isMobile ? "Galería" : "Galería / Archivo"}
                  </button>
                  <button type="button" disabled={subiendoFoto}
                    onClick={() => { if (inputFileRef.current) { inputFileRef.current.setAttribute("capture", "user"); inputFileRef.current.click(); } }}
                    style={{ flex: isMobile ? 1 : undefined, padding: "7px 0", borderRadius: 8, cursor: "pointer", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", fontSize: "0.77rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <i className="bi bi-camera-fill" /> Foto
                  </button>
                  {previsualizacion && (
                    <button type="button" disabled={subiendoFoto}
                      onClick={async () => { handleFotoUrl(""); try { await api.put("/auth/me", { foto_url: "" }); updateUser({ foto_url: "" }); showMsg("success", "Foto eliminada"); } catch { } }}
                      style={{ flex: isMobile ? "0 0 100%" : undefined, padding: "6px 0", borderRadius: 8, cursor: "pointer", background: "transparent", border: "1px solid #fecaca", color: "#dc2626", fontSize: "0.72rem", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      <i className="bi bi-trash3" /> Quitar foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Formulario */}
            <div style={{ ...cardSt, padding: isMobile ? "16px" : "24px", flex: 1, minWidth: 0 }}>
              <form onSubmit={guardarInfo}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 16 }}>
                  <div>
                    <label style={labelSt}>Nombres *</label>
                    <input style={inputSt} value={form.nombres} required
                      onChange={e => setForm(f => ({ ...f, nombres: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelSt}>Apellidos *</label>
                    <input style={inputSt} value={form.apellidos} required
                      onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelSt}>Teléfono</label>
                    <input style={inputSt} value={form.telefono}
                      onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelSt}>Email</label>
                    <input style={{ ...inputSt, background: "#f8fafc", color: "#94a3b8" }}
                      value={user?.email || ""} disabled />
                  </div>
                  <div style={{ gridColumn: isMobile ? undefined : "1 / -1" }}>
                    <label style={labelSt}>Número de colegiatura</label>
                    <input style={inputSt} value={form.numero_colegiatura}
                      placeholder="Ej: CMH-12345"
                      onChange={e => setForm(f => ({ ...f, numero_colegiatura: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: isMobile ? undefined : "1 / -1" }}>
                    <button type="submit" disabled={guardando}
                      style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a2744,#243b72)", color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, opacity: guardando ? .7 : 1 }}>
                      <i className="bi bi-check-lg" />
                      {guardando ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ════════════════════════ TAB: FIRMA ════════════════════════ */}
        {tab === "firma" && (
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 14 : 20,
            alignItems: "flex-start",
          }}>

            {/* Panel izquierdo: estado */}
            <div style={{
              ...cardSt, padding: isMobile ? "16px" : "24px",
              width: isMobile ? "100%" : 220,
              display: "flex", flexDirection: isMobile ? "row" : "column",
              alignItems: "center", gap: 14,
            }}>
              <div style={{ width: isMobile ? 56 : 64, height: isMobile ? 56 : 64, flexShrink: 0, borderRadius: 14, background: "linear-gradient(135deg,#1a2744,#243b72)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="bi bi-pen-fill" style={{ color: "#fff", fontSize: isMobile ? "1.2rem" : "1.5rem" }} />
              </div>
              <div style={{ flex: isMobile ? 1 : undefined, width: isMobile ? "auto" : "100%" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>Firma Digital</div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 3, lineHeight: 1.5 }}>
                  Se adjunta al firmar una consulta
                </div>
                {firmaUrl ? (
                  <div style={{ marginTop: isMobile ? 8 : 12 }}>
                    <div style={{ fontSize: "0.72rem", color: "#15803d", fontWeight: 600, marginBottom: 6 }}>
                      <i className="bi bi-check-circle-fill me-1" />Firma configurada
                    </div>
                    <img src={firmaUrl} alt="Firma" style={{ maxWidth: "100%", maxHeight: 60, objectFit: "contain", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 7, padding: 6 }} />
                    <button type="button" onClick={eliminarFirma}
                      style={{ marginTop: 8, width: "100%", background: "none", border: "1px solid #fecaca", borderRadius: 7, color: "#dc2626", fontSize: "0.72rem", padding: "5px 0", cursor: "pointer" }}>
                      <i className="bi bi-trash3 me-1" />Eliminar
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.73rem", color: "#94a3b8", marginTop: 6, fontStyle: "italic" }}>
                    Sin firma configurada
                  </div>
                )}
              </div>
            </div>

            {/* Panel derecho: editor */}
            <div style={{ ...cardSt, padding: isMobile ? "16px" : "28px", flex: 1, minWidth: 0 }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>Configurar firma digital</div>
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>
                  Dibuja tu firma o sube una imagen (PNG con fondo transparente recomendado).
                </div>
              </div>

              {/* Selector modo */}
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {[
                  { k: "upload", label: "Subir imagen", icon: "bi-upload" },
                  { k: "draw",   label: "Dibujar firma", icon: "bi-pencil" },
                ].map(m => (
                  <button key={m.k} type="button" onClick={() => setFirmaMode(m.k)}
                    style={{
                      padding: isMobile ? "7px 12px" : "8px 18px", borderRadius: 9,
                      border: "1px solid", cursor: "pointer",
                      fontSize: isMobile ? "0.78rem" : "0.85rem",
                      fontWeight: 600, display: "flex", alignItems: "center", gap: 5,
                      borderColor: firmaMode === m.k ? "#1a2744" : "#d1d5db",
                      background: firmaMode === m.k ? "#1a2744" : "#fff",
                      color: firmaMode === m.k ? "#fff" : "#374151",
                      transition: "all .15s", flex: isMobile ? 1 : "none",
                      justifyContent: "center",
                    }}>
                    <i className={`bi ${m.icon}`} />{isMobile ? m.k === "upload" ? "Subir" : "Dibujar" : m.label}
                  </button>
                ))}
              </div>

              {/* Subir archivo */}
              {firmaMode === "upload" && (
                <div>
                  <input ref={firmaFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFirmaFileChange} />
                  <button type="button" disabled={subiendoFirma} onClick={() => firmaFileRef.current?.click()}
                    style={{
                      padding: isMobile ? "14px 16px" : "18px 24px", borderRadius: 10,
                      border: "2px dashed #d1d5db", background: "#f8fafc", color: "#374151",
                      cursor: "pointer", fontSize: isMobile ? "0.83rem" : "0.87rem",
                      fontWeight: 500, display: "flex", alignItems: "center", gap: 10,
                      width: "100%", justifyContent: "center", transition: "border-color .15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#1a2744"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#d1d5db"}
                  >
                    {subiendoFirma
                      ? <><span className="spinner-border spinner-border-sm" /> Subiendo...</>
                      : <><i className="bi bi-cloud-upload" style={{ fontSize: "1.2rem" }} /> Seleccionar imagen de firma</>
                    }
                  </button>
                  <div style={{ fontSize: "0.71rem", color: "#94a3b8", marginTop: 7 }}>
                    PNG recomendado (fondo transparente). Máximo 5 MB.
                  </div>
                </div>
              )}

              {/* Canvas */}
              {firmaMode === "draw" && (
                <div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: 8 }}>
                    Dibuja tu firma con el mouse o con el dedo:
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={560} height={isMobile ? 120 : 160}
                    style={{ border: "1px solid #d1d5db", borderRadius: 10, background: "#fff", cursor: "crosshair", touchAction: "none", display: "block", width: "100%", boxShadow: "inset 0 1px 4px rgba(0,0,0,.04)" }}
                    onMouseDown={iniciarDibujo} onMouseMove={dibujar}
                    onMouseUp={terminarDibujo} onMouseLeave={terminarDibujo}
                    onTouchStart={iniciarDibujo} onTouchMove={dibujar} onTouchEnd={terminarDibujo}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={limpiarCanvas}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer", fontWeight: 500, fontSize: "0.84rem", display: "flex", alignItems: "center", gap: 6 }}>
                      <i className="bi bi-eraser" />Limpiar
                    </button>
                    <button type="button" onClick={guardarFirmaCanvas} disabled={subiendoFirma}
                      style={{ flex: 1, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a2744,#243b72)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.84rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {subiendoFirma ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-floppy" />}
                      {subiendoFirma ? "Guardando..." : "Guardar firma"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════ TAB: CONTRASEÑA ════════════════════════ */}
        {tab === "password" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 500, width: "100%" }}>
          <div style={{ ...cardSt, padding: isMobile ? "18px 16px" : "28px" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>Cambiar contraseña</div>
              <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>
                Ingresa tu contraseña actual para establecer una nueva.
              </div>
            </div>
            <form onSubmit={guardarPassword}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelSt}>Contraseña actual *</label>
                  <input style={inputSt} type="password" required
                    value={pwForm.password_actual}
                    onChange={e => setPwForm(f => ({ ...f, password_actual: e.target.value }))} />
                </div>
                <div>
                  <label style={labelSt}>Contraseña nueva *</label>
                  <input style={inputSt} type="password" required minLength={6}
                    value={pwForm.password_nuevo}
                    onChange={e => setPwForm(f => ({ ...f, password_nuevo: e.target.value }))} />
                  <div style={{ fontSize: "0.71rem", color: "#94a3b8", marginTop: 3 }}>Mínimo 6 caracteres</div>
                </div>
                <div>
                  <label style={labelSt}>Confirmar contraseña nueva *</label>
                  <input style={inputSt} type="password" required
                    value={pwForm.confirmar}
                    onChange={e => setPwForm(f => ({ ...f, confirmar: e.target.value }))} />
                </div>
                <div>
                  <button type="submit" disabled={guardando}
                    style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a2744,#243b72)", color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, opacity: guardando ? .7 : 1 }}>
                    <i className="bi bi-shield-check" />
                    {guardando ? "Guardando..." : "Cambiar contraseña"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <Seccion2FA cardSt={cardSt} labelSt={labelSt} inputSt={inputSt} isMobile={isMobile} showMsg={showMsg} />
          </div>
        )}

        {/* ════════════════════════ TAB: GOOGLE CALENDAR ════════════════════════ */}
        {tab === "google" && puedeUsarGoogleCalendar && (
          <div style={{ ...cardSt, padding: isMobile ? "18px 16px" : "28px", maxWidth: 500, width: "100%" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>Sincronización con Google Calendar</div>
              <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>
                Conecta tu cuenta de Google para que tus citas se agreguen automáticamente a tu calendario,
                y para que tus reuniones en Google Calendar bloqueen esos horarios en el portal de citas.
              </div>
            </div>

            {googleStatus.conectado ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", background: "rgba(16,185,129,.12)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <i className="bi bi-check-circle-fill" style={{ color: "#10b981", fontSize: "1.1rem" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#1e293b" }}>Cuenta conectada</div>
                    <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{googleStatus.google_email}</div>
                  </div>
                </div>
                <button type="button" onClick={desconectarGoogle} disabled={cargandoGoogle}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", opacity: cargandoGoogle ? .7 : 1 }}>
                  {cargandoGoogle ? "Desconectando..." : "Desconectar"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={conectarGoogle}
                style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a2744,#243b72)", color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                <i className="bi bi-google" />
                Conectar con Google Calendar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Verificación en dos pasos (2FA por correo) — el propio usuario la activa/desactiva ──
function Seccion2FA({ cardSt, labelSt, inputSt, isMobile, showMsg }) {
  const [activado, setActivado]   = useState(null); // null = cargando
  const [paso, setPaso]           = useState("estado"); // estado | codigo | desactivar
  const [codigo, setCodigo]       = useState("");
  const [passwordActual, setPasswordActual] = useState("");
  const [cargando, setCargando]   = useState(false);

  useEffect(() => {
    api.get("/auth/me")
      .then(res => setActivado(!!res.data?.data?.two_factor_enabled))
      .catch(() => setActivado(false));
  }, []);

  const solicitarActivacion = async () => {
    setCargando(true);
    try {
      const res = await api.post("/auth/me/2fa/solicitar-activacion");
      showMsg("success", res.data.msg);
      setPaso("codigo");
    } catch (err) {
      showMsg("danger", err.response?.data?.msg || "No se pudo enviar el código");
    } finally {
      setCargando(false);
    }
  };

  const confirmarActivacion = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      await api.post("/auth/me/2fa/confirmar-activacion", { codigo });
      setActivado(true);
      setPaso("estado");
      setCodigo("");
      showMsg("success", "Verificación en dos pasos activada");
    } catch (err) {
      showMsg("danger", err.response?.data?.msg || "Código incorrecto");
    } finally {
      setCargando(false);
    }
  };

  const desactivar = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      await api.post("/auth/me/2fa/desactivar", { password_actual: passwordActual });
      setActivado(false);
      setPaso("estado");
      setPasswordActual("");
      showMsg("success", "Verificación en dos pasos desactivada");
    } catch (err) {
      showMsg("danger", err.response?.data?.msg || "No se pudo desactivar");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ ...cardSt, padding: isMobile ? "18px 16px" : "28px" }}>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>Verificación en dos pasos</div>
          <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}>
            Al iniciar sesión, además de tu contraseña te pediremos un código enviado a tu correo.
          </div>
        </div>
        {activado !== null && (
          <span style={{
            flexShrink: 0, fontSize: "0.72rem", fontWeight: 700, padding: "4px 10px", borderRadius: 20,
            background: activado ? "rgba(16,185,129,.12)" : "#f1f5f9",
            color: activado ? "#059669" : "#64748b",
          }}>
            {activado ? "Activada" : "Desactivada"}
          </span>
        )}
      </div>

      {activado === null ? (
        <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Cargando...</div>
      ) : paso === "estado" ? (
        activado ? (
          <button type="button" onClick={() => setPaso("desactivar")}
            style={{ padding: "9px 22px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            <i className="bi bi-shield-slash" />Desactivar
          </button>
        ) : (
          <button type="button" onClick={solicitarActivacion} disabled={cargando}
            style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a2744,#243b72)", color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, opacity: cargando ? .7 : 1 }}>
            <i className="bi bi-shield-plus" />
            {cargando ? "Enviando código..." : "Activar"}
          </button>
        )
      ) : paso === "codigo" ? (
        <form onSubmit={confirmarActivacion}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelSt}>Código de verificación *</label>
              <input style={{ ...inputSt, letterSpacing: "0.3em", fontWeight: 700, textAlign: "center" }}
                inputMode="numeric" maxLength={6} required autoFocus
                value={codigo}
                onChange={e => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              <div style={{ fontSize: "0.71rem", color: "#94a3b8", marginTop: 3 }}>Revisa tu correo — expira en 10 minutos</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => { setPaso("estado"); setCodigo(""); }}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="submit" disabled={cargando || codigo.length !== 6}
                style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a2744,#243b72)", color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, opacity: (cargando || codigo.length !== 6) ? .7 : 1 }}>
                <i className="bi bi-shield-check" />
                {cargando ? "Verificando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={desactivar}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelSt}>Contraseña actual *</label>
              <input style={inputSt} type="password" required autoFocus
                value={passwordActual}
                onChange={e => setPasswordActual(e.target.value)} />
              <div style={{ fontSize: "0.71rem", color: "#94a3b8", marginTop: 3 }}>Confírmala para desactivar la verificación en dos pasos</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => { setPaso("estado"); setPasswordActual(""); }}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="submit" disabled={cargando}
                style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, opacity: cargando ? .7 : 1 }}>
                <i className="bi bi-shield-slash" />
                {cargando ? "Desactivando..." : "Desactivar"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
