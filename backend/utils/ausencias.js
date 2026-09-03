/**
 * utils/ausencias.js
 * Helpers para descontar ausencias (vacaciones / permiso / incapacidad …)
 * de la disponibilidad del médico al generar turnos. NO toca horarios_medico.
 */
const pool = require("../db");

let tablaLista = false;
async function ensureTabla() {
  if (tablaLista) return true;
  try {
    const [t] = await pool.query("SHOW TABLES LIKE 'ausencias_medico'");
    tablaLista = t.length > 0;
  } catch { tablaLista = false; }
  return tablaLista;
}

/**
 * Ausencias que solapan una fecha concreta (YYYY-MM-DD) para un médico.
 * @returns {Array<{tipo,todo_el_dia,hora_inicio,hora_fin,motivo}>}
 */
async function ausenciasEnFecha(medicoId, clinicaId, fecha) {
  if (!(await ensureTabla())) return [];
  const [rows] = await pool.query(
    `SELECT tipo, todo_el_dia, hora_inicio, hora_fin, motivo
       FROM ausencias_medico
      WHERE clinica_id=? AND medico_id=? AND fecha_inicio<=? AND fecha_fin>=?`,
    [clinicaId, medicoId, fecha, fecha]
  );
  return rows;
}

/** ¿El médico está completamente ausente ese día? */
function ausenteTodoElDia(ausencias) {
  return ausencias.some(a => Number(a.todo_el_dia) === 1);
}

/**
 * ¿Un turno (horas locales "HH:MM") cae dentro de alguna ausencia?
 * Las ausencias de todo el día ya se filtran antes con ausenteTodoElDia.
 */
function turnoBloqueado(ausencias, hhmmInicio, hhmmFin) {
  return ausencias.some(a => {
    if (Number(a.todo_el_dia) === 1) return true;
    if (!a.hora_inicio || !a.hora_fin) return false;
    const hi = String(a.hora_inicio).slice(0, 5);
    const hf = String(a.hora_fin).slice(0, 5);
    return hhmmInicio < hf && hhmmFin > hi; // solape
  });
}

module.exports = { ausenciasEnFecha, ausenteTodoElDia, turnoBloqueado, ensureTabla };
