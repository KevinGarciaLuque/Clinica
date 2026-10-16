// 📈 Evolución del paciente: cómo ha ido según sus consultas.
// Tarjetas con el último valor de cada signo (en verde/amarillo/rojo según el rango
// normal y con la tendencia respecto a la consulta anterior), gráficas en el tiempo
// y la línea de tiempo de consultas con su diagnóstico. Solo lectura.
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceArea, ReferenceLine,
} from "recharts";
import api from "../api/api";

const VERDE = { bg: "#dcfce7", fg: "#15803d" };
const AMBAR = { bg: "#fef3c7", fg: "#b45309" };
const NARANJA = { bg: "#ffedd5", fg: "#c2410c" };
const ROJO = { bg: "#fee2e2", fg: "#b91c1c" };
const GRIS = { bg: "#f1f5f9", fg: "#475569" };

// Clasificación de cada signo (para el color de la tarjeta)
const estadoPresion = (s, d) => {
  if (s == null || d == null) return null;
  if (s >= 140 || d >= 90) return { ...ROJO, txt: "Alta" };
  if (s >= 130 || d >= 80) return { ...NARANJA, txt: "Alta etapa 1" };
  if (s >= 120) return { ...AMBAR, txt: "Elevada" };
  if (s < 90 || d < 60) return { ...AMBAR, txt: "Baja" };
  return { ...VERDE, txt: "Normal" };
};
const estadoImc = (v) => v == null ? null
  : v < 18.5 ? { ...AMBAR, txt: "Bajo peso" } : v < 25 ? { ...VERDE, txt: "Normal" }
  : v < 30 ? { ...AMBAR, txt: "Sobrepeso" } : { ...ROJO, txt: "Obesidad" };
const estadoFc = (v) => v == null ? null : v < 60 ? { ...AMBAR, txt: "Baja" } : v > 100 ? { ...AMBAR, txt: "Alta" } : { ...VERDE, txt: "Normal" };
const estadoSpo2 = (v) => v == null ? null : v >= 95 ? { ...VERDE, txt: "Normal" } : v >= 90 ? { ...AMBAR, txt: "Baja" } : { ...ROJO, txt: "Muy baja" };
const estadoTemp = (v) => v == null ? null : v > 38 ? { ...ROJO, txt: "Fiebre" } : v > 37.5 ? { ...AMBAR, txt: "Febrícula" } : v < 35.5 ? { ...AMBAR, txt: "Baja" } : { ...VERDE, txt: "Normal" };

const OTROS = [
  { key: "fc",   label: "Pulso",       unidad: "lpm", color: "#e11d48", rango: [60, 100] },
  { key: "spo2", label: "Saturación",  unidad: "%",   color: "#0284c7", rango: [95, 100] },
  { key: "temp", label: "Temperatura", unidad: "°C",  color: "#ea580c", rango: [36, 37.5] },
  { key: "fr",   label: "Resp.",       unidad: "rpm", color: "#7c3aed", rango: [12, 20] },
];

const PERIODOS = [
  { key: "6",  label: "6 meses" },
  { key: "12", label: "12 meses" },
  { key: "todo", label: "Todo" },
];

const fechaCorta = (f) => dayjs(f).format("DD/MM/YY");
const haceCuanto = (f) => {
  const dias = dayjs().startOf("day").diff(dayjs(f), "day");
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 31) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  return meses < 12 ? `hace ${meses} ${meses === 1 ? "mes" : "meses"}` : `hace ${(dias / 365).toFixed(1).replace(".0", "")} años`;
};

// Último y penúltimo registro de un signo
function ultimos(consultas, clave) {
  const con = consultas.filter((c) => c.vitales[clave] != null);
  return { ultimo: con[con.length - 1] || null, anterior: con[con.length - 2] || null };
}

/**
 * Tendencia respecto a la consulta anterior. `bajarEsMejor`: si el valor está fuera de
 * rango, bajar se pinta en verde ("mejorando") y subir en rojo.
 */
function Tendencia({ actual, anterior, unidad, decimales = 1, fueraDeRango, bajarEsMejor = true }) {
  if (actual == null || anterior == null) return <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>primer registro</span>;
  const dif = Math.round((actual - anterior) * 10 ** decimales) / 10 ** decimales;
  if (dif === 0) return <span style={{ color: "#64748b", fontSize: "0.72rem" }}>= sin cambio</span>;
  const sube = dif > 0;
  const mejora = fueraDeRango ? (bajarEsMejor ? !sube : sube) : null;
  const color = mejora == null ? "#64748b" : mejora ? "#15803d" : "#b91c1c";
  return (
    <span style={{ color, fontSize: "0.72rem", fontWeight: 700 }}>
      {sube ? "▲" : "▼"} {sube ? "+" : ""}{dif} {unidad}{mejora != null ? (mejora ? " · mejorando" : " · empeorando") : ""}
    </span>
  );
}

function Tarjeta({ icono, color, titulo, valor, unidad, estado, fecha, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 14px", minWidth: 0, borderTop: `3px solid ${estado?.fg || color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".03em", minWidth: 0 }}>
        <i className={`bi ${icono}`} style={{ color }} />
        <span className="text-truncate" style={{ flex: 1 }}>{titulo}</span>
      </div>
      <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#0f172a", margin: "4px 0 2px", whiteSpace: "nowrap" }}>
        {valor}<span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b", marginLeft: 4 }}>{unidad}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "4px 8px", flexWrap: "wrap" }}>
        {estado && <span style={{ background: estado.bg, color: estado.fg, borderRadius: 999, padding: "1px 8px", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>{estado.txt}</span>}
        {children}
      </div>
      {fecha && <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: 3 }}>{haceCuanto(fecha)} · {dayjs(fecha).format("DD/MM/YYYY")}</div>}
    </div>
  );
}

function Panel({ titulo, icono, color, extra, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 14px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <i className={`bi ${icono}`} style={{ color }} />
        <strong style={{ fontSize: "0.88rem", color: "#1e293b", flex: 1 }}>{titulo}</strong>
        {extra}
      </div>
      {children}
    </div>
  );
}

const ejeX = { dataKey: "fecha", tickFormatter: fechaCorta, tick: { fontSize: 10.5, fill: "#64748b" }, axisLine: false, tickLine: false, minTickGap: 18 };
const ejeY = { tick: { fontSize: 10.5, fill: "#64748b" }, axisLine: false, tickLine: false, width: 36 };
const tooltip = { contentStyle: { fontSize: 12, borderRadius: 8 }, labelFormatter: (f) => dayjs(f).format("DD/MM/YYYY") };

export default function EvolucionPaciente({ pacienteId }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState("12");
  const [otro, setOtro] = useState("fc");
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    if (!pacienteId) return;
    let vivo = true;
    api.get(`/evolucion/${pacienteId}`)
      .then((r) => { if (vivo) setD(r.data.data); })
      .catch((e) => { if (vivo) setError(e.response?.data?.msg || "No se pudo cargar la evolución"); });
    return () => { vivo = false; };
  }, [pacienteId]);

  const consultas = useMemo(() => d?.consultas || [], [d]);
  const enPeriodo = useMemo(() => {
    if (periodo === "todo") return consultas;
    const desde = dayjs().subtract(Number(periodo), "month").format("YYYY-MM-DD");
    return consultas.filter((c) => c.fecha >= desde);
  }, [consultas, periodo]);
  const puntos = useMemo(() => enPeriodo.map((c) => ({ fecha: c.fecha, diagnostico: c.diagnostico, ...c.vitales })), [enPeriodo]);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!d) return <div className="text-center py-5 text-muted"><span className="spinner-border spinner-border-sm me-2" />Cargando evolución…</div>;

  const conSignos = consultas.filter((c) => Object.values(c.vitales).some((v) => v != null));
  if (!consultas.length) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="bi bi-graph-up" style={{ fontSize: "2.4rem", opacity: .35 }} />
        <p className="mt-2 mb-0">Aún no hay consultas registradas para este paciente.</p>
        <p className="small">Cuando se registren signos vitales en sus consultas, aquí verás su evolución.</p>
      </div>
    );
  }

  const pa = ultimos(consultas, "sis");
  const peso = ultimos(consultas, "peso");
  const imc = ultimos(consultas, "imc");
  const fc = ultimos(consultas, "fc");
  const spo2 = ultimos(consultas, "spo2");
  const temp = ultimos(consultas, "temp");

  const estPa = estadoPresion(pa.ultimo?.vitales.sis, pa.ultimo?.vitales.dia);
  const estImc = estadoImc(imc.ultimo?.vitales.imc);
  const hay = (k) => puntos.some((p) => p[k] != null);
  const otroSel = OTROS.find((o) => o.key === otro) || OTROS[0];
  const otrosConDatos = OTROS.filter((o) => hay(o.key));

  const asis = d.asistencia;
  const totalCitas = asis ? asis.asistio + asis.falto + asis.cancelo : 0;
  const ultimaConsulta = consultas[consultas.length - 1];
  const lineaTiempo = [...consultas].reverse();

  return (
    <div>
      <style>{`
        .evo-tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .evo-graficas { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 10px; margin-top: 10px; }
        .evo-chip { border: 1px solid #e2e8f0; background: #fff; color: #475569; border-radius: 999px; padding: 3px 11px; font-size: 0.76rem; font-weight: 600; cursor: pointer; }
        .evo-chip.on { background: #1e3a8a; border-color: #1e3a8a; color: #fff; }
      `}</style>

      {/* Encabezado + periodo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 800, color: "#1e293b" }}><i className="bi bi-graph-up-arrow me-2" style={{ color: "#2563eb" }} />Evolución del paciente</div>
          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
            {consultas.length} consulta(s){conSignos.length !== consultas.length ? `, ${conSignos.length} con signos vitales` : ""} · última {haceCuanto(ultimaConsulta.fecha)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {PERIODOS.map((p) => (
            <button key={p.key} type="button" className={`evo-chip ${periodo === p.key ? "on" : ""}`} onClick={() => setPeriodo(p.key)}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Tarjetas de resumen */}
      {conSignos.length > 0 ? (
        <div className="evo-tarjetas">
          {pa.ultimo && (
            <Tarjeta icono="bi-heart-pulse-fill" color="#ef4444" titulo="Presión" valor={`${pa.ultimo.vitales.sis}/${pa.ultimo.vitales.dia}`} unidad="mmHg" estado={estPa} fecha={pa.ultimo.fecha}>
              <Tendencia actual={pa.ultimo.vitales.sis} anterior={pa.anterior?.vitales.sis} unidad="" decimales={0} fueraDeRango={estPa?.txt !== "Normal"} />
            </Tarjeta>
          )}
          {peso.ultimo && (
            <Tarjeta icono="bi-speedometer" color="#0ea5e9" titulo="Peso" valor={peso.ultimo.vitales.peso} unidad="kg" fecha={peso.ultimo.fecha}>
              <Tendencia actual={peso.ultimo.vitales.peso} anterior={peso.anterior?.vitales.peso} unidad="kg" fueraDeRango={estImc ? estImc.txt === "Sobrepeso" || estImc.txt === "Obesidad" : false} />
            </Tarjeta>
          )}
          {imc.ultimo && (
            <Tarjeta icono="bi-person-bounding-box" color="#6366f1" titulo="IMC" valor={imc.ultimo.vitales.imc} unidad="kg/m²" estado={estImc} fecha={imc.ultimo.fecha}>
              <Tendencia actual={imc.ultimo.vitales.imc} anterior={imc.anterior?.vitales.imc} unidad="" fueraDeRango={estImc?.txt === "Sobrepeso" || estImc?.txt === "Obesidad"} />
            </Tarjeta>
          )}
          {fc.ultimo && (
            <Tarjeta icono="bi-activity" color="#e11d48" titulo="Pulso" valor={fc.ultimo.vitales.fc} unidad="lpm" estado={estadoFc(fc.ultimo.vitales.fc)} fecha={fc.ultimo.fecha}>
              <Tendencia actual={fc.ultimo.vitales.fc} anterior={fc.anterior?.vitales.fc} unidad="" decimales={0} />
            </Tarjeta>
          )}
          {spo2.ultimo && (
            <Tarjeta icono="bi-lungs-fill" color="#0284c7" titulo="Saturación" valor={spo2.ultimo.vitales.spo2} unidad="%" estado={estadoSpo2(spo2.ultimo.vitales.spo2)} fecha={spo2.ultimo.fecha}>
              <Tendencia actual={spo2.ultimo.vitales.spo2} anterior={spo2.anterior?.vitales.spo2} unidad="%" decimales={0} />
            </Tarjeta>
          )}
          {temp.ultimo && (
            <Tarjeta icono="bi-thermometer-half" color="#ea580c" titulo="Temperatura" valor={temp.ultimo.vitales.temp} unidad="°C" estado={estadoTemp(temp.ultimo.vitales.temp)} fecha={temp.ultimo.fecha}>
              <Tendencia actual={temp.ultimo.vitales.temp} anterior={temp.anterior?.vitales.temp} unidad="°C" />
            </Tarjeta>
          )}
        </div>
      ) : (
        <div className="alert alert-light border small mb-0">
          <i className="bi bi-info-circle me-1" />Las consultas de este paciente no tienen signos vitales registrados. Al anotarlos en la consulta (pestaña SOAP → Objetivo) aparecerán aquí las gráficas.
        </div>
      )}

      {/* Gráficas */}
      {conSignos.length > 0 && (
        <div className="evo-graficas">
          {hay("sis") && (
            <Panel titulo="Presión arterial" icono="bi-heart-pulse" color="#ef4444"
              extra={<span style={{ fontSize: "0.72rem", color: "#64748b" }}>meta &lt; 130/80</span>}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={puntos} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis {...ejeX} />
                  <YAxis {...ejeY} domain={[(min) => Math.min(50, Math.floor(min / 10) * 10), (max) => Math.max(160, Math.ceil(max / 10) * 10)]} />
                  <Tooltip {...tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <ReferenceLine y={130} stroke="#f87171" strokeDasharray="4 4" />
                  <ReferenceLine y={80} stroke="#fb923c" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="sis" name="Sistólica" stroke="#dc2626" strokeWidth={2.2} dot={{ r: 3.5 }} connectNulls />
                  <Line type="monotone" dataKey="dia" name="Diastólica" stroke="#2563eb" strokeWidth={2.2} dot={{ r: 3.5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          )}

          {hay("peso") && (
            <Panel titulo="Peso" icono="bi-speedometer" color="#0ea5e9">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={puntos} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis {...ejeX} />
                  <YAxis {...ejeY} domain={[(min) => Math.floor(min - 3), (max) => Math.ceil(max + 3)]} />
                  <Tooltip {...tooltip} formatter={(v) => [`${v} kg`, "Peso"]} />
                  <Line type="monotone" dataKey="peso" name="Peso" stroke="#0284c7" strokeWidth={2.2} dot={{ r: 3.5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          )}

          {hay("imc") && (
            <Panel titulo="Índice de masa corporal" icono="bi-person-bounding-box" color="#6366f1"
              extra={<span style={{ fontSize: "0.72rem", color: "#15803d" }}>▬ rango normal 18.5–24.9</span>}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={puntos} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis {...ejeX} />
                  <YAxis {...ejeY} domain={[(min) => Math.min(16, Math.floor(min - 1)), (max) => Math.max(32, Math.ceil(max + 1))]} />
                  <Tooltip {...tooltip} formatter={(v) => [v, "IMC"]} />
                  <ReferenceArea y1={18.5} y2={24.9} fill="#22c55e" fillOpacity={0.1} />
                  <ReferenceLine y={30} stroke="#f87171" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="imc" name="IMC" stroke="#4f46e5" strokeWidth={2.2} dot={{ r: 3.5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          )}

          {otrosConDatos.length > 0 && (
            <Panel titulo="Otros signos" icono="bi-activity" color="#e11d48"
              extra={
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {otrosConDatos.map((o) => (
                    <button key={o.key} type="button" className={`evo-chip ${otroSel.key === o.key ? "on" : ""}`} onClick={() => setOtro(o.key)}>{o.label}</button>
                  ))}
                </div>
              }>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={puntos} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis {...ejeX} />
                  <YAxis {...ejeY} domain={[(min) => Math.floor(Math.min(min, otroSel.rango[0]) - 2), (max) => Math.ceil(Math.max(max, otroSel.rango[1]) + 2)]} />
                  <Tooltip {...tooltip} formatter={(v) => [`${v} ${otroSel.unidad}`, otroSel.label]} />
                  <ReferenceArea y1={otroSel.rango[0]} y2={otroSel.rango[1]} fill="#22c55e" fillOpacity={0.1} />
                  <Line type="monotone" dataKey={otroSel.key} name={otroSel.label} stroke={otroSel.color} strokeWidth={2.2} dot={{ r: 3.5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: "0.72rem", color: "#15803d" }}>▬ rango normal {otroSel.rango[0]}–{otroSel.rango[1]} {otroSel.unidad}</div>
            </Panel>
          )}
        </div>
      )}

      {/* Diagnósticos, asistencia y línea de tiempo */}
      <div className="evo-graficas">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          {d.diagnosticos.length > 0 && (
            <Panel titulo="Diagnósticos más frecuentes" icono="bi-clipboard2-pulse" color="#0891b2">
              {d.diagnosticos.map((x, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i ? "1px solid #f1f5f9" : "none", fontSize: "0.83rem" }}>
                  {x.cie && <span style={{ fontFamily: "monospace", fontSize: "0.72rem", background: "#ecfeff", color: "#0e7490", borderRadius: 5, padding: "1px 6px" }}>{x.cie}</span>}
                  <span style={{ flex: 1, minWidth: 0 }} className="text-truncate" title={x.nombre}>{x.nombre}</span>
                  <span style={{ fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>{x.veces} {x.veces === 1 ? "vez" : "veces"}</span>
                </div>
              ))}
            </Panel>
          )}

          {asis && totalCitas > 0 && (
            <Panel titulo="Asistencia a citas" icono="bi-calendar-check" color="#16a34a">
              <div style={{ fontSize: "0.85rem", marginBottom: 6 }}>
                Asistió a <strong>{asis.asistio}</strong> de <strong>{totalCitas}</strong> citas
                <span style={{ color: "#64748b" }}> ({Math.round((asis.asistio / totalCitas) * 100)}%)</span>
              </div>
              <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", background: "#f1f5f9" }}>
                <div style={{ width: `${(asis.asistio / totalCitas) * 100}%`, background: "#22c55e" }} />
                <div style={{ width: `${(asis.falto / totalCitas) * 100}%`, background: "#ef4444" }} />
                <div style={{ width: `${(asis.cancelo / totalCitas) * 100}%`, background: "#94a3b8" }} />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "0.74rem", color: "#64748b", marginTop: 6 }}>
                <span><span style={{ color: "#22c55e" }}>●</span> Asistió {asis.asistio}</span>
                <span><span style={{ color: "#ef4444" }}>●</span> Faltó {asis.falto}</span>
                <span><span style={{ color: "#94a3b8" }}>●</span> Canceló {asis.cancelo}</span>
              </div>
            </Panel>
          )}
        </div>

        <Panel titulo="Línea de tiempo de consultas" icono="bi-clock-history" color="#8b5cf6">
          <div style={{ position: "relative", paddingLeft: 16 }}>
            <div style={{ position: "absolute", left: 4, top: 6, bottom: 6, width: 2, background: "#e9d5ff" }} />
            {(verTodas ? lineaTiempo : lineaTiempo.slice(0, 6)).map((c) => {
              const v = c.vitales;
              const e = estadoPresion(v.sis, v.dia);
              return (
                <div key={c.id} style={{ position: "relative", padding: "4px 0 10px" }}>
                  <span style={{ position: "absolute", left: -16, top: 8, width: 10, height: 10, borderRadius: "50%", background: "#8b5cf6", border: "2px solid #fff", boxShadow: "0 0 0 1px #c4b5fd" }} />
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.82rem", color: "#1e293b" }}>{dayjs(c.fecha).format("DD/MM/YYYY")}</strong>
                    {c.estado === "BORRADOR" && <span style={{ fontSize: "0.66rem", background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "0 5px" }}>borrador</span>}
                    {c.medico && <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{c.medico}</span>}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#334155" }}>
                    {c.diagnostico || c.diagnostico_cie || <span style={{ color: "#94a3b8" }}>Sin diagnóstico registrado</span>}
                  </div>
                  {(v.sis || v.peso) && (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: "0.74rem", color: "#64748b", marginTop: 1 }}>
                      {v.sis && <span>P.A. <strong style={{ color: e?.fg }}>{v.sis}/{v.dia}</strong></span>}
                      {v.peso && <span>Peso <strong>{v.peso} kg</strong></span>}
                      {v.imc && <span>IMC <strong>{v.imc}</strong></span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {lineaTiempo.length > 6 && (
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setVerTodas((x) => !x)}>
              {verTodas ? "Ver menos" : `Ver las ${lineaTiempo.length} consultas`}
            </button>
          )}
        </Panel>
      </div>

      <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 10, marginBottom: 0 }}>
        <i className="bi bi-info-circle me-1" />Los rangos de color son orientativos (valores de referencia para adultos). La decisión clínica corresponde al médico.
      </p>
    </div>
  );
}
