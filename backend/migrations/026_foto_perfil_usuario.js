const pool = require("../db");

async function run() {
  const [cols] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='usuarios' AND COLUMN_NAME='foto_url'"
  );
  if (cols.length) {
    console.log("foto_url ya existe en usuarios");
  } else {
    await pool.query("ALTER TABLE usuarios ADD COLUMN foto_url VARCHAR(500) NULL");
    console.log("Columna foto_url agregada a usuarios");
  }
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
