// Script único para insertar tipos de cita en la clínica de Gina (ID=17)
const pool = require("./db");

async function run() {
  const gCid = 17;

  const [[{ n }]] = await pool.query(
    "SELECT COUNT(*) AS n FROM catalogos_tipos_cita WHERE clinica_id = ? AND activo = 1",
    [gCid]
  );

  if (n > 0) {
    console.log(`Ya existen ${n} tipos de cita para clínica ${gCid}. Nada que hacer.`);
    process.exit(0);
  }

  const tipos = [
    "Consulta dermatológica primera vez",
    "Consulta dermatológica control",
    "Consulta estética",
    "Consulta pediátrica dermatológica",
    "Consulta de urgencia dermatológica",
    "Consulta online",
    "Revisión postprocedimiento",
    "Retiro de puntos",
    "Curación postquirúrgica",
    "Evaluación preláser",
    "Evaluación postláser",
  ];

  for (let i = 0; i < tipos.length; i++) {
    await pool.query(
      "INSERT INTO catalogos_tipos_cita (clinica_id, nombre, orden) VALUES (?, ?, ?)",
      [gCid, tipos[i], i + 1]
    );
    console.log(`✅ Insertado: ${tipos[i]}`);
  }
  console.log(`\n✅ ${tipos.length} tipos de cita insertados para clínica ${gCid}.`);
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
