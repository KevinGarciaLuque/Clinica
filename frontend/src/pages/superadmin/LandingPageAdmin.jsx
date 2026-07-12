import { useState, useEffect, useRef } from "react";
import api from "../../api/api";

const TABS = [
  { id: "hero",       label: "Hero",       icon: "bi-house-heart-fill" },
  { id: "planes",     label: "Planes",     icon: "bi-tags-fill" },
  { id: "nosotros",   label: "Nosotros",   icon: "bi-people-fill" },
  { id: "contacto",   label: "Contacto",   icon: "bi-chat-dots-fill" },
  { id: "directorio", label: "Directorio", icon: "bi-hospital-fill" },
];

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function LandingPageAdmin() {
  const [tab,           setTab]           = useState("hero");
  const [form,          setForm]          = useState(null);
  const [logoPreview,   setLogoPreview]   = useState(null);
  const [subiendoLogo,  setSubiendoLogo]  = useState(false);
  const logoInputRef = useRef();
  const [guardando, setGuardando] = useState(false);
  const [msg,       setMsg]       = useState(null);

  useEffect(() => {
    api.get("/config-sistema").then(r => {
      const c = r.data.data || {};
      if (c.logo_url) setLogoPreview(
        c.logo_url.startsWith("data:") || c.logo_url.startsWith("http")
          ? c.logo_url
          : `${API_URL}${c.logo_url}`
      );
      setForm({
        landing_activo:               c.landing_activo               ?? "1",
        landing_color_primario:       c.landing_color_primario        ?? "#0E1F3C",
        landing_tagline:              c.landing_tagline               ?? "",
        landing_descripcion:          c.landing_descripcion           ?? "",
        landing_whatsapp:             c.landing_whatsapp              ?? "",
        landing_email_contacto:       c.landing_email_contacto        ?? "",
        landing_nosotros_texto:       c.landing_nosotros_texto        ?? "",
        landing_instagram:            c.landing_instagram             ?? "",
        landing_facebook:             c.landing_facebook              ?? "",
        landing_tiktok:               c.landing_tiktok                ?? "",
        landing_plan_trial_precio:    c.landing_plan_trial_precio     ?? "",
        landing_plan_trial_duracion:  c.landing_plan_trial_duracion   ?? "",
        landing_plan_trial_features:  c.landing_plan_trial_features   ?? "[]",
        landing_plan_semestral_precio:    c.landing_plan_semestral_precio     ?? "",
        landing_plan_semestral_features:  c.landing_plan_semestral_features   ?? "[]",
        landing_plan_anual_precio:    c.landing_plan_anual_precio     ?? "",
        landing_plan_anual_features:  c.landing_plan_anual_features   ?? "[]",
        // Directorio médico público (/agenda-tu-consulta)
        directorio_color_primario:    c.directorio_color_primario     ?? "#213665",
        directorio_badge_texto:       c.directorio_badge_texto        ?? "",
        directorio_titulo:            c.directorio_titulo             ?? "",
        directorio_subtitulo:         c.directorio_subtitulo          ?? "",
        directorio_badge1_texto:      c.directorio_badge1_texto       ?? "",
        directorio_badge2_texto:      c.directorio_badge2_texto       ?? "",
        directorio_badge3_texto:      c.directorio_badge3_texto       ?? "",
        directorio_cta_badge:         c.directorio_cta_badge          ?? "",
        directorio_cta_titulo:        c.directorio_cta_titulo         ?? "",
        directorio_cta_texto:         c.directorio_cta_texto          ?? "",
        directorio_cta_boton:         c.directorio_cta_boton          ?? "",
      });
    }).catch(() => {});
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const subirLogo = async (file) => {
    if (!file) return;
    setSubiendoLogo(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const r = await api.post("/config-sistema/upload-logo", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLogoPreview(r.data.url);
      setMsg({ ok: true, text: "Logo actualizado correctamente" });
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.msg || "Error al subir logo" });
    } finally {
      setSubiendoLogo(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  const eliminarLogo = async () => {
    try {
      await api.delete("/config-sistema/logo");
      setLogoPreview(null);
      setMsg({ ok: true, text: "Logo eliminado" });
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg({ ok: false, text: "Error al eliminar logo" });
    }
  };

  const guardar = async () => {
    setGuardando(true);
    setMsg(null);
    try {
      await api.put("/config-sistema", form);
      setMsg({ ok: true, text: "Cambios guardados correctamente" });
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.msg || "Error al guardar" });
    } finally {
      setGuardando(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  // Helper: editar lista de features (JSON array de strings)
  const FeaturesEditor = ({ clave }) => {
    if (!form) return null;
    let items = [];
    try { items = JSON.parse(form[clave] || "[]"); } catch { items = []; }

    const update = (idx, val) => {
      const next = [...items]; next[idx] = val;
      set(clave, JSON.stringify(next));
    };
    const add    = () => set(clave, JSON.stringify([...items, ""]));
    const remove = (idx) => set(clave, JSON.stringify(items.filter((_, i) => i !== idx)));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 6 }}>
            <input
              className="form-control form-control-sm"
              value={item}
              onChange={e => update(i, e.target.value)}
              placeholder="Característica..."
            />
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(i)}>
              <i className="bi bi-trash" />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-outline-secondary mt-1" style={{ alignSelf: "flex-start" }} onClick={add}>
          <i className="bi bi-plus-lg me-1" />Agregar
        </button>
      </div>
    );
  };

  if (!form) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
      <div className="spinner-border text-primary" />
    </div>
  );

  return (
    <div style={{ padding: "24px 28px", maxWidth: 860, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 800, color: "#1e293b" }}>
            <i className="bi bi-globe2 me-2" style={{ color: "#3b82f6" }} />
            Página Pública
          </h4>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>
            Edita el contenido de tu landing page pública
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Switch activo/inactivo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 14px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Página activa</span>
            <div
              onClick={() => set("landing_activo", form.landing_activo === "1" ? "0" : "1")}
              style={{
                width: 51, height: 31, borderRadius: 31, cursor: "pointer",
                background: form.landing_activo === "1" ? "#34c759" : "#e5e7eb",
                position: "relative", transition: "background .25s cubic-bezier(.4,0,.2,1)",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
              }}
            >
              <div style={{
                position: "absolute", top: 2,
                left: form.landing_activo === "1" ? 22 : 2,
                width: 27, height: 27, borderRadius: "50%", background: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,.22)",
                transition: "left .25s cubic-bezier(.4,0,.2,1)",
              }} />
            </div>
          </div>
          <a
            href="/inicio"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-primary btn-sm"
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            <i className="bi bi-eye me-1" />Vista previa
          </a>
          <button
            className="btn btn-primary btn-sm"
            onClick={guardar}
            disabled={guardando}
            style={{ borderRadius: 8, fontWeight: 700 }}
          >
            {guardando
              ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</>
              : <><i className="bi bi-floppy-fill me-1" />Guardar</>}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.ok ? "success" : "danger"} py-2 mb-3`} style={{ borderRadius: 10, fontSize: 14 }}>
          <i className={`bi ${msg.ok ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"} me-2`} />
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #e2e8f0", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              border: "none", background: "none", padding: "10px 18px",
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? "#3b82f6" : "#64748b",
              borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
              marginBottom: -2, cursor: "pointer", fontSize: 14,
              display: "flex", alignItems: "center", gap: 7,
              transition: "color .15s",
            }}
          >
            <i className={`bi ${t.icon}`} />{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: HERO ── */}
      {tab === "hero" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="row g-3">

            {/* ── Logo ── */}
            <div className="col-12">
              <label className="form-label fw-bold">
                <i className="bi bi-image-fill me-1" />Logo de la página
              </label>
              <div style={{
                display: "flex", alignItems: "center", gap: 20,
                background: "#f8fafc", border: "2px dashed #e2e8f0",
                borderRadius: 16, padding: "20px 24px",
              }}>
                {/* Preview actual */}
                <div style={{
                  width: 110, height: 110, borderRadius: 14, flexShrink: 0,
                  background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid #334155", overflow: "hidden",
                }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
                    : <i className="bi bi-image" style={{ fontSize: 32, color: "#475569" }} />}
                </div>

                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, color: "#1e293b", marginBottom: 6, fontSize: 14 }}>
                    {logoPreview ? "Logo actual" : "Sin logo configurado"}
                  </p>
                  <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
                    Formatos: PNG, JPG, SVG. Recomendado: fondo transparente (PNG).
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={e => subirLogo(e.target.files[0])}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={subiendoLogo}
                      style={{ borderRadius: 8, fontWeight: 600 }}
                    >
                      {subiendoLogo
                        ? <><span className="spinner-border spinner-border-sm me-1" />Subiendo...</>
                        : <><i className="bi bi-upload me-1" />{logoPreview ? "Cambiar logo" : "Subir logo"}</>}
                    </button>
                    {logoPreview && (
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={eliminarLogo}
                        style={{ borderRadius: 8, fontWeight: 600 }}
                      >
                        <i className="bi bi-trash me-1" />Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Color de la landing */}
            <div className="col-12">
              <label className="form-label fw-bold">
                <i className="bi bi-palette-fill me-1" />Color principal de la landing
              </label>

              {/* Paletas predefinidas */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                  Paletas profesionales
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                  {[
                    {
                      name: "Azul Marino",
                      color: "#0E1F3C",
                      preview: ["#0E1F3C", "#1e3a5f", "#3b82f6"],
                      desc: "Clásico y profesional",
                    },
                    {
                      name: "Verde Salud",
                      color: "#064e3b",
                      preview: ["#064e3b", "#065f46", "#10b981"],
                      desc: "Vitalidad y bienestar",
                    },
                    {
                      name: "Violeta Premium",
                      color: "#3b0764",
                      preview: ["#3b0764", "#581c87", "#8b5cf6"],
                      desc: "Elegante y moderno",
                    },
                    {
                      name: "Azul Acero",
                      color: "#0c4a6e",
                      preview: ["#0c4a6e", "#075985", "#0ea5e9"],
                      desc: "Tecnología y confianza",
                    },
                  ].map(p => (
                    <button
                      key={p.name} type="button"
                      onClick={() => set("landing_color_primario", p.color)}
                      style={{
                        border: form.landing_color_primario === p.color ? "2px solid #3b82f6" : "2px solid #e2e8f0",
                        borderRadius: 12, background: "#fff", cursor: "pointer",
                        padding: "10px 12px", textAlign: "left",
                        boxShadow: form.landing_color_primario === p.color ? "0 0 0 3px rgba(59,130,246,.2)" : "none",
                        transition: "border-color .15s, box-shadow .15s",
                      }}
                    >
                      <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                        {p.preview.map(c => (
                          <div key={c} style={{ flex: 1, height: 22, borderRadius: 6, background: c }} />
                        ))}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color personalizado */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="color"
                  value={form.landing_color_primario}
                  onChange={e => set("landing_color_primario", e.target.value)}
                  style={{ width: 44, height: 38, border: "none", borderRadius: 8, cursor: "pointer", padding: 2 }}
                />
                <input
                  className="form-control"
                  style={{ fontFamily: "monospace", maxWidth: 130 }}
                  value={form.landing_color_primario}
                  onChange={e => set("landing_color_primario", e.target.value)}
                  placeholder="#0E1F3C"
                />
                <div style={{
                  flex: 1, minWidth: 120, height: 38, borderRadius: 10,
                  background: `linear-gradient(135deg, ${form.landing_color_primario} 0%, #000 100%)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,.2)",
                }}>
                  <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, opacity: .9, letterSpacing: ".5px" }}>
                    Vista previa
                  </span>
                </div>
              </div>
            </div>

            <div className="col-12">
              <label className="form-label fw-bold">Tagline principal</label>
              <input
                className="form-control"
                value={form.landing_tagline}
                onChange={e => set("landing_tagline", e.target.value)}
                placeholder="Ej: Gestión clínica moderna y eficiente"
              />
              <div className="form-text">Frase corta que aparece como título en el hero.</div>
            </div>
            <div className="col-12">
              <label className="form-label fw-bold">Descripción del sistema</label>
              <textarea
                className="form-control"
                rows={3}
                value={form.landing_descripcion}
                onChange={e => set("landing_descripcion", e.target.value)}
                placeholder="Describe brevemente qué hace tu sistema..."
              />
            </div>
          </div>

          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 6px" }}>
              <i className="bi bi-info-circle me-1" />
              El <strong>color de fondo</strong> del hero y el <strong>logo</strong> se toman desde
              <a href="/superadmin/personalizacion" className="ms-1">Personalización</a>.
            </p>
          </div>
        </div>
      )}

      {/* ── TAB: PLANES ── */}
      {tab === "planes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {[
            { key: "trial",     label: "Plan Trial",     icon: "bi-clock-history",   color: "#f59e0b" },
            { key: "semestral", label: "Plan Semestral", icon: "bi-calendar2-check",  color: "#3b82f6" },
            { key: "anual",     label: "Plan Anual",     icon: "bi-award-fill",       color: "#10b981" },
          ].map(plan => (
            <div key={plan.key} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${plan.color}18`, border: `1px solid ${plan.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className={`bi ${plan.icon}`} style={{ color: plan.color, fontSize: 16 }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{plan.label}</span>
              </div>
              <div className="row g-3">
                <div className="col-sm-6">
                  <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Precio</label>
                  <input
                    className="form-control form-control-sm"
                    value={form[`landing_plan_${plan.key}_precio`]}
                    onChange={e => set(`landing_plan_${plan.key}_precio`, e.target.value)}
                    placeholder={plan.key === "trial" ? "Gratis" : "Ej: $99/mes"}
                  />
                </div>
                {plan.key === "trial" && (
                  <div className="col-sm-6">
                    <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Duración</label>
                    <input
                      className="form-control form-control-sm"
                      value={form.landing_plan_trial_duracion}
                      onChange={e => set("landing_plan_trial_duracion", e.target.value)}
                      placeholder="Ej: 30 días"
                    />
                  </div>
                )}
                <div className="col-12">
                  <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Características incluidas</label>
                  <FeaturesEditor clave={`landing_plan_${plan.key}_features`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: NOSOTROS ── */}
      {tab === "nosotros" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label className="form-label fw-bold">Texto "Sobre nosotros"</label>
            <textarea
              className="form-control"
              rows={5}
              value={form.landing_nosotros_texto}
              onChange={e => set("landing_nosotros_texto", e.target.value)}
              placeholder="Describe quiénes son, la misión del sistema, el equipo..."
            />
          </div>
        </div>
      )}

      {/* ── TAB: CONTACTO ── */}
      {tab === "contacto" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="row g-3">
            <div className="col-sm-6">
              <label className="form-label fw-bold"><i className="bi bi-whatsapp me-1 text-success" />WhatsApp</label>
              <input
                className="form-control"
                value={form.landing_whatsapp}
                onChange={e => set("landing_whatsapp", e.target.value)}
                placeholder="+50498765432"
              />
              <div className="form-text">Incluye el código de país.</div>
            </div>
            <div className="col-sm-6">
              <label className="form-label fw-bold"><i className="bi bi-envelope-fill me-1" style={{ color: "#ef4444" }} />Email de contacto</label>
              <input
                className="form-control"
                type="email"
                value={form.landing_email_contacto}
                onChange={e => set("landing_email_contacto", e.target.value)}
                placeholder="contacto@medickg.com"
              />
            </div>
            <div className="col-sm-4">
              <label className="form-label fw-bold"><i className="bi bi-instagram me-1" style={{ color: "#e1306c" }} />Instagram</label>
              <input
                className="form-control"
                value={form.landing_instagram}
                onChange={e => set("landing_instagram", e.target.value)}
                placeholder="@usuario o URL"
              />
            </div>
            <div className="col-sm-4">
              <label className="form-label fw-bold"><i className="bi bi-facebook me-1" style={{ color: "#1877f2" }} />Facebook</label>
              <input
                className="form-control"
                value={form.landing_facebook}
                onChange={e => set("landing_facebook", e.target.value)}
                placeholder="URL de tu página"
              />
            </div>
            <div className="col-sm-4">
              <label className="form-label fw-bold"><i className="bi bi-tiktok me-1" />TikTok</label>
              <input
                className="form-control"
                value={form.landing_tiktok}
                onChange={e => set("landing_tiktok", e.target.value)}
                placeholder="@usuario o URL"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: DIRECTORIO ── */}
      {tab === "directorio" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              <i className="bi bi-info-circle me-1" />
              Esto edita el <strong>directorio público de médicos</strong> (<code>/agenda-tu-consulta</code>),
              donde los pacientes buscan y comparan especialistas.
            </p>
          </div>

          {/* Color */}
          <div>
            <label className="form-label fw-bold">
              <i className="bi bi-palette-fill me-1" />Color principal del directorio
            </label>
            <div className="form-text mb-2">
              Se usa en el fondo del encabezado, el botón "Agendar cita" de las tarjetas (cuando la clínica
              no definió su propio color) y el banner final para médicos.
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="color"
                value={form.directorio_color_primario}
                onChange={e => set("directorio_color_primario", e.target.value)}
                style={{ width: 44, height: 38, border: "none", borderRadius: 8, cursor: "pointer", padding: 2 }}
              />
              <input
                className="form-control"
                style={{ fontFamily: "monospace", maxWidth: 130 }}
                value={form.directorio_color_primario}
                onChange={e => set("directorio_color_primario", e.target.value)}
                placeholder="#213665"
              />
              <div style={{
                flex: 1, minWidth: 120, height: 38, borderRadius: 10,
                background: `linear-gradient(135deg, ${form.directorio_color_primario} 0%, #000 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,.2)",
              }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, opacity: .9, letterSpacing: ".5px" }}>
                  Vista previa
                </span>
              </div>
            </div>
          </div>

          {/* Encabezado */}
          <div className="row g-3">
            <div className="col-sm-6">
              <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Texto del badge superior</label>
              <input
                className="form-control form-control-sm"
                value={form.directorio_badge_texto}
                onChange={e => set("directorio_badge_texto", e.target.value)}
                placeholder="Directorio médico"
              />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Título</label>
              <input
                className="form-control"
                value={form.directorio_titulo}
                onChange={e => set("directorio_titulo", e.target.value)}
                placeholder="Agenda tu consulta médica"
              />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Subtítulo</label>
              <textarea
                className="form-control"
                rows={2}
                value={form.directorio_subtitulo}
                onChange={e => set("directorio_subtitulo", e.target.value)}
                placeholder="Los mejores médicos y especialistas los encuentras aquí..."
              />
            </div>
          </div>

          {/* Franja de confianza */}
          <div>
            <label className="form-label fw-bold">
              <i className="bi bi-patch-check-fill me-1" />Franja de confianza
            </label>
            <div className="form-text mb-2">Tres frases cortas debajo del subtítulo. Deja una vacía para ocultarla.</div>
            <div className="row g-2">
              {[1, 2, 3].map(n => (
                <div className="col-sm-4" key={n}>
                  <input
                    className="form-control form-control-sm"
                    value={form[`directorio_badge${n}_texto`]}
                    onChange={e => set(`directorio_badge${n}_texto`, e.target.value)}
                    placeholder={`Frase ${n}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Banner CTA médicos */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "#3b82f618", border: "1px solid #3b82f640",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-stethoscope" style={{ color: "#3b82f6", fontSize: 16 }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>
                Banner "Para médicos y especialistas"
              </span>
            </div>
            <div className="row g-3">
              <div className="col-sm-6">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Texto del badge</label>
                <input
                  className="form-control form-control-sm"
                  value={form.directorio_cta_badge}
                  onChange={e => set("directorio_cta_badge", e.target.value)}
                  placeholder="Para médicos y especialistas"
                />
              </div>
              <div className="col-sm-6">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Texto del botón</label>
                <input
                  className="form-control form-control-sm"
                  value={form.directorio_cta_boton}
                  onChange={e => set("directorio_cta_boton", e.target.value)}
                  placeholder="Quiero unirme"
                />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Título</label>
                <input
                  className="form-control form-control-sm"
                  value={form.directorio_cta_titulo}
                  onChange={e => set("directorio_cta_titulo", e.target.value)}
                  placeholder="Haz crecer tu consulta con nosotros"
                />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold" style={{ fontSize: 13 }}>Descripción</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  value={form.directorio_cta_texto}
                  onChange={e => set("directorio_cta_texto", e.target.value)}
                  placeholder="Súmate a nuestro directorio y deja que nuevos pacientes te encuentren..."
                />
              </div>
            </div>
            <div className="form-text mt-2">
              El botón lleva al usuario a la página de inicio, donde están los planes y el contacto para unirse.
            </div>
          </div>

          <a
            href="/agenda-tu-consulta"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-primary btn-sm"
            style={{ borderRadius: 8, fontWeight: 600, alignSelf: "flex-start" }}
          >
            <i className="bi bi-eye me-1" />Ver directorio público
          </a>
        </div>
      )}

      {/* Botón guardar inferior */}
      <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <a href="/inicio" target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary" style={{ borderRadius: 8 }}>
          <i className="bi bi-eye me-1" />Ver página pública
        </a>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando} style={{ borderRadius: 8, fontWeight: 700, minWidth: 130 }}>
          {guardando
            ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</>
            : <><i className="bi bi-floppy-fill me-1" />Guardar cambios</>}
        </button>
      </div>
    </div>
  );
}
