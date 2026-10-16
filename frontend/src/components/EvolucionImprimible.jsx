// 📄 Resumen imprimible de la evolución del paciente (Imprimir / Guardar como PDF).
// Hoja tamaño carta/A4 con: datos de la clínica y del paciente, alergias y
// antecedentes, puntos de atención, últimos valores, gráficas de signos y de
// laboratorio, diagnósticos, cambios de tratamiento y últimas consultas.
// Se dibuja fuera de la pantalla y solo aparece al imprimir.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ReferenceArea, ReferenceLine } from "recharts";
import {
  estadoPresion, estadoImc, estadoFc, estadoSpo2, estadoTemp, fechaCorta, ultimos, textoCambio, conFechas,
} from "../utils/evolucion";

const API_URL = import.meta.env.VITE_API_URL || "";
const SEXO = { M: "Masculino", F: "Femenino", OTRO: "Otro" };
const NIVEL_TXT = { alto: "🔴", medio: "🟡", bueno: "🟢" };

const CSS = `
  .evo-print-root { display: none; }
  @media print {
    @page { size: letter; margin: 11mm 12mm; }
    body > *:not(.evo-print-root) { display: none !important; }
    html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
    .evo-print-root { display: block; color: #0f172a; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 10.5pt; }
    .evo-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ep-bloque { break-inside: avoid; margin-bottom: 10px; }
    .ep-titulo { font-size: 10pt; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1.5px solid #c7d2fe; padding-bottom: 2px; margin: 0 0 6px; }
    .ep-tabla { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    .ep-tabla th { text-align: left; color: #475569; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding: 3px 4px; }
    .ep-tabla td { border-bottom: 1px solid #eef2f7; padding: 3px 4px; vertical-align: top; }
    .ep-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .ep-chip { display: inline-block; border-radius: 4px; padding: 0 5px; font-size: 8.5pt; font-weight: 700; }
    .ep-grafica-t { font-size: 9pt; font-weight: 700; color: #334155; margin-bottom: 2px; }
  }
`;

const ejeX = { dataKey: "fecha", tickFormatter: fechaCorta, tick: { fontSize: 9, fill: "#475569" }, axisLine: false, tickLine: false, minTickGap: 14 };
const ejeY = { tick: { fontSize: 9, fill: "#475569" }, axisLine: false, tickLine: false, width: 34 };

function Grafica({ titulo, data, ancho, alto = 150, children, nota }) {
  return (
    <div className="ep-bloque">
      <div className="ep-grafica-t">{titulo}</div>
      <LineChart width={ancho} height={alto} data={data} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis {...ejeX} />
        {children}
      </LineChart>
      {nota && <div style={{ fontSize: "8pt", color: "#64748b" }}>{nota}</div>}
    </div>
  );
}

export default function EvolucionImprimible({ d, desde, periodoTxt, usuario, onListo }) {
  // Imprime en cuanto el resumen está dibujado y avisa al terminar
  useEffect(() => {
    const fin = () => onListo?.();
    window.addEventListener("afterprint", fin);
    const t = setTimeout(() => window.print(), 350);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", fin); };
  }, [onListo]);

  const p = d.paciente || {};
  const cl = d.clinica || {};
  const logo = cl.logo_url ? (cl.logo_url.startsWith("http") || cl.logo_url.startsWith("data:") ? cl.logo_url : `${API_URL}${cl.logo_url}`) : null;
  const consultas = d.consultas || [];
  const enPeriodo = consultas.filter((c) => c.fecha >= desde);
  const cambios = (d.tratamiento || []).filter((c) => c.fecha >= desde);
  const fechasCambio = cambios.map((c) => c.fecha);
  const puntos = conFechas(enPeriodo.map((c) => ({ fecha: c.fecha, ...c.vitales })), fechasCambio);
  const hay = (k) => puntos.some((x) => x[k] != null);
  const marcas = (desdeFecha = "") => fechasCambio.filter((f) => f >= desdeFecha).map((f) => (
    <ReferenceLine key={f} x={f} stroke="#a78bfa" strokeDasharray="3 3" label={{ value: "Rx", position: "insideTop", fill: "#7c3aed", fontSize: 8, fontWeight: 700 }} />
  ));
  const labs = (d.laboratorios || [])
    .map((g) => ({ ...g, valores: g.valores.filter((v) => v.fecha >= desde) }))
    .filter((g) => g.valores.length >= 2)
    .sort((a, b) => Number(b.valores[b.valores.length - 1].anormal) - Number(a.valores[a.valores.length - 1].anormal))
    .slice(0, 4);
  const labsSueltos = (d.laboratorios || []).filter((g) => !labs.some((x) => x.clave === g.clave) && g.valores.some((v) => v.fecha >= desde));

  // Tabla de últimos valores
  const filaSigno = (titulo, clave, unidad, estadoFn, formato = (c) => c.vitales[clave]) => {
    const { ultimo, anterior } = ultimos(consultas, clave);
    if (!ultimo) return null;
    const est = estadoFn ? estadoFn(ultimo) : null;
    return (
      <tr key={clave}>
        <td style={{ fontWeight: 600 }}>{titulo}</td>
        <td style={{ fontWeight: 800 }}>{formato(ultimo)} <span style={{ fontWeight: 500, color: "#64748b" }}>{unidad}</span></td>
        <td>{dayjs(ultimo.fecha).format("DD/MM/YYYY")}</td>
        <td style={{ color: "#64748b" }}>{anterior ? `${formato(anterior)} (${fechaCorta(anterior.fecha)})` : "—"}</td>
        <td>{est && <span className="ep-chip" style={{ background: est.bg, color: est.fg }}>{est.txt}</span>}</td>
      </tr>
    );
  };

  return createPortal(
    <div className="evo-print-root">
      <style>{CSS}</style>

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "2.5px solid #1e3a8a", paddingBottom: 8, marginBottom: 10 }}>
        {logo && <img src={logo} alt="" style={{ height: 46, maxWidth: 120, objectFit: "contain" }} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "14pt", fontWeight: 800, color: "#1e3a8a" }}>{cl.nombre || "Medic-KG"}</div>
          <div style={{ fontSize: "8.5pt", color: "#475569" }}>{[cl.direccion, cl.ciudad, cl.telefono, cl.email].filter(Boolean).join(" · ")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "12pt", fontWeight: 800 }}>Resumen de evolución</div>
          <div style={{ fontSize: "8.5pt", color: "#475569" }}>{periodoTxt} · {dayjs().format("DD/MM/YYYY")}</div>
        </div>
      </div>

      {/* Paciente */}
      <div className="ep-bloque" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px" }}>
        <div style={{ fontSize: "12pt", fontWeight: 800 }}>{p.nombres} {p.apellidos}</div>
        <div style={{ fontSize: "9.5pt", color: "#334155" }}>
          {[p.dni ? `DNI: ${p.dni}` : null, p.edad != null ? `${p.edad} años` : null, SEXO[p.sexo], p.fecha_nacimiento ? `Nac.: ${dayjs(p.fecha_nacimiento).format("DD/MM/YYYY")}` : null, p.grupo_sanguineo ? `Sangre: ${p.grupo_sanguineo}` : null].filter(Boolean).join("   ·   ")}
        </div>
        <div style={{ fontSize: "9.5pt", marginTop: 3 }}>
          <strong style={{ color: "#b91c1c" }}>Alergias: </strong>
          {d.alergias?.length ? d.alergias.map((a) => `${a.agente}${a.severidad ? ` (${a.severidad.toLowerCase()})` : ""}`).join(", ") : "Sin alergias registradas"}
        </div>
        {d.antecedentes?.length > 0 && (
          <div style={{ fontSize: "9.5pt" }}>
            <strong>Antecedentes: </strong>{d.antecedentes.map((a) => a.descripcion || a.tipo).join(" · ")}
          </div>
        )}
      </div>

      {/* Puntos de atención */}
      {d.avisos?.length > 0 && (
        <div className="ep-bloque">
          <div className="ep-titulo">Puntos de atención</div>
          {d.avisos.map((a, i) => <div key={i} style={{ fontSize: "9.5pt", marginBottom: 2 }}>{NIVEL_TXT[a.nivel] || "•"} {a.texto}</div>)}
        </div>
      )}

      {/* Últimos valores */}
      <div className="ep-bloque">
        <div className="ep-titulo">Últimos signos vitales</div>
        <table className="ep-tabla">
          <thead><tr><th>Signo</th><th>Último</th><th>Fecha</th><th>Anterior</th><th>Estado</th></tr></thead>
          <tbody>
            {filaSigno("Presión arterial", "sis", "mmHg", (c) => estadoPresion(c.vitales.sis, c.vitales.dia), (c) => `${c.vitales.sis}/${c.vitales.dia}`)}
            {filaSigno("Peso", "peso", "kg")}
            {filaSigno("IMC", "imc", "kg/m²", (c) => estadoImc(c.vitales.imc))}
            {filaSigno("Pulso", "fc", "lpm", (c) => estadoFc(c.vitales.fc))}
            {filaSigno("Saturación", "spo2", "%", (c) => estadoSpo2(c.vitales.spo2))}
            {filaSigno("Temperatura", "temp", "°C", (c) => estadoTemp(c.vitales.temp))}
          </tbody>
        </table>
      </div>

      {/* Gráficas de signos */}
      {hay("sis") && (
        <Grafica titulo="Presión arterial (mmHg) — rojo: sistólica · azul: diastólica · líneas: hipertensión ≥ 140/90" data={puntos} ancho={700} alto={170}>
          <YAxis {...ejeY} domain={[(min) => Math.min(50, Math.floor(min / 10) * 10), (max) => Math.max(160, Math.ceil(max / 10) * 10)]} />
          <ReferenceLine y={140} stroke="#f87171" strokeDasharray="4 4" />
          <ReferenceLine y={90} stroke="#fb923c" strokeDasharray="4 4" />
          {marcas()}
          <Line dataKey="sis" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          <Line dataKey="dia" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
        </Grafica>
      )}
      {(hay("peso") || hay("imc")) && (
        <div className="ep-2col">
          {hay("peso") && (
            <Grafica titulo="Peso (kg)" data={puntos} ancho={340}>
              <YAxis {...ejeY} domain={[(min) => Math.floor(min - 3), (max) => Math.ceil(max + 3)]} />
              {marcas()}
              <Line dataKey="peso" stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
            </Grafica>
          )}
          {hay("imc") && (
            <Grafica titulo="IMC (kg/m²)" data={puntos} ancho={340} nota="Franja verde: rango normal 18.5–24.9">
              <YAxis {...ejeY} domain={[(min) => Math.min(16, Math.floor(min - 1)), (max) => Math.max(32, Math.ceil(max + 1))]} />
              <ReferenceArea y1={18.5} y2={24.9} fill="#22c55e" fillOpacity={0.15} />
              {marcas()}
              <Line dataKey="imc" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
            </Grafica>
          )}
        </div>
      )}

      {/* Laboratorio */}
      {(labs.length > 0 || labsSueltos.length > 0) && (
        <div className="ep-bloque">
          <div className="ep-titulo">Laboratorio</div>
          <div className="ep-2col">
            {labs.map((g) => {
              const serie = conFechas(g.valores.map((v) => ({ ...v })), fechasCambio.filter((f) => f >= g.valores[0].fecha));
              return (
                <Grafica key={g.clave} titulo={`${g.nombre}${g.unidad ? ` (${g.unidad})` : ""}`} data={serie} ancho={340} alto={140}
                  nota={`${g.min != null || g.max != null ? `Rango normal ${g.min ?? "—"}–${g.max ?? "—"} · ` : ""}Último: ${g.valores[g.valores.length - 1].valor}${g.valores[g.valores.length - 1].anormal ? " (fuera de rango)" : ""}`}>
                  <YAxis {...ejeY} domain={[(min) => Math.floor(Math.min(min, g.min ?? min) * 0.9), (max) => Math.ceil(Math.max(max, g.max ?? max) * 1.08)]} />
                  {(g.min != null || g.max != null) && <ReferenceArea y1={g.min ?? 0} y2={g.max ?? undefined} fill="#22c55e" fillOpacity={0.15} />}
                  {marcas(g.valores[0].fecha)}
                  <Line dataKey="valor" stroke="#059669" strokeWidth={2} connectNulls isAnimationActive={false}
                    dot={({ cx, cy, payload, index }) => (payload?.valor == null || cx == null) ? <g key={index} /> : (
                      <circle key={index} cx={cx} cy={cy} r={3.5} fill={payload.anormal ? "#dc2626" : "#fff"} stroke={payload.anormal ? "#dc2626" : "#059669"} strokeWidth={1.8} />
                    )} />
                </Grafica>
              );
            })}
          </div>
          {labsSueltos.length > 0 && (
            <div style={{ fontSize: "9pt", color: "#334155" }}>
              <strong>Otros resultados: </strong>
              {labsSueltos.map((g) => {
                const u = g.valores[g.valores.length - 1];
                return `${g.nombre}: ${u.valor}${g.unidad ? ` ${g.unidad}` : ""}${u.anormal ? " (fuera de rango)" : ""} (${fechaCorta(u.fecha)})`;
              }).join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Diagnósticos y tratamiento */}
      <div className="ep-2col">
        {d.diagnosticos?.length > 0 && (
          <div className="ep-bloque">
            <div className="ep-titulo">Diagnósticos más frecuentes</div>
            <table className="ep-tabla"><tbody>
              {d.diagnosticos.map((x, i) => (
                <tr key={i}><td>{x.cie ? <strong>{x.cie} </strong> : null}{x.nombre}</td><td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{x.veces}×</td></tr>
              ))}
            </tbody></table>
          </div>
        )}
        {cambios.length > 0 && (
          <div className="ep-bloque">
            <div className="ep-titulo">Cambios de tratamiento</div>
            {[...cambios].reverse().slice(0, 6).map((c, i) => (
              <div key={i} style={{ fontSize: "9pt", marginBottom: 3 }}><strong>{dayjs(c.fecha).format("DD/MM/YYYY")}:</strong> {textoCambio(c)}</div>
            ))}
          </div>
        )}
      </div>

      {/* Últimas consultas */}
      {enPeriodo.length > 0 && (
        <div className="ep-bloque">
          <div className="ep-titulo">Consultas del periodo</div>
          <table className="ep-tabla">
            <thead><tr><th>Fecha</th><th>Diagnóstico</th><th>P.A.</th><th>Peso</th><th>Médico</th></tr></thead>
            <tbody>
              {[...enPeriodo].reverse().slice(0, 12).map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{dayjs(c.fecha).format("DD/MM/YYYY")}</td>
                  <td>{c.diagnostico || c.diagnostico_cie || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{c.vitales.sis ? `${c.vitales.sis}/${c.vitales.dia}` : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{c.vitales.peso ? `${c.vitales.peso} kg` : "—"}</td>
                  <td>{c.medico}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ borderTop: "1px solid #cbd5e1", marginTop: 8, paddingTop: 4, fontSize: "7.5pt", color: "#64748b", display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span>Valores de referencia orientativos para adultos. La interpretación y las decisiones clínicas corresponden al médico tratante.</span>
        <span style={{ whiteSpace: "nowrap" }}>Impreso por {usuario || "—"} · {dayjs().format("DD/MM/YYYY HH:mm")} · Medic-KG</span>
      </div>
    </div>,
    document.body
  );
}
