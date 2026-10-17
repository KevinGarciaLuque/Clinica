// Ayudas de los documentos tipo Word (Documentos Clínicos → Mis documentos):
// datos automáticos ({{paciente}}, {{fecha}}…), llenado con los datos del
// paciente y conversión de un .docx al formato del editor.
import mammoth from "mammoth/mammoth.browser";

export const CATEGORIAS_WORD = [
  { value: "constancia", label: "Constancia" },
  { value: "consentimiento", label: "Consentimiento" },
  { value: "informe", label: "Informe" },
  { value: "referencia", label: "Referencia" },
  { value: "formato", label: "Formato" },
  { value: "otro", label: "Otro" },
];

export const PAPELES = [
  { value: "LETTER", label: "Carta", ancho: 816, alto: 1056, css: "Letter" },
  { value: "HALF_LETTER", label: "Media carta", ancho: 816, alto: 528, css: "5.5in 8.5in" },
  { value: "LEGAL", label: "Oficio / Legal", ancho: 816, alto: 1344, css: "Legal" },
  { value: "A4", label: "A4", ancho: 794, alto: 1123, css: "A4" },
];

// Datos que se llenan solos al elegir un paciente
export const VARIABLES = [
  { grupo: "Paciente", items: [
    ["paciente", "Nombre completo"], ["paciente_nombres", "Nombres"], ["paciente_apellidos", "Apellidos"],
    ["paciente_dni", "DNI / identidad"], ["paciente_edad", "Edad"], ["paciente_fecha_nacimiento", "Fecha de nacimiento"],
    ["paciente_sexo", "Sexo"], ["paciente_telefono", "Teléfono"], ["paciente_email", "Correo"],
    ["paciente_direccion", "Dirección"], ["paciente_ocupacion", "Ocupación"], ["paciente_estado_civil", "Estado civil"],
    ["paciente_responsable", "Responsable / tutor"],
  ] },
  { grupo: "Médico y clínica", items: [
    ["medico", "Nombre del médico"], ["medico_especialidad", "Especialidad"], ["medico_colegiatura", "N.º de colegiatura"],
    ["clinica", "Nombre de la clínica"], ["clinica_direccion", "Dirección de la clínica"], ["clinica_telefono", "Teléfono de la clínica"],
  ] },
  { grupo: "Fecha", items: [
    ["fecha", "Fecha (16 de octubre de 2026)"], ["fecha_corta", "Fecha (16/10/2026)"], ["hora", "Hora"],
  ] },
];
export const NOMBRE_VARIABLE = Object.fromEntries(VARIABLES.flatMap((g) => g.items));

const escapar = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Reemplaza {{dato}} por su valor. Los datos sin valor quedan como "________" para llenarlos a mano. */
export function llenarDatos(html, valores = {}) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  // Las marcas de dato del editor se vuelven texto normal
  tmp.querySelectorAll("span.dw-var").forEach((s) => s.replaceWith(document.createTextNode(s.textContent)));
  return tmp.innerHTML.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, clave) => {
    const v = valores[clave];
    return v != null && String(v).trim() !== "" ? escapar(v) : "________________";
  });
}

const BLOQUES = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "TABLE", "BLOCKQUOTE", "HR", "PRE"]);

/** Todo texto suelto queda dentro de un párrafo (Word ignora el texto fuera de párrafos) */
export function normalizarBloques(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  let parrafo = null;
  [...tmp.childNodes].forEach((n) => {
    const esBloque = n.nodeType === 1 && BLOQUES.has(n.nodeName);
    const vacio = n.nodeType === 3 && !n.textContent.trim();
    if (esBloque) { parrafo = null; if (n.nodeName === "DIV") { const p = document.createElement("p"); if (n.getAttribute("style")) p.setAttribute("style", n.getAttribute("style")); p.innerHTML = n.innerHTML; n.replaceWith(p); } return; }
    if (vacio && !parrafo) { n.remove(); return; }
    if (!parrafo) { parrafo = document.createElement("p"); n.before(parrafo); }
    parrafo.appendChild(n);
  });
  return tmp.innerHTML;
}

/** Lista de datos usados en un documento (para avisar cuáles no tienen valor) */
export function datosUsados(html) {
  return [...new Set([...String(html || "").matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[1]))];
}

/** Convierte un Word (.docx) al formato del editor: negritas, cursivas, títulos, listas, tablas e imágenes. */
export async function docxAHtml(file) {
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.convertToHtml({ arrayBuffer }, {
    styleMap: [
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Título'] => h1:fresh",
      "u => u",
      "strike => s",
    ],
  });
  // Las tablas de Word llegan sin bordes: se les ponen bordes sencillos
  const tmp = document.createElement("div");
  tmp.innerHTML = value || "";
  tmp.querySelectorAll("table").forEach((t) => {
    t.setAttribute("style", "border-collapse:collapse;width:100%");
    t.querySelectorAll("td,th").forEach((c) => c.setAttribute("style", "border:1px solid #444;padding:4px 6px;vertical-align:top"));
  });
  tmp.querySelectorAll("img").forEach((img) => { img.style.maxWidth = "100%"; });
  return tmp.innerHTML || "<p></p>";
}

/** Página completa (para imprimir o generar el PDF) */
export function paginaCompleta(html, papel = "LETTER", titulo = "Documento") {
  const p = PAPELES.find((x) => x.value === papel) || PAPELES[0];
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>
<style>
  @page { size: ${p.css}; margin: 18mm 18mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; }
  p { margin: 0 0 8px; } h1,h2,h3 { margin: 6px 0 10px; } h1 { font-size: 18pt; } h2 { font-size: 15pt; } h3 { font-size: 13pt; }
  table { border-collapse: collapse; max-width: 100%; } td, th { vertical-align: top; }
  img { max-width: 100%; }
</style></head><body>${html}</body></html>`;
}
