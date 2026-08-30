/**
 * Z-scores de estructuras cardíacas — nomograma de Detroit (Pettersen et al.,
 * J Am Soc Echocardiogr 2008;21:922-934).
 *
 * Modelo:  ln(ŷ_cm) = β0 + β1·BSA + β2·BSA² + β3·BSA³      (BSA en m²)
 *          Z = ( ln(observado_cm) − ln(ŷ_cm) ) / √MSE
 *
 * Válido para BSA ≤ 2.0 m². Fuera de ese rango se marca como no confiable.
 * (La BSA que usa la app es Mosteller; el paper usó Haycock — diferencia clínicamente menor.)
 */

// Coeficientes de la Tabla 2 del paper: [β0, β1, β2, β3, MSE]
export const DETROIT_2008 = {
  RVDd:        [-0.317, 1.850, -1.274, 0.335, 0.058],
  IVSd:        [-1.242, 1.272, -0.762, 0.208, 0.046],
  IVSs:        [-1.048, 1.751, -1.177, 0.318, 0.034],
  LVIDd:       [ 0.105, 2.859, -2.119, 0.552, 0.010],
  LVIDs:       [-0.371, 2.833, -2.081, 0.538, 0.016],
  LVPWd:       [-1.586, 1.849, -1.188, 0.313, 0.037],
  LVPWs:       [-0.947, 1.907, -1.259, 0.330, 0.023],
  AoValve:     [-0.874, 2.708, -1.841, 0.452, 0.010], // anillo válvula aórtica
  Valsalva:    [-0.500, 2.537, -1.707, 0.420, 0.012], // senos de Valsalva
  STJ:         [-0.759, 2.643, -1.797, 0.442, 0.018], // unión sinotubular
  ArcoTrans:   [-0.790, 3.020, -2.484, 0.712, 0.023], // arco aórtico transverso
  Istmo:       [-1.072, 2.539, -1.627, 0.368, 0.027],
  ArcoDistal:  [-0.976, 2.469, -1.746, 0.445, 0.026],
  AoDiafragma: [-0.922, 2.100, -1.411, 0.371, 0.018],
  PulmValve:   [-0.761, 2.774, -1.808, 0.436, 0.023], // anillo válvula pulmonar
  MPA:         [-0.707, 2.746, -1.807, 0.424, 0.024], // tronco arteria pulmonar
  RPA:         [-1.360, 3.394, -2.508, 0.660, 0.027], // rama derecha
  LPA:         [-1.348, 2.884, -1.954, 0.466, 0.028], // rama izquierda
  MV:          [-0.271, 2.446, -1.700, 0.425, 0.022], // anillo mitral
  TV:          [-0.164, 2.341, -1.596, 0.387, 0.036], // anillo tricúspide
  LA:          [-0.208, 2.164, -1.597, 0.429, 0.020], // aurícula izquierda
};

/**
 * @param {string} estructura  clave de DETROIT_2008
 * @param {number|string} valorMm  medida en milímetros
 * @param {number|string} bsaM2  superficie corporal en m²
 * @returns {{ z:number, texto:string, interp:string, color:string, confiable:boolean } | null}
 */
export function zscoreDetroit(estructura, valorMm, bsaM2) {
  const c = DETROIT_2008[estructura];
  const mm = parseFloat(valorMm);
  const bsa = parseFloat(bsaM2);
  if (!c || !mm || mm <= 0 || !bsa || bsa <= 0) return null;

  const [b0, b1, b2, b3, mse] = c;
  const cm = mm / 10;
  const lnMean = b0 + b1 * bsa + b2 * bsa * bsa + b3 * bsa * bsa * bsa;
  const z = (Math.log(cm) - lnMean) / Math.sqrt(mse);
  const zr = Math.round(z * 100) / 100;

  let interp = "Normal", color = "#16a34a";
  if (z >= 2)       { interp = "Dilatado / aumentado"; color = "#dc2626"; }
  else if (z <= -2) { interp = "Hipoplásico / disminuido"; color = "#dc2626"; }
  else if (Math.abs(z) >= 1.6) { interp = "Límite"; color = "#f59e0b"; }

  return {
    z: zr,
    texto: (zr > 0 ? "+" : "") + zr.toFixed(2),
    interp,
    color,
    confiable: bsa <= 2.0,
  };
}

// Mapa: fila + columna de la tabla del formulario  →  estructura del nomograma
export const ECO_ZMAP = {
  "VI|dd": "LVIDd",
  "VI|ds": "LVIDs",
  "VI|septum": "IVSd",
  "VI|ppvi": "LVPWd",
  "A. Aórtico|dd": "AoValve",
  "Raíz Ao|dd": "Valsalva",
  "Unión ST|dd": "STJ",
  "A. Pulmonar|dd": "PulmValve",
  "TAP|dd": "MPA",
  "RDAP|dd": "RPA",
  "RIAP|dd": "LPA",
  "V mitral|dd": "MV",
  "V tricúspide|dd": "TV",
};
