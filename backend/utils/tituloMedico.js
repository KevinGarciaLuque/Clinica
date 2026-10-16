/**
 * utils/tituloMedico.js
 * Título del médico según el sexo configurado en su perfil (usuarios.sexo):
 *   'F' → "Dra. "   'M' → "Dr. "   sin configurar → `desconocido` (por defecto "Dr(a). ")
 * Los psicólogos no llevan título.
 */
function tituloMedico(sexo, { tipo, desconocido = "Dr(a). " } = {}) {
  if (tipo === "PSICOLOGO") return "";
  if (sexo === "F") return "Dra. ";
  if (sexo === "M") return "Dr. ";
  return desconocido;
}

module.exports = { tituloMedico };
