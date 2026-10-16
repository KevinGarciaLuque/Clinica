// 📲 Instalar Medic-KG como app (PWA).
// El navegador avisa una sola vez y muy temprano ("beforeinstallprompt") que la app
// se puede instalar: se guarda ese aviso aquí para usarlo cuando el usuario toque
// "Instalar app". En iPhone/iPad no existe ese aviso: se muestran instrucciones.
const oyentes = new Set();
let aviso = null;
let instalada = false;

const avisar = () => oyentes.forEach((fn) => fn());

export function esApp() {
  if (typeof window === "undefined") return false;
  return instalada || window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function esIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPad con iPadOS
}

/** ¿Se puede ofrecer "Instalar app"? (aviso del navegador disponible, o iPhone/iPad en Safari) */
export function puedeInstalar() {
  if (esApp()) return false;
  return !!aviso || esIOS();
}

export function suscribirInstalacion(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** Muestra el diálogo de instalación del navegador. Devuelve "instalada", "cancelada" o "ios". */
export async function instalar() {
  if (!aviso) return esIOS() ? "ios" : "no-disponible";
  const ev = aviso;
  aviso = null;
  ev.prompt();
  const { outcome } = await ev.userChoice;
  avisar();
  return outcome === "accepted" ? "instalada" : "cancelada";
}

export function iniciarInstalacion() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();          // se ofrece desde el menú, no con la barra automática
    aviso = e;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    instalada = true;
    aviso = null;
    avisar();
  });
  // Service worker: necesario para instalar la app y para la página "Sin conexión".
  // Es el mismo que usan las notificaciones push.
  const seguro = window.location.protocol === "https:" || window.location.hostname === "localhost";
  if ("serviceWorker" in navigator && seguro) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}
