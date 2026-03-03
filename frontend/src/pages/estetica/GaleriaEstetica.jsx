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
  const [pacId,        setPacId]        = useState("");
  const [sesiones,     setSesiones]     = useState([]);
  const [sesionActual, setSesionActual] = useState(null);
  const [cargando,     setCargando]     = useState(false);
  const [tab,          setTab]          = useState("ver"); // "ver" | "nueva"
  const [nuevaSesion,  setNuevaSesion]  = useState({ nombre: "", fecha: new Date().toISOString().split("T")[0] });
  const [creandoSesion,setCreandoSesion]= useState(false);

  useEffect(() => {
    api.get("/pacientes").then(r => setPacientes(r.data.data || [])).catch(() => {});
  }, []);

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
      setSesionActual(data[0] || null);
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

  const pacSeleccionado = pacientes.find(p => String(p.id) === String(pacId));

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

      {/* Selector de paciente */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                          letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
            Paciente
          </label>
          <select
            style={{ ...inputSt, appearance: "none", cursor: "pointer" }}
            value={pacId}
            onChange={e => { setPacId(e.target.value); setSesionActual(null); }}
          >
            <option value="">— Seleccionar paciente —</option>
            {pacientes.map(p => (
              <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>
            ))}
          </select>
        </div>
        {sesiones.length > 0 && (
          <div style={{ flex: "1 1 240px" }}>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                            letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
              Sesión / Procedimiento
            </label>
            <select
              style={{ ...inputSt, appearance: "none", cursor: "pointer" }}
              value={sesionActual?.id || ""}
              onChange={e => setSesionActual(sesiones.find(s => String(s.id) === e.target.value) || null)}
            >
              {sesiones.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nombre} — {new Date(s.fecha).toLocaleDateString("es-PE")}
                </option>
              ))}
            </select>
          </div>
        )}
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
            <div style={{ fontWeight: 700, color: "#1e293b" }}>
              {pacSeleccionado.nombres} {pacSeleccionado.apellidos}
            </div>
            <div style={{ fontSize: 12, color: "#475569" }}>
              {pacSeleccionado.fecha_nacimiento &&
                `${new Date().getFullYear() - new Date(pacSeleccionado.fecha_nacimiento).getFullYear()} años`}
              {pacSeleccionado.dni ? ` · DNI: ${pacSeleccionado.dni}` : ""}
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
        <EmptyState icon="bi-person-circle" titulo="Selecciona un paciente"
          desc="Elige un paciente para ver o registrar su galería fotográfica." />
      ) : cargando ? (
        <Spin />
      ) : !sesionActual ? (
        <EmptyState icon="bi-camera2" titulo="Sin sesiones registradas"
          desc='Crea una nueva sesión con el botón "Nueva sesión" para empezar a subir fotos.' />
      ) : (
        <SesionFotos sesion={sesionActual} pacId={pacId} />
      )}
    </div>
  );
}

/* ─── Componente principal de la sesión ─── */
function SesionFotos({ sesion, pacId }) {
  const [fotos,     setFotos]     = useState({}); // { "antes_frontal": {...}, ... }
  const [cargando,  setCargando]  = useState(true);
  const [subiendo,  setSubiendo]  = useState({});
  const [modalImg,  setModalImg]  = useState(null);

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

      {/* Comparativa lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>

        {/* ANTES */}
        <div>
          <div style={{
            background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.3)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 14,
            textAlign: "center",
          }}>
            <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 15 }}>
              <i className="bi bi-clock-history me-2" />ANTES
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {POSES.map(pose => (
              <TarjetaPose
                key={pose.id}
                pose={pose}
                foto={fotos[`antes_${pose.id}`]}
                subiendo={subiendo[`antes_${pose.id}`]}
                color="#3b82f6"
                onSubir={archivo => subirFoto("antes", pose.id, archivo)}
                onEliminar={() => eliminarFoto("antes", pose.id)}
                onVerModal={() => setModalImg(fotos[`antes_${pose.id}`])}
              />
            ))}
          </div>
        </div>

        {/* DESPUÉS */}
        <div>
          <div style={{
            background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 14,
            textAlign: "center",
          }}>
            <span style={{ color: "#34d399", fontWeight: 700, fontSize: 15 }}>
              <i className="bi bi-stars me-2" />DESPUÉS
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {POSES.map(pose => (
              <TarjetaPose
                key={pose.id}
                pose={pose}
                foto={fotos[`despues_${pose.id}`]}
                subiendo={subiendo[`despues_${pose.id}`]}
                color={C.success}
                onSubir={archivo => subirFoto("despues", pose.id, archivo)}
                onEliminar={() => eliminarFoto("despues", pose.id)}
                onVerModal={() => setModalImg(fotos[`despues_${pose.id}`])}
              />
            ))}
          </div>
        </div>
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
          <div style={{ position: "relative" }}>
            <img
              src={foto.archivo_url}
              alt={pose.label}
              onClick={onVerModal}
              style={{
                width: "100%", height: 130, objectFit: "cover",
                display: "block", cursor: "zoom-in",
              }}
            />
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              background: "linear-gradient(to bottom, rgba(0,0,0,.6) 0%, transparent 100%)",
              padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
                <i className={`bi ${pose.icon} me-1`} />{pose.label}
              </span>
              <i className="bi bi-check-circle-fill" style={{ color: "#10b981", fontSize: 14 }} />
            </div>
          </div>
          <div style={{ padding: "7px 10px", display: "flex", gap: 6 }}>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
              style={{
                flex: 1, background: `${color}22`, border: `1px solid ${color}44`,
                borderRadius: 7, padding: "5px 0", color, fontSize: 12,
                fontWeight: 600, cursor: "pointer",
              }}
            >
              <i className="bi bi-arrow-repeat me-1" />Reemplazar
            </button>
            <button
              onClick={onEliminar}
              style={{
                background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
                borderRadius: 7, padding: "5px 10px", color: "#ef4444",
                fontSize: 12, cursor: "pointer",
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
            height: 130, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 6,
            background: `${color}08`,
          }}>
            {subiendo ? (
              <>
                <div style={{
                  width: 28, height: 28, border: `3px solid ${color}33`,
                  borderTopColor: color, borderRadius: "50%",
                  animation: "spin .8s linear infinite",
                }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <span style={{ fontSize: 11, color: C.muted }}>Subiendo...</span>
              </>
            ) : (
              <>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${color}18`, border: `1px dashed ${color}55`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <i className="bi bi-camera-fill" style={{ fontSize: 16, color }} />
                </div>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
                  <i className={`bi ${pose.icon} me-1`} />{pose.label}
                </span>
                <span style={{ fontSize: 10, color: `${C.muted}88` }}>
                  Tomar foto o subir
                </span>
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