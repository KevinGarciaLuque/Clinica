const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  console.log('🚀 Iniciando migraciones de base de datos...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true
  });

  try {
    // 1. Ejecutar schema principal
    console.log('📋 Ejecutando schema.sql...');
    const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
    await connection.query(schema);
    console.log('✅ Schema creado correctamente');

    // 2. Ejecutar migraciones en orden
    const migrations = [
      '004_registro_pacientes.sql',
      '005_cie10_seed.sql',
      '006_tipos_clinica_modulos.sql',
      '007_galeria_estetica.sql',
      '008_ordenar_modulos.sql',
      '010_modulo_consulta.sql',
      '011_modulo_recordatorios.sql',
      '012_curva_crecimiento.sql',
      '013_catalogos.sql',
      '014_catalogos_estudios.sql',
      '015_clinica_pediatrica.sql',
      '016_datos_responsable.sql',
      '017_licencias.sql',
      '018_solicitudes_licencia.sql',
      '019_foto_cloudinary_pacientes.sql',
      '020_modulo_vacunas.sql',
      '021_nuevas_especialidades.sql',
      '022_modulo_vacunas_sidebar.sql',
      '023_medicamentos_honduras_seed.sql',
      '024_recetas_favoritas.sql',
      '025_medicamentos_favoritos.sql',
      '028_reportes_soporte.sql',
      '029_update_reportes_soporte.sql',
      '030_bitacora_accesos.sql',
      '031_diagnosticos_seed.sql',
      '032_estudios_pediatria_seed.sql',
      '033_verificaciones_email.sql',
      '034_estetica_modulos_dermatologia.sql',
      '035_fix_columnas_modulos_y_dermatologia.sql',
    ];

    for (const migration of migrations) {
      const filePath = path.join(__dirname, 'migrations', migration);
      if (fs.existsSync(filePath)) {
        console.log(`📋 Ejecutando ${migration}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        try {
          await connection.query(sql);
          console.log(`✅ ${migration} ejecutado correctamente`);
        } catch (migErr) {
          // Errores no críticos: columna duplicada, tabla ya existe, etc.
          if (migErr.code === 'ER_DUP_FIELDNAME' || migErr.code === 'ER_TABLE_EXISTS_ERROR' ||
              migErr.code === 'ER_DUP_ENTRY' || migErr.errno === 1060 || migErr.errno === 1050) {
            console.log(`⚠️  ${migration} ya aplicado (${migErr.code}), continuando...`);
          } else {
            throw migErr;
          }
        }
      } else {
        console.log(`⚠️  ${migration} no encontrado, saltando...`);
      }
    }

    console.log('🎉 Todas las migraciones se ejecutaron correctamente');
    
  } catch (error) {
    console.error('❌ Error al ejecutar migraciones:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Solo ejecutar si se llama directamente
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;
