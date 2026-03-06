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
      '008_ordenar_modulos.sql'
    ];

    for (const migration of migrations) {
      const filePath = path.join(__dirname, 'migrations', migration);
      if (fs.existsSync(filePath)) {
        console.log(`📋 Ejecutando ${migration}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        await connection.query(sql);
        console.log(`✅ ${migration} ejecutado correctamente`);
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
