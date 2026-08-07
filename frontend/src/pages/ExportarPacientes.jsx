import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000");

function downloadUrl(path) {
  const token = localStorage.getItem("token") || "";
  return `${API_BASE}/api${path}${path.includes("?") ? "&" : "?"}auth_token=${token}`;
}

export default function ExportarPacientes() {
  const { modulos } = useAuth();
  const tieneExportar = modulos.some(m => m.clave === "exportar_pacientes");
  const [q, setQ] = useState("");
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await api.get("/pacientes", { params: { q } });
      setLista(res.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  if (!tieneExportar) {
    return (
      <div style={{ padding: 24 }}>
        <div className="alert alert-warning">
          <i className="bi bi-lock-fill me-2" />
          Este módulo no está habilitado para tu clínica. Contacta al administrador del sistema.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px" }}>
      <h4 style={{ fontWeight: 700, marginBottom: 4 }}>
        <i className="bi bi-file-earmark-excel-fill me-2 text-success" />
        Exportar Pacientes
      </h4>
      <p style={{ color: "#6b7280", marginBottom: 20 }}>
        Descarga la información de tus pacientes en Excel, o en ZIP (incluye documentos, estudios e imágenes).
      </p>

      {/* Descargas de toda la clínica */}
      <div style={{
        display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28,
        background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,.06)",
      }}>
        <a href={downloadUrl("/pacientes/export/excel")}
          style={{
            background: "#15803d", border: "none", borderRadius: 8, padding: "10px 22px", color: "#fff",
            display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: "0.9rem", textDecoration: "none",
          }}>
          <i className="bi bi-file-earmark-excel" /> Excel — todos los pacientes
        </a>
        <a href={downloadUrl("/pacientes/export/zip-todos")}
          title="ZIP con una carpeta por paciente (excel + documentos, estudios e imágenes)"
          style={{
            background: "#0f766e", border: "none", borderRadius: 8, padding: "10px 22px", color: "#fff",
            display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: "0.9rem", textDecoration: "none",
          }}>
          <i className="bi bi-file-earmark-zip" /> ZIP — todos los pacientes
        </a>
      </div>

      {/* Descarga individual por paciente */}
      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <div style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && cargar()}
              placeholder="Buscar paciente por nombre, DNI o teléfono..."
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: "0.87rem",
              }}
            />
            <button onClick={cargar}
              style={{
                background: "#2563eb", border: "none", borderRadius: 8, padding: "8px 18px", color: "#fff",
                cursor: "pointer", fontWeight: 600, fontSize: "0.87rem",
              }}>
              <i className="bi bi-search me-1" /> Buscar
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Paciente", "DNI", "Teléfono", "Descargas"].map(h => (
                    <th key={h} style={{
                      padding: "10px 14px", fontSize: "0.73rem", fontWeight: 700, color: "#6b7280",
                      textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e5e7eb",
                      textAlign: "left", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>Cargando...</td></tr>
                )}
                {!loading && lista.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>Sin pacientes</td></tr>
                )}
                {lista.map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontSize: "0.87rem" }}>{p.nombres} {p.apellidos}</td>
                    <td style={{ padding: "10px 14px", fontSize: "0.87rem", color: "#6b7280" }}>{p.dni || "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: "0.87rem", color: "#6b7280" }}>{p.telefono || "—"}</td>
                    <td style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
                      <a href={downloadUrl(`/pacientes/${p.id}/export/excel`)} title="Descargar Excel"
                        style={{ color: "#15803d", fontSize: "1.05rem" }}>
                        <i className="bi bi-file-earmark-excel" />
                      </a>
                      <a href={downloadUrl(`/pacientes/${p.id}/export/zip`)} title="Descargar ZIP"
                        style={{ color: "#0f766e", fontSize: "1.05rem" }}>
                        <i className="bi bi-file-earmark-zip" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
