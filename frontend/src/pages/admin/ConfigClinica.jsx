import { useEffect, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";

export default function ConfigClinica() {
  const { user } = useAuth();
  const clinicaId = user?.clinica_id || import.meta.env.VITE_CLINICA_ID;
  const [clinica, setClinica] = useState(null);
  const [form, setForm]       = useState({});
  const [config, setConfig]   = useState({});
  const [plantillas, setPlantillas] = useState({});
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
        // Datos de la clínica
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

        // Cargar plantillas
        const resPlantillas = await api.get(`/clinicas/${clinicaId}/plantillas`);
        const plantillasObj = {};
        (resPlantillas.data.data || []).forEach((p) => { 
          plantillasObj[p.tipo] = { nombre: p.nombre, contenido: p.contenido }; 
        });
        setPlantillas(plantillasObj);

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

  const guardarPlantilla = async (tipo, nombre) => {
    setGuardando(true); setMsg({ tipo: "", texto: "" });
    try {
      await api.post(`/clinicas/${clinicaId}/plantillas`, {
        tipo,
        nombre,
        contenido: plantillas[tipo]?.contenido || ""
      });
      setMsg({ tipo: "success", texto: `Plantilla de ${nombre} guardada correctamente` });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally {
      setGuardando(false);
    }
  };

  const subirLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGuardando(true); setMsg({ tipo: "", texto: "" });
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await api.post(`/clinicas/${clinicaId}/upload-logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const logoUrl = `${baseURL}${res.data.logo_url}`;
      
      setForm({ ...form, logo_url: logoUrl });
      setMsg({ tipo: "success", texto: "Logo subido correctamente" });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally {
      setGuardando(false);
    }
  };

  // Pestañas según el rol del usuario
  const allTabs = [
    { key: "general", label: "Datos generales", icon: "bi-building", roles: ["SUPER_ADMIN", "ADMIN", "MEDICO"] },
    { key: "agenda", label: "Agenda", icon: "bi-calendar3", roles: ["SUPER_ADMIN", "ADMIN", "MEDICO"] },
    { key: "receta", label: "Formato Receta", icon: "bi-file-earmark-medical", roles: ["SUPER_ADMIN", "ADMIN", "MEDICO"] },
    { key: "laboratorio", label: "Formato Laboratorio", icon: "bi-capsule", roles: ["SUPER_ADMIN", "ADMIN", "MEDICO"] },
    { key: "estudios", label: "Formato Estudios", icon: "bi-clipboard2-pulse", roles: ["SUPER_ADMIN", "ADMIN", "MEDICO"] },
    { key: "membrete", label: "Membrete y Firma", icon: "bi-pen", roles: ["SUPER_ADMIN", "ADMIN", "MEDICO"] },
  ];

  const tabsVisibles = allTabs.filter(t => !t.roles || t.roles.includes(user?.tipo));

  if (cargando) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "16px 24px 0",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-gear-fill" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Configuración de la Clínica</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>{clinica?.nombre}</div>
          </div>
        </div>

        {/* Tabs dentro del header */}
        <div style={{ display: "flex", gap: 4 }}>
          {tabsVisibles.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "7px 16px", fontSize: "0.82rem", fontWeight: 600,
                borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
                background: tab === key ? "#fff" : "rgba(255,255,255,.1)",
                color: tab === key ? "#1a2744" : "rgba(255,255,255,.75)",
                transition: "background .15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <i className={`bi ${icon}`}></i>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>

      {msg.texto && (
        <div style={{
          marginBottom: 16, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: msg.tipo === "success" ? "#dcfce7" : "#fee2e2",
          color: msg.tipo === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${msg.tipo === "success" ? "#bbf7d0" : "#fecaca"}`,
        }}>
          <span><i className={`bi ${msg.tipo === "success" ? "bi-check-circle-fill" : "bi-x-circle-fill"} me-2`}></i>{msg.texto}</span>
          <button onClick={() => setMsg({ tipo: "", texto: "" })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}>×</button>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: "24px" }}>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* Tab: Datos generales */}
      {/* ══════════════════════════════════════════════════════════════ */}
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
              <label className="form-label">Logo de la clínica</label>
              <div className="d-flex gap-2 align-items-start">
                <div className="flex-grow-1">
                  <input 
                    className="form-control" 
                    placeholder="https://... o sube un archivo" 
                    value={form.logo_url}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })} 
                  />
                </div>
                <label className="btn btn-outline-primary mb-0" style={{ cursor: "pointer" }}>
                  <i className="bi bi-upload me-2" />
                  Subir
                  <input 
                    type="file" 
                    accept="image/*" 
                    style={{ display: "none" }}
                    onChange={subirLogo}
                    disabled={guardando}
                  />
                </label>
              </div>
              {form.logo_url && (
                <div className="mt-2 p-2 border rounded bg-light">
                  <img 
                    src={form.logo_url} 
                    alt="Logo" 
                    style={{ maxHeight: 60 }}
                    onError={(e) => e.target.style.display = "none"} 
                  />
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

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* Tab: Agenda */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === "agenda" && (
        <form onSubmit={guardarConfig}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">
                <i className="bi bi-globe me-2 text-primary" />
                Zona horaria de la clínica
              </label>
              <select className="form-select"
                value={config["zona_horaria"] || "America/Tegucigalpa"}
                onChange={(e) => setConfig({ ...config, zona_horaria: e.target.value })}>
                <optgroup label="Centroamérica">
                  <option value="America/Tegucigalpa">Honduras (UTC-6)</option>
                  <option value="America/Guatemala">Guatemala (UTC-6)</option>
                  <option value="America/El_Salvador">El Salvador (UTC-6)</option>
                  <option value="America/Managua">Nicaragua (UTC-6)</option>
                  <option value="America/Costa_Rica">Costa Rica (UTC-6)</option>
                  <option value="America/Panama">Panamá (UTC-5)</option>
                </optgroup>
                <optgroup label="México">
                  <option value="America/Mexico_City">México Centro (UTC-6)</option>
                  <option value="America/Monterrey">México Norte (UTC-6)</option>
                  <option value="America/Tijuana">México Noroeste/Tijuana (UTC-7)</option>
                </optgroup>
                <optgroup label="Sudamérica">
                  <option value="America/Bogota">Colombia (UTC-5)</option>
                  <option value="America/Lima">Perú (UTC-5)</option>
                  <option value="America/Guayaquil">Ecuador (UTC-5)</option>
                  <option value="America/Caracas">Venezuela (UTC-4)</option>
                  <option value="America/La_Paz">Bolivia (UTC-4)</option>
                  <option value="America/Santiago">Chile (UTC-4/-3)</option>
                  <option value="America/Argentina/Buenos_Aires">Argentina (UTC-3)</option>
                  <option value="America/Sao_Paulo">Brasil (UTC-3/-2)</option>
                </optgroup>
                <optgroup label="Caribe">
                  <option value="America/Santo_Domingo">Rep. Dominicana (UTC-4)</option>
                  <option value="America/Puerto_Rico">Puerto Rico (UTC-4)</option>
                </optgroup>
                <optgroup label="Norteamérica">
                  <option value="America/New_York">USA Este (UTC-5/-4)</option>
                  <option value="America/Chicago">USA Centro (UTC-6/-5)</option>
                  <option value="America/Denver">USA Montaña (UTC-7/-6)</option>
                  <option value="America/Los_Angeles">USA Oeste (UTC-8/-7)</option>
                </optgroup>
              </select>
              <small className="text-muted">
                Afecta el cálculo de disponibilidad de slots en citas.
              </small>
            </div>
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

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* Tab: Formato Receta */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === "receta" && (
        <div>
          <div className="alert alert-info py-2 small mb-3">
            <i className="bi bi-info-circle me-2" />
            Personaliza el formato de las recetas médicas. Puedes usar HTML y variables como 
            <code className="ms-1">{'{{paciente}}, {{medico}}, {{fecha}}'}</code>
          </div>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">Contenido de la plantilla</label>
              <textarea 
                className="form-control font-monospace" 
                rows={12}
                placeholder={`<div style="font-family: Arial; padding: 20px;">
  <h2>{{clinica}}</h2>
  <p><strong>Dr(a).</strong> {{medico}}</p>
  <hr/>
  <p><strong>Paciente:</strong> {{paciente}}</p>
  <p><strong>Fecha:</strong> {{fecha}}</p>
  <h3>Prescripción</h3>
  {{medicamentos}}
</div>`}
                value={plantillas.receta?.contenido || ""}
                onChange={(e) => setPlantillas({ 
                  ...plantillas, 
                  receta: { ...plantillas.receta, contenido: e.target.value } 
                })}
              />
            </div>
            <div className="col-12">
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={guardando}
                onClick={() => guardarPlantilla("receta", "Formato Receta")}
              >
                {guardando ? "Guardando..." : "Guardar plantilla de receta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* Tab: Formato Laboratorio */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === "laboratorio" && (
        <div>
          <div className="alert alert-info py-2 small mb-3">
            <i className="bi bi-info-circle me-2" />
            Personaliza el formato de las órdenes de laboratorio (hemograma, perfil lipídico, etc.)
          </div>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">Contenido de la plantilla</label>
              <textarea 
                className="form-control font-monospace" 
                rows={12}
                placeholder={`<div style="font-family: Arial; padding: 20px;">
  <h2>{{clinica}} - Orden de Laboratorio</h2>
  <p><strong>Médico:</strong> {{medico}}</p>
  <p><strong>Paciente:</strong> {{paciente}}</p>
  <p><strong>Fecha:</strong> {{fecha}}</p>
  <hr/>
  <h3>Exámenes Solicitados:</h3>
  {{examenes}}
</div>`}
                value={plantillas.laboratorio?.contenido || ""}
                onChange={(e) => setPlantillas({ 
                  ...plantillas, 
                  laboratorio: { ...plantillas.laboratorio, contenido: e.target.value } 
                })}
              />
            </div>
            <div className="col-12">
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={guardando}
                onClick={() => guardarPlantilla("laboratorio", "Formato Laboratorio")}
              >
                {guardando ? "Guardando..." : "Guardar plantilla de laboratorio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* Tab: Formato Estudios */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === "estudios" && (
        <div>
          <div className="alert alert-info py-2 small mb-3">
            <i className="bi bi-info-circle me-2" />
            Personaliza el formato de órdenes de estudios (rayos X, resonancias, ecografías, etc.)
          </div>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">Contenido de la plantilla</label>
              <textarea 
                className="form-control font-monospace" 
                rows={12}
                placeholder={`<div style="font-family: Arial; padding: 20px;">
  <h2>{{clinica}} - Orden de Estudio</h2>
  <p><strong>Médico:</strong> {{medico}}</p>
  <p><strong>Paciente:</strong> {{paciente}}</p>
  <p><strong>Fecha:</strong> {{fecha}}</p>
  <hr/>
  <h3>Estudios Solicitados:</h3>
  {{estudios}}
  <h3>Motivo:</h3>
  {{motivo}}
</div>`}
                value={plantillas.estudios?.contenido || ""}
                onChange={(e) => setPlantillas({ 
                  ...plantillas, 
                  estudios: { ...plantillas.estudios, contenido: e.target.value } 
                })}
              />
            </div>
            <div className="col-12">
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={guardando}
                onClick={() => guardarPlantilla("estudios", "Formato Estudios")}
              >
                {guardando ? "Guardando..." : "Guardar plantilla de estudios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* Tab: Membrete y Firma */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {tab === "membrete" && (
        <form onSubmit={guardarConfig}>
          <div className="row g-3">
            <div className="col-12">
              <div className="alert alert-info py-2 small">
                <i className="bi bi-info-circle me-2" />
                Configura el membrete que aparecerá en todos los documentos y tu firma digital
              </div>
            </div>
            
            <div className="col-12">
              <h5 className="mb-3">Membrete de Documentos</h5>
            </div>

            <div className="col-md-6">
              <label className="form-label">Texto del membrete</label>
              <textarea 
                className="form-control" 
                rows={3}
                placeholder="Clínica Médica XYZ - Santiago de Chile"
                value={config["membrete_texto"] || ""}
                onChange={(e) => setConfig({ ...config, membrete_texto: e.target.value })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Color del membrete</label>
              <input 
                type="color" 
                className="form-control form-control-color" 
                value={config["membrete_color"] || "#2196f3"}
                onChange={(e) => setConfig({ ...config, membrete_color: e.target.value })}
              />
            </div>

            <div className="col-12">
              <label className="form-label">Pie de página (footer)</label>
              <input 
                className="form-control" 
                placeholder="Tel: +123456789 | Email: info@clinica.com"
                value={config["footer_texto"] || ""}
                onChange={(e) => setConfig({ ...config, footer_texto: e.target.value })}
              />
            </div>

            <div className="col-12 mt-4">
              <h5 className="mb-3">Firma Digital del Médico</h5>
            </div>

            <div className="col-12">
              <label className="form-label">URL de la firma (imagen)</label>
              <input 
                className="form-control" 
                placeholder="https://..." 
                value={config["firma_url"] || ""}
                onChange={(e) => setConfig({ ...config, firma_url: e.target.value })}
              />
              {config["firma_url"] && (
                <div className="mt-2 p-3 border rounded bg-light">
                  <img 
                    src={config["firma_url"]} 
                    alt="Firma" 
                    style={{ maxHeight: 80, border: "1px solid #ddd" }}
                    onError={(e) => e.target.style.display = "none"}
                  />
                </div>
              )}
            </div>

            <div className="col-md-6">
              <label className="form-label">Número de colegiatura</label>
              <input 
                className="form-control" 
                placeholder="Ej: 12345"
                value={config["numero_colegiatura"] || ""}
                onChange={(e) => setConfig({ ...config, numero_colegiatura: e.target.value })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Especialidad</label>
              <input 
                className="form-control" 
                placeholder="Ej: Medicina General"
                value={config["especialidad_texto"] || ""}
                onChange={(e) => setConfig({ ...config, especialidad_texto: e.target.value })}
              />
            </div>

            <div className="col-12">
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar configuración de membrete y firma"}
              </button>
            </div>
          </div>
        </form>
      )}
      </div>{/* card blanco */}
      </div>{/* padding */}
    </div>
  );
}
