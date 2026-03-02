import { useEffect, useState } from "react";
import api from "../../api/api";

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

export default function GaleriaEstetica() {
  const [pacientes, setPacientes] = useState([]);
  const [galeria,   setGaleria]   = useState([]);
  const [pacId,     setPacId]     = useState("");
  const [filtro,    setFiltro]    = useState("");
  const [cargando,  setCargando]  = useState(false);
  const [modalImg,  setModalImg]  = useState(null);

  useEffect(() => {
    api.get("/pacientes").then(r => setPacientes(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pacId) { setGaleria([]); return; }
    setCargando(true);
    api.get(`/estudios?paciente_id=${pacId}&tipo=IMAGEN`)
      .then(r => setGaleria(r.data.data || []))
      .catch(() => setGaleria([]))
      .finally(() => setCargando(false));
  }, [pacId]);

  const procedimientosFiltrados = galeria.filter(g =>
    !filtro || g.descripcion?.toLowerCase().includes(filtro.toLowerCase())
  );

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
          <i className="bi bi-images" style={{ fontSize: 22, color: "#fff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontWeight: 700, fontSize: 22, color: C.text }}>
            Galería Antes / Después
          </h4>
          <span style={{ color: C.muted, fontSize: 13 }}>
            Evolución fotográfica por procedimiento y paciente
          </span>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                           letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
            Paciente
          </label>
          <select
            style={{ ...inputSt, appearance: "none", cursor: "pointer" }}
            value={pacId}
            onChange={e => setPacId(e.target.value)}
          >
            <option value="">— Seleccionar paciente —</option>
            {pacientes.map(p => (
              <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: "1 1 220px" }}>
          <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                           letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
            Procedimiento
          </label>
          <input
            style={inputSt}
            placeholder="Buscar por procedimiento..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          />
        </div>
      </div>

      {/* Datos del paciente seleccionado */}
      {pacSeleccionado && (
        <div style={{
          background: `${C.accent}12`, border: `1px solid ${C.accent}33`,
          borderRadius: 12, padding: "12px 18px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, color: "#fff",
          }}>
            {(pacSeleccionado.nombres?.[0] || "?").toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: C.text }}>
              {pacSeleccionado.nombres} {pacSeleccionado.apellidos}
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {pacSeleccionado.fecha_nacimiento &&
                `${new Date().getFullYear() - new Date(pacSeleccionado.fecha_nacimiento).getFullYear()} años`}
              {pacSeleccionado.dni ? ` · DNI: ${pacSeleccionado.dni}` : ""}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span style={{
              background: `${C.accent}22`, border: `1px solid ${C.accent}44`,
              borderRadius: 8, padding: "4px 12px", fontSize: 12,
              color: C.accent, fontWeight: 600,
            }}>
              {galeria.length} foto{galeria.length !== 1 ? "s" : ""} registrada{galeria.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      {/* Grid de fotos */}
      {!pacId ? (
        <EmptyState
          icon="bi-person-circle"
          titulo="Selecciona un paciente"
          desc="Elige un paciente para ver su galería fotográfica de procedimientos."
        />
      ) : cargando ? (
        <Spin />
      ) : !procedimientosFiltrados.length ? (
        <EmptyState
          icon="bi-camera"
          titulo="Sin imágenes registradas"
          desc="No hay fotografías de procedimientos estéticos para este paciente todavía."
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
          {procedimientosFiltrados.map(img => (
            <div
              key={img.id}
              onClick={() => setModalImg(img)}
              style={{
                background: C.card, borderRadius: 14, overflow: "hidden",
                border: `1px solid ${C.border}`, cursor: "pointer",
                transition: "transform .2s, box-shadow .2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {/* Preview de imagen */}
              <div style={{
                height: 160, background: "#0a1628",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderBottom: `1px solid ${C.border}`, position: "relative",
              }}>
                {img.archivo_url ? (
                  <img src={img.archivo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <i className="bi bi-image" style={{ fontSize: 40, color: C.muted }} />
                )}
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  background: `${C.accent}cc`, borderRadius: 6, padding: "3px 8px",
                  fontSize: 11, fontWeight: 600, color: "#fff",
                }}>
                  {img.tipo || "IMAGEN"}
                </div>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 4 }}>
                  {img.descripcion || "Procedimiento estético"}
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  <i className="bi bi-calendar2 me-1" />
                  {img.creado_en ? new Date(img.creado_en).toLocaleDateString("es-PE") : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal lightbox */}
      {modalImg && (
        <div
          onClick={() => setModalImg(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(0,0,0,.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: C.surface, borderRadius: 16, maxWidth: 720,
            width: "95%", overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.6)",
          }}>
            {modalImg.archivo_url ? (
              <img src={modalImg.archivo_url} alt="" style={{ width: "100%", maxHeight: "65vh", objectFit: "contain" }} />
            ) : (
              <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="bi bi-image" style={{ fontSize: 60, color: C.muted }} />
              </div>
            )}
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, color: C.text }}>{modalImg.descripcion || "Imagen de procedimiento"}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {modalImg.creado_en ? new Date(modalImg.creado_en).toLocaleString("es-PE") : ""}
                </div>
              </div>
              <button onClick={() => setModalImg(null)}
                style={{ background: "rgba(255,255,255,.07)", border: "none", borderRadius: 8,
                           padding: "8px 14px", color: C.text, cursor: "pointer", fontSize: 14 }}>
                <i className="bi bi-x-lg me-1" /> Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Spin() {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{
        width: 40, height: 40, border: "3px solid rgba(255,255,255,.08)",
        borderTopColor: "#e91e8c", borderRadius: "50%",
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
        <i className={`bi ${icon}`} style={{ fontSize: 30, color: "#e91e8c" }} />
      </div>
      <p style={{ color: "#94a3b8", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{titulo}</p>
      <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>{desc}</p>
    </div>
  );
}
