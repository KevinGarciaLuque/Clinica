/**
 * 056 — Historia Endocrinología: reestructura en el JSON ya guardado
 * (sin ALTER TABLE, son columnas JSON) para:
 *  - antecedentes_familiares: parentesco único (string) -> lista de familiares.
 *  - gineco_obstetricos: objeto plano -> { menarquia_presento, menarquia_edad,
 *    gineco:{fum,ciclos,planificacion_cual}, obstetrico:{tiene_antecedentes,g,p,a,c,complicaciones_detalle} }.
 *  - autoanticuerpos: normaliza anticuerpos booleanos viejos a {valor,comentario}
 *    y "otro" de string a {activo,nombre,resultado}.
 * Idempotente: cada transformación detecta si la fila ya tiene la forma nueva
 * y la deja igual. Ejecutar: node migrations/056_endocrinologia_familiares_gineco_reshape.js
 */
const pool = require("../db");

const ANTIBODY_KEYS = ["anti_gad", "ia2", "znt8", "ica", "iaa"];

function migrateFamiliares(af) {
  if (!af || typeof af !== "object") return af || {};
  const out = {};
  for (const [slug, v] of Object.entries(af)) {
    if (v && Array.isArray(v.familiares)) { out[slug] = v; continue; }
    const parentesco = v?.parentesco;
    out[slug] = { valor: !!v?.valor, familiares: (v?.valor && parentesco) ? [{ parentesco, parentesco_otro: "" }] : [] };
  }
  return out;
}

function migrateGineco(go) {
  if (!go || typeof go !== "object") return go;
  if (go.gineco && go.obstetrico) return go; // ya migrada
  const menarquiaVal = go.menarquia || "";
  const tieneObstetrico = ["g", "p", "a", "c"].some(k => go[k] && go[k] !== "0");
  return {
    menarquia_presento: menarquiaVal ? "SI" : "",
    menarquia_edad: menarquiaVal,
    gineco: { fum: go.fum || "", ciclos: go.ciclos || "", planificacion_cual: go.planificacion_cual || "" },
    obstetrico: {
      tiene_antecedentes: tieneObstetrico ? "SI" : "",
      g: go.g || "", p: go.p || "", a: go.a || "", c: go.c || "",
      complicaciones_detalle: go.complicaciones_detalle || "",
    },
  };
}

function migrateAutoanticuerpos(aa) {
  if (!aa || typeof aa !== "object") return aa;
  const out = { na: !!aa.na, no_realizados: !!aa.no_realizados };
  for (const k of ANTIBODY_KEYS) {
    const v = aa[k];
    out[k] = (v && typeof v === "object") ? { valor: !!v.valor, comentario: v.comentario || "" } : { valor: !!v, comentario: "" };
  }
  out.otro = (aa.otro && typeof aa.otro === "object" && "activo" in aa.otro)
    ? aa.otro
    : { activo: !!aa.otro, nombre: aa.otro || "", resultado: "" };
  return out;
}

async function run() {
  const [rows] = await pool.query(
    "SELECT id, antecedentes_familiares, gineco_obstetricos, autoanticuerpos FROM historia_endocrinologia"
  );

  for (const row of rows) {
    const antecedentes_familiares = migrateFamiliares(row.antecedentes_familiares);
    const gineco_obstetricos = migrateGineco(row.gineco_obstetricos);
    const autoanticuerpos = migrateAutoanticuerpos(row.autoanticuerpos);

    await pool.query(
      "UPDATE historia_endocrinologia SET antecedentes_familiares=?, gineco_obstetricos=?, autoanticuerpos=? WHERE id=?",
      [JSON.stringify(antecedentes_familiares), JSON.stringify(gineco_obstetricos), JSON.stringify(autoanticuerpos), row.id]
    );
    console.log(`Fila id=${row.id} migrada`);
  }

  console.log(`${rows.length} fila(s) procesada(s)`);
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
