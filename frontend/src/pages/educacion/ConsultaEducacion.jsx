import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import {
  TEAL, TEAL_LIGHT, card, inputStyle, label, btn, deepMerge,
  TIPOS_DM, COMORBILIDADES, COMPLICACIONES, ESQUEMAS, CONOCE_ITEMS, TEMAS_PLAN, BARRERAS,
  SECCIONES_DEF, emptySesion, calcularIndiceGlobal, calcularAlertas,
} from "./shared";
import AlertasBanner from "./AlertasBanner";

const NIVELES_1A5 = ["1", "2", "3", "4", "5"];

// ═══════════════════════════════════════════════════════════════════════════════
//  IMPRESIÓN
// ═══════════════════════════════════════════════════════════════════════════════
function PrintSesion({ sesion, paciente, user, onClose }) {
  const S = {
    sectionTitle: { fontSize: 11, fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: ".07em", borderBottom: "1.5px solid #99f6e4", paddingBottom: 4, margin: "14px 0 8px" },
    fieldRow: { display: "flex", gap: 20, marginBottom: 5, alignItems: "baseline", flexWrap: "wrap" },
    fLabel: { fontWeight: 700, color: "#374151", minWidth: 150, fontSize: 11.5, flexShrink: 0 },
    fValue: { color: "#1f2937", fontSize: 11.5, flex: 1, whiteSpace: "pre-wrap" },
  };
  const R = (k, v) => (v || v === 0) ? <div style={S.fieldRow}><span style={S.fLabel}>{k}:</span><span style={S.fValue}>{v}</span></div> : null;
  const listaSiNo = (obj, items) => items.filter(([k]) => obj?.[k]).map(([, l]) => l).join(", ");

  const { diagnostico: d, antecedentes: a, tratamiento_actual: t, monitoreo: m, alimentacion: al,
    actividad_fisica: af, educacion_previa: ep, objetivos_paciente: obj, plan_educativo: pl, evaluacion_educativa: ev } = sesion;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #edu-print-doc, #edu-print-doc * { visibility: visible !important; }
          #edu-print-doc { position:fixed!important; top:0!important; left:0!important; width:100%!important; padding:14mm 18mm!important; box-shadow:none!important; background:white!important; }
          #print-actions-bar { display:none!important; }
          @page { margin:0; size:A4; }
        }
      `}</style>
      <div id="print-actions-bar" style={{ background: "#f0fdfa", borderBottom: "1px solid #99f6e4", padding: "12px 24px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => window.print()} style={{ padding: "9px 22px", background: TEAL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 14 }}>
          <i className="bi bi-printer-fill" /> Imprimir / Guardar PDF
        </button>
        <button onClick={onClose} style={{ padding: "9px 22px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 9, fontWeight: 600, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
          <i className="bi bi-x-lg" /> Cerrar
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#0f766e" }}>Vista previa — Sesión {dayjs(sesion.fecha).format("DD/MM/YYYY")}</span>
      </div>
      <div style={{ background: "#e8e8e8", minHeight: "calc(100vh - 60px)", padding: "24px 16px", overflowY: "auto", display: "flex", justifyContent: "center" }}>
        <div id="edu-print-doc" style={{ background: "white", width: "100%", maxWidth: "210mm", minHeight: "297mm", padding: "18mm 20mm", boxShadow: "0 4px 32px rgba(0,0,0,.18)", fontFamily: "Arial, sans-serif", color: "#1a1a2e", boxSizing: "border-box", alignSelf: "flex-start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2.5px solid ${TEAL}`, paddingBottom: 12, marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: TEAL }}>{user?.clinica_nombre || "Clínica de Endocrinología"}</div>
              <div style={{ fontSize: 10, color: "#0f766e", marginTop: 3 }}>Educación en Diabetes</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b" }}>SESIÓN EDUCATIVA</div>
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Fecha: <strong>{dayjs(sesion.fecha).format("DD/MM/YYYY")}</strong></div>
            </div>
          </div>

          <div style={S.sectionTitle}>1. Datos Generales</div>
          <div style={S.fieldRow}>
            <span style={S.fLabel}>Nombre:</span><span style={{ ...S.fValue, fontWeight: 600 }}>{paciente?.nombres} {paciente?.apellidos}</span>
            <span style={S.fLabel}>Edad:</span><span style={S.fValue}>{paciente?.fecha_nacimiento ? `${dayjs().diff(paciente.fecha_nacimiento, "year")} años` : "—"}</span>
            <span style={S.fLabel}>Sexo:</span><span style={S.fValue}>{paciente?.sexo || "—"}</span>
          </div>
          <div style={S.fieldRow}>
            <span style={S.fLabel}>Teléfono:</span><span style={S.fValue}>{paciente?.telefono || "—"}</span>
            <span style={S.fLabel}>Ocupación:</span><span style={S.fValue}>{paciente?.ocupacion || "—"}</span>
            <span style={S.fLabel}>Escolaridad:</span><span style={S.fValue}>{paciente?.escolaridad || "—"}</span>
          </div>

          {d && (d.tipo_dm || d.motivo_consulta) && (<>
            <div style={S.sectionTitle}>2. Diagnóstico</div>
            {R("Tipo", TIPOS_DM.find(x => x.v === d.tipo_dm)?.l || d.tipo_dm_otro)}
            {R("Año del diagnóstico", d.anio_diagnostico)}
            {R("Motivo de consulta", d.motivo_consulta)}
            {R("Médico tratante", d.medico_tratante)}
          </>)}

          {a && (<>
            <div style={S.sectionTitle}>3. Antecedentes Relevantes</div>
            {R("Comorbilidades", listaSiNo(a.comorbilidades, COMORBILIDADES) || (a.comorbilidades?.otra ? a.comorbilidades.otra_texto : ""))}
            {R("Complicaciones", listaSiNo(a.complicaciones, COMPLICACIONES))}
          </>)}

          {t && (t.medicamentos || t.insulina_basal) && (<>
            <div style={S.sectionTitle}>4. Tratamiento Actual</div>
            {R("Medicamentos", t.medicamentos)}
            {R("Insulina basal / rápida", `${t.insulina_basal || "—"} / ${t.insulina_rapida || "—"}`)}
            {R("Esquema", ESQUEMAS.find(x => x.v === t.esquema)?.l)}
          </>)}

          {m && (m.frecuencia || m.metodo?.glucometro || m.metodo?.cgm) && (<>
            <div style={S.sectionTitle}>5. Monitoreo de Glucosa</div>
            {R("Método", [m.metodo?.glucometro && "Glucómetro", m.metodo?.cgm && "CGM"].filter(Boolean).join(", "))}
            {R("Frecuencia", m.frecuencia)}
            {R("Ayunas / Antes / Después", `${m.ayunas || "—"} / ${m.antes_comidas || "—"} / ${m.despues_comidas || "—"}`)}
            {R("Hipoglucemias", m.hipoglucemias)}
            {R("Reconoce síntomas", m.reconoce_sintomas)}
          </>)}

          {al && (al.quien_prepara || al.comidas_dia) && (<>
            <div style={S.sectionTitle}>6. Alimentación</div>
            {R("¿Quién prepara los alimentos?", al.quien_prepara)}
            {R("Comidas por día", al.comidas_dia)}
            {R("Hábitos", [al.bebidas_azucaradas && "Bebidas azucaradas", al.conteo_carbohidratos && "Conteo de carbohidratos", al.horario_regular && "Horario regular"].filter(Boolean).join(", "))}
          </>)}

          {af && (af.tipo || af.no_realiza) && (<>
            <div style={S.sectionTitle}>7. Actividad Física</div>
            {R("Realiza actividad física", af.no_realiza ? "No realiza" : `${af.tipo || "—"} — ${af.frecuencia || "—"}`)}
          </>)}

          {ep && (ep.ha_recibido) && (<>
            <div style={S.sectionTitle}>8. Educación en Diabetes (previa)</div>
            {R("Ha recibido educación previa", ep.ha_recibido)}
            {R("Conoce", listaSiNo(ep.conoce, CONOCE_ITEMS))}
          </>)}

          {obj && (<><div style={S.sectionTitle}>9. Objetivos del Paciente</div><p style={{ ...S.fValue, margin: 0 }}>{obj}</p></>)}

          {pl && (pl.observaciones || pl.proxima_cita) && (<>
            <div style={S.sectionTitle}>10. Plan Educativo</div>
            {R("Temas a reforzar", listaSiNo(pl.temas, TEMAS_PLAN))}
            {R("Próxima cita", pl.proxima_cita ? dayjs(pl.proxima_cita).format("DD/MM/YYYY") : "")}
            {pl.observaciones && <p style={{ ...S.fValue, margin: "4px 0" }}><strong>Observaciones:</strong> {pl.observaciones}</p>}
          </>)}

          {ev && (ev.nivel_diabetes || ev.nivel_alimentacion) && (<>
            <div style={S.sectionTitle}>11. Evaluación Educativa</div>
            {R("Nivel de conocimiento (1-5)", `Diabetes ${ev.nivel_diabetes || "—"} · Alimentación ${ev.nivel_alimentacion || "—"} · Insulina ${ev.nivel_insulina || "—"} · Monitoreo ${ev.nivel_monitoreo || "—"}`)}
            {R("Barreras", listaSiNo(ev.barreras, BARRERAS) || (ev.barreras?.otra ? ev.barreras.otra_texto : ""))}
          </>)}

          <div style={{ marginTop: 40, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "center", minWidth: 220 }}>
              <div style={{ height: 70 }} />
              <div style={{ borderTop: "1.5px solid #374151", paddingTop: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{sesion.educador_nombre || "Educador(a) en Diabetes"}</div>
                <div style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>Firma y Sello</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 28, paddingTop: 10, borderTop: "1px solid #e5e7eb", textAlign: "center", fontSize: 9, color: "#9ca3af" }}>
            Generado el {dayjs().format("DD/MM/YYYY [a las] HH:mm")}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function ConsultaEducacion() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [pacientes, setPacientes] = useState([]);
  const [paciente, setPaciente] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sesiones, setSesiones] = useState([]);
  const [sesionActiva, setSesionActiva] = useState(null);
  const [formSesion, setFormSesion] = useState(null);
  const [seccionesAbiertas, setSeccionesAbiertas] = useState([]);
  const [fechaSesion, setFechaSesion] = useState(dayjs().format("YYYY-MM-DD"));

  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [mostrarPrint, setMostrarPrint] = useState(false);

  useEffect(() => {
    api.get("/pacientes", { params: { limit: 200 } }).then(r => setPacientes(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const pid = params.get("paciente_id");
    if (pid && pacientes.length) {
      const p = pacientes.find(x => String(x.id) === String(pid));
      if (p) seleccionarPaciente(p, params.get("sesion_id"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSidebarOpen(false);

    api.get(`/pacientes/${p.id}`).then(r => setPaciente(r.data.data || p)).catch(() => {});

    const r = await api.get("/educacion-diabetes/sesiones", { params: { paciente_id: p.id, limit: 50 } }).catch(() => ({ data: {} }));
    setSesiones(r.data.data || []);
    if (sesionIdUrl) cargarSesion(sesionIdUrl);
  }, []);

  const nuevaSesion = () => {
    setSesionActiva("nueva");
    setFormSesion(structuredClone(emptySesion));
    setSeccionesAbiertas([]);
    setFechaSesion(dayjs().format("YYYY-MM-DD"));
  };

  const cargarSesion = async (id) => {
    const r = await api.get(`/educacion-diabetes/sesiones/${id}`);
    const s = r.data.data;
    setSesionActiva(s);
    setFormSesion(deepMerge(emptySesion, s));
    setFechaSesion(dayjs(s.fecha).format("YYYY-MM-DD"));
    setSeccionesAbiertas(s.secciones_completadas || []);
  };

  const toggleSeccion = (key) => {
    setSeccionesAbiertas(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const guardarSesion = async () => {
    if (!paciente) return;
    setGuardando(true);
    try {
      const payload = { paciente_id: paciente.id, fecha: fechaSesion };
      for (const k of seccionesAbiertas) payload[k] = formSesion[k];

      if (sesionActiva === "nueva") {
        await api.post("/educacion-diabetes/sesiones", payload);
        setMsg({ tipo: "ok", texto: "Sesión guardada" });
      } else {
        await api.put(`/educacion-diabetes/sesiones/${sesionActiva.id}`, payload);
        setMsg({ tipo: "ok", texto: "Sesión actualizada" });
      }
      await seleccionarPaciente(paciente);
      setSesionActiva(null);
    } catch (e) {
      setMsg({ tipo: "err", texto: e.response?.data?.msg || "Error al guardar" });
    } finally { setGuardando(false); }
  };

  const eliminarSesion = async (id) => {
    if (!confirm("¿Eliminar esta sesión? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/educacion-diabetes/sesiones/${id}`);
      await seleccionarPaciente(paciente);
    } catch (e) {
      setMsg({ tipo: "err", texto: e.response?.data?.msg || "Error al eliminar" });
    }
  };

  const set = (path, value) => {
    setFormSesion(prev => {
      const next = structuredClone(prev);
      const parts = path.split(".");
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const pacientesFiltrados = pacientes.filter(p => `${p.nombres} ${p.apellidos}`.toLowerCase().includes(busqueda.toLowerCase()));

  if (mostrarPrint && sesionActiva && sesionActiva !== "nueva") {
    return <PrintSesion sesion={sesionActiva} paciente={paciente} user={user} onClose={() => setMostrarPrint(false)} />;
  }

  return (
    <>
      <style>{`
        .edu-root { display: flex; height: 100%; position: relative; }
        .edu-desktop-panel { display: flex; flex-direction: column; width: 260px; min-width: 260px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,.07); }
        .edu-main { flex: 1; padding: 16px 20px; overflow-y: auto; min-width: 0; background: #f1f5f9; }
        .edu-sidebar-toggle { display: none; }
        .edu-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .edu-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .edu-check-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
        @media (max-width: 767px) {
          .edu-root { display: block; }
          .edu-desktop-panel { display: none; }
          .edu-sidebar-toggle { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; background: #112240; color: rgba(203,213,225,.9); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; font-size: 0.83rem; font-weight: 500; cursor: pointer; margin-bottom: 14px; }
          .edu-main { padding: 12px 14px; }
          .edu-grid-2, .edu-grid-3 { grid-template-columns: 1fr; }
        }
      `}</style>

      {createPortal(
        <>
          {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1055 }} />}
          <div style={{ position: "fixed", top: 62, left: 0, height: "calc(100% - 62px)", width: 260, zIndex: 1060, transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform .28s cubic-bezier(.4,0,.2,1)" }}>
            <PanelPacientes pacientesFiltrados={pacientesFiltrados} paciente={paciente} busqueda={busqueda} setBusqueda={setBusqueda} seleccionarPaciente={seleccionarPaciente} onClose={() => setSidebarOpen(false)} />
          </div>
        </>,
        document.body
      )}

      <div className="edu-root">
        <div className="edu-desktop-panel">
          <PanelPacientes pacientesFiltrados={pacientesFiltrados} paciente={paciente} busqueda={busqueda} setBusqueda={setBusqueda} seleccionarPaciente={seleccionarPaciente} onClose={null} />
        </div>

        <div className="edu-main">
          <button className="edu-sidebar-toggle" onClick={() => setSidebarOpen(true)}>
            <i className="bi bi-list" /> {paciente ? `${paciente.nombres} ${paciente.apellidos}` : "Seleccionar paciente"}
          </button>

          {!paciente ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#94a3b8" }}>
              <i className="bi bi-mortarboard" style={{ fontSize: 48, opacity: .3, display: "block", marginBottom: 12 }} />
              Selecciona un paciente para ver su Educación en Diabetes
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b" }}>{paciente.nombres} {paciente.apellidos}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Educación en Diabetes</div>
                </div>
                <button onClick={() => navigate(`/pacientes/${paciente.id}/perfil`)} style={btn(TEAL, true)}>
                  <i className="bi bi-person-vcard" /> Ver Expediente
                </button>
              </div>

              {msg && (
                <div style={{ padding: "10px 16px", borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600, background: msg.tipo === "ok" ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)", color: msg.tipo === "ok" ? "#059669" : "#dc2626" }}>
                  {msg.texto}
                </div>
              )}

              {!sesionActiva && (
                <TabListaSesiones sesiones={sesiones} onNuevo={nuevaSesion} onVer={cargarSesion} onEliminar={eliminarSesion}
                  onImprimir={(s) => { setSesionActiva(s); setMostrarPrint(true); }} />
              )}

              {sesionActiva && (
                <TabFormSesion
                  sesionActiva={sesionActiva} formSesion={formSesion} set={set}
                  seccionesAbiertas={seccionesAbiertas} toggleSeccion={toggleSeccion}
                  fechaSesion={fechaSesion} setFechaSesion={setFechaSesion}
                  guardando={guardando} onGuardar={guardarSesion} onCancelar={() => setSesionActiva(null)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Panel de pacientes ──────────────────────────────────────────────────────
function PanelPacientes({ pacientesFiltrados, paciente, busqueda, setBusqueda, seleccionarPaciente, onClose }) {
  return (
    <div style={{ background: "#0d1b2e", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid rgba(255,255,255,.07)", background: "#112240", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${TEAL}, #115e59)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="bi bi-mortarboard" style={{ color: "#fff", fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff" }}>Pacientes</div>
              <div style={{ fontSize: "0.65rem", color: "rgba(148,163,184,.6)" }}>Educación en Diabetes</div>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 7, cursor: "pointer", color: "rgba(148,163,184,.7)", fontSize: 13, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <i className="bi bi-search" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "rgba(148,163,184,.5)", fontSize: 12 }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar paciente…"
            style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 28px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "rgba(203,213,225,.9)", fontSize: "0.81rem", outline: "none" }} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {pacientesFiltrados.map(p => {
          const activo = paciente?.id === p.id;
          return (
            <div key={p.id} onClick={() => seleccionarPaciente(p)} style={{ padding: "9px 10px", borderRadius: 9, cursor: "pointer", marginBottom: 3, background: activo ? "rgba(13,148,136,.18)" : "transparent" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: activo ? "#5eead4" : "rgba(226,232,240,.9)" }}>{p.nombres} {p.apellidos}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Lista de sesiones ────────────────────────────────────────────────────────
const TOTAL_SECCIONES = SECCIONES_DEF.length;
function TabListaSesiones({ sesiones, onNuevo, onVer, onEliminar, onImprimir }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button style={btn(TEAL)} onClick={onNuevo}><i className="bi bi-plus-lg" /> Nueva Sesión</button>
      </div>
      {sesiones.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 0", color: "#94a3b8" }}>
          <i className="bi bi-mortarboard" style={{ fontSize: 36, display: "block", marginBottom: 10, opacity: .3 }} />
          No hay sesiones educativas registradas
        </div>
      ) : (
        sesiones.map(s => {
          const secciones = s.secciones_completadas || [];
          const pct = Math.round((secciones.length / TOTAL_SECCIONES) * 100);
          return (
            <div key={s.id} style={{ ...card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => onVer(s.id)}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: TEAL_LIGHT, border: `1px solid ${TEAL}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className="bi bi-calendar-check" style={{ color: TEAL, fontSize: 18 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{dayjs(s.fecha).format("DD/MM/YYYY")}</div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                  {secciones.length ? `${secciones.length} de ${TOTAL_SECCIONES} sección(es) — ${pct}%` : "Sin secciones registradas"}
                </div>
                {s.educador_nombre && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{s.educador_nombre}</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                <button title="Ver / Editar" onClick={() => onVer(s.id)} style={{ width: 32, height: 32, border: `1px solid ${TEAL}40`, borderRadius: 8, background: TEAL_LIGHT, color: TEAL, cursor: "pointer" }}><i className="bi bi-pencil" /></button>
                <button title="Imprimir" onClick={() => onImprimir(s)} style={{ width: 32, height: 32, border: "1px solid rgba(16,185,129,.25)", borderRadius: 8, background: "rgba(16,185,129,.1)", color: "#10b981", cursor: "pointer" }}><i className="bi bi-printer" /></button>
                <button title="Eliminar" onClick={() => onEliminar(s.id)} style={{ width: 32, height: 32, border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, background: "rgba(239,68,68,.1)", color: "#ef4444", cursor: "pointer" }}><i className="bi bi-trash" /></button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Formulario de sesión (secciones colapsables) ────────────────────────────
function TabFormSesion({ sesionActiva, formSesion: fs, set, seccionesAbiertas, toggleSeccion, fechaSesion, setFechaSesion, guardando, onGuardar, onCancelar }) {
  const [expandido, setExpandido] = useState(null);
  const bloqueado = sesionActiva !== "nueva" && sesionActiva?.estado === "FIRMADA";
  const alertas = calcularAlertas(fs);

  return (
    <div>
      <AlertasBanner alertas={alertas} />

      <div style={card}>
        <span style={label}>Fecha de la sesión</span>
        <input type="date" style={{ ...inputStyle, width: 200 }} value={fechaSesion} onChange={e => setFechaSesion(e.target.value)} disabled={bloqueado} />
        <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 8 }}>Selecciona qué secciones deseas evaluar en esta sesión:</div>
      </div>

      {SECCIONES_DEF.map(({ key, titulo, icon }) => {
        const abierta = seccionesAbiertas.includes(key);
        const desplegada = expandido === key;
        return (
          <div key={key} style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", cursor: "pointer", background: abierta ? TEAL_LIGHT : "#fff" }}
              onClick={() => setExpandido(desplegada ? null : key)}>
              <label style={{ display: "flex", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={abierta} disabled={bloqueado} onChange={() => { toggleSeccion(key); if (!abierta) setExpandido(key); }} />
              </label>
              <i className={`bi ${icon}`} style={{ color: TEAL }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", flex: 1 }}>{titulo}</span>
              <i className={`bi bi-chevron-${desplegada ? "up" : "down"}`} style={{ color: "#94a3b8" }} />
            </div>
            {desplegada && (
              <div style={{ padding: "14px 18px", borderTop: "1px solid #f1f5f9" }}>
                <SeccionCampos seccion={key} fs={fs} set={set} disabled={bloqueado} />
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {!bloqueado && (
          <button style={btn(TEAL)} disabled={guardando} onClick={onGuardar}>
            <i className="bi bi-save" /> {guardando ? "Guardando..." : "Guardar Sesión"}
          </button>
        )}
        <button style={btn(TEAL, true)} onClick={onCancelar}><i className="bi bi-x-lg" /> Cancelar</button>
      </div>
    </div>
  );
}

function SeccionCampos({ seccion, fs, set, disabled }) {
  const d = fs[seccion];

  if (seccion === "diagnostico") return (
    <>
      <div className="edu-grid-3">
        <div><span style={label}>Tipo</span>
          <select style={inputStyle} disabled={disabled} value={d.tipo_dm} onChange={e => set(`${seccion}.tipo_dm`, e.target.value)}>
            <option value="">—</option>
            {TIPOS_DM.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
        <div><span style={label}>Año del diagnóstico</span><input style={inputStyle} disabled={disabled} value={d.anio_diagnostico} onChange={e => set(`${seccion}.anio_diagnostico`, e.target.value)} /></div>
        <div><span style={label}>Médico tratante</span><input style={inputStyle} disabled={disabled} value={d.medico_tratante} onChange={e => set(`${seccion}.medico_tratante`, e.target.value)} /></div>
      </div>
      {d.tipo_dm === "OTRO" && (
        <div style={{ marginBottom: 12 }}><span style={label}>Especificar otro</span><input style={inputStyle} disabled={disabled} value={d.tipo_dm_otro} onChange={e => set(`${seccion}.tipo_dm_otro`, e.target.value)} /></div>
      )}
      <div><span style={label}>Motivo de consulta</span><textarea style={{ ...inputStyle, minHeight: 60 }} disabled={disabled} value={d.motivo_consulta} onChange={e => set(`${seccion}.motivo_consulta`, e.target.value)} /></div>
    </>
  );

  if (seccion === "antecedentes") return (
    <>
      <div style={label}>Comorbilidades</div>
      <div className="edu-check-grid" style={{ marginBottom: 12 }}>
        {COMORBILIDADES.map(([k, l]) => (
          <label key={k} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" disabled={disabled} checked={!!d.comorbilidades[k]} onChange={e => set(`${seccion}.comorbilidades.${k}`, e.target.checked)} /> {l}
          </label>
        ))}
        <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" disabled={disabled} checked={!!d.comorbilidades.otra} onChange={e => set(`${seccion}.comorbilidades.otra`, e.target.checked)} /> Otra
        </label>
      </div>
      {d.comorbilidades.otra && <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Especificar otra comorbilidad" disabled={disabled} value={d.comorbilidades.otra_texto} onChange={e => set(`${seccion}.comorbilidades.otra_texto`, e.target.value)} />}
      <div style={label}>Complicaciones</div>
      <div className="edu-check-grid">
        {COMPLICACIONES.map(([k, l]) => (
          <label key={k} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" disabled={disabled} checked={!!d.complicaciones[k]} onChange={e => set(`${seccion}.complicaciones.${k}`, e.target.checked)} /> {l}
          </label>
        ))}
      </div>
    </>
  );

  if (seccion === "tratamiento_actual") return (
    <>
      <div><span style={label}>Medicamentos / Dosis / Horario</span><textarea style={{ ...inputStyle, minHeight: 60 }} disabled={disabled} value={d.medicamentos} onChange={e => set(`${seccion}.medicamentos`, e.target.value)} /></div>
      <div className="edu-grid-3" style={{ marginTop: 10 }}>
        <div><span style={label}>Insulina basal</span><input style={inputStyle} disabled={disabled} value={d.insulina_basal} onChange={e => set(`${seccion}.insulina_basal`, e.target.value)} /></div>
        <div><span style={label}>Insulina rápida</span><input style={inputStyle} disabled={disabled} value={d.insulina_rapida} onChange={e => set(`${seccion}.insulina_rapida`, e.target.value)} /></div>
        <div><span style={label}>Esquema</span>
          <select style={inputStyle} disabled={disabled} value={d.esquema} onChange={e => set(`${seccion}.esquema`, e.target.value)}>
            <option value="">—</option>
            {ESQUEMAS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </div>
      </div>
    </>
  );

  if (seccion === "monitoreo") return (
    <>
      <div style={label}>Método</div>
      <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
        <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}><input type="checkbox" disabled={disabled} checked={!!d.metodo.glucometro} onChange={e => set(`${seccion}.metodo.glucometro`, e.target.checked)} /> Glucómetro</label>
        <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}><input type="checkbox" disabled={disabled} checked={!!d.metodo.cgm} onChange={e => set(`${seccion}.metodo.cgm`, e.target.checked)} /> CGM</label>
      </div>
      <div className="edu-grid-3">
        <div><span style={label}>Frecuencia</span><input style={inputStyle} disabled={disabled} value={d.frecuencia} onChange={e => set(`${seccion}.frecuencia`, e.target.value)} /></div>
        <div><span style={label}>Ayunas</span><input style={inputStyle} disabled={disabled} value={d.ayunas} onChange={e => set(`${seccion}.ayunas`, e.target.value)} /></div>
        <div><span style={label}>Antes de comidas</span><input style={inputStyle} disabled={disabled} value={d.antes_comidas} onChange={e => set(`${seccion}.antes_comidas`, e.target.value)} /></div>
        <div><span style={label}>Después de comidas</span><input style={inputStyle} disabled={disabled} value={d.despues_comidas} onChange={e => set(`${seccion}.despues_comidas`, e.target.value)} /></div>
        <div><span style={label}>Hipoglucemias</span>
          <select style={inputStyle} disabled={disabled} value={d.hipoglucemias} onChange={e => set(`${seccion}.hipoglucemias`, e.target.value)}><option value="">—</option><option value="SI">Sí</option><option value="NO">No</option></select>
        </div>
        <div><span style={label}>¿Reconoce síntomas?</span>
          <select style={inputStyle} disabled={disabled} value={d.reconoce_sintomas} onChange={e => set(`${seccion}.reconoce_sintomas`, e.target.value)}><option value="">—</option><option value="SI">Sí</option><option value="NO">No</option></select>
        </div>
      </div>
    </>
  );

  if (seccion === "alimentacion") return (
    <>
      <div className="edu-grid-2">
        <div><span style={label}>¿Quién prepara los alimentos?</span><input style={inputStyle} disabled={disabled} value={d.quien_prepara} onChange={e => set(`${seccion}.quien_prepara`, e.target.value)} /></div>
        <div><span style={label}>Comidas por día</span><input style={inputStyle} disabled={disabled} value={d.comidas_dia} onChange={e => set(`${seccion}.comidas_dia`, e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}><input type="checkbox" disabled={disabled} checked={!!d.bebidas_azucaradas} onChange={e => set(`${seccion}.bebidas_azucaradas`, e.target.checked)} /> Bebidas azucaradas</label>
        <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}><input type="checkbox" disabled={disabled} checked={!!d.conteo_carbohidratos} onChange={e => set(`${seccion}.conteo_carbohidratos`, e.target.checked)} /> Conteo de carbohidratos</label>
        <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}><input type="checkbox" disabled={disabled} checked={!!d.horario_regular} onChange={e => set(`${seccion}.horario_regular`, e.target.checked)} /> Horario regular</label>
      </div>
    </>
  );

  if (seccion === "actividad_fisica") return (
    <>
      <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13, marginBottom: 10 }}>
        <input type="checkbox" disabled={disabled} checked={!!d.no_realiza} onChange={e => set(`${seccion}.no_realiza`, e.target.checked)} /> No realiza actividad física
      </label>
      {!d.no_realiza && (
        <div className="edu-grid-2">
          <div><span style={label}>Tipo</span><input style={inputStyle} disabled={disabled} value={d.tipo} onChange={e => set(`${seccion}.tipo`, e.target.value)} /></div>
          <div><span style={label}>Frecuencia</span><input style={inputStyle} disabled={disabled} value={d.frecuencia} onChange={e => set(`${seccion}.frecuencia`, e.target.value)} /></div>
        </div>
      )}
    </>
  );

  if (seccion === "educacion_previa") return (
    <>
      <div style={{ marginBottom: 12 }}>
        <span style={label}>¿Ha recibido educación en diabetes?</span>
        <select style={{ ...inputStyle, maxWidth: 200 }} disabled={disabled} value={d.ha_recibido} onChange={e => set(`${seccion}.ha_recibido`, e.target.value)}><option value="">—</option><option value="SI">Sí</option><option value="NO">No</option></select>
      </div>
      <div style={label}>Conoce</div>
      <div className="edu-check-grid">
        {CONOCE_ITEMS.map(([k, l]) => (
          <label key={k} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" disabled={disabled} checked={!!d.conoce[k]} onChange={e => set(`${seccion}.conoce.${k}`, e.target.checked)} /> {l}
          </label>
        ))}
      </div>
    </>
  );

  if (seccion === "objetivos_paciente") return (
    <textarea style={{ ...inputStyle, minHeight: 90 }} disabled={disabled} value={fs.objetivos_paciente} onChange={e => set("objetivos_paciente", e.target.value)} />
  );

  if (seccion === "plan_educativo") return (
    <>
      <div style={label}>Temas del plan educativo</div>
      <div className="edu-check-grid" style={{ marginBottom: 12 }}>
        {TEMAS_PLAN.map(([k, l]) => (
          <label key={k} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" disabled={disabled} checked={!!d.temas[k]} onChange={e => set(`${seccion}.temas.${k}`, e.target.checked)} /> {l}
          </label>
        ))}
      </div>
      <div className="edu-grid-2">
        <div><span style={label}>Próxima cita</span><input type="date" style={inputStyle} disabled={disabled} value={d.proxima_cita} onChange={e => set(`${seccion}.proxima_cita`, e.target.value)} /></div>
      </div>
      <div><span style={label}>Observaciones</span><textarea style={{ ...inputStyle, minHeight: 60 }} disabled={disabled} value={d.observaciones} onChange={e => set(`${seccion}.observaciones`, e.target.value)} /></div>
    </>
  );

  if (seccion === "evaluacion_educativa") {
    const indice = calcularIndiceGlobal(d);
    return (
    <>
      <div style={label}>Nivel de conocimientos (1-5)</div>
      <div className="edu-grid-3" style={{ marginBottom: 12 }}>
        {[["nivel_diabetes", "Diabetes"], ["nivel_alimentacion", "Alimentación"], ["nivel_insulina", "Insulina"], ["nivel_monitoreo", "Monitoreo"]].map(([k, l]) => (
          <div key={k}><span style={label}>{l}</span>
            <select style={inputStyle} disabled={disabled} value={d[k]} onChange={e => set(`${seccion}.${k}`, e.target.value)}>
              <option value="">—</option>
              {NIVELES_1A5.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        ))}
      </div>
      {indice !== null && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: TEAL_LIGHT, border: `1px solid ${TEAL}40`, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: "#374151" }}>Índice global de conocimiento:</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: TEAL }}>{indice} / 5</span>
        </div>
      )}
      <div style={label}>Barreras</div>
      <div className="edu-check-grid">
        {BARRERAS.map(([k, l]) => (
          <label key={k} style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" disabled={disabled} checked={!!d.barreras[k]} onChange={e => set(`${seccion}.barreras.${k}`, e.target.checked)} /> {l}
          </label>
        ))}
        <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" disabled={disabled} checked={!!d.barreras.otra} onChange={e => set(`${seccion}.barreras.otra`, e.target.checked)} /> Otra
        </label>
      </div>
      {d.barreras.otra && <input style={{ ...inputStyle, marginTop: 10 }} placeholder="Especificar otra barrera" disabled={disabled} value={d.barreras.otra_texto} onChange={e => set(`${seccion}.barreras.otra_texto`, e.target.value)} />}
    </>
    );
  }

  return null;
}
