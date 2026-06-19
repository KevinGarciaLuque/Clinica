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
const fs           = require("fs");
const path         = require("path");

async function tablaExiste(nombreTabla) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [nombreTabla]);
  return rows.length > 0;
}

// ── GET /api/pacientes/:pacienteId/documentos ─────────────
router.get("/", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
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
    
    let docs = [];
    if (await tablaExiste("documentos_paciente")) {
      try {
        const { historia_id } = req.query;
        let docsQuery = `SELECT id, tipo, nombre_original, ruta_archivo, mime_type, tamano_bytes, subido_por, historia_id, creado_en AS subido_en
           FROM documentos_paciente
           WHERE paciente_id=? AND clinica_id=?`;
        const docsParams = [pacienteId, clinicaIdFinal];
        if (historia_id) { docsQuery += ' AND historia_id=?'; docsParams.push(historia_id); }
        docsQuery += ' ORDER BY creado_en DESC';
        const [rows] = await pool.query(docsQuery, docsParams);
        docs = rows;
      } catch (err) {
        // Compatibilidad con esquemas antiguos donde la columna de fecha es subido_en
        if (err?.code === "ER_BAD_FIELD_ERROR") {
          const [rows] = await pool.query(
            `SELECT id, tipo, nombre_original, ruta_archivo, mime_type, tamano_bytes, subido_por, subido_en
             FROM documentos_paciente
             WHERE paciente_id=? AND clinica_id=?
             ORDER BY subido_en DESC`,
            [pacienteId, clinicaIdFinal]
          );
          docs = rows;
        } else {
          throw err;
        }
      }
    } else if (await tablaExiste("paciente_documentos")) {
      // Compatibilidad legacy
      const [rows] = await pool.query(
        `SELECT id,
                COALESCE(tipo, 'otro') AS tipo,
                COALESCE(nombre, 'Documento') AS nombre_original,
                url AS ruta_archivo,
                NULL AS mime_type,
                NULL AS tamano_bytes,
                NULL AS subido_por,
                subido_en
         FROM paciente_documentos
         WHERE paciente_id=? AND clinica_id=?
         ORDER BY subido_en DESC`,
        [pacienteId, clinicaIdFinal]
      );
      docs = rows;
    } else {
      return res.status(500).json({ ok: false, msg: "No existe tabla de documentos en la base de datos" });
    }
    
    res.json({ ok: true, data: docs });
  } catch (e) {
    console.error(`[GET /pacientes/${req.params.pacienteId}/documentos] ERROR:`, e.message, e.stack);
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /api/pacientes/:pacienteId/documentos ────────────
router.post(
  "/",
  auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"),
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
      const historiaId = req.body.historia_id ? parseInt(req.body.historia_id, 10) : null;
      const tiposValidos = ["dni_frente","dni_reverso","seguro","consentimiento","laboratorio","imagen","radiografia","resultado","receta","otro"];
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

      // Subir a Cloudinary si está configurado; si no, guardar local
      const cloudinaryConfigured = !!(
        process.env.CLOUDINARY_URL ||
        (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
      );

      let uploadResult;
      if (cloudinaryConfigured) {
        // PDFs y documentos deben subirse como "raw" para ser accesibles públicamente.
        // Solo imágenes van como "image". Videos como "video".
        const mime = req.file.mimetype || "";
        const cloudinaryResourceType = mime.startsWith("image/") ? "image"
          : mime.startsWith("video/") ? "video"
          : "raw";

        uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder:        `clinica/pacientes/${clinicaIdFinal}`,
              resource_type: cloudinaryResourceType,
              use_filename:  false,
            },
            (err, result) => (err ? reject(err) : resolve(result))
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
      } else {
        const ext = path.extname(req.file.originalname || "").toLowerCase() || ".bin";
        const safeBase = (req.file.originalname || "documento")
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .slice(0, 50);
        const filename = `doc-${pacienteId}-${Date.now()}-${safeBase}${ext}`;
        const uploadsDir = path.join(__dirname, "../uploads/pacientes");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
        uploadResult = {
          secure_url: `${req.protocol}://${req.get("host")}/uploads/pacientes/${filename}`,
          public_id: null,
        };
      }

      let r;
      if (await tablaExiste("documentos_paciente")) {
        try {
          [r] = await pool.query(
            `INSERT INTO documentos_paciente
               (paciente_id, historia_id, clinica_id, tipo, nombre_original, ruta_archivo, cloudinary_public_id, mime_type, tamano_bytes, subido_por)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [
              pacienteId, historiaId, clinicaIdFinal,
              tipo,
              req.file.originalname,
              uploadResult.secure_url,
              uploadResult.public_id,
              req.file.mimetype,
              req.file.size,
              usuarioId,
            ]
          );
        } catch (err) {
          // Compatibilidad con esquemas sin cloudinary_public_id/subido_por
          if (err?.code === "ER_BAD_FIELD_ERROR") {
            [r] = await pool.query(
              `INSERT INTO documentos_paciente
                 (paciente_id, clinica_id, tipo, nombre_original, ruta_archivo, mime_type, tamano_bytes)
               VALUES (?,?,?,?,?,?,?)`,
              [
                pacienteId, clinicaIdFinal, tipo,
                req.file.originalname, uploadResult.secure_url,
                req.file.mimetype, req.file.size,
              ]
            );
          } else {
            throw err;
          }
        }
      } else if (await tablaExiste("paciente_documentos")) {
        [r] = await pool.query(
          `INSERT INTO paciente_documentos
             (paciente_id, clinica_id, tipo, nombre, url)
           VALUES (?,?,?,?,?)`,
          [pacienteId, clinicaIdFinal, tipo, req.file.originalname, uploadResult.secure_url]
        );
      } else {
        return res.status(500).json({ ok: false, msg: "No existe tabla de documentos en la base de datos" });
      }

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
router.delete("/:docId", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId  = req.tenant?.clinica_id;
    const pacienteId = req.params.pacienteId;
    const docId      = req.params.docId;
    const isSuperAdmin = req.user?.tipo === "SUPER_ADMIN";

    let doc = null;
    if (await tablaExiste("documentos_paciente")) {
      let query, params;
      if (isSuperAdmin) {
        query = "SELECT * FROM documentos_paciente WHERE id=? AND paciente_id=?";
        params = [docId, pacienteId];
      } else {
        query = "SELECT * FROM documentos_paciente WHERE id=? AND paciente_id=? AND clinica_id=?";
        params = [docId, pacienteId, clinicaId];
      }
      [[doc]] = await pool.query(query, params);
    } else if (await tablaExiste("paciente_documentos")) {
      let query, params;
      if (isSuperAdmin) {
        query = "SELECT * FROM paciente_documentos WHERE id=? AND paciente_id=?";
        params = [docId, pacienteId];
      } else {
        query = "SELECT * FROM paciente_documentos WHERE id=? AND paciente_id=? AND clinica_id=?";
        params = [docId, pacienteId, clinicaId];
      }
      [[doc]] = await pool.query(query, params);
    }

    if (!doc) return res.status(404).json({ ok: false, msg: "Documento no encontrado" });

    // Borrar de Cloudinary si tiene public_id
    if (doc.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(doc.cloudinary_public_id, { resource_type: "auto" });
      } catch (cErr) {
        console.warn("[DELETE doc] Cloudinary destroy failed:", cErr.message);
      }
    }

    if (await tablaExiste("documentos_paciente")) {
      await pool.query("DELETE FROM documentos_paciente WHERE id=?", [docId]);
    } else if (await tablaExiste("paciente_documentos")) {
      await pool.query("DELETE FROM paciente_documentos WHERE id=?", [docId]);
    }

    res.json({ ok: true, msg: "Documento eliminado" });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /api/pacientes/:pacienteId/documentos/:docId/view ─
// Sirve el archivo (para previsualización)
router.get("/:docId/view", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId  = req.tenant?.clinica_id;
    const pacienteId = req.params.pacienteId;
    const docId      = req.params.docId;

    let doc = null;
    if (await tablaExiste("documentos_paciente")) {
      [[doc]] = await pool.query(
        "SELECT * FROM documentos_paciente WHERE id=? AND paciente_id=? AND clinica_id=?",
        [docId, pacienteId, clinicaId]
      );
    } else if (await tablaExiste("paciente_documentos")) {
      [[doc]] = await pool.query(
        "SELECT id, paciente_id, clinica_id, url AS ruta_archivo, NULL AS cloudinary_public_id, NULL AS mime_type FROM paciente_documentos WHERE id=? AND paciente_id=? AND clinica_id=?",
        [docId, pacienteId, clinicaId]
      );
    }
    if (!doc) return res.status(404).json({ ok: false, msg: "Documento no encontrado" });

    if (!doc.ruta_archivo)
      return res.status(404).json({ ok: false, msg: "Archivo no encontrado" });

    // Proxy del archivo: descarga desde Cloudinary y lo sirve con nombre original.
    // Así el PDF abre en el navegador (inline) con el nombre correcto en vez de descargarse
    // con el nombre random de Cloudinary.
    let fileUrl = doc.ruta_archivo;
    if (doc.cloudinary_public_id) {
      const match = (doc.ruta_archivo || "").match(/cloudinary\.com\/[^/]+\/(\w+)\/upload/);
      const resourceType = match?.[1] || "raw";
      fileUrl = cloudinary.url(doc.cloudinary_public_id, {
        resource_type: resourceType,
        type: "upload",
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      });
    }

    try {
      const upstream = await fetch(fileUrl);
      if (!upstream.ok) {
        return res.status(502).json({ ok: false, msg: `Cloudinary respondió ${upstream.status}` });
      }

      const mime = doc.mime_type || upstream.headers.get("content-type") || "application/octet-stream";
      const nombre = doc.nombre_original || "documento";
      const safeName = nombre.replace(/"/g, "_");

      // PDFs e imágenes → inline (abre en pestaña). Resto → attachment (descarga)
      const inline = mime === "application/pdf" || mime.startsWith("image/");
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${safeName}"`);
      const cl = upstream.headers.get("content-length");
      if (cl) res.setHeader("Content-Length", cl);

      const { Readable } = require("stream");
      Readable.fromWeb(upstream.body).pipe(res);
    } catch (fetchErr) {
      console.error("[view] fetch error:", fetchErr.message);
      return res.redirect(fileUrl);
    }
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /api/pacientes/:pacienteId/documentos/por-historia
// Devuelve { historia_id: [{ id, tipo, nombre_original, ruta_archivo, mime_type }] }
router.get("/por-historia", auth("ADMIN","MEDICO","PSICOLOGO","ENFERMERA","RECEPCIONISTA","SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId  = req.tenant?.clinica_id;
    const pacienteId = req.params.pacienteId;
    const [rows] = await pool.query(
      `SELECT id, historia_id, tipo, nombre_original, ruta_archivo, mime_type
       FROM documentos_paciente
       WHERE paciente_id=? AND clinica_id=? AND historia_id IS NOT NULL
       ORDER BY creado_en ASC`,
      [pacienteId, clinicaId]
    );
    const map = {};
    rows.forEach(r => {
      if (!map[r.historia_id]) map[r.historia_id] = [];
      map[r.historia_id].push({ id: r.id, tipo: r.tipo, nombre: r.nombre_original, url: r.ruta_archivo, mime: r.mime_type });
    });
    res.json({ ok: true, data: map });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
