const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const db      = require("../db");
const auth    = require("../middlewares/auth");

const ROLES           = ["SUPER_ADMIN", "ADMIN", "MEDICO", "ENFERMERA", "RECEPCIONISTA"];
const ROLES_ESCRITURA = ["SUPER_ADMIN", "ADMIN", "MEDICO", "ENFERMERA"];

// Carpeta de uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/galeria-estetica");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `foto_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// GET sesiones: todas o de un paciente específico (siempre dentro de la clínica del usuario)
router.get("/sesiones", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id } = req.query;

    if (paciente_id) {
      const [rows] = await db.query(
        "SELECT * FROM galeria_sesiones WHERE paciente_id = ? AND clinica_id = ? ORDER BY fecha DESC, id DESC",
        [paciente_id, cid]
      );
      res.json({ data: rows });
    } else {
      const [rows] = await db.query(`
        SELECT
          gs.*,
          p.nombres as paciente_nombres,
          p.apellidos as paciente_apellidos,
          p.dni as paciente_dni,
          p.fecha_nacimiento as paciente_fecha_nacimiento
        FROM galeria_sesiones gs
        INNER JOIN pacientes p ON gs.paciente_id = p.id
        WHERE gs.clinica_id = ?
        ORDER BY gs.fecha DESC, gs.id DESC
      `, [cid]);
      res.json({ data: rows });
    }
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST crear sesión
router.post("/sesiones", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { paciente_id, nombre, fecha } = req.body;

    const [[paciente]] = await db.query("SELECT id FROM pacientes WHERE id=? AND clinica_id=?", [paciente_id, cid]);
    if (!paciente) return res.status(403).json({ message: "El paciente no pertenece a tu clínica" });

    const [r] = await db.query(
      "INSERT INTO galeria_sesiones (clinica_id, paciente_id, nombre, fecha) VALUES (?,?,?,?)",
      [cid, paciente_id, nombre, fecha]
    );
    const [rows] = await db.query("SELECT * FROM galeria_sesiones WHERE id = ?", [r.insertId]);
    res.json({ data: rows[0] });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT editar sesión
router.put("/sesiones/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[sesion]] = await db.query("SELECT id FROM galeria_sesiones WHERE id=? AND clinica_id=?", [req.params.id, cid]);
    if (!sesion) return res.status(404).json({ message: "Sesión no encontrada" });

    const { nombre, fecha } = req.body;
    await db.query(
      "UPDATE galeria_sesiones SET nombre = ?, fecha = ? WHERE id = ?",
      [nombre, fecha, req.params.id]
    );
    const [rows] = await db.query("SELECT * FROM galeria_sesiones WHERE id = ?", [req.params.id]);
    res.json({ data: rows[0] });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE eliminar sesión (y sus fotos)
router.delete("/sesiones/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[sesion]] = await db.query("SELECT id FROM galeria_sesiones WHERE id=? AND clinica_id=?", [req.params.id, cid]);
    if (!sesion) return res.status(404).json({ message: "Sesión no encontrada" });

    // Obtener todas las fotos de la sesión para borrar archivos
    const [fotos] = await db.query("SELECT archivo_nombre FROM galeria_fotos WHERE sesion_id = ?", [req.params.id]);
    // Borrar archivos del sistema
    fotos.forEach(f => {
      const filePath = path.join(__dirname, "../uploads/galeria-estetica", f.archivo_nombre);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    // Borrar fotos de la BD
    await db.query("DELETE FROM galeria_fotos WHERE sesion_id = ?", [req.params.id]);
    // Borrar sesión
    await db.query("DELETE FROM galeria_sesiones WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET fotos de una sesión
router.get("/fotos", auth(...ROLES), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { sesion_id } = req.query;
    const [rows] = await db.query(
      "SELECT * FROM galeria_fotos WHERE sesion_id = ? AND clinica_id = ? ORDER BY momento, pose",
      [sesion_id, cid]
    );
    // Agregar URL completa
    const base = `${req.protocol}://${req.get("host")}`;
    rows.forEach(f => { f.archivo_url = `${base}/uploads/galeria-estetica/${f.archivo_nombre}`; });
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST subir foto
router.post("/fotos", auth(...ROLES_ESCRITURA), upload.single("archivo"), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const { sesion_id, paciente_id, momento, pose } = req.body;

    const [[sesion]] = await db.query("SELECT id FROM galeria_sesiones WHERE id=? AND clinica_id=?", [sesion_id, cid]);
    if (!sesion) return res.status(403).json({ message: "La sesión no pertenece a tu clínica" });

    // Si ya existe esa pose, actualizarla
    const [existe] = await db.query(
      "SELECT id, archivo_nombre FROM galeria_fotos WHERE sesion_id=? AND momento=? AND pose=? AND clinica_id=?",
      [sesion_id, momento, pose, cid]
    );
    if (existe.length) {
      // Borrar archivo anterior
      const old = path.join(__dirname, "../uploads/galeria-estetica", existe[0].archivo_nombre);
      if (fs.existsSync(old)) fs.unlinkSync(old);
      await db.query(
        "UPDATE galeria_fotos SET archivo_nombre=?, creado_en=NOW() WHERE id=?",
        [req.file.filename, existe[0].id]
      );
      const [rows] = await db.query("SELECT * FROM galeria_fotos WHERE id=?", [existe[0].id]);
      const f = rows[0];
      f.archivo_url = `${req.protocol}://${req.get("host")}/uploads/galeria-estetica/${f.archivo_nombre}`;
      return res.json({ data: f });
    }
    const [r] = await db.query(
      "INSERT INTO galeria_fotos (clinica_id, sesion_id, paciente_id, momento, pose, archivo_nombre) VALUES (?,?,?,?,?,?)",
      [cid, sesion_id, paciente_id, momento, pose, req.file.filename]
    );
    const [rows] = await db.query("SELECT * FROM galeria_fotos WHERE id=?", [r.insertId]);
    const f = rows[0];
    f.archivo_url = `${req.protocol}://${req.get("host")}/uploads/galeria-estetica/${f.archivo_nombre}`;
    res.json({ data: f });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE foto
router.delete("/fotos/:id", auth(...ROLES_ESCRITURA), async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [rows] = await db.query("SELECT archivo_nombre FROM galeria_fotos WHERE id=? AND clinica_id=?", [req.params.id, cid]);
    if (!rows.length) return res.status(404).json({ message: "No encontrada" });
    const old = path.join(__dirname, "../uploads/galeria-estetica", rows[0].archivo_nombre);
    if (fs.existsSync(old)) fs.unlinkSync(old);
    await db.query("DELETE FROM galeria_fotos WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
