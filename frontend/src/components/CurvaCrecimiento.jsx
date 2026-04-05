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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const sexoPaciente = (sexo || "M").toUpperCase();
  const indInfo = INDICADORES.find(i => i.key === indicador);
  const isPesoTalla = indicador === "peso-talla";
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
      const res = await api.get(`/crecimiento/referencia/${indicador}/${sexoPaciente}`);
      setCurvasRef(res.data.data);
    } catch (err) {
      console.error("Error cargando curvas referencia:", err);
      setCurvasRef(null);
    }
  }, [indicador, sexoPaciente]);

  useEffect(() => {
    setLoading(true);
    Promise.all([cargarMediciones(), cargarCurvasRef()])
      .finally(() => setLoading(false));
  }, [cargarMediciones, cargarCurvasRef]);

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
  const chartData = (() => {
    if (!curvasRef) return [];

    // Tomar los puntos de las curvas de referencia como eje X
    const puntosRef = curvasRef["z0"] || [];
    const data = puntosRef.map(p => {
      const punto = { [xKey]: p[xKey] };

      // Agregar bandas de Z-score
      [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
        const curva = curvasRef[`z${z}`];
        if (curva) {
          const match = curva.find(c => c[xKey] === p[xKey]);
          if (match) punto[`z${z}`] = match.valor;
        }
      });

      return punto;
    });

    // Agregar mediciones del paciente
    mediciones.forEach(m => {
      if (isPesoTalla) {
        const peso = m.peso_kg;
        const talla = m.talla_cm;
        if (!peso || !talla) return;
        const t = parseFloat(talla);
        const idx = data.findIndex(d => d.talla >= t);
        if (idx === -1) {
          const newPt = { talla: t, paciente: parseFloat(peso) };
          // Interpolar z-scores en el punto insertado
          [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
            const curva = curvasRef[`z${z}`];
            if (!curva) return;
            const ci = curva.findIndex(c => c.talla >= t);
            if (ci > 0) {
              const a = curva[ci - 1], b = curva[ci];
              const frac = (t - a.talla) / (b.talla - a.talla);
              newPt[`z${z}`] = Math.round((a.valor + frac * (b.valor - a.valor)) * 100) / 100;
            } else if (ci === 0) {
              newPt[`z${z}`] = curva[0].valor;
            }
          });
          data.push(newPt);
        } else if (Math.abs(data[idx].talla - t) < 0.5) {
          data[idx].paciente = parseFloat(peso);
        } else {
          const newPt = { talla: t, paciente: parseFloat(peso) };
          [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
            const curva = curvasRef[`z${z}`];
            if (!curva) return;
            const ci = curva.findIndex(c => c.talla >= t);
            if (ci > 0) {
              const a = curva[ci - 1], b = curva[ci];
              const frac = (t - a.talla) / (b.talla - a.talla);
              newPt[`z${z}`] = Math.round((a.valor + frac * (b.valor - a.valor)) * 100) / 100;
            } else if (ci === 0) {
              newPt[`z${z}`] = curva[0].valor;
            }
          });
          data.splice(idx, 0, newPt);
        }
      } else {
        const valor = m[indInfo.campo];
        if (valor === null || valor === undefined) return;
        const idx = data.findIndex(d => d.mes >= m.edad_meses);
        if (idx === -1) {
          const newPt = { mes: m.edad_meses, paciente: parseFloat(valor) };
          [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
            const curva = curvasRef[`z${z}`];
            if (!curva) return;
            const ci = curva.findIndex(c => c.mes >= m.edad_meses);
            if (ci > 0) {
              const a = curva[ci - 1], b = curva[ci];
              const frac = (m.edad_meses - a.mes) / (b.mes - a.mes);
              newPt[`z${z}`] = Math.round((a.valor + frac * (b.valor - a.valor)) * 100) / 100;
            } else if (ci === 0) {
              newPt[`z${z}`] = curva[0].valor;
            }
          });
          data.push(newPt);
        } else if (Math.abs(data[idx].mes - m.edad_meses) < 0.5) {
          data[idx].paciente = parseFloat(valor);
        } else {
          const newPt = { mes: m.edad_meses, paciente: parseFloat(valor) };
          [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
            const curva = curvasRef[`z${z}`];
            if (!curva) return;
            const ci = curva.findIndex(c => c.mes >= m.edad_meses);
            if (ci > 0) {
              const a = curva[ci - 1], b = curva[ci];
              const frac = (m.edad_meses - a.mes) / (b.mes - a.mes);
              newPt[`z${z}`] = Math.round((a.valor + frac * (b.valor - a.valor)) * 100) / 100;
            } else if (ci === 0) {
              newPt[`z${z}`] = curva[0].valor;
            }
          });
          data.splice(idx, 0, newPt);
        }
      }
    });

    return data.sort((a, b) => (a[xKey] || 0) - (b[xKey] || 0));
  })();

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
  // IMPRIMIR CURVAS
  // ─────────────────────────────────────────────────────────
  const handlePrint = () => {
    const el = chartRef.current;
    if (!el) return;
    const svgEl = el.querySelector(".recharts-wrapper svg");
    if (!svgEl) return;

    // Clonar SVG y fijar viewBox para que escale correctamente
    const clone = svgEl.cloneNode(true);
    const w = svgEl.getAttribute("width") || svgEl.getBoundingClientRect().width;
    const h = svgEl.getAttribute("height") || svgEl.getBoundingClientRect().height;
    clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
    clone.setAttribute("width", "100%");
    clone.setAttribute("height", "auto");
    clone.removeAttribute("style");
    const svgData = new XMLSerializer().serializeToString(clone);

    const edadTxt = fechaNacimiento ? formatEdadTexto(fechaNacimiento) : "";
    const nacTxt = fechaNacimiento ? formatFechaNac(fechaNacimiento) : "";
    const infoExtra = fechaNacimiento ? `F. Nac: ${nacTxt} · Edad actual: ${edadTxt}` : "";

    const win = window.open("", "", "width=1050,height=750");
    if (!win) return;
    win.document.write(`<html><head><title>Curva de Crecimiento - ${indInfo.label}</title>
      <style>
        @page{size:landscape;margin:12mm}
        *{box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;padding:20px 30px;text-align:center;color:#1a1a1a;margin:0}
        h2{margin:0 0 2px;font-size:17px}
        .sub{margin:0 0 4px;color:#6c757d;font-size:12px}
        .info{margin:0 0 12px;color:#166ae8;font-size:12px;font-weight:600}
        .chart-wrap{width:100%;max-height:65vh;display:flex;justify-content:center}
        .chart-wrap svg{width:100%;height:auto;max-height:60vh}
        .legend{display:flex;justify-content:center;gap:18px;margin-top:10px;font-size:10px}
        .legend span{display:flex;align-items:center;gap:4px}
        .line{width:12px;height:3px;border-radius:2px;display:inline-block}
        .footer{margin-top:12px;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:6px}
      </style></head><body>
      <h2>Curva de Crecimiento: ${indInfo.label}</h2>
      <p class="sub">${sexoPaciente === "M" ? "Niños" : "Niñas"} — Estándares OMS · ${mediciones.length} mediciones</p>
      ${infoExtra ? `<p class="info">${infoExtra}</p>` : ""}
      <div class="chart-wrap">${svgData}</div>
      <div class="legend">
        <span><span class="line" style="background:#10b981"></span> Normal (±1 DE)</span>
        <span><span class="line" style="background:#f59e0b"></span> Riesgo (±2 DE)</span>
        <span><span class="line" style="background:#ef4444"></span> Alerta (±3 DE)</span>
      </div>
      <div class="footer">Generado el ${new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}</div>
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
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
        display: "flex", flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center",
        gap: isMobile ? 10 : 12, marginBottom: isMobile ? 14 : 20,
      }}>
        {/* Tabs indicadores — scroll horizontal en mobile */}
        <div style={{
          display: "flex", gap: 4, overflowX: "auto", WebkitOverflowScrolling: "touch",
          paddingBottom: 2, flexShrink: 0,
        }}>
          {INDICADORES.map(ind => (
            <button
              key={ind.key}
              onClick={() => setIndicador(ind.key)}
              style={{
                padding: isMobile ? "6px 10px" : "8px 16px", borderRadius: 8,
                fontSize: isMobile ? 11 : 13, fontWeight: 600, whiteSpace: "nowrap",
                border: indicador === ind.key ? "none" : `1px solid ${C.border}`,
                background: indicador === ind.key
                  ? `linear-gradient(135deg, ${C.accent}, ${C.accentD})`
                  : "transparent",
                color: indicador === ind.key ? "#fff" : C.muted,
                cursor: "pointer", transition: "all 0.2s ease",
                flexShrink: 0,
              }}
            >
              {isMobile ? ind.labelCorto : ind.label}
            </button>
          ))}
        </div>
        {/* Botones acción */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: isMobile ? "stretch" : "flex-end" }}>
          <button
            onClick={handlePrint}
            style={{
              background: "transparent", border: `1px solid ${C.border}`,
              borderRadius: 10, padding: isMobile ? "8px 12px" : "10px 18px",
              color: C.muted, fontWeight: 600, fontSize: isMobile ? 12 : 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.2s ease", flex: isMobile ? 1 : "none",
            }}
            title="Imprimir curva"
          >
            <i className="bi bi-printer" /> {!isMobile && "Imprimir"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: showForm ? "rgba(239,68,68,0.9)" : `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
              border: "none", borderRadius: 10, padding: isMobile ? "8px 14px" : "10px 20px",
              color: "#fff", fontWeight: 700, fontSize: isMobile ? 12 : 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: "0 4px 14px rgba(13,110,253,.3)", flex: isMobile ? 2 : "none",
            }}
          >
            <i className={`bi ${showForm ? "bi-x-lg" : "bi-plus-circle"}`} />
            {showForm ? "Cancelar" : (isMobile ? "Nueva" : "Nueva medición")}
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
              {indInfo.label} — {sexoPaciente === "M" ? "Niños" : "Niñas"} {isPesoTalla ? "(45–110 cm)" : "(0–60 meses)"}
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
              domain={isPesoTalla ? [45, 110] : [0, 60]}
              ticks={isPesoTalla
                ? (isMobile ? [45, 55, 65, 75, 85, 95, 105] : [45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110])
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
    </div>
  );
}
