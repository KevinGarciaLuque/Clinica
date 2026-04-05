/**
 * Antecedentes Clínicos del Paciente
 * Tabs: AHF | APNP | APP | AGO | Alergias
 * Guiado por el diseño de iDAMedic Evolution
 */
import { useState, useEffect } from "react";
import api from "../api/api";

const APNP_INITIAL = {
  lugar_origen: "", estado_civil: "", religion: "", escolaridad: "",
  nacionalidad: "", lugar_residencia: "", ocupacion: "",
  alcoholismo: "", tabaquismo: "", drogas: "", actividad_fisica: "",
  habitacion_adecuada: "", higiene_adecuada: "", alimentacion_adecuada: "",
  inmunizaciones: ""
};

const APP_INITIAL = {
  eruptivos: "", tumorales: "", infecciosos: "", enfermedades: "",
  quirurgicos: "", transfusionales: "", traumaticos: "", alergicos: ""
};

export default function AntecedentesClinico({ pacienteId, sexo }) {
  const [tab, setTab] = useState("ahf");
  const [antecedentes, setAntecedentes] = useState([]);
  const [alergias, setAlergias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });

  const [formAHF, setFormAHF] = useState({ familiares: "", otros: "" });
  const [formAPNP, setFormAPNP] = useState({ ...APNP_INITIAL });
  const [formAPP, setFormAPP] = useState({ ...APP_INITIAL });
  const [formAGO, setFormAGO] = useState({ descripcion: "" });
  const [nuevaAlergia, setNuevaAlergia] = useState({
    agente: "", tipo: "MEDICAMENTO", severidad: "MODERADA", reaccion: ""
  });

  useEffect(() => { cargar(); }, [pacienteId]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [resAnt, resAl] = await Promise.all([
        api.get(`/historias/paciente/${pacienteId}/antecedentes`),
        api.get(`/historias/paciente/${pacienteId}/alergias`)
      ]);
      const ants = resAnt.data.data || [];
      setAntecedentes(ants);
      setAlergias(resAl.data.data || []);

      const parseAnt = (tipo, defaults) => {
        const found = ants.find(a => a.tipo === tipo);
        if (!found) return { ...defaults };
        try { return { ...defaults, ...JSON.parse(found.descripcion) }; }
        catch { return defaults; }
      };

      setFormAHF(parseAnt("ahf", { familiares: "", otros: "" }));
      setFormAPNP(parseAnt("apnp", { ...APNP_INITIAL }));
      setFormAPP(parseAnt("app", { ...APP_INITIAL }));
      setFormAGO(parseAnt("ago", { descripcion: "" }));
    } catch (e) {
      console.log("Error cargando antecedentes:", e);
    } finally {
      setLoading(false);
    }
  };

  const guardarSeccion = async (tipo, data) => {
    setGuardando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const existing = antecedentes.find(a => a.tipo === tipo);
      const descripcion = JSON.stringify(data);
      if (existing) {
        await api.put(`/historias/antecedente/${existing.id}`, { descripcion });
      } else {
        await api.post(`/historias/paciente/${pacienteId}/antecedentes`, { tipo, descripcion });
      }
      setMsg({ tipo: "success", texto: "Antecedentes guardados correctamente" });
      await cargar();
      setEditando(false);
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al guardar" });
    } finally {
      setGuardando(false);
    }
  };

  const agregarAlergia = async () => {
    if (!nuevaAlergia.agente.trim()) return;
    setGuardando(true);
    try {
      await api.post(`/historias/paciente/${pacienteId}/alergias`, nuevaAlergia);
      setNuevaAlergia({ agente: "", tipo: "MEDICAMENTO", severidad: "MODERADA", reaccion: "" });
      await cargar();
      setMsg({ tipo: "success", texto: "Alergia registrada" });
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al registrar alergia" });
    } finally {
      setGuardando(false);
    }
  };

  const eliminarAlergia = async (alergiaId) => {
    if (!window.confirm("¿Eliminar esta alergia?")) return;
    try {
      await api.delete(`/historias/alergia/${alergiaId}`);
      await cargar();
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary spinner-border-sm" />
        <span className="ms-2 text-muted">Cargando antecedentes...</span>
      </div>
    );
  }

  /* ─── Helpers de UI ─── */
  const RadioGroup = ({ label, name, value, onChange, options }) => (
    <div className="mb-3">
      <label className="form-label fw-semibold small mb-1">{label}</label>
      <div className="d-flex flex-wrap gap-2">
        {options.map(opt => (
          <div key={opt} className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name={name}
              id={`${name}_${opt}`}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              disabled={!editando}
            />
            <label className="form-check-label small" htmlFor={`${name}_${opt}`}>{opt}</label>
          </div>
        ))}
      </div>
    </div>
  );

  const BtnGuardar = ({ onClick }) => (
    <button className="btn btn-primary" onClick={onClick} disabled={guardando}>
      {guardando
        ? <><span className="spinner-border spinner-border-sm me-2" />Guardando...</>
        : <><i className="bi bi-check-lg me-1" />Guardar</>
      }
    </button>
  );

  const tabs = [
    { key: "ahf",  label: "AHF",  full: "Heredo Familiares",  icon: "bi-people" },
    { key: "apnp", label: "APNP", full: "No Patológicos",     icon: "bi-person-badge" },
    { key: "app",  label: "APP",  full: "Patológicos",         icon: "bi-heart-pulse" },
    ...(sexo === "F" ? [{ key: "ago", label: "AGO", full: "Gineco-Obstétricos", icon: "bi-gender-female" }] : []),
    { key: "alergias", label: "Alergias", full: "Alergias", icon: "bi-exclamation-diamond" }
  ];

  const severidadColor = { LEVE: "success", MODERADA: "warning", SEVERA: "danger", MORTAL: "dark" };

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-white p-0">
        {/* Tabs principales estilo iDAMedic */}
        <div className="d-flex border-bottom" style={{ overflowX: "auto" }}>
          {tabs.map(t => (
            <button
              key={t.key}
              className="btn rounded-0 px-3 px-md-4 py-3 border-0 position-relative"
              onClick={() => { setTab(t.key); setEditando(false); setMsg({ tipo: "", texto: "" }); }}
              style={{
                fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? "#214a87" : "#6c757d",
                borderBottom: tab === t.key ? "3px solid #214a87" : "3px solid transparent",
                whiteSpace: "nowrap",
                fontSize: "0.9rem"
              }}
            >
              <i className={`bi ${t.icon} me-1`} />
              <span className="d-none d-md-inline">{t.full}</span>
              <span className="d-md-none">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card-body p-4">
        {/* Mensajes */}
        {msg.texto && (
          <div className={`alert alert-${msg.tipo} alert-dismissible fade show py-2 mb-3`}>
            <i className={`bi ${msg.tipo === "success" ? "bi-check-circle" : "bi-exclamation-triangle"} me-2`} />
            <small>{msg.texto}</small>
            <button type="button" className="btn-close btn-close-sm" style={{ padding: "0.5rem" }}
              onClick={() => setMsg({ tipo: "", texto: "" })} />
          </div>
        )}

        {/* Botón editar (excepto alergias) */}
        {tab !== "alergias" && (
          <div className="d-flex justify-content-end mb-3">
            <button
              className={`btn btn-sm ${editando ? "btn-outline-secondary" : "btn-outline-primary"}`}
              onClick={() => setEditando(!editando)}
            >
              <i className={`bi ${editando ? "bi-x-lg" : "bi-pencil"} me-1`} />
              {editando ? "Cancelar" : "Editar"}
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* AHF - Antecedentes Heredo Familiares */}
        {/* ═══════════════════════════════════ */}
        {tab === "ahf" && (
          <div>
            <h6 className="fw-bold mb-3 text-primary">
              <i className="bi bi-people me-2" />Antecedentes Heredo Familiares
            </h6>
            <div className="mb-4">
              <label className="form-label fw-semibold">Antecedentes Familiares</label>
              <textarea
                className="form-control"
                rows={5}
                value={formAHF.familiares}
                onChange={(e) => setFormAHF(f => ({ ...f, familiares: e.target.value }))}
                disabled={!editando}
                placeholder="Ej: Abuelas HTA, Abuela materna DM, Padre diabético..."
                style={{ resize: "vertical", backgroundColor: editando ? "#fff" : "#f8f9fa" }}
              />
            </div>
            <div className="mb-4">
              <label className="form-label fw-semibold">Otros (perinatales, neonatales, etc.)</label>
              <textarea
                className="form-control"
                rows={3}
                value={formAHF.otros}
                onChange={(e) => setFormAHF(f => ({ ...f, otros: e.target.value }))}
                disabled={!editando}
                placeholder="Ej: Nacimiento 36 SG, cesárea por preeclampsia, peso 2450g, lloró al nacer..."
                style={{ resize: "vertical", backgroundColor: editando ? "#fff" : "#f8f9fa" }}
              />
            </div>
            {editando && <BtnGuardar onClick={() => guardarSeccion("ahf", formAHF)} />}
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* APNP - Antecedentes No Patológicos */}
        {/* ═══════════════════════════════════ */}
        {tab === "apnp" && (
          <div>
            <h6 className="fw-bold mb-3 text-primary">
              <i className="bi bi-person-badge me-2" />Antecedentes Personales No Patológicos
            </h6>

            <div className="row g-3 mb-4">
              {/* Columna izquierda - Datos personales */}
              <div className="col-lg-6">
                <div className="row g-2">
                  {[
                    { key: "lugar_origen", label: "Lugar de Origen" },
                    { key: "estado_civil", label: "Estado Civil" },
                    { key: "religion", label: "Religión" },
                    { key: "escolaridad", label: "Escolaridad" },
                    { key: "nacionalidad", label: "Nacionalidad" },
                    { key: "lugar_residencia", label: "Lugar de Residencia" },
                    { key: "ocupacion", label: "Ocupación" },
                  ].map(f => (
                    <div key={f.key} className="col-12">
                      <div className="d-flex align-items-center gap-2">
                        <label className="form-label fw-semibold mb-0 text-nowrap" style={{ minWidth: 150 }}>
                          {f.label}:
                        </label>
                        <input
                          className="form-control form-control-sm"
                          value={formAPNP[f.key]}
                          onChange={(e) => setFormAPNP(prev => ({ ...prev, [f.key]: e.target.value }))}
                          disabled={!editando}
                          style={{ backgroundColor: editando ? "#fff" : "#f8f9fa" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Columna derecha - Hábitos y condiciones */}
              <div className="col-lg-6">
                <div className="row g-2">
                  <div className="col-sm-6">
                    <RadioGroup label="Alcoholismo:" name="alcoholismo"
                      value={formAPNP.alcoholismo}
                      onChange={(v) => setFormAPNP(f => ({ ...f, alcoholismo: v }))}
                      options={["Sí", "No", "Ocasional"]} />
                  </div>
                  <div className="col-sm-6">
                    <RadioGroup label="Tabaquismo:" name="tabaquismo"
                      value={formAPNP.tabaquismo}
                      onChange={(v) => setFormAPNP(f => ({ ...f, tabaquismo: v }))}
                      options={["Sí", "No", "Ocasional"]} />
                  </div>
                  <div className="col-sm-6">
                    <RadioGroup label="Drogas:" name="drogas"
                      value={formAPNP.drogas}
                      onChange={(v) => setFormAPNP(f => ({ ...f, drogas: v }))}
                      options={["Sí", "No", "Ocasional"]} />
                  </div>
                  <div className="col-sm-6">
                    <RadioGroup label="Actividad Física:" name="actividad_fisica"
                      value={formAPNP.actividad_fisica}
                      onChange={(v) => setFormAPNP(f => ({ ...f, actividad_fisica: v }))}
                      options={["Sí", "No", "Ocasional"]} />
                  </div>

                  <div className="col-12"><hr className="my-1" /></div>

                  <div className="col-sm-6">
                    <RadioGroup label="Habitación Adecuada:" name="habitacion_adecuada"
                      value={formAPNP.habitacion_adecuada}
                      onChange={(v) => setFormAPNP(f => ({ ...f, habitacion_adecuada: v }))}
                      options={["Sí", "No"]} />
                  </div>
                  <div className="col-sm-6">
                    <RadioGroup label="Higiene Adecuada:" name="higiene_adecuada"
                      value={formAPNP.higiene_adecuada}
                      onChange={(v) => setFormAPNP(f => ({ ...f, higiene_adecuada: v }))}
                      options={["Sí", "No"]} />
                  </div>
                  <div className="col-sm-6">
                    <RadioGroup label="Alimentación Adecuada:" name="alimentacion_adecuada"
                      value={formAPNP.alimentacion_adecuada}
                      onChange={(v) => setFormAPNP(f => ({ ...f, alimentacion_adecuada: v }))}
                      options={["Sí", "No"]} />
                  </div>
                  <div className="col-sm-6">
                    <RadioGroup label="Inmunizaciones:" name="inmunizaciones"
                      value={formAPNP.inmunizaciones}
                      onChange={(v) => setFormAPNP(f => ({ ...f, inmunizaciones: v }))}
                      options={["Completas", "Incompletas"]} />
                  </div>
                </div>
              </div>
            </div>
            {editando && <BtnGuardar onClick={() => guardarSeccion("apnp", formAPNP)} />}
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* APP - Antecedentes Patológicos     */}
        {/* ═══════════════════════════════════ */}
        {tab === "app" && (
          <div>
            <h6 className="fw-bold mb-3 text-primary">
              <i className="bi bi-heart-pulse me-2" />Antecedentes Personales Patológicos
            </h6>
            <div className="row g-3">
              {[
                { key: "eruptivos",       label: "Eruptivos",       icon: "bi-droplet" },
                { key: "tumorales",       label: "Tumorales",       icon: "bi-circle" },
                { key: "infecciosos",     label: "Infecciosos",     icon: "bi-virus" },
                { key: "enfermedades",    label: "Enfermedades",    icon: "bi-clipboard2-pulse" },
                { key: "quirurgicos",     label: "Quirúrgicos",     icon: "bi-scissors" },
                { key: "transfusionales", label: "Transfusionales", icon: "bi-droplet-half" },
                { key: "traumaticos",     label: "Traumáticos",     icon: "bi-bandaid" },
                { key: "alergicos",       label: "Alérgicos",       icon: "bi-exclamation-triangle" },
              ].map(f => (
                <div key={f.key} className="col-md-6">
                  <label className="form-label fw-semibold">
                    <i className={`bi ${f.icon} me-1 text-muted`} />{f.label}:
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={formAPP[f.key]}
                    onChange={(e) => setFormAPP(prev => ({ ...prev, [f.key]: e.target.value }))}
                    disabled={!editando}
                    style={{ resize: "vertical", backgroundColor: editando ? "#fff" : "#f8f9fa" }}
                    placeholder={!editando && !formAPP[f.key] ? "Sin registro" : ""}
                  />
                </div>
              ))}
            </div>
            {editando && <div className="mt-3"><BtnGuardar onClick={() => guardarSeccion("app", formAPP)} /></div>}
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* AGO - Antecedentes Gineco-Obstétricos */}
        {/* ═══════════════════════════════════ */}
        {tab === "ago" && (
          <div>
            <h6 className="fw-bold mb-3 text-primary">
              <i className="bi bi-gender-female me-2" />Antecedentes Gineco-Obstétricos
            </h6>
            <div className="mb-3">
              <textarea
                className="form-control"
                rows={6}
                value={formAGO.descripcion}
                onChange={(e) => setFormAGO({ descripcion: e.target.value })}
                disabled={!editando}
                placeholder="Menarca, ritmo menstrual, FUM, gestas, partos, cesáreas, abortos, método anticonceptivo, Papanicolaou..."
                style={{ resize: "vertical", backgroundColor: editando ? "#fff" : "#f8f9fa" }}
              />
            </div>
            {editando && <BtnGuardar onClick={() => guardarSeccion("ago", formAGO)} />}
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* ALERGIAS                           */}
        {/* ═══════════════════════════════════ */}
        {tab === "alergias" && (
          <div>
            <h6 className="fw-bold mb-3 text-primary">
              <i className="bi bi-exclamation-diamond me-2" />Alergias del Paciente
            </h6>

            {/* Formulario para agregar */}
            <div className="bg-light rounded p-3 mb-4">
              <div className="row g-2 align-items-end">
                <div className="col-md-3">
                  <label className="form-label fw-semibold small">Agente / Sustancia</label>
                  <input
                    className="form-control form-control-sm"
                    value={nuevaAlergia.agente}
                    onChange={(e) => setNuevaAlergia(f => ({ ...f, agente: e.target.value }))}
                    placeholder="Ej: Penicilina, Mariscos..."
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-semibold small">Tipo</label>
                  <select className="form-select form-select-sm" value={nuevaAlergia.tipo}
                    onChange={(e) => setNuevaAlergia(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="MEDICAMENTO">Medicamento</option>
                    <option value="ALIMENTO">Alimento</option>
                    <option value="AMBIENTAL">Ambiental</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-semibold small">Severidad</label>
                  <select className="form-select form-select-sm" value={nuevaAlergia.severidad}
                    onChange={(e) => setNuevaAlergia(f => ({ ...f, severidad: e.target.value }))}>
                    <option value="LEVE">Leve</option>
                    <option value="MODERADA">Moderada</option>
                    <option value="SEVERA">Severa</option>
                    <option value="MORTAL">Mortal</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold small">Reacción</label>
                  <input
                    className="form-control form-control-sm"
                    value={nuevaAlergia.reaccion}
                    onChange={(e) => setNuevaAlergia(f => ({ ...f, reaccion: e.target.value }))}
                    placeholder="Ej: Urticaria, anafilaxia..."
                  />
                </div>
                <div className="col-md-2">
                  <button className="btn btn-primary btn-sm w-100" onClick={agregarAlergia} disabled={guardando || !nuevaAlergia.agente.trim()}>
                    <i className="bi bi-plus-lg me-1" />Agregar
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de alergias */}
            {alergias.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="bi bi-check-circle" style={{ fontSize: "2rem" }} />
                <p className="mt-2 mb-0">No se han registrado alergias</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Agente</th>
                      <th>Tipo</th>
                      <th>Severidad</th>
                      <th>Reacción</th>
                      <th width="50"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {alergias.map(a => (
                      <tr key={a.id}>
                        <td className="fw-semibold">{a.agente}</td>
                        <td><span className="badge bg-secondary">{a.tipo}</span></td>
                        <td>
                          <span className={`badge bg-${severidadColor[a.severidad] || "secondary"}`}>
                            {a.severidad}
                          </span>
                        </td>
                        <td className="text-muted">{a.reaccion || "—"}</td>
                        <td>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => eliminarAlergia(a.id)}>
                            <i className="bi bi-trash" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
