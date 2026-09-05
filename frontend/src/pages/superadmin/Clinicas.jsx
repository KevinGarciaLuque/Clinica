import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import api from "../../api/api";
import ClinicaDetallesModal from "../../components/ClinicaDetallesModal";

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
  nombre: "", slug: "", tipo_id: "", es_pediatrica: false, titulo_medico: true, email: "", telefono: "", direccion: "", ciudad: "", pais: "PE", ruc: "",
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
  const [tab, setTab]             = useState("todas");
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState("");
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered]     = useState(null);
  const [showAdminPass, setShowAdminPass] = useState(false);
  
  // Modal de confirmación de eliminación
  const [modalEliminar, setModalEliminar] = useState(false);
  const [modalDesbloqueo, setModalDesbloqueo] = useState(null);
  const [clinicaEliminar, setClinicaEliminar] = useState(null);
  const [textoConfirmacion, setTextoConfirmacion] = useState("");

  // Modal de reenvío de credenciales
  const [modalCredenciales, setModalCredenciales] = useState(false);
  const [clinicaCredenciales, setClinicaCredenciales] = useState(null);
  const [reenviandoCred, setReenviandoCred] = useState(false);

  // Modal de configuración de módulos
  const [showModulosModal, setShowModulosModal] = useState(false);
  const [allModulos, setAllModulos] = useState([]);

  // Modal de gestión de licencia
  const [showLicenciaModal, setShowLicenciaModal]     = useState(false);
  const [clinicaLicencia, setClinicaLicencia]         = useState(null);
  const [licenciaForm, setLicenciaForm]               = useState({ plan_tipo: "anual", inicio_manual: "", fin_manual: "", meses_manual: "", notas: "" });
  const [licenciaGuardando, setLicenciaGuardando]     = useState(false);

  // Modal de detalles / uso de espacio
  const [showDetallesModal, setShowDetallesModal] = useState(false);
  const [clinicaDetalles, setClinicaDetalles]     = useState(null);
  const [showPermisosModal, setShowPermisosModal] = useState(false);
  const [permisosClinica, setPermisosClinica] = useState(null);
  const [usuarioPermisosSel, setUsuarioPermisosSel] = useState("");
  const [usuarioPermisosDetalle, setUsuarioPermisosDetalle] = useState(null);

  // Solicitudes de licencia pendientes
  const [solicitudes, setSolicitudes]     = useState([]);
  const [solCargando, setSolCargando]     = useState(false);

  const cargarSolicitudes = useCallback(async () => {
    setSolCargando(true);
    try {
      const r = await api.get("/clinicas/solicitudes-licencia");
      setSolicitudes(r.data.data || []);
    } catch {}
    finally { setSolCargando(false); }
  }, []);

  const atenderYActivar = async (sol) => {
    // Marcar solicitud como atendida y abrir modal de licencia de esa clínica
    try {
      await api.put(`/clinicas/solicitudes-licencia/${sol.id}/atender`);
      setSolicitudes(prev => prev.filter(s => s.id !== sol.id));
    } catch {}
    // Buscar la clínica en el estado y abrir el modal de licencia
    const c = clinicas.find(cl => cl.id === sol.clinica_id);
    if (c) {
      setClinicaLicencia(c);
      setLicenciaForm({ plan_tipo: sol.plan_solicitado, inicio_manual: "", fin_manual: "", meses_manual: "", notas: `Solicitud #${sol.id} atendida` });
      setShowLicenciaModal(true);
    }
  };

  const desestimar = async (id) => {
    try {
      await api.put(`/clinicas/solicitudes-licencia/${id}/atender`);
      setSolicitudes(prev => prev.filter(s => s.id !== id));
    } catch {}
  };


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

  useEffect(() => { cargar(); cargarSolicitudes(); }, [cargar, cargarSolicitudes]);

  const abrirNuevo = () => {
    setForm({ ...EMPTY_C, ...EMPTY_A }); setEditId(null); setError(""); setShowModal(true);
  };

  const abrirEditar = async (c) => {
    setForm({ nombre: c.nombre, slug: c.slug,
              tipo_id: c.tipo_id != null ? String(c.tipo_id) : "",
              es_pediatrica: !!c.es_pediatrica,
              titulo_medico: c.titulo_medico == null ? true : !!c.titulo_medico,
              email: c.email||"", telefono: c.telefono||"",
              direccion: c.direccion||"", ciudad: c.ciudad||"",
              pais: c.pais||"PE", ruc: c.ruc||"",
              inactividad_minutos: "20",
              ...EMPTY_A });
    setEditId(c.id); setError(""); setShowModal(true);
    // Cargar config de la clínica para obtener inactividad_minutos
    try {
      const r = await api.get(`/clinicas/${c.id}`);
      const configArr = r.data?.data?.config || [];
      const min = configArr.find(x => x.clave === "inactividad_minutos")?.valor || "20";
      const tm = r.data?.data?.titulo_medico;
      setForm(f => ({ ...f, inactividad_minutos: min, titulo_medico: tm == null ? true : !!tm }));
    } catch (_) {}
  };

  const guardar = async (e) => {
    e.preventDefault(); setError("");
    try {
      if (editId) {
        await api.put(`/clinicas/${editId}`, form);
        // Guardar config de inactividad por separado en clinica_config
        const min = Math.min(120, Math.max(5, parseInt(form.inactividad_minutos) || 20));
        await api.put(`/clinicas/${editId}/config`, { config: { inactividad_minutos: String(min) } });
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

  const aplicarBloqueo = async (c, nuevo) => {
    try {
      await api.put(`/clinicas/${c.id}/bloqueo`, { bloqueada: nuevo });
      setClinicas(prev => prev.map(x => x.id === c.id ? { ...x, bloqueada: nuevo } : x));
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const toggleBloqueo = (c) => {
    if (c.bloqueada) setModalDesbloqueo(c);   // pedir confirmación para quitar el candado
    else             aplicarBloqueo(c, 1);
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

  const abrirReenviarCredenciales = (c) => {
    setClinicaCredenciales(c);
    setError("");
    setModalCredenciales(true);
  };

  const confirmarReenvioCredenciales = async () => {
    if (!clinicaCredenciales) return;
    setReenviandoCred(true);
    setError("");
    try {
      await api.post(`/clinicas/${clinicaCredenciales.id}/reenviar-credenciales`);
      setModalCredenciales(false);
      setClinicaCredenciales(null);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setReenviandoCred(false);
    }
  };

  /* ── Módulos por categoría ── */
  const abrirModulosConfig = async () => {
    try {
      const r = await api.get("/clinicas/modulos/configuracion");
      setAllModulos(r.data.data);
      setShowModulosModal(true);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const toggleModuloFlag = async (modId, campo, valor) => {
    try {
      await api.put(`/clinicas/modulos/${modId}/configuracion`, { [campo]: valor });
      setAllModulos((prev) =>
        prev.map((m) => (m.id === modId ? { ...m, [campo]: valor ? 1 : 0 } : m))
      );
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const abrirPermisosModulo = async (clinica) => {
    try {
      const r = await api.get(`/clinicas/${clinica.id}/modulos-permisos`);
      setPermisosClinica(r.data.data);
      setUsuarioPermisosSel("");
      setUsuarioPermisosDetalle(null);
      setShowPermisosModal(true);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const toggleModuloClinica = async (modulo, value) => {
    if (!permisosClinica?.clinica?.id) return;
    try {
      await api.put(`/clinicas/${permisosClinica.clinica.id}/modulos-permisos/clinica`, {
        modulo_id: modulo.id,
        habilitado: value,
      });
      setPermisosClinica((prev) => ({
        ...prev,
        modulos: prev.modulos.map((m) => (m.id === modulo.id ? { ...m, habilitado_clinica: value ? 1 : 0 } : m)),
      }));
      if (usuarioPermisosDetalle) {
        setUsuarioPermisosDetalle((prev) => ({
          ...prev,
          modulos: prev.modulos.map((m) => (m.modulo_id === modulo.id ? { ...m, habilitado_clinica: value ? 1 : 0 } : m)),
        }));
      }
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const cargarPermisosUsuario = async (usuarioId) => {
    if (!usuarioId || !permisosClinica?.clinica?.id) return;
    try {
      const r = await api.get(`/clinicas/${permisosClinica.clinica.id}/modulos-permisos/usuario/${usuarioId}`);
      setUsuarioPermisosDetalle(r.data.data);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const toggleModuloUsuario = async (modulo, value) => {
    if (!usuarioPermisosDetalle?.usuario?.id || !permisosClinica?.clinica?.id) return;
    try {
      await api.put(`/clinicas/${permisosClinica.clinica.id}/modulos-permisos/usuario/${usuarioPermisosDetalle.usuario.id}`, {
        modulo_id: modulo.modulo_id,
        habilitado: value,
      });
      setUsuarioPermisosDetalle((prev) => ({
        ...prev,
        modulos: prev.modulos.map((m) => (m.modulo_id === modulo.modulo_id ? { ...m, habilitado_usuario: value ? 1 : 0 } : m)),
      }));
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const reaplicarPresetClinica = async () => {
    if (!permisosClinica?.clinica?.id) return;
    try {
      await api.post(`/clinicas/${permisosClinica.clinica.id}/modulos-permisos/reaplicar-preset`);
      const r = await api.get(`/clinicas/${permisosClinica.clinica.id}/modulos-permisos`);
      setPermisosClinica(r.data.data);
      if (usuarioPermisosSel) await cargarPermisosUsuario(usuarioPermisosSel);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  /* ── Helpers de licencia ── */
  const getLicenciaStatus = (c) => {
    if (!c.licencia_fin) return { label: "Sin licencia", color: C.muted, bg: "rgba(148,163,184,.08)", icon: "bi-slash-circle", tipo: "ninguna" };
    const fin   = new Date(c.licencia_fin);
    const ahora = new Date();
    const dias  = Math.ceil((fin - ahora) / 86400000);
    if (dias <= 0)  return { label: "Vencida",         color: "#ef4444", bg: "rgba(239,68,68,.1)",   icon: "bi-x-circle-fill",           tipo: "vencida",    dias: 0 };
    if (dias <= 7)  return { label: `${dias}d crítico`, color: "#ef4444", bg: "rgba(239,68,68,.08)",  icon: "bi-exclamation-circle-fill",  tipo: "critica",    dias };
    if (dias <= 30) return { label: `${dias}d rest.`,   color: "#f59e0b", bg: "rgba(245,158,11,.08)", icon: "bi-exclamation-triangle-fill",tipo: "por_vencer", dias };
    return              { label: `${dias}d`,            color: "#10b981", bg: "rgba(16,185,129,.08)", icon: "bi-check-circle-fill",        tipo: "activa",     dias };
  };

  const PLAN_LABEL = { trial: "Prueba", semestral: "Semestral", anual: "Anual" };

  // Un "cliente" = plan de pago vigente (semestral o anual, no vencido) y activa.
  const esCliente = (c) => {
    if (!c.activo) return false;
    if (!["semestral", "anual"].includes(c.plan_tipo)) return false;
    return getLicenciaStatus(c).tipo !== "vencida";
  };

  // A qué pestaña pertenece cada clínica.
  const perteneceATab = (c, t) => {
    if (t === "todas") return true;
    if (t === "inactivas") return !c.activo;
    if (!c.activo) return false;
    if (t === "clientes") return esCliente(c);
    const venc = getLicenciaStatus(c).tipo === "vencida";
    if (t === "vencidas") return venc;
    if (venc) return false;
    if (t === "prueba") return !c.plan_tipo || c.plan_tipo === "trial";
    return c.plan_tipo === t; // "semestral" | "anual"
  };

  const porBusqueda = clinicas.filter((c) =>
    `${c.nombre} ${c.slug}`.toLowerCase().includes(busqueda.toLowerCase())
  );
  const filtradas = porBusqueda.filter((c) => perteneceATab(c, tab));

  const TABS = [
    { key: "todas",     label: "Todas",     icon: "bi-grid-3x3-gap-fill", color: "#64748b" },
    { key: "clientes",  label: "Clientes",  icon: "bi-patch-check-fill",  color: "#10b981" },
    { key: "prueba",    label: "Prueba",    icon: "bi-clock-history",     color: "#f59e0b" },
    { key: "semestral", label: "Semestral", icon: "bi-calendar2-check",   color: "#2196f3" },
    { key: "anual",     label: "Anual",     icon: "bi-award-fill",        color: "#8b5cf6" },
    { key: "vencidas",  label: "Vencidas",  icon: "bi-x-octagon-fill",    color: "#ef4444" },
    { key: "inactivas", label: "Inactivas", icon: "bi-pause-circle-fill", color: "#94a3b8" },
  ].map(t => ({ ...t, count: porBusqueda.filter(c => perteneceATab(c, t.key)).length }));

  const abrirLicencia = (c) => {
    setClinicaLicencia(c);
    setLicenciaForm({ plan_tipo: c.plan_tipo || "anual", inicio_manual: "", fin_manual: "", meses_manual: "", notas: "" });
    setShowLicenciaModal(true);
    setError("");
  };

  const guardarLicencia = async () => {
    setLicenciaGuardando(true);
    setError("");
    try {
      await api.post(`/clinicas/${clinicaLicencia.id}/licencia`, licenciaForm);
      setShowLicenciaModal(false);
      cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setLicenciaGuardando(false);
    }
  };

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
            onClick={abrirModulosConfig}
            style={{
              background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.25)",
              borderRadius: 10, padding: "10px 20px",
              color: C.success, fontWeight: 600, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              transition: "opacity .2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = ".85"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
          >
            <i className="bi bi-puzzle-fill" />
            Módulos
          </button>

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

      {/* ── Panel de solicitudes de licencia pendientes ───────── */}
      {solicitudes.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, rgba(245,158,11,.08), rgba(245,158,11,.04))",
          border: "1px solid rgba(245,158,11,.3)", borderRadius: 14,
          marginBottom: 24, overflow: "hidden",
        }}>
          {/* Header del panel */}
          <div style={{
            padding: "12px 20px", borderBottom: "1px solid rgba(245,158,11,.2)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "rgba(245,158,11,.2)", border: "1px solid rgba(245,158,11,.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="bi bi-bell-fill" style={{ color: "#f59e0b", fontSize: 13 }} />
            </div>
            <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: 14 }}>
              {solicitudes.length} solicitud{solicitudes.length !== 1 ? "es" : ""} de activación de licencia
            </span>
            <button
              onClick={cargarSolicitudes}
              disabled={solCargando}
              style={{
                marginLeft: "auto", background: "transparent", border: "none",
                color: C.muted, cursor: "pointer", fontSize: 13, padding: "2px 6px",
              }}
              title="Actualizar"
            >
              <i className={`bi bi-arrow-clockwise ${solCargando ? "spin" : ""}`} />
            </button>
          </div>

          {/* Lista de solicitudes */}
          {solicitudes.map(s => {
            const PLAN_C = { trial: "#f59e0b", semestral: "#2196f3", anual: "#10b981" };
            const PLAN_L = { trial: "Prueba", semestral: "Semestral", anual: "Anual" };
            const col    = PLAN_C[s.plan_solicitado] || C.muted;
            const fecha  = new Date(s.creado_en).toLocaleDateString("es-PE", {
              day: "2-digit", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            });
            return (
              <div key={s.id} style={{
                padding: "14px 20px", display: "flex", alignItems: "flex-start",
                gap: 14, borderBottom: "1px solid rgba(245,158,11,.1)",
              }}>
                {/* Ícono clínica */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: `${col}18`, border: `1px solid ${col}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="bi bi-building" style={{ color: col, fontSize: 16 }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#102546" }}>
                      {s.clinica_nombre}
                    </span>
                    <span style={{
                      background: `${col}20`, color: col, border: `1px solid ${col}40`,
                      fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px",
                    }}>
                      Plan {PLAN_L[s.plan_solicitado]}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted }}>{fecha}</span>
                  </div>
                  {s.mensaje && (
                    <div style={{
                      fontSize: 12, color: C.muted, fontStyle: "italic",
                      background: "rgba(255,255,255,.03)", borderRadius: 6,
                      padding: "5px 10px", marginBottom: 8, maxWidth: 500,
                    }}>
                      <i className="bi bi-chat-quote me-2" />"{s.mensaje}"
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => atenderYActivar(s)}
                      style={{
                        background: `linear-gradient(135deg, ${col}, ${col}cc)`,
                        border: "none", borderRadius: 8, padding: "6px 14px",
                        color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      <i className="bi bi-key-fill me-1" />
                      Activar plan {PLAN_L[s.plan_solicitado]}
                    </button>
                    <button
                      onClick={() => desestimar(s.id)}
                      style={{
                        background: "rgba(148,163,184,.08)", border: `1px solid ${C.border}`,
                        borderRadius: 8, padding: "6px 14px",
                        color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      <i className="bi bi-x me-1" />
                      Desestimar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* ── Pestañas por plan ────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap",
        background: "rgba(255,255,255,.03)", border: `1px solid ${C.border}`,
        borderRadius: 14, padding: 6,
      }}>
        {TABS.map((t) => {
          const activa = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              onMouseEnter={(e) => { if (!activa) e.currentTarget.style.background = "rgba(255,255,255,.05)"; }}
              onMouseLeave={(e) => { if (!activa) e.currentTarget.style.background = "transparent"; }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: activa ? `linear-gradient(135deg, ${t.color}, ${t.color}cc)` : "transparent",
                border: "1px solid transparent",
                color: activa ? "#fff" : C.muted,
                borderRadius: 10, padding: "8px 14px", fontSize: 13,
                fontWeight: activa ? 700 : 600,
                cursor: "pointer", transition: "all .18s",
                boxShadow: activa ? `0 4px 14px ${t.color}55` : "none",
              }}
            >
              <i className={`bi ${t.icon}`} style={{ fontSize: 14, opacity: activa ? 1 : .8 }} />
              {t.label}
              <span style={{
                minWidth: 20, textAlign: "center",
                background: activa ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.06)",
                color: activa ? "#fff" : C.muted,
                borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 800,
              }}>
                {t.count}
              </span>
            </button>
          );
        })}
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
            const cliente = esCliente(c);
            const locked = !!c.bloqueada;
            const lockedBtn = (base) => locked ? { ...base, opacity: 0.4, cursor: "not-allowed", pointerEvents: "none" } : base;
            return (
              <div
                key={c.id}
                onMouseEnter={() => setHovered(c.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: C.card,
                  border: `1px solid ${locked ? "rgba(245,158,11,.5)" : cliente ? "rgba(16,185,129,.4)" : isHov ? "rgba(33,150,243,.35)" : C.border}`,
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
                      {(() => {
                        const esPed = !!c.es_pediatrica;
                        if (c.tipo_nombre) {
                          const label = esPed ? `${c.tipo_nombre} Pediátrica` : c.tipo_nombre;
                          const icon  = esPed ? "bi-balloon-heart-fill" : c.tipo_icono;
                          const color = esPed ? "#9C27B0" : c.tipo_color;
                          return (
                            <div style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              background: `${color}22`,
                              border: `1px solid ${color}55`,
                              borderRadius: 6, padding: "2px 8px",
                            }}>
                              <i className={`bi ${icon}`} style={{ fontSize: 11, color }} />
                              <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
                            </div>
                          );
                        }
                        if (esPed) return (
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            background: "rgba(156,39,176,.12)", border: "1px solid rgba(156,39,176,.3)",
                            borderRadius: 6, padding: "2px 8px",
                          }}>
                            <i className="bi bi-balloon-heart-fill" style={{ fontSize: 11, color: "#9C27B0" }} />
                            <span style={{ fontSize: 11, color: "#9C27B0", fontWeight: 600 }}>Pediátrica</span>
                          </div>
                        );
                        return null;
                      })()}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                    {cliente && (
                      <span style={{
                        padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                        background: "rgba(16,185,129,.18)", color: C.success,
                        border: "1px solid rgba(16,185,129,.4)", whiteSpace: "nowrap", letterSpacing: ".03em",
                      }}>
                        <i className="bi bi-patch-check-fill me-1" />CLIENTE
                      </span>
                    )}
                    {/* Badge estado */}
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
                    {/* Badge licencia */}
                    {(() => { const ls = getLicenciaStatus(c); return (
                      <span style={{
                        padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                        background: ls.bg,
                        color: ls.color,
                        border: `1px solid ${ls.color}40`,
                        whiteSpace: "nowrap", letterSpacing: ".02em",
                      }}>
                        <i className={`bi ${ls.icon} me-1`} />
                        {PLAN_LABEL[c.plan_tipo] || "Trial"} · {ls.label}
                      </span>
                    ); })()}
                  </div>
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
                    onClick={() => abrirPermisosModulo(c)}
                    title="Permisos por módulos y doctores"
                    style={{
                      background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)",
                      borderRadius: 8, padding: "8px 10px",
                      color: C.success, fontSize: 13, cursor: "pointer", transition: "all .2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}
                  >
                    <i className="bi bi-sliders" />
                  </button>
                  <button
                    onClick={() => { setClinicaDetalles(c); setShowDetallesModal(true); }}
                    title="Ver detalles de uso y almacenamiento"
                    style={{
                      background: "rgba(33,150,243,.08)", border: "1px solid rgba(33,150,243,.2)",
                      borderRadius: 8, padding: "8px 10px",
                      color: C.accent, fontSize: 13, cursor: "pointer", transition: "all .2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(33,150,243,.18)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(33,150,243,.08)"}
                  >
                    <i className="bi bi-bar-chart-fill" />
                  </button>
                  <button
                    onClick={() => !locked && abrirLicencia(c)}
                    title={locked ? "Clínica bloqueada" : "Gestionar licencia"}
                    style={lockedBtn({
                      background: (() => { const ls = getLicenciaStatus(c); return ls.bg; })(),
                      border: (() => { const ls = getLicenciaStatus(c); return `1px solid ${ls.color}40`; })(),
                      borderRadius: 8, padding: "8px 10px",
                      color: (() => { const ls = getLicenciaStatus(c); return ls.color; })(),
                      fontSize: 13, cursor: "pointer", transition: "all .2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    })}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = ".75"}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                  >
                    <i className="bi bi-key-fill" />
                  </button>
                  <button
                    onClick={() => abrirReenviarCredenciales(c)}
                    title="Reenviar credenciales de acceso al administrador"
                    style={{
                      background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)",
                      borderRadius: 8, padding: "8px 10px",
                      color: C.warning, fontSize: 13, cursor: "pointer", transition: "all .2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(245,158,11,.18)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(245,158,11,.08)"}
                  >
                    <i className="bi bi-envelope-arrow-up-fill" />
                  </button>
                  <button
                    onClick={() => toggleBloqueo(c)}
                    title={locked ? "Clínica protegida — clic para desbloquear (solo Super Admin)" : "Bloquear clínica para evitar cambios accidentales"}
                    style={{
                      background: locked ? "rgba(245,158,11,.15)" : "rgba(148,163,184,.08)",
                      border: `1px solid ${locked ? "rgba(245,158,11,.45)" : C.border}`,
                      borderRadius: 8, padding: "8px 10px",
                      color: locked ? C.warning : C.muted, fontSize: 13, cursor: "pointer", transition: "all .2s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <i className={`bi bi-${locked ? "lock-fill" : "unlock"}`} />
                  </button>
                  <button
                    onClick={() => !locked && abrirEditar(c)}
                    title={locked ? "Clínica bloqueada" : "Editar"}
                    style={lockedBtn({
                      flex: 1, background: "rgba(33,150,243,.1)", border: "1px solid rgba(33,150,243,.25)",
                      borderRadius: 8, padding: "8px 0", color: C.accent,
                      fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background .2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    })}
                  >
                    <i className="bi bi-pencil-square" />
                    Editar
                  </button>
                  <button
                    onClick={() => !locked && toggleActivo(c)}
                    title={locked ? "Clínica bloqueada" : ""}
                    style={lockedBtn({
                      flex: 1,
                      background: c.activo ? "rgba(245,158,11,.08)" : "rgba(16,185,129,.08)",
                      border: `1px solid ${c.activo ? "rgba(245,158,11,.25)" : "rgba(16,185,129,.25)"}`,
                      borderRadius: 8, padding: "8px 0",
                      color: c.activo ? C.warning : C.success,
                      fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background .2s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    })}
                  >
                    <i className={`bi bi-${c.activo ? "pause-circle" : "play-circle"}`} />
                    {c.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => !locked && eliminarClinica(c)}
                    title={locked ? "Clínica bloqueada" : "Eliminar permanentemente"}
                    style={lockedBtn({
                      background: "rgba(239,68,68,.08)",
                      border: "1px solid rgba(239,68,68,.25)",
                      borderRadius: 8, padding: "8px 12px",
                      color: "#ef4444",
                      fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .2s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    })}
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

      {/* ── Modal (Portal → escapa del stacking context del <main>) ── */}
      {showModal && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,.72)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: "16px", overflowY: "auto",
        }}
        >
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 18, width: "100%", maxWidth: 700,
            margin: "auto",
            display: "flex", flexDirection: "column",
            boxShadow: "0 24px 80px rgba(0,0,0,.6)",
          }}>
            {/* Header modal */}
            <div style={{
              padding: "18px 20px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 12,
              borderRadius: "18px 18px 0 0",
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

            <form onSubmit={guardar} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>

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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
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
                                onClick={() => setForm({ ...form, tipo_id: String(t.id) })}
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
                                  <i className={`bi ${t.clave === "psicologia" ? "bi-activity" : t.icono}`} style={{ fontSize: 14, color: sel ? "#fff" : t.color }} />
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

                    {/* ── Switch Normal / Pediátrica ── */}
                    <div style={{ gridColumn: "1/-1" }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 16,
                        background: form.es_pediatrica ? "rgba(156,39,176,.1)" : "rgba(33,150,243,.06)",
                        border: `1px solid ${form.es_pediatrica ? "rgba(156,39,176,.3)" : C.border}`,
                        borderRadius: 12, padding: "14px 20px",
                        transition: "all .25s",
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                          background: form.es_pediatrica
                            ? "linear-gradient(135deg, #9C27B0, #7B1FA2)"
                            : `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background .25s",
                        }}>
                          <i className={`bi ${form.es_pediatrica ? "bi-balloon-heart-fill" : "bi-building-fill"}`}
                             style={{ fontSize: 18, color: "#fff" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>
                            {form.es_pediatrica ? "Clínica Pediátrica" : "Clínica Normal (Adultos)"}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                            {form.es_pediatrica
                              ? "Módulos pediátricos habilitados (curvas de crecimiento, etc.)"
                              : "Módulos estándar para atención de adultos"}
                          </div>
                        </div>
                        {/* Switch toggle */}
                        <div
                          onClick={() => setForm({ ...form, es_pediatrica: !form.es_pediatrica })}
                          style={{
                            width: 52, height: 28, borderRadius: 14, cursor: "pointer",
                            background: form.es_pediatrica
                              ? "linear-gradient(135deg, #9C27B0, #7B1FA2)"
                              : "rgba(148,163,184,.3)",
                            position: "relative", transition: "background .25s",
                            flexShrink: 0,
                          }}
                        >
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: "#fff", position: "absolute",
                            top: 3,
                            left: form.es_pediatrica ? 27 : 3,
                            transition: "left .25s",
                            boxShadow: "0 2px 6px rgba(0,0,0,.25)",
                          }} />
                        </div>
                      </div>
                    </div>

                    {/* ── Switch mostrar título "Dr./Dra." + especialidad ── */}
                    <div style={{ gridColumn: "1/-1" }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 16,
                        background: form.titulo_medico ? "rgba(33,150,243,.06)" : "rgba(148,163,184,.08)",
                        border: `1px solid ${form.titulo_medico ? C.border : "rgba(148,163,184,.3)"}`,
                        borderRadius: 12, padding: "14px 20px",
                        transition: "all .25s",
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                          background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <i className="bi bi-person-badge-fill" style={{ fontSize: 18, color: "#fff" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>
                            {form.titulo_medico ? 'Mostrar "Dr./Dra." y especialidad' : 'Solo nombre del médico'}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                            {form.titulo_medico
                              ? 'En listados y documentos: "Dr. Juan Pérez – Cardiología"'
                              : 'En listados y documentos: "Juan Pérez" (la especialidad se sigue guardando)'}
                          </div>
                        </div>
                        <div
                          onClick={() => setForm({ ...form, titulo_medico: !form.titulo_medico })}
                          style={{
                            width: 52, height: 28, borderRadius: 14, cursor: "pointer",
                            background: form.titulo_medico
                              ? `linear-gradient(135deg, ${C.accent}, ${C.accentD})`
                              : "rgba(148,163,184,.3)",
                            position: "relative", transition: "background .25s",
                            flexShrink: 0,
                          }}
                        >
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: "#fff", position: "absolute",
                            top: 3,
                            left: form.titulo_medico ? 27 : 3,
                            transition: "left .25s",
                            boxShadow: "0 2px 6px rgba(0,0,0,.25)",
                          }} />
                        </div>
                      </div>
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

                  {/* Config de sesión — solo visible al editar */}
                  {editId && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <i className="bi bi-shield-lock" style={{ fontSize: 12, color: "#f59e0b" }} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>Seguridad de sesión</span>
                        <div style={{ flex: 1, height: 1, background: C.border }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6 }}>
                            Tiempo de inactividad
                          </label>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="number" min={5} max={120}
                              style={{ ...inputSt, width: 90, textAlign: "center" }}
                              value={form.inactividad_minutos}
                              onChange={e => setForm({ ...form, inactividad_minutos: e.target.value })}
                              onFocus={e => e.target.style.borderColor = C.accent}
                              onBlur={e  => e.target.style.borderColor = C.border}
                            />
                            <span style={{ fontSize: 13, color: C.muted }}>minutos</span>
                          </div>
                        </div>
                        <small style={{ color: C.muted, fontSize: 11, marginTop: 18 }}>
                          Minutos sin actividad antes de mostrar el aviso de cierre de sesión (5–120).
                        </small>
                      </div>
                    </div>
                  )}
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
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
                        <div style={{ position: "relative" }}>
                          <input style={{ ...inputSt, paddingRight: 40 }} type={showAdminPass ? "text" : "password"} value={form.admin_password}
                            onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                            onFocus={(e) => e.target.style.borderColor = C.accent}
                            onBlur={(e)  => e.target.style.borderColor = C.border} />
                          <button
                            type="button"
                            onClick={() => setShowAdminPass(v => !v)}
                            style={{
                              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                              background: "transparent", border: "none", cursor: "pointer",
                              color: C.muted, fontSize: 15, padding: 0, lineHeight: 1,
                            }}
                            title={showAdminPass ? "Ocultar contraseña" : "Ver contraseña"}
                          >
                            <i className={`bi bi-eye${showAdminPass ? "-slash" : ""}`} />
                          </button>
                        </div>
                      </Field>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer modal */}
              <div style={{
                padding: "16px 20px", borderTop: `1px solid ${C.border}`,
                display: "flex", justifyContent: "flex-end", gap: 12,
                flexWrap: "wrap", borderRadius: "0 0 18px 18px",
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
        </div>,
        document.body
      )}

      {/* ── Modal de confirmación de eliminación ────────────── */}
      {modalDesbloqueo && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: C.surface, border: "2px solid rgba(245,158,11,.4)",
            borderRadius: 18, width: "100%", maxWidth: 460,
            boxShadow: "0 24px 80px rgba(245,158,11,.25)",
          }}>
            <div style={{ padding: "22px 26px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12, background: "rgba(245,158,11,.15)",
                border: "2px solid rgba(245,158,11,.3)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-unlock-fill" style={{ color: C.warning, fontSize: 20 }} />
              </div>
              <div style={{ flex: 1 }}>
                <h5 style={{ margin: 0, fontWeight: 700, color: C.warning, fontSize: 16 }}>Quitar candado de protección</h5>
                <span style={{ fontSize: 12, color: C.muted }}>Solo Super Admin</span>
              </div>
            </div>
            <div style={{ padding: "22px 26px", fontSize: 14, color: C.text, lineHeight: 1.6 }}>
              La clínica <strong>{modalDesbloqueo.nombre}</strong> quedará expuesta a
              <strong> edición, desactivación y borrado permanente</strong>. Vuelve a activar el candado en cuanto termines.
            </div>
            <div style={{ padding: "16px 26px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => setModalDesbloqueo(null)}
                style={{
                  background: "transparent", border: `1px solid ${C.border}`, borderRadius: 9,
                  padding: "10px 20px", color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { aplicarBloqueo(modalDesbloqueo, 0); setModalDesbloqueo(null); }}
                style={{
                  background: C.warning, border: "none", borderRadius: 9,
                  padding: "10px 20px", color: "#1a1206", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >
                <i className="bi bi-unlock-fill me-1" /> Quitar candado
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {modalEliminar && clinicaEliminar && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
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
        </div>,
        document.body
      )}

      {/* ── Modal: confirmar reenvío de credenciales ── */}
      {modalCredenciales && clinicaCredenciales && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,.72)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: C.surface, border: `1px solid rgba(245,158,11,.4)`,
            borderRadius: 18, width: "100%", maxWidth: 480,
            boxShadow: "0 24px 80px rgba(0,0,0,.5)",
          }}>
            {/* Header modal */}
            <div style={{
              padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-envelope-arrow-up-fill" style={{ color: "#f59e0b", fontSize: 17 }} />
              </div>
              <div style={{ flex: 1 }}>
                <h5 style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 16 }}>
                  Reenviar credenciales
                </h5>
                <span style={{ fontSize: 12, color: C.muted }}>{clinicaCredenciales.nombre}</span>
              </div>
              <button
                onClick={() => { setModalCredenciales(false); setClinicaCredenciales(null); setError(""); }}
                style={{
                  background: "rgba(255,255,255,.05)", border: `1px solid ${C.border}`,
                  borderRadius: 8, width: 32, height: 32,
                  color: C.muted, cursor: "pointer", fontSize: 15,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* Body modal */}
            <div style={{ padding: "20px 24px" }}>
              {error && (
                <div style={{
                  background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)",
                  borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#f87171",
                  display: "flex", alignItems: "center", gap: 10, fontSize: 14,
                }}>
                  <i className="bi bi-exclamation-triangle-fill" /> {error}
                </div>
              )}
              <div style={{
                background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)",
                borderRadius: 10, padding: "14px 16px", fontSize: 13, color: C.muted, lineHeight: 1.6,
              }}>
                Se generará una <strong style={{ color: C.text }}>contraseña nueva</strong> para el administrador
                de esta clínica y se le enviará por correo. La contraseña anterior dejará de funcionar
                de inmediato — si el administrador tiene una sesión abierta, no se cerrará, pero al
                volver a iniciar sesión deberá usar la nueva contraseña.
              </div>
            </div>

            {/* Footer modal */}
            <div style={{
              padding: "16px 24px", borderTop: `1px solid ${C.border}`,
              display: "flex", justifyContent: "flex-end", gap: 12,
            }}>
              <button
                type="button"
                onClick={() => { setModalCredenciales(false); setClinicaCredenciales(null); setError(""); }}
                disabled={reenviandoCred}
                style={{
                  background: "transparent", border: `1px solid ${C.border}`,
                  borderRadius: 9, padding: "9px 20px",
                  color: C.muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarReenvioCredenciales}
                disabled={reenviandoCred}
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  border: "none", borderRadius: 9, padding: "9px 24px",
                  color: "#fff", fontSize: 14, fontWeight: 600,
                  cursor: reenviandoCred ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  opacity: reenviandoCred ? 0.7 : 1,
                }}
              >
                <i className="bi bi-send-fill" />
                {reenviandoCred ? "Reenviando..." : "Sí, reenviar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal de Configuración de Módulos por Categoría ───── */}
      {showModulosModal && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 18, width: "100%", maxWidth: 720,
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 24px 80px rgba(0,0,0,.5)",
          }}>
            {/* Header */}
            <div style={{
              padding: "22px 28px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-puzzle-fill" style={{ color: "#fff", fontSize: 17 }} />
              </div>
              <div style={{ flex: 1 }}>
                <h5 style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 17 }}>
                  Módulos por Categoría
                </h5>
                <span style={{ fontSize: 12, color: C.muted }}>
                  Configura qué módulos aparecen en clínicas normales y/o pediátricas
                </span>
              </div>
              <button
                onClick={() => setShowModulosModal(false)}
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

            {/* Body: tabla de módulos */}
            <div style={{ padding: "20px 28px" }}>
              {/* Leyenda */}
              <div style={{
                display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: C.accent }} />
                  <span style={{ color: C.muted }}>Normal (Adultos)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: "#9C27B0" }} />
                  <span style={{ color: C.muted }}>Pediátrica</span>
                </div>
              </div>

              <div style={{
                borderRadius: 12, overflow: "hidden",
                border: `1px solid ${C.border}`,
              }}>
                {/* Header de tabla */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 100px 100px",
                  background: "rgba(255,255,255,.03)", padding: "10px 16px",
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    Módulo
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: ".05em", textAlign: "center" }}>
                    Normal
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#9C27B0", textTransform: "uppercase", letterSpacing: ".05em", textAlign: "center" }}>
                    Pediátrica
                  </span>
                </div>

                {/* Filas */}
                {allModulos.map((m, idx) => (
                  <div key={m.id} style={{
                    display: "grid", gridTemplateColumns: "1fr 100px 100px",
                    padding: "10px 16px", alignItems: "center",
                    background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,.02)",
                    borderBottom: idx < allModulos.length - 1 ? `1px solid ${C.border}` : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <i className={`bi ${m.icono}`} style={{ fontSize: 15, color: C.accent, width: 20, textAlign: "center" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.nombre}</div>
                        <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{m.clave}</div>
                      </div>
                    </div>

                    {/* Toggle Normal */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div
                        onClick={() => toggleModuloFlag(m.id, "para_normal", !m.para_normal)}
                        style={{
                          width: 42, height: 24, borderRadius: 12, cursor: "pointer",
                          background: m.para_normal
                            ? `linear-gradient(135deg, ${C.accent}, ${C.accentD})`
                            : "rgba(148,163,184,.25)",
                          position: "relative", transition: "background .2s",
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%",
                          background: "#fff", position: "absolute",
                          top: 3, left: m.para_normal ? 21 : 3,
                          transition: "left .2s",
                          boxShadow: "0 1px 4px rgba(0,0,0,.3)",
                        }} />
                      </div>
                    </div>

                    {/* Toggle Pediátrica */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div
                        onClick={() => toggleModuloFlag(m.id, "para_pediatrica", !m.para_pediatrica)}
                        style={{
                          width: 42, height: 24, borderRadius: 12, cursor: "pointer",
                          background: m.para_pediatrica
                            ? "linear-gradient(135deg, #9C27B0, #7B1FA2)"
                            : "rgba(148,163,184,.25)",
                          position: "relative", transition: "background .2s",
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%",
                          background: "#fff", position: "absolute",
                          top: 3, left: m.para_pediatrica ? 21 : 3,
                          transition: "left .2s",
                          boxShadow: "0 1px 4px rgba(0,0,0,.3)",
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "16px 28px", borderTop: `1px solid ${C.border}`,
              display: "flex", justifyContent: "flex-end",
            }}>
              <button
                onClick={() => setShowModulosModal(false)}
                style={{
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                  border: "none", borderRadius: 9, padding: "10px 24px",
                  color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  boxShadow: `0 4px 14px rgba(33,150,243,.35)`,
                }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal de Gestión de Licencia ────────────────────── */}
      {showLicenciaModal && clinicaLicencia && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,.7)", backdropFilter: "blur(5px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 18, width: "100%", maxWidth: 520,
            boxShadow: "0 24px 80px rgba(0,0,0,.5)",
          }}>
            {/* Header */}
            <div style={{
              padding: "22px 28px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-key-fill" style={{ color: "#fff", fontSize: 17 }} />
              </div>
              <div style={{ flex: 1 }}>
                <h5 style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 17 }}>
                  Gestionar Licencia
                </h5>
                <span style={{ fontSize: 12, color: "#ffffff", fontWeight: 600 }}>
                  {clinicaLicencia.nombre}
                </span>
              </div>
              <button
                onClick={() => { setShowLicenciaModal(false); setError(""); }}
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

            {/* Body */}
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
              {error && (
                <div style={{
                  background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.3)",
                  borderRadius: 10, padding: "12px 16px", color: "#f87171",
                  display: "flex", alignItems: "center", gap: 10, fontSize: 14,
                }}>
                  <i className="bi bi-exclamation-triangle-fill" /> {error}
                </div>
              )}

              {/* Estado actual */}
              {(() => {
                const ls = getLicenciaStatus(clinicaLicencia);
                const fin = clinicaLicencia.licencia_fin
                  ? new Date(clinicaLicencia.licencia_fin).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
                  : "—";
                return (
                  <div style={{
                    background: `${ls.bg}`, border: `1px solid ${ls.color}30`,
                    borderRadius: 12, padding: "14px 18px",
                    display: "flex", alignItems: "center", gap: 14,
                  }}>
                    <i className={`bi ${ls.icon}`} style={{ color: ls.color, fontSize: 22 }} />
                    <div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Estado actual</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: ls.color }}>
                        {PLAN_LABEL[clinicaLicencia.plan_tipo] || "Trial"} — {ls.tipo === "vencida" ? "Vencida" : ls.tipo === "activa" ? `${ls.dias} días restantes` : ls.label}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>
                        Vence: <strong style={{ color: C.text }}>{fin}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Selector de plan */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10, display: "block" }}>
                  Seleccionar nuevo plan
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { key: "trial",     label: "Prueba",    sub: "14 días",   icon: "bi-clock-history",   color: "#f59e0b" },
                    { key: "semestral", label: "Semestral", sub: "6 meses",   icon: "bi-calendar2-check", color: C.accent },
                    { key: "anual",     label: "Anual",     sub: "12 meses",  icon: "bi-award-fill",      color: "#10b981", rec: true },
                  ].map(p => {
                    const sel = licenciaForm.plan_tipo === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setLicenciaForm({ ...licenciaForm, plan_tipo: p.key })}
                        style={{
                          background: sel ? `${p.color}20` : "rgba(255,255,255,.03)",
                          border: `2px solid ${sel ? p.color : C.border}`,
                          borderRadius: 12, padding: "14px 10px", cursor: "pointer",
                          textAlign: "center", transition: "all .18s", position: "relative",
                        }}
                      >
                        {p.rec && (
                          <div style={{
                            position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
                            background: p.color, color: "#fff", fontSize: 9, fontWeight: 700,
                            borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap",
                          }}>
                            RECOMENDADO
                          </div>
                        )}
                        <i className={`bi ${p.icon}`} style={{ color: p.color, fontSize: 24, display: "block", marginBottom: 6 }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: sel ? p.color : C.text }}>{p.label}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{p.sub}</div>
                        {sel && <i className="bi bi-check-circle-fill" style={{ color: p.color, fontSize: 14, position: "absolute", top: 8, right: 8 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vigencia a medida: inicio + (meses O fecha de fin exacta) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Inicio del plan" hint="(vacío = hoy)">
                  <input
                    type="date"
                    style={inputSt}
                    value={licenciaForm.inicio_manual}
                    onChange={(e) => setLicenciaForm({ ...licenciaForm, inicio_manual: e.target.value })}
                    onFocus={(e) => e.target.style.borderColor = C.accent}
                    onBlur={(e)  => e.target.style.borderColor = C.border}
                  />
                </Field>
                <Field label="Duración (meses)" hint="(desde el inicio)">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    step="1"
                    placeholder="Ej: 4"
                    style={inputSt}
                    value={licenciaForm.meses_manual}
                    onChange={(e) => setLicenciaForm({ ...licenciaForm, meses_manual: e.target.value, fin_manual: e.target.value ? "" : licenciaForm.fin_manual })}
                    onFocus={(e) => e.target.style.borderColor = C.accent}
                    onBlur={(e)  => e.target.style.borderColor = C.border}
                  />
                </Field>
              </div>
              <Field label="…o fecha de fin exacta" hint="(vacío = según plan / meses)">
                <input
                  type="date"
                  style={inputSt}
                  value={licenciaForm.fin_manual}
                  min={licenciaForm.inicio_manual || undefined}
                  disabled={!!licenciaForm.meses_manual}
                  onChange={(e) => setLicenciaForm({ ...licenciaForm, fin_manual: e.target.value })}
                  onFocus={(e) => e.target.style.borderColor = C.accent}
                  onBlur={(e)  => e.target.style.borderColor = C.border}
                />
              </Field>
              {(licenciaForm.meses_manual || licenciaForm.fin_manual) && (() => {
                const ini = licenciaForm.inicio_manual ? new Date(licenciaForm.inicio_manual + "T00:00:00") : new Date();
                let f;
                if (licenciaForm.meses_manual) {
                  f = new Date(ini);
                  f.setMonth(f.getMonth() + Number(licenciaForm.meses_manual));
                } else {
                  f = new Date(licenciaForm.fin_manual + "T00:00:00");
                }
                const d = Math.ceil((f - ini) / 86400000);
                return (
                  <div style={{ fontSize: 12, color: d > 0 ? C.muted : "#ef4444", marginTop: -6 }}>
                    {d > 0
                      ? `Vigencia: ${d} día${d !== 1 ? "s" : ""} — hasta el ${f.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}.`
                      : "La fecha de fin debe ser posterior al inicio."}
                  </div>
                );
              })()}

              {/* Notas */}
              <Field label="Notas internas" hint="(opcional)">
                <textarea
                  style={{ ...inputSt, resize: "vertical", minHeight: 64 }}
                  placeholder="Ej: Pago recibido por transferencia…"
                  value={licenciaForm.notas}
                  onChange={(e) => setLicenciaForm({ ...licenciaForm, notas: e.target.value })}
                  onFocus={(e) => e.target.style.borderColor = C.accent}
                  onBlur={(e)  => e.target.style.borderColor = C.border}
                />
              </Field>
            </div>

            {/* Footer */}
            <div style={{
              padding: "18px 28px", borderTop: `1px solid ${C.border}`,
              display: "flex", justifyContent: "flex-end", gap: 12,
            }}>
              <button
                type="button"
                onClick={() => { setShowLicenciaModal(false); setError(""); }}
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
                onClick={guardarLicencia}
                disabled={licenciaGuardando}
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  border: "none", borderRadius: 9, padding: "10px 28px",
                  color: "#fff", fontSize: 14, fontWeight: 600, cursor: licenciaGuardando ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  boxShadow: "0 4px 14px rgba(245,158,11,.35)",
                  transition: "opacity .2s",
                  opacity: licenciaGuardando ? 0.7 : 1,
                }}
                onMouseEnter={(e) => !licenciaGuardando && (e.currentTarget.style.opacity = ".85")}
                onMouseLeave={(e) => !licenciaGuardando && (e.currentTarget.style.opacity = "1")}
              >
                <i className={`bi bi-${licenciaGuardando ? "hourglass-split" : "check-lg"}`} />
                {licenciaGuardando ? "Guardando..." : "Activar plan"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal de Detalles / Uso de Espacio ────────────── */}
      {showDetallesModal && clinicaDetalles && createPortal(
        <ClinicaDetallesModal
          clinicaId={clinicaDetalles.id}
          clinicaNombre={clinicaDetalles.nombre}
          onClose={() => { setShowDetallesModal(false); setClinicaDetalles(null); }}
        />,
        document.body
      )}

      {showPermisosModal && permisosClinica?.clinica && createPortal(
        <div className="modal show d-block" style={{ background: "rgba(0,0,0,.62)", zIndex: 9000 }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content" style={{ background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div
                className="modal-header"
                style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <h5 className="modal-title" style={{ fontWeight: 700, marginBottom: 2 }}>
                    Permisos de módulos
                  </h5>
                  <div style={{ fontSize: 13, color: C.muted }}>{permisosClinica.clinica.nombre}</div>
                </div>
                <div className="d-flex align-items-center gap-2" style={{ marginLeft: "auto" }}>
                  <button
                    className="btn btn-sm"
                    onClick={reaplicarPresetClinica}
                    title="Reaplica módulos según tipo/especialidad de clínica"
                    style={{
                      background: "rgba(255,193,7,.12)",
                      border: "1px solid rgba(255,193,7,.4)",
                      color: "#ffc107",
                      fontWeight: 600,
                      borderRadius: 8,
                    }}
                  >
                    <i className="bi bi-arrow-repeat me-1"></i>Reaplicar preset
                  </button>
                  <button className="btn-close btn-close-white" onClick={() => setShowPermisosModal(false)} />
                </div>
              </div>
              <div className="modal-body" style={{ padding: 24 }}>
                <div className="row g-4">
                  <div className="col-lg-6">
                    <div className="d-flex align-items-center gap-2" style={{ marginBottom: 4 }}>
                      <i className="bi bi-hospital" style={{ color: C.accent }} />
                      <h6 style={{ color: C.accent, fontWeight: 700, margin: 0 }}>Por clínica</h6>
                    </div>
                    <div className="small" style={{ color: C.muted, marginBottom: 12 }}>
                      Estos permisos aplican a toda la clínica.
                    </div>
                    <div style={{ maxHeight: 440, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      {permisosClinica.modulos.map((m, i) => {
                        const on = Number(m.habilitado_clinica) === 1;
                        return (
                          <label
                            key={m.id}
                            htmlFor={`mod-clinica-${m.id}`}
                            style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              padding: "12px 14px", cursor: "pointer",
                              borderBottom: i === permisosClinica.modulos.length - 1 ? "none" : `1px solid ${C.border}`,
                              transition: "background .12s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.03)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: on ? C.text : C.muted }}>{m.nombre}</div>
                              <div style={{ fontSize: 11.5, color: C.muted, fontFamily: "monospace" }}>{m.clave}</div>
                            </div>
                            <div className="form-check form-switch" style={{ margin: 0 }}>
                              <input
                                id={`mod-clinica-${m.id}`}
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                style={{ width: 40, height: 22, cursor: "pointer" }}
                                checked={on}
                                onChange={(e) => toggleModuloClinica(m, e.target.checked)}
                              />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="d-flex align-items-center gap-2" style={{ marginBottom: 4 }}>
                      <i className="bi bi-person-badge" style={{ color: C.success }} />
                      <h6 style={{ color: C.success, fontWeight: 700, margin: 0 }}>Por doctor/usuario</h6>
                    </div>
                    <div className="small" style={{ color: C.muted, marginBottom: 12 }}>
                      Excepciones individuales sobre permisos de clínica.
                    </div>
                    <select
                      className="form-select mb-3"
                      value={usuarioPermisosSel}
                      onChange={(e) => {
                        setUsuarioPermisosSel(e.target.value);
                        setUsuarioPermisosDetalle(null);
                        if (e.target.value) cargarPermisosUsuario(e.target.value);
                      }}
                      style={{ background: C.inputBg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8 }}
                    >
                      <option value="">Selecciona usuario...</option>
                      {permisosClinica.usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.apellidos} {u.nombres} ({u.tipo})
                        </option>
                      ))}
                    </select>
                    {usuarioPermisosDetalle ? (
                      <div style={{ maxHeight: 380, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
                        {usuarioPermisosDetalle.modulos.map((m, i) => {
                          const tieneOverride = m.habilitado_usuario !== null && m.habilitado_usuario !== undefined;
                          const clinicaOn = Number(m.habilitado_clinica) === 1;
                          const efectivo = tieneOverride ? Number(m.habilitado_usuario) === 1 : clinicaOn;
                          return (
                            <label
                              key={m.modulo_id}
                              htmlFor={`mod-usuario-${m.modulo_id}`}
                              style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "12px 14px", cursor: "pointer",
                                borderBottom: i === usuarioPermisosDetalle.modulos.length - 1 ? "none" : `1px solid ${C.border}`,
                                transition: "background .12s",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.03)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14, color: efectivo ? C.text : C.muted }}>{m.nombre}</div>
                                <div className="d-flex align-items-center gap-2" style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                                  <span>Clínica: {clinicaOn ? "ON" : "OFF"}</span>
                                  {tieneOverride && (
                                    <span
                                      style={{
                                        fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20,
                                        background: "rgba(255,193,7,.14)", color: "#ffc107", border: "1px solid rgba(255,193,7,.35)",
                                      }}
                                    >
                                      OVERRIDE
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="form-check form-switch" style={{ margin: 0 }}>
                                <input
                                  id={`mod-usuario-${m.modulo_id}`}
                                  className="form-check-input"
                                  type="checkbox"
                                  role="switch"
                                  style={{ width: 40, height: 22, cursor: "pointer" }}
                                  checked={efectivo}
                                  onChange={(e) => toggleModuloUsuario(m, e.target.checked)}
                                />
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        className="d-flex flex-column align-items-center justify-content-center text-center"
                        style={{ color: C.muted, fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 10, padding: "40px 16px" }}
                      >
                        <i className="bi bi-person-lines-fill" style={{ fontSize: 24, marginBottom: 8, opacity: .5 }} />
                        Selecciona un usuario para ajustar permisos individuales.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: `1px solid ${C.border}`, padding: "14px 24px" }}>
                <button className="btn btn-secondary" onClick={() => setShowPermisosModal(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
