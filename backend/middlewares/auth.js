/**
 * middlewares/auth.js
 * Middleware de autenticación JWT + control de roles
 * Uso:
 *   router.get("/ruta", auth(), handler)                        → cualquier usuario autenticado
 *   router.get("/ruta", auth("MEDICO","ADMIN"), handler)        → solo esos roles
 *   router.get("/ruta", auth("SUPER_ADMIN"), handler)           → solo super admin
 */

const jwt = require("jsonwebtoken");
const pool = require("../db");

/**
 * @param {...string} roles - Roles permitidos. Si no se pasa ninguno, acepta cualquier rol autenticado.
 */
function auth(...roles) {
  return async (req, res, next) => {
    try {
      // 1. Obtener token del header Authorization: Bearer <token>
      const header = req.headers.authorization || "";
      if (!header.startsWith("Bearer ")) {
        return res.status(401).json({ ok: false, msg: "Token requerido" });
      }

      const token = header.slice(7);

      // 2. Verificar firma
      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ ok: false, msg: "Token inválido o expirado" });
      }

      // 3. Verificar que el usuario sigue activo en la BD
      const [rows] = await pool.query(
        "SELECT id, clinica_id, tipo, activo FROM usuarios WHERE id=? LIMIT 1",
        [payload.uid]
      );

      if (!rows.length || !rows[0].activo) {
        return res.status(401).json({ ok: false, msg: "Usuario inactivo o no existe" });
      }

      const user = rows[0];

      // 4. Verificar rol si se especificaron restricciones
      if (roles.length > 0 && !roles.includes(user.tipo)) {
        return res.status(403).json({
          ok: false,
          msg: `Acceso denegado. Requiere: ${roles.join(", ")}`,
        });
      }

      // 5. Para usuarios que NO son SUPER_ADMIN, verificar que el tenant coincida
      if (user.tipo !== "SUPER_ADMIN") {
        const tenantId = req.tenant?.clinica_id;

        // Si el tenant viene por header y no coincide con el del token → bloquear
        if (tenantId && Number(tenantId) !== Number(user.clinica_id)) {
          return res.status(403).json({
            ok: false,
            msg: "No tienes acceso a esta clínica",
          });
        }

        // Asegurarnos de que req.tenant siempre tenga el clinica_id correcto
        if (!tenantId) {
          req.tenant = {
            ...(req.tenant || {}),
            clinica_id: user.clinica_id,
          };
        }
      }

      // 6. Verificar licencia para usuarios de clínica (no SUPER_ADMIN)
      // Excluir la ruta de solicitar-licencia para que clínicas vencidas puedan enviar solicitud
      const esSolicitudLicencia = req.path && req.path.includes("solicitar-licencia");
      if (user.tipo !== "SUPER_ADMIN" && user.clinica_id && !esSolicitudLicencia) {
        const [licRows] = await pool.query(
          "SELECT licencia_fin FROM clinicas WHERE id=? LIMIT 1",
          [user.clinica_id]
        );
        if (licRows.length && licRows[0].licencia_fin) {
          const fin = new Date(licRows[0].licencia_fin);
          if (fin < new Date()) {
            return res.status(402).json({
              ok: false,
              msg: "Tu licencia ha vencido. Contacta al administrador del sistema para renovar tu plan.",
              licencia_vencida: true,
            });
          }
        }
      }

      // 7. Adjuntar usuario al request para uso en rutas
      req.user = {
        id: user.id,
        clinica_id: user.clinica_id,
        tipo: user.tipo,
        super: user.tipo === "SUPER_ADMIN",
      };

      next();
    } catch (e) {
      console.error("[auth middleware]", e);
      res.status(500).json({ ok: false, msg: "Error de autenticación" });
    }
  };
}

module.exports = auth;
