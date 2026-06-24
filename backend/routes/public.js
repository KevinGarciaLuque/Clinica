const router = require("express").Router();
const pool   = require("../db");

// GET /api/public/clinica/:slug
router.get("/clinica/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const [[clinica]] = await pool.query(
      `SELECT id, nombre, slug, logo_url, email, telefono, ciudad, pais
       FROM clinicas
       WHERE slug = ? AND activo = 1
       LIMIT 1`,
      [slug]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const [config] = await pool.query(
      `SELECT clave, valor FROM clinica_config
       WHERE clinica_id = ? AND clave IN (
         'perfil_descripcion','perfil_nombre_doctor','perfil_titulo_doctor',
         'perfil_whatsapp','perfil_instagram','perfil_tiktok',
         'perfil_facebook','perfil_google_maps','perfil_foto_doctor'
       )`,
      [clinica.id]
    );

    const cfg = {};
    config.forEach(r => { cfg[r.clave] = r.valor; });

    res.json({ ok: true, data: { ...clinica, perfil: cfg } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// GET /api/public/clinica/:slug/servicios
router.get("/clinica/:slug/servicios", async (req, res) => {
  try {
    const { slug } = req.params;

    const [[clinica]] = await pool.query(
      "SELECT id FROM clinicas WHERE slug = ? AND activo = 1 LIMIT 1",
      [slug]
    );
    if (!clinica) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const [servicios] = await pool.query(
      `SELECT id, nombre, descripcion
       FROM catalogos_tipos_cita
       WHERE clinica_id = ? AND activo = 1
       ORDER BY orden ASC, nombre ASC`,
      [clinica.id]
    );

    res.json({ ok: true, data: servicios });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
