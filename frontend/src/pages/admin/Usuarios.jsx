import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";

const TIPOS = ["ADMIN", "MEDICO", "PSICOLOGO", "ENFERMERA", "RECEPCIONISTA"];
const EMPTY = {
  nombres: "", apellidos: "", email: "", password: "",
  tipo: "RECEPCIONISTA", especialidad_id: "", telefono: "",
  numero_colegiatura: "", activo: 1,
};

const TIPO_CONFIG = {
  SUPER_ADMIN: { color: "#dc3545", bg: "#fff0f0", label: "Super Admin" },
  ADMIN:       { color: "#f59e0b", bg: "#fffbeb", label: "Admin" },
  MEDICO:      { color: "#3b82f6", bg: "#eff6ff", label: "Médico" },
  PSICOLOGO:   { color: "#8b5cf6", bg: "#f5f3ff", label: "Psicólogo" },
  ENFERMERA:   { color: "#06b6d4", bg: "#ecfeff", label: "Enfermera" },
  RECEPCIONISTA:{ color: "#8b5cf6", bg: "#f5f3ff", label: "Recepcionista" },
};

function Avatar({ nombres = "", apellidos = "", tipo }) {
  const initials = `${nombres[0] || ""}${apellidos[0] || ""}`.toUpperCase();
  const cfg = TIPO_CONFIG[tipo] || { color: "#6b7280", bg: "#f3f4f6" };
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: cfg.bg, color: cfg.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: 13, border: `2px solid ${cfg.color}30`,
      flexShrink: 0,
    }}>
      {initials || "?"}
    </div>
  );
}

function TipoBadge({ tipo }) {
  const cfg = TIPO_CONFIG[tipo] || { color: "#6b7280", bg: "#f3f4f6", label: tipo };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`,
      letterSpacing: "0.3px", whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

export default function Usuarios() {
  const { user } = useAuth();
  const esSuperAdmin = user?.tipo === "SUPER_ADMIN";

  const [usuarios, setUsuarios]         = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [clinicas, setClinicas]         = useState([]);
  const [clinicaSeleccionada, setClinicaSeleccionada] = useState("");
  const [form, setForm]                 = useState(EMPTY);
  const [editId, setEditId]             = useState(null);
  const [busqueda, setBusqueda]         = useState("");
  const [cargando, setCargando]         = useState(false);
  const [error, setError]               = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [resetPass, setResetPass]       = useState({ id: null, pass: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ id: null, nombre: "", texto: "" });
  const [showResetPass, setShowResetPass] = useState(false);
  const [showPass,      setShowPass]      = useState(false);

  useEffect(() => {
    if (!esSuperAdmin) return;
    api.get("/clinicas").then((r) => {
      const lista = r.data.data || [];
      setClinicas(lista);
      if (lista.length > 0) setClinicaSeleccionada(String(lista[0].id));
    }).catch(() => {});
  }, [esSuperAdmin]);

  const cargar = useCallback(async () => {
    const cid = esSuperAdmin ? clinicaSeleccionada : (user?.clinica_id || "");
    if (!cid) return;
    setCargando(true);
    try {
      const params = esSuperAdmin ? { clinica_id: cid } : {};
      const [uRes, eRes] = await Promise.all([
        api.get("/usuarios", { params }),
        api.get("/usuarios/especialidades"),
      ]);
      setUsuarios(uRes.data.data);
      setEspecialidades(eRes.data.data);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setCargando(false);
    }
  }, [esSuperAdmin, clinicaSeleccionada, user?.clinica_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => { setForm(EMPTY); setEditId(null); setError(""); setShowModal(true); };
  const abrirEditar = (u) => {
    setForm({
      nombres: u.nombres, apellidos: u.apellidos, email: u.email,
      password: "", tipo: u.tipo,
      especialidad_id: u.especialidad_id || "",
      telefono: u.telefono || "", numero_colegiatura: u.numero_colegiatura || "",
      activo: u.activo,
    });
    setEditId(u.id); setError(""); setShowModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault(); setError("");
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.especialidad_id) delete payload.especialidad_id;
      if (esSuperAdmin && clinicaSeleccionada) payload.clinica_id = Number(clinicaSeleccionada);
      if (editId) await api.put(`/usuarios/${editId}`, payload);
      else await api.post("/usuarios", payload);
      setShowModal(false); cargar();
    } catch (e) { setError(e.response?.data?.msg || e.message); }
  };

  const toggleActivo = async (u) => {
    try { await api.put(`/usuarios/${u.id}`, { activo: u.activo ? 0 : 1 }); cargar(); }
    catch (e) { setError(e.response?.data?.msg || e.message); }
  };

  const guardarResetPass = async () => {
    setError("");
    try {
      await api.post(`/usuarios/${resetPass.id}/reset-password`, { nueva_password: resetPass.pass });
      setResetPass({ id: null, pass: "" });
    } catch (e) { setError(e.response?.data?.msg || e.message); }
  };

  const eliminarUsuario = async () => {
    if (deleteConfirm.texto !== "ELIMINAR") { setError('Debes escribir exactamente "ELIMINAR" para confirmar'); return; }
    try {
      await api.delete(`/usuarios/${deleteConfirm.id}`);
      setDeleteConfirm({ id: null, nombre: "", texto: "" }); setError(""); cargar();
    } catch (e) { setError(e.response?.data?.msg || e.message); }
  };

  const filtrados = usuarios.filter((u) =>
    `${u.nombres} ${u.apellidos} ${u.email}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const activos   = usuarios.filter(u => u.activo).length;
  const inactivos = usuarios.filter(u => !u.activo).length;

  return (
    <div style={{ padding: "4px 0" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 700, color: "#1e293b", fontSize: 22 }}>
            <i className="bi bi-people-fill me-2" style={{ color: "#3b82f6" }} />
            Gestión de Usuarios
          </h4>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            Administra el acceso y permisos del equipo
          </p>
        </div>
        <button
          onClick={abrirNuevo}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            color: "#fff", border: "none", borderRadius: 10,
            padding: "9px 18px", fontWeight: 600, fontSize: 13,
            cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,.35)",
            transition: "all .2s",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          <i className="bi bi-person-plus-fill" />
          Nuevo usuario
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total", value: usuarios.length, icon: "bi-people", color: "#3b82f6", bg: "#eff6ff" },
          { label: "Activos", value: activos, icon: "bi-check-circle", color: "#10b981", bg: "#ecfdf5" },
          { label: "Inactivos", value: inactivos, icon: "bi-pause-circle", color: "#f59e0b", bg: "#fffbeb" },
        ].map(s => (
          <div key={s.label} style={{
            display: "flex", alignItems: "center", gap: 10,
            background: s.bg, border: `1px solid ${s.color}20`,
            borderRadius: 10, padding: "10px 16px", minWidth: 110,
          }}>
            <i className={`bi ${s.icon}`} style={{ color: s.color, fontSize: 20 }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtro clínica */}
      {esSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4, display: "block" }}>
            CLÍNICA
          </label>
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 320, borderRadius: 8, borderColor: "#e2e8f0" }}
            value={clinicaSeleccionada}
            onChange={(e) => { setClinicaSeleccionada(e.target.value); setError(""); }}
          >
            <option value="">— Selecciona una clínica —</option>
            {clinicas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      )}

      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
          padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <i className="bi bi-exclamation-circle-fill" />
          {error}
        </div>
      )}

      {/* Buscador */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <i className="bi bi-search" style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "#94a3b8", fontSize: 14,
        }} />
        <input
          style={{
            width: "100%", padding: "9px 14px 9px 36px",
            border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13,
            outline: "none", background: "#f8fafc", color: "#1e293b",
            boxSizing: "border-box", transition: "border-color .2s, box-shadow .2s",
          }}
          placeholder="Buscar por nombre o email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,.12)"; }}
          onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; }}
        />
        {busqueda && (
          <button onClick={() => setBusqueda("")} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 2,
          }}>
            <i className="bi bi-x-circle-fill" />
          </button>
        )}
      </div>

      {/* Tabla */}
      {cargando ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div className="spinner-border text-primary" style={{ width: 32, height: 32 }} />
          <p style={{ color: "#64748b", marginTop: 12, fontSize: 13 }}>Cargando usuarios...</p>
        </div>
      ) : (
        <div style={{
          background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
          overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["Usuario", "Email", "Tipo", "Especialidad", "Estado", "Acciones"].map(h => (
                  <th key={h} style={{
                    padding: "11px 14px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, color: "#64748b",
                    textTransform: "uppercase", letterSpacing: "0.5px",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u, i) => (
                <tr key={u.id} style={{
                  borderBottom: i < filtrados.length - 1 ? "1px solid #f1f5f9" : "none",
                  transition: "background .15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar nombres={u.nombres} apellidos={u.apellidos} tipo={u.tipo} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>
                          {u.apellidos}, {u.nombres}
                        </div>
                        {u.telefono && (
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                            <i className="bi bi-telephone me-1" />{u.telefono}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 12, color: "#475569" }}>{u.email}</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <TipoBadge tipo={u.tipo} />
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 12, color: u.especialidad ? "#334155" : "#cbd5e1" }}>
                      {u.especialidad || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: u.activo ? "#ecfdf5" : "#f8fafc",
                      color: u.activo ? "#10b981" : "#94a3b8",
                      border: `1px solid ${u.activo ? "#10b98130" : "#e2e8f0"}`,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: u.activo ? "#10b981" : "#94a3b8",
                      }} />
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <ActionBtn icon="bi-pencil-fill" color="#3b82f6" title="Editar" onClick={() => abrirEditar(u)} />
                      <ActionBtn
                        icon={u.activo ? "bi-pause-fill" : "bi-play-fill"}
                        color={u.activo ? "#f59e0b" : "#10b981"}
                        title={u.activo ? "Desactivar" : "Activar"}
                        onClick={() => toggleActivo(u)}
                      />
                      <ActionBtn icon="bi-key-fill" color="#8b5cf6" title="Contraseña"
                        onClick={() => { setResetPass({ id: u.id, pass: "" }); setShowResetPass(false); }} />
                      <ActionBtn icon="bi-trash3-fill" color="#ef4444" title="Eliminar"
                        onClick={() => setDeleteConfirm({ id: u.id, nombre: `${u.nombres} ${u.apellidos}`, texto: "" })} />
                    </div>
                  </td>
                </tr>
              ))}
              {!filtrados.length && (
                <tr>
                  <td colSpan={6} style={{ padding: "48px 0", textAlign: "center" }}>
                    <i className="bi bi-person-x" style={{ fontSize: 32, color: "#cbd5e1", display: "block", marginBottom: 8 }} />
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>
                      {busqueda ? "No se encontraron resultados" : "Sin usuarios registrados"}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtrados.length > 0 && (
            <div style={{
              padding: "9px 14px", background: "#f8fafc",
              borderTop: "1px solid #f1f5f9",
              fontSize: 12, color: "#94a3b8",
            }}>
              Mostrando {filtrados.length} de {usuarios.length} usuarios
            </div>
          )}
        </div>
      )}

      {/* ── Modal nuevo/editar ── */}
      {showModal && createPortal(
        <ModalOverlay onClose={() => setShowModal(false)} maxWidth={620}>
          <div>

            {/* Header con gradiente */}
            <div style={{
              background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
              borderRadius: "12px 12px 0 0",
              padding: "20px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Avatar preview */}
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "rgba(255,255,255,.2)",
                  border: "2px solid rgba(255,255,255,.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: 16,
                }}>
                  {form.nombres?.[0] || form.apellidos?.[0]
                    ? `${form.nombres?.[0] || ""}${form.apellidos?.[0] || ""}`.toUpperCase()
                    : <i className="bi bi-person-fill" style={{ fontSize: 20 }} />
                  }
                </div>
                <div>
                  <h5 style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 16 }}>
                    {editId ? "Editar usuario" : "Nuevo usuario"}
                  </h5>
                  <div style={{ color: "rgba(255,255,255,.7)", fontSize: 12, marginTop: 2 }}>
                    {editId ? "Modifica los datos del usuario" : "Completa la información para crear la cuenta"}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{
                background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)",
                borderRadius: 8, cursor: "pointer", color: "#fff",
                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-x-lg" style={{ fontSize: 14 }} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div style={{ padding: "22px 24px" }}>
                {error && <ErrorAlert msg={error} />}

                {/* Sección: Info personal */}
                <SectionLabel icon="bi-person-vcard" text="Información personal" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", marginBottom: 20 }}>
                  <FieldGroup label="Nombres *">
                    <StyledInput
                      value={form.nombres} required placeholder="Ej. Juan Carlos"
                      onChange={(e) => setForm({ ...form, nombres: e.target.value })}
                      icon="bi-person"
                    />
                  </FieldGroup>
                  <FieldGroup label="Apellidos *">
                    <StyledInput
                      value={form.apellidos} required placeholder="Ej. García López"
                      onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                      icon="bi-person"
                    />
                  </FieldGroup>
                  <FieldGroup label="Teléfono">
                    <StyledInput
                      value={form.telefono} placeholder="Ej. 9999-9999"
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      icon="bi-telephone"
                    />
                  </FieldGroup>
                  {form.tipo === "MEDICO" || form.tipo === "PSICOLOGO" && (
                    <FieldGroup label="Nº Colegiatura">
                      <StyledInput
                        value={form.numero_colegiatura} placeholder="CMH-0000"
                        onChange={(e) => setForm({ ...form, numero_colegiatura: e.target.value })}
                        icon="bi-patch-check"
                      />
                    </FieldGroup>
                  )}
                </div>

                {/* Sección: Acceso */}
                <SectionLabel icon="bi-shield-lock" text="Acceso al sistema" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", marginBottom: 20 }}>
                  <FieldGroup label="Email *">
                    <StyledInput
                      type="email" value={form.email} required placeholder="correo@ejemplo.com"
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      icon="bi-envelope"
                    />
                  </FieldGroup>
                  {!editId && (
                    <FieldGroup label="Contraseña *">
                      <div style={{ position: "relative" }}>
                        <i className="bi bi-lock" style={{
                          position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
                          color: "#94a3b8", fontSize: 13, pointerEvents: "none",
                        }} />
                        <input
                          type={showPass ? "text" : "password"}
                          value={form.password} required placeholder="Mínimo 8 caracteres"
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          style={{
                            width: "100%", padding: "9px 38px 9px 32px",
                            border: "1.5px solid #e2e8f0", borderRadius: 9,
                            fontSize: 13, outline: "none", boxSizing: "border-box",
                            background: "#f8fafc", color: "#1e293b",
                            transition: "border-color .15s, box-shadow .15s",
                          }}
                          onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,.1)"; e.target.style.background = "#fff"; }}
                          onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; e.target.style.background = "#f8fafc"; }}
                        />
                        <button type="button" onClick={() => setShowPass(v => !v)} style={{
                          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                          background: "none", border: "none", cursor: "pointer",
                          color: showPass ? "#3b82f6" : "#94a3b8", fontSize: 15, padding: 2,
                          display: "flex", alignItems: "center",
                        }}>
                          <i className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"}`} />
                        </button>
                      </div>
                      {form.password.length > 0 && <PasswordStrength pass={form.password} />}
                    </FieldGroup>
                  )}
                </div>

                {/* Sección: Rol */}
                <SectionLabel icon="bi-briefcase" text="Rol y permisos" />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {TIPOS.map(t => {
                    const cfg = TIPO_CONFIG[t] || { color: "#6b7280", bg: "#f3f4f6" };
                    const active = form.tipo === t;
                    return (
                      <button key={t} type="button" onClick={() => setForm({ ...form, tipo: t })} style={{
                        padding: "7px 14px", borderRadius: 9, cursor: "pointer",
                        fontSize: 12, fontWeight: 600,
                        background: active ? cfg.color : cfg.bg,
                        color: active ? "#fff" : cfg.color,
                        border: `1.5px solid ${active ? cfg.color : cfg.color + "40"}`,
                        transition: "all .15s",
                      }}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>

                {form.tipo === "MEDICO" || form.tipo === "PSICOLOGO" && (
                  <FieldGroup label="Especialidad">
                    <div style={{ position: "relative" }}>
                      <i className="bi bi-hospital" style={{
                        position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
                        color: "#94a3b8", fontSize: 13, pointerEvents: "none",
                      }} />
                      <select
                        value={form.especialidad_id}
                        onChange={(e) => setForm({ ...form, especialidad_id: e.target.value })}
                        style={{
                          width: "100%", padding: "9px 12px 9px 32px",
                          border: "1.5px solid #e2e8f0", borderRadius: 9,
                          fontSize: 13, outline: "none", background: "#f8fafc",
                          color: "#1e293b", boxSizing: "border-box", appearance: "auto",
                        }}
                      >
                        <option value="">— Sin especialidad —</option>
                        {especialidades.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                      </select>
                    </div>
                  </FieldGroup>
                )}

                {editId && (
                  <div style={{
                    marginTop: 14, padding: "10px 14px", borderRadius: 9,
                    background: form.activo ? "#ecfdf5" : "#f8fafc",
                    border: `1px solid ${form.activo ? "#a7f3d0" : "#e2e8f0"}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: form.activo ? "#10b981" : "#94a3b8",
                        display: "inline-block",
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: form.activo ? "#065f46" : "#475569" }}>
                        {form.activo ? "Usuario activo" : "Usuario inactivo"}
                      </span>
                    </div>
                    <div
                      onClick={() => setForm({ ...form, activo: form.activo ? 0 : 1 })}
                      style={{
                        width: 42, height: 24, borderRadius: 12, cursor: "pointer",
                        background: form.activo ? "#10b981" : "#cbd5e1",
                        position: "relative", transition: "background .2s", flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 3,
                        left: form.activo ? 21 : 3,
                        width: 18, height: 18, borderRadius: "50%",
                        background: "#fff", transition: "left .2s",
                        boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                      }} />
                    </div>
                  </div>
                )}
              </div>

              <ModalFooter>
                <button type="button" onClick={() => setShowModal(false)} style={{
                  padding: "9px 18px", borderRadius: 9, border: "1px solid #e2e8f0",
                  background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}>
                  Cancelar
                </button>
                <button type="submit" style={{
                  padding: "9px 22px", borderRadius: 9, border: "none",
                  background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: "0 4px 12px rgba(59,130,246,.35)",
                }}>
                  <i className={`bi ${editId ? "bi-check-lg" : "bi-person-plus-fill"}`} />
                  {editId ? "Guardar cambios" : "Crear usuario"}
                </button>
              </ModalFooter>
            </form>
          </div>
        </ModalOverlay>,
        document.body
      )}

      {/* ── Modal reset contraseña ── */}
      {resetPass.id && createPortal(
        <ModalOverlay onClose={() => setResetPass({ id: null, pass: "" })} maxWidth={440}>
          <div>
            <ModalHeader
              title="Restablecer contraseña"
              icon="bi-key-fill"
              color="#8b5cf6"
              onClose={() => setResetPass({ id: null, pass: "" })}
            />
            <div style={{ padding: "20px 24px" }}>
              {error && <ErrorAlert msg={error} />}
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
                Ingresa la nueva contraseña para este usuario. Mínimo 8 caracteres.
              </p>
              <FormLabel>Nueva contraseña</FormLabel>
              <div className="input-group">
                <input className="form-control" type={showResetPass ? "text" : "password"}
                  value={resetPass.pass}
                  onChange={(e) => setResetPass({ ...resetPass, pass: e.target.value })} />
                <button type="button" className="btn btn-outline-secondary"
                  onClick={() => setShowResetPass(!showResetPass)}>
                  <i className={`bi ${showResetPass ? "bi-eye-slash" : "bi-eye"}`} />
                </button>
              </div>
              {resetPass.pass.length > 0 && (
                <PasswordStrength pass={resetPass.pass} />
              )}
            </div>
            <ModalFooter>
              <button className="btn btn-light" onClick={() => setResetPass({ id: null, pass: "" })}>Cancelar</button>
              <button className="btn btn-primary px-4" onClick={guardarResetPass}
                disabled={resetPass.pass.length < 8}>
                <i className="bi bi-check-lg me-1" />
                Cambiar contraseña
              </button>
            </ModalFooter>
          </div>
        </ModalOverlay>,
        document.body
      )}

      {/* ── Modal eliminar ── */}
      {deleteConfirm.id && createPortal(
        <ModalOverlay onClose={() => { setDeleteConfirm({ id: null, nombre: "", texto: "" }); setError(""); }} maxWidth={460}>
          <div>
            <div style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid #fee2e2",
              background: "linear-gradient(135deg, #fef2f2, #fff0f0)",
              borderRadius: "12px 12px 0 0",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "#fecaca", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="bi bi-trash3-fill" style={{ color: "#dc2626", fontSize: 16 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#dc2626", fontSize: 15 }}>Eliminar usuario</div>
                  <div style={{ fontSize: 11, color: "#ef4444" }}>Esta acción no se puede deshacer</div>
                </div>
              </div>
              <button onClick={() => { setDeleteConfirm({ id: null, nombre: "", texto: "" }); setError(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18 }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              {error && <ErrorAlert msg={error} />}
              <div style={{
                background: "#fff7ed", border: "1px solid #fed7aa",
                borderRadius: 8, padding: "12px 14px", marginBottom: 18,
              }}>
                <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
                  Se eliminará permanentemente al usuario:
                </p>
                <p style={{ margin: "6px 0 0", fontWeight: 700, color: "#78350f", fontSize: 14 }}>
                  <i className="bi bi-person-fill me-2" />
                  {deleteConfirm.nombre}
                </p>
              </div>
              <FormLabel>Escribe <code style={{ background: "#fee2e2", color: "#dc2626", padding: "1px 5px", borderRadius: 4 }}>ELIMINAR</code> para confirmar:</FormLabel>
              <input
                className="form-control"
                placeholder="ELIMINAR"
                value={deleteConfirm.texto}
                onChange={(e) => { setDeleteConfirm({ ...deleteConfirm, texto: e.target.value }); setError(""); }}
                autoFocus
                style={{ borderColor: deleteConfirm.texto === "ELIMINAR" ? "#dc2626" : undefined }}
              />
            </div>
            <ModalFooter>
              <button className="btn btn-light"
                onClick={() => { setDeleteConfirm({ id: null, nombre: "", texto: "" }); setError(""); }}>
                Cancelar
              </button>
              <button className="btn btn-danger px-4" onClick={eliminarUsuario}
                disabled={deleteConfirm.texto !== "ELIMINAR"}>
                <i className="bi bi-trash3-fill me-1" />
                Eliminar permanentemente
              </button>
            </ModalFooter>
          </div>
        </ModalOverlay>,
        document.body
      )}
    </div>
  );
}

/* ── Pequeños helpers de UI ── */

function ActionBtn({ icon, color, title, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 7, border: `1px solid ${color}25`,
        background: `${color}10`, color, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, transition: "all .15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = "#fff"; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.color = color; }}
    >
      <i className={`bi ${icon}`} />
    </button>
  );
}

function ModalOverlay({ children, onClose, maxWidth = 620 }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,.55)",
        backdropFilter: "blur(3px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1055, padding: 16,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 12,
        width: "100%", maxWidth,
        boxShadow: "0 20px 60px rgba(0,0,0,.25)",
        animation: "fadeSlideUp .2s ease",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {children}
      </div>
      <style>{`@keyframes fadeSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

function ModalHeader({ title, icon, color, onClose }) {
  return (
    <div style={{
      padding: "18px 24px 16px",
      borderBottom: "1px solid #f1f5f9",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className={`bi ${icon}`} style={{ color, fontSize: 16 }} />
        </div>
        <h5 style={{ margin: 0, fontWeight: 700, color: "#1e293b", fontSize: 15 }}>{title}</h5>
      </div>
      <button onClick={onClose} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "#94a3b8", fontSize: 18, lineHeight: 1, padding: 2,
      }}>
        <i className="bi bi-x-lg" />
      </button>
    </div>
  );
}

function ModalFooter({ children }) {
  return (
    <div style={{
      padding: "14px 24px", borderTop: "1px solid #f1f5f9",
      display: "flex", justifyContent: "flex-end", gap: 8,
      background: "#f8fafc", borderRadius: "0 0 12px 12px",
    }}>
      {children}
    </div>
  );
}

function FormLabel({ children }) {
  return <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>{children}</label>;
}

function ErrorAlert({ msg }) {
  return (
    <div style={{
      background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
      padding: "9px 12px", color: "#dc2626", fontSize: 12, marginBottom: 14,
      display: "flex", alignItems: "center", gap: 7,
    }}>
      <i className="bi bi-exclamation-circle-fill" />{msg}
    </div>
  );
}

function SectionLabel({ icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
      <i className={`bi ${icon}`} style={{ color: "#3b82f6", fontSize: 13 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.6px" }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
    </div>
  );
}

function FieldGroup({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function StyledInput({ icon, ...props }) {
  return (
    <div style={{ position: "relative" }}>
      {icon && (
        <i className={`bi ${icon}`} style={{
          position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
          color: "#94a3b8", fontSize: 13, pointerEvents: "none",
        }} />
      )}
      <input
        {...props}
        style={{
          width: "100%", padding: icon ? "9px 12px 9px 32px" : "9px 12px",
          border: "1.5px solid #e2e8f0", borderRadius: 9,
          fontSize: 13, outline: "none", boxSizing: "border-box",
          background: "#f8fafc", color: "#1e293b",
          transition: "border-color .15s, box-shadow .15s",
        }}
        onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,.1)"; e.target.style.background = "#fff"; }}
        onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.boxShadow = "none"; e.target.style.background = "#f8fafc"; }}
      />
    </div>
  );
}

function PasswordStrength({ pass }) {
  const strength = pass.length >= 12 ? 3 : pass.length >= 8 ? 2 : 1;
  const labels = ["", "Débil", "Moderada", "Fuerte"];
  const colors = ["", "#ef4444", "#f59e0b", "#10b981"];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= strength ? colors[strength] : "#e2e8f0",
            transition: "background .3s",
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: colors[strength] }}>{labels[strength]}</span>
    </div>
  );
}
