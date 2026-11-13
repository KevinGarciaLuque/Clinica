import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { ACTIVIDADES, FORMULAS, clasificarIMC } from "../utils/nutricion";
import { descargarBlob, compartirEnTelefono, imprimirHtml, errorDeBlob } from "../utils/descargarPdf";
import TarjetaHistorial from "./TarjetaHistorial";

/**
 * Historial de consultas de nutrición del paciente: línea de tiempo con las fechas;
 * al abrir una visita se ve todo lo que se registró ese día (medidas, composición,
 * calorías, plan, evaluación, recordatorio de 24 h, hábitos y recomendaciones).
 */

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MESES_LARGO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const SECCIONES = {
  consulta: { nombre: "Consulta", color: "#6366f1", icono: "bi-activity" },
  medidas: { nombre: "Medidas", color: "#16a34a", icono: "bi-rulers" },
  composicion: { nombre: "Composición", color: "#0ea5e9", icono: "bi-speedometer2" },
  calorias: { nombre: "Calorías", color: "#f97316", icono: "bi-fire" },
  plan: { nombre: "Plan", color: "#ec4899", icono: "bi-egg-fried" },
  menu: { nombre: "Menú", color: "#a855f7", icono: "bi-calendar-week" },
  evaluacion: { nombre: "Evaluación", color: "#14b8a6", icono: "bi-clipboard2-heart" },
  recordatorio: { nombre: "Recordatorio 24 h", color: "#eab308", icono: "bi-clock-history" },
  habitos: { nombre: "Estilo de vida", color: "#f59e0b", icono: "bi-person-walking" },
  recomendaciones: { nombre: "Recomendaciones", color: "#64748b", icono: "bi-chat-heart" },
};
const RECORDATORIO = [["desayuno", "Desayuno"], ["merienda_am", "Merienda AM"], ["almuerzo", "Almuerzo"], ["merienda_pm", "Merienda PM"], ["cena", "Cena"], ["otros", "Entre comidas"]];

const hay = (v) => v !== null && v !== undefined && String(v).trim() !== "" && !(Array.isArray(v) && !v.length);
const partes = (f) => { const [y, m, d] = String(f).split("-").map(Number); return { y, m, d }; };
const fechaLarga = (f) => { const { y, m, d } = partes(f); return `${d} de ${MESES_LARGO[m - 1]} de ${y}`; };

/** Qué secciones tiene una visita (para las etiquetas de colores y las tarjetas) */
function seccionesDe(v) {
  const md = v.medidas || {}, ev = v.evaluacion || {}, pl = v.plan || {}, rq = v.requerimiento || {}, pg = v.pliegues || {};
  const s = new Set(["consulta"]);
  if (["peso", "talla", "cintura", "cadera", "brazo", "muslo", "pantorrilla", "peso_meta"].some((k) => hay(md[k]))) s.add("medidas");
  if (["pct_grasa", "masa_muscular", "agua_pct", "grasa_visceral"].some((k) => hay(md[k])) || Object.values(pg).some(hay)) s.add("composicion");
  if (hay(rq.kcal_objetivo)) s.add("calorias");
  if (Object.values(pl.porciones || {}).some((t) => Object.values(t || {}).some((n) => Number(n) > 0))) s.add("plan");
  if (Object.values(pl.menu || {}).some((d) => Object.values(d || {}).some(hay))) s.add("menu");
  if (["objetivos", "motivo", "patologias", "intolerancias", "preferencias", "alergias", "no_le_gusta", "medicamentos", "notas"].some((k) => hay(ev[k]))) s.add("evaluacion");
  if (Object.values(ev.recordatorio || {}).some(hay)) s.add("recordatorio");
  if (Object.values(ev.habitos || {}).some(hay) || Object.values(ev.estilo || {}).some(hay) || Object.values(ev.frecuencia || {}).some(hay)) s.add("habitos");
  if (hay(pl.recomendaciones) || hay(pl.agua_vasos)) s.add("recomendaciones");
  return [...s];
}

function Fila({ label, valor, unidad, extra }) {
  if (!hay(valor)) return null;
  return (
    <div className="d-flex justify-content-between gap-3 py-1" style={{ borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem" }}>
      <span style={{ color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span className="text-end" style={{ fontWeight: 700, color: "#0f172a", whiteSpace: "pre-line", minWidth: 0, overflowWrap: "anywhere" }}>
        {Array.isArray(valor) ? valor.join(", ") : valor}{unidad ? ` ${unidad}` : ""}{extra}
      </span>
    </div>
  );
}

function Tarjeta({ tipo, children, ancha }) {
  const s = SECCIONES[tipo];
  return <TarjetaHistorial color={s.color} icono={s.icono} nombre={s.nombre} ancha={ancha}>{children}</TarjetaHistorial>;
}

// Nombres cortos para que la tabla del plan quepa en la tarjeta
const TIEMPO_CORTO = { desayuno: "Des", merienda_am: "M.AM", almuerzo: "Alm", merienda_pm: "M.PM", cena: "Cena" };
const DIA_CORTO = { Lunes: "Lun", Martes: "Mar", "Miércoles": "Mié", Jueves: "Jue", Viernes: "Vie", "Sábado": "Sáb", Domingo: "Dom" };

/** Plan en tabla: grupo de alimento × tiempo de comida, con el total del día */
function TablaPlan({ porciones, grupos, tiempos }) {
  const n = (t, g) => Number(porciones?.[t]?.[g]) || 0;
  const tiemposUsados = tiempos.filter((t) => grupos.some((g) => n(t.clave, g.clave) > 0));
  const gruposUsados = grupos.filter((g) => tiempos.some((t) => n(t.clave, g.clave) > 0));
  const celda = { padding: "4px 1px", textAlign: "center", borderBottom: "1px solid #f1f5f9" };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
        <thead>
          <tr style={{ color: "#64748b" }}>
            <th style={{ ...celda, textAlign: "left", fontWeight: 600 }}>Grupo</th>
            {tiemposUsados.map((t) => <th key={t.clave} title={t.nombre} style={{ ...celda, fontWeight: 600, whiteSpace: "nowrap" }}>{TIEMPO_CORTO[t.clave] || t.nombre}</th>)}
            <th style={{ ...celda, fontWeight: 700, color: "#0f172a" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {gruposUsados.map((g) => {
            const total = tiempos.reduce((s, t) => s + n(t.clave, g.clave), 0);
            return (
              <tr key={g.clave}>
                <td style={{ ...celda, textAlign: "left", whiteSpace: "nowrap" }} title={g.ejemplos?.join(" · ")}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: g.color, marginRight: 4 }} />
                  {g.nombre.split(/[ ,]/)[0]}
                </td>
                {tiemposUsados.map((t) => <td key={t.clave} style={{ ...celda, color: n(t.clave, g.clave) ? "#0f172a" : "#cbd5e1" }}>{n(t.clave, g.clave) || "·"}</td>)}
                <td style={{ ...celda, fontWeight: 800 }}>{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Menú: botones de días y un solo día a la vez */
function MenuPorDia({ menu, tiempos }) {
  const dias = Object.keys(DIA_CORTO).filter((d) => Object.values(menu?.[d] || {}).some(hay));
  const [dia, setDia] = useState(dias[0]);
  const visto = dias.includes(dia) ? dia : dias[0];
  return (
    <div>
      <div className="d-flex flex-wrap gap-1 mb-2">
        {dias.map((d) => (
          <button key={d} type="button" onClick={() => setDia(d)}
            style={{
              borderRadius: 999, padding: "2px 9px", fontSize: "0.74rem", fontWeight: 700, cursor: "pointer",
              border: `1px solid ${visto === d ? "#a855f7" : "#e5e7eb"}`,
              background: visto === d ? "#a855f7" : "#fff", color: visto === d ? "#fff" : "#64748b",
            }}>
            {DIA_CORTO[d]}
          </button>
        ))}
      </div>
      {tiempos.filter((t) => hay(menu?.[visto]?.[t.clave])).map((t) => (
        <div key={t.clave} className="py-1" style={{ fontSize: "0.82rem", borderBottom: "1px solid #f1f5f9" }}>
          <span style={{ color: "#a855f7", fontWeight: 700 }}>{t.nombre}:</span> {menu[visto][t.clave]}
        </div>
      ))}
    </div>
  );
}

function Detalle({ v, grupos, tiempos, onAbrir, onPdf, bajando }) {
  const md = v.medidas || {}, ev = v.evaluacion || {}, pl = v.plan || {}, rq = v.requerimiento || {}, pg = v.pliegues || {};
  const secc = seccionesDe(v);
  const imcInfo = clasificarIMC(md.imc);
  const porciones = pl.porciones || {};
  const menu = pl.menu || {};
  const frecuentes = Object.entries(ev.frecuencia || {}).filter(([, f]) => hay(f));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
      <Tarjeta tipo="consulta">
        <Fila label="Fecha" valor={fechaLarga(v.fecha)} />
        <Fila label="Atendió" valor={v.medico} />
        <Fila label="Estado" valor={v.estado === "FIRMADA" ? "Firmada" : v.estado ? "Borrador" : null} />
        <div className="d-flex flex-wrap gap-2 mt-2">
          {v.historia_id && onAbrir && (
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onAbrir(v.historia_id)}>
              <i className="bi bi-box-arrow-up-right me-1" />Ver consulta completa
            </button>
          )}
          {secc.includes("plan") && v.historia_id && (
            <button type="button" className="btn btn-sm btn-outline-success" disabled={bajando} onClick={() => onPdf(v)}>
              {bajando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-file-earmark-pdf me-1" />}PDF del plan
            </button>
          )}
        </div>
      </Tarjeta>

      {secc.includes("medidas") && (
        <Tarjeta tipo="medidas">
          <Fila label="Peso" valor={md.peso} unidad="kg" />
          <Fila label="Talla" valor={md.talla} unidad="cm" />
          <Fila label="IMC" valor={md.imc} extra={imcInfo ? <span style={{ color: imcInfo.color, fontWeight: 600 }}> · {imcInfo.texto}</span> : null} />
          <Fila label="Peso meta" valor={md.peso_meta} unidad="kg" />
          <Fila label="Cintura" valor={md.cintura} unidad="cm" />
          <Fila label="Cadera" valor={md.cadera} unidad="cm" />
          <Fila label="Cintura/cadera" valor={md.icc} />
          <Fila label="Brazo" valor={md.brazo} unidad="cm" />
          <Fila label="Muslo" valor={md.muslo} unidad="cm" />
          <Fila label="Pantorrilla" valor={md.pantorrilla} unidad="cm" />
        </Tarjeta>
      )}

      {secc.includes("composicion") && (
        <Tarjeta tipo="composicion">
          <Fila label="Grasa" valor={md.pct_grasa} unidad="%" />
          <Fila label="Masa muscular" valor={md.masa_muscular} unidad="kg" />
          <Fila label="Agua corporal" valor={md.agua_pct} unidad="%" />
          <Fila label="Grasa visceral" valor={md.grasa_visceral} />
          {[["bicipital", "Pliegue bíceps"], ["tricipital", "Pliegue tríceps"], ["subescapular", "Pliegue subescapular"], ["suprailiaco", "Pliegue suprailíaco"], ["abdominal", "Pliegue abdominal"], ["muslo", "Pliegue muslo"]]
            .map(([k, l]) => <Fila key={k} label={l} valor={pg[k]} unidad="mm" />)}
        </Tarjeta>
      )}

      {secc.includes("calorias") && (
        <Tarjeta tipo="calorias">
          <Fila label="Calorías del plan" valor={rq.kcal_objetivo} unidad="kcal/día" />
          <Fila label="Fórmula" valor={FORMULAS.find((f) => f.clave === (rq.formula || "mifflin"))?.nombre} />
          <Fila label="Actividad" valor={ACTIVIDADES.find((a) => a.clave === rq.actividad)?.nombre?.split(" (")[0]} />
          <Fila label="Gasto en reposo" valor={rq.tmb} unidad="kcal" />
          <Fila label="Gasto total" valor={rq.get} unidad="kcal" />
          <Fila label="Carbohidratos" valor={hay(rq.cho_g) ? `${rq.cho_g} g (${rq.cho_pct}%)` : null} />
          <Fila label="Proteínas" valor={hay(rq.pro_g) ? `${rq.pro_g} g (${rq.pro_pct}%)` : null} />
          <Fila label="Grasas" valor={hay(rq.gra_g) ? `${rq.gra_g} g (${rq.gra_pct}%)` : null} />
        </Tarjeta>
      )}

      {secc.includes("plan") && (
        <Tarjeta tipo="plan">
          <TablaPlan porciones={porciones} grupos={grupos} tiempos={tiempos} />
        </Tarjeta>
      )}

      {secc.includes("menu") && (
        <Tarjeta tipo="menu">
          <MenuPorDia menu={menu} tiempos={tiempos} />
        </Tarjeta>
      )}

      {secc.includes("evaluacion") && (
        <Tarjeta tipo="evaluacion">
          <Fila label="Objetivos" valor={ev.objetivos} />
          <Fila label="Motivo" valor={ev.motivo} />
          <Fila label="Enfermedades" valor={ev.patologias} />
          <Fila label="Intolerancias" valor={ev.intolerancias} />
          <Fila label="Preferencias" valor={ev.preferencias} />
          <Fila label="Alergias" valor={ev.alergias} />
          <Fila label="No le gusta" valor={ev.no_le_gusta} />
          <Fila label="Medicamentos" valor={ev.medicamentos} />
          <Fila label="Notas" valor={ev.notas} />
        </Tarjeta>
      )}

      {secc.includes("recordatorio") && (
        <Tarjeta tipo="recordatorio">
          {RECORDATORIO.map(([k, l]) => <Fila key={k} label={l} valor={ev.recordatorio?.[k]} />)}
        </Tarjeta>
      )}

      {secc.includes("habitos") && (
        <Tarjeta tipo="habitos">
          <Fila label="Comidas al día" valor={ev.habitos?.comidas_dia} />
          <Fila label="Vasos de agua" valor={ev.habitos?.agua_vasos} />
          <Fila label="Come fuera" valor={ev.habitos?.come_fuera} />
          <Fila label="Quién cocina" valor={ev.habitos?.quien_cocina} />
          <Fila label="Horarios" valor={ev.habitos?.horarios} />
          <Fila label="Actividad física" valor={ACTIVIDADES.find((a) => a.clave === ev.estilo?.actividad)?.nombre?.split(" (")[0]} />
          <Fila label="Ejercicio" valor={ev.estilo?.ejercicio} />
          <Fila label="Sueño" valor={ev.estilo?.sueno} unidad="h" />
          <Fila label="Estrés" valor={ev.estilo?.estres} />
          <Fila label="Alcohol" valor={ev.estilo?.alcohol} />
          <Fila label="Fuma" valor={ev.estilo?.tabaco} />
          {frecuentes.length > 0 && (
            <div className="mt-2" style={{ fontSize: "0.8rem" }}>
              <div style={{ color: "#64748b" }} className="mb-1">Frecuencia de consumo</div>
              {frecuentes.map(([g, f]) => (
                <div key={g} className="d-flex justify-content-between gap-2">
                  <span>{g}</span>
                  <b style={{ color: /Diario|Varias/.test(f) ? "#dc2626" : "#0f172a" }}>{f}</b>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      )}

      {secc.includes("recomendaciones") && (
        <Tarjeta tipo="recomendaciones">
          <Fila label="Agua" valor={hay(pl.agua_vasos) ? `${pl.agua_vasos} vasos al día` : null} />
          {hay(pl.recomendaciones) && <div style={{ fontSize: "0.85rem", whiteSpace: "pre-line" }} className="mt-1">{pl.recomendaciones}</div>}
        </Tarjeta>
      )}
    </div>
  );
}

export default function HistorialNutricion({ pacienteId, excluirHistoriaId }) {
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState(null);
  const [catalogo, setCatalogo] = useState({ grupos: [], tiempos: [] });
  const [abiertas, setAbiertas] = useState(null); // Set de ids abiertos (null = solo la más reciente)
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [bajando, setBajando] = useState(null);
  const [montadas, setMontadas] = useState(() => new Set()); // visitas ya abiertas alguna vez
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pacienteId) return;
    api.get(`/nutricion/paciente/${pacienteId}/historial`).then((r) => setVisitas(r.data.data || [])).catch(() => setVisitas([]));
    api.get("/nutricion/equivalentes").then((r) => setCatalogo(r.data.data)).catch(() => {});
  }, [pacienteId]);

  const lista = useMemo(() => (visitas || [])
    .filter((v) => !excluirHistoriaId || v.historia_id !== Number(excluirHistoriaId))
    .filter((v) => (!desde || v.fecha >= desde) && (!hasta || v.fecha <= hasta)), [visitas, excluirHistoriaId, desde, hasta]);

  if (!visitas) return <div className="text-center py-4"><span className="spinner-border spinner-border-sm" /></div>;
  if (!visitas.length) {
    return (
      <div className="text-center text-muted py-5" style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <i className="bi bi-apple d-block mb-2" style={{ fontSize: 30, color: "#16a34a" }} />
        Este paciente aún no tiene consultas de nutrición.
      </div>
    );
  }

  const abiertasSet = abiertas ?? new Set(lista.length ? [lista[0].id] : []);
  const todasAbiertas = lista.length > 0 && lista.every((v) => abiertasSet.has(v.id));
  const alternar = (id) => {
    const n = new Set(abiertasSet);
    if (n.has(id)) n.delete(id); else n.add(id);
    setMontadas((m) => new Set([...m, ...abiertasSet, id])); // el contenido sigue mientras se cierra
    setAbiertas(n);
  };
  const abrirConsulta = (hid) => navigate(`/consulta-medica?historia_id=${hid}`);

  const descargarPdf = async (v) => {
    setBajando(v.id); setError("");
    try {
      const r = await api.get(`/nutricion/historia/${v.historia_id}/pdf`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      const nombre = `plan_alimentacion_${v.fecha}.pdf`;
      if (!(await compartirEnTelefono(blob, nombre))) descargarBlob(blob, nombre);
    } catch (e) {
      const info = await errorDeBlob(e);
      if (info.imprimible) {
        try {
          const h = await api.get(`/nutricion/historia/${v.historia_id}/pdf`, { params: { formato: "html" }, responseType: "text" });
          imprimirHtml(h.data);
          return;
        } catch { /* sigue al mensaje de error */ }
      }
      setError(info.msg || "No se pudo generar el PDF del plan.");
    } finally {
      setBajando(null);
    }
  };

  // Para comparar cada visita con la anterior (la lista viene de la más reciente a la más antigua)
  const anteriorDe = (i) => lista.slice(i + 1).find((x) => hay(x.medidas?.peso));

  return (
    <div>
      <style>{`
        .hn-desplegable { display: grid; transition: grid-template-rows .35s ease, opacity .3s ease; }
        @media (prefers-reduced-motion: reduce) { .hn-desplegable { transition: none; } }
      `}</style>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div style={{ fontSize: "0.92rem" }}>
          <b>{lista.length} {lista.length === 1 ? "visita" : "visitas"}</b>
          {lista.length > 0 && <span className="text-muted"> · de {fechaLarga(lista[lista.length - 1].fecha)} a {fechaLarga(lista[0].fecha)}</span>}
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 ms-auto">
          <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
          <span className="text-muted">—</span>
          <input type="date" className="form-control form-control-sm" style={{ width: 150 }} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
          <button type="button" className="btn btn-sm btn-link fw-semibold text-decoration-none"
            onClick={() => { setMontadas(new Set(lista.map((v) => v.id))); setAbiertas(todasAbiertas ? new Set() : new Set(lista.map((v) => v.id))); }}>
            {todasAbiertas ? "Contraer todo" : "Expandir todo"}
          </button>
        </div>
      </div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div style={{ position: "relative", paddingLeft: 22 }}>
        <div style={{ position: "absolute", left: 6, top: 8, bottom: 8, width: 2, background: "#e0e7ff" }} />
        {lista.map((v, i) => {
          const abierta = abiertasSet.has(v.id);
          const { y, m, d } = partes(v.fecha);
          const md = v.medidas || {};
          const secc = seccionesDe(v).filter((s) => s !== "consulta");
          const prev = anteriorDe(i);
          const dPeso = hay(md.peso) && prev ? Math.round((md.peso - prev.medidas.peso) * 10) / 10 : null;
          const resumen = [
            hay(md.peso) && `${md.peso} kg`, hay(md.imc) && `IMC ${md.imc}`, hay(md.cintura) && `Cintura ${md.cintura} cm`,
            hay(md.pct_grasa) && `Grasa ${md.pct_grasa}%`, hay(v.requerimiento?.kcal_objetivo) && `${v.requerimiento.kcal_objetivo} kcal`,
          ].filter(Boolean);
          return (
            <div key={v.id} style={{ position: "relative", marginBottom: 12 }}>
              <span style={{
                position: "absolute", left: -21, top: 22, width: 12, height: 12, borderRadius: "50%",
                background: abierta ? "#6366f1" : "#fff", border: "2px solid #6366f1",
              }} />
              <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${abierta ? "#a5b4fc" : "#e5e7eb"}`, boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
                <button type="button" onClick={() => alternar(v.id)} className="w-100 text-start d-flex align-items-center gap-3"
                  style={{ background: "none", border: "none", padding: "12px 16px", cursor: "pointer" }}>
                  <div className="text-center" style={{ minWidth: 52 }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1, color: "#0f172a" }}>{String(d).padStart(2, "0")}</div>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6366f1" }}>{MESES[m - 1]} {y}</div>
                  </div>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="d-flex flex-wrap gap-1">
                      {secc.map((s) => (
                        <span key={s} style={{ fontSize: "0.72rem", fontWeight: 700, borderRadius: 999, padding: "1px 9px", background: `${SECCIONES[s].color}1f`, color: SECCIONES[s].color }}>
                          {SECCIONES[s].nombre}
                        </span>
                      ))}
                      {v.estado && v.estado !== "FIRMADA" && <span className="badge bg-warning-subtle text-warning-emphasis">Borrador</span>}
                    </div>
                    {(resumen.length > 0 || dPeso) && (
                      <div className="mt-1" style={{ fontSize: "0.82rem", color: "#475569" }}>
                        {resumen.join(" · ")}
                        {dPeso ? <b style={{ color: dPeso < 0 ? "#16a34a" : "#dc2626", marginLeft: 8 }}>{dPeso > 0 ? "▲ +" : "▼ "}{dPeso} kg</b> : null}
                      </div>
                    )}
                    {v.medico && <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{v.medico}</div>}
                  </div>
                  <i className="bi bi-chevron-down" style={{ color: "#64748b", transition: "transform .35s ease", transform: abierta ? "rotate(180deg)" : "none" }} />
                </button>
                {/* Abre y cierra deslizándose (la fila de la cuadrícula pasa de 0 a su alto real) */}
                <div className="hn-desplegable" style={{ gridTemplateRows: abierta ? "1fr" : "0fr", opacity: abierta ? 1 : 0 }} aria-hidden={!abierta}>
                  <div style={{ overflow: "hidden", minHeight: 0 }}>
                    {(abierta || montadas.has(v.id)) && (
                      <div style={{ padding: "16px", borderTop: "1px solid #eef2ff" }}>
                        <Detalle v={v} grupos={catalogo.grupos} tiempos={catalogo.tiempos} onAbrir={abrirConsulta} onPdf={descargarPdf} bajando={bajando === v.id} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!lista.length && <div className="text-muted small py-3">No hay visitas en esas fechas.</div>}
      </div>
    </div>
  );
}
