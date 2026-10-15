/**
 * utils/respaldoSql.js
 * Genera un respaldo completo de la base de datos en un archivo .sql.gz
 * usando solo Node (no requiere mysqldump en el servidor).
 *
 * - Lee todo dentro de una transacción con instantánea consistente
 *   (REPEATABLE READ + CONSISTENT SNAPSHOT): no bloquea tablas ni detiene
 *   el sistema mientras se generan los datos.
 * - Solo LEE la base de datos; nunca escribe en ella.
 * - El .sql resultante se puede restaurar con cualquier cliente MySQL.
 */
const mysql = require("mysql2");
const fs = require("fs");
const zlib = require("zlib");
const { once } = require("events");

const FILAS_POR_INSERT = 200;

function conectar() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    charset: "utf8mb4",
    // Fechas y números grandes como texto: se respaldan exactamente como están
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
}

const q = (conn, sql, params) => new Promise((resolve, reject) => {
  conn.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const id = (nombre) => "`" + String(nombre).replace(/`/g, "``") + "`";

async function escribir(salida, texto) {
  if (!salida.write(texto)) await once(salida, "drain");
}

/**
 * @param {string} rutaSalida  archivo .sql.gz a crear
 * @returns {Promise<{tablas:number, filas:number}>}
 */
async function generarRespaldoSql(rutaSalida) {
  const conn = conectar();
  const gzip = zlib.createGzip({ level: 6 });
  const archivo = fs.createWriteStream(rutaSalida);
  gzip.pipe(archivo);
  const terminado = once(archivo, "finish");

  let tablas = 0;
  let filas = 0;
  try {
    await q(conn, "SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await q(conn, "START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");

    const [{ db }] = await q(conn, "SELECT DATABASE() AS db");
    await escribir(gzip,
      `-- Respaldo automático de ${db}\n-- Generado: ${new Date().toISOString()}\n\n` +
      "SET NAMES utf8mb4;\nSET @OLD_FK=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;\n" +
      "SET @OLD_UQ=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;\nSET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n");

    const lista = await q(conn, "SHOW FULL TABLES");
    const clave = Object.keys(lista[0] || {}).find(k => k !== "Table_type");
    const baseTablas = lista.filter(r => r.Table_type === "BASE TABLE").map(r => r[clave]);
    const vistas = lista.filter(r => r.Table_type === "VIEW").map(r => r[clave]);

    for (const t of baseTablas) {
      const [crear] = await q(conn, `SHOW CREATE TABLE ${id(t)}`);
      await escribir(gzip, `-- Tabla ${t}\nDROP TABLE IF EXISTS ${id(t)};\n${crear["Create Table"]};\n`);

      // Columnas generadas no se pueden insertar: se omiten de los INSERT
      const cols = await q(conn,
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND EXTRA NOT LIKE '%GENERATED%'
         ORDER BY ORDINAL_POSITION`, [t]);
      const nombres = cols.map(c => c.COLUMN_NAME);
      if (!nombres.length) { await escribir(gzip, "\n"); tablas++; continue; }
      const listaCols = nombres.map(id).join(", ");

      let lote = [];
      const volcar = async () => {
        if (!lote.length) return;
        await escribir(gzip, `INSERT INTO ${id(t)} (${listaCols}) VALUES\n${lote.join(",\n")};\n`);
        lote = [];
      };

      const stream = conn.query(`SELECT ${listaCols} FROM ${id(t)}`).stream({ highWaterMark: 500 });
      for await (const fila of stream) {
        lote.push("(" + nombres.map(c => conn.escape(fila[c])).join(",") + ")");
        filas++;
        if (lote.length >= FILAS_POR_INSERT) await volcar();
      }
      await volcar();
      await escribir(gzip, "\n");
      tablas++;
    }

    for (const v of vistas) {
      const [crear] = await q(conn, `SHOW CREATE VIEW ${id(v)}`);
      await escribir(gzip, `DROP VIEW IF EXISTS ${id(v)};\n${crear["Create View"]};\n\n`);
    }

    await escribir(gzip,
      "SET SQL_MODE=@OLD_SQL_MODE;\nSET UNIQUE_CHECKS=@OLD_UQ;\nSET FOREIGN_KEY_CHECKS=@OLD_FK;\n");
    await q(conn, "COMMIT");
  } catch (err) {
    gzip.destroy();
    archivo.destroy();
    fs.rm(rutaSalida, { force: true }, () => {});
    throw err;
  } finally {
    conn.end();
  }

  gzip.end();
  await terminado;
  return { tablas, filas };
}

module.exports = { generarRespaldoSql };
