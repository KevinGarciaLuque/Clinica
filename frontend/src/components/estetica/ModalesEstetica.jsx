import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { crearEstetica } from "../../utils/esteticaDatos";
import { PLANTILLAS_CONSENTIMIENTO, PROCEDIMIENTOS_COMUNES } from "../../utils/esteticaCatalogos";

/**
 * Ventanas de Estética que se usan desde la consulta y desde el perfil del paciente:
 * presupuesto rápido y consentimiento informado (con «Firmar ahora» / «Enviar para firmar»).
 */
const ROSA = "#db2777";
const inp = { width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.88rem", background: "#fff" };
const Lbl = ({ children }) => <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#374151", marginBottom: 4 }}>{children}</label>;

export function Modal({ titulo, icono, children, onClose }) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 1060, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div className="d-flex align-items-center mb-3">
          <h6 className="mb-0" style={{ fontWeight: 800, color: ROSA }}><i className={`bi ${icono} me-2`} />{titulo}</h6>
          <button type="button" className="btn-close ms-auto" aria-label="Cerrar" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

const nombrePac = (p) => [p?.nombres, p?.apellidos].filter(Boolean).join(" ") || "—";

export function ModalPresupuesto({ paciente, pacienteId, sugeridos, onClose, textoVolver = "Volver a la consulta" }) {
  const [items, setItems] = useState(() => (sugeridos.length ? sugeridos : [""]).map((n) => ({ nombre: n, precio: "" })));
  const [validez, setValidez] = useState("30");
  const [obs, setObs] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);
  const total = items.reduce((s, i) => s + (parseFloat(i.precio) || 0), 0);
  const guardar = async () => {
    setGuardando(true);
    try {
      await crearEstetica("presupuesto", pacienteId, {
        paciente_id: String(pacienteId), titulo: items.map((i) => i.nombre).filter(Boolean).join(" + "),
        procedimientos: items.filter((i) => i.nombre), observaciones: obs, validez_dias: validez, estado: "BORRADOR",
        paciente_nombre: nombrePac(paciente), total, creado_en: new Date().toISOString(),
      });
      setListo(true);
    } catch (e) { alert(e.response?.data?.msg || "No se pudo guardar el presupuesto."); }
    setGuardando(false);
  };
  return (
    <Modal titulo="Nuevo presupuesto" icono="bi-receipt" onClose={onClose}>
      {listo ? (
        <div className="text-center py-3">
          <i className="bi bi-check-circle-fill" style={{ fontSize: "2.2rem", color: "#16a34a" }} />
          <div className="fw-bold mt-2">Presupuesto guardado</div>
          <div className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>Puede enviarlo o cambiar su estado en Presupuestos.</div>
          <div className="d-flex gap-2 justify-content-center">
            <Link to="/estetica/presupuestos" target="_blank" className="btn btn-sm btn-outline-secondary">Abrir Presupuestos</Link>
            <button type="button" className="btn btn-sm" style={{ background: ROSA, color: "#fff" }} onClick={onClose}>{textoVolver}</button>
          </div>
        </div>
      ) : (
        <>
          {items.map((it, i) => (
            <div key={i} className="d-flex gap-2 mb-2">
              <input list="et-procs-modal" style={{ ...inp, flex: 2 }} placeholder="Procedimiento" value={it.nombre}
                onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
              <input style={{ ...inp, flex: 1 }} placeholder="Precio L" inputMode="decimal" value={it.precio}
                onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)))} />
              <input style={{ ...inp, width: 78, flex: "0 0 78px" }} placeholder="Sesiones" inputMode="numeric" value={it.sesiones || ""}
                title="Si es un paquete, cuántas sesiones incluye"
                onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, sesiones: e.target.value.replace(/\D/g, "") } : x)))} />
              <button type="button" className="btn btn-sm btn-light" onClick={() => setItems((l) => l.filter((_, j) => j !== i))}><i className="bi bi-x-lg" /></button>
            </div>
          ))}
          <datalist id="et-procs-modal">{PROCEDIMIENTOS_COMUNES.map((p) => <option key={p.nombre} value={p.nombre} />)}</datalist>
          <button type="button" className="btn btn-sm btn-link p-0 mb-3" style={{ color: ROSA, fontWeight: 700 }} onClick={() => setItems((l) => [...l, { nombre: "", precio: "" }])}>
            <i className="bi bi-plus-circle me-1" />Agregar procedimiento
          </button>
          <div className="d-flex gap-2 mb-2">
            <div style={{ width: 130 }}><Lbl>Válido por (días)</Lbl><input style={inp} inputMode="numeric" value={validez} onChange={(e) => setValidez(e.target.value)} /></div>
            <div style={{ flex: 1 }}><Lbl>Observaciones</Lbl><input style={inp} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          </div>
          <div className="d-flex align-items-center mt-3">
            <strong>Total: L {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
            <button type="button" className="btn ms-auto" style={{ background: ROSA, color: "#fff", fontWeight: 700 }}
              disabled={guardando || !items.some((i) => i.nombre)} onClick={guardar}>
              {guardando ? "Guardando…" : "Guardar presupuesto"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function ModalConsentimiento({ paciente, pacienteId, procedimiento, onClose, onFirmar, onEnviar }) {
  const sugerida = PLANTILLAS_CONSENTIMIENTO.find((p) => procedimiento && String(procedimiento).toLowerCase().includes(p.procedimiento.toLowerCase().slice(0, 6)));
  const [plantillaId, setPlantillaId] = useState(sugerida ? String(sugerida.id) : "");
  const [otro, setOtro] = useState(sugerida ? "" : (procedimiento || ""));
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);
  const plantilla = PLANTILLAS_CONSENTIMIENTO.find((p) => String(p.id) === plantillaId);
  const nombre = plantilla?.procedimiento || otro;
  const contenido = plantilla?.contenido
    || `Yo, el/la abajo firmante, paciente de la clínica, declaro que he sido informado/a de manera clara y comprensible sobre el procedimiento de ${String(nombre || "").toUpperCase()}, sus beneficios, riesgos, posibles complicaciones, alternativas y cuidados posteriores. He podido hacer preguntas y doy mi consentimiento libre y voluntario para su realización.`;
  const guardar = async () => {
    setGuardando(true);
    try {
      const creado = await crearEstetica("consentimiento", pacienteId, {
        paciente_id: String(pacienteId), plantilla_id: plantillaId, notas,
        procedimiento: nombre, contenido, riesgos: plantilla?.riesgos || [],
        paciente_nombre: nombrePac(paciente), firmado: false, creado_en: new Date().toISOString(),
      });
      setListo(creado);
    } catch (e) { alert(e.response?.data?.msg || "No se pudo guardar el consentimiento."); }
    setGuardando(false);
  };
  return (
    <Modal titulo="Consentimiento informado" icono="bi-pen" onClose={onClose}>
      {listo ? (
        <div className="text-center py-3">
          <i className="bi bi-check-circle-fill" style={{ fontSize: "2.2rem", color: "#16a34a" }} />
          <div className="fw-bold mt-2">Consentimiento creado</div>
          <div className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>Que el paciente lo firme aquí con el dedo, o envíeselo para que lo firme desde su teléfono.</div>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Firmar después</button>
            <button type="button" className="btn btn-sm" style={{ border: `1px solid ${ROSA}`, color: ROSA, fontWeight: 700 }} onClick={() => onEnviar?.(listo)}>
              <i className="bi bi-send me-1" />Enviar para firmar en casa
            </button>
            <button type="button" className="btn btn-sm" style={{ background: ROSA, color: "#fff", fontWeight: 700 }} onClick={() => onFirmar?.(listo)}>
              <i className="bi bi-pen me-1" />Firmar ahora
            </button>
          </div>
        </div>
      ) : (
        <>
          <Lbl>Plantilla</Lbl>
          <select style={inp} className="mb-2" value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
            <option value="">Otro procedimiento (texto general)</option>
            {PLANTILLAS_CONSENTIMIENTO.map((p) => <option key={p.id} value={p.id}>{p.procedimiento}</option>)}
          </select>
          {!plantilla && (<><Lbl>Procedimiento</Lbl><input style={inp} className="mb-2" value={otro} onChange={(e) => setOtro(e.target.value)} placeholder="Ej.: Toxina botulínica" /></>)}
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, fontSize: "0.82rem", maxHeight: 180, overflowY: "auto" }} className="mb-2">
            {contenido}
            {plantilla?.riesgos?.length > 0 && <div className="mt-2"><strong>Riesgos:</strong> {plantilla.riesgos.join(", ")}.</div>}
          </div>
          <Lbl>Notas</Lbl>
          <input style={inp} value={notas} onChange={(e) => setNotas(e.target.value)} />
          <div className="d-flex mt-3">
            <button type="button" className="btn ms-auto" style={{ background: ROSA, color: "#fff", fontWeight: 700 }} disabled={guardando || !nombre} onClick={guardar}>
              {guardando ? "Guardando…" : "Crear consentimiento"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}


/**
 * Ficha estética rápida (lo esencial para la seguridad del paciente) sin salir del
 * perfil. Guarda la misma ficha que la pantalla «Ficha Estética» (una por paciente).
 */
export function ModalFichaRapida({ pacienteId, fichaActual, onClose, onGuardada }) {
  const [f, setF] = useState(() => ({
    fototipo: "", piel_tipo: "Normal", cicatrizacion: "Normal",
    alergias_anestesia: "", alergias_medicamentos: "", alergias_latex: false, fumador: false,
    contraindicaciones: "", procedimientos_previos: [], zonas_interes: [], alcoholismo: "Ninguno", num_cirugias_previas: "0",
    motivacion: "", expectativas: "", notas_medico: "",
    ...(fichaActual || {}),
  }));
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const guardar = async () => {
    setGuardando(true);
    try {
      const { id: _i, paciente_id: _p, historia_id: _h, _tipo, _factura, _creado_en, _actualizado_en, ...limpio } = f;
      await crearEstetica("ficha", pacienteId, { ...limpio, pac_id: String(pacienteId), actualizado_en: new Date().toISOString() });
      onGuardada?.();
    } catch (e) { alert(e.response?.data?.msg || "No se pudo guardar la ficha."); }
    setGuardando(false);
  };
  const chk = { display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", cursor: "pointer" };
  return (
    <Modal titulo="Ficha estética" icono="bi-clipboard2-pulse" onClose={onClose}>
      <Lbl>Fototipo de Fitzpatrick</Lbl>
      <div className="d-flex gap-1 flex-wrap mb-3">
        {["I", "II", "III", "IV", "V", "VI"].map((t) => (
          <button key={t} type="button" onClick={() => set("fototipo", t)}
            style={{ minWidth: 44, borderRadius: 999, padding: "5px 10px", fontWeight: 700, border: `1px solid ${f.fototipo === t ? ROSA : "#d1d5db"}`, background: f.fototipo === t ? "#fdf2f8" : "#fff", color: f.fototipo === t ? ROSA : "#374151" }}>
            {t}
          </button>
        ))}
      </div>
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <div style={{ flex: "1 1 150px" }}><Lbl>Tipo de piel</Lbl>
          <select style={inp} value={f.piel_tipo} onChange={(e) => set("piel_tipo", e.target.value)}>
            {["Normal", "Seca", "Grasa", "Mixta", "Sensible"].map((o) => <option key={o}>{o}</option>)}
          </select></div>
        <div style={{ flex: "1 1 150px" }}><Lbl>Cicatrización</Lbl>
          <select style={inp} value={f.cicatrizacion} onChange={(e) => set("cicatrizacion", e.target.value)}>
            {["Normal", "Queloide", "Hipertrófica", "Atrófica"].map((o) => <option key={o}>{o}</option>)}
          </select></div>
      </div>
      <div className="mb-2"><Lbl>Alergia a anestésicos</Lbl>
        <input style={inp} value={f.alergias_anestesia} onChange={(e) => set("alergias_anestesia", e.target.value)} placeholder="Ninguna" /></div>
      <div className="mb-2"><Lbl>Alergia a medicamentos</Lbl>
        <input style={inp} value={f.alergias_medicamentos} onChange={(e) => set("alergias_medicamentos", e.target.value)} placeholder="Ninguna" /></div>
      <div className="d-flex gap-4 my-2 flex-wrap">
        <label style={chk}><input type="checkbox" className="form-check-input m-0" checked={!!f.alergias_latex} onChange={(e) => set("alergias_latex", e.target.checked)} />Alergia al látex</label>
        <label style={chk}><input type="checkbox" className="form-check-input m-0" checked={!!f.fumador} onChange={(e) => set("fumador", e.target.checked)} />Fuma</label>
      </div>
      <div className="mb-2"><Lbl>Contraindicaciones</Lbl>
        <textarea rows={2} style={inp} value={f.contraindicaciones} onChange={(e) => set("contraindicaciones", e.target.value)} placeholder="Embarazo, anticoagulantes, herpes…" /></div>
      <div className="d-flex align-items-center mt-3 gap-2 flex-wrap">
        <Link to={`/estetica/ficha?paciente_id=${pacienteId}`} style={{ fontSize: "0.82rem" }}>Abrir ficha completa</Link>
        <button type="button" className="btn ms-auto" style={{ background: ROSA, color: "#fff", fontWeight: 700 }} disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar ficha"}
        </button>
      </div>
    </Modal>
  );
}
