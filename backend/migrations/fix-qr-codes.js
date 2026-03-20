require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const pool = require("../db");

(async () => {
  try {
    // Actualizar prescripciones sin código QR
    await pool.query(`
      UPDATE prescripciones 
      SET codigo_qr = CONCAT('RX-', LPAD(id, 8, '0'))
      WHERE codigo_qr IS NULL
    `);
    
    console.log('✅ Códigos QR generados');
    
    const [rows] = await pool.query('SELECT id, codigo_qr, estado FROM prescripciones');
    console.table(rows);
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
