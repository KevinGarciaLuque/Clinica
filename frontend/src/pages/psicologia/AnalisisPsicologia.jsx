import { useMemo } from "react";
import dayjs from "dayjs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, ReferenceLine,
} from "recharts";

const PURPLE = "#6d28d9";

// Funciones de color por escala
const scoreColor = (p) =>
  p <= 4 ? "#10b981" : p <= 9 ? "#f59e0b" : p <= 14 ? "#f97316" : "#ef4444";

const colorBDI = (p) =>
  p <= 13 ? "#10b981" : p <= 19 ? "#f59e0b" : p <= 28 ? "#f97316" : "#ef4444";

const colorBAI = (p) =>
  p <= 7 ? "#10b981" : p <= 15 ? "#f59e0b" : p <= 25 ? "#f97316" : "#ef4444";

const colorAUDIT = (p) =>
  p <= 7 ? "#10b981" : p <= 15 ? "#f59e0b" : p <= 19 ? "#f97316" : "#ef4444";

const colorCDI = (p) =>
  p <= 12 ? "#10b981" : p <= 19 ? "#f59e0b" : p <= 26 ? "#f97316" : "#ef4444";

const colorSCARED = (p) =>
  p <= 24 ? "#10b981" : p <= 44 ? "#f97316" : "#ef4444";

const trendIcon = (d) =>
  d < 0 ? "bi-arrow-down-circle-fill" : d > 0 ? "bi-arrow-up-circle-fill" : "bi-dash-circle-fill";

const trendColor = (d) =>
  d < 0 ? "#10b981" : d > 0 ? "#ef4444" : "#6b7280";

const card = {
  background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
  boxShadow: "0 2px 8px rgba(0,0,0,.05)", padding: "16px 18px", marginBottom: 16,
};

const sectionTitle = {
  fontWeight: 700, color: "#1e1b4b", marginBottom: 14,
  fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 7,
};

// ── Summary card genérico ─────────────────────────────────────────────────────
function SummaryCard({ label, score, interpretacion, trend, maxScore, colorFn }) {
  const col = (colorFn || scoreColor)(score);
  const pct = Math.min(100, Math.round((score / maxScore) * 100));
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: "0.73rem", fontWeight: 600, color: "#7c6f9f", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: "2rem", fontWeight: 800, color: col, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: "0.73rem", color: "#9ca3af", marginBottom: 4 }}>/ {maxScore}</span>
        {trend && (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", fontWeight: 700, color: trendColor(trend.diff) }}>
            <i className={`bi ${trendIcon(trend.diff)}`} />
            {trend.diff !== 0 && Math.abs(trend.diff)}
          </span>
        )}
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6", marginBottom: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 3, transition: "width .5s" }} />
      </div>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: col }}>{interpretacion}</div>
    </div>
  );
}

// ── Card especial DASS-21 con 3 subscores ─────────────────────────────────────
function DASS21Card({ entry }) {
  const subs = parseDASS21(entry.interpretacion);
  const nivelColor = (n) => n <= 9 ? "#10b981" : n <= 13 ? "#f59e0b" : n <= 20 ? "#f97316" : "#ef4444";
  const nivelLabel = (n) => n <= 9 ? "Mínimo" : n <= 13 ? "Leve" : n <= 20 ? "Moderado" : n <= 27 ? "Grave" : "Ext. grave";
  if (!subs) return null;
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: "0.73rem", fontWeight: 600, color: "#7c6f9f", marginBottom: 10 }}>Último DASS-21</div>
      {[["Depresión", subs.D, "bi-cloud-rain-fill"], ["Ansiedad", subs.A, "bi-lightning-fill"], ["Estrés", subs.E, "bi-wind"]].map(([lbl, val, ico]) => (
        <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <i className={`bi ${ico}`} style={{ color: nivelColor(val), fontSize: 13, width: 16 }} />
          <span style={{ fontSize: "0.78rem", color: "#374151", flex: 1 }}>{lbl}</span>
          <span style={{ fontWeight: 800, fontSize: "1rem", color: nivelColor(val) }}>{val}</span>
          <span style={{ fontSize: "0.7rem", color: nivelColor(val), fontWeight: 600, background: `${nivelColor(val)}18`, borderRadius: 6, padding: "1px 6px" }}>{nivelLabel(val)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Insight badge ─────────────────────────────────────────────────────────────
const INSIGHT_STYLES = {
  alerta:      { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" },
  advertencia: { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  exito:       { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
  info:        { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  neutro:      { bg: "#f8f5ff", color: "#5b21b6", border: "#ede9fe" },
};

function InsightBadge({ tipo, texto, icono }) {
  const s = INSIGHT_STYLES[tipo] || INSIGHT_STYLES.info;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 10, background: s.bg, border: `1px solid ${s.border}`, marginBottom: 8 }}>
      <i className={`bi ${icono}`} style={{ color: s.color, fontSize: 16, flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: "0.83rem", color: s.color, fontWeight: 500 }}>{texto}</span>
    </div>
  );
}

// ── Custom tooltip para recharts ──────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #ede9fe", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,.1)", fontSize: "0.8rem" }}>
      <div style={{ fontWeight: 700, color: "#1e1b4b", marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}>
          {p.name}: <span style={{ fontWeight: 800 }}>{p.value ?? "—"}</span> pts
        </div>
      ))}
    </div>
  );
}

// Extrae subscores de DASS-21 desde la interpretacion string
const parseDASS21 = (interp) => {
  const m = (interp || "").match(/D:(\d+)\(.*?\) A:(\d+)\(.*?\) E:(\d+)/);
  return m ? { D: Number(m[1]), A: Number(m[2]), E: Number(m[3]) } : null;
};

// Series del gráfico de evolución — incluye todas las escalas de seguimiento
const CHART_SERIES = [
  { key: "PHQ9",    name: "PHQ-9",         color: "#6d28d9" },
  { key: "GAD7",    name: "GAD-7",         color: "#2196f3" },
  { key: "DASS21_D",name: "DASS-21 Dep.",  color: "#8b5cf6" },
  { key: "DASS21_A",name: "DASS-21 Ans.",  color: "#06b6d4" },
  { key: "DASS21_E",name: "DASS-21 Estr.", color: "#f59e0b" },
  { key: "BDIII",   name: "BDI-II",        color: "#7c3aed" },
  { key: "BAI",     name: "BAI",           color: "#0284c7" },
  { key: "AUDIT",   name: "AUDIT",         color: "#dc2626" },
  { key: "WHODAS",  name: "WHODAS",        color: "#9333ea" },
  { key: "CDI",     name: "CDI",           color: "#059669" },
  { key: "SCARED",  name: "SCARED",        color: "#10b981" },
];

// Escalas de tipo registro (sin score continuo en el chart de evolución)
const ESCALAS_REGISTRO = ["CSSRS", "CONNERS", "CBCL", "WISC"];

// ══════════════════════════════════════════════════════════════════════════════
export default function AnalisisPsicologia({ escalas, sesiones, plan, paciente }) {

  // ── Listas ordenadas por fecha para cada escala ────────────────────────────
  const sortByDate = (arr, tipo) =>
    arr.filter(e => e.tipo_escala === tipo)
       .sort((a, b) => dayjs(a.aplicado_en).valueOf() - dayjs(b.aplicado_en).valueOf());

  const phq9List   = useMemo(() => sortByDate(escalas, "PHQ9"),   [escalas]);
  const gad7List   = useMemo(() => sortByDate(escalas, "GAD7"),   [escalas]);
  const dass21List = useMemo(() => sortByDate(escalas, "DASS21"), [escalas]);
  const bdiList    = useMemo(() => sortByDate(escalas, "BDIII"),  [escalas]);
  const baiList    = useMemo(() => sortByDate(escalas, "BAI"),    [escalas]);
  const auditList  = useMemo(() => sortByDate(escalas, "AUDIT"),  [escalas]);
  const whodasList = useMemo(() => sortByDate(escalas, "WHODAS"), [escalas]);
  const cdiList    = useMemo(() => sortByDate(escalas, "CDI"),    [escalas]);
  const scaredList = useMemo(() => sortByDate(escalas, "SCARED"), [escalas]);
  const cssrsList  = useMemo(() => sortByDate(escalas, "CSSRS"),  [escalas]);
  const connersList= useMemo(() => sortByDate(escalas, "CONNERS"),[escalas]);
  const cbclList   = useMemo(() => sortByDate(escalas, "CBCL"),   [escalas]);
  const wiscList   = useMemo(() => sortByDate(escalas, "WISC"),   [escalas]);

  // ── Timeline combinado (escalas de seguimiento cuantitativas) ─────────────
  const timelineData = useMemo(() => {
    const byDate = {};
    [...escalas]
      .sort((a, b) => dayjs(a.aplicado_en).valueOf() - dayjs(b.aplicado_en).valueOf())
      .forEach(e => {
        const key = dayjs(e.aplicado_en).format("DD/MM/YY");
        if (!byDate[key]) byDate[key] = { fecha: key };
        if (e.tipo_escala === "DASS21") {
          const sub = parseDASS21(e.interpretacion);
          if (sub) { byDate[key].DASS21_D = sub.D; byDate[key].DASS21_A = sub.A; byDate[key].DASS21_E = sub.E; }
        } else if (["PHQ9","GAD7","BDIII","BAI","CDI","SCARED","AUDIT","WHODAS"].includes(e.tipo_escala)) {
          byDate[key][e.tipo_escala] = e.puntaje_total;
        }
      });
    return Object.values(byDate);
  }, [escalas]);

  // Solo muestra líneas para escalas con datos reales
  const seriesPresentes = useMemo(() =>
    CHART_SERIES.filter(s => timelineData.some(d => d[s.key] !== undefined)),
  [timelineData]);

  // ── Sesiones por mes ───────────────────────────────────────────────────────
  const sesionesXMes = useMemo(() => {
    const byMonth = {};
    [...sesiones]
      .sort((a, b) => dayjs(a.creado_en).valueOf() - dayjs(b.creado_en).valueOf())
      .forEach(s => {
        const key = dayjs(s.creado_en).format("MMM YY");
        byMonth[key] = (byMonth[key] || 0) + 1;
      });
    return Object.entries(byMonth).map(([mes, total]) => ({ mes, total }));
  }, [sesiones]);

  // ── Métricas derivadas ─────────────────────────────────────────────────────
  const trendPHQ9  = phq9List.length >= 2  ? { diff: phq9List.at(-1).puntaje_total  - phq9List.at(-2).puntaje_total  } : null;
  const trendGAD7  = gad7List.length >= 2  ? { diff: gad7List.at(-1).puntaje_total  - gad7List.at(-2).puntaje_total  } : null;
  const trendBDI   = bdiList.length >= 2   ? { diff: bdiList.at(-1).puntaje_total   - bdiList.at(-2).puntaje_total   } : null;
  const trendBAI   = baiList.length >= 2   ? { diff: baiList.at(-1).puntaje_total   - baiList.at(-2).puntaje_total   } : null;
  const trendCDI   = cdiList.length >= 2   ? { diff: cdiList.at(-1).puntaje_total   - cdiList.at(-2).puntaje_total   } : null;
  const trendSCARED= scaredList.length >= 2? { diff: scaredList.at(-1).puntaje_total - scaredList.at(-2).puntaje_total} : null;

  const diasUltimaSesion = sesiones.length
    ? dayjs().diff(dayjs(
        [...sesiones].sort((a, b) => dayjs(b.creado_en).valueOf() - dayjs(a.creado_en).valueOf())[0].creado_en
      ), "day")
    : null;

  const diasUltimaEscala = escalas.length
    ? dayjs().diff(dayjs(
        [...escalas].sort((a, b) => dayjs(b.aplicado_en).valueOf() - dayjs(a.aplicado_en).valueOf())[0].aplicado_en
      ), "day")
    : null;

  const promDiasEntreSesiones = useMemo(() => {
    if (sesiones.length < 2) return null;
    const sorted = [...sesiones].sort((a, b) => dayjs(a.creado_en).valueOf() - dayjs(b.creado_en).valueOf());
    let total = 0;
    for (let i = 1; i < sorted.length; i++)
      total += dayjs(sorted[i].creado_en).diff(dayjs(sorted[i - 1].creado_en), "day");
    return Math.round(total / (sorted.length - 1));
  }, [sesiones]);

  // ── Insights automáticos ──────────────────────────────────────────────────
  const insights = useMemo(() => {
    const list = [];
    const lastPHQ    = phq9List.at(-1);
    const lastGAD    = gad7List.at(-1);
    const lastDASS   = dass21List.at(-1);
    const lastBDI    = bdiList.at(-1);
    const lastBAI    = baiList.at(-1);
    const lastAUDIT  = auditList.at(-1);
    const lastWHODAS = whodasList.at(-1);
    const lastCDI    = cdiList.at(-1);
    const lastSCARED = scaredList.at(-1);
    const lastCSSRS  = cssrsList.at(-1);

    // ── Alertas de riesgo ──────────────────────────────────────────────────
    if (lastCSSRS) {
      const r = lastCSSRS.respuestas || {};
      const tieneRiesgo = ["ideacion_activa","plan","intencion","intentos_pasados"].some(k => r[k] && r[k] !== "No" && r[k] !== "0");
      if (tieneRiesgo)
        list.push({ tipo: "alerta", icono: "bi-exclamation-octagon-fill",
          texto: "ALERTA C-SSRS: registro de ideación o conducta suicida activa. Se requiere evaluación inmediata de riesgo." });
    }

    if (lastPHQ?.puntaje_total >= 15)
      list.push({ tipo: "alerta", icono: "bi-exclamation-octagon-fill",
        texto: `Alerta: PHQ-9 en rango ${lastPHQ.interpretacion.toLowerCase()} (${lastPHQ.puntaje_total} pts). Evaluar riesgo y ajuste de plan terapéutico.` });

    if (lastGAD?.puntaje_total >= 10)
      list.push({ tipo: "alerta", icono: "bi-exclamation-octagon-fill",
        texto: `Alerta: GAD-7 en rango ${lastGAD.interpretacion.toLowerCase()} (${lastGAD.puntaje_total} pts). Reforzar técnicas de regulación emocional.` });

    if (lastBDI?.puntaje_total >= 29)
      list.push({ tipo: "alerta", icono: "bi-exclamation-octagon-fill",
        texto: `Alerta BDI-II: depresión grave (${lastBDI.puntaje_total} pts). Considerar intervención intensiva o derivación.` });
    else if (lastBDI?.puntaje_total >= 20)
      list.push({ tipo: "advertencia", icono: "bi-exclamation-triangle-fill",
        texto: `BDI-II en rango moderado (${lastBDI.puntaje_total} pts). Monitorizar frecuencia de sesiones.` });

    if (lastBAI?.puntaje_total >= 26)
      list.push({ tipo: "alerta", icono: "bi-exclamation-octagon-fill",
        texto: `Alerta BAI: ansiedad grave (${lastBAI.puntaje_total} pts). Evaluar protocolo específico para trastorno de ansiedad.` });
    else if (lastBAI?.puntaje_total >= 16)
      list.push({ tipo: "advertencia", icono: "bi-exclamation-triangle-fill",
        texto: `BAI en rango moderado (${lastBAI.puntaje_total} pts). Intensificar técnicas de manejo de ansiedad.` });

    if (lastAUDIT?.puntaje_total >= 20)
      list.push({ tipo: "alerta", icono: "bi-cup-straw",
        texto: `AUDIT: posible dependencia alcohólica (${lastAUDIT.puntaje_total} pts). Derivar para evaluación especializada.` });
    else if (lastAUDIT?.puntaje_total >= 16)
      list.push({ tipo: "advertencia", icono: "bi-cup-straw",
        texto: `AUDIT: consumo de riesgo alto (${lastAUDIT.puntaje_total} pts). Abordar en sesiones de psicoeducación.` });
    else if (lastAUDIT?.puntaje_total >= 8)
      list.push({ tipo: "info", icono: "bi-cup-straw",
        texto: `AUDIT: consumo de riesgo moderado (${lastAUDIT.puntaje_total} pts). Intervención breve recomendada.` });

    if (lastWHODAS?.puntaje_total >= 25)
      list.push({ tipo: "advertencia", icono: "bi-person-wheelchair",
        texto: `WHODAS 2.0: discapacidad funcional moderada-grave (${lastWHODAS.puntaje_total} pts). Incorporar objetivos de funcionamiento al plan.` });

    // ── DASS-21 subscores ──────────────────────────────────────────────────
    if (lastDASS) {
      const sub = parseDASS21(lastDASS.interpretacion);
      if (sub) {
        if (sub.D >= 21)
          list.push({ tipo: "alerta", icono: "bi-cloud-rain-fill",
            texto: `DASS-21 Depresión grave-extrema (${sub.D} pts). Revisar diagnóstico y considerar derivación psiquiátrica.` });
        if (sub.A >= 15)
          list.push({ tipo: "advertencia", icono: "bi-lightning-fill",
            texto: `DASS-21 Ansiedad elevada (${sub.A} pts). Protocolo de relajación y regulación autónoma recomendado.` });
        if (sub.E >= 26)
          list.push({ tipo: "advertencia", icono: "bi-wind",
            texto: `DASS-21 Estrés elevado (${sub.E} pts). Explorar factores estresores y estrategias de afrontamiento.` });
      }
    }

    // ── Escalas infantiles ─────────────────────────────────────────────────
    if (lastCDI?.puntaje_total >= 20)
      list.push({ tipo: "alerta", icono: "bi-emoji-frown-fill",
        texto: `CDI: depresión moderada-grave en paciente infantil/adolescente (${lastCDI.puntaje_total} pts). Involucrar a la familia en el plan terapéutico.` });
    else if (lastCDI?.puntaje_total >= 13)
      list.push({ tipo: "advertencia", icono: "bi-emoji-frown-fill",
        texto: `CDI: síntomas depresivos leves (${lastCDI.puntaje_total} pts). Monitorizar en consultas.` });

    if (lastSCARED?.puntaje_total >= 45)
      list.push({ tipo: "alerta", icono: "bi-shield-exclamation",
        texto: `SCARED: alta probabilidad de trastorno de ansiedad en niño/adolescente (${lastSCARED.puntaje_total} pts). Evaluación diferencial recomendada.` });
    else if (lastSCARED?.puntaje_total >= 25)
      list.push({ tipo: "advertencia", icono: "bi-shield-exclamation",
        texto: `SCARED: síntomas de ansiedad moderada (${lastSCARED.puntaje_total} pts). Psicoeducación a padres y paciente.` });

    // ── Tendencias ─────────────────────────────────────────────────────────
    const tendencias = [
      { list: phq9List,  trend: trendPHQ9,  label: "PHQ-9",  tema: "depresivo" },
      { list: gad7List,  trend: trendGAD7,  label: "GAD-7",  tema: "ansiedad" },
      { list: bdiList,   trend: trendBDI,   label: "BDI-II", tema: "depresivo" },
      { list: baiList,   trend: trendBAI,   label: "BAI",    tema: "ansiedad" },
      { list: cdiList,   trend: trendCDI,   label: "CDI",    tema: "depresivo" },
      { list: scaredList,trend: trendSCARED,label: "SCARED", tema: "ansiedad" },
    ];

    tendencias.forEach(({ label, trend }) => {
      if (!trend) return;
      if (trend.diff < -3)
        list.push({ tipo: "exito", icono: "bi-graph-down-arrow",
          texto: `${label}: mejora significativa, bajó ${Math.abs(trend.diff)} puntos respecto al registro anterior.` });
      else if (trend.diff > 3)
        list.push({ tipo: "advertencia", icono: "bi-graph-up-arrow",
          texto: `${label}: incremento notable de ${trend.diff} puntos. Revisar evolución clínica.` });
    });

    // ── Mejora sostenida (3 registros descendentes) ────────────────────────
    [[phq9List, "PHQ-9"], [gad7List, "GAD-7"], [bdiList, "BDI-II"], [baiList, "BAI"]].forEach(([lst, lbl]) => {
      if (lst.length >= 3) {
        const last3 = lst.slice(-3).map(e => e.puntaje_total);
        if (last3[0] > last3[1] && last3[1] > last3[2])
          list.push({ tipo: "exito", icono: "bi-stars",
            texto: `Mejora sostenida en ${lbl}: tres registros consecutivos a la baja (${last3.join(" → ")} pts).` });
      }
    });

    // ── Comorbilidades ─────────────────────────────────────────────────────
    if (lastPHQ && lastGAD && lastPHQ.puntaje_total >= 10 && lastGAD.puntaje_total >= 10)
      list.push({ tipo: "info", icono: "bi-link-45deg",
        texto: "Comorbilidad depresión + ansiedad en rango moderado o superior. Considerar enfoque integrado." });

    if ((lastBDI?.puntaje_total >= 14 || lastPHQ?.puntaje_total >= 10) && lastAUDIT?.puntaje_total >= 8)
      list.push({ tipo: "advertencia", icono: "bi-link-45deg",
        texto: "Posible comorbilidad entre estado de ánimo y consumo de alcohol. Explorar uso como estrategia de afrontamiento." });

    // ── Adherencia ─────────────────────────────────────────────────────────
    if (diasUltimaEscala !== null && diasUltimaEscala > 30)
      list.push({ tipo: "advertencia", icono: "bi-clipboard2-x-fill",
        texto: `Sin escalas aplicadas en ${diasUltimaEscala} días. Reevaluar con las escalas de seguimiento habituales.` });

    if (!escalas.length)
      list.push({ tipo: "info", icono: "bi-clipboard2-pulse",
        texto: "No se han aplicado escalas aún. Inicia con PHQ-9 o GAD-7 para obtener una línea base." });

    if (diasUltimaSesion !== null && diasUltimaSesion > 21)
      list.push({ tipo: "advertencia", icono: "bi-calendar-x-fill",
        texto: `Última sesión hace ${diasUltimaSesion} días. Verificar continuidad del tratamiento.` });

    if (promDiasEntreSesiones !== null) {
      if (promDiasEntreSesiones <= 10)
        list.push({ tipo: "exito", icono: "bi-calendar-check-fill",
          texto: `Alta adherencia: promedio de ${promDiasEntreSesiones} días entre sesiones.` });
      else if (promDiasEntreSesiones > 21)
        list.push({ tipo: "info", icono: "bi-calendar-week-fill",
          texto: `Frecuencia baja: promedio ${promDiasEntreSesiones} días entre sesiones. Evaluar ajuste en el plan.` });
    }

    // ── Plan terapéutico ───────────────────────────────────────────────────
    if (plan) {
      const cumplidos = (plan.objetivos || []).filter(o => o.cumplido).length;
      const total = (plan.objetivos || []).length;
      if (total > 0 && cumplidos === total)
        list.push({ tipo: "exito", icono: "bi-trophy-fill",
          texto: `Plan terapéutico completado: los ${total} objetivos están marcados como cumplidos.` });
      else if (total > 0)
        list.push({ tipo: "neutro", icono: "bi-bullseye",
          texto: `Progreso del plan: ${cumplidos}/${total} objetivos cumplidos (${plan.progreso_general || 0}%).` });
    }

    if (!list.length)
      list.push({ tipo: "info", icono: "bi-info-circle-fill",
        texto: "Continúa registrando sesiones y escalas para obtener insights automáticos." });

    return list;
  }, [phq9List, gad7List, dass21List, bdiList, baiList, auditList, whodasList, cdiList, scaredList, cssrsList,
      trendPHQ9, trendGAD7, trendBDI, trendBAI, trendCDI, trendSCARED,
      diasUltimaEscala, diasUltimaSesion, promDiasEntreSesiones, plan, escalas]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!escalas.length && !sesiones.length) {
    return (
      <div style={{ ...card, textAlign: "center", padding: "48px 24px", color: "#9ca3af" }}>
        <i className="bi bi-bar-chart-line" style={{ fontSize: 48, color: "#c4b5fd", display: "block", marginBottom: 16 }} />
        <div style={{ fontWeight: 600 }}>Sin datos para analizar</div>
        <div style={{ fontSize: "0.82rem", marginTop: 6 }}>Registra sesiones y aplica escalas para ver el análisis automático.</div>
      </div>
    );
  }

  const hayRegistros = cssrsList.length || connersList.length || cbclList.length || wiscList.length;

  return (
    <div>

      {/* ── Cards de resumen ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: "0.73rem", fontWeight: 600, color: "#7c6f9f", marginBottom: 6 }}>Sesiones totales</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: PURPLE, lineHeight: 1, marginBottom: 4 }}>{sesiones.length}</div>
          <div style={{ fontSize: "0.73rem", color: "#9ca3af" }}>
            {diasUltimaSesion !== null ? `Última hace ${diasUltimaSesion}d` : "—"}
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: "0.73rem", fontWeight: 600, color: "#7c6f9f", marginBottom: 6 }}>Escalas aplicadas</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#2196f3", lineHeight: 1, marginBottom: 4 }}>{escalas.length}</div>
          <div style={{ fontSize: "0.73rem", color: "#9ca3af" }}>
            {diasUltimaEscala !== null ? `Última hace ${diasUltimaEscala}d` : "—"}
          </div>
        </div>

        {phq9List.length > 0 && (
          <SummaryCard label="Último PHQ-9" score={phq9List.at(-1).puntaje_total}
            interpretacion={phq9List.at(-1).interpretacion} trend={trendPHQ9} maxScore={27} />
        )}

        {gad7List.length > 0 && (
          <SummaryCard label="Último GAD-7" score={gad7List.at(-1).puntaje_total}
            interpretacion={gad7List.at(-1).interpretacion} trend={trendGAD7} maxScore={21} />
        )}

        {dass21List.length > 0 && <DASS21Card entry={dass21List.at(-1)} />}

        {bdiList.length > 0 && (
          <SummaryCard label="Último BDI-II" score={bdiList.at(-1).puntaje_total}
            interpretacion={bdiList.at(-1).interpretacion} trend={trendBDI} maxScore={63} colorFn={colorBDI} />
        )}

        {baiList.length > 0 && (
          <SummaryCard label="Último BAI" score={baiList.at(-1).puntaje_total}
            interpretacion={baiList.at(-1).interpretacion} trend={trendBAI} maxScore={63} colorFn={colorBAI} />
        )}

        {auditList.length > 0 && (
          <SummaryCard label="Último AUDIT" score={auditList.at(-1).puntaje_total}
            interpretacion={auditList.at(-1).interpretacion} maxScore={40} colorFn={colorAUDIT} />
        )}

        {whodasList.length > 0 && (
          <SummaryCard label="Último WHODAS" score={whodasList.at(-1).puntaje_total}
            interpretacion={whodasList.at(-1).interpretacion} maxScore={48} colorFn={scoreColor} />
        )}

        {cdiList.length > 0 && (
          <SummaryCard label="Último CDI" score={cdiList.at(-1).puntaje_total}
            interpretacion={cdiList.at(-1).interpretacion} trend={trendCDI} maxScore={54} colorFn={colorCDI} />
        )}

        {scaredList.length > 0 && (
          <SummaryCard label="Último SCARED" score={scaredList.at(-1).puntaje_total}
            interpretacion={scaredList.at(-1).interpretacion} trend={trendSCARED} maxScore={82} colorFn={colorSCARED} />
        )}

        {plan && (plan.objetivos || []).length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: "0.73rem", fontWeight: 600, color: "#7c6f9f", marginBottom: 6 }}>Progreso plan</div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#10b981", lineHeight: 1, marginBottom: 4 }}>{plan.progreso_general || 0}%</div>
            <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden", marginBottom: 4 }}>
              <div style={{ height: "100%", width: `${plan.progreso_general || 0}%`, background: "#10b981", borderRadius: 3, transition: "width .5s" }} />
            </div>
            <div style={{ fontSize: "0.73rem", color: "#9ca3af" }}>
              {(plan.objetivos || []).filter(o => o.cumplido).length}/{(plan.objetivos || []).length} objetivos
            </div>
          </div>
        )}
      </div>

      {/* ── Gráfica evolución escalas ─────────────────────────────────────── */}
      {timelineData.length >= 2 && (
        <div style={card}>
          <h6 style={sectionTitle}>
            <i className="bi bi-graph-up" style={{ color: PURPLE }} /> Evolución de escalas en el tiempo
          </h6>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={timelineData} margin={{ top: 8, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4"
                label={{ value: "Moderado", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }} />
              <ReferenceLine y={15} stroke="#ef4444" strokeDasharray="4 4"
                label={{ value: "Grave", position: "insideTopRight", fontSize: 9, fill: "#ef4444" }} />
              {seriesPresentes.map(s => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.name}
                  stroke={s.color} strokeWidth={2.5}
                  dot={{ r: 4, fill: s.color, strokeWidth: 0 }}
                  activeDot={{ r: 6 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Gráfica sesiones por mes ──────────────────────────────────────── */}
      {sesionesXMes.length >= 2 && (
        <div style={card}>
          <h6 style={sectionTitle}>
            <i className="bi bi-bar-chart-fill" style={{ color: "#2196f3" }} /> Adherencia — sesiones por mes
          </h6>
          {promDiasEntreSesiones !== null && (
            <div style={{ fontSize: "0.78rem", color: "#7c6f9f", marginBottom: 12 }}>
              Promedio entre sesiones: <strong style={{ color: PURPLE }}>{promDiasEntreSesiones} días</strong>
            </div>
          )}
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sesionesXMes} margin={{ top: 4, right: 16, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="total" name="Sesiones" fill={PURPLE} radius={[5, 5, 0, 0]} maxBarSize={52} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Registros clínicos (escalas de tipo registro) ─────────────────── */}
      {hayRegistros ? (
        <div style={card}>
          <h6 style={sectionTitle}>
            <i className="bi bi-journal-medical" style={{ color: "#059669" }} /> Últimos registros clínicos
          </h6>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {[
              { label: "C-SSRS", list: cssrsList, icon: "bi-shield-exclamation", color: "#ef4444" },
              { label: "Conners",list: connersList,icon: "bi-person-lines-fill",  color: "#7c3aed" },
              { label: "CBCL / BASC-3", list: cbclList, icon: "bi-people-fill",  color: "#0284c7" },
              { label: "WISC",  list: wiscList,  icon: "bi-lightbulb-fill",       color: "#f59e0b" },
            ].filter(x => x.list.length > 0).map(({ label, list, icon, color }) => {
              const last = list.at(-1);
              const r = typeof last.respuestas === "string" ? JSON.parse(last.respuestas) : (last.respuestas || {});
              const campos = Object.entries(r).slice(0, 4);
              return (
                <div key={label} style={{ background: "#f8f5ff", borderRadius: 12, padding: "12px 14px", border: `1px solid ${color}30` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                    <i className={`bi ${icon}`} style={{ color, fontSize: 15 }} />
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#1e1b4b" }}>{label}</span>
                    <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "#9ca3af" }}>
                      {dayjs(last.aplicado_en).format("DD/MM/YY")}
                    </span>
                  </div>
                  {campos.map(([k, v]) => (
                    <div key={k} style={{ fontSize: "0.75rem", color: "#374151", marginBottom: 3, display: "flex", gap: 6 }}>
                      <span style={{ color: "#9ca3af", textTransform: "capitalize", flexShrink: 0 }}>{k.replace(/_/g," ")}:</span>
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(v)}</span>
                    </div>
                  ))}
                  {last.interpretacion && (
                    <div style={{ marginTop: 6, fontSize: "0.73rem", color, fontWeight: 600, background: `${color}12`, borderRadius: 6, padding: "3px 7px" }}>
                      {last.interpretacion}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── Tabla resumen de escalas aplicadas ───────────────────────────── */}
      {escalas.filter(e => !ESCALAS_REGISTRO.includes(e.tipo_escala)).length > 0 && (
        <div style={card}>
          <h6 style={sectionTitle}>
            <i className="bi bi-link-45deg" style={{ color: "#f59e0b" }} /> Resumen de escalas cuantitativas
          </h6>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ background: "#f8f5ff" }}>
                  {["Fecha", "Escala", "Puntaje", "Clasificación"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Puntaje" ? "center" : "left", color: "#7c6f9f", fontWeight: 600, borderBottom: "2px solid #ede9fe", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...escalas]
                  .filter(e => !ESCALAS_REGISTRO.includes(e.tipo_escala))
                  .sort((a, b) => dayjs(b.aplicado_en).valueOf() - dayjs(a.aplicado_en).valueOf())
                  .map((e, i) => {
                    const colFn = e.tipo_escala === "BDIII" ? colorBDI
                      : e.tipo_escala === "BAI" ? colorBAI
                      : e.tipo_escala === "AUDIT" ? colorAUDIT
                      : e.tipo_escala === "CDI" ? colorCDI
                      : e.tipo_escala === "SCARED" ? colorSCARED
                      : scoreColor;
                    const col = colFn(e.puntaje_total);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 12px", color: "#374151", whiteSpace: "nowrap" }}>
                          {dayjs(e.aplicado_en).format("DD/MM/YY")}
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1e1b4b" }}>{e.tipo_escala}</td>
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <span style={{ fontWeight: 700, color: col }}>{e.puntaje_total}</span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ fontSize: "0.75rem", color: col, fontWeight: 600, background: `${col}18`, borderRadius: 6, padding: "2px 8px" }}>
                            {e.interpretacion}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Insights automáticos ──────────────────────────────────────────── */}
      <div style={card}>
        <h6 style={sectionTitle}>
          <i className="bi bi-lightbulb-fill" style={{ color: "#f59e0b" }} /> Análisis e insights automáticos
        </h6>
        {insights.map((ins, i) => <InsightBadge key={i} {...ins} />)}
      </div>

    </div>
  );
}
