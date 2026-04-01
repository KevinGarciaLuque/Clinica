/**
 * CurvaCrecimiento.jsx — Módulo de Curvas de Crecimiento OMS
 * Gráfica interactiva con historial, Z-score y percentiles
 */
import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Area, ComposedChart,
} from "recharts";
import api from "../api/api";

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════

const INDICADORES = [
  { key: "peso-edad",  label: "Peso / Edad",          unidad: "kg",  campo: "peso_kg",  yLabel: "Peso (kg)" },
  { key: "talla-edad", label: "Talla / Edad",          unidad: "cm",  campo: "talla_cm", yLabel: "Talla (cm)" },
  { key: "imc-edad",   label: "IMC / Edad",            unidad: "kg/m²", campo: "imc",    yLabel: "IMC (kg/m²)" },
  { key: "pc-edad",    label: "Per. Cefálico / Edad",  unidad: "cm",  campo: "perimetro_cefalico_cm", yLabel: "P.C. (cm)" },
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

  const sexoPaciente = (sexo || "M").toUpperCase();
  const indInfo = INDICADORES.find(i => i.key === indicador);

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
      const res = await api.get(`/crecimiento/referencia/${indicador}/${sexoPaciente}`);
      setCurvasRef(res.data.data);
    } catch (err) {
      console.error("Error cargando curvas referencia:", err);
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
      const punto = { mes: p.mes };

      // Agregar bandas de Z-score
      [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
        const curva = curvasRef[`z${z}`];
        if (curva) {
          const match = curva.find(c => c.mes === p.mes);
          if (match) punto[`z${z}`] = match.valor;
        }
      });

      return punto;
    });

    // Agregar mediciones del paciente
    mediciones.forEach(m => {
      const valor = m[indInfo.campo];
      if (valor === null || valor === undefined) return;

      // Encontrar el punto más cercano o insertar
      const idx = data.findIndex(d => d.mes >= m.edad_meses);
      if (idx === -1) {
        data.push({ mes: m.edad_meses, paciente: parseFloat(valor) });
      } else if (Math.abs(data[idx].mes - m.edad_meses) < 0.5) {
        data[idx].paciente = parseFloat(valor);
      } else {
        data.splice(idx, 0, { mes: m.edad_meses, paciente: parseFloat(valor) });
      }
    });

    return data.sort((a, b) => a.mes - b.mes);
  })();

  // ─────────────────────────────────────────────────────────
  // TOOLTIP PERSONALIZADO
  // ─────────────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const pacData = payload.find(p => p.dataKey === "paciente");
    const anios = Math.floor(label / 12);
    const mesesResto = Math.round(label % 12);

    return (
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
        padding: "12px 16px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        fontSize: 13,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: C.text }}>
          Edad: {anios > 0 ? `${anios}a ` : ""}{mesesResto}m
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
  // Z-SCORE COLUMNS para la tabla
  // ─────────────────────────────────────────────────────────
  function getZscoreField(m) {
    switch (indicador) {
      case "peso-edad": return { z: m.zscore_peso_edad, p: m.percentil_peso_edad };
      case "talla-edad": return { z: m.zscore_talla_edad, p: m.percentil_talla_edad };
      case "imc-edad": return { z: m.zscore_imc_edad, p: m.percentil_imc_edad };
      case "pc-edad": return { z: m.zscore_pc_edad, p: m.percentil_pc_edad };
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
    <div>
      {/* Mensaje */}
      {msg.texto && (
        <div className={`alert alert-${msg.tipo} alert-dismissible fade show mb-3`}>
          <i className={`bi ${msg.tipo === "success" ? "bi-check-circle" : "bi-exclamation-triangle"} me-2`} />
          {msg.texto}
          <button type="button" className="btn-close" onClick={() => setMsg({ tipo: "", texto: "" })} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* HEADER + SELECTOR DE INDICADOR */}
      {/* ══════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 12, marginBottom: 20,
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {INDICADORES.map(ind => (
            <button
              key={ind.key}
              onClick={() => setIndicador(ind.key)}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: indicador === ind.key ? "none" : `1px solid ${C.border}`,
                background: indicador === ind.key
                  ? `linear-gradient(135deg, ${C.accent}, ${C.accentD})`
                  : "transparent",
                color: indicador === ind.key ? "#fff" : C.muted,
                cursor: "pointer", transition: "all 0.2s ease",
              }}
            >
              {ind.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: showForm ? "rgba(239,68,68,0.9)" : `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            border: "none", borderRadius: 10, padding: "10px 20px",
            color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 14px rgba(13,110,253,.3)",
          }}
        >
          <i className={`bi ${showForm ? "bi-x-lg" : "bi-plus-circle"}`} />
          {showForm ? "Cancelar" : "Nueva medición"}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* FORMULARIO NUEVA MEDICIÓN */}
      {/* ══════════════════════════════════════════════════════ */}
      {showForm && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "20px 24px", marginBottom: 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
            paddingBottom: 12, borderBottom: `1px solid ${C.border}`,
          }}>
            <i className="bi bi-rulers" style={{ color: C.accent, fontSize: 16 }} />
            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 15, color: C.text }}>
              Registrar medición antropométrica
            </h6>
          </div>
          <form onSubmit={guardar}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
                  Fecha medición <span style={{ color: "#dc3545" }}>*</span>
                </label>
                <input style={inputSt} type="date" name="fecha_medicion"
                  value={form.fecha_medicion}
                  onChange={e => setForm(f => ({ ...f, fecha_medicion: e.target.value }))}
                  required />
                {fechaNacimiento && form.fecha_medicion && (
                  <small style={{ color: C.accent, fontSize: 11, marginTop: 4, display: "block" }}>
                    Edad: {calcEdadMeses(fechaNacimiento, form.fecha_medicion).toFixed(1)} meses
                  </small>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
                  Peso (kg)
                </label>
                <input style={inputSt} type="number" step="0.01" min="0" max="100"
                  placeholder="Ej: 7.5"
                  value={form.peso_kg}
                  onChange={e => setForm(f => ({ ...f, peso_kg: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
                  Talla (cm)
                </label>
                <input style={inputSt} type="number" step="0.1" min="0" max="200"
                  placeholder="Ej: 68.5"
                  value={form.talla_cm}
                  onChange={e => setForm(f => ({ ...f, talla_cm: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
                  Perímetro cefálico (cm)
                </label>
                <input style={inputSt} type="number" step="0.1" min="0" max="80"
                  placeholder="Ej: 43.2"
                  value={form.perimetro_cefalico_cm}
                  onChange={e => setForm(f => ({ ...f, perimetro_cefalico_cm: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
                  Notas
                </label>
                <input style={inputSt} placeholder="Observaciones opcionales..."
                  value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 9,
                         padding: "10px 22px", color: C.muted, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button type="submit" disabled={guardando}
                style={{
                  background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                  border: "none", borderRadius: 9, padding: "10px 26px",
                  color: "#fff", fontWeight: 700, cursor: "pointer",
                  boxShadow: `0 4px 14px rgba(13,110,253,.4)`,
                  display: "flex", alignItems: "center", gap: 8,
                  opacity: guardando ? 0.7 : 1,
                }}>
                {guardando ? (
                  <><span className="spinner-border spinner-border-sm" /> Guardando...</>
                ) : (
                  <><i className="bi bi-floppy" /> Registrar medición</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* GRÁFICA DE CURVA DE CRECIMIENTO */}
      {/* ══════════════════════════════════════════════════════ */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: "24px", marginBottom: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <div>
            <h6 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: C.text }}>
              {indInfo.label} — {sexoPaciente === "M" ? "Niños" : "Niñas"} (0–60 meses)
            </h6>
            <span style={{ fontSize: 12, color: C.muted }}>
              Estándares OMS · {mediciones.length} mediciones registradas
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#10b981" }}>
              <span style={{ width: 12, height: 3, background: "#10b981", borderRadius: 2, display: "inline-block" }} />
              Normal (±1 DE)
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#f59e0b" }}>
              <span style={{ width: 12, height: 3, background: "#f59e0b", borderRadius: 2, display: "inline-block" }} />
              Riesgo (±2 DE)
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#ef4444" }}>
              <span style={{ width: 12, height: 3, background: "#ef4444", borderRadius: 2, display: "inline-block" }} />
              Alerta (±3 DE)
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis
              dataKey="mes"
              type="number"
              domain={[0, 60]}
              ticks={[0, 3, 6, 9, 12, 18, 24, 30, 36, 42, 48, 54, 60]}
              tickFormatter={(v) => v >= 12 ? `${Math.floor(v/12)}a` : `${v}m`}
              label={{ value: "Edad", position: "insideBottomRight", offset: -5, style: { fontSize: 12, fill: C.muted } }}
              stroke={C.muted}
              fontSize={11}
            />
            <YAxis
              label={{ value: indInfo.yLabel, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 12, fill: C.muted } }}
              stroke={C.muted}
              fontSize={11}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Bandas de referencia OMS */}
            <Line type="monotone" dataKey="z-3" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Z -3" />
            <Line type="monotone" dataKey="z-2" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Z -2" />
            <Line type="monotone" dataKey="z-1" stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Z -1" />
            <Line type="monotone" dataKey="z0"  stroke="#0ea5e9" strokeWidth={2} dot={false} name="Mediana" />
            <Line type="monotone" dataKey="z1"  stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Z +1" />
            <Line type="monotone" dataKey="z2"  stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Z +2" />
            <Line type="monotone" dataKey="z3"  stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Z +3" />

            {/* Línea del paciente */}
            <Line
              type="monotone"
              dataKey="paciente"
              stroke={C.accent}
              strokeWidth={3}
              dot={{
                r: 6, fill: C.accent, stroke: "#fff", strokeWidth: 2,
              }}
              activeDot={{
                r: 8, fill: C.accent, stroke: "#fff", strokeWidth: 3,
                style: { filter: "drop-shadow(0 2px 6px rgba(22,106,232,0.4))" },
              }}
              name="Paciente"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* RESUMEN DE ÚLTIMA MEDICIÓN */}
      {/* ══════════════════════════════════════════════════════ */}
      {mediciones.length > 0 && (() => {
        const ultima = mediciones[mediciones.length - 1];
        const indicators = [
          { key: "peso-edad", label: "Peso/Edad", z: ultima.zscore_peso_edad, p: ultima.percentil_peso_edad, val: ultima.peso_kg, unit: "kg" },
          { key: "talla-edad", label: "Talla/Edad", z: ultima.zscore_talla_edad, p: ultima.percentil_talla_edad, val: ultima.talla_cm, unit: "cm" },
          { key: "imc-edad", label: "IMC/Edad", z: ultima.zscore_imc_edad, p: ultima.percentil_imc_edad, val: ultima.imc, unit: "kg/m²" },
          { key: "pc-edad", label: "P.C./Edad", z: ultima.zscore_pc_edad, p: ultima.percentil_pc_edad, val: ultima.perimetro_cefalico_cm, unit: "cm" },
        ].filter(i => i.val !== null && i.val !== undefined);

        return (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(indicators.length, 4)}, 1fr)`,
            gap: 14, marginBottom: 20,
          }}>
            {indicators.map(ind => {
              const cls = clasificarZscore(ind.z);
              const zone = cls ? ZONE_COLORS[cls] : ZONE_COLORS.normal;
              return (
                <div key={ind.key} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: "16px 20px",
                  borderLeft: `4px solid ${zone.text}`,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                               letterSpacing: ".05em", marginBottom: 8 }}>
                    {ind.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                    {Number(ind.val).toFixed(1)} <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{ind.unit}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{
                      background: zone.bg, color: zone.text,
                      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                    }}>
                      Z: {ind.z !== null ? Number(ind.z).toFixed(2) : "—"}
                    </span>
                    <span style={{
                      background: "rgba(14,165,233,0.08)", color: "#0ea5e9",
                      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                    }}>
                      P{ind.p !== null ? Number(ind.p).toFixed(0) : "—"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: zone.text, fontWeight: 600 }}>
                    {interpretarZscore(ind.key, ind.z)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════ */}
      {/* HISTORIAL DE MEDICIONES */}
      {/* ══════════════════════════════════════════════════════ */}
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 14, overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}>
        <div style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <i className="bi bi-clock-history" style={{ color: C.accent, fontSize: 16 }} />
          <h6 style={{ margin: 0, fontWeight: 700, fontSize: 15, color: C.text }}>
            Historial de mediciones
          </h6>
          <span style={{
            background: "rgba(13,110,253,0.1)", color: C.accent,
            padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700,
          }}>
            {mediciones.length}
          </span>
        </div>

        {mediciones.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <i className="bi bi-rulers" style={{ fontSize: 36, color: C.muted, opacity: 0.4 }} />
            <p style={{ color: C.muted, fontSize: 14, margin: "12px 0 0" }}>
              No hay mediciones registradas. Haz clic en "Nueva medición" para comenzar.
            </p>
          </div>
        ) : (
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
