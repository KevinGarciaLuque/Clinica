/**
 * utils/citaEnlace.js
 * Enlace personal para que el paciente confirme o cancele su cita desde el
 * recordatorio (email / SMS / WhatsApp), sin iniciar sesión.
 *
 * Cada cita tiene un token aleatorio e impredecible (32 bytes) guardado en
 * la tabla cita_enlaces. La tabla es nueva: no modifica ninguna existente.
 */
const crypto = require("crypto");
const pool = require("../db");
const { urlPublica } = require("./urlPublica");

let tablaLista = null;

function asegurarTabla() {
  if (!tablaLista) {
    tablaLista = pool.query(`
      CREATE TABLE IF NOT EXISTS cita_enlaces (
        cita_id    INT UNSIGNED NOT NULL PRIMARY KEY,
        token      CHAR(64) NOT NULL UNIQUE,
        creado_en  DATETIME DEFAULT CURRENT_TIMESTAMP,
        accion     ENUM('CONFIRMADA','CANCELADA') NULL,
        accion_en  DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((e) => { tablaLista = null; throw e; });
  }
  return tablaLista;
}

/** Devuelve el token de la cita, creándolo si aún no existe. */
async function obtenerToken(citaId, conn = pool) {
  await asegurarTabla();
  const nuevo = crypto.randomBytes(32).toString("hex");
  // INSERT IGNORE: si ya existía, se conserva el token original
  await conn.query("INSERT IGNORE INTO cita_enlaces (cita_id, token) VALUES (?, ?)", [citaId, nuevo]);
  const [[row]] = await conn.query("SELECT token FROM cita_enlaces WHERE cita_id = ?", [citaId]);
  return row.token;
}

/** URL pública de la cita, o null si no hay FRONTEND_URL configurada. */
async function enlaceCita(citaId, conn = pool) {
  const base = (process.env.FRONTEND_URL ? urlPublica() : "");
  if (!base) return null;
  const token = await obtenerToken(citaId, conn);
  return `${base}/mi-cita/${token}`;
}

module.exports = { asegurarTabla, obtenerToken, enlaceCita };
