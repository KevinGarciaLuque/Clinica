require("dotenv").config();
const db = require("./db");

async function check() {
  const [smtp] = await db.query("SELECT id, smtp_host, smtp_user, from_email, activo FROM clinica_smtp_config LIMIT 5");
  console.log("\nSMTP CONFIG:", smtp.length ? `✅ ${smtp[0].smtp_host} | ${smtp[0].smtp_user} | activo=${smtp[0].activo}` : "❌ No configurado");

  const [rcfg] = await db.query("SELECT email_activo, email_24h, email_48h, email_2h FROM clinica_recordatorios_config LIMIT 5");
  console.log("RECORDATORIOS CONFIG:", rcfg.length ? JSON.stringify(rcfg[0]) : "❌ No existe");

  const [plantillas] = await db.query("SELECT id, tipo, horas_antes, activo, nombre FROM plantillas_recordatorio WHERE tipo = 'EMAIL'");
  console.log("PLANTILLAS EMAIL:", plantillas.length ? plantillas.map(p => `${p.nombre} (${p.horas_antes}h, activo=${p.activo})`).join(", ") : "❌ Ninguna");

  process.exit(0);
}

check().catch(e => { console.error(e.message); process.exit(1); });
