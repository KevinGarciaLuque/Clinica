/**
 * routes/inventario.js
 * Control de stock de insumos, medicamentos y materiales
 *
 * GET    /api/inventario              → lista de ítems (filtros: categoria, bajo_stock, q)
 * GET    /api/inventario/categorias   → categorías en uso
 * GET    /api/inventario/:id          → detalle de ítem
 * GET    /api/inventario/:id/movimientos → historial de movimientos
 * POST   /api/inventario              → crear ítem
 * PUT    /api/inventario/:id          → actualizar ítem
 * POST   /api/inventario/:id/movimiento → registrar entrada/salida/ajuste
 * DELETE /api/inventario/:id          → eliminar ítem (solo ADMIN/SUPER_ADMIN)
 *
 * Lotes (tabla nueva inventario_lotes; el stock total del ítem sigue igual):
 * GET    /api/inventario/para-procedimiento → productos activos con sus lotes (pestaña Estética)
 * GET    /api/inventario/lotes/alertas      → lotes vencidos o por vencer (60 días) con existencia
 * GET    /api/inventario/lotes/trazabilidad?lote=  → a qué pacientes se aplicó un lote
 * GET    /api/inventario/:id/lotes          → lotes de un ítem
 * La ENTRADA puede traer { lote, vence } y la SALIDA { lote_id }.
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const clinicaOf = (req) =>
  req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;

let lotesListos = null;
/** Tabla de lotes y columna opcional lote_id en los movimientos (aditivo) */
function asegurarLotes() {
  if (!lotesListos) {
    lotesListos = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventario_lotes (
          id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          clinica_id INT UNSIGNED NOT NULL,
          item_id    INT UNSIGNED NOT NULL,
          lote       VARCHAR(80) NOT NULL,
          vence      DATE NULL,
          cantidad   DECIMAL(10,2) NOT NULL DEFAULT 0,
          creado_en  DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_lote_item (item_id, lote),
          INDEX idx_lote_clinica (clinica_id, vence)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      const [col] = await pool.query("SHOW COLUMNS FROM inventario_movimientos LIKE 'lote_id'");
      if (!col.length) await pool.query("ALTER TABLE inventario_movimientos ADD COLUMN lote_id INT UNSIGNED NULL");
    })().catch((e) => { lotesListos = null; throw e; });
  }
  return lotesListos;
}

// ── GET / (lista) ─────────────────────────────────────────────────────────────
router.get("/", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.json({ ok: true, data: [] });

    const { q, categoria, bajo_stock, activo = "1" } = req.query;
    const params = [cid];
    let where = "clinica_id = ?";

    if (activo !== "all") { where += " AND activo = ?"; params.push(Number(activo)); }
    if (categoria)        { where += " AND categoria = ?"; params.push(categoria); }
    if (bajo_stock === "1") { where += " AND stock_actual <= stock_minimo"; }
    if (q)                { where += " AND (nombre LIKE ? OR codigo LIKE ?)"; params.push(`%${q}%`, `%${q}%`); }

    const [rows] = await pool.query(
      `SELECT id, nombre, descripcion, categoria, unidad_medida,
              stock_actual, stock_minimo, precio_costo, proveedor, codigo, activo, creado_en
       FROM inventario_items
       WHERE ${where}
       ORDER BY categoria, nombre`,
      params
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /categorias ───────────────────────────────────────────────────────────
router.get("/categorias", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [rows] = await pool.query(
      "SELECT DISTINCT categoria FROM inventario_items WHERE clinica_id = ? AND categoria IS NOT NULL ORDER BY categoria",
      [cid]
    );
    res.json({ ok: true, data: rows.map(r => r.categoria) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /para-procedimiento: productos con sus lotes disponibles ─────────────
router.get("/para-procedimiento", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.json({ ok: true, data: [] });
    await asegurarLotes();
    const [items] = await pool.query(
      `SELECT id, nombre, categoria, unidad_medida, stock_actual FROM inventario_items
       WHERE clinica_id = ? AND activo = 1 ORDER BY nombre`, [cid]);
    const [lotes] = await pool.query(
      `SELECT id, item_id, lote, DATE_FORMAT(vence,'%Y-%m-%d') AS vence, cantidad FROM inventario_lotes
       WHERE clinica_id = ? AND cantidad > 0 ORDER BY vence IS NULL, vence, id`, [cid]);
    res.json({ ok: true, data: items.map((it) => ({ ...it, lotes: lotes.filter((l) => l.item_id === it.id) })) });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /lotes/alertas: vencidos o por vencer, con existencia ────────────────
router.get("/lotes/alertas", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.json({ ok: true, data: [] });
    await asegurarLotes();
    const dias = Math.min(Math.max(Number(req.query.dias) || 60, 1), 365);
    const [rows] = await pool.query(
      `SELECT l.id, l.item_id, l.lote, DATE_FORMAT(l.vence,'%Y-%m-%d') AS vence, l.cantidad,
              i.nombre, i.unidad_medida, DATEDIFF(l.vence, CURDATE()) AS dias
       FROM inventario_lotes l JOIN inventario_items i ON i.id = l.item_id
       WHERE l.clinica_id = ? AND l.cantidad > 0 AND l.vence IS NOT NULL
         AND l.vence <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY l.vence`, [cid, dias]);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /lotes/trazabilidad?lote=: pacientes a los que se aplicó ─────────────
router.get("/lotes/trazabilidad", auth("SUPER_ADMIN", "ADMIN", "MEDICO", "ENFERMERA"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const lote = String(req.query.lote || "").trim();
    if (!cid || lote.length < 2) return res.json({ ok: true, data: [] });
    const { asegurarAplicaciones } = require("./esteticaDatos");
    await asegurarAplicaciones();
    const [rows] = await pool.query(
      `SELECT a.id, a.paciente_id, a.historia_id, a.producto, a.lote, a.vence, a.cantidad, a.unidad,
              DATE_FORMAT(a.fecha,'%Y-%m-%d') AS fecha, p.nombres, p.apellidos, p.telefono
       FROM estetica_aplicaciones a JOIN pacientes p ON p.id = a.paciente_id
       WHERE a.clinica_id = ? AND a.lote LIKE ?
       ORDER BY a.fecha DESC, a.id DESC LIMIT 500`, [cid, `%${lote}%`]);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /:id/lotes ────────────────────────────────────────────────────────────
router.get("/:id/lotes", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    await asegurarLotes();
    const [rows] = await pool.query(
      `SELECT id, lote, DATE_FORMAT(vence,'%Y-%m-%d') AS vence, cantidad, creado_en,
              DATEDIFF(vence, CURDATE()) AS dias
       FROM inventario_lotes WHERE item_id = ? AND clinica_id = ?
       ORDER BY cantidad <= 0, vence IS NULL, vence`, [req.params.id, cid]);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /:id (detalle) ────────────────────────────────────────────────────────
router.get("/:id", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [[row]] = await pool.query(
      "SELECT * FROM inventario_items WHERE id = ? AND clinica_id = ?",
      [req.params.id, cid]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Ítem no encontrado" });
    res.json({ ok: true, data: row });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /:id/movimientos ──────────────────────────────────────────────────────
router.get("/:id/movimientos", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { page = 1 } = req.query;
    const limit  = 30;
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT m.id, m.tipo, m.cantidad, m.stock_antes, m.stock_despues,
              m.motivo, m.referencia, m.creado_en,
              u.nombres AS usu_nombres, u.apellidos AS usu_apellidos
       FROM inventario_movimientos m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.item_id = ? AND m.clinica_id = ?
       ORDER BY m.creado_en DESC
       LIMIT ? OFFSET ?`,
      [req.params.id, cid, limit, offset]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST / (crear ítem) ───────────────────────────────────────────────────────
router.post("/", auth("SUPER_ADMIN", "ADMIN", "MEDICO"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.status(400).json({ ok: false, msg: "Clínica requerida" });

    const { nombre, descripcion, categoria, unidad_medida, stock_actual,
            stock_minimo, precio_costo, proveedor, codigo } = req.body;

    if (!nombre) return res.status(400).json({ ok: false, msg: "El nombre es obligatorio" });

    const [r] = await pool.query(
      `INSERT INTO inventario_items
        (clinica_id, nombre, descripcion, categoria, unidad_medida,
         stock_actual, stock_minimo, precio_costo, proveedor, codigo)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [cid, nombre, descripcion || null, categoria || null,
       unidad_medida || "unidad", stock_actual || 0, stock_minimo || 0,
       precio_costo || null, proveedor || null, codigo || null]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY")
      return res.status(409).json({ ok: false, msg: "Ya existe un ítem con ese código" });
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /:id (actualizar ítem) ────────────────────────────────────────────────
router.put("/:id", auth("SUPER_ADMIN", "ADMIN", "MEDICO"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const { nombre, descripcion, categoria, unidad_medida,
            stock_minimo, precio_costo, proveedor, codigo, activo } = req.body;

    const [r] = await pool.query(
      `UPDATE inventario_items
       SET nombre=?, descripcion=?, categoria=?, unidad_medida=?,
           stock_minimo=?, precio_costo=?, proveedor=?, codigo=?, activo=?
       WHERE id=? AND clinica_id=?`,
      [nombre, descripcion || null, categoria || null, unidad_medida || "unidad",
       stock_minimo || 0, precio_costo || null, proveedor || null, codigo || null,
       activo !== undefined ? Number(activo) : 1,
       req.params.id, cid]
    );
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "Ítem no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY")
      return res.status(409).json({ ok: false, msg: "Ya existe un ítem con ese código" });
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /:id/movimiento (entrada / salida / ajuste) ──────────────────────────
router.post("/:id/movimiento", auth("SUPER_ADMIN", "ADMIN", "MEDICO", "RECEPCIONISTA"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const cid = clinicaOf(req);
    const { tipo, cantidad, motivo, referencia } = req.body;
    const loteTxt = String(req.body.lote || "").trim().slice(0, 80);
    // "2027-03" (como viene en la caja) = vence el último día de ese mes
    const finDeMes = (ym) => { const [y, m] = ym.split("-").map(Number); return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; };
    const vence = /^\d{4}-\d{2}(-\d{2})?$/.test(req.body.vence || "") ? (req.body.vence.length === 7 ? finDeMes(req.body.vence) : req.body.vence) : null;
    const loteId = Number(req.body.lote_id) || null;
    if (loteTxt || loteId) await asegurarLotes();

    if (!["ENTRADA", "SALIDA", "AJUSTE"].includes(tipo))
      return res.status(400).json({ ok: false, msg: "tipo debe ser ENTRADA, SALIDA o AJUSTE" });
    if (!cantidad || isNaN(cantidad) || Number(cantidad) <= 0)
      return res.status(400).json({ ok: false, msg: "cantidad debe ser un número positivo" });

    const [[item]] = await conn.query(
      "SELECT id, stock_actual FROM inventario_items WHERE id = ? AND clinica_id = ? FOR UPDATE",
      [req.params.id, cid]
    );
    if (!item) { await conn.rollback(); return res.status(404).json({ ok: false, msg: "Ítem no encontrado" }); }

    const cant = Number(cantidad);
    const antes = Number(item.stock_actual);
    let despues;

    if (tipo === "ENTRADA")  despues = antes + cant;
    else if (tipo === "SALIDA")  {
      if (antes < cant) { await conn.rollback(); return res.status(409).json({ ok: false, msg: "Stock insuficiente" }); }
      despues = antes - cant;
    } else {
      // AJUSTE: cantidad es el nuevo stock absoluto
      despues = cant;
    }

    // Lote: la entrada suma al lote (lo crea si es nuevo); la salida le resta
    let idLote = null;
    if (tipo === "ENTRADA" && loteTxt) {
      await conn.query(
        `INSERT INTO inventario_lotes (clinica_id, item_id, lote, vence, cantidad) VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad), vence = COALESCE(VALUES(vence), vence)`,
        [cid, item.id, loteTxt, vence, cant]);
      const [[l]] = await conn.query("SELECT id FROM inventario_lotes WHERE item_id = ? AND lote = ?", [item.id, loteTxt]);
      idLote = l?.id || null;
    } else if (tipo === "SALIDA" && loteId) {
      const [u] = await conn.query(
        "UPDATE inventario_lotes SET cantidad = GREATEST(cantidad - ?, 0) WHERE id = ? AND item_id = ? AND clinica_id = ?",
        [cant, loteId, item.id, cid]);
      if (u.affectedRows) idLote = loteId;
    }

    await conn.query(
      "UPDATE inventario_items SET stock_actual = ? WHERE id = ?",
      [despues, item.id]
    );
    const [r] = await conn.query(
      `INSERT INTO inventario_movimientos
         (clinica_id, item_id, usuario_id, tipo, cantidad, stock_antes, stock_despues, motivo, referencia)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [cid, item.id, req.user.id, tipo, cant, antes, despues, motivo || null, referencia || null]
    );
    if (idLote) await conn.query("UPDATE inventario_movimientos SET lote_id = ? WHERE id = ?", [idLote, r.insertId]);

    await conn.commit();
    res.status(201).json({ ok: true, id: r.insertId, stock_despues: despues });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", auth("SUPER_ADMIN", "ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [r] = await pool.query(
      "DELETE FROM inventario_items WHERE id = ? AND clinica_id = ?",
      [req.params.id, cid]
    );
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "Ítem no encontrado" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
module.exports.asegurarLotes = asegurarLotes;
