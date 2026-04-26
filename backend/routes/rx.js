/**
 * GET /rx/:codigo  — Verificación pública de receta (sin auth)
 * Devuelve datos seguros de la prescripción para mostrar al paciente/farmacia.
 */
const express = require("express");
const router  = express.Router();
const pool    = require("../db");

router.get("/:codigo", async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo || codigo.length < 8) {
      return res.status(400).json({ ok: false, msg: "Código inválido" });
    }

    const [[pr]] = await pool.query(
      `SELECT pr.id, pr.estado, pr.notas, pr.creado_en,
              p.nombres   AS pac_nombres, p.apellidos AS pac_apellidos,
              p.fecha_nacimiento,
              u.nombres   AS med_nombres, u.apellidos AS med_apellidos,
              u.numero_colegiatura,
              e.nombre    AS especialidad,
              c.nombre    AS clinica_nombre, c.direccion AS clinica_direccion,
              c.telefono  AS clinica_telefono
       FROM prescripciones pr
       JOIN pacientes  p ON p.id = pr.paciente_id
       JOIN usuarios   u ON u.id = pr.medico_id
       JOIN clinicas   c ON c.id = pr.clinica_id
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE pr.codigo_qr = ?
       LIMIT 1`,
      [codigo]
    );

    if (!pr) {
      return res.status(404).json({ ok: false, msg: "Receta no encontrada" });
    }

    const [items] = await pool.query(
      `SELECT COALESCE(m.nombre_generico, pi.medicamento_texto) AS medicamento,
              m.presentacion, m.via_administracion,
              pi.dosis, pi.duracion, pi.cantidad, pi.instrucciones
       FROM prescripcion_items pi
       LEFT JOIN medicamentos m ON m.id = pi.medicamento_id
       WHERE pi.prescripcion_id = ?`,
      [pr.id]
    );

    res.json({
      ok: true,
      data: {
        id:           pr.id,
        estado:       pr.estado,
        creado_en:    pr.creado_en,
        notas:        pr.notas,
        paciente:     `${pr.pac_nombres} ${pr.pac_apellidos}`,
        fecha_nac:    pr.fecha_nacimiento,
        medico:       `Dr(a). ${pr.med_nombres} ${pr.med_apellidos}`,
        especialidad: pr.especialidad || null,
        colegiatura:  pr.numero_colegiatura || null,
        clinica:      pr.clinica_nombre,
        clinica_dir:  pr.clinica_direccion || null,
        clinica_tel:  pr.clinica_telefono  || null,
        items,
      },
    });
  } catch (e) {
    console.error("rx error:", e);
    res.status(500).json({ ok: false, msg: "Error interno" });
  }
});

module.exports = router;
