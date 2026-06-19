import { useState, useRef, useCallback } from "react";
import api from "../../api/api";
import { useConfigSistema } from "../../context/ConfigSistemaContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ICONOS_SUGERIDOS = [
  "bi-hospital",  "bi-heart-pulse", "bi-capsule",   "bi-bandaid",
  "bi-clipboard2-pulse", "bi-lungs", "bi-activity",  "bi-shield-plus",
  "bi-star",      "bi-building",    "bi-house-heart","bi-person-heart",
];

export default function SuperAdminPersonalizacion() {
  const cfg = useConfigSistema();

  const [form, setForm] = useState({
    nombre_sistema:      cfg.nombre_sistema,
    subtitulo:           cfg.subtitulo,
    icono_bootstrap:     cfg.icono_bootstrap,
    fondo_login_url:     cfg.fondo_login_url,
    copyright_texto:     cfg.copyright_texto,
    color_primario:      cfg.color_primario,
    color_nombre1:       cfg.color_nombre1 || "#ffffff",
    color_nombre2:       cfg.color_nombre2 || "#2D6BE8",
    inactividad_minutos: cfg.inactividad_minutos || "20",
  });

  // Preview local de logo / fondo
  const [logoPreview,  setLogoPreview]  = useState(cfg.logoUrl || null);
  const [fondoPreview, setFondoPreview] = useState(cfg.fondoUrl || null);
  const [logoFile,     setLogoFile]     = useState(null);
  const [fondoFile,    setFondoFile]    = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [ok,        setOk]        = useState(false);
  const [error,     setError]     = useState("");

  const logoInputRef  = useRef();
  const fondoInputRef = useRef();

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const onLogoChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const onFondoChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFondoFile(f);
    setFondoPreview(URL.createObjectURL(f));
  };

  const guardar = async () => {
    setGuardando(true);
    setOk(false);
    setError("");
    try {
      // 1. Subir logo si hay archivo nuevo
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        await api.post("/config-sistema/upload-logo", fd, {
          headers: { "Content-Type": null }, // borra el default JSON para que browser setee multipart+boundary
        });
      }

      // 2. Subir fondo si hay archivo nuevo
      let fondoUrlGuardado = form.fondo_login_url;
      if (fondoFile) {
        const fd = new FormData();
        fd.append("fondo", fondoFile);
        const r = await api.post("/config-sistema/upload-fondo", fd, {
          headers: { "Content-Type": null },
        });
        fondoUrlGuardado = r.data.url;
      }

      // 3. Guardar campos de texto
      await api.put("/config-sistema", { ...form, fondo_login_url: fondoUrlGuardado });

      // 4. Recargar contexto global
      cfg.recargar();

      setLogoFile(null);
      setFondoFile(null);
      setOk(true);
      setTimeout(() => setOk(false), 3500);
    } catch (e) {
      setError(e.response?.data?.msg || e.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarLogo = async () => {
    try {
      await api.delete("/config-sistema/logo");
      setLogoPreview(null);
      setLogoFile(null);
      cfg.recargar();
    } catch {}
  };

  // Preview en vivo del login
  const previewFondo = fondoPreview || form.fondo_login_url || cfg.fondoUrl;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100 }}>
      {/* Encabezado */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: "linear-gradient(135deg,#7c3aed,#a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(124,58,237,.3)",
          }}>
            <i className="bi bi-palette-fill" style={{ color: "#fff", fontSize: 20 }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 800, color: "#1e293b", fontSize: "1.3rem" }}>
              Personalización del Sistema
            </h4>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.84rem" }}>
              Configura el nombre, logo, colores y apariencia del sistema
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

        {/* ── Panel izquierdo: formulario ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Identidad del sistema */}
          <Section title="Identidad del sistema" icon="bi-type">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Nombre del sistema">
                <input
                  className="form-control"
                  value={form.nombre_sistema}
                  onChange={e => set("nombre_sistema", e.target.value)}
                  placeholder="Ej: Mi Clínica"
                />
              </Field>
              <Field label="Subtítulo">
                <input
                  className="form-control"
                  value={form.subtitulo}
                  onChange={e => set("subtitulo", e.target.value)}
                  placeholder="Ej: Sistema de gestión clínica"
                />
              </Field>
            </div>
            <Field label="Texto de copyright">
              <input
                className="form-control"
                value={form.copyright_texto}
                onChange={e => set("copyright_texto", e.target.value)}
                placeholder="Ej: Mi Clínica · Todos los derechos reservados"
              />
            </Field>
            <Field label="Tiempo de inactividad (minutos)" hint="Minutos sin actividad antes de mostrar el aviso de sesión. Mínimo 5, máximo 120.">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="number"
                  className="form-control"
                  style={{ maxWidth: 120 }}
                  min={5} max={120}
                  value={form.inactividad_minutos}
                  onChange={e => set("inactividad_minutos", String(Math.min(120, Math.max(5, parseInt(e.target.value) || 20))))}
                />
                <span className="text-muted small">minutos</span>
              </div>
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label={`Color primera parte (ej: "KG-")`}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="color"
                    value={form.color_nombre1}
                    onChange={e => set("color_nombre1", e.target.value)}
                    style={{ width: 40, height: 36, border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", padding: 2 }}
                  />
                  <input
                    className="form-control"
                    value={form.color_nombre1}
                    onChange={e => set("color_nombre1", e.target.value)}
                    placeholder="#ffffff"
                    style={{ fontFamily: "monospace", fontSize: 13 }}
                  />
                </div>
              </Field>
              <Field label={`Color segunda parte (ej: "Medic")`}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="color"
                    value={form.color_nombre2}
                    onChange={e => set("color_nombre2", e.target.value)}
                    style={{ width: 40, height: 36, border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", padding: 2 }}
                  />
                  <input
                    className="form-control"
                    value={form.color_nombre2}
                    onChange={e => set("color_nombre2", e.target.value)}
                    placeholder="#2D6BE8"
                    style={{ fontFamily: "monospace", fontSize: 13 }}
                  />
                </div>
              </Field>
            </div>
            <div style={{ marginTop: 4, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Vista previa: </span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>
                {(() => {
                  const idx = form.nombre_sistema.indexOf("-");
                  if (idx === -1) return <span style={{ color: form.color_nombre2 }}>{form.nombre_sistema}</span>;
                  return <>
                    <span style={{ color: form.color_nombre1, textShadow: form.color_nombre1 === "#ffffff" ? "0 0 3px #94a3b8" : "none" }}>{form.nombre_sistema.slice(0, idx + 1)}</span>
                    <span style={{ color: form.color_nombre2 }}>{form.nombre_sistema.slice(idx + 1)}</span>
                  </>;
                })()}
              </span>
            </div>
          </Section>

          {/* Logo */}
          <Section title="Logo del sistema" icon="bi-image">
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              {/* Preview del logo */}
              <div
                onClick={() => logoInputRef.current?.click()}
                style={{
                  width: 110, height: 110, borderRadius: 16, flexShrink: 0,
                  border: "2px dashed #cbd5e1",
                  background: logoPreview ? "#f8fafc" : "linear-gradient(135deg,#f1f5f9,#e2e8f0)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", overflow: "hidden", position: "relative",
                  transition: "border-color .2s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#7c3aed"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#cbd5e1"}
              >
                {logoPreview
                  ? <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : <div style={{ textAlign: "center", color: "#94a3b8" }}>
                      <i className="bi bi-cloud-upload" style={{ fontSize: 26, display: "block" }} />
                      <span style={{ fontSize: 11 }}>Subir logo</span>
                    </div>
                }
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onLogoChange} />
              </div>

              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                  El logo reemplaza al ícono en el navbar y la pantalla de login.<br />
                  Recomendado: PNG transparente, mínimo 128×128px.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    style={{
                      background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                      border: "none", borderRadius: 8, padding: "7px 16px",
                      color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    <i className="bi bi-upload me-1" />
                    {logoPreview ? "Cambiar logo" : "Subir logo"}
                  </button>
                  {logoPreview && (
                    <button
                      onClick={eliminarLogo}
                      style={{
                        background: "#fee2e2", border: "1px solid #fca5a5",
                        borderRadius: 8, padding: "7px 14px",
                        color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      <i className="bi bi-trash me-1" />Eliminar
                    </button>
                  )}
                </div>

                {/* Selector de ícono fallback */}
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8, display: "block" }}>
                    Ícono Bootstrap (si no hay logo)
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ICONOS_SUGERIDOS.map(ic => (
                      <button
                        key={ic}
                        onClick={() => set("icono_bootstrap", ic)}
                        title={ic}
                        style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: form.icono_bootstrap === ic ? "#7c3aed" : "#f1f5f9",
                          border: form.icono_bootstrap === ic ? "2px solid #7c3aed" : "2px solid #e2e8f0",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all .15s",
                        }}
                      >
                        <i className={`bi ${ic}`} style={{ fontSize: 17, color: form.icono_bootstrap === ic ? "#fff" : "#475569" }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Fondo del login */}
          <Section title="Fondo de pantalla de login" icon="bi-image-fill">
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {/* Miniatura del fondo */}
              <div
                style={{
                  width: 160, height: 90, borderRadius: 10, flexShrink: 0,
                  backgroundImage: `url(${previewFondo})`,
                  backgroundSize: "cover", backgroundPosition: "center",
                  border: "2px solid #e2e8f0", overflow: "hidden",
                  cursor: "pointer", position: "relative",
                }}
                onClick={() => fondoInputRef.current?.click()}
              >
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: 0, transition: "opacity .2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                >
                  <i className="bi bi-pencil-fill" style={{ color: "#fff", fontSize: 18 }} />
                </div>
                <input ref={fondoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFondoChange} />
              </div>

              <div style={{ flex: 1 }}>
                <Field label="URL de imagen (o sube una)">
                  <input
                    className="form-control"
                    value={form.fondo_login_url}
                    onChange={e => { set("fondo_login_url", e.target.value); setFondoPreview(e.target.value); }}
                    placeholder="https://... o deja en blanco si subiste archivo"
                  />
                </Field>
                <button
                  onClick={() => fondoInputRef.current?.click()}
                  style={{
                    marginTop: 8,
                    background: "#f1f5f9", border: "1px solid #e2e8f0",
                    borderRadius: 8, padding: "7px 14px",
                    color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  <i className="bi bi-upload me-1" />Subir imagen de fondo
                </button>
              </div>
            </div>
          </Section>

          {/* Feedback */}
          {error && (
            <div style={{
              background: "#fee2e2", border: "1px solid #fca5a5",
              borderRadius: 10, padding: "12px 16px",
              color: "#991b1b", fontSize: 13, display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="bi bi-x-circle-fill" />
              {error}
            </div>
          )}
          {ok && (
            <div style={{
              background: "#dcfce7", border: "1px solid #86efac",
              borderRadius: 10, padding: "12px 16px",
              color: "#166534", fontSize: 13, display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="bi bi-check-circle-fill" />
              Cambios guardados correctamente. El sistema se actualizó.
            </div>
          )}

          {/* Botón guardar */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={guardar}
              disabled={guardando}
              style={{
                background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                border: "none", borderRadius: 10, padding: "11px 32px",
                color: "#fff", fontWeight: 700, fontSize: "0.9rem",
                cursor: guardando ? "wait" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: "0 4px 14px rgba(124,58,237,.35)",
                opacity: guardando ? 0.7 : 1,
              }}
            >
              {guardando
                ? <><i className="bi bi-hourglass-split" /> Guardando...</>
                : <><i className="bi bi-floppy-fill" /> Guardar cambios</>
              }
            </button>
          </div>
        </div>

        {/* ── Panel derecho: preview del login ── */}
        <div style={{ position: "sticky", top: 20 }}>
          <div style={{
            background: "#f8fafc", borderRadius: 16,
            border: "1px solid #e2e8f0", overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,.08)",
          }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid #e2e8f0",
              background: "#fff",
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                <i className="bi bi-eye me-2" />Preview · Pantalla de login
              </span>
            </div>

            {/* Mini-preview del login */}
            <div style={{
              height: 460, position: "relative", overflow: "hidden",
              backgroundImage: `url(${previewFondo})`,
              backgroundSize: "cover", backgroundPosition: "center",
            }}>
              {/* Overlay */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(135deg,rgba(10,30,60,.72) 0%,rgba(0,80,100,.60) 100%)",
              }} />
              {/* Card */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%,-50%)",
                width: 210,
                background: "rgba(255,255,255,.1)",
                backdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,.22)",
                borderRadius: 18,
                padding: "22px 18px",
                color: "#fff",
                textAlign: "center",
              }}>
                {/* Logo/icono */}
                <div style={{
                  fontSize: 36, color: form.color_primario || "#38bdf8",
                  marginBottom: 8,
                }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="" style={{ width: 52, height: 52, objectFit: "contain", borderRadius: 10 }} />
                    : <i className={`bi ${form.icono_bootstrap}`} />
                  }
                </div>
                <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 3 }}>
                  <PreviewBrandName name={form.nombre_sistema || "Nombre del sistema"} c1={form.color_nombre1} c2={form.color_nombre2} />
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.55)", marginBottom: 14 }}>
                  {form.subtitulo || "Subtítulo del sistema"}
                </div>
                {/* Input simulados */}
                {[0, 1].map(i => (
                  <div key={i} style={{
                    height: 28, borderRadius: 7, marginBottom: 8,
                    background: "rgba(255,255,255,.12)",
                    border: "1px solid rgba(255,255,255,.2)",
                  }} />
                ))}
                {/* Botón simulado */}
                <div style={{
                  height: 30, borderRadius: 7,
                  background: form.color_primario
                    ? `linear-gradient(135deg,${form.color_primario},${form.color_primario}bb)`
                    : "linear-gradient(135deg,#0ea5e9,#0369a1)",
                }} />
                <div style={{ marginTop: 12, fontSize: "0.6rem", color: "rgba(255,255,255,.3)" }}>
                  © {new Date().getFullYear()} {form.copyright_texto}
                </div>
              </div>
            </div>

            {/* Preview navbar */}
            <div style={{
              height: 52, background: "linear-gradient(90deg,#0d1b2e,#0f2040)",
              borderTop: "1px solid rgba(59,130,246,.18)",
              display: "flex", alignItems: "center", paddingLeft: 14, gap: 10,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0, overflow: "hidden",
                background: logoPreview ? "transparent" : "linear-gradient(135deg,#1d4ed8,#3b82f6)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {logoPreview
                  ? <img src={logoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : <i className={`bi ${form.icono_bootstrap}-fill`} style={{ color: "#fff", fontSize: 13 }} />
                }
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 800 }}>
                  <NavbarPreviewBrandName name={form.nombre_sistema} c1={form.color_nombre1} c2={form.color_nombre2} />
                </div>
                <div style={{ fontSize: "0.5rem", color: "rgba(147,197,253,.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {form.subtitulo}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14,
      border: "1px solid #e2e8f0",
      boxShadow: "0 2px 8px rgba(0,0,0,.04)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "13px 18px", borderBottom: "1px solid #f1f5f9",
        background: "#fafbfc",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <i className={`bi ${icon}`} style={{ fontSize: 15, color: "#7c3aed" }} />
        <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "#334155" }}>{title}</span>
      </div>
      <div style={{ padding: "18px 18px 16px" }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && <small className="text-muted d-block mt-1">{hint}</small>}
    </div>
  );
}

function PreviewBrandName({ name = "", c1 = "#ffffff", c2 = "#2D6BE8" }) {
  const idx = name.indexOf("-");
  if (idx === -1) return <span style={{ color: c2 }}>{name}</span>;
  return (
    <>
      <span style={{ color: c1 }}>{name.slice(0, idx + 1)}</span>
      <span style={{ color: c2 }}>{name.slice(idx + 1)}</span>
    </>
  );
}

function NavbarPreviewBrandName({ name = "", c1 = "#ffffff", c2 = "#2D6BE8" }) {
  const idx = name.indexOf("-");
  if (idx === -1) return <span style={{ color: c2 }}>{name}</span>;
  return (
    <>
      <span style={{ color: c1 }}>{name.slice(0, idx + 1)}</span>
      <span style={{ color: c2 }}>{name.slice(idx + 1)}</span>
    </>
  );
}
