import { useEffect, useState, useCallback } from "react";
import api from "../../api/api";

/* ── Paleta ────────────────────────────────────────────────── */
const C = {
  bg:       "#0d1b2e",
  surface:  "#112240",
  card:     "#162a45",
  border:   "rgba(255,255,255,0.07)",
  accent:   "#2196f3",
  accentD:  "#1976d2",
  success:  "#10b981",
  warning:  "#f59e0b",
  text:     "#e2e8f0",
  muted:    "#94a3b8",
  inputBg:  "#0d1b2e",
};

const EMPTY_C = {
  nombre: "", slug: "", tipo_id: "", email: "", telefono: "", direccion: "", ciudad: "", pais: "PE", ruc: "",
};
const EMPTY_A = { admin_nombres: "", admin_apellidos: "", admin_email: "", admin_password: "" };

/* ── Subcomponente: campo de formulario ─────────────────────── */
function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase",
                       letterSpacing: ".05em", marginBottom: 6, display: "block" }}>
        {label} {hint && <span style={{ color: C.muted, fontWeight: 400, textTransform: "none",
                                         letterSpacing: 0, fontSize: 11 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

/* ── Estilos globales del <input> ───────────────────────────── */
const inputSt = {
  background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "9px 12px", width: "100%", fontSize: 14,
  outline: "none", transition: "border .2s",
};

export default function Clinicas() {
  const [clinicas, setClinicas]   = useState([]);
  const [tipos, setTipos]         = useState([]);
  const [form, setForm]           = useState({ ...EMPTY_C, ...EMPTY_A });
  const [editId, setEditId]       = useState(null);
  const [busqueda, setBusqueda]   = useState("");
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState("");
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered]     = useState(null);
  
  // Modal de confirmación de eliminación
  const [modalEliminar, setModalEliminar] = useState(false);
  const [clinicaEliminar, setClinicaEliminar] = useState(null);
  const [textoConfirmacion, setTextoConfirmacion] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [rC, rT] = await Promise.all([
        api.get("/clinicas"),
        api.get("/clinicas/tipos"),
      ]);
      setClinicas(rC.data.data);
      setTipos(rT.data.data);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setForm({ ...EMPTY_C, ...EMPTY_A }); setEditId(null); setError(""); setShowModal(true);
  };

  const abrirEditar = (c) => {
    setForm({ nombre: c.nombre, slug: c.slug,
              tipo_id: c.tipo_id != null ? String(c.tipo_id) : "",
              email: c.email||"", telefono: c.telefono||"",
              direccion: c.direccion||"", ciudad: c.ciudad||"",
              pais: c.pais||"PE", ruc: c.ruc||"",
              ...EMPTY_A });
    setEditId(c.id); setError(""); setShowModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault(); setError("");
    try {
      if (editId) {
        await api.put(`/clinicas/${editId}`, form);
      } else {
        await api.post("/clinicas", form);
      }
      setShowModal(false); cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const toggleActivo = async (c) => {
    try {
      if (c.activo) await api.delete(`/clinicas/${c.id}`);
      else          await api.put(`/clinicas/${c.id}`, { activo: 1 });
      cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const eliminarClinica = async (c) => {
    setClinicaEliminar(c);
    setTextoConfirmacion("");
    setModalEliminar(true);
  };

  const confirmarEliminacion = async () => {
    if (textoConfirmacion !== "ELIMINAR") {
      setError('❌ Debes escribir exactamente "ELIMINAR" para confirmar');
      return;
    }
    try {
      await api.delete(`/clinicas/${clinicaEliminar.id}?permanente=true`);
      setModalEliminar(false);
      setClinicaEliminar(null);
      setTextoConfirmacion("");
      cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const filtradas = clinicas.filter((c) =>
    `${c.nombre} ${c.slug}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const total   = clinicas.length;
  const activas = clinicas.filter((c) => c.activo).length;

  return (
    <div style={{ color: C.text, minHeight: "100vh" }}>

      {/* ── Banner superior ─────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.surface} 0%, #0f2a50 100%)`,
        borderRadius: 16, padding: "28px 32px", marginBottom: 24,
        border: `1px solid ${C.border}`,
        boxShadow: "0 4px 24px rgba(0,0,0,.3)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
      }}>
        {/* Icono + título */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 14,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 16px rgba(33,150,243,.4)`,
          }}>
            <i className="bi bi-building-fill" style={{ fontSize: 24, color: "#fff" }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: 22, color: C.text }}>
              Gestión de Clínicas
            </h4>
            <span style={{ color: C.muted, fontSize: 13 }}>
              Panel SUPER_ADMIN — todas las clínicas del sistema
            </span>
          </div>
        </div>

        {/* Stats + botón */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{
            background: "rgba(33,150,243,.12)", border: "1px solid rgba(33,150,243,.2)",
            borderRadius: 10, padding: "8px 16px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.accent, lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Total</div>
          </div>
          <div style={{
            background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.2)",
            borderRadius: 10, padding: "8px 16px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.success, lineHeight: 1 }}>{activas}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Activas</div>
          </div>
          <div style={{
            background: "rgba(148,163,184,.08)", border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "8px 16px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.muted, lineHeight: 1 }}>{total - activas}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Inactivas</div>
          </div>

          <button
            onClick={abrirNuevo}
            style={{
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
              border: "none", borderRadius: 10, padding: "10px 20px",
              color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: `0 4px 14px rgba(33,150,243,.4)`,
              transition: "opacity .2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = ".85"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            <i className="bi bi-plus-lg" />
            Nueva clínica
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)",
          borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#f87171",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <i className="bi bi-exclamation-triangle-fill" />
          {error}
        </div>
      )}

      {/* ── Buscador ─────────────────────────────────────────── */}
      <div style={{ position: "relative", marginBottom: 24, maxWidth: 420 }}>
        <i className="bi bi-search" style={{
          position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
          color: C.muted, fontSize: 15, pointerEvents: "none",
        }} />
        <input
          style={{ ...inputSt, paddingLeft: 40, borderRadius: 10 }}
          placeholder="Buscar clínica por nombre o slug..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onFocus={(e) => e.target.style.borderColor = C.accent}
          onBlur={(e)  => e.target.style.borderColor = C.border}
        />
      </div>

      {/* ── Grid de clínicas ─────────────────────────────────── */}
      {cargando ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{
            width: 44, height: 44, border: `3px solid ${C.border}`,
            borderTopColor: C.accent, borderRadius: "50%",
            animation: "spin .8s linear infinite", margin: "0 auto 16px",
          }} />
          <span style={{ color: C.muted, fontSize: 14 }}>Cargando clínicas...</span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {filtradas.map((c) => {
            const initials = c.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
            const isHov = hovered === c.id;
            return (
              <div
                key={c.id}
                onMouseEnter={() => setHovered(c.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: C.card,
                  border: `1px solid ${isHov ? "rgba(33,150,243,.35)" : C.border}`,
                  borderRadius: 16,
                  overflow: "hidden",
                  opacity: c.activo ? 1 : 0.55,
                  transition: "border .2s, transform .2s, box-shadow .2s",
                  transform: isHov ? "translateY(-3px)" : "none",
                  boxShadow: isHov ? "0 8px 32px rgba(0,0,0,.35)" : "0 2px 12px rgba(0,0,0,.2)",
                }}
              >
                {/* Cabecera de tarjeta */}
                <div style={{
                  background: `linear-gradient(135deg, #0f2a50 0%, #1a3a5c 100%)`,
                  padding: "18px 20px",
                  display: "flex", alignItems: "center", gap: 14,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 16, color: "#fff",
                    flexShrink: 0, boxShadow: `0 3px 10px rgba(33,150,243,.3)`,
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.text,
                                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.nombre}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      {/* ID de la clínica */}
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)",
                        borderRadius: 6, padding: "2px 8px",
                      }}>
                        <i className="bi bi-hash" style={{ fontSize: 11, color: C.success }} />
                        <span style={{ fontSize: 11, color: C.success, fontFamily: "monospace", fontWeight: 700 }}>
                          {c.id}
                        </span>
                      </div>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: "rgba(255,255,255,.05)", border: `1px solid ${C.border}`,
                        borderRadius: 6, padding: "2px 8px",
                      }}>
                        <i className="bi bi-link-45deg" style={{ fontSize: 12, color: C.muted }} />
                        <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>{c.slug}</span>
                      </div>
                      {c.tipo_nombre && (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: `${c.tipo_color}22`,
                          border: `1px solid ${c.tipo_color}55`,
                          borderRadius: 6, padding: "2px 8px",
                        }}>
                          <i className={`bi ${c.tipo_icono}`} style={{ fontSize: 11, color: c.tipo_color }} />
                          <span style={{ fontSize: 11, color: c.tipo_color, fontWeight: 600 }}>{c.tipo_nombre}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: c.activo ? "rgba(16,185,129,.15)" : "rgba(148,163,184,.1)",
                    color:      c.activo ? C.success : C.muted,
                    border:     `1px solid ${c.activo ? "rgba(16,185,129,.3)" : C.border}`,
                    whiteSpace: "nowrap",
                  }}>
                    <i className={`bi bi-${c.activo ? "check-circle" : "x-circle"}-fill me-1`} />
                    {c.activo ? "Activa" : "Inactiva"}
                  </span>
                </div>

                {/* Cuerpo */}
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {c.email && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <i className="bi bi-envelope" style={{ color: C.accent, fontSize: 13, width: 16 }} />
                      <span style={{ fontSize: 13, color: C.muted }}>{c.email}</span>
                    </div>
                  )}
                  {c.telefono && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <i className="bi bi-telephone" style={{ color: C.accent, fontSize: 13, width: 16 }} />
                      <span style={{ fontSize: 13, color: C.muted }}>{c.telefono}</span>
                    </div>
                  )}
                  {c.ciudad && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <i className="bi bi-geo-alt" style={{ color: C.accent, fontSize: 13, width: 16 }} />
                      <span style={{ fontSize: 13, color: C.muted }}>{c.ciudad}{c.pais ? `, ${c.pais}` : ""}</span>
                    </div>
                  )}
                  {c.ruc && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <i className="bi bi-file-text" style={{ color: C.accent, fontSize: 13, width: 16 }} />
                      <span style={{ fontSize: 13, color: C.muted }}>RUC: {c.ruc}</span>
                    </div>
                  )}
                  {!c.email && !c.telefono && !c.ciudad && (
                    <span style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>Sin datos de contacto</span>
                  )}
                </div>

                {/* Footer de tarjeta */}
                <div style={{
                  padding: "12px 20px", borderTop: `1px solid ${C.border}`,
                  display: "flex", gap: 10,
                }}>
                  <button
                    onClick={() => abrirEditar(c)}
                    style={{
                      flex: 1, background: "rgba(33,150,243,.1)", border: "1px solid rgba(33,150,243,.25)",
                      borderRadius: 8, padding: "8px 0", color: C.accent,
                      fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background .2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(33,150,243,.2)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(33,150,243,.1)"}
                  >
                    <i className="bi bi-pencil-square" />
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActivo(c)}
                    style={{
                      flex: 1,
                      background: c.activo ? "rgba(245,158,11,.08)" : "rgba(16,185,129,.08)",
                      border: `1px solid ${c.activo ? "rgba(245,158,11,.25)" : "rgba(16,185,129,.25)"}`,
                      borderRadius: 8, padding: "8px 0",
                      color: c.activo ? C.warning : C.success,
                      fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background .2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = ".75"}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                  >
                    <i className={`bi bi-${c.activo ? "pause-circle" : "play-circle"}`} />
                    {c.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => eliminarClinica(c)}
                    title="Eliminar permanentemente"
                    style={{
                      background: "rgba(239,68,68,.08)", 
                      border: "1px solid rgba(239,68,68,.25)",
                      borderRadius: 8, padding: "8px 12px",
                      color: "#ef4444",
                      fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .2s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,.15)";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,.08)";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <i className="bi bi-trash-fill" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Estado vacío */}
          {!filtradas.length && (
            <div style={{
              gridColumn: "1/-1", textAlign: "center", padding: "64px 0",
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20, margin: "0 auto 20px",
                background: "rgba(33,150,243,.08)", border: `1px solid rgba(33,150,243,.15)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-building" style={{ fontSize: 30, color: C.muted }} />
              </div>
              <p style={{ color: C.muted, fontSize: 15, margin: 0 }}>
                {busqueda ? "No se encontraron clínicas con ese criterio" : "No hay clínicas registradas"}
              </p>
              {!busqueda && (
                <button onClick={abrirNuevo} style={{
                  marginTop: 16, background: C.accent, border: "none", borderRadius: 8,
                  padding: "9px 20px", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14,
                }}>
                  + Registrar la primera clínica
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1050,
          background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 18, width: "100%", maxWidth: 680,
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 24px 80px rgba(0,0,0,.5)",
          }}>
            {/* Header modal */}
            <div style={{
              padding: "22px 28px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className={`bi bi-${editId ? "pencil-square" : "building-add"}`}
                   style={{ color: "#fff", fontSize: 17 }} />
              </div>
              <div style={{ flex: 1 }}>
                <h5 style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 17 }}>
                  {editId ? "Editar clínica" : "Nueva clínica"}
                </h5>
                <span style={{ fontSize: 12, color: C.muted }}>
                  {editId ? "Modifica los datos de la clínica" : "Complete los datos para registrar una nueva clínica"}
                </span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "rgba(255,255,255,.05)", border: `1px solid ${C.border}`,
                  borderRadius: 8, width: 34, height: 34,
                  color: C.muted, cursor: "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>

                {error && (
                  <div style={{
                    background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)",
                    borderRadius: 10, padding: "12px 16px", color: "#f87171",
                    display: "flex", alignItems: "center", gap: 10, fontSize: 14,
                  }}>
                    <i className="bi bi-exclamation-triangle-fill" /> {error}
                  </div>
                )}

                {/* Sección datos clínica */}
                <div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: "rgba(33,150,243,.15)", border: "1px solid rgba(33,150,243,.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <i className="bi bi-building" style={{ fontSize: 12, color: C.accent }} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>Datos de la clínica</span>
                    <div style={{ flex: 1, height: 1, background: C.border }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <Field label="Nombre" hint="*">
                      <input style={inputSt} value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        onFocus={(e) => e.target.style.borderColor = C.accent}
                        onBlur={(e)  => e.target.style.borderColor = C.border}
                        required />
                    </Field>
                    <Field label="Slug" hint="* (ej: clinica-norte)">
                      <input style={{ ...inputSt, fontFamily: "monospace" }} value={form.slug}
                        placeholder="clinica-ejemplo"
                        onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s/g,"-") })}
                        onFocus={(e) => e.target.style.borderColor = C.accent}
                        onBlur={(e)  => e.target.style.borderColor = C.border}
                        pattern="[a-z0-9\-]+" required />
                    </Field>

                    {/* ── Selector de Especialidad / Tipo ── */}
                    <div style={{ gridColumn: "1/-1" }}>
                      <Field label="Especialidad / Tipo de Clínica" hint="(define los módulos disponibles)">
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 }}>
                          {tipos.map((t) => {
                            const sel = String(form.tipo_id) === String(t.id);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setForm({ ...form, tipo_id: sel ? "" : String(t.id) })}
                                style={{
                                  background: sel ? `${t.color}22` : "rgba(255,255,255,.03)",
                                  border: `2px solid ${sel ? t.color : C.border}`,
                                  borderRadius: 10, padding: "10px 12px",
                                  cursor: "pointer", textAlign: "left",
                                  transition: "all .18s",
                                  display: "flex", alignItems: "center", gap: 10,
                                }}
                                onMouseEnter={(e) => !sel && (e.currentTarget.style.borderColor = `${t.color}88`)}
                                onMouseLeave={(e) => !sel && (e.currentTarget.style.borderColor = C.border)}
                              >
                                <div style={{
                                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                  background: sel ? t.color : `${t.color}33`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  transition: "background .18s",
                                }}>
                                  <i className={`bi ${t.icono}`} style={{ fontSize: 14, color: sel ? "#fff" : t.color }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: sel ? t.color : C.text, lineHeight: 1.3 }}>{t.nombre}</div>
                                </div>
                                {sel && <i className="bi bi-check-circle-fill ms-auto" style={{ color: t.color, fontSize: 14 }} />}
                              </button>
                            );
                          })}
                        </div>
                      </Field>
                    </div>

                    <Field label="Email">
                      <input style={inputSt} type="email" value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        onFocus={(e) => e.target.style.borderColor = C.accent}
                        onBlur={(e)  => e.target.style.borderColor = C.border} />
                    </Field>
                    <Field label="Teléfono">
                      <input style={inputSt} value={form.telefono}
                        onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                        onFocus={(e) => e.target.style.borderColor = C.accent}
                        onBlur={(e)  => e.target.style.borderColor = C.border} />
                    </Field>
                    <div style={{ gridColumn: "1/-1" }}>
                      <Field label="Dirección">
                        <input style={inputSt} value={form.direccion}
                          onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                          onFocus={(e) => e.target.style.borderColor = C.accent}
                          onBlur={(e)  => e.target.style.borderColor = C.border} />
                      </Field>
                    </div>
                    <Field label="Ciudad">
                      <input style={inputSt} value={form.ciudad}
                        onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                        onFocus={(e) => e.target.style.borderColor = C.accent}
                        onBlur={(e)  => e.target.style.borderColor = C.border} />
                    </Field>
                    <Field label="RUC / NIT">
                      <input style={inputSt} value={form.ruc}
                        onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                        onFocus={(e) => e.target.style.borderColor = C.accent}
                        onBlur={(e)  => e.target.style.borderColor = C.border} />
                    </Field>
                  </div>
                </div>

                {/* Sección admin inicial */}
                {!editId && (
                  <div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <i className="bi bi-person-badge" style={{ fontSize: 12, color: C.success }} />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>
                        Administrador inicial
                      </span>
                      <span style={{
                        fontSize: 11, color: C.muted, background: "rgba(148,163,184,.08)",
                        border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px",
                      }}>opcional</span>
                      <div style={{ flex: 1, height: 1, background: C.border }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <Field label="Nombres">
                        <input style={inputSt} value={form.admin_nombres}
                          onChange={(e) => setForm({ ...form, admin_nombres: e.target.value })}
                          onFocus={(e) => e.target.style.borderColor = C.accent}
                          onBlur={(e)  => e.target.style.borderColor = C.border} />
                      </Field>
                      <Field label="Apellidos">
                        <input style={inputSt} value={form.admin_apellidos}
                          onChange={(e) => setForm({ ...form, admin_apellidos: e.target.value })}
                          onFocus={(e) => e.target.style.borderColor = C.accent}
                          onBlur={(e)  => e.target.style.borderColor = C.border} />
                      </Field>
                      <Field label="Email del admin">
                        <input style={inputSt} type="email" value={form.admin_email}
                          onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                          onFocus={(e) => e.target.style.borderColor = C.accent}
                          onBlur={(e)  => e.target.style.borderColor = C.border} />
                      </Field>
                      <Field label="Contraseña temporal">
                        <input style={inputSt} type="password" value={form.admin_password}
                          onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                          onFocus={(e) => e.target.style.borderColor = C.accent}
                          onBlur={(e)  => e.target.style.borderColor = C.border} />
                      </Field>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer modal */}
              <div style={{
                padding: "18px 28px", borderTop: `1px solid ${C.border}`,
                display: "flex", justifyContent: "flex-end", gap: 12,
              }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "transparent", border: `1px solid ${C.border}`,
                    borderRadius: 9, padding: "10px 22px",
                    color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
                    transition: "border .2s, color .2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.muted; }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                    border: "none", borderRadius: 9, padding: "10px 28px",
                    color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    boxShadow: `0 4px 14px rgba(33,150,243,.35)`,
                    transition: "opacity .2s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = ".85"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  <i className={`bi bi-${editId ? "check-lg" : "plus-lg"}`} />
                  {editId ? "Guardar cambios" : "Crear clínica"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de confirmación de eliminación ────────────── */}
      {modalEliminar && clinicaEliminar && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1060,
          background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: C.surface, border: `2px solid rgba(239,68,68,.4)`,
            borderRadius: 18, width: "100%", maxWidth: 520,
            boxShadow: "0 24px 80px rgba(239,68,68,.3)",
          }}>
            {/* Header modal */}
            <div style={{
              padding: "22px 28px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                background: "rgba(239,68,68,.15)",
                border: "2px solid rgba(239,68,68,.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-exclamation-triangle-fill" style={{ color: "#ef4444", fontSize: 22 }} />
              </div>
              <div style={{ flex: 1 }}>
                <h5 style={{ margin: 0, fontWeight: 700, color: "#ef4444", fontSize: 17 }}>
                  ¡Eliminar clínica permanentemente!
                </h5>
                <span style={{ fontSize: 12, color: C.muted }}>
                  Esta acción es irreversible
                </span>
              </div>
              <button
                onClick={() => {
                  setModalEliminar(false);
                  setClinicaEliminar(null);
                  setTextoConfirmacion("");
                  setError("");
                }}
                style={{
                  background: "rgba(255,255,255,.05)", border: `1px solid ${C.border}`,
                  borderRadius: 8, width: 34, height: 34,
                  color: C.muted, cursor: "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* Body modal */}
            <div style={{ padding: "24px 28px" }}>
              {error && (
                <div style={{
                  background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)",
                  borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#f87171",
                  display: "flex", alignItems: "center", gap: 10, fontSize: 14,
                }}>
                  <i className="bi bi-exclamation-triangle-fill" /> {error}
                </div>
              )}

              <div style={{
                background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)",
                borderRadius: 12, padding: "16px 20px", marginBottom: 20,
              }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  ¿Estás seguro de eliminar la clínica?
                </div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(33,150,243,.15)", border: "1px solid rgba(33,150,243,.3)",
                  borderRadius: 8, padding: "6px 12px", marginBottom: 12,
                }}>
                  <i className="bi bi-building-fill" style={{ color: C.accent, fontSize: 14 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                    {clinicaEliminar.nombre}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 8 }}>
                    ⚠️ <strong style={{ color: "#ef4444" }}>Esta acción NO se puede deshacer</strong>
                  </div>
                  <div>Se eliminarán permanentemente:</div>
                  <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                    <li>Todos los usuarios de la clínica</li>
                    <li>Todos los pacientes registrados</li>
                    <li>Historias clínicas completas</li>
                    <li>Citas y agendas médicas</li>
                    <li>Documentos y archivos asociados</li>
                  </ul>
                </div>
              </div>

              <Field label='Escribe "ELIMINAR" para confirmar'>
                <input
                  style={{
                    ...inputSt,
                    borderColor: textoConfirmacion === "ELIMINAR" ? "#10b981" : C.border,
                    borderWidth: 2,
                  }}
                  placeholder="ELIMINAR"
                  value={textoConfirmacion}
                  onChange={(e) => {
                    setTextoConfirmacion(e.target.value);
                    setError("");
                  }}
                  onFocus={(e) => e.target.style.borderColor = textoConfirmacion === "ELIMINAR" ? "#10b981" : "#ef4444"}
                  onBlur={(e) => e.target.style.borderColor = textoConfirmacion === "ELIMINAR" ? "#10b981" : C.border}
                  autoFocus
                />
              </Field>
            </div>

            {/* Footer modal */}
            <div style={{
              padding: "18px 28px", borderTop: `1px solid ${C.border}`,
              display: "flex", justifyContent: "flex-end", gap: 12,
            }}>
              <button
                type="button"
                onClick={() => {
                  setModalEliminar(false);
                  setClinicaEliminar(null);
                  setTextoConfirmacion("");
                  setError("");
                }}
                style={{
                  background: "transparent", border: `1px solid ${C.border}`,
                  borderRadius: 9, padding: "10px 22px",
                  color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  transition: "border .2s, color .2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.muted; }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminacion}
                disabled={textoConfirmacion !== "ELIMINAR"}
                style={{
                  background: textoConfirmacion === "ELIMINAR" 
                    ? "linear-gradient(135deg, #ef4444, #dc2626)" 
                    : "rgba(148,163,184,.2)",
                  border: "none", borderRadius: 9, padding: "10px 28px",
                  color: "#fff", fontSize: 14, fontWeight: 600, 
                  cursor: textoConfirmacion === "ELIMINAR" ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", gap: 8,
                  boxShadow: textoConfirmacion === "ELIMINAR" 
                    ? "0 4px 14px rgba(239,68,68,.4)" 
                    : "none",
                  transition: "all .2s",
                  opacity: textoConfirmacion === "ELIMINAR" ? 1 : 0.5,
                }}
                onMouseEnter={(e) => textoConfirmacion === "ELIMINAR" && (e.currentTarget.style.opacity = ".85")}
                onMouseLeave={(e) => textoConfirmacion === "ELIMINAR" && (e.currentTarget.style.opacity = "1")}
              >
                <i className="bi bi-trash-fill" />
                Eliminar permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
