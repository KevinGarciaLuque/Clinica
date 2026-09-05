/**
 * utils/facturacionLicencias.js
 * Lógica compartida de contrato + recibos mensuales de licencia.
 * La usan routes/facturacionLicencias.js, routes/clinicas.js,
 * routes/planesPublicos.js y scripts/facturacion-mensual.js.
 */
const pool = require("../db");
const { generarPdfDesdeHtml } = require("./pdfFromHtml");
const {
  enviarEmail,
  templateContratoServicio,
  templateContratoEmail,
  templateReciboMensual,
  templateReciboEmail,
} = require("./mailer");

const pad = (n, l = 6) => String(n).padStart(l, "0");
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const ym  = (d) => new Date(d).toISOString().slice(0, 7);

/** Meses completos entre dos fechas (redondeado). */
function mesesEntre(inicio, fin) {
  const a = new Date(inicio), b = new Date(fin);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  // ajuste por días sobrantes → redondeo al mes más cercano
  const ref = new Date(a); ref.setMonth(ref.getMonth() + m);
  const sobra = (b - ref) / 86400000;
  if (sobra >= 15) m += 1;
  return Math.max(1, m);
}

/** Día de facturación válido (1..28) a partir de una fecha de inicio. */
function diaFacturacionDesde(inicio) {
  return Math.min(28, new Date(inicio).getDate());
}

/** Etiqueta legible del período: "octubre 2026". */
function periodoLabel(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-HN", { month: "long", year: "numeric" });
}

function numeroContrato(clinicaId, fecha) {
  return `CT-${ymd(fecha).replace(/-/g, "")}-${pad(clinicaId, 4)}`;
}
function numeroRecibo(clinicaId, ymStr) {
  return `REC-${ymStr.replace(/-/g, "")}-${pad(clinicaId, 4)}`;
}

// ────────────────────────────────────────────────────────────
//  CONTRATO
// ────────────────────────────────────────────────────────────
/**
 * Emite (o re-emite) el contrato de servicio de una clínica.
 * Idempotente por `numero`. Genera PDF, lo guarda y lo envía por correo.
 */
async function emitirContrato({
  clinicaId, licenciaHistorialId = null, planTipo, planLabel,
  fecha = new Date(), vigenciaInicio, vigenciaFin, duracionMeses,
  montoTotal = null, montoMensual = null, moneda = "HNL", diaFacturacion,
  clienteNombre, clienteEmail, clausulasExtra = null, creadoPor = null,
  enviar = true,
}) {
  const numero = numeroContrato(clinicaId, fecha);

  const [[cl]] = await pool.query("SELECT nombre, email FROM clinicas WHERE id=? LIMIT 1", [clinicaId]);
  const clinicaNombre = cl?.nombre || "Clínica";
  const emailDestino = clienteEmail || cl?.email || null;

  const contratoHtml = templateContratoServicio({
    numero, clinicaNombre, clienteNombre: clienteNombre || clinicaNombre, clienteEmail: emailDestino,
    planLabel, fecha, vigenciaInicio, vigenciaFin, duracionMeses,
    montoTotal, montoMensual, moneda, diaFacturacion, clausulasExtra,
  });

  let pdf = null;
  try { pdf = await generarPdfDesdeHtml(contratoHtml, { paper_size: "A4", orientacion: "portrait" }); }
  catch (e) { console.error("[contrato pdf]", e.message); }

  await pool.query(
    `INSERT INTO contratos_licencia
       (numero, clinica_id, licencia_historial_id, plan_tipo, plan_label, fecha,
        vigencia_inicio, vigencia_fin, duracion_meses, monto_total, monto_mensual,
        moneda, dia_facturacion, cliente_nombre, cliente_email, clausulas_extra, pdf, creado_por)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
        plan_label=VALUES(plan_label), vigencia_inicio=VALUES(vigencia_inicio),
        vigencia_fin=VALUES(vigencia_fin), duracion_meses=VALUES(duracion_meses),
        monto_total=VALUES(monto_total), monto_mensual=VALUES(monto_mensual),
        moneda=VALUES(moneda), dia_facturacion=VALUES(dia_facturacion),
        cliente_nombre=VALUES(cliente_nombre), cliente_email=VALUES(cliente_email),
        clausulas_extra=VALUES(clausulas_extra), pdf=COALESCE(VALUES(pdf), pdf)`,
    [numero, clinicaId, licenciaHistorialId, planTipo, planLabel, ymd(fecha),
     ymd(vigenciaInicio), ymd(vigenciaFin), duracionMeses || null, montoTotal, montoMensual,
     moneda, diaFacturacion || null, clienteNombre || clinicaNombre, emailDestino,
     clausulasExtra, pdf, creadoPor]
  );

  let enviado = false, error = null;
  if (enviar && emailDestino) {
    try {
      await enviarEmail({
        to: emailDestino,
        subject: `Contrato de servicio ${numero} — Medic-KG`,
        html: templateContratoEmail({ clienteNombre: clienteNombre || clinicaNombre, clinicaNombre, planLabel, numero }),
        attachments: pdf ? [{ filename: `contrato-${numero}.pdf`, content: pdf, contentType: "application/pdf" }] : [],
      });
      enviado = true;
      await pool.query("UPDATE contratos_licencia SET enviado_en=NOW() WHERE numero=?", [numero]);
    } catch (e) { error = e.message; console.error("[contrato email]", e.message); }
  }

  return { numero, enviado, error };
}

// ────────────────────────────────────────────────────────────
//  RECIBO MENSUAL
// ────────────────────────────────────────────────────────────
/**
 * Emite el recibo de un período (mes) para una clínica. Idempotente por
 * (clinica_id, periodo). Devuelve { creado, numero, enviado, error, skipped }.
 *
 * @param clinica  fila de `clinicas` con licencia_inicio/fin y columnas lic_*
 * @param periodoDate  fecha dentro del mes a facturar (default: hoy)
 */
async function emitirReciboMes({
  clinica, periodoDate = new Date(), generadoPor = "cron", creadoPor = null,
  montoOverride = null, forzar = false,
}) {
  const c = clinica;
  const periodo = ym(periodoDate);
  const inicioLic = c.licencia_inicio ? new Date(c.licencia_inicio) : null;
  const finLic    = c.licencia_fin ? new Date(c.licencia_fin) : null;
  const monto = montoOverride != null ? Number(montoOverride) : (c.lic_monto_mensual != null ? Number(c.lic_monto_mensual) : null);
  const moneda = c.lic_moneda || "HNL";

  if (monto == null || !(monto > 0)) return { skipped: "sin_monto_mensual" };
  if (!forzar) {
    if (!inicioLic || !finLic)       return { skipped: "sin_vigencia" };
    // El mes de la contratación NO lleva recibo (ese mes se emite el contrato).
    if (periodo <= ym(inicioLic))    return { skipped: "mes_de_contratacion" };
    // No facturar fuera de la vigencia.
    if (periodoDate > finLic)        return { skipped: "fuera_de_vigencia" };
  }

  // ¿ya existe?
  const [[ya]] = await pool.query(
    "SELECT id, numero FROM recibos_licencia WHERE clinica_id=? AND periodo=? LIMIT 1",
    [c.id, periodo]
  );
  if (ya) return { skipped: "ya_existe", numero: ya.numero };

  const dia = Math.min(28, c.lic_dia_facturacion || diaFacturacionDesde(inicioLic || periodoDate));
  const [y, m] = periodo.split("-").map(Number);
  const periodoInicio = new Date(y, m - 1, dia);
  const periodoFin = new Date(y, m, dia - 1); // día antes del siguiente ciclo
  if (finLic && periodoFin > finLic) periodoFin.setTime(finLic.getTime());

  const numero = numeroRecibo(c.id, periodo);
  const label = periodoLabel(periodo);
  const [[cl]] = await pool.query(
    `SELECT nombre, email FROM clinicas WHERE id=? LIMIT 1`, [c.id]
  );
  const [[ct]] = await pool.query(
    `SELECT cliente_nombre, plan_label FROM contratos_licencia WHERE numero=? LIMIT 1`,
    [c.lic_contrato_numero || ""]
  );
  const clienteNombre = ct?.cliente_nombre || cl?.nombre || null;
  const planLabel = ct?.plan_label || null;
  const emailDestino = cl?.email || null;
  const concepto = `Cuota mensual del servicio Medic-KG — ${label}`;

  const html = templateReciboMensual({
    numero, clinicaNombre: cl?.nombre || "Clínica", clienteNombre,
    contratoNumero: c.lic_contrato_numero || null, planLabel,
    periodoLabel: label, periodoInicio, periodoFin, concepto,
    monto, moneda, fechaEmision: new Date(),
  });

  let pdf = null;
  try { pdf = await generarPdfDesdeHtml(html, { paper_size: "HALF_LETTER", orientacion: "portrait" }); }
  catch (e) { console.error("[recibo pdf]", e.message); }

  await pool.query(
    `INSERT INTO recibos_licencia
       (numero, clinica_id, contrato_numero, licencia_historial_id, periodo,
        periodo_inicio, periodo_fin, concepto, monto, moneda, fecha_emision,
        estado, email_destino, pdf, generado_por, creado_por)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [numero, c.id, c.lic_contrato_numero || null, null, periodo,
     ymd(periodoInicio), ymd(periodoFin), concepto, monto, moneda, ymd(new Date()),
     "emitido", emailDestino, pdf, generadoPor, creadoPor]
  );

  let enviado = false, error = null;
  if (emailDestino) {
    try {
      await enviarEmail({
        to: emailDestino,
        subject: `Recibo ${numero} — cuota ${label} — Medic-KG`,
        html: templateReciboEmail({ clienteNombre, clinicaNombre: cl?.nombre || "Clínica", periodoLabel: label, monto, moneda }),
        attachments: pdf ? [{ filename: `recibo-${numero}.pdf`, content: pdf, contentType: "application/pdf" }] : [],
      });
      enviado = true;
      await pool.query("UPDATE recibos_licencia SET estado='enviado', enviado_en=NOW() WHERE numero=?", [numero]);
    } catch (e) {
      error = e.message;
      await pool.query("UPDATE recibos_licencia SET estado='error', error_msg=? WHERE numero=?", [String(e.message).slice(0, 300), numero]);
    }
  }

  return { creado: true, numero, enviado, error };
}

/** Reenvía por correo un recibo ya emitido. */
async function reenviarRecibo(reciboId) {
  const [[r]] = await pool.query("SELECT * FROM recibos_licencia WHERE id=? LIMIT 1", [reciboId]);
  if (!r) throw new Error("Recibo no encontrado");
  const [[cl]] = await pool.query("SELECT nombre, email FROM clinicas WHERE id=? LIMIT 1", [r.clinica_id]);
  const to = r.email_destino || cl?.email;
  if (!to) throw new Error("La clínica no tiene correo configurado");
  const label = periodoLabel(r.periodo);

  // Si el PDF no se generó en su momento (p. ej. Chromium no disponible),
  // se intenta regenerar ahora antes de reenviar.
  if (!r.pdf) {
    try {
      const [[ct]] = await pool.query(
        "SELECT cliente_nombre, plan_label FROM contratos_licencia WHERE numero=? LIMIT 1",
        [r.contrato_numero || ""]
      );
      const html = templateReciboMensual({
        numero: r.numero, clinicaNombre: cl?.nombre || "Clínica",
        clienteNombre: ct?.cliente_nombre || cl?.nombre || null,
        contratoNumero: r.contrato_numero || null, planLabel: ct?.plan_label || null,
        periodoLabel: label, periodoInicio: r.periodo_inicio, periodoFin: r.periodo_fin,
        concepto: r.concepto, monto: r.monto, moneda: r.moneda, fechaEmision: r.fecha_emision,
      });
      r.pdf = await generarPdfDesdeHtml(html, { paper_size: "HALF_LETTER", orientacion: "portrait" });
      if (r.pdf) await pool.query("UPDATE recibos_licencia SET pdf=? WHERE id=?", [r.pdf, reciboId]);
    } catch (e) { console.error("[recibo pdf regenerar]", e.message); }
  }

  await enviarEmail({
    to,
    subject: `Recibo ${r.numero} — cuota ${label} — Medic-KG`,
    html: templateReciboEmail({ clienteNombre: cl?.nombre, clinicaNombre: cl?.nombre || "Clínica", periodoLabel: label, monto: r.monto, moneda: r.moneda }),
    attachments: r.pdf ? [{ filename: `recibo-${r.numero}.pdf`, content: r.pdf, contentType: "application/pdf" }] : [],
  });
  await pool.query("UPDATE recibos_licencia SET estado='enviado', enviado_en=NOW(), error_msg=NULL WHERE id=?", [reciboId]);
  return { numero: r.numero, enviado: true };
}

module.exports = {
  mesesEntre, diaFacturacionDesde, periodoLabel, numeroContrato, numeroRecibo,
  emitirContrato, emitirReciboMes, reenviarRecibo,
};
