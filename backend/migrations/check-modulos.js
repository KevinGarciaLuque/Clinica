const db = require('../db');
async function main() {
  const [tables] = await db.query("SHOW TABLES");
  const names = tables.map(t => Object.values(t)[0]);
  const modTables = names.filter(n => n.includes('modul'));
  console.log('Tablas con "modul":', modTables);

  for (const t of modTables) {
    const [rows] = await db.query(`SELECT * FROM ${t} WHERE clinica_id IN (9,6) LIMIT 20`).catch(() => [[]] );
    console.log(`\n${t}:`, JSON.stringify(rows, null, 2));
  }
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
