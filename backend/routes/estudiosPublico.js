/**
 * GET /ex/:codigo — Verificación pública de una solicitud de estudios (sin auth), la del QR del PDF.
 *
 * Seguridad (igual que la receta, /rx):
 *  - El código lleva firma HMAC: sin ella no se puede inventar ni recorrer números (ver utils/codigoEstudios.js).
 *  - Rate limiting: 30 consultas / 10 min por IP.
 *  - Expiración: solicitudes mayores a RX_EXPIRY_DAYS días devuelven 410.
 *  - Solo lectura y solo campos seguros: no se muestran resultados de laboratorio ni IDs internos.
 */
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { leerCodigo } = require("../utils/codigoEstudios");
const { tituloMedico } = require("../utils/tituloMedico");

const EXPIRA_DIAS = parseInt(process.env.RX_EXPIRY_DAYS || "365", 10);

const limitador = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, msg: "Demasiadas solicitudes. Intenta en unos minutos." },
  keyGenerator: (req) => ipKeyGenerator(req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip),
});

router.get("/:codigo", limitador, async (req, res) => {
  try {
    const ids = leerCodigo(req.params.codigo);
    if (!ids) return res.status(400).json({ ok: false, msg: "Código inválido" });

    const [rows] = await pool.query(
      `SELECT s.id, s.tipo, s.descripcion, s.urgente, s.estado, s.creado_en,
              p.nombres AS pac_nombres, p.apellidos AS pac_apellidos, p.fecha_nacimiento,
              u.nombres AS med_nombres, u.apellidos AS med_apellidos, u.sexo AS med_sexo, u.numero_colegiatura,
              e.nombre AS especialidad,
              c.nombre AS clinica_nombre, c.direccion AS clinica_direccion, c.telefono AS clinica_telefono
       FROM estudios_solicitudes s
       JOIN pacientes p ON p.id = s.paciente_id
       JOIN usuarios  u ON u.id = s.medico_id
       JOIN clinicas  c ON c.id = s.clinica_id
       LEFT JOIN especialidades e ON e.id = u.especialidad_id
       WHERE s.id IN (?)
       ORDER BY s.creado_en ASC, s.id ASC`,
      [ids]
    );
    if (!rows.length) return res.status(404).json({ ok: false, msg: "Solicitud no encontrada" });

    const r = rows[0];
    const dias = (Date.now() - new Date(r.creado_en).getTime()) / 86400000;
    if (dias > EXPIRA_DIAS) {
      return res.status(410).json({ ok: false, msg: `Esta solicitud expiró (válida por ${EXPIRA_DIAS} días desde su emisión).` });
    }

    res.json({
      ok: true,
      data: {
        numero: r.id,
        creado_en: r.creado_en,
        cancelada: rows.every((x) => x.estado === "CANCELADO"),
        paciente: `${r.pac_nombres} ${r.pac_apellidos}`,
        fecha_nac: r.fecha_nacimiento,
        medico: `${tituloMedico(r.med_sexo)}${r.med_nombres} ${r.med_apellidos}`,
        especialidad: r.especialidad || null,
        colegiatura: r.numero_colegiatura || null,
        clinica: r.clinica_nombre,
        clinica_dir: r.clinica_direccion || null,
        clinica_tel: r.clinica_telefono || null,
        estudios: rows.map((x) => ({ tipo: x.tipo, descripcion: x.descripcion, urgente: !!x.urgente, estado: x.estado })),
      },
    });
  } catch (e) {
    console.error("[estudios-publico]", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo verificar la solicitud" });
  }
});

module.exports = router;
