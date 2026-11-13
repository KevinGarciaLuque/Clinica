import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import api from "../../api/api";
import HistorialNutricion from "../../components/HistorialNutricion";
import { hoyClinica } from "../../utils/zonaClinica";
import {
  ACTIVIDADES, AJUSTES, FORMULAS, num, redondear, tasaMetabolica, macrosEnGramos,
  clasificarIMC, riesgoCintura, riesgoICC, grasaPorPliegues, totalesPlan, adecuacion,
} from "../../utils/nutricion";

// ══════════════════════════════════════════════════════════════════════
// TAB: NUTRICIÓN — evaluación, medidas, calorías, plan de alimentación y evolución
// ══════════════════════════════════════════════════════════════════════

const VERDE = "#16a34a";
const SECCIONES = [
  { id: "evaluacion", icono: "bi-clipboard2-heart", nombre: "Evaluación" },
  { id: "medidas", icono: "bi-rulers", nombre: "Medidas" },
  { id: "calorias", icono: "bi-fire", nombre: "Calorías" },
  { id: "plan", icono: "bi-egg-fried", nombre: "Plan de alimentación" },
  { id: "evolucion", icono: "bi-graph-up-arrow", nombre: "Evolución" },
  { id: "historial", icono: "bi-clock-history", nombre: "Historial" },
];

const OBJETIVOS = ["Bajar de peso", "Ganar masa muscular", "Mantener peso", "Controlar diabetes", "Controlar presión o colesterol",
  "Embarazo o lactancia", "Rendimiento deportivo", "Mejorar digestión", "Comer más saludable", "Crecimiento adecuado (niños)"];
const PATOLOGIAS = ["Diabetes", "Prediabetes", "Hipertensión", "Colesterol / triglicéridos altos", "Hígado graso", "Hipotiroidismo",
  "Ovario poliquístico", "Enfermedad renal", "Gastritis / reflujo", "Colon irritable", "Anemia"];
const INTOLERANCIAS = ["Lactosa", "Gluten", "Fructosa", "Huevo", "Mariscos", "Maní"];
const PREFERENCIAS = ["Vegetariano", "Vegano", "Sin cerdo", "Sin mariscos", "Sin azúcar añadida"];
const RECORDATORIO = [
  ["desayuno", "Desayuno"], ["merienda_am", "Merienda de la mañana"], ["almuerzo", "Almuerzo"],
  ["merienda_pm", "Merienda de la tarde"], ["cena", "Cena"], ["otros", "Entre comidas / noche"],
];
const FREC_GRUPOS = ["Frutas", "Verduras", "Lácteos", "Carnes rojas", "Pollo o pescado", "Huevos", "Frijoles", "Tortilla, pan o arroz",
  "Frituras", "Comida rápida", "Refrescos o jugos con azúcar", "Café", "Dulces y postres", "Embutidos", "Churros / snacks de bolsa"];
const FREC_OPCIONES = ["Nunca", "1–2 por semana", "3–5 por semana", "Diario", "Varias veces al día"];
const SI_NO = ["No", "Ocasional", "Frecuente"];

const MEDIDAS_EVOL = [
  { clave: "peso", nombre: "Peso", unidad: "kg", color: VERDE },
  { clave: "imc", nombre: "IMC", unidad: "kg/m²", color: "#0ea5e9" },
  { clave: "cintura", nombre: "Cintura", unidad: "cm", color: "#f97316" },
  { clave: "cadera", nombre: "Cadera", unidad: "cm", color: "#a855f7" },
  { clave: "pct_grasa", nombre: "% de grasa", unidad: "%", color: "#ef4444" },
  { clave: "masa_muscular", nombre: "Masa muscular", unidad: "kg", color: "#2563eb" },
  { clave: "icc", nombre: "Cintura/cadera", unidad: "", color: "#64748b" },
];

// ── piezas de interfaz ────────────────────────────────────────────────
function Tarjeta({ icono, titulo, children, extra }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,.05)", marginBottom: 14 }}>
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,#22c55e,${VERDE})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className={`bi ${icono}`} style={{ color: "#fff", fontSize: "0.8rem" }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#111827" }}>{titulo}</span>
        {extra && <div className="ms-auto">{extra}</div>}
      </div>
      {children}
    </div>
  );
}

function Chips({ opciones, valor = [], onChange, disabled }) {
  const sel = new Set(valor);
  return (
    <div className="d-flex flex-wrap gap-2">
      {opciones.map((o) => {
        const activo = sel.has(o);
        return (
          <button key={o} type="button" disabled={disabled}
            onClick={() => { const n = new Set(sel); if (activo) n.delete(o); else n.add(o); onChange([...n]); }}
            style={{
              borderRadius: 999, padding: "4px 12px", fontSize: "0.8rem", fontWeight: 600,
              border: `1px solid ${activo ? VERDE : "#d1d5db"}`, background: activo ? "#dcfce7" : "#fff",
              color: activo ? "#14532d" : "#4b5563", cursor: disabled ? "default" : "pointer",
            }}>
            {activo && <i className="bi bi-check2 me-1" />}{o}
          </button>
        );
      })}
    </div>
  );
}

function Campo({ label, unidad, value, onChange, disabled, delta, extra, placeholder, step = "0.1" }) {
  return (
    <div>
      <label className="form-label small fw-semibold mb-1" style={{ color: "#374151" }}>
        {label}{unidad && <span className="text-muted fw-normal"> ({unidad})</span>}
      </label>
      <input type="number" inputMode="decimal" step={step} min="0" className="form-control form-control-sm"
        value={value ?? ""} placeholder={placeholder} disabled={disabled}
        onChange={(e) => onChange(e.target.value)} />
      {(delta || extra) && <div className="d-flex flex-wrap gap-2 mt-1" style={{ fontSize: "0.74rem" }}>{delta}{extra}</div>}
    </div>
  );
}

function Etiqueta({ info }) {
  if (!info) return null;
  return <span style={{ color: info.color, fontWeight: 700 }}>● {info.texto}</span>;
}

function Delta({ actual, previo, unidad, fecha, menosEsMejor = true }) {
  const a = num(actual), p = num(previo);
  if (a === null || p === null) return null;
  const d = redondear(a - p, 1);
  if (!d) return <span className="text-muted">= igual que el {fecha}</span>;
  const bueno = menosEsMejor ? d < 0 : d > 0;
  return (
    <span style={{ color: bueno ? VERDE : "#dc2626", fontWeight: 600 }}>
      {d > 0 ? "▲ +" : "▼ "}{d} {unidad} <span className="text-muted fw-normal">desde el {fecha}</span>
    </span>
  );
}

const fechaCorta = (f) => (f ? dayjs(f).format("DD/MM/YY") : "");
function edadEnAnios(fnac) {
  if (!fnac) return null;
  const n = dayjs(String(fnac).slice(0, 10));
  return n.isValid() ? dayjs(hoyClinica()).diff(n, "year") : null;
}

// ══════════════════════════════════════════════════════════════════════
export default function NutricionTab({ datos, setDatos, vitals, setVitals, paciente, pacienteId, historiaId, anterior, firmada, onPdf, generandoPdf }) {
  const [seccion, setSeccion] = useState("evaluacion");
  const [catalogo, setCatalogo] = useState({ grupos: [], tiempos: [], dias: [] });
  const [sexo, setSexo] = useState(paciente?.sexo || null);
  const [evolucion, setEvolucion] = useState([]);
  const [pesoCasa, setPesoCasa] = useState([]); // lo que el paciente anota en el portal
  const [plantillas, setPlantillas] = useState([]);
  const [diaMenu, setDiaMenu] = useState("Lunes");
  const [medidaEvol, setMedidaEvol] = useState("peso");
  const [aviso, setAviso] = useState("");

  const ro = !!firmada;
  const edad = edadEnAnios(paciente?.fecha_nacimiento);
  const esMenor = edad !== null && edad < 18;

  useEffect(() => {
    api.get("/nutricion/equivalentes").then((r) => setCatalogo(r.data.data)).catch(() => {});
    api.get("/nutricion/plantillas").then((r) => setPlantillas(r.data.data || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!pacienteId) return;
    if (!paciente?.sexo) api.get(`/pacientes/${pacienteId}`).then((r) => setSexo(r.data.data?.sexo || null)).catch(() => {});
    api.get(`/nutricion/paciente/${pacienteId}/evolucion`).then((r) => { setEvolucion(r.data.data || []); setPesoCasa(r.data.casa || []); }).catch(() => {});
  }, [pacienteId, paciente?.sexo]);

  const ev = datos.evaluacion || {};
  const md = datos.medidas || {};
  const pl = datos.pliegues || {};
  const rq = datos.requerimiento || {};
  const plan = datos.plan || {};
  const previas = anterior?.ultima?.medidas || {};
  const fechaPrev = anterior?.ultima ? fechaCorta(anterior.ultima.fecha) : "";

  const setEv = (k, v) => setDatos((d) => ({ ...d, evaluacion: { ...(d.evaluacion || {}), [k]: v } }));
  const setEvSub = (grupo, k, v) => setDatos((d) => ({ ...d, evaluacion: { ...(d.evaluacion || {}), [grupo]: { ...(d.evaluacion?.[grupo] || {}), [k]: v } } }));
  const setMd = (k, v) => setDatos((d) => ({ ...d, medidas: { ...(d.medidas || {}), [k]: v } }));
  const setPl = (k, v) => setDatos((d) => ({ ...d, pliegues: { ...(d.pliegues || {}), [k]: v } }));
  const setRq = (cambios) => setDatos((d) => ({ ...d, requerimiento: { ...(d.requerimiento || {}), ...cambios } }));
  const setPlan = (cambios) => setDatos((d) => ({ ...d, plan: { ...(d.plan || {}), ...cambios } }));

  // Peso y talla se comparten con Signos vitales
  const peso = num(vitals.peso), talla = num(vitals.talla);
  const imc = num(vitals.imc);
  const icc = num(md.cintura) && num(md.cadera) ? redondear(num(md.cintura) / num(md.cadera), 3) : null;
  const ict = num(md.cintura) && talla ? redondear(num(md.cintura) / talla, 2) : null;

  // ── Calorías ──
  const formula = rq.formula || "mifflin";
  const pesoCalculo = num(rq.peso_calculo) ?? peso;
  // Si no se eligió, se toman de la evaluación: nivel de actividad y objetivo del paciente
  const actividad = rq.actividad || ev.estilo?.actividad || "ligera";
  const factor = ACTIVIDADES.find((a) => a.clave === actividad)?.factor || 1.375;
  const objetivos = ev.objetivos || [];
  const ajustePorObjetivo = objetivos.includes("Bajar de peso") ? -500
    : objetivos.includes("Ganar masa muscular") ? 250 : 0;
  const ajuste = num(rq.ajuste) ?? ajustePorObjetivo;
  const tmb = formula === "manual" ? null : tasaMetabolica(formula, { sexo, peso: pesoCalculo, talla, edad });
  const get = tmb ? tmb * factor : null;
  const kcalSugeridas = get ? Math.round((get + ajuste) / 10) * 10 : null;
  const kcalObjetivo = num(rq.kcal_manual) ?? kcalSugeridas;
  const pcts = { cho_pct: rq.cho_pct ?? 50, pro_pct: rq.pro_pct ?? 20, gra_pct: rq.gra_pct ?? 30 };
  const sumaPct = (num(pcts.cho_pct) || 0) + (num(pcts.pro_pct) || 0) + (num(pcts.gra_pct) || 0);
  const gramos = macrosEnGramos(kcalObjetivo, pcts);

  // Guarda en "requerimiento" el resultado ya calculado (lo usan el PDF y el portal)
  const tmbR = tmb ? Math.round(tmb) : null;
  const getR = get ? Math.round(get) : null;
  useEffect(() => {
    if (ro) return;
    const calculado = {
      tmb: tmbR, get: getR, kcal_objetivo: kcalObjetivo,
      cho_pct: pcts.cho_pct, pro_pct: pcts.pro_pct, gra_pct: pcts.gra_pct,
      cho_g: gramos.cho_g, pro_g: gramos.pro_g, gra_g: gramos.gra_g,
    };
    setDatos((d) => {
      const r = d.requerimiento || {};
      const cambia = Object.keys(calculado).some((k) => r[k] !== calculado[k]);
      return cambia ? { ...d, requerimiento: { ...r, ...calculado } } : d;
    });
  }, [ro, setDatos, tmbR, getR, kcalObjetivo, pcts.cho_pct, pcts.pro_pct, pcts.gra_pct, gramos.cho_g, gramos.pro_g, gramos.gra_g]);

  // ── Plan ──
  const { grupos, tiempos, dias } = catalogo;
  const porciones = plan.porciones || {};
  const totales = totalesPlan(porciones, grupos, tiempos);
  const setPorcion = (tiempo, grupo, valor) => setPlan({ porciones: { ...porciones, [tiempo]: { ...(porciones[tiempo] || {}), [grupo]: valor } } });
  const menu = plan.menu || {};
  const setMenu = (dia, tiempo, valor) => setPlan({ menu: { ...menu, [dia]: { ...(menu[dia] || {}), [tiempo]: valor } } });

  const aplicarPlantilla = (id) => {
    const p = plantillas.find((x) => String(x.id) === String(id));
    if (!p) return;
    if (Object.keys(porciones).length && !window.confirm(`¿Reemplazar el plan actual por la plantilla «${p.nombre}»?`)) return;
    setDatos((d) => ({
      ...d,
      plan: { ...(p.plan || {}) },
      requerimiento: { ...(d.requerimiento || {}), cho_pct: p.requerimiento?.cho_pct ?? 50, pro_pct: p.requerimiento?.pro_pct ?? 20, gra_pct: p.requerimiento?.gra_pct ?? 30, ...(p.requerimiento?.kcal_objetivo ? { kcal_manual: p.requerimiento.kcal_objetivo } : {}) },
    }));
    setAviso(`Se aplicó la plantilla «${p.nombre}». Puede ajustarla para este paciente.`);
  };
  const guardarPlantilla = async () => {
    const nombre = window.prompt("Nombre de la plantilla (ej. Plan 1500 kcal diabético):", kcalObjetivo ? `Plan ${kcalObjetivo} kcal` : "");
    if (!nombre?.trim()) return;
    try {
      await api.post("/nutricion/plantillas", { nombre, requerimiento: { kcal_objetivo: kcalObjetivo, ...pcts }, plan });
      const r = await api.get("/nutricion/plantillas");
      setPlantillas(r.data.data || []);
      setAviso(`Plantilla «${nombre.trim()}» guardada. La puede usar con cualquier paciente.`);
    } catch (e) {
      setAviso(e.response?.data?.msg || "No se pudo guardar la plantilla.");
    }
  };
  const borrarPlantilla = async (id) => {
    const p = plantillas.find((x) => String(x.id) === String(id));
    if (!p || !window.confirm(`¿Eliminar la plantilla «${p.nombre}»?`)) return;
    await api.delete(`/nutricion/plantillas/${id}`).catch(() => {});
    setPlantillas((l) => l.filter((x) => x.id !== p.id));
  };

  // ── Evolución: lo guardado + lo que se está escribiendo en esta consulta ──
  const puntos = (() => {
    const hoy = { actual: true, fecha: hoyClinica(), historia_id: historiaId, peso, imc, icc, ...Object.fromEntries(MEDIDAS_EVOL.filter((m) => !["peso", "imc", "icc"].includes(m.clave)).map((m) => [m.clave, num(md[m.clave])])) };
    const lista = evolucion.filter((e) => !historiaId || e.historia_id !== historiaId);
    const conHoy = MEDIDAS_EVOL.some((m) => hoy[m.clave] !== null && hoy[m.clave] !== undefined) ? [...lista, hoy] : lista;
    return conHoy.map((p) => ({ ...p, etiqueta: fechaCorta(p.fecha) }));
  })();
  const pesoMeta = num(md.peso_meta);
  const conPeso = puntos.filter((p) => p.peso);
  const pesoInicial = conPeso[0]?.peso ?? null;
  const pesoActual = conPeso[conPeso.length - 1]?.peso ?? null;
  const progreso = pesoInicial && pesoActual && pesoMeta && pesoInicial !== pesoMeta
    ? Math.max(0, Math.min(100, Math.round(((pesoInicial - pesoActual) / (pesoInicial - pesoMeta)) * 100)))
    : null;

  const grasaCalculada = grasaPorPliegues(pl, sexo, edad);

  return (
    <div>
      {/* Sub-secciones */}
      <div className="d-flex gap-2 mb-3" style={{ overflowX: "auto", paddingBottom: 2 }}>
        {SECCIONES.map((s) => (
          <button key={s.id} type="button" onClick={() => setSeccion(s.id)}
            style={{
              whiteSpace: "nowrap", borderRadius: 10, padding: "7px 14px", fontSize: "0.84rem", fontWeight: 700,
              border: `1px solid ${seccion === s.id ? VERDE : "#e5e7eb"}`,
              background: seccion === s.id ? VERDE : "#fff", color: seccion === s.id ? "#fff" : "#374151", cursor: "pointer",
            }}>
            <i className={`bi ${s.icono} me-1`} />{s.nombre}
          </button>
        ))}
      </div>

      {aviso && (
        <div className="alert alert-success py-2 small d-flex align-items-center gap-2">
          <i className="bi bi-info-circle" /><span className="flex-grow-1">{aviso}</span>
          <button type="button" className="btn-close btn-sm" onClick={() => setAviso("")} />
        </div>
      )}
      {anterior?.copiado && !ro && (
        <div className="alert alert-info py-2 small mb-3">
          <i className="bi bi-arrow-repeat me-1" />Se copiaron la evaluación y el plan de la consulta del {fechaCorta(anterior.copiado)}. Actualice solo lo que cambió.
        </div>
      )}

      {/* ═══ EVALUACIÓN ═══ */}
      {seccion === "evaluacion" && (
        <>
          <Tarjeta icono="bi-bullseye" titulo="Objetivo del paciente">
            <Chips opciones={OBJETIVOS} valor={ev.objetivos} onChange={(v) => setEv("objetivos", v)} disabled={ro} />
            <textarea className="form-control form-control-sm mt-2" rows={2} disabled={ro} placeholder="Motivo de consulta y lo que espera lograr"
              value={ev.motivo || ""} onChange={(e) => setEv("motivo", e.target.value)} />
          </Tarjeta>

          <Tarjeta icono="bi-clock-history" titulo="Recordatorio de 24 horas (lo que comió ayer)">
            <div className="row g-2">
              {RECORDATORIO.map(([k, nombre]) => (
                <div className="col-12 col-md-6" key={k}>
                  <label className="form-label small fw-semibold mb-1">{nombre}</label>
                  <textarea className="form-control form-control-sm" rows={2} disabled={ro}
                    placeholder={k === "desayuno" ? "Ej: 2 tortillas, frijoles, 1 huevo frito, café con 2 cdas de azúcar" : ""}
                    value={ev.recordatorio?.[k] || ""} onChange={(e) => setEvSub("recordatorio", k, e.target.value)} />
                </div>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta icono="bi-bar-chart-steps" titulo="¿Con qué frecuencia come…?">
            <div className="row g-2">
              {FREC_GRUPOS.map((g) => (
                <div className="col-12 col-sm-6 col-lg-4" key={g}>
                  <div className="d-flex align-items-center gap-2">
                    <span className="small flex-grow-1" style={{ minWidth: 0 }}>{g}</span>
                    <select className="form-select form-select-sm" style={{ width: 150, flexShrink: 0 }} disabled={ro}
                      value={ev.frecuencia?.[g] || ""} onChange={(e) => setEvSub("frecuencia", g, e.target.value)}>
                      <option value="">—</option>
                      {FREC_OPCIONES.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta icono="bi-cup-hot" titulo="Hábitos">
            <div className="row g-2">
              <div className="col-6 col-md-3"><Campo label="Comidas al día" step="1" value={ev.habitos?.comidas_dia} disabled={ro} onChange={(v) => setEvSub("habitos", "comidas_dia", v)} /></div>
              <div className="col-6 col-md-3"><Campo label="Vasos de agua al día" step="1" value={ev.habitos?.agua_vasos} disabled={ro} onChange={(v) => setEvSub("habitos", "agua_vasos", v)} /></div>
              <div className="col-12 col-md-3">
                <label className="form-label small fw-semibold mb-1">Come fuera de casa</label>
                <select className="form-select form-select-sm" disabled={ro} value={ev.habitos?.come_fuera || ""} onChange={(e) => setEvSub("habitos", "come_fuera", e.target.value)}>
                  <option value="">—</option>{FREC_OPCIONES.slice(0, 4).map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small fw-semibold mb-1">¿Quién cocina?</label>
                <input className="form-control form-control-sm" disabled={ro} value={ev.habitos?.quien_cocina || ""} onChange={(e) => setEvSub("habitos", "quien_cocina", e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label small fw-semibold mb-1">Horarios de comida y lugares</label>
                <input className="form-control form-control-sm" disabled={ro} placeholder="Ej: desayuna 6 a. m. en casa, almuerza en el trabajo, cena tarde"
                  value={ev.habitos?.horarios || ""} onChange={(e) => setEvSub("habitos", "horarios", e.target.value)} />
              </div>
            </div>
          </Tarjeta>

          <Tarjeta icono="bi-person-walking" titulo="Estilo de vida">
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold mb-1">Actividad física</label>
                <select className="form-select form-select-sm" disabled={ro} value={ev.estilo?.actividad || ""} onChange={(e) => setEvSub("estilo", "actividad", e.target.value)}>
                  <option value="">—</option>{ACTIVIDADES.map((a) => <option key={a.clave} value={a.clave}>{a.nombre}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold mb-1">Tipo de ejercicio</label>
                <input className="form-control form-control-sm" disabled={ro} placeholder="Ej: caminar 30 min, gimnasio"
                  value={ev.estilo?.ejercicio || ""} onChange={(e) => setEvSub("estilo", "ejercicio", e.target.value)} />
              </div>
              <div className="col-6 col-md-3"><Campo label="Horas de sueño" step="0.5" value={ev.estilo?.sueno} disabled={ro} onChange={(v) => setEvSub("estilo", "sueno", v)} /></div>
              {[["estres", "Estrés", ["Bajo", "Medio", "Alto"]], ["alcohol", "Alcohol", SI_NO], ["tabaco", "Fuma", SI_NO]].map(([k, l, ops]) => (
                <div className="col-6 col-md-3" key={k}>
                  <label className="form-label small fw-semibold mb-1">{l}</label>
                  <select className="form-select form-select-sm" disabled={ro} value={ev.estilo?.[k] || ""} onChange={(e) => setEvSub("estilo", k, e.target.value)}>
                    <option value="">—</option>{ops.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta icono="bi-shield-exclamation" titulo="Salud, alergias y preferencias">
            <label className="form-label small fw-semibold mb-1">Enfermedades relacionadas</label>
            <Chips opciones={PATOLOGIAS} valor={ev.patologias} onChange={(v) => setEv("patologias", v)} disabled={ro} />
            <label className="form-label small fw-semibold mb-1 mt-3">Intolerancias</label>
            <Chips opciones={INTOLERANCIAS} valor={ev.intolerancias} onChange={(v) => setEv("intolerancias", v)} disabled={ro} />
            <label className="form-label small fw-semibold mb-1 mt-3">Preferencias</label>
            <Chips opciones={PREFERENCIAS} valor={ev.preferencias} onChange={(v) => setEv("preferencias", v)} disabled={ro} />
            <div className="row g-2 mt-1">
              {[["alergias", "Alergias a alimentos"], ["no_le_gusta", "Alimentos que no le gustan"], ["medicamentos", "Medicamentos y suplementos"]].map(([k, l]) => (
                <div className="col-12 col-md-4" key={k}>
                  <label className="form-label small fw-semibold mb-1">{l}</label>
                  <input className="form-control form-control-sm" disabled={ro} value={ev[k] || ""} onChange={(e) => setEv(k, e.target.value)} />
                </div>
              ))}
            </div>
            <label className="form-label small fw-semibold mb-1 mt-3">Notas</label>
            <textarea className="form-control form-control-sm" rows={2} disabled={ro} value={ev.notas || ""} onChange={(e) => setEv("notas", e.target.value)} />
          </Tarjeta>
        </>
      )}

      {/* ═══ MEDIDAS ═══ */}
      {seccion === "medidas" && (
        <>
          {esMenor && (
            <div className="alert alert-warning py-2 small">
              <i className="bi bi-graph-up me-1" />Paciente menor de 18 años: para ver percentiles de la OMS active
              «Registrar curva de crecimiento» en <b>Signos vitales</b> (pestaña SOAP). Las clasificaciones de adulto no aplican.
            </div>
          )}
          <Tarjeta icono="bi-person-bounding-box" titulo="Peso y talla">
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <Campo label="Peso" unidad="kg" value={vitals.peso} disabled={ro} onChange={(v) => setVitals((x) => ({ ...x, peso: v }))}
                  delta={<Delta actual={peso} previo={previas.peso} unidad="kg" fecha={fechaPrev} />} />
              </div>
              <div className="col-6 col-md-3">
                <Campo label="Talla" unidad="cm" value={vitals.talla} disabled={ro} onChange={(v) => setVitals((x) => ({ ...x, talla: v }))} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small fw-semibold mb-1">IMC <span className="text-muted fw-normal">(automático)</span></label>
                <div className="form-control form-control-sm" style={{ background: "#f8fafc" }}>{imc || "—"}</div>
                {!esMenor && <div className="mt-1" style={{ fontSize: "0.74rem" }}><Etiqueta info={clasificarIMC(imc)} /></div>}
              </div>
              <div className="col-6 col-md-3">
                <Campo label="Peso meta" unidad="kg" value={md.peso_meta} disabled={ro} onChange={(v) => setMd("peso_meta", v)} />
              </div>
            </div>
            {progreso !== null && (
              <div className="mt-3">
                <div className="d-flex justify-content-between small mb-1">
                  <span>Avance hacia el peso meta</span>
                  <b style={{ color: VERDE }}>{progreso}%</b>
                </div>
                <div style={{ height: 10, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${progreso}%`, height: "100%", background: `linear-gradient(90deg,#4ade80,${VERDE})` }} />
                </div>
                <div className="text-muted mt-1" style={{ fontSize: "0.74rem" }}>
                  Empezó con {pesoInicial} kg · hoy {pesoActual} kg · meta {pesoMeta} kg
                </div>
              </div>
            )}
          </Tarjeta>

          <Tarjeta icono="bi-rulers" titulo="Circunferencias">
            <div className="row g-3">
              {[["cintura", "Cintura"], ["cadera", "Cadera"], ["brazo", "Brazo"], ["muslo", "Muslo"], ["pantorrilla", "Pantorrilla"]].map(([k, l]) => (
                <div className="col-6 col-md-4 col-lg" key={k}>
                  <Campo label={l} unidad="cm" value={md[k]} disabled={ro} onChange={(v) => setMd(k, v)}
                    delta={<Delta actual={md[k]} previo={previas[k]} unidad="cm" fecha={fechaPrev} menosEsMejor={!["brazo", "pantorrilla"].includes(k)} />}
                    extra={k === "cintura" && !esMenor ? <Etiqueta info={riesgoCintura(num(md.cintura), sexo)} /> : null} />
                </div>
              ))}
            </div>
            <div className="d-flex flex-wrap gap-4 mt-3 small">
              <span>Índice cintura/cadera: <b>{icc ?? "—"}</b> {!esMenor && <Etiqueta info={riesgoICC(icc, sexo)} />}</span>
              <span>Índice cintura/talla: <b>{ict ?? "—"}</b> {ict && <Etiqueta info={ict >= 0.5 ? { texto: "Riesgo", color: "#ef4444" } : { texto: "Normal", color: VERDE }} />}</span>
            </div>
          </Tarjeta>

          <Tarjeta icono="bi-speedometer2" titulo="Composición corporal (báscula de bioimpedancia o pliegues)">
            <div className="row g-3">
              <div className="col-6 col-md-3"><Campo label="% de grasa" unidad="%" value={md.pct_grasa} disabled={ro} onChange={(v) => setMd("pct_grasa", v)}
                delta={<Delta actual={md.pct_grasa} previo={previas.pct_grasa} unidad="%" fecha={fechaPrev} />} /></div>
              <div className="col-6 col-md-3"><Campo label="Masa muscular" unidad="kg" value={md.masa_muscular} disabled={ro} onChange={(v) => setMd("masa_muscular", v)}
                delta={<Delta actual={md.masa_muscular} previo={previas.masa_muscular} unidad="kg" fecha={fechaPrev} menosEsMejor={false} />} /></div>
              <div className="col-6 col-md-3"><Campo label="Agua corporal" unidad="%" value={md.agua_pct} disabled={ro} onChange={(v) => setMd("agua_pct", v)} /></div>
              <div className="col-6 col-md-3"><Campo label="Grasa visceral" unidad="nivel" step="0.5" value={md.grasa_visceral} disabled={ro} onChange={(v) => setMd("grasa_visceral", v)} /></div>
            </div>
            <div className="mt-3 pt-3" style={{ borderTop: "1px dashed #e5e7eb" }}>
              <div className="small fw-semibold mb-2">Pliegues cutáneos (mm)</div>
              <div className="row g-2">
                {[["bicipital", "Bíceps"], ["tricipital", "Tríceps"], ["subescapular", "Subescapular"], ["suprailiaco", "Suprailíaco"], ["abdominal", "Abdominal"], ["muslo", "Muslo"]].map(([k, l]) => (
                  <div className="col-4 col-md-2" key={k}><Campo label={l} value={pl[k]} disabled={ro} onChange={(v) => setPl(k, v)} /></div>
                ))}
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2 mt-2 small">
                {grasaCalculada !== null ? (
                  <>
                    <span>Con los 4 pliegues (Durnin-Womersley): <b>{grasaCalculada}% de grasa</b></span>
                    {!ro && <button type="button" className="btn btn-sm btn-outline-success py-0" onClick={() => setMd("pct_grasa", String(grasaCalculada))}>Usar este valor</button>}
                  </>
                ) : (
                  <span className="text-muted">Llene bíceps, tríceps, subescapular y suprailíaco para calcular el % de grasa (pacientes de 17 años o más).</span>
                )}
              </div>
            </div>
          </Tarjeta>
        </>
      )}

      {/* ═══ CALORÍAS ═══ */}
      {seccion === "calorias" && (
        <Tarjeta icono="bi-fire" titulo="Cálculo de calorías">
          {esMenor && (
            <div className="alert alert-warning py-2 small">
              En niños y adolescentes estas fórmulas no aplican: escriba las calorías a mano según la recomendación pediátrica.
            </div>
          )}
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold mb-1">Fórmula</label>
              <select className="form-select form-select-sm" disabled={ro} value={formula} onChange={(e) => setRq({ formula: e.target.value })}>
                {FORMULAS.map((f) => <option key={f.clave} value={f.clave}>{f.nombre}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold mb-1">Nivel de actividad</label>
              <select className="form-select form-select-sm" disabled={ro} value={actividad} onChange={(e) => setRq({ actividad: e.target.value })}>
                {ACTIVIDADES.map((a) => <option key={a.clave} value={a.clave}>{a.nombre} · ×{a.factor}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold mb-1">Objetivo</label>
              <select className="form-select form-select-sm" disabled={ro} value={ajuste} onChange={(e) => setRq({ ajuste: Number(e.target.value) })}>
                {AJUSTES.map((a) => <option key={a.valor} value={a.valor}>{a.nombre}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <Campo label="Peso para el cálculo" unidad="kg" value={rq.peso_calculo ?? ""} placeholder={peso ? String(peso) : "Peso actual"} disabled={ro}
                onChange={(v) => setRq({ peso_calculo: v })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold mb-1">Datos usados</label>
              <div className="form-control form-control-sm" style={{ background: "#f8fafc" }}>
                {sexo === "F" ? "Mujer" : sexo === "M" ? "Hombre" : "Sexo ?"} · {edad ?? "?"} años · {talla ?? "?"} cm
              </div>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold mb-1">Gasto en reposo</label>
              <div className="form-control form-control-sm" style={{ background: "#f8fafc" }}>{tmb ? `${Math.round(tmb)} kcal` : "—"}</div>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold mb-1">Gasto total del día</label>
              <div className="form-control form-control-sm" style={{ background: "#f8fafc" }}>{get ? `${Math.round(get)} kcal` : "—"}</div>
            </div>
          </div>
          {formula !== "manual" && (!sexo || edad === null || !talla || !pesoCalculo) && (
            <div className="small text-danger mt-2">Para calcular hace falta el sexo y la fecha de nacimiento del paciente, y su peso y talla.</div>
          )}

          <div className="mt-3 p-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12 }}>
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-4">
                <label className="form-label small fw-semibold mb-1">Calorías del plan (kcal/día)</label>
                <input type="number" className="form-control" style={{ fontSize: "1.3rem", fontWeight: 800, color: "#14532d" }} disabled={ro}
                  value={rq.kcal_manual ?? ""} placeholder={kcalSugeridas ? String(kcalSugeridas) : "Escriba las calorías"}
                  onChange={(e) => setRq({ kcal_manual: e.target.value === "" ? null : e.target.value })} />
                <div className="text-muted mt-1" style={{ fontSize: "0.74rem" }}>
                  {kcalSugeridas ? `Sugeridas: ${kcalSugeridas} kcal. Deje vacío para usar la sugerencia.` : "Escriba las calorías a mano."}
                </div>
              </div>
              {[["cho_pct", "Carbohidratos", "cho_g"], ["pro_pct", "Proteínas", "pro_g"], ["gra_pct", "Grasas", "gra_g"]].map(([k, l, g]) => (
                <div className="col-4 col-md-2" key={k}>
                  <label className="form-label small fw-semibold mb-1">{l} %</label>
                  <input type="number" className="form-control form-control-sm" disabled={ro} value={pcts[k]} onChange={(e) => setRq({ [k]: e.target.value })} />
                  <div className="small mt-1"><b>{gramos[g] ?? "—"} g</b></div>
                </div>
              ))}
              <div className="col-12 col-md-2 small">
                {sumaPct !== 100
                  ? <span className="text-danger fw-semibold">Los % suman {sumaPct}. Deben sumar 100.</span>
                  : gramos.pro_g && pesoCalculo ? <span>Proteína: <b>{redondear(gramos.pro_g / pesoCalculo, 1)} g/kg</b></span> : null}
              </div>
            </div>
          </div>
        </Tarjeta>
      )}

      {/* ═══ PLAN ═══ */}
      {seccion === "plan" && (
        <>
          <Tarjeta icono="bi-collection" titulo="Plantillas" extra={!ro && (
            <button type="button" className="btn btn-sm btn-outline-success" onClick={guardarPlantilla} disabled={!Object.keys(porciones).length}>
              <i className="bi bi-bookmark-plus me-1" />Guardar como plantilla
            </button>
          )}>
            {plantillas.length ? (
              <div className="d-flex flex-wrap gap-2">
                {plantillas.map((p) => (
                  <span key={p.id} className="d-inline-flex align-items-center" style={{ border: "1px solid #bbf7d0", borderRadius: 999, background: "#f0fdf4" }}>
                    <button type="button" disabled={ro} onClick={() => aplicarPlantilla(p.id)}
                      style={{ border: "none", background: "none", padding: "4px 6px 4px 12px", fontSize: "0.8rem", fontWeight: 600, color: "#14532d" }}>
                      <i className="bi bi-lightning-charge me-1" />{p.nombre}
                    </button>
                    {!ro && <button type="button" title="Eliminar plantilla" onClick={() => borrarPlantilla(p.id)}
                      style={{ border: "none", background: "none", padding: "4px 10px 4px 2px", color: "#9ca3af" }}><i className="bi bi-x" /></button>}
                  </span>
                ))}
              </div>
            ) : (
              <div className="small text-muted">Aún no hay plantillas. Arme un plan y toque «Guardar como plantilla» para reutilizarlo con otros pacientes.</div>
            )}
          </Tarjeta>

          <Tarjeta icono="bi-grid-3x3-gap" titulo="Porciones por tiempo de comida">
            <div style={{ overflowX: "auto" }}>
              <table className="table table-sm align-middle mb-0" style={{ minWidth: 640, fontSize: "0.82rem" }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 150 }}>Grupo</th>
                    {tiempos.map((t) => <th key={t.clave} className="text-center" style={{ minWidth: 78 }}>{t.nombre}</th>)}
                    <th className="text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => {
                    const total = tiempos.reduce((s, t) => s + (num(porciones?.[t.clave]?.[g.clave]) || 0), 0);
                    return (
                      <tr key={g.clave}>
                        <td title={g.ejemplos.join(" · ")}>
                          <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: g.color, marginRight: 6 }} />
                          {g.nombre}
                          <div className="text-muted" style={{ fontSize: "0.7rem" }}>{g.kcal} kcal · {g.ejemplos[0]}</div>
                        </td>
                        {tiempos.map((t) => (
                          <td key={t.clave}>
                            <input type="number" inputMode="decimal" min="0" step="0.5" className="form-control form-control-sm text-center px-1" disabled={ro}
                              value={porciones?.[t.clave]?.[g.clave] ?? ""} onChange={(e) => setPorcion(t.clave, g.clave, e.target.value)} />
                          </td>
                        ))}
                        <td className="text-center fw-bold">{total || ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="row g-2 mt-2">
              {[["kcal", "Calorías", kcalObjetivo, "kcal"], ["cho", "Carbohidratos", gramos.cho_g, "g"], ["pro", "Proteínas", gramos.pro_g, "g"], ["gra", "Grasas", gramos.gra_g, "g"]].map(([k, l, obj, u]) => {
                const a = adecuacion(totales[k], obj);
                return (
                  <div className="col-6 col-md-3" key={k}>
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 10px" }}>
                      <div className="text-muted" style={{ fontSize: "0.72rem" }}>{l}</div>
                      <div style={{ fontWeight: 800 }}>{totales[k]} <span className="text-muted fw-normal small">/ {obj ?? "—"} {u}</span></div>
                      {a && <div style={{ fontSize: "0.74rem", color: a.color, fontWeight: 700 }}>{a.pct}% del objetivo</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-muted mt-2" style={{ fontSize: "0.72rem" }}>
              Valores promedio por porción. Verde = entre 90 % y 110 % de lo calculado en «Calorías».
            </div>
          </Tarjeta>

          <Tarjeta icono="bi-calendar-week" titulo="Menú de ejemplo de la semana" extra={!ro && (
            <button type="button" className="btn btn-sm btn-outline-secondary"
              onClick={() => { if (window.confirm(`¿Copiar el menú del ${diaMenu} a todos los días?`)) setPlan({ menu: Object.fromEntries(dias.map((d) => [d, { ...(menu[diaMenu] || {}) }])) }); }}>
              <i className="bi bi-files me-1" />Copiar a toda la semana
            </button>
          )}>
            <div className="d-flex gap-1 mb-3" style={{ overflowX: "auto" }}>
              {dias.map((d) => {
                const lleno = tiempos.some((t) => String(menu?.[d]?.[t.clave] || "").trim());
                return (
                  <button key={d} type="button" onClick={() => setDiaMenu(d)}
                    style={{
                      whiteSpace: "nowrap", borderRadius: 8, padding: "5px 11px", fontSize: "0.8rem", fontWeight: 600,
                      border: `1px solid ${diaMenu === d ? VERDE : "#e5e7eb"}`, background: diaMenu === d ? "#dcfce7" : "#fff", color: "#14532d",
                    }}>
                    {d}{lleno && <i className="bi bi-check-circle-fill ms-1" style={{ color: VERDE }} />}
                  </button>
                );
              })}
            </div>
            <div className="row g-2">
              {tiempos.map((t) => (
                <div className="col-12 col-md-6" key={t.clave}>
                  <label className="form-label small fw-semibold mb-1">{t.nombre}</label>
                  <textarea className="form-control form-control-sm" rows={2} disabled={ro}
                    placeholder={t.clave === "desayuno" ? "Ej: 2 tortillas, 1 huevo revuelto, 1 taza de papaya" : t.clave === "almuerzo" ? "Ej: pollo a la plancha, 1/3 taza de arroz, frijoles y ensalada" : ""}
                    value={menu?.[diaMenu]?.[t.clave] || ""} onChange={(e) => setMenu(diaMenu, t.clave, e.target.value)} />
                </div>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta icono="bi-chat-heart" titulo="Recomendaciones para el paciente">
            <div className="row g-2">
              <div className="col-6 col-md-3"><Campo label="Vasos de agua al día" step="1" value={plan.agua_vasos} disabled={ro} onChange={(v) => setPlan({ agua_vasos: v })} /></div>
              <div className="col-12">
                <textarea className="form-control form-control-sm" rows={4} disabled={ro}
                  placeholder={"Ej: Evitar refrescos y jugos con azúcar.\nCaminar 30 minutos al día.\nPreferir comidas a la plancha o cocidas."}
                  value={plan.recomendaciones || ""} onChange={(e) => setPlan({ recomendaciones: e.target.value })} />
              </div>
            </div>
          </Tarjeta>

          <div className="d-flex flex-wrap gap-2 justify-content-end mb-2">
            <button type="button" className="btn btn-success" onClick={onPdf} disabled={generandoPdf || !Object.keys(porciones).length}>
              {generandoPdf ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-file-earmark-pdf me-2" />}
              PDF del plan para el paciente
            </button>
          </div>
        </>
      )}

      {/* ═══ HISTORIAL (consultas anteriores) ═══ */}
      {seccion === "historial" && <HistorialNutricion pacienteId={pacienteId} excluirHistoriaId={historiaId} />}

      {/* ═══ EVOLUCIÓN ═══ */}
      {seccion === "evolucion" && (
        <>
          {conPeso.length >= 1 && (
            <div className="row g-2 mb-3">
              {[
                ["Peso inicial", pesoInicial != null ? `${pesoInicial} kg` : "—", conPeso[0] ? fechaCorta(conPeso[0].fecha) : ""],
                ["Peso actual", pesoActual != null ? `${pesoActual} kg` : "—", conPeso.length ? fechaCorta(conPeso[conPeso.length - 1].fecha) : ""],
                ["Cambio total", pesoInicial != null && pesoActual != null ? `${redondear(pesoActual - pesoInicial, 1) > 0 ? "+" : ""}${redondear(pesoActual - pesoInicial, 1)} kg` : "—", `${puntos.length} consulta(s)`],
                ["Peso meta", pesoMeta ? `${pesoMeta} kg` : "Sin meta", progreso !== null ? `${progreso}% logrado` : ""],
              ].map(([l, v, s]) => (
                <div className="col-6 col-md-3" key={l}>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px" }}>
                    <div className="text-muted" style={{ fontSize: "0.72rem" }}>{l}</div>
                    <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{v}</div>
                    <div className="text-muted" style={{ fontSize: "0.72rem" }}>{s}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Tarjeta icono="bi-graph-up-arrow" titulo="Evolución de las medidas">
            <div className="d-flex flex-wrap gap-2 mb-3">
              {MEDIDAS_EVOL.map((m) => (
                <button key={m.clave} type="button" onClick={() => setMedidaEvol(m.clave)}
                  style={{
                    borderRadius: 999, padding: "4px 12px", fontSize: "0.8rem", fontWeight: 600,
                    border: `1px solid ${medidaEvol === m.clave ? m.color : "#d1d5db"}`,
                    background: medidaEvol === m.clave ? m.color : "#fff", color: medidaEvol === m.clave ? "#fff" : "#4b5563",
                  }}>{m.nombre}</button>
              ))}
            </div>
            {(() => {
              const m = MEDIDAS_EVOL.find((x) => x.clave === medidaEvol);
              let datosG = puntos.filter((p) => p[m.clave] !== null && p[m.clave] !== undefined);
              // En el peso se suman los registros que el paciente hizo en su casa (portal)
              if (m.clave === "peso" && pesoCasa.length) {
                datosG = [...datosG, ...pesoCasa.map((c) => ({ fecha: c.fecha, etiqueta: fechaCorta(c.fecha), peso_casa: c.peso }))]
                  .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
              }
              if (!datosG.length) return <div className="text-center text-muted small py-4">Todavía no hay datos de {m.nombre.toLowerCase()}. Se van sumando en cada consulta.</div>;
              const valores = datosG.map((p) => p[m.clave] ?? p.peso_casa).filter((v) => v != null).concat(m.clave === "peso" && pesoMeta ? [pesoMeta] : []);
              const min = Math.min(...valores), max = Math.max(...valores);
              const margen = Math.max((max - min) * 0.15, m.clave === "icc" ? 0.02 : 1);
              return (
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={datosG} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[redondear(min - margen, 2), redondear(max + margen, 2)]} />
                      <Tooltip formatter={(v, n) => [`${v} ${m.unidad}`, n === "peso_casa" ? "Peso en casa (portal)" : m.nombre]} />
                      {m.clave === "peso" && pesoMeta && <ReferenceLine y={pesoMeta} stroke={VERDE} strokeDasharray="6 4" label={{ value: `Meta ${pesoMeta} kg`, fontSize: 11, fill: VERDE, position: "insideTopRight" }} />}
                      <Line type="monotone" dataKey={m.clave} stroke={m.color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                      {m.clave === "peso" && pesoCasa.length > 0 && (
                        <Line type="monotone" dataKey="peso_casa" stroke="#94a3b8" strokeWidth={0} dot={{ r: 4, fill: "#94a3b8" }} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </Tarjeta>
          {puntos.length > 0 && (
            <Tarjeta icono="bi-table" titulo="Historial de medidas">
              <div style={{ overflowX: "auto" }}>
                <table className="table table-sm mb-0" style={{ fontSize: "0.8rem", minWidth: 520 }}>
                  <thead><tr><th>Fecha</th>{MEDIDAS_EVOL.map((m) => <th key={m.clave} className="text-center">{m.nombre}</th>)}</tr></thead>
                  <tbody>
                    {[...puntos].reverse().map((p, i) => (
                      <tr key={`${p.fecha}-${i}`}>
                        <td>{fechaCorta(p.fecha)}{p.actual && <span className="badge bg-success-subtle text-success ms-1">esta consulta</span>}</td>
                        {MEDIDAS_EVOL.map((m) => <td key={m.clave} className="text-center">{p[m.clave] ?? "—"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Tarjeta>
          )}
        </>
      )}
    </div>
  );
}
