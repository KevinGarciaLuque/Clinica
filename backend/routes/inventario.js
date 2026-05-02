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
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const clinicaOf = (req) =>
  req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;

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
