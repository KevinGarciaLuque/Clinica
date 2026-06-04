import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import api from "../../api/api";

const CATEGORIAS = ["consulta", "procedimiento", "examen", "vacuna", "otro"];
const EMPTY = { nombre: "", descripcion: "", categoria: "consulta", precio: "", moneda: "HNL", duracion_min: 30 };

export default function Servicios() {
  const [servicios, setServicios] = useState([]);
  const [form, setForm]           = useState(EMPTY);
  const [editId, setEditId]       = useState(null);
  const [busqueda, setBusqueda]   = useState("");
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState("");
  const [showModal, setShowModal] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await api.get("/servicios?activo=all");
      setServicios(res.data.data);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setForm(EMPTY); setEditId(null); setError(""); setShowModal(true);
  };

  const abrirEditar = (s) => {
    setForm({
      nombre: s.nombre, descripcion: s.descripcion || "",
      categoria: s.categoria || "consulta", precio: s.precio,
      moneda: s.moneda, duracion_min: s.duracion_min,
    });
    setEditId(s.id); setError(""); setShowModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault(); setError("");
    try {
      if (editId) {
        await api.put(`/servicios/${editId}`, form);
      } else {
        await api.post("/servicios", form);
      }
      setShowModal(false); cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const toggleActivo = async (s) => {
    try {
      await api.put(`/servicios/${s.id}`, { activo: s.activo ? 0 : 1 });
      cargar();
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    }
  };

  const filtrados = servicios.filter((s) =>
    `${s.nombre} ${s.categoria}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const formatPrecio = (p, m) =>
    Number(p).toLocaleString("es-PE", { style: "currency", currency: m || "PEN" });

  const inputSt = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: "0.87rem", background: "#fff" };
  const labelSt = { fontWeight: 600, fontSize: "0.83rem", color: "#374151", display: "block", marginBottom: 6 };

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-tag-fill" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Catálogo de Servicios y Tarifas</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>
              Gestiona los servicios y precios de la clínica
            </div>
          </div>
        </div>
        <button
          onClick={abrirNuevo}
          style={{
            background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)",
            borderRadius: 8, color: "#e2e8f0", padding: "6px 14px",
            fontSize: "0.8rem", cursor: "pointer", fontWeight: 500,
            display: "flex", alignItems: "center", gap: 6,
          }}>
          <i className="bi bi-plus-lg"></i> Nuevo servicio
        </button>
      </div>

      <div style={{ padding: "20px 24px" }}>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 16, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca",
          }}>
            <span><i className="bi bi-x-circle-fill me-2"></i>{error}</span>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}>×</button>
          </div>
        )}

        {/* Buscador */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: "12px 16px",
          boxShadow: "0 2px 8px rgba(0,0,0,.06)", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <i className="bi bi-search" style={{ color: "#9ca3af", fontSize: "0.9rem" }}></i>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar servicio..."
            style={{ border: "none", outline: "none", flex: 1, fontSize: "0.9rem", color: "#111827", background: "transparent" }}
          />
        </div>

        {/* Tabla */}
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
          {cargando ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
              <div className="spinner-border text-primary" role="status" style={{ width: "1.5rem", height: "1.5rem" }}></div>
              <div style={{ marginTop: 10, fontSize: "0.85rem" }}>Cargando...</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Nombre", "Categoría", "Precio", "Duración", "Estado", "Acciones"].map(h => (
                    <th key={h} style={{
                      padding: "10px 16px", fontSize: "0.73rem", fontWeight: 700,
                      color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                      borderBottom: "2px solid #e5e7eb", textAlign: "left", whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#111827" }}>{s.nombre}</div>
                      {s.descripcion && <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: 2 }}>{s.descripcion}</div>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe",
                        borderRadius: 20, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600,
                        textTransform: "capitalize",
                      }}>{s.categoria}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#059669", fontSize: "0.9rem" }}>
                      {formatPrecio(s.precio, s.moneda)}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "0.88rem", color: "#374151" }}>
                      {s.duracion_min} min
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        background: s.activo ? "#dcfce7" : "#f3f4f6",
                        color: s.activo ? "#166534" : "#6b7280",
                        border: `1px solid ${s.activo ? "#bbf7d0" : "#e5e7eb"}`,
                        borderRadius: 20, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600,
                      }}>{s.activo ? "Activo" : "Inactivo"}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => abrirEditar(s)}
                          style={{
                            background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7,
                            color: "#2563eb", padding: "4px 12px", fontSize: "0.78rem",
                            fontWeight: 600, cursor: "pointer",
                          }}>Editar</button>
                        <button
                          onClick={() => toggleActivo(s)}
                          style={{
                            background: s.activo ? "#fffbeb" : "#f0fdf4",
                            border: `1px solid ${s.activo ? "#fde68a" : "#bbf7d0"}`,
                            borderRadius: 7, color: s.activo ? "#92400e" : "#166534",
                            padding: "4px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                          }}>{s.activo ? "Desactivar" : "Activar"}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtrados.length && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: "0.9rem" }}>
                      <i className="bi bi-inbox" style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: 0.4 }}></i>
                      Sin servicios registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ═══ MODAL ═══ */}
      {showModal && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 500, boxShadow: "0 8px 32px rgba(0,0,0,.2)", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{
              background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
              padding: "14px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <i className="bi bi-tag-fill" style={{ color: "#7dd3fc" }}></i>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>
                  {editId ? "Editar servicio" : "Nuevo servicio"}
                </span>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", padding: "2px 8px", fontSize: "1rem" }}>×</button>
            </div>
            {/* Modal body */}
            <form onSubmit={guardar}>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                {error && (
                  <div style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", fontSize: "0.84rem" }}>
                    {error}
                  </div>
                )}
                <div>
                  <label style={labelSt}>Nombre *</label>
                  <input style={inputSt} value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                </div>
                <div>
                  <label style={labelSt}>Descripción</label>
                  <textarea style={{ ...inputSt, resize: "vertical" }} rows={2} value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelSt}>Categoría</label>
                    <select style={inputSt} value={form.categoria}
                      onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                      {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelSt}>Duración (minutos)</label>
                    <input style={inputSt} type="number" min={5} step={5}
                      value={form.duracion_min}
                      onChange={(e) => setForm({ ...form, duracion_min: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label style={labelSt}>Precio *</label>
                    <input style={inputSt} type="number" min={0} step={0.01}
                      value={form.precio}
                      onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
                  </div>
                  <div>
                    <label style={labelSt}>Moneda</label>
                    <select style={inputSt} value={form.moneda}
                      onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                      {[
                        { code: "HNL", label: "HNL - Lps" },
                        { code: "PEN", label: "PEN - S/" },
                        { code: "USD", label: "USD - $" },
                        { code: "EUR", label: "EUR - €" },
                        { code: "COP", label: "COP - $" },
                        { code: "MXN", label: "MXN - $" },
                      ].map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {/* Modal footer */}
              <div style={{ padding: "12px 24px 20px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{
                  background: "transparent", border: "1px solid #d1d5db", borderRadius: 8,
                  padding: "8px 20px", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: "0.87rem",
                }}>Cancelar</button>
                <button type="submit" style={{
                  background: "#2563eb", border: "none", borderRadius: 8,
                  padding: "8px 22px", color: "#fff", fontWeight: 600, fontSize: "0.87rem", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                }}>
                  <i className="bi bi-check-lg"></i> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
