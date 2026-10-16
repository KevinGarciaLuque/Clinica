/**
 * utils/urlPublica.js
 * Dirección pública del sistema para armar los enlaces que reciben pacientes y
 * usuarios (recetas, citas, portal, correos, QR…).
 *
 * Usa PUBLIC_URL o FRONTEND_URL; si apuntan a la dirección provisional de Vercel
 * (*.vercel.app) se usa el dominio propio https://medickg.com, para que ningún
 * enlace nuevo muestre la dirección vieja. Los enlaces antiguos siguen funcionando.
 */
const DOMINIO_PROPIO = "https://medickg.com";

function urlPublica(porDefecto = "http://localhost:5173") {
  const base = String(process.env.PUBLIC_URL || process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");
  if (!base) return porDefecto;
  try {
    if (/\.vercel\.app$/i.test(new URL(base).hostname)) return DOMINIO_PROPIO;
  } catch { /* valor no es una URL: se usa tal cual */ }
  return base;
}

module.exports = { urlPublica, DOMINIO_PROPIO };
