const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const db      = require("../db");

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

// GET sesiones: todas o de un paciente específico
router.get("/sesiones", async (req, res) => {
  try {
    const { paciente_id } = req.query;
    
    if (paciente_id) {
      // Sesiones de un paciente específico
      const [rows] = await db.query(
        "SELECT * FROM galeria_sesiones WHERE paciente_id = ? ORDER BY fecha DESC, id DESC",
        [paciente_id]
      );
      res.json({ data: rows });
    } else {
      // Todas las sesiones con datos del paciente
      const [rows] = await db.query(`
        SELECT 
          gs.*,
          p.nombres as paciente_nombres,
          p.apellidos as paciente_apellidos,
          p.dni as paciente_dni,
          p.fecha_nacimiento as paciente_fecha_nacimiento
        FROM galeria_sesiones gs
        INNER JOIN pacientes p ON gs.paciente_id = p.id
        ORDER BY gs.fecha DESC, gs.id DESC
      `);
      res.json({ data: rows });
    }
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST crear sesión
router.post("/sesiones", async (req, res) => {
  try {
    const { paciente_id, nombre, fecha } = req.body;
    const [r] = await db.query(
      "INSERT INTO galeria_sesiones (paciente_id, nombre, fecha) VALUES (?,?,?)",
      [paciente_id, nombre, fecha]
    );
    const [rows] = await db.query("SELECT * FROM galeria_sesiones WHERE id = ?", [r.insertId]);
    res.json({ data: rows[0] });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT editar sesión
router.put("/sesiones/:id", async (req, res) => {
  try {
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
router.delete("/sesiones/:id", async (req, res) => {
  try {
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
router.get("/fotos", async (req, res) => {
  try {
    const { sesion_id } = req.query;
    const [rows] = await db.query(
      "SELECT * FROM galeria_fotos WHERE sesion_id = ? ORDER BY momento, pose",
      [sesion_id]
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
router.post("/fotos", upload.single("archivo"), async (req, res) => {
  try {
    const { sesion_id, paciente_id, momento, pose } = req.body;
    // Si ya existe esa pose, actualizarla
    const [existe] = await db.query(
      "SELECT id, archivo_nombre FROM galeria_fotos WHERE sesion_id=? AND momento=? AND pose=?",
      [sesion_id, momento, pose]
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
      "INSERT INTO galeria_fotos (sesion_id, paciente_id, momento, pose, archivo_nombre) VALUES (?,?,?,?,?)",
      [sesion_id, paciente_id, momento, pose, req.file.filename]
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
router.delete("/fotos/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT archivo_nombre FROM galeria_fotos WHERE id=?", [req.params.id]);
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
