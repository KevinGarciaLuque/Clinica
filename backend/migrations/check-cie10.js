require("dotenv").config();
const pool = require("../db");

(async () => {
  const [tables] = await pool.query("SHOW TABLES LIKE 'cie10'");
  console.log("Tabla cie10 existe:", tables.length > 0);

  if (tables.length > 0) {
    const [[count]] = await pool.query("SELECT COUNT(*) AS total FROM cie10");
    console.log("Registros en cie10:", count.total);
  }
  process.exit(0);
})();
