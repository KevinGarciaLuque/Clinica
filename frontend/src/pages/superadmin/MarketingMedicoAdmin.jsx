/**
 * Panel SUPER_ADMIN — Marketing Médico
 * URL: /superadmin/marketing-medico
 * Gestiona los textos de la sección y los items (posts, videos, planes)
 * que se muestran en /marketing-medico y en el bloque del inicio.
 */
import { useEffect, useState } from "react";
import api from "../../api/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const mediaUrl = (u) => (!u ? "" : u.startsWith("http") || u.startsWith("data:") ? u : `${API_URL}${u}`);

const TIPOS = [
  { id: "post",  label: "Ejemplos / Posts", icon: "bi-images" },
  { id: "video", label: "Videos de doctores", icon: "bi-play-btn" },
  { id: "plan",  label: "Planes de marketing", icon: "bi-tags" },
];

const emptyItem = (tipo) => ({
  tipo, titulo: "", descripcion: "", media_url: "", enlace_url: "",
  precio: "", features: "", destacado: false, orden: 0, activo: true,
});

const inp = { width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, boxSizing: "border-box" };
const lbl = { display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".03em" };
const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 18 };

export default function MarketingMedicoAdmin() {
  const [cfg, setCfg] = useState(null);
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState(null);
  const [guardandoCfg, setGuardandoCfg] = useState(false);
  const [editando, setEditando] = useState(null); // item objeto | null
  const [archivo, setArchivo] = useState(null);
  const [guardandoItem, setGuardandoItem] = useState(false);

  const cargarItems = () => api.get("/marketing-medico/admin").then(r => setItems(r.data.data || [])).catch(() => {});

  useEffect(() => {
    api.get("/config-sistema").then(r => {
      const c = r.data.data || {};
      setCfg({
        marketing_activo:       c.marketing_activo ?? "1",
        marketing_home_badge:   c.marketing_home_badge ?? "",
        marketing_home_titulo:  c.marketing_home_titulo ?? "",
        marketing_home_texto:   c.marketing_home_texto ?? "",
        marketing_hero_titulo:  c.marketing_hero_titulo ?? "",
        marketing_hero_texto:   c.marketing_hero_texto ?? "",
        marketing_whatsapp:     c.marketing_whatsapp ?? "",
      });
    });
    cargarItems();
  }, []);

  const flash = (tipo, texto) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 3500); };

  const guardarCfg = async () => {
    setGuardandoCfg(true);
    try { await api.put("/config-sistema", cfg); flash("ok", "Textos guardados"); }
    catch (e) { flash("err", e.response?.data?.msg || "Error"); }
    finally { setGuardandoCfg(false); }
  };

  const abrirNuevo = (tipo) => { setArchivo(null); setEditando(emptyItem(tipo)); };
  const abrirEditar = (it) => {
    setArchivo(null);
    setEditando({ ...it, features: Array.isArray(it.features) ? it.features.join("\n") : "", destacado: !!it.destacado, activo: !!it.activo });
  };

  const guardarItem = async () => {
    if (!editando.titulo.trim()) { flash("err", "El título es obligatorio"); return; }
    setGuardandoItem(true);
    try {
      const fd = new FormData();
      fd.append("tipo", editando.tipo);
      fd.append("titulo", editando.titulo);
      fd.append("descripcion", editando.descripcion || "");
      fd.append("enlace_url", editando.enlace_url || "");
      fd.append("precio", editando.precio || "");
      fd.append("orden", String(editando.orden || 0));
      fd.append("destacado", editando.destacado ? "1" : "0");
      fd.append("activo", editando.activo ? "1" : "0");
      fd.append("features", JSON.stringify(String(editando.features || "").split("\n").map(s => s.trim()).filter(Boolean)));
      if (editando.tipo === "video") fd.append("media_url", editando.media_url || "");
      if (editando.tipo === "post" && !archivo) fd.append("media_url", editando.media_url || "");
      if (archivo) fd.append("imagen", archivo);

      if (editando.id) await api.put(`/marketing-medico/${editando.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      else await api.post("/marketing-medico", fd, { headers: { "Content-Type": "multipart/form-data" } });

      setEditando(null); setArchivo(null);
      await cargarItems();
      flash("ok", "Guardado");
    } catch (e) { flash("err", e.response?.data?.msg || "Error al guardar"); }
    finally { setGuardandoItem(false); }
  };

  const eliminarItem = async (id) => {
    if (!confirm("¿Eliminar este item? No se puede deshacer.")) return;
    try { await api.delete(`/marketing-medico/${id}`); await cargarItems(); }
    catch (e) { flash("err", e.response?.data?.msg || "Error"); }
  };

  if (!cfg) return <div style={{ padding: 40, color: "#64748b" }}>Cargando…</div>;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <i className="bi bi-megaphone-fill" style={{ fontSize: 22, color: "#0E1F3C" }} />
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Marketing Médico</h1>
      </div>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
        Contenido de la página <code>/marketing-medico</code> y del bloque en el inicio.
      </p>

      {msg && (
        <div style={{ padding: "10px 16px", borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600, background: msg.tipo === "ok" ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)", color: msg.tipo === "ok" ? "#059669" : "#dc2626" }}>
          {msg.texto}
        </div>
      )}

      {/* ── TEXTOS ── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0 }}>Textos y ajustes</h2>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#475569" }}>
            <input type="checkbox" checked={cfg.marketing_activo === "1"} onChange={e => setCfg({ ...cfg, marketing_activo: e.target.checked ? "1" : "0" })} />
            Sección visible en la web
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div><label style={lbl}>Etiqueta (badge)</label><input style={inp} value={cfg.marketing_home_badge} onChange={e => setCfg({ ...cfg, marketing_home_badge: e.target.value })} /></div>
          <div><label style={lbl}>WhatsApp (solo números, con código país)</label><input style={inp} value={cfg.marketing_whatsapp} onChange={e => setCfg({ ...cfg, marketing_whatsapp: e.target.value })} placeholder="Ej. 504XXXXXXXX (vacío = usa el de la landing)" /></div>
          <div><label style={lbl}>Título — bloque del inicio</label><input style={inp} value={cfg.marketing_home_titulo} onChange={e => setCfg({ ...cfg, marketing_home_titulo: e.target.value })} /></div>
          <div><label style={lbl}>Título — página Marketing Médico</label><input style={inp} value={cfg.marketing_hero_titulo} onChange={e => setCfg({ ...cfg, marketing_hero_titulo: e.target.value })} /></div>
          <div><label style={lbl}>Texto — bloque del inicio</label><textarea style={{ ...inp, minHeight: 70 }} value={cfg.marketing_home_texto} onChange={e => setCfg({ ...cfg, marketing_home_texto: e.target.value })} /></div>
          <div><label style={lbl}>Texto — página Marketing Médico</label><textarea style={{ ...inp, minHeight: 70 }} value={cfg.marketing_hero_texto} onChange={e => setCfg({ ...cfg, marketing_hero_texto: e.target.value })} /></div>
        </div>
        <button onClick={guardarCfg} disabled={guardandoCfg} style={{ marginTop: 16, background: "#0E1F3C", color: "#fff", border: "none", borderRadius: 9, padding: "9px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {guardandoCfg ? "Guardando…" : "Guardar textos"}
        </button>
      </div>

      {/* ── ITEMS ── */}
      {TIPOS.map(t => {
        const lista = items.filter(i => i.tipo === t.id).sort((a, b) => a.orden - b.orden || a.id - b.id);
        return (
          <div key={t.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <i className={`bi ${t.icon}`} /> {t.label} <span style={{ color: "#94a3b8", fontWeight: 500 }}>({lista.length})</span>
              </h2>
              <button onClick={() => abrirNuevo(t.id)} style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#334155" }}>
                <i className="bi bi-plus-lg" /> Agregar
              </button>
            </div>
            {lista.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 13, padding: "10px 0" }}>Sin items.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lista.map(it => (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", border: "1px solid #eef2f7", borderRadius: 10, background: it.activo ? "#fff" : "#f8fafc", opacity: it.activo ? 1 : 0.6 }}>
                    {it.tipo === "post" && it.media_url && <img src={mediaUrl(it.media_url)} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />}
                    {it.tipo !== "post" && <i className={`bi ${it.tipo === "video" ? "bi-play-circle" : "bi-tag"}`} style={{ fontSize: 22, color: "#94a3b8", width: 46, textAlign: "center" }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{it.titulo} {it.destacado && <span style={{ fontSize: 10, background: "#fbbf24", color: "#0f172a", padding: "1px 6px", borderRadius: 5, fontWeight: 800 }}>DESTACADO</span>}</div>
                      <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.precio || it.media_url || it.descripcion || "—"}</div>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>orden {it.orden}</span>
                    <button onClick={() => abrirEditar(it)} style={{ border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", width: 30, height: 30, cursor: "pointer", color: "#475569" }}><i className="bi bi-pencil" /></button>
                    <button onClick={() => eliminarItem(it.id)} style={{ border: "1px solid #fecaca", borderRadius: 7, background: "#fef2f2", width: 30, height: 30, cursor: "pointer", color: "#dc2626" }}><i className="bi bi-trash" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── MODAL EDITOR ── */}
      {editando && (
        <div onClick={() => setEditando(null)} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", padding: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginTop: 0, marginBottom: 16 }}>
              {editando.id ? "Editar" : "Nuevo"} — {TIPOS.find(t => t.id === editando.tipo)?.label}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={lbl}>Título</label><input style={inp} value={editando.titulo} onChange={e => setEditando({ ...editando, titulo: e.target.value })} /></div>
              <div><label style={lbl}>Descripción</label><textarea style={{ ...inp, minHeight: 64 }} value={editando.descripcion} onChange={e => setEditando({ ...editando, descripcion: e.target.value })} /></div>

              {editando.tipo === "post" && (<>
                <div>
                  <label style={lbl}>Imagen</label>
                  {editando.media_url && !archivo && <img src={mediaUrl(editando.media_url)} alt="" style={{ maxHeight: 120, borderRadius: 8, display: "block", marginBottom: 8 }} />}
                  <input type="file" accept="image/*" onChange={e => setArchivo(e.target.files?.[0] || null)} />
                </div>
                <div><label style={lbl}>Link opcional (caso / Instagram)</label><input style={inp} value={editando.enlace_url} onChange={e => setEditando({ ...editando, enlace_url: e.target.value })} placeholder="https://..." /></div>
              </>)}

              {editando.tipo === "video" && (
                <div><label style={lbl}>URL de YouTube o Vimeo</label><input style={inp} value={editando.media_url} onChange={e => setEditando({ ...editando, media_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." /></div>
              )}

              {editando.tipo === "plan" && (<>
                <div><label style={lbl}>Precio (texto libre)</label><input style={inp} value={editando.precio} onChange={e => setEditando({ ...editando, precio: e.target.value })} placeholder='Ej. "$150 / mes"' /></div>
                <div><label style={lbl}>Incluye (una línea por punto)</label><textarea style={{ ...inp, minHeight: 110 }} value={editando.features} onChange={e => setEditando({ ...editando, features: e.target.value })} placeholder={"Gestión de redes\n8 publicaciones al mes\n1 video corto"} /></div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#475569" }}>
                  <input type="checkbox" checked={editando.destacado} onChange={e => setEditando({ ...editando, destacado: e.target.checked })} /> Resaltar como recomendado
                </label>
              </>)}

              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ width: 120 }}><label style={lbl}>Orden</label><input type="number" style={inp} value={editando.orden} onChange={e => setEditando({ ...editando, orden: Number(e.target.value) })} /></div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#475569", marginTop: 22 }}>
                  <input type="checkbox" checked={editando.activo} onChange={e => setEditando({ ...editando, activo: e.target.checked })} /> Activo (visible)
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={guardarItem} disabled={guardandoItem} style={{ background: "#0E1F3C", color: "#fff", border: "none", borderRadius: 9, padding: "9px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                {guardandoItem ? "Guardando…" : "Guardar"}
              </button>
              <button onClick={() => setEditando(null)} style={{ background: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 9, padding: "9px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
