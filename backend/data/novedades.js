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
];
