import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

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
  direccion: "", ciudad: "",
  grupo_sanguineo: "",
};

export default function Pacientes() {
  const { user }  = useAuth();
  const [q,      setQ]      = useState("");
  const [lista,  setLista]  = useState([]);
  const [msg,    setMsg]    = useState({ tipo: "", texto: "" });
  const [form,   setForm]   = useState(FORM_VACIO);
  const [showForm, setShowForm] = useState(false);

  const cargar = async () => {
    setMsg({ tipo: "", texto: "" });
    const res = await api.get("/pacientes", { params: { q } });
    setLista(res.data.data || []);
  };

  useEffect(() => { cargar(); }, []);  // eslint-disable-line

  const crear = async (e) => {
    e.preventDefault();
    setMsg({ tipo: "", texto: "" });
    try {
      await api.post("/pacientes", form);
      setForm(FORM_VACIO);
      setShowForm(false);
      await cargar();
      setMsg({ tipo: "success", texto: "Paciente creado correctamente" });
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error creando paciente" });
    }
  };

  const cambioForm = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  return (
    <div style={{ color: C.text, minHeight: "100vh" }}>
      {/* Banner */}
      <div style={{
        background: `linear-gradient(135deg, #214a87 0%, #176DC8 100%)`,
        borderRadius: 16, padding: "24px 28px", marginBottom: 24,
        border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(13,110,253,0.15)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-people-fill" style={{ fontSize: 22, color: "#fff" }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: 22, color: "#fff" }}>Pacientes</h4>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13 }}>
              Gestión de pacientes — {lista.length} registros
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => window.open(`/registro?clinica_id=${user?.clinica_id || ""}`, "_blank")}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "10px 20px",
              color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}>
            <i className="bi bi-box-arrow-up-right" /> Link de registro
          </button>
          <button
            onClick={() => setShowForm(f => !f)}
            style={{
              background: showForm ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.95)",
              border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "10px 20px",
              color: showForm ? "#fff" : C.accent, fontWeight: 600, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}>
            <i className={`bi ${showForm ? "bi-x-lg" : "bi-person-plus-fill"}`} />
            {showForm ? "Cancelar" : "Nuevo paciente"}
          </button>
        </div>
      </div>

      {/* Toast mensaje */}
      {msg.texto && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: msg.tipo === "success" ? "rgba(16,185,129,.95)" : "rgba(239,68,68,.95)",
          borderRadius: 12, padding: "12px 20px",
          color: "#fff", fontWeight: 600, fontSize: 14,
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: msg.tipo === "success" ? "0 8px 24px rgba(16,185,129,.3)" : "0 8px 24px rgba(239,68,68,.3)",
        }}>
          <i className={`bi ${msg.tipo === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`} />
          {msg.texto}
          <button onClick={() => setMsg({ tipo: "", texto: "" })}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 10, fontSize: 16 }}>
            <i className="bi bi-x" />
          </button>
        </div>
      )}

      {/* Formulario nuevo paciente */}
      {showForm && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "20px 24px", marginBottom: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
            paddingBottom: 16, borderBottom: `1px solid ${C.border}`,
          }}>
            <i className="bi bi-person-plus-fill" style={{ color: C.accent, fontSize: 16 }} />
            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 15, color: C.text }}>Nuevo paciente</h6>
          </div>
          <form onSubmit={crear}>
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
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Ciudad</label>
                <input style={inputSt} name="ciudad" value={form.ciudad} onChange={cambioForm} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 9,
                         padding: "10px 22px", color: C.muted, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button type="submit"
                style={{
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                  border: "none", borderRadius: 9, padding: "10px 26px",
                  color: "#fff", fontWeight: 700, cursor: "pointer",
                  boxShadow: `0 4px 14px rgba(13,110,253,.4)`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                <i className="bi bi-floppy" /> Guardar paciente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Búsqueda + tabla */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 14, overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <input
              style={{ ...inputSt, flex: 1 }}
              placeholder="Buscar por nombre, DNI, teléfono o email..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && cargar()}
            />
            <button onClick={cargar}
              style={{
                background: C.accent, border: "none", borderRadius: 8,
                padding: "8px 16px", color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}>
              <i className="bi bi-search" />
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: `linear-gradient(135deg, #214a87 0%, #176DC8 100%)`, border: `1px solid ${C.border}` }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700,
                              color: "#fff", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    Paciente
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700,
                              color: "#fff", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    DNI
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700,
                              color: "#fff", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    Teléfono
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700,
                              color: "#fff", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    Email
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 700,
                              color: "#fff", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    Estado
                  </th>
                  <th style={{ padding: "12px 16px", fontSize: 12, fontWeight: 700,
                              color: "#fff", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: "50%",
                          background: "rgba(13,110,253,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: C.accent, fontWeight: 700, fontSize: 13,
                        }}>
                          {p.nombres?.[0]}{p.apellidos?.[0]}
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
                        <Link to={`/pacientes/${p.id}/perfil`}
                          style={{
                            background: "rgba(0,0,0,0.05)", border: "none", borderRadius: 6,
                            padding: "6px 12px", color: C.text, fontSize: 12, fontWeight: 600,
                            textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                          }}>
                          <i className="bi bi-person-badge" /> Perfil
                        </Link>
                        <Link to={`/historia/${p.id}`}
                          style={{
                            background: "rgba(13,110,253,0.1)", border: "none", borderRadius: 6,
                            padding: "6px 12px", color: C.accent, fontSize: 12, fontWeight: 600,
                            textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                          }}>
                          <i className="bi bi-journal-medical" /> HCE
                        </Link>
                        <Link to={`/consulta?paciente_id=${p.id}`}
                          style={{
                            background: "rgba(16,185,129,0.1)", border: "none", borderRadius: 6,
                            padding: "6px 12px", color: "#10b981", fontSize: 12, fontWeight: 600,
                            textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                          }}>
                          <i className="bi bi-plus-circle" /> Consulta
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
    </div>
  );
}
