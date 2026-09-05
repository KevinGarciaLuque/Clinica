/**
 * routes/facturacionLicencias.js
 * Gestión (SUPER_ADMIN) de contratos y recibos mensuales de licencia.
 * Montado en /api/facturacion-licencias
 */
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");
const {
  emitirReciboMes, reenviarRecibo, emitirContrato, periodoLabel, mesesEntre, diaFacturacionDesde,
} = require("../utils/facturacionLicencias");
const { planCompletoLabel } = require("../utils/mailer");

// ── Recibos + contrato de una clínica ──────────────────────
router.get("/clinica/:id", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const [[cl]] = await pool.query(
      `SELECT id, nombre, email, plan_tipo, licencia_inicio, licencia_fin,
              lic_monto_mensual, lic_moneda, lic_dia_facturacion, lic_contrato_numero
         FROM clinicas WHERE id=? LIMIT 1`, [id]
    );
    if (!cl) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const [recibos] = await pool.query(
      `SELECT id, numero, periodo, periodo_inicio, periodo_fin, concepto, monto, moneda,
              fecha_emision, estado, email_destino, enviado_en, error_msg, generado_por,
              (pdf IS NOT NULL) AS tiene_pdf
         FROM recibos_licencia WHERE clinica_id=? ORDER BY periodo DESC`, [id]
    );
    const [contratos] = await pool.query(
      `SELECT id, numero, plan_label, fecha, vigencia_inicio, vigencia_fin, duracion_meses,
              monto_total, monto_mensual, moneda, dia_facturacion, enviado_en,
              (pdf IS NOT NULL) AS tiene_pdf
         FROM contratos_licencia WHERE clinica_id=? ORDER BY creado_en DESC`, [id]
    );

    res.json({ ok: true, data: { clinica: cl, recibos, contratos } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Emitir un recibo manual para un período ────────────────
router.post("/clinica/:id/recibo", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { periodo, monto } = req.body; // periodo: 'YYYY-MM' (opcional, default mes actual)
    const [[cl]] = await pool.query(
      `SELECT * FROM clinicas WHERE id=? LIMIT 1`, [id]
    );
    if (!cl) return res.status(404).json({ ok: false, msg: "Clínica no encontrada" });

    const periodoDate = periodo ? new Date(`${periodo}-15T12:00:00`) : new Date();
    const r = await emitirReciboMes({
      clinica: cl, periodoDate, generadoPor: "manual", creadoPor: req.user.id,
      montoOverride: monto != null && monto !== "" ? Number(monto) : null,
      forzar: true,
    });
    if (r.skipped === "ya_existe") {
      return res.status(409).json({ ok: false, msg: `Ya existe un recibo para ese período (${r.numero})` });
    }
    if (!r.creado) return res.status(400).json({ ok: false, msg: `No se pudo emitir: ${r.skipped}` });
    res.json({ ok: true, data: r });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Reenviar un recibo ────────────────────────────────────
router.post("/recibo/:id/reenviar", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const r = await reenviarRecibo(req.params.id);
    res.json({ ok: true, data: r });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Descargar PDF de un recibo ────────────────────────────
router.get("/recibo/:id/pdf", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [[r]] = await pool.query("SELECT numero, pdf FROM recibos_licencia WHERE id=? LIMIT 1", [req.params.id]);
    if (!r || !r.pdf) return res.status(404).json({ ok: false, msg: "PDF no disponible" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="recibo-${r.numero}.pdf"`);
    res.send(r.pdf);
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Descargar PDF de un contrato ──────────────────────────
router.get("/contrato/:id/pdf", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [[c]] = await pool.query("SELECT numero, pdf FROM contratos_licencia WHERE id=? LIMIT 1", [req.params.id]);
    if (!c || !c.pdf) return res.status(404).json({ ok: false, msg: "PDF no disponible" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="contrato-${c.numero}.pdf"`);
    res.send(c.pdf);
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Reenviar contrato por correo ──────────────────────────
router.post("/contrato/:id/reenviar", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const [[c]] = await pool.query("SELECT * FROM contratos_licencia WHERE id=? LIMIT 1", [req.params.id]);
    if (!c) return res.status(404).json({ ok: false, msg: "Contrato no encontrado" });
    const r = await emitirContrato({
      clinicaId: c.clinica_id, licenciaHistorialId: c.licencia_historial_id,
      planTipo: c.plan_tipo, planLabel: c.plan_label,
      fecha: c.fecha, vigenciaInicio: c.vigencia_inicio, vigenciaFin: c.vigencia_fin,
      duracionMeses: c.duracion_meses, montoTotal: c.monto_total, montoMensual: c.monto_mensual,
      moneda: c.moneda, diaFacturacion: c.dia_facturacion,
      clienteNombre: c.cliente_nombre, clienteEmail: c.cliente_email,
      clausulasExtra: c.clausulas_extra, creadoPor: req.user.id, enviar: true,
    });
    res.json({ ok: true, data: r });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── Correr la facturación mensual manualmente (para pruebas / puesta al día) ──
router.post("/correr-mensual", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const correr = require("../scripts/facturacion-mensual");
    const resumen = await correr({ forzarDia: !!req.body?.ignorar_dia });
    res.json({ ok: true, data: resumen });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
