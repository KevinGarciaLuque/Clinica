// Paquetes de sesiones de estética (ej.: «Láser, 6 sesiones»), a partir de los
// presupuestos aprobados o cobrados. Las sesiones usadas se cuentan con los
// procedimientos registrados en la consulta que usaron ese paquete
// (procedimiento.paquete = { presupuesto_id, indice }).

/**
 * @param registros  lista de listarEstetica(undefined, pacienteId)
 * @param excluirHistoriaId  no contar la consulta que se está editando
 */
export function paquetesDe(registros = [], excluirHistoriaId = null) {
  const usadas = {};
  registros.forEach((r) => {
    if (r._tipo !== "procedimiento" || !r.paquete?.presupuesto_id) return;
    if (excluirHistoriaId && String(r.historia_id || "") === String(excluirHistoriaId)) return;
    const k = `${r.paquete.presupuesto_id}|${r.paquete.indice}`;
    usadas[k] = (usadas[k] || 0) + 1;
  });
  const lista = [];
  registros.forEach((p) => {
    if (p._tipo !== "presupuesto") return;
    const activo = p.estado === "APROBADO" || (p._factura && p._factura.estado !== "ANULADA");
    if (!activo) return;
    (p.procedimientos || []).forEach((x, indice) => {
      const sesiones = Number(x.sesiones) || 0;
      if (sesiones <= 1 || !x.nombre) return;
      const u = usadas[`${p.id}|${indice}`] || 0;
      lista.push({ presupuesto_id: p.id, indice, nombre: x.nombre, sesiones, usadas: u, quedan: Math.max(sesiones - u, 0), factura: p._factura || null });
    });
  });
  return lista;
}
