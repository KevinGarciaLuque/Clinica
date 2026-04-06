/**
 * /api/pacientes/:pacienteId/documentos
 *
 * GET    /  → lista documentos del paciente
 * POST   /  → sube un documento (multipart/form-data  campo: archivo)
 * DELETE /:docId → elimina un documento
 */

const router       = require("express").Router({ mergeParams: true });
const pool         = require("../db");
const auth         = require("../middlewares/auth");
const upload       = require("../middlewares/upload");
const cloudinary   = require("../utils/cloudinary");
const streamifier  = require("streamifier");

// ── GET /api/pacientes/:pacienteId/documentos ─────────────
router.get("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId   = req.tenant?.clinica_id;
    const pacienteId  = req.params.pacienteId;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

    // Verificar que el paciente existe (SUPER_ADMIN puede ver todos)
    let queryPaciente, paramsPaciente;
    if (isSuperAdmin) {
      queryPaciente = "SELECT id, clinica_id FROM pacientes WHERE id=?";
      paramsPaciente = [pacienteId];
    } else {
      queryPaciente = "SELECT id, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
      paramsPaciente = [pacienteId, clinicaId];
    }
    
    const [[p]] = await pool.query(queryPaciente, paramsPaciente);
    if (!p) {
      return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
    }

    // Obtener documentos (usando clinica_id del paciente para SUPER_ADMIN)
    const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;
    
    const [docs] = await pool.query(
      `SELECT id, tipo, nombre_original, ruta_archivo, mime_type, tamano_bytes, subido_por, creado_en AS subido_en
       FROM documentos_paciente
       WHERE paciente_id=? AND clinica_id=?
       ORDER BY creado_en DESC`,
      [pacienteId, clinicaIdFinal]
    );
    
    res.json({ ok: true, data: docs });
  } catch (e) {
    console.error(`[GET /pacientes/${req.params.pacienteId}/documentos] ERROR:`, e.message, e.stack);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /api/pacientes/:pacienteId/documentos ────────────
router.post(
  "/",
  auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
  (req, res, next) => {
    upload.single("archivo")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          ok:  false,
          msg: err.code === "LIMIT_FILE_SIZE"
            ? "El archivo no debe superar 10 MB"
            : err.message,
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const clinicaId   = req.tenant?.clinica_id;
      const pacienteId  = req.params.pacienteId;
      const usuarioId   = req.user?.id || null;
      const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

      if (!req.file)
        return res.status(400).json({ ok: false, msg: "No se recibió ningún archivo" });

      const tipo = req.body.tipo || "otro";
      const tiposValidos = ["dni_frente","dni_reverso","seguro","consentimiento","laboratorio","imagen","otro"];
      if (!tiposValidos.includes(tipo))
        return res.status(400).json({ ok: false, msg: "Tipo de documento inválido" });

      // Verificar que el paciente existe (SUPER_ADMIN puede acceder a todos)
      let queryPaciente, paramsPaciente;
      if (isSuperAdmin) {
        queryPaciente = "SELECT id, clinica_id FROM pacientes WHERE id=?";
        paramsPaciente = [pacienteId];
      } else {
        queryPaciente = "SELECT id, clinica_id FROM pacientes WHERE id=? AND clinica_id=?";
        paramsPaciente = [pacienteId, clinicaId];
      }
      
      const [[p]] = await pool.query(queryPaciente, paramsPaciente);
      if (!p) {
        return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
      }

      const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;

      // Subir a Cloudinary desde el buffer en memoria
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder:        `clinica/pacientes/${clinicaIdFinal}`,
            resource_type: "auto",
            use_filename:  false,
          },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      const [r] = await pool.query(
        `INSERT INTO documentos_paciente
           (paciente_id, clinica_id, tipo, nombre_original, ruta_archivo, cloudinary_public_id, mime_type, tamano_bytes, subido_por)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          pacienteId, clinicaIdFinal,
          tipo,
          req.file.originalname,
          uploadResult.secure_url,
          uploadResult.public_id,
          req.file.mimetype,
          req.file.size,
          usuarioId,
        ]
      );

      res.status(201).json({
        ok: true,
        id: r.insertId,
        msg: "Documento subido correctamente",
        doc: {
          id:              r.insertId,
          tipo,
          nombre_original: req.file.originalname,
          mime_type:       req.file.mimetype,
          tamano_bytes:    req.file.size,
          ruta_archivo:    uploadResult.secure_url,
        },
      });
    } catch (e) {
      res.status(500).json({ ok: false, msg: e.message });
    }
  }
);

// ── DELETE /api/pacientes/:pacienteId/documentos/:docId ───
router.delete("/:docId", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId  = req.tenant?.clinica_id;
    const pacienteId = req.params.pacienteId;
    const docId      = req.params.docId;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

    let query, params;
    if (isSuperAdmin) {
      query = "SELECT * FROM documentos_paciente WHERE id=? AND paciente_id=?";
      params = [docId, pacienteId];
    } else {
      query = "SELECT * FROM documentos_paciente WHERE id=? AND paciente_id=? AND clinica_id=?";
      params = [docId, pacienteId, clinicaId];
    }
    
    const [[doc]] = await pool.query(query, params);
    if (!doc) return res.status(404).json({ ok: false, msg: "Documento no encontrado" });

    // Borrar de Cloudinary si tiene public_id
    if (doc.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(doc.cloudinary_public_id, { resource_type: "auto" });
      } catch (cErr) {
        console.warn("[DELETE doc] Cloudinary destroy failed:", cErr.message);
      }
    }

    await pool.query("DELETE FROM documentos_paciente WHERE id=?", [docId]);

    res.json({ ok: true, msg: "Documento eliminado" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /api/pacientes/:pacienteId/documentos/:docId/view ─
// Sirve el archivo (para previsualización)
router.get("/:docId/view", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId  = req.tenant?.clinica_id;
    const pacienteId = req.params.pacienteId;
    const docId      = req.params.docId;

    const [[doc]] = await pool.query(
      "SELECT * FROM documentos_paciente WHERE id=? AND paciente_id=? AND clinica_id=?",
      [docId, pacienteId, clinicaId]
    );
    if (!doc) return res.status(404).json({ ok: false, msg: "Documento no encontrado" });

    if (!doc.ruta_archivo)
      return res.status(404).json({ ok: false, msg: "Archivo no encontrado" });

    // ruta_archivo es la URL de Cloudinary — redirigir al cliente
    return res.redirect(doc.ruta_archivo);
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
