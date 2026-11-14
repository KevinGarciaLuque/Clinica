import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { listarEstetica } from "../utils/esteticaDatos";
import { nombreZona } from "../utils/esteticaCatalogos";
import { paquetesDe } from "../utils/esteticaPaquetes";
import { ModalPresupuesto, ModalConsentimiento, ModalFichaRapida, ModalFotoRapida } from "./estetica/ModalesEstetica";
import ModalFirmarConsentimiento from "./estetica/ModalFirmarConsentimiento";
import ModalEnviarPaciente from "./estetica/ModalEnviarPaciente";
import { descargarBlob, compartirEnTelefono, imprimirHtml } from "../utils/descargarPdf";

/**
 * Pestaña «Estética» del perfil del paciente, pensada para el médico:
 * avisos importantes, resumen, antes/después con deslizador, línea de tiempo
 * y accesos rápidos. Ficha, presupuestos, consentimientos y controles vienen
 * del servidor (utils/esteticaDatos); fotos y biopsias de sus propias rutas.
 */

const ROSA = "#db2777";

const FASES = { dia1: "Día 1", dia3: "Día 3", dia7: "Semana 1", dia15: "2 semanas", dia30: "1 mes", dia90: "3 meses", dia180: "6 meses" };
const POSES = { frontal: "Frontal", "45_izq": "45° izq.", "45_der": "45° der.", perfil_izq: "Perfil izq.", perfil_der: "Perfil der.", cenital: "Superior" };

const hoyTexto = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** "YYYY-MM-DD" de hace n días */
const haceDias = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const soloFecha = (v) => (v ? String(v).slice(0, 10) : "");
const fechaCorta = (v) => {
  const t = soloFecha(v);
  if (!t) return "—";
  const [y, m, d] = t.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
};
const monto = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
// «Botox» y «toxina botulínica» son el mismo procedimiento
const sinonimo = (t) => norm(t).replace(/\bbotox\b/g, "toxina botulinica");
const mismoProc = (a, b) => { const x = sinonimo(a), y = sinonimo(b); return !!x && !!y && (x.includes(y) || y.includes(x)); };

const VISITAS = [
  { id: "valoracion", icono: "bi-search-heart", texto: "Valoración", ayuda: "Primera vez o nuevo tratamiento" },
  { id: "procedimiento", icono: "bi-magic", texto: "Procedimiento", ayuda: "Producto, lote y zonas" },
  { id: "seguimiento", icono: "bi-heart-pulse", texto: "Control", ayuda: "Revisión después" },
];

export default function EsteticaPaciente({ pacienteId, paciente, tieneModulo = () => true }) {
  const navigate = useNavigate();
  const [recarga, setRecarga] = useState(0);
  const [ventana, setVentana] = useState(null); // { tipo: "presupuesto"|"consentimiento"|"ficha"|"firmar"|"enviar", ... }
  const recargar = () => { setVentana(null); setRecarga((n) => n + 1); };
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [biopsias, setBiopsias] = useState([]);
  const [fotos, setFotos] = useState([]); // todas las fotos (de las últimas sesiones), con su sesión
  const [verTodo, setVerTodo] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [rD, rG, rB] = await Promise.allSettled([
        listarEstetica(undefined, pacienteId),
        api.get(`/galeria-estetica/sesiones?paciente_id=${pacienteId}`),
        api.get(`/biopsias?paciente_id=${pacienteId}`),
      ]);
      if (!vivo) return;
      const ses = rG.status === "fulfilled" ? rG.value.data.data || [] : [];
      setDatos(rD.status === "fulfilled" ? rD.value : []);
      setSesiones(ses);
      setBiopsias(rB.status === "fulfilled" ? rB.value.data.data || [] : []);
      setCargando(false);

      // Fotos de las últimas sesiones, para comparar la misma pose en fechas distintas
      const porSesion = await Promise.all(ses.slice(0, 12).map((s) =>
        api.get(`/galeria-estetica/fotos?sesion_id=${s.id}`).then((r) => (r.data.data || []).map((f) => ({ ...f, sesion: s }))).catch(() => [])));
      if (vivo) setFotos(porSesion.flat());
    })();
    return () => { vivo = false; };
  }, [pacienteId, recarga]);

  const resumen = useMemo(() => {
    const hoy = hoyTexto();
    const de = (t) => datos.filter((d) => d._tipo === t);
    const ficha = de("ficha")[0] || null;
    const presupuestos = de("presupuesto");
    const consentimientos = de("consentimiento");
    const controles = de("seguimiento");
    const procedimientos = de("procedimiento");
    const valoraciones = de("valoracion");
    // Lo registrado en una consulta abre esa consulta
    const enlace = (reg, otro) => (reg.historia_id ? `/consulta-medica?historia_id=${reg.historia_id}` : otro);
    const fechaControl = (c) => soloFecha(c.creado_en || c._creado_en);

    const ultimoControl = [...controles].sort((a, b) => fechaControl(b).localeCompare(fechaControl(a)))[0] || null;
    const proximas = [
      ...controles.map((c) => soloFecha(c.proxima_cita)),
      // Controles agendados desde la consulta (día del procedimiento)
      ...de("procedimiento").flatMap((x) => (x.controles_agendados || []).map((c) => soloFecha(c.fecha))),
    ].filter(Boolean);
    const proximo = proximas.filter((f) => f >= hoy).sort()[0] || null;
    // Vencido: la cita indicada en el último control ya pasó y no hay un control después
    const vencido = ultimoControl && soloFecha(ultimoControl.proxima_cita) && soloFecha(ultimoControl.proxima_cita) < hoy
      ? soloFecha(ultimoControl.proxima_cita) : null;

    const pendientes = presupuestos.filter((p) => ["BORRADOR", "ENVIADO"].includes(p.estado));
    const firmados = consentimientos.filter((c) => c.firmado);
    const sinFirmar = consentimientos.filter((c) => !c.firmado);

    // Solo cuentan los procedimientos realmente hechos y los presupuestos aprobados
    // (no lo escrito en un control, que daba avisos falsos)
    const procs = [...new Set([
      ...procedimientos.map((x) => x.nombre),
      ...presupuestos.filter((p) => p.estado === "APROBADO").flatMap((p) => (p.procedimientos || []).map((x) => x.nombre)),
    ].filter((p) => norm(p)))];
    const sinConsentimiento = procs.filter((p) => !firmados.some((c) => mismoProc(c.procedimiento, p)));

    const alertas = [];
    // El paciente reportó una señal de alarma desde su teléfono (últimos 14 días)
    controles.filter((c) => c.urgente && fechaControl(c) >= haceDias(14)).forEach((c) => alertas.push({
      color: "#dc2626", icono: "bi-exclamation-octagon-fill", urgente: true,
      texto: `El paciente reportó el ${fechaCorta(fechaControl(c))}: ${[...(c.alarmas || []), Number(c.dolor_eva) >= 7 ? `dolor ${c.dolor_eva}/10` : "", c.edema === "Severo" ? "mucha inflamación" : ""].filter(Boolean).join(", ")}.`,
      link: `/estetica/seguimiento?paciente_id=${pacienteId}`, modulo: "seguimiento_postop",
    }));
    biopsias.filter((b) => b.estado === "PENDIENTE").forEach((b) => alertas.push({
      color: "#d97706", icono: "bi-hourglass-split", texto: `Biopsia esperando resultado${b.sitio_anatomico ? ` (${b.sitio_anatomico})` : ""}, tomada el ${fechaCorta(b.fecha_toma)}.`,
      link: `/estetica/biopsias?paciente_id=${pacienteId}`, modulo: "biopsias_patologia",
    }));
    biopsias.filter((b) => b.estado === "RESULTADO_RECIBIDO").forEach((b) => alertas.push({
      color: "#2563eb", icono: "bi-file-earmark-medical", texto: `Llegó el resultado de una biopsia${b.sitio_anatomico ? ` (${b.sitio_anatomico})` : ""}: falta revisarla y cerrarla.`,
      link: `/estetica/biopsias?paciente_id=${pacienteId}`, modulo: "biopsias_patologia",
    }));
    if (vencido) alertas.push({
      color: "#dc2626", icono: "bi-calendar-x", texto: `Control post-procedimiento vencido: tocaba el ${fechaCorta(vencido)}.`,
      link: `/estetica/seguimiento?paciente_id=${pacienteId}`, modulo: "seguimiento_postop",
    });
    // Falta consentimiento: se resuelve ahí mismo (firmar el que ya existe o hacerlo)
    const usados = new Set();
    sinConsentimiento.forEach((p) => {
      const pendiente = sinFirmar.find((c) => !usados.has(c.id) && mismoProc(c.procedimiento, p));
      if (pendiente) usados.add(pendiente.id);
      alertas.push({
        color: "#dc2626", icono: "bi-pen", modulo: "consentimientos_esteticos",
        texto: pendiente ? `${p}: el consentimiento está creado pero falta la firma del paciente.` : `${p}: no hay consentimiento firmado.`,
        acciones: pendiente
          ? [{ texto: "Firmar ahora", icono: "bi-pen", principal: true, accion: { tipo: "firmar", consentimiento: pendiente } },
             { texto: "Enviar para firmar", icono: "bi-send", accion: { tipo: "enviar", consentimiento: pendiente } }]
          : [{ texto: "Hacer consentimiento", icono: "bi-file-earmark-plus", principal: true, accion: { tipo: "consentimiento", procedimiento: p } }],
      });
    });
    // Un solo aviso por procedimiento (si hay dos borradores del mismo, no se repite)
    const yaAvisados = [...sinConsentimiento];
    sinFirmar.filter((c) => !usados.has(c.id) && !yaAvisados.some((p) => mismoProc(c.procedimiento, p)) && (yaAvisados.push(c.procedimiento), true)).forEach((c) => alertas.push({
      color: "#d97706", icono: "bi-pen", modulo: "consentimientos_esteticos",
      texto: `Consentimiento de ${c.procedimiento || "un procedimiento"} sin firmar.`,
      acciones: [{ texto: "Firmar ahora", icono: "bi-pen", principal: true, accion: { tipo: "firmar", consentimiento: c } },
                 { texto: "Enviar para firmar", icono: "bi-send", accion: { tipo: "enviar", consentimiento: c } }],
    }));
    // Presupuestos por aprobar: cobrar o mandar el PDF desde aquí
    pendientes.slice(0, 2).forEach((p) => alertas.push({
      color: "#d97706", icono: "bi-receipt", modulo: "presupuestos",
      texto: `Presupuesto por aprobar: ${p.titulo || (p.procedimientos || []).map((x) => x.nombre).filter(Boolean).join(" + ") || "sin título"} · L ${monto(p.total)}.`,
      acciones: [{ texto: "Cobrar", icono: "bi-cash-coin", principal: true, accion: { tipo: "cobrar", presupuesto: p } },
                 { texto: "PDF", icono: "bi-file-earmark-pdf", accion: { tipo: "pdf", presupuesto: p } }],
    }));
    if (!ficha && (controles.length || sesiones.length || presupuestos.length || procedimientos.length)) alertas.push({
      color: "#6b7280", icono: "bi-clipboard2-pulse", texto: "Falta la ficha estética (fototipo, alergias, antecedentes).",
      modulo: "ficha_estetica",
      acciones: [{ texto: "Llenar ficha", icono: "bi-pencil-square", principal: true, accion: { tipo: "ficha" } }],
    });

    // Línea de tiempo: todo junto, lo más reciente arriba
    const eventos = [
      ...sesiones.map((s) => ({ fecha: soloFecha(s.fecha || s.creado_en), color: "#0ea5e9", icono: "bi-images", titulo: "Sesión de fotos", detalle: s.nombre, link: `/estetica/galeria?paciente_id=${pacienteId}` })),
      ...controles.map((c) => ({ fecha: fechaControl(c), color: c.urgente ? "#dc2626" : c.origen === "paciente" ? "#0ea5e9" : "#8b5cf6", icono: c.origen === "paciente" ? "bi-phone" : "bi-heart-pulse",
        titulo: c.origen === "paciente" ? (c.urgente ? "⚠️ El paciente reportó una alarma" : "El paciente contó cómo va") : `Control ${FASES[c.fase] || ""}`.trim(), detalle: [c.procedimiento, c.resultado && `Resultado: ${c.resultado}`, c.dolor_eva && `Dolor ${c.dolor_eva}/10`].filter(Boolean).join(" · "), link: enlace(c, `/estetica/seguimiento?paciente_id=${pacienteId}`) })),
      ...procedimientos.map((x) => ({ fecha: fechaControl(x), color: ROSA, icono: "bi-magic", titulo: x.nombre || "Procedimiento",
        detalle: [
          Object.entries(x.zonas || {}).map(([z, c]) => `${nombreZona(z)}${c ? ` ${c}${x.unidad ? ` ${x.unidad}` : ""}` : ""}`).join(", "),
          (x.zonas_cuerpo || []).join(", "),
          (x.productos || []).filter((p) => p.producto || p.lote).map((p) => `${p.producto || ""}${p.lote ? ` (lote ${p.lote})` : ""}`).join(", "),
          x.mantenimiento_fecha && `Mantenimiento: ${fechaCorta(x.mantenimiento_fecha)}`,
          x.satisfaccion && `Calificación del paciente: ${"★".repeat(x.satisfaccion.estrellas)}${"☆".repeat(5 - x.satisfaccion.estrellas)}${x.satisfaccion.comentario ? ` «${x.satisfaccion.comentario}»` : ""}`,
        ].filter(Boolean).join(" · "),
        link: enlace(x, `/pacientes/${pacienteId}/perfil?tab=estetica`) })),
      ...valoraciones.map((v) => ({ fecha: fechaControl(v), color: "#64748b", icono: "bi-search-heart", titulo: "Valoración",
        detalle: [(v.sugeridos || []).join(", "), v.motivo].filter(Boolean).join(" · "),
        link: enlace(v, `/pacientes/${pacienteId}/perfil?tab=estetica`) })),
      ...presupuestos.map((p) => ({ fecha: soloFecha(p.creado_en || p._creado_en), color: "#d97706", icono: "bi-receipt", titulo: `Presupuesto ${String(p.estado || "").toLowerCase()}`, detalle: [p.titulo || (p.procedimientos || []).map((x) => x.nombre).filter(Boolean).join(", "), `Total L ${monto(p.total)}`].filter(Boolean).join(" · "), link: "/estetica/presupuestos" })),
      ...consentimientos.map((c) => ({ fecha: soloFecha(c.creado_en || c._creado_en), color: c.firmado ? "#16a34a" : "#9ca3af", icono: "bi-file-earmark-check", titulo: c.firmado ? "Consentimiento firmado" : "Consentimiento sin firmar", detalle: c.procedimiento, link: `/estetica/consentimientos?paciente_id=${pacienteId}` })),
      ...biopsias.map((b) => ({ fecha: soloFecha(b.fecha_toma || b.creado_en), color: "#dc2626", icono: "bi-eyedropper", titulo: "Biopsia", detalle: [b.tipo_biopsia, b.sitio_anatomico, b.resultado_patologico && b.resultado_patologico !== "pendiente" && `Resultado: ${b.resultado_patologico.replace(/_/g, " ")}`].filter(Boolean).join(" · "), link: `/estetica/biopsias?paciente_id=${pacienteId}` })),
    ].filter((e) => e.fecha).sort((a, b) => b.fecha.localeCompare(a.fecha));

    const ultimoProc = [...procedimientos].sort((a, b) => fechaControl(b).localeCompare(fechaControl(a)))[0] || null;

    // Tratamiento en curso
    const proximoMant = procedimientos.map((x) => soloFecha(x.mantenimiento_fecha)).filter((f) => f && f >= hoy).sort()[0] || null;
    const paquetes = paquetesDe(datos).filter((pq) => pq.quedan > 0);
    const facturados = presupuestos.filter((p) => p._factura && p._factura.estado !== "ANULADA");
    const saldo = facturados.reduce((s, p) => s + Math.max(Number(p._factura.total || 0) - Number(p._factura.pagado || 0), 0), 0);
    const sinCobrar = presupuestos.filter((p) => p.estado === "APROBADO" && !p._factura);
    const zonasUltimo = ultimoProc ? [...Object.keys(ultimoProc.zonas || {}).map(nombreZona), ...(ultimoProc.zonas_cuerpo || [])] : [];
    let sigue = null;
    if (alertas.some((a) => a.urgente)) sigue = { icono: "bi-exclamation-triangle-fill", color: "#dc2626", texto: "Revisar la alarma que reportó el paciente." };
    else if (vencido) sigue = { icono: "bi-calendar-x", color: "#dc2626", texto: `Control atrasado: tocaba el ${fechaCorta(vencido)}.`, visita: "seguimiento" };
    else if (proximo) sigue = { icono: "bi-calendar-check", color: "#8b5cf6", texto: `Próximo control el ${fechaCorta(proximo)}.`, visita: "seguimiento" };
    else if (paquetes.length) sigue = { icono: "bi-collection", color: "#7c3aed", texto: `Siguiente sesión de ${paquetes[0].nombre} (le quedan ${paquetes[0].quedan}).`, visita: "procedimiento" };
    else if (proximoMant) sigue = { icono: "bi-arrow-repeat", color: "#0369a1", texto: `Mantenimiento alrededor del ${fechaCorta(proximoMant)}.`, visita: "procedimiento" };
    else if (sinCobrar.length || pendientes.length) sigue = { icono: "bi-receipt", color: "#d97706", texto: sinCobrar.length ? "Tiene un presupuesto aprobado listo para hacerse." : "Tiene un presupuesto esperando su aprobación.", visita: sinCobrar.length ? "procedimiento" : null };
    else if (!ultimoProc && !valoraciones.length) sigue = { icono: "bi-search-heart", color: ROSA, texto: "Paciente nuevo en estética: empiece con una valoración.", visita: "valoracion" };
    const tratamiento = { proximoMant, paquetes, saldo, sinCobrar, zonasUltimo, sigue, hayAlgo: !!(ultimoProc || valoraciones.length || presupuestos.length || controles.length) };

    return { tratamiento, ultimoProc, ficha, presupuestos, pendientes, consentimientos, firmados, controles, ultimoControl, proximo, alertas, eventos };
  }, [datos, sesiones, biopsias, pacienteId]);

  if (cargando) {
    return <div className="text-center text-muted py-5"><div className="spinner-border spinner-border-sm me-2" />Cargando datos estéticos…</div>;
  }

  const { tratamiento: tr, ultimoProc, ficha, pendientes, consentimientos, firmados, ultimoControl, proximo, alertas, eventos } = resumen;
  const visibles = verTodo ? eventos : eventos.slice(0, 8);
  // Accesos secundarios: los que se pueden hacer aquí mismo abren una ventana
  const acciones = [
    { modulo: "galeria_estetica", icono: "bi-camera", texto: "Fotos", accion: { tipo: "fotos" } },
    { modulo: "presupuestos", icono: "bi-receipt", texto: "Presupuesto", accion: { tipo: "presupuesto" } },
    { modulo: "consentimientos_esteticos", icono: "bi-pen", texto: "Consentimiento", accion: { tipo: "consentimiento" } },
    { modulo: "ficha_estetica", icono: "bi-clipboard2-pulse", texto: ficha ? "Ficha" : "Crear ficha", accion: { tipo: "ficha" } },
    { modulo: "biopsias_patologia", icono: "bi-eyedropper", texto: "Biopsia", link: `/estetica/biopsias?paciente_id=${pacienteId}` },
  ].filter((a) => tieneModulo(a.modulo));

  const pdfPresupuesto = async (p) => {
    try {
      const r = await api.get(`/estetica-datos/${p.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      if (!(await compartirEnTelefono(blob, "presupuesto.pdf"))) descargarBlob(blob, "presupuesto.pdf");
    } catch {
      const h = await api.get(`/estetica-datos/${p.id}/pdf`, { params: { formato: "html" }, responseType: "text" }).catch(() => null);
      if (h) imprimirHtml(h.data); else alert("No se pudo generar el PDF.");
    }
  };
  const ejecutar = (a) => {
    if (a.tipo === "cobrar") navigate(`/facturacion?nueva=1&paciente_id=${pacienteId}&presupuesto_id=${a.presupuesto.id}`);
    else if (a.tipo === "pdf") pdfPresupuesto(a.presupuesto);
    else setVentana(a);
  };
  const nuevaAtencion = (tipo) => navigate(`/consulta-medica?paciente_id=${pacienteId}&estetica=${tipo}`);
  const comparables = Object.keys(POSES).filter((pose) => fotos.filter((f) => f.pose === pose).length >= 2);
  const sugeridos = [...new Set([ultimoProc?.nombre, ...pendientes.flatMap((p) => (p.procedimientos || []).map((x) => x.nombre))].filter(Boolean))];

  return (
    <div className="estetica-paciente">
      <style>{`
        .estetica-paciente .ep-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .estetica-paciente .ep-acciones { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; }
        .estetica-paciente .ep-dos { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:16px; align-items:start; }
        .estetica-paciente .ep-accion { display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 4px; border:1px solid #fbcfe8; border-radius:12px; background:#fff; color:${ROSA}; text-decoration:none; font-weight:700; font-size:.78rem; text-align:center; transition:background .15s, transform .15s; }
        .estetica-paciente .ep-accion:hover { background:#fdf2f8; transform:translateY(-1px); }
        .estetica-paciente .ep-accion i { font-size:1.25rem; }
        .estetica-paciente button.ep-accion { cursor:pointer; }
        .estetica-paciente .ep-trat { background:#fff; border:1px solid #fbcfe8; border-left:5px solid ${ROSA}; border-radius:14px; padding:12px 14px; }
        .estetica-paciente .ep-trat-tit { display:flex; align-items:center; gap:6px; color:${ROSA}; font-weight:800; font-size:.74rem; letter-spacing:.05em; text-transform:uppercase; }
        .estetica-paciente .ep-sigue { display:flex; align-items:center; gap:10px; border:1px solid; border-radius:12px; padding:8px 10px; flex:1 1 300px; max-width:520px; font-size:.86rem; font-weight:600; color:#1f2937; }
        .estetica-paciente .ep-sigue > i { font-size:1.25rem; }
        .estetica-paciente .ep-sigue > span { flex:1; }
        .estetica-paciente .ep-sigue small { display:block; font-size:.68rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; }
        .estetica-paciente .ep-mini { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; }
        .estetica-paciente .ep-mini > div { background:#fafafa; border:1px solid #f1f5f9; border-radius:10px; padding:7px 9px; min-width:0; }
        .estetica-paciente .ep-acciones { grid-template-columns:repeat(5,minmax(0,1fr)); }
        .estetica-paciente .ep-accion { flex-direction:row; justify-content:center; padding:8px 6px; }
        .estetica-paciente .ep-accion i { font-size:1rem; }
        .estetica-paciente .ep-nueva { display:flex; align-items:center; gap:14px; flex-wrap:wrap; padding:14px; border-radius:14px; color:#fff;
          background:linear-gradient(135deg, #be185d, #db2777 55%, #ec4899); box-shadow:0 6px 18px rgba(219,39,119,.25); }
        .estetica-paciente .ep-nueva-tit { display:flex; align-items:center; gap:10px; min-width:200px; }
        .estetica-paciente .ep-nueva-tit > i { font-size:1.8rem; }
        .estetica-paciente .ep-nueva-btns { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; flex:1 1 420px; }
        .estetica-paciente .ep-visita { display:flex; align-items:center; gap:10px; text-align:left; border:none; border-radius:12px; padding:10px 12px;
          background:rgba(255,255,255,.95); color:#9d174d; cursor:pointer; transition:transform .15s, box-shadow .15s; }
        .estetica-paciente .ep-visita:hover { transform:translateY(-2px); box-shadow:0 6px 14px rgba(0,0,0,.15); }
        .estetica-paciente .ep-visita i { font-size:1.35rem; }
        .estetica-paciente .ep-visita b { display:block; font-size:.9rem; }
        .estetica-paciente .ep-visita small { display:block; font-size:.72rem; color:#6b7280; }
        .estetica-paciente .ep-aviso { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .estetica-paciente .ep-aviso-btns { display:flex; gap:6px; flex-wrap:wrap; }
        .estetica-paciente .ep-btn { display:inline-flex; align-items:center; gap:5px; border:1px solid; background:#fff; border-radius:999px;
          padding:4px 11px; font-size:.78rem; font-weight:700; cursor:pointer; white-space:nowrap; }
        @media (max-width: 991px) { .estetica-paciente .ep-dos { grid-template-columns:minmax(0,1fr); } .estetica-paciente .ep-mini { grid-template-columns:repeat(3,minmax(0,1fr)); } }
        @media (max-width: 767px) {
          .estetica-paciente .ep-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
          .estetica-paciente .ep-acciones { grid-template-columns:repeat(3,minmax(0,1fr)); }
          .estetica-paciente .ep-nueva-btns { grid-template-columns:minmax(0,1fr); }
          .estetica-paciente .ep-mini { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .estetica-paciente .ep-accion { flex-direction:column; gap:2px; font-size:.72rem; padding:7px 2px; overflow-wrap:anywhere; }
          .estetica-paciente .ep-aviso-btns { width:100%; }
        }
      `}</style>

      {/* Tratamiento en curso: el paciente de un vistazo */}
      <div className="ep-trat mb-3">
        <div className="d-flex align-items-start gap-2 flex-wrap">
          <div style={{ minWidth: 0, flex: "1 1 260px" }}>
            <div className="ep-trat-tit"><i className="bi bi-stars" />Tratamiento en curso</div>
            {ultimoProc ? (
              <div style={{ marginTop: 4 }}>
                <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#111827" }}>{ultimoProc.nombre || "Procedimiento"}</span>
                <span className="text-muted" style={{ fontSize: "0.82rem" }}> · {fechaCorta(ultimoProc.creado_en || ultimoProc._creado_en)}</span>
                {tr.zonasUltimo.length > 0 && <div className="text-muted" style={{ fontSize: "0.8rem", overflowWrap: "anywhere" }}>{tr.zonasUltimo.join(", ")}</div>}
              </div>
            ) : (
              <div className="text-muted" style={{ marginTop: 4, fontSize: "0.88rem" }}>Todavía no tiene procedimientos registrados.</div>
            )}
          </div>
          {tr.sigue && (
            <div className="ep-sigue" style={{ borderColor: `${tr.sigue.color}55`, background: `${tr.sigue.color}0d` }}>
              <i className={`bi ${tr.sigue.icono}`} style={{ color: tr.sigue.color }} />
              <span style={{ minWidth: 0 }}><small>Qué sigue</small>{tr.sigue.texto}</span>
              {tr.sigue.visita && (
                <button type="button" className="ep-btn" style={{ background: tr.sigue.color, color: "#fff", borderColor: tr.sigue.color }} onClick={() => nuevaAtencion(tr.sigue.visita)}>
                  Atender<i className="bi bi-arrow-right" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="ep-mini mt-2">
          <Mini icono="bi-calendar-check" color="#8b5cf6" titulo="Próximo control" valor={proximo ? fechaCorta(proximo) : "Sin programar"}
            sub={ultimoControl ? `Último: ${FASES[ultimoControl.fase] || fechaCorta(ultimoControl.creado_en || ultimoControl._creado_en)}` : ""} />
          <Mini icono="bi-arrow-repeat" color="#0369a1" titulo="Mantenimiento" valor={tr.proximoMant ? fechaCorta(tr.proximoMant) : "—"} sub={tr.proximoMant ? "aproximado" : ""} />
          <Mini icono="bi-collection" color="#7c3aed" titulo="Sesiones" valor={tr.paquetes.length ? `Quedan ${tr.paquetes.reduce((s, x) => s + x.quedan, 0)}` : "Sin paquete"}
            sub={tr.paquetes.length ? tr.paquetes.map((x) => x.nombre).join(", ") : ""} />
          <Mini icono="bi-cash-coin" color={tr.saldo > 0 ? "#b45309" : "#15803d"} titulo="Saldo" valor={tr.saldo > 0 ? `L ${monto(tr.saldo)}` : "Al día"}
            sub={pendientes.length ? `${pendientes.length} presupuesto${pendientes.length > 1 ? "s" : ""} por aprobar` : tr.sinCobrar.length ? `${tr.sinCobrar.length} aprobado sin cobrar` : ""} />
          <Mini icono="bi-file-earmark-check" color="#16a34a" titulo="Consentimientos" valor={consentimientos.length ? `${firmados.length} de ${consentimientos.length}` : "—"} sub={consentimientos.length ? "firmados" : ""} />
          <Mini icono="bi-clipboard2-pulse" color={ficha ? "#0f766e" : "#9ca3af"} titulo="Ficha" valor={ficha ? `Fototipo ${ficha.fototipo || "—"}` : "Sin ficha"}
            sub={ficha ? `Piel ${String(ficha.piel_tipo || "—").toLowerCase()}${ficha.alergias_medicamentos || ficha.alergias_anestesia || ficha.alergias_latex ? " · ⚠ alergias" : ""}` : ""} />
        </div>
        {tr.paquetes.map((pq) => (
          <div key={`${pq.presupuesto_id}-${pq.indice}`} className="d-flex align-items-center gap-2 flex-wrap mt-2" style={{ fontSize: "0.82rem" }}>
            <i className="bi bi-collection" style={{ color: "#7c3aed" }} />
            <strong>{pq.nombre}</strong>
            <span style={{ color: "#5b21b6" }}>{pq.usadas} de {pq.sesiones}</span>
            <div className="flex-grow-1" style={{ minWidth: 80, height: 6, background: "#ede9fe", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, (pq.usadas / pq.sesiones) * 100)}%`, height: "100%", background: "#7c3aed" }} />
            </div>
            <span style={{ fontWeight: 700, color: !pq.factura ? "#b91c1c" : pq.factura.pagado >= pq.factura.total ? "#15803d" : "#b45309" }}>
              {!pq.factura ? "Sin cobrar" : pq.factura.pagado >= pq.factura.total ? "Pagado" : `Debe L ${monto(pq.factura.total - pq.factura.pagado)}`}
            </span>
          </div>
        ))}
      </div>

      {/* Nueva atención estética: abre la consulta con la pestaña Estética lista */}
      {(
        <div className="ep-nueva mb-3">
          <div className="ep-nueva-tit">
            <i className="bi bi-plus-circle-fill" />
            <div>
              <div style={{ fontWeight: 800, fontSize: "1rem" }}>Nueva atención estética</div>
              <div style={{ fontSize: "0.78rem", opacity: 0.85 }}>Abre la consulta con todo listo</div>
            </div>
          </div>
          <div className="ep-nueva-btns">
            {VISITAS.map((v) => (
              <button key={v.id} type="button" className="ep-visita" onClick={() => nuevaAtencion(v.id)}>
                <i className={`bi ${v.icono}`} />
                <span><b>{v.texto}</b><small>{v.ayuda}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Accesos secundarios */}
      {acciones.length > 0 && (
        <div className="ep-acciones mb-3">
          {acciones.map((a) => (a.link
            ? <Link key={a.modulo} to={a.link} className="ep-accion"><i className={`bi ${a.icono}`} />{a.texto}</Link>
            : <button key={a.modulo} type="button" className="ep-accion" onClick={() => ejecutar(a.accion)}><i className={`bi ${a.icono}`} />{a.texto}</button>))}
        </div>
      )}

      {/* Avisos */}
      {alertas.filter((a) => tieneModulo(a.modulo)).length > 0 && (
        <div className="mb-3 d-flex flex-column gap-2">
          {alertas.filter((a) => tieneModulo(a.modulo)).map((a, i) => {
            const caja = { background: `${a.color}10`, border: `1px solid ${a.color}40`, borderLeft: `4px solid ${a.color}`, borderRadius: 10, padding: "8px 12px", color: "#1f2937", fontSize: "0.88rem" };
            if (!a.acciones) {
              return (
                <Link key={i} to={a.link} className="d-flex align-items-center gap-2 text-decoration-none" style={caja}>
                  <i className={`bi ${a.icono}`} style={{ color: a.color, fontSize: "1.05rem" }} />
                  <span className="flex-grow-1">{a.texto}</span>
                  <i className="bi bi-chevron-right text-muted" />
                </Link>
              );
            }
            return (
              <div key={i} className="ep-aviso" style={caja}>
                <i className={`bi ${a.icono}`} style={{ color: a.color, fontSize: "1.05rem" }} />
                <span className="flex-grow-1" style={{ minWidth: 0 }}>{a.texto}</span>
                <span className="ep-aviso-btns">
                  {a.acciones.map((b) => (
                    <button key={b.texto} type="button" onClick={() => ejecutar(b.accion)} className="ep-btn"
                      style={b.principal ? { background: a.color, color: "#fff", borderColor: a.color } : { color: a.color, borderColor: `${a.color}66` }}>
                      <i className={`bi ${b.icono}`} />{b.texto}
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="ep-dos">
        {/* Antes y después */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: `3px solid ${ROSA}`, borderRadius: 12, padding: 14 }}>
          <div className="d-flex align-items-center gap-2 mb-2" style={{ color: ROSA, fontWeight: 800, fontSize: "0.78rem", letterSpacing: ".04em", textTransform: "uppercase" }}>
            <i className="bi bi-arrow-left-right" />Antes y después
          </div>
          {comparables.length ? <Comparador fotos={fotos} poses={comparables} /> : (
            <div className="text-center text-muted py-4" style={{ fontSize: "0.88rem" }}>
              <i className="bi bi-camera d-block mb-2" style={{ fontSize: "1.8rem", color: "#f9a8d4" }} />
              {fotos.length ? "Para comparar hace falta otra foto con la misma pose (de antes y después, o de otra fecha)." : "Aún no hay fotos de este paciente."}
            </div>
          )}
          {tieneModulo("galeria_estetica") && (
            <div className="d-flex gap-2 flex-wrap mt-2">
              <button type="button" className="ep-btn" style={{ background: ROSA, color: "#fff", borderColor: ROSA }} onClick={() => setVentana({ tipo: "fotos" })}>
                <i className="bi bi-camera-fill" />Tomar o subir fotos
              </button>
              <Link to={`/estetica/galeria?paciente_id=${pacienteId}`} className="ep-btn text-decoration-none" style={{ color: ROSA, borderColor: "#f9a8d4" }}>
                <i className="bi bi-images" />Galería completa
              </Link>
            </div>
          )}
        </div>

        {/* Línea de tiempo */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: "3px solid #8b5cf6", borderRadius: 12, padding: 14 }}>
          <div className="d-flex align-items-center gap-2 mb-3" style={{ color: "#8b5cf6", fontWeight: 800, fontSize: "0.78rem", letterSpacing: ".04em", textTransform: "uppercase" }}>
            <i className="bi bi-clock-history" />Historial estético
            <span className="ms-auto text-muted" style={{ fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>{eventos.length} registros</span>
          </div>
          {eventos.length === 0 ? (
            <div className="text-center text-muted py-4" style={{ fontSize: "0.88rem" }}>Todavía no hay registros estéticos.</div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 22 }}>
              <div style={{ position: "absolute", left: 7, top: 6, bottom: 6, width: 2, background: "#ede9fe" }} />
              {visibles.map((e, i) => (
                <Link key={i} to={e.link} className="d-block text-decoration-none mb-2" style={{ position: "relative", color: "#1f2937" }}>
                  <span style={{ position: "absolute", left: -22, top: 8, width: 16, height: 16, borderRadius: "50%", background: "#fff", border: `3px solid ${e.color}` }} />
                  <div style={{ border: "1px solid #f1f5f9", borderRadius: 10, padding: "7px 10px", background: "#fafafa" }}>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <i className={`bi ${e.icono}`} style={{ color: e.color }} />
                      <strong style={{ fontSize: "0.86rem" }}>{e.titulo}</strong>
                      <span className="ms-auto text-muted" style={{ fontSize: "0.76rem" }}>{fechaCorta(e.fecha)}</span>
                    </div>
                    {e.detalle && <div className="text-muted" style={{ fontSize: "0.8rem", marginTop: 2, overflowWrap: "anywhere" }}>{e.detalle}</div>}
                  </div>
                </Link>
              ))}
              {eventos.length > 8 && (
                <button type="button" className="btn btn-link p-0" style={{ color: "#8b5cf6", fontWeight: 700, fontSize: "0.82rem" }} onClick={() => setVerTodo((v) => !v)}>
                  {verTodo ? "Ver menos" : `Ver todo (${eventos.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ventanas que se abren aquí mismo, sin salir del perfil */}
      {ventana?.tipo === "presupuesto" && (
        <ModalPresupuesto paciente={paciente} pacienteId={pacienteId} sugeridos={sugeridos.slice(0, 1)} textoVolver="Listo" onClose={recargar} />
      )}
      {ventana?.tipo === "consentimiento" && (
        <ModalConsentimiento paciente={paciente} pacienteId={pacienteId} procedimiento={ventana.procedimiento || sugeridos[0]} onClose={recargar}
          onFirmar={(c) => setVentana({ tipo: "firmar", consentimiento: c })}
          onEnviar={(c) => setVentana({ tipo: "enviar", consentimiento: c })} />
      )}
      {ventana?.tipo === "fotos" && (
        <ModalFotoRapida pacienteId={pacienteId} sesiones={sesiones} nombreSugerido={ultimoProc?.nombre || ""} onClose={() => setVentana(null)} onSubida={recargar} />
      )}
      {ventana?.tipo === "ficha" && (
        <ModalFichaRapida pacienteId={pacienteId} fichaActual={ficha} onClose={() => setVentana(null)} onGuardada={recargar} />
      )}
      {ventana?.tipo === "firmar" && (
        <ModalFirmarConsentimiento consentimiento={ventana.consentimiento} onClose={recargar} onFirmado={recargar} />
      )}
      {ventana?.tipo === "enviar" && (
        <ModalEnviarPaciente titulo="Enviar para firmar en casa" onClose={recargar}
          descripcion={`El paciente recibe un enlace para leer el consentimiento de ${ventana.consentimiento.procedimiento || "su procedimiento"} y firmarlo con el dedo desde su teléfono. Cuando firme, le llega un aviso a la clínica.`}
          crear={async (enviarCorreo) => (await api.post(`/estetica-datos/${ventana.consentimiento.id}/enlace`, { enviar_correo: enviarCorreo })).data.data} />
      )}
    </div>
  );
}


function Mini({ icono, color, titulo, valor, sub }) {
  return (
    <div>
      <div className="d-flex align-items-center gap-1" style={{ color, fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em" }}>
        <i className={`bi ${icono}`} /><span style={{ lineHeight: 1.15 }}>{titulo}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#111827", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{valor}</div>
      {sub && <div className="text-muted" style={{ fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sub}>{sub}</div>}
    </div>
  );
}

const ordenFoto = (f) => `${soloFecha(f.sesion?.fecha || f.creado_en)}|${f.momento === "antes" ? 0 : 1}|${f.creado_en || ""}`;
const nombreFoto = (f) => `${fechaCorta(f.sesion?.fecha || f.creado_en)} · ${f.momento === "antes" ? "Antes" : "Después"}${f.sesion?.nombre ? ` · ${f.sesion.nombre}` : ""}`;

/**
 * Compara dos fotos de la misma pose (de la misma sesión o de fechas distintas):
 * se superponen y se arrastra la línea. Por defecto, la más antigua contra la más reciente.
 */
function Comparador({ fotos, poses }) {
  const [sel, setSel] = useState(() => ({ pose: poses.includes("frontal") ? "frontal" : poses[0], a: null, b: null }));
  const [corte, setCorte] = useState(50);
  const pose = poses.includes(sel.pose) ? sel.pose : poses[0];
  const lista = fotos.filter((f) => f.pose === pose).sort((x, y) => ordenFoto(x).localeCompare(ordenFoto(y)));
  const izq = lista.find((f) => f.id === sel.a) || lista[0];
  const der = lista.find((f) => f.id === sel.b) || lista[lista.length - 1];
  const etiqueta = { position: "absolute", top: 8, padding: "2px 8px", borderRadius: 999, background: "rgba(17,24,39,.65)", color: "#fff", fontSize: "0.72rem", fontWeight: 700, maxWidth: "46%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const corto = (f) => `${f.momento === "antes" ? "Antes" : "Después"} · ${fechaCorta(f.sesion?.fecha || f.creado_en)}`;
  const selStyle = { width: "100%", padding: "5px 8px", border: "1px solid #f9a8d4", borderRadius: 8, fontSize: "0.8rem", background: "#fff", minWidth: 0 };
  return (
    <div>
      {poses.length > 1 && (
        <div className="d-flex flex-wrap gap-1 mb-2">
          {poses.map((p) => (
            <button key={p} type="button" onClick={() => setSel({ pose: p, a: null, b: null })} className="btn btn-sm"
              style={{ borderRadius: 999, fontSize: "0.75rem", fontWeight: 700, padding: "2px 10px", border: `1px solid ${ROSA}`, background: p === pose ? ROSA : "#fff", color: p === pose ? "#fff" : ROSA }}>
              {POSES[p] || p}
            </button>
          ))}
        </div>
      )}
      <div className="d-grid gap-2 mb-2" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <select style={selStyle} value={izq.id} onChange={(e) => setSel({ ...sel, pose, a: Number(e.target.value) })} aria-label="Foto de la izquierda">
          {lista.map((f) => <option key={f.id} value={f.id}>{nombreFoto(f)}</option>)}
        </select>
        <select style={selStyle} value={der.id} onChange={(e) => setSel({ ...sel, pose, b: Number(e.target.value) })} aria-label="Foto de la derecha">
          {lista.map((f) => <option key={f.id} value={f.id}>{nombreFoto(f)}</option>)}
        </select>
      </div>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 5", maxHeight: 420, borderRadius: 10, overflow: "hidden", background: "#111", userSelect: "none" }}>
        <img src={der.archivo_url} alt="Derecha" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <img src={izq.archivo_url} alt="Izquierda" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: `inset(0 ${100 - corte}% 0 0)` }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${corte}%`, width: 3, marginLeft: -1.5, background: "#fff", boxShadow: "0 0 6px rgba(0,0,0,.4)", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: ROSA, boxShadow: "0 2px 6px rgba(0,0,0,.3)" }}>
            <i className="bi bi-arrow-left-right" />
          </div>
        </div>
        <span style={{ ...etiqueta, left: 8 }}>{corto(izq)}</span>
        <span style={{ ...etiqueta, right: 8 }}>{corto(der)}</span>
        <input type="range" min="0" max="100" value={corte} onChange={(e) => setCorte(Number(e.target.value))} aria-label="Comparar fotos"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "ew-resize", margin: 0, touchAction: "pan-y" }} />
      </div>
    </div>
  );
}
