/**
 * utils/codigoEstudios.js
 * Código de verificación (QR) de una solicitud de estudios.
 *
 * Una solicitud impresa puede incluir varios estudios, así que el código lleva sus números
 * (en base 36) y una firma HMAC con el secreto del servidor:  "<ids>.<FIRMA16>".
 * Sin la firma correcta nadie puede inventar un código ni recorrer números de estudios.
 * No requiere columnas nuevas en la base de datos.
 */
const crypto = require("crypto");

const MAX_ESTUDIOS = 40;

const secreto = () => process.env.ESTUDIOS_QR_SECRET || process.env.JWT_SECRET || "";
const firmar = (cuerpo) => crypto.createHmac("sha256", secreto()).update(`estudios:${cuerpo}`).digest("hex").slice(0, 16).toUpperCase();

/** ids de estudios → código para el QR (o null si no hay ids) */
function crearCodigo(ids) {
  const unicos = [...new Set((ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b).slice(0, MAX_ESTUDIOS);
  if (!unicos.length) return null;
  const cuerpo = unicos.map((n) => n.toString(36)).join("-");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

/** código → arreglo de ids, o null si el formato o la firma no son válidos */
function leerCodigo(codigo) {
  const m = /^([0-9a-z]{1,8}(?:-[0-9a-z]{1,8}){0,39})\.([0-9A-F]{16})$/.exec(String(codigo || ""));
  if (!m) return null;
  const esperada = Buffer.from(firmar(m[1]));
  const recibida = Buffer.from(m[2]);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  const ids = m[1].split("-").map((s) => parseInt(s, 36));
  return ids.every((n) => Number.isInteger(n) && n > 0) ? ids : null;
}

module.exports = { crearCodigo, leerCodigo };
