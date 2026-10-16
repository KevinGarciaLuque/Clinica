// Super Admin → Novedades: publicar las mejoras de la plataforma para las clínicas.
import { useCallback, useEffect, useState } from "react";
import api from "../../api/api";
import { cargarNovedades } from "../../utils/novedades";

const VACIO = { version: "", titulo: "", descripcion: "", icono: "bi-stars", imagen_url: "", audiencia: "TODOS", importante: false, publicada: true };
const AUD = { TODOS: "Todos", MEDICOS: "Médicos", ADMIN: "Administradores" };
const ICONOS = ["bi-stars", "bi-calendar-check", "bi-person-heart", "bi-graph-up-arrow", "bi-qr-code", "bi-star-fill", "bi-bell", "bi-shield-check", "bi-lightning-charge", "bi-phone", "bi-file-earmark-medical", "bi-cash-coin"];

function siguienteVersion(v) {
  const [a, b] = String(v || "1.0").split(".").map((x) => Number(x) || 0);
  return `${a}.${b + 1}`;
}

export default function NovedadesAdmin() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);     // null = cerrado; {…} = creando/editando
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    api.get("/novedades/admin").then((r) => setData(r.data.data)).catch(() => setMsg("No se pudieron cargar las novedades."));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const nueva = () => { setEditId(null); setForm({ ...VACIO, version: siguienteVersion(data?.version) }); setMsg(""); };
  const editar = (n) => {
    setEditId(n.id);
    setForm({ version: n.version || "", titulo: n.titulo, descripcion: n.descripcion, icono: n.icono || "bi-stars", imagen_url: n.imagen_url || "",
      audiencia: n.audiencia, importante: Boolean(n.importante), publicada: Boolean(n.publicada) });
    setMsg("");
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true); setMsg("");
    try {
      if (editId) await api.put(`/novedades/${editId}`, form);
      else await api.post("/novedades", form);
      setForm(null); setEditId(null); cargar(); cargarNovedades(true);
      setMsg(editId ? "Novedad actualizada." : "¡Publicada! Las clínicas ya la ven en ✨ Novedades.");
    } catch (err) {
      setMsg(err?.response?.data?.msg || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (n) => {
    if (!window.confirm(`¿Eliminar "${n.titulo}"?`)) return;
    try { await api.delete(`/novedades/${n.id}`); cargar(); cargarNovedades(true); } catch { setMsg("No se pudo eliminar."); }
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h4 className="fw-bold mb-1">✨ Novedades de la plataforma</h4>
          <div className="text-muted" style={{ fontSize: 14 }}>
            Lo que publiques aquí aparece en el botón “Novedades” de todas las clínicas. Versión actual: <strong>v{data?.version || "1.0"}</strong>
          </div>
        </div>
        {!form && <button className="btn fw-semibold" onClick={nueva} style={{ background: "#1a2744", color: "#fff", borderRadius: 10 }}><i className="bi bi-plus-lg me-1" />Nueva novedad</button>}
      </div>

      {msg && <div className="alert alert-info py-2" style={{ fontSize: 14 }}>{msg}</div>}

      {form && (
        <form onSubmit={guardar} className="card border-0 shadow-sm mb-4" style={{ borderRadius: 14 }}>
          <div className="card-body">
            <h6 className="fw-bold mb-3">{editId ? "Editar novedad" : "Nueva novedad"}</h6>
            <div className="row g-3">
              <div className="col-md-2 col-4">
                <label className="form-label small fw-semibold">Versión</label>
                <input className="form-control" value={form.version} maxLength={20} placeholder="1.10" onChange={(e) => setForm({ ...form, version: e.target.value })} />
              </div>
              <div className="col-md-10 col-8">
                <label className="form-label small fw-semibold">Título *</label>
                <input className="form-control" required maxLength={150} value={form.titulo} placeholder="Ej. Ahora puedes enviar recetas por WhatsApp" onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Descripción *</label>
                <textarea className="form-control" required rows={4} maxLength={4000} value={form.descripcion} placeholder="Explica en palabras simples qué cambió y dónde encontrarlo." onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Para quién</label>
                <select className="form-select" value={form.audiencia} onChange={(e) => setForm({ ...form, audiencia: e.target.value })}>
                  {Object.entries(AUD).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="col-md-8">
                <label className="form-label small fw-semibold">Icono</label>
                <div className="d-flex flex-wrap gap-1">
                  {ICONOS.map((ic) => (
                    <button key={ic} type="button" onClick={() => setForm({ ...form, icono: ic })} className="btn btn-sm"
                      style={{ width: 36, height: 36, borderRadius: 9, border: `1.5px solid ${form.icono === ic ? "#4f46e5" : "#e2e8f0"}`, background: form.icono === ic ? "#eef2ff" : "#fff", color: "#4f46e5" }}>
                      <i className={`bi ${ic}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold">Imagen <span className="text-muted fw-normal">(opcional, enlace https://)</span></label>
                <input className="form-control" value={form.imagen_url} placeholder="https://…" onChange={(e) => setForm({ ...form, imagen_url: e.target.value })} />
              </div>
              <div className="col-12 d-flex gap-4 flex-wrap">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="novImp" checked={form.importante} onChange={(e) => setForm({ ...form, importante: e.target.checked })} />
                  <label className="form-check-label" htmlFor="novImp">Importante: mostrar en una ventana al entrar (una sola vez)</label>
                </div>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="novPub" checked={form.publicada} onChange={(e) => setForm({ ...form, publicada: e.target.checked })} />
                  <label className="form-check-label" htmlFor="novPub">Publicada</label>
                </div>
              </div>
            </div>
            <div className="d-flex gap-2 justify-content-end mt-3">
              <button type="button" className="btn btn-light" onClick={() => { setForm(null); setEditId(null); }}>Cancelar</button>
              <button className="btn fw-semibold" disabled={guardando} style={{ background: "#1a2744", color: "#fff" }}>
                {guardando ? <span className="spinner-border spinner-border-sm" /> : editId ? "Guardar cambios" : "Publicar"}
              </button>
            </div>
          </div>
        </form>
      )}

      {!data ? (
        <div className="text-muted"><span className="spinner-border spinner-border-sm me-2" />Cargando…</div>
      ) : (
        <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
          <div className="table-responsive">
            <table className="table align-middle mb-0" style={{ fontSize: 14 }}>
              <thead><tr className="text-muted small"><th>Novedad</th><th>Para</th><th className="text-center">Vista por</th><th>Publicada</th><th /></tr></thead>
              <tbody>
                {data.novedades.map((n) => (
                  <tr key={n.id} style={{ opacity: n.publicada ? 1 : 0.55 }}>
                    <td>
                      <div className="d-flex gap-2 align-items-start">
                        <i className={`bi ${n.icono || "bi-stars"}`} style={{ color: "#4f46e5", marginTop: 2 }} />
                        <div>
                          <div className="fw-semibold">{n.version ? <span className="text-muted me-1">v{n.version}</span> : null}{n.titulo}
                            {n.importante ? <span className="badge bg-warning-subtle text-warning-emphasis ms-2">Importante</span> : null}
                            {!n.publicada ? <span className="badge bg-secondary ms-2">Borrador</span> : null}
                          </div>
                          <div className="text-muted small text-truncate" style={{ maxWidth: 420 }}>{n.descripcion}</div>
                        </div>
                      </div>
                    </td>
                    <td className="small">{AUD[n.audiencia]}</td>
                    <td className="text-center small">{n.vistas} usuario(s)</td>
                    <td className="small text-muted">{n.publicado_txt}</td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-sm btn-link" onClick={() => editar(n)}>Editar</button>
                      <button className="btn btn-sm btn-link text-danger" onClick={() => eliminar(n)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
