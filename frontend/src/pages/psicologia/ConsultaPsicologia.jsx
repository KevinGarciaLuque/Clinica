import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import AnalisisPsicologia from "./AnalisisPsicologia";
import { ESCALAS_DEF, categoriaEdad, getItemsDef, ETIQUETA_CATEGORIA, COLOR_CATEGORIA } from "./escalas_def";
import ModalConsultaSinCita from "../../components/ModalConsultaSinCita";

// ── Diagnósticos psicológicos frecuentes (CIE-10 capítulo F) ─────────────────
const DX_RAPIDOS = [
  { grupo: "Depresión", color: "#6d28d9", items: [
    { c: "F32.0", d: "Episodio depresivo leve" },
    { c: "F32.1", d: "Episodio depresivo moderado" },
    { c: "F32.2", d: "Episodio depresivo grave sin síntomas psicóticos" },
    { c: "F33.1", d: "Trastorno depresivo recurrente, episodio moderado" },
    { c: "F33.2", d: "Trastorno depresivo recurrente, episodio grave" },
  ]},
  { grupo: "Ansiedad", color: "#0284c7", items: [
    { c: "F41.0", d: "Trastorno de pánico" },
    { c: "F41.1", d: "Trastorno de ansiedad generalizada" },
    { c: "F41.2", d: "Trastorno mixto ansioso-depresivo" },
    { c: "F40.0", d: "Agorafobia" },
    { c: "F40.1", d: "Fobias sociales" },
    { c: "F42",   d: "Trastorno obsesivo-compulsivo" },
  ]},
  { grupo: "Trauma / Adaptación", color: "#b45309", items: [
    { c: "F43.0", d: "Reacción aguda al estrés" },
    { c: "F43.1", d: "Trastorno de estrés postraumático" },
    { c: "F43.2", d: "Trastorno de adaptación" },
  ]},
  { grupo: "Conducta alimentaria", color: "#059669", items: [
    { c: "F50.0", d: "Anorexia nerviosa" },
    { c: "F50.2", d: "Bulimia nerviosa" },
  ]},
  { grupo: "Personalidad", color: "#dc2626", items: [
    { c: "F60.3", d: "Trastorno de personalidad emocionalmente inestable (límite)" },
    { c: "F60.0", d: "Trastorno paranoide de la personalidad" },
    { c: "F60.2", d: "Trastorno disocial de la personalidad" },
  ]},
  { grupo: "Infanto-juvenil", color: "#7c3aed", items: [
    { c: "F90.0", d: "Trastorno de la actividad y la atención (TDAH)" },
    { c: "F91.1", d: "Trastorno de conducta desafiante" },
    { c: "F84.0", d: "Autismo infantil" },
    { c: "F93.0", d: "Trastorno de ansiedad por separación" },
  ]},
  { grupo: "Psicosis / Bipolar", color: "#9333ea", items: [
    { c: "F20.0", d: "Esquizofrenia paranoide" },
    { c: "F31.1", d: "Trastorno bipolar, episodio maníaco moderado" },
    { c: "F31.3", d: "Trastorno bipolar, episodio depresivo leve o moderado" },
  ]},
  { grupo: "Sustancias", color: "#d97706", items: [
    { c: "F10.1", d: "Uso perjudicial del alcohol" },
    { c: "F10.2", d: "Síndrome de dependencia del alcohol" },
    { c: "F19.1", d: "Uso perjudicial de múltiples sustancias" },
  ]},
];

// ── Buscador CIE-10 con accesos rápidos para psicología ──────────────────────
function BuscadorCIE10Psico({ value, desc, onChange, onClear, readOnly }) {
  const [q, setQ]           = useState("");
  const [lista, setLista]   = useState([]);
  const [open, setOpen]     = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) { setLista([]); setOpen(false); } };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (!q || q.length < 2) { setLista([]); return; }
    const t = setTimeout(() => {
      api.get("/historias/cie10/buscar", { params: { q } })
        .then(r => setLista(r.data.data || []))
        .catch(() => setLista([]));
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const sel = (codigo, descripcion) => {
    onChange(codigo, descripcion);
    setQ(""); setLista([]); setOpen(false);
  };

  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, background: "rgba(109,40,217,.07)", border: "1px solid rgba(109,40,217,.25)", minHeight: 38 }}>
        <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#6d28d9", fontSize: "0.85rem", flexShrink: 0 }}>{value}</span>
        <span style={{ fontSize: "0.82rem", color: "#374151", flex: 1, fontWeight: 500 }}>{desc}</span>
        {!readOnly && (
          <button type="button" onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 0, lineHeight: 1 }}>
            <i className="bi bi-x-circle-fill" style={{ fontSize: 15 }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <i className="bi bi-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 13 }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Buscar por código o descripción (ej: F32, depresión…)"
            autoComplete="off"
            style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: "0.88rem", outline: "none", background: "#fafafa", boxSizing: "border-box" }}
          />
        </div>
        <button type="button" onClick={() => setOpen(o => !o)}
          style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid #d1d5db", background: open ? "#f3f4f6" : "#fafafa", cursor: "pointer", fontSize: "0.78rem", color: "#6d28d9", fontWeight: 600, whiteSpace: "nowrap" }}>
          <i className="bi bi-lightning-fill me-1" style={{ color: "#f59e0b" }} />Frecuentes
        </button>
      </div>

      {/* Dropdown búsqueda API */}
      {lista.length > 0 && (
        <ul style={{ position: "absolute", zIndex: 9999, left: 0, right: 0, top: "100%", background: "#fff", border: "1px solid #ede9fe", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxHeight: 240, overflowY: "auto", margin: "4px 0 0", padding: 0, listStyle: "none" }}>
          {lista.map(c => (
            <li key={c.codigo} onMouseDown={() => sel(c.codigo, c.descripcion)}
              style={{ padding: "8px 14px", cursor: "pointer", fontSize: "0.82rem", borderBottom: "1px solid #f3f4f6", display: "flex", gap: 10, alignItems: "baseline" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8f5ff"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#6d28d9", flexShrink: 0 }}>{c.codigo}</span>
              <span style={{ color: "#374151" }}>{c.descripcion}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Panel de accesos rápidos */}
      {open && lista.length === 0 && (
        <div style={{ position: "absolute", zIndex: 9999, left: 0, right: 0, top: "100%", background: "#fff", border: "1px solid #ede9fe", borderRadius: 12, boxShadow: "0 8px 28px rgba(0,0,0,.13)", maxHeight: 340, overflowY: "auto", margin: "4px 0 0", padding: "10px 12px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>
            <i className="bi bi-lightning-fill me-1" style={{ color: "#f59e0b" }} />Diagnósticos frecuentes en psicología
          </div>
          {DX_RAPIDOS.map(grupo => (
            <div key={grupo.grupo} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: grupo.color, marginBottom: 4 }}>{grupo.grupo}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {grupo.items.map(it => (
                  <button key={it.c} type="button" onMouseDown={() => sel(it.c, it.d)}
                    style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${grupo.color}40`, background: `${grupo.color}10`, cursor: "pointer", fontSize: "0.75rem", color: grupo.color, fontWeight: 600, display: "flex", gap: 5, alignItems: "center" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{it.c}</span>
                    <span style={{ fontWeight: 400, color: "#374151", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.d}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MODALIDADES = ["INDIVIDUAL", "PAREJA", "FAMILIA", "GRUPO"];
const ENFOQUES    = ["Cognitivo-Conductual (TCC)", "Sistémico", "Psicoanalítico / Psicodinámico",
                     "Humanista / Centrado en la Persona", "EMDR", "Mindfulness", "Integrativo", "Otro"];
const FRECUENCIAS = ["Semanal", "Quincenal", "Mensual", "Según necesidad"];
const ESTADO_MENTAL_CAMPOS = [
  { key: "orientacion", label: "Orientación" },
  { key: "afecto",      label: "Afecto" },
  { key: "pensamiento", label: "Pensamiento" },
  { key: "percepcion",  label: "Percepción" },
  { key: "conducta",    label: "Conducta" },
  { key: "juicio",      label: "Juicio" },
  { key: "memoria",     label: "Memoria" },
];


const PURPLE       = "#6d28d9";
const PURPLE_LIGHT = "rgba(109,40,217,.08)";

const card = {
  background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
  boxShadow: "0 2px 8px rgba(0,0,0,.05)", padding: "16px 18px", marginBottom: 16,
};

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 9,
  border: "1px solid #d1d5db", fontSize: "0.88rem",
  outline: "none", background: "#fafafa", transition: "border .15s",
  boxSizing: "border-box",
};

const btn = (color = PURPLE, ghost = false) => ({
  background: ghost ? "transparent" : color,
  color: ghost ? color : "#fff",
  border: `1px solid ${color}`,
  borderRadius: 9, padding: "8px 16px",
  fontSize: "0.83rem", fontWeight: 600,
  cursor: "pointer", display: "inline-flex",
  alignItems: "center", gap: 6,
  whiteSpace: "nowrap",
});

// ── Impresión ─────────────────────────────────────────────────────────────────
const parseDASS21Print = (interp) => {
  const m = (interp || "").match(/D:(\d+)\(.*?\) A:(\d+)\(.*?\) E:(\d+)/);
  return m ? { D: Number(m[1]), A: Number(m[2]), E: Number(m[3]) } : null;
};

const printScoreColor = (tipo, p) => {
  if (tipo === "BDIII" || tipo === "BAI")
    return p <= 7 ? "#10b981" : p <= 15 ? "#f59e0b" : p <= 25 ? "#f97316" : "#ef4444";
  if (tipo === "AUDIT")
    return p <= 7 ? "#10b981" : p <= 15 ? "#f59e0b" : p <= 19 ? "#f97316" : "#ef4444";
  if (tipo === "CDI")
    return p <= 12 ? "#10b981" : p <= 19 ? "#f59e0b" : p <= 26 ? "#f97316" : "#ef4444";
  if (tipo === "SCARED")
    return p <= 24 ? "#10b981" : p <= 44 ? "#f97316" : "#ef4444";
  return p <= 4 ? "#10b981" : p <= 9 ? "#f59e0b" : p <= 14 ? "#f97316" : "#ef4444";
};

function PrintSesion({ sesion, paciente, escalas, user, onClose }) {
  const escalasSession = (escalas || []).filter(e => String(e.sesion_id) === String(sesion.id));
  const em = sesion.estado_mental || {};
  const ESTADO_LABELS = { orientacion:"Orientación", afecto:"Afecto", pensamiento:"Pensamiento", percepcion:"Percepción", conducta:"Conducta", juicio:"Juicio", memoria:"Memoria" };

  const S = {
    sectionTitle: { fontSize:11, fontWeight:700, color:"#6d28d9", textTransform:"uppercase", letterSpacing:".07em", borderBottom:"1.5px solid #ede9fe", paddingBottom:4, margin:"16px 0 8px" },
    fieldRow: { display:"flex", gap:20, marginBottom:6, alignItems:"baseline" },
    label: { fontWeight:700, color:"#374151", minWidth:140, fontSize:12, flexShrink:0 },
    value: { color:"#1f2937", fontSize:12, flex:1, whiteSpace:"pre-wrap" },
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #psico-print-doc, #psico-print-doc * { visibility: visible !important; }
          #psico-print-doc { position:fixed!important; top:0!important; left:0!important; width:100%!important; padding:14mm 18mm!important; box-shadow:none!important; background:white!important; }
          #print-actions-bar { display:none!important; }
          @page { margin:0; size:A4; }
        }
      `}</style>
      <div id="print-actions-bar" style={{ background:"#f8f7ff", borderBottom:"1px solid #ede9fe", padding:"12px 24px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <button onClick={() => window.print()} style={{ padding:"9px 22px", background:PURPLE, color:"#fff", border:"none", borderRadius:9, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:7, fontSize:14 }}>
          <i className="bi bi-printer-fill" /> Imprimir / Guardar PDF
        </button>
        <button onClick={onClose} style={{ padding:"9px 22px", background:"#fff", color:"#374151", border:"1px solid #d1d5db", borderRadius:9, fontWeight:600, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", gap:7 }}>
          <i className="bi bi-x-lg" /> Cerrar
        </button>
        <span style={{ marginLeft:"auto", fontSize:12, color:"#7c6f9f" }}>Vista previa — Sesión #{sesion.numero_sesion}</span>
      </div>
      <div style={{ background:"#e8e8e8", minHeight:"calc(100vh - 60px)", padding:"24px 16px", overflowY:"auto", display:"flex", justifyContent:"center" }}>
        <div id="psico-print-doc" style={{ background:"white", width:"100%", maxWidth:"210mm", minHeight:"297mm", padding:"18mm 20mm", boxShadow:"0 4px 32px rgba(0,0,0,.18)", fontFamily:"Arial, sans-serif", color:"#1a1a2e", boxSizing:"border-box", alignSelf:"flex-start" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", borderBottom:"2.5px solid #6d28d9", paddingBottom:12, marginBottom:18, flexWrap:"wrap", gap:8 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:"#6d28d9" }}>{user?.clinica_nombre || "Clínica Psicológica"}</div>
              <div style={{ fontSize:10, color:"#7c6f9f", marginTop:3 }}>Sistema de Gestión Clínica · Medic-KG</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#1e1b4b" }}>NOTA DE SESIÓN PSICOLÓGICA</div>
              <div style={{ fontSize:10, color:"#6b7280", marginTop:4 }}>
                Fecha: <strong>{dayjs(sesion.creado_en).format("DD/MM/YYYY")}</strong> · Hora: <strong>{dayjs(sesion.creado_en).format("HH:mm")}</strong>
              </div>
            </div>
          </div>
          <div style={S.sectionTitle}>Datos del Paciente</div>
          <div style={S.fieldRow}>
            <span style={S.label}>Nombre:</span>
            <span style={{ ...S.value, fontWeight:600 }}>{paciente?.nombres} {paciente?.apellidos}</span>
            <span style={S.label}>Edad:</span>
            <span style={S.value}>{paciente?.fecha_nacimiento ? `${dayjs().diff(paciente.fecha_nacimiento, "year")} años` : "—"}</span>
          </div>
          <div style={S.fieldRow}>
            <span style={S.label}>N.º Sesión:</span>
            <span style={{ ...S.value, fontWeight:700, color:"#6d28d9" }}>#{sesion.numero_sesion}</span>
            <span style={S.label}>Modalidad:</span>
            <span style={S.value}>{sesion.modalidad}</span>
            <span style={S.label}>Estado:</span>
            <span style={{ ...S.value, fontWeight:700, color: sesion.estado==="FIRMADA" ? "#166534" : "#92400e" }}>{sesion.estado}</span>
          </div>
          {sesion.psicologo_nombre && <div style={S.fieldRow}><span style={S.label}>Psicólogo/a:</span><span style={S.value}>{sesion.psicologo_nombre}</span></div>}
          {sesion.motivo_consulta && (<><div style={S.sectionTitle}>Motivo de Consulta / Demanda</div><p style={{ ...S.value, margin:0 }}>{sesion.motivo_consulta}</p></>)}
          {Object.values(em).some(v => v) && (<>
            <div style={S.sectionTitle}>Examen del Estado Mental</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:6 }}>
              {Object.entries(ESTADO_LABELS).map(([k, lbl]) => em[k] ? (
                <div key={k} style={{ background:"#f8f5ff", border:"1px solid #ede9fe", borderRadius:6, padding:"6px 10px" }}>
                  <div style={{ fontSize:9, color:"#6d28d9", fontWeight:700 }}>{lbl}</div>
                  <div style={{ fontSize:11, color:"#1e1b4b", marginTop:2 }}>{em[k]}</div>
                </div>
              ) : null)}
            </div>
          </>)}
          {(sesion.diagnostico_cie || sesion.diagnostico_desc) && (<>
            <div style={S.sectionTitle}>Diagnóstico</div>
            {sesion.diagnostico_cie && (
              <div style={{ ...S.fieldRow, marginBottom: sesion.diagnostico_desc ? 2 : 6 }}>
                <span style={S.label}>CIE-10 / DSM-5:</span>
                <span style={{ ...S.value, fontWeight: 700, fontFamily: "monospace", color: "#6d28d9" }}>{sesion.diagnostico_cie}</span>
              </div>
            )}
            {sesion.diagnostico_desc && (
              <div style={{ ...S.fieldRow, alignItems: "flex-start" }}>
                <span style={S.label}>Descripción:</span>
                <span style={{ ...S.value, whiteSpace: "pre-wrap" }}>{sesion.diagnostico_desc}</span>
              </div>
            )}
          </>)}
          {sesion.intervenciones && (<><div style={S.sectionTitle}>Intervenciones Realizadas</div><p style={{ ...S.value, margin:0 }}>{sesion.intervenciones}</p></>)}
          {sesion.tarea_proxima && (<><div style={S.sectionTitle}>Tarea / Acuerdo para Próxima Sesión</div><p style={{ ...S.value, margin:0 }}>{sesion.tarea_proxima}</p></>)}
          {sesion.observaciones && (<><div style={S.sectionTitle}>Observaciones Generales</div><p style={{ ...S.value, margin:0 }}>{sesion.observaciones}</p></>)}
          {escalasSession.length > 0 && (<>
            <div style={S.sectionTitle}>Escalas Aplicadas en esta Sesión</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {escalasSession.map(e => {
                const def = ESCALAS_DEF[e.tipo_escala];
                const nombre = def?.nombre || e.tipo_escala;
                // DASS-21: mostrar los 3 subscores
                if (e.tipo_escala === "DASS21") {
                  const sub = parseDASS21Print(e.interpretacion);
                  const cols = { D: "#8b5cf6", A: "#06b6d4", E: "#f59e0b" };
                  return (
                    <div key={e.id} style={{ padding:"10px 16px", borderRadius:8, border:"1.5px solid #ede9fe", background:"#f8f5ff", minWidth:200 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#1e1b4b", marginBottom:6 }}>{nombre}</div>
                      {sub ? (
                        <div style={{ display:"flex", gap:14 }}>
                          {[["Dep.", sub.D, cols.D],["Ans.", sub.A, cols.A],["Est.", sub.E, cols.E]].map(([lbl, val, c]) => (
                            <div key={lbl} style={{ textAlign:"center" }}>
                              <div style={{ fontSize:18, fontWeight:800, color:c, lineHeight:1 }}>{val}</div>
                              <div style={{ fontSize:9, color:c, marginTop:2 }}>{lbl}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize:10, color:"#6b7280" }}>{e.interpretacion}</div>
                      )}
                      <div style={{ fontSize:9, color:"#9ca3af", marginTop:6 }}>{dayjs(e.aplicado_en).format("DD/MM/YYYY")}</div>
                    </div>
                  );
                }
                // Escalas de registro (sin puntaje continuo)
                if (def?.tipo === "registro") {
                  const r = typeof e.respuestas === "string" ? JSON.parse(e.respuestas || "{}") : (e.respuestas || {});
                  const campos = Object.entries(r).slice(0, 5);
                  return (
                    <div key={e.id} style={{ padding:"10px 16px", borderRadius:8, border:"1.5px solid #ede9fe", background:"#f8f5ff", minWidth:200, maxWidth:300 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#1e1b4b", marginBottom:5 }}>{nombre}</div>
                      {campos.map(([k, v]) => (
                        <div key={k} style={{ fontSize:10, color:"#374151", display:"flex", gap:6, marginBottom:2 }}>
                          <span style={{ color:"#9ca3af", textTransform:"capitalize", flexShrink:0 }}>{k.replace(/_/g," ")}:</span>
                          <span style={{ fontWeight:600 }}>{String(v)}</span>
                        </div>
                      ))}
                      {e.interpretacion && <div style={{ fontSize:10, color:"#6d28d9", fontWeight:600, marginTop:4 }}>{e.interpretacion}</div>}
                      <div style={{ fontSize:9, color:"#9ca3af", marginTop:4 }}>{dayjs(e.aplicado_en).format("DD/MM/YYYY")}</div>
                    </div>
                  );
                }
                // Escalas cuantitativas estándar
                const col = printScoreColor(e.tipo_escala, e.puntaje_total);
                return (
                  <div key={e.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", borderRadius:8, border:`1.5px solid ${col}40`, background:`${col}10` }}>
                    <div style={{ fontSize:24, fontWeight:800, color:col, lineHeight:1 }}>{e.puntaje_total}</div>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:"#1e1b4b" }}>{nombre}</div>
                      <div style={{ fontSize:10, color:"#6b7280" }}>{e.interpretacion}</div>
                      <div style={{ fontSize:9, color:"#9ca3af" }}>{dayjs(e.aplicado_en).format("DD/MM/YYYY")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>)}
          <div style={{ marginTop:48, display:"flex", justifyContent:"flex-end" }}>
            <div style={{ textAlign:"center", minWidth:220 }}>
              {user?.firma_url ? <img src={user.firma_url} alt="Firma" style={{ maxHeight:70, maxWidth:200, objectFit:"contain", display:"block", margin:"0 auto 4px" }} /> : <div style={{ height:70 }} />}
              <div style={{ borderTop:"1.5px solid #374151", paddingTop:8 }}>
                <div style={{ fontWeight:700, fontSize:12 }}>{sesion.psicologo_nombre || "Psicólogo/a Tratante"}</div>
                {user?.numero_colegiatura && <div style={{ color:"#6b7280", fontSize:10, marginTop:1 }}>Colegiatura: {user.numero_colegiatura}</div>}
                <div style={{ color:"#6b7280", fontSize:10, marginTop:1 }}>Firma y Sello</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop:32, paddingTop:10, borderTop:"1px solid #e5e7eb", textAlign:"center", fontSize:9, color:"#9ca3af" }}>
            Generado el {dayjs().format("DD/MM/YYYY [a las] HH:mm")} — Sistema Medic-KG
          </div>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ConsultaPsicologia() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params]  = useSearchParams();

  const [tab, setTab]             = useState("sesion");
  const [pacientes, setPacientes] = useState([]);
  const [paciente, setPaciente]   = useState(null);
  const [busqueda, setBusqueda]   = useState("");
  const [sesiones, setSesiones]   = useState([]);
  const [sesionActiva, setSesionActiva] = useState(null);
  const [historia, setHistoria]   = useState(null);
  const [plan, setPlan]           = useState(null);
  const [escalas, setEscalas]     = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg]             = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalNueva, setModalNueva]   = useState(false);

  const [formSesion, setFormSesion] = useState({
    modalidad: "INDIVIDUAL", motivo_consulta: "",
    estado_mental: {}, diagnostico_cie: "", diagnostico_desc: "",
    intervenciones: "", tarea_proxima: "", observaciones: "",
  });

  const [formHistoria, setFormHistoria] = useState({
    motivo_derivacion: "", demanda_inicial: "", dinamica_familiar: "",
    historia_social: "", historia_laboral: "", nivel_educativo: "",
    estado_civil: "", antecedentes_psiq: "", diagnosticos_previos: "",
    medicacion_actual: "", hospitalizaciones: "",
    intentos_autoliticos: false, ideacion_actual: false,
    eventos_traumaticos: "", redes_apoyo: "",
  });

  const [formPlan, setFormPlan] = useState({
    enfoque: "", frecuencia: "", objetivos: [], progreso_general: 0, notas: "",
  });

  const [escalaActiva, setEscalaActiva]     = useState(null);
  const [respuestasEscala, setRespuestasEscala] = useState([]);
  const [registroEscala, setRegistroEscala] = useState({});
  const [mostrarPrint, setMostrarPrint]     = useState(false);
  const [escalaVer, setEscalaVer]           = useState(null);

  const edadCategoria = useMemo(() => categoriaEdad(paciente?.fecha_nacimiento), [paciente]);
  const escalasDisponibles = useMemo(() =>
    Object.entries(ESCALAS_DEF).filter(([, d]) => d.categorias.includes(edadCategoria)),
  [edadCategoria]);

  useEffect(() => {
    api.get("/pacientes", { params: { limit: 200 } })
      .then(r => setPacientes(r.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const pid = params.get("paciente_id");
    if (pid && pacientes.length) {
      const p = pacientes.find(x => String(x.id) === String(pid));
      if (p) seleccionarPaciente(p, params.get("sesion_id"));
    }
  }, [params, pacientes]);

  useEffect(() => {
    if (params.get("print") === "1" && sesionActiva && sesionActiva !== "nueva") {
      setMostrarPrint(true);
      const t = setTimeout(() => window.print(), 900);
      return () => clearTimeout(t);
    }
  }, [params, sesionActiva]);

  const seleccionarPaciente = useCallback(async (p, sesionIdUrl = null) => {
    setPaciente(p);
    setSesionActiva(null);
    setMsg(null);
    setSidebarOpen(false); // cerrar panel en móvil al seleccionar

    const [s, h, pl, e] = await Promise.all([
      api.get("/psicologia/sesiones", { params: { paciente_id: p.id } }),
      api.get(`/psicologia/historia/${p.id}`),
      api.get(`/psicologia/plan/${p.id}`),
      api.get(`/psicologia/escalas/${p.id}`),
    ]).then(rs => rs.map(r => r.data)).catch(() => [{}, {}, {}, {}]);

    setSesiones(s.data || []);
    setHistoria(h.data || null);
    setPlan(pl.data || null);
    setEscalas(e.data || []);
    if (sesionIdUrl) cargarSesion(sesionIdUrl);
    if (h.data) setFormHistoria(prev => ({ ...prev, ...h.data }));
    if (pl.data) setFormPlan({
      enfoque: pl.data.enfoque || "", frecuencia: pl.data.frecuencia || "",
      objetivos: pl.data.objetivos || [], progreso_general: pl.data.progreso_general || 0,
      notas: pl.data.notas || "",
    });
  }, []);

  const nuevaSesion = () => {
    setSesionActiva("nueva");
    setFormSesion({ modalidad: "INDIVIDUAL", motivo_consulta: "", estado_mental: {}, diagnostico_cie: "", diagnostico_desc: "", intervenciones: "", tarea_proxima: "", observaciones: "" });
    setTab("sesion");
  };

  const cargarSesion = async (id) => {
    const r = await api.get(`/psicologia/sesiones/${id}`);
    const s = r.data.data;
    setSesionActiva(s);
    setFormSesion({
      modalidad: s.modalidad || "INDIVIDUAL", motivo_consulta: s.motivo_consulta || "",
      estado_mental: s.estado_mental || {}, diagnostico_cie: s.diagnostico_cie || "",
      diagnostico_desc: s.diagnostico_desc || "", intervenciones: s.intervenciones || "",
      tarea_proxima: s.tarea_proxima || "", observaciones: s.observaciones || "",
    });
    setTab("sesion");
  };

  const guardarSesion = async () => {
    if (!paciente) return;
    setGuardando(true);
    try {
      if (sesionActiva === "nueva") {
        const r = await api.post("/psicologia/sesiones", { paciente_id: paciente.id, ...formSesion });
        setMsg({ tipo: "ok", texto: `Sesión #${r.data.numero_sesion} guardada` });
      } else {
        await api.put(`/psicologia/sesiones/${sesionActiva.id}`, formSesion);
        setMsg({ tipo: "ok", texto: "Sesión actualizada" });
      }
      await seleccionarPaciente(paciente);
      setSesionActiva(null);
    } catch (e) {
      setMsg({ tipo: "err", texto: e.response?.data?.msg || "Error al guardar" });
    } finally { setGuardando(false); }
  };

  const firmarSesion = async (id) => {
    if (!confirm("¿Firmar sesión? No podrá editarse después.")) return;
    await api.post(`/psicologia/sesiones/${id}/firmar`);
    await seleccionarPaciente(paciente);
    setMsg({ tipo: "ok", texto: "Sesión firmada digitalmente" });
  };

  const guardarHistoria = async () => {
    if (!paciente) return;
    setGuardando(true);
    try { await api.post(`/psicologia/historia/${paciente.id}`, formHistoria); setMsg({ tipo: "ok", texto: "Historia psicológica guardada" }); }
    catch { setMsg({ tipo: "err", texto: "Error al guardar historia" }); }
    finally { setGuardando(false); }
  };

  const guardarPlan = async () => {
    if (!paciente) return;
    setGuardando(true);
    try { await api.post(`/psicologia/plan/${paciente.id}`, formPlan); setMsg({ tipo: "ok", texto: "Plan terapéutico guardado" }); }
    catch { setMsg({ tipo: "err", texto: "Error al guardar plan" }); }
    finally { setGuardando(false); }
  };

  const agregarObjetivo = () => setFormPlan(f => ({
    ...f, objetivos: [...f.objetivos, { objetivo: "", plazo: "corto", cumplido: false }],
  }));

  const aplicarEscala = async () => {
    const def = ESCALAS_DEF[escalaActiva];
    let puntaje, interpretacion, respuestasToSend;
    if (def.tipo === "registro") {
      puntaje        = def.calcPuntaje(registroEscala);
      interpretacion = def.interpretar(registroEscala);
      respuestasToSend = registroEscala;
    } else {
      puntaje        = def.calcPuntaje ? def.calcPuntaje(respuestasEscala) : respuestasEscala.reduce((a, b) => a + (b || 0), 0);
      interpretacion = def.interpretar(respuestasEscala);
      respuestasToSend = respuestasEscala;
    }
    await api.post("/psicologia/escalas", { paciente_id: paciente.id, tipo_escala: escalaActiva, respuestas: respuestasToSend, puntaje_total: puntaje, interpretacion });
    const r = await api.get(`/psicologia/escalas/${paciente.id}`);
    setEscalas(r.data.data || []);
    setEscalaActiva(null); setRespuestasEscala([]); setRegistroEscala({});
    setMsg({ tipo: "ok", texto: `${def.nombre} — ${interpretacion}` });
  };

  const pacientesFiltrados = pacientes.filter(p =>
    `${p.nombres} ${p.apellidos}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (mostrarPrint && sesionActiva && sesionActiva !== "nueva") {
    return <PrintSesion sesion={sesionActiva} paciente={paciente} escalas={escalas} user={user} onClose={() => setMostrarPrint(false)} />;
  }

  return (
    <>
      {/* ── Estilos responsivos ── */}
      <style>{`
        .psico-root {
          display: flex;
          height: 100%;
          position: relative;
        }
        /* Panel lateral desktop */
        .psico-desktop-panel {
          display: flex;
          flex-direction: column;
          width: 260px;
          min-width: 260px;
          flex-shrink: 0;
          border-right: 1px solid rgba(255,255,255,.07);
        }
        /* Panel principal */
        .psico-main {
          flex: 1;
          padding: 16px 20px;
          overflow-y: auto;
          min-width: 0;
          background: #f1f5f9;
        }
        /* Botón abrir sidebar — oculto en desktop */
        .psico-sidebar-toggle {
          display: none;
        }
        /* Tabs */
        .psico-tabs {
          display: flex;
          gap: 2px;
          margin-bottom: 16px;
          border-bottom: 2px solid #ede9fe;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .psico-tabs::-webkit-scrollbar { display: none; }
        .psico-tab-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 10px 14px;
          font-size: 0.83rem;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 5px;
          border-bottom: 3px solid transparent;
          margin-bottom: -2px;
          transition: color .15s;
          flex-shrink: 0;
        }
        /* Grid 2 cols */
        .psico-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 14px;
        }
        /* Grid diagnóstico */
        .psico-grid-diag {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 12px;
          margin-bottom: 14px;
        }
        /* Grid estado mental */
        .psico-grid-mental {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 8px;
        }
        /* Cabecera paciente */
        .psico-paciente-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }
        .psico-paciente-btns {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        /* Fila sesión */
        .psico-sesion-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #faf5ff;
          border: 1px solid #ede9fe;
        }
        .psico-sesion-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        /* Overlay oscuro móvil */
        .psico-overlay {
          display: none;
        }
        /* Indicadores de riesgo */
        .psico-riesgo-checks {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        /* Objetivo row */
        .psico-objetivo-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
          align-items: center;
        }

        /* ── MÓVIL ────────────────────────────────────── */
        @media (max-width: 767px) {
          .psico-root {
            display: block;
          }
          .psico-desktop-panel {
            display: none;
          }
          .psico-sidebar-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 10px 14px;
            background: #112240;
            color: rgba(203,213,225,.9);
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 10px;
            font-size: 0.83rem;
            font-weight: 500;
            cursor: pointer;
            margin-bottom: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,.25);
          }
          .psico-main {
            padding: 12px 14px;
          }
          .psico-grid-2 {
            grid-template-columns: 1fr;
          }
          .psico-grid-diag {
            grid-template-columns: 1fr;
          }
          .psico-grid-mental {
            grid-template-columns: 1fr 1fr;
          }
          .psico-historia-grid {
            grid-template-columns: 1fr !important;
          }
          .psico-tab-btn {
            padding: 9px 10px;
            font-size: 0.78rem;
          }
          .psico-sesion-row {
            flex-wrap: wrap;
          }
          .psico-sesion-actions {
            width: 100%;
            justify-content: flex-end;
          }
          .psico-paciente-btns button {
            font-size: 0.78rem;
            padding: 7px 12px;
          }
          .psico-objetivo-row {
            flex-wrap: wrap;
          }
          .psico-objetivo-row select {
            width: 100% !important;
          }
        }

        @media (max-width: 400px) {
          .psico-grid-mental {
            grid-template-columns: 1fr;
          }
          .psico-tab-btn .psico-tab-label {
            display: none;
          }
          .psico-tab-btn {
            padding: 10px 12px;
            font-size: 16px;
          }
        }
      `}</style>

      {/* ── Drawer móvil (portal → directo en body) ── */}
      {createPortal(
        <>
          {sidebarOpen && (
            <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1055 }} />
          )}
          <div style={{
            position: "fixed", top: 62, left: 0,
            height: "calc(100% - 62px)", width: 260,
            zIndex: 1060,
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform .28s cubic-bezier(.4,0,.2,1)",
          }}>
            <PanelPacientes
              pacientesFiltrados={pacientesFiltrados}
              paciente={paciente}
              busqueda={busqueda}
              setBusqueda={setBusqueda}
              seleccionarPaciente={seleccionarPaciente}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </>,
        document.body
      )}

      <div className="psico-root">

        {/* ── Panel lateral pacientes (solo desktop) ── */}
        <div className="psico-desktop-panel">
          <PanelPacientes
            pacientesFiltrados={pacientesFiltrados}
            paciente={paciente}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            seleccionarPaciente={seleccionarPaciente}
            onClose={null}
          />
        </div>

        {/* ── Panel principal ── */}
        <div className="psico-main">

          {/* Botón abrir sidebar (solo móvil) */}
          <button className="psico-sidebar-toggle" onClick={() => setSidebarOpen(true)}>
            <i className="bi bi-person-hearts" />
            {paciente ? `${paciente.nombres} ${paciente.apellidos}` : "Seleccionar paciente"}
            <i className="bi bi-chevron-down" style={{ marginLeft: "auto" }} />
          </button>

          {!paciente && (
            <div style={{ textAlign: "center", paddingTop: 60, color: "#9ca3af" }}>
              <i className="bi bi-person-hearts" style={{ fontSize: 48, color: "#c4b5fd" }} />
              <p style={{ marginTop: 16, fontSize: "1rem", fontWeight: 500 }}>Selecciona un paciente para comenzar</p>
            </div>
          )}

          {paciente && (<>

            {/* Cabecera paciente */}
            <div style={{ ...card, padding: "14px 16px" }}>
              <div className="psico-paciente-header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg,#6d28d9,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                    {paciente.nombres?.[0]}{paciente.apellidos?.[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "#1e1b4b" }}>{paciente.nombres} {paciente.apellidos}</div>
                    <div style={{ fontSize: "0.75rem", color: "#7c6f9f", marginTop: 2 }}>
                      {paciente.fecha_nacimiento && `${dayjs().diff(paciente.fecha_nacimiento, "year")} años · `}
                      {sesiones.length} sesión{sesiones.length !== 1 ? "es" : ""}
                    </div>
                  </div>
                </div>
                <div className="psico-paciente-btns">
                  {params.get("paciente_id") && (
                    <button onClick={() => navigate(`/pacientes/${paciente.id}/perfil?tab=psicologia`)} style={btn("#6b7280", true)}>
                      <i className="bi bi-arrow-left" /> Volver
                    </button>
                  )}
                  <button onClick={() => setModalNueva(true)} style={btn(PURPLE)}>
                    <i className="bi bi-plus-lg" /> Nueva sesión
                  </button>
                </div>
              </div>
            </div>

            {/* Mensaje feedback */}
            {msg && (
              <div style={{
                padding: "10px 14px", borderRadius: 10, marginBottom: 14, fontSize: "0.84rem", fontWeight: 600,
                background: msg.tipo === "ok" ? "#dcfce7" : "#fee2e2",
                color: msg.tipo === "ok" ? "#166534" : "#991b1b",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <i className={`bi bi-${msg.tipo === "ok" ? "check-circle-fill" : "exclamation-circle-fill"}`} />
                <span style={{ flex: 1 }}>{msg.texto}</span>
                <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "inherit" }}>×</button>
              </div>
            )}

            {/* Tabs */}
            <div className="psico-tabs">
              {[
                { k: "sesion",   label: "Sesión",     icon: "bi-journal-text" },
                { k: "historia", label: "Historia",    icon: "bi-person-lines-fill" },
                { k: "plan",     label: "Plan",        icon: "bi-bullseye" },
                { k: "escalas",  label: "Escalas",     icon: "bi-bar-chart-fill" },
                { k: "analisis", label: "Análisis",    icon: "bi-graph-up-arrow" },
              ].map(t => (
                <button key={t.k} className="psico-tab-btn" onClick={() => setTab(t.k)} style={{
                  fontWeight: tab === t.k ? 700 : 500,
                  color: tab === t.k ? PURPLE : "#6b7280",
                  borderBottom: tab === t.k ? `3px solid ${PURPLE}` : "3px solid transparent",
                }}>
                  <i className={`bi ${t.icon}`} />
                  <span className="psico-tab-label">{t.label}</span>
                </button>
              ))}
            </div>

            {/* ════ TAB SESIÓN ════ */}
            {tab === "sesion" && (<>

              {sesiones.length > 0 && !sesionActiva && (
                <div style={card}>
                  <h6 style={{ fontWeight: 700, color: "#1e1b4b", marginBottom: 14, fontSize: "0.9rem" }}>
                    <i className="bi bi-clock-history me-2" style={{ color: PURPLE }} />Historial de sesiones
                  </h6>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sesiones.map(s => (
                      <div key={s.id} className="psico-sesion-row">
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: s.estado === "FIRMADA" ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>
                          #{s.numero_sesion}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e1b4b" }}>
                            {dayjs(s.creado_en).format("DD/MM/YYYY")} · {s.modalidad}
                          </div>
                          <div style={{ fontSize: "0.73rem", color: "#7c6f9f", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.motivo_consulta?.slice(0, 70) || "Sin motivo registrado"}
                          </div>
                        </div>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: s.estado === "FIRMADA" ? "#dcfce7" : "#fef3c7", color: s.estado === "FIRMADA" ? "#166534" : "#92400e", flexShrink: 0 }}>
                          {s.estado}
                        </span>
                        <div className="psico-sesion-actions">
                          {s.estado !== "FIRMADA" && (
                            <button onClick={() => cargarSesion(s.id)} style={btn(PURPLE, true)}><i className="bi bi-pencil-fill" /></button>
                          )}
                          {s.estado !== "FIRMADA" && (
                            <button onClick={() => firmarSesion(s.id)} style={btn("#10b981")}><i className="bi bi-pen-fill" /> Firmar</button>
                          )}
                          {s.estado === "FIRMADA" && (
                            <button onClick={() => cargarSesion(s.id)} style={btn("#6b7280", true)}><i className="bi bi-eye-fill" /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sesionActiva !== null && (
                <div style={card}>
                  <h6 style={{ fontWeight: 700, color: "#1e1b4b", marginBottom: 16, fontSize: "0.93rem" }}>
                    <i className="bi bi-journal-plus me-2" style={{ color: PURPLE }} />
                    {sesionActiva === "nueva" ? `Sesión #${sesiones.length + 1} — Nueva` : `Sesión #${sesionActiva.numero_sesion} — ${sesionActiva.estado === "FIRMADA" ? "Solo lectura" : "Editar"}`}
                  </h6>

                  {/* Modalidad */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>Modalidad</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {MODALIDADES.map(m => (
                        <button key={m} disabled={sesionActiva?.estado === "FIRMADA"}
                          onClick={() => setFormSesion(f => ({ ...f, modalidad: m }))}
                          style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, background: formSesion.modalidad === m ? PURPLE : "#f3f4f6", color: formSesion.modalidad === m ? "#fff" : "#374151", border: `1px solid ${formSesion.modalidad === m ? PURPLE : "#e5e7eb"}` }}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <FLabel>Motivo de consulta / Demanda</FLabel>
                  <textarea value={formSesion.motivo_consulta} rows={3} disabled={sesionActiva?.estado === "FIRMADA"}
                    onChange={e => setFormSesion(f => ({ ...f, motivo_consulta: e.target.value }))}
                    style={{ ...inputStyle, resize: "vertical", marginBottom: 14 }} placeholder="¿Qué trae al paciente a esta sesión?" />

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Examen del Estado Mental</label>
                    <div className="psico-grid-mental">
                      {ESTADO_MENTAL_CAMPOS.map(c => (
                        <div key={c.key}>
                          <label style={{ fontSize: "0.72rem", color: "#6b7280", display: "block", marginBottom: 3 }}>{c.label}</label>
                          <input value={formSesion.estado_mental?.[c.key] || ""} disabled={sesionActiva?.estado === "FIRMADA"}
                            onChange={e => setFormSesion(f => ({ ...f, estado_mental: { ...f.estado_mental, [c.key]: e.target.value } }))}
                            style={inputStyle} placeholder={`${c.label}…`} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <FLabel>CIE-10 / DSM-5 — Diagnóstico principal</FLabel>
                    <BuscadorCIE10Psico
                      value={formSesion.diagnostico_cie || ""}
                      desc={formSesion.diagnostico_desc || ""}
                      readOnly={sesionActiva?.estado === "FIRMADA"}
                      onChange={(codigo, descripcion) => setFormSesion(f => ({ ...f, diagnostico_cie: codigo, diagnostico_desc: descripcion }))}
                      onClear={() => setFormSesion(f => ({ ...f, diagnostico_cie: "", diagnostico_desc: "" }))}
                    />
                  </div>

                  <FLabel>Intervenciones realizadas en sesión</FLabel>
                  <textarea value={formSesion.intervenciones} rows={3} disabled={sesionActiva?.estado === "FIRMADA"}
                    onChange={e => setFormSesion(f => ({ ...f, intervenciones: e.target.value }))}
                    style={{ ...inputStyle, resize: "vertical", marginBottom: 14 }} placeholder="Técnicas y estrategias aplicadas…" />

                  <FLabel>Tarea / Acuerdo para próxima sesión</FLabel>
                  <textarea value={formSesion.tarea_proxima} rows={2} disabled={sesionActiva?.estado === "FIRMADA"}
                    onChange={e => setFormSesion(f => ({ ...f, tarea_proxima: e.target.value }))}
                    style={{ ...inputStyle, resize: "vertical", marginBottom: 14 }} placeholder="Actividades o reflexiones para casa…" />

                  <FLabel>Observaciones generales</FLabel>
                  <textarea value={formSesion.observaciones} rows={2} disabled={sesionActiva?.estado === "FIRMADA"}
                    onChange={e => setFormSesion(f => ({ ...f, observaciones: e.target.value }))}
                    style={{ ...inputStyle, resize: "vertical", marginBottom: 18 }} />

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {sesionActiva?.estado !== "FIRMADA" && (<>
                      <button onClick={guardarSesion} disabled={guardando} style={btn(PURPLE)}>
                        <i className="bi bi-floppy-fill" /> {guardando ? "Guardando…" : "Guardar sesión"}
                      </button>
                      <button onClick={() => setSesionActiva(null)} style={btn("#6b7280", true)}>Cancelar</button>
                    </>)}
                    {sesionActiva && sesionActiva !== "nueva" && (
                      <button onClick={() => setMostrarPrint(true)} style={btn("#10b981", true)}>
                        <i className="bi bi-printer-fill" /> Imprimir
                      </button>
                    )}
                  </div>
                </div>
              )}

              {sesiones.length === 0 && !sesionActiva && (
                <div style={{ ...card, textAlign: "center", color: "#9ca3af", paddingTop: 40, paddingBottom: 40 }}>
                  <i className="bi bi-journal-plus" style={{ fontSize: 36, color: "#c4b5fd" }} />
                  <p style={{ marginTop: 12 }}>Sin sesiones. Presiona <strong>Nueva sesión</strong> para comenzar.</p>
                </div>
              )}
            </>)}

            {/* ════ TAB HISTORIA ════ */}
            {tab === "historia" && (
              <div style={card}>
                <h6 style={{ fontWeight: 700, color: "#1e1b4b", marginBottom: 16, fontSize: "0.93rem" }}>
                  <i className="bi bi-person-lines-fill me-2" style={{ color: PURPLE }} />Historia Psicológica — Anamnesis
                </h6>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }} className="psico-historia-grid">
                  {[
                    { key: "motivo_derivacion",   label: "Motivo de derivación / consulta inicial" },
                    { key: "demanda_inicial",      label: "Demanda inicial del paciente" },
                    { key: "dinamica_familiar",    label: "Dinámica familiar" },
                    { key: "historia_social",      label: "Historia social" },
                    { key: "historia_laboral",     label: "Historia laboral / académica" },
                    { key: "antecedentes_psiq",    label: "Antecedentes de salud mental" },
                    { key: "diagnosticos_previos", label: "Diagnósticos previos" },
                    { key: "medicacion_actual",    label: "Medicación actual" },
                    { key: "hospitalizaciones",    label: "Hospitalizaciones psiquiátricas" },
                    { key: "eventos_traumaticos",  label: "Eventos traumáticos relevantes" },
                    { key: "redes_apoyo",          label: "Redes de apoyo" },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                      <FLabel>{f.label}</FLabel>
                      <textarea rows={3} value={formHistoria[f.key] || ""}
                        onChange={e => setFormHistoria(h => ({ ...h, [f.key]: e.target.value }))}
                        style={{ ...inputStyle, resize: "vertical" }} />
                    </div>
                  ))}
                </div>
                <div className="psico-grid-2">
                  <div>
                    <FLabel>Nivel educativo</FLabel>
                    <input value={formHistoria.nivel_educativo || ""} onChange={e => setFormHistoria(h => ({ ...h, nivel_educativo: e.target.value }))} style={inputStyle} placeholder="Universitario completo…" />
                  </div>
                  <div>
                    <FLabel>Estado civil</FLabel>
                    <input value={formHistoria.estado_civil || ""} onChange={e => setFormHistoria(h => ({ ...h, estado_civil: e.target.value }))} style={inputStyle} placeholder="Soltero/a, casado/a…" />
                  </div>
                </div>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#c2410c", marginBottom: 10 }}>
                    <i className="bi bi-exclamation-triangle-fill me-2" /> Indicadores de riesgo
                  </div>
                  <div className="psico-riesgo-checks">
                    {[
                      { key: "intentos_autoliticos", label: "Intentos autolíticos previos" },
                      { key: "ideacion_actual",       label: "Ideación suicida actual" },
                    ].map(f => (
                      <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, color: "#7c2d12" }}>
                        <input type="checkbox" checked={!!formHistoria[f.key]}
                          onChange={e => setFormHistoria(h => ({ ...h, [f.key]: e.target.checked }))}
                          style={{ width: 16, height: 16, accentColor: "#dc2626" }} />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
                <button onClick={guardarHistoria} disabled={guardando} style={btn(PURPLE)}>
                  <i className="bi bi-floppy-fill" /> {guardando ? "Guardando…" : "Guardar historia"}
                </button>
              </div>
            )}

            {/* ════ TAB PLAN ════ */}
            {tab === "plan" && (
              <div style={card}>
                <h6 style={{ fontWeight: 700, color: "#1e1b4b", marginBottom: 16, fontSize: "0.93rem" }}>
                  <i className="bi bi-bullseye me-2" style={{ color: PURPLE }} />Plan Terapéutico
                </h6>
                <div className="psico-grid-2">
                  <div>
                    <FLabel>Enfoque / Modalidad terapéutica</FLabel>
                    <select value={formPlan.enfoque} onChange={e => setFormPlan(f => ({ ...f, enfoque: e.target.value }))} style={inputStyle}>
                      <option value="">Seleccionar…</option>
                      {ENFOQUES.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <FLabel>Frecuencia de sesiones</FLabel>
                    <select value={formPlan.frecuencia} onChange={e => setFormPlan(f => ({ ...f, frecuencia: e.target.value }))} style={inputStyle}>
                      <option value="">Seleccionar…</option>
                      {FRECUENCIAS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>

                {/* Progreso */}
                {(() => {
                  const total = formPlan.objetivos.length;
                  const cumplidos = formPlan.objetivos.filter(o => o.cumplido).length;
                  const sugerido = total > 0 ? Math.round((cumplidos / total) * 100) : null;
                  const difiere = sugerido !== null && sugerido !== formPlan.progreso_general;
                  return (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                        <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Progreso general</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {sugerido !== null && (
                            <span style={{ fontSize: "0.75rem", color: "#7c6f9f" }}>
                              Sugerido: <strong>{cumplidos}/{total} ({sugerido}%)</strong>
                              {difiere && (
                                <button onClick={() => setFormPlan(f => ({ ...f, progreso_general: sugerido }))} style={{ marginLeft: 6, fontSize: "0.7rem", padding: "2px 7px", background: PURPLE_LIGHT, color: PURPLE, border: `1px solid ${PURPLE}40`, borderRadius: 5, cursor: "pointer", fontWeight: 600 }}>Aplicar</button>
                              )}
                            </span>
                          )}
                          <span style={{ fontWeight: 700, color: PURPLE, fontSize: "0.9rem" }}>{formPlan.progreso_general}%</span>
                        </div>
                      </div>
                      <div style={{ position: "relative", marginBottom: 4 }}>
                        <input type="range" min={0} max={100} value={formPlan.progreso_general}
                          onChange={e => setFormPlan(f => ({ ...f, progreso_general: Number(e.target.value) }))}
                          style={{ width: "100%", accentColor: PURPLE }} />
                        {sugerido !== null && difiere && (
                          <div style={{ position: "absolute", top: -6, left: `calc(${sugerido}% - 6px)`, width: 12, height: 12, borderRadius: "50%", background: "#a78bfa", border: "2px solid #6d28d9", pointerEvents: "none" }} />
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151" }}>Objetivos terapéuticos</label>
                    <button onClick={agregarObjetivo} style={btn(PURPLE)}><i className="bi bi-plus-lg" /> Agregar</button>
                  </div>
                  {formPlan.objetivos.map((obj, i) => (
                    <div key={i} className="psico-objetivo-row">
                      <input type="checkbox" checked={obj.cumplido}
                        onChange={e => setFormPlan(f => {
                          const o = [...f.objetivos]; o[i] = { ...o[i], cumplido: e.target.checked };
                          const total = o.length;
                          const cumplidos = o.filter(x => x.cumplido).length;
                          const sugerido = total > 0 ? Math.round((cumplidos / total) * 100) : f.progreso_general;
                          const sugeridoAnterior = total > 0 ? Math.round((f.objetivos.filter(x => x.cumplido).length / total) * 100) : f.progreso_general;
                          return { ...f, objetivos: o, progreso_general: f.progreso_general === sugeridoAnterior ? sugerido : f.progreso_general };
                        })}
                        style={{ width: 16, height: 16, accentColor: "#10b981", flexShrink: 0 }} />
                      <input value={obj.objetivo} placeholder="Descripción del objetivo…"
                        onChange={e => setFormPlan(f => { const o = [...f.objetivos]; o[i] = { ...o[i], objetivo: e.target.value }; return { ...f, objetivos: o }; })}
                        style={{ ...inputStyle, flex: 1, minWidth: 120, textDecoration: obj.cumplido ? "line-through" : "none", color: obj.cumplido ? "#9ca3af" : "#1f2937" }} />
                      <select value={obj.plazo}
                        onChange={e => setFormPlan(f => { const o = [...f.objetivos]; o[i] = { ...o[i], plazo: e.target.value }; return { ...f, objetivos: o }; })}
                        style={{ ...inputStyle, width: 110, flexShrink: 0 }}>
                        <option value="corto">Corto</option>
                        <option value="mediano">Mediano</option>
                        <option value="largo">Largo</option>
                      </select>
                      <button onClick={() => setFormPlan(f => ({ ...f, objetivos: f.objetivos.filter((_, j) => j !== i) }))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16, flexShrink: 0, padding: 4 }}>
                        <i className="bi bi-trash3-fill" />
                      </button>
                    </div>
                  ))}
                  {formPlan.objetivos.length === 0 && <p style={{ color: "#9ca3af", fontSize: "0.82rem" }}>Sin objetivos aún.</p>}
                </div>

                <div style={{ marginBottom: 18 }}>
                  <FLabel>Notas del plan</FLabel>
                  <textarea value={formPlan.notas} rows={3} onChange={e => setFormPlan(f => ({ ...f, notas: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                <button onClick={guardarPlan} disabled={guardando} style={btn(PURPLE)}>
                  <i className="bi bi-floppy-fill" /> {guardando ? "Guardando…" : "Guardar plan"}
                </button>
              </div>
            )}

            {/* ════ TAB ESCALAS ════ */}
            {tab === "escalas" && (<>

              {/* Modal ver escala */}
              {escalaVer && createPortal(
                <div onClick={() => setEscalaVer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #ede9fe", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#1e1b4b" }}>
                          {ESCALAS_DEF[escalaVer.tipo_escala]?.nombre || escalaVer.tipo_escala}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#7c6f9f", marginTop: 2 }}>
                          {dayjs(escalaVer.aplicado_en).format("DD/MM/YYYY HH:mm")}
                        </div>
                      </div>
                      <button onClick={() => setEscalaVer(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#6b7280", padding: 4 }}>×</button>
                    </div>
                    <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
                      {(() => {
                        const def = ESCALAS_DEF[escalaVer.tipo_escala];
                        if (!def) return <p style={{ color: "#9ca3af" }}>Sin detalle disponible.</p>;

                        // ── Registro: mostrar campos y valores ────────────
                        if (def.tipo === "registro") {
                          const vals = Array.isArray(escalaVer.respuestas) ? {} : (escalaVer.respuestas || {});
                          return (def.campos || []).map(c => (
                            <div key={c.key} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #f3f4f6" }}>
                              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#7c6f9f", marginBottom: 3 }}>{c.label}</div>
                              <div style={{ fontSize: "0.88rem", color: "#1f2937", fontWeight: 500 }}>{vals[c.key] || "—"}</div>
                            </div>
                          ));
                        }

                        // ── Cuestionario: mostrar preguntas con respuestas ─
                        const items = getItemsDef(def);
                        const respuestas = Array.isArray(escalaVer.respuestas) ? escalaVer.respuestas : [];
                        return items.map((item, i) => {
                          const val = respuestas[i] ?? null;
                          return (
                            <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                              <div style={{ fontSize: "0.82rem", color: "#374151", fontWeight: 500, marginBottom: 6 }}>{i + 1}. {item.pregunta}</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {item.opciones.map((op, j) => (
                                  <span key={j} style={{ padding: "4px 10px", borderRadius: 7, fontSize: "0.75rem", fontWeight: 600, background: val === j ? PURPLE : "#f3f4f6", color: val === j ? "#fff" : "#9ca3af", border: `1px solid ${val === j ? PURPLE : "#e5e7eb"}` }}>{op}</span>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <div style={{ padding: "12px 20px", borderTop: "1px solid #ede9fe", background: PURPLE_LIGHT, borderRadius: "0 0 16px 16px", flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                        <span style={{ fontWeight: 700, color: PURPLE, fontSize: "1rem" }}>
                          {ESCALAS_DEF[escalaVer.tipo_escala]?.tipo === "registro" ? "Resultado" : `Total: ${escalaVer.puntaje_total} pts`}
                        </span>
                        <span style={{ fontSize: "0.82rem", color: "#5b21b6", fontWeight: 600 }}>{escalaVer.interpretacion}</span>
                      </div>
                      {/* DASS-21 subscores extraídos */}
                      {escalaVer.tipo_escala === "DASS21" && (() => {
                        const m = (escalaVer.interpretacion || "").match(/D:(\d+)\((\w+\.?)\) A:(\d+)\((\w+\.?)\) E:(\d+)\((\w+\.?)\)/);
                        if (!m) return null;
                        return (
                          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                            {[["Depresión", m[1], m[2], "#6d28d9"], ["Ansiedad", m[3], m[4], "#2196f3"], ["Estrés", m[5], m[6], "#f59e0b"]].map(([lbl, val, nivel, col]) => (
                              <span key={lbl} style={{ flex: 1, textAlign: "center", background: `${col}15`, border: `1px solid ${col}30`, borderRadius: 8, padding: "4px 10px", fontSize: "0.73rem" }}>
                                <span style={{ fontWeight: 700, color: col }}>{lbl}: {val}</span>
                                <span style={{ color: col, marginLeft: 4 }}>({nivel})</span>
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>,
                document.body
              )}

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <h6 style={{ fontWeight: 700, color: "#1e1b4b", fontSize: "0.9rem", margin: 0 }}>
                    <i className="bi bi-clipboard2-pulse-fill me-2" style={{ color: PURPLE }} />Aplicar escala
                  </h6>
                  {paciente && (
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${COLOR_CATEGORIA[edadCategoria]}18`, color: COLOR_CATEGORIA[edadCategoria], border: `1px solid ${COLOR_CATEGORIA[edadCategoria]}40` }}>
                      {ETIQUETA_CATEGORIA[edadCategoria]} · {dayjs().diff(dayjs(paciente.fecha_nacimiento), "year")} años
                    </span>
                  )}
                </div>

                {!escalaActiva && (<>
                  {/* Cuestionarios */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: "0.73rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 7 }}>Cuestionarios</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {escalasDisponibles.filter(([, d]) => d.tipo === "cuestionario").map(([k, d]) => (
                        <button key={k} onClick={() => { setEscalaActiva(k); setRespuestasEscala(Array(getItemsDef(d).length).fill(0)); setRegistroEscala({}); }} style={btn(PURPLE, true)}>
                          <i className="bi bi-clipboard2-check" /> {d.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Registro de resultados */}
                  {escalasDisponibles.some(([, d]) => d.tipo === "registro") && (
                    <div>
                      <div style={{ fontSize: "0.73rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 7 }}>Registro de resultados</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {escalasDisponibles.filter(([, d]) => d.tipo === "registro").map(([k, d]) => (
                          <button key={k} onClick={() => { setEscalaActiva(k); setRespuestasEscala([]); setRegistroEscala({}); }} style={btn("#6b7280", true)}>
                            <i className="bi bi-pencil-square" /> {d.nombre}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>)}

                {escalaActiva && (() => {
                  const def = ESCALAS_DEF[escalaActiva];

                  // ── REGISTRO ──────────────────────────────────────────────
                  if (def.tipo === "registro") {
                    return (
                      <div>
                        <div style={{ fontWeight: 700, color: PURPLE, fontSize: "0.95rem", marginBottom: 4 }}>{def.nombre}</div>
                        <div style={{ fontSize: "0.78rem", color: "#7c6f9f", marginBottom: 16 }}>{def.subtitulo}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }} className="psico-historia-grid">
                          {(def.campos || []).map(c => (
                            <div key={c.key} style={{ marginBottom: 12 }}>
                              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>{c.label}{c.required ? " *" : ""}</label>
                              {c.tipo === "select" ? (
                                <select value={registroEscala[c.key] || ""} onChange={e => setRegistroEscala(r => ({ ...r, [c.key]: e.target.value }))} style={inputStyle}>
                                  <option value="">Seleccionar…</option>
                                  {c.opciones.map(op => <option key={op} value={op}>{op}</option>)}
                                </select>
                              ) : c.tipo === "numero" ? (
                                <input type="number" min={c.min} max={c.max} placeholder={c.placeholder || ""} value={registroEscala[c.key] || ""} onChange={e => setRegistroEscala(r => ({ ...r, [c.key]: e.target.value }))} style={inputStyle} />
                              ) : c.tipo === "fecha" ? (
                                <input type="date" value={registroEscala[c.key] || ""} onChange={e => setRegistroEscala(r => ({ ...r, [c.key]: e.target.value }))} style={inputStyle} />
                              ) : c.tipo === "texto_largo" ? (
                                <textarea rows={2} value={registroEscala[c.key] || ""} onChange={e => setRegistroEscala(r => ({ ...r, [c.key]: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
                              ) : (
                                <input type="text" value={registroEscala[c.key] || ""} onChange={e => setRegistroEscala(r => ({ ...r, [c.key]: e.target.value }))} style={inputStyle} />
                              )}
                            </div>
                          ))}
                        </div>
                        {Object.values(registroEscala).some(v => v) && (
                          <div style={{ padding: "10px 14px", borderRadius: 10, background: PURPLE_LIGHT, border: "1px solid #c4b5fd", marginBottom: 14 }}>
                            <span style={{ fontWeight: 700, color: PURPLE }}>Interpretación: </span>
                            <span style={{ fontSize: "0.85rem", color: "#5b21b6" }}>{def.interpretar(registroEscala)}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={aplicarEscala} style={btn(PURPLE)}><i className="bi bi-floppy-fill" /> Guardar registro</button>
                          <button onClick={() => { setEscalaActiva(null); setRegistroEscala({}); }} style={btn("#6b7280", true)}>Cancelar</button>
                        </div>
                      </div>
                    );
                  }

                  // ── CUESTIONARIO ──────────────────────────────────────────
                  const items = getItemsDef(def);
                  const total = def.calcPuntaje ? def.calcPuntaje(respuestasEscala) : respuestasEscala.reduce((a, b) => a + (b || 0), 0);
                  return (
                    <div>
                      <div style={{ fontWeight: 700, color: PURPLE, fontSize: "0.95rem", marginBottom: 4 }}>{def.nombre}</div>
                      <div style={{ fontSize: "0.78rem", color: "#7c6f9f", marginBottom: 16 }}>{def.subtitulo}</div>
                      {items.map((item, i) => (
                        <div key={i} style={{ marginBottom: 14 }}>
                          <label style={{ fontSize: "0.83rem", color: "#374151", display: "block", marginBottom: 6, fontWeight: 500 }}>
                            {i + 1}. {item.pregunta}
                          </label>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {item.opciones.map((op, j) => (
                              <button key={j} onClick={() => { const r = [...respuestasEscala]; r[i] = j; setRespuestasEscala(r); }}
                                style={{ padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.76rem", fontWeight: 600, background: respuestasEscala[i] === j ? PURPLE : "#f3f4f6", color: respuestasEscala[i] === j ? "#fff" : "#374151", border: `1px solid ${respuestasEscala[i] === j ? PURPLE : "#e5e7eb"}` }}>
                                {op}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div style={{ padding: "12px 16px", borderRadius: 10, background: PURPLE_LIGHT, border: "1px solid #c4b5fd", marginTop: 10, marginBottom: def.subescalas ? 10 : 16 }}>
                        <span style={{ fontWeight: 700, color: PURPLE, fontSize: "1rem" }}>Total: {total} pts</span>
                        <span style={{ marginLeft: 12, fontSize: "0.85rem", color: "#5b21b6" }}>→ {def.interpretar(respuestasEscala)}</span>
                      </div>
                      {def.subescalas && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                          {def.subescalas(respuestasEscala).map(sub => (
                            <div key={sub.label} style={{ flex: 1, minWidth: 110, background: `${sub.color}10`, border: `1px solid ${sub.color}30`, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
                              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: sub.color, marginBottom: 2 }}>{sub.label}</div>
                              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: sub.color, lineHeight: 1 }}>{sub.valor}</div>
                              <div style={{ fontSize: "0.7rem", color: sub.color, marginTop: 2 }}>{sub.nivel}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={aplicarEscala} style={btn(PURPLE)}><i className="bi bi-check-lg" /> Guardar escala</button>
                        <button onClick={() => { setEscalaActiva(null); setRespuestasEscala([]); }} style={btn("#6b7280", true)}>Cancelar</button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {escalas.length > 0 && (
                <div style={card}>
                  <h6 style={{ fontWeight: 700, color: "#1e1b4b", marginBottom: 14, fontSize: "0.9rem" }}>
                    <i className="bi bi-clock-history me-2" style={{ color: PURPLE }} />Escalas aplicadas
                    <span style={{ marginLeft: 8, fontSize: "0.73rem", fontWeight: 500, color: "#7c6f9f" }}>({escalas.length})</span>
                  </h6>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto", paddingRight: 4 }}>
                    {escalas.map(e => {
                      const scoreColor = e.puntaje_total <= 4 ? "#10b981" : e.puntaje_total <= 9 ? "#f59e0b" : e.puntaje_total <= 14 ? "#f97316" : "#ef4444";
                      return (
                        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "#faf5ff", border: "1px solid #ede9fe", flexWrap: "wrap" }}>
                          <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg,${scoreColor},${scoreColor}cc)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15 }}>
                            {e.puntaje_total}
                          </div>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e1b4b" }}>{ESCALAS_DEF[e.tipo_escala]?.nombre || e.tipo_escala} <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "#9ca3af" }}>— {ESCALAS_DEF[e.tipo_escala]?.subtitulo?.split("—")[0]?.trim() || ""}</span></div>
                            <div style={{ fontSize: "0.73rem", color: "#7c6f9f", marginTop: 1 }}>{dayjs(e.aplicado_en).format("DD/MM/YYYY")}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
                            <span style={{ padding: "3px 10px", borderRadius: 20, background: `${scoreColor}18`, color: scoreColor, border: `1px solid ${scoreColor}40`, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                              {e.puntaje_total} pts
                            </span>
                            <span style={{ padding: "3px 10px", borderRadius: 20, background: `${scoreColor}10`, color: scoreColor, border: `1px solid ${scoreColor}30`, fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {e.interpretacion}
                            </span>
                            <button onClick={() => setEscalaVer(e)} style={btn(PURPLE, true)}>
                              <i className="bi bi-eye-fill" /> Ver
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>)}

            {/* ════ TAB ANÁLISIS ════ */}
            {tab === "analisis" && (
              <AnalisisPsicologia
                escalas={escalas}
                sesiones={sesiones}
                plan={plan}
                paciente={paciente}
              />
            )}

          </>)}
        </div>
      </div>

      {/* ── Modal Nueva Sesión / Programar ── */}
      {modalNueva && paciente && (
        <ModalConsultaSinCita
          paciente={paciente}
          psicologia={true}
          onClose={() => setModalNueva(false)}
          onCreated={(citaId, esProgramar) => {
            setModalNueva(false);
            if (esProgramar) {
              // "Programar" → solo cita, no abrir sesión aún
              setMsg({ tipo: "ok", texto: "Cita programada correctamente. Aparecerá en el módulo de Citas." });
            } else {
              // "Ahora" → cita creada y EN_ATENCION, abrir formulario de sesión
              nuevaSesion();
            }
          }}
        />
      )}

    </>
  );
}

function FLabel({ children }) {
  return <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>{children}</label>;
}

// ── Panel reutilizable de búsqueda de pacientes ────────────────────────────
function PanelPacientes({ pacientesFiltrados, paciente, busqueda, setBusqueda, seleccionarPaciente, onClose }) {
  return (
    <div style={{
      background: "#0d1b2e",
      display: "flex", flexDirection: "column",
      height: "100%",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 14px 12px",
        borderBottom: "1px solid rgba(255,255,255,.07)",
        background: "#112240",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg,#2196f3,#0d47a1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="bi bi-person-hearts" style={{ color: "#fff", fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff" }}>Pacientes</div>
              <div style={{ fontSize: "0.65rem", color: "rgba(148,163,184,.6)" }}>Consulta Psicológica</div>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 7, cursor: "pointer", color: "rgba(148,163,184,.7)",
              fontSize: 13, width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; e.currentTarget.style.color = "rgba(148,163,184,.7)"; }}
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
        {/* Buscador */}
        <div style={{ position: "relative" }}>
          <i className="bi bi-search" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "rgba(148,163,184,.5)", fontSize: 12, pointerEvents: "none" }} />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar paciente…"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "7px 10px 7px 28px",
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 8, color: "rgba(203,213,225,.9)",
              fontSize: "0.81rem", outline: "none",
            }}
            onFocus={e => { e.target.style.borderColor = "rgba(33,150,243,.5)"; e.target.style.background = "rgba(255,255,255,.08)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,.1)"; e.target.style.background = "rgba(255,255,255,.05)"; }}
          />
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        {pacientesFiltrados.map(p => {
          const activo = paciente?.id === p.id;
          return (
            <div key={p.id} onClick={() => seleccionarPaciente(p)} style={{
              padding: "9px 10px", borderRadius: 9, cursor: "pointer", marginBottom: 3,
              background: activo ? "rgba(33,150,243,.18)" : "transparent",
              borderLeft: activo ? "3px solid #2196f3" : "3px solid transparent",
              transition: "all .15s",
            }}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: activo ? "linear-gradient(135deg,#2196f3,#0d47a1)" : "rgba(33,150,243,.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: activo ? "#fff" : "rgba(148,163,184,.8)",
                  fontWeight: 700, fontSize: 12,
                  border: `1px solid ${activo ? "rgba(33,150,243,.4)" : "rgba(255,255,255,.08)"}`,
                }}>
                  {p.nombres?.[0]}{p.apellidos?.[0]}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: "0.81rem", fontWeight: activo ? 600 : 400,
                    color: activo ? "#fff" : "rgba(203,213,225,.85)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {p.nombres} {p.apellidos}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(148,163,184,.5)", marginTop: 1 }}>
                    {p.fecha_nacimiento ? `${dayjs().diff(p.fecha_nacimiento, "year")} años` : ""}
                  </div>
                </div>
                {activo && <i className="bi bi-chevron-right" style={{ color: "#2196f3", fontSize: 11, flexShrink: 0 }} />}
              </div>
            </div>
          );
        })}
        {pacientesFiltrados.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 28, color: "rgba(148,163,184,.35)" }}>
            <i className="bi bi-person-slash" style={{ fontSize: 26, display: "block", marginBottom: 6 }} />
            <span style={{ fontSize: "0.78rem" }}>Sin resultados</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 14px", flexShrink: 0,
        borderTop: "1px solid rgba(255,255,255,.07)",
        fontSize: "0.68rem", color: "rgba(148,163,184,.35)",
        display: "flex", alignItems: "center", gap: 5,
      }}>
        <i className="bi bi-people-fill" style={{ fontSize: 11 }} />
        {pacientesFiltrados.length} paciente{pacientesFiltrados.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
