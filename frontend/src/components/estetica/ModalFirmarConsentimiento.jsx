import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import FirmaPad from "../FirmaPad";
import { actualizarEstetica } from "../../utils/esteticaDatos";

/**
 * El paciente lee el consentimiento y firma con el dedo en el teléfono o la tablet.
 * También permite dejarlo como «firmado en papel» (como se hacía antes).
 */
export default function ModalFirmarConsentimiento({ consentimiento: c, onClose, onFirmado }) {
  const [firma, setFirma] = useState(null);
  const [leido, setLeido] = useState(false);
  const [nombre, setNombre] = useState(c.paciente_nombre && c.paciente_nombre !== "—" ? c.paciente_nombre : "");
  const [relacion, setRelacion] = useState("Paciente");
  const [guardando, setGuardando] = useState(false);
  const alCambiar = useCallback((v) => setFirma(v), []);

  const guardar = async (enPapel) => {
    setGuardando(true);
    try {
      const nuevo = await actualizarEstetica(c.id, {
        ...c, firmado: true, firmado_en: new Date().toISOString(),
        firma_papel: !!enPapel,
        firma_paciente: enPapel ? null : firma,
        firmante_nombre: enPapel ? (c.firmante_nombre || null) : nombre.trim(),
        firmante_relacion: enPapel ? null : relacion,
      });
      onFirmado?.(nuevo);
    } catch (e) {
      alert(e.response?.data?.msg || "No se pudo guardar la firma. Intente de nuevo.");
    }
    setGuardando(false);
  };

  const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem" };
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1080, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "94vh", overflowY: "auto", padding: 18 }}>
        <div className="d-flex align-items-center mb-2">
          <h6 className="mb-0" style={{ fontWeight: 800, color: "#be185d" }}><i className="bi bi-pen me-2" />Firma del consentimiento</h6>
          <button type="button" className="btn-close ms-auto" aria-label="Cerrar" onClick={onClose} />
        </div>
        <div className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>
          <strong>{c.procedimiento}</strong> · {c.paciente_nombre}
        </div>
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, fontSize: "0.86rem", maxHeight: 220, overflowY: "auto", whiteSpace: "pre-wrap" }}>
          {c.contenido || "Sin texto."}
          {(c.riesgos || []).length > 0 && <div className="mt-2"><strong>Riesgos:</strong> {c.riesgos.join(", ")}.</div>}
        </div>
        <label className="d-flex align-items-start gap-2 my-3" style={{ fontSize: "0.9rem", cursor: "pointer" }}>
          <input type="checkbox" className="form-check-input mt-1" checked={leido} onChange={(e) => setLeido(e.target.checked)} />
          <span>Leí este documento, me explicaron el procedimiento y sus riesgos, y pude hacer preguntas.</span>
        </label>
        <div className="d-flex gap-2 mb-2 flex-wrap">
          <div style={{ flex: "2 1 220px" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 700 }}>Nombre de quien firma</label>
            <input style={inp} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <label style={{ fontSize: "0.78rem", fontWeight: 700 }}>Firma como</label>
            <select style={inp} value={relacion} onChange={(e) => setRelacion(e.target.value)}>
              <option>Paciente</option><option>Padre, madre o tutor</option><option>Representante legal</option>
            </select>
          </div>
        </div>
        <FirmaPad onChange={alCambiar} />
        <div className="d-flex align-items-center gap-2 mt-3 flex-wrap">
          <button type="button" className="btn btn-link btn-sm text-muted p-0" disabled={guardando}
            onClick={() => { if (window.confirm("¿Marcar como firmado en papel (sin firma en pantalla)?")) guardar(true); }}>
            Se firmó en papel
          </button>
          <button type="button" className="btn ms-auto" style={{ background: "#db2777", color: "#fff", fontWeight: 700 }}
            disabled={guardando || !firma || !leido || !nombre.trim()} onClick={() => guardar(false)}>
            {guardando ? "Guardando…" : "Firmar consentimiento"}
          </button>
        </div>
        {(!leido || !firma) && (
          <div className="text-muted mt-1 text-end" style={{ fontSize: "0.75rem" }}>
            {!leido ? "Marque la casilla de lectura" : "Falta la firma"} para continuar.
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
