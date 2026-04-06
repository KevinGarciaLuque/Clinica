require("dotenv").config();
const db = require("./db");

(async () => {
  const [r1] = await db.query("SELECT NOW() as now_mysql, @@global.time_zone as tz_global, @@session.time_zone as tz_session");
  console.log("MySQL NOW():", r1[0]);

  const [r2] = await db.query("SELECT id, inicio FROM citas WHERE id = 21");
  console.log("Cita #21 inicio:", r2[0]);

  const ahora = new Date();
  const inicio = new Date(ahora.getTime() + 23 * 60 * 60 * 1000);
  const fin   = new Date(ahora.getTime() + 25 * 60 * 60 * 1000);
  console.log("\nJS ahora (local):", ahora.toLocaleString());
  console.log("JS ahora (ISO):", ahora.toISOString());
  console.log("JS inicio ventana (local):", inicio.toLocaleString());
  console.log("JS inicio ventana (ISO):", inicio.toISOString());
  console.log("JS fin ventana (local):", fin.toLocaleString());

  const [r3] = await db.query(
    "SELECT id, inicio FROM citas WHERE id = 21 AND inicio BETWEEN ? AND ?",
    [inicio, fin]
  );
  console.log("\nCita #21 en BETWEEN?", r3.length > 0 ? "SI ✅" : "NO ❌");

  // Intentar con strings directos (sin objetos Date)
  const inicioStr = inicio.toISOString().replace("T", " ").substring(0, 19);
  const finStr = fin.toISOString().replace("T", " ").substring(0, 19);
  console.log("\nBUSCANDO CON STRING UTC:", inicioStr, "—", finStr);
  const [r4] = await db.query(
    "SELECT id, inicio FROM citas WHERE id = 21 AND inicio BETWEEN ? AND ?",
    [inicioStr, finStr]
  );
  console.log("Resultado con UTC string:", r4.length > 0 ? "SI ✅" : "NO ❌");

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
