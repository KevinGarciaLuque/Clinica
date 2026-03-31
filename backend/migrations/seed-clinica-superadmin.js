/**
 * Crea una clínica de prueba y asigna su ID al SUPER_ADMIN
 * Uso: node migrations/seed-clinica-superadmin.js
 */
const pool = require("../db");

const CLINICA = {
  nombre: "Clínica Estética Demo",
  slug: "demo",
  email: "demo@clinica.com",
  telefono: "999999999",
  direccion: "Av. Principal 123",
  ciudad: "Lima",
  pais: "PE",
};

(async () => {
  try {
    // 1. Verificar si ya existe una clínica con ese slug
    const [exist] = await pool.query(
      "SELECT id, nombre FROM clinicas WHERE slug = ?",
      [CLINICA.slug]
    );

    let clinicaId;

    if (exist.length) {
      clinicaId = exist[0].id;
      console.log(`ℹ️  Clínica ya existe: id=${clinicaId} "${exist[0].nombre}"`);
    } else {
      const [r] = await pool.query(
        `INSERT INTO clinicas (nombre, slug, email, telefono, direccion, ciudad, pais)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [CLINICA.nombre, CLINICA.slug, CLINICA.email,
         CLINICA.telefono, CLINICA.direccion, CLINICA.ciudad, CLINICA.pais]
      );
      clinicaId = r.insertId;
      console.log(`✅  Clínica creada: id=${clinicaId} "${CLINICA.nombre}"`);
    }

    // 2. Asignar clinica_id al SUPER_ADMIN (para que pueda crear usuarios)
    const [updated] = await pool.query(
      `UPDATE usuarios SET clinica_id = ? WHERE tipo = 'SUPER_ADMIN' AND (clinica_id IS NULL OR clinica_id = 0)`,
      [clinicaId]
    );

    if (updated.affectedRows > 0) {
      console.log(`✅  SUPER_ADMIN actualizado con clinica_id = ${clinicaId}`);
    } else {
      console.log(`ℹ️  SUPER_ADMIN ya tiene clinica_id asignado`);
    }

    // 3. Mostrar resumen
    const [admins] = await pool.query(
      "SELECT id, nombres, apellidos, email, clinica_id FROM usuarios WHERE tipo = 'SUPER_ADMIN'"
    );
    console.log("\n📋 Super Admins:");
    admins.forEach(a => {
      console.log(`   id=${a.id} ${a.nombres} ${a.apellidos} (${a.email}) → clinica_id=${a.clinica_id}`);
    });

    const [clinicas] = await pool.query("SELECT id, nombre, slug FROM clinicas");
    console.log("\n🏥 Clínicas:");
    clinicas.forEach(c => {
      console.log(`   id=${c.id} "${c.nombre}" (slug: ${c.slug})`);
    });

  } catch (err) {
    console.error("❌  Error:", err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
