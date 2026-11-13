/**
 * routes/esteticaDatos.js — Ficha estética, presupuestos, consentimientos y
 * seguimiento post-op guardados en el servidor.
 *
 * Antes estas cuatro secciones se guardaban solo en el navegador (localStorage):
 * no se veían desde otro equipo, no entraban en los respaldos y se perdían al
 * borrar el historial. /importar sube una sola vez lo que cada navegador tenía.
 *
 *  GET    /api/estetica-datos?tipo=&paciente_id=   → registros (los más recientes primero)
 *  POST   /api/estetica-datos                      → { tipo, paciente_id, datos } (la ficha es una por paciente)
 *  PUT    /api/estetica-datos/:id                  → { datos }
 *  DELETE /api/estetica-datos/:id                  → se marca como eliminado (no se borra)
 *  POST   /api/estetica-datos/importar             → { items: [{ tipo, paciente_id, datos, id_local }] }
 */
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");

const ROLES = ["ADMIN", "MEDICO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"];
const TIPOS = ["ficha", "presupuesto", "consentimiento", "seguimiento"];

let tablaLista = false;
async function asegurarTabla() {
  if (tablaLista) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estetica_registros (
      id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id     INT UNSIGNED NOT NULL,
      paciente_id    INT UNSIGNED NOT NULL,
      tipo           VARCHAR(20) NOT NULL,
      datos          LONGTEXT NOT NULL,
      id_local       VARCHAR(40) NULL,
      activo         TINYINT(1) NOT NULL DEFAULT 1,
      creado_por     INT UNSIGNED NULL,
      creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME NULL,
      UNIQUE KEY uq_est_local (clinica_id, tipo, id_local),
      INDEX idx_est_paciente (clinica_id, paciente_id, tipo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  tablaLista = true;
}

const clinicaDe = (req) => (req.user.super ? req.tenant?.clinica_id : req.user.clinica_id);
const leer = (t) => { try { return JSON.parse(t); } catch { return {}; } };
const texto = (datos) => {
  const t = JSON.stringify(datos && typeof datos === "object" ? datos : {});
  return t.length > 500000 ? null : t;
};
const fila = (r) => ({
  id: r.id, paciente_id: r.paciente_id, tipo: r.tipo, datos: leer(r.datos),
  paciente_nombre: r.pac_nombres ? `${r.pac_nombres} ${r.pac_apellidos || ""}`.trim() : null,
  creado_en: r.creado_en, actualizado_en: r.actualizado_en,
});

async function pacienteDeClinica(pid, clinicaId) {
  const [[p]] = await pool.query("SELECT id FROM pacientes WHERE id = ? AND clinica_id = ?", [pid, clinicaId]);
  return !!p;
}

router.get("/", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTabla();
    const clinicaId = clinicaDe(req);
    const where = ["e.clinica_id = ?", "e.activo = 1"];
    const params = [clinicaId];
    if (TIPOS.includes(req.query.tipo)) { where.push("e.tipo = ?"); params.push(req.query.tipo); }
    if (Number(req.query.paciente_id)) { where.push("e.paciente_id = ?"); params.push(Number(req.query.paciente_id)); }
    const [rows] = await pool.query(
      `SELECT e.*, p.nombres AS pac_nombres, p.apellidos AS pac_apellidos
       FROM estetica_registros e LEFT JOIN pacientes p ON p.id = e.paciente_id
       WHERE ${where.join(" AND ")} ORDER BY e.creado_en DESC, e.id DESC LIMIT 2000`,
      params
    );
    res.json({ ok: true, data: rows.map(fila) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.post("/", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTabla();
    const clinicaId = clinicaDe(req);
    const { tipo, paciente_id, datos } = req.body || {};
    if (!TIPOS.includes(tipo)) return res.status(400).json({ ok: false, msg: "Tipo no válido." });
    if (!(await pacienteDeClinica(paciente_id, clinicaId))) return res.status(404).json({ ok: false, msg: "Paciente no encontrado." });
    const t = texto(datos);
    if (!t) return res.status(400).json({ ok: false, msg: "Los datos son demasiado grandes." });

    // La ficha es una sola por paciente: si ya existe, se actualiza
    if (tipo === "ficha") {
      const [[ya]] = await pool.query(
        "SELECT id FROM estetica_registros WHERE clinica_id = ? AND paciente_id = ? AND tipo = 'ficha' AND activo = 1 LIMIT 1",
        [clinicaId, paciente_id]
      );
      if (ya) {
        await pool.query("UPDATE estetica_registros SET datos = ?, actualizado_en = NOW() WHERE id = ?", [t, ya.id]);
        const [[r]] = await pool.query("SELECT * FROM estetica_registros WHERE id = ?", [ya.id]);
        return res.json({ ok: true, data: fila(r) });
      }
    }
    const [ins] = await pool.query(
      "INSERT INTO estetica_registros (clinica_id, paciente_id, tipo, datos, creado_por) VALUES (?,?,?,?,?)",
      [clinicaId, paciente_id, tipo, t, req.user.id]
    );
    const [[r]] = await pool.query("SELECT * FROM estetica_registros WHERE id = ?", [ins.insertId]);
    res.status(201).json({ ok: true, data: fila(r) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.put("/:id(\\d+)", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTabla();
    const t = texto(req.body?.datos);
    if (!t) return res.status(400).json({ ok: false, msg: "Los datos son demasiado grandes." });
    const [r] = await pool.query(
      "UPDATE estetica_registros SET datos = ?, actualizado_en = NOW() WHERE id = ? AND clinica_id = ? AND activo = 1",
      [t, req.params.id, clinicaDe(req)]
    );
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "Registro no encontrado." });
    const [[f]] = await pool.query("SELECT * FROM estetica_registros WHERE id = ?", [req.params.id]);
    res.json({ ok: true, data: fila(f) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.delete("/:id(\\d+)", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTabla();
    await pool.query(
      "UPDATE estetica_registros SET activo = 0, actualizado_en = NOW() WHERE id = ? AND clinica_id = ?",
      [req.params.id, clinicaDe(req)]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * Sube lo que el navegador tenía guardado. No duplica (id_local) y solo acepta
 * pacientes de esta clínica (el navegador pudo usarse con otras clínicas).
 * Una ficha local no reemplaza a una ficha que ya esté en el servidor.
 */
router.post("/importar", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTabla();
    const clinicaId = clinicaDe(req);
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 3000) : [];
    const ids = [...new Set(items.map((i) => Number(i.paciente_id)).filter(Boolean))];
    const [mios] = ids.length ? await pool.query("SELECT id FROM pacientes WHERE clinica_id = ? AND id IN (?)", [clinicaId, ids]) : [[]];
    const validos = new Set(mios.map((p) => p.id));
    let subidos = 0, omitidos = 0;
    for (const it of items) {
      const pid = Number(it.paciente_id);
      const t = texto(it.datos);
      const idLocal = String(it.id_local || "").slice(0, 40) || null;
      if (!TIPOS.includes(it.tipo) || !validos.has(pid) || !t || !idLocal) { omitidos++; continue; }
      if (it.tipo === "ficha") {
        const [[ya]] = await pool.query(
          "SELECT id FROM estetica_registros WHERE clinica_id = ? AND paciente_id = ? AND tipo = 'ficha' AND activo = 1 LIMIT 1",
          [clinicaId, pid]
        );
        if (ya) { omitidos++; continue; }
      }
      const fecha = Date.parse(it.datos?.creado_en || it.datos?.actualizado_en || "");
      const [r] = await pool.query(
        `INSERT IGNORE INTO estetica_registros (clinica_id, paciente_id, tipo, datos, id_local, creado_por, creado_en)
         VALUES (?,?,?,?,?,?,?)`,
        [clinicaId, pid, it.tipo, t, idLocal, req.user.id, Number.isFinite(fecha) ? new Date(fecha) : new Date()]
      );
      if (r.affectedRows) subidos++; else omitidos++;
    }
    res.json({ ok: true, subidos, omitidos });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
module.exports.asegurarTabla = asegurarTabla;
