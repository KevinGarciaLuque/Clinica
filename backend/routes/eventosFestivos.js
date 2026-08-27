/**
 * routes/eventosFestivos.js
 * Calendario de eventos/banners festivos mostrados en el Dashboard (global,
 * todas las clínicas). Administrado únicamente por SUPER_ADMIN; el toggle
 * maestro que enciende/apaga todos los banners vive en config_sistema
 * (clave "eventos_festivos_activo").
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const dayjs  = require("dayjs");

// ── GET /api/eventos-festivos  (solo SUPER_ADMIN) — listado completo para administrar ──
router.get("/", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM eventos_festivos ORDER BY fecha_inicio ASC"
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /api/eventos-festivos  (solo SUPER_ADMIN) ──────────────────────────
router.post("/", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { nombre, emoji, mensaje, color, fecha_inicio, fecha_fin, recurrente_anual, activo } = req.body;
    if (!nombre || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ ok: false, msg: "nombre, fecha_inicio y fecha_fin son requeridos" });
    }
    const [r] = await pool.query(
      `INSERT INTO eventos_festivos (nombre, emoji, mensaje, color, fecha_inicio, fecha_fin, recurrente_anual, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, emoji || "🎉", mensaje || null, color || "#1e40af", fecha_inicio, fecha_fin,
       recurrente_anual !== undefined ? (recurrente_anual ? 1 : 0) : 1,
       activo !== undefined ? (activo ? 1 : 0) : 1]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /api/eventos-festivos/:id  (solo SUPER_ADMIN) ───────────────────────
router.put("/:id", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { nombre, emoji, mensaje, color, fecha_inicio, fecha_fin, recurrente_anual, activo } = req.body;
    await pool.query(
      `UPDATE eventos_festivos SET
         nombre=COALESCE(?,nombre), emoji=COALESCE(?,emoji), mensaje=COALESCE(?,mensaje),
         color=COALESCE(?,color), fecha_inicio=COALESCE(?,fecha_inicio), fecha_fin=COALESCE(?,fecha_fin),
         recurrente_anual=COALESCE(?,recurrente_anual), activo=COALESCE(?,activo)
       WHERE id=?`,
      [nombre || null, emoji || null, mensaje || null, color || null, fecha_inicio || null, fecha_fin || null,
       recurrente_anual !== undefined ? (recurrente_anual ? 1 : 0) : null,
       activo !== undefined ? (activo ? 1 : 0) : null,
       req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── DELETE /api/eventos-festivos/:id  (solo SUPER_ADMIN) ────────────────────
router.delete("/:id", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await pool.query("DELETE FROM eventos_festivos WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

function eventoVigenteHoy(hoy, ev) {
  if (!ev.recurrente_anual) {
    const ini = dayjs(ev.fecha_inicio);
    const fin = dayjs(ev.fecha_fin);
    return !hoy.isBefore(ini, "day") && !hoy.isAfter(fin, "day");
  }
  // Recurrente: comparar solo mes/día, probando el ciclo que empieza este año
  // y el que empezó el año anterior (para fechas que cruzan fin de año, ej. Navidad).
  const iniD = dayjs(ev.fecha_inicio);
  const finD = dayjs(ev.fecha_fin);
  for (const yearOffset of [-1, 0]) {
    const y = hoy.year() + yearOffset;
    let ini = iniD.year(y);
    let fin = finD.year(y);
    if (fin.isBefore(ini)) fin = fin.add(1, "year");
    if (!hoy.isBefore(ini, "day") && !hoy.isAfter(fin, "day")) return true;
  }
  return false;
}

// ── GET /api/eventos-festivos/activo  (cualquier usuario autenticado) ──────
// Devuelve el evento vigente hoy (o null), respetando el toggle maestro.
router.get("/activo", auth(), async (req, res) => {
  try {
    const [[master]] = await pool.query(
      "SELECT valor FROM config_sistema WHERE clave='eventos_festivos_activo'"
    );
    if (master && master.valor === "0") {
      return res.json({ ok: true, data: null });
    }

    const hoyStr = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || "")
      ? req.query.fecha
      : new Date().toLocaleDateString("en-CA");
    const hoy = dayjs(hoyStr);

    const [rows] = await pool.query(
      "SELECT * FROM eventos_festivos WHERE activo=1"
    );
    const vigente = rows.find(ev => eventoVigenteHoy(hoy, ev));
    res.json({ ok: true, data: vigente || null });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
