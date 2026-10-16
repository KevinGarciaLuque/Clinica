/**
 * utils/alergiasMedicamentos.js
 * Compara los medicamentos de una receta con las alergias registradas del paciente.
 *
 * Tres niveles de aviso:
 *  - "directo":  el medicamento es el mismo agente al que es alérgico (Ibuprofeno ↔ Ibuprofeno 400 mg).
 *  - "grupo":    pertenece a la misma familia (alergia a Penicilina → Amoxicilina).
 *  - "cruzada":  familia con posible reacción cruzada (Penicilinas ↔ Cefalosporinas, AINE ↔ Metamizol).
 *
 * Es una ayuda para el médico, no reemplaza su criterio: la lista de familias cubre
 * los medicamentos más usados en consulta y puede ampliarse aquí mismo.
 */

const normal = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Familias: `alias` = cómo suele anotarse la alergia; `farmacos` = principios activos del grupo
const FAMILIAS = [
  { id: "penicilinas", nombre: "penicilinas (betalactámicos)",
    alias: ["penicilina", "penicilinas", "betalactamico", "betalactamicos", "beta lactamico", "betalactamicos"],
    farmacos: ["penicilina", "bencilpenicilina", "amoxicilina", "ampicilina", "dicloxacilina", "oxacilina", "cloxacilina",
      "piperacilina", "clavulanico", "sulbactam", "benzatinica", "procainica", "fenoximetilpenicilina"] },
  { id: "cefalosporinas", nombre: "cefalosporinas",
    alias: ["cefalosporina", "cefalosporinas"],
    farmacos: ["cefalexina", "cefadroxilo", "cefaclor", "cefuroxima", "cefprozilo", "ceftriaxona", "cefotaxima", "ceftazidima",
      "cefixima", "cefdinir", "cefepime", "cefazolina", "cefoxitina", "cefpodoxima"] },
  { id: "carbapenems", nombre: "carbapenémicos", alias: ["carbapenem", "carbapenemicos"],
    farmacos: ["imipenem", "meropenem", "ertapenem"] },
  { id: "sulfas", nombre: "sulfonamidas (sulfas)",
    alias: ["sulfa", "sulfas", "sulfonamida", "sulfonamidas", "sulfamidas"],
    farmacos: ["sulfametoxazol", "cotrimoxazol", "trimetoprim sulfametoxazol", "sulfadiazina", "sulfasalazina", "sulfacetamida"] },
  { id: "aines", nombre: "antiinflamatorios no esteroideos (AINE)",
    alias: ["aine", "aines", "antiinflamatorio", "antiinflamatorios", "aspirina", "asa", "acido acetilsalicilico", "salicilatos"],
    farmacos: ["acido acetilsalicilico", "aspirina", "ibuprofeno", "naproxeno", "diclofenaco", "ketorolaco", "meloxicam",
      "piroxicam", "indometacina", "ketoprofeno", "dexketoprofeno", "nimesulida", "aceclofenaco", "etoricoxib", "celecoxib",
      "acido mefenamico", "flurbiprofeno", "lornoxicam"] },
  { id: "metamizol", nombre: "metamizol (dipirona)",
    alias: ["metamizol", "dipirona", "novalgina", "pirazolona", "pirazolonas"],
    farmacos: ["metamizol", "dipirona"] },
  { id: "macrolidos", nombre: "macrólidos", alias: ["macrolido", "macrolidos"],
    farmacos: ["eritromicina", "azitromicina", "claritromicina", "roxitromicina"] },
  { id: "quinolonas", nombre: "quinolonas", alias: ["quinolona", "quinolonas", "fluoroquinolona", "fluoroquinolonas"],
    farmacos: ["ciprofloxacino", "ciprofloxacina", "levofloxacino", "levofloxacina", "moxifloxacino", "norfloxacino", "ofloxacino"] },
  { id: "tetraciclinas", nombre: "tetraciclinas", alias: ["tetraciclina", "tetraciclinas"],
    farmacos: ["tetraciclina", "doxiciclina", "minociclina"] },
  { id: "aminoglucosidos", nombre: "aminoglucósidos", alias: ["aminoglucosido", "aminoglucosidos"],
    farmacos: ["gentamicina", "amikacina", "estreptomicina", "neomicina", "tobramicina"] },
  { id: "lincosamidas", nombre: "lincosamidas", alias: ["lincosamida", "lincosamidas"],
    farmacos: ["clindamicina", "lincomicina"] },
  { id: "nitroimidazoles", nombre: "nitroimidazoles", alias: ["nitroimidazol", "nitroimidazoles"],
    farmacos: ["metronidazol", "tinidazol", "secnidazol", "ornidazol"] },
  { id: "opioides", nombre: "opioides", alias: ["opioide", "opioides", "opiaceo", "opiaceos"],
    farmacos: ["codeina", "tramadol", "morfina", "oxicodona", "hidrocodona", "fentanilo", "nalbufina", "buprenorfina"] },
  { id: "ieca", nombre: "IECA (inhibidores de la enzima convertidora)", alias: ["ieca", "inhibidores de la eca"],
    farmacos: ["enalapril", "captopril", "lisinopril", "ramipril", "perindopril"] },
  { id: "paracetamol", nombre: "paracetamol (acetaminofén)", alias: ["paracetamol", "acetaminofen", "acetaminofeno"],
    farmacos: ["paracetamol", "acetaminofen", "acetaminofeno"] },
  { id: "anticonvulsivos", nombre: "anticonvulsivos aromáticos", alias: ["anticonvulsivo", "anticonvulsivos"],
    farmacos: ["carbamazepina", "oxcarbazepina", "fenitoina", "fenobarbital", "lamotrigina"] },
];

// Posible reacción cruzada entre familias (aviso amarillo)
const CRUZADAS = [
  ["penicilinas", "cefalosporinas"],
  ["penicilinas", "carbapenems"],
  ["aines", "metamizol"],
];

const contiene = (texto, palabra) => (` ${texto} `).includes(` ${palabra} `) || (palabra.length >= 6 && texto.includes(palabra));

function familiasDeAlergia(agente) {
  const a = normal(agente);
  return FAMILIAS.filter((f) => f.alias.some((x) => contiene(a, normal(x))) || f.farmacos.some((x) => contiene(a, normal(x))));
}

function familiasDeMedicamento(texto) {
  const m = normal(texto);
  return FAMILIAS.filter((f) => f.farmacos.some((x) => contiene(m, normal(x))));
}

/**
 * @param alergias  [{ agente, tipo, severidad, reaccion }]
 * @param items     [{ indice, texto }]  (texto = nombre genérico + comercial + lo escrito)
 * @returns conflictos [{ indice, medicamento, alergia, severidad, reaccion, tipo, grupo, mensaje }]
 */
function buscarConflictos(alergias, items) {
  const conflictos = [];
  const relevantes = alergias.filter((a) => a.agente && (!a.tipo || a.tipo === "MEDICAMENTO" || a.tipo === "OTRO"));
  for (const it of items) {
    const med = normal(it.texto);
    if (!med) continue;
    const famMed = familiasDeMedicamento(med);
    for (const a of relevantes) {
      const ag = normal(a.agente);
      if (!ag) continue;
      const famAl = familiasDeAlergia(ag);
      let tipo = null; let grupo = null;
      // Mismo agente: "ibuprofeno" en "ibuprofeno 400 mg" (palabras de 4+ letras para evitar falsos positivos)
      const palabrasAgente = ag.split(" ").filter((w) => w.length >= 4);
      if (palabrasAgente.length && palabrasAgente.every((w) => contiene(med, w))) tipo = "directo";
      if (!tipo) {
        const comun = famMed.find((f) => famAl.some((g) => g.id === f.id));
        if (comun) { tipo = "grupo"; grupo = comun.nombre; }
      }
      if (!tipo) {
        const cruz = CRUZADAS.find(([x, y]) =>
          (famAl.some((g) => g.id === x) && famMed.some((f) => f.id === y)) ||
          (famAl.some((g) => g.id === y) && famMed.some((f) => f.id === x)));
        if (cruz) { tipo = "cruzada"; grupo = famMed.find((f) => cruz.includes(f.id))?.nombre || null; }
      }
      if (!tipo) continue;
      const sev = a.severidad ? ` (${String(a.severidad).toLowerCase()})` : "";
      const mensaje = tipo === "directo"
        ? `El paciente es alérgico a ${a.agente}${sev}.`
        : tipo === "grupo"
          ? `El paciente es alérgico a ${a.agente}${sev} y este medicamento pertenece al grupo de las ${grupo}.`
          : `Posible reacción cruzada: el paciente es alérgico a ${a.agente}${sev} y este medicamento es de las ${grupo}.`;
      conflictos.push({
        indice: it.indice, medicamento: it.nombre || it.texto, alergia: a.agente, severidad: a.severidad || null,
        reaccion: a.reaccion || null, tipo, grupo, mensaje,
      });
    }
  }
  return conflictos;
}

module.exports = { buscarConflictos, FAMILIAS };
