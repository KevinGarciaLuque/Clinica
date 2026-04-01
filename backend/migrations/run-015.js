require("dotenv").config({ path: __dirname + "/../.env" });
const fs   = require("fs");
const path = require("path");
const pool = require("../db");

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "015_clinica_pediatrica.sql"), "utf8");
    const stmts = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s && !s.startsWith("--"));

    for (const stmt of stmts) {
      console.log("▸", stmt.substring(0, 80), "...");
      await pool.query(stmt);
    }
    console.log("✅ Migración 015 completada");
    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
})();
