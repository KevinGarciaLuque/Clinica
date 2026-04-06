const pool = require("../db");
async function run() {
  const [med] = await pool.query("SELECT id, nombre_generico, nombre_comercial, presentacion, via_administracion, dosis_default FROM medicamentos LIMIT 20");
  console.log("MEDICAMENTOS:", JSON.stringify(med, null, 1));
  const [prescCols] = await pool.query("DESCRIBE prescripciones");
  console.log("PRESC COLS:", prescCols.map(c => c.Field + ":" + c.Type).join(", "));
  const [itemCols] = await pool.query("DESCRIBE prescripcion_items");
  console.log("PRESC_ITEMS COLS:", itemCols.map(c => c.Field + ":" + c.Type).join(", "));
  const [cie] = await pool.query("SELECT codigo, descripcion FROM cie10 WHERE codigo IN ('I10','J06.9','K21','E11.9','M54.5','J18.9','K29.7','I20.9','J45','R51') LIMIT 10");
  console.log("CIE10:", JSON.stringify(cie, null, 1));
  const [est_res_cols] = await pool.query("DESCRIBE estudios_resultados");
  console.log("ESTUDIOS_RESULTADOS COLS:", est_res_cols.map(c => c.Field + ":" + c.Type).join(", "));
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
