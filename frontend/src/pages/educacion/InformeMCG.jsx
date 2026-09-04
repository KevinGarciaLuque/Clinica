import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import api from "../../api/api";
import { TEAL, TEAL_LIGHT, card, inputStyle, label, btn, deepMerge } from "./shared";
import {
  RANGOS_MCG, CAMPOS_INTERPRETACION, CAMPOS_RECOMENDACIONES,
  emptyInforme, sumaPorcentajes, aLineas,
} from "./mcgShared";

const edad = (fn) => (fn ? `${dayjs().diff(fn, "year")} años` : "—");

// ═══════════════════════════════════════════════════════════════════════════════
//  IMPRESIÓN
// ═══════════════════════════════════════════════════════════════════════════════
function PrintInformeMCG({ informe, paciente, user, logoUrl, headerCfg, onClose }) {
  const encabezadoOn = headerCfg?.encabezado_color !== false;
  const encabezadoColor = encabezadoOn ? (headerCfg?.color || TEAL) : "#d1d5db";
  const encabezadoTextColor = encabezadoOn ? (headerCfg?.color || TEAL) : "#1a1a2e";

  const enc = informe.encabezado || {};
  const res = informe.resumen || {};
  const tr = informe.tiempo_rangos || {};
  const inter = informe.interpretacion || {};
  const reco = informe.recomendaciones || {};
  const plan = informe.plan || {};
  const prof = informe.profesional || {};
  const total = sumaPorcentajes(tr);

  const S = {
    sectionTitle: { fontSize: 11, fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: ".07em", borderBottom: "1.5px solid #99f6e4", paddingBottom: 4, margin: "16px 0 8px" },
    dataGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", columnGap: 18, rowGap: 10 },
    dLabel: { fontSize: 9.5, fontWeight: 700, color: "#0f766e", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 2 },
    dValue: { fontSize: 11.5, color: "#1f2937", fontWeight: 600 },
    resumenCard: { border: "1px solid #99f6e4", borderRadius: 8, padding: "8px 10px", background: "#f0fdfa" },
    txtBlock: { fontSize: 11, color: "#1f2937", whiteSpace: "pre-wrap", margin: "2px 0 0" },
  };
  const D = (k, v) => <div><div style={S.dLabel}>{k}</div><div style={S.dValue}>{v || "—"}</div></div>;
  const RC = (k, v, u) => (
    <div style={S.resumenCard}>
      <div style={S.dLabel}>{k}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f766e" }}>{v || "—"}{v && u ? <span style={{ fontSize: 10, fontWeight: 600 }}> {u}</span> : null}</div>
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #mcg-print-doc, #mcg-print-doc * { visibility: visible !important; }
          #mcg-print-doc { position:fixed!important; top:0!important; left:0!important; width:100%!important; padding:12mm 16mm!important; box-shadow:none!important; background:white!important; }
          #print-actions-bar { display:none!important; }
          @page { margin:0; size:A4; }
        }
      `}</style>
      <div id="print-actions-bar" style={{ background: "#f0fdfa", borderBottom: "1px solid #99f6e4", padding: "12px 24px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => window.print()} style={{ padding: "9px 22px", background: TEAL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 14 }}>
          <i className="bi bi-printer-fill" /> Imprimir / Guardar PDF
        </button>
        <button onClick={onClose} style={{ padding: "9px 22px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 9, fontWeight: 600, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
          <i className="bi bi-x-lg" /> Cerrar
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#0f766e" }}>Vista previa — Informe MCG {dayjs(informe.fecha).format("DD/MM/YYYY")}</span>
      </div>
      <div style={{ background: "#e8e8e8", minHeight: "calc(100vh - 60px)", padding: "24px 16px", overflowY: "auto", display: "flex", justifyContent: "center" }}>
        <div id="mcg-print-doc" style={{ background: "white", width: "100%", maxWidth: "210mm", minHeight: "297mm", padding: "16mm 18mm", boxShadow: "0 4px 32px rgba(0,0,0,.18)", fontFamily: "Arial, sans-serif", color: "#1a1a2e", boxSizing: "border-box", alignSelf: "flex-start" }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2.5px solid ${encabezadoColor}`, paddingBottom: 8, marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: 110, maxWidth: 240, objectFit: "contain", marginLeft: "-8mm" }} />}
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: encabezadoTextColor }}>{user?.clinica_nombre || "Clínica de Diabetes y Tecnología"}</div>
                <div style={{ fontSize: 10, color: encabezadoOn ? "#0f766e" : "#6b7280", marginTop: 3 }}>Educación en Diabetes</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b" }}>INFORME DE MONITOREO<br />CONTINUO DE GLUCOSA</div>
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>Fecha: <strong>{dayjs(informe.fecha).format("DD/MM/YYYY")}</strong></div>
            </div>
          </div>

          <div style={S.dataGrid}>
            {D("Nombre del paciente", `${paciente?.nombres || ""} ${paciente?.apellidos || ""}`.trim())}
            {D("Fecha de nacimiento", paciente?.fecha_nacimiento ? dayjs(paciente.fecha_nacimiento).format("DD/MM/YYYY") : "—")}
            {D("Edad", edad(paciente?.fecha_nacimiento))}
            {D("Sexo", paciente?.sexo)}
            {D("Teléfono / Contacto", paciente?.telefono)}
            {D("ID / Expediente", enc.id_expediente)}
            {D("Dispositivo / Sensor", enc.dispositivo_sensor)}
            {D("Período analizado", (enc.fecha_inicio || enc.fecha_fin) ? `${enc.fecha_inicio ? dayjs(enc.fecha_inicio).format("DD/MM/YYYY") : "—"} a ${enc.fecha_fin ? dayjs(enc.fecha_fin).format("DD/MM/YYYY") : "—"}` : "—")}
            {D("Días analizados", enc.dias_analizados)}
          </div>

          <div style={S.sectionTitle}>1. Resumen del monitoreo</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {RC("Días de uso del sensor", res.dias_uso_sensor, "días")}
            {RC("Datos disponibles", res.pct_datos_disponibles, "%")}
            {RC("Glucosa promedio", res.glucosa_promedio, "mg/dL")}
            {RC("GMI (indicador A1c estimado)", res.gmi, "%")}
            {RC("Coeficiente de variación (CV)", res.cv, "%")}
            {RC("Desviación estándar (DE)", res.desviacion_estandar, "mg/dL")}
          </div>

          <div style={S.sectionTitle}>2. Tiempo en rangos (TIR)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: "#f0fdfa" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", border: "1px solid #d1d5db" }}>Rango de glucosa</th>
                <th style={{ textAlign: "center", padding: "6px 8px", border: "1px solid #d1d5db", width: 90 }}>mg/dL</th>
                <th style={{ textAlign: "center", padding: "6px 8px", border: "1px solid #d1d5db", width: 80 }}>Tiempo</th>
                <th style={{ textAlign: "center", padding: "6px 8px", border: "1px solid #d1d5db", width: 80 }}>% del tiempo</th>
              </tr>
            </thead>
            <tbody>
              {RANGOS_MCG.map(r => (
                <tr key={r.key}>
                  <td style={{ padding: "6px 8px", border: "1px solid #d1d5db" }}>
                    <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: r.color, marginRight: 7 }} />
                    {r.label} <span style={{ color: "#6b7280" }}>· {r.sub}</span>
                  </td>
                  <td style={{ textAlign: "center", padding: "6px 8px", border: "1px solid #d1d5db" }}>{r.rango}</td>
                  <td style={{ textAlign: "center", padding: "6px 8px", border: "1px solid #d1d5db" }}>{tr[r.key]?.tiempo || "—"}</td>
                  <td style={{ textAlign: "center", padding: "6px 8px", border: "1px solid #d1d5db", fontWeight: 700 }}>{tr[r.key]?.pct ? `${tr[r.key].pct} %` : "—"}</td>
                </tr>
              ))}
              <tr style={{ background: "#f0fdfa", fontWeight: 800 }}>
                <td style={{ padding: "6px 8px", border: "1px solid #d1d5db" }} colSpan={3}>TOTAL</td>
                <td style={{ textAlign: "center", padding: "6px 8px", border: "1px solid #d1d5db", color: total >= 98 && total <= 102 ? "#16a34a" : "#dc2626" }}>{total ? `${total} %` : "—"}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 8.5, color: "#6b7280", marginTop: 3, fontStyle: "italic" }}>* Rangos objetivo recomendados para la mayoría de adultos con diabetes.</div>

          <div style={S.sectionTitle}>3. Interpretación clínica</div>
          {CAMPOS_INTERPRETACION.map(([k, l]) => (
            <div key={k} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#0f766e" }}>{l}</div>
              <p style={S.txtBlock}>{inter[k] || "—"}</p>
            </div>
          ))}

          <div style={S.sectionTitle}>4. Recomendaciones educativas</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 18, rowGap: 8 }}>
            {CAMPOS_RECOMENDACIONES.map(([k, l]) => {
              const lineas = aLineas(reco[k]);
              return (
                <div key={k}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#0f766e" }}>{l}</div>
                  {lineas.length
                    ? <ul style={{ margin: "2px 0 0", paddingLeft: 16 }}>{lineas.map((x, i) => <li key={i} style={{ fontSize: 10.5 }}>{x}</li>)}</ul>
                    : <p style={S.txtBlock}>—</p>}
                </div>
              );
            })}
          </div>

          <div style={S.sectionTitle}>5. Plan de seguimiento</div>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0f766e" }}>Objetivos acordados</div>
            <p style={S.txtBlock}>{plan.objetivos_acordados || "—"}</p>
          </div>
          <div style={{ fontSize: 11, margin: "4px 0" }}><strong>Próxima revisión:</strong> {plan.proxima_revision ? dayjs(plan.proxima_revision).format("DD/MM/YYYY") : "—"}</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0f766e" }}>Observaciones</div>
            <p style={S.txtBlock}>{plan.observaciones || "—"}</p>
          </div>

          <div style={S.sectionTitle}>6. Datos del profesional</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, marginTop: 6 }}>
            <div style={{ fontSize: 11, lineHeight: 1.7 }}>
              <div><strong>Nombre:</strong> {prof.nombre || informe.educador_nombre || "—"}</div>
              <div><strong>Profesión / Cargo:</strong> {prof.profesion_cargo || "—"}</div>
              <div><strong>N.º de colegiación:</strong> {prof.numero_colegiacion || "—"}</div>
            </div>
            <div style={{ textAlign: "center", minWidth: 220 }}>
              {user?.firma_url ? <img src={user.firma_url} alt="Firma" style={{ maxHeight: 64, maxWidth: 200, objectFit: "contain", display: "block", margin: "0 auto 4px" }} /> : <div style={{ height: 64 }} />}
              <div style={{ borderTop: "1.5px solid #374151", paddingTop: 6, fontSize: 10, color: "#6b7280" }}>Firma y Sello · Fecha: {dayjs(informe.fecha).format("DD/MM/YYYY")}</div>
            </div>
          </div>

          <div style={{ marginTop: 20, paddingTop: 10, borderTop: "1px solid #e5e7eb", textAlign: "center", fontSize: 9, color: "#9ca3af" }}>
            Generado el {dayjs().format("DD/MM/YYYY [a las] HH:mm")}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PANEL — lista + formulario de Informes MCG
// ═══════════════════════════════════════════════════════════════════════════════
export default function PanelInformesMCG({ paciente, user, logoUrl, headerCfg }) {
  const [informes, setInformes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [activo, setActivo] = useState(null);            // registro cargado | "nuevo" | null
  const [form, setForm] = useState(null);
  const [fecha, setFecha] = useState(dayjs().format("YYYY-MM-DD"));
  const [guardando, setGuardando] = useState(false);
  const [imprimir, setImprimir] = useState(null);        // registro a imprimir | null

  const cargar = useCallback(async () => {
    if (!paciente) return;
    setLoading(true);
    try {
      const r = await api.get("/educacion-diabetes/informes-mcg", { params: { paciente_id: paciente.id, limit: 50 } });
      setInformes(r.data.data || []);
    } catch { setInformes([]); }
    finally { setLoading(false); }
  }, [paciente]);

  useEffect(() => { setActivo(null); setImprimir(null); cargar(); }, [cargar]);

  const nuevo = () => {
    const base = structuredClone(emptyInforme);
    base.profesional.nombre = [user?.nombres, user?.apellidos].filter(Boolean).join(" ");
    setForm(base);
    setFecha(dayjs().format("YYYY-MM-DD"));
    setActivo("nuevo");
    setMsg(null);
  };

  const abrir = async (id) => {
    const r = await api.get(`/educacion-diabetes/informes-mcg/${id}`);
    const d = r.data.data;
    setForm(deepMerge(structuredClone(emptyInforme), d));
    setFecha(dayjs(d.fecha).format("YYYY-MM-DD"));
    setActivo(d);
    setMsg(null);
  };

  const abrirImpresion = async (id) => {
    const r = await api.get(`/educacion-diabetes/informes-mcg/${id}`);
    setImprimir(r.data.data);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const payload = { paciente_id: paciente.id, fecha, ...form };
      if (activo === "nuevo") {
        await api.post("/educacion-diabetes/informes-mcg", payload);
        setMsg({ tipo: "ok", texto: "Informe guardado" });
      } else {
        await api.put(`/educacion-diabetes/informes-mcg/${activo.id}`, payload);
        setMsg({ tipo: "ok", texto: "Informe actualizado" });
      }
      setActivo(null);
      await cargar();
    } catch (e) {
      setMsg({ tipo: "err", texto: e.response?.data?.msg || "Error al guardar" });
    } finally { setGuardando(false); }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este informe? Esta acción no se puede deshacer.")) return;
    try { await api.delete(`/educacion-diabetes/informes-mcg/${id}`); await cargar(); }
    catch (e) { setMsg({ tipo: "err", texto: e.response?.data?.msg || "Error al eliminar" }); }
  };

  const set = (path, value) => {
    setForm(prev => {
      const next = structuredClone(prev);
      const parts = path.split(".");
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  };

  if (imprimir) {
    return <PrintInformeMCG informe={imprimir} paciente={paciente} user={user} logoUrl={logoUrl} headerCfg={headerCfg} onClose={() => setImprimir(null)} />;
  }

  return (
    <div>
      {msg && (
        <div style={{ padding: "10px 16px", borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600, background: msg.tipo === "ok" ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)", color: msg.tipo === "ok" ? "#059669" : "#dc2626" }}>
          {msg.texto}
        </div>
      )}

      {!activo && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button style={btn(TEAL)} onClick={nuevo}><i className="bi bi-plus-lg" /> Nuevo Informe</button>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>Cargando…</div>
          ) : informes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 0", color: "#94a3b8" }}>
              <i className="bi bi-file-earmark-medical" style={{ fontSize: 36, display: "block", marginBottom: 10, opacity: .3 }} />
              No hay informes de monitoreo continuo registrados
            </div>
          ) : (
            informes.map(inf => (
              <div key={inf.id} style={{ ...card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => abrir(inf.id)}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: TEAL_LIGHT, border: `1px solid ${TEAL}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className="bi bi-file-earmark-medical" style={{ color: TEAL, fontSize: 18 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{dayjs(inf.fecha).format("DD/MM/YYYY")}</div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                    {inf.estado === "FIRMADA" ? "Firmado" : "Borrador"}{inf.educador_nombre ? ` · ${inf.educador_nombre}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button title="Ver / Editar" onClick={() => abrir(inf.id)} style={{ width: 32, height: 32, border: `1px solid ${TEAL}40`, borderRadius: 8, background: TEAL_LIGHT, color: TEAL, cursor: "pointer" }}><i className="bi bi-pencil" /></button>
                  <button title="Imprimir" onClick={() => abrirImpresion(inf.id)} style={{ width: 32, height: 32, border: "1px solid rgba(16,185,129,.25)", borderRadius: 8, background: "rgba(16,185,129,.1)", color: "#10b981", cursor: "pointer" }}><i className="bi bi-printer" /></button>
                  <button title="Eliminar" onClick={() => eliminar(inf.id)} style={{ width: 32, height: 32, border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, background: "rgba(239,68,68,.1)", color: "#ef4444", cursor: "pointer" }}><i className="bi bi-trash" /></button>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {activo && form && (
        <FormInforme
          form={form} set={set} fecha={fecha} setFecha={setFecha}
          bloqueado={activo !== "nuevo" && activo?.estado === "FIRMADA"}
          guardando={guardando} onGuardar={guardar} onCancelar={() => setActivo(null)}
          paciente={paciente}
        />
      )}
    </div>
  );
}

// ── Formulario ───────────────────────────────────────────────────────────────
function FormInforme({ form, set, fecha, setFecha, bloqueado, guardando, onGuardar, onCancelar, paciente }) {
  const total = sumaPorcentajes(form.tiempo_rangos);
  const totalOk = total >= 98 && total <= 102;
  const num = { ...inputStyle, textAlign: "center" };

  return (
    <div>
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <span style={label}>Fecha del informe</span>
          <input type="date" style={{ ...inputStyle, width: 190 }} value={fecha} onChange={e => setFecha(e.target.value)} disabled={bloqueado} />
        </div>
        <div style={{ fontSize: 12.5, color: "#64748b" }}>
          Paciente: <strong>{paciente?.nombres} {paciente?.apellidos}</strong> · {edad(paciente?.fecha_nacimiento)} · {paciente?.sexo || "—"}
        </div>
      </div>

      {/* Cabecera del período */}
      <div style={card}>
        <div style={label}>Período de monitoreo</div>
        <div className="edu-grid-3">
          <div><span style={label}>ID / Expediente</span><input style={inputStyle} disabled={bloqueado} value={form.encabezado.id_expediente} onChange={e => set("encabezado.id_expediente", e.target.value)} /></div>
          <div><span style={label}>Dispositivo / Sensor</span><input style={inputStyle} disabled={bloqueado} value={form.encabezado.dispositivo_sensor} onChange={e => set("encabezado.dispositivo_sensor", e.target.value)} /></div>
          <div><span style={label}>Días analizados</span><input style={inputStyle} disabled={bloqueado} value={form.encabezado.dias_analizados} onChange={e => set("encabezado.dias_analizados", e.target.value)} /></div>
          <div><span style={label}>Fecha de inicio</span><input type="date" style={inputStyle} disabled={bloqueado} value={form.encabezado.fecha_inicio} onChange={e => set("encabezado.fecha_inicio", e.target.value)} /></div>
          <div><span style={label}>Fecha de fin</span><input type="date" style={inputStyle} disabled={bloqueado} value={form.encabezado.fecha_fin} onChange={e => set("encabezado.fecha_fin", e.target.value)} /></div>
        </div>
      </div>

      {/* 1. Resumen del monitoreo */}
      <div style={card}>
        <div style={label}>1. Resumen del monitoreo</div>
        <div className="edu-grid-3">
          <div><span style={label}>Días de uso del sensor</span><input style={num} disabled={bloqueado} value={form.resumen.dias_uso_sensor} onChange={e => set("resumen.dias_uso_sensor", e.target.value)} /></div>
          <div><span style={label}>% de datos disponibles</span><input style={num} disabled={bloqueado} value={form.resumen.pct_datos_disponibles} onChange={e => set("resumen.pct_datos_disponibles", e.target.value)} /></div>
          <div><span style={label}>Glucosa promedio (mg/dL)</span><input style={num} disabled={bloqueado} value={form.resumen.glucosa_promedio} onChange={e => set("resumen.glucosa_promedio", e.target.value)} /></div>
          <div><span style={label}>GMI (%)</span><input style={num} disabled={bloqueado} value={form.resumen.gmi} onChange={e => set("resumen.gmi", e.target.value)} /></div>
          <div><span style={label}>Coeficiente de variación CV (%)</span><input style={num} disabled={bloqueado} value={form.resumen.cv} onChange={e => set("resumen.cv", e.target.value)} /></div>
          <div><span style={label}>Desviación estándar DE (mg/dL)</span><input style={num} disabled={bloqueado} value={form.resumen.desviacion_estandar} onChange={e => set("resumen.desviacion_estandar", e.target.value)} /></div>
        </div>
      </div>

      {/* 2. Tiempo en rangos */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={label}>2. Tiempo en rangos (TIR)</div>
          <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 12px", borderRadius: 20, background: totalOk ? "rgba(16,185,129,.12)" : "rgba(245,158,11,.15)", color: totalOk ? "#16a34a" : "#b45309" }}>
            TOTAL: {total || 0} %
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: TEAL_LIGHT }}>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Rango</th>
              <th style={{ width: 90 }}>mg/dL</th>
              <th style={{ width: 120 }}>Tiempo (h:mm)</th>
              <th style={{ width: 110 }}>% del tiempo</th>
            </tr>
          </thead>
          <tbody>
            {RANGOS_MCG.map(r => (
              <tr key={r.key}>
                <td style={{ padding: "5px 8px" }}>
                  <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: r.color, marginRight: 7 }} />
                  {r.label}
                </td>
                <td style={{ textAlign: "center", color: "#64748b" }}>{r.rango}</td>
                <td><input style={num} disabled={bloqueado} value={form.tiempo_rangos[r.key]?.tiempo || ""} onChange={e => set(`tiempo_rangos.${r.key}.tiempo`, e.target.value)} /></td>
                <td><input style={num} disabled={bloqueado} value={form.tiempo_rangos[r.key]?.pct || ""} onChange={e => set(`tiempo_rangos.${r.key}.pct`, e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Interpretación clínica */}
      <div style={card}>
        <div style={label}>3. Interpretación clínica</div>
        {CAMPOS_INTERPRETACION.map(([k, l, icon]) => (
          <div key={k} style={{ marginTop: 8 }}>
            <span style={label}><i className={`bi ${icon}`} style={{ color: TEAL, marginRight: 6 }} />{l}</span>
            <textarea style={{ ...inputStyle, minHeight: 52 }} disabled={bloqueado} value={form.interpretacion[k]} onChange={e => set(`interpretacion.${k}`, e.target.value)} />
          </div>
        ))}
      </div>

      {/* 4. Recomendaciones educativas */}
      <div style={card}>
        <div style={label}>4. Recomendaciones educativas <span style={{ fontWeight: 400, color: "#94a3b8" }}>— una recomendación por línea</span></div>
        <div className="edu-grid-2">
          {CAMPOS_RECOMENDACIONES.map(([k, l, icon]) => (
            <div key={k} style={{ marginTop: 8 }}>
              <span style={label}><i className={`bi ${icon}`} style={{ color: TEAL, marginRight: 6 }} />{l}</span>
              <textarea style={{ ...inputStyle, minHeight: 70 }} disabled={bloqueado} value={form.recomendaciones[k]} onChange={e => set(`recomendaciones.${k}`, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* 5. Plan de seguimiento */}
      <div style={card}>
        <div style={label}>5. Plan de seguimiento</div>
        <div style={{ marginTop: 8 }}><span style={label}>Objetivos acordados</span>
          <textarea style={{ ...inputStyle, minHeight: 60 }} disabled={bloqueado} value={form.plan.objetivos_acordados} onChange={e => set("plan.objetivos_acordados", e.target.value)} />
        </div>
        <div className="edu-grid-2" style={{ marginTop: 8 }}>
          <div><span style={label}>Próxima revisión</span><input type="date" style={inputStyle} disabled={bloqueado} value={form.plan.proxima_revision} onChange={e => set("plan.proxima_revision", e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 8 }}><span style={label}>Observaciones</span>
          <textarea style={{ ...inputStyle, minHeight: 52 }} disabled={bloqueado} value={form.plan.observaciones} onChange={e => set("plan.observaciones", e.target.value)} />
        </div>
      </div>

      {/* 6. Datos del profesional */}
      <div style={card}>
        <div style={label}>6. Datos del profesional</div>
        <div className="edu-grid-3">
          <div><span style={label}>Nombre</span><input style={inputStyle} disabled={bloqueado} value={form.profesional.nombre} onChange={e => set("profesional.nombre", e.target.value)} /></div>
          <div><span style={label}>Profesión / Cargo</span><input style={inputStyle} disabled={bloqueado} value={form.profesional.profesion_cargo} onChange={e => set("profesional.profesion_cargo", e.target.value)} /></div>
          <div><span style={label}>N.º de colegiación</span><input style={inputStyle} disabled={bloqueado} value={form.profesional.numero_colegiacion} onChange={e => set("profesional.numero_colegiacion", e.target.value)} /></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {!bloqueado && (
          <button style={btn(TEAL)} disabled={guardando} onClick={onGuardar}>
            <i className="bi bi-save" /> {guardando ? "Guardando…" : "Guardar Informe"}
          </button>
        )}
        <button style={btn(TEAL, true)} onClick={onCancelar}><i className="bi bi-x-lg" /> Cancelar</button>
      </div>
    </div>
  );
}
