import { useEffect, useState } from "react";
import api from "../../api/api";

const C = {
  bg: "#0d1b2e", surface: "#112240", card: "#162a45",
  border: "rgba(255,255,255,0.07)", accent: "#e91e8c",
  accentD: "#c2185b", text: "#e2e8f0", muted: "#94a3b8", inputBg: "#0d1b2e",
};

const inputSt = {
  background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", width: "100%", fontSize: 14, outline: "none",
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
    <div style={{ color: C.text, minHeight: "100vh" }}>
      {/* Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${C.surface} 0%, #2d0a1f 100%)`,
        borderRadius: 16, padding: "24px 28px", marginBottom: 24,
        border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(0,0,0,.3)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-person-vcard-fill" style={{ fontSize: 22, color: "#fff" }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: 22, color: C.text }}>Ficha Estética del Paciente</h4>
            <span style={{ color: C.muted, fontSize: 13 }}>
              Fototipo, procedimientos previos, zonas de interés y expectativas
            </span>
          </div>
        </div>
        {ficha && !editando && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={abrir}
              style={{
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                border: "none", borderRadius: 10, padding: "10px 20px",
                color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}>
              <i className="bi bi-pencil-square" /> Editar ficha
            </button>
            <button onClick={eliminarFicha}
              style={{
                background: "rgba(239,68,68,.15)",
                border: "1px solid rgba(239,68,68,.3)",
                borderRadius: 10, padding: "10px 20px",
                color: "#ef4444", fontWeight: 600, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}>
              <i className="bi bi-trash" /> Eliminar ficha
            </button>
          </div>
        )}
      </div>

      {/* Buscador de paciente */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", position: "relative" }}>
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
                boxShadow: "0 8px 24px rgba(0,0,0,.4)", zIndex: 20,
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
                boxShadow: "0 8px 24px rgba(0,0,0,.4)", zIndex: 20,
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
          background: `${C.accent}12`, border: `1px solid ${C.accent}33`,
          borderRadius: 12, padding: "12px 18px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {(pacSeleccionado.nombres?.[0] || "?").toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: C.text }}>
              {pacSeleccionado.nombres} {pacSeleccionado.apellidos}
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {pacSeleccionado.dni && `DNI: ${pacSeleccionado.dni}`}
              {pacSeleccionado.dni && pacSeleccionado.fecha_nacimiento && " • "}
              {pacSeleccionado.fecha_nacimiento &&
                `${new Date().getFullYear() - new Date(pacSeleccionado.fecha_nacimiento).getFullYear()} años`}
            </div>
          </div>
        </div>
      )}

      {/* Toast guardado */}
      {guardado && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "rgba(16,185,129,.9)", borderRadius: 12, padding: "12px 20px",
          color: "#fff", fontWeight: 600, fontSize: 14,
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,.3)",
        }}>
          <i className="bi bi-check-circle-fill" /> Ficha estética guardada correctamente
        </div>
      )}

      {!pacId ? (
        pacientesConFicha.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 0" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, margin: "0 auto 18px",
              background: "rgba(233,30,140,.07)", border: "1px solid rgba(233,30,140,.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="bi bi-person-vcard" style={{ fontSize: 30, color: C.accent }} />
            </div>
            <p style={{ color: C.muted, fontSize: 15, fontWeight: 600, margin: 0 }}>Sin fichas estéticas registradas</p>
            <p style={{ color: C.muted, fontSize: 13, margin: "8px 0 0" }}>Busca un paciente arriba para crear su ficha estética</p>
          </div>
        ) : (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <h5 style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 16 }}>
                  <i className="bi bi-people-fill me-2" style={{ color: C.accent }} />
                  Pacientes con Ficha Estética
                </h5>
                <span style={{ fontSize: 12, color: C.muted, marginTop: 4, display: "block" }}>
                  {pacientesConFicha.length} paciente{pacientesConFicha.length !== 1 ? "s" : ""} con ficha registrada
                </span>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: `${C.accent}08`, borderBottom: `1px solid ${C.border}` }}>
                    <th style={{
                      padding: "12px 18px", textAlign: "left", fontSize: 12,
                      fontWeight: 700, color: C.muted, textTransform: "uppercase",
                      letterSpacing: ".05em",
                    }}>
                      Paciente
                    </th>
                    <th style={{
                      padding: "12px 18px", textAlign: "left", fontSize: 12,
                      fontWeight: 700, color: C.muted, textTransform: "uppercase",
                      letterSpacing: ".05em",
                    }}>
                      DNI
                    </th>
                    <th style={{
                      padding: "12px 18px", textAlign: "left", fontSize: 12,
                      fontWeight: 700, color: C.muted, textTransform: "uppercase",
                      letterSpacing: ".05em",
                    }}>
                      Última Actualización
                    </th>
                    <th style={{
                      padding: "12px 18px", textAlign: "center", fontSize: 12,
                      fontWeight: 700, color: C.muted, textTransform: "uppercase",
                      letterSpacing: ".05em", width: 140,
                    }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pacientesConFicha.map(pac => (
                    <tr
                      key={pac.id}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        cursor: "pointer",
                        transition: "background .2s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = `${C.accent}08`}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      onClick={() => abrirModalVer(pac)}
                    >
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, color: "#fff", fontSize: 14, flexShrink: 0,
                          }}>
                            {(pac.nombres?.[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>
                              {pac.nombres} {pac.apellidos}
                            </div>
                            {pac.fecha_nacimiento && (
                              <div style={{ fontSize: 12, color: C.muted }}>
                                {new Date().getFullYear() - new Date(pac.fecha_nacimiento).getFullYear()} años
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, color: C.muted }}>
                          {pac.dni || "N/A"}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, color: C.muted }}>
                          <i className="bi bi-calendar2 me-2" />
                          {new Date(pac.ultima_actualizacion).toLocaleDateString("es-PE", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirModalVer(pac);
                            }}
                            style={{
                              width: 34, height: 34, borderRadius: 8,
                              background: `${C.accent}15`,
                              border: `1px solid ${C.accent}33`,
                              color: C.accent,
                              cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all .2s",
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = `${C.accent}33`;
                              e.currentTarget.style.transform = "scale(1.1)";
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = `${C.accent}15`;
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                            title="Ver ficha"
                          >
                            <i className="bi bi-eye" style={{ fontSize: 16 }} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPacId(pac.id);
                              setBusqueda(`${pac.nombres} ${pac.apellidos}`);
                              // Esperar a que se cargue la ficha
                              setTimeout(() => abrir(), 100);
                            }}
                            style={{
                              width: 34, height: 34, borderRadius: 8,
                              background: "rgba(59,130,246,.15)",
                              border: "1px solid rgba(59,130,246,.33)",
                              color: "#3b82f6",
                              cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all .2s",
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = "rgba(59,130,246,.33)";
                              e.currentTarget.style.transform = "scale(1.1)";
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = "rgba(59,130,246,.15)";
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                            title="Editar ficha"
                          >
                            <i className="bi bi-pencil" style={{ fontSize: 15 }} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('¿Eliminar la ficha estética de este paciente? Esta acción no se puede deshacer.')) {
                                localStorage.removeItem(`ficha_estetica_${pac.id}`);
                                cargarPacientesConFicha(pacientes);
                              }
                            }}
                            style={{
                              width: 34, height: 34, borderRadius: 8,
                              background: "rgba(239,68,68,.15)",
                              border: "1px solid rgba(239,68,68,.33)",
                              color: "#ef4444",
                              cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all .2s",
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = "rgba(239,68,68,.33)";
                              e.currentTarget.style.transform = "scale(1.1)";
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = "rgba(239,68,68,.15)";
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                            title="Eliminar ficha"
                          >
                            <i className="bi bi-trash" style={{ fontSize: 15 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : ficha && !editando ? (
        /* Vista de ficha guardada */
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Datos básicos */}
          <SeccionCard titulo="Piel y tipo de paciente" icono="bi-person-fill">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
              <ItemFicha label="Fototipo Fitzpatrick" value={ficha.fototipo ? `Tipo ${ficha.fototipo}` : "—"} />
              <ItemFicha label="Tipo de piel" value={ficha.piel_tipo} />
              <ItemFicha label="Cicatrización" value={ficha.cicatrizacion} />
              <ItemFicha label="Fumador/a" value={ficha.fumador ? "Sí" : "No"} />
              <ItemFicha label="Consumo alcohol" value={ficha.alcoholismo} />
              <ItemFicha label="Alergia al látex" value={ficha.alergias_latex ? "Sí" : "No"} />
            </div>
          </SeccionCard>
          <SeccionCard titulo="Procedimientos previos" icono="bi-scissors">
            {ficha.procedimientos_previos?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ficha.procedimientos_previos.map(p => (
                  <span key={p} style={{
                    background: `${C.accent}15`, border: `1px solid ${C.accent}30`,
                    borderRadius: 8, padding: "4px 12px", fontSize: 13,
                    color: C.text, fontWeight: 500,
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
                    background: "rgba(255,255,255,.05)", border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "4px 12px", fontSize: 13, color: C.text,
                  }}>{z}</span>
                ))}
              </div>
            ) : <span style={{ color: C.muted, fontSize: 13 }}>No especificadas</span>}
          </SeccionCard>
          {(ficha.motivacion || ficha.expectativas) && (
            <SeccionCard titulo="Motivaciones y expectativas" icono="bi-star-fill">
              {ficha.motivacion && <ItemFicha label="Motivación del paciente" value={ficha.motivacion} />}
              {ficha.expectativas && <ItemFicha label="Expectativas" value={ficha.expectativas} />}
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
                      background: sel ? `${C.accent}18` : "rgba(255,255,255,.03)",
                      border: `2px solid ${sel ? C.accent : C.border}`,
                      borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10, transition: "all .18s",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: ft.color, flexShrink: 0,
                      border: "2px solid rgba(255,255,255,.2)",
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
                      background: sel ? `${C.accent}20` : "rgba(255,255,255,.04)",
                      border: `1px solid ${sel ? C.accent : C.border}`,
                      borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                      color: sel ? C.accent : C.muted, fontSize: 13, fontWeight: sel ? 600 : 400,
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
                      background: sel ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.03)",
                      border: `1px solid ${sel ? "rgba(255,255,255,.25)" : C.border}`,
                      borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                      color: sel ? C.text : C.muted, fontSize: 13, fontWeight: sel ? 600 : 400,
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
                           padding: "11px 24px", color: C.muted, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
            )}
            <button type="submit"
              style={{
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                border: "none", borderRadius: 9, padding: "11px 28px",
                color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15,
                boxShadow: `0 4px 16px rgba(233,30,140,.4)`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
              <i className="bi bi-check-lg" /> Guardar ficha estética
            </button>
          </div>
        </form>
      ) : null}

      {/* Modal para ver ficha */}
      {modalVer && fichaModal && pacModal && (
        <>
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 9998,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
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
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              width: "90%",
              maxWidth: 900,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Header del modal */}
            <div style={{
              background: `linear-gradient(135deg, ${C.surface} 0%, #2d0a1f 100%)`,
              padding: "20px 24px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              position: "sticky", top: 0, zIndex: 10,
              borderRadius: "16px 16px 0 0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, color: "#fff", fontSize: 18,
                }}>
                  {(pacModal.nombres?.[0] || "?").toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 700, fontSize: 18, color: C.text }}>
                    {pacModal.nombres} {pacModal.apellidos}
                  </h3>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    DNI: {pacModal.dni || "N/A"} • {pacModal.fecha_nacimiento &&
                      `${new Date().getFullYear() - new Date(pacModal.fecha_nacimiento).getFullYear()} años`}
                  </div>
                </div>
              </div>
              <button
                onClick={cerrarModal}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(239,68,68,.15)",
                  border: "1px solid rgba(239,68,68,.3)",
                  color: "#ef4444",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .2s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,.25)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,.15)"}
              >
                <i className="bi bi-x-lg" style={{ fontSize: 16 }} />
              </button>
            </div>

            {/* Contenido del modal */}
            <div style={{ padding: "24px" }}>
              {/* Características de la piel - Grid compacto */}
              <div style={{
                background: `${C.accent}08`,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "16px 20px",
                marginBottom: 16,
              }}>
                <h5 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  <i className="bi bi-person-fill me-2" style={{ color: C.accent }} />
                  Características de la Piel
                </h5>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "12px 16px" }}>
                  <ItemCompacto label="Fototipo" value={fichaModal.fototipo ? `Tipo ${fichaModal.fototipo}` : "—"} />
                  <ItemCompacto label="Tipo de piel" value={fichaModal.piel_tipo} />
                  <ItemCompacto label="Cicatrización" value={fichaModal.cicatrizacion} />
                  <ItemCompacto label="Fumador/a" value={fichaModal.fumador ? "Sí" : "No"} />
                  <ItemCompacto label="Alcohol" value={fichaModal.alcoholismo} />
                  <ItemCompacto label="Alergia látex" value={fichaModal.alergias_latex ? "Sí" : "No"} />
                </div>
              </div>

              {/* Procedimientos previos */}
              {fichaModal.procedimientos_previos?.length > 0 && (
                <div style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: "16px 20px",
                  marginBottom: 16,
                }}>
                  <h5 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    <i className="bi bi-scissors me-2" style={{ color: C.accent }} />
                    Procedimientos Previos
                  </h5>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {fichaModal.procedimientos_previos.map(p => (
                      <span key={p} style={{
                        background: `${C.accent}20`,
                        border: `1px solid ${C.accent}40`,
                        borderRadius: 6,
                        padding: "3px 10px",
                        fontSize: 12,
                        color: C.text,
                        fontWeight: 500,
                      }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Zonas de interés */}
              {fichaModal.zonas_interes?.length > 0 && (
                <div style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: "16px 20px",
                  marginBottom: 16,
                }}>
                  <h5 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    <i className="bi bi-geo-alt-fill me-2" style={{ color: C.accent }} />
                    Zonas de Interés
                  </h5>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {fichaModal.zonas_interes.map(z => (
                      <span key={z} style={{
                        background: "rgba(255,255,255,.05)",
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        padding: "3px 10px",
                        fontSize: 12,
                        color: C.muted,
                      }}>{z}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Motivaciones y expectativas */}
              {(fichaModal.motivacion || fichaModal.expectativas) && (
                <div style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: "16px 20px",
                  marginBottom: 16,
                }}>
                  <h5 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    <i className="bi bi-star-fill me-2" style={{ color: C.accent }} />
                    Motivaciones y Expectativas
                  </h5>
                  <div style={{ display: "grid", gap: 12 }}>
                    {fichaModal.motivacion && (
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>Motivación</div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{fichaModal.motivacion}</div>
                      </div>
                    )}
                    {fichaModal.expectativas && (
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>Expectativas</div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{fichaModal.expectativas}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notas del médico */}
              {fichaModal.notas_medico && (
                <div style={{
                  background: `${C.accent}08`,
                  border: `1px solid ${C.accent}30`,
                  borderRadius: 12,
                  padding: "16px 20px",
                }}>
                  <h5 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    <i className="bi bi-journal-medical me-2" style={{ color: C.accent }} />
                    Notas del Médico
                  </h5>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{fichaModal.notas_medico}</div>
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div style={{
              padding: "16px 24px",
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              position: "sticky",
              bottom: 0,
              background: C.card,
              borderRadius: "0 0 16px 16px",
            }}>
              <button
                onClick={() => {
                  cerrarModal();
                  seleccionarPaciente(pacModal);
                  setEditando(true);
                }}
                style={{
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all .2s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <i className="bi bi-pencil" /> Editar Ficha
              </button>
              <button
                onClick={cerrarModal}
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "10px 20px",
                  color: C.muted,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ItemCompacto({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
        {value || "—"}
      </div>
    </div>
  );
}

function SeccionCard({ titulo, icono, children }) {
  return (
    <div style={{
      background: "#162a45", border: "rgba(255,255,255,0.07) solid 1px",
      borderRadius: 14, overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(0,0,0,.15)",
      }}>
        <i className={`bi ${icono}`} style={{ color: "#e91e8c", fontSize: 14 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>{titulo}</span>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function ItemFicha({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase",
                     letterSpacing: ".05em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

function Lbl({ children }) {
  return (
    <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase",
                     letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
      {children}
    </label>
  );
}
