import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import TabHistoria from "./TabHistoria";
import { ORANGE, ORANGE_LIGHT, card, inputStyle, label, btn, emptyHistoria, deepMerge } from "./shared";

const SECCIONES_DEF = [
  { key: "control_metabolico", titulo: "Control Metabólico", icon: "bi-droplet-half" },
  { key: "antropometria",      titulo: "Parámetros Antropométricos", icon: "bi-rulers" },
  { key: "retinopatia",        titulo: "Retinopatía Diabética", icon: "bi-eye" },
  { key: "nefropatia",         titulo: "Nefropatía Diabética", icon: "bi-droplet" },
  { key: "neuropatia",         titulo: "Neuropatía Diabética (mTCNS) y Riesgo de Pie", icon: "bi-lightning-charge" },
  { key: "cardiovascular",     titulo: "Evaluación Cardiovascular", icon: "bi-heart-pulse" },
  { key: "terapia_adherencia", titulo: "Terapia y Adherencia", icon: "bi-capsule" },
  { key: "psicosocial",        titulo: "Evaluación Psicosocial", icon: "bi-emoji-smile" },
  { key: "plan",               titulo: "Diagnósticos y Plan de Acción", icon: "bi-clipboard2-check" },
];

const emptySeccion = {
  control_metabolico: { hba1c: "", hba1c_fecha: "", mcg: { tir: "", tar: "", tbr: "", variabilidad: "", gmi: "" }, glucometro: { tir: "", tar: "", tbr: "", variabilidad: "" }, frecuencia_hipoglucemia: "", frecuencia_hiperglucemia: "" },
  antropometria: { peso: "", talla: "", imc: "", circunferencia_cintura: "" },
  retinopatia: { fecha_examen: "", no_realizado: false, resultado: "", otro: "" },
  nefropatia: { albumina_creatinina: "", fecha_alb: "", egfr: "", fecha_egfr: "" },
  neuropatia: {
    sintomas: { dolor_pies: "", entumecimiento: "", parestesias: "", debilidad: "", ataxia: "", miembros_superiores: "" },
    pruebas: { pinprick: "", temperatura: "", tacto_fino: "", vibracion: "", propiocepcion: "" },
    subtotal_signos: "", puntaje_total: "", grado_riesgo_pie: "",
  },
  cardiovascular: { pa_sistolica: "", pa_diastolica: "", fc: "", sato2: "", fr: "", perfil_lipidico: { fecha: "", colesterol_total: "", ldl: "", hdl: "", trigliceridos: "" }, hallazgos_adicionales: "" },
  terapia_adherencia: {
    esquema: { basal_bolo: false, bomba: false, otro: false, otro_texto: "" },
    dosis: { basal: "", bolo_desayuno: "", bolo_almuerzo: "", bolo_cena: "" },
    factor_correccion: "", indice_ic: "", na_ic: false,
    terapia_farmacologica: "", mcg: { uso: "", marca: "", tiempo_uso: "" }, adherencia: "",
  },
  psicosocial: { depresion_ansiedad: "", apoyo_social: "", paid5_score: "" },
  plan: {
    criterio_inclusion: "", diagnosticos: "", plan_accion: "",
    ajustes: { basal_de: "", bolos: "", factor_correccion: "", relacion_ic: "" },
    proximo_seguimiento: { tipo: "", fecha: "" },
  },
};

const GRADO_RIESGO_PIE = [
  { v: "0", l: "Muy bajo — sin PSP ni EAP" },
  { v: "1", l: "Bajo — PSP o EAP" },
  { v: "2", l: "Moderado — PSP+EAP, o + deformidades" },
  { v: "3", l: "Alto — PSP/EAP + úlcera previa, amputación o ERC severa" },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  IMPRESIÓN
// ═══════════════════════════════════════════════════════════════════════════════
function PrintSeguimiento({ historia, seguimiento, paciente, user, onClose }) {
  const S = {
    sectionTitle: { fontSize: 11, fontWeight: 700, color: ORANGE, textTransform: "uppercase", letterSpacing: ".07em", borderBottom: "1.5px solid #fed7aa", paddingBottom: 4, margin: "14px 0 8px" },
    fieldRow: { display: "flex", gap: 20, marginBottom: 5, alignItems: "baseline", flexWrap: "wrap" },
    fLabel: { fontWeight: 700, color: "#374151", minWidth: 130, fontSize: 11.5, flexShrink: 0 },
    fValue: { color: "#1f2937", fontSize: 11.5, flex: 1, whiteSpace: "pre-wrap" },
  };
  const R = (k, v) => v || v === 0 ? <div style={S.fieldRow}><span style={S.fLabel}>{k}:</span><span style={S.fValue}>{v}</span></div> : null;

  const cm = seguimiento?.control_metabolico, an = seguimiento?.antropometria;
  const re = seguimiento?.retinopatia, ne = seguimiento?.nefropatia, np = seguimiento?.neuropatia;
  const cv = seguimiento?.cardiovascular, te = seguimiento?.terapia_adherencia;
  const ps = seguimiento?.psicosocial, pl = seguimiento?.plan;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #endo-print-doc, #endo-print-doc * { visibility: visible !important; }
          #endo-print-doc { position:fixed!important; top:0!important; left:0!important; width:100%!important; padding:14mm 18mm!important; box-shadow:none!important; background:white!important; }
          #print-actions-bar { display:none!important; }
          @page { margin:0; size:A4; }
        }
      `}</style>
      <div id="print-actions-bar" style={{ background: "#fff7ed", borderBottom: "1px solid #fed7aa", padding: "12px 24px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => window.print()} style={{ padding: "9px 22px", background: ORANGE, color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 14 }}>
          <i className="bi bi-printer-fill" /> Imprimir / Guardar PDF
        </button>
        <button onClick={onClose} style={{ padding: "9px 22px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 9, fontWeight: 600, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
          <i className="bi bi-x-lg" /> Cerrar
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9a5b2c" }}>Vista previa — Seguimiento {dayjs(seguimiento?.fecha).format("DD/MM/YYYY")}</span>
      </div>
      <div style={{ background: "#e8e8e8", minHeight: "calc(100vh - 60px)", padding: "24px 16px", overflowY: "auto", display: "flex", justifyContent: "center" }}>
        <div id="endo-print-doc" style={{ background: "white", width: "100%", maxWidth: "210mm", minHeight: "297mm", padding: "18mm 20mm", boxShadow: "0 4px 32px rgba(0,0,0,.18)", fontFamily: "Arial, sans-serif", color: "#1a1a2e", boxSizing: "border-box", alignSelf: "flex-start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2.5px solid ${ORANGE}`, paddingBottom: 12, marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: ORANGE }}>{user?.clinica_nombre || "Clínica de Endocrinología"}</div>
              <div style={{ fontSize: 10, color: "#9a5b2c", marginTop: 3 }}>Control Intensivo en Pacientes con Diabetes Tipo 1</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b" }}>CONTROL DE SEGUIMIENTO</div>
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Fecha: <strong>{dayjs(seguimiento?.fecha).format("DD/MM/YYYY")}</strong></div>
            </div>
          </div>

          <div style={S.sectionTitle}>Datos del Paciente</div>
          <div style={S.fieldRow}>
            <span style={S.fLabel}>Nombre:</span><span style={{ ...S.fValue, fontWeight: 600 }}>{paciente?.nombres} {paciente?.apellidos}</span>
            <span style={S.fLabel}>Edad:</span><span style={S.fValue}>{paciente?.fecha_nacimiento ? `${dayjs().diff(paciente.fecha_nacimiento, "year")} años` : "—"}</span>
          </div>
          {historia && (
            <div style={S.fieldRow}>
              <span style={S.fLabel}>Médico:</span><span style={S.fValue}>{historia.medico || "—"}</span>
              <span style={S.fLabel}>Dx. desde:</span><span style={S.fValue}>{historia.fecha_diagnostico ? dayjs(historia.fecha_diagnostico).format("DD/MM/YYYY") : "—"}</span>
            </div>
          )}

          {cm && (<>
            <div style={S.sectionTitle}>Control Metabólico</div>
            {R("HbA1c", cm.hba1c ? `${cm.hba1c}% (${cm.hba1c_fecha ? dayjs(cm.hba1c_fecha).format("DD/MM/YYYY") : "—"})` : "")}
            {cm.mcg?.tir && R("TIR/TAR/TBR (MCG)", `${cm.mcg.tir}% / ${cm.mcg.tar}% / ${cm.mcg.tbr}% — Variab. ${cm.mcg.variabilidad}% GMI ${cm.mcg.gmi}%`)}
            {cm.glucometro?.tir && R("TIR/TAR/TBR (Glucómetro)", `${cm.glucometro.tir}% / ${cm.glucometro.tar}% / ${cm.glucometro.tbr}% — Variab. ${cm.glucometro.variabilidad}%`)}
            {R("Frecuencia hipoglucemias", cm.frecuencia_hipoglucemia)}
            {R("Frecuencia hiperglucemias", cm.frecuencia_hiperglucemia)}
          </>)}

          {an && (an.peso || an.talla) && (<>
            <div style={S.sectionTitle}>Parámetros Antropométricos</div>
            {R("Peso / Talla / IMC / Cintura", `${an.peso || "—"} kg / ${an.talla || "—"} cm / ${an.imc || "—"} kg/m² / ${an.circunferencia_cintura || "—"} cm`)}
          </>)}

          {re && (re.resultado || re.no_realizado) && (<>
            <div style={S.sectionTitle}>Retinopatía Diabética</div>
            {R("Último examen", re.no_realizado ? "No se ha realizado aún" : (re.fecha_examen ? dayjs(re.fecha_examen).format("DD/MM/YYYY") : "—"))}
            {R("Resultado", re.resultado === "OTRO" ? re.otro : re.resultado)}
          </>)}

          {ne && (ne.albumina_creatinina || ne.egfr) && (<>
            <div style={S.sectionTitle}>Nefropatía Diabética</div>
            {R("Albúmina/Creatinina", ne.albumina_creatinina ? `${ne.albumina_creatinina} mg/g (${ne.fecha_alb ? dayjs(ne.fecha_alb).format("DD/MM/YYYY") : "—"})` : "")}
            {R("eGFR", ne.egfr ? `${ne.egfr} ml/min/1.73m² (${ne.fecha_egfr ? dayjs(ne.fecha_egfr).format("DD/MM/YYYY") : "—"})` : "")}
          </>)}

          {np && (np.puntaje_total || np.grado_riesgo_pie !== "") && (<>
            <div style={S.sectionTitle}>Neuropatía Diabética (mTCNS)</div>
            {R("Subtotal signos", np.subtotal_signos)}
            {R("Puntaje total", np.puntaje_total ? `${np.puntaje_total} / 33` : "")}
            {R("Grado de riesgo de pie", GRADO_RIESGO_PIE.find(g => g.v === String(np.grado_riesgo_pie))?.l)}
          </>)}

          {cv && (cv.pa_sistolica || cv.fc) && (<>
            <div style={S.sectionTitle}>Evaluación Cardiovascular</div>
            {R("Presión arterial", cv.pa_sistolica ? `${cv.pa_sistolica}/${cv.pa_diastolica} mmHg` : "")}
            {R("FC / SatO2 / FR", `${cv.fc || "—"} lpm / ${cv.sato2 || "—"}% / ${cv.fr || "—"} rpm`)}
            {cv.perfil_lipidico?.colesterol_total && R("Perfil lipídico", `CT ${cv.perfil_lipidico.colesterol_total} · LDL ${cv.perfil_lipidico.ldl} · HDL ${cv.perfil_lipidico.hdl} · TG ${cv.perfil_lipidico.trigliceridos} mg/dL`)}
            {R("Hallazgos adicionales", cv.hallazgos_adicionales)}
          </>)}

          {te && (te.dosis?.basal || te.adherencia) && (<>
            <div style={S.sectionTitle}>Terapia y Adherencia</div>
            {R("Esquema", te.esquema?.basal_bolo ? "Basal-bolo" : te.esquema?.bomba ? "Bomba de insulina" : te.esquema?.otro_texto)}
            {R("Dosis", `Basal ${te.dosis?.basal || "—"} U · Bolos ${te.dosis?.bolo_desayuno || "—"}/${te.dosis?.bolo_almuerzo || "—"}/${te.dosis?.bolo_cena || "—"} U`)}
            {R("Factor corrección / IC", `${te.factor_correccion || "—"} / ${te.na_ic ? "N/A" : (te.indice_ic || "—")}`)}
            {R("Uso de MCG", te.mcg?.uso === "SI" ? `Sí — ${te.mcg.marca} (${te.mcg.tiempo_uso})` : "No")}
            {R("Adherencia", te.adherencia)}
          </>)}

          {ps && (ps.paid5_score || ps.depresion_ansiedad) && (<>
            <div style={S.sectionTitle}>Evaluación Psicosocial</div>
            {R("Depresión/Ansiedad", ps.depresion_ansiedad)}
            {R("Apoyo familiar/social", ps.apoyo_social)}
            {R("Escala PAID-5", ps.paid5_score ? `${ps.paid5_score} / 20` : "")}
          </>)}

          {pl && (pl.diagnosticos || pl.plan_accion) && (<>
            <div style={S.sectionTitle}>Diagnósticos y Plan de Acción</div>
            {R("¿Cumple criterio de inclusión?", pl.criterio_inclusion)}
            {pl.diagnosticos && <p style={{ ...S.fValue, margin: "4px 0" }}><strong>Diagnósticos:</strong> {pl.diagnosticos}</p>}
            {pl.plan_accion && <p style={{ ...S.fValue, margin: "4px 0" }}><strong>Plan de acción:</strong> {pl.plan_accion}</p>}
            {R("Próximo seguimiento", pl.proximo_seguimiento?.tipo ? `${pl.proximo_seguimiento.tipo} — ${pl.proximo_seguimiento.fecha ? dayjs(pl.proximo_seguimiento.fecha).format("DD/MM/YYYY") : "—"}` : "")}
          </>)}

          <div style={{ marginTop: 40, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "center", minWidth: 220 }}>
              {user?.firma_url ? <img src={user.firma_url} alt="Firma" style={{ maxHeight: 70, maxWidth: 200, objectFit: "contain", display: "block", margin: "0 auto 4px" }} /> : <div style={{ height: 70 }} />}
              <div style={{ borderTop: "1.5px solid #374151", paddingTop: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{seguimiento?.medico_nombre || historia?.medico || "Médico Tratante"}</div>
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
export default function ConsultaEndocrinologia() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState("historia");
  const [pacientes, setPacientes] = useState([]);
  const [paciente, setPaciente] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [historia, setHistoria] = useState(null);
  const [formHistoria, setFormHistoria] = useState(emptyHistoria);
  const [seguimientos, setSeguimientos] = useState([]);
  const [seguimientoActivo, setSeguimientoActivo] = useState(null);
  const [formSeguimiento, setFormSeguimiento] = useState(null);
  const [seccionesAbiertas, setSeccionesAbiertas] = useState([]);
  const [fechaSeguimiento, setFechaSeguimiento] = useState(dayjs().format("YYYY-MM-DD"));

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
      if (p) seleccionarPaciente(p, params.get("seguimiento_id"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pacientes]);

  useEffect(() => {
    if (params.get("print") === "1" && seguimientoActivo && seguimientoActivo !== "nuevo") {
      setMostrarPrint(true);
      const t = setTimeout(() => window.print(), 900);
      return () => clearTimeout(t);
    }
  }, [params, seguimientoActivo]);

  const seleccionarPaciente = useCallback(async (p, seguimientoIdUrl = null) => {
    setPaciente(p);
    setSeguimientoActivo(null);
    setMsg(null);
    setSidebarOpen(false);

    // La lista de /pacientes no trae todas las columnas (p.ej. sexo, dirección);
    // se pide el detalle completo del expediente para mostrarlo en la Historia Clínica.
    api.get(`/pacientes/${p.id}`).then(r => setPaciente(r.data.data || p)).catch(() => {});

    const [h, s] = await Promise.all([
      api.get(`/endocrinologia/historia/${p.id}`),
      api.get("/endocrinologia/seguimientos", { params: { paciente_id: p.id, limit: 50 } }),
    ]).then(rs => rs.map(r => r.data)).catch(() => [{}, {}]);

    setHistoria(h.data || null);
    // Si no hay historia previa, sugiere al médico logueado como médico tratante (editable)
    const medicoSugerido = user ? `${user.nombres || ""} ${user.apellidos || ""}`.trim() : "";
    setFormHistoria(h.data ? deepMerge(emptyHistoria, h.data) : { ...emptyHistoria, medico: medicoSugerido });
    setSeguimientos(s.data || []);
    setTab(h.data ? "seguimientos" : "historia");
    if (seguimientoIdUrl) cargarSeguimiento(seguimientoIdUrl);
  }, [user]);

  const guardarHistoria = async () => {
    if (!paciente) return;
    setGuardando(true);
    try {
      await api.post(`/endocrinologia/historia/${paciente.id}`, formHistoria);
      setMsg({ tipo: "ok", texto: "Historia clínica guardada" });
      const h = await api.get(`/endocrinologia/historia/${paciente.id}`);
      setHistoria(h.data.data);
    } catch (e) {
      setMsg({ tipo: "err", texto: e.response?.data?.msg || "Error al guardar historia" });
    } finally { setGuardando(false); }
  };

  const nuevoSeguimiento = () => {
    const hoy = dayjs().format("YYYY-MM-DD");
    const base = structuredClone(emptySeccion);
    // Las fechas de estudios/exámenes se prellenan con la fecha de hoy —
    // el doctor las cambia solo si el estudio es de una fecha anterior.
    base.control_metabolico.hba1c_fecha = hoy;
    base.retinopatia.fecha_examen = hoy;
    base.nefropatia.fecha_alb = hoy;
    base.nefropatia.fecha_egfr = hoy;
    base.cardiovascular.perfil_lipidico.fecha = hoy;
    setSeguimientoActivo("nuevo");
    setFormSeguimiento(base);
    setSeccionesAbiertas([]);
    setFechaSeguimiento(hoy);
    setTab("seguimientos");
  };

  const cargarSeguimiento = async (id) => {
    const r = await api.get(`/endocrinologia/seguimientos/${id}`);
    const s = r.data.data;
    setSeguimientoActivo(s);
    setFormSeguimiento(deepMerge(emptySeccion, s));
    setFechaSeguimiento(dayjs(s.fecha).format("YYYY-MM-DD"));
    setSeccionesAbiertas((s.secciones_completadas || []));
    setTab("seguimientos");
  };

  const toggleSeccion = (key) => {
    setSeccionesAbiertas(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const guardarSeguimiento = async () => {
    if (!paciente) return;
    setGuardando(true);
    try {
      const payload = { paciente_id: paciente.id, fecha: fechaSeguimiento };
      for (const k of seccionesAbiertas) payload[k] = formSeguimiento[k];

      if (seguimientoActivo === "nuevo") {
        await api.post("/endocrinologia/seguimientos", payload);
        setMsg({ tipo: "ok", texto: "Seguimiento guardado" });
      } else {
        await api.put(`/endocrinologia/seguimientos/${seguimientoActivo.id}`, payload);
        setMsg({ tipo: "ok", texto: "Seguimiento actualizado" });
      }
      await seleccionarPaciente(paciente);
      setSeguimientoActivo(null);
    } catch (e) {
      setMsg({ tipo: "err", texto: e.response?.data?.msg || "Error al guardar" });
    } finally { setGuardando(false); }
  };

  const eliminarSeguimiento = async (id) => {
    if (!confirm("¿Eliminar este seguimiento? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/endocrinologia/seguimientos/${id}`);
      await seleccionarPaciente(paciente);
    } catch (e) {
      setMsg({ tipo: "err", texto: e.response?.data?.msg || "Error al eliminar" });
    }
  };

  const set = (path, value) => {
    setFormSeguimiento(prev => {
      const next = structuredClone(prev);
      const parts = path.split(".");
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const pacientesFiltrados = pacientes.filter(p => `${p.nombres} ${p.apellidos}`.toLowerCase().includes(busqueda.toLowerCase()));

  if (mostrarPrint && seguimientoActivo && seguimientoActivo !== "nuevo") {
    return <PrintSeguimiento historia={historia} seguimiento={seguimientoActivo} paciente={paciente} user={user} onClose={() => setMostrarPrint(false)} />;
  }

  return (
    <>
      <style>{`
        .endo-root { display: flex; height: 100%; position: relative; }
        .endo-desktop-panel { display: flex; flex-direction: column; width: 260px; min-width: 260px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,.07); }
        .endo-main { flex: 1; padding: 16px 20px; overflow-y: auto; min-width: 0; background: #f1f5f9; }
        .endo-sidebar-toggle { display: none; }
        .endo-tabs { display: flex; gap: 2px; margin-bottom: 16px; border-bottom: 2px solid #fed7aa; }
        .endo-tab-btn { background: none; border: none; cursor: pointer; padding: 10px 16px; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; border-bottom: 3px solid transparent; margin-bottom: -2px; }
        .endo-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .endo-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .endo-check-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
        @media (max-width: 767px) {
          .endo-root { display: block; }
          .endo-desktop-panel { display: none; }
          .endo-sidebar-toggle { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; background: #112240; color: rgba(203,213,225,.9); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; font-size: 0.83rem; font-weight: 500; cursor: pointer; margin-bottom: 14px; }
          .endo-main { padding: 12px 14px; }
          .endo-grid-2, .endo-grid-3 { grid-template-columns: 1fr; }
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

      <div className="endo-root">
        <div className="endo-desktop-panel">
          <PanelPacientes pacientesFiltrados={pacientesFiltrados} paciente={paciente} busqueda={busqueda} setBusqueda={setBusqueda} seleccionarPaciente={seleccionarPaciente} onClose={null} />
        </div>

        <div className="endo-main">
          <button className="endo-sidebar-toggle" onClick={() => setSidebarOpen(true)}>
            <i className="bi bi-list" /> {paciente ? `${paciente.nombres} ${paciente.apellidos}` : "Seleccionar paciente"}
          </button>

          {!paciente ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#94a3b8" }}>
              <i className="bi bi-droplet-half" style={{ fontSize: 48, opacity: .3, display: "block", marginBottom: 12 }} />
              Selecciona un paciente para ver su Control de Seguimiento
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b" }}>{paciente.nombres} {paciente.apellidos}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Control de Seguimiento — Diabetes Tipo 1</div>
                </div>
                <button onClick={() => navigate(`/pacientes/${paciente.id}/perfil`)} style={btn(ORANGE, true)}>
                  <i className="bi bi-person-vcard" /> Ver Expediente
                </button>
              </div>

              {msg && (
                <div style={{ padding: "10px 16px", borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600, background: msg.tipo === "ok" ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)", color: msg.tipo === "ok" ? "#059669" : "#dc2626" }}>
                  {msg.texto}
                </div>
              )}

              <div className="endo-tabs">
                <button className="endo-tab-btn" onClick={() => setTab("historia")} style={{ color: tab === "historia" ? ORANGE : "#64748b", borderBottomColor: tab === "historia" ? ORANGE : "transparent", fontWeight: tab === "historia" ? 700 : 500 }}>
                  <i className="bi bi-file-earmark-medical" /> Historia Clínica
                </button>
                <button className="endo-tab-btn" onClick={() => setTab("seguimientos")} style={{ color: tab === "seguimientos" ? ORANGE : "#64748b", borderBottomColor: tab === "seguimientos" ? ORANGE : "transparent", fontWeight: tab === "seguimientos" ? 700 : 500 }}>
                  <i className="bi bi-graph-up-arrow" /> Seguimientos ({seguimientos.length})
                </button>
              </div>

              {tab === "historia" && (
                <TabHistoria paciente={paciente} user={user} formHistoria={formHistoria} setFormHistoria={setFormHistoria} guardando={guardando} guardarHistoria={guardarHistoria} />
              )}

              {tab === "seguimientos" && !seguimientoActivo && (
                <TabListaSeguimientos seguimientos={seguimientos} onNuevo={nuevoSeguimiento} onVer={cargarSeguimiento} onEliminar={eliminarSeguimiento}
                  onImprimir={(s) => { setSeguimientoActivo(s); setMostrarPrint(true); }} />
              )}

              {tab === "seguimientos" && seguimientoActivo && (
                <TabFormSeguimiento
                  seguimientoActivo={seguimientoActivo} formSeguimiento={formSeguimiento} set={set}
                  seccionesAbiertas={seccionesAbiertas} toggleSeccion={toggleSeccion}
                  fechaSeguimiento={fechaSeguimiento} setFechaSeguimiento={setFechaSeguimiento}
                  guardando={guardando} onGuardar={guardarSeguimiento} onCancelar={() => setSeguimientoActivo(null)}
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
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${ORANGE}, #9a3412)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="bi bi-droplet-half" style={{ color: "#fff", fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff" }}>Pacientes</div>
              <div style={{ fontSize: "0.65rem", color: "rgba(148,163,184,.6)" }}>Control de Seguimiento</div>
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
            <div key={p.id} onClick={() => seleccionarPaciente(p)} style={{ padding: "9px 10px", borderRadius: 9, cursor: "pointer", marginBottom: 3, background: activo ? "rgba(234,88,12,.18)" : "transparent" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: activo ? "#fdba74" : "rgba(226,232,240,.9)" }}>{p.nombres} {p.apellidos}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab lista de seguimientos ────────────────────────────────────────────────
function TabListaSeguimientos({ seguimientos, onNuevo, onVer, onEliminar, onImprimir }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button style={btn()} onClick={onNuevo}><i className="bi bi-plus-lg" /> Nuevo Seguimiento</button>
      </div>
      {seguimientos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 0", color: "#94a3b8" }}>
          <i className="bi bi-journal-text" style={{ fontSize: 36, display: "block", marginBottom: 10, opacity: .3 }} />
          No hay seguimientos registrados
        </div>
      ) : (
        seguimientos.map(s => {
          const secciones = s.secciones_completadas || [];
          return (
            <div key={s.id} style={{ ...card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => onVer(s.id)}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: ORANGE_LIGHT, border: `1px solid ${ORANGE}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className="bi bi-calendar-check" style={{ color: ORANGE, fontSize: 18 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{dayjs(s.fecha).format("DD/MM/YYYY")}</div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                  {secciones.length ? `${secciones.length} sección(es): ${secciones.map(k => SECCIONES_DEF.find(d => d.key === k)?.titulo).join(", ")}` : "Sin secciones registradas"}
                </div>
                {s.medico_nombre && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{s.medico_nombre}</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                <button title="Ver / Editar" onClick={() => onVer(s.id)} style={{ width: 32, height: 32, border: `1px solid ${ORANGE}40`, borderRadius: 8, background: ORANGE_LIGHT, color: ORANGE, cursor: "pointer" }}><i className="bi bi-pencil" /></button>
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

// ── Tab formulario de seguimiento (secciones colapsables) ───────────────────
function TabFormSeguimiento({ seguimientoActivo, formSeguimiento: fs, set, seccionesAbiertas, toggleSeccion, fechaSeguimiento, setFechaSeguimiento, guardando, onGuardar, onCancelar }) {
  const [expandido, setExpandido] = useState(null);
  const bloqueado = seguimientoActivo !== "nuevo" && seguimientoActivo?.estado === "FIRMADA";

  return (
    <div>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <span style={label}>Fecha del seguimiento</span>
            <input type="date" style={{ ...inputStyle, width: 200 }} value={fechaSeguimiento} onChange={e => setFechaSeguimiento(e.target.value)} disabled={bloqueado} />
          </div>
          <div style={{ fontSize: 12.5, color: "#64748b" }}>Selecciona qué secciones deseas evaluar en esta visita:</div>
        </div>
      </div>

      {SECCIONES_DEF.map(({ key, titulo, icon }) => {
        const abierta = seccionesAbiertas.includes(key);
        const desplegada = expandido === key;
        return (
          <div key={key} style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", cursor: "pointer", background: abierta ? ORANGE_LIGHT : "#fff" }}
              onClick={() => setExpandido(desplegada ? null : key)}>
              <label style={{ display: "flex", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={abierta} disabled={bloqueado} onChange={() => { toggleSeccion(key); if (!abierta) setExpandido(key); }} />
              </label>
              <i className={`bi ${icon}`} style={{ color: ORANGE }} />
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
          <button style={btn()} disabled={guardando} onClick={onGuardar}>
            <i className="bi bi-save" /> {guardando ? "Guardando..." : "Guardar Seguimiento"}
          </button>
        )}
        <button style={btn(ORANGE, true)} onClick={onCancelar}><i className="bi bi-x-lg" /> Cancelar</button>
      </div>
    </div>
  );
}

function SeccionCampos({ seccion, fs, set, disabled }) {
  const d = fs[seccion];
  const inp = (path, extra = {}) => ({
    style: inputStyle, disabled,
    value: path.split(".").reduce((o, k) => o?.[k], fs[seccion]) ?? "",
    onChange: e => set(`${seccion}.${path}`, e.target.value),
    ...extra,
  });
  const chk = (path) => ({
    type: "checkbox", disabled,
    checked: !!path.split(".").reduce((o, k) => o?.[k], fs[seccion]),
    onChange: e => set(`${seccion}.${path}`, e.target.checked),
  });

  // IMC = peso(kg) / talla(m)² — se recalcula solo al cambiar peso o talla
  const updateAntropometria = (field, value) => {
    set(`${seccion}.${field}`, value);
    const peso  = Number(field === "peso" ? value : d.peso);
    const talla = Number(field === "talla" ? value : d.talla);
    if (peso > 0 && talla > 0) set(`${seccion}.imc`, (peso / ((talla / 100) ** 2)).toFixed(1));
  };

  // mTCNS: subtotal de signos (pruebas sensoriales) y puntaje total (síntomas + signos), /33
  const SINTOMAS_KEYS = ["dolor_pies", "entumecimiento", "parestesias", "debilidad", "ataxia", "miembros_superiores"];
  const PRUEBAS_KEYS  = ["pinprick", "temperatura", "tacto_fino", "vibracion", "propiocepcion"];
  const updateNeuro = (grupo, campo, value) => {
    set(`${seccion}.${grupo}.${campo}`, value);
    const sintomas = { ...d.sintomas, ...(grupo === "sintomas" ? { [campo]: value } : {}) };
    const pruebas  = { ...d.pruebas,  ...(grupo === "pruebas" ? { [campo]: value } : {}) };
    const sumSintomas = SINTOMAS_KEYS.reduce((a, k) => a + (Number(sintomas[k]) || 0), 0);
    const sumPruebas  = PRUEBAS_KEYS.reduce((a, k) => a + (Number(pruebas[k]) || 0), 0);
    set(`${seccion}.subtotal_signos`, sumPruebas);
    set(`${seccion}.puntaje_total`, sumSintomas + sumPruebas);
  };

  if (seccion === "control_metabolico") return (
    <>
      <div className="endo-grid-3">
        <div><span style={label}>Última HbA1c (%)</span><input {...inp("hba1c")} /></div>
        <div><span style={label}>Fecha HbA1c</span><input type="date" {...inp("hba1c_fecha")} /></div>
        <div><span style={label}>Frecuencia hipoglucemias</span>
          <select {...inp("frecuencia_hipoglucemia")}><option value="">—</option>{["Ninguna", "Leve", "Moderada", "Severa"].map(o => <option key={o}>{o}</option>)}</select>
        </div>
      </div>
      <div style={{ ...label, marginTop: 6 }}>Si usa MCG (Monitoreo Continuo de Glucosa)</div>
      <div className="endo-grid-3">
        <div><span style={label}>TIR %</span><input {...inp("mcg.tir")} /></div>
        <div><span style={label}>TAR %</span><input {...inp("mcg.tar")} /></div>
        <div><span style={label}>TBR %</span><input {...inp("mcg.tbr")} /></div>
        <div><span style={label}>Variabilidad %</span><input {...inp("mcg.variabilidad")} /></div>
        <div><span style={label}>GMI %</span><input {...inp("mcg.gmi")} /></div>
        <div><span style={label}>Frecuencia hiperglucemias</span>
          <select {...inp("frecuencia_hiperglucemia")}><option value="">—</option>{["Ocasional", "Frecuente", "Persistente"].map(o => <option key={o}>{o}</option>)}</select>
        </div>
      </div>
      <div style={{ ...label, marginTop: 6 }}>Si usa Glucómetro</div>
      <div className="endo-grid-3">
        <div><span style={label}>TIR %</span><input {...inp("glucometro.tir")} /></div>
        <div><span style={label}>TAR %</span><input {...inp("glucometro.tar")} /></div>
        <div><span style={label}>TBR %</span><input {...inp("glucometro.tbr")} /></div>
        <div><span style={label}>Variabilidad %</span><input {...inp("glucometro.variabilidad")} /></div>
      </div>
    </>
  );

  if (seccion === "antropometria") return (
    <div className="endo-grid-3">
      <div><span style={label}>Peso (kg)</span><input style={inputStyle} disabled={disabled} value={d.peso} onChange={e => updateAntropometria("peso", e.target.value)} /></div>
      <div><span style={label}>Talla (cm)</span><input style={inputStyle} disabled={disabled} value={d.talla} onChange={e => updateAntropometria("talla", e.target.value)} /></div>
      <div><span style={label}>IMC (kg/m²) — calculado</span><input style={{ ...inputStyle, background: "#f1f5f9", color: "#64748b" }} disabled value={d.imc} /></div>
      <div><span style={label}>Circunferencia de cintura (cm)</span><input {...inp("circunferencia_cintura")} /></div>
    </div>
  );

  if (seccion === "retinopatia") return (
    <>
      <div className="endo-grid-3">
        <div><span style={label}>Último examen oftalmológico</span><input type="date" {...inp("fecha_examen")} /></div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}><input {...chk("no_realizado")} /> No se ha realizado aún</label>
        </div>
        <div><span style={label}>Resultado</span>
          <select {...inp("resultado")}><option value="">—</option>{["Sin hallazgos", "Retinopatía no proliferativa", "Retinopatía proliferativa", "Edema macular", "OTRO"].map(o => <option key={o}>{o}</option>)}</select>
        </div>
      </div>
      <div><span style={label}>Otro (especificar)</span><input {...inp("otro")} /></div>
    </>
  );

  if (seccion === "nefropatia") return (
    <div className="endo-grid-3">
      <div><span style={label}>Albúmina/Creatinina urinaria (mg/g)</span><input {...inp("albumina_creatinina")} /></div>
      <div><span style={label}>Fecha</span><input type="date" {...inp("fecha_alb")} /></div>
      <div><span style={label}>eGFR (ml/min/1.73m²)</span><input {...inp("egfr")} /></div>
      <div><span style={label}>Fecha eGFR</span><input type="date" {...inp("fecha_egfr")} /></div>
    </div>
  );

  if (seccion === "neuropatia") return (
    <>
      <div style={{ ...label, marginTop: 0 }}>Síntomas sensitivos (0–3)</div>
      <div className="endo-grid-3">
        {SINTOMAS_KEYS.map(k => (
          <div key={k}><span style={label}>{k.replace(/_/g, " ")}</span>
            <input style={inputStyle} disabled={disabled} value={d.sintomas[k]} onChange={e => updateNeuro("sintomas", k, e.target.value)} />
          </div>
        ))}
      </div>
      <div style={{ ...label, marginTop: 10 }}>Pruebas sensoriales (0–3)</div>
      <div className="endo-grid-3">
        {PRUEBAS_KEYS.map(k => (
          <div key={k}><span style={label}>{k.replace(/_/g, " ")}</span>
            <input style={inputStyle} disabled={disabled} value={d.pruebas[k]} onChange={e => updateNeuro("pruebas", k, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="endo-grid-3" style={{ marginTop: 10 }}>
        <div><span style={label}>Subtotal signos — calculado</span><input style={{ ...inputStyle, background: "#f1f5f9", color: "#64748b" }} disabled value={d.subtotal_signos} /></div>
        <div><span style={label}>Puntaje total (/33) — calculado</span><input style={{ ...inputStyle, background: "#f1f5f9", color: "#64748b" }} disabled value={d.puntaje_total} /></div>
        <div><span style={label}>Grado de riesgo de pie</span>
          <select {...inp("grado_riesgo_pie")}><option value="">—</option>{GRADO_RIESGO_PIE.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}</select>
        </div>
      </div>
    </>
  );

  if (seccion === "cardiovascular") return (
    <>
      <div className="endo-grid-3">
        <div><span style={label}>PA sistólica</span><input {...inp("pa_sistolica")} /></div>
        <div><span style={label}>PA diastólica</span><input {...inp("pa_diastolica")} /></div>
        <div><span style={label}>FC (lpm)</span><input {...inp("fc")} /></div>
        <div><span style={label}>SatO2 (%)</span><input {...inp("sato2")} /></div>
        <div><span style={label}>FR (rpm)</span><input {...inp("fr")} /></div>
        <div><span style={label}>Fecha perfil lipídico</span><input type="date" {...inp("perfil_lipidico.fecha")} /></div>
      </div>
      <div className="endo-grid-3">
        <div><span style={label}>Colesterol total (mg/dL)</span><input {...inp("perfil_lipidico.colesterol_total")} /></div>
        <div><span style={label}>LDL (mg/dL)</span><input {...inp("perfil_lipidico.ldl")} /></div>
        <div><span style={label}>HDL (mg/dL)</span><input {...inp("perfil_lipidico.hdl")} /></div>
        <div><span style={label}>Triglicéridos (mg/dL)</span><input {...inp("perfil_lipidico.trigliceridos")} /></div>
      </div>
      <div><span style={label}>Hallazgos adicionales al examen físico</span><textarea style={{ ...inputStyle, minHeight: 60 }} disabled={disabled} value={d.hallazgos_adicionales} onChange={e => set(`${seccion}.hallazgos_adicionales`, e.target.value)} /></div>
    </>
  );

  if (seccion === "terapia_adherencia") return (
    <>
      <div style={{ ...label }}>Esquema de insulina actual</div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}><input {...chk("esquema.basal_bolo")} /> Basal-bolo</label>
        <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}><input {...chk("esquema.bomba")} /> Bomba de insulina</label>
        <input style={{ ...inputStyle, width: 200 }} disabled={disabled} placeholder="Otro" value={d.esquema.otro_texto} onChange={e => set(`${seccion}.esquema.otro_texto`, e.target.value)} />
      </div>
      <div className="endo-grid-3">
        <div><span style={label}>Basal (U)</span><input {...inp("dosis.basal")} /></div>
        <div><span style={label}>Bolo desayuno (U)</span><input {...inp("dosis.bolo_desayuno")} /></div>
        <div><span style={label}>Bolo almuerzo (U)</span><input {...inp("dosis.bolo_almuerzo")} /></div>
        <div><span style={label}>Bolo cena (U)</span><input {...inp("dosis.bolo_cena")} /></div>
        <div><span style={label}>Factor de corrección</span><input {...inp("factor_correccion")} /></div>
        <div>
          <span style={label}>Índice Insulina/Carbohidrato</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input {...inp("indice_ic")} disabled={disabled || d.na_ic} />
            <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12, whiteSpace: "nowrap" }}><input {...chk("na_ic")} /> N/A</label>
          </div>
        </div>
      </div>
      <div><span style={label}>Terapia farmacológica actual</span><textarea style={{ ...inputStyle, minHeight: 50 }} disabled={disabled} value={d.terapia_farmacologica} onChange={e => set(`${seccion}.terapia_farmacologica`, e.target.value)} /></div>
      <div className="endo-grid-3" style={{ marginTop: 8 }}>
        <div><span style={label}>Uso de MCG</span>
          <select {...inp("mcg.uso")}><option value="">—</option><option value="SI">Sí</option><option value="NO">No</option></select>
        </div>
        <div><span style={label}>Marca</span><input {...inp("mcg.marca")} /></div>
        <div><span style={label}>Tiempo de uso</span><input {...inp("mcg.tiempo_uso")} /></div>
      </div>
      <div><span style={label}>Adherencia al tratamiento</span>
        <select {...inp("adherencia")}><option value="">—</option>{["Adecuada", "Irregular", "Deficiente"].map(o => <option key={o}>{o}</option>)}</select>
      </div>
    </>
  );

  if (seccion === "psicosocial") return (
    <div className="endo-grid-3">
      <div><span style={label}>Depresión / Ansiedad</span>
        <select {...inp("depresion_ansiedad")}><option value="">—</option><option value="SI">Sí</option><option value="NO">No</option></select>
      </div>
      <div><span style={label}>Apoyo familiar/social adecuado</span>
        <select {...inp("apoyo_social")}><option value="">—</option><option value="SI">Sí</option><option value="NO">No</option></select>
      </div>
      <div><span style={label}>Escala PAID-5 (0-20)</span><input {...inp("paid5_score")} /></div>
    </div>
  );

  if (seccion === "plan") return (
    <>
      <div><span style={label}>¿Cumple criterio de inclusión para control intensivo?</span>
        <select {...inp("criterio_inclusion")}><option value="">—</option><option value="SI">Sí</option><option value="NO">No</option></select>
      </div>
      <div><span style={label}>Diagnósticos</span><textarea style={{ ...inputStyle, minHeight: 60 }} disabled={disabled} value={d.diagnosticos} onChange={e => set(`${seccion}.diagnosticos`, e.target.value)} /></div>
      <div><span style={label}>Plan de acción</span><textarea style={{ ...inputStyle, minHeight: 80 }} disabled={disabled} value={d.plan_accion} onChange={e => set(`${seccion}.plan_accion`, e.target.value)} /></div>
      <div style={{ ...label, marginTop: 6 }}>Ajustes realizados</div>
      <div className="endo-grid-3">
        <div><span style={label}>Basal de (U)</span><input {...inp("ajustes.basal_de")} /></div>
        <div><span style={label}>Bolos (U)</span><input {...inp("ajustes.bolos")} /></div>
        <div><span style={label}>Factor de corrección</span><input {...inp("ajustes.factor_correccion")} /></div>
        <div><span style={label}>Relación IC</span><input {...inp("ajustes.relacion_ic")} /></div>
      </div>
      <div className="endo-grid-2" style={{ marginTop: 6 }}>
        <div><span style={label}>Próximo seguimiento</span>
          <select {...inp("proximo_seguimiento.tipo")}><option value="">—</option><option value="Teleconsulta">Teleconsulta</option><option value="Presencial">Presencial</option></select>
        </div>
        <div><span style={label}>Fecha</span><input type="date" {...inp("proximo_seguimiento.fecha")} /></div>
      </div>
    </>
  );

  return null;
}
