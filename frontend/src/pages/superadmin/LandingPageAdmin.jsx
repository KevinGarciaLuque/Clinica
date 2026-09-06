import { useState, useEffect, useRef } from "react";
import api from "../../api/api";
import { MONEDAS } from "../../utils/monedas";

const TABS = [
  { id: "hero",       label: "Hero",       icon: "bi-house-heart-fill" },
  { id: "planes",     label: "Planes",     icon: "bi-tags-fill" },
  { id: "nosotros",   label: "Nosotros",   icon: "bi-people-fill" },
  { id: "contacto",   label: "Contacto",   icon: "bi-chat-dots-fill" },
  { id: "directorio", label: "Directorio", icon: "bi-hospital-fill" },
  { id: "milink",     label: "Mi Link",    icon: "bi-link-45deg" },
  { id: "correo",     label: "Correo",     icon: "bi-envelope-fill" },
  { id: "pagos",      label: "Pagos",      icon: "bi-credit-card-fill" },
];

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function LandingPageAdmin() {
  const [tab,           setTab]           = useState("hero");
  const [form,          setForm]          = useState(null);
  const [logoPreview,   setLogoPreview]   = useState(null);
  const [subiendoLogo,  setSubiendoLogo]  = useState(false);
  const logoInputRef = useRef();
  const [linksFotoPreview,  setLinksFotoPreview]  = useState(null);
  const [subiendoLinksFoto, setSubiendoLinksFoto] = useState(false);
  const linksFotoInputRef = useRef();
  const [copiado, setCopiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg,       setMsg]       = useState(null);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    api.get("/config-sistema").then(r => {
      const c = r.data.data || {};
      if (c.logo_url) setLogoPreview(
        c.logo_url.startsWith("data:") || c.logo_url.startsWith("http")
          ? c.logo_url
          : `${API_URL}${c.logo_url}`
      );
      if (c.links_foto_url) setLinksFotoPreview(
        c.links_foto_url.startsWith("data:") || c.links_foto_url.startsWith("http")
          ? c.links_foto_url
          : `${API_URL}${c.links_foto_url}`
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
        landing_youtube:              c.landing_youtube               ?? "",
        landing_linkedin:             c.landing_linkedin              ?? "",
        landing_plan_trial_features:  c.landing_plan_trial_features   ?? "[]",
        landing_plan_semestral_features:  c.landing_plan_semestral_features   ?? "[]",
        landing_plan_anual_features:  c.landing_plan_anual_features   ?? "[]",
        // Directorio médico público (/agenda-tu-consulta)
        directorio_color_primario:    c.directorio_color_primario     ?? "#213665",
        directorio_color_tarjetas:    c.directorio_color_tarjetas     ?? "#213665",
        directorio_color_franja:      c.directorio_color_franja       ?? "#eef2f7",
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
        // Mi Link (/links)
        links_nombre:                 c.links_nombre                  ?? "",
        links_bio:                    c.links_bio                     ?? "",
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

  const subirLinksFoto = async (file) => {
    if (!file) return;
    setSubiendoLinksFoto(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const r = await api.post("/config-sistema/upload-links-foto", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLinksFotoPreview(r.data.url);
      setMsg({ ok: true, text: "Foto actualizada correctamente" });
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.msg || "Error al subir foto" });
    } finally {
      setSubiendoLinksFoto(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  const eliminarLinksFoto = async () => {
    try {
      await api.delete("/config-sistema/links-foto");
      setLinksFotoPreview(null);
      setMsg({ ok: true, text: "Foto eliminada" });
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg({ ok: false, text: "Error al eliminar foto" });
    }
  };

  const guardar = async () => {
    setGuardando(true);
    setMsg(null);
    try {
      await api.put("/config-sistema", form);
      setMsg({ ok: true, text: "Cambios guardados correctamente" });
      setPreviewKey(k => k + 1);
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

  const previewUrl = tab === "correo" ? null : tab === "milink" ? "/links" : tab === "pagos" ? "/solicitar-plan" : "/inicio";

  return (
    <div style={{ padding: "24px clamp(16px, 3vw, 40px)", maxWidth: 1600, margin: "0 auto", width: "100%" }}>

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
      <div style={{
        display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #e2e8f0", paddingBottom: 0,
        overflowX: "auto", overflowY: "hidden", flexWrap: "nowrap", scrollbarWidth: "thin",
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              border: "none", background: "none", padding: "10px 16px",
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? "#3b82f6" : "#64748b",
              borderBottom: tab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
              marginBottom: -2, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap", flexShrink: 0,
              display: "flex", alignItems: "center", gap: 7,
              transition: "color .15s",
            }}
          >
            <i className={`bi ${t.icon}`} />{t.label}
          </button>
        ))}
      </div>

      <div className="row g-4">
      <div className={previewUrl ? "col-12 col-xl-8" : "col-12"} style={{ minWidth: 0 }}>

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
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              <i className="bi bi-info-circle me-1" />
              El <strong>precio</strong> de cada plan se define en la pestaña <strong>Pagos</strong> (Semestral / Anual).
              Aquí solo se editan las características que se muestran en cada tarjeta.
            </p>
          </div>
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
            <div className="col-sm-4">
              <label className="form-label fw-bold"><i className="bi bi-youtube me-1" style={{ color: "#ff0000" }} />YouTube</label>
              <input
                className="form-control"
                value={form.landing_youtube}
                onChange={e => set("landing_youtube", e.target.value)}
                placeholder="URL de tu canal"
              />
            </div>
            <div className="col-sm-4">
              <label className="form-label fw-bold"><i className="bi bi-linkedin me-1" style={{ color: "#0a66c2" }} />LinkedIn</label>
              <input
                className="form-control"
                value={form.landing_linkedin}
                onChange={e => set("landing_linkedin", e.target.value)}
                placeholder="URL de tu perfil o página"
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

          {/* Colores */}
          <div className="row g-3">
            <div className="col-sm-6">
              <label className="form-label fw-bold">
                <i className="bi bi-palette-fill me-1" />Color del encabezado y banner
              </label>
              <div className="form-text mb-2">
                Fondo del encabezado superior y del banner final "Para médicos y especialistas".
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
                  flex: 1, minWidth: 90, height: 38, borderRadius: 10,
                  background: `linear-gradient(135deg, ${form.directorio_color_primario} 0%, #000 100%)`,
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,.2)",
                }} />
              </div>
            </div>

            <div className="col-sm-6">
              <label className="form-label fw-bold">
                <i className="bi bi-card-heading me-1" />Color de las tarjetas
              </label>
              <div className="form-text mb-2">
                Franja superior, título de especialidad y botón "Agendar cita" — solo para clínicas que no
                definieron su propio color en Configuración.
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="color"
                  value={form.directorio_color_tarjetas}
                  onChange={e => set("directorio_color_tarjetas", e.target.value)}
                  style={{ width: 44, height: 38, border: "none", borderRadius: 8, cursor: "pointer", padding: 2 }}
                />
                <input
                  className="form-control"
                  style={{ fontFamily: "monospace", maxWidth: 130 }}
                  value={form.directorio_color_tarjetas}
                  onChange={e => set("directorio_color_tarjetas", e.target.value)}
                  placeholder="#213665"
                />
                <div style={{
                  flex: 1, minWidth: 90, height: 38, borderRadius: 10,
                  background: `linear-gradient(135deg, ${form.directorio_color_tarjetas} 0%, #000 100%)`,
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,.2)",
                }} />
              </div>
            </div>

            <div className="col-sm-6">
              <label className="form-label fw-bold">
                <i className="bi bi-collection me-1" />Color de la franja de la tarjeta
              </label>
              <div className="form-text mb-2">
                La banda de color detrás de la foto del médico, en las tarjetas del directorio. Igual para todas.
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="color"
                  value={form.directorio_color_franja}
                  onChange={e => set("directorio_color_franja", e.target.value)}
                  style={{ width: 44, height: 38, border: "none", borderRadius: 8, cursor: "pointer", padding: 2 }}
                />
                <input
                  className="form-control"
                  style={{ fontFamily: "monospace", maxWidth: 130 }}
                  value={form.directorio_color_franja}
                  onChange={e => set("directorio_color_franja", e.target.value)}
                  placeholder="#eef2f7"
                />
                <div style={{
                  flex: 1, minWidth: 90, height: 38, borderRadius: 10,
                  background: form.directorio_color_franja,
                  border: "1px solid #e2e8f0",
                }} />
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

      {/* ── TAB: MI LINK ── */}
      {tab === "milink" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              <i className="bi bi-info-circle me-1" />
              Un único enlace público (<code>/links</code>) con todas tus redes sociales, estilo
              "link en bio". Las redes que se muestran son las configuradas en la pestaña <strong>Contacto</strong>.
            </p>
          </div>

          {/* URL para compartir */}
          <div>
            <label className="form-label fw-bold"><i className="bi bi-share-fill me-1" />Tu link para compartir</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                className="form-control"
                readOnly
                value={`${window.location.origin}/links`}
                style={{ background: "#f8fafc", fontWeight: 600 }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ borderRadius: 8, fontWeight: 600, whiteSpace: "nowrap" }}
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/links`);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
              >
                <i className={`bi ${copiado ? "bi-check2" : "bi-clipboard"} me-1`} />{copiado ? "Copiado" : "Copiar"}
              </button>
              <a
                href="/links"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline-primary btn-sm"
                style={{ borderRadius: 8, fontWeight: 600, whiteSpace: "nowrap" }}
              >
                <i className="bi bi-eye me-1" />Ver
              </a>
            </div>
          </div>

          {/* Foto de perfil */}
          <div>
            <label className="form-label fw-bold">
              <i className="bi bi-person-circle me-1" />Foto de perfil
            </label>
            <div style={{
              display: "flex", alignItems: "center", gap: 20,
              background: "#f8fafc", border: "2px dashed #e2e8f0",
              borderRadius: 16, padding: "20px 24px",
            }}>
              <div style={{
                width: 90, height: 90, borderRadius: "50%", flexShrink: 0,
                background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid #334155", overflow: "hidden",
              }}>
                {linksFotoPreview
                  ? <img src={linksFotoPreview} alt="foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <i className="bi bi-person" style={{ fontSize: 32, color: "#475569" }} />}
              </div>

              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: "#1e293b", marginBottom: 6, fontSize: 14 }}>
                  {linksFotoPreview ? "Foto actual" : "Sin foto configurada"}
                </p>
                <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
                  Se recomienda una imagen cuadrada (mín. 300x300px).
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    ref={linksFotoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => subirLinksFoto(e.target.files[0])}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => linksFotoInputRef.current?.click()}
                    disabled={subiendoLinksFoto}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                  >
                    {subiendoLinksFoto
                      ? <><span className="spinner-border spinner-border-sm me-1" />Subiendo...</>
                      : <><i className="bi bi-upload me-1" />{linksFotoPreview ? "Cambiar foto" : "Subir foto"}</>}
                  </button>
                  {linksFotoPreview && (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={eliminarLinksFoto}
                      style={{ borderRadius: 8, fontWeight: 600 }}
                    >
                      <i className="bi bi-trash me-1" />Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-sm-6">
              <label className="form-label fw-bold">Nombre a mostrar</label>
              <input
                className="form-control"
                value={form.links_nombre}
                onChange={e => set("links_nombre", e.target.value)}
                placeholder="Medic-KG"
              />
            </div>
            <div className="col-12">
              <label className="form-label fw-bold">Bio / descripción corta</label>
              <input
                className="form-control"
                value={form.links_bio}
                onChange={e => set("links_bio", e.target.value)}
                placeholder="Todos mis enlaces en un solo lugar 👇"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CORREO (SMTP) ── */}
      {tab === "correo" && <TabCorreoSmtp />}

      {/* ── TAB: PAGOS (cuenta bancaria + precios) ── */}
      {tab === "pagos" && <TabPagos />}

      {/* Botón guardar inferior — no aplica a las pestañas con guardado propio */}
      {tab !== "correo" && tab !== "pagos" && (
        <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <a href={tab === "milink" ? "/links" : "/inicio"} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary" style={{ borderRadius: 8 }}>
            <i className="bi bi-eye me-1" />{tab === "milink" ? "Ver mi link" : "Ver página pública"}
          </a>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando} style={{ borderRadius: 8, fontWeight: 700, minWidth: 130 }}>
            {guardando
              ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</>
              : <><i className="bi bi-floppy-fill me-1" />Guardar cambios</>}
          </button>
        </div>
      )}

      </div>

      {/* ── Panel derecho: vista previa en vivo (solo pantallas grandes) ── */}
      {previewUrl && (
        <div className="col-12 col-xl-4 d-none d-xl-block">
          <div style={{ position: "sticky", top: 20, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.06)" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <i className="bi bi-eye me-2" />Vista previa en vivo
              </span>
              <button
                onClick={() => setPreviewKey(k => k + 1)}
                title="Actualizar vista previa"
                style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}
              >
                <i className="bi bi-arrow-clockwise" />
              </button>
            </div>
            <iframe
              key={previewKey}
              src={previewUrl}
              title="Vista previa"
              style={{ width: "100%", height: "calc(100vh - 220px)", minHeight: 480, border: "none", display: "block" }}
            />
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

// ── TAB: Correo saliente (SMTP) ──────────────────────────────────────────
function TabCorreoSmtp() {
  const [form, setForm] = useState({
    smtp_host: "", smtp_port: 587, smtp_secure: false,
    smtp_user: "", smtp_pass: "", email_from: "",
  });
  const [tienePassword, setTienePassword] = useState(false);
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando]   = useState(false);
  const [correoPrueba, setCorreoPrueba] = useState("");
  const [msg, setMsg] = useState(null); // { ok, text }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    api.get("/config-sistema/smtp")
      .then(r => {
        const d = r.data.data;
        setForm(p => ({
          ...p,
          smtp_host: d.smtp_host, smtp_port: d.smtp_port, smtp_secure: d.smtp_secure,
          smtp_user: d.smtp_user, email_from: d.email_from,
        }));
        setTienePassword(d.tiene_password);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setMsg(null);
    try {
      await api.put("/config-sistema/smtp", form);
      if (form.smtp_pass) setTienePassword(true);
      setForm(p => ({ ...p, smtp_pass: "" }));
      setMsg({ ok: true, text: "Configuración de correo guardada correctamente" });
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.msg || "Error al guardar" });
    } finally {
      setGuardando(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  const probar = async () => {
    if (!correoPrueba) return;
    setProbando(true);
    setMsg(null);
    try {
      const r = await api.post("/config-sistema/smtp/probar", { destino: correoPrueba });
      setMsg({
        ok: !r.data.simulado,
        text: r.data.simulado ? r.data.msg : `Correo de prueba enviado a ${correoPrueba}`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.msg || "No se pudo enviar el correo de prueba" });
    } finally {
      setProbando(false);
    }
  };

  if (cargando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{
        background: "#f8fafc", border: "1px solid #e2e8f0",
        borderRadius: 14, padding: "18px 22px",
      }}>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          <i className="bi bi-info-circle me-1" />
          La cuenta de correo que usa el sistema para enviar notificaciones: verificación de pacientes,
          credenciales de nuevas clínicas, recibos, recordatorios, etc.
        </p>
      </div>

      {msg && (
        <div className={`alert alert-${msg.ok ? "success" : "danger"} py-2 mb-0`} style={{ borderRadius: 10, fontSize: 14 }}>
          <i className={`bi ${msg.ok ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"} me-2`} />
          {msg.text}
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-8">
          <label className="form-label fw-bold">Servidor SMTP</label>
          <input className="form-control" value={form.smtp_host}
                 onChange={e => set("smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold">Puerto</label>
          <input type="number" className="form-control" value={form.smtp_port}
                 onChange={e => set("smtp_port", e.target.value)} placeholder="587" />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-bold">Correo de la cuenta</label>
          <input type="email" className="form-control" value={form.smtp_user}
                 onChange={e => set("smtp_user", e.target.value)} placeholder="soporte.medickg@gmail.com" />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-bold">
            Contraseña {tienePassword && <span className="text-success" style={{ fontSize: 12, fontWeight: 500 }}>(ya configurada)</span>}
          </label>
          <input type="password" className="form-control" value={form.smtp_pass}
                 onChange={e => set("smtp_pass", e.target.value)}
                 placeholder={tienePassword ? "••••••••  (déjala en blanco para no cambiarla)" : "Contraseña de aplicación"} />
        </div>
        <div className="col-12">
          <label className="form-label fw-bold">Remitente que verá el destinatario</label>
          <input className="form-control" value={form.email_from}
                 onChange={e => set("email_from", e.target.value)}
                 placeholder='"Medic-KG" <soporte.medickg@gmail.com>' />
        </div>
        <div className="col-12">
          <div className="form-check">
            <input type="checkbox" className="form-check-input" id="smtpSecure" checked={form.smtp_secure}
                   onChange={e => set("smtp_secure", e.target.checked)} />
            <label className="form-check-label" htmlFor="smtpSecure">Usar conexión segura (puerto 465)</label>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div className="d-flex gap-2 align-items-center">
          <input
            type="email" className="form-control form-control-sm" style={{ width: 240 }}
            placeholder="Enviar correo de prueba a..."
            value={correoPrueba} onChange={e => setCorreoPrueba(e.target.value)}
          />
          <button onClick={probar} disabled={probando || !correoPrueba} className="btn btn-outline-secondary btn-sm">
            {probando ? "Enviando..." : "Enviar prueba"}
          </button>
        </div>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando} style={{ borderRadius: 8, fontWeight: 700, minWidth: 130 }}>
          {guardando
            ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</>
            : <><i className="bi bi-floppy-fill me-1" />Guardar correo</>}
        </button>
      </div>
    </div>
  );
}

const NIVELES_PRECIO = [
  { id: "basico",      label: "Básico" },
  { id: "avanzado",    label: "Avanzado" },
  { id: "empresarial", label: "Empresarial" },
];

// ── TAB: Pagos (cuenta bancaria + precios por plan) ──────────────────────
function TabPagos() {
  const [form, setForm] = useState({
    banco: "", titular: "", numero_cuenta: "", numero_cci: "", moneda: "HNL",
    precio_basico_semestral: "", precio_basico_anual: "",
    precio_avanzado_semestral: "", precio_avanzado_anual: "",
    precio_empresarial_semestral: "", precio_empresarial_anual: "",
  });
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    api.get("/config-sistema/pagos")
      .then(r => {
        const d = r.data.data;
        setForm(p => {
          const next = { ...p, banco: d.banco, titular: d.titular, numero_cuenta: d.numero_cuenta, numero_cci: d.numero_cci, moneda: d.moneda };
          for (const n of NIVELES_PRECIO) {
            next[`precio_${n.id}_semestral`] = d[`precio_${n.id}_semestral`] ?? "";
            next[`precio_${n.id}_anual`]     = d[`precio_${n.id}_anual`] ?? "";
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setMsg(null);
    try {
      await api.put("/config-sistema/pagos", form);
      setMsg({ ok: true, text: "Configuración de pagos guardada correctamente" });
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.msg || "Error al guardar" });
    } finally {
      setGuardando(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  if (cargando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 22px" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          <i className="bi bi-info-circle me-1" />
          Esta cuenta bancaria y estos precios son los que ve el médico en <strong>/solicitar-plan</strong>
          al pedir un plan y transferir el pago.
        </p>
      </div>

      {msg && (
        <div className={`alert alert-${msg.ok ? "success" : "danger"} py-2 mb-0`} style={{ borderRadius: 10, fontSize: 14 }}>
          <i className={`bi ${msg.ok ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"} me-2`} />
          {msg.text}
        </div>
      )}

      <div>
        <h6 className="fw-bold mb-3"><i className="bi bi-bank me-2" />Cuenta bancaria</h6>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label fw-bold">Banco</label>
            <input className="form-control" value={form.banco}
                   onChange={e => set("banco", e.target.value)} placeholder="BBVA" />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-bold">Titular de la cuenta</label>
            <input className="form-control" value={form.titular}
                   onChange={e => set("titular", e.target.value)} placeholder="Medic-KG S.A.C." />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-bold">Número de cuenta</label>
            <input className="form-control" value={form.numero_cuenta}
                   onChange={e => set("numero_cuenta", e.target.value)} placeholder="0011-0000-0000000000" />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-bold">Cuenta interbancaria (CCI / opcional)</label>
            <input className="form-control" value={form.numero_cci}
                   onChange={e => set("numero_cci", e.target.value)} placeholder="00200011000000000000" />
          </div>
        </div>
      </div>

      <div>
        <h6 className="fw-bold mb-3"><i className="bi bi-cash-coin me-2" />Precios por plan</h6>
        <div className="row g-3 mb-3">
          <div className="col-md-3">
            <label className="form-label fw-bold">Moneda</label>
            <select className="form-select" value={form.moneda} onChange={e => set("moneda", e.target.value)}>
              {MONEDAS.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <p className="small text-muted mb-3">
          El <strong>Básico</strong> también ofrece 15 días de prueba gratis (no requiere precio).
        </p>
        {NIVELES_PRECIO.map(n => (
          <div key={n.id} className="row g-3 align-items-end mb-2">
            <div className="col-md-3">
              <span className="badge bg-secondary-subtle text-secondary-emphasis">{n.label}</span>
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-bold">Semestral</label>
              <input type="number" step="0.01" className="form-control" value={form[`precio_${n.id}_semestral`]}
                     onChange={e => set(`precio_${n.id}_semestral`, e.target.value)} placeholder="0.00" />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-bold">Anual</label>
              <input type="number" step="0.01" className="form-control" value={form[`precio_${n.id}_anual`]}
                     onChange={e => set(`precio_${n.id}_anual`, e.target.value)} placeholder="0.00" />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando} style={{ borderRadius: 8, fontWeight: 700, minWidth: 130 }}>
          {guardando
            ? <><span className="spinner-border spinner-border-sm me-1" />Guardando...</>
            : <><i className="bi bi-floppy-fill me-1" />Guardar pagos</>}
        </button>
      </div>
    </div>
  );
}
