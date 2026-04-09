import { useState, useEffect, useRef } from "react";
import api from "../api/api";
import CurvaCrecimiento from "../components/CurvaCrecimiento";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000");

const C = {
  border: "rgba(0,0,0,0.1)", accent: "#166ae8",
  text: "#1a1a1a", muted: "#6c757d", inputBg: "#ffffff",
};

export default function CrecimientoPage() {
  const [search,    setSearch]    = useState("");
  const [lista,     setLista]     = useState([]);
  const [paciente,  setPaciente]  = useState(null);
  const [buscando,  setBuscando]  = useState(false);
  const [hovRow,    setHovRow]    = useState(null);
  const timerRef = useRef(null);

  // Carga inicial + búsqueda con debounce
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setBuscando(true);
      const params = search.length >= 2 ? { q: search } : {};
      api.get("/pacientes", { params })
        .then(r => setLista(r.data.data || []))
        .catch(() => setLista([]))
        .finally(() => setBuscando(false));
    }, search.length >= 2 ? 300 : 0);
    return () => clearTimeout(timerRef.current);
  }, [search]);

  const seleccionar = (p) => setPaciente(p);
  const volver      = () => setPaciente(null);

  return (
    <div className="container-fluid py-3" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="fw-bold mb-0">
          <i className="bi bi-graph-up-arrow me-2 text-primary" />
          Curvas de Crecimiento OMS
        </h4>
        {paciente && (
          <button className="btn btn-sm btn-outline-secondary" onClick={volver}>
            <i className="bi bi-arrow-left me-1" />Volver a lista
          </button>
        )}
      </div>

      {/* PANEL LISTADO */}
      {!paciente && (
        <div style={{
          background: "#ffffff",
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          marginBottom: 24,
        }}>
          <div style={{ padding: "20px 24px" }}>
            {/* Buscador */}
            <div style={{ position: "relative", marginBottom: 20 }}>
              <i className="bi bi-search" style={{
                position: "absolute", left: 12, top: "50%",
                transform: "translateY(-50%)",
                color: C.muted, fontSize: 16, pointerEvents: "none",
              }} />
              <input
                autoFocus
                style={{
                  background: "#fff",
                  border: `2px solid ${C.border}`,
                  borderRadius: 8,
                  color: C.text,
                  padding: "8px 12px 8px 38px",
                  width: "100%",
                  fontSize: 14,
                  outline: "none",
                  transition: "border-color .2s, box-shadow .2s",
                }}
                placeholder="Buscar paciente por nombre, apellido o DNI…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={e => {
                  e.target.style.borderColor = C.accent;
                  e.target.style.boxShadow = "0 0 0 3px rgba(13,110,253,0.1)";
                }}
                onBlur={e => {
                  e.target.style.borderColor = C.border;
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Tabla con scroll vertical desde la fila 8 */}
            {buscando ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border spinner-border-sm me-2" />Cargando…
              </div>
            ) : lista.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <div style={{ maxHeight: 399, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                      <tr style={{ background: "linear-gradient(135deg, #214a87 0%, #176DC8 100%)" }}>
                        {["Paciente", "DNI", "Teléfono", "Email", "Estado"].map(h => (
                          <th key={h} style={{
                            padding: "12px 16px",
                            textAlign: h === "Estado" ? "center" : "left",
                            fontSize: 12, fontWeight: 700,
                            color: "#fff", textTransform: "uppercase", letterSpacing: ".05em",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(p => (
                        <tr
                          key={p.id}
                          onClick={() => seleccionar(p)}
                          onMouseEnter={() => setHovRow(p.id)}
                          onMouseLeave={() => setHovRow(null)}
                          style={{
                            borderBottom: `1px solid ${C.border}`,
                            cursor: "pointer",
                            background: hovRow === p.id ? "rgba(13,110,253,0.04)" : "transparent",
                            transition: "background .2s",
                          }}
                        >
                          <td style={{ padding: "12px 16px", width: "35%" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{
                                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                                background: p.foto_perfil ? "transparent" : "rgba(13,110,253,0.1)",
                                backgroundImage: p.foto_perfil
                                  ? `url(${p.foto_perfil.startsWith("http") ? p.foto_perfil : `${API_BASE}/uploads/${p.foto_perfil}`})`
                                  : "none",
                                backgroundSize: "cover", backgroundPosition: "center",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: C.accent, fontWeight: 700, fontSize: 13,
                                border: p.foto_perfil ? `2px solid ${C.border}` : "none",
                              }}>
                                {!p.foto_perfil && `${p.nombres?.[0] || ""}${p.apellidos?.[0] || ""}`}
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
                          <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>{p.dni || "—"}</td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>{p.telefono || "—"}</td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: C.muted }}>{p.email || "—"}</td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            {p.activo !== false ? (
                              <span style={{
                                background: "rgba(16,185,129,0.1)",
                                border: "1px solid rgba(16,185,129,0.3)",
                                borderRadius: 6, padding: "4px 10px",
                                fontSize: 11, fontWeight: 600, color: "#10b981",
                                textTransform: "uppercase",
                              }}>Activo</span>
                            ) : (
                              <span style={{
                                background: "rgba(0,0,0,0.05)",
                                border: `1px solid ${C.border}`,
                                borderRadius: 6, padding: "4px 10px",
                                fontSize: 11, fontWeight: 600, color: C.muted,
                                textTransform: "uppercase",
                              }}>Inactivo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : search.length >= 2 ? (
              <div className="text-center py-4 text-muted">
                No se encontraron pacientes con "{search}"
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* CURVAS DEL PACIENTE SELECCIONADO */}
      {paciente && (
        <>
          {/* Mini-header del paciente */}
          <div className="d-flex align-items-center gap-3 mb-3 p-3 rounded-3 border bg-white">
            <div style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: paciente.foto_perfil ? "transparent" : "rgba(13,110,253,0.1)",
              backgroundImage: paciente.foto_perfil
                ? `url(${paciente.foto_perfil.startsWith("http") ? paciente.foto_perfil : `${API_BASE}/uploads/${paciente.foto_perfil}`})`
                : "none",
              backgroundSize: "cover", backgroundPosition: "center",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C.accent, fontWeight: 700, fontSize: 14,
              border: paciente.foto_perfil ? `2px solid ${C.border}` : "none",
            }}>
              {!paciente.foto_perfil && `${paciente.nombres?.[0] || ""}${paciente.apellidos?.[0] || ""}`}
            </div>
            <div>
              <div className="fw-semibold">{paciente.nombres} {paciente.apellidos}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {paciente.dni && <>DNI {paciente.dni}</>}
                {paciente.fecha_nacimiento && <> &middot; Nac. {paciente.fecha_nacimiento.slice(0, 10)}</>}
                {paciente.sexo && <> &middot; {paciente.sexo === "M" ? "Masculino" : "Femenino"}</>}
              </div>
            </div>
          </div>

          <CurvaCrecimiento
            key={paciente.id}
            pacienteId={paciente.id}
            sexo={paciente.sexo}
            fechaNacimiento={paciente.fecha_nacimiento}
          />
        </>
      )}
    </div>
  );
}
