/**
 * run-050.js — Completa el Capítulo 14 CIE-10 (N00-N99)
 * Agrega todos los códigos que faltaron en la migración 049.
 * Los ya existentes se omiten automáticamente (INSERT IGNORE por código).
 *
 * Ejecutar: node migrations/run-050.js
 */
const mysql = require("mysql2/promise");
require("dotenv").config();

// Diagnósticos faltantes del Capítulo 14 completo
// Organizados con su especialidad para facilitar filtrado en la UI
const FALTANTES = [
  // ═══ N00 – Síndrome nefrítico agudo (subcódigos faltantes) ═══════════════
  { c: "N00.5", e: "nefrologia", n: "Sínd. nefrítico agudo - GN mesangiocapilar difusa",      d: "Síndrome nefrítico agudo con glomerulonefritis mesangiocapilar difusa" },
  { c: "N00.7", e: "nefrologia", n: "Sínd. nefrítico agudo - GN difusa en media luna",         d: "Síndrome nefrítico agudo con glomerulonefritis difusa en media luna" },
  { c: "N00.8", e: "nefrologia", n: "Sínd. nefrítico agudo - otras lesiones",                  d: "Síndrome nefrítico agudo - otras lesiones morfológicas" },

  // ═══ N01 – Síndrome nefrítico rápidamente progresivo ════════════════════
  { c: "N01.1", e: "nefrologia", n: "SNRP - lesiones glomerulares focales y segmentarias",     d: "Síndrome nefrítico rápidamente progresivo con lesiones focales y segmentarias" },
  { c: "N01.3", e: "nefrologia", n: "SNRP - GN mesangial proliferativa difusa",                d: "SNRP con glomerulonefritis mesangial proliferativa difusa" },
  { c: "N01.4", e: "nefrologia", n: "SNRP - GN endocapilar proliferativa difusa",              d: "SNRP con glomerulonefritis endocapilar proliferativa difusa" },
  { c: "N01.5", e: "nefrologia", n: "SNRP - GN mesangiocapilar difusa",                        d: "SNRP con glomerulonefritis mesangiocapilar difusa" },
  { c: "N01.6", e: "nefrologia", n: "SNRP - enfermedad por depósitos densos",                  d: "SNRP con enfermedad por depósitos densos" },
  { c: "N01.7", e: "nefrologia", n: "SNRP - GN difusa en media luna",                          d: "SNRP con glomerulonefritis difusa en media luna" },
  { c: "N01.8", e: "nefrologia", n: "SNRP - otras lesiones morfológicas",                      d: "SNRP con otras lesiones morfológicas" },

  // ═══ N02 – Hematuria recurrente y persistente ═══════════════════════════
  { c: "N02.1", e: "nefrologia", n: "Hematuria recurrente - lesiones focales y segmentarias",  d: "Hematuria recurrente y persistente con lesiones glomerulares focales y segmentarias" },
  { c: "N02.2", e: "nefrologia", n: "Hematuria recurrente - GN membranosa difusa",             d: "Hematuria recurrente y persistente con GN membranosa difusa" },
  { c: "N02.3", e: "nefrologia", n: "Hematuria recurrente - GN mesangial proliferativa",       d: "Hematuria recurrente con GN mesangial proliferativa difusa" },
  { c: "N02.4", e: "nefrologia", n: "Hematuria recurrente - GN endocapilar proliferativa",     d: "Hematuria recurrente con GN endocapilar proliferativa difusa" },
  { c: "N02.5", e: "nefrologia", n: "Hematuria recurrente - GN mesangiocapilar difusa",        d: "Hematuria recurrente con GN mesangiocapilar difusa" },
  { c: "N02.6", e: "nefrologia", n: "Hematuria recurrente - enfermedad por depósitos densos",  d: "Hematuria recurrente con enfermedad por depósitos densos" },
  { c: "N02.7", e: "nefrologia", n: "Hematuria recurrente - GN difusa en media luna",          d: "Hematuria recurrente con GN difusa en media luna" },
  { c: "N02.8", e: "nefrologia", n: "Hematuria recurrente - otras lesiones",                   d: "Hematuria recurrente con otras lesiones morfológicas" },

  // ═══ N03 – Síndrome nefrítico crónico ═══════════════════════════════════
  { c: "N03.1", e: "nefrologia", n: "Sínd. nefrítico crónico - lesiones focales segmentarias", d: "Síndrome nefrítico crónico con lesiones glomerulares focales y segmentarias" },
  { c: "N03.3", e: "nefrologia", n: "Sínd. nefrítico crónico - GN mesangial proliferativa",    d: "Síndrome nefrítico crónico con GN mesangial proliferativa difusa" },
  { c: "N03.4", e: "nefrologia", n: "Sínd. nefrítico crónico - GN endocapilar proliferativa",  d: "Síndrome nefrítico crónico con GN endocapilar proliferativa difusa" },
  { c: "N03.6", e: "nefrologia", n: "Sínd. nefrítico crónico - enfermedad depósitos densos",   d: "Síndrome nefrítico crónico con enfermedad por depósitos densos" },
  { c: "N03.7", e: "nefrologia", n: "Sínd. nefrítico crónico - GN en media luna",              d: "Síndrome nefrítico crónico con GN difusa en media luna" },
  { c: "N03.8", e: "nefrologia", n: "Sínd. nefrítico crónico - otras lesiones",                d: "Síndrome nefrítico crónico con otras lesiones morfológicas" },

  // ═══ N04 – Síndrome nefrótico ════════════════════════════════════════════
  { c: "N04.4", e: "nefrologia", n: "Sínd. nefrótico - GN endocapilar proliferativa difusa",   d: "Síndrome nefrótico con GN endocapilar proliferativa difusa" },
  { c: "N04.7", e: "nefrologia", n: "Sínd. nefrótico - GN difusa en media luna",               d: "Síndrome nefrótico con GN difusa en media luna" },
  { c: "N04.8", e: "nefrologia", n: "Sínd. nefrótico - otras lesiones morfológicas",           d: "Síndrome nefrótico con otras lesiones morfológicas" },

  // ═══ N05 – Síndrome nefrítico no especificado ═══════════════════════════
  { c: "N05.0", e: "nefrologia", n: "Sínd. nefrítico NE - anomalía glomerular mínima",         d: "Síndrome nefrítico no especificado con anomalía glomerular mínima" },
  { c: "N05.1", e: "nefrologia", n: "Sínd. nefrítico NE - lesiones focales segmentarias",      d: "Síndrome nefrítico no especificado con lesiones focales y segmentarias" },
  { c: "N05.2", e: "nefrologia", n: "Sínd. nefrítico NE - GN membranosa difusa",               d: "Síndrome nefrítico no especificado con GN membranosa difusa" },
  { c: "N05.3", e: "nefrologia", n: "Sínd. nefrítico NE - GN mesangial proliferativa",         d: "Síndrome nefrítico no especificado con GN mesangial proliferativa difusa" },
  { c: "N05.4", e: "nefrologia", n: "Sínd. nefrítico NE - GN endocapilar proliferativa",       d: "Síndrome nefrítico no especificado con GN endocapilar proliferativa difusa" },
  { c: "N05.5", e: "nefrologia", n: "Sínd. nefrítico NE - GN mesangiocapilar difusa",          d: "Síndrome nefrítico no especificado con GN mesangiocapilar difusa" },
  { c: "N05.6", e: "nefrologia", n: "Sínd. nefrítico NE - enfermedad depósitos densos",        d: "Síndrome nefrítico no especificado con enfermedad por depósitos densos" },
  { c: "N05.7", e: "nefrologia", n: "Sínd. nefrítico NE - GN en media luna",                   d: "Síndrome nefrítico no especificado con GN difusa en media luna" },
  { c: "N05.8", e: "nefrologia", n: "Sínd. nefrítico NE - otras lesiones",                     d: "Síndrome nefrítico no especificado con otras lesiones morfológicas" },

  // ═══ N06 – Proteinuria aislada ═══════════════════════════════════════════
  { c: "N06.0", e: "nefrologia", n: "Proteinuria aislada - anomalía glomerular mínima",         d: "Proteinuria aislada con anomalía glomerular mínima" },
  { c: "N06.1", e: "nefrologia", n: "Proteinuria aislada - lesiones focales segmentarias",      d: "Proteinuria aislada con lesiones glomerulares focales y segmentarias" },
  { c: "N06.2", e: "nefrologia", n: "Proteinuria aislada - GN membranosa difusa",               d: "Proteinuria aislada con glomerulonefritis membranosa difusa" },
  { c: "N06.3", e: "nefrologia", n: "Proteinuria aislada - GN mesangial proliferativa",         d: "Proteinuria aislada con GN mesangial proliferativa difusa" },
  { c: "N06.4", e: "nefrologia", n: "Proteinuria aislada - GN endocapilar proliferativa",       d: "Proteinuria aislada con GN endocapilar proliferativa difusa" },
  { c: "N06.5", e: "nefrologia", n: "Proteinuria aislada - GN mesangiocapilar difusa",          d: "Proteinuria aislada con GN mesangiocapilar difusa" },
  { c: "N06.6", e: "nefrologia", n: "Proteinuria aislada - enfermedad depósitos densos",        d: "Proteinuria aislada con enfermedad por depósitos densos" },
  { c: "N06.7", e: "nefrologia", n: "Proteinuria aislada - GN en media luna",                   d: "Proteinuria aislada con GN difusa en media luna" },
  { c: "N06.8", e: "nefrologia", n: "Proteinuria aislada - otras lesiones",                     d: "Proteinuria aislada con otras lesiones morfológicas especificadas" },

  // ═══ N07 – Nefropatía hereditaria ════════════════════════════════════════
  { c: "N07.0", e: "nefrologia", n: "Nefropatía hereditaria - anomalía glomerular mínima",      d: "Nefropatía hereditaria con anomalía glomerular mínima" },
  { c: "N07.1", e: "nefrologia", n: "Nefropatía hereditaria - lesiones focales segmentarias",   d: "Nefropatía hereditaria con lesiones focales y segmentarias" },
  { c: "N07.2", e: "nefrologia", n: "Nefropatía hereditaria - GN membranosa difusa",            d: "Nefropatía hereditaria con GN membranosa difusa" },
  { c: "N07.3", e: "nefrologia", n: "Nefropatía hereditaria - GN mesangial proliferativa",      d: "Nefropatía hereditaria con GN mesangial proliferativa difusa" },
  { c: "N07.4", e: "nefrologia", n: "Nefropatía hereditaria - GN endocapilar proliferativa",    d: "Nefropatía hereditaria con GN endocapilar proliferativa difusa" },
  { c: "N07.5", e: "nefrologia", n: "Nefropatía hereditaria - GN mesangiocapilar difusa",       d: "Nefropatía hereditaria con GN mesangiocapilar difusa" },
  { c: "N07.6", e: "nefrologia", n: "Nefropatía hereditaria - enfermedad depósitos densos",     d: "Nefropatía hereditaria con enfermedad por depósitos densos" },
  { c: "N07.7", e: "nefrologia", n: "Nefropatía hereditaria - GN en media luna",                d: "Nefropatía hereditaria con GN difusa en media luna" },
  { c: "N07.8", e: "nefrologia", n: "Nefropatía hereditaria - otras lesiones",                  d: "Nefropatía hereditaria con otras lesiones morfológicas" },

  // ═══ N08 – Trastornos glomerulares en otras enfermedades ════════════════
  { c: "N08",   e: "nefrologia", n: "Trastornos glomerulares en otras enfermedades",            d: "Trastornos glomerulares en enfermedades clasificadas en otra parte" },
  { c: "N08.1", e: "nefrologia", n: "Trastornos glomerulares en enfermedades neoplásicas",      d: "Trastornos glomerulares en enfermedades neoplásicas" },
  { c: "N08.4", e: "nefrologia", n: "Trastornos glomerulares en otras endocrinopatías",         d: "Trastornos glomerulares en otras enfermedades endocrinas" },
  { c: "N08.8", e: "nefrologia", n: "Trastornos glomerulares en otras enfermedades",            d: "Trastornos glomerulares en otras enfermedades clasificadas en otra parte" },

  // ═══ N13 – Uropatía obstructiva (subcódigos faltantes) ══════════════════
  { c: "N13.0", e: "nefrologia", n: "Hidronefrosis - obstrucción unión urétero-pélvica",        d: "Hidronefrosis con obstrucción de la unión urétero-pélvica" },
  { c: "N13.4", e: "nefrologia", n: "Hidrouréter",                                              d: "Hidrouréter" },
  { c: "N13.5", e: "nefrologia", n: "Torsión y estrechez del uréter sin hidronefrosis",         d: "Torsión y estrechez del uréter sin hidronefrosis" },
  { c: "N13.6", e: "nefrologia", n: "Pionefrosis",                                              d: "Pionefrosis" },
  { c: "N13.7", e: "nefrologia", n: "Uropatía asociada con reflujo vesicoureteral",             d: "Uropatía asociada con reflujo vesicoureteral" },
  { c: "N13.8", e: "nefrologia", n: "Otras uropatías obstructivas y por reflujo",               d: "Otras uropatías obstructivas y por reflujo" },
  { c: "N13.9", e: "nefrologia", n: "Uropatía obstructiva y por reflujo NE",                    d: "Uropatía obstructiva y por reflujo, sin otra especificación" },

  // ═══ N14 – Nefropatías inducidas (subcódigo faltante) ═══════════════════
  { c: "N14.4", e: "nefrologia", n: "Nefropatía tóxica NE",                                     d: "Nefropatía tóxica, no clasificada en otra parte" },

  // ═══ N15 – Otras enfermedades tubulointersticiales ═══════════════════════
  { c: "N15.0", e: "nefrologia", n: "Nefropatía de los Balcanes",                               d: "Nefropatía de los Balcanes (nefropatía endémica) " },
  { c: "N15.1", e: "nefrologia", n: "Absceso renal y perirrenal",                               d: "Absceso renal y perirrenal" },
  { c: "N15.8", e: "nefrologia", n: "Otras enfermedades tubulointersticiales especificadas",     d: "Otras enfermedades renales tubulointersticiales especificadas" },

  // ═══ N16 – Trastornos tubulointersticiales en otras enfermedades ═════════
  { c: "N16",   e: "nefrologia", n: "Trastornos tubulointersticiales en otras enfermedades",    d: "Trastornos renales tubulointersticiales en enfermedades clasificadas en otra parte" },
  { c: "N16.0", e: "nefrologia", n: "Trastornos tubulointersticiales - enf. infecciosas",       d: "Trastornos renales tubulointersticiales en enfermedades infecciosas" },
  { c: "N16.1", e: "nefrologia", n: "Trastornos tubulointersticiales - enf. neoplásicas",       d: "Trastornos renales tubulointersticiales en enfermedades neoplásicas" },
  { c: "N16.2", e: "nefrologia", n: "Trastornos tubulointersticiales - enf. de la sangre",      d: "Trastornos renales tubulointersticiales en enfermedades de la sangre" },
  { c: "N16.3", e: "nefrologia", n: "Trastornos tubulointersticiales - enf. metabólicas",       d: "Trastornos renales tubulointersticiales en enfermedades metabólicas" },
  { c: "N16.4", e: "nefrologia", n: "Trastornos tubulointersticiales - tejido conjuntivo",      d: "Trastornos renales tubulointersticiales en enfermedades del tejido conjuntivo" },
  { c: "N16.5", e: "nefrologia", n: "Trastornos tubulointersticiales - rechazo de trasplante",  d: "Trastornos renales tubulointersticiales en rechazo de trasplante" },
  { c: "N16.8", e: "nefrologia", n: "Trastornos tubulointersticiales - otras enfermedades",     d: "Trastornos renales tubulointersticiales en otras enfermedades clasificadas" },

  // ═══ N18 – Insuficiencia renal crónica (versión CIE-10 español) ══════════
  { c: "N18.0", e: "nefrologia", n: "Insuficiencia renal terminal (ERC estadio 5 terminal)",    d: "Insuficiencia renal terminal" },
  { c: "N18.8", e: "nefrologia", n: "Otras insuficiencias renales crónicas",                    d: "Otras insuficiencias renales crónicas" },

  // ═══ N21 – Cálculos vías urinarias bajas ════════════════════════════════
  { c: "N21",   e: "nefrologia", n: "Cálculo de vías urinarias inferiores",                     d: "Cálculo de las vías urinarias inferiores" },
  { c: "N21.1", e: "nefrologia", n: "Cálculo en la uretra",                                     d: "Cálculo en la uretra" },
  { c: "N21.8", e: "nefrologia", n: "Otros cálculos de vías urinarias inferiores",              d: "Otros cálculos de las vías urinarias inferiores" },
  { c: "N21.9", e: "nefrologia", n: "Cálculo de vías urinarias inferiores NE",                  d: "Cálculo de las vías urinarias inferiores, no especificado" },

  // ═══ N22 – Cálculos en otras enfermedades ════════════════════════════════
  { c: "N22",   e: "nefrologia", n: "Cálculo de vías urinarias en otras enfermedades",          d: "Cálculo de las vías urinarias en enfermedades clasificadas en otra parte" },
  { c: "N22.0", e: "nefrologia", n: "Litiasis urinaria en esquistosomiasis",                    d: "Litiasis urinaria en esquistosomiasis" },
  { c: "N22.8", e: "nefrologia", n: "Cálculo urinario en otras enfermedades clasificadas",      d: "Cálculo de las vías urinarias en otras enfermedades clasificadas" },

  // ═══ N25 – Trastornos tubulares (cabecera) ═══════════════════════════════
  { c: "N25",   e: "nefrologia", n: "Trastornos por función tubular renal alterada",            d: "Trastornos resultantes de la función tubular renal alterada" },

  // ═══ N27-N29 (cabeceras) ══════════════════════════════════════════════════
  { c: "N27",   e: "nefrologia", n: "Riñón pequeño de causa desconocida",                       d: "Riñón pequeño de causa desconocida" },
  { c: "N28",   e: "nefrologia", n: "Otros trastornos del riñón y del uréter",                  d: "Otros trastornos del riñón y del uréter" },
  { c: "N29",   e: "nefrologia", n: "Otros trastornos renales en otras enfermedades",           d: "Otros trastornos del riñón y del uréter en enfermedades clasificadas" },
  { c: "N29.8", e: "nefrologia", n: "Otros trastornos renales en otras enfermedades clasif.",   d: "Otros trastornos del riñón y del uréter en otras enfermedades clasificadas" },

  // ═══ N30 – Cistitis ══════════════════════════════════════════════════════
  { c: "N30",   e: "nefrologia", n: "Cistitis",                                                 d: "Cistitis" },
  { c: "N30.0", e: "nefrologia", n: "Cistitis aguda",                                           d: "Cistitis aguda" },
  { c: "N30.1", e: "nefrologia", n: "Cistitis intersticial crónica",                            d: "Cistitis intersticial (crónica)" },
  { c: "N30.2", e: "nefrologia", n: "Otras cistitis crónicas",                                  d: "Otras cistitis crónicas" },
  { c: "N30.3", e: "nefrologia", n: "Trigonitis",                                               d: "Trigonitis" },
  { c: "N30.4", e: "nefrologia", n: "Cistitis por irradiación",                                 d: "Cistitis por irradiación" },
  { c: "N30.8", e: "nefrologia", n: "Otras cistitis",                                           d: "Otras cistitis" },
  { c: "N30.9", e: "nefrologia", n: "Cistitis no especificada",                                 d: "Cistitis, no especificada" },

  // ═══ N31 – Disfunción neuromuscular de la vejiga ════════════════════════
  { c: "N31",   e: "nefrologia", n: "Disfunción neuromuscular de la vejiga",                    d: "Disfunción neuromuscular de la vejiga" },
  { c: "N31.0", e: "nefrologia", n: "Vejiga neuropática no inhibida",                           d: "Vejiga neuropática no inhibida, no clasificada en otra parte" },
  { c: "N31.1", e: "nefrologia", n: "Vejiga neuropática refleja",                               d: "Vejiga neuropática refleja" },
  { c: "N31.2", e: "nefrologia", n: "Vejiga neuropática flácida",                               d: "Vejiga neuropática flácida" },
  { c: "N31.8", e: "nefrologia", n: "Otras disfunciones neuromusculares de la vejiga",          d: "Otras disfunciones neuromusculares de la vejiga" },
  { c: "N31.9", e: "nefrologia", n: "Disfunción neuromuscular de la vejiga NE",                 d: "Disfunción neuromuscular de la vejiga, no especificada" },

  // ═══ N32 – Otros trastornos de la vejiga ════════════════════════════════
  { c: "N32",   e: "nefrologia", n: "Otros trastornos de la vejiga",                            d: "Otros trastornos de la vejiga" },
  { c: "N32.0", e: "nefrologia", n: "Obstrucción de cuello de la vejiga",                       d: "Obstrucción de cuello de la vejiga" },
  { c: "N32.1", e: "nefrologia", n: "Fístula vesicointestinal",                                 d: "Fístula vesicointestinal" },
  { c: "N32.2", e: "nefrologia", n: "Fístula de la vejiga NE",                                  d: "Fístula de la vejiga, no clasificada en otra parte" },
  { c: "N32.3", e: "nefrologia", n: "Divertículo de la vejiga",                                 d: "Divertículo de la vejiga" },
  { c: "N32.4", e: "nefrologia", n: "Ruptura de la vejiga no traumática",                       d: "Ruptura de la vejiga, no traumática" },
  { c: "N32.8", e: "nefrologia", n: "Otros trastornos especificados de la vejiga",              d: "Otros trastornos especificados de la vejiga" },
  { c: "N32.9", e: "nefrologia", n: "Trastorno de la vejiga NE",                               d: "Trastorno de la vejiga, no especificado" },

  // ═══ N33 – Trastornos de la vejiga en otras enfermedades ════════════════
  { c: "N33",   e: "nefrologia", n: "Trastornos de la vejiga en otras enfermedades",            d: "Trastornos de la vejiga en enfermedades clasificadas en otra parte" },
  { c: "N33.0", e: "nefrologia", n: "Cistitis tuberculosa",                                     d: "Cistitis tuberculosa" },
  { c: "N33.8", e: "nefrologia", n: "Trastornos de la vejiga en otras enfermedades",            d: "Trastornos de la vejiga en otras enfermedades clasificadas" },

  // ═══ N34 – Uretritis ════════════════════════════════════════════════════
  { c: "N34",   e: "nefrologia", n: "Uretritis y síndrome uretral",                             d: "Uretritis y síndrome uretral" },
  { c: "N34.0", e: "nefrologia", n: "Absceso uretral",                                          d: "Absceso uretral" },
  { c: "N34.1", e: "nefrologia", n: "Uretritis no específica",                                  d: "Uretritis no específica" },
  { c: "N34.2", e: "nefrologia", n: "Otras uretritis",                                          d: "Otras uretritis" },
  { c: "N34.3", e: "nefrologia", n: "Síndrome uretral no especificado",                         d: "Síndrome uretral, no especificado" },

  // ═══ N35 – Estrechez uretral ════════════════════════════════════════════
  { c: "N35",   e: "nefrologia", n: "Estrechez uretral",                                        d: "Estrechez uretral" },
  { c: "N35.0", e: "nefrologia", n: "Estrechez uretral postraumática",                          d: "Estrechez uretral postraumática" },
  { c: "N35.1", e: "nefrologia", n: "Estrechez uretral postinfección",                          d: "Estrechez uretral postinfección" },
  { c: "N35.8", e: "nefrologia", n: "Otras estrecheces uretrales",                              d: "Otras estrecheces uretrales" },
  { c: "N35.9", e: "nefrologia", n: "Estrechez uretral NE",                                     d: "Estrechez uretral, no especificada" },

  // ═══ N36 – Otros trastornos de la uretra ════════════════════════════════
  { c: "N36",   e: "nefrologia", n: "Otros trastornos de la uretra",                            d: "Otros trastornos de la uretra" },
  { c: "N36.0", e: "nefrologia", n: "Fístula de la uretra",                                     d: "Fístula de la uretra" },
  { c: "N36.1", e: "nefrologia", n: "Divertículo de la uretra",                                 d: "Divertículo de la uretra" },
  { c: "N36.2", e: "nefrologia", n: "Carúncula uretral",                                        d: "Carúncula uretral" },
  { c: "N36.3", e: "nefrologia", n: "Prolapso de la mucosa uretral",                            d: "Prolapso de la mucosa uretral" },
  { c: "N36.8", e: "nefrologia", n: "Otros trastornos especificados de la uretra",              d: "Otros trastornos especificados de la uretra" },
  { c: "N36.9", e: "nefrologia", n: "Trastorno de la uretra NE",                               d: "Trastorno de la uretra, no especificado" },

  // ═══ N37 – Trastornos de la uretra en otras enfermedades ════════════════
  { c: "N37",   e: "nefrologia", n: "Trastornos de la uretra en otras enfermedades",            d: "Trastornos de la uretra en enfermedades clasificadas en otra parte" },
  { c: "N37.0", e: "nefrologia", n: "Uretritis en otras enfermedades clasificadas",             d: "Uretritis en enfermedades clasificadas en otra parte" },
  { c: "N37.8", e: "nefrologia", n: "Otros trastornos uretrales en otras enfermedades",         d: "Otros trastornos uretrales en enfermedades clasificadas en otra parte" },

  // ═══ N39 – Otros trastornos del sistema urinario ════════════════════════
  { c: "N39",   e: "nefrologia", n: "Otros trastornos del sistema urinario",                    d: "Otros trastornos del sistema urinario" },
  { c: "N39.1", e: "nefrologia", n: "Proteinuria persistente NE",                               d: "Proteinuria persistente, no especificada" },
  { c: "N39.2", e: "nefrologia", n: "Proteinuria ortostática NE",                               d: "Proteinuria ortostática, no especificada" },
  { c: "N39.3", e: "nefrologia", n: "Incontinencia urinaria por tensión",                       d: "Incontinencia urinaria por tensión" },
  { c: "N39.8", e: "nefrologia", n: "Otros trastornos especificados del sistema urinario",      d: "Otros trastornos especificados del sistema urinario" },
  { c: "N39.9", e: "nefrologia", n: "Trastorno del sistema urinario NE",                       d: "Trastorno del sistema urinario, no especificado" },

  // ═══════════════════════════════════════════════════════════════════════════
  //  N40–N51  ÓRGANOS GENITALES MASCULINOS
  // ═══════════════════════════════════════════════════════════════════════════
  { c: "N40",   e: "urologia",   n: "Hiperplasia de la próstata",                               d: "Hiperplasia de la próstata" },
  { c: "N41",   e: "urologia",   n: "Enfermedades inflamatorias de la próstata",                d: "Enfermedades inflamatorias de la próstata" },
  { c: "N41.0", e: "urologia",   n: "Prostatitis aguda",                                        d: "Prostatitis aguda" },
  { c: "N41.1", e: "urologia",   n: "Prostatitis crónica",                                      d: "Prostatitis crónica" },
  { c: "N41.2", e: "urologia",   n: "Absceso de la próstata",                                   d: "Absceso de la próstata" },
  { c: "N41.3", e: "urologia",   n: "Prostatocistitis",                                         d: "Prostatocistitis" },
  { c: "N41.8", e: "urologia",   n: "Otras enf. inflamatorias de la próstata",                  d: "Otras enfermedades inflamatorias de la próstata" },
  { c: "N41.9", e: "urologia",   n: "Enf. inflamatoria de la próstata NE",                     d: "Enfermedad inflamatoria de la próstata, no especificada" },
  { c: "N42",   e: "urologia",   n: "Otros trastornos de la próstata",                          d: "Otros trastornos de la próstata" },
  { c: "N42.0", e: "urologia",   n: "Cálculo de la próstata",                                   d: "Cálculo de la próstata" },
  { c: "N42.1", e: "urologia",   n: "Congestión y hemorragia de la próstata",                   d: "Congestión y hemorragia de la próstata" },
  { c: "N42.2", e: "urologia",   n: "Atrofia de la próstata",                                   d: "Atrofia de la próstata" },
  { c: "N42.8", e: "urologia",   n: "Otros trastornos especificados de la próstata",            d: "Otros trastornos especificados de la próstata" },
  { c: "N42.9", e: "urologia",   n: "Trastorno de la próstata NE",                             d: "Trastorno de la próstata, no especificado" },
  { c: "N43",   e: "urologia",   n: "Hidrocele y espermatocele",                                d: "Hidrocele y espermatocele" },
  { c: "N43.0", e: "urologia",   n: "Hidrocele enquistado",                                     d: "Hidrocele enquistado" },
  { c: "N43.1", e: "urologia",   n: "Hidrocele infectado",                                      d: "Hidrocele infectado" },
  { c: "N43.2", e: "urologia",   n: "Otros hidroceles",                                         d: "Otros hidroceles" },
  { c: "N43.3", e: "urologia",   n: "Hidrocele NE",                                             d: "Hidrocele, no especificado" },
  { c: "N43.4", e: "urologia",   n: "Espermatocele",                                            d: "Espermatocele" },
  { c: "N44",   e: "urologia",   n: "Torsión del testículo",                                    d: "Torsión del testículo" },
  { c: "N45",   e: "urologia",   n: "Orquitis y epididimitis",                                  d: "Orquitis y epididimitis" },
  { c: "N45.0", e: "urologia",   n: "Orquitis, epididimitis con absceso",                       d: "Orquitis, epididimitis y orquiepididimitis con absceso" },
  { c: "N45.9", e: "urologia",   n: "Orquitis, epididimitis sin absceso",                       d: "Orquitis, epididimitis y orquiepididimitis sin absceso" },
  { c: "N46",   e: "urologia",   n: "Esterilidad masculina",                                    d: "Esterilidad en el varón" },
  { c: "N47",   e: "urologia",   n: "Prepucio redundante, fimosis y parafimosis",               d: "Prepucio redundante, fimosis y parafimosis" },
  { c: "N48",   e: "urologia",   n: "Otros trastornos del pene",                                d: "Otros trastornos del pene" },
  { c: "N48.0", e: "urologia",   n: "Leucoplasia del pene",                                     d: "Leucoplasia del pene" },
  { c: "N48.1", e: "urologia",   n: "Balanopostitis",                                           d: "Balanopostitis" },
  { c: "N48.2", e: "urologia",   n: "Otros trastornos inflamatorios del pene",                  d: "Otros trastornos inflamatorios del pene" },
  { c: "N48.3", e: "urologia",   n: "Priapismo",                                                d: "Priapismo" },
  { c: "N48.4", e: "urologia",   n: "Impotencia de origen orgánico",                            d: "Impotencia de origen orgánico" },
  { c: "N48.5", e: "urologia",   n: "Úlcera del pene",                                          d: "Úlcera del pene" },
  { c: "N48.6", e: "urologia",   n: "Induración plástica del pene (Enfermedad de Peyronie)",    d: "Induración plástica del pene" },
  { c: "N48.8", e: "urologia",   n: "Otros trastornos especificados del pene",                  d: "Otros trastornos especificados del pene" },
  { c: "N48.9", e: "urologia",   n: "Trastorno del pene NE",                                   d: "Trastorno del pene, no especificado" },
  { c: "N49",   e: "urologia",   n: "Trastornos inflamatorios genitales masculinos NE",         d: "Trastornos inflamatorios de órganos genitales masculinos no especificados" },
  { c: "N49.0", e: "urologia",   n: "Trastornos inflamatorios de vesícula seminal",             d: "Trastornos inflamatorios de vesícula seminal" },
  { c: "N49.1", e: "urologia",   n: "Trastornos inflamatorios del cordón espermático",          d: "Trastornos inflamatorios del cordón espermático, la túnica vaginal y el vas deferens" },
  { c: "N49.2", e: "urologia",   n: "Trastornos inflamatorios del escroto",                     d: "Trastornos inflamatorios del escroto" },
  { c: "N49.8", e: "urologia",   n: "Otros trastornos inflamatorios genitales masculinos",      d: "Otros trastornos inflamatorios de los órganos genitales masculinos especificados" },
  { c: "N49.9", e: "urologia",   n: "Trastorno inflamatorio genital masculino NE",              d: "Trastorno inflamatorio de órgano genital masculino no especificado" },
  { c: "N50",   e: "urologia",   n: "Otros trastornos de órganos genitales masculinos",         d: "Otros trastornos de los órganos genitales masculinos" },
  { c: "N50.0", e: "urologia",   n: "Atrofia del testículo",                                    d: "Atrofia del testículo" },
  { c: "N50.1", e: "urologia",   n: "Trastornos vasculares genitales masculinos",               d: "Trastornos vasculares de los órganos genitales masculinos" },
  { c: "N50.8", e: "urologia",   n: "Otros trastornos especificados genitales masculinos",      d: "Otros trastornos especificados de los órganos genitales masculinos" },
  { c: "N50.9", e: "urologia",   n: "Trastorno genital masculino NE",                           d: "Trastorno no especificado de los órganos genitales masculinos" },
  { c: "N51",   e: "urologia",   n: "Trastornos genitales masculinos en otras enfermedades",    d: "Trastornos de los órganos genitales masculinos en enfermedades clasificadas" },
  { c: "N51.0", e: "urologia",   n: "Trastornos de próstata en otras enfermedades",             d: "Trastornos de próstata en enfermedades clasificadas en otra parte" },
  { c: "N51.1", e: "urologia",   n: "Trastornos testículo y epidídimo en otras enfermedades",   d: "Trastornos del testículo y del epidídimo en enfermedades clasificadas en otra parte" },
  { c: "N51.2", e: "urologia",   n: "Balanitis en otras enfermedades",                          d: "Balanitis en enfermedades clasificadas en otra parte" },
  { c: "N51.8", e: "urologia",   n: "Otros trastornos genitales masculinos en otras enf.",      d: "Otros trastornos de los órganos genitales masculinos en enfermedades clasificadas" },

  // ═══════════════════════════════════════════════════════════════════════════
  //  N60–N64  MAMA
  // ═══════════════════════════════════════════════════════════════════════════
  { c: "N60",   e: "ginecologia", n: "Displasia mamaria benigna",                               d: "Displasia mamaria benigna" },
  { c: "N60.0", e: "ginecologia", n: "Quiste solitario de la mama",                             d: "Quiste solitario de la mama" },
  { c: "N60.1", e: "ginecologia", n: "Mastopatía quística difusa",                              d: "Mastopatía quística difusa" },
  { c: "N60.2", e: "ginecologia", n: "Fibroadenosis de mama",                                   d: "Fibroadenosis de mama" },
  { c: "N60.3", e: "ginecologia", n: "Fibroesclerosis de mama",                                 d: "Fibroesclerosis de mama" },
  { c: "N60.4", e: "ginecologia", n: "Ectasia de conducto mamario",                             d: "Ectasia de conducto mamario" },
  { c: "N60.8", e: "ginecologia", n: "Otras displasias mamarias benignas",                      d: "Otras displasias mamarias benignas" },
  { c: "N60.9", e: "ginecologia", n: "Displasia mamaria benigna NE",                           d: "Displasia mamaria benigna, sin otra especificación" },
  { c: "N61",   e: "ginecologia", n: "Trastornos inflamatorios de la mama",                     d: "Trastornos inflamatorios de la mama (mastitis)" },
  { c: "N62",   e: "ginecologia", n: "Hipertrofia de la mama",                                  d: "Hipertrofia de la mama" },
  { c: "N63",   e: "ginecologia", n: "Masa no especificada en la mama",                         d: "Masa no especificada en la mama" },
  { c: "N64",   e: "ginecologia", n: "Otros trastornos de la mama",                             d: "Otros trastornos de la mama" },
  { c: "N64.0", e: "ginecologia", n: "Fisura y fístula del pezón",                              d: "Fisura y fístula del pezón" },
  { c: "N64.1", e: "ginecologia", n: "Necrosis grasa de la mama",                               d: "Necrosis grasa de la mama" },
  { c: "N64.2", e: "ginecologia", n: "Atrofia de la mama",                                      d: "Atrofia de la mama" },
  { c: "N64.3", e: "ginecologia", n: "Galactorrea no asociada con el parto",                    d: "Galactorrea no asociada con el parto" },
  { c: "N64.4", e: "ginecologia", n: "Mastodinia",                                              d: "Mastodinia" },
  { c: "N64.5", e: "ginecologia", n: "Otros signos y síntomas relativos a la mama",             d: "Otros signos y síntomas relativos a la mama" },
  { c: "N64.8", e: "ginecologia", n: "Otros trastornos especificados de la mama",               d: "Otros trastornos especificados de la mama" },
  { c: "N64.9", e: "ginecologia", n: "Trastorno de la mama NE",                                 d: "Trastorno de la mama, no especificado" },

  // ═══════════════════════════════════════════════════════════════════════════
  //  N70–N77  ENFERMEDADES INFLAMATORIAS PÉLVICAS FEMENINAS
  // ═══════════════════════════════════════════════════════════════════════════
  { c: "N70",   e: "ginecologia", n: "Salpingitis y ooforitis",                                 d: "Salpingitis y ooforitis" },
  { c: "N70.0", e: "ginecologia", n: "Salpingitis y ooforitis aguda",                           d: "Salpingitis y ooforitis aguda" },
  { c: "N70.1", e: "ginecologia", n: "Salpingitis y ooforitis crónica",                         d: "Salpingitis y ooforitis crónica" },
  { c: "N70.9", e: "ginecologia", n: "Salpingitis y ooforitis NE",                              d: "Salpingitis y ooforitis, no especificadas" },
  { c: "N71",   e: "ginecologia", n: "Enfermedad inflamatoria del útero",                       d: "Enfermedad inflamatoria del útero, excepto del cuello uterino" },
  { c: "N71.0", e: "ginecologia", n: "Enfermedad inflamatoria aguda del útero",                 d: "Enfermedad inflamatoria aguda del útero" },
  { c: "N71.1", e: "ginecologia", n: "Enfermedad inflamatoria crónica del útero",               d: "Enfermedad inflamatoria crónica del útero" },
  { c: "N71.9", e: "ginecologia", n: "Enfermedad inflamatoria del útero NE",                   d: "Enfermedad inflamatoria del útero, no especificada" },
  { c: "N72",   e: "ginecologia", n: "Enfermedad inflamatoria del cuello uterino",              d: "Enfermedad inflamatoria del cuello uterino (cervicitis)" },
  { c: "N73",   e: "ginecologia", n: "Otras enfermedades pélvicas inflamatorias femeninas",     d: "Otras enfermedades pélvicas inflamatorias femeninas" },
  { c: "N73.0", e: "ginecologia", n: "Parametritis y celulitis pélvica aguda",                  d: "Parametritis y celulitis pélvica aguda" },
  { c: "N73.1", e: "ginecologia", n: "Parametritis y celulitis pélvica crónica",                d: "Parametritis y celulitis pélvica crónica" },
  { c: "N73.2", e: "ginecologia", n: "Parametritis y celulitis pélvica NE",                    d: "Parametritis y celulitis pélvica no especificada" },
  { c: "N73.3", e: "ginecologia", n: "Peritonitis pélvica aguda femenina",                      d: "Peritonitis pélvica aguda, femenina" },
  { c: "N73.4", e: "ginecologia", n: "Peritonitis pélvica crónica femenina",                    d: "Peritonitis pélvica crónica, femenina" },
  { c: "N73.5", e: "ginecologia", n: "Peritonitis pélvica femenina NE",                        d: "Peritonitis pélvica femenina, no especificada" },
  { c: "N73.6", e: "ginecologia", n: "Adherencias peritoneales pélvicas femeninas",             d: "Adherencias peritoneales pélvicas femeninas" },
  { c: "N73.8", e: "ginecologia", n: "Otras enf. inflamatorias pélvicas femeninas",             d: "Otras enfermedades inflamatorias pélvicas femeninas" },
  { c: "N73.9", e: "ginecologia", n: "Enf. inflamatoria pélvica femenina NE",                  d: "Enfermedad inflamatoria pélvica femenina, no especificada" },
  { c: "N74",   e: "ginecologia", n: "Trastornos inflamatorios pélvicos en otras enf.",         d: "Trastornos inflamatorios de la pelvis femenina en enfermedades clasificadas" },
  { c: "N74.0", e: "ginecologia", n: "Infección tuberculosa del cuello del útero",              d: "Infección tuberculosa del cuello del útero" },
  { c: "N74.1", e: "ginecologia", n: "EIP femenina por tuberculosis",                           d: "Enfermedad inflamatoria pélvica femenina por tuberculosis" },
  { c: "N74.2", e: "ginecologia", n: "EIP femenina por sífilis",                                d: "Enfermedad inflamatoria pélvica femenina por sífilis" },
  { c: "N74.3", e: "ginecologia", n: "EIP femenina por gonococos",                              d: "Enfermedad inflamatoria pélvica femenina por gonococos" },
  { c: "N74.4", e: "ginecologia", n: "EIP femenina por clamidias",                              d: "Enfermedad inflamatoria pélvica femenina por clamidias" },
  { c: "N74.8", e: "ginecologia", n: "Trastornos inflamatorios pélvicos en otras enf.",         d: "Trastornos inflamatorios pélvicos femeninos en otras enfermedades" },
  { c: "N75",   e: "ginecologia", n: "Enfermedades de la glándula de Bartholin",                d: "Enfermedades de la glándula de Bartholin" },
  { c: "N75.0", e: "ginecologia", n: "Quiste de la glándula de Bartholin",                      d: "Quiste de la glándula de Bartholin" },
  { c: "N75.1", e: "ginecologia", n: "Absceso de la glándula de Bartholin",                     d: "Absceso de la glándula de Bartholin" },
  { c: "N75.8", e: "ginecologia", n: "Otras enfermedades de la glándula de Bartholin",          d: "Otras enfermedades de la glándula de Bartholin" },
  { c: "N75.9", e: "ginecologia", n: "Enf. de la glándula de Bartholin NE",                    d: "Enfermedad de la glándula de Bartholin, no especificada" },
  { c: "N76",   e: "ginecologia", n: "Afecciones inflamatorias de vagina y vulva",              d: "Otras afecciones inflamatorias de la vagina y de la vulva" },
  { c: "N76.0", e: "ginecologia", n: "Vaginitis aguda",                                         d: "Vaginitis aguda" },
  { c: "N76.1", e: "ginecologia", n: "Vaginitis subaguda y crónica",                            d: "Vaginitis subaguda y crónica" },
  { c: "N76.2", e: "ginecologia", n: "Vulvitis aguda",                                          d: "Vulvitis aguda" },
  { c: "N76.3", e: "ginecologia", n: "Vulvitis subaguda y crónica",                             d: "Vulvitis subaguda y crónica" },
  { c: "N76.4", e: "ginecologia", n: "Absceso vulvar",                                          d: "Absceso vulvar" },
  { c: "N76.5", e: "ginecologia", n: "Ulceración de la vagina",                                 d: "Ulceración de la vagina" },
  { c: "N76.6", e: "ginecologia", n: "Ulceración de la vulva",                                  d: "Ulceración de la vulva" },
  { c: "N76.8", e: "ginecologia", n: "Otras inflamaciones de vagina y vulva",                   d: "Otras inflamaciones especificadas de la vagina y de la vulva" },
  { c: "N77",   e: "ginecologia", n: "Ulceración e inflamación vulvovaginal en otras enf.",     d: "Ulceración e inflamación vulvovaginal en enfermedades clasificadas" },
  { c: "N77.0", e: "ginecologia", n: "Ulceración de la vulva en enf. infecciosas",              d: "Ulceración de la vulva en enfermedades infecciosas y parasitarias" },
  { c: "N77.1", e: "ginecologia", n: "Vaginitis, vulvitis en enf. infecciosas",                 d: "Vaginitis, vulvitis y vulvovaginitis en enfermedades infecciosas y parasitarias" },
  { c: "N77.8", e: "ginecologia", n: "Ulceración vulvovaginal en otras enf. clasificadas",      d: "Ulceración e inflamación vulvovaginal en otras enfermedades clasificadas" },

  // ═══════════════════════════════════════════════════════════════════════════
  //  N80–N98  TRASTORNOS NO INFLAMATORIOS GENITALES FEMENINOS
  // ═══════════════════════════════════════════════════════════════════════════
  { c: "N80",   e: "ginecologia", n: "Endometriosis",                                           d: "Endometriosis" },
  { c: "N80.0", e: "ginecologia", n: "Endometriosis del útero",                                 d: "Endometriosis del útero (adenomiosis)" },
  { c: "N80.1", e: "ginecologia", n: "Endometriosis del ovario",                                d: "Endometriosis del ovario" },
  { c: "N80.2", e: "ginecologia", n: "Endometriosis de la trompa de Falopio",                   d: "Endometriosis de la trompa de Falopio" },
  { c: "N80.3", e: "ginecologia", n: "Endometriosis del peritoneo pélvico",                     d: "Endometriosis del peritoneo pélvico" },
  { c: "N80.4", e: "ginecologia", n: "Endometriosis del tabique rectovaginal y vagina",         d: "Endometriosis del tabique rectovaginal y de la vagina" },
  { c: "N80.5", e: "ginecologia", n: "Endometriosis del intestino",                             d: "Endometriosis del intestino" },
  { c: "N80.6", e: "ginecologia", n: "Endometriosis en cicatriz cutánea",                       d: "Endometriosis en cicatriz cutánea" },
  { c: "N80.8", e: "ginecologia", n: "Otras endometriosis",                                     d: "Otras endometriosis" },
  { c: "N80.9", e: "ginecologia", n: "Endometriosis NE",                                        d: "Endometriosis, no especificada" },
  { c: "N81",   e: "ginecologia", n: "Prolapso genital femenino",                               d: "Prolapso genital femenino" },
  { c: "N81.0", e: "ginecologia", n: "Uretrocele femenino",                                     d: "Uretrocele femenino" },
  { c: "N81.1", e: "ginecologia", n: "Cistocele",                                               d: "Cistocele" },
  { c: "N81.2", e: "ginecologia", n: "Prolapso uterovaginal incompleto",                        d: "Prolapso uterovaginal incompleto" },
  { c: "N81.3", e: "ginecologia", n: "Prolapso uterovaginal completo",                          d: "Prolapso uterovaginal completo" },
  { c: "N81.4", e: "ginecologia", n: "Prolapso uterovaginal NE",                               d: "Prolapso uterovaginal, sin otra especificación" },
  { c: "N81.5", e: "ginecologia", n: "Enterocele vaginal",                                      d: "Enterocele vaginal" },
  { c: "N81.6", e: "ginecologia", n: "Rectocele",                                               d: "Rectocele" },
  { c: "N81.8", e: "ginecologia", n: "Otros prolapsos genitales femeninos",                     d: "Otros prolapsos genitales femeninos" },
  { c: "N81.9", e: "ginecologia", n: "Prolapso genital femenino NE",                           d: "Prolapso genital femenino, no especificado" },
  { c: "N82",   e: "ginecologia", n: "Fístulas del tracto genital femenino",                    d: "Fístulas que afectan el tracto genital femenino" },
  { c: "N82.0", e: "ginecologia", n: "Fístula vesicovaginal",                                   d: "Fístula vesicovaginal" },
  { c: "N82.1", e: "ginecologia", n: "Otras fístulas de vías genitourinarias femeninas",        d: "Otras fístulas de las vías genitourinarias femeninas" },
  { c: "N82.2", e: "ginecologia", n: "Fístula vagina - intestino delgado",                      d: "Fístula de la vagina al intestino delgado" },
  { c: "N82.3", e: "ginecologia", n: "Fístula vagina - intestino grueso",                       d: "Fístula de la vagina al intestino grueso" },
  { c: "N82.4", e: "ginecologia", n: "Otras fístulas genital femenino - tracto intestinal",     d: "Otras fístulas del tracto genital femenino al tracto intestinal" },
  { c: "N82.5", e: "ginecologia", n: "Fístula tracto genital femenino a la piel",               d: "Fístula del tracto genital femenino a la piel" },
  { c: "N82.8", e: "ginecologia", n: "Otras fístulas del tracto genital femenino",              d: "Otras fístulas del tracto genital femenino" },
  { c: "N82.9", e: "ginecologia", n: "Fístula del tracto genital femenino NE",                 d: "Fístula del tracto genital femenino, sin otra especificación" },
  { c: "N83",   e: "ginecologia", n: "Trastornos no inflamatorios del ovario y trompa",         d: "Trastornos no inflamatorios del ovario, de la trompa de Falopio y del ligamento ancho" },
  { c: "N83.0", e: "ginecologia", n: "Quiste folicular del ovario",                             d: "Quiste folicular del ovario" },
  { c: "N83.1", e: "ginecologia", n: "Quiste del cuerpo amarillo",                              d: "Quiste del cuerpo amarillo" },
  { c: "N83.2", e: "ginecologia", n: "Otros quistes ováricos NE",                               d: "Otros quistes ováricos y los no especificados" },
  { c: "N83.3", e: "ginecologia", n: "Atrofia adquirida del ovario y trompa",                   d: "Atrofia adquirida del ovario y de la trompa de Falopio" },
  { c: "N83.4", e: "ginecologia", n: "Prolapso y hernia del ovario y trompa",                   d: "Prolapso y hernia del ovario y de la trompa de Falopio" },
  { c: "N83.5", e: "ginecologia", n: "Torsión de ovario, pedículo de ovario y trompa",          d: "Torsión de ovario, pedículo de ovario y trompa de Falopio" },
  { c: "N83.6", e: "ginecologia", n: "Hematosalpinx",                                           d: "Hematosalpinx" },
  { c: "N83.7", e: "ginecologia", n: "Hematoma del ligamento ancho",                            d: "Hematoma del ligamento ancho" },
  { c: "N83.8", e: "ginecologia", n: "Otros trastornos no inflamatorios ovario y trompa",       d: "Otros trastornos no inflamatorios del ovario, de la trompa de Falopio y del ligamento" },
  { c: "N83.9", e: "ginecologia", n: "Enf. no inflamatoria ovario y trompa NE",                d: "Enfermedad no inflamatoria del ovario, de la trompa de Falopio y del ligamento ancho NE" },
  { c: "N84",   e: "ginecologia", n: "Pólipo del tracto genital femenino",                      d: "Pólipo del tracto genital femenino" },
  { c: "N84.0", e: "ginecologia", n: "Pólipo del cuerpo del útero",                             d: "Pólipo del cuerpo del útero (pólipo endometrial)" },
  { c: "N84.1", e: "ginecologia", n: "Pólipo del cuello del útero",                             d: "Pólipo del cuello del útero" },
  { c: "N84.2", e: "ginecologia", n: "Pólipo de la vagina",                                     d: "Pólipo de la vagina" },
  { c: "N84.3", e: "ginecologia", n: "Pólipo de la vulva",                                      d: "Pólipo de la vulva" },
  { c: "N84.8", e: "ginecologia", n: "Pólipos de otras partes del tracto genital femenino",     d: "Pólipos de otras partes del tracto genital femenino" },
  { c: "N84.9", e: "ginecologia", n: "Pólipo del tracto genital femenino NE",                  d: "Pólipo del tracto genital femenino, no especificado" },
  { c: "N85",   e: "ginecologia", n: "Otros trastornos no inflamatorios del útero",             d: "Otros trastornos no inflamatorios del útero, excepto del cuello" },
  { c: "N85.0", e: "ginecologia", n: "Hiperplasia de glándula del endometrio",                  d: "Hiperplasia de glándula del endometrio" },
  { c: "N85.1", e: "ginecologia", n: "Hiperplasia adenomatosa del endometrio",                  d: "Hiperplasia adenomatosa del endometrio" },
  { c: "N85.2", e: "ginecologia", n: "Hipertrofia del útero",                                   d: "Hipertrofia del útero" },
  { c: "N85.3", e: "ginecologia", n: "Subinvolución del útero",                                 d: "Subinvolución del útero" },
  { c: "N85.4", e: "ginecologia", n: "Mala posición del útero",                                 d: "Mala posición del útero" },
  { c: "N85.5", e: "ginecologia", n: "Inversión del útero",                                     d: "Inversión del útero" },
  { c: "N85.6", e: "ginecologia", n: "Sinequias intrauterinas",                                 d: "Sinequias intrauterinas" },
  { c: "N85.7", e: "ginecologia", n: "Hematómetra",                                             d: "Hematómetra" },
  { c: "N85.8", e: "ginecologia", n: "Otros trastornos no inflamatorios del útero",             d: "Otros trastornos no inflamatorios especificados del útero" },
  { c: "N85.9", e: "ginecologia", n: "Trastorno no inflamatorio del útero NE",                 d: "Trastorno no inflamatorio del útero, no especificado" },
  { c: "N86",   e: "ginecologia", n: "Erosión y ectropión del cuello del útero",                d: "Erosión y ectropión del cuello del útero" },
  { c: "N87",   e: "ginecologia", n: "Displasia del cuello uterino",                            d: "Displasia del cuello uterino" },
  { c: "N87.0", e: "ginecologia", n: "Displasia cervical leve (NIC I)",                         d: "Displasia cervical leve (Neoplasia intraepitelial cervical NIC I)" },
  { c: "N87.1", e: "ginecologia", n: "Displasia cervical moderada (NIC II)",                    d: "Displasia cervical moderada (NIC II)" },
  { c: "N87.2", e: "ginecologia", n: "Displasia cervical severa (NIC III)",                     d: "Displasia cervical severa, no clasificada en otra parte (NIC III)" },
  { c: "N87.9", e: "ginecologia", n: "Displasia del cuello del útero NE",                      d: "Displasia del cuello del útero, no especificada" },
  { c: "N88",   e: "ginecologia", n: "Otros trastornos no inflamatorios del cuello del útero",  d: "Otros trastornos no inflamatorios del cuello del útero" },
  { c: "N88.0", e: "ginecologia", n: "Leucoplasia del cuello del útero",                        d: "Leucoplasia del cuello del útero" },
  { c: "N88.1", e: "ginecologia", n: "Laceración antigua del cuello del útero",                 d: "Laceración antigua del cuello del útero" },
  { c: "N88.2", e: "ginecologia", n: "Estrechez y estenosis del cuello del útero",              d: "Estrechez y estenosis del cuello del útero" },
  { c: "N89",   e: "ginecologia", n: "Otros trastornos no inflamatorios de la vagina",          d: "Otros trastornos no inflamatorios de la vagina" },
  { c: "N89.0", e: "ginecologia", n: "Agenesia, defecto y atresia de la vagina",               d: "Agenesia, defecto y atresia de la vagina" },
  { c: "N89.1", e: "ginecologia", n: "Vaginitis atrófica",                                      d: "Vaginitis atrófica" },
  { c: "N89.2", e: "ginecologia", n: "Tabique vaginal",                                         d: "Tabique vaginal" },
  { c: "N89.3", e: "ginecologia", n: "Estrechez adquirida de la vagina",                        d: "Estrechez adquirida de la vagina" },
  { c: "N89.4", e: "ginecologia", n: "Fijación de la vagina",                                   d: "Fijación de la vagina" },
  { c: "N89.5", e: "ginecologia", n: "Laceración antigua de la vagina",                         d: "Laceración antigua de la vagina" },
  { c: "N89.6", e: "ginecologia", n: "Úlcera de la vagina",                                     d: "Úlcera de la vagina" },
  { c: "N89.7", e: "ginecologia", n: "Hematocolpos",                                            d: "Hematocolpos" },
  { c: "N89.8", e: "ginecologia", n: "Otros trastornos no inflamatorios de la vagina",          d: "Otros trastornos no inflamatorios especificados de la vagina" },
  { c: "N89.9", e: "ginecologia", n: "Trastorno no inflamatorio de la vagina NE",              d: "Trastorno no inflamatorio de la vagina, no especificado" },
  { c: "N90",   e: "ginecologia", n: "Otros trastornos no inflamatorios de vulva y perineo",    d: "Otros trastornos no inflamatorios de la vulva y el perineo" },
  { c: "N90.0", e: "ginecologia", n: "Agenesia de la vulva",                                    d: "Agenesia de la vulva" },
  { c: "N90.1", e: "ginecologia", n: "Quiste de la glándula de Bartolino",                      d: "Quiste de la glándula de Bartolino" },
  { c: "N90.2", e: "ginecologia", n: "Laceración antigua de la vulva",                          d: "Laceración antigua de la vulva" },
  { c: "N90.3", e: "ginecologia", n: "Estenosis de la vagina y vulva",                          d: "Estenosis de la vagina y vulva" },
  { c: "N90.4", e: "ginecologia", n: "Leucoplasia de la vulva",                                 d: "Leucoplasia de la vulva" },
  { c: "N90.5", e: "ginecologia", n: "Atipia de la vulva",                                      d: "Atipia de la vulva" },
  { c: "N90.6", e: "ginecologia", n: "Úlcera de la vulva",                                      d: "Úlcera de la vulva" },
  { c: "N90.7", e: "ginecologia", n: "Vulvodinia",                                              d: "Vulvodinia" },
  { c: "N90.8", e: "ginecologia", n: "Otros trastornos no inflamatorios de vulva y perineo",    d: "Otros trastornos no inflamatorios especificados de la vulva y el perineo" },
  { c: "N90.9", e: "ginecologia", n: "Trastorno no inflamatorio de vulva y perineo NE",        d: "Trastorno no inflamatorio de la vulva y el perineo, no especificado" },
  { c: "N91",   e: "ginecologia", n: "Ausencia, amenorrea y oligomenorrea",                     d: "Ausencia, escasez e infrecuencia de la menstruación" },
  { c: "N91.0", e: "ginecologia", n: "Amenorrea primaria",                                      d: "Amenorrea primaria" },
  { c: "N91.1", e: "ginecologia", n: "Amenorrea secundaria",                                    d: "Amenorrea secundaria" },
  { c: "N91.2", e: "ginecologia", n: "Amenorrea NE",                                            d: "Amenorrea, no especificada" },
  { c: "N91.3", e: "ginecologia", n: "Oligomenorrea primaria",                                  d: "Oligomenorrea primaria" },
  { c: "N91.4", e: "ginecologia", n: "Oligomenorrea secundaria",                                d: "Oligomenorrea secundaria" },
  { c: "N91.5", e: "ginecologia", n: "Oligomenorrea NE",                                        d: "Oligomenorrea, no especificada" },
  { c: "N92",   e: "ginecologia", n: "Hemorragia menstrual excesiva y frecuente",               d: "Hemorragia excesiva, frecuente e irregular de la menstruación" },
  { c: "N92.0", e: "ginecologia", n: "Menorragia e hipermenorrea",                              d: "Menorragia e hipermenorrea" },
  { c: "N92.1", e: "ginecologia", n: "Menometrorragia",                                         d: "Menometrorragia" },
  { c: "N92.2", e: "ginecologia", n: "Metrorragia",                                             d: "Metrorragia" },
  { c: "N92.3", e: "ginecologia", n: "Ovulación disfuncional",                                  d: "Ovulación disfuncional" },
  { c: "N92.4", e: "ginecologia", n: "Sangrado uterino excesivo en la pubertad",                d: "Sangrado uterino excesivo en la pubertad" },
  { c: "N92.5", e: "ginecologia", n: "Otros trastornos de menstruación especificados",          d: "Otros procedimientos especificados de menstruación" },
  { c: "N92.6", e: "ginecologia", n: "Trastorno de menstruación NE",                           d: "Trastorno de menstruación, no especificado" },
  { c: "N93",   e: "ginecologia", n: "Otros sangrados anormales del tracto genital femenino",   d: "Otras hemorragias y sangrados anormales de los órganos genitales femeninos" },
  { c: "N93.0", e: "ginecologia", n: "Sangrado premenstrual",                                   d: "Sangrado premenstrual" },
  { c: "N93.8", e: "ginecologia", n: "Otros sangrados especificados del tracto genital",        d: "Otros hemorragias especificadas del tracto genital femenino" },
  { c: "N93.9", e: "ginecologia", n: "Hemorragia del tracto genital femenino NE",              d: "Hemorragia del tracto genital femenino, no especificada" },
  { c: "N94",   e: "ginecologia", n: "Dolor y otras condiciones asociadas con genitales fem.",  d: "Dolor y otras condiciones asociadas con órganos genitales femeninos y ciclo menstrual" },
  { c: "N94.0", e: "ginecologia", n: "Mittelschmerz (dolor intermenstrual / ovulación)",        d: "Mittelschmerz" },
  { c: "N94.1", e: "ginecologia", n: "Dismenorrea",                                             d: "Dismenorrea" },
  { c: "N94.2", e: "ginecologia", n: "Vaginismo",                                               d: "Vaginismo" },
  { c: "N94.3", e: "ginecologia", n: "Dispareunia",                                             d: "Dispareunia" },
  { c: "N94.4", e: "ginecologia", n: "Síndrome de congestión pélvica",                          d: "Síndrome de congestión pélvica" },
  { c: "N94.5", e: "ginecologia", n: "Síndrome de tensión premenstrual",                        d: "Síndrome de tensión premenstrual" },
  { c: "N94.6", e: "ginecologia", n: "Dismenorrea NE",                                          d: "Dismenorrea, no especificada" },
  { c: "N94.8", e: "ginecologia", n: "Otras condiciones asociadas con genitales femeninos",     d: "Otras condiciones especificadas asociadas con órganos genitales femeninos y ciclo menstrual" },
  { c: "N94.9", e: "ginecologia", n: "Condición asociada con genitales femeninos NE",          d: "Condición no especificada asociada con órganos genitales femeninos y ciclo menstrual" },
  { c: "N95",   e: "ginecologia", n: "Trastornos de la menopausia y perimenopausia",            d: "Trastornos de la menopausia y de la perimenopausia" },
  { c: "N95.0", e: "ginecologia", n: "Hemorragia postmenopáusica",                              d: "Hemorragia postmenopáusica" },
  { c: "N95.1", e: "ginecologia", n: "Síntomas menopáusicos y perimenopáusicos",                d: "Síntomas menopáusicos y perimenopáusicos" },
  { c: "N95.2", e: "ginecologia", n: "Vaginitis atrófica postmenopáusica",                      d: "Vaginitis atrófica postmenopáusica" },
  { c: "N95.3", e: "ginecologia", n: "Otras condiciones menopáusicas especificadas",            d: "Otras condiciones especificadas de la menopausia y perimenopausia" },
  { c: "N95.9", e: "ginecologia", n: "Trastorno menopáusico NE",                               d: "Trastorno de la menopausia y perimenopausia, no especificado" },
  { c: "N96",   e: "ginecologia", n: "Pérdida habitual del embarazo (abortos de repetición)",   d: "Pérdida habitual del embarazo" },
  { c: "N97",   e: "ginecologia", n: "Infertilidad femenina",                                   d: "Infertilidad de la mujer" },
  { c: "N97.0", e: "ginecologia", n: "Infertilidad femenina - anovulación",                     d: "Infertilidad asociada con anovulación" },
  { c: "N97.1", e: "ginecologia", n: "Infertilidad femenina - origen tubárico peritoneal",      d: "Infertilidad de origen tubárico peritoneal" },
  { c: "N97.2", e: "ginecologia", n: "Infertilidad femenina - origen uterino",                  d: "Infertilidad de origen uterino" },
  { c: "N97.3", e: "ginecologia", n: "Infertilidad femenina - origen cervical",                 d: "Infertilidad de origen cervical" },
  { c: "N97.4", e: "ginecologia", n: "Infertilidad femenina - origen no especificado",          d: "Infertilidad de origen uterino no especificado" },
  { c: "N97.8", e: "ginecologia", n: "Infertilidad femenina - otro origen",                     d: "Infertilidad de otro origen especificado" },
  { c: "N97.9", e: "ginecologia", n: "Infertilidad femenina NE",                               d: "Infertilidad de origen no especificado" },
  { c: "N98",   e: "ginecologia", n: "Complicaciones de la fertilización artificial",           d: "Complicaciones asociadas con la fertilización artificial" },
  { c: "N98.0", e: "ginecologia", n: "Síndrome de hiperestimulación ovárica iatrogénico",       d: "Ovarios poliquísticos iatrogénicos" },
  { c: "N98.1", e: "ginecologia", n: "Hiperstimulación ovárica",                                d: "Hiperstimulación ovárica" },
  { c: "N98.2", e: "ginecologia", n: "Complicaciones de trasplante de embrión",                 d: "Complicaciones de trasplante de embrión" },
  { c: "N98.3", e: "ginecologia", n: "Complicaciones de perforación uterina intencional",       d: "Complicaciones de perforación uterina intencional" },
  { c: "N98.8", e: "ginecologia", n: "Otras complicaciones de la fertilización artificial",     d: "Otras complicaciones de la fertilización artificial" },
  { c: "N98.9", e: "ginecologia", n: "Complicación de la fertilización artificial NE",         d: "Complicación de la fertilización artificial, no especificada" },

  // ═══════════════════════════════════════════════════════════════════════════
  //  N99  TRASTORNOS POSTPROCEDIMIENTO
  // ═══════════════════════════════════════════════════════════════════════════
  { c: "N99",   e: "nefrologia", n: "Trastornos postprocedimiento del sistema genitourinario",  d: "Otros trastornos del sistema genitourinario postprocedimiento" },
  { c: "N99.0", e: "nefrologia", n: "Insuficiencia renal postprocedimiento",                    d: "Insuficiencia renal postprocedimientos" },
  { c: "N99.1", e: "urologia",   n: "Estrechez uretral postprocedimiento",                      d: "Estrechez uretral postprocedimientos" },
  { c: "N99.2", e: "ginecologia", n: "Adherencias pélvicas postprocedimiento",                  d: "Adherencias peritoneales pélvicas postprocedimientos" },
  { c: "N99.3", e: "ginecologia", n: "Prolapso de cúpula vaginal postprocedimiento",            d: "Prolapso de cúpula vaginal postprocedimientos" },
  { c: "N99.4", e: "ginecologia", n: "Adherencias pélvicas femeninas postprocedimiento",        d: "Adherencias peritoneales pélvicas femeninas postprocedimientos" },
  { c: "N99.5", e: "urologia",   n: "Complicaciones de cistostomía",                            d: "Complicaciones de cistostomía" },
  { c: "N99.6", e: "nefrologia", n: "Complicaciones de derivaciones urológicas",                d: "Complicaciones de otras derivaciones, implantes y trasplantes urológicos" },
  { c: "N99.8", e: "nefrologia", n: "Otros trastornos genitourinarios postprocedimiento",       d: "Otros trastornos especificados del sistema genitourinario postprocedimiento" },
  { c: "N99.9", e: "nefrologia", n: "Trastorno genitourinario postprocedimiento NE",           d: "Trastorno del sistema genitourinario postprocedimiento, no especificado" },
];

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     Number(process.env.DB_PORT || 3306),
  });

  console.log("\n🚀 Iniciando migración 050 — Capítulo 14 completo (faltantes)...\n");
  console.log(`📋 Procesando ${FALTANTES.length} códigos pendientes...\n`);

  // Filtrar los que ya existen
  const codigos = FALTANTES.map(d => d.c);
  const [existing] = await conn.query(
    `SELECT codigo_cie FROM catalogos_diagnostico
     WHERE clinica_id IS NULL AND codigo_cie IN (${codigos.map(() => "?").join(",")})`,
    codigos
  );
  const existingSet = new Set(existing.map(r => r.codigo_cie));

  const nuevos = FALTANTES.filter(d => !existingSet.has(d.c));

  if (!nuevos.length) {
    console.log("⚠️  Todos los diagnósticos ya existen. No se insertó nada.");
    await conn.end();
    return;
  }

  // Bulk INSERT en lotes de 100 para no exceder límites de MySQL
  const LOTE = 100;
  let total = 0;
  for (let i = 0; i < nuevos.length; i += LOTE) {
    const lote = nuevos.slice(i, i + LOTE);
    const placeholders = lote.map(() => "(?,?,?,?,?,?,?)").join(",\n  ");
    const flat = lote.flatMap(d => [null, null, d.n, d.e, d.c, d.d, null]);
    await conn.query(
      `INSERT INTO catalogos_diagnostico
         (clinica_id, medico_id, nombre, especialidad, codigo_cie, descripcion_cie, diagnosticos_secundarios)
       VALUES\n  ${placeholders}`,
      flat
    );
    total += lote.length;
    console.log(`   ✔ Lote ${Math.ceil((i + LOTE) / LOTE)} insertado (${Math.min(i + LOTE, nuevos.length)}/${nuevos.length})`);
  }

  await conn.end();

  console.log(`\n✅  ${total} diagnósticos insertados (${existingSet.size} ya existían)`);
  console.log("\n📊 Resumen por especialidad:");
  const resumen = {};
  nuevos.forEach(d => { resumen[d.e] = (resumen[d.e] || 0) + 1; });
  Object.entries(resumen).forEach(([esp, qty]) => console.log(`   • ${esp}: ${qty} códigos`));
  console.log("\n🎉 Migración 050 completada. Capítulo 14 CIE-10 al completo.\n");
}

run().catch(err => {
  console.error("\n💥 Error fatal:", err.message);
  process.exit(1);
});
