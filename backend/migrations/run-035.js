/**
 * run-035.js — Fix: columnas para_normal/para_pediatrica + módulos estéticos en Dermatología
 * Ejecutar: node migrations/run-035.js
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     Number(process.env.DB_PORT || 3306),
  });

  const step = async (desc, sql) => {
    try {
      const [r] = await conn.query(sql);
      const affected = r.affectedRows ?? r.length ?? "ok";
      console.log(`✅  ${desc} (${affected})`);
    } catch (e) {
      if ([1060, 1061, 1050].includes(e.errno)) {
        console.log(`⚠️  ${desc} — ya existe, saltando`);
      } else {
        console.error(`❌  ${desc}:`, e.message);
        throw e;
      }
    }
  };

  console.log("\n🚀 Iniciando migración 035...\n");

  // ── 1-4. Columnas faltantes ──────────────────────────────────────────
  await step(
    "Agregar columna 'orden' a modulos_sistema",
    "ALTER TABLE modulos_sistema ADD COLUMN orden INT UNSIGNED NOT NULL DEFAULT 999 AFTER ruta"
  );
  await step(
    "Agregar columna 'para_normal' a modulos_sistema",
    "ALTER TABLE modulos_sistema ADD COLUMN para_normal TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Visible en clínicas normales'"
  );
  await step(
    "Agregar columna 'para_pediatrica' a modulos_sistema",
    "ALTER TABLE modulos_sistema ADD COLUMN para_pediatrica TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Visible en clínicas pediátricas'"
  );
  await step(
    "Agregar columna 'es_pediatrica' a clinicas",
    "ALTER TABLE clinicas ADD COLUMN es_pediatrica TINYINT(1) NOT NULL DEFAULT 0 AFTER tipo_id"
  );

  // ── 5. Insertar módulos estéticos si no existen ──────────────────────
  await step("Insertar módulo ficha_estetica",
    `INSERT IGNORE INTO modulos_sistema (clave,nombre,icono,ruta,orden,descripcion,disponible,para_normal,para_pediatrica)
     VALUES ('ficha_estetica','Ficha Estética','bi-person-vcard-fill','/estetica/ficha',40,'Datos específicos del paciente estético',1,1,0)`);
  await step("Insertar módulo galeria_estetica",
    `INSERT IGNORE INTO modulos_sistema (clave,nombre,icono,ruta,orden,descripcion,disponible,para_normal,para_pediatrica)
     VALUES ('galeria_estetica','Galería Antes/Después','bi-images','/estetica/galeria',50,'Fotografías de evolución del paciente',1,1,0)`);
  await step("Insertar módulo presupuestos",
    `INSERT IGNORE INTO modulos_sistema (clave,nombre,icono,ruta,orden,descripcion,disponible,para_normal,para_pediatrica)
     VALUES ('presupuestos','Presupuestos','bi-receipt-cutoff','/estetica/presupuestos',60,'Cotizaciones y planes de tratamiento',1,1,0)`);
  await step("Insertar módulo consentimientos_esteticos",
    `INSERT IGNORE INTO modulos_sistema (clave,nombre,icono,ruta,orden,descripcion,disponible,para_normal,para_pediatrica)
     VALUES ('consentimientos_esteticos','Consentimientos','bi-file-earmark-check-fill','/estetica/consentimientos',70,'Consentimientos informados',1,1,0)`);
  await step("Insertar módulo seguimiento_postop",
    `INSERT IGNORE INTO modulos_sistema (clave,nombre,icono,ruta,orden,descripcion,disponible,para_normal,para_pediatrica)
     VALUES ('seguimiento_postop','Seguimiento Post-Op','bi-clipboard2-pulse-fill','/estetica/seguimiento',80,'Control post-operatorio',1,1,0)`);

  // ── 6. Actualizar flags de módulos estéticos ─────────────────────────
  await step("Marcar módulos estéticos como para_normal=1",
    `UPDATE modulos_sistema SET para_normal=1, para_pediatrica=0
     WHERE clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop')`);

  // ── 7. Asignar módulos base a todos los tipos ────────────────────────
  await step("Asignar módulos base a todos los tipos de clínica",
    `INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
     SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m
     WHERE m.clave IN ('dashboard','pacientes','citas','historia_clinica','chat_ia','estudios')`);

  // ── 8-9. Asignar módulos estéticos a 'estetica' y 'dermatologia' ─────
  await step("Asignar módulos estéticos al tipo 'estetica'",
    `INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
     SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m
     WHERE t.clave = 'estetica'
       AND m.clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop')`);
  await step("Asignar módulos estéticos al tipo 'dermatologia'",
    `INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
     SELECT t.id, m.id FROM tipos_clinica t CROSS JOIN modulos_sistema m
     WHERE t.clave = 'dermatologia'
       AND m.clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop')`);

  // ── Verificación ─────────────────────────────────────────────────────
  console.log("\n📋 Verificación — módulos estéticos por tipo:");
  const [rows] = await conn.query(`
    SELECT t.clave AS tipo, m.clave AS modulo, m.para_normal, m.orden
    FROM tipos_clinica t
    JOIN tipo_clinica_modulos tcm ON tcm.tipo_id = t.id
    JOIN modulos_sistema m ON m.id = tcm.modulo_id
    WHERE t.clave IN ('estetica','dermatologia')
      AND m.clave IN ('ficha_estetica','galeria_estetica','presupuestos','consentimientos_esteticos','seguimiento_postop')
    ORDER BY t.clave, m.orden
  `);
  console.table(rows);

  console.log("\n📋 Verificación — módulos que verá la clínica 15:");
  const [modsCli15] = await conn.query(`
    SELECT ms.clave, ms.nombre, ms.ruta, ms.para_normal, ms.orden
    FROM modulos_sistema ms
    INNER JOIN tipo_clinica_modulos tcm ON tcm.modulo_id = ms.id
    INNER JOIN clinicas c ON c.tipo_id = tcm.tipo_id
    WHERE c.id = 15 AND ms.disponible = 1 AND ms.para_normal = 1
    ORDER BY ms.orden
  `);
  if (modsCli15.length) {
    console.table(modsCli15);
  } else {
    console.log("⚠️  La clínica 15 no tiene tipo_id asignado o no hay módulos. Verificando tipo:");
    const [cli15] = await conn.query("SELECT id, nombre, slug, tipo_id FROM clinicas WHERE id=15");
    console.table(cli15);
  }

  await conn.end();
  console.log("\n🎉 Migración 035 completada.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
