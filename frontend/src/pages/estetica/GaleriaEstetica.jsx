import { useEffect, useState, useRef } from "react";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";

const C = {
  bg: "#0d1b2e", surface: "#112240", card: "#162a45",
  border: "rgba(255,255,255,0.07)", accent: "#e91e8c",
  accentD: "#c2185b", text: "#e2e8f0", muted: "#94a3b8",
  inputBg: "#0d1b2e", success: "#10b981",
};

const inputSt = {
  background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", width: "100%", fontSize: 14, outline: "none",
};

// 6 poses fijas del rostro
const POSES = [
  { id: "frontal",       label: "Frontal",        icon: "bi-person-fill",        desc: "Vista de frente" },
  { id: "45_izq",        label: "45° Izquierda",  icon: "bi-arrow-return-left",  desc: "Perfil 45° izq." },
  { id: "45_der",        label: "45° Derecha",    icon: "bi-arrow-return-right", desc: "Perfil 45° der." },
  { id: "perfil_izq",    label: "Perfil Izq.",    icon: "bi-person-badge",       desc: "Perfil completo izq." },
  { id: "perfil_der",    label: "Perfil Der.",    icon: "bi-person-badge-fill",  desc: "Perfil completo der." },
  { id: "cenital",       label: "Vista Superior", icon: "bi-arrow-up-circle",    desc: "Vista desde arriba" },
];

export default function GaleriaEstetica() {
  const { user } = useAuth();
  const [pacientes,    setPacientes]    = useState([]);
  const [pacientesConSesiones, setPacientesConSesiones] = useState([]);
  const [pacId,        setPacId]        = useState("");
  const [sesiones,     setSesiones]     = useState([]);
  const [sesionActual, setSesionActual] = useState(null);
  const [cargando,     setCargando]     = useState(false);
  const [cargandoPacientes, setCargandoPacientes] = useState(true);
  const [tab,          setTab]          = useState("ver"); // "ver" | "nueva"
  const [nuevaSesion,  setNuevaSesion]  = useState({ nombre: "", fecha: new Date().toISOString().split("T")[0] });
  const [creandoSesion,setCreandoSesion]= useState(false);
  const [busqueda,     setBusqueda]     = useState("");
  const [mostrarLista, setMostrarLista] = useState(false);
  const [editando,     setEditando]     = useState(null);

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    setCargandoPacientes(true);
    try {
      // Cargar pacientes y sesiones en paralelo
      const [resPacientes, resSesiones] = await Promise.all([
        api.get("/pacientes"),
        api.get("/galeria-estetica/sesiones"), // Sin paciente_id = todas las sesiones
      ]);

      const todosPacientes = resPacientes.data.data || [];
      const todasSesiones = resSesiones.data.data || [];

      console.log("Pacientes cargados:", todosPacientes.length);
      console.log("Sesiones cargadas:", todasSesiones.length);

      setPacientes(todosPacientes);

      // Agrupar sesiones por paciente
      const pacientesMap = {};
      todasSesiones.forEach(sesion => {
        const pid = sesion.paciente_id;
        if (!pacientesMap[pid]) {
          pacientesMap[pid] = {
            paciente_id: pid,
            paciente_nombres: sesion.paciente_nombres,
            paciente_apellidos: sesion.paciente_apellidos,
            paciente_dni: sesion.paciente_dni,
            paciente_fecha_nacimiento: sesion.paciente_fecha_nacimiento,
            total_sesiones: 0,
            ultima_sesion: sesion.fecha,
          };
        }
        pacientesMap[pid].total_sesiones++;
        if (new Date(sesion.fecha) > new Date(pacientesMap[pid].ultima_sesion)) {
          pacientesMap[pid].ultima_sesion = sesion.fecha;
        }
      });

      const pacientesConSesiones = Object.values(pacientesMap)
        .sort((a, b) => new Date(b.ultima_sesion) - new Date(a.ultima_sesion));

      console.log("Pacientes con sesiones:", pacientesConSesiones.length);
      setPacientesConSesiones(pacientesConSesiones);
    } catch (e) {
      console.error("Error al cargar datos iniciales:", e);
      alert("Error al cargar datos: " + (e.response?.data?.message || e.message || "Verifica que el backend esté corriendo"));
      setPacientes([]);
      setPacientesConSesiones([]);
    } finally {
      setCargandoPacientes(false);
    }
  };

  useEffect(() => {
    if (!pacId) { setSesiones([]); setSesionActual(null); return; }
    cargarSesiones();
  }, [pacId]);

  const cargarSesiones = async () => {
    setCargando(true);
    try {
      const r = await api.get(`/galeria-estetica/sesiones?paciente_id=${pacId}`);
      const data = r.data.data || [];
      setSesiones(data);
      setSesionActual(null); // No seleccionar automáticamente, que usuario elija de la tabla
    } catch {
      setSesiones([]);
    } finally {
      setCargando(false);
    }
  };

  const crearSesion = async () => {
    if (!nuevaSesion.nombre.trim()) return alert("Ingresa el nombre del procedimiento");
    setCreandoSesion(true);
    try {
      const r = await api.post("/galeria-estetica/sesiones", {
        paciente_id: pacId,
        nombre: nuevaSesion.nombre,
        fecha: nuevaSesion.fecha,
      });
      await cargarSesiones();
      setSesionActual(r.data.data);
      setTab("ver");
      setNuevaSesion({ nombre: "", fecha: new Date().toISOString().split("T")[0] });
    } catch (e) {
      alert("Error al crear sesión: " + (e.response?.data?.message || e.message));
    } finally {
      setCreandoSesion(false);
    }
  };

  const editarSesion = async (sesionId, datos) => {
    try {
      await api.put(`/galeria-estetica/sesiones/${sesionId}`, datos);
      await cargarSesiones();
      setEditando(null);
    } catch (e) {
      alert("Error al editar sesión: " + (e.response?.data?.message || e.message));
    }
  };

  const eliminarSesion = async (sesionId) => {
    if (!window.confirm("¿Eliminar esta sesión y todas sus fotos? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/galeria-estetica/sesiones/${sesionId}`);
      await cargarSesiones();
      await cargarDatosIniciales(); // Actualizar tabla de pacientes con sesiones
    } catch (e) {
      alert("Error al eliminar sesión: " + (e.response?.data?.message || e.message));
    }
  };

  const pacSeleccionado = pacientes.find(p => String(p.id) === String(pacId));

  // Filtrar pacientes por búsqueda
  const pacientesFiltrados = pacientes.filter(p => {
    const textoCompleto = `${p.nombres} ${p.apellidos} ${p.dni || ""}`.toLowerCase();
    return textoCompleto.includes(busqueda.toLowerCase());
  });

  const seleccionarPaciente = (paciente) => {
    setPacId(paciente.id);
    setBusqueda(`${paciente.nombres} ${paciente.apellidos}`);
    setMostrarLista(false);
    setSesionActual(null);
  };

  const seleccionarPacienteConSesiones = (pac) => {
    setPacId(pac.paciente_id);
    setBusqueda(`${pac.paciente_nombres} ${pac.paciente_apellidos}`);
    setSesionActual(null);
  };

  const limpiarBusqueda = () => {
    setBusqueda("");
    setPacId("");
    setMostrarLista(false);
    setSesionActual(null);
  };

  return (
    <div style={{ color: C.text, minHeight: "100vh" }}>

      {/* Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${C.surface} 0%, #2d0a1f 100%)`,
        borderRadius: 16, padding: "24px 28px", marginBottom: 24,
        border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(0,0,0,.3)",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 16px rgba(233,30,140,.4)`,
        }}>
          <i className="bi bi-camera2" style={{ fontSize: 22, color: "#fff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontWeight: 700, fontSize: 22, color: C.text }}>
            Galería Antes / Después
          </h4>
          <span style={{ color: C.muted, fontSize: 13 }}>
            6 poses de rostro • Antes y Después del procedimiento
          </span>
        </div>
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

      {/* Card del paciente */}
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
          <button
            onClick={() => setTab(tab === "nueva" ? "ver" : "nueva")}
            style={{
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
              border: "none", borderRadius: 10, padding: "8px 18px",
              color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="bi bi-plus-lg" />
            Nueva sesión
          </button>
        </div>
      )}

      {/* Tabla de sesiones */}
      {pacId && sesiones.length > 0 && tab === "ver" && !sesionActual && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 12, marginBottom: 24, overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <h5 style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 16 }}>
                <i className="bi bi-folder2-open me-2" style={{ color: C.accent }} />
                Sesiones de Fotos
              </h5>
              <span style={{ fontSize: 12, color: C.muted, marginTop: 4, display: "block" }}>
                Selecciona una sesión para ver las fotos • {sesiones.length} sesión{sesiones.length !== 1 ? "es" : ""}
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
                    Procedimiento
                  </th>
                  <th style={{
                    padding: "12px 18px", textAlign: "left", fontSize: 12,
                    fontWeight: 700, color: C.muted, textTransform: "uppercase",
                    letterSpacing: ".05em",
                  }}>
                    Fecha
                  </th>
                  <th style={{
                    padding: "12px 18px", textAlign: "center", fontSize: 12,
                    fontWeight: 700, color: C.muted, textTransform: "uppercase",
                    letterSpacing: ".05em", width: 120,
                  }}>
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {sesiones.map(sesion => (
                  <tr
                    key={sesion.id}
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      transition: "background .2s",
                      background: editando?.id === sesion.id ? `${C.accent}08` : "transparent",
                    }}
                    onMouseEnter={e => {
                      if (editando?.id !== sesion.id) e.currentTarget.style.background = `${C.accent}08`;
                    }}
                    onMouseLeave={e => {
                      if (editando?.id !== sesion.id) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: `linear-gradient(135deg, ${C.accent}33, ${C.accentD}33)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <i className="bi bi-scissors" style={{ fontSize: 15, color: C.accent }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          {editando?.id === sesion.id ? (
                            <input
                              type="text"
                              value={editando.nombre}
                              onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                              style={{
                                ...inputSt,
                                padding: "6px 10px",
                                fontSize: 13,
                                width: "100%",
                              }}
                              placeholder="Nombre del procedimiento"
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <div style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>
                              {sesion.nombre}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      {editando?.id === sesion.id ? (
                        <input
                          type="date"
                          value={editando.fecha}
                          onChange={e => setEditando({ ...editando, fecha: e.target.value })}
                          style={{
                            ...inputSt,
                            padding: "6px 10px",
                            fontSize: 12,
                            width: "160px",
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <div style={{ fontSize: 13, color: C.muted }}>
                          <i className="bi bi-calendar2 me-2" />
                          {new Date(sesion.fecha).toLocaleDateString("es-PE", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 18px", textAlign: "center" }}>
                      {editando?.id === sesion.id ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            onClick={() => editarSesion(sesion.id, { nombre: editando.nombre, fecha: editando.fecha })}
                            style={{
                              background: `linear-gradient(135deg, ${C.success}, #059669)`,
                              border: "none", borderRadius: 7, padding: "6px 12px",
                              color: "#fff", fontSize: 12, cursor: "pointer",
                              fontWeight: 600, display: "flex", alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <i className="bi bi-check-lg" />
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditando(null)}
                            style={{
                              background: "rgba(255,255,255,.06)", border: `1px solid ${C.border}`,
                              borderRadius: 7, padding: "6px 12px",
                              color: C.muted, fontSize: 12, cursor: "pointer",
                            }}
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSesionActual(sesion);
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
                            title="Ver fotos"
                          >
                            <i className="bi bi-images" style={{ fontSize: 16 }} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditando({
                                id: sesion.id,
                                nombre: sesion.nombre,
                                fecha: sesion.fecha,
                              });
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
                            title="Editar sesión"
                          >
                            <i className="bi bi-pencil" style={{ fontSize: 15 }} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              eliminarSesion(sesion.id);
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
                            title="Eliminar sesión"
                          >
                            <i className="bi bi-trash" style={{ fontSize: 15 }} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formulario nueva sesión */}
      {tab === "nueva" && pacId && (
        <div style={{
          background: C.card, border: `1px solid ${C.accent}33`,
          borderRadius: 14, padding: "20px 22px", marginBottom: 24,
        }}>
          <h5 style={{ color: C.accent, margin: "0 0 16px", fontWeight: 700 }}>
            <i className="bi bi-plus-circle me-2" />Nueva sesión de fotos
          </h5>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 220px" }}>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 5 }}>
                Nombre del procedimiento *
              </label>
              <input
                style={inputSt}
                placeholder="Ej: Rinoplastia, Bótox, Relleno labial..."
                value={nuevaSesion.nombre}
                onChange={e => setNuevaSesion(p => ({ ...p, nombre: e.target.value }))}
              />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 5 }}>
                Fecha
              </label>
              <input
                type="date"
                style={inputSt}
                value={nuevaSesion.fecha}
                onChange={e => setNuevaSesion(p => ({ ...p, fecha: e.target.value }))}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button
                onClick={crearSesion}
                disabled={creandoSesion || !nuevaSesion.nombre.trim()}
                style={{
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                  border: "none", borderRadius: 8, padding: "9px 20px",
                  color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14,
                  opacity: creandoSesion || !nuevaSesion.nombre.trim() ? .5 : 1,
                }}
              >
                {creandoSesion ? "Creando..." : "Crear sesión"}
              </button>
              <button
                onClick={() => setTab("ver")}
                style={{
                  background: "rgba(255,255,255,.06)", border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "9px 16px", color: C.muted,
                  cursor: "pointer", fontSize: 14,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      {!pacId ? (
        cargandoPacientes ? (
          <Spin />
        ) : pacientesConSesiones.length === 0 ? (
          <EmptyState icon="bi-camera2" titulo="Sin sesiones registradas"
            desc="Aún no hay pacientes con sesiones de fotos. Busca un paciente arriba para crear su primera sesión." />
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
                  Pacientes con Sesiones
                </h5>
                <span style={{ fontSize: 12, color: C.muted, marginTop: 4, display: "block" }}>
                  {pacientesConSesiones.length} paciente{pacientesConSesiones.length !== 1 ? "s" : ""} con galería fotográfica
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
                      padding: "12px 18px", textAlign: "center", fontSize: 12,
                      fontWeight: 700, color: C.muted, textTransform: "uppercase",
                      letterSpacing: ".05em",
                    }}>
                      Sesiones
                    </th>
                    <th style={{
                      padding: "12px 18px", textAlign: "left", fontSize: 12,
                      fontWeight: 700, color: C.muted, textTransform: "uppercase",
                      letterSpacing: ".05em",
                    }}>
                      Última Sesión
                    </th>
                    <th style={{
                      padding: "12px 18px", textAlign: "center", fontSize: 12,
                      fontWeight: 700, color: C.muted, textTransform: "uppercase",
                      letterSpacing: ".05em", width: 120,
                    }}>
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pacientesConSesiones.map(pac => (
                    <tr
                      key={pac.paciente_id}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        cursor: "pointer",
                        transition: "background .2s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = `${C.accent}08`}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      onClick={() => seleccionarPacienteConSesiones(pac)}
                    >
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, color: "#fff", fontSize: 14, flexShrink: 0,
                          }}>
                            {(pac.paciente_nombres?.[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>
                              {pac.paciente_nombres} {pac.paciente_apellidos}
                            </div>
                            {pac.paciente_fecha_nacimiento && (
                              <div style={{ fontSize: 12, color: C.muted }}>
                                {new Date().getFullYear() - new Date(pac.paciente_fecha_nacimiento).getFullYear()} años
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, color: C.muted }}>
                          {pac.paciente_dni || "N/A"}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px", textAlign: "center" }}>
                        <span style={{
                          background: `${C.accent}22`,
                          color: C.accent,
                          border: `1px solid ${C.accent}44`,
                          borderRadius: 6, padding: "3px 12px", fontSize: 12,
                          fontWeight: 700,
                        }}>
                          {pac.total_sesiones}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 13, color: C.muted }}>
                          <i className="bi bi-calendar2 me-2" />
                          {new Date(pac.ultima_sesion).toLocaleDateString("es-PE", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px", textAlign: "center" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            seleccionarPacienteConSesiones(pac);
                          }}
                          style={{
                            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                            border: "none", borderRadius: 8, padding: "7px 16px",
                            color: "#fff", fontSize: 12, cursor: "pointer",
                            fontWeight: 600, display: "flex", alignItems: "center",
                            gap: 6, margin: "0 auto",
                          }}
                        >
                          <i className="bi bi-folder2-open" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : cargando ? (
        <Spin />
      ) : sesiones.length === 0 && tab === "ver" ? (
        <EmptyState icon="bi-camera2" titulo="Sin sesiones registradas"
          desc='Crea una nueva sesión con el botón "Nueva sesión" para empezar a subir fotos.' />
      ) : sesionActual && tab === "ver" ? (
        <SesionFotos sesion={sesionActual} pacId={pacId} onCerrar={() => setSesionActual(null)} />
      ) : null}
    </div>
  );
}

/* ─── Componente principal de la sesión ─── */
function SesionFotos({ sesion, pacId, onCerrar }) {
  const [fotos,     setFotos]     = useState({}); // { "antes_frontal": {...}, ... }
  const [cargando,  setCargando]  = useState(true);
  const [subiendo,  setSubiendo]  = useState({});
  const [modalImg,  setModalImg]  = useState(null);
  const [indiceActual, setIndiceActual] = useState(0);
  const carruselAntesRef = useRef(null);
  const carruselDespuesRef = useRef(null);

  useEffect(() => {
    setCargando(true);
    api.get(`/galeria-estetica/fotos?sesion_id=${sesion.id}`)
      .then(r => {
        const mapa = {};
        (r.data.data || []).forEach(f => { mapa[`${f.momento}_${f.pose}`] = f; });
        setFotos(mapa);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [sesion.id]);

  const subirFoto = async (momento, poseId, archivo) => {
    const key = `${momento}_${poseId}`;
    setSubiendo(p => ({ ...p, [key]: true }));
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("sesion_id", sesion.id);
      fd.append("paciente_id", pacId);
      fd.append("momento", momento);   // "antes" | "despues"
      fd.append("pose", poseId);
      const r = await api.post("/galeria-estetica/fotos", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFotos(p => ({ ...p, [key]: r.data.data }));
    } catch (e) {
      alert("Error al subir: " + (e.response?.data?.message || e.message));
    } finally {
      setSubiendo(p => ({ ...p, [key]: false }));
    }
  };

  const eliminarFoto = async (momento, poseId) => {
    const key = `${momento}_${poseId}`;
    const foto = fotos[key];
    if (!foto || !window.confirm("¿Eliminar esta foto?")) return;
    try {
      await api.delete(`/galeria-estetica/fotos/${foto.id}`);
      setFotos(p => { const n = { ...p }; delete n[key]; return n; });
    } catch (e) {
      alert("Error al eliminar");
    }
  };

  const navegarPose = (direccion) => {
    let nuevoIndice = indiceActual + direccion;
    if (nuevoIndice < 0) nuevoIndice = POSES.length - 1;
    if (nuevoIndice >= POSES.length) nuevoIndice = 0;
    setIndiceActual(nuevoIndice);

    // Scroll sincronizado en ambos carruseles - calcula el ancho dinámicamente
    if (carruselAntesRef.current) {
      const anchoCard = carruselAntesRef.current.offsetWidth;
      carruselAntesRef.current.scrollTo({ left: anchoCard * nuevoIndice, behavior: "smooth" });
    }
    if (carruselDespuesRef.current) {
      const anchoCard = carruselDespuesRef.current.offsetWidth;
      carruselDespuesRef.current.scrollTo({ left: anchoCard * nuevoIndice, behavior: "smooth" });
    }
  };

  // Detectar scroll manual para actualizar el índice
  useEffect(() => {
    const handleScroll = () => {
      if (carruselAntesRef.current) {
        const anchoCard = carruselAntesRef.current.offsetWidth;
        const scrollPos = carruselAntesRef.current.scrollLeft;
        const nuevoIndice = Math.round(scrollPos / anchoCard);
        if (nuevoIndice !== indiceActual && nuevoIndice >= 0 && nuevoIndice < POSES.length) {
          setIndiceActual(nuevoIndice);
          // Sincronizar el otro carrusel
          if (carruselDespuesRef.current) {
            const anchoDespues = carruselDespuesRef.current.offsetWidth;
            carruselDespuesRef.current.scrollTo({ left: anchoDespues * nuevoIndice, behavior: "smooth" });
          }
        }
      }
    };

    const refAntes = carruselAntesRef.current;
    if (refAntes) {
      refAntes.addEventListener("scrollend", handleScroll);
    }

    return () => {
      if (refAntes) {
        refAntes.removeEventListener("scrollend", handleScroll);
      }
    };
  }, [indiceActual]);

  if (cargando) return <Spin />;

  const contAntes   = POSES.filter(p => fotos[`antes_${p.id}`]).length;
  const contDespues = POSES.filter(p => fotos[`despues_${p.id}`]).length;

  return (
    <div>
      {/* Header sesión */}
      <div style={{
        background: C.card, borderRadius: 12, padding: "14px 18px",
        marginBottom: 22, border: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <button
          onClick={onCerrar}
          style={{
            background: "rgba(255,255,255,.06)", border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "8px 12px", color: C.text,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}
          title="Volver a la lista de sesiones"
        >
          <i className="bi bi-arrow-left" />
          Volver
        </button>
        <div>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 16 }}>
            <i className="bi bi-scissors me-2" style={{ color: C.accent }} />
            {sesion.nombre}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            <i className="bi bi-calendar2 me-1" />
            {new Date(sesion.fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge color="#3b82f6" text={`${contAntes}/6 antes`} />
          <Badge color={C.success} text={`${contDespues}/6 después`} />
        </div>
      </div>

      {/* Carruseles Antes/Después */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Controles de navegación centrales */}
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center", gap: 16,
          padding: "12px 0",
        }}>
          <button
            onClick={() => navegarPose(-1)}
            style={{
              width: 46, height: 46, borderRadius: 12,
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
              border: "none", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(233,30,140,.3)",
              transition: "transform .2s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <i className="bi bi-chevron-left" style={{ fontSize: 20, fontWeight: 700 }} />
          </button>
          
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "8px 20px",
            minWidth: 200, textAlign: "center",
          }}>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Pose actual</div>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 15, marginBottom: 6 }}>
              <i className={`bi ${POSES[indiceActual].icon} me-2`} style={{ color: C.accent }} />
              {POSES[indiceActual].label}
            </div>
            {/* Indicadores de puntos */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              {POSES.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: idx === indiceActual ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: idx === indiceActual ? C.accent : `${C.muted}33`,
                    transition: "all .3s",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setIndiceActual(idx);
                    if (carruselAntesRef.current) {
                      const ancho = carruselAntesRef.current.offsetWidth;
                      carruselAntesRef.current.scrollTo({ left: ancho * idx, behavior: "smooth" });
                    }
                    if (carruselDespuesRef.current) {
                      const ancho = carruselDespuesRef.current.offsetWidth;
                      carruselDespuesRef.current.scrollTo({ left: ancho * idx, behavior: "smooth" });
                    }
                  }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={() => navegarPose(1)}
            style={{
              width: 46, height: 46, borderRadius: 12,
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
              border: "none", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(233,30,140,.3)",
              transition: "transform .2s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <i className="bi bi-chevron-right" style={{ fontSize: 20, fontWeight: 700 }} />
          </button>
        </div>

        {/* DESPUÉS - Carrusel superior */}
        <div>
          <div style={{
            background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)",
            borderRadius: 12, padding: "10px 16px", marginBottom: 12,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ color: "#34d399", fontWeight: 700, fontSize: 15 }}>
              <i className="bi bi-stars me-2" />DESPUÉS
            </span>
            <span style={{ fontSize: 12, color: "#34d399", opacity: 0.7 }}>
              {indiceActual + 1} / {POSES.length}
            </span>
          </div>
          <div
            ref={carruselDespuesRef}
            style={{
              display: "flex", gap: 0, overflowX: "auto", overflowY: "hidden",
              scrollBehavior: "smooth", scrollSnapType: "x mandatory",
              msOverflowStyle: "none", scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            }}
            className="hide-scrollbar"
          >
            {POSES.map(pose => (
              <div key={pose.id} style={{ 
                minWidth: "100%", width: "100%", flexShrink: 0,
                scrollSnapAlign: "start", scrollSnapStop: "always",
              }}>
                <TarjetaPose
                  pose={pose}
                  foto={fotos[`despues_${pose.id}`]}
                  subiendo={subiendo[`despues_${pose.id}`]}
                  color={C.success}
                  onSubir={archivo => subirFoto("despues", pose.id, archivo)}
                  onEliminar={() => eliminarFoto("despues", pose.id)}
                  onVerModal={() => setModalImg(fotos[`despues_${pose.id}`])}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ANTES - Carrusel inferior */}
        <div>
          <div style={{
            background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.3)",
            borderRadius: 12, padding: "10px 16px", marginBottom: 12,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 15 }}>
              <i className="bi bi-clock-history me-2" />ANTES
            </span>
            <span style={{ fontSize: 12, color: "#60a5fa", opacity: 0.7 }}>
              {indiceActual + 1} / {POSES.length}
            </span>
          </div>
          <div
            ref={carruselAntesRef}
            style={{
              display: "flex", gap: 0, overflowX: "auto", overflowY: "hidden",
              scrollBehavior: "smooth", scrollSnapType: "x mandatory",
              msOverflowStyle: "none", scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            }}
            className="hide-scrollbar"
          >
            {POSES.map(pose => (
              <div key={pose.id} style={{ 
                minWidth: "100%", width: "100%", flexShrink: 0,
                scrollSnapAlign: "start", scrollSnapStop: "always",
              }}>
                <TarjetaPose
                  pose={pose}
                  foto={fotos[`antes_${pose.id}`]}
                  subiendo={subiendo[`antes_${pose.id}`]}
                  color="#3b82f6"
                  onSubir={archivo => subirFoto("antes", pose.id, archivo)}
                  onEliminar={() => eliminarFoto("antes", pose.id)}
                  onVerModal={() => setModalImg(fotos[`antes_${pose.id}`])}
                />
              </div>
            ))}
          </div>
        </div>

        {/* CSS para ocultar scrollbar */}
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>

      {/* Modal lightbox */}
      {modalImg && (
        <div
          onClick={() => setModalImg(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(0,0,0,.9)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: C.surface, borderRadius: 16, maxWidth: 680,
            width: "100%", overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.7)",
          }}>
            <img
              src={modalImg.archivo_url}
              alt=""
              style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", display: "block" }}
            />
            <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <span style={{
                  background: modalImg.momento === "antes" ? "rgba(59,130,246,.2)" : "rgba(16,185,129,.2)",
                  color: modalImg.momento === "antes" ? "#60a5fa" : "#34d399",
                  border: `1px solid ${modalImg.momento === "antes" ? "rgba(59,130,246,.4)" : "rgba(16,185,129,.4)"}`,
                  borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700,
                  textTransform: "uppercase", marginRight: 8,
                }}>
                  {modalImg.momento}
                </span>
                <span style={{ color: C.muted, fontSize: 13 }}>
                  {POSES.find(p => p.id === modalImg.pose)?.label}
                </span>
              </div>
              <button
                onClick={() => setModalImg(null)}
                style={{
                  background: "rgba(255,255,255,.07)", border: "none", borderRadius: 8,
                  padding: "7px 14px", color: C.text, cursor: "pointer",
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tarjeta de una pose ─── */
function TarjetaPose({ pose, foto, subiendo, color, onSubir, onEliminar, onVerModal }) {
  const inputRef = useRef();

  const handleArchivo = e => {
    const f = e.target.files[0];
    if (f) onSubir(f);
    e.target.value = "";
  };

  return (
    <div style={{
      background: C.card, borderRadius: 12, overflow: "hidden",
      border: `1px solid ${foto ? `${color}44` : C.border}`,
      transition: "border-color .2s",
      height: "100%",
    }}>
      {/* Input file oculto — acepta cámara y galería en móvil */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"   // abre cámara trasera en móvil
        style={{ display: "none" }}
        onChange={handleArchivo}
      />

      {foto ? (
        /* ── Con foto ── */
        <div>
          <div style={{ position: "relative", background: "#000" }}>
            <img
              src={foto.archivo_url}
              alt={pose.label}
              onClick={onVerModal}
              style={{
                width: "100%", height: "min(60vh, 500px)", objectFit: "contain",
                display: "block", cursor: "zoom-in",
              }}
            />
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              background: "linear-gradient(to bottom, rgba(0,0,0,.6) 0%, transparent 100%)",
              padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                <i className={`bi ${pose.icon} me-2`} />{pose.label}
              </span>
              <i className="bi bi-check-circle-fill" style={{ color: "#10b981", fontSize: 16 }} />
            </div>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
              style={{
                flex: 1, background: `${color}22`, border: `1px solid ${color}44`,
                borderRadius: 8, padding: "8px 0", color, fontSize: 13,
                fontWeight: 600, cursor: "pointer",
              }}
            >
              <i className="bi bi-arrow-repeat me-1" />Reemplazar
            </button>
            <button
              onClick={onEliminar}
              style={{
                background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
                borderRadius: 8, padding: "8px 12px", color: "#ef4444",
                fontSize: 13, cursor: "pointer",
              }}
            >
              <i className="bi bi-trash" />
            </button>
          </div>
        </div>
      ) : (
        /* ── Sin foto ── */
        <button
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          style={{
            width: "100%", background: "transparent", border: "none",
            cursor: subiendo ? "wait" : "pointer", padding: 0,
          }}
        >
          <div style={{
            height: "min(60vh, 500px)", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10,
            background: `${color}08`,
          }}>
            {subiendo ? (
              <>
                <div style={{
                  width: 40, height: 40, border: `4px solid ${color}33`,
                  borderTopColor: color, borderRadius: "50%",
                  animation: "spin .8s linear infinite",
                }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <span style={{ fontSize: 13, color: C.muted }}>Subiendo...</span>
              </>
            ) : (
              <>
                <div style={{
                  width: 60, height: 60, borderRadius: 14,
                  background: `${color}18`, border: `2px dashed ${color}55`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="bi bi-camera-fill" style={{ fontSize: 24, color }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 15, color: C.text, fontWeight: 600, marginBottom: 4 }}>
                    <i className={`bi ${pose.icon} me-2`} />{pose.label}
                  </div>
                  <div style={{ fontSize: 12, color: `${C.muted}aa` }}>
                    Toca para tomar foto o subir desde galería
                  </div>
                </div>
              </>
            )}
          </div>
        </button>
      )}
    </div>
  );
}

function Badge({ color, text }) {
  return (
    <span style={{
      background: `${color}18`, border: `1px solid ${color}44`,
      borderRadius: 7, padding: "4px 10px", fontSize: 12,
      color, fontWeight: 600,
    }}>
      {text}
    </span>
  );
}

function Spin() {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{
        width: 40, height: 40, border: "3px solid rgba(255,255,255,.08)",
        borderTopColor: C.accent, borderRadius: "50%",
        animation: "spin .8s linear infinite", margin: "0 auto",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function EmptyState({ icon, titulo, desc }) {
  return (
    <div style={{ textAlign: "center", padding: "72px 0" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, margin: "0 auto 18px",
        background: "rgba(233,30,140,.07)", border: "1px solid rgba(233,30,140,.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`bi ${icon}`} style={{ fontSize: 30, color: C.accent }} />
      </div>
      <p style={{ color: "#94a3b8", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{titulo}</p>
      <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{desc}</p>
    </div>
  );
}