require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

(async () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "005_cie10_seed.sql"),
    "utf8"
  );

  // Ejecutar todo el INSERT IGNORE de una sola vez
  try {
    await pool.query(sql);
    console.log("✅ Seed CIE-10 cargado correctamente.");
  } catch (e) {
    console.log("❌ Error:", e.message);
  }

  const [[count]] = await pool.query("SELECT COUNT(*) AS total FROM cie10");
  console.log(`   Total registros cie10: ${count.total}`);
  process.exit(0);
})();
