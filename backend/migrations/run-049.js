/**
 * run-049.js — Seed diagnósticos CIE-10 Capítulo 14 (N00-N99) para clínicas de Nefrología
 * Se insertan con clinica_id = NULL (globales) y especialidad = 'nefrologia'
 * → Aparecen automáticamente en cualquier clínica de nefrología sin duplicar datos.
 *
 * Ejecutar: node migrations/run-049.js
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

const ESPECIALIDAD = "nefrologia";

// CIE-10 Cap. 14 — Enfermedades del aparato genitourinario (N00-N99)
// Solo los códigos más relevantes para la práctica nefrológica
const DIAGNOSTICOS = [
  // ─── Enfermedades glomerulares ───────────────────────────────────────────
  { codigo: "N00",   nombre: "Síndrome nefrítico agudo",                                   desc: "Síndrome nefrítico agudo, sin especificar" },
  { codigo: "N00.0", nombre: "Síndrome nefrítico agudo - lesión glomerular mínima",        desc: "Síndrome nefrítico agudo con lesión glomerular mínima" },
  { codigo: "N00.1", nombre: "Síndrome nefrítico agudo - glomeruloesclerosis focal",       desc: "Síndrome nefrítico agudo con lesiones glomerulares focales y segmentarias" },
  { codigo: "N00.2", nombre: "Síndrome nefrítico agudo - GN membranoproliferativa",        desc: "Síndrome nefrítico agudo con glomerulonefritis membranoproliferativa difusa" },
  { codigo: "N00.3", nombre: "Síndrome nefrítico agudo - GN mesangial proliferativa",     desc: "Síndrome nefrítico agudo con glomerulonefritis mesangial proliferativa difusa" },
  { codigo: "N00.4", nombre: "Síndrome nefrítico agudo - GN endocapilar proliferativa",   desc: "Síndrome nefrítico agudo con glomerulonefritis endocapilar proliferativa difusa" },
  { codigo: "N00.9", nombre: "Síndrome nefrítico agudo - no especificado",                 desc: "Síndrome nefrítico agudo con lesión morfológica no especificada" },

  { codigo: "N01",   nombre: "Síndrome nefrítico rápidamente progresivo",                  desc: "Síndrome nefrítico rápidamente progresivo, sin especificar" },
  { codigo: "N01.0", nombre: "Síndrome nefrítico rápidamente progresivo - lesión mínima",  desc: "SNRP con lesión glomerular mínima" },
  { codigo: "N01.2", nombre: "Síndrome nefrítico rápidamente progresivo - GN membranoproliferativa", desc: "SNRP con glomerulonefritis membranoproliferativa difusa" },
  { codigo: "N01.9", nombre: "Síndrome nefrítico rápidamente progresivo - no especificado", desc: "SNRP con lesión morfológica no especificada" },

  { codigo: "N02",   nombre: "Hematuria recurrente y persistente",                         desc: "Hematuria recurrente y persistente" },
  { codigo: "N02.0", nombre: "Hematuria recurrente - lesión glomerular mínima",            desc: "Hematuria recurrente y persistente con lesión glomerular mínima" },
  { codigo: "N02.9", nombre: "Hematuria recurrente - no especificada",                     desc: "Hematuria recurrente y persistente con lesión no especificada" },

  { codigo: "N03",   nombre: "Síndrome nefrítico crónico",                                 desc: "Síndrome nefrítico crónico" },
  { codigo: "N03.0", nombre: "Síndrome nefrítico crónico - lesión glomerular mínima",      desc: "Síndrome nefrítico crónico con lesión glomerular mínima" },
  { codigo: "N03.2", nombre: "Síndrome nefrítico crónico - GN membranoproliferativa",      desc: "Síndrome nefrítico crónico con glomerulonefritis membranoproliferativa difusa" },
  { codigo: "N03.5", nombre: "Síndrome nefrítico crónico - GN difusa mesangiocapilar",     desc: "Síndrome nefrítico crónico con glomerulonefritis mesangiocapilar difusa" },
  { codigo: "N03.9", nombre: "Síndrome nefrítico crónico - no especificado",               desc: "Síndrome nefrítico crónico con lesión morfológica no especificada" },

  { codigo: "N04",   nombre: "Síndrome nefrótico",                                         desc: "Síndrome nefrótico" },
  { codigo: "N04.0", nombre: "Síndrome nefrótico - lesión glomerular mínima",              desc: "Síndrome nefrótico con lesión glomerular mínima (enfermedad de cambios mínimos)" },
  { codigo: "N04.1", nombre: "Síndrome nefrótico - glomeruloesclerosis focal segmentaria", desc: "Síndrome nefrótico con lesiones glomerulares focales y segmentarias (GEFS)" },
  { codigo: "N04.2", nombre: "Síndrome nefrótico - GN membranosa difusa",                  desc: "Síndrome nefrótico con glomerulonefritis membranosa difusa" },
  { codigo: "N04.3", nombre: "Síndrome nefrótico - GN mesangial proliferativa",            desc: "Síndrome nefrótico con glomerulonefritis mesangial proliferativa difusa" },
  { codigo: "N04.5", nombre: "Síndrome nefrótico - GN mesangiocapilar difusa",             desc: "Síndrome nefrótico con glomerulonefritis mesangiocapilar difusa" },
  { codigo: "N04.9", nombre: "Síndrome nefrótico - no especificado",                       desc: "Síndrome nefrótico con lesión morfológica no especificada" },

  { codigo: "N05",   nombre: "Síndrome nefrítico no especificado",                         desc: "Síndrome nefrítico no especificado" },
  { codigo: "N05.9", nombre: "Síndrome nefrítico no especificado - lesión no especificada",desc: "Síndrome nefrítico no especificado con lesión morfológica no especificada" },

  { codigo: "N06",   nombre: "Proteinuria aislada con lesión morfológica",                 desc: "Proteinuria aislada con lesión morfológica especificada" },
  { codigo: "N06.9", nombre: "Proteinuria aislada - no especificada",                      desc: "Proteinuria aislada con lesión morfológica no especificada" },

  { codigo: "N07",   nombre: "Nefropatía hereditaria no clasificada en otra parte",        desc: "Nefropatía hereditaria, no clasificada en otra parte" },
  { codigo: "N07.9", nombre: "Nefropatía hereditaria - no especificada",                   desc: "Nefropatía hereditaria no clasificada en otra parte, no especificada" },

  { codigo: "N08.3", nombre: "Trastornos glomerulares en diabetes mellitus",               desc: "Trastornos glomerulares en la diabetes mellitus (nefropatía diabética)" },
  { codigo: "N08.5", nombre: "Trastornos glomerulares en enfermedades del tejido conjuntivo", desc: "Trastornos glomerulares en enfermedades del tejido conjuntivo (lupus, etc.)" },
  { codigo: "N08.2", nombre: "Trastornos glomerulares en amiloidosis",                     desc: "Trastornos glomerulares en la amiloidosis" },
  { codigo: "N08.0", nombre: "Trastornos glomerulares en enfermedades infecciosas",        desc: "Trastornos glomerulares en enfermedades infecciosas y parasitarias" },

  // ─── Enfermedades tubulointersticiales ──────────────────────────────────
  { codigo: "N10",   nombre: "Nefritis tubuloinstersticial aguda",                         desc: "Nefritis tubuloinstersticial aguda (pielonefritis aguda)" },
  { codigo: "N11",   nombre: "Nefritis tubuloinstersticial crónica",                       desc: "Nefritis tubuloinstersticial crónica" },
  { codigo: "N11.0", nombre: "Pielonefritis crónica no obstructiva",                       desc: "Pielonefritis crónica no obstructiva asociada con reflujo" },
  { codigo: "N11.1", nombre: "Pielonefritis crónica obstructiva",                          desc: "Pielonefritis crónica obstructiva" },
  { codigo: "N11.8", nombre: "Nefritis tubuloinstersticial crónica - otras",               desc: "Otras nefritis tubuloinstersticial crónica" },
  { codigo: "N11.9", nombre: "Nefritis tubuloinstersticial crónica - no especificada",     desc: "Nefritis tubuloinstersticial crónica no especificada" },
  { codigo: "N12",   nombre: "Nefritis tubuloinstersticial - no especificada",             desc: "Nefritis tubuloinstersticial, no especificada como aguda o crónica" },
  { codigo: "N13",   nombre: "Uropatía obstructiva y por reflujo",                         desc: "Uropatía obstructiva y por reflujo" },
  { codigo: "N13.1", nombre: "Hidronefrosis con obstrucción ureteral",                     desc: "Hidronefrosis con obstrucción de la unión ureteropélvica" },
  { codigo: "N13.2", nombre: "Hidronefrosis con obstrucción por cálculo",                  desc: "Hidronefrosis con obstrucción por cálculo renal y ureteral" },
  { codigo: "N13.3", nombre: "Hidronefrosis - otras sin obstrucción",                      desc: "Otras hidronefrosis y las no especificadas" },
  { codigo: "N14.0", nombre: "Nefropatía por analgésicos",                                 desc: "Nefropatía por analgésicos" },
  { codigo: "N14.1", nombre: "Nefropatía por otras drogas y medicamentos",                 desc: "Nefropatía por otras drogas y medicamentos" },
  { codigo: "N14.2", nombre: "Nefropatía por metales pesados",                             desc: "Nefropatía por metales pesados (plomo, cadmio, mercurio)" },
  { codigo: "N14.3", nombre: "Nefropatía por contraste",                                   desc: "Nefropatía por medios de contraste" },
  { codigo: "N15.9", nombre: "Otras enfermedades tubulointersticiales - no especificadas", desc: "Otras enfermedades tubulointersticiales del riñón no especificadas" },

  // ─── Insuficiencia renal ─────────────────────────────────────────────────
  { codigo: "N17",   nombre: "Lesión renal aguda (IRA)",                                   desc: "Lesión renal aguda / Insuficiencia renal aguda" },
  { codigo: "N17.0", nombre: "IRA con necrosis tubular",                                   desc: "Lesión renal aguda con necrosis tubular" },
  { codigo: "N17.1", nombre: "IRA con necrosis cortical aguda",                            desc: "Lesión renal aguda con necrosis cortical aguda" },
  { codigo: "N17.2", nombre: "IRA con necrosis medular aguda",                             desc: "Lesión renal aguda con necrosis medular aguda (necrosis papilar)" },
  { codigo: "N17.8", nombre: "IRA - otras",                                                desc: "Otras lesiones renales agudas" },
  { codigo: "N17.9", nombre: "IRA - no especificada",                                      desc: "Lesión renal aguda no especificada" },

  { codigo: "N18",   nombre: "Enfermedad renal crónica (ERC)",                             desc: "Enfermedad renal crónica (ERC)" },
  { codigo: "N18.1", nombre: "ERC estadio 1 (TFG ≥ 90)",                                  desc: "Enfermedad renal crónica estadio 1 — TFG ≥ 90 ml/min/1.73m²" },
  { codigo: "N18.2", nombre: "ERC estadio 2 (TFG 60-89) — leve",                          desc: "Enfermedad renal crónica estadio 2 — TFG 60-89 ml/min/1.73m² (leve)" },
  { codigo: "N18.3", nombre: "ERC estadio 3 (TFG 30-59) — moderada",                      desc: "Enfermedad renal crónica estadio 3 — TFG 30-59 ml/min/1.73m² (moderada)" },
  { codigo: "N18.4", nombre: "ERC estadio 4 (TFG 15-29) — grave",                         desc: "Enfermedad renal crónica estadio 4 — TFG 15-29 ml/min/1.73m² (grave)" },
  { codigo: "N18.5", nombre: "ERC estadio 5 (TFG < 15)",                                   desc: "Enfermedad renal crónica estadio 5 — TFG < 15 ml/min/1.73m²" },
  { codigo: "N18.6", nombre: "ERC estadio 5 en diálisis",                                  desc: "Enfermedad renal crónica estadio 5 en diálisis (hemodiálisis o diálisis peritoneal)" },
  { codigo: "N18.9", nombre: "ERC - no especificada",                                      desc: "Enfermedad renal crónica no especificada" },

  { codigo: "N19",   nombre: "Insuficiencia renal no especificada",                        desc: "Insuficiencia renal no especificada" },

  // ─── Litiasis urinaria ───────────────────────────────────────────────────
  { codigo: "N20",   nombre: "Litiasis renal y ureteral",                                  desc: "Cálculo del riñón y del uréter" },
  { codigo: "N20.0", nombre: "Nefrolitiasis - cálculo renal",                              desc: "Cálculo en el riñón (nefrolitiasis)" },
  { codigo: "N20.1", nombre: "Ureterolitiasis - cálculo ureteral",                         desc: "Cálculo en el uréter (ureterolitiasis)" },
  { codigo: "N20.2", nombre: "Litiasis renal con cálculo ureteral",                        desc: "Cálculo en el riñón con cálculo en el uréter" },
  { codigo: "N20.9", nombre: "Litiasis urinaria superior - no especificada",               desc: "Cálculo urinario de vías superiores no especificado" },
  { codigo: "N21.0", nombre: "Litiasis vesical - cálculo en vejiga",                       desc: "Cálculo en vejiga urinaria" },
  { codigo: "N23",   nombre: "Cólico renal no especificado",                               desc: "Cólico renal no especificado" },

  // ─── Otros trastornos renales ────────────────────────────────────────────
  { codigo: "N25.0", nombre: "Osteodistrofia renal",                                       desc: "Osteodistrofia renal" },
  { codigo: "N25.1", nombre: "Diabetes insípida nefrogénica",                              desc: "Diabetes insípida nefrogénica" },
  { codigo: "N25.8", nombre: "Otros trastornos por función tubular alterada",              desc: "Otros trastornos derivados de función tubular renal alterada" },
  { codigo: "N25.9", nombre: "Trastornos por función tubular alterada - no especificados", desc: "Trastornos derivados de función tubular renal alterada, no especificados" },

  { codigo: "N26",   nombre: "Riñón contraído no especificado",                            desc: "Riñón contraído no especificado" },
  { codigo: "N27.0", nombre: "Riñón pequeño unilateral",                                   desc: "Riñón pequeño unilateral de causa desconocida" },
  { codigo: "N27.1", nombre: "Riñón pequeño bilateral",                                    desc: "Riñón pequeño bilateral de causa desconocida" },
  { codigo: "N27.9", nombre: "Riñón pequeño - no especificado",                            desc: "Riñón pequeño de causa desconocida, no especificado" },

  { codigo: "N28.0", nombre: "Isquemia e infarto renales",                                 desc: "Isquemia e infarto renales" },
  { codigo: "N28.1", nombre: "Quiste renal adquirido",                                     desc: "Quiste del riñón adquirido" },
  { codigo: "N28.8", nombre: "Otros trastornos renales especificados",                     desc: "Otros trastornos especificados del riñón y del uréter" },
  { codigo: "N28.9", nombre: "Trastornos renales - no especificados",                      desc: "Trastornos del riñón y del uréter no especificados" },

  { codigo: "N29.0", nombre: "Tuberculosis renal tardía",                                  desc: "Tuberculosis renal tardía" },
  { codigo: "N29.1", nombre: "Otros trastornos renales en enfermedades infecciosas",       desc: "Otros trastornos del riñón y uréter en enfermedades infecciosas" },

  // ─── Infección urinaria ──────────────────────────────────────────────────
  { codigo: "N39.0", nombre: "Infección de vías urinarias (IVU)",                          desc: "Infección de las vías urinarias, sitio no especificado" },
  { codigo: "N39.4", nombre: "Otros tipos de incontinencia urinaria especificados",        desc: "Otros tipos de incontinencia urinaria especificados" },

  // ─── Hipertensión renal / relacionadas ───────────────────────────────────
  { codigo: "N26.1", nombre: "Atrofia renal (terminal)",                                   desc: "Atrofia renal terminal" },
  { codigo: "N00.6", nombre: "Síndrome nefrítico agudo - depósitos densos",                desc: "Síndrome nefrítico agudo con enfermedad por depósitos densos" },
  { codigo: "N04.6", nombre: "Síndrome nefrótico - depósitos densos",                      desc: "Síndrome nefrótico con enfermedad por depósitos densos" },
];

async function seedDiagnosticosNefrologia(conn) {
  console.log(`\n📋 Procesando ${DIAGNOSTICOS.length} diagnósticos de nefrología...\n`);

  // Verificar cuáles ya existen (para no duplicar)
  const codigos = DIAGNOSTICOS.map(d => d.codigo);
  const [existing] = await conn.query(
    `SELECT codigo_cie FROM catalogos_diagnostico
     WHERE clinica_id IS NULL AND especialidad = ? AND codigo_cie IN (${codigos.map(() => "?").join(",")})`,
    [ESPECIALIDAD, ...codigos]
  );
  const existingSet = new Set(existing.map(r => r.codigo_cie));

  const nuevos = DIAGNOSTICOS.filter(d => !existingSet.has(d.codigo));

  if (!nuevos.length) {
    console.log("⚠️  Todos los diagnósticos ya existen. No se insertó nada.");
    return;
  }

  // Bulk INSERT — una sola query para todos los registros nuevos
  const values = nuevos.map(d => [null, null, d.nombre, ESPECIALIDAD, d.codigo, d.desc, null]);
  const placeholders = values.map(() => "(?,?,?,?,?,?,?)").join(",\n  ");
  const flat = values.flat();

  await conn.query(
    `INSERT INTO catalogos_diagnostico
       (clinica_id, medico_id, nombre, especialidad, codigo_cie, descripcion_cie, diagnosticos_secundarios)
     VALUES\n  ${placeholders}`,
    flat
  );

  console.log(`✅  ${nuevos.length} diagnósticos insertados (${existingSet.size} ya existían)`);
}

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     Number(process.env.DB_PORT || 3306),
  });

  console.log("\n🚀 Iniciando migración 049 — Diagnósticos CIE-10 Nefrología...\n");

  // Índice compuesto para que las búsquedas no se vuelvan lentas
  const tryIndex = async (name, sql) => {
    try {
      await conn.query(sql);
      console.log(`✅  Índice ${name} creado`);
    } catch (e) {
      if (e.errno === 1061) console.log(`⚠️  Índice ${name} ya existe, saltando`);
      else throw e;
    }
  };

  await tryIndex(
    "idx_catdiag_clinica_activo_esp",
    `CREATE INDEX idx_catdiag_clinica_activo_esp
     ON catalogos_diagnostico (clinica_id, activo, especialidad)`
  );

  await tryIndex(
    "idx_catdiag_codigo_cie",
    `CREATE INDEX idx_catdiag_codigo_cie
     ON catalogos_diagnostico (codigo_cie)`
  );

  await seedDiagnosticosNefrologia(conn);

  await conn.end();
  console.log("\n🎉 Migración 049 completada.\n");
  console.log("   Los diagnósticos aparecerán en la clínica-diaz (ID 24) automáticamente");
  console.log("   porque la query filtra: clinica_id = 24 OR clinica_id IS NULL\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
