import { useState, useEffect, useRef } from "react";
import dayjs from "dayjs";
import api from "../../api/api";
import { nombreMedico } from "../../utils/medico";
import { zscoreDetroit, ECO_ZMAP } from "../../utils/zscoreEco";

// ══════════════════════════════════════════════════════════════════════
// TAB: ECOCARDIOGRAMA (cardiología pediátrica) — formato Hospital y Clínicas Viera
// ══════════════════════════════════════════════════════════════════════

// Situs / posición
const ECO_SEGMENTARIO = [
  { key: "situs_abdominal",  label: "Situs Abdominal",        opts: ["Solitus", "Inverso", "Ambiguo"] },
  { key: "posicion_corazon", label: "Posición del Corazón",   opts: ["Levocardia", "Mesocardia", "Dextrocardia"] },
  { key: "situs_atrial",     label: "Situs Atrial",           opts: ["Solitus", "Inverso", "Ambiguo"] },
  { key: "retornos_sistemicos", label: "Retornos venosos sistémicos",  opts: ["Normal", "Anormal"], detalle: "retornos_sistemicos_det" },
  { key: "retornos_pulmonares", label: "Retornos venosos pulmonares",  opts: ["Normal", "Anormal"], detalle: "retornos_pulmonares_det" },
];
const ECO_CONEXIONES = [
  { key: "conexion_av", label: "Conexión atrio/ventricular", opts: ["Concordante", "Discordante", "Ambiguo", "Doble entrada", "Ausencia de conexión"] },
  { key: "conexion_va", label: "Conexión ventrículo/arterial", opts: ["Concordante", "Discordante", "Doble salida", "Única salida"] },
  { key: "modo_av",     label: "Modo de conexión AV",        opts: ["Perforado", "Imperforado", "Común"] },
];
const ECO_PARAM_ROWS = ["VI", "A. Aórtico", "Raíz Ao", "Unión ST", "A. Pulmonar", "TAP", "RDAP", "RIAP", "V mitral", "V tricúspide"];
const ECO_PARAM_COLS = [
  { key: "dd",     label: "DD" },
  { key: "dd_z",   label: "Z-score" },
  { key: "ds",     label: "DS" },
  { key: "ds_z",   label: "Z-score" },
  { key: "septum", label: "Septum d" },
  { key: "septum_z", label: "Z-score" },
  { key: "ppvi",   label: "PPVI d" },
  { key: "ppvi_z", label: "Z-score" },
];
// Convierte a mm el valor ingresado según la unidad elegida
const ecoToMm = (v, unidad) => {
  const n = parseFloat(v);
  if (!n) return n;
  return unidad === "cm" ? n * 10 : n;
};
const ECO_DOPPLER = [
  { key: "ea_tricuspide", label: "E/A Tricúspide" },
  { key: "ee_vd",         label: "E/E' VD" },
  { key: "ea_mitral",     label: "E/A Mitral" },
  { key: "ee_septal",     label: "E/E' Septal" },
  { key: "ee_lateral",    label: "E/E' Lateral" },
];
const ECO_FUNCION = [
  { key: "fevi_simpson", label: "FEVI Simpson", unit: "%" },
  { key: "modo_m",       label: "Modo M",        unit: "%" },
  { key: "favi",         label: "FAVI",          unit: "%" },
  { key: "favd",         label: "FAVD",          unit: "%" },
  { key: "tapse",        label: "TAPSE",         unit: "mm" },
  { key: "psvd",         label: "PSVD",          unit: "mmHg" },
];
const ECO_ECOTT = [
  { key: "septum_interauricular",  label: "Septum interauricular" },
  { key: "septum_interventricular", label: "Septum interventricular" },
  { key: "valvula_tricuspide",     label: "Válvula Tricúspide" },
  { key: "valvula_mitral",         label: "Válvula mitral" },
  { key: "valvula_pulmonar",       label: "Válvula pulmonar" },
  { key: "valvula_aortica",        label: "Válvula aórtica" },
  { key: "ramas_pulmonares",       label: "Ramas pulmonares" },
  { key: "arco_aortico",           label: "Arco aórtico" },
  { key: "conducto_arterioso",     label: "Conducto arterioso" },
];

function edadTexto(fnac) {
  if (!fnac) return "";
  const m = dayjs().diff(dayjs(fnac), "month");
  const a = Math.floor(m / 12), mm = m % 12;
  return a > 0 ? `${a} a ${mm} m` : `${mm} m`;
}

function AutoTextarea({ value, onChange, disabled, style, placeholder }) {
  const ref = useRef(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 34) + "px";
  };
  useEffect(fit, [value]);
  return (
    <textarea
      ref={ref}
      className="form-control form-control-sm"
      rows={1}
      placeholder={placeholder}
      disabled={disabled}
      value={value || ""}
      onChange={e => { onChange(e); fit(); }}
      style={{ overflow: "hidden", resize: "none", ...style }}
    />
  );
}

function EcoSection({ id, title, icon, open, toggle, children }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
      <button type="button" onClick={() => toggle(id)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 16px",
          background: open ? "#eff6ff" : "#f8fafc", border: "none", cursor: "pointer", textAlign: "left" }}>
        <i className={`bi ${icon}`} style={{ color: "#2563eb", fontSize: "1rem" }} />
        <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "#1a2744", flex: 1 }}>{title}</span>
        <i className={`bi bi-chevron-${open ? "up" : "down"}`} style={{ color: "#9ca3af", fontSize: "0.8rem" }} />
      </button>
      {open && <div style={{ padding: "16px" }}>{children}</div>}
    </div>
  );
}

export default function EcocardiogramaTab({ datos, setDatos, firmada, vitals, paciente, onPrint }) {
  const d = datos || {};
  const set = (k, v) => setDatos(prev => ({ ...prev, [k]: v }));
  const [openSecs, setOpenSecs] = useState({ basal: true, segmentario: true, conexiones: true });
  const toggle = (id) => setOpenSecs(s => ({ ...s, [id]: !s[id] }));
  const bsa = vitals?.sc;
  const unidad = d.param_unidad || "mm";

  // Autocalcular Z-scores (Detroit 2008) a partir de las medidas y la BSA
  useEffect(() => {
    if (firmada || !bsa) return;
    setDatos(prev => {
      let changed = false;
      const next = { ...prev };
      const u = prev.param_unidad || "mm";
      for (const [mapKey, struct] of Object.entries(ECO_ZMAP)) {
        const [row, col] = mapKey.split("|");
        const mk = `p_${row}_${col}`.replace(/\s+/g, "_");
        const zk = `${mk}_z`;
        const res = zscoreDetroit(struct, ecoToMm(prev[mk], u), bsa);
        const val = res ? res.texto : "";
        if ((prev[zk] || "") !== val) { next[zk] = val; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [datos, bsa, firmada]);

  const inp = { borderRadius: 6, fontSize: "0.82rem" };
  const zInp = { ...inp, textAlign: "center" };

  const Radio = ({ name, opts }) => (
    <div className="d-flex flex-wrap gap-3">
      {opts.map(o => (
        <label key={o} className="d-flex align-items-center gap-1" style={{ fontSize: "0.82rem", cursor: firmada ? "default" : "pointer" }}>
          <input type="radio" name={name} disabled={firmada}
            checked={d[name] === o} onChange={() => set(name, o)} />
          {o}
        </label>
      ))}
      {d[name] && !firmada && (
        <button type="button" onClick={() => set(name, "")} className="btn btn-link btn-sm p-0" style={{ fontSize: "0.72rem" }}>limpiar</button>
      )}
    </div>
  );

  return (
    <div>
      {/* Banner */}
      <div style={{ background: "linear-gradient(135deg,#fef2f4,#fde8ec)", border: "1px solid #fbcfe8", borderRadius: 10, padding: "10px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
        <i className="bi bi-heart-pulse-fill" style={{ color: "#be123c", fontSize: "1.2rem" }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color: "#1a2744", fontSize: "0.9rem" }}>Hoja de Ecocardiograma</span>
          <div style={{ fontSize: "0.75rem", color: "#be123c", marginTop: 1 }}>Se guarda junto con la historia SOAP al presionar Borrador o Firmar.</div>
        </div>
        <button type="button" onClick={onPrint}
          style={{ background: "#be123c", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <i className="bi bi-printer-fill" /> Imprimir
        </button>
      </div>

      {/* Datos basales */}
      <EcoSection id="basal" title="Datos basales" icon="bi-person-vcard" open={openSecs.basal} toggle={toggle}>
        <div className="row g-2">
          <div className="col-6 col-md-3"><label className="form-label mb-1" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280" }}>Peso (kg)</label>
            <input className="form-control form-control-sm" style={inp} value={vitals?.peso || ""} disabled readOnly /></div>
          <div className="col-6 col-md-3"><label className="form-label mb-1" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280" }}>Talla (cm)</label>
            <input className="form-control form-control-sm" style={inp} value={vitals?.talla || ""} disabled readOnly /></div>
          <div className="col-6 col-md-3"><label className="form-label mb-1" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280" }}>Superficie corporal (m²)</label>
            <input className="form-control form-control-sm" style={inp} value={vitals?.sc || ""} disabled readOnly /></div>
          <div className="col-6 col-md-3"><label className="form-label mb-1" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280" }}>Edad</label>
            <input className="form-control form-control-sm" style={inp} value={edadTexto(paciente?.fecha_nacimiento)} disabled readOnly /></div>
          <div className="col-6 col-md-3"><label className="form-label mb-1" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280" }}>Fecha del estudio</label>
            <input type="date" className="form-control form-control-sm" style={inp} disabled={firmada}
              value={d.fecha || dayjs().format("YYYY-MM-DD")} onChange={e => set("fecha", e.target.value)} /></div>
          <div className="col-12 col-md-9"><label className="form-label mb-1" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280" }}>Motivo / diagnóstico de referencia</label>
            <input className="form-control form-control-sm" style={inp} disabled={firmada}
              value={d.motivo || ""} onChange={e => set("motivo", e.target.value)} /></div>
        </div>
        <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: 6 }}>Peso, talla y superficie corporal se toman de Signos Vitales (SOAP).</div>
      </EcoSection>

      {/* Análisis segmentario (izq) + Conexiones (der) */}
      <div className="row g-3">
        <div className="col-lg-6">
          <EcoSection id="segmentario" title="Análisis segmentario" icon="bi-diagram-3" open={openSecs.segmentario} toggle={toggle}>
            {ECO_SEGMENTARIO.map(row => (
              <div key={row.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 4 }}>{row.label}</div>
                <Radio name={row.key} opts={row.opts} />
                {row.detalle && d[row.key] === "Anormal" && (
                  <div className="mt-2"><AutoTextarea style={inp} placeholder="Describa la anomalía…" disabled={firmada}
                    value={d[row.detalle]} onChange={e => set(row.detalle, e.target.value)} /></div>
                )}
              </div>
            ))}
          </EcoSection>
        </div>
        <div className="col-lg-6">
          <EcoSection id="conexiones" title="Conexiones" icon="bi-share" open={openSecs.conexiones} toggle={toggle}>
            {ECO_CONEXIONES.map(row => (
              <div key={row.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: 4 }}>{row.label}</div>
                <Radio name={row.key} opts={row.opts} />
                <div className="mt-2"><AutoTextarea style={inp} placeholder="Observaciones…" disabled={firmada}
                  value={d[`${row.key}_obs`]} onChange={e => set(`${row.key}_obs`, e.target.value)} /></div>
              </div>
            ))}
          </EcoSection>
        </div>
      </div>

      {/* Parámetros ecocardiográficos */}
      <EcoSection id="parametros" title={`Parámetros ecocardiográficos (${unidad} / Valor Z)`} icon="bi-rulers" open={openSecs.parametros} toggle={toggle}>
        {/* Selector de unidad */}
        <div className="d-flex align-items-center gap-2 mb-2">
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}>Unidad de medida:</span>
          {["mm", "cm"].map(u => (
            <button key={u} type="button" disabled={firmada}
              onClick={() => {
                if (u === unidad) return;
                const factor = u === "cm" ? 0.1 : 10; // mm→cm o cm→mm
                setDatos(prev => {
                  const next = { ...prev, param_unidad: u };
                  Object.keys(prev).forEach(key => {
                    if (key.startsWith("p_") && !key.endsWith("_z") && prev[key] !== "" && prev[key] != null) {
                      const n = parseFloat(prev[key]);
                      if (!isNaN(n)) next[key] = String(Math.round(n * factor * 100) / 100);
                    }
                  });
                  return next;
                });
              }}
              style={{
                border: `1px solid ${unidad === u ? "#be123c" : "#d1d5db"}`,
                background: unidad === u ? "#be123c" : "#fff",
                color: unidad === u ? "#fff" : "#374151",
                borderRadius: 6, padding: "3px 14px", fontSize: "0.8rem", fontWeight: 700,
                cursor: firmada ? "default" : "pointer",
              }}>
              {u}
            </button>
          ))}
          <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>El Z-score se recalcula automáticamente.</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table table-sm table-bordered align-middle" style={{ fontSize: "0.78rem", minWidth: 720 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr><th></th>{ECO_PARAM_COLS.map(c => <th key={c.key} style={{ textAlign: "center", fontWeight: 600 }}>{c.label}{c.key.endsWith("_z") ? "" : ` (${unidad})`}</th>)}</tr>
            </thead>
            <tbody>
              {ECO_PARAM_ROWS.map(r => (
                <tr key={r}>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r}</td>
                  {ECO_PARAM_COLS.map(c => {
                    const k = `p_${r}_${c.key}`.replace(/\s+/g, "_");
                    const isZ = c.key.endsWith("_z");
                    const baseCol = isZ ? c.key.slice(0, -2) : null;
                    const struct = isZ ? ECO_ZMAP[`${r}|${baseCol}`] : null;
                    const auto = struct && bsa
                      ? zscoreDetroit(struct, ecoToMm(d[`p_${r}_${baseCol}`.replace(/\s+/g, "_")], unidad), bsa)
                      : null;
                    if (isZ && struct) {
                      return <td key={c.key} style={{ padding: "3px 4px", textAlign: "center", background: auto ? auto.bg : "#f1f5f9", minWidth: 96 }}
                        title={auto ? `${auto.detalle}${auto.confiable ? "" : " · BSA fuera de rango (>2.0)"}` : "Se calcula al ingresar la medida y la BSA"}>
                        {auto ? (
                          <>
                            <div style={{ fontWeight: 800, fontSize: "0.9rem", color: auto.color, lineHeight: 1.1 }}>{auto.texto}</div>
                            <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: ".02em", color: auto.color, textTransform: "uppercase" }}>{auto.interp}</div>
                          </>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>—</span>
                        )}
                      </td>;
                    }
                    return <td key={c.key} style={{ padding: 2 }}>
                      <input className="form-control form-control-sm border-0" style={zInp} disabled={firmada}
                        value={d[k] || ""} onChange={e => set(k, e.target.value)} />
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span><i className="bi bi-info-circle me-1" />Z-score automático — nomograma de <strong>Detroit (Pettersen 2008)</strong>, según la S.C. (Mosteller) de Signos Vitales. BSA ≤ 2.0 m².</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#dcfce7", border: "1px solid #86efac" }} /> Normal (|Z| &lt; 1.6)</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#fef3c7", border: "1px solid #fcd34d" }} /> Límite (1.6–2)</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#fee2e2", border: "1px solid #fca5a5" }} /> Dilatado / Hipoplásico (|Z| ≥ 2)</span>
        </div>
        <div className="row g-2 mt-1">
          {ECO_DOPPLER.map(dp => (
            <div key={dp.key} className="col-6 col-md-4 col-lg-2">
              <label className="form-label mb-1" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280" }}>{dp.label}</label>
              <input className="form-control form-control-sm" style={inp} disabled={firmada}
                value={d[dp.key] || ""} onChange={e => set(dp.key, e.target.value)} />
            </div>
          ))}
        </div>
      </EcoSection>

      {/* Función ventricular */}
      <EcoSection id="funcion" title="Función ventricular" icon="bi-activity" open={openSecs.funcion} toggle={toggle}>
        <div className="row g-2">
          {ECO_FUNCION.map(f => (
            <div key={f.key} className="col-6 col-md-4 col-lg-2">
              <label className="form-label mb-1" style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280" }}>{f.label} <span style={{ color: "#9ca3af" }}>{f.unit}</span></label>
              <input className="form-control form-control-sm" style={inp} disabled={firmada}
                value={d[f.key] || ""} onChange={e => set(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </EcoSection>

      {/* Detalles ECOTT */}
      <EcoSection id="ecott" title="Detalles ECOTT" icon="bi-card-list" open={openSecs.ecott} toggle={toggle}>
        <div className="row g-3">
          {ECO_ECOTT.map(f => (
            <div key={f.key} className="col-md-6">
              <label className="form-label mb-1" style={{ fontSize: "0.76rem", fontWeight: 600, color: "#374151" }}>{f.label}</label>
              <AutoTextarea style={inp} disabled={firmada}
                value={d[f.key]} onChange={e => set(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </EcoSection>

      {/* Conclusiones */}
      <EcoSection id="conclusiones" title="Conclusiones" icon="bi-clipboard-check" open={openSecs.conclusiones} toggle={toggle}>
        <textarea className="form-control form-control-sm" rows={5} style={{ ...inp, resize: "vertical" }} disabled={firmada}
          value={d.conclusiones || ""} onChange={e => set("conclusiones", e.target.value)} />
      </EcoSection>
    </div>
  );
}

// ─── Vista imprimible del ecocardiograma ─────────────────────────────
export function PrintEco({ datos, vitals, paciente, user, onClose }) {
  const [logoUrl, setLogoUrl] = useState("");
  const d = datos || {};

  useEffect(() => {
    if (!user?.clinica_id) return;
    api.get(`/clinicas/${user.clinica_id}/plantillas/receta`).then(r => {
      const c = r.data?.data?.contenido;
      if (!c) return;
      try { setLogoUrl(JSON.parse(c).logo_url || ""); } catch { /* plantilla sin JSON */ }
    }).catch(() => {});
  }, [user?.clinica_id]);

  const nombrePac = paciente ? `${paciente.nombres || ""} ${paciente.apellidos || ""}`.trim() : "";
  const sexo = paciente?.sexo || "";

  const cell = { border: "1px solid #333", padding: "3px 6px", fontSize: 10.5 };
  const th = { ...cell, background: "#f0f0f0", fontWeight: 700, textAlign: "center" };
  const secTitle = { fontSize: 11, fontWeight: 700, textAlign: "center", margin: "12px 0 5px", textTransform: "uppercase", letterSpacing: ".04em" };
  const line = (label, val) => (
    <div style={{ display: "flex", gap: 6, borderBottom: "1px solid #999", padding: "2px 0", fontSize: 10.5 }}>
      <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{label}:</span>
      <span style={{ flex: 1 }}>{val || ""}</span>
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #eco-print-doc, #eco-print-doc * { visibility: visible !important; }
          #eco-print-doc { position:fixed!important; top:0!important; left:0!important; width:100%!important; padding:12mm 14mm!important; box-shadow:none!important; background:#fff!important; }
          #eco-print-doc * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
          #eco-print-bar { display:none!important; }
          @page { margin:0; size:letter; }
        }
      `}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: "#e8e8e8", overflowY: "auto" }}>
        <div id="eco-print-bar" style={{ background: "#fff", borderBottom: "1px solid #ddd", padding: "12px 24px", display: "flex", gap: 10 }}>
          <button onClick={() => window.print()} style={{ padding: "9px 22px", background: "#be123c", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
            <i className="bi bi-printer-fill me-1" /> Imprimir / Guardar PDF
          </button>
          <button onClick={onClose} style={{ padding: "9px 22px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 9, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
            <i className="bi bi-x-lg me-1" /> Cerrar
          </button>
        </div>

        <div style={{ padding: "24px 16px", display: "flex", justifyContent: "center" }}>
          <div id="eco-print-doc" style={{ background: "#fff", width: "100%", maxWidth: "216mm", minHeight: "279mm", padding: "14mm 16mm", boxShadow: "0 4px 32px rgba(0,0,0,.18)", fontFamily: "Arial, sans-serif", color: "#1a1a1a", boxSizing: "border-box" }}>
            {/* Encabezado */}
            <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: 8, marginBottom: 10 }}>
              {logoUrl && <img src={logoUrl} alt="" style={{ maxHeight: 70, objectFit: "contain", marginBottom: 4 }} />}
              <div style={{ fontSize: 16, fontWeight: 800 }}>{user?.clinica_nombre || "Cardiología"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>ECOCARDIOGRAMA</div>
            </div>

            {/* Datos paciente */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px 16px", marginBottom: 8 }}>
              {line("Paciente", nombrePac)}
              {line("Sexo", sexo)}
              {line("Fecha", d.fecha ? dayjs(d.fecha).format("DD/MM/YYYY") : dayjs().format("DD/MM/YYYY"))}
              {line("Peso (kg)", vitals?.peso)}
              {line("Talla (cm)", vitals?.talla)}
              {line("S.C. (m²)", vitals?.sc)}
              {line("Edad", edadTexto(paciente?.fecha_nacimiento))}
              {line("Motivo", d.motivo)}
            </div>

            {/* Segmentario */}
            <div style={secTitle}>Análisis segmentario</div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
              {ECO_SEGMENTARIO.map(r => (
                <tr key={r.key}>
                  <td style={{ ...cell, fontWeight: 700, width: "34%" }}>{r.label}</td>
                  <td style={cell}>{d[r.key] || ""}{r.detalle && d[r.detalle] ? ` — ${d[r.detalle]}` : ""}</td>
                </tr>
              ))}
            </tbody></table>

            {/* Conexiones */}
            <div style={secTitle}>Conexiones</div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
              {ECO_CONEXIONES.map(r => (
                <tr key={r.key}>
                  <td style={{ ...cell, fontWeight: 700, width: "34%" }}>{r.label}</td>
                  <td style={cell}>{d[r.key] || ""}{d[`${r.key}_obs`] ? ` — ${d[`${r.key}_obs`]}` : ""}</td>
                </tr>
              ))}
            </tbody></table>

            {/* Parámetros */}
            <div style={secTitle}>Parámetros ecocardiográficos ({d.param_unidad || "mm"} / Valor Z)</div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={th}></th>{ECO_PARAM_COLS.map(c => <th key={c.key} style={th}>{c.label}{c.key.endsWith("_z") ? "" : ` (${d.param_unidad || "mm"})`}</th>)}</tr></thead>
              <tbody>
                {ECO_PARAM_ROWS.map(r => (
                  <tr key={r}>
                    <td style={{ ...cell, fontWeight: 700 }}>{r}</td>
                    {ECO_PARAM_COLS.map(c => {
                      const k = `p_${r}_${c.key}`.replace(/\s+/g, "_");
                      const isZ = c.key.endsWith("_z");
                      const baseCol = isZ ? c.key.slice(0, -2) : null;
                      const struct = isZ ? ECO_ZMAP[`${r}|${baseCol}`] : null;
                      const auto = struct
                        ? zscoreDetroit(struct, ecoToMm(d[`p_${r}_${baseCol}`.replace(/\s+/g, "_")], d.param_unidad || "mm"), vitals?.sc)
                        : null;
                      if (isZ && auto) {
                        return <td key={c.key} style={{ ...cell, textAlign: "center", background: auto.bg, color: auto.color, fontWeight: 700 }}>
                          {auto.texto}<br /><span style={{ fontSize: 8.5 }}>{auto.interp}</span>
                        </td>;
                      }
                      return <td key={c.key} style={{ ...cell, textAlign: "center" }}>{d[k] || ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px", marginTop: 6 }}>
              {ECO_DOPPLER.map(dp => <div key={dp.key} style={{ width: "30%" }}>{line(dp.label, d[dp.key])}</div>)}
            </div>

            {/* Función */}
            <div style={secTitle}>Función ventricular</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 16px" }}>
              {ECO_FUNCION.map(f => <div key={f.key} style={{ width: "30%" }}>{line(`${f.label} (${f.unit})`, d[f.key])}</div>)}
            </div>

            {/* ECOTT */}
            <div style={secTitle}>Detalles ECOTT</div>
            {ECO_ECOTT.map(f => line(f.label, d[f.key]))}

            {/* Conclusiones */}
            <div style={secTitle}>Conclusiones</div>
            <div style={{ minHeight: 60, whiteSpace: "pre-wrap", fontSize: 10.5, border: "1px solid #999", padding: 6 }}>{d.conclusiones || ""}</div>

            {/* Firma */}
            <div style={{ marginTop: 40, textAlign: "center", fontSize: 10.5 }}>
              <div style={{ borderTop: "1px solid #333", width: 240, margin: "0 auto", paddingTop: 3 }}>
                {nombreMedico(user)} {user?.numero_colegiatura ? `— Col. ${user.numero_colegiatura}` : ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
