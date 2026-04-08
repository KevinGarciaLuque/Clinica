/**
 * routes/vacunas.js
 * CRUD Registro de Vacunas + Suplementación Vitamina A
 */
const { Router } = require("express");
const router = Router();
const pool = require("../db");
const auth = require("../middlewares/auth");

// ═══════════════════════════════════════════════════════════
// VACUNAS APLICADAS
// ═══════════════════════════════════════════════════════════

// GET /api/vacunas/paciente/:pacienteId — Todas las vacunas del paciente
router.get("/paciente/:pacienteId", auth("ADMIN", "MEDICO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const { pacienteId } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM vacunas_aplicadas
       WHERE paciente_id = ? AND clinica_id = ?
       ORDER BY vacuna_codigo, dosis_orden, fecha_aplicacion`,
      [pacienteId, clinicaId]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/vacunas — Registrar vacuna
router.post("/", auth("ADMIN", "MEDICO", "ENFERMERA", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const {
      paciente_id, vacuna_codigo, vacuna_nombre, dosis_nombre, dosis_orden,
      fecha_dia, fecha_mes, fecha_ano, proxima_cita, nombre_vacunador, lote, observaciones,
    } = req.body;

    if (!paciente_id || !vacuna_codigo || !dosis_nombre) {
      return res.status(400).json({ ok: false, msg: "paciente_id, vacuna_codigo y dosis_nombre son requeridos" });
    }

    // Construir fecha_aplicacion si tenemos los 3 componentes
    let fecha_aplicacion = null;
    if (fecha_dia && fecha_mes && fecha_ano) {
      const d = String(fecha_dia).padStart(2, "0");
      const m = String(fecha_mes).padStart(2, "0");
      const y = String(fecha_ano);
      fecha_aplicacion = `${y}-${m}-${d}`;
    }

    const [r] = await pool.query(
      `INSERT INTO vacunas_aplicadas
         (clinica_id, paciente_id, usuario_id, vacuna_codigo, vacuna_nombre, dosis_nombre, dosis_orden,
          fecha_dia, fecha_mes, fecha_ano, fecha_aplicacion, proxima_cita, nombre_vacunador, lote, observaciones)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clinicaId, paciente_id, req.user?.id || null,
        vacuna_codigo, vacuna_nombre, dosis_nombre, dosis_orden || 1,
        fecha_dia || null, fecha_mes || null, fecha_ano || null, fecha_aplicacion,
        proxima_cita || null, nombre_vacunador || null, lote || null, observaciones || null,
      ]
    );

    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/vacunas/:id — Actualizar vacuna
router.put("/:id", auth("ADMIN", "MEDICO", "ENFERMERA", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const {
      vacuna_nombre, dosis_nombre,
      fecha_dia, fecha_mes, fecha_ano, proxima_cita, nombre_vacunador, lote, observaciones,
    } = req.body;

    let fecha_aplicacion = null;
    if (fecha_dia && fecha_mes && fecha_ano) {
      const d = String(fecha_dia).padStart(2, "0");
      const m = String(fecha_mes).padStart(2, "0");
      fecha_aplicacion = `${fecha_ano}-${m}-${d}`;
    }

    await pool.query(
      `UPDATE vacunas_aplicadas
       SET vacuna_nombre=COALESCE(?,vacuna_nombre), dosis_nombre=COALESCE(?,dosis_nombre),
           fecha_dia=?, fecha_mes=?, fecha_ano=?, fecha_aplicacion=?,
           proxima_cita=?, nombre_vacunador=?, lote=?, observaciones=?
       WHERE id=? AND clinica_id=?`,
      [
        vacuna_nombre || null, dosis_nombre || null,
        fecha_dia || null, fecha_mes || null, fecha_ano || null, fecha_aplicacion,
        proxima_cita || null, nombre_vacunador || null, lote || null, observaciones || null,
        req.params.id, clinicaId,
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// DELETE /api/vacunas/:id
router.delete("/:id", auth("ADMIN", "MEDICO", "ENFERMERA", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    await pool.query("DELETE FROM vacunas_aplicadas WHERE id=? AND clinica_id=?", [req.params.id, clinicaId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// SUPLEMENTACIÓN VITAMINA A
// ═══════════════════════════════════════════════════════════

// GET /api/vacunas/vitamina-a/paciente/:pacienteId
router.get("/vitamina-a/paciente/:pacienteId", auth("ADMIN", "MEDICO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const [rows] = await pool.query(
      "SELECT * FROM vitamina_a_suplementacion WHERE paciente_id=? AND clinica_id=? ORDER BY creado_en",
      [req.params.pacienteId, clinicaId]
    );
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// POST /api/vacunas/vitamina-a
router.post("/vitamina-a", auth("ADMIN", "MEDICO", "ENFERMERA", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const { paciente_id, edad_rango, tipo_dosis, dosis_ui, fecha_dia, fecha_mes, fecha_ano, nombre_vacunador, observaciones } = req.body;

    if (!paciente_id || !edad_rango || !tipo_dosis) {
      return res.status(400).json({ ok: false, msg: "paciente_id, edad_rango y tipo_dosis son requeridos" });
    }

    let fecha_aplicacion = null;
    if (fecha_dia && fecha_mes && fecha_ano) {
      const d = String(fecha_dia).padStart(2, "0");
      const m = String(fecha_mes).padStart(2, "0");
      fecha_aplicacion = `${fecha_ano}-${m}-${d}`;
    }

    const [r] = await pool.query(
      `INSERT INTO vitamina_a_suplementacion
         (clinica_id, paciente_id, usuario_id, edad_rango, tipo_dosis, dosis_ui,
          fecha_dia, fecha_mes, fecha_ano, fecha_aplicacion, nombre_vacunador, observaciones)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clinicaId, paciente_id, req.user?.id || null,
        edad_rango, tipo_dosis, dosis_ui || 100000,
        fecha_dia || null, fecha_mes || null, fecha_ano || null, fecha_aplicacion,
        nombre_vacunador || null, observaciones || null,
      ]
    );
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// PUT /api/vacunas/vitamina-a/:id
router.put("/vitamina-a/:id", auth("ADMIN", "MEDICO", "ENFERMERA", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    const { fecha_dia, fecha_mes, fecha_ano, nombre_vacunador, observaciones } = req.body;

    let fecha_aplicacion = null;
    if (fecha_dia && fecha_mes && fecha_ano) {
      const d = String(fecha_dia).padStart(2, "0");
      const m = String(fecha_mes).padStart(2, "0");
      fecha_aplicacion = `${fecha_ano}-${m}-${d}`;
    }

    await pool.query(
      `UPDATE vitamina_a_suplementacion
       SET fecha_dia=?, fecha_mes=?, fecha_ano=?, fecha_aplicacion=?, nombre_vacunador=?, observaciones=?
       WHERE id=? AND clinica_id=?`,
      [fecha_dia || null, fecha_mes || null, fecha_ano || null, fecha_aplicacion, nombre_vacunador || null, observaciones || null, req.params.id, clinicaId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// DELETE /api/vacunas/vitamina-a/:id
router.delete("/vitamina-a/:id", auth("ADMIN", "MEDICO", "ENFERMERA", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    await pool.query("DELETE FROM vitamina_a_suplementacion WHERE id=? AND clinica_id=?", [req.params.id, clinicaId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
