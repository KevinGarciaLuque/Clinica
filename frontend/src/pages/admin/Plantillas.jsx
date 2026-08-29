import { useEffect, useRef, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";

/* --- Tipos de documento --------------------------------------------- */
const TIPOS = [
  { key: "receta",      label: "Receta",        icon: "bi-file-earmark-medical-fill", color: "#1565c0" },
  { key: "constancia_libre", label: "Constancia Libre", menuLabel: "Libre",     icon: "bi-file-earmark-richtext-fill", color: "#0f766e" },
  { key: "incapacidad", label: "Incapacidad",    icon: "bi-bandaid-fill",              color: "#c62828" },
  { key: "referencia",  label: "Referencia",     menuLabel: "Detallada (hospital)", icon: "bi-send-fill", color: "#6a1b9a" },
  { key: "referencia_simple", label: "Referencia Simple", menuLabel: "Simple", icon: "bi-send-check-fill", color: "#8b5cf6" },
  { key: "constancia",  label: "Constancia",     menuLabel: "Estándar",       icon: "bi-patch-check-fill",          color: "#00695c" },
  { key: "constancias", label: "Constancias",    menuLabel: "Con Motivo",     icon: "bi-file-earmark-check-fill",   color: "#9333ea" },
  { key: "recibo",      label: "Recibo",         icon: "bi-receipt-cutoff",            color: "#e65100" },
  { key: "laboratorio", label: "Laboratorio",    icon: "bi-capsule",                   color: "#0277bd" },
  { key: "estudios",    label: "Estudios",       icon: "bi-clipboard2-pulse-fill",     color: "#2e7d32" },
];

// Tipos de documento que se agrupan bajo un solo botón con menú desplegable
// en la barra (para no saturarla con variantes del mismo documento) — cada
// uno conserva su propio diseño, datos y plantilla guardada por separado.
const GRUPOS_TABS = [
  { key: "constancias_grupo", label: "Constancias", icon: "bi-file-earmark-check-fill", color: "#9333ea", items: ["constancia_libre", "constancia", "constancias"] },
  { key: "referencia_grupo",  label: "Referencia",  icon: "bi-send-fill",               color: "#6a1b9a", items: ["referencia", "referencia_simple"] },
];
const PERSONALIZACION_TAB = { key: "personalizacion", label: "Personalización", icon: "bi-sliders", color: "#7c3aed" };

/* Opciones del selector "Tipo de constancia" de la pestaña Constancias. El
   valor elegido se guarda en titulo_documento (mismo campo que ya usa
   Constancia Libre para su título) y se imprime como encabezado del bloque. */
const CONSTANCIA_TIPOS = [
  { value: "CONSTANCIA MEDICA",   label: "Médica" },
  { value: "CONSTANCIA LABORAL",  label: "Laboral" },
  { value: "CONSTANCIA DE ESTUDIO", label: "Estudio" },
];

/* Documentos que NO pasan por buildHTML (tienen su propia plantilla fija en
   Endocrinología/Educación en Diabetes) — aquí solo se configura si el
   encabezado lleva color o no, y cuál color. Esa config se guarda con el mismo
   mecanismo (plantillas_documentos) y la lee cada módulo directamente. */
const CONFIG_EXTRA_TIPOS = [
  { key: "endo_seguimiento", label: "Control Seguimiento", icon: "bi-heart-pulse-fill", color: "#ea580c", defaultColor: "#ea580c", subtitulo: "Control Intensivo en Pacientes con Diabetes" },
  { key: "endo_plan",        label: "Plan Seguimiento",    icon: "bi-clipboard2-pulse-fill", color: "#ea580c", defaultColor: "#ea580c", subtitulo: "Control Intensivo en Pacientes con Diabetes" },
  { key: "educacion_sesion", label: "Sesión Educativa",    icon: "bi-mortarboard-fill", color: "#0d9488", defaultColor: "#0d9488", subtitulo: "Educación en Diabetes" },
];
const CONFIG_EXTRA_KEYS = new Set(CONFIG_EXTRA_TIPOS.map(t => t.key));

const TABS_UI = [PERSONALIZACION_TAB, ...TIPOS, ...CONFIG_EXTRA_TIPOS];

// Construye la lista que se renderiza en la barra de pestañas: igual que
// TABS_UI pero con cada grupo (ver GRUPOS_TABS) colapsado en un solo botón, en
// la posición que ocupaba su primer integrante. Recibe configExtraVisibles ya
// filtrado por módulos de la clínica (Control/Plan Seguimiento y Sesión
// Educativa solo deben verse en clínicas con el módulo de Endocrinología).
function construirTabsBar(configExtraVisibles) {
  const salida = [];
  const gruposInsertados = new Set();
  TIPOS.forEach(t => {
    const grupo = GRUPOS_TABS.find(g => g.items.includes(t.key));
    if (grupo) {
      if (!gruposInsertados.has(grupo.key)) { salida.push(grupo); gruposInsertados.add(grupo.key); }
    } else {
      salida.push(t);
    }
  });
  return [PERSONALIZACION_TAB, ...salida, ...configExtraVisibles];
}

/* Placeholder que se muestra (solo en pantalla, vía CSS) cuando el bloque de
   contenido libre de cada tipo esta vacio, para orientar al doctor. */
const CONTENT_HINTS = {
  receta:      "Cuerpo de la receta: medicamentos e indicaciones",
  incapacidad: "Observaciones / recomendaciones",
  referencia:  "Recomendaciones / observaciones adicionales",
  referencia_simple: "Información clínica (antecedentes, hallazgos, exámenes relevantes)",
  constancia:  "Texto principal de la constancia",
  constancias: "Contenido de la constancia (detalles, recomendaciones, etc.)",
  recibo:      "Concepto del servicio (por concepto de)",
  laboratorio: "Indicaciones previas al examen",
  estudios:    "Indicaciones / motivo del estudio",
};

/* --- Diseño compartido (Personalización), aplica a los 9 documentos --- */
const defaultPersonalizacion = () => ({
  _v: 1, logo_url: "", color: "#1a2744", header_text_color: "#ffffff",
  clinica: "", credenciales: "", footer: "",
  papel_size: "LETTER",
  papel_orientacion: "portrait",
  formato_receta: "media_carta",
  mostrar_firma: true, etiqueta_firma: "FIRMA",
  clinica_font: "Arial, Helvetica, sans-serif",
  clinica_font_size: "1.25",
  medico_font: "Arial, Helvetica, sans-serif",
  medico_font_size: "0.85",
  horarios: JSON.stringify([
    { dias: "Lunes a Viernes", horario: "8:00 AM - 5:00 PM" },
    { dias: "Sábados", horario: "8:00 AM - 12:00 PM" },
  ]),
  mostrar_horarios: false,
  sellos: [],
});

const PERSONALIZACION_KEYS = new Set(Object.keys(defaultPersonalizacion()).filter(k => k !== "_v"));

/* --- Datos propios de cada tipo de documento (ya no incluyen diseño) --- */
const defaultTipoData = () => ({ _v: 1, contenido: "", titulo_documento: "CONSTANCIA MEDICA" });

function parseJSON(raw, fallbackFn) {
  if (!raw) return fallbackFn();
  try { return { ...fallbackFn(), ...JSON.parse(raw) }; } catch { return fallbackFn(); }
}

const nl2br = (s = "") => s.replace(/\n/g, "<br/>");

function buildHTML(data, tipo, vars = {}, editableVars = false, editableData = true) {
  // editableVars: los datos del paciente (nombre, diagnostico, fechas...) se
  // vuelven contenteditable — solo cuando hay un paciente real seleccionado.
  // editableData: el contenido/boilerplate del documento se vuelve
  // contenteditable siempre (es la unica forma de editarlo, ya no hay panel).
  const ed = (key) => editableVars ? ` contenteditable="true" data-campo="${key}"` : "";
  const edData = (key, placeholder) => editableData
    ? ` contenteditable="true" data-campo="${key}"${placeholder ? ` data-placeholder="${String(placeholder).replace(/"/g, "&quot;")}"` : ""}`
    : "";
  // Casillas de verificacion (formularios tipo HC-10): clic para marcar/desmarcar
  // cuando hay un paciente seleccionado. El estado se guarda en vars.checks.
  const checksVal = vars.checks || {};
  const chk = (key, label) => {
    const on = !!checksVal[key];
    return `<span data-check="${key}" style="cursor:${editableVars ? "pointer" : "default"};user-select:none;font-size:1.35em;vertical-align:middle;line-height:1;display:inline-block;">${on ? "☑" : "☐"}</span> ${label}`;
  };
  const {
    logo_url = "", color = "#1a2744", header_text_color = "#ffffff",
    clinica = "Nombre del Consultorio", medico = "Dr(a). Nombre Medico",
    credenciales = "", contenido = "", footer = "",
    titulo_documento = "CONSTANCIA MEDICA",
    mostrar_firma = true, etiqueta_firma = "FIRMA",
    clinica_font = "Arial, Helvetica, sans-serif",
    clinica_font_size = "1.25",
    medico_font = "Arial, Helvetica, sans-serif",
    medico_font_size = "0.85",
    horarios = "[]", mostrar_horarios = false,
    sellos = [],
  } = data;

  let bodyText = contenido;
  Object.entries(vars).forEach(([k, v]) => { bodyText = bodyText.replaceAll("{{" + k + "}}", v || ""); });
  const bodyHTML = nl2br(bodyText);
  const bodyHTMLRich = /<[^>]+>/.test(bodyText) ? bodyText : nl2br(bodyText);
  const credHTML = nl2br(credenciales);

  const TITULOS = {
    incapacidad: "INCAPACIDAD MEDICA", referencia: "REFERENCIA MEDICA",
    referencia_simple: "REFERENCIA MEDICA",
    constancia: "CONSTANCIA MEDICA",  recibo: "RECIBO DE HONORARIOS",
    laboratorio: "ORDEN DE LABORATORIO", estudios: "ORDEN DE ESTUDIOS",
    // El título de Constancias lo elige el doctor con el selector "Tipo de
    // constancia" (Médica/Laboral/Estudio), guardado en titulo_documento.
    constancias: titulo_documento || "CONSTANCIA MEDICA",
  };

  const tituloBloque = TITULOS[tipo] ? `
    <div style="text-align:center;margin:14px 0 18px;">
      <span style="font-size:1em;font-weight:bold;letter-spacing:1px;color:${color};border:2px solid ${color};display:inline-block;padding:5px 24px;border-radius:4px;">${TITULOS[tipo]}</span>
    </div>` : "";

  const p = vars.paciente || "________________________";
  const dni = vars.paciente_dni || "________________________";
  const edad = vars.paciente_edad || "______";
  const fecha = vars.fecha || "___/___/____";
  const dx = vars.diagnostico || "________________________";

  let datosBloque = "";
  if (tipo === "receta") {
    datosBloque = `<div style="margin-bottom:14px;font-size:0.88em;border-bottom:1px solid #eee;padding-bottom:10px;">
      <div style="display:flex;gap:20px;margin-bottom:6px;">
        <div style="flex:2;">Paciente: <span style="display:inline-block;border-bottom:1px solid #555;min-width:180px;"${ed("paciente")}>${p}</span></div>
        <div style="flex:1;">Fecha: <span style="display:inline-block;border-bottom:1px solid #555;min-width:90px;"${ed("fecha")}>${fecha}</span></div>
      </div>
      <div style="display:flex;gap:20px;font-size:0.9em;color:#444;">
        <div>DNI: <span style="display:inline-block;border-bottom:1px solid #999;min-width:110px;"${ed("paciente_dni")}>${dni}</span></div>
        <div>Edad: <span style="display:inline-block;border-bottom:1px solid #999;min-width:60px;"${ed("paciente_edad")}>${edad}</span></div>
      </div>
    </div>`;
  } else if (tipo === "constancia_libre") {
    datosBloque = `<div style="font-size:0.93em;line-height:1.9;">
      <div style="text-align:center;font-weight:700;letter-spacing:.8px;color:${color};margin:4px 0 18px;"${edData("titulo_documento")}>
        ${titulo_documento || "CONSTANCIA MEDICA"}
      </div>
      <div>${bodyHTMLRich || "Completa el cuerpo de la constancia directo aqui."}</div>
      <div style="margin-top:26px;">Fecha: <b${ed("fecha")}>${fecha}</b></div>
    </div>`;
  } else if (tipo === "incapacidad") {
    const ciudad = vars.ciudad || "______________________________";
    datosBloque = `<div style="font-size:0.9em;line-height:2.4;">
      <div>POR ESTE MEDIO SE HACE CONSTAR QUE: <span style="display:inline-block;border-bottom:1px solid #333;min-width:200px;font-weight:600;"${ed("paciente")}>${p}</span>&nbsp;&nbsp;ID <span style="display:inline-block;border-bottom:1px solid #333;min-width:150px;font-weight:600;"${ed("paciente_dni")}>${dni}</span></div>
      <div>CON # DE EXPEDIENTE: <span style="display:inline-block;border-bottom:1px solid #333;min-width:80px;"${ed("expediente")}>${vars.expediente || " "}</span>&nbsp;&nbsp;DIAGNÓSTICO <span style="display:inline-block;border-bottom:1px solid #333;min-width:240px;font-weight:600;"${ed("diagnostico")}>${dx}</span></div>
      <div>DESDE EL DIA <span style="display:inline-block;border-bottom:1px solid #333;min-width:100px;font-weight:600;"${ed("fecha_inicio")}>${vars.fecha_inicio || "___/___/____"}</span>&nbsp;&nbsp;HASTA EL DIA <span style="display:inline-block;border-bottom:1px solid #333;min-width:100px;font-weight:600;"${ed("fecha_fin")}>${vars.fecha_fin || "___/___/____"}</span></div>
      ${(vars.empleador || editableVars) ? `<div>EMPRESA / EMPLEADOR: <span style="display:inline-block;border-bottom:1px solid #333;min-width:220px;font-weight:600;"${ed("empleador")}>${vars.empleador || ""}</span></div>` : ""}
      <div style="margin-top:16px;">PARA FINES QUE EL INTERESADO ESTIME CONVENIENTE, SE EXTIENDE LA PRESENTE EN LA CIUDAD DE <span style="display:inline-block;border-bottom:1px solid #333;min-width:160px;font-weight:600;"${ed("ciudad")}>${ciudad}</span>, EL DÍA <span style="font-weight:600;"${ed("fecha")}>${fecha}</span>.</div>
    </div>`;
  } else if (tipo === "referencia") {
    const ciudad = vars.ciudad || "______________________________";
    datosBloque = `<div style="font-family:Arial,sans-serif;font-size:0.72em;border:1px solid #999;">

      <!-- Fila 1: apellidos / nombre / sexo -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:1;padding:2px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Primer Apellido</span><div style="border-bottom:1px solid #aaa;min-height:13px;font-weight:600;"${ed("apellido1")}>${vars.apellido1 || ""}</div></div>
        <div style="flex:1;padding:2px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Segundo Apellido</span><div style="border-bottom:1px solid #aaa;min-height:13px;font-weight:600;"${ed("apellido2")}>${vars.apellido2 || ""}</div></div>
        <div style="flex:2;padding:2px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Nombre(s)</span><div style="border-bottom:1px solid #aaa;min-height:13px;font-weight:600;"${ed("nombres")}>${vars.nombres || p}</div></div>
        <div style="padding:4px 8px;"><span style="font-size:0.85em;color:#555;">Sexo: ${chk("sexo_h", "H")} ${chk("sexo_m", "M")}</span></div>
      </div>

      <!-- Fila 2: expediente / identidad / edad -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:2;padding:2px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">N° de expediente:</span> <span style="font-weight:600;"${ed("expediente")}>${vars.expediente || ""}</span></div>
        <div style="flex:2;padding:2px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">N° de Identidad:</span> <span style="font-weight:600;"${ed("paciente_dni")}>${dni}</span></div>
        <div style="flex:1;padding:2px 6px;"><span style="font-size:0.85em;color:#555;">Edad:</span> <span style="font-weight:600;"${ed("paciente_edad")}>${edad}</span></div>
      </div>

      <!-- Fila 3: dirección -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:2;padding:2px 6px;border-right:1px solid #999;white-space:nowrap;"><span style="font-size:0.85em;color:#555;">Dirección: Colonia</span> <span style="font-weight:600;display:inline-block;min-width:80px;"${ed("direccion")}>${vars.direccion || "____________"}</span></div>
        <div style="flex:1;padding:2px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Ciudad</span> <span style="font-weight:600;"${ed("ciudad")}>${ciudad}</span></div>
        <div style="flex:1;padding:2px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Municipio</span> <span style="font-weight:600;display:inline-block;min-width:60px;"${ed("municipio")}>${vars.municipio || "______"}</span></div>
        <div style="flex:1;padding:2px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Departamento</span> <span style="font-weight:600;display:inline-block;min-width:60px;"${ed("departamento")}>${vars.departamento || "______"}</span></div>
        <div style="flex:1;padding:2px 6px;"><span style="font-size:0.85em;color:#555;">Teléfono</span> <span style="font-weight:600;display:inline-block;min-width:60px;"${ed("telefono")}>${vars.telefono || "______"}</span></div>
      </div>

      <!-- Fila 4: establecimiento que refiere + institución -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:2;padding:2px 6px;border-right:1px solid #999;">
          <div style="font-size:0.85em;color:#555;font-weight:600;">Nombre del Establecimiento que refiere/responde:</div>
          <div style="font-weight:600;min-height:16px;"${ed("establecimiento_origen")}>${vars.establecimiento_origen || ""}</div>
        </div>
        <div style="flex:3;padding:2px 6px;">
          <div style="font-size:0.82em;color:#555;">Institución: ${chk("inst_sesal", "SESAL")} ${chk("inst_privado", "Privado")} ${chk("inst_ihss", "IHSS")} ${chk("inst_militar", "Militar")} ${chk("inst_ong", "ONG")} ${chk("inst_otro", "Otro:")} <span style="min-width:80px;display:inline-block;"${ed("inst_otro_texto")}>${vars.inst_otro_texto || "_______"}</span></div>
          <div style="font-size:0.82em;margin-top:3px;">Establecimiento que refiere o responde: ${chk("est_origen_uaps", "UAPS")} ${chk("est_origen_cis", "CIS")} ${chk("est_origen_policlinico", "Policlínico")} ${chk("est_origen_hospital", "Hospital:")} <span style="min-width:120px;display:inline-block;"${ed("est_origen_hospital_nombre")}>${vars.est_origen_hospital_nombre || "_____________"}</span></div>
        </div>
      </div>

      <!-- Motivo del envío -->
      <div style="border-bottom:1px solid #999;padding:2px 6px;">
        <span style="font-size:0.85em;color:#555;font-weight:600;">Motivo del envío:</span>
        <span style="margin-left:8px;">${chk("motivo_diagnostico", "Diagnóstico")} &nbsp;${chk("motivo_tratamiento", "Tratamiento")} &nbsp;${chk("motivo_seguimiento", "Seguimiento")} &nbsp;${chk("motivo_rehabilitacion", "Rehabilitación")}</span>
      </div>

      <!-- Diagnóstico -->
      <div style="border-bottom:1px solid #999;padding:2px 6px;">
        <span style="font-size:0.85em;color:#555;font-weight:600;">Impresión Diagnóstica:</span>
        <span style="font-weight:600;margin-left:6px;"${ed("diagnostico")}>${dx}</span>
      </div>

      <!-- Signos y síntomas / Resumen -->
      <div style="border-bottom:1px solid #999;padding:2px 6px;">
        <div style="font-size:0.85em;color:#555;font-weight:600;">Signos y Síntomas principales:</div>
        <div style="min-height:13px;"${ed("sintomas")}>${vars.sintomas || ""}</div>
      </div>
      <div style="border-bottom:1px solid #999;padding:2px 6px;">
        <div style="font-size:0.85em;color:#555;font-weight:600;">Resumen de datos clínicos:</div>
        <div style="min-height:24px;"${ed("resumen_clinico")}>${vars.resumen_clinico || ""}</div>
      </div>

      <!-- Signos vitales -->
      <div style="border-bottom:1px solid #999;padding:2px 6px;font-size:0.82em;">
        <b>Signos Vitales:</b> &nbsp; P/A:<span style="display:inline-block;border-bottom:1px solid #333;min-width:50px;"${ed("signos_pa")}>${vars.signos_pa || "_______"}</span> &nbsp; FR:<span style="display:inline-block;border-bottom:1px solid #333;min-width:50px;"${ed("signos_fr")}>${vars.signos_fr || "_______"}</span> &nbsp; P/FC:<span style="display:inline-block;border-bottom:1px solid #333;min-width:50px;"${ed("signos_pfc")}>${vars.signos_pfc || "_______"}</span> &nbsp; T°:<span style="display:inline-block;border-bottom:1px solid #333;min-width:50px;"${ed("signos_temp")}>${vars.signos_temp || "_______"}</span> &nbsp; Peso:<span style="display:inline-block;border-bottom:1px solid #333;min-width:50px;"${ed("signos_peso")}>${vars.signos_peso || "_______"}</span> &nbsp; Talla:<span style="display:inline-block;border-bottom:1px solid #333;min-width:50px;"${ed("signos_talla")}>${vars.signos_talla || "_______"}</span>
      </div>

      <!-- Exámenes -->
      <div style="border-bottom:1px solid #999;padding:2px 6px;">
        <div style="font-size:0.85em;color:#555;font-weight:600;">Resultados de exámenes complementarios:</div>
        <div style="min-height:13px;"></div>
      </div>

      <!-- Recomendaciones -->
      <div style="border-bottom:1px solid #999;padding:2px 6px;">
        <div style="font-size:0.85em;color:#555;font-weight:600;">Recomendaciones/observaciones:</div>
        <div style="min-height:13px;"${ed("recomendaciones")}>${vars.recomendaciones || ""}</div>
      </div>

      <!-- Referido a -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:2;padding:2px 6px;border-right:1px solid #999;">
          <div style="font-size:0.82em;color:#555;font-weight:600;">Referido/Responde a:</div>
          <div style="font-size:0.82em;">${chk("destino_uaps", "UAPS")} ${chk("destino_cis", "CIS")} ${chk("destino_policlinico", "Policlínico")} ${chk("destino_hospital", "Hospital:")} <span style="font-weight:600;"${ed("hospital_destino")}>${vars.hospital_destino || "_________________"}</span></div>
          <div style="font-size:0.82em;margin-top:2px;">Especialidad: <span style="font-weight:600;"${ed("especialidad_destino")}>${vars.especialidad_destino || "_________________"}</span></div>
        </div>
        <div style="flex:2;padding:2px 6px;">
          <div style="font-size:0.82em;color:#555;font-weight:600;">Amerita atención en:</div>
          <div style="font-size:0.82em;">${chk("atencion_externa", "Consulta Externa")} &nbsp;${chk("atencion_emergencia", "Emergencia")} &nbsp;${chk("atencion_hospitalizacion", "Hospitalización")}</div>
        </div>
      </div>

      <!-- Fecha elaboración / elaborada por -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:2;padding:2px 6px;border-right:1px solid #999;font-size:0.82em;">
          <b>Referencia elaborada por:</b> ${chk("elabora_medico_general", "Médico General")} &nbsp;${chk("elabora_medico_especialista", "Médico Especialista")} &nbsp;${chk("elabora_enfermera", "Enfermera")}
        </div>
        <div style="flex:2;padding:2px 6px;font-size:0.82em;">
          <b>Fecha de elaboración:</b> <span style="font-weight:600;"${ed("fecha")}>${fecha}</span>
        </div>
      </div>

      <!-- Firma de quien recibe/responde (la firma de quien elabora ya aparece en el bloque FIRMA del documento) -->
      <div style="padding:6px 6px 4px;font-size:0.82em;display:flex;justify-content:flex-end;">
        <div style="flex:1;max-width:260px;">
          <div style="border-bottom:1px solid #333;min-height:26px;"${ed("cargo_contacto")}>${vars.cargo_contacto || ""}</div>
          <div style="text-align:center;font-size:0.9em;">Nombre y Cargo de la persona contactada</div>
        </div>
      </div>

      <!-- Footer HC-10 -->
      <div style="background:#f5f5f5;border-top:1px solid #999;padding:2px 6px;display:flex;justify-content:space-between;font-size:0.78em;">
        <span>Referencia: Oportuna: Si${chk("oportuna_si", "")} No${chk("oportuna_no", "")} &nbsp;&nbsp; Justificado: Si${chk("justificado_si", "")} No${chk("justificado_no", "")}</span>
        <span style="font-weight:700;">HC-10</span>
      </div>
    </div>`;
  } else if (tipo === "constancia") {
    const ciudad = vars.ciudad || "______________________________";
    datosBloque = `<div style="font-size:0.9em;line-height:2.4;">
      <div>POR ESTE MEDIO HACE CONSTAR QUE: <span style="display:inline-block;border-bottom:1px solid #333;min-width:200px;font-weight:600;"${ed("paciente")}>${p}</span>&nbsp;&nbsp;ID <span style="display:inline-block;border-bottom:1px solid #333;min-width:150px;font-weight:600;"${ed("paciente_dni")}>${dni}</span></div>
      <div>CON # DE EXPEDIENTE: <span style="display:inline-block;border-bottom:1px solid #333;min-width:80px;"${ed("expediente")}>${vars.expediente || " "}</span>&nbsp;&nbsp;DIAGNÓSTICO <span style="display:inline-block;border-bottom:1px solid #333;min-width:240px;font-weight:600;"${ed("diagnostico")}>${dx}</span></div>
      <div style="margin-top:16px;">PARA FINES QUE EL INTERESADO ESTIME CONVENIENTE, SE EXTIENDE LA PRESENTE EN LA CIUDAD DE <span style="display:inline-block;border-bottom:1px solid #333;min-width:160px;font-weight:600;"${ed("ciudad")}>${ciudad}</span>, EL DÍA <span style="font-weight:600;"${ed("fecha")}>${fecha}</span>.</div>
    </div>`;
  } else if (tipo === "constancias") {
    datosBloque = `<div style="font-size:0.9em;">
      <div style="display:flex;gap:20px;margin-bottom:8px;flex-wrap:wrap;">
        <div style="flex:2;">Paciente: <span style="display:inline-block;border-bottom:1px solid #555;min-width:220px;font-weight:600;"${ed("paciente")}>${p}</span></div>
        <div style="flex:1;">Fecha: <span style="display:inline-block;border-bottom:1px solid #555;min-width:110px;"${ed("fecha")}>${fecha}</span></div>
      </div>
      <div style="display:flex;gap:20px;font-size:0.9em;color:#444;margin-bottom:12px;">
        <div>DNI: <span style="display:inline-block;border-bottom:1px solid #999;min-width:150px;"${ed("paciente_dni")}>${dni}</span></div>
        <div>Edad: <span style="display:inline-block;border-bottom:1px solid #999;min-width:70px;"${ed("paciente_edad")}>${edad}</span></div>
      </div>
      <div style="font-weight:600;color:#374151;margin-bottom:2px;">Motivo:</div>
      <div style="border-bottom:1px solid #999;min-height:20px;padding-bottom:2px;font-weight:600;"${ed("motivo")}>${vars.motivo || "________________________"}</div>
    </div>`;
  } else if (tipo === "referencia_simple") {
    datosBloque = `<div style="font-size:0.9em;">
      <div style="display:flex;gap:20px;margin-bottom:8px;flex-wrap:wrap;">
        <div style="flex:2;">Paciente: <span style="display:inline-block;border-bottom:1px solid #555;min-width:220px;font-weight:600;"${ed("paciente")}>${p}</span></div>
        <div style="flex:1;">Fecha: <span style="display:inline-block;border-bottom:1px solid #555;min-width:110px;"${ed("fecha")}>${fecha}</span></div>
      </div>
      <div style="display:flex;gap:20px;font-size:0.9em;color:#444;margin-bottom:12px;">
        <div>DNI: <span style="display:inline-block;border-bottom:1px solid #999;min-width:150px;"${ed("paciente_dni")}>${dni}</span></div>
        <div>Edad: <span style="display:inline-block;border-bottom:1px solid #999;min-width:70px;"${ed("paciente_edad")}>${edad}</span></div>
      </div>
      <div style="margin-bottom:12px;">Se refiere a (médico/especialidad): <span style="display:inline-block;border-bottom:1px solid #999;min-width:280px;font-weight:600;"${ed("especialidad_destino")}>${vars.especialidad_destino || "________________________"}</span></div>
      <div style="font-weight:600;color:#374151;margin-bottom:2px;">Motivo de referencia:</div>
      <div style="border-bottom:1px solid #999;min-height:20px;padding-bottom:2px;font-weight:600;"${ed("motivo")}>${vars.motivo || "________________________"}</div>
    </div>`;
  } else if (tipo === "recibo") {
    const retencion = vars.retenciones || (vars.monto ? (parseFloat(vars.monto) * 0.125).toFixed(2) : "0.00");
    const totalNeto = vars.total_neto || (vars.monto ? (parseFloat(vars.monto) * 0.875).toFixed(2) : "0.00");
    datosBloque = `
    <!-- RTN / CAI box -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
      <div style="border:2px solid #333;padding:8px 14px;text-align:center;min-width:270px;">
        <div style="font-size:0.82em;">RTN: <b${ed("rtn_medico")}>${vars.rtn_medico || "__________________________"}</b></div>
        <div style="font-weight:700;font-size:0.88em;margin:5px 0;text-transform:uppercase;">Recibo por Honorarios Profesionales</div>
        <div style="font-size:0.72em;color:#555;">CAI: <span${ed("cai")}>${vars.cai || "____________________________________"}</span></div>
        <div style="background:#111;color:#fff;padding:4px 8px;margin-top:6px;font-weight:700;font-size:0.85em;letter-spacing:0.5px;">
          N° <span${ed("num_recibo")}>${vars.num_recibo || "000-001-00-00000001"}</span>
        </div>
      </div>
    </div>
    <!-- Campos principales -->
    <div style="font-size:0.9em;line-height:2.5;border-bottom:1px solid #ccc;padding-bottom:10px;">
      <div>Recibí de: <span style="display:inline-block;border-bottom:1px solid #333;min-width:220px;font-weight:600;"${ed("paciente")}>${p}</span>&nbsp;&nbsp; RTN: <span style="display:inline-block;border-bottom:1px solid #333;min-width:150px;"${ed("rtn_paciente")}>${vars.rtn_paciente || ""}</span></div>
      <div>La suma neta de: <span style="display:inline-block;border-bottom:1px solid #333;min-width:400px;font-weight:600;">L.&nbsp;<span${ed("monto")}>${vars.monto || "0.00"}</span></span></div>
      <div>Por concepto de: <span style="display:inline-block;border-bottom:1px solid #333;min-width:360px;"${edData("contenido", CONTENT_HINTS.recibo)}>${bodyHTML || ""}</span></div>
      <div style="border-bottom:1px solid #aaa;margin-top:4px;"></div>
    </div>
    <!-- Fecha + Totales -->
    <div style="display:flex;gap:20px;margin-top:16px;align-items:flex-end;">
      <div style="flex:1;font-size:0.9em;line-height:2.6;">
        <div>
          <span style="display:inline-block;border-bottom:1px solid #333;min-width:70px;">&nbsp;</span>
          de&nbsp;<span style="display:inline-block;border-bottom:1px solid #333;min-width:110px;">&nbsp;</span>
          &nbsp;del&nbsp;<span style="display:inline-block;border-bottom:1px solid #333;min-width:60px;">&nbsp;</span>
        </div>
        <div style="margin-top:24px;border-top:1px solid #333;padding-top:4px;text-align:center;font-size:0.88em;">Firma</div>
      </div>
      <div style="flex:1;">
        <table style="width:100%;border-collapse:collapse;font-size:0.86em;">
          <tr style="background:#e8e8e8;"><td style="padding:6px 10px;font-weight:600;">Total por honorarios:</td><td style="padding:6px 10px;border-bottom:1px solid #bbb;">L. ${vars.monto || "0.00"}</td></tr>
          <tr style="background:#e8e8e8;"><td style="padding:6px 10px;font-weight:600;">Retenciones (12.5%):</td><td style="padding:6px 10px;border-bottom:1px solid #bbb;">L. ${retencion}</td></tr>
          <tr style="background:#d0d0d0;"><td style="padding:6px 10px;font-weight:700;">Total neto recibido:</td><td style="padding:6px 10px;font-weight:700;">L. ${totalNeto}</td></tr>
        </table>
      </div>
    </div>`;
  } else if (tipo === "laboratorio") {
    datosBloque = `<table style="width:100%;border-collapse:collapse;font-size:0.87em;margin-bottom:10px;">
      <tr><td style="padding:5px;border:1px solid #ddd;background:#e8f4fd;width:38%;"><b>Paciente:</b></td><td style="padding:5px;border:1px solid #ddd;"${ed("paciente")}>${p}</td><td style="padding:5px;border:1px solid #ddd;background:#e8f4fd;width:18%;"><b>Fecha:</b></td><td style="padding:5px;border:1px solid #ddd;"${ed("fecha")}>${fecha}</td></tr>
      <tr><td style="padding:5px;border:1px solid #ddd;background:#e8f4fd;"><b>Diagnóstico:</b></td><td colspan="3" style="padding:5px;border:1px solid #ddd;"${ed("diagnostico")}>${dx}</td></tr>
    </table>
    <div style="font-size:0.88em;font-weight:600;color:${color};margin-bottom:4px;">Exámenes Solicitados:</div>
    <div style="border:1px solid #b3d9f7;padding:10px 14px;min-height:70px;font-size:0.88em;line-height:1.9;"${ed("examenes")}>${vars.examenes ? nl2br(vars.examenes) : ""}</div>`;
  } else if (tipo === "estudios") {
    datosBloque = `<table style="width:100%;border-collapse:collapse;font-size:0.87em;margin-bottom:10px;">
      <tr><td style="padding:5px;border:1px solid #ddd;background:#e8f5e9;width:38%;"><b>Paciente:</b></td><td style="padding:5px;border:1px solid #ddd;"${ed("paciente")}>${p}</td><td style="padding:5px;border:1px solid #ddd;background:#e8f5e9;width:18%;"><b>Fecha:</b></td><td style="padding:5px;border:1px solid #ddd;"${ed("fecha")}>${fecha}</td></tr>
      <tr><td style="padding:5px;border:1px solid #ddd;background:#e8f5e9;"><b>Diagnóstico:</b></td><td colspan="3" style="padding:5px;border:1px solid #ddd;"${ed("diagnostico")}>${dx}</td></tr>
    </table>
    <div style="font-size:0.88em;font-weight:600;color:${color};margin-bottom:4px;">Estudios Solicitados:</div>
    <div style="border:1px solid #a5d6a7;padding:10px 14px;min-height:70px;font-size:0.88em;line-height:1.9;"${ed("estudios")}>${vars.estudios ? nl2br(vars.estudios) : ""}</div>`;
  }

  // Bloque de contenido libre / boilerplate — se muestra siempre (aunque este
  // vacio) para los tipos que lo usan, ya que ahora es la unica forma de
  // editarlo (contenteditable). No aplica a constancia_libre (su cuerpo ya se
  // muestra completo en datosBloque) ni a recibo (usa su propio campo arriba).
  const contenidoBloque = ["incapacidad", "referencia", "referencia_simple", "constancia", "constancias", "laboratorio", "estudios"].includes(tipo) ? `
    <div style="background:#f9f9f9;border-left:3px solid ${color};padding:8px 12px;margin-top:12px;font-size:0.85em;line-height:1.7;min-height:20px;"${edData("contenido", CONTENT_HINTS[tipo])}>${bodyHTML}</div>` : "";

  const rxBloque = tipo === "receta" ? `
    <div style="font-size:2.2em;font-family:Georgia,serif;color:#333;line-height:1;margin:10px 0 4px;">℞</div>
    <div style="min-height:120px;font-size:0.88em;line-height:1.8;"${edData("contenido", CONTENT_HINTS.receta)}>${bodyHTML}</div>` : "";

  const firmaBloque = mostrar_firma ? `
    <div style="text-align:right;padding:4px 0 8px;">
      <div style="display:inline-block;text-align:center;min-width:160px;">
        ${data.medico_firma_url ? `<img src="${data.medico_firma_url}" style="max-height:50px;max-width:150px;object-fit:contain;margin-bottom:2px;" />` : ""}
        <div style="border-top:1px solid #333;padding-top:4px;font-size:0.82em;font-weight:600;">${etiqueta_firma || "FIRMA"}</div>
        <div style="font-size:0.76em;color:#555;">${medico}</div>
      </div>
    </div>` : "";

  let horariosParsed = [];
  try { horariosParsed = JSON.parse(horarios || "[]"); } catch { /* vacio */ }

  const horariosBloque = (mostrar_horarios && horariosParsed.length > 0) ? `
    <div style="border-top:1px solid #e0e0e0;padding-top:12px;margin-top:8px;">
      <div style="font-size:0.8em;font-weight:700;color:${color};margin-bottom:6px;display:flex;align-items:center;gap:4px;">
        <span style="font-size:1em;">🕒</span> Horarios de Atención
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;">
        ${horariosParsed.map(h => `
          <div style="display:flex;gap:8px;align-items:baseline;font-size:0.78em;padding:3px 0;border-bottom:1px dotted #e0e0e0;">
            <span style="font-weight:600;color:#374151;min-width:140px;">${h.dias}</span>
            <span style="color:#555;">${h.horario}</span>
          </div>`).join("")}
      </div>
    </div>` : "";

  const footerBloque = footer ? `
    <div style="background:${color};color:rgba(255,255,255,.88);padding:9px 20px;font-size:0.77em;text-align:center;">${footer}</div>` : "";

  const logoHeaderBloque = (logo_url && tipo !== "constancia_libre")
    ? `<div><img src="${logo_url}" style="max-height:100px;max-width:150px;object-fit:contain;background:rgba(255,255,255,.15);border-radius:6px;padding:5px;"/></div>`
    : "";

  const sellosBloque = (Array.isArray(sellos) && sellos.length > 0)
    ? sellos.map(s => `
      <img
        src="${s.url || ""}"
        style="position:absolute;left:${Number(s.x) || 0}px;top:${Number(s.y) || 0}px;width:${Number(s.w) || 120}px;max-width:220px;height:auto;z-index:5;opacity:0.98;pointer-events:none;"
      />`).join("")
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;border:1px solid #ddd;overflow:hidden;">
  <div style="background:${color};padding:14px 20px;display:flex;align-items:center;gap:12px;">
    ${logoHeaderBloque}
    <div style="flex:1;">
      <div style="color:${header_text_color};font-size:${clinica_font_size}em;font-family:${clinica_font};font-weight:bold;line-height:1.2;">${clinica || "<span style='opacity:.4;font-style:italic;font-size:.85em'>Nombre del consultorio</span>"}</div>
      <div style="color:${header_text_color}e6;font-size:${medico_font_size}em;font-family:${medico_font};font-weight:600;margin-top:5px;">${medico || ""}</div>
      ${credHTML ? `<div style="color:${header_text_color}bf;font-size:0.79em;margin-top:3px;line-height:1.7;">${credHTML}</div>` : ""}
    </div>
  </div>
  <div style="padding:18px 20px;position:relative;">
    ${sellosBloque}
    ${tituloBloque}
    ${datosBloque}
    ${tipo === "receta" ? rxBloque : ""}
    ${contenidoBloque}
  </div>
  <div style="padding:0 20px 14px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;">
    <div style="flex:1;min-width:200px;">${horariosBloque}</div>
    <div>${firmaBloque}</div>
  </div>
  ${footerBloque}
</div>`;
}

const MUESTRA = {
  paciente: "Carlos Mejia Reyes", paciente_dni: "0801-1990-12345", paciente_edad: "34 años",
  nombres: "Carlos Alexander", apellido1: "Mejia", apellido2: "Reyes",
  expediente: "719",
  fecha: "1 de mayo de 2026", ciudad: "Tegucigalpa, M.D.C",
  diagnostico: "J06.9 - Infeccion aguda vias respiratorias superiores",
  dias_reposo: "3", fecha_inicio: "01/05/2026", fecha_fin: "03/05/2026", empleador: "Empresa ABC S.A.",
  especialidad_destino: "Cardiologia", hospital_destino: "Hospital Escuela Universitario",
  establecimiento_origen: "CIS Nueva Esperanza",
  urgencia: "Preferente", monto: "350.00", retenciones: "43.75", total_neto: "306.25",
  rtn_medico: "08011995000022", cai: "20C90B-E3C453-9E4CA7-C7F083-E22C30-5C",
  num_recibo: "000-001-04-00000201", rtn_paciente: "05019893456789",
  sintomas: "Tos persistente, fiebre de 3 dias de evolucion, disnea leve.",
  resumen_clinico: "Paciente masculino de 34 años con cuadro de 3 dias de fiebre y tos. Se indica referencia para valoracion especializada.",
  recomendaciones: "Acudir en ayunas. Traer examenes previos.",
  examenes: "- Hemograma completo\n- Perfil lipidico\n- Glucosa en ayunas\n- Uroanalis",
  estudios: "- Radiografia de torax PA\n- Ecografia abdominal",
  motivo: "Trámite personal ante la institución que lo requiera",
};

const COLORES_RAPIDOS = [
  "#1a2744","#0d47a1","#b71c1c","#1b5e20","#4a148c","#e65100","#37474f","#006064",
];

const FUENTES = [
  { label: "Arial (sans-serif)",     value: "Arial, Helvetica, sans-serif" },
  { label: "Times New Roman (serif)", value: "'Times New Roman', Times, serif" },
  { label: "Georgia (serif)",        value: "Georgia, 'Times New Roman', serif" },
  { label: "Garamond (serif)",       value: "Garamond, 'Times New Roman', serif" },
  { label: "Verdana (sans-serif)",   value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS",           value: "'Trebuchet MS', sans-serif" },
  { label: "Courier New (monospace)",value: "'Courier New', Courier, monospace" },
  { label: "Tahoma (sans-serif)",    value: "Tahoma, Geneva, sans-serif" },
  { label: "Palatino (serif)",       value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
  { label: "Lucida Console",         value: "'Lucida Console', Monaco, monospace" },
  { label: "Comic Sans MS",          value: "'Comic Sans MS', cursive, sans-serif" },
  { label: "Brush Script MT",        value: "'Brush Script MT', cursive" },
  { label: "Segoe Script",           value: "'Segoe Script', cursive" },
  { label: "Gabriola",               value: "Gabriola, cursive" },
  { label: "Kristen ITC",            value: "'Kristen ITC', cursive" },
  { label: "Lucida Handwriting",     value: "'Lucida Handwriting', cursive" },
  { label: "Vladimir Script",        value: "'Vladimir Script', cursive" },
  { label: "Edwardian Script ITC",   value: "'Edwardian Script ITC', cursive" },
];

/* --- Componente principal ----------------------------------------- */
export default function Plantillas() {
  const { user, modulos } = useAuth();
  const clinicaId = user?.clinica_id || import.meta.env.VITE_CLINICA_ID;
  const medicoNombre = `${user?.nombres || ""} ${user?.apellidos || ""}`.trim();

  // Control Seguimiento / Plan Seguimiento / Sesión Educativa son plantillas
  // exclusivas del módulo de Endocrinología — solo se muestran si la clínica
  // del usuario tiene ese módulo activo (igual criterio que usa el Sidebar).
  const modulosClave = new Set((modulos || []).map(m => m.clave));
  const configExtraVisibles = CONFIG_EXTRA_TIPOS.filter(t =>
    t.key === "educacion_sesion" ? modulosClave.has("educacion_diabetes") : modulosClave.has("control_seguimiento_dm1")
  );
  const tabsBar = construirTabsBar(configExtraVisibles);

  const [tab,       setTab]       = useState("receta");
  const [medicoFirmaUrl, setMedicoFirmaUrl] = useState("");
  const [personalizacion, setPersonalizacion] = useState(defaultPersonalizacion());
  const [configExtra, setConfigExtra] = useState({}); // { [tipo]: { encabezado_color: bool, color } }
  const [datos,     setDatos]     = useState({});
  const [cargando,  setCargando]  = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg,       setMsg]       = useState({ tipo: "", texto: "" });
  const [isMobile,  setIsMobile]  = useState(window.innerWidth < 768);
  const [vistaMovil, setVistaMovil] = useState("form"); // "form" | "preview"
  const editorRef = useRef(null);
  const pageRef = useRef(null);
  const dragSelloRef = useRef(null);

  // --- Menú desplegable de los botones agrupados (Constancias, Referencia) en la barra ---
  const [grupoAbierto, setGrupoAbierto] = useState(null); // key de GRUPOS_TABS abierto, o null
  const grupoRefs = useRef({});
  useEffect(() => {
    if (!grupoAbierto) return;
    const cerrar = (e) => {
      const el = grupoRefs.current[grupoAbierto];
      if (el && !el.contains(e.target)) setGrupoAbierto(null);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [grupoAbierto]);

  // --- Paciente real (buscador unico en la cabecera, aplica a los 9 documentos) ---
  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [resultadosPaciente, setResultadosPaciente] = useState([]);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);
  const [pacienteSel, setPacienteSel] = useState(null);
  const [varsEditables, setVarsEditables] = useState({}); // { [tipo]: { campo: valor } }
  const [generandoPdf, setGenerandoPdf] = useState(false);

  useEffect(() => {
    if (!busquedaPaciente.trim() || pacienteSel) { setResultadosPaciente([]); return; }
    setBuscandoPaciente(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/pacientes", { params: { q: busquedaPaciente.trim() } });
        setResultadosPaciente(res.data.data || []);
      } catch { setResultadosPaciente([]); }
      finally { setBuscandoPaciente(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [busquedaPaciente, pacienteSel]);

  const seleccionarPaciente = (p) => {
    setPacienteSel(p);
    setBusquedaPaciente("");
    setResultadosPaciente([]);
  };

  const setVarEditable = (campo, valor) => {
    setVarsEditables(prev => ({ ...prev, [tab]: { ...(prev[tab] || {}), [campo]: valor } }));
  };

  const toggleCheck = (key) => {
    setVarsEditables(prev => {
      const actual = prev[tab] || {};
      const checks = actual.checks || {};
      return { ...prev, [tab]: { ...actual, checks: { ...checks, [key]: !checks[key] } } };
    });
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Firma escaneada del medico logueado (si la subio en su perfil).
  useEffect(() => {
    api.get("/auth/me").then(res => setMedicoFirmaUrl(res.data?.data?.firma_url || "")).catch(() => {});
  }, []);

  const getPaper = (size, orientacion) => {
    const s = String(size || "LETTER").toUpperCase();
    const isLandscape = orientacion === "landscape";
    const map = {
      LETTER: { w: 816, h: 1056, css: "Letter" }, // 8.5x11 at 96dpi
      HALF_LETTER: { w: 816, h: 528, css: "5.5in 8.5in" }, // media carta vertical
      LEGAL: { w: 816, h: 1344, css: "Legal" },   // 8.5x14 at 96dpi
      A4: { w: 794, h: 1123, css: "A4" },         // 210x297mm at 96dpi
    };
    const p = map[s] || map.LETTER;
    return {
      w: isLandscape ? p.h : p.w,
      h: isLandscape ? p.w : p.h,
      css: `${p.css} ${isLandscape ? "landscape" : "portrait"}`,
    };
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await api.get(`/clinicas/${clinicaId}/plantillas`);
        const rows = res.data.data || [];
        const byTipo = {};
        rows.forEach(r => { byTipo[r.tipo] = parseJSON(r.contenido, () => ({})); });

        // El diseño global vive en "_global"; si aun no existe, se migra desde
        // lo que ya estaba guardado en "receta" para no perder el branding previo.
        const fuente = byTipo["_global"] || byTipo["receta"] || {};
        setPersonalizacion({ ...defaultPersonalizacion(), ...fuente });

        const obj = {};
        TIPOS.forEach(t => {
          const row = byTipo[t.key] || {};
          obj[t.key] = {
            contenido: row.contenido || "",
            titulo_documento: row.titulo_documento || "CONSTANCIA MEDICA",
          };
        });
        setDatos(obj);

        const extra = {};
        CONFIG_EXTRA_TIPOS.forEach(t => {
          const row = byTipo[t.key] || {};
          extra[t.key] = {
            encabezado_color: row.encabezado_color !== false,
            color: row.color || t.defaultColor,
          };
        });
        setConfigExtra(extra);
      } catch { /* sin plantillas aun */ }
      finally { setCargando(false); }
    };
    if (clinicaId) cargar();
    else setCargando(false);
  }, [clinicaId]);

  const dataActual = tab === "personalizacion"
    ? { ...personalizacion, medico: medicoNombre, medico_firma_url: medicoFirmaUrl, contenido: "", titulo_documento: "" }
    : { ...personalizacion, ...(datos[tab] || defaultTipoData()), medico: medicoNombre, medico_firma_url: medicoFirmaUrl };

  const set = (campo, valor) => {
    if (tab === "personalizacion" || PERSONALIZACION_KEYS.has(campo)) {
      setPersonalizacion(prev => ({ ...prev, [campo]: valor }));
    } else {
      setDatos(prev => ({ ...prev, [tab]: { ...(prev[tab] || defaultTipoData()), [campo]: valor } }));
    }
  };

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set("logo_url", ev.target.result);
    reader.readAsDataURL(file);
  };

  // El editor de Constancia Libre solo sincroniza al perder el foco (onBlur),
  // para no perder el cursor mientras el doctor escribe. Esta funcion lee el
  // valor mas reciente directo del DOM, por si el doctor guarda/genera/imprime
  // sin haber salido del campo todavia.
  const getTipoDataLive = () => {
    const base = datos[tab] || defaultTipoData();
    if (tab !== "constancia_libre") return base;
    return {
      ...base,
      contenido: editorRef.current ? editorRef.current.innerHTML : base.contenido,
    };
  };

  // Guarda solo el contenido propio del documento activo (contenido/titulo).
  const guardar = async () => {
    setGuardando(true); setMsg({ tipo: "", texto: "" });
    const tipoInfo = TIPOS.find(t => t.key === tab);
    try {
      const merged = { ...personalizacion, ...getTipoDataLive(), medico: medicoNombre };
      await api.post(`/clinicas/${clinicaId}/plantillas`, {
        tipo: tab, nombre: tipoInfo?.label || tab, contenido: JSON.stringify(merged),
      });
      setMsg({ tipo: "success", texto: `Plantilla de ${tipoInfo?.label} guardada correctamente` });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally { setGuardando(false); }
  };

  // Guarda el diseño global y lo aplica (fan-out) a los 9 documentos, para que
  // el backend que genera PDFs reales (prescripciones.js/estudios.js, que leen
  // la fila "receta") siempre encuentre el diseño actualizado sin cambios ahi.
  const guardarPersonalizacion = async () => {
    setGuardando(true); setMsg({ tipo: "", texto: "" });
    try {
      await api.post(`/clinicas/${clinicaId}/plantillas`, {
        tipo: "_global", nombre: "Personalización", contenido: JSON.stringify(personalizacion),
      });
      for (const t of TIPOS) {
        const tipoData = datos[t.key] || defaultTipoData();
        const merged = { ...tipoData, ...personalizacion, medico: medicoNombre };
        await api.post(`/clinicas/${clinicaId}/plantillas`, {
          tipo: t.key, nombre: t.label, contenido: JSON.stringify(merged),
        });
      }
      setMsg({ tipo: "success", texto: "Personalización guardada y aplicada a los 9 documentos" });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally { setGuardando(false); }
  };

  const setConfigExtraCampo = (campo, valor) => {
    setConfigExtra(prev => ({ ...prev, [tab]: { ...(prev[tab] || {}), [campo]: valor } }));
  };

  // Guarda el toggle "encabezado con color" + color de Control Seguimiento /
  // Plan Seguimiento / Sesion Educativa. Estos documentos no pasan por
  // buildHTML: el propio modulo de Endocrinologia/Educacion lee esta config.
  const guardarConfigExtra = async () => {
    setGuardando(true); setMsg({ tipo: "", texto: "" });
    const tipoInfo = CONFIG_EXTRA_TIPOS.find(t => t.key === tab);
    try {
      await api.post(`/clinicas/${clinicaId}/plantillas`, {
        tipo: tab, nombre: tipoInfo?.label || tab, contenido: JSON.stringify(configExtra[tab] || {}),
      });
      setMsg({ tipo: "success", texto: `Configuración de ${tipoInfo?.label} guardada` });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally { setGuardando(false); }
  };

  const construirHtmlCompleto = () => {
    // Regenera el HTML con el contenido mas reciente del editor (por si el
    // doctor no ha salido del campo todavia, ver getTipoDataLive arriba).
    const dataParaExport = { ...personalizacion, ...getTipoDataLive(), medico: medicoNombre, medico_firma_url: medicoFirmaUrl };
    const htmlFinal = buildHTML(dataParaExport, tab, varsPreview, !!pacienteSel, true);
    const paper = getPaper(dataParaExport.papel_size, dataParaExport.papel_orientacion);
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${tipoActivo?.label || "Plantilla"}</title>
  <style>
    @page { size: ${paper.css}; margin: 10mm; }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body { margin: 0; padding: 0; }
    body { padding: 18px; background: #f3f4f6; font-family: Arial, sans-serif; }
    @media print {
      html, body { background: #fff !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  ${htmlFinal}
</body>
</html>`;
  };

  const imprimirVistaPrevia = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(construirHtmlCompleto());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const generarDocumentoPdf = async () => {
    if (!pacienteSel) return;
    setGenerandoPdf(true); setMsg({ tipo: "", texto: "" });
    try {
      if (tab === "receta") {
        // Para Receta se crea el registro real (igual que desde Consulta Medica)
        // para que el PDF tenga QR y numero de receta verdaderos y verificables,
        // en vez de un documento suelto sin respaldo en el sistema.
        const notas = (datos.receta?.contenido || "").trim();
        const { data } = await api.post("/prescripciones", {
          paciente_id: pacienteSel.id,
          notas,
          items: [],
        });
        const res = await api.get(`/prescripciones/${data.id}/pdf`, { responseType: "blob" });
        const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        window.open(url, "_blank");
        setMsg({ tipo: "success", texto: `Receta #${data.id} generada y guardada en el sistema` });
      } else {
        const res = await api.post("/documentos/generar-pdf", {
          html: construirHtmlCompleto(),
          paper_size: dataActual.papel_size,
          orientacion: dataActual.papel_orientacion,
          nombre_archivo: `${tab}-${pacienteSel.nombres}-${pacienteSel.apellidos}`,
        }, { responseType: "blob" });
        const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        window.open(url, "_blank");
      }
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally { setGenerandoPdf(false); }
  };

  const isRichWordMode = tab === "constancia_libre";
  const sellosArrastrables = tab === "personalizacion";

  const execRich = (cmd) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(cmd, false, null);
    set("contenido", editorRef.current.innerHTML);
  };

  const onSelloMouseDown = (e, index) => {
    if (!sellosArrastrables) return;
    if (!pageRef.current) return;
    e.preventDefault();
    const pageRect = pageRef.current.getBoundingClientRect();
    const sello = (personalizacion.sellos || [])[index];
    if (!sello) return;
    dragSelloRef.current = {
      index,
      offsetX: e.clientX - pageRect.left - (Number(sello.x) || 0),
      offsetY: e.clientY - pageRect.top - (Number(sello.y) || 0),
    };
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragSelloRef.current || !pageRef.current) return;
      const pageRect = pageRef.current.getBoundingClientRect();
      const idx = dragSelloRef.current.index;
      const sello = (personalizacion.sellos || [])[idx];
      if (!sello) return;
      const w = Number(sello.w) || 120;
      const maxX = Math.max(0, pageRect.width - w);
      const maxY = Math.max(0, pageRect.height - 40);
      const nx = Math.max(0, Math.min(maxX, e.clientX - pageRect.left - dragSelloRef.current.offsetX));
      const ny = Math.max(0, Math.min(maxY, e.clientY - pageRect.top - dragSelloRef.current.offsetY));
      const nuevosSellos = [...(personalizacion.sellos || [])];
      nuevosSellos[idx] = { ...sello, x: Math.round(nx), y: Math.round(ny) };
      setPersonalizacion(prev => ({ ...prev, sellos: nuevosSellos }));
    };
    const onUp = () => { dragSelloRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [personalizacion]);

  if (cargando) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  const tipoActivo = TABS_UI.find(t => t.key === tab);

  const varsReales = pacienteSel ? (() => {
    const nombres = pacienteSel.nombres || "";
    const apellidos = pacienteSel.apellidos || "";
    const partesApellido = apellidos.trim().split(/\s+/).filter(Boolean);
    return {
      paciente: `${nombres} ${apellidos}`.trim(),
      paciente_dni: pacienteSel.dni || "",
      paciente_edad: pacienteSel.edad != null ? `${pacienteSel.edad} años` : "",
      nombres,
      apellido1: partesApellido[0] || "",
      apellido2: partesApellido.slice(1).join(" ") || "",
      fecha: new Date().toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" }),
      ciudad: pacienteSel.ciudad || "",
      direccion: pacienteSel.direccion || "",
      departamento: pacienteSel.departamento || "",
      telefono: pacienteSel.telefono || "",
    };
  })() : null;

  const varsPreview = pacienteSel
    ? { ...varsReales, ...(varsEditables[tab] || {}) }
    : MUESTRA;

  const previewHtml = tab === "personalizacion"
    ? buildHTML({ ...personalizacion, medico: medicoNombre, medico_firma_url: medicoFirmaUrl }, "receta", MUESTRA, false, false)
    : CONFIG_EXTRA_KEYS.has(tab)
      ? ""
      : buildHTML(dataActual, tab, varsPreview, !!pacienteSel, true);

  // Se sincroniza en onBlur (no en cada tecla): si se recalculara el HTML
  // completo en cada pulsacion, React reemplazaria el nodo contentEditable a
  // mitad de la escritura y el cursor/foco se perderia en cada letra.
  // El contenido/boilerplate del documento se persiste con "Guardar"; los
  // datos del paciente no se persisten (son por cada generacion).
  const CAMPOS_DE_DATA = new Set(["contenido", "titulo_documento"]);
  const handlePreviewEdit = (e) => {
    const el = e.target.closest && e.target.closest("[data-campo]");
    if (!el) return;
    const campo = el.dataset.campo;
    if (CAMPOS_DE_DATA.has(campo)) set(campo, el.innerText);
    else setVarEditable(campo, el.innerText);
  };

  // Al enfocar un blanco (ej. "________"), selecciona todo su contenido para
  // que el doctor pueda escribir encima sin borrar manualmente los guiones.
  const handlePreviewFocus = (e) => {
    const el = e.target.closest && e.target.closest("[data-campo]");
    if (!el) return;
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  // Casillas (H/M, SESAL/Privado, Diagnostico/Tratamiento, etc.) se marcan con
  // un clic — solo cuando hay un paciente real seleccionado.
  const handlePreviewClick = (e) => {
    if (!pacienteSel) return;
    const el = e.target.closest && e.target.closest("[data-check]");
    if (!el) return;
    toggleCheck(el.dataset.check);
  };
  const lStyle      = { fontWeight: 600, fontSize: "0.82rem", color: "#374151", marginBottom: 5, display: "block" };
  const iStyle      = { fontSize: "0.86rem" };

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      <style>{`
        .plantilla-editable [data-campo] { cursor: text; border-radius: 2px; }
        .plantilla-editable [data-campo]:hover { background: #fff7cc; }
        .plantilla-editable [data-campo]:focus { outline: 2px solid #3b82f6; background: #eff6ff; }
        .plantilla-editable [data-campo]:empty:before { content: attr(data-placeholder); color: #9ca3af; font-style: italic; }
        .plantilla-editable [data-check]:hover { background: #fff7cc; border-radius: 3px; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg,#1a2744 0%,#243b72 100%)", padding: isMobile ? "12px 14px 0" : "16px 24px 0", boxShadow: "0 2px 12px rgba(0,0,0,.18)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isMobile ? 10 : 14, flexWrap: "wrap" }}>
          <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-file-earmark-text-fill" style={{ color: "#7dd3fc", fontSize: "0.9rem" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: isMobile ? "0.92rem" : "1.05rem" }}>Plantillas de Documentos</div>
            {!isMobile && <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>Personaliza el diseño de tus documentos médicos</div>}
          </div>

          {/* Buscador de paciente unico: aplica a los 9 documentos, oculto en Personalizacion y en las config ligeras */}
          {tab !== "personalizacion" && !CONFIG_EXTRA_KEYS.has(tab) && (
            <div style={{ marginLeft: isMobile ? 0 : "auto", position: "relative", width: isMobile ? "100%" : 280 }}>
              {!pacienteSel ? (
                <>
                  <input
                    className="form-control form-control-sm"
                    style={{ fontSize: "0.82rem" }}
                    placeholder="Buscar paciente por nombre, DNI o telefono..."
                    value={busquedaPaciente}
                    onChange={e => setBusquedaPaciente(e.target.value)}
                  />
                  {buscandoPaciente && <small style={{ color: "rgba(255,255,255,.7)" }}>Buscando...</small>}
                  {resultadosPaciente.length > 0 && (
                    <div style={{ position: "absolute", zIndex: 30, top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 14px rgba(0,0,0,.25)" }}>
                      {resultadosPaciente.map(p => (
                        <div key={p.id} onClick={() => seleccionarPaciente(p)}
                          style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", fontSize: "0.82rem" }}
                          onMouseDown={e => e.preventDefault()}>
                          <div style={{ fontWeight: 600, color: "#1a2744" }}>{p.nombres} {p.apellidos}</div>
                          <div style={{ color: "#6b7280", fontSize: "0.75rem" }}>
                            {p.dni ? `DNI: ${p.dni}` : "Sin DNI"}{p.edad != null ? ` · ${p.edad} años` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 8, padding: "6px 10px" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff" }}>{pacienteSel.nombres} {pacienteSel.apellidos}</div>
                    <div style={{ color: "rgba(255,255,255,.65)", fontSize: "0.72rem" }}>
                      {pacienteSel.dni ? `DNI: ${pacienteSel.dni}` : "Sin DNI"}{pacienteSel.edad != null ? ` · ${pacienteSel.edad} años` : ""}
                    </div>
                  </div>
                  <button onClick={() => setPacienteSel(null)} title="Quitar paciente" style={{ border: "1px solid rgba(220,38,38,.5)", background: "rgba(220,38,38,.15)", color: "#fecaca", borderRadius: 6, padding: "5px 8px", cursor: "pointer" }}>
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Tabs — se envuelven en varias filas en vez de recortarse u obligar a hacer scroll */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, rowGap: 5 }}>
          {tabsBar.map((t) => {
            const grupo = GRUPOS_TABS.find(g => g.key === t.key);
            if (grupo) {
              const grupoActivo = grupo.items.includes(tab);
              const abierto = grupoAbierto === grupo.key;
              return (
                <div key={grupo.key} ref={el => { grupoRefs.current[grupo.key] = el; }} style={{ position: "relative" }}>
                  <button onClick={() => setGrupoAbierto(o => (o === grupo.key ? null : grupo.key))}
                    style={{ padding: isMobile ? "6px 10px" : "7px 14px", fontSize: isMobile ? "0.72rem" : "0.8rem", fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", background: grupoActivo ? "#fff" : "rgba(255,255,255,.1)", color: grupoActivo ? grupo.color : "rgba(255,255,255,.75)", display: "flex", alignItems: "center", gap: 4, transition: "background .15s", whiteSpace: "nowrap" }}>
                    <i className={`bi ${grupo.icon}`} />
                    {grupo.label}
                    <i className="bi bi-chevron-down" style={{ fontSize: "0.65em", marginLeft: 1, transform: abierto ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                  </button>
                  {abierto && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 40, background: "#1a2744", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,.35)", minWidth: 210, overflow: "hidden" }}>
                      {grupo.items.map(k => {
                        const it = TIPOS.find(x => x.key === k);
                        const seleccionado = tab === k;
                        return (
                          <button key={k} onClick={() => { setTab(k); setMsg({ tipo: "", texto: "" }); setVistaMovil("form"); setGrupoAbierto(null); }}
                            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", border: "none", background: seleccionado ? "rgba(255,255,255,.08)" : "transparent", color: "#fff", cursor: "pointer", fontSize: "0.83rem", fontWeight: 600, textAlign: "left" }}>
                            <i className={`bi ${it.icon}`} style={{ color: it.color, fontSize: "1rem" }} />
                            <span style={{ flex: 1 }}>{it.menuLabel || it.label}</span>
                            {seleccionado && <i className="bi bi-check-lg" style={{ color: "#7dd3fc" }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const { key, label, icon, color } = t;
            return (
              <button key={key} onClick={() => { setTab(key); setMsg({ tipo: "", texto: "" }); setVistaMovil("form"); }}
                style={{ padding: isMobile ? "6px 10px" : "7px 14px", fontSize: isMobile ? "0.72rem" : "0.8rem", fontWeight: 600, borderRadius: 8, border: "none", cursor: "pointer", background: tab === key ? "#fff" : "rgba(255,255,255,.1)", color: tab === key ? color : "rgba(255,255,255,.75)", display: "flex", alignItems: "center", gap: 4, transition: "background .15s", whiteSpace: "nowrap" }}>
                <i className={`bi ${icon}`} />
                {isMobile ? label.split(" ")[0] : label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: isMobile ? "12px" : "16px 24px" }}>

        {msg.texto && (
          <div style={{ marginBottom: 14, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: msg.tipo === "success" ? "#dcfce7" : "#fee2e2", color: msg.tipo === "success" ? "#166534" : "#991b1b", border: `1px solid ${msg.tipo === "success" ? "#bbf7d0" : "#fecaca"}` }}>
            <span><i className={`bi ${msg.tipo === "success" ? "bi-check-circle-fill" : "bi-x-circle-fill"} me-2`} />{msg.texto}</span>
            <button onClick={() => setMsg({ tipo: "", texto: "" })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}>x</button>
          </div>
        )}

        {/* Toggle móvil: Formulario / Vista previa — aplica cuando hay panel izquierdo (Personalizacion y config ligeras) */}
        {isMobile && (tab === "personalizacion" || CONFIG_EXTRA_KEYS.has(tab)) && (
          <div style={{ display: "flex", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 12 }}>
            {[
              { k: "form",    label: "Formulario", icon: "bi-sliders" },
              { k: "preview", label: "Vista previa", icon: "bi-eye-fill" },
            ].map(v => (
              <button key={v.k} onClick={() => setVistaMovil(v.k)}
                style={{ flex: 1, padding: "9px 0", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: vistaMovil === v.k ? "#1a2744" : "transparent", color: vistaMovil === v.k ? "#fff" : "#6b7280", transition: "all .15s" }}>
                <i className={`bi ${v.icon}`} />{v.label}
              </button>
            ))}
          </div>
        )}

        {/* LAYOUT: form + preview (el panel izquierdo solo existe para Personalizacion) */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: "flex-start" }}>

          {/* PANEL IZQUIERDO: solo pestaña Personalización */}
          {tab === "personalizacion" && (!isMobile || vistaMovil === "form") && (
          <div style={{ flex: isMobile ? "1 1 100%" : "0 0 360px", width: isMobile ? "100%" : undefined, background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: isMobile ? "16px" : "20px", display: "flex", flexDirection: "column", gap: 16 }}>

            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f0f0f0", paddingBottom: 12 }}>
              <i className={`bi ${tipoActivo?.icon}`} style={{ color: tipoActivo?.color, fontSize: "1.2rem" }} />
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1a2744" }}>{tipoActivo?.label}</span>
            </div>
            <small style={{ color: "#6b7280", fontSize: "0.78rem", marginTop: -10 }}>
              Este diseño aplica por igual a los 9 documentos (Receta, Constancia Libre, Incapacidad, Referencia, Constancia, Constancias, Recibo, Laboratorio, Estudios).
            </small>

            {/* Logo */}
            <div>
              <label style={lStyle}><i className="bi bi-image me-2" style={{ color: tipoActivo?.color }} />Logo del consultorio</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {personalizacion.logo_url && (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 6, background: "#f9fafb" }}>
                    <img src={personalizacion.logo_url} alt="Logo" style={{ height: 48, maxWidth: 80, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>
                  <i className="bi bi-upload" style={{ color: tipoActivo?.color }} />
                  {personalizacion.logo_url ? "Cambiar logo" : "Subir logo"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoFile} />
                </label>
                {personalizacion.logo_url && (
                  <button onClick={() => set("logo_url", "")} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff5f5", cursor: "pointer", color: "#dc2626", fontSize: "0.82rem" }} title="Quitar logo">
                    <i className="bi bi-trash" />
                  </button>
                )}
              </div>
              <small style={{ color: "#9ca3af", fontSize: "0.75rem" }}>El logo aparece en la esquina izquierda del encabezado de los 9 documentos.</small>
            </div>

            {/* Sellos movibles */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, background: "#fafafa" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                <i className="bi bi-plus-circle" /> Agregar sello movible
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    files.forEach((file) => {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setPersonalizacion(prev => ({ ...prev, sellos: [...(prev.sellos || []), { url: ev.target?.result, x: 40, y: 150, w: 120 }] }));
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = "";
                  }}
                />
              </label>
              <div style={{ marginTop: 8 }}>
                <small style={{ color: "#6b7280" }}>Tip: arrastra cada sello en la hoja de vista previa. Aplica a los 9 documentos.</small>
              </div>
              {(personalizacion.sellos || []).length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {(personalizacion.sellos || []).map((s, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto auto", gap: 8, alignItems: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 6px" }}>
                      <img src={s.url} alt={`Sello ${i + 1}`} style={{ width: 28, height: 28, objectFit: "contain" }} />
                      <span style={{ fontSize: "0.76rem", color: "#374151" }}>Sello {i + 1}</span>
                      <input
                        type="number"
                        min="60"
                        max="220"
                        step="5"
                        value={s.w || 120}
                        onChange={(e) => {
                          const nuevos = [...(personalizacion.sellos || [])];
                          nuevos[i] = { ...nuevos[i], w: Number(e.target.value) || 120 };
                          setPersonalizacion(prev => ({ ...prev, sellos: nuevos }));
                        }}
                        style={{ width: 70, border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 5px", fontSize: "0.75rem" }}
                      />
                      <button
                        onClick={() => {
                          const nuevos = (personalizacion.sellos || []).filter((_, idx) => idx !== i);
                          setPersonalizacion(prev => ({ ...prev, sellos: nuevos }));
                        }}
                        style={{ border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", borderRadius: 6, padding: "3px 7px", fontSize: "0.75rem" }}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Color */}
            <div>
              <label style={lStyle}><i className="bi bi-palette me-2" style={{ color: tipoActivo?.color }} />Color del encabezado</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                <div style={{ flex: 1, height: 36, borderRadius: 8, background: personalizacion.color || "#1a2744", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#fff", fontWeight: 600 }}>
                  {personalizacion.color || "#1a2744"}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: "0.8rem", color: "#374151" }}>
                  <input type="color" value={personalizacion.color || "#1a2744"} onChange={e => set("color", e.target.value)} style={{ width: 24, height: 24, border: "none", padding: 0, cursor: "pointer", background: "none" }} />
                  Otro color
                </label>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {COLORES_RAPIDOS.map(c => (
                  <button key={c} title={c} onClick={() => set("color", c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: personalizacion.color === c ? "3px solid #fff" : "2px solid rgba(0,0,0,.12)", cursor: "pointer", outline: personalizacion.color === c ? `2px solid ${c}` : "none" }} />
                ))}
              </div>
            </div>

            {/* Color del texto del encabezado */}
            <div>
              <label style={lStyle}><i className="bi bi-fonts me-2" style={{ color: tipoActivo?.color }} />Color del texto</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ flex: 1, height: 36, borderRadius: 8, background: personalizacion.header_text_color || "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#374151", border: "1px solid #e5e7eb", fontWeight: 600 }}>
                  {personalizacion.header_text_color || "#ffffff"}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: "0.8rem", color: "#374151" }}>
                  <input type="color" value={personalizacion.header_text_color || "#ffffff"} onChange={e => set("header_text_color", e.target.value)} style={{ width: 24, height: 24, border: "none", padding: 0, cursor: "pointer", background: "none" }} />
                  Otro color
                </label>
              </div>
            </div>

            {/* Nombre consultorio */}
            <div>
              <label style={lStyle}><i className="bi bi-building me-2" style={{ color: tipoActivo?.color }} />Nombre del consultorio / clínica</label>
              <input className="form-control" style={iStyle} placeholder="Ej: Consultorio Dental Dr. Ibarra" value={personalizacion.clinica || ""} onChange={e => set("clinica", e.target.value)} />
            </div>

            {/* Fuente del nombre del consultorio */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lStyle}><i className="bi bi-fonts me-2" style={{ color: tipoActivo?.color }} />Fuente</label>
                <select className="form-select" style={iStyle} value={personalizacion.clinica_font || "Arial, Helvetica, sans-serif"} onChange={e => set("clinica_font", e.target.value)}>
                  {FUENTES.map(f => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 120 }}>
                <label style={lStyle}>Tamano (em)</label>
                <input className="form-control" style={iStyle} type="number" step="0.1" min="0.5" max="3" value={personalizacion.clinica_font_size || "1.25"} onChange={e => set("clinica_font_size", e.target.value)} />
              </div>
            </div>

            {/* Nombre medico — se toma del usuario logueado, no se edita aqui */}
            <div>
              <label style={lStyle}><i className="bi bi-person-fill me-2" style={{ color: tipoActivo?.color }} />Nombre del médico</label>
              <div style={{ padding: "9px 12px", borderRadius: 8, background: "#f3f4f6", border: "1px solid #e5e7eb", fontSize: "0.86rem", color: "#374151" }}>
                {medicoNombre || "Sin nombre en tu perfil"}
              </div>
              <small style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Se toma automáticamente de tu perfil de usuario.</small>
            </div>

            {/* Fuente del nombre del médico */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lStyle}><i className="bi bi-fonts me-2" style={{ color: tipoActivo?.color }} />Fuente</label>
                <select className="form-select" style={iStyle} value={personalizacion.medico_font || "Arial, Helvetica, sans-serif"} onChange={e => set("medico_font", e.target.value)}>
                  {FUENTES.map(f => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 120 }}>
                <label style={lStyle}>Tamaño (em)</label>
                <input className="form-control" style={iStyle} type="number" step="0.1" min="0.5" max="3" value={personalizacion.medico_font_size || "0.85"} onChange={e => set("medico_font_size", e.target.value)} />
              </div>
            </div>

            {/* Credenciales */}
            <div>
              <label style={lStyle}>
                <i className="bi bi-award me-2" style={{ color: tipoActivo?.color }} />Cédula, colegiatura, especialidad
                <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 4, fontSize: "0.77rem" }}>(una por línea)</span>
              </label>
              <textarea className="form-control" rows={3} style={{ ...iStyle, resize: "vertical" }} placeholder={"Ced. Profesional. 597339393939378\nEspecialidad: Odontología\nColegiatura CMH: 4521\nSSA/1999999/2025"} value={personalizacion.credenciales || ""} onChange={e => set("credenciales", e.target.value)} />
              <small style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Aparece en el encabezado debajo del nombre del médico.</small>
            </div>

            {/* Tamaño de papel + orientación */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lStyle}><i className="bi bi-file-earmark-text me-2" style={{ color: tipoActivo?.color }} />Tamaño de papel</label>
                <select className="form-select" style={iStyle} value={personalizacion.papel_size || "LETTER"} onChange={e => set("papel_size", e.target.value)}>
                  <option value="LETTER">Carta (Letter)</option>
                  <option value="HALF_LETTER">Receta (Media carta)</option>
                  <option value="LEGAL">Oficio (Legal)</option>
                  <option value="A4">A4</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lStyle}><i className="bi bi-aspect-ratio me-2" style={{ color: tipoActivo?.color }} />Orientación</label>
                <select className="form-select" style={iStyle} value={personalizacion.papel_orientacion || "portrait"} onChange={e => set("papel_orientacion", e.target.value)}>
                  <option value="portrait">Vertical</option>
                  <option value="landscape">Horizontal</option>
                </select>
              </div>
            </div>

            {/* Formato de la receta en PDF (Consulta Médica) */}
            <div style={{ marginTop: 10 }}>
              <label style={lStyle}><i className="bi bi-prescription2 me-2" style={{ color: tipoActivo?.color }} />Formato de receta impresa</label>
              <select className="form-select" style={iStyle} value={personalizacion.formato_receta || "media_carta"} onChange={e => set("formato_receta", e.target.value)}>
                <option value="media_carta">Media carta (compacta)</option>
                <option value="carta_completa">Carta completa (llena la hoja)</option>
              </select>
              <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 4 }}>
                Define cómo sale por defecto la receta en PDF desde Consulta Médica. El doctor puede cambiarlo puntualmente al imprimir.
              </div>
            </div>

            {/* Footer */}
            <div>
              <label style={lStyle}>
                <i className="bi bi-geo-alt-fill me-2" style={{ color: tipoActivo?.color }} />Pie de página
                <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 4, fontSize: "0.77rem" }}>(dirección, teléfono, correo)</span>
              </label>
              <textarea className="form-control" rows={2} style={{ ...iStyle, resize: "none" }} placeholder="Col. Palmira, Blvd. Morazán | Tel: +504 2222-3333 | info@clinica.com" value={personalizacion.footer || ""} onChange={e => set("footer", e.target.value)} />
              <small style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Fondo del color del encabezado al final del documento.</small>
            </div>

            {/* Firma */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div className="form-check" style={{ marginBottom: 0 }}>
                <input className="form-check-input" type="checkbox" id="mostrar_firma" checked={personalizacion.mostrar_firma !== false} onChange={e => set("mostrar_firma", e.target.checked)} />
                <label className="form-check-label" htmlFor="mostrar_firma" style={{ fontSize: "0.84rem" }}>Línea de firma</label>
              </div>
              {personalizacion.mostrar_firma !== false && (
                <input className="form-control" style={{ ...iStyle, flex: 1 }} placeholder="FIRMA" value={personalizacion.etiqueta_firma || "FIRMA"} onChange={e => set("etiqueta_firma", e.target.value)} />
              )}
            </div>

            {/* Horarios de atención */}
            <div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
                <div className="form-check" style={{ marginBottom: 0 }}>
                  <input className="form-check-input" type="checkbox" id="mostrar_horarios" checked={!!personalizacion.mostrar_horarios} onChange={e => set("mostrar_horarios", e.target.checked)} />
                  <label className="form-check-label" htmlFor="mostrar_horarios" style={{ fontSize: "0.84rem", fontWeight: 600 }}>
                    <i className="bi bi-clock-fill me-1" style={{ color: tipoActivo?.color }} />
                    Horarios de atención
                  </label>
                </div>
              </div>

              {personalizacion.mostrar_horarios && (
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 12, border: "1px solid #e5e7eb" }}>
                  {(() => {
                    let lista = [];
                    try { lista = JSON.parse(personalizacion.horarios || "[]"); } catch { lista = []; }
                    return (
                      <>
                        {lista.map((h, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                            <input className="form-control" style={{ ...iStyle, flex: 1 }} placeholder="Días (ej: Lunes a Viernes)" value={h.dias} onChange={e => {
                              const nueva = [...lista]; nueva[i] = { ...nueva[i], dias: e.target.value }; set("horarios", JSON.stringify(nueva));
                            }} />
                            <input className="form-control" style={{ ...iStyle, flex: 1 }} placeholder="Horario (ej: 8:00 AM - 5:00 PM)" value={h.horario} onChange={e => {
                              const nueva = [...lista]; nueva[i] = { ...nueva[i], horario: e.target.value }; set("horarios", JSON.stringify(nueva));
                            }} />
                            <button onClick={() => { const nueva = lista.filter((_, j) => j !== i); set("horarios", JSON.stringify(nueva)); }} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff5f5", cursor: "pointer", color: "#dc2626", fontSize: "0.82rem" }}>
                              <i className="bi bi-x-lg" />
                            </button>
                          </div>
                        ))}
                        <button onClick={() => { const nueva = [...lista, { dias: "", horario: "" }]; set("horarios", JSON.stringify(nueva)); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px dashed #d1d5db", background: "#fff", cursor: "pointer", fontSize: "0.8rem", color: tipoActivo?.color, fontWeight: 600, width: "100%" }}>
                          <i className="bi bi-plus-circle me-1" /> Agregar horario
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Guardar personalizacion */}
            <button onClick={guardarPersonalizacion} disabled={guardando} style={{ padding: "11px", fontWeight: 700, fontSize: "0.9rem", borderRadius: 9, border: "none", cursor: guardando ? "default" : "pointer", background: guardando ? "#c4b5fd" : (tipoActivo?.color || "#7c3aed"), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 2px 8px rgba(0,0,0,.15)" }}>
              <i className="bi bi-floppy-fill" />
              {guardando ? "Guardando..." : "Guardar personalización"}
            </button>
          </div>
          )} {/* fin panel izquierdo condicional */}

          {/* PANEL IZQUIERDO: pestañas de configuración ligera (Control/Plan Seguimiento, Sesión Educativa) */}
          {CONFIG_EXTRA_KEYS.has(tab) && (!isMobile || vistaMovil === "form") && (() => {
            const cfg = configExtra[tab] || { encabezado_color: true, color: tipoActivo?.defaultColor || "#1a2744" };
            return (
              <div style={{ flex: isMobile ? "1 1 100%" : "0 0 360px", width: isMobile ? "100%" : undefined, background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: isMobile ? "16px" : "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f0f0f0", paddingBottom: 12 }}>
                  <i className={`bi ${tipoActivo?.icon}`} style={{ color: tipoActivo?.color, fontSize: "1.2rem" }} />
                  <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1a2744" }}>{tipoActivo?.label}</span>
                </div>
                <small style={{ color: "#6b7280", fontSize: "0.78rem", marginTop: -10 }}>
                  Este documento se genera desde su propio módulo (no desde aquí). Solo se configura si su encabezado lleva color.
                </small>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="form-check" style={{ marginBottom: 0 }}>
                    <input className="form-check-input" type="checkbox" id="encabezado_color" checked={cfg.encabezado_color !== false} onChange={e => setConfigExtraCampo("encabezado_color", e.target.checked)} />
                    <label className="form-check-label" htmlFor="encabezado_color" style={{ fontSize: "0.84rem", fontWeight: 600 }}>Encabezado con color</label>
                  </div>
                </div>

                {cfg.encabezado_color !== false && (
                  <div>
                    <label style={lStyle}><i className="bi bi-palette me-2" style={{ color: tipoActivo?.color }} />Color del encabezado</label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                      <div style={{ flex: 1, height: 36, borderRadius: 8, background: cfg.color || tipoActivo?.defaultColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#fff", fontWeight: 600 }}>
                        {cfg.color || tipoActivo?.defaultColor}
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: "0.8rem", color: "#374151" }}>
                        <input type="color" value={cfg.color || tipoActivo?.defaultColor} onChange={e => setConfigExtraCampo("color", e.target.value)} style={{ width: 24, height: 24, border: "none", padding: 0, cursor: "pointer", background: "none" }} />
                        Otro color
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {COLORES_RAPIDOS.map(c => (
                        <button key={c} title={c} onClick={() => setConfigExtraCampo("color", c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: cfg.color === c ? "3px solid #fff" : "2px solid rgba(0,0,0,.12)", cursor: "pointer", outline: cfg.color === c ? `2px solid ${c}` : "none" }} />
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={guardarConfigExtra} disabled={guardando} style={{ padding: "11px", fontWeight: 700, fontSize: "0.9rem", borderRadius: 9, border: "none", cursor: guardando ? "default" : "pointer", background: guardando ? "#93c5fd" : (tipoActivo?.color || "#1a2744"), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 2px 8px rgba(0,0,0,.15)" }}>
                  <i className="bi bi-floppy-fill" />
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            );
          })()}

          {/* PANEL DERECHO: Vista previa */}
          {((tab !== "personalizacion" && !CONFIG_EXTRA_KEYS.has(tab)) || !isMobile || vistaMovil === "preview") && (
          <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined, background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <div style={{ background: "#f8f9fa", borderBottom: "1px solid #e9ecef", padding: "11px 18px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <i className="bi bi-eye-fill" style={{ color: tipoActivo?.color }} />
              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1a2744" }}>Vista previa</span>
              {tab === "personalizacion" ? (
                <span style={{ fontSize: "0.72rem", background: "#ede9fe", color: "#6d28d9", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                  Referencia (Receta)
                </span>
              ) : CONFIG_EXTRA_KEYS.has(tab) ? (
                <span style={{ fontSize: "0.72rem", background: "#f3f4f6", color: "#4b5563", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                  Vista de referencia del encabezado
                </span>
              ) : (
                <span style={{ fontSize: "0.72rem", background: pacienteSel ? "#e0f2fe" : "#e8f5e9", color: pacienteSel ? "#075985" : "#2e7d32", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                  {pacienteSel ? `Paciente: ${pacienteSel.nombres} ${pacienteSel.apellidos}` : "Datos de ejemplo"}
                </span>
              )}
              {tab !== "personalizacion" && !CONFIG_EXTRA_KEYS.has(tab) && (
                <>
                  <button onClick={imprimirVistaPrevia} style={{ marginLeft: 10, border: "1px solid #d1d5db", background: "#fff", borderRadius: 7, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600, color: "#1f2937", display: "flex", alignItems: "center", gap: 6 }}>
                    <i className="bi bi-printer-fill" /> Imprimir
                  </button>
                  <button onClick={guardar} disabled={guardando} style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 7, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600, color: "#1f2937", display: "flex", alignItems: "center", gap: 6, cursor: guardando ? "default" : "pointer" }}>
                    <i className="bi bi-floppy-fill" /> {guardando ? "Guardando..." : "Guardar"}
                  </button>
                  {pacienteSel && (
                    <button onClick={generarDocumentoPdf} disabled={generandoPdf} style={{ border: "none", background: tipoActivo?.color || "#1a2744", color: "#fff", borderRadius: 7, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: generandoPdf ? "default" : "pointer" }}>
                      <i className="bi bi-file-earmark-pdf-fill" /> {generandoPdf ? "Generando..." : "Generar documento"}
                    </button>
                  )}
                </>
              )}
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#9ca3af", fontStyle: "italic" }}>Los cambios se reflejan en tiempo real</span>
            </div>
            {tab === "constancias" && (
              <div style={{ background: "#fff", borderBottom: "1px solid #eef2f7", padding: "8px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Tipo de constancia:</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto", fontSize: "0.8rem" }}
                  value={(datos.constancias || {}).titulo_documento || CONSTANCIA_TIPOS[0].value}
                  onChange={e => set("titulo_documento", e.target.value)}
                >
                  {CONSTANCIA_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            )}
            {isRichWordMode && (
              <div style={{ background: "#fff", borderBottom: "1px solid #eef2f7", padding: "8px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => execRich("bold")} style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 6, padding: "4px 8px" }} title="Negrita"><b>B</b></button>
                <button onClick={() => execRich("italic")} style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 6, padding: "4px 8px" }} title="Cursiva"><i>I</i></button>
                <button onClick={() => execRich("underline")} style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 6, padding: "4px 8px" }} title="Subrayado"><u>U</u></button>
                <button onClick={() => execRich("insertUnorderedList")} style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 6, padding: "4px 8px" }} title="Lista"><i className="bi bi-list-ul" /></button>
                <button onClick={() => execRich("justifyLeft")} style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 6, padding: "4px 8px" }} title="Izquierda"><i className="bi bi-text-left" /></button>
                <button onClick={() => execRich("justifyCenter")} style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 6, padding: "4px 8px" }} title="Centrado"><i className="bi bi-text-center" /></button>
                <button onClick={() => execRich("justifyRight")} style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 6, padding: "4px 8px" }} title="Derecha"><i className="bi bi-text-right" /></button>
              </div>
            )}
            <div style={{ padding: "24px", background: "#eef0f3", minHeight: 500, overflow: "auto" }}>
              {isRichWordMode ? (
                <div style={{ background: "#fff", boxShadow: "0 3px 14px rgba(0,0,0,.13)", width: getPaper(personalizacion.papel_size, personalizacion.papel_orientacion).w, minHeight: getPaper(personalizacion.papel_size, personalizacion.papel_orientacion).h, maxWidth: "100%", margin: "0 auto", border: "1px solid #ddd", overflow: "hidden", fontFamily: "Arial, Helvetica, sans-serif" }}>
                  <div style={{ background: personalizacion.color || "#1a2744", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                    {personalizacion.logo_url ? (
                      <div><img src={personalizacion.logo_url} style={{ maxHeight: 100, maxWidth: 150, objectFit: "contain", background: "rgba(255,255,255,.15)", borderRadius: 6, padding: 5 }} /></div>
                    ) : null}
                    <div style={{ flex: 1 }}>
                      <div style={{ color: personalizacion.header_text_color || "#fff", fontSize: `${personalizacion.clinica_font_size || "1.25"}em`, fontFamily: personalizacion.clinica_font || "Arial, Helvetica, sans-serif", fontWeight: "bold", lineHeight: 1.2 }}>
                        {personalizacion.clinica || "Nombre del consultorio"}
                      </div>
                      <div style={{ color: `${personalizacion.header_text_color || "#fff"}e6`, fontSize: `${personalizacion.medico_font_size || "0.85"}em`, fontFamily: personalizacion.medico_font || "Arial, Helvetica, sans-serif", fontWeight: 600, marginTop: 5 }}>
                        {medicoNombre || "Dr(a). Nombre Medico"}
                      </div>
                    </div>
                  </div>
                  <div ref={pageRef} style={{ padding: "18px 20px", position: "relative" }}>
                    {(personalizacion.sellos || []).map((s, i) => (
                      <img
                        key={`sello-${i}`}
                        src={s.url}
                        onMouseDown={(e) => onSelloMouseDown(e, i)}
                        style={{
                          position: "absolute",
                          left: Number(s.x) || 0,
                          top: Number(s.y) || 0,
                          width: Number(s.w) || 120,
                          maxWidth: 220,
                          height: "auto",
                          cursor: sellosArrastrables ? "move" : "default",
                          zIndex: 5,
                          userSelect: "none",
                        }}
                      />
                    ))}
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => set("titulo_documento", e.currentTarget.innerText)}
                      style={{ textAlign: "center", fontWeight: 700, letterSpacing: ".8px", color: personalizacion.color || "#1a2744", margin: "4px 0 18px", outline: "none", cursor: "text" }}
                      dangerouslySetInnerHTML={{ __html: (datos.constancia_libre?.titulo_documento) || "CONSTANCIA MEDICA" }}
                    />
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => set("contenido", e.currentTarget.innerHTML)}
                      style={{ minHeight: 260, outline: "none", fontSize: "0.93em", lineHeight: 1.9 }}
                      dangerouslySetInnerHTML={{ __html: datos.constancia_libre?.contenido || "Escribe aqui la constancia medica..." }}
                    />
                    <div style={{ marginTop: 26 }}>
                      Fecha: <b
                        contentEditable={!!pacienteSel}
                        suppressContentEditableWarning
                        onBlur={(e) => pacienteSel && setVarEditable("fecha", e.currentTarget.innerText)}
                        style={{ cursor: pacienteSel ? "text" : "default" }}
                        dangerouslySetInnerHTML={{ __html: varsPreview.fecha }}
                      />
                    </div>
                  </div>
                  <div style={{ padding: "0 20px 14px" }}>
                    {personalizacion.mostrar_firma !== false && (
                      <div style={{ textAlign: "right", padding: "4px 0 8px" }}>
                        <div style={{ display: "inline-block", textAlign: "center", minWidth: 160 }}>
                          <div style={{ borderTop: "1px solid #333", paddingTop: 4, fontSize: "0.82em", fontWeight: 600 }}>{personalizacion.etiqueta_firma || "FIRMA"}</div>
                          <div style={{ fontSize: "0.76em", color: "#555" }}>{medicoNombre}</div>
                        </div>
                      </div>
                    )}
                  </div>
                  {personalizacion.footer ? (
                    <div style={{ background: personalizacion.color || "#1a2744", color: "rgba(255,255,255,.88)", padding: "9px 20px", fontSize: "0.77em", textAlign: "center" }}>{personalizacion.footer}</div>
                  ) : null}
                </div>
              ) : CONFIG_EXTRA_KEYS.has(tab) ? (
                <div style={{ background: "#fff", boxShadow: "0 3px 14px rgba(0,0,0,.13)", maxWidth: 720, margin: "0 auto", padding: "24px 28px", fontFamily: "Arial, sans-serif" }}>
                  {(() => {
                    const cfg = configExtra[tab] || { encabezado_color: true, color: tipoActivo?.defaultColor };
                    const on = cfg.encabezado_color !== false;
                    const mainColor = on ? (cfg.color || tipoActivo?.defaultColor) : "#1a1a2e";
                    const subColor = on ? (cfg.color || tipoActivo?.defaultColor) : "#6b7280";
                    const borderColor = on ? (cfg.color || tipoActivo?.defaultColor) : "#d1d5db";
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2.5px solid ${borderColor}`, paddingBottom: 8, marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {personalizacion.logo_url ? (
                            <img src={personalizacion.logo_url} alt="Logo" style={{ height: 60, maxWidth: 120, objectFit: "contain" }} />
                          ) : (
                            <div style={{ width: 60, height: 60, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "0.68rem" }}>Logo</div>
                          )}
                          <div>
                            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: mainColor }}>{personalizacion.clinica || "Nombre del consultorio"}</div>
                            <div style={{ fontSize: "0.72rem", color: subColor, marginTop: 3 }}>{tipoActivo?.subtitulo}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#1e1b4b" }}>{(tipoActivo?.label || "").toUpperCase()}</div>
                          <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 4 }}>Fecha: <strong>10 de julio de 2026</strong></div>
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ color: "#9ca3af", fontSize: "0.82rem", fontStyle: "italic", textAlign: "center", padding: "40px 0" }}>
                    El contenido de este documento se genera desde su propio módulo — aquí solo se previsualiza el encabezado.
                  </div>
                </div>
              ) : (
                <div ref={pageRef} style={{ position: "relative", width: "fit-content", maxWidth: "100%", margin: "0 auto" }}>
                  <div
                    className="plantilla-editable"
                    onBlur={handlePreviewEdit}
                    onFocus={handlePreviewFocus}
                    onClick={handlePreviewClick}
                    style={{ background: "#fff", boxShadow: "0 3px 14px rgba(0,0,0,.13)", maxWidth: 720, margin: "0 auto" }}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                  {(personalizacion.sellos || []).map((s, i) => (
                    <img
                      key={`sello-preview-${i}`}
                      src={s.url}
                      onMouseDown={(e) => onSelloMouseDown(e, i)}
                      style={{
                        position: "absolute",
                        left: Number(s.x) || 0,
                        top: Number(s.y) || 0,
                        width: Number(s.w) || 120,
                        maxWidth: 220,
                        height: "auto",
                        cursor: sellosArrastrables ? "move" : "default",
                        zIndex: 6,
                        userSelect: "none",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            {tab !== "personalizacion" && !CONFIG_EXTRA_KEYS.has(tab) && (
              <div style={{ borderTop: "1px solid #f0f0f0", padding: "9px 18px", display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.73rem", color: "#9ca3af", display: "flex", alignItems: "center", gap: 4 }}>
                  <i className="bi bi-cursor-fill" />{pacienteSel ? "Haz clic sobre los datos del documento para escribir directo." : "Busca un paciente arriba para llenar sus datos directo en el documento."}
                </span>
              </div>
            )}
          </div>
          )} {/* fin panel derecho condicional */}

        </div>
      </div>
    </div>
  );
}
