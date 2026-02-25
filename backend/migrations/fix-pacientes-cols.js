require("dotenv").config();
const pool = require("../db");

const cols = [
  "ALTER TABLE pacientes ADD COLUMN foto_perfil VARCHAR(255) NULL AFTER direccion",
  "ALTER TABLE pacientes ADD COLUMN ciudad VARCHAR(100) NULL AFTER foto_perfil",
  "ALTER TABLE pacientes ADD COLUMN pais VARCHAR(100) NULL DEFAULT 'Peru' AFTER ciudad",
  "ALTER TABLE pacientes ADD COLUMN email_verificado TINYINT(1) NOT NULL DEFAULT 0 AFTER grupo_sanguineo",
  "ALTER TABLE pacientes ADD COLUMN registro_self TINYINT(1) NOT NULL DEFAULT 0 AFTER email_verificado",
  "ALTER TABLE pacientes ADD COLUMN notas TEXT NULL AFTER registro_self",
];

(async () => {
  for (const sql of cols) {
    try {
      await pool.query(sql);
      console.log("✅ OK:", sql.slice(0, 70));
    } catch (e) {
      if (e.code === "ER_DUP_FIELDNAME") {
        console.log("⚠️  Ya existe:", sql.slice(27, 55));
      } else {
        console.log("❌ ERR:", e.message);
      }
    }
  }
  console.log("\nListo.");
  process.exit(0);
})();
