/**
 * routes/paliativos.js — Escalas de cuidados paliativos dentro de la consulta.
 *
 * Cada consulta (historia clínica) puede tener una aplicación de cada escala.
 * El navegador calcula el puntaje y la interpretación (ver frontend/src/utils/paliativosEscalas.js)
 * y aquí se guardan las respuestas, el puntaje y el nivel de color para poder
 * graficar la evolución del paciente (mapa de calor).
 *
 *  GET /api/paliativos/historia/:hid           → escalas aplicadas en una consulta
 *  PUT /api/paliativos/historia/:hid           → guardar las escalas de esa consulta
 *  GET /api/paliativos/paciente/:pid/evolucion → todas las aplicaciones del paciente (mapa de calor)
 */
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");
const { zonaClinica, localSql } = require("../utils/zonaHoraria");

const ROLES = ["ADMIN", "MEDICO", "ENFERMERA", "SUPER_ADMIN"];

let tablasListas = false;
async function asegurarTablas() {
  if (tablasListas) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS paliativos_escalas (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id    INT UNSIGNED NOT NULL,
      paciente_id   INT UNSIGNED NOT NULL,
      historia_id   INT UNSIGNED NULL,
      escala        VARCHAR(40) NOT NULL,
      fecha         DATE NOT NULL,
      respuestas    LONGTEXT NULL,
      puntaje       DECIMAL(8,2) NULL,
      nivel_texto   VARCHAR(120) NULL,
      nivel_color   VARCHAR(20) NULL,
      notas         TEXT NULL,
      creado_por    INT UNSIGNED NULL,
      creado_en     DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME NULL,
      UNIQUE KEY uq_pal_historia_escala (historia_id, escala),
      INDEX idx_pal_paciente (clinica_id, paciente_id, escala, fecha)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablasListas = true;
}

const clinicaDe = (req) => (req.user.super ? req.tenant?.clinica_id : req.user.clinica_id);
const json = (v) => { if (!v) return null; try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; } };
const texto = (v, max) => (v === null || v === undefined || v === "" ? null : String(v).slice(0, max));
const numero = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && Math.abs(n) < 1000000 ? n : null;
};

const SELECT = `SELECT id, paciente_id, historia_id, escala, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                       respuestas, puntaje, nivel_texto, nivel_color, notas FROM paliativos_escalas`;

function formatear(r) {
  return {
    id: r.id, historia_id: r.historia_id, escala: r.escala, fecha: r.fecha,
    respuestas: json(r.respuestas) || {},
    puntaje: r.puntaje === null || r.puntaje === undefined ? null : Number(r.puntaje),
    nivel_texto: r.nivel_texto, nivel_color: r.nivel_color, notas: r.notas,
  };
}

/** La historia existe y es de esta clínica */
async function historiaDeClinica(hid, clinicaId) {
  const fechaLocal = localSql("creado_en", await zonaClinica(clinicaId));
  const [[h]] = await pool.query(
    `SELECT id, paciente_id, clinica_id, DATE_FORMAT(${fechaLocal}, '%Y-%m-%d') AS fecha
     FROM historias_clinicas WHERE id = ? AND clinica_id = ?`,
    [hid, clinicaId]
  );
  return h || null;
}

router.get("/historia/:hid(\\d+)", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTablas();
    const [rows] = await pool.query(`${SELECT} WHERE historia_id = ? AND clinica_id = ?`, [req.params.hid, clinicaDe(req)]);
    res.json({ ok: true, data: rows.map(formatear) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * Body: { escalas: { <clave>: { respuestas, puntaje, nivel_texto, nivel_color, notas } } }
 * Las escalas que vienen se crean o actualizan; las que se vacían (null) se borran de esta consulta.
 */
router.put("/historia/:hid(\\d+)", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTablas();
    const clinicaId = clinicaDe(req);
    const h = await historiaDeClinica(req.params.hid, clinicaId);
    if (!h) return res.status(404).json({ ok: false, msg: "Consulta no encontrada." });

    const escalas = req.body?.escalas || {};
    for (const [clave, e] of Object.entries(escalas)) {
      if (!/^[a-z0-9_]{1,40}$/.test(clave)) continue;
      if (e === null) {
        await pool.query("DELETE FROM paliativos_escalas WHERE historia_id = ? AND escala = ?", [h.id, clave]);
        continue;
      }
      const respuestas = JSON.stringify(e.respuestas || {});
      if (respuestas.length > 100000) continue;
      const vals = [respuestas, numero(e.puntaje), texto(e.nivel_texto, 120), texto(e.nivel_color, 20), texto(e.notas, 4000)];
      const [[ya]] = await pool.query("SELECT id FROM paliativos_escalas WHERE historia_id = ? AND escala = ?", [h.id, clave]);
      if (ya) {
        await pool.query(
          `UPDATE paliativos_escalas SET respuestas=?, puntaje=?, nivel_texto=?, nivel_color=?, notas=?, actualizado_en=NOW() WHERE id=?`,
          [...vals, ya.id]
        );
      } else {
        await pool.query(
          `INSERT INTO paliativos_escalas
             (clinica_id, paciente_id, historia_id, escala, fecha, respuestas, puntaje, nivel_texto, nivel_color, notas, creado_por)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [clinicaId, h.paciente_id, h.id, clave, h.fecha, ...vals, req.user.id]
        );
      }
    }
    const [rows] = await pool.query(`${SELECT} WHERE historia_id = ? AND clinica_id = ?`, [h.id, clinicaId]);
    res.json({ ok: true, data: rows.map(formatear) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/** Todas las aplicaciones del paciente (más antiguas primero) para el mapa de calor y el "anterior" */
router.get("/paciente/:pid(\\d+)/evolucion", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTablas();
    const [rows] = await pool.query(
      `${SELECT} WHERE paciente_id = ? AND clinica_id = ? ORDER BY fecha ASC, id ASC LIMIT 2000`,
      [req.params.pid, clinicaDe(req)]
    );
    res.json({ ok: true, data: rows.map(formatear) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.asegurarTablas = asegurarTablas;
module.exports = router;
