/**
 * Portal del paciente — «Mi estética»: próximos controles y mantenimientos,
 * paquetes de sesiones con su saldo, presupuestos (PDF), procedimientos con sus
 * indicaciones y consentimientos (los pendientes se firman desde aquí).
 * Usa las clases pp-* que define PortalPaciente.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { portalApi } from "./portalApi";
import { descargarBlob, compartirEnTelefono, imprimirHtml } from "../../utils/descargarPdf";
import { nombreZona } from "../../utils/esteticaCatalogos";

const ROSA = "#db2777";
const L = (n) => `L ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (v, conDia = false) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("es", { ...(conDia ? { weekday: "long" } : {}), day: "numeric", month: "long", year: "numeric" }) : "");
const mayus = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const hora12 = (h) => { if (!h) return ""; const [H, M] = String(h).split(":").map(Number); return `${((H + 11) % 12) + 1}:${String(M || 0).padStart(2, "0")} ${H < 12 ? "a. m." : "p. m."}`; };

function Titulo({ icono, children }) {
  return <div className="fw-bold mb-2 mt-3" style={{ color: "#0f172a", fontSize: 15 }}><i className={`bi ${icono} me-2`} style={{ color: ROSA }} />{children}</div>;
}

function Presupuesto({ p }) {
  const [bajando, setBajando] = useState(false);
  const pdf = async () => {
    setBajando(true);
    try {
      const r = await portalApi.get(`/estetica/presupuesto/${p.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "application/pdf" });
      if (!(await compartirEnTelefono(blob, "mi_presupuesto.pdf"))) descargarBlob(blob, "mi_presupuesto.pdf");
    } catch {
      const h = await portalApi.get(`/estetica/presupuesto/${p.id}/pdf?formato=html`, { responseType: "text" }).catch(() => null);
      if (h) imprimirHtml(h.data); else alert("No se pudo descargar el presupuesto.");
    }
    setBajando(false);
  };
  const saldo = p.pago ? Math.max(p.pago.total - p.pago.pagado, 0) : null;
  return (
    <div className="pp-card">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div style={{ minWidth: 0 }}>
          <div className="fw-bold">{p.titulo || p.procedimientos.map((x) => x.nombre).join(" + ") || "Presupuesto"}</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{fecha(p.fecha)}</div>
        </div>
        <div className="text-end">
          <div className="fw-bold" style={{ color: ROSA, fontSize: 17 }}>{L(p.total)}</div>
          {p.pago && (saldo > 0
            ? <span className="pp-chip" style={{ background: "#fef3c7", color: "#b45309" }}>Pagado {L(p.pago.pagado)} · saldo {L(saldo)}</span>
            : <span className="pp-chip" style={{ background: "#dcfce7", color: "#15803d" }}>Pagado</span>)}
        </div>
      </div>
      <div className="mt-2">
        {p.procedimientos.map((x) => (
          <div key={x.nombre} className="d-flex justify-content-between gap-2" style={{ fontSize: 14, padding: "3px 0" }}>
            <span>{x.nombre}{x.sesiones > 1 ? ` · ${x.sesiones} sesiones` : ""}</span><span style={{ color: "#64748b" }}>{L(x.precio)}</span>
          </div>
        ))}
      </div>
      <button className="pp-btn sec mt-2" style={{ padding: "6px 12px", fontSize: 13 }} onClick={pdf} disabled={bajando}>
        {bajando ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-file-earmark-pdf" />}Descargar PDF
      </button>
    </div>
  );
}

function Procedimiento({ x }) {
  const [abierto, setAbierto] = useState(false);
  const zonas = [...x.zonas.map(nombreZona), ...x.zonas_cuerpo];
  const lineas = String(x.indicaciones || "").split(/\n+/).map((t) => t.trim()).filter(Boolean);
  return (
    <div className="pp-card">
      <button type="button" className="d-flex align-items-center gap-2 w-100 p-0 border-0 bg-transparent text-start" onClick={() => setAbierto((a) => !a)}>
        <i className="bi bi-magic" style={{ color: ROSA }} />
        <span className="flex-grow-1" style={{ minWidth: 0 }}>
          <span className="fw-bold d-block">{x.nombre}</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>{fecha(x.fecha)}{zonas.length ? ` · ${zonas.join(", ")}` : ""}</span>
        </span>
        {lineas.length > 0 && <i className={`bi bi-chevron-${abierto ? "up" : "down"}`} style={{ color: "#64748b" }} />}
      </button>
      {abierto && lineas.length > 0 && (
        <div className="mt-2">
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Sus indicaciones</div>
          {lineas.map((l, i) => <div key={i} style={{ fontSize: 14, padding: "3px 0" }}><i className="bi bi-check2-circle me-2" style={{ color: ROSA }} />{l.replace(/^[-•*]\s*/, "")}</div>)}
        </div>
      )}
    </div>
  );
}

export default function PortalEstetica({ data }) {
  const navigate = useNavigate();
  const [abriendo, setAbriendo] = useState(null);
  const firmar = async (c) => {
    setAbriendo(c.id);
    try {
      const r = await portalApi.post(`/estetica/consentimiento/${c.id}/firmar`, {});
      navigate(r.data.data.ruta);
    } catch (e) {
      alert(e.response?.data?.msg || "No se pudo abrir el consentimiento.");
      setAbriendo(null);
    }
  };

  return (
    <div>
      {data.perfiles.map((pf) => {
        const pendientes = pf.consentimientos.filter((c) => !c.firmado);
        const paquetes = pf.presupuestos.flatMap((p) => p.procedimientos.filter((x) => x.sesiones > 1).map((x) => ({ ...x, pago: p.pago })));
        return (
          <div key={pf.paciente_id}>
            {data.perfiles.length > 1 && <div className="fw-bold mt-2" style={{ color: "#0f172a" }}>{pf.nombre} · {pf.clinica}</div>}

            {pendientes.length > 0 && (
              <div className="pp-card" style={{ borderColor: "#fbcfe8", background: "#fdf2f8" }}>
                <div className="fw-bold mb-1" style={{ color: "#9d174d" }}><i className="bi bi-pen me-2" />Tiene {pendientes.length === 1 ? "un consentimiento" : `${pendientes.length} consentimientos`} por firmar</div>
                {pendientes.map((c) => (
                  <div key={c.id} className="d-flex align-items-center justify-content-between gap-2 mt-2 flex-wrap">
                    <span style={{ fontSize: 14 }}>{c.procedimiento}</span>
                    <button className="pp-btn" style={{ background: ROSA, padding: "6px 14px", fontSize: 13 }} disabled={abriendo === c.id} onClick={() => firmar(c)}>
                      {abriendo === c.id ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-pen" />}Leer y firmar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {pf.proximos.length > 0 && (
              <>
                <Titulo icono="bi-calendar-heart">Próximamente</Titulo>
                {pf.proximos.map((x, i) => (
                  <div key={i} className="pp-card d-flex align-items-center gap-3" style={{ padding: "12px 14px" }}>
                    <i className={`bi ${x.tipo === "mantenimiento" ? "bi-arrow-repeat" : "bi-calendar-check"}`} style={{ fontSize: 22, color: x.tipo === "mantenimiento" ? "#0369a1" : "#7c3aed" }} />
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-bold" style={{ fontSize: 14 }}>{x.texto}</div>
                      <div style={{ fontSize: 13, color: "#64748b" }}>
                        {x.tipo === "mantenimiento" ? `Alrededor del ${fecha(x.fecha, true)}` : mayus(fecha(x.fecha, true))}{x.hora ? `, ${hora12(x.hora)}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {paquetes.length > 0 && (
              <>
                <Titulo icono="bi-collection">Mis paquetes</Titulo>
                {paquetes.map((x, i) => (
                  <div key={i} className="pp-card" style={{ padding: "12px 14px" }}>
                    <div className="d-flex justify-content-between gap-2 flex-wrap">
                      <span className="fw-bold">{x.nombre}</span>
                      <span style={{ fontSize: 13, color: "#6d28d9", fontWeight: 700 }}>{x.usadas} de {x.sesiones} sesiones · quedan {Math.max(x.sesiones - x.usadas, 0)}</span>
                    </div>
                    <div style={{ height: 8, background: "#ede9fe", borderRadius: 99, overflow: "hidden", marginTop: 8 }}>
                      <div style={{ width: `${Math.min(100, (x.usadas / x.sesiones) * 100)}%`, height: "100%", background: "#7c3aed" }} />
                    </div>
                  </div>
                ))}
              </>
            )}

            {pf.presupuestos.length > 0 && (
              <>
                <Titulo icono="bi-receipt">Mis presupuestos</Titulo>
                {pf.presupuestos.map((p) => <Presupuesto key={p.id} p={p} />)}
              </>
            )}

            {pf.procedimientos.length > 0 && (
              <>
                <Titulo icono="bi-stars">Mis procedimientos</Titulo>
                {pf.procedimientos.map((x) => <Procedimiento key={x.id} x={x} />)}
              </>
            )}

            {pf.consentimientos.some((c) => c.firmado) && (
              <>
                <Titulo icono="bi-file-earmark-check">Consentimientos firmados</Titulo>
                <div className="pp-card" style={{ padding: "10px 14px" }}>
                  {pf.consentimientos.filter((c) => c.firmado).map((c) => (
                    <div key={c.id} className="d-flex justify-content-between gap-2 flex-wrap" style={{ fontSize: 14, padding: "4px 0" }}>
                      <span><i className="bi bi-check-circle-fill me-2" style={{ color: "#16a34a" }} />{c.procedimiento}</span>
                      <span style={{ color: "#64748b" }}>{fecha(c.firmado_en || c.fecha)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
