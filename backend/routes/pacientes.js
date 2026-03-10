const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const upload = require("../middlewares/upload");
const fs     = require("fs");
const path   = require("path");

// GET /api/pacientes
router.get("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";
    
    // SUPER_ADMIN puede ver todos los pacientes
    if (!isSuperAdmin && !clinicaId) {
      return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });
    }

    const q = (req.query.q || "").trim();
    let sql =
      "SELECT id, nombres, apellidos, dni, telefono, email, fecha_nacimiento, foto_perfil, activo, creado_en, clinica_id FROM pacientes ";
    const params = [];

    // Filtrar por clínica si no es SUPER_ADMIN
    if (!isSuperAdmin) {
      sql += "WHERE clinica_id=? ";
      params.push(clinicaId);
    }

    if (q) {
      sql += (isSuperAdmin ? "WHERE " : "AND ") + "(nombres LIKE ? OR apellidos LIKE ? OR dni LIKE ? OR telefono LIKE ?) ";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += " ORDER BY id DESC LIMIT 200";

    const [rows] = await pool.query(sql, params);
    console.log(`[GET /pacientes] ${isSuperAdmin ? 'SUPER_ADMIN' : 'Usuario normal'} - Encontrados ${rows.length} pacientes`);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/pacientes/:id
router.get("/:id", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";
    console.log(`[GET /pacientes/${req.params.id}] clinicaId: ${clinicaId}, user: ${req.user?.id}, tipo: ${req.user?.tipo}, isSuperAdmin: ${isSuperAdmin}`);
    
    // SUPER_ADMIN puede ver todos los pacientes, otros solo de su clínica
    let query, params;
    if (isSuperAdmin) {
      query = "SELECT * FROM pacientes WHERE id = ?";
      params = [req.params.id];
    } else {
      query = "SELECT * FROM pacientes WHERE id = ? AND clinica_id = ?";
      params = [req.params.id, clinicaId];
    }
    
    const [[p]] = await pool.query(query, params);
    
    if (!p) {
      console.log(`[GET /pacientes/${req.params.id}] NO ENCONTRADO`);
      return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
    }
    
    console.log(`[GET /pacientes/${req.params.id}] Paciente encontrado: ${p.nombres} ${p.apellidos} (clinica_id: ${p.clinica_id})`);
    res.json({ ok: true, data: p });
  } catch (e) {
    console.error(`[GET /pacientes/${req.params.id}] ERROR:`, e);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/pacientes
router.post("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const { nombres, apellidos, dni, telefono, email, fecha_nacimiento, sexo, direccion } = req.body;

    if (!nombres || !apellidos) {
      return res.status(400).json({ ok: false, msg: "nombres y apellidos son obligatorios" });
    }

    const [r] = await pool.query(
      `INSERT INTO pacientes
         (clinica_id, nombres, apellidos, dni, telefono, email, fecha_nacimiento, sexo,
          direccion, ciudad, pais, grupo_sanguineo, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clinicaId, nombres, apellidos,
        dni || null, telefono || null, email || null,
        fecha_nacimiento || null, sexo || null,
        direccion || null,
        req.body.ciudad || null,
        req.body.pais   || null,
        req.body.grupo_sanguineo || null,
        req.body.notas  || null,
      ]
    );

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /api/pacientes/:id ────────────────────────────────
router.put("/:id", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const { id }    = req.params;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

    const {
      nombres, apellidos, dni, telefono, email,
      fecha_nacimiento, sexo, direccion, ciudad, pais,
      grupo_sanguineo, notas, activo,
    } = req.body;

    // Verificar que el paciente existe (SUPER_ADMIN puede editar cualquiera)
    let queryExists, paramsExists;
    if (isSuperAdmin) {
      queryExists = "SELECT id, clinica_id FROM pacientes WHERE id=?";
      paramsExists = [id];
    } else {
      queryExists = "SELECT id, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
      paramsExists = [id, clinicaId];
    }
    
    const [[exists]] = await pool.query(queryExists, paramsExists);
    if (!exists) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    // Actualizar (usando el clinica_id del paciente para SUPER_ADMIN)
    const clinicaIdFinal = isSuperAdmin ? exists.clinica_id : clinicaId;
    await pool.query(
      `UPDATE pacientes SET
         nombres=COALESCE(?,nombres), apellidos=COALESCE(?,apellidos),
         dni=COALESCE(?,dni), telefono=COALESCE(?,telefono), email=COALESCE(?,email),
         fecha_nacimiento=COALESCE(?,fecha_nacimiento), sexo=COALESCE(?,sexo),
         direccion=COALESCE(?,direccion), ciudad=COALESCE(?,ciudad), pais=COALESCE(?,pais),
         grupo_sanguineo=COALESCE(?,grupo_sanguineo), notas=COALESCE(?,notas),
         activo=COALESCE(?,activo)
       WHERE id=? AND clinica_id=?`,
      [
        nombres||null, apellidos||null,
        dni||null, telefono||null, email||null,
        fecha_nacimiento||null, sexo||null,
        direccion||null, ciudad||null, pais||null,
        grupo_sanguineo||null, notas||null,
        activo ?? null,
        id, clinicaIdFinal,
      ]
    );

    res.json({ ok: true, msg: "Paciente actualizado" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /api/pacientes/:id/foto ─────────────────────────
router.post(
  "/:id/foto",
  auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
  upload.single("foto"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió archivo" });

      const clinicaId = req.tenant?.clinica_id;
      const { id }    = req.params;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

      // Verificar que el paciente existe (SUPER_ADMIN puede a cualquiera)
      let query, params;
      if (isSuperAdmin) {
        query = "SELECT id, foto_perfil, clinica_id FROM pacientes WHERE id=?";
        params = [id];
      } else {
        query = "SELECT id, foto_perfil, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
        params = [id, clinicaId];
      }
      
      const [[p]] = await pool.query(query, params);
      if (!p) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
      }

      // Eliminar foto anterior si existe
      if (p.foto_perfil) {
        const oldPath = path.join(__dirname, "../uploads", p.foto_perfil);
        if (fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
      }

      // Guardar ruta relativa (pacientes/filename.jpg)
      const relativePath = "pacientes/" + req.file.filename;
      const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;
      await pool.query(
        "UPDATE pacientes SET foto_perfil=? WHERE id=? AND clinica_id=?",
        [relativePath, id, clinicaIdFinal]
      );

      res.json({ ok: true, foto_perfil: relativePath });
    } catch (e) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// ── DELETE /api/pacientes/:id/foto ───────────────────────
router.delete(
  "/:id/foto",
  auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
  async (req, res) => {
    try {
      const clinicaId = req.tenant?.clinica_id;
      const { id }    = req.params;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

      let query, params;
      if (isSuperAdmin) {
        query = "SELECT id, foto_perfil, clinica_id FROM pacientes WHERE id=?";
        params = [id];
      } else {
        query = "SELECT id, foto_perfil, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
        params = [id, clinicaId];
      }
      
      const [[p]] = await pool.query(query, params);
      if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

      if (p.foto_perfil) {
        const oldPath = path.join(__dirname, "../uploads", p.foto_perfil);
        if (fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
        const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;
        await pool.query(
          "UPDATE pacientes SET foto_perfil=NULL WHERE id=? AND clinica_id=?",
          [id, clinicaIdFinal]
        );
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

module.exports = router;
