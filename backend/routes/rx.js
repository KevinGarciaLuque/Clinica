/**
 * GET /rx/:codigo  — Verificación pública de receta (sin auth)
 * Devuelve datos seguros de la prescripción para mostrar al paciente/farmacia.
 *
 * Seguridad aplicada:
 *  - Rate limiting: 30 consultas / 10 min por IP (evita enumeración)
 *  - Validación de formato del código (hex 16 chars)
 *  - Expiración: recetas mayores a RX_EXPIRY_DAYS días devuelven 410 Gone
 *  - Solo se exponen campos seguros (sin IDs internos de clínica, sin datos privados)
 */
const express   = require("express");
const router    = express.Router();
const pool      = require("../db");
const rateLimit = require("express-rate-limit");

const RX_EXPIRY_DAYS = parseInt(process.env.RX_EXPIRY_DAYS || "365", 10);

// 30 peticiones por IP cada 10 minutos
const rxLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes. Intenta en unos minutos." },
  keyGenerator: (req) => req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip,
});

router.get("/:codigo", rxLimiter, async (req, res) => {
  try {
    const { codigo } = req.params;

    // Validar formato: exactamente 16 caracteres hexadecimales en mayúscula
    if (!codigo || !/^[0-9A-F]{16}$/.test(codigo)) {
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

    // Verificar expiración
    const diasTranscurridos = (Date.now() - new Date(pr.creado_en).getTime()) / (1000 * 60 * 60 * 24);
    if (diasTranscurridos > RX_EXPIRY_DAYS) {
      return res.status(410).json({
        ok: false,
        msg: `Esta receta expiró (válida por ${RX_EXPIRY_DAYS} días desde su emisión).`,
      });
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
