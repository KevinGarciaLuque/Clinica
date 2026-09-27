// Campos de nombre de persona que se escriben con la primera letra de cada palabra en mayúscula
export const CAMPOS_NOMBRE = new Set([
  "nombres", "apellidos", "responsable_nombre", "contacto_emergencia_nombre",
]);

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "di", "do", "van", "von"]);

// Capitaliza mientras se escribe: "maría de los ángeles" -> "María de los Ángeles".
// No cambia el largo del texto (el cursor no salta) y no fuerza minúsculas en lo ya escrito.
export function capitalizarNombre(valor) {
  const texto = String(valor ?? "");
  const partes = texto.split(" ");
  return partes
    .map((palabra, i) => {
      if (!palabra) return palabra;
      const esUltima = i === partes.length - 1;
      // Una partícula ya terminada (seguida de espacio) queda en minúscula; la que se está escribiendo no
      if (i > 0 && !esUltima && PARTICULAS.has(palabra.toLowerCase())) return palabra.toLowerCase();
      return palabra.replace(/(^|[-'’])(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase());
    })
    .join(" ");
}
