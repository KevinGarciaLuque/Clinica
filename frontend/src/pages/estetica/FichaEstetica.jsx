import { useEffect, useState } from "react";
import api from "../../api/api";

const C = {
  bg:      "#f0f2f5",
  surface: "#f8fafc",
  card:    "#ffffff",
  border:  "#e5e7eb",
  accent:  "#e91e8c",
  accentD: "#c2185b",
  text:    "#111827",
  textSub: "#374151",
  muted:   "#6b7280",
  mutedLt: "#9ca3af",
  inputBg: "#ffffff",
};

const inputSt = {
  background: C.inputBg,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.text,
  padding: "9px 12px",
  width: "100%",
  fontSize: 14,
  outline: "none",
};

const FOTOTIPOS = [
  { id: "I",   desc: "Siempre se quema, nunca broncea (piel muy clara)",  color: "#fde8d8" },
  { id: "II",  desc: "Siempre se quema, a veces broncea (piel clara)",    color: "#f9c784" },
  { id: "III", desc: "A veces se quema, siempre broncea (piel intermedia)", color: "#d9955e" },
  { id: "IV",  desc: "Nunca se quema, siempre broncea (piel morena)",     color: "#a0623a" },
  { id: "V",   desc: "Piel morena oscura",                               color: "#6b3a1f" },
  { id: "VI",  desc: "Piel negra",                                       color: "#3a1a0a" },
];

const PROCEDIMIENTOS_PREV = [
  "Rinoplastia", "Mamoplastia", "Liposucción", "Abdominoplastia",
  "Bichectomía", "Blefaroplastia", "Lifting facial", "Botox / Toxina botulínica",
  "Rellenos dérmicos", "Blanqueamiento", "Peeling químico",
];

function initFicha() {
  return {
    fototipo: "", piel_tipo: "Normal", cicatrizacion: "Normal",
    alergias_anestesia: "", alergias_medicamentos: "", alergias_latex: false,
    fumador: false, alcoholismo: "Ninguno",
    procedimientos_previos: [], num_cirugias_previas: "0",
    motivacion: "", zonas_interes: [], expectativas: "",
    contraindicaciones: "", notas_medico: "",
  };
}

const ZONAS = [
  "Nariz", "Mentón", "Pómulos", "Papada / Cuello", "Párpados",
  "Frente", "Labios", "Orejas", "Senos", "Abdomen",
  "Cintura / Flancos", "Caderas", "Brazos", "Muslos", "Glúteos",
];

export default function FichaEstetica() {
  const [pacientes,   setPacientes]  = useState([]);
  const [pacientesConFicha, setPacientesConFicha] = useState([]);
  const [pacId,       setPacId]      = useState("");
  const [ficha,       setFicha]      = useState(null);
  const [editando,    setEditando]   = useState(false);
  const [formFicha,   setFormFicha]  = useState(initFicha());
  const [guardado,    setGuardado]   = useState(false);
  const [busqueda,    setBusqueda]   = useState("");
  const [mostrarLista, setMostrarLista] = useState(false);
  const [modalVer,    setModalVer]   = useState(false);
  const [fichaModal,  setFichaModal] = useState(null);
  const [pacModal,    setPacModal]   = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const r = await api.get("/pacientes");
      const pacs = r.data.data || [];
      setPacientes(pacs);
      cargarPacientesConFicha(pacs);
    } catch (e) {
      console.error("Error al cargar pacientes:", e);
    }
  };

  const cargarPacientesConFicha = (pacs = pacientes) => {
    const conFicha = [];
    pacs.forEach(p => {
      const fichaGuardada = localStorage.getItem(`ficha_estetica_${p.id}`);
      if (fichaGuardada) {
        try {
          const ficha = JSON.parse(fichaGuardada);
          conFicha.push({
            ...p,
            ultima_actualizacion: ficha.actualizado_en || new Date().toISOString(),
          });
        } catch (e) {
          console.error("Error al parsear ficha:", e);
        }
      }
    });
    conFicha.sort((a, b) => new Date(b.ultima_actualizacion) - new Date(a.ultima_actualizacion));
    console.log("Pacientes con ficha estética:", conFicha.length);
    setPacientesConFicha(conFicha);
  };

  useEffect(() => {
    if (!pacId) { setFicha(null); setEditando(false); return; }
    const saved = JSON.parse(localStorage.getItem(`ficha_estetica_${pacId}`) || "null");
    console.log("Ficha cargada para paciente", pacId, ":", saved ? "Existe" : "No existe");
    if (saved) { setFicha(saved); setEditando(false); }
    else       { setFicha(null);  setEditando(true); setFormFicha(initFicha()); }
  }, [pacId]);

  const abrir = () => {
    setFormFicha(ficha ? { ...ficha } : initFicha());
    setEditando(true);
  };

  const guardar = (e) => {
    e.preventDefault();
    const nuevaFicha = { ...formFicha, pac_id: pacId, actualizado_en: new Date().toISOString() };
    localStorage.setItem(`ficha_estetica_${pacId}`, JSON.stringify(nuevaFicha));
    setFicha(nuevaFicha);
    setEditando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
    // Actualizar lista de pacientes con ficha
    cargarPacientesConFicha(pacientes);
  };

  const eliminarFicha = () => {
    if (!window.confirm('¿Eliminar la ficha estética de este paciente? Esta acción no se puede deshacer.')) return;
    localStorage.removeItem(`ficha_estetica_${pacId}`);
    setFicha(null);
    setEditando(false);
    setPacId("");
    setBusqueda("");
    cargarPacientesConFicha(pacientes);
  };

  const toggleProc = (p) => setFormFicha(f => ({
    ...f, procedimientos_previos: f.procedimientos_previos.includes(p)
      ? f.procedimientos_previos.filter(x => x !== p)
      : [...f.procedimientos_previos, p],
  }));

  const toggleZona = (z) => setFormFicha(f => ({
    ...f, zonas_interes: f.zonas_interes.includes(z)
      ? f.zonas_interes.filter(x => x !== z)
      : [...f.zonas_interes, z],
  }));

  const pacSeleccionado = pacientes.find(p => String(p.id) === String(pacId));

  const pacientesFiltrados = pacientes.filter(p => {
    const textoCompleto = `${p.nombres} ${p.apellidos} ${p.dni || ""}`.toLowerCase();
    return textoCompleto.includes(busqueda.toLowerCase());
  });

  const seleccionarPaciente = (paciente) => {
    setPacId(paciente.id);
    setBusqueda(`${paciente.nombres} ${paciente.apellidos}`);
    setMostrarLista(false);
  };

  const limpiarBusqueda = () => {
    setBusqueda("");
    setPacId("");
    setMostrarLista(false);
    setFicha(null);
    setEditando(false);
  };

  const abrirModalVer = (paciente) => {
    const fichaGuardada = localStorage.getItem(`ficha_estetica_${paciente.id}`);
    if (fichaGuardada) {
      setFichaModal(JSON.parse(fichaGuardada));
      setPacModal(paciente);
      setModalVer(true);
    }
  };

  const cerrarModal = () => {
    setModalVer(false);
    setFichaModal(null);
    setPacModal(null);
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>

      {/* ── Barra superior ── */}
      <div style={{
        background: "linear-gradient(135deg, #1a1035 0%, #2d1045 50%, #1a2744 100%)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(0,0,0,.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-person-vcard-fill" style={{ color: "#f9a8d4", fontSize: "1rem" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Ficha Estética</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>
              Fototipo · procedimientos previos · zonas de interés · expectativas
            </div>
          </div>
        </div>
        {ficha && !editando && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={abrir} style={{
              background: C.accent, border: "none", borderRadius: 8,
              color: "#fff", padding: "7px 16px", fontSize: "0.82rem",
              cursor: "pointer", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <i className="bi bi-pencil-square" /> Editar ficha
            </button>
            <button onClick={eliminarFicha} style={{
              background: "rgba(239,68,68,.18)", border: "1px solid rgba(239,68,68,.4)",
              borderRadius: 8, color: "#fca5a5", padding: "7px 16px", fontSize: "0.82rem",
              cursor: "pointer", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <i className="bi bi-trash" /> Eliminar
            </button>
          </div>
        )}
      </div>

      {/* ── Contenido ── */}
      <div style={{ padding: "20px 24px" }}>

      {/* Toast guardado */}
      {guardado && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "#10b981", borderRadius: 12, padding: "12px 20px",
          color: "#fff", fontWeight: 600, fontSize: 14,
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,.25)",
        }}>
          <i className="bi bi-check-circle-fill" /> Ficha estética guardada correctamente
        </div>
      )}

      {/* ── Buscador ── */}
      <div style={{
        background: C.card, borderRadius: 12, padding: "18px 20px", marginBottom: 16,
        boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: `1px solid ${C.border}`,
      }}>
      <div style={{ position: "relative", maxWidth: 480 }}>
          <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                          letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
            Buscar Paciente
          </label>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              style={{
                ...inputSt,
                paddingRight: pacId ? "70px" : "40px",
              }}
              placeholder="Buscar por nombre o DNI..."
              value={busqueda}
              onChange={e => {
                setBusqueda(e.target.value);
                setMostrarLista(true);
                if (!e.target.value) setPacId("");
              }}
              onFocus={() => setMostrarLista(true)}
            />
            <div style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              display: "flex", gap: 6, alignItems: "center",
            }}>
              {pacId && (
                <button
                  onClick={limpiarBusqueda}
                  style={{
                    background: "transparent", border: "none",
                    color: C.muted, cursor: "pointer", padding: 4,
                    display: "flex", alignItems: "center",
                  }}
                  title="Limpiar"
                >
                  <i className="bi bi-x-lg" style={{ fontSize: 14 }} />
                </button>
              )}
              <i className="bi bi-search" style={{ color: C.muted, fontSize: 14 }} />
            </div>
          </div>

          {/* Lista de resultados */}
          {mostrarLista && busqueda && pacientesFiltrados.length > 0 && (
            <>
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 10,
                }}
                onClick={() => setMostrarLista(false)}
              />
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                marginTop: 6, background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 10, maxHeight: 280, overflowY: "auto",
                boxShadow: "0 8px 24px rgba(0,0,0,.1)", zIndex: 20,
              }}>
                {pacientesFiltrados.map(p => (
                  <div
                    key={p.id}
                    onClick={() => seleccionarPaciente(p)}
                    style={{
                      padding: "12px 14px", cursor: "pointer",
                      borderBottom: `1px solid ${C.border}`,
                      transition: "background .2s",
                      background: String(p.id) === String(pacId) ? `${C.accent}15` : "transparent",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${C.accent}15`}
                    onMouseLeave={e => {
                      if (String(p.id) !== String(pacId)) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, color: "#fff", fontSize: 14, flexShrink: 0,
                      }}>
                        {(p.nombres?.[0] || "?").toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>
                          {p.nombres} {p.apellidos}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                          {p.dni && `DNI: ${p.dni}`}
                          {p.dni && p.fecha_nacimiento && " • "}
                          {p.fecha_nacimiento &&
                            `${new Date().getFullYear() - new Date(p.fecha_nacimiento).getFullYear()} años`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Sin resultados */}
          {mostrarLista && busqueda && pacientesFiltrados.length === 0 && (
            <>
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 10,
                }}
                onClick={() => setMostrarLista(false)}
              />
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                marginTop: 6, background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "20px 14px", textAlign: "center",
                boxShadow: "0 8px 24px rgba(0,0,0,.1)", zIndex: 20,
              }}>
                <i className="bi bi-search" style={{ fontSize: 24, color: C.muted, marginBottom: 8, display: "block" }} />
                <div style={{ color: C.muted, fontSize: 13 }}>
                  No se encontraron pacientes con "{busqueda}"
                </div>
              </div>
            </>
          )}
      </div>
      </div>

      {/* Card del paciente seleccionado */}
      {pacSeleccionado && (
        <div style={{
          background: `${C.accent}08`, border: `1px solid ${C.accent}30`,
          borderRadius: 12, padding: "12px 18px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {(pacSeleccionado.nombres?.[0] || "?").toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>
              {pacSeleccionado.nombres} {pacSeleccionado.apellidos}
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {pacSeleccionado.dni && `DNI: ${pacSeleccionado.dni}`}
              {pacSeleccionado.dni && pacSeleccionado.fecha_nacimiento && " · "}
              {pacSeleccionado.fecha_nacimiento &&
                `${new Date().getFullYear() - new Date(pacSeleccionado.fecha_nacimiento).getFullYear()} años`}
            </div>
          </div>
        </div>
      )}

      {!pacId ? (
        pacientesConFicha.length === 0 ? (
          /* Estado vacío */
          <div style={{
            background: C.card, borderRadius: 12, padding: "72px 24px",
            textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,.06)",
            border: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18, margin: "0 auto 18px",
              background: `${C.accent}10`, border: `1px solid ${C.accent}25`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="bi bi-person-vcard" style={{ fontSize: 28, color: C.accent }} />
            </div>
            <p style={{ color: C.text, fontSize: 15, fontWeight: 600, margin: 0 }}>Sin fichas estéticas registradas</p>
            <p style={{ color: C.muted, fontSize: 13, margin: "8px 0 0" }}>Busca un paciente arriba para crear su ficha estética</p>
          </div>
        ) : (
          /* Tabla de pacientes con ficha */
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,.06)",
          }}>
            <div style={{
              padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
              background: "#f8fafc",
            }}>
              <h5 style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 15 }}>
                <i className="bi bi-people-fill me-2" style={{ color: C.accent }} />
                Pacientes con Ficha Estética
              </h5>
              <span style={{ fontSize: 12, color: C.muted, marginTop: 3, display: "block" }}>
                {pacientesConFicha.length} paciente{pacientesConFicha.length !== 1 ? "s" : ""} con ficha registrada
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Paciente", "DNI", "Última Actualización", "Acciones"].map(h => (
                      <th key={h} style={{
                        padding: "10px 18px",
                        textAlign: h === "Acciones" ? "center" : "left",
                        fontSize: "0.73rem", fontWeight: 700, color: C.muted,
                        textTransform: "uppercase", letterSpacing: ".05em",
                        borderBottom: `2px solid ${C.border}`, whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pacientesConFicha.map(pac => (
                    <FilaFicha
                      key={pac.id}
                      pac={pac}
                      onVer={() => abrirModalVer(pac)}
                      onEditar={() => { seleccionarPaciente(pac); setTimeout(() => setEditando(true), 0); }}
                      onEliminar={() => {
                        if (!window.confirm(`¿Eliminar la ficha de ${pac.nombres} ${pac.apellidos}?`)) return;
                        localStorage.removeItem(`ficha_estetica_${pac.id}`);
                        cargarPacientesConFicha(pacientes);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : ficha && !editando ? (
        /* Vista de ficha guardada */
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SeccionCard titulo="Piel y tipo de paciente" icono="bi-person-fill">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
              <ItemFicha label="Fototipo Fitzpatrick" value={ficha.fototipo ? `Tipo ${ficha.fototipo}` : "—"} />
              <ItemFicha label="Tipo de piel"         value={ficha.piel_tipo} />
              <ItemFicha label="Cicatrización"        value={ficha.cicatrizacion} />
              <ItemFicha label="Fumador/a"            value={ficha.fumador ? "Sí" : "No"} />
              <ItemFicha label="Consumo alcohol"      value={ficha.alcoholismo} />
              <ItemFicha label="Alergia al látex"     value={ficha.alergias_latex ? "Sí" : "No"} />
            </div>
          </SeccionCard>
          <SeccionCard titulo="Procedimientos previos" icono="bi-scissors">
            {ficha.procedimientos_previos?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ficha.procedimientos_previos.map(p => (
                  <span key={p} style={{
                    background: `${C.accent}10`, border: `1px solid ${C.accent}30`,
                    borderRadius: 8, padding: "4px 12px", fontSize: 13,
                    color: C.accentD, fontWeight: 600,
                  }}>{p}</span>
                ))}
              </div>
            ) : <span style={{ color: C.muted, fontSize: 13 }}>Ninguno</span>}
          </SeccionCard>
          <SeccionCard titulo="Zonas de interés" icono="bi-geo-alt-fill">
            {ficha.zonas_interes?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ficha.zonas_interes.map(z => (
                  <span key={z} style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "4px 12px", fontSize: 13, color: C.textSub,
                  }}>{z}</span>
                ))}
              </div>
            ) : <span style={{ color: C.muted, fontSize: 13 }}>No especificadas</span>}
          </SeccionCard>
          {(ficha.motivacion || ficha.expectativas) && (
            <SeccionCard titulo="Motivaciones y expectativas" icono="bi-star-fill">
              {ficha.motivacion   && <ItemFicha label="Motivación del paciente" value={ficha.motivacion} />}
              {ficha.expectativas && <ItemFicha label="Expectativas"            value={ficha.expectativas} />}
            </SeccionCard>
          )}
          {ficha.notas_medico && (
            <SeccionCard titulo="Notas del médico" icono="bi-journal-medical">
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{ficha.notas_medico}</div>
            </SeccionCard>
          )}
        </div>
      ) : editando ? (
        /* Formulario edición */
        <form onSubmit={guardar} style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Sección 1: Piel */}
          <SeccionCard titulo="Características de la piel" icono="bi-person-fill">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
              <div>
                <Lbl>Tipo de piel</Lbl>
                <select style={inputSt} value={formFicha.piel_tipo}
                  onChange={e => setFormFicha(f => ({ ...f, piel_tipo: e.target.value }))}>
                  {["Normal","Seca","Grasa","Mixta","Sensible"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Cicatrización habitual</Lbl>
                <select style={inputSt} value={formFicha.cicatrizacion}
                  onChange={e => setFormFicha(f => ({ ...f, cicatrizacion: e.target.value }))}>
                  {["Normal","Queloide","Hipertrófica","Atrófica"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Consumo de alcohol</Lbl>
                <select style={inputSt} value={formFicha.alcoholismo}
                  onChange={e => setFormFicha(f => ({ ...f, alcoholismo: e.target.value }))}>
                  {["Ninguno","Ocasional","Frecuente","Diario"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 20, alignItems: "center", paddingTop: 24 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13, color: C.text }}>
                  <input type="checkbox" checked={formFicha.fumador}
                    onChange={e => setFormFicha(f => ({ ...f, fumador: e.target.checked }))} />
                  Fumador/a
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13, color: C.text }}>
                  <input type="checkbox" checked={formFicha.alergias_latex}
                    onChange={e => setFormFicha(f => ({ ...f, alergias_latex: e.target.checked }))} />
                  Alergia al látex
                </label>
              </div>
            </div>
          </SeccionCard>

          {/* Fototipo */}
          <SeccionCard titulo="Fototipo de Fitzpatrick" icono="bi-brightness-high-fill">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10 }}>
              {FOTOTIPOS.map(ft => {
                const sel = formFicha.fototipo === ft.id;
                return (
                  <div
                    key={ft.id}
                    onClick={() => setFormFicha(f => ({ ...f, fototipo: sel ? "" : ft.id }))}
                    style={{
                      background: sel ? `${C.accent}10` : C.surface,
                      border: `2px solid ${sel ? C.accent : C.border}`,
                      borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10, transition: "all .18s",
                    }}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: ft.color, flexShrink: 0,
                      border: "2px solid #e5e7eb",
                    }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: sel ? C.accent : C.text }}>Tipo {ft.id}</div>
                      <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.3 }}>{ft.desc.split("(")[0]}</div>
                    </div>
                    {sel && <i className="bi bi-check-circle-fill" style={{ color: C.accent, marginLeft: "auto" }} />}
                  </div>
                );
              })}
            </div>
          </SeccionCard>

          {/* Procedimientos previos */}
          <SeccionCard titulo="Procedimientos estéticos previos" icono="bi-scissors">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PROCEDIMIENTOS_PREV.map(p => {
                const sel = formFicha.procedimientos_previos.includes(p);
                return (
                  <button type="button" key={p} onClick={() => toggleProc(p)}
                    style={{
                      background: sel ? `${C.accent}12` : C.surface,
                      border: `1px solid ${sel ? C.accent : C.border}`,
                      borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                      color: sel ? C.accentD : C.muted, fontSize: 13, fontWeight: sel ? 600 : 400,
                      transition: "all .15s",
                    }}>
                    {sel && <i className="bi bi-check me-1" />}{p}
                  </button>
                );
              })}
            </div>
          </SeccionCard>

          {/* Zonas de interés */}
          <SeccionCard titulo="Zonas de interés del paciente" icono="bi-geo-alt-fill">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ZONAS.map(z => {
                const sel = formFicha.zonas_interes.includes(z);
                return (
                  <button type="button" key={z} onClick={() => toggleZona(z)}
                    style={{
                      background: sel ? "#eff6ff" : C.surface,
                      border: `1px solid ${sel ? "#3b82f6" : C.border}`,
                      borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                      color: sel ? "#1d4ed8" : C.muted, fontSize: 13, fontWeight: sel ? 600 : 400,
                      transition: "all .15s",
                    }}>
                    {sel && <i className="bi bi-check me-1" />}{z}
                  </button>
                );
              })}
            </div>
          </SeccionCard>

          {/* Motivaciones */}
          <SeccionCard titulo="Motivación y expectativas" icono="bi-star-fill">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <Lbl>Motivación principal del paciente</Lbl>
                <textarea style={{ ...inputSt, minHeight: 70, resize: "vertical" }}
                  placeholder="¿Por qué desea este procedimiento?" value={formFicha.motivacion}
                  onChange={e => setFormFicha(f => ({ ...f, motivacion: e.target.value }))} />
              </div>
              <div>
                <Lbl>Expectativas del resultado</Lbl>
                <textarea style={{ ...inputSt, minHeight: 70, resize: "vertical" }}
                  placeholder="¿Qué resultado espera obtener?" value={formFicha.expectativas}
                  onChange={e => setFormFicha(f => ({ ...f, expectativas: e.target.value }))} />
              </div>
              <div>
                <Lbl>Notas del médico (privadas)</Lbl>
                <textarea style={{ ...inputSt, minHeight: 80, resize: "vertical" }}
                  placeholder="Evaluación preoperatoria, contraindicaciones, observaciones clínicas..."
                  value={formFicha.notas_medico}
                  onChange={e => setFormFicha(f => ({ ...f, notas_medico: e.target.value }))} />
              </div>
            </div>
          </SeccionCard>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {ficha && (
              <button type="button" onClick={() => setEditando(false)}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 9,
                           padding: "10px 22px", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                Cancelar
              </button>
            )}
            <button type="submit"
              style={{
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                border: "none", borderRadius: 9, padding: "10px 26px",
                color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
                boxShadow: `0 4px 14px rgba(233,30,140,.35)`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
              <i className="bi bi-check-lg" /> Guardar ficha estética
            </button>
          </div>
        </form>
      ) : null}
      </div>{/* fin padding */}

      {/* ── Modal ver ficha ── */}
      {modalVer && fichaModal && pacModal && (
        <>
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(0,0,0,.45)",
              backdropFilter: "blur(4px)",
            }}
            onClick={cerrarModal}
          />
          <div
            style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 9999,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,.2)",
              width: "90%",
              maxWidth: 860,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Header modal */}
            <div style={{
              background: "linear-gradient(135deg, #1a1035 0%, #2d1045 50%, #1a2744 100%)",
              padding: "18px 22px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              position: "sticky", top: 0, zIndex: 10,
              borderRadius: "16px 16px 0 0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 11,
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, color: "#fff", fontSize: 17,
                }}>
                  {(pacModal.nombres?.[0] || "?").toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: "#fff" }}>
                    {pacModal.nombres} {pacModal.apellidos}
                  </h3>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 2 }}>
                    DNI: {pacModal.dni || "N/A"} · {pacModal.fecha_nacimiento &&
                      `${new Date().getFullYear() - new Date(pacModal.fecha_nacimiento).getFullYear()} años`}
                  </div>
                </div>
              </div>
              <button
                onClick={cerrarModal}
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: "rgba(239,68,68,.2)",
                  border: "1px solid rgba(239,68,68,.4)",
                  color: "#fca5a5",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,.3)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,.2)"}
              >
                <i className="bi bi-x-lg" style={{ fontSize: 14 }} />
              </button>
            </div>

            {/* Contenido modal */}
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Piel */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
                <h5 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  <i className="bi bi-person-fill me-2" style={{ color: C.accent }} />Características de la Piel
                </h5>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: "10px 16px" }}>
                  <ItemCompacto label="Fototipo"      value={fichaModal.fototipo ? `Tipo ${fichaModal.fototipo}` : "—"} />
                  <ItemCompacto label="Tipo de piel"  value={fichaModal.piel_tipo} />
                  <ItemCompacto label="Cicatrización" value={fichaModal.cicatrizacion} />
                  <ItemCompacto label="Fumador/a"     value={fichaModal.fumador ? "Sí" : "No"} />
                  <ItemCompacto label="Alcohol"       value={fichaModal.alcoholismo} />
                  <ItemCompacto label="Alergia látex" value={fichaModal.alergias_latex ? "Sí" : "No"} />
                </div>
              </div>

              {fichaModal.procedimientos_previos?.length > 0 && (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
                  <h5 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    <i className="bi bi-scissors me-2" style={{ color: C.accent }} />Procedimientos Previos
                  </h5>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {fichaModal.procedimientos_previos.map(p => (
                      <span key={p} style={{
                        background: `${C.accent}10`, border: `1px solid ${C.accent}30`,
                        borderRadius: 6, padding: "3px 10px", fontSize: 12, color: C.accentD, fontWeight: 600,
                      }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {fichaModal.zonas_interes?.length > 0 && (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
                  <h5 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    <i className="bi bi-geo-alt-fill me-2" style={{ color: C.accent }} />Zonas de Interés
                  </h5>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {fichaModal.zonas_interes.map(z => (
                      <span key={z} style={{
                        background: C.card, border: `1px solid ${C.border}`,
                        borderRadius: 6, padding: "3px 10px", fontSize: 12, color: C.muted,
                      }}>{z}</span>
                    ))}
                  </div>
                </div>
              )}

              {(fichaModal.motivacion || fichaModal.expectativas) && (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
                  <h5 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    <i className="bi bi-star-fill me-2" style={{ color: C.accent }} />Motivaciones y Expectativas
                  </h5>
                  <div style={{ display: "grid", gap: 10 }}>
                    {fichaModal.motivacion && (
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".05em" }}>Motivación</div>
                        <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5 }}>{fichaModal.motivacion}</div>
                      </div>
                    )}
                    {fichaModal.expectativas && (
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".05em" }}>Expectativas</div>
                        <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5 }}>{fichaModal.expectativas}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {fichaModal.notas_medico && (
                <div style={{ background: `${C.accent}06`, border: `1px solid ${C.accent}20`, borderRadius: 10, padding: "14px 18px" }}>
                  <h5 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    <i className="bi bi-journal-medical me-2" style={{ color: C.accent }} />Notas del Médico
                  </h5>
                  <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>{fichaModal.notas_medico}</div>
                </div>
              )}
            </div>

            {/* Footer modal */}
            <div style={{
              padding: "14px 22px", borderTop: `1px solid ${C.border}`,
              display: "flex", gap: 10, justifyContent: "flex-end",
              position: "sticky", bottom: 0, background: C.card,
              borderRadius: "0 0 16px 16px",
            }}>
              <button
                onClick={() => { cerrarModal(); seleccionarPaciente(pacModal); setEditando(true); }}
                style={{
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                  border: "none", borderRadius: 8, padding: "9px 18px",
                  color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: `0 3px 10px rgba(233,30,140,.3)`,
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <i className="bi bi-pencil" /> Editar Ficha
              </button>
              <button onClick={cerrarModal} style={{
                background: "transparent", border: `1px solid ${C.border}`,
                borderRadius: 8, padding: "9px 18px",
                color: C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}>
                Cerrar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function FilaFicha({ pac, onVer, onEditar, onEliminar }) {
  const [hover, setHover] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onVer}
      style={{
        borderBottom: `1px solid ${C.border}`,
        background: hover ? "#f9fafb" : "#fff",
        transition: "background .12s",
        cursor: "pointer",
      }}
    >
      <td style={{ padding: "13px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, color: "#fff", fontSize: 13, flexShrink: 0,
          }}>
            {(pac.nombres?.[0] || "?").toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>{pac.nombres} {pac.apellidos}</div>
            {pac.fecha_nacimiento && (
              <div style={{ fontSize: 12, color: C.mutedLt }}>
                {new Date().getFullYear() - new Date(pac.fecha_nacimiento).getFullYear()} años
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={{ padding: "13px 18px", fontSize: 13, color: C.muted }}>{pac.dni || "N/A"}</td>
      <td style={{ padding: "13px 18px", fontSize: 13, color: C.muted }}>
        <i className="bi bi-calendar2 me-1" />
        {new Date(pac.ultima_actualizacion).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
      </td>
      <td style={{ padding: "13px 18px", textAlign: "center" }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          <button onClick={e => { e.stopPropagation(); onVer(); }} title="Ver ficha"
            style={{ width: 32, height: 32, borderRadius: 7, background: `${C.accent}12`, border: `1px solid ${C.accent}28`, color: C.accent, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-eye" style={{ fontSize: 15 }} />
          </button>
          <button onClick={e => { e.stopPropagation(); onEditar(); }} title="Editar ficha"
            style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.28)", color: "#3b82f6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-pencil" style={{ fontSize: 14 }} />
          </button>
          <button onClick={e => { e.stopPropagation(); onEliminar(); }} title="Eliminar ficha"
            style={{ width: 32, height: 32, borderRadius: 7, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.28)", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-trash" style={{ fontSize: 14 }} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ItemCompacto({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.mutedLt, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: C.textSub, fontWeight: 500 }}>
        {value || "—"}
      </div>
    </div>
  );
}

function SeccionCard({ titulo, icono, children }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,.05)",
    }}>
      <div style={{
        padding: "12px 18px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: 9,
        background: "#f8fafc",
      }}>
        <i className={`bi ${icono}`} style={{ color: C.accent, fontSize: 14 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: C.textSub }}>{titulo}</span>
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

function ItemFicha({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.mutedLt, fontWeight: 600, textTransform: "uppercase",
                     letterSpacing: ".05em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

function Lbl({ children }) {
  return (
    <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                     letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
      {children}
    </label>
  );
}
