// Super Admin → Novedades: publicar las mejoras de la plataforma para las clínicas.
import { useCallback, useEffect, useState } from "react";
import api from "../../api/api";
import { createPortal } from "react-dom";
import { cargarNovedades } from "../../utils/novedades";

const VACIO = { version: "", titulo: "", descripcion: "", icono: "bi-stars", imagen_url: "", audiencia: "TODOS", importante: false, publicada: true };
const AUD = { TODOS: "Todos", MEDICOS: "Médicos", ADMIN: "Administradores" };
const ICONOS = ["bi-stars", "bi-calendar-check", "bi-person-heart", "bi-graph-up-arrow", "bi-qr-code", "bi-star-fill", "bi-bell", "bi-shield-check", "bi-lightning-charge", "bi-phone", "bi-file-earmark-medical", "bi-cash-coin"];

const ROL = { ADMIN: "Administrador", MEDICO: "Médico", PSICOLOGO: "Psicólogo", ENFERMERA: "Enfermería", RECEPCIONISTA: "Recepción" };
const fechaHora = (t) => {
  if (!t) return "";
  const d = new Date(t.replace(" ", "T"));
  return d.toLocaleString("es-HN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};

// Quién vio una novedad (usuario, clínica, hora) y quién todavía no
function ModalLecturas({ novedad, onClose }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("vieron");
  const [busq, setBusq] = useState("");

  useEffect(() => {
    api.get(`/novedades/${novedad.id}/lecturas`)
      .then((r) => setD(r.data.data))
      .catch((e) => setError(e?.response?.data?.msg || "No se pudo cargar."));
  }, [novedad.id]);

  const q = busq.trim().toLowerCase();
  const lista = (d?.[tab] || []).filter((u) => !q || `${u.nombre} ${u.clinica} ${u.email}`.toLowerCase().includes(q));
  const total = d ? d.vieron.length + d.pendientes.length : 0;
  const clinicas = d ? new Set(d.vieron.map((u) => u.clinica)).size : 0;

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.3)" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fw-bold" style={{ fontSize: 16 }}>{novedad.version ? `v${novedad.version} · ` : ""}{novedad.titulo}</div>
            {d && (
              <div className="text-muted" style={{ fontSize: 13 }}>
                Vista por <strong>{d.vieron.length}</strong> de {total} usuario(s){d.vieron.length ? ` en ${clinicas} clínica(s)` : ""}
                {total ? ` · ${Math.round((d.vieron.length / total) * 100)}%` : ""}
              </div>
            )}
          </div>
          <button className="btn btn-sm btn-light" onClick={onClose} aria-label="Cerrar"><i className="bi bi-x-lg" /></button>
        </div>

        <div style={{ padding: "10px 18px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {[["vieron", `La vieron (${d?.vieron.length ?? "…"})`], ["pendientes", `No la han visto (${d?.pendientes.length ?? "…"})`]].map(([id, label]) => (
            <button key={id} className="btn btn-sm" onClick={() => setTab(id)}
              style={{ borderRadius: 999, fontWeight: 600, fontSize: 13, border: "1px solid #e5e7eb", background: tab === id ? "#0f172a" : "#fff", color: tab === id ? "#fff" : "#475569" }}>
              {label}
            </button>
          ))}
          <input className="form-control form-control-sm ms-auto" style={{ maxWidth: 240 }} placeholder="Buscar usuario o clínica…" value={busq} onChange={(e) => setBusq(e.target.value)} />
        </div>

        <div style={{ overflowY: "auto", padding: "0 18px 16px" }}>
          {error && <div className="alert alert-danger py-2 small">{error}</div>}
          {!d && !error && <div className="text-muted small py-3"><span className="spinner-border spinner-border-sm me-2" />Cargando…</div>}
          {d && lista.length === 0 && <div className="text-muted text-center py-4" style={{ fontSize: 14 }}>{tab === "vieron" ? "Nadie la ha visto todavía." : "¡Todos la vieron! 🎉"}</div>}
          {d && lista.length > 0 && (
            <div className="table-responsive">
              <style>{`
                @media (max-width: 575.98px) {
                  .lect-tabla thead { display: none; }
                  .lect-tabla, .lect-tabla tbody, .lect-tabla tr, .lect-tabla td { display: block; width: 100%; }
                  .lect-tabla tr { border-bottom: 1px solid #f1f5f9; padding: 8px 0; }
                  .lect-tabla td { border: none !important; padding: 1px 0 !important; white-space: normal !important; }
                  .lect-tabla td[data-label]::before { content: attr(data-label) ": "; color: #94a3b8; font-size: 12px; }
                }
              `}</style>
              <table className="table table-sm align-middle mb-0 lect-tabla" style={{ fontSize: 13.5 }}>
                <thead><tr className="text-muted small"><th>Usuario</th><th>Clínica</th>{tab === "vieron" && <th>La vio</th>}</tr></thead>
                <tbody>
                  {lista.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="fw-semibold">{u.nombre}</div>
                        <div className="text-muted small">{ROL[u.tipo] || u.tipo} · {u.email}</div>
                      </td>
                      <td data-label="Clínica">{u.clinica}</td>
                      {tab === "vieron" && (
                        <td className="text-nowrap" data-label="La vio">
                          {fechaHora(u.visto_en)}
                          {u.aproximado && <span className="text-muted small ms-1" title="Vista registrada antes de este control: la hora es aproximada">(aprox.)</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

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
  const [lecturas, setLecturas] = useState(null);   // novedad cuyo detalle de vistas se muestra

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
      {lecturas && <ModalLecturas novedad={lecturas} onClose={() => setLecturas(null)} />}
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
                    <td className="text-center small">
                      <button className="btn btn-sm btn-outline-primary" style={{ borderRadius: 999, fontSize: 12.5, padding: "2px 10px", whiteSpace: "nowrap" }}
                        onClick={() => setLecturas(n)} title="Ver quién la vio">
                        <i className="bi bi-eye me-1" />{n.vistas} usuario(s)
                      </button>
                    </td>
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
