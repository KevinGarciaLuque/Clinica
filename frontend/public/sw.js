// Service worker de Medic-KG: notificaciones push, contador del ícono y página
// "Sin conexión" cuando la app instalada se abre sin internet.
// No guarda en caché las pantallas ni los datos: siempre se carga la versión actual.
const CACHE_OFFLINE = "medickg-offline-v1";
const PAGINA_OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_OFFLINE)
      .then((c) => c.addAll([PAGINA_OFFLINE, "/icons/icon-192.png"]))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(claves.filter((k) => k.startsWith("medickg-offline-") && k !== CACHE_OFFLINE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Solo se intervienen las navegaciones (abrir una pantalla) del propio sitio:
// van siempre a internet y, si no hay conexión, se muestra la página "Sin conexión".
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    // cache: "no-store" → sin internet falla de inmediato (en vez de mostrar una copia
    // vieja de la página que luego queda en blanco) y se muestra la página "Sin conexión"
    fetch(req, { cache: "no-store" }).catch(async () => (await caches.match(PAGINA_OFFLINE)) || Response.error())
  );
});

const BADGE_DB = "medickg-badge";
const BADGE_STORE = "state";
const BADGE_KEY = "count";

function badgeDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BADGE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(BADGE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getBadgeCount() {
  try {
    const db = await badgeDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(BADGE_STORE, "readonly");
      const r = tx.objectStore(BADGE_STORE).get(BADGE_KEY);
      r.onsuccess = () => resolve(r.result || 0);
      r.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

async function setBadgeCount(count) {
  // Si el contador ya estaba en cero no hay nada que limpiar: no se toca el ícono
  // (la mayoría de usuarios sin notificaciones push nunca tienen contador).
  const anterior = await getBadgeCount();
  if (count === 0 && anterior === 0) return;
  try {
    const db = await badgeDb();
    await new Promise((resolve) => {
      const tx = db.transaction(BADGE_STORE, "readwrite");
      tx.objectStore(BADGE_STORE).put(count, BADGE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {
    // sin soporte de IndexedDB en este entorno
  }
  if ("setAppBadge" in self.navigator) {
    try {
      if (count > 0) await self.navigator.setAppBadge(count);
      else await self.navigator.clearAppBadge();
    } catch {
      // Badging API no disponible (ej. desktop sin soporte)
    }
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Notificación";
  const options = {
    body: data.body || "Tienes una nueva notificación",
    icon: "/icons/icon-512.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "clinica-notif",
    data: data.data || {},
  };

  event.waitUntil(
    (async () => {
      const nuevoConteo = (await getBadgeCount()) + 1;
      await setBadgeCount(nuevoConteo);
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(targetUrl);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return null;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "RESET_BADGE") {
    event.waitUntil(setBadgeCount(0));
  }
});
