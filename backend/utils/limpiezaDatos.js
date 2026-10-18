/**
 * utils/limpiezaDatos.js — Limpieza diaria de datos que ya no sirven (cron 03:30).
 *
 * Solo borra:
 *  - códigos temporales vencidos hace más de 7 días (inicio de sesión en 2 pasos,
 *    recuperar contraseña, verificar correo, verificación por DNI del registro);
 *  - notificaciones de la campana YA LEÍDAS con más de 6 meses.
 *
 * No toca nada clínico ni el historial de recordatorios (la clínica lo consulta).
 * Borra por bloques pequeños para no trabar la base de datos.
 */
const pool = require("../db");

const REGLAS = [
  ["usuario_2fa_codigos", "expira_en < NOW() - INTERVAL 7 DAY"],
  ["usuario_password_reset", "expira_en < NOW() - INTERVAL 7 DAY"],
  ["verificaciones_email", "expires_at < NOW() - INTERVAL 7 DAY"],
  ["registro_codigos", "expira_en < NOW() - INTERVAL 7 DAY"],
  ["notificaciones_usuario", "leida = 1 AND creado_en < NOW() - INTERVAL 6 MONTH"],
];
const BLOQUE = 5000;

async function limpiarDatosVencidos() {
  const resumen = {};
  for (const [tabla, condicion] of REGLAS) {
    let total = 0;
    try {
      for (;;) {
        const [r] = await pool.query(`DELETE FROM \`${tabla}\` WHERE ${condicion} LIMIT ${BLOQUE}`);
        total += r.affectedRows;
        if (r.affectedRows < BLOQUE) break;
        await new Promise((ok) => setTimeout(ok, 200)); // respiro entre bloques
      }
    } catch (e) {
      if (e.code !== "ER_NO_SUCH_TABLE") console.warn(`[limpieza] ${tabla}:`, e.message);
    }
    if (total) resumen[tabla] = total;
  }
  console.log("🧹 [limpieza] datos vencidos borrados:", Object.keys(resumen).length ? resumen : "ninguno");
  return resumen;
}

module.exports = { limpiarDatosVencidos };
