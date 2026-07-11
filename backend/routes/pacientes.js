const router      = require("express").Router();
const pool        = require("../db");
const auth        = require("../middlewares/auth");
const upload      = require("../middlewares/upload");
const cloudinary  = require("../utils/cloudinary");
const streamifier = require("streamifier");
const fs          = require("fs");
const path        = require("path");

// GET /api/pacientes
router.get("/", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";
    
    // SUPER_ADMIN puede ver todos los pacientes
    if (!isSuperAdmin && !clinicaId) {
      return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });
    }

    const q = (req.query.q || "").trim().slice(0, 100);
    let sql =
      "SELECT id, nombres, apellidos, dni, telefono, email, fecha_nacimiento, direccion, ciudad, departamento, foto_perfil, activo, creado_en, clinica_id, TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad FROM pacientes ";
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
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/pacientes/:id
router.get("/:id", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

    
    // SUPER_ADMIN puede ver todos los pacientes, otros solo de su clínica
    let query, params;
    if (isSuperAdmin) {
      query = "SELECT p.*, TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) AS edad FROM pacientes p WHERE p.id = ?";
      params = [req.params.id];
    } else {
      query = "SELECT p.*, TIMESTAMPDIFF(YEAR, p.fecha_nacimiento, CURDATE()) AS edad FROM pacientes p WHERE p.id = ? AND p.clinica_id = ?";
      params = [req.params.id, clinicaId];
    }

    const [[p]] = await pool.query(query, params);

    if (!p) {
      return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
    }
    res.json({ ok: true, data: p });
  } catch (e) {
    console.error(`[GET /pacientes/${req.params.id}] ERROR:`, e.message, e.stack);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/pacientes
router.post("/", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const { nombres, apellidos, dni, telefono, email, fecha_nacimiento, sexo, direccion } = req.body;

    if (!nombres || !apellidos) {
      return res.status(400).json({ ok: false, msg: "nombres y apellidos son obligatorios" });
    }
    if (nombres.length > 150 || apellidos.length > 150) {
      return res.status(400).json({ ok: false, msg: "Nombres o apellidos demasiado largos (máx. 150 caracteres)" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, msg: "Formato de email inválido" });
    }
    if (fecha_nacimiento) {
      const nac = new Date(fecha_nacimiento);
      const ahora = new Date();
      if (isNaN(nac.getTime()) || nac > ahora || nac.getFullYear() < 1900) {
        return res.status(400).json({ ok: false, msg: "Fecha de nacimiento inválida" });
      }
    }

    // Formatear fecha si viene en formato ISO
    let fechaFormateada = fecha_nacimiento;
    if (fecha_nacimiento && fecha_nacimiento.includes('T')) {
      fechaFormateada = fecha_nacimiento.split('T')[0];
    }

    const {
      ciudad, departamento, pais, grupo_sanguineo, notas,
      estado_civil, ocupacion, escolaridad, religion, lugar_nacimiento, nacionalidad,
    } = req.body;

    const [r] = await pool.query(
      `INSERT INTO pacientes
         (clinica_id, nombres, apellidos, dni, telefono, email, fecha_nacimiento, sexo,
          direccion, ciudad, departamento, pais, grupo_sanguineo, notas,
          estado_civil, ocupacion, escolaridad, religion, lugar_nacimiento, nacionalidad)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clinicaId, nombres, apellidos,
        dni || null, telefono || null, email || null,
        fechaFormateada || null, sexo || null,
        direccion || null,
        ciudad || null,
        departamento || null,
        pais   || null,
        grupo_sanguineo || null,
        notas  || null,
        estado_civil || null,
        ocupacion || null,
        escolaridad || null,
        religion || null,
        lugar_nacimiento || null,
        nacionalidad || null,
      ]
    );

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /api/pacientes/:id ────────────────────────────────
router.put("/:id", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const { id }    = req.params;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

    const {
      nombres, apellidos, dni, telefono, email,
      fecha_nacimiento, sexo, direccion, ciudad, departamento, pais,
      grupo_sanguineo, notas, activo,
      // Responsable / tutor
      responsable_nombre, responsable_parentesco, responsable_telefono,
      responsable_email, responsable_dni, responsable_direccion,
      // Aseguradora
      aseguradora, numero_poliza, tipo_seguro, vigencia_seguro,
      // Datos complementarios
      estado_civil, ocupacion, escolaridad, religion,
      lugar_nacimiento, nacionalidad,
      // Contacto emergencia (ya existía en schema)
      contacto_emergencia_nombre, contacto_emergencia_telefono,
    } = req.body;

    // Formatear fecha si viene en formato ISO
    let fechaFormateada = fecha_nacimiento;
    if (fecha_nacimiento && fecha_nacimiento.includes('T')) {
      fechaFormateada = fecha_nacimiento.split('T')[0];
    }
    let vigenciaFormateada = vigencia_seguro;
    if (vigencia_seguro && vigencia_seguro.includes('T')) {
      vigenciaFormateada = vigencia_seguro.split('T')[0];
    }

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

    // Helper: convierte "" a null para campos opcionales, pero permite "0"
    const v = (val) => (val === undefined ? undefined : (val === "" ? null : val));

    await pool.query(
      `UPDATE pacientes SET
         nombres=?,        apellidos=?,
         dni=?,            telefono=?,     email=?,
         fecha_nacimiento=?,              sexo=?,
         direccion=?,      ciudad=?,       departamento=?,  pais=?,
         grupo_sanguineo=?,               notas=?,
         responsable_nombre=?,            responsable_parentesco=?,
         responsable_telefono=?,          responsable_email=?,
         responsable_dni=?,               responsable_direccion=?,
         aseguradora=?,                   numero_poliza=?,
         tipo_seguro=?,                   vigencia_seguro=?,
         estado_civil=?,   ocupacion=?,   escolaridad=?,
         religion=?,       lugar_nacimiento=?,  nacionalidad=?,
         contacto_emergencia_nombre=?,    contacto_emergencia_telefono=?
       WHERE id=? AND clinica_id=?`,
      [
        nombres||null, apellidos||null,
        v(dni), v(telefono), v(email),
        fechaFormateada||null, v(sexo),
        v(direccion), v(ciudad), v(departamento), v(pais),
        v(grupo_sanguineo), v(notas),
        v(responsable_nombre), v(responsable_parentesco),
        v(responsable_telefono), v(responsable_email),
        v(responsable_dni), v(responsable_direccion),
        v(aseguradora), v(numero_poliza),
        v(tipo_seguro), vigenciaFormateada||null,
        v(estado_civil), v(ocupacion), v(escolaridad),
        v(religion), v(lugar_nacimiento), v(nacionalidad),
        v(contacto_emergencia_nombre), v(contacto_emergencia_telefono),
        id, clinicaIdFinal,
      ]
    );

    const [[updated]] = await pool.query("SELECT * FROM pacientes WHERE id=?", [id]);
    res.json({ ok: true, paciente: updated });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /api/pacientes/:id/foto ─────────────────────────
router.post(
  "/:id/foto",
  auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
  upload.single("foto"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió archivo" });
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ ok: false, msg: "El archivo excede el tamaño máximo permitido (5 MB)" });
      }

      const clinicaId    = req.tenant?.clinica_id;
      const { id }       = req.params;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

      // Verificar que el paciente existe
      let query, params;
      if (isSuperAdmin) {
        query  = "SELECT id, foto_perfil, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=?";
        params = [id];
      } else {
        query  = "SELECT id, foto_perfil, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
        params = [id, clinicaId];
      }
      const [[p]] = await pool.query(query, params);
      if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

      const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;

      const isCloudinaryConfigured = !!(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);

      if (isCloudinaryConfigured) {
        // Eliminar foto anterior de Cloudinary si existe
        if (p.foto_cloudinary_id) {
          try { await cloudinary.uploader.destroy(p.foto_cloudinary_id); } catch (err) {
            console.error("[foto/upload] No se pudo eliminar foto anterior de Cloudinary:", err.message);
          }
        }

        // Subir nueva foto a Cloudinary desde el buffer en memoria
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: `clinica/pacientes/${clinicaIdFinal}/perfil`, resource_type: "image" },
            (err, result) => (err ? reject(err) : resolve(result))
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

        await pool.query(
          "UPDATE pacientes SET foto_perfil=?, foto_cloudinary_id=? WHERE id=? AND clinica_id=?",
          [uploadResult.secure_url, uploadResult.public_id, id, clinicaIdFinal]
        );

        return res.json({ ok: true, foto_perfil: uploadResult.secure_url });
      }

      // ── Fallback: guardar en disco local ──────────────────────────────────
      const ext      = path.extname(req.file.originalname).toLowerCase() || ".jpg";
      const filename = `paciente-${id}-${Date.now()}${ext}`;
      const uploadsDir = path.join(__dirname, "../uploads/pacientes");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
      const urlPath = `pacientes/${filename}`;

      // Eliminar foto local anterior si existe
      if (p.foto_perfil && !p.foto_perfil.startsWith("http")) {
        const oldFile = path.join(__dirname, "../uploads", p.foto_perfil);
        if (fs.existsSync(oldFile)) try { fs.unlinkSync(oldFile); } catch { /* ignorar */ }
      }

      await pool.query(
        "UPDATE pacientes SET foto_perfil=?, foto_cloudinary_id=NULL WHERE id=? AND clinica_id=?",
        [urlPath, id, clinicaIdFinal]
      );

      res.json({ ok: true, foto_perfil: urlPath });
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// ── DELETE /api/pacientes/:id/foto ───────────────────────
router.delete(
  "/:id/foto",
  auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
  async (req, res) => {
    try {
      const clinicaId    = req.tenant?.clinica_id;
      const { id }       = req.params;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

      let query, params;
      if (isSuperAdmin) {
        query  = "SELECT id, foto_perfil, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=?";
        params = [id];
      } else {
        query  = "SELECT id, foto_perfil, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
        params = [id, clinicaId];
      }
      const [[p]] = await pool.query(query, params);
      if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

      if (p.foto_cloudinary_id) {
        try { await cloudinary.uploader.destroy(p.foto_cloudinary_id); } catch { /* ignorar */ }
      }

      const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;
      await pool.query(
        "UPDATE pacientes SET foto_perfil=NULL, foto_cloudinary_id=NULL WHERE id=? AND clinica_id=?",
        [id, clinicaIdFinal]
      );

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// ── DELETE /api/pacientes/:id ─────────────────────────────
router.delete(
  "/:id",
  auth("ADMIN","MEDICO","PSICOLOGO","SUPER_ADMIN"),
  async (req, res) => {
    try {
      const clinicaId    = req.tenant?.clinica_id;
      const { id }       = req.params;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

      let query, params;
      if (isSuperAdmin) {
        query  = "SELECT id, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=?";
        params = [id];
      } else {
        query  = "SELECT id, foto_cloudinary_id, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
        params = [id, clinicaId];
      }
      const [[p]] = await pool.query(query, params);
      if (!p) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

      // Eliminar foto de Cloudinary si existe
      if (p.foto_cloudinary_id) {
        try { await cloudinary.uploader.destroy(p.foto_cloudinary_id); } catch { /* ignorar */ }
      }

      const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;
      await pool.query(
        "DELETE FROM pacientes WHERE id=? AND clinica_id=?",
        [id, clinicaIdFinal]
      );

      res.json({ ok: true, msg: "Paciente eliminado correctamente" });
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

module.exports = router;
