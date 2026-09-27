import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { dinero, subtotalFase, totalPlan, fechaVigencia } from "./presupuesto.js";

const COLOR = "#e65100";

/**
 * Presupuesto odontológico imprimible, armado con el plan de tratamiento guardado.
 * Solo muestra datos ya registrados: no agrega cláusulas legales ni de consentimiento.
 */
export default function PresupuestoPrint({ paciente, plan, dentista, clinicaId, clinicaNombreInicial = "", onClose }) {
  const [incluirRealizados, setIncluirRealizados] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [clinicaNombre, setClinicaNombre] = useState(clinicaNombreInicial);
  const [colegiatura, setColegiatura] = useState("");

  useEffect(() => {
    if (clinicaId) {
      api.get(`/clinicas/${clinicaId}/plantillas/receta`).then((r) => {
        try { setLogoUrl(JSON.parse(r.data?.data?.contenido || "{}").logo_url || ""); } catch { /* sin formato JSON */ }
      }).catch(() => {});
    }
    api.get("/auth/me").then((r) => setColegiatura(r.data?.data?.numero_colegiatura || r.data?.numero_colegiatura || "")).catch(() => {});
    api.get("/clinicas").then((r) => {
      const lista = r.data?.data || [];
      setClinicaNombre((Array.isArray(lista) ? lista[0] : null)?.nombre || clinicaNombreInicial);
    }).catch(() => {});
  }, [clinicaId, clinicaNombreInicial]);

  const opciones = { soloPendientes: !incluirRealizados };
  const fases = (plan.fases || [])
    .map((f) => ({ ...f, items: (f.items || []).filter((i) => incluirRealizados || !i.completado) }))
    .filter((f) => f.items.length > 0);
  const total = totalPlan(plan.fases, opciones);
  const hoy = new Date();
  const hasta = fechaVigencia(plan.vigencia_dias, hoy);
  const edad = paciente?.fecha_nacimiento ? `${dayjs().diff(dayjs(paciente.fecha_nacimiento), "year")} años` : "";

  const th = { textAlign: "left", padding: "6px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: "#475569", borderBottom: "2px solid #cbd5e1" };
  const td = { padding: "7px 8px", fontSize: 12.5, borderBottom: "1px solid #e2e8f0", verticalAlign: "top" };

  return createPortal(
    <div id="odo-print-root" style={{ position: "fixed", inset: 0, zIndex: 9500, background: "#e2e8f0", overflow: "auto" }}>
      <style>{`
        @page { size: letter; margin: 14mm; }
        @media print {
          body > *:not(#odo-print-root) { display: none !important; }
          #odo-print-root { position: static !important; overflow: visible !important; background: #fff !important; }
          .no-print { display: none !important; }
          .odo-hoja { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
          .odo-fase { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print" style={{
        position: "sticky", top: 0, zIndex: 1, background: "#0f172a", padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <button onClick={onClose} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          <i className="bi bi-arrow-left me-1" /> Volver
        </button>
        <button onClick={() => window.print()} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#f97316", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          <i className="bi bi-printer me-1" /> Imprimir / Guardar PDF
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 7, color: "#e2e8f0", fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={incluirRealizados} onChange={(e) => setIncluirRealizados(e.target.checked)} />
          Incluir procedimientos ya realizados
        </label>
      </div>

      <div className="odo-hoja" style={{ background: "#fff", maxWidth: 800, margin: "20px auto", padding: "32px 40px", boxShadow: "0 6px 30px rgba(15,23,42,.18)", color: "#0f172a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: `3px solid ${COLOR}`, paddingBottom: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {logoUrl && <img src={logoUrl} alt="" style={{ height: 56, objectFit: "contain" }} />}
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{clinicaNombre || "Clínica odontológica"}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Presupuesto de tratamiento odontológico</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#475569" }}>
            <div><strong>Fecha:</strong> {dayjs(hoy).format("DD/MM/YYYY")}</div>
            <div><strong>Válido hasta:</strong> {dayjs(hasta).format("DD/MM/YYYY")}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 13 }}>
          <div><span style={{ color: "#64748b" }}>Paciente: </span><strong>{paciente?.nombres} {paciente?.apellidos}</strong></div>
          <div><span style={{ color: "#64748b" }}>DNI: </span>{paciente?.dni || "—"}{edad ? ` · ${edad}` : ""}</div>
          <div><span style={{ color: "#64748b" }}>Odontólogo/a: </span>{dentista || "—"}</div>
          <div><span style={{ color: "#64748b" }}>Colegiatura: </span>{colegiatura || "—"}</div>
        </div>

        {fases.length === 0 && (
          <div style={{ textAlign: "center", color: "#64748b", padding: "30px 0", fontSize: 13 }}>
            No hay procedimientos {incluirRealizados ? "" : "pendientes "}en el plan de tratamiento.
          </div>
        )}

        {fases.map((f) => (
          <div key={f.id} className="odo-fase" style={{ marginBottom: 18 }}>
            <div style={{ background: COLOR, color: "#fff", padding: "7px 12px", borderRadius: "6px 6px 0 0", fontWeight: 700, fontSize: 13 }}>
              {f.nombre}
              {f.objetivo && <div style={{ fontWeight: 400, fontSize: 11.5, opacity: 0.9 }}>{f.objetivo}</div>}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0", borderTop: "none" }}>
              <thead>
                <tr><th style={{ ...th, width: 70 }}>Pieza</th><th style={th}>Procedimiento</th><th style={{ ...th, width: 140 }}>Material</th><th style={{ ...th, width: 110, textAlign: "right" }}>Inversión</th></tr>
              </thead>
              <tbody>
                {f.items.map((it) => (
                  <tr key={it.id}>
                    <td style={td}>{it.pieza || "—"}</td>
                    <td style={td}>{it.procedimiento}{it.completado ? <span style={{ color: "#16a34a", fontSize: 11 }}> · realizado</span> : ""}</td>
                    <td style={td}>{it.material || "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{dinero(it.costo_estimado)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3} style={{ ...td, textAlign: "right", fontWeight: 700 }}>Subtotal {(f.nombre || "").split(":")[0]}</td><td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{dinero(subtotalFase(f))}</td></tr>
              </tfoot>
            </table>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
          <div style={{ minWidth: 260, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 16px", textAlign: "right" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#7c4a03", fontWeight: 700 }}>Inversión total</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: COLOR }}>{dinero(total)}</div>
          </div>
        </div>

        <div style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 26 }}>
          <div><strong>Formas de pago:</strong> {plan.formas_pago || "—"}</div>
          <div><strong>Vigencia:</strong> {plan.vigencia_dias} días desde la fecha de emisión.</div>
          {plan.nota_clinica && <div style={{ color: "#475569", marginTop: 4 }}><strong>Nota:</strong> {plan.nota_clinica}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 44 }}>
          {[["Odontólogo/a", dentista], ["Paciente o responsable", ""]].map(([rol, nombre]) => (
            <div key={rol} style={{ textAlign: "center" }}>
              <div style={{ borderTop: "1px solid #0f172a", paddingTop: 6, fontSize: 12 }}>
                <strong>{rol}</strong>{nombre ? <div style={{ color: "#475569" }}>{nombre}</div> : null}
                <div style={{ color: "#94a3b8", marginTop: 4 }}>Fecha: ____ / ____ / ________</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
