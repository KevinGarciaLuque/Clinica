/**
 * utils/permisoFinanzas.js
 * Quién puede ver Finanzas (gastos, ganancias, cuentas por cobrar):
 *  - ADMIN y SUPER_ADMIN: siempre (salvo que la clínica apague el módulo; si no tiene
 *    ajuste propio, sigue a Facturación).
 *  - MEDICO / PSICOLOGO: solo si la clínica no tiene un ADMIN activo (es el dueño),
 *    o si se le activó a esa persona en sus permisos de módulos.
 *  - RECEPCIONISTA / ENFERMERA: no.
 */
const pool = require("../db");

async function puedeVerFinanzas(user) {
  if (!user) return false;
  if (user.super || user.tipo === "SUPER_ADMIN") return true;
  if (!["ADMIN", "MEDICO", "PSICOLOGO"].includes(user.tipo)) return false;

  const [[o]] = await pool.query(
    `SELECT cm.habilitado AS clinica, um.habilitado AS usuario
     FROM modulos_sistema ms
     LEFT JOIN clinica_modulos cm ON cm.clinica_id = ? AND cm.modulo_id = ms.id
     LEFT JOIN usuario_modulos um ON um.usuario_id = ? AND um.modulo_id = ms.id
     WHERE ms.clave = 'finanzas' LIMIT 1`,
    [user.clinica_id, user.id]
  );
  if (o && o.usuario != null) return Number(o.usuario) === 1;
  if (o && o.clinica != null) {
    if (Number(o.clinica) === 0) return false;
  } else {
    // Sin ajuste propio: sigue a Facturación (si la clínica no tiene Facturación, tampoco Finanzas)
    const [[f]] = await pool.query(
      `SELECT cm.habilitado FROM modulos_sistema ms
       JOIN clinica_modulos cm ON cm.clinica_id = ? AND cm.modulo_id = ms.id
       WHERE ms.clave = 'facturacion' LIMIT 1`,
      [user.clinica_id]
    );
    if (f && Number(f.habilitado) === 0) return false;
  }
  if (user.tipo === "ADMIN") return true;

  const [[a]] = await pool.query(
    "SELECT COUNT(*) AS n FROM usuarios WHERE clinica_id = ? AND tipo = 'ADMIN' AND activo = 1",
    [user.clinica_id]
  );
  return Number(a?.n || 0) === 0;
}

function requireFinanzas() {
  return async (req, res, next) => {
    try {
      if (await puedeVerFinanzas(req.user)) return next();
      res.status(403).json({ ok: false, msg: "No tiene permiso para ver las finanzas de la clínica.", modulo_bloqueado: true });
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  };
}

module.exports = { puedeVerFinanzas, requireFinanzas };
