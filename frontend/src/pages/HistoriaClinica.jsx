/**
 * FASE 4 — Historia Clínica Electrónica — Timeline del paciente
 * URL: /historia/:paciente_id
 */
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";
import { tituloMedicoActivo, nombreMedico } from "../utils/medico";
import AntecedentesClinico from "../components/AntecedentesClinico";
import HistorialPsicologico from "../components/HistorialPsicologico";
import { useAuth } from "../auth/AuthContext";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000");
const ESTADO_BADGE = { BORRADOR: "warning text-dark", FIRMADA: "success" };
const SEV_COLOR    = { LEVE: "success", MODERADA: "warning", SEVERA: "danger", MORTAL: "dark" };

const C = {
  bg: "#f8f9fa", surface: "#ffffff", card: "#ffffff",
  border: "rgba(0,0,0,0.1)", accent: "#166ae8",
  accentD: "#1f6bbd", text: "#1a1a1a", muted: "#6c757d", inputBg: "#ffffff",
};

const inputSt = {
  background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", width: "100%", fontSize: 14, outline: "none",
};

export default function HistoriaClinica() {
  const { paciente_id } = useParams();
  const navigate        = useNavigate();
  const { modulos }     = useAuth();
  const tieneModulo     = (clave) => modulos.some(m => m.clave === clave);

  const [paciente,     setPaciente]     = useState(null);
  const [historias,    setHistorias]    = useState([]);
  const [alergias,     setAlergias]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");       // buscar paciente si no hay id en URL
  const [searchList,   setSearchList]   = useState([]);
  const [selPacId,     setSelPacId]     = useState(paciente_id || null);
  const [expandId,     setExpandId]     = useState(null);    // expanded historia
  const [detalle,      setDetalle]      = useState({});      // historia_id → full detail
  const [hoveredRow,   setHoveredRow]   = useState(null);    // hover effect en tabla
  const [modalFoto,    setModalFoto]    = useState(null);    // modal foto grande
  const [showConsultaModal,  setShowConsultaModal]  = useState(false);
  const [consultaPaciente,   setConsultaPaciente]   = useState(null);
  const [activeTabHist,      setActiveTabHist]      = useState("historial");
  const [filtroDesde,        setFiltroDesde]        = useState("");
  const [filtroHasta,        setFiltroHasta]        = useState("");
  const [docsMap,            setDocsMap]            = useState({});   // historia_id → count
  const [modalDocs,          setModalDocs]          = useState(null); // { historiaId, docs[] }

  // ── cargar datos cuando se selecciona paciente ────────────────────────────
  useEffect(() => {
    if (!selPacId) { setLoading(false); return; }
    setLoading(true);

    Promise.all([
      api.get(`/pacientes/${selPacId}`),
      api.get(`/historias`, { params: { paciente_id: selPacId } }),
      api.get(`/historias/paciente/${selPacId}/alergias`),
      api.get(`/pacientes/${selPacId}/documentos/por-historia`).catch(() => ({ data: { data: {} } })),
    ])
    .then(([p, h, al, dm]) => {
      setPaciente(p.data.data || null);
      setHistorias(h.data.data || []);
      setAlergias(al.data.data || []);
      setDocsMap(dm.data.data || {});
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, [selPacId]);

  // ── búsqueda de paciente ──────────────────────────────────────────────────
  useEffect(() => {
    if (search.length < 2) { 
      // Cargar todos los pacientes cuando no hay búsqueda
      api.get("/pacientes")
        .then(r => setSearchList(r.data.data || []))
        .catch(() => {});
      return; 
    }
    const t = setTimeout(() => {
      api.get("/pacientes", { params: { q: search } })
        .then(r => setSearchList(r.data.data || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Cargar lista inicial
  useEffect(() => {
    if (!selPacId) {
      api.get("/pacientes")
        .then(r => setSearchList(r.data.data || []))
        .catch(() => {});
    }
  }, [selPacId]);

  // ── expandir entrada → cargar detalle ────────────────────────────────────
  const toggleExpand = async (id) => {
    if (expandId === id) { setExpandId(null); return; }
    setExpandId(id);
    if (!detalle[id]) {
      try {
        const r = await api.get(`/historias/${id}`);
        setDetalle(d => ({ ...d, [id]: r.data.data }));
      } catch { /* silencio */ }
    }
  };

  // ── Imprimir consulta ──────────────────────────────────────────────────────
  const imprimirConsulta = async (h) => {
    // Obtener detalle completo si no está en caché
    let det = detalle[h.id];
    if (!det) {
      try {
        const r = await api.get(`/historias/${h.id}`);
        det = r.data.data;
        setDetalle(d => ({ ...d, [h.id]: det }));
      } catch {
        alert("No se pudo cargar el detalle de la consulta");
        return;
      }
    }

    const vitals = det.objetivo
      ? (typeof det.objetivo === "string" ? JSON.parse(det.objetivo) : det.objetivo)
      : {};

    const vitalesHtml = ["pa","fc","fr","temp","peso","talla","spo2"]
      .filter(k => vitals[k])
      .map(k => {
        const labels = { pa: "P.A.", fc: "F.C.", fr: "F.R.", temp: "Temp.", peso: "Peso", talla: "Talla", spo2: "SpO₂" };
        const units  = { pa: "mmHg", fc: "bpm", fr: "rpm", temp: "°C", peso: "kg", talla: "cm", spo2: "%" };
        return `<span class="vital">${labels[k]}: <strong>${vitals[k]}</strong> ${units[k]}</span>`;
      }).join("");

    const prescHtml = (det.prescripciones || []).map(p => `
      <div class="section">
        <div class="section-title">Receta #${p.id} — ${p.estado}</div>
        <ul>${(p.items || []).filter(Boolean).map(it =>
          `<li>${it.medicamento_nombre || it.medicamento_texto || ""}${it.dosis ? ` — ${it.dosis}` : ""}${it.duracion ? ` — ${it.duracion}` : ""}</li>`
        ).join("")}</ul>
      </div>`).join("");

    const estudiosHtml = (det.estudios || []).length > 0 ? `
      <div class="section">
        <div class="section-title">Estudios solicitados</div>
        <ul>${(det.estudios || []).map(s =>
          `<li>[${s.tipo}] ${s.descripcion} — ${s.estado}</li>`
        ).join("")}</ul>
      </div>` : "";

    const alergiasHtml = alergias.length > 0
      ? `<div class="alergias">⚠ Alergias: ${alergias.map(a => `${a.agente} (${a.severidad})`).join(" | ")}</div>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Consulta — ${det.pac_nombres} ${det.pac_apellidos} — ${dayjs(det.creado_en).format("DD/MM/YYYY")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #166ae8; padding-bottom: 12px; margin-bottom: 16px; }
    .header-left h1 { font-size: 18px; color: #166ae8; }
    .header-left p { font-size: 12px; color: #555; margin-top: 2px; }
    .header-right { text-align: right; font-size: 12px; color: #555; }
    .paciente { background: #f4f6fb; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; }
    .paciente h2 { font-size: 15px; margin-bottom: 4px; }
    .paciente .datos { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #555; }
    .alergias { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 12px; font-weight: bold; color: #856404; }
    .vitales { display: flex; flex-wrap: wrap; gap: 10px; background: #eef2ff; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; }
    .vital { font-size: 12px; color: #333; }
    .section { margin-bottom: 14px; }
    .section-title { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #166ae8; border-bottom: 1px solid #dde3f5; padding-bottom: 3px; margin-bottom: 6px; }
    .section p, .section pre { font-size: 13px; color: #333; white-space: pre-wrap; line-height: 1.5; }
    ul { padding-left: 20px; }
    ul li { margin-bottom: 3px; }
    .badge-cie { display: inline-block; background: #e9ecef; border: 1px solid #ced4da; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: bold; margin-right: 6px; }
    .firma { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ccc; display: flex; justify-content: flex-end; }
    .firma-box { text-align: center; }
    .firma-box img { max-width: 160px; max-height: 70px; display: block; margin: 0 auto 4px; }
    .firma-box .linea { width: 200px; border-top: 1px solid #333; margin: 0 auto 4px; }
    .firma-box p { font-size: 12px; color: #444; }
    @media print { body { padding: 12px 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Historia Clínica Electrónica</h1>
      <p>${nombreMedico(det, { conEspecialidad: true, sep: "—" })}</p>
    </div>
    <div class="header-right">
      <p><strong>Fecha:</strong> ${dayjs(det.creado_en).format("DD/MM/YYYY HH:mm")}</p>
      <p><strong>Estado:</strong> ${det.estado}</p>
      <p><strong>Consulta #${det.id}</strong></p>
    </div>
  </div>

  <div class="paciente">
    <h2>${det.pac_nombres} ${det.pac_apellidos}</h2>
    <div class="datos">
      ${det.fecha_nacimiento ? `<span>Nacimiento: ${dayjs(det.fecha_nacimiento).format("DD/MM/YYYY")}</span>` : ""}
      ${det.sexo ? `<span>Sexo: ${det.sexo}</span>` : ""}
      ${det.pac_tel ? `<span>Tel: ${det.pac_tel}</span>` : ""}
      ${det.pac_email ? `<span>Email: ${det.pac_email}</span>` : ""}
    </div>
  </div>

  ${alergiasHtml}

  ${vitalesHtml ? `<div class="vitales">${vitalesHtml}</div>` : ""}

  ${det.diagnostico_cie ? `
  <div class="section">
    <div class="section-title">Diagnóstico</div>
    <p><span class="badge-cie">CIE: ${det.diagnostico_cie}</span>${det.diagnostico_desc || ""}</p>
  </div>` : ""}

  ${det.subjetivo ? `
  <div class="section">
    <div class="section-title">Motivo / Anamnesis (Subjetivo)</div>
    <p>${det.subjetivo}</p>
  </div>` : ""}

  ${det.examen_fisico ? `
  <div class="section">
    <div class="section-title">Examen Físico (Objetivo)</div>
    <pre>${det.examen_fisico}</pre>
  </div>` : ""}

  ${det.plan ? `
  <div class="section">
    <div class="section-title">Plan de tratamiento</div>
    <pre>${det.plan}</pre>
  </div>` : ""}

  ${prescHtml}
  ${estudiosHtml}

  <div class="firma">
    <div class="firma-box">
      ${det.firma_digital_url ? `<img src="${det.firma_digital_url}" alt="Firma digital" />` : ""}
      <div class="linea"></div>
      <p>${nombreMedico(det)}</p>
      ${!det.med_nombre_display && tituloMedicoActivo() && det.especialidad ? `<p>${det.especialidad}</p>` : ""}
    </div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) { alert("El navegador bloqueó la ventana emergente. Permite popups para este sitio."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  // ── PDF de receta ─────────────────────────────────────────────────────────
  const printRx = async (id) => {
    try {
      const res = await api.get(`/prescripciones/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch {
      alert("No se pudo generar el PDF");
    }
  };

  const edad = paciente?.fecha_nacimiento
    ? dayjs().diff(dayjs(paciente.fecha_nacimiento), "year") + " años"
    : "";

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "16px 24px",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-journal-medical" style={{ color: "#7dd3fc", fontSize: "1rem" }}></i>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Historia Clínica Electrónica</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>Historial del paciente</div>
          </div>
        </div>
        {selPacId && (
          <button
            onClick={() => { setConsultaPaciente(paciente); setShowConsultaModal(true); }}
            style={{
              background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)",
              borderRadius: 8, padding: "7px 16px", color: "#fff", fontWeight: 600,
              fontSize: "0.82rem", cursor: "pointer",
            }}>
            + Nueva Consulta
          </button>
        )}
      </div>
      <div style={{ padding: "20px 24px", maxWidth: 980 }}>

      {/* Búsqueda de paciente (si no viene de URL) */}
      {!paciente_id && !selPacId && (
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 12, overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,.06)",
          marginBottom: 20,
        }}>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
              <div style={{ 
                position: "relative", 
                flex: 1,
                display: "flex",
                alignItems: "center",
              }}>
                <i className="bi bi-search" style={{
                  position: "absolute",
                  left: 12,
                  color: C.muted,
                  fontSize: 16,
                  pointerEvents: "none",
                }} />
                <input
                  style={{ 
                    ...inputSt, 
                    paddingLeft: 38,
                    width: "100%",
                    fontSize: 14,
                    border: `2px solid ${C.border}`,
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                  placeholder="Buscar paciente por nombre, DNI, teléfono o email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = C.accent;
                    e.target.style.boxShadow = `0 0 0 3px rgba(13,110,253,0.1)`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = C.border;
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {searchList.length > 0 && (
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
                    </tr>
                  </thead>
                  <tbody>
                    {searchList.map(p => (
                      <tr 
                        key={p.id} 
                        onClick={() => { 
                          setSelPacId(p.id); 
                          setSearch(`${p.nombres} ${p.apellidos}`); 
                        }}
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
                              cursor: p.foto_perfil ? "pointer" : "default",
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {searchList.length === 0 && search.length >= 2 && (
              <div className="text-center py-4 text-muted">
                No se encontraron pacientes con "{search}"
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280" }}>
          <div className="spinner-border spinner-border-sm me-2" />Cargando…
        </div>
      )}

      {!loading && !paciente && selPacId && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 16px", color: "#92400e", fontSize: "0.9rem" }}>Paciente no encontrado.</div>
      )}

      {!loading && !selPacId && !paciente_id && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af", fontSize: "0.9rem" }}>Busca un paciente para ver su historia clínica.</div>
      )}

      {paciente && (
        <>
          {/* Botón volver a lista */}
          {!paciente_id && (
            <button
              onClick={() => {
                setSelPacId(null);
                setPaciente(null);
                setHistorias([]);
                setAlergias([]);
                setAntecedentes([]);
                setSearch("");
              }}
              style={{
                background: "rgba(13,110,253,0.1)",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "8px 16px",
                color: C.accent,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <i className="bi bi-arrow-left" /> Volver a lista de pacientes
            </button>
          )}

          {/* Tarjeta del paciente */}
          <div style={{
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
            padding: "16px 20px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: "1.2rem", flexShrink: 0,
            }}>
              {paciente.nombres?.[0]}{paciente.apellidos?.[0]}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 4 }}>
                {paciente.nombres} {paciente.apellidos}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", color: "#6b7280", fontSize: "0.82rem" }}>
                {paciente.dni && <span>DNI: {paciente.dni}</span>}
                {paciente.fecha_nacimiento && <span>{dayjs(paciente.fecha_nacimiento).format("DD/MM/YYYY")} — {edad}</span>}
                {paciente.sexo && <span>Sexo: {paciente.sexo}</span>}
                {paciente.telefono && <span>📞 {paciente.telefono}</span>}
                {paciente.email && <span>✉ {paciente.email}</span>}
              </div>
            </div>
          </div>

          {/* ── Pestañas ───────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { key: "historial",  label: `🕐 Historial (${historias.length})`,       show: true },
              { key: "alergias",   label: "🩺 Alergias y Antecedentes",               show: true },
              { key: "psicologia", label: "🧠 Historia Psicológica",                  show: tieneModulo("consulta_psicologica"), color: "#673AB7" },
            ].filter(t => t.show).map(t => (
              <button key={t.key} onClick={() => setActiveTabHist(t.key)} style={{
                padding: "7px 18px", fontSize: "0.82rem", fontWeight: 600, borderRadius: 8,
                border: activeTabHist === t.key ? "none" : "1px solid #e5e7eb",
                cursor: "pointer",
                background: activeTabHist === t.key ? (t.color || "#1a2744") : "#fff",
                color: activeTabHist === t.key ? "#fff" : "#6b7280",
                boxShadow: activeTabHist === t.key ? `0 2px 8px ${t.color ? t.color + "40" : "rgba(26,39,68,.2)"}` : "none",
              }}>{t.label}</button>
            ))}
          </div>

          {/* ── Tab: Alergias y Antecedentes ─────────────────────────── */}
          {activeTabHist === "alergias" && (
            <AntecedentesClinico
              pacienteId={selPacId || paciente_id}
              sexo={paciente?.sexo}
            />
          )}

          {/* ── Tab: Historia Psicológica ─────────────────────────────── */}
          {activeTabHist === "psicologia" && tieneModulo("consulta_psicologica") && (
            <HistorialPsicologico pacienteId={selPacId || paciente_id} />
          )}

          {/* ── Tab: Historial de Consultas ───────────────────────────── */}
          {activeTabHist === "historial" && (() => {
            const historiasFiltradas = historias.filter(h => {
              const fecha = dayjs(h.creado_en);
              if (filtroDesde && fecha.isBefore(dayjs(filtroDesde), "day")) return false;
              if (filtroHasta && fecha.isAfter(dayjs(filtroHasta), "day")) return false;
              return true;
            });
            return (
            <div>
              {/* Filtro por fecha */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6b7280" }}>Filtrar por fecha:</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 150 }}
                  value={filtroDesde}
                  onChange={e => setFiltroDesde(e.target.value)}
                />
                <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>—</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 150 }}
                  value={filtroHasta}
                  onChange={e => setFiltroHasta(e.target.value)}
                />
                {(filtroDesde || filtroHasta) && (
                  <button
                    onClick={() => { setFiltroDesde(""); setFiltroHasta(""); }}
                    style={{
                      background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6,
                      padding: "3px 10px", fontSize: "0.78rem", cursor: "pointer", color: "#374151",
                    }}
                  >
                    <i className="bi bi-x-circle me-1"></i>Limpiar
                  </button>
                )}
                <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "#9ca3af" }}>
                  {historiasFiltradas.length} de {historias.length} consulta{historias.length !== 1 ? "s" : ""}
                </span>
              </div>

              {historias.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
                  No hay consultas registradas.
                  <br />
                  <Link to={`/consulta?paciente_id=${paciente.id}`}
                    style={{ display: "inline-block", marginTop: 10, background: "#2563eb", color: "#fff",
                      padding: "6px 16px", borderRadius: 8, textDecoration: "none", fontSize: "0.82rem", fontWeight: 600 }}>
                    Abrir primera consulta
                  </Link>
                </div>
              )}

              {historias.length > 0 && historiasFiltradas.length === 0 && (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8,
                  padding: "10px 16px", color: "#92400e", fontSize: "0.85rem" }}>
                  <i className="bi bi-search me-2"></i>
                  No hay consultas en el rango de fechas seleccionado.
                </div>
              )}

          <div className="timeline" style={{ maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
              {historiasFiltradas.map((h, i) => {
              const det = detalle[h.id];
              const expanded = expandId === h.id;
              const vitals = h.objetivo
                ? (typeof h.objetivo === "string" ? JSON.parse(h.objetivo) : h.objetivo)
                : {};

              return (
                <div key={h.id} className="d-flex gap-3 mb-3">
                  {/* Línea de tiempo */}
                  <div className="d-flex flex-column align-items-center" style={{ minWidth: 24 }}>
                    <div className={`rounded-circle border border-2 ${h.estado === "FIRMADA" ? "border-success bg-success" : "border-warning bg-warning"}`}
                      style={{ width: 12, height: 12, marginTop: 6, flexShrink: 0 }} />
                    {i < historiasFiltradas.length - 1 && (
                      <div style={{ width: 2, flex: 1, background: "#dee2e6", minHeight: 40 }} />
                    )}
                  </div>

                  {/* Tarjeta de consulta */}
                  <div style={{
                    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
                    padding: "12px 16px", flex: 1, marginBottom: 8,
                    boxShadow: "0 1px 4px rgba(0,0,0,.05)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{
                          background: h.estado === "FIRMADA" ? "#dcfce7" : "#fef9c3",
                          color: h.estado === "FIRMADA" ? "#166534" : "#854d0e",
                          border: `1px solid ${h.estado === "FIRMADA" ? "#bbf7d0" : "#fde68a"}`,
                          borderRadius: 6, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700,
                        }}>{h.estado}</span>
                        <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>{nombreMedico(h)}</span>
                        {!h.med_nombre_display && tituloMedicoActivo() && h.especialidad && <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>({h.especialidad})</span>}
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>{dayjs(h.creado_en).format("DD/MM/YYYY HH:mm")}</span>
                    </div>

                    {h.diagnostico_cie && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd",
                          borderRadius: 5, padding: "2px 8px", fontSize: "0.75rem", fontWeight: 700 }}>CIE: {h.diagnostico_cie}</span>
                        {docsMap[h.id] > 0 && (
                          <span
                            onClick={async (e) => {
                              e.stopPropagation();
                              const r = await api.get(`/pacientes/${paciente.id}/documentos`, { params: { historia_id: h.id } }).catch(() => ({ data: { data: [] } }));
                              setModalDocs({ historiaId: h.id, docs: r.data.data || [] });
                            }}
                            title="Ver documentos adjuntos"
                            style={{
                              background: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd",
                              borderRadius: 5, padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600,
                              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                              userSelect: "none",
                            }}>
                            <i className="bi bi-paperclip"></i>
                            {docsMap[h.id]} doc{docsMap[h.id] > 1 ? "s" : ""}
                          </span>
                        )}
                        {h.plan && <span style={{ fontSize: "0.82rem", color: "#6b7280" }}>{h.plan.substring(0, 80)}{h.plan.length > 80 ? "…" : ""}</span>}
                      </div>
                    )}
                    {h.subjetivo && !h.diagnostico_cie && (
                      <div style={{ marginTop: 4, fontSize: "0.82rem", color: "#6b7280" }}>
                        {h.subjetivo.substring(0, 100)}{h.subjetivo.length > 100 ? "…" : ""}
                      </div>
                    )}

                    {/* Signos vitales resumidos */}
                    {(vitals.pa || vitals.fc || vitals.temp) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                        {vitals.pa   && <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>P.A. {vitals.pa} mmHg</span>}
                        {vitals.fc   && <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>· FC {vitals.fc} bpm</span>}
                        {vitals.temp && <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>· T {vitals.temp}°C</span>}
                        {vitals.peso && <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>· Peso {vitals.peso} kg</span>}
                      </div>
                    )}

                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <button onClick={() => toggleExpand(h.id)} style={{
                        background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6,
                        padding: "4px 12px", fontSize: "0.78rem", cursor: "pointer", color: "#374151",
                      }}>{expanded ? "Ocultar detalle" : "Ver detalle"}</button>
                      {h.estado === "BORRADOR" && (
                        <Link to={`/consulta-medica?historia_id=${h.id}`} style={{
                          background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6,
                          padding: "4px 12px", fontSize: "0.78rem", color: "#2563eb", fontWeight: 600,
                          textDecoration: "none",
                        }}>✏ Editar</Link>
                      )}
                      {h.estado === "FIRMADA" && (
                        <Link to={`/consulta-medica?historia_id=${h.id}`} style={{
                          fontSize: "0.78rem", color: "#2563eb", textDecoration: "none", fontWeight: 500,
                        }}>Ver completa</Link>
                      )}
                      {/* Botón documentos */}
                      <button onClick={async () => {
                        const r = await api.get(`/pacientes/${paciente.id}/documentos`, { params: { historia_id: h.id } }).catch(() => ({ data: { data: [] } }));
                        setModalDocs({ historiaId: h.id, docs: r.data.data || [] });
                      }} style={{
                        background: docsMap[h.id] ? "#eff6ff" : "#f8fafc",
                        border: `1px solid ${docsMap[h.id] ? "#bfdbfe" : "#e2e8f0"}`,
                        borderRadius: 6, padding: "4px 12px", fontSize: "0.78rem",
                        cursor: "pointer", color: docsMap[h.id] ? "#2563eb" : "#9ca3af",
                        display: "flex", alignItems: "center", gap: 5, fontWeight: docsMap[h.id] ? 600 : 400,
                      }}>
                        <i className="bi bi-paperclip"></i>
                        Docs{docsMap[h.id] ? ` (${docsMap[h.id]})` : ""}
                      </button>
                      <button onClick={() => imprimirConsulta(h)} style={{
                        marginLeft: "auto", background: "#f1f5f9", border: "1px solid #e2e8f0",
                        borderRadius: 6, padding: "4px 12px", fontSize: "0.78rem", cursor: "pointer", color: "#374151",
                      }}><i className="bi bi-printer me-1"></i>Imprimir</button>
                    </div>

                    {/* Detalle expandido */}
                    {expanded && det && (
                      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 10, paddingTop: 10 }}>
                        {det.prescripciones?.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 4, color: "#374151" }}>💊 Prescripción(es):</div>
                            {det.prescripciones.map(p => (
                              <div key={p.id} style={{ fontSize: "0.8rem", color: "#6b7280", paddingLeft: 8, marginBottom: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                  <span>Receta #{p.id}</span>
                                  <span style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 4,
                                    padding: "1px 6px", fontSize: "0.72rem", color: "#374151" }}>{p.estado}</span>
                                  <button onClick={() => printRx(p.id)} style={{
                                    background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 5,
                                    padding: "1px 8px", fontSize: "0.72rem", cursor: "pointer", color: "#2563eb",
                                  }}><i className="bi bi-printer me-1"></i>PDF</button>
                                </div>
                                {p.items?.filter(Boolean).map((it, i) => (
                                  <div key={i} style={{ paddingLeft: 8 }}>• {it.medicamento_nombre || it.medicamento_texto}{it.dosis ? ` — ${it.dosis}` : ""}</div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                        {det.estudios?.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 4, color: "#374151" }}>🧪 Estudios solicitados:</div>
                            {det.estudios.map(s => (
                              <div key={s.id} style={{ fontSize: "0.8rem", color: "#6b7280", paddingLeft: 8 }}>
                                [{s.tipo}] {s.descripcion} — {s.estado}
                              </div>
                            ))}
                          </div>
                        )}
                        {det.plan && (
                          <div>
                            <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 4, color: "#374151" }}>Plan:</div>
                            <div style={{ fontSize: "0.8rem", color: "#6b7280", whiteSpace: "pre-wrap" }}>{det.plan}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {expanded && !det && (
                      <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#9ca3af" }}>Cargando detalle…</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
            </div>
            );
          })()}
        </>
      )}

      {/* Modal documentos de consulta */}
      {modalDocs && (
        <div onClick={() => setModalDocs(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9990,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 14, width: "100%", maxWidth: 680,
            maxHeight: "85vh", display: "flex", flexDirection: "column",
            boxShadow: "0 8px 40px rgba(0,0,0,.25)",
          }}>
            <div style={{
              padding: "14px 20px", borderBottom: "1px solid #e5e7eb",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1a2744" }}>
                <i className="bi bi-paperclip me-2 text-primary"></i>
                Documentos de la consulta
              </span>
              <button onClick={() => setModalDocs(null)} style={{
                background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#6b7280",
              }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: 20, flex: 1 }}>
              {modalDocs.docs.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                  <i className="bi bi-paperclip" style={{ fontSize: "2rem", display: "block", marginBottom: 8, opacity: 0.3 }}></i>
                  No hay documentos adjuntos en esta consulta.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
                  {modalDocs.docs.map(d => {
                    const esImg = d.mime_type?.startsWith("image/");
                    return (
                      <a key={d.id} href={d.ruta_archivo} target="_blank" rel="noreferrer"
                        style={{ textDecoration: "none", color: "inherit" }}>
                        <div style={{
                          border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden",
                          boxShadow: "0 1px 4px rgba(0,0,0,.05)", transition: "box-shadow .15s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = "0 3px 12px rgba(0,0,0,.12)"}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.05)"}>
                          <div style={{ height: 100, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                            {esImg
                              ? <img src={d.ruta_archivo} alt={d.nombre_original}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <i className="bi bi-file-earmark-pdf" style={{ fontSize: "2.2rem", color: "#ef4444" }}></i>
                            }
                          </div>
                          <div style={{ padding: "7px 9px", background: "#fff" }}>
                            <div style={{ fontSize: "0.74rem", fontWeight: 600, color: "#374151",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {d.nombre_original}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "#9ca3af", marginTop: 2 }}>
                              {d.tipo} · {d.tamano_bytes ? `${(d.tamano_bytes/1024).toFixed(0)} KB` : ""}
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Modal foto grande */}
      {modalFoto && (
        <div
          onClick={() => setModalFoto(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            cursor: "pointer",
          }}
        >
          <img
            src={modalFoto}
            alt="Foto del paciente"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
          />
        </div>
      )}
      </div>
    </div>
  );
}

// ── Modal: crear cita y lanzar consulta ──────────────────────────────────────
function ModalConsultaSinCita({ paciente, onClose, onCreated }) {
  const [modo, setModo] = useState(null);
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

  useEffect(() => {
    if (!medicoId || !fechaSel) { setSlots([]); return; }
    api.get("/citas/slots", { params: { medico_id: medicoId, fecha: fechaSel } })
      .then(r => setSlots(r.data.data || []))
      .catch(() => setSlots([]));
  }, [medicoId, fechaSel]);

  const selSlot = (s) => {
    setSlotSel(s.inicio);
    setHoraInicio(dayjs(s.inicio).format("HH:mm"));
    setHoraFin(dayjs(s.fin).format("HH:mm"));
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

  return createPortal(
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 99999 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: modo === "seleccionar" ? 600 : 500 }}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: "#673ab7", color: "#fff" }}>
            <h5 className="modal-title">
              <i className="bi bi-clipboard2-pulse me-2"></i>Nueva Consulta
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="alert alert-warning py-2 mb-3">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>{paciente.nombres} {paciente.apellidos}</strong> no tiene consulta agendada para hoy.
            </div>
            {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}

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

            {modo === "ahora" && (
              <div>
                <p className="text-muted small mb-2">
                  Se creará una cita para <strong>ahora ({dayjs().format("h:mm A")})</strong> con duración de 30 minutos.
                </p>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médico</label>
                  <select className="form-select" value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>{nombreMedico(m, { conEspecialidad: true })}</option>
                    ))}
                  </select>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                      {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => <option key={t}>{t}</option>)}
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

            {modo === "seleccionar" && (
              <div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médico</label>
                  <select className="form-select" value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>{nombreMedico(m, { conEspecialidad: true })}</option>
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
                    <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                      {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => <option key={t}>{t}</option>)}
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
    </div>,
    document.body
  );
}
