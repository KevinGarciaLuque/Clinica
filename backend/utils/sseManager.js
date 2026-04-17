/**
 * sseManager.js — Gestor de conexiones Server-Sent Events
 *
 * Cada usuario conectado queda registrado por su ID.
 * Los SUPER_ADMIN también se registran en un set aparte.
 */

// Map<userId, Set<res>>  — un usuario puede tener varias pestañas abiertas
const clients = new Map();
const superAdmins = new Set(); // userIds que son SUPER_ADMIN

function addClient(userId, isSuperAdmin, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
  if (isSuperAdmin) superAdmins.add(userId);
}

function removeClient(userId, res) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    clients.delete(userId);
    superAdmins.delete(userId);
  }
}

/** Envía un evento SSE a un usuario específico */
function notifyUser(userId, event, data) {
  const set = clients.get(userId);
  if (!set) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(msg); } catch {}
  }
}

/** Envía un evento a todos los SUPER_ADMIN conectados */
function notifySuperAdmins(event, data) {
  for (const uid of superAdmins) {
    notifyUser(uid, event, data);
  }
}

module.exports = { addClient, removeClient, notifyUser, notifySuperAdmins };
