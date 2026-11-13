import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import { listarEstetica } from "../utils/esteticaDatos";
import { nombreZona } from "../utils/esteticaCatalogos";

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

export default function EsteticaPaciente({ pacienteId, tieneModulo = () => true }) {
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [biopsias, setBiopsias] = useState([]);
  const [comparar, setComparar] = useState(null); // { sesion, pares: [{pose, antes, despues}] }
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

      // Antes/después: la sesión más reciente que tenga la misma pose en ambos momentos
      for (const s of ses.slice(0, 5)) {
        const r = await api.get(`/galeria-estetica/fotos?sesion_id=${s.id}`).catch(() => null);
        const fotos = r?.data?.data || [];
        const pares = Object.keys(POSES).map((pose) => ({
          pose,
          antes: fotos.find((f) => f.momento === "antes" && f.pose === pose),
          despues: fotos.find((f) => f.momento === "despues" && f.pose === pose),
        })).filter((p) => p.antes && p.despues);
        if (pares.length) { if (vivo) setComparar({ sesion: s, pares }); break; }
      }
    })();
    return () => { vivo = false; };
  }, [pacienteId]);

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

    const procs = [...new Set([
      ...controles.map((c) => c.procedimiento),
      ...procedimientos.map((x) => x.nombre),
      ...presupuestos.filter((p) => p.estado === "APROBADO").flatMap((p) => (p.procedimientos || []).map((x) => x.nombre)),
    ].filter((p) => norm(p)))];
    const sinConsentimiento = procs.filter((p) => !firmados.some((c) => mismoProc(c.procedimiento, p)));

    const alertas = [];
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
    sinConsentimiento.forEach((p) => alertas.push({
      color: "#dc2626", icono: "bi-pen", texto: `${p}: no hay consentimiento firmado.`,
      link: `/estetica/consentimientos?paciente_id=${pacienteId}`, modulo: "consentimientos_esteticos",
    }));
    if (sinFirmar.length) alertas.push({
      color: "#d97706", icono: "bi-pen", texto: `${sinFirmar.length} consentimiento${sinFirmar.length > 1 ? "s" : ""} pendiente${sinFirmar.length > 1 ? "s" : ""} de firma.`,
      link: `/estetica/consentimientos?paciente_id=${pacienteId}`, modulo: "consentimientos_esteticos",
    });
    if (!ficha && (controles.length || sesiones.length || presupuestos.length)) alertas.push({
      color: "#6b7280", icono: "bi-clipboard2-pulse", texto: "Falta la ficha estética (fototipo, alergias, antecedentes).",
      link: `/estetica/ficha?paciente_id=${pacienteId}`, modulo: "ficha_estetica",
    });

    // Línea de tiempo: todo junto, lo más reciente arriba
    const eventos = [
      ...sesiones.map((s) => ({ fecha: soloFecha(s.fecha || s.creado_en), color: "#0ea5e9", icono: "bi-images", titulo: "Sesión de fotos", detalle: s.nombre, link: `/estetica/galeria?paciente_id=${pacienteId}` })),
      ...controles.map((c) => ({ fecha: fechaControl(c), color: "#8b5cf6", icono: "bi-heart-pulse", titulo: `Control ${FASES[c.fase] || ""}`.trim(), detalle: [c.procedimiento, c.resultado && `Resultado: ${c.resultado}`, c.dolor_eva && `Dolor ${c.dolor_eva}/10`].filter(Boolean).join(" · "), link: enlace(c, `/estetica/seguimiento?paciente_id=${pacienteId}`) })),
      ...procedimientos.map((x) => ({ fecha: fechaControl(x), color: ROSA, icono: "bi-magic", titulo: x.nombre || "Procedimiento",
        detalle: [
          Object.entries(x.zonas || {}).map(([z, c]) => `${nombreZona(z)}${c ? ` ${c}${x.unidad ? ` ${x.unidad}` : ""}` : ""}`).join(", "),
          (x.zonas_cuerpo || []).join(", "),
          (x.productos || []).filter((p) => p.producto || p.lote).map((p) => `${p.producto || ""}${p.lote ? ` (lote ${p.lote})` : ""}`).join(", "),
          x.mantenimiento_fecha && `Mantenimiento: ${fechaCorta(x.mantenimiento_fecha)}`,
        ].filter(Boolean).join(" · "),
        link: enlace(x, `/pacientes/${pacienteId}/perfil?tab=estetica`) })),
      ...valoraciones.map((v) => ({ fecha: fechaControl(v), color: "#64748b", icono: "bi-search-heart", titulo: "Valoración",
        detalle: [(v.sugeridos || []).join(", "), v.motivo].filter(Boolean).join(" · "),
        link: enlace(v, `/pacientes/${pacienteId}/perfil?tab=estetica`) })),
      ...presupuestos.map((p) => ({ fecha: soloFecha(p.creado_en || p._creado_en), color: "#d97706", icono: "bi-receipt", titulo: `Presupuesto ${String(p.estado || "").toLowerCase()}`, detalle: [p.titulo || (p.procedimientos || []).map((x) => x.nombre).filter(Boolean).join(", "), `Total ${monto(p.total)}`].filter(Boolean).join(" · "), link: "/estetica/presupuestos" })),
      ...consentimientos.map((c) => ({ fecha: soloFecha(c.creado_en || c._creado_en), color: c.firmado ? "#16a34a" : "#9ca3af", icono: "bi-file-earmark-check", titulo: c.firmado ? "Consentimiento firmado" : "Consentimiento sin firmar", detalle: c.procedimiento, link: `/estetica/consentimientos?paciente_id=${pacienteId}` })),
      ...biopsias.map((b) => ({ fecha: soloFecha(b.fecha_toma || b.creado_en), color: "#dc2626", icono: "bi-eyedropper", titulo: "Biopsia", detalle: [b.tipo_biopsia, b.sitio_anatomico, b.resultado_patologico && b.resultado_patologico !== "pendiente" && `Resultado: ${b.resultado_patologico.replace(/_/g, " ")}`].filter(Boolean).join(" · "), link: `/estetica/biopsias?paciente_id=${pacienteId}` })),
    ].filter((e) => e.fecha).sort((a, b) => b.fecha.localeCompare(a.fecha));

    const ultimoProc = [...procedimientos].sort((a, b) => fechaControl(b).localeCompare(fechaControl(a)))[0] || null;
    return { ultimoProc, ficha, presupuestos, pendientes, consentimientos, firmados, controles, ultimoControl, proximo, alertas, eventos };
  }, [datos, sesiones, biopsias, pacienteId]);

  if (cargando) {
    return <div className="text-center text-muted py-5"><div className="spinner-border spinner-border-sm me-2" />Cargando datos estéticos…</div>;
  }

  const { ultimoProc, ficha, pendientes, consentimientos, firmados, ultimoControl, proximo, alertas, eventos } = resumen;
  const visibles = verTodo ? eventos : eventos.slice(0, 8);
  const acciones = [
    { modulo: "galeria_estetica", icono: "bi-camera", texto: "Fotos", link: `/estetica/galeria?paciente_id=${pacienteId}` },
    { modulo: "seguimiento_postop", icono: "bi-heart-pulse", texto: "Control", link: `/estetica/seguimiento?paciente_id=${pacienteId}` },
    { modulo: "presupuestos", icono: "bi-receipt", texto: "Presupuesto", link: "/estetica/presupuestos" },
    { modulo: "consentimientos_esteticos", icono: "bi-pen", texto: "Consentimiento", link: `/estetica/consentimientos?paciente_id=${pacienteId}` },
    { modulo: "ficha_estetica", icono: "bi-clipboard2-pulse", texto: ficha ? "Ficha" : "Crear ficha", link: `/estetica/ficha?paciente_id=${pacienteId}` },
    { modulo: "biopsias_patologia", icono: "bi-eyedropper", texto: "Biopsia", link: `/estetica/biopsias?paciente_id=${pacienteId}` },
  ].filter((a) => tieneModulo(a.modulo));

  return (
    <div className="estetica-paciente">
      <style>{`
        .estetica-paciente .ep-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
        .estetica-paciente .ep-acciones { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; }
        .estetica-paciente .ep-dos { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:16px; align-items:start; }
        .estetica-paciente .ep-accion { display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 4px; border:1px solid #fbcfe8; border-radius:12px; background:#fff; color:${ROSA}; text-decoration:none; font-weight:700; font-size:.78rem; text-align:center; transition:background .15s, transform .15s; }
        .estetica-paciente .ep-accion:hover { background:#fdf2f8; transform:translateY(-1px); }
        .estetica-paciente .ep-accion i { font-size:1.25rem; }
        @media (max-width: 991px) { .estetica-paciente .ep-dos { grid-template-columns:minmax(0,1fr); } }
        @media (max-width: 767px) {
          .estetica-paciente .ep-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
          .estetica-paciente .ep-acciones { grid-template-columns:repeat(3,minmax(0,1fr)); }
        }
      `}</style>

      {/* Accesos rápidos */}
      {acciones.length > 0 && (
        <div className="ep-acciones mb-3">
          {acciones.map((a) => (
            <Link key={a.modulo} to={a.link} className="ep-accion"><i className={`bi ${a.icono}`} />{a.texto}</Link>
          ))}
        </div>
      )}

      {/* Avisos */}
      {alertas.filter((a) => tieneModulo(a.modulo)).length > 0 && (
        <div className="mb-3 d-flex flex-column gap-2">
          {alertas.filter((a) => tieneModulo(a.modulo)).map((a, i) => (
            <Link key={i} to={a.link} className="d-flex align-items-center gap-2 text-decoration-none"
              style={{ background: `${a.color}10`, border: `1px solid ${a.color}40`, borderLeft: `4px solid ${a.color}`, borderRadius: 10, padding: "8px 12px", color: "#1f2937", fontSize: "0.88rem" }}>
              <i className={`bi ${a.icono}`} style={{ color: a.color, fontSize: "1.05rem" }} />
              <span className="flex-grow-1">{a.texto}</span>
              <i className="bi bi-chevron-right text-muted" />
            </Link>
          ))}
        </div>
      )}

      {/* Resumen */}
      <div className="ep-grid mb-3">
        {ultimoProc ? (
          <Dato color={ROSA} icono="bi-magic" titulo="Último procedimiento"
            valor={fechaCorta(ultimoProc.creado_en || ultimoProc._creado_en)}
            sub={`${ultimoProc.nombre || "Procedimiento"}${ultimoProc.mantenimiento_fecha ? ` · mantenimiento ${fechaCorta(ultimoProc.mantenimiento_fecha)}` : ""}`} />
        ) : (
          <Dato color="#0ea5e9" icono="bi-images" titulo="Últimas fotos"
            valor={sesiones[0] ? fechaCorta(sesiones[0].fecha || sesiones[0].creado_en) : "Sin fotos"}
            sub={sesiones[0]?.nombre || `${sesiones.length} sesiones`} />
        )}
        <Dato color="#8b5cf6" icono="bi-calendar-check" titulo="Próximo control"
          valor={proximo ? fechaCorta(proximo) : "Sin programar"}
          sub={ultimoControl ? `Último: ${FASES[ultimoControl.fase] || ""} ${ultimoControl.procedimiento || ""}`.trim() : "Sin controles"} />
        <Dato color="#d97706" icono="bi-receipt" titulo="Presupuestos"
          valor={pendientes.length ? monto(pendientes.reduce((s, p) => s + Number(p.total || 0), 0)) : "Al día"}
          sub={pendientes.length ? `${pendientes.length} por aprobar` : "Ninguno pendiente"} />
        <Dato color="#16a34a" icono="bi-file-earmark-check" titulo="Consentimientos"
          valor={`${firmados.length} de ${consentimientos.length} firmados`}
          sub={ficha ? `Ficha: fototipo ${ficha.fototipo || "—"} · piel ${String(ficha.piel_tipo || "—").toLowerCase()}` : "Sin ficha estética"} />
      </div>

      <div className="ep-dos">
        {/* Antes y después */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: `3px solid ${ROSA}`, borderRadius: 12, padding: 14 }}>
          <div className="d-flex align-items-center gap-2 mb-2" style={{ color: ROSA, fontWeight: 800, fontSize: "0.78rem", letterSpacing: ".04em", textTransform: "uppercase" }}>
            <i className="bi bi-arrow-left-right" />Antes y después
          </div>
          {comparar ? <AntesDespues {...comparar} /> : (
            <div className="text-center text-muted py-4" style={{ fontSize: "0.88rem" }}>
              <i className="bi bi-camera d-block mb-2" style={{ fontSize: "1.8rem", color: "#f9a8d4" }} />
              {sesiones.length ? "Aún no hay una foto de «antes» y otra de «después» con la misma pose." : "Aún no hay fotos de este paciente."}
              {tieneModulo("galeria_estetica") && (
                <div className="mt-2"><Link to={`/estetica/galeria?paciente_id=${pacienteId}`} className="btn btn-sm btn-outline-danger" style={{ borderColor: ROSA, color: ROSA }}>Ir a la galería</Link></div>
              )}
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
    </div>
  );
}

function Dato({ color, icono, titulo, valor, sub }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", minWidth: 0 }}>
      <div className="d-flex align-items-center gap-2" style={{ color, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em" }}>
        <i className={`bi ${icono}`} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: "1.02rem", color: "#111827", marginTop: 4 }}>{valor}</div>
      <div className="text-muted" style={{ fontSize: "0.76rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sub}>{sub}</div>
    </div>
  );
}

/** Foto de antes y después superpuestas; se arrastra la línea para comparar. */
function AntesDespues({ sesion, pares }) {
  const [pose, setPose] = useState(pares[0].pose);
  const [corte, setCorte] = useState(50);
  const par = pares.find((p) => p.pose === pose) || pares[0];
  const etiqueta = { position: "absolute", top: 8, padding: "2px 8px", borderRadius: 999, background: "rgba(17,24,39,.65)", color: "#fff", fontSize: "0.72rem", fontWeight: 700 };
  return (
    <div>
      <div className="text-muted mb-2" style={{ fontSize: "0.8rem" }}>{sesion.nombre || "Sesión"} · {fechaCorta(sesion.fecha || sesion.creado_en)}</div>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 5", maxHeight: 420, borderRadius: 10, overflow: "hidden", background: "#111", userSelect: "none" }}>
        <img src={par.despues.archivo_url} alt="Después" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <img src={par.antes.archivo_url} alt="Antes" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: `inset(0 ${100 - corte}% 0 0)` }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${corte}%`, width: 3, marginLeft: -1.5, background: "#fff", boxShadow: "0 0 6px rgba(0,0,0,.4)", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: ROSA, boxShadow: "0 2px 6px rgba(0,0,0,.3)" }}>
            <i className="bi bi-arrow-left-right" />
          </div>
        </div>
        <span style={{ ...etiqueta, left: 8 }}>Antes</span>
        <span style={{ ...etiqueta, right: 8 }}>Después</span>
        <input type="range" min="0" max="100" value={corte} onChange={(e) => setCorte(Number(e.target.value))} aria-label="Comparar antes y después"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "ew-resize", margin: 0, touchAction: "pan-y" }} />
      </div>
      {pares.length > 1 && (
        <div className="d-flex flex-wrap gap-1 mt-2">
          {pares.map((p) => (
            <button key={p.pose} type="button" onClick={() => setPose(p.pose)} className="btn btn-sm"
              style={{ borderRadius: 999, fontSize: "0.75rem", fontWeight: 700, padding: "2px 10px", border: `1px solid ${ROSA}`, background: p.pose === pose ? ROSA : "#fff", color: p.pose === pose ? "#fff" : ROSA }}>
              {POSES[p.pose] || p.pose}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
