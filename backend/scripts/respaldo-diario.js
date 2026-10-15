/**
 * scripts/respaldo-diario.js
 * Respaldo automático de la base de datos:
 *   1. Genera un .sql.gz completo (utils/respaldoSql.js, solo lectura).
 *   2. Lo sube a Cloudinary como archivo PRIVADO (type "authenticated"):
 *      no tiene enlace público; solo se descarga con un enlace firmado.
 *   3. Lo registra en backups_log y conserva los últimos N respaldos.
 *
 * Variables opcionales:
 *   RESPALDO_DIARIO=0        desactiva el respaldo automático
 *   RESPALDO_CONSERVAR=14    cuántos respaldos guardar (por defecto 14)
 */
const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const pool = require("../db");
const cloudinary = require("../utils/cloudinary");
const { generarRespaldoSql } = require("../utils/respaldoSql");

const CARPETA = "respaldos-bd";
let enCurso = false;

function cloudinaryConfigurado() {
  const c = cloudinary.config();
  return Boolean(c.cloud_name && c.api_key && c.api_secret);
}

async function asegurarTabla() {
  // Misma definición que database/schema.sql; no cambia nada si ya existe
  await pool.query(`CREATE TABLE IF NOT EXISTS backups_log (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinica_id    INT UNSIGNED,
    tipo          ENUM('LOCAL','NUBE') DEFAULT 'LOCAL',
    archivo       VARCHAR(300),
    tamanio_bytes BIGINT,
    estado        ENUM('OK','ERROR') DEFAULT 'OK',
    error_msg     TEXT,
    creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
}

async function rotar() {
  const conservar = Math.max(3, Number(process.env.RESPALDO_CONSERVAR) || 14);
  const [viejos] = await pool.query(
    `SELECT id, archivo FROM backups_log
     WHERE tipo = 'NUBE' AND estado = 'OK' AND clinica_id IS NULL
     ORDER BY creado_en DESC, id DESC LIMIT 1000 OFFSET ?`, [conservar]);
  for (const r of viejos) {
    try {
      await cloudinary.uploader.destroy(r.archivo, { resource_type: "raw", type: "authenticated", invalidate: true });
      await pool.query("DELETE FROM backups_log WHERE id = ?", [r.id]);
    } catch (e) {
      console.error("[Respaldo] No se pudo eliminar respaldo antiguo", r.archivo, e.message);
    }
  }
  return viejos.length;
}

/** Ejecuta un respaldo completo. Nunca lanza error: devuelve el resultado. */
async function ejecutarRespaldo({ origen = "automatico" } = {}) {
  if (enCurso) return { ok: false, msg: "Ya hay un respaldo en curso." };
  if (!cloudinaryConfigurado()) {
    console.warn("[Respaldo] Cloudinary no está configurado; se omite el respaldo.");
    return { ok: false, msg: "Cloudinary no está configurado en el servidor." };
  }

  enCurso = true;
  const ahora = new Date();
  const sello = ahora.toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const nombre = `respaldo_${process.env.DB_NAME || "bd"}_${sello}.sql.gz`;
  // Nombre temporal único: dos respaldos seguidos nunca comparten archivo
  const tmp = path.join(os.tmpdir(), `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${nombre}`);
  const inicio = Date.now();

  try {
    await asegurarTabla();
    const { tablas, filas } = await generarRespaldoSql(tmp);
    const bytes = fs.statSync(tmp).size;

    const subida = await cloudinary.uploader.upload_large(tmp, {
      resource_type: "raw",
      type: "authenticated",
      folder: CARPETA,
      public_id: nombre,
      overwrite: false,
      chunk_size: 6_000_000,
    });

    await pool.query(
      "INSERT INTO backups_log (clinica_id, tipo, archivo, tamanio_bytes, estado) VALUES (NULL, 'NUBE', ?, ?, 'OK')",
      [subida.public_id, bytes]);
    const rotados = await rotar();

    const seg = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`💾 [Respaldo ${origen}] OK: ${tablas} tablas, ${filas} filas, ${(bytes / 1024).toFixed(0)} KB en ${seg}s` +
      (rotados ? `, ${rotados} antiguo(s) eliminado(s)` : ""));
    return { ok: true, archivo: subida.public_id, bytes, tablas, filas };
  } catch (err) {
    console.error(`❌ [Respaldo ${origen}] Error:`, err.message);
    try {
      await pool.query(
        "INSERT INTO backups_log (clinica_id, tipo, archivo, tamanio_bytes, estado, error_msg) VALUES (NULL, 'NUBE', ?, NULL, 'ERROR', ?)",
        [nombre, String(err.message || err).slice(0, 2000)]);
    } catch { /* si ni siquiera se puede registrar, ya quedó en el log del servidor */ }
    return { ok: false, msg: err.message };
  } finally {
    await fs.promises.rm(tmp, { force: true }).catch(() => {});
    enCurso = false;
  }
}

/** Enlace firmado y temporal (1 hora) para descargar un respaldo privado. */
function enlaceDescarga(publicId) {
  return cloudinary.utils.private_download_url(publicId, "", {
    resource_type: "raw",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    attachment: true,
  });
}

module.exports = { ejecutarRespaldo, enlaceDescarga, asegurarTabla };
