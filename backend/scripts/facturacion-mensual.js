/**
 * scripts/facturacion-mensual.js
 * Emite los recibos mensuales de licencia. Idempotente: se puede correr
 * cuantas veces se quiera; solo genera el recibo del período que falte.
 *
 * Se ejecuta a diario desde el cron de server.js. Para cada clínica con
 * licencia de pago vigente:
 *   - si hoy es >= su día de facturación y aún no hay recibo del mes actual
 *   - y el mes actual es posterior al mes de contratación
 *   → emite el recibo por la cuota mensual y lo envía por correo.
 *
 * Uso manual:  node scripts/facturacion-mensual.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../db");
const { emitirReciboMes } = require("../utils/facturacionLicencias");

async function correr({ forzarDia = false } = {}) {
  const hoy = new Date();
  const diaHoy = hoy.getDate();
  const resumen = { revisadas: 0, emitidos: 0, enviados: 0, errores: 0, detalle: [] };

  const [clinicas] = await pool.query(
    `SELECT id, nombre, email, plan_tipo, licencia_inicio, licencia_fin,
            lic_monto_mensual, lic_moneda, lic_dia_facturacion, lic_contrato_numero
       FROM clinicas
      WHERE activo = 1
        AND lic_monto_mensual IS NOT NULL AND lic_monto_mensual > 0
        AND licencia_fin IS NOT NULL`
  );

  for (const c of clinicas) {
    resumen.revisadas++;
    const dia = Math.min(28, c.lic_dia_facturacion || 1);
    // Solo facturar a partir del día de facturación (permite ponerse al día
    // si el servidor estuvo caído ese día exacto).
    if (!forzarDia && diaHoy < dia) continue;

    try {
      const r = await emitirReciboMes({ clinica: c, periodoDate: hoy, generadoPor: "cron" });
      if (r.creado) {
        resumen.emitidos++;
        if (r.enviado) resumen.enviados++;
        if (r.error) resumen.errores++;
        resumen.detalle.push({ clinica: c.nombre, numero: r.numero, enviado: r.enviado, error: r.error || null });
      }
    } catch (e) {
      resumen.errores++;
      resumen.detalle.push({ clinica: c.nombre, error: e.message });
      console.error(`[facturacion-mensual] ${c.nombre}:`, e.message);
    }
  }

  console.log(`[facturacion-mensual] revisadas=${resumen.revisadas} emitidos=${resumen.emitidos} enviados=${resumen.enviados} errores=${resumen.errores}`);
  return resumen;
}

module.exports = correr;

if (require.main === module) {
  correr()
    .then(() => process.exit(0))
    .catch((e) => { console.error("💥", e.message); process.exit(1); });
}
