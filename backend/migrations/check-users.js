require("dotenv").config();
const pool = require("../db");

(async () => {
  const [users] = await pool.query(
    "SELECT id, nombres, apellidos, tipo, clinica_id, activo FROM usuarios ORDER BY id"
  );
  console.log("Usuarios en BD:");
  console.table(users);
  process.exit(0);
})();
