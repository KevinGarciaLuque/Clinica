/**
 * routes/usuarios.js
 * Gestión de usuarios por clínica (médicos, recepcionistas, enfermeras, admins)
 * SUPER_ADMIN puede gestionar usuarios de cualquier clínica
 * ADMIN solo puede gestionar usuarios de su propia clínica
 */

const router = require("express").Router();
const pool   = require("../db");
const argon2 = require("argon2");
const auth   = require("../middlewares/auth");

// ──────────────────────────────────────────────
// GET /api/usuarios  → lista de usuarios de la clínica
// ──────────────────────────────────────────────
router.get("/", auth("SUPER_ADMIN","ADMIN","RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.super
      ? (req.query.clinica_id || req.tenant?.clinica_id)
      : req.user.clinica_id;

    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const { tipo } = req.query;
    let sql = `SELECT u.id, u.nombres, u.apellidos, u.email, u.tipo, u.activo,
                      u.telefono, u.numero_colegiatura, u.firma_url,
                      e.nombre AS especialidad, e.id AS especialidad_id,
                      u.creado_en
               FROM usuarios u
               LEFT JOIN especialidades e ON e.id = u.especialidad_id
               WHERE u.clinica_id = ? AND u.activo = 1`;
    const params = [clinicaId];

    if (tipo) { sql += " AND u.tipo = ?"; params.push(tipo); }
    sql += " ORDER BY u.tipo, u.apellidos";

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/usuarios/especialidades  → catálogo de especialidades
router.get("/especialidades", auth(), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, nombre FROM especialidades ORDER BY nombre");
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/usuarios/medicos  → solo médicos activos (para selects de citas/horarios)
router.get("/medicos", auth(), async (req, res) => {
  try {
    const clinicaId = req.user.super
      ? (req.tenant?.clinica_id || req.query.clinica_id)
      : req.user.clinica_id;

    if (!clinicaId) return res.json({ ok: true, data: [] });

    const [rows] = await pool.query(
      `SELECT u.id, u.nombres, u.apellidos, e.nombre AS especialidad
       FROM usuarios u LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE u.clinica_id=? AND u.tipo='MEDICO' AND u.activo=1
       ORDER BY u.apellidos`,
      [clinicaId]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/usuarios/:id
router.get("/:id", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? null : req.user.clinica_id;
    let sql = `SELECT u.id, u.clinica_id, u.nombres, u.apellidos, u.email, u.tipo,
                      u.activo, u.telefono, u.numero_colegiatura, u.firma_url,
                      e.nombre AS especialidad, e.id AS especialidad_id
               FROM usuarios u LEFT JOIN especialidades e ON e.id = u.especialidad_id
               WHERE u.id=?`;
    const params = [req.params.id];
    if (clinicaId) { sql += " AND u.clinica_id=?"; params.push(clinicaId); }

    const [rows] = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/usuarios  → crear usuario
router.post("/", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super
      ? (req.body.clinica_id || req.tenant?.clinica_id)
      : req.user.clinica_id;

    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const { nombres, apellidos, email, password, tipo,
            especialidad_id, telefono, numero_colegiatura } = req.body;

    if (!nombres || !apellidos || !email || !password || !tipo) {
      return res.status(400).json({ ok: false, msg: "nombres, apellidos, email, password y tipo son obligatorios" });
    }

    const tiposValidos = ["ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA"];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ ok: false, msg: `tipo inválido. Válidos: ${tiposValidos.join(", ")}` });
    }

    // No permitir que un ADMIN de clínica cree otro SUPER_ADMIN
    if (!req.user.super && tipo === "SUPER_ADMIN") {
      return res.status(403).json({ ok: false, msg: "No puedes crear un SUPER_ADMIN" });
    }

    // Email único por clínica
    const [exist] = await pool.query(
      "SELECT id FROM usuarios WHERE clinica_id=? AND email=?",
      [clinicaId, email]
    );
    if (exist.length) return res.status(409).json({ ok: false, msg: "Email ya registrado en esta clínica" });

    const hash = await argon2.hash(password);

    const [r] = await pool.query(
      `INSERT INTO usuarios
         (clinica_id, nombres, apellidos, email, password_hash, tipo, especialidad_id, telefono, numero_colegiatura)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [clinicaId, nombres, apellidos, email, hash, tipo,
       especialidad_id||null, telefono||null, numero_colegiatura||null]
    );

    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/usuarios/:id  → actualizar usuario
router.put("/:id", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? null : req.user.clinica_id;

    // Verificar que el usuario pertenece a la clínica del que edita
    const [rows] = await pool.query(
      "SELECT id, clinica_id, tipo FROM usuarios WHERE id=?",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    if (clinicaId && rows[0].clinica_id !== clinicaId) {
      return res.status(403).json({ ok: false, msg: "No tienes acceso a este usuario" });
    }

    const { nombres, apellidos, email, password, tipo,
            especialidad_id, telefono, numero_colegiatura, firma_url, activo } = req.body;

    let passwordHash = undefined;
    if (password) {
      passwordHash = await argon2.hash(password);
    }

    // Construir campos dinámicamente para permitir limpiar valores (ej. especialidad_id → null)
    const fields = [];
    const values = [];
    if (nombres      !== undefined) { fields.push("nombres=?");            values.push(nombres || null); }
    if (apellidos    !== undefined) { fields.push("apellidos=?");          values.push(apellidos || null); }
    if (email        !== undefined) { fields.push("email=?");              values.push(email || null); }
    if (passwordHash !== undefined) { fields.push("password_hash=?");      values.push(passwordHash); }
    if (tipo         !== undefined) { fields.push("tipo=?");               values.push(tipo || null); }
    if (especialidad_id !== undefined) { fields.push("especialidad_id=?"); values.push(especialidad_id || null); }
    if (telefono     !== undefined) { fields.push("telefono=?");           values.push(telefono || null); }
    if (numero_colegiatura !== undefined) { fields.push("numero_colegiatura=?"); values.push(numero_colegiatura || null); }
    if (firma_url    !== undefined) { fields.push("firma_url=?");          values.push(firma_url || null); }
    if (activo       !== undefined) { fields.push("activo=?");             values.push(activo); }

    if (!fields.length) return res.json({ ok: true });
    values.push(req.params.id);
    await pool.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id=?`, values);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// DELETE /api/usuarios/:id  → eliminar permanentemente (FK en CASCADE)
router.delete("/:id", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.super ? null : req.user.clinica_id;

    // Verificar que el usuario pertenece a la clínica del que elimina
    const [rows] = await pool.query("SELECT id, clinica_id, tipo FROM usuarios WHERE id=? LIMIT 1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    if (clinicaId && rows[0].clinica_id !== clinicaId) {
      return res.status(403).json({ ok: false, msg: "No tienes acceso a este usuario" });
    }
    // Evitar que se elimine a sí mismo
    if (rows[0].id === req.user.id) {
      return res.status(400).json({ ok: false, msg: "No puedes eliminarte a ti mismo" });
    }

    await pool.query("DELETE FROM usuarios WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/usuarios/:id/reset-password  → admin resetea contraseña
router.post("/:id/reset-password", auth("SUPER_ADMIN","ADMIN"), async (req, res) => {
  try {
    const { nueva_password } = req.body;
    if (!nueva_password || nueva_password.length < 8) {
      return res.status(400).json({ ok: false, msg: "La contraseña debe tener al menos 8 caracteres" });
    }
    const hash = await argon2.hash(nueva_password);
    await pool.query("UPDATE usuarios SET password_hash=? WHERE id=?", [hash, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
