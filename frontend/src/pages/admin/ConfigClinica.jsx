import { useEffect, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";

export default function ConfigClinica() {
  const { user } = useAuth();
  const clinicaId = user?.clinica_id || import.meta.env.VITE_CLINICA_ID;
  const [clinica, setClinica] = useState(null);
  const [form, setForm]       = useState({});
  const [config, setConfig]   = useState({});
  const [tab, setTab]         = useState("general");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg]         = useState({ tipo: "", texto: "" });

  useEffect(() => {
    const cargar = async () => {
      if (!clinicaId) {
        setMsg({ tipo: "danger", texto: "No hay clínica seleccionada" });
        setCargando(false);
        return;
      }
      try {
        const res = await api.get(`/clinicas/${clinicaId}`);
        const data = res.data.data;
        setClinica(data);
        setForm({
          nombre:    data.nombre,
          email:     data.email || "",
          telefono:  data.telefono || "",
          direccion: data.direccion || "",
          ciudad:    data.ciudad || "",
          pais:      data.pais || "HN",
          ruc:       data.ruc || "",
          logo_url:  data.logo_url || "",
        });
        // Convertir array [{clave,valor}] a objeto
        const cfgObj = {};
        (data.config || []).forEach((c) => { cfgObj[c.clave] = c.valor; });
        setConfig(cfgObj);
      } catch (e) {
        setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [clinicaId]);

  const guardarGeneral = async (e) => {
    e.preventDefault(); setGuardando(true); setMsg({ tipo: "", texto: "" });
    try {
      await api.put(`/clinicas/${clinicaId}`, form);
      setMsg({ tipo: "success", texto: "Datos guardados correctamente" });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally {
      setGuardando(false);
    }
  };

  const guardarConfig = async (e) => {
    e.preventDefault(); setGuardando(true); setMsg({ tipo: "", texto: "" });
    try {
      await api.put(`/clinicas/${clinicaId}/config`, { config });
      setMsg({ tipo: "success", texto: "Configuración guardada correctamente" });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  return (
    <div>
      <h4 className="mb-4">Configuración de la Clínica</h4>

      {msg.texto && (
        <div className={`alert alert-${msg.tipo} py-2 alert-dismissible`} role="alert">
          {msg.texto}
          <button type="button" className="btn-close" onClick={() => setMsg({ tipo: "", texto: "" })} />
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        {[["general", "Datos generales"], ["comunicacion", "Email / SMTP"], ["agenda", "Agenda"]].map(([k, l]) => (
          <li key={k} className="nav-item">
            <button className={`nav-link ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>
          </li>
        ))}
      </ul>

      {/* ── Tab: Datos generales ── */}
      {tab === "general" && (
        <form onSubmit={guardarGeneral}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Nombre de la clínica *</label>
              <input className="form-control" value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div className="col-md-6">
              <label className="form-label">RUC / NIT / RFC</label>
              <input className="form-control" value={form.ruc}
                onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Teléfono</label>
              <input className="form-control" value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="col-12">
              <label className="form-label">Dirección</label>
              <input className="form-control" value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Ciudad</label>
              <input className="form-control" value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">País</label>
              <select className="form-select" value={form.pais}
                onChange={(e) => setForm({ ...form, pais: e.target.value })}>
                {[["HN","Honduras"],["PE","Perú"],["CO","Colombia"],["MX","México"],["EC","Ecuador"],
                  ["AR","Argentina"],["CL","Chile"],["VE","Venezuela"]].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="col-12">
              <label className="form-label">URL del logo</label>
              <input className="form-control" placeholder="https://..." value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
              {form.logo_url && (
                <div className="mt-2">
                  <img src={form.logo_url} alt="Logo" style={{ maxHeight: 60 }}
                    onError={(e) => e.target.style.display = "none"} />
                </div>
              )}
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Tab: Email / SMTP ── */}
      {tab === "comunicacion" && (
        <form onSubmit={guardarConfig}>
          <div className="row g-3">
            <div className="col-12">
              <div className="alert alert-info py-2 small">
                Configura el servidor SMTP para enviar recordatorios de citas y verificaciones de email.
              </div>
            </div>
            {[
              ["smtp_host", "Host SMTP", "smtp.gmail.com"],
              ["smtp_port", "Puerto SMTP", "587"],
              ["smtp_user", "Usuario / Email", "tu@gmail.com"],
              ["smtp_pass", "Contraseña de aplicación", "••••••••"],
              ["email_from", "Remitente (from)", "Clínica <noreply@clinica.com>"],
            ].map(([k, l, ph]) => (
              <div className="col-md-6" key={k}>
                <label className="form-label">{l}</label>
                <input className="form-control" placeholder={ph}
                  type={k === "smtp_pass" ? "password" : "text"}
                  value={config[k] || ""}
                  onChange={(e) => setConfig({ ...config, [k]: e.target.value })} />
              </div>
            ))}
            <div className="col-12">
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar configuración SMTP"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Tab: Agenda ── */}
      {tab === "agenda" && (
        <form onSubmit={guardarConfig}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Duración de slot por defecto (minutos)</label>
              <select className="form-select"
                value={config["slot_minutos"] || "30"}
                onChange={(e) => setConfig({ ...config, slot_minutos: e.target.value })}>
                {[15, 20, 30, 45, 60].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Anticipación mínima para agendar (horas)</label>
              <input className="form-control" type="number" min={0}
                value={config["min_horas_anticipacion"] || "2"}
                onChange={(e) => setConfig({ ...config, min_horas_anticipacion: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Días máximos de agenda futura</label>
              <input className="form-control" type="number" min={1}
                value={config["dias_agenda_futura"] || "60"}
                onChange={(e) => setConfig({ ...config, dias_agenda_futura: e.target.value })} />
            </div>
            <div className="col-12">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="recordatorio_email"
                  checked={config["recordatorio_email_activo"] === "1"}
                  onChange={(e) => setConfig({ ...config, recordatorio_email_activo: e.target.checked ? "1" : "0" })} />
                <label className="form-check-label" htmlFor="recordatorio_email">
                  Enviar recordatorio por email (48h y 24h antes de la cita)
                </label>
              </div>
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar configuración"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
