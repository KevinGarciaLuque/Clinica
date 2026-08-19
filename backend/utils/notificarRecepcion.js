/**
 * notificarRecepcion.js
 * Notifica (tabla notificaciones_usuario + SSE + Web Push) a los usuarios
 * RECEPCIONISTA activos de una clínica.
 */
async function notificarRecepcionistas(pool, sse, webPush, { clinicaId, tipo, mensaje, pacienteId = null, citaId = null }) {
  const [usuarios] = await pool.query(
    `SELECT id FROM usuarios WHERE clinica_id=? AND activo=1 AND tipo='RECEPCIONISTA'`,
    [clinicaId]
  );
  if (!usuarios.length) return;

  const values = usuarios.map((u) => [u.id, clinicaId, tipo, mensaje, pacienteId, citaId]);
  await pool.query(
    `INSERT INTO notificaciones_usuario (usuario_id, clinica_id, tipo, mensaje, paciente_id, cita_id) VALUES ?`,
    [values]
  );

  for (const u of usuarios) {
    sse.notifyUser(u.id, "notificacion_portal", { tipo, mensaje, paciente_id: pacienteId, cita_id: citaId });
  }

  await webPush.sendToUsers(pool, usuarios.map((u) => u.id), {
    title: "Nueva notificación",
    body: mensaje,
    tag: tipo,
    data: { tipo, paciente_id: pacienteId, cita_id: citaId, url: "/recepcion" },
  });
}

module.exports = { notificarRecepcionistas };
