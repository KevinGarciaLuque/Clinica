/**
 * utils/rangoDias.js — Condiciones SQL por días que SÍ usan el índice de la columna.
 *
 * `DATE(inicio) = ?` o `DATE(inicio) BETWEEN ? AND ?` obligan a la base de datos a
 * revisar TODAS las filas de la clínica (no puede usar el índice de `inicio`).
 * Estas condiciones dan el mismo resultado con un rango, y sí usan el índice.
 *
 *  DIA_SQL("c.inicio")   → "c.inicio >= DATE(?) AND c.inicio < DATE(?) + 1 día"   (params: dia, dia)
 *  RANGO_SQL("c.inicio") → igual, con params: desde, hasta (ambos "YYYY-MM-DD", inclusive)
 *  DESDE_SQL("c.inicio") → "c.inicio >= DATE(?)"                                (params: desde)
 */
// DATE(?) se aplica al dato (no a la columna): toma solo el día y no impide usar el índice
const DIA_SQL = (col) => `${col} >= DATE(?) AND ${col} < DATE_ADD(DATE(?), INTERVAL 1 DAY)`;
const RANGO_SQL = DIA_SQL;
const DESDE_SQL = (col) => `${col} >= DATE(?)`;

module.exports = { DIA_SQL, RANGO_SQL, DESDE_SQL };
