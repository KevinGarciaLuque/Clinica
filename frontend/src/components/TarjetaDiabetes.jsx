/**
 * «Cómo va su diabetes»: resumen del paciente diabético a la vista del médico
 * (HbA1c y su tendencia, tiempo en rango, peso, tratamiento, próxima cita, educación)
 * y avisos de los exámenes que ya tocan (HbA1c cada 3 meses; ojo, riñón, pies y
 * colesterol una vez al año). Datos: GET /endocrinologia/tablero/:paciente_id
 */
import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import api from "../api/api";

const NAR = "#ea580c";
const fCorta = (t) => {
  if (!t) return "—";
  const [y, m, d] = String(t).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
};

function Dato({ icono, color, titulo, children, sub }) {
  return (
    <div className="td-dato">
      <div className="td-tit" style={{ color }}><i className={`bi ${icono}`} />{titulo}</div>
      <div className="td-val">{children}</div>
      {sub && <div className="td-sub">{sub}</div>}
    </div>
  );
}

export default function TarjetaDiabetes({ pacienteId, recarga = 0, onAbrirSeguimiento }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    if (!pacienteId) return undefined;
    let vivo = true;
    api.get(`/endocrinologia/tablero/${pacienteId}`)
      .then((r) => { if (vivo) setD(r.data.data); })
      .catch(() => { if (vivo) setD({ error: true }); });
    return () => { vivo = false; };
  }, [pacienteId, recarga]);

  if (!d || d.error) return null;

  const a1c = d.hba1c;
  const colorA1c = !a1c.ultima ? "#64748b" : a1c.ultima.valor < 7 ? "#16a34a" : a1c.ultima.valor < 8 ? "#d97706" : "#dc2626";
  const flecha = a1c.tendencia === "mejora" ? { i: "bi-arrow-down-right", c: "#16a34a", t: "mejoró" }
    : a1c.tendencia === "empeora" ? { i: "bi-arrow-up-right", c: "#dc2626", t: "subió" }
      : a1c.tendencia === "igual" ? { i: "bi-arrow-right", c: "#64748b", t: "igual" } : null;
  const colorTir = !d.tir ? "#64748b" : d.tir.valor >= 70 ? "#16a34a" : d.tir.valor >= 50 ? "#d97706" : "#dc2626";
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="td">
      <style>{`
        .td { background:#fff; border:1px solid #fed7aa; border-left:5px solid ${NAR}; border-radius:14px; padding:12px 14px; margin-bottom:14px; }
        .td-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
        .td-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px; }
        .td-dato { background:#fafafa; border:1px solid #f1f5f9; border-radius:10px; padding:8px 10px; min-width:0; }
        .td-tit { display:flex; align-items:center; gap:5px; font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.03em; }
        .td-val { font-weight:800; font-size:.98rem; color:#0f172a; margin-top:3px; overflow-wrap:anywhere; }
        .td-sub { font-size:.72rem; color:#64748b; margin-top:1px; overflow-wrap:anywhere; }
        .td-ex { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
        .td-chip { display:inline-flex; align-items:center; gap:5px; border-radius:999px; padding:3px 10px; font-size:.74rem; font-weight:700; border:1px solid; }
        @media (max-width: 576px) { .td-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
      `}</style>

      <div className="td-head">
        <i className="bi bi-droplet-half" style={{ color: NAR, fontSize: "1.1rem" }} />
        <strong style={{ color: "#1e293b", fontSize: "0.95rem" }}>Cómo va su diabetes</strong>
        {d.pendientes > 0 && (
          <span className="td-chip" style={{ color: "#dc2626", borderColor: "#fecaca", background: "#fef2f2" }}>
            <i className="bi bi-exclamation-triangle-fill" />{d.pendientes} examen{d.pendientes > 1 ? "es" : ""} pendiente{d.pendientes > 1 ? "s" : ""}
          </span>
        )}
        {onAbrirSeguimiento && (
          <button type="button" onClick={onAbrirSeguimiento} className="ms-auto"
            style={{ background: "none", border: "none", color: NAR, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
            {d.seguimientos ? "Ver seguimientos" : "Hacer primer seguimiento"} <i className="bi bi-arrow-right" />
          </button>
        )}
      </div>

      {d.seguimientos === 0 ? (
        <div style={{ color: "#64748b", fontSize: "0.86rem" }}>Todavía no tiene seguimientos de diabetes registrados.</div>
      ) : (
        <div className="td-grid">
          <Dato icono="bi-activity" color={NAR} titulo="HbA1c"
            sub={a1c.ultima ? `${fCorta(a1c.ultima.fecha)}${flecha ? ` · ${flecha.t}${a1c.anterior ? ` (antes ${a1c.anterior.valor}%)` : ""}` : ""}` : "sin registro"}>
            {a1c.ultima ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: colorA1c }}>{a1c.ultima.valor}%</span>
                {flecha && <i className={`bi ${flecha.i}`} style={{ color: flecha.c }} />}
                {a1c.serie.length > 1 && (
                  <span style={{ flex: 1, height: 30, minWidth: 50 }}>
                    <ResponsiveContainer>
                      <LineChart data={a1c.serie}>
                        <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                        <Tooltip formatter={(v) => [`${v}%`, "HbA1c"]} labelFormatter={(_, p) => fCorta(p?.[0]?.payload?.fecha)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Line type="monotone" dataKey="valor" stroke={NAR} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </span>
                )}
              </span>
            ) : "—"}
          </Dato>
          <Dato icono="bi-bullseye" color="#0284c7" titulo="Tiempo en rango"
            sub={d.tir ? `${d.tir.fuente}${d.tir.tbr != null ? ` · bajo rango ${d.tir.tbr}%` : ""}` : "sin registro"}>
            {d.tir ? <span style={{ color: colorTir }}>{d.tir.valor}%</span> : "—"}
          </Dato>
          <Dato icono="bi-person" color="#7c3aed" titulo="Peso"
            sub={d.antropometria ? `${d.antropometria.imc ? `IMC ${d.antropometria.imc} · ` : ""}${fCorta(d.antropometria.fecha)}` : "sin registro"}>
            {d.antropometria?.peso ? `${d.antropometria.peso} kg` : "—"}
          </Dato>
          <Dato icono="bi-capsule" color="#0d9488" titulo="Tratamiento"
            sub={d.terapia ? [d.terapia.basal && `basal ${d.terapia.basal} U`, d.terapia.farmacos].filter(Boolean).join(" · ") || fCorta(d.terapia.fecha) : "sin registro"}>
            {d.terapia?.esquema || (d.terapia ? "Ver plan" : "—")}
          </Dato>
          <Dato icono="bi-calendar-check" color="#2563eb" titulo="Próximo control"
            sub={d.proximo?.tipo || (d.proximo ? "" : "sin fecha")}>
            {d.proximo?.fecha ? <span style={{ color: d.proximo.fecha < hoy ? "#dc2626" : "#0f172a" }}>{fCorta(d.proximo.fecha)}</span> : "—"}
          </Dato>
          {d.educacion && (
            <Dato icono="bi-mortarboard" color="#0d9488" titulo="Educación"
              sub={d.educacion.proxima ? `próxima: ${fCorta(d.educacion.proxima)}` : `${d.educacion.sesiones} sesión${d.educacion.sesiones > 1 ? "es" : ""}`}>
              {fCorta(d.educacion.ultima)}
            </Dato>
          )}
        </div>
      )}

      {/* Exámenes que se repiten */}
      <div className="td-ex">
        {d.examenes.map((e) => {
          const st = e.estado === "al_dia"
            ? { c: "#15803d", b: "#bbf7d0", bg: "#f0fdf4", i: "bi-check-circle-fill", t: `${e.nombre} · ${fCorta(e.ultima)}` }
            : e.estado === "vencido"
              ? { c: "#dc2626", b: "#fecaca", bg: "#fef2f2", i: "bi-exclamation-circle-fill", t: `${e.nombre} pendiente desde ${fCorta(e.vence)}` }
              : { c: "#b45309", b: "#fde68a", bg: "#fffbeb", i: "bi-question-circle-fill", t: `${e.nombre}: sin registro` };
          return (
            <span key={e.clave} className="td-chip" style={{ color: st.c, borderColor: st.b, background: st.bg }} title={`${e.nombre} ${e.texto}${e.valor ? ` · último: ${e.valor}` : ""}`}>
              <i className={`bi ${st.i}`} />{st.t}
            </span>
          );
        })}
      </div>
    </div>
  );
}
