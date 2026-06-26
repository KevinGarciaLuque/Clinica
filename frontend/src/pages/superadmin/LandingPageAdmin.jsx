import { useState, useEffect } from "react";
import api from "../../api/api";

const TABS = [
  { id: "hero",     label: "Hero",      icon: "bi-house-heart-fill" },
  { id: "planes",   label: "Planes",    icon: "bi-tags-fill" },
  { id: "nosotros", label: "Nosotros",  icon: "bi-people-fill" },
  { id: "contacto", label: "Contacto",  icon: "bi-chat-dots-fill" },
];

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function LandingPageAdmin() {
  const [tab,       setTab]       = useState("hero");
  const [form,      setForm]      = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg,       setMsg]       = useState(null);

  useEffect(() => {
    api.get("/config-sistema").then(r => {
      const c = r.data.config || {};
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
      });
    }).catch(() => {});
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

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
            {/* Color de la landing */}
            <div className="col-12">
              <label className="form-label fw-bold">
                <i className="bi bi-palette-fill me-1" />Color principal de la landing
              </label>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="color"
                  value={form.landing_color_primario}
                  onChange={e => set("landing_color_primario", e.target.value)}
                  style={{ width: 44, height: 38, border: "none", borderRadius: 8, cursor: "pointer", padding: 2 }}
                />
                <input
                  className="form-control"
                  style={{ fontFamily: "monospace", maxWidth: 120 }}
                  value={form.landing_color_primario}
                  onChange={e => set("landing_color_primario", e.target.value)}
                  placeholder="#0E1F3C"
                />
                <div style={{ display: "flex", gap: 6 }}>
                  {["#0E1F3C","#1e3a5f","#213665","#1a1a2e","#0f172a","#18181b"].map(c => (
                    <button
                      key={c} type="button"
                      onClick={() => set("landing_color_primario", c)}
                      title={c}
                      style={{
                        width: 26, height: 26, borderRadius: 6, border: form.landing_color_primario === c ? "3px solid #111" : "2px solid #e2e8f0",
                        background: c, cursor: "pointer", flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
                {/* Preview */}
                <div style={{
                  width: 90, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, ${form.landing_color_primario}, #000)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, opacity: .85 }}>Vista previa</span>
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
