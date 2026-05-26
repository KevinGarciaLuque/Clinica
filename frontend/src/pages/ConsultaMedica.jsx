/**
 * FASE 4 — Consulta SOAP (Historia Clínica Electrónica)
 * URL: /consulta-medica?paciente_id=&cita_id=&historia_id=
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { FaCheckCircle } from "react-icons/fa";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

// ─── helpers ──────────────────────────────────────────────────────────────────
const VITALS_FIELDS = [
  { key: "pa",    label: "P.A.",   placeholder: "Ej: 120/80", unit: "mmHg" },
  { key: "fc",    label: "F.C.",   placeholder: "Ej: 72",     unit: "bpm"  },
  { key: "fr",    label: "F.R.",   placeholder: "Ej: 16",     unit: "rpm"  },
  { key: "temp",  label: "Temp.",  placeholder: "Ej: 36.5",   unit: "°C"   },
  { key: "peso",  label: "Peso",   placeholder: "Ej: 70",     unit: "kg"   },
  { key: "talla", label: "Talla",  placeholder: "Ej: 170",    unit: "cm"   },
  { key: "spo2",  label: "SpO₂",   placeholder: "Ej: 98",     unit: "%"    },
  { key: "imc",   label: "IMC",    placeholder: "Auto",       unit: "kg/m²", readOnly: true },
];

function calcIMC(peso, talla) {
  const p = parseFloat(peso), t = parseFloat(talla);
  if (!p || !t) return "";
  return (p / ((t / 100) ** 2)).toFixed(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── helper datos_derma ─────────────────────────────────────────────────────
function parseDerma(raw) {
  if (!raw) return {};
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { return {}; }
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function Consulta() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const { modulos } = useAuth();
  const pacId      = params.get("paciente_id");
  const citaId     = params.get("cita_id");
  const historiaId = params.get("historia_id");
  const editMode   = params.get("editar") === "1";

  const [tab,       setTab]       = useState("soap");
  const [historia,  setHistoria]  = useState(null);   // loaded historia object
  const [hid,       setHid]       = useState(historiaId || null); // historia id (created or loaded)
  const [paciente,  setPaciente]  = useState(null);
  const [firmada,   setFirmada]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [alertMsg,  setAlertMsg]  = useState(null);   // { type, msg }
  const [showSignedModal, setShowSignedModal] = useState(false);
  const [showSavedChangesModal, setShowSavedChangesModal] = useState(false);
  const [showConfirmSignedEditSave, setShowConfirmSignedEditSave] = useState(false);
  const [showConsultaModal,  setShowConsultaModal]  = useState(false);
  const [consultaPaciente,   setConsultaPaciente]   = useState(null);
  const [resumenPac, setResumenPac] = useState(null); // nuevo vs. subsecuente

  // SOAP fields
  const [soap, setSoap] = useState({
    subjetivo: "", objetivo: {}, examen_fisico: "", plan: "",
    diagnostico_cie: "", diagnostico_desc: "",
    diagnosticos_secundarios: [],
  });
  const [vitals, setVitals] = useState({});

  // Campos específicos dermatología
  const [datosDerma, setDatosDerma] = useState({});
  const soloLectura = firmada && !editMode;

  // ── carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    // cargar historia existente
    if (hid) {
      api.get(`/historias/${hid}`)
        .then(r => {
          const h = r.data.data;
          setHistoria(h);
          setFirmada(h.estado === "FIRMADA");
          setPaciente({ id: h.paciente_id, nombres: h.pac_nombres, apellidos: h.pac_apellidos, fecha_nacimiento: h.fecha_nacimiento });
          const obj = typeof h.objetivo === "string" ? JSON.parse(h.objetivo || "{}") : (h.objetivo || {});
          setVitals(obj);
          const secDx = typeof h.diagnosticos_secundarios === "string"
            ? JSON.parse(h.diagnosticos_secundarios || "[]")
            : (h.diagnosticos_secundarios || []);
          setSoap(s => ({
            ...s,
            subjetivo: h.subjetivo || "",
            objetivo:  obj,
            examen_fisico: h.examen_fisico || "",
            plan:       h.plan || "",
            diagnostico_cie:  h.diagnostico_cie || "",
            diagnostico_desc: "",
            diagnosticos_secundarios: secDx,
          }));
          // recuperar la descripción del código CIE-10 guardado
          if (h.diagnostico_cie) {
            api.get("/historias/cie10/buscar", { params: { q: h.diagnostico_cie } })
              .then(r => {
                const found = r.data.data?.find(x => x.codigo === h.diagnostico_cie);
                if (found) setSoap(s => ({ ...s, diagnostico_desc: found.descripcion }));
              }).catch(() => {});
          }
          // cargar datos dermatológicos
          setDatosDerma(parseDerma(h.datos_derma));
        })
        .catch(() => setAlertMsg({ type: "danger", msg: "No se pudo cargar la historia" }));
    }

    // cargar paciente si no viene de historia
    if (pacId && !hid) {
      api.get(`/pacientes/${pacId}`)
        .then(r => { if (r.data.data) setPaciente(r.data.data); })
        .catch(() => {});
    }
  }, [hid, pacId]);

  // ── imc automático ───────────────────────────────────────────────────────────
  useEffect(() => {
    setVitals(v => ({ ...v, imc: calcIMC(v.peso, v.talla) }));
  }, [vitals.peso, vitals.talla]);

  // ── resumen nuevo / subsecuente ──────────────────────────────────────────────
  useEffect(() => {
    const pid = paciente?.id || pacId;
    if (!pid) return;
    api.get(`/historias/paciente/${pid}/resumen`, { params: hid ? { exclude_id: hid } : {} })
      .then(r => setResumenPac(r.data.data))
      .catch(() => {});
  }, [paciente?.id, pacId, hid]);

  // ── guardar borrador ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async (sign = false) => {
    setSaving(true);
    setAlertMsg(null);
    try {
      const payload = {
        paciente_id: paciente?.id || pacId,
        cita_id:     citaId || null,
        subjetivo:   soap.subjetivo,
        objetivo:    { ...vitals, imc: undefined },
        examen_fisico: soap.examen_fisico,
        diagnostico_cie: soap.diagnostico_cie || null,
        diagnosticos_secundarios: soap.diagnosticos_secundarios,
        plan:        soap.plan,
        estado:      sign ? "FIRMADA" : (firmada ? "FIRMADA" : "BORRADOR"),
        datos_derma: Object.keys(datosDerma).length ? datosDerma : null,
      };

      if (hid) {
        const putUrl = (firmada && editMode)
          ? `/historias/${hid}?editar=1`
          : `/historias/${hid}`;
        await api.put(putUrl, payload);
        if (sign) {
          await api.post(`/historias/${hid}/firmar`);
          setFirmada(true);
          setAlertMsg(null);
          setShowSignedModal(true);
        } else {
          if (firmada) {
            setAlertMsg(null);
            setShowSavedChangesModal(true);
          } else {
            setAlertMsg({ type: "success", msg: "Guardado como borrador." });
          }
        }
      } else {
        const r = await api.post("/historias", payload);
        setHid(r.data.id);
        if (sign) {
          await api.post(`/historias/${r.data.id}/firmar`);
          setFirmada(true);
          setAlertMsg(null);
          setShowSignedModal(true);
        } else {
          setAlertMsg({ type: "success", msg: "Historia creada." });
        }
      }
    } catch (e) {
      setAlertMsg({ type: "danger", msg: e.response?.data?.msg || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  }, [soap, vitals, hid, paciente, pacId, citaId, firmada, editMode, datosDerma]);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const edad = paciente?.fecha_nacimiento
    ? dayjs().diff(dayjs(paciente.fecha_nacimiento), "year") + " años"
    : "";

  const esDerma = modulos.some(m => m.ruta?.startsWith("/estetica/"));

  const TAB_LIST = [
    { id: "soap",         icon: "bi-clipboard2-pulse", label: "SOAP" },
    ...(esDerma ? [{ id: "derma", icon: "bi-bandaid-fill", label: "Dermatología" }] : []),
    { id: "rx",           icon: "bi-capsule",          label: "Prescripción" },
    { id: "estudios",     icon: "bi-eyedropper",       label: "Estudios" },
    { id: "antecedentes", icon: "bi-folder2-open",     label: "Antecedentes" },
  ];

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh" }}>
      {/* ── Header barra superior ── */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)",
      }}>
        <div className="d-flex align-items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)",
              borderRadius: 8, color: "#fff", padding: "5px 14px", fontSize: "0.82rem",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
            <i className="bi bi-arrow-left"></i> Volver
          </button>
          <div>
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-clipboard2-pulse" style={{ color: "#7dd3fc", fontSize: "1.1rem" }}></i>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem", letterSpacing: "0.01em" }}>
                Consulta Médica
              </span>
              {firmada && (
                <span style={{ background: "#22c55e", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 600 }}>
                  FIRMADA
                </span>
              )}
              {firmada && editMode && (
                <span style={{ background: "#2563eb", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 600 }}>
                  EDICIÓN
                </span>
              )}
              {!firmada && hid && (
                <span style={{ background: "#f59e0b", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 600 }}>
                  BORRADOR
                </span>
              )}
            </div>
            <div style={{ color: "rgba(255,255,255,.55)", fontSize: "0.75rem", marginTop: 1 }}>
              Historia Clínica Electrónica
            </div>
          </div>
        </div>
        {!soloLectura && (
          <div className="d-flex gap-2">
            {firmada ? (
              <button
                onClick={() => setShowConfirmSignedEditSave(true)}
                disabled={saving}
                style={{
                  background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
                  border: "none", borderRadius: 8, color: "#fff",
                  padding: "6px 18px", fontSize: "0.82rem",
                  cursor: "pointer", fontWeight: 600,
                  boxShadow: "0 2px 8px rgba(14,165,233,.35)",
                }}>
                <i className="bi bi-save2 me-1"></i>{saving ? "Guardando…" : "Guardar cambios"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  style={{
                    background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.25)",
                    borderRadius: 8, color: "#e2e8f0", padding: "6px 16px", fontSize: "0.82rem",
                    cursor: "pointer", fontWeight: 500,
                  }}>
                  <i className="bi bi-floppy me-1"></i>{saving ? "Guardando…" : "Borrador"}
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  style={{
                    background: "linear-gradient(135deg, #22c55e, #16a34a)",
                    border: "none", borderRadius: 8, color: "#fff",
                    padding: "6px 18px", fontSize: "0.82rem",
                    cursor: "pointer", fontWeight: 600,
                    boxShadow: "0 2px 8px rgba(34,197,94,.4)",
                  }}>
                  <i className="bi bi-check2-circle me-1"></i>Firmar y Cerrar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="px-3 px-md-4 pt-3">
        {/* ── Banner paciente ── */}
        {paciente && (
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: "12px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow: "0 1px 6px rgba(0,0,0,.07)",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              color: "#fff", display: "flex", alignItems: "center",
              justifyContent: "center", fontWeight: 700, fontSize: "1rem",
              boxShadow: "0 2px 8px rgba(59,130,246,.35)",
            }}>
              {paciente.nombres?.[0]}{paciente.apellidos?.[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.97rem", color: "#111827" }}>
                {paciente.nombres} {paciente.apellidos}
              </div>
              <div style={{ color: "#6b7280", fontSize: "0.78rem", marginTop: 2 }}>
                {edad && <span>{edad}</span>}
                {edad && paciente.fecha_nacimiento && <span style={{ margin: "0 5px", opacity: .5 }}>·</span>}
                {paciente.fecha_nacimiento && <span>{dayjs(paciente.fecha_nacimiento).format("DD/MM/YYYY")}</span>}
              </div>
            </div>
            <button
              onClick={() => { setConsultaPaciente(paciente); setShowConsultaModal(true); }}
              style={{
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                border: "none", borderRadius: 8, color: "#fff",
                padding: "6px 14px", fontSize: "0.8rem", cursor: "pointer",
                fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                boxShadow: "0 2px 6px rgba(34,197,94,.3)",
              }}>
              <i className="bi bi-plus-lg"></i> Nueva Consulta
            </button>
          </div>
        )}

        {/* ── Tarjeta nuevo / subsecuente ── */}
        {resumenPac && (
          <PacienteResumenCard resumen={resumenPac} />
        )}

        {alertMsg && (
          <div className={`alert alert-${alertMsg.type} py-2 alert-dismissible mb-3`} style={{ borderRadius: 10 }}>
            {alertMsg.msg}
            <button className="btn-close" onClick={() => setAlertMsg(null)} />
          </div>
        )}

        {/* ── Tabs principales ── */}
        <div style={{
          background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
          borderRadius: "12px 12px 0 0",
          display: "flex",
          padding: "0 6px",
          overflowX: "auto",
        }}>
          {TAB_LIST.map(t => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flexShrink: 0,
                  padding: "7px 16px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  borderRadius: "8px 8px 0 0",
                  border: "none",
                  cursor: "pointer",
                  transition: "background .15s",
                  background: isActive ? "#fff" : "rgba(255,255,255,.1)",
                  color: isActive ? "#1a2744" : "rgba(255,255,255,.75)",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <i className={`bi ${t.icon}`}></i>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Contenido de tab */}
        <div style={{
          background: "#fff",
          borderRadius: "0 0 12px 12px",
          boxShadow: "0 1px 6px rgba(0,0,0,.06)",
          padding: "20px",
          marginBottom: 24,
        }}>

          {/* ── SOAP ── */}
          {tab === "soap" && (
            <SoapTab
              soap={soap} setSoap={setSoap}
              vitals={vitals} setVitals={setVitals}
              firmada={soloLectura}
            />
          )}

          {/* ── Prescripción ── */}
          {tab === "rx" && (
            <PrescripcionTab
              historiaId={hid}
              pacienteId={paciente?.id || pacId}
              citaId={citaId}
              firmada={soloLectura}
              diagnosticoCie={soap.diagnostico_cie}
              diagnosticoDesc={soap.diagnostico_desc}
            />
          )}

          {/* ── Estudios ── */}
          {tab === "estudios" && (
            <EstudiosTab
              historiaId={hid}
              pacienteId={paciente?.id || pacId}
              firmada={soloLectura}
            />
          )}

          {/* ── Antecedentes ── */}
          {tab === "antecedentes" && (
            <AntecedentesTab
              pacienteId={paciente?.id || pacId}
              firmada={soloLectura}
            />
          )}

          {/* ── Dermatología ── */}
          {tab === "derma" && (
            <DermaTab
              datosDerma={datosDerma}
              setDatosDerma={setDatosDerma}
              firmada={soloLectura}
              paciente={paciente}
              pacienteId={paciente?.id || pacId}
            />
          )}
        </div>{/* /tab-content */}
      </div>{/* /px-3 */}

      {/* Modal consulta sin cita agendada */}
      {showConsultaModal && consultaPaciente && (
        <ModalConsultaSinCita
          paciente={consultaPaciente}
          onClose={() => { setShowConsultaModal(false); setConsultaPaciente(null); }}
          onCreated={(citaId) => {
            setShowConsultaModal(false);
            navigate(`/consulta-medica?paciente_id=${consultaPaciente.id}&cita_id=${citaId}`);
            setConsultaPaciente(null);
          }}
        />
      )}

      {showSignedModal && (
        <ModalHistoriaFirmada
          paciente={paciente}
          onClose={() => setShowSignedModal(false)}
          onVerHistorial={() => {
            setShowSignedModal(false);
            if (paciente?.id) navigate(`/pacientes/${paciente.id}/perfil?tab=historial`);
          }}
        />
      )}

      {showConfirmSignedEditSave && (
        <ModalConfirmarEdicionFirmada
          onCancel={() => setShowConfirmSignedEditSave(false)}
          onConfirm={async () => {
            setShowConfirmSignedEditSave(false);
            await handleSave(false);
          }}
          saving={saving}
        />
      )}

      {showSavedChangesModal && (
        <ModalCambiosGuardados
          onClose={() => setShowSavedChangesModal(false)}
        />
      )}
    </div>
  );
}

function ModalHistoriaFirmada({ paciente, onClose, onVerHistorial }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(15,23,42,.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      backdropFilter: "blur(3px)",
    }}>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(.86); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkDraw {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        .signed-modal {
          animation: popIn .28s ease-out;
        }
        .signed-check {
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
          animation: checkDraw .5s ease-out .15s forwards;
        }
      `}</style>

      <div className="signed-modal" style={{
        width: "100%",
        maxWidth: 460,
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #dcfce7",
        boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "22px 22px 16px", textAlign: "center" }}>
          <div style={{
            width: 76,
            height: 76,
            margin: "0 auto 14px",
            borderRadius: "50%",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 22px rgba(34,197,94,.35)",
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path className="signed-check" d="M5 12.5L10 17L19 8.5" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#166534", marginBottom: 6 }}>
            Historia firmada
          </div>
          <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>
            La consulta de <strong>{paciente?.nombres} {paciente?.apellidos}</strong> se guardó correctamente.
          </div>
        </div>

        <div style={{
          padding: "14px 16px 18px",
          borderTop: "1px solid #ecfdf5",
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Cerrar
          </button>
          <button className="btn btn-success btn-sm" onClick={onVerHistorial}>
            <i className="bi bi-journal-medical me-1"></i>Ver historial clínico
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalConfirmarEdicionFirmada({ onCancel, onConfirm, saving }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      background: "rgba(15,23,42,.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 500,
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #fde68a",
        boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 18px",
          background: "#fffbeb",
          borderBottom: "1px solid #fde68a",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontWeight: 700,
          color: "#92400e",
        }}>
          <i className="bi bi-exclamation-triangle-fill"></i>
          Confirmar cambios en historia firmada
        </div>
        <div style={{ padding: "16px 18px", color: "#374151", fontSize: "0.92rem" }}>
          Vas a modificar una historia clínica ya firmada. Esta acción actualizará el contenido clínico registrado.
          ¿Deseas continuar?
        </div>
        <div style={{
          padding: "0 18px 16px",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary btn-sm" onClick={onConfirm} disabled={saving}>
            <i className="bi bi-save2 me-1"></i>{saving ? "Guardando..." : "Sí, guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalCambiosGuardados({ onClose }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 10001,
      background: "rgba(15,23,42,.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      backdropFilter: "blur(2px)",
    }}>
      <style>{`
        @keyframes successPop {
          0% { transform: scale(.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkPulse {
          0% { transform: scale(.6); opacity: 0; }
          70% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .saved-modal-pop { animation: successPop .25s ease-out; }
        .saved-check-pop { animation: checkPulse .45s ease-out; }
      `}</style>

      <div className="saved-modal-pop" style={{
        width: "100%",
        maxWidth: 430,
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #dcfce7",
        boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        padding: "22px 18px 16px",
        textAlign: "center",
      }}>
        <div className="saved-check-pop" style={{ marginBottom: 10 }}>
          <FaCheckCircle size={60} color="#16a34a" />
        </div>
        <div style={{ fontWeight: 800, color: "#166534", fontSize: "1.05rem", marginBottom: 6 }}>
          Cambios guardados correctamente
        </div>
        <div style={{ color: "#4b5563", fontSize: "0.9rem", marginBottom: 14 }}>
          La historia clínica firmada fue actualizada.
        </div>
        <button className="btn btn-success btn-sm" onClick={onClose}>
          Aceptar
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Tarjeta: Paciente Nuevo vs. Consulta Subsecuente
// ══════════════════════════════════════════════════════════════════════
function PacienteResumenCard({ resumen }) {
  const [expandido, setExpandido] = useState(false);
  const [indice, setIndice] = useState(0);
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);
  if (!resumen) return null;

  const { es_nuevo, total_consultas, consultas_previas } = resumen;
  const lista = consultas_previas || (resumen.ultima_consulta ? [resumen.ultima_consulta] : []);

  if (es_nuevo) {
    return (
      <div style={{
        background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
        border: "1px solid #86efac",
        borderRadius: 10,
        padding: "10px 16px",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 1px 4px rgba(34,197,94,.12)",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#22c55e", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: "0.9rem",
        }}>
          <i className="bi bi-stars"></i>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#15803d" }}>PACIENTE NUEVO</div>
          <div style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: 1 }}>
            Primera consulta registrada en esta clínica
          </div>
        </div>
      </div>
    );
  }

  const actual = lista[indice];
  const total  = lista.length;

  return (
    <div style={{
      background: expandido ? "#f8faff" : "#fff",
      border: "1px solid #bfdbfe",
      borderRadius: 10,
      marginBottom: 12,
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(59,130,246,.1)",
      transition: "background .2s",
    }}>
      {/* Cabecera siempre visible */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: "0.85rem",
        }}>
          <i className="bi bi-arrow-repeat"></i>
        </div>

        {/* Texto central — clickeable para expandir */}
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandido(e => !e)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1d4ed8" }}>
              CONSULTA SUBSECUENTE
            </span>
            <span style={{
              background: "#dbeafe", color: "#1e40af",
              borderRadius: 20, padding: "1px 9px",
              fontSize: "0.7rem", fontWeight: 700,
            }}>
              {total_consultas} {total_consultas === 1 ? "visita previa" : "visitas previas"}
            </span>
          </div>
          {actual && (
            <div style={{ fontSize: "0.73rem", color: "#6b7280", marginTop: 2 }}>
              Última visita: {dayjs(actual.fecha).format("DD/MM/YYYY")}
              {actual.diagnostico_cie && (
                <span style={{ marginLeft: 6, color: "#3b82f6" }}>
                  · {actual.diagnostico_cie}{actual.diagnostico_desc ? ` – ${actual.diagnostico_desc}` : ""}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controles carrusel */}
        {total > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => setIndice(i => Math.min(i + 1, total - 1))}
              disabled={indice >= total - 1}
              onMouseEnter={() => setHoverPrev(true)}
              onMouseLeave={() => setHoverPrev(false)}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                border: `1px solid ${indice >= total - 1 ? "#e2e8f0" : hoverPrev ? "#93c5fd" : "#bfdbfe"}`,
                background: indice >= total - 1 ? "#f1f5f9" : hoverPrev ? "#dbeafe" : "#eff6ff",
                color: indice >= total - 1 ? "#cbd5e1" : hoverPrev ? "#1d4ed8" : "#3b82f6",
                cursor: indice >= total - 1 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", flexShrink: 0,
                transform: hoverPrev && indice < total - 1 ? "scale(1.12)" : "scale(1)",
                transition: "all .15s",
                boxShadow: hoverPrev && indice < total - 1 ? "0 2px 8px rgba(59,130,246,.25)" : "none",
              }}
              title="Consulta anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <span style={{ fontSize: "0.72rem", color: "#6b7280", minWidth: 36, textAlign: "center" }}>
              {indice + 1} / {total}
            </span>
            <button
              onClick={() => setIndice(i => Math.max(i - 1, 0))}
              disabled={indice <= 0}
              onMouseEnter={() => setHoverNext(true)}
              onMouseLeave={() => setHoverNext(false)}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                border: `1px solid ${indice <= 0 ? "#e2e8f0" : hoverNext ? "#93c5fd" : "#bfdbfe"}`,
                background: indice <= 0 ? "#f1f5f9" : hoverNext ? "#dbeafe" : "#eff6ff",
                color: indice <= 0 ? "#cbd5e1" : hoverNext ? "#1d4ed8" : "#3b82f6",
                cursor: indice <= 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", flexShrink: 0,
                transform: hoverNext && indice > 0 ? "scale(1.12)" : "scale(1)",
                transition: "all .15s",
                boxShadow: hoverNext && indice > 0 ? "0 2px 8px rgba(59,130,246,.25)" : "none",
              }}
              title="Consulta siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        )}

        {/* Toggle expandir */}
        <div
          onClick={() => setExpandido(e => !e)}
          style={{ color: "#9ca3af", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
        >
          <span style={{ fontSize: "0.72rem" }}>{expandido ? "Cerrar" : "Ver detalle"}</span>
          <i className={`bi bi-chevron-${expandido ? "up" : "down"}`} style={{ fontSize: "0.72rem" }}></i>
        </div>
      </div>

      {/* Detalle expandible */}
      {expandido && actual && (
        <div style={{ borderTop: "1px solid #dbeafe", padding: "14px 16px", background: "#f8faff" }}>
          {/* Médico y fecha */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12, fontSize: "0.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i className="bi bi-calendar3" style={{ color: "#3b82f6" }}></i>
              <span style={{ color: "#374151" }}>
                <strong>Fecha:</strong> {dayjs(actual.fecha).format("DD [de] MMMM [de] YYYY")}
              </span>
            </div>
            {actual.medico && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <i className="bi bi-person-badge" style={{ color: "#3b82f6" }}></i>
                <span style={{ color: "#374151" }}>
                  <strong>Médico:</strong> Dr. {actual.medico}
                  {actual.especialidad && <span style={{ color: "#9ca3af" }}> · {actual.especialidad}</span>}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {actual.subjetivo && (
              <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  <i className="bi bi-chat-square-text me-1 text-primary"></i>Motivo / Subjetivo
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151", lineHeight: 1.5 }}>{actual.subjetivo}</p>
              </div>
            )}
            {actual.diagnostico_cie && (
              <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  <i className="bi bi-clipboard2-pulse me-1 text-danger"></i>Diagnóstico
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 6, padding: "1px 7px", fontSize: "0.72rem", fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>
                    {actual.diagnostico_cie}
                  </span>
                  {actual.diagnostico_desc && (
                    <span style={{ fontSize: "0.82rem", color: "#374151", lineHeight: 1.4 }}>{actual.diagnostico_desc}</span>
                  )}
                </div>
              </div>
            )}
            {actual.plan && (
              <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e5e7eb", gridColumn: actual.subjetivo && actual.diagnostico_cie ? "1 / -1" : undefined }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  <i className="bi bi-list-check me-1 text-success"></i>Plan de tratamiento
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151", lineHeight: 1.5 }}>{actual.plan}</p>
              </div>
            )}
          </div>

          {actual.medicamentos?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                <i className="bi bi-capsule me-1 text-warning"></i>Medicamentos recetados
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {actual.medicamentos.map((m, i) => (
                  <div key={i} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "5px 10px", fontSize: "0.78rem", color: "#92400e" }}>
                    <strong>{m.nombre}</strong>
                    {m.dosis && <span style={{ color: "#b45309" }}> · {m.dosis}</span>}
                    {m.duracion && <span style={{ color: "#b45309" }}> · {m.duracion}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Textarea con predicción de texto IA por especialidad
// ══════════════════════════════════════════════════════════════════════
function SoapTextareaIA({ label, sublabel, value, onChange, readOnly, rows = 3, placeholder, campo, especialidad, diagnosticoCie, diagnosticoDesc }) {
  const [sugerencia, setSugerencia] = useState("");
  const [cargando,   setCargando]   = useState(false);
  const taRef = useRef(null);

  // Limpiar sugerencia al cambiar diagnóstico o campo
  useEffect(() => { setSugerencia(""); }, [diagnosticoCie, campo]);

  useEffect(() => {
    if (!value || value.trim().length < 10 || readOnly) { setSugerencia(""); return; }
    setCargando(true);
    setSugerencia("");
    const t = setTimeout(() => {
      api.post("/ia/soap-sugerencia", {
        campo,
        texto:           value,
        especialidad:    especialidad || "Medicina General",
        diagnostico_cie: diagnosticoCie || "",
        diagnostico_desc: diagnosticoDesc || "",
      })
        .then(r => { if (r.data.sugerencia) setSugerencia(r.data.sugerencia); })
        .catch(() => {})
        .finally(() => setCargando(false));
    }, 750);
    return () => { clearTimeout(t); setCargando(false); };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const aceptar = () => {
    const sep = value.trimEnd().endsWith(".") || value.trimEnd().endsWith(",") ? " " : ". ";
    onChange({ target: { value: value.trimEnd() + sep + sugerencia } });
    setSugerencia("");
    taRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Tab" && sugerencia) { e.preventDefault(); aceptar(); }
    if (e.key === "Escape")             { setSugerencia(""); }
  };

  return (
    <div>
      {label && (
        <label className="form-label fw-semibold">
          {label} {sublabel && <small className="text-muted fw-normal">{sublabel}</small>}
        </label>
      )}
      <textarea
        ref={taRef}
        className="form-control"
        rows={rows}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
      />
      {/* Indicador de carga */}
      {cargando && !readOnly && (
        <div className="d-flex align-items-center gap-1 mt-1" style={{ minHeight: 20 }}>
          <span className="spinner-border spinner-border-sm text-info"
            style={{ width: "0.55rem", height: "0.55rem", borderWidth: "0.1em" }}></span>
          <span className="text-muted" style={{ fontSize: "0.68rem" }}>IA pensando…</span>
        </div>
      )}
      {/* Sugerencia */}
      {sugerencia && !cargando && !readOnly && (
        <div className="d-flex align-items-start gap-2 mt-1 px-2 py-1 rounded"
          style={{ background: "rgba(13,110,253,0.05)", border: "1px dashed #93c5fd" }}>
          <i className="bi bi-stars text-primary" style={{ fontSize: "0.75rem", marginTop: 2 }}></i>
          <span className="flex-grow-1 text-secondary" style={{ fontSize: "0.8rem", lineHeight: 1.45 }}>
            {sugerencia}
          </span>
          <button type="button"
            className="btn btn-sm py-0 px-2 text-nowrap"
            style={{ fontSize: "0.68rem", background: "#dbeafe", border: "none", color: "#1d4ed8" }}
            onClick={aceptar}
            title="Tab para aceptar">
            Tab ↵
          </button>
          <button type="button"
            className="btn btn-link btn-sm p-0 text-muted lh-1"
            style={{ fontSize: "0.75rem" }}
            onClick={() => setSugerencia("")}
            title="Descartar sugerencia">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Componente reutilizable: buscador CIE-10 con chip al seleccionar
// ══════════════════════════════════════════════════════════════════════
function CieBuscador({ value, desc, onChange, onClear, readOnly, placeholder = "Buscar código o descripción…" }) {
  const [q, setQ]       = useState("");
  const [list, setList] = useState([]);
  const ref             = useRef(null);

  // cerrar dropdown al clic fuera
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setList([]); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (!q || q.length < 2) { setList([]); return; }
    const t = setTimeout(() => {
      api.get("/historias/cie10/buscar", { params: { q } })
        .then(r => setList(r.data.data || []))
        .catch(() => setList([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const sel = (item) => {
    onChange(item.codigo, item.descripcion);
    setQ("");
    setList([]);
  };

  // Chip cuando ya hay un diagnóstico seleccionado
  if (value) {
    return (
      <div className="d-flex align-items-center gap-2 px-2 py-2 rounded border"
        style={{ background: "rgba(25,135,84,0.07)", minHeight: 36 }}>
        <span className="badge bg-success" style={{ fontFamily: "monospace", fontSize: "0.78rem", letterSpacing: "0.04em" }}>
          {value}
        </span>
        <span className="flex-grow-1 small fw-semibold text-success">{desc || "…"}</span>
        {!readOnly && (
          <button type="button" className="btn btn-link btn-sm p-0 text-danger lh-1" title="Cambiar diagnóstico"
            onClick={onClear}>
            <i className="bi bi-x-circle-fill"></i>
          </button>
        )}
      </div>
    );
  }

  // Campo de búsqueda cuando no hay nada seleccionado
  return (
    <div className="position-relative" ref={ref}>
      <div className="input-group input-group-sm">
        <span className="input-group-text text-muted border-end-0 bg-white">
          <i className="bi bi-search" style={{ fontSize: "0.75rem" }}></i>
        </span>
        <input className="form-control border-start-0" placeholder={placeholder}
          value={q} onChange={e => setQ(e.target.value)}
          autoComplete="off" />
      </div>
      {list.length > 0 && (
        <ul className="list-group position-absolute z-3 shadow"
          style={{ top: "100%", left: 0, right: 0, maxHeight: 230, overflowY: "auto" }}>
          {list.map(c => (
            <li key={c.codigo} className="list-group-item list-group-item-action py-1 px-2"
              style={{ cursor: "pointer", fontSize: "0.81rem" }}
              onMouseDown={() => sel(c)}>
              <span className="me-2 fw-bold" style={{ fontFamily: "monospace", color: "#0d6efd" }}>{c.codigo}</span>
              <span>{c.descripcion}</span>
              {c.categoria && (
                <span className="badge ms-2 text-bg-light border" style={{ fontSize: "0.66rem" }}>
                  {c.categoria}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: SOAP
// ══════════════════════════════════════════════════════════════════════
function SoapTab({ soap, setSoap, vitals, setVitals, firmada }) {
  const { user } = useAuth();
  const especialidad = user?.especialidad || "Medicina General";
  const cie10Ref = useRef(null);

  // ── Catálogo de diagnósticos frecuentes ──
  const [catDxQuery, setCatDxQuery] = useState("");
  const [catDxList, setCatDxList]   = useState([]);
  const [showCatDx, setShowCatDx]   = useState(false);

  useEffect(() => {
    if (!catDxQuery || catDxQuery.length < 2) { setCatDxList([]); return; }
    const t = setTimeout(() => {
      api.get("/catalogos-diagnostico", { params: { q: catDxQuery } })
        .then(r => { setCatDxList(r.data.data || []); setShowCatDx(true); })
        .catch(() => setCatDxList([]));
    }, 300);
    return () => clearTimeout(t);
  }, [catDxQuery]);

  const selCatDx = (cat) => {
    let secArr = [];
    try {
      secArr = typeof cat.diagnosticos_secundarios === "string"
        ? JSON.parse(cat.diagnosticos_secundarios || "[]")
        : (cat.diagnosticos_secundarios || []);
    } catch { secArr = []; }
    setSoap(s => ({
      ...s,
      diagnostico_cie: cat.codigo_cie,
      diagnostico_desc: cat.descripcion_cie,
      diagnosticos_secundarios: secArr,
    }));
    setCatDxQuery("");
    setCatDxList([]);
    setShowCatDx(false);
  };

  const set = (field) => (e) =>
    setSoap(s => ({ ...s, [field]: e.target.value }));

  const addDxSec = () => {
    setSoap(s => ({
      ...s,
      diagnosticos_secundarios: [...s.diagnosticos_secundarios, { cie: "", descripcion: "" }],
    }));
  };

  const remDxSec = (i) => {
    setSoap(s => ({
      ...s,
      diagnosticos_secundarios: s.diagnosticos_secundarios.filter((_, idx) => idx !== i),
    }));
  };

  return (
    <div className="row g-3">
      <style>{`
        .vital-input::placeholder {
          color: #b8c1cc !important;
          opacity: 1 !important;
        }
        .vital-input.vital-empty {
          color: #8b95a1 !important;
          font-style: italic;
        }
      `}</style>
      {/* Signos vitales */}
      <div className="col-12">
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#ef4444,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="bi bi-heart-pulse-fill" style={{ color: "#fff", fontSize: "0.75rem" }}></i>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>Signos Vitales</span>
          </div>
          <div className="row g-2">
            {VITALS_FIELDS.map(f => (
              <div key={f.key} className="col-6 col-md-3">
                <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "0.68rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    {f.label} <span style={{ color: "#9ca3af" }}>{f.unit}</span>
                  </div>
                  <input
                    className={`form-control form-control-sm border-0 p-0 vital-input ${vitals[f.key] ? "" : "vital-empty"}`}
                    style={{
                      background: "transparent",
                      fontWeight: vitals[f.key] ? 600 : 500,
                      fontSize: "0.9rem",
                      color: vitals[f.key] ? "#111827" : "#9ca3af",
                    }}
                    placeholder={f.placeholder}
                    value={vitals[f.key] || ""}
                    autoComplete="off"
                    readOnly={f.readOnly || firmada}
                    onChange={f.readOnly ? undefined : e => setVitals(v => ({ ...v, [f.key]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subjetivo */}
      <div className="col-md-6">
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontWeight: 800, color: "#3b82f6", fontSize: "0.75rem" }}>S</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e3a5f" }}>Subjetivo</span>
            <small style={{ color: "#9ca3af", fontSize: "0.72rem" }}>Síntomas referidos por el paciente</small>
          </div>
          <SoapTextareaIA
            campo="subjetivo" rows={4}
            value={soap.subjetivo}
            onChange={e => setSoap(s => ({ ...s, subjetivo: e.target.value }))}
            readOnly={firmada}
            placeholder="Motivo de consulta, síntomas, evolución…"
            especialidad={especialidad}
            diagnosticoCie={soap.diagnostico_cie}
            diagnosticoDesc={soap.diagnostico_desc}
          />
        </div>
      </div>

      {/* Examen físico */}
      <div className="col-md-6">
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontWeight: 800, color: "#22c55e", fontSize: "0.75rem" }}>O</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e3a5f" }}>Objetivo</span>
            <small style={{ color: "#9ca3af", fontSize: "0.72rem" }}>Hallazgos al examen físico</small>
          </div>
          <SoapTextareaIA
            campo="objetivo" rows={4}
            value={soap.examen_fisico}
            onChange={e => setSoap(s => ({ ...s, examen_fisico: e.target.value }))}
            readOnly={firmada}
            placeholder="Examen físico, hallazgos relevantes…"
            especialidad={especialidad}
            diagnosticoCie={soap.diagnostico_cie}
            diagnosticoDesc={soap.diagnostico_desc}
          />
        </div>
      </div>

      {/* Diagnóstico */}
      <div className="col-md-6">
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontWeight: 800, color: "#d97706", fontSize: "0.75rem" }}>A</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e3a5f" }}>Diagnóstico</span>
            <small style={{ color: "#9ca3af", fontSize: "0.72rem" }}>CIE-10</small>
          </div>

          {/* Catálogo de diagnósticos frecuentes del médico */}
          {!firmada && (
            <div className="position-relative mb-2">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-warning bg-opacity-10 text-warning border-end-0">
                  <i className="bi bi-lightning-fill"></i>
                </span>
                <input className="form-control border-start-0" placeholder="Mis diagnósticos frecuentes…"
                  value={catDxQuery}
                  onChange={e => setCatDxQuery(e.target.value)}
                  onFocus={() => catDxList.length > 0 && setShowCatDx(true)} />
              </div>
              {showCatDx && catDxList.length > 0 && (
                <ul className="list-group position-absolute z-3 shadow"
                  style={{ top: "100%", left: 0, right: 0, maxHeight: 180, overflowY: "auto" }}>
                  {catDxList.map(c => (
                    <li key={c.id} className="list-group-item list-group-item-action py-1 px-2"
                      style={{ cursor: "pointer", fontSize: "0.82rem" }}
                      onMouseDown={() => selCatDx(c)}>
                      <i className="bi bi-lightning-fill text-warning me-1"></i>
                      <strong>{c.nombre}</strong>
                      {c.codigo_cie && <span className="ms-1 badge text-bg-light border" style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>{c.codigo_cie}</span>}
                      {c.descripcion_cie && <span className="text-muted ms-1">{c.descripcion_cie}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Diagnóstico principal */}
          <CieBuscador
            value={soap.diagnostico_cie}
            desc={soap.diagnostico_desc}
            readOnly={firmada}
            onChange={(code, desc) => setSoap(s => ({ ...s, diagnostico_cie: code, diagnostico_desc: desc }))}
            onClear={() => setSoap(s => ({ ...s, diagnostico_cie: "", diagnostico_desc: "" }))}
          />

          {/* Diagnósticos secundarios */}
          {soap.diagnosticos_secundarios.length > 0 && (
            <p className="text-muted small mb-1 mt-3" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Secundarios
            </p>
          )}
          {soap.diagnosticos_secundarios.map((dx, i) => (
            <div key={i} className="d-flex gap-2 align-items-center mt-1">
              <div className="flex-grow-1">
                <CieBuscador
                  value={dx.cie} desc={dx.descripcion}
                  readOnly={firmada}
                  placeholder={`Secundario ${i + 1}…`}
                  onChange={(code, desc) => setSoap(s => ({
                    ...s,
                    diagnosticos_secundarios: s.diagnosticos_secundarios.map((d, j) =>
                      j === i ? { cie: code, descripcion: desc } : d
                    ),
                  }))}
                  onClear={() => setSoap(s => ({
                    ...s,
                    diagnosticos_secundarios: s.diagnosticos_secundarios.map((d, j) =>
                      j === i ? { cie: "", descripcion: "" } : d
                    ),
                  }))}
                />
              </div>
              {!firmada && (
                <button className="btn btn-outline-danger btn-sm" style={{ flexShrink: 0 }}
                  onClick={() => remDxSec(i)}>✕</button>
              )}
            </div>
          ))}
          {!firmada && (
            <button className="btn btn-link btn-sm mt-2 p-0 text-decoration-none" onClick={addDxSec}>
              <i className="bi bi-plus-circle me-1"></i>+ Diagnóstico secundario
            </button>
          )}
        </div>
      </div>

      {/* Plan */}
      <div className="col-md-6">
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 20px", height: "100%", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontWeight: 800, color: "#8b5cf6", fontSize: "0.75rem" }}>P</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e3a5f" }}>Plan</span>
            <small style={{ color: "#9ca3af", fontSize: "0.72rem" }}>Tratamiento, indicaciones, seguimiento</small>
          </div>
          <SoapTextareaIA
            campo="plan" rows={5}
            value={soap.plan}
            onChange={e => setSoap(s => ({ ...s, plan: e.target.value }))}
            readOnly={firmada}
            placeholder="Tratamiento indicado, próxima cita, derivaciones…"
            especialidad={especialidad}
            diagnosticoCie={soap.diagnostico_cie}
            diagnosticoDesc={soap.diagnostico_desc}
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: Prescripción (con sub-tabs)
// ══════════════════════════════════════════════════════════════════════
function PrescripcionTab({ historiaId, pacienteId, citaId, firmada, diagnosticoCie, diagnosticoDesc }) {
  const [subTab, setSubTab] = useState("receta");
  const [pendingSugItems, setPendingSugItems] = useState([]);

  const handleAgregar = (newItems) => {
    setPendingSugItems(newItems);
    setSubTab("receta");
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb", background: "#f8fafc" }}>
        {[
          { id: "receta",    icon: "bi-prescription2",      label: "Nueva Receta",       color: "#3b82f6" },
          { id: "historial", icon: "bi-clock-history",      label: "Historial",          color: "#8b5cf6" },
          { id: "sugeridas", icon: "bi-stars",               label: "Sugeridas CIE-10",  color: "#f59e0b" },
          { id: "favoritas", icon: "bi-bookmark-heart-fill", label: "Mis Favoritas",     color: "#ef4444" },
        ].map((t, i) => (
          <button key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              flex: 1, padding: "10px 6px",
              background: subTab === t.id ? "#fff" : "transparent",
              border: "none",
              borderRight: i < 3 ? "1px solid #e5e7eb" : "none",
              borderBottom: subTab === t.id ? `2.5px solid ${t.color}` : "none",
              color: subTab === t.id ? t.color : "#6b7280",
              fontWeight: subTab === t.id ? 700 : 500,
              fontSize: "0.78rem",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              transition: "all .15s",
            }}>
            <i className={`bi ${t.icon}`}></i>
            <span className="d-none d-sm-inline">{t.label}</span>
          </button>
        ))}
      </div>

      {subTab === "receta"    && <SubRecetaActual historiaId={historiaId} pacienteId={pacienteId} citaId={citaId} firmada={firmada} pendingSugItems={pendingSugItems} onClearPending={() => setPendingSugItems([])} />}
      {subTab === "historial" && <SubHistorialPaciente pacienteId={pacienteId} />}
      {subTab === "sugeridas" && <SubSugeridadCie diagnosticoCie={diagnosticoCie} diagnosticoDesc={diagnosticoDesc} onAgregar={handleAgregar} />}
      {subTab === "favoritas" && <SubFavoritas firmada={firmada} />}
    </div>
  );
}

// ── Sub-tab: Receta de esta consulta ──────────────────────────────────────────
function SubRecetaActual({ historiaId, pacienteId, citaId, firmada, pendingSugItems = [], onClearPending }) {
  const [list,      setList]      = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [items,     setItems]     = useState([newRxItem()]);
  const [notas,     setNotas]     = useState("");

  useEffect(() => {
    if (!pendingSugItems.length) return;
    setItems(pendingSugItems);
    setShowForm(true);
    onClearPending?.();
  }, [pendingSugItems]); // eslint-disable-line react-hooks/exhaustive-deps
  const [saving,    setSaving]    = useState(false);
  const [savingFav, setSavingFav] = useState(false);
  const [alertMsg,  setAlertMsg]  = useState(null);
  const [medSearch, setMedSearch] = useState(null);
  const [showSaveFav, setShowSaveFav] = useState(false);
  const [favNombre, setFavNombre] = useState("");
  const [medFavSet, setMedFavSet] = useState(new Set());
  const [medFavList, setMedFavList] = useState([]); // top favoritos para mostrar sin escribir

  function newRxItem() {
    return { medicamento_id: null, medicamento_texto: "", dosis: "", duracion: "", cantidad: "", instrucciones: "" };
  }

  // Cargar favoritos del médico al montar
  useEffect(() => {
    api.get("/medicamentos/favoritos")
      .then(r => {
        const ids = r.data.data || [];
        setMedFavSet(new Set(ids));
        if (ids.length > 0) {
          // Buscar datos completos de los primeros 8 favoritos
          api.get("/medicamentos", { params: { q: "" } })
            .then(r2 => setMedFavList((r2.data.data || []).filter(m => ids.includes(m.id)).slice(0, 8)))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const printRx = async (id) => {
    try {
      const res = await api.get(`/prescripciones/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (err) {
      window.alert("No se pudo generar el PDF: " + (err?.response?.data?.msg || err.message));
    }
  };

  useEffect(() => {
    if (!historiaId && !pacienteId) return;
    const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
    api.get("/prescripciones", { params })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  }, [historiaId, pacienteId]);

  const searchMed = (q, idx) => {
    if (q.length < 2) {
      // Mostrar favoritos cuando el campo está vacío o con 1 caracter
      if (medFavList.length > 0) {
        setMedSearch({ idx, list: medFavList, soloFavoritos: true });
      } else {
        setMedSearch(null);
      }
      return;
    }
    api.get("/medicamentos", { params: { q } })
      .then(r => setMedSearch({ idx, list: r.data.data || [] }))
      .catch(() => {});
  };

  const selMed = (med, idx) => {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      medicamento_id: med.id,
      medicamento_texto: med.nombre_generico + (med.presentacion ? ` (${med.presentacion})` : ""),
      dosis: med.dosis_default || it.dosis,
      duracion: med.duracion_default || it.duracion,
      cantidad: med.cantidad_default || it.cantidad,
      instrucciones: med.instrucciones_default || it.instrucciones,
    } : it));
    setMedSearch(null);
  };

  const setItem = (idx, field, val) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const handleSubmit = async () => {
    if (!pacienteId) { setAlertMsg({ type: "danger", msg: "Falta paciente_id" }); return; }
    setSaving(true);
    try {
      await api.post("/prescripciones", {
        historia_id: historiaId || null,
        cita_id: citaId || null,
        paciente_id: pacienteId,
        notas,
        items: items.filter(it => it.medicamento_texto || it.medicamento_id),
      });
      const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
      const r = await api.get("/prescripciones", { params });
      setList(r.data.data || []);
      setShowForm(false);
      setItems([newRxItem()]);
      setNotas("");
      setAlertMsg({ type: "success", msg: "Receta creada" });
    } catch (e) {
      setAlertMsg({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFavorita = async () => {
    if (!favNombre.trim()) return;
    setSavingFav(true);
    try {
      await api.post("/prescripciones/favoritas", {
        nombre: favNombre.trim(),
        notas,
        items: items.filter(it => it.medicamento_texto || it.medicamento_id),
      });
      setShowSaveFav(false);
      setFavNombre("");
      setAlertMsg({ type: "success", msg: "Guardada en Mis Favoritas ⭐" });
    } catch (e) {
      setAlertMsg({ type: "danger", msg: "No se pudo guardar como favorita" });
    } finally {
      setSavingFav(false);
    }
  };

  return (
    <div>
      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} py-2 alert-dismissible mb-3`} style={{ borderRadius: 10 }}>
          {alertMsg.msg} <button className="btn-close" onClick={() => setAlertMsg(null)} />
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827" }}>Recetas de esta consulta</span>
          {list.length > 0 && <span className="ms-2 badge" style={{ background: "#eff6ff", color: "#3b82f6", fontSize: "0.72rem" }}>{list.length}</span>}
        </div>
        {!firmada && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              background: "linear-gradient(135deg,#3b82f6,#2563eb)", border: "none",
              borderRadius: 8, color: "#fff", padding: "6px 16px", fontSize: "0.82rem",
              cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 2px 8px rgba(59,130,246,.3)",
            }}>
            <i className="bi bi-plus-lg"></i> Nueva Receta
          </button>
        )}
      </div>

      {list.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af" }}>
          <i className="bi bi-prescription2" style={{ fontSize: "2.5rem", opacity: .3 }}></i>
          <p className="mt-2 small">Sin recetas para esta consulta.</p>
        </div>
      )}

      {list.map(p => (
        <div key={p.id} style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#3b82f6,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="bi bi-capsule-pill" style={{ color: "#fff", fontSize: "0.85rem" }}></i>
            </div>
            <div>
              <span className={`badge me-2 ${p.estado === "ENTREGADA" ? "bg-success" : p.estado === "CANCELADA" ? "bg-secondary" : "bg-warning text-dark"}`} style={{ fontSize: "0.68rem" }}>{p.estado}</span>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{p.total_items} medicamento(s)</span>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 1 }}>{dayjs(p.creado_en).format("DD/MM/YYYY HH:mm")}</div>
            </div>
          </div>
          <div className="d-flex gap-1">
            {p.estado === "ACTIVA" && !firmada && (
              <button className="btn btn-outline-success btn-sm"
                style={{ fontSize: "0.75rem", borderRadius: 7 }}
                onClick={() => api.patch(`/prescripciones/${p.id}/estado`, { estado: "ENTREGADA" })
                  .then(() => setList(prev => prev.map(x => x.id === p.id ? { ...x, estado: "ENTREGADA" } : x)))}>
                <i className="bi bi-check-lg me-1"></i>Entregar
              </button>
            )}
            <button
              onClick={() => printRx(p.id)}
              style={{
                background: "transparent", border: "1px solid #3b82f6",
                borderRadius: 7, color: "#3b82f6", padding: "4px 12px",
                fontSize: "0.75rem", cursor: "pointer", fontWeight: 600,
              }}>
              <i className="bi bi-printer me-1"></i>PDF
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div style={{ border: "1px solid #bfdbfe", borderRadius: 12, marginTop: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(59,130,246,.1)" }}>
          <div style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i className="bi bi-prescription2" style={{ color: "#3b82f6" }}></i>
              <span style={{ fontWeight: 700, color: "#1e40af", fontSize: "0.9rem" }}>Nueva Receta</span>
            </div>
            <button
              title="Guardar como favorita"
              onClick={() => setShowSaveFav(s => !s)}
              style={{
                background: showSaveFav ? "#fef3c7" : "transparent", border: "1px solid #fbbf24",
                borderRadius: 7, color: "#d97706", padding: "4px 12px",
                fontSize: "0.75rem", cursor: "pointer", fontWeight: 600,
              }}>
              <i className="bi bi-bookmark-heart me-1"></i>Guardar favorita
            </button>
          </div>

          {showSaveFav && (
            <div style={{ borderBottom: "1px solid #e5e7eb", padding: "10px 18px", background: "#fffbeb", display: "flex", gap: 8, alignItems: "center" }}>
              <input className="form-control form-control-sm" placeholder="Nombre de la favorita (ej: IRA en adultos)"
                value={favNombre} onChange={e => setFavNombre(e.target.value)} style={{ maxWidth: 320, borderRadius: 7 }} />
              <button
                onClick={handleSaveFavorita} disabled={savingFav}
                style={{ background: "#f59e0b", border: "none", borderRadius: 7, color: "#fff", padding: "5px 14px", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                {savingFav ? "Guardando…" : "⭐ Guardar"}
              </button>
            </div>
          )}

          <div style={{ padding: "18px" }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px", marginBottom: 12, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Medicamento {idx + 1}
                  </span>
                  {item.medicamento_id && (
                    <span style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, color: "#16a34a", fontSize: "0.67rem", fontWeight: 600, padding: "2px 8px" }}>
                      <i className="bi bi-lightning-fill me-1"></i>Auto-llenado
                    </span>
                  )}
                </div>
                <div className="row g-2">
                  <div className="col-12 position-relative">
                    <label className="form-label small mb-1" style={{ color: "#374151", fontWeight: 600 }}>Medicamento</label>
                    <input className="form-control form-control-sm" placeholder="Buscar o escribir…"
                      style={{ borderRadius: 7 }}
                      value={item.medicamento_texto}
                      onFocus={() => { if (!item.medicamento_texto) searchMed("", idx); }}
                      onChange={e => { setItem(idx, "medicamento_texto", e.target.value); setItem(idx, "medicamento_id", null); searchMed(e.target.value, idx); }}
                      onBlur={() => setTimeout(() => setMedSearch(null), 200)} />
                    {medSearch?.idx === idx && medSearch.list?.length > 0 && (
                      <ul className="list-group position-absolute z-3 shadow"
                        style={{ top: "100%", left: 0, right: 0, maxHeight: 200, overflowY: "auto", borderRadius: 8 }}>
                        {medSearch.soloFavoritos && (
                          <li className="list-group-item py-1 px-2" style={{ background: "#fffbeb", fontSize: "0.72rem", color: "#d97706", fontWeight: 700, pointerEvents: "none" }}>
                            <i className="bi bi-star-fill me-1"></i>Mis medicamentos favoritos
                          </li>
                        )}
                        {medSearch.list.map(m => {
                          const esFav = medFavSet.has(m.id) || m.es_favorito === 1;
                          return (
                            <li key={m.id} className="list-group-item list-group-item-action py-1"
                              style={{ cursor: "pointer", fontSize: "0.8rem" }}
                              onClick={() => selMed(m, idx)}>
                              {esFav && <i className="bi bi-star-fill text-warning me-1" style={{ fontSize: "0.7rem" }}></i>}
                              <strong>{m.nombre_generico}</strong>
                              {m.presentacion && <span className="text-muted ms-1">({m.presentacion})</span>}
                              {(m.dosis_default || m.duracion_default) && (
                                <span className="text-success ms-2" style={{ fontSize: "0.7rem" }}>
                                  <i className="bi bi-lightning-fill"></i> con defaults
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1" style={{ fontWeight: 600, color: "#374151" }}>Dosis</label>
                    <input className="form-control form-control-sm" placeholder="500mg c/8h" style={{ borderRadius: 7 }}
                      value={item.dosis} onChange={e => setItem(idx, "dosis", e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1" style={{ fontWeight: 600, color: "#374151" }}>Duración</label>
                    <input className="form-control form-control-sm" placeholder="7 días" style={{ borderRadius: 7 }}
                      value={item.duracion} onChange={e => setItem(idx, "duracion", e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1" style={{ fontWeight: 600, color: "#374151" }}>Cantidad</label>
                    <input className="form-control form-control-sm" placeholder="21 tabletas" style={{ borderRadius: 7 }}
                      value={item.cantidad} onChange={e => setItem(idx, "cantidad", e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small mb-1" style={{ fontWeight: 600, color: "#374151" }}>Instrucciones</label>
                    <input className="form-control form-control-sm" placeholder="Tomar con alimentos…" style={{ borderRadius: 7 }}
                      value={item.instrucciones} onChange={e => setItem(idx, "instrucciones", e.target.value)} />
                  </div>
                </div>
                {items.length > 1 && (
                  <button
                    onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                    style={{ position: "absolute", top: 8, right: 8, background: "#fee2e2", border: "none", borderRadius: 6, color: "#dc2626", width: 24, height: 24, fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ✕
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => setItems(prev => [...prev, { medicamento_id: null, medicamento_texto: "", dosis: "", duracion: "", cantidad: "", instrucciones: "" }])}
              style={{ background: "#eff6ff", border: "1px dashed #93c5fd", borderRadius: 8, color: "#3b82f6", padding: "7px 16px", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}>
              <i className="bi bi-plus-lg me-1"></i>Agregar medicamento
            </button>

            <div className="mt-3">
              <label className="form-label small" style={{ fontWeight: 600, color: "#374151" }}>Notas adicionales</label>
              <textarea className="form-control form-control-sm" rows={2} style={{ borderRadius: 7 }}
                value={notas} onChange={e => setNotas(e.target.value)} />
            </div>

            <div className="d-flex gap-2 mt-3">
              <button
                onClick={handleSubmit} disabled={saving}
                style={{
                  background: "linear-gradient(135deg,#3b82f6,#2563eb)", border: "none",
                  borderRadius: 8, color: "#fff", padding: "7px 20px", fontSize: "0.83rem",
                  cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 8px rgba(59,130,246,.35)",
                }}>
                {saving ? "Guardando…" : "Crear Receta"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b", padding: "7px 16px", fontSize: "0.83rem", cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-tab: Historial completo del paciente ──────────────────────────────────
function SubHistorialPaciente({ pacienteId }) {
  const [historial, setHistorial] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState(null);

  useEffect(() => {
    if (!pacienteId) return;
    setLoading(true);
    api.get(`/prescripciones/historial-paciente/${pacienteId}`)
      .then(r => setHistorial(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pacienteId]);

  if (loading) return <div className="text-center py-4"><span className="spinner-border spinner-border-sm"></span> Cargando historial…</div>;
  if (!historial.length) return <p className="text-muted py-3">Sin recetas previas para este paciente.</p>;

  return (
    <div>
      <p className="text-muted small mb-3">{historial.length} receta(s) encontradas</p>
      {historial.map(rx => (
        <div key={rx.id} className="card border-0 shadow-sm mb-2">
          <div className="card-body py-2"
            style={{ cursor: "pointer" }}
            onClick={() => setExpanded(expanded === rx.id ? null : rx.id)}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className={`badge me-2 bg-${rx.estado === "ENTREGADA" ? "success" : rx.estado === "CANCELADA" ? "secondary" : "warning text-dark"}`}>
                  {rx.estado}
                </span>
                <strong className="small">{rx.total_items} medicamento(s)</strong>
                {rx.diagnostico_cie && (
                  <span className="badge text-bg-light border ms-2" style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>
                    {rx.diagnostico_cie}
                  </span>
                )}
              </div>
              <div className="text-end">
                <div className="small text-muted">{dayjs(rx.creado_en).format("DD/MM/YYYY")}</div>
                <div style={{ fontSize: "0.75rem", color: "#888" }}>
                  Dr. {rx.med_apellidos}, {rx.med_nombres}
                </div>
              </div>
            </div>
            {expanded === rx.id && rx.items?.length > 0 && (
              <div className="mt-2 pt-2 border-top">
                {rx.items.map((it, i) => (
                  <div key={i} className="d-flex align-items-start gap-2 mb-1">
                    <i className="bi bi-capsule text-primary mt-1" style={{ fontSize: "0.75rem" }}></i>
                    <div style={{ fontSize: "0.82rem" }}>
                      <strong>{it.nombre}</strong>
                      {it.presentacion && <span className="text-muted ms-1">({it.presentacion})</span>}
                      {it.dosis && <span className="ms-2 badge text-bg-light border">{it.dosis}</span>}
                      {it.duracion && <span className="ms-1 text-muted">· {it.duracion}</span>}
                      {it.instrucciones && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{it.instrucciones}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-tab: Sugerencias por CIE-10 ──────────────────────────────────────────
function SubSugeridadCie({ diagnosticoCie, diagnosticoDesc, onAgregar }) {
  const [sugeridas, setSugeridas] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [agregados, setAgregados] = useState(new Set());

  useEffect(() => {
    if (!diagnosticoCie) { setSugeridas([]); return; }
    setLoading(true);
    api.get("/prescripciones/sugerencias-cie10", { params: { codigo: diagnosticoCie } })
      .then(r => setSugeridas(r.data.data || []))
      .catch(() => setSugeridas([]))
      .finally(() => setLoading(false));
  }, [diagnosticoCie]);

  if (!diagnosticoCie) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="bi bi-search" style={{ fontSize: "2rem", opacity: 0.4 }}></i>
        <p className="mt-2">Selecciona un diagnóstico CIE-10 en la pestaña SOAP para ver sugerencias.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3">
        <span className="badge bg-primary" style={{ fontFamily: "monospace" }}>{diagnosticoCie}</span>
        <span className="small fw-semibold">{diagnosticoDesc}</span>
      </div>

      {loading && <div className="text-muted"><span className="spinner-border spinner-border-sm me-2"></span>Buscando medicamentos…</div>}

      {!loading && sugeridas.length === 0 && (
        <p className="text-muted">No hay sugerencias específicas para este diagnóstico. Usa el catálogo de medicamentos en la receta.</p>
      )}

      {sugeridas.length > 0 && (
        <p className="text-muted small mb-2">{sugeridas.length} medicamento(s) frecuente(s) para este diagnóstico:</p>
      )}

      {sugeridas.map(med => (
        <div key={med.id} className={`card border-0 shadow-sm mb-2 ${agregados.has(med.id) ? "border-success" : ""}`}
          style={{ borderLeft: agregados.has(med.id) ? "3px solid #198754" : "3px solid #dee2e6" }}>
          <div className="card-body py-2 px-3">
            <div className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1">
                <div className="fw-semibold small">{med.nombre_generico}</div>
                {med.nombre_comercial && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{med.nombre_comercial}</div>}
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {med.presentacion && <span className="badge text-bg-light border" style={{ fontSize: "0.7rem" }}>{med.presentacion}</span>}
                  {med.dosis_default && <span className="badge text-bg-info bg-opacity-10 text-info border" style={{ fontSize: "0.7rem" }}>{med.dosis_default}</span>}
                  {med.duracion_default && <span className="badge text-bg-secondary bg-opacity-10 border" style={{ fontSize: "0.7rem" }}>{med.duracion_default}</span>}
                </div>
                {med.instrucciones_default && (
                  <div className="text-muted mt-1" style={{ fontSize: "0.74rem" }}>{med.instrucciones_default}</div>
                )}
              </div>
              {!agregados.has(med.id) ? (
                <button className="btn btn-outline-primary btn-sm ms-2 text-nowrap"
                  style={{ flexShrink: 0 }}
                  onClick={() => {
                    setAgregados(prev => new Set(prev).add(med.id));
                    onAgregar([{
                      medicamento_id:    med.id,
                      medicamento_texto: med.nombre_generico + (med.presentacion ? ` (${med.presentacion})` : ""),
                      dosis:             med.dosis_default        || "",
                      duracion:          med.duracion_default     || "",
                      cantidad:          med.cantidad_default     || "",
                      instrucciones:     med.instrucciones_default || "",
                    }]);
                  }}>
                  <i className="bi bi-plus-circle me-1"></i>Agregar a receta
                </button>
              ) : (
                <span className="badge bg-success ms-2" style={{ padding: "6px 10px" }}>
                  <i className="bi bi-check-lg me-1"></i>Seleccionado
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-tab: Recetas favoritas del médico ─────────────────────────────────────
function SubFavoritas({ firmada }) {
  const [favoritas, setFavoritas] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [expandedFav, setExpandedFav] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  const cargar = () => {
    setLoading(true);
    api.get("/prescripciones/favoritas")
      .then(r => setFavoritas(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const eliminar = async (id) => {
    try {
      await api.delete(`/prescripciones/favoritas/${id}`);
      setFavoritas(prev => prev.filter(f => f.id !== id));
    } catch {
      setAlertMsg({ type: "danger", msg: "No se pudo eliminar" });
    }
  };

  if (loading) return <div className="text-center py-4"><span className="spinner-border spinner-border-sm"></span></div>;

  return (
    <div>
      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} py-2 alert-dismissible mb-3`}>
          {alertMsg.msg} <button className="btn-close" onClick={() => setAlertMsg(null)} />
        </div>
      )}

      {favoritas.length === 0 && (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-bookmark-heart" style={{ fontSize: "2.5rem", opacity: 0.3 }}></i>
          <p className="mt-2 small">No tienes recetas favoritas guardadas.<br/>Crea una receta y usa el botón <strong>"Guardar como favorita"</strong>.</p>
        </div>
      )}

      {favoritas.map(fav => (
        <div key={fav.id} className="card border-0 shadow-sm mb-2">
          <div className="card-body py-2 px-3">
            <div className="d-flex justify-content-between align-items-center"
              style={{ cursor: "pointer" }}
              onClick={() => setExpandedFav(expandedFav === fav.id ? null : fav.id)}>
              <div>
                <i className="bi bi-bookmark-heart-fill text-warning me-2"></i>
                <strong className="small">{fav.nombre}</strong>
                <span className="badge text-bg-light border ms-2" style={{ fontSize: "0.7rem" }}>
                  {fav.items?.length || 0} med.
                </span>
              </div>
              <div className="d-flex gap-1 align-items-center">
                <small className="text-muted me-2">{dayjs(fav.creado_en).format("DD/MM/YY")}</small>
                {!firmada && (
                  <button className="btn btn-sm btn-outline-secondary py-0 px-2"
                    style={{ fontSize: "0.72rem" }}
                    title="Usar esta receta en la consulta actual"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Mensaje orientativo — el usuario la ve y la recrea manualmente o con el buscador
                      setAlertMsg({ type: "info", msg: `Ve a "Nueva Receta" y usa el buscador para agregar los medicamentos de "${fav.nombre}".` });
                      setExpandedFav(fav.id);
                    }}>
                    <i className="bi bi-clipboard-plus me-1"></i>Usar
                  </button>
                )}
                <button className="btn btn-sm btn-outline-danger py-0 px-2"
                  style={{ fontSize: "0.72rem" }}
                  onClick={(e) => { e.stopPropagation(); eliminar(fav.id); }}>
                  <i className="bi bi-trash3"></i>
                </button>
              </div>
            </div>
            {expandedFav === fav.id && fav.items?.length > 0 && (
              <div className="mt-2 pt-2 border-top">
                {fav.notas && <p className="text-muted small mb-2 fst-italic">"{fav.notas}"</p>}
                {fav.items.map((it, i) => (
                  <div key={i} className="d-flex align-items-start gap-2 mb-1">
                    <i className="bi bi-capsule text-warning mt-1" style={{ fontSize: "0.75rem" }}></i>
                    <div style={{ fontSize: "0.82rem" }}>
                      <strong>{it.medicamento_texto}</strong>
                      {it.dosis && <span className="ms-2 badge text-bg-light border">{it.dosis}</span>}
                      {it.duracion && <span className="ms-1 text-muted">· {it.duracion}</span>}
                      {it.cantidad && <span className="ms-1 text-muted">· {it.cantidad}</span>}
                      {it.instrucciones && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{it.instrucciones}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: Estudios
// ══════════════════════════════════════════════════════════════════════
const ESTADO_BADGE = {
  SOLICITADO:  "warning",
  EN_PROCESO:  "info",
  COMPLETADO:  "success",
  CANCELADO:   "secondary",
};

function EstudiosTab({ historiaId, pacienteId, firmada }) {
  const [list,     setList]     = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ tipo: "LABORATORIO", descripcion: "", urgente: false });
  const [saving,   setSaving]   = useState(false);
  const [alertEstudios, setAlertEstudios] = useState(null);

  // ── Catálogo de estudios ──
  const [catEstQuery, setCatEstQuery] = useState("");
  const [catEstList, setCatEstList]   = useState([]);
  const [showCatEst, setShowCatEst]   = useState(false);

  useEffect(() => {
    if (!catEstQuery || catEstQuery.length < 2) { setCatEstList([]); return; }
    const t = setTimeout(() => {
      api.get("/catalogos-estudios", { params: { q: catEstQuery } })
        .then(r => { setCatEstList(r.data.data || []); setShowCatEst(true); })
        .catch(() => setCatEstList([]));
    }, 300);
    return () => clearTimeout(t);
  }, [catEstQuery]);

  const selCatEst = (cat) => {
    setForm(f => ({
      ...f,
      tipo: cat.categoria || "LABORATORIO",
      descripcion: f.descripcion
        ? f.descripcion + ", " + cat.nombre + (cat.descripcion ? ` (${cat.descripcion})` : "")
        : cat.nombre + (cat.descripcion ? ` (${cat.descripcion})` : ""),
    }));
    setCatEstQuery("");
    setCatEstList([]);
    setShowCatEst(false);
  };

  useEffect(() => {
    if (!historiaId && !pacienteId) return;
    const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
    api.get("/estudios", { params })
      .then(r => setList(r.data.data || []))
      .catch(() => {});
  }, [historiaId, pacienteId]);

  const handleSubmit = async () => {
    if (!form.descripcion) { setAlertEstudios({ type: "danger", msg: "Ingresa la descripción" }); return; }
    setSaving(true);
    try {
      await api.post("/estudios", {
        paciente_id: pacienteId,
        historia_id: historiaId || null,
        tipo:        form.tipo,
        descripcion: form.descripcion,
        urgente:     form.urgente ? 1 : 0,
      });
      const params = historiaId ? { historia_id: historiaId } : { paciente_id: pacienteId };
      const r = await api.get("/estudios", { params });
      setList(r.data.data || []);
      setShowForm(false);
      setForm({ tipo: "LABORATORIO", descripcion: "", urgente: false });
      setAlertEstudios({ type: "success", msg: "Solicitud creada" });
    } catch (e) {
      setAlertEstudios({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {alertEstudios && (
        <div className={`alert alert-${alertEstudios.type} py-2 alert-dismissible mb-3`}>
          {alertEstudios.msg} <button className="btn-close" onClick={() => setAlertEstudios(null)} />
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Solicitudes de Estudios</h6>
        {!firmada && !showForm && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Nueva Solicitud</button>
        )}
      </div>

      {list.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af" }}>
          <i className="bi bi-eyedropper" style={{ fontSize: "2.5rem", opacity: .3 }} />
          <p className="mt-2 small">Sin solicitudes para esta consulta.</p>
        </div>
      )}

      {list.map(s => (
        <div key={s.id} style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#0891b2,#0e7490)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="bi bi-eyedropper" style={{ color: "#fff", fontSize: "0.85rem" }} />
            </div>
            <div>
              <span className={`badge me-2 ${
                s.estado === "COMPLETADO" ? "bg-success" :
                s.estado === "CANCELADO"  ? "bg-secondary" :
                s.estado === "EN_PROCESO" ? "bg-info text-dark" :
                "bg-warning text-dark"
              }`} style={{ fontSize: "0.68rem" }}>{s.estado}</span>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{s.tipo}</span>
              {s.urgente === 1 && <span className="badge bg-danger ms-1" style={{ fontSize: "0.65rem" }}>URGENTE</span>}
              <div style={{ fontSize: "0.78rem", color: "#555", marginTop: 2 }}>{s.descripcion}</div>
              <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: 1 }}>{dayjs(s.creado_en).format("DD/MM/YYYY HH:mm")}</div>
            </div>
          </div>
          <div className="d-flex gap-1 flex-shrink-0">
            {s.estado === "SOLICITADO" && !firmada && (
              <button
                className="btn btn-outline-success btn-sm"
                style={{ fontSize: "0.75rem", borderRadius: 7 }}
                onClick={() => api.patch(`/estudios/${s.id}/estado`, { estado: "EN_PROCESO" })
                  .then(() => setList(prev => prev.map(x => x.id === s.id ? { ...x, estado: "EN_PROCESO" } : x)))}>
                <i className="bi bi-arrow-right me-1" />En Proceso
              </button>
            )}
            <button
              style={{ background: "transparent", border: "1px solid #3b82f6", borderRadius: 7, color: "#3b82f6", padding: "4px 12px", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}
              onClick={async () => {
                try {
                  const r = await api.get(`/estudios/pdf?paciente_id=${pacienteId}${historiaId ? `&historia_id=${historiaId}` : ""}`, { responseType: "blob" });
                  window.open(URL.createObjectURL(new Blob([r.data], { type: "application/pdf" })), "_blank");
                } catch { alert("Error al generar PDF"); }
              }}>
              <i className="bi bi-printer me-1" />PDF
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="card border-primary shadow-sm mt-3">
          <div className="card-header fw-semibold">Nueva Solicitud</div>
          <div className="card-body row g-2">
            {/* Buscador de catálogo de estudios */}
            <div className="col-12 position-relative">
              <label className="form-label small">
                <i className="bi bi-journal-bookmark-fill text-info me-1"></i>Buscar en catálogo de estudios
              </label>
              <input className="form-control form-control-sm" placeholder="Buscar estudio del catálogo…"
                value={catEstQuery}
                onChange={e => setCatEstQuery(e.target.value)}
                onFocus={() => catEstList.length > 0 && setShowCatEst(true)} />
              {showCatEst && catEstList.length > 0 && (
                <ul className="list-group position-absolute z-3 shadow"
                  style={{ top: "100%", left: 0, right: 0, maxHeight: 180, overflowY: "auto" }}>
                  {catEstList.map(c => (
                    <li key={c.id} className="list-group-item list-group-item-action py-1"
                      style={{ cursor: "pointer", fontSize: "0.82rem" }}
                      onClick={() => selCatEst(c)}>
                      <i className="bi bi-lightning-fill text-warning me-1"></i>
                      <strong>{c.nombre}</strong>
                      <span className={`badge ms-2 ${c.categoria === "LABORATORIO" ? "bg-primary" : c.categoria === "IMAGENOLOGIA" ? "bg-info text-dark" : "bg-secondary"}`} style={{ fontSize: "0.68rem" }}>
                        {c.categoria}
                      </span>
                      {c.descripcion && <span className="text-muted ms-1">— {c.descripcion}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="col-md-4">
              <label className="form-label small">Tipo</label>
              <select className="form-select form-select-sm"
                value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {["LABORATORIO","IMAGENOLOGIA","OTRO"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-md-8">
              <label className="form-label small">Descripción de estudios</label>
              <textarea className="form-control form-control-sm" rows={2}
                placeholder="Hemograma completo, glucosa, creatinina…"
                value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className="col-12">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="urgente-check"
                  checked={form.urgente} onChange={e => setForm(f => ({ ...f, urgente: e.target.checked }))} />
                <label className="form-check-label small" htmlFor="urgente-check">Urgente</label>
              </div>
            </div>
            <div className="col-12 d-flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
                {saving ? "Guardando…" : "Crear Solicitud"}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: Antecedentes & Alergias
// ══════════════════════════════════════════════════════════════════════
const TIPOS_ANTECEDENTE = ["patologico","quirurgico","familiar","ginecobstetrico","habitos","otros"];
const SEVERIDAD_COLOR   = { LEVE: "success", MODERADA: "warning", SEVERA: "danger", MORTAL: "dark" };

function AntecedentesTab({ pacienteId, firmada }) {
  const [antecedentes, setAntecedentes] = useState([]);
  const [alergias,     setAlergias]     = useState([]);
  const [showAnt,      setShowAnt]      = useState(false);
  const [showAler,     setShowAler]     = useState(false);
  const [formAnt,      setFormAnt]      = useState({ tipo: "patologico", descripcion: "" });
  const [formAler,     setFormAler]     = useState({ agente: "", tipo: "MEDICAMENTO", severidad: "MODERADA", reaccion: "" });
  const [saving,       setSaving]       = useState(false);
  const [alertAntecedentes, setAlertAntecedentes] = useState(null);

  useEffect(() => {
    if (!pacienteId) return;
    Promise.all([
      api.get(`/historias/paciente/${pacienteId}/antecedentes`),
      api.get(`/historias/paciente/${pacienteId}/alergias`),
    ]).then(([a, al]) => {
      setAntecedentes(a.data.data || []);
      setAlergias(al.data.data || []);
    }).catch(() => {});
  }, [pacienteId]);

  const saveAntecedente = async () => {
    if (!formAnt.descripcion) return;
    setSaving(true);
    try {
      await api.post(`/historias/paciente/${pacienteId}/antecedentes`, formAnt);
      const r = await api.get(`/historias/paciente/${pacienteId}/antecedentes`);
      setAntecedentes(r.data.data || []);
      setShowAnt(false);
      setFormAnt({ tipo: "patologico", descripcion: "" });
    } catch (e) {
      setAlertAntecedentes({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  const saveAlergia = async () => {
    if (!formAler.agente) return;
    setSaving(true);
    try {
      await api.post(`/historias/paciente/${pacienteId}/alergias`, formAler);
      const r = await api.get(`/historias/paciente/${pacienteId}/alergias`);
      setAlergias(r.data.data || []);
      setShowAler(false);
      setFormAler({ agente: "", tipo: "MEDICAMENTO", severidad: "MODERADA", reaccion: "" });
    } catch (e) {
      setAlertAntecedentes({ type: "danger", msg: e.response?.data?.msg || "Error" });
    } finally {
      setSaving(false);
    }
  };

  // agrupar antecedentes por tipo
  const byTipo = TIPOS_ANTECEDENTE.reduce((acc, t) => {
    acc[t] = antecedentes.filter(a => a.tipo === t);
    return acc;
  }, {});

  return (
    <div className="row g-3">
      {alertAntecedentes && (
        <div className="col-12">
          <div className={`alert alert-${alertAntecedentes.type} py-2`}>{alertAntecedentes.msg}</div>
        </div>
      )}

      {/* Alergias */}
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">Alergias Conocidas</h6>
              {!firmada && (
                <button className="btn btn-outline-danger btn-sm" onClick={() => setShowAler(!showAler)}>
                  + Alergia
                </button>
              )}
            </div>

            {alergias.length === 0 && <p className="text-muted small mb-0">Sin alergias registradas.</p>}
            <div className="d-flex flex-wrap gap-2">
              {alergias.map(a => (
                <span key={a.id} className={`badge bg-${SEVERIDAD_COLOR[a.severidad] || "secondary"}`}>
                  ⚠ {a.agente} ({a.tipo}) — {a.severidad}
                </span>
              ))}
            </div>

            {showAler && (
              <div className="row g-2 mt-2 border-top pt-2">
                <div className="col-md-4">
                  <input className="form-control form-control-sm" placeholder="Agente (ej: Penicilina)"
                    value={formAler.agente} onChange={e => setFormAler(f => ({ ...f, agente: e.target.value }))} />
                </div>
                <div className="col-md-3">
                  <select className="form-select form-select-sm"
                    value={formAler.tipo} onChange={e => setFormAler(f => ({ ...f, tipo: e.target.value }))}>
                    {["MEDICAMENTO","ALIMENTO","AMBIENTAL","OTRO"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <select className="form-select form-select-sm"
                    value={formAler.severidad} onChange={e => setFormAler(f => ({ ...f, severidad: e.target.value }))}>
                    {["LEVE","MODERADA","SEVERA","MORTAL"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-md-2">
                  <button className="btn btn-danger btn-sm w-100" onClick={saveAlergia} disabled={saving}>
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Antecedentes */}
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0">Antecedentes</h6>
              {!firmada && (
                <button className="btn btn-outline-primary btn-sm" onClick={() => setShowAnt(!showAnt)}>
                  + Antecedente
                </button>
              )}
            </div>

            {TIPOS_ANTECEDENTE.map(tipo => (
              byTipo[tipo]?.length > 0 && (
                <div key={tipo} className="mb-3">
                  <div className="text-muted small fw-semibold text-uppercase mb-1">{tipo.replace("_", " ")}</div>
                  {byTipo[tipo].map(a => (
                    <div key={a.id} className="d-flex align-items-start gap-2 mb-1">
                      <span className="text-muted">•</span>
                      <span className="small">{a.descripcion}</span>
                    </div>
                  ))}
                </div>
              )
            ))}

            {antecedentes.length === 0 && !showAnt && (
              <p className="text-muted small">Sin antecedentes registrados.</p>
            )}

            {showAnt && (
              <div className="row g-2 border-top pt-2">
                <div className="col-md-4">
                  <select className="form-select form-select-sm"
                    value={formAnt.tipo} onChange={e => setFormAnt(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS_ANTECEDENTE.map(t => (
                      <option key={t} value={t}>{t.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <input className="form-control form-control-sm" placeholder="Descripción"
                    value={formAnt.descripcion} onChange={e => setFormAnt(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
                <div className="col-md-2">
                  <button className="btn btn-primary btn-sm w-100" onClick={saveAntecedente} disabled={saving}>
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAB: Dermatología — campos específicos de la especialidad
// ══════════════════════════════════════════════════════════════════════
const FOTOTIPOS_FITZPATRICK = [
  { val: "I",   label: "I — Siempre quema, nunca broncea (piel muy clara)" },
  { val: "II",  label: "II — Generalmente quema, poco broncea" },
  { val: "III", label: "III — A veces quema, broncea gradualmente" },
  { val: "IV",  label: "IV — Rara vez quema, broncea fácilmente (piel morena)" },
  { val: "V",   label: "V — Muy rara vez quema, broncea intensamente" },
  { val: "VI",  label: "VI — Nunca quema, pigmentación intensa" },
];

const EXPOSICION_SOLAR_OPTS = ["Mínima", "Moderada (1–2 h/día)", "Alta (>2 h/día)", "Ocupacional"];

function DermaFieldGroup({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #e5e7eb" }}>
        <i className={`bi ${icon}`} style={{ color: "#1d4ed8", fontSize: "1rem" }}></i>
        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function DermaField({ label, children }) {
  return (
    <div className="mb-3">
      <label className="form-label small mb-1" style={{ fontWeight: 600, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );
}

function DermaTab({ datosDerma, setDatosDerma, firmada, paciente, pacienteId }) {
  const set = (key, val) => setDatosDerma(prev => ({ ...prev, [key]: val }));
  const d = datosDerma;
  const [procCatalogo, setProcCatalogo] = useState([]);
  const [procPick, setProcPick] = useState("");
  const [showAgendarModal, setShowAgendarModal] = useState(false);

  useEffect(() => {
    api.get("/catalogos-procedimientos")
      .then(r => setProcCatalogo(r.data.data || []))
      .catch(() => setProcCatalogo([]));
  }, []);

  const inputStyle = { borderRadius: 7, fontSize: "0.85rem" };
  const textareaStyle = { borderRadius: 7, fontSize: "0.85rem", resize: "vertical" };
  const agregarProcedimientoPrevio = () => {
    const nombre = (procPick || "").trim();
    if (!nombre) return;
    const actual = (d.tratamientos_previos || "").trim();
    const next = actual ? `${actual}, ${nombre}` : nombre;
    set("tratamientos_previos", next);
    setProcPick("");
  };

  return (
    <div>
      {/* Banner informativo */}
      <div style={{ background: "linear-gradient(135deg, #f0f5ff, #e8f0fe)", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <i className="bi bi-bandaid-fill" style={{ color: "#1d4ed8", fontSize: "1.2rem" }}></i>
        <div>
          <span style={{ fontWeight: 700, color: "#1a2744", fontSize: "0.9rem" }}>Historia Clínica Dermatológica</span>
          <div style={{ fontSize: "0.75rem", color: "#2563eb", marginTop: 1 }}>Campos específicos para consultas de dermatología y estética. Se guardan junto con la historia SOAP al presionar Borrador o Firmar.</div>
        </div>
      </div>

      <div className="row g-0">
        <div className="col-md-6 pe-md-3">

          <DermaFieldGroup title="Datos clínicos" icon="bi-clipboard2-pulse">
            <DermaField label="Tiempo de evolución">
              <input className="form-control form-control-sm" style={inputStyle}
                placeholder="Ej: 3 semanas, 2 meses…"
                disabled={firmada}
                value={d.tiempo_evolucion || ""}
                onChange={e => set("tiempo_evolucion", e.target.value)} />
            </DermaField>
            <DermaField label="Localización anatómica">
              <input className="form-control form-control-sm" style={inputStyle}
                placeholder="Ej: cara, espalda, extremidades inferiores…"
                disabled={firmada}
                value={d.localizacion_anatomica || ""}
                onChange={e => set("localizacion_anatomica", e.target.value)} />
            </DermaField>
            <DermaField label="Tratamientos previos para este padecimiento">
              <textarea className="form-control form-control-sm" rows={2} style={textareaStyle}
                placeholder="Medicamentos, procedimientos, cremas utilizadas…"
                disabled={firmada}
                value={d.tratamientos_previos || ""}
                onChange={e => set("tratamientos_previos", e.target.value)} />
              <div className="d-flex gap-2 mt-2">
                <input
                  className="form-control form-control-sm"
                  style={inputStyle}
                  placeholder="Agregar desde catálogo de procedimientos…"
                  value={procPick}
                  onChange={(e) => setProcPick(e.target.value)}
                  list="derma-procedimientos-list"
                  disabled={firmada}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={agregarProcedimientoPrevio}
                  disabled={firmada || !procPick.trim()}
                >
                  Agregar
                </button>
              </div>
              <datalist id="derma-procedimientos-list">
                {procCatalogo.map((p) => (
                  <option key={p.id} value={p.nombre} />
                ))}
              </datalist>
            </DermaField>
          </DermaFieldGroup>

          <DermaFieldGroup title="Antecedentes dermatológicos" icon="bi-person-lines-fill">
            <DermaField label="Antecedentes dermatológicos personales">
              <textarea className="form-control form-control-sm" rows={2} style={textareaStyle}
                placeholder="Enfermedades de piel previas, psoriasis, eczema, acné severo…"
                disabled={firmada}
                value={d.antecedentes_derma_personales || ""}
                onChange={e => set("antecedentes_derma_personales", e.target.value)} />
            </DermaField>
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <label className="form-label small mb-0" style={{ fontWeight: 600, color: "#374151" }}>
                  Antecedentes familiares de cáncer de piel
                </label>
                <div className="d-flex gap-2">
                  {["Sí", "No", "Desconoce"].map(op => (
                    <label key={op} className="d-flex align-items-center gap-1" style={{ cursor: "pointer", fontSize: "0.82rem" }}>
                      <input type="radio" name="antecedentes_fam_cancer"
                        disabled={firmada}
                        checked={d.antecedentes_fam_cancer_piel === op}
                        onChange={() => set("antecedentes_fam_cancer_piel", op)} />
                      {op}
                    </label>
                  ))}
                </div>
              </div>
              {d.antecedentes_fam_cancer_piel === "Sí" && (
                <input className="form-control form-control-sm mt-1" style={inputStyle}
                  placeholder="Especificar tipo y parentesco…"
                  disabled={firmada}
                  value={d.antecedentes_fam_cancer_detalle || ""}
                  onChange={e => set("antecedentes_fam_cancer_detalle", e.target.value)} />
              )}
            </div>
          </DermaFieldGroup>

        </div>
        <div className="col-md-6 ps-md-3">

          <DermaFieldGroup title="Características del paciente" icon="bi-person-badge">
            <DermaField label="Fototipo de Fitzpatrick">
              <select className="form-select form-select-sm" style={inputStyle}
                disabled={firmada}
                value={d.fototipo_fitzpatrick || ""}
                onChange={e => set("fototipo_fitzpatrick", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {FOTOTIPOS_FITZPATRICK.map(f => (
                  <option key={f.val} value={f.val}>{f.label}</option>
                ))}
              </select>
            </DermaField>
            <DermaField label="Exposición solar habitual">
              <select className="form-select form-select-sm" style={inputStyle}
                disabled={firmada}
                value={d.exposicion_solar || ""}
                onChange={e => set("exposicion_solar", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {EXPOSICION_SOLAR_OPTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </DermaField>
            <div className="mb-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <label className="form-label small mb-0" style={{ fontWeight: 600, color: "#374151" }}>Usa protector solar</label>
                <div className="d-flex gap-2">
                  {["Sí", "No", "A veces"].map(op => (
                    <label key={op} className="d-flex align-items-center gap-1" style={{ cursor: "pointer", fontSize: "0.82rem" }}>
                      <input type="radio" name="usa_protector_solar"
                        disabled={firmada}
                        checked={d.usa_protector_solar === op}
                        onChange={() => set("usa_protector_solar", op)} />
                      {op}
                    </label>
                  ))}
                </div>
              </div>
              {d.usa_protector_solar === "Sí" && (
                <input className="form-control form-control-sm mt-1" style={inputStyle}
                  placeholder="FPS / frecuencia de aplicación…"
                  disabled={firmada}
                  value={d.protector_solar_detalle || ""}
                  onChange={e => set("protector_solar_detalle", e.target.value)} />
              )}
            </div>
            <DermaField label="Ocupación">
              <input className="form-control form-control-sm" style={inputStyle}
                placeholder="Ej: agricultora, maestra, oficinista…"
                disabled={firmada}
                value={d.ocupacion || ""}
                onChange={e => set("ocupacion", e.target.value)} />
            </DermaField>
          </DermaFieldGroup>

          <DermaFieldGroup title="Clínica y plan" icon="bi-journal-medical">
            <DermaField label="Diagnósticos diferenciales">
              <textarea className="form-control form-control-sm" rows={2} style={textareaStyle}
                placeholder="Listado de diagnósticos a descartar…"
                disabled={firmada}
                value={d.diagnosticos_diferenciales || ""}
                onChange={e => set("diagnosticos_diferenciales", e.target.value)} />
            </DermaField>
            <DermaField label="Indicaciones médicas / postprocedimiento">
              <textarea className="form-control form-control-sm" rows={3} style={textareaStyle}
                placeholder="Cuidados en casa, restricciones, signos de alarma…"
                disabled={firmada}
                value={d.indicaciones_medicas || ""}
                onChange={e => set("indicaciones_medicas", e.target.value)} />
            </DermaField>
            <DermaField label="Próxima cita sugerida">
              {d.proxima_cita ? (
                <div className="d-flex align-items-center gap-2 px-2 py-2 rounded border"
                  style={{ background: "rgba(26,39,68,0.06)", borderColor: "#bfdbfe" }}>
                  <i className="bi bi-calendar-check-fill" style={{ color: "#1a2744", flexShrink: 0 }}></i>
                  <span className="flex-grow-1 small fw-semibold" style={{ color: "#1a2744" }}>
                    {dayjs(d.proxima_cita).isValid()
                      ? dayjs(d.proxima_cita).format("dddd D [de] MMMM [de] YYYY [·] HH:mm")
                      : d.proxima_cita}
                  </span>
                  {!firmada && (
                    <button type="button" className="btn btn-link btn-sm p-0 text-danger lh-1"
                      title="Quitar cita"
                      onClick={() => set("proxima_cita", "")}>
                      <i className="bi bi-x-circle-fill"></i>
                    </button>
                  )}
                </div>
              ) : (
                <button type="button"
                  className="btn btn-sm w-100"
                  disabled={firmada}
                  style={{
                    borderRadius: 7, fontSize: "0.82rem", borderStyle: "dashed",
                    border: "1px dashed #243b72", color: "#1a2744",
                    background: "rgba(26,39,68,0.04)",
                  }}
                  onClick={() => setShowAgendarModal(true)}>
                  <i className="bi bi-calendar-plus me-2"></i>Ver disponibilidad y agendar…
                </button>
              )}
            </DermaField>
            {showAgendarModal && (
              <ModalAgendarProximaCita
                paciente={paciente}
                pacienteId={pacienteId}
                onClose={() => setShowAgendarModal(false)}
                onConfirm={(fechaHora) => {
                  set("proxima_cita", fechaHora);
                  setShowAgendarModal(false);
                }}
              />
            )}
          </DermaFieldGroup>

        </div>
      </div>

      {!firmada && (
        <div style={{ marginTop: 4, padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: "0.78rem", color: "#15803d", display: "flex", alignItems: "center", gap: 8 }}>
          <i className="bi bi-info-circle-fill"></i>
          Los campos de esta pestaña se guardan automáticamente junto con el SOAP al presionar <strong>Borrador</strong> o <strong>Firmar y Cerrar</strong>.
        </div>
      )}
    </div>
  );
}

// ─── Modal Agendar Próxima Cita (desde tab Derma) ────────────────────────────
function ModalAgendarProximaCita({ paciente, pacienteId, onClose, onConfirm }) {
  const [medicos,     setMedicos]     = useState([]);
  const [medicoId,    setMedicoId]    = useState("");
  const [fechaSel,    setFechaSel]    = useState(dayjs().add(1, "week").format("YYYY-MM-DD"));
  const [slots,       setSlots]       = useState([]);
  const [slotSel,     setSlotSel]     = useState(null);
  const [horaInicio,  setHoraInicio]  = useState("");
  const [horaFin,     setHoraFin]     = useState("");
  const [tipo,        setTipo]        = useState("CONTROL");
  const [motivo,      setMotivo]      = useState("");
  const [loadSlots,   setLoadSlots]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState("");

  useEffect(() => {
    api.get("/usuarios/medicos")
      .then(r => setMedicos(r.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!medicoId || !fechaSel) { setSlots([]); return; }
    setLoadSlots(true);
    api.get("/citas/slots", { params: { medico_id: medicoId, fecha: fechaSel } })
      .then(r => setSlots(r.data.data || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadSlots(false));
  }, [medicoId, fechaSel]);

  const selSlot = (s) => {
    setSlotSel(s);
    setHoraInicio(dayjs(s.inicio).format("HH:mm"));
    setHoraFin(dayjs(s.fin).format("HH:mm"));
  };

  const handleConfirm = async () => {
    if (!medicoId) { setErr("Selecciona un médico"); return; }
    if (!horaInicio || !horaFin) { setErr("Selecciona un horario"); return; }
    const inicio = dayjs(`${fechaSel} ${horaInicio}`);
    const fin    = dayjs(`${fechaSel} ${horaFin}`);
    if (fin.isBefore(inicio) || fin.isSame(inicio)) {
      setErr("La hora de fin debe ser posterior a la de inicio"); return;
    }
    setSaving(true); setErr("");
    try {
      await api.post("/citas", {
        paciente_id:   paciente?.id || pacienteId,
        medico_id:     medicoId,
        inicio:        inicio.format("YYYY-MM-DD HH:mm:ss"),
        fin:           fin.format("YYYY-MM-DD HH:mm:ss"),
        tipo_consulta: tipo,
        motivo:        motivo || null,
        canal:         "RECEPCION",
      });
      onConfirm(inicio.format("YYYY-MM-DD HH:mm"));
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al agendar la cita");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 10500,
      background: "rgba(15,23,42,.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 560, background: "#fff",
        borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
          padding: "14px 18px", display: "flex", alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="bi bi-calendar-plus" style={{ color: "rgba(255,255,255,.8)", fontSize: "1.1rem" }}></i>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>Agendar próxima cita</div>
              {paciente && (
                <div style={{ color: "rgba(255,255,255,.65)", fontSize: "0.75rem" }}>
                  {paciente.nombres} {paciente.apellidos}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px" }}>
          {err && (
            <div className="alert alert-danger py-2 mb-3" style={{ borderRadius: 8, fontSize: "0.85rem" }}>
              <i className="bi bi-exclamation-triangle me-2"></i>{err}
            </div>
          )}

          {/* Médico */}
          <div className="mb-3">
            <label className="form-label fw-semibold small">Médico</label>
            <select className="form-select form-select-sm" value={medicoId} onChange={e => { setMedicoId(e.target.value); setSlotSel(null); setHoraInicio(""); setHoraFin(""); }}>
              <option value="">— Seleccionar médico —</option>
              {medicos.map(m => (
                <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos}{m.especialidad ? ` · ${m.especialidad}` : ""}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold small">Fecha</label>
              <input type="date" className="form-control form-control-sm"
                min={dayjs().add(1, "day").format("YYYY-MM-DD")}
                value={fechaSel}
                onChange={e => { setFechaSel(e.target.value); setSlotSel(null); setHoraInicio(""); setHoraFin(""); }} />
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Tipo de consulta</label>
              <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                {["CONTROL","PRIMERA_VEZ","EMERGENCIA","TELECONSULTA"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Slots disponibles */}
          {medicoId && (
            <div className="mb-3">
              <label className="form-label fw-semibold small d-flex align-items-center gap-2">
                Horarios disponibles
                {loadSlots && <span className="spinner-border spinner-border-sm text-secondary" style={{ width: "0.75rem", height: "0.75rem" }}></span>}
              </label>
              {!loadSlots && slots.length === 0 && (
                <div className="text-muted small" style={{ padding: "8px 0" }}>
                  <i className="bi bi-calendar-x me-1"></i>Sin horarios disponibles para esta fecha. Prueba otro día.
                </div>
              )}
              {slots.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {slots.map((s, i) => {
                    const isSel = slotSel?.inicio === s.inicio;
                    return (
                      <button key={i} type="button"
                        onClick={() => selSlot(s)}
                        style={{
                          padding: "5px 12px", borderRadius: 8, fontSize: "0.78rem",
                          fontWeight: isSel ? 700 : 500, cursor: "pointer",
                          border: `1.5px solid ${isSel ? "#1d4ed8" : "#d1d5db"}`,
                          background: isSel ? "#dbeafe" : "#f9fafb",
                          color: isSel ? "#1a2744" : "#374151",
                          transition: "all .12s",
                        }}>
                        {dayjs(s.inicio).format("HH:mm")} – {dayjs(s.fin).format("HH:mm")}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Hora manual (si no hay slots o quiere personalizar) */}
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label fw-semibold small">Hora inicio</label>
              <input type="time" className="form-control form-control-sm"
                value={horaInicio} onChange={e => { setHoraInicio(e.target.value); setSlotSel(null); }} />
            </div>
            <div className="col-6">
              <label className="form-label fw-semibold small">Hora fin</label>
              <input type="time" className="form-control form-control-sm"
                value={horaFin} onChange={e => { setHoraFin(e.target.value); setSlotSel(null); }} />
            </div>
          </div>

          {/* Motivo */}
          <div className="mb-1">
            <label className="form-label fw-semibold small">Motivo (opcional)</label>
            <input className="form-control form-control-sm" value={motivo}
              onChange={e => setMotivo(e.target.value)} placeholder="Control, revisión, seguimiento…" />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn btn-sm"
            disabled={saving || !medicoId || !horaInicio || !horaFin}
            onClick={handleConfirm}
            style={{
              background: "linear-gradient(135deg, #213564, #1a2744)",
              color: "#fff", border: "none", fontWeight: 600, borderRadius: 8,
              padding: "6px 20px",
            }}>
            <i className="bi bi-calendar-check me-1"></i>
            {saving ? "Agendando…" : "Confirmar cita"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal Nueva Consulta Sin Cita ────────────────────────────────────────────
function ModalConsultaSinCita({ paciente, onClose, onCreated }) {
  const [modo, setModo] = useState(null);
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState("");
  const [fechaSel, setFechaSel] = useState(dayjs().format("YYYY-MM-DD"));
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotSel, setSlotSel] = useState("");
  const [tipo, setTipo] = useState("PRIMERA_VEZ");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/usuarios/medicos")
      .then(r => setMedicos(r.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!medicoId || !fechaSel) { setSlots([]); return; }
    api.get("/citas/slots", { params: { medico_id: medicoId, fecha: fechaSel } })
      .then(r => setSlots(r.data.data || []))
      .catch(() => setSlots([]));
  }, [medicoId, fechaSel]);

  const selSlot = (s) => {
    setSlotSel(s.inicio);
    setHoraInicio(dayjs(s.inicio).format("HH:mm"));
    setHoraFin(dayjs(s.fin).format("HH:mm"));
  };

  const agendarAhora = async () => {
    if (!medicoId) { setErr("Selecciona un médico"); return; }
    setSaving(true); setErr("");
    try {
      const inicio = dayjs().format("YYYY-MM-DD HH:mm:ss");
      const fin = dayjs().add(30, "minute").format("YYYY-MM-DD HH:mm:ss");
      const res = await api.post("/citas", {
        paciente_id: paciente.id, medico_id: medicoId,
        inicio, fin, tipo_consulta: tipo, motivo: motivo || null, canal: "RECEPCION",
      });
      await api.patch(`/citas/${res.data.id}/estado`, { estado: "EN_ATENCION" });
      onCreated(res.data.id);
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  const agendarSeleccionado = async () => {
    if (!medicoId) { setErr("Selecciona un médico"); return; }
    if (!horaInicio || !horaFin) { setErr("Ingresa hora de inicio y fin"); return; }
    const inicio = dayjs(`${fechaSel} ${horaInicio}`);
    const fin = dayjs(`${fechaSel} ${horaFin}`);
    if (fin.isBefore(inicio) || fin.isSame(inicio)) {
      setErr("La hora de fin debe ser posterior a la hora de inicio"); return;
    }
    setSaving(true); setErr("");
    try {
      const res = await api.post("/citas", {
        paciente_id: paciente.id, medico_id: medicoId,
        inicio: inicio.format("YYYY-MM-DD HH:mm:ss"),
        fin: fin.format("YYYY-MM-DD HH:mm:ss"),
        tipo_consulta: tipo, motivo: motivo || null, canal: "RECEPCION",
      });
      onCreated(res.data.id);
    } catch (ex) {
      setErr(ex.response?.data?.msg || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ background: "rgba(0,0,0,.5)", zIndex: 9998 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: modo === "seleccionar" ? 600 : 500 }}>
        <div className="modal-content">
          <div className="modal-header" style={{ background: "#673ab7", color: "#fff" }}>
            <h5 className="modal-title">
              <i className="bi bi-clipboard2-pulse me-2"></i>Nueva Consulta
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="alert alert-warning py-2 mb-3">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>{paciente.nombres} {paciente.apellidos}</strong> no tiene consulta agendada para hoy.
            </div>
            {err && <div className="alert alert-danger py-2 mb-3">{err}</div>}

            {!modo && (
              <div className="text-center py-2">
                <p className="mb-3">¿Desea agendar una consulta?</p>
                <div className="d-flex justify-content-center gap-3">
                  <button className="btn btn-success px-4" onClick={() => setModo("ahora")}>
                    <i className="bi bi-clock-fill me-2"></i>Ahora
                  </button>
                  <button className="btn btn-primary px-4" onClick={() => setModo("seleccionar")}>
                    <i className="bi bi-calendar-event me-2"></i>Seleccionar
                  </button>
                </div>
              </div>
            )}

            {modo === "ahora" && (
              <div>
                <p className="text-muted small mb-2">
                  Se creará una cita para <strong>ahora ({dayjs().format("h:mm A")})</strong> con duración de 30 minutos.
                </p>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médico</label>
                  <select className="form-select" value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
                    ))}
                  </select>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                      {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Motivo</label>
                    <input className="form-control form-control-sm" value={motivo}
                      onChange={e => setMotivo(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              </div>
            )}

            {modo === "seleccionar" && (
              <div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médico</label>
                  <select className="form-select" value={medicoId} onChange={e => setMedicoId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {medicos.map(m => (
                      <option key={m.id} value={m.id}>Dr. {m.nombres} {m.apellidos} – {m.especialidad}</option>
                    ))}
                  </select>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha</label>
                    <input type="date" className="form-control" value={fechaSel}
                      onChange={e => setFechaSel(e.target.value)} />
                  </div>
                </div>
                {slots.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Horarios disponibles</label>
                    <div className="d-flex flex-wrap gap-2">
                      {slots.map((s, i) => (
                        <button key={i}
                          className={`btn btn-sm ${slotSel === s.inicio ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => selSlot(s)}>
                          {dayjs(s.inicio).format("HH:mm")} – {dayjs(s.fin).format("HH:mm")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Hora inicio</label>
                    <input type="time" className="form-control" value={horaInicio}
                      onChange={e => setHoraInicio(e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Hora fin</label>
                    <input type="time" className="form-control" value={horaFin}
                      onChange={e => setHoraFin(e.target.value)} />
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Tipo</label>
                    <select className="form-select form-select-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
                      {["PRIMERA_VEZ","CONTROL","EMERGENCIA","TELECONSULTA"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Motivo</label>
                    <input className="form-control form-control-sm" value={motivo}
                      onChange={e => setMotivo(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              </div>
            )}
          </div>
          {modo && (
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModo(null)}>Atrás</button>
              <button className="btn btn-success" disabled={saving}
                onClick={modo === "ahora" ? agendarAhora : agendarSeleccionado}>
                {saving ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          )}
          {!modo && (
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

