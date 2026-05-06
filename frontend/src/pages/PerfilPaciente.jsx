/**
 * EXPEDIENTE COMPLETO DEL PACIENTE - Con pestañas profesionales
 * 1. Datos Generales
 * 2. Historial Clínico  
 * 3. Exámenes / Documentos
 * 4. Curvas de Crecimiento OMS
 * 5. Eliminar Paciente
 */
import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

const API_BASE_PP = (import.meta.env.VITE_API_URL || "http://localhost:5000");
const ESTADO_BADGE_PP = { BORRADOR: "warning text-dark", FIRMADA: "success" };
import CurvaCrecimiento from "../components/CurvaCrecimiento";
import AntecedentesClinico from "../components/AntecedentesClinico";
import VacunasCarnet from "../components/VacunasCarnet";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000");

const fotoUrl = (foto) => {
  if (!foto) return null;
  if (foto.startsWith("http")) return foto;
  return `${API_BASE}/uploads/${foto.replace(/^\/?uploads\//, "")}`;
};

// ── Departamentos y municipios de Honduras ──────────────────────────────────
const HONDURAS_DATA = {
  "Atlántida":         ["Arizona","El Porvenir","Esparta","Jutiapa","La Ceiba","La Masica","San Francisco","Tela"],
  "Choluteca":         ["Apacilagua","Choluteca","Concepción de María","Duyure","El Corpus","El Triunfo","Marcovia","Morolica","Namasigüe","Orocuina","Pespire","San Antonio de Flores","San Isidro","San José","San Marcos de Colón","Santa Ana de Yusguare"],
  "Colón":             ["Balfate","Bonito Oriental","Iriona","Limón","Sabá","Santa Rosa de Aguán","Sonaguera","Tocoa","Trujillo"],
  "Comayagua":         ["Ajuterique","Comayagua","El Rosario","Esquías","Humuya","La Libertad","La Trinidad","Lamaní","Las Lajas","Lejamaní","Minas de Oro","Ojos de Agua","San Jerónimo","San José de Comayagua","San José del Potrero","San Luis","San Sebastián","Siguatepeque","Taulabé","Villa de San Antonio"],
  "Copán":             ["Cabañas","Concepción","Copán Ruinas","Corquín","Cucuyagua","Dolores","Dulce Nombre","El Paraíso","Florida","La Jigua","La Unión","Nueva Arcadia","San Agustín","San Antonio","San Jerónimo","San José","San Juan de Opoa","San Nicolás","San Pedro","Santa Rita","Santa Rosa de Copán","Trinidad de Copán","Veracruz"],
  "Cortés":            ["Choloma","La Lima","Omoa","Pimienta","Potrerillos","Puerto Cortés","San Antonio de Cortés","San Francisco de Yojoa","San Manuel","San Pedro Sula","Santa Cruz de Yojoa","Villanueva"],
  "El Paraíso":        ["Alauca","Danlí","El Paraíso","Güinope","Jacaleapa","Liure","Morocelí","Oropolí","Potrerillos","San Antonio de Flores","San Lucas","San Matías","Soledad","Teupasenti","Texiguat","Trojes","Vado Ancho","Yauyupe","Yuscarán"],
  "Francisco Morazán": ["Alubarén","Cedros","Curarén","El Porvenir","Guaimaca","La Libertad","La Venta","Lepaterique","Maraita","Marale","Nueva Armenia","Ojojona","Reitoca","Sabanagrande","San Antonio de Oriente","San Buenaventura","San Ignacio","San Juan de Flores","San Miguelito","Santa Ana","Santa Lucía","Talanga","Tatumbla","Tegucigalpa","Valle de Ángeles","Vallecillo","Villa de San Francisco"],
  "Gracias a Dios":    ["Ahuas","Brus Laguna","Juan Francisco Bulnes","Puerto Lempira","Villeda Morales","Wampusirpe"],
  "Intibucá":          ["Camasca","Colomoncagua","Concepción","Dolores","Intibucá","Jesús de Otoro","La Esperanza","Magdalena","Masaguara","San Antonio","San Francisco de Opalaca","San Isidro","San Juan","San Marcos de Sierra","San Miguel Guancapla","Santa Lucía","Yamaranguila"],
  "Islas de la Bahía": ["Guanaja","José Santos Guardiola","Roatán","Utila"],
  "La Paz":            ["Aguanqueterique","Cabañas","Cane","Chinacla","Guajiquiro","La Paz","Lauterique","Marcala","Mercedes de Oriente","Opatoro","San Antonio del Norte","San Juan","San Pedro de Tutule","Santa Ana","Santa Elena","Santa María","Santiago de Puringla","Yarula"],
  "Lempira":           ["Belén","Candelaria","Cololaca","Erandique","Gracias","Gualcince","Guarita","La Campa","La Iguala","La Unión","La Virtud","Las Flores","Lepaera","Mapulaca","Piraera","San Andrés","San Francisco","San Juan de Guarita","San Manuel Colohete","San Marcos de Caiquín","San Rafael","San Sebastián","Santa Cruz","Talgua","Tambla","Tomalá","Valladolid","Virginia"],
  "Ocotepeque":        ["Belén Gualcho","Concepción","Dolores Merendón","Fraternidad","La Encarnación","La Labor","Lucerna","Mercedes","Ocotepeque","San Fernando","San Francisco del Valle","San Jorge","San Marcos","Santa Fe","Sensenti","Sinuapa"],
  "Olancho":           ["Campamento","Catacamas","Concordia","Dulce Nombre de Culmí","El Rosario","Esquipulas del Norte","Gualaco","Guarizama","Guata","Jano","Juticalpa","La Unión","Mangulile","Manto","Patuca","Salama","San Esteban","San Francisco de Becerra","San Francisco de La Paz","Santa María del Real","Silca","Yocón"],
  "Santa Bárbara":     ["Arada","Atima","Azagualpa","Ceguaca","Chinda","Concepción del Norte","Concepción del Sur","El Níspero","Gualala","Ilama","Las Vegas","Macuelizo","Naranjito","Nuevo Celilac","Petoa","Protección","Quimistán","San Francisco de Ojuera","San José de Colinas","San Luis","San Marcos","San Nicolás","San Pedro Zacapa","San Vicente Centenario","Santa Bárbara","Santa Rita","Trinidad"],
  "Valle":             ["Alianza","Amapala","Aramecina","Caridad","Goascorán","Langue","Nacaome","San Francisco de Coray","San Lorenzo"],
  "Yoro":              ["Arenal","El Negrito","El Progreso","Jocón","Morazán","Olanchito","Santa Rita","Sulaco","Victoria","Yorito","Yoro"],
};

const TIPOS_DOC = [
  { value: "laboratorio",   label: "Laboratorio", icon: "bi-file-earmark-medical" },
  { value: "imagen",        label: "Imagen médica", icon: "bi-file-image" },
  { value: "radiografia",   label: "Radiografía", icon: "bi-file-earmark-ruled" },
  { value: "receta",        label: "Receta", icon: "bi-prescription2" },
  { value: "consentimiento",label: "Consentimiento", icon: "bi-file-earmark-check" },
  { value: "otro",          label: "Otro", icon: "bi-file-earmark" },
];

export default function PerfilPaciente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef = useRef();
  const fotoInputRef = useRef();
  const fotoCameraRef = useRef();
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const { modulos } = useAuth();
  const tieneModulo = (clave) => modulos.some(m => m.clave === clave);

  // Estados principales
  const [paciente, setPaciente] = useState(null);
  const [historias, setHistorias] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [esteticaResumen, setEsteticaResumen] = useState({
    loading: true,
    ficha: 0,
    presupuestos: 0,
    consentimientos: 0,
    seguimiento: 0,
    galeria: 0,
    biopsias: 0,
  });
  
  // Pestaña activa
  const [tab, setTab] = useState(searchParams.get("tab") || "datos");
  
  // Edición datos generales
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [form, setForm] = useState({});
  
  // Upload documentos
  const [tipoDoc, setTipoDoc] = useState("laboratorio");
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  
  // Foto perfil
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const [webcamFacing, setWebcamFacing] = useState("user");
  
  // Eliminación con doble confirmación
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);

  // Sub-pestaña dentro de Datos Generales
  const [subTabDatos, setSubTabDatos] = useState("paciente");

  // Sub-pestañas dentro de Historial Clínico
  const [subTabHistorial, setSubTabHistorial] = useState("consultas");

  // Sub-pestañas dentro de Documentos / Exámenes
  const [subTabDocumentos, setSubTabDocumentos] = useState("todos");

  // Historial de consultas - filtros y expansión
  const [filtroDesde,  setFiltroDesde]  = useState("");
  const [filtroHasta,  setFiltroHasta]  = useState("");
  const [expandId,     setExpandId]     = useState(null);
  const [detalle,      setDetalle]      = useState({});
  const [alergiasPac,  setAlergiasPac]  = useState([]);
  const [showConsultaModal, setShowConsultaModal] = useState(false);
  const [consultaPaciente,  setConsultaPaciente]  = useState(null);
  const [checkingCita, setCheckingCita] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [loadingReminderData, setLoadingReminderData] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [plantillasRecordatorio, setPlantillasRecordatorio] = useState([]);
  const [reminderForm, setReminderForm] = useState({
    canal: "EMAIL",
    asunto: "",
    contenido: "",
  });

  // Modal confirmación eliminar documento
  const [docAEliminar, setDocAEliminar] = useState(null);
  const [docViewer, setDocViewer] = useState(null); // doc a visualizar en modal

  // ══════════════════════════════════════════════════════════
  // CARGA INICIAL
  // ══════════════════════════════════════════════════════════
  useEffect(() => { cargarTodo(); }, [id]);
  useEffect(() => { cargarEsteticaResumen(); }, [id]);

  const cargarEsteticaResumen = async () => {
    setEsteticaResumen(r => ({ ...r, loading: true }));
    try {
      const ficha = localStorage.getItem(`ficha_estetica_${id}`) ? 1 : 0;
      const presupuestos = JSON.parse(localStorage.getItem("presupuestos_est") || "[]")
        .filter(p => String(p.paciente_id) === String(id)).length;
      const consentimientos = JSON.parse(localStorage.getItem("consentimientos_est") || "[]")
        .filter(c => String(c.paciente_id) === String(id)).length;
      const seguimiento = JSON.parse(localStorage.getItem(`seguimiento_postop_${id}`) || "[]").length;

      const [resGaleria, resBiopsias] = await Promise.all([
        api.get(`/galeria-estetica/sesiones?paciente_id=${id}`),
        api.get(`/biopsias?paciente_id=${id}`),
      ]);

      setEsteticaResumen({
        loading: false,
        ficha,
        presupuestos,
        consentimientos,
        seguimiento,
        galeria: (resGaleria.data.data || []).length,
        biopsias: resBiopsias.data.total || (resBiopsias.data.data || []).length,
      });
    } catch (err) {
      console.log("No se pudo cargar el resumen estético:", err);
      setEsteticaResumen({
        loading: false,
        ficha: localStorage.getItem(`ficha_estetica_${id}`) ? 1 : 0,
        presupuestos: JSON.parse(localStorage.getItem("presupuestos_est") || "[]")
          .filter(p => String(p.paciente_id) === String(id)).length,
        consentimientos: JSON.parse(localStorage.getItem("consentimientos_est") || "[]")
          .filter(c => String(c.paciente_id) === String(id)).length,
        seguimiento: JSON.parse(localStorage.getItem(`seguimiento_postop_${id}`) || "[]").length,
        galeria: 0,
        biopsias: 0,
      });
    }
  };

  const cargarTodo = async () => {
    setLoading(true);
    setMsg({ tipo: "", texto: "" });
    try {
      // Cargar paciente
      const resPac = await api.get(`/pacientes/${id}`);
      const dataPac = resPac.data.data;
      
      // Formatear fecha para el input tipo date (YYYY-MM-DD)
      if (dataPac.fecha_nacimiento) {
        dataPac.fecha_nacimiento = dataPac.fecha_nacimiento.split('T')[0];
      }
      
      setPaciente(dataPac);
      setForm(dataPac);
      
      // Cargar historias clínicas
      try {
        const resHist = await api.get(`/historias?paciente_id=${id}`);
        setHistorias(resHist.data.data || []);
      } catch (e) {
        console.log("No hay historias clínicas");
        setHistorias([]);
      }

      // Cargar alergias (para impresión de consulta)
      try {
        const resAl = await api.get(`/historias/paciente/${id}/alergias`);
        setAlergiasPac(resAl.data.data || []);
      } catch { setAlergiasPac([]); }
      
      // Cargar documentos
      try {
        const resDocs = await api.get(`/pacientes/${id}/documentos`);
        setDocumentos(resDocs.data.data || []);
      } catch (e) {
        console.log("No hay documentos");
        setDocumentos([]);
      }
      
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error cargando paciente" });
    } finally {
      setLoading(false);
    }
  };

  // ── Expandir consulta → cargar detalle ──────────────────────────────────
  const toggleExpandPP = async (hId) => {
    if (expandId === hId) { setExpandId(null); return; }
    setExpandId(hId);
    if (!detalle[hId]) {
      try {
        const r = await api.get(`/historias/${hId}`);
        setDetalle(d => ({ ...d, [hId]: r.data.data }));
      } catch { /* silencio */ }
    }
  };

  // ── Imprimir consulta ─────────────────────────────────────────────────────
  const imprimirConsultaPP = async (h) => {
    let det = detalle[h.id];
    if (!det) {
      try {
        const r = await api.get(`/historias/${h.id}`);
        det = r.data.data;
        setDetalle(d => ({ ...d, [h.id]: det }));
      } catch {
        alert("No se pudo cargar el detalle de la consulta");
        return;
      }
    }
    const vitals = det.objetivo
      ? (typeof det.objetivo === "string" ? JSON.parse(det.objetivo) : det.objetivo)
      : {};
    const vitalesHtml = ["pa","fc","fr","temp","peso","talla","spo2"]
      .filter(k => vitals[k])
      .map(k => {
        const labels = { pa:"P.A.", fc:"F.C.", fr:"F.R.", temp:"Temp.", peso:"Peso", talla:"Talla", spo2:"SpO₂" };
        const units  = { pa:"mmHg", fc:"bpm", fr:"rpm", temp:"°C", peso:"kg", talla:"cm", spo2:"%" };
        return `<span class="vital">${labels[k]}: <strong>${vitals[k]}</strong> ${units[k]}</span>`;
      }).join("");
    const prescHtml = (det.prescripciones || []).map(p => `
      <div class="section">
        <div class="section-title">Receta #${p.id} — ${p.estado}</div>
        <ul>${(p.items || []).filter(Boolean).map(it =>
          `<li>${it.medicamento_nombre || it.medicamento_texto || ""}${it.dosis ? ` — ${it.dosis}` : ""}${it.duracion ? ` — ${it.duracion}` : ""}</li>`
        ).join("")}</ul>
      </div>`).join("");
    const estudiosHtml = (det.estudios || []).length > 0 ? `
      <div class="section">
        <div class="section-title">Estudios solicitados</div>
        <ul>${(det.estudios || []).map(s =>
          `<li>[${s.tipo}] ${s.descripcion} — ${s.estado}</li>`
        ).join("")}</ul>
      </div>` : "";
    const alergiasHtml = alergiasPac.length > 0
      ? `<div class="alergias">⚠ Alergias: ${alergiasPac.map(a => `${a.agente} (${a.severidad})`).join(" | ")}</div>`
      : "";
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Consulta — ${det.pac_nombres} ${det.pac_apellidos} — ${dayjs(det.creado_en).format("DD/MM/YYYY")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #166ae8; padding-bottom: 12px; margin-bottom: 16px; }
    .header-left h1 { font-size: 18px; color: #166ae8; }
    .header-left p { font-size: 12px; color: #555; margin-top: 2px; }
    .header-right { text-align: right; font-size: 12px; color: #555; }
    .paciente { background: #f4f6fb; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; }
    .paciente h2 { font-size: 15px; margin-bottom: 4px; }
    .paciente .datos { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #555; }
    .alergias { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 12px; font-weight: bold; color: #856404; }
    .vitales { display: flex; flex-wrap: wrap; gap: 10px; background: #eef2ff; border-radius: 4px; padding: 10px 14px; margin-bottom: 14px; }
    .vital { font-size: 12px; color: #333; }
    .section { margin-bottom: 14px; }
    .section-title { font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #166ae8; border-bottom: 1px solid #dde3f5; padding-bottom: 3px; margin-bottom: 6px; }
    .section p, .section pre { font-size: 13px; color: #333; white-space: pre-wrap; line-height: 1.5; }
    ul { padding-left: 20px; } ul li { margin-bottom: 3px; }
    .badge-cie { display: inline-block; background: #e9ecef; border: 1px solid #ced4da; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: bold; margin-right: 6px; }
    .firma { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ccc; display: flex; justify-content: flex-end; }
    .firma-box { text-align: center; }
    .firma-box .linea { width: 200px; border-top: 1px solid #333; margin: 0 auto 4px; }
    .firma-box p { font-size: 12px; color: #444; }
    @media print { body { padding: 12px 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Historia Clínica Electrónica</h1>
      <p>Dr. ${det.med_apellidos}, ${det.med_nombres}${det.especialidad ? ` — ${det.especialidad}` : ""}</p>
    </div>
    <div class="header-right">
      <p><strong>Fecha:</strong> ${dayjs(det.creado_en).format("DD/MM/YYYY HH:mm")}</p>
      <p><strong>Estado:</strong> ${det.estado}</p>
      <p><strong>Consulta #${det.id}</strong></p>
    </div>
  </div>
  <div class="paciente">
    <h2>${det.pac_nombres} ${det.pac_apellidos}</h2>
    <div class="datos">
      ${det.fecha_nacimiento ? `<span>Nacimiento: ${dayjs(det.fecha_nacimiento).format("DD/MM/YYYY")}</span>` : ""}
      ${det.sexo ? `<span>Sexo: ${det.sexo}</span>` : ""}
      ${det.pac_tel ? `<span>Tel: ${det.pac_tel}</span>` : ""}
      ${det.pac_email ? `<span>Email: ${det.pac_email}</span>` : ""}
    </div>
  </div>
  ${alergiasHtml}
  ${vitalesHtml ? `<div class="vitales">${vitalesHtml}</div>` : ""}
  ${det.diagnostico_cie ? `<div class="section"><div class="section-title">Diagnóstico</div><p><span class="badge-cie">CIE: ${det.diagnostico_cie}</span>${det.diagnostico_desc || ""}</p></div>` : ""}
  ${det.subjetivo ? `<div class="section"><div class="section-title">Motivo / Anamnesis</div><p>${det.subjetivo}</p></div>` : ""}
  ${det.examen_fisico ? `<div class="section"><div class="section-title">Examen Físico</div><pre>${det.examen_fisico}</pre></div>` : ""}
  ${det.plan ? `<div class="section"><div class="section-title">Plan de tratamiento</div><pre>${det.plan}</pre></div>` : ""}
  ${prescHtml}${estudiosHtml}
  <div class="firma"><div class="firma-box"><div class="linea"></div><p>Dr. ${det.med_apellidos}, ${det.med_nombres}</p>${det.especialidad ? `<p>${det.especialidad}</p>` : ""}</div></div>
</body></html>`;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) { alert("El navegador bloqueó la ventana emergente. Permite popups para este sitio."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  // ── PDF de receta ─────────────────────────────────────────────────────────
  const printRxPP = async (rxId) => {
    try {
      const res = await api.get(`/prescripciones/${rxId}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch {
      alert("No se pudo generar el PDF");
    }
  };

  // ══════════════════════════════════════════════════════════
  // PESTAÑA 1: DATOS GENERALES
  // ══════════════════════════════════════════════════════════
  const guardarDatos = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      await api.put(`/pacientes/${id}`, form);
      
      // Si hay foto nueva, subirla
      if (fotoFile) {
        const fd = new FormData();
        fd.append("foto", fotoFile);
        await api.post(`/pacientes/${id}/foto`, fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        setFotoFile(null);
        setFotoPreview(null);
      }
      
      setMsg({ tipo: "success", texto: "Datos actualizados correctamente" });
      setEditandoDatos(false);
      await cargarTodo();
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al guardar" });
    } finally {
      setGuardando(false);
    }
  };

  const cambioForm = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  // Webcam
  useEffect(() => {
    if (!showWebcam) return;
    let stopped = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: webcamFacing } })
      .then(stream => {
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => { setShowWebcam(false); alert("No se pudo acceder a la cámara."); });
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [showWebcam, webcamFacing]);

  const cerrarWebcam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setShowWebcam(false);
  };

  const capturarFoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (webcamFacing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      const file = new File([blob], "webcam-foto.jpg", { type: "image/jpeg" });
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(blob));
      cerrarWebcam();
    }, "image/jpeg", 0.92);
  };

  // ══════════════════════════════════════════════════════════
  // PESTAÑA 3: SUBIR EXÁMENES / DOCUMENTOS
  // ══════════════════════════════════════════════════════════
  const subirDocumento = async () => {
    if (!archivo) return;
    setSubiendo(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("tipo", tipoDoc);
      await api.post(`/pacientes/${id}/documentos`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = "";
      setMsg({ tipo: "success", texto: "Documento subido correctamente" });
      await cargarTodo();
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al subir" });
    } finally {
      setSubiendo(false);
    }
  };

  const eliminarDocumento = async (docId) => {
    try {
      await api.delete(`/pacientes/${id}/documentos/${docId}`);
      setMsg({ tipo: "success", texto: "Documento eliminado" });
      setDocumentos(d => d.filter(doc => doc.id !== docId));
    } catch {
      setMsg({ tipo: "danger", texto: "Error al eliminar documento" });
    } finally {
      setDocAEliminar(null);
    }
  };

  const documentosFiltrados = subTabDocumentos === "todos"
    ? documentos
    : documentos.filter(doc => doc.tipo === subTabDocumentos);

  const contarDocumentos = (tipo) => documentos.filter(doc => doc.tipo === tipo).length;

  // ── Consulta: mismo flujo que en listado de pacientes ─────────────────────
  const handleConsultaClick = async (pacienteTarget) => {
    if (!pacienteTarget?.id) return;
    setCheckingCita(true);
    try {
      const hoy = dayjs().format("YYYY-MM-DD");
      const res = await api.get("/citas", {
        params: { desde: hoy, hasta: hoy, paciente_id: pacienteTarget.id }
      });
      const citasHoy = (res.data.data || []).filter(
        c => !["CANCELADA", "NO_ASISTIO", "COMPLETADA"].includes(c.estado)
      );
      if (citasHoy.length > 0) {
        navigate(`/consulta-medica?paciente_id=${pacienteTarget.id}&cita_id=${citasHoy[0].id}`);
      } else {
        setConsultaPaciente(pacienteTarget);
        setShowConsultaModal(true);
      }
    } catch {
      setConsultaPaciente(pacienteTarget);
      setShowConsultaModal(true);
    } finally {
      setCheckingCita(false);
    }
  };

  const reemplazarVarsRecordatorio = (texto = "") =>
    String(texto || "")
      .replaceAll("{paciente}", nombreCompleto || "")
      .replaceAll("{clinica}", "Clínica")
      .replaceAll("{medico}", "")
      .replaceAll("{fecha}", dayjs().format("DD/MM/YYYY"))
      .replaceAll("{hora}", dayjs().format("HH:mm"));

  const htmlATextoPlano = (html = "") => {
    const conSaltos = String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<li>/gi, "• ")
      .replace(/<\/li>/gi, "\n");
    const sinTags = conSaltos.replace(/<[^>]+>/g, "");
    return sinTags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const aplicarPlantillaCanal = (canal, plantillas = plantillasRecordatorio) => {
    const lista = (plantillas || []).filter((p) => p.tipo === canal && Number(p.activo) === 1);
    const plantilla = lista.find((p) => Number(p.es_predeterminada) === 1) || lista[0];
    const contenidoBase = plantilla?.contenido || "Hola {paciente}, este es un recordatorio de su clínica.";
    const contenidoLimpio = canal === "EMAIL" ? htmlATextoPlano(contenidoBase) : contenidoBase;
    setReminderForm((prev) => ({
      ...prev,
      canal,
      asunto: canal === "EMAIL" ? reemplazarVarsRecordatorio(plantilla?.asunto || `Recordatorio - ${nombreCompleto}`) : "",
      contenido: reemplazarVarsRecordatorio(contenidoLimpio),
    }));
  };

  const abrirModalRecordatorio = async () => {
    setShowReminderModal(true);
    setLoadingReminderData(true);
    try {
      const { data } = await api.get("/recordatorios/plantillas");
      const plantillas = data?.plantillas || [];
      setPlantillasRecordatorio(plantillas);
      aplicarPlantillaCanal("EMAIL", plantillas);
    } catch (err) {
      setPlantillasRecordatorio([]);
      setReminderForm({
        canal: "EMAIL",
        asunto: `Recordatorio - ${nombreCompleto}`,
        contenido: `Hola ${nombreCompleto}, este es un recordatorio de su clínica.`,
      });
      setMsg({ tipo: "danger", texto: err?.response?.data?.error || "No se pudieron cargar plantillas de recordatorio" });
    } finally {
      setLoadingReminderData(false);
    }
  };

  const enviarRecordatorioManual = async () => {
    if (!reminderForm.contenido?.trim()) {
      setMsg({ tipo: "danger", texto: "Escribe el contenido del recordatorio" });
      return;
    }
    setSendingReminder(true);
    try {
      await api.post("/recordatorios/enviar-manual", {
        paciente_id: paciente.id,
        canal: reminderForm.canal,
        asunto: reminderForm.asunto,
        contenido: reminderForm.contenido,
      });
      setMsg({ tipo: "success", texto: `Recordatorio ${reminderForm.canal} enviado correctamente` });
      setShowReminderModal(false);
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.error || "Error al enviar recordatorio manual" });
    } finally {
      setSendingReminder(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  // PESTAÑA 4: ELIMINAR PACIENTE (Doble confirmación)
  // ══════════════════════════════════════════════════════════
  const eliminarPaciente = async () => {
    const nombreCompleto = `${paciente.nombres} ${paciente.apellidos}`;
    if (textoConfirmacion !== nombreCompleto) {
      setMsg({ tipo: "danger", texto: "El nombre no coincide. Por favor verifica." });
      return;
    }
    
    setEliminando(true);
    try {
      await api.delete(`/pacientes/${id}`);
      setMsg({ tipo: "success", texto: "Paciente eliminado correctamente" });
      setTimeout(() => navigate("/pacientes"), 1500);
    } catch (err) {
      setMsg({ tipo: "danger", texto: err?.response?.data?.msg || "Error al eliminar" });
      setEliminando(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 400 }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="alert alert-danger m-4">
        Paciente no encontrado. <Link to="/pacientes" className="alert-link">← Volver</Link>
      </div>
    );
  }

  const nombreCompleto = `${paciente.nombres} ${paciente.apellidos}`;

  /* ── Pestañas disponibles (dinámicas según módulos) ── */
  const totalEstetica = esteticaResumen.ficha + esteticaResumen.galeria + esteticaResumen.presupuestos + esteticaResumen.consentimientos + esteticaResumen.seguimiento + esteticaResumen.biopsias;
  const hayEstetica = [
    "ficha_estetica", "galeria_estetica", "presupuestos",
    "consentimientos_esteticos", "seguimiento_postop", "biopsias_patologia"
  ].some(clave => tieneModulo(clave));

  const TABS_PERFIL = [
    { key: "datos",       label: "Datos Generales",      short: "Datos",    icon: "bi-person-lines-fill" },
    { key: "historial",   label: "Historial Clínico",    short: "Historial", icon: "bi-journal-medical",
      badge: historias.length > 0 ? historias.length : null, badgeColor: "#2196f3" },
    { key: "examenes",    label: "Documentos",           short: "Docs.",    icon: "bi-files",
      badge: documentos.length > 0 ? documentos.length : null, badgeColor: "#0891b2" },
    ...(hayEstetica
      ? [{ key: "estetica", label: "Estética", short: "Estética", icon: "bi-star-fill",
          badge: esteticaResumen.loading ? null : totalEstetica > 0 ? totalEstetica : null, badgeColor: "#d97706" }]
      : []),
    ...(tieneModulo("curva_crecimiento")
      ? [{ key: "crecimiento", label: "Curvas de Crecimiento", short: "Curvas", icon: "bi-graph-up-arrow" }]
      : []),
    ...(tieneModulo("vacunas")
      ? [{ key: "vacunas", label: "Vacunas", short: "Vacunas", icon: "bi-syringe" }]
      : []),
    { key: "eliminar",    label: "Eliminar Paciente",    short: "Eliminar", icon: "bi-trash", danger: true },
  ];

  return (
    <div style={{ margin: "-1.5rem", width: "calc(100% + 3rem)", minHeight: "100vh", background: "#f0f2f5", display: "flex", flexDirection: "column" }}>

      {/* ══ HEADER estilo Catálogos ══════════════════════════════════════ */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "16px 24px 0",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)",
        flexShrink: 0,
      }}>
        {/* Breadcrumb */}
        <nav style={{ marginBottom: 12 }}>
          <ol className="breadcrumb mb-0" style={{ fontSize: "0.78rem" }}>
            <li className="breadcrumb-item">
              <Link to="/pacientes" style={{ color: "rgba(255,255,255,.6)", textDecoration: "none" }}>
                <i className="bi bi-people me-1" />Pacientes
              </Link>
            </li>
            <li className="breadcrumb-item active" style={{ color: "rgba(255,255,255,.9)" }}>
              {nombreCompleto}
            </li>
          </ol>
        </nav>

        {/* Info del paciente */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ marginBottom: 14 }}>
          <div className="d-flex align-items-center gap-3">
            {/* Avatar */}
            {paciente.foto_perfil ? (
              <img
                src={fotoUrl(paciente.foto_perfil)}
                alt="Foto"
                style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,.4)" }}
              />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                background: "rgba(33,150,243,.5)", border: "2px solid rgba(255,255,255,.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: "1.3rem", color: "#fff",
              }}>
                {paciente.nombres?.[0]}{paciente.apellidos?.[0]}
              </div>
            )}
            <div>
              <h5 style={{ color: "#fff", fontWeight: 700, margin: 0 }}>{nombreCompleto}</h5>
              <div className="d-flex flex-wrap gap-2 mt-1">
                {paciente.dni && (
                  <span style={{ background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.85)", borderRadius: 20, padding: "1px 9px", fontSize: "0.75rem" }}>
                    <i className="bi bi-credit-card me-1" />{paciente.dni}
                  </span>
                )}
                {paciente.edad && (
                  <span style={{ background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.85)", borderRadius: 20, padding: "1px 9px", fontSize: "0.75rem" }}>
                    <i className="bi bi-calendar3 me-1" />{paciente.edad} años
                  </span>
                )}
                {paciente.grupo_sanguineo && (
                  <span style={{ background: "rgba(239,68,68,.4)", color: "#fff", borderRadius: 20, padding: "1px 9px", fontSize: "0.75rem", fontWeight: 600 }}>
                    <i className="bi bi-droplet-fill me-1" />{paciente.grupo_sanguineo}
                  </span>
                )}
                {paciente.telefono && (
                  <span style={{ background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.85)", borderRadius: 20, padding: "1px 9px", fontSize: "0.75rem" }}>
                    <i className="bi bi-telephone me-1" />{paciente.telefono}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Botón Nueva Consulta */}
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm"
              style={{ background: "rgba(255,255,255,.14)", color: "#fff", fontWeight: 600, border: "1px solid rgba(255,255,255,.35)", borderRadius: 8, padding: "7px 14px" }}
              onClick={abrirModalRecordatorio}
            >
              <i className="bi bi-bell me-1" />
              Recordatorio
            </button>
            <button
              className="btn btn-sm"
              style={{ background: "#22c55e", color: "#fff", fontWeight: 600, border: "none", borderRadius: 8, padding: "7px 16px" }}
              onClick={() => handleConsultaClick(paciente)}
              disabled={checkingCita}
            >
              <i className={`bi ${checkingCita ? "bi-hourglass-split" : "bi-plus-circle"} me-1`} />
              {checkingCita ? "Verificando..." : "Nueva Consulta"}
            </button>
          </div>
        </div>

        {/* Mensaje inline bajo el header */}
        {msg.texto && (
          <div style={{
            margin: "0 0 8px",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: "0.84rem",
            background: msg.tipo === "success" ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)",
            color: msg.tipo === "success" ? "#86efac" : "#fca5a5",
            border: `1px solid ${msg.tipo === "success" ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.4)"}`,
          }}>
            <i className={`bi ${msg.tipo === "success" ? "bi-check-circle" : "bi-exclamation-triangle"} me-2`} />
            {msg.texto}
            <button
              onClick={() => setMsg({ tipo: "", texto: "" })}
              style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "1rem", lineHeight: 1 }}
            >×</button>
          </div>
        )}

        {/* ── Pestañas ── */}
        <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
          {TABS_PERFIL.map(t => {
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
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
                  color: isActive
                    ? (t.danger ? "#dc2626" : "#1a2744")
                    : (t.danger ? "rgba(252,165,165,.9)" : "rgba(255,255,255,.75)"),
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <i className={`bi ${t.icon}`} />
                <span className="d-none d-sm-inline">{t.label}</span>
                <span className="d-sm-none">{t.short}</span>
                {t.badge && (
                  <span style={{
                    background: isActive ? t.badgeColor : "rgba(255,255,255,.3)",
                    color: "#fff",
                    borderRadius: 20,
                    padding: "0 6px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    lineHeight: "18px",
                  }}>{t.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ CONTENIDO ════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, padding: "20px 24px" }}>
      <style>{`
        @media (max-width: 600px) { .pp-content { padding: 12px !important; } }
      `}</style>

      {/* ══════════════════════════════════════════════════════ */}
      {/* CONTENIDO DE LAS PESTAÑAS */}
      {/* ══════════════════════════════════════════════════════ */}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 1: DATOS GENERALES */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "datos" && (
        <div className="card shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <i className="bi bi-person-badge me-2 text-primary" />Expediente del Paciente
            </h5>
            <button
              className={`btn btn-sm ${editandoDatos ? "btn-outline-secondary" : "btn-outline-primary"}`}
              onClick={() => {
                setEditandoDatos(!editandoDatos);
                if (!editandoDatos) setForm(paciente);
              }}
            >
              <i className={`bi ${editandoDatos ? "bi-x-lg" : "bi-pencil"} me-1`} />
              {editandoDatos ? "Cancelar" : "Editar"}
            </button>
          </div>

          {/* Sub-pestañas */}
          <div className="border-bottom bg-light">
            <div className="d-flex" style={{ overflowX: "auto" }}>
              {[
                { key: "paciente",    label: "Datos Personales",     icon: "bi-person-fill" },
                { key: "responsable", label: "Responsable / Tutor",  icon: "bi-people-fill" },
                { key: "seguro",      label: "Seguro Médico",        icon: "bi-shield-plus" },
                { key: "emergencia",  label: "Contacto Emergencia",  icon: "bi-telephone-forward" },
                { key: "notas",       label: "Notas",                icon: "bi-sticky" },
              ].map(st => (
                <button
                  key={st.key}
                  className="btn rounded-0 px-3 py-2 border-0"
                  onClick={() => setSubTabDatos(st.key)}
                  style={{
                    fontWeight: subTabDatos === st.key ? 600 : 400,
                    color: subTabDatos === st.key ? "#214a87" : "#6c757d",
                    borderBottom: subTabDatos === st.key ? "3px solid #214a87" : "3px solid transparent",
                    fontSize: "0.85rem",
                    whiteSpace: "nowrap",
                    background: "transparent",
                  }}
                >
                  <i className={`bi ${st.icon} me-1`} />{st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card-body p-4">
            {editandoDatos ? (
              <form onSubmit={guardarDatos}>

                {/* ── Sub-tab: Datos Personales ── */}
                {subTabDatos === "paciente" && (
                  <div className="row g-3">

                    {/* Foto */}
                    <div className="col-12">
                      <label className="form-label fw-semibold">Foto de perfil</label>
                      <div className="d-flex align-items-center gap-3">
                        {(fotoPreview || paciente.foto_perfil) && (
                          <img
                            src={fotoPreview || fotoUrl(paciente.foto_perfil)}
                            alt="Preview"
                            style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 12 }}
                          />
                        )}
                        <div>
                          <input type="file" ref={fotoInputRef} accept="image/*" onChange={handleFotoChange} style={{ display: "none" }} />
                          <input type="file" ref={fotoCameraRef} accept="image/*" capture="environment" onChange={handleFotoChange} style={{ display: "none" }} />
                          <div className="d-flex gap-2 flex-wrap">
                            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setShowWebcam(true)}>
                              <i className="bi bi-webcam me-1" />Webcam
                            </button>
                            <button type="button" className="btn btn-outline-info btn-sm" onClick={() => fotoCameraRef.current?.click()}>
                              <i className="bi bi-phone me-1" />Cámara celular
                            </button>
                            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => fotoInputRef.current?.click()}>
                              <i className="bi bi-upload me-1" />{fotoPreview ? "Cambiar foto" : "Subir archivo"}
                            </button>
                          </div>
                          <small className="d-block text-muted mt-1">Puedes tomar una foto con webcam, desde el celular o subir un archivo</small>
                        </div>
                      </div>
                    </div>

                    {/* ── Identificación ── */}
                    <div className="col-12 mt-2">
                      <p className="text-uppercase fw-bold mb-0" style={{ fontSize: "0.72rem", letterSpacing: ".07em", color: "#6b7280" }}>
                        <i className="bi bi-person-badge me-1" />Identificación
                      </p>
                      <hr className="mt-1 mb-0" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Nombres *</label>
                      <input className="form-control" name="nombres" value={form.nombres || ""} onChange={cambioForm} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Apellidos *</label>
                      <input className="form-control" name="apellidos" value={form.apellidos || ""} onChange={cambioForm} required />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">DNI / Identidad</label>
                      <input className="form-control" name="dni" value={form.dni || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Fecha de nacimiento</label>
                      <input className="form-control" type="date" name="fecha_nacimiento" value={form.fecha_nacimiento ? form.fecha_nacimiento.split("T")[0] : ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Sexo</label>
                      <select className="form-select" name="sexo" value={form.sexo || ""} onChange={cambioForm}>
                        <option value="">Seleccionar</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </div>

                    {/* ── Datos personales ── */}
                    <div className="col-12 mt-2">
                      <p className="text-uppercase fw-bold mb-0" style={{ fontSize: "0.72rem", letterSpacing: ".07em", color: "#6b7280" }}>
                        <i className="bi bi-person-lines-fill me-1" />Datos personales
                      </p>
                      <hr className="mt-1 mb-0" />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Grupo sanguíneo</label>
                      <select className="form-select" name="grupo_sanguineo" value={form.grupo_sanguineo || ""} onChange={cambioForm}>
                        <option value="">Seleccionar</option>
                        {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Estado Civil</label>
                      <select className="form-select" name="estado_civil" value={form.estado_civil || ""} onChange={cambioForm}>
                        <option value="">Seleccionar</option>
                        {["Soltero(a)","Casado(a)","Unión Libre","Divorciado(a)","Viudo(a)"].map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Escolaridad</label>
                      <select className="form-select" name="escolaridad" value={form.escolaridad || ""} onChange={cambioForm}>
                        <option value="">Seleccionar</option>
                        {["Ninguna","Primaria","Secundaria","Preparatoria","Técnico","Universidad","Posgrado"].map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Ocupación</label>
                      <select className="form-select" name="ocupacion" value={form.ocupacion || ""} onChange={cambioForm}>
                        <option value="">Seleccionar</option>
                        {["Médico(a)","Enfermero(a)","Maestro(a)","Ingeniero(a)","Abogado(a)","Contador(a)","Agricultor(a)","Comerciante","Ama de casa","Estudiante","Policía / Militar","Conductor","Obrero(a)","Técnico(a)","Desempleado(a)","Jubilado(a)","Otro"].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Religión</label>
                      <select className="form-select" name="religion" value={form.religion || ""} onChange={cambioForm}>
                        <option value="">Seleccionar</option>
                        {["Católica","Evangélica / Protestante","Testigo de Jehová","Adventista","Mormón","Musulmana","Judía","Sin religión","Otra"].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Nacionalidad</label>
                      <input className="form-control" name="nacionalidad" value={form.nacionalidad || ""} onChange={cambioForm} />
                    </div>

                    {/* ── Contacto ── */}
                    <div className="col-12 mt-2">
                      <p className="text-uppercase fw-bold mb-0" style={{ fontSize: "0.72rem", letterSpacing: ".07em", color: "#6b7280" }}>
                        <i className="bi bi-telephone me-1" />Contacto
                      </p>
                      <hr className="mt-1 mb-0" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Teléfono</label>
                      <input className="form-control" name="telefono" value={form.telefono || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Email</label>
                      <input className="form-control" type="email" name="email" value={form.email || ""} onChange={cambioForm} />
                    </div>

                    {/* ── Ubicación ── */}
                    <div className="col-12 mt-2">
                      <p className="text-uppercase fw-bold mb-0" style={{ fontSize: "0.72rem", letterSpacing: ".07em", color: "#6b7280" }}>
                        <i className="bi bi-geo-alt me-1" />Ubicación
                      </p>
                      <hr className="mt-1 mb-0" />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">País</label>
                      <input className="form-control" name="pais" value={form.pais || ""} onChange={cambioForm} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Departamento</label>
                      <select
                        className="form-select"
                        name="departamento"
                        value={form.departamento || ""}
                        onChange={e => setForm(f => ({ ...f, departamento: e.target.value, ciudad: "" }))}
                      >
                        <option value="">— Seleccionar —</option>
                        {Object.keys(HONDURAS_DATA).sort().map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      {form.departamento ? (
                        <>
                          <label className="form-label fw-semibold">Municipio</label>
                          <select
                            className="form-select"
                            name="ciudad"
                            value={form.ciudad || ""}
                            onChange={cambioForm}
                          >
                            <option value="">— Seleccionar —</option>
                            {(HONDURAS_DATA[form.departamento] || []).map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <>
                          <label className="form-label fw-semibold">Municipio / Ciudad</label>
                          <input className="form-control" name="ciudad" value={form.ciudad || ""} onChange={cambioForm} placeholder="Selecciona un departamento primero" />
                        </>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Dirección</label>
                      <input className="form-control" name="direccion" value={form.direccion || ""} onChange={cambioForm} />
                    </div>

                  </div>
                )}

                {/* ── Sub-tab: Responsable / Tutor ── */}
                {subTabDatos === "responsable" && (
                  <div>
                    <div className="alert alert-info py-2 mb-3">
                      <i className="bi bi-info-circle me-2" />
                      <small>Datos del padre, madre, tutor o representante legal del paciente (obligatorio para menores de edad).</small>
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Nombre completo del responsable</label>
                        <input className="form-control" name="responsable_nombre" value={form.responsable_nombre || ""} onChange={cambioForm} placeholder="Nombre y apellidos" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Parentesco</label>
                        <select className="form-select" name="responsable_parentesco" value={form.responsable_parentesco || ""} onChange={cambioForm}>
                          <option value="">Seleccionar</option>
                          {["Madre","Padre","Abuelo(a)","Tío(a)","Hermano(a)","Tutor Legal","Cónyuge","Otro"].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">DNI del responsable</label>
                        <input className="form-control" name="responsable_dni" value={form.responsable_dni || ""} onChange={cambioForm} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Teléfono</label>
                        <input className="form-control" name="responsable_telefono" value={form.responsable_telefono || ""} onChange={cambioForm} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Email</label>
                        <input className="form-control" type="email" name="responsable_email" value={form.responsable_email || ""} onChange={cambioForm} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Dirección</label>
                        <input className="form-control" name="responsable_direccion" value={form.responsable_direccion || ""} onChange={cambioForm} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Sub-tab: Seguro Médico ── */}
                {subTabDatos === "seguro" && (
                  <div>
                    <div className="alert alert-info py-2 mb-3">
                      <i className="bi bi-info-circle me-2" />
                      <small>Información del seguro médico o aseguradora del paciente.</small>
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Aseguradora</label>
                        <input className="form-control" name="aseguradora" value={form.aseguradora || ""} onChange={cambioForm} placeholder="Nombre de la aseguradora" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Número de póliza</label>
                        <input className="form-control" name="numero_poliza" value={form.numero_poliza || ""} onChange={cambioForm} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Tipo de seguro</label>
                        <select className="form-select" name="tipo_seguro" value={form.tipo_seguro || ""} onChange={cambioForm}>
                          <option value="">Seleccionar</option>
                          {["Público","Privado","Mixto","IHSS","Otro"].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Vigencia del seguro</label>
                        <input className="form-control" type="date" name="vigencia_seguro" value={form.vigencia_seguro ? form.vigencia_seguro.split("T")[0] : ""} onChange={cambioForm} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Sub-tab: Contacto de Emergencia ── */}
                {subTabDatos === "emergencia" && (
                  <div>
                    <div className="alert alert-warning py-2 mb-3">
                      <i className="bi bi-exclamation-triangle me-2" />
                      <small>Persona a contactar en caso de emergencia (diferente al responsable si es necesario).</small>
                    </div>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Nombre completo</label>
                        <input className="form-control" name="contacto_emergencia_nombre" value={form.contacto_emergencia_nombre || ""} onChange={cambioForm} placeholder="Nombre de contacto de emergencia" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Teléfono de emergencia</label>
                        <input className="form-control" name="contacto_emergencia_telefono" value={form.contacto_emergencia_telefono || ""} onChange={cambioForm} placeholder="Número de teléfono" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Sub-tab: Notas ── */}
                {subTabDatos === "notas" && (
                  <div>
                    <label className="form-label fw-semibold">Notas / Observaciones generales</label>
                    <textarea className="form-control" name="notas" rows={5} value={form.notas || ""} onChange={cambioForm} placeholder="Notas internas sobre el paciente..." style={{ resize: "vertical" }} />
                  </div>
                )}

                {/* Botón guardar (siempre visible) */}
                <div className="mt-4 pt-3 border-top">
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    {guardando ? (
                      <><span className="spinner-border spinner-border-sm me-2" />Guardando...</>
                    ) : (
                      <><i className="bi bi-check-lg me-1" />Guardar cambios</>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* ── MODO LECTURA ── */
              <div>
                {/* Sub-tab: Datos Personales - lectura */}
                {subTabDatos === "paciente" && (
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="text-muted small">Nombres</label>
                      <p className="fw-semibold mb-0">{paciente.nombres}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Apellidos</label>
                      <p className="fw-semibold mb-0">{paciente.apellidos}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">DNI / Identidad</label>
                      <p className="fw-semibold mb-0">{paciente.dni || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Fecha de nacimiento</label>
                      <p className="fw-semibold mb-0">
                        {paciente.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Sexo</label>
                      <p className="fw-semibold mb-0">
                        {paciente.sexo === "M" ? "Masculino" : paciente.sexo === "F" ? "Femenino" : paciente.sexo || "—"}
                      </p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Grupo sanguíneo</label>
                      <p className="fw-semibold mb-0">{paciente.grupo_sanguineo || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Estado Civil</label>
                      <p className="fw-semibold mb-0">{paciente.estado_civil || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Ocupación</label>
                      <p className="fw-semibold mb-0">{paciente.ocupacion || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Escolaridad</label>
                      <p className="fw-semibold mb-0">{paciente.escolaridad || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Religión</label>
                      <p className="fw-semibold mb-0">{paciente.religion || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Nacionalidad</label>
                      <p className="fw-semibold mb-0">{paciente.nacionalidad || "—"}</p>
                    </div>
                    <div className="col-md-6">
                      <label className="text-muted small">Teléfono</label>
                      <p className="fw-semibold mb-0">{paciente.telefono || "—"}</p>
                    </div>
                    <div className="col-md-6">
                      <label className="text-muted small">Email</label>
                      <p className="fw-semibold mb-0">{paciente.email || "—"}</p>
                    </div>
                    <div className="col-12">
                      <label className="text-muted small">Dirección</label>
                      <p className="fw-semibold mb-0">{paciente.direccion || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Departamento</label>
                      <p className="fw-semibold mb-0">{paciente.departamento || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">Municipio / Ciudad</label>
                      <p className="fw-semibold mb-0">{paciente.ciudad || "—"}</p>
                    </div>
                    <div className="col-md-4">
                      <label className="text-muted small">País</label>
                      <p className="fw-semibold mb-0">{paciente.pais || "—"}</p>
                    </div>
                  </div>
                )}

                {/* Sub-tab: Responsable - lectura */}
                {subTabDatos === "responsable" && (
                  <div>
                    {!paciente.responsable_nombre ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-people" style={{ fontSize: "2.5rem" }} />
                        <p className="mt-2 mb-0">No se ha registrado un responsable</p>
                        <button className="btn btn-outline-primary btn-sm mt-2" onClick={() => { setEditandoDatos(true); setForm(paciente); }}>
                          <i className="bi bi-plus-lg me-1" />Agregar responsable
                        </button>
                      </div>
                    ) : (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="text-muted small">Nombre del responsable</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_nombre}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Parentesco</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_parentesco || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">DNI del responsable</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_dni || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Teléfono</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_telefono || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Email</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_email || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Dirección</label>
                          <p className="fw-semibold mb-0">{paciente.responsable_direccion || "—"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab: Seguro - lectura */}
                {subTabDatos === "seguro" && (
                  <div>
                    {!paciente.aseguradora ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-shield-plus" style={{ fontSize: "2.5rem" }} />
                        <p className="mt-2 mb-0">No se ha registrado seguro médico</p>
                        <button className="btn btn-outline-primary btn-sm mt-2" onClick={() => { setEditandoDatos(true); setForm(paciente); }}>
                          <i className="bi bi-plus-lg me-1" />Agregar seguro
                        </button>
                      </div>
                    ) : (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="text-muted small">Aseguradora</label>
                          <p className="fw-semibold mb-0">{paciente.aseguradora}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Número de póliza</label>
                          <p className="fw-semibold mb-0">{paciente.numero_poliza || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Tipo de seguro</label>
                          <p className="fw-semibold mb-0">{paciente.tipo_seguro || "—"}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Vigencia</label>
                          <p className="fw-semibold mb-0">
                            {paciente.vigencia_seguro ? new Date(paciente.vigencia_seguro).toLocaleDateString() : "—"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab: Emergencia - lectura */}
                {subTabDatos === "emergencia" && (
                  <div>
                    {!paciente.contacto_emergencia_nombre ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-telephone-forward" style={{ fontSize: "2.5rem" }} />
                        <p className="mt-2 mb-0">No se ha registrado contacto de emergencia</p>
                        <button className="btn btn-outline-primary btn-sm mt-2" onClick={() => { setEditandoDatos(true); setForm(paciente); }}>
                          <i className="bi bi-plus-lg me-1" />Agregar contacto
                        </button>
                      </div>
                    ) : (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="text-muted small">Nombre</label>
                          <p className="fw-semibold mb-0">{paciente.contacto_emergencia_nombre}</p>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">Teléfono de emergencia</label>
                          <p className="fw-semibold mb-0">{paciente.contacto_emergencia_telefono || "—"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab: Notas - lectura */}
                {subTabDatos === "notas" && (
                  <div>
                    {!paciente.notas ? (
                      <div className="text-center py-4 text-muted">
                        <i className="bi bi-sticky" style={{ fontSize: "2.5rem" }} />
                        <p className="mt-2 mb-0">No hay notas registradas</p>
                        <button className="btn btn-outline-primary btn-sm mt-2" onClick={() => { setEditandoDatos(true); setForm(paciente); }}>
                          <i className="bi bi-plus-lg me-1" />Agregar nota
                        </button>
                      </div>
                    ) : (
                      <div>
                        <label className="text-muted small">Notas / Observaciones</label>
                        <div className="bg-light rounded p-3 mt-1" style={{ whiteSpace: "pre-wrap" }}>
                          {paciente.notas}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 2: HISTORIAL CLÍNICO */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "historial" && (
        <div>
          {/* Sub-pestañas */}
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button
                className={`nav-link ${subTabHistorial === "consultas" ? "active" : ""}`}
                onClick={() => setSubTabHistorial("consultas")}
              >
                <i className="bi bi-clock-history me-1" />
                Historial de Consultas
                <span className="badge bg-secondary ms-1" style={{ fontSize: "0.7rem" }}>{historias.length}</span>
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${subTabHistorial === "antecedentes" ? "active" : ""}`}
                onClick={() => setSubTabHistorial("antecedentes")}
              >
                <i className="bi bi-heart-pulse me-1" />
                Alergias y Antecedentes
              </button>
            </li>
          </ul>

          {/* Sub-tab: Alergias y Antecedentes */}
          {subTabHistorial === "antecedentes" && (
            <AntecedentesClinico pacienteId={id} sexo={paciente.sexo} />
          )}

          {/* Sub-tab: Historial de Consultas */}
          {subTabHistorial === "consultas" && (
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="mb-0">
                  <i className="bi bi-journal-medical me-2 text-success" />
                  Consultas
                  <span className="badge bg-secondary ms-2" style={{ fontSize: "0.75rem" }}>{historias.length}</span>
                </h5>
              </div>
              <div className="card-body">
                {/* Filtro por fecha */}
                <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                  <small className="text-muted fw-semibold">Filtrar por fecha:</small>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    style={{ width: 150 }}
                    value={filtroDesde}
                    onChange={e => setFiltroDesde(e.target.value)}
                  />
                  <span className="text-muted small">—</span>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    style={{ width: 150 }}
                    value={filtroHasta}
                    onChange={e => setFiltroHasta(e.target.value)}
                  />
                  {(filtroDesde || filtroHasta) && (
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => { setFiltroDesde(""); setFiltroHasta(""); }}
                    >
                      <i className="bi bi-x-lg me-1" />Limpiar
                    </button>
                  )}
                  {historias.length > 0 && (
                    <small className="text-muted ms-auto">
                      {(() => {
                        const n = historias.filter(h => {
                          const f = dayjs(h.creado_en);
                          if (filtroDesde && f.isBefore(dayjs(filtroDesde), "day")) return false;
                          if (filtroHasta && f.isAfter(dayjs(filtroHasta), "day")) return false;
                          return true;
                        }).length;
                        return `${n} de ${historias.length} consultas`;
                      })()}
                    </small>
                  )}
                </div>

                {historias.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-inbox" style={{ fontSize: "3rem", color: "#ccc" }} />
                    <p className="text-muted mt-3">No hay consultas registradas</p>
                    <button
                      className="btn btn-success"
                      onClick={() => handleConsultaClick(paciente)}
                      disabled={checkingCita}
                    >
                      <i className={`bi ${checkingCita ? "bi-hourglass-split" : "bi-plus-circle"} me-1`} />
                      {checkingCita ? "Verificando..." : "Nueva Consulta"}
                    </button>
                  </div>
                ) : (() => {
                  const filtradas = historias.filter(h => {
                    const f = dayjs(h.creado_en);
                    if (filtroDesde && f.isBefore(dayjs(filtroDesde), "day")) return false;
                    if (filtroHasta && f.isAfter(dayjs(filtroHasta), "day")) return false;
                    return true;
                  });
                  return (
                    <>
                      {historias.length > 0 && filtradas.length === 0 && (
                        <div className="alert alert-warning py-2">
                          <i className="bi bi-search me-2" />
                          No hay consultas en el rango de fechas seleccionado.
                        </div>
                      )}
                      <div className="timeline" style={{ maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
                        {filtradas.map((h, i) => {
                          const det = detalle[h.id];
                          const expanded = expandId === h.id;
                          const vitals = h.objetivo
                            ? (typeof h.objetivo === "string" ? JSON.parse(h.objetivo) : h.objetivo)
                            : {};
                          return (
                            <div key={h.id} className="d-flex gap-3 mb-3">
                              {/* Línea de tiempo */}
                              <div className="d-flex flex-column align-items-center" style={{ minWidth: 24 }}>
                                <div className={`rounded-circle border border-2 ${h.estado === "FIRMADA" ? "border-success bg-success" : "border-warning bg-warning"}`}
                                  style={{ width: 12, height: 12, marginTop: 6, flexShrink: 0 }} />
                                {i < filtradas.length - 1 && (
                                  <div style={{ width: 2, flex: 1, background: "#dee2e6", minHeight: 40 }} />
                                )}
                              </div>
                              {/* Tarjeta */}
                              <div className="card border-0 shadow-sm flex-grow-1 mb-2">
                                <div className="card-body py-2">
                                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-1">
                                    <div>
                                      <span className={`badge bg-${ESTADO_BADGE_PP[h.estado]?.split(" ")[0]} ${ESTADO_BADGE_PP[h.estado]?.split(" ")[1] || ""} me-2`}>
                                        {h.estado}
                                      </span>
                                      <strong className="small">Dr. {h.med_apellidos}, {h.med_nombres}</strong>
                                      {h.especialidad && <span className="text-muted small ms-1">({h.especialidad})</span>}
                                    </div>
                                    <small className="text-muted">{dayjs(h.creado_en).format("DD/MM/YYYY HH:mm")}</small>
                                  </div>
                                  {h.diagnostico_cie && (
                                    <div className="small mt-1">
                                      <span className="badge bg-light text-dark border me-1">CIE: {h.diagnostico_cie}</span>
                                      {h.plan && <span className="text-muted">{h.plan.substring(0, 80)}{h.plan.length > 80 ? "…" : ""}</span>}
                                    </div>
                                  )}
                                  {h.subjetivo && !h.diagnostico_cie && (
                                    <div className="small text-muted mt-1">
                                      {h.subjetivo.substring(0, 100)}{h.subjetivo.length > 100 ? "…" : ""}
                                    </div>
                                  )}
                                  {(vitals.pa || vitals.fc || vitals.temp) && (
                                    <div className="d-flex flex-wrap gap-2 mt-1">
                                      {vitals.pa   && <small className="text-muted">P.A. {vitals.pa} mmHg</small>}
                                      {vitals.fc   && <small className="text-muted">· FC {vitals.fc} bpm</small>}
                                      {vitals.temp && <small className="text-muted">· T {vitals.temp}°C</small>}
                                      {vitals.peso && <small className="text-muted">· Peso {vitals.peso} kg</small>}
                                    </div>
                                  )}
                                  {/* Acciones */}
                                  <div className="d-flex gap-2 mt-2 flex-wrap">
                                    <button className="btn btn-outline-secondary btn-sm"
                                      onClick={() => toggleExpandPP(h.id)}>
                                      {expanded ? "Ocultar detalle" : "Ver detalle"}
                                    </button>
                                    {h.estado === "BORRADOR" && (
                                      <Link to={`/consulta-medica?historia_id=${h.id}`} className="btn btn-outline-primary btn-sm">
                                        ✏ Editar
                                      </Link>
                                    )}
                                    {h.estado === "FIRMADA" && (
                                      <Link to={`/consulta-medica?historia_id=${h.id}`} className="btn btn-link btn-sm p-0">
                                        Ver completa
                                      </Link>
                                    )}
                                    <button
                                      className="btn btn-outline-secondary btn-sm ms-auto"
                                      title="Imprimir consulta"
                                      onClick={() => imprimirConsultaPP(h)}
                                    >
                                      <i className="bi bi-printer me-1" />Imprimir
                                    </button>
                                  </div>
                                  {/* Detalle expandido */}
                                  {expanded && det && (
                                    <div className="border-top mt-2 pt-2">
                                      {det.prescripciones?.length > 0 && (
                                        <div className="mb-2">
                                          <div className="small fw-semibold mb-1">💊 Prescripción(es):</div>
                                          {det.prescripciones.map(p => (
                                            <div key={p.id} className="small text-muted ps-2 mb-1">
                                              <div className="d-flex align-items-center gap-2 mb-1">
                                                <span>Receta #{p.id}</span>
                                                <span className="badge bg-secondary">{p.estado}</span>
                                                <button className="btn btn-outline-primary btn-sm py-0 px-1"
                                                  style={{ fontSize: "0.72rem" }}
                                                  onClick={() => printRxPP(p.id)}>
                                                  <i className="bi bi-printer me-1" />PDF
                                                </button>
                                              </div>
                                              {p.items?.filter(Boolean).map((it, idx) => (
                                                <div key={idx} className="ps-2">• {it.medicamento_nombre || it.medicamento_texto}{it.dosis ? ` — ${it.dosis}` : ""}</div>
                                              ))}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {det.estudios?.length > 0 && (
                                        <div className="mb-2">
                                          <div className="small fw-semibold mb-1">🧪 Estudios solicitados:</div>
                                          {det.estudios.map(s => (
                                            <div key={s.id} className="small text-muted ps-2">
                                              [{s.tipo}] {s.descripcion} — {s.estado}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {det.plan && (
                                        <div>
                                          <div className="small fw-semibold mb-1">Plan:</div>
                                          <div className="small text-muted" style={{ whiteSpace: "pre-wrap" }}>{det.plan}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {expanded && !det && (
                                    <div className="mt-2 text-muted small">Cargando detalle…</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 3: EXÁMENES / DOCUMENTOS */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "examenes" && (
        <div className="row g-4">
          {/* Subir nuevo documento */}
          <div className="col-md-4">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-primary text-white">
                <h6 className="mb-0">
                  <i className="bi bi-cloud-upload me-2" />Subir Documento
                </h6>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Tipo de documento</label>
                  <select 
                    className="form-select" 
                    value={tipoDoc} 
                    onChange={(e) => setTipoDoc(e.target.value)}
                  >
                    {TIPOS_DOC.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Seleccionar archivo</label>
                  <input
                    ref={fileRef}
                    type="file"
                    className="form-control"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f && f.size > 10 * 1024 * 1024) {
                        setMsg({ tipo: "danger", texto: "El archivo supera el límite de 10 MB" });
                        e.target.value = "";
                        setArchivo(null);
                        return;
                      }
                      setArchivo(f || null);
                    }}
                  />
                  <small className="text-muted">
                    Puedes tomar una foto desde el celular o subir PDF/imágenes (máx. 10 MB)
                  </small>
                </div>

                {archivo && (
                  <div className="alert alert-info py-2">
                    <i className="bi bi-file-earmark-check me-2" />
                    {archivo.name}
                  </div>
                )}

                <button
                  className="btn btn-primary w-100"
                  onClick={subirDocumento}
                  disabled={!archivo || subiendo}
                >
                  {subiendo ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Subiendo...</>
                  ) : (
                    <><i className="bi bi-upload me-1" />Subir documento</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Lista de documentos */}
          <div className="col-md-8">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h6 className="mb-0">
                  <i className="bi bi-files me-2 text-info" />Documentos subidos ({documentosFiltrados.length})
                  {subTabDocumentos !== "todos" && (
                    <small className="text-muted ms-2">de {documentos.length}</small>
                  )}
                </h6>
              </div>
              <div className="card-body">
                <div className="mb-3 border-bottom">
                  <div style={{ display: "flex", gap: 3, overflowX: "auto", paddingBottom: 2 }}>
                    {[
                      { value: "todos", label: "Todos", count: documentos.length },
                      ...TIPOS_DOC.map((tipo) => ({
                        value: tipo.value,
                        label: tipo.label,
                        count: contarDocumentos(tipo.value),
                      })),
                    ].map((st) => {
                      const isActive = subTabDocumentos === st.value;
                      return (
                        <button
                          key={st.value}
                          type="button"
                          onClick={() => setSubTabDocumentos(st.value)}
                          style={{
                            flexShrink: 0,
                            padding: "7px 12px",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            borderRadius: "8px 8px 0 0",
                            border: "none",
                            cursor: "pointer",
                            transition: "background .15s",
                            background: isActive ? "#214a87" : "rgba(33,74,135,.1)",
                            color: isActive ? "#fff" : "#214a87",
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span>{st.label}</span>
                          <span
                            style={{
                              background: isActive ? "rgba(255,255,255,.25)" : "rgba(33,74,135,.18)",
                              color: isActive ? "#fff" : "#214a87",
                              borderRadius: 20,
                              padding: "0 6px",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              lineHeight: "18px",
                              minWidth: 18,
                              textAlign: "center",
                            }}
                          >
                            {st.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {documentosFiltrados.length === 0 ? (
                  <div className="text-center py-4">
                    <i className="bi bi-inbox" style={{ fontSize: "2.5rem", color: "#ccc" }} />
                    <p className="text-muted mt-2">No hay documentos en esta categoría</p>
                  </div>
                ) : (
                  <div className="list-group list-group-flush">
                    {documentosFiltrados.map((doc) => {
                      const tipoInfo = TIPOS_DOC.find(t => t.value === doc.tipo) || TIPOS_DOC[TIPOS_DOC.length - 1];
                      const esImagen = doc.mime_type?.startsWith('image/');
                      const esPdf = doc.mime_type === 'application/pdf';
                      const urlArchivo = doc.ruta_archivo?.startsWith('http')
                        ? doc.ruta_archivo
                        : `${API_BASE}/uploads/pacientes/${doc.ruta_archivo}`;
                      const peso = doc.tamano_bytes
                        ? doc.tamano_bytes >= 1024 * 1024
                          ? (doc.tamano_bytes / (1024 * 1024)).toFixed(1) + " MB"
                          : (doc.tamano_bytes / 1024).toFixed(0) + " KB"
                        : null;
                      return (
                        <div key={doc.id} className="list-group-item list-group-item-action" style={{ cursor: "pointer" }}
                          onClick={() => setDocViewer(doc)}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <div className="flex-shrink-0">
                              <i className={`bi ${tipoInfo.icon} text-primary`} style={{ fontSize: "2rem" }} />
                            </div>
                            <div className="flex-grow-1">
                              <h6 className="mb-0">{tipoInfo.label}</h6>
                              <small className="text-muted">
                                {new Date(doc.subido_en).toLocaleDateString()}
                              </small>
                              {esPdf && <small className="ms-2 badge bg-light text-dark border">PDF</small>}
                              {esImagen && <small className="ms-2 badge bg-light text-dark border">Imagen</small>}
                              {peso && <small className="ms-2 text-muted">{peso}</small>}
                            </div>
                            <div className="d-flex gap-2" onClick={e => e.stopPropagation()}>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                title="Ver documento"
                                onClick={(e) => { e.stopPropagation(); setDocViewer(doc); }}
                              >
                                <i className="bi bi-eye" />
                              </button>
                              <a
                                href={urlArchivo}
                                download
                                className="btn btn-sm btn-outline-primary"
                                title="Descargar"
                              >
                                <i className="bi bi-download" />
                              </a>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => setDocAEliminar(doc)}
                              >
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "estetica" && hayEstetica && (
        <div className="row g-4">
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="mb-0">
                  <i className="bi bi-star-fill text-warning me-2" />Estética
                  <small className="text-muted ms-2">
                    {esteticaResumen.loading ? "Cargando datos estéticos..." : `${totalEstetica} registros encontrados`}
                  </small>
                </h5>
              </div>
              <div className="card-body">
                <div className="row gy-3 gx-3">
                  <div className="col-md-4">
                    <div className="border rounded p-3 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fw-semibold">Ficha estética</span>
                        <span className={`badge ${esteticaResumen.ficha ? "bg-success" : "bg-secondary"}`}>
                          {esteticaResumen.ficha ? "Guardada" : "No registrada"}
                        </span>
                      </div>
                      <p className="text-muted small mb-3">Información clínica estética asociada al paciente.</p>
                      <Link to={`/estetica/ficha?paciente_id=${id}`} className="btn btn-sm btn-outline-primary">Abrir ficha</Link>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="border rounded p-3 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fw-semibold">Galería antes/después</span>
                        <span className="badge bg-info">{esteticaResumen.galeria}</span>
                      </div>
                      <p className="text-muted small mb-3">Sesiones de fotos estéticas cargadas para este paciente.</p>
                      <Link to={`/estetica/galeria?paciente_id=${id}`} className="btn btn-sm btn-outline-primary">Ver galería</Link>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="border rounded p-3 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fw-semibold">Presupuestos</span>
                        <span className="badge bg-warning text-dark">{esteticaResumen.presupuestos}</span>
                      </div>
                      <p className="text-muted small mb-3">Presupuestos estéticos guardados en el perfil del paciente.</p>
                      <Link to="/estetica/presupuestos" className="btn btn-sm btn-outline-primary">Abrir presupuestos</Link>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="border rounded p-3 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fw-semibold">Consentimientos</span>
                        <span className="badge bg-primary">{esteticaResumen.consentimientos}</span>
                      </div>
                      <p className="text-muted small mb-3">Consentimientos estéticos registrados para este paciente.</p>
                      <Link to={`/estetica/consentimientos?paciente_id=${id}`} className="btn btn-sm btn-outline-primary">Ver consentimientos</Link>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="border rounded p-3 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fw-semibold">Seguimiento post-op</span>
                        <span className="badge bg-success">{esteticaResumen.seguimiento}</span>
                      </div>
                      <p className="text-muted small mb-3">Registros de control postoperatorio estético.</p>
                      <Link to={`/estetica/seguimiento?paciente_id=${id}`} className="btn btn-sm btn-outline-primary">Abrir seguimiento</Link>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="border rounded p-3 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fw-semibold">Biopsias / Patología</span>
                        <span className="badge bg-danger">{esteticaResumen.biopsias}</span>
                      </div>
                      <p className="text-muted small mb-3">Biopsias y patologías ligados al paciente.</p>
                      <Link to={`/estetica/biopsias?paciente_id=${id}`} className="btn btn-sm btn-outline-primary">Ver biopsias</Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 4: CURVAS DE CRECIMIENTO OMS */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "crecimiento" && tieneModulo("curva_crecimiento") && (
        <div className="card shadow-sm">
          <div className="card-header" style={{ background: "linear-gradient(135deg, #214a87 0%, #176DC8 100%)" }}>
            <h5 className="mb-0 text-white">
              <i className="bi bi-graph-up-arrow me-2" />Curvas de Crecimiento — Estándares OMS
            </h5>
          </div>
          <div className="card-body p-4">
            <CurvaCrecimiento
              pacienteId={id}
              sexo={paciente.sexo}
              fechaNacimiento={paciente.fecha_nacimiento}
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB: VACUNAS */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "vacunas" && tieneModulo("vacunas") && (
        <VacunasCarnet paciente={paciente} pacienteId={id} />
      )}

      {/* ─────────────────────────────────────────────────────── */}
      {/* TAB 5: ELIMINAR PACIENTE (Doble confirmación) */}
      {/* ─────────────────────────────────────────────────────── */}
      {tab === "eliminar" && (
        <div className="card shadow-sm border-danger">
          <div className="card-header bg-danger text-white">
            <h5 className="mb-0">
              <i className="bi bi-exclamation-triangle me-2" />Zona Peligrosa
            </h5>
          </div>
          <div className="card-body p-4">
            <div className="alert alert-danger">
              <h6 className="alert-heading">
                <i className="bi bi-shield-exclamation me-2" />¡Advertencia!
              </h6>
              <p className="mb-0">
                Esta acción es <strong>permanente e irreversible</strong>. Se eliminarán:
              </p>
              <ul className="mt-2 mb-0">
                <li>Todos los datos personales del paciente</li>
                <li>Historial clínico completo ({historias.length} consultas)</li>
                <li>Documentos y exámenes subidos ({documentos.length} archivos)</li>
                <li>Citas programadas y antecedentes médicos</li>
              </ul>
            </div>

            {!confirmarEliminar ? (
              <div className="text-center py-4">
                <button
                  className="btn btn-danger btn-lg"
                  onClick={() => setConfirmarEliminar(true)}
                >
                  <i className="bi bi-trash me-2" />Deseo eliminar este paciente
                </button>
              </div>
            ) : (
              <div>
                <h6 className="fw-bold mb-3">Confirmación requerida</h6>
                <p className="text-muted">
                  Para confirmar la eliminación, escribe el nombre completo del paciente:
                </p>
                <div className="bg-light p-3 rounded mb-3 text-center">
                  <code className="fs-5 fw-bold">{nombreCompleto}</code>
                </div>
                
                <input
                  type="text"
                  className="form-control form-control-lg mb-3"
                  placeholder="Escribe el nombre completo aquí"
                  value={textoConfirmacion}
                  onChange={(e) => setTextoConfirmacion(e.target.value)}
                />

                <div className="d-flex gap-2 justify-content-end">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setConfirmarEliminar(false);
                      setTextoConfirmacion("");
                    }}
                  >
                    <i className="bi bi-x-lg me-1" />Cancelar
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={eliminarPaciente}
                    disabled={textoConfirmacion !== nombreCompleto || eliminando}
                  >
                    {eliminando ? (
                      <><span className="spinner-border spinner-border-sm me-2" />Eliminando...</>
                    ) : (
                      <><i className="bi bi-trash me-1" />Confirmar eliminación</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal visor de documento */}
      {docViewer && (() => {
        const esImagen = docViewer.mime_type?.startsWith('image/');
        const esPdf    = docViewer.mime_type === 'application/pdf';
        const token    = localStorage.getItem('token') || '';
        // Siempre usar el endpoint /view del backend (genera URL firmada de Cloudinary)
        const url      = `${API_BASE}/api/pacientes/${id}/documentos/${docViewer.id}/view?auth_token=${token}`;
        const tipoInfo = TIPOS_DOC.find(t => t.value === docViewer.tipo) || TIPOS_DOC[TIPOS_DOC.length - 1];
        return (
          <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.75)" }} tabIndex="-1"
            onClick={() => setDocViewer(null)}
          >
            <div className="modal-dialog modal-xl modal-dialog-centered" onClick={e => e.stopPropagation()}>
              <div className="modal-content">
                <div className="modal-header d-flex justify-content-between align-items-center">
                  <h5 className="modal-title mb-0">
                    <i className={`bi ${tipoInfo.icon} me-2 text-primary`} />
                    {tipoInfo.label} &mdash; <small className="text-muted">{new Date(docViewer.subido_en).toLocaleDateString()}</small>
                  </h5>
                  <div className="d-flex gap-2 align-items-center ms-auto">
                    <a href={url} download className="btn btn-sm btn-outline-primary">
                      <i className="bi bi-download me-1" />Descargar
                    </a>
                    <button type="button" className="btn-close" onClick={() => setDocViewer(null)} />
                  </div>
                </div>
                <div className="modal-body p-0" style={{ minHeight: 400 }}>
                  {esImagen && (
                    <div className="text-center p-3">
                      <img
                        src={url}
                        alt={tipoInfo.label}
                        style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 8 }}
                      />
                    </div>
                  )}
                  {esPdf && (
                    <iframe
                      src={url}
                      title={tipoInfo.label}
                      style={{ width: "100%", height: "75vh", border: "none" }}
                    />
                  )}
                  {!esImagen && !esPdf && (
                    <div className="text-center py-5">
                      <i className="bi bi-file-earmark" style={{ fontSize: "3rem", color: "#ccc" }} />
                      <p className="text-muted mt-2">Vista previa no disponible para este tipo de archivo.</p>
                      <a href={url} download className="btn btn-primary">
                        <i className="bi bi-download me-1" />Descargar archivo
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal confirmar eliminación de documento */}
      {docAEliminar && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title">
                  <i className="bi bi-trash text-danger me-2" />Eliminar documento
                </h5>
                <button type="button" className="btn-close" onClick={() => setDocAEliminar(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-1">¿Estás seguro de que deseas eliminar este documento?</p>
                <div className="bg-light rounded p-2 mt-2">
                  <small className="text-muted">Tipo: </small>
                  <span className="fw-semibold">{TIPOS_DOC.find(t => t.value === docAEliminar.tipo)?.label || docAEliminar.tipo}</span>
                  <br />
                  <small className="text-muted">Fecha: </small>
                  <span className="fw-semibold">{new Date(docAEliminar.subido_en).toLocaleDateString()}</span>
                </div>
                <p className="text-danger small mt-2 mb-0">Esta acción no se puede deshacer.</p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-outline-secondary" onClick={() => setDocAEliminar(null)}>
                  Cancelar
                </button>
                <button className="btn btn-danger" onClick={() => eliminarDocumento(docAEliminar.id)}>
                  <i className="bi bi-trash me-1" />Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReminderModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <div className="card shadow" style={{ width: "100%", maxWidth: 760, border: "none" }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Enviar recordatorio manual</strong>
              <button type="button" className="btn-close" onClick={() => setShowReminderModal(false)} />
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Canal</label>
                  <select
                    className="form-select"
                    value={reminderForm.canal}
                    onChange={(e) => aplicarPlantillaCanal(e.target.value)}
                    disabled={loadingReminderData || sendingReminder}
                  >
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </div>
                {reminderForm.canal === "EMAIL" && (
                  <div className="col-md-8">
                    <label className="form-label">Asunto</label>
                    <input
                      className="form-control"
                      value={reminderForm.asunto}
                      onChange={(e) => setReminderForm((prev) => ({ ...prev, asunto: e.target.value }))}
                      disabled={loadingReminderData || sendingReminder}
                    />
                  </div>
                )}
                <div className="col-12">
                  <label className="form-label">Mensaje</label>
                  <textarea
                    rows={8}
                    className="form-control"
                    value={reminderForm.contenido}
                    onChange={(e) => setReminderForm((prev) => ({ ...prev, contenido: e.target.value }))}
                    disabled={loadingReminderData || sendingReminder}
                  />
                  <div className="form-text">Variables: {"{paciente}"}, {"{clinica}"}, {"{fecha}"}, {"{hora}"}, {"{medico}"}</div>
                </div>
              </div>
            </div>
            <div className="card-footer d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary" onClick={() => setShowReminderModal(false)} disabled={sendingReminder}>Cancelar</button>
              <button className="btn btn-primary" onClick={enviarRecordatorioManual} disabled={loadingReminderData || sendingReminder}>
                {sendingReminder ? "Enviando..." : "Enviar ahora"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Modal Webcam ──────────────────────────────────── */}
      {showWebcam && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", width: "100%", maxWidth: 540, boxShadow: "0 24px 64px rgba(0,0,0,0.55)" }}>
            <div style={{ background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)", padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 700, fontSize: "0.92rem" }}>
                <i className="bi bi-webcam-fill" style={{ color: "#7dd3fc" }} /> Tomar foto
              </div>
              <button type="button" onClick={cerrarWebcam} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 6, width: 30, height: 30, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                <i className="bi bi-x" />
              </button>
            </div>
            <div style={{ background: "#000", position: "relative", aspectRatio: "4/3", overflow: "hidden" }}>
              <video ref={videoRef} autoPlay playsInline muted
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
                  transform: webcamFacing === "user" ? "scaleX(-1)" : "none" }} />
            </div>
            <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderTop: "1px solid #e5e7eb" }}>
              <button type="button"
                onClick={() => setWebcamFacing(f => f === "user" ? "environment" : "user")}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#f1f5f9", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                <i className="bi bi-arrow-repeat" /> Girar cámara
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={cerrarWebcam}
                  style={{ background: "#f1f5f9", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Cancelar
                </button>
                <button type="button" onClick={capturarFoto}
                  style={{ background: "#2563eb", border: "none", borderRadius: 8, padding: "8px 22px", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 7 }}>
                  <i className="bi bi-camera-fill" /> Capturar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// ── Modal: crear cita y lanzar consulta ──────────────────────────────────────
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
                <div className="mb-3">
                  <label className="form-label fw-semibold">Fecha</label>
                  <input type="date" className="form-control" value={fechaSel}
                    onChange={e => setFechaSel(e.target.value)} />
                </div>
                {slots.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Horarios disponibles</label>
                    <div className="d-flex flex-wrap gap-1">
                      {slots.map(s => (
                        <button key={s.inicio} type="button"
                          className={`btn btn-sm ${slotSel === s.inicio ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => selSlot(s)}>
                          {dayjs(s.inicio).format("h:mm A")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {medicoId && fechaSel && slots.length === 0 && (
                  <small className="text-muted d-block mb-2">Sin horarios disponibles. Ingresa hora manualmente.</small>
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
          </div>
          {modo && (
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => { setModo(null); setErr(""); }}>
                <i className="bi bi-arrow-left me-1"></i>Volver
              </button>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button
                className={`btn ${modo === "ahora" ? "btn-success" : "btn-primary"}`}
                disabled={saving}
                onClick={modo === "ahora" ? agendarAhora : agendarSeleccionado}>
                {saving ? "Creando…" : modo === "ahora" ? "Agendar y Consultar" : "Agendar Cita"}
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
