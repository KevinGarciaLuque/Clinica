const db = require("../db");

async function tieneModuloHabilitado(clinicaId, usuarioId, moduloClave) {
  if (!clinicaId || !usuarioId || !moduloClave) return false;

  const [rows] = await db.query(
    `
    SELECT
      ms.id AS modulo_id,
      IFNULL(cm.habilitado, 1) AS habilitado_clinica,
      um.habilitado AS habilitado_usuario
    FROM modulos_sistema ms
    LEFT JOIN clinica_modulos cm
      ON cm.clinica_id = ? AND cm.modulo_id = ms.id
    LEFT JOIN usuario_modulos um
      ON um.usuario_id = ? AND um.modulo_id = ms.id
    WHERE ms.clave = ? AND ms.disponible = 1
    LIMIT 1
    `,
    [clinicaId, usuarioId, moduloClave]
  );

  if (!rows.length) return false;
  const r = rows[0];
  if (r.habilitado_usuario !== null && r.habilitado_usuario !== undefined) {
    return Number(r.habilitado_usuario) === 1;
  }
  return Number(r.habilitado_clinica) === 1;
}

function requireModulo(moduloClave) {
  return async (req, res, next) => {
    try {
      if (req.user?.super) return next();
      const ok = await tieneModuloHabilitado(req.user?.clinica_id, req.user?.id, moduloClave);
      if (!ok) {
        return res.status(403).json({
          ok: false,
          msg: `Módulo '${moduloClave}' no habilitado para este usuario`,
          modulo_bloqueado: true,
        });
      }
      return next();
    } catch (e) {
      console.error("[requireModulo]", e);
      return res.status(500).json({ ok: false, msg: "Error validando permisos de módulo" });
    }
  };
}

module.exports = { requireModulo, tieneModuloHabilitado };

