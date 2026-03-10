/**
 * /api/pacientes/:pacienteId/documentos
 *
 * GET    /  → lista documentos del paciente
 * POST   /  → sube un documento (multipart/form-data  campo: archivo)
 * DELETE /:docId → elimina un documento
 */

const router  = require("express").Router({ mergeParams: true });
const path    = require("path");
const fs      = require("fs");
const pool    = require("../db");
const auth    = require("../middlewares/auth");
const upload  = require("../middlewares/upload");

// ── GET /api/pacientes/:pacienteId/documentos ─────────────
router.get("/", auth("ADMIN","MEDICO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId   = req.tenant?.clinica_id;
    const pacienteId  = req.params.pacienteId;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";
    const userId = req.user?.id || 'N/A';
    
    console.log(`[GET /pacientes/${pacienteId}/documentos] clinicaId: ${clinicaId}, user: ${userId}, isSuperAdmin: ${isSuperAdmin}`);

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
      console.log(`[GET /pacientes/${pacienteId}/documentos] Paciente no encontrado`);
      return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
    }

    // Obtener documentos (usando clinica_id del paciente para SUPER_ADMIN)
    const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;
    console.log(`[GET /pacientes/${pacienteId}/documentos] Buscando documentos con clinica_id: ${clinicaIdFinal}`);
    
    const [docs] = await pool.query(
      `SELECT id, tipo, nombre_original, mime_type, tamano_bytes, subido_por, creado_en
       FROM documentos_paciente
       WHERE paciente_id=? AND clinica_id=?
       ORDER BY creado_en DESC`,
      [pacienteId, clinicaIdFinal]
    );
    
    console.log(`[GET /pacientes/${pacienteId}/documentos] Encontrados ${docs.length} documentos`);
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
            ? "El archivo no debe superar 5 MB"
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
        fs.unlinkSync(req.file.path); // Borrar archivo subido si no es válido
        return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
      }

      const clinicaIdFinal = isSuperAdmin ? p.clinica_id : clinicaId;
      const [r] = await pool.query(
        `INSERT INTO documentos_paciente
           (paciente_id, clinica_id, tipo, nombre_original, ruta_archivo, mime_type, tamano_bytes, subido_por)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          pacienteId, clinicaIdFinal,
          tipo,
          req.file.originalname,
          req.file.filename,     // sólo el nombre, no la ruta absoluta
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
        },
      });
    } catch (e) {
      // Si falla BD, borrar el archivo físico
      if (req.file?.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
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

    // Borrar archivo físico
    const filePath = path.join(__dirname, "../uploads/pacientes", doc.ruta_archivo);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}

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

    const filePath = path.join(__dirname, "../uploads/pacientes", doc.ruta_archivo);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ ok: false, msg: "Archivo no encontrado en el servidor" });

    res.setHeader("Content-Type", doc.mime_type);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.nombre_original)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
