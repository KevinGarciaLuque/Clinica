import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/es";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

dayjs.locale("es");

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000");

// ── Departamentos y municipios de Honduras ────────────
const HONDURAS_DATA = {
  "Atlántida":         ["Arizona","El Porvenir","Esparta","Jutiapa","La Ceiba","La Masica","San Francisco","Tela"],
  "Choluteca":         ["Apacilagua","Choluteca","Concepción de María","Duyure","El Corpus","El Triunfo","Marcovia","Morolica","Namasigüe","Orocuina","Pespire","San Antonio de Flores","San Isidro","San José","San Marcos de Colón","Santa Ana de Yusguare"],
  "Colón":             ["Balfate","Bonito Oriental","Iriona","Limón","Sabá","Santa Rosa de Aguán","Sonaguera","Tocoa","Trujillo"],
  "Comayagua":         ["Ajuterique","Comayagua","El Rosario","Esquías","Humuya","La Libertad","La Trinidad","Lamaní","Las Lajas","Lejamaní","Minas de Oro","Ojos de Agua","San Jerónimo","San José de Comayagua","San José del Potrero","San Luis","San Sebastián","Siguatepeque","Taulabé","Villa de San Antonio"],
  "Copán":             ["Cabañas","Concepción","Copán Ruinas","Corquín","Cucuyagua","Dolores","Dulce Nombre","El Paraíso","Florida","La Jigua","La Unión","Nueva Arcadia","San Agustín","San Antonio","San Jerónimo","San José","San Juan de Opoa","San Nicolás","San Pedro","Santa Rita","Santa Rosa de Copán","Trinidad de Copán","Veracruz"],
  "Cortés":            ["Choloma","La Lima","Omoa","Pimienta","Potrerillos","Puerto Cortés","San Antonio de Cortés","San Francisco de Yojoa","San Manuel","San Pedro Sula","Santa Cruz de Yojoa","Villanueva"],
  "El Paraíso":        ["Alauca","Danlí","El Paraíso","Güinope","Jacaleapa","Liure","Morocelí","Oropolí","Potrerillos","San Antonio de Flores","San Lucas","San Matías","Soledad","Teupasenti","Texiguat","Trojes","Vado Ancho","Yauyupe","Yuscarán"],
  "Francisco Morazán": ["Alubarén","Cedros","Curarén","El Porvenir","Guaimaca","La Libertad","La Venta","Lepaterique","Maraita","Marale","Nueva Armenia","Ojojona","Reitoca","Sabanagrande","San Antonio de Oriente","San Buenaventura","San Ignacio","San Juan de Flores","San Miguelito","Santa Ana","Santa Lucía","Talanga","Tatumbla","Tegucigalpa","Valle de Ángeles","Vallecillo","Villa de San Francisco"],
  "Gracias a Dios":    ["Ahuas","Brus Laguna","Juan Francisco Bulnes","Puerto Lempira","Villeda Morales","Wampusirpe"],
  "Intibucá":          ["Camasca","Colomoncagua","Concepción","Dolores","Intibucá","Jesús de Otoro","La Esperanza","Magdalena","Masaguara","San Antonio","San Francisco de Opalaca","San Isidro","San Juan","San Marcos de Sierra","San Miguel Guancapla","Santa Lucía","Yamaranguila"],
  "Islas de la Bahía": ["Guanaja","José Santos Guardiola","Roatán","Utila"],
  "La Paz":            ["Aguanqueterique","Cabañas","Cane","Chinacla","Guajiquiro","La Paz","Lauterique","Marcala","Mercedes de Oriente","Opatoro","San Antonio del Norte","San Juan","San Pedro de Tutule","Santa Ana","Santa Elena","Santa María","Santiago de Puringla","Yarula"],
  "Lempira":           ["Belén","Candelaria","Cololaca","Erandique","Gracias","Gualcince","Guarita","La Campa","La Iguala","La Unión","La Virtud","Las Flores","Lepaera","Mapulaca","Piraera","San Andrés","San Francisco","San Juan de Guarita","San Manuel Colohete","San Marcos de Caiquín","San Rafael","San Sebastián","Santa Cruz","Talgua","Tambla","Tomalá","Valladolid","Virginia"],
  "Ocotepeque":        ["Belén Gualcho","Concepción","Dolores Merendón","Fraternidad","La Encarnación","La Labor","Lucerna","Mercedes","Ocotepeque","San Fernando","San Francisco del Valle","San Jorge","San Marcos","Santa Fe","Sensenti","Sinuapa"],
  "Olancho":           ["Campamento","Catacamas","Concordia","Dulce Nombre de Culmí","El Rosario","Esquipulas del Norte","Gualaco","Guarizama","Guata","Jano","Juticalpa","La Unión","Mangulile","Manto","Patuca","Salama","San Esteban","San Francisco de Becerra","San Francisco de La Paz","Santa María del Real","Silca","Yocón"],
  "Santa Bárbara":     ["Arada","Atima","Azagualpa","Ceguaca","Chinda","Concepción del Norte","Concepción del Sur","El Níspero","Gualala","Ilama","Las Vegas","Macuelizo","Naranjito","Nuevo Celilac","Petoa","Protección","Quimistán","San Francisco de Ojuera","San José de Colinas","San Luis","San Marcos","San Nicolás","San Pedro Zacapa","San Vicente Centenario","Santa Bárbara","Santa Rita","Trinidad"],
  "Valle":             ["Alianza","Amapala","Aramecina","Caridad","Goascorán","Langue","Nacaome","San Francisco de Coray","San Lorenzo"],
  "Yoro":              ["Arenal","El Negrito","El Progreso","Jocón","Morazán","Olanchito","Santa Rita","Sulaco","Victoria","Yorito","Yoro"],
};

const C = {
  bg: "#f8f9fa", surface: "#ffffff", card: "#ffffff",
  border: "rgba(0,0,0,0.1)", accent: "#166ae8",
  accentD: "#1f6bbd", text: "#1a1a1a", muted: "#6c757d", inputBg: "#ffffff",
};

const inputSt = {
  background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", width: "100%", fontSize: 14, outline: "none",
};

const FORM_VACIO = {
  nombres: "", apellidos: "", dni: "",
  fecha_nacimiento: "", sexo: "",
  telefono: "", email: "",
  direccion: "", departamento: "", municipio: "",
  grupo_sanguineo: "",
  foto_perfil: null,
};

export default function Pacientes() {
  const { user }  = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [q,      setQ]      = useState("");
  const [lista,  setLista]  = useState([]);
  const [msg,    setMsg]    = useState({ tipo: "", texto: "" });
  const [form,   setForm]   = useState(FORM_VACIO);
  const [showForm, setShowForm] = useState(searchParams.get("nuevo") === "true");
  const [editandoId, setEditandoId] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [modalFoto, setModalFoto] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [showConsultaModal, setShowConsultaModal] = useState(false);
  const [consultaPaciente, setConsultaPaciente] = useState(null);
  const [checkingCita, setCheckingCita] = useState(false);

  // Sincronizar con cambios de URL (ej: click en "Registrar" del sidebar)
  useEffect(() => {
    if (searchParams.get("nuevo") === "true") {
      setShowForm(true);
      setEditandoId(null);
      setForm(FORM_VACIO);
    } else {
      setShowForm(false);
    }
  }, [searchParams]);

  const cargar = async () => {
    setMsg({ tipo: "", texto: "" });
    const res = await api.get("/pacientes", { params: { q } });
    setLista(res.data.data || []);
  };

  useEffect(() => { cargar(); }, []);  // eslint-disable-line

  const guardarPaciente = async (e) => {
    e.preventDefault();
    setMsg({ tipo: "", texto: "" });
    try {
      let pacienteId = editandoId;
      
      if (editandoId) {
        // Editar
        await api.put(`/pacientes/${editandoId}`, form);
        setMsg({ tipo: "success", texto: "Paciente actualizado correctamente" });
      } else {
        // Crear
        const res = await api.post("/pacientes", form);
        pacienteId = res.data.id;
        setMsg({ tipo: "success", texto: "Paciente creado correctamente" });
      }
      
      // Subir foto si hay una seleccionada
      if (fotoFile && pacienteId) {
        const formData = new FormData();
        formData.append("foto", fotoFile);
        await api.post(`/pacientes/${pacienteId}/foto`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      
      setForm(FORM_VACIO);
      setFotoFile(null);
      setFotoPreview(null);
      setEditandoId(null);
      setShowForm(false);
      await cargar();
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al guardar paciente" });
    }
  };
  
  const abrirEditar = (p) => {
    setForm({
      nombres: p.nombres || "",
      apellidos: p.apellidos || "",
      dni: p.dni || "",
      fecha_nacimiento: p.fecha_nacimiento ? p.fecha_nacimiento.split("T")[0] : "",
      sexo: p.sexo || "",
      telefono: p.telefono || "",
      email: p.email || "",
      direccion: p.direccion || "",
      departamento: p.departamento || "",
      municipio: p.municipio || "",
      grupo_sanguineo: p.grupo_sanguineo || "",
    });
    setEditandoId(p.id);
    setFotoFile(null);
    if (p.foto_perfil) {
      setFotoPreview(p.foto_perfil?.startsWith('http') ? p.foto_perfil : `${API_BASE}/uploads/${p.foto_perfil}`);
    } else {
      setFotoPreview(null);
    }
    setShowForm(true);
  };

  // ── Consulta: verificar si el paciente tiene cita hoy ─────────────────────
  const handleConsultaClick = async (e, paciente) => {
    e.stopPropagation();
    e.preventDefault();
    setCheckingCita(true);
    try {
      const hoy = dayjs().format("YYYY-MM-DD");
      const res = await api.get("/citas", {
        params: { desde: hoy, hasta: hoy, paciente_id: paciente.id }
      });
      const citasHoy = (res.data.data || []).filter(
        c => !["CANCELADA", "NO_ASISTIO", "COMPLETADA"].includes(c.estado)
      );
      if (citasHoy.length > 0) {
        // Tiene cita activa hoy → ir directo a consulta médica
        navigate(`/consulta-medica?paciente_id=${paciente.id}&cita_id=${citasHoy[0].id}`);
      } else {
        // No tiene cita → mostrar modal
        setConsultaPaciente(paciente);
        setShowConsultaModal(true);
      }
    } catch {
      // En caso de error, mostrar modal de todas formas
      setConsultaPaciente(paciente);
      setShowConsultaModal(true);
    } finally {
      setCheckingCita(false);
    }
  };
  
  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };
  
  const eliminarFotoPreview = () => {
    setFotoFile(null);
    setFotoPreview(null);
  };

  const cambioForm = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      {/* Header plano */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-people-fill" style={{ fontSize: "1rem", color: "#7dd3fc" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Pacientes</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>
              Gestión de pacientes — {lista.length} registros
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => window.open(`/registro?clinica_id=${user?.clinica_id || ""}`, "_blank")}
            style={{
              background: "rgba(255,255,255,.1)",
              border: "1px solid rgba(255,255,255,.22)", borderRadius: 8, padding: "6px 14px",
              color: "#e2e8f0", fontWeight: 500, fontSize: "0.8rem", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="bi bi-box-arrow-up-right" /> Link de registro
          </button>
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                setEditandoId(null);
                setForm(FORM_VACIO);
                setFotoFile(null);
                setFotoPreview(null);
              } else {
                setShowForm(true);
                setEditandoId(null);
                setForm(FORM_VACIO);
                setFotoFile(null);
                setFotoPreview(null);
              }
            }}
            style={{
              background: showForm ? "rgba(239,68,68,.85)" : "rgba(255,255,255,.1)",
              border: `1px solid ${showForm ? "rgba(239,68,68,.5)" : "rgba(255,255,255,.22)"}`,
              borderRadius: 8, padding: "6px 14px",
              color: "#e2e8f0", fontWeight: 500, fontSize: "0.8rem", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className={`bi ${showForm ? "bi-x-lg" : "bi-person-plus-fill"}`} />
            {showForm ? "Cancelar" : "Nuevo paciente"}
          </button>
        </div>
      </div>

      {/* Mensaje inline */}
      {msg.texto && (
        <div style={{
          margin: "16px 24px 0",
          padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: msg.tipo === "success" ? "#dcfce7" : "#fee2e2",
          color: msg.tipo === "success" ? "#166534" : "#991b1b",
          border: `1px solid ${msg.tipo === "success" ? "#bbf7d0" : "#fecaca"}`,
        }}>
          <span>
            <i className={`bi ${msg.tipo === "success" ? "bi-check-circle-fill" : "bi-x-circle-fill"} me-2`}></i>
            {msg.texto}
          </span>
          <button onClick={() => setMsg({ tipo: "", texto: "" })}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit", padding: "0 4px" }}>×</button>
        </div>
      )}

      {/* Formulario nuevo paciente */}
      {showForm && (
        <div style={{ padding: "20px 24px 0" }}>
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 12, padding: "20px 24px",
          boxShadow: "0 2px 8px rgba(0,0,0,.06)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
            paddingBottom: 16, borderBottom: "1px solid #e5e7eb",
          }}>
            <i className={`bi ${editandoId ? "bi-pencil-square" : "bi-person-plus-fill"}`} style={{ color: "#2563eb", fontSize: 16 }} />
            <h6 style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#111827" }}>
              {editandoId ? "Editar paciente" : "Nuevo paciente"}
            </h6>
          </div>
          <form onSubmit={guardarPaciente}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
                  Nombres <span style={{ color: "#dc3545" }}>*</span>
                </label>
                <input style={inputSt} name="nombres" value={form.nombres} onChange={cambioForm} required />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
                  Apellidos <span style={{ color: "#dc3545" }}>*</span>
                </label>
                <input style={inputSt} name="apellidos" value={form.apellidos} onChange={cambioForm} required />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>DNI</label>
                <input style={inputSt} name="dni" value={form.dni} onChange={cambioForm} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Fecha de nacimiento</label>
                <input style={inputSt} type="date" name="fecha_nacimiento" value={form.fecha_nacimiento} onChange={cambioForm} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Sexo</label>
                <select style={inputSt} name="sexo" value={form.sexo} onChange={cambioForm}>
                  <option value="">—</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="O">Otro</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Grupo sanguíneo</label>
                <select style={inputSt} name="grupo_sanguineo" value={form.grupo_sanguineo} onChange={cambioForm}>
                  <option value="">—</option>
                  {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Teléfono</label>
                <input style={inputSt} name="telefono" value={form.telefono} onChange={cambioForm} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Email</label>
                <input style={inputSt} type="email" name="email" value={form.email} onChange={cambioForm} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Dirección</label>
                <input style={inputSt} name="direccion" value={form.direccion} onChange={cambioForm} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Departamento</label>
                <select style={inputSt} name="departamento" value={form.departamento}
                  onChange={(e) => setForm(f => ({ ...f, departamento: e.target.value, municipio: "" }))}>
                  <option value="">—</option>
                  {Object.keys(HONDURAS_DATA).sort().map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Municipio</label>
                <select style={inputSt} name="municipio" value={form.municipio}
                  onChange={cambioForm} disabled={!form.departamento}>
                  <option value="">—</option>
                  {(HONDURAS_DATA[form.departamento] || []).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              
              {/* Foto de perfil */}
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Foto de perfil</label>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {fotoPreview && (
                    <div style={{ position: "relative" }}>
                      <img src={fotoPreview} alt="Preview" style={{
                        width: 80, height: 80, borderRadius: 12, objectFit: "cover",
                        border: `2px solid ${C.border}`
                      }} />
                      <button type="button" onClick={eliminarFotoPreview}
                        style={{
                          position: "absolute", top: -6, right: -6,
                          background: "#dc3545", border: "none", borderRadius: "50%",
                          width: 24, height: 24, color: "#fff", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12,
                        }}>
                        <i className="bi bi-x" />
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFotoChange}
                    style={{ ...inputSt, flex: 1 }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, gap: 10 }}>
              <button type="button" onClick={() => {
                setShowForm(false);
                setEditandoId(null);
                setForm(FORM_VACIO);
                setFotoFile(null);
                setFotoPreview(null);
              }}
                style={{ background: "transparent", border: "1px solid #d1d5db", borderRadius: 8,
                  padding: "8px 20px", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: "0.87rem" }}>
                Cancelar
              </button>
              <button type="submit"
                style={{
                  background: "#2563eb", border: "none", borderRadius: 8, padding: "8px 22px",
                  color: "#fff", fontWeight: 600, fontSize: "0.87rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                <i className="bi bi-floppy" /> {editandoId ? "Actualizar" : "Guardar"} paciente
              </button>
            </div>
          </form>
        </div>
        </div>
      )}

      {/* Búsqueda + tabla — solo cuando no se está registrando un nuevo paciente */}
      {!(showForm && !editandoId) && <div style={{ padding: "20px 24px" }}>
      <div style={{
        background: "#fff", borderRadius: 12, overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,.06)",
      }}>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
              <i className="bi bi-search" style={{
                position: "absolute", left: 12,
                color: "#9ca3af", fontSize: 15, pointerEvents: "none",
              }} />
              <input
                style={{ ...inputSt, paddingLeft: 38, width: "100%", border: "1px solid #e5e7eb" }}
                placeholder="Buscar paciente por nombre, DNI, teléfono o email..."
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && cargar()}
              />
            </div>
            <button onClick={cargar}
              style={{
                background: "#2563eb", border: "none", borderRadius: 8,
                padding: "8px 20px", color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
                fontWeight: 600, fontSize: "0.87rem",
              }}
            >
              <i className="bi bi-search" /> Buscar
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Paciente", "DNI", "Teléfono", "Email", "Estado", "Acciones"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", fontSize: "0.73rem", fontWeight: 700,
                      color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                      borderBottom: "2px solid #e5e7eb", textAlign: "left", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map(p => (
                  <tr 
                    key={p.id} 
                    onClick={() => navigate(`/pacientes/${p.id}/perfil`)}
                    onMouseEnter={() => setHoveredRow(p.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{ 
                      borderBottom: `1px solid ${C.border}`,
                      cursor: "pointer",
                      background: hoveredRow === p.id ? "rgba(13,110,253,0.03)" : "transparent",
                      transition: "background 0.2s ease",
                    }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.foto_perfil) {
                              setModalFoto(p.foto_perfil?.startsWith('http') ? p.foto_perfil : `${API_BASE}/uploads/${p.foto_perfil}`);
                            } else {
                              navigate(`/pacientes/${p.id}/perfil`);
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (p.foto_perfil) {
                              e.target.style.transform = "scale(1.1)";
                              e.target.style.boxShadow = "0 4px 12px rgba(13,110,253,0.3)";
                            } else {
                              e.target.style.background = "rgba(13,110,253,0.2)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = "scale(1)";
                            e.target.style.boxShadow = "none";
                            if (!p.foto_perfil) {
                              e.target.style.background = "rgba(13,110,253,0.1)";
                            }
                          }}
                          style={{
                          width: 38, height: 38, borderRadius: "50%",
                          background: p.foto_perfil ? "transparent" : "rgba(13,110,253,0.1)",
                          backgroundImage: p.foto_perfil ? `url(${p.foto_perfil?.startsWith('http') ? p.foto_perfil : `${API_BASE}/uploads/${p.foto_perfil}`})` : "none",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: C.accent, fontWeight: 700, fontSize: 13,
                          cursor: "pointer",
                          border: p.foto_perfil ? `2px solid ${C.border}` : "none",
                          transition: "all 0.2s ease",
                        }}>
                          {!p.foto_perfil && `${p.nombres?.[0]}${p.apellidos?.[0]}`}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>
                            {p.nombres} {p.apellidos}
                          </div>
                          {p.fecha_nacimiento && (
                            <div style={{ fontSize: 12, color: C.muted }}>
                              {new Date(p.fecha_nacimiento).toLocaleDateString("es-PE")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>
                      {p.dni || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>
                      {p.telefono || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>
                      {p.email || "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {p.activo ? (
                        <span style={{
                          background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
                          borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600,
                          color: "#10b981", textTransform: "uppercase",
                        }}>Activo</span>
                      ) : (
                        <span style={{
                          background: "rgba(0,0,0,0.05)", border: `1px solid ${C.border}`,
                          borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600,
                          color: C.muted, textTransform: "uppercase",
                        }}>Inactivo</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={(e) => { e.stopPropagation(); abrirEditar(p); }}
                          style={{
                            background: "rgba(255,193,7,0.1)", border: "none", borderRadius: 6,
                            padding: "6px 12px", color: "#ffc107", fontSize: 12, fontWeight: 600,
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                          }}>
                          <i className="bi bi-pencil-square" /> Editar
                        </button>
                        <Link 
                          to={`/pacientes/${p.id}/perfil`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            background: "rgba(13,110,253,0.1)", border: "none", borderRadius: 6,
                            padding: "6px 12px", color: C.accent, fontSize: 12, fontWeight: 600,
                            textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                          }}>
                          <i className="bi bi-file-earmark-medical" /> Expediente
                        </Link>
                        <Link 
                          to={`/historia/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            background: "rgba(16,185,129,0.1)", border: "none", borderRadius: 6,
                            padding: "6px 12px", color: "#10b981", fontSize: 12, fontWeight: 600,
                            textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                          }}>
                          <i className="bi bi-journal-medical" /> HCE
                        </Link>
                        <button 
                          onClick={(e) => handleConsultaClick(e, p)}
                          disabled={checkingCita}
                          style={{
                            background: "rgba(103,58,183,0.1)", border: "none", borderRadius: 6,
                            padding: "6px 12px", color: "#673ab7", fontSize: 12, fontWeight: 600,
                            cursor: checkingCita ? "wait" : "pointer",
                            display: "flex", alignItems: "center", gap: 4,
                          }}>
                          <i className={`bi ${checkingCita ? "bi-hourglass-split" : "bi-plus-circle"}`} /> Consulta
                        </button>
                        <Link 
                          to={`/pacientes/${p.id}/perfil?tab=crecimiento`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            background: "rgba(14,165,233,0.1)", border: "none", borderRadius: 6,
                            padding: "6px 12px", color: "#0ea5e9", fontSize: 12, fontWeight: 600,
                            textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                          }}>
                          <i className="bi bi-graph-up-arrow" /> Crecimiento
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "60px 20px", textAlign: "center" }}>
                      <div style={{
                        width: 68, height: 68, borderRadius: 18, margin: "0 auto 16px",
                        background: "rgba(13,110,253,0.07)", border: "1px solid rgba(13,110,253,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <i className="bi bi-people" style={{ fontSize: 28, color: C.accent }} />
                      </div>
                      <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
                        Sin resultados. Usa el buscador o crea un nuevo paciente.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>}

      {/* Modal consulta sin cita agendada */}
      {showConsultaModal && consultaPaciente && (
        <ModalConsultaSinCita
          paciente={consultaPaciente}
          onClose={() => { setShowConsultaModal(false); setConsultaPaciente(null); }}
          onCreated={(citaId) => {
            setShowConsultaModal(false);
            navigate(`/consulta-medica?paciente_id=${consultaPaciente.id}&cita_id=${citaId}`);
            setConsultaPaciente(null);
          }}
        />
      )}

      {/* Modal para ver foto ampliada */}
      {modalFoto && (
        <div
          onClick={() => setModalFoto(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, cursor: "pointer",
          }}>
          <div style={{
            maxWidth: "90%", maxHeight: "90%",
            position: "relative",
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); setModalFoto(null); }}
              style={{
                position: "absolute", top: -16, right: -16,
                background: "#fff", border: "none", borderRadius: "50%",
                width: 40, height: 40, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                fontSize: 18,
              }}>
              <i className="bi bi-x" />
            </button>
            <img
              src={modalFoto}
              alt="Foto del paciente"
              style={{
                maxWidth: "100%", maxHeight: "85vh",
                borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal Consulta Sin Cita Agendada ─────────────────────────────────────────
function ModalConsultaSinCita({ paciente, onClose, onCreated }) {
  const [modo, setModo] = useState(null); // null = pregunta inicial, "ahora" = agendar ahora, "seleccionar" = form completo
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState("");
  const [fechaSel, setFechaSel] = useState(dayjs().format("YYYY-MM-DD"));
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotSel, setSlotSel] = useState("");
  const [tipo, setTipo] = useState("PRIMERA_VEZ");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/usuarios/medicos")
      .then(r => setMedicos(r.data.data || []))
      .catch(() => {});
  }, []);

  // Cargar slots cuando se selecciona médico y fecha
  useEffect(() => {
    if (!medicoId || !fechaSel) { setSlots([]); return; }
    api.get("/citas/slots", { params: { medico_id: medicoId, fecha: fechaSel } })
      .then(r => setSlots(r.data.data || []))
      .catch(() => setSlots([]));
  }, [medicoId, fechaSel]);

  const selSlot = (s) => {
    const inicio = dayjs(s.inicio);
    const fin = dayjs(s.fin);
    setSlotSel(s.inicio);
    setHoraInicio(inicio.format("HH:mm"));
    setHoraFin(fin.format("HH:mm"));
  };

  const agendarAhora = async () => {
    if (!medicoId) { setErr("Selecciona un médico"); return; }
    setSaving(true); setErr("");
    try {
      const inicio = dayjs().format("YYYY-MM-DD HH:mm:ss");
      const fin = dayjs().add(30, "minute").format("YYYY-MM-DD HH:mm:ss");
      const res = await api.post("/citas", {
        paciente_id: paciente.id, medico_id: medicoId,
        inicio, fin, tipo_consulta: tipo, motivo: motivo || null, canal: "RECEPCION",
      });
      // Poner en atención directamente
      await api.patch(`/citas/${res.data.id}/estado`, { estado: "EN_ATENCION" });
      onCreated(res.data.id);
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  const agendarSeleccionado = async () => {
    if (!medicoId) { setErr("Selecciona un médico"); return; }
    if (!horaInicio || !horaFin) { setErr("Ingresa hora de inicio y fin"); return; }
    const inicio = dayjs(`${fechaSel} ${horaInicio}`);
    const fin = dayjs(`${fechaSel} ${horaFin}`);
    if (fin.isBefore(inicio) || fin.isSame(inicio)) {
      setErr("La hora de fin debe ser posterior a la hora de inicio"); return;
    }
    setSaving(true); setErr("");
    try {
      const res = await api.post("/citas", {
        paciente_id: paciente.id, medico_id: medicoId,
        inicio: inicio.format("YYYY-MM-DD HH:mm:ss"),
        fin: fin.format("YYYY-MM-DD HH:mm:ss"),
        tipo_consulta: tipo, motivo: motivo || null, canal: "RECEPCION",
      });
      onCreated(res.data.id);
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 9998 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: modo === "seleccionar" ? 600 : 500 }}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: "#673ab7", color: "#fff" }}>
            <h5 className="modal-title">
              <i className="bi bi-clipboard2-pulse me-2"></i>
              Nueva Consulta
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">
            {/* Info del paciente */}
            <div className="alert alert-warning py-2 mb-3">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>{paciente.apellidos}, {paciente.nombres}</strong> no tiene consulta agendada para hoy.
            </div>

            {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}

            {/* Pregunta inicial */}
            {!modo && (
              <div className="text-center py-2">
                <p className="mb-3">¿Desea agendar una consulta?</p>
                <div className="d-flex justify-content-center gap-3">
                  <button className="btn btn-success px-4" onClick={() => setModo("ahora")}>
                    <i className="bi bi-clock-fill me-2"></i>Ahora
                  </button>
                  <button className="btn btn-primary px-4" onClick={() => setModo("seleccionar")}>
                    <i className="bi bi-calendar-event me-2"></i>Seleccionar
                  </button>
                </div>
              </div>
            )}

            {/* Modo AHORA: solo pedir médico */}
            {modo === "ahora" && (
              <div>
                <p className="text-muted small mb-2">
                  Se creará una cita para <strong>ahora ({dayjs().format("h:mm A")})</strong> con duración de 30 minutos.
                </p>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médico</label>
                  <select className="form-select" value={medicoId}
                    onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
                    ))}
                  </select>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select form-select-sm" value={tipo}
                      onChange={e => setTipo(e.target.value)}>
                      {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Motivo</label>
                    <input className="form-control form-control-sm" value={motivo}
                      onChange={e => setMotivo(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              </div>
            )}

            {/* Modo SELECCIONAR: form completo */}
            {modo === "seleccionar" && (
              <div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médico</label>
                  <select className="form-select" value={medicoId}
                    onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Fecha</label>
                  <input type="date" className="form-control" value={fechaSel}
                    onChange={e => setFechaSel(e.target.value)} />
                </div>
                {slots.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Horarios disponibles</label>
                    <div className="d-flex flex-wrap gap-1">
                      {slots.map(s => (
                        <button key={s.inicio} type="button"
                          className={`btn btn-sm ${slotSel === s.inicio ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => selSlot(s)}>
                          {dayjs(s.inicio).format("h:mm A")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {medicoId && fechaSel && slots.length === 0 && (
                  <small className="text-muted d-block mb-2">Sin horarios disponibles. Ingresa hora manualmente.</small>
                )}
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Hora inicio</label>
                    <input type="time" className="form-control" value={horaInicio}
                      onChange={e => setHoraInicio(e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Hora fin</label>
                    <input type="time" className="form-control" value={horaFin}
                      onChange={e => setHoraFin(e.target.value)} />
                  </div>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select form-select-sm" value={tipo}
                      onChange={e => setTipo(e.target.value)}>
                      {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Motivo</label>
                    <input className="form-control form-control-sm" value={motivo}
                      onChange={e => setMotivo(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              </div>
            )}
          </div>
          {modo && (
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => { setModo(null); setErr(""); }}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button 
                className={`btn ${modo === "ahora" ? "btn-success" : "btn-primary"}`}
                disabled={saving}
                onClick={modo === "ahora" ? agendarAhora : agendarSeleccionado}>
                {saving ? "Creando…" : modo === "ahora" ? "Agendar y Consultar" : "Agendar Cita"}
              </button>
            </div>
          )}
          {!modo && (
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
