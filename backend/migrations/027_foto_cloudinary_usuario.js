const pool = require("../db");
async function run() {
  const [c] = await pool.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='usuarios' AND COLUMN_NAME='foto_cloudinary_id'"
  );
  if (c.length) { console.log("foto_cloudinary_id ya existe"); }
  else {
    await pool.query("ALTER TABLE usuarios ADD COLUMN foto_cloudinary_id VARCHAR(255) NULL");
    console.log("Columna foto_cloudinary_id agregada");
  }
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
