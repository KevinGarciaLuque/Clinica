/**
 * Cola de recepción — recetas y estudios enviados por el médico desde la consulta.
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const clinicaOf = (req) =>
  req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;

/**
 * GET /api/recepcion/pendientes
 */
router.get("/pendientes", auth("RECEPCIONISTA","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);

    const [recetas] = await pool.query(
      `SELECT pr.id, pr.estado, pr.enviado_recepcion_en,
              p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos,
              (SELECT COUNT(*) FROM prescripcion_items pi WHERE pi.prescripcion_id = pr.id) AS total_items
       FROM prescripciones pr
       JOIN pacientes p ON p.id = pr.paciente_id
       JOIN usuarios  u ON u.id = pr.medico_id
       WHERE pr.clinica_id=? AND pr.enviado_recepcion_en IS NOT NULL AND pr.recibido_recepcion_en IS NULL
       ORDER BY pr.enviado_recepcion_en ASC`,
      [cid]
    );

    const [estudios] = await pool.query(
      `SELECT s.id, s.estado, s.tipo, s.urgente, s.enviado_recepcion_en,
              p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos
       FROM estudios_solicitudes s
       JOIN pacientes p ON p.id = s.paciente_id
       JOIN usuarios  u ON u.id = s.medico_id
       WHERE s.clinica_id=? AND s.enviado_recepcion_en IS NOT NULL AND s.recibido_recepcion_en IS NULL
       ORDER BY s.enviado_recepcion_en ASC`,
      [cid]
    );

    res.json({ ok: true, data: { recetas, estudios } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * GET /api/recepcion/historial
 */
router.get("/historial", auth("RECEPCIONISTA","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);

    const [recetas] = await pool.query(
      `SELECT pr.id, pr.estado, pr.recibido_recepcion_en,
              p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos,
              (SELECT COUNT(*) FROM prescripcion_items pi WHERE pi.prescripcion_id = pr.id) AS total_items
       FROM prescripciones pr
       JOIN pacientes p ON p.id = pr.paciente_id
       JOIN usuarios  u ON u.id = pr.medico_id
       WHERE pr.clinica_id=? AND pr.recibido_recepcion_en IS NOT NULL
       ORDER BY pr.recibido_recepcion_en DESC LIMIT 100`,
      [cid]
    );

    const [estudios] = await pool.query(
      `SELECT s.id, s.estado, s.tipo, s.urgente, s.recibido_recepcion_en,
              p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos
       FROM estudios_solicitudes s
       JOIN pacientes p ON p.id = s.paciente_id
       JOIN usuarios  u ON u.id = s.medico_id
       WHERE s.clinica_id=? AND s.recibido_recepcion_en IS NOT NULL
       ORDER BY s.recibido_recepcion_en DESC LIMIT 100`,
      [cid]
    );

    res.json({ ok: true, data: { recetas, estudios } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * PUT /api/recepcion/recetas/:id/aceptar
 */
router.put("/recetas/:id/aceptar", auth("RECEPCIONISTA","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [r] = await pool.query(
      `UPDATE prescripciones SET recibido_recepcion_en=NOW()
       WHERE id=? AND clinica_id=? AND enviado_recepcion_en IS NOT NULL AND recibido_recepcion_en IS NULL`,
      [req.params.id, cid]
    );
    if (!r.affectedRows) return res.status(409).json({ ok: false, msg: "Receta no pendiente o ya aceptada" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

/**
 * PUT /api/recepcion/estudios/:id/aceptar
 */
router.put("/estudios/:id/aceptar", auth("RECEPCIONISTA","ADMIN","SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [r] = await pool.query(
      `UPDATE estudios_solicitudes SET recibido_recepcion_en=NOW()
       WHERE id=? AND clinica_id=? AND enviado_recepcion_en IS NOT NULL AND recibido_recepcion_en IS NULL`,
      [req.params.id, cid]
    );
    if (!r.affectedRows) return res.status(409).json({ ok: false, msg: "Estudio no pendiente o ya aceptado" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
