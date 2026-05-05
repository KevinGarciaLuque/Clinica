let webpush = null;
try {
  webpush = require("web-push");
} catch {
  webpush = null;
}

const isConfigured = () =>
  !!webpush &&
  !!process.env.VAPID_PUBLIC_KEY &&
  !!process.env.VAPID_PRIVATE_KEY &&
  !!process.env.VAPID_SUBJECT;

function configure() {
  if (!isConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return true;
}

async function sendToUsers(pool, userIds, payload) {
  if (!configure() || !Array.isArray(userIds) || userIds.length === 0) return;

  const [subs] = await pool.query(
    `SELECT id, endpoint, p256dh, auth
     FROM push_subscriptions
     WHERE activo = 1 AND user_id IN (?)`,
    [userIds]
  );
  if (!subs.length) return;

  const body = JSON.stringify(payload);
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        body
      );
    } catch (e) {
      const code = e?.statusCode || 0;
      if (code === 404 || code === 410) {
        await pool.query("UPDATE push_subscriptions SET activo=0 WHERE id=?", [s.id]);
      }
    }
  }
}

module.exports = { isConfigured, sendToUsers };
