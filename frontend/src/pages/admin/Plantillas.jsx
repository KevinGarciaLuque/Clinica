import { useEffect, useState } from "react";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";

/* ─── Tipos de plantilla ──────────────────────────────────────────── */
const TIPOS = [
  { key: "receta",      label: "Receta",        icon: "bi-file-earmark-medical-fill", color: "#1565c0" },
  { key: "incapacidad", label: "Incapacidad",    icon: "bi-bandaid-fill",              color: "#c62828" },
  { key: "referencia",  label: "Referencia",     icon: "bi-send-fill",                 color: "#6a1b9a" },
  { key: "constancia",  label: "Constancia",     icon: "bi-patch-check-fill",          color: "#00695c" },
  { key: "recibo",      label: "Recibo",         icon: "bi-receipt-cutoff",            color: "#e65100" },
  { key: "laboratorio", label: "Laboratorio",    icon: "bi-capsule",                   color: "#0277bd" },
  { key: "estudios",    label: "Estudios",       icon: "bi-clipboard2-pulse-fill",     color: "#2e7d32" },
];

const CONTENT_HINTS = {
  receta:      { label: "Instrucciones generales (opcional)", placeholder: "Este espacio quedara en blanco para que el medico escriba la receta.\n\nPuedes agregar instrucciones generales si lo deseas.\nEjemplo:\n- Tomar medicamentos con alimentos\n- Regresar a consulta si no mejora en 3 dias" },
  incapacidad: { label: "Observaciones / Recomendaciones",   placeholder: "Observaciones medicas para el paciente o empleador.\nEjemplo:\nReposo absoluto en cama. Hidratacion adecuada. Dieta blanda.\nEvitar actividades fisicas por el periodo indicado." },
  referencia:  { label: "Recomendaciones / observaciones adicionales", placeholder: "Paciente con antecedentes de hipertension arterial controlada.\nSe solicita valoracion por dolor precordial atipico.\nTraer examenes previos al centro receptor." },
  constancia:  { label: "Texto principal de la constancia",  placeholder: "El suscrito medico hace constar que el/la paciente fue atendido(a) en esta unidad medica, presentando el diagnostico indicado, por lo cual se extiende la presente para los fines que estime conveniente." },
  recibo:      { label: "Concepto del servicio (Por concepto de)", placeholder: "Honorarios medicos por consulta general y prescripcion medica." },
  laboratorio: { label: "Indicaciones previas al examen",    placeholder: "Acudir en ayunas de 8 a 12 horas.\nNo realizar ejercicio intenso el dia anterior." },
  estudios:    { label: "Indicaciones / Motivo del estudio", placeholder: "Paciente con tos persistente de 3 semanas de evolucion.\nSe solicita para descartar proceso infeccioso pulmonar." },
};

const defaultData = () => ({
  _v: 2, logo_url: "", color: "#1a2744", header_text_color: "#ffffff",
  clinica: "", medico: "", credenciales: "",
  contenido: "", footer: "",
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
  es_predeterminada: false,
});

function parseContenido(raw) {
  if (!raw) return defaultData();
  try { const p = JSON.parse(raw); if (p._v === 2) return p; } catch { /* html legacy */ }
  return defaultData();
}

const nl2br = (s = "") => s.replace(/\n/g, "<br/>");

function buildHTML(data, tipo, vars = {}) {
  const {
    logo_url = "", color = "#1a2744", header_text_color = "#ffffff",
    clinica = "Nombre del Consultorio", medico = "Dr(a). Nombre Medico",
    credenciales = "", contenido = "", footer = "",
    mostrar_firma = true, etiqueta_firma = "FIRMA",
    clinica_font = "Arial, Helvetica, sans-serif",
    clinica_font_size = "1.25",
    medico_font = "Arial, Helvetica, sans-serif",
    medico_font_size = "0.85",
    horarios = "[]", mostrar_horarios = false,
  } = data;

  let bodyText = contenido;
  Object.entries(vars).forEach(([k, v]) => { bodyText = bodyText.replaceAll("{{" + k + "}}", v || ""); });
  const bodyHTML = nl2br(bodyText);
  const credHTML = nl2br(credenciales);

  const TITULOS = {
    incapacidad: "INCAPACIDAD MEDICA", referencia: "REFERENCIA MEDICA",
    constancia: "CONSTANCIA MEDICA",  recibo: "RECIBO DE HONORARIOS",
    laboratorio: "ORDEN DE LABORATORIO", estudios: "ORDEN DE ESTUDIOS",
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
    datosBloque = `<div style="display:flex;gap:20px;margin-bottom:14px;font-size:0.88em;border-bottom:1px solid #eee;padding-bottom:10px;">
      <div style="flex:2;">Paciente: <span style="display:inline-block;border-bottom:1px solid #555;min-width:180px;">${p}</span></div>
      <div style="flex:1;">Fecha: <span style="display:inline-block;border-bottom:1px solid #555;min-width:90px;">${fecha}</span></div>
    </div>`;
  } else if (tipo === "incapacidad") {
    const ciudad = vars.ciudad || "______________________________";
    datosBloque = `<div style="font-size:0.9em;line-height:2.4;">
      <div>POR ESTE MEDIO SE HACE CONSTAR QUE: <span style="display:inline-block;border-bottom:1px solid #333;min-width:200px;font-weight:600;">${p}</span>&nbsp;&nbsp;ID <span style="display:inline-block;border-bottom:1px solid #333;min-width:150px;font-weight:600;">${dni}</span></div>
      <div>CON # DE EXPEDIENTE: <span style="display:inline-block;border-bottom:1px solid #333;min-width:80px;"> </span>&nbsp;&nbsp;DIAGN\u00d3STICO <span style="display:inline-block;border-bottom:1px solid #333;min-width:240px;font-weight:600;">${dx}</span></div>
      <div>DESDE EL DIA <span style="display:inline-block;border-bottom:1px solid #333;min-width:100px;font-weight:600;">${vars.fecha_inicio || "___/___/____"}</span>&nbsp;&nbsp;HASTA EL DIA <span style="display:inline-block;border-bottom:1px solid #333;min-width:100px;font-weight:600;">${vars.fecha_fin || "___/___/____"}</span></div>
      ${vars.empleador ? `<div>EMPRESA / EMPLEADOR: <span style="display:inline-block;border-bottom:1px solid #333;min-width:220px;font-weight:600;">${vars.empleador}</span></div>` : ""}
      <div style="margin-top:16px;">PARA FINES QUE EL INTERESADO ESTIME CONVENIENTE, SE EXTIENDE LA PRESENTE EN LA CIUDAD DE <span style="display:inline-block;border-bottom:1px solid #333;min-width:160px;font-weight:600;">${ciudad}</span>, EL D\u00cdA <span style="font-weight:600;">${fecha}</span>.</div>
    </div>`;
  } else if (tipo === "referencia") {
    const ciudad = vars.ciudad || "______________________________";
    const _check = (v) => v ? "\u2611" : "\u2610";
    datosBloque = `<div style="font-family:Arial,sans-serif;font-size:0.78em;border:1px solid #999;">

      <!-- Fila 1: apellidos / nombre / sexo -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:1;padding:4px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Primer Apellido</span><div style="border-bottom:1px solid #aaa;min-height:18px;font-weight:600;">${vars.apellido1 || ""}</div></div>
        <div style="flex:1;padding:4px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Segundo Apellido</span><div style="border-bottom:1px solid #aaa;min-height:18px;font-weight:600;">${vars.apellido2 || ""}</div></div>
        <div style="flex:2;padding:4px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Nombre(s)</span><div style="border-bottom:1px solid #aaa;min-height:18px;font-weight:600;">${vars.nombres || p}</div></div>
        <div style="padding:4px 8px;"><span style="font-size:0.85em;color:#555;">Sexo: H\u2610 M\u2610</span></div>
      </div>

      <!-- Fila 2: expediente / identidad / edad -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:2;padding:4px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">N\u00b0 de expediente:</span> <span style="font-weight:600;">${vars.expediente || ""}</span></div>
        <div style="flex:2;padding:4px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">N\u00b0 de Identidad:</span> <span style="font-weight:600;">${dni}</span></div>
        <div style="flex:1;padding:4px 6px;"><span style="font-size:0.85em;color:#555;">Edad:</span> <span style="font-weight:600;">${edad}</span></div>
      </div>

      <!-- Fila 3: dirección -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="padding:4px 6px;border-right:1px solid #999;white-space:nowrap;"><span style="font-size:0.85em;color:#555;">Direcci\u00f3n: Colonia</span></div>
        <div style="flex:1;padding:4px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Ciudad</span> <span style="font-weight:600;">${ciudad}</span></div>
        <div style="flex:1;padding:4px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Municipio</span></div>
        <div style="flex:1;padding:4px 6px;border-right:1px solid #999;"><span style="font-size:0.85em;color:#555;">Departamento</span></div>
        <div style="flex:1;padding:4px 6px;"><span style="font-size:0.85em;color:#555;">Tel\u00e9fono</span></div>
      </div>

      <!-- Fila 4: establecimiento que refiere + institución -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:2;padding:4px 6px;border-right:1px solid #999;">
          <div style="font-size:0.85em;color:#555;font-weight:600;">Nombre del Establecimiento que refiere/responde:</div>
          <div style="font-weight:600;min-height:16px;">${vars.establecimiento_origen || ""}</div>
        </div>
        <div style="flex:3;padding:4px 6px;">
          <div style="font-size:0.82em;color:#555;">Instituci\u00f3n: \u2610SESAL \u2610Privado \u2610IHSS \u2610Militar \u2610ONG \u2610Otro_______</div>
          <div style="font-size:0.82em;margin-top:3px;">Establecimiento que refiere o responde: \u2610UAPS \u2610CIS \u2610Policl\u00ednico \u2610Hospital: _____________</div>
        </div>
      </div>

      <!-- Motivo del envío -->
      <div style="border-bottom:1px solid #999;padding:4px 6px;">
        <span style="font-size:0.85em;color:#555;font-weight:600;">Motivo del env\u00edo:</span>
        <span style="margin-left:8px;">\u2610Diagn\u00f3stico &nbsp;\u2610Tratamiento &nbsp;\u2610Seguimiento &nbsp;\u2610Rehabilitaci\u00f3n</span>
      </div>

      <!-- Diagnóstico -->
      <div style="border-bottom:1px solid #999;padding:4px 6px;">
        <span style="font-size:0.85em;color:#555;font-weight:600;">Impresi\u00f3n Diagn\u00f3stica:</span>
        <span style="font-weight:600;margin-left:6px;">${dx}</span>
      </div>

      <!-- Signos y síntomas / Resumen -->
      <div style="border-bottom:1px solid #999;padding:4px 6px;">
        <div style="font-size:0.85em;color:#555;font-weight:600;">Signos y S\u00edntomas principales:</div>
        <div style="min-height:18px;">${vars.sintomas || ""}</div>
      </div>
      <div style="border-bottom:1px solid #999;padding:4px 6px;">
        <div style="font-size:0.85em;color:#555;font-weight:600;">Resumen de datos cl\u00ednicos:</div>
        <div style="min-height:36px;">${vars.resumen_clinico || ""}</div>
      </div>

      <!-- Signos vitales -->
      <div style="border-bottom:1px solid #999;padding:4px 6px;font-size:0.82em;">
        <b>Signos Vitales:</b> &nbsp; P/A:_______ &nbsp; FR:_______ &nbsp; P/FC:_______ &nbsp; T\u00b0:_______ &nbsp; Peso:_______ &nbsp; Talla:_______
      </div>

      <!-- Exámenes -->
      <div style="border-bottom:1px solid #999;padding:4px 6px;">
        <div style="font-size:0.85em;color:#555;font-weight:600;">Resultados de ex\u00e1menes complementarios:</div>
        <div style="min-height:18px;"></div>
      </div>

      <!-- Recomendaciones -->
      <div style="border-bottom:1px solid #999;padding:4px 6px;">
        <div style="font-size:0.85em;color:#555;font-weight:600;">Recomendaciones/observaciones:</div>
        <div style="min-height:18px;">${vars.recomendaciones || ""}</div>
      </div>

      <!-- Referido a -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:2;padding:4px 6px;border-right:1px solid #999;">
          <div style="font-size:0.82em;color:#555;font-weight:600;">Referido/Responde a:</div>
          <div style="font-size:0.82em;">\u2610UAPS \u2610CIS \u2610Policl\u00ednico \u2610Hospital: <span style="font-weight:600;">${vars.hospital_destino || "_________________"}</span></div>
          <div style="font-size:0.82em;margin-top:2px;">Especialidad: <span style="font-weight:600;">${vars.especialidad_destino || "_________________"}</span></div>
        </div>
        <div style="flex:2;padding:4px 6px;">
          <div style="font-size:0.82em;color:#555;font-weight:600;">Amerita atenci\u00f3n en:</div>
          <div style="font-size:0.82em;">\u2610Consulta Externa &nbsp;\u2610Emergencia &nbsp;\u2610Hospitalizaci\u00f3n</div>
        </div>
      </div>

      <!-- Fecha elaboración / elaborada por -->
      <div style="display:flex;border-bottom:1px solid #999;">
        <div style="flex:2;padding:4px 6px;border-right:1px solid #999;font-size:0.82em;">
          <b>Referencia elaborada por:</b> \u2610M\u00e9dico General &nbsp;\u2610M\u00e9dico Especialista &nbsp;\u2610Enfermera
        </div>
        <div style="flex:2;padding:4px 6px;font-size:0.82em;">
          <b>Fecha de elaboraci\u00f3n:</b> <span style="font-weight:600;">${fecha}</span>
        </div>
      </div>

      <!-- Firma y sello -->
      <div style="padding:6px 6px 4px;font-size:0.82em;display:flex;gap:20px;align-items:flex-end;">
        <div style="flex:1;">
          <div style="border-bottom:1px solid #333;min-height:40px;"></div>
          <div style="text-align:center;font-size:0.9em;">Nombre, firma y sello del que elabora la Referencia/Respuesta</div>
        </div>
        <div style="flex:1;">
          <div style="border-bottom:1px solid #333;min-height:40px;"></div>
          <div style="text-align:center;font-size:0.9em;">Nombre y Cargo de la persona contactada</div>
        </div>
      </div>

      <!-- Footer HC-10 -->
      <div style="background:#f5f5f5;border-top:1px solid #999;padding:4px 6px;display:flex;justify-content:space-between;font-size:0.78em;">
        <span>Referencia: Oportuna: Si\u2610 No\u2610 &nbsp;&nbsp; Justificado: Si\u2610 No\u2610</span>
        <span style="font-weight:700;">HC-10</span>
      </div>
    </div>`;
  } else if (tipo === "constancia") {
    const ciudad = vars.ciudad || "______________________________";
    datosBloque = `<div style="font-size:0.9em;line-height:2.4;">
      <div>POR ESTE MEDIO HACE CONSTAR QUE: <span style="display:inline-block;border-bottom:1px solid #333;min-width:200px;font-weight:600;">${p}</span>&nbsp;&nbsp;ID <span style="display:inline-block;border-bottom:1px solid #333;min-width:150px;font-weight:600;">${dni}</span></div>
      <div>CON # DE EXPEDIENTE: <span style="display:inline-block;border-bottom:1px solid #333;min-width:80px;"> </span>&nbsp;&nbsp;DIAGN\u00d3STICO <span style="display:inline-block;border-bottom:1px solid #333;min-width:240px;font-weight:600;">${dx}</span></div>
      <div style="margin-top:16px;">PARA FINES QUE EL INTERESADO ESTIME CONVENIENTE, SE EXTIENDE LA PRESENTE EN LA CIUDAD DE <span style="display:inline-block;border-bottom:1px solid #333;min-width:160px;font-weight:600;">${ciudad}</span>, EL D\u00cdA <span style="font-weight:600;">${fecha}</span>.</div>
    </div>`;
  } else if (tipo === "recibo") {
    const retencion = vars.retenciones || (vars.monto ? (parseFloat(vars.monto) * 0.125).toFixed(2) : "0.00");
    const totalNeto = vars.total_neto || (vars.monto ? (parseFloat(vars.monto) * 0.875).toFixed(2) : "0.00");
    datosBloque = `
    <!-- RTN / CAI box -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
      <div style="border:2px solid #333;padding:8px 14px;text-align:center;min-width:270px;">
        <div style="font-size:0.82em;">RTN: <b>${vars.rtn_medico || "__________________________"}</b></div>
        <div style="font-weight:700;font-size:0.88em;margin:5px 0;text-transform:uppercase;">Recibo por Honorarios Profesionales</div>
        <div style="font-size:0.72em;color:#555;">CAI: ${vars.cai || "____________________________________"}</div>
        <div style="background:#111;color:#fff;padding:4px 8px;margin-top:6px;font-weight:700;font-size:0.85em;letter-spacing:0.5px;">
          N\u00b0 ${vars.num_recibo || "000-001-00-00000001"}
        </div>
      </div>
    </div>
    <!-- Campos principales -->
    <div style="font-size:0.9em;line-height:2.5;border-bottom:1px solid #ccc;padding-bottom:10px;">
      <div>Recib\u00ed de: <span style="display:inline-block;border-bottom:1px solid #333;min-width:220px;font-weight:600;">${p}</span>&nbsp;&nbsp; RTN: <span style="display:inline-block;border-bottom:1px solid #333;min-width:150px;">${vars.rtn_paciente || ""}</span></div>
      <div>La suma neta de: <span style="display:inline-block;border-bottom:1px solid #333;min-width:400px;font-weight:600;">L.&nbsp;${vars.monto || "0.00"}</span></div>
      <div>Por concepto de: <span style="display:inline-block;border-bottom:1px solid #333;min-width:360px;">${bodyHTML || ""}</span></div>
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
      <tr><td style="padding:5px;border:1px solid #ddd;background:#e8f4fd;width:38%;"><b>Paciente:</b></td><td style="padding:5px;border:1px solid #ddd;">${p}</td><td style="padding:5px;border:1px solid #ddd;background:#e8f4fd;width:18%;"><b>Fecha:</b></td><td style="padding:5px;border:1px solid #ddd;">${fecha}</td></tr>
      <tr><td style="padding:5px;border:1px solid #ddd;background:#e8f4fd;"><b>Diagn\u00f3stico:</b></td><td colspan="3" style="padding:5px;border:1px solid #ddd;">${dx}</td></tr>
    </table>
    <div style="font-size:0.88em;font-weight:600;color:${color};margin-bottom:4px;">Ex\u00e1menes Solicitados:</div>
    <div style="border:1px solid #b3d9f7;padding:10px 14px;min-height:70px;font-size:0.88em;line-height:1.9;">${vars.examenes ? nl2br(vars.examenes) : ""}</div>`;
  } else if (tipo === "estudios") {
    datosBloque = `<table style="width:100%;border-collapse:collapse;font-size:0.87em;margin-bottom:10px;">
      <tr><td style="padding:5px;border:1px solid #ddd;background:#e8f5e9;width:38%;"><b>Paciente:</b></td><td style="padding:5px;border:1px solid #ddd;">${p}</td><td style="padding:5px;border:1px solid #ddd;background:#e8f5e9;width:18%;"><b>Fecha:</b></td><td style="padding:5px;border:1px solid #ddd;">${fecha}</td></tr>
      <tr><td style="padding:5px;border:1px solid #ddd;background:#e8f5e9;"><b>Diagn\u00f3stico:</b></td><td colspan="3" style="padding:5px;border:1px solid #ddd;">${dx}</td></tr>
    </table>
    <div style="font-size:0.88em;font-weight:600;color:${color};margin-bottom:4px;">Estudios Solicitados:</div>
    <div style="border:1px solid #a5d6a7;padding:10px 14px;min-height:70px;font-size:0.88em;line-height:1.9;">${vars.estudios ? nl2br(vars.estudios) : ""}</div>`;
  }

  const contenidoBloque = bodyHTML ? `
    <div style="background:#f9f9f9;border-left:3px solid ${color};padding:8px 12px;margin-top:12px;font-size:0.85em;line-height:1.7;">${bodyHTML}</div>` : "";

  const rxBloque = tipo === "receta" ? `
    <div style="font-size:2.2em;font-family:Georgia,serif;color:#333;line-height:1;margin:10px 0 4px;">\u211e</div>
    <div style="min-height:120px;font-size:0.88em;line-height:1.8;">${bodyHTML}</div>` : "";

  const firmaBloque = mostrar_firma ? `
    <div style="text-align:right;padding:4px 0 8px;">
      <div style="display:inline-block;text-align:center;min-width:160px;">
        <div style="border-top:1px solid #333;padding-top:4px;font-size:0.82em;font-weight:600;">${etiqueta_firma || "FIRMA"}</div>
        <div style="font-size:0.76em;color:#555;">${medico}</div>
      </div>
    </div>` : "";

  let horariosParsed = [];
  try { horariosParsed = JSON.parse(horarios || "[]"); } catch { /* vacio */ }

  const horariosBloque = (tipo === "receta" && mostrar_horarios && horariosParsed.length > 0) ? `
    <div style="border-top:1px solid #e0e0e0;padding-top:12px;margin-top:8px;">
      <div style="font-size:0.8em;font-weight:700;color:${color};margin-bottom:6px;display:flex;align-items:center;gap:4px;">
        <span style="font-size:1em;">\uD83D\uDD52</span> Horarios de Atenci\u00f3n
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

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;border:1px solid #ddd;overflow:hidden;">
  <div style="background:${color};padding:14px 20px;display:flex;align-items:center;gap:12px;">
    ${logo_url ? `<div><img src="${logo_url}" style="max-height:100px;max-width:150px;object-fit:contain;background:rgba(255,255,255,.15);border-radius:6px;padding:5px;"/></div>` : ""}
    <div style="flex:1;">
      <div style="color:${header_text_color};font-size:${clinica_font_size}em;font-family:${clinica_font};font-weight:bold;line-height:1.2;">${clinica || "<span style='opacity:.4;font-style:italic;font-size:.85em'>Nombre del consultorio</span>"}</div>
      <div style="color:${header_text_color}e6;font-size:${medico_font_size}em;font-family:${medico_font};font-weight:600;margin-top:5px;">${medico || ""}</div>
      ${credHTML ? `<div style="color:${header_text_color}bf;font-size:0.79em;margin-top:3px;line-height:1.7;">${credHTML}</div>` : ""}
    </div>
  </div>
  <div style="padding:18px 20px;">
    ${tituloBloque}
    ${datosBloque}
    ${tipo === "receta" ? rxBloque : ""}
    ${["incapacidad","referencia","constancia","laboratorio","estudios"].includes(tipo) ? contenidoBloque : ""}
  </div>
  <div style="padding:0 20px 14px;">
    ${tipo === "receta" ? horariosBloque : ""}
    ${firmaBloque}
  </div>
  ${footerBloque}
</div>`;
}

const MUESTRA = {
  paciente: "Carlos Mejia Reyes", paciente_dni: "0801-1990-12345", paciente_edad: "34 anos",
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
  resumen_clinico: "Paciente masculino de 34 anos con cuadro de 3 dias de fiebre y tos. Se indica referencia para valoracion especializada.",
  recomendaciones: "Acudir en ayunas. Traer examenes previos.",
  examenes: "- Hemograma completo\n- Perfil lipidico\n- Glucosa en ayunas\n- Uroanalis",
  estudios: "- Radiografia de torax PA\n- Ecografia abdominal",
};

const COLORES_RAPIDOS = [
  "#1a2744","#0d47a1","#b71c1c","#1b5e20","#4a148c","#e65100","#37474f","#006064",
];

const FUENTES = [
  { label: "Arial (sans-serif)",     value: "Arial, Helvetica, sans-serif" },
  { label: "Times New Roman (serif)", value: "'Times New Roman', Times, serif" },
  { label: "Georgia (serif)",        value: "Georgia, 'Times New Roman', serif" },
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

/* ─── Componente principal ───────────────────────────────────────── */
export default function Plantillas() {
  const { user } = useAuth();
  const clinicaId = user?.clinica_id || import.meta.env.VITE_CLINICA_ID;

  const [tab,       setTab]       = useState("receta");
  const [datos,     setDatos]     = useState({});
  const [cargando,  setCargando]  = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg,       setMsg]       = useState({ tipo: "", texto: "" });
  const [predeterminada, setPredeterminada] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await api.get(`/clinicas/${clinicaId}/plantillas`);
        const obj = {};
        (res.data.data || []).forEach(p => {
          const contenido = parseContenido(p.contenido);
          if (p.es_predeterminada) {
            contenido.es_predeterminada = true;
            setPredeterminada(p.tipo);
          }
          obj[p.tipo] = contenido;
        });
        setDatos(obj);
      } catch { /* sin plantillas aun */ }
      finally { setCargando(false); }
    };
    if (clinicaId) cargar();
    else setCargando(false);
  }, [clinicaId]);

  const dataActual    = datos[tab] || defaultData();
  const setDataActual = (val) => setDatos(prev => ({ ...prev, [tab]: val }));
  const set           = (campo, valor) => setDataActual({ ...dataActual, [campo]: valor });

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set("logo_url", ev.target.result);
    reader.readAsDataURL(file);
  };

  const setPredeterminadaApi = async () => {
    setMsg({ tipo: "", texto: "" });
    try {
      await api.post(`/clinicas/${clinicaId}/plantillas/predeterminada`, { tipo: tab });
      setPredeterminada(tab);
      setMsg({ tipo: "success", texto: `Plantilla de ${tipoActivo?.label} establecida como predeterminada` });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    }
  };

  const guardar = async () => {
    setGuardando(true); setMsg({ tipo: "", texto: "" });
    const tipo = TIPOS.find(t => t.key === tab);
    try {
      await api.post(`/clinicas/${clinicaId}/plantillas`, {
        tipo: tab, nombre: tipo?.label || tab, contenido: JSON.stringify(dataActual),
      });
      setMsg({ tipo: "success", texto: `Plantilla de ${tipo?.label} guardada correctamente` });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally { setGuardando(false); }
  };

  if (cargando) return <div className="text-center py-5"><div className="spinner-border" /></div>;

  const tipoActivo  = TIPOS.find(t => t.key === tab);
  const hint        = CONTENT_HINTS[tab] || { label: "Contenido", placeholder: "" };
  const previewHtml = buildHTML(dataActual, tab, MUESTRA);
  const lStyle      = { fontWeight: 600, fontSize: "0.82rem", color: "#374151", marginBottom: 5, display: "block" };
  const iStyle      = { fontSize: "0.86rem" };

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg,#1a2744 0%,#243b72 100%)", padding: "16px 24px 0", boxShadow: "0 2px 12px rgba(0,0,0,.18)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-file-earmark-text-fill" style={{ color: "#7dd3fc", fontSize: "1rem" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Plantillas de Documentos</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>Personaliza el dise\u00f1o de tus documentos m\u00e9dicos</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {TIPOS.map(({ key, label, icon, color }) => (
            <button key={key} onClick={() => { setTab(key); setMsg({ tipo: "", texto: "" }); }} style={{ padding: "7px 14px", fontSize: "0.8rem", fontWeight: 600, borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", background: tab === key ? "#fff" : "rgba(255,255,255,.1)", color: tab === key ? color : "rgba(255,255,255,.75)", display: "flex", alignItems: "center", gap: 5, transition: "background .15s" }}>
              <i className={`bi ${icon}`} />{label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 24px" }}>

        {msg.texto && (
          <div style={{ marginBottom: 14, padding: "10px 16px", borderRadius: 8, fontSize: "0.87rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: msg.tipo === "success" ? "#dcfce7" : "#fee2e2", color: msg.tipo === "success" ? "#166534" : "#991b1b", border: `1px solid ${msg.tipo === "success" ? "#bbf7d0" : "#fecaca"}` }}>
            <span><i className={`bi ${msg.tipo === "success" ? "bi-check-circle-fill" : "bi-x-circle-fill"} me-2`} />{msg.texto}</span>
            <button onClick={() => setMsg({ tipo: "", texto: "" })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}>x</button>
          </div>
        )}

        {/* LAYOUT: form + preview */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* PANEL IZQUIERDO: Formulario */}
          <div style={{ flex: "0 0 360px", background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: "20px", display: "flex", flexDirection: "column", gap: 18 }}>

            <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #f0f0f0", paddingBottom: 12 }}>
              <i className={`bi ${tipoActivo?.icon}`} style={{ color: tipoActivo?.color, fontSize: "1.2rem" }} />
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1a2744" }}>{tipoActivo?.label}</span>
            </div>

            {/* Logo */}
            <div>
              <label style={lStyle}><i className="bi bi-image me-2" style={{ color: tipoActivo?.color }} />Logo del consultorio</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {dataActual.logo_url && (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 6, background: "#f9fafb" }}>
                    <img src={dataActual.logo_url} alt="Logo" style={{ height: 48, maxWidth: 80, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>
                  <i className="bi bi-upload" style={{ color: tipoActivo?.color }} />
                  {dataActual.logo_url ? "Cambiar logo" : "Subir logo"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoFile} />
                </label>
                {dataActual.logo_url && (
                  <button onClick={() => set("logo_url", "")} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff5f5", cursor: "pointer", color: "#dc2626", fontSize: "0.82rem" }} title="Quitar logo">
                    <i className="bi bi-trash" />
                  </button>
                )}
              </div>
              <small style={{ color: "#9ca3af", fontSize: "0.75rem" }}>El logo aparece en la esquina izquierda del encabezado.</small>
            </div>

            {/* Color */}
            <div>
              <label style={lStyle}><i className="bi bi-palette me-2" style={{ color: tipoActivo?.color }} />Color del encabezado</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                <div style={{ flex: 1, height: 36, borderRadius: 8, background: dataActual.color || "#1a2744", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#fff", fontWeight: 600 }}>
                  {dataActual.color || "#1a2744"}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: "0.8rem", color: "#374151" }}>
                  <input type="color" value={dataActual.color || "#1a2744"} onChange={e => set("color", e.target.value)} style={{ width: 24, height: 24, border: "none", padding: 0, cursor: "pointer", background: "none" }} />
                  Otro color
                </label>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {COLORES_RAPIDOS.map(c => (
                  <button key={c} title={c} onClick={() => set("color", c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: dataActual.color === c ? "3px solid #fff" : "2px solid rgba(0,0,0,.12)", cursor: "pointer", outline: dataActual.color === c ? `2px solid ${c}` : "none" }} />
                ))}
              </div>
            </div>

            {/* Color del texto del encabezado */}
            <div>
              <label style={lStyle}><i className="bi bi-fonts me-2" style={{ color: tipoActivo?.color }} />Color del texto</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ flex: 1, height: 36, borderRadius: 8, background: dataActual.header_text_color || "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#374151", border: "1px solid #e5e7eb", fontWeight: 600 }}>
                  {dataActual.header_text_color || "#ffffff"}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: "0.8rem", color: "#374151" }}>
                  <input type="color" value={dataActual.header_text_color || "#ffffff"} onChange={e => set("header_text_color", e.target.value)} style={{ width: 24, height: 24, border: "none", padding: 0, cursor: "pointer", background: "none" }} />
                  Otro color
                </label>
              </div>
            </div>

            {/* Nombre consultorio */}
            <div>
              <label style={lStyle}><i className="bi bi-building me-2" style={{ color: tipoActivo?.color }} />Nombre del consultorio / cl\u00ednica</label>
              <input className="form-control" style={iStyle} placeholder="Ej: Consultorio Dental Dr. Ibarra" value={dataActual.clinica || ""} onChange={e => set("clinica", e.target.value)} />
            </div>

            {/* Fuente del nombre del consultorio */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lStyle}><i className="bi bi-fonts me-2" style={{ color: tipoActivo?.color }} />Fuente</label>
                <select className="form-select" style={iStyle} value={dataActual.clinica_font || "Arial, Helvetica, sans-serif"} onChange={e => set("clinica_font", e.target.value)}>
                  {FUENTES.map(f => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 120 }}>
                <label style={lStyle}>Tamano (em)</label>
                <input className="form-control" style={iStyle} type="number" step="0.1" min="0.5" max="3" value={dataActual.clinica_font_size || "1.25"} onChange={e => set("clinica_font_size", e.target.value)} />
              </div>
            </div>

            {/* Nombre medico */}
            <div>
              <label style={lStyle}><i className="bi bi-person-fill me-2" style={{ color: tipoActivo?.color }} />Nombre del médico</label>
              <input className="form-control" style={iStyle} placeholder="Ej: Dr. Juan Pérez Martínez" value={dataActual.medico || ""} onChange={e => set("medico", e.target.value)} />
            </div>

            {/* Fuente del nombre del médico */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lStyle}><i className="bi bi-fonts me-2" style={{ color: tipoActivo?.color }} />Fuente</label>
                <select className="form-select" style={iStyle} value={dataActual.medico_font || "Arial, Helvetica, sans-serif"} onChange={e => set("medico_font", e.target.value)}>
                  {FUENTES.map(f => (
                    <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 120 }}>
                <label style={lStyle}>Tamaño (em)</label>
                <input className="form-control" style={iStyle} type="number" step="0.1" min="0.5" max="3" value={dataActual.medico_font_size || "0.85"} onChange={e => set("medico_font_size", e.target.value)} />
              </div>
            </div>

            {/* Credenciales */}
            <div>
              <label style={lStyle}>
                <i className="bi bi-award me-2" style={{ color: tipoActivo?.color }} />C\u00e9dula, colegiatura, especialidad
                <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 4, fontSize: "0.77rem" }}>(una por l\u00ednea)</span>
              </label>
              <textarea className="form-control" rows={3} style={{ ...iStyle, resize: "vertical" }} placeholder={"Ced. Profesional. 597339393939378\nEspecialidad: Odontolog\u00eda\nColegiatura CMH: 4521\nSSA/1999999/2025"} value={dataActual.credenciales || ""} onChange={e => set("credenciales", e.target.value)} />
              <small style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Aparece en el encabezado debajo del nombre del m\u00e9dico.</small>
            </div>

            {/* Contenido */}
            <div>
              <label style={lStyle}><i className="bi bi-pencil-fill me-2" style={{ color: tipoActivo?.color }} />{hint.label}</label>
              <textarea className="form-control" rows={5} style={{ ...iStyle, resize: "vertical" }} placeholder={hint.placeholder} value={dataActual.contenido || ""} onChange={e => set("contenido", e.target.value)} />
            </div>

            {/* Footer */}
            <div>
              <label style={lStyle}>
                <i className="bi bi-geo-alt-fill me-2" style={{ color: tipoActivo?.color }} />Pie de p\u00e1gina
                <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 4, fontSize: "0.77rem" }}>(direcci\u00f3n, tel\u00e9fono, correo)</span>
              </label>
              <textarea className="form-control" rows={2} style={{ ...iStyle, resize: "none" }} placeholder="Col. Palmira, Blvd. Moraz\u00e1n | Tel: +504 2222-3333 | info@clinica.com" value={dataActual.footer || ""} onChange={e => set("footer", e.target.value)} />
              <small style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Fondo del color del encabezado al final del documento.</small>
            </div>

            {/* Firma */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div className="form-check" style={{ marginBottom: 0 }}>
                <input className="form-check-input" type="checkbox" id="mostrar_firma" checked={dataActual.mostrar_firma !== false} onChange={e => set("mostrar_firma", e.target.checked)} />
                <label className="form-check-label" htmlFor="mostrar_firma" style={{ fontSize: "0.84rem" }}>Línea de firma</label>
              </div>
              {dataActual.mostrar_firma !== false && (
                <input className="form-control" style={{ ...iStyle, flex: 1 }} placeholder="FIRMA" value={dataActual.etiqueta_firma || "FIRMA"} onChange={e => set("etiqueta_firma", e.target.value)} />
              )}
            </div>

            {/* Horarios (solo receta) */}
            {tab === "receta" && (
              <div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
                  <div className="form-check" style={{ marginBottom: 0 }}>
                    <input className="form-check-input" type="checkbox" id="mostrar_horarios" checked={!!dataActual.mostrar_horarios} onChange={e => set("mostrar_horarios", e.target.checked)} />
                    <label className="form-check-label" htmlFor="mostrar_horarios" style={{ fontSize: "0.84rem", fontWeight: 600 }}>
                      <i className="bi bi-clock-fill me-1" style={{ color: tipoActivo?.color }} />
                      Horarios de atención
                    </label>
                  </div>
                </div>

                {dataActual.mostrar_horarios && (
                  <div style={{ background: "#f9fafb", borderRadius: 8, padding: 12, border: "1px solid #e5e7eb" }}>
                    {(() => {
                      let lista = [];
                      try { lista = JSON.parse(dataActual.horarios || "[]"); } catch { lista = []; }
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
            )}

            {/* Predeterminada (solo receta) */}
            {tab === "receta" && (
              <div style={{ padding: 12, borderRadius: 8, border: dataActual.es_predeterminada ? "2px solid #22c55e" : "1px solid #e5e7eb", background: dataActual.es_predeterminada ? "#f0fdf4" : "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <i className={`bi ${dataActual.es_predeterminada ? "bi-star-fill" : "bi-star"}`} style={{ color: dataActual.es_predeterminada ? "#f59e0b" : "#9ca3af", fontSize: "1.1rem" }} />
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: dataActual.es_predeterminada ? "#166534" : "#374151" }}>Plantilla predeterminada</span>
                </div>
                <small style={{ color: "#6b7280", fontSize: "0.75rem", display: "block", marginBottom: 8 }}>Esta plantilla se usara al generar el PDF en la consulta medica.</small>
                {predeterminada !== tab && (
                  <button onClick={setPredeterminadaApi} style={{ padding: "8px 14px", borderRadius: 7, border: "none", cursor: "pointer", background: "#f59e0b", color: "#fff", fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <i className="bi bi-check-circle-fill" /> Establecer como predeterminada
                  </button>
                )}
                {predeterminada === tab && (
                  <span style={{ fontSize: "0.8rem", color: "#22c55e", fontWeight: 600 }}>
                    <i className="bi bi-check-circle-fill me-1" /> Esta es tu plantilla predeterminada
                  </span>
                )}
              </div>
            )}

            {/* Guardar */}
            <button onClick={guardar} disabled={guardando} style={{ padding: "11px", fontWeight: 700, fontSize: "0.9rem", borderRadius: 9, border: "none", cursor: guardando ? "default" : "pointer", background: guardando ? "#90caf9" : (tipoActivo?.color || "#1a2744"), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 2px 8px rgba(0,0,0,.15)" }}>
              <i className="bi bi-floppy-fill" />
              {guardando ? "Guardando..." : `Guardar plantilla de ${tipoActivo?.label}`}
            </button>
          </div>

          {/* PANEL DERECHO: Vista previa */}
          <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
            <div style={{ background: "#f8f9fa", borderBottom: "1px solid #e9ecef", padding: "11px 18px", display: "flex", alignItems: "center", gap: 8 }}>
              <i className="bi bi-eye-fill" style={{ color: tipoActivo?.color }} />
              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1a2744" }}>Vista previa</span>
              <span style={{ fontSize: "0.72rem", background: "#e8f5e9", color: "#2e7d32", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>Datos de ejemplo</span>
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#9ca3af", fontStyle: "italic" }}>Los cambios se reflejan en tiempo real</span>
            </div>
            <div style={{ padding: "24px", background: "#eef0f3", minHeight: 500, overflow: "auto" }}>
              <div style={{ background: "#fff", boxShadow: "0 3px 14px rgba(0,0,0,.13)", maxWidth: 720, margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
            <div style={{ borderTop: "1px solid #f0f0f0", padding: "9px 18px", display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                { icon: "bi-person-fill",   text: "{{paciente}} \u2192 nombre del paciente al generar" },
                { icon: "bi-calendar-fill", text: "{{fecha}} \u2192 fecha del d\u00eda" },
                { icon: "bi-capsule",       text: "{{diagnostico}} \u2192 diagn\u00f3stico CIE-10" },
              ].map(({ icon, text }) => (
                <span key={icon} style={{ fontSize: "0.73rem", color: "#9ca3af", display: "flex", alignItems: "center", gap: 4 }}>
                  <i className={`bi ${icon}`} />{text}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}