/**
 * Módulo Caja — apertura y cierre de turno con arqueo de efectivo.
 * Un solo turno ABIERTO por clínica a la vez.
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const { zonaClinica, localSql } = require("../utils/zonaHoraria");
const { contextoSucursal, sucursalUnica, condicionUna, filtroSucursal, nombrarPrincipal } = require("../utils/sucursales");

/**
 * Con varias sucursales cada una tiene su propia caja (la sucursal elegida arriba,
 * o la principal si se eligió "todas"). Con una sola sede no cambia nada.
 */
async function cajaDeSucursal(req) {
  const ctx = await contextoSucursal(req);
  const id = await sucursalUnica(req);
  const cond = condicionUna("ct.sucursal_id", id, ctx.principalId);
  return { id, cond, nombre: ctx.lista.find((s) => s.id === id)?.nombre || null };
}

const ROLES = ["RECEPCIONISTA", "MEDICO", "ADMIN", "SUPER_ADMIN"];

async function desgloseTurno(conn, turnoId) {
  const [porMetodo] = await conn.query(
    `SELECT metodo, COUNT(*) AS cantidad, SUM(monto) AS total
     FROM pagos WHERE caja_turno_id=? GROUP BY metodo`,
    [turnoId]
  );
  return porMetodo;
}

/**
 * GET /api/caja/actual
 */
router.get("/actual", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const suc = await cajaDeSucursal(req);
    const [[turno]] = await pool.query(
      `SELECT ct.*, u.nombres AS apertura_nombres, u.apellidos AS apertura_apellidos
       FROM caja_turnos ct
       JOIN usuarios u ON u.id = ct.usuario_apertura_id
       WHERE ct.clinica_id=? AND ct.estado='ABIERTO'${suc.cond.sql} LIMIT 1`,
      [clinicaId, ...suc.cond.params]
    );
    if (!turno) return res.json({ ok: true, data: null, sucursal: suc.nombre });

    const porMetodo = await desgloseTurno(pool, turno.id);
    const efectivo = porMetodo.find(m => m.metodo === "EFECTIVO");
    const esperadoAhora = Number(turno.monto_inicial) + Number(efectivo?.total || 0);

    res.json({ ok: true, data: { ...turno, por_metodo: porMetodo, esperado_ahora: esperadoAhora }, sucursal: suc.nombre });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * POST /api/caja/abrir
 */
router.post("/abrir", auth(...ROLES), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const clinicaId = req.user.clinica_id;
    const montoInicial = Number(req.body.monto_inicial);
    const notas = req.body.notas || null;
    if (!Number.isFinite(montoInicial) || montoInicial < 0) {
      return res.status(400).json({ ok: false, msg: "Monto inicial inválido" });
    }

    const suc = await cajaDeSucursal(req);
    await conn.beginTransaction();

    const [[existente]] = await conn.query(
      `SELECT ct.id FROM caja_turnos ct WHERE ct.clinica_id=? AND ct.estado='ABIERTO'${suc.cond.sql} FOR UPDATE`,
      [clinicaId, ...suc.cond.params]
    );
    if (existente) {
      await conn.rollback();
      return res.status(409).json({ ok: false, msg: "Ya hay un turno de caja abierto" });
    }

    const [r] = await conn.query(
      `INSERT INTO caja_turnos (clinica_id, monto_inicial, notas_apertura, usuario_apertura_id)
       VALUES (?,?,?,?)`,
      [clinicaId, montoInicial, notas, req.user.id]
    );
    if (suc.id) await conn.query("UPDATE caja_turnos SET sucursal_id=? WHERE id=?", [suc.id, r.insertId]);

    await conn.commit();
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    await conn.rollback().catch(() => {});
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/caja/:id/cerrar
 */
router.post("/:id/cerrar", auth(...ROLES), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const clinicaId = req.user.clinica_id;
    const montoContado = Number(req.body.monto_contado);
    const notas = req.body.notas || null;
    if (!Number.isFinite(montoContado) || montoContado < 0) {
      return res.status(400).json({ ok: false, msg: "Monto contado inválido" });
    }

    const [[turno]] = await conn.query(
      "SELECT * FROM caja_turnos WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    if (!turno) return res.status(404).json({ ok: false, msg: "Turno no encontrado" });
    if (turno.estado !== "ABIERTO") {
      return res.status(409).json({ ok: false, msg: "Este turno ya está cerrado" });
    }

    const [[{ efectivo }]] = await conn.query(
      `SELECT COALESCE(SUM(monto),0) AS efectivo FROM pagos
       WHERE caja_turno_id=? AND metodo='EFECTIVO'`,
      [turno.id]
    );
    const montoEsperado = Number(turno.monto_inicial) + Number(efectivo);
    const diferencia = montoContado - montoEsperado;

    await conn.query(
      `UPDATE caja_turnos
       SET estado='CERRADO', monto_esperado=?, monto_contado=?, diferencia=?,
           notas_cierre=?, usuario_cierre_id=?, cerrado_en=NOW()
       WHERE id=?`,
      [montoEsperado, montoContado, diferencia, notas, req.user.id, turno.id]
    );

    const [[actualizado]] = await conn.query("SELECT * FROM caja_turnos WHERE id=?", [turno.id]);
    res.json({ ok: true, data: actualizado });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/caja/historial
 */
router.get("/historial", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const { desde, hasta, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT ct.*, s.nombre AS sucursal_nombre,
             ua.nombres AS apertura_nombres, ua.apellidos AS apertura_apellidos,
             uc.nombres AS cierre_nombres, uc.apellidos AS cierre_apellidos
      FROM caja_turnos ct
      JOIN usuarios ua ON ua.id = ct.usuario_apertura_id
      LEFT JOIN usuarios uc ON uc.id = ct.usuario_cierre_id
      LEFT JOIN sucursales s ON s.id = ct.sucursal_id
      WHERE ct.clinica_id=? AND ct.estado='CERRADO'`;
    const params = [clinicaId];
    const fs = await filtroSucursal(req, "ct.sucursal_id");
    sql += fs.sql; params.push(...fs.params);
    // Fecha del cierre en hora de la clínica (un cierre a las 7 p. m. es de ese día, no del siguiente)
    const CL = localSql("ct.cerrado_en", await zonaClinica(clinicaId));
    if (desde) { sql += ` AND DATE(${CL}) >= ?`; params.push(desde); }
    if (hasta) { sql += ` AND DATE(${CL}) <= ?`; params.push(hasta); }
    sql += " ORDER BY ct.cerrado_en DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    await nombrarPrincipal(req, rows);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/caja/:id
 */
router.get("/:id", auth(...ROLES), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const [[turno]] = await pool.query(
      `SELECT ct.*,
              ua.nombres AS apertura_nombres, ua.apellidos AS apertura_apellidos,
              uc.nombres AS cierre_nombres, uc.apellidos AS cierre_apellidos
       FROM caja_turnos ct
       JOIN usuarios ua ON ua.id = ct.usuario_apertura_id
       LEFT JOIN usuarios uc ON uc.id = ct.usuario_cierre_id
       WHERE ct.id=? AND ct.clinica_id=?`,
      [req.params.id, clinicaId]
    );
    if (!turno) return res.status(404).json({ ok: false, msg: "Turno no encontrado" });

    const porMetodo = await desgloseTurno(pool, turno.id);

    const [pagos] = await pool.query(
      `SELECT p.id, p.metodo, p.monto, p.referencia, p.registrado_en,
              f.id AS factura_id, f.numero_completo, f.numero,
              pac.nombres AS pac_nombres, pac.apellidos AS pac_apellidos
       FROM pagos p
       JOIN facturas f ON f.id = p.factura_id
       JOIN pacientes pac ON pac.id = f.paciente_id
       WHERE p.caja_turno_id=?
       ORDER BY p.registrado_en ASC`,
      [turno.id]
    );

    res.json({ ok: true, data: { ...turno, por_metodo: porMetodo, pagos } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
