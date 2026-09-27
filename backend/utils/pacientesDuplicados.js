/**
 * Normalización de nombres y detección de pacientes duplicados.
 * Evita que "cesar castellanos" y "Cesar Castellanos" queden como dos pacientes.
 */

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "di", "do", "van", "von"]);

// "  cesar   CASTELLANOS " -> "Cesar Castellanos" (respeta partículas: "María de los Ángeles")
function titleCaseNombre(texto) {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!limpio) return limpio;
  return limpio
    .toLowerCase()
    .split(" ")
    .map((palabra, i) => {
      if (i > 0 && PARTICULAS.has(palabra)) return palabra;
      // Mayúscula tras espacio, guion o apóstrofo (O'Brien, Pérez-Gómez)
      return palabra.replace(/(^|[-'’])(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase());
    })
    .join(" ");
}

// Clave de comparación: sin acentos, minúsculas, espacios simples
function normClave(texto) {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

function normDni(dni) {
  return String(dni ?? "").replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
}

// Distancia de edición (para detectar "Castellano" vs "Castellanos")
function levenshtein(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Busca pacientes de la misma clínica que coincidan por DNI o por nombre
 * (igual sin distinguir mayúsculas/acentos, o casi igual con 1 letra de diferencia).
 * Devuelve [{ id, nombres, apellidos, dni, telefono, fecha_nacimiento, motivo }]
 */
async function buscarDuplicados(pool, { clinicaId, nombres, apellidos, dni, excluirId = null }) {
  const nombreNorm = normClave(`${nombres} ${apellidos}`);
  const dniNorm = normDni(dni);

  const primerNombre = normClave(nombres).split(" ")[0] || "";
  const primerApellido = normClave(apellidos).split(" ")[0] || "";
  const preNombre = primerNombre.slice(0, 3);
  const preApellido = primerApellido.slice(0, 4);

  const cond = [];
  const params = [clinicaId];
  if (dniNorm) { cond.push("REPLACE(REPLACE(dni,'-',''),' ','') = ?"); params.push(dniNorm); }
  if (preNombre.length >= 2 && preApellido.length >= 2) {
    cond.push("(nombres LIKE ? AND apellidos LIKE ?)");
    params.push(`${preNombre}%`, `${preApellido}%`);
  }
  if (!cond.length) return [];

  let sql = `SELECT id, nombres, apellidos, dni, telefono, fecha_nacimiento
             FROM pacientes WHERE clinica_id = ? AND (${cond.join(" OR ")})`;
  if (excluirId) { sql += " AND id <> ?"; params.push(excluirId); }
  sql += " LIMIT 200";

  const [rows] = await pool.query(sql, params);

  const coincidencias = [];
  for (const r of rows) {
    const mismoDni = dniNorm && normDni(r.dni) === dniNorm;
    const nombreR = normClave(`${r.nombres} ${r.apellidos}`);
    const mismoNombre = nombreR === nombreNorm;
    const parecido = !mismoNombre && nombreNorm.length >= 8 && levenshtein(nombreR, nombreNorm) <= 1;

    if (mismoDni || mismoNombre || parecido) {
      coincidencias.push({
        id: r.id,
        nombres: r.nombres,
        apellidos: r.apellidos,
        dni: r.dni,
        telefono: r.telefono,
        fecha_nacimiento: r.fecha_nacimiento,
        motivo: mismoDni ? "Mismo DNI" : mismoNombre ? "Mismo nombre" : "Nombre muy parecido",
      });
    }
  }
  return coincidencias.slice(0, 5);
}

module.exports = { titleCaseNombre, normClave, buscarDuplicados };
