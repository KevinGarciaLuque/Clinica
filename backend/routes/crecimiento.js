/**
 * routes/crecimiento.js
 * CRUD mediciones antropométricas + datos de referencia OMS
 */
const { Router } = require("express");
const router = Router();
const pool = require("../db");
const auth = require("../middlewares/auth");

// ═══════════════════════════════════════════════════════════
// DATOS DE REFERENCIA OMS (L, M, S) — Weight-for-age, Length/Height-for-age, BMI-for-age, HC-for-age
// Fuente: WHO Child Growth Standards (0-60 meses)
// ═══════════════════════════════════════════════════════════

// Peso para edad (kg) — Niños (M) 0-60 meses
const WHO_PESO_EDAD_M = [
  { mes: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
  { mes: 1, L: 0.2297, M: 4.4709, S: 0.13395 },
  { mes: 2, L: 0.197, M: 5.5675, S: 0.12385 },
  { mes: 3, L: 0.1738, M: 6.3762, S: 0.11727 },
  { mes: 4, L: 0.1553, M: 7.0023, S: 0.11316 },
  { mes: 5, L: 0.1395, M: 7.5105, S: 0.1108 },
  { mes: 6, L: 0.1257, M: 7.934, S: 0.10958 },
  { mes: 7, L: 0.1134, M: 8.297, S: 0.10902 },
  { mes: 8, L: 0.1021, M: 8.6151, S: 0.10882 },
  { mes: 9, L: 0.0917, M: 8.9014, S: 0.10881 },
  { mes: 10, L: 0.082, M: 9.1649, S: 0.10891 },
  { mes: 11, L: 0.073, M: 9.4122, S: 0.10906 },
  { mes: 12, L: 0.0644, M: 9.6479, S: 0.10925 },
  { mes: 15, L: 0.0409, M: 10.3002, S: 0.10949 },
  { mes: 18, L: 0.0209, M: 10.9462, S: 0.10997 },
  { mes: 21, L: 0.0034, M: 11.5407, S: 0.11072 },
  { mes: 24, L: -0.0119, M: 12.1515, S: 0.11175 },
  { mes: 27, L: -0.0255, M: 12.7379, S: 0.11288 },
  { mes: 30, L: -0.0376, M: 13.3026, S: 0.11398 },
  { mes: 33, L: -0.0484, M: 13.8599, S: 0.11494 },
  { mes: 36, L: -0.0578, M: 14.3339, S: 0.11569 },
  { mes: 39, L: -0.0662, M: 14.818, S: 0.11626 },
  { mes: 42, L: -0.0736, M: 15.3143, S: 0.11666 },
  { mes: 45, L: -0.0801, M: 15.8255, S: 0.11693 },
  { mes: 48, L: -0.0859, M: 16.3489, S: 0.11709 },
  { mes: 51, L: -0.091, M: 16.8871, S: 0.11715 },
  { mes: 54, L: -0.0955, M: 17.4425, S: 0.11711 },
  { mes: 57, L: -0.0995, M: 18.0128, S: 0.117 },
  { mes: 60, L: -0.1031, M: 18.5941, S: 0.11681 },
];

// Peso para edad (kg) — Niñas (F) 0-60 meses
const WHO_PESO_EDAD_F = [
  { mes: 0, L: 0.3809, M: 3.2322, S: 0.14171 },
  { mes: 1, L: 0.1714, M: 4.1873, S: 0.13724 },
  { mes: 2, L: 0.0962, M: 5.1282, S: 0.13 },
  { mes: 3, L: 0.0402, M: 5.8458, S: 0.12619 },
  { mes: 4, L: -0.005, M: 6.4237, S: 0.12402 },
  { mes: 5, L: -0.043, M: 6.8985, S: 0.12274 },
  { mes: 6, L: -0.0756, M: 7.297, S: 0.12204 },
  { mes: 7, L: -0.1039, M: 7.6422, S: 0.12178 },
  { mes: 8, L: -0.1288, M: 7.9487, S: 0.12181 },
  { mes: 9, L: -0.1507, M: 8.2254, S: 0.12199 },
  { mes: 10, L: -0.17, M: 8.48, S: 0.12223 },
  { mes: 11, L: -0.1872, M: 8.7192, S: 0.12247 },
  { mes: 12, L: -0.2024, M: 8.9481, S: 0.12268 },
  { mes: 15, L: -0.2358, M: 9.5865, S: 0.12296 },
  { mes: 18, L: -0.2581, M: 10.2024, S: 0.12329 },
  { mes: 21, L: -0.273, M: 10.8185, S: 0.12402 },
  { mes: 24, L: -0.2831, M: 11.4653, S: 0.12526 },
  { mes: 27, L: -0.2897, M: 12.0698, S: 0.12657 },
  { mes: 30, L: -0.2937, M: 12.6507, S: 0.12774 },
  { mes: 33, L: -0.2959, M: 13.2384, S: 0.12869 },
  { mes: 36, L: -0.2966, M: 13.8631, S: 0.12943 },
  { mes: 39, L: -0.2963, M: 14.462, S: 0.12998 },
  { mes: 42, L: -0.2953, M: 15.0535, S: 0.13035 },
  { mes: 45, L: -0.2937, M: 15.6508, S: 0.13057 },
  { mes: 48, L: -0.2916, M: 16.2583, S: 0.13066 },
  { mes: 51, L: -0.2892, M: 16.879, S: 0.13066 },
  { mes: 54, L: -0.2866, M: 17.5167, S: 0.13059 },
  { mes: 57, L: -0.2838, M: 18.1722, S: 0.13046 },
  { mes: 60, L: -0.2809, M: 18.8487, S: 0.1303 },
];

// Talla para edad (cm) — Niños (M) 0-60 meses
const WHO_TALLA_EDAD_M = [
  { mes: 0, L: 1, M: 49.8842, S: 0.03795 },
  { mes: 1, L: 1, M: 54.7244, S: 0.03557 },
  { mes: 2, L: 1, M: 58.4249, S: 0.03424 },
  { mes: 3, L: 1, M: 61.4292, S: 0.03328 },
  { mes: 4, L: 1, M: 63.886, S: 0.03257 },
  { mes: 5, L: 1, M: 65.9026, S: 0.03204 },
  { mes: 6, L: 1, M: 67.6236, S: 0.03165 },
  { mes: 7, L: 1, M: 69.1645, S: 0.03139 },
  { mes: 8, L: 1, M: 70.5994, S: 0.0312 },
  { mes: 9, L: 1, M: 71.9687, S: 0.03109 },
  { mes: 10, L: 1, M: 73.2812, S: 0.03106 },
  { mes: 11, L: 1, M: 74.5388, S: 0.03106 },
  { mes: 12, L: 1, M: 75.7488, S: 0.03106 },
  { mes: 15, L: 1, M: 79.2143, S: 0.03112 },
  { mes: 18, L: 1, M: 82.2515, S: 0.0314 },
  { mes: 21, L: 1, M: 84.9853, S: 0.03169 },
  { mes: 24, L: 1, M: 87.1161, S: 0.03204 },
  { mes: 27, L: 1, M: 89.2208, S: 0.03226 },
  { mes: 30, L: 1, M: 91.2, S: 0.03247 },
  { mes: 33, L: 1, M: 93.0741, S: 0.03269 },
  { mes: 36, L: 1, M: 94.832, S: 0.03289 },
  { mes: 39, L: 1, M: 96.483, S: 0.03309 },
  { mes: 42, L: 1, M: 98.0544, S: 0.03329 },
  { mes: 45, L: 1, M: 99.5718, S: 0.03348 },
  { mes: 48, L: 1, M: 101.0449, S: 0.03366 },
  { mes: 51, L: 1, M: 102.4787, S: 0.03385 },
  { mes: 54, L: 1, M: 103.8793, S: 0.03404 },
  { mes: 57, L: 1, M: 105.2478, S: 0.03423 },
  { mes: 60, L: 1, M: 106.5844, S: 0.03442 },
];

// Talla para edad (cm) — Niñas (F) 0-60 meses
const WHO_TALLA_EDAD_F = [
  { mes: 0, L: 1, M: 49.1477, S: 0.0379 },
  { mes: 1, L: 1, M: 53.6872, S: 0.0364 },
  { mes: 2, L: 1, M: 57.0673, S: 0.03568 },
  { mes: 3, L: 1, M: 59.8029, S: 0.0352 },
  { mes: 4, L: 1, M: 62.0899, S: 0.03486 },
  { mes: 5, L: 1, M: 64.0301, S: 0.03463 },
  { mes: 6, L: 1, M: 65.7311, S: 0.03448 },
  { mes: 7, L: 1, M: 67.2873, S: 0.03441 },
  { mes: 8, L: 1, M: 68.7498, S: 0.0344 },
  { mes: 9, L: 1, M: 70.1435, S: 0.03444 },
  { mes: 10, L: 1, M: 71.4818, S: 0.03452 },
  { mes: 11, L: 1, M: 72.771, S: 0.03464 },
  { mes: 12, L: 1, M: 74.015, S: 0.03479 },
  { mes: 15, L: 1, M: 77.5049, S: 0.03529 },
  { mes: 18, L: 1, M: 80.7128, S: 0.03583 },
  { mes: 21, L: 1, M: 83.6571, S: 0.03628 },
  { mes: 24, L: 1, M: 86.0903, S: 0.03666 },
  { mes: 27, L: 1, M: 88.3492, S: 0.03684 },
  { mes: 30, L: 1, M: 90.4444, S: 0.03701 },
  { mes: 33, L: 1, M: 92.4096, S: 0.03718 },
  { mes: 36, L: 1, M: 94.2463, S: 0.03733 },
  { mes: 39, L: 1, M: 95.9768, S: 0.03748 },
  { mes: 42, L: 1, M: 97.6234, S: 0.03762 },
  { mes: 45, L: 1, M: 99.2105, S: 0.03776 },
  { mes: 48, L: 1, M: 100.7476, S: 0.03789 },
  { mes: 51, L: 1, M: 102.2421, S: 0.038 },
  { mes: 54, L: 1, M: 103.7069, S: 0.03811 },
  { mes: 57, L: 1, M: 105.1447, S: 0.03822 },
  { mes: 60, L: 1, M: 106.5574, S: 0.03832 },
];

// IMC para edad — Niños (M) 0-60 meses
const WHO_IMC_EDAD_M = [
  { mes: 0, L: -0.3053, M: 13.4069, S: 0.09295 },
  { mes: 1, L: 0.2381, M: 14.862, S: 0.08644 },
  { mes: 2, L: 0.4599, M: 16.1224, S: 0.08325 },
  { mes: 3, L: 0.5765, M: 16.8479, S: 0.08207 },
  { mes: 4, L: 0.6547, M: 17.2266, S: 0.08181 },
  { mes: 5, L: 0.7107, M: 17.3693, S: 0.08199 },
  { mes: 6, L: 0.7519, M: 17.3518, S: 0.0824 },
  { mes: 7, L: 0.7832, M: 17.2268, S: 0.08294 },
  { mes: 8, L: 0.8073, M: 17.035, S: 0.08354 },
  { mes: 9, L: 0.826, M: 16.8067, S: 0.08416 },
  { mes: 10, L: 0.8404, M: 16.5621, S: 0.08476 },
  { mes: 11, L: 0.8515, M: 16.3123, S: 0.08535 },
  { mes: 12, L: 0.8601, M: 16.0647, S: 0.08591 },
  { mes: 15, L: 0.8735, M: 15.4491, S: 0.08736 },
  { mes: 18, L: 0.8776, M: 15.0204, S: 0.08876 },
  { mes: 21, L: 0.877, M: 14.7173, S: 0.08977 },
  { mes: 24, L: 0.8738, M: 15.1837, S: 0.08933 },
  { mes: 27, L: 0.8672, M: 15.0399, S: 0.08959 },
  { mes: 30, L: 0.8589, M: 14.9314, S: 0.0898 },
  { mes: 33, L: 0.849, M: 14.8494, S: 0.09001 },
  { mes: 36, L: 0.8379, M: 14.788, S: 0.09025 },
  { mes: 39, L: 0.8258, M: 14.7432, S: 0.09054 },
  { mes: 42, L: 0.813, M: 14.7118, S: 0.09088 },
  { mes: 45, L: 0.7995, M: 14.6917, S: 0.09128 },
  { mes: 48, L: 0.7856, M: 14.6811, S: 0.09174 },
  { mes: 51, L: 0.7714, M: 14.6789, S: 0.09227 },
  { mes: 54, L: 0.7571, M: 14.6843, S: 0.09287 },
  { mes: 57, L: 0.7427, M: 14.697, S: 0.09354 },
  { mes: 60, L: 0.7284, M: 14.7168, S: 0.09428 },
];

// IMC para edad — Niñas (F) 0-60 meses
const WHO_IMC_EDAD_F = [
  { mes: 0, L: -0.0631, M: 13.3363, S: 0.09274 },
  { mes: 1, L: 0.3474, M: 14.5679, S: 0.0876 },
  { mes: 2, L: 0.5765, M: 15.7526, S: 0.08495 },
  { mes: 3, L: 0.7263, M: 16.3562, S: 0.0848 },
  { mes: 4, L: 0.837, M: 16.6893, S: 0.08547 },
  { mes: 5, L: 0.9237, M: 16.8452, S: 0.08641 },
  { mes: 6, L: 0.9936, M: 16.8755, S: 0.08738 },
  { mes: 7, L: 1.0508, M: 16.8119, S: 0.08828 },
  { mes: 8, L: 1.0975, M: 16.6784, S: 0.08907 },
  { mes: 9, L: 1.1356, M: 16.4991, S: 0.08975 },
  { mes: 10, L: 1.1667, M: 16.2907, S: 0.09034 },
  { mes: 11, L: 1.1919, M: 16.0684, S: 0.09086 },
  { mes: 12, L: 1.2122, M: 15.8413, S: 0.09131 },
  { mes: 15, L: 1.2509, M: 15.2404, S: 0.0926 },
  { mes: 18, L: 1.2676, M: 14.816, S: 0.09399 },
  { mes: 21, L: 1.2741, M: 14.5236, S: 0.09515 },
  { mes: 24, L: 1.2745, M: 15.0205, S: 0.09459 },
  { mes: 27, L: 1.2684, M: 14.8752, S: 0.09483 },
  { mes: 30, L: 1.2593, M: 14.7624, S: 0.09511 },
  { mes: 33, L: 1.2478, M: 14.6753, S: 0.09543 },
  { mes: 36, L: 1.2342, M: 14.6089, S: 0.09581 },
  { mes: 39, L: 1.219, M: 14.5601, S: 0.09625 },
  { mes: 42, L: 1.2024, M: 14.5262, S: 0.09676 },
  { mes: 45, L: 1.1848, M: 14.5054, S: 0.09734 },
  { mes: 48, L: 1.1664, M: 14.496, S: 0.098 },
  { mes: 51, L: 1.1475, M: 14.4968, S: 0.09874 },
  { mes: 54, L: 1.1282, M: 14.507, S: 0.09957 },
  { mes: 57, L: 1.1088, M: 14.5262, S: 0.10048 },
  { mes: 60, L: 1.0894, M: 14.5538, S: 0.10148 },
];

// Perímetro cefálico para edad — Niños (M) 0-60 meses
const WHO_PC_EDAD_M = [
  { mes: 0, L: 1, M: 34.4618, S: 0.03686 },
  { mes: 1, L: 1, M: 37.2759, S: 0.03133 },
  { mes: 2, L: 1, M: 39.1285, S: 0.02997 },
  { mes: 3, L: 1, M: 40.5135, S: 0.02918 },
  { mes: 4, L: 1, M: 41.6317, S: 0.02868 },
  { mes: 5, L: 1, M: 42.5576, S: 0.02837 },
  { mes: 6, L: 1, M: 43.3306, S: 0.02817 },
  { mes: 7, L: 1, M: 43.9803, S: 0.02804 },
  { mes: 8, L: 1, M: 44.53, S: 0.02796 },
  { mes: 9, L: 1, M: 44.9998, S: 0.02792 },
  { mes: 10, L: 1, M: 45.4051, S: 0.02791 },
  { mes: 11, L: 1, M: 45.7573, S: 0.02792 },
  { mes: 12, L: 1, M: 46.0661, S: 0.02795 },
  { mes: 15, L: 1, M: 46.7998, S: 0.02806 },
  { mes: 18, L: 1, M: 47.3677, S: 0.02821 },
  { mes: 21, L: 1, M: 47.8136, S: 0.02838 },
  { mes: 24, L: 1, M: 48.1827, S: 0.02858 },
  { mes: 27, L: 1, M: 48.4517, S: 0.02876 },
  { mes: 30, L: 1, M: 48.6876, S: 0.02894 },
  { mes: 33, L: 1, M: 48.8968, S: 0.02912 },
  { mes: 36, L: 1, M: 49.0826, S: 0.02929 },
  { mes: 39, L: 1, M: 49.2477, S: 0.02947 },
  { mes: 42, L: 1, M: 49.3943, S: 0.02964 },
  { mes: 45, L: 1, M: 49.5241, S: 0.02982 },
  { mes: 48, L: 1, M: 49.6388, S: 0.02999 },
  { mes: 51, L: 1, M: 49.7394, S: 0.03017 },
  { mes: 54, L: 1, M: 49.827, S: 0.03035 },
  { mes: 57, L: 1, M: 49.9025, S: 0.03053 },
  { mes: 60, L: 1, M: 49.9669, S: 0.03072 },
];

// Perímetro cefálico para edad — Niñas (F) 0-60 meses
const WHO_PC_EDAD_F = [
  { mes: 0, L: 1, M: 33.8787, S: 0.03496 },
  { mes: 1, L: 1, M: 36.5463, S: 0.0321 },
  { mes: 2, L: 1, M: 38.2521, S: 0.03168 },
  { mes: 3, L: 1, M: 39.5328, S: 0.03111 },
  { mes: 4, L: 1, M: 40.5817, S: 0.03067 },
  { mes: 5, L: 1, M: 41.459, S: 0.03037 },
  { mes: 6, L: 1, M: 42.1995, S: 0.03017 },
  { mes: 7, L: 1, M: 42.829, S: 0.03003 },
  { mes: 8, L: 1, M: 43.3671, S: 0.02993 },
  { mes: 9, L: 1, M: 43.83, S: 0.02987 },
  { mes: 10, L: 1, M: 44.2319, S: 0.02984 },
  { mes: 11, L: 1, M: 44.5844, S: 0.02982 },
  { mes: 12, L: 1, M: 44.8965, S: 0.02981 },
  { mes: 15, L: 1, M: 45.6263, S: 0.02984 },
  { mes: 18, L: 1, M: 46.2025, S: 0.02991 },
  { mes: 21, L: 1, M: 46.6654, S: 0.03001 },
  { mes: 24, L: 1, M: 47.0442, S: 0.03014 },
  { mes: 27, L: 1, M: 47.3289, S: 0.03027 },
  { mes: 30, L: 1, M: 47.5773, S: 0.03041 },
  { mes: 33, L: 1, M: 47.7957, S: 0.03054 },
  { mes: 36, L: 1, M: 47.989, S: 0.03068 },
  { mes: 39, L: 1, M: 48.1608, S: 0.03082 },
  { mes: 42, L: 1, M: 48.3141, S: 0.03096 },
  { mes: 45, L: 1, M: 48.4509, S: 0.0311 },
  { mes: 48, L: 1, M: 48.573, S: 0.03124 },
  { mes: 51, L: 1, M: 48.6816, S: 0.03139 },
  { mes: 54, L: 1, M: 48.7779, S: 0.03154 },
  { mes: 57, L: 1, M: 48.8629, S: 0.03169 },
  { mes: 60, L: 1, M: 48.9377, S: 0.03184 },
];

// Peso para talla (kg) — Niños (M) — Longitud 45–110 cm (WHO 2006)
const WHO_PESO_TALLA_M = [
  { talla: 45, L: -0.3521, M: 2.441, S: 0.09182 },
  { talla: 48, L: -0.3521, M: 2.948, S: 0.09007 },
  { talla: 50, L: -0.3521, M: 3.3278, S: 0.0889 },
  { talla: 52, L: -0.3521, M: 3.762, S: 0.08771 },
  { talla: 55, L: -0.3521, M: 4.5467, S: 0.08592 },
  { talla: 58, L: -0.3521, M: 5.418, S: 0.0843 },
  { talla: 60, L: -0.3521, M: 5.9907, S: 0.08342 },
  { talla: 62, L: -0.3521, M: 6.5251, S: 0.08279 },
  { talla: 65, L: -0.3521, M: 7.2666, S: 0.08223 },
  { talla: 68, L: -0.3521, M: 7.9674, S: 0.08214 },
  { talla: 70, L: -0.3521, M: 8.4227, S: 0.08229 },
  { talla: 72, L: -0.3521, M: 8.8697, S: 0.08254 },
  { talla: 75, L: -0.3521, M: 9.5032, S: 0.08295 },
  { talla: 78, L: -0.3521, M: 10.0827, S: 0.08318 },
  { talla: 80, L: -0.3521, M: 10.4475, S: 0.08308 },
  { talla: 82, L: -0.3521, M: 10.8321, S: 0.08273 },
  { talla: 85, L: -0.3521, M: 11.5007, S: 0.08181 },
  { talla: 88, L: -0.3521, M: 12.2382, S: 0.08082 },
  { talla: 90, L: -0.3521, M: 12.7209, S: 0.08041 },
  { talla: 92, L: -0.3521, M: 13.191, S: 0.08025 },
  { talla: 95, L: -0.3521, M: 13.8928, S: 0.08047 },
  { talla: 98, L: -0.3521, M: 14.6316, S: 0.08122 },
  { talla: 100, L: -0.3521, M: 15.1637, S: 0.08198 },
  { talla: 102, L: -0.3521, M: 15.7276, S: 0.08292 },
  { talla: 105, L: -0.3521, M: 16.6268, S: 0.08453 },
  { talla: 108, L: -0.3521, M: 17.5885, S: 0.08629 },
  { talla: 110, L: -0.3521, M: 18.2689, S: 0.08755 },
];

// Peso para talla (kg) — Niñas (F) — Longitud 45–110 cm (WHO 2006)
const WHO_PESO_TALLA_F = [
  { talla: 45, L: -0.3833, M: 2.4607, S: 0.09029 },
  { talla: 48, L: -0.3833, M: 2.9741, S: 0.09052 },
  { talla: 50, L: -0.3833, M: 3.3518, S: 0.09068 },
  { talla: 52, L: -0.3833, M: 3.7911, S: 0.09085 },
  { talla: 55, L: -0.3833, M: 4.5498, S: 0.0911 },
  { talla: 58, L: -0.3833, M: 5.3507, S: 0.0913 },
  { talla: 60, L: -0.3833, M: 5.8742, S: 0.09136 },
  { talla: 62, L: -0.3833, M: 6.3738, S: 0.09135 },
  { talla: 65, L: -0.3833, M: 7.0812, S: 0.09119 },
  { talla: 68, L: -0.3833, M: 7.7448, S: 0.0909 },
  { talla: 70, L: -0.3833, M: 8.163, S: 0.09068 },
  { talla: 72, L: -0.3833, M: 8.5679, S: 0.09043 },
  { talla: 75, L: -0.3833, M: 9.149, S: 0.09005 },
  { talla: 78, L: -0.3833, M: 9.7015, S: 0.08965 },
  { talla: 80, L: -0.3833, M: 10.0891, S: 0.0894 },
  { talla: 82, L: -0.3833, M: 10.514, S: 0.08918 },
  { talla: 85, L: -0.3833, M: 11.2198, S: 0.08898 },
  { talla: 88, L: -0.3833, M: 11.972, S: 0.08896 },
  { talla: 90, L: -0.3833, M: 12.4723, S: 0.08906 },
  { talla: 92, L: -0.3833, M: 12.9681, S: 0.08923 },
  { talla: 95, L: -0.3833, M: 13.7146, S: 0.08963 },
  { talla: 98, L: -0.3833, M: 14.4848, S: 0.09021 },
  { talla: 100, L: -0.3833, M: 15.0267, S: 0.09069 },
  { talla: 102, L: -0.3833, M: 15.6046, S: 0.09125 },
  { talla: 105, L: -0.3833, M: 16.547, S: 0.09219 },
  { talla: 108, L: -0.3833, M: 17.5839, S: 0.09326 },
  { talla: 110, L: -0.3833, M: 18.3324, S: 0.09401 },
];

// ═══════════════════════════════════════════════════════════
// FUNCIONES DE CÁLCULO Z-SCORE (Método LMS de la OMS)
// ═══════════════════════════════════════════════════════════

function interpolarLMS(tabla, valor, key = "mes") {
  if (valor <= tabla[0][key]) return tabla[0];
  if (valor >= tabla[tabla.length - 1][key]) return tabla[tabla.length - 1];

  let i = 0;
  while (i < tabla.length - 1 && tabla[i + 1][key] < valor) i++;

  const a = tabla[i], b = tabla[i + 1];
  const t = (valor - a[key]) / (b[key] - a[key]);

  return {
    L: a.L + t * (b.L - a.L),
    M: a.M + t * (b.M - a.M),
    S: a.S + t * (b.S - a.S),
  };
}

function calcZscore(valor, lms) {
  if (!valor || !lms) return null;
  const { L, M, S } = lms;
  if (L === 0) return Math.log(valor / M) / S;
  return (Math.pow(valor / M, L) - 1) / (L * S);
}

function zscoreToPercentil(z) {
  if (z === null || z === undefined) return null;
  // Aproximación de la CDF normal estándar
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  const cdf = 0.5 * (1.0 + sign * y);
  return Math.round(cdf * 1000) / 10; // 1 decimal
}

function obtenerTabla(indicador, sexo) {
  const tablas = {
    "peso-edad":  { M: WHO_PESO_EDAD_M, F: WHO_PESO_EDAD_F },
    "talla-edad": { M: WHO_TALLA_EDAD_M, F: WHO_TALLA_EDAD_F },
    "imc-edad":   { M: WHO_IMC_EDAD_M, F: WHO_IMC_EDAD_F },
    "pc-edad":    { M: WHO_PC_EDAD_M, F: WHO_PC_EDAD_F },
    "peso-talla": { M: WHO_PESO_TALLA_M, F: WHO_PESO_TALLA_F },
  };
  return tablas[indicador]?.[sexo] || null;
}

function calcularTodosZscores(edadMeses, sexo, peso, talla, imc, pc) {
  const result = {};

  // Peso para edad
  const tPE = obtenerTabla("peso-edad", sexo);
  if (tPE && peso) {
    const lms = interpolarLMS(tPE, edadMeses);
    result.zscore_peso_edad = calcZscore(peso, lms);
    result.percentil_peso_edad = zscoreToPercentil(result.zscore_peso_edad);
  }

  // Talla para edad
  const tTE = obtenerTabla("talla-edad", sexo);
  if (tTE && talla) {
    const lms = interpolarLMS(tTE, edadMeses);
    result.zscore_talla_edad = calcZscore(talla, lms);
    result.percentil_talla_edad = zscoreToPercentil(result.zscore_talla_edad);
  }

  // IMC para edad
  const tIE = obtenerTabla("imc-edad", sexo);
  if (tIE && imc) {
    const lms = interpolarLMS(tIE, edadMeses);
    result.zscore_imc_edad = calcZscore(imc, lms);
    result.percentil_imc_edad = zscoreToPercentil(result.zscore_imc_edad);
  }

  // PC para edad
  const tPC = obtenerTabla("pc-edad", sexo);
  if (tPC && pc) {
    const lms = interpolarLMS(tPC, edadMeses);
    result.zscore_pc_edad = calcZscore(pc, lms);
    result.percentil_pc_edad = zscoreToPercentil(result.zscore_pc_edad);
  }

  // Peso para talla
  const tPT = obtenerTabla("peso-talla", sexo);
  if (tPT && peso && talla) {
    const lms = interpolarLMS(tPT, talla, "talla");
    result.zscore_peso_talla = calcZscore(peso, lms);
    result.percentil_peso_talla = zscoreToPercentil(result.zscore_peso_talla);
  }

  return result;
}

// Generar curvas de referencia para un indicador (para la gráfica)
function generarCurvasReferencia(indicador, sexo) {
  const tabla = obtenerTabla(indicador, sexo);
  if (!tabla) return null;

  const xKey = indicador === "peso-talla" ? "talla" : "mes";
  const zlines = [-3, -2, -1, 0, 1, 2, 3];
  const curves = {};

  zlines.forEach(z => {
    curves[`z${z}`] = tabla.map(row => {
      const { L, M, S } = row;
      let val;
      if (L === 0) {
        val = M * Math.exp(S * z);
      } else {
        val = M * Math.pow(1 + L * S * z, 1 / L);
      }
      return { [xKey]: row[xKey], valor: Math.round(val * 100) / 100 };
    });
  });

  return curves;
}


// ═══════════════════════════════════════════════════════════
// ENDPOINTS
// ═══════════════════════════════════════════════════════════

const ROLES = ["ADMIN", "MEDICO", "ENFERMERA", "RECEPCIONISTA", "SUPER_ADMIN"];

// GET /api/crecimiento/referencia/:indicador/:sexo — Curvas de referencia OMS
// ⚠️ DEBE ir ANTES de /:pacienteId para que Express no lo capture como pacienteId
router.get("/referencia/:indicador/:sexo", auth(...ROLES), (req, res) => {
  const { indicador, sexo } = req.params;
  const sexoUpper = (sexo || "").toUpperCase();

  if (!["M", "F"].includes(sexoUpper)) {
    return res.status(400).json({ ok: false, msg: "Sexo debe ser M o F" });
  }

  const indicadoresValidos = ["peso-edad", "talla-edad", "imc-edad", "pc-edad", "peso-talla"];
  if (!indicadoresValidos.includes(indicador)) {
    return res.status(400).json({ ok: false, msg: "Indicador inválido" });
  }

  const curves = generarCurvasReferencia(indicador, sexoUpper);
  if (!curves) {
    return res.status(404).json({ ok: false, msg: "Datos no disponibles" });
  }

  res.json({ ok: true, data: curves });
});

// GET /api/crecimiento/:pacienteId — Obtener todas las mediciones
router.get("/:pacienteId", auth(...ROLES), async (req, res) => {
  try {
    const { pacienteId } = req.params;
    const clinicaId = req.tenant?.clinica_id;

    let sql = `SELECT * FROM mediciones_crecimiento WHERE paciente_id = ?`;
    const params = [pacienteId];

    if (clinicaId) {
      sql += ` AND clinica_id = ?`;
      params.push(clinicaId);
    }

    sql += ` ORDER BY edad_meses ASC`;

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("Error GET mediciones:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener mediciones" });
  }
});

// POST /api/crecimiento/:pacienteId — Crear nueva medición
router.post("/:pacienteId", auth("ADMIN", "MEDICO", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { pacienteId } = req.params;
    const clinicaId = req.tenant?.clinica_id;
    const usuarioId = req.user?.id;

    const { fecha_medicion, edad_meses, peso_kg, talla_cm, perimetro_cefalico_cm, notas } = req.body;

    if (!fecha_medicion || edad_meses === undefined) {
      return res.status(400).json({ ok: false, msg: "Fecha y edad en meses son requeridos" });
    }

    // Obtener sexo del paciente
    const [pacRows] = await pool.query(
      "SELECT sexo FROM pacientes WHERE id = ? LIMIT 1", [pacienteId]
    );
    if (!pacRows.length) {
      return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });
    }

    const sexo = pacRows[0].sexo || "M";
    const peso = peso_kg ? parseFloat(peso_kg) : null;
    const talla = talla_cm ? parseFloat(talla_cm) : null;
    const pc = perimetro_cefalico_cm ? parseFloat(perimetro_cefalico_cm) : null;

    // Calcular IMC
    let imc = null;
    if (peso && talla) {
      imc = Math.round((peso / Math.pow(talla / 100, 2)) * 100) / 100;
    }

    // Calcular Z-scores y percentiles
    const scores = calcularTodosZscores(parseFloat(edad_meses), sexo, peso, talla, imc, pc);

    const [result] = await pool.query(
      `INSERT INTO mediciones_crecimiento 
       (clinica_id, paciente_id, usuario_id, fecha_medicion, edad_meses,
        peso_kg, talla_cm, perimetro_cefalico_cm, imc,
        zscore_peso_edad, zscore_talla_edad, zscore_peso_talla, zscore_imc_edad, zscore_pc_edad,
        percentil_peso_edad, percentil_talla_edad, percentil_peso_talla, percentil_imc_edad, percentil_pc_edad,
        notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clinicaId, pacienteId, usuarioId, fecha_medicion, edad_meses,
        peso, talla, pc, imc,
        scores.zscore_peso_edad ?? null,
        scores.zscore_talla_edad ?? null,
        scores.zscore_peso_talla ?? null,
        scores.zscore_imc_edad ?? null,
        scores.zscore_pc_edad ?? null,
        scores.percentil_peso_edad ?? null,
        scores.percentil_talla_edad ?? null,
        scores.percentil_peso_talla ?? null,
        scores.percentil_imc_edad ?? null,
        scores.percentil_pc_edad ?? null,
        notas || null,
      ]
    );

    // Retornar la medición insertada
    const [inserted] = await pool.query(
      "SELECT * FROM mediciones_crecimiento WHERE id = ?", [result.insertId]
    );

    res.status(201).json({ ok: true, data: inserted[0], msg: "Medición registrada" });
  } catch (err) {
    console.error("Error POST medición:", err);
    res.status(500).json({ ok: false, msg: "Error al guardar medición" });
  }
});

// DELETE /api/crecimiento/:pacienteId/:id — Eliminar medición
router.delete("/:pacienteId/:id", auth("ADMIN", "MEDICO", "SUPER_ADMIN"), async (req, res) => {
  try {
    const { pacienteId, id } = req.params;
    const clinicaId = req.tenant?.clinica_id;

    let sql = "DELETE FROM mediciones_crecimiento WHERE id = ? AND paciente_id = ?";
    const params = [id, pacienteId];

    if (clinicaId) {
      sql += " AND clinica_id = ?";
      params.push(clinicaId);
    }

    const [result] = await pool.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: "Medición no encontrada" });
    }

    res.json({ ok: true, msg: "Medición eliminada" });
  } catch (err) {
    console.error("Error DELETE medición:", err);
    res.status(500).json({ ok: false, msg: "Error al eliminar" });
  }
});

module.exports = router;
