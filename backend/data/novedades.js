/**
 * backend/data/novedades.js — Novedades publicadas desde el código.
 *
 * Cada vez que se agrega una mejora visible para las clínicas, se añade aquí una
 * entrada corta. Al arrancar el servidor se publican las que falten (por `clave`,
 * nunca se duplican ni se sobrescriben las que el Super Admin editó después).
 *
 * Campos:
 *   clave       identificador único y estable (no cambiarlo después de publicar)
 *   version     "1.10", "1.11"… (la siguiente a la última publicada)
 *   titulo      corto, en lenguaje de la clínica (no técnico)
 *   descripcion 1–3 frases: qué cambió y dónde encontrarlo
 *   icono       clase de Bootstrap Icons (bi-…)
 *   audiencia   "TODOS" | "MEDICOS" | "ADMIN"
 *   importante  true solo para cambios grandes (sale en ventana al entrar)
 */
module.exports = [
  {
    clave: "novedades-panel",
    version: "1.10",
    titulo: "Novedades de la plataforma",
    descripcion: "En el botón ✨ Novedades de la barra superior verás siempre las mejoras que vamos agregando a Medic-KG. La versión del menú se actualiza con cada una.",
    icono: "bi-stars",
    audiencia: "TODOS",
    importante: false,
  },
  {
    clave: "nueva-cita-medico-predeterminado",
    version: "1.11",
    titulo: "Agendar más rápido",
    descripcion: "Si tu clínica tiene un solo médico, al crear una cita ya aparece seleccionado. Además, el país predeterminado de las clínicas ahora es Honduras.",
    icono: "bi-lightning-charge",
    audiencia: "TODOS",
    importante: false,
  },
  {
    clave: "dictado-por-voz",
    version: "1.12",
    titulo: "Dictado por voz 🎤",
    descripcion: "Al entrar a cualquier campo de texto de la consulta (motivo, examen, diagnóstico, plan…) aparece un micrófono en la esquina: tócalo y habla, el texto se escribe solo. Puedes decir “punto”, “coma” o “nueva línea”. Funciona en Chrome, Edge y Safari.",
    icono: "bi-mic-fill",
    audiencia: "TODOS",
    importante: true,
  },
  {
    clave: "antes-de-entrar",
    version: "1.13",
    titulo: "Resumen “Antes de entrar”",
    descripcion: "Al abrir la consulta ves de un vistazo las alergias del paciente, sus antecedentes, los últimos signos vitales (con el cambio de peso), su última receta, sus estudios pendientes o con resultado, y avisos como citas a las que faltó o facturas pendientes.",
    icono: "bi-clipboard2-pulse",
    audiencia: "MEDICOS",
    importante: true,
  },
  {
    clave: "busqueda-rapida",
    version: "1.14",
    titulo: "Búsqueda rápida de pacientes",
    descripcion: "Toca la lupa 🔍 de la barra superior (o presiona Ctrl+K en la computadora) desde cualquier pantalla para encontrar un paciente por nombre, DNI o teléfono y abrir su perfil o su historia al instante. También te muestra los últimos pacientes que abriste.",
    icono: "bi-search",
    audiencia: "TODOS",
    importante: false,
  },
  {
    clave: "repetir-receta",
    version: "1.15",
    titulo: "Repetir la última receta",
    descripcion: "En la consulta, pestaña Prescripción, el botón “Repetir última receta” copia los medicamentos de la receta anterior del paciente para que solo revises y guardes. También puedes repetir cualquier receta desde Historial, y el botón “Usar” de Mis Favoritas ahora carga los medicamentos directamente.",
    icono: "bi-arrow-repeat",
    audiencia: "MEDICOS",
    importante: false,
  },
  {
    clave: "receta-whatsapp",
    version: "1.16",
    titulo: "Enviar la receta por WhatsApp",
    descripcion: "En la consulta, pestaña Prescripción, el botón verde “WhatsApp” prepara un mensaje con los medicamentos y el enlace a la receta digital (la misma del código QR) y abre WhatsApp con el número del paciente. Puedes revisar el número y el texto antes de enviarlo.",
    icono: "bi-whatsapp",
    audiencia: "MEDICOS",
    importante: false,
  },
];
