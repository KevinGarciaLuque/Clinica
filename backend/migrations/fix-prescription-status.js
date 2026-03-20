require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const pool = require("../db");

(async () => {
  try {
    await pool.query("UPDATE prescripciones SET estado = 'ACTIVA' WHERE id = 5");
    console.log('✅ Estado actualizado a ACTIVA');
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
