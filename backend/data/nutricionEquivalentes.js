/**
 * data/nutricionEquivalentes.js — Grupos de alimentos para el plan por porciones
 * ("equivalentes"). Valores promedio por porción (kcal y gramos de carbohidratos,
 * proteínas y grasas) según el sistema de equivalentes de uso común en nutrición
 * clínica, con ejemplos de alimentos de Honduras y Centroamérica.
 *
 * Son valores de referencia: la nutricionista ajusta el número de porciones.
 */
const GRUPOS = [
  {
    clave: "lacteos", nombre: "Lácteos", icono: "bi-cup-straw", color: "#60a5fa",
    kcal: 110, cho: 12, pro: 9, gra: 4,
    ejemplos: ["1 taza de leche semidescremada", "3/4 taza de yogur natural", "1 taza de leche de soya sin azúcar"],
  },
  {
    clave: "verduras", nombre: "Verduras", icono: "bi-flower1", color: "#22c55e",
    kcal: 25, cho: 4, pro: 2, gra: 0,
    ejemplos: ["1 taza de vegetales crudos (lechuga, pepino, tomate)", "1/2 taza de vegetales cocidos (pataste, ayote, zanahoria, brócoli)", "1 taza de repollo picado"],
  },
  {
    clave: "frutas", nombre: "Frutas", icono: "bi-apple", color: "#f97316",
    kcal: 60, cho: 15, pro: 0, gra: 0,
    ejemplos: ["1 banano pequeño", "1 taza de papaya o sandía", "1 naranja mediana", "1/2 mango mediano", "3/4 taza de piña", "1 manzana pequeña"],
  },
  {
    clave: "cereales", nombre: "Cereales y almidones", icono: "bi-basket", color: "#eab308",
    kcal: 70, cho: 15, pro: 2, gra: 0.5,
    ejemplos: ["1 tortilla de maíz mediana", "1 rebanada de pan integral", "1/3 taza de arroz cocido", "1/2 taza de papa o 1/3 taza de yuca cocida", "1/3 de plátano cocido", "1/2 taza de avena cocida", "1/2 tortilla de harina (baleada)"],
  },
  {
    clave: "leguminosas", nombre: "Frijoles y leguminosas", icono: "bi-circle-fill", color: "#9a3412",
    kcal: 120, cho: 20, pro: 8, gra: 1,
    ejemplos: ["1/2 taza de frijoles rojos o negros cocidos", "1/2 taza de lentejas o garbanzos cocidos"],
  },
  {
    clave: "carnes", nombre: "Carnes, huevo y queso", icono: "bi-egg-fried", color: "#ef4444",
    kcal: 75, cho: 0, pro: 7, gra: 5,
    ejemplos: ["30 g (1 onza) de pollo sin piel, res magra o pescado", "1 huevo", "30 g de queso fresco o quesillo", "1/4 taza de atún en agua"],
  },
  {
    clave: "grasas", nombre: "Grasas", icono: "bi-droplet-half", color: "#a3a3a3",
    kcal: 45, cho: 0, pro: 0, gra: 5,
    ejemplos: ["1 cucharadita de aceite", "1/3 de aguacate pequeño", "1 cucharada de mantequilla crema", "10 maníes o 6 almendras"],
  },
  {
    clave: "azucares", nombre: "Azúcares", icono: "bi-cake2", color: "#ec4899",
    kcal: 40, cho: 10, pro: 0, gra: 0,
    ejemplos: ["2 cucharaditas de azúcar o miel", "1 cucharada de jalea"],
  },
];

const TIEMPOS = [
  { clave: "desayuno", nombre: "Desayuno" },
  { clave: "merienda_am", nombre: "Merienda AM" },
  { clave: "almuerzo", nombre: "Almuerzo" },
  { clave: "merienda_pm", nombre: "Merienda PM" },
  { clave: "cena", nombre: "Cena" },
];

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

module.exports = { GRUPOS, TIEMPOS, DIAS };
