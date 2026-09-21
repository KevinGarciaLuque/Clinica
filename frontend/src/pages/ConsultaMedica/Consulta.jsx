/**
 * FASE 4 — Consulta SOAP (Historia Clínica Electrónica)
 * URL: /consulta-medica?paciente_id=&cita_id=&historia_id=
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import { calcIMC, calcSC, parseDerma } from "./helpers";
import PacienteResumenCard from "./PacienteResumenCard";
import ModalHistoriaFirmada from "./ModalHistoriaFirmada";
import ModalCobroConsulta from "./ModalCobroConsulta";
import ModalConfirmarEdicionFirmada from "./ModalConfirmarEdicionFirmada";
import ModalCambiosGuardados from "./ModalCambiosGuardados";
import ModalSinFirma from "./ModalSinFirma";
import ModalConsultaSinCita from "./ModalConsultaSinCita";
import SoapTab from "./SoapTab";
import PrescripcionTab from "./PrescripcionTab";
import EstudiosTab from "./EstudiosTab";
import AntecedentesTab from "./AntecedentesTab";
import DermaTab from "./DermaTab";
import DocumentosTab from "./DocumentosTab";
import EcocardiogramaTab, { PrintEco } from "./EcocardiogramaTab";

// ═══════════════════════════════════════════════════════════════════════════════
export default function Consulta() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const { modulos, user } = useAuth();
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
  const [showFacturaPrompt, setShowFacturaPrompt] = useState(false);
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
  const [registrarCurva, setRegistrarCurva] = useState(false);
  const [usarFirmaDigital, setUsarFirmaDigital] = useState(false);
  const [showModalSinFirma, setShowModalSinFirma] = useState(false);

  // Campos específicos dermatología
  const [datosDerma, setDatosDerma] = useState({});
  // Hoja de ecocardiograma (cardiología)
  const [datosEco, setDatosEco] = useState({});
  const [showEcoPrint, setShowEcoPrint] = useState(false);
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
            diagnostico_desc: h.diagnostico_desc || "",
            diagnosticos_secundarios: secDx,
          }));
          // recuperar descripción CIE-10 solo si no viene guardada
          if (h.diagnostico_cie && !h.diagnostico_desc) {
            api.get("/historias/cie10/buscar", { params: { q: h.diagnostico_cie } })
              .then(r => {
                const found = r.data.data?.find(x => x.codigo === h.diagnostico_cie);
                if (found) setSoap(s => ({ ...s, diagnostico_desc: found.descripcion }));
              }).catch(() => {});
          }
          // cargar datos dermatológicos
          setDatosDerma(parseDerma(h.datos_derma));
          // cargar hoja de ecocardiograma
          setDatosEco(parseDerma(h.datos_cardio_eco));
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

  // ── imc y sc automáticos ─────────────────────────────────────────────────────
  useEffect(() => {
    setVitals(v => ({ ...v, imc: calcIMC(v.peso, v.talla), sc: calcSC(v.peso, v.talla) }));
  }, [vitals.peso, vitals.talla]);

  // ── abrir impresión del eco directamente (?print_eco=1) ──────────────────────
  const ecoPrintAbierto = useRef(false);
  useEffect(() => {
    if (params.get("print_eco") === "1" && !ecoPrintAbierto.current && Object.keys(datosEco).length) {
      ecoPrintAbierto.current = true;
      setTab("cardio_eco");
      setShowEcoPrint(true);
    }
  }, [params, datosEco]);

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
        objetivo:    { ...vitals, imc: undefined, sc: undefined },
        examen_fisico: soap.examen_fisico,
        diagnostico_cie: soap.diagnostico_cie || null,
        diagnostico_desc: soap.diagnostico_desc || null,
        diagnosticos_secundarios: soap.diagnosticos_secundarios,
        plan:        soap.plan,
        estado:      sign ? "FIRMADA" : (firmada ? "FIRMADA" : "BORRADOR"),
        datos_derma: Object.keys(datosDerma).length ? datosDerma : null,
        datos_cardio_eco: Object.keys(datosEco).length ? datosEco : null,
      };

      if (hid) {
        const putUrl = (firmada && editMode)
          ? `/historias/${hid}?editar=1`
          : `/historias/${hid}`;
        await api.put(putUrl, payload);
        if (sign) {
          await api.post(`/historias/${hid}/firmar`, usarFirmaDigital && user?.firma_url ? { firma_digital_url: user.firma_url, colegiatura_firmante: user.numero_colegiatura || null } : {});
          setFirmada(true);
          setAlertMsg(null);
          setShowFacturaPrompt(true);
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
          await api.post(`/historias/${r.data.id}/firmar`, usarFirmaDigital && user?.firma_url ? { firma_digital_url: user.firma_url, colegiatura_firmante: user.numero_colegiatura || null } : {});
          setFirmada(true);
          setAlertMsg(null);
          setShowFacturaPrompt(true);
        } else {
          setAlertMsg({ type: "success", msg: "Guardado como borrador." });
        }
        return r.data.id;
      }
      return hid;
      // Registrar curva de crecimiento si el switch está activo
      if (registrarCurva) {
        const pid  = paciente?.id || pacId;
        const fnac = paciente?.fecha_nacimiento;
        const edadAnios = fnac ? dayjs().diff(dayjs(fnac), "year") : 99;
        if (pid && fnac && edadAnios < 19 && (vitals.peso || vitals.talla)) {
          const edadMeses = dayjs().diff(dayjs(fnac), "month");
          await api.post(`/crecimiento/${pid}`, {
            fecha_medicion:          dayjs().format("YYYY-MM-DD"),
            edad_meses:              edadMeses,
            peso_kg:                 vitals.peso  || null,
            talla_cm:                vitals.talla || null,
            perimetro_cefalico_cm:   vitals.pc    || null,
            notas:                   "Registrado desde consulta médica",
          }).catch(() => {}); // silencioso; no bloquea el guardado
        }
      }
    } catch (e) {
      setAlertMsg({ type: "danger", msg: e.response?.data?.msg || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  }, [soap, vitals, hid, paciente, pacId, citaId, firmada, editMode, datosDerma, datosEco, registrarCurva]);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const edad = paciente?.fecha_nacimiento
    ? dayjs().diff(dayjs(paciente.fecha_nacimiento), "year") + " años"
    : "";

  const esDerma = modulos.some(m => m.ruta?.startsWith("/estetica/"));
  const esCardioEco = modulos.some(m => m.clave === "cardiologia_ecocardiograma");

  const TAB_LIST = [
    { id: "soap",         icon: "bi-clipboard2-pulse", label: "SOAP" },
    ...(esDerma ? [{ id: "derma", icon: "bi-bandaid-fill", label: "Dermatología" }] : []),
    ...(esCardioEco ? [{ id: "cardio_eco", icon: "bi-heart-pulse-fill", label: "Ecocardiograma" }] : []),
    { id: "rx",           icon: "bi-capsule",          label: "Prescripción" },
    { id: "estudios",     icon: "bi-eyedropper",       label: "Estudios" },
    { id: "antecedentes", icon: "bi-folder2-open",     label: "Antecedentes" },
    { id: "documentos",   icon: "bi-paperclip",        label: "Documentos" },
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
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* Switch firma digital — solo si no está firmada */}
            {!firmada && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, padding: "5px 10px" }}>
                <i className="bi bi-pen-fill" style={{ color: usarFirmaDigital ? "#86efac" : "rgba(255,255,255,.45)", fontSize: "0.78rem" }} />
                <span style={{ fontSize: "0.73rem", color: usarFirmaDigital ? "#86efac" : "rgba(255,255,255,.6)", fontWeight: 500, whiteSpace: "nowrap" }}>
                  Firma digital
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!usarFirmaDigital && !user?.firma_url) {
                      setShowModalSinFirma(true);
                    } else {
                      setUsarFirmaDigital(v => !v);
                    }
                  }}
                  style={{
                    width: 38, height: 22, borderRadius: 11, flexShrink: 0,
                    background: usarFirmaDigital ? "#22c55e" : "rgba(255,255,255,.2)",
                    border: "none", padding: 0, cursor: "pointer",
                    position: "relative", transition: "background .2s",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 3,
                    left: usarFirmaDigital ? 19 : 3,
                    transition: "left .2s cubic-bezier(.4,0,.2,1)",
                    boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                  }} />
                </button>
              </div>
            )}

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
              paciente={paciente}
              registrarCurva={registrarCurva}
              setRegistrarCurva={setRegistrarCurva}
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
              firmaDigitalUrl={usarFirmaDigital ? user?.firma_url || null : null}
            />
          )}

          {/* ── Estudios ── */}
          {tab === "estudios" && (
            <EstudiosTab
              historiaId={hid}
              pacienteId={paciente?.id || pacId}
              citaId={citaId}
              firmada={soloLectura}
              firmaDigitalUrl={usarFirmaDigital ? user?.firma_url || null : null}
            />
          )}

          {/* ── Antecedentes ── */}
          {tab === "antecedentes" && (
            <AntecedentesTab
              pacienteId={paciente?.id || pacId}
              firmada={soloLectura}
            />
          )}

          {/* ── Documentos de la consulta ── */}
          {tab === "documentos" && (
            <DocumentosTab
              historiaId={hid}
              pacienteId={paciente?.id || pacId}
              firmada={soloLectura}
              onAutoSave={async () => handleSave(false)}
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

          {/* ── Ecocardiograma (cardiología) ── */}
          {tab === "cardio_eco" && (
            <EcocardiogramaTab
              datos={datosEco}
              setDatos={setDatosEco}
              firmada={soloLectura}
              vitals={vitals}
              paciente={paciente}
              onPrint={() => setShowEcoPrint(true)}
            />
          )}
        </div>{/* /tab-content */}
      </div>{/* /px-3 */}

      {/* Modal consulta sin cita agendada */}
      {showConsultaModal && consultaPaciente && createPortal(
        <ModalConsultaSinCita
          paciente={consultaPaciente}
          onClose={() => { setShowConsultaModal(false); setConsultaPaciente(null); }}
          onCreated={(citaId) => {
            setShowConsultaModal(false);
            navigate(`/consulta-medica?paciente_id=${consultaPaciente.id}&cita_id=${citaId}`);
            setConsultaPaciente(null);
          }}
        />,
        document.body
      )}

      {showEcoPrint && createPortal(
        <PrintEco
          datos={datosEco}
          vitals={vitals}
          paciente={paciente}
          user={user}
          onClose={() => setShowEcoPrint(false)}
        />,
        document.body
      )}

      {showSignedModal && createPortal(
        <ModalHistoriaFirmada
          paciente={paciente}
          onClose={() => setShowSignedModal(false)}
          onVerHistorial={() => {
            setShowSignedModal(false);
            if (paciente?.id) navigate(`/pacientes/${paciente.id}/perfil?tab=historial`);
          }}
        />,
        document.body
      )}

      {showFacturaPrompt && createPortal(
        <ModalCobroConsulta
          paciente={paciente}
          citaId={citaId}
          onOmitir={() => { setShowFacturaPrompt(false); setShowSignedModal(true); }}
          onListo={() => { setShowFacturaPrompt(false); setShowSignedModal(true); }}
          onFacturaFormal={() => {
            setShowFacturaPrompt(false);
            const pid = paciente?.id || pacId;
            navigate(`/facturacion?nueva=1&paciente_id=${pid}${citaId ? `&cita_id=${citaId}` : ""}`);
          }}
        />,
        document.body
      )}

      {showConfirmSignedEditSave && createPortal(
        <ModalConfirmarEdicionFirmada
          onCancel={() => setShowConfirmSignedEditSave(false)}
          onConfirm={async () => {
            setShowConfirmSignedEditSave(false);
            await handleSave(false);
          }}
          saving={saving}
        />,
        document.body
      )}

      {showSavedChangesModal && createPortal(
        <ModalCambiosGuardados
          onClose={() => setShowSavedChangesModal(false)}
        />,
        document.body
      )}

      {showModalSinFirma && createPortal(
        <ModalSinFirma
          onClose={() => setShowModalSinFirma(false)}
          onIrAPerfil={() => { setShowModalSinFirma(false); navigate("/perfil"); }}
        />,
        document.body
      )}
    </div>
  );
}
