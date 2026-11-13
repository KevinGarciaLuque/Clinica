import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * Envía al paciente un enlace personal (firma del consentimiento o indicaciones):
 * por correo (si tiene) y/o por WhatsApp desde el teléfono de la clínica.
 * crear(enviarCorreo) → { url, dias, correo_enviado, tiene_email, telefono, whatsapp_texto }
 */
const waNumero = (tel) => {
  const d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  return d.length === 8 ? `504${d}` : d; // números de Honduras sin código de país
};

export default function ModalEnviarPaciente({ titulo, descripcion, crear, onClose, onEnviado }) {
  const [porCorreo, setPorCorreo] = useState(true);
  const [creando, setCreando] = useState(false);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  const generar = async () => {
    setCreando(true); setError("");
    try {
      const d = await crear(porCorreo);
      setInfo(d);
      onEnviado?.(d);
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo crear el enlace.");
    }
    setCreando(false);
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(info.url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { window.prompt("Copie el enlace:", info.url); }
  };
  const wa = info ? `https://wa.me/${waNumero(info.telefono)}?text=${encodeURIComponent(info.whatsapp_texto)}` : "";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1085, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div className="d-flex align-items-center mb-2">
          <h6 className="mb-0" style={{ fontWeight: 800, color: "#be185d" }}><i className="bi bi-send me-2" />{titulo}</h6>
          <button type="button" className="btn-close ms-auto" aria-label="Cerrar" onClick={onClose} />
        </div>
        {!info ? (
          <>
            <p className="text-muted" style={{ fontSize: "0.88rem" }}>{descripcion}</p>
            <label className="d-flex align-items-center gap-2 mb-3" style={{ fontSize: "0.9rem", cursor: "pointer" }}>
              <input type="checkbox" className="form-check-input m-0" checked={porCorreo} onChange={(e) => setPorCorreo(e.target.checked)} />
              Enviar también por correo (si el paciente tiene)
            </label>
            {error && <div className="alert alert-danger py-2" style={{ fontSize: "0.88rem" }}>{error}</div>}
            <button type="button" className="btn w-100" style={{ background: "#db2777", color: "#fff", fontWeight: 700 }} disabled={creando} onClick={generar}>
              {creando ? "Preparando…" : "Crear enlace para el paciente"}
            </button>
          </>
        ) : (
          <>
            <div className="mb-3" style={{ fontSize: "0.88rem" }}>
              {info.correo_enviado
                ? <div style={{ color: "#15803d" }}><i className="bi bi-envelope-check me-1" />Se envió por correo.</div>
                : <div className="text-muted"><i className="bi bi-envelope-x me-1" />{info.tiene_email ? "No se pudo enviar el correo." : "El paciente no tiene correo registrado."}</div>}
              <div className="text-muted mt-1">El enlace es personal y vence en {info.dias} días.</div>
            </div>
            <a className="btn w-100 mb-2" href={wa} target="_blank" rel="noreferrer" style={{ background: "#16a34a", color: "#fff", fontWeight: 700 }}>
              <i className="bi bi-whatsapp me-1" />Enviar por WhatsApp{info.telefono ? ` (${info.telefono})` : ""}
            </a>
            <button type="button" className="btn btn-outline-secondary w-100" onClick={copiar}>
              <i className={`bi ${copiado ? "bi-check2" : "bi-clipboard"} me-1`} />{copiado ? "Enlace copiado" : "Copiar enlace"}
            </button>
            <div className="text-muted mt-2" style={{ fontSize: "0.72rem", wordBreak: "break-all" }}>{info.url}</div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
