const router       = require("express").Router();
const pool         = require("../db");
const argon2       = require("argon2");
const jwt          = require("jsonwebtoken");
const auth         = require("../middlewares/auth");
const cloudinary   = require("../utils/cloudinary");
const multer       = require("multer");
const streamifier  = require("streamifier");
const fs           = require("fs");
const path         = require("path");

const USE_CLOUDINARY = !!(process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_URL);

const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (["image/jpeg","image/png","image/webp"].includes(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error("Solo JPG, PNG o WEBP"), { code: "WRONG_TYPE" }));
  },
});

// ── helper: registrar acceso en bitácora (fire & forget) ─────────────────────
function registrarAcceso(pool, { usuario_id, clinica_id, nombres, apellidos, email, tipo, ip, user_agent, exito }) {
  pool.query(
    `INSERT INTO bitacora_accesos (usuario_id, clinica_id, nombres, apellidos, email, tipo, ip, user_agent, exito)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [usuario_id, clinica_id || null, nombres, apellidos, email, tipo, ip || null, user_agent || null, exito ? 1 : 0]
  ).catch(() => {}); // no bloquear el flujo si falla
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password, clinica_slug } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, msg: "Email y contraseña son obligatorios" });
    }

    // Resolver clinica_id: puede venir del header, del body (slug) o null
    let clinicaId = req.tenant?.clinica_id || null;
    if (!clinicaId && clinica_slug) {
      const [slugRows] = await pool.query(
        "SELECT id FROM clinicas WHERE slug=? AND activo=1 LIMIT 1",
        [clinica_slug]
      );
      if (slugRows.length) clinicaId = slugRows[0].id;
    }

    // 1) Buscar como SUPER_ADMIN
    let user = null;
    const [superRows] = await pool.query(
      "SELECT id, clinica_id, email, password_hash, tipo, activo, nombres, apellidos FROM usuarios WHERE email=? AND tipo='SUPER_ADMIN' LIMIT 1",
      [email],
    );
    if (superRows.length > 0) {
      user = superRows[0];
    } else {
      // 2) Buscar en la clínica indicada (header/slug)
      if (clinicaId) {
        const [rows] = await pool.query(
          "SELECT id, clinica_id, email, password_hash, tipo, activo, nombres, apellidos FROM usuarios WHERE clinica_id=? AND email=? LIMIT 1",
          [clinicaId, email],
        );
        if (rows.length) user = rows[0];
      }
      // 3) Si no se indicó clínica, buscar el email en cualquier clínica (único)
      if (!user) {
        const [anyRows] = await pool.query(
          "SELECT id, clinica_id, email, password_hash, tipo, activo, nombres, apellidos FROM usuarios WHERE email=? AND tipo != 'SUPER_ADMIN' LIMIT 1",
          [email],
        );
        if (anyRows.length) user = anyRows[0];
      }
      if (!user) {
        return res.status(401).json({ ok: false, msg: "Credenciales inválidas" });
      }
    }

    // Validaciones comunes
    const ipAddr      = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket?.remoteAddress || null;
    const uaStr       = req.headers["user-agent"] || null;

    if (!user.activo) {
      registrarAcceso(pool, { usuario_id: user.id, clinica_id: user.clinica_id, nombres: user.nombres,
        apellidos: user.apellidos, email: user.email, tipo: user.tipo, ip: ipAddr, user_agent: uaStr, exito: false });
      return res.status(403).json({ ok: false, msg: "Usuario inactivo" });
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      registrarAcceso(pool, { usuario_id: user.id, clinica_id: user.clinica_id, nombres: user.nombres,
        apellidos: user.apellidos, email: user.email, tipo: user.tipo, ip: ipAddr, user_agent: uaStr, exito: false });
      return res.status(401).json({ ok: false, msg: "Credenciales inválidas" });
    }

    const esSuper = user.tipo === "SUPER_ADMIN";

    // Obtener nombre e info de licencia de la clínica
    let clinicaNombre = null;
    let licencia_info = null;
    if (user.clinica_id) {
      const [clinicaRows] = await pool.query(
        "SELECT nombre, plan_tipo, licencia_inicio, licencia_fin FROM clinicas WHERE id=? LIMIT 1",
        [user.clinica_id]
      );
      if (clinicaRows.length) {
        clinicaNombre = clinicaRows[0].nombre;
        const { plan_tipo, licencia_inicio, licencia_fin } = clinicaRows[0];
        const fin  = licencia_fin ? new Date(licencia_fin) : null;
        const ahora = new Date();
        const dias  = fin ? Math.ceil((fin - ahora) / 86400000) : null;
        licencia_info = {
          plan_tipo:       plan_tipo || "trial",
          licencia_inicio: licencia_inicio || null,
          licencia_fin:    licencia_fin    || null,
          dias_restantes:  dias,
          vencida:         fin ? fin < ahora : false,
        };
      }
    }

    const token = jwt.sign(
      {
        uid: user.id,
        clinica_id: user.clinica_id || null,
        tipo: user.tipo,
        super: esSuper,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "8h" },
    );

    // Registrar en bitácora
    registrarAcceso(pool, { usuario_id: user.id, clinica_id: user.clinica_id, nombres: user.nombres,
      apellidos: user.apellidos, email: user.email, tipo: user.tipo, ip: ipAddr, user_agent: uaStr, exito: true });

    // Obtener foto_url del usuario
    const [fotoRows] = await pool.query(
      "SELECT foto_url FROM usuarios WHERE id=? LIMIT 1", [user.id]
    );

    res.json({
      ok: true,
      token,
      licencia_info,
      usuario: {
        id: user.id,
        clinica_id: user.clinica_id || null,
        clinica_nombre: clinicaNombre,
        nombres: user.nombres,
        apellidos: user.apellidos,
        email: user.email,
        tipo: user.tipo,
        super: esSuper,
        foto_url: fotoRows[0]?.foto_url || null,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /api/auth/me  → datos completos del usuario autenticado ──────────────
router.get("/me", auth(), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, clinica_id, nombres, apellidos, email, tipo, telefono,
              numero_colegiatura, especialidad_id, foto_url, firma_url,
              (SELECT nombre FROM clinicas WHERE id=u.clinica_id LIMIT 1) AS clinica_nombre
       FROM usuarios u WHERE u.id=? LIMIT 1`,
      [req.user.uid]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /api/auth/me  → actualizar propio perfil ──────────────────────────────
router.put("/me", auth(), async (req, res) => {
  try {
    const { nombres, apellidos, telefono, foto_url, firma_url, numero_colegiatura, password_actual, password_nuevo } = req.body;

    // Si quiere cambiar contraseña, verificar la actual
    let passwordHash;
    if (password_nuevo) {
      if (!password_actual) {
        return res.status(400).json({ ok: false, msg: "Debes ingresar tu contraseña actual" });
      }
      const [rows] = await pool.query(
        "SELECT password_hash FROM usuarios WHERE id=?", [req.user.uid]
      );
      const valid = await argon2.verify(rows[0].password_hash, password_actual);
      if (!valid) {
        return res.status(401).json({ ok: false, msg: "Contraseña actual incorrecta" });
      }
      passwordHash = await argon2.hash(password_nuevo);
    }

    const fields = [];
    const values = [];
    if (nombres    !== undefined) { fields.push("nombres=?");   values.push(nombres || null); }
    if (apellidos  !== undefined) { fields.push("apellidos=?"); values.push(apellidos || null); }
    if (telefono   !== undefined) { fields.push("telefono=?");  values.push(telefono || null); }
    if (foto_url           !== undefined) { fields.push("foto_url=?");           values.push(foto_url || null); }
    if (firma_url          !== undefined) { fields.push("firma_url=?");          values.push(firma_url || null); }
    if (numero_colegiatura !== undefined) { fields.push("numero_colegiatura=?"); values.push(numero_colegiatura || null); }
    if (passwordHash)                     { fields.push("password_hash=?");      values.push(passwordHash); }

    if (fields.length) {
      values.push(req.user.uid);
      await pool.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id=?`, values);
    }

    // Devolver usuario actualizado
    const [rows] = await pool.query(
      `SELECT id, clinica_id, nombres, apellidos, email, tipo, telefono, foto_url,
              (SELECT nombre FROM clinicas WHERE id=u.clinica_id LIMIT 1) AS clinica_nombre
       FROM usuarios u WHERE u.id=? LIMIT 1`,
      [req.user.uid]
    );
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /api/auth/me/foto  → subir foto de perfil ───────────────────────────
// Producción (CLOUDINARY_CLOUD_NAME definido): sube a Cloudinary
// Desarrollo  (sin credenciales):              guarda en uploads/usuarios/
router.post("/me/foto", auth(), uploadFoto.single("foto"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió ningún archivo" });

    const [[u]] = await pool.query("SELECT foto_cloudinary_id FROM usuarios WHERE id=?", [req.user.uid]);

    let foto_url, foto_cloudinary_id = null;

    if (USE_CLOUDINARY) {
      // ── Modo producción: Cloudinary ──────────────────────────────────────
      if (u?.foto_cloudinary_id) {
        try { await cloudinary.uploader.destroy(u.foto_cloudinary_id); } catch { /* ignorar */ }
      }
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "clinica/usuarios/perfil", resource_type: "image",
            transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }] },
          (err, r) => (err ? reject(err) : resolve(r))
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
      foto_url          = result.secure_url;
      foto_cloudinary_id = result.public_id;
    } else {
      // ── Modo desarrollo: disco local ─────────────────────────────────────
      const dir = path.join(__dirname, "../uploads/usuarios");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const ext  = req.file.mimetype === "image/png" ? ".png"
                 : req.file.mimetype === "image/webp" ? ".webp" : ".jpg";
      const filename = `perfil-${req.user.uid}-${Date.now()}${ext}`;
      const filepath  = path.join(dir, filename);

      // Borrar foto anterior local si existe
      if (u?.foto_cloudinary_id === null && u?.foto_url) {
        const oldFile = path.join(__dirname, "..", u.foto_url.replace(/^\//, ""));
        if (fs.existsSync(oldFile)) fs.unlink(oldFile, () => {});
      }

      fs.writeFileSync(filepath, req.file.buffer);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      foto_url = `${baseUrl}/uploads/usuarios/${filename}`;
    }

    await pool.query(
      "UPDATE usuarios SET foto_url=?, foto_cloudinary_id=? WHERE id=?",
      [foto_url, foto_cloudinary_id, req.user.uid]
    );

    res.json({ ok: true, foto_url });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST /api/auth/me/firma  → subir imagen de firma digital ─────────────────
router.post("/me/firma", auth(), uploadFoto.single("firma"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, msg: "No se recibió ningún archivo" });

    const [[u]] = await pool.query("SELECT firma_url FROM usuarios WHERE id=?", [req.user.uid]);

    let firma_url;

    if (USE_CLOUDINARY) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "firmas", format: "png", quality: 90 },
          (err, r) => err ? reject(err) : resolve(r)
        );
        stream.end(req.file.buffer);
      });
      firma_url = result.secure_url;
    } else {
      const dir = path.join(__dirname, "../uploads/firmas");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = `firma-${req.user.uid}-${Date.now()}.png`;
      const filepath  = path.join(dir, filename);
      if (u?.firma_url && u.firma_url.includes("/uploads/firmas/")) {
        const oldFile = path.join(__dirname, "..", u.firma_url.replace(/^\//, ""));
        try { if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile); } catch { /* ignorar */ }
      }
      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      fs.writeFileSync(filepath, req.file.buffer);
      firma_url = `${baseUrl}/uploads/firmas/${filename}`;
    }

    await pool.query("UPDATE usuarios SET firma_url=? WHERE id=?", [firma_url, req.user.uid]);
    res.json({ ok: true, firma_url });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
