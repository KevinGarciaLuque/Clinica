/**
 * CurvaCrecimiento.jsx — Módulo de Curvas de Crecimiento OMS
 * Gráfica interactiva con historial, Z-score y percentiles
 */
import { useEffect, useState, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Area, ComposedChart,
} from "recharts";
import api from "../api/api";

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════

const INDICADORES = [
  { key: "peso-edad",  label: "Peso / Edad",   labelCorto: "P/E",   unidad: "kg",    campo: "peso_kg",  yLabel: "Peso (kg)" },
  { key: "talla-edad", label: "Talla / Edad",   labelCorto: "T/E",   unidad: "cm",    campo: "talla_cm", yLabel: "Talla (cm)" },
  { key: "peso-talla", label: "Peso / Talla",   labelCorto: "P/T",   unidad: "kg",    campo: "peso_kg",  yLabel: "Peso (kg)" },
  { key: "imc-edad",   label: "IMC / Edad",     labelCorto: "IMC/E", unidad: "kg/m²", campo: "imc",      yLabel: "IMC (kg/m²)" },
  { key: "pc-edad",    label: "Per. Cefálico / Edad", labelCorto: "PC/E",  unidad: "cm",  campo: "perimetro_cefalico_cm", yLabel: "P.C. (cm)" },
];

const ZONE_COLORS = {
  normal:  { bg: "rgba(16,185,129,0.08)", text: "#10b981", label: "Normal" },
  riesgo:  { bg: "rgba(251,191,36,0.08)", text: "#f59e0b", label: "Riesgo" },
  alerta:  { bg: "rgba(239,68,68,0.08)",  text: "#ef4444", label: "Alerta" },
};

const C = {
  accent: "#166ae8", accentD: "#1f6bbd",
  card: "#ffffff", border: "rgba(0,0,0,0.1)",
  text: "#1a1a1a", muted: "#6c757d", inputBg: "#ffffff",
};

const inputSt = {
  background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", width: "100%", fontSize: 14, outline: "none",
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function clasificarZscore(z) {
  if (z === null || z === undefined) return null;
  const abs = Math.abs(z);
  if (abs <= 1) return "normal";
  if (abs <= 2) return "riesgo";
  return "alerta";
}

function interpretarZscore(indicador, z) {
  if (z === null || z === undefined) return "Sin datos";
  if (indicador === "peso-edad" || indicador === "imc-edad") {
    if (z < -3) return "Desnutrición severa";
    if (z < -2) return "Bajo peso";
    if (z <= 1) return "Normal";
    if (z <= 2) return "Sobrepeso";
    return "Obesidad";
  }
  if (indicador === "talla-edad") {
    if (z < -3) return "Talla baja severa";
    if (z < -2) return "Talla baja";
    if (z <= 2) return "Normal";
    return "Talla alta";
  }
  if (indicador === "pc-edad") {
    if (z < -2) return "Microcefalia";
    if (z <= 2) return "Normal";
    return "Macrocefalia";
  }
  if (indicador === "peso-talla") {
    if (z < -3) return "Emaciación severa";
    if (z < -2) return "Emaciado";
    if (z <= 1) return "Normal";
    if (z <= 2) return "Riesgo sobrepeso";
    return "Sobrepeso";
  }
  return "—";
}

function calcEdadMeses(fechaNac, fechaMedicion) {
  const nac = new Date(fechaNac);
  const med = new Date(fechaMedicion);
  let meses = (med.getFullYear() - nac.getFullYear()) * 12;
  meses += med.getMonth() - nac.getMonth();
  const diasDif = med.getDate() - nac.getDate();
  if (diasDif < 0) meses -= 1;
  return Math.max(0, Math.round(meses * 100) / 100);
}

function formatEdadTexto(fechaNac) {
  if (!fechaNac) return null;
  const nac = new Date(fechaNac);
  const hoy = new Date();
  let anios = hoy.getFullYear() - nac.getFullYear();
  let meses = hoy.getMonth() - nac.getMonth();
  let dias = hoy.getDate() - nac.getDate();
  if (dias < 0) { meses--; }
  if (meses < 0) { anios--; meses += 12; }
  const partes = [];
  if (anios > 0) partes.push(`${anios} año${anios > 1 ? "s" : ""}`);
  if (meses > 0) partes.push(`${meses} mes${meses > 1 ? "es" : ""}`);
  if (anios === 0 && meses === 0) partes.push(`${Math.max(0, dias)} día${dias !== 1 ? "s" : ""}`);
  return partes.join(", ");
}

function formatFechaNac(fechaNac) {
  if (!fechaNac) return null;
  return new Date(fechaNac).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

// ═══════════════════════════════════════════════════════════
// HELPER PURO: construye datos para cualquier indicador
// ═══════════════════════════════════════════════════════════
function buildChartData(indKey, meds, curvasRef) {
  if (!curvasRef) return [];
  const indInf   = INDICADORES.find(i => i.key === indKey);
  const isPT     = indKey === "peso-talla";
  const xKey     = isPT ? "talla" : "mes";
  const puntosRef = curvasRef["z0"] || [];

  const data = puntosRef.map(p => {
    const punto = { [xKey]: p[xKey] };
    [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
      const curva = curvasRef[`z${z}`];
      if (curva) {
        const match = curva.find(c => c[xKey] === p[xKey]);
        if (match) punto[`z${z}`] = match.valor;
      }
    });
    return punto;
  });

  meds.forEach(m => {
    if (isPT) {
      const peso = m.peso_kg, talla = m.talla_cm;
      if (!peso || !talla) return;
      const t   = parseFloat(talla);
      const idx = data.findIndex(d => d.talla >= t);
      const newPt = { talla: t, paciente: parseFloat(peso) };
      [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
        const curva = curvasRef[`z${z}`];
        if (!curva) return;
        const ci = curva.findIndex(c => c.talla >= t);
        if (ci > 0) {
          const a = curva[ci - 1], b = curva[ci];
          const frac = (t - a.talla) / (b.talla - a.talla);
          newPt[`z${z}`] = Math.round((a.valor + frac * (b.valor - a.valor)) * 100) / 100;
        } else if (ci === 0) { newPt[`z${z}`] = curva[0].valor; }
      });
      if (idx === -1) data.push(newPt);
      else if (Math.abs(data[idx].talla - t) < 0.5) data[idx].paciente = parseFloat(peso);
      else data.splice(idx, 0, newPt);
    } else {
      const valor = m[indInf.campo];
      if (valor === null || valor === undefined) return;
      const idx = data.findIndex(d => d.mes >= m.edad_meses);
      const newPt = { mes: m.edad_meses, paciente: parseFloat(valor) };
      [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
        const curva = curvasRef[`z${z}`];
        if (!curva) return;
        const ci = curva.findIndex(c => c.mes >= m.edad_meses);
        if (ci > 0) {
          const a = curva[ci - 1], b = curva[ci];
          const frac = (m.edad_meses - a.mes) / (b.mes - a.mes);
          newPt[`z${z}`] = Math.round((a.valor + frac * (b.valor - a.valor)) * 100) / 100;
        } else if (ci === 0) { newPt[`z${z}`] = curva[0].valor; }
      });
      if (idx === -1) data.push(newPt);
      else if (Math.abs(data[idx].mes - m.edad_meses) < 0.5) data[idx].paciente = parseFloat(valor);
      else data.splice(idx, 0, newPt);
    }
  });

  return data.sort((a, b) => (a[xKey] || 0) - (b[xKey] || 0));
}

function escHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function zColorHex(z) {
  if (z === null || z === undefined) return "#6c757d";
  const a = Math.abs(z);
  if (a <= 1) return "#10b981";
  if (a <= 2) return "#f59e0b";
  return "#ef4444";
}

function generateConsolidadoHTML(svgSections, mediciones, sexoPaciente, fechaNacimiento) {
  const edadTxt = fechaNacimiento ? formatEdadTexto(fechaNacimiento) : "";
  const nacTxt  = fechaNacimiento ? formatFechaNac(fechaNacimiento)  : "";
  const hoy     = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  const ultima  = mediciones.length > 0 ? mediciones[mediciones.length - 1] : null;

  const resumenRows = [
    { label: "Peso / Edad",           indKey: "peso-edad",   z: ultima?.zscore_peso_edad,   p: ultima?.percentil_peso_edad,   val: ultima?.peso_kg,               unit: "kg"    },
    { label: "Talla / Edad",          indKey: "talla-edad",  z: ultima?.zscore_talla_edad,  p: ultima?.percentil_talla_edad,  val: ultima?.talla_cm,              unit: "cm"    },
    { label: "Peso / Talla",          indKey: "peso-talla",  z: ultima?.zscore_peso_talla,  p: ultima?.percentil_peso_talla,  val: ultima?.peso_kg,               unit: "kg"    },
    { label: "IMC / Edad",            indKey: "imc-edad",    z: ultima?.zscore_imc_edad,    p: ultima?.percentil_imc_edad,    val: ultima?.imc,                   unit: "kg/m²" },
    { label: "Per. Cefálico / Edad",  indKey: "pc-edad",     z: ultima?.zscore_pc_edad,     p: ultima?.percentil_pc_edad,     val: ultima?.perimetro_cefalico_cm, unit: "cm"    },
  ];

  const resumenHtml = ultima
    ? `<table class="tbl-res">
        <thead><tr><th>Indicador</th><th>Valor</th><th>Z-Score</th><th>Percentil</th><th>Estado</th></tr></thead>
        <tbody>
          ${resumenRows.filter(r => r.val !== null && r.val !== undefined).map(r => {
            const col = zColorHex(r.z);
            return `<tr>
              <td><strong>${r.label}</strong></td>
              <td>${Number(r.val).toFixed(1)} ${escHtml(r.unit)}</td>
              <td style="color:${col};font-weight:700">${r.z !== null && r.z !== undefined ? Number(r.z).toFixed(2) : "—"}</td>
              <td>P${r.p !== null && r.p !== undefined ? Number(r.p).toFixed(0) : "—"}</td>
              <td><span style="background:${col}20;color:${col};border:1px solid ${col}50;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;text-transform:uppercase">${interpretarZscore(r.indKey, r.z)}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`
    : `<p style="color:#888;font-style:italic">Sin mediciones registradas</p>`;

  const historialRows = [...mediciones].reverse().map(m => {
    const anios  = Math.floor(m.edad_meses / 12);
    const mesesR = Math.round(m.edad_meses % 12);
    const edadStr = `${anios > 0 ? anios + "a " : ""}${mesesR}m`;
    const fmt = (v, dec = 2) => (v !== null && v !== undefined ? Number(v).toFixed(dec) : "—");
    return `<tr>
      <td>${new Date(m.fecha_medicion).toLocaleDateString("es-PE")}</td>
      <td>${edadStr}</td>
      <td>${m.peso_kg ?? "—"}</td>
      <td>${m.talla_cm ?? "—"}</td>
      <td>${m.imc ? Number(m.imc).toFixed(1) : "—"}</td>
      <td>${m.perimetro_cefalico_cm ?? "—"}</td>
      <td style="color:${zColorHex(m.zscore_peso_edad)};font-weight:700">${fmt(m.zscore_peso_edad)}</td>
      <td style="color:${zColorHex(m.zscore_talla_edad)};font-weight:700">${fmt(m.zscore_talla_edad)}</td>
      <td style="color:${zColorHex(m.zscore_peso_talla)};font-weight:700">${fmt(m.zscore_peso_talla)}</td>
      <td style="color:${zColorHex(m.zscore_imc_edad)};font-weight:700">${fmt(m.zscore_imc_edad)}</td>
      <td style="color:${zColorHex(m.zscore_pc_edad)};font-weight:700">${fmt(m.zscore_pc_edad)}</td>
      <td style="color:#888;font-style:italic;max-width:120px">${escHtml(m.notas) || "—"}</td>
    </tr>`;
  }).join("");

  const chartsHtml = svgSections.map(({ ind, svg }) => `
    <div class="chart-sec">
      <div class="chart-hdr">
        <span class="ind-pill">${escHtml(ind.labelCorto)}</span>
        ${escHtml(ind.label)} &mdash; ${sexoPaciente === "M" ? "Niños" : "Niñas"}
      </div>
      ${svg
        ? `<div style="padding:8px">${svg}</div>`
        : `<div style="padding:28px;text-align:center;color:#aaa;font-style:italic">Gráfica no disponible</div>`}
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte Consolidado — Curvas de Crecimiento OMS</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; }
    .tip-descarga { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 16px; margin-bottom: 16px; font-size: 12px; color: #1d4ed8; display: flex; align-items: center; gap: 8px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #166ae8; padding-bottom: 10px; margin-bottom: 14px; }
    .header h1 { font-size: 17px; color: #166ae8; margin-bottom: 3px; }
    .header p { font-size: 11px; color: #555; margin-top: 2px; }
    .header-right { text-align: right; font-size: 11px; color: #555; }
    .sec-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #166ae8; border-left: 3px solid #166ae8; padding: 3px 0 3px 8px; margin-bottom: 8px; margin-top: 14px; }
    .tbl-res { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .tbl-res th { background: linear-gradient(135deg,#214a87,#176DC8); color: #fff; padding: 7px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; text-align: left; }
    .tbl-res td { padding: 7px 12px; border-bottom: 1px solid #e9ecef; font-size: 12px; }
    .tbl-res tr:nth-child(even) td { background: #f8f9fa; }
    .tbl-hist { width: 100%; border-collapse: collapse; font-size: 10px; }
    .tbl-hist th { background: linear-gradient(135deg,#214a87,#176DC8); color: #fff; padding: 5px 7px; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; text-align: left; }
    .tbl-hist td { padding: 5px 7px; border-bottom: 1px solid #e9ecef; }
    .tbl-hist tr:nth-child(even) td { background: #f8f9fa; }
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px; }
    .chart-sec { border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; }
    .chart-hdr { background: #f4f6fb; padding: 6px 12px; font-size: 12px; font-weight: 700; color: #214a87; border-bottom: 1px solid #e9ecef; display: flex; align-items: center; gap: 8px; }
    .ind-pill { background: #166ae8; color: #fff; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .chart-sec svg { width: 100%; height: auto; max-height: 270px; display: block; }
    .legend { display: flex; gap: 14px; justify-content: flex-end; margin-bottom: 8px; font-size: 10px; }
    .legend span { display: flex; align-items: center; gap: 4px; }
    .leg-l { width: 14px; height: 2px; border-radius: 1px; display: inline-block; }
    .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #dee2e6; display: flex; justify-content: space-between; font-size: 9px; color: #aaa; }
    @media print { .no-print { display: none !important; } .chart-sec { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📈 Reporte Consolidado &mdash; Curvas de Crecimiento OMS</h1>
      <p>${sexoPaciente === "M" ? "Paciente masculino" : "Paciente femenino"} &nbsp;·&nbsp; ${mediciones.length} medición${mediciones.length !== 1 ? "es" : ""} registrada${mediciones.length !== 1 ? "s" : ""}</p>
    </div>
    <div class="header-right">
      <p style="font-weight:700;color:#166ae8">Generado: ${hoy}</p>
      ${nacTxt ? `<p>F. Nac: ${escHtml(nacTxt)}</p>` : ""}
      ${edadTxt ? `<p>Edad actual: ${escHtml(edadTxt)}</p>` : ""}
    </div>
  </div>
  ${ultima ? `
  <div class="sec-title">Resumen &mdash; Última medición (${new Date(ultima.fecha_medicion).toLocaleDateString("es-PE")})</div>
  ${resumenHtml}` : ""}

  <div class="sec-title">Curvas de Crecimiento &mdash; Estándares OMS</div>
  <div class="legend">
    <span><span class="leg-l" style="background:#10b981"></span> Normal (±1 DE)</span>
    <span><span class="leg-l" style="background:#f59e0b"></span> Riesgo (±2 DE)</span>
    <span><span class="leg-l" style="background:#ef4444"></span> Alerta (±3 DE)</span>
    <span><span class="leg-l" style="background:#166ae8"></span> Paciente</span>
  </div>
  <div class="charts-grid">${chartsHtml}</div>

  ${mediciones.length > 0 ? `
  <div class="sec-title" style="margin-top:18px">Historial completo de mediciones</div>
  <div style="overflow-x:auto">
    <table class="tbl-hist">
      <thead><tr>
        <th>Fecha</th><th>Edad</th><th>Peso(kg)</th><th>Talla(cm)</th><th>IMC</th><th>P.C.(cm)</th>
        <th>Z P/E</th><th>Z T/E</th><th>Z P/T</th><th>Z IMC</th><th>Z PC</th><th>Notas</th>
      </tr></thead>
      <tbody>${historialRows}</tbody>
    </table>
  </div>` : ""}

  <div class="footer">
    <span>Estándares de Crecimiento OMS &mdash; Organización Mundial de la Salud</span>
    <span>Generado el ${hoy}</span>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════

export default function CurvaCrecimiento({ pacienteId, sexo, fechaNacimiento }) {
  const [mediciones, setMediciones] = useState([]);
  const [curvasRef, setCurvasRef] = useState(null);
  const [indicador, setIndicador] = useState("peso-edad");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [isMobile,  setIsMobile]  = useState(window.innerWidth < 640);
  const [isTablet,  setIsTablet]  = useState(window.innerWidth < 960);

  // estados para reporte consolidado
  const [todasCurvas,        setTodasCurvas]        = useState({});
  const [showMenuImprimir,   setShowMenuImprimir]   = useState(false);
  const [showMenuDescargar,  setShowMenuDescargar]  = useState(false);
  const [generandoConsolidado, setGenerandoConsolidado] = useState(false);
  const hiddenChartsRef = useRef({});

  // rango OMS: "0_5" = Estándares 0-5 años | "5_19" = Referencia 5-19 años
  const [rango, setRango] = useState("0_5");

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 640);
      setIsTablet(window.innerWidth < 960);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handler = () => { setShowMenuImprimir(false); setShowMenuDescargar(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sexoPaciente = (sexo || "M").toUpperCase();
  const indInfo = INDICADORES.find(i => i.key === indicador);
  const isPesoTalla = indicador === "peso-talla";

  // Indicadores sin datos OMS para 5-19 años
  const INDICADORES_SIN_519 = ["pc-edad", "peso-talla"];
  const handleRangoChange = (nuevoRango) => {
    if (nuevoRango === "5_19" && INDICADORES_SIN_519.includes(indicador)) {
      setIndicador("talla-edad");
    }
    setRango(nuevoRango);
  };
  const xKey = isPesoTalla ? "talla" : "mes";
  const chartRef = useRef(null);

  const [form, setForm] = useState({
    fecha_medicion: new Date().toISOString().split("T")[0],
    peso_kg: "", talla_cm: "", perimetro_cefalico_cm: "", notas: "",
  });

  // ─────────────────────────────────────────────────────────
  // CARGA DE DATOS
  // ─────────────────────────────────────────────────────────
  const cargarMediciones = useCallback(async () => {
    try {
      const res = await api.get(`/crecimiento/${pacienteId}`);
      setMediciones(res.data.data || []);
    } catch (err) {
      console.error("Error cargando mediciones:", err);
    }
  }, [pacienteId]);

  const cargarCurvasRef = useCallback(async () => {
    try {
      setCurvasRef(null);
      const params = rango === "5_19" ? "?rango=5_19" : "";
      const res = await api.get(`/crecimiento/referencia/${indicador}/${sexoPaciente}${params}`);
      setCurvasRef(res.data.data);
    } catch (err) {
      console.error("Error cargando curvas referencia:", err);
      setCurvasRef(null);
    }
  }, [indicador, sexoPaciente, rango]);

  // Carga las 5 curvas de referencia para el reporte consolidado
  const cargarTodasCurvas = useCallback(async () => {
    const resultados = {};
    await Promise.all(INDICADORES.map(async (ind) => {
      try {
        const res = await api.get(`/crecimiento/referencia/${ind.key}/${sexoPaciente}`);
        resultados[ind.key] = res.data.data;
      } catch { /* silencio */ }
    }));
    setTodasCurvas(resultados);
  }, [sexoPaciente]);

  useEffect(() => {
    setLoading(true);
    Promise.all([cargarMediciones(), cargarCurvasRef()])
      .finally(() => setLoading(false));
  }, [cargarMediciones, cargarCurvasRef]);

  useEffect(() => { cargarTodasCurvas(); }, [cargarTodasCurvas]);

  // ─────────────────────────────────────────────────────────
  // GUARDAR MEDICIÓN
  // ─────────────────────────────────────────────────────────
  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMsg({ tipo: "", texto: "" });

    const edadMeses = fechaNacimiento
      ? calcEdadMeses(fechaNacimiento, form.fecha_medicion)
      : 0;

    try {
      await api.post(`/crecimiento/${pacienteId}`, {
        ...form,
        edad_meses: edadMeses,
      });
      setMsg({ tipo: "success", texto: "Medición registrada correctamente" });
      setShowForm(false);
      setForm({
        fecha_medicion: new Date().toISOString().split("T")[0],
        peso_kg: "", talla_cm: "", perimetro_cefalico_cm: "", notas: "",
      });
      await Promise.all([cargarMediciones(), cargarCurvasRef()]);
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al guardar" });
    } finally {
      setGuardando(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // ELIMINAR MEDICIÓN
  // ─────────────────────────────────────────────────────────
  const eliminarMedicion = async (medId) => {
    if (!window.confirm("¿Eliminar esta medición?")) return;
    try {
      await api.delete(`/crecimiento/${pacienteId}/${medId}`);
      setMsg({ tipo: "success", texto: "Medición eliminada" });
      await cargarMediciones();
    } catch {
      setMsg({ tipo: "danger", texto: "Error al eliminar" });
    }
  };

  // ─────────────────────────────────────────────────────────
  // PREPARAR DATOS PARA LA GRÁFICA
  // ─────────────────────────────────────────────────────────
  const chartData = buildChartData(indicador, mediciones, curvasRef);

  // ─────────────────────────────────────────────────────────
  // TOOLTIP PERSONALIZADO
  // ─────────────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const pacData = payload.find(p => p.dataKey === "paciente");

    let headerText;
    if (isPesoTalla) {
      headerText = `Talla: ${label} cm`;
    } else {
      const anios = Math.floor(label / 12);
      const mesesResto = Math.round(label % 12);
      headerText = `Edad: ${anios > 0 ? `${anios}a ` : ""}${mesesResto}m`;
    }

    return (
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
        padding: "12px 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        fontSize: 13,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: C.text }}>
          {headerText}
        </div>
        {pacData && (
          <div style={{ color: C.accent, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {indInfo.label}: {pacData.value} {indInfo.unidad}
          </div>
        )}
        {payload.filter(p => p.dataKey !== "paciente").map(p => (
          <div key={p.dataKey} style={{ color: p.color, fontSize: 11 }}>
            {p.dataKey.replace("z", "Z ")}: {p.value}
          </div>
        ))}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────
  // IMPRIMIR / DESCARGAR — curva actual (una sola)
  // ─────────────────────────────────────────────────────────
  const abrirVentanaCurvaActual = (autoPrint) => {
    const el = chartRef.current;
    if (!el) return;
    const svgEl = el.querySelector(".recharts-wrapper svg");
    if (!svgEl) return;

    const clone = svgEl.cloneNode(true);
    const w = svgEl.getAttribute("width") || svgEl.getBoundingClientRect().width;
    const h = svgEl.getAttribute("height") || svgEl.getBoundingClientRect().height;
    clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
    clone.setAttribute("width", "100%");
    clone.setAttribute("height", "auto");
    clone.removeAttribute("style");
    const svgData = new XMLSerializer().serializeToString(clone);

    const edadTxt  = fechaNacimiento ? formatEdadTexto(fechaNacimiento) : "";
    const nacTxt   = fechaNacimiento ? formatFechaNac(fechaNacimiento) : "";
    const infoExtra = fechaNacimiento ? `F. Nac: ${nacTxt} · Edad actual: ${edadTxt}` : "";
    const hoy = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
    const win = window.open("", "_blank", "width=1050,height=750");
    if (!win) return;
    win.document.write(`<html><head><title>Curva de Crecimiento - ${escHtml(indInfo.label)}</title>
      <style>
        @page{size:landscape;margin:12mm}
        *{box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;padding:20px 30px;text-align:center;color:#1a1a1a;margin:0}
        h2{margin:0 0 2px;font-size:17px;color:#166ae8}
        .sub{margin:0 0 4px;color:#6c757d;font-size:12px}
        .info{margin:0 0 12px;color:#166ae8;font-size:12px;font-weight:600}
        .chart-wrap{width:100%;max-height:65vh;display:flex;justify-content:center}
        .chart-wrap svg{width:100%;height:auto;max-height:60vh}
        .legend{display:flex;justify-content:center;gap:18px;margin-top:10px;font-size:10px}
        .legend span{display:flex;align-items:center;gap:4px}
        .line{width:12px;height:3px;border-radius:2px;display:inline-block}
        .footer{margin-top:12px;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:6px}
        @media print{body{padding:8px 20px} .no-print{display:none!important}}
      </style></head><body>
      <h2>Curva de Crecimiento: ${escHtml(indInfo.label)}</h2>
      <p class="sub">${sexoPaciente === "M" ? "Niños" : "Niñas"} — Estándares OMS · ${mediciones.length} medición${mediciones.length !== 1 ? "es" : ""}</p>
      ${infoExtra ? `<p class="info">${infoExtra}</p>` : ""}
      <div class="chart-wrap">${svgData}</div>
      <div class="legend">
        <span><span class="line" style="background:#10b981"></span> Normal (±1 DE)</span>
        <span><span class="line" style="background:#f59e0b"></span> Riesgo (±2 DE)</span>
        <span><span class="line" style="background:#ef4444"></span> Alerta (±3 DE)</span>
      </div>
      <div class="footer">Generado el ${hoy} — Estándares de Crecimiento OMS</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handlePrint           = () => abrirVentanaCurvaActual(true);
  const handleDescargarActual  = () => abrirVentanaCurvaActual(false);

  // ─────────────────────────────────────────────────────────
  // IMPRIMIR / DESCARGAR — consolidado (5 curvas)
  // ─────────────────────────────────────────────────────────
  const handleConsolidado = async (modo) => {
    setShowMenuImprimir(false);
    setShowMenuDescargar(false);
    setGenerandoConsolidado(true);

    // Esperar a que las gráficas ocultas estén renderizadas
    await new Promise(r => setTimeout(r, 600));

    const svgSections = INDICADORES.map(ind => {
      const container = hiddenChartsRef.current[ind.key];
      if (!container) return { ind, svg: null };
      const svgEl = container.querySelector(".recharts-wrapper svg");
      if (!svgEl) return { ind, svg: null };
      const clone = svgEl.cloneNode(true);
      const w = svgEl.getAttribute("width") || svgEl.getBoundingClientRect().width;
      const h = svgEl.getAttribute("height") || svgEl.getBoundingClientRect().height;
      clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
      clone.setAttribute("width", "100%");
      clone.setAttribute("height", "auto");
      clone.removeAttribute("style");
      return { ind, svg: new XMLSerializer().serializeToString(clone) };
    });

    const html = generateConsolidadoHTML(svgSections, mediciones, sexoPaciente, fechaNacimiento);
    const win  = window.open("", "_blank", "width=1200,height=900");
    if (!win) { setGenerandoConsolidado(false); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      setGenerandoConsolidado(false);
    }, 700);
  };

  // ─────────────────────────────────────────────────────────
  // Z-SCORE COLUMNS para la tabla
  // ─────────────────────────────────────────────────────────
  function getZscoreField(m) {
    switch (indicador) {
      case "peso-edad": return { z: m.zscore_peso_edad, p: m.percentil_peso_edad };
      case "talla-edad": return { z: m.zscore_talla_edad, p: m.percentil_talla_edad };
      case "imc-edad": return { z: m.zscore_imc_edad, p: m.percentil_imc_edad };
      case "pc-edad": return { z: m.zscore_pc_edad, p: m.percentil_pc_edad };
      case "peso-talla": return { z: m.zscore_peso_talla, p: m.percentil_peso_talla };
      default: return { z: null, p: null };
    }
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "100%", overflow: "hidden" }}>
      {/* Mensaje */}
      {msg.texto && (
        <div className={`alert alert-${msg.tipo} alert-dismissible fade show mb-3`}>
          <i className={`bi ${msg.tipo === "success" ? "bi-check-circle" : "bi-exclamation-triangle"} me-2`} />
          {msg.texto}
          <button type="button" className="btn-close" onClick={() => setMsg({ tipo: "", texto: "" })} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* HEADER + SELECTOR DE INDICADOR                       */}
      {/* ══════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", flexDirection: "column",
        gap: 10, marginBottom: isMobile ? 14 : 20,
      }}>
        {/* Fila 1: Tabs indicadores + switch de rango */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{
            display: "flex", gap: 4, overflowX: "auto", WebkitOverflowScrolling: "touch",
            paddingBottom: 2, flexShrink: 0,
          }}>
            {INDICADORES.map(ind => {
              const deshabilitado = rango === "5_19" && ["pc-edad", "peso-talla"].includes(ind.key);
              return (
                <button
                  key={ind.key}
                  onClick={() => !deshabilitado && setIndicador(ind.key)}
                  title={deshabilitado ? "No disponible para 5–19 años (OMS)" : ""}
                  style={{
                    padding: isMobile ? "6px 10px" : "8px 16px", borderRadius: 8,
                    fontSize: isMobile ? 11 : 13, fontWeight: 600, whiteSpace: "nowrap",
                    border: indicador === ind.key ? "none" : `1px solid ${C.border}`,
                    background: indicador === ind.key
                      ? `linear-gradient(135deg, ${C.accent}, ${C.accentD})`
                      : "transparent",
                    color: deshabilitado ? "#ccc" : indicador === ind.key ? "#fff" : C.muted,
                    cursor: deshabilitado ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease", flexShrink: 0,
                    opacity: deshabilitado ? 0.45 : 1,
                  }}
                >
                  {isMobile ? ind.labelCorto : ind.label}
                </button>
              );
            })}
          </div>
          {/* ── Switch rango OMS ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: isMobile ? 9 : 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>
              Ref. OMS:
            </span>
            <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              {[
                { v: "0_5",  label: isMobile ? "0–5a" : "0–5 años" },
                { v: "5_19", label: isMobile ? "5–19a" : "5–19 años" },
              ].map(r => (
                <button
                  key={r.v}
                  onClick={() => handleRangoChange(r.v)}
                  style={{
                    padding: isMobile ? "4px 9px" : "5px 13px",
                    border: "none",
                    background: rango === r.v ? C.accent : "transparent",
                    color: rango === r.v ? "#fff" : C.muted,
                    fontWeight: 600, fontSize: isMobile ? 10 : 11,
                    cursor: "pointer", transition: "all 0.2s ease",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {rango === "5_19" && indicador === "peso-edad" && (
              <span style={{ fontSize: 10, color: "#f59e0b", fontStyle: "italic" }}>
                Solo hasta 10a (OMS)
              </span>
            )}
            {rango === "5_19" && (
              <span style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>
                WHO Growth Ref. 2007
              </span>
            )}
          </div>
        </div>

        {/* Fila 2: Botones acción — siempre en fila, scrollable en móvil */}
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          overflowX: "auto", WebkitOverflowScrolling: "touch",
          paddingBottom: 2,
        }}>

          {/* ── Botón IMPRIMIR con dropdown ── */}
          <div style={{ position: "relative", flexShrink: 0 }} onMouseDown={e => e.stopPropagation()}>
            <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", width: "100%" }}>
              <button
                onClick={handlePrint}
                style={{
                  background: "transparent", border: "none",
                  borderRight: `1px solid ${C.border}`,
                  padding: isMobile ? "9px 10px" : "10px 14px",
                  color: C.muted, fontWeight: 600, fontSize: isMobile ? 12 : 13,
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 5, flex: 1,
                }}
                title="Imprimir curva actual"
              >
                <i className="bi bi-printer" />
                <span>{isMobile ? "Impr." : "Imprimir"}</span>
              </button>
              <button
                onClick={() => { setShowMenuImprimir(v => !v); setShowMenuDescargar(false); }}
                style={{ background: "transparent", border: "none", padding: "9px 8px", color: C.muted, cursor: "pointer", fontSize: 11, flexShrink: 0 }}
                title="Más opciones de impresión"
              >
                <i className="bi bi-chevron-down" />
              </button>
            </div>
            {showMenuImprimir && (
              <div style={{
                position: "absolute", top: "calc(100% + 5px)",
                left: 0, right: "auto", zIndex: 300,
                background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10,
                boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
                width: "min(260px, calc(100vw - 24px))", overflow: "hidden",
              }}>
                <div style={{ padding: "8px 14px 5px", fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", borderBottom: `1px solid ${C.border}` }}>
                  Opciones de impresión
                </div>
                <button
                  onClick={() => { handlePrint(); setShowMenuImprimir(false); }}
                  style={{ width: "100%", background: "none", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontSize: 13, color: C.text, display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${C.border}` }}
                >
                  <i className="bi bi-printer" style={{ color: C.accent, fontSize: 15, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Imprimir esta curva</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{indInfo?.label}</div>
                  </div>
                </button>
                <button
                  onClick={() => handleConsolidado("print")}
                  disabled={generandoConsolidado}
                  style={{ width: "100%", background: "none", border: "none", padding: "12px 14px", textAlign: "left", cursor: generandoConsolidado ? "wait" : "pointer", fontSize: 13, color: C.text, display: "flex", alignItems: "center", gap: 10, opacity: generandoConsolidado ? 0.7 : 1 }}
                >
                  {generandoConsolidado
                    ? <><span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} /> <span>Generando...</span></>
                    : <>
                        <i className="bi bi-printer-fill" style={{ color: "#7c3aed", fontSize: 15, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>Imprimir consolidado</div>
                          <div style={{ fontSize: 11, color: C.muted }}>5 curvas + historial completo</div>
                        </div>
                      </>
                  }
                </button>
              </div>
            )}
          </div>

          {/* ── Botón DESCARGAR con dropdown ── */}
          <div style={{ position: "relative", flexShrink: 0 }} onMouseDown={e => e.stopPropagation()}>
            <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", width: "100%" }}>
              <button
                onClick={handleDescargarActual}
                style={{
                  background: "transparent", border: "none",
                  borderRight: `1px solid ${C.border}`,
                  padding: isMobile ? "9px 10px" : "10px 14px",
                  color: C.muted, fontWeight: 600, fontSize: isMobile ? 12 : 13,
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 5, flex: 1,
                }}
                title="Descargar esta curva como PDF"
              >
                <i className="bi bi-download" />
                <span>{isMobile ? "PDF" : "Descargar"}</span>
              </button>
              <button
                onClick={() => { setShowMenuDescargar(v => !v); setShowMenuImprimir(false); }}
                style={{ background: "transparent", border: "none", padding: "9px 8px", color: C.muted, cursor: "pointer", fontSize: 11, flexShrink: 0 }}
                title="Más opciones de descarga"
              >
                <i className="bi bi-chevron-down" />
              </button>
            </div>
            {showMenuDescargar && (
              <div style={{
                position: "absolute", top: "calc(100% + 5px)",
                left: 0, right: "auto", zIndex: 300,
                background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10,
                boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
                width: "min(260px, calc(100vw - 24px))", overflow: "hidden",
              }}>
                <div style={{ padding: "8px 14px 5px", fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", borderBottom: `1px solid ${C.border}` }}>
                  Descargar como PDF
                </div>
                <button
                  onClick={() => { handleDescargarActual(); setShowMenuDescargar(false); }}
                  style={{ width: "100%", background: "none", border: "none", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontSize: 13, color: C.text, display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${C.border}` }}
                >
                  <i className="bi bi-file-earmark-arrow-down" style={{ color: C.accent, fontSize: 15, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Esta curva (PDF)</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{indInfo?.label}</div>
                  </div>
                </button>
                <button
                  onClick={() => { handleConsolidado("download"); setShowMenuDescargar(false); }}
                  disabled={generandoConsolidado}
                  style={{ width: "100%", background: "none", border: "none", padding: "12px 14px", textAlign: "left", cursor: generandoConsolidado ? "wait" : "pointer", fontSize: 13, color: C.text, display: "flex", alignItems: "center", gap: 10, opacity: generandoConsolidado ? 0.7 : 1 }}
                >
                  {generandoConsolidado
                    ? <><span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} /> <span>Generando...</span></>
                    : <>
                        <i className="bi bi-file-earmark-pdf" style={{ color: "#dc2626", fontSize: 15, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>Consolidado (PDF)</div>
                          <div style={{ fontSize: 11, color: C.muted }}>5 curvas + historial</div>
                        </div>
                      </>
                  }
                </button>
              </div>
            )}
          </div>

          {/* ── Nueva medición ── */}
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: showForm ? "rgba(239,68,68,0.9)" : `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
              border: "none", borderRadius: 10, padding: isMobile ? "9px 12px" : "10px 20px",
              color: "#fff", fontWeight: 700, fontSize: isMobile ? 12 : 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: "0 4px 14px rgba(13,110,253,.3)", flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            <i className={`bi ${showForm ? "bi-x-lg" : "bi-plus-circle"}`} />
            {showForm ? "Cancelar" : "Nueva medición"}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* FORMULARIO NUEVA MEDICIÓN                            */}
      {/* ══════════════════════════════════════════════════════ */}
      {showForm && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: isMobile ? 10 : 14, padding: isMobile ? "14px 16px" : "20px 24px",
          marginBottom: isMobile ? 14 : 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
            paddingBottom: 10, borderBottom: `1px solid ${C.border}`,
          }}>
            <i className="bi bi-rulers" style={{ color: C.accent, fontSize: 15 }} />
            <h6 style={{ margin: 0, fontWeight: 700, fontSize: isMobile ? 13 : 15, color: C.text }}>
              Registrar medición
            </h6>
          </div>
          <form onSubmit={guardar}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: isMobile ? 10 : 14 }}>
              <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 4 }}>
                  Fecha <span style={{ color: "#dc3545" }}>*</span>
                </label>
                <input style={{ ...inputSt, fontSize: isMobile ? 13 : 14 }} type="date" name="fecha_medicion"
                  value={form.fecha_medicion}
                  onChange={e => setForm(f => ({ ...f, fecha_medicion: e.target.value }))}
                  required />
                {fechaNacimiento && form.fecha_medicion && (
                  <small style={{ color: C.accent, fontSize: 10, marginTop: 3, display: "block" }}>
                    Edad: {calcEdadMeses(fechaNacimiento, form.fecha_medicion).toFixed(1)} meses
                  </small>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 4 }}>
                  Peso (kg)
                </label>
                <input style={{ ...inputSt, fontSize: isMobile ? 13 : 14 }} type="number" step="0.01" min="0" max="100"
                  placeholder="7.5"
                  value={form.peso_kg}
                  onChange={e => setForm(f => ({ ...f, peso_kg: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 4 }}>
                  Talla (cm)
                </label>
                <input style={{ ...inputSt, fontSize: isMobile ? 13 : 14 }} type="number" step="0.1" min="0" max="200"
                  placeholder="68.5"
                  value={form.talla_cm}
                  onChange={e => setForm(f => ({ ...f, talla_cm: e.target.value }))} />
              </div>
              <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 4 }}>
                  P. Cefálico (cm)
                </label>
                <input style={{ ...inputSt, fontSize: isMobile ? 13 : 14 }} type="number" step="0.1" min="0" max="80"
                  placeholder="43.2"
                  value={form.perimetro_cefalico_cm}
                  onChange={e => setForm(f => ({ ...f, perimetro_cefalico_cm: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 4 }}>
                  Notas
                </label>
                <input style={{ ...inputSt, fontSize: isMobile ? 13 : 14 }} placeholder="Observaciones opcionales..."
                  value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, gap: 8 }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 9,
                         padding: isMobile ? "8px 16px" : "10px 22px", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: isMobile ? 12 : 14 }}>
                Cancelar
              </button>
              <button type="submit" disabled={guardando}
                style={{
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                  border: "none", borderRadius: 9, padding: isMobile ? "8px 18px" : "10px 26px",
                  color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: isMobile ? 12 : 14,
                  boxShadow: `0 4px 14px rgba(13,110,253,.4)`,
                  display: "flex", alignItems: "center", gap: 6,
                  opacity: guardando ? 0.7 : 1,
                }}>
                {guardando ? (
                  <><span className="spinner-border spinner-border-sm" /> Guardando...</>
                ) : (
                  <><i className="bi bi-floppy" /> Guardar</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* GRÁFICA DE CURVA DE CRECIMIENTO                      */}
      {/* ══════════════════════════════════════════════════════ */}
      <div ref={chartRef} style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: isMobile ? 10 : 14, padding: isMobile ? "12px 8px 12px 4px" : "24px",
        marginBottom: isMobile ? 14 : 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}>
        {/* Título + leyenda */}
        <div style={{
          display: "flex", flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between", gap: isMobile ? 6 : 0,
          marginBottom: isMobile ? 8 : 16, padding: isMobile ? "0 8px" : 0,
        }}>
          <div>
            <h6 style={{ margin: 0, fontWeight: 700, fontSize: isMobile ? 13 : 16, color: C.text }}>
              {indInfo.label} — {sexoPaciente === "M" ? "Niños" : "Niñas"}{" "}
              {isPesoTalla ? "(45–110 cm)"
                : rango === "5_19"
                  ? (indicador === "peso-edad" ? "(5–10 años)" : "(5–19 años)")
                  : "(0–60 meses)"}
            </h6>
            <span style={{ fontSize: isMobile ? 10 : 12, color: C.muted, lineHeight: 1.4, display: "block" }}>
              Estándares OMS · {mediciones.length} mediciones
              {fechaNacimiento && (
                <>
                  {" · "}
                  <i className="bi bi-cake2" style={{ fontSize: isMobile ? 9 : 11 }} /> {formatFechaNac(fechaNacimiento)}
                  {" · "}
                  <span style={{ color: C.accent, fontWeight: 600 }}>{formatEdadTexto(fechaNacimiento)}</span>
                </>
              )}
            </span>
          </div>
          <div style={{ display: "flex", gap: isMobile ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { color: "#10b981", label: "Normal (±1 DE)" },
              { color: "#f59e0b", label: "Riesgo (±2 DE)" },
              { color: "#ef4444", label: "Alerta (±3 DE)" },
            ].map(l => (
              <span key={l.color} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: isMobile ? 9 : 11, color: l.color }}>
                <span style={{ width: isMobile ? 8 : 12, height: 3, background: l.color, borderRadius: 2, display: "inline-block" }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={isMobile ? 280 : 420}>
          <ComposedChart data={chartData} margin={isMobile ? { top: 5, right: 8, left: -10, bottom: 5 } : { top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis
              dataKey={xKey}
              type="number"
              domain={isPesoTalla ? [45, 110] : rango === "5_19" ? [60, indicador === "peso-edad" ? 120 : 228] : [0, 60]}
              ticks={isPesoTalla
                ? (isMobile ? [45, 55, 65, 75, 85, 95, 105] : [45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110])
                : rango === "5_19"
                  ? (indicador === "peso-edad"
                      ? [60, 72, 84, 96, 108, 120]
                      : (isMobile ? [60, 84, 108, 132, 156, 180, 204, 228] : [60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192, 204, 216, 228]))
                  : (isMobile ? [0, 6, 12, 24, 36, 48, 60] : [0, 3, 6, 9, 12, 18, 24, 30, 36, 42, 48, 54, 60])}
              tickFormatter={isPesoTalla ? (v) => `${v}` : (v) => v >= 12 ? `${Math.floor(v/12)}a` : `${v}m`}
              label={isMobile ? undefined : { value: isPesoTalla ? "Talla (cm)" : "Edad", position: "insideBottomRight", offset: -5, style: { fontSize: 12, fill: C.muted } }}
              stroke={C.muted}
              fontSize={isMobile ? 9 : 11}
              tick={{ fill: C.muted }}
            />
            <YAxis
              label={isMobile ? undefined : { value: indInfo.yLabel, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 12, fill: C.muted } }}
              stroke={C.muted}
              fontSize={isMobile ? 9 : 11}
              tick={{ fill: C.muted }}
              width={isMobile ? 30 : 60}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Bandas de referencia OMS */}
            <Line type="monotone" dataKey="z-3" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Z -3" />
            <Line type="monotone" dataKey="z-2" stroke="#f59e0b" strokeWidth={isMobile ? 1 : 1.5} strokeDasharray="4 4" dot={false} name="Z -2" />
            <Line type="monotone" dataKey="z-1" stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Z -1" />
            <Line type="monotone" dataKey="z0"  stroke="#0ea5e9" strokeWidth={isMobile ? 1.5 : 2} dot={false} name="Mediana" />
            <Line type="monotone" dataKey="z1"  stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Z +1" />
            <Line type="monotone" dataKey="z2"  stroke="#f59e0b" strokeWidth={isMobile ? 1 : 1.5} strokeDasharray="4 4" dot={false} name="Z +2" />
            <Line type="monotone" dataKey="z3"  stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Z +3" />

            {/* Línea del paciente */}
            <Line
              type="monotone"
              dataKey="paciente"
              stroke={C.accent}
              strokeWidth={isMobile ? 2 : 3}
              dot={{ r: isMobile ? 4 : 6, fill: C.accent, stroke: "#fff", strokeWidth: 2 }}
              activeDot={{
                r: isMobile ? 6 : 8, fill: C.accent, stroke: "#fff", strokeWidth: 3,
                style: { filter: "drop-shadow(0 2px 6px rgba(22,106,232,0.4))" },
              }}
              name="Paciente"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* RESUMEN DE ÚLTIMA MEDICIÓN                           */}
      {/* ══════════════════════════════════════════════════════ */}
      {mediciones.length > 0 && (() => {
        const ultima = mediciones[mediciones.length - 1];
        const indicators = [
          { key: "peso-edad", label: "Peso/Edad", z: ultima.zscore_peso_edad, p: ultima.percentil_peso_edad, val: ultima.peso_kg, unit: "kg" },
          { key: "talla-edad", label: "Talla/Edad", z: ultima.zscore_talla_edad, p: ultima.percentil_talla_edad, val: ultima.talla_cm, unit: "cm" },
          { key: "peso-talla", label: "Peso/Talla", z: ultima.zscore_peso_talla, p: ultima.percentil_peso_talla, val: (ultima.peso_kg && ultima.talla_cm) ? ultima.peso_kg : null, unit: "kg" },
          { key: "imc-edad", label: "IMC/Edad", z: ultima.zscore_imc_edad, p: ultima.percentil_imc_edad, val: ultima.imc, unit: "kg/m²" },
          { key: "pc-edad", label: "P.C./Edad", z: ultima.zscore_pc_edad, p: ultima.percentil_pc_edad, val: ultima.perimetro_cefalico_cm, unit: "cm" },
        ].filter(i => i.val !== null && i.val !== undefined);

        return (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, 1fr)"
              : `repeat(${Math.min(indicators.length, 5)}, 1fr)`,
            gap: isMobile ? 8 : 14, marginBottom: isMobile ? 14 : 20,
          }}>
            {indicators.map(ind => {
              const cls = clasificarZscore(ind.z);
              const zone = cls ? ZONE_COLORS[cls] : ZONE_COLORS.normal;
              return (
                <div key={ind.key} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: isMobile ? 10 : 12, padding: isMobile ? "10px 12px" : "16px 20px",
                  borderLeft: `4px solid ${zone.text}`,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ fontSize: isMobile ? 10 : 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", marginBottom: isMobile ? 4 : 8 }}>
                    {ind.label}
                  </div>
                  <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text, marginBottom: 2 }}>
                    {Number(ind.val).toFixed(1)} <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 500, color: C.muted }}>{ind.unit}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: isMobile ? 3 : 6 }}>
                    <span style={{
                      background: zone.bg, color: zone.text,
                      padding: "2px 6px", borderRadius: 6, fontSize: isMobile ? 10 : 11, fontWeight: 700,
                    }}>
                      Z: {ind.z !== null ? Number(ind.z).toFixed(2) : "—"}
                    </span>
                    <span style={{
                      background: "rgba(14,165,233,0.08)", color: "#0ea5e9",
                      padding: "2px 6px", borderRadius: 6, fontSize: isMobile ? 10 : 11, fontWeight: 700,
                    }}>
                      P{ind.p !== null ? Number(ind.p).toFixed(0) : "—"}
                    </span>
                  </div>
                  <div style={{ fontSize: isMobile ? 10 : 12, color: zone.text, fontWeight: 600 }}>
                    {interpretarZscore(ind.key, ind.z)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════ */}
      {/* HISTORIAL DE MEDICIONES                              */}
      {/* ══════════════════════════════════════════════════════ */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: isMobile ? 10 : 14, overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}>
        <div style={{
          padding: isMobile ? "12px 14px" : "16px 24px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <i className="bi bi-clock-history" style={{ color: C.accent, fontSize: isMobile ? 14 : 16 }} />
          <h6 style={{ margin: 0, fontWeight: 700, fontSize: isMobile ? 13 : 15, color: C.text }}>
            Historial
          </h6>
          <span style={{
            background: "rgba(13,110,253,0.1)", color: C.accent,
            padding: "2px 8px", borderRadius: 10, fontSize: isMobile ? 11 : 12, fontWeight: 700,
          }}>
            {mediciones.length}
          </span>
        </div>

        {mediciones.length === 0 ? (
          <div style={{ padding: isMobile ? "30px 16px" : "40px 20px", textAlign: "center" }}>
            <i className="bi bi-rulers" style={{ fontSize: isMobile ? 28 : 36, color: C.muted, opacity: 0.4 }} />
            <p style={{ color: C.muted, fontSize: isMobile ? 12 : 14, margin: "10px 0 0" }}>
              No hay mediciones registradas.
            </p>
          </div>
        ) : isMobile ? (
          /* Vista tarjetas en mobile */
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {[...mediciones].reverse().map(m => {
              const { z, p } = getZscoreField(m);
              const cls = clasificarZscore(z);
              const zone = cls ? ZONE_COLORS[cls] : ZONE_COLORS.normal;
              const anios = Math.floor(m.edad_meses / 12);
              const mesesR = Math.round(m.edad_meses % 12);
              return (
                <div key={m.id} style={{
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: "10px 12px", borderLeft: `4px solid ${zone.text}`,
                  display: "grid", gridTemplateColumns: "1fr auto", gap: 4, alignItems: "start",
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 3 }}>
                      {new Date(m.fecha_medicion).toLocaleDateString("es-PE")}
                      <span style={{ fontWeight: 400, color: C.muted, marginLeft: 6, fontSize: 11 }}>
                        {anios > 0 ? `${anios}a ` : ""}{mesesR}m
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: C.text, marginBottom: 4 }}>
                      {m.peso_kg && <span><b>Peso:</b> {m.peso_kg}kg</span>}
                      {m.talla_cm && <span><b>Talla:</b> {m.talla_cm}cm</span>}
                      {m.imc && <span><b>IMC:</b> {Number(m.imc).toFixed(1)}</span>}
                      {m.perimetro_cefalico_cm && <span><b>PC:</b> {m.perimetro_cefalico_cm}cm</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>{indInfo.label}</span>
                      <span style={{
                        background: zone.bg, color: zone.text,
                        padding: "1px 6px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                      }}>
                        Z: {z !== null && z !== undefined ? Number(z).toFixed(2) : "—"}
                      </span>
                      <span style={{
                        background: "rgba(14,165,233,0.08)", color: "#0ea5e9",
                        padding: "1px 6px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                      }}>
                        P{p !== null && p !== undefined ? Number(p).toFixed(0) : "—"}
                      </span>
                      <span style={{
                        background: zone.bg, color: zone.text,
                        padding: "1px 6px", borderRadius: 5, fontSize: 9, fontWeight: 600, textTransform: "uppercase",
                      }}>
                        {interpretarZscore(indicador, z)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => eliminarMedicion(m.id)}
                    style={{
                      background: "rgba(239,68,68,0.06)", border: "none", borderRadius: 6,
                      padding: "6px 8px", color: "#ef4444", fontSize: 12,
                      cursor: "pointer", alignSelf: "center",
                    }}
                    title="Eliminar"
                  >
                    <i className="bi bi-trash" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* Tabla desktop */
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #214a87 0%, #176DC8 100%)" }}>
                  {["Fecha", "Edad", "Peso (kg)", "Talla (cm)", "IMC", "P.C. (cm)",
                    "Indicador", "Z-Score", "Percentil", "Estado", ""].map((h, i) => (
                    <th key={i} style={{
                      padding: "10px 14px", textAlign: i === 9 ? "center" : "left",
                      fontSize: 11, fontWeight: 700, color: "#fff",
                      textTransform: "uppercase", letterSpacing: ".05em",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...mediciones].reverse().map(m => {
                  const { z, p } = getZscoreField(m);
                  const cls = clasificarZscore(z);
                  const zone = cls ? ZONE_COLORS[cls] : ZONE_COLORS.normal;
                  const anios = Math.floor(m.edad_meses / 12);
                  const mesesR = Math.round(m.edad_meses % 12);

                  return (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: C.text, fontWeight: 600 }}>
                        {new Date(m.fecha_medicion).toLocaleDateString("es-PE")}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: C.muted }}>
                        {anios > 0 ? `${anios}a ` : ""}{mesesR}m
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: C.text, fontWeight: 600 }}>
                        {m.peso_kg ?? "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: C.text, fontWeight: 600 }}>
                        {m.talla_cm ?? "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: C.text }}>
                        {m.imc ? Number(m.imc).toFixed(1) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: C.text }}>
                        {m.perimetro_cefalico_cm ?? "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: C.accent, fontWeight: 600 }}>
                        {indInfo.label}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          background: zone.bg, color: zone.text,
                          padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                        }}>
                          {z !== null && z !== undefined ? Number(z).toFixed(2) : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          background: "rgba(14,165,233,0.08)", color: "#0ea5e9",
                          padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                        }}>
                          P{p !== null && p !== undefined ? Number(p).toFixed(0) : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{
                          background: zone.bg, border: `1px solid ${zone.text}20`,
                          borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600,
                          color: zone.text, textTransform: "uppercase",
                        }}>
                          {interpretarZscore(indicador, z)}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <button
                          onClick={() => eliminarMedicion(m.id)}
                          style={{
                            background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 6,
                            padding: "5px 10px", color: "#ef4444", fontSize: 12,
                            cursor: "pointer", fontWeight: 600,
                          }}
                          title="Eliminar medición"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* GRÁFICAS OCULTAS — para reporte consolidado          */}
      {/* Se renderizan fuera de la vista para capturar SVGs   */}
      {/* ══════════════════════════════════════════════════════ */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, pointerEvents: "none", overflow: "hidden", visibility: "hidden" }}>
        {INDICADORES.map(ind => {
          const curvas = todasCurvas[ind.key];
          if (!curvas) return null;
          const isPT = ind.key === "peso-talla";
          const xk   = isPT ? "talla" : "mes";
          const data = buildChartData(ind.key, mediciones, curvas);
          return (
            <div
              key={ind.key}
              ref={el => { hiddenChartsRef.current[ind.key] = el; }}
              style={{ width: 900, height: 380 }}
            >
              <ComposedChart width={900} height={380} data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis
                  dataKey={xk}
                  type="number"
                  domain={isPT ? [45, 110] : [0, 60]}
                  tickFormatter={isPT ? v => `${v}` : v => v >= 12 ? `${Math.floor(v / 12)}a` : `${v}m`}
                  stroke={C.muted} fontSize={10} tick={{ fill: C.muted }}
                />
                <YAxis stroke={C.muted} fontSize={10} tick={{ fill: C.muted }} />
                <Line type="monotone" dataKey="z-3" stroke="#ef4444" strokeWidth={1}   strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="z-2" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="z-1" stroke="#10b981" strokeWidth={1}   strokeDasharray="3 3" dot={false} />
                <Line type="monotone" dataKey="z0"  stroke="#0ea5e9" strokeWidth={2}   dot={false} />
                <Line type="monotone" dataKey="z1"  stroke="#10b981" strokeWidth={1}   strokeDasharray="3 3" dot={false} />
                <Line type="monotone" dataKey="z2"  stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="z3"  stroke="#ef4444" strokeWidth={1}   strokeDasharray="4 4" dot={false} />
                <Line
                  type="monotone"
                  dataKey="paciente"
                  stroke={C.accent}
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: C.accent, stroke: "#fff", strokeWidth: 2 }}
                  connectNulls
                />
              </ComposedChart>
            </div>
          );
        })}
      </div>
    </div>
  );
}
