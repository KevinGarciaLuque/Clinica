import { useEffect, useState, useRef } from "react";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

export default function PerfilUsuario() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    nombres: "", apellidos: "", telefono: "", foto_url: "",
  });
  const [pwForm, setPwForm] = useState({ password_actual: "", password_nuevo: "", confirmar: "" });
  const [tab, setTab] = useState("info");
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [previsualizacion, setPrevisualizacion] = useState("");
  const inputFileRef = useRef(null);
  const inicializado  = useRef(false);

  useEffect(() => {
    if (user && !inicializado.current) {
      inicializado.current = true;
      setForm({
        nombres:   user.nombres   || "",
        apellidos: user.apellidos || "",
        telefono:  user.telefono  || "",
        foto_url:  user.foto_url  || "",
      });
      setPrevisualizacion(user.foto_url || "");
    }
  }, [user]);

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
        nombres:   form.nombres,
        apellidos: form.apellidos,
        telefono:  form.telefono,
        foto_url:  form.foto_url,
      });
      updateUser({
        nombres:   form.nombres,
        apellidos: form.apellidos,
        telefono:  form.telefono,
        foto_url:  form.foto_url,
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
    if (pwForm.password_nuevo !== pwForm.confirmar) {
      return showMsg("danger", "Las contraseñas nuevas no coinciden");
    }
    if (pwForm.password_nuevo.length < 6) {
      return showMsg("danger", "La contraseña debe tener al menos 6 caracteres");
    }
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

  // Subida de archivo real (galería o cámara)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview local inmediato
    const localUrl = URL.createObjectURL(file);
    setPrevisualizacion(localUrl);
    setSubiendoFoto(true);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const res = await api.post("/auth/me/foto", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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

  const TABS = [
    { k: "info",     label: "Información personal", icon: "bi-person-fill" },
    { k: "password", label: "Contraseña",            icon: "bi-shield-lock-fill" },
  ];

  return (
    <div style={{ margin: "-1.5rem", width: "calc(100% + 3rem)", background: "#f0f2f5", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "28px 32px 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "rgba(255,255,255,.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-person-badge-fill" style={{ color: "#fff", fontSize: "1.3rem" }} />
          </div>
          <div>
            <h4 style={{ color: "#fff", margin: 0, fontWeight: 700, fontSize: "1.2rem" }}>
              Mi Perfil
            </h4>
            <div style={{ color: "rgba(255,255,255,.55)", fontSize: "0.8rem", marginTop: 2 }}>
              Actualiza tu información personal y contraseña
            </div>
          </div>
        </div>

        {/* Tabs en el header */}
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              padding: "8px 18px", border: "none", cursor: "pointer", fontSize: "0.83rem",
              fontWeight: tab === t.k ? 700 : 500,
              borderRadius: "8px 8px 0 0",
              background: tab === t.k ? "#fff" : "rgba(255,255,255,.1)",
              color: tab === t.k ? "#1a2744" : "rgba(255,255,255,.75)",
              display: "flex", alignItems: "center", gap: 7,
              transition: "background .15s, color .15s",
            }}>
              <i className={`bi ${t.icon}`} style={{ fontSize: "0.85rem" }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{ padding: 24 }}>
        {msg.texto && (
          <div style={{
            padding: "10px 16px", borderRadius: 10, marginBottom: 16, fontSize: "0.87rem",
            background: msg.tipo === "success" ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)",
            border: `1px solid ${msg.tipo === "success" ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)"}`,
            color: msg.tipo === "success" ? "#065f46" : "#991b1b",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <i className={`bi ${msg.tipo === "success" ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />
            {msg.texto}
          </div>
        )}

        {/* ── Tab: Información personal ── */}
        {tab === "info" && (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>

            {/* Tarjeta de avatar */}
            <div style={{
              background: "#fff", borderRadius: 14, padding: 24,
              boxShadow: "0 2px 8px rgba(0,0,0,.06)", width: 220,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            }}>
              {/* Avatar con overlay de carga */}
              <div style={{ position: "relative" }}>
                <div style={{
                  width: 100, height: 100, borderRadius: "50%",
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
                    : <span style={{ color: "#fff", fontWeight: 700, fontSize: "2rem" }}>{initials}</span>
                  }
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>
                  {form.nombres || user?.nombres} {form.apellidos || user?.apellidos}
                </div>
                <span style={{
                  display: "inline-block", marginTop: 4,
                  background: "#eff6ff", color: "#1d4ed8",
                  fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.07em",
                  textTransform: "uppercase", padding: "2px 8px", borderRadius: 5,
                }}>
                  {user?.tipo}
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center" }}>
                {user?.email}
              </div>

              {/* Botones de foto */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                {/* Input oculto — acepta galería */}
                <input
                  ref={inputFileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  disabled={subiendoFoto}
                  onClick={() => {
                    if (inputFileRef.current) {
                      inputFileRef.current.removeAttribute("capture");
                      inputFileRef.current.click();
                    }
                  }}
                  style={{
                    width: "100%", padding: "8px 0", borderRadius: 8, cursor: "pointer",
                    background: "#eff6ff", border: "1px solid #bfdbfe",
                    color: "#1d4ed8", fontSize: "0.8rem", fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <i className="bi bi-image" /> Galería / Archivo
                </button>
                <button
                  type="button"
                  disabled={subiendoFoto}
                  onClick={() => {
                    if (inputFileRef.current) {
                      inputFileRef.current.setAttribute("capture", "user");
                      inputFileRef.current.click();
                    }
                  }}
                  style={{
                    width: "100%", padding: "8px 0", borderRadius: 8, cursor: "pointer",
                    background: "#f0fdf4", border: "1px solid #bbf7d0",
                    color: "#15803d", fontSize: "0.8rem", fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <i className="bi bi-camera-fill" /> Tomar foto
                </button>
                {previsualizacion && (
                  <button
                    type="button"
                    disabled={subiendoFoto}
                    onClick={async () => {
                      handleFotoUrl("");
                      try {
                        await api.put("/auth/me", { foto_url: "" });
                        updateUser({ foto_url: "" });
                        showMsg("success", "Foto eliminada");
                      } catch { /* ignorar */ }
                    }}
                    style={{
                      width: "100%", padding: "6px 0", borderRadius: 8, cursor: "pointer",
                      background: "transparent", border: "1px solid #fecaca",
                      color: "#dc2626", fontSize: "0.75rem", fontWeight: 500,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}
                  >
                    <i className="bi bi-trash3" /> Quitar foto
                  </button>
                )}
              </div>
            </div>

            {/* Formulario */}
            <div style={{
              background: "#fff", borderRadius: 14, padding: 24,
              boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            }}>
              <form onSubmit={guardarInfo}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold" style={{ fontSize: "0.83rem", color: "#374151" }}>
                      Nombres *
                    </label>
                    <input className="form-control" value={form.nombres} required
                      onChange={e => setForm(f => ({ ...f, nombres: e.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold" style={{ fontSize: "0.83rem", color: "#374151" }}>
                      Apellidos *
                    </label>
                    <input className="form-control" value={form.apellidos} required
                      onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold" style={{ fontSize: "0.83rem", color: "#374151" }}>
                      Teléfono
                    </label>
                    <input className="form-control" value={form.telefono}
                      onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold" style={{ fontSize: "0.83rem", color: "#374151" }}>
                      Email
                    </label>
                    <input className="form-control" value={user?.email || ""} disabled
                      style={{ background: "#f8fafc", color: "#94a3b8" }} />
                  </div>
                  <div className="col-12">
                    <button type="submit" className="btn btn-primary" disabled={guardando}>
                      <i className="bi bi-check-lg me-2" />
                      {guardando ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Tab: Contraseña ── */}
        {tab === "password" && (
          <div style={{
            background: "#fff", borderRadius: 14, padding: 28,
            boxShadow: "0 2px 8px rgba(0,0,0,.06)", maxWidth: 500,
          }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>
                Cambiar contraseña
              </div>
              <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>
                Por seguridad debes ingresar tu contraseña actual para establecer una nueva.
              </div>
            </div>
            <form onSubmit={guardarPassword}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label fw-semibold" style={{ fontSize: "0.83rem", color: "#374151" }}>
                    Contraseña actual *
                  </label>
                  <input className="form-control" type="password" required
                    value={pwForm.password_actual}
                    onChange={e => setPwForm(f => ({ ...f, password_actual: e.target.value }))} />
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold" style={{ fontSize: "0.83rem", color: "#374151" }}>
                    Contraseña nueva *
                  </label>
                  <input className="form-control" type="password" required minLength={6}
                    value={pwForm.password_nuevo}
                    onChange={e => setPwForm(f => ({ ...f, password_nuevo: e.target.value }))} />
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 3 }}>
                    Mínimo 6 caracteres
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold" style={{ fontSize: "0.83rem", color: "#374151" }}>
                    Confirmar contraseña nueva *
                  </label>
                  <input className="form-control" type="password" required
                    value={pwForm.confirmar}
                    onChange={e => setPwForm(f => ({ ...f, confirmar: e.target.value }))} />
                </div>
                <div className="col-12">
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    <i className="bi bi-shield-check me-2" />
                    {guardando ? "Guardando..." : "Cambiar contraseña"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
