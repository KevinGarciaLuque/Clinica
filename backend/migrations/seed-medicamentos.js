/**
 * Seed: Catálogo de medicamentos comunes
 * Ejecutar: node backend/migrations/seed-medicamentos.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../db");

const medicamentos = [
  // Analgésicos / Antipiréticos
  { nombre_generico: "Paracetamol",          nombre_comercial: "Panadol / Tylenol",    presentacion: "Tableta 500mg",        via_administracion: "Oral" },
  { nombre_generico: "Paracetamol",          nombre_comercial: "Tempra",               presentacion: "Jarabe 120mg/5ml",     via_administracion: "Oral" },
  { nombre_generico: "Ibuprofeno",           nombre_comercial: "Advil / Motrin",       presentacion: "Tableta 400mg",        via_administracion: "Oral" },
  { nombre_generico: "Ibuprofeno",           nombre_comercial: "Ibupirac",             presentacion: "Tableta 600mg",        via_administracion: "Oral" },
  { nombre_generico: "Naproxeno",            nombre_comercial: "Naprosyn",             presentacion: "Tableta 500mg",        via_administracion: "Oral" },
  { nombre_generico: "Metamizol",            nombre_comercial: "Dipirona / Novalcina", presentacion: "Tableta 500mg",        via_administracion: "Oral" },
  { nombre_generico: "Metamizol",            nombre_comercial: "Dipirona inyectable",  presentacion: "Ampolla 1g/2ml",       via_administracion: "IV / IM" },
  { nombre_generico: "Ketorolaco",           nombre_comercial: "Toradol",              presentacion: "Tableta 10mg",         via_administracion: "Oral" },
  { nombre_generico: "Tramadol",             nombre_comercial: "Tramal",               presentacion: "Cápsula 50mg",         via_administracion: "Oral" },

  // Antibióticos
  { nombre_generico: "Amoxicilina",          nombre_comercial: "Amoxil",               presentacion: "Cápsula 500mg",        via_administracion: "Oral" },
  { nombre_generico: "Amoxicilina + Ácido clavulánico", nombre_comercial: "Augmentin",presentacion: "Tableta 875/125mg",    via_administracion: "Oral" },
  { nombre_generico: "Azitromicina",         nombre_comercial: "Zithromax",            presentacion: "Tableta 500mg",        via_administracion: "Oral" },
  { nombre_generico: "Claritromicina",       nombre_comercial: "Klaricid",             presentacion: "Tableta 500mg",        via_administracion: "Oral" },
  { nombre_generico: "Ciprofloxacino",       nombre_comercial: "Ciprobay",             presentacion: "Tableta 500mg",        via_administracion: "Oral" },
  { nombre_generico: "Levofloxacino",        nombre_comercial: "Tavanic",              presentacion: "Tableta 500mg",        via_administracion: "Oral" },
  { nombre_generico: "Doxiciclina",          nombre_comercial: "Vibramycin",           presentacion: "Cápsula 100mg",        via_administracion: "Oral" },
  { nombre_generico: "Metronidazol",         nombre_comercial: "Flagyl",               presentacion: "Tableta 500mg",        via_administracion: "Oral" },
  { nombre_generico: "Ceftriaxona",          nombre_comercial: "Rocephin",             presentacion: "Frasco 1g inyectable", via_administracion: "IV / IM" },
  { nombre_generico: "Trimetoprima + Sulfametoxazol", nombre_comercial: "Bactrim",     presentacion: "Tableta 160/800mg",    via_administracion: "Oral" },

  // Antiinflamatorios / Corticoides
  { nombre_generico: "Diclofenaco",          nombre_comercial: "Voltaren",             presentacion: "Tableta 50mg",         via_administracion: "Oral" },
  { nombre_generico: "Diclofenaco",          nombre_comercial: "Voltaren inyectable",  presentacion: "Ampolla 75mg/3ml",     via_administracion: "IM" },
  { nombre_generico: "Prednisona",           nombre_comercial: "Meticorten",           presentacion: "Tableta 5mg",          via_administracion: "Oral" },
  { nombre_generico: "Prednisona",           nombre_comercial: "Meticorten",           presentacion: "Tableta 20mg",         via_administracion: "Oral" },
  { nombre_generico: "Dexametasona",         nombre_comercial: "Decadrón",             presentacion: "Ampolla 4mg/ml",       via_administracion: "IV / IM" },
  { nombre_generico: "Betametasona",         nombre_comercial: "Celestone",            presentacion: "Ampolla 4mg/ml",       via_administracion: "IM" },

  // Gastrointestinales
  { nombre_generico: "Omeprazol",            nombre_comercial: "Prilosec / Losec",     presentacion: "Cápsula 20mg",         via_administracion: "Oral" },
  { nombre_generico: "Pantoprazol",          nombre_comercial: "Protonix",             presentacion: "Tableta 40mg",         via_administracion: "Oral" },
  { nombre_generico: "Ranitidina",           nombre_comercial: "Zantac",               presentacion: "Tableta 150mg",        via_administracion: "Oral" },
  { nombre_generico: "Metoclopramida",       nombre_comercial: "Primperan",            presentacion: "Tableta 10mg",         via_administracion: "Oral" },
  { nombre_generico: "Metoclopramida",       nombre_comercial: "Primperan inyectable", presentacion: "Ampolla 10mg/2ml",     via_administracion: "IV / IM" },
  { nombre_generico: "Dimenhidrinato",       nombre_comercial: "Dramamine",            presentacion: "Tableta 50mg",         via_administracion: "Oral" },
  { nombre_generico: "Loperamida",           nombre_comercial: "Imodium",              presentacion: "Cápsula 2mg",          via_administracion: "Oral" },
  { nombre_generico: "Sulfato de magnesio",  nombre_comercial: "Leche de Magnesia",    presentacion: "Suspensión oral",      via_administracion: "Oral" },

  // Respiratorio
  { nombre_generico: "Salbutamol",           nombre_comercial: "Ventolin",             presentacion: "Inhalador 100mcg",     via_administracion: "Inhalado" },
  { nombre_generico: "Budesonida",           nombre_comercial: "Pulmicort",            presentacion: "Inhalador 200mcg",     via_administracion: "Inhalado" },
  { nombre_generico: "Ambroxol",             nombre_comercial: "Mucosolvan",           presentacion: "Jarabe 30mg/5ml",      via_administracion: "Oral" },
  { nombre_generico: "Loratadina",           nombre_comercial: "Claritin",             presentacion: "Tableta 10mg",         via_administracion: "Oral" },
  { nombre_generico: "Cetirizina",           nombre_comercial: "Zyrtec",               presentacion: "Tableta 10mg",         via_administracion: "Oral" },
  { nombre_generico: "Desloratadina",        nombre_comercial: "Aerius",               presentacion: "Tableta 5mg",          via_administracion: "Oral" },
  { nombre_generico: "Codeína + Guaifenesina",nombre_comercial: "Benylin",             presentacion: "Jarabe",               via_administracion: "Oral" },

  // Cardiovascular / HTA
  { nombre_generico: "Enalapril",            nombre_comercial: "Renitec / Vasotec",    presentacion: "Tableta 10mg",         via_administracion: "Oral" },
  { nombre_generico: "Losartán",             nombre_comercial: "Cozaar",               presentacion: "Tableta 50mg",         via_administracion: "Oral" },
  { nombre_generico: "Amlodipino",           nombre_comercial: "Norvasc",              presentacion: "Tableta 5mg",          via_administracion: "Oral" },
  { nombre_generico: "Metoprolol",           nombre_comercial: "Lopressor",            presentacion: "Tableta 50mg",         via_administracion: "Oral" },
  { nombre_generico: "Atenolol",             nombre_comercial: "Tenormin",             presentacion: "Tableta 50mg",         via_administracion: "Oral" },
  { nombre_generico: "Furosemida",           nombre_comercial: "Lasix",                presentacion: "Tableta 40mg",         via_administracion: "Oral" },
  { nombre_generico: "Espironolactona",      nombre_comercial: "Aldactone",            presentacion: "Tableta 25mg",         via_administracion: "Oral" },
  { nombre_generico: "Ácido acetilsalicílico",nombre_comercial:"Aspirina",             presentacion: "Tableta 100mg",        via_administracion: "Oral" },
  { nombre_generico: "Atorvastatina",        nombre_comercial: "Lipitor",              presentacion: "Tableta 20mg",         via_administracion: "Oral" },
  { nombre_generico: "Simvastatina",         nombre_comercial: "Zocor",                presentacion: "Tableta 20mg",         via_administracion: "Oral" },
  { nombre_generico: "Clopidogrel",          nombre_comercial: "Plavix",               presentacion: "Tableta 75mg",         via_administracion: "Oral" },

  // Diabetes
  { nombre_generico: "Metformina",           nombre_comercial: "Glucophage",           presentacion: "Tableta 850mg",        via_administracion: "Oral" },
  { nombre_generico: "Glibenclamida",        nombre_comercial: "Daonil",               presentacion: "Tableta 5mg",          via_administracion: "Oral" },
  { nombre_generico: "Insulina regular",     nombre_comercial: "Humulin R",            presentacion: "Frasco 100UI/ml",      via_administracion: "SC / IV" },
  { nombre_generico: "Insulina NPH",         nombre_comercial: "Humulin N",            presentacion: "Frasco 100UI/ml",      via_administracion: "SC" },

  // Sistema nervioso
  { nombre_generico: "Diazepam",             nombre_comercial: "Valium",               presentacion: "Tableta 5mg",          via_administracion: "Oral" },
  { nombre_generico: "Alprazolam",           nombre_comercial: "Xanax",               presentacion: "Tableta 0.5mg",        via_administracion: "Oral" },
  { nombre_generico: "Clonazepam",           nombre_comercial: "Rivotril",             presentacion: "Tableta 0.5mg",        via_administracion: "Oral" },
  { nombre_generico: "Amitriptilina",        nombre_comercial: "Tryptanol",            presentacion: "Tableta 25mg",         via_administracion: "Oral" },
  { nombre_generico: "Fluoxetina",           nombre_comercial: "Prozac",               presentacion: "Cápsula 20mg",         via_administracion: "Oral" },
  { nombre_generico: "Sertralina",           nombre_comercial: "Zoloft",               presentacion: "Tableta 50mg",         via_administracion: "Oral" },
  { nombre_generico: "Carbamazepina",        nombre_comercial: "Tegretol",             presentacion: "Tableta 200mg",        via_administracion: "Oral" },
  { nombre_generico: "Ácido valproico",      nombre_comercial: "Depakote",             presentacion: "Tableta 500mg",        via_administracion: "Oral" },

  // Vitaminas / Suplementos
  { nombre_generico: "Vitamina C (Ácido ascórbico)", nombre_comercial: "Redoxon",      presentacion: "Tableta 1g",           via_administracion: "Oral" },
  { nombre_generico: "Vitamina D3",          nombre_comercial: "Vigantol",             presentacion: "Gotas 500UI/gota",     via_administracion: "Oral" },
  { nombre_generico: "Sulfato ferroso",      nombre_comercial: "Fer-In-Sol",           presentacion: "Tableta 325mg",        via_administracion: "Oral" },
  { nombre_generico: "Ácido fólico",         nombre_comercial: "Folifer",              presentacion: "Tableta 5mg",          via_administracion: "Oral" },
  { nombre_generico: "Calcio + Vitamina D",  nombre_comercial: "Caltrate",             presentacion: "Tableta 600mg",        via_administracion: "Oral" },
  { nombre_generico: "Complejo B",           nombre_comercial: "Neurobión",            presentacion: "Tableta",              via_administracion: "Oral" },

  // Antiparasitarios / Antifúngicos
  { nombre_generico: "Albendazol",           nombre_comercial: "Zentel",               presentacion: "Tableta 400mg",        via_administracion: "Oral" },
  { nombre_generico: "Mebendazol",           nombre_comercial: "Vermox",               presentacion: "Tableta 100mg",        via_administracion: "Oral" },
  { nombre_generico: "Fluconazol",           nombre_comercial: "Diflucan",             presentacion: "Cápsula 150mg",        via_administracion: "Oral" },
  { nombre_generico: "Nistatina",            nombre_comercial: "Mycostatin",           presentacion: "Suspensión oral 100.000UI/ml", via_administracion: "Oral" },

  // Uso tópico / Oftálmico
  { nombre_generico: "Mupirocina",           nombre_comercial: "Bactroban",            presentacion: "Crema 2%",             via_administracion: "Tópico" },
  { nombre_generico: "Hidrocortisona",       nombre_comercial: "Cortaid",              presentacion: "Crema 1%",             via_administracion: "Tópico" },
  { nombre_generico: "Clotrimazol",          nombre_comercial: "Canesten",             presentacion: "Crema 1%",             via_administracion: "Tópico" },
  { nombre_generico: "Ciprofloxacino oftálmico", nombre_comercial: "Ciloxan",          presentacion: "Colirio 0.3%",         via_administracion: "Oftálmico" },
  { nombre_generico: "Tobramicina oftálmica",nombre_comercial: "Tobrex",               presentacion: "Colirio 0.3%",         via_administracion: "Oftálmico" },
];

async function main() {
  let insertados = 0;
  let omitidos   = 0;

  for (const m of medicamentos) {
    try {
      await pool.query(
        `INSERT IGNORE INTO medicamentos
           (nombre_generico, nombre_comercial, presentacion, via_administracion, activo)
         VALUES (?, ?, ?, ?, 1)`,
        [m.nombre_generico, m.nombre_comercial, m.presentacion, m.via_administracion]
      );
      insertados++;
    } catch (e) {
      omitidos++;
      console.warn("  Omitido:", m.nombre_generico, m.presentacion, "→", e.message);
    }
  }

  console.log(`✅  Seed completado: ${insertados} medicamentos insertados, ${omitidos} omitidos.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
