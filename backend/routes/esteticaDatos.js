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
 *  GET    /api/estetica-datos/historia/:hid        → registro estético de esa consulta (o null)
 *  PUT    /api/estetica-datos/historia/:hid        → { tipo, datos } crea o actualiza el de esa consulta
 *
 * Desde la pestaña «Estética» de la consulta se guarda un registro por consulta:
 * «valoracion», «procedimiento» o «seguimiento» (el control post-procedimiento
 * usa los mismos campos que la pantalla de Seguimiento post-op, así aparece allí).
 */
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");

const ROLES = ["ADMIN", "MEDICO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"];
const TIPOS = ["ficha", "presupuesto", "consentimiento", "seguimiento", "valoracion", "procedimiento"];
const TIPOS_CONSULTA = ["valoracion", "procedimiento", "seguimiento"];

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
  // Consulta (historia clínica) en la que se registró, si vino de la consulta
  const [col] = await pool.query("SHOW COLUMNS FROM estetica_registros LIKE 'historia_id'");
  if (!col.length) {
    await pool.query("ALTER TABLE estetica_registros ADD COLUMN historia_id INT UNSIGNED NULL AFTER paciente_id, ADD INDEX idx_est_historia (historia_id)");
  }
  tablaLista = true;
}

const clinicaDe = (req) => (req.user.super ? req.tenant?.clinica_id : req.user.clinica_id);
const leer = (t) => { try { return JSON.parse(t); } catch { return {}; } };
const texto = (datos) => {
  const t = JSON.stringify(datos && typeof datos === "object" ? datos : {});
  return t.length > 500000 ? null : t;
};
const fila = (r) => ({
  id: r.id, paciente_id: r.paciente_id, historia_id: r.historia_id || null, tipo: r.tipo, datos: leer(r.datos),
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

async function historiaDeClinica(hid, clinicaId) {
  const [[h]] = await pool.query("SELECT id, paciente_id, medico_id FROM historias_clinicas WHERE id = ? AND clinica_id = ?", [hid, clinicaId]);
  return h || null;
}

// ═════════════════════════════════════════════════════════════════════════════
// Productos aplicados (trazabilidad por lote) + descuento del inventario
// ═════════════════════════════════════════════════════════════════════════════
let aplicacionesListas = null;
function asegurarAplicaciones() {
  if (!aplicacionesListas) {
    aplicacionesListas = pool.query(`
      CREATE TABLE IF NOT EXISTS estetica_aplicaciones (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        clinica_id  INT UNSIGNED NOT NULL,
        paciente_id INT UNSIGNED NOT NULL,
        historia_id INT UNSIGNED NULL,
        registro_id INT UNSIGNED NOT NULL,
        item_id     INT UNSIGNED NULL,
        lote_id     INT UNSIGNED NULL,
        producto    VARCHAR(200) NULL,
        lote        VARCHAR(80) NULL,
        vence       VARCHAR(10) NULL,
        cantidad    DECIMAL(10,2) NOT NULL DEFAULT 0,
        unidad      VARCHAR(20) NULL,
        fecha       DATE NULL,
        creado_en   DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_apl_lote (clinica_id, lote),
        INDEX idx_apl_registro (registro_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch((e) => { aplicacionesListas = null; throw e; });
  }
  return aplicacionesListas;
}

const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };

/**
 * Deja el inventario y la trazabilidad iguales a lo que dice el registro:
 * calcula la diferencia con lo ya descontado para este registro y solo mueve eso
 * (guardar varias veces no descuenta de nuevo; quitar un producto lo devuelve).
 */
async function sincronizarAplicaciones({ reg, datos, tipo, clinicaId, usuarioId, pacienteNombre }) {
  await asegurarAplicaciones();
  const avisos = [];
  const fecha = String(datos?.creado_en || reg.creado_en?.toISOString?.() || "").slice(0, 10) || null;
  const deseadas = tipo === "procedimiento"
    ? (Array.isArray(datos?.productos) ? datos.productos : []).filter((p) => p && (p.producto || p.lote)).map((p) => ({
        item_id: Number(p.item_id) || null, lote_id: Number(p.lote_id) || null,
        producto: String(p.producto || "").slice(0, 200) || null, lote: String(p.lote || "").trim().slice(0, 80) || null,
        vence: String(p.vence || "").slice(0, 10) || null, cantidad: num(p.cantidad), unidad: String(datos.unidad || "").slice(0, 20) || null,
      }))
    : [];

  // Inventario (si la clínica lo usa)
  let hayInventario = true;
  try { await require("./inventario").asegurarLotes(); } catch { hayInventario = false; }
  if (hayInventario) {
    const [ya] = await pool.query(
      `SELECT item_id, lote_id, SUM(cantidad) AS cantidad FROM estetica_aplicaciones
       WHERE registro_id = ? AND item_id IS NOT NULL GROUP BY item_id, lote_id`, [reg.id]);
    const clave = (i, l) => `${i}|${l || 0}`;
    const delta = new Map();
    for (const a of ya) delta.set(clave(a.item_id, a.lote_id), -Number(a.cantidad));
    for (const d of deseadas) if (d.item_id) delta.set(clave(d.item_id, d.lote_id), (delta.get(clave(d.item_id, d.lote_id)) || 0) + d.cantidad);
    for (const [k, cant] of delta) {
      if (Math.abs(cant) < 0.001) continue;
      const [itemId, loteId] = k.split("|").map(Number);
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [[item]] = await conn.query(
          "SELECT id, nombre, unidad_medida, stock_actual FROM inventario_items WHERE id = ? AND clinica_id = ? FOR UPDATE", [itemId, clinicaId]);
        if (!item) { await conn.rollback(); continue; }
        const antes = Number(item.stock_actual);
        const despues = Math.round((antes - cant) * 100) / 100;
        await conn.query("UPDATE inventario_items SET stock_actual = ? WHERE id = ?", [despues, itemId]);
        if (loteId) await conn.query("UPDATE inventario_lotes SET cantidad = GREATEST(cantidad - ?, 0) WHERE id = ? AND item_id = ?", [cant, loteId, itemId]);
        const [mv] = await conn.query(
          `INSERT INTO inventario_movimientos (clinica_id, item_id, usuario_id, tipo, cantidad, stock_antes, stock_despues, motivo, referencia)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [clinicaId, itemId, usuarioId, cant > 0 ? "SALIDA" : "ENTRADA", Math.abs(cant), antes, despues,
           `${cant > 0 ? "Aplicado" : "Devuelto (se corrigió el registro)"}: ${datos?.nombre || "procedimiento"} — ${pacienteNombre}`.slice(0, 300),
           reg.historia_id ? `Consulta #${reg.historia_id}` : null]);
        if (loteId) await conn.query("UPDATE inventario_movimientos SET lote_id = ? WHERE id = ?", [loteId, mv.insertId]);
        await conn.commit();
        if (despues < 0) avisos.push(`El inventario de «${item.nombre}» quedó en ${despues} ${item.unidad_medida}: revise el stock.`);
      } catch (e) {
        await conn.rollback().catch(() => {});
        avisos.push("No se pudo descontar un producto del inventario.");
        console.error("[estetica] inventario:", e.message);
      } finally {
        conn.release();
      }
    }
  }

  // Trazabilidad: lo aplicado en este registro (también productos escritos a mano)
  await pool.query("DELETE FROM estetica_aplicaciones WHERE registro_id = ?", [reg.id]);
  if (deseadas.length) {
    await pool.query(
      `INSERT INTO estetica_aplicaciones (clinica_id, paciente_id, historia_id, registro_id, item_id, lote_id, producto, lote, vence, cantidad, unidad, fecha) VALUES ?`,
      [deseadas.map((d) => [clinicaId, reg.paciente_id, reg.historia_id || null, reg.id, d.item_id, d.lote_id, d.producto, d.lote, d.vence, d.cantidad, d.unidad, fecha])]);
  }
  return avisos;
}

/**
 * Mantenimiento (toxina cada 4 meses, relleno cada 9…): se programa como un
 * «control programado» (routes/controles.js): 7 días antes el paciente recibe el
 * correo para agendar y la clínica lo ve en la lista de Controles.
 * Devuelve los datos con mantenimiento_control_id / mantenimiento_fecha al día.
 */
async function sincronizarMantenimiento({ reg, datos, tipo, clinicaId, usuarioId, medicoId }) {
  const controles = require("./controles");
  await controles.asegurarTabla();
  const meses = tipo === "procedimiento" ? Math.min(Number(datos?.mantenimiento_meses) || 0, 36) : 0;
  const ctrlId = Number(datos?.mantenimiento_control_id) || null;
  const nuevo = { ...datos };
  if (meses > 0) {
    const dayjs = require("dayjs");
    const base = String(datos?.creado_en || "").slice(0, 10) || dayjs().format("YYYY-MM-DD");
    const fecha = dayjs(base).add(meses, "month").format("YYYY-MM-DD");
    const motivo = `Mantenimiento: ${datos?.nombre || "procedimiento estético"}`.slice(0, 200);
    let vigente = false;
    if (ctrlId) {
      const [[c]] = await pool.query("SELECT id, estado, DATE_FORMAT(fecha_objetivo,'%Y-%m-%d') AS f FROM controles_programados WHERE id = ? AND clinica_id = ?", [ctrlId, clinicaId]);
      if (c) {
        vigente = true;
        if (["PENDIENTE", "AVISADO"].includes(c.estado)) {
          await pool.query(
            `UPDATE controles_programados SET motivo = ?, fecha_objetivo = ?,
               estado = IF(fecha_objetivo = ?, estado, 'PENDIENTE'), avisado_en = IF(fecha_objetivo = ?, avisado_en, NULL)
             WHERE id = ?`, [motivo, fecha, fecha, fecha, ctrlId]);
        }
      }
    }
    if (!vigente) {
      // El paciente volvió a hacerse el mismo procedimiento: el mantenimiento anterior ya se cumplió
      await pool.query(
        `UPDATE controles_programados SET estado = 'CANCELADO'
         WHERE clinica_id = ? AND paciente_id = ? AND origen = 'ESTETICA_MANT' AND motivo = ? AND estado IN ('PENDIENTE','AVISADO')`,
        [clinicaId, reg.paciente_id, motivo]);
      const [ins] = await pool.query(
        `INSERT INTO controles_programados (clinica_id, paciente_id, medico_id, fecha_objetivo, motivo, creado_por, origen)
         VALUES (?,?,?,?,?,?, 'ESTETICA_MANT')`,
        [clinicaId, reg.paciente_id, medicoId || usuarioId, fecha, motivo, usuarioId]);
      nuevo.mantenimiento_control_id = ins.insertId;
    }
    nuevo.mantenimiento_fecha = fecha;
  } else {
    if (ctrlId) {
      await pool.query(
        "UPDATE controles_programados SET estado = 'CANCELADO' WHERE id = ? AND clinica_id = ? AND estado IN ('PENDIENTE','AVISADO')",
        [ctrlId, clinicaId]);
    }
    delete nuevo.mantenimiento_control_id;
    delete nuevo.mantenimiento_fecha;
  }
  return nuevo;
}

router.get("/historia/:hid(\\d+)", auth(...ROLES), async (req, res) => {
  try {
    await asegurarTabla();
    const clinicaId = clinicaDe(req);
    const [[r]] = await pool.query(
      "SELECT * FROM estetica_registros WHERE historia_id = ? AND clinica_id = ? AND activo = 1 ORDER BY id DESC LIMIT 1",
      [req.params.hid, clinicaId]
    );
    res.json({ ok: true, data: r ? fila(r) : null });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.put("/historia/:hid(\\d+)", auth("ADMIN", "MEDICO", "ENFERMERA", "SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTabla();
    const clinicaId = clinicaDe(req);
    const { tipo, datos } = req.body || {};
    if (!TIPOS_CONSULTA.includes(tipo)) return res.status(400).json({ ok: false, msg: "Tipo de visita no válido." });
    const h = await historiaDeClinica(req.params.hid, clinicaId);
    if (!h) return res.status(404).json({ ok: false, msg: "Consulta no encontrada." });
    const t = texto(datos);
    if (!t) return res.status(400).json({ ok: false, msg: "Los datos son demasiado grandes." });
    const [[ya]] = await pool.query(
      "SELECT id, datos FROM estetica_registros WHERE historia_id = ? AND clinica_id = ? AND activo = 1 ORDER BY id DESC LIMIT 1",
      [h.id, clinicaId]
    );
    // Si la pantalla no trae el mantenimiento ya programado, se conserva el que había
    const previo = ya ? leer(ya.datos) : {};
    if (previo.mantenimiento_control_id && !datos?.mantenimiento_control_id && datos && typeof datos === "object") {
      datos.mantenimiento_control_id = previo.mantenimiento_control_id;
    }
    let id;
    if (ya) {
      // Si se cambia el tipo de visita, el mismo registro cambia de tipo
      await pool.query("UPDATE estetica_registros SET tipo = ?, datos = ?, actualizado_en = NOW() WHERE id = ?", [tipo, t, ya.id]);
      id = ya.id;
    } else {
      const [ins] = await pool.query(
        "INSERT INTO estetica_registros (clinica_id, paciente_id, historia_id, tipo, datos, creado_por) VALUES (?,?,?,?,?,?)",
        [clinicaId, h.paciente_id, h.id, tipo, t, req.user.id]
      );
      id = ins.insertId;
    }
    let [[r]] = await pool.query("SELECT * FROM estetica_registros WHERE id = ?", [id]);

    // Inventario, trazabilidad por lote y mantenimiento (no impiden guardar la consulta)
    const avisos = [];
    try {
      const [[pac]] = await pool.query("SELECT nombres, apellidos FROM pacientes WHERE id = ?", [h.paciente_id]);
      const pacienteNombre = pac ? `${pac.nombres} ${pac.apellidos || ""}`.trim() : "paciente";
      avisos.push(...await sincronizarAplicaciones({ reg: r, datos, tipo, clinicaId, usuarioId: req.user.id, pacienteNombre }));
      const conMant = await sincronizarMantenimiento({ reg: r, datos, tipo, clinicaId, usuarioId: req.user.id, medicoId: h.medico_id });
      const t2 = texto(conMant);
      if (t2 && t2 !== t) {
        await pool.query("UPDATE estetica_registros SET datos = ? WHERE id = ?", [t2, id]);
        [[r]] = await pool.query("SELECT * FROM estetica_registros WHERE id = ?", [id]);
      }
    } catch (e) {
      console.error("[estetica] después de guardar:", e.message);
      avisos.push("La consulta se guardó, pero no se pudo actualizar el inventario o el mantenimiento.");
    }
    res.json({ ok: true, data: fila(r), avisos });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
module.exports.asegurarTabla = asegurarTabla;
module.exports.asegurarAplicaciones = asegurarAplicaciones;
