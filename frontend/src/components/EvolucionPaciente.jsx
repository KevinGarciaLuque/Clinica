// 📈 Evolución del paciente: cómo ha ido según sus consultas.
// Tarjetas con el último valor de cada signo (en verde/amarillo/rojo según el rango
// normal y con la tendencia respecto a la consulta anterior), gráficas en el tiempo
// y la línea de tiempo de consultas con su diagnóstico. Solo lectura.
import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceArea, ReferenceLine,
} from "recharts";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";
import EvolucionImprimible from "./EvolucionImprimible";
import {
  estadoPresion, presionEnRango, estadoImc, estadoFc, estadoSpo2, estadoTemp, OTROS, fechaCorta, haceCuanto,
  ultimos, NIVEL, textoCambio, conFechas,
} from "../utils/evolucion";

const PERIODOS = [
  { key: "6",  label: "6 meses" },
  { key: "12", label: "12 meses" },
  { key: "todo", label: "Todo" },
];

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

// Punto de la gráfica de laboratorio: rojo si el resultado salió fuera de rango
function PuntoLab({ cx, cy, payload }) {
  if (cx == null || cy == null || payload?.valor == null) return null;
  const malo = payload.anormal;
  return <circle cx={cx} cy={cy} r={malo ? 5 : 4} fill={malo ? "#dc2626" : "#fff"} stroke={malo ? "#dc2626" : "#059669"} strokeWidth={2} />;
}

const ejeX = { dataKey: "fecha", tickFormatter: fechaCorta, tick: { fontSize: 10.5, fill: "#64748b" }, axisLine: false, tickLine: false, minTickGap: 18 };
const ejeY = { tick: { fontSize: 10.5, fill: "#64748b" }, axisLine: false, tickLine: false, width: 36 };
const tooltipBase = { contentStyle: { fontSize: 12, borderRadius: 8, maxWidth: 280, whiteSpace: "normal" } };

export default function EvolucionPaciente({ pacienteId }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState("12");
  const [otro, setOtro] = useState("fc");
  const [verTodas, setVerTodas] = useState(false);
  const [examen, setExamen] = useState(null);
  const [verMarcas, setVerMarcas] = useState(true);
  const [imprimiendo, setImprimiendo] = useState(false);
  const { user } = useAuth();
  const terminarImpresion = useCallback(() => setImprimiendo(false), []);

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
  const desdePeriodo = periodo === "todo" ? "" : dayjs().subtract(Number(periodo), "month").format("YYYY-MM-DD");
  const cambios = useMemo(() => (d?.tratamiento || []).filter((c) => c.fecha >= desdePeriodo), [d, desdePeriodo]);
  const fechasCambio = useMemo(() => (verMarcas ? cambios.map((c) => c.fecha) : []), [cambios, verMarcas]);
  const cambioPorFecha = useMemo(() => new Map(cambios.map((c) => [c.fecha, c])), [cambios]);
  const puntos = useMemo(
    () => conFechas(enPeriodo.map((c) => ({ fecha: c.fecha, diagnostico: c.diagnostico, ...c.vitales })), fechasCambio),
    [enPeriodo, fechasCambio]
  );

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

  // Leyenda al pasar el mouse: fecha y, si ese día hubo cambio de receta, cuál fue
  const tooltip = {
    ...tooltipBase,
    labelFormatter: (f) => {
      const c = cambioPorFecha.get(f);
      return (
        <span>
          {dayjs(f).format("DD/MM/YYYY")}
          {c && <span style={{ display: "block", color: "#7c3aed", fontWeight: 600, marginTop: 2 }}>💊 {textoCambio(c)}</span>}
        </span>
      );
    },
  };
  const marcas = fechasCambio.map((f) => (
    <ReferenceLine key={`rx-${f}`} x={f} stroke="#a78bfa" strokeDasharray="3 3" label={{ value: "Rx", position: "insideTop", fill: "#7c3aed", fontSize: 10, fontWeight: 700 }} />
  ));

  // Laboratorio: exámenes con resultados numéricos en el periodo
  const labs = (d.laboratorios || [])
    .map((g) => ({ ...g, valores: g.valores.filter((v) => v.fecha >= desdePeriodo) }))
    .filter((g) => g.valores.length);
  // Por defecto: el examen que requiere atención (último resultado fuera de rango y con historial)
  const labSel = labs.find((g) => g.clave === examen)
    || labs.find((g) => g.valores.length >= 2 && g.valores[g.valores.length - 1].anormal)
    || labs.find((g) => g.valores.length >= 2) || labs[0];
  const serieLab = labSel ? conFechas(labSel.valores.map((v) => ({ ...v })), fechasCambio.filter((f) => f >= labSel.valores[0].fecha)) : [];
  const avisos = d.avisos || [];

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
        .evo-lab { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 14px; align-items: start; }
        @media (max-width: 767.98px) { .evo-lab { grid-template-columns: minmax(0, 1fr); } }
        .evo-chip.on-rx { background: #f5f3ff; border-color: #c4b5fd; color: #6d28d9; }
      `}</style>

      {/* Encabezado + periodo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 800, color: "#1e293b" }}><i className="bi bi-graph-up-arrow me-2" style={{ color: "#2563eb" }} />Evolución del paciente</div>
          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
            {consultas.length} consulta(s){conSignos.length !== consultas.length ? `, ${conSignos.length} con signos vitales` : ""} · última {haceCuanto(ultimaConsulta.fecha)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(d.tratamiento || []).length > 0 && (
            <button type="button" className={`evo-chip ${verMarcas ? "on-rx" : ""}`} onClick={() => setVerMarcas((x) => !x)}
              title="Marca en las gráficas los días en que cambió la receta">
              💊 Cambios de receta
            </button>
          )}
          <button type="button" className="evo-chip" onClick={() => setImprimiendo(true)} title="Imprimir o guardar como PDF (para referir al paciente o entregárselo)">
            <i className="bi bi-printer me-1" />Imprimir / PDF
          </button>
          {PERIODOS.map((p) => (
            <button key={p.key} type="button" className={`evo-chip ${periodo === p.key ? "on" : ""}`} onClick={() => setPeriodo(p.key)}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Puntos de atención (avisos automáticos) */}
      {avisos.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b", marginBottom: 6 }}>
            <i className="bi bi-lightbulb me-2" style={{ color: "#f59e0b" }} />Puntos de atención
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {avisos.map((a, i) => {
              const n = NIVEL[a.nivel] || NIVEL.medio;
              return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: n.bg, border: `1px solid ${n.borde}`, borderRadius: 8, padding: "6px 10px", fontSize: "0.83rem", color: n.fg }}>
                  <i className={`bi ${n.icono}`} style={{ marginTop: 2 }} />
                  <span style={{ color: "#1e293b" }}>{a.texto}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tarjetas de resumen */}
      {conSignos.length > 0 ? (
        <div className="evo-tarjetas">
          {pa.ultimo && (
            <Tarjeta icono="bi-heart-pulse-fill" color="#ef4444" titulo="Presión" valor={`${pa.ultimo.vitales.sis}/${pa.ultimo.vitales.dia}`} unidad="mmHg" estado={estPa} fecha={pa.ultimo.fecha}>
              <Tendencia actual={pa.ultimo.vitales.sis} anterior={pa.anterior?.vitales.sis} unidad="" decimales={0} fueraDeRango={!!estPa && !presionEnRango(estPa)} />
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
              extra={<span style={{ fontSize: "0.72rem", color: "#64748b" }}>hipertensión ≥ 140/90</span>}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={puntos} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis {...ejeX} />
                  <YAxis {...ejeY} domain={[(min) => Math.min(50, Math.floor(min / 10) * 10), (max) => Math.max(160, Math.ceil(max / 10) * 10)]} />
                  <Tooltip {...tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <ReferenceLine y={140} stroke="#f87171" strokeDasharray="4 4" />
                  {marcas}
                  <ReferenceLine y={90} stroke="#fb923c" strokeDasharray="4 4" />
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
                  {marcas}
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
                  {marcas}
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
                  {marcas}
                  <Line type="monotone" dataKey={otroSel.key} name={otroSel.label} stroke={otroSel.color} strokeWidth={2.2} dot={{ r: 3.5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: "0.72rem", color: "#15803d" }}>▬ rango normal {otroSel.rango[0]}–{otroSel.rango[1]} {otroSel.unidad}</div>
            </Panel>
          )}
        </div>
      )}

      {/* Laboratorio */}
      {labSel && (
        <div style={{ marginTop: 10 }}>
          <Panel titulo="Laboratorio" icono="bi-droplet-half" color="#059669"
            extra={
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {labs.map((g) => (
                  <button key={g.clave} type="button" className={`evo-chip ${labSel.clave === g.clave ? "on" : ""}`} onClick={() => setExamen(g.clave)}
                    title={`${g.valores.length} resultado(s)`} style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {g.nombre}
                    {g.valores[g.valores.length - 1].anormal && <span style={{ color: "#dc2626", marginLeft: 4 }} title="Último resultado fuera de rango">●</span>}
                  </button>
                ))}
              </div>
            }>
            <div className="evo-lab">
              <div style={{ minWidth: 0 }}>
                {labSel.valores.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={230}>
                    <LineChart data={serieLab} margin={{ top: 10, right: 10, left: -4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis {...ejeX} />
                      <YAxis {...ejeY} width={40} domain={[
                        (min) => Math.floor(Math.min(min, labSel.min ?? min) * 0.9),
                        (max) => Math.ceil(Math.max(max, labSel.max ?? max) * 1.08),
                      ]} />
                      <Tooltip {...tooltip} formatter={(v) => [`${v} ${labSel.unidad}`, labSel.nombre]} />
                      {(labSel.min != null || labSel.max != null) && (
                        <ReferenceArea y1={labSel.min ?? 0} y2={labSel.max ?? undefined} fill="#22c55e" fillOpacity={0.1} />
                      )}
                      {marcas.filter((m) => m.props.x >= labSel.valores[0].fecha)}
                      <Line type="monotone" dataKey="valor" name={labSel.nombre} stroke="#059669" strokeWidth={2.2} dot={<PuntoLab />} activeDot={{ r: 6 }} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted small py-4 text-center">Solo hay un resultado de {labSel.nombre}: la gráfica aparecerá cuando haya dos o más.</div>
                )}
                <div style={{ fontSize: "0.72rem", color: "#64748b", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {(labSel.min != null || labSel.max != null) && (
                    <span style={{ color: "#15803d" }}>▬ rango normal {labSel.min ?? "—"}–{labSel.max ?? "—"} {labSel.unidad}</span>
                  )}
                  <span><span style={{ color: "#dc2626" }}>●</span> fuera de rango</span>
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <table className="table table-sm mb-0" style={{ fontSize: "0.8rem" }}>
                  <thead><tr><th style={{ fontWeight: 600, color: "#64748b" }}>Fecha</th><th style={{ fontWeight: 600, color: "#64748b", textAlign: "right" }}>Resultado</th></tr></thead>
                  <tbody>
                    {[...labSel.valores].reverse().slice(0, 6).map((v, i) => (
                      <tr key={i}>
                        <td>{dayjs(v.fecha).format("DD/MM/YYYY")}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: v.anormal ? "#dc2626" : "#0f172a", whiteSpace: "nowrap" }}>
                          {v.valor} <span style={{ fontWeight: 500, color: "#64748b" }}>{labSel.unidad}</span>{v.anormal && <i className="bi bi-exclamation-circle-fill ms-1" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>
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

          {cambios.length > 0 && (
            <Panel titulo="Cambios de tratamiento" icono="bi-capsule" color="#7c3aed">
              {[...cambios].reverse().slice(0, 6).map((c, i) => (
                <div key={i} style={{ padding: "6px 0", borderTop: i ? "1px solid #f1f5f9" : "none", fontSize: "0.8rem" }}>
                  <strong style={{ color: "#1e293b" }}>{dayjs(c.fecha).format("DD/MM/YYYY")}</strong>
                  {c.inicia.length > 0 && <div><span style={{ color: "#15803d", fontWeight: 600 }}>{c.primera ? "Tratamiento:" : "Nuevo:"}</span> {c.inicia.join(", ")}</div>}
                  {c.ajusta.map((a, j) => <div key={j}><span style={{ color: "#b45309", fontWeight: 600 }}>Cambio de dosis:</span> {a.antes} → {a.ahora}</div>)}
                  {c.no_incluye.length > 0 && <div style={{ color: "#64748b" }}><span style={{ fontWeight: 600 }}>No incluido en esta receta:</span> {c.no_incluye.join(", ")}</div>}
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

      {imprimiendo && (
        <EvolucionImprimible
          d={d}
          desde={desdePeriodo}
          periodoTxt={periodo === "todo" ? "Todo el historial" : `Últimos ${periodo} meses`}
          usuario={[user?.nombres, user?.apellidos].filter(Boolean).join(" ")}
          onListo={terminarImpresion}
        />
      )}

      <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 10, marginBottom: 0 }}>
        <i className="bi bi-info-circle me-1" />Los rangos de color son orientativos (valores de referencia para adultos). La decisión clínica corresponde al médico.
      </p>
    </div>
  );
}
