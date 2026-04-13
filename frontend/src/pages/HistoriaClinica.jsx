/**
 * FASE 4 — Historia Clínica Electrónica — Timeline del paciente
 * URL: /historia/:paciente_id
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";
import AntecedentesClinico from "../components/AntecedentesClinico";

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

  // ── cargar datos cuando se selecciona paciente ────────────────────────────
  useEffect(() => {
    if (!selPacId) { setLoading(false); return; }
    setLoading(true);

    Promise.all([
      api.get(`/pacientes/${selPacId}`),
      api.get(`/historias`, { params: { paciente_id: selPacId } }),
      api.get(`/historias/paciente/${selPacId}/alergias`),
    ])
    .then(([p, h, al]) => {
      setPaciente(p.data.data || null);
      setHistorias(h.data.data || []);
      setAlergias(al.data.data || []);
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
    .firma-box .linea { width: 200px; border-top: 1px solid #333; margin: 0 auto 4px; }
    .firma-box p { font-size: 12px; color: #444; }
    @media print { body { padding: 12px 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Historia Clínica Electrónica</h1>
      <p>Dr. ${det.med_nombres} ${det.med_apellidos}${det.especialidad ? ` — ${det.especialidad}` : ""}</p>
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
      <div class="linea"></div>
      <p>Dr. ${det.med_nombres} ${det.med_apellidos}</p>
      ${det.especialidad ? `<p>${det.especialidad}</p>` : ""}
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
    <div className="container-fluid py-3" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="fw-bold mb-0">Historia Clínica Electrónica</h4>
        {selPacId && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setConsultaPaciente(paciente); setShowConsultaModal(true); }}>
            + Nueva Consulta
          </button>
        )}
      </div>

      {/* Búsqueda de paciente (si no viene de URL) */}
      {!paciente_id && !selPacId && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 14, overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          marginBottom: 24,
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
                          setSearch(`${p.apellidos}, ${p.nombres}`); 
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
        <div className="text-center py-5 text-muted">
          <div className="spinner-border spinner-border-sm me-2" />Cargando…
        </div>
      )}

      {!loading && !paciente && selPacId && (
        <div className="alert alert-warning">Paciente no encontrado.</div>
      )}

      {!loading && !selPacId && !paciente_id && (
        <div className="text-muted text-center py-5">Busca un paciente para ver su historia clínica.</div>
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
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <div className="row align-items-start">
                <div className="col-auto">
                  <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold"
                    style={{ width: 56, height: 56, fontSize: "1.3rem" }}>
                    {paciente.nombres?.[0]}{paciente.apellidos?.[0]}
                  </div>
                </div>
                <div className="col">
                  <h5 className="mb-1">{paciente.apellidos}, {paciente.nombres}</h5>
                  <div className="d-flex flex-wrap gap-3 text-muted small">
                    {paciente.dni && <span>DNI: {paciente.dni}</span>}
                    {paciente.fecha_nacimiento && <span>{dayjs(paciente.fecha_nacimiento).format("DD/MM/YYYY")} — {edad}</span>}
                    {paciente.sexo && <span>Sexo: {paciente.sexo}</span>}
                    {paciente.telefono && <span>📞 {paciente.telefono}</span>}
                    {paciente.email && <span>✉ {paciente.email}</span>}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── Pestañas ─────────────────────────────────────────────── */}
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTabHist === "historial" ? "active" : ""}`}
                onClick={() => setActiveTabHist("historial")}
              >
                <i className="bi bi-clock-history me-1"></i>
                Historial de Consultas
                <span className="badge bg-secondary ms-1" style={{ fontSize: "0.7rem" }}>{historias.length}</span>
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTabHist === "alergias" ? "active" : ""}`}
                onClick={() => setActiveTabHist("alergias")}
              >
                <i className="bi bi-heart-pulse me-1"></i>
                Alergias y Antecedentes
              </button>
            </li>
          </ul>

          {/* ── Tab 1: Alergias y Antecedentes ───────────────────────── */}
          {activeTabHist === "alergias" && (
            <AntecedentesClinico
              pacienteId={selPacId || paciente_id}
              sexo={paciente?.sexo}
            />
          )}

          {/* ── Tab 2: Historial de Consultas ────────────────────────── */}
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
              <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                <small className="text-muted fw-semibold">Filtrar por fecha:</small>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 150 }}
                  value={filtroDesde}
                  onChange={e => setFiltroDesde(e.target.value)}
                  placeholder="Desde"
                />
                <span className="text-muted small">—</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 150 }}
                  value={filtroHasta}
                  onChange={e => setFiltroHasta(e.target.value)}
                  placeholder="Hasta"
                />
                {(filtroDesde || filtroHasta) && (
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => { setFiltroDesde(""); setFiltroHasta(""); }}
                  >
                    <i className="bi bi-x-circle me-1"></i>Limpiar
                  </button>
                )}
                <small className="text-muted ms-auto">
                  {historiasFiltradas.length} de {historias.length} consulta{historias.length !== 1 ? "s" : ""}
                </small>
              </div>

              {historias.length === 0 && (
                <div className="text-center py-4 text-muted">
                  No hay consultas registradas.
                  <br />
                  <Link to={`/consulta?paciente_id=${paciente.id}`} className="btn btn-outline-primary btn-sm mt-2">
                    Abrir primera consulta
                  </Link>
                </div>
              )}

              {historias.length > 0 && historiasFiltradas.length === 0 && (
                <div className="alert alert-warning py-2">
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
                  <div className="card border-0 shadow-sm flex-grow-1 mb-2">
                    <div className="card-body py-2">
                      <div className="d-flex justify-content-between align-items-start flex-wrap gap-1">
                        <div>
                          <span className={`badge bg-${ESTADO_BADGE[h.estado]?.split(" ")[0]} ${ESTADO_BADGE[h.estado]?.split(" ")[1] || ""} me-2`}>
                            {h.estado}
                          </span>
                          <strong className="small">Dr. {h.med_nombres} {h.med_apellidos}</strong>
                          {h.especialidad && <span className="text-muted small ms-1">({h.especialidad})</span>}
                        </div>
                        <small className="text-muted">{dayjs(h.creado_en).format("DD/MM/YYYY HH:mm")}</small>
                      </div>

                      {h.diagnostico_cie && (
                        <div className="small mt-1">
                          <span className="badge bg-light text-dark border me-1">CIE: {h.diagnostico_cie}</span>
                          {h.plan && <span className="text-muted">{h.plan.substring(0, 80)}{h.plan.length > 80 ? "…" : ""}</span>}
                        </div>
                      )}
                      {h.subjetivo && !h.diagnostico_cie && (
                        <div className="small text-muted mt-1">
                          {h.subjetivo.substring(0, 100)}{h.subjetivo.length > 100 ? "…" : ""}
                        </div>
                      )}

                      {/* Signos vitales resumidos */}
                      {(vitals.pa || vitals.fc || vitals.temp) && (
                        <div className="d-flex flex-wrap gap-2 mt-1">
                          {vitals.pa    && <small className="text-muted">P.A. {vitals.pa} mmHg</small>}
                          {vitals.fc    && <small className="text-muted">· FC {vitals.fc} bpm</small>}
                          {vitals.temp  && <small className="text-muted">· T {vitals.temp}°C</small>}
                          {vitals.peso  && <small className="text-muted">· Peso {vitals.peso} kg</small>}
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="d-flex gap-2 mt-2 flex-wrap">
                        <button className="btn btn-outline-secondary btn-sm"
                          onClick={() => toggleExpand(h.id)}>
                          {expanded ? "Ocultar detalle" : "Ver detalle"}
                        </button>
                        {h.estado === "BORRADOR" && (
                          <Link to={`/consulta-medica?historia_id=${h.id}`} className="btn btn-outline-primary btn-sm">
                            ✏ Editar
                          </Link>
                        )}
                        {h.estado === "FIRMADA" && (
                          <Link to={`/consulta-medica?historia_id=${h.id}`} className="btn btn-link btn-sm p-0">
                            Ver completa
                          </Link>
                        )}
                        <button
                          className="btn btn-outline-secondary btn-sm ms-auto"
                          title="Imprimir consulta"
                          onClick={() => imprimirConsulta(h)}
                        >
                          <i className="bi bi-printer me-1"></i>Imprimir
                        </button>
                      </div>

                      {/* Detalle expandido */}
                      {expanded && det && (
                        <div className="border-top mt-2 pt-2">
                          {/* Prescripciones */}
                          {det.prescripciones?.length > 0 && (
                            <div className="mb-2">
                              <div className="small fw-semibold mb-1">💊 Prescripción(es):</div>
                              {det.prescripciones.map(p => (
                                <div key={p.id} className="small text-muted ps-2 mb-1">
                                  <div className="d-flex align-items-center gap-2 mb-1">
                                    <span>Receta #{p.id}</span>
                                    <span className="badge bg-secondary">{p.estado}</span>
                                    <button className="btn btn-outline-primary btn-sm py-0 px-1"
                                      style={{ fontSize: "0.72rem" }}
                                      onClick={() => printRx(p.id)}>
                                      <i className="bi bi-printer me-1"></i>PDF
                                    </button>
                                  </div>
                                  {p.items?.filter(Boolean).map((it, i) => (
                                    <div key={i} className="ps-2">• {it.medicamento_nombre || it.medicamento_texto}{it.dosis ? ` — ${it.dosis}` : ""}</div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Estudios */}
                          {det.estudios?.length > 0 && (
                            <div className="mb-2">
                              <div className="small fw-semibold mb-1">🧪 Estudios solicitados:</div>
                              {det.estudios.map(s => (
                                <div key={s.id} className="small text-muted ps-2">
                                  [{s.tipo}] {s.descripcion} — {s.estado}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Plan completo */}
                          {det.plan && (
                            <div>
                              <div className="small fw-semibold mb-1">Plan:</div>
                              <div className="small text-muted" style={{ whiteSpace: "pre-wrap" }}>{det.plan}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {expanded && !det && (
                        <div className="mt-2 text-muted small">Cargando detalle…</div>
                      )}
                    </div>
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

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 9998 }}>
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
              <strong>{paciente.apellidos}, {paciente.nombres}</strong> no tiene consulta agendada para hoy.
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
                      <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
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
    </div>
  );
}
