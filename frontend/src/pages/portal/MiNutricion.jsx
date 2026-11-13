/**
 * Portal del paciente — pestaña «Mi nutrición»: su plan de alimentación (porciones,
 * qué es una porción, menú y recomendaciones), PDF del plan y su peso en casa.
 */
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, CartesianGrid } from "recharts";
import { portalApi, fechaHora } from "./portalApi";
import { descargarBlob, compartirEnTelefono, imprimirHtml, errorDeBlob } from "../../utils/descargarPdf";

const C = { verde: "#10b981", oscuro: "#0f172a", gris: "#64748b", borde: "#e2e8f0" };
const fechaCorta = (f) => { const [, m, d] = String(f).split("-"); return `${d}/${m}`; };

function Peso({ perfil, onGuardado }) {
  const [peso, setPeso] = useState("");
  const [estado, setEstado] = useState("");
  const pesos = perfil.pesos;
  const actual = pesos[pesos.length - 1]?.peso ?? null;
  const inicial = pesos[0]?.peso ?? null;
  const meta = perfil.peso_meta;
  const progreso = inicial && actual && meta && inicial !== meta
    ? Math.max(0, Math.min(100, Math.round(((inicial - actual) / (inicial - meta)) * 100))) : null;

  const guardar = async (e) => {
    e.preventDefault();
    setEstado("guardando");
    try {
      await portalApi.post("/nutricion/peso", { paciente_id: perfil.paciente_id, peso });
      setPeso(""); setEstado("ok"); onGuardado();
    } catch (err) {
      setEstado(err.response?.data?.msg || "No se pudo guardar.");
    }
  };

  const datos = pesos.map((p) => ({ ...p, etiqueta: fechaCorta(p.fecha), consulta: p.origen === "consulta" ? p.peso : null, casa: p.origen === "casa" ? p.peso : null }));
  const valores = pesos.map((p) => p.peso).concat(meta ? [meta] : []);
  const min = Math.min(...valores), max = Math.max(...valores);

  return (
    <div className="pp-card">
      <div className="fw-bold mb-2" style={{ color: C.oscuro }}><i className="bi bi-speedometer me-2" style={{ color: C.verde }} />Mi peso</div>
      <div className="d-flex flex-wrap gap-3 mb-2" style={{ fontSize: 14 }}>
        {actual !== null && <span>Último: <b>{actual} kg</b></span>}
        {meta && <span>Meta: <b>{meta} kg</b></span>}
        {inicial !== null && actual !== null && inicial !== actual && <span>Cambio: <b style={{ color: actual < inicial ? C.verde : "#dc2626" }}>{actual - inicial > 0 ? "+" : ""}{Math.round((actual - inicial) * 10) / 10} kg</b></span>}
      </div>
      {progreso !== null && (
        <div className="mb-3">
          <div style={{ height: 10, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${progreso}%`, height: "100%", background: C.verde }} />
          </div>
          <div style={{ fontSize: 12, color: C.gris, marginTop: 4 }}>Llevas el {progreso}% del camino hacia tu meta. ¡Sigue así!</div>
        </div>
      )}
      {datos.length > 1 && (
        <div style={{ width: "100%", height: 190 }}>
          <ResponsiveContainer>
            <LineChart data={datos} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[Math.floor(min - 2), Math.ceil(max + 2)]} />
              <Tooltip formatter={(v, n) => [`${v} kg`, n === "consulta" ? "En consulta" : "En casa"]} />
              {meta && <ReferenceLine y={meta} stroke={C.verde} strokeDasharray="6 4" />}
              <Line type="monotone" dataKey="consulta" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="casa" stroke={C.verde} strokeWidth={0} dot={{ r: 4, fill: C.verde }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="d-flex gap-3 justify-content-center" style={{ fontSize: 12, color: C.gris }}>
            <span><span style={{ color: "#2563eb" }}>●</span> En consulta</span>
            <span><span style={{ color: C.verde }}>●</span> En casa</span>
          </div>
        </div>
      )}
      <form onSubmit={guardar} className="d-flex flex-wrap align-items-center gap-2 mt-3">
        <span style={{ fontSize: 14 }}>¿Cuánto pesas hoy?</span>
        <div className="input-group" style={{ width: 150 }}>
          <input type="number" inputMode="decimal" step="0.1" min="1" max="400" className="form-control" value={peso} required
            onChange={(e) => { setPeso(e.target.value); setEstado(""); }} />
          <span className="input-group-text">kg</span>
        </div>
        <button className="pp-btn" disabled={estado === "guardando" || !peso}>Guardar</button>
        {estado === "ok" && <span style={{ fontSize: 13, color: C.verde }}><i className="bi bi-check-circle-fill me-1" />Guardado. Tu nutricionista lo verá en tu próxima consulta.</span>}
        {estado && !["ok", "guardando"].includes(estado) && <span style={{ fontSize: 13, color: "#dc2626" }}>{estado}</span>}
      </form>
    </div>
  );
}

function Plan({ perfil, grupos, tiempos, dias }) {
  const [dia, setDia] = useState(null);
  const [verPorciones, setVerPorciones] = useState(false);
  const [bajando, setBajando] = useState(false);
  const plan = perfil.plan.plan || {};
  const rq = perfil.plan.requerimiento || {};
  const porciones = plan.porciones || {};
  const menu = plan.menu || {};
  const diasMenu = dias.filter((d) => tiempos.some((t) => String(menu?.[d]?.[t.clave] || "").trim()));
  const diaVisto = dia || diasMenu[0];
  const gruposUsados = grupos.filter((g) => tiempos.some((t) => Number(porciones?.[t.clave]?.[g.clave]) > 0));

  const pdf = async () => {
    setBajando(true);
    try {
      const r = await portalApi.get(`/nutricion/${perfil.paciente_id}/pdf`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      if (!(await compartirEnTelefono(blob, "mi_plan_de_alimentacion.pdf"))) descargarBlob(blob, "mi_plan_de_alimentacion.pdf");
    } catch (e) {
      const info = await errorDeBlob(e);
      if (info.imprimible) {
        const h = await portalApi.get(`/nutricion/${perfil.paciente_id}/pdf?formato=html`, { responseType: "text" }).catch(() => null);
        if (h) imprimirHtml(h.data);
      }
    } finally { setBajando(false); }
  };

  return (
    <>
      <div className="pp-card">
        <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div>
            <div className="fw-bold" style={{ color: C.oscuro }}><i className="bi bi-egg-fried me-2" style={{ color: C.verde }} />Mi plan de alimentación</div>
            <div style={{ fontSize: 13, color: C.gris }}>Del {fechaHora(perfil.plan.fecha).fecha} · {perfil.clinica}</div>
          </div>
          <button className="pp-btn sec" style={{ padding: "6px 12px", fontSize: 13 }} onClick={pdf} disabled={bajando}>
            {bajando ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-file-earmark-pdf" />}Descargar PDF
          </button>
        </div>
        {rq.kcal_objetivo && (
          <div className="d-flex flex-wrap gap-2 mt-3">
            {[[rq.kcal_objetivo, "kcal al día"], [rq.cho_g && `${rq.cho_g} g`, "Carbohidratos"], [rq.pro_g && `${rq.pro_g} g`, "Proteínas"], [rq.gra_g && `${rq.gra_g} g`, "Grasas"]]
              .filter(([v]) => v).map(([v, l]) => (
                <div key={l} style={{ flex: "1 1 120px", background: "#ecfdf5", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                  <div className="fw-bold" style={{ fontSize: 18, color: "#065f46" }}>{v}</div>
                  <div style={{ fontSize: 12, color: C.gris }}>{l}</div>
                </div>
              ))}
          </div>
        )}
        {plan.agua_vasos && <div className="mt-2" style={{ fontSize: 14 }}><i className="bi bi-droplet-fill me-1" style={{ color: "#0ea5e9" }} />Toma <b>{plan.agua_vasos} vasos de agua</b> al día.</div>}
      </div>

      {gruposUsados.length > 0 && (
        <div className="pp-card">
          <div className="fw-bold mb-2" style={{ color: C.oscuro }}>Porciones de cada comida</div>
          {tiempos.filter((t) => grupos.some((g) => Number(porciones?.[t.clave]?.[g.clave]) > 0)).map((t) => (
            <div key={t.clave} className="py-2" style={{ borderTop: `1px solid ${C.borde}`, fontSize: 14 }}>
              <div className="fw-semibold" style={{ color: "#065f46" }}>{t.nombre}</div>
              <div className="d-flex flex-wrap gap-1 mt-1">
                {grupos.filter((g) => Number(porciones?.[t.clave]?.[g.clave]) > 0).map((g) => (
                  <span key={g.clave} className="pp-chip" style={{ background: `${g.color}22`, color: C.oscuro, fontWeight: 600 }}>
                    {porciones[t.clave][g.clave]} {Number(porciones[t.clave][g.clave]) === 1 ? "porción" : "porciones"} de {g.nombre.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-link px-0 fw-semibold" style={{ color: C.verde, textDecoration: "none" }} onClick={() => setVerPorciones((v) => !v)}>
            <i className={`bi bi-chevron-${verPorciones ? "up" : "down"} me-1`} />¿Qué es una porción?
          </button>
          {verPorciones && gruposUsados.map((g) => (
            <div key={g.clave} className="mb-2" style={{ fontSize: 13, borderLeft: `3px solid ${g.color}`, paddingLeft: 8 }}>
              <b>{g.nombre}:</b> <span style={{ color: C.gris }}>{g.ejemplos.join(" · ")}</span>
            </div>
          ))}
        </div>
      )}

      {diasMenu.length > 0 && (
        <div className="pp-card">
          <div className="fw-bold mb-2" style={{ color: C.oscuro }}>Menú de ejemplo</div>
          <div className="d-flex gap-1 mb-2" style={{ overflowX: "auto" }}>
            {diasMenu.map((d) => (
              <button key={d} className={`pp-tab ${diaVisto === d ? "on" : ""}`} style={{ padding: "5px 11px", fontSize: 13 }} onClick={() => setDia(d)}>{d}</button>
            ))}
          </div>
          {tiempos.filter((t) => String(menu?.[diaVisto]?.[t.clave] || "").trim()).map((t) => (
            <div key={t.clave} className="py-2" style={{ borderTop: `1px solid ${C.borde}`, fontSize: 14 }}>
              <div className="fw-semibold" style={{ color: "#065f46" }}>{t.nombre}</div>
              <div>{menu[diaVisto][t.clave]}</div>
            </div>
          ))}
        </div>
      )}

      {String(plan.recomendaciones || "").trim() && (
        <div className="pp-card">
          <div className="fw-bold mb-2" style={{ color: C.oscuro }}><i className="bi bi-chat-heart me-2" style={{ color: C.verde }} />Recomendaciones</div>
          <div style={{ fontSize: 14, whiteSpace: "pre-line" }}>{plan.recomendaciones}</div>
        </div>
      )}
    </>
  );
}

export default function MiNutricion({ data, onRecargar }) {
  return data.perfiles.map((p) => (
    <div key={p.paciente_id}>
      {data.perfiles.length > 1 && <h6 className="fw-bold mt-2" style={{ color: C.oscuro }}>{p.nombre}</h6>}
      <Peso perfil={p} onGuardado={onRecargar} />
      {p.plan
        ? <Plan perfil={p} grupos={data.grupos} tiempos={data.tiempos} dias={data.dias} />
        : <div className="pp-card pp-vacio">Tu nutricionista aún no te ha entregado un plan de alimentación.</div>}
    </div>
  ));
}
