import { useState, useEffect } from "react";
import api from "../api/api";
import VacunasCarnet from "../components/VacunasCarnet";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000");

const C = {
  border: "rgba(0,0,0,0.1)", accent: "#166ae8",
  text: "#1a1a1a", muted: "#6c757d",
};

function avatarUrl(foto) {
  if (!foto) return null;
  return foto.startsWith("http") ? foto : `${API_BASE}/uploads/${foto}`;
}

export default function VacunasPage() {
  const [search,   setSearch]   = useState("");
  const [lista,    setLista]    = useState([]);
  const [paciente, setPaciente] = useState(null);
  const [hovRow,   setHovRow]   = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = search.length >= 2 ? { q: search } : {};
      api.get("/pacientes", { params })
        .then(r => setLista(r.data.data || []))
        .catch(() => {});
    }, search.length >= 2 ? 300 : 0);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>

      {/* ── Header azul ── */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)", flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>💉</span>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>
              Vacunas — Carnet Digital
            </div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem", marginTop: 1 }}>
              {paciente
                ? `${paciente.nombres} ${paciente.apellidos}`
                : "Programa Ampliado de Inmunizaciones (PAI)"}
            </div>
          </div>
        </div>

        {paciente && (
          <button
            onClick={() => setPaciente(null)}
            style={{
              background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)",
              borderRadius: 8, color: "#fff", padding: "5px 14px", fontSize: "0.82rem",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <i className="bi bi-arrow-left" /> Volver a lista
          </button>
        )}
      </div>

      <div style={{ padding: "20px 24px" }}>

        {/* ── LISTADO de pacientes ── */}
        {!paciente && (
          <div style={{
            background: "#fff", borderRadius: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden",
          }}>
            <div style={{ padding: "20px 24px" }}>

              {/* Buscador */}
              <div style={{ position: "relative", marginBottom: 20 }}>
                <i className="bi bi-search" style={{
                  position: "absolute", left: 14, top: "50%",
                  transform: "translateY(-50%)",
                  color: C.muted, fontSize: 15, pointerEvents: "none",
                }} />
                <input
                  autoFocus
                  style={{
                    background: "#fff", border: "2px solid #e5e7eb",
                    borderRadius: 10, color: C.text,
                    padding: "10px 14px 10px 40px",
                    width: "100%", fontSize: 14, outline: "none",
                    transition: "border-color .2s, box-shadow .2s",
                  }}
                  placeholder="Buscar paciente por nombre, apellido o DNI…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={e => { e.target.style.borderColor = "#166ae8"; e.target.style.boxShadow = "0 0 0 3px rgba(22,106,232,.1)"; }}
                  onBlur={e => { e.target.style.borderColor = "#e5e7eb"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {/* Tabla */}
              {lista.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ maxHeight: 420, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <tr style={{ background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)" }}>
                          {["Paciente", "DNI", "Teléfono", "Email", "Estado"].map(h => (
                            <th key={h} style={{
                              padding: "11px 16px",
                              textAlign: h === "Estado" ? "center" : "left",
                              fontSize: 11, fontWeight: 700,
                              color: "#fff", textTransform: "uppercase", letterSpacing: ".06em",
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map(p => {
                          const foto = avatarUrl(p.foto_perfil);
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setPaciente(p)}
                              onMouseEnter={() => setHovRow(p.id)}
                              onMouseLeave={() => setHovRow(null)}
                              style={{
                                borderBottom: "1px solid #f1f5f9",
                                cursor: "pointer",
                                background: hovRow === p.id ? "rgba(22,106,232,.04)" : "transparent",
                                transition: "background .15s",
                              }}
                            >
                              <td style={{ padding: "11px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{
                                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                                    background: foto ? "transparent" : "rgba(22,106,232,.1)",
                                    backgroundImage: foto ? `url(${foto})` : "none",
                                    backgroundSize: "cover", backgroundPosition: "center",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: C.accent, fontWeight: 700, fontSize: 13,
                                    border: foto ? `2px solid ${C.border}` : "none",
                                  }}>
                                    {!foto && `${p.nombres?.[0] || ""}${p.apellidos?.[0] || ""}`}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>
                                      {p.nombres} {p.apellidos}
                                    </div>
                                    {p.fecha_nacimiento && (
                                      <div style={{ fontSize: 12, color: C.muted }}>
                                        {new Date(p.fecha_nacimiento).toLocaleDateString("es-HN")}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: "11px 16px", fontSize: 13, color: C.muted }}>{p.dni || "—"}</td>
                              <td style={{ padding: "11px 16px", fontSize: 13, color: C.muted }}>{p.telefono || "—"}</td>
                              <td style={{ padding: "11px 16px", fontSize: 13, color: C.muted }}>{p.email || "—"}</td>
                              <td style={{ padding: "11px 16px", textAlign: "center" }}>
                                {p.activo !== false ? (
                                  <span style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, color: "#10b981", textTransform: "uppercase" }}>Activo</span>
                                ) : (
                                  <span style={{ background: "rgba(0,0,0,.05)", border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase" }}>Inactivo</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : search.length >= 2 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
                  No se encontraron pacientes con "{search}"
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
                  <i className="bi bi-search" style={{ fontSize: 28, display: "block", marginBottom: 10, opacity: .35 }} />
                  Escribe al menos 2 caracteres para buscar, o espera a que cargue la lista.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Carnet del paciente seleccionado ── */}
        {paciente && (
          <>
            {/* Banner del paciente */}
            <div style={{
              background: "#fff", borderRadius: 12, padding: "12px 18px",
              marginBottom: 16, display: "flex", alignItems: "center", gap: 14,
              boxShadow: "0 1px 6px rgba(0,0,0,.07)", border: "1px solid #e5e7eb",
            }}>
              {(() => {
                const foto = avatarUrl(paciente.foto_perfil);
                return (
                  <div style={{
                    width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                    background: foto ? "transparent" : "linear-gradient(135deg,#3b82f6,#1d4ed8)",
                    backgroundImage: foto ? `url(${foto})` : "none",
                    backgroundSize: "cover", backgroundPosition: "center",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 15,
                    boxShadow: "0 2px 8px rgba(59,130,246,.35)",
                  }}>
                    {!foto && `${paciente.nombres?.[0] || ""}${paciente.apellidos?.[0] || ""}`}
                  </div>
                );
              })()}
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.97rem", color: "#111827" }}>
                  {paciente.nombres} {paciente.apellidos}
                </div>
                <div style={{ color: "#6b7280", fontSize: "0.78rem", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {paciente.dni && <span>DNI {paciente.dni}</span>}
                  {paciente.fecha_nacimiento && <><span style={{ opacity: .4 }}>·</span><span>Nac. {paciente.fecha_nacimiento.slice(0, 10)}</span></>}
                  {paciente.sexo && <><span style={{ opacity: .4 }}>·</span><span>{paciente.sexo === "M" ? "Masculino" : "Femenino"}</span></>}
                </div>
              </div>
            </div>

            <VacunasCarnet
              key={paciente.id}
              paciente={paciente}
              pacienteId={paciente.id}
            />
          </>
        )}
      </div>
    </div>
  );
}
