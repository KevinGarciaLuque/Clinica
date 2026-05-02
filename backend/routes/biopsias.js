/**
 * Módulo Biopsias y Patología (Dermatología)
 * GET    /api/biopsias                → lista (filtros: paciente_id, estado, page)
 * GET    /api/biopsias/:id            → detalle
 * POST   /api/biopsias                → crear
 * PUT    /api/biopsias/:id            → actualizar (solo si no CERRADO)
 * PUT    /api/biopsias/:id/resultado  → cargar resultado patológico
 * DELETE /api/biopsias/:id            → eliminar (solo SUPER_ADMIN / ADMIN)
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const clinicaOf = (req) =>
  req.user.super ? req.tenant?.clinica_id : req.user.clinica_id;

// ── GET / (lista) ─────────────────────────────────────────────────────────────
router.get("/", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.json({ ok: true, data: [] });

    const { paciente_id, estado, page = 1 } = req.query;
    const limit  = 30;
    const offset = (page - 1) * limit;
    const params = [cid];

    let where = "b.clinica_id = ?";
    if (paciente_id) { where += " AND b.paciente_id = ?"; params.push(paciente_id); }
    if (estado)      { where += " AND b.estado = ?";      params.push(estado); }

    const [rows] = await pool.query(
      `SELECT b.id, b.paciente_id, b.historia_id,
              b.tipo_biopsia, b.sitio_anatomico, b.sospecha_clinica,
              b.fecha_toma, b.laboratorio, b.estado,
              b.resultado_patologico, b.margenes, b.conducta_posterior,
              b.creado_en,
              p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos
       FROM biopsias b
       JOIN pacientes p ON p.id = b.paciente_id
       JOIN usuarios  u ON u.id = b.medico_id
       WHERE ${where}
       ORDER BY b.fecha_toma DESC, b.creado_en DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // count para paginación
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM biopsias b WHERE ${where}`,
      params
    );

    res.json({ ok: true, data: rows, total });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /:id (detalle) ────────────────────────────────────────────────────────
router.get("/:id", auth(), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [[row]] = await pool.query(
      `SELECT b.*,
              p.nombres AS pac_nombres, p.apellidos AS pac_apellidos,
              p.fecha_nacimiento, p.sexo,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos
       FROM biopsias b
       JOIN pacientes p ON p.id = b.paciente_id
       JOIN usuarios  u ON u.id = b.medico_id
       WHERE b.id = ? AND b.clinica_id = ?`,
      [req.params.id, cid]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "No encontrado" });
    res.json({ ok: true, data: row });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST / (crear) ────────────────────────────────────────────────────────────
router.post("/", auth("MEDICO", "ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    if (!cid) return res.status(400).json({ ok: false, msg: "Falta clinica_id" });

    const {
      paciente_id, historia_id,
      tipo_biopsia, sitio_anatomico, sospecha_clinica,
      diagnosticos_diferenciales, fecha_toma, laboratorio,
      observaciones,
    } = req.body;

    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });
    if (!tipo_biopsia) return res.status(400).json({ ok: false, msg: "tipo_biopsia requerido" });
    if (!sitio_anatomico) return res.status(400).json({ ok: false, msg: "sitio_anatomico requerido" });

    const TIPOS_VALIDOS = ["incisional", "excisional", "shave", "punch", "aspirado", "curetaje"];
    if (!TIPOS_VALIDOS.includes(tipo_biopsia)) {
      return res.status(400).json({ ok: false, msg: "tipo_biopsia inválido" });
    }

    const [r] = await pool.query(
      `INSERT INTO biopsias
         (clinica_id, paciente_id, medico_id, historia_id,
          tipo_biopsia, sitio_anatomico, sospecha_clinica,
          diagnosticos_diferenciales, fecha_toma, laboratorio,
          observaciones, estado)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'PENDIENTE')`,
      [
        cid, paciente_id, req.user.id, historia_id || null,
        tipo_biopsia,
        sitio_anatomico.trim(),
        sospecha_clinica?.trim() || null,
        diagnosticos_diferenciales?.trim() || null,
        fecha_toma || null,
        laboratorio?.trim() || null,
        observaciones?.trim() || null,
      ]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /:id (actualizar datos base) ─────────────────────────────────────────
router.put("/:id", auth("MEDICO", "ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [[b]] = await pool.query(
      "SELECT estado, medico_id FROM biopsias WHERE id=? AND clinica_id=?",
      [req.params.id, cid]
    );
    if (!b) return res.status(404).json({ ok: false, msg: "No encontrado" });
    if (b.estado === "CERRADO") return res.status(400).json({ ok: false, msg: "Biopsia cerrada, no editable" });

    const {
      tipo_biopsia, sitio_anatomico, sospecha_clinica,
      diagnosticos_diferenciales, fecha_toma, laboratorio, observaciones,
    } = req.body;

    await pool.query(
      `UPDATE biopsias
       SET tipo_biopsia=?, sitio_anatomico=?, sospecha_clinica=?,
           diagnosticos_diferenciales=?, fecha_toma=?, laboratorio=?, observaciones=?
       WHERE id=? AND clinica_id=?`,
      [
        tipo_biopsia,
        sitio_anatomico?.trim(),
        sospecha_clinica?.trim() || null,
        diagnosticos_diferenciales?.trim() || null,
        fecha_toma || null,
        laboratorio?.trim() || null,
        observaciones?.trim() || null,
        req.params.id, cid,
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── PUT /:id/resultado (cargar resultado del laboratorio) ─────────────────────
router.put("/:id/resultado", auth("MEDICO", "ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [[b]] = await pool.query(
      "SELECT estado FROM biopsias WHERE id=? AND clinica_id=?",
      [req.params.id, cid]
    );
    if (!b) return res.status(404).json({ ok: false, msg: "No encontrado" });
    if (b.estado === "CERRADO") return res.status(400).json({ ok: false, msg: "Biopsia cerrada" });

    const {
      resultado_texto, resultado_patologico, margenes,
      conducta_posterior, cerrar = false,
    } = req.body;

    const RESULTADOS_VALIDOS = ["benigno", "maligno", "atipia_leve", "atipia_moderada", "atipia_severa", "pendiente", "no_concluyente"];
    const MARGENES_VALIDOS   = ["libres", "comprometidos", "no_evaluables", "no_aplica"];

    if (resultado_patologico && !RESULTADOS_VALIDOS.includes(resultado_patologico)) {
      return res.status(400).json({ ok: false, msg: "resultado_patologico inválido" });
    }
    if (margenes && !MARGENES_VALIDOS.includes(margenes)) {
      return res.status(400).json({ ok: false, msg: "margenes inválido" });
    }

    const nuevo_estado = cerrar ? "CERRADO" : "RESULTADO_RECIBIDO";

    await pool.query(
      `UPDATE biopsias
       SET resultado_texto=?, resultado_patologico=?, margenes=?,
           conducta_posterior=?, fecha_resultado=NOW(), estado=?
       WHERE id=? AND clinica_id=?`,
      [
        resultado_texto?.trim() || null,
        resultado_patologico || "pendiente",
        margenes || "no_aplica",
        conducta_posterior?.trim() || null,
        nuevo_estado,
        req.params.id, cid,
      ]
    );
    res.json({ ok: true, estado: nuevo_estado });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", auth("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const cid = clinicaOf(req);
    const [[b]] = await pool.query(
      "SELECT id FROM biopsias WHERE id=? AND clinica_id=?",
      [req.params.id, cid]
    );
    if (!b) return res.status(404).json({ ok: false, msg: "No encontrado" });
    await pool.query("DELETE FROM biopsias WHERE id=? AND clinica_id=?", [req.params.id, cid]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
